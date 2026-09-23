// Tab PICA (Problem / Identification / Corrective Action) di dalam Laporan
// Mingguan. Beda total struktur datanya dari Barang Masuk/Keluar/Aset: sheet
// sumbernya "lebar" — satu baris per isu, dengan satu kolom per minggu
// ("Week 34", "Week 35", ...) berisi catatan status terbaru minggu itu.
// Backend (src/pica.js) sudah meratakan itu jadi { updates: [{week,catatan}] }
// + latestWeek/latestNote, jadi komponen ini tinggal menampilkan.
import { useState, useEffect, useCallback, Fragment } from 'react';
import type { CSSProperties } from 'react';
import { Link2, RefreshCw, Loader2, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import type { SiteMeta } from '../../data/siteStore';

interface PicaUpdate { week: string; catatan: string }

interface PicaItem {
  id: string; site: string; no: string; tanggal: string | null;
  problem: string; identifikasi: string; deskripsi: string;
  targetDate: string | null; pic: string; status: string;
  updates: PicaUpdate[]; latestWeek: string; latestNote: string;
}

interface PicaSource {
  site: string; sheetId: string; gid: string;
  autoSync: boolean; lastSyncAt: string | null; lastStatus: string;
}

interface Props {
  site: string; labelSite: string; sites: SiteMeta[];
  onSiteChange: (site: string) => void; siteTerkunci: boolean;
}

const kontrol: CSSProperties = {
  padding: '.5rem .7rem', borderRadius: 10, background: 'rgba(255,255,255,.05)',
  border: '1px solid rgba(255,255,255,.12)', color: 'var(--txt-primary)', fontSize: '.82rem',
};
const tombol: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '.4rem', padding: '.5rem .85rem', borderRadius: 10,
  background: 'rgba(255,255,255,.06)', color: 'var(--txt-primary)', border: '1px solid rgba(255,255,255,.14)', cursor: 'pointer',
};

