// Halaman "Dashboard" — poin penting seluruh menu dalam satu layar.
//
// Sengaja TIDAK memuat tabel atau grafik panjang: tiap menu cukup diwakili satu kartu berisi
// beberapa angka kunci, satu kalimat temuan, dan tombol untuk membuka halaman detailnya. Di atas
// kartu ada daftar "Perlu Perhatian" yang sudah diurutkan dari yang paling mendesak, jadi orang
// tidak perlu membuka satu per satu untuk tahu apa yang harus ditindak lebih dulu.
//
// Sumber data (semuanya sudah ada, tidak ada endpoint baru) dan aturan hitungnya SAMA dengan menu
// aslinya supaya angka di dashboard cocok dengan halaman detail:
//   • Ringkasan Laporan → Barang Masuk/Keluar (tahun berjalan), /outstanding-pr, /min-stock
//   • Spare Part        → kode I-RDA / I-RCE dari Barang Masuk + Keluar (bangunItem)
//   • Transfer          → hitungRekomendasi() dengan parameter bawaan menu Transfer Antar Site
//   • Aset Tetap        → /weekly-reports?direction=ASET (klasifikasi Equipment / Building)
//   • Jadwal Maintenance→ bangunJadwal() dengan interval standar bawaan
//   • Organisasi        → site + status sinkron, anggota Tim Lapangan, PICA, jumlah akun
import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, FileText, Package, ArrowLeftRight, Building2, CalendarClock, MapPin, Users, UserCog,
  ArrowRight, RefreshCw, Loader2, CheckCircle2, AlertTriangle, ShieldAlert, Info, Gauge, ChevronDown,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../lib/api';
import { getSites } from '../../data/siteStore';
import type { AuthState } from '../../types';
import { NADA, WR_CSS, tooltipProps, useWrTema } from './wrTema';
import type { Nada } from './wrTema';
import { EAM_CSS } from './eamUi';
import { angka, rupiahRingkas } from './eamHelpers';
import { PageHeader } from './AdminExtraViews';
import { qty, namaSite, potong } from './sparePartUi';
import {
  bangunItem, hitungRekomendasi, adalahSparePart, normKode, PARAM_TRANSFER_DEFAULT,
} from './sparePartData';
import type { BarisSp, StatusSp } from './sparePartData';
import { useDataMaintenance, bangunJadwal, STANDAR_DEFAULT, NAMA_KEGIATAN } from './maintenanceData';
import { bangunAnggota } from './TimLapangan';
import { tambahKlasifikasi, ringkasKlasifikasi } from './asetKlasifikasi';
import type { KelasAset } from './asetKlasifikasi';
import type { TujuanNav } from './JadwalMaintenance';
import type { AdminView } from './Sidebar';

/** Tujuan perpindahan dari dashboard: empat tujuan bawaan Jadwal + Transfer + menu biasa. */
export type TujuanDash = TujuanNav | { ke: 'transfer' } | { ke: 'view'; view: AdminView };

// ── Tipe payload (subset yang dipakai) ───────────────────────────────────
interface OsData { grand: { pending: number; released: number; total: number } }
type Titik = [number, number | null, number | null, number | null];
interface MsData {
  target: number; weeks: { n: number; label: string; filled: boolean }[];
  groups: { category: string; rows: { location: string; v: (Titik | null)[] }[] }[];
}
interface BarisAm {
  id: string; site: string; namaBarang: string; jenis: string; merk: string; tipe: string;
  jumlah: number; alokasi: string; detailAlokasi: string; totalHarga: number; hargaEstimasi?: number;
}
interface SumberData { site: string; lastSyncAt: string | null }
interface PicaItem { id: string; site: string; no: string; problem: string; targetDate: string | null; pic: string; status: string; latestNote: string }

// ── Helper kecil ─────────────────────────────────────────────────────────
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const fmtP = (n: number, d = 1) => `${n.toLocaleString('id-ID', { maximumFractionDigits: d })}%`;
const jumlahNilai = (rows: { totalHarga: number }[]) => rows.reduce((t, r) => t + (Number(r.totalHarga) || 0), 0);
const tingkatSs = (p: number, target: number): 'baik' | 'waspada' | 'rendah' => (p >= target * 0.9 ? 'baik' : p >= target * 0.75 ? 'waspada' : 'rendah');
const golonganPica = (s: string): 'selesai' | 'overdue' | 'jalan' => {
  const x = s.toLowerCase();
  if (x.includes('close') || x.includes('selesai') || x.includes('done')) return 'selesai';
  if (x.includes('overdue') || x.includes('terlambat')) return 'overdue';
  return 'jalan';
};
const umurJam = (iso: string | null): number | null => (iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : null);
const teksUmur = (jam: number | null): string => (jam === null ? 'belum pernah' : jam < 1 ? 'baru saja' : jam < 24 ? `${Math.floor(jam)} jam lalu` : `${Math.floor(jam / 24)} hari lalu`);
const fmtRp = (v: unknown) => rp(Number(v) || 0);
const fmtPersen = (v: unknown) => fmtP(Number(v) || 0);

const NAMA_BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
interface BarisBln { bulan: number; totalHarga: number }
/** Nilai masuk & keluar per bulan, dari Januari sampai bulan terakhir yang punya data. */
function bulanan(masuk: BarisBln[], keluar: BarisBln[]): { label: string; Masuk: number; Keluar: number }[] {
  const m: number[] = Array(12).fill(0), k: number[] = Array(12).fill(0);
  let akhir = 0;
  const isi = (rows: BarisBln[], t: number[]) => {
    for (const r of rows) {
      const b = Number(r.bulan);
      if (b >= 1 && b <= 12) { t[b - 1] += Number(r.totalHarga) || 0; akhir = Math.max(akhir, b); }
    }
  };
  isi(masuk, m); isi(keluar, k);
  return Array.from({ length: akhir }, (_, i) => ({ label: NAMA_BLN[i], Masuk: m[i], Keluar: k[i] }));
}

interface Status { label: string; nada: Nada }
const ST = {
  baik: { label: 'Baik', nada: NADA.in } as Status,
  waspada: { label: 'Waspada', nada: NADA.warn } as Status,
  tindakan: { label: 'Perlu tindakan', nada: NADA.neg } as Status,
  kosong: { label: 'Belum ada data', nada: NADA.neutral } as Status,
};

