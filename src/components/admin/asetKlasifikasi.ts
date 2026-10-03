// Klasifikasi daftar aset (tab "Daftar Aset") ke dua tingkat supaya mudah
// dianalisis:
//
//   Kelas  → Equipment | Building | Belum Terklasifikasi
//   Sub    → Equipment: mengikuti kolom "Jenis" di sheet (Tools Mekanik, ...)
//            Building : Electrical | ATK | Furniture | Lainnya
//
// Sheet "LIST ALL ASET" hanya punya kolom "Jenis" (ALAT KANTOR, TOOLS
// INVENTORY, TOOLS MEKANIK, ...), tidak ada konsep Equipment/Building, jadi
// klasifikasi diturunkan dari aturan kata kunci di bawah. SEMUA aturan ada di
// berkas ini — kalau ada Jenis baru atau pemetaan yang kurang pas, cukup ubah
// daftar kata kunci di sini. Aset yang tak cocok aturan mana pun TIDAK
// ditebak: masuk "Belum Terklasifikasi" dan Jenis-nya ditampilkan di UI.

export type KelasAset = 'Equipment' | 'Building' | 'Belum Terklasifikasi';
export const URUT_KELAS: KelasAset[] = ['Equipment', 'Building', 'Belum Terklasifikasi'];
export const URUT_SUB_BUILDING = ['Electrical', 'ATK', 'Furniture', 'Lainnya'];

export interface Klasifikasi { kelas: KelasAset; sub: string }

// ── Aturan: kolom "Jenis" → Kelas (cocok sebagian kata, huruf besar/kecil bebas) ──
const JENIS_BUILDING = /kantor|office|building|gedung|bangunan|furnitur|mebel|\batk\b|listrik|electric|elektronik/;
const JENIS_EQUIPMENT = /tool|equipment|peralatan|mesin|kendaraan|vaporizer|kompresor|compressor|crane|skid|iso ?tank|\bprs\b|reach|forklift|pompa|alat berat|genset|control panel|\bhse\b|chasis|\bht\b|\bts\b/;

// ── Aturan: nama/type aset → Sub Building (cocok kata utuh) ──
// Urutan penting: Electrical dicek dulu ("lemari es" = electrical, bukan furniture).
const KATA_ELECTRICAL = [
  'ac', 'air conditioner', 'split', 'lampu', 'lamp', 'kipas', 'fan', 'tv', 'televisi', 'monitor', 'dispenser',
  'kulkas', 'lemari es', 'freezer', 'genset', 'stabilizer', 'ups', 'kabel', 'stop kontak', 'mcb', 'panel', 'cctv',
  'printer', 'scanner', 'laptop', 'komputer', 'computer', 'pc', 'proyektor', 'projector', 'router', 'access point',
  'speaker', 'microphone', 'mic', 'mesin absen', 'fingerprint', 'handy talky', 'radio', 'telepon', 'telephone',
  'pompa air', 'water heater', 'rice cooker', 'magic com', 'microwave', 'setrika', 'vacuum cleaner', 'charger',
  'baterai', 'battery', 'inverter', 'solar', 'mesin cuci', 'fotocopy', 'photocopy', 'shredder', 'laminator',
];
const KATA_ATK = [
  'atk', 'alat tulis', 'stapler', 'hekter', 'perforator', 'punch', 'whiteboard', 'white board', 'papan tulis',
  'kalkulator', 'mesin hitung', 'gunting', 'penggaris', 'pulpen', 'spidol', 'binder', 'box file', 'ordner',
  'stempel', 'paper cutter', 'cutter', 'lakban', 'map', 'klip',
];
const KATA_FURNITURE = [
  'meja', 'kursi', 'lemari', 'rak', 'rack', 'shelf', 'sofa', 'loker', 'locker', 'filing', 'brankas', 'kasur', 'tempat tidur',
  'karpet', 'gorden', 'tirai', 'partisi', 'bangku', 'jam dinding', 'cermin', 'tikar',
];

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
const cocokKata = (teksNorm: string, kata: string[]) => kata.some((k) => teksNorm.includes(` ${k} `));
const judul = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** Sub-kategori Building dari nama/type aset; null kalau tak ada kata kunci yang cocok. */
function subBuilding(nama: string, tipe: string): string | null {
  const t = norm(`${nama} ${tipe}`);
  if (cocokKata(t, KATA_ELECTRICAL)) return 'Electrical';
  if (cocokKata(t, KATA_ATK)) return 'ATK';
  if (cocokKata(t, KATA_FURNITURE)) return 'Furniture';
  return null;
}

