// Tab "Ringkasan Aset" di halaman Aset Tetap & Depresiasi.
//
// Satu layar untuk memahami kondisi aset secara cepat: (1) angka kunci, (2) temuan
// yang perlu ditindaklanjuti, (3) grafik per kategori / site / umur / proyeksi
// penyusutan, dan (4) rangkuman Asset Management (daftar aset dari sheet) yang
// detailnya ada di tab "Asset Management".
//
// Data: aset tetap & work order datang dari props (sudah dimuat AdminDashboard);
// Asset Management ditarik sendiri dari /weekly-reports?direction=ASET.
import { useEffect, useMemo, useState } from 'react';
import {
  Boxes, Wallet, ShieldCheck, TrendingDown, Download, ArrowRight, AlertTriangle, Hourglass, ShieldAlert,
  Wrench, Lightbulb, Layers, CheckCircle2, Loader2, Package, MapPin, Banknote,
} from 'lucide-react';
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import type { AuthState, FixedAsset, WorkOrder } from '../../types';
import { api } from '../../lib/api';
import { labelSiteDariKey } from './siteLabel';
import { NADA, tooltipProps, fmtLegend, useWrTema } from './wrTema';
import type { Nada } from './wrTema';
import { KpiKartu, Pil } from './eamUi';
import {
  angka, rupiahRingkas, infoGaransi, sisaUmurTahun, statusWo, WO_TERBUKA, unduhCsv, hariIni,
} from './eamHelpers';
import {
  tambahKlasifikasi, ringkasKlasifikasi, jenisTakDikenal, nilaiBaris,
} from './asetKlasifikasi';
import { KartuKelas, BadgeKategori } from './AsetKlasifikasiUi';
import type { AsetTab } from './Sidebar';
import type { Perhatian } from './AssetRegistryView';

const TAHUN_MS = 365.25 * 86_400_000;

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const fmtTooltip = (v: unknown) => rp(Number(v) || 0);
/** Label sumbu: 12.500.000 → "12,5 jt" (tanpa awalan Rp supaya sumbu tidak penuh). */
const tickRupiah = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (a >= 1e6) return `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 0 })} jt`;
  if (a >= 1e3) return `${(n / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
  return String(Math.round(n));
};
const potong = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** Nilai buku sebuah aset pada tanggal tertentu (garis lurus, rumus sama dengan server/registry). */
function nilaiBukuPada(a: FixedAsset, tMs: number): number {
  const dasar = Math.max(a.acquisitionCost - a.salvageValue, 0);
  const umur = Math.max(a.usefulLifeYears, 1);
  const tahunBerjalan = Math.max((tMs - new Date(a.acquisitionDate).getTime()) / TAHUN_MS, 0);
  const akum = Math.min((dasar / umur) * tahunBerjalan, dasar);
  return Math.max(a.acquisitionCost - akum, a.salvageValue);
}
const akhirTahun = (y: number) => new Date(y, 11, 31, 23, 59, 59).getTime();

const dioperasikan = (a: FixedAsset) => a.status === 'Active' || a.status === 'Under Maintenance';

// Baris Asset Management (subset kolom yang dipakai di sini).
interface BarisAm {
  id: string; site: string; namaBarang: string; jenis: string; merk: string; tipe: string;
  jumlah: number; alokasi: string; detailAlokasi: string; totalHarga: number; hargaEstimasi?: number;
}

// ── Potongan UI kecil ────────────────────────────────────────────────────
function Panel({ judul, baca, children, tinggi = 260 }: {
  judul: string; baca?: string; children: React.ReactNode; tinggi?: number | 'auto';
}) {
  return (
    <section className="glass-panel as-panel" aria-label={judul}>
      <h3 className="as-h3">{judul}</h3>
      {baca && <p className="as-baca">{baca}</p>}
      <div style={tinggi === 'auto' ? undefined : { height: tinggi }}>{children}</div>
    </section>
  );
}

function JudulBagian({ ikon: Ikon, teks, sub, aksi }: { ikon: React.ElementType; teks: string; sub?: string; aksi?: React.ReactNode }) {
  return (
    <div className="as-sec">
      <div style={{ minWidth: 0 }}>
        <div className="as-sec-t"><Ikon size={17} aria-hidden="true" /> {teks}</div>
        {sub && <div className="as-sec-s">{sub}</div>}
      </div>
      {aksi}
    </div>
  );
}

function Kosong({ teks }: { teks: string }) {
  return <div className="as-kosong">{teks}</div>;
}

interface Temuan { id: string; nada: Nada; ikon: React.ElementType; judul: string; rincian: string; aksi?: { label: string; klik: () => void } }

export const AS_CSS = `
.as-panel{border-radius:18px;padding:1rem 1.1rem;min-width:0}
.as-h3{margin:0;font-size:.84rem;font-weight:700;color:var(--txt-primary)}
.as-baca{margin:.2rem 0 .7rem;font-size:.72rem;line-height:1.5;color:var(--wr-txt-muted)}
.as-row{display:grid;gap:1rem;margin-bottom:1rem;grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))}
.as-sec{display:flex;align-items:flex-end;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin:1.6rem 0 .8rem}
.as-sec-t{display:flex;align-items:center;gap:.5rem;font-size:.95rem;font-weight:800;color:var(--txt-primary)}
.as-sec-s{font-size:.76rem;color:var(--wr-txt-muted);margin-top:2px}
.as-kosong{height:100%;min-height:90px;display:grid;place-items:center;text-align:center;padding:1rem;font-size:.8rem;color:var(--wr-txt-muted)}
.as-temuan{display:grid;grid-template-columns:auto 1fr auto;gap:.75rem;align-items:center;padding:.7rem .85rem;border-radius:14px;background:var(--wr-tab-bg);border:1px solid var(--wr-line)}
.as-temuan-i{width:34px;height:34px;border-radius:10px;display:grid;place-items:center}
.as-temuan-j{font-size:.82rem;font-weight:700;color:var(--txt-primary)}
.as-temuan-r{font-size:.74rem;color:var(--wr-txt-muted);margin-top:1px;line-height:1.45}
.as-link{display:inline-flex;align-items:center;gap:.35rem;padding:.4rem .75rem;border-radius:9px;font:inherit;font-size:.76rem;font-weight:700;cursor:pointer;white-space:nowrap;
  background:var(--wr-btn-bg);color:var(--txt-primary);border:1px solid var(--wr-field-border)}
