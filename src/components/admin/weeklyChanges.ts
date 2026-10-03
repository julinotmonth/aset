// Perubahan data Laporan Mingguan (untuk menu notifikasi). Server mencatatnya
// saat sinkronisasi Google Sheet (server/src/changeLog.js): baris baru, baris
// yang isinya berubah (dengan dari → ke), dan baris yang dihapus — dikelompokkan
// per PIC.
//
// "PIC" = isi kolom PIC pada baris itu di sheet, BUKAN akun yang mengedit sheet
// (Google Sheet tidak memberi tahu siapa yang mengedit).
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';

export type AreaLaporan = 'OUT' | 'IN' | 'ASET' | 'PICA' | 'WORK_TARGET';
export type JenisPerubahan = 'baru' | 'ubah' | 'hapus';

export interface ContohPerubahan {
  nama: string;
  ket?: string;
  perubahan?: { kolom: string; dari: string; ke: string }[];
}

export interface PerubahanLaporan {
  id: string;
  site: string;
  area: AreaLaporan;
  kind: JenisPerubahan;
  pic: string;
  /** Banyak baris dalam kelompok ini (contoh baris di `detail` dibatasi beberapa saja). */
  jumlah: number;
  ringkasan: string;
  detail: ContohPerubahan[];
  sumber: string;
  createdAt: string;
}

export const AREA_LABEL: Record<AreaLaporan, string> = {
  OUT: 'Barang Keluar', IN: 'Barang Masuk', ASET: 'Daftar Aset', PICA: 'PICA', WORK_TARGET: 'Work Target',
};

export const waktuMs = (iso: string): number => new Date(iso).getTime() || 0;

/** "baru saja", "5 mnt lalu", "3 jam lalu", "2 hari lalu", lalu tanggal. */
export function waktuLalu(iso: string, sekarang = Date.now()): string {
  const selisih = Math.max(0, sekarang - waktuMs(iso));
  const menit = Math.floor(selisih / 60_000);
  if (menit < 1) return 'baru saja';
  if (menit < 60) return `${menit} mnt lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  if (hari < 7) return `${hari} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Frasa singkat: "3 data baru di Barang Keluar". */
export function frasaPerubahan(c: Pick<PerubahanLaporan, 'kind' | 'jumlah' | 'area'>): string {
  const apa = c.kind === 'baru' ? 'baru' : c.kind === 'ubah' ? 'diubah' : 'dihapus';
  return `${c.jumlah.toLocaleString('id-ID')} data ${apa} di ${AREA_LABEL[c.area]}`;
}

/**
 * Mengambil perubahan terbaru dari server: sekali saat dibuka, lalu berkala
 * selama tab terlihat, dan setiap tab kembali difokuskan. `muatUlang()` dipanggil
 * saat menu notifikasi dibuka agar isinya selalu terbaru.
 */
export function usePerubahanLaporan(intervalMs = 45_000, batas = 40) {
  const [items, setItems] = useState<PerubahanLaporan[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const muatUlang = useCallback(async () => {
    try {
      setItems(await api.get<PerubahanLaporan[]>(`/weekly-reports/changes?limit=${batas}`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat perubahan.');
    } finally {
      setMemuat(false);
    }
  }, [batas]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch awal; state diisi setelah respons
    void muatUlang();
    const timer = setInterval(() => { if (!document.hidden) void muatUlang(); }, intervalMs);
    const saatTerlihat = () => { if (!document.hidden) void muatUlang(); };
    document.addEventListener('visibilitychange', saatTerlihat);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', saatTerlihat); };
  }, [muatUlang, intervalMs]);

  return { items, memuat, error, muatUlang };
}