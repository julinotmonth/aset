// Pencatatan transaksi Barang Masuk / Barang Keluar lewat website (menu "Tambah Transaksi").
//
// Form dibangun dari TEMPLATE sheet sumber: tiap kolom header tab (mis. IN_RDA) menjadi kolom form, lengkap dengan
// kontrol yang sesuai (tanggal, pencarian kode/nama, angka, satuan, supplier/alokasi, dst.). Server memvalidasi ulang,
// menyimpan ke aplikasi, lalu menulis baris baru ke Google Spreadsheet (lihat server/src/weeklyInput.js).
// Alur 3 langkah — Isi Data → Tinjau → Selesai — supaya kesalahan ketik tertangkap sebelum masuk ke sheet.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { X, Plus, Minus, CheckCircle2, AlertTriangle, Cloud, CloudOff, Loader2, RefreshCw, ArrowLeft, Send, Info, PackagePlus, PackageMinus, ChevronDown, Check } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import './formModal.css';
import './inputTransaksi.css';

// ── Tipe (sama dengan GET /weekly-reports/input/config) ────────────────────────────
interface KolomInput { idx: number; judul: string; field: string | null; jenis: 'tanggal' | 'angka' | 'bilbul' | 'teks'; wajib: boolean; auto: boolean; rumus: boolean }
interface TabInput { tab: string; entitas: string; kolom: KolomInput[] }
interface ItemKatalog { kode: string; nama: string; satuan: string; harga: number; saldo: number }
interface KonfigInput {
  tersambung: boolean; emailLayanan: string | null; sheetDiatur: boolean; tabs: TabInput[];
  saran: { satuan: string[]; alokasi: string[]; pic: string[]; status: string[] }; katalog: ItemKatalog[];
}
interface HasilSimpan { ok: boolean; id: string; status: 'ok' | 'pending' | 'gagal'; barisSheet?: number; pesan: string; tersambung: boolean }
interface ItemRiwayat { id: string; tab: string; tanggal: string | null; kode: string; nama: string; jumlah: number; satuan: string; status: 'ok' | 'pending' | 'gagal'; barisSheet: number | null; error: string; oleh: string; waktu: string }

interface Props {
  buka: boolean;
  site: string;
  siteLabel: string;
  arah: 'IN' | 'OUT';
  /** Entitas yang sedang dilihat di halaman (RDA/RCE/RET) — dipakai memilih tab tujuan awal. */
  entitasAwal?: string;
  onTutup: () => void;
  /** Dipanggil setelah data tersimpan, supaya halaman memuat ulang datanya. */
  onTersimpan: () => void;
}

// ── Util ───────────────────────────────────────────────────────────────────
const NAMA_ENTITAS: Record<string, string> = { RDA: 'Mother Station', RCE: 'Workshop', RET: 'RET', UMUM: 'Umum' };
const POLA_ENTITAS = /(?:^|[^A-Za-z])(RDA|RCE|RET)(?![A-Za-z])/i;
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pad = (n: number) => String(n).padStart(2, '0');
const isoLokal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const geserHari = (iso: string, h: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + h); return isoLokal(d); };
const tglPendek = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${Number(iso.slice(8))} ${BLN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : iso);
/** Ket WR. terisi otomatis dari No. WR: "Done <no WR>". Kosong bila No. WR belum diisi. Ubah rumusnya di sini bila format berbeda. */
const ketWrOtomatis = (noWr: string) => (noWr.trim() ? `Done ${noWr.trim()}` : '');
const adalahKetWr = (k: KolomInput) => k.field === 'keterangan' && /^ket\.?\s*wr\b/i.test(k.judul.trim());
const adalahNoWr = (k: KolomInput) => /^no\.?\s*wr\b/i.test(k.judul.trim());
const kunciKolom = (k: KolomInput) => k.field ?? `x:${k.judul.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;

/** Minggu ISO (Senin = awal minggu) — penomoran yang sama dengan kolom Minggu pada sheet sumber. */
function mingguIso(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
  const kamis1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t.getTime() - kamis1.getTime()) / 86400000 - 3 + ((kamis1.getUTCDay() + 6) % 7)) / 7);
}

/** Baca angka yang diketik pengguna (format Indonesia "1.234,5" atau "1234.5"). Null bila bukan angka. */
function bacaAngka(s: string): number | null {
  let t = s.trim().replace(/\s+/g, '').replace(/^rp\.?/i, '');
  if (!t) return null;
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (t.includes(',')) t = /^\d{1,3}(,\d{3}){2,}$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  else if (t.includes('.') && /^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
const fmtAngka = (n: number, maks = 2) => n.toLocaleString('id-ID', { maximumFractionDigits: maks });

// ── Kotak cari (kode / nama barang) dengan saran dari barang yang sudah pernah tercatat ────────────
function KotakCari({ id, nilai, onUbah, opsi, onPilih, placeholder, invalid, mode }: {
  id: string; nilai: string; onUbah: (v: string) => void; opsi: ItemKatalog[]; onPilih: (o: ItemKatalog) => void;
  placeholder: string; invalid: boolean; mode: 'kode' | 'nama';
}) {
  const [buka, setBuka] = useState(false);
  const [aktif, setAktif] = useState(0);
  const hasil = useMemo(() => {
    const q = nilai.trim().toLowerCase();
    if (q.length < 2) return [];
    const awal: ItemKatalog[] = [], memuat: ItemKatalog[] = [];
    for (const o of opsi) {
      const k = o.kode.toLowerCase(), n = o.nama.toLowerCase();
      if (k.startsWith(q) || n.startsWith(q)) awal.push(o);
      else if (k.includes(q) || n.includes(q)) memuat.push(o);
      if (awal.length >= 8) break;
    }
    return [...awal, ...memuat].slice(0, 8);
  }, [nilai, opsi]);
  const pilih = (o: ItemKatalog) => { onPilih(o); setBuka(false); };
  const tombol = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!buka || !hasil.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setAktif((a) => Math.min(a + 1, hasil.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAktif((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pilih(hasil[aktif] ?? hasil[0]); }
    else if (e.key === 'Escape') { e.stopPropagation(); setBuka(false); }
  };
  return (
    <div className="im-combo">
      <input id={id} className="fm-input" value={nilai} placeholder={placeholder} autoComplete="off" spellCheck={false}
        style={mode === 'kode' ? { textTransform: 'uppercase' } : undefined}
        role="combobox" aria-expanded={buka && hasil.length > 0} aria-controls={`${id}-daftar`} aria-autocomplete="list" aria-invalid={invalid || undefined}
        onChange={(e) => { onUbah(e.target.value); setBuka(true); setAktif(0); }}
        onFocus={() => setBuka(true)} onBlur={() => setTimeout(() => setBuka(false), 120)} onKeyDown={tombol} />
      {buka && hasil.length > 0 && (
        <ul id={`${id}-daftar`} className="im-daftar" role="listbox">
          {hasil.map((o, i) => (
            <li key={o.kode} className="im-opsi" role="option" aria-selected={i === aktif}
              onMouseDown={(e) => { e.preventDefault(); pilih(o); }} onMouseEnter={() => setAktif(i)}>
              <b>{mode === 'kode' ? o.kode : o.nama}</b>
              <span>{mode === 'kode' ? o.nama : o.kode} · {o.satuan || '–'}{o.harga > 0 ? ` · terakhir Rp ${fmtAngka(o.harga, 0)}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const Lencana = ({ s }: { s: 'ok' | 'pending' | 'gagal' }) => (
  <span className={`im-lencana ${s}`}>{s === 'ok' ? 'Di sheet' : s === 'pending' ? 'Menunggu' : 'Gagal kirim'}</span>
);

