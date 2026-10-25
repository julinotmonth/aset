// Halaman "Jadwal Maintenance" — dibangun seluruhnya dari Laporan Mingguan (Barang Keluar).
//
// Tiap peralatan + jenis kegiatan (Overhaul / Ganti Oli / Perawatan & Part) punya satu jadwal yang
// dihitung dari riwayat pemakaian part di spreadsheet: kapan terakhir dikerjakan, interval khasnya
// (tanggal dan, bila ada, jam jalan/RH), kapan jatuh tempo berikutnya, serta biayanya. Terhubung ke
// menu lain: part yang dipakai → Spare Part (dengan status stok), biaya → Laporan Barang Keluar,
// peralatan → Asset Management.
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, AlertTriangle, Wrench, Wallet, Gauge, Download, RefreshCw, Loader2, Search, X, ArrowRight, Settings2,
  ChevronLeft, ChevronRight, ArrowUpDown, Boxes, TrendingDown, Package, Info,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getSites } from '../../data/siteStore';
import type { AuthState } from '../../types';
import { labelPenuh } from './siteLabel';
import { NADA, tooltipProps, WR_CSS, useWrTema } from './wrTema';
import type { Nada } from './wrTema';
import { PageHeader } from './AdminExtraViews';
import { KpiKartu, EAM_CSS } from './eamUi';
import { angka, rupiahRingkas, unduhCsv, hariIni } from './eamHelpers';
import { fmtTanggal } from './sparePartData';
import {
  SP_CSS, Panel, Peringkat, Chip, ChipStatus, rp, qty, tickRupiah, namaSite, potong,
} from './sparePartUi';
import {
  useDataMaintenance, bangunJadwal, biayaBulanan, statusPart, NAMA_KEGIATAN, URUT_KEGIATAN, STANDAR_DEFAULT,
} from './maintenanceData';
import type { Jadwal, StatusJadwal, Kegiatan, IntervalStandar } from './maintenanceData';
import type { LaporanMode, AsetTab } from './Sidebar';

export type TujuanNav =
  | { ke: 'spare-part'; cari?: string }
  | { ke: 'laporan'; mode: LaporanMode }
  | { ke: 'aset'; tab: AsetTab };

const STATUS: StatusJadwal[] = ['Terlambat', 'Segera', 'Terjadwal', 'Cek Data'];
const NADA_JADWAL: Record<StatusJadwal, Nada> = { Terlambat: NADA.neg, Segera: NADA.warn, Terjadwal: NADA.in, 'Cek Data': NADA.neutral };
const KET_JADWAL: Record<StatusJadwal, string> = {
  Terlambat: 'Jatuh tempo sudah lewat dan belum ada catatan perawatan baru',
  Segera: 'Jatuh tempo dalam 14 hari ke depan',
  Terjadwal: 'Jatuh tempo masih lebih dari 14 hari lagi',
  'Cek Data': 'Sudah sangat lama tidak ada catatan — peralatan mungkin tidak aktif atau perawatannya belum dicatat di spreadsheet',
};
const IKON_KEGIATAN: Record<Kegiatan, Nada> = { OH: NADA.aset, OLI: NADA.warn, MAINT: NADA.out };
const PER_HALAMAN = 15;
type Kolom = 'status' | 'peralatan' | 'berikutnya' | 'biaya12Bln';

