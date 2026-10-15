import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2, Plus, Search, X, Pencil, Trash2, Download, RotateCcw, ArrowUpDown, Wallet, TrendingDown, ShieldCheck,
  Boxes, ShieldAlert, Wrench, CalendarClock, Eye, AlertTriangle, Hourglass, Globe,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { FixedAsset, WorkOrder } from '../../types';
import { getSites, useSitesRefresh } from '../../data/siteStore';
import { PageHeader, formatIDR } from './AdminExtraViews';
import { ModalShell, FixedAssetModal } from './AssetManagementViews';
import { WorkOrderModal } from './WorkOrdersView';
import { labelPenuh, labelSiteDariKey } from './siteLabel';
import { WR_CSS, tooltipProps, useWrTema } from './wrTema';
import { EAM_CSS, KpiKartu, Pager, Pil, potongHalaman } from './eamUi';
import {
  angka, fmtSisaUmur, fmtTanggal, infoGaransi, infoJatuhTempo, jadwalPenyusutan, rupiahRingkas, statusWo,
  unduhCsv, hariIni, WO_TERBUKA, sisaUmurTahun,
} from './eamHelpers';

const SEMUA = 'ALL';

export type Perhatian = 'garansi' | 'habis' | 'telat';
type Urutan = 'terbaru' | 'nama' | 'buku' | 'susut' | 'garansi' | 'umur';
const URUTAN: { id: Urutan; label: string }[] = [
  { id: 'terbaru', label: 'Terbaru didaftarkan' },
  { id: 'nama', label: 'Nama A–Z' },
  { id: 'buku', label: 'Nilai buku tertinggi' },
  { id: 'susut', label: 'Penyusutan tertinggi' },
  { id: 'umur', label: 'Sisa umur terpendek' },
  { id: 'garansi', label: 'Garansi paling dekat habis' },
];

