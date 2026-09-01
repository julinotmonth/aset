import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, ImagePlus, User as UserIcon, Mail, Briefcase, ShieldCheck, MapPin } from 'lucide-react';
import type { AppUser, SiteFilter, UserRole } from '../../types';

interface UserFormModalProps {
  isOpen: boolean;
  /** 'admin' = Super Admin managing any account (full fields).
   *  'self'  = the logged-in user editing their own profile (name/photo/position only). */
  mode: 'admin' | 'self';
  userToEdit: AppUser | null;
  onClose: () => void;
  onSave: (data: Partial<AppUser> & { id?: string }) => void;
}

const SITE_OPTIONS: { value: SiteFilter; label: string }[] = [
  { value: 'global', label: 'Semua Site (Global)' },
  { value: 'bekasi', label: 'Site Bekasi' },
  { value: 'indramayu', label: 'Site Indramayu' },
  { value: 'blora', label: 'Site Blora' },
  { value: 'setu', label: 'Site Setu' },
];

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: 'Super Admin', label: 'Super Admin', desc: 'Akses penuh, termasuk kelola pengguna' },
  { value: 'Site Manager', label: 'Site Manager', desc: 'Kelola inventaris di site yang ditugaskan' },
  { value: 'Maintenance Engineer', label: 'Maintenance Engineer', desc: 'Fokus servis & maintenance' },
];

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', color: 'var(--txt-muted)', marginBottom: '0.4rem', fontWeight: 600 };
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-root)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '8px',
  padding: '0.65rem 0.85rem',
  color: 'var(--txt-primary)',
  outline: 'none',
  fontSize: '0.88rem',
};

export const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, mode, userToEdit, onClose, onSave }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');
  const [role, setRole] = useState<UserRole>('Site Manager');
  const [assignedSite, setAssignedSite] = useState<SiteFilter>('global');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [imageError, setImageError] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(userToEdit?.name ?? '');
      setEmail(userToEdit?.email ?? '');
      setPosition(userToEdit?.position ?? '');
      setRole(userToEdit?.role ?? 'Site Manager');
      setAssignedSite(userToEdit?.assignedSite ?? 'global');
      setAvatarUrl(userToEdit?.avatarUrl);
      setImageError('');
      setFormError('');
    }
  }, [isOpen, userToEdit]);

  if (!isOpen) return null;

  const handleImageSelect = (file: File | undefined) => {
    setImageError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('File harus berupa gambar (JPG, PNG, WebP).');
      return;
    }
    const MAX_SIZE = 3 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setImageError('Ukuran foto maksimal 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result as string);
    reader.onerror = () => setImageError('Gagal membaca file gambar.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Nama wajib diisi.');
      return;
    }
    if (mode === 'admin' && !email.trim()) {
      setFormError('Email wajib diisi.');
      return;
    }

    onSave({
      id: userToEdit?.id,
      name: name.trim(),
      email: email.trim(),
      position: position.trim() || (mode === 'admin' ? role : undefined) || 'Anggota Tim',
      role,
      assignedSite,
      avatarUrl,
    });
  };

  const initials = name
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

  return createPortal(
    <div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-panel admin-modal-panel" style={{ maxWidth: '480px' }}>
        <button onClick={onClose} className="admin-modal-close-btn">
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', paddingRight: '2.5rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(0,208,132,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <UserIcon size={22} color="#00D084" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--txt-primary)' }}>
              {mode === 'self' ? 'Profil Saya' : userToEdit ? 'Edit Pengguna' : 'Tambah Pengguna'}
            </h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--txt-muted)' }}>
              {mode === 'self' ? 'Perbarui nama, foto, dan jabatan Anda' : 'Kelola akun tim yang bisa mengakses portal ini'}
            </div>
          </div>
        </div>

        {formError && (
          <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1.1rem' }}>
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageSelect(e.target.files?.[0])}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                background: 'rgba(0,208,132,0.15)', border: '2px solid var(--bg-surface)', boxShadow: '0 0 0 1px var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Foto profil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#00D084' }}>{initials}</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-chip"
                  style={{ fontSize: '0.78rem' }}
                >
                  <ImagePlus size={14} />
                  {avatarUrl ? 'Ganti Foto' : 'Unggah Foto'}
                </button>
                {imageError && <div style={{ fontSize: '0.72rem', color: '#F87171' }}>{imageError}</div>}
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Nama Lengkap</label>
            <div style={{ position: 'relative' }}>
              <UserIcon size={15} color="var(--txt-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, paddingLeft: '2.4rem' }} placeholder="mis. Hendra Gunawan" />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Jabatan</label>
            <div style={{ position: 'relative' }}>
              <Briefcase size={15} color="var(--txt-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input value={position} onChange={(e) => setPosition(e.target.value)} style={{ ...inputStyle, paddingLeft: '2.4rem' }} placeholder="mis. Site Manager Bekasi" />
            </div>
          </div>

          {mode === 'admin' && (
            <>
              <div>
                <label style={labelStyle}>Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} color="var(--txt-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, paddingLeft: '2.4rem' }} placeholder="nama@reethau.com" disabled={!!userToEdit} />
                </div>
                {userToEdit && <p style={{ fontSize: '0.7rem', color: 'var(--txt-muted)', marginTop: '0.3rem' }}>Email tidak bisa diubah setelah akun dibuat.</p>}
              </div>

              <div>
                <label style={labelStyle}>Level Akses (Role)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {ROLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRole(opt.value)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '0.6rem', textAlign: 'left',
                        padding: '0.6rem 0.75rem', borderRadius: '10px', cursor: 'pointer',
                        background: role === opt.value ? 'rgba(0,208,132,0.1)' : 'var(--bg-root)',
                        border: `1px solid ${role === opt.value ? 'rgba(0,208,132,0.45)' : 'var(--border-subtle)'}`,
                      }}
                    >
                      <ShieldCheck size={16} color={role === opt.value ? '#00D084' : 'var(--txt-muted)'} style={{ marginTop: '1px', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: role === opt.value ? '#00D084' : 'var(--txt-primary)' }}>{opt.label}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--txt-muted)' }}>{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Site yang Ditugaskan</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={15} color="var(--txt-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <select value={assignedSite} onChange={(e) => setAssignedSite(e.target.value as SiteFilter)} style={{ ...inputStyle, paddingLeft: '2.4rem', cursor: 'pointer' }}>
                    {SITE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          <button type="submit" className="btn-primary" style={{ justifyContent: 'center', marginTop: '0.25rem' }}>
            <Save size={16} />
            {mode === 'self' ? 'Simpan Profil' : userToEdit ? 'Simpan Perubahan' : 'Tambah Pengguna'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
};