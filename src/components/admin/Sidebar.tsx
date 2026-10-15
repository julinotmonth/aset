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
  Lock,
  TrendingUp,
  TrendingDown,
  FileText,
  PackageCheck,
  Target,
  Boxes,
  ChevronDown,
  PieChart,
  Table2,
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
export type LaporanMode = 'WORK_TARGET' | 'IN' | 'OUT' | 'OS_PR' | 'MIN_STOCK' | 'ASET' | 'PICA';

/** Tab di halaman Aset Tetap & Depresiasi (dipilih lewat sub-menu sidebar atau tab di halaman). */
export type AsetTab = 'RINGKASAN' | 'REGISTER' | 'ASSET_MGMT';

type ItemSub = { id: string; label: string; icon: React.ElementType };
const SUB_DASHBOARD: ItemSub[] = [
  { id: 'WORK_TARGET', label: 'Work Target / KPI', icon: Target },
  { id: 'PICA', label: 'PICA', icon: ClipboardList },
];
const SUB_LAPORAN: ItemSub[] = [
  { id: 'IN', label: 'Barang Masuk', icon: TrendingUp },
  { id: 'OUT', label: 'Barang Keluar', icon: TrendingDown },
  { id: 'OS_PR', label: 'Outstanding PR', icon: FileText },
  { id: 'MIN_STOCK', label: 'Pencapaian Safety Stock', icon: PackageCheck },
];
const SUB_ASET: ItemSub[] = [
  { id: 'RINGKASAN', label: 'Ringkasan Aset', icon: PieChart },
  { id: 'REGISTER', label: 'Register & Depresiasi', icon: Table2 },
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
}

const NAV_GROUPS: { title: string; items: { id: AdminView; label: string; icon: React.ElementType }[] }[] = [
  {
    title: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'global-search', label: 'Global Search', icon: Search },
      { id: 'reports', label: 'Laporan', icon: BarChart3 },
      { id: 'weekly-report', label: 'Laporan Mingguan', icon: CalendarRange },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { id: 'assets', label: 'Spare Part', icon: Package },
      { id: 'categories', label: 'Kategori', icon: Tags },
      { id: 'assignments', label: 'Transfer Antar Site', icon: ArrowLeftRight },
      { id: 'maintenance', label: 'Maintenance', icon: Wrench },
      { id: 'audit', label: 'Audit / Log', icon: ClipboardList },
    ],
  },
  {
    title: 'Aset Tetap (EAM)',
    items: [
      { id: 'asset-registry', label: 'Aset Tetap & Depresiasi', icon: Building2 },
      { id: 'work-orders', label: 'Jadwal Maintenance', icon: CalendarClock },
    ],
  },
  {
    title: 'Organisasi',
    items: [
      { id: 'branches', label: 'Site Operasional', icon: MapPin },
      { id: 'product-lines', label: 'Lini Produk', icon: Layers },
      { id: 'team', label: 'Tim Lapangan', icon: Users },
      { id: 'gallery', label: 'Galeri Aset Setu', icon: Images },
    ],
  },
];

// Gaya menu terkunci ditaruh di sini (bukan index.css) agar fitur ini
// berdiri sendiri. Selector lebih spesifik dari .admin-sidebar-link:hover,
// jadi menu terkunci tidak ikut menyala saat di-hover.
const SIDEBAR_CSS = `
.admin-sidebar-link.is-locked{color:var(--wr-txt-muted,var(--txt-tertiary,#94A3B8));cursor:not-allowed}
.admin-sidebar-link.is-locked:hover{background:transparent;color:var(--wr-txt-muted,var(--txt-tertiary,#94A3B8))}
.admin-sidebar-link.is-locked .admin-sidebar-lock{margin-left:auto;flex-shrink:0}
.admin-sidebar-link.is-locked:focus-visible{outline:2px solid var(--wr-focus,#00D084);outline-offset:-2px}
.admin-sidebar-link.has-active-sub{color:var(--txt-primary)}
.admin-sidebar-link.has-active-sub.is-collapsed{background:rgba(0,208,132,.12);color:var(--ce-green)}
.admin-sidebar-chev{margin-left:auto;flex-shrink:0;opacity:.7;transition:transform .2s ease}
.admin-sidebar-chev.is-closed{transform:rotate(-90deg)}
.admin-sidebar-link.is-locked .admin-sidebar-lock + .admin-sidebar-chev{margin-left:.4rem}
.admin-sidebar-subwrap{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .22s ease,opacity .18s ease}
.admin-sidebar-subwrap.is-open{grid-template-rows:1fr;opacity:1}
.admin-sidebar-subclip{overflow:hidden;min-height:0}
.admin-sidebar-sub{margin:.1rem 0 .35rem 1.2rem;padding-left:.45rem;border-left:1px solid var(--wr-line,rgba(148,163,184,.3));display:flex;flex-direction:column;gap:.1rem}
.admin-sidebar-sublink{padding:.4rem .55rem;font-size:.8rem;gap:.5rem;font-weight:600}
@media (prefers-reduced-motion:reduce){.admin-sidebar-subwrap,.admin-sidebar-chev{transition:none}}
`;
const SR_ONLY: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
};

