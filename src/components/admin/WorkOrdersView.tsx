import React, { useEffect, useMemo, useState } from 'react';
import {
  Wrench, Plus, Search, X, Pencil, Trash2, Download, RotateCcw, ArrowUpDown, AlertTriangle, CalendarClock, Clock,
  CheckCircle2, Play, List, CalendarDays, ChevronLeft, ChevronRight, Save, Building2, Repeat,
} from 'lucide-react';
import type { FixedAsset, WorkOrder } from '../../types';
import { getSites, useSitesRefresh } from '../../data/siteStore';
import { PageHeader } from './AdminExtraViews';
import { ModalShell } from './AssetManagementViews';
import { labelPenuh, labelSiteDariKey } from './siteLabel';
import { WR_CSS } from './wrTema';
import { EAM_CSS, KpiKartu, Pager, Pil, potongHalaman } from './eamUi';
import {
  angka, BOBOT_PRIORITAS, fmtTanggal, hariIni, infoJatuhTempo, selisihHari, statusWo, tambahBulan, unduhCsv, WO_TERBUKA,
} from './eamHelpers';

const SEMUA = 'ALL';

type FilterStatus = typeof SEMUA | 'MINGGU' | WorkOrder['status'];
type Urutan = 'jatuh' | 'prioritas' | 'terbaru';
type Tampilan = 'daftar' | 'kalender';

const URUTAN: { id: Urutan; label: string }[] = [
  { id: 'jatuh', label: 'Jatuh tempo terdekat' },
  { id: 'prioritas', label: 'Prioritas tertinggi' },
  { id: 'terbaru', label: 'Terbaru dibuat' },
];

const STATUS_META: Record<WorkOrder['status'], { color: string; bg: string; label: string }> = {
  Scheduled: { color: '#60A5FA', bg: 'rgba(96,165,250,0.13)', label: 'Scheduled' },
  'In Progress': { color: '#FBBF24', bg: 'rgba(251,191,36,0.15)', label: 'In Progress' },
  Completed: { color: '#34D399', bg: 'rgba(52,211,153,0.13)', label: 'Completed' },
  Overdue: { color: '#F87171', bg: 'rgba(248,113,113,0.14)', label: 'Overdue' },
  Cancelled: { color: '#94A3B8', bg: 'rgba(148,163,184,0.16)', label: 'Cancelled' },
};
const PRIO_META: Record<WorkOrder['priority'], { color: string; bg: string }> = {
  Low: { color: '#94A3B8', bg: 'rgba(148,163,184,0.16)' },
  Medium: { color: '#60A5FA', bg: 'rgba(96,165,250,0.13)' },
  High: { color: '#FBBF24', bg: 'rgba(251,191,36,0.15)' },
  Urgent: { color: '#F87171', bg: 'rgba(248,113,113,0.14)' },
};
const TIPE_META: Record<WorkOrder['type'], { color: string; bg: string }> = {
  Preventive: { color: '#00D084', bg: 'rgba(0,208,132,0.12)' },
  Corrective: { color: '#F59E0B', bg: 'rgba(245,158,11,0.14)' },
  Inspection: { color: '#A78BFA', bg: 'rgba(167,139,250,0.14)' },
};

const CSS = `
.wo-cal{min-width:680px}
.wo-cal-head,.wo-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
.wo-cal-head div{font-size:.7rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--wr-txt-muted);padding:.4rem .5rem}
.wo-cell{min-height:104px;padding:.35rem .4rem;border-top:1px solid var(--wr-line);border-left:1px solid var(--wr-line);cursor:pointer;
  background:transparent;text-align:left;font:inherit;color:inherit;display:flex;flex-direction:column;gap:3px}
.wo-cal-grid .wo-cell:nth-child(7n){border-right:1px solid var(--wr-line)}
.wo-cell:hover{background:var(--wr-row-hover)}
.wo-cell.luar{opacity:.45}
.wo-cell[aria-pressed='true']{background:var(--wr-row-selected);box-shadow:0 0 0 1px var(--wr-in) inset}
.wo-cell:focus-visible{outline:2px solid var(--wr-focus,#00D084);outline-offset:-2px}
.wo-num{font-size:.78rem;font-weight:700;width:24px;height:24px;display:grid;place-items:center;border-radius:50%;color:var(--txt-secondary)}
.wo-num.hari-ini{background:var(--wr-in);color:var(--wr-on-in)}
.wo-chip{font-size:.68rem;font-weight:600;padding:2px 6px;border-radius:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
.wo-more{font-size:.68rem;color:var(--wr-txt-muted);padding-left:4px}
.wo-card{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;justify-content:space-between;border-radius:12px;padding:.75rem .9rem;background:var(--wr-tab-bg);border:1px solid var(--wr-line)}
`;