const STATUS: FixedAsset['status'][] = ['Active', 'Under Maintenance', 'Retired', 'Disposed'];
const STATUS_META: Record<FixedAsset['status'], { color: string; bg: string; label: string }> = {
  Active: { color: '#34D399', bg: 'rgba(52,211,153,0.12)', label: 'Active' },
  'Under Maintenance': { color: '#FBBF24', bg: 'rgba(251,191,36,0.14)', label: 'Maintenance' },
  Retired: { color: '#94A3B8', bg: 'rgba(148,163,184,0.16)', label: 'Retired' },
  Disposed: { color: '#F87171', bg: 'rgba(248,113,113,0.13)', label: 'Disposed' },
};
const WO_META: Record<WorkOrder['status'], { color: string; bg: string }> = {
  Scheduled: { color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
  'In Progress': { color: '#FBBF24', bg: 'rgba(251,191,36,0.14)' },
  Completed: { color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  Overdue: { color: '#F87171', bg: 'rgba(248,113,113,0.13)' },
  Cancelled: { color: '#94A3B8', bg: 'rgba(148,163,184,0.16)' },
};

const aktifOperasional = (a: FixedAsset) => a.status === 'Active' || a.status === 'Under Maintenance';

/* ═══════════════════════════ Detail aset ═══════════════════════════ */
const AssetDetailModal: React.FC<{
  asset: FixedAsset;
  workOrders: WorkOrder[];
  onClose: () => void;
  onEdit: () => void;
  onSchedule: () => void;
  onChangeStatus: (s: FixedAsset['status']) => void;
}> = ({ asset, workOrders, onClose, onEdit, onSchedule, onChangeStatus }) => {
  const { W } = useWrTema();
  const jadwal = useMemo(() => jadwalPenyusutan(asset), [asset]);
  const garansi = infoGaransi(asset);
  const meta = STATUS_META[asset.status];
  const dasar = Math.max(asset.acquisitionCost - asset.salvageValue, 0);

  const dataGrafik = useMemo(() => [
    { label: 'Perolehan', 'Nilai Buku': asset.acquisitionCost },
    ...jadwal.map((j) => ({ label: `Th ${j.tahun}`, 'Nilai Buku': j.nilaiBuku })),
  ], [asset.acquisitionCost, jadwal]);

  const riwayat = useMemo(() => workOrders
    .filter((w) => w.assetId === asset.id)
    .sort((a, b) => Number(WO_TERBUKA(statusWo(b))) - Number(WO_TERBUKA(statusWo(a))) || b.dueDate.localeCompare(a.dueDate)),
  [workOrders, asset.id]);

  const garansiPil = garansi.status === 'tidak-ada' ? null
    : garansi.status === 'habis' ? <Pil warna="#94A3B8" bg="rgba(148,163,184,.16)">Garansi berakhir</Pil>
    : garansi.status === 'segera' ? <Pil warna="#FBBF24" bg="rgba(251,191,36,.14)">Berakhir {garansi.sisaHari} hari lagi</Pil>
    : <Pil warna="#34D399" bg="rgba(52,211,153,.12)">Garansi aktif</Pil>;

  return (
    <ModalShell title="Detail Aset Tetap" icon={Building2} onClose={onClose} maxWidth="940px">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.1rem' }}>
        <div className="eam-thumb" style={{ width: 96, height: 96, borderRadius: 14 }}>
          {asset.imageUrl ? <img src={asset.imageUrl} alt={asset.name} /> : <Building2 size={30} color="#64748B" />}
        </div>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ fontFamily: 'monospace', color: '#00D084', fontSize: '.78rem', fontWeight: 700 }}>{asset.assetCode}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--txt-primary)', lineHeight: 1.25 }}>{asset.name}</div>
          <div style={{ color: 'var(--wr-txt-muted)', fontSize: '.82rem', marginTop: 2 }}>
            {asset.category} · {labelSiteDariKey(asset.site)}{asset.serialNumber ? ` · S/N ${asset.serialNumber}` : ''}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', alignItems: 'center', marginTop: '.6rem' }}>
            <Pil warna={meta.color} bg={meta.bg}>{meta.label}</Pil>
            {garansiPil}
            {asset.fullyDepreciated && <Pil warna="#F87171" bg="rgba(248,113,113,.13)">Habis disusutkan</Pil>}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', alignItems: 'center' }}>
          <select className="wr-ctl eam-sel" aria-label="Ubah status aset" value={asset.status}
            onChange={(e) => onChangeStatus(e.target.value as FixedAsset['status'])}>
            {STATUS.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <button type="button" className="wr-btn eam-btn" onClick={onEdit}><Pencil size={15} /> Edit</button>
          <button type="button" className="wr-btn wr-btn--primary eam-btn" onClick={onSchedule}><CalendarClock size={15} /> Jadwalkan Pekerjaan</button>
        </div>
      </div>

      <div className="eam-grid2" style={{ marginBottom: '1rem' }}>
        <div className="eam-mini"><span>Nilai perolehan</span><b>{formatIDR(asset.acquisitionCost)}</b></div>
        <div className="eam-mini"><span>Nilai buku saat ini</span><b style={{ color: '#34D399' }}>{formatIDR(asset.bookValue)}</b></div>
        <div className="eam-mini"><span>Akumulasi penyusutan</span><b>{formatIDR(asset.accumulatedDepreciation)}</b></div>
        <div className="eam-mini"><span>Nilai sisa (salvage)</span><b>{formatIDR(asset.salvageValue)}</b></div>
        <div className="eam-mini"><span>Penyusutan / tahun</span><b>{formatIDR(asset.annualDepreciation)}</b></div>
        <div className="eam-mini"><span>Penyusutan / bulan</span><b>{formatIDR(Math.round(asset.annualDepreciation / 12))}</b></div>
        <div className="eam-mini"><span>Umur ekonomis</span><b>{asset.usefulLifeYears} tahun · {fmtSisaUmur(asset)}</b></div>
        <div className="eam-mini"><span>Tgl perolehan</span><b>{fmtTanggal(asset.acquisitionDate)}</b></div>
        <div className="eam-mini"><span>Garansi berakhir</span><b>{fmtTanggal(asset.warrantyExpiry)}</b></div>
      </div>

      <div style={{ marginBottom: '1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: 'var(--wr-txt-muted)', marginBottom: 4 }}>
          <span>Progres penyusutan</span><span>{asset.depreciationPct}% dari {formatIDR(dasar)} yang dapat disusutkan</span>
        </div>
        <div className="eam-prog" style={{ height: 8 }}>
          <span style={{ width: `${asset.depreciationPct}%`, background: asset.fullyDepreciated ? '#F87171' : '#FBBF24' }} />
        </div>
      </div>

      <div className="eam-lbl">Proyeksi nilai buku per tahun</div>
      <div style={{ height: 210, marginBottom: '1rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dataGrafik} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: W['--wr-txt-muted'] }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={14} />
            <YAxis tickFormatter={(v: number) => rupiahRingkas(v).replace('Rp ', '')} tick={{ fontSize: 11, fill: W['--wr-txt-muted'] }} axisLine={false} tickLine={false} width={56} />
            <Tooltip {...tooltipProps} formatter={(v: unknown) => formatIDR(Number(v) || 0)} cursor={{ stroke: W['--wr-cursor'] }} />
            <Line type="monotone" dataKey="Nilai Buku" stroke={W['--wr-out']} strokeWidth={2.6} dot={{ r: 2.5 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="eam-lbl">Jadwal penyusutan (garis lurus)</div>
      <div className="eam-scroll" style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--wr-line)', borderRadius: 12, marginBottom: '1.1rem' }}>
        <table className="eam-tbl" style={{ minWidth: 520 }}>
          <thead><tr><th>Tahun</th><th>Per tanggal</th><th>Beban penyusutan</th><th>Akumulasi</th><th>Nilai buku</th></tr></thead>
          <tbody>
            {jadwal.map((j) => (
              <tr key={j.tahun} style={j.berjalan ? { background: 'var(--wr-row-selected)' } : undefined}>
                <td style={{ fontWeight: 700 }}>
                  {j.tahun}{j.berjalan && <span style={{ marginLeft: 6 }}><Pil warna="#00D084" bg="rgba(0,208,132,.14)">Berjalan</Pil></span>}
                </td>
                <td style={{ color: j.lewat ? 'var(--wr-txt-muted)' : undefined }}>{fmtTanggal(j.tanggal)}</td>
                <td>{formatIDR(j.penyusutan)}</td>
                <td>{formatIDR(j.akumulasi)}</td>
                <td style={{ fontWeight: 700 }}>{formatIDR(j.nilaiBuku)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="eam-lbl">Riwayat & jadwal maintenance ({riwayat.length})</div>
      {riwayat.length === 0 ? (
        <div className="eam-mini" style={{ color: 'var(--wr-txt-muted)', fontSize: '.85rem' }}>Belum ada pekerjaan maintenance untuk aset ini.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {riwayat.map((w) => {
            const st = statusWo(w);
            const m = WO_META[st];
            const jt = infoJatuhTempo({ ...w, status: st });
            return (
              <div key={w.id} className="eam-mini" style={{ display: 'flex', flexWrap: 'wrap', gap: '.6rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--txt-primary)', fontSize: '.88rem' }}>{w.title}</div>
                  <div style={{ fontSize: '.74rem', color: 'var(--wr-txt-muted)' }}>{w.type} · {w.priority}{w.assignedTo ? ` · ${w.assignedTo}` : ''} · {fmtTanggal(w.dueDate)}</div>
                </div>
                <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '.74rem', color: jt.nada === 'telat' ? '#F87171' : 'var(--wr-txt-muted)' }}>{jt.teks}</span>
                  <Pil warna={m.color} bg={m.bg}>{st}</Pil>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {asset.notes && (
        <div style={{ marginTop: '1.1rem' }}>
          <div className="eam-lbl">Catatan</div>
          <div style={{ fontSize: '.88rem', color: 'var(--txt-secondary)', whiteSpace: 'pre-wrap' }}>{asset.notes}</div>
        </div>
      )}
    </ModalShell>
  );
};

/* ═══════════════════════════ Halaman utama ═══════════════════════════ */
export const AssetRegistryView: React.FC<{
  fixedAssets: FixedAsset[];
  workOrders: WorkOrder[];
  onSave: (patch: Partial<FixedAsset>) => void;
  onDelete: (id: string) => void;
  onSaveWorkOrder: (patch: Partial<WorkOrder>) => void;
  /** Sembunyikan judul halaman (dipakai saat disematkan di halaman Aset Tetap & Depresiasi). */
  tanpaHeader?: boolean;
  /** Filter "perlu perhatian" yang sudah terpasang saat dibuka (mis. dari tombol Tinjau di Ringkasan). */
  perhatianAwal?: Perhatian | null;
}> = ({ fixedAssets, workOrders, onSave, onDelete, onSaveWorkOrder, tanpaHeader, perhatianAwal }) => {
  useSitesRefresh();

  const [cari, setCari] = useState('');
  const [kategori, setKategori] = useState(SEMUA);
  const [site, setSite] = useState(SEMUA);
  const [status, setStatus] = useState<FixedAsset['status'] | typeof SEMUA>(SEMUA);
  const [perhatian, setPerhatian] = useState<Perhatian | null>(perhatianAwal ?? null);
  const [urutan, setUrutan] = useState<Urutan>('terbaru');
  const [halaman, setHalaman] = useState(1);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editAset, setEditAset] = useState<FixedAsset | null>(null);
  const [woOpen, setWoOpen] = useState(false);
  const [woAsetId, setWoAsetId] = useState<string | undefined>(undefined);

  // WO terbuka per aset (untuk badge & filter "WO terlambat")
  const woPerAset = useMemo(() => {
    const m: Record<string, { terbuka: number; telat: number }> = {};
    for (const w of workOrders) {
      const st = statusWo(w);
      if (!WO_TERBUKA(st)) continue;
      const e = (m[w.assetId] ??= { terbuka: 0, telat: 0 });
      e.terbuka += 1;
      if (st === 'Overdue') e.telat += 1;
    }
    return m;
  }, [workOrders]);

  const kena = (a: FixedAsset, p: Perhatian): boolean => {
    if (!aktifOperasional(a)) return false;
    if (p === 'garansi') return infoGaransi(a).status === 'segera';
    if (p === 'habis') return a.fullyDepreciated;
    return (woPerAset[a.id]?.telat ?? 0) > 0;
  };

  const kata = cari.trim().toLowerCase();
  // Semua filter selain status & perhatian → dipakai untuk hitungan chip
  const dasar = useMemo(() => fixedAssets.filter((a) =>
    (site === SEMUA || a.site === site)
    && (kategori === SEMUA || a.category === kategori)
    && (!kata
      || a.name.toLowerCase().includes(kata) || a.assetCode.toLowerCase().includes(kata)
      || (a.serialNumber ?? '').toLowerCase().includes(kata) || a.category.toLowerCase().includes(kata))
  ), [fixedAssets, site, kategori, kata]);

  const hitungStatus = useMemo(() => {
    const h: Record<string, number> = { [SEMUA]: dasar.length, Active: 0, 'Under Maintenance': 0, Retired: 0, Disposed: 0 };
    for (const a of dasar) h[a.status] += 1;
    return h;
  }, [dasar]);

  const hitungPerhatian = useMemo(() => ({
    garansi: dasar.filter((a) => kena(a, 'garansi')).length,
    habis: dasar.filter((a) => kena(a, 'habis')).length,
    telat: dasar.filter((a) => kena(a, 'telat')).length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [dasar, woPerAset]);

  const terfilter = useMemo(() => {
    const a = dasar.filter((x) => (status === SEMUA || x.status === status) && (!perhatian || kena(x, perhatian)));
    switch (urutan) {
      case 'nama': a.sort((x, y) => x.name.localeCompare(y.name, 'id')); break;
      case 'buku': a.sort((x, y) => y.bookValue - x.bookValue); break;
      case 'susut': a.sort((x, y) => y.depreciationPct - x.depreciationPct); break;
      case 'umur': a.sort((x, y) => sisaUmurTahun(x) - sisaUmurTahun(y)); break;
      case 'garansi': a.sort((x, y) => (infoGaransi(x).sisaHari ?? Infinity) - (infoGaransi(y).sisaHari ?? Infinity)); break;
      default: break;
    }
    return a;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dasar, status, perhatian, urutan, woPerAset]);

  useEffect(() => { setHalaman(1); }, [cari, kategori, site, status, perhatian, urutan]);

  // KPI mengikuti filter; aset Disposed tidak dihitung ke nilai (sudah dilepas)
  const kpi = useMemo(() => {
    const dihitung = terfilter.filter((a) => a.status !== 'Disposed');
    const perolehan = dihitung.reduce((t, a) => t + a.acquisitionCost, 0);
    const buku = dihitung.reduce((t, a) => t + a.bookValue, 0);
    return {
      jumlah: terfilter.length,
      aktif: terfilter.filter((a) => a.status === 'Active').length,
      maint: terfilter.filter((a) => a.status === 'Under Maintenance').length,
      perolehan, buku,
      akumulasi: dihitung.reduce((t, a) => t + a.accumulatedDepreciation, 0),
      tahunan: dihitung.filter((a) => !a.fullyDepreciated && a.status !== 'Retired').reduce((t, a) => t + a.annualDepreciation, 0),
      pctBuku: perolehan > 0 ? Math.round((buku / perolehan) * 100) : 0,
    };
  }, [terfilter]);

  const kategoriList = useMemo(() => Array.from(new Set(fixedAssets.map((a) => a.category))).sort((a, b) => a.localeCompare(b, 'id')), [fixedAssets]);
  const sites = getSites();
  const adaFilter = !!kata || kategori !== SEMUA || site !== SEMUA || status !== SEMUA || !!perhatian;
  const reset = () => { setCari(''); setKategori(SEMUA); setSite(SEMUA); setStatus(SEMUA); setPerhatian(null); };

  const detail = detailId ? fixedAssets.find((a) => a.id === detailId) ?? null : null;
  useEffect(() => { if (detailId && !detail) setDetailId(null); }, [detailId, detail]);

  const bukaForm = (a: FixedAsset | null) => { setEditAset(a); setFormOpen(true); };
  const bukaWo = (assetId?: string) => { setWoAsetId(assetId); setWoOpen(true); };

  const ekspor = () => unduhCsv(`aset-tetap-${hariIni()}.csv`, [
    ['Kode Aset', 'Nama', 'Kategori', 'Site', 'No. Seri', 'Tgl Perolehan', 'Nilai Perolehan', 'Nilai Sisa', 'Umur (th)', 'Akumulasi Penyusutan',
      'Nilai Buku', 'Penyusutan %', 'Sisa Umur', 'Garansi Berakhir', 'Status', 'WO Terbuka'],
    ...terfilter.map((a) => [
      a.assetCode, a.name, a.category, labelSiteDariKey(a.site), a.serialNumber, a.acquisitionDate, a.acquisitionCost, a.salvageValue,
      a.usefulLifeYears, a.accumulatedDepreciation, a.bookValue, a.depreciationPct, fmtSisaUmur(a), a.warrantyExpiry, a.status,
      woPerAset[a.id]?.terbuka ?? 0,
    ]),
  ]);

  const halamanData = potongHalaman(terfilter, halaman);

  return (
    <>
      <style>{WR_CSS}{EAM_CSS}</style>
      {!tanpaHeader && <PageHeader icon={Building2} title="Aset Tetap & Depresiasi" sub="Registrasi aset modal (mesin, tangki, kendaraan) beserta nilai buku, penyusutan, dan garansinya." />}

      <div className="eam-kpis">
        <KpiKartu ikon={Boxes} warna="#00D084" label="Jumlah Aset" nilai={angka(kpi.jumlah)} sub={`${kpi.aktif} aktif · ${kpi.maint} maintenance`} />
        <KpiKartu ikon={Wallet} warna="#60A5FA" label="Nilai Perolehan" nilai={rupiahRingkas(kpi.perolehan)} sub="tidak termasuk aset Disposed" />
        <KpiKartu ikon={ShieldCheck} warna="#34D399" label="Nilai Buku Saat Ini" nilai={rupiahRingkas(kpi.buku)} nilaiWarna="#34D399" sub={`${kpi.pctBuku}% dari nilai perolehan`} />
        <KpiKartu ikon={TrendingDown} warna="#F59E0B" label="Akumulasi Penyusutan" nilai={rupiahRingkas(kpi.akumulasi)} sub={`Beban ${rupiahRingkas(kpi.tahunan)} / tahun`} />
      </div>

      <div className="glass-panel" style={{ borderRadius: 20, padding: '1.1rem 1.25rem', marginBottom: '1rem' }}>
        <div className="eam-lbl">Perlu perhatian</div>
        <div className="eam-chips" role="group" aria-label="Filter perlu perhatian" style={{ marginBottom: '1rem' }}>
          <button type="button" className="eam-chip" aria-pressed={perhatian === 'garansi'} onClick={() => setPerhatian((p) => (p === 'garansi' ? null : 'garansi'))}>
            <ShieldAlert size={14} /> Garansi ≤ 90 hari <span className="eam-chip-n">{hitungPerhatian.garansi}</span>
          </button>
          <button type="button" className="eam-chip" aria-pressed={perhatian === 'habis'} onClick={() => setPerhatian((p) => (p === 'habis' ? null : 'habis'))}>
            <Hourglass size={14} /> Habis disusutkan, masih dipakai <span className="eam-chip-n">{hitungPerhatian.habis}</span>
          </button>
          <button type="button" className="eam-chip" aria-pressed={perhatian === 'telat'} onClick={() => setPerhatian((p) => (p === 'telat' ? null : 'telat'))}>
            <AlertTriangle size={14} /> Maintenance terlambat <span className="eam-chip-n">{hitungPerhatian.telat}</span>
          </button>
        </div>

        <div className="eam-bar">
          <div className="eam-search">
            <Search size={16} className="eam-ico" />
            <input type="text" className="wr-ctl" placeholder="Cari nama, kode, kategori, atau nomor seri…" aria-label="Cari aset"
              value={cari} onChange={(e) => setCari(e.target.value)} />
            {cari && <button type="button" className="eam-clear" aria-label="Hapus pencarian" onClick={() => setCari('')}><X size={14} /></button>}
          </div>
          <select className="wr-ctl eam-sel" aria-label="Filter site" value={site} onChange={(e) => setSite(e.target.value)}>
            <option value={SEMUA}>Semua site</option>
            {sites.map((s) => <option key={s.key} value={s.key}>{labelPenuh(s.label)}</option>)}
          </select>
          <select className="wr-ctl eam-sel" aria-label="Filter kategori" value={kategori} onChange={(e) => setKategori(e.target.value)}>
            <option value={SEMUA}>Semua kategori</option>
            {kategoriList.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', color: 'var(--wr-txt-muted)' }}>
            <ArrowUpDown size={15} />
            <select className="wr-ctl eam-sel" aria-label="Urutkan" value={urutan} onChange={(e) => setUrutan(e.target.value as Urutan)}>
              {URUTAN.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </label>
          <span style={{ flex: '1 1 0' }} />
          <button type="button" className="wr-btn eam-btn" onClick={ekspor} disabled={!terfilter.length} title="Unduh hasil yang sedang tampil sebagai CSV"><Download size={16} /> Export</button>
          <button type="button" className="wr-btn wr-btn--primary eam-btn" onClick={() => bukaForm(null)}><Plus size={16} /> Daftarkan Aset</button>
        </div>

        <div className="eam-chips" role="group" aria-label="Filter status" style={{ marginTop: '1rem' }}>
          <button type="button" className="eam-chip" aria-pressed={status === SEMUA} onClick={() => setStatus(SEMUA)}><Globe size={13} /> Semua <span className="eam-chip-n">{hitungStatus[SEMUA]}</span></button>
          {STATUS.map((s) => (
            <button key={s} type="button" className="eam-chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
              <span className="eam-dot" style={{ background: STATUS_META[s].color }} /> {STATUS_META[s].label} <span className="eam-chip-n">{hitungStatus[s]}</span>
            </button>
          ))}
          {adaFilter && <button type="button" className="eam-chip" onClick={reset} style={{ marginLeft: 'auto' }}><RotateCcw size={13} /> Reset filter</button>}
        </div>
      </div>

      <div className="glass-panel" style={{ borderRadius: 20, padding: '.75rem' }}>
        {terfilter.length === 0 ? (
          <div className="eam-empty">
            <Building2 size={36} style={{ marginBottom: '.75rem', opacity: .6 }} />
            <div style={{ fontWeight: 700, color: 'var(--txt-primary)', marginBottom: 4 }}>
              {fixedAssets.length === 0 ? 'Belum ada aset tetap terdaftar' : 'Tidak ada aset yang cocok'}
            </div>
            <div style={{ fontSize: '.85rem' }}>{fixedAssets.length === 0 ? 'Klik “Daftarkan Aset” untuk menambahkan aset pertama.' : 'Coba ubah kata kunci atau filter yang aktif.'}</div>
            {adaFilter && <button type="button" className="wr-btn eam-btn" style={{ marginTop: '1rem' }} onClick={reset}><RotateCcw size={14} /> Reset filter</button>}
          </div>
        ) : (
          <div className="eam-scroll">
            <table className="eam-tbl" style={{ minWidth: 980 }}>
              <thead>
                <tr><th>Aset</th><th>Site</th><th>Nilai buku</th><th>Penyusutan</th><th>Garansi</th><th>Status</th><th>Maintenance</th><th style={{ textAlign: 'right' }}>Aksi</th></tr>
              </thead>
              <tbody>
                {halamanData.map((a) => {
                  const m = STATUS_META[a.status];
                  const g = infoGaransi(a);
                  const wo = woPerAset[a.id];
                  return (
                    <tr key={a.id} className="eam-row" tabIndex={0} onClick={() => setDetailId(a.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setDetailId(a.id); }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                          <div className="eam-thumb">{a.imageUrl ? <img src={a.imageUrl} alt="" loading="lazy" /> : <Building2 size={18} color="#64748B" />}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: 'monospace', color: '#00D084', fontSize: '.72rem', fontWeight: 700 }}>{a.assetCode}</div>
                            <div style={{ color: 'var(--txt-primary)', fontWeight: 600 }}>{a.name}</div>
                            <div style={{ color: 'var(--wr-txt-muted)', fontSize: '.74rem' }}>{a.category}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{labelSiteDariKey(a.site)}</td>
                      <td>
                        <div style={{ color: '#34D399', fontWeight: 700 }}>{formatIDR(a.bookValue)}</div>
                        <div style={{ color: 'var(--wr-txt-muted)', fontSize: '.72rem' }}>dari {rupiahRingkas(a.acquisitionCost)}</div>
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                          <div className="eam-prog" style={{ flex: 1 }}><span style={{ width: `${a.depreciationPct}%`, background: a.fullyDepreciated ? '#F87171' : '#FBBF24' }} /></div>
                          <span style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--txt-tertiary)' }}>{a.depreciationPct}%</span>
                        </div>
                        <div style={{ color: a.fullyDepreciated ? '#F87171' : 'var(--wr-txt-muted)', fontSize: '.72rem', marginTop: 2 }}>{fmtSisaUmur(a)}</div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {g.status === 'tidak-ada' ? <span style={{ color: 'var(--wr-txt-muted)' }}>—</span>
                          : g.status === 'habis' ? <Pil warna="#94A3B8" bg="rgba(148,163,184,.16)">Berakhir</Pil>
                          : g.status === 'segera' ? <Pil warna="#FBBF24" bg="rgba(251,191,36,.14)">{g.sisaHari} hari lagi</Pil>
                          : <Pil warna="#34D399" bg="rgba(52,211,153,.12)">Aktif</Pil>}
                      </td>
                      <td><Pil warna={m.color} bg={m.bg}>{m.label}</Pil></td>
                      <td>
                        {wo ? <Pil warna={wo.telat ? '#F87171' : '#60A5FA'} bg={wo.telat ? 'rgba(248,113,113,.13)' : 'rgba(96,165,250,.12)'}>
                          <Wrench size={11} /> {wo.terbuka} terbuka{wo.telat ? ` · ${wo.telat} telat` : ''}</Pil>
                          : <span style={{ color: 'var(--wr-txt-muted)' }}>—</span>}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '.35rem', justifyContent: 'flex-end' }}>
                          <button type="button" className="eam-ib info" aria-label={`Detail ${a.name}`} title="Detail" onClick={() => setDetailId(a.id)}><Eye size={15} /></button>
                          <button type="button" className="eam-ib ok" aria-label={`Jadwalkan pekerjaan untuk ${a.name}`} title="Jadwalkan maintenance" onClick={() => bukaWo(a.id)}><CalendarClock size={15} /></button>
                          <button type="button" className="eam-ib" aria-label={`Edit ${a.name}`} title="Edit" onClick={() => bukaForm(a)}><Pencil size={15} /></button>
                          <button type="button" className="eam-ib bad" aria-label={`Hapus ${a.name}`} title="Hapus"
                            onClick={() => { if (confirm(`Hapus aset "${a.name}"?\n\nPekerjaan maintenance yang terkait ikut terhapus.`)) onDelete(a.id); }}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '0 .5rem .4rem' }}>
          <Pager halaman={halaman} total={terfilter.length} satuan="aset" onUbah={setHalaman} />
        </div>
      </div>

      {detail && (
        <AssetDetailModal
          asset={detail}
          workOrders={workOrders}
          onClose={() => setDetailId(null)}
          onEdit={() => bukaForm(detail)}
          onSchedule={() => bukaWo(detail.id)}
          onChangeStatus={(s) => onSave({ id: detail.id, status: s })}
        />
      )}
      <FixedAssetModal isOpen={formOpen} itemToEdit={editAset} onClose={() => setFormOpen(false)} onSave={onSave} />
      <WorkOrderModal isOpen={woOpen} fixedAssets={fixedAssets} workOrder={null} presetAssetId={woAsetId} onClose={() => setWoOpen(false)} onSave={onSaveWorkOrder} />
    </>
  );
};