// Halaman "Tim Lapangan" — personel yang tercatat sebagai PIC di spreadsheet.
//
// Sumber (semua sudah ada di sistem, tidak ada input manual):
//  • Barang Keluar  → kolom PIC pada tiap baris pemakaian part/oli: siapa mengerjakan apa, di peralatan mana, biayanya
//  • PICA           → kolom PIC pada tiap isu: siapa memegang isu apa, statusnya, target selesai
// Satu orang yang namanya ditulis konsisten di kedua sumber digabung menjadi satu kartu. Nama dengan beberapa
// orang ("Budi / Andi") dipecah. Bagian "Aktivitas" dihitung per kejadian (peralatan + kegiatan + hari yang sama).
import { useEffect, useMemo, useState } from 'react';
import {
  Users, Crown, Activity, Wallet, ClipboardList, X, Search, RefreshCw, Loader2, CalendarClock, ArrowRight, AlertTriangle,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../lib/api';
import { getSites } from '../../data/siteStore';
import type { AuthState } from '../../types';
import { labelPenuh } from './siteLabel';
import { NADA, tooltipProps, WR_CSS, useWrTema } from './wrTema';
import { PageHeader } from './AdminExtraViews';
import { KpiKartu, EAM_CSS } from './eamUi';
import { angka, rupiahRingkas } from './eamHelpers';
import { fmtTanggal } from './sparePartData';
import { SP_CSS, Panel, Chip, rp, namaSite, potong } from './sparePartUi';
import { useDataMaintenance, waktuKeluar } from './maintenanceData';
import type { BarisKeluar } from './maintenanceData';
import type { TujuanNav } from './JadwalMaintenance';

interface PicaItem { id: string; site: string; no: string; problem: string; targetDate: string | null; pic: string; status: string; latestNote: string }
type Gol = 'selesai' | 'overdue' | 'jalan';
const golongan = (s: string): Gol => {
  const x = s.toLowerCase();
  if (x.includes('close') || x.includes('selesai') || x.includes('done')) return 'selesai';
  if (x.includes('overdue') || x.includes('terlambat')) return 'overdue';
  return 'jalan';
};
const NADA_GOL = { selesai: NADA.in, overdue: NADA.neg, jalan: NADA.warn };
const NAMA_GOL = { selesai: 'Selesai', overdue: 'Terlambat', jalan: 'Berjalan' };
const NAMA_SEKSI: Record<string, string> = { OH: 'Overhaul', OLI: 'Ganti Oli', MAINT: 'Perawatan & Part', LAIN: 'Lain-lain', ISOTANK: 'ISO Tank' };
const NAMA_BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = 86_400_000;

const KOSONG = new Set(['', '-', '--', '—', 'n/a', 'na', 'tbd', 'tba', 'none', 'null']);
/** "Budi / Andi", "Budi & Andi", "Budi, Andi", "Budi dan Andi" → ["Budi", "Andi"]; placeholder diabaikan. */
export function pisahPIC(raw: string): string[] {
  return String(raw || '').split(/\s*(?:\/|,|;|&|\+|\bdan\b)\s*/i).map((x) => x.trim().replace(/\s+/g, ' '))
    .filter((x) => x.length >= 2 && !KOSONG.has(x.toLowerCase()));
}
const kunci = (n: string) => n.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
const inisial = (n: string) => n.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? '').join('') || '?';
const PALET = ['#60A5FA', '#34D399', '#F59E0B', '#A78BFA', '#F472B6', '#22D3EE', '#FB923C', '#A3E635'];
const warnaNama = (n: string) => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALET[h % PALET.length]; };

interface Kejadian { waktu: number; site: string; peralatan: string; seksi: string; biaya: number; jumlahPart: number }
interface Anggota {
  kunci: string; nama: string; sites: Set<string>;
  kejadian: Kejadian[]; biaya: number; terakhir: number | null; peralatan: Map<string, number>; perSeksi: Map<string, number>;
  pica: PicaItem[];
}

