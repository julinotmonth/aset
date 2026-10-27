// Global Search — mencari di seluruh data yang SAAT INI tampil di portal:
//   • Halaman & sub-menu yang terbuka (Laporan, Spare Part, Aset, Jadwal, Site, Tim, Pengguna)
//   • Katalog Spare Part (kode I-RDA / I-RCE), Barang Masuk / Keluar, Aset  ← dari Laporan Mingguan (server)
//   • PICA                                                                   ← dari server
//   • Site Operasional dan (khusus Super Admin) akun pengguna                ← dari memori browser
//
// Dipakai dalam dua bentuk dari satu komponen yang sama:
//   <GlobalSearchView>     halaman penuh (menu "Global Search" di sidebar)
//   <GlobalSearchPalette>  jendela cepat yang dibuka dengan Ctrl/⌘+K dari halaman mana pun
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, ScanLine, X, CornerDownLeft, ArrowUp, ArrowDown, History, Package, CalendarClock, MapPin, Users, FileText,
  ClipboardList, TrendingUp, TrendingDown, Gauge, Target, PackageCheck, PieChart, Boxes, ArrowLeftRight, UserCog,
  Loader2, ChevronRight, AlertTriangle, RefreshCw, Trash2, Compass, Building2,
} from 'lucide-react';
import type { AppUser, AuthState } from '../../types';
import { api } from '../../lib/api';
import { getSites, useSitesRefresh } from '../../data/siteStore';
import { PageHeader } from './AdminExtraViews';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { labelSiteDariKey } from './siteLabel';
import { menuTerbuka } from './menuAkses';
import type { AdminView, AsetTab, LaporanMode } from './Sidebar';
import type { TujuanNav } from './JadwalMaintenance';

/** Konteks yang dibawa ke halaman tujuan supaya langsung tampil di site / tahun hasil yang diklik. */
export interface FokusLaporan { site?: string; tahun?: number; cari?: string }

type Kategori = 'halaman' | 'sparepart' | 'laporan' | 'aset' | 'pica' | 'site' | 'pengguna';

interface Hasil {
  id: string;
  kat: Kategori;
  judul: string;
  sub: string;
  badge: string;
  ikon: React.ElementType;
  warna: string;
  skor: number;
  buka: () => void;
}

interface DataServer {
  sparePart: { total: number; items: { kode: string; nama: string; satuan: string; masuk: number; keluar: number; saldo: number; jmlSite: number }[] };
  laporan: { total: number; items: { id: string; site: string; direction: 'IN' | 'OUT' | 'ASET'; tahun: number; minggu: number; namaBarang: string; kode: string; jumlah: number; satuan: string; pic: string; noMr: string; detailAlokasi: string }[] };
  pica: { total: number; items: { id: string; site: string; no: string; problem: string; identifikasi: string; status: string; pic: string; latestNote: string }[] };
}

const META: Record<Kategori, { label: string; ikon: React.ElementType; warna: string }> = {
  halaman: { label: 'Halaman', ikon: Compass, warna: '#00D084' },
  sparepart: { label: 'Spare Part', ikon: Package, warna: '#38BDF8' },
  laporan: { label: 'Barang Masuk / Keluar', ikon: FileText, warna: '#FBBF24' },
  aset: { label: 'Aset', ikon: Building2, warna: '#A78BFA' },
  pica: { label: 'PICA', ikon: ClipboardList, warna: '#F472B6' },
  site: { label: 'Site Operasional', ikon: MapPin, warna: '#34D399' },
  pengguna: { label: 'Pengguna', ikon: Users, warna: '#60A5FA' },
};
const URUTAN: Kategori[] = ['halaman', 'sparepart', 'laporan', 'aset', 'pica', 'site', 'pengguna'];
const DARI_SERVER: Kategori[] = ['sparepart', 'laporan', 'aset', 'pica'];
const RECENT_KEY = 'reethau_gs_recent';
const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

