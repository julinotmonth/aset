import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  UserCog, Plus, Users, ShieldCheck, MapPin, Wrench, Search, X, Mail, Briefcase, Pencil, Trash2,
  Eye, EyeOff, Copy, Check, KeyRound, LayoutGrid, Table2, AlertTriangle, RefreshCw, ClipboardCopy, Loader2,
} from 'lucide-react';
import type { AppUser, UserCredentials, UserRole } from '../../types';
import { api } from '../../lib/api';
import { salinTeks } from '../../lib/password';
import { getSites, useSitesRefresh } from '../../data/siteStore';
import { PageHeader } from './AdminExtraViews';
import { labelSiteDariKey } from './siteLabel';
import { UserFormModal } from './UserFormModal';
import './formModal.css';

type DataAkun = Partial<AppUser> & { password?: string };

interface Props {
  users: AppUser[];
  currentUserId?: string;
  /** Mengembalikan true bila berhasil — form tetap terbuka (isian aman) bila gagal. */
  onAddUser: (data: DataAkun) => Promise<boolean>;
  onUpdateUser: (id: string, data: DataAkun) => Promise<boolean>;
  onDeleteUser: (id: string) => Promise<boolean>;
}

const ROLE_BADGE: Record<UserRole, { color: string; bg: string }> = {
  'Super Admin': { color: '#FBBF24', bg: 'rgba(251,191,36,0.14)' },
  'Site Manager': { color: '#60A5FA', bg: 'rgba(96,165,250,0.14)' },
  'Maintenance Engineer': { color: '#A78BFA', bg: 'rgba(167,139,250,0.14)' },
};
const URUT_ROLE: Record<UserRole, number> = { 'Super Admin': 0, 'Site Manager': 1, 'Maintenance Engineer': 2 };
const PALET = ['#00D084', '#60A5FA', '#FBBF24', '#F472B6', '#A78BFA', '#38BDF8', '#34D399', '#F87171'];
const warnaAvatar = (nama: string) => {
  let h = 0;
  for (const c of nama) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALET[h % PALET.length];
};
const inisial = (nama: string) => nama.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const VIEW_KEY = 'reethau_users_view';
const TITIK = '••••••••••';

