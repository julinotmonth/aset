import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, Images, Plus, Save, Check } from 'lucide-react';
import type { SiteMeta } from '../../data/siteStore';
import './formModal.css';

const COLOR_CHOICES = ['#00D084', '#60A5FA', '#FBBF24', '#C084FC', '#F472B6', '#38BDF8', '#A3E635', '#F87171'];

interface SiteFormModalProps {
  isOpen: boolean;
  siteToEdit: SiteMeta | null;
  onClose: () => void;
  onSave: (data: { label: string; subtitle: string; color: string; imageUrl?: string }) => void;
}

export const SiteFormModal: React.FC<SiteFormModalProps> = ({ isOpen, siteToEdit, onClose, onSave }) => {
  const [label, setLabel] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [imageError, setImageError] = useState('');
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLabel(siteToEdit?.label ?? '');
      setSubtitle(siteToEdit?.subtitle ?? '');
      setColor(siteToEdit?.color ?? COLOR_CHOICES[0]);
      setImageUrl(siteToEdit?.imageUrl);
      setImageError('');
      setFormError('');
    }
  }, [isOpen, siteToEdit]);

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

  const handleImageSelect = (file: File | undefined) => {
    setImageError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('File harus berupa gambar.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setImageError('Ukuran foto maksimal 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.onerror = () => setImageError('Gagal membaca file gambar.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setFormError('Nama site wajib diisi.');
      return;
    }
    onSave({ label: label.trim(), subtitle: subtitle.trim(), color, imageUrl });
  };

  const judul = siteToEdit ? 'Edit Site' : 'Tambah Site Operasional';

  return createPortal(
    <div className="fm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-panel fm-panel fm-sm" role="dialog" aria-modal="true" aria-label={judul}>
        <div className="fm-head">
          <div className="fm-head-ico"><MapPin size={22} color="#00D084" /></div>
          <div style={{ minWidth: 0 }}>
            <h3 className="fm-title">{judul}</h3>
            <div className="fm-sub">{siteToEdit ? 'Perbarui detail site ini' : 'Site baru langsung tersedia di semua form & filter'}</div>
          </div>
          <button type="button" className="fm-close" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>

        <form className="fm-form" onSubmit={handleSubmit}>
          <div className="fm-body">
            {formError && <div className="fm-error" role="alert">{formError}</div>}

            <div>
              <div className="fm-banner">
                {imageUrl && <img src={imageUrl} alt="" />}
                {imageUrl && <div className="fm-banner-shade" />}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => handleImageSelect(e.target.files?.[0])} style={{ display: 'none' }} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-chip" style={{ fontSize: '0.78rem' }}>
                  <Images size={14} />
                  {imageUrl ? 'Ganti Foto' : 'Unggah Foto Site'}
                </button>
              </div>
              {imageError && <div className="fm-field-error" style={{ marginTop: '0.4rem' }}>{imageError}</div>}
            </div>

            <div>
              <label className="fm-label" htmlFor="fm-site-nama">Nama Site</label>
              <input id="fm-site-nama" className="fm-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="mis. RET Jepara" autoFocus />
              <p className="fm-hint">Nama ditampilkan persis seperti yang Anda ketik.</p>
            </div>

            <div>
              <label className="fm-label" htmlFor="fm-site-desk">Deskripsi Singkat</label>
              <input id="fm-site-desk" className="fm-input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="mis. Regional Distribution Hub" />
            </div>

            <div>
              <span className="fm-label">Warna Aksen</span>
              <div className="fm-swatches" role="group" aria-label="Warna aksen">
                {COLOR_CHOICES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`fm-sw${color === c ? ' is-on' : ''}`}
                    style={{ background: c, ['--sw' as string]: c }}
                    aria-label={`Warna ${c}`}
                    aria-pressed={color === c}
                    onClick={() => setColor(c)}
                  >
                    {color === c && <Check size={16} strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="fm-foot">
            <button type="submit" className="btn-primary">
              {siteToEdit ? <Save size={16} /> : <Plus size={16} />}
              {siteToEdit ? 'Simpan Perubahan' : 'Tambah Site'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};