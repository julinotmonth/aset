// Lapisan data untuk menu Spare Part & Transfer Antar Site.
//
// Sumber: baris Laporan Mingguan (Barang Masuk / Barang Keluar) dari SEMUA site.
// Yang dihitung sebagai "spare part" hanyalah baris yang kolom Kode-nya diawali
// "I-RDA" (PT Reethau Dharma Andalan) atau "I-RCE" (Reethau Clean Energy); kode lain
// (aset, ISO Tank, jasa, dst.) diabaikan.
//
// PENTING — saldo di sini = Σ barang masuk − Σ barang keluar pada data laporan. Stok awal
// (sebelum data laporan tercatat) tidak ikut, jadi angka ini adalah ESTIMASI pergerakan,
// bukan hasil stock opname. Antarmuka selalu menyebutnya "saldo pergerakan".
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { AuthState } from '../../types';

// ── Tipe ─────────────────────────────────────────────────────────────────
export interface BarisSp {
  id: string; site: string; direction: 'IN' | 'OUT';
  tanggal: string | null; minggu: number; bulan: number; tahun: number;
  kode: string; namaBarang: string; jumlah: number; satuan: string;
  alokasi: string; detailAlokasi: string; harga: number; totalHarga: number;
}
export type Entitas = 'RDA' | 'RCE';
export type StatusSp = 'Aman' | 'Waspada' | 'Kritis' | 'Tidak Bergerak' | 'Cek Stok';

export interface StatSite {
  site: string; masuk: number; keluar: number; saldo: number; nilaiMasuk: number; nilaiKeluar: number;
  /** Rata-rata pemakaian per minggu pada jendela waktu terakhir. */
  laju: number;
  /** Perkiraan saldo cukup berapa minggu (null bila tidak ada pemakaian). */
  cover: number | null;
  terakhir: number | null;
}
export interface ItemSp {
  kode: string; entitas: Entitas; nama: string; satuan: string;
  masuk: number; keluar: number; saldo: number; nilaiMasuk: number; nilaiKeluar: number;
  hargaRata: number; hargaTerakhir: number; nilaiSaldo: number;
  laju: number; cover: number | null; status: StatusSp;
  pertama: number | null; terakhir: number | null;
  perSite: StatSite[];
  baris: BarisSp[];
}

// ── Pengenal spare part ──────────────────────────────────────────────────
/** Rapikan kode: huruf besar; spasi / tanda pisah lain menjadi "-". */
export const normKode = (k: string): string => String(k ?? '').trim().toUpperCase().replace(/[\u2010-\u2015\s]+/g, '-');
export const entitasDariKode = (k: string): Entitas | null => {
  const m = /^I-(RDA|RCE)/.exec(normKode(k));
  return m ? (m[1] as Entitas) : null;
};
export const adalahSparePart = (k: string): boolean => entitasDariKode(k) !== null;

// ── Waktu ────────────────────────────────────────────────────────────────
const HARI = 86_400_000;
const MINGGU_MS = 7 * HARI;
/** Waktu transaksi (ms). Bila tanggal kosong, diperkirakan dari tahun + nomor minggu. */
export function waktuBaris(r: BarisSp): number | null {
  if (r.tanggal) {
    const t = Date.parse(r.tanggal);
    if (!Number.isNaN(t)) return t;
  }
  if (r.tahun && r.minggu) return new Date(r.tahun, 0, 1).getTime() + (r.minggu - 1) * MINGGU_MS;
  return null;
}
export const fmtTanggal = (ms: number | null): string =>
  ms === null ? '–' : new Date(ms).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Pengambilan data (semua site, dengan cache singkat) ──────────────────
const cache = new Map<string, { t: number; rows: BarisSp[] }>();
const TTL_MS = 60_000;

export interface HasilData { rows: BarisSp[]; memuat: boolean; galat: string; siteTerkunci: boolean; muatUlang: () => void }

