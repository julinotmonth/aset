// Lapisan data untuk menu Jadwal Maintenance — seluruhnya dibangun dari Laporan Mingguan
// (Barang Keluar) yang sudah ada di spreadsheet; tidak ada input jadwal manual.
//
// Cara membaca data:
//  • Satu baris Barang Keluar = satu part/oli yang dipakai pada sebuah peralatan (kolom Alokasi).
//  • Kolom Seksi menentukan jenis kegiatan: OH = Overhaul, OLI = ganti oli/pelumas, MAINT = perawatan & part.
//    (Seksi LAIN = jasa/lain-lain dan ISOTANK bukan perawatan peralatan, jadi tidak ikut.)
//  • Baris pada peralatan + kegiatan + hari/minggu yang sama digabung menjadi SATU kejadian perawatan.
//  • Kolom RH (jam jalan mesin) dipakai bila ada, karena perawatan mesin umumnya dijadwalkan per jam jalan.
//
// Jadwal berikutnya = kejadian terakhir + interval. Interval diambil dari riwayat (median selang antar
// kejadian); bila riwayat baru satu kejadian dipakai interval standar yang bisa diatur pengguna dan
// jadwalnya diberi tanda "perkiraan". Semuanya perkiraan dari pola riwayat, bukan jadwal resmi pabrikan.
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { AuthState } from '../../types';
import { bangunItem, adalahSparePart } from './sparePartData';
import type { BarisSp, ItemSp } from './sparePartData';

// ── Tipe ─────────────────────────────────────────────────────────────────
export type Kegiatan = 'OH' | 'OLI' | 'MAINT';
export const URUT_KEGIATAN: Kegiatan[] = ['OH', 'OLI', 'MAINT'];
export const NAMA_KEGIATAN: Record<Kegiatan, string> = { OH: 'Overhaul', OLI: 'Ganti Oli / Pelumas', MAINT: 'Perawatan & Part' };

export type StatusJadwal = 'Terlambat' | 'Segera' | 'Terjadwal' | 'Cek Data';

export interface BarisKeluar extends BarisSp {
  section: string; rh: number | null; pic?: string; noMr?: string; keterangan?: string;
}
export interface PartDipakai { kode: string; nama: string; qty: number; satuan: string; biaya: number }
export interface Kejadian {
  waktu: number; kegiatan: Kegiatan; rh: number | null; biaya: number; noMr: string; pic: string; keterangan: string;
  parts: PartDipakai[];
}
export interface Jadwal {
  key: string; site: string; peralatan: string; kegiatan: Kegiatan;
  kejadian: Kejadian[];          // urut lama → baru
  terakhir: Kejadian;
  intervalHari: number; dasarInterval: 'riwayat' | 'standar';
  intervalRH: number | null; rhTerakhir: number | null; rhPerHari: number | null;
  berikutnya: number;            // ms
  sisaHari: number;              // negatif = terlambat
  dasarJatuhTempo: 'tanggal' | 'jam jalan';
  status: StatusJadwal;
  biaya12Bln: number; biayaTotal: number;
}
export interface IntervalStandar { OH: number; OLI: number; MAINT: number }
export const STANDAR_DEFAULT: IntervalStandar = { OH: 365, OLI: 90, MAINT: 60 };

// ── Pengambilan data (Barang Keluar + Barang Masuk semua site) ───────────
const cache = new Map<string, { t: number; rows: BarisKeluar[]; masuk: BarisSp[] }>();
const TTL_MS = 60_000;

export interface HasilMaintenance { keluar: BarisKeluar[]; masuk: BarisSp[]; memuat: boolean; galat: string; siteTerkunci: boolean; muatUlang: () => void }

