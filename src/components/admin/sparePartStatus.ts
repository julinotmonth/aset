import type { SparePart } from '../../types';

export type StatusSparePart = SparePart['status'];

/** Status stok dari jumlah stok & batas minimum. Aturannya sama dengan form
 *  Tambah/Edit Spare Part. Item yang sudah ditandai "Maintenance Needed"
 *  tetap dipertahankan — itu keputusan manual, bukan hasil hitungan stok. */
export function hitungStatusStok(stock: number, minStock: number, saatIni?: StatusSparePart): StatusSparePart {
  if (saatIni === 'Maintenance Needed') return 'Maintenance Needed';
  if (stock <= 0) return 'Critical';
  if (stock <= minStock / 2) return 'Critical';
  if (stock <= minStock) return 'Low Stock';
  return 'In Stock';
}

/** Status yang ditampilkan — dihitung ulang dari stok agar badge tidak
 *  basi bila data dimutakhirkan dari luar (impor, transfer, dsb.). */
export const statusEfektif = (p: Pick<SparePart, 'stock' | 'minStock' | 'status'>): StatusSparePart =>
  hitungStatusStok(p.stock, p.minStock, p.status);

export const PERLU_TINDAKAN = (s: StatusSparePart): boolean => s === 'Low Stock' || s === 'Critical';