const KP_CSS = `
.kp-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.85rem;margin-bottom:1.25rem}
.kp-stat{display:flex;flex-direction:column;gap:.55rem;text-align:left;padding:1rem 1.1rem;border-radius:16px;cursor:pointer;font:inherit;color:inherit;transition:transform .15s,border-color .15s,box-shadow .15s}
.kp-stat:hover{transform:translateY(-2px)}
.kp-stat:focus-visible{outline:2px solid var(--ce-green);outline-offset:2px}
.kp-stat.is-on{border-color:var(--ce-green);box-shadow:0 0 0 3px rgba(0,208,132,.16)}
.kp-stat-top{display:flex;align-items:center;gap:.6rem;min-width:0}
.kp-stat-ico{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.kp-stat-lbl{font-size:.7rem;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:var(--txt-muted);overflow-wrap:anywhere;line-height:1.25}
.kp-stat-val{font-size:1.45rem;font-weight:800;color:var(--txt-primary);line-height:1}
.kp-note{border-radius:16px;padding:.95rem 1.15rem;margin-bottom:1.25rem;font-size:.8rem;color:var(--txt-secondary);line-height:1.65}
.kp-note-title{font-weight:800;color:var(--txt-primary);margin-bottom:.3rem;display:flex;align-items:center;gap:.4rem}
.kp-note b{color:var(--txt-primary)}
.kp-vault{display:flex;align-items:flex-start;gap:.6rem;margin-top:.55rem;padding-top:.55rem;border-top:1px dashed var(--border-subtle);color:var(--txt-tertiary)}
.kp-vault svg{flex-shrink:0;margin-top:.15rem;color:#FBBF24}

.kp-toolbar{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;margin-bottom:1rem}
.kp-search{position:relative;flex:1 1 240px;max-width:380px;min-width:0}
.kp-search svg{position:absolute;left:.8rem;top:50%;transform:translateY(-50%);color:var(--txt-muted);pointer-events:none}
.kp-ctl{min-height:42px;padding:.55rem .8rem;border-radius:10px;font:inherit;font-size:.86rem;background:var(--bg-root);color:var(--txt-primary);border:1px solid var(--border-subtle);outline:none;min-width:0;transition:border-color .15s,box-shadow .15s}
.kp-ctl:hover{border-color:var(--border-primary)}
.kp-ctl:focus{border-color:var(--ce-green);box-shadow:0 0 0 3px rgba(0,208,132,.16)}
.kp-search .kp-ctl{width:100%;padding-left:2.4rem}
select.kp-ctl{cursor:pointer;flex:0 1 190px}
select.kp-ctl option{background:var(--bg-surface);color:var(--txt-primary)}
.kp-seg{display:inline-flex;padding:3px;border-radius:11px;background:var(--bg-root);border:1px solid var(--border-subtle);flex-shrink:0}
.kp-seg button{display:inline-flex;align-items:center;gap:.4rem;min-height:36px;padding:.35rem .8rem;border:none;border-radius:8px;background:transparent;color:var(--txt-tertiary);font:inherit;font-size:.8rem;font-weight:700;cursor:pointer}
.kp-seg button.is-on{background:rgba(0,208,132,.14);color:var(--ce-green)}
.kp-seg button:focus-visible{outline:2px solid var(--ce-green);outline-offset:1px}
.kp-count{margin-left:auto;font-size:.76rem;color:var(--txt-muted);white-space:nowrap}
.kp-toggle-all{display:inline-flex;align-items:center;gap:.4rem}

.kp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(310px,100%),1fr));gap:1rem;align-items:stretch}
.kp-card{display:flex;flex-direction:column;gap:.85rem;padding:1.1rem;border-radius:16px;min-width:0;position:relative;animation:kp-in .25s ease both}
@keyframes kp-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.kp-card-head{display:flex;align-items:center;gap:.8rem;min-width:0}
.kp-av{width:48px;height:48px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1rem;object-fit:cover}
.kp-name{display:flex;align-items:center;gap:.4rem;min-width:0;color:var(--txt-primary);font-weight:700;font-size:.95rem}
.kp-name span.kp-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.kp-you{font-size:.62rem;font-weight:800;color:#00D084;background:rgba(0,208,132,.14);padding:.1rem .45rem;border-radius:999px;flex-shrink:0}
.kp-badge{display:inline-flex;align-items:center;gap:.3rem;margin-top:.3rem;font-size:.7rem;font-weight:700;padding:.15rem .55rem;border-radius:999px;max-width:100%}
.kp-rows{display:flex;flex-direction:column;gap:.5rem;min-width:0}
.kp-row{display:flex;align-items:flex-start;gap:.55rem;font-size:.8rem;color:var(--txt-secondary);min-width:0}
.kp-row>svg{flex-shrink:0;margin-top:.2rem;color:var(--txt-muted)}
.kp-row-v{min-width:0;flex:1;overflow-wrap:anywhere}
.kp-row-l{display:block;font-size:.64rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--txt-muted);margin-bottom:.1rem}
.kp-warn{display:inline-flex;align-items:center;gap:.25rem;margin-left:.4rem;color:#F87171;font-weight:700;font-size:.72rem}
.kp-actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:auto;padding-top:.85rem;border-top:1px solid var(--border-subtle)}
.kp-actions .btn-chip{flex:1 1 auto;justify-content:center;font-size:.76rem;padding:.5rem .7rem;min-height:38px}

.kp-pw{display:flex;align-items:center;gap:.3rem;min-width:0;flex-wrap:wrap}
.kp-pw code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.82rem;font-weight:600;color:var(--txt-primary);background:var(--bg-root);border:1px solid var(--border-subtle);padding:.25rem .55rem;border-radius:8px;overflow-wrap:anywhere;word-break:break-all;max-width:100%;user-select:all}
.kp-pw code.is-hidden{letter-spacing:.12em;color:var(--txt-tertiary);user-select:none}
.kp-ib{width:32px;height:32px;border-radius:8px;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;background:var(--chip-bg);color:var(--txt-tertiary);flex-shrink:0;transition:background .15s,color .15s}
.kp-ib:hover{background:var(--chip-border);color:var(--txt-primary)}
.kp-ib:focus-visible{outline:2px solid var(--ce-green);outline-offset:1px}
.kp-none{display:inline-flex;align-items:center;gap:.4rem;flex-wrap:wrap;font-size:.76rem;color:#FBBF24;font-weight:600}
.kp-none button{font:inherit;font-size:.74rem;font-weight:700;color:var(--ce-green);background:none;border:none;padding:.15rem .3rem;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.kp-skel{display:inline-block;width:110px;height:26px;border-radius:8px;background:linear-gradient(90deg,var(--chip-bg),var(--chip-border),var(--chip-bg));background-size:200% 100%;animation:kp-sh 1.2s linear infinite}
@keyframes kp-sh{to{background-position:-200% 0}}

.kp-table .simple-table{min-width:880px}
.kp-table td.kp-td-user{min-width:230px}
.kp-user{display:flex;align-items:center;gap:.7rem;min-width:0}
.kp-user .kp-av{width:40px;height:40px;font-size:.88rem}
.kp-sub{font-size:.74rem;color:var(--txt-muted);margin-top:.1rem}
.kp-acts{display:flex;gap:.4rem;flex-wrap:wrap}
.kp-acts .btn-chip{font-size:.74rem;padding:.4rem .65rem}

.kp-empty{grid-column:1/-1;text-align:center;padding:2.5rem 1rem;border-radius:16px;color:var(--txt-muted)}
.kp-empty svg{margin-bottom:.5rem;opacity:.6}

.kp-toast{position:fixed;left:50%;bottom:calc(1.25rem + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:130;display:flex;align-items:center;gap:.5rem;padding:.65rem 1rem;border-radius:12px;font-size:.84rem;font-weight:600;color:var(--txt-primary);background:var(--bg-surface);border:1px solid var(--border-primary);box-shadow:0 10px 30px rgba(0,0,0,.35);animation:kp-in .2s ease both;max-width:calc(100vw - 2rem)}

.kp-del-who{display:flex;align-items:center;gap:.75rem;padding:.8rem;border-radius:12px;background:var(--bg-root);border:1px solid var(--border-subtle);margin-bottom:1rem;min-width:0}
.kp-del-msg{font-size:.86rem;line-height:1.55;color:var(--txt-secondary)}
.kp-del-block{display:flex;gap:.6rem;align-items:flex-start;padding:.75rem .85rem;border-radius:10px;font-size:.82rem;line-height:1.5;color:#FBBF24;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3)}
.kp-del-block svg{flex-shrink:0;margin-top:.15rem}
.kp-danger{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:44px;padding:.65rem 1.1rem;border-radius:12px;border:none;cursor:pointer;font:inherit;font-weight:700;font-size:.9rem;color:#fff;background:#DC2626}
.kp-danger:hover:not(:disabled){background:#B91C1C}
.kp-danger:disabled{opacity:.7;cursor:progress}
.kp-danger:focus-visible,.kp-ghost:focus-visible{outline:2px solid #F87171;outline-offset:2px}
.kp-ghost{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:.65rem 1.1rem;border-radius:12px;cursor:pointer;font:inherit;font-weight:700;font-size:.9rem;color:var(--txt-primary);background:var(--chip-bg);border:1px solid var(--chip-border)}

@media (max-width:1100px){.kp-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:760px){
  .kp-table .simple-table{min-width:0}
  .kp-table td.kp-td-user{min-width:0}
  .kp-table .kp-pw{justify-content:flex-end}
  .kp-acts{justify-content:stretch;width:100%}
  .kp-acts .btn-chip{flex:1 1 auto;justify-content:center;min-height:40px}
}
@media (max-width:560px){
  .kp-stats{gap:.6rem}
  .kp-stat{padding:.8rem .85rem}
  .kp-stat-val{font-size:1.25rem}
  .kp-search{max-width:none;flex-basis:100%}
  select.kp-ctl{flex:1 1 calc(50% - .3rem)}
  .kp-seg{width:100%}
  .kp-seg button{flex:1;justify-content:center}
  .kp-count{margin-left:0;width:100%}
  .kp-grid{grid-template-columns:1fr}
  .kp-ctl{font-size:16px}
}
@media (prefers-reduced-motion:reduce){.kp-card,.kp-toast{animation:none}.kp-stat,.kp-ctl{transition:none}.kp-skel{animation:none}}
`;

