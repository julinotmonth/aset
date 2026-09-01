import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, PlusCircle, ImagePlus, ImageOff, Check } from 'lucide-react';
import type { SparePart, SparePartCategory, ProductEnergyCategory, SiteLocation } from '../../types';
import {
  getSparePartCategories,
  getProductEnergyCategories,
  addSparePartCategory,
  addProductEnergyCategory,
} from '../../data/categoryStore';
import { getSites, useSitesRefresh } from '../../data/siteStore';

interface AddEditSparePartModalProps {
  isOpen: boolean;
  itemToEdit: SparePart | null;
  onClose: () => void;
  onSave: (part: Partial<SparePart>) => void;
}

const ADD_NEW_VALUE = '__add_new_category__';

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-root)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '8px',
  padding: '0.65rem 0.85rem',
  color: 'var(--txt-primary)',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  color: 'var(--txt-tertiary)',
  marginBottom: '0.3rem',
  fontWeight: 600,
};

/**
 * A <select> that always offers a "+ Tambah kategori baru" option. Picking it swaps
 * in a small inline text field so the user can type and confirm a brand-new category,
 * which is then persisted (via onAddCategory) and immediately selected.
 */
const CategorySelect: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onAddCategory: (value: string) => void;
  labelFor?: (value: string) => string;
}> = ({ label, value, options, onChange, onAddCategory, labelFor }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) inputRef.current?.focus();
  }, [isAdding]);

  const confirmAdd = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setIsAdding(false);
      return;
    }
    onAddCategory(trimmed);
    onChange(trimmed);
    setDraft('');
    setIsAdding(false);
  };

  const cancelAdd = () => {
    setDraft('');
    setIsAdding(false);
  };

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {isAdding ? (
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            placeholder="Nama kategori baru..."
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmAdd();
              } else if (e.key === 'Escape') {
                cancelAdd();
              }
            }}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'var(--bg-root)',
              border: '1px solid rgba(0, 208, 132, 0.5)',
              borderRadius: '8px',
              padding: '0.65rem 0.85rem',
              color: 'var(--txt-primary)',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={confirmAdd}
            title="Simpan kategori"
            style={{
              flexShrink: 0,
              width: '38px',
              borderRadius: '8px',
              border: 'none',
              background: '#00D084',
              color: 'var(--txt-inverse)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={18} />
          </button>
          <button
            type="button"
            onClick={cancelAdd}
            title="Batal"
            style={{
              flexShrink: 0,
              width: '38px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--chip-bg)',
              color: 'var(--txt-tertiary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === ADD_NEW_VALUE) {
              setIsAdding(true);
              return;
            }
            onChange(e.target.value);
          }}
          style={selectStyle}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {labelFor ? labelFor(opt) : opt}
            </option>
          ))}
          <option value={ADD_NEW_VALUE}>+ Tambah kategori baru...</option>
        </select>
      )}
    </div>
  );
};

