import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LogOut,
  Plus,
  Search,
  Activity,
  Package,
  AlertTriangle,
  DollarSign,
  CheckCircle2,
  X,
  ExternalLink,
  Wrench,
  Layers,
  Menu,
  Bell,
  Sun,
  Moon,
  AlertOctagon,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import type { AuthState, SparePart, SiteFilter, ActivityLog, SiteLocation, AppUser, FixedAsset, WorkOrder, ReportsSummary } from '../../types';
import { getSparePartCategories } from '../../data/categoryStore';
import { getSites, useSitesRefresh } from '../../data/siteStore';
import { api } from '../../lib/api';
import { SiteSelector } from './SiteSelector';
import { SparePartTable } from './SparePartTable';
import { TransferModal } from './TransferModal';
import { AddEditSparePartModal } from './AddEditSparePartModal';
import { UserFormModal } from './UserFormModal';
import { AdminAnalytics } from './AdminAnalytics';
import { Sidebar, type AdminView } from './Sidebar';
import {
  GlobalSearchView,
  CategoriesView,
  AssignmentsView,
  MaintenanceView,
  AuditView,
  BranchesView,
  ProductLinesView,
  TeamView,
  GalleryView,
  UserManagementView,
  ACTION_META,
  parseLogDate,
  timeAgo,
  SITE_LABEL,
} from './AdminExtraViews';
import { AssetRegistryView, WorkOrdersView, ReportsView } from './AssetManagementViews';

interface AdminDashboardProps {
  auth: AuthState;
  onLogout: () => void;
  onGoToPublicSite: () => void;
  onUpdateAuth: (patch: Partial<AuthState>) => void;
}