const GS_CSS = `
.gs{display:flex;flex-direction:column;min-width:0}
.gs-box{display:flex;gap:.6rem;align-items:stretch;padding:.9rem;border-radius:16px;margin-bottom:.9rem}
.gs-field{position:relative;flex:1;min-width:0}
.gs-field>svg.gs-lead{position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:var(--txt-muted);pointer-events:none}
.gs-input{width:100%;min-height:48px;padding:.8rem 2.6rem .8rem 2.8rem;border-radius:12px;font:inherit;font-size:1rem;background:var(--bg-root);color:var(--txt-primary);border:1px solid var(--border-subtle);outline:none;transition:border-color .15s,box-shadow .15s}
.gs-input:focus{border-color:var(--ce-green);box-shadow:0 0 0 3px rgba(0,208,132,.16)}
.gs-input::placeholder{color:var(--txt-muted)}
.gs-clear{position:absolute;right:.45rem;top:50%;transform:translateY(-50%);width:32px;height:32px;border-radius:8px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;background:transparent;color:var(--txt-muted)}
.gs-clear:hover{background:var(--chip-bg);color:var(--txt-primary)}
.gs-clear:focus-visible,.gs-scan:focus-visible,.gs-chip:focus-visible,.gs-opt:focus-visible,.gs-card:focus-visible,.gs-more:focus-visible{outline:2px solid var(--ce-green);outline-offset:2px}
.gs-spin{position:absolute;right:2.9rem;top:50%;margin-top:-8px;color:var(--ce-green);animation:gs-rot .8s linear infinite}
@keyframes gs-rot{to{transform:rotate(360deg)}}
.gs-scan{flex-shrink:0;display:flex;align-items:center;gap:.5rem;padding:0 1.1rem;border-radius:12px;cursor:pointer;font:inherit;font-weight:700;font-size:.9rem;color:var(--ce-green);background:linear-gradient(135deg,rgba(0,208,132,.18),rgba(0,208,132,.08));border:1px solid rgba(0,208,132,.45)}
.gs-scan:hover{background:rgba(0,208,132,.22)}

.gs-chips{display:flex;gap:.45rem;overflow-x:auto;padding:.1rem .1rem .55rem;margin-bottom:.35rem;scrollbar-width:thin}
.gs-chip{display:inline-flex;align-items:center;gap:.4rem;flex-shrink:0;min-height:36px;padding:.35rem .8rem;border-radius:999px;cursor:pointer;font:inherit;font-size:.8rem;font-weight:700;color:var(--txt-tertiary);background:var(--chip-bg);border:1px solid var(--chip-border);white-space:nowrap}
.gs-chip:hover{color:var(--txt-primary)}
.gs-chip.is-on{color:var(--ce-green);background:rgba(0,208,132,.12);border-color:rgba(0,208,132,.5)}
.gs-chip em{font-style:normal;font-size:.7rem;padding:.05rem .4rem;border-radius:999px;background:var(--bg-root);color:var(--txt-muted)}
.gs-chip.is-on em{color:var(--ce-green)}

.gs-list{display:flex;flex-direction:column;gap:1rem;min-width:0}
.gs-group-h{display:flex;align-items:center;gap:.5rem;padding:0 .25rem .45rem;font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--txt-muted)}
.gs-group-h b{font-weight:700;color:var(--txt-tertiary);letter-spacing:0}
.gs-opts{display:flex;flex-direction:column;gap:.3rem}
.gs-opt{display:flex;align-items:center;gap:.8rem;width:100%;text-align:left;padding:.65rem .8rem;border-radius:12px;cursor:pointer;font:inherit;color:inherit;background:var(--bg-card);border:1px solid var(--border-subtle);min-width:0;transition:border-color .12s,background .12s}
.gs-opt.is-active,.gs-opt:hover{background:var(--bg-card-hover);border-color:rgba(0,208,132,.45)}
.gs-ico{width:36px;height:36px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.gs-main{flex:1;min-width:0}
.gs-t{font-size:.9rem;font-weight:700;color:var(--txt-primary);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}
.gs-s{font-size:.76rem;color:var(--txt-muted);margin-top:.15rem;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}
.gs-badge{flex-shrink:0;font-size:.66rem;font-weight:800;padding:.18rem .55rem;border-radius:999px;white-space:nowrap}
.gs-go{flex-shrink:0;color:var(--txt-muted);opacity:0;transition:opacity .12s}
.gs-opt.is-active .gs-go,.gs-opt:hover .gs-go{opacity:1;color:var(--ce-green)}
.gs mark{background:rgba(0,208,132,.28);color:inherit;border-radius:3px;padding:0 1px}
.gs-more{align-self:flex-start;margin:.35rem 0 0 .25rem;font:inherit;font-size:.78rem;font-weight:700;color:var(--ce-green);background:none;border:none;cursor:pointer;padding:.3rem .4rem;border-radius:8px}
.gs-more:hover{text-decoration:underline}
.gs-note{font-size:.74rem;color:var(--txt-muted);padding:.35rem .35rem 0}

.gs-state{text-align:center;padding:2.2rem 1rem;border-radius:16px;color:var(--txt-muted)}
.gs-state svg{margin-bottom:.6rem;opacity:.65}
.gs-state h4{margin:0 0 .3rem;color:var(--txt-primary);font-size:1rem}
.gs-state p{margin:0 auto;max-width:440px;font-size:.84rem;line-height:1.55}
.gs-warn{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;padding:.65rem .85rem;margin-bottom:.9rem;border-radius:12px;font-size:.8rem;color:#FBBF24;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3)}
.gs-warn button{margin-left:auto;display:inline-flex;align-items:center;gap:.3rem;font:inherit;font-size:.76rem;font-weight:700;color:#FBBF24;background:none;border:1px solid rgba(251,191,36,.4);border-radius:8px;padding:.25rem .6rem;cursor:pointer}

.gs-sec-h{display:flex;align-items:center;justify-content:space-between;gap:.5rem;font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--txt-muted);margin:1.15rem 0 .6rem}
.gs-sec-h button{display:inline-flex;align-items:center;gap:.3rem;font:inherit;font-size:.72rem;font-weight:700;text-transform:none;letter-spacing:0;color:var(--txt-muted);background:none;border:none;cursor:pointer;padding:.2rem .3rem;border-radius:6px}
.gs-sec-h button:hover{color:#F87171}
.gs-recents{display:flex;flex-wrap:wrap;gap:.45rem}
.gs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(230px,100%),1fr));gap:.7rem}
.gs-card{display:flex;align-items:center;gap:.75rem;text-align:left;padding:.8rem .9rem;border-radius:14px;cursor:pointer;font:inherit;color:inherit;background:var(--bg-card);border:1px solid var(--border-subtle);min-width:0;transition:transform .12s,border-color .12s}
.gs-card:hover{transform:translateY(-2px);border-color:rgba(0,208,132,.45)}
.gs-card b{display:block;font-size:.86rem;color:var(--txt-primary)}
.gs-card span.s{display:block;font-size:.72rem;color:var(--txt-muted);margin-top:.1rem}

.gs-foot{display:flex;gap:1rem;flex-wrap:wrap;align-items:center;font-size:.72rem;color:var(--txt-muted);padding-top:.8rem}
.gs-foot kbd,.gs-kbd{font:inherit;font-size:.68rem;font-weight:700;padding:.1rem .4rem;border-radius:5px;background:var(--chip-bg);border:1px solid var(--chip-border);color:var(--txt-tertiary)}

.gs-pal-ov{position:fixed;inset:0;z-index:120;display:flex;justify-content:center;align-items:flex-start;padding:max(4vh,1rem) 1rem 1rem;background:rgba(5,8,16,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.gs-pal{width:100%;max-width:720px;max-height:calc(100dvh - 2rem);display:flex;flex-direction:column;border-radius:20px;border:1px solid rgba(0,208,132,.3);overflow:hidden;animation:gs-pop .16s ease both}
@keyframes gs-pop{from{opacity:0;transform:translateY(-8px) scale(.985)}to{opacity:1;transform:none}}
.gs-pal-top{padding:.9rem .9rem 0;flex-shrink:0}
.gs-pal-top .gs-box{padding:0;margin-bottom:.6rem;background:none;border:none;box-shadow:none}
.gs-pal-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:0 .9rem .9rem}
.gs-pal-x{flex-shrink:0;width:48px;border-radius:12px;border:1px solid var(--chip-border);background:var(--chip-bg);color:var(--txt-tertiary);cursor:pointer;display:flex;align-items:center;justify-content:center}

@media (max-width:640px){
  .gs-box{flex-direction:column;padding:.75rem}
  .gs-scan{min-height:44px;justify-content:center}
  .gs-input{font-size:16px}
  .gs-badge{display:none}
  .gs-foot .gs-kbdhint{display:none}
  .gs-pal-ov{padding:0}
  .gs-pal{max-width:none;max-height:100dvh;height:100dvh;border-radius:0;border:none}
  .gs-pal-top .gs-box{flex-direction:row}
  .gs-pal-top .gs-scan span{display:none}
  .gs-pal-top .gs-scan{padding:0 .85rem}
}
@media (prefers-reduced-motion:reduce){.gs-pal,.gs-spin{animation:none}.gs-opt,.gs-card,.gs-input{transition:none}}
`;

