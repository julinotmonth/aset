import React, { useEffect, useState } from 'react';
import { menuTerbuka, MENU_DISEMBUNYIKAN } from './menuAkses';
import {
  LayoutDashboard,
  Search,
  Package,
  Tags,
  ArrowLeftRight,
  Wrench,
  ClipboardList,
  MapPin,
  Layers,
  Users,
  Images,
  X,
  UserCog,
  Building2,
  CalendarClock,
  CalendarRange,
  BarChart3,
  TrendingUp,
  TrendingDown,
  FileText,
  PackageCheck,
  Target,
  Boxes,
  ChevronDown,
  PieChart,
  Gauge,
} from 'lucide-react';

export type AdminView =
  | 'dashboard'
  | 'global-search'
  | 'assets'
  | 'asset-registry'
  | 'work-orders'
  | 'reports'
  | 'weekly-report'
  | 'categories'
  | 'assignments'
  | 'maintenance'
  | 'audit'
  | 'branches'
  | 'product-lines'
  | 'team'
  | 'gallery'
  | 'users';

/** Mode isi halaman Laporan Mingguan (dipilih lewat sub-menu sidebar atau tab di halaman). */
export type LaporanMode = 'RINGKASAN_LAPORAN' | 'WORK_TARGET' | 'IN' | 'OUT' | 'OS_PR' | 'MIN_STOCK' | 'ASET' | 'PICA';

/** Tab di halaman Aset Tetap & Depresiasi (dipilih lewat sub-menu sidebar atau tab di halaman). */
export type AsetTab = 'RINGKASAN' | 'ASSET_MGMT';

type ItemSub = { id: string; label: string; icon: React.ElementType };
const SUB_DASHBOARD: ItemSub[] = [
  { id: 'WORK_TARGET', label: 'Work Target / KPI', icon: Target },
  { id: 'PICA', label: 'PICA', icon: ClipboardList },
];
const SUB_LAPORAN: ItemSub[] = [
  { id: 'RINGKASAN_LAPORAN', label: 'Ringkasan Laporan', icon: Gauge },
  { id: 'IN', label: 'Barang Masuk', icon: TrendingUp },
  { id: 'OUT', label: 'Barang Keluar', icon: TrendingDown },
  { id: 'OS_PR', label: 'Outstanding PR', icon: FileText },
  { id: 'MIN_STOCK', label: 'Pencapaian Safety Stock', icon: PackageCheck },
];
const SUB_ASET: ItemSub[] = [
  { id: 'RINGKASAN', label: 'Ringkasan Aset', icon: PieChart },
  { id: 'ASSET_MGMT', label: 'Asset Management', icon: Boxes },
];

/**
 * Satu grup sub-menu di bawah sebuah induk. `view` = halaman yang merender isinya,
 * `awal` = sub yang dibuka saat induk diklik dari luar grup, `aktifId` = sub yang
 * sedang tampil. Induk yang masih terkunci (Dashboard) tetap terkunci, tetapi
 * sub-menu di bawahnya sudah bisa dibuka dan induknya bisa dilipat.
 */
interface GrupSub {
  view: AdminView;
  awal: string;
  items: ItemSub[];
  aktifId: string | undefined;
  pilih: (id: string) => void;
}

interface SidebarProps {
  active: AdminView;
  onNavigate: (view: AdminView) => void;
  isOpen: boolean;
  onClose: () => void;
  showUserManagement?: boolean;
  galleryLabel?: string;
  /** Mode Laporan Mingguan yang sedang aktif (untuk menandai sub-menu). */
  laporanMode?: LaporanMode;
  onNavigateLaporan?: (mode: LaporanMode) => void;
  /** Tab Aset Tetap & Depresiasi yang sedang aktif. */
  asetTab?: AsetTab;
  onNavigateAset?: (tab: AsetTab) => void;
  /** Membuka jendela cepat Global Search (Ctrl/⌘+K) dari kolom cari di atas sidebar. */
  onOpenSearch?: () => void;
}