export function useDataMaintenance(auth: AuthState): HasilMaintenance {
  const siteTerkunci = auth.role !== 'Super Admin' && auth.assignedSite !== 'global';
  const site = siteTerkunci ? auth.assignedSite : 'global';
  const [keluar, setKeluar] = useState<BarisKeluar[]>(() => cache.get(site)?.rows ?? []);
  const [masuk, setMasuk] = useState<BarisSp[]>(() => cache.get(site)?.masuk ?? []);
  const [memuat, setMemuat] = useState(!cache.has(site));
  const [galat, setGalat] = useState('');
  const [versi, setVersi] = useState(0);

  useEffect(() => {
    let batal = false;
    const hit = cache.get(site);
    if (hit && Date.now() - hit.t < TTL_MS && versi === 0) { setKeluar(hit.rows); setMasuk(hit.masuk); setMemuat(false); return; }
    setMemuat(true);
    const q = (direction: 'IN' | 'OUT') => `/weekly-reports?${new URLSearchParams({ site, direction })}`;
    Promise.allSettled([api.get<BarisKeluar[]>(q('OUT')), api.get<BarisSp[]>(q('IN'))]).then(([o, i]) => {
      if (batal) return;
      const rows = o.status === 'fulfilled' ? o.value.map((r) => ({ ...r, jumlah: Number(r.jumlah) || 0, totalHarga: Number(r.totalHarga) || 0, harga: Number(r.harga) || 0, rh: r.rh === null || r.rh === undefined ? null : Number(r.rh) })) : [];
      const msk = i.status === 'fulfilled' ? i.value.map((r) => ({ ...r, jumlah: Number(r.jumlah) || 0, totalHarga: Number(r.totalHarga) || 0, harga: Number(r.harga) || 0 })) : [];
      if (o.status === 'fulfilled') cache.set(site, { t: Date.now(), rows, masuk: msk });
      setKeluar(rows); setMasuk(msk);
      setGalat(o.status === 'rejected' ? 'Gagal memuat Barang Keluar — jadwal tidak bisa dihitung.' : i.status === 'rejected' ? 'Barang Masuk gagal dimuat — status stok part tidak ditampilkan.' : '');
      setMemuat(false);
    });
    return () => { batal = true; };
  }, [site, versi]);

  return { keluar, masuk, memuat, galat, siteTerkunci, muatUlang: () => { cache.delete(site); setVersi((v) => v + 1); } };
}

// ── Utilitas ─────────────────────────────────────────────────────────────
const HARI = 86_400_000;
const MINGGU_MS = 7 * HARI;
const median = (a: number[]): number => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const rapi = (t: string) => t.trim().replace(/\s+/g, ' ');
const kunciNama = (t: string) => rapi(t).toLowerCase();

/** Waktu transaksi (ms); tanggal kosong → diperkirakan dari tahun + nomor minggu. */
export function waktuKeluar(r: { tanggal: string | null; tahun: number; minggu: number }): number | null {
  if (r.tanggal) { const t = Date.parse(r.tanggal); if (!Number.isNaN(t)) return t; }
  if (r.tahun && r.minggu) return new Date(r.tahun, 0, 1).getTime() + (r.minggu - 1) * MINGGU_MS;
  return null;
}

// ── Pembentukan jadwal ───────────────────────────────────────────────────
export interface OpsiJadwal { standar: IntervalStandar; sekarang?: number }

/** Baris Barang Keluar yang termasuk perawatan peralatan (OH/OLI/MAINT dengan Alokasi jelas). */
export const barisPerawatan = (rows: BarisKeluar[]): BarisKeluar[] =>
  rows.filter((r) => (r.section === 'OH' || r.section === 'OLI' || r.section === 'MAINT')
    && kunciNama(r.alokasi || '') !== '' && !['others', 'other'].includes(kunciNama(r.alokasi)));