// ── Panel ────────────────────────────────────────────────────────────────
export function InputBarangPanel({ buka, site, siteLabel, arah, entitasAwal, onTutup, onTersimpan }: Props) {
  const hariIni = isoLokal(new Date());
  const [konfig, setKonfig] = useState<KonfigInput | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galatMuat, setGalatMuat] = useState('');
  const [tab, setTab] = useState('');
  const [nilai, setNilai] = useState<Record<string, string>>({ tanggal: hariIni });
  const [totalManual, setTotalManual] = useState(false);
  const [ketWrManual, setKetWrManual] = useState(false); // true = pengguna mengetik sendiri Ket WR (tidak ikut No. WR)
  const [sentuh, setSentuh] = useState<Set<string>>(new Set());
  const [coba, setCoba] = useState(false);
  const [galatServer, setGalatServer] = useState<Record<string, string>>({});
  const [tahap, setTahap] = useState<'isi' | 'periksa' | 'selesai'>('isi');
  const [menyimpan, setMenyimpan] = useState(false);
  const [hasil, setHasil] = useState<HasilSimpan | null>(null);
  const [konflik, setKonflik] = useState<{ jenis: string; pesan: string } | null>(null);
  const [abaikan, setAbaikan] = useState<string[]>([]);
  const [galatUmum, setGalatUmum] = useState('');
  const [riwayat, setRiwayat] = useState<ItemRiwayat[]>([]);
  const [mengirimUlang, setMengirimUlang] = useState('');
  const [emailDisalin, setEmailDisalin] = useState(false);
  const [statusBuka, setStatusBuka] = useState(false); // detail status koneksi sheet (ringkas secara default)
  const badanRef = useRef<HTMLDivElement>(null);
  // Entitas halaman dibaca lewat ref: perubahannya (mis. setelah halaman memuat ulang data) tidak boleh mengulang pemuatan / mereset form.
  const entitasRef = useRef(entitasAwal);
  entitasRef.current = entitasAwal;

  const namaArah = arah === 'IN' ? 'Barang Masuk' : 'Barang Keluar';
  const IkonArah = arah === 'IN' ? PackagePlus : PackageMinus;

  const kosongkan = useCallback((pertahankan: boolean) => {
    setNilai((n): Record<string, string> => (pertahankan ? { tanggal: n.tanggal || hariIni, alokasi: n.alokasi || '', pic: n.pic || '' } : { tanggal: hariIni }));
    setTotalManual(false); setKetWrManual(false); setSentuh(new Set()); setCoba(false); setGalatServer({}); setKonflik(null); setAbaikan([]); setGalatUmum(''); setHasil(null);
  }, [hariIni]);

  const muatKonfig = useCallback(async (senyap = false) => {
    if (!senyap) { setMemuat(true); setGalatMuat(''); }
    try {
      const q = new URLSearchParams({ site, direction: arah });
      const k = await api.get<KonfigInput>(`/weekly-reports/input/config?${q}`);
      setKonfig(k);
      setTab((t) => {
        if (k.tabs.some((x) => x.tab === t)) return t;
        return (k.tabs.find((x) => x.entitas === entitasRef.current) ?? k.tabs[0])?.tab ?? '';
      });
    } catch (e) { if (!senyap) setGalatMuat((e as Error).message); }
    finally { if (!senyap) setMemuat(false); }
  }, [site, arah]);

  const muatRiwayat = useCallback(async () => {
    try {
      const q = new URLSearchParams({ site, direction: arah });
      setRiwayat((await api.get<{ riwayat: ItemRiwayat[] }>(`/weekly-reports/input/riwayat?${q}`)).riwayat);
    } catch { /* riwayat hanya pelengkap */ }
  }, [site, arah]);

  useEffect(() => {
    if (!buka) return;
    setStatusBuka(false); setTahap('isi'); setKonfig(null); setTab(''); kosongkan(false);
    void muatKonfig(); void muatRiwayat();
  }, [buka, site, arah, muatKonfig, muatRiwayat, kosongkan]);

  const tabObj = konfig?.tabs.find((t) => t.tab === tab) ?? null;

  // Kursor langsung ke kolom pencarian barang begitu form siap — tidak perlu klik dulu.
  const siap = !!tabObj && !memuat;
  useEffect(() => {
    if (!buka || !siap || tahap !== 'isi') return;
    const t = setTimeout(() => document.getElementById('im-f-namaBarang')?.focus(), 80);
    return () => clearTimeout(t);
  }, [buka, siap, tahap]);
  const kolomForm = useMemo(() => (tabObj?.kolom ?? []).filter((k) => !k.auto), [tabObj]);

  // Total = jumlah × harga (otomatis, kecuali pengguna mengetik sendiri).
  const kolomKetWr = useMemo(() => tabObj?.kolom.find((k) => !k.auto && !k.rumus && adalahKetWr(k)) ?? null, [tabObj]);
  const kolomNoWr = useMemo(() => tabObj?.kolom.find((k) => !k.auto && !k.rumus && adalahNoWr(k)) ?? null, [tabObj]);
  const ketWrAktif = !!kolomKetWr && !!kolomNoWr; // fitur otomatis hanya bila tab punya kolom "Ket WR." dan "No. WR"
  const efektif = useMemo((): Record<string, string> => {
    const j = bacaAngka(nilai.jumlah ?? ''), h = bacaAngka(nilai.harga ?? '');
    const otomatis = j !== null && j > 0 && h !== null && h >= 0 ? Math.round(j * h * 100) / 100 : null;
    const hasil: Record<string, string> = { ...nilai, totalHarga: totalManual ? (nilai.totalHarga ?? '') : otomatis !== null ? fmtAngka(otomatis) : '' };
    if (ketWrAktif && !ketWrManual) hasil[kunciKolom(kolomKetWr!)] = ketWrOtomatis(nilai[kunciKolom(kolomNoWr!)] ?? '');
    return hasil;
  }, [nilai, totalManual, ketWrAktif, ketWrManual, kolomKetWr, kolomNoWr]);

  const tglIso = efektif.tanggal || '';
  const tglValid = /^\d{4}-\d{2}-\d{2}$/.test(tglIso);

  // ── Validasi di sisi klien (server memeriksa ulang) ───────────────────────
  const galat = useMemo(() => {
    const g: Record<string, string> = {};
    for (const k of tabObj?.kolom ?? []) {
      if (k.auto || k.rumus) continue;
      const key = kunciKolom(k);
      const v = (efektif[key] ?? '').trim();
      if (k.field === 'tanggal') {
        if (!v) g[key] = 'Tanggal wajib diisi.';
        else if (v > hariIni) g[key] = 'Tanggal tidak boleh di masa depan.';
        else if (v < geserHari(hariIni, -730)) g[key] = 'Tanggal lebih dari 2 tahun lalu — periksa kembali.';
      } else if (k.field === 'namaBarang') {
        if (!v) g[key] = 'Nama barang wajib diisi.'; else if (v.length < 3) g[key] = 'Nama barang terlalu pendek.';
      } else if (k.jenis === 'angka') {
        const n = bacaAngka(v);
        if (!v) { if (k.wajib) g[key] = `${k.judul} wajib diisi.`; }
        else if (n === null) g[key] = `${k.judul} harus berupa angka.`;
        else if (k.field === 'jumlah' && n <= 0) g[key] = 'Jumlah harus lebih dari 0.';
        else if (n < 0) g[key] = `${k.judul} tidak boleh negatif.`;
      } else if (k.wajib && !v) g[key] = `${k.judul} wajib diisi.`;
      if (k.field === 'kode' && v && !/^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/.test(v)) g[key] = 'Kode hanya boleh huruf, angka, spasi, titik, garis miring, atau strip.';
    }
    return g;
  }, [tabObj, efektif, hariIni]);
  const galatTampil = (key: string) => galatServer[key] || ((coba || sentuh.has(key)) ? galat[key] : undefined);

  // ── Peringatan (tidak memblokir) ────────────────────────────────────────
  const itemDipilih = useMemo(() => {
    const kode = (efektif.kode ?? '').trim().toUpperCase();
    return kode ? konfig?.katalog.find((k) => k.kode.toUpperCase() === kode) ?? null : null;
  }, [efektif.kode, konfig]);
  const peringatan = useMemo(() => {
    const p: string[] = [];
    if (tglValid && tglIso < geserHari(hariIni, -45) && tglIso >= geserHari(hariIni, -730)) p.push(`Tanggal ${tglPendek(tglIso)} sudah lebih dari 45 hari lalu. Pastikan benar.`);
    const kode = (efektif.kode ?? '').trim();
    if (kode && konfig && !itemDipilih) p.push(`Kode ${kode.toUpperCase()} belum pernah tercatat di ${siteLabel}. Periksa penulisannya — atau abaikan bila ini barang baru.`);
    const ent = POLA_ENTITAS.exec(kode)?.[1]?.toUpperCase();
    if (ent && tabObj && tabObj.entitas !== 'UMUM' && ent !== tabObj.entitas) p.push(`Kode ${ent} biasanya masuk tab ${NAMA_ENTITAS[ent]}, sedangkan tab yang dipilih adalah ${NAMA_ENTITAS[tabObj.entitas] ?? tabObj.entitas}.`);
    const j = bacaAngka(efektif.jumlah ?? ''), h = bacaAngka(efektif.harga ?? '');
    if (itemDipilih) {
      if (arah === 'OUT' && j !== null && itemDipilih.saldo >= 0 && j > itemDipilih.saldo) p.push(`Jumlah keluar (${fmtAngka(j)}) melebihi saldo tercatat ${fmtAngka(itemDipilih.saldo)} ${itemDipilih.satuan}.`);
      if (efektif.satuan && itemDipilih.satuan && efektif.satuan.trim().toLowerCase() !== itemDipilih.satuan.toLowerCase()) p.push(`Satuan biasanya "${itemDipilih.satuan}" untuk barang ini.`);
      if (h !== null && h > 0 && itemDipilih.harga > 0 && Math.abs(h - itemDipilih.harga) / itemDipilih.harga > 0.3) p.push(`Harga berbeda jauh dari harga terakhir (Rp ${fmtAngka(itemDipilih.harga, 0)}).`);
    }
    return p;
  }, [tglValid, tglIso, hariIni, efektif, konfig, itemDipilih, siteLabel, tabObj, arah]);

  const ubah = (key: string, v: string) => {
    setNilai((n) => ({ ...n, [key]: v }));
    setGalatServer((g) => { if (!g[key]) return g; const { [key]: _, ...sisa } = g; return sisa; });
    setKonflik(null); setAbaikan([]);
  };
  const sentuhi = (key: string) => setSentuh((s) => (s.has(key) ? s : new Set(s).add(key)));
  const rapikanAngka = (key: string) => { sentuhi(key); const n = bacaAngka(nilai[key] ?? ''); if (n !== null) ubah(key, fmtAngka(n, 3)); };

  const pilihBarang = (o: ItemKatalog) => {
    setNilai((n) => ({
      ...n, kode: o.kode, namaBarang: o.nama, satuan: o.satuan || n.satuan || '',
      harga: !n.harga && o.harga > 0 ? fmtAngka(o.harga, 2) : (n.harga ?? ''),
    }));
    setGalatServer((g) => { const { kode: _a, namaBarang: _b, ...sisa } = g; return sisa; });
    setKonflik(null); setAbaikan([]);
    setTimeout(() => document.getElementById('im-f-jumlah')?.focus(), 30);
  };

  const kotor = Object.entries(nilai).some(([k, v]) => v && !['tanggal', 'alokasi', 'pic'].includes(k));
  const tutup = () => { if (kotor && tahap !== 'selesai' && !window.confirm('Isian belum disimpan. Tutup dan buang isian ini?')) return; onTutup(); };

  useEffect(() => {
    if (!buka) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [buka]);

  const keAtas = () => badanRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  const lanjutPeriksa = () => {
    setCoba(true);
    const pertama = (tabObj?.kolom ?? []).map(kunciKolom).find((key) => galat[key]);
    if (pertama) { document.getElementById(`im-f-${pertama}`)?.focus(); return; }
    setTahap('periksa'); keAtas();
  };

  const simpan = async (tambahan: string[] = []) => {
    if (!tabObj) return;
    const daftarAbaikan = [...new Set([...abaikan, ...tambahan])];
    setMenyimpan(true); setKonflik(null); setGalatUmum('');
    const payload: Record<number, string | number> = {};
    for (const k of tabObj.kolom) {
      if (k.auto || k.rumus) continue;
      const v = (efektif[kunciKolom(k)] ?? '').trim();
      payload[k.idx] = k.jenis === 'angka' ? (v === '' ? '' : (bacaAngka(v) ?? v)) : v;
    }
    try {
      const h = await api.post<HasilSimpan>('/weekly-reports/input', { site, direction: arah, tab, nilai: payload, abaikan: daftarAbaikan }, { timeoutMs: 90_000, ulang: false });
      setHasil(h); setTahap('selesai'); keAtas();
      void muatRiwayat(); void muatKonfig(true); onTersimpan();
    } catch (e) {
      const err = e as ApiError;
      const d = err.data as { konflik?: string; galatField?: Record<string, string> } | undefined;
      if (err.status === 422 && d?.galatField) {
        const peta: Record<string, string> = {};
        for (const k of tabObj.kolom) if (d.galatField[k.idx]) peta[kunciKolom(k)] = d.galatField[k.idx];
        setGalatServer(peta); setCoba(true); setTahap('isi');
      } else if (err.status === 409 && d?.konflik) { setKonflik({ jenis: d.konflik, pesan: err.message }); setAbaikan(daftarAbaikan); }
      else setGalatUmum(err.message || 'Gagal menyimpan. Coba lagi.');
    } finally { setMenyimpan(false); }
  };

  const kirimUlang = async (id: string) => {
    setMengirimUlang(id);
    try { await api.post(`/weekly-reports/input/${id}/kirim-ulang`, undefined, { timeoutMs: 90_000, ulang: false }); }
    catch (e) { setGalatUmum((e as Error).message); }
    finally { setMengirimUlang(''); void muatRiwayat(); onTersimpan(); }
  };

  const tombolKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.stopPropagation(); tutup(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (tahap === 'isi') lanjutPeriksa(); else if (tahap === 'periksa' && !menyimpan) void simpan();
      return;
    }
    // Enter di sebuah kolom = pindah ke kolom berikutnya; di kolom terakhir = lanjut meninjau.
    const el = e.target as HTMLElement;
    if (e.key === 'Enter' && !e.defaultPrevented && tahap === 'isi' && el.tagName === 'INPUT') {
      const semua = Array.from(badanRef.current?.querySelectorAll<HTMLInputElement>('input:not([disabled]):not([readonly])') ?? []);
      const i = semua.indexOf(el as HTMLInputElement);
      if (i >= 0) { e.preventDefault(); if (i < semua.length - 1) semua[i + 1].focus(); else lanjutPeriksa(); }
    }
  };

  const salinEmail = async (email: string) => {
    try { await navigator.clipboard.writeText(email); setEmailDisalin(true); setTimeout(() => setEmailDisalin(false), 1800); } catch { /* clipboard tidak tersedia */ }
  };

  const geserAngka = (key: string, d: number) => {
    const n = bacaAngka(nilai[key] ?? '') ?? 0;
    ubah(key, fmtAngka(Math.max(0, Math.round((n + d) * 1000) / 1000), 3));
    sentuhi(key);
  };

  if (!buka) return null;

  // ── Render satu kolom form ────────────────────────────────────────────────
  const saranSatuan = [...new Set([itemDipilih?.satuan ?? '', ...(konfig?.saran.satuan ?? [])].filter(Boolean))].slice(0, 6);
  const renderKolom = (k: KolomInput) => {
    const key = kunciKolom(k);
    const val = efektif[key] ?? '';
    const err = galatTampil(key);
    const id = `im-f-${key}`;
    const penuh = k.field === 'namaBarang' || k.field === 'jumlah' || k.field === 'keterangan' || k.field === 'statusSmr';
    const label = (
      <div className="im-lbl">
        <label htmlFor={id}>{k.judul}{k.wajib && <span className="wajib" aria-hidden="true">*</span>}</label>
        {ketWrAktif && k === kolomKetWr && (ketWrManual
          ? <button type="button" className="im-chip" onClick={() => setKetWrManual(false)}>↺ isi otomatis dari No. WR</button>
          : <span className="auto">otomatis dari No. WR</span>)}
        {k.field === 'totalHarga' && !k.rumus && (totalManual
          ? <button type="button" className="im-chip" onClick={() => setTotalManual(false)}>↺ hitung otomatis</button>
          : <span className="auto">otomatis</span>)}
      </div>
    );
    let kontrol: React.ReactNode;
    if (k.rumus) {
      kontrol = <input id={id} className="fm-input" value="(dihitung otomatis oleh sheet)" disabled readOnly />;
    } else if (k.field === 'tanggal') {
      kontrol = (
        <>
          <input id={id} type="date" className="fm-input" value={val} max={hariIni} onChange={(e) => ubah(key, e.target.value)} onBlur={() => sentuhi(key)} aria-invalid={!!err || undefined} />
          <div className="im-chips">
            {[['Hari ini', 0], ['Kemarin', -1], ['2 hari lalu', -2]].map(([t, h]) => (
              <button key={t as string} type="button" className="im-chip" aria-pressed={val === geserHari(hariIni, h as number)} onClick={() => ubah(key, geserHari(hariIni, h as number))}>{t}</button>
            ))}
          </div>
        </>
      );
    } else if (k.field === 'kode') {
      kontrol = <KotakCari id={id} nilai={val} onUbah={(v) => ubah(key, v)} opsi={konfig?.katalog ?? []} onPilih={pilihBarang} placeholder="mis. I-RDA-00294" invalid={!!err} mode="kode" />;
    } else if (k.field === 'namaBarang') {
      kontrol = <KotakCari id={id} nilai={val} onUbah={(v) => ubah(key, v)} opsi={konfig?.katalog ?? []} onPilih={pilihBarang} placeholder="Ketik nama atau kode — saran muncul dari barang yang sudah ada" invalid={!!err} mode="nama" />;
    } else if (k.field === 'jumlah') {
      kontrol = (
        <div className="im-stepper">
          <button type="button" className="im-step-btn" aria-label="Kurangi jumlah" onClick={() => geserAngka(key, -1)} tabIndex={-1}><Minus size={16} /></button>
          <div className="im-satuan">
            <input id={id} className="fm-input im-angka" inputMode="decimal" autoComplete="off" value={val} placeholder="0"
              style={efektif.satuan ? { paddingRight: '4.2rem' } : undefined}
              onChange={(e) => ubah(key, e.target.value)} onBlur={() => rapikanAngka(key)} aria-invalid={!!err || undefined} />
            {efektif.satuan && <span className="im-akhiran">{efektif.satuan}</span>}
          </div>
          <button type="button" className="im-step-btn" aria-label="Tambah jumlah" onClick={() => geserAngka(key, 1)} tabIndex={-1}><Plus size={16} /></button>
        </div>
      );
    } else if (k.jenis === 'angka') {
      kontrol = (
        <div className="im-satuan">
          <input id={id} className="fm-input im-angka" inputMode="decimal" autoComplete="off" value={val} placeholder="0"
            style={k.field === 'harga' || k.field === 'totalHarga' ? { paddingRight: '2.6rem' } : undefined}
            onChange={(e) => { if (k.field === 'totalHarga') setTotalManual(true); ubah(key, e.target.value); }}
            onBlur={() => rapikanAngka(key)} aria-invalid={!!err || undefined} />
          {k.field === 'jumlah' && efektif.satuan && <span className="im-akhiran">{efektif.satuan}</span>}
          {(k.field === 'harga' || k.field === 'totalHarga') && <span className="im-akhiran">Rp</span>}
        </div>
      );
    } else if (k.field === 'satuan') {
      kontrol = (
        <>
          <input id={id} className="fm-input" value={val} list="im-dl-satuan" autoComplete="off" onChange={(e) => ubah(key, e.target.value)} onBlur={() => sentuhi(key)} aria-invalid={!!err || undefined} placeholder="mis. PCS" />
          <div className="im-chips">{saranSatuan.map((s) => <button key={s} type="button" className="im-chip" aria-pressed={val.toLowerCase() === s.toLowerCase()} onClick={() => ubah(key, s)}>{s}</button>)}</div>
        </>
      );
    } else if (k.field === 'alokasi') {
      kontrol = (
        <>
          <input id={id} className="fm-input" value={val} list="im-dl-alokasi" autoComplete="off" onChange={(e) => ubah(key, e.target.value)} onBlur={() => sentuhi(key)} aria-invalid={!!err || undefined} placeholder={arah === 'IN' ? 'Nama supplier / asal barang' : 'Dipakai untuk apa / unit mana'} />
          <div className="im-chips">{(konfig?.saran.alokasi ?? []).slice(0, 5).map((s) => <button key={s} type="button" className="im-chip" aria-pressed={val === s} onClick={() => ubah(key, s)}>{s}</button>)}</div>
        </>
      );
    } else if (k.field === 'statusSmr') {
      kontrol = (
        <>
          <input id={id} className="fm-input" value={val} list="im-dl-status" autoComplete="off" onChange={(e) => ubah(key, e.target.value)} />
          <div className="im-chips">{(konfig?.saran.status ?? []).slice(0, 6).map((s) => <button key={s} type="button" className="im-chip" aria-pressed={val === s} onClick={() => ubah(key, s)}>{s}</button>)}</div>
        </>
      );
    } else {
      kontrol = <input id={id} className="fm-input" value={val} autoComplete="off" list={k.field === 'pic' ? 'im-dl-pic' : undefined}
        placeholder={ketWrAktif && k === kolomKetWr ? 'Terisi otomatis setelah No. WR diisi' : undefined}
        onChange={(e) => { if (ketWrAktif && k === kolomKetWr) setKetWrManual(e.target.value !== ''); ubah(key, e.target.value); }} onBlur={() => sentuhi(key)} aria-invalid={!!err || undefined} />;
    }
    return (
      <div key={key} className={`im-field${penuh ? ' im-full' : ''}${err ? ' salah' : ''}${k.rumus ? ' rumus' : ''}`}>
        {label}
        {kontrol}
        {err && <div className="im-pesan-salah" role="alert">{err}</div>}
        {k.field === 'tanggal' && tglValid && !err && <div className="im-info">Minggu {mingguIso(tglIso)} · {BLN[Number(tglIso.slice(5, 7)) - 1]} {tglIso.slice(0, 4)} — Minggu, Bulan, dan Tahun terisi otomatis.</div>}
      </div>
    );
  };

  // ── Pratinjau ────────────────────────────────────────────────────────────
  const barisPratinjau = (tabObj?.kolom ?? []).map((k) => {
    const key = kunciKolom(k);
    const v = (efektif[key] ?? '').trim();
    let tampil: string, otomatis = false;
    if (k.rumus) { tampil = '(dihitung oleh sheet)'; otomatis = true; }
    else if (k.field === 'minggu') { tampil = tglValid ? String(mingguIso(tglIso)) : ''; otomatis = true; }
    else if (k.field === 'bulan') { tampil = tglValid ? String(Number(tglIso.slice(5, 7))) : ''; otomatis = true; }
    else if (k.field === 'tahun') { tampil = tglValid ? tglIso.slice(0, 4) : ''; otomatis = true; }
    else if (k.field === 'tanggal') tampil = tglValid ? tglPendek(tglIso) : v;
    else if (k.jenis === 'angka') { const n = bacaAngka(v); tampil = n === null ? v : `${(k.field === 'harga' || k.field === 'totalHarga') ? 'Rp ' : ''}${fmtAngka(n, 3)}`; }
    else tampil = k.field === 'kode' ? v.toUpperCase() : v;
    return { k, tampil, otomatis };
  });

  const statusKoneksi = !konfig ? null : konfig.tersambung
    ? { kelas: 'ok', ikon: <Cloud size={16} />, ringkas: 'Terhubung ke Google Sheet', teks: <>Data yang disimpan langsung menjadi baris baru di sheet, dan perubahan di sheet masuk ke website lewat sinkron otomatis.</> }
    : !konfig.sheetDiatur
      ? { kelas: 'warn', ikon: <CloudOff size={16} />, ringkas: `Sumber Sheet ${siteLabel} belum diatur — data disimpan di aplikasi dulu`, teks: <>Data tersimpan di aplikasi dan baru masuk ke sheet setelah sumbernya diatur lewat tombol <b>Sumber Sheet</b>.</> }
      : { kelas: 'warn', ikon: <CloudOff size={16} />, ringkas: 'Belum tersambung ke Google Sheet — data disimpan di aplikasi dulu', teks: <>Data tetap tersimpan di aplikasi dan otomatis dikirim begitu koneksi diaktifkan (admin: pasang akun layanan Google dan bagikan sheet sebagai Editor).</> };

  // ── Pengelompokan kolom agar form terbaca per bagian ───────────────────────
  const URUT_BARANG = ['namaBarang', 'kode', 'satuan', 'jumlah'];
  const kolomUrut = (daftar: KolomInput[], urut: string[]) => [...daftar].sort((a, b) => {
    const ia = urut.indexOf(a.field ?? ''), ib = urut.indexOf(b.field ?? '');
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const bagian = [
    { id: 'waktu', judul: 'Waktu', kolom: kolomForm.filter((k) => k.field === 'tanggal') },
    { id: 'barang', judul: 'Barang', kolom: kolomUrut(kolomForm.filter((k) => ['kode', 'namaBarang', 'jumlah', 'satuan'].includes(k.field ?? '')), URUT_BARANG) },
    { id: 'nilai', judul: 'Nilai', kolom: kolomForm.filter((k) => k.field === 'harga' || k.field === 'totalHarga') },
    { id: 'ref', judul: arah === 'IN' ? 'Supplier & keterangan' : 'Alokasi & keterangan', kolom: kolomForm.filter((k) => !['tanggal', 'kode', 'namaBarang', 'jumlah', 'satuan', 'harga', 'totalHarga'].includes(k.field ?? '')).sort((a, b) => Number(adalahKetWr(a)) - Number(adalahKetWr(b))) },
  ].filter((b) => b.kolom.length > 0);

  // Kartu ringkas barang terpilih: saldo tercatat dan perkiraan saldo setelah transaksi ini.
  const jmlNum = bacaAngka(efektif.jumlah ?? '');
  const saldoTahu = itemDipilih && itemDipilih.saldo >= 0;
  const sisaSaldo = itemDipilih && saldoTahu && jmlNum !== null && jmlNum > 0 ? itemDipilih.saldo + (arah === 'OUT' ? -jmlNum : jmlNum) : null;
  const kartuBarang = itemDipilih ? (
    <div className={`im-item${sisaSaldo !== null && sisaSaldo < 0 ? ' neg' : ''}`} aria-live="polite">
      <div className="im-item-a">
        <b>{itemDipilih.nama}</b>
        <span>{itemDipilih.kode}{saldoTahu ? ` · saldo tercatat ${fmtAngka(itemDipilih.saldo)} ${itemDipilih.satuan}` : ''}</span>
      </div>
      {sisaSaldo !== null && (
        <div className="im-item-b">
          <small>Saldo setelah {arah === 'OUT' ? 'keluar' : 'masuk'}</small>
          <b>{fmtAngka(sisaSaldo)} {itemDipilih.satuan}</b>
        </div>
      )}
    </div>
  ) : null;

  // Daftar kolom yang masih perlu dilengkapi — ditampilkan di bilah bawah, klik untuk melompat ke kolomnya.
  const perluDiisi = (tabObj?.kolom ?? []).filter((k) => !k.auto && !k.rumus && galat[kunciKolom(k)]);
  const langkah: Array<['isi' | 'periksa' | 'selesai', string]> = [['isi', 'Isi data'], ['periksa', 'Tinjau'], ['selesai', 'Selesai']];
  const urutTahap = { isi: 0, periksa: 1, selesai: 2 }[tahap];

  return (
    <div className="im-overlay" onClick={(e) => { if (e.target === e.currentTarget) tutup(); }}>
      <div className="im-panel" role="dialog" aria-modal="true" aria-label={`Catat ${namaArah}`} onKeyDown={tombolKey}>
        <div className="im-head">
          <div className="im-head-ico"><IkonArah size={22} /></div>
          <div style={{ minWidth: 0 }}>
            <h3 className="im-title">Catat {namaArah}</h3>
            <div className="im-sub">{siteLabel} · kolom mengikuti template Google Sheet</div>
          </div>
          <button type="button" className="fm-close" onClick={tutup} aria-label="Tutup"><X size={18} /></button>
        </div>
        <ol className="im-steps" aria-label="Langkah pencatatan">
          {langkah.map(([k, t], i) => (
            <li key={k} className={i < urutTahap ? 'done' : i === urutTahap ? 'now' : ''} aria-current={i === urutTahap ? 'step' : undefined}>
              {k === 'isi' && tahap === 'periksa'
                ? <button type="button" className="im-step-link" onClick={() => { setTahap('isi'); setKonflik(null); }} disabled={menyimpan}><span className="im-step-no">{i < urutTahap ? <Check size={12} /> : i + 1}</span>{t}</button>
                : <span className="im-step-link"><span className="im-step-no">{i < urutTahap ? <Check size={12} /> : i + 1}</span>{t}</span>}
            </li>
          ))}
        </ol>

        <div className="im-body" ref={badanRef}>
          {memuat && <div className="im-muat"><Loader2 size={18} className="im-putar" /> Memuat template sheet…</div>}
          {galatMuat && <div className="fm-error" role="alert">{galatMuat}</div>}

          {konfig && !memuat && (
            <>
              {statusKoneksi && tahap !== 'selesai' && (
                <div className={`im-status im-status--ringkas ${statusKoneksi.kelas}`}>
                  {statusKoneksi.ikon}
                  <div className="im-status-t"><b>{statusKoneksi.ringkas}</b></div>
                  <button type="button" className="im-link" aria-expanded={statusBuka} onClick={() => setStatusBuka((v) => !v)}>
                    {statusBuka ? 'Tutup' : 'Detail'} <ChevronDown size={14} style={{ transform: statusBuka ? 'rotate(180deg)' : undefined }} />
                  </button>
                  {statusBuka && (
                    <div className="im-status-d">
                      {statusKoneksi.teks}
                      {konfig.emailLayanan
                        ? <div className="im-email">
                            <span>Bagikan sheet sebagai <b>Editor</b> ke:</span>
                            <code>{konfig.emailLayanan}</code>
                            <button type="button" className="im-chip" onClick={() => void salinEmail(konfig.emailLayanan!)}>{emailDisalin ? 'Tersalin ✓' : 'Salin'}</button>
                          </div>
                        : <div className="im-email"><span>Server belum punya akun layanan. Isi variabel <code>GOOGLE_SERVICE_ACCOUNT_B64</code> di hosting backend lalu deploy ulang.</span></div>}
                    </div>
                  )}
                </div>
              )}

              {konfig.tabs.length === 0 && (
                <div className="im-status warn"><AlertTriangle size={16} /><div><b>Template sheet belum tersinkron.</b> Klik “Sync Sekarang” di halaman Laporan supaya form bisa mengikuti kolom sheet {siteLabel}, lalu buka lagi panel ini.</div></div>
              )}

              {tabObj && tahap === 'isi' && (
                <>
                  {konfig.tabs.length > 1 && (
                    <div>
                      <span className="im-lbl">Tab tujuan di sheet</span>
                      <div className="im-tabs" role="group" aria-label="Tab tujuan">
                        {konfig.tabs.map((t) => (
                          <button key={t.tab} type="button" className="im-tab" aria-pressed={t.tab === tab} onClick={() => { setTab(t.tab); setKonflik(null); setAbaikan([]); }}>
                            <b>{NAMA_ENTITAS[t.entitas] ?? t.entitas}</b><small>{t.tab}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {galatUmum && <div className="fm-error" role="alert">{galatUmum}</div>}
                  {bagian.map((b) => (
                    <section key={b.id} className="im-sec" aria-label={b.judul}>
                      <h4 className="im-sec-t">{b.judul}</h4>
                      <div className="im-grid">{b.kolom.map(renderKolom)}</div>
                      {b.id === 'barang' && kartuBarang}
                    </section>
                  ))}
                  {peringatan.length > 0 && <div className="im-peringatan" role="status">{peringatan.map((p) => <p key={p}><AlertTriangle size={15} />{p}</p>)}</div>}
                  <datalist id="im-dl-satuan">{[...(konfig.saran.satuan)].map((s) => <option key={s} value={s} />)}</datalist>
                  <datalist id="im-dl-alokasi">{konfig.saran.alokasi.map((s) => <option key={s} value={s} />)}</datalist>
                  <datalist id="im-dl-pic">{konfig.saran.pic.map((s) => <option key={s} value={s} />)}</datalist>
                  <datalist id="im-dl-status">{konfig.saran.status.map((s) => <option key={s} value={s} />)}</datalist>
                </>
              )}

              {tabObj && tahap === 'periksa' && (
                <>
                  <div className="im-status ok"><Info size={16} /><div>Tinjau sekali lagi. Ini yang akan ditambahkan sebagai <b>baris baru</b> di tab <b>{tabObj.tab}</b>{konfig.tersambung ? ' pada Google Sheet' : ''}.</div></div>
                  <div className="im-pratinjau">
                    <table><tbody>
                      {barisPratinjau.map(({ k, tampil, otomatis }) => (
                        <tr key={k.idx}><th scope="row">{k.judul}</th><td className={otomatis ? 'auto' : undefined}>{tampil || '—'}</td></tr>
                      ))}
                    </tbody></table>
                  </div>
                  {peringatan.length > 0 && <div className="im-peringatan" role="status">{peringatan.map((p) => <p key={p}><AlertTriangle size={15} />{p}</p>)}</div>}
                  {konflik && (
                    <div className="im-kartu warn" role="alert">
                      <h4>{konflik.jenis === 'duplikat' ? 'Kemungkinan input ganda' : 'Periksa tab tujuan'}</h4>
                      <p>{konflik.pesan}</p>
                      <div className="baris">
                        <button type="button" className="im-btn-sec" onClick={() => { setKonflik(null); setTahap('isi'); }}>Ubah data</button>
                        <button type="button" className="btn-primary" disabled={menyimpan} onClick={() => void simpan([konflik.jenis])}>Tetap simpan</button>
                      </div>
                    </div>
                  )}
                  {galatUmum && <div className="fm-error" role="alert">{galatUmum}</div>}
                </>
              )}

              {tahap === 'selesai' && hasil && (
                <div className={`im-kartu ${hasil.status === 'ok' ? 'ok' : 'warn'}`} role="status">
                  <div className="im-ikon-besar">{hasil.status === 'ok' ? <CheckCircle2 size={28} /> : <AlertTriangle size={26} />}</div>
                  <h4>{hasil.status === 'ok' ? 'Tersimpan' : hasil.status === 'pending' ? 'Tersimpan di aplikasi, menunggu dikirim ke sheet' : 'Tersimpan di aplikasi, belum masuk ke sheet'}</h4>
                  <p>{hasil.pesan}</p>
                  <div className="baris">
                    <button type="button" className="btn-primary" onClick={() => { kosongkan(true); setTahap('isi'); setTimeout(() => document.getElementById('im-f-kode')?.focus(), 60); }}><Plus size={16} /> Catat lagi</button>
                    <button type="button" className="im-btn-sec" onClick={onTutup}>Selesai</button>
                    {hasil.status === 'gagal' && <button type="button" className="im-btn-sec" disabled={mengirimUlang === hasil.id} onClick={() => void kirimUlang(hasil.id)}><RefreshCw size={14} /> Kirim ulang</button>}
                  </div>
                </div>
              )}

              {riwayat.length > 0 && (
                <details className="im-riwayat" open={tahap === 'selesai' || undefined}>
                  <summary>Catatan terbaru <span className="im-hitung">{riwayat.length}</span></summary>
                  <ul>
                    {riwayat.slice(0, tahap === 'selesai' ? 8 : 4).map((r) => (
                      <li key={r.id} title={r.error || undefined}>
                        <span className="nama">{r.nama}<span className="meta">{r.tanggal ? tglPendek(r.tanggal) : ''} · {fmtAngka(r.jumlah)} {r.satuan} · {r.tab}{r.barisSheet ? ` · baris ${r.barisSheet}` : ''}</span></span>
                        <Lencana s={r.status} />
                        {r.status !== 'ok' && <button type="button" className="im-kecil" disabled={mengirimUlang === r.id} onClick={() => void kirimUlang(r.id)}>{mengirimUlang === r.id ? '…' : 'Kirim ulang'}</button>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>

        {tabObj && tahap !== 'selesai' && (
          <div className="im-foot">
            {tahap === 'isi' ? (
              perluDiisi.length === 0
                ? <div className="im-ready ok"><CheckCircle2 size={15} /> Data lengkap — siap ditinjau</div>
                : <button type="button" className="im-ready warn" onClick={() => { setCoba(true); document.getElementById(`im-f-${kunciKolom(perluDiisi[0])}`)?.focus(); }}>
                    <AlertTriangle size={15} /> {perluDiisi.length} kolom perlu dilengkapi: {perluDiisi.slice(0, 3).map((k) => k.judul).join(', ')}{perluDiisi.length > 3 ? '…' : ''}
                  </button>
            ) : <div className="im-ready ok"><Info size={15} /> Pastikan data sudah benar sebelum disimpan</div>}
            <div className="im-foot-aksi">
              {tahap === 'isi' ? (
                <>
                  <button type="button" className="btn-primary" onClick={lanjutPeriksa} title="Ctrl + Enter"><Send size={16} /> Tinjau Data</button>
                  <button type="button" className="im-btn-sec" onClick={tutup}>Batal</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn-primary" disabled={menyimpan || !!konflik} onClick={() => void simpan()} title="Ctrl + Enter">
                    {menyimpan ? <><Loader2 size={16} className="im-putar" /> Menyimpan…</> : <><Send size={16} /> {konfig?.tersambung ? 'Simpan ke Sheet' : 'Simpan'}</>}
                  </button>
                  <button type="button" className="im-btn-sec" onClick={() => { setTahap('isi'); setKonflik(null); }} disabled={menyimpan}><ArrowLeft size={16} /> Ubah</button>
                </>
              )}
              <span className="im-bantu"><kbd>Enter</kbd> kolom berikutnya · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> lanjut</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}