import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  X,
  Save,
  Wallet,
  TrendingDown,
  Boxes,
  ShieldCheck,
  FileDown,
  BarChart3,
  PackageCheck,
  ClipboardList,
  ImagePlus,
  ImageOff,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { FixedAsset, WorkOrder, ReportsSummary, SiteLocation } from '../../types';
import { getSites } from '../../data/siteStore';
import { SITE_LABEL, PageHeader, emptyInputStyle } from './AdminExtraViews';
import { labelPenuh } from './';

const todayStr = () => new Date().toISOString().split('T')[0];

function formatCompactIDR(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
  return `Rp ${value.toLocaleString('id-ID')}`;
}

/** Triggers a client-side CSV download — no backend endpoint needed since
 * the data is already loaded in the browser. */
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  color: 'var(--txt-tertiary)',
  marginBottom: '0.3rem',
  fontWeight: 600,
};

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--txt-tertiary)', fontSize: '0.8rem', fontWeight: 700 }}>
        <span>{label}</span>
        <Icon size={18} color={color} />
      </div>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, color, marginTop: '0.5rem', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--txt-muted)', marginTop: '0.35rem' }}>{sub}</div>}
    </div>
  );
}

export function ModalShell({ title, icon: Icon, onClose, children, maxWidth = '620px' }: { title: string; icon: React.ElementType; onClose: () => void; children: React.ReactNode; maxWidth?: string }) {
  return createPortal(
    <div className="admin-modal-overlay" style={{ zIndex: 110 }}>
      <div className="glass-panel admin-modal-panel" style={{ maxWidth, border: '1px solid rgba(0, 208, 132, 0.4)', maxHeight: '90vh', overflowY: 'auto' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'var(--chip-bg)', border: 'none', color: 'var(--txt-tertiary)', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', paddingRight: '2.75rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(0, 208, 132, 0.15)', color: '#00D084', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={20} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--txt-primary)' }}>{title}</h3>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════ Fixed Asset Add/Edit Modal ══════════════════════════ */
export const FixedAssetModal: React.FC<{
  isOpen: boolean;
  itemToEdit: FixedAsset | null;
  onClose: () => void;
  onSave: (patch: Partial<FixedAsset>) => void;
}> = ({ isOpen, itemToEdit, onClose, onSave }) => {
  const sites = getSites();
  const [assetCode, setAssetCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [site, setSite] = useState<SiteLocation>(sites[0]?.key ?? '');
  const [acquisitionDate, setAcquisitionDate] = useState(todayStr());
  const [acquisitionCost, setAcquisitionCost] = useState('0');
  const [usefulLifeYears, setUsefulLifeYears] = useState('5');
  const [salvageValue, setSalvageValue] = useState('0');
  const [status, setStatus] = useState<FixedAsset['status']>('Active');
  const [serialNumber, setSerialNumber] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    if (itemToEdit) {
      setAssetCode(itemToEdit.assetCode);
      setName(itemToEdit.name);
      setCategory(itemToEdit.category);
      setSite(itemToEdit.site);
      setAcquisitionDate(itemToEdit.acquisitionDate);
      setAcquisitionCost(String(itemToEdit.acquisitionCost));
      setUsefulLifeYears(String(itemToEdit.usefulLifeYears));
      setSalvageValue(String(itemToEdit.salvageValue));
      setStatus(itemToEdit.status);
      setSerialNumber(itemToEdit.serialNumber || '');
      setWarrantyExpiry(itemToEdit.warrantyExpiry || '');
      setNotes(itemToEdit.notes || '');
      setImageUrl(itemToEdit.imageUrl);
    } else {
      setAssetCode('');
      setName('');
      setCategory('');
      setSite(sites[0]?.key ?? '');
      setAcquisitionDate(todayStr());
      setAcquisitionCost('0');
      setUsefulLifeYears('5');
      setSalvageValue('0');
      setStatus('Active');
      setSerialNumber('');
      setWarrantyExpiry('');
      setNotes('');
      setImageUrl(undefined);
    }
    setImageError('');
  }, [isOpen, itemToEdit]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetCode.trim() || !name.trim() || !site) return;
    onSave({
      id: itemToEdit?.id,
      assetCode: assetCode.trim(),
      name: name.trim(),
      category: category.trim() || 'Umum',
      site,
      acquisitionDate,
      acquisitionCost: Number(acquisitionCost) || 0,
      usefulLifeYears: Number(usefulLifeYears) || 1,
      salvageValue: Number(salvageValue) || 0,
      status,
      serialNumber: serialNumber.trim() || undefined,
      warrantyExpiry: warrantyExpiry || undefined,
      notes: notes.trim(),
      imageUrl,
    } as Partial<FixedAsset>);
    onClose();
  };

  return (
    <ModalShell title={itemToEdit ? 'Edit Aset Tetap' : 'Daftarkan Aset Tetap Baru'} icon={Building2} onClose={onClose} maxWidth="680px">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Foto Aset</label>
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
                <img src={imageUrl} alt="Preview aset" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
              <div style={{ fontSize: '0.72rem', color: imageError ? '#F87171' : 'var(--txt-muted)' }}>
                {imageError || 'JPG, PNG, atau WebP — maksimal 3MB.'}
              </div>
            </div>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Kode Aset</label>
          <input required value={assetCode} onChange={(e) => setAssetCode(e.target.value)} placeholder="FA-SET-004" style={{ ...emptyInputStyle, width: '100%' }} />
        </div>
        <div>
          <label style={labelStyle}>Nama Aset</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Bauer CNG Compressor Unit" style={{ ...emptyInputStyle, width: '100%' }} />
        </div>
        <div>
          <label style={labelStyle}>Kategori</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Compressors" style={{ ...emptyInputStyle, width: '100%' }} />
        </div>
        <div>
          <label style={labelStyle}>Site</label>
          <select required value={site} onChange={(e) => setSite(e.target.value)} style={{ ...emptyInputStyle, width: '100%', cursor: 'pointer' }}>
            {sites.map((s) => <option key={s.key} value={s.key}>{labelPenuh(s.label)}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Tanggal Perolehan</label>
          <input required type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} style={{ ...emptyInputStyle, width: '100%' }} />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as FixedAsset['status'])} style={{ ...emptyInputStyle, width: '100%', cursor: 'pointer' }}>
            <option value="Active">Active</option>
            <option value="Under Maintenance">Under Maintenance</option>
            <option value="Retired">Retired</option>
            <option value="Disposed">Disposed</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Nilai Perolehan (IDR)</label>
          <input required type="number" min="0" value={acquisitionCost} onChange={(e) => setAcquisitionCost(e.target.value)} style={{ ...emptyInputStyle, width: '100%' }} />
        </div>
        <div>
          <label style={labelStyle}>Nilai Sisa / Salvage (IDR)</label>
          <input type="number" min="0" value={salvageValue} onChange={(e) => setSalvageValue(e.target.value)} style={{ ...emptyInputStyle, width: '100%' }} />
        </div>
        <div>
          <label style={labelStyle}>Umur Ekonomis (tahun)</label>
          <input required type="number" min="1" value={usefulLifeYears} onChange={(e) => setUsefulLifeYears(e.target.value)} style={{ ...emptyInputStyle, width: '100%' }} />
        </div>
        <div>
          <label style={labelStyle}>Nomor Seri</label>
          <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} style={{ ...emptyInputStyle, width: '100%' }} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Garansi Berakhir</label>
          <input type="date" value={warrantyExpiry} onChange={(e) => setWarrantyExpiry(e.target.value)} style={{ ...emptyInputStyle, width: '100%', maxWidth: '240px' }} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Catatan</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...emptyInputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="button" className="btn-chip" onClick={onClose}>Batal</button>
          <button type="submit" className="btn-primary" style={{ padding: '0.65rem 1.4rem' }}>
            <Save size={16} />
            Simpan Aset
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

/* ══════════════════════════ Reports View ══════════════════════════ */
const PIE_COLORS = ['#00D084', '#60A5FA', '#FBBF24', '#A78BFA', '#F87171', '#34D399', '#F472B6', '#38BDF8'];

export const ReportsView: React.FC<{
  summary: ReportsSummary | null;
  fixedAssets: FixedAsset[];
  workOrders: WorkOrder[];
}> = ({ summary, fixedAssets, workOrders }) => {
  const categoryChartData = (summary?.assetsByCategory || [])
    .map((c) => ({ name: c.category, 'Nilai Buku': Math.round(c.bookValue / 1_000_000), 'Nilai Perolehan': Math.round(c.acquisitionCost / 1_000_000) }))
    .sort((a, b) => b['Nilai Perolehan'] - a['Nilai Perolehan']);

  const woPieData = summary
    ? [
        { name: 'Overdue', value: summary.workOrders.overdue },
        { name: 'Terjadwal', value: summary.workOrders.upcoming },
        { name: 'Selesai', value: summary.workOrders.completed },
      ].filter((d) => d.value > 0)
    : [];

  const exportAssetRegister = () => {
    const rows: (string | number)[][] = [
      ['Kode Aset', 'Nama', 'Kategori', 'Site', 'Tgl Perolehan', 'Nilai Perolehan', 'Nilai Buku', 'Akumulasi Depresiasi', 'Status'],
      ...fixedAssets.map((a) => [a.assetCode, a.name, a.category, SITE_LABEL[a.site] || a.site, a.acquisitionDate, a.acquisitionCost, a.bookValue, a.accumulatedDepreciation, a.status]),
    ];
    downloadCsv(`laporan-aset-tetap-${todayStr()}.csv`, rows);
  };

  const exportMaintenanceReport = () => {
    const assetById = Object.fromEntries(fixedAssets.map((a) => [a.id, a]));
    const rows: (string | number)[][] = [
      ['Judul', 'Aset', 'Jatuh Tempo', 'Status', 'PIC'],
      ...workOrders.map((w) => [w.title, assetById[w.assetId]?.name || w.assetId, w.dueDate, w.status, w.assignedTo || '-']),
    ];
    downloadCsv(`laporan-maintenance-${todayStr()}.csv`, rows);
  };

  return (
    <div>
      <PageHeader icon={BarChart3} title="Laporan" sub="Ringkasan nilai aset, depresiasi, dan kepatuhan maintenance untuk manajemen" />

      {!summary ? (
        <div className="glass-panel" style={{ borderRadius: '16px', padding: '2.5rem', textAlign: 'center', color: 'var(--txt-muted)' }}>
          Memuat data laporan...
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <StatCard label="Total Aset Tetap" value={summary.totalAssets.toLocaleString('id-ID')} icon={Boxes} color="#00D084" />
            <StatCard label="Nilai Perolehan" value={formatCompactIDR(summary.totalAcquisitionValue)} icon={Wallet} color="#60A5FA" />
            <StatCard label="Nilai Buku Saat Ini" value={formatCompactIDR(summary.totalBookValue)} icon={ShieldCheck} color="#34D399" />
            <StatCard label="Akumulasi Depresiasi" value={formatCompactIDR(summary.totalAccumulatedDepreciation)} icon={TrendingDown} color="#F59E0B" />
            <StatCard label="Nilai Inventaris Suku Cadang" value={formatCompactIDR(summary.totalInventoryValue)} icon={PackageCheck} color="#A78BFA" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }} className="reports-grid">
            <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.5rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--txt-primary)', marginBottom: '1rem', fontSize: '0.95rem' }}>Nilai Aset per Kategori (juta IDR)</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={categoryChartData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--txt-muted)' }} interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--txt-muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: '10px', fontSize: '0.8rem' }} />
                  <Bar dataKey="Nilai Perolehan" fill="#60A5FA" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Nilai Buku" fill="#00D084" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.5rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--txt-primary)', marginBottom: '1rem', fontSize: '0.95rem' }}>Status Work Order</div>
              {woPieData.length === 0 ? (
                <div style={{ color: 'var(--txt-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>Belum ada work order.</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={woPieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {woPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: '10px', fontSize: '0.8rem' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                {woPieData.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--txt-secondary)' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {d.name}: <strong style={{ color: 'var(--txt-primary)' }}>{d.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ borderRadius: '16px', padding: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--txt-primary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClipboardList size={17} color="#00D084" />
                Ekspor Laporan Lengkap
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--txt-muted)' }}>Unduh sebagai CSV untuk dibuka di Excel / Google Sheets</div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn-chip" onClick={exportAssetRegister}>
                <FileDown size={15} />
                Laporan Aset Tetap
              </button>
              <button type="button" className="btn-chip" onClick={exportMaintenanceReport}>
                <FileDown size={15} />
                Laporan Maintenance
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};