/** Gabungkan Barang Keluar + PICA menjadi daftar anggota. */
export function bangunAnggota(keluar: BarisKeluar[], pica: PicaItem[]): Anggota[] {
  const peta = new Map<string, { ejaan: Map<string, number>; a: Anggota }>();
  const ambil = (nama: string): Anggota => {
    const k = kunci(nama);
    let e = peta.get(k);
    if (!e) { e = { ejaan: new Map(), a: { kunci: k, nama, sites: new Set(), kejadian: [], biaya: 0, terakhir: null, peralatan: new Map(), perSeksi: new Map(), pica: [] } }; peta.set(k, e); }
    e.ejaan.set(nama, (e.ejaan.get(nama) ?? 0) + 1);
    return e.a;
  };

  // Kejadian = orang + site + peralatan + seksi + hari
  const grup = new Map<string, { a: Anggota; w: number; site: string; alokasi: string; seksi: string; biaya: number; n: number }>();
  for (const r of keluar) {
    const orang = pisahPIC(r.pic ?? '');
    if (!orang.length) continue;
    const w = waktuKeluar(r);
    if (w === null) continue;
    const hari = r.tanggal ? Math.floor(w / HARI) : `W${r.tahun}-${r.minggu}`;
    for (const nama of orang) {
      const a = ambil(nama);
      const key = `${a.kunci}|${r.site}|${(r.alokasi || '').toLowerCase().trim()}|${r.section}|${hari}`;
      const g = grup.get(key) ?? { a, w, site: r.site, alokasi: (r.alokasi || '').trim() || '(tanpa alokasi)', seksi: r.section, biaya: 0, n: 0 };
      g.biaya += r.totalHarga / orang.length; g.n += 1; grup.set(key, g);
    }
  }
  for (const g of grup.values()) {
    const a = g.a;
    a.kejadian.push({ waktu: g.w, site: g.site, peralatan: g.alokasi, seksi: g.seksi, biaya: g.biaya, jumlahPart: g.n });
    a.sites.add(g.site); a.biaya += g.biaya;
    a.terakhir = a.terakhir === null ? g.w : Math.max(a.terakhir, g.w);
    a.peralatan.set(g.alokasi, (a.peralatan.get(g.alokasi) ?? 0) + 1);
    a.perSeksi.set(g.seksi, (a.perSeksi.get(g.seksi) ?? 0) + 1);
  }
  for (const it of pica) {
    for (const nama of pisahPIC(it.pic)) { const a = ambil(nama); a.pica.push(it); a.sites.add(it.site); }
  }
  return [...peta.values()].map(({ ejaan, a }) => {
    a.nama = [...ejaan.entries()].sort((x, y) => y[1] - x[1])[0][0];
    a.kejadian.sort((x, y) => y.waktu - x.waktu);
    return a;
  });
}

const TL_CSS = `
.tl-grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(min(330px,100%),1fr));margin-top:1rem}
.tl-card{border-radius:18px;padding:1rem 1.1rem;display:flex;gap:.9rem;align-items:flex-start;cursor:pointer;border:1px solid var(--wr-line);min-width:0;text-align:left;font:inherit;color:inherit;width:100%}
.tl-card:hover{border-color:var(--wr-in-border)}
.tl-card:focus-visible{outline:2px solid var(--wr-focus,#00D084);outline-offset:2px}
.tl-av{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:1rem;flex-shrink:0}
.tl-nama{font-size:.95rem;font-weight:800;color:var(--txt-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tl-meta{display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.35rem}
.tl-angka{display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;margin-top:.6rem}
.tl-angka div{padding:.4rem .5rem;border-radius:10px;background:var(--wr-tab-bg);border:1px solid var(--wr-line)}
.tl-angka small{display:block;font-size:.6rem;letter-spacing:.04em;text-transform:uppercase;color:var(--wr-txt-muted)}
.tl-angka b{font-size:.88rem;color:var(--txt-primary);font-variant-numeric:tabular-nums}
`;

