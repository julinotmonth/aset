// Daftar site untuk halaman publik (Vision/Inspeksi Site + Footer).
//
// Sumber kebenaran: site yang sama dengan halaman Laporan Mingguan
// (server/src/migrate.js + server/src/weeklyReport.js):
//   setu, indramayu (label tampilan "WS Dawuan"), blora, wunut, kht,
//   sangkulirang. MS Bekasi dan MS Setu adalah satu lokasi yang sama
//   (Setu, Bekasi), jadi di halaman publik hanya ditampilkan sebagai MS Setu.
// Halaman publik tidak login, jadi tidak bisa memanggil GET /api/sites —
// daftar ini sengaja ditulis statis. Kalau menambah site baru di sistem,
// tambahkan juga di sini. `key` HARUS sama dengan key di tabel `sites`.

export type PublicSiteKey =
  | 'indramayu' | 'blora' | 'setu' | 'wunut' | 'kht' | 'sangkulirang';

type L = { IDN: string; ENG: string };

export interface PublicSite {
  key: PublicSiteKey;
  /** Label seperti di Laporan Mingguan (MS/WS/LNG + nama). */
  label: string;
  /** Nama pendek untuk tab. */
  short: string;
  color: string;
  title: string;
  role: string;
  desc: string;
  /** Opsional — hanya ditampilkan bila datanya memang ada. */
  capacity?: string;
  activeSpareParts?: number;
  image: string;
  features: string[];
  status: L;
  statusLabel: string;
  /** Deskripsi singkat untuk footer. */
  footerName: string;
  footerDetail: string;
}

const FEATURES_UMUM = [
  'Pencatatan Barang Masuk & Keluar Mingguan',
  'Monitoring Aset & Work Order',
  'Pelacakan Isu & Corrective Action (PICA)',
];

export const PUBLIC_SITES: PublicSite[] = [
  {
    key: 'setu', label: 'MS Setu', short: 'Setu', color: '#00D084',
    title: 'Mother Station CNG Setu',
    role: 'Pusat Kompresi & Distribusi Utama JABODETABEK',
    desc: 'Fasilitas Mother Station berkapasitas kompresi tinggi di Setu, Bekasi, yang menyalurkan gas alam terkompresi (CNG) ke berbagai kawasan industri manufaktur di Jawa Barat dan sekitarnya.',
    capacity: '3.5 MMSCFD', activeSpareParts: 142,
    image: '/assets/images/gallery-5.webp',
    features: ['24/7 High-pressure Compression', 'Dedicated Workshop & Test Bench', 'Fleet Room & Real-time Telemetry Control Room'],
    status: { IDN: '24/7 Pasokan Aktif', ENG: '24/7 Active Supply' }, statusLabel: 'OPERATIONAL',
    footerName: 'MS Setu (Mother Station)',
    footerDetail: 'Setu, Bekasi, Jawa Barat. Pusat Kompresi Utama CNG, Fleet Room & Stasiun Kompresi.',
  },
  {
    key: 'indramayu', label: 'WS Dawuan', short: 'Dawuan', color: '#60A5FA',
    title: 'Workshop Armada Dawuan',
    role: 'Workshop Armada Kendaraan',
    desc: 'Workshop perawatan dan perbaikan armada kendaraan Reethau, termasuk pencatatan penggunaan part dan oli untuk menjaga keandalan armada.',
    image: '/assets/images/distribution-truck.webp',
    features: ['Perawatan & Perbaikan Armada', 'Pencatatan Part Maintenance & Oli', ...FEATURES_UMUM.slice(1)],
    status: { IDN: 'Workshop Aktif', ENG: 'Workshop Active' }, statusLabel: 'ACTIVE',
    footerName: 'WS Dawuan (Workshop Armada)',
    footerDetail: 'Workshop perawatan & perbaikan armada kendaraan.',
  },
  {
    key: 'blora', label: 'MS Blora', short: 'Blora', color: '#FBBF24',
    title: 'Wellhead & Biomass Facility Blora',
    role: 'Sumur Gas Alam & Pabrik Pengolahan Biomassa',
    desc: 'Pusat ekstrasi sumur gas alam dan pengolahan limbah kayu menjadi woodchip dan biomassa terbarukan berkadar air rendah (<20%) dengan standar netral karbon.',
    capacity: '500 Tons Biomass/Mo + Gas', activeSpareParts: 85,
    image: '/assets/images/biomass.webp',
    features: ['Woodchip Drying & Sizing Line', 'Raw Gas Pre-treatment', 'Biomass Quality Control Lab'],
    status: { IDN: 'Feedstock Aktif', ENG: 'Feedstock Active' }, statusLabel: 'PRODUCTION',
    footerName: 'MS Blora (Wellhead & Biomass)',
    footerDetail: 'Fasilitas Ekstraksi Gas Sumur & Woodchip Processing.',
  },
  {
    key: 'wunut', label: 'MS Wunut', short: 'Wunut', color: '#38BDF8',
    title: 'Mother Station Wunut',
    role: 'Mother Station CNG',
    desc: 'Mother Station CNG Wunut sebagai bagian dari jaringan pasokan CNG Reethau.',
    image: '/assets/images/cng-cylinder.webp',
    features: FEATURES_UMUM,
    status: { IDN: 'Mother Station Aktif', ENG: 'Mother Station Active' }, statusLabel: 'OPERATIONAL',
    footerName: 'MS Wunut (Mother Station)',
    footerDetail: 'Mother Station CNG Wunut.',
  },
  {
    key: 'kht', label: 'MS KHT', short: 'KHT', color: '#FB923C',
    title: 'Mother Station KHT',
    role: 'Mother Station CNG',
    desc: 'Mother Station CNG KHT sebagai bagian dari jaringan pasokan CNG Reethau.',
    image: '/assets/images/cng-cylinder.webp',
    features: FEATURES_UMUM,
    status: { IDN: 'Mother Station Aktif', ENG: 'Mother Station Active' }, statusLabel: 'OPERATIONAL',
    footerName: 'MS KHT (Mother Station)',
    footerDetail: 'Mother Station CNG KHT.',
  },
  {
    key: 'sangkulirang', label: 'LNG Sangkulirang', short: 'Sangkulirang', color: '#A78BFA',
    title: 'Fasilitas LNG Sangkulirang',
    role: 'Fasilitas LNG & Pengelolaan ISO Tank',
    desc: 'Fasilitas LNG Reethau yang juga mengelola kontainer ISO Tank untuk distribusi LNG.',
    image: '/assets/images/lng-storage.webp',
    features: ['Fasilitas LNG', 'Pengelolaan Kontainer ISO Tank', ...FEATURES_UMUM.slice(1)],
    status: { IDN: 'Fasilitas LNG Aktif', ENG: 'LNG Facility Active' }, statusLabel: 'OPERATIONAL',
    footerName: 'LNG Sangkulirang',
    footerDetail: 'Fasilitas LNG & pengelolaan ISO Tank.',
  },
];

export const getPublicSite = (key: PublicSiteKey): PublicSite =>
  PUBLIC_SITES.find((s) => s.key === key) ?? PUBLIC_SITES[0];