export function useDataSparePart(auth: AuthState): HasilData {
  const siteTerkunci = auth.role !== 'Super Admin' && auth.assignedSite !== 'global';
  const site = siteTerkunci ? auth.assignedSite : 'global';
  const [rows, setRows] = useState<BarisSp[]>(() => cache.get(site)?.rows ?? []);
  const [memuat, setMemuat] = useState(!cache.has(site));
  const [galat, setGalat] = useState('');
  const [versi, setVersi] = useState(0);

  useEffect(() => {
    let batal = false;
    const hit = cache.get(site);
    if (hit && Date.now() - hit.t < TTL_MS && versi === 0) { setRows(hit.rows); setMemuat(false); return; }
    setMemuat(true);
    const q = (direction: 'IN' | 'OUT') => `/weekly-reports?${new URLSearchParams({ site, direction })}`;
    Promise.allSettled([api.get<BarisSp[]>(q('IN')), api.get<BarisSp[]>(q('OUT'))]).then(([i, o]) => {
      if (batal) return;
      const gagal: string[] = [];
      const semua: BarisSp[] = [];
      if (i.status === 'fulfilled') semua.push(...i.value); else gagal.push('Barang Masuk');
      if (o.status === 'fulfilled') semua.push(...o.value); else gagal.push('Barang Keluar');
      const sp = semua.filter((r) => adalahSparePart(r.kode)).map((r) => ({
        ...r, jumlah: Number(r.jumlah) || 0, harga: Number(r.harga) || 0, totalHarga: Number(r.totalHarga) || 0,
      }));
      if (gagal.length < 2) cache.set(site, { t: Date.now(), rows: sp });
      setRows(sp);
      setGalat(gagal.length ? `Gagal memuat: ${gagal.join(', ')}.` : '');
      setMemuat(false);
    });
    return () => { batal = true; };
  }, [site, versi]);

  const muatUlang = useCallback(() => { cache.delete(site); setVersi((v) => v + 1); }, [site]);
  return { rows, memuat, galat, siteTerkunci, muatUlang };
}

// ── Agregasi ─────────────────────────────────────────────────────────────
export interface OpsiHitung {
  /** Lebar jendela (minggu) untuk menghitung laju pemakaian. */
  jendelaMinggu: number;
  /** Acuan "sekarang" (ms); dapat dipaksa untuk pengujian. */
  sekarang?: number;
}
export const OPSI_DEFAULT: OpsiHitung = { jendelaMinggu: 12 };

const statusDari = (saldo: number, laju: number, cover: number | null, adaKeluar: boolean): StatusSp => {
  if (saldo <= 0) return adaKeluar ? 'Cek Stok' : 'Tidak Bergerak';
  if (laju <= 0) return 'Tidak Bergerak';
  if (cover !== null && cover < 4) return 'Kritis';
  if (cover !== null && cover < 8) return 'Waspada';
  return 'Aman';
};