export function TimLapangan({ auth, onNavigasi }: { auth: AuthState; onNavigasi: (t: TujuanNav) => void }) {
  const { W } = useWrTema();
  const siteTerkunci = auth.role !== 'Super Admin' && auth.assignedSite !== 'global';
  const { keluar, memuat: memuatRows, galat, muatUlang } = useDataMaintenance(auth);
  const sites = useMemo(() => getSites().filter((s) => !siteTerkunci || s.key === auth.assignedSite), [siteTerkunci, auth.assignedSite]);

  const [pica, setPica] = useState<PicaItem[]>([]);
  const [memuatPica, setMemuatPica] = useState(true);
  const [tick, setTick] = useState(0);
  const [site, setSite] = useState('ALL');
  const [cari, setCari] = useState('');
  const [urut, setUrut] = useState<'aktivitas' | 'biaya' | 'terakhir'>('aktivitas');
  const [detail, setDetail] = useState<string | null>(null);

  const kunciSite = sites.map((s) => s.key).join(',');
  useEffect(() => {
    let batal = false;
    setMemuatPica(true);
    Promise.allSettled(sites.map((s) => api.get<PicaItem[]>(`/pica?site=${encodeURIComponent(s.key)}`))).then((h) => {
      if (batal) return;
      setPica(h.flatMap((x, i) => (x.status === 'fulfilled' ? x.value.map((it) => ({ ...it, site: it.site || sites[i].key })) : [])));
      setMemuatPica(false);
    });
    return () => { batal = true; };
  }, [kunciSite, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const keluarF = useMemo(() => (site === 'ALL' ? keluar : keluar.filter((r) => r.site === site)), [keluar, site]);
  const picaF = useMemo(() => (site === 'ALL' ? pica : pica.filter((p) => p.site === site)), [pica, site]);
  const anggotaSemua = useMemo(() => bangunAnggota(keluarF, picaF), [keluarF, picaF]);

  const batas12 = Date.now() - 365 * HARI;
  const ukuran = (a: Anggota) => a.kejadian.filter((k) => k.waktu >= batas12).length + a.pica.filter((p) => golongan(p.status) !== 'selesai').length;
  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return anggotaSemua.filter((a) => !q || a.nama.toLowerCase().includes(q)).sort((a, b) => {
      if (urut === 'biaya') return b.biaya - a.biaya;
      if (urut === 'terakhir') return (b.terakhir ?? 0) - (a.terakhir ?? 0);
      return ukuran(b) - ukuran(a) || b.kejadian.length - a.kejadian.length;
    });
  }, [anggotaSemua, cari, urut]); // eslint-disable-line react-hooks/exhaustive-deps

  const k = useMemo(() => {
    const aktif = [...anggotaSemua].sort((a, b) => ukuran(b) - ukuran(a))[0];
    return {
      anggota: anggotaSemua.length, aktif,
      kegiatan12: anggotaSemua.reduce((t, a) => t + a.kejadian.filter((x) => x.waktu >= batas12).length, 0),
      picaTerbuka: new Set(picaF.filter((p) => golongan(p.status) !== 'selesai').map((p) => p.id)).size,
      picaTerlambat: new Set(picaF.filter((p) => golongan(p.status) === 'overdue').map((p) => p.id)).size,
      biaya: anggotaSemua.reduce((t, a) => t + a.biaya, 0),
    };
  }, [anggotaSemua, picaF]); // eslint-disable-line react-hooks/exhaustive-deps

  // Aktivitas tim per bulan (jumlah kejadian, 12 bulan terakhir yang punya data)
  const bulanan = useMemo(() => {
    const per = new Map<number, { label: string; Kegiatan: number; t: number }>();
    for (const a of anggotaSemua) for (const x of a.kejadian) {
      const d = new Date(x.waktu); const t = d.getFullYear() * 12 + d.getMonth();
      const e = per.get(t) ?? { label: `${NAMA_BLN[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, Kegiatan: 0, t };
      e.Kegiatan += 1; per.set(t, e);
    }
    return [...per.values()].sort((a, b) => a.t - b.t).slice(-12);
  }, [anggotaSemua]);

  const sumbu = { fontSize: 11, fill: W['--wr-txt-muted'] };
  const dipilih = detail ? anggotaSemua.find((a) => a.kunci === detail) ?? null : null;
  const memuat = memuatRows || memuatPica;

  return (
    <>
      <style>{WR_CSS}{EAM_CSS}{SP_CSS}{TL_CSS}</style>
      <PageHeader icon={Users} title="Tim Lapangan" />

      <div className="sp2-filter">
        {!siteTerkunci && (
          <label>Site
            <select className="wr-ctl sp2-ctl" value={site} onChange={(e) => setSite(e.target.value)}>
              <option value="ALL">Semua Site</option>
              {sites.map((s) => <option key={s.key} value={s.key}>{labelPenuh(s.label)}</option>)}
            </select>
          </label>
        )}
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
          <Search size={15} aria-hidden="true" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--wr-txt-muted)' }} />
          <input className="wr-ctl sp2-ctl" style={{ width: '100%', paddingLeft: 32 }} placeholder="Cari nama…" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari nama anggota" />
        </div>
        <label>Urutkan
          <select className="wr-ctl sp2-ctl" value={urut} onChange={(e) => setUrut(e.target.value as typeof urut)}>
            <option value="aktivitas">Paling aktif</option><option value="biaya">Biaya terbesar</option><option value="terakhir">Aktivitas terbaru</option>
          </select>
        </label>
        <button type="button" className="sp2-btn" style={{ marginLeft: 'auto' }} onClick={() => { muatUlang(); setTick((t) => t + 1); }} disabled={memuat}>
          {memuat ? <Loader2 size={14} className="sp2-spin" /> : <RefreshCw size={14} />} Muat Ulang
        </button>
      </div>

      {galat && <div className="glass-panel" style={{ borderRadius: 14, padding: '.7rem 1rem', marginBottom: '1rem', fontSize: '.78rem', color: NADA.neg.teks }}>{galat}</div>}
      {memuat && anggotaSemua.length === 0 && <div className="glass-panel sp2-panel"><div className="sp2-kosong"><span style={{ display: 'inline-flex', gap: '.5rem', alignItems: 'center' }}><Loader2 size={16} className="sp2-spin" /> Mengambil data tim…</span></div></div>}
      {!memuat && anggotaSemua.length === 0 && (
        <div className="glass-panel sp2-panel"><div className="sp2-kosong">Belum ada nama PIC yang terbaca.<br />Nama diambil dari kolom PIC di Barang Keluar dan PICA — pastikan kolom itu terisi dan sudah disinkronkan.</div></div>
      )}

      {anggotaSemua.length > 0 && (
        <>
          <div className="eam-kpis">
            <KpiKartu ikon={Users} warna="#60A5FA" label="Anggota Tercatat" nilai={angka(k.anggota)} sub="PIC di Barang Keluar & PICA" />
            <KpiKartu ikon={Crown} warna="#FBBF24" label="Paling Aktif" nilai={k.aktif ? potong(k.aktif.nama, 18) : '–'} sub={k.aktif ? `${angka(ukuran(k.aktif))} aktivitas 12 bulan` : ''} onKlik={k.aktif ? () => setDetail(k.aktif.kunci) : undefined} />
            <KpiKartu ikon={Activity} warna="#34D399" label="Kegiatan 12 Bulan" nilai={angka(k.kegiatan12)} sub="kejadian perawatan tercatat" />
            <KpiKartu ikon={Wallet} warna="#A78BFA" label="Biaya Ditangani" nilai={rupiahRingkas(k.biaya)} sub="part & oli yang dipakai tim" />
            <KpiKartu ikon={ClipboardList} warna="#F87171" label="PICA Terbuka" nilai={angka(k.picaTerbuka)} sub={`${angka(k.picaTerlambat)} terlambat`} onKlik={() => onNavigasi({ ke: 'laporan', mode: 'PICA' })} />
          </div>

          {bulanan.length >= 2 && (
            <div style={{ marginTop: '1rem' }}>
              <Panel judul="Aktivitas Tim per Bulan" baca="Jumlah kejadian perawatan yang dikerjakan seluruh anggota tiap bulan." tinggi={210}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bulanan} margin={{ top: 8, right: 14, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                    <XAxis dataKey="label" tick={sumbu} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={sumbu} axisLine={false} tickLine={false} width={34} />
                    <Tooltip {...tooltipProps} cursor={{ stroke: W['--wr-cursor'] }} />
                    <Line type="monotone" dataKey="Kegiatan" stroke={W['--wr-out']} strokeWidth={2.6} dot={{ r: 3.5, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Panel>
            </div>
          )}

          <div className="tl-grid">
            {daftar.map((a, i) => {
              const warna = warnaNama(a.nama);
              const terbuka = a.pica.filter((p) => golongan(p.status) !== 'selesai').length;
              const telat = a.pica.filter((p) => golongan(p.status) === 'overdue').length;
              const seksi = [...a.perSeksi.entries()].sort((x, y) => y[1] - x[1]).slice(0, 2);
              return (
                <div key={a.kunci} className="glass-panel tl-card" role="button" tabIndex={0} onClick={() => setDetail(a.kunci)} aria-label={`Rincian ${a.nama}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail(a.kunci); } }}>
                  <span className="tl-av" style={{ background: `${warna}26`, color: warna }}>{inisial(a.nama)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                      <div className="tl-nama" title={a.nama}>{a.nama}</div>
                      {i === 0 && urut === 'aktivitas' && <span title="Paling aktif" style={{ color: '#FBBF24', display: 'grid' }}><Crown size={14} aria-hidden="true" /></span>}
                    </div>
                    <div className="tl-meta">
                      {[...a.sites].slice(0, 3).map((s) => <Chip key={s} nada={NADA.out} teks={namaSite(s)} />)}
                      {a.sites.size > 3 && <Chip nada={NADA.neutral} teks={`+${a.sites.size - 3}`} />}
                      {seksi.map(([sk, n]) => <Chip key={sk} nada={NADA.aset} teks={`${NAMA_SEKSI[sk] ?? sk} ${n}`} />)}
                    </div>
                    <div className="tl-angka">
                      <div><small>Kegiatan</small><b>{angka(a.kejadian.length)}</b></div>
                      <div><small>Biaya</small><b>{rupiahRingkas(a.biaya).replace('Rp ', '')}</b></div>
                      <div><small>PICA terbuka</small><b style={{ color: telat ? NADA.neg.teks : undefined }}>{angka(terbuka)}</b></div>
                    </div>
                    <div className="jm-ket" style={{ fontSize: '.7rem', color: 'var(--wr-txt-muted)', marginTop: '.45rem' }}>Terakhir aktif: {fmtTanggal(a.terakhir)}</div>
                  </div>
                </div>
              );
            })}
            {daftar.length === 0 && <div className="sp2-kosong" style={{ gridColumn: '1 / -1' }}>Tidak ada anggota yang cocok dengan pencarian.</div>}
          </div>
        </>
      )}

      {dipilih && <DetailAnggota a={dipilih} onTutup={() => setDetail(null)} onNavigasi={(t) => { setDetail(null); onNavigasi(t); }} />}
    </>
  );
}

