// Daftar site untuk halaman publik (Vision/Inspeksi Site + Footer).
//
// Sumber kebenaran: site yang sama dengan halaman Laporan Mingguan
// (server/src/migrate.js + server/src/weeklyReport.js):
//   setu, indramayu (label tampilan "WS Cibungur"), blora, wunut, kht,
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

// URUTAN di bawah = urutan tampil di kartu jaringan, tab inspeksi, dan footer:
// Mother Station Setu → KHT → Blora → Wunut → LNG Sangkulirang → Workshop.
// Warna aksen sengaja dipilih terang (kontras ≥ 8:1 di atas panel gelap) agar
// tetap terbaca jelas saat ditampilkan di layar lebar / proyektor.
export const PUBLIC_SITES: PublicSite[] = [
  {
    key: 'setu', label: 'Mother Station Setu', short: 'Mother Station Setu', color: '#00D084',
    title: 'Mother Station CNG Setu',
    role: 'Pusat Kompresi & Distribusi Utama JABODETABEK',
    desc: 'Fasilitas Mother Station berkapasitas kompresi tinggi di Setu, Bekasi, yang menyalurkan gas alam terkompresi (CNG) ke berbagai kawasan industri manufaktur di Jawa Barat dan sekitarnya.',
    capacity: '3.5 MMSCFD', activeSpareParts: 142,
    image: '/assets/images/gallery-5.webp',
    features: ['24/7 High-pressure Compression', 'Dedicated Workshop & Test Bench', 'Fleet Room & Real-time Telemetry Control Room'],
    status: { IDN: '24/7 Pasokan Aktif', ENG: '24/7 Active Supply' }, statusLabel: 'OPERATIONAL',
    footerName: 'Mother Station Setu',
    footerDetail: 'Setu, Bekasi, Jawa Barat. Pusat Kompresi Utama CNG, Fleet Room & Stasiun Kompresi.',
  },
  {
    key: 'kht', label: 'Mother Station KHT', short: 'Mother Station KHT', color: '#FDA25C',
    title: 'Mother Station KHT',
    role: 'Pasokan CNG',
    desc: 'Mother Station CNG KHT sebagai bagian dari jaringan pasokan CNG Reethau.',
    image: '/assets/images/cng-cylinder.webp',
    features: FEATURES_UMUM,
    status: { IDN: 'Pasokan Aktif', ENG: 'Active Supply' }, statusLabel: 'OPERATIONAL',
    footerName: 'Mother Station KHT',
    footerDetail: 'Mother Station CNG KHT.',
  },
  {
    key: 'blora', label: 'Mother Station Blora', short: 'Mother Station Blora', color: '#FCD34D',
    title: 'Mother Station Blora',
    role: 'Pasokan CNG',
    desc: 'Mother Station CNG Blora sebagai bagian dari jaringan pasokan CNG Reethau.',
    activeSpareParts: 85,
    image: '/assets/images/cng-cylinder.webp',
    features: FEATURES_UMUM,
    status: { IDN: 'Pasokan Aktif', ENG: 'Active Supply' }, statusLabel: 'OPERATIONAL',
    footerName: 'Mother Station Blora',
    footerDetail: 'Mother Station CNG Blora.',
  },
  {
    key: 'wunut', label: 'Mother Station Wunut', short: 'Mother Station Wunut', color: '#5CCBFF',
    title: 'Mother Station Wunut',
    role: 'Pasokan CNG',
    desc: 'Mother Station CNG Wunut sebagai bagian dari jaringan pasokan CNG Reethau.',
    image: '/assets/images/cng-cylinder.webp',
    features: FEATURES_UMUM,
    status: { IDN: 'Pasokan Aktif', ENG: 'Active Supply' }, statusLabel: 'OPERATIONAL',
    footerName: 'Mother Station Wunut',
    footerDetail: 'Mother Station CNG Wunut.',
  },
  {
    key: 'sangkulirang', label: 'LNG Sangkulirang', short: 'LNG Sangkulirang', color: '#C4B5FD',
    title: 'LNG Sangkulirang',
    role: 'Fasilitas LNG & Pengelolaan ISO Tank',
    desc: 'Fasilitas LNG Reethau yang juga mengelola kontainer ISO Tank untuk distribusi LNG.',
    image: '/assets/images/lng-storage.webp',
    features: ['Fasilitas LNG', 'Pengelolaan Kontainer ISO Tank', ...FEATURES_UMUM.slice(1)],
    status: { IDN: 'Fasilitas LNG Aktif', ENG: 'LNG Facility Active' }, statusLabel: 'OPERATIONAL',
    footerName: 'LNG Sangkulirang',
    footerDetail: 'Fasilitas LNG & pengelolaan ISO Tank.',
  },
  {
    // key tetap 'indramayu' — dipakai di database/laporan; hanya tampilan publiknya "Workshop".
    key: 'indramayu', label: 'Workshop', short: 'Workshop', color: '#7DB9FF',
    title: 'Workshop',
    role: 'Workshop Armada Kendaraan',
    desc: 'Workshop perawatan dan perbaikan armada kendaraan Reethau, termasuk pencatatan penggunaan part dan oli untuk menjaga keandalan armada.',
    image: '/assets/images/distribution-truck.webp',
    features: ['Perawatan & Perbaikan Armada', 'Pencatatan Part Maintenance & Oli', ...FEATURES_UMUM.slice(1)],
    status: { IDN: 'Workshop Aktif', ENG: 'Workshop Active' }, statusLabel: 'ACTIVE',
    footerName: 'Workshop',
    footerDetail: 'Workshop perawatan & perbaikan armada kendaraan.',
  },
];

export const getPublicSite = (key: PublicSiteKey): PublicSite =>
  PUBLIC_SITES.find((s) => s.key === key) ?? PUBLIC_SITES[0];