// ── util ──────────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Beri tanda pada bagian teks yang cocok dengan kata kunci. */
const Sorot: React.FC<{ teks: string; tokens: string[] }> = ({ teks, tokens }) => {
  if (!teks || tokens.length === 0) return <>{teks}</>;
  const bagian = teks.split(new RegExp(`(${tokens.map(esc).join('|')})`, 'gi'));
  return <>{bagian.map((b, i) => (i % 2 === 1 ? <mark key={i}>{b}</mark> : <React.Fragment key={i}>{b}</React.Fragment>))}</>;
};

/** Hasil scan / tempel bisa berupa URL (mis. .../asset/I-RDA-001) atau kode polos. */
function ekstrakKode(raw: string): string {
  const t = raw.trim();
  try {
    const parts = new URL(t).pathname.split('/').filter(Boolean);
    return parts.length ? decodeURIComponent(parts[parts.length - 1]) : t;
  } catch {
    return t;
  }
}

const bacaRiwayat = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 6) : [];
  } catch { return []; }
};

interface Halaman { view: AdminView; judul: string; grup: string; ikon: React.ElementType; warna: string; kata: string; buka: () => void }

// ── Panel utama (dipakai halaman & palette) ───────────────────────────────
export interface GlobalSearchProps {
  auth: AuthState;
  users: AppUser[];
  onNavigasi: (t: TujuanNav) => void;
  onBuka: (view: AdminView) => void;
  onBukaLaporan: (mode: LaporanMode, fokus: FokusLaporan) => void;
  onBukaAset: (tab: AsetTab, fokus: FokusLaporan) => void;
}

