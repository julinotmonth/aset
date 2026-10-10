// Tab "Pencapaian Minimum Stok" di dalam Laporan Mingguan.
//
// Sumber: sheet "Progress_Minimum Stock All MS WS 2026" (tab "Resume ALL Weekly") —
// per minggu, per kategori (Critical Part / Periodik Maintenance) dan per lokasi:
// berapa item yang sudah memenuhi minimum stock (Terealisasi) vs belum.
// Datanya satu untuk seluruh perusahaan; parsing & penyimpanan ada di
// server/src/minStock.js. Sumber Sheet/Sync hanya untuk Super Admin.
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import {
  Link2, RefreshCw, Loader2, CheckCircle2, AlertTriangle, PackageCheck, PackageOpen, Boxes,
  ChevronLeft, ChevronRight, Download, ArrowUp, ArrowDown, Minus, Upload, Info,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from 'recharts';
import { api } from '../../lib/api';
import type { AuthState } from '../../types';
import {
  NADA, SERI_PANJANG, POLA_GARIS, tooltipProps, fmtLegend, WR_CSS, useWrTema,
} from './wrTema';
import type { Nada } from './wrTema';

// ── Tipe (sesuai payload GET /api/min-stock) ──────────────────────────────
type Titik = [number, number | null, number | null, number | null]; // [min, terealisasi, belum, pct dari sheet]
interface MsRow { location: string; v: (Titik | null)[] }
interface MsGroup { category: string; rows: MsRow[] }
interface MsWeek { n: number; label: string; filled: boolean }
interface MsData { title: string; year: number | null; target: number; weeks: MsWeek[]; groups: MsGroup[] }
interface MsSource { autoSync: boolean; lastSyncAt: string | null; lastStatus: string; sheetUrl?: string; manual?: boolean }
interface MsPayload {
  source: MsSource | null; data: MsData | null; dataUpdatedAt?: string | null;
  sync?: { ok: boolean; error?: string; rows?: number; filledWeeks?: number };
}

interface Agg { min: number; real: number }
interface Entri {
  key: string; lokasi: string; seri: (Agg | null)[];
  rincian?: { kategori: string; seri: (Agg | null)[] }[];
}

const SEMUA = 'Semua';
type Urut = 'rendah' | 'tinggi' | 'belum' | 'sheet';
type Tingkat = 'baik' | 'waspada' | 'rendah' | 'none';

// ── Helper ────────────────────────────────────────────────────────────────
const fmtN = (n: number) => n.toLocaleString('id-ID');
const fmtP = (n: number | null, d = 1) =>
  n === null ? '–' : `${n.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: d })}%`;
const aggDari = (t: Titik | null): Agg | null => (t ? { min: t[0], real: t[1] ?? 0 } : null);
const pct = (a: Agg | null): number | null => (a && a.min > 0 ? (a.real / a.min) * 100 : null);

/** Ambang status relatif terhadap target sheet (default 100%): ≥90% baik, ≥75% waspada, sisanya rendah. */
const tingkat = (p: number | null, target: number): Tingkat =>
  p === null ? 'none' : p >= target * 0.9 ? 'baik' : p >= target * 0.75 ? 'waspada' : 'rendah';
const NADA_TINGKAT: Record<Tingkat, Nada> = { baik: NADA.in, waspada: NADA.warn, rendah: NADA.neg, none: NADA.neutral };
const LABEL_TINGKAT: Record<Tingkat, string> = { baik: 'Baik', waspada: 'Waspada', rendah: 'Rendah', none: 'Tanpa data' };

function bangunEntri(data: MsData, kat: string): Entri[] {
  const nW = data.weeks.length;
  if (kat !== SEMUA) {
    const g = data.groups.find((x) => x.category === kat);
    return (g?.rows ?? []).map((r, i) => ({ key: `${kat}|${r.location}|${i}`, lokasi: r.location, seri: r.v.map(aggDari) }));
  }
  // "Semua": satu entri per lokasi, jumlahkan kedua kategori; rincian dipertahankan untuk mini-bar.
  const peta = new Map<string, Entri>();
  for (const g of data.groups) {
    for (const r of g.rows) {
      let e = peta.get(r.location);
      if (!e) { e = { key: r.location, lokasi: r.location, seri: new Array<Agg | null>(nW).fill(null), rincian: [] }; peta.set(r.location, e); }
      const s = r.v.map(aggDari);
      e.rincian!.push({ kategori: g.category, seri: s });
      s.forEach((a, i) => {
        if (!a) return;
        const c = e!.seri[i];
        e!.seri[i] = c ? { min: c.min + a.min, real: c.real + a.real } : { ...a };
      });
    }
  }
  return [...peta.values()];
}

const jumlahMinggu = (entri: Entri[], i: number): Agg | null => {
  let min = 0, real = 0, ada = false;
  for (const e of entri) { const a = e.seri[i]; if (a) { min += a.min; real += a.real; ada = true; } }
  return ada ? { min, real } : null;
};

// ── Komponen kecil ────────────────────────────────────────────────────────
function Cincin({ nilai, tingkatNow, ukuran = 168 }: { nilai: number | null; tingkatNow: Tingkat; ukuran?: number }) {
  const tebal = 14, r = ukuran / 2 - tebal, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, nilai ?? 0));
  const n = NADA_TINGKAT[tingkatNow];
  return (
    <svg width={ukuran} height={ukuran} viewBox={`0 0 ${ukuran} ${ukuran}`} role="img"
      aria-label={`Pencapaian ${fmtP(nilai)}`} style={{ maxWidth: '100%', height: 'auto' }}>
      <circle cx={ukuran / 2} cy={ukuran / 2} r={r} fill="none" strokeWidth={tebal} style={{ stroke: 'var(--wr-line)' }} />
      <circle cx={ukuran / 2} cy={ukuran / 2} r={r} fill="none" strokeWidth={tebal} strokeLinecap="round"
        strokeDasharray={`${(c * p) / 100} ${c}`} transform={`rotate(-90 ${ukuran / 2} ${ukuran / 2})`}
        style={{ stroke: n.warna, transition: 'stroke-dasharray .7s cubic-bezier(.22,1,.36,1)' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        style={{ fill: 'var(--txt-primary)', fontSize: ukuran * 0.18, fontWeight: 800 }}>{fmtP(nilai)}</text>
    </svg>
  );
}

function Delta({ nilai }: { nilai: number | null }) {
  if (nilai === null) return null;
  const r = Math.round(nilai * 10) / 10;
  const n = r > 0 ? NADA.in : r < 0 ? NADA.neg : NADA.neutral;
  const Ikon = r > 0 ? ArrowUp : r < 0 ? ArrowDown : Minus;
  return (
    <span title="Dibanding minggu sebelumnya" style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '.7rem', fontWeight: 700, padding: '2px 8px',
      borderRadius: 99, background: n.bg, color: n.teks, border: `1px solid ${n.garis}`, whiteSpace: 'nowrap',
    }}>
      <Ikon size={11} aria-hidden /> {r === 0 ? 'Sama' : `${r > 0 ? 'Naik' : 'Turun'} ${Math.abs(r).toLocaleString('id-ID')} poin`}
    </span>
  );
}