export const AddEditSparePartModal: React.FC<AddEditSparePartModalProps> = ({
  isOpen,
  itemToEdit,
  onClose,
  onSave,
}) => {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<SparePartCategory>('Valves & Control');
  const [productEnergy, setProductEnergy] = useState<ProductEnergyCategory>('CNG');
  const [site, setSite] = useState<SiteLocation>('bekasi');
  const [stock, setStock] = useState(10);
  const [minStock, setMinStock] = useState(5);
  const [unit, setUnit] = useState('Units');
  const [priceEstimate, setPriceEstimate] = useState(2500000);
  const [specifications, setSpecifications] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [imageError, setImageError] = useState('');
  useSitesRefresh();

  const [sparePartCategories, setSparePartCategories] = useState<string[]>(getSparePartCategories());
  const [productEnergyCategories, setProductEnergyCategories] = useState<string[]>(getProductEnergyCategories());

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Refresh category lists each time the modal opens, in case another session added some.
    setSparePartCategories(getSparePartCategories());
    setProductEnergyCategories(getProductEnergyCategories());

    if (itemToEdit) {
      setSku(itemToEdit.sku);
      setName(itemToEdit.name);
      setCategory(itemToEdit.category);
      setProductEnergy(itemToEdit.productEnergy);
      setSite(itemToEdit.site);
      setStock(itemToEdit.stock);
      setMinStock(itemToEdit.minStock);
      setUnit(itemToEdit.unit);
      setPriceEstimate(itemToEdit.priceEstimate);
      setSpecifications(itemToEdit.specifications);
      setImageUrl(itemToEdit.imageUrl);
    } else {
      setSku(`SKU-${Math.floor(100 + Math.random() * 900)}`);
      setName('');
      setCategory('Valves & Control');
      setProductEnergy('CNG');
      setSite('bekasi');
      setStock(10);
      setMinStock(5);
      setUnit('Units');
      setPriceEstimate(2500000);
      setSpecifications('');
      setImageUrl(undefined);
    }
    setImageError('');
  }, [itemToEdit, isOpen]);

  if (!isOpen) return null;

  const handleImageSelect = (file: File | undefined) => {
    setImageError('');
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError('File harus berupa gambar (JPG, PNG, WebP).');
      return;
    }
    const MAX_SIZE = 3 * 1024 * 1024; // 3MB
    if (file.size > MAX_SIZE) {
      setImageError('Ukuran gambar maksimal 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.onerror = () => setImageError('Gagal membaca file gambar.');
    reader.readAsDataURL(file);
  };

  const handleAddSparePartCategory = async (value: string) => {
    try {
      await addSparePartCategory(value);
      setSparePartCategories(getSparePartCategories());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menambah kategori.');
    }
  };

  const handleAddProductEnergyCategory = async (value: string) => {
    try {
      await addProductEnergyCategory(value);
      setProductEnergyCategories(getProductEnergyCategories());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menambah lini produk.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sku) return;

    let status: SparePart['status'] = 'In Stock';
    if (stock <= 0) status = 'Maintenance Needed';
    else if (stock <= minStock / 2) status = 'Critical';
    else if (stock <= minStock) status = 'Low Stock';

    onSave({
      id: itemToEdit ? itemToEdit.id : undefined,
      sku,
      name,
      category,
      productEnergy,
      site,
      stock,
      minStock,
      unit,
      priceEstimate,
      status,
      lastInspected: new Date().toISOString().split('T')[0],
      specifications: specifications || 'Standar spesifikasi industri Reethau',
      imageUrl,
    });
    onClose();
  };

  return createPortal(
    <div className="admin-modal-overlay" style={{ zIndex: 110 }}>
      <div
        className="glass-panel admin-modal-panel"
        style={{
          maxWidth: '650px',
          border: '1px solid rgba(0, 208, 132, 0.4)',
          maxHeight: '90vh',
          overflowY: 'auto',
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
            {itemToEdit ? <Save size={24} /> : <PlusCircle size={24} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--txt-primary)' }}>
              {itemToEdit ? 'Edit Data Spare Part' : 'Tambah Spare Part Baru'}
            </h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--txt-muted)' }}>Katalog Inventaris Energi Bersih Reethau</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="form-grid-2">
          <div className="span-2">
            <label style={labelStyle}>Foto Spare Part</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageSelect(e.target.files?.[0])}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: 'var(--bg-root)',
                  border: '1px dashed var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {imageUrl ? (
                  <img src={imageUrl} alt="Preview spare part" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <ImageOff size={26} color="#64748B" />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: 'rgba(0, 208, 132, 0.12)',
                      border: '1px solid rgba(0, 208, 132, 0.4)',
                      color: '#00D084',
                      borderRadius: '8px',
                      padding: '0.5rem 0.85rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <ImagePlus size={16} />
                    {imageUrl ? 'Ganti Gambar' : 'Unggah Gambar'}
                  </button>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl(undefined);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      style={{
                        background: 'var(--chip-bg)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--txt-tertiary)',
                        borderRadius: '8px',
                        padding: '0.5rem 0.85rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Hapus
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--txt-muted)' }}>
                  Format JPG, PNG, atau WebP. Maksimal 3MB.
                </div>
                {imageError && <div style={{ fontSize: '0.75rem', color: '#F87171' }}>{imageError}</div>}
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Kode SKU / Serial Number</label>
            <input
              type="text"
              required
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-root)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                color: '#00D084',
                fontWeight: 700,
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={labelStyle}>Lokasi Site</label>
            <select
              value={site}
              onChange={(e) => setSite(e.target.value as SiteLocation)}
              style={selectStyle}
            >
              {getSites().map((s) => (
                <option key={s.key} value={s.key}>📍 Site {s.label} ({s.subtitle})</option>
              ))}
            </select>
          </div>

          <div className="span-2">
            <label style={labelStyle}>Nama Spare Part</label>
            <input
              type="text"
              required
              value={name}
              placeholder="Contoh: High-Pressure Ball Valve 1/2 inch"
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-root)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                color: 'var(--txt-primary)',
                fontWeight: 600,
                outline: 'none',
              }}
            />
          </div>

          <CategorySelect
            label="Kategori Spare Part"
            value={category}
            options={sparePartCategories}
            onChange={(value) => setCategory(value as SparePartCategory)}
            onAddCategory={handleAddSparePartCategory}
          />

          <CategorySelect
            label="Kategori Produk Energi"
            value={productEnergy}
            options={productEnergyCategories}
            onChange={(value) => setProductEnergy(value as ProductEnergyCategory)}
            onAddCategory={handleAddProductEnergyCategory}
            labelFor={(opt) => {
              if (opt === 'CNG') return 'CNG (Compressed Natural Gas)';
              if (opt === 'LNG') return 'LNG (Liquefied Natural Gas)';
              if (opt === 'Biomass') return 'Biomassa & Woodchip';
              return opt;
            }}
          />

          <div>
            <label style={labelStyle}>Jumlah Stok Saat Ini</label>
            <input
              type="number"
              min={0}
              value={stock}
              onChange={(e) => setStock(parseInt(e.target.value) || 0)}
              style={{
                width: '100%',
                background: 'var(--bg-root)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                color: 'var(--txt-primary)',
                fontWeight: 700,
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={labelStyle}>Batas Stok Minimum</label>
            <input
              type="number"
              min={1}
              value={minStock}
              onChange={(e) => setMinStock(parseInt(e.target.value) || 1)}
              style={{
                width: '100%',
                background: 'var(--bg-root)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                color: 'var(--txt-primary)',
                fontWeight: 700,
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={labelStyle}>Satuan Unit</label>
            <input
              type="text"
              value={unit}
              placeholder="Units / Kits / Sets / Pcs"
              onChange={(e) => setUnit(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-root)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                color: 'var(--txt-primary)',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={labelStyle}>Estimasi Harga (IDR)</label>
            <input
              type="number"
              step={100000}
              value={priceEstimate}
              onChange={(e) => setPriceEstimate(parseInt(e.target.value) || 0)}
              style={{
                width: '100%',
                background: 'var(--bg-root)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                color: 'var(--txt-primary)',
                fontWeight: 700,
                outline: 'none',
              }}
            />
          </div>

          <div className="span-2">
            <label style={labelStyle}>Spesifikasi Teknis</label>
            <textarea
              rows={3}
              value={specifications}
              placeholder="Standar tekanan, material SS316, sertifikasi ATEX, dll."
              onChange={(e) => setSpecifications(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-root)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                color: 'var(--txt-primary)',
                outline: 'none',
                resize: 'none',
              }}
            />
          </div>

          <div className="span-2" style={{ marginTop: '0.5rem' }}>
            <button
              type="submit"
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.85rem',
              }}
            >
              <Save size={18} />
              Simpan Data Spare Part
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};