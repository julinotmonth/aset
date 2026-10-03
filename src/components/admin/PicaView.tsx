// Tab PICA (Problem / Identification / Corrective Action) di dalam Laporan
// Mingguan. Beda total struktur datanya dari Barang Masuk/Keluar/Aset: sheet
// sumbernya "lebar" — satu baris per isu, dengan satu kolom per minggu
// ("Week 34", "Week 35", ...) berisi catatan status terbaru minggu itu.
// Backend (src/pica.js) sudah meratakan itu jadi { updates: [{week,catatan}] }
// + latestWeek/latestNote, jadi komponen ini tinggal menampilkan.
//
// Tabel utama sengaja dibuat RINGKAS (Problem dipotong satu baris, tanpa
// Identification/Description mentah) karena isi sheet aslinya sering berupa
// paragraf panjang berisi daftar bernomor ("1. Jasa Servis ... 2. Jasa
// Perbaikan ... 13. ...") yang bikin baris tabel meledak tingginya kalau
// ditampilkan mentah. Detailnya (termasuk daftar bernomor yang sudah
// dipecah rapi, dan riwayat mingguan yang dipadatkan per rentang minggu
// dengan catatan sama) baru muncul saat baris di-expand.
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import type { CSSProperties } from 'react';
import {
  Link2, RefreshCw, Loader2, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Search, ListChecks, Clock,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { SiteMeta } from '../../data/siteStore';
import { NADA, WR_CSS } from './wrTema';
import type { Nada } from './wrTema';

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

// Warna kontrol/tombol datang dari kelas .wr-ctl / .wr-btn (WR_CSS) — di sini
// hanya tata letak.
const kontrol: CSSProperties = { padding: '.5rem .7rem', borderRadius: 10, fontSize: '.82rem' };
const tombol: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '.4rem', padding: '.5rem .85rem', borderRadius: 10, cursor: 'pointer',
};

const fmtTgl = (iso: string | null) => {
  if (!iso) return '-';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const golonganStatus = (status: string): 'selesai' | 'overdue' | 'jalan' => {
  const s = status.toLowerCase();
  if (s.includes('close') || s.includes('selesai') || s.includes('done')) return 'selesai';
  if (s.includes('overdue') || s.includes('terlambat')) return 'overdue';
  return 'jalan'; // On Going / default
};
type Golongan = ReturnType<typeof golonganStatus>;
const NADA_GOLONGAN: Record<Golongan, Nada> = { selesai: NADA.in, overdue: NADA.neg, jalan: NADA.warn };
// Ikon = pembeda status selain warna.
const IKON_GOLONGAN: Record<Golongan, React.ElementType> = { selesai: CheckCircle2, overdue: AlertTriangle, jalan: Clock };

/** Banyak sel Description/Update di sheet PICA sebetulnya daftar bernomor
 * yang digabung jadi satu paragraf ("1. xxx 2. yyy 3. zzz"), karena satu
 * sel Sheets menampung beberapa sub-pekerjaan sekaligus. Dipecah balik jadi
 * array per item supaya bisa dirender sebagai daftar, bukan blok teks
 * raksasa. Kalau polanya tidak cocok (bukan daftar bernomor), dikembalikan
 * null — berarti tampilkan apa adanya sebagai paragraf biasa. */
function pecahDaftarBernomor(teks: string): string[] | null {
  if (!teks) return null;
  const bagian = teks.split(/\s(?=\d{1,2}\.\s)/g).map((s) => s.trim()).filter(Boolean);
  if (bagian.length < 2 || !bagian.every((b) => /^\d{1,2}\.\s/.test(b))) return null;
  return bagian.map((b) => b.replace(/^\d{1,2}\.\s*/, ''));
}

interface RentangMinggu { dariMinggu: string; sampaiMinggu: string; catatan: string }

/** Banyak isu punya catatan yang SAMA PERSIS berulang selama belasan minggu
 * berturut-turut (mis. "Belum ada VENDOR YANG BERSEDIA" dari Week 01 s/d
 * Week 16) sebelum akhirnya berubah. Dipadatkan jadi satu baris per rentang
 * minggu dengan catatan sama, bukan satu baris per minggu — supaya riwayat
 * 38 minggu yang isinya cuma berubah 3-4 kali tidak perlu 38 baris. */
function ringkasMingguan(updates: PicaUpdate[]): RentangMinggu[] {
  const hasil: RentangMinggu[] = [];
  for (const u of updates) {
    const terakhir = hasil[hasil.length - 1];
    if (terakhir && terakhir.catatan === u.catatan) terakhir.sampaiMinggu = u.week;
    else hasil.push({ dariMinggu: u.week, sampaiMinggu: u.week, catatan: u.catatan });
  }
  return hasil;
}

/** Rangkaian item bernomor kalau terdeteksi, atau paragraf biasa. Dipakai
 * untuk Description dan tiap catatan riwayat mingguan (keduanya sama-sama
 * rawan berisi daftar bernomor di sheet PICA). */
function TeksAtauDaftar({ teks, warna }: { teks: string; warna?: string }) {
  const daftar = pecahDaftarBernomor(teks);
  if (!daftar) return <span>{teks}</span>;
  return (
    <ol style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '.2rem' }}>
      {daftar.map((item, i) => (
        <li key={i} style={{ color: warna ?? 'inherit' }}>{item}</li>
      ))}
    </ol>
  );
}

