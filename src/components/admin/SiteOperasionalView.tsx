// Halaman "Site Operasional" — pusat kendali tiap lokasi Reethau.
//
// Satu kartu per site yang merangkum, dari data spreadsheet yang sudah ada:
//  • kesehatan sinkronisasi (kapan terakhir tarik data, sumber terhubung atau belum)
//  • isi data: baris Barang Masuk / Keluar / Aset dan tanggal data terbaru
//  • indikator operasional: jadwal maintenance terlambat, part stok kritis, PR belum selesai, PICA terbuka
// Klik kartu untuk rincian + tombol ke menu terkait. Superadmin tetap bisa menambah/ubah/hapus site
// dan menampilkan QR code site.
import { useEffect, useMemo, useState } from 'react';
import {
  MapPin, Plus, Pencil, Trash2, QrCode, RefreshCw, Loader2, X, ExternalLink, CalendarClock, Package, FileText, ClipboardList,
  TrendingUp, TrendingDown, Boxes, AlertTriangle, Link2, Database, CheckCircle2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { getSites, addSite, updateSite, deleteSite, isDefaultSite, getSiteMeta, type SiteMeta } from '../../data/siteStore';
import type { AuthState, SparePart, SiteLocation } from '../../types';
import { labelPenuh } from './siteLabel';
import { NADA, WR_CSS } from './wrTema';
import type { Nada } from './wrTema';
import { PageHeader } from './AdminExtraViews';
import { SiteFormModal } from './SiteFormModal';
import { QRCodeModal } from './QRCodeModal';
import { KpiKartu, EAM_CSS } from './eamUi';
import { angka } from './eamHelpers';
import { SP_CSS, Chip } from './sparePartUi';
import { fmtTanggal, bangunItem, adalahSparePart } from './sparePartData';
import type { BarisSp } from './sparePartData';
import { useDataMaintenance, bangunJadwal, STANDAR_DEFAULT } from './maintenanceData';
import type { TujuanNav } from './JadwalMaintenance';

interface RingkasanData { site: string; direction: 'IN' | 'OUT' | 'ASET'; jumlah: number; tahunMin: number | null; tahunMax: number | null; tanpaTahun: number; terbaru: string | null }
interface SumberData { site: string; sheetId: string; tabs: string[]; autoSync: boolean; lastSyncAt: string | null; lastStatus: string }
interface OsSite { key: string; label: string; totals: { pending: number; released: number; total: number } }
interface PicaRingkas { status: string; targetDate: string | null }

type Kesehatan = 'Terbaru' | 'Perlu Sync' | 'Tertinggal' | 'Belum Terhubung';
const NADA_SEHAT: Record<Kesehatan, Nada> = { Terbaru: NADA.in, 'Perlu Sync': NADA.warn, Tertinggal: NADA.neg, 'Belum Terhubung': NADA.neutral };
const KET_SEHAT: Record<Kesehatan, string> = {
  Terbaru: 'Data ditarik dari spreadsheet dalam 6 jam terakhir',
  'Perlu Sync': 'Terakhir sinkron lebih dari 6 jam lalu',
  Tertinggal: 'Terakhir sinkron lebih dari 2 hari lalu — cek sumber spreadsheet atau klik Sync Sekarang di Laporan',
  'Belum Terhubung': 'Site ini belum punya sumber spreadsheet. Atur di Laporan → Sumber Sheet',
};
const NAMA_ARAH = { IN: 'Barang Masuk', OUT: 'Barang Keluar', ASET: 'Aset' } as const;

const golonganPica = (s: string): 'selesai' | 'overdue' | 'jalan' => {
  const x = s.toLowerCase();
  if (x.includes('close') || x.includes('selesai') || x.includes('done')) return 'selesai';
  if (x.includes('overdue') || x.includes('terlambat')) return 'overdue';
  return 'jalan';
};
const umurJam = (iso: string | null): number | null => (iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : null);
const teksUmur = (jam: number | null): string => (jam === null ? 'belum pernah' : jam < 1 ? 'baru saja' : jam < 24 ? `${Math.floor(jam)} jam lalu` : `${Math.floor(jam / 24)} hari lalu`);

const SO_CSS = `
.so-grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(min(360px,100%),1fr));margin-top:1rem}
.so-card{border-radius:18px;padding:1rem 1.1rem;display:flex;flex-direction:column;gap:.8rem;min-width:0;border:1px solid var(--wr-line);cursor:pointer;text-align:left;font:inherit;color:inherit;width:100%}
.so-card:hover{border-color:var(--wr-in-border)}
.so-card:focus-visible{outline:2px solid var(--wr-focus,#00D084);outline-offset:2px}
.so-head{display:flex;gap:.7rem;align-items:center}
.so-dot{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex-shrink:0}
.so-nama{margin:0;font-size:.98rem;font-weight:800;color:var(--txt-primary)}
.so-sub{font-size:.72rem;color:var(--wr-txt-muted);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.so-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem}
.so-stat{padding:.5rem .6rem;border-radius:11px;background:var(--wr-tab-bg);border:1px solid var(--wr-line)}
.so-stat small{display:block;font-size:.62rem;letter-spacing:.04em;text-transform:uppercase;color:var(--wr-txt-muted);white-space:nowrap}
.so-stat b{display:block;margin-top:.1rem;font-size:.95rem;color:var(--txt-primary);font-variant-numeric:tabular-nums}
.so-act{display:flex;gap:.35rem;margin-left:auto}
.so-ib{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;cursor:pointer;background:var(--wr-btn-bg);color:var(--txt-primary);border:1px solid var(--wr-field-border)}
.so-ib:hover{background:var(--wr-btn-bg-hover)}
.so-ib:focus-visible{outline:2px solid var(--wr-focus,#00D084);outline-offset:2px}
.so-perhatian{display:grid;grid-template-columns:auto 1fr auto;gap:.65rem;align-items:center;padding:.55rem .75rem;border-radius:12px;background:var(--wr-tab-bg);border:1px solid var(--wr-line);font-size:.78rem;color:var(--txt-primary)}
`;

interface Props {
  auth: AuthState;
  spareParts: SparePart[];
  onSitesChanged?: () => void;
  onNavigasi: (t: TujuanNav) => void;
}

export function SiteOperasionalView({ auth, spareParts, onSitesChanged, onNavigasi }: Props) {
  const superAdmin = auth.role === 'Super Admin';
  const siteTerkunci = !superAdmin && auth.assignedSite !== 'global';
  const { keluar, masuk, memuat: memuatRows, muatUlang: muatRows } = useDataMaintenance(auth);

  const [versi, setVersi] = useState(0);
  const sites = useMemo(() => getSites().filter((s) => !siteTerkunci || s.key === auth.assignedSite), [versi, siteTerkunci, auth.assignedSite]); // eslint-disable-line react-hooks/exhaustive-deps

  const [ringkasan, setRingkasan] = useState<RingkasanData[]>([]);
  const [sumber, setSumber] = useState<SumberData[]>([]);
  const [os, setOs] = useState<OsSite[]>([]);
  const [pica, setPica] = useState<Record<string, PicaRingkas[]>>({});
  const [memuat, setMemuat] = useState(true);
  const [tick, setTick] = useState(0);

  const [detail, setDetail] = useState<string | null>(null);
  const [qrSite, setQrSite] = useState<SiteLocation | null>(null);
  const [formBuka, setFormBuka] = useState(false);
  const [editSite, setEditSite] = useState<SiteMeta | null>(null);
  const [galat, setGalat] = useState('');

  const kunciSite = sites.map((s) => s.key).join(',');
  useEffect(() => {
    let batal = false;
    setMemuat(true);
    Promise.allSettled([
      api.get<RingkasanData[]>('/weekly-reports/overview'),
      api.get<SumberData[]>('/weekly-reports/sources'),
      api.get<{ data: { sites: OsSite[] } | null }>('/outstanding-pr'),
      ...sites.map((s) => api.get<PicaRingkas[]>(`/pica?site=${encodeURIComponent(s.key)}`)),
    ]).then((hasil) => {
      if (batal) return;
      const [a, b, c, ...p] = hasil;
      setRingkasan(a.status === 'fulfilled' ? a.value : []);
      setSumber(b.status === 'fulfilled' ? b.value : []);
      setOs(c.status === 'fulfilled' ? c.value.data?.sites ?? [] : []);
      setPica(Object.fromEntries(sites.map((s, i) => [s.key, p[i]?.status === 'fulfilled' ? (p[i] as PromiseFulfilledResult<PicaRingkas[]>).value : []])));
      setMemuat(false);
    });
    return () => { batal = true; };
  }, [kunciSite, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Indikator operasional per site ──
  const stat = useMemo(() => {
    const jadwal = bangunJadwal(keluar, { standar: STANDAR_DEFAULT });
    const spare = bangunItem([...masuk, ...keluar].filter((r) => adalahSparePart(r.kode)) as BarisSp[]);
    const hasil: Record<string, {
      baris: Record<'IN' | 'OUT' | 'ASET', number>; terbaru: string | null; tanpaTahun: number;
      terlambat: number; segera: number; partKritis: number;
      pr: { total: number; pending: number } | null; picaTerbuka: number; picaOverdue: number;
      sumber: SumberData | null; sehat: Kesehatan;
    }> = {};
    for (const s of sites) {
      const rg = ringkasan.filter((r) => r.site === s.key);
      const baris = { IN: 0, OUT: 0, ASET: 0 };
      let terbaru: string | null = null, tanpaTahun = 0;
      for (const r of rg) {
        baris[r.direction] = r.jumlah; tanpaTahun += r.tanpaTahun;
        if (r.terbaru && (!terbaru || r.terbaru > terbaru)) terbaru = r.terbaru;
      }
      const js = jadwal.filter((j) => j.site === s.key);
      const partKritis = spare.filter((it) => it.perSite.some((p) => p.site === s.key && p.laju > 0 && (p.saldo <= 0 || (p.cover ?? Infinity) < 4))).length;
      const o = os.find((x) => x.key === s.key) ?? null;
      const pc = pica[s.key] ?? [];
      const src = sumber.find((x) => x.site === s.key) ?? null;
      const jam = umurJam(src?.lastSyncAt ?? null);
      const sehat: Kesehatan = !src ? 'Belum Terhubung' : jam === null ? 'Perlu Sync' : jam <= 6 ? 'Terbaru' : jam <= 48 ? 'Perlu Sync' : 'Tertinggal';
      hasil[s.key] = {
        baris, terbaru, tanpaTahun,
        terlambat: js.filter((j) => j.status === 'Terlambat').length, segera: js.filter((j) => j.status === 'Segera').length, partKritis,
        pr: o ? { total: o.totals.total, pending: o.totals.pending } : null,
        picaTerbuka: pc.filter((x) => golonganPica(x.status) !== 'selesai').length, picaOverdue: pc.filter((x) => golonganPica(x.status) === 'overdue').length,
        sumber: src, sehat,
      };
    }
    return hasil;
  }, [sites, ringkasan, sumber, os, pica, keluar, masuk]);

  const total = useMemo(() => {
    const v = Object.values(stat);
    return {
      terhubung: v.filter((x) => x.sumber).length,
      tertinggal: v.filter((x) => x.sehat === 'Tertinggal' || x.sehat === 'Perlu Sync').length,
      terlambat: v.reduce((t, x) => t + x.terlambat, 0), partKritis: v.reduce((t, x) => t + x.partKritis, 0),
      pr: v.reduce((t, x) => t + (x.pr?.pending ?? 0), 0),
    };
  }, [stat]);

  const hapus = async (site: SiteMeta) => {
    const s = stat[site.key];
    const adaData = s && (s.baris.IN + s.baris.OUT + s.baris.ASET) > 0;
    if (adaData) { alert(`Tidak bisa menghapus ${labelPenuh(site.label)}: masih ada ${angka(s.baris.IN + s.baris.OUT + s.baris.ASET)} baris laporan di site ini. Pindahkan atau hapus datanya lebih dulu.`); return; }
    if (spareParts.some((p) => p.site === site.key)) { alert(`Tidak bisa menghapus ${labelPenuh(site.label)}: masih ada spare part terdaftar di site ini.`); return; }
    if (!confirm(`Hapus ${labelPenuh(site.label)}? Tindakan ini tidak bisa dibatalkan.`)) return;
    try { await deleteSite(site.key); setVersi((v) => v + 1); onSitesChanged?.(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Gagal menghapus site.'); }
  };

  const muatUlang = () => { setTick((t) => t + 1); muatRows(); };
  const siteDetail = detail ? sites.find((s) => s.key === detail) ?? null : null;

  return (
    <>
      <style>{WR_CSS}{EAM_CSS}{SP_CSS}{SO_CSS}</style>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <PageHeader icon={MapPin} title="Site Operasional" />
        <span style={{ display: 'inline-flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="sp2-btn" onClick={muatUlang} disabled={memuat || memuatRows}>{memuat || memuatRows ? <Loader2 size={14} className="sp2-spin" /> : <RefreshCw size={14} />} Muat Ulang</button>
          {superAdmin && <button type="button" className="sp2-btn utama" onClick={() => { setEditSite(null); setFormBuka(true); }}><Plus size={14} /> Tambah Site</button>}
        </span>
      </div>

      <div className="eam-kpis">
        <KpiKartu ikon={MapPin} warna="#60A5FA" label="Site" nilai={angka(sites.length)} sub={`${angka(total.terhubung)} terhubung ke spreadsheet`} />
        <KpiKartu ikon={Database} warna="#F59E0B" label="Perlu Sinkron" nilai={angka(total.tertinggal)} sub="data belum diperbarui > 6 jam" />
        <KpiKartu ikon={CalendarClock} warna="#F87171" label="Maintenance Terlambat" nilai={angka(total.terlambat)} sub="jadwal melewati jatuh tempo" onKlik={() => onNavigasi({ ke: 'jadwal' })} />
        <KpiKartu ikon={Package} warna="#A78BFA" label="Part Stok Kritis" nilai={angka(total.partKritis)} sub="cukup kurang dari 4 minggu" onKlik={() => onNavigasi({ ke: 'spare-part' })} />
        <KpiKartu ikon={FileText} warna="#34D399" label="PR Menunggu Approval" nilai={angka(total.pr)} sub="di semua site" onKlik={() => onNavigasi({ ke: 'laporan', mode: 'OS_PR' })} />
      </div>

      {sites.length === 0 && <div className="glass-panel sp2-panel" style={{ marginTop: '1rem' }}><div className="sp2-kosong">Belum ada site. {superAdmin ? 'Klik “Tambah Site” untuk membuat yang pertama.' : ''}</div></div>}

      <div className="so-grid">
        {sites.map((site) => {
          const s = stat[site.key];
          if (!s) return null;
          const warna = site.color || '#00D084';
          return (
            <div key={site.key} className="glass-panel so-card" role="button" tabIndex={0} onClick={() => setDetail(site.key)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail(site.key); } }} aria-label={`Rincian ${labelPenuh(site.label)}`}>
              <div className="so-head">
                <span className="so-dot" style={{ background: `${warna}26`, color: warna }}><MapPin size={20} aria-hidden="true" /></span>
                <div style={{ minWidth: 0 }}>
                  <h3 className="so-nama">{labelPenuh(site.label)}</h3>
                  <div className="so-sub" title={site.subtitle}>{site.subtitle}</div>
                </div>
                {superAdmin && (
                  <span className="so-act" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="so-ib" title={`Edit ${labelPenuh(site.label)}`} aria-label={`Edit ${labelPenuh(site.label)}`} onClick={() => { setEditSite(site); setFormBuka(true); }}><Pencil size={13} /></button>
                    <button type="button" className="so-ib" title="QR code site" aria-label={`QR code ${labelPenuh(site.label)}`} onClick={() => setQrSite(site.key)}><QrCode size={14} /></button>
                    {!isDefaultSite(site.key) && <button type="button" className="so-ib" title={`Hapus ${labelPenuh(site.label)}`} aria-label={`Hapus ${labelPenuh(site.label)}`} onClick={() => hapus(site)}><Trash2 size={13} /></button>}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip nada={NADA_SEHAT[s.sehat]} teks={s.sehat} title={KET_SEHAT[s.sehat]} />
                <span className="so-sub" style={{ marginTop: 0 }}>
                  {s.sumber ? `sinkron ${teksUmur(umurJam(s.sumber.lastSyncAt))}` : 'belum ada sumber'}{s.terbaru ? ` · data terbaru ${fmtTanggal(Date.parse(s.terbaru))}` : ''}
                </span>
              </div>

              <div className="so-stats">
                <div className="so-stat"><small>Barang Masuk</small><b>{angka(s.baris.IN)}</b></div>
                <div className="so-stat"><small>Barang Keluar</small><b>{angka(s.baris.OUT)}</b></div>
                <div className="so-stat"><small>Aset</small><b>{angka(s.baris.ASET)}</b></div>
                <div className="so-stat"><small>Maint. terlambat</small><b style={{ color: s.terlambat ? NADA.neg.teks : undefined }}>{angka(s.terlambat)}</b></div>
                <div className="so-stat"><small>Part kritis</small><b style={{ color: s.partKritis ? NADA.warn.teks : undefined }}>{angka(s.partKritis)}</b></div>
                <div className="so-stat"><small>PICA terbuka</small><b style={{ color: s.picaOverdue ? NADA.neg.teks : undefined }}>{angka(s.picaTerbuka)}</b></div>
              </div>
            </div>
          );
        })}
      </div>

      {siteDetail && stat[siteDetail.key] && (
        <DetailSite site={siteDetail} s={stat[siteDetail.key]} ringkasan={ringkasan.filter((r) => r.site === siteDetail.key)}
          onTutup={() => setDetail(null)} onNavigasi={(t) => { setDetail(null); onNavigasi(t); }} />
      )}

      {qrSite && (() => {
        const meta = getSiteMeta(qrSite);
        return (
          <QRCodeModal isOpen onClose={() => setQrSite(null)} title={`Site ${meta.label}`} subtitle={`REETHAU-SITE-${qrSite.toUpperCase()}`}
            value={`https://inventory.reethau.id/site/${qrSite}`} fileName={`reethau-site-${qrSite}-qr`}
            metaLines={[{ label: 'Deskripsi', value: meta.subtitle }]} />
        );
      })()}

      <SiteFormModal isOpen={formBuka} siteToEdit={editSite} onClose={() => setFormBuka(false)}
        onSave={async (data) => {
          try {
            if (editSite) await updateSite(editSite.key, data); else await addSite(data);
            setVersi((v) => v + 1); setFormBuka(false); setGalat(''); onSitesChanged?.();
          } catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menyimpan site.'); alert(e instanceof Error ? e.message : 'Gagal menyimpan site.'); }
        }} />
      {galat && <span className="sr-only" role="alert">{galat}</span>}
    </>
  );
}

// ── Rincian satu site ────────────────────────────────────────────────────
function DetailSite({ site, s, ringkasan, onTutup, onNavigasi }: {
  site: SiteMeta;
  s: { baris: Record<'IN' | 'OUT' | 'ASET', number>; terbaru: string | null; tanpaTahun: number; terlambat: number; segera: number; partKritis: number;
    pr: { total: number; pending: number } | null; picaTerbuka: number; picaOverdue: number; sumber: SumberData | null; sehat: Kesehatan };
  ringkasan: RingkasanData[]; onTutup: () => void; onNavigasi: (t: TujuanNav) => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onTutup(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onTutup]);

  const perhatian: { id: string; nada: Nada; teks: string; tujuan: TujuanNav }[] = [];
  if (s.sehat === 'Belum Terhubung') perhatian.push({ id: 'src', nada: NADA.info, teks: 'Site ini belum terhubung ke spreadsheet — data belum masuk.', tujuan: { ke: 'laporan', mode: 'IN' } });
  if (s.sehat === 'Tertinggal' || s.sehat === 'Perlu Sync') perhatian.push({ id: 'sync', nada: s.sehat === 'Tertinggal' ? NADA.neg : NADA.warn, teks: `Sinkronisasi terakhir ${teksUmur(umurJam(s.sumber?.lastSyncAt ?? null))}${s.sumber?.lastStatus && s.sumber.lastStatus !== 'OK' ? ` (${s.sumber.lastStatus})` : ''}.`, tujuan: { ke: 'laporan', mode: 'IN' } });
  if (s.tanpaTahun > 0) perhatian.push({ id: 'tahun', nada: NADA.warn, teks: `${angka(s.tanpaTahun)} baris tidak punya tahun yang terbaca, jadi tidak muncul di filter tahun mana pun.`, tujuan: { ke: 'laporan', mode: 'OUT' } });
  if (s.terlambat > 0) perhatian.push({ id: 'jadwal', nada: NADA.neg, teks: `${angka(s.terlambat)} jadwal maintenance sudah melewati jatuh tempo${s.segera ? `, ${angka(s.segera)} lagi segera jatuh tempo` : ''}.`, tujuan: { ke: 'jadwal' } });
  if (s.partKritis > 0) perhatian.push({ id: 'part', nada: NADA.warn, teks: `${angka(s.partKritis)} spare part stoknya cukup kurang dari 4 minggu pemakaian.`, tujuan: { ke: 'spare-part' } });
  if (s.pr && s.pr.pending > 0) perhatian.push({ id: 'pr', nada: NADA.info, teks: `${angka(s.pr.pending)} dari ${angka(s.pr.total)} PR masih menunggu approval.`, tujuan: { ke: 'laporan', mode: 'OS_PR' } });
  if (s.picaOverdue > 0) perhatian.push({ id: 'pica', nada: NADA.neg, teks: `${angka(s.picaOverdue)} item PICA terlambat dari ${angka(s.picaTerbuka)} yang masih terbuka.`, tujuan: { ke: 'laporan', mode: 'PICA' } });

  return (
    <div className="sp2-modal" onClick={onTutup} role="presentation">
      <div className="sp2-dlg" role="dialog" aria-modal="true" aria-label={`Rincian ${labelPenuh(site.label)}`} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}><Chip nada={NADA_SEHAT[s.sehat]} teks={s.sehat} title={KET_SEHAT[s.sehat]} /></div>
            <h2 style={{ margin: '.35rem 0 0', fontSize: '1.15rem', color: 'var(--txt-primary)' }}>{labelPenuh(site.label)}</h2>
            <div className="so-sub">{site.subtitle}</div>
          </div>
          <button type="button" className="sp2-btn" onClick={onTutup} aria-label="Tutup rincian" autoFocus><X size={15} /></button>
        </div>

        <h3 className="sp2-h3" style={{ margin: '1rem 0 .5rem' }}>Perlu Perhatian</h3>
        {perhatian.length === 0 ? (
          <div className="so-perhatian" style={{ gridTemplateColumns: 'auto 1fr' }}><CheckCircle2 size={16} color={NADA.in.teks} aria-hidden="true" /> Tidak ada hal yang perlu ditindaklanjuti di site ini.</div>
        ) : (
          <div style={{ display: 'grid', gap: '.45rem' }}>
            {perhatian.map((p) => (
              <div key={p.id} className="so-perhatian">
                <span style={{ color: p.nada.teks, display: 'grid' }}><AlertTriangle size={15} aria-hidden="true" /></span>
                <span>{p.teks}</span>
                <button type="button" className="sp2-btn" style={{ padding: '.3rem .6rem', fontSize: '.72rem' }} onClick={() => onNavigasi(p.tujuan)}>Buka</button>
              </div>
            ))}
          </div>
        )}

        <h3 className="sp2-h3" style={{ margin: '1rem 0 .5rem' }}>Sumber Spreadsheet</h3>
        {s.sumber ? (
          <div className="so-perhatian" style={{ gridTemplateColumns: '1fr', gap: '.35rem' }}>
            <a href={`https://docs.google.com/spreadsheets/d/${s.sumber.sheetId}/edit`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--wr-in-text)', fontWeight: 700, display: 'inline-flex', gap: '.35rem', alignItems: 'center', width: 'fit-content' }}>
              <Link2 size={14} aria-hidden="true" /> Buka spreadsheet <ExternalLink size={12} aria-hidden="true" />
            </a>
            <span>{angka(s.sumber.tabs.length)} tab · sinkron otomatis {s.sumber.autoSync ? 'aktif (tiap 5 menit)' : 'nonaktif'} · terakhir {teksUmur(umurJam(s.sumber.lastSyncAt))}{s.sumber.lastStatus ? ` · ${s.sumber.lastStatus}` : ''}</span>
            <span style={{ color: 'var(--wr-txt-muted)', fontSize: '.72rem' }}>{s.sumber.tabs.join(' · ')}</span>
          </div>
        ) : <div className="so-perhatian" style={{ gridTemplateColumns: '1fr' }}>Belum ada sumber. Atur di <b>Laporan → Barang Masuk → Sumber Sheet</b>, atau pakai “Hubungkan Semua Site”.</div>}

        <h3 className="sp2-h3" style={{ margin: '1rem 0 .5rem' }}>Isi Data</h3>
        {ringkasan.length === 0 ? <div className="sp2-kosong">Belum ada data tersimpan untuk site ini.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sp2-tbl" style={{ minWidth: 520 }}>
              <thead><tr><th>Jenis</th><th className="r">Baris</th><th>Rentang Tahun</th><th>Data Terbaru</th></tr></thead>
              <tbody>
                {ringkasan.map((r) => (
                  <tr key={r.direction}>
                    <td className="k">{NAMA_ARAH[r.direction]}</td><td className="r">{angka(r.jumlah)}</td>
                    <td>{r.tahunMin ? (r.tahunMin === r.tahunMax ? r.tahunMin : `${r.tahunMin}–${r.tahunMax}`) : '—'}</td>
                    <td>{r.terbaru ? fmtTanggal(Date.parse(r.terbaru)) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 className="sp2-h3" style={{ margin: '1rem 0 .5rem' }}>Buka di Menu Lain</h3>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="sp2-btn" onClick={() => onNavigasi({ ke: 'laporan', mode: 'IN' })}><TrendingUp size={14} /> Barang Masuk</button>
          <button type="button" className="sp2-btn" onClick={() => onNavigasi({ ke: 'laporan', mode: 'OUT' })}><TrendingDown size={14} /> Barang Keluar</button>
          <button type="button" className="sp2-btn" onClick={() => onNavigasi({ ke: 'jadwal' })}><CalendarClock size={14} /> Jadwal Maintenance</button>
          <button type="button" className="sp2-btn" onClick={() => onNavigasi({ ke: 'spare-part' })}><Package size={14} /> Spare Part</button>
          <button type="button" className="sp2-btn" onClick={() => onNavigasi({ ke: 'aset', tab: 'ASSET_MGMT' })}><Boxes size={14} /> Asset Management</button>
          <button type="button" className="sp2-btn" onClick={() => onNavigasi({ ke: 'laporan', mode: 'PICA' })}><ClipboardList size={14} /> PICA</button>
        </div>
        <p className="sp2-baca" style={{ marginTop: '.7rem' }}>Menu laporan terbuka pada site yang sedang dipilih di filter masing-masing; pilih {labelPenuh(site.label)} di sana.</p>
      </div>
    </div>
  );
}