function Chip({ nada, teks }: { nada: Nada; teks: string }) {
  return (
    <span style={{ fontSize: '.66rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: nada.bg, color: nada.teks, border: `1px solid ${nada.garis}`, whiteSpace: 'nowrap' }}>
      {teks}
    </span>
  );
}

function KartuKpi({ ikon: Ikon, label, nilai, sub, nada }: { ikon: React.ElementType; label: string; nilai: string; sub?: string; nada: Nada }) {
  return (
    <div className="glass-panel ms-fade" style={{ borderRadius: 14, padding: '.9rem 1.05rem', display: 'flex', gap: '.8rem', alignItems: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: nada.bg, color: nada.teks, border: `1px solid ${nada.garis}`, flexShrink: 0 }}>
        <Ikon size={19} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '.68rem', color: 'var(--wr-txt-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--txt-primary)', lineHeight: 1.25 }}>{nilai}</div>
        {sub && <div style={{ fontSize: '.7rem', color: 'var(--wr-txt-muted)' }}>{sub}</div>}
      </div>
    </div>
  );
}

function Sparkline({ nilai, warna }: { nilai: (number | null)[]; warna: string }) {
  const ada = nilai.filter((x): x is number => x !== null);
  if (ada.length < 2) return null;
  const lo = Math.min(...ada), hi = Math.max(...ada), rentang = hi - lo || 1;
  const pts = nilai.map((v, i) => (v === null ? null : `${(i / (nilai.length - 1)) * 100},${26 - ((v - lo) / rentang) * 22}`)).filter(Boolean).join(' ');
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" width="100%" height="28" aria-hidden style={{ display: 'block' }}>
      <polyline points={pts} fill="none" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ stroke: warna }} />
    </svg>
  );
}

const MS_CSS = `
.ms-hero{display:grid;grid-template-columns:minmax(0,330px) minmax(0,1fr);gap:1rem;margin-bottom:1rem}
.ms-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.75rem;align-content:start}
.ms-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:.85rem}
.ms-card{transition:transform .18s ease,box-shadow .18s ease}
.ms-card:hover{transform:translateY(-2px)}
.ms-bar{position:relative;height:9px;border-radius:99px;background:var(--wr-line);overflow:hidden}
.ms-bar>i{display:block;height:100%;border-radius:99px;transition:width .7s cubic-bezier(.22,1,.36,1)}
.ms-mini{height:5px}
.ms-fade{animation:msIn .4s ease both}
@keyframes msIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.ms-spin{animation:msSpin 1s linear infinite}
@keyframes msSpin{to{transform:rotate(360deg)}}
@media (max-width:860px){.ms-hero{grid-template-columns:minmax(0,1fr)}}
@media (max-width:480px){.ms-grid{grid-template-columns:minmax(0,1fr)}}
.ms-tbl{min-width:520px}
@media (max-width:560px){.ms-tbl{min-width:0}.ms-hide-sm{display:none}.ms-tbl th,.ms-tbl td{padding-left:.4rem!important;padding-right:.4rem!important}.ms-tbl td:first-child,.ms-tbl th:first-child{white-space:normal!important;max-width:96px}}
@media (prefers-reduced-motion:reduce){.ms-card,.ms-bar>i,.ms-fade,.ms-spin{transition:none;animation:none}}
`;