.as-link:hover{background:var(--wr-btn-bg-hover)}
.as-link:focus-visible{outline:2px solid var(--wr-focus,#00D084);outline-offset:2px}
.as-tbl{width:100%;border-collapse:collapse;font-size:.8rem}
.as-tbl th{text-align:left;font-size:.67rem;letter-spacing:.05em;text-transform:uppercase;color:var(--wr-txt-muted);padding:.5rem .55rem;border-bottom:1px solid var(--wr-line);white-space:nowrap}
.as-tbl th.r,.as-tbl td.r{text-align:right}
.as-tbl td{padding:.55rem .55rem;border-bottom:1px solid var(--wr-line);vertical-align:middle;color:var(--txt-secondary)}
.as-tbl td.k{color:var(--txt-primary);font-weight:600}
.as-tbl tbody tr:last-child td{border-bottom:0}
.as-bar{height:6px;border-radius:99px;background:var(--wr-line);overflow:hidden;min-width:60px}
.as-bar>span{display:block;height:100%;border-radius:99px}
@keyframes as-spin{to{transform:rotate(360deg)}}
.as-spin{animation:as-spin .9s linear infinite}
@media (prefers-reduced-motion:reduce){.as-spin{animation:none}}
`;

// ── Komponen utama ───────────────────────────────────────────────────────
interface Props {
  auth: AuthState;
  fixedAssets: FixedAsset[];
  workOrders: WorkOrder[];
  /** Pindah tab; `perhatian` dipakai untuk membuka Register dengan filter terpasang. */
  onBuka: (tab: AsetTab, perhatian?: Perhatian) => void;
}

export function AsetRingkasan({ auth, fixedAssets, workOrders, onBuka }: Props) {
  const { W } = useWrTema();

  // ── Asset Management (sheet) — ditarik sekali saat tab dibuka ─────────
  const siteTerkunci = auth.role !== 'Super Admin' && auth.assignedSite !== 'global';
  const siteAm = siteTerkunci ? auth.assignedSite : 'global';
  const [am, setAm] = useState<BarisAm[]>([]);
  const [amMemuat, setAmMemuat] = useState(true);
  const [amError, setAmError] = useState('');
  useEffect(() => {
    let batal = false;
    setAmMemuat(true);
    api.get<BarisAm[]>(`/weekly-reports?${new URLSearchParams({ site: siteAm, direction: 'ASET' })}`)
      .then((d) => { if (!batal) { setAm(d); setAmError(''); } })
      .catch((e: unknown) => { if (!batal) setAmError(e instanceof Error ? e.message : 'Gagal memuat Asset Management.'); })
      .finally(() => { if (!batal) setAmMemuat(false); });
    return () => { batal = true; };
  }, [siteAm]);

  // ── Aset tetap ─────────────────────────────────────────────────────────
  const f = useMemo(() => {
    const bernilai = fixedAssets.filter((a) => a.status !== 'Disposed');   // Disposed sudah dilepas
    const ops = fixedAssets.filter(dioperasikan);
    const perolehan = bernilai.reduce((t, a) => t + a.acquisitionCost, 0);
    const buku = bernilai.reduce((t, a) => t + a.bookValue, 0);
    const akumulasi = bernilai.reduce((t, a) => t + a.accumulatedDepreciation, 0);
    const bebanTahun = bernilai.filter((a) => !a.fullyDepreciated && a.status !== 'Retired').reduce((t, a) => t + a.annualDepreciation, 0);

    const perKategori = new Map<string, { jumlah: number; perolehan: number; buku: number; akum: number; dasar: number }>();
    const perSite = new Map<string, { jumlah: number; perolehan: number; buku: number }>();
    for (const a of bernilai) {
      const k = perKategori.get(a.category) ?? { jumlah: 0, perolehan: 0, buku: 0, akum: 0, dasar: 0 };
      k.jumlah += 1; k.perolehan += a.acquisitionCost; k.buku += a.bookValue; k.akum += a.accumulatedDepreciation;
      k.dasar += Math.max(a.acquisitionCost - a.salvageValue, 0);
      perKategori.set(a.category, k);
      const s = perSite.get(a.site) ?? { jumlah: 0, perolehan: 0, buku: 0 };
      s.jumlah += 1; s.perolehan += a.acquisitionCost; s.buku += a.bookValue;
      perSite.set(a.site, s);
    }
    const kategori = [...perKategori.entries()].map(([nama, v]) => ({ nama, ...v, persenSusut: v.dasar > 0 ? Math.round((v.akum / v.dasar) * 100) : 0 }))
      .sort((a, b) => b.perolehan - a.perolehan);
    const site = [...perSite.entries()].map(([key, v]) => ({ key, nama: labelSiteDariKey(key), ...v }))
      .sort((a, b) => b.perolehan - a.perolehan);

    // Profil umur: sebaran aset yang masih dioperasikan menurut persentase penyusutan.
    const lapis = [
      { nama: '0–25%', ket: 'Baru', warna: W['--wr-in'], n: 0 },
      { nama: '25–50%', ket: 'Muda', warna: W['--wr-info'], n: 0 },
      { nama: '50–75%', ket: 'Menengah', warna: W['--wr-warn'], n: 0 },
      { nama: '75–<100%', ket: 'Hampir habis', warna: W['--wr-out'], n: 0 },
      { nama: 'Habis', ket: 'Habis disusutkan', warna: W['--wr-neg'], n: 0 },
    ];
    for (const a of ops) {
      const i = a.fullyDepreciated ? 4 : a.depreciationPct < 25 ? 0 : a.depreciationPct < 50 ? 1 : a.depreciationPct < 75 ? 2 : 3;
      lapis[i].n += 1;
    }

    // Proyeksi: nilai buku akhir tahun & beban per tahun kalender untuk aset yang masih dioperasikan.
    const y0 = new Date().getFullYear();
    const proyeksi = Array.from({ length: 6 }, (_, i) => {
      const y = y0 + i;
      const buku1 = ops.reduce((t, a) => t + nilaiBukuPada(a, akhirTahun(y)), 0);
      const buku0 = ops.reduce((t, a) => t + nilaiBukuPada(a, akhirTahun(y - 1)), 0);
      return { tahun: String(y), 'Nilai Buku': Math.round(buku1), 'Beban Penyusutan': Math.round(Math.max(buku0 - buku1, 0)) };
    });

    const statusJumlah = { Active: 0, 'Under Maintenance': 0, Retired: 0, Disposed: 0 } as Record<FixedAsset['status'], number>;
    for (const a of fixedAssets) statusJumlah[a.status] += 1;

    const nilaiTertinggi = [...bernilai].sort((a, b) => b.bookValue - a.bookValue).slice(0, 5);
    const segeraHabis = ops.filter((a) => !a.fullyDepreciated && sisaUmurTahun(a) < 1)
      .sort((a, b) => sisaUmurTahun(a) - sisaUmurTahun(b));

    const habisMasihDipakai = ops.filter((a) => a.fullyDepreciated);
    const garansiSegera = ops.filter((a) => infoGaransi(a).status === 'segera');
    const woTelat = new Set(workOrders.filter((w) => WO_TERBUKA(statusWo(w)) && statusWo(w) === 'Overdue').map((w) => w.assetId));
    const asetWoTelat = ops.filter((a) => woTelat.has(a.id));

    return {
      jumlah: fixedAssets.length, perolehan, buku, akumulasi, bebanTahun,
      pctBuku: perolehan > 0 ? Math.round((buku / perolehan) * 100) : 0,
      kategori, site, lapis, proyeksi, statusJumlah, nilaiTertinggi, segeraHabis,
      habisMasihDipakai, garansiSegera, asetWoTelat, ops: ops.length,
    };
  }, [fixedAssets, workOrders, W]);

  // ── Asset Management ───────────────────────────────────────────────────
  const m = useMemo(() => {
    const baris = tambahKlasifikasi(am);
    const nilaiTercatat = am.reduce((t, r) => t + r.totalHarga, 0);
    const nilaiEstimasi = am.reduce((t, r) => t + (r.totalHarga ? 0 : r.hargaEstimasi ?? 0), 0);
    const perLokasi = new Map<string, number>();
    for (const r of am) perLokasi.set(r.alokasi || 'Tanpa lokasi', (perLokasi.get(r.alokasi || 'Tanpa lokasi') ?? 0) + 1);
    const lokasi = [...perLokasi.entries()].map(([nama, jumlah]) => ({ nama, 'Jumlah Aset': jumlah })).sort((a, b) => b['Jumlah Aset'] - a['Jumlah Aset']);
    return {
      jumlah: am.length,
      unit: am.reduce((t, r) => t + r.jumlah, 0),
      nilaiTercatat, nilaiEstimasi, nilai: nilaiTercatat + nilaiEstimasi,
      lokasi, jumlahLokasi: lokasi.length,
      klas: ringkasKlasifikasi(baris),
      takDikenal: jenisTakDikenal(baris),
      belumKlas: baris.filter((r) => r.kelas === 'Belum Terklasifikasi').length,
      tanpaHarga: am.filter((r) => !r.totalHarga && !r.hargaEstimasi).length,
      termahal: [...baris].sort((a, b) => nilaiBaris(b) - nilaiBaris(a)).slice(0, 5),
    };
  }, [am]);

  // ── Temuan otomatis ────────────────────────────────────────────────────
  const temuan = useMemo<Temuan[]>(() => {
    const t: Temuan[] = [];
    if (f.habisMasihDipakai.length) {
      const nilai = f.habisMasihDipakai.reduce((s, a) => s + a.acquisitionCost, 0);
      t.push({
        id: 'habis', nada: NADA.neg, ikon: Hourglass,
        judul: `${f.habisMasihDipakai.length} aset sudah habis disusutkan tetapi masih dipakai`,
        rincian: `Nilai perolehan ${rupiahRingkas(nilai)}. Pertimbangkan peremajaan, penilaian ulang umur manfaat, atau rencana penggantian.`,
        aksi: { label: 'Tinjau', klik: () => onBuka('REGISTER', 'habis') },
      });
    }
    if (f.asetWoTelat.length) {
      t.push({
        id: 'wo', nada: NADA.neg, ikon: Wrench,
        judul: `${f.asetWoTelat.length} aset punya pekerjaan maintenance yang terlambat`,
        rincian: 'Pekerjaan sudah melewati tenggat dan belum selesai. Aset dengan perawatan tertunda berisiko turun kondisinya.',
        aksi: { label: 'Tinjau', klik: () => onBuka('REGISTER', 'telat') },
      });
    }
    if (f.segeraHabis.length) {
      t.push({
        id: 'segera', nada: NADA.warn, ikon: AlertTriangle,
        judul: `${f.segeraHabis.length} aset akan habis disusutkan dalam 12 bulan`,
        rincian: `Terdekat: ${f.segeraHabis[0].name} (${f.segeraHabis[0].assetCode}). Siapkan anggaran penggantian atau evaluasi umur manfaat.`,
        aksi: { label: 'Lihat daftar', klik: () => onBuka('REGISTER') },
      });
    }
    if (f.garansiSegera.length) {
      t.push({
        id: 'garansi', nada: NADA.warn, ikon: ShieldAlert,
        judul: `${f.garansiSegera.length} aset garansinya berakhir ≤ 90 hari`,
        rincian: 'Manfaatkan sisa garansi untuk inspeksi atau klaim sebelum masa berlaku habis.',
        aksi: { label: 'Tinjau', klik: () => onBuka('REGISTER', 'garansi') },
      });
    }
    const terbesar = f.kategori[0];
    if (terbesar && f.perolehan > 0 && f.kategori.length > 1) {
      const porsi = Math.round((terbesar.perolehan / f.perolehan) * 100);
      if (porsi >= 50) {
        t.push({
          id: 'konsentrasi', nada: NADA.info, ikon: Layers,
          judul: `Kategori “${terbesar.nama}” menyumbang ${porsi}% nilai perolehan`,
          rincian: 'Nilai aset terkonsentrasi pada satu kategori — perhatikan risiko operasional dan kebutuhan penggantiannya.',
        });
      }
    }
    if (m.belumKlas > 0) {
      t.push({
        id: 'belumklas', nada: NADA.info, ikon: Boxes,
        judul: `${m.belumKlas} item Asset Management belum terklasifikasi`,
        rincian: 'Jenis pada sheet belum dikenali aturan Equipment/Building, sehingga belum masuk rangkuman per kelas.',
        aksi: { label: 'Buka Asset Management', klik: () => onBuka('ASSET_MGMT') },
      });
    }
    if (m.tanpaHarga > 0) {
      t.push({
        id: 'tanpaharga', nada: NADA.info, ikon: Banknote,
        judul: `${m.tanpaHarga} item Asset Management belum punya harga`,
        rincian: 'Item ini tidak ikut terhitung dalam nilai aset sehingga total nilai bisa lebih rendah dari kenyataan.',
        aksi: { label: 'Buka Asset Management', klik: () => onBuka('ASSET_MGMT') },
      });
    }
    return t;
  }, [f, m, onBuka]);

  const ekspor = () => unduhCsv(`ringkasan-aset-${hariIni()}.csv`, [
    ['RINGKASAN ASET TETAP'],
    ['Jumlah aset', f.jumlah], ['Nilai perolehan', f.perolehan], ['Nilai buku', f.buku], ['Akumulasi penyusutan', f.akumulasi], ['Beban penyusutan / tahun', f.bebanTahun],
    [],
    ['PER KATEGORI'], ['Kategori', 'Jumlah', 'Nilai Perolehan', 'Nilai Buku', 'Akumulasi Penyusutan', 'Penyusutan %'],
    ...f.kategori.map((k) => [k.nama, k.jumlah, k.perolehan, k.buku, k.akum, k.persenSusut]),
    [],
    ['PER SITE'], ['Site', 'Jumlah', 'Nilai Perolehan', 'Nilai Buku'],
    ...f.site.map((s) => [s.nama, s.jumlah, s.perolehan, s.buku]),
    [],
    ['PROYEKSI'], ['Tahun', 'Nilai Buku Akhir Tahun', 'Beban Penyusutan'],
    ...f.proyeksi.map((p) => [p.tahun, p['Nilai Buku'], p['Beban Penyusutan']]),
    [],
    ['ASSET MANAGEMENT'], ['Item terdaftar', m.jumlah], ['Total unit', m.unit], ['Nilai tercatat', m.nilaiTercatat], ['Nilai estimasi', m.nilaiEstimasi],
    ...m.klas.flatMap((k) => [[`Kelas ${k.kelas}`, k.jumlahAset, k.nilai], ...k.subs.map((s) => [`  ${s.nama}`, s.jumlahAset, s.nilai])]),
  ]);

  const adaAset = fixedAssets.length > 0;
  const sumbuStyle = { fontSize: 11, fill: W['--wr-txt-muted'] };

  return (
    <>
      <style>{AS_CSS}</style>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '.7rem' }}>
        <button type="button" className="wr-btn eam-btn" onClick={ekspor} title="Unduh ringkasan ini sebagai CSV"><Download size={16} /> Export Ringkasan</button>
      </div>

      {/* ── 1. Angka kunci ── */}
      <div className="eam-kpis">
        <KpiKartu ikon={Boxes} warna="#00D084" label="Aset Tetap" nilai={angka(f.jumlah)}
          sub={`${f.statusJumlah.Active} aktif · ${f.statusJumlah['Under Maintenance']} maintenance · ${f.statusJumlah.Retired} retired`} onKlik={() => onBuka('REGISTER')} />
        <KpiKartu ikon={Wallet} warna="#60A5FA" label="Nilai Perolehan" nilai={rupiahRingkas(f.perolehan)} sub="harga beli awal, tanpa aset Disposed" />
        <KpiKartu ikon={ShieldCheck} warna="#34D399" label="Nilai Buku" nilai={rupiahRingkas(f.buku)} nilaiWarna="#34D399" sub={`${f.pctBuku}% dari nilai perolehan`} />
        <KpiKartu ikon={TrendingDown} warna="#F59E0B" label="Beban Penyusutan / Tahun" nilai={rupiahRingkas(f.bebanTahun)} sub={`akumulasi ${rupiahRingkas(f.akumulasi)}`} />
        <KpiKartu ikon={Package} warna="#A78BFA" label="Asset Management" nilai={amMemuat ? '…' : angka(m.jumlah)}
          sub={amMemuat ? 'memuat data' : `${angka(m.unit)} unit · ${rupiahRingkas(m.nilai)}`} onKlik={() => onBuka('ASSET_MGMT')} />
      </div>

      {!adaAset && (
        <div className="glass-panel as-panel" style={{ marginBottom: '1rem' }}>
          <Kosong teks="Belum ada aset tetap terdaftar. Buka tab Register & Depresiasi lalu pilih “Daftarkan Aset” — grafik dan temuan di bawah akan terisi otomatis." />
        </div>
      )}

      {/* ── 2. Temuan ── */}
      <JudulBagian ikon={Lightbulb} teks="Temuan untuk ditindaklanjuti" sub="Dihitung otomatis dari data saat ini — urut dari yang paling mendesak." />
      <div className="glass-panel as-panel" style={{ display: 'grid', gap: '.6rem' }}>
        {temuan.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', fontSize: '.84rem', color: NADA.in.teks }}>
            <CheckCircle2 size={18} aria-hidden="true" /> Tidak ada temuan yang perlu perhatian saat ini.
          </div>
        ) : temuan.map((x) => {
          const Ikon = x.ikon;
          return (
            <div key={x.id} className="as-temuan">
              <span className="as-temuan-i" style={{ background: x.nada.bg, color: x.nada.teks, border: `1px solid ${x.nada.garis}` }}><Ikon size={17} aria-hidden="true" /></span>
              <div style={{ minWidth: 0 }}>
                <div className="as-temuan-j">{x.judul}</div>
                <div className="as-temuan-r">{x.rincian}</div>
              </div>
              {x.aksi && <button type="button" className="as-link" onClick={x.aksi.klik}>{x.aksi.label} <ArrowRight size={13} aria-hidden="true" /></button>}
            </div>
          );
        })}
      </div>

      {/* ── 3. Analisis aset tetap ── */}
      <JudulBagian ikon={TrendingDown} teks="Analisis Aset Tetap & Depresiasi" sub="Nilai aset menurut kategori, lokasi, usia, dan perkiraan ke depan." />
      <div className="as-row">
        <Panel judul="Nilai Perolehan vs Nilai Buku per Kategori" baca="Batang biru = harga beli, hijau = nilai tercatat saat ini. Semakin pendek batang hijau dibanding biru, semakin besar kategori itu sudah disusutkan." tinggi={290}>
          {f.kategori.length === 0 ? <Kosong teks="Belum ada data kategori." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={f.kategori.slice(0, 8).map((k) => ({ nama: potong(k.nama, 14), 'Nilai Perolehan': k.perolehan, 'Nilai Buku': k.buku }))} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                <XAxis dataKey="nama" tick={sumbuStyle} axisLine={false} tickLine={false} interval={0} />
                <YAxis tickFormatter={tickRupiah} tick={sumbuStyle} axisLine={false} tickLine={false} width={50} />
                <Tooltip {...tooltipProps} formatter={fmtTooltip} cursor={{ fill: W['--wr-cursor-fill'] }} />
                <Legend wrapperStyle={{ fontSize: '.72rem' }} formatter={fmtLegend} />
                <Bar dataKey="Nilai Perolehan" fill={W['--wr-info']} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Nilai Buku" fill={W['--wr-in']} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel judul="Proyeksi Nilai Buku & Beban Penyusutan" baca="Batang = beban penyusutan tiap tahun kalender, garis = nilai buku di akhir tahun. Dihitung dari aset yang masih dioperasikan dengan metode garis lurus; aset baru belum termasuk." tinggi={290}>
          {f.ops === 0 ? <Kosong teks="Belum ada aset aktif untuk diproyeksikan." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={f.proyeksi} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                <XAxis dataKey="tahun" tick={sumbuStyle} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={tickRupiah} tick={sumbuStyle} axisLine={false} tickLine={false} width={50} />
                <Tooltip {...tooltipProps} formatter={fmtTooltip} cursor={{ fill: W['--wr-cursor-fill'] }} />
                <Legend wrapperStyle={{ fontSize: '.72rem' }} formatter={fmtLegend} />
                <Bar dataKey="Beban Penyusutan" fill={W['--wr-warn']} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="Nilai Buku" stroke={W['--wr-in']} strokeWidth={2.6} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="as-row">
        <Panel judul="Nilai Aset per Site" baca="Perbandingan harga beli dan nilai buku di tiap lokasi — menunjukkan site mana yang memegang aset terbesar." tinggi={Math.max(200, f.site.length * 46 + 50)}>
          {f.site.length === 0 ? <Kosong teks="Belum ada data site." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={f.site.map((s) => ({ nama: s.nama, 'Nilai Perolehan': s.perolehan, 'Nilai Buku': s.buku }))} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} horizontal={false} />
                <XAxis type="number" tickFormatter={tickRupiah} tick={sumbuStyle} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="nama" tick={sumbuStyle} axisLine={false} tickLine={false} width={96} />
                <Tooltip {...tooltipProps} formatter={fmtTooltip} cursor={{ fill: W['--wr-cursor-fill'] }} />
                <Legend wrapperStyle={{ fontSize: '.72rem' }} formatter={fmtLegend} />
                <Bar dataKey="Nilai Perolehan" fill={W['--wr-info']} radius={[0, 4, 4, 0]} />
                <Bar dataKey="Nilai Buku" fill={W['--wr-in']} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel judul="Profil Usia Aset" baca="Jumlah aset yang masih dioperasikan menurut seberapa jauh sudah disusutkan. Makin banyak di sisi kanan, makin dekat kebutuhan peremajaan." tinggi={Math.max(200, f.site.length * 46 + 50)}>
          {f.ops === 0 ? <Kosong teks="Belum ada aset aktif." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={f.lapis.map((l) => ({ nama: l.nama, 'Jumlah Aset': l.n, warna: l.warna }))} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                <XAxis dataKey="nama" tick={sumbuStyle} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={sumbuStyle} axisLine={false} tickLine={false} width={34} />
                <Tooltip {...tooltipProps} cursor={{ fill: W['--wr-cursor-fill'] }} />
                <Bar dataKey="Jumlah Aset" radius={[4, 4, 0, 0]}>
                  {f.lapis.map((l) => <Cell key={l.nama} fill={l.warna} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="as-row">
        <Panel judul="5 Aset dengan Nilai Buku Tertinggi" baca="Aset yang paling besar menopang nilai tercatat." tinggi="auto">
          {f.nilaiTertinggi.length === 0 ? <Kosong teks="Belum ada aset." /> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="as-tbl">
                <thead><tr><th>Aset</th><th>Site</th><th className="r">Nilai Buku</th><th>Disusutkan</th></tr></thead>
                <tbody>
                  {f.nilaiTertinggi.map((a) => (
                    <tr key={a.id}>
                      <td className="k"><span style={{ fontFamily: 'monospace', fontSize: '.7rem', color: '#00D084' }}>{a.assetCode}</span><br />{a.name}</td>
                      <td>{labelSiteDariKey(a.site)}</td>
                      <td className="r k">{rp(a.bookValue)}</td>
                      <td style={{ minWidth: 100 }}>
                        <div className="as-bar"><span style={{ width: `${a.depreciationPct}%`, background: a.fullyDepreciated ? W['--wr-neg'] : W['--wr-warn'] }} /></div>
                        <span style={{ fontSize: '.7rem' }}>{a.depreciationPct}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel judul="Segera Habis Disusutkan (≤ 12 Bulan)" baca="Aset yang masa manfaat ekonomisnya hampir selesai — kandidat anggaran penggantian." tinggi="auto">
          {f.segeraHabis.length === 0 ? <Kosong teks="Tidak ada aset yang habis disusutkan dalam 12 bulan ke depan." /> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="as-tbl">
                <thead><tr><th>Aset</th><th>Site</th><th className="r">Nilai Buku</th><th className="r">Sisa Umur</th></tr></thead>
                <tbody>
                  {f.segeraHabis.slice(0, 5).map((a) => (
                    <tr key={a.id}>
                      <td className="k"><span style={{ fontFamily: 'monospace', fontSize: '.7rem', color: '#00D084' }}>{a.assetCode}</span><br />{a.name}</td>
                      <td>{labelSiteDariKey(a.site)}</td>
                      <td className="r">{rp(a.bookValue)}</td>
                      <td className="r"><Pil warna={W['--wr-warn']} bg="rgba(251,191,36,.14)">{Math.max(Math.round(sisaUmurTahun(a) * 12), 1)} bln</Pil></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {f.segeraHabis.length > 5 && <div style={{ fontSize: '.72rem', color: 'var(--wr-txt-muted)', paddingTop: '.5rem' }}>+ {f.segeraHabis.length - 5} aset lainnya di tab Register.</div>}
            </div>
          )}
        </Panel>
      </div>

      <div className="glass-panel as-panel" style={{ marginBottom: '1rem' }}>
        <h3 className="as-h3">Rincian per Kategori</h3>
        <p className="as-baca">Kolom “Disusutkan” = akumulasi penyusutan ÷ nilai yang bisa disusutkan (nilai perolehan dikurangi nilai sisa).</p>
        {f.kategori.length === 0 ? <Kosong teks="Belum ada data." /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="as-tbl" style={{ minWidth: 640 }}>
              <thead><tr><th>Kategori</th><th className="r">Aset</th><th className="r">Nilai Perolehan</th><th className="r">Nilai Buku</th><th>Disusutkan</th></tr></thead>
              <tbody>
                {f.kategori.map((k) => (
                  <tr key={k.nama}>
                    <td className="k">{k.nama}</td>
                    <td className="r">{angka(k.jumlah)}</td>
                    <td className="r">{rp(k.perolehan)}</td>
                    <td className="r k">{rp(k.buku)}</td>
                    <td style={{ minWidth: 130 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                        <div className="as-bar" style={{ flex: 1 }}><span style={{ width: `${k.persenSusut}%`, background: k.persenSusut >= 90 ? W['--wr-neg'] : W['--wr-warn'] }} /></div>
                        <span style={{ fontSize: '.72rem', fontWeight: 700 }}>{k.persenSusut}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 4. Rangkuman Asset Management ── */}
      <JudulBagian ikon={Package} teks="Rangkuman Asset Management" sub={`Daftar aset dari sheet “LIST ALL ASET”${siteTerkunci ? ` — site ${labelSiteDariKey(auth.assignedSite)}` : ' — seluruh site'}. Detail lengkap ada di tab Asset Management.`}
        aksi={<button type="button" className="as-link" onClick={() => onBuka('ASSET_MGMT')}>Buka detail <ArrowRight size={13} aria-hidden="true" /></button>} />

      {amMemuat ? (
        <div className="glass-panel as-panel"><div className="as-kosong"><span style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem' }}><Loader2 size={16} className="as-spin" aria-hidden="true" /> Memuat Asset Management…</span></div></div>
      ) : amError ? (
        <div className="glass-panel as-panel"><div className="as-kosong" style={{ color: NADA.neg.teks }}>{amError}</div></div>
      ) : m.jumlah === 0 ? (
        <div className="glass-panel as-panel"><Kosong teks="Belum ada data Asset Management. Sinkronkan sheet-nya di tab Asset Management." /></div>
      ) : (
        <>
          <div className="eam-kpis">
            <KpiKartu ikon={Package} warna="#A78BFA" label="Item Terdaftar" nilai={angka(m.jumlah)} sub={`${angka(m.unit)} unit`} />
            <KpiKartu ikon={MapPin} warna="#60A5FA" label="Lokasi" nilai={angka(m.jumlahLokasi)} sub="lokasi penyimpanan/penggunaan" />
            <KpiKartu ikon={Banknote} warna="#34D399" label="Nilai Tercatat" nilai={rupiahRingkas(m.nilaiTercatat)} sub="dari harga pada sheet" />
            <KpiKartu ikon={Wallet} warna="#F59E0B" label="Nilai Estimasi" nilai={rupiahRingkas(m.nilaiEstimasi)} sub="item tanpa harga, memakai estimasi" />
          </div>

          <div className="as-row" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px,100%),1fr))' }}>
            {m.klas.map((k) => (
              <KartuKelas key={k.kelas} data={k} kelasAktif={null} subAktif={null} fmtNilai={rupiahRingkas}
                jenisTakDikenal={m.takDikenal} onPilih={() => onBuka('ASSET_MGMT')} />
            ))}
          </div>

          <div className="as-row">
            <Panel judul="Jumlah Aset per Lokasi" baca="Delapan lokasi dengan aset terbanyak." tinggi={Math.max(180, Math.min(m.lokasi.length, 8) * 36 + 40)}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={m.lokasi.slice(0, 8).map((l) => ({ ...l, nama: potong(l.nama, 22) }))} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={sumbuStyle} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="nama" tick={sumbuStyle} axisLine={false} tickLine={false} width={120} />
                  <Tooltip {...tooltipProps} cursor={{ fill: W['--wr-cursor-fill'] }} />
                  <Bar dataKey="Jumlah Aset" fill={W['--wr-aset']} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel judul="5 Item dengan Nilai Tertinggi" baca="Nilai tercatat, atau estimasi bila sheet tidak punya harga." tinggi="auto">
              <div style={{ overflowX: 'auto' }}>
                <table className="as-tbl">
                  <thead><tr><th>Barang</th><th>Kategori</th><th className="r">Nilai</th></tr></thead>
                  <tbody>
                    {m.termahal.map((r) => (
                      <tr key={r.id}>
                        <td className="k">{r.namaBarang}<br /><span style={{ fontSize: '.7rem', fontWeight: 400, color: 'var(--wr-txt-muted)' }}>{r.alokasi}</span></td>
                        <td><BadgeKategori kelas={r.kelas} sub={r.sub} /></td>
                        <td className="r k">{rp(nilaiBaris(r))}{!r.totalHarga && r.hargaEstimasi ? <span title="Estimasi" style={{ color: 'var(--wr-txt-muted)' }}> *</span> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}