import { useState, useEffect } from 'react';
import type { Language, AuthState } from './types';
import { Navbar } from './components/public/Navbar';
import { HeroSection } from './components/public/HeroSection';
import { VisionSection } from './components/public/VisionSection';
import { ProductCarousel } from './components/public/ProductCarousel';
import { Footer } from './components/public/Footer';
import { AdminLoginModal } from './components/admin/AdminLoginModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { api, getToken, setToken } from './lib/api';
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

export function App() {
  const [lang, setLang] = useState<Language>('IDN');
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [auth, setAuth] = useState<AuthState>(EMPTY_AUTH);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [currentView, setCurrentView] = useState<'public' | 'admin'>('public');

  // On first load, try to resume a previous session (token saved in
  // localStorage) instead of always forcing a fresh login.
  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) {
        setIsBootstrapping(false);
        return;
      }
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
      } catch {
        setToken(null);
      } finally {
        setIsBootstrapping(false);
      }
    })();
  }, []);

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

export default App;