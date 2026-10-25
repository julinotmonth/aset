import React, { useEffect, useMemo, useState } from 'react';
import {
  Package, Search, X, Plus, Download, AlertTriangle, Wrench, Wallet, Globe, MapPin,
  ChevronLeft, ChevronRight, RotateCcw, ArrowUpDown,
} from 'lucide-react';
import type { SparePart, SiteFilter } from '../../types';
import { getSites, useSitesRefresh } from '../../data/siteStore';
import { SparePartTable } from './SparePartTable';
import { PageHeader, formatIDR } from './AdminExtraViews';
import { labelPenuh, labelSiteDariKey } from './siteLabel';
import { statusEfektif, PERLU_TINDAKAN, type StatusSparePart } from './sparePartStatus';
import { WR_CSS } from './wrTema';

const SEMUA = 'ALL';
const PER_HALAMAN = 12;

type FilterStatus = typeof SEMUA | 'MENIPIS' | StatusSparePart;
type Urutan = 'terbaru' | 'nama' | 'sku' | 'kritis' | 'stok' | 'nilai';

const URUTAN: { id: Urutan; label: string }[] = [
  { id: 'terbaru', label: 'Terbaru ditambahkan' },
  { id: 'kritis', label: 'Paling kritis dulu' },
  { id: 'nama', label: 'Nama A–Z' },
  { id: 'sku', label: 'Kode / SKU' },
  { id: 'stok', label: 'Stok terendah' },
  { id: 'nilai', label: 'Nilai stok tertinggi' },
];

const CHIP_STATUS: { id: FilterStatus; label: string; warna: string }[] = [
  { id: SEMUA, label: 'Semua', warna: '#94A3B8' },
  { id: 'In Stock', label: 'In Stock', warna: '#34D399' },
  { id: 'MENIPIS', label: 'Perlu restok', warna: '#FBBF24' },
  { id: 'Critical', label: 'Critical', warna: '#F87171' },
  { id: 'Maintenance Needed', label: 'Maintenance', warna: '#F59E0B' },
];

const CSS = `
.sp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr));gap:.9rem;margin-bottom:1rem}
.sp-kpi{display:flex;align-items:center;gap:.8rem;text-align:left;border-radius:16px;padding:1rem 1.1rem;font:inherit;color:inherit;
  background:var(--wr-tab-bg);border:1px solid var(--wr-line)}
button.sp-kpi{cursor:pointer}
button.sp-kpi:hover{background:var(--wr-btn-bg-hover)}
button.sp-kpi[aria-pressed='true']{border-color:var(--wr-in);box-shadow:0 0 0 1px var(--wr-in) inset}
.sp-kpi:focus-visible,.sp-chip:focus-visible{outline:2px solid var(--wr-focus,#00D084);outline-offset:2px}
.sp-kpi-ico{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex-shrink:0}
.sp-kpi-lbl{font-size:.72rem;letter-spacing:.04em;text-transform:uppercase;color:var(--wr-txt-muted)}
.sp-kpi-val{font-size:1.45rem;font-weight:800;color:var(--txt-primary);line-height:1.15}
.sp-kpi-sub{font-size:.72rem;color:var(--wr-txt-muted);margin-top:2px}
.sp-chips{display:flex;flex-wrap:wrap;gap:.45rem}
.sp-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.4rem .8rem;border-radius:999px;font:inherit;font-size:.8rem;font-weight:600;cursor:pointer;
  background:var(--wr-tab-bg);color:var(--wr-txt-muted);border:1px solid var(--wr-line)}
.sp-chip:hover{background:var(--wr-btn-bg-hover);color:var(--txt-primary)}
.sp-chip[aria-pressed='true']{background:var(--wr-in);color:var(--wr-on-in);border-color:transparent}
.sp-chip-n{font-size:.7rem;font-weight:700;padding:1px 7px;border-radius:999px;background:rgba(127,127,127,.18)}
.sp-chip[aria-pressed='true'] .sp-chip-n{background:rgba(0,0,0,.18)}
.sp-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.sp-bar{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}
.sp-search{position:relative;flex:1 1 260px;min-width:200px}
.sp-search input{width:100%;padding:.62rem 2.2rem .62rem 2.5rem;border-radius:10px;font-size:.88rem;outline:none}
.sp-search .sp-ico{position:absolute;left:.85rem;top:50%;transform:translateY(-50%);color:var(--wr-txt-muted);pointer-events:none}
.sp-search .sp-clear{position:absolute;right:.45rem;top:50%;transform:translateY(-50%);display:grid;place-items:center;padding:4px;border-radius:6px;
  background:none;border:0;color:var(--wr-txt-muted);cursor:pointer}
.sp-search .sp-clear:hover{color:var(--txt-primary)}
.sp-sel{padding:.62rem .9rem;border-radius:10px;font-size:.85rem;outline:none}
.sp-btn{display:inline-flex;align-items:center;gap:.45rem;padding:.62rem 1rem;border-radius:10px;font:inherit;font-size:.85rem;cursor:pointer}
.sp-btn:disabled{opacity:.5;cursor:not-allowed}
.sp-foot{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;justify-content:space-between;margin-top:1rem;font-size:.8rem;color:var(--wr-txt-muted)}
.sp-pager{display:flex;align-items:center;gap:.35rem}
.sp-pg{min-width:32px;height:32px;padding:0 .4rem;border-radius:8px;display:grid;place-items:center;font:inherit;font-size:.8rem;font-weight:600;cursor:pointer;
  background:var(--wr-tab-bg);color:var(--txt-primary);border:1px solid var(--wr-line)}
.sp-pg:hover:not(:disabled){background:var(--wr-btn-bg-hover)}
.sp-pg:disabled{opacity:.4;cursor:not-allowed}
.sp-pg[aria-current='page']{background:var(--wr-in);color:var(--wr-on-in);border-color:transparent}
.sp-pg:focus-visible{outline:2px solid var(--wr-focus,#00D084);outline-offset:2px}
.sp-lbl{font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--wr-txt-muted);margin-bottom:.5rem}
`;