function KartuRingkas({ label, nilai, nada, aktif, onClick }: {
  label: string; nilai: number; nada: Nada; aktif: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="wr-kpi" aria-pressed={aktif}
      style={{
        flex: '1 1 140px', textAlign: 'left', cursor: 'pointer', borderRadius: 14, padding: '.8rem 1rem',
        // Kartu aktif: tint + border + garis bawah (bentuk, bukan hanya warna).
        ...(aktif ? { background: nada.bg, border: `1px solid ${nada.garis}`, boxShadow: `inset 0 -3px 0 ${nada.warna}` } : {}),
      }}>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: nada.teks, lineHeight: 1.1 }}>{nilai}</div>
      <div style={{ fontSize: '.72rem', color: aktif ? 'var(--txt-secondary)' : 'var(--wr-txt-muted)', marginTop: '.2rem' }}>{label}</div>
    </button>
  );
}

export function PicaView({ site, labelSite, sites, onSiteChange, siteTerkunci }: Props) {
  const [items, setItems] = useState<PicaItem[]>([]);
  const [source, setSource] = useState<PicaSource | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [menyinkron, setMenyinkron] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'error'; teks: string } | null>(null);
  const [panelSumberTerbuka, setPanelSumberTerbuka] = useState(false);
  const [urlSheet, setUrlSheet] = useState('');
  const [filterGolongan, setFilterGolongan] = useState<'SEMUA' | 'jalan' | 'overdue' | 'selesai'>('SEMUA');
  const [cari, setCari] = useState('');
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
  useEffect(() => { setFilterGolongan('SEMUA'); setCari(''); setExpanded(new Set()); }, [site]);

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

  const ringkasan = useMemo(() => {
    const r = { total: items.length, jalan: 0, overdue: 0, selesai: 0 };
    for (const it of items) r[golonganStatus(it.status)]++;
    return r;
  }, [items]);

  const ditampilkan = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return items.filter((it) => {
      if (filterGolongan !== 'SEMUA' && golonganStatus(it.status) !== filterGolongan) return false;
      if (!q) return true;
      return `${it.no} ${it.problem} ${it.identifikasi} ${it.deskripsi} ${it.pic}`.toLowerCase().includes(q);
    });
  }, [items, filterGolongan, cari]);

  const kosong = !memuat && !items.length;

  return (
    <>
      <style>{WR_CSS}</style>
      {/* Filter + aksi */}
      <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '.75rem', alignItems: 'center' }}>
        <select value={site} onChange={(e) => onSiteChange(e.target.value)} disabled={siteTerkunci} aria-label="Pilih site"
          className="wr-ctl" style={kontrol}>
          {sites.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>

        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--wr-txt-muted)' }} />
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari problem / PIC / no…" aria-label="Cari isu"
            className="wr-ctl" style={{ ...kontrol, paddingLeft: '2rem', width: 220, maxWidth: '100%' }} />
        </div>

        <div style={{ flex: 1 }} />

        <button type="button" className="wr-btn wr-btn--info" onClick={() => setPanelSumberTerbuka((v) => !v)}
          style={tombol}>
          <Link2 size={15} /> Sumber Sheet
        </button>

        <button type="button" className="wr-btn wr-btn--primary" onClick={sinkronkan} disabled={menyinkron || !source}
          title={source ? 'Tarik ulang dari Google Spreadsheet' : 'Atur sumber sheet terlebih dahulu'}
          style={{ ...tombol, padding: '.5rem .95rem', cursor: source ? 'pointer' : 'not-allowed', opacity: source ? 1 : .5 }}>
          {menyinkron ? <Loader2 size={15} /> : <RefreshCw size={15} />} Sync Sekarang
        </button>
      </div>

      {/* Panel konfigurasi sumber */}
      {panelSumberTerbuka && (
        <div className="glass-panel" style={{ borderRadius: 16, padding: '1.1rem 1.25rem', marginBottom: '1rem', display: 'grid', gap: '.75rem' }}>
          <label style={{ fontSize: '.78rem', color: 'var(--wr-txt-muted)' }}>
            Link Google Spreadsheet tab PICA untuk {labelSite}
            <input value={urlSheet} onChange={(e) => setUrlSheet(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..."
              className="wr-ctl" style={{ ...kontrol, display: 'block', width: '100%', marginTop: '.35rem' }} />
          </label>
          <div style={{ fontSize: '.72rem', color: 'var(--wr-txt-muted)' }}>
            Tempel link yang langsung mengarah ke tab PICA-nya (klik tab-nya dulu di Google Sheets, lalu copy URL dari
            address bar — akan ada <code>?gid=...</code> di belakang). Beda dengan Laporan Mingguan Barang Masuk/Keluar,
            di sini <strong>tidak perlu ketik nama tab manual</strong> — gid dibaca otomatis dari link.
            Sheet harus dibagikan sebagai <strong>Anyone with the link — Viewer</strong>. Disinkronkan otomatis tiap 5 menit.
            {source?.lastSyncAt && <> Sync terakhir: {new Date(source.lastSyncAt).toLocaleString('id-ID')} ({source.lastStatus}).</>}
          </div>
          <div>
            <button type="button" className="wr-btn wr-btn--primary" onClick={simpanSumber}
              style={{ padding: '.5rem 1rem', borderRadius: 10, cursor: 'pointer' }}>
              Simpan Sumber
            </button>
          </div>
        </div>
      )}

      {pesan && (
        <div role={pesan.tipe === 'ok' ? 'status' : 'alert'} style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', padding: '.7rem .9rem', borderRadius: 12, marginBottom: '1rem', fontSize: '.8rem',
          background: (pesan.tipe === 'ok' ? NADA.in : NADA.neg).bg,
          border: `1px solid ${(pesan.tipe === 'ok' ? NADA.in : NADA.neg).garis}`,
          color: (pesan.tipe === 'ok' ? NADA.in : NADA.neg).teks }}>
          {pesan.tipe === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{pesan.teks}</span>
        </div>
      )}

      {memuat && (
        <div className="glass-panel" style={{ borderRadius: 16, padding: '2.5rem', textAlign: 'center', color: 'var(--wr-txt-muted)' }}>Memuat PICA…</div>
      )}

      {kosong && (
        <div className="glass-panel" style={{ borderRadius: 16, padding: '2.5rem', textAlign: 'center', color: 'var(--wr-txt-muted)' }}>
          Belum ada data PICA untuk {labelSite}. Atur sumber spreadsheet lalu klik "Sync Sekarang".
        </div>
      )}

      {!memuat && !kosong && (
        <>
          {/* Ringkasan status — klik untuk filter cepat */}
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <KartuRingkas label="Semua Isu" nilai={ringkasan.total} nada={NADA.info} aktif={filterGolongan === 'SEMUA'} onClick={() => setFilterGolongan('SEMUA')} />
            <KartuRingkas label="On Going" nilai={ringkasan.jalan} nada={NADA.warn} aktif={filterGolongan === 'jalan'} onClick={() => setFilterGolongan('jalan')} />
            <KartuRingkas label="Overdue" nilai={ringkasan.overdue} nada={NADA.neg} aktif={filterGolongan === 'overdue'} onClick={() => setFilterGolongan('overdue')} />
            <KartuRingkas label="Selesai / Close" nilai={ringkasan.selesai} nada={NADA.in} aktif={filterGolongan === 'selesai'} onClick={() => setFilterGolongan('selesai')} />
          </div>

          <div className="glass-panel" style={{ borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="wr-tbl wr-tbl--plain" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th style={{ padding: '.6rem .5rem', width: 28 }} />
                    <th style={{ padding: '.6rem .5rem' }}>No</th>
                    <th style={{ padding: '.6rem .5rem' }}>Tanggal</th>
                    <th style={{ padding: '.6rem .5rem', minWidth: 200 }}>Problem</th>
                    <th style={{ padding: '.6rem .5rem' }}>PIC</th>
                    <th style={{ padding: '.6rem .5rem' }}>Target Date</th>
                    <th style={{ padding: '.6rem .5rem' }}>Status</th>
                    <th style={{ padding: '.6rem .5rem', minWidth: 220 }}>Update Terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {ditampilkan.map((it) => {
                    const buka = expanded.has(it.id);
                    const rentang = buka ? ringkasMingguan(it.updates) : [];
                    const punyaDetail = it.identifikasi || it.deskripsi || it.updates.length > 0;
                    const gol = golonganStatus(it.status);
                    const n = NADA_GOLONGAN[gol];
                    const IkonSt = IKON_GOLONGAN[gol];
                    return (
                      <Fragment key={it.id}>
                        <tr className="wr-row" style={{ borderTop: '1px solid var(--wr-line)', cursor: punyaDetail ? 'pointer' : 'default' }}
                          onClick={() => punyaDetail && toggle(it.id)}>
                          <td style={{ padding: '.6rem .5rem', color: 'var(--wr-txt-muted)' }}>
                            {/* Tombol sungguhan agar bisa difokus keyboard; kliknya naik ke <tr> yang sudah menangani toggle. */}
                            {punyaDetail && (
                              <button type="button" className="wr-chev" aria-expanded={buka}
                                aria-label={buka ? 'Tutup detail isu' : 'Buka detail isu'}>
                                {buka ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            )}
                          </td>
                          <td style={{ padding: '.6rem .5rem', color: 'var(--wr-txt-muted)' }}>{it.no}</td>
                          <td style={{ padding: '.6rem .5rem', whiteSpace: 'nowrap' }}>{fmtTgl(it.tanggal)}</td>
                          <td style={{ padding: '.6rem .5rem', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.problem}>
                            {it.problem || '-'}
                          </td>
                          <td style={{ padding: '.6rem .5rem', whiteSpace: 'nowrap' }}>{it.pic || '-'}</td>
                          <td style={{ padding: '.6rem .5rem', whiteSpace: 'nowrap' }}>{fmtTgl(it.targetDate)}</td>
                          <td style={{ padding: '.6rem .5rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem', padding: '.2rem .55rem', borderRadius: 999,
                              fontSize: '.72rem', fontWeight: 600, background: n.bg, color: n.teks, border: `1px solid ${n.garis}`, whiteSpace: 'nowrap' }}>
                              <IkonSt size={12} aria-hidden="true" />
                              {it.status || '-'}
                            </span>
                          </td>
                          <td style={{ padding: '.6rem .5rem', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={it.latestWeek ? `${it.latestWeek}: ${it.latestNote}` : ''}>
                            {it.latestWeek
                              ? <><span style={{ color: NADA.info.teks, fontWeight: 600 }}>{it.latestWeek}:</span> {it.latestNote}</>
                              : <span style={{ color: 'var(--wr-txt-muted)' }}>-</span>}
                          </td>
                        </tr>

                        {buka && (
                          <tr style={{ background: 'var(--wr-zebra)' }}>
                            <td />
                            <td colSpan={7} style={{ padding: '.9rem 1rem 1.1rem 1.6rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1.5rem' }}>
                                <div style={{ display: 'grid', gap: '.7rem', alignContent: 'start' }}>
                                  {it.identifikasi && (
                                    <div>
                                      <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--wr-txt-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '.25rem' }}>
                                        Identification
                                      </div>
                                      <div style={{ fontSize: '.78rem' }}>{it.identifikasi}</div>
                                    </div>
                                  )}
                                  {it.deskripsi && (
                                    <div>
                                      <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--wr-txt-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '.25rem' }}>
                                        Description
                                      </div>
                                      <div style={{ fontSize: '.78rem', lineHeight: 1.6 }}>
                                        <TeksAtauDaftar teks={it.deskripsi} />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {rentang.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--wr-txt-muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '.4rem', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
                                      <ListChecks size={13} /> Riwayat Mingguan ({rentang.length} perubahan dari {it.updates.length} minggu tercatat)
                                    </div>
                                    <div style={{ display: 'grid', gap: '.5rem', maxHeight: 320, overflowY: 'auto', paddingRight: '.4rem' }}>
                                      {rentang.map((r, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '.6rem', fontSize: '.78rem', paddingBottom: '.45rem',
                                          borderBottom: i < rentang.length - 1 ? '1px solid var(--wr-line)' : 'none' }}>
                                          <span style={{ color: NADA.info.teks, fontWeight: 600, minWidth: 96, flexShrink: 0 }}>
                                            {r.dariMinggu === r.sampaiMinggu ? r.dariMinggu : `${r.dariMinggu} – ${r.sampaiMinggu}`}
                                          </span>
                                          <div style={{ color: 'var(--txt-secondary)', lineHeight: 1.6 }}>
                                            <TeksAtauDaftar teks={r.catatan} />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {!ditampilkan.length && (
                    <tr><td colSpan={8} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--wr-txt-muted)', fontSize: '.8rem' }}>
                      Tidak ada isu yang cocok dengan filter/pencarian.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '.7rem 1rem', fontSize: '.75rem', color: 'var(--wr-txt-muted)', borderTop: '1px solid var(--wr-line)' }}>
              {ditampilkan.length} dari {items.length} isu ditampilkan. Klik baris untuk lihat Identification, Description lengkap, dan riwayat mingguan.
            </div>
          </div>
        </>
      )}
    </>
  );
}