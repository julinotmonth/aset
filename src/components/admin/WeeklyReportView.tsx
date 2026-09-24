// Laporan Mingguan Barang Masuk / Keluar per Site.
//
// Dua mode yang sengaja dipisah, karena maknanya berbeda:
//  • BARANG KELUAR — pivot biaya seperti template Excel
//    "REPORT_<BULAN>_MS_<SITE>.xlsx": empat seksi (Part Maintenance,
//    Penggunaan Part OH, Consumption OLI, Lain-Lain), baris = Alokasi,
//    kolom = nomor minggu, ditutup Grand Total + Rp/m3.
//  • BARANG MASUK — ringkasan penerimaan: nilai & kuantitas yang diterima
//    per minggu dan per kategori, bukan pivot biaya pemakaian.
import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react';
import type { CSSProperties } from 'react';
import {
  RefreshCw, Upload, Link2, Download, AlertTriangle, CheckCircle2, Loader2,
  TrendingDown, TrendingUp, Package, Boxes, ClipboardList,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { AuthState } from '../../types';
import { api } from '../../lib/api';
import { getSites } from '../../data/siteStore';
import { PicaView } from './PicaView';

// ── Tipe ──────────────────────────────────────────────────────────────────
type Section = 'MAINT' | 'OH' | 'OLI' | 'LAIN';

interface WeeklyRow {
  id: string; site: string; direction: 'IN' | 'OUT' | 'ASET'; sourceTab: string;
  tanggal: string | null; minggu: number; bulan: number; tahun: number;
  kode: string; namaBarang: string; jumlah: number; satuan: string;
  alokasi: string; detailAlokasi: string; pic: string;
  harga: number; totalHarga: number; noMr: string; genBus: string;
  statusSmr: string; noShipment: string; keterangan: string; section: Section;
  jenis: string; merk: string; tipe: string; hargaEstimasi?: number;
}

interface SheetSource {
  site: string; sheetId: string; tabs: string[];
  autoSync: boolean; lastSyncAt: string | null; lastStatus: string;
}

// ── Konstanta layout laporan ──────────────────────────────────────────────
const SECTIONS: { key: Section; judul: string; totalLabel: string; warna: string }[] = [
  { key: 'MAINT', judul: 'Part Maintenance Per-Week', totalLabel: 'Total Harga', warna: '#00D084' },
  { key: 'OH', judul: 'Penggunaan Part OH Per-Week', totalLabel: 'Total Harga OH', warna: '#60A5FA' },
  { key: 'OLI', judul: 'Consumption OLI Per-Week', totalLabel: 'Total Harga Comp OLI', warna: '#FBBF24' },
  { key: 'LAIN', judul: 'Lain-Lain Per-Week', totalLabel: 'Total Harga Lain-Lain', warna: '#C084FC' },
];

const LABEL_SEKSI: Record<Section, string> = {
  MAINT: 'Part Maintenance', OH: 'Overhold', OLI: 'Consumption OLI', LAIN: 'Lain-Lain',
};

// Kategori generik yang wajar ada di semua site (bukan model mesin
// spesifik), jadi tetap ditampilkan sebagai baris meski belum terpakai
// bulan ini — supaya format laporan tetap sebanding antar bulan.
//
// SENGAJA TIDAK memuat nama unit Compressor/Gas Engine tertentu (dulu di
// sini ada "Compressor Ariel 1-3"/"Gas Engine Caterpillar 1-3" — itu
// peralatan MS Wunut). Tiap site punya armada beda (MS Setu misalnya pakai
// Compressor Ariel 1-2 + Enric, dan Gas Engine Doosan, bukan Caterpillar),
// jadi baris compressor/gas-engine sekarang murni ikut apa yang benar-benar
// ada di data site tersebut (lihat urutkanBarisSeksi di bawah) — otomatis
// benar untuk site manapun tanpa perlu di-hardcode manual per site.
const BARIS_UNIVERSAL: Record<Section, string[]> = {
  MAINT: ['Air Compressor', 'Dispenser Filling Post', 'Dryer Xebec', 'Control Panel', 'Genset', 'OTHER', 'Metering'],
  OH: ['Dryer'],
  OLI: ['Dryer'],
  LAIN: ['Jasa Service & Repair', 'Jasa New Instalasi', 'Jasa Kalibrasi', 'Sedot Limbah B3',
    'Jasa Analisa GAS', 'Jasa Analisa OLI', 'OTHERS'],
};

/**
 * Susun ulang baris sebuah seksi: semua "Compressor ..." dulu (diurutkan
 * alami, jadi "Ariel 1" sebelum "Ariel 2"/"Enric"), lalu semua
 * "Gas Engine ...", baru kategori universal (urutan tetap sesuai
 * BARIS_UNIVERSAL), dan sisanya (alokasi lain yang tak terduga) di paling
 * bawah — supaya nama mesin apapun yang muncul di data (site manapun)
 * otomatis rapi tanpa perlu daftar hardcode per site.
 */
function urutkanBarisSeksi(seksi: Section, keys: string[]): string[] {
  const cmp = (a: string, b: string) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' });
  // Diawali kata Compressor/Gas Engine, BUKAN cuma "mengandung" — supaya
  // kategori generik seperti "Air Compressor" (bukan unit compressor
  // bernomor, cuma nama kategori) tidak ikut tersedot ke bucket ini.
  const compressor = keys.filter((k) => /^compressor\b/i.test(k)).sort(cmp);
  const gasEngine = keys.filter((k) => /^gas engine\b/i.test(k)).sort(cmp);
  const sudahDipakai = new Set([...compressor, ...gasEngine]);
  const universal = BARIS_UNIVERSAL[seksi].filter((k) => keys.includes(k) && !sudahDipakai.has(k));
  universal.forEach((k) => sudahDipakai.add(k));
  const lainnya = keys.filter((k) => !sudahDipakai.has(k)).sort(cmp);
  return [...compressor, ...gasEngine, ...universal, ...lainnya];
}

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const PALET = ['#00D084', '#60A5FA', '#FBBF24', '#C084FC', '#F472B6', '#38BDF8', '#A3E635', '#F87171'];

const rupiah = (n: number) => (n === 0 ? '-' : `Rp ${Math.round(n).toLocaleString('id-ID')}`);
const rupiahPenuh = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

// Sebagian besar site berlabel polos ("Wunut", "Setu") jadi ditampilkan
// pakai prefix "MS" biar konsisten dengan sebutan sehari-hari ("MS Wunut").
// Tapi tidak semua site adalah Mother Station — mis. WS Dawuan — yang
// labelnya sudah menyertakan prefix sendiri. Jangan dobel jadi "MS WS
// Dawuan": kalau label sudah diawali "MS"/"WS", pakai apa adanya.
const labelPenuh = (label: string) => (/^\s*(ms|ws)\b/i.test(label) ? label : `MS ${label}`);

// Sebagian site (WS Dawuan/"indramayu") itu bengkel armada kendaraan, bukan
// fasilitas dengan mesin tetap — kolom Alokasi-nya diisi PLAT KENDARAAN yang
// jumlahnya puluhan dan berubah tiap minggu (truk baru masuk servis, dst),
// beda dari Wunut/Setu/Blora yang Alokasi-nya nama mesin tetap (jumlahnya
// kecil & stabil). Kalau tetap dipivot per Alokasi, tabelnya jadi sangat
// panjang dan kurang berguna untuk dibaca manajemen. Untuk site semacam ini,
// dipivot per "Detail Alokasi" (jenis kegiatan: Service berkala, Overhaul,
// dll) yang jumlahnya jauh lebih sedikit dan lebih bermakna dibaca.
const SITE_KELOMPOK_KEGIATAN = new Set<string>(['indramayu']);

/** Kunci baris pivot untuk satu baris data: Alokasi (default) atau Detail
 * Alokasi (site di SITE_KELOMPOK_KEGIATAN). Detail Alokasi kosong ditandai
 * eksplisit alih-alih dibiarkan jadi baris tanpa label. */
function kunciBarisPivot(r: WeeklyRow): string {
  if (!SITE_KELOMPOK_KEGIATAN.has(r.site)) return r.alokasi;
  return r.detailAlokasi.trim() || '(Tanpa Detail Alokasi)';
}
/** Formatter tooltip recharts — nilainya bertipe longgar, jadi dinormalkan dulu. */
const fmtTooltip = (v: unknown) => rupiahPenuh(Number(v) || 0);

/** 12.500.000 → "Rp 12,5 jt" — supaya sumbu grafik tidak penuh angka nol. */
const ringkas = (n: number) => {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)} M`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)} jt`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)} rb`;
  return String(Math.round(n));
};

// Pra-isi nama tab di panel "Sumber Sheet" saat site belum pernah
// dikonfigurasi. Ini cuma tebakan awal yang bisa diedit admin — bukan
// aturan wajib — tapi disesuaikan per site kalau polanya sudah diketahui
// beda, supaya admin tidak perlu ketik ulang dari nol.
const TAB_DEFAULT = (site: string) => {
  const s = site.toUpperCase();
  if (site === 'setu') {
    // MS Setu menamai tab pakai Bahasa Indonesia ("Barang Masuk/Keluar"),
    // bukan pola "... RDA IN/OUT" seperti Wunut.
    return [`Barang Keluar - RDA SETU`, `Barang Masuk - RDA SETU`,
      `Barang Masuk - RCE SETU`, `Barang Keluar - RCE SETU`];
  }
  if (site === 'blora') {
    // MS Blora tidak memisah RDA/RCE — cuma dua tab polos "out" dan "in".
    return ['out', 'in'];
  }
  if (site === 'kht') {
    // MS KHT punya 4 tab: RDA (In, Out) + RCE (In (1), Out (1)) — bukan
    // cuma 2 seperti dugaan awal. Cek ulang ke admin kalau urutan/nama
    // "(1)"-nya berubah di sheet aslinya.
    return ['Out', 'In', 'Out (1)', 'In (1)'];
  }
  if (site === 'indramayu') {
    // WS Dawuan (key tetap "indramayu") juga cuma dua tab polos "Out"/"In",
    // sama seperti MS Blora — bukan pola "Report Weekly MS ... RDA OUT".
    return ['Out', 'In'];
  }
  return [`Report Weekly MS ${s} RDA OUT`, `Report Weekly MS ${s} RDA IN`,
    `Report Weekly MS ${s} RCE IN`, `Report Weekly MS ${s} RCE OUT`,
    `LIST ALL ASET MS ${s}`];
};

// ── Sub-komponen kecil ────────────────────────────────────────────────────
function KartuKpi({ ikon: Ikon, label, nilai, sub, warna }: {
  ikon: React.ElementType; label: string; nilai: string; sub?: string; warna: string;
}) {
  return (
    <div className="glass-panel" style={{ borderRadius: 14, padding: '.9rem 1.05rem', display: 'flex', gap: '.8rem', alignItems: 'center', flex: '1 1 200px' }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', background: `${warna}22`, color: warna, flexShrink: 0 }}>
        <Ikon size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '.68rem', color: 'var(--txt-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--txt-primary)', lineHeight: 1.3 }}>{nilai}</div>
        {sub && <div style={{ fontSize: '.7rem', color: 'var(--txt-muted)' }}>{sub}</div>}
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: 'rgba(12,18,32,.95)', border: '1px solid rgba(255,255,255,.14)',
  borderRadius: 10, fontSize: '.75rem', color: '#fff',
};

function PanelGrafik({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.1rem', flex: '1 1 340px', minWidth: 300 }}>
      <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--txt-primary)', marginBottom: '.75rem' }}>{judul}</div>
      <div style={{ height: 250 }}>{children}</div>
    </div>
  );
}

// ── Komponen utama ────────────────────────────────────────────────────────
interface Props { auth: AuthState; }

export function WeeklyReportView({ auth }: Props) {
  const sites = getSites();
  const isSuperAdmin = auth.role === 'Super Admin';
  // Super Admin dibuka di Wunut (site yang datanya sudah berjalan), user site
  // lain terkunci di site-nya sendiri.
  const siteAwal = auth.assignedSite && auth.assignedSite !== 'global'
    ? auth.assignedSite
    : (sites.find((s) => s.key === 'wunut')?.key ?? sites[0]?.key ?? 'wunut');

  const [site, setSite] = useState(siteAwal);
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [bulan, setBulan] = useState<number | 0>(0);
  const [arah, setArah] = useState<'IN' | 'OUT' | 'ASET'>('OUT');
  const [picaAktif, setPicaAktif] = useState(false);

  const [rows, setRows] = useState<WeeklyRow[]>([]);
  const [volumes, setVolumes] = useState<Record<number, number>>({});
  const [source, setSource] = useState<SheetSource | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [menyinkron, setMenyinkron] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'error'; teks: string } | null>(null);
  const [panelSumberTerbuka, setPanelSumberTerbuka] = useState(false);
  const [urlSheet, setUrlSheet] = useState('');
  const [tabsInput, setTabsInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const siteTerkunci = !isSuperAdmin && auth.assignedSite !== 'global';
  const labelSite = sites.find((s) => s.key === site)?.label ?? site;
  const muatData = useCallback(async (diam = false) => {
    if (!diam) setMemuat(true);
    try {
      const q = new URLSearchParams({ site, direction: arah });
      // Daftar Aset adalah registry, bukan data per-periode — tanggal pada
      // baris ini biasanya kosong, jadi filter tahun/bulan tidak dipakai
      // (kalau dipaksakan, baris tanpa tanggal justru akan hilang semua).
      if (arah !== 'ASET') {
        q.set('tahun', String(tahun));
        if (bulan) q.set('bulan', String(bulan));
      }
      const [data, vol, src] = await Promise.all([
        api.get<WeeklyRow[]>(`/weekly-reports?${q}`),
        api.get<{ minggu: number; m3: number }[]>(`/weekly-reports/volume?site=${site}&tahun=${tahun}`),
        api.get<SheetSource | null>(`/weekly-reports/source?site=${site}`),
      ]);
      setRows(data);
      setVolumes(Object.fromEntries(vol.map((v) => [v.minggu, v.m3])));
      setSource(src);
      if (src) { setUrlSheet(`https://docs.google.com/spreadsheets/d/${src.sheetId}/edit`); setTabsInput(src.tabs.join('\n')); }
      else { setUrlSheet(''); setTabsInput(TAB_DEFAULT(site).join('\n')); }
    } catch (err) {
      setPesan({ tipe: 'error', teks: (err as Error).message });
    } finally {
      setMemuat(false);
    }
  }, [site, tahun, bulan, arah]);

  useEffect(() => { void muatData(); }, [muatData]);

  // "Realtime": tarik ulang tiap 30 detik tanpa mengedipkan layar.
  useEffect(() => {
    const t = setInterval(() => { void muatData(true); }, 30_000);
    return () => clearInterval(t);
  }, [muatData]);

  // ── Pivot biaya (mode BARANG KELUAR) ────────────────────────────────────
  const { mingguList, pivot, totalSeksi, grandTotal, kelompokKegiatan } = useMemo(() => {
    const mingguSet = new Set<number>();
    rows.forEach((r) => { if (r.minggu > 0) mingguSet.add(r.minggu); });
    const minggus = [...mingguSet].sort((a, b) => a - b);

    const kelompokKegiatan = rows.length > 0 && SITE_KELOMPOK_KEGIATAN.has(rows[0].site);
    const p: Record<Section, Record<string, Record<number, number>>> = { MAINT: {}, OH: {}, OLI: {}, LAIN: {} };
    if (!kelompokKegiatan) {
      for (const s of SECTIONS) for (const a of BARIS_UNIVERSAL[s.key]) p[s.key][a] = {};
    }
    for (const r of rows) {
      const bucket = (p[r.section][kunciBarisPivot(r)] ??= {});
      bucket[r.minggu] = (bucket[r.minggu] ?? 0) + r.totalHarga;
    }

    const ts: Record<Section, Record<number, number>> = { MAINT: {}, OH: {}, OLI: {}, LAIN: {} };
    const gt: Record<number, number> = {};
    for (const s of SECTIONS) {
      for (const baris of Object.values(p[s.key])) {
        for (const [m, v] of Object.entries(baris)) {
          ts[s.key][+m] = (ts[s.key][+m] ?? 0) + v;
          gt[+m] = (gt[+m] ?? 0) + v;
        }
      }
    }
    return { mingguList: minggus, pivot: p, totalSeksi: ts, grandTotal: gt, kelompokKegiatan };
  }, [rows]);

  const totalKeseluruhan = useMemo(
    () => Object.values(grandTotal).reduce((a, b) => a + b, 0), [grandTotal]);

  const totalPerSeksi = useMemo(() => Object.fromEntries(
    SECTIONS.map((s) => [s.key, Object.values(totalSeksi[s.key]).reduce((a, b) => a + b, 0)])
  ) as Record<Section, number>, [totalSeksi]);

  // Data grafik mode KELUAR: batang bertumpuk per minggu + pie komposisi seksi.
  const dataBatangKeluar = useMemo(() => mingguList.map((m) => ({
    minggu: `W${m}`,
    'Part Maintenance': totalSeksi.MAINT[m] ?? 0,
    Overhold: totalSeksi.OH[m] ?? 0,
    'Consumption OLI': totalSeksi.OLI[m] ?? 0,
    'Lain-Lain': totalSeksi.LAIN[m] ?? 0,
  })), [mingguList, totalSeksi]);

  const dataPieKeluar = useMemo(() => SECTIONS
    .map((s) => ({ name: LABEL_SEKSI[s.key], value: totalPerSeksi[s.key], warna: s.warna }))
    .filter((d) => d.value > 0), [totalPerSeksi]);

  // ── Ringkasan penerimaan (mode BARANG MASUK) ────────────────────────────
  const masuk = useMemo(() => {
    const perMinggu: Record<number, { nilai: number; qty: number; item: number }> = {};
    const perKategori: Record<string, number> = {};
    let nilai = 0, qty = 0;
    for (const r of rows) {
      nilai += r.totalHarga;
      qty += r.jumlah;
      const m = (perMinggu[r.minggu] ??= { nilai: 0, qty: 0, item: 0 });
      m.nilai += r.totalHarga; m.qty += r.jumlah; m.item += 1;
      perKategori[r.alokasi] = (perKategori[r.alokasi] ?? 0) + r.totalHarga;
    }
    const kategori = Object.entries(perKategori)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    // Kategori kecil digabung agar pie tetap terbaca.
    const atas = kategori.slice(0, 6);
    const sisa = kategori.slice(6).reduce((s, k) => s + k.value, 0);
    if (sisa > 0) atas.push({ name: 'Lainnya', value: sisa });

    return {
      nilai, qty, baris: rows.length,
      batang: mingguList.map((m) => ({
        minggu: `W${m}`,
        Nilai: perMinggu[m]?.nilai ?? 0,
        item: perMinggu[m]?.item ?? 0,
      })),
      pie: atas,
      semua: [...rows].sort((a, b) => b.totalHarga - a.totalHarga),
    };
  }, [rows, mingguList]);

  // Filter per-minggu + sortir kolom untuk tabel Barang Masuk — supaya bisa
  // fokus menganalisa satu minggu tanpa harus mengganti filter periode utama.
  const [minggFilterMasuk, setMinggFilterMasuk] = useState<number | 0>(0);
  type KolomMasuk = 'tanggal' | 'minggu' | 'kode' | 'namaBarang' | 'alokasi' | 'jumlah' | 'totalHarga';
  const [sortKolom, setSortKolom] = useState<KolomMasuk>('totalHarga');
  const [sortMenurun, setSortMenurun] = useState(true);

  const gantiSort = (kolom: KolomMasuk) => {
    if (kolom === sortKolom) setSortMenurun((v) => !v);
    else { setSortKolom(kolom); setSortMenurun(kolom !== 'namaBarang' && kolom !== 'alokasi'); }
  };

  useEffect(() => { setMinggFilterMasuk(0); }, [site, tahun, bulan, arah]);

  const dataMasukTampil = useMemo(() => {
    const dasar = minggFilterMasuk ? masuk.semua.filter((r) => r.minggu === minggFilterMasuk) : masuk.semua;
    const arah2 = sortMenurun ? -1 : 1;
    return [...dasar].sort((a, b) => {
      const x = a[sortKolom], y = b[sortKolom];
      if (typeof x === 'string' || typeof y === 'string') return arah2 * String(x ?? '').localeCompare(String(y ?? ''));
      return arah2 * ((Number(x) || 0) - (Number(y) || 0));
    });
  }, [masuk.semua, minggFilterMasuk, sortKolom, sortMenurun]);

  const ringkasanFilterMasuk = useMemo(() => ({
    nilai: dataMasukTampil.reduce((s, r) => s + r.totalHarga, 0),
    qty: dataMasukTampil.reduce((s, r) => s + r.jumlah, 0),
  }), [dataMasukTampil]);

  // ── Daftar Aset (mode LIST ALL ASET) ────────────────────────────────────
  // Registry seluruh aset MS ini — bukan transaksi mingguan, jadi diagregasi
  // per lokasi/kategori (kolom "alokasi") dan per kondisi (kolom statusSmr),
  // tanpa memakai sumbu minggu seperti dua mode lainnya.
  const aset = useMemo(() => {
    const perLokasi: Record<string, number> = {};
    let nilai = 0, nilaiEstimasi = 0, qty = 0;
    for (const r of rows) {
      nilai += r.totalHarga;
      if (!r.totalHarga && r.hargaEstimasi) nilaiEstimasi += r.hargaEstimasi;
      qty += r.jumlah;
      perLokasi[r.alokasi] = (perLokasi[r.alokasi] ?? 0) + 1;
    }
    const lokasi = Object.entries(perLokasi).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const atas = lokasi.slice(0, 7);
    const sisa = lokasi.slice(7).reduce((s, k) => s + k.value, 0);
    if (sisa > 0) atas.push({ name: 'Lainnya', value: sisa });

    // Kelompokkan per sub-bab (mis. "Main Office") persis seperti pembagian
    // baris di sheet "LIST ALL ASET ..." — urutan sub-bab mengikuti urutan
    // kemunculan pertamanya di sheet, item di dalamnya diurutkan nama.
    const urutanSubBab: string[] = [];
    const perSubBab: Record<string, WeeklyRow[]> = {};
    for (const r of rows) {
      const key = r.detailAlokasi?.trim() || 'Tanpa Sub-Bab';
      if (!perSubBab[key]) { perSubBab[key] = []; urutanSubBab.push(key); }
      perSubBab[key].push(r);
    }
    const subBab = urutanSubBab.map((nama) => ({
      nama,
      item: [...perSubBab[nama]].sort((a, b) => a.namaBarang.localeCompare(b.namaBarang)),
    }));

    return {
      nilai, nilaiEstimasi, qty, baris: rows.length, lokasiUnik: lokasi.length,
      pieLokasi: atas,
      subBab,
      semua: [...rows].sort((a, b) => a.namaBarang.localeCompare(b.namaBarang)),
    };
  }, [rows]);

  type KolomAset = 'kode' | 'namaBarang' | 'jenis' | 'merk' | 'tipe' | 'alokasi' | 'tahun' | 'jumlah' | 'totalHarga' | 'statusSmr';
  const [cariAset, setCariAset] = useState('');
  const [sortKolomAset, setSortKolomAset] = useState<KolomAset>('namaBarang');
  const [sortMenurunAset, setSortMenurunAset] = useState(false);

  const gantiSortAset = (kolom: KolomAset) => {
    if (kolom === sortKolomAset) setSortMenurunAset((v) => !v);
    else { setSortKolomAset(kolom); setSortMenurunAset(kolom === 'jumlah' || kolom === 'totalHarga'); }
  };

  const dataAsetTampil = useMemo(() => {
    const q = cariAset.trim().toLowerCase();
    const dasar = q
      ? aset.semua.filter((r) => `${r.kode} ${r.namaBarang} ${r.alokasi} ${r.detailAlokasi} ${r.jenis} ${r.merk} ${r.tipe}`.toLowerCase().includes(q))
      : aset.semua;
    const arah2 = sortMenurunAset ? -1 : 1;
    return [...dasar].sort((a, b) => {
      const x = a[sortKolomAset], y = b[sortKolomAset];
      if (typeof x === 'string' || typeof y === 'string') return arah2 * String(x ?? '').localeCompare(String(y ?? ''));
      return arah2 * ((Number(x) || 0) - (Number(y) || 0));
    });
  }, [aset.semua, cariAset, sortKolomAset, sortMenurunAset]);

  // Sub-bab (mis. "Main Office") yang lolos pencarian, dengan urutan &
  // sortir kolom yang sama seperti tabel datar di atas.
  const subBabTampil = useMemo(() => {
    const urutan = new Map(dataAsetTampil.map((r, i) => [r.id, i]));
    return aset.subBab
      .map((g) => ({
        nama: g.nama,
        item: g.item.filter((r) => urutan.has(r.id)).sort((a, b) => (urutan.get(a.id)! - urutan.get(b.id)!)),
      }))
      .filter((g) => g.item.length > 0);
  }, [aset.subBab, dataAsetTampil]);

  useEffect(() => { setCariAset(''); }, [site, arah]);

  // ── Aksi ────────────────────────────────────────────────────────────────
  const simpanSumber = async () => {
    const tabs = tabsInput.split('\n').map((t) => t.trim()).filter(Boolean);
    try {
      const src = await api.post<SheetSource>('/weekly-reports/source', { site, sheetUrl: urlSheet, tabs, autoSync: true });
      setSource(src);
      setPesan({ tipe: 'ok', teks: 'Sumber spreadsheet tersimpan. Klik "Sync Sekarang" untuk menarik data.' });
      setPanelSumberTerbuka(false);
    } catch (err) { setPesan({ tipe: 'error', teks: (err as Error).message }); }
  };

  const sinkronkan = async () => {
    setMenyinkron(true); setPesan(null);
    try {
      const hasil = await api.post<{ hasil: { tab: string; total?: number; error?: string }[] }>(
        '/weekly-reports/sync', { site });
      const gagal = hasil.hasil.filter((h) => h.error);
      const jumlah = hasil.hasil.reduce((s, h) => s + (h.total ?? 0), 0);
      setPesan(gagal.length
        ? { tipe: 'error', teks: `${jumlah} baris tersinkron, ${gagal.length} tab gagal: ${gagal.map((g) => `${g.tab} — ${g.error}`).join('; ')}` }
        : { tipe: 'ok', teks: `${jumlah} baris berhasil disinkronkan dari Google Spreadsheet.` });
      await muatData(true);
    } catch (err) { setPesan({ tipe: 'error', teks: (err as Error).message }); }
    finally { setMenyinkron(false); }
  };

  const unggahCsv = async (file: File) => {
    setMenyinkron(true); setPesan(null);
    try {
      const csv = await file.text();
      const hasil = await api.post<{ inserted: number; updated: number; total: number }>(
        '/weekly-reports/import', { site, tab: file.name, csv });
      setPesan({ tipe: 'ok', teks: `${hasil.total} baris terbaca (${hasil.inserted} baru, ${hasil.updated} diperbarui).` });
      await muatData(true);
    } catch (err) { setPesan({ tipe: 'error', teks: (err as Error).message }); }
    finally { setMenyinkron(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const unduhCsv = () => {
    const baris: string[][] = [];
    if (arah === 'OUT') {
      baris.push(['Seksi', 'Alokasi', ...mingguList.map((m) => `Minggu ${m}`), 'Total']);
      for (const s of SECTIONS) {
        for (const alokasi of urutkanBarisSeksi(s.key, Object.keys(pivot[s.key]))) {
          const data = pivot[s.key][alokasi];
          baris.push([s.judul, alokasi, ...mingguList.map((m) => String(data[m] ?? 0)),
            String(Object.values(data).reduce((a, b) => a + b, 0))]);
        }
        baris.push([s.judul, s.totalLabel, ...mingguList.map((m) => String(totalSeksi[s.key][m] ?? 0)),
          String(totalPerSeksi[s.key])]);
      }
      baris.push(['', 'Grand Total Price', ...mingguList.map((m) => String(grandTotal[m] ?? 0)), String(totalKeseluruhan)]);
    } else {
      baris.push(['Tanggal', 'Minggu', 'Kode', 'Nama Barang', 'Jumlah', 'Satuan', arah === 'IN' ? 'Supplier' : 'Alokasi', 'Harga', 'Total Harga', 'No MR', 'Ket']);
      for (const r of rows) {
        baris.push([r.tanggal ?? '', String(r.minggu), r.kode, r.namaBarang, String(r.jumlah), r.satuan,
          r.alokasi, String(r.harga), String(r.totalHarga), r.noMr, r.keterangan]);
      }
    }
    const csv = baris.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `REPORT_${arah === 'OUT' ? 'KELUAR' : 'MASUK'}_${bulan ? NAMA_BULAN[bulan - 1].toUpperCase() : tahun}_MS_${site.toUpperCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Gaya sel tabel ──────────────────────────────────────────────────────
  const thMinggu: CSSProperties = { padding: '.4rem .55rem', textAlign: 'right', fontSize: '.7rem', whiteSpace: 'nowrap' };
  const tdAngka: CSSProperties = { padding: '.4rem .55rem', textAlign: 'right', fontSize: '.75rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
  const kontrol: CSSProperties = { padding: '.5rem .75rem', borderRadius: 10, background: 'rgba(255,255,255,.05)', color: 'var(--txt-primary)', border: '1px solid rgba(255,255,255,.12)' };
  const tombol: CSSProperties = { display: 'flex', alignItems: 'center', gap: '.4rem', padding: '.5rem .85rem', borderRadius: 10, background: 'rgba(255,255,255,.06)', color: 'var(--txt-primary)', border: '1px solid rgba(255,255,255,.14)', cursor: 'pointer' };

  const kosong = !memuat && !rows.length;

  return (
    <>
      <div className="view-page-header">
        <div className="view-page-title">Laporan Mingguan Barang Masuk &amp; Keluar</div>
        <div className="view-page-sub">
          Rekap penggunaan part, overhaul, oli, dan biaya lain-lain per minggu untuk setiap Mother Station,
          ditarik langsung dari Google Spreadsheet milik site.
        </div>
      </div>

      {/* Pemilih arah — memisahkan dua laporan yang berbeda sifatnya */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.85rem', flexWrap: 'wrap' }}>
        {([
          { id: 'OUT', label: 'Barang Keluar', ikon: TrendingDown, warna: '#F87171' },
          { id: 'IN', label: 'Barang Masuk', ikon: TrendingUp, warna: '#00D084' },
          { id: 'ASET', label: 'Daftar Aset', ikon: Boxes, warna: '#60A5FA' },
          { id: 'PICA', label: 'PICA', ikon: ClipboardList, warna: '#FBBF24' },
        ] as const).map((t) => {
          const aktif = t.id === 'PICA' ? picaAktif : (!picaAktif && arah === t.id);
          const Ikon = t.ikon;
          return (
            <button key={t.id} type="button"
              onClick={() => { if (t.id === 'PICA') setPicaAktif(true); else { setPicaAktif(false); setArah(t.id); } }}
              style={{
                display: 'flex', alignItems: 'center', gap: '.45rem', padding: '.55rem 1.1rem',
                borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: '.82rem',
                background: aktif ? `${t.warna}1F` : 'rgba(255,255,255,.04)',
                color: aktif ? t.warna : 'var(--txt-muted)',
                border: `1px solid ${aktif ? `${t.warna}59` : 'rgba(255,255,255,.1)'}`,
              }}>
              <Ikon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Mode PICA (Problem/Identification/Corrective Action) punya bentuk data
          & panel sumber yang sama sekali beda dari Barang Masuk/Keluar/Aset —
          komponen sendiri, cuma berbagi header halaman & pemilih site. */}
      {picaAktif ? (
        <PicaView site={site} labelSite={labelPenuh(labelSite)} sites={sites}
          onSiteChange={(s) => setSite(s)} siteTerkunci={siteTerkunci} />
      ) : (
      <>
      {/* Filter + aksi */}
      <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '.75rem', alignItems: 'center' }}>
        <select value={site} onChange={(e) => setSite(e.target.value)} disabled={siteTerkunci} style={kontrol}>
          {sites.map((s) => <option key={s.key} value={s.key}>{labelPenuh(s.label)}</option>)}
        </select>

        {arah !== 'ASET' && (
          <>
            <select value={bulan} onChange={(e) => setBulan(Number(e.target.value))} style={kontrol}>
              <option value={0}>Semua Bulan</option>
              {NAMA_BULAN.map((b, i) => <option key={b} value={i + 1}>{b}</option>)}
            </select>

            <input type="number" value={tahun} onChange={(e) => setTahun(Number(e.target.value))}
              style={{ ...kontrol, width: 90 }} />
          </>
        )}
        <div style={{ flex: 1 }} />

        <button type="button" onClick={() => setPanelSumberTerbuka((v) => !v)}
          style={{ ...tombol, background: 'rgba(96,165,250,.12)', color: '#60A5FA', border: '1px solid rgba(96,165,250,.3)' }}>
          <Link2 size={15} /> Sumber Sheet
        </button>

        <button type="button" onClick={() => fileRef.current?.click()} style={tombol}>
          <Upload size={15} /> Import CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void unggahCsv(f); }} />

        <button type="button" onClick={unduhCsv} style={tombol}>
          <Download size={15} /> Export
        </button>

        <button type="button" onClick={sinkronkan} disabled={menyinkron || !source}
          title={source ? 'Tarik ulang dari Google Spreadsheet' : 'Atur sumber sheet terlebih dahulu'}
          style={{ ...tombol, background: '#00D084', color: '#06281A', border: 'none', fontWeight: 600, padding: '.5rem .95rem', cursor: source ? 'pointer' : 'not-allowed', opacity: source ? 1 : .5 }}>
          {menyinkron ? <Loader2 size={15} /> : <RefreshCw size={15} />} Sync Sekarang
        </button>
      </div>

      {/* Panel konfigurasi sumber */}
      {panelSumberTerbuka && (
        <div className="glass-panel" style={{ borderRadius: 16, padding: '1.1rem 1.25rem', marginBottom: '1rem', display: 'grid', gap: '.75rem' }}>
          <label style={{ fontSize: '.78rem', color: 'var(--txt-muted)' }}>
            URL Google Spreadsheet untuk {labelPenuh(labelSite)}
            <input value={urlSheet} onChange={(e) => setUrlSheet(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              style={{ ...kontrol, display: 'block', width: '100%', marginTop: '.35rem' }} />
          </label>
          <label style={{ fontSize: '.78rem', color: 'var(--txt-muted)' }}>
            Nama tab yang diimport (satu per baris)
            <textarea value={tabsInput} onChange={(e) => setTabsInput(e.target.value)} rows={4}
              style={{ ...kontrol, display: 'block', width: '100%', marginTop: '.35rem', fontFamily: 'inherit', resize: 'vertical' }} />
          </label>
          <div style={{ fontSize: '.72rem', color: 'var(--txt-muted)' }}>
            Sheet harus dibagikan sebagai <strong>Anyone with the link — Viewer</strong>. Tab bernama
            “…IN” dicatat sebagai barang masuk, “…OUT” sebagai barang keluar. Disinkronkan otomatis tiap 5 menit.
            {source?.lastSyncAt && <> Sync terakhir: {new Date(source.lastSyncAt).toLocaleString('id-ID')} ({source.lastStatus}).</>}
          </div>
          <div>
            <button type="button" onClick={simpanSumber}
              style={{ padding: '.5rem 1rem', borderRadius: 10, background: '#00D084', color: '#06281A', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
              Simpan Sumber
            </button>
          </div>
        </div>
      )}

      {pesan && (
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', padding: '.7rem .9rem', borderRadius: 12, marginBottom: '1rem', fontSize: '.8rem',
          background: pesan.tipe === 'ok' ? 'rgba(0,208,132,.1)' : 'rgba(245,158,11,.1)',
          border: `1px solid ${pesan.tipe === 'ok' ? 'rgba(0,208,132,.35)' : 'rgba(245,158,11,.35)'}`,
          color: pesan.tipe === 'ok' ? '#00D084' : '#F59E0B' }}>
          {pesan.tipe === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{pesan.teks}</span>
        </div>
      )}

      {memuat && (
        <div className="glass-panel" style={{ borderRadius: 16, padding: '2.5rem', textAlign: 'center', color: 'var(--txt-muted)' }}>Memuat laporan…</div>
      )}

      {kosong && (
        <div className="glass-panel" style={{ borderRadius: 16, padding: '2.5rem', textAlign: 'center', color: 'var(--txt-muted)' }}>
          Belum ada data {arah === 'OUT' ? 'barang keluar' : arah === 'IN' ? 'barang masuk' : 'aset'} untuk {labelPenuh(labelSite)} pada periode ini.
          Atur sumber spreadsheet lalu klik “Sync Sekarang”, atau import file CSV.
        </div>
      )}

      {/* ══════════════════ MODE: BARANG KELUAR ══════════════════ */}
      {!memuat && !kosong && arah === 'OUT' && (
        <>
          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {SECTIONS.map((s) => (
              <KartuKpi key={s.key} ikon={Package} warna={s.warna} label={LABEL_SEKSI[s.key]}
                nilai={rupiahPenuh(totalPerSeksi[s.key])}
                sub={totalKeseluruhan ? `${((totalPerSeksi[s.key] / totalKeseluruhan) * 100).toFixed(1)}% dari total` : undefined} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <PanelGrafik judul="Biaya per Minggu (bertumpuk per kategori)">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataBatangKeluar} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" vertical={false} />
                  <XAxis dataKey="minggu" tick={{ fontSize: 11, fill: 'var(--txt-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={ringkas} tick={{ fontSize: 11, fill: 'var(--txt-muted)' }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip contentStyle={tooltipStyle} formatter={fmtTooltip} cursor={{ fill: 'rgba(255,255,255,.05)' }} />
                  <Legend wrapperStyle={{ fontSize: '.72rem' }} />
                  {SECTIONS.map((s) => (
                    <Bar key={s.key} dataKey={LABEL_SEKSI[s.key]} stackId="a" fill={s.warna} radius={s.key === 'LAIN' ? [4, 4, 0, 0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </PanelGrafik>

            <PanelGrafik judul="Komposisi Biaya per Kategori">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dataPieKeluar} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2}>
                    {dataPieKeluar.map((d) => <Cell key={d.name} fill={d.warna} stroke="transparent" />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={fmtTooltip} />
                  <Legend wrapperStyle={{ fontSize: '.72rem' }} />
                </PieChart>
              </ResponsiveContainer>
            </PanelGrafik>
          </div>

          {/* Tabel pivot, mengikuti template Excel */}
          <div className="glass-panel" style={{ borderRadius: 16, overflowX: 'auto' }}>
            <table className="simple-table" style={{ minWidth: 820, borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                {SECTIONS.map((s) => (
                  <Fragment key={s.key}>
                    <tr>
                      <td colSpan={mingguList.length + 2}
                        style={{ padding: '.75rem .75rem .45rem', fontWeight: 700, fontSize: '.82rem', color: s.warna, letterSpacing: '.02em' }}>
                        {s.judul}
                      </td>
                    </tr>
                    <tr style={{ background: 'rgba(255,255,255,.04)' }}>
                      <th style={{ padding: '.4rem .6rem', textAlign: 'left', fontSize: '.7rem', minWidth: 190 }}>
                        {LABEL_SEKSI[s.key]}{kelompokKegiatan ? ' (per Kegiatan)' : ''}
                      </th>
                      <th style={{ ...thMinggu, fontWeight: 700 }}>Total</th>
                      {mingguList.map((m) => <th key={m} style={thMinggu}>W{m}</th>)}
                    </tr>
                    {urutkanBarisSeksi(s.key, Object.keys(pivot[s.key])).map((alokasi) => {
                      const data = pivot[s.key][alokasi];
                      const total = Object.values(data).reduce((a, b) => a + b, 0);
                      return (
                        <tr key={alokasi} style={{ opacity: total ? 1 : .45 }}>
                          <td style={{ padding: '.4rem .6rem', fontSize: '.75rem', color: 'var(--txt-primary)' }}>{alokasi}</td>
                          <td style={{ ...tdAngka, fontWeight: 600 }}>{rupiah(total)}</td>
                          {mingguList.map((m) => <td key={m} style={tdAngka}>{rupiah(data[m] ?? 0)}</td>)}
                        </tr>
                      );
                    })}
                    <tr style={{ background: `${s.warna}12`, fontWeight: 700 }}>
                      <td style={{ padding: '.45rem .6rem', fontSize: '.75rem' }}>{s.totalLabel}</td>
                      <td style={{ ...tdAngka, color: s.warna }}>{rupiah(totalPerSeksi[s.key])}</td>
                      {mingguList.map((m) => <td key={m} style={tdAngka}>{rupiah(totalSeksi[s.key][m] ?? 0)}</td>)}
                    </tr>
                  </Fragment>
                ))}

                <tr style={{ background: 'rgba(0,208,132,.14)', fontWeight: 800 }}>
                  <td style={{ padding: '.6rem', fontSize: '.8rem' }}>Grand Total Price</td>
                  <td style={{ ...tdAngka, color: '#00D084', fontSize: '.8rem' }}>{rupiah(totalKeseluruhan)}</td>
                  {mingguList.map((m) => <td key={m} style={tdAngka}>{rupiah(grandTotal[m] ?? 0)}</td>)}
                </tr>
                <tr>
                  <td style={{ padding: '.5rem .6rem', fontSize: '.75rem', color: 'var(--txt-muted)' }}>Total Sales Order / m³</td>
                  <td style={tdAngka}>—</td>
                  {mingguList.map((m) => (
                    <td key={m} style={{ ...tdAngka, color: 'var(--txt-muted)' }}>
                      {volumes[m] ? Math.round(volumes[m]).toLocaleString('id-ID') : '-'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '.5rem .6rem', fontSize: '.75rem', color: 'var(--txt-muted)' }}>Rp / m³</td>
                  <td style={tdAngka}>—</td>
                  {mingguList.map((m) => (
                    <td key={m} style={{ ...tdAngka, color: 'var(--txt-muted)' }}>
                      {volumes[m] ? ((grandTotal[m] ?? 0) / volumes[m]).toFixed(2) : '-'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Blok "NB :" seperti pada template Excel */}
          <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.25rem', marginTop: '1rem', fontSize: '.78rem', color: 'var(--txt-muted)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--txt-primary)' }}>NB:</strong> Total penggunaan Part Maintenance {labelPenuh(labelSite).toUpperCase()}
            {bulan ? ` ${NAMA_BULAN[bulan - 1]}` : ` ${tahun}`} sebesar <strong style={{ color: '#00D084' }}>{rupiahPenuh(totalPerSeksi.MAINT)}</strong>;
            biaya Overhold <strong style={{ color: '#60A5FA' }}>{rupiahPenuh(totalPerSeksi.OH)}</strong>;
            pemakaian OLI <strong style={{ color: '#FBBF24' }}>{rupiahPenuh(totalPerSeksi.OLI)}</strong>;
            biaya Lain-Lain <strong style={{ color: '#C084FC' }}>{rupiahPenuh(totalPerSeksi.LAIN)}</strong>.
            Grand Total <strong style={{ color: '#00D084' }}>{rupiahPenuh(totalKeseluruhan)}</strong> dari {rows.length} baris transaksi keluar.
          </div>
        </>
      )}

      {/* ══════════════════ MODE: BARANG MASUK ══════════════════ */}
      {!memuat && !kosong && arah === 'IN' && (
        <>
          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <KartuKpi ikon={TrendingUp} warna="#00D084" label="Nilai Penerimaan" nilai={rupiahPenuh(masuk.nilai)}
              sub={`${labelPenuh(labelSite)}${bulan ? ` · ${NAMA_BULAN[bulan - 1]}` : ''} ${tahun}`} />
            <KartuKpi ikon={Boxes} warna="#60A5FA" label="Total Kuantitas" nilai={masuk.qty.toLocaleString('id-ID')}
              sub="gabungan semua satuan" />
            <KartuKpi ikon={Package} warna="#FBBF24" label="Baris Penerimaan" nilai={String(masuk.baris)}
              sub={`${mingguList.length} minggu aktif`} />
            <KartuKpi ikon={TrendingUp} warna="#C084FC" label="Rata-rata / Minggu"
              nilai={rupiahPenuh(mingguList.length ? masuk.nilai / mingguList.length : 0)} />
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <PanelGrafik judul="Nilai Barang Masuk per Minggu">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={masuk.batang} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" vertical={false} />
                  <XAxis dataKey="minggu" tick={{ fontSize: 11, fill: 'var(--txt-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={ringkas} tick={{ fontSize: 11, fill: 'var(--txt-muted)' }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip contentStyle={tooltipStyle} formatter={fmtTooltip} cursor={{ fill: 'rgba(255,255,255,.05)' }} />
                  <Bar dataKey="Nilai" fill="#00D084" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </PanelGrafik>

            <PanelGrafik judul="Penerimaan per Supplier">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={masuk.pie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2}>
                    {masuk.pie.map((d, i) => <Cell key={d.name} fill={PALET[i % PALET.length]} stroke="transparent" />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={fmtTooltip} />
                  <Legend wrapperStyle={{ fontSize: '.72rem' }} />
                </PieChart>
              </ResponsiveContainer>
            </PanelGrafik>
          </div>

          <div className="glass-panel" style={{ borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '.85rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '.75rem', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ fontWeight: 700, fontSize: '.82rem', color: '#00D084' }}>Semua Barang Masuk</div>
              <div style={{ flex: 1 }} />
              <label style={{ fontSize: '.72rem', color: 'var(--txt-muted)', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                Minggu
                <select value={minggFilterMasuk} onChange={(e) => setMinggFilterMasuk(Number(e.target.value))} style={kontrol}>
                  <option value={0}>Semua Minggu</option>
                  {mingguList.map((m) => <option key={m} value={m}>W{m}</option>)}
                </select>
              </label>
              <div style={{ fontSize: '.72rem', color: 'var(--txt-muted)' }}>
                {dataMasukTampil.length.toLocaleString('id-ID')} baris · {ringkasanFilterMasuk.qty.toLocaleString('id-ID')} unit ·{' '}
                <strong style={{ color: '#00D084' }}>{rupiahPenuh(ringkasanFilterMasuk.nilai)}</strong>
              </div>
            </div>

            <div style={{ maxHeight: 560, overflowY: 'auto', overflowX: 'auto' }}>
              <table className="simple-table" style={{ minWidth: 760, borderCollapse: 'collapse', width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: 'var(--panel-solid, #10182b)' }}>
                    {([
                      ['tanggal', 'Tanggal', 'left'], ['minggu', 'Minggu', 'left'],
                      ['kode', 'Kode', 'left'], ['namaBarang', 'Nama Barang', 'left'],
                      ['alokasi', 'Supplier', 'left'],
                      ['jumlah', 'Jumlah', 'right'], ['totalHarga', 'Total Harga', 'right'],
                    ] as [KolomMasuk, string, 'left' | 'right'][]).map(([kolom, label, align]) => (
                      <th key={kolom} onClick={() => gantiSort(kolom)}
                        style={{ padding: '.5rem .6rem', textAlign: align, fontSize: '.7rem', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', color: sortKolom === kolom ? '#00D084' : 'var(--txt-muted)' }}>
                        {label}{sortKolom === kolom ? (sortMenurun ? ' ↓' : ' ↑') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataMasukTampil.map((r) => (
                    <tr key={r.id}>
                      <td style={{ padding: '.4rem .6rem', fontSize: '.74rem', color: 'var(--txt-muted)', whiteSpace: 'nowrap' }}>{r.tanggal ?? '-'}</td>
                      <td style={{ padding: '.4rem .6rem', fontSize: '.74rem', color: 'var(--txt-muted)' }}>W{r.minggu}</td>
                      <td style={{ padding: '.4rem .6rem', fontSize: '.74rem', color: 'var(--txt-muted)', whiteSpace: 'nowrap' }}>{r.kode || '-'}</td>
                      <td style={{ padding: '.4rem .6rem', fontSize: '.75rem', color: 'var(--txt-primary)' }}>{r.namaBarang}</td>
                      <td style={{ padding: '.4rem .6rem', fontSize: '.74rem', color: 'var(--txt-muted)' }}>{r.alokasi}</td>
                      <td style={tdAngka}>{r.jumlah.toLocaleString('id-ID')} {r.satuan}</td>
                      <td style={{ ...tdAngka, fontWeight: 600 }}>{rupiahPenuh(r.totalHarga)}</td>
                    </tr>
                  ))}
                  {!dataMasukTampil.length && (
                    <tr><td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--txt-muted)', fontSize: '.78rem' }}>
                      Tidak ada barang masuk pada minggu ini.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>


          <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.25rem', marginTop: '1rem', fontSize: '.78rem', color: 'var(--txt-muted)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--txt-primary)' }}>NB:</strong> {labelPenuh(labelSite).toUpperCase()} menerima{' '}
            <strong style={{ color: '#00D084' }}>{masuk.baris}</strong> baris barang masuk senilai{' '}
            <strong style={{ color: '#00D084' }}>{rupiahPenuh(masuk.nilai)}</strong>
            {bulan ? ` pada ${NAMA_BULAN[bulan - 1]} ${tahun}` : ` sepanjang ${tahun}`}, tersebar di {mingguList.length} minggu.
            Ringkasan ini terpisah dari laporan barang keluar karena penerimaan menambah stok, bukan biaya pemakaian.
          </div>
        </>
      )}

      {/* ══════════════════ MODE: DAFTAR ASET (LIST ALL ASET) ══════════════════ */}
      {!memuat && !kosong && arah === 'ASET' && (
        <>
          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <KartuKpi ikon={Package} warna="#60A5FA" label="Total Aset" nilai={aset.baris.toLocaleString('id-ID')}
              sub={labelPenuh(labelSite)} />
            <KartuKpi ikon={Boxes} warna="#00D084" label="Total Kuantitas" nilai={aset.qty.toLocaleString('id-ID')}
              sub="gabungan semua satuan" />
            <KartuKpi ikon={TrendingUp} warna="#FBBF24" label="Nilai Total Aset" nilai={rupiahPenuh(aset.nilai + aset.nilaiEstimasi)}
              sub={aset.nilaiEstimasi > 0 ? `termasuk ≈${rupiahPenuh(aset.nilaiEstimasi)} estimasi` : undefined} />
            <KartuKpi ikon={TrendingDown} warna="#C084FC" label="Lokasi / Kategori" nilai={String(aset.lokasiUnik)}
              sub="titik alokasi berbeda" />
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <PanelGrafik judul="Distribusi Aset per Lokasi / Kategori">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={aset.pieLokasi} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2}>
                    {aset.pieLokasi.map((d, i) => <Cell key={d.name} fill={PALET[i % PALET.length]} stroke="transparent" />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => `${v} item`} />
                  <Legend wrapperStyle={{ fontSize: '.72rem' }} />
                </PieChart>
              </ResponsiveContainer>
            </PanelGrafik>

            <PanelGrafik judul="Jumlah Aset per Lokasi (batang)">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aset.pieLokasi} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--txt-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: 'var(--txt-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => `${v} item`} cursor={{ fill: 'rgba(255,255,255,.05)' }} />
                  <Bar dataKey="value" fill="#60A5FA" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </PanelGrafik>
          </div>

          <div className="glass-panel" style={{ borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '.85rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '.75rem', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ fontWeight: 700, fontSize: '.82rem', color: '#60A5FA' }}>Semua Aset {labelPenuh(labelSite)}</div>
              <div style={{ flex: 1 }} />
              <input value={cariAset} onChange={(e) => setCariAset(e.target.value)}
                placeholder="Cari kode / nama / lokasi…"
                style={{ ...kontrol, width: 220 }} />
              <div style={{ fontSize: '.72rem', color: 'var(--txt-muted)' }}>
                {dataAsetTampil.length.toLocaleString('id-ID')} dari {aset.baris.toLocaleString('id-ID')} aset
              </div>
            </div>

            <div style={{ maxHeight: 560, overflowY: 'auto', overflowX: 'auto' }}>
              <table className="simple-table" style={{ minWidth: 1180, borderCollapse: 'collapse', width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: 'var(--panel-solid, #10182b)' }}>
                    {([
                      ['kode', 'Kode', 'left'], ['namaBarang', 'Nama Aset', 'left'],
                      ['jenis', 'Kategori', 'left'], ['merk', 'Merk', 'left'], ['tipe', 'Type', 'left'],
                      ['alokasi', 'Lokasi', 'left'], ['statusSmr', 'Kondisi', 'left'], ['tahun', 'Tahun', 'left'],
                      ['jumlah', 'Jumlah', 'right'], ['totalHarga', 'Nilai', 'right'],
                    ] as [KolomAset, string, 'left' | 'right'][]).map(([kolom, label, align]) => (
                      <th key={kolom} onClick={() => gantiSortAset(kolom)}
                        style={{ padding: '.5rem .6rem', textAlign: align, fontSize: '.7rem', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', color: sortKolomAset === kolom ? '#60A5FA' : 'var(--txt-muted)' }}>
                        {label}{sortKolomAset === kolom ? (sortMenurunAset ? ' ↓' : ' ↑') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subBabTampil.map((g) => (
                    <Fragment key={g.nama}>
                      <tr>
                        <td colSpan={10} style={{
                          padding: '.45rem .6rem', fontSize: '.72rem', fontWeight: 700,
                          color: '#0B1220', background: '#60A5FA', letterSpacing: '.02em',
                        }}>
                          {g.nama} <span style={{ fontWeight: 500, opacity: .75 }}>· {g.item.length.toLocaleString('id-ID')} aset</span>
                        </td>
                      </tr>
                      {g.item.map((r) => (
                        <tr key={r.id}>
                          <td style={{ padding: '.4rem .6rem', fontSize: '.74rem', color: 'var(--txt-muted)', whiteSpace: 'nowrap' }}>{r.kode || '-'}</td>
                          <td style={{ padding: '.4rem .6rem', fontSize: '.75rem', color: 'var(--txt-primary)' }}>{r.namaBarang}</td>
                          <td style={{ padding: '.4rem .6rem', fontSize: '.74rem', color: 'var(--txt-muted)' }}>{r.jenis || '-'}</td>
                          <td style={{ padding: '.4rem .6rem', fontSize: '.74rem', color: 'var(--txt-muted)' }}>{r.merk || '-'}</td>
                          <td style={{ padding: '.4rem .6rem', fontSize: '.74rem', color: 'var(--txt-muted)' }}>{r.tipe || '-'}</td>
                          <td style={{ padding: '.4rem .6rem', fontSize: '.74rem', color: 'var(--txt-muted)' }}>{r.alokasi}</td>
                          <td style={{ padding: '.4rem .6rem', fontSize: '.74rem', color: 'var(--txt-muted)' }}>{r.statusSmr || '-'}</td>
                          <td style={{ padding: '.4rem .6rem', fontSize: '.74rem', color: 'var(--txt-muted)' }}>{r.tahun || '-'}</td>
                          <td style={tdAngka}>{r.jumlah.toLocaleString('id-ID')} {r.satuan}</td>
                          <td style={{ ...tdAngka, fontWeight: 600 }}>
                            {r.totalHarga
                              ? rupiahPenuh(r.totalHarga)
                              : r.hargaEstimasi
                                ? <span title="Diestimasi dari pembelian dengan nama & tanggal terdekat di Barang Masuk — bukan harga tercatat langsung, karena sheet aset tidak punya kolom harga." style={{ fontStyle: 'italic', opacity: .75, fontWeight: 500, cursor: 'help' }}>≈ {rupiahPenuh(r.hargaEstimasi)}</span>
                                : '-'}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  {!dataAsetTampil.length && (
                    <tr><td colSpan={10} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--txt-muted)', fontSize: '.78rem' }}>
                      Tidak ada aset yang cocok dengan pencarian.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.25rem', marginTop: '1rem', fontSize: '.78rem', color: 'var(--txt-muted)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--txt-primary)' }}>NB:</strong> {labelPenuh(labelSite).toUpperCase()} memiliki{' '}
            <strong style={{ color: '#60A5FA' }}>{aset.baris}</strong> baris aset terdaftar di{' '}
            <strong style={{ color: '#60A5FA' }}>{aset.lokasiUnik}</strong> lokasi
            {aset.nilai > 0 && <> , dengan nilai tercatat <strong style={{ color: '#60A5FA' }}>{rupiahPenuh(aset.nilai)}</strong></>}
            {aset.nilaiEstimasi > 0 && <> {aset.nilai > 0 ? 'ditambah' : 'dengan'} estimasi <strong style={{ color: '#FBBF24' }}>{rupiahPenuh(aset.nilaiEstimasi)}</strong> lagi (kolom bertanda “≈”) dari harga pembelian di Barang Masuk yang nama & tanggalnya paling cocok</>}
            . Kolom Kategori/Merk/Type/Tahun
            diambil langsung dari kolom "Jenis"/"Merk"/"Type"/"Tahun" di sheet — kosong (“-”) berarti sel itu memang
            kosong di spreadsheet. Daftar ini diambil dari tab “LIST ALL ASET {labelPenuh(labelSite).toUpperCase()}” pada
            Google Spreadsheet site — atur di panel Sumber Sheet kalau nama tabnya berbeda.
          </div>
        </>
      )}
      </>
      )}
    </>

  );
}