const tglLokal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const NAMA_HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/* ═══════════════════════════ Form jadwal (tambah / ubah) ═══════════════════════════ */
export const WorkOrderModal: React.FC<{
  isOpen: boolean;
  fixedAssets: FixedAsset[];
  /** Isi untuk mengubah work order yang ada; null untuk membuat baru. */
  workOrder: WorkOrder | null;
  /** Aset yang dipilih lebih dulu saat membuat baru. */
  presetAssetId?: string;
  onClose: () => void;
  onSave: (patch: Partial<WorkOrder>) => void | Promise<void>;
}> = ({ isOpen, fixedAssets, workOrder, presetAssetId, onClose, onSave }) => {
  const [assetId, setAssetId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<WorkOrder['type']>('Preventive');
  const [priority, setPriority] = useState<WorkOrder['priority']>('Medium');
  const [status, setStatus] = useState<WorkOrder['status']>('Scheduled');
  const [dueDate, setDueDate] = useState(hariIni());
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');
  const adaAset = fixedAssets.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    if (workOrder) {
      setAssetId(workOrder.assetId); setTitle(workOrder.title); setType(workOrder.type); setPriority(workOrder.priority);
      // "Overdue" hanya tampilan; di database statusnya tetap Scheduled
      setStatus(workOrder.status === 'Overdue' ? 'Scheduled' : workOrder.status);
      setDueDate(workOrder.dueDate); setAssignedTo(workOrder.assignedTo ?? ''); setNotes(workOrder.notes ?? '');
    } else {
      setAssetId(presetAssetId ?? fixedAssets[0]?.id ?? ''); setTitle(''); setType('Preventive'); setPriority('Medium');
      setStatus('Scheduled'); setDueDate(hariIni()); setAssignedTo(''); setNotes('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, workOrder, presetAssetId, adaAset]);

  if (!isOpen) return null;
  const aset = fixedAssets.find((a) => a.id === assetId) ?? null;
  const edit = !!workOrder;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetId || !title.trim() || !dueDate) return;
    if (edit && workOrder) {
      void onSave({
        id: workOrder.id, title: title.trim(), type, priority, dueDate, notes: notes.trim(),
        assignedTo: assignedTo.trim(), // string kosong = hapus PIC
        status,
        ...(status === 'Completed' && !workOrder.completedDate ? { completedDate: hariIni() } : {}),
      });
    } else {
      void onSave({ assetId, title: title.trim(), type, priority, dueDate, assignedTo: assignedTo.trim() || undefined, notes: notes.trim() });
    }
    onClose();
  };

  const lbl: React.CSSProperties = { display: 'block', fontSize: '.78rem', color: 'var(--wr-txt-muted)', marginBottom: '.3rem', fontWeight: 600 };
  const statusPilihan: WorkOrder['status'][] = workOrder?.status === 'Completed' ? ['Scheduled', 'In Progress', 'Completed', 'Cancelled'] : ['Scheduled', 'In Progress', 'Cancelled'];

  return (
    <ModalShell title={edit ? 'Ubah Pekerjaan Maintenance' : 'Jadwalkan Pekerjaan Maintenance'} icon={Wrench} onClose={onClose}>
      <style>{WR_CSS}{EAM_CSS}</style>
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={lbl} htmlFor="wo-aset">Aset terkait</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
            <div className="eam-thumb">{aset?.imageUrl ? <img src={aset.imageUrl} alt="" /> : <Building2 size={18} color="#64748B" />}</div>
            <select id="wo-aset" required className="wr-ctl eam-sel" style={{ flex: 1 }} value={assetId} disabled={edit}
              onChange={(e) => setAssetId(e.target.value)}>
              {!adaAset && <option value="">Belum ada aset terdaftar</option>}
              {fixedAssets.map((a) => <option key={a.id} value={a.id}>{a.assetCode} — {a.name} ({labelSiteDariKey(a.site)})</option>)}
            </select>
          </div>
          {edit && <div style={{ fontSize: '.72rem', color: 'var(--wr-txt-muted)', marginTop: 4 }}>Aset tidak dapat diganti. Hapus lalu buat pekerjaan baru bila salah memilih aset.</div>}
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={lbl} htmlFor="wo-judul">Judul pekerjaan</label>
          <input id="wo-judul" required className="wr-ctl eam-sel" style={{ width: '100%' }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Penggantian filter oli compressor" />
        </div>
        <div>
          <label style={lbl} htmlFor="wo-tipe">Tipe</label>
          <select id="wo-tipe" className="wr-ctl eam-sel" style={{ width: '100%' }} value={type} onChange={(e) => setType(e.target.value as WorkOrder['type'])}>
            <option value="Preventive">Preventive</option><option value="Corrective">Corrective</option><option value="Inspection">Inspection</option>
          </select>
        </div>
        <div>
          <label style={lbl} htmlFor="wo-prio">Prioritas</label>
          <select id="wo-prio" className="wr-ctl eam-sel" style={{ width: '100%' }} value={priority} onChange={(e) => setPriority(e.target.value as WorkOrder['priority'])}>
            <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label style={lbl} htmlFor="wo-due">Jatuh tempo</label>
          <input id="wo-due" required type="date" className="wr-ctl eam-sel" style={{ width: '100%' }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <label style={lbl} htmlFor="wo-pic">PIC / Teknisi</label>
          <input id="wo-pic" className="wr-ctl eam-sel" style={{ width: '100%' }} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Nama teknisi" />
        </div>
        {edit && (
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl} htmlFor="wo-status">Status</label>
            <select id="wo-status" className="wr-ctl eam-sel" style={{ width: '100%', maxWidth: 260 }} value={status} onChange={(e) => setStatus(e.target.value as WorkOrder['status'])}>
              {statusPilihan.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
            <div style={{ fontSize: '.72rem', color: 'var(--wr-txt-muted)', marginTop: 4 }}>Untuk menyelesaikan pekerjaan, gunakan tombol “Selesai” di daftar agar tanggal dan catatannya tercatat.</div>
          </div>
        )}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={lbl} htmlFor="wo-cat">Catatan</label>
          <textarea id="wo-cat" className="wr-ctl eam-sel" style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '.6rem', marginTop: '.3rem' }}>
          <button type="button" className="wr-btn eam-btn" onClick={onClose}>Batal</button>
          <button type="submit" className="wr-btn wr-btn--primary eam-btn" disabled={!adaAset}><Save size={15} /> {edit ? 'Simpan perubahan' : 'Jadwalkan'}</button>
        </div>
      </form>
    </ModalShell>
  );
};

/* ═══════════════════════════ Dialog selesai ═══════════════════════════ */
export interface OpsiSelesai { completedDate: string; note: string; nextInMonths: number }

const CompleteDialog: React.FC<{ wo: WorkOrder; aset?: FixedAsset; onClose: () => void; onConfirm: (o: OpsiSelesai) => void }> = ({ wo, aset, onClose, onConfirm }) => {
  const [tgl, setTgl] = useState(hariIni());
  const [catatan, setCatatan] = useState('');
  const [ulang, setUlang] = useState(0);
  const berikutnya = ulang > 0 ? tambahBulan(tgl, ulang) : null;
  const lbl: React.CSSProperties = { display: 'block', fontSize: '.78rem', color: 'var(--wr-txt-muted)', marginBottom: '.3rem', fontWeight: 600 };
  return (
    <ModalShell title="Selesaikan Pekerjaan" icon={CheckCircle2} onClose={onClose} maxWidth="520px">
      <style>{WR_CSS}{EAM_CSS}</style>
      <div className="wo-card" style={{ marginBottom: '1rem' }}>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--txt-primary)' }}>{wo.title}</div>
          <div style={{ fontSize: '.76rem', color: 'var(--wr-txt-muted)' }}>{aset ? `${aset.assetCode} — ${aset.name}` : wo.assetId} · {wo.type}</div>
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onConfirm({ completedDate: tgl, note: catatan.trim(), nextInMonths: ulang }); onClose(); }}
        style={{ display: 'grid', gap: '1rem' }}>
        <div>
          <label style={lbl} htmlFor="sel-tgl">Tanggal selesai</label>
          <input id="sel-tgl" required type="date" max={hariIni()} className="wr-ctl eam-sel" value={tgl} onChange={(e) => setTgl(e.target.value)} />
        </div>
        <div>
          <label style={lbl} htmlFor="sel-cat">Catatan penyelesaian (opsional)</label>
          <textarea id="sel-cat" rows={3} className="wr-ctl eam-sel" style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }} value={catatan}
            onChange={(e) => setCatatan(e.target.value)} placeholder="Mis. filter oli diganti, tekanan normal 250 bar" />
        </div>
        {wo.type === 'Preventive' && (
          <div>
            <label style={lbl} htmlFor="sel-ulang"><Repeat size={12} style={{ verticalAlign: '-1px' }} /> Jadwalkan pekerjaan berikutnya</label>
            <select id="sel-ulang" className="wr-ctl eam-sel" value={ulang} onChange={(e) => setUlang(Number(e.target.value))}>
              <option value={0}>Tidak, selesai saja</option>
              <option value={1}>1 bulan lagi</option><option value={3}>3 bulan lagi</option>
              <option value={6}>6 bulan lagi</option><option value={12}>12 bulan lagi</option>
            </select>
            <div style={{ fontSize: '.74rem', color: 'var(--wr-txt-muted)', marginTop: 4 }}>
              {berikutnya ? `Pekerjaan yang sama otomatis dijadwalkan untuk ${fmtTanggal(berikutnya)}.` : 'Cocok untuk perawatan berkala agar tidak terlewat.'}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.6rem' }}>
          <button type="button" className="wr-btn eam-btn" onClick={onClose}>Batal</button>
          <button type="submit" className="wr-btn wr-btn--primary eam-btn"><CheckCircle2 size={15} /> Tandai selesai</button>
        </div>
      </form>
    </ModalShell>
  );
};