/** Satu item per kode; seluruh figur dihitung dari baris yang diberikan (sudah difilter). */
export function bangunItem(rows: BarisSp[], opsi: OpsiHitung = OPSI_DEFAULT): ItemSp[] {
  const sekarang = opsi.sekarang ?? Date.now();
  const batasJendela = sekarang - opsi.jendelaMinggu * MINGGU_MS;
  const peta = new Map<string, BarisSp[]>();
  for (const r of rows) {
    const k = normKode(r.kode);
    const arr = peta.get(k);
    if (arr) arr.push(r); else peta.set(k, [r]);
  }

  const hasil: ItemSp[] = [];
  for (const [kode, baris] of peta) {
    const entitas = entitasDariKode(kode);
    if (!entitas) continue;
    baris.sort((a, b) => (waktuBaris(a) ?? 0) - (waktuBaris(b) ?? 0));

    // Nama & satuan: yang paling sering muncul; kalau seri, yang terbaru.
    const hitung = (f: (r: BarisSp) => string) => {
      const c = new Map<string, number>();
      for (const r of baris) { const v = f(r).trim(); if (v) c.set(v, (c.get(v) ?? 0) + 1); }
      return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    };

    let masuk = 0, keluar = 0, nilaiMasuk = 0, nilaiKeluar = 0, hargaTerakhir = 0;
    let pertama: number | null = null, terakhir: number | null = null;
    const bySite = new Map<string, StatSite & { keluarJendela: number }>();
    for (const r of baris) {
      const t = waktuBaris(r);
      if (t !== null) { pertama = pertama === null ? t : Math.min(pertama, t); terakhir = terakhir === null ? t : Math.max(terakhir, t); }
      let s = bySite.get(r.site);
      if (!s) { s = { site: r.site, masuk: 0, keluar: 0, saldo: 0, nilaiMasuk: 0, nilaiKeluar: 0, laju: 0, cover: null, terakhir: null, keluarJendela: 0 }; bySite.set(r.site, s); }
      if (t !== null) s.terakhir = s.terakhir === null ? t : Math.max(s.terakhir, t);
      if (r.direction === 'IN') {
        masuk += r.jumlah; nilaiMasuk += r.totalHarga; s.masuk += r.jumlah; s.nilaiMasuk += r.totalHarga;
        const hargaSatuan = r.harga || (r.jumlah ? r.totalHarga / r.jumlah : 0);
        if (hargaSatuan > 0) hargaTerakhir = hargaSatuan;
      } else {
        keluar += r.jumlah; nilaiKeluar += r.totalHarga; s.keluar += r.jumlah; s.nilaiKeluar += r.totalHarga;
        if (t !== null && t >= batasJendela) s.keluarJendela += r.jumlah;
      }
    }

    const hargaRata = masuk > 0 && nilaiMasuk > 0 ? nilaiMasuk / masuk : keluar > 0 && nilaiKeluar > 0 ? nilaiKeluar / keluar : hargaTerakhir;
    const perSite: StatSite[] = [...bySite.values()].map(({ keluarJendela, ...s }) => {
      const saldo = s.masuk - s.keluar;
      const laju = keluarJendela / opsi.jendelaMinggu;
      return { ...s, saldo, laju, cover: laju > 0 ? Math.max(saldo, 0) / laju : null };
    }).sort((a, b) => b.nilaiKeluar - a.nilaiKeluar);

    const saldo = masuk - keluar;
    const laju = perSite.reduce((t, s) => t + s.laju, 0);
    const cover = laju > 0 ? Math.max(saldo, 0) / laju : null;
    hasil.push({
      kode, entitas, nama: hitung((r) => r.namaBarang), satuan: hitung((r) => r.satuan),
      masuk, keluar, saldo, nilaiMasuk, nilaiKeluar, hargaRata, hargaTerakhir,
      nilaiSaldo: Math.max(saldo, 0) * hargaRata, laju, cover,
      status: statusDari(saldo, laju, cover, keluar > 0), pertama, terakhir, perSite, baris,
    });
  }
  return hasil;
}

// ── Rekomendasi transfer antar site ──────────────────────────────────────
export interface ParamTransfer {
  /** Target kecukupan stok di site penerima (minggu pemakaian). */
  targetMinggu: number;
  /** Site dianggap punya kelebihan bila saldonya mencukupi ≥ ini (minggu). */
  batasSurplusMinggu: number;
  /** Jendela perhitungan laju pemakaian (minggu). */
  jendelaMinggu: number;
}
export const PARAM_TRANSFER_DEFAULT: ParamTransfer = { targetMinggu: 8, batasSurplusMinggu: 16, jendelaMinggu: 12 };

