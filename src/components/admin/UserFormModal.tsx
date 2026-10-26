import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, ImagePlus, User as UserIcon, Mail, Briefcase, ShieldCheck, MapPin } from 'lucide-react';
import type { AppUser, SiteFilter, UserRole } from '../../types';
import { getSites, useSitesRefresh } from '../../data/siteStore';
import { labelPenuh } from './siteLabel';
import './formModal.css';

interface UserFormModalProps {
  isOpen: boolean;
  /** 'admin' = Super Admin managing any account (full fields).
   *  'self'  = the logged-in user editing their own profile (name/photo/position only). */
  mode: 'admin' | 'self';
  userToEdit: AppUser | null;
  onClose: () => void;
  onSave: (data: Partial<AppUser> & { id?: string }) => void;
}

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: 'Super Admin', label: 'Super Admin', desc: 'Akses penuh, termasuk kelola pengguna' },
  { value: 'Site Manager', label: 'Site Manager', desc: 'Kelola inventaris di site yang ditugaskan' },
  { value: 'Maintenance Engineer', label: 'Maintenance Engineer', desc: 'Fokus servis & maintenance' },
];

export const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, mode, userToEdit, onClose, onSave }) => {
  useSitesRefresh(); // daftar site selalu ikut data terbaru (tambah/edit/hapus site)

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

  // Esc untuk menutup + kunci scroll halaman di belakang modal.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sites = getSites();
  const siteOptions: { value: SiteFilter; label: string }[] = [
    { value: 'global', label: 'Semua Site (Global)' },
    ...sites.map((s) => ({ value: s.key, label: labelPenuh(s.label) })),
  ];
  // Site yang tertaut ke akun ini tapi sudah dihapus — tetap tampil agar tidak diam-diam berubah.
  if (assignedSite !== 'global' && !sites.some((s) => s.key === assignedSite)) {
    siteOptions.push({ value: assignedSite, label: `${assignedSite} (site tidak ditemukan)` });
  }

  const handleImageSelect = (file: File | undefined) => {
    setImageError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('File harus berupa gambar (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
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

  const initials = name.trim().split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  const judul = mode === 'self' ? 'Profil Saya' : userToEdit ? 'Edit Pengguna' : 'Tambah Pengguna';
  const submitLabel = mode === 'self' ? 'Simpan Profil' : userToEdit ? 'Simpan Perubahan' : 'Tambah Pengguna';

  return createPortal(
    <div className="fm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-panel fm-panel" role="dialog" aria-modal="true" aria-label={judul}>
        <div className="fm-head">
          <div className="fm-head-ico"><UserIcon size={22} color="#00D084" /></div>
          <div style={{ minWidth: 0 }}>
            <h3 className="fm-title">{judul}</h3>
            <div className="fm-sub">
              {mode === 'self' ? 'Perbarui nama, foto, dan jabatan Anda' : 'Kelola akun tim yang bisa mengakses portal ini'}
            </div>
          </div>
          <button type="button" className="fm-close" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>

        <form className="fm-form" onSubmit={handleSubmit}>
          <div className="fm-body">
            {formError && <div className="fm-error" role="alert">{formError}</div>}

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageSelect(e.target.files?.[0])}
                style={{ display: 'none' }}
              />
              <div className="fm-avatar-row">
                <div className="fm-avatar">
                  {avatarUrl ? <img src={avatarUrl} alt="Foto profil" /> : <span>{initials}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-chip" style={{ fontSize: '0.78rem' }}>
                    <ImagePlus size={14} />
                    {avatarUrl ? 'Ganti Foto' : 'Unggah Foto'}
                  </button>
                  {imageError && <div className="fm-field-error">{imageError}</div>}
                </div>
              </div>
            </div>

            <div className="fm-grid2">
              <div>
                <label className="fm-label" htmlFor="fm-nama">Nama Lengkap</label>
                <div className="fm-inputwrap">
                  <UserIcon size={15} />
                  <input id="fm-nama" className="fm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Hendra Gunawan" autoComplete="name" />
                </div>
              </div>
              <div>
                <label className="fm-label" htmlFor="fm-jabatan">Jabatan</label>
                <div className="fm-inputwrap">
                  <Briefcase size={15} />
                  <input id="fm-jabatan" className="fm-input" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="mis. Site Manager Bekasi" />
                </div>
              </div>
            </div>

            {mode === 'admin' && (
              <>
                <div>
                  <label className="fm-label" htmlFor="fm-email">Email</label>
                  <div className="fm-inputwrap">
                    <Mail size={15} />
                    <input id="fm-email" className="fm-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@reethau.com" disabled={!!userToEdit} autoComplete="email" />
                  </div>
                  {userToEdit && <p className="fm-hint">Email tidak bisa diubah setelah akun dibuat.</p>}
                </div>

                <div>
                  <span className="fm-label">Level Akses (Role)</span>
                  <div className="fm-roles" role="group" aria-label="Level akses">
                    {ROLE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`fm-role${role === opt.value ? ' is-on' : ''}`}
                        aria-pressed={role === opt.value}
                        onClick={() => setRole(opt.value)}
                      >
                        <ShieldCheck size={16} style={{ flexShrink: 0 }} />
                        <span>
                          <span className="fm-role-name" style={{ display: 'block' }}>{opt.label}</span>
                          <span className="fm-role-desc" style={{ display: 'block' }}>{opt.desc}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="fm-label" htmlFor="fm-site">Site yang Ditugaskan</label>
                  <div className="fm-inputwrap">
                    <MapPin size={15} />
                    <select id="fm-site" className="fm-input" value={assignedSite} onChange={(e) => setAssignedSite(e.target.value)}>
                      {siteOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <p className="fm-hint">{sites.length} site tersedia — daftar ini otomatis mengikuti menu Site Operasional.</p>
                </div>
              </>
            )}
          </div>

          <div className="fm-foot">
            <button type="submit" className="btn-primary">
              <Save size={16} />
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};