/* ═══════════════════════════ Halaman utama ═══════════════════════════ */
interface Props {
  workOrders: WorkOrder[];
  fixedAssets: FixedAsset[];
  onSave: (patch: Partial<WorkOrder>) => void | Promise<void>;
  onStart: (id: string) => Promise<void>;
  onComplete: (id: string, opsi: OpsiSelesai) => Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}

export const WorkOrdersView: React.FC<Props> = ({ workOrders, fixedAssets, onSave, onStart, onComplete, onDelete }) => {
  useSitesRefresh();

  const [tampilan, setTampilan] = useState<Tampilan>('daftar');
  const [cari, setCari] = useState('');
  const [status, setStatus] = useState<FilterStatus>(SEMUA);
  const [tipe, setTipe] = useState(SEMUA);
  const [prioritas, setPrioritas] = useState(SEMUA);
  const [site, setSite] = useState(SEMUA);
  const [urutan, setUrutan] = useState<Urutan>('jatuh');
  const [halaman, setHalaman] = useState(1);
  const [sibuk, setSibuk] = useState<ReadonlySet<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editWo, setEditWo] = useState<WorkOrder | null>(null);
  const [selesaiWo, setSelesaiWo] = useState<WorkOrder | null>(null);

  const kini = new Date();
  const [bulan, setBulan] = useState({ y: kini.getFullYear(), m: kini.getMonth() });
  const [hariDipilih, setHariDipilih] = useState<string | null>(null);

  const asetById = useMemo(() => Object.fromEntries(fixedAssets.map((a) => [a.id, a])), [fixedAssets]);
  const today = hariIni();

  const kata = cari.trim().toLowerCase();
  const dasar = useMemo(() => workOrders.filter((w) => {
    const a = asetById[w.assetId];
    return (tipe === SEMUA || w.type === tipe)
      && (prioritas === SEMUA || w.priority === prioritas)
      && (site === SEMUA || a?.site === site)
      && (!kata || w.title.toLowerCase().includes(kata) || (w.assignedTo ?? '').toLowerCase().includes(kata)
        || (a?.name ?? '').toLowerCase().includes(kata) || (a?.assetCode ?? '').toLowerCase().includes(kata));
  }), [workOrders, asetById, tipe, prioritas, site, kata]);

  const dalam7Hari = (w: WorkOrder) => WO_TERBUKA(statusWo(w)) && selisihHari(today, w.dueDate) >= 0 && selisihHari(today, w.dueDate) <= 7;

  const hitung = useMemo(() => {
    const h: Record<string, number> = { [SEMUA]: dasar.length, MINGGU: 0, Scheduled: 0, 'In Progress': 0, Completed: 0, Overdue: 0, Cancelled: 0 };
    for (const w of dasar) {
      h[statusWo(w)] += 1;
      if (dalam7Hari(w)) h.MINGGU += 1;
    }
    return h;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dasar]);

  const terfilter = useMemo(() => {
    const a = dasar.filter((w) => status === SEMUA ? true : status === 'MINGGU' ? dalam7Hari(w) : statusWo(w) === status);
    const terbuka = (w: WorkOrder) => (WO_TERBUKA(statusWo(w)) ? 0 : 1);
    if (urutan === 'terbaru') return a.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    if (urutan === 'prioritas') {
      return a.sort((x, y) => terbuka(x) - terbuka(y) || BOBOT_PRIORITAS[x.priority] - BOBOT_PRIORITAS[y.priority] || x.dueDate.localeCompare(y.dueDate));
    }
    // jatuh tempo: yang masih terbuka dulu (paling dekat → jauh), lalu yang sudah selesai (terbaru dulu)
    return a.sort((x, y) => terbuka(x) - terbuka(y) || (terbuka(x) === 0 ? x.dueDate.localeCompare(y.dueDate) : y.dueDate.localeCompare(x.dueDate)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dasar, status, urutan]);

  useEffect(() => { setHalaman(1); }, [cari, status, tipe, prioritas, site, urutan]);

  const adaFilter = !!kata || status !== SEMUA || tipe !== SEMUA || prioritas !== SEMUA || site !== SEMUA;
  const reset = () => { setCari(''); setStatus(SEMUA); setTipe(SEMUA); setPrioritas(SEMUA); setSite(SEMUA); };

  const selesai30 = useMemo(() => workOrders.filter((w) => w.status === 'Completed' && w.completedDate && selisihHari(w.completedDate, today) <= 30).length, [workOrders, today]);

  const jalankan = async (id: string, fn: () => Promise<void> | void) => {
    if (sibuk.has(id)) return;
    setSibuk((s) => new Set(s).add(id));
    try { await fn(); } finally { setSibuk((s) => { const n = new Set(s); n.delete(id); return n; }); }
  };

  const ekspor = () => unduhCsv(`jadwal-maintenance-${today}.csv`, [
    ['Pekerjaan', 'Aset', 'Kode Aset', 'Site', 'Tipe', 'Prioritas', 'Jatuh Tempo', 'Selesai', 'PIC', 'Status', 'Catatan'],
    ...terfilter.map((w) => {
      const a = asetById[w.assetId];
      return [w.title, a?.name ?? w.assetId, a?.assetCode, a ? labelSiteDariKey(a.site) : '', w.type, w.priority, w.dueDate, w.completedDate, w.assignedTo, statusWo(w), w.notes];
    }),
  ]);

  // ── Kalender ──
  const sel = useMemo(() => {
    const per: Record<string, WorkOrder[]> = {};
    for (const w of terfilter) (per[w.dueDate] ??= []).push(w);
    return per;
  }, [terfilter]);
  const sel42 = useMemo(() => {
    const awal = new Date(bulan.y, bulan.m, 1);
    const geser = (awal.getDay() + 6) % 7; // Senin = 0
    const mulai = new Date(bulan.y, bulan.m, 1 - geser);
    return Array.from({ length: 42 }, (_, i) => new Date(mulai.getFullYear(), mulai.getMonth(), mulai.getDate() + i));
  }, [bulan]);
  const geserBulan = (d: number) => setBulan(({ y, m }) => { const n = new Date(y, m + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });
  const namaBulan = new Date(bulan.y, bulan.m, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const itemHari = hariDipilih ? sel[hariDipilih] ?? [] : [];

  const bukaForm = (w: WorkOrder | null) => { setEditWo(w); setFormOpen(true); };

  const aksi = (w: WorkOrder) => {
    const st = statusWo(w);
    const terbuka = WO_TERBUKA(st);
    const lock = sibuk.has(w.id);
    return (
      <div style={{ display: 'flex', gap: '.35rem', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
        {terbuka && st !== 'In Progress' && (
          <button type="button" className="eam-ib info" disabled={lock} aria-label={`Mulai ${w.title}`} title="Mulai dikerjakan" onClick={() => void jalankan(w.id, () => onStart(w.id))}><Play size={14} /></button>
        )}
        {terbuka && (
          <button type="button" className="eam-ib ok" disabled={lock} aria-label={`Selesaikan ${w.title}`} title="Tandai selesai" onClick={() => setSelesaiWo(w)}><CheckCircle2 size={15} /></button>
        )}
        <button type="button" className="eam-ib" disabled={lock} aria-label={`Ubah ${w.title}`} title="Ubah" onClick={() => bukaForm(w)}><Pencil size={14} /></button>
        <button type="button" className="eam-ib bad" disabled={lock} aria-label={`Hapus ${w.title}`} title="Hapus" onClick={() => void jalankan(w.id, () => onDelete(w.id))}><Trash2 size={14} /></button>
      </div>
    );
  };

  const nadaWarna = { telat: '#F87171', 'hari-ini': '#FBBF24', dekat: '#FBBF24', normal: 'var(--wr-txt-muted)', selesai: 'var(--wr-txt-muted)' } as const;

  return (
    <>
      <style>{WR_CSS}{EAM_CSS}{CSS}</style>
      <PageHeader icon={Wrench} title="Jadwal Maintenance" sub="Work order preventive, corrective, dan inspeksi untuk aset tetap — lengkap dengan kalender dan jadwal berulang." />

      <div className="eam-kpis">
        <KpiKartu ikon={AlertTriangle} warna="#F87171" label="Terlambat" nilai={angka(hitung.Overdue)} nilaiWarna={hitung.Overdue ? '#F87171' : undefined}
          sub={hitung.Overdue ? 'Klik untuk melihat' : 'Tidak ada yang terlambat'} aktif={status === 'Overdue'} onKlik={() => setStatus((s) => (s === 'Overdue' ? SEMUA : 'Overdue'))} />
        <KpiKartu ikon={CalendarClock} warna="#60A5FA" label="Jatuh tempo 7 hari" nilai={angka(hitung.MINGGU)} sub="termasuk yang jatuh tempo hari ini"
          aktif={status === 'MINGGU'} onKlik={() => setStatus((s) => (s === 'MINGGU' ? SEMUA : 'MINGGU'))} />
        <KpiKartu ikon={Clock} warna="#FBBF24" label="Sedang dikerjakan" nilai={angka(hitung['In Progress'])} sub="berstatus In Progress"
          aktif={status === 'In Progress'} onKlik={() => setStatus((s) => (s === 'In Progress' ? SEMUA : 'In Progress'))} />
        <KpiKartu ikon={CheckCircle2} warna="#34D399" label="Selesai" nilai={angka(hitung.Completed)} sub={`${angka(selesai30)} dalam 30 hari terakhir`}
          aktif={status === 'Completed'} onKlik={() => setStatus((s) => (s === 'Completed' ? SEMUA : 'Completed'))} />
      </div>

      <div className="glass-panel" style={{ borderRadius: 20, padding: '1.1rem 1.25rem', marginBottom: '1rem' }}>
        <div className="eam-bar">
          <div className="eam-search">
            <Search size={16} className="eam-ico" />
            <input type="text" className="wr-ctl" placeholder="Cari pekerjaan, aset, kode aset, atau PIC…" aria-label="Cari work order" value={cari} onChange={(e) => setCari(e.target.value)} />
            {cari && <button type="button" className="eam-clear" aria-label="Hapus pencarian" onClick={() => setCari('')}><X size={14} /></button>}
          </div>
          <select className="wr-ctl eam-sel" aria-label="Filter site" value={site} onChange={(e) => setSite(e.target.value)}>
            <option value={SEMUA}>Semua site</option>
            {getSites().map((s) => <option key={s.key} value={s.key}>{labelPenuh(s.label)}</option>)}
          </select>
          <select className="wr-ctl eam-sel" aria-label="Filter tipe" value={tipe} onChange={(e) => setTipe(e.target.value)}>
            <option value={SEMUA}>Semua tipe</option><option value="Preventive">Preventive</option><option value="Corrective">Corrective</option><option value="Inspection">Inspection</option>
          </select>
          <select className="wr-ctl eam-sel" aria-label="Filter prioritas" value={prioritas} onChange={(e) => setPrioritas(e.target.value)}>
            <option value={SEMUA}>Semua prioritas</option><option value="Urgent">Urgent</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
          </select>
          {tampilan === 'daftar' && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', color: 'var(--wr-txt-muted)' }}>
              <ArrowUpDown size={15} />
              <select className="wr-ctl eam-sel" aria-label="Urutkan" value={urutan} onChange={(e) => setUrutan(e.target.value as Urutan)}>
                {URUTAN.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </label>
          )}
          <span style={{ flex: '1 1 0' }} />
          <div className="eam-seg" role="group" aria-label="Tampilan">
            <button type="button" aria-pressed={tampilan === 'daftar'} onClick={() => setTampilan('daftar')}><List size={15} /> Daftar</button>
            <button type="button" aria-pressed={tampilan === 'kalender'} onClick={() => setTampilan('kalender')}><CalendarDays size={15} /> Kalender</button>
          </div>
          <button type="button" className="wr-btn eam-btn" onClick={ekspor} disabled={!terfilter.length} title="Unduh hasil yang sedang tampil sebagai CSV"><Download size={16} /> Export</button>
          <button type="button" className="wr-btn wr-btn--primary eam-btn" onClick={() => bukaForm(null)} disabled={fixedAssets.length === 0}
            title={fixedAssets.length === 0 ? 'Daftarkan aset tetap terlebih dahulu' : undefined}><Plus size={16} /> Jadwalkan Pekerjaan</button>
        </div>

        <div className="eam-chips" role="group" aria-label="Filter status" style={{ marginTop: '1rem' }}>
          {([[SEMUA, 'Semua', null], ['Overdue', 'Terlambat', '#F87171'], ['MINGGU', '7 hari ke depan', '#60A5FA'], ['Scheduled', 'Scheduled', '#60A5FA'],
            ['In Progress', 'In Progress', '#FBBF24'], ['Completed', 'Completed', '#34D399'], ['Cancelled', 'Cancelled', '#94A3B8']] as [FilterStatus, string, string | null][]).map(([id, label, warna]) => (
            <button key={id} type="button" className="eam-chip" aria-pressed={status === id} onClick={() => setStatus(id)}>
              {warna && <span className="eam-dot" style={{ background: warna }} />}{label} <span className="eam-chip-n">{hitung[id] ?? 0}</span>
            </button>
          ))}
          {adaFilter && <button type="button" className="eam-chip" onClick={reset} style={{ marginLeft: 'auto' }}><RotateCcw size={13} /> Reset filter</button>}
        </div>
      </div>

      {tampilan === 'daftar' ? (
        <div className="glass-panel" style={{ borderRadius: 20, padding: '.75rem' }}>
          {terfilter.length === 0 ? (
            <div className="eam-empty">
              <Wrench size={36} style={{ marginBottom: '.75rem', opacity: .6 }} />
              <div style={{ fontWeight: 700, color: 'var(--txt-primary)', marginBottom: 4 }}>{workOrders.length === 0 ? 'Belum ada pekerjaan terjadwal' : 'Tidak ada pekerjaan yang cocok'}</div>
              <div style={{ fontSize: '.85rem' }}>{workOrders.length === 0 ? 'Klik “Jadwalkan Pekerjaan” untuk membuat jadwal maintenance pertama.' : 'Coba ubah kata kunci atau filter yang aktif.'}</div>
              {adaFilter && <button type="button" className="wr-btn eam-btn" style={{ marginTop: '1rem' }} onClick={reset}><RotateCcw size={14} /> Reset filter</button>}
            </div>
          ) : (
            <div className="eam-scroll">
              <table className="eam-tbl" style={{ minWidth: 960 }}>
                <thead><tr><th>Pekerjaan</th><th>Aset</th><th>Prioritas</th><th>Jatuh tempo</th><th>PIC</th><th>Status</th><th style={{ textAlign: 'right' }}>Aksi</th></tr></thead>
                <tbody>
                  {potongHalaman(terfilter, halaman).map((w) => {
                    const st = statusWo(w);
                    const sm = STATUS_META[st];
                    const jt = infoJatuhTempo({ ...w, status: st });
                    const a = asetById[w.assetId];
                    return (
                      <tr key={w.id} className="eam-row" tabIndex={0} onClick={() => bukaForm(w)} onKeyDown={(e) => { if (e.key === 'Enter') bukaForm(w); }}>
                        <td style={{ maxWidth: 300 }}>
                          <div style={{ color: 'var(--txt-primary)', fontWeight: 600 }}>{w.title}</div>
                          <div style={{ marginTop: 3 }}><Pil warna={TIPE_META[w.type].color} bg={TIPE_META[w.type].bg}>{w.type}</Pil></div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                            <div className="eam-thumb" style={{ width: 38, height: 38, borderRadius: 8 }}>{a?.imageUrl ? <img src={a.imageUrl} alt="" loading="lazy" /> : <Building2 size={15} color="#64748B" />}</div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: 'var(--txt-secondary)' }}>{a ? a.name : w.assetId}</div>
                              <div style={{ color: 'var(--wr-txt-muted)', fontSize: '.72rem' }}>{a ? `${a.assetCode} · ${labelSiteDariKey(a.site)}` : ''}</div>
                            </div>
                          </div>
                        </td>
                        <td><Pil warna={PRIO_META[w.priority].color} bg={PRIO_META[w.priority].bg}>{w.priority}</Pil></td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ color: 'var(--txt-secondary)' }}>{fmtTanggal(w.dueDate)}</div>
                          <div style={{ fontSize: '.72rem', fontWeight: jt.nada === 'telat' ? 700 : 500, color: nadaWarna[jt.nada] }}>{jt.teks}</div>
                        </td>
                        <td style={{ color: 'var(--txt-secondary)' }}>{w.assignedTo || '—'}</td>
                        <td><Pil warna={sm.color} bg={sm.bg}>{sm.label}</Pil></td>
                        <td>{aksi(w)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: '0 .5rem .4rem' }}><Pager halaman={halaman} total={terfilter.length} satuan="pekerjaan" onUbah={setHalaman} /></div>
        </div>
      ) : (
        <div className="glass-panel" style={{ borderRadius: 20, padding: '1rem 1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.8rem', flexWrap: 'wrap' }}>
            <button type="button" className="eam-ib" aria-label="Bulan sebelumnya" onClick={() => geserBulan(-1)}><ChevronLeft size={16} /></button>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--txt-primary)', minWidth: 150, textAlign: 'center', textTransform: 'capitalize' }} aria-live="polite">{namaBulan}</div>
            <button type="button" className="eam-ib" aria-label="Bulan berikutnya" onClick={() => geserBulan(1)}><ChevronRight size={16} /></button>
            <button type="button" className="wr-btn eam-btn" style={{ padding: '.4rem .8rem' }} onClick={() => { setBulan({ y: kini.getFullYear(), m: kini.getMonth() }); setHariDipilih(today); }}>Hari ini</button>
            <span style={{ marginLeft: 'auto', fontSize: '.76rem', color: 'var(--wr-txt-muted)' }}>Mengikuti filter di atas · warna = status</span>
          </div>
          <div className="eam-scroll">
            <div className="wo-cal">
              <div className="wo-cal-head">{NAMA_HARI.map((h) => <div key={h}>{h}</div>)}</div>
              <div className="wo-cal-grid">
                {sel42.map((d) => {
                  const key = tglLokal(d);
                  const item = sel[key] ?? [];
                  return (
                    <button key={key} type="button" className={`wo-cell${d.getMonth() !== bulan.m ? ' luar' : ''}`} aria-pressed={hariDipilih === key}
                      aria-label={`${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}, ${item.length} pekerjaan`}
                      onClick={() => setHariDipilih((p) => (p === key ? null : key))}>
                      <span className={`wo-num${key === today ? ' hari-ini' : ''}`}>{d.getDate()}</span>
                      {item.slice(0, 3).map((w) => {
                        const sm = STATUS_META[statusWo(w)];
                        return <span key={w.id} className="wo-chip" style={{ color: sm.color, background: sm.bg }} title={w.title}>{w.title}</span>;
                      })}
                      {item.length > 3 && <span className="wo-more">+{item.length - 3} lagi</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {hariDipilih && (
            <div style={{ marginTop: '1rem' }}>
              <div className="eam-lbl">Pekerjaan pada {fmtTanggal(hariDipilih)} ({itemHari.length})</div>
              {itemHari.length === 0 ? (
                <div className="wo-card" style={{ color: 'var(--wr-txt-muted)', fontSize: '.85rem' }}>
                  Tidak ada pekerjaan di tanggal ini.
                  <button type="button" className="wr-btn eam-btn" disabled={fixedAssets.length === 0} onClick={() => bukaForm(null)}><Plus size={14} /> Jadwalkan</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  {itemHari.map((w) => {
                    const st = statusWo(w);
                    const a = asetById[w.assetId];
                    return (
                      <div key={w.id} className="wo-card">
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--txt-primary)' }}>{w.title}</div>
                          <div style={{ fontSize: '.74rem', color: 'var(--wr-txt-muted)' }}>{a ? `${a.assetCode} — ${a.name} · ${labelSiteDariKey(a.site)}` : w.assetId}{w.assignedTo ? ` · ${w.assignedTo}` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <Pil warna={PRIO_META[w.priority].color} bg={PRIO_META[w.priority].bg}>{w.priority}</Pil>
                          <Pil warna={STATUS_META[st].color} bg={STATUS_META[st].bg}>{STATUS_META[st].label}</Pil>
                          {aksi(w)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <WorkOrderModal isOpen={formOpen} fixedAssets={fixedAssets} workOrder={editWo} onClose={() => setFormOpen(false)} onSave={onSave} />
      {selesaiWo && (
        <CompleteDialog wo={selesaiWo} aset={asetById[selesaiWo.assetId]} onClose={() => setSelesaiWo(null)}
          onConfirm={(o) => void jalankan(selesaiWo.id, () => onComplete(selesaiWo.id, o))} />
      )}
    </>
  );
};