const sisaTeks = (h: number): string => (h < 0 ? `terlambat ${(-h).toLocaleString('id-ID')} hari` : h === 0 ? 'hari ini' : `${h.toLocaleString('id-ID')} hari lagi`);
const ChipJadwal = ({ s }: { s: StatusJadwal }) => <Chip nada={NADA_JADWAL[s]} teks={s} title={KET_JADWAL[s]} />;
const ChipKegiatan = ({ k }: { k: Kegiatan }) => <Chip nada={IKON_KEGIATAN[k]} teks={NAMA_KEGIATAN[k]} />;
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const JM_CSS = `
.jm-agenda{display:grid;gap:.9rem}
.jm-bln{font-size:.7rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--wr-txt-muted);margin:0 0 .35rem}
.jm-item{display:grid;grid-template-columns:54px 1fr auto;gap:.75rem;align-items:center;padding:.55rem .7rem;border-radius:12px;background:var(--wr-tab-bg);border:1px solid var(--wr-line);cursor:pointer;width:100%;text-align:left;font:inherit;color:inherit}
.jm-item:hover{background:var(--wr-btn-bg-hover)}
.jm-item:focus-visible{outline:2px solid var(--wr-focus,#00D084);outline-offset:2px}
.jm-tgl{text-align:center;line-height:1.1}
.jm-tgl b{display:block;font-size:1.15rem;color:var(--txt-primary);font-variant-numeric:tabular-nums}
.jm-tgl span{font-size:.62rem;text-transform:uppercase;letter-spacing:.05em;color:var(--wr-txt-muted)}
.jm-ket{font-size:.7rem;color:var(--wr-txt-muted);margin-top:2px}
.jm-penjelasan{padding:.7rem .85rem;border-radius:12px;background:var(--wr-tab-bg);border:1px solid var(--wr-line);font-size:.78rem;line-height:1.6;color:var(--txt-secondary)}
.jm-tautan{display:flex;gap:.5rem;flex-wrap:wrap}
`;

