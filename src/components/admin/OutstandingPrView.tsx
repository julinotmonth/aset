// Tab "Outstanding PR" di dalam Laporan Mingguan.
//
// Sumber: tab "RESUME ALL MS&WS" pada workbook "Outstanding PR ALL MS & WS" — jumlah PR
// yang belum selesai per site (MS/WS/LNG), per kategori (FastMoving, Min Stock/Critical
// Part, Other, Overhold) dan per status ERP (Pending Approval / Released).
// Satu data untuk seluruh perusahaan; parsing & penyimpanan ada di
// server/src/outstandingPr.js. Sumber Sheet/Sync hanya untuk Super Admin.
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import {
  Link2, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Upload, Info, Download,
  FileText, FileCheck2, Hourglass, MapPin,
} from 'lucide-react';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { api } from '../../lib/api';
import type { AuthState } from '../../types';
import { NADA, SERI_PANJANG, tooltipProps, fmtLegend, WR_CSS, useWrTema } from './wrTema';
import type { Nada } from './wrTema';

// ── Tipe (sesuai payload GET /api/outstanding-pr) ─────────────────────────
interface Jumlah { pending: number; released: number; total: number }
interface OsCat extends Jumlah { name: string }
interface OsSite { key: string; label: string; categories: OsCat[]; totals: Jumlah }
interface OsHist { week: string; label: string; date: string; total: number; pending: number; released: number }
interface OsData {
  title: string; categories: string[]; sites: OsSite[]; grand: Jumlah; sheetGrand: Jumlah | null; notes: string[]; history: OsHist[];
}
interface OsSource { autoSync: boolean; lastSyncAt: string | null; lastStatus: string; sheetUrl?: string; manual?: boolean }
interface OsPayload {
  source: OsSource | null; data: OsData | null; dataUpdatedAt?: string | null;
  sync?: { ok: boolean; error?: string; rows?: number; sites?: number };
}

