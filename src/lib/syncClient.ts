// Sinkronisasi Google Sheet sebagai "job" di server: klik → langsung dapat jobId (respons < 1 dtk),
// lalu status dipantau lewat polling. Dengan begitu tidak ada request panjang yang bisa diputus
// proxy/hosting, dan klik berulang (atau auto-sync yang sedang jalan) bergabung ke job yang sama.
import { api, ApiError } from './api';

export interface HasilTabSync {
  tab: string;
  total?: number;
  arah?: string;
  inserted?: number;
  updated?: number;
  removed?: number;
  error?: string;
}

export interface JobSync {
  id: string;
  site: string;
  status: 'running' | 'done' | 'error';
  progress: { selesai: number; total: number; tab: string | null };
  hasil: (HasilTabSync | null)[];
  dibuang: number;
  peringatan?: unknown[];
  error: string | null;
}

export interface HasilSync {
  hasil: HasilTabSync[];
  dibuang: number;
  peringatan?: unknown[];
  /** True bila klik ini bergabung ke sync yang sudah berjalan (mis. auto-sync). */
  bergabung: boolean;
}

const tidur = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const BATAS_WAKTU_MS = 10 * 60_000;
const POLL_MS = 1200;

export async function jalankanSync(site: string, onProgress?: (job: JobSync, bergabung: boolean) => void): Promise<HasilSync> {
  // Memulai job aman diulang (server menggabungkan permintaan ganda ke job yang sama).
  const mulai = await api.post<{ jobId: string; bergabung: boolean }>('/weekly-reports/sync', { site, async: true }, { ulang: 3 });
  const batas = Date.now() + BATAS_WAKTU_MS;
  let gagalBerturut = 0;
  for (;;) {
    await tidur(POLL_MS);
    let job: JobSync;
    try {
      job = await api.get<JobSync>(`/weekly-reports/sync/${encodeURIComponent(mulai.jobId)}`);
      gagalBerturut = 0;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        throw new Error('Proses sinkronisasi terputus karena server sempat restart atau tidur. Klik “Sync Sekarang” sekali lagi.');
      }
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) throw err;
      if (++gagalBerturut >= 4) throw err; // koneksi benar-benar putus
      continue;
    }
    onProgress?.(job, mulai.bergabung);
    if (job.status === 'error') throw new Error(job.error || 'Sinkronisasi gagal.');
    if (job.status === 'done') {
      return { hasil: job.hasil.filter((h): h is HasilTabSync => !!h), dibuang: job.dibuang, peringatan: job.peringatan, bergabung: mulai.bergabung };
    }
    if (Date.now() > batas) throw new Error('Sinkronisasi memakan waktu lebih dari 10 menit. Coba cek lagi nanti — prosesnya mungkin masih berjalan di server.');
  }
}