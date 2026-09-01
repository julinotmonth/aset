import React, { useState } from 'react';
import { Edit2, ArrowRightLeft, Trash2, AlertTriangle, QrCode } from 'lucide-react';
import type { SparePart } from '../../types';
import { getCategoryVisual } from '../../data/categoryVisuals';
import { QRCodeModal } from './QRCodeModal';
import { BarcodeMini } from './BarcodeMini';

interface SparePartTableProps {
  spareParts: SparePart[];
  onEdit: (item: SparePart) => void;
  onTransfer: (item: SparePart) => void;
  onDelete: (id: string) => void;
}

export const SparePartTable: React.FC<SparePartTableProps> = ({ spareParts, onEdit, onTransfer, onDelete }) => {
  const [qrItem, setQrItem] = useState<SparePart | null>(null);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const getStatusBadge = (status: SparePart['status']) => {
    switch (status) {
      case 'In Stock':
        return <span className="badge-in-stock spare-badge">In Stock</span>;
      case 'Low Stock':
        return <span className="badge-low-stock spare-badge">Low Stock</span>;
      case 'Critical':
        return <span className="badge-critical spare-badge">Critical</span>;
      case 'Maintenance Needed':
        return <span className="badge-maintenance spare-badge">Maintenance</span>;
    }
  };

  if (spareParts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748B' }}>
        <AlertTriangle size={40} color="#F59E0B" style={{ marginBottom: '1rem' }} />
        <h4 style={{ color: 'var(--txt-primary)', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Tidak Ada Spare Part Ditemukan</h4>
        <p style={{ fontSize: '0.85rem' }}>Coba ubah kata kunci pencarian, filter kategori, atau lokasi site.</p>
      </div>
    );
  }

  return (
    <div className="spare-table">
      <div className="spare-thead" role="row">
        <div>Kode / SKU</div>
        <div>Spare Part</div>
        <div>Kategori &amp; Produk</div>
        <div>Lokasi Site</div>
        <div>Stok / Min</div>
        <div>Status</div>
        <div>Estimasi Harga</div>
        <div style={{ textAlign: 'right' }}>Aksi</div>
      </div>

      {spareParts.map((item) => {
        const visual = getCategoryVisual(item.category);
        const Icon = visual.icon;
        return (
          <div className="spare-row" role="row" key={item.id}>
            <div className="spare-cell cell-code" data-label="Kode / SKU">
              <div className="spare-code-wrap">
                <span className="spare-sku-text">{item.sku}</span>
                <BarcodeMini value={item.sku} />
              </div>
            </div>

            <div className="spare-cell cell-part" data-label="Spare Part">
              <div className="spare-part-info">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="spare-thumb-photo" loading="lazy" />
                ) : (
                  <div
                    className="spare-thumb-icon"
                    style={{ background: visual.bg, border: `1px solid ${visual.color}33` }}
                  >
                    <Icon size={22} color={visual.color} strokeWidth={1.75} />
                  </div>
                )}
                <div className="spare-part-text">
                  <div className="spare-part-name">{item.name}</div>
                  <div className="spare-part-spec">{item.specifications}</div>
                </div>
              </div>
            </div>

            <div className="spare-cell" data-label="Kategori & Produk">
              <div className="spare-category-name">{item.category}</div>
              <div
                className="spare-energy-tag"
                style={{ color: item.productEnergy === 'CNG' ? '#38BDF8' : item.productEnergy === 'LNG' ? '#F472B6' : '#A3E635' }}
              >
                {item.productEnergy} Line
              </div>
            </div>

            <div className="spare-cell" data-label="Lokasi Site">
              <span className="spare-site-tag">Site {item.site}</span>
            </div>

            <div className="spare-cell" data-label="Stok / Min">
              <div className="spare-stock-value" style={{ color: item.stock <= item.minStock ? '#F87171' : 'var(--txt-primary)' }}>
                {item.stock} <span className="spare-stock-unit">{item.unit}</span>
              </div>
              <div className="spare-stock-min">Min: {item.minStock}</div>
            </div>

            <div className="spare-cell" data-label="Status">{getStatusBadge(item.status)}</div>

            <div className="spare-cell cell-price" data-label="Estimasi Harga">
              {formatIDR(item.priceEstimate)}
            </div>

            <div className="spare-cell cell-actions" data-label="Aksi">
              <div className="spare-actions">
                <button onClick={() => setQrItem(item)} title="Buat QR Code Aset" className="spare-action-btn action-qr">
                  <QrCode size={16} />
                </button>
                <button onClick={() => onTransfer(item)} title="Transfer Antar Site" className="spare-action-btn action-transfer">
                  <ArrowRightLeft size={16} />
                </button>
                <button onClick={() => onEdit(item)} title="Edit Spare Part" className="spare-action-btn action-edit">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => onDelete(item.id)} title="Hapus" className="spare-action-btn action-delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {qrItem && (
        <QRCodeModal
          isOpen={!!qrItem}
          onClose={() => setQrItem(null)}
          title={qrItem.name}
          subtitle={qrItem.sku}
          value={`https://inventory.reethau.id/asset/${qrItem.sku}`}
          fileName={`reethau-asset-${qrItem.sku}`}
          barcodeValue={qrItem.sku}
          metaLines={[
            { label: 'Kategori', value: qrItem.category },
            { label: 'Site', value: `Site ${qrItem.site.charAt(0).toUpperCase()}${qrItem.site.slice(1)}` },
            { label: 'Stok', value: `${qrItem.stock} ${qrItem.unit}` },
          ]}
        />
      )}
    </div>
  );
};