export const Sidebar: React.FC<SidebarProps> = ({ active, onNavigate, isOpen, onClose, showUserManagement, galleryLabel, laporanMode, onNavigateLaporan, asetTab, onNavigateAset }) => {
  // Menu terkunci yang baru diklik — memunculkan keterangan singkat lalu hilang sendiri.
  const [kunciInfo, setKunciInfo] = useState<AdminView | null>(null);
  useEffect(() => {
    if (!kunciInfo) return;
    const t = setTimeout(() => setKunciInfo(null), 2800);
    return () => clearTimeout(t);
  }, [kunciInfo]);

  let navGroups = showUserManagement
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
    grupSub['weekly-report'] = { view: 'weekly-report', awal: 'OUT', items: SUB_LAPORAN, aktifId: laporanMode, pilih };
  }
  if (onNavigateAset) {
    grupSub['asset-registry'] = {
      view: 'asset-registry', awal: 'RINGKASAN', items: SUB_ASET, aktifId: asetTab,
      pilih: (id: string) => onNavigateAset(id as AsetTab),
    };
  }
  /** Apakah halaman yang sedang tampil termasuk salah satu sub-menu grup ini? */
  const diDalam = (g: GrupSub) => g.view === active && g.items.some((i) => i.id === g.aktifId);

  // Lipat/buka: semua grup terbuka di awal. Grup yang berisi halaman aktif otomatis
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
      <div id={`sidebar-sub-${parent}`} className={`admin-sidebar-subwrap${buka ? ' is-open' : ''}`} inert={!buka}>
        <div className="admin-sidebar-subclip">
          <div className="admin-sidebar-sub" role="group" aria-label={`Sub-menu ${labelItem(parent)}`}>
            {grup.items.map((sub) => {
              const SubIcon = sub.icon;
              const aktif = grup.view === active && grup.aktifId === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  className={`admin-sidebar-link admin-sidebar-sublink${aktif ? ' active' : ''}`}
                  aria-current={aktif ? 'page' : undefined}
                  onClick={() => {
                    grup.pilih(sub.id);
                    onClose();
                  }}
                >
                  <SubIcon size={15} />
                  {sub.label}
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
      <aside className={`admin-sidebar${isOpen ? ' open' : ''}`}>
        <style>{SIDEBAR_CSS}</style>
        <div className="admin-sidebar-brand">
          <img src="/assets/images/logo-white.webp" alt="Reethau" className="brand-logo-dark" />
          <img src="/assets/images/logo-black.webp" alt="Reethau" className="brand-logo-light" />
          <button
            onClick={onClose}
            className="admin-sidebar-close-btn"
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'var(--txt-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {navGroups.map((group) => (
          <div key={group.title} className="admin-sidebar-group">
            <div className="admin-sidebar-group-title">{group.title}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              if (!menuTerbuka(item.id)) {
                // Terkunci: tetap bisa difokus (agar terbaca screen reader) tapi tidak
                // berpindah halaman; sidebar mobile juga tidak ditutup supaya keterangan terlihat.
                // Kalau induk punya sub-menu yang sudah aktif, klik hanya melipat/membuka sub-menunya.
                const g = grupSub[item.id];
                const buka = g ? terbuka(item.id) : false;
                return (
                  <React.Fragment key={item.id}>
                    <button
                      type="button"
                      className={`admin-sidebar-link is-locked${g && diDalam(g) ? ' has-active-sub' : ''}${g && diDalam(g) && !buka ? ' is-collapsed' : ''}`}
                      aria-disabled="true"
                      aria-expanded={g ? buka : undefined}
                      aria-controls={g ? `sidebar-sub-${item.id}` : undefined}
                      title={g ? (buka ? 'Klik untuk melipat sub-menu' : 'Klik untuk membuka sub-menu') : 'Terkunci — sedang dalam pengembangan'}
                      onClick={() => (g ? klikInduk(item.id, g, false) : setKunciInfo(item.id))}
                    >
                      <Icon size={17} />
                      {item.label}
                      <Lock size={13} className="admin-sidebar-lock" aria-hidden="true" />
                      {g && <ChevronDown size={14} className={`admin-sidebar-chev${buka ? '' : ' is-closed'}`} aria-hidden="true" />}
                    </button>
                    {kunciInfo === item.id && (
                      <div style={{ fontSize: '.7rem', lineHeight: 1.4, padding: '0 .6rem .45rem 2.3rem', color: 'var(--wr-warn-text, var(--txt-secondary))' }}>
                        Sedang dalam pengembangan — belum bisa dibuka.
                      </div>
                    )}
                    {renderSub(item.id)}
                  </React.Fragment>
                );
              }
              const grup = grupSub[item.id];
              const buka = grup ? terbuka(item.id) : false;
              const subAktif = !!grup && diDalam(grup);
              return (
                <React.Fragment key={item.id}>
                  <button
                    className={`admin-sidebar-link${active === item.id && !grup ? ' active' : ''}${subAktif ? ' has-active-sub' : ''}${subAktif && !buka ? ' is-collapsed' : ''}`}
                    aria-expanded={grup ? buka : undefined}
                    aria-controls={grup ? `sidebar-sub-${item.id}` : undefined}
                    onClick={() => {
                      if (grup) { klikInduk(item.id, grup, true); return; }
                      onNavigate(item.id);
                      onClose();
                    }}
                  >
                    <Icon size={17} />
                    {item.label}
                    {grup && <ChevronDown size={14} className={`admin-sidebar-chev${buka ? '' : ' is-closed'}`} aria-hidden="true" />}
                  </button>
                  {renderSub(item.id)}
                </React.Fragment>
              );
            })}
          </div>
        ))}
        {/* Pengumuman untuk screen reader (keterangan visual di atas muncul-hilang sendiri). */}
        <div aria-live="polite" style={SR_ONLY}>
          {kunciInfo ? `${navGroups.flatMap((g) => g.items).find((i) => i.id === kunciInfo)?.label ?? 'Menu'} terkunci, sedang dalam pengembangan.` : ''}
        </div>
      </aside>
    </>
  );
};