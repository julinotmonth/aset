import React from 'react';
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
} from 'lucide-react';

export type AdminView =
  | 'dashboard'
  | 'global-search'
  | 'assets'
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
    title: 'Organisasi',
    items: [
      { id: 'branches', label: 'Site Operasional', icon: MapPin },
      { id: 'product-lines', label: 'Lini Produk', icon: Layers },
      { id: 'team', label: 'Tim Lapangan', icon: Users },
      { id: 'gallery', label: 'Galeri Aset Setu', icon: Images },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ active, onNavigate, isOpen, onClose, showUserManagement, galleryLabel }) => {
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
      </aside>
    </>
  );
};