function DetailAnggota({ a, onTutup, onNavigasi }: { a: Anggota; onTutup: () => void; onNavigasi: (t: TujuanNav) => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onTutup(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onTutup]);
  const warna = warnaNama(a.nama);
  const peralatan = [...a.peralatan.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
  const pica = [...a.pica].sort((x, y) => Number(golongan(x.status) === 'selesai') - Number(golongan(y.status) === 'selesai'));
  return (
    <div className="sp2-modal" onClick={onTutup} role="presentation">
      <div className="sp2-dlg" role="dialog" aria-modal="true" aria-label={`Rincian ${a.nama}`} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '.8rem', alignItems: 'center', minWidth: 0 }}>
            <span className="tl-av" style={{ background: `${warna}26`, color: warna }}>{inisial(a.nama)}</span>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--txt-primary)' }}>{a.nama}</h2>
              <div className="tl-meta" style={{ marginTop: '.25rem' }}>{[...a.sites].map((s) => <Chip key={s} nada={NADA.out} teks={namaSite(s)} />)}</div>
            </div>
          </div>
          <button type="button" className="sp2-btn" onClick={onTutup} aria-label="Tutup rincian" autoFocus><X size={15} /></button>
        </div>

        <div className="sp2-mini">
          <div><small>Kegiatan tercatat</small><b>{angka(a.kejadian.length)}</b></div>
          <div><small>Biaya ditangani</small><b>{rp(a.biaya)}</b></div>
          <div><small>Peralatan</small><b>{angka(a.peralatan.size)}</b></div>
          <div><small>PICA dipegang</small><b>{angka(a.pica.length)}</b></div>
          <div><small>Terakhir aktif</small><b>{fmtTanggal(a.terakhir)}</b></div>
        </div>

        {a.kejadian.length > 0 && (
          <>
            <h3 className="sp2-h3" style={{ margin: '1rem 0 .5rem' }}>Peralatan yang Paling Sering Ditangani</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>{peralatan.map(([n, c]) => <Chip key={n} nada={NADA.neutral} teks={`${potong(n, 28)} · ${c}×`} />)}</div>

            <h3 className="sp2-h3" style={{ margin: '1rem 0 .5rem' }}>Aktivitas Terbaru</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="sp2-tbl" style={{ minWidth: 560 }}>
                <thead><tr><th>Tanggal</th><th>Site</th><th>Peralatan</th><th>Kegiatan</th><th className="r">Biaya</th></tr></thead>
                <tbody>
                  {a.kejadian.slice(0, 10).map((x, i) => (
                    <tr key={i}><td className="k">{fmtTanggal(x.waktu)}</td><td>{namaSite(x.site)}</td><td>{potong(x.peralatan, 34)}</td><td>{NAMA_SEKSI[x.seksi] ?? x.seksi}</td><td className="r">{rp(x.biaya)}</td></tr>
                  ))}
                </tbody>
              </table>
              {a.kejadian.length > 10 && <div className="sp2-baca" style={{ marginTop: '.4rem' }}>Menampilkan 10 terbaru dari {a.kejadian.length}.</div>}
            </div>
          </>
        )}

        {pica.length > 0 && (
          <>
            <h3 className="sp2-h3" style={{ margin: '1rem 0 .5rem' }}>Isu PICA yang Dipegang</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="sp2-tbl" style={{ minWidth: 560 }}>
                <thead><tr><th>Status</th><th>Isu</th><th>Site</th><th>Target</th></tr></thead>
                <tbody>
                  {pica.slice(0, 10).map((p) => { const g = golongan(p.status); return (
                    <tr key={p.id}>
                      <td><Chip nada={NADA_GOL[g]} teks={NAMA_GOL[g]} title={p.status} /></td>
                      <td className="k">{potong(p.problem || '—', 60)}</td><td>{namaSite(p.site)}</td>
                      <td>{p.targetDate ? fmtTanggal(Date.parse(p.targetDate)) : '—'}</td>
                    </tr>
                  ); })}
                </tbody>
              </table>
              {pica.length > 10 && <div className="sp2-baca" style={{ marginTop: '.4rem' }}>Menampilkan 10 dari {pica.length} isu.</div>}
            </div>
          </>
        )}

        <h3 className="sp2-h3" style={{ margin: '1rem 0 .5rem' }}>Buka di Menu Lain</h3>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="sp2-btn" onClick={() => onNavigasi({ ke: 'jadwal' })}><CalendarClock size={14} /> Jadwal Maintenance <ArrowRight size={12} /></button>
          <button type="button" className="sp2-btn" onClick={() => onNavigasi({ ke: 'laporan', mode: 'OUT' })}>Laporan Barang Keluar</button>
          <button type="button" className="sp2-btn" onClick={() => onNavigasi({ ke: 'laporan', mode: 'PICA' })}><AlertTriangle size={14} /> PICA</button>
        </div>
        <p className="sp2-baca" style={{ marginTop: '.7rem' }}>Aktivitas dihitung per kejadian (peralatan + kegiatan + hari yang sama). Bila satu baris menyebut beberapa PIC, biayanya dibagi rata.</p>
      </div>
    </div>
  );
}