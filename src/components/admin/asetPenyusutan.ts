// Penyusutan aset untuk tab "Asset Management" (LIST ALL ASET).
//
// Metode: garis lurus (straight-line), nilai sisa 0.
//   % susut   = min(umur aset ÷ umur ekonomis, 1) × 100
//   nilai buku = harga perolehan × (1 − % susut)
//
// Umur ekonomis mengikuti kelompok harta berwujud bukan bangunan (PMK 96/2009):
//   Kelompok 1 = 4 tahun (perabot kantor, peralatan elektronik/kantor)
//   Kelompok 2 = 8 tahun (mesin & peralatan operasional)
// SEMUA angka ada di UMUR_EKONOMIS di bawah — ubah di sini bila kebijakan
// akuntansi perusahaan berbeda.
//
// Umur dihitung dari tanggal perolehan di sheet. Bila sheet hanya berisi
// tahun, dipakai konvensi tengah tahun (1 Juli). Aset tanpa harga atau tanpa
// tahun perolehan TIDAK disusutkan (bukan ditebak) dan ditandai `dihitung: false`.
import type { KelasAset } from './asetKlasifikasi';

export const NILAI_SISA_PERSEN = 0;

/** Umur ekonomis (tahun) per kelas / sub-kategori. Sub tak terdaftar memakai `bawaan` kelasnya. */
export const UMUR_EKONOMIS: Record<KelasAset, { bawaan: number; sub?: Record<string, number> }> = {
  Equipment: { bawaan: 8 },
  Building: { bawaan: 4, sub: { Electrical: 4, ATK: 4, Furniture: 4, Lainnya: 4 } },
  'Belum Terklasifikasi': { bawaan: 8 },
};

export const umurEkonomis = (kelas: KelasAset, sub: string): number =>
  UMUR_EKONOMIS[kelas].sub?.[sub] ?? UMUR_EKONOMIS[kelas].bawaan;

export interface Susut {
  dihitung: boolean;
  umurEkonomis: number;
  /** Umur aset sejak perolehan, dalam tahun (desimal). */
  umurAset: number;
  hargaPerolehan: number;
  persenSusut: number;
  akumulasiSusut: number;
  nilaiBuku: number;
}

export function hitungSusut(
  r: { tanggal: string | null; tahun: number; totalHarga: number; hargaEstimasi?: number; kelas: KelasAset; sub: string },
  sekarang: Date = new Date(),
): Susut {
  const umurEko = umurEkonomis(r.kelas, r.sub);
  const harga = r.totalHarga || r.hargaEstimasi || 0;
  const awal = r.tanggal ? new Date(`${r.tanggal.slice(0, 10)}T00:00:00`)
    : r.tahun > 1900 ? new Date(r.tahun, 6, 1) : null;
  if (!harga || !awal || Number.isNaN(awal.getTime())) {
    return { dihitung: false, umurEkonomis: umurEko, umurAset: 0, hargaPerolehan: harga, persenSusut: 0, akumulasiSusut: 0, nilaiBuku: harga };
  }
  const umurAset = Math.max((sekarang.getTime() - awal.getTime()) / (365.25 * 24 * 3600 * 1000), 0);
  const porsi = Math.min(umurAset / umurEko, 1);
  const persen = porsi * (100 - NILAI_SISA_PERSEN);
  const akumulasi = Math.round(harga * persen / 100);
  return {
    dihitung: true, umurEkonomis: umurEko, umurAset, hargaPerolehan: harga,
    persenSusut: persen, akumulasiSusut: akumulasi, nilaiBuku: harga - akumulasi,
  };
}