type Tingkat = 'neg' | 'warn' | 'info';
interface Poin { id: string; tingkat: Tingkat; ikon: React.ElementType; teks: string; tujuan: TujuanDash; tombol: string }
const BOBOT: Record<Tingkat, number> = { neg: 0, warn: 1, info: 2 };
const NADA_POIN: Record<Tingkat, Nada> = { neg: NADA.neg, warn: NADA.warn, info: NADA.info };
const MAKS_POIN = 6;

const DB_CSS = `
.db-top{display:flex;flex-wrap:wrap;gap:1rem;justify-content:space-between;align-items:flex-start}
.db-act{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;font-size:.74rem;color:var(--wr-txt-muted)}
.db-btn{display:inline-flex;align-items:center;gap:.4rem;padding:.42rem .8rem;border-radius:10px;font:inherit;font-size:.76rem;font-weight:700;cursor:pointer;white-space:nowrap;
  background:var(--wr-btn-bg);color:var(--txt-primary);border:1px solid var(--wr-field-border)}
.db-btn:hover:not(:disabled){background:var(--wr-btn-bg-hover)}
.db-btn:disabled{opacity:.6;cursor:not-allowed}
.db-btn:focus-visible{outline:2px solid var(--wr-focus,#00D084);outline-offset:2px}
.db-sec{border-radius:18px;padding:1rem 1.1rem;margin-bottom:1rem}
.db-h{margin:0;font-size:.95rem;font-weight:800;color:var(--txt-primary);display:flex;align-items:center;gap:.5rem}
.db-hs{margin:.2rem 0 .75rem;font-size:.74rem;color:var(--wr-txt-muted)}
.db-att{display:grid;gap:.5rem}
.db-poin{display:grid;grid-template-columns:auto 1fr auto;gap:.7rem;align-items:center;padding:.6rem .8rem;border-radius:14px;background:var(--wr-tab-bg);border:1px solid var(--wr-line)}
.db-poin-i{width:30px;height:30px;border-radius:9px;display:grid;place-items:center}
.db-poin p{margin:0;font-size:.82rem;line-height:1.45;color:var(--txt-primary)}
.db-ok{display:flex;align-items:center;gap:.6rem;font-size:.84rem;color:var(--txt-primary);padding:.4rem 0}
.db-grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(min(360px,100%),1fr));margin-bottom:1rem}
.db-kartu{border-radius:18px;padding:1rem 1.1rem;display:flex;flex-direction:column;gap:.8rem;min-width:0}
.db-kh{display:flex;gap:.7rem;align-items:center}
.db-ikon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;flex-shrink:0}
.db-judul{margin:0;font-size:.92rem;font-weight:800;color:var(--txt-primary)}
.db-sub{font-size:.72rem;color:var(--wr-txt-muted);margin-top:1px}
.db-pill{margin-left:auto;font-size:.68rem;font-weight:800;padding:.22rem .6rem;border-radius:999px;white-space:nowrap}
.db-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem}
.db-stat{padding:.55rem .7rem;border-radius:12px;background:var(--wr-tab-bg);border:1px solid var(--wr-line);min-width:0}
.db-stat small{display:block;font-size:.64rem;letter-spacing:.04em;text-transform:uppercase;color:var(--wr-txt-muted)}
.db-stat b{display:block;margin-top:.1rem;font-size:1.15rem;font-weight:800;color:var(--txt-primary);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.db-stat span{display:block;font-size:.68rem;color:var(--wr-txt-muted);margin-top:1px}
.db-cat{margin:0;font-size:.78rem;line-height:1.5;color:var(--txt-secondary)}
.db-kosong{display:grid;place-items:center;min-height:120px;text-align:center;font-size:.78rem;color:var(--wr-txt-muted)}
.db-buka{margin-top:auto;align-self:flex-start}
.db-org{display:grid;gap:.5rem}
.db-org-row{display:grid;grid-template-columns:auto 1fr auto;gap:.7rem;align-items:center;padding:.6rem .8rem;border-radius:12px;background:var(--wr-tab-bg);border:1px solid var(--wr-line)}
.db-org-row b{display:block;font-size:.84rem;color:var(--txt-primary)}
.db-org-row span{display:block;font-size:.74rem;color:var(--wr-txt-muted);margin-top:1px}
.db-note{display:flex;gap:.5rem;align-items:flex-start;font-size:.72rem;line-height:1.5;color:var(--wr-txt-muted);margin:0}
.db-strip{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-bottom:1rem}
.db-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.38rem .8rem;border-radius:999px;font-size:.76rem;font-weight:700}
.db-charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));gap:.6rem}
.db-fig{margin:0;min-width:0;padding:.5rem .6rem .5rem;border-radius:12px;background:var(--wr-tab-bg);border:1px solid var(--wr-line)}
.db-fig figcaption{font-size:.64rem;letter-spacing:.04em;text-transform:uppercase;color:var(--wr-txt-muted);margin-bottom:.3rem}
.db-leg{list-style:none;margin:.4rem 0 0;padding:0;display:flex;flex-wrap:wrap;gap:.2rem .85rem;font-size:.68rem;color:var(--wr-txt-muted)}
.db-leg li{display:inline-flex;align-items:center;gap:.3rem}
.db-leg i{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.db-leg b{color:var(--txt-primary);font-variant-numeric:tabular-nums}
.db-komp{display:flex;height:12px;border-radius:99px;overflow:hidden;gap:2px;background:var(--wr-line);margin-top:.15rem}
.db-komp span{min-width:3px}
@keyframes db-spin{to{transform:rotate(360deg)}}
.db-spin{animation:db-spin .9s linear infinite}
@media (prefers-reduced-motion:reduce){.db-spin{animation:none}}
@media (max-width:520px){.db-poin,.db-org-row{grid-template-columns:auto 1fr}.db-poin .db-btn,.db-org-row .db-btn{grid-column:1 / -1;justify-content:center}}
`;

// ── Potongan UI ──────────────────────────────────────────────────────────
interface StatProps { label: string; nilai: string; sub?: string; warna?: string }
const Stat = ({ label, nilai, sub, warna }: StatProps) => (
  <div className="db-stat"><small>{label}</small><b style={warna ? { color: warna } : undefined}>{nilai}</b>{sub && <span>{sub}</span>}</div>
);