export function JadwalMaintenance({ auth, onNavigasi }: { auth: AuthState; onNavigasi: (t: TujuanNav) => void }) {
  const { W } = useWrTema();
  const { keluar, masuk, memuat, galat, siteTerkunci, muatUlang } = useDataMaintenance(auth);
  const sites = getSites();

  const [site, setSite] = useState('ALL');
  const [kegiatan, setKegiatan] = useState<'ALL' | Kegiatan>('ALL');
  const [status, setStatus] = useState<'ALL' | StatusJadwal>('ALL');
  const [cari, setCari] = useState('');
  const [standar, setStandar] = useState<IntervalStandar>(STANDAR_DEFAULT);
  const [pengaturan, setPengaturan] = useState(false);
  const [urut, setUrut] = useState<{ k: Kolom; arah: 'asc' | 'desc' }>({ k: 'status', arah: 'asc' });
  const [hal, setHal] = useState(1);
  const [detail, setDetail] = useState<string | null>(null);

  const siteAda = useMemo(() => new Set(keluar.map((r) => r.site)), [keluar]);
  const keluarF = useMemo(() => (site === 'ALL' ? keluar : keluar.filter((r) => r.site === site)), [keluar, site]);
  const std = useMemo(() => ({
    OH: Math.max(1, Math.round(standar.OH) || STANDAR_DEFAULT.OH), OLI: Math.max(1, Math.round(standar.OLI) || STANDAR_DEFAULT.OLI), MAINT: Math.max(1, Math.round(standar.MAINT) || STANDAR_DEFAULT.MAINT),
  }), [standar]);
  const semua = useMemo(() => bangunJadwal(keluarF, { standar: std }), [keluarF, std]);
  const stokPart = useMemo(() => statusPart(keluar, masuk), [keluar, masuk]);

  const hitung = useMemo(() => {
    const c: Record<StatusJadwal, number> = { Terlambat: 0, Segera: 0, Terjadwal: 0, 'Cek Data': 0 };
    for (const j of semua) c[j.status] += 1;
    return c;
  }, [semua]);

  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const f = semua.filter((j) => (kegiatan === 'ALL' || j.kegiatan === kegiatan) && (status === 'ALL' || j.status === status)
      && (!q || j.peralatan.toLowerCase().includes(q)));
    const arah = urut.arah === 'asc' ? 1 : -1;
    const bobot: Record<StatusJadwal, number> = { Terlambat: 0, Segera: 1, Terjadwal: 2, 'Cek Data': 3 };
    return [...f].sort((a, b) => {
      switch (urut.k) {
        case 'peralatan': return a.peralatan.localeCompare(b.peralatan, 'id') * arah;
        case 'berikutnya': return (a.berikutnya - b.berikutnya) * arah;
        case 'biaya12Bln': return (a.biaya12Bln - b.biaya12Bln) * arah;
        default: return ((bobot[a.status] - bobot[b.status]) || (a.sisaHari - b.sisaHari)) * arah;
      }
    });
  }, [semua, kegiatan, status, cari, urut]);

  useEffect(() => { setHal(1); }, [site, kegiatan, status, cari, urut, std]);
  const totalHal = Math.max(1, Math.ceil(daftar.length / PER_HALAMAN));
  const halAktif = Math.min(hal, totalHal);
  const tampil = daftar.slice((halAktif - 1) * PER_HALAMAN, halAktif * PER_HALAMAN);

  const k = useMemo(() => {
    const peralatan = new Set(semua.map((j) => `${j.site}|${j.peralatan.toLowerCase()}`)).size;
    const tahunIni = new Date().getFullYear();
    return {
      peralatan,
      biaya12: semua.reduce((t, j) => t + j.biaya12Bln, 0),
      ohTahunIni: semua.filter((j) => j.kegiatan === 'OH').reduce((t, j) => t + j.kejadian.filter((x) => new Date(x.waktu).getFullYear() === tahunIni).length, 0),
      sebulan: semua.filter((j) => j.status !== 'Cek Data' && j.sisaHari >= 0 && j.sisaHari <= 30).length,
    };
  }, [semua]);

  // Agenda: yang terlambat + jatuh tempo ≤ 90 hari, dikelompokkan per bulan
  const agenda = useMemo(() => {
    const butir = semua.filter((j) => j.status !== 'Cek Data' && j.sisaHari <= 90).sort((a, b) => a.berikutnya - b.berikutnya);
    const grup: { judul: string; isi: Jadwal[] }[] = [];
    for (const j of butir) {
      const d = new Date(j.berikutnya);
      const judul = j.sisaHari < 0 ? 'Terlambat' : `${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
      const g = grup.find((x) => x.judul === judul);
      if (g) g.isi.push(j); else grup.push({ judul, isi: [j] });
    }
    return grup;
  }, [semua]);

  const bulanan = useMemo(() => biayaBulanan(keluarF), [keluarF]);
  const peringkat = useMemo(() => {
    const m = new Map<string, { nama: string; site: string; biaya: number; n: number }>();
    for (const j of semua) {
      const key = `${j.site}|${j.peralatan.toLowerCase()}`;
      const e = m.get(key) ?? { nama: j.peralatan, site: j.site, biaya: 0, n: 0 };
      e.biaya += j.biaya12Bln; e.n += j.kejadian.length; m.set(key, e);
    }
    return [...m.values()].filter((x) => x.biaya > 0).sort((a, b) => b.biaya - a.biaya).slice(0, 8)
      .map((x) => ({ label: x.nama, sub: `${namaSite(x.site)} · ${x.n} kejadian`, nilai: x.biaya, teks: rp(x.biaya) }));
  }, [semua]);

  const ekspor = () => unduhCsv(`jadwal-maintenance-${hariIni()}.csv`, [
    ['Status', 'Site', 'Peralatan', 'Kegiatan', 'Terakhir', 'RH Terakhir', 'Interval (hari)', 'Interval (jam jalan)', 'Dasar Interval', 'Jatuh Tempo', 'Sisa Hari', 'Dasar Jatuh Tempo', 'Biaya 12 Bulan', 'Total Biaya', 'Jumlah Kejadian'],
    ...daftar.map((j) => [j.status, namaSite(j.site), j.peralatan, NAMA_KEGIATAN[j.kegiatan], fmtTanggal(j.terakhir.waktu), j.terakhir.rh ?? '', j.intervalHari, j.intervalRH ?? '',
      j.dasarInterval === 'riwayat' ? 'riwayat' : 'standar (perkiraan)', fmtTanggal(j.berikutnya), j.sisaHari, j.dasarJatuhTempo, Math.round(j.biaya12Bln), Math.round(j.biayaTotal), j.kejadian.length]),
  ]);

  const urutKe = (kol: Kolom) => setUrut((u) => (u.k === kol ? { k: kol, arah: u.arah === 'asc' ? 'desc' : 'asc' } : { k: kol, arah: kol === 'biaya12Bln' ? 'desc' : 'asc' }));
  const Th = ({ kol, children, r }: { kol: Kolom; children: React.ReactNode; r?: boolean }) => (
    <th className={r ? 'r' : undefined} aria-sort={urut.k === kol ? (urut.arah === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="sp2-th" onClick={() => urutKe(kol)}>{children}<ArrowUpDown size={11} aria-hidden="true" style={{ opacity: urut.k === kol ? 1 : .35 }} /></button>
    </th>
  );

  const sumbu = { fontSize: 11, fill: W['--wr-txt-muted'] };
  const filterAktif = site !== 'ALL' || kegiatan !== 'ALL' || status !== 'ALL' || cari.trim() !== '';
  const jadwalDetail = detail ? semua.find((j) => j.key === detail) ?? null : null;

  return (
    <>
      <style>{WR_CSS}{EAM_CSS}{SP_CSS}{JM_CSS}</style>
      <PageHeader icon={CalendarClock} title="Jadwal Maintenance" />

      {/* ── Filter ── */}
      <div className="sp2-filter">
        {!siteTerkunci && (
          <label>Site
            <select className="wr-ctl sp2-ctl" value={site} onChange={(e) => setSite(e.target.value)}>
              <option value="ALL">Semua Site</option>
              {sites.filter((s) => siteAda.has(s.key)).map((s) => <option key={s.key} value={s.key}>{labelPenuh(s.label)}</option>)}
            </select>
          </label>
        )}
        <div role="group" aria-label="Jenis kegiatan" style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
          <button type="button" className="sp2-chip" aria-pressed={kegiatan === 'ALL'} onClick={() => setKegiatan('ALL')}>Semua Kegiatan</button>
          {URUT_KEGIATAN.map((x) => <button key={x} type="button" className="sp2-chip" aria-pressed={kegiatan === x} onClick={() => setKegiatan(kegiatan === x ? 'ALL' : x)}>{NAMA_KEGIATAN[x]}</button>)}
        </div>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
          <Search size={15} aria-hidden="true" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--wr-txt-muted)' }} />
          <input className="wr-ctl sp2-ctl" style={{ width: '100%', paddingLeft: 32 }} placeholder="Cari peralatan…" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari peralatan" />
        </div>
        {filterAktif && <button type="button" className="sp2-btn" onClick={() => { setSite('ALL'); setKegiatan('ALL'); setStatus('ALL'); setCari(''); }}><X size={14} /> Reset</button>}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '.45rem', flexWrap: 'wrap' }}>
          <button type="button" className="sp2-btn" onClick={() => setPengaturan((v) => !v)} aria-expanded={pengaturan}><Settings2 size={14} /> Interval Standar</button>
          <button type="button" className="sp2-btn" onClick={muatUlang} disabled={memuat}>{memuat ? <Loader2 size={14} className="sp2-spin" /> : <RefreshCw size={14} />} Muat Ulang</button>
          <button type="button" className="sp2-btn" onClick={ekspor} disabled={!daftar.length}><Download size={14} /> Export</button>
        </span>
      </div>

      {pengaturan && (
        <section className="glass-panel sp2-panel" style={{ marginBottom: '1rem' }} aria-label="Interval standar">
          <h3 className="sp2-h3">Interval Standar</h3>
          <p className="sp2-baca">Dipakai hanya untuk peralatan yang baru punya <b>satu</b> catatan (belum ada selang untuk dihitung). Peralatan dengan riwayat lebih dari satu kali memakai pola aslinya.</p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '.7rem' }}>
            {URUT_KEGIATAN.map((x) => (
              <label key={x} style={{ display: 'grid', gap: '.3rem', fontSize: '.74rem', fontWeight: 700, color: 'var(--txt-secondary)' }}>{NAMA_KEGIATAN[x]}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}>
                  <input type="number" min={1} className="wr-ctl sp2-ctl" style={{ width: 90, textAlign: 'right' }} value={standar[x]} onChange={(e) => setStandar((s) => ({ ...s, [x]: Number(e.target.value) }))} />
                  <em style={{ fontStyle: 'normal', fontWeight: 500, color: 'var(--wr-txt-muted)' }}>hari</em>
                </span>
              </label>
            ))}
            <button type="button" className="sp2-btn" style={{ alignSelf: 'end' }} onClick={() => setStandar(STANDAR_DEFAULT)}>Atur ulang</button>
          </div>
        </section>
      )}

      {galat && <div className="glass-panel" style={{ borderRadius: 14, padding: '.7rem 1rem', marginBottom: '1rem', fontSize: '.78rem', color: NADA.neg.teks }}>{galat}</div>}
      {memuat && keluar.length === 0 && <div className="glass-panel sp2-panel"><div className="sp2-kosong"><span style={{ display: 'inline-flex', gap: '.5rem', alignItems: 'center' }}><Loader2 size={16} className="sp2-spin" /> Mengambil data Barang Keluar…</span></div></div>}
      {!memuat && semua.length === 0 && !galat && (
        <div className="glass-panel sp2-panel"><div className="sp2-kosong">Belum ada catatan perawatan peralatan di Barang Keluar{site !== 'ALL' ? ` untuk ${namaSite(site)}` : ''}.<br />Jadwal dibentuk dari baris Part Maintenance, Overhold, dan Consumption OLI yang kolom Alokasi-nya berisi nama peralatan.</div></div>
      )}

      {semua.length > 0 && (
        <>
          {/* ── Angka kunci ── */}
          <div className="eam-kpis">
            <KpiKartu ikon={AlertTriangle} warna="#F87171" label="Terlambat" nilai={angka(hitung.Terlambat)} sub="melewati jatuh tempo" onKlik={() => setStatus('Terlambat')} />
            <KpiKartu ikon={CalendarClock} warna="#F59E0B" label="Jatuh Tempo ≤ 30 Hari" nilai={angka(k.sebulan)} sub={`${angka(hitung.Segera)} dalam 14 hari`} onKlik={() => setStatus('Segera')} />
            <KpiKartu ikon={Wrench} warna="#60A5FA" label="Peralatan Terpantau" nilai={angka(k.peralatan)} sub={`${angka(semua.length)} jadwal kegiatan`} />
            <KpiKartu ikon={Wallet} warna="#34D399" label="Biaya 12 Bulan" nilai={rupiahRingkas(k.biaya12)} sub="part & oli yang dipakai" onKlik={() => onNavigasi({ ke: 'laporan', mode: 'OUT' })} />
            <KpiKartu ikon={Gauge} warna="#A78BFA" label="Overhaul Tahun Ini" nilai={angka(k.ohTahunIni)} sub="kejadian tercatat" />
          </div>

          {/* ── Agenda + tren ── */}
          <div className="sp2-row" style={{ marginTop: '1rem' }}>
            <Panel judul="Agenda 90 Hari ke Depan" baca="Yang terlambat tampil paling atas, lalu per bulan. Klik untuk rincian.">
              {agenda.length === 0 ? <div className="sp2-kosong">Tidak ada jadwal yang jatuh tempo dalam 90 hari.</div> : (
                <div className="jm-agenda" style={{ maxHeight: 440, overflowY: 'auto', paddingRight: 4 }}>
                  {agenda.map((g) => (
                    <div key={g.judul}>
                      <h4 className="jm-bln" style={g.judul === 'Terlambat' ? { color: NADA.neg.teks } : undefined}>{g.judul} · {g.isi.length}</h4>
                      <div style={{ display: 'grid', gap: '.4rem' }}>
                        {g.isi.slice(0, 12).map((j) => (
                          <button key={j.key} type="button" className="jm-item" onClick={() => setDetail(j.key)}>
                            <span className="jm-tgl"><b>{new Date(j.berikutnya).getDate()}</b><span>{NAMA_BULAN[new Date(j.berikutnya).getMonth()].slice(0, 3)}</span></span>
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: 'block', fontSize: '.82rem', fontWeight: 700, color: 'var(--txt-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.peralatan}</span>
                              <span className="jm-ket">{NAMA_KEGIATAN[j.kegiatan]} · {namaSite(j.site)} · {sisaTeks(j.sisaHari)}{j.dasarInterval === 'standar' ? ' · perkiraan' : ''}</span>
                            </span>
                            <ChipJadwal s={j.status} />
                          </button>
                        ))}
                        {g.isi.length > 12 && <div className="jm-ket">+ {g.isi.length - 12} jadwal lainnya di tabel.</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <div style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
              <Panel judul="Biaya Perawatan per Bulan" baca="Total part dan oli yang dipakai untuk perawatan peralatan tiap bulan." tinggi={220}>
                {bulanan.length < 2 ? <div className="sp2-kosong">Data bulanan belum cukup untuk grafik.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bulanan} margin={{ top: 8, right: 14, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                      <XAxis dataKey="label" tick={sumbu} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={tickRupiah} tick={sumbu} axisLine={false} tickLine={false} width={52} />
                      <Tooltip {...tooltipProps} formatter={(v: unknown) => rp(Number(v) || 0)} cursor={{ stroke: W['--wr-cursor'] }} />
                      <Line type="monotone" dataKey="Biaya" stroke={W['--wr-out']} strokeWidth={2.6} dot={{ r: 3.5, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Panel>
              <Panel judul="Peralatan Paling Banyak Memakan Biaya" baca="Biaya part dan oli 12 bulan terakhir.">
                <Peringkat baris={peringkat} warna={W['--wr-warn']} kosong="Belum ada biaya tercatat dalam 12 bulan terakhir." />
              </Panel>
            </div>
          </div>

          {/* ── Tabel jadwal ── */}
          <section className="glass-panel sp2-panel" aria-label="Jadwal per peralatan">
            <div className="sp2-ph">
              <div>
                <h3 className="sp2-h3">Jadwal per Peralatan</h3>
                <p className="sp2-baca">{angka(daftar.length)} dari {angka(semua.length)} jadwal. Jatuh tempo = kegiatan terakhir + interval khas peralatan itu; tanda “perkiraan” berarti riwayatnya baru satu kali.</p>
              </div>
            </div>
            <div className="sp2-filter" role="group" aria-label="Filter status">
              <button type="button" className="sp2-chip" aria-pressed={status === 'ALL'} onClick={() => setStatus('ALL')}>Semua <small>{semua.length}</small></button>
              {STATUS.map((s) => <button key={s} type="button" className="sp2-chip" aria-pressed={status === s} onClick={() => setStatus(status === s ? 'ALL' : s)} title={KET_JADWAL[s]}>{s} <small>{hitung[s]}</small></button>)}
            </div>
            {daftar.length === 0 ? <div className="sp2-kosong">Tidak ada jadwal yang cocok dengan filter.</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="sp2-tbl" style={{ minWidth: 940 }}>
                  <thead><tr>
                    <Th kol="status">Status</Th><Th kol="peralatan">Peralatan</Th><th>Kegiatan</th><th>Terakhir</th><th>Interval</th>
                    <Th kol="berikutnya">Jatuh Tempo</Th><Th kol="biaya12Bln" r>Biaya 12 Bln</Th>
                  </tr></thead>
                  <tbody>
                    {tampil.map((j) => (
                      <tr key={j.key} className="sp2-tr" tabIndex={0} onClick={() => setDetail(j.key)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail(j.key); } }}>
                        <td><ChipJadwal s={j.status} /></td>
                        <td className="k">{potong(j.peralatan, 38)}<div className="jm-ket">{namaSite(j.site)}</div></td>
                        <td><ChipKegiatan k={j.kegiatan} /></td>
                        <td>{fmtTanggal(j.terakhir.waktu)}{j.terakhir.rh !== null && <div className="jm-ket">{qty(j.terakhir.rh)} jam jalan</div>}</td>
                        <td>tiap ± {j.intervalHari.toLocaleString('id-ID')} hari{j.intervalRH ? <div className="jm-ket">atau {j.intervalRH.toLocaleString('id-ID')} jam jalan</div> : null}
                          {j.dasarInterval === 'standar' && <div className="jm-ket">perkiraan</div>}</td>
                        <td>{fmtTanggal(j.berikutnya)}<div className="jm-ket" style={j.sisaHari < 0 ? { color: NADA.neg.teks } : undefined}>{sisaTeks(j.sisaHari)}{j.dasarJatuhTempo === 'jam jalan' ? ' · menurut jam jalan' : ''}</div></td>
                        <td className="r">{j.biaya12Bln ? rp(j.biaya12Bln) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {daftar.length > PER_HALAMAN && (
              <div className="sp2-pg">
                <span>Halaman {halAktif} dari {totalHal}</span>
                <span style={{ display: 'inline-flex', gap: '.4rem' }}>
                  <button type="button" className="sp2-btn" disabled={halAktif <= 1} onClick={() => setHal(halAktif - 1)} aria-label="Halaman sebelumnya"><ChevronLeft size={14} /></button>
                  <button type="button" className="sp2-btn" disabled={halAktif >= totalHal} onClick={() => setHal(halAktif + 1)} aria-label="Halaman berikutnya"><ChevronRight size={14} /></button>
                </span>
              </div>
            )}
          </section>
        </>
      )}

      {jadwalDetail && <DetailJadwal j={jadwalDetail} stok={stokPart} onTutup={() => setDetail(null)} onNavigasi={(t) => { setDetail(null); onNavigasi(t); }} />}
    </>
  );
}

// ── Rincian satu jadwal ──────────────────────────────────────────────────
function DetailJadwal({ j, stok, onTutup, onNavigasi }: {
  j: Jadwal; stok: ReturnType<typeof statusPart>; onTutup: () => void; onNavigasi: (t: TujuanNav) => void;
}) {
  const { W } = useWrTema();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onTutup(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onTutup]);

  const riwayat = useMemo(() => [...j.kejadian].reverse(), [j]);
  const grafik = useMemo(() => j.kejadian.map((x) => ({ label: fmtTanggal(x.waktu), Biaya: Math.round(x.biaya) })), [j]);
  const sumbu = { fontSize: 11, fill: W['--wr-txt-muted'] };
  const penjelasan = j.dasarInterval === 'riwayat'
    ? `Interval ${j.intervalHari.toLocaleString('id-ID')} hari adalah nilai tengah dari ${j.kejadian.length - 1} selang antar kegiatan yang tercatat${j.intervalRH ? `; berdasarkan jam jalan, kegiatan ini biasanya dilakukan tiap ±${j.intervalRH.toLocaleString('id-ID')} jam` : ''}.`
    : `Baru ada satu catatan, jadi dipakai interval standar ${j.intervalHari.toLocaleString('id-ID')} hari (bisa diubah di “Interval Standar”). Jadwal ini perkiraan sampai ada catatan berikutnya.`;
  const dasar = j.dasarJatuhTempo === 'jam jalan'
    ? ` Jatuh tempo dimajukan karena jam jalan mesin (±${(j.rhPerHari ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jam/hari) akan lebih dulu mencapai batasnya.` : '';
  const partBerikut = j.terakhir.parts.slice(0, 8);

  return (
    <div className="sp2-modal" onClick={onTutup} role="presentation">
      <div className="sp2-dlg" role="dialog" aria-modal="true" aria-label={`Jadwal ${j.peralatan}`} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}><ChipJadwal s={j.status} /><ChipKegiatan k={j.kegiatan} /><span className="jm-ket">{namaSite(j.site)}</span></div>
            <h2 style={{ margin: '.35rem 0 0', fontSize: '1.15rem', color: 'var(--txt-primary)' }}>{j.peralatan}</h2>
          </div>
          <button type="button" className="sp2-btn" onClick={onTutup} aria-label="Tutup rincian" autoFocus><X size={15} /></button>
        </div>

        <div className="sp2-mini">
          <div><small>Terakhir dikerjakan</small><b>{fmtTanggal(j.terakhir.waktu)}</b></div>
          <div><small>Jatuh tempo berikutnya</small><b style={{ color: j.sisaHari < 0 ? NADA.neg.teks : undefined }}>{fmtTanggal(j.berikutnya)}</b></div>
          <div><small>Sisa waktu</small><b style={{ color: j.sisaHari < 0 ? NADA.neg.teks : undefined }}>{sisaTeks(j.sisaHari)}</b></div>
          <div><small>Interval</small><b>{j.intervalHari.toLocaleString('id-ID')} hari</b></div>
          <div><small>Jam jalan terakhir</small><b>{j.rhTerakhir !== null ? qty(j.rhTerakhir) : '—'}</b></div>
          <div><small>Biaya 12 bulan</small><b>{rp(j.biaya12Bln)}</b></div>
        </div>
        <div className="jm-penjelasan"><Info size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> <b>Cara jadwal ini dihitung.</b> {penjelasan}{dasar}</div>

        <h3 className="sp2-h3" style={{ margin: '1rem 0 .5rem' }}>Part yang dipakai pada kegiatan terakhir</h3>
        <p className="sp2-baca" style={{ margin: '0 0 .5rem' }}>Siapkan part yang sama untuk kegiatan berikutnya. Status stok diambil dari menu Spare Part.</p>
        <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
          <table className="sp2-tbl" style={{ minWidth: 560 }}>
            <thead><tr><th>Part</th><th className="r">Jumlah</th><th className="r">Biaya</th><th>Stok Sekarang</th></tr></thead>
            <tbody>
              {partBerikut.map((p, i) => {
                const it = p.kode ? stok.get(p.kode.trim().toUpperCase().replace(/[\u2010-\u2015\s]+/g, '-')) : undefined;
                return (
                  <tr key={`${p.kode}-${i}`}>
                    <td className="k">{p.kode && <span className="sp2-mono">{p.kode}</span>}<div>{potong(p.nama || '—', 50)}</div></td>
                    <td className="r">{qty(p.qty)} {p.satuan}</td><td className="r">{rp(p.biaya)}</td>
                    <td>{it ? (<span style={{ display: 'inline-flex', gap: '.4rem', alignItems: 'center', flexWrap: 'wrap' }}><ChipStatus s={it.status} />
                      <button type="button" className="sp2-btn" style={{ padding: '.25rem .55rem', fontSize: '.7rem' }} onClick={() => onNavigasi({ ke: 'spare-part', cari: it.kode })}>Lihat <ArrowRight size={11} /></button></span>) : <span className="jm-ket">bukan kode spare part</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {j.terakhir.parts.length > partBerikut.length && <div className="jm-ket" style={{ marginTop: '.4rem' }}>+ {j.terakhir.parts.length - partBerikut.length} part lainnya.</div>}
        </div>

        {grafik.length >= 2 && (
          <Panel judul="Biaya tiap Kegiatan" baca="Naik-turunnya biaya antar kegiatan yang tercatat." tinggi={170}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={grafik} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                <XAxis dataKey="label" hide />
                <YAxis tickFormatter={tickRupiah} tick={sumbu} axisLine={false} tickLine={false} width={48} />
                <Tooltip {...tooltipProps} formatter={(v: unknown) => rp(Number(v) || 0)} cursor={{ stroke: W['--wr-cursor'] }} />
                <Line type="monotone" dataKey="Biaya" stroke={W['--wr-out']} strokeWidth={2.4} dot={{ r: 3, strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
        )}

        <h3 className="sp2-h3" style={{ margin: '1rem 0 .5rem' }}>Riwayat Kegiatan</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="sp2-tbl" style={{ minWidth: 560 }}>
            <thead><tr><th>Tanggal</th><th className="r">Jam Jalan</th><th>Part</th><th className="r">Biaya</th><th>Catatan</th></tr></thead>
            <tbody>
              {riwayat.slice(0, 12).map((x, i) => (
                <tr key={i}>
                  <td className="k">{fmtTanggal(x.waktu)}</td><td className="r">{x.rh !== null ? qty(x.rh) : '—'}</td>
                  <td>{potong(x.parts.slice(0, 2).map((p) => p.nama).join(', ') || '—', 54)}{x.parts.length > 2 ? ` +${x.parts.length - 2}` : ''}</td>
                  <td className="r">{rp(x.biaya)}</td>
                  <td>{potong([x.noMr && `MR ${x.noMr}`, x.pic, x.keterangan].filter(Boolean).join(' · ') || '—', 46)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {riwayat.length > 12 && <div className="jm-ket" style={{ marginTop: '.4rem' }}>Menampilkan 12 kegiatan terbaru dari {riwayat.length}.</div>}
        </div>

        <h3 className="sp2-h3" style={{ margin: '1rem 0 .5rem' }}>Buka di Menu Lain</h3>
        <div className="jm-tautan">
          <button type="button" className="sp2-btn" onClick={() => onNavigasi({ ke: 'laporan', mode: 'OUT' })}><TrendingDown size={14} /> Laporan Barang Keluar</button>
          <button type="button" className="sp2-btn" onClick={() => onNavigasi({ ke: 'spare-part' })}><Package size={14} /> Spare Part</button>
          <button type="button" className="sp2-btn" onClick={() => onNavigasi({ ke: 'aset', tab: 'ASSET_MGMT' })}><Boxes size={14} /> Asset Management</button>
        </div>
      </div>
    </div>
  );
}