const fmtTgl = (iso: string | null) => {
  if (!iso) return '-';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const warnaStatus = (status: string): string => {
  const s = status.toLowerCase();
  if (s.includes('close') || s.includes('selesai') || s.includes('done')) return '#00D084';
  if (s.includes('overdue') || s.includes('terlambat')) return '#F87171';
  return '#FBBF24'; // On Going / default
};

export function PicaView({ site, labelSite, sites, onSiteChange, siteTerkunci }: Props) {
  const [items, setItems] = useState<PicaItem[]>([]);
  const [source, setSource] = useState<PicaSource | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [menyinkron, setMenyinkron] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'error'; teks: string } | null>(null);
  const [panelSumberTerbuka, setPanelSumberTerbuka] = useState(false);
  const [urlSheet, setUrlSheet] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('SEMUA');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [data, src] = await Promise.all([
        api.get<PicaItem[]>(`/pica?site=${encodeURIComponent(site)}`),
        api.get<PicaSource | null>(`/pica/source?site=${encodeURIComponent(site)}`),
      ]);
      setItems(data);
      setSource(src);
    } catch (err) {
      setPesan({ tipe: 'error', teks: err instanceof Error ? err.message : 'Gagal memuat data PICA.' });
    } finally {
      setMemuat(false);
    }
  }, [site]);

  useEffect(() => { void muat(); }, [muat]);

  const simpanSumber = async () => {
    try {
      const src = await api.post<PicaSource>('/pica/source', { site, sheetUrl: urlSheet, autoSync: true });
      setSource(src);
      setPesan({ tipe: 'ok', teks: 'Sumber sheet PICA disimpan. Klik "Sync Sekarang" untuk menariknya.' });
      setPanelSumberTerbuka(false);
    } catch (err) {
      setPesan({ tipe: 'error', teks: err instanceof Error ? err.message : 'Gagal menyimpan sumber.' });
    }
  };

  const sinkronkan = async () => {
    setMenyinkron(true);
    setPesan(null);
    try {
      const hasil = await api.post<{ inserted: number; updated: number; removed: number; total: number }>('/pica/sync', { site });
      setPesan({ tipe: 'ok', teks: `Sinkron selesai — ${hasil.total} isu (${hasil.inserted} baru, ${hasil.updated} diperbarui${hasil.removed ? `, ${hasil.removed} dihapus karena sudah tak ada di sheet` : ''}).` });
      await muat();
    } catch (err) {
      setPesan({ tipe: 'error', teks: err instanceof Error ? err.message : 'Sinkronisasi gagal.' });
    } finally {
      setMenyinkron(false);
    }
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const statusTersedia = Array.from(new Set(items.map((i) => i.status).filter(Boolean)));
  const ditampilkan = filterStatus === 'SEMUA' ? items : items.filter((i) => i.status === filterStatus);
  const kosong = !memuat && !items.length;

  return (
    <>
      {/* Filter + aksi */}
      <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '.75rem', alignItems: 'center' }}>
        <select value={site} onChange={(e) => onSiteChange(e.target.value)} disabled={siteTerkunci} style={kontrol}>
          {sites.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>

        {statusTersedia.length > 0 && (
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={kontrol}>
            <option value="SEMUA">Semua Status</option>
            {statusTersedia.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        <div style={{ flex: 1 }} />

        <button type="button" onClick={() => setPanelSumberTerbuka((v) => !v)}
          style={{ ...tombol, background: 'rgba(96,165,250,.12)', color: '#60A5FA', border: '1px solid rgba(96,165,250,.3)' }}>
          <Link2 size={15} /> Sumber Sheet
        </button>

        <button type="button" onClick={sinkronkan} disabled={menyinkron || !source}
          title={source ? 'Tarik ulang dari Google Spreadsheet' : 'Atur sumber sheet terlebih dahulu'}
          style={{ ...tombol, background: '#00D084', color: '#06281A', border: 'none', fontWeight: 600, padding: '.5rem .95rem', cursor: source ? 'pointer' : 'not-allowed', opacity: source ? 1 : .5 }}>
          {menyinkron ? <Loader2 size={15} /> : <RefreshCw size={15} />} Sync Sekarang
        </button>
      </div>

      {/* Panel konfigurasi sumber */}
      {panelSumberTerbuka && (
        <div className="glass-panel" style={{ borderRadius: 16, padding: '1.1rem 1.25rem', marginBottom: '1rem', display: 'grid', gap: '.75rem' }}>
          <label style={{ fontSize: '.78rem', color: 'var(--txt-muted)' }}>
            Link Google Spreadsheet tab PICA untuk {labelSite}
            <input value={urlSheet} onChange={(e) => setUrlSheet(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..."
              style={{ ...kontrol, display: 'block', width: '100%', marginTop: '.35rem' }} />
          </label>
          <div style={{ fontSize: '.72rem', color: 'var(--txt-muted)' }}>
            Tempel link yang langsung mengarah ke tab PICA-nya (klik tab-nya dulu di Google Sheets, lalu copy URL dari
            address bar — akan ada <code>?gid=...</code> di belakang). Beda dengan Laporan Mingguan Barang Masuk/Keluar,
            di sini <strong>tidak perlu ketik nama tab manual</strong> — gid dibaca otomatis dari link.
            Sheet harus dibagikan sebagai <strong>Anyone with the link — Viewer</strong>. Disinkronkan otomatis tiap 5 menit.
            {source?.lastSyncAt && <> Sync terakhir: {new Date(source.lastSyncAt).toLocaleString('id-ID')} ({source.lastStatus}).</>}
          </div>
          <div>
            <button type="button" onClick={simpanSumber}
              style={{ padding: '.5rem 1rem', borderRadius: 10, background: '#00D084', color: '#06281A', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
              Simpan Sumber
            </button>
          </div>
        </div>
      )}

      {pesan && (
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', padding: '.7rem .9rem', borderRadius: 12, marginBottom: '1rem', fontSize: '.8rem',
          background: pesan.tipe === 'ok' ? 'rgba(0,208,132,.1)' : 'rgba(245,158,11,.1)',
          border: `1px solid ${pesan.tipe === 'ok' ? 'rgba(0,208,132,.35)' : 'rgba(245,158,11,.35)'}`,
          color: pesan.tipe === 'ok' ? '#00D084' : '#F59E0B' }}>
          {pesan.tipe === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{pesan.teks}</span>
        </div>
      )}

      {memuat && (
        <div className="glass-panel" style={{ borderRadius: 16, padding: '2.5rem', textAlign: 'center', color: 'var(--txt-muted)' }}>Memuat PICA…</div>
      )}

      {kosong && (
        <div className="glass-panel" style={{ borderRadius: 16, padding: '2.5rem', textAlign: 'center', color: 'var(--txt-muted)' }}>
          Belum ada data PICA untuk {labelSite}. Atur sumber spreadsheet lalu klik "Sync Sekarang".
        </div>
      )}

      {!memuat && !kosong && (
        <div className="glass-panel" style={{ borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', background: 'rgba(255,255,255,.04)' }}>
                  <th style={{ padding: '.6rem .5rem', width: 28 }} />
                  <th style={{ padding: '.6rem .5rem' }}>No</th>
                  <th style={{ padding: '.6rem .5rem' }}>Tanggal</th>
                  <th style={{ padding: '.6rem .5rem' }}>Problem</th>
                  <th style={{ padding: '.6rem .5rem' }}>Identification</th>
                  <th style={{ padding: '.6rem .5rem' }}>Description</th>
                  <th style={{ padding: '.6rem .5rem' }}>Update Terbaru</th>
                  <th style={{ padding: '.6rem .5rem' }}>Target Date</th>
                  <th style={{ padding: '.6rem .5rem' }}>PIC</th>
                  <th style={{ padding: '.6rem .5rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {ditampilkan.map((it) => {
                  const buka = expanded.has(it.id);
                  return (
                    <Fragment key={it.id}>
                      <tr style={{ borderTop: '1px solid rgba(255,255,255,.06)', cursor: it.updates.length ? 'pointer' : 'default' }}
                        onClick={() => it.updates.length && toggle(it.id)}>
                        <td style={{ padding: '.55rem .5rem', color: 'var(--txt-muted)' }}>
                          {it.updates.length > 0 && (buka ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                        </td>
                        <td style={{ padding: '.55rem .5rem' }}>{it.no}</td>
                        <td style={{ padding: '.55rem .5rem', whiteSpace: 'nowrap' }}>{fmtTgl(it.tanggal)}</td>
                        <td style={{ padding: '.55rem .5rem', maxWidth: 220 }}>{it.problem}</td>
                        <td style={{ padding: '.55rem .5rem', maxWidth: 220, color: 'var(--txt-muted)' }}>{it.identifikasi || '-'}</td>
                        <td style={{ padding: '.55rem .5rem', maxWidth: 260 }}>{it.deskripsi || '-'}</td>
                        <td style={{ padding: '.55rem .5rem', maxWidth: 280 }}>
                          {it.latestWeek
                            ? <><span style={{ color: '#60A5FA', fontWeight: 600 }}>{it.latestWeek}:</span> {it.latestNote}</>
                            : <span style={{ color: 'var(--txt-muted)' }}>-</span>}
                        </td>
                        <td style={{ padding: '.55rem .5rem', whiteSpace: 'nowrap' }}>{fmtTgl(it.targetDate)}</td>
                        <td style={{ padding: '.55rem .5rem' }}>{it.pic || '-'}</td>
                        <td style={{ padding: '.55rem .5rem' }}>
                          <span style={{ padding: '.2rem .55rem', borderRadius: 999, fontSize: '.72rem', fontWeight: 600,
                            background: `${warnaStatus(it.status)}1F`, color: warnaStatus(it.status) }}>
                            {it.status || '-'}
                          </span>
                        </td>
                      </tr>
                      {buka && it.updates.length > 0 && (
                        <tr style={{ background: 'rgba(255,255,255,.02)' }}>
                          <td />
                          <td colSpan={9} style={{ padding: '.3rem .5rem .8rem 2rem' }}>
                            <div style={{ display: 'grid', gap: '.35rem' }}>
                              {it.updates.map((u, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '.6rem', fontSize: '.78rem' }}>
                                  <span style={{ color: '#60A5FA', fontWeight: 600, minWidth: 70 }}>{u.week}</span>
                                  <span style={{ color: 'var(--txt-muted)' }}>{u.catatan}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '.7rem 1rem', fontSize: '.75rem', color: 'var(--txt-muted)', borderTop: '1px solid rgba(255,255,255,.06)' }}>
            {ditampilkan.length} dari {items.length} isu ditampilkan. Klik baris untuk lihat riwayat catatan per minggu.
          </div>
        </div>
      )}
    </>
  );
}