export type Urgensi = 'Tinggi' | 'Sedang' | 'Rendah';
export interface Rekomendasi {
  key: string; kode: string; nama: string; satuan: string; entitas: Entitas;
  dari: string; ke: string; qty: number; nilai: number; hargaRata: number;
  saldoDari: number; coverDari: number | null; lajuDari: number;
  saldoKe: number; coverKe: number | null; lajuKe: number;
  urgensi: Urgensi;
  /** Saldo penerima ≤ 0 pada data laporan: stok awalnya mungkin tidak tercatat — cek fisik dulu. */
  perluVerifikasi: boolean;
}
export interface Kekurangan { kode: string; nama: string; satuan: string; site: string; kurang: number; nilai: number; saldo: number; cover: number | null }
export interface HasilRekomendasi { rekomendasi: Rekomendasi[]; belumTerpenuhi: Kekurangan[]; itemDitinjau: number }

export function hitungRekomendasi(items: ItemSp[], p: ParamTransfer): HasilRekomendasi {
  const rekomendasi: Rekomendasi[] = [];
  const belumTerpenuhi: Kekurangan[] = [];
  let ditinjau = 0;

  for (const it of items) {
    // Hanya site yang pernah punya pergerakan untuk item ini yang bisa dinilai.
    if (it.perSite.length < 1) continue;
    const harga = it.hargaRata;

    const donor = it.perSite.map((s) => {
      const tanpaPakai = s.laju <= 0;
      const lebih = tanpaPakai ? s.saldo : s.saldo - s.laju * p.targetMinggu;
      const memenuhi = s.saldo > 0 && (tanpaPakai || (s.cover ?? 0) >= p.batasSurplusMinggu);
      return { s, sisa: memenuhi ? Math.floor(lebih) : 0 };
    }).filter((d) => d.sisa >= 1);

    const penerima = it.perSite.map((s) => {
      const saldoPositif = Math.max(s.saldo, 0);
      const butuh = Math.ceil(s.laju * p.targetMinggu - saldoPositif);
      const kurang = s.laju > 0 && (s.saldo <= 0 || (s.cover ?? Infinity) < p.targetMinggu) && butuh >= 1;
      return { s, butuh: kurang ? butuh : 0 };
    }).filter((x) => x.butuh >= 1).sort((a, b) => (a.s.cover ?? 0) - (b.s.cover ?? 0));

    if (penerima.length) ditinjau += 1;

    for (const pr of penerima) {
      let sisaButuh = pr.butuh;
      donor.sort((a, b) => b.sisa - a.sisa);
      for (const d of donor) {
        if (sisaButuh <= 0) break;
        if (d.s.site === pr.s.site || d.sisa <= 0) continue;
        const qty = Math.min(sisaButuh, d.sisa);
        const cover = pr.s.cover;
        const urgensi: Urgensi = pr.s.saldo <= 0 || (cover ?? 0) < 2 ? 'Tinggi' : (cover ?? 0) < 4 ? 'Sedang' : 'Rendah';
        rekomendasi.push({
          key: `${it.kode}|${d.s.site}|${pr.s.site}`, kode: it.kode, nama: it.nama, satuan: it.satuan, entitas: it.entitas,
          dari: d.s.site, ke: pr.s.site, qty, nilai: qty * harga, hargaRata: harga,
          saldoDari: d.s.saldo, coverDari: d.s.cover, lajuDari: d.s.laju,
          saldoKe: pr.s.saldo, coverKe: pr.s.cover, lajuKe: pr.s.laju,
          urgensi, perluVerifikasi: pr.s.saldo <= 0,
        });
        d.sisa -= qty; sisaButuh -= qty;
      }
      if (sisaButuh > 0) belumTerpenuhi.push({
        kode: it.kode, nama: it.nama, satuan: it.satuan, site: pr.s.site, kurang: sisaButuh, nilai: sisaButuh * harga,
        saldo: pr.s.saldo, cover: pr.s.cover,
      });
    }
  }

  const bobot: Record<Urgensi, number> = { Tinggi: 0, Sedang: 1, Rendah: 2 };
  rekomendasi.sort((a, b) => bobot[a.urgensi] - bobot[b.urgensi] || b.nilai - a.nilai);
  belumTerpenuhi.sort((a, b) => b.nilai - a.nilai);
  return { rekomendasi, belumTerpenuhi, itemDitinjau: ditinjau };
}