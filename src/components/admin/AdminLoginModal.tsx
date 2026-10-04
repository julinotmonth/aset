import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, Mail, ArrowRight, Loader2, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import type { AuthState } from '../../types';
import { api, setToken } from '../../lib/api';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (auth: AuthState) => void;
}

interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    position: string;
    role: AuthState['role'];
    assignedSite: AuthState['assignedSite'];
    avatarUrl?: string;
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  // Sengaja dikosongkan: tidak ada kredensial bawaan di bundle frontend.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // Fokus ke email saat dibuka, tutup dengan Esc, dan kunci scroll halaman.
  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => emailRef.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isLoading) onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const emailInvalid = touched.email && !EMAIL_RE.test(email.trim());
  const passwordInvalid = touched.password && password.length === 0;

  const fail = (msg: string) => {
    setError(msg);
    setShake(true);
    window.setTimeout(() => setShake(false), 450);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!EMAIL_RE.test(email.trim()) || !password) {
      fail('Lengkapi email yang valid dan kata sandi Anda.');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const { token, user } = await api.post<LoginResponse>('/auth/login', { email: email.trim(), password });
      setToken(token);
      onLoginSuccess({
        isAuthenticated: true,
        userId: user.id,
        username: user.name,
        role: user.role,
        assignedSite: user.assignedSite,
        avatarUrl: user.avatarUrl,
        position: user.position,
      });
      onClose();
    } catch (err) {
      setPassword('');
      // Password sengaja dikosongkan setelah gagal; jangan tampilkan "wajib diisi" di atas pesan error asli.
      setTouched((t) => ({ ...t, password: false }));
      fail(err instanceof Error ? err.message : 'Gagal login. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div
      className="admin-modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !isLoading) onClose(); }}
    >
      <div
        className={`glass-panel admin-modal-panel login-panel${shake ? ' login-shake' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        style={{ maxWidth: '440px', boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,208,132,0.08)' }}
      >
        <button type="button" onClick={onClose} className="login-close" aria-label="Tutup">
          <X size={18} />
        </button>

        <div className="login-brand">
          <img src="/assets/images/logo-white.webp" alt="Reethau Clean Energy" className="login-logo" />
          <div className="login-divider" aria-hidden="true" />
          <h2 id="login-title" className="login-title">Portal Admin</h2>
          <p className="login-subtitle">Manajemen Inventaris &amp; Aset Multi-Site</p>
        </div>

        <div className={`login-error${error ? ' show' : ''}`} role="alert" aria-live="assertive">
          {error && (
            <>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} noValidate className="login-form">
          <div>
            <label htmlFor="login-email" className="login-label">Email</label>
            <div className={`login-field${emailInvalid ? ' invalid' : ''}`}>
              <Mail size={18} className="login-field-icon" />
              <input
                id="login-email"
                ref={emailRef}
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                placeholder="nama@perusahaan.com"
                aria-invalid={emailInvalid}
                disabled={isLoading}
              />
            </div>
            {emailInvalid && <p className="login-hint-error">Format email belum benar.</p>}
          </div>

          <div>
            <label htmlFor="login-password" className="login-label">Kata Sandi</label>
            <div className={`login-field${passwordInvalid ? ' invalid' : ''}`}>
              <Lock size={18} className="login-field-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                onKeyUp={(e) => setCapsLock(e.getModifierState?.('CapsLock') ?? false)}
                placeholder="Masukkan kata sandi"
                aria-invalid={passwordInvalid}
                disabled={isLoading}
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {capsLock && <p className="login-hint-warn">Caps Lock sedang aktif.</p>}
            {passwordInvalid && <p className="login-hint-error">Kata sandi wajib diisi.</p>}
          </div>

          <button type="submit" className="btn-primary login-submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 size={18} className="spin-icon" />
                Memeriksa akun...
              </>
            ) : (
              <>
                Masuk ke Dashboard
                <ArrowRight size={18} className="login-arrow" />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <ShieldCheck size={14} />
          <span>Akses khusus karyawan Reethau. Aktivitas login dicatat.</span>
        </div>
      </div>
    </div>,
    document.body
  );
};