import { useState, useEffect, useCallback } from 'react';
import type { Language, AuthState } from './types';
import { Navbar } from './components/public/Navbar';
import { HeroSection } from './components/public/HeroSection';
import { VisionSection } from './components/public/VisionSection';
import { ProductCarousel } from './components/public/ProductCarousel';
import { Footer } from './components/public/Footer';
import { KoneksiBanner } from './components/admin/KoneksiBanner';
import { AdminLoginModal } from './components/admin/AdminLoginModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { api, ApiError, getToken, setToken } from './lib/api';
import { initSitesStore } from './data/siteStore';
import { initCategoriesStore } from './data/categoryStore';
import { initGalleryStore } from './data/galleryStore';

const EMPTY_AUTH: AuthState = {
  isAuthenticated: false,
  username: '',
  role: 'Super Admin',
  assignedSite: 'global',
};

/** Loads sites/categories/gallery into their in-memory caches — must finish
 * before AdminDashboard (or anything it renders) runs, since those modules
 * expose synchronous getX() readers backed by this cache. */
async function loadAppData() {
  await Promise.all([initSitesStore(), initCategoriesStore(), initGalleryStore()]);
}

function AppIsi() {
  const [lang, setLang] = useState<Language>('IDN');
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [auth, setAuth] = useState<AuthState>(EMPTY_AUTH);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [currentView, setCurrentView] = useState<'public' | 'admin'>('public');

  // Gagal memulihkan sesi karena server/jaringan (BUKAN karena token ditolak): tampilkan layar
  // "Coba lagi" alih-alih mengeluarkan pengguna. Dulu kegagalan apa pun — termasuk server yang
  // sedang bangun dari mode tidur — menghapus token dan memaksa login ulang.
  const [galatPemulihan, setGalatPemulihan] = useState<string | null>(null);

  // On first load, try to resume a previous session (token saved in
  // localStorage) instead of always forcing a fresh login.
  const pulihkanSesi = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setIsBootstrapping(false);
      return;
    }
    setGalatPemulihan(null);
    setIsBootstrapping(true);
    try {
      const { user } = await api.get<{ user: { id: string; name: string; role: AuthState['role']; assignedSite: AuthState['assignedSite']; avatarUrl?: string; position?: string } }>('/auth/me');
      await loadAppData();
      setAuth({
        isAuthenticated: true,
        userId: user.id,
        username: user.name,
        role: user.role,
        assignedSite: user.assignedSite,
        avatarUrl: user.avatarUrl,
        position: user.position,
      });
      setCurrentView('admin');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setToken(null); // token benar-benar ditolak server → login ulang
      } else {
        setGalatPemulihan(err instanceof Error ? err.message : 'Tidak bisa terhubung ke server.');
      }
    } finally {
      setIsBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    void pulihkanSesi();
  }, [pulihkanSesi]);

  const handleLoginSuccess = async (newAuth: AuthState) => {
    await loadAppData();
    setAuth(newAuth);
    setCurrentView('admin');
  };

  const handleUpdateAuth = (patch: Partial<AuthState>) => {
    setAuth((prev) => ({ ...prev, ...patch }));
  };

  const handleLogout = () => {
    setToken(null);
    setAuth(EMPTY_AUTH);
    setCurrentView('public');
  };

  if (galatPemulihan && !isBootstrapping) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0F1D', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div role="alert" style={{ maxWidth: 420, width: '100%', textAlign: 'center', color: '#E5E7EB', background: '#111827', border: '1px solid rgba(251,191,36,.4)', borderRadius: 18, padding: '2rem 1.5rem' }}>
          <img src="/assets/images/logo-icon.png" alt="Reethau" style={{ width: 48, height: 48, opacity: 0.9, marginBottom: '1rem' }} />
          <h2 style={{ margin: '0 0 .5rem', fontSize: '1.1rem' }}>Belum bisa terhubung ke server</h2>
          <p style={{ margin: '0 0 1.25rem', fontSize: '.88rem', lineHeight: 1.55, color: '#9CA3AF' }}>
            {galatPemulihan} Sesi login Anda masih tersimpan — Anda tidak perlu masuk ulang.
          </p>
          <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void pulihkanSesi()} style={{ minHeight: 44, padding: '.6rem 1.2rem', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, color: '#fff', background: '#00A86B' }}>Coba lagi</button>
            <button type="button" onClick={() => { setToken(null); setGalatPemulihan(null); }} style={{ minHeight: 44, padding: '.6rem 1.2rem', borderRadius: 12, cursor: 'pointer', fontWeight: 600, color: '#E5E7EB', background: 'transparent', border: '1px solid #374151' }}>Masuk ulang</button>
          </div>
        </div>
      </div>
    );
  }

  if (isBootstrapping) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0F1D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src="/assets/images/logo-icon.png" alt="Reethau" style={{ width: '56px', height: '56px', opacity: 0.85 }} />
      </div>
    );
  }

  if (currentView === 'admin' && auth.isAuthenticated) {
    return (
      <AdminDashboard
        auth={auth}
        onLogout={handleLogout}
        onGoToPublicSite={() => setCurrentView('public')}
        onUpdateAuth={handleUpdateAuth}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F1D', color: '#FFFFFF' }}>
      <Navbar
        lang={lang}
        onLanguageChange={setLang}
        onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
        isAuthenticated={auth.isAuthenticated}
        onOpenAdminDashboard={() => setCurrentView('admin')}
      />

      <HeroSection lang={lang} onOpenAdminLogin={() => setIsAdminLoginOpen(true)} />
      <VisionSection lang={lang} />
      <ProductCarousel lang={lang} />
      <Footer onOpenAdminLogin={() => setIsAdminLoginOpen(true)} />

      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}

/** Banner koneksi ada di akar supaya juga muncul saat sesi dipulihkan / halaman publik memuat data,
 *  yaitu momen paling sering terkena server yang sedang bangun dari mode tidur. */
export function App() {
  return (
    <>
      <AppIsi />
      <KoneksiBanner />
    </>
  );
}

export default App;