/** Sel password: titik-titik / teks asli + tombol lihat & salin, atau penanda "belum tersimpan". */
const SelPassword: React.FC<{
  user: AppUser;
  kred: UserCredentials | null;
  galat: string;
  terlihat: boolean;
  tersalin: boolean;
  onToggle: () => void;
  onSalin: () => void;
  onAtur: () => void;
}> = ({ user, kred, galat, terlihat, tersalin, onToggle, onSalin, onAtur }) => {
  if (galat) return <span className="kp-none"><AlertTriangle size={13} />Gagal memuat</span>;
  if (kred === null) return <span className="kp-skel" aria-label="Memuat password" />;
  const pw = kred[user.id];
  if (!pw) {
    return (
      <span className="kp-none" title="Akun ini dibuat sebelum fitur password ditampilkan. Password terisi otomatis setelah akun ini login, atau isi lewat Edit.">
        <KeyRound size={13} />Belum tersimpan
        <button type="button" onClick={onAtur}>Atur</button>
      </span>
    );
  }
  return (
    <span className="kp-pw">
      <code className={terlihat ? '' : 'is-hidden'} aria-label={terlihat ? `Password ${user.name}` : 'Password disembunyikan'}>{terlihat ? pw : TITIK}</code>
      <button type="button" className="kp-ib" onClick={onToggle} aria-label={terlihat ? 'Sembunyikan password' : 'Tampilkan password'} aria-pressed={terlihat} title={terlihat ? 'Sembunyikan' : 'Tampilkan'}>
        {terlihat ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
      <button type="button" className="kp-ib" onClick={onSalin} aria-label="Salin password" title="Salin password">
        {tersalin ? <Check size={15} color="#00D084" /> : <Copy size={15} />}
      </button>
    </span>
  );
};

export const UserManagementView: React.FC<Props> = ({ users, currentUserId, onAddUser, onUpdateUser, onDeleteUser }) => {
  useSitesRefresh();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [hapusTarget, setHapusTarget] = useState<AppUser | null>(null);
  const [menghapus, setMenghapus] = useState(false);

  // ── Password semua akun (khusus Super Admin, dari /users/credentials) ──
  const [kred, setKred] = useState<UserCredentials | null>(null);
  const [kredGalat, setKredGalat] = useState('');
  const muatKredensial = useCallback(async () => {
    try {
      setKred(await api.get<UserCredentials>('/users/credentials'));
      setKredGalat('');
    } catch (err) {
      setKredGalat(err instanceof Error ? err.message : 'Gagal memuat password.');
    }
  }, []);
  useEffect(() => { void muatKredensial(); }, [muatKredensial]);

  // ── Tampil/sembunyi password: semua sekaligus, atau per akun (XOR terhadap "semua") ──
  const [semuaTerlihat, setSemuaTerlihat] = useState(false);
  const [dibalik, setDibalik] = useState<Set<string>>(new Set());
  const terlihat = (id: string) => semuaTerlihat !== dibalik.has(id);
  const balik = (id: string) => setDibalik((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSemua = () => { setSemuaTerlihat((v) => !v); setDibalik(new Set()); };
  // Sembunyikan lagi semua password begitu tab ditinggalkan (layar kosong / ganti tab).
  useEffect(() => {
    const onVis = () => { if (document.hidden) { setSemuaTerlihat(false); setDibalik(new Set()); } };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ── Umpan balik salin ──
  const [info, setInfo] = useState('');
  const [tersalinKey, setTersalinKey] = useState('');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const salin = async (teks: string, key: string, pesan: string) => {
    const ok = await salinTeks(teks);
    setInfo(ok ? pesan : 'Gagal menyalin — salin manual dari kolom password.');
    if (ok) setTersalinKey(key);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { setInfo(''); setTersalinKey(''); }, 2000);
  };
  const salinAkun = (u: AppUser) => {
    const pw = kred?.[u.id];
    const teks = `Akun Reethau Inventory\nEmail: ${u.email}\nPassword: ${pw ?? '(belum tersimpan)'}`;
    return salin(teks, `akun:${u.id}`, pw ? `Email & password ${u.name} disalin` : `Email ${u.name} disalin (password belum tersimpan)`);
  };

  // ── Tampilan, pencarian, filter, urutan ──
  const [mode, setMode] = useState<'kartu' | 'tabel'>(() => (localStorage.getItem(VIEW_KEY) === 'tabel' ? 'tabel' : 'kartu'));
  const gantiMode = (m: 'kartu' | 'tabel') => { setMode(m); try { localStorage.setItem(VIEW_KEY, m); } catch { /* abaikan */ } };
  const [cari, setCari] = useState('');
  const [filterRole, setFilterRole] = useState<'ALL' | UserRole>('ALL');
  const [filterSite, setFilterSite] = useState('ALL');
  const [urut, setUrut] = useState<'peran' | 'nama' | 'terbaru'>('peran');

  const adaFilter = !!cari || filterRole !== 'ALL' || filterSite !== 'ALL';
  const kunciSiteAda = new Set(getSites().map((s) => s.key));
  const siteDipakai = useMemo(() => [...new Set(users.map((u) => u.assignedSite))].sort(), [users]);
  const labelAkses = (site: string) => (site === 'global' ? 'Semua Site' : labelSiteDariKey(site));
  const hitung = (r: UserRole) => users.filter((u) => u.role === r).length;
  const superAdminCount = hitung('Super Admin');

  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const lolos = users.filter((u) =>
      (filterRole === 'ALL' || u.role === filterRole) && (filterSite === 'ALL' || u.assignedSite === filterSite)
      && (!q || [u.name, u.email, u.position, u.role].some((t) => (t || '').toLowerCase().includes(q))));
    const nama = (a: AppUser, b: AppUser) => a.name.localeCompare(b.name, 'id');
    return lolos.sort(urut === 'nama' ? nama
      : urut === 'terbaru' ? (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || nama(a, b)
      : (a, b) => URUT_ROLE[a.role] - URUT_ROLE[b.role] || nama(a, b));
  }, [users, cari, filterRole, filterSite, urut]);

  const stats: { key: 'ALL' | UserRole; label: string; icon: React.ElementType; color: string; bg: string; nilai: number }[] = [
    { key: 'ALL', label: 'Total Akun', icon: Users, color: '#00D084', bg: 'rgba(0,208,132,0.15)', nilai: users.length },
    { key: 'Super Admin', label: 'Super Admin', icon: ShieldCheck, color: '#FBBF24', bg: 'rgba(251,191,36,0.15)', nilai: superAdminCount },
    { key: 'Site Manager', label: 'Site Manager', icon: MapPin, color: '#60A5FA', bg: 'rgba(96,165,250,0.15)', nilai: hitung('Site Manager') },
    { key: 'Maintenance Engineer', label: 'Maintenance Engineer', icon: Wrench, color: '#A78BFA', bg: 'rgba(167,139,250,0.15)', nilai: hitung('Maintenance Engineer') },
  ];

  // ── Aksi ──
  const bukaTambah = () => { setEditingUser(null); setIsFormOpen(true); };
  const bukaEdit = (u: AppUser) => { setEditingUser(u); setIsFormOpen(true); };
  const simpan = async (data: DataAkun) => {
    setMenyimpan(true);
    try {
      const ok = editingUser ? await onUpdateUser(editingUser.id, data) : await onAddUser(data);
      if (ok) { setIsFormOpen(false); await muatKredensial(); }
    } finally {
      setMenyimpan(false);
    }
  };
  const alasanBlokir = (u: AppUser) =>
    u.id === currentUserId ? 'Anda tidak bisa menghapus akun yang sedang Anda pakai.'
    : u.role === 'Super Admin' && superAdminCount <= 1 ? 'Ini Super Admin terakhir. Tambahkan Super Admin lain dulu sebelum menghapusnya.'
    : '';
  const konfirmasiHapus = async () => {
    if (!hapusTarget) return;
    setMenghapus(true);
    try {
      const ok = await onDeleteUser(hapusTarget.id);
      if (ok) { setHapusTarget(null); await muatKredensial(); }
    } finally {
      setMenghapus(false);
    }
  };
  useEffect(() => {
    if (!hapusTarget) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !menghapus) setHapusTarget(null); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [hapusTarget, menghapus]);

  const avatar = (u: AppUser) => u.avatarUrl
    ? <img src={u.avatarUrl} alt={u.name} className="kp-av" />
    : <div className="kp-av" style={{ background: `${warnaAvatar(u.name)}26`, color: warnaAvatar(u.name) }} aria-hidden="true">{inisial(u.name)}</div>;
  const badgePeran = (u: AppUser) => (
    <span className="kp-badge" style={{ color: ROLE_BADGE[u.role].color, background: ROLE_BADGE[u.role].bg }}>
      <ShieldCheck size={11} />{u.role}
    </span>
  );
  const sitePeringatan = (u: AppUser) => u.assignedSite !== 'global' && !kunciSiteAda.has(u.assignedSite) && (
    <span className="kp-warn" title="Site ini sudah tidak ada di daftar Site Operasional — ubah akses akun ini">
      <AlertTriangle size={12} /> site tidak ditemukan
    </span>
  );
  const sel = (u: AppUser) => (
    <SelPassword
      user={u} kred={kred} galat={kredGalat} terlihat={terlihat(u.id)} tersalin={tersalinKey === `pw:${u.id}`}
      onToggle={() => balik(u.id)}
      onSalin={() => { const pw = kred?.[u.id]; if (pw) void salin(pw, `pw:${u.id}`, `Password ${u.name} disalin`); }}
      onAtur={() => bukaEdit(u)}
    />
  );
  const tombolAksi = (u: AppUser) => (
    <>
      <button type="button" className="btn-chip" onClick={() => bukaEdit(u)}><Pencil size={13} /> Edit</button>
      <button type="button" className="btn-chip" onClick={() => void salinAkun(u)} title="Salin email dan password" aria-label={`Salin email dan password ${u.name}`}>
        {tersalinKey === `akun:${u.id}` ? <Check size={13} color="#00D084" /> : <ClipboardCopy size={13} />} Salin akun
      </button>
      <button type="button" className="btn-chip danger" onClick={() => setHapusTarget(u)}><Trash2 size={13} /> Hapus</button>
    </>
  );

  return (
    <div>
      <style>{KP_CSS}</style>

      <div className="view-toolbar-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <PageHeader icon={UserCog} title="Kelola Pengguna" sub="Atur siapa saja yang bisa mengakses Admin Portal, level aksesnya, dan password masing-masing akun" />
        <button type="button" className="btn-primary view-toolbar-btn" onClick={bukaTambah} style={{ marginBottom: '1.5rem' }}>
          <Plus size={18} />
          Tambah Pengguna
        </button>
      </div>

      <div className="kp-stats" role="group" aria-label="Ringkasan akun — klik untuk menyaring">
        {stats.map((s) => {
          const Icon = s.icon;
          const aktif = filterRole === s.key;
          return (
            <button key={s.key} type="button" className={`glass-panel kp-stat${aktif && s.key !== 'ALL' ? ' is-on' : ''}`}
              aria-pressed={s.key === 'ALL' ? filterRole === 'ALL' : aktif}
              title={s.key === 'ALL' ? 'Tampilkan semua akun' : `Tampilkan hanya ${s.label}`}
              onClick={() => setFilterRole(s.key === 'ALL' || aktif ? 'ALL' : s.key)}>
              <span className="kp-stat-top">
                <span className="kp-stat-ico" style={{ background: s.bg }}><Icon size={16} color={s.color} /></span>
                <span className="kp-stat-lbl">{s.label}</span>
              </span>
              <span className="kp-stat-val">{s.nilai}</span>
            </button>
          );
        })}
      </div>

      <div className="glass-panel kp-note">
        <div className="kp-note-title"><ShieldCheck size={14} /> Hak akses</div>
        <b>Super Admin</b> — melihat seluruh site dan satu-satunya yang bisa mengelola pengguna, site, dan sumber spreadsheet semua site.{' '}
        <b>Site Manager</b> dan <b>Maintenance Engineer</b> — hanya melihat data pada <b>site yang ditetapkan</b>; keduanya memiliki hak yang sama, perbedaannya hanya jabatan.
        <div className="kp-vault">
          <KeyRound size={14} />
          <span>Password tampil tersembunyi (••••) dan hanya terlihat oleh Super Admin. Klik ikon mata untuk melihat, atau salin langsung untuk dibagikan. Jangan bagikan layar ini ke orang lain.</span>
        </div>
      </div>

      <div className="kp-toolbar">
        <div className="kp-search">
          <Search size={15} aria-hidden="true" />
          <input className="kp-ctl" placeholder="Cari nama, email, atau jabatan…" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari pengguna" />
        </div>
        <select className="kp-ctl" value={filterRole} onChange={(e) => setFilterRole(e.target.value as 'ALL' | UserRole)} aria-label="Filter peran">
          <option value="ALL">Semua Peran</option>
          <option value="Super Admin">Super Admin</option>
          <option value="Site Manager">Site Manager</option>
          <option value="Maintenance Engineer">Maintenance Engineer</option>
        </select>
        <select className="kp-ctl" value={filterSite} onChange={(e) => setFilterSite(e.target.value)} aria-label="Filter akses site">
          <option value="ALL">Semua Akses Site</option>
          {siteDipakai.map((st) => <option key={st} value={st}>{labelAkses(st)}</option>)}
        </select>
        <select className="kp-ctl" value={urut} onChange={(e) => setUrut(e.target.value as 'peran' | 'nama' | 'terbaru')} aria-label="Urutkan">
          <option value="peran">Urut: Peran</option>
          <option value="nama">Urut: Nama A–Z</option>
          <option value="terbaru">Urut: Terbaru</option>
        </select>
        {adaFilter && (
          <button type="button" className="btn-chip" onClick={() => { setCari(''); setFilterRole('ALL'); setFilterSite('ALL'); }} style={{ fontSize: '0.76rem' }}>
            <X size={12} /> Reset
          </button>
        )}
      </div>

      <div className="kp-toolbar" style={{ marginTop: '-.25rem' }}>
        <div className="kp-seg" role="group" aria-label="Mode tampilan">
          <button type="button" className={mode === 'kartu' ? 'is-on' : ''} aria-pressed={mode === 'kartu'} onClick={() => gantiMode('kartu')}><LayoutGrid size={14} /> Kartu</button>
          <button type="button" className={mode === 'tabel' ? 'is-on' : ''} aria-pressed={mode === 'tabel'} onClick={() => gantiMode('tabel')}><Table2 size={14} /> Tabel akun</button>
        </div>
        <button type="button" className="btn-chip kp-toggle-all" onClick={toggleSemua} aria-pressed={semuaTerlihat} style={{ fontSize: '0.78rem' }}>
          {semuaTerlihat ? <EyeOff size={14} /> : <Eye size={14} />}
          {semuaTerlihat ? 'Sembunyikan semua password' : 'Tampilkan semua password'}
        </button>
        {kredGalat && (
          <button type="button" className="btn-chip" onClick={() => void muatKredensial()} style={{ fontSize: '0.78rem', color: '#F87171' }}>
            <RefreshCw size={13} /> Muat ulang password
          </button>
        )}
        <span className="kp-count" aria-live="polite">{daftar.length} dari {users.length} akun</span>
      </div>

      {daftar.length === 0 ? (
        <div className="glass-panel kp-empty">
          <Users size={30} />
          <div style={{ color: 'var(--txt-primary)', fontWeight: 700, marginBottom: '.25rem' }}>
            {users.length === 0 ? 'Belum ada akun.' : 'Tidak ada akun yang cocok'}
          </div>
          <div style={{ fontSize: '.84rem' }}>
            {users.length === 0 ? 'Klik “Tambah Pengguna” untuk membuat akun pertama.' : 'Ubah kata kunci atau reset filter untuk melihat semua akun.'}
          </div>
        </div>
      ) : mode === 'kartu' ? (
        <div className="kp-grid">
          {daftar.map((u) => (
            <article key={u.id} className="glass-panel kp-card" aria-label={`Akun ${u.name}`}>
              <div className="kp-card-head">
                {avatar(u)}
                <div style={{ minWidth: 0 }}>
                  <div className="kp-name">
                    <span className="kp-nm">{u.name}</span>
                    {u.id === currentUserId && <span className="kp-you">ANDA</span>}
                  </div>
                  {badgePeran(u)}
                </div>
              </div>
              <div className="kp-rows">
                <div className="kp-row"><Briefcase size={14} /><div className="kp-row-v"><span className="kp-row-l">Jabatan</span>{u.position || '—'}</div></div>
                <div className="kp-row">
                  <Mail size={14} />
                  <div className="kp-row-v"><span className="kp-row-l">Email</span>{u.email}</div>
                  <button type="button" className="kp-ib" onClick={() => void salin(u.email, `em:${u.id}`, `Email ${u.name} disalin`)} aria-label={`Salin email ${u.name}`} title="Salin email" style={{ marginTop: '.1rem' }}>
                    {tersalinKey === `em:${u.id}` ? <Check size={15} color="#00D084" /> : <Copy size={15} />}
                  </button>
                </div>
                <div className="kp-row"><MapPin size={14} /><div className="kp-row-v"><span className="kp-row-l">Akses site</span>{labelAkses(u.assignedSite)}{sitePeringatan(u)}</div></div>
                <div className="kp-row"><KeyRound size={14} /><div className="kp-row-v"><span className="kp-row-l">Password</span>{sel(u)}</div></div>
              </div>
              <div className="kp-actions">{tombolAksi(u)}</div>
            </article>
          ))}
        </div>
      ) : (
        <div className="glass-panel simple-table-wrap kp-table" style={{ borderRadius: 16 }}>
          <table className="simple-table">
            <thead>
              <tr><th>Pengguna</th><th>Email</th><th>Password</th><th>Peran</th><th>Akses site</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {daftar.map((u) => (
                <tr key={u.id}>
                  <td className="cell-lead kp-td-user">
                    <div className="kp-user">
                      {avatar(u)}
                      <div style={{ minWidth: 0 }}>
                        <div className="kp-name"><span className="kp-nm">{u.name}</span>{u.id === currentUserId && <span className="kp-you">ANDA</span>}</div>
                        <div className="kp-sub">{u.position || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Email" style={{ overflowWrap: 'anywhere' }}>{u.email}</td>
                  <td data-label="Password">{sel(u)}</td>
                  <td data-label="Peran">{badgePeran(u)}</td>
                  <td data-label="Akses site">{labelAkses(u.assignedSite)}{sitePeringatan(u)}</td>
                  <td className="cell-action"><div className="kp-acts">{tombolAksi(u)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {info && <div className="kp-toast" role="status"><Check size={15} color="#00D084" />{info}</div>}

      <UserFormModal
        isOpen={isFormOpen}
        mode="admin"
        userToEdit={editingUser}
        currentPassword={editingUser ? kred?.[editingUser.id] ?? null : null}
        isSaving={menyimpan}
        onClose={() => { if (!menyimpan) setIsFormOpen(false); }}
        onSave={(data) => void simpan(data)}
      />

      {hapusTarget && createPortal(
        <div className="fm-overlay" onClick={(e) => { if (e.target === e.currentTarget && !menghapus) setHapusTarget(null); }}>
          <div className="glass-panel fm-panel fm-sm" role="alertdialog" aria-modal="true" aria-labelledby="kp-del-title" aria-describedby="kp-del-desc" style={{ borderColor: 'rgba(248,113,113,.4)' }}>
            <div className="fm-head">
              <div className="fm-head-ico" style={{ background: 'rgba(248,113,113,.15)' }}><Trash2 size={22} color="#F87171" /></div>
              <div style={{ minWidth: 0 }}>
                <h3 className="fm-title" id="kp-del-title">Hapus akun?</h3>
                <div className="fm-sub">Tindakan ini tidak bisa dibatalkan</div>
              </div>
              <button type="button" className="fm-close" onClick={() => setHapusTarget(null)} disabled={menghapus} aria-label="Tutup"><X size={18} /></button>
            </div>
            <div className="fm-body">
              <div className="kp-del-who">
                {avatar(hapusTarget)}
                <div style={{ minWidth: 0 }}>
                  <div className="kp-name"><span className="kp-nm">{hapusTarget.name}</span></div>
                  <div className="kp-sub" style={{ overflowWrap: 'anywhere' }}>{hapusTarget.email}</div>
                </div>
              </div>
              {alasanBlokir(hapusTarget) ? (
                <div className="kp-del-block" id="kp-del-desc"><AlertTriangle size={16} />{alasanBlokir(hapusTarget)}</div>
              ) : (
                <p className="kp-del-msg" id="kp-del-desc">
                  <b>{hapusTarget.name}</b> tidak akan bisa login lagi dan akunnya dihapus permanen, termasuk password yang tersimpan.
                </p>
              )}
            </div>
            <div className="fm-foot">
              <button type="button" className="kp-ghost" onClick={() => setHapusTarget(null)} disabled={menghapus} autoFocus>
                {alasanBlokir(hapusTarget) ? 'Mengerti' : 'Batal'}
              </button>
              {!alasanBlokir(hapusTarget) && (
                <button type="button" className="kp-danger" onClick={() => void konfirmasiHapus()} disabled={menghapus} aria-busy={menghapus || undefined}>
                  {menghapus ? <Loader2 size={16} className="fm-spin" /> : <Trash2 size={16} />}
                  {menghapus ? 'Menghapus…' : 'Ya, hapus akun'}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};