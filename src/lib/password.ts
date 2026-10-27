// Helper password & clipboard untuk Kelola Pengguna.

// Tanpa karakter yang mudah tertukar (0/O, 1/l/I) supaya enak dibacakan / diketik ulang.
const HURUF_BESAR = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const HURUF_KECIL = 'abcdefghijkmnpqrstuvwxyz';
const ANGKA = '23456789';
const SIMBOL = '#@$%&*!?';

function acak(n: number): number {
  // Rejection sampling agar distribusi seragam (tanpa modulo bias).
  const batas = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= batas);
  return buf[0] % n;
}
const ambil = (set: string) => set[acak(set.length)];

/** Password acak yang pasti memuat huruf besar, kecil, angka, dan simbol. */
export function buatPasswordAcak(panjang = 12): string {
  const semua = HURUF_BESAR + HURUF_KECIL + ANGKA + SIMBOL;
  const hasil = [ambil(HURUF_BESAR), ambil(HURUF_KECIL), ambil(ANGKA), ambil(SIMBOL)];
  while (hasil.length < panjang) hasil.push(ambil(semua));
  for (let i = hasil.length - 1; i > 0; i--) { // Fisher–Yates
    const j = acak(i + 1);
    [hasil[i], hasil[j]] = [hasil[j], hasil[i]];
  }
  return hasil.join('');
}

export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72;

/** Pesan error untuk password, atau '' bila layak (aturan sama dengan server). */
export function cekPassword(pw: string): string {
  if (pw.length < PASSWORD_MIN) return `Password minimal ${PASSWORD_MIN} karakter.`;
  if (new TextEncoder().encode(pw).length > PASSWORD_MAX) return `Password terlalu panjang (maksimal ${PASSWORD_MAX} karakter).`;
  if (pw !== pw.trim()) return 'Password tidak boleh diawali atau diakhiri spasi.';
  return '';
}

export interface Kekuatan { skor: 0 | 1 | 2 | 3 | 4; label: string; warna: string }

export function kekuatanPassword(pw: string): Kekuatan {
  if (!pw) return { skor: 0, label: '', warna: 'var(--txt-muted)' };
  let poin = 0;
  if (pw.length >= 6) poin++;
  if (pw.length >= 10) poin++;
  const ragam = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (ragam >= 3) poin++;
  if (ragam === 4 && pw.length >= 8) poin++;
  if (/^(.)\1+$/.test(pw) || /^(123456|password|qwerty|abcdef)/i.test(pw)) poin = Math.min(poin, 1);
  const skor = Math.max(pw.length < PASSWORD_MIN ? 1 : poin, 1) as 1 | 2 | 3 | 4;
  const peta = [
    { label: '', warna: '' },
    { label: 'Lemah', warna: '#F87171' },
    { label: 'Cukup', warna: '#FBBF24' },
    { label: 'Baik', warna: '#34D399' },
    { label: 'Kuat', warna: '#00D084' },
  ];
  return { skor, ...peta[skor] };
}

/** Salin teks ke clipboard. Jatuh ke execCommand bila Clipboard API tidak tersedia (mis. HTTP non-secure). */
export async function salinTeks(teks: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(teks);
      return true;
    }
  } catch { /* lanjut ke cadangan */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = teks;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}