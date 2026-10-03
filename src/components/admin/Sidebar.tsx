import React, { useEffect, useState } from 'react';
import { menuTerbuka } from './menuAkses';
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

interface SidebarProps {
  active: AdminView;
  onNavigate: (view: AdminView) => void;
  isOpen: boolean;
  onClose: () => void;
  showUserManagement?: boolean;
  galleryLabel?: string;
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
`;
const SR_ONLY: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
};

export const Sidebar: React.FC<SidebarProps> = ({ active, onNavigate, isOpen, onClose, showUserManagement, galleryLabel }) => {
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
                return (
                  <React.Fragment key={item.id}>
                    <button
                      type="button"
                      className="admin-sidebar-link is-locked"
                      aria-disabled="true"
                      title="Terkunci — sedang dalam pengembangan"
                      onClick={() => setKunciInfo(item.id)}
                    >
                      <Icon size={17} />
                      {item.label}
                      <Lock size={13} className="admin-sidebar-lock" aria-hidden="true" />
                    </button>
                    {kunciInfo === item.id && (
                      <div style={{ fontSize: '.7rem', lineHeight: 1.4, padding: '0 .6rem .45rem 2.3rem', color: 'var(--wr-warn-text, var(--txt-secondary))' }}>
                        Sedang dalam pengembangan — belum bisa dibuka.
                      </div>
                    )}
                  </React.Fragment>
                );
              }
              return (
                <button
                  key={item.id}
                  className={`admin-sidebar-link${active === item.id ? ' active' : ''}`}
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                >
                  <Icon size={17} />
                  {item.label}
                </button>
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