export function klasifikasiAset(r: { jenis?: string; namaBarang?: string; tipe?: string }): Klasifikasi {
  const jenis = (r.jenis ?? '').trim();
  const jenisLower = jenis.toLowerCase();
  const nama = r.namaBarang ?? '';
  const tipe = r.tipe ?? '';

  if (jenis && JENIS_BUILDING.test(jenisLower)) {
    return { kelas: 'Building', sub: subBuilding(nama, tipe) ?? 'Lainnya' };
  }
  if (jenis && JENIS_EQUIPMENT.test(jenisLower)) {
    return { kelas: 'Equipment', sub: judul(jenis) };
  }
  // Jenis kosong / tak dikenal: hanya naik kelas ke Building kalau namanya jelas
  // barang kantor; selebihnya sengaja tidak ditebak.
  const sb = subBuilding(nama, tipe);
  if (sb) return { kelas: 'Building', sub: sb };
  return { kelas: 'Belum Terklasifikasi', sub: jenis ? judul(jenis) : 'Jenis kosong' };
}

export function tambahKlasifikasi<T extends { jenis?: string; namaBarang?: string; tipe?: string }>(
  baris: T[],
): (T & Klasifikasi)[] {
  return baris.map((r) => ({ ...r, ...klasifikasiAset(r) }));
}

// ── Ringkasan per kelas & sub (untuk panel analisis) ─────────────────────
export interface RingkasSub { nama: string; jumlahAset: number; jumlahBarang: number; nilai: number }
export interface RingkasKelas {
  kelas: KelasAset; jumlahAset: number; jumlahBarang: number; nilai: number; subs: RingkasSub[];
}
interface BarisHitung extends Klasifikasi { jumlah: number; totalHarga: number; hargaEstimasi?: number }

/** Nilai satu baris: harga tercatat, atau estimasi kalau sheet tak punya harga. */
export const nilaiBaris = (r: { totalHarga: number; hargaEstimasi?: number }) => r.totalHarga || r.hargaEstimasi || 0;

/** Urutan sub di dalam satu kelas: Building mengikuti urutan tetap, lainnya terbanyak dulu. */
export function bandingkanSub(
  kelas: KelasAset, a: { nama: string; jumlahAset: number }, b: { nama: string; jumlahAset: number },
): number {
  if (kelas === 'Building') {
    const ia = URUT_SUB_BUILDING.indexOf(a.nama), ib = URUT_SUB_BUILDING.indexOf(b.nama);
    if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  }
  return b.jumlahAset - a.jumlahAset || a.nama.localeCompare(b.nama);
}

export function ringkasKlasifikasi(baris: BarisHitung[]): RingkasKelas[] {
  const peta = new Map<KelasAset, RingkasKelas>();
  for (const r of baris) {
    let k = peta.get(r.kelas);
    if (!k) { k = { kelas: r.kelas, jumlahAset: 0, jumlahBarang: 0, nilai: 0, subs: [] }; peta.set(r.kelas, k); }
    let s = k.subs.find((x) => x.nama === r.sub);
    if (!s) { s = { nama: r.sub, jumlahAset: 0, jumlahBarang: 0, nilai: 0 }; k.subs.push(s); }
    const v = nilaiBaris(r);
    for (const x of [k, s]) { x.jumlahAset += 1; x.jumlahBarang += r.jumlah; x.nilai += v; }
  }
  return URUT_KELAS.filter((k) => peta.has(k)).map((k) => {
    const rk = peta.get(k)!;
    rk.subs.sort((a, b) => bandingkanSub(k, a, b));
    return rk;
  });
}

/** Nilai "Jenis" mentah dari sheet yang belum dikenali aturan (untuk ditampilkan di UI). */
export function jenisTakDikenal(baris: (Klasifikasi & { jenis?: string })[]): { jenis: string; jumlah: number }[] {
  const peta = new Map<string, number>();
  for (const r of baris) {
    if (r.kelas !== 'Belum Terklasifikasi') continue;
    const j = (r.jenis ?? '').trim() || '(kosong)';
    peta.set(j, (peta.get(j) ?? 0) + 1);
  }
  return [...peta.entries()].map(([jenis, jumlah]) => ({ jenis, jumlah })).sort((a, b) => b.jumlah - a.jumlah);
}