interface NavGroup { title: string; /** RGB aksen (untuk rgba) */ rgb: string; /** warna teks versi tema terang */ ink: string; items: { id: AdminView; label: string; icon: React.ElementType }[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview', rgb: '0,208,132', ink: '#047857',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'global-search', label: 'Global Search', icon: Search },
      { id: 'reports', label: 'Laporan', icon: BarChart3 },
      { id: 'weekly-report', label: 'Laporan', icon: CalendarRange },
    ],
  },
  {
    title: 'Inventory', rgb: '56,189,248', ink: '#0369A1',
    items: [
      { id: 'assets', label: 'Spare Part', icon: Package },
      { id: 'categories', label: 'Kategori', icon: Tags },
      { id: 'assignments', label: 'Transfer Antar Site', icon: ArrowLeftRight },
      { id: 'maintenance', label: 'Maintenance', icon: Wrench },
      { id: 'audit', label: 'Audit / Log', icon: ClipboardList },
    ],
  },
  {
    title: 'Aset Tetap (EAM)', rgb: '167,139,250', ink: '#6D28D9',
    items: [
      { id: 'asset-registry', label: 'Aset Tetap & Depresiasi', icon: Building2 },
      { id: 'work-orders', label: 'Jadwal Maintenance', icon: CalendarClock },
    ],
  },
  {
    title: 'Organisasi', rgb: '251,191,36', ink: '#B45309',
    items: [
      { id: 'branches', label: 'Site Operasional', icon: MapPin },
      { id: 'product-lines', label: 'Lini Produk', icon: Layers },
      { id: 'team', label: 'Tim Lapangan', icon: Users },
      { id: 'gallery', label: 'Galeri Aset Setu', icon: Images },
    ],
  },
];

