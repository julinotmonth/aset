import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, ImagePlus, User as UserIcon, Mail, Briefcase, ShieldCheck, MapPin, KeyRound, Eye, EyeOff, Dices, Copy, Check, Loader2 } from 'lucide-react';
import type { AppUser, SiteFilter, UserRole } from '../../types';
import { getSites, useSitesRefresh } from '../../data/siteStore';
import { labelPenuh } from './siteLabel';
import { buatPasswordAcak, cekPassword, kekuatanPassword, salinTeks } from '../../lib/password';
import './formModal.css';

interface UserFormModalProps {
  isOpen: boolean;
  /** 'admin' = Super Admin managing any account (full fields).
   *  'self'  = the logged-in user editing their own profile (name/photo/position only). */
  mode: 'admin' | 'self';
  userToEdit: AppUser | null;
  /** Password yang tersimpan untuk akun yang sedang diedit (null = belum tersimpan). Hanya mode 'admin'. */
  currentPassword?: string | null;
  /** True selama permintaan simpan berjalan — tombol dikunci agar tidak terkirim dua kali. */
  isSaving?: boolean;
  onClose: () => void;
  onSave: (data: Partial<AppUser> & { id?: string; password?: string }) => void;
}

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: 'Super Admin', label: 'Super Admin', desc: 'Akses penuh, termasuk kelola pengguna' },
  { value: 'Site Manager', label: 'Site Manager', desc: 'Kelola inventaris di site yang ditugaskan' },
  { value: 'Maintenance Engineer', label: 'Maintenance Engineer', desc: 'Fokus servis & maintenance' },
];

export const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, mode, userToEdit, currentPassword, isSaving, onClose, onSave }) => {
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
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(true);
  const [pwCopied, setPwCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Akun baru: kolom kosong & terlihat. Edit: terisi password tersimpan (bila ada) & disembunyikan.
      setPassword(userToEdit ? (currentPassword ?? '') : '');
      setShowPw(!userToEdit);
      setPwCopied(false);
      setName(userToEdit?.name ?? '');
      setEmail(userToEdit?.email ?? '');
      setPosition(userToEdit?.position ?? '');
      setRole(userToEdit?.role ?? 'Site Manager');
      setAssignedSite(userToEdit?.assignedSite ?? 'global');
      setAvatarUrl(userToEdit?.avatarUrl);
      setImageError('');
      setFormError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentPassword ditangani efek terpisah di bawah
  }, [isOpen, userToEdit]);

  // Daftar password bisa selesai dimuat setelah modal terbuka — isi kolom bila pengguna belum mengetik apa pun.
  useEffect(() => {
    if (isOpen && userToEdit && currentPassword) setPassword((p) => p || currentPassword);
  }, [isOpen, userToEdit, currentPassword]);

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
    if (mode === 'admin') {
      const wajib = !userToEdit; // akun baru wajib punya password; saat edit boleh dikosongkan (= tidak diubah)
      if (wajib && !password) { setFormError('Password wajib diisi (atau klik "Buat acak").'); return; }
      if (password) {
        const salah = cekPassword(password);
        if (salah) { setFormError(salah); return; }
      }
    }
    // Saat edit, kirim password hanya bila benar-benar berubah dari yang tersimpan.
    const kirimPassword = mode === 'admin' && password && password !== (userToEdit ? currentPassword ?? '' : '') ? password : undefined;
    onSave({
      id: userToEdit?.id,
      name: name.trim(),
      email: email.trim(),
      position: position.trim() || (mode === 'admin' ? role : undefined) || 'Anggota Tim',
      role,
      assignedSite,
      avatarUrl,
      ...(kirimPassword ? { password: kirimPassword } : {}),
    });
  };

  const kekuatan = kekuatanPassword(password);
  const salinPassword = async () => {
    if (!password) return;
    if (await salinTeks(password)) {
      setPwCopied(true);
      setTimeout(() => setPwCopied(false), 1800);
    }
  };
  const buatAcak = () => {
    setPassword(buatPasswordAcak(12));
    setShowPw(true);
    setFormError('');
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
                  <label className="fm-label" htmlFor="fm-password">Password</label>
                  <div className="fm-inputwrap">
                    <KeyRound size={15} />
                    <input
                      id="fm-password"
                      className="fm-input fm-input-pw"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setFormError(''); }}
                      placeholder={userToEdit ? (currentPassword ? '' : 'Kosongkan bila tidak diubah') : 'Ketik password, atau klik "Buat acak"'}
                      autoComplete="new-password"
                      spellCheck={false}
                      autoCapitalize="off"
                      aria-describedby="fm-pw-hint"
                    />
                    <div className="fm-pw-actions">
                      <button type="button" className="fm-iconbtn" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'} title={showPw ? 'Sembunyikan' : 'Tampilkan'}>
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button type="button" className="fm-iconbtn" onClick={salinPassword} disabled={!password} aria-label="Salin password" title="Salin">
                        {pwCopied ? <Check size={16} color="#00D084" /> : <Copy size={16} />}
                      </button>
                      <button type="button" className="fm-iconbtn" onClick={buatAcak} aria-label="Buat password acak" title="Buat acak">
                        <Dices size={16} />
                      </button>
                    </div>
                  </div>
                  {password && (
                    <div className="fm-meter" aria-live="polite">
                      <div className="fm-meter-bars" aria-hidden="true">
                        {[1, 2, 3, 4].map((n) => <span key={n} style={{ background: n <= kekuatan.skor ? kekuatan.warna : undefined }} />)}
                      </div>
                      <span style={{ color: kekuatan.warna }}>{kekuatan.label}</span>
                      <span className="fm-meter-len">{password.length} karakter</span>
                    </div>
                  )}
                  <p className="fm-hint" id="fm-pw-hint">
                    {userToEdit
                      ? (currentPassword
                          ? 'Password saat ini ditampilkan di atas. Ubah isinya untuk menggantinya.'
                          : 'Password lama belum tersimpan. Isi untuk mengatur password baru; kosongkan bila tidak ingin mengubah.')
                      : 'Minimal 6 karakter. Password ini juga tampil di daftar Kelola Pengguna agar mudah dibagikan.'}
                  </p>
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
            <button type="submit" className="btn-primary" disabled={isSaving} aria-busy={isSaving || undefined}>
              {isSaving ? <Loader2 size={16} className="fm-spin" /> : <Save size={16} />}
              {isSaving ? 'Menyimpan…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};