function KartuMenu({ ikon: Ikon, nada, judul, sub, status, memuat, stats, grafik, temuan, tombol, onBuka }: {
  ikon: React.ElementType; nada: Nada; judul: string; sub: string; status: Status; memuat: boolean;
  /** null = belum ada data untuk bagian ini. */
  stats: StatProps[] | null; /** Grafik kecil di bawah angka (opsional). */ grafik?: React.ReactNode; temuan?: string | null; tombol: string; onBuka: () => void;
}) {
  const tampilStatus = memuat && !stats ? { label: 'Memuat…', nada: NADA.neutral } : status;
  return (
    <section className="glass-panel db-kartu" aria-label={judul}>
      <header className="db-kh">
        <span className="db-ikon" style={{ background: nada.bg, color: nada.teks, border: `1px solid ${nada.garis}` }}><Ikon size={18} aria-hidden="true" /></span>
        <div style={{ minWidth: 0 }}>
          <h3 className="db-judul">{judul}</h3>
          <div className="db-sub">{sub}</div>
        </div>
        <span className="db-pill" style={{ background: tampilStatus.nada.bg, color: tampilStatus.nada.teks, border: `1px solid ${tampilStatus.nada.garis}` }}>{tampilStatus.label}</span>
      </header>
      {stats ? (
        <>
          <div className="db-stats">{stats.map((s) => <Stat key={s.label} {...s} />)}</div>
          {grafik && <div className="db-charts">{grafik}</div>}
          {temuan && <p className="db-cat">{temuan}</p>}
        </>
      ) : (
        <div className="db-kosong">{memuat ? 'Memuat data…' : 'Belum ada data. Sinkronkan sumbernya di menu terkait.'}</div>
      )}
      <button type="button" className="db-btn db-buka" onClick={onBuka}>{tombol} <ArrowRight size={13} aria-hidden="true" /></button>
    </section>
  );
}

// ── Grafik kecil ─────────────────────────────────────────────────────────
interface SeriMini { kunci: string; nama: string; warna: string }