const GROUP_KEY = 'reethau_sidebar_groups';
const bacaGrupTutup = (): Record<string, boolean> => {
  try {
    const v = JSON.parse(localStorage.getItem(GROUP_KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
};
const adalahMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

// Gaya sidebar ditaruh di sini agar fitur ini berdiri sendiri. Warna aksen tiap grup datang
// dari --acc (rgb) dan --acc-ink (versi gelap untuk tema terang) yang diset per grup.
const SIDEBAR_CSS = `
.admin-sidebar{scroll-behavior:smooth}
.sbx-top{position:sticky;top:-1.25rem;z-index:3;margin:-1.25rem -.9rem .35rem;padding:1.25rem .9rem .8rem;background:var(--bg-surface);border-bottom:1px solid var(--border-subtle)}
.sbx-top .admin-sidebar-brand{border-bottom:none;margin-bottom:.85rem;padding:0 .35rem}
.sbx-search{display:flex;align-items:center;gap:.6rem;width:100%;min-height:40px;padding:.45rem .65rem;border-radius:11px;cursor:pointer;font:inherit;font-size:.82rem;font-weight:500;text-align:left;color:var(--txt-muted);background:var(--bg-root);border:1px solid var(--border-subtle);transition:border-color .15s,box-shadow .15s,color .15s}
.sbx-search:hover{border-color:rgba(0,208,132,.5);color:var(--txt-secondary)}
.sbx-search:focus-visible{outline:2px solid #00D084;outline-offset:2px}
.sbx-search span.t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sbx-kbd{flex-shrink:0;font:inherit;font-size:.66rem;font-weight:700;letter-spacing:.02em;padding:.12rem .4rem;border-radius:6px;color:var(--txt-tertiary);background:var(--chip-bg);border:1px solid var(--chip-border)}

.sbx-group{margin:0 0 .35rem;--acc:0,208,132;--acc-ink:#047857}
.sbx-ghead{display:flex;align-items:center;gap:.5rem;width:100%;padding:.5rem .6rem .35rem;margin-top:.45rem;border:none;background:none;cursor:pointer;font:inherit;font-size:.66rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--txt-muted);text-align:left;border-radius:8px}
.sbx-ghead:hover{color:var(--txt-secondary)}
.sbx-ghead:focus-visible{outline:2px solid #00D084;outline-offset:-2px}
.sbx-gdot{width:6px;height:6px;border-radius:50%;flex-shrink:0;background:rgb(var(--acc));box-shadow:0 0 0 3px rgba(var(--acc),.18)}
.sbx-ghead .live{width:6px;height:6px;border-radius:50%;background:rgb(var(--acc));margin-left:.1rem}
.sbx-chev{margin-left:auto;flex-shrink:0;opacity:.65;transition:transform .2s ease}
.sbx-chev.is-closed{transform:rotate(-90deg)}
.sbx-gwrap{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .24s ease,opacity .2s ease}
.sbx-gwrap.is-open{grid-template-rows:1fr;opacity:1}
.sbx-gclip{overflow:hidden;min-height:0}

.sbx-link{position:relative;display:flex;align-items:center;gap:.65rem;width:100%;min-height:42px;padding:.3rem .55rem .3rem .45rem;margin:.1rem 0;border-radius:11px;border:none;background:transparent;color:var(--txt-secondary);font:inherit;font-size:.85rem;font-weight:600;text-align:left;cursor:pointer;transition:background .15s,color .15s}
.sbx-link:hover{background:var(--chip-bg);color:var(--txt-primary)}
.sbx-link:focus-visible,.sbx-sub:focus-visible{outline:2px solid #00D084;outline-offset:-2px}
.sbx-ico{width:30px;height:30px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:rgb(var(--acc));background:rgba(var(--acc),.13);transition:background .15s,color .15s,box-shadow .15s}
html[data-theme='light'] .sbx-ico{color:var(--acc-ink);background:rgba(var(--acc),.16)}
.sbx-label{flex:1;min-width:0;line-height:1.25;overflow-wrap:anywhere}
.sbx-link.is-locked{gap:.55rem}
.sbx-link.is-active{color:var(--txt-primary);background:linear-gradient(90deg,rgba(var(--acc),.18),rgba(var(--acc),.04))}
.sbx-link.is-active::before{content:"";position:absolute;left:-.45rem;top:9px;bottom:9px;width:3px;border-radius:0 3px 3px 0;background:rgb(var(--acc))}
.sbx-link.is-active .sbx-ico{color:#fff;background:linear-gradient(135deg,rgb(var(--acc)),rgba(var(--acc),.7));box-shadow:0 4px 12px rgba(var(--acc),.35)}
html[data-theme='light'] .sbx-link.is-active .sbx-ico{color:#fff;background:linear-gradient(135deg,var(--acc-ink),rgba(var(--acc),.9))}
.sbx-link.has-sub-active .sbx-label{color:var(--txt-primary)}
.sbx-link.has-sub-active.is-folded{background:rgba(var(--acc),.1)}
.sbx-link.is-locked{color:var(--txt-muted);cursor:not-allowed}
.sbx-link.is-locked .sbx-ico{filter:grayscale(.85);opacity:.6}
.sbx-link.is-locked:hover{background:transparent}
.sbx-soon{flex-shrink:0;font-size:.56rem;font-weight:800;letter-spacing:.03em;text-transform:uppercase;padding:.12rem .38rem;margin-left:.15rem;border-radius:999px;color:#FBBF24;background:rgba(251,191,36,.13);border:1px solid rgba(251,191,36,.3)}
html[data-theme='light'] .sbx-soon{color:#92400E;background:rgba(251,191,36,.22)}
.sbx-link .sbx-chev{margin-left:.25rem}
.sbx-link>.sbx-chev:first-of-type{margin-left:auto}

.sbx-subwrap{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .22s ease,opacity .18s ease}
.sbx-subwrap.is-open{grid-template-rows:1fr;opacity:1}
.sbx-subclip{overflow:hidden;min-height:0}
.sbx-sublist{margin:.1rem 0 .4rem 1.45rem;padding-left:.55rem;border-left:1.5px solid var(--border-subtle);display:flex;flex-direction:column;gap:.1rem}
.sbx-sub{position:relative;display:flex;align-items:flex-start;gap:.55rem;width:100%;min-height:36px;padding:.42rem .55rem;border-radius:9px;border:none;background:transparent;color:var(--txt-tertiary);font:inherit;font-size:.8rem;font-weight:600;text-align:left;cursor:pointer;line-height:1.3;transition:background .15s,color .15s}
.sbx-sub svg{flex-shrink:0;margin-top:.12rem;opacity:.85}
.sbx-sub:hover{background:var(--chip-bg);color:var(--txt-primary)}
.sbx-sub.is-active{color:rgb(var(--acc));background:rgba(var(--acc),.12)}
html[data-theme='light'] .sbx-sub.is-active{color:var(--acc-ink)}
.sbx-sub.is-active::before{content:"";position:absolute;left:calc(-.55rem - 1.5px);top:7px;bottom:7px;width:2px;border-radius:2px;background:rgb(var(--acc))}

.sbx-info{font-size:.7rem;line-height:1.4;margin:0 .35rem .4rem 2.6rem;padding:.35rem .5rem;border-radius:8px;color:var(--wr-warn-text,#FBBF24);background:rgba(251,191,36,.1)}

@media (max-width:900px){.sbx-search .sbx-kbd{display:none}.sbx-link{min-height:46px}.sbx-sub{min-height:42px}.sbx-search{min-height:44px;font-size:.9rem}}
@media (prefers-reduced-motion:reduce){.sbx-gwrap,.sbx-subwrap,.sbx-chev,.sbx-ico,.sbx-link,.sbx-sub{transition:none}.admin-sidebar{scroll-behavior:auto}}
`;
const SR_ONLY: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
};

export const Sidebar: React.FC<SidebarProps> = ({ active, onNavigate, isOpen, onClose, showUserManagement, galleryLabel, laporanMode, onNavigateLaporan, asetTab, onNavigateAset, onOpenSearch }) => {
  // Menu terkunci yang baru diklik — memunculkan keterangan singkat lalu hilang sendiri.
  const [kunciInfo, setKunciInfo] = useState<AdminView | null>(null);
  useEffect(() => {
    if (!kunciInfo) return;
    const t = setTimeout(() => setKunciInfo(null), 2800);
    return () => clearTimeout(t);
  }, [kunciInfo]);

  let navGroups: NavGroup[] = showUserManagement
    ? NAV_GROUPS.map((group) =>
        group.title === 'Organisasi'
          ? { ...group, items: [...group.items, { id: 'users' as AdminView, label: 'Kelola Pengguna', icon: UserCog }] }
          : group
      )
    : NAV_GROUPS;

  if (galleryLabel) {
    navGroups = navGroups.map((group) =>
      group.title === 'Organisasi'
        ? { ...group, items: group.items.map((item) => (item.id === 'gallery' ? { ...item, label: galleryLabel } : item)) }
        : group
    );
  }

  // Buang menu yang disembunyikan; grup yang jadi kosong ikut dibuang.
  navGroups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => !MENU_DISEMBUNYIKAN.includes(item.id)) }))
    .filter((group) => group.items.length > 0);

  // ── Grup sub-menu ──────────────────────────────────────────────────────
  const grupSub: Partial<Record<AdminView, GrupSub>> = {};
  if (onNavigateLaporan) {
    const pilih = (id: string) => onNavigateLaporan(id as LaporanMode);
    grupSub.dashboard = { view: 'weekly-report', awal: 'WORK_TARGET', items: SUB_DASHBOARD, aktifId: laporanMode, pilih };
    grupSub['weekly-report'] = { view: 'weekly-report', awal: 'RINGKASAN_LAPORAN', items: SUB_LAPORAN, aktifId: laporanMode, pilih };
  }
  if (onNavigateAset) {
    grupSub['asset-registry'] = {
      view: 'asset-registry', awal: 'RINGKASAN', items: SUB_ASET, aktifId: asetTab,
      pilih: (id: string) => onNavigateAset(id as AsetTab),
    };
  }
  /** Apakah halaman yang sedang tampil termasuk salah satu sub-menu grup ini? */
  const diDalam = (g: GrupSub) => g.view === active && g.items.some((i) => i.id === g.aktifId);

  // Lipat/buka sub-menu: semua terbuka di awal. Sub-menu yang berisi halaman aktif otomatis
  // terbuka lagi saat kita berpindah ke dalamnya (mis. dari sub-menu grup lain).
  const [ditutup, setDitutup] = useState<Record<string, boolean>>({});
  const terbuka = (id: string) => !ditutup[id];
  const kunciAktif = Object.entries(grupSub).filter(([, g]) => g && diDalam(g)).map(([k]) => k).join(',');
  useEffect(() => {
    if (!kunciAktif) return;
    setDitutup((p) => {
      const baru = { ...p };
      let berubah = false;
      for (const k of kunciAktif.split(',')) if (baru[k]) { baru[k] = false; berubah = true; }
      return berubah ? baru : p;
    });
  }, [kunciAktif]);

  // Lipat/buka satu grup menu (judul grup). Pilihan diingat di browser; grup yang berisi
  // halaman aktif otomatis terbuka agar halaman yang sedang dipakai tidak tersembunyi.
  const [grupTutup, setGrupTutup] = useState<Record<string, boolean>>(bacaGrupTutup);
  const simpanGrup = (next: Record<string, boolean>) => { try { localStorage.setItem(GROUP_KEY, JSON.stringify(next)); } catch { /* abaikan */ } };
  const isiAktif = (group: NavGroup) =>
    group.items.some((it) => (grupSub[it.id] ? diDalam(grupSub[it.id]!) : active === it.id));
  const grupAktifJudul = navGroups.find(isiAktif)?.title;
  useEffect(() => {
    if (!grupAktifJudul) return;
    setGrupTutup((p) => {
      if (!p[grupAktifJudul]) return p;
      const next = { ...p, [grupAktifJudul]: false };
      simpanGrup(next);
      return next;
    });
  }, [grupAktifJudul, active]);
  const toggleGrup = (judul: string) => setGrupTutup((p) => { const next = { ...p, [judul]: !p[judul] }; simpanGrup(next); return next; });

  /** Klik induk: di dalam grup → lipat/buka; dari luar → pindah ke grup (induk terbuka saja) lalu buka. */
  const klikInduk = (id: AdminView, g: GrupSub, bisaDibuka: boolean) => {
    if (bisaDibuka && !diDalam(g)) {
      setDitutup((p) => ({ ...p, [id]: false }));
      g.pilih(g.awal);
      onClose();
      return;
    }
    setDitutup((p) => ({ ...p, [id]: !!terbuka(id) }));
  };

  const labelItem = (id: AdminView) => navGroups.flatMap((g) => g.items).find((i) => i.id === id)?.label ?? '';

  /** Daftar sub-menu di bawah sebuah induk (null kalau induk tidak punya). Bisa dilipat. */
  const renderSub = (parent: AdminView) => {
    const grup = grupSub[parent];
    if (!grup) return null;
    const buka = terbuka(parent);
    return (
      <div id={`sidebar-sub-${parent}`} className={`sbx-subwrap${buka ? ' is-open' : ''}`} inert={!buka}>
        <div className="sbx-subclip">
          <div className="sbx-sublist" role="group" aria-label={`Sub-menu ${labelItem(parent)}`}>
            {grup.items.map((sub) => {
              const SubIcon = sub.icon;
              const aktif = grup.view === active && grup.aktifId === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  className={`sbx-sub${aktif ? ' is-active' : ''}`}
                  aria-current={aktif ? 'page' : undefined}
                  onClick={() => {
                    grup.pilih(sub.id);
                    onClose();
                  }}
                >
                  <SubIcon size={14} />
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={`admin-sidebar-overlay${isOpen ? ' open' : ''}`} onClick={onClose} />
      <aside className={`admin-sidebar${isOpen ? ' open' : ''}`} aria-label="Menu utama">
        <style>{SIDEBAR_CSS}</style>
        <div className="sbx-top">
          <div className="admin-sidebar-brand">
            <img src="/assets/images/logo-white.webp" alt="Reethau" className="brand-logo-dark" />
            <img src="/assets/images/logo-black.webp" alt="Reethau" className="brand-logo-light" />
            <button
              onClick={onClose}
              className="admin-sidebar-close-btn"
              aria-label="Tutup menu"
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--txt-muted)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>
          {onOpenSearch && (
            <button type="button" className="sbx-search" onClick={() => { onOpenSearch(); onClose(); }} aria-label="Buka pencarian cepat" aria-keyshortcuts="Control+K Meta+K">
              <Search size={16} aria-hidden="true" />
              <span className="t">Cari apa saja…</span>
              <kbd className="sbx-kbd" aria-hidden="true">{adalahMac ? '⌘K' : 'Ctrl K'}</kbd>
            </button>
          )}
        </div>

        <nav aria-label="Navigasi">
          {navGroups.map((group) => {
            const tutup = !!grupTutup[group.title];
            const berisiAktif = isiAktif(group);
            const bodyId = `sbx-g-${group.title.replace(/\W+/g, '-').toLowerCase()}`;
            return (
              <div key={group.title} className="sbx-group" style={{ '--acc': group.rgb, '--acc-ink': group.ink } as React.CSSProperties}>
                <button type="button" className="sbx-ghead" aria-expanded={!tutup} aria-controls={bodyId} onClick={() => toggleGrup(group.title)} title={tutup ? 'Buka grup' : 'Lipat grup'}>
                  <span className="sbx-gdot" aria-hidden="true" />
                  {group.title}
                  {tutup && berisiAktif && <span className="live" aria-label="berisi halaman aktif" />}
                  <ChevronDown size={13} className={`sbx-chev${tutup ? ' is-closed' : ''}`} aria-hidden="true" />
                </button>
                <div id={bodyId} className={`sbx-gwrap${tutup ? '' : ' is-open'}`} inert={tutup}>
                  <div className="sbx-gclip">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const g = grupSub[item.id];
                      const buka = g ? terbuka(item.id) : false;
                      const subAktif = !!g && diDalam(g);
                      const chevron = g && <ChevronDown size={14} className={`sbx-chev${buka ? '' : ' is-closed'}`} aria-hidden="true" />;

                      if (!menuTerbuka(item.id)) {
                        // Terkunci: tetap bisa difokus (agar terbaca screen reader) tapi tidak berpindah
                        // halaman. Bila induk punya sub-menu, klik hanya melipat/membuka sub-menunya.
                        return (
                          <React.Fragment key={item.id}>
                            <button
                              type="button"
                              className={`sbx-link is-locked${subAktif ? ' has-sub-active' : ''}${subAktif && !buka ? ' is-folded' : ''}`}
                              aria-disabled="true"
                              aria-expanded={g ? buka : undefined}
                              aria-controls={g ? `sidebar-sub-${item.id}` : undefined}
                              title={g ? (buka ? 'Klik untuk melipat sub-menu' : 'Klik untuk membuka sub-menu') : 'Segera hadir — sedang dalam pengembangan'}
                              onClick={() => (g ? klikInduk(item.id, g, false) : setKunciInfo(item.id))}
                            >
                              <span className="sbx-ico"><Icon size={16} /></span>
                              <span className="sbx-label">{item.label}</span>
                              <span className="sbx-soon">Segera</span>
                              {chevron}
                            </button>
                            {kunciInfo === item.id && <div className="sbx-info">Sedang dalam pengembangan — belum bisa dibuka.</div>}
                            {renderSub(item.id)}
                          </React.Fragment>
                        );
                      }
                      return (
                        <React.Fragment key={item.id}>
                          <button
                            type="button"
                            className={`sbx-link${active === item.id && !g ? ' is-active' : ''}${subAktif ? ' has-sub-active' : ''}${subAktif && !buka ? ' is-folded' : ''}`}
                            aria-current={active === item.id && !g ? 'page' : undefined}
                            aria-expanded={g ? buka : undefined}
                            aria-controls={g ? `sidebar-sub-${item.id}` : undefined}
                            onClick={() => {
                              if (g) { klikInduk(item.id, g, true); return; }
                              onNavigate(item.id);
                              onClose();
                            }}
                          >
                            <span className="sbx-ico"><Icon size={16} /></span>
                            <span className="sbx-label">{item.label}</span>
                            {chevron}
                          </button>
                          {renderSub(item.id)}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
        {/* Pengumuman untuk screen reader (keterangan visual di atas muncul-hilang sendiri). */}
        <div aria-live="polite" style={SR_ONLY}>
          {kunciInfo ? `${labelItem(kunciInfo) || 'Menu'} segera hadir, sedang dalam pengembangan.` : ''}
        </div>
      </aside>
    </>
  );
};