const SEMUA = 'Semua';
const fmtN = (n: number) => n.toLocaleString('id-ID');
const fmtP = (n: number) => `${n.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;
const bagi = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

function KartuKpi({ ikon: Ikon, label, nilai, sub, nada }: { ikon: React.ElementType; label: string; nilai: string; sub?: string; nada: Nada }) {
  return (
    <div className="glass-panel os-fade" style={{ borderRadius: 14, padding: '.9rem 1.05rem', display: 'flex', gap: '.8rem', alignItems: 'center' }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: nada.bg, color: nada.teks, border: `1px solid ${nada.garis}`, flexShrink: 0 }}>
        <Ikon size={20} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '.68rem', color: 'var(--wr-txt-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--txt-primary)', lineHeight: 1.2 }}>{nilai}</div>
        {sub && <div style={{ fontSize: '.7rem', color: 'var(--wr-txt-muted)', overflowWrap: 'anywhere' }}>{sub}</div>}
      </div>
    </div>
  );
}

function Chip({ nada, teks }: { nada: Nada; teks: string }) {
  return (
    <span style={{ fontSize: '.68rem', fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: nada.bg, color: nada.teks, border: `1px solid ${nada.garis}`, whiteSpace: 'nowrap' }}>{teks}</span>
  );
}

const OS_CSS = `
.os-hero{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:1rem;margin-bottom:1rem}
.os-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:.75rem;margin-bottom:1rem}
.os-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.85rem}
.os-card{transition:transform .18s ease}
.os-card:hover{transform:translateY(-2px)}
.os-seg{display:flex;height:10px;border-radius:99px;overflow:hidden;background:var(--wr-line)}
.os-seg>i{display:block;min-width:4px;transition:flex .6s cubic-bezier(.22,1,.36,1)}
.os-thin{height:5px;border-radius:99px;background:var(--wr-line);overflow:hidden}
.os-thin>i{display:block;height:100%;border-radius:99px}
.os-legend{display:flex;align-items:center;gap:.5rem;width:100%;padding:.4rem .55rem;border-radius:9px;background:transparent;border:1px solid transparent;cursor:pointer;text-align:left;font-size:.78rem;color:var(--txt-primary);transition:background .15s,border-color .15s}
.os-legend:hover{background:var(--wr-line)}
.os-legend[aria-pressed=true]{border-color:var(--wr-line);background:var(--wr-line)}
.os-fade{animation:osIn .4s ease both}
@keyframes osIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.os-spin{animation:osSpin 1s linear infinite}
@keyframes osSpin{to{transform:rotate(360deg)}}
.os-tbl{min-width:560px}
@media (max-width:900px){.os-hero{grid-template-columns:minmax(0,1fr)}}
@media (max-width:480px){.os-grid{grid-template-columns:minmax(0,1fr)}.os-tbl th,.os-tbl td{padding-left:.4rem!important;padding-right:.4rem!important}}
@media (prefers-reduced-motion:reduce){.os-card,.os-seg>i,.os-fade,.os-spin{transition:none;animation:none}}
`;

interface Props { auth: AuthState }

export function OutstandingPrView({ auth }: Props) {
  const isSuperAdmin = auth.role === 'Super Admin';
  const { W, rv, pie } = useWrTema();

  const [payload, setPayload] = useState<OsPayload | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [menyinkron, setMenyinkron] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'error'; teks: string } | null>(null);
  const [panelSumber, setPanelSumber] = useState(false);
  const [urlSheet, setUrlSheet] = useState('');
  const [kategori, setKategori] = useState(SEMUA);
  const fileRef = useRef<HTMLInputElement>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const p = await api.get<OsPayload>('/outstanding-pr');
      setPayload(p);
      if (p.source?.sheetUrl) setUrlSheet(p.source.sheetUrl);
    } catch (err) {
      setPesan({ tipe: 'error', teks: err instanceof Error ? err.message : 'Gagal memuat data Outstanding PR.' });
    } finally { setMemuat(false); }
  }, []);
  useEffect(() => { void muat(); }, [muat]);

  const terapkan = (p: OsPayload, sukses: string) => {
    setPayload(p);
    if (p.source?.sheetUrl) setUrlSheet(p.source.sheetUrl);
    if (p.sync && !p.sync.ok) setPesan({ tipe: 'error', teks: p.sync.error || 'Sinkronisasi gagal.' });
    else setPesan({ tipe: 'ok', teks: `${sukses} ${p.sync?.sites ?? ''} site, ${p.sync?.rows ?? ''} baris kategori terbaca.` });
  };
  const jalankan = async (fn: () => Promise<OsPayload>, sukses: string, tutup = false) => {
    setMenyinkron(true); setPesan(null);
    try { const p = await fn(); terapkan(p, sukses); if (tutup && p.sync?.ok) setPanelSumber(false); }
    catch (err) { setPesan({ tipe: 'error', teks: err instanceof Error ? err.message : 'Permintaan gagal.' }); }
    finally { setMenyinkron(false); }
  };
  const simpanSumber = () => jalankan(() => api.post<OsPayload>('/outstanding-pr/source', { sheetUrl: urlSheet, autoSync: true }), 'Sumber disimpan & disinkronkan.', true);
  const sinkronkan = () => jalankan(() => api.post<OsPayload>('/outstanding-pr/sync', {}), 'Sinkron selesai.');
  const imporCsv = async (f: File) => {
    await jalankan(async () => api.post<OsPayload>('/outstanding-pr/import', { csv: await f.text() }), 'Impor CSV selesai.');
    if (fileRef.current) fileRef.current.value = '';
  };

  const data = payload?.data ?? null;
  const kats = useMemo(() => data?.categories ?? [], [data]);
  const aktif = kats.includes(kategori) ? kategori : SEMUA;
  const warna = useCallback((k: string) => pie(SERI_PANJANG[Math.max(0, kats.indexOf(k)) % SERI_PANJANG.length]), [pie, kats]);

  const barisSite = useMemo(() => {
    if (!data) return [];
    return data.sites.map((s) => {
      const cats = s.categories.filter((c) => aktif === SEMUA || c.name === aktif);
      const j = cats.reduce<Jumlah>((a, c) => ({ pending: a.pending + c.pending, released: a.released + c.released, total: a.total + c.total }), { pending: 0, released: 0, total: 0 });
      return { s, cats, ...j };
    }).sort((a, b) => b.total - a.total);
  }, [data, aktif]);

  const grand = useMemo(() => barisSite.reduce<Jumlah>((a, r) => ({ pending: a.pending + r.pending, released: a.released + r.released, total: a.total + r.total }), { pending: 0, released: 0, total: 0 }), [barisSite]);
  const perKategori = useMemo(() => kats.map((k) => ({
    name: k, total: data?.sites.reduce((a, s) => a + (s.categories.find((c) => c.name === k)?.total ?? 0), 0) ?? 0,
  })), [kats, data]);
  const totalSemua = data?.grand.total ?? 0;
  const teratas = barisSite[0];

  const dataBar = useMemo(() => barisSite.map((r) => ({
    name: r.s.label, Total: r.total, ...Object.fromEntries(kats.map((k) => [k, r.cats.find((c) => c.name === k)?.total ?? 0])),
  })), [barisSite, kats]);

  const unduhCsv = () => {
    if (!data) return;
    const head = ['Site', ...kats, 'Pending Approval', 'Released', 'Total PR'];
    const isi = barisSite.map((r) => [r.s.label, ...kats.map((k) => String(r.cats.find((c) => c.name === k)?.total ?? 0)), String(r.pending), String(r.released), String(r.total)]);
    const csv = [head, ...isi].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'OUTSTANDING_PR.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const tombol: CSSProperties = { display: 'flex', alignItems: 'center', gap: '.4rem', padding: '.5rem .85rem', borderRadius: 10, cursor: 'pointer' };
  const waktu = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '–');
  const sinkronGagal = !!payload?.source?.lastStatus && !['OK', 'Impor manual'].includes(payload.source.lastStatus);
  const warnaMuted = 'var(--wr-txt-muted)';

  return (
    <>
      <style>{WR_CSS}{OS_CSS}</style>

      {/* ── Bar kontrol ── */}
      <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '.75rem', alignItems: 'center' }}>
        {data && (
          <div role="group" aria-label="Kategori" style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
            {[SEMUA, ...kats].map((k) => (
              <button key={k} type="button" className="wr-tab" aria-pressed={k === aktif} onClick={() => setKategori(k)}
                style={{
                  padding: '.45rem .85rem', borderRadius: 10, cursor: 'pointer', fontSize: '.78rem', fontWeight: k === aktif ? 700 : 600,
                  ...(k === aktif ? { background: NADA.info.bg, color: NADA.info.teks, border: `1px solid ${NADA.info.garis}`, boxShadow: `inset 0 -2px 0 ${NADA.info.warna}` } : {}),
                }}>{k}</button>
            ))}
          </div>
        )}
        <div style={{ flex: 1 }} />
        {data && <button type="button" className="wr-btn" onClick={unduhCsv} style={tombol} title="Unduh matriks site × kategori"><Download size={15} /> CSV</button>}
        {isSuperAdmin && (
          <>
            <button type="button" className="wr-btn wr-btn--info" onClick={() => setPanelSumber((v) => !v)} style={tombol}><Link2 size={15} /> Sumber Sheet</button>
            <button type="button" className="wr-btn wr-btn--primary" onClick={sinkronkan} disabled={menyinkron || !payload?.source?.sheetUrl}
              style={{ ...tombol, cursor: payload?.source?.sheetUrl ? 'pointer' : 'not-allowed', opacity: payload?.source?.sheetUrl ? 1 : .5 }}>
              {menyinkron ? <Loader2 size={15} className="os-spin" /> : <RefreshCw size={15} />} Sync Sekarang
            </button>
          </>
        )}
      </div>

      {isSuperAdmin && panelSumber && (
        <div className="glass-panel os-fade" style={{ borderRadius: 16, padding: '1.1rem 1.25rem', marginBottom: '1rem', display: 'grid', gap: '.75rem' }}>
          <label style={{ fontSize: '.78rem', color: warnaMuted }}>
            Link Google Spreadsheet tab "RESUME ALL MS&amp;WS"
            <input value={urlSheet} onChange={(e) => setUrlSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..."
              className="wr-ctl" style={{ display: 'block', width: '100%', marginTop: '.35rem', padding: '.5rem .75rem', borderRadius: 10 }} />
          </label>
          <div style={{ fontSize: '.72rem', color: warnaMuted, lineHeight: 1.6 }}>
            Buka tab ringkasan di Google Sheets lalu salin URL dari address bar (ada <code>?gid=…</code>). Sheet harus dibagikan sebagai{' '}
            <strong>Anyone with the link — Viewer</strong>; disinkronkan otomatis tiap 5 menit. Data berlaku untuk <strong>seluruh site</strong>.
            {' '}Sync terakhir: {waktu(payload?.source?.lastSyncAt)}{payload?.source?.lastStatus ? ` (${payload.source.lastStatus})` : ''}.
          </div>
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
            <button type="button" className="wr-btn wr-btn--primary" onClick={simpanSumber} disabled={menyinkron || !urlSheet.trim()} style={tombol}>
              {menyinkron && <Loader2 size={15} className="os-spin" />} Simpan &amp; Sinkronkan
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void imporCsv(f); }} />
            <button type="button" className="wr-btn" onClick={() => fileRef.current?.click()} disabled={menyinkron} style={tombol}
              title="Cadangan bila sheet tidak bisa dibuat publik: File → Download → CSV pada tab ini"><Upload size={15} /> Impor CSV (cadangan)</button>
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
        <div role="status" style={{ display: 'flex', gap: '.55rem', padding: '.6rem 1rem', borderRadius: 12, marginBottom: '1rem', fontSize: '.76rem', background: NADA.warn.bg, border: `1px solid ${NADA.warn.garis}`, color: NADA.warn.teks }}>
          <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Sinkron terakhir gagal{isSuperAdmin ? ` (${payload?.source?.lastStatus})` : ''}. Menampilkan data valid terakhir — diperbarui {waktu(payload?.dataUpdatedAt)}.</span>
        </div>
      )}

      {memuat && <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', padding: '2rem', color: warnaMuted }}><Loader2 size={16} className="os-spin" /> Memuat Outstanding PR…</div>}

      {!memuat && !data && (
        <div className="glass-panel" style={{ borderRadius: 16, padding: '2.5rem 1.5rem', textAlign: 'center', color: warnaMuted, fontSize: '.85rem' }}>
          <FileText size={34} style={{ opacity: .55, marginBottom: '.6rem' }} />
          <div style={{ fontWeight: 700, color: 'var(--txt-primary)', marginBottom: '.25rem' }}>Belum ada data Outstanding PR</div>
          {isSuperAdmin ? 'Klik "Sumber Sheet", tempel link tab "RESUME ALL MS&WS", lalu "Simpan & Sinkronkan".' : 'Hubungi Super Admin untuk mengatur sumber sheet-nya.'}
        </div>
      )}

      {!memuat && data && (
        <div key={aktif}>
          {data.notes.length > 0 && (
            <div role="note" className="os-fade" style={{ display: 'flex', gap: '.6rem', padding: '.75rem 1rem', borderRadius: 12, marginBottom: '1rem', fontSize: '.76rem', background: NADA.warn.bg, border: `1px solid ${NADA.warn.garis}`, color: NADA.warn.teks }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div><strong>Catatan data</strong>
                <ul style={{ margin: '.25rem 0 0', paddingLeft: '1.1rem', lineHeight: 1.55 }}>{data.notes.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
            </div>
          )}

          {/* ── KPI ── */}
          <div className="os-kpis">
            <KartuKpi ikon={FileText} nada={NADA.info} label="Total Outstanding PR" nilai={`${fmtN(grand.total)} PR`}
              sub={`${barisSite.length} site · ${aktif === SEMUA ? `${kats.length} kategori` : aktif}`} />
            <KartuKpi ikon={FileCheck2} nada={NADA.in} label="Released di ERP" nilai={`${fmtN(grand.released)} PR`} sub={`${fmtP(bagi(grand.released, grand.total))} dari total`} />
            <KartuKpi ikon={Hourglass} nada={grand.pending > 0 ? NADA.warn : NADA.neutral} label="Pending Approval" nilai={`${fmtN(grand.pending)} PR`}
              sub={grand.pending > 0 ? `${fmtP(bagi(grand.pending, grand.total))} menunggu persetujuan` : 'Tidak ada yang tertahan'} />
            <KartuKpi ikon={MapPin} nada={NADA.out} label="Site Terbanyak" nilai={teratas && teratas.total > 0 ? teratas.s.label : '–'}
              sub={teratas && teratas.total > 0 ? `${fmtN(teratas.total)} PR · ${fmtP(bagi(teratas.total, grand.total))} dari total` : undefined} />
          </div>

          {/* ── Chart: per site (bertumpuk) + komposisi kategori ── */}
          <div className="os-hero">
            <div className="glass-panel os-fade" style={{ borderRadius: 16, padding: '1rem 1.1rem', minWidth: 0 }}>
              <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--txt-primary)', marginBottom: '.6rem' }}>PR outstanding per site</div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dataBar} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                    <XAxis dataKey="name" interval={0} tick={{ fontSize: 10, fill: W['--wr-txt-muted'] }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: W['--wr-txt-muted'] }} axisLine={false} tickLine={false} width={34} />
                    <Tooltip {...tooltipProps} formatter={(v: unknown, n: unknown) => [`${v} PR`, String(n)]} cursor={{ stroke: W['--wr-cursor'] }} />
                    <Legend wrapperStyle={{ fontSize: '.7rem' }} formatter={fmtLegend} />
                    {/* Garis tebal = total PR per site; garis tipis = per kategori. */}
                    <Line type="monotone" dataKey="Total" stroke={W['--wr-out']} strokeWidth={2.6} dot={{ r: 2.5 }} activeDot={{ r: 5 }} />
                    {kats.map((k) => (
                      <Line key={k} type="monotone" dataKey={k} stroke={warna(k)} strokeWidth={1.6} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel os-fade" style={{ borderRadius: 16, padding: '1rem 1.1rem', minWidth: 0 }}>
              <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--txt-primary)', marginBottom: '.2rem' }}>Komposisi kategori</div>
              <div style={{ fontSize: '.7rem', color: warnaMuted, marginBottom: '.4rem' }}>Klik kategori untuk memfilter seluruh halaman</div>
              <div style={{ position: 'relative', height: 190 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={perKategori} dataKey="total" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none" onClick={(d) => setKategori((p) => (p === d.name ? SEMUA : String(d.name)))}>
                      {perKategori.map((c) => <Cell key={c.name} fill={warna(c.name)} fillOpacity={aktif === SEMUA || aktif === c.name ? 1 : 0.25} style={{ cursor: 'pointer' }} />)}
                    </Pie>
                    <Tooltip {...tooltipProps} formatter={(v: unknown, n: unknown) => [`${v} PR`, String(n)]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', textAlign: 'center' }}>
                  <div><div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--txt-primary)', lineHeight: 1 }}>{fmtN(totalSemua)}</div>
                    <div style={{ fontSize: '.65rem', color: warnaMuted }}>PR total</div></div>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '.1rem', marginTop: '.4rem' }}>
                {perKategori.map((c) => (
                  <button key={c.name} type="button" className="os-legend" aria-pressed={aktif === c.name} onClick={() => setKategori((p) => (p === c.name ? SEMUA : c.name))}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: warna(c.name), flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{c.name}</span>
                    <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtN(c.total)}</strong>
                    <span style={{ color: warnaMuted, fontSize: '.7rem', minWidth: 42, textAlign: 'right' }}>{fmtP(bagi(c.total, totalSemua))}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Kartu per site ── */}
          <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--txt-primary)', margin: '1.25rem 0 .7rem .2rem' }}>
            Rincian per site <span style={{ fontWeight: 500, color: warnaMuted, fontSize: '.72rem' }}>· diurutkan dari PR terbanyak</span>
          </div>
          <div className="os-grid" style={{ marginBottom: '1.25rem' }}>
            {barisSite.map((r, n) => {
              const nada = r.pending > 0 ? NADA.warn : r.total === 0 ? NADA.in : NADA.info;
              return (
                <div key={r.s.key} className="glass-panel os-card os-fade" style={{ borderRadius: 16, padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '.6rem', borderTop: `3px solid ${nada.warna}`, animationDelay: `${n * 40}ms` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--txt-primary)', minWidth: 0, overflowWrap: 'anywhere' }}>{r.s.label}</div>
                    {r.pending > 0 ? <Chip nada={NADA.warn} teks={`${r.pending} pending`} /> : <Chip nada={NADA.in} teks="Tanpa pending" />}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '.4rem' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, color: 'var(--txt-primary)' }}>{fmtN(r.total)}</span>
                    <span style={{ fontSize: '.78rem', color: warnaMuted }}>PR outstanding</span>
                  </div>
                  {r.total > 0 ? (
                    <div className="os-seg" role="img" aria-label={`Komposisi kategori ${r.s.label}`}>
                      {r.cats.filter((c) => c.total > 0).map((c) => <i key={c.name} title={`${c.name}: ${c.total} PR`} style={{ flex: c.total, background: warna(c.name) }} />)}
                    </div>
                  ) : <div style={{ fontSize: '.74rem', color: NADA.in.teks }}>Tidak ada PR outstanding pada filter ini.</div>}
                  <div style={{ display: 'grid', gap: '.3rem' }}>
                    {r.cats.map((c) => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.76rem', opacity: c.total === 0 ? 0.5 : 1 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: warna(c.name), flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', color: warnaMuted }}>{c.name}</span>
                        {c.pending > 0 && <span title="Pending approval" style={{ color: NADA.warn.teks, fontSize: '.68rem' }}>({c.pending} pending)</span>}
                        <strong style={{ color: 'var(--txt-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmtN(c.total)}</strong>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.68rem', color: warnaMuted, marginBottom: 3 }}>
                      <span>Kontribusi terhadap total</span><span>{fmtP(bagi(r.total, grand.total))}</span>
                    </div>
                    <div className="os-thin"><i style={{ width: `${Math.min(100, bagi(r.total, grand.total))}%`, background: nada.warna }} /></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Matriks ── */}
          <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.1rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--txt-primary)', marginBottom: '.6rem' }}>Matriks site × kategori</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="wr-tbl os-tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Site', ...kats.filter((k) => aktif === SEMUA || k === aktif), 'Pending', 'Released', 'Total'].map((h, i) => (
                      <th key={h} style={{ padding: '.5rem .65rem', fontSize: '.7rem', textAlign: i === 0 ? 'left' : 'right', whiteSpace: 'nowrap', ...(i === 0 ? { position: 'sticky', left: 0, zIndex: 1 } : {}) }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {barisSite.map((r) => {
                    const td: CSSProperties = { padding: '.5rem .65rem', fontSize: '.8rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
                    return (
                      <tr key={r.s.key} className="wr-row">
                        <td style={{ ...td, textAlign: 'left', fontWeight: 600, color: 'var(--txt-primary)', position: 'sticky', left: 0, background: 'var(--bg-card, var(--wr-th-bg))', zIndex: 1 }}>{r.s.label}</td>
                        {kats.filter((k) => aktif === SEMUA || k === aktif).map((k) => {
                          const v = r.cats.find((c) => c.name === k)?.total ?? 0;
                          return <td key={k} style={{ ...td, color: v === 0 ? warnaMuted : 'var(--txt-primary)', opacity: v === 0 ? 0.55 : 1 }}>{fmtN(v)}</td>;
                        })}
                        <td style={{ ...td, color: r.pending > 0 ? NADA.warn.teks : warnaMuted, fontWeight: r.pending > 0 ? 700 : 400 }}>{fmtN(r.pending)}</td>
                        <td style={td}>{fmtN(r.released)}</td>
                        <td style={{ ...td, fontWeight: 800, color: 'var(--txt-primary)' }}>{fmtN(r.total)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ borderTop: '2px solid var(--wr-line)' }}>
                    <td style={{ padding: '.55rem .65rem', fontWeight: 800, fontSize: '.8rem', color: 'var(--txt-primary)' }}>Total</td>
                    {kats.filter((k) => aktif === SEMUA || k === aktif).map((k) => (
                      <td key={k} style={{ padding: '.55rem .65rem', textAlign: 'right', fontWeight: 800, fontSize: '.8rem' }}>{fmtN(perKategori.find((c) => c.name === k)?.total ?? 0)}</td>
                    ))}
                    <td style={{ padding: '.55rem .65rem', textAlign: 'right', fontWeight: 800, fontSize: '.8rem' }}>{fmtN(grand.pending)}</td>
                    <td style={{ padding: '.55rem .65rem', textAlign: 'right', fontWeight: 800, fontSize: '.8rem' }}>{fmtN(grand.released)}</td>
                    <td style={{ padding: '.55rem .65rem', textAlign: 'right', fontWeight: 800, fontSize: '.8rem' }}>{fmtN(grand.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Riwayat mingguan ── */}
          <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.1rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--txt-primary)', marginBottom: '.2rem' }}>Riwayat mingguan</div>
            <div style={{ fontSize: '.7rem', color: warnaMuted, marginBottom: '.6rem' }}>
              Sheet hanya berisi kondisi terkini, jadi riwayat direkam otomatis setiap sinkron (satu titik per minggu, total seluruh site).
            </div>
            {data.history.length >= 2 ? (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.history.map((h) => ({ minggu: h.label, 'Total PR': h.total, 'Pending Approval': h.pending }))} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                    <XAxis dataKey="minggu" tick={{ fontSize: 10, fill: W['--wr-txt-muted'] }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: W['--wr-txt-muted'] }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip {...tooltipProps} cursor={{ stroke: W['--wr-cursor'] }} />
                    <Legend wrapperStyle={{ fontSize: '.7rem' }} formatter={fmtLegend} />
                    <Line type="monotone" dataKey="Total PR" stroke={W['--wr-out']} strokeWidth={2.6} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="Pending Approval" stroke={rv(SERI_PANJANG[2])} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', fontSize: '.78rem', color: warnaMuted, padding: '.4rem 0' }}>
                <Info size={15} style={{ flexShrink: 0 }} />
                Baru {data.history.length} titik tercatat{data.history[0] ? ` (${data.history[0].label}: ${fmtN(data.history[0].total)} PR)` : ''}. Grafik tren muncul setelah minimal dua minggu terekam.
              </div>
            )}
          </div>

          <div style={{ fontSize: '.68rem', color: warnaMuted }}>
            Data diperbarui {waktu(payload?.dataUpdatedAt)}{payload?.source?.manual ? ' (impor manual)' : ' · sinkron otomatis tiap 5 menit'}. Angka dihitung dari jumlah per kategori pada sheet.
          </div>
        </div>
      )}
    </>
  );
}