/** Grafik garis/batang mini: tanpa sumbu Y (angka lewat tooltip), cukup untuk melihat arah dan perbandingan. */
function MiniGrafik({ jenis, judul, data, seri, fmt, ringkas }: {
  jenis: 'garis' | 'batang'; judul: string; data: Record<string, string | number>[]; seri: SeriMini[];
  fmt: (v: unknown) => string; ringkas: string;
}) {
  const { W } = useWrTema();
  const sumbu = { fontSize: 10, fill: W['--wr-txt-muted'] };
  const margin = { top: 6, right: 6, left: 6, bottom: 0 };
  const cukup = data.length >= (jenis === 'garis' ? 2 : 1);
  return (
    <figure className="db-fig">
      <figcaption>{judul}</figcaption>
      <div style={{ height: 96 }} role="img" aria-label={ringkas}>
        {!cukup ? <div className="db-kosong" style={{ minHeight: 96 }}>Data belum cukup</div> : (
          <ResponsiveContainer width="100%" height="100%">
            {jenis === 'garis' ? (
              <LineChart data={data} margin={margin}>
                <XAxis dataKey="label" tick={sumbu} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} height={16} />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip {...tooltipProps} formatter={fmt} cursor={{ stroke: W['--wr-cursor'] }} />
                {seri.map((x) => <Line key={x.kunci} type="monotone" dataKey={x.kunci} name={x.nama} stroke={x.warna} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />)}
              </LineChart>
            ) : (
              <BarChart data={data} margin={margin}>
                <XAxis dataKey="label" tick={sumbu} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} height={16} />
                <YAxis hide />
                <Tooltip {...tooltipProps} formatter={fmt} cursor={{ fill: W['--wr-cursor-fill'] }} />
                {seri.map((x) => <Bar key={x.kunci} dataKey={x.kunci} name={x.nama} fill={x.warna} radius={[3, 3, 0, 0]} />)}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
      <ul className="db-leg">{seri.map((x) => <li key={x.kunci}><i style={{ background: x.warna }} />{x.nama}</li>)}</ul>
    </figure>
  );
}

/** Bilah komposisi satu baris (bagian dari keseluruhan) + legenda berangka, jadi tidak hanya bergantung pada warna. */
function Komposisi({ judul, bagian, fmt = angka }: { judul: string; bagian: { label: string; nilai: number; warna: string }[]; fmt?: (n: number) => string }) {
  const total = bagian.reduce((t, b) => t + b.nilai, 0);
  const ringkas = `${judul}: ${bagian.map((b) => `${b.label} ${fmt(b.nilai)}`).join(', ')}`;
  return (
    <figure className="db-fig">
      <figcaption>{judul}</figcaption>
      <div className="db-komp" role="img" aria-label={ringkas}>
        {total > 0 && bagian.filter((b) => b.nilai > 0).map((b) => <span key={b.label} title={`${b.label}: ${fmt(b.nilai)}`} style={{ flex: b.nilai, background: b.warna }} />)}
      </div>
      <ul className="db-leg">{bagian.map((b) => <li key={b.label}><i style={{ background: b.warna }} />{b.label} <b>{fmt(b.nilai)}</b></li>)}</ul>
    </figure>
  );
}

// ── Komponen utama ───────────────────────────────────────────────────────
interface Props {
  auth: AuthState;
  /** Jumlah akun terdaftar — hanya diberikan untuk Super Admin. */
  jumlahPengguna?: number;
  onNavigasi: (t: TujuanDash) => void;
}

export function DashboardRingkas({ auth, jumlahPengguna, onNavigasi }: Props) {
  const tahun = new Date().getFullYear();
  const { W } = useWrTema();
  const siteTerkunci = auth.role !== 'Super Admin' && auth.assignedSite !== 'global';
  const siteAm = siteTerkunci ? auth.assignedSite : 'global';
  const sites = useMemo(() => getSites().filter((s) => !siteTerkunci || s.key === auth.assignedSite), [siteTerkunci, auth.assignedSite]);
  const kunciSite = sites.map((s) => s.key).join(',');

  // Barang Masuk + Keluar semua tahun (dipakai bersama oleh laporan, spare part, transfer, jadwal, tim).
  const { keluar, masuk, memuat: memuatRows, galat, muatUlang } = useDataMaintenance(auth);

  const [os, setOs] = useState<OsData | null>(null);
  const [ms, setMs] = useState<MsData | null>(null);
  const [am, setAm] = useState<BarisAm[]>([]);
  const [sumber, setSumber] = useState<SumberData[]>([]);
  const [pica, setPica] = useState<PicaItem[]>([]);
  const [gagal, setGagal] = useState<string[]>([]);
  const [memuatExtra, setMemuatExtra] = useState(true);
  const [tick, setTick] = useState(0);
  const [diperbarui, setDiperbarui] = useState<Date | null>(null);
  const [semuaPoin, setSemuaPoin] = useState(false);

  useEffect(() => {
    let batal = false;
    setMemuatExtra(true);
    (async () => {
      const [utama, perSite] = await Promise.all([
        Promise.allSettled([
          api.get<{ data: OsData | null }>('/outstanding-pr'),
          api.get<{ data: MsData | null }>('/min-stock'),
          api.get<BarisAm[]>(`/weekly-reports?${new URLSearchParams({ site: siteAm, direction: 'ASET' })}`),
          api.get<SumberData[]>('/weekly-reports/sources'),
        ]),
        Promise.allSettled(sites.map((s) => api.get<PicaItem[]>(`/pica?site=${encodeURIComponent(s.key)}`))),
      ]);
      if (batal) return;
      const [a, b, c, d] = utama;
      const g: string[] = [];
      if (a.status === 'fulfilled') setOs(a.value.data ?? null); else { setOs(null); g.push('Outstanding PR'); }
      if (b.status === 'fulfilled') setMs(b.value.data ?? null); else { setMs(null); g.push('Safety Stock'); }
      if (c.status === 'fulfilled') setAm(c.value); else { setAm([]); g.push('Aset Tetap'); }
      if (d.status === 'fulfilled') setSumber(d.value); else { setSumber([]); g.push('Status sinkron site'); }
      if (perSite.length && perSite.every((x) => x.status === 'rejected')) g.push('PICA');
      setPica(perSite.flatMap((x, i) => (x.status === 'fulfilled' ? x.value.map((it) => ({ ...it, site: it.site || sites[i].key })) : [])));
      setGagal(g);
      setDiperbarui(new Date());
      setMemuatExtra(false);
    })();
    return () => { batal = true; };
  }, [siteAm, kunciSite, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const memuat = memuatRows || memuatExtra;
  const muatSemua = () => { muatUlang(); setTick((t) => t + 1); };

  // ── 1. Ringkasan Laporan (tahun berjalan) ──
  const lap = useMemo(() => {
    const mt = masuk.filter((r) => r.tahun === tahun);
    const kt = keluar.filter((r) => r.tahun === tahun);
    return { masuk: jumlahNilai(mt), keluar: jumlahNilai(kt), baris: mt.length + kt.length, bulanan: bulanan(mt, kt) };
  }, [masuk, keluar, tahun]);

  const pr = useMemo(() => {
    if (!os) return null;
    const { total, pending, released } = os.grand;
    return { total, pending, released, persenPending: total > 0 ? (pending / total) * 100 : 0 };
  }, [os]);

  // Sama dengan kartu Safety Stock di Ringkasan Laporan: pencapaian pada minggu terakhir yang punya data.
  const ss = useMemo(() => {
    if (!ms) return null;
    const seri = Array.from({ length: ms.weeks.length }, (_, i) => {
      let min = 0, real = 0, ada = false;
      for (const g of ms.groups) for (const r of g.rows) { const t = r.v[i]; if (t) { min += t[0]; real += t[1] ?? 0; ada = true; } }
      return ada && min > 0 ? { label: ms.weeks[i].label, pct: (real / min) * 100, i } : null;
    }).filter((x): x is { label: string; pct: number; i: number } => x !== null);
    if (!seri.length) return null;
    const akhir = seri[seri.length - 1];
    const lok = new Map<string, { min: number; real: number }>();
    for (const g of ms.groups) for (const r of g.rows) {
      const t = r.v[akhir.i]; if (!t) continue;
      const c = lok.get(r.location) ?? { min: 0, real: 0 };
      c.min += t[0]; c.real += t[1] ?? 0; lok.set(r.location, c);
    }
    const daftar = [...lok.entries()].filter(([, v]) => v.min > 0).map(([nama, v]) => ({ nama, pct: (v.real / v.min) * 100 })).sort((x, y) => x.pct - y.pct);
    const target = ms.target || 100;
    const tren = seri.map((x) => ({ label: x.label, Pencapaian: Math.round(x.pct * 10) / 10 }));
    return { tren, pct: akhir.pct, label: akhir.label, target, tingkat: tingkatSs(akhir.pct, target), terendah: daftar[0], dibawahTarget: daftar.filter((d) => d.pct < target * 0.9).length };
  }, [ms]);

  // ── 2. Spare Part (kode I-RDA / I-RCE, sama dengan menu Spare Part) ──
  const sp = useMemo(() => {
    const rows = [...masuk, ...keluar].filter((r) => adalahSparePart(r.kode)) as BarisSp[];
    const items = bangunItem(rows);
    const hitung: Record<StatusSp, number> = { Aman: 0, Waspada: 0, Kritis: 0, 'Tidak Bergerak': 0, 'Cek Stok': 0 };
    for (const it of items) hitung[it.status] += 1;
    const th = rows.filter((r) => r.tahun === tahun);
    const per = new Map<string, { nama: string; nilai: number }>();
    for (const r of th) if (r.direction === 'OUT') {
      const k = normKode(r.kode);
      const c = per.get(k) ?? { nama: r.namaBarang || k, nilai: 0 };
      c.nilai += Number(r.totalHarga) || 0; per.set(k, c);
    }
    const thMasuk = th.filter((r) => r.direction === 'IN'), thKeluar = th.filter((r) => r.direction === 'OUT');
    return {
      items, hitung, bulanan: bulanan(thMasuk, thKeluar),
      nilaiMasuk: jumlahNilai(thMasuk),
      nilaiKeluar: jumlahNilai(thKeluar),
      top: [...per.values()].sort((x, y) => y.nilai - x.nilai)[0],
    };
  }, [masuk, keluar, tahun]);

  // ── 3. Transfer antar site ──
  const tr = useMemo(() => {
    const h = hitungRekomendasi(sp.items, PARAM_TRANSFER_DEFAULT);
    return {
      jumlah: h.rekomendasi.length,
      urgensi: { Tinggi: h.rekomendasi.filter((r) => r.urgensi === 'Tinggi').length, Sedang: h.rekomendasi.filter((r) => r.urgensi === 'Sedang').length, Rendah: h.rekomendasi.filter((r) => r.urgensi === 'Rendah').length },
      mendesak: h.rekomendasi.filter((r) => r.urgensi === 'Tinggi').length,
      nilai: h.rekomendasi.reduce((t, r) => t + r.nilai, 0),
      tanpaDonor: h.belumTerpenuhi.length,
      teratas: h.rekomendasi[0],
    };
  }, [sp.items]);

  // ── 4. Aset tetap ──
  const aset = useMemo(() => {
    const baris = tambahKlasifikasi(am);
    const nilai = am.reduce((t, r) => t + (Number(r.totalHarga) || 0), 0) + am.reduce((t, r) => t + (r.totalHarga ? 0 : r.hargaEstimasi ?? 0), 0);
    const klas = ringkasKlasifikasi(baris);
    const nilaiKelas = (k: KelasAset) => klas.find((x) => x.kelas === k)?.nilai ?? 0;
    return {
      jumlah: am.length, unit: am.reduce((t, r) => t + (Number(r.jumlah) || 0), 0), nilai,
      equipment: nilaiKelas('Equipment'), building: nilaiKelas('Building'), belumKlasNilai: nilaiKelas('Belum Terklasifikasi'),
      tanpaHarga: am.filter((r) => !r.totalHarga && !r.hargaEstimasi).length,
      belumKlas: baris.filter((r) => r.kelas === 'Belum Terklasifikasi').length,
    };
  }, [am]);

  // ── 5. Jadwal maintenance ──
  const jd = useMemo(() => {
    const j = bangunJadwal(keluar, { standar: STANDAR_DEFAULT });
    const terlambat = j.filter((x) => x.status === 'Terlambat').sort((x, y) => x.sisaHari - y.sisaHari);
    return {
      total: j.length, terlambat: terlambat.length, segera: j.filter((x) => x.status === 'Segera').length,
      terjadwal: j.filter((x) => x.status === 'Terjadwal').length, cekData: j.filter((x) => x.status === 'Cek Data').length,
      biaya12: j.reduce((t, x) => t + x.biaya12Bln, 0), terlama: terlambat[0],
    };
  }, [keluar]);

  // ── 6. Organisasi ──
  const org = useMemo(() => {
    const picaBuka = new Set(pica.filter((p) => golonganPica(p.status) !== 'selesai').map((p) => p.id)).size;
    const picaTelat = new Set(pica.filter((p) => golonganPica(p.status) === 'overdue').map((p) => p.id)).size;
    const terhubung = sites.filter((s) => sumber.some((x) => x.site === s.key)).length;
    const perluSync = sites.filter((s) => {
      const src = sumber.find((x) => x.site === s.key);
      if (!src) return false;
      const jam = umurJam(src.lastSyncAt);
      return jam === null || jam > 6;
    }).length;
    return { site: sites.length, terhubung, perluSync, anggota: bangunAnggota(keluar, pica).length, picaBuka, picaTelat };
  }, [sites, sumber, pica, keluar]);

  // ── Perlu Perhatian: diurutkan dari yang paling mendesak ──
  const poin = useMemo(() => {
    const p: Poin[] = [];
    if (jd.terlambat > 0) p.push({ id: 'jadwal-telat', tingkat: 'neg', ikon: CalendarClock, tujuan: { ke: 'jadwal' }, tombol: 'Jadwal',
      teks: `${angka(jd.terlambat)} jadwal maintenance sudah lewat jatuh tempo${jd.terlama ? `; terlama ${potong(jd.terlama.peralatan, 40)} (${NAMA_KEGIATAN[jd.terlama.kegiatan]}, ${angka(Math.abs(jd.terlama.sisaHari))} hari)` : ''}.` });
    if (sp.hitung.Kritis > 0) p.push({ id: 'part-kritis', tingkat: 'neg', ikon: Package, tujuan: { ke: 'spare-part' }, tombol: 'Spare Part',
      teks: `${angka(sp.hitung.Kritis)} spare part stoknya hanya cukup kurang dari 4 minggu pemakaian.` });
    if (ss && ss.tingkat !== 'baik') p.push({ id: 'safety', tingkat: ss.tingkat === 'rendah' ? 'neg' : 'warn', ikon: Gauge, tujuan: { ke: 'laporan', mode: 'MIN_STOCK' }, tombol: 'Safety Stock',
      teks: `Pencapaian safety stock ${fmtP(ss.pct)} dari target ${ss.target}%; ${angka(ss.dibawahTarget)} lokasi di bawah ambang${ss.terendah ? `, terendah ${ss.terendah.nama} (${fmtP(ss.terendah.pct)})` : ''}.` });
    if (tr.mendesak > 0) p.push({ id: 'transfer', tingkat: 'warn', ikon: ArrowLeftRight, tujuan: { ke: 'transfer' }, tombol: 'Transfer',
      teks: `${angka(tr.mendesak)} rekomendasi transfer antar site mendesak (stok penerima habis atau kurang dari 2 minggu).` });
    if (tr.tanpaDonor > 0) p.push({ id: 'tanpa-donor', tingkat: 'warn', ikon: ArrowLeftRight, tujuan: { ke: 'transfer' }, tombol: 'Transfer',
      teks: `${angka(tr.tanpaDonor)} kebutuhan part belum punya site donor — perlu pengadaan.` });
    if (jd.segera > 0) p.push({ id: 'jadwal-segera', tingkat: 'warn', ikon: CalendarClock, tujuan: { ke: 'jadwal' }, tombol: 'Jadwal',
      teks: `${angka(jd.segera)} jadwal maintenance jatuh tempo dalam 14 hari ke depan.` });
    if (pr && pr.pending > 0) p.push({ id: 'pr', tingkat: pr.persenPending >= 50 ? 'warn' : 'info', ikon: FileText, tujuan: { ke: 'laporan', mode: 'OS_PR' }, tombol: 'Outstanding PR',
      teks: `${angka(pr.pending)} PR menunggu approval (${fmtP(pr.persenPending, 0)} dari ${angka(pr.total)} PR yang belum selesai).` });
    if (org.picaTelat > 0) p.push({ id: 'pica', tingkat: 'warn', ikon: ShieldAlert, tujuan: { ke: 'laporan', mode: 'PICA' }, tombol: 'PICA',
      teks: `${angka(org.picaTelat)} isu PICA sudah melewati target penyelesaian.` });
    if (org.perluSync > 0) p.push({ id: 'sync', tingkat: 'warn', ikon: MapPin, tujuan: { ke: 'view', view: 'branches' }, tombol: 'Site',
      teks: `${angka(org.perluSync)} site belum disinkron lebih dari 6 jam — data laporannya bisa tertinggal.` });
    if (aset.tanpaHarga > 0) p.push({ id: 'aset-harga', tingkat: 'info', ikon: Building2, tujuan: { ke: 'aset', tab: 'ASSET_MGMT' }, tombol: 'Asset Management',
      teks: `${angka(aset.tanpaHarga)} aset belum punya harga, sehingga total nilai aset bisa lebih rendah dari kenyataan.` });
    return p.sort((a, b) => BOBOT[a.tingkat] - BOBOT[b.tingkat]);
  }, [jd, sp.hitung, ss, tr, pr, org, aset.tanpaHarga]);
  const poinTampil = semuaPoin ? poin : poin.slice(0, MAKS_POIN);
  const jmlPoin: Record<Tingkat, number> = { neg: 0, warn: 0, info: 0 };
  for (const x of poin) jmlPoin[x.tingkat] += 1;
  const keDaftar = () => document.getElementById('db-perhatian')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  // Data dashboard berasal dari spreadsheet: tampilkan kapan terakhir ditarik supaya angkanya bisa dipercaya.
  const sinkronTerakhir = sumber.reduce<string | null>((a, x) => (x.lastSyncAt && (!a || x.lastSyncAt > a) ? x.lastSyncAt : a), null);

  // ── Status tiap kartu ──
  const stLap: Status = !pr && !ss && lap.baris === 0 ? ST.kosong
    : ss?.tingkat === 'rendah' ? ST.tindakan
      : ss?.tingkat === 'waspada' || (pr && pr.persenPending >= 50) ? ST.waspada : ST.baik;
  const stSp: Status = sp.items.length === 0 ? ST.kosong : sp.hitung.Kritis > 0 ? ST.tindakan : sp.hitung.Waspada > 0 ? ST.waspada : ST.baik;
  const stTr: Status = sp.items.length === 0 ? ST.kosong : tr.mendesak > 0 ? ST.tindakan : tr.jumlah > 0 || tr.tanpaDonor > 0 ? ST.waspada : ST.baik;
  const stAset: Status = aset.jumlah === 0 ? ST.kosong : aset.tanpaHarga > 0 || aset.belumKlas > 0 ? ST.waspada : ST.baik;
  const stJd: Status = jd.total === 0 ? ST.kosong : jd.terlambat > 0 ? ST.tindakan : jd.segera > 0 ? ST.waspada : ST.baik;
  const stOrg: Status = org.site === 0 ? ST.kosong : org.perluSync > 0 || org.picaTelat > 0 ? ST.waspada : ST.baik;

  const warnaMerah = NADA.neg.teks;
  const warnaKuning = NADA.warn.teks;
  const adaGagal = galat || gagal.length > 0;

  return (
    <>
      <style>{WR_CSS}{EAM_CSS}{DB_CSS}</style>

      <div className="db-top">
        <PageHeader icon={LayoutDashboard} title="Dashboard" sub="Poin penting dari semua menu. Klik tombol pada kartu untuk membuka halaman detailnya." />
        <div className="db-act">
          {sinkronTerakhir && <span title="Waktu terakhir data ditarik dari Google Spreadsheet">Spreadsheet disinkron {teksUmur(umurJam(sinkronTerakhir))}</span>}
          {diperbarui && !memuat && <span>· dibuka {diperbarui.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>}
          <button type="button" className="db-btn" onClick={muatSemua} disabled={memuat}>
            {memuat ? <Loader2 size={14} className="db-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />} Muat Ulang
          </button>
        </div>
      </div>

      {adaGagal && (
        <div className="glass-panel" style={{ borderRadius: 14, padding: '.7rem 1rem', marginBottom: '1rem', fontSize: '.78rem', color: warnaMerah }}>
          {galat ? `${galat} ` : ''}{gagal.length > 0 ? `Gagal memuat: ${gagal.join(', ')}. Bagian itu ditampilkan kosong.` : ''}
        </div>
      )}

      {/* ── Ringkasan status: tetap terlihat di atas walau daftar rinci ada di bawah ── */}
      <div className="db-strip" role="status" aria-live="polite">
        {memuat && poin.length === 0 ? (
          <span className="db-chip" style={{ background: NADA.neutral.bg, color: NADA.neutral.teks, border: `1px solid ${NADA.neutral.garis}` }}><Loader2 size={13} className="db-spin" aria-hidden="true" /> Memuat data…</span>
        ) : poin.length === 0 ? (
          <span className="db-chip" style={{ background: NADA.in.bg, color: NADA.in.teks, border: `1px solid ${NADA.in.garis}` }}><CheckCircle2 size={13} aria-hidden="true" /> Semua indikator dalam kondisi baik</span>
        ) : (
          <>
            {jmlPoin.neg > 0 && <span className="db-chip" style={{ background: NADA.neg.bg, color: NADA.neg.teks, border: `1px solid ${NADA.neg.garis}` }}>{angka(jmlPoin.neg)} hal mendesak</span>}
            {jmlPoin.warn > 0 && <span className="db-chip" style={{ background: NADA.warn.bg, color: NADA.warn.teks, border: `1px solid ${NADA.warn.garis}` }}>{angka(jmlPoin.warn)} perlu dipantau</span>}
            {jmlPoin.info > 0 && <span className="db-chip" style={{ background: NADA.info.bg, color: NADA.info.teks, border: `1px solid ${NADA.info.garis}` }}>{angka(jmlPoin.info)} informasi</span>}
            <button type="button" className="db-btn" onClick={keDaftar}>Lihat daftar <ChevronDown size={13} aria-hidden="true" /></button>
          </>
        )}
      </div>

      {/* ── Satu kartu per menu ── */}
      <div className="db-grid">
        <KartuMenu ikon={FileText} nada={NADA.out} judul="Ringkasan Laporan" sub={`Barang masuk & keluar · ${tahun}`} status={stLap} memuat={memuat}
          stats={lap.baris === 0 && !pr && !ss ? null : [
            { label: 'Barang Masuk', nilai: rupiahRingkas(lap.masuk), sub: lap.masuk >= lap.keluar ? `lebih besar ${rupiahRingkas(lap.masuk - lap.keluar)}` : undefined },
            { label: 'Barang Keluar', nilai: rupiahRingkas(lap.keluar), sub: lap.keluar > lap.masuk ? `lebih besar ${rupiahRingkas(lap.keluar - lap.masuk)}` : undefined },
            { label: 'PR Menunggu Approval', nilai: pr ? angka(pr.pending) : '–', sub: pr ? `dari ${angka(pr.total)} PR belum selesai` : 'belum ada data', warna: pr && pr.persenPending >= 50 ? warnaKuning : undefined },
            { label: 'Safety Stock', nilai: ss ? fmtP(ss.pct) : '–', sub: ss ? `target ${ss.target}% · ${ss.label}` : 'belum ada data', warna: ss && ss.tingkat !== 'baik' ? (ss.tingkat === 'rendah' ? warnaMerah : warnaKuning) : undefined },
          ]}
          grafik={<>
            <MiniGrafik jenis="garis" judul="Masuk vs keluar / bulan" data={lap.bulanan} fmt={fmtRp}
              seri={[{ kunci: 'Masuk', nama: 'Masuk', warna: W['--wr-out'] }, { kunci: 'Keluar', nama: 'Keluar', warna: W['--wr-warn'] }]}
              ringkas={`Nilai barang masuk dan keluar per bulan tahun ${tahun}`} />
            {ss && <MiniGrafik jenis="garis" judul="Safety stock / minggu" data={ss.tren} fmt={fmtPersen}
              seri={[{ kunci: 'Pencapaian', nama: 'Pencapaian (%)', warna: W['--wr-in'] }]}
              ringkas={`Pencapaian safety stock per minggu, terakhir ${fmtP(ss.pct)}`} />}
          </>}
          temuan={lap.masuk > 0 || lap.keluar > 0
            ? (lap.masuk >= lap.keluar ? `Nilai barang masuk ${rp(lap.masuk - lap.keluar)} lebih besar dari barang keluar.` : `Nilai barang keluar ${rp(lap.keluar - lap.masuk)} lebih besar dari barang masuk.`) : null}
          tombol="Buka Ringkasan Laporan" onBuka={() => onNavigasi({ ke: 'laporan', mode: 'RINGKASAN_LAPORAN' })} />

        <KartuMenu ikon={Package} nada={NADA.info} judul="Spare Part In / Out" sub={`Kode I-RDA / I-RCE · ${tahun}`} status={stSp} memuat={memuat}
          stats={sp.items.length === 0 ? null : [
            { label: 'Masuk', nilai: rupiahRingkas(sp.nilaiMasuk), sub: 'nilai tahun ini' },
            { label: 'Keluar', nilai: rupiahRingkas(sp.nilaiKeluar), sub: 'nilai tahun ini' },
            { label: 'Stok Kritis', nilai: angka(sp.hitung.Kritis), sub: 'cukup < 4 minggu', warna: sp.hitung.Kritis > 0 ? warnaMerah : undefined },
            { label: 'Stok Waspada', nilai: angka(sp.hitung.Waspada), sub: `dari ${angka(sp.items.length)} jenis part`, warna: sp.hitung.Waspada > 0 ? warnaKuning : undefined },
          ]}
          grafik={<MiniGrafik jenis="batang" judul="Nilai masuk & keluar / bulan" data={sp.bulanan} fmt={fmtRp}
            seri={[{ kunci: 'Masuk', nama: 'Masuk', warna: W['--wr-out'] }, { kunci: 'Keluar', nama: 'Keluar', warna: W['--wr-warn'] }]}
            ringkas={`Nilai spare part masuk dan keluar per bulan tahun ${tahun}`} />}
          temuan={sp.top && sp.top.nilai > 0 ? `Pemakaian terbesar tahun ini: ${potong(sp.top.nama, 48)} (${rp(sp.top.nilai)}).` : null}
          tombol="Buka Spare Part" onBuka={() => onNavigasi({ ke: 'spare-part' })} />

        <KartuMenu ikon={ArrowLeftRight} nada={NADA.aset} judul="Transfer Antar Site" sub="Rekomendasi pemerataan stok" status={stTr} memuat={memuat}
          stats={sp.items.length === 0 ? null : [
            { label: 'Rekomendasi', nilai: angka(tr.jumlah), sub: tr.jumlah > 0 ? `senilai ${rupiahRingkas(tr.nilai)}` : 'tidak ada yang perlu dipindah' },
            { label: 'Mendesak', nilai: angka(tr.mendesak), sub: 'stok penerima < 2 minggu', warna: tr.mendesak > 0 ? warnaMerah : undefined },
            { label: 'Belum Ada Donor', nilai: angka(tr.tanpaDonor), sub: 'perlu pengadaan', warna: tr.tanpaDonor > 0 ? warnaKuning : undefined },
          ]}
          grafik={<Komposisi judul="Rekomendasi menurut urgensi" bagian={[
            { label: 'Tinggi', nilai: tr.urgensi.Tinggi, warna: 'var(--wr-neg)' },
            { label: 'Sedang', nilai: tr.urgensi.Sedang, warna: 'var(--wr-warn)' },
            { label: 'Rendah', nilai: tr.urgensi.Rendah, warna: 'var(--wr-info)' },
          ]} />}
          temuan={tr.teratas ? `Prioritas: ${qty(tr.teratas.qty)} ${tr.teratas.satuan} ${potong(tr.teratas.nama, 36)} dari ${namaSite(tr.teratas.dari)} ke ${namaSite(tr.teratas.ke)}.` : null}
          tombol="Buka Transfer Antar Site" onBuka={() => onNavigasi({ ke: 'transfer' })} />

        <KartuMenu ikon={Building2} nada={NADA.warn} judul="Aset Tetap" sub="Asset Management" status={stAset} memuat={memuat}
          stats={aset.jumlah === 0 ? null : [
            { label: 'Total Nilai', nilai: rupiahRingkas(aset.nilai), sub: 'harga tercatat + estimasi' },
            { label: 'Item Aset', nilai: angka(aset.jumlah), sub: `${angka(aset.unit)} unit` },
            { label: 'Equipment', nilai: rupiahRingkas(aset.equipment), sub: aset.nilai > 0 ? `${fmtP((aset.equipment / aset.nilai) * 100, 0)} dari nilai` : undefined },
            { label: 'Building', nilai: rupiahRingkas(aset.building), sub: aset.nilai > 0 ? `${fmtP((aset.building / aset.nilai) * 100, 0)} dari nilai` : undefined },
          ]}
          grafik={<Komposisi judul="Komposisi nilai aset" fmt={rupiahRingkas} bagian={[
            { label: 'Equipment', nilai: aset.equipment, warna: 'var(--wr-aset)' },
            { label: 'Building', nilai: aset.building, warna: 'var(--wr-info)' },
            { label: 'Belum terklasifikasi', nilai: aset.belumKlasNilai, warna: 'var(--wr-neutral)' },
          ]} />}
          temuan={aset.tanpaHarga > 0 || aset.belumKlas > 0
            ? `Perlu dilengkapi: ${angka(aset.tanpaHarga)} item belum berharga, ${angka(aset.belumKlas)} item belum terklasifikasi.` : null}
          tombol="Buka Aset Tetap" onBuka={() => onNavigasi({ ke: 'aset', tab: 'RINGKASAN' })} />

        <KartuMenu ikon={CalendarClock} nada={NADA.neg} judul="Jadwal Maintenance" sub="Overhaul, ganti oli, perawatan & part" status={stJd} memuat={memuat}
          stats={jd.total === 0 ? null : [
            { label: 'Terlambat', nilai: angka(jd.terlambat), sub: 'lewat jatuh tempo', warna: jd.terlambat > 0 ? warnaMerah : undefined },
            { label: 'Segera', nilai: angka(jd.segera), sub: 'jatuh tempo ≤ 14 hari', warna: jd.segera > 0 ? warnaKuning : undefined },
            { label: 'Total Jadwal', nilai: angka(jd.total), sub: 'peralatan × kegiatan' },
            { label: 'Biaya 12 Bulan', nilai: rupiahRingkas(jd.biaya12), sub: 'perawatan terakhir' },
          ]}
          grafik={<Komposisi judul="Jadwal menurut status" bagian={[
            { label: 'Terlambat', nilai: jd.terlambat, warna: 'var(--wr-neg)' },
            { label: 'Segera', nilai: jd.segera, warna: 'var(--wr-warn)' },
            { label: 'Terjadwal', nilai: jd.terjadwal, warna: 'var(--wr-in)' },
            { label: 'Cek data', nilai: jd.cekData, warna: 'var(--wr-neutral)' },
          ]} />}
          temuan={jd.terlama ? `Paling lama terlewat: ${potong(jd.terlama.peralatan, 40)} · ${NAMA_KEGIATAN[jd.terlama.kegiatan]} (${angka(Math.abs(jd.terlama.sisaHari))} hari).` : null}
          tombol="Buka Jadwal Maintenance" onBuka={() => onNavigasi({ ke: 'jadwal' })} />

        {/* Organisasi: cukup poin pentingnya, tiap baris membuka menunya masing-masing. */}
        <section className="glass-panel db-kartu" aria-label="Organisasi">
          <header className="db-kh">
            <span className="db-ikon" style={{ background: NADA.in.bg, color: NADA.in.teks, border: `1px solid ${NADA.in.garis}` }}><MapPin size={18} aria-hidden="true" /></span>
            <div style={{ minWidth: 0 }}>
              <h3 className="db-judul">Organisasi</h3>
              <div className="db-sub">Site, tim lapangan, dan akun</div>
            </div>
            <span className="db-pill" style={{ background: stOrg.nada.bg, color: stOrg.nada.teks, border: `1px solid ${stOrg.nada.garis}` }}>{memuat && org.site === 0 ? 'Memuat…' : stOrg.label}</span>
          </header>
          <div className="db-org">
            <div className="db-org-row">
              <MapPin size={16} color={NADA.in.teks} aria-hidden="true" />
              <div>
                <b>Site Operasional · {angka(org.site)} site</b>
                <span>{angka(org.terhubung)} terhubung ke spreadsheet{org.perluSync > 0 ? `, ${angka(org.perluSync)} perlu sinkron` : ', semua data terbaru'}</span>
              </div>
              <button type="button" className="db-btn" onClick={() => onNavigasi({ ke: 'view', view: 'branches' })}>Buka <ArrowRight size={13} aria-hidden="true" /></button>
            </div>
            <div className="db-org-row">
              <Users size={16} color={NADA.in.teks} aria-hidden="true" />
              <div>
                <b>Tim Lapangan · {angka(org.anggota)} anggota</b>
                <span>{angka(org.picaBuka)} isu PICA terbuka{org.picaTelat > 0 ? `, ${angka(org.picaTelat)} melewati target` : ''}</span>
              </div>
              <button type="button" className="db-btn" onClick={() => onNavigasi({ ke: 'view', view: 'team' })}>Buka <ArrowRight size={13} aria-hidden="true" /></button>
            </div>
            {jumlahPengguna !== undefined && (
              <div className="db-org-row">
                <UserCog size={16} color={NADA.in.teks} aria-hidden="true" />
                <div>
                  <b>Kelola Pengguna · {angka(jumlahPengguna)} akun</b>
                  <span>Akun yang bisa masuk ke portal admin</span>
                </div>
                <button type="button" className="db-btn" onClick={() => onNavigasi({ ke: 'view', view: 'users' })}>Buka <ArrowRight size={13} aria-hidden="true" /></button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Perlu perhatian ── */}
      <section id="db-perhatian" className="glass-panel db-sec" aria-label="Perlu perhatian" style={{ scrollMarginTop: 80 }}>
        <h3 className="db-h"><AlertTriangle size={16} aria-hidden="true" /> Perlu Perhatian</h3>
        <p className="db-hs">Diurutkan dari yang paling mendesak. Merah = harus segera ditindak, kuning = pantau, biru = informasi.</p>
        {memuat && poin.length === 0 ? (
          <div className="db-ok"><Loader2 size={16} className="db-spin" aria-hidden="true" /> Memuat data…</div>
        ) : poin.length === 0 ? (
          <div className="db-ok"><CheckCircle2 size={18} color={NADA.in.teks} aria-hidden="true" /> Tidak ada hal mendesak. Semua indikator dalam kondisi baik.</div>
        ) : (
          <div className="db-att">
            {poinTampil.map((x) => {
              const n = NADA_POIN[x.tingkat];
              const Ikon = x.ikon;
              return (
                <div key={x.id} className="db-poin">
                  <span className="db-poin-i" style={{ background: n.bg, color: n.teks, border: `1px solid ${n.garis}` }}><Ikon size={15} aria-hidden="true" /></span>
                  <p>{x.teks}</p>
                  <button type="button" className="db-btn" onClick={() => onNavigasi(x.tujuan)}>{x.tombol} <ArrowRight size={13} aria-hidden="true" /></button>
                </div>
              );
            })}
            {poin.length > MAKS_POIN && (
              <button type="button" className="db-btn" style={{ justifySelf: 'start' }} onClick={() => setSemuaPoin((v) => !v)}>
                {semuaPoin ? 'Tampilkan lebih sedikit' : `Tampilkan ${poin.length - MAKS_POIN} lainnya`}
              </button>
            )}
          </div>
        )}
      </section>

      <p className="db-note">
        <Info size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Nilai barang masuk/keluar dan spare part dihitung untuk tahun {tahun}; status stok memakai riwayat pemakaian 12 minggu terakhir.
          Spare part = kode berawalan I-RDA / I-RCE, sama dengan menu Spare Part. Rekomendasi transfer memakai pengaturan bawaan (target stok 8 minggu).
        </span>
      </p>
    </>
  );
}