// ── Komponen utama ────────────────────────────────────────────────────────
interface Props { auth: AuthState }

export function MinStockView({ auth }: Props) {
  const isSuperAdmin = auth.role === 'Super Admin';
  const { W, rv } = useWrTema();

  const [payload, setPayload] = useState<MsPayload | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [menyinkron, setMenyinkron] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'error'; teks: string } | null>(null);
  const [panelSumber, setPanelSumber] = useState(false);
  const [urlSheet, setUrlSheet] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [kategori, setKategori] = useState(SEMUA);
  const [selPilih, setSelPilih] = useState<number | null>(null);
  const [urut, setUrut] = useState<Urut>('rendah');
  const [modeTren, setModeTren] = useState<'total' | 'lokasi'>('total');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const p = await api.get<MsPayload>('/min-stock');
      setPayload(p);
      if (p.source?.sheetUrl) setUrlSheet(p.source.sheetUrl);
    } catch (err) {
      setPesan({ tipe: 'error', teks: err instanceof Error ? err.message : 'Gagal memuat data Minimum Stok.' });
    } finally { setMemuat(false); }
  }, []);
  useEffect(() => { void muat(); }, [muat]);

  const terapkanHasil = (p: MsPayload, sukses: string) => {
    setPayload(p);
    if (p.source?.sheetUrl) setUrlSheet(p.source.sheetUrl);
    if (p.sync && !p.sync.ok) setPesan({ tipe: 'error', teks: p.sync.error || 'Sinkronisasi gagal.' });
    else setPesan({ tipe: 'ok', teks: `${sukses} ${p.sync?.rows ?? ''} baris terbaca, ${p.sync?.filledWeeks ?? ''} minggu terisi.` });
  };

  const simpanSumber = async () => {
    setMenyinkron(true); setPesan(null);
    try {
      const p = await api.post<MsPayload>('/min-stock/source', { sheetUrl: urlSheet, autoSync: true });
      terapkanHasil(p, 'Sumber disimpan & disinkronkan.');
      if (p.sync?.ok) setPanelSumber(false);
    } catch (err) { setPesan({ tipe: 'error', teks: err instanceof Error ? err.message : 'Gagal menyimpan sumber.' }); }
    finally { setMenyinkron(false); }
  };

  const sinkronkan = async () => {
    setMenyinkron(true); setPesan(null);
    try { terapkanHasil(await api.post<MsPayload>('/min-stock/sync', {}), 'Sinkron selesai.'); }
    catch (err) { setPesan({ tipe: 'error', teks: err instanceof Error ? err.message : 'Sinkronisasi gagal.' }); }
    finally { setMenyinkron(false); }
  };

  const imporCsv = async (file: File) => {
    setMenyinkron(true); setPesan(null);
    try { terapkanHasil(await api.post<MsPayload>('/min-stock/import', { csv: await file.text() }), 'Impor CSV selesai.'); }
    catch (err) { setPesan({ tipe: 'error', teks: err instanceof Error ? err.message : 'Impor gagal.' }); }
    finally { setMenyinkron(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const data = payload?.data ?? null;
  const target = data?.target ?? 100;
  const mingguIdx = useMemo(() => (data ? data.weeks.map((w, i) => (w.filled ? i : -1)).filter((i) => i >= 0) : []), [data]);
  const last = mingguIdx.length - 1;
  const sel = Math.max(0, Math.min(selPilih ?? last, last));
  const wi = mingguIdx[sel] ?? -1;
  const wiPrev = sel > 0 ? mingguIdx[sel - 1] : -1;
  const kategoriList = useMemo(() => [SEMUA, ...(data?.groups.map((g) => g.category) ?? [])], [data]);
  const katAktif = kategoriList.includes(kategori) ? kategori : SEMUA;
  const entri = useMemo(() => (data ? bangunEntri(data, katAktif) : []), [data, katAktif]);

  const totalNow = wi >= 0 ? jumlahMinggu(entri, wi) : null;
  const totalPrev = wiPrev >= 0 ? jumlahMinggu(entri, wiPrev) : null;
  const pNow = pct(totalNow), pPrev = pct(totalPrev);
  const deltaTotal = pNow !== null && pPrev !== null ? pNow - pPrev : null;
  const tingkatTotal = tingkat(pNow, target);

  const kartu = useMemo(() => {
    if (wi < 0) return [];
    const daftar = entri.map((e, idx) => {
      const cur = e.seri[wi], prev = wiPrev >= 0 ? e.seri[wiPrev] : null;
      const p = pct(cur), pp = pct(prev);
      return {
        e, idx, cur, p, delta: p !== null && pp !== null ? p - pp : null,
        belum: cur ? cur.min - cur.real : 0,
        anomali: !!(cur && cur.min > 0 && cur.real === 0 && prev && prev.real > 0),
        tren: mingguIdx.map((i) => pct(e.seri[i])),
      };
    });
    const nilai = (k: (typeof daftar)[number]) => k.p ?? -1;
    if (urut === 'rendah') daftar.sort((a, b) => nilai(a) - nilai(b));
    else if (urut === 'tinggi') daftar.sort((a, b) => nilai(b) - nilai(a));
    else if (urut === 'belum') daftar.sort((a, b) => b.belum - a.belum);
    return daftar;
  }, [entri, wi, wiPrev, urut, mingguIdx]);

  const dataTren = useMemo(() => {
    if (!data) return [];
    return mingguIdx.map((i) => {
      const baris: Record<string, number | string | null> = { minggu: `W${data.weeks[i].n}` };
      baris.Total = pct(jumlahMinggu(entri, i));
      if (modeTren === 'lokasi') for (const e of entri) baris[e.lokasi] = pct(e.seri[i]);
      return baris;
    });
  }, [data, entri, mingguIdx, modeTren]);

  const batasBawah = useMemo(() => {
    const nilai: number[] = [];
    for (const b of dataTren) for (const [k, v] of Object.entries(b)) if (k !== 'minggu' && typeof v === 'number') nilai.push(v);
    return nilai.length ? Math.max(0, Math.floor((Math.min(...nilai) - 5) / 10) * 10) : 0;
  }, [dataTren]);

  const unduhCsv = () => {
    if (!data || wi < 0) return;
    const baris: string[][] = [['Kategori', 'Lokasi', 'Minggu', 'Jumlah Min Stock', 'Terealisasi', 'Belum Terealisasi', 'Pencapaian (%)']];
    for (const g of data.groups) {
      if (katAktif !== SEMUA && g.category !== katAktif) continue;
      for (const r of g.rows) {
        const t = r.v[wi]; if (!t) continue;
        const a = aggDari(t)!;
        baris.push([g.category, r.location, data.weeks[wi].label, String(a.min), String(a.real), String(a.min - a.real), (pct(a) ?? 0).toFixed(1)]);
      }
    }
    const csv = baris.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `MIN_STOCK_${data.weeks[wi].label.replace(' ', '_')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const kontrol: CSSProperties = { padding: '.5rem .75rem', borderRadius: 10 };
  const tombol: CSSProperties = { display: 'flex', alignItems: 'center', gap: '.4rem', padding: '.5rem .85rem', borderRadius: 10, cursor: 'pointer' };
  const sinkronGagal = payload?.source && payload.source.lastStatus && !['OK', 'Impor manual', ''].includes(payload.source.lastStatus);
  const waktu = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '–');

  return (
    <>
      <style>{WR_CSS}{MS_CSS}</style>

      {/* ── Bar kontrol ── */}
      <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '.75rem', alignItems: 'center' }}>
        {data && wi >= 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
            <button type="button" className="wr-btn" aria-label="Minggu sebelumnya" disabled={sel <= 0}
              onClick={() => setSelPilih(sel - 1)} style={{ ...tombol, padding: '.5rem .55rem', opacity: sel <= 0 ? .45 : 1 }}><ChevronLeft size={16} /></button>
            <select aria-label="Pilih minggu" value={sel} onChange={(e) => setSelPilih(Number(e.target.value))} className="wr-ctl" style={{ ...kontrol, fontWeight: 700, minWidth: 120 }}>
              {mingguIdx.map((i, k) => <option key={i} value={k}>{data.weeks[i].label}{k === last ? ' (terbaru)' : ''}</option>)}
            </select>
            <button type="button" className="wr-btn" aria-label="Minggu berikutnya" disabled={sel >= last}
              onClick={() => setSelPilih(sel + 1)} style={{ ...tombol, padding: '.5rem .55rem', opacity: sel >= last ? .45 : 1 }}><ChevronRight size={16} /></button>
          </div>
        )}

        {data && (
          <div role="group" aria-label="Kategori" style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
            {kategoriList.map((k) => (
              <button key={k} type="button" className="wr-tab" aria-pressed={k === katAktif} onClick={() => setKategori(k)}
                style={{
                  padding: '.45rem .85rem', borderRadius: 10, cursor: 'pointer', fontSize: '.78rem', fontWeight: k === katAktif ? 700 : 600,
                  ...(k === katAktif ? { background: NADA.info.bg, color: NADA.info.teks, border: `1px solid ${NADA.info.garis}`, boxShadow: `inset 0 -2px 0 ${NADA.info.warna}` } : {}),
                }}>{k}</button>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {data && wi >= 0 && (
          <button type="button" className="wr-btn" onClick={unduhCsv} style={tombol} title="Unduh tabel minggu terpilih"><Download size={15} /> CSV</button>
        )}
        {isSuperAdmin && (
          <>
            <button type="button" className="wr-btn wr-btn--info" onClick={() => setPanelSumber((v) => !v)} style={tombol}><Link2 size={15} /> Sumber Sheet</button>
            <button type="button" className="wr-btn wr-btn--primary" onClick={sinkronkan} disabled={menyinkron || !payload?.source?.sheetUrl}
              title={payload?.source?.sheetUrl ? 'Tarik ulang dari Google Spreadsheet' : 'Atur sumber sheet terlebih dahulu'}
              style={{ ...tombol, cursor: payload?.source?.sheetUrl ? 'pointer' : 'not-allowed', opacity: payload?.source?.sheetUrl ? 1 : .5 }}>
              {menyinkron ? <Loader2 size={15} className="ms-spin" /> : <RefreshCw size={15} />} Sync Sekarang
            </button>
          </>
        )}
      </div>

      {/* ── Panel sumber (Super Admin) ── */}
      {isSuperAdmin && panelSumber && (
        <div className="glass-panel ms-fade" style={{ borderRadius: 16, padding: '1.1rem 1.25rem', marginBottom: '1rem', display: 'grid', gap: '.75rem' }}>
          <label style={{ fontSize: '.78rem', color: 'var(--wr-txt-muted)' }}>
            Link Google Spreadsheet tab "Resume ALL Weekly"
            <input value={urlSheet} onChange={(e) => setUrlSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..."
              className="wr-ctl" style={{ ...kontrol, display: 'block', width: '100%', marginTop: '.35rem' }} />
          </label>
          <div style={{ fontSize: '.72rem', color: 'var(--wr-txt-muted)', lineHeight: 1.6 }}>
            Buka tab-nya di Google Sheets lalu salin URL dari address bar (ada <code>?gid=…</code>). Sheet harus dibagikan sebagai{' '}
            <strong>Anyone with the link — Viewer</strong>; disinkronkan otomatis tiap 5 menit. Data ini berlaku untuk <strong>seluruh site</strong>.
            {' '}Sync terakhir: {waktu(payload?.source?.lastSyncAt)}{payload?.source?.lastStatus ? ` (${payload.source.lastStatus})` : ''}.
          </div>
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="wr-btn wr-btn--primary" onClick={simpanSumber} disabled={menyinkron || !urlSheet.trim()} style={{ ...tombol, padding: '.5rem 1rem' }}>
              {menyinkron && <Loader2 size={15} className="ms-spin" />} Simpan &amp; Sinkronkan
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void imporCsv(f); }} />
            <button type="button" className="wr-btn" onClick={() => fileRef.current?.click()} disabled={menyinkron} style={tombol}
              title="Cadangan bila sheet tidak bisa dibuat publik: File → Download → CSV pada tab ini">
              <Upload size={15} /> Impor CSV (cadangan)
            </button>
          </div>
        </div>
      )}

      {pesan && (
        <div role={pesan.tipe === 'ok' ? 'status' : 'alert'} style={{
          display: 'flex', gap: '.55rem', alignItems: 'flex-start', padding: '.7rem 1rem', borderRadius: 12, marginBottom: '1rem', fontSize: '.8rem', whiteSpace: 'pre-wrap',
          background: (pesan.tipe === 'ok' ? NADA.in : NADA.neg).bg, border: `1px solid ${(pesan.tipe === 'ok' ? NADA.in : NADA.neg).garis}`, color: (pesan.tipe === 'ok' ? NADA.in : NADA.neg).teks,
        }}>
          {pesan.tipe === 'ok' ? <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> : <AlertTriangle size={16} style={{ flexShrink: 0 }} />}
          <span>{pesan.teks}</span>
        </div>
      )}

      {sinkronGagal && data && (
        <div role="status" style={{ display: 'flex', gap: '.55rem', alignItems: 'flex-start', padding: '.6rem 1rem', borderRadius: 12, marginBottom: '1rem', fontSize: '.76rem', background: NADA.warn.bg, border: `1px solid ${NADA.warn.garis}`, color: NADA.warn.teks }}>
          <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Sinkron terakhir gagal{isSuperAdmin ? ` (${payload?.source?.lastStatus})` : ''}. Menampilkan data valid terakhir — diperbarui {waktu(payload?.dataUpdatedAt)}.</span>
        </div>
      )}

      {memuat && (
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', padding: '2rem', color: 'var(--wr-txt-muted)' }}>
          <Loader2 size={16} className="ms-spin" /> Memuat Pencapaian Minimum Stok…
        </div>
      )}

      {!memuat && !data && (
        <div className="glass-panel" style={{ borderRadius: 16, padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--wr-txt-muted)', fontSize: '.85rem' }}>
          <PackageOpen size={34} style={{ opacity: .55, marginBottom: '.6rem' }} />
          <div style={{ fontWeight: 700, color: 'var(--txt-primary)', marginBottom: '.25rem' }}>Belum ada data Pencapaian Minimum Stok</div>
          {isSuperAdmin ? 'Klik "Sumber Sheet", tempel link tab "Resume ALL Weekly", lalu "Simpan & Sinkronkan".' : 'Hubungi Super Admin untuk mengatur sumber sheet-nya.'}
        </div>
      )}

      {!memuat && data && wi >= 0 && totalNow && (
        <div key={`${katAktif}-${wi}`}>
          {/* ── Hero: cincin pencapaian + KPI ── */}
          <div className="ms-hero">
            <div className="glass-panel ms-fade" style={{ borderRadius: 16, padding: '1.1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '.55rem', textAlign: 'center' }}>
              <div style={{ fontSize: '.7rem', color: 'var(--wr-txt-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Pencapaian {data.weeks[wi].label}{data.year ? ` · ${data.year}` : ''}
              </div>
              <Cincin nilai={pNow} tingkatNow={tingkatTotal} />
              <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Chip nada={NADA_TINGKAT[tingkatTotal]} teks={LABEL_TINGKAT[tingkatTotal]} />
                <Delta nilai={deltaTotal} />
              </div>
              <div style={{ fontSize: '.74rem', color: 'var(--wr-txt-muted)' }}>
                {pNow !== null && pNow < target
                  ? <>Kurang <strong style={{ color: 'var(--txt-primary)' }}>{fmtP(target - pNow)}</strong> lagi dari target {fmtP(target, 0)}</>
                  : <>Target {fmtP(target, 0)} tercapai</>}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '.75rem', alignContent: 'start' }}>
              <div className="ms-kpis">
                <KartuKpi ikon={Boxes} nada={NADA.info} label="Total Min Stock" nilai={`${fmtN(totalNow.min)} item`} sub={`${entri.length} lokasi · ${katAktif}`} />
                <KartuKpi ikon={PackageCheck} nada={NADA.in} label="Terealisasi" nilai={`${fmtN(totalNow.real)} item`}
                  sub={totalPrev ? `${totalNow.real - totalPrev.real >= 0 ? '+' : '−'}${fmtN(Math.abs(totalNow.real - totalPrev.real))} dari minggu lalu` : undefined} />
                <KartuKpi ikon={PackageOpen} nada={NADA.neg} label="Belum Terealisasi" nilai={`${fmtN(totalNow.min - totalNow.real)} item`}
                  sub={totalPrev ? `${totalNow.min - totalNow.real - (totalPrev.min - totalPrev.real) <= 0 ? '−' : '+'}${fmtN(Math.abs(totalNow.min - totalNow.real - (totalPrev.min - totalPrev.real)))} dari minggu lalu` : undefined} />
              </div>

              {/* Tren */}
              <div className="glass-panel ms-fade" style={{ borderRadius: 16, padding: '1rem 1.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap', marginBottom: '.6rem' }}>
                  <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--txt-primary)', flex: 1, minWidth: 160 }}>Tren pencapaian per minggu</div>
                  <div role="group" aria-label="Mode tren" style={{ display: 'flex', gap: '.3rem' }}>
                    {(['total', 'lokasi'] as const).map((m) => (
                      <button key={m} type="button" className="wr-tab" aria-pressed={modeTren === m} onClick={() => setModeTren(m)}
                        style={{ padding: '.3rem .7rem', borderRadius: 8, cursor: 'pointer', fontSize: '.72rem', fontWeight: modeTren === m ? 700 : 600,
                          ...(modeTren === m ? { background: NADA.out.bg, color: NADA.out.teks, border: `1px solid ${NADA.out.garis}` } : {}) }}>
                        {m === 'total' ? 'Total' : 'Per lokasi'}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ height: modeTren === 'lokasi' ? 300 : 230 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dataTren} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                      <XAxis dataKey="minggu" tick={{ fontSize: 10, fill: W['--wr-txt-muted'] }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
                      <YAxis domain={[batasBawah, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: W['--wr-txt-muted'] }} axisLine={false} tickLine={false} width={42} />
                      <Tooltip {...tooltipProps} formatter={(v: unknown) => (typeof v === 'number' ? fmtP(v) : '–')} cursor={{ stroke: W['--wr-cursor'] }} />
                      <ReferenceLine y={target} stroke={W['--wr-in']} strokeOpacity={0.7} strokeDasharray="4 4"
                        label={{ value: `Target ${fmtP(target, 0)}`, fill: W['--wr-in-text'], fontSize: 11, position: 'insideTopRight' }} />
                      <ReferenceLine x={`W${data.weeks[wi].n}`} stroke={W['--wr-out']} strokeOpacity={0.55} strokeDasharray="2 3" />
                      {modeTren === 'total'
                        ? <Line type="monotone" dataKey="Total" stroke={W['--wr-out']} strokeWidth={2.6} dot={{ r: 2.5 }} activeDot={{ r: 5 }} connectNulls />
                        : <>
                          <Legend wrapperStyle={{ fontSize: '.7rem' }} formatter={fmtLegend} />
                          {entri.map((e, i) => (
                            <Line key={e.key} type="monotone" dataKey={e.lokasi} stroke={rv(SERI_PANJANG[i % SERI_PANJANG.length])}
                              strokeDasharray={POLA_GARIS[i % POLA_GARIS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                          ))}
                        </>}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* ── Kartu per lokasi ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap', margin: '1.25rem 0 .7rem .2rem' }}>
            <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--txt-primary)', flex: 1, minWidth: 180 }}>
              Capaian per lokasi — {data.weeks[wi].label}
              <span style={{ fontWeight: 500, color: 'var(--wr-txt-muted)', fontSize: '.72rem' }}> · ≥90% baik, 75–89% waspada, &lt;75% rendah</span>
            </div>
            <select aria-label="Urutkan lokasi" value={urut} onChange={(e) => setUrut(e.target.value as Urut)} className="wr-ctl" style={{ ...kontrol, fontSize: '.78rem' }}>
              <option value="rendah">Capaian terendah dulu</option>
              <option value="tinggi">Capaian tertinggi dulu</option>
              <option value="belum">Belum terealisasi terbanyak</option>
              <option value="sheet">Urutan di sheet</option>
            </select>
          </div>

          <div className="ms-grid" style={{ marginBottom: '1.25rem' }}>
            {kartu.map((k, n) => {
              const t = tingkat(k.p, target), nada = NADA_TINGKAT[t];
              return (
                <div key={k.e.key} className="glass-panel ms-card ms-fade" style={{ borderRadius: 16, padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '.55rem', animationDelay: `${Math.min(n, 12) * 30}ms`, borderTop: `3px solid ${nada.warna}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.5rem', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 700, fontSize: '.92rem', color: 'var(--txt-primary)', lineHeight: 1.3, minWidth: 0, overflowWrap: 'anywhere' }}>{k.e.lokasi}</div>
                    <Chip nada={nada} teks={LABEL_TINGKAT[t]} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '.5rem', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '1.7rem', fontWeight: 800, color: nada.teks, lineHeight: 1 }}>{fmtP(k.p)}</div>
                    <Delta nilai={k.delta} />
                  </div>
                  <div className="ms-bar" role="progressbar" aria-valuenow={Math.round(k.p ?? 0)} aria-valuemin={0} aria-valuemax={100} aria-label={`Pencapaian ${k.e.lokasi}`}>
                    <i style={{ width: `${Math.max(0, Math.min(100, k.p ?? 0))}%`, background: nada.warna }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', fontSize: '.74rem', color: 'var(--wr-txt-muted)', flexWrap: 'wrap' }}>
                    <span><strong style={{ color: 'var(--txt-primary)' }}>{fmtN(k.cur?.real ?? 0)}</strong> / {fmtN(k.cur?.min ?? 0)} item</span>
                    <span>Belum: <strong style={{ color: k.belum > 0 ? NADA.neg.teks : 'var(--txt-primary)' }}>{fmtN(k.belum)}</strong></span>
                  </div>

                  {k.anomali && (
                    <div role="note" style={{ display: 'flex', gap: '.4rem', fontSize: '.7rem', padding: '.4rem .55rem', borderRadius: 8, background: NADA.warn.bg, border: `1px solid ${NADA.warn.garis}`, color: NADA.warn.teks }}>
                      <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> Realisasi minggu ini 0 padahal minggu lalu terisi — kemungkinan data belum diisi di sheet.
                    </div>
                  )}

                  {k.e.rincian && k.e.rincian.length > 1 && (
                    <div style={{ display: 'grid', gap: '.35rem', marginTop: '.1rem' }}>
                      {k.e.rincian.map((r) => {
                        const a = r.seri[wi]; const p = pct(a);
                        if (!a) return null;
                        return (
                          <div key={r.kategori}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.68rem', color: 'var(--wr-txt-muted)' }}>
                              <span>{r.kategori}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtP(p, 0)} · {fmtN(a.real)}/{fmtN(a.min)}</span>
                            </div>
                            <div className="ms-bar ms-mini"><i style={{ width: `${Math.max(0, Math.min(100, p ?? 0))}%`, background: NADA_TINGKAT[tingkat(p, target)].warna }} /></div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', paddingTop: '.2rem' }}>
                    <Sparkline nilai={k.tren} warna={nada.warna} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.62rem', color: 'var(--wr-txt-muted)' }}>
                      <span>{data.weeks[mingguIdx[0]].label}</span><span>{data.weeks[mingguIdx[last]].label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Tabel rinci ── */}
          <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.1rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--txt-primary)', marginBottom: '.6rem' }}>Rincian {data.weeks[wi].label}</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="wr-tbl ms-tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Lokasi', 'Min Stock', 'Terealisasi', 'Belum', 'Pencapaian', 'Δ Minggu lalu'].map((h, i) => (
                      <th key={h} className={i === 1 || i === 5 ? 'ms-hide-sm' : undefined} style={{ padding: '.5rem .65rem', fontSize: '.7rem', textAlign: i >= 1 ? 'right' : 'left', whiteSpace: 'nowrap', ...(i === 0 ? { position: 'sticky', left: 0, zIndex: 1 } : {}) }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.groups.filter((g) => katAktif === SEMUA || g.category === katAktif).flatMap((g) => [
                    <tr key={`h|${g.category}`}>
                      <td colSpan={6} style={{ padding: '.55rem .65rem .3rem', fontSize: '.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: NADA.info.teks }}>{g.category}</td>
                    </tr>,
                    ...g.rows.map((r, i) => {
                      const cur = aggDari(r.v[wi] ?? null); if (!cur) return null;
                      const prev = wiPrev >= 0 ? aggDari(r.v[wiPrev] ?? null) : null;
                      const p = pct(cur), pp = pct(prev), d = p !== null && pp !== null ? p - pp : null;
                      const n = NADA_TINGKAT[tingkat(p, target)];
                      const td: CSSProperties = { padding: '.45rem .65rem', fontSize: '.78rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
                      return (
                        <tr key={`${g.category}|${r.location}|${i}`} className="wr-row">
                          <td style={{ ...td, fontWeight: 600, color: 'var(--txt-primary)', position: 'sticky', left: 0, background: 'var(--bg-card, var(--wr-th-bg))', zIndex: 1 }}>{r.location}</td>
                          <td className="ms-hide-sm" style={{ ...td, textAlign: 'right' }}>{fmtN(cur.min)}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{fmtN(cur.real)}</td>
                          <td style={{ ...td, textAlign: 'right', color: cur.min - cur.real > 0 ? NADA.neg.teks : undefined }}>{fmtN(cur.min - cur.real)}</td>
                          <td style={{ ...td, textAlign: 'right', color: n.teks, fontWeight: 700 }}>{fmtP(p)}</td>
                          <td className="ms-hide-sm" style={{ ...td, textAlign: 'right', color: d === null ? 'var(--wr-txt-muted)' : d > 0 ? NADA.in.teks : d < 0 ? NADA.neg.teks : 'var(--wr-txt-muted)' }}>
                            {d === null ? '–' : `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(Math.round(d * 10) / 10).toLocaleString('id-ID')}`}
                          </td>
                        </tr>
                      );
                    }),
                  ])}
                  <tr style={{ borderTop: '2px solid var(--wr-line)' }}>
                    <td style={{ padding: '.55rem .65rem', fontSize: '.78rem', fontWeight: 800, color: 'var(--txt-primary)', whiteSpace: 'nowrap' }}>Total {katAktif}</td>
                    <td className="ms-hide-sm" style={{ padding: '.55rem .65rem', textAlign: 'right', fontWeight: 800, fontSize: '.78rem' }}>{fmtN(totalNow.min)}</td>
                    <td style={{ padding: '.55rem .65rem', textAlign: 'right', fontWeight: 800, fontSize: '.78rem' }}>{fmtN(totalNow.real)}</td>
                    <td style={{ padding: '.55rem .65rem', textAlign: 'right', fontWeight: 800, fontSize: '.78rem' }}>{fmtN(totalNow.min - totalNow.real)}</td>
                    <td style={{ padding: '.55rem .65rem', textAlign: 'right', fontWeight: 800, fontSize: '.78rem', color: NADA_TINGKAT[tingkatTotal].teks }}>{fmtP(pNow)}</td>
                    <td className="ms-hide-sm" style={{ padding: '.55rem .65rem', textAlign: 'right', fontWeight: 800, fontSize: '.78rem' }}>{deltaTotal === null ? '–' : `${deltaTotal > 0 ? '+' : deltaTotal < 0 ? '−' : ''}${Math.abs(Math.round(deltaTotal * 10) / 10).toLocaleString('id-ID')}`}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: '.68rem', color: 'var(--wr-txt-muted)', marginTop: '.6rem' }}>
              Data diperbarui {waktu(payload?.dataUpdatedAt)}{payload?.source?.manual ? ' (impor manual)' : ' · sinkron otomatis tiap 5 menit'}. Persentase dihitung dari Terealisasi ÷ Jumlah Min Stock.
            </div>
          </div>
        </div>
      )}
    </>
  );
}