const angka = (n: number) => new Intl.NumberFormat('id-ID').format(n);

/** Sel CSV yang aman: tanda kutip digandakan, dan awalan rumus (= + - @) dinetralkan
 *  agar data yang diketik pengguna tidak dieksekusi sebagai rumus saat dibuka di Excel. */
const sel = (v: unknown): string => {
  let t = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
};

interface Props {
  spareParts: SparePart[];
  categoryOptions: string[];
  site: SiteFilter;
  onSiteChange: (s: SiteFilter) => void;
  onAdd: () => void;
  onEdit: (item: SparePart) => void;
  onTransfer: (item: SparePart) => void;
  onDelete: (id: string) => void;
  /** Ubah stok cepat; harus mengembalikan Promise agar tombol bisa dikunci selama diproses. */
  onAdjustStock: (item: SparePart, delta: number) => Promise<void>;
  /** Sembunyikan judul halaman (dipakai saat disematkan sebagai tab di menu Spare Part). */
  tanpaHeader?: boolean;
}

export const SparePartView: React.FC<Props> = ({
  spareParts, categoryOptions, site, onSiteChange, onAdd, onEdit, onTransfer, onDelete, onAdjustStock, tanpaHeader,
}) => {
  useSitesRefresh();

  const [cari, setCari] = useState('');
  const [kategori, setKategori] = useState(SEMUA);
  const [energi, setEnergi] = useState(SEMUA);
  const [status, setStatus] = useState<FilterStatus>(SEMUA);
  const [urutan, setUrutan] = useState<Urutan>('terbaru');
  const [halaman, setHalaman] = useState(1);
  const [sibuk, setSibuk] = useState<ReadonlySet<string>>(new Set());

  // ── Penyaringan: semua filter kecuali status → dipakai untuk hitungan chip & KPI ──
  const kataKunci = cari.trim().toLowerCase();
  const tanpaStatus = useMemo(() => spareParts.filter((p) =>
    (site === 'global' || p.site === site)
    && (kategori === SEMUA || p.category === kategori)
    && (energi === SEMUA || p.productEnergy === energi)
    && (!kataKunci
      || p.name.toLowerCase().includes(kataKunci)
      || p.sku.toLowerCase().includes(kataKunci)
      || (p.specifications ?? '').toLowerCase().includes(kataKunci)
      || p.category.toLowerCase().includes(kataKunci))
  ), [spareParts, site, kategori, energi, kataKunci]);

  const hitung = useMemo(() => {
    const h: Record<string, number> = { [SEMUA]: tanpaStatus.length, MENIPIS: 0, 'In Stock': 0, 'Low Stock': 0, Critical: 0, 'Maintenance Needed': 0 };
    for (const p of tanpaStatus) {
      const s = statusEfektif(p);
      h[s] += 1;
      if (PERLU_TINDAKAN(s)) h.MENIPIS += 1;
    }
    return h;
  }, [tanpaStatus]);

  const terfilter = useMemo(() => {
    const lolos = tanpaStatus.filter((p) => {
      if (status === SEMUA) return true;
      const s = statusEfektif(p);
      return status === 'MENIPIS' ? PERLU_TINDAKAN(s) : s === status;
    });
    const rasio = (p: SparePart) => (p.minStock > 0 ? p.stock / p.minStock : p.stock > 0 ? Infinity : 0);
    const a = [...lolos];
    switch (urutan) {
      case 'nama': a.sort((x, y) => x.name.localeCompare(y.name, 'id')); break;
      case 'sku': a.sort((x, y) => x.sku.localeCompare(y.sku, 'id', { numeric: true })); break;
      case 'kritis': a.sort((x, y) => rasio(x) - rasio(y) || x.name.localeCompare(y.name, 'id')); break;
      case 'stok': a.sort((x, y) => x.stock - y.stock); break;
      case 'nilai': a.sort((x, y) => y.stock * y.priceEstimate - x.stock * x.priceEstimate); break;
      default: break; // 'terbaru' = urutan dari server
    }
    return a;
  }, [tanpaStatus, status, urutan]);

  // ── KPI (mengikuti site / kategori / pencarian yang aktif) ──
  const kpi = useMemo(() => ({
    jenis: tanpaStatus.length,
    unit: tanpaStatus.reduce((t, p) => t + p.stock, 0),
    nilai: tanpaStatus.reduce((t, p) => t + p.stock * p.priceEstimate, 0),
  }), [tanpaStatus]);

  // ── Chip site: hitungan dari SEMUA data, tidak ikut filter lain ──
  const sites = getSites();
  const jumlahSite = useMemo(() => {
    const h: Record<string, number> = { global: spareParts.length };
    for (const p of spareParts) h[p.site] = (h[p.site] ?? 0) + 1;
    return h;
  }, [spareParts]);

  const daftarKategori = useMemo(
    () => Array.from(new Set([...categoryOptions, ...spareParts.map((p) => p.category)])).sort((a, b) => a.localeCompare(b, 'id')),
    [categoryOptions, spareParts],
  );
  const daftarEnergi = useMemo(
    () => Array.from(new Set(spareParts.map((p) => p.productEnergy).filter(Boolean))).sort(),
    [spareParts],
  );

  // ── Paginasi ──
  const totalHalaman = Math.max(1, Math.ceil(terfilter.length / PER_HALAMAN));
  const halamanAktif = Math.min(halaman, totalHalaman);
  const mulai = (halamanAktif - 1) * PER_HALAMAN;
  const tampil = terfilter.slice(mulai, mulai + PER_HALAMAN);
  useEffect(() => { setHalaman(1); }, [site, kategori, energi, status, urutan, kataKunci]);

  const adaFilter = site !== 'global' || kategori !== SEMUA || energi !== SEMUA || status !== SEMUA || !!kataKunci;
  const reset = () => { onSiteChange('global'); setKategori(SEMUA); setEnergi(SEMUA); setStatus(SEMUA); setCari(''); };

  const sesuaikan = async (item: SparePart, delta: number) => {
    if (sibuk.has(item.id)) return;
    setSibuk((s) => new Set(s).add(item.id));
    try { await onAdjustStock(item, delta); }
    finally { setSibuk((s) => { const n = new Set(s); n.delete(item.id); return n; }); }
  };

  const ekspor = () => {
    const kepala = ['SKU', 'Nama', 'Kategori', 'Produk', 'Site', 'Stok', 'Min Stok', 'Satuan', 'Status', 'Harga Satuan (Rp)', 'Nilai Stok (Rp)', 'Spesifikasi', 'Terakhir Diinspeksi'];
    const baris = terfilter.map((p) => [
      p.sku, p.name, p.category, p.productEnergy, labelSiteDariKey(p.site), p.stock, p.minStock, p.unit, statusEfektif(p),
      p.priceEstimate, p.stock * p.priceEstimate, p.specifications, p.lastInspected,
    ]);
    const csv = '\uFEFF' + [kepala, ...baris].map((r) => r.map(sel).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const label = site === 'global' ? 'semua-site' : labelSiteDariKey(site).toLowerCase().replace(/\s+/g, '-');
    const a = document.createElement('a');
    a.href = url;
    a.download = `spare-part-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Nomor halaman ringkas: 1 … 4 5 [6] 7 8 … 20
  const nomor = useMemo(() => {
    const s = new Set<number>([1, totalHalaman, halamanAktif - 1, halamanAktif, halamanAktif + 1]);
    const a = [...s].filter((n) => n >= 1 && n <= totalHalaman).sort((x, y) => x - y);
    const hasil: (number | '…')[] = [];
    a.forEach((n, i) => { if (i && n - a[i - 1] > 1) hasil.push('…'); hasil.push(n); });
    return hasil;
  }, [halamanAktif, totalHalaman]);

  return (
    <>
      <style>{WR_CSS}{CSS}</style>
      {!tanpaHeader && <PageHeader icon={Package} title="Spare Part" sub="Kelola stok, harga, dan lokasi spare part di seluruh site operasional." />}

      {/* KPI — kartu "perlu restok" & "maintenance" bisa diklik untuk memfilter tabel */}
      <div className="sp-kpis">
        <div className="sp-kpi">
          <div className="sp-kpi-ico" style={{ background: 'rgba(0,208,132,.12)' }}><Package size={20} color="#00D084" /></div>
          <div><div className="sp-kpi-lbl">Jenis Spare Part</div>
            <div className="sp-kpi-val">{angka(kpi.jenis)}</div>
            <div className="sp-kpi-sub">{angka(kpi.unit)} unit total stok</div></div>
        </div>
        <button type="button" className="sp-kpi" aria-pressed={status === 'MENIPIS'}
          onClick={() => setStatus((s) => (s === 'MENIPIS' ? SEMUA : 'MENIPIS'))}>
          <div className="sp-kpi-ico" style={{ background: hitung.MENIPIS ? 'rgba(248,113,113,.14)' : 'rgba(52,211,153,.14)' }}>
            <AlertTriangle size={20} color={hitung.MENIPIS ? '#F87171' : '#34D399'} /></div>
          <div><div className="sp-kpi-lbl">Perlu Restok</div>
            <div className="sp-kpi-val" style={{ color: hitung.MENIPIS ? '#F87171' : undefined }}>{angka(hitung.MENIPIS)}</div>
            <div className="sp-kpi-sub">{hitung.MENIPIS ? `${angka(hitung.Critical)} critical · klik untuk memfilter` : 'Semua stok aman'}</div></div>
        </button>
        <button type="button" className="sp-kpi" aria-pressed={status === 'Maintenance Needed'}
          onClick={() => setStatus((s) => (s === 'Maintenance Needed' ? SEMUA : 'Maintenance Needed'))}>
          <div className="sp-kpi-ico" style={{ background: 'rgba(245,158,11,.14)' }}><Wrench size={20} color={hitung['Maintenance Needed'] ? '#F59E0B' : '#34D399'} /></div>
          <div><div className="sp-kpi-lbl">Perlu Maintenance</div>
            <div className="sp-kpi-val" style={{ color: hitung['Maintenance Needed'] ? '#F59E0B' : undefined }}>{angka(hitung['Maintenance Needed'])}</div>
            <div className="sp-kpi-sub">Menunggu tindakan servis</div></div>
        </button>
        <div className="sp-kpi">
          <div className="sp-kpi-ico" style={{ background: 'rgba(0,208,132,.12)' }}><Wallet size={20} color="#00D084" /></div>
          <div><div className="sp-kpi-lbl">Nilai Inventaris</div>
            <div className="sp-kpi-val" style={{ fontSize: '1.2rem' }}>{formatIDR(kpi.nilai)}</div>
            <div className="sp-kpi-sub">stok × estimasi harga</div></div>
        </div>
      </div>

      {/* Filter */}
      <div className="glass-panel" style={{ borderRadius: 20, padding: '1.1rem 1.25rem', marginBottom: '1rem' }}>
        <div className="sp-lbl">Lokasi site</div>
        <div className="sp-chips" role="group" aria-label="Filter site" style={{ marginBottom: '1rem' }}>
          <button type="button" className="sp-chip" aria-pressed={site === 'global'} onClick={() => onSiteChange('global')}>
            <Globe size={14} /> Semua site <span className="sp-chip-n">{jumlahSite.global ?? 0}</span>
          </button>
          {sites.map((s) => (
            <button key={s.key} type="button" className="sp-chip" aria-pressed={site === s.key} onClick={() => onSiteChange(s.key)}>
              <MapPin size={14} /> {labelPenuh(s.label)} <span className="sp-chip-n">{jumlahSite[s.key] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="sp-bar">
          <div className="sp-search">
            <Search size={16} className="sp-ico" />
            <input type="text" className="wr-ctl" placeholder="Cari nama, SKU, kategori, atau spesifikasi…" aria-label="Cari spare part"
              value={cari} onChange={(e) => setCari(e.target.value)} />
            {cari && <button type="button" className="sp-clear" aria-label="Hapus pencarian" onClick={() => setCari('')}><X size={14} /></button>}
          </div>
          <select className="wr-ctl sp-sel" aria-label="Filter kategori" value={kategori} onChange={(e) => setKategori(e.target.value)}>
            <option value={SEMUA}>Semua kategori</option>
            {daftarKategori.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select className="wr-ctl sp-sel" aria-label="Filter produk" value={energi} onChange={(e) => setEnergi(e.target.value)}>
            <option value={SEMUA}>Semua produk</option>
            {daftarEnergi.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', color: 'var(--wr-txt-muted)' }}>
            <ArrowUpDown size={15} />
            <select className="wr-ctl sp-sel" aria-label="Urutkan" value={urutan} onChange={(e) => setUrutan(e.target.value as Urutan)}>
              {URUTAN.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </label>
          <span style={{ flex: '1 1 0' }} />
          <button type="button" className="wr-btn sp-btn" onClick={ekspor} disabled={!terfilter.length} title="Unduh hasil yang sedang tampil sebagai CSV">
            <Download size={16} /> Export
          </button>
          <button type="button" className="wr-btn wr-btn--primary sp-btn" onClick={onAdd}>
            <Plus size={16} /> Tambah Spare Part
          </button>
        </div>

        <div className="sp-chips" role="group" aria-label="Filter status" style={{ marginTop: '1rem' }}>
          {CHIP_STATUS.map((c) => (
            <button key={c.id} type="button" className="sp-chip" aria-pressed={status === c.id} onClick={() => setStatus(c.id)}>
              {c.id !== SEMUA && <span className="sp-dot" style={{ background: c.warna }} />}
              {c.label} <span className="sp-chip-n">{hitung[c.id] ?? 0}</span>
            </button>
          ))}
          {adaFilter && (
            <button type="button" className="sp-chip" onClick={reset} style={{ marginLeft: 'auto' }}>
              <RotateCcw size={13} /> Reset filter
            </button>
          )}
        </div>
      </div>

      {/* Tabel */}
      <div className="glass-panel admin-table-wrap" style={{ borderRadius: 20, padding: '1.5rem' }}>
        <SparePartTable spareParts={tampil} onEdit={onEdit} onTransfer={onTransfer} onDelete={onDelete}
          onAdjustStock={sesuaikan} busyIds={sibuk} />
        {terfilter.length > 0 && (
          <div className="sp-foot">
            <span aria-live="polite">
              Menampilkan {angka(mulai + 1)}–{angka(mulai + tampil.length)} dari {angka(terfilter.length)} spare part
            </span>
            {totalHalaman > 1 && (
              <nav className="sp-pager" aria-label="Halaman">
                <button type="button" className="sp-pg" aria-label="Halaman sebelumnya" disabled={halamanAktif === 1} onClick={() => setHalaman(halamanAktif - 1)}><ChevronLeft size={15} /></button>
                {nomor.map((n, i) => n === '…'
                  ? <span key={`e${i}`} style={{ padding: '0 .2rem' }}>…</span>
                  : <button key={n} type="button" className="sp-pg" aria-current={n === halamanAktif ? 'page' : undefined} onClick={() => setHalaman(n)}>{n}</button>)}
                <button type="button" className="sp-pg" aria-label="Halaman berikutnya" disabled={halamanAktif === totalHalaman} onClick={() => setHalaman(halamanAktif + 1)}><ChevronRight size={15} /></button>
              </nav>
            )}
          </div>
        )}
      </div>
    </>
  );
};