export function bangunJadwal(rows: BarisKeluar[], opsi: OpsiJadwal): Jadwal[] {
  const sekarang = opsi.sekarang ?? Date.now();
  const sumber = barisPerawatan(rows);

  // 1) Kejadian = peralatan + kegiatan + hari (atau minggu bila tanggal kosong)
  type Grup = { site: string; nama: Map<string, number>; kegiatan: Kegiatan; waktu: number; rows: BarisKeluar[] };
  const kejadianMap = new Map<string, Grup>();
  for (const r of sumber) {
    const w = waktuKeluar(r);
    if (w === null) continue;
    const kegiatan = r.section as Kegiatan;
    const hari = r.tanggal ? Math.floor(w / HARI) : `W${r.tahun}-${r.minggu}`;
    const key = `${r.site}|${kunciNama(r.alokasi)}|${kegiatan}|${hari}`;
    let g = kejadianMap.get(key);
    if (!g) { g = { site: r.site, nama: new Map(), kegiatan, waktu: w, rows: [] }; kejadianMap.set(key, g); }
    g.rows.push(r);
    g.nama.set(rapi(r.alokasi), (g.nama.get(rapi(r.alokasi)) ?? 0) + 1);
  }

  // 2) Kumpulkan per peralatan+kegiatan, plus semua bacaan RH per peralatan (lintas kegiatan)
  type EntriJadwal = { site: string; peralatan: Map<string, number>; kegiatan: Kegiatan; kejadian: Kejadian[] };
  const perJadwal = new Map<string, EntriJadwal>();
  const bacaanRH = new Map<string, { w: number; rh: number }[]>();
  for (const g of kejadianMap.values()) {
    const rhList = g.rows.map((r) => r.rh).filter((x): x is number => typeof x === 'number' && x > 0);
    const rh = rhList.length ? Math.max(...rhList) : null;
    const partMap = new Map<string, PartDipakai>();
    for (const r of g.rows) {
      const k = (r.kode || r.namaBarang).trim().toUpperCase();
      const e = partMap.get(k) ?? { kode: (r.kode || '').trim(), nama: rapi(r.namaBarang || ''), qty: 0, satuan: r.satuan || '', biaya: 0 };
      e.qty += r.jumlah; e.biaya += r.totalHarga; partMap.set(k, e);
    }
    const kj: Kejadian = {
      waktu: g.waktu, kegiatan: g.kegiatan, rh,
      biaya: g.rows.reduce((t, r) => t + r.totalHarga, 0),
      noMr: g.rows.map((r) => r.noMr).find(Boolean) ?? '', pic: g.rows.map((r) => r.pic).find(Boolean) ?? '',
      keterangan: g.rows.map((r) => r.keterangan).find(Boolean) ?? '',
      parts: [...partMap.values()].sort((a, b) => b.biaya - a.biaya),
    };
    const namaTerpilih = [...g.nama.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const kEq = `${g.site}|${kunciNama(namaTerpilih)}`;
    const kJ = `${kEq}|${g.kegiatan}`;
    const e: EntriJadwal = perJadwal.get(kJ) ?? { site: g.site, peralatan: new Map(), kegiatan: g.kegiatan, kejadian: [] };
    e.peralatan.set(namaTerpilih, (e.peralatan.get(namaTerpilih) ?? 0) + g.rows.length);
    e.kejadian.push(kj); perJadwal.set(kJ, e);
    if (rh !== null) { const arr = bacaanRH.get(kEq) ?? []; arr.push({ w: g.waktu, rh }); bacaanRH.set(kEq, arr); }
  }

  // 3) Hitung interval, jatuh tempo, status
  const hasil: Jadwal[] = [];
  for (const [kJ, e] of perJadwal) {
    const kEq = kJ.slice(0, kJ.lastIndexOf('|'));
    const kj = [...e.kejadian].sort((a, b) => a.waktu - b.waktu);
    const terakhir = kj[kj.length - 1];
    const selang = kj.slice(1).map((x, i) => (x.waktu - kj[i].waktu) / HARI).filter((d) => d >= 1);
    const dariRiwayat = selang.length > 0;
    const intervalHari = Math.max(1, Math.round(dariRiwayat ? median(selang) : opsi.standar[e.kegiatan]));

    // Jam jalan: laju RH per hari dari seluruh bacaan peralatan ini, interval RH dari kejadian sejenis
    const bac = (bacaanRH.get(kEq) ?? []).sort((a, b) => a.w - b.w);
    let rhPerHari: number | null = null;
    if (bac.length >= 2) {
      const span = (bac[bac.length - 1].w - bac[0].w) / HARI;
      const naik = bac[bac.length - 1].rh - bac[0].rh;
      if (span >= 7 && naik > 0) rhPerHari = naik / span;
    }
    const rhKejadian = kj.filter((x) => x.rh !== null);
    const selangRH = rhKejadian.slice(1).map((x, i) => (x.rh as number) - (rhKejadian[i].rh as number)).filter((d) => d > 0);
    const intervalRH = selangRH.length ? Math.round(median(selangRH)) : null;

    let berikutnya = terakhir.waktu + intervalHari * HARI;
    let dasar: Jadwal['dasarJatuhTempo'] = 'tanggal';
    const rhTerakhir = bac.length ? bac[bac.length - 1].rh : null;
    if (rhPerHari && intervalRH && terakhir.rh !== null && rhTerakhir !== null) {
      const sisaRH = terakhir.rh + intervalRH - rhTerakhir;
      const waktuRH = bac[bac.length - 1].w + (sisaRH / rhPerHari) * HARI;
      if (Number.isFinite(waktuRH) && waktuRH < berikutnya) { berikutnya = waktuRH; dasar = 'jam jalan'; }
    }

    const sisaHari = Math.round((berikutnya - sekarang) / HARI);
    const status: StatusJadwal = sisaHari < -2 * intervalHari ? 'Cek Data' : sisaHari < 0 ? 'Terlambat' : sisaHari <= 14 ? 'Segera' : 'Terjadwal';
    const batas12 = sekarang - 365 * HARI;
    hasil.push({
      key: kJ, site: e.site, peralatan: [...e.peralatan.entries()].sort((a, b) => b[1] - a[1])[0][0], kegiatan: e.kegiatan,
      kejadian: kj, terakhir, intervalHari, dasarInterval: dariRiwayat ? 'riwayat' : 'standar',
      intervalRH, rhTerakhir, rhPerHari, berikutnya, sisaHari, dasarJatuhTempo: dasar, status,
      biaya12Bln: kj.filter((x) => x.waktu >= batas12).reduce((t, x) => t + x.biaya, 0),
      biayaTotal: kj.reduce((t, x) => t + x.biaya, 0),
    });
  }
  const bobot: Record<StatusJadwal, number> = { Terlambat: 0, Segera: 1, Terjadwal: 2, 'Cek Data': 3 };
  return hasil.sort((a, b) => bobot[a.status] - bobot[b.status] || a.sisaHari - b.sisaHari);
}

/** Status stok part (dari data Barang Masuk/Keluar) untuk menautkan jadwal ↔ Spare Part. */
export function statusPart(keluar: BarisKeluar[], masuk: BarisSp[]): Map<string, ItemSp> {
  const sp = [...masuk, ...keluar].filter((r) => adalahSparePart(r.kode)) as BarisSp[];
  return new Map(bangunItem(sp).map((i) => [i.kode, i]));
}

/** Biaya perawatan per bulan (12 bulan terakhir yang punya data). */
export function biayaBulanan(rows: BarisKeluar[]): { label: string; Biaya: number; t: number }[] {
  const NAMA = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const per = new Map<number, { label: string; Biaya: number; t: number }>();
  for (const r of barisPerawatan(rows)) {
    if (!r.tahun || !r.bulan) continue;
    const t = r.tahun * 12 + r.bulan;
    const e = per.get(t) ?? { label: `${NAMA[r.bulan - 1]} ${String(r.tahun).slice(2)}`, Biaya: 0, t };
    e.Biaya += r.totalHarga; per.set(t, e);
  }
  return [...per.values()].sort((a, b) => a.t - b.t).slice(-12);
}