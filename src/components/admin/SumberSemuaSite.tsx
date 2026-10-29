// Dialog "Hubungkan satu spreadsheet ke semua site" (Laporan Mingguan → Sumber Sheet).
//
// Alur 3 langkah:
//  1. Tempel URL spreadsheet → server membaca daftar tab dan mengusulkan tiap tab milik site mana
//  2. Tinjau & koreksi pemetaan tab → site (tab yang tidak jelas dipilih manual, tab lain diabaikan)
//  3. Simpan sumber semua site sekaligus, lalu sinkronkan satu per satu dengan progres terlihat
import { useEffect, useMemo, useState } from 'react';
import { Link2, X, Loader2, CheckCircle2, AlertTriangle, RefreshCw, ArrowRight, Info } from 'lucide-react';
import { api } from '../../lib/api';
import { jalankanSync } from '../../lib/syncClient';
import { labelPenuh } from './siteLabel';
import { NADA } from './wrTema';

type Arah = 'IN' | 'OUT' | 'ASET';
interface TabUsul { name: string; gid: string | null; arah: Arah; relevan: boolean; site: string | null; alasan: string }
interface HasilDiscover { sheetId: string; sumber: 'otomatis' | 'manual'; sites: { key: string; label: string }[]; tabs: TabUsul[] }
type StatusSite = { tahap: 'menunggu' | 'jalan' | 'ok' | 'gagal'; baris?: number; galat?: string };

const NAMA_ARAH: Record<Arah, string> = { IN: 'Barang Masuk', OUT: 'Barang Keluar', ASET: 'Aset' };

const CSS = `
.ssa-modal{position:fixed;inset:0;z-index:130;background:rgba(8,12,20,.55);display:grid;place-items:center;padding:1rem}
.ssa-dlg{width:min(860px,100%);max-height:92vh;overflow:auto;border-radius:20px;padding:1.2rem 1.3rem;background:var(--bg-card,var(--wr-tab-bg));border:1px solid var(--wr-line);box-shadow:0 24px 64px rgba(0,0,0,.35);display:grid;gap:.9rem}
.ssa-h{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}
.ssa-h h2{margin:0;font-size:1.05rem;color:var(--txt-primary);display:flex;gap:.5rem;align-items:center}
.ssa-p{margin:0;font-size:.78rem;line-height:1.55;color:var(--wr-txt-muted)}
.ssa-in{width:100%;padding:.55rem .75rem;border-radius:10px;font:inherit;font-size:.85rem}
.ssa-btn{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .9rem;border-radius:10px;font:inherit;font-size:.8rem;font-weight:700;cursor:pointer;background:var(--wr-btn-bg);color:var(--txt-primary);border:1px solid var(--wr-field-border)}
.ssa-btn:hover{background:var(--wr-btn-bg-hover)}
.ssa-btn:disabled{opacity:.5;cursor:not-allowed}
.ssa-btn.utama{background:var(--wr-in);color:var(--wr-on-in);border-color:transparent}
.ssa-btn:focus-visible,.ssa-in:focus-visible{outline:2px solid var(--wr-focus,#00D084);outline-offset:2px}
.ssa-tbl{width:100%;border-collapse:collapse;font-size:.8rem}
.ssa-tbl th{text-align:left;font-size:.66rem;letter-spacing:.05em;text-transform:uppercase;color:var(--wr-txt-muted);padding:.5rem .55rem;border-bottom:1px solid var(--wr-line)}
.ssa-tbl td{padding:.5rem .55rem;border-bottom:1px solid var(--wr-line);vertical-align:middle;color:var(--txt-secondary)}
.ssa-tbl td.k{color:var(--txt-primary);font-weight:600}
.ssa-tbl tr.abaikan td{opacity:.55}
.ssa-chip{display:inline-flex;font-size:.66rem;font-weight:700;padding:2px 8px;border-radius:99px;white-space:nowrap}
.ssa-ring{display:flex;flex-wrap:wrap;gap:.4rem}
.ssa-box{padding:.7rem .85rem;border-radius:12px;background:var(--wr-tab-bg);border:1px solid var(--wr-line);font-size:.78rem;color:var(--txt-secondary);line-height:1.5}
.ssa-prog{display:grid;gap:.45rem}
.ssa-prog>div{display:flex;justify-content:space-between;align-items:center;gap:.7rem;padding:.55rem .75rem;border-radius:12px;background:var(--wr-tab-bg);border:1px solid var(--wr-line);font-size:.8rem}
@keyframes ssa-spin{to{transform:rotate(360deg)}}
.ssa-spin{animation:ssa-spin .9s linear infinite}
@media (prefers-reduced-motion:reduce){.ssa-spin{animation:none}}
`;

