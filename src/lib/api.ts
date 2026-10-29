// Thin fetch wrapper for the Reethau Inventory backend (server/). Every data
// module (siteStore, categoryStore, galleryStore, AdminDashboard) goes
// through this instead of touching localStorage or fetch() directly.
//
// Ketahanan koneksi: backend di hosting gratis/hemat biasanya "tidur" saat sepi dan butuh
// 10–30 dtk untuk bangun. Selama itu proxy hosting membalas error tanpa header CORS, yang di
// browser tampil sebagai "CORS policy"/ERR_FAILED. Karena itu permintaan baca (GET) otomatis
// diulang dengan jeda bertambah, dan status "menyambung" dipublikasikan agar UI bisa memberi
// tahu pengguna alih-alih menampilkan error merah.
const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'reethau_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Opsi per-permintaan. `ulang`: jumlah percobaan ulang (default 3 untuk GET, 0 untuk lainnya; false = matikan). */
export interface OpsiRequest {
  timeoutMs?: number;
  ulang?: number | false;
}

const JEDA_ULANG_MS = [1000, 2500, 5000, 8000];
const STATUS_GATEWAY = new Set([502, 503, 504]); // proxy/hosting: server belum siap / sedang bangun
const tidur = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Status koneksi (untuk banner "Menyambungkan ke server…") ──────────────
export type StatusKoneksi = 'ok' | 'menyambung';
let sedangMengulang = 0;
const pendengar = new Set<() => void>();
function ubahMengulang(delta: number) {
  const sebelum = sedangMengulang > 0;
  sedangMengulang = Math.max(0, sedangMengulang + delta);
  if ((sedangMengulang > 0) !== sebelum) pendengar.forEach((f) => f());
}
export const getKoneksi = (): StatusKoneksi => (sedangMengulang > 0 ? 'menyambung' : 'ok');
export function subscribeKoneksi(fn: () => void): () => void {
  pendengar.add(fn);
  return () => { pendengar.delete(fn); };
}

const PESAN_JARINGAN = 'Server belum merespons. Kemungkinan sedang bangun dari mode tidur — tunggu beberapa detik lalu coba lagi.';
const PESAN_TIMEOUT = 'Server terlalu lama merespons. Coba lagi sebentar lagi.';

async function request<T>(path: string, options: RequestInit & OpsiRequest = {}): Promise<T> {
  const { timeoutMs = 30_000, ulang, ...init } = options;
  const metode = (init.method || 'GET').toUpperCase();
  const maksUlang = ulang === false ? 0 : (ulang ?? (metode === 'GET' ? 3 : 0));

  const token = getToken();
  const headers: Record<string, string> = {
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  let mengulang = false;
  try {
    for (let percobaan = 0; ; percobaan++) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      let hasil: { res: Response; body: { error?: string } | null | undefined } | null = null;
      let sebab: 'jaringan' | 'timeout' | null = null;
      try {
        const res = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: ctl.signal });
        const isJson = res.headers.get('content-type')?.includes('application/json');
        const body = res.status === 204 ? undefined : isJson ? await res.json().catch(() => null) : null;
        hasil = { res, body };
      } catch {
        sebab = ctl.signal.aborted ? 'timeout' : 'jaringan';
      } finally {
        clearTimeout(timer);
      }

      const gateway = !!hasil && STATUS_GATEWAY.has(hasil.res.status);
      if ((sebab || gateway) && percobaan < maksUlang) {
        if (!mengulang) { mengulang = true; ubahMengulang(1); }
        await tidur(JEDA_ULANG_MS[Math.min(percobaan, JEDA_ULANG_MS.length - 1)]);
        continue;
      }

      if (!hasil) throw new ApiError(sebab === 'timeout' ? PESAN_TIMEOUT : PESAN_JARINGAN, 0);
      const { res, body } = hasil;

      if (res.status === 401) {
        // Session expired/invalid — clear it so the app returns to the login screen.
        setToken(null);
      }
      if (res.status === 204) return undefined as T;
      if (!res.ok) {
        throw new ApiError(body?.error || (gateway ? `Server sedang tidak tersedia (HTTP ${res.status}). Coba lagi sebentar lagi.` : `Permintaan gagal (${res.status})`), res.status);
      }
      return body as T;
    }
  } finally {
    if (mengulang) ubahMengulang(-1);
  }
}

export const api = {
  get: <T>(path: string, opsi?: OpsiRequest) => request<T>(path, { ...opsi }),
  post: <T>(path: string, data?: unknown, opsi?: OpsiRequest) => request<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined, ...opsi }),
  patch: <T>(path: string, data?: unknown, opsi?: OpsiRequest) => request<T>(path, { method: 'PATCH', body: data !== undefined ? JSON.stringify(data) : undefined, ...opsi }),
  delete: <T>(path: string, opsi?: OpsiRequest) => request<T>(path, { method: 'DELETE', ...opsi }),
};

export { ApiError };