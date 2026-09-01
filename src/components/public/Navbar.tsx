import React, { useState, useEffect } from 'react';
import { ShieldCheck, Menu, X, LogIn, Zap } from 'lucide-react';
import type { Language } from '../../types';

interface NavbarProps {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenAdminLogin: () => void;
  isAuthenticated: boolean;
  onOpenAdminDashboard: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  lang, onLanguageChange, onOpenAdminLogin, isAuthenticated, onOpenAdminDashboard,
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeLink, setActiveLink] = useState('beranda');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on link click
  const handleNavClick = (id: string) => {
    setActiveLink(id);
    setMobileMenuOpen(false);
  };

  const c = {
    IDN: {
      beranda: 'Beranda', tentang: 'Tentang Kami', produk: 'Produk & Energi', kontak: 'Kontak',
      adminPortal: 'Portal Admin', dashboard: 'Buka Dashboard',
    },
    ENG: {
      beranda: 'Home', tentang: 'About Us', produk: 'Products', kontak: 'Contact',
      adminPortal: 'Admin Portal', dashboard: 'Open Dashboard',
    },
  }[lang];

  const navLinks = [
    { id: 'beranda', label: c.beranda },
    { id: 'tentang', label: c.tentang },
    { id: 'produk', label: c.produk },
    { id: 'kontak', label: c.kontak },
  ];

  const navLinkStyle = (id: string): React.CSSProperties => ({
    color: activeLink === id ? '#00D084' : '#94A3B8',
    textDecoration: 'none',
    fontWeight: activeLink === id ? 700 : 500,
    fontSize: '0.875rem',
    position: 'relative',
    paddingBottom: '4px',
    transition: 'color 200ms ease',
  });

  return (
    <>
      <header className="navbar-header" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        transition: 'all 280ms var(--ease-out-expo)',
        background: scrolled
          ? 'rgba(7, 12, 24, 0.95)'
          : 'linear-gradient(to bottom, rgba(7,12,24,0.85) 0%, transparent 100%)',
        backdropFilter: scrolled ? 'blur(20px) saturate(150%)' : 'blur(4px)',
        WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(150%)' : 'blur(4px)',
        borderBottom: scrolled ? '1px solid rgba(0,208,132,0.2)' : '1px solid transparent',
        padding: scrolled ? '0.7rem 2rem' : '1.15rem 2rem',
        boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.4)' : 'none',
      }}>
        <div className="navbar-inner" style={{
          maxWidth: '1320px', margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <a href="#" className="navbar-logo-link" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', minWidth: 0, flexShrink: 0 }}>
            <img
              src="/assets/images/logo-white.webp"
              alt="PT Reethau Clean Energy Logo"
              className="navbar-logo-img"
              style={{
                height: scrolled ? '40px' : '48px',
                objectFit: 'contain',
                transition: 'height 280ms var(--ease-out-expo)',
                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
              }}
            />
          </a>

          {/* Desktop Nav */}
          <nav className="desktop-nav" style={{ alignItems: 'center', gap: '2rem' }}>
            {navLinks.map(link => (
              <a
                key={link.id}
                href={`#${link.id}`}
                style={navLinkStyle(link.id)}
                onClick={() => handleNavClick(link.id)}
                onMouseEnter={e => { if (activeLink !== link.id) e.currentTarget.style.color = '#FFFFFF'; }}
                onMouseLeave={e => { if (activeLink !== link.id) e.currentTarget.style.color = '#94A3B8'; }}
              >
                {link.label}
                {activeLink === link.id && (
                  <span style={{
                    position: 'absolute', bottom: '-1px', left: 0, right: 0,
                    height: '2px',
                    background: '#00D084',
                    borderRadius: '1px',
                    boxShadow: '0 0 8px rgba(0,208,132,0.8)',
                  }} />
                )}
              </a>
            ))}
          </nav>

          {/* Right Controls */}
          <div className="navbar-right-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0 }}>
            {/* Lang Switcher */}
            <div className="navbar-lang-switcher" style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.05)',
              padding: '3px',
              borderRadius: '9999px',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              {(['ENG', 'IDN'] as Language[]).map(l => (
                <button
                  key={l}
                  onClick={() => onLanguageChange(l)}
                  style={{
                    background: lang === l ? '#00D084' : 'transparent',
                    color: lang === l ? '#060C18' : '#94A3B8',
                    border: 'none',
                    padding: '4px 13px',
                    borderRadius: '9999px',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 200ms ease',
                    fontFamily: 'var(--font-main)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Admin Button */}
            {isAuthenticated ? (
              <button
                onClick={onOpenAdminDashboard}
                className="btn-primary navbar-admin-btn"
                style={{ padding: '0.55rem 1.2rem', fontSize: '0.78rem' }}
              >
                <ShieldCheck size={15} />
                {c.dashboard}
              </button>
            ) : (
              <button
                onClick={onOpenAdminLogin}
                className="navbar-admin-btn"
                style={{
                  background: 'rgba(0,208,132,0.1)',
                  color: '#00D084',
                  border: '1px solid rgba(0,208,132,0.35)',
                  padding: '0.55rem 1.2rem',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  transition: 'all 220ms ease',
                  fontFamily: 'var(--font-main)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#00D084';
                  e.currentTarget.style.color = '#060C18';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(0,208,132,0.4)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(0,208,132,0.1)';
                  e.currentTarget.style.color = '#00D084';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <LogIn size={14} />
                {c.adminPortal}
              </button>
            )}

            {/* Mobile Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mobile-toggle"
              aria-label="Toggle Navigation"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#FFFFFF',
                width: '38px', height: '38px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          {navLinks.map(link => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={() => handleNavClick(link.id)}
              style={{
                color: activeLink === link.id ? '#00D084' : '#CBD5E1',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '1.05rem',
                padding: '0.75rem 0',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {link.label}
            </a>
          ))}
          <button
            onClick={() => {
              if (isAuthenticated) { onOpenAdminDashboard(); } else { onOpenAdminLogin(); }
              setMobileMenuOpen(false);
            }}
            style={{
              marginTop: '1rem',
              background: '#00D084',
              color: '#060C18',
              border: 'none',
              borderRadius: '9999px',
              padding: '0.75rem 1.5rem',
              fontWeight: 800,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontFamily: 'var(--font-main)',
            }}
          >
            <Zap size={16} />
            {isAuthenticated ? c.dashboard : 'Portal Admin Inventory'}
          </button>
        </div>
      )}
    </>
  );
};
