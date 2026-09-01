import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRightLeft, Send } from 'lucide-react';
import type { SparePart, SiteLocation } from '../../types';
import { getSites, getSiteMeta } from '../../data/siteStore';

interface TransferModalProps {
  isOpen: boolean;
  item: SparePart | null;
  onClose: () => void;
  onConfirmTransfer: (item: SparePart, quantity: number, targetSite: SiteLocation) => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({ isOpen, item, onClose, onConfirmTransfer }) => {
  const [quantity, setQuantity] = useState(1);
  const [targetSite, setTargetSite] = useState<SiteLocation>('');
  const [error, setError] = useState('');

  const sitesList = getSites().map((s) => ({ id: s.key, name: `Site ${s.label} (${s.subtitle})` }));

  useEffect(() => {
    if (isOpen && item) {
      setQuantity(1);
      setError('');
      const firstOther = sitesList.find((s) => s.id !== item.site);
      setTargetSite(firstOther?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, item?.id]);

  if (!isOpen || !item) return null;

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetSite === item.site) {
      setError('Lokasi site tujuan harus berbeda dari lokasi asal saat ini.');
      return;
    }
    if (quantity <= 0 || quantity > item.stock) {
      setError(`Jumlah transfer harus antara 1 dan stok maksimum (${item.stock}).`);
      return;
    }

    onConfirmTransfer(item, quantity, targetSite);
    onClose();
  };

  return createPortal(
    <div className="admin-modal-overlay" style={{ zIndex: 110 }}>
      <div
        className="glass-panel admin-modal-panel"
        style={{
          maxWidth: '500px',
          border: '1px solid rgba(0, 208, 132, 0.4)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'var(--chip-bg)',
            border: 'none',
            color: 'var(--txt-tertiary)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', paddingRight: '2.75rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(0, 208, 132, 0.15)',
              color: '#00D084',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ArrowRightLeft size={24} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--txt-primary)' }}>Transfer Spare Part Antar Site</h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--txt-muted)' }}>Modul Distribusi Logistik Reethau</div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-root)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#00D084', fontWeight: 700 }}>SKU: {item.sku}</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--txt-primary)', marginTop: '0.2rem' }}>{item.name}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--txt-tertiary)' }}>
            <span>Asal: <strong style={{ color: 'var(--txt-primary)' }}>Site {getSiteMeta(item.site).label}</strong></span>
            <span>Stok Tersedia: <strong style={{ color: '#00D084' }}>{item.stock} {item.unit}</strong></span>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#FCA5A5', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--txt-tertiary)', marginBottom: '0.4rem', fontWeight: 600 }}>
              Pilih Site Tujuan
            </label>
            <select
              value={targetSite}
              onChange={(e) => setTargetSite(e.target.value as SiteLocation)}
              style={{
                width: '100%',
                background: 'var(--bg-root)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                color: 'var(--txt-primary)',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            >
              {sitesList.map((s) => (
                <option key={s.id} value={s.id} disabled={s.id === item.site}>
                  {s.name} {s.id === item.site ? '(Asal Saat Ini)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--txt-tertiary)', marginBottom: '0.4rem', fontWeight: 600 }}>
              Jumlah Unit Transfer ({item.unit})
            </label>
            <input
              type="number"
              min={1}
              max={item.stock}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              style={{
                width: '100%',
                background: 'var(--bg-root)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                color: 'var(--txt-primary)',
                fontSize: '1rem',
                fontWeight: 700,
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '0.85rem',
              marginTop: '0.5rem',
            }}
          >
            <Send size={18} />
            Konfirmasi Transfer Spare Part
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
};