const THEME_KEY = 'reethau_admin_theme';
const NOTIF_READ_KEY = 'reethau_notif_last_read';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ auth, onLogout, onGoToPublicSite, onUpdateAuth }) => {
  const [activeView, setActiveView] = useState<AdminView>('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // ── Theme (dark / light) ────────────────────────────────────────────────
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    // Reset to the default (dark) look once the admin portal is left, so the
    // public marketing site keeps its own fixed branded appearance.
    return () => {
      document.documentElement.removeAttribute('data-theme');
    };
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [reportsSummary, setReportsSummary] = useState<ReportsSummary | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const reloadAssetData = async () => {
    const [assetsRes, workOrdersRes, summaryRes] = await Promise.allSettled([
      api.get<FixedAsset[]>('/fixed-assets'),
      api.get<WorkOrder[]>('/work-orders'),
      api.get<ReportsSummary>('/reports/summary'),
    ]);
    if (assetsRes.status === 'fulfilled') setFixedAssets(assetsRes.value);
    if (workOrdersRes.status === 'fulfilled') setWorkOrders(workOrdersRes.value);
    if (summaryRes.status === 'fulfilled') setReportsSummary(summaryRes.value);
  };

  // Spare parts / logs / (for Super Admins) users now live in the backend —
  // fetch them once on mount instead of reading localStorage. `users` 404s
  // gracefully for non-Super-Admin accounts (that endpoint is admin-only);
  // the profile fallback below covers their own account either way.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [partsRes, logsRes, usersRes, assetsRes, workOrdersRes, summaryRes] = await Promise.allSettled([
          api.get<SparePart[]>('/spare-parts'),
          api.get<ActivityLog[]>('/logs'),
          api.get<AppUser[]>('/users'),
          api.get<FixedAsset[]>('/fixed-assets'),
          api.get<WorkOrder[]>('/work-orders'),
          api.get<ReportsSummary>('/reports/summary'),
        ]);
        if (cancelled) return;
        if (partsRes.status === 'fulfilled') setSpareParts(partsRes.value);
        if (logsRes.status === 'fulfilled') setLogs(logsRes.value);
        if (usersRes.status === 'fulfilled') setUsers(usersRes.value);
        if (assetsRes.status === 'fulfilled') setFixedAssets(assetsRes.value);
        if (workOrdersRes.status === 'fulfilled') setWorkOrders(workOrdersRes.value);
        if (summaryRes.status === 'fulfilled') setReportsSummary(summaryRes.value);
        if (partsRes.status === 'rejected' || logsRes.status === 'rejected') {
          setLoadError('Sebagian data gagal dimuat dari server. Coba muat ulang halaman.');
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Gagal memuat data dari server.');
      } finally {
        if (!cancelled) setIsDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const currentUser = users.find((u) => u.id === auth.userId) ?? null;
  // Bumped whenever a site is added/edited/deleted (see BranchesView), so the
  // dashboard's site filter, siteCounts, and every "pick a site" dropdown
  // re-render with the current list instead of a stale snapshot.
  const [sitesVersion, setSitesVersion] = useState(0);
  // Extra safety net alongside the manual sitesVersion bump above: also
  // react to the global "sites changed" event so nothing ever goes stale.
  useSitesRefresh();
  // Ad-hoc sessions (login email didn't match a saved account) still get a
  // profile-editable view, pre-filled from the live session state.
  const profileUser: AppUser | null =
    currentUser ??
    (auth.isAuthenticated
      ? {
          id: '',
          name: auth.username,
          email: '',
          position: auth.position || auth.role,
          role: auth.role,
          assignedSite: auth.assignedSite,
          avatarUrl: auth.avatarUrl,
          createdAt: '',
        }
      : null);
  const isSuperAdmin = auth.role === 'Super Admin';

  const handleAddUser = async (data: Partial<AppUser>) => {
    try {
      const newUser = await api.post<AppUser>('/users', data);
      setUsers((prev) => [...prev, newUser]);
      showToast(`Akun ${newUser.name} berhasil ditambahkan.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menambah akun.');
    }
  };

  const handleUpdateUser = async (id: string, data: Partial<AppUser>) => {
    try {
      const updated = await api.patch<AppUser>(`/users/${encodeURIComponent(id)}`, data);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      // If the edited account is the currently logged-in session, refresh the
      // header/session immediately instead of waiting for the next login.
      if (id === auth.userId) {
        onUpdateAuth({
          username: updated.name,
          avatarUrl: updated.avatarUrl,
          position: updated.position,
          role: updated.role,
          assignedSite: updated.assignedSite,
        });
      }
      showToast('Profil berhasil diperbarui.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memperbarui profil.');
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await api.delete(`/users/${encodeURIComponent(id)}`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      showToast('Akun pengguna dihapus.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus akun.');
    }
  };

  const [currentSite, setCurrentSite] = useState<SiteFilter>(auth.assignedSite || 'global');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [categoryOptions, setCategoryOptions] = useState<string[]>(getSparePartCategories());

  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SparePart | null>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferringItem, setTransferringItem] = useState<SparePart | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ── Notifications ────────────────────────────────────────────────────────
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [lastReadAt, setLastReadAt] = useState<number>(() => Number(localStorage.getItem(NOTIF_READ_KEY) || 0));
  const previousReadAtRef = useRef(lastReadAt);

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => (parseLogDate(b.timestamp)?.getTime() ?? 0) - (parseLogDate(a.timestamp)?.getTime() ?? 0)),
    [logs]
  );
  const unreadCount = useMemo(
    () => sortedLogs.filter((l) => (parseLogDate(l.timestamp)?.getTime() ?? 0) > lastReadAt).length,
    [sortedLogs, lastReadAt]
  );
  const attentionItems = useMemo(
    () => spareParts.filter((p) => p.status === 'Critical' || p.status === 'Maintenance Needed'),
    [spareParts]
  );

  const toggleNotif = () => {
    setIsNotifOpen((open) => {
      const next = !open;
      if (next) {
        previousReadAtRef.current = lastReadAt;
        const now = Date.now();
        setLastReadAt(now);
        localStorage.setItem(NOTIF_READ_KEY, String(now));
      }
      return next;
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredSpareParts = spareParts.filter((item) => {
    const matchesSite = currentSite === 'global' || item.site === currentSite;
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.specifications.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSite && matchesCategory && matchesSearch;
  });

  const siteCounts: Record<string, number> = { global: spareParts.length };
  getSites().forEach((s) => {
    siteCounts[s.key] = spareParts.filter((p) => p.site === s.key).length;
  });

  const totalItems = filteredSpareParts.reduce((acc, curr) => acc + curr.stock, 0);
  const lowStockCount = filteredSpareParts.filter((p) => p.stock <= p.minStock).length;
  const totalValue = filteredSpareParts.reduce((acc, curr) => acc + curr.stock * curr.priceEstimate, 0);
  const maintenanceCount = filteredSpareParts.filter((p) => p.status === 'Maintenance Needed').length;
  const activeCategoryCount = new Set(filteredSpareParts.map((p) => p.category)).size;

  const handleSaveSparePart = async (partData: Partial<SparePart>) => {
    try {
      if (partData.id) {
        const updated = await api.patch<SparePart>(`/spare-parts/${encodeURIComponent(partData.id)}`, partData);
        setSpareParts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        showToast(`Spare part ${updated.sku} berhasil diperbarui.`);
      } else {
        const newPart = await api.post<SparePart>('/spare-parts', partData);
        setSpareParts((prev) => [newPart, ...prev]);

        const newLog = await api.post<ActivityLog>('/logs', {
          action: 'ADD_SPARE_PART',
          description: `Penambahan spare part baru: ${newPart.name} (${newPart.sku}) di Site ${newPart.site}`,
          performedBy: auth.username,
          siteFrom: newPart.site,
        });
        setLogs((prev) => [newLog, ...prev]);
        showToast(`Spare part baru ${newPart.name} berhasil ditambahkan!`);
      }
      // Refresh in case a new category was added from the modal.
      setCategoryOptions(getSparePartCategories());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan spare part.');
    }
  };

  const handleConfirmTransfer = async (item: SparePart, quantity: number, targetSite: SiteLocation) => {
    try {
      const { source, target, log } = await api.post<{ source: SparePart; target: SparePart; log: ActivityLog }>(
        `/spare-parts/${encodeURIComponent(item.id)}/transfer`,
        { quantity, targetSite, performedBy: auth.username }
      );
      setSpareParts((prev) => {
        const withSource = prev.map((p) => (p.id === source.id ? source : p));
        return withSource.some((p) => p.id === target.id) ? withSource.map((p) => (p.id === target.id ? target : p)) : [...withSource, target];
      });
      setLogs((prev) => [log, ...prev]);
      showToast(`Berhasil mentransfer ${quantity} unit ${item.name} ke Site ${String(targetSite).toUpperCase()}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memproses transfer.');
    }
  };

  const handleFlagMaintenance = async (item: SparePart, note: string) => {
    try {
      const updated = await api.patch<SparePart>(`/spare-parts/${encodeURIComponent(item.id)}`, {
        status: 'Maintenance Needed',
        lastInspected: new Date().toISOString().split('T')[0],
      });
      setSpareParts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

      const newLog = await api.post<ActivityLog>('/logs', {
        action: 'STOCK_UPDATE',
        description: note
          ? `Menandai ${item.name} (${item.sku}) di Site ${item.site.toUpperCase()} untuk maintenance: ${note}`
          : `Menandai ${item.name} (${item.sku}) di Site ${item.site.toUpperCase()} untuk maintenance.`,
        performedBy: auth.username,
        siteFrom: item.site,
      });
      setLogs((prev) => [newLog, ...prev]);
      showToast(`${item.name} ditandai untuk maintenance.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menandai maintenance.');
    }
  };

  const handleResolveMaintenance = async (item: SparePart) => {
    const resolvedStatus: SparePart['status'] = item.stock <= 0 ? 'Critical' : item.stock <= item.minStock ? 'Low Stock' : 'In Stock';
    try {
      const updated = await api.patch<SparePart>(`/spare-parts/${encodeURIComponent(item.id)}`, {
        status: resolvedStatus,
        lastInspected: new Date().toISOString().split('T')[0],
      });
      setSpareParts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

      const newLog = await api.post<ActivityLog>('/logs', {
        action: 'STOCK_UPDATE',
        description: `Maintenance selesai untuk ${item.name} (${item.sku}) di Site ${item.site.toUpperCase()}.`,
        performedBy: auth.username,
        siteFrom: item.site,
      });
      setLogs((prev) => [newLog, ...prev]);
      showToast(`${item.name} ditandai selesai maintenance.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyelesaikan maintenance.');
    }
  };

  const handleDeleteSparePart = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data spare part ini?')) return;
    const target = spareParts.find((p) => p.id === id);
    try {
      await api.delete(`/spare-parts/${encodeURIComponent(id)}`);
      setSpareParts((prev) => prev.filter((p) => p.id !== id));
      if (target) showToast(`Spare part ${target.name} dihapus.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus spare part.');
    }
  };

  // ── Fixed Assets (Asset Registry / Depreciation) ─────────────────────────
  const handleSaveFixedAsset = async (patch: Partial<FixedAsset>) => {
    try {
      if (patch.id) {
        const updated = await api.patch<FixedAsset>(`/fixed-assets/${encodeURIComponent(patch.id)}`, patch);
        setFixedAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        showToast(`Aset ${updated.assetCode} berhasil diperbarui.`);
      } else {
        const created = await api.post<FixedAsset>('/fixed-assets', { ...patch, performedBy: auth.username });
        setFixedAssets((prev) => [created, ...prev]);
        showToast(`Aset tetap baru "${created.name}" berhasil didaftarkan.`);
      }
      reloadAssetData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan aset tetap.');
    }
  };

  const handleDeleteFixedAsset = async (id: string) => {
    const target = fixedAssets.find((a) => a.id === id);
    try {
      await api.delete(`/fixed-assets/${encodeURIComponent(id)}`);
      setFixedAssets((prev) => prev.filter((a) => a.id !== id));
      if (target) showToast(`Aset ${target.name} dihapus.`);
      reloadAssetData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus aset. Pastikan tidak ada work order aktif yang terkait.');
    }
  };

  // ── Work Orders (Scheduled Maintenance) ──────────────────────────────────
  const handleSaveWorkOrder = async (patch: Partial<WorkOrder>) => {
    try {
      if (patch.id) {
        const updated = await api.patch<WorkOrder>(`/work-orders/${encodeURIComponent(patch.id)}`, patch);
        setWorkOrders((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
        showToast('Work order berhasil diperbarui.');
      } else {
        const created = await api.post<WorkOrder>('/work-orders', patch);
        setWorkOrders((prev) => [created, ...prev]);
        showToast(`Pekerjaan "${created.title}" berhasil dijadwalkan.`);
      }
      reloadAssetData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan work order.');
    }
  };

  const handleCompleteWorkOrder = async (id: string) => {
    try {
      const updated = await api.post<WorkOrder>(`/work-orders/${encodeURIComponent(id)}/complete`, {});
      setWorkOrders((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      showToast('Work order ditandai selesai.');
      reloadAssetData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyelesaikan work order.');
    }
  };

  const handleDeleteWorkOrder = async (id: string) => {
    if (!confirm('Hapus work order ini?')) return;
    try {
      await api.delete(`/work-orders/${encodeURIComponent(id)}`);
      setWorkOrders((prev) => prev.filter((w) => w.id !== id));
      showToast('Work order dihapus.');
      reloadAssetData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus work order.');
    }
  };

  if (isDataLoading) {
    return (
      <div className="admin-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--txt-muted)' }}>
          <img src="/assets/images/logo-icon.png" alt="" style={{ width: '48px', height: '48px', opacity: 0.85, marginBottom: '1rem' }} />
          <div>Memuat data dari server...</div>
          {loadError && <div style={{ color: '#F87171', marginTop: '0.75rem', fontSize: '0.85rem', maxWidth: '360px' }}>{loadError}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            zIndex: 200,
            background: 'rgba(0, 208, 132, 0.95)',
            color: 'var(--txt-inverse)',
            padding: '1rem 1.5rem',
            borderRadius: '12px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            boxShadow: '0 10px 30px rgba(0, 208, 132, 0.4)',
          }}
        >
          <CheckCircle2 size={22} />
          {toastMessage}
        </div>
      )}

      <div className="admin-layout">
        <Sidebar
          active={activeView}
          onNavigate={setActiveView}
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
          showUserManagement={isSuperAdmin}
          galleryLabel={isSuperAdmin ? 'Galeri Aset' : `Galeri Aset ${SITE_LABEL[auth.assignedSite] ?? ''}`}
        />

        <div className="admin-content">
      {/* Admin Header Topbar */}
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-brand">
            <button
              className="admin-mobile-nav-toggle"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="Buka menu"
            >
              <Menu size={18} />
            </button>
            <img
              src="/assets/images/logo-white.webp"
              alt="Reethau Clean Energy Logo"
              className="admin-brand-logo-img brand-logo-dark"
            />
            <img
              src="/assets/images/logo-black.webp"
              alt="Reethau Clean Energy Logo"
              className="admin-brand-logo-img brand-logo-light"
            />
            <div style={{ minWidth: 0 }}>
              <div className="admin-brand-title">
                Reethau Inventory Admin Portal
                <span style={{ fontSize: '0.7rem', background: 'rgba(0, 208, 132, 0.15)', color: '#00D084', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                  v2.4 Live
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                title="Buka Profil Saya"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none',
                  padding: 0, marginTop: '0.15rem', cursor: 'pointer', maxWidth: '100%',
                }}
              >
                {auth.avatarUrl ? (
                  <img src={auth.avatarUrl} alt={auth.username} style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <span style={{
                    width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,208,132,0.18)', color: '#00D084',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 800, flexShrink: 0,
                  }}>
                    {auth.username.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="admin-brand-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <strong style={{ color: 'var(--txt-tertiary)' }}>{auth.username}</strong> ({auth.position || auth.role})
                </span>
                <ChevronDown size={12} color="var(--txt-muted)" style={{ flexShrink: 0 }} />
              </button>
            </div>
          </div>

          <div className="admin-actions">
            <button
              onClick={toggleTheme}
              className="btn-chip theme-toggle-btn"
              title={theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
              aria-label="Ganti tema"
            >
              {theme === 'dark' ? <Moon size={21} strokeWidth={2.1} /> : <Sun size={21} strokeWidth={2.1} />}
            </button>

            <button
              onClick={toggleNotif}
              className="btn-chip notif-bell-btn"
              title="Notifikasi"
              aria-label="Notifikasi"
            >
              <Bell size={19} />
              {unreadCount > 0 && (
                <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>

            <button
              onClick={() => setIsLogsOpen(!isLogsOpen)}
              className="btn-chip"
            >
              <Activity size={16} color="#00D084" />
              <span className="label-text">Log ({logs.length})</span>
            </button>

            <button
              onClick={onGoToPublicSite}
              className="btn-chip"
              style={{ color: 'var(--txt-tertiary)' }}
            >
              <ExternalLink size={16} />
              <span className="label-text">Situs Publik</span>
            </button>

            <button
              onClick={onLogout}
              className="btn-chip danger"
            >
              <LogOut size={16} />
              <span className="label-text">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="admin-main">
        {activeView === 'dashboard' && (
        <>
        {/* KPI Cards */}
        <div className="kpi-grid">
          <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--txt-tertiary)', fontSize: '0.85rem' }}>
              <span>Total Unit Spare Part</span>
              <Package size={20} color="#00D084" />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--txt-primary)', marginTop: '0.5rem' }}>
              {totalItems}{' '}
              <span style={{ fontSize: '0.85rem', color: 'var(--txt-muted)', fontWeight: 500 }}>
                ({filteredSpareParts.length} jenis)
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#00D084', marginTop: '0.4rem' }}>📍 Filter: Site {currentSite.toUpperCase()}</div>
          </div>

          <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--txt-tertiary)', fontSize: '0.85rem' }}>
              <span>Peringatan Stok Kritis</span>
              <AlertTriangle size={20} color={lowStockCount > 0 ? '#F87171' : '#34D399'} />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: lowStockCount > 0 ? '#F87171' : 'var(--txt-primary)', marginTop: '0.5rem' }}>
              {lowStockCount} <span style={{ fontSize: '0.85rem', color: 'var(--txt-muted)', fontWeight: 500 }}>item</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: lowStockCount > 0 ? '#F87171' : 'var(--txt-muted)', marginTop: '0.4rem' }}>
              {lowStockCount > 0 ? 'Perlu tindakan pengadaan / transfer' : 'Semua stok dalam ambang aman'}
            </div>
          </div>

          <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--txt-tertiary)', fontSize: '0.85rem' }}>
              <span>Estimasi Nilai Inventaris</span>
              <DollarSign size={20} color="#00D084" />
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#00D084', marginTop: '0.5rem' }}>
              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalValue)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--txt-muted)', marginTop: '0.4rem' }}>Total nilai aset terdaftar</div>
          </div>

          <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--txt-tertiary)', fontSize: '0.85rem' }}>
              <span>Perlu Maintenance</span>
              <Wrench size={20} color={maintenanceCount > 0 ? '#F59E0B' : '#34D399'} />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: maintenanceCount > 0 ? '#F59E0B' : 'var(--txt-primary)', marginTop: '0.5rem' }}>
              {maintenanceCount} <span style={{ fontSize: '0.85rem', color: 'var(--txt-muted)', fontWeight: 500 }}>item</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--txt-muted)', marginTop: '0.4rem' }}>Menunggu tindakan servis</div>
          </div>

          <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--txt-tertiary)', fontSize: '0.85rem' }}>
              <span>Kategori Aktif</span>
              <Layers size={20} color="#00D084" />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--txt-primary)', marginTop: '0.5rem' }}>
              {activeCategoryCount} <span style={{ fontSize: '0.85rem', color: 'var(--txt-muted)', fontWeight: 500 }}>kategori</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--txt-muted)', marginTop: '0.4rem' }}>Jenis produk terdaftar di sistem</div>
          </div>
        </div>

        {/* Analytics */}
        <AdminAnalytics spareParts={filteredSpareParts} logs={logs} />
        </>
        )}

        {activeView === 'assets' && (
        <>
        {/* Site Selector */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--txt-muted)', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Pilih Tampilan Lokasi Site Operasional
          </div>
          <SiteSelector key={sitesVersion} currentSite={currentSite} onSiteChange={setCurrentSite} siteCounts={siteCounts} />
        </div>

        {/* Search & Action Bar */}
        <div
          className="glass-panel admin-toolbar"
          style={{
            borderRadius: '20px',
            padding: '1.5rem',
          }}
        >
          <div className="admin-toolbar-fields">
            <div style={{ position: 'relative' }}>
              <Search size={18} color="#64748B" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Cari nama, SKU, atau spesifikasi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-root)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '0.7rem 1rem 0.7rem 2.75rem',
                  color: 'var(--txt-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                background: 'var(--bg-root)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '0.7rem 1rem',
                color: 'var(--txt-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">Semua Kategori</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setEditingItem(null);
              setIsAddEditOpen(true);
            }}
            className="btn-primary"
            style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem', justifyContent: 'center' }}
          >
            <Plus size={18} />
            Tambah Spare Part Baru
          </button>
        </div>

        {/* Table */}
        <div className="glass-panel admin-table-wrap" style={{ borderRadius: '20px', padding: '1.5rem' }}>
          <SparePartTable
            spareParts={filteredSpareParts}
            onEdit={(item) => {
              setEditingItem(item);
              setIsAddEditOpen(true);
            }}
            onTransfer={(item) => {
              setTransferringItem(item);
              setIsTransferOpen(true);
            }}
            onDelete={handleDeleteSparePart}
          />
        </div>
        </>
        )}

        {activeView === 'global-search' && (
          <GlobalSearchView spareParts={spareParts} logs={logs} onNavigate={setActiveView} />
        )}
        {activeView === 'categories' && <CategoriesView spareParts={spareParts} />}
        {activeView === 'assignments' && (
          <AssignmentsView spareParts={spareParts} logs={logs} onConfirmTransfer={handleConfirmTransfer} />
        )}
        {activeView === 'maintenance' && (
          <MaintenanceView
            spareParts={spareParts}
            onFlagMaintenance={handleFlagMaintenance}
            onResolveMaintenance={handleResolveMaintenance}
          />
        )}
        {activeView === 'asset-registry' && (
          <AssetRegistryView fixedAssets={fixedAssets} onSave={handleSaveFixedAsset} onDelete={handleDeleteFixedAsset} />
        )}
        {activeView === 'work-orders' && (
          <WorkOrdersView
            workOrders={workOrders}
            fixedAssets={fixedAssets}
            onSave={handleSaveWorkOrder}
            onComplete={handleCompleteWorkOrder}
            onDelete={handleDeleteWorkOrder}
          />
        )}
        {activeView === 'reports' && (
          <ReportsView summary={reportsSummary} fixedAssets={fixedAssets} workOrders={workOrders} />
        )}
        {activeView === 'audit' && <AuditView logs={logs} />}
        {activeView === 'branches' && (
          <BranchesView spareParts={spareParts} onSitesChanged={() => setSitesVersion((v) => v + 1)} />
        )}
        {activeView === 'product-lines' && <ProductLinesView spareParts={spareParts} />}
        {activeView === 'team' && <TeamView logs={logs} />}
        {activeView === 'gallery' && <GalleryView auth={auth} />}
        {activeView === 'users' && isSuperAdmin && (
          <UserManagementView
            users={users}
            currentUserId={auth.userId}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
          />
        )}
      </main>
        </div>
      </div>

      {/* Notifications Popover */}
      {isNotifOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'transparent' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsNotifOpen(false); }}
        >
          <div className="notif-popover">
            <div className="notif-popover-header">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--txt-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bell size={18} color="#00D084" />
                Notifikasi
              </h3>
              <button onClick={() => setIsNotifOpen(false)} className="notif-popover-close">
                <X size={16} />
              </button>
            </div>

            <div className="notif-popover-body">
              {/* Needs attention */}
              <div className="notif-section-title">
                <AlertOctagon size={13} />
                Butuh Perhatian ({attentionItems.length})
              </div>
              {attentionItems.length === 0 ? (
                <div className="notif-empty">Semua spare part dalam kondisi baik. 🎉</div>
              ) : (
                <>
                  {attentionItems.slice(0, 4).map((p) => (
                    <div key={p.id} className="notif-item">
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
                        background: p.status === 'Critical' ? 'rgba(248,113,113,0.15)' : 'rgba(167,139,250,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {p.status === 'Critical' ? <AlertOctagon size={16} color="#F87171" /> : <Wrench size={16} color="#A78BFA" />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'var(--txt-primary)', fontWeight: 700, fontSize: '0.85rem' }}>{p.name}</div>
                        <div style={{ color: 'var(--txt-muted)', fontSize: '0.76rem' }}>
                          Site {SITE_LABEL[p.site]} &middot; {p.status}
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-chip"
                    onClick={() => { setActiveView('maintenance'); setIsNotifOpen(false); }}
                    style={{ width: '100%', justifyContent: 'center', marginTop: '0.25rem' }}
                  >
                    Lihat semua di Maintenance
                    <ArrowRight size={13} />
                  </button>
                </>
              )}

              {/* Recent activity */}
              <div className="notif-section-title">
                <Activity size={13} />
                Aktivitas Terbaru
              </div>
              {sortedLogs.length === 0 ? (
                <div className="notif-empty">Belum ada aktivitas.</div>
              ) : (
                sortedLogs.slice(0, 8).map((l) => {
                  const meta = ACTION_META[l.action];
                  const Icon = meta.icon;
                  const isNew = (parseLogDate(l.timestamp)?.getTime() ?? 0) > previousReadAtRef.current;
                  return (
                    <div key={l.id} className={`notif-item${isNew ? ' is-new' : ''}`}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={16} color={meta.color} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'var(--txt-primary)', fontSize: '0.83rem', lineHeight: 1.4 }}>{l.description}</div>
                        <div style={{ color: 'var(--txt-muted)', fontSize: '0.74rem', marginTop: '0.2rem' }}>{timeAgo(l.timestamp)}</div>
                      </div>
                    </div>
                  );
                })
              )}
              <button
                type="button"
                className="btn-chip"
                onClick={() => { setActiveView('audit'); setIsNotifOpen(false); }}
                style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
              >
                Lihat Semua Log Aktivitas
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Logs Drawer */}
      {isLogsOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(5, 8, 16, 0.6)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsLogsOpen(false); }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '450px',
              height: '100vh',
              background: 'var(--bg-surface)',
              borderLeft: '1px solid var(--border-subtle)',
              padding: '2rem',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--txt-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={20} color="#00D084" />
                Riwayat Log Aktivitas
              </h3>
              <button onClick={() => setIsLogsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--txt-tertiary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    background: 'var(--bg-root)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#00D084', fontWeight: 700 }}>
                    <span>{log.action}</span>
                    <span style={{ color: 'var(--txt-muted)' }}>{log.timestamp}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--txt-primary)', marginTop: '0.4rem', fontWeight: 500 }}>{log.description}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--txt-muted)', marginTop: '0.5rem' }}>Oleh: {log.performedBy}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddEditSparePartModal
        isOpen={isAddEditOpen}
        itemToEdit={editingItem}
        onClose={() => setIsAddEditOpen(false)}
        onSave={handleSaveSparePart}
      />

      <TransferModal
        isOpen={isTransferOpen}
        item={transferringItem}
        onClose={() => setIsTransferOpen(false)}
        onConfirmTransfer={handleConfirmTransfer}
      />

      <UserFormModal
        isOpen={isProfileOpen}
        mode="self"
        userToEdit={profileUser}
        onClose={() => setIsProfileOpen(false)}
        onSave={(data) => {
          if (currentUser) {
            handleUpdateUser(currentUser.id, data);
          } else {
            // Ad-hoc session (email didn't match a saved account) — just
            // update the live header/session without a users-list entry.
            onUpdateAuth({ username: data.name, avatarUrl: data.avatarUrl, position: data.position });
            showToast('Profil berhasil diperbarui.');
          }
          setIsProfileOpen(false);
        }}
      />
    </div>
  );
};