export function SumberSemuaSite({ urlAwal, onTutup, onSelesai }: { urlAwal: string; onTutup: () => void; onSelesai: () => void }) {
  const [langkah, setLangkah] = useState<'url' | 'tinjau' | 'proses'>('url');
  const [url, setUrl] = useState(urlAwal);
  const [manual, setManual] = useState('');
  const [bukaManual, setBukaManual] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');
  const [data, setData] = useState<HasilDiscover | null>(null);
  const [tetap, setTetap] = useState<Record<string, string>>({});
  const [semuaTab, setSemuaTab] = useState(false);
  const [otomatis, setOtomatis] = useState(true);
  const [progres, setProgres] = useState<Record<string, StatusSite>>({});
  const [selesai, setSelesai] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sibuk) onTutup(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onTutup, sibuk]);

  const bacaTab = async () => {
    setSibuk(true); setGalat('');
    try {
      const tabs = manual.split('\n').map((t) => t.trim()).filter(Boolean);
      const hasil = await api.post<HasilDiscover>('/weekly-reports/source/discover', { sheetUrl: url, ...(tabs.length ? { tabs } : {}) });
      setData(hasil);
      setTetap(Object.fromEntries(hasil.tabs.map((t) => [t.name, t.relevan && t.site ? t.site : ''])));
      setLangkah('tinjau');
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membaca spreadsheet.');
      setBukaManual(true);
    } finally { setSibuk(false); }
  };

  const labelSite = (key: string) => labelPenuh(data?.sites.find((s) => s.key === key)?.label ?? key);
  const tabTampil = useMemo(() => (data ? data.tabs.filter((t) => semuaTab || t.relevan || tetap[t.name]) : []), [data, semuaTab, tetap]);
  const perSite = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [tab, site] of Object.entries(tetap)) if (site) m.set(site, [...(m.get(site) ?? []), tab]);
    return m;
  }, [tetap]);
  const tanpaTab = data ? data.sites.filter((s) => !perSite.has(s.key)) : [];
  const belumDipetakan = data ? data.tabs.filter((t) => t.relevan && !tetap[t.name]).length : 0;

  const simpanDanSinkron = async () => {
    if (!data || !perSite.size) return;
    setLangkah('proses'); setSibuk(true); setGalat(''); setSelesai(false);
    const daftar = [...perSite.entries()].map(([site, tabs]) => ({ site, tabs }));
    setProgres(Object.fromEntries(daftar.map((d) => [d.site, { tahap: 'menunggu' } as StatusSite])));
    try {
      await api.post('/weekly-reports/source/bulk', { sheetUrl: url, assignments: daftar, autoSync: otomatis });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan sumber.');
      setSibuk(false); setLangkah('tinjau');
      return;
    }
    for (const d of daftar) {
      setProgres((p) => ({ ...p, [d.site]: { tahap: 'jalan' } }));
      try {
        const h = await jalankanSync(d.site);
        const gagal = h.hasil.filter((x) => x.error);
        const baris = h.hasil.reduce((t, x) => t + (x.total ?? 0), 0);
        setProgres((p) => ({ ...p, [d.site]: gagal.length ? { tahap: 'gagal', baris, galat: gagal.map((g) => `${g.tab}: ${g.error}`).join(' · ') } : { tahap: 'ok', baris } }));
      } catch (e) {
        setProgres((p) => ({ ...p, [d.site]: { tahap: 'gagal', galat: e instanceof Error ? e.message : 'Sinkronisasi gagal.' } }));
      }
    }
    setSibuk(false); setSelesai(true);
  };

  const totalBaris = Object.values(progres).reduce((t, p) => t + (p.baris ?? 0), 0);

  return (
    <div className="ssa-modal" role="presentation" onClick={() => { if (!sibuk) onTutup(); }}>
      <style>{CSS}</style>
      <div className="ssa-dlg" role="dialog" aria-modal="true" aria-label="Hubungkan satu spreadsheet ke semua site" onClick={(e) => e.stopPropagation()}>
        <div className="ssa-h">
          <h2><Link2 size={18} aria-hidden="true" /> Hubungkan satu spreadsheet ke semua site</h2>
          <button type="button" className="ssa-btn" onClick={() => { if (selesai) onSelesai(); onTutup(); }} disabled={sibuk} aria-label="Tutup"><X size={15} /></button>
        </div>

        {/* ── Langkah 1 ── */}
        {langkah === 'url' && (
          <>
            <p className="ssa-p">Tempel satu link Google Spreadsheet yang berisi tab semua site. Sistem membaca daftar tab, mencocokkan tiap tab ke site-nya, lalu Anda tinjau sebelum disimpan.</p>
            <label style={{ display: 'grid', gap: '.35rem', fontSize: '.78rem', fontWeight: 700, color: 'var(--txt-secondary)' }}>URL Google Spreadsheet
              <input className="wr-ctl ssa-in" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" autoFocus />
            </label>
            <div className="ssa-box"><Info size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Spreadsheet harus dibagikan sebagai <b>Siapa saja yang memiliki link → Viewer</b> (Bagikan → Akses umum), kalau tidak server tidak bisa membacanya.</div>
            <details open={bukaManual} onToggle={(e) => setBukaManual((e.target as HTMLDetailsElement).open)}>
              <summary style={{ cursor: 'pointer', fontSize: '.78rem', fontWeight: 700, color: 'var(--txt-secondary)' }}>Daftar tab tidak terbaca otomatis? Tempel nama tab sendiri</summary>
              <textarea className="wr-ctl ssa-in" rows={5} value={manual} onChange={(e) => setManual(e.target.value)} style={{ marginTop: '.5rem', fontFamily: 'inherit', resize: 'vertical' }}
                placeholder={'Satu nama tab per baris, persis seperti di Google Sheets, mis.\nReport Weekly MS Wunut RDA IN\nBarang Masuk - RDA SETU'} />
            </details>
            {galat && <div className="ssa-box" role="alert" style={{ color: NADA.neg.teks, borderColor: NADA.neg.garis }}>{galat}</div>}
            <div><button type="button" className="ssa-btn utama" onClick={bacaTab} disabled={sibuk || !url.trim()}>
              {sibuk ? <Loader2 size={14} className="ssa-spin" /> : <ArrowRight size={14} />} Baca Tab Spreadsheet</button></div>
          </>
        )}

        {/* ── Langkah 2 ── */}
        {langkah === 'tinjau' && data && (
          <>
            <p className="ssa-p">
              Ditemukan <b>{data.tabs.length} tab</b>{data.sumber === 'manual' ? ' (dari daftar yang Anda tempel)' : ''}. Periksa kolom <b>Site</b>: usulan otomatis berasal dari nama tab.
              Tab yang tidak jelas milik siapa dibiarkan kosong — pilih sendiri, atau biarkan <b>Abaikan</b>.
            </p>

            <div className="ssa-ring" aria-label="Ringkasan per site">
              {data.sites.map((s) => {
                const n = perSite.get(s.key)?.length ?? 0;
                return <span key={s.key} className="ssa-chip" style={n ? { background: NADA.in.bg, color: NADA.in.teks, border: `1px solid ${NADA.in.garis}` } : { background: 'var(--wr-tab-bg)', color: 'var(--wr-txt-muted)', border: '1px solid var(--wr-line)' }}>
                  {labelPenuh(s.label)} · {n} tab</span>;
              })}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="ssa-tbl" style={{ minWidth: 560 }}>
                <thead><tr><th>Nama tab</th><th>Jenis</th><th>Site</th></tr></thead>
                <tbody>
                  {tabTampil.map((t) => (
                    <tr key={t.name} className={tetap[t.name] ? undefined : 'abaikan'}>
                      <td className="k">{t.name}{t.alasan && tetap[t.name] === t.site && <div style={{ fontSize: '.68rem', fontWeight: 400, color: 'var(--wr-txt-muted)' }}>{t.alasan}</div>}
                        {!tetap[t.name] && t.alasan && <div style={{ fontSize: '.68rem', fontWeight: 400, color: NADA.warn.teks }}>{t.alasan}</div>}</td>
                      <td>{NAMA_ARAH[t.arah]}</td>
                      <td>
                        <select className="wr-ctl ssa-in" style={{ padding: '.35rem .5rem' }} value={tetap[t.name] ?? ''} aria-label={`Site untuk tab ${t.name}`}
                          onChange={(e) => setTetap((p) => ({ ...p, [t.name]: e.target.value }))}>
                          <option value="">Abaikan</option>
                          {data.sites.map((s) => <option key={s.key} value={s.key}>{labelPenuh(s.label)}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.tabs.some((t) => !t.relevan && !tetap[t.name]) && (
              <label style={{ fontSize: '.76rem', color: 'var(--txt-secondary)', display: 'flex', gap: '.45rem', alignItems: 'center' }}>
                <input type="checkbox" checked={semuaTab} onChange={(e) => setSemuaTab(e.target.checked)} /> Tampilkan juga tab lain yang tampak bukan laporan ({data.tabs.filter((t) => !t.relevan && !tetap[t.name]).length})
              </label>
            )}

            {belumDipetakan > 0 && <div className="ssa-box" style={{ borderColor: NADA.warn.garis }}><AlertTriangle size={13} aria-hidden="true" style={{ verticalAlign: '-2px', color: NADA.warn.teks }} /> {belumDipetakan} tab yang tampak seperti laporan belum dipilih sitenya — tab itu tidak akan diimport.</div>}
            {tanpaTab.length > 0 && <div className="ssa-box">Site tanpa tab di daftar ini tidak diubah: {tanpaTab.map((s) => labelPenuh(s.label)).join(', ')}.</div>}
            <div className="ssa-box"><b>Perhatian:</b> sumber sheet site yang dipilih akan diganti ke spreadsheet ini. Data dari tab lama yang tidak ada di daftar baru akan dibersihkan saat sinkronisasi.</div>

            <label style={{ fontSize: '.78rem', color: 'var(--txt-secondary)', display: 'flex', gap: '.45rem', alignItems: 'center' }}>
              <input type="checkbox" checked={otomatis} onChange={(e) => setOtomatis(e.target.checked)} /> Sinkronkan otomatis tiap 5 menit
            </label>
            {galat && <div className="ssa-box" role="alert" style={{ color: NADA.neg.teks, borderColor: NADA.neg.garis }}>{galat}</div>}
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="ssa-btn" onClick={() => setLangkah('url')}>Kembali</button>
              <button type="button" className="ssa-btn utama" onClick={simpanDanSinkron} disabled={!perSite.size}>
                <RefreshCw size={14} /> Simpan &amp; Sinkronkan {perSite.size} Site</button>
            </div>
          </>
        )}

        {/* ── Langkah 3 ── */}
        {langkah === 'proses' && (
          <>
            <p className="ssa-p">{selesai ? `Selesai — ${totalBaris.toLocaleString('id-ID')} baris tersinkron.` : 'Menyimpan sumber dan menarik data tiap site. Jangan tutup jendela ini.'}</p>
            <div className="ssa-prog" aria-live="polite">
              {[...perSite.keys()].map((site) => {
                const p = progres[site] ?? { tahap: 'menunggu' as const };
                return (
                  <div key={site}>
                    <span style={{ color: 'var(--txt-primary)', fontWeight: 600 }}>{labelSite(site)} <span style={{ fontWeight: 400, color: 'var(--wr-txt-muted)' }}>· {perSite.get(site)?.length} tab</span>
                      {p.galat && <div style={{ fontSize: '.7rem', fontWeight: 400, color: NADA.neg.teks, marginTop: 2 }}>{p.galat}</div>}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', whiteSpace: 'nowrap', color: p.tahap === 'ok' ? NADA.in.teks : p.tahap === 'gagal' ? NADA.neg.teks : 'var(--wr-txt-muted)' }}>
                      {p.tahap === 'jalan' && <Loader2 size={14} className="ssa-spin" />}
                      {p.tahap === 'ok' && <CheckCircle2 size={14} />}
                      {p.tahap === 'gagal' && <AlertTriangle size={14} />}
                      {p.tahap === 'menunggu' ? 'Menunggu' : p.tahap === 'jalan' ? 'Menarik data…' : p.tahap === 'ok' ? `${(p.baris ?? 0).toLocaleString('id-ID')} baris` : 'Ada masalah'}
                    </span>
                  </div>
                );
              })}
            </div>
            {selesai && <div><button type="button" className="ssa-btn utama" onClick={() => { onSelesai(); onTutup(); }}>Selesai</button></div>}
          </>
        )}
      </div>
    </div>
  );
}