const PanelCari: React.FC<GlobalSearchProps & { palette?: boolean; onTutup?: () => void }> = ({
  auth, users, onNavigasi, onBuka, onBukaLaporan, onBukaAset, palette, onTutup,
}) => {
  useSitesRefresh();
  const idUnik = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'ALL' | Kategori>('ALL');
  const [aktif, setAktif] = useState(0);
  const [terbuka, setTerbuka] = useState<Set<Kategori>>(new Set());
  const [riwayat, setRiwayat] = useState<string[]>(bacaRiwayat);
  const [scanBuka, setScanBuka] = useState(false);
  const [versi, setVersi] = useState(0);
  const [srv, setSrv] = useState<{ data: DataServer | null; memuat: boolean; galat: string }>({ data: null, memuat: false, galat: '' });
  const reqId = useRef(0);

  const isSA = auth.role === 'Super Admin';
  const term = q.trim();
  const tokens = useMemo(() => term.toLowerCase().split(/\s+/).filter(Boolean), [term]);
  const kueri = term.length >= 2;
  // Saat satu kategori server dipilih, minta lebih banyak baris sekaligus.
  const limit = scope !== 'ALL' && DARI_SERVER.includes(scope) ? 25 : 8;

  useEffect(() => { inputRef.current?.focus(); }, []);

  // ── Pencarian ke server (ditunda 280 md; respons usang diabaikan) ──
  useEffect(() => {
    if (!kueri) { reqId.current++; setSrv({ data: null, memuat: false, galat: '' }); return; }
    const id = ++reqId.current;
    setSrv((p) => ({ ...p, memuat: true, galat: '' }));
    const t = window.setTimeout(async () => {
      try {
        const data = await api.get<DataServer>(`/search?${new URLSearchParams({ q: term, limit: String(limit) })}`);
        if (id === reqId.current) setSrv({ data, memuat: false, galat: '' });
      } catch (err) {
        if (id === reqId.current) setSrv({ data: null, memuat: false, galat: err instanceof Error ? err.message : 'Gagal mencari.' });
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [term, kueri, limit, versi]);

  const simpanRiwayat = useCallback((kata: string) => {
    const k = kata.trim();
    if (k.length < 2) return;
    setRiwayat((p) => {
      const baru = [k, ...p.filter((x) => x.toLowerCase() !== k.toLowerCase())].slice(0, 6);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(baru)); } catch { /* abaikan */ }
      return baru;
    });
  }, []);
  const hapusRiwayat = () => { setRiwayat([]); try { localStorage.removeItem(RECENT_KEY); } catch { /* abaikan */ } };

  // ── Indeks halaman: HANYA menu yang sedang terbuka di sidebar ──
  const halaman = useMemo<Halaman[]>(() => {
    const laporan = (mode: LaporanMode) => () => onBukaLaporan(mode, {});
    const semua: Halaman[] = [
      { view: 'weekly-report', judul: 'Ringkasan Laporan', grup: 'Laporan', ikon: Gauge, warna: '#00D084', kata: 'ringkasan gambaran umum overview', buka: laporan('RINGKASAN_LAPORAN') },
      { view: 'weekly-report', judul: 'Barang Masuk', grup: 'Laporan', ikon: TrendingUp, warna: '#34D399', kata: 'penerimaan incoming receive masuk', buka: laporan('IN') },
      { view: 'weekly-report', judul: 'Barang Keluar', grup: 'Laporan', ikon: TrendingDown, warna: '#F87171', kata: 'pemakaian pengeluaran issue keluar', buka: laporan('OUT') },
      { view: 'weekly-report', judul: 'Outstanding PR', grup: 'Laporan', ikon: FileText, warna: '#FBBF24', kata: 'purchase request pr pending approval released os pr', buka: laporan('OS_PR') },
      { view: 'weekly-report', judul: 'Pencapaian Safety Stock', grup: 'Laporan', ikon: PackageCheck, warna: '#38BDF8', kata: 'minimum stock min stock safety terealisasi stok', buka: laporan('MIN_STOCK') },
      { view: 'weekly-report', judul: 'Work Target / KPI', grup: 'Dashboard', ikon: Target, warna: '#A78BFA', kata: 'kpi objective strategi guideline target kerja pencapaian', buka: laporan('WORK_TARGET') },
      { view: 'weekly-report', judul: 'PICA', grup: 'Dashboard', ikon: ClipboardList, warna: '#F472B6', kata: 'problem identification corrective action masalah tindakan korektif', buka: laporan('PICA') },
      { view: 'assets', judul: 'Spare Part', grup: 'Inventory', ikon: Package, warna: '#38BDF8', kata: 'katalog saldo pergerakan stok i-rda i-rce suku cadang', buka: () => onNavigasi({ ke: 'spare-part' }) },
      { view: 'assignments', judul: 'Transfer Antar Site', grup: 'Inventory', ikon: ArrowLeftRight, warna: '#F59E0B', kata: 'pindah mutasi kirim rekomendasi transfer', buka: () => onBuka('assignments') },
      { view: 'asset-registry', judul: 'Ringkasan Aset', grup: 'Aset Tetap (EAM)', ikon: PieChart, warna: '#A78BFA', kata: 'depresiasi penyusutan nilai buku simulasi aset tetap', buka: () => onNavigasi({ ke: 'aset', tab: 'RINGKASAN' }) },
      { view: 'asset-registry', judul: 'Asset Management', grup: 'Aset Tetap (EAM)', ikon: Boxes, warna: '#C084FC', kata: 'daftar aset equipment building klasifikasi', buka: () => onNavigasi({ ke: 'aset', tab: 'ASSET_MGMT' }) },
      { view: 'work-orders', judul: 'Jadwal Maintenance', grup: 'Aset Tetap (EAM)', ikon: CalendarClock, warna: '#FB923C', kata: 'pm preventif overhaul servis terlambat segera jadwal perawatan', buka: () => onNavigasi({ ke: 'jadwal' }) },
      { view: 'branches', judul: 'Site Operasional', grup: 'Organisasi', ikon: MapPin, warna: '#34D399', kata: 'mother station lokasi cabang sumber spreadsheet sheet', buka: () => onBuka('branches') },
      { view: 'team', judul: 'Tim Lapangan', grup: 'Organisasi', ikon: Users, warna: '#60A5FA', kata: 'pic anggota tim petugas lapangan', buka: () => onBuka('team') },
      { view: 'users', judul: 'Kelola Pengguna', grup: 'Organisasi', ikon: UserCog, warna: '#FBBF24', kata: 'akun password role peran email hak akses user', buka: () => onBuka('users') },
    ];
    return semua.filter((h) => menuTerbuka(h.view) && (h.view !== 'users' || isSA));
  }, [onBukaLaporan, onNavigasi, onBuka, isSA]);

  // ── Susun hasil per kategori ──
  const { kelompok, jumlah } = useMemo(() => {
    const cocok = (hay: string) => tokens.every((t) => hay.includes(t));
    const skorJudul = (judul: string) => tokens.reduce((n, t) => n + (judul.startsWith(t) ? 100 : judul.includes(t) ? 60 : 20), 0);
    const peta: Record<Kategori, { hasil: Hasil[]; total: number }> = {
      halaman: { hasil: [], total: 0 }, sparepart: { hasil: [], total: 0 }, laporan: { hasil: [], total: 0 },
      aset: { hasil: [], total: 0 }, pica: { hasil: [], total: 0 }, site: { hasil: [], total: 0 }, pengguna: { hasil: [], total: 0 },
    };
    if (kueri) {
      const dorong = (kat: Kategori, h: Omit<Hasil, 'kat' | 'ikon' | 'warna'> & Partial<Pick<Hasil, 'ikon' | 'warna'>>) =>
        peta[kat].hasil.push({ kat, ikon: META[kat].ikon, warna: META[kat].warna, ...h });

      for (const h of halaman) {
        const judul = h.judul.toLowerCase();
        if (!cocok(`${judul} ${h.grup.toLowerCase()} ${h.kata}`)) continue;
        dorong('halaman', { id: `h:${h.grup}:${h.judul}`, judul: h.judul, sub: h.grup, badge: 'Buka halaman', ikon: h.ikon, warna: h.warna, skor: skorJudul(judul), buka: h.buka });
      }
      for (const s of getSites()) {
        const label = labelSiteDariKey(s.key);
        if (!cocok(`${label} ${s.key} ${s.subtitle}`.toLowerCase())) continue;
        dorong('site', { id: `s:${s.key}`, judul: label, sub: s.subtitle || 'Site Operasional', badge: 'Site', skor: skorJudul(label.toLowerCase()), buka: () => onBuka('branches') });
      }
      if (isSA) {
        for (const u of users) {
          if (!cocok(`${u.name} ${u.email} ${u.position} ${u.role}`.toLowerCase())) continue;
          dorong('pengguna', { id: `u:${u.id}`, judul: u.name, sub: `${u.email} · ${u.position || u.role}`, badge: u.role, skor: skorJudul(u.name.toLowerCase()), buka: () => onBuka('users') });
        }
      }
      for (const k of ['halaman', 'site', 'pengguna'] as const) {
        peta[k].hasil.sort((a, b) => b.skor - a.skor);
        peta[k].total = peta[k].hasil.length;
      }

      const d = srv.data;
      if (d) {
        peta.sparepart.total = d.sparePart.total;
        d.sparePart.items.forEach((x, i) => dorong('sparepart', {
          id: `sp:${x.kode}`, judul: x.nama || x.kode,
          sub: `${x.kode} · Masuk ${nf.format(x.masuk)} / Keluar ${nf.format(x.keluar)} · Saldo ${nf.format(x.saldo)} ${x.satuan}`.trim() + ` · ${x.jmlSite} site`,
          badge: 'Katalog', skor: 1000 - i, buka: () => onNavigasi({ ke: 'spare-part', cari: x.kode }),
        }));
        let nLap = 0;
        let nAset = 0;
        d.laporan.items.forEach((x, i) => {
          const site = labelSiteDariKey(x.site);
          const sub = `${site} · Minggu ${x.minggu} ${x.tahun} · ${nf.format(x.jumlah)} ${x.satuan}${x.pic ? ` · PIC ${x.pic}` : ''}${x.noMr ? ` · MR ${x.noMr}` : ''}`;
          const fokus: FokusLaporan = { site: x.site, tahun: x.tahun };
          if (x.direction === 'ASET') {
            nAset++;
            dorong('aset', { id: `a:${x.id}`, judul: x.namaBarang || x.kode, sub: `${x.kode ? `${x.kode} · ` : ''}${site}`, badge: 'Aset', skor: 500 - i, buka: () => onBukaAset('ASSET_MGMT', { ...fokus, cari: x.namaBarang || x.kode }) });
          } else {
            nLap++;
            dorong('laporan', { id: `l:${x.id}`, judul: x.namaBarang || x.kode, sub, badge: x.direction === 'IN' ? 'Barang Masuk' : 'Barang Keluar', ikon: x.direction === 'IN' ? TrendingUp : TrendingDown, warna: x.direction === 'IN' ? '#34D399' : '#F87171', skor: 500 - i, buka: () => onBukaLaporan(x.direction, fokus) });
          }
        });
        // Server menghitung total gabungan; bagi sesuai isi yang kembali bila hanya sebagian yang dimuat.
        const totalLap = d.laporan.total;
        const bagianAset = d.laporan.items.length ? nAset / d.laporan.items.length : 0;
        peta.aset.total = d.laporan.items.length < d.laporan.total ? Math.max(nAset, Math.round(totalLap * bagianAset)) : nAset;
        peta.laporan.total = d.laporan.items.length < d.laporan.total ? Math.max(nLap, totalLap - peta.aset.total) : nLap;
        peta.pica.total = d.pica.total;
        d.pica.items.forEach((x, i) => dorong('pica', {
          id: `p:${x.id}`, judul: x.problem || x.identifikasi || `PICA ${x.no}`,
          sub: `${labelSiteDariKey(x.site)}${x.no ? ` · No ${x.no}` : ''}${x.status ? ` · ${x.status}` : ''}${x.pic ? ` · PIC ${x.pic}` : ''}${x.latestNote ? ` · ${x.latestNote}` : ''}`,
          badge: x.status || 'PICA', skor: 500 - i, buka: () => onBukaLaporan('PICA', { site: x.site }),
        }));
      }
    }
    const ringkas = (Object.keys(peta) as Kategori[]).reduce((a, k) => ({ ...a, [k]: peta[k].total }), {} as Record<Kategori, number>);
    return {
      kelompok: URUTAN.map((kat) => ({ kat, ...peta[kat] })).filter((g) => g.hasil.length > 0),
      jumlah: ringkas,
    };
  }, [kueri, tokens, halaman, users, isSA, srv.data, onBuka, onNavigasi, onBukaLaporan, onBukaAset]);

  // Daftar datar sesuai kategori terpilih & batas tampil → dasar navigasi keyboard.
  const tampil = useMemo(() => {
    const batas = (kat: Kategori) => (scope !== 'ALL' || terbuka.has(kat) ? Infinity : kat === 'halaman' ? 4 : 5);
    return kelompok
      .filter((g) => scope === 'ALL' || g.kat === scope)
      .map((g) => ({ ...g, terlihat: g.hasil.slice(0, batas(g.kat)) }));
  }, [kelompok, scope, terbuka]);
  const datar = useMemo(() => tampil.flatMap((g) => g.terlihat), [tampil]);
  const totalSemua = (Object.values(jumlah) as number[]).reduce((a, b) => a + b, 0);

  useEffect(() => { setAktif(0); }, [term, scope, srv.data]);
  useEffect(() => {
    if (!kueri) return;
    document.getElementById(`${idUnik}-o${aktif}`)?.scrollIntoView({ block: 'nearest' });
  }, [aktif, kueri, idUnik]);

  const bukaHasil = (h: Hasil) => {
    simpanRiwayat(term);
    h.buka();
    onTutup?.();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && datar.length) { e.preventDefault(); setAktif((i) => (i + 1) % datar.length); }
    else if (e.key === 'ArrowUp' && datar.length) { e.preventDefault(); setAktif((i) => (i - 1 + datar.length) % datar.length); }
    else if (e.key === 'Enter' && datar[aktif]) { e.preventDefault(); bukaHasil(datar[aktif]); }
    else if (e.key === 'Escape') {
      if (q) { e.preventDefault(); e.stopPropagation(); setQ(''); setScope('ALL'); }
      else if (palette) onTutup?.();
    }
  };

  const ubahInput = (raw: string) => {
    // Pemindai barcode (keyboard-wedge) atau tempel URL QR → ambil kodenya saja.
    setQ(/^https?:\/\//i.test(raw.trim()) ? ekstrakKode(raw) : raw);
    if (scope !== 'ALL') setScope('ALL');
  };
  const pakai = (kata: string) => { setQ(kata); setScope('ALL'); inputRef.current?.focus(); };

  const chipScope: { id: 'ALL' | Kategori; label: string; n: number }[] = [
    { id: 'ALL', label: 'Semua', n: totalSemua },
    ...URUTAN.filter((k) => jumlah[k] > 0).map((k) => ({ id: k as 'ALL' | Kategori, label: META[k].label, n: jumlah[k] })),
  ];
  const serverHasil = !!srv.data;
  const tidakAda = kueri && !srv.memuat && datar.length === 0 && (serverHasil || !!srv.galat);
  const kosongAwal = !kueri;

  const kotak = (
    <div className="gs-box glass-panel" style={palette ? undefined : { borderRadius: 16 }}>
      <div className="gs-field">
        <Search size={18} className="gs-lead" aria-hidden="true" />
        <input
          ref={inputRef}
          className="gs-input"
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          value={q}
          onChange={(e) => ubahInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Cari kode, nama barang, PIC, site, PICA, halaman…"
          role="combobox"
          aria-expanded={kueri && datar.length > 0}
          aria-controls={`${idUnik}-list`}
          aria-activedescendant={kueri && datar.length ? `${idUnik}-o${aktif}` : undefined}
          aria-label="Global Search"
        />
        {srv.memuat && <Loader2 size={16} className="gs-spin" aria-label="Mencari" />}
        {q && <button type="button" className="gs-clear" onClick={() => { setQ(''); setScope('ALL'); inputRef.current?.focus(); }} aria-label="Hapus pencarian"><X size={16} /></button>}
      </div>
      <button type="button" className="gs-scan" onClick={() => setScanBuka(true)} aria-label="Scan barcode atau QR">
        <ScanLine size={18} /><span>Scan</span>
      </button>
      {palette && <button type="button" className="gs-pal-x" onClick={onTutup} aria-label="Tutup pencarian (Esc)"><X size={18} /></button>}
    </div>
  );

  const isi = (
    <>
      {kueri && !tidakAda && chipScope.length > 2 && (
        <div className="gs-chips" role="tablist" aria-label="Saring hasil menurut kategori">
          {chipScope.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={scope === c.id} className={`gs-chip${scope === c.id ? ' is-on' : ''}`} onClick={() => setScope(c.id)}>
              {c.label}<em>{c.n}</em>
            </button>
          ))}
        </div>
      )}

      {srv.galat && kueri && (
        <div className="gs-warn" role="alert">
          <AlertTriangle size={15} />
          <span>Data laporan tidak bisa dicari sekarang ({srv.galat}). Hasil halaman, site, dan pengguna tetap tampil.</span>
          <button type="button" onClick={() => setVersi((v) => v + 1)}><RefreshCw size={12} /> Coba lagi</button>
        </div>
      )}

      {kosongAwal && (
        <>
          {riwayat.length > 0 && (
            <>
              <div className="gs-sec-h"><span>Terakhir dicari</span><button type="button" onClick={hapusRiwayat}><Trash2 size={12} /> Hapus</button></div>
              <div className="gs-recents">
                {riwayat.map((r) => <button key={r} type="button" className="gs-chip" onClick={() => pakai(r)}><History size={13} />{r}</button>)}
              </div>
            </>
          )}
          <div className="gs-sec-h"><span>Pintasan halaman</span></div>
          <div className="gs-grid">
            {halaman.map((h) => {
              const Ikon = h.ikon;
              return (
                <button key={`${h.grup}-${h.judul}`} type="button" className="gs-card" onClick={() => { h.buka(); onTutup?.(); }}>
                  <span className="gs-ico" style={{ background: `${h.warna}26`, color: h.warna }}><Ikon size={18} /></span>
                  <span style={{ minWidth: 0 }}><b>{h.judul}</b><span className="s">{h.grup}</span></span>
                </button>
              );
            })}
          </div>
          <div className="gs-sec-h"><span>Coba cari</span></div>
          <div className="gs-recents">
            {['I-RDA', 'I-RCE', 'seal', 'filter', 'compressor', 'oli', ...getSites().slice(0, 3).map((s) => labelSiteDariKey(s.key))].map((s) => (
              <button key={s} type="button" className="gs-chip" onClick={() => pakai(s)}><Search size={13} />{s}</button>
            ))}
          </div>
        </>
      )}

      {kueri && !kosongAwal && term.length >= 2 && (
        <div id={`${idUnik}-list`} className="gs-list" role="listbox" aria-label="Hasil pencarian">
          {(() => {
            let i = -1;
            return tampil.map((g) => {
              const meta = META[g.kat];
              const sisaLokal = g.hasil.length - g.terlihat.length;
              const sisaServer = DARI_SERVER.includes(g.kat) ? Math.max(0, g.total - g.hasil.length) : 0;
              return (
                <section key={g.kat} aria-label={meta.label}>
                  <div className="gs-group-h"><meta.ikon size={13} />{meta.label}<b>{g.total}</b></div>
                  <div className="gs-opts">
                    {g.terlihat.map((h) => {
                      i++;
                      const idx = i;
                      const Ikon = h.ikon;
                      return (
                        <button key={h.id} id={`${idUnik}-o${idx}`} type="button" role="option" aria-selected={aktif === idx}
                          className={`gs-opt${aktif === idx ? ' is-active' : ''}`} onMouseMove={() => aktif !== idx && setAktif(idx)} onClick={() => bukaHasil(h)}>
                          <span className="gs-ico" style={{ background: `${h.warna}26`, color: h.warna }}><Ikon size={17} /></span>
                          <span className="gs-main">
                            <span className="gs-t" style={{ display: '-webkit-box' }}><Sorot teks={h.judul} tokens={tokens} /></span>
                            <span className="gs-s" style={{ display: '-webkit-box' }}><Sorot teks={h.sub} tokens={tokens} /></span>
                          </span>
                          <span className="gs-badge" style={{ color: h.warna, background: `${h.warna}1F` }}>{h.badge}</span>
                          <ChevronRight size={16} className="gs-go" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                  {sisaLokal > 0 && (
                    <button type="button" className="gs-more" onClick={() => setTerbuka((p) => new Set(p).add(g.kat))}>Lihat {sisaLokal} lagi</button>
                  )}
                  {sisaLokal === 0 && sisaServer > 0 && (
                    scope === 'ALL'
                      ? <button type="button" className="gs-more" onClick={() => setScope(g.kat)}>Lihat lebih banyak di {meta.label} ({sisaServer} lagi)</button>
                      : <div className="gs-note">Menampilkan {g.hasil.length} dari {g.total} — persempit kata kunci untuk hasil yang lebih tepat.</div>
                  )}
                </section>
              );
            });
          })()}
        </div>
      )}

      {kueri && srv.memuat && datar.length === 0 && (
        <div className="gs-state glass-panel" role="status"><Loader2 size={26} className="gs-spin" style={{ position: 'static', margin: '0 auto .6rem', display: 'block' }} /><p>Mencari “{term}”…</p></div>
      )}

      {tidakAda && (
        <div className="gs-state glass-panel" role="status">
          <Search size={30} />
          <h4>Tidak ada hasil untuk “{term}”</h4>
          <p>Coba kata yang lebih pendek, kode barang (mis. <b>I-RDA</b>), nama PIC, atau nama site. Pencarian tidak membedakan huruf besar/kecil.</p>
          <button type="button" className="btn-chip" style={{ marginTop: '.9rem' }} onClick={() => { setQ(''); inputRef.current?.focus(); }}><X size={13} /> Hapus pencarian</button>
        </div>
      )}

      {term.length === 1 && <div className="gs-note">Ketik minimal 2 karakter untuk mencari.</div>}

      <div className="gs-foot" aria-hidden="true">
        <span className="gs-kbdhint"><kbd><ArrowUp size={10} /></kbd> <kbd><ArrowDown size={10} /></kbd> pilih</span>
        <span className="gs-kbdhint"><kbd><CornerDownLeft size={10} /></kbd> buka</span>
        <span className="gs-kbdhint"><kbd>Esc</kbd> {q ? 'hapus' : palette ? 'tutup' : ''}</span>
        {!palette && <span className="gs-kbdhint"><kbd>Ctrl</kbd>+<kbd>K</kbd> buka dari mana saja</span>}
      </div>
    </>
  );

  const scanModal = (
    <BarcodeScannerModal
      isOpen={scanBuka}
      onClose={() => setScanBuka(false)}
      onScan={(kode) => { setScanBuka(false); pakai(ekstrakKode(kode)); }}
    />
  );

  if (palette) {
    return (
      <>
        <div className="gs-pal-top">{kotak}</div>
        <div className="gs-pal-body">{isi}</div>
        {scanModal}
      </>
    );
  }
  return <div className="gs">{kotak}{isi}{scanModal}</div>;
};

// ── Halaman penuh ─────────────────────────────────────────────────────────
export const GlobalSearchView: React.FC<GlobalSearchProps> = (props) => (
  <div>
    <style>{GS_CSS}</style>
    <PageHeader icon={Search} title="Global Search" sub="Cari spare part, barang masuk/keluar, aset, PICA, site, dan halaman — dalam satu tempat" />
    <PanelCari {...props} />
  </div>
);

// ── Jendela cepat (Ctrl/⌘+K) ──────────────────────────────────────────────
export const GlobalSearchPalette: React.FC<GlobalSearchProps & { isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose, ...props }) => {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);
  if (!isOpen) return null;
  return createPortal(
    <div className="gs-pal-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{GS_CSS}</style>
      <div className="glass-panel gs-pal gs" role="dialog" aria-modal="true" aria-label="Global Search">
        <PanelCari {...props} palette onTutup={onClose} />
      </div>
    </div>,
    document.body
  );
};