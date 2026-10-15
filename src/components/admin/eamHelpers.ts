// Helper murni untuk menu Aset Tetap & Jadwal Maintenance (tanpa React).
import type { FixedAsset, WorkOrder } from '../../types';

const HARI_MS = 86_400_000;
const TAHUN_MS = 365.25 * HARI_MS; // sama dengan perhitungan depresiasi di server

export const hariIni = (): string => new Date().toISOString().split('T')[0];

/** Selisih hari kalender (b − a) untuk dua string YYYY-MM-DD. */
export const selisihHari = (a: string, b: string): number =>
  Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / HARI_MS);

export const tambahBulan = (tgl: string, bulan: number): string => {
  const d = new Date(`${tgl}T00:00:00`);
  const hari = d.getDate();
  d.setMonth(d.getMonth() + bulan);
  if (d.getDate() !== hari) d.setDate(0); // 31 Jan + 1 bln → 28/29 Feb, bukan 3 Mar
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const fmtTanggal = (tgl?: string): string => {
  if (!tgl) return '—';
  const d = new Date(`${tgl}T00:00:00`);
  return Number.isNaN(d.getTime()) ? tgl : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const angka = (n: number): string => new Intl.NumberFormat('id-ID').format(n);

export function rupiahRingkas(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`;
  if (a >= 1_000_000) return `Rp ${(v / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  return `Rp ${v.toLocaleString('id-ID')}`;
}

/** Sel CSV aman: kutip digandakan; awalan rumus (= + - @) dinetralkan agar
 *  teks yang diketik pengguna tidak dieksekusi sebagai rumus di Excel. */
const sel = (v: unknown): string => {
  let t = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
};
export function unduhCsv(namaFile: string, baris: (string | number | undefined)[][]): void {
  const csv = '\uFEFF' + baris.map((r) => r.map(sel).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = namaFile;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ── Aset tetap ──────────────────────────────────────────────────────────

/** Sisa umur ekonomis dalam tahun (0 bila sudah habis disusutkan). */
export const sisaUmurTahun = (a: FixedAsset): number => {
  if (a.fullyDepreciated) return 0;
  const lifeMs = Math.max(a.usefulLifeYears, 1) * TAHUN_MS;
  const elapsed = Math.max(Date.now() - new Date(a.acquisitionDate).getTime(), 0);
  return Math.max((lifeMs - elapsed) / TAHUN_MS, 0);
};

export const fmtSisaUmur = (a: FixedAsset): string => {
  if (a.fullyDepreciated) return 'Habis disusutkan';
  const t = sisaUmurTahun(a);
  return t >= 1 ? `Sisa ${t.toLocaleString('id-ID', { maximumFractionDigits: 1 })} th` : `Sisa ${Math.max(Math.round(t * 12), 1)} bln`;
};

export type StatusGaransi = 'tidak-ada' | 'aktif' | 'segera' | 'habis';
export interface InfoGaransi { status: StatusGaransi; sisaHari: number | null }
/** "Segera" = berakhir dalam ≤ 90 hari. */
export function infoGaransi(a: FixedAsset): InfoGaransi {
  if (!a.warrantyExpiry) return { status: 'tidak-ada', sisaHari: null };
  const sisa = selisihHari(hariIni(), a.warrantyExpiry);
  return { status: sisa < 0 ? 'habis' : sisa <= 90 ? 'segera' : 'aktif', sisaHari: sisa };
}

export interface BarisJadwal {
  tahun: number;          // tahun ke-n sejak perolehan
  tanggal: string;        // akhir tahun ke-n
  penyusutan: number;     // beban tahun itu
  akumulasi: number;
  nilaiBuku: number;
  berjalan: boolean;      // tahun yang sedang berjalan hari ini
  lewat: boolean;
}
/** Jadwal penyusutan garis lurus per tahun — rumus identik dengan server. */
export function jadwalPenyusutan(a: FixedAsset): BarisJadwal[] {
  const umur = Math.max(a.usefulLifeYears, 1);
  const dasar = Math.max(a.acquisitionCost - a.salvageValue, 0);
  const tahunan = dasar / umur;
  const mulai = new Date(a.acquisitionDate).getTime();
  const kini = Date.now();
  const hasil: BarisJadwal[] = [];
  for (let n = 1; n <= umur; n += 1) {
    const akhir = mulai + n * TAHUN_MS;
    const akum = Math.min(tahunan * n, dasar);
    hasil.push({
      tahun: n,
      tanggal: new Date(akhir).toISOString().split('T')[0],
      penyusutan: Math.round(Math.min(tahunan, Math.max(dasar - tahunan * (n - 1), 0))),
      akumulasi: Math.round(akum),
      nilaiBuku: Math.round(Math.max(a.acquisitionCost - akum, a.salvageValue)),
      berjalan: kini > akhir - TAHUN_MS && kini <= akhir,
      lewat: kini > akhir,
    });
  }
  return hasil;
}

// ── Work order ──────────────────────────────────────────────────────────

export const WO_TERBUKA = (s: WorkOrder['status']): boolean => s === 'Scheduled' || s === 'Overdue' || s === 'In Progress';

export interface InfoJatuhTempo { teks: string; nada: 'telat' | 'hari-ini' | 'dekat' | 'normal' | 'selesai' }
export function infoJatuhTempo(w: WorkOrder): InfoJatuhTempo {
  if (w.status === 'Completed') return { teks: w.completedDate ? `Selesai ${fmtTanggal(w.completedDate)}` : 'Selesai', nada: 'selesai' };
  if (w.status === 'Cancelled') return { teks: 'Dibatalkan', nada: 'selesai' };
  const d = selisihHari(hariIni(), w.dueDate);
  if (d < 0) return { teks: `Terlambat ${angka(-d)} hari`, nada: 'telat' };
  if (d === 0) return { teks: 'Jatuh tempo hari ini', nada: 'hari-ini' };
  if (d <= 7) return { teks: `${d} hari lagi`, nada: 'dekat' };
  return { teks: `${d} hari lagi`, nada: 'normal' };
}

/** Status yang ditampilkan: Scheduled/In Progress yang lewat tenggat tampil sebagai Overdue. */
export const statusWo = (w: WorkOrder): WorkOrder['status'] =>
  (w.status === 'Scheduled' || w.status === 'In Progress') && selisihHari(hariIni(), w.dueDate) < 0 ? 'Overdue' : w.status;

export const BOBOT_PRIORITAS: Record<WorkOrder['priority'], number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
