// Halaman "Ringkasan Laporan" — pintu masuk menu Laporan.
//
// Merangkum empat laporan dalam satu layar agar analisis garis besar cepat dan mudah dipahami:
// Barang Masuk, Barang Keluar, Outstanding PR, dan Pencapaian Safety Stock. Tiap kartu punya
// tombol "Lihat detail" yang langsung membuka sub-menu terkait.
//
// Sumber data (semuanya sudah ada, tidak ada endpoint baru):
//   • Barang Masuk / Keluar → /weekly-reports?direction=IN|OUT&tahun=…  (ikut filter tahun & site)
//     Filter tambahan (dihitung di browser dari kolom `kode`, tanpa endpoint baru):
//       – Periode : dropdown Semua / minggu tertentu / bulan tertentu → SEMUA angka & grafik Masuk/Keluar
//                   ikut berubah (total nilai periode itu), bukan hanya grafiknya
//       – Kode    : I-RDA / I-RCE / I-RET. Kode berawalan angka = kode aset, bukan spare part, jadi tidak
//                   punya kategori sendiri di sini (tetap ikut terhitung pada pilihan "Semua")
//   • Outstanding PR        → /outstanding-pr   (seluruh perusahaan)
//   • Safety Stock          → /min-stock        (seluruh perusahaan)
import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, FileText, PackageCheck, ArrowRight, Loader2, Lightbulb, Info, Wallet, Scale,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { api } from '../../lib/api';
import { getSites } from '../../data/siteStore';
import type { AuthState } from '../../types';
import { labelPenuh, labelSiteDariKey } from './siteLabel';
import { NADA, tooltipProps, fmtLegend, WR_CSS, useWrTema } from './wrTema';
import type { Nada } from './wrTema';
import { KpiKartu, EAM_CSS } from './eamUi';
import { angka, rupiahRingkas } from './eamHelpers';
import type { LaporanMode } from './Sidebar';
import { normKode } from './sparePartData';

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const fmtTooltip = (v: unknown) => rp(Number(v) || 0);
const fmtP = (n: number, d = 1) => `${n.toLocaleString('id-ID', { maximumFractionDigits: d })}%`;
const tickRupiah = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (a >= 1e6) return `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 0 })} jt`;
  if (a >= 1e3) return `${(n / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
  return String(Math.round(n));
};
const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// ── Tipe payload (subset yang dipakai) ───────────────────────────────────
interface BarisLaporan { minggu: number; bulan: number; totalHarga: number; alokasi: string; section: string; kode: string; tanggal: string | null }
interface OsData {
  grand: { pending: number; released: number; total: number };
  sites: { key: string; label: string; totals: { total: number } }[];
  history: { label: string; total: number }[];
}
type Titik = [number, number | null, number | null, number | null];
interface MsData {
  target: number; weeks: { n: number; label: string; filled: boolean }[];
  groups: { category: string; rows: { location: string; v: (Titik | null)[] }[] }[];
}

const SEKSI: Record<string, { nama: string; warna: string }> = {
  MAINT: { nama: 'Part Maintenance', warna: 'var(--wr-pie-in)' },
  OH: { nama: 'Overhold', warna: 'var(--wr-pie-out)' },
  OLI: { nama: 'Consumption OLI', warna: 'var(--wr-pie-warn)' },
  LAIN: { nama: 'Lain-Lain', warna: 'var(--wr-pie-aset)' },
  ISOTANK: { nama: 'ISO Tank', warna: 'var(--wr-pie-info)' },
};

// ── Periode & kategori kode ──────────────────────────────────────────────
type Granul = 'HARI' | 'MINGGU' | 'BULAN';
type KodeKat = 'RDA' | 'RCE' | 'RET';
type FilterKat = 'ALL' | KodeKat;
type Pilihan = { jenis: 'ALL' } | { jenis: 'W' | 'B'; n: number };

const KAT_KODE: { key: KodeKat; nama: string; ket: string }[] = [
  { key: 'RDA', nama: 'RDA', ket: 'Kode berawalan I-RDA' },
  { key: 'RCE', nama: 'RCE', ket: 'Kode berawalan I-RCE' },
  { key: 'RET', nama: 'RET', ket: 'Kode berawalan I-RET' },
];
const NAMA_KAT: Record<FilterKat, string> = { ALL: 'Semua kode', RDA: 'RDA', RCE: 'RCE', RET: 'RET' };
const NAMA_BULAN_PENUH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Awalan "I-" boleh tidak ada; huruf sesudah RDA/RCE/RET tidak boleh langsung huruf lagi
// supaya kode kontainer ISO Tank (mis. RDAU1581209) tidak ikut terhitung sebagai RDA.
// Kode berawalan angka (mis. 01.11-2026-0033) adalah kode ASET → bukan RDA/RCE/RET → null.
const POLA_KAT = /^(?:I-?)?(RDA|RCE|RET)(?![A-Z])/;
function kategoriKode(kode: string): KodeKat | null {
  const m = POLA_KAT.exec(normKode(kode));
  return m ? (m[1] as KodeKat) : null;
}

/** Nilai dropdown periode: "ALL", "W:12" (minggu 12) atau "B:3" (bulan Maret). */
function parsePilihan(v: string): Pilihan {
  const m = /^([WB]):(\d+)$/.exec(v);
  return m ? { jenis: m[1] as 'W' | 'B', n: Number(m[2]) } : { jenis: 'ALL' };
}
const lolosPilihan = (r: BarisLaporan, p: Pilihan) =>
  p.jenis === 'ALL' || (p.jenis === 'W' ? Number(r.minggu) === p.n : Number(r.bulan) === p.n);

const nilaiBaris = (r: BarisLaporan) => Number(r.totalHarga) || 0;
const jumlah = (rows: BarisLaporan[]) => rows.reduce((t, r) => t + nilaiBaris(r), 0);
const namaGranul = (g: Granul) => (g === 'HARI' ? 'hari' : g === 'MINGGU' ? 'minggu' : 'bulan');

const HARI_MS = 86_400_000;
function kunciWaktu(r: BarisLaporan, g: Granul): number | null {
  if (g === 'MINGGU') return Number(r.minggu) || null;
  if (g === 'BULAN') return Number(r.bulan) || null;
  const t = r.tanggal ? Date.parse(String(r.tanggal).slice(0, 10)) : NaN;
  return Number.isFinite(t) ? t : null;
}
function labelWaktu(n: number, g: Granul): string {
  if (g === 'MINGGU') return `W${n}`;
  if (g === 'BULAN') return NAMA_BULAN[n - 1] ?? `B${n}`;
  const d = new Date(n);
  return `${d.getUTCDate()} ${NAMA_BULAN[d.getUTCMonth()]}`;
}

/** Jumlahkan nilai per hari / minggu / bulan. */
function petaWaktu(rows: BarisLaporan[], g: Granul): Map<number, number> {
  const per = new Map<number, number>();
  for (const r of rows) {
    const n = kunciWaktu(r, g);
    if (n === null) continue;
    per.set(n, (per.get(n) ?? 0) + nilaiBaris(r));
  }
  return per;
}

/** Titik sumbu dari awal sampai akhir data; periode kosong di antaranya diisi 0 supaya jarak sumbu tidak menipu. */
function rentang(ada: number[], g: Granul): number[] {
  if (!ada.length) return [];
  const langkah = g === 'HARI' ? HARI_MS : 1;
  const awal = g === 'BULAN' ? 1 : Math.min(...ada), akhir = Math.max(...ada);
  const n = Math.round((akhir - awal) / langkah) + 1;
  // Tanggal salah ketik (mis. beda tahun) bisa membuat rentang membengkak — pakai titik yang ada saja.
  if (n > 400) return [...new Set(ada)].sort((x, y) => x - y);
  return Array.from({ length: n }, (_, i) => awal + i * langkah);
}

function deretWaktu(rows: BarisLaporan[], g: Granul): { label: string; Nilai: number }[] {
  const per = petaWaktu(rows, g);
  return rentang([...per.keys()], g).map((n) => ({ label: labelWaktu(n, g), Nilai: per.get(n) ?? 0 }));
}

/** Dua seri (masuk & keluar) pada sumbu waktu yang sama. */
function deretGabung(masuk: BarisLaporan[], keluar: BarisLaporan[], g: Granul) {
  const a = petaWaktu(masuk, g), b = petaWaktu(keluar, g);
  return rentang([...a.keys(), ...b.keys()], g).map((n) => ({
    label: labelWaktu(n, g),
    'Barang Masuk': a.get(n) ?? 0,
    'Barang Keluar': b.get(n) ?? 0,
  }));
}

const tingkat = (p: number, target: number): 'baik' | 'waspada' | 'rendah' => (p >= target * 0.9 ? 'baik' : p >= target * 0.75 ? 'waspada' : 'rendah');
const NADA_TINGKAT: Record<'baik' | 'waspada' | 'rendah', Nada> = { baik: NADA.in, waspada: NADA.warn, rendah: NADA.neg };
const LABEL_TINGKAT = { baik: 'Baik', waspada: 'Waspada', rendah: 'Rendah' } as const;

// ── Potongan UI ──────────────────────────────────────────────────────────
function Garis({ data, kunci, warna, referensi, tinggi = 110 }: {
  data: Record<string, string | number>[]; kunci: string; warna: string; referensi?: number; tinggi?: number;
}) {
  const { W } = useWrTema();
  if (data.length < 2) return <div className="lr-nodata" style={{ height: tinggi }}>Data belum cukup untuk grafik.</div>;
  return (
    <div style={{ height: tinggi }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
          <XAxis dataKey="label" hide />
          <YAxis hide domain={referensi ? [0, (m: number) => Math.max(m, referensi * 1.05)] : ['auto', 'auto']} />
          <Tooltip {...tooltipProps} cursor={{ stroke: W['--wr-cursor'] }} labelFormatter={(l) => String(l)}
            formatter={(v: unknown) => (referensi ? fmtP(Number(v), 1) : fmtTooltip(v))} />
          {referensi !== undefined && <ReferenceLine y={referensi} stroke={W['--wr-neutral']} strokeDasharray="4 4" />}
          <Line type="monotone" dataKey={kunci} stroke={warna} strokeWidth={2.4} dot={{ r: 3, strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Kartu({ ikon: Ikon, nada, judul, sub, onDetail, children }: {
  ikon: React.ElementType; nada: Nada; judul: string; sub: string; onDetail: () => void; children: React.ReactNode;
}) {
  return (
    <section className="glass-panel lr-kartu" aria-label={judul}>
      <header className="lr-kartu-h">
        <span className="lr-ikon" style={{ background: nada.bg, color: nada.teks, border: `1px solid ${nada.garis}` }}><Ikon size={18} aria-hidden="true" /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="lr-judul">{judul}</h3>
          <div className="lr-sub">{sub}</div>
        </div>
        <button type="button" className="lr-detail" onClick={onDetail}>Lihat detail <ArrowRight size={13} aria-hidden="true" /></button>
      </header>
      {children}
    </section>
  );
}

const Fakta = ({ label, nilai, nada }: { label: string; nilai: string; nada?: Nada }) => (
  <div className="lr-fakta"><span>{label}</span><b style={nada ? { color: nada.teks } : undefined}>{nilai}</b></div>
);

const LR_CSS = `
.lr-filter{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem}
.lr-filter label{font-size:.72rem;font-weight:700;color:var(--txt-secondary);display:flex;align-items:center;gap:.4rem}
.lr-grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr));margin-bottom:1rem}
.lr-kartu{border-radius:18px;padding:1rem 1.1rem;display:flex;flex-direction:column;gap:.75rem;min-width:0}
.lr-kartu-h{display:flex;gap:.7rem;align-items:center}
.lr-ikon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;flex-shrink:0}
.lr-judul{margin:0;font-size:.92rem;font-weight:800;color:var(--txt-primary)}
.lr-sub{font-size:.72rem;color:var(--wr-txt-muted);margin-top:1px}
.lr-detail{display:inline-flex;align-items:center;gap:.35rem;padding:.4rem .75rem;border-radius:9px;font:inherit;font-size:.74rem;font-weight:700;cursor:pointer;white-space:nowrap;
  background:var(--wr-btn-bg);color:var(--txt-primary);border:1px solid var(--wr-field-border)}
.lr-detail:hover{background:var(--wr-btn-bg-hover)}
.lr-detail:focus-visible{outline:2px solid var(--wr-focus,#00D084);outline-offset:2px}
.lr-utama{display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap}
.lr-utama b{font-size:1.55rem;font-weight:800;line-height:1.15;color:var(--txt-primary);font-variant-numeric:tabular-nums}
.lr-utama span{font-size:.74rem;color:var(--wr-txt-muted)}
.lr-fakta-wrap{display:grid;gap:.15rem}
.lr-fakta{display:flex;justify-content:space-between;gap:.75rem;font-size:.78rem;padding:.35rem 0;border-top:1px solid var(--wr-line)}
.lr-fakta span{color:var(--wr-txt-muted)}
.lr-fakta b{color:var(--txt-primary);text-align:right;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.lr-nodata{display:grid;place-items:center;font-size:.74rem;color:var(--wr-txt-muted)}
.lr-stack{display:flex;height:10px;border-radius:99px;overflow:hidden;background:var(--wr-line)}
.lr-stack>i{display:block;height:100%}
.lr-leg{display:flex;flex-wrap:wrap;gap:.3rem .85rem;font-size:.72rem;color:var(--txt-secondary)}
.lr-leg i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:.35rem}
.lr-poin{display:grid;grid-template-columns:auto 1fr auto;gap:.7rem;align-items:center;padding:.65rem .8rem;border-radius:14px;background:var(--wr-tab-bg);border:1px solid var(--wr-line)}
.lr-poin-i{width:30px;height:30px;border-radius:9px;display:grid;place-items:center}
.lr-poin p{margin:0;font-size:.8rem;line-height:1.45;color:var(--txt-primary)}
.lr-seg{display:inline-flex;border-radius:10px;overflow:hidden;border:1px solid var(--wr-field-border)}
.lr-seg button{font:inherit;font-size:.74rem;font-weight:700;padding:.42rem .8rem;cursor:pointer;border:0;background:var(--wr-field-bg);color:var(--wr-txt-muted)}
.lr-seg button+button{border-left:1px solid var(--wr-field-border)}
.lr-seg button:hover{background:var(--wr-btn-bg-hover);color:var(--txt-primary)}
.lr-seg button[aria-pressed='true']{background:var(--wr-in-bg);color:var(--wr-in-text)}
.lr-seg button:focus-visible,.lr-chip:focus-visible,.lr-rinci button:focus-visible{outline:2px solid var(--wr-focus,#00D084);outline-offset:2px}
.lr-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.38rem .8rem;border-radius:99px;font:inherit;font-size:.76rem;font-weight:700;cursor:pointer;
  background:var(--wr-tab-bg);color:var(--wr-txt-muted);border:1px solid var(--wr-line)}
.lr-chip:hover{background:var(--wr-btn-bg-hover);color:var(--txt-primary)}
.lr-chip[aria-pressed='true']{background:var(--wr-in-bg);color:var(--wr-in-text);border-color:var(--wr-in-border)}
.lr-chip small{font-weight:600;opacity:.75}
.lr-filter2{display:flex;gap:.45rem;align-items:center;flex-wrap:wrap;margin:-.2rem 0 1rem}
.lr-filter2>span{font-size:.72rem;font-weight:700;color:var(--txt-secondary);margin-right:.2rem}
.lr-rinci{width:100%;border-collapse:collapse;font-size:.78rem}
.lr-rinci th{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--wr-txt-muted);text-align:right;padding:.45rem .5rem;border-bottom:1px solid var(--wr-line)}
.lr-rinci th:first-child,.lr-rinci td:first-child{text-align:left}
.lr-rinci td{padding:.5rem;text-align:right;border-bottom:1px solid var(--wr-line);font-variant-numeric:tabular-nums;color:var(--txt-primary)}
.lr-rinci tr:last-child td{border-bottom:0}
.lr-rinci button{font:inherit;font-weight:800;font-size:.78rem;background:none;border:0;padding:0;cursor:pointer;color:var(--txt-primary);text-align:left}
.lr-rinci button:hover{text-decoration:underline}
.lr-rinci small{display:block;font-weight:500;font-size:.68rem;color:var(--wr-txt-muted)}
.lr-rinci tr[data-aktif='true'] td{background:var(--wr-tab-bg)}
.lr-scroll{overflow-x:auto}
.lr-note{display:flex;gap:.5rem;align-items:flex-start;font-size:.72rem;color:var(--wr-txt-muted);margin:0 0 1rem}
@keyframes lr-spin{to{transform:rotate(360deg)}}
.lr-spin{animation:lr-spin .9s linear infinite}
@media (prefers-reduced-motion:reduce){.lr-spin{animation:none}}
`;

// ── Komponen utama ───────────────────────────────────────────────────────
interface Props {
  auth: AuthState;
  /** Pindah ke sub-menu laporan terkait. */
  onBuka: (mode: LaporanMode) => void;
}

export function LaporanRingkasan({ auth, onBuka }: Props) {
  const { W, pie } = useWrTema();
  const siteTerkunci = auth.role !== 'Super Admin' && auth.assignedSite !== 'global';
  const sites = getSites();

  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [site, setSite] = useState<string>(siteTerkunci ? auth.assignedSite : 'global');
  const siteAktif = siteTerkunci ? auth.assignedSite : site;
  const [pilihanKey, setPilihanKey] = useState('ALL');
  const [kat, setKat] = useState<FilterKat>('ALL');

  const [masukAll, setMasuk] = useState<BarisLaporan[]>([]);
  const [keluarAll, setKeluar] = useState<BarisLaporan[]>([]);
  const [os, setOs] = useState<OsData | null>(null);
  const [ms, setMs] = useState<MsData | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState<string[]>([]);

  useEffect(() => {
    let batal = false;
    setMemuat(true);
    const q = (direction: 'IN' | 'OUT') => `/weekly-reports?${new URLSearchParams({ site: siteAktif, direction, tahun: String(tahun) })}`;
    const catat = (nama: string) => () => { if (!batal) setGagal((g) => (g.includes(nama) ? g : [...g, nama])); return null; };
    setGagal([]);
    Promise.all([
      api.get<BarisLaporan[]>(q('IN')).catch(catat('Barang Masuk')),
      api.get<BarisLaporan[]>(q('OUT')).catch(catat('Barang Keluar')),
      api.get<{ data: OsData | null }>('/outstanding-pr').catch(catat('Outstanding PR')),
      api.get<{ data: MsData | null }>('/min-stock').catch(catat('Safety Stock')),
    ]).then(([i, o, p, s]) => {
      if (batal) return;
      setMasuk(i ?? []); setKeluar(o ?? []); setOs(p?.data ?? null); setMs(s?.data ?? null);
    }).finally(() => { if (!batal) setMemuat(false); });
    return () => { batal = true; };
  }, [siteAktif, tahun]);

  // ── Filter berlapis ──
  // K = hanya kode · P = hanya periode · (tanpa akhiran) = kode + periode → dipakai semua angka & grafik.
  const pilihan = useMemo(() => parsePilihan(pilihanKey), [pilihanKey]);
  const masukK = useMemo(() => (kat === 'ALL' ? masukAll : masukAll.filter((r) => kategoriKode(r.kode) === kat)), [masukAll, kat]);
  const keluarK = useMemo(() => (kat === 'ALL' ? keluarAll : keluarAll.filter((r) => kategoriKode(r.kode) === kat)), [keluarAll, kat]);
  const masukP = useMemo(() => masukAll.filter((r) => lolosPilihan(r, pilihan)), [masukAll, pilihan]);
  const keluarP = useMemo(() => keluarAll.filter((r) => lolosPilihan(r, pilihan)), [keluarAll, pilihan]);
  const masuk = useMemo(() => masukK.filter((r) => lolosPilihan(r, pilihan)), [masukK, pilihan]);
  const keluar = useMemo(() => keluarK.filter((r) => lolosPilihan(r, pilihan)), [keluarK, pilihan]);

  // Satu minggu → grafik per hari; satu bulan → per minggu; semua → kartu per minggu, perbandingan per bulan.
  const granulKartu: Granul = pilihan.jenis === 'W' ? 'HARI' : 'MINGGU';
  const granulBanding: Granul = pilihan.jenis === 'W' ? 'HARI' : pilihan.jenis === 'B' ? 'MINGGU' : 'BULAN';
  const labelPeriode = pilihan.jenis === 'W' ? `W${pilihan.n} ${tahun}`
    : pilihan.jenis === 'B' ? `${NAMA_BULAN_PENUH[pilihan.n - 1] ?? `bulan ${pilihan.n}`} ${tahun}` : String(tahun);

  // Isi dropdown: tiap minggu / bulan yang ada datanya, lengkap dengan total masuk & keluar (ikut filter kode).
  const opsi = useMemo(() => {
    const susun = (kunci: (r: BarisLaporan) => number) => {
      const per = new Map<number, { masuk: number; keluar: number }>();
      const tambah = (rows: BarisLaporan[], arah: 'masuk' | 'keluar') => {
        for (const r of rows) {
          const n = Number(kunci(r));
          if (!Number.isFinite(n) || n < 1) continue;
          const c = per.get(n) ?? { masuk: 0, keluar: 0 };
          c[arah] += nilaiBaris(r); per.set(n, c);
        }
      };
      tambah(masukK, 'masuk'); tambah(keluarK, 'keluar');
      return [...per.entries()].sort((x, y) => x[0] - y[0]).map(([n, v]) => ({ n, ...v }));
    };
    return { minggu: susun((r) => r.minggu), bulan: susun((r) => r.bulan) };
  }, [masukK, keluarK]);

  // Rincian per kategori — ikut periode, tetapi selalu memperlihatkan RDA/RCE/RET sekaligus.
  const perKat = useMemo(() => KAT_KODE.map((c) => {
    const im = masukP.filter((r) => kategoriKode(r.kode) === c.key);
    const ik = keluarP.filter((r) => kategoriKode(r.kode) === c.key);
    return { ...c, masuk: jumlah(im), keluar: jumlah(ik), barisMasuk: im.length, barisKeluar: ik.length };
  }), [masukP, keluarP]);
  // Baris di luar RDA/RCE/RET (terutama kode aset berawalan angka) — hanya dihitung pada pilihan "Semua".
  const luarKat = useMemo(() => {
    const im = masukP.filter((r) => kategoriKode(r.kode) === null);
    const ik = keluarP.filter((r) => kategoriKode(r.kode) === null);
    return { masuk: jumlah(im), keluar: jumlah(ik), baris: im.length + ik.length };
  }, [masukP, keluarP]);

  // ── Barang masuk ──
  const m = useMemo(() => {
    const total = masuk.reduce((t, r) => t + (Number(r.totalHarga) || 0), 0);
    const vendor = new Map<string, number>();
    for (const r of masuk) { const v = (r.alokasi || '').trim() || 'Tanpa Supplier'; vendor.set(v, (vendor.get(v) ?? 0) + (Number(r.totalHarga) || 0)); }
    const urut = [...vendor.entries()].sort((a, b) => b[1] - a[1]);
    return { total, item: masuk.length, jumlahVendor: vendor.size, top: urut[0], deret: deretWaktu(masuk, granulKartu) };
  }, [masuk, granulKartu]);

  // ── Barang keluar ──
  const k = useMemo(() => {
    const total = keluar.reduce((t, r) => t + (Number(r.totalHarga) || 0), 0);
    const per = new Map<string, number>();
    for (const r of keluar) per.set(r.section, (per.get(r.section) ?? 0) + (Number(r.totalHarga) || 0));
    const seksi = Object.keys(SEKSI).map((key) => ({ key, ...SEKSI[key], nilai: per.get(key) ?? 0 })).filter((x) => x.nilai > 0).sort((a, b) => b.nilai - a.nilai);
    return { total, item: keluar.length, kat: seksi, top: seksi[0], deret: deretWaktu(keluar, granulKartu) };
  }, [keluar, granulKartu]);

  // ── Perbandingan masuk vs keluar ──
  const perbandingan = useMemo(() => deretGabung(masuk, keluar, granulBanding), [masuk, keluar, granulBanding]);

  // ── Outstanding PR ──
  const pr = useMemo(() => {
    if (!os) return null;
    const siteTop = [...os.sites].sort((a, b) => b.totals.total - a.totals.total)[0];
    return {
      total: os.grand.total, pending: os.grand.pending, released: os.grand.released,
      persenPending: os.grand.total > 0 ? (os.grand.pending / os.grand.total) * 100 : 0,
      siteTop, deret: os.history.map((h) => ({ label: h.label, Nilai: h.total })),
    };
  }, [os]);

  // ── Safety stock ──
  const ss = useMemo(() => {
    if (!ms) return null;
    const nW = ms.weeks.length;
    const seri = Array.from({ length: nW }, (_, i) => {
      let min = 0, real = 0, ada = false;
      for (const g of ms.groups) for (const r of g.rows) { const t = r.v[i]; if (t) { min += t[0]; real += t[1] ?? 0; ada = true; } }
      return ada && min > 0 ? { label: ms.weeks[i].label, Nilai: (real / min) * 100, i } : null;
    }).filter((x): x is { label: string; Nilai: number; i: number } => x !== null);
    if (!seri.length) return null;
    const akhir = seri[seri.length - 1];
    const sebelumnya = seri[seri.length - 2];
    // Pencapaian per lokasi pada minggu terakhir (kedua kategori dijumlahkan).
    const lok = new Map<string, { min: number; real: number }>();
    for (const g of ms.groups) for (const r of g.rows) {
      const t = r.v[akhir.i]; if (!t) continue;
      const c = lok.get(r.location) ?? { min: 0, real: 0 };
      c.min += t[0]; c.real += t[1] ?? 0; lok.set(r.location, c);
    }
    const daftar = [...lok.entries()].filter(([, v]) => v.min > 0).map(([nama, v]) => ({ nama, pct: (v.real / v.min) * 100 })).sort((a, b) => a.pct - b.pct);
    const target = ms.target || 100;
    return {
      pct: akhir.Nilai, label: akhir.label, target, delta: sebelumnya ? akhir.Nilai - sebelumnya.Nilai : null,
      tingkat: tingkat(akhir.Nilai, target), terendah: daftar[0],
      dibawahTarget: daftar.filter((d) => d.pct < target * 0.9).length, jumlahLokasi: daftar.length, deret: seri.map((x) => ({ label: x.label, Nilai: Math.round(x.Nilai * 10) / 10 })),
    };
  }, [ms]);

  // ── Poin penting ──
  const poin = useMemo(() => {
    const p: { id: string; nada: Nada; ikon: React.ElementType; teks: string; mode: LaporanMode }[] = [];
    if (m.top && m.total > 0 && (m.top[1] / m.total) >= 0.4) p.push({ id: 'vendor', nada: NADA.info, ikon: TrendingUp, mode: 'IN',
      teks: `Vendor “${m.top[0]}” menyumbang ${fmtP((m.top[1] / m.total) * 100, 0)} nilai barang masuk${kat === 'ALL' ? '' : ` kode ${NAMA_KAT[kat]}`} (${rp(m.top[1])}).` });
    if (k.top && k.total > 0) p.push({ id: 'kat', nada: NADA.info, ikon: TrendingDown, mode: 'OUT',
      teks: `Biaya barang keluar terbesar ada di ${k.top.nama}: ${rp(k.top.nilai)} (${fmtP((k.top.nilai / k.total) * 100, 0)} dari total).` });
    if (m.total > 0 || k.total > 0) {
      const selisih = m.total - k.total;
      p.push({ id: 'selisih', nada: selisih >= 0 ? NADA.in : NADA.warn, ikon: Scale, mode: selisih >= 0 ? 'IN' : 'OUT',
        teks: selisih >= 0 ? `Nilai barang masuk ${rp(selisih)} lebih besar dari barang keluar pada ${labelPeriode}${kat === 'ALL' ? '' : ` (kode ${NAMA_KAT[kat]})`}.` : `Nilai barang keluar ${rp(-selisih)} lebih besar dari barang masuk pada ${labelPeriode}${kat === 'ALL' ? '' : ` (kode ${NAMA_KAT[kat]})`}.` });
    }
    if (pr && pr.total > 0) p.push({ id: 'pr', nada: pr.persenPending >= 50 ? NADA.warn : NADA.info, ikon: FileText, mode: 'OS_PR',
      teks: `${angka(pr.total)} PR belum selesai; ${fmtP(pr.persenPending, 0)} masih menunggu approval${pr.siteTop ? `, terbanyak di ${pr.siteTop.label}` : ''}.` });
    if (ss) p.push({ id: 'ss', nada: NADA_TINGKAT[ss.tingkat], ikon: PackageCheck, mode: 'MIN_STOCK',
      teks: ss.dibawahTarget > 0 ? `Safety stock ${fmtP(ss.pct)} dari target ${ss.target}%; ${ss.dibawahTarget} lokasi masih di bawah ambang${ss.terendah ? `, terendah ${ss.terendah.nama} (${fmtP(ss.terendah.pct)})` : ''}.`
        : `Safety stock ${fmtP(ss.pct)} dari target ${ss.target}% — seluruh lokasi dalam kondisi baik.` });
    return p;
  }, [m, k, pr, ss, labelPeriode, kat]);

  const sumbu = { fontSize: 11, fill: W['--wr-txt-muted'] };
  const labelLingkup = siteAktif === 'global' ? 'seluruh site' : labelSiteDariKey(siteAktif);
  const tagKat = kat === 'ALL' ? '' : ` · kode ${NAMA_KAT[kat]}`;

  return (
    <>
      <style>{WR_CSS}{EAM_CSS}{LR_CSS}</style>

      <div className="lr-filter">
        {!siteTerkunci && (
          <label>Site
            <select className="wr-ctl" style={{ padding: '.45rem .7rem', borderRadius: 10 }} value={site} onChange={(e) => { setSite(e.target.value); setPilihanKey('ALL'); }}>
              <option value="global">Semua Site</option>
              {sites.map((s) => <option key={s.key} value={s.key}>{labelPenuh(s.label)}</option>)}
            </select>
          </label>
        )}
        <label>Tahun
          <input type="number" className="wr-ctl" style={{ width: 90, padding: '.45rem .7rem', borderRadius: 10 }} min={2020} max={2100} value={tahun}
            onChange={(e) => { setTahun(Number(e.target.value) || new Date().getFullYear()); setPilihanKey('ALL'); }} />
        </label>
        <label>Periode
          <select className="wr-ctl" style={{ padding: '.45rem .7rem', borderRadius: 10, maxWidth: 'min(420px, 100%)' }} value={pilihanKey} onChange={(e) => setPilihanKey(e.target.value)}>
            <option value="ALL">Semua periode</option>
            <optgroup label="Per Minggu">
              {opsi.minggu.map((o) => <option key={`W${o.n}`} value={`W:${o.n}`}>{`W${o.n} · Masuk ${rupiahRingkas(o.masuk)} · Keluar ${rupiahRingkas(o.keluar)}`}</option>)}
            </optgroup>
            <optgroup label="Per Bulan">
              {opsi.bulan.map((o) => <option key={`B${o.n}`} value={`B:${o.n}`}>{`${NAMA_BULAN_PENUH[o.n - 1] ?? `Bulan ${o.n}`} · Masuk ${rupiahRingkas(o.masuk)} · Keluar ${rupiahRingkas(o.keluar)}`}</option>)}
            </optgroup>
          </select>
        </label>
        {memuat && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', fontSize: '.74rem', color: 'var(--wr-txt-muted)' }}><Loader2 size={14} className="lr-spin" aria-hidden="true" /> Memuat…</span>}
      </div>
      <div className="lr-filter2" role="group" aria-label="Kategori kode barang">
        <span>Kode</span>
        <button type="button" className="lr-chip" aria-pressed={kat === 'ALL'} onClick={() => setKat('ALL')}>Semua <small>{angka(masukP.length + keluarP.length)}</small></button>
        {perKat.map((c) => (
          <button key={c.key} type="button" className="lr-chip" title={c.ket} aria-pressed={kat === c.key} onClick={() => setKat(kat === c.key ? 'ALL' : c.key)}>
            {c.nama} <small>{angka(c.barisMasuk + c.barisKeluar)}</small>
          </button>
        ))}
      </div>
      <p className="lr-note"><Info size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
        Barang Masuk &amp; Barang Keluar mengikuti filter site, tahun, periode, dan kode ({labelLingkup}, {labelPeriode}{kat !== 'ALL' ? `, kode ${NAMA_KAT[kat]}` : ''}). Outstanding PR dan Safety Stock mencakup seluruh perusahaan dan <b>tidak</b> ikut filter periode maupun kode.</p>

      {gagal.length > 0 && (
        <div className="glass-panel" style={{ borderRadius: 14, padding: '.7rem 1rem', marginBottom: '1rem', fontSize: '.78rem', color: NADA.neg.teks }}>
          Gagal memuat: {gagal.join(', ')}. Bagian itu ditampilkan kosong — buka sub-menunya untuk melihat penyebabnya.
        </div>
      )}

      {/* ── Angka kunci ── */}
      <div className="eam-kpis">
        <KpiKartu ikon={TrendingUp} warna="#60A5FA" label="Barang Masuk" nilai={rupiahRingkas(m.total)} sub={`${angka(m.item)} baris · ${angka(m.jumlahVendor)} vendor`} onKlik={() => onBuka('IN')} />
        <KpiKartu ikon={TrendingDown} warna="#F59E0B" label="Barang Keluar" nilai={rupiahRingkas(k.total)} sub={`${angka(k.item)} baris`} onKlik={() => onBuka('OUT')} />
        <KpiKartu ikon={Wallet} warna="#A78BFA" label="Selisih Masuk − Keluar" nilai={rupiahRingkas(m.total - k.total)} sub={m.total >= k.total ? 'masuk lebih besar' : 'keluar lebih besar'} />
        <KpiKartu ikon={FileText} warna="#F472B6" label="Outstanding PR" nilai={pr ? angka(pr.total) : '–'} sub={pr ? `${angka(pr.pending)} pending · ${angka(pr.released)} released` : 'belum ada data'} onKlik={() => onBuka('OS_PR')} />
        <KpiKartu ikon={PackageCheck} warna="#34D399" label="Pencapaian Safety Stock" nilai={ss ? fmtP(ss.pct) : '–'} nilaiWarna={ss ? NADA_TINGKAT[ss.tingkat].teks : undefined}
          sub={ss ? `target ${ss.target}% · ${ss.label}` : 'belum ada data'} onKlik={() => onBuka('MIN_STOCK')} />
      </div>

      {/* ── Empat kartu ringkasan ── */}
      <div className="lr-grid" style={{ marginTop: '1rem' }}>
        <Kartu ikon={TrendingUp} nada={NADA.out} judul="Barang Masuk" sub={`Nilai penerimaan per ${namaGranul(granulKartu)} · ${labelPeriode}${tagKat}`} onDetail={() => onBuka('IN')}>
          <div className="lr-utama"><b>{rp(m.total)}</b><span>{angka(m.item)} baris penerimaan</span></div>
          <Garis data={m.deret} kunci="Nilai" warna={W['--wr-out']} />
          <div className="lr-fakta-wrap">
            <Fakta label="Vendor terbesar" nilai={m.top ? `${m.top[0]} · ${rp(m.top[1])}` : '–'} />
            <Fakta label="Jumlah vendor" nilai={angka(m.jumlahVendor)} />
          </div>
        </Kartu>

        <Kartu ikon={TrendingDown} nada={NADA.warn} judul="Barang Keluar" sub={`Biaya per ${namaGranul(granulKartu)} · ${labelPeriode}${tagKat}`} onDetail={() => onBuka('OUT')}>
          <div className="lr-utama"><b>{rp(k.total)}</b><span>{angka(k.item)} baris pengeluaran</span></div>
          <Garis data={k.deret} kunci="Nilai" warna={W['--wr-warn']} />
          {k.kat.length > 0 && (
            <>
              <div className="lr-stack" role="img" aria-label="Komposisi biaya per kategori">
                {k.kat.map((x) => <i key={x.key} title={`${x.nama}: ${rp(x.nilai)}`} style={{ width: `${(x.nilai / k.total) * 100}%`, background: pie(x.warna) }} />)}
              </div>
              <div className="lr-leg">
                {k.kat.map((x) => <span key={x.key}><i style={{ background: pie(x.warna) }} />{x.nama} · {fmtP((x.nilai / k.total) * 100, 0)}</span>)}
              </div>
            </>
          )}
        </Kartu>

        <Kartu ikon={FileText} nada={NADA.aset} judul="Outstanding PR" sub="PR yang belum selesai · seluruh perusahaan" onDetail={() => onBuka('OS_PR')}>
          {pr ? (
            <>
              <div className="lr-utama"><b>{angka(pr.total)} PR</b><span>{fmtP(pr.persenPending, 0)} menunggu approval</span></div>
              <Garis data={pr.deret.map((d) => ({ label: d.label, Nilai: d.Nilai }))} kunci="Nilai" warna={W['--wr-aset']} />
              <div className="lr-fakta-wrap">
                <Fakta label="Pending approval" nilai={angka(pr.pending)} />
                <Fakta label="Released" nilai={angka(pr.released)} />
                <Fakta label="Site terbanyak" nilai={pr.siteTop ? `${pr.siteTop.label} · ${angka(pr.siteTop.totals.total)} PR` : '–'} />
              </div>
            </>
          ) : <div className="lr-nodata" style={{ minHeight: 150 }}>Belum ada data Outstanding PR. Sinkronkan sumbernya di sub-menu.</div>}
        </Kartu>

        <Kartu ikon={PackageCheck} nada={ss ? NADA_TINGKAT[ss.tingkat] : NADA.neutral} judul="Pencapaian Safety Stock" sub="Item yang sudah memenuhi minimum stock · seluruh perusahaan" onDetail={() => onBuka('MIN_STOCK')}>
          {ss ? (
            <>
              <div className="lr-utama">
                <b>{fmtP(ss.pct)}</b>
                <span style={{ color: NADA_TINGKAT[ss.tingkat].teks, fontWeight: 700 }}>{LABEL_TINGKAT[ss.tingkat]}</span>
                {ss.delta !== null && <span>{ss.delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(ss.delta * 10) / 10).toLocaleString('id-ID')} poin dari minggu lalu</span>}
              </div>
              <Garis data={ss.deret} kunci="Nilai" warna={W['--wr-in']} referensi={ss.target} />
              <div className="lr-fakta-wrap">
                <Fakta label={`Target`} nilai={`${ss.target}%`} />
                <Fakta label="Lokasi di bawah ambang" nilai={`${ss.dibawahTarget} dari ${ss.jumlahLokasi}`} nada={ss.dibawahTarget > 0 ? NADA.warn : undefined} />
                <Fakta label="Lokasi terendah" nilai={ss.terendah ? `${ss.terendah.nama} · ${fmtP(ss.terendah.pct)}` : '–'} />
              </div>
            </>
          ) : <div className="lr-nodata" style={{ minHeight: 150 }}>Belum ada data Safety Stock. Sinkronkan sumbernya di sub-menu.</div>}
        </Kartu>
      </div>

      {/* ── Perbandingan masuk vs keluar ── */}
      <section className="glass-panel" style={{ borderRadius: 18, padding: '1rem 1.1rem', marginBottom: '1rem' }} aria-label={`Perbandingan barang masuk dan keluar per ${namaGranul(granulBanding)}`}>
        <h3 className="lr-judul">Barang Masuk vs Barang Keluar per {namaGranul(granulBanding)} · {labelPeriode}{tagKat}</h3>
        <p className="lr-sub" style={{ margin: '.2rem 0 .7rem' }}>Dua garis saja: biru = nilai barang masuk, kuning = nilai barang keluar. Jika garis kuning di atas biru, pengeluaran melampaui penerimaan pada {namaGranul(granulBanding)} itu.</p>
        {perbandingan.length < 2 ? <div className="lr-nodata" style={{ height: 270 }}>Data belum cukup untuk grafik.</div> : (
          <div style={{ height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={perbandingan} margin={{ top: 8, right: 14, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                <XAxis dataKey="label" tick={sumbu} axisLine={false} tickLine={false} interval={granulBanding === 'MINGGU' ? 'preserveStartEnd' : 0} minTickGap={granulBanding === 'MINGGU' ? 14 : 0} />
                <YAxis tickFormatter={tickRupiah} tick={sumbu} axisLine={false} tickLine={false} width={52} />
                <Tooltip {...tooltipProps} formatter={fmtTooltip} cursor={{ stroke: W['--wr-cursor'] }} />
                <Legend wrapperStyle={{ fontSize: '.72rem' }} formatter={fmtLegend} />
                <Line type="monotone" dataKey="Barang Masuk" stroke={W['--wr-out']} strokeWidth={2.6} dot={granulBanding !== 'MINGGU' ? { r: 3.5, strokeWidth: 2 } : false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Barang Keluar" stroke={W['--wr-warn']} strokeWidth={2.6} dot={granulBanding !== 'MINGGU' ? { r: 3.5, strokeWidth: 2 } : false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ── Rincian per kategori kode ── */}
      <section className="glass-panel" style={{ borderRadius: 18, padding: '1rem 1.1rem', marginBottom: '1rem' }} aria-label="Rincian nilai per kategori kode">
        <h3 className="lr-judul">Rincian per Kategori Kode · {labelPeriode}</h3>
        <p className="lr-sub" style={{ margin: '.2rem 0 .6rem' }}>Klik kode untuk memfilter seluruh halaman. Angka di tabel ini mengikuti periode yang dipilih dan selalu menampilkan RDA, RCE, dan RET sekaligus.</p>
        <div className="lr-scroll">
          <table className="lr-rinci">
            <thead><tr><th>Kode</th><th>Barang Masuk</th><th>Barang Keluar</th><th>Selisih</th><th>Baris</th></tr></thead>
            <tbody>
              {perKat.map((c) => {
                const selisih = c.masuk - c.keluar;
                return (
                  <tr key={c.key} data-aktif={kat === c.key}>
                    <td><button type="button" onClick={() => setKat(kat === c.key ? 'ALL' : c.key)} aria-pressed={kat === c.key}>{c.nama}<small>{c.ket}</small></button></td>
                    <td>{rp(c.masuk)}</td>
                    <td>{rp(c.keluar)}</td>
                    <td style={{ color: selisih >= 0 ? NADA.in.teks : NADA.warn.teks, fontWeight: 700 }}>{selisih >= 0 ? '+' : '−'}{rp(Math.abs(selisih))}</td>
                    <td>{angka(c.barisMasuk)} / {angka(c.barisKeluar)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="lr-sub" style={{ margin: '.55rem 0 0' }}>
          Kolom Baris = jumlah baris masuk / keluar.
          {luarKat.baris > 0 && <> Baris berkode angka (kode aset) tidak termasuk RDA/RCE/RET: {angka(luarKat.baris)} baris, masuk {rp(luarKat.masuk)} · keluar {rp(luarKat.keluar)} — hanya ikut terhitung pada pilihan “Semua”.</>}
        </p>
      </section>

      {/* ── Poin penting ── */}
      {poin.length > 0 && (
        <section className="glass-panel" style={{ borderRadius: 18, padding: '1rem 1.1rem', display: 'grid', gap: '.55rem' }} aria-label="Poin penting">
          <h3 className="lr-judul" style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}><Lightbulb size={16} aria-hidden="true" /> Poin Penting</h3>
          {poin.map((x) => {
            const Ikon = x.ikon;
            return (
              <div key={x.id} className="lr-poin">
                <span className="lr-poin-i" style={{ background: x.nada.bg, color: x.nada.teks, border: `1px solid ${x.nada.garis}` }}><Ikon size={15} aria-hidden="true" /></span>
                <p>{x.teks}</p>
                <button type="button" className="lr-detail" onClick={() => onBuka(x.mode)}>Detail <ArrowRight size={13} aria-hidden="true" /></button>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}