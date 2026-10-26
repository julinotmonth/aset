// Tab "Katalog & Pergerakan" di menu Spare Part.
//
// Menggabungkan baris Barang Masuk/Keluar dari SEMUA site, lalu hanya memakai yang
// kodenya diawali I-RDA atau I-RCE. Tiap kode menjadi satu item: total masuk/keluar,
// sisa stok, harga rata-rata, laju pemakaian, dan status kecukupan. Klik baris
// untuk melihat rincian per site, tren harga, dan transaksi terakhir.
import { useEffect, useMemo, useState } from 'react';
import {
  Boxes, Wallet, TrendingUp, TrendingDown, AlertTriangle, Download, RefreshCw, Loader2, Search, X,
  ChevronLeft, ChevronRight, ArrowUpDown,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getSites } from '../../data/siteStore';
import type { AuthState } from '../../types';
import { labelPenuh } from './siteLabel';
import { NADA, tooltipProps, fmtLegend, WR_CSS, useWrTema } from './wrTema';
import { KpiKartu, EAM_CSS } from './eamUi';
import { angka, rupiahRingkas, unduhCsv, hariIni } from './eamHelpers';
import {
  useDataSparePart, bangunItem, entitasDariKode, fmtTanggal, waktuBaris, normKode,
} from './sparePartData';
import type { ItemSp, StatusSp, Entitas } from './sparePartData';
import {
  SP_CSS, Panel, Peringkat, ChipStatus, ChipEntitas, rp, qty, tickRupiah, namaSite, fmtCover, fmtSisa, potong, NADA_STATUS,
} from './sparePartUi';

const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const STATUS: StatusSp[] = ['Kritis', 'Waspada', 'Aman', 'Tidak Bergerak', 'Cek Stok'];
const PER_HALAMAN = 20;
type Kolom = 'kode' | 'nama' | 'masuk' | 'keluar' | 'saldo' | 'hargaRata' | 'nilaiKeluar' | 'terakhir' | 'status';
const BOBOT_STATUS: Record<StatusSp, number> = { Kritis: 0, 'Cek Stok': 1, Waspada: 2, Aman: 3, 'Tidak Bergerak': 4 };

export function SparePartKatalog({ auth, cariAwal }: { auth: AuthState; cariAwal?: string }) {
  const { W } = useWrTema();
  const { rows, memuat, galat, siteTerkunci, muatUlang } = useDataSparePart(auth);
  const sites = getSites();

  const [site, setSite] = useState('ALL');
  const [entitas, setEntitas] = useState<'ALL' | Entitas>('ALL');
  const [tahun, setTahun] = useState<'ALL' | number>('ALL');
  const [status, setStatus] = useState<'ALL' | StatusSp>('ALL');
  const [cari, setCari] = useState(cariAwal ?? '');
  // Berpindah dari menu lain (mis. Jadwal Maintenance) dengan kode tertentu → isi pencarian dengan kode itu.
  useEffect(() => { if (cariAwal !== undefined) setCari(cariAwal); }, [cariAwal]);
  const [urut, setUrut] = useState<{ k: Kolom; arah: 'asc' | 'desc' }>({ k: 'nilaiKeluar', arah: 'desc' });
  const [hal, setHal] = useState(1);
  const [detail, setDetail] = useState<string | null>(null);

  const tahunAda = useMemo(() => [...new Set(rows.map((r) => r.tahun).filter(Boolean))].sort((a, b) => b - a), [rows]);
  const siteAda = useMemo(() => new Set(rows.map((r) => r.site)), [rows]);

  const rowsF = useMemo(() => rows.filter((r) =>
    (site === 'ALL' || r.site === site) &&
    (entitas === 'ALL' || entitasDariKode(r.kode) === entitas) &&
    (tahun === 'ALL' || r.tahun === tahun)), [rows, site, entitas, tahun]);

  const semua = useMemo(() => bangunItem(rowsF), [rowsF]);

  const hitungStatus = useMemo(() => {
    const c: Record<StatusSp, number> = { Kritis: 0, Waspada: 0, Aman: 0, 'Tidak Bergerak': 0, 'Cek Stok': 0 };
    for (const i of semua) c[i.status] += 1;
    return c;
  }, [semua]);

  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const f = semua.filter((i) => (status === 'ALL' || i.status === status) && (!q || i.kode.toLowerCase().includes(q) || i.nama.toLowerCase().includes(q)));
    const arah = urut.arah === 'asc' ? 1 : -1;
    const nilai = (i: ItemSp): number | string => {
      switch (urut.k) {
        case 'kode': return i.kode; case 'nama': return i.nama.toLowerCase();
        case 'masuk': return i.masuk; case 'keluar': return i.keluar; case 'saldo': return i.saldo;
        case 'hargaRata': return i.hargaRata; case 'nilaiKeluar': return i.nilaiKeluar;
        case 'terakhir': return i.terakhir ?? 0; case 'status': return BOBOT_STATUS[i.status];
      }
    };
    return [...f].sort((a, b) => {
      const x = nilai(a), y = nilai(b);
      return (typeof x === 'string' ? x.localeCompare(String(y), 'id') : (x as number) - (y as number)) * arah;
    });
  }, [semua, status, cari, urut]);

  useEffect(() => { setHal(1); }, [site, entitas, tahun, status, cari, urut]);
  const totalHal = Math.max(1, Math.ceil(daftar.length / PER_HALAMAN));
  const halAktif = Math.min(hal, totalHal);
  const tampil = daftar.slice((halAktif - 1) * PER_HALAMAN, halAktif * PER_HALAMAN);

  const k = useMemo(() => ({
    jenis: semua.length,
    rda: semua.filter((i) => i.entitas === 'RDA').length,
    rce: semua.filter((i) => i.entitas === 'RCE').length,
    nilaiMasuk: semua.reduce((t, i) => t + i.nilaiMasuk, 0),
    nilaiKeluar: semua.reduce((t, i) => t + i.nilaiKeluar, 0),
    nilaiSaldo: semua.reduce((t, i) => t + i.nilaiSaldo, 0),
  }), [semua]);

  // Nilai per bulan (12 bulan terakhir yang punya data) — dua garis: masuk vs keluar.
  const bulanan = useMemo(() => {
    const per = new Map<string, { t: number; Masuk: number; Keluar: number; label: string }>();
    for (const r of rowsF) {
      if (!r.tahun || !r.bulan) continue;
      const key = `${r.tahun}-${String(r.bulan).padStart(2, '0')}`;
      const e = per.get(key) ?? { t: r.tahun * 12 + r.bulan, Masuk: 0, Keluar: 0, label: `${NAMA_BULAN[r.bulan - 1]} ${String(r.tahun).slice(2)}` };
      if (r.direction === 'IN') e.Masuk += r.totalHarga; else e.Keluar += r.totalHarga;
      per.set(key, e);
    }
    return [...per.values()].sort((a, b) => a.t - b.t).slice(-12);
  }, [rowsF]);

  const topPakai = useMemo(() => [...semua].sort((a, b) => b.nilaiKeluar - a.nilaiKeluar).filter((i) => i.nilaiKeluar > 0).slice(0, 8)
    .map((i) => ({ label: i.nama || i.kode, sub: i.kode, nilai: i.nilaiKeluar, teks: rp(i.nilaiKeluar) })), [semua]);

  const perSite = useMemo(() => {
    const m = new Map<string, { keluar: number; masuk: number; jenis: number }>();
    for (const i of semua) for (const s of i.perSite) {
      const e = m.get(s.site) ?? { keluar: 0, masuk: 0, jenis: 0 };
      e.keluar += s.nilaiKeluar; e.masuk += s.nilaiMasuk; e.jenis += 1; m.set(s.site, e);
    }
    return [...m.entries()].sort((a, b) => b[1].keluar - a[1].keluar)
      .map(([s, v]) => ({ label: namaSite(s), sub: `${angka(v.jenis)} jenis · masuk ${rupiahRingkas(v.masuk)}`, nilai: v.keluar, teks: rp(v.keluar) }));
  }, [semua]);

  const ekspor = () => unduhCsv(`spare-part-${hariIni()}.csv`, [
    ['Kode', 'Entitas', 'Nama', 'Satuan', 'Masuk', 'Keluar', 'Sisa Stok (Estimasi)', 'Harga Rata-rata', 'Nilai Masuk', 'Nilai Keluar', 'Laju / Minggu', 'Cukup Untuk (minggu)', 'Terakhir Bergerak', 'Status'],
    ...daftar.map((i) => [i.kode, i.entitas, i.nama, i.satuan, i.masuk, i.keluar, i.saldo, Math.round(i.hargaRata), Math.round(i.nilaiMasuk), Math.round(i.nilaiKeluar),
      Math.round(i.laju * 100) / 100, i.cover === null ? '' : Math.round(i.cover * 10) / 10, fmtTanggal(i.terakhir), i.status]),
  ]);

  const urutKe = (kol: Kolom) => setUrut((u) => (u.k === kol ? { k: kol, arah: u.arah === 'asc' ? 'desc' : 'asc' } : { k: kol, arah: kol === 'kode' || kol === 'nama' ? 'asc' : 'desc' }));
  const Th = ({ kol, children, r }: { kol: Kolom; children: React.ReactNode; r?: boolean }) => (
    <th className={r ? 'r' : undefined} aria-sort={urut.k === kol ? (urut.arah === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="sp2-th" onClick={() => urutKe(kol)}>{children}<ArrowUpDown size={11} aria-hidden="true" style={{ opacity: urut.k === kol ? 1 : .35 }} /></button>
    </th>
  );

  const sumbu = { fontSize: 11, fill: W['--wr-txt-muted'] };
  const filterAktif = site !== 'ALL' || entitas !== 'ALL' || tahun !== 'ALL' || status !== 'ALL' || cari.trim() !== '';
  const itemDetail = detail ? semua.find((i) => i.kode === detail) ?? null : null;

  return (
    <>
      <style>{WR_CSS}{EAM_CSS}{SP_CSS}</style>

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
        <label>Tahun
          <select className="wr-ctl sp2-ctl" value={tahun} onChange={(e) => setTahun(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}>
            <option value="ALL">Semua</option>
            {tahunAda.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <div role="group" aria-label="Entitas" style={{ display: 'flex', gap: '.35rem' }}>
          {(['ALL', 'RDA', 'RCE'] as const).map((e) => (
            <button key={e} type="button" className="sp2-chip" aria-pressed={entitas === e} onClick={() => setEntitas(e)}>{e === 'ALL' ? 'RDA + RCE' : e}</button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 340 }}>
          <Search size={15} aria-hidden="true" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--wr-txt-muted)' }} />
          <input className="wr-ctl sp2-ctl" style={{ width: '100%', paddingLeft: 32 }} placeholder="Cari kode atau nama…" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari spare part" />
        </div>
        {filterAktif && <button type="button" className="sp2-btn" onClick={() => { setSite('ALL'); setEntitas('ALL'); setTahun('ALL'); setStatus('ALL'); setCari(''); }}><X size={14} /> Reset</button>}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '.45rem' }}>
          <button type="button" className="sp2-btn" onClick={muatUlang} disabled={memuat} title="Muat ulang dari server">
            {memuat ? <Loader2 size={14} className="sp2-spin" /> : <RefreshCw size={14} />} Muat Ulang
          </button>
          <button type="button" className="sp2-btn" onClick={ekspor} disabled={!daftar.length}><Download size={14} /> Export</button>
        </span>
      </div>

      {galat && <div className="glass-panel" style={{ borderRadius: 14, padding: '.7rem 1rem', marginBottom: '1rem', fontSize: '.78rem', color: NADA.neg.teks }}>{galat}</div>}

      {!memuat && rows.length === 0 && !galat && (
        <div className="glass-panel sp2-panel"><div className="sp2-kosong">Belum ada baris dengan kode I-RDA / I-RCE pada Laporan Mingguan.<br />Pastikan sheet tiap site sudah disinkronkan dan kolom Kode terisi.</div></div>
      )}
      {memuat && rows.length === 0 && <div className="glass-panel sp2-panel"><div className="sp2-kosong"><span style={{ display: 'inline-flex', gap: '.5rem', alignItems: 'center' }}><Loader2 size={16} className="sp2-spin" /> Mengambil data dari semua site…</span></div></div>}

      {rows.length > 0 && (
        <>
          {/* ── Angka kunci ── */}
          <div className="eam-kpis">
            <KpiKartu ikon={Boxes} warna="#A78BFA" label="Jenis Spare Part" nilai={angka(k.jenis)} sub={`${angka(k.rda)} RDA · ${angka(k.rce)} RCE`} />
            <KpiKartu ikon={TrendingUp} warna="#60A5FA" label="Nilai Masuk" nilai={rupiahRingkas(k.nilaiMasuk)} sub="total pembelian / penerimaan" />
            <KpiKartu ikon={TrendingDown} warna="#F59E0B" label="Nilai Keluar" nilai={rupiahRingkas(k.nilaiKeluar)} sub="total pemakaian" />
            <KpiKartu ikon={Wallet} warna="#34D399" label="Nilai Sisa Stok" nilai={rupiahRingkas(k.nilaiSaldo)} sub="sisa stok × harga rata-rata" />
            <KpiKartu ikon={AlertTriangle} warna="#F87171" label="Perlu Perhatian" nilai={angka(hitungStatus.Kritis + hitungStatus['Cek Stok'])}
              sub={`${angka(hitungStatus.Kritis)} kritis · ${angka(hitungStatus['Cek Stok'])} cek stok`} onKlik={() => { setStatus('Kritis'); window.setTimeout(() => document.getElementById('sp-katalog')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 50); }} />
          </div>

          {/* ── Tren & peringkat ── */}
          <div className="sp2-row">
            <Panel judul="Nilai Masuk vs Keluar per Bulan" baca="Biru = nilai spare part yang masuk, kuning = yang dipakai. Garis kuning di atas biru berarti pemakaian melampaui penerimaan pada bulan itu." tinggi={270}>
              {bulanan.length < 2 ? <div className="sp2-kosong">Data bulanan belum cukup untuk grafik.</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bulanan} margin={{ top: 8, right: 14, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                    <XAxis dataKey="label" tick={sumbu} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={tickRupiah} tick={sumbu} axisLine={false} tickLine={false} width={52} />
                    <Tooltip {...tooltipProps} formatter={(v: unknown) => rp(Number(v) || 0)} cursor={{ stroke: W['--wr-cursor'] }} />
                    <Legend wrapperStyle={{ fontSize: '.72rem' }} formatter={fmtLegend} />
                    <Line type="monotone" dataKey="Masuk" stroke={W['--wr-out']} strokeWidth={2.6} dot={{ r: 3.5, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Keluar" stroke={W['--wr-warn']} strokeWidth={2.6} dot={{ r: 3.5, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Panel>

            <Panel judul="Pemakaian per Site" baca="Nilai spare part yang dipakai di tiap site (terbesar ke terkecil).">
              <Peringkat baris={perSite} warna={W['--wr-warn']} kosong="Belum ada pemakaian tercatat." />
            </Panel>
          </div>

          <div className="sp2-row">
            <Panel judul="8 Spare Part Paling Banyak Dipakai" baca="Berdasarkan nilai pemakaian pada filter saat ini.">
              <Peringkat baris={topPakai} warna={W['--wr-out']} kosong="Belum ada pemakaian tercatat." />
            </Panel>

            <Panel judul="Kondisi Kecukupan Stok" baca="Klik untuk memfilter katalog. Sisa stok dibandingkan dengan rata-rata pemakaian 12 minggu terakhir.">
              <div style={{ display: 'grid', gap: '.5rem' }}>
                {STATUS.map((s) => {
                  const n = hitungStatus[s];
                  const persen = semua.length ? (n / semua.length) * 100 : 0;
                  return (
                    <button key={s} type="button" onClick={() => setStatus(status === s ? 'ALL' : s)} aria-pressed={status === s}
                      style={{ display: 'grid', gridTemplateColumns: '116px 1fr auto', gap: '.7rem', alignItems: 'center', padding: '.45rem .6rem', borderRadius: 12, cursor: 'pointer', font: 'inherit', textAlign: 'left',
                        background: status === s ? NADA_STATUS[s].bg : 'var(--wr-tab-bg)', border: `1px solid ${status === s ? NADA_STATUS[s].garis : 'var(--wr-line)'}` }}>
                      <ChipStatus s={s} />
                      <div className="sp2-bar" style={{ marginTop: 0 }}><span style={{ width: `${persen}%`, background: NADA_STATUS[s].warna }} /></div>
                      <b style={{ fontSize: '.8rem', color: 'var(--txt-primary)', fontVariantNumeric: 'tabular-nums' }}>{angka(n)}</b>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>

          {/* ── Katalog ── */}
          <section id="sp-katalog" className="glass-panel sp2-panel" aria-label="Katalog spare part" style={{ scrollMarginTop: 90 }}>
            <div className="sp2-ph">
              <div>
                <h3 className="sp2-h3">Katalog Spare Part</h3>
                <p className="sp2-baca">{angka(daftar.length)} dari {angka(semua.length)} jenis{status !== 'ALL' ? ` · status ${status}` : ''}. Klik baris untuk rincian per site.</p>
              </div>
            </div>
            {daftar.length === 0 ? <div className="sp2-kosong">Tidak ada spare part yang cocok dengan filter.</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="sp2-tbl" style={{ minWidth: 900 }}>
                  <thead><tr>
                    <Th kol="kode">Kode</Th><Th kol="nama">Nama</Th>
                    <Th kol="masuk" r>Masuk</Th><Th kol="keluar" r>Keluar</Th><Th kol="saldo" r>Sisa Stok</Th>
                    <Th kol="hargaRata" r>Harga Rata-rata</Th><Th kol="nilaiKeluar" r>Nilai Keluar</Th>
                    <Th kol="terakhir">Terakhir</Th><Th kol="status">Status</Th>
                  </tr></thead>
                  <tbody>
                    {tampil.map((i) => (
                      <tr key={i.kode} className="sp2-tr" tabIndex={0} onClick={() => setDetail(i.kode)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail(i.kode); } }}>
                        <td><span className="sp2-mono">{i.kode}</span> <ChipEntitas e={i.entitas} /></td>
                        <td className="k" style={{ maxWidth: 280 }}><span title={i.nama}>{potong(i.nama || '—', 46)}</span></td>
                        <td className="r">{qty(i.masuk)} <small>{i.satuan}</small></td>
                        <td className="r">{qty(i.keluar)}</td>
                        <td className="r k" title={i.saldo <= 0 ? `Tercatat ${qty(i.saldo)} (barang keluar lebih banyak dari yang tercatat masuk)` : undefined} style={{ color: i.saldo <= 0 ? NADA.neg.teks : undefined }}>{fmtSisa(i.saldo)}</td>
                        <td className="r">{rp(i.hargaRata)}</td>
                        <td className="r k">{rp(i.nilaiKeluar)}</td>
                        <td>{fmtTanggal(i.terakhir)}</td>
                        <td><ChipStatus s={i.status} /></td>
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

      {itemDetail && <DetailItem item={itemDetail} onTutup={() => setDetail(null)} />}
    </>
  );
}

// ── Rincian satu spare part ──────────────────────────────────────────────
function DetailItem({ item, onTutup }: { item: ItemSp; onTutup: () => void }) {
  const { W } = useWrTema();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onTutup(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onTutup]);

  // Pergerakan per bulan (qty masuk vs keluar) dan tren harga beli per pembelian.
  const bulanan = useMemo(() => {
    const per = new Map<string, { t: number; Masuk: number; Keluar: number; label: string }>();
    for (const r of item.baris) {
      if (!r.tahun || !r.bulan) continue;
      const key = `${r.tahun}-${r.bulan}`;
      const e = per.get(key) ?? { t: r.tahun * 12 + r.bulan, Masuk: 0, Keluar: 0, label: `${NAMA_BULAN[r.bulan - 1]} ${String(r.tahun).slice(2)}` };
      if (r.direction === 'IN') e.Masuk += r.jumlah; else e.Keluar += r.jumlah;
      per.set(key, e);
    }
    return [...per.values()].sort((a, b) => a.t - b.t).slice(-12);
  }, [item]);
  const harga = useMemo(() => item.baris.filter((r) => r.direction === 'IN' && (r.harga > 0 || (r.jumlah > 0 && r.totalHarga > 0)))
    .map((r) => ({ label: fmtTanggal(waktuBaris(r)), Harga: Math.round(r.harga || r.totalHarga / r.jumlah) })).slice(-12), [item]);
  const terakhir = useMemo(() => [...item.baris].reverse().slice(0, 8), [item]);
  const sumbu = { fontSize: 11, fill: W['--wr-txt-muted'] };
  const selisihHarga = harga.length >= 2 && harga[0].Harga > 0 ? ((harga[harga.length - 1].Harga - harga[0].Harga) / harga[0].Harga) * 100 : null;

  return (
    <div className="sp2-modal" onClick={onTutup} role="presentation">
      <div className="sp2-dlg" role="dialog" aria-modal="true" aria-label={`Rincian ${item.kode}`} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="sp2-mono" style={{ fontSize: '.8rem' }}>{normKode(item.kode)}</span><ChipEntitas e={item.entitas} /><ChipStatus s={item.status} />
            </div>
            <h2 style={{ margin: '.35rem 0 0', fontSize: '1.15rem', color: 'var(--txt-primary)' }}>{item.nama || 'Tanpa nama'}</h2>
          </div>
          <button type="button" className="sp2-btn" onClick={onTutup} aria-label="Tutup rincian" autoFocus><X size={15} /></button>
        </div>

        <div className="sp2-mini">
          <div><small>Masuk</small><b>{qty(item.masuk)} {item.satuan}</b></div>
          <div><small>Keluar</small><b>{qty(item.keluar)} {item.satuan}</b></div>
          <div><small>Sisa stok (estimasi)</small><b style={{ color: item.saldo <= 0 ? NADA.neg.teks : undefined }}>{item.saldo <= 0 ? 'Habis' : `${qty(item.saldo)} ${item.satuan}`}</b></div>
          <div><small>Harga rata-rata</small><b>{rp(item.hargaRata)}</b></div>
          <div><small>Rata-rata pakai / minggu</small><b>{qty(Math.round(item.laju * 10) / 10)}</b></div>
          <div><small>Stok cukup untuk</small><b>{fmtCover(item.cover)}</b></div>
        </div>

        <h3 className="sp2-h3" style={{ margin: '0 0 .5rem' }}>Rincian per Site</h3>
        <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
          <table className="sp2-tbl" style={{ minWidth: 560 }}>
            <thead><tr><th>Site</th><th className="r">Masuk</th><th className="r">Keluar</th><th className="r">Sisa Stok</th><th className="r">Pakai / minggu</th><th className="r">Cukup Untuk</th><th>Terakhir</th></tr></thead>
            <tbody>
              {item.perSite.map((s) => (
                <tr key={s.site}>
                  <td className="k">{namaSite(s.site)}</td><td className="r">{qty(s.masuk)}</td><td className="r">{qty(s.keluar)}</td>
                  <td className="r k" style={{ color: s.saldo <= 0 ? NADA.neg.teks : undefined }}>{fmtSisa(s.saldo)}</td>
                  <td className="r">{qty(Math.round(s.laju * 10) / 10)}</td><td className="r">{fmtCover(s.cover)}</td><td>{fmtTanggal(s.terakhir)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sp2-row" style={{ marginBottom: '1rem' }}>
          <Panel judul="Pergerakan per Bulan" baca={`Jumlah (${item.satuan || 'unit'}) yang masuk dan keluar.`} tinggi={200}>
            {bulanan.length < 2 ? <div className="sp2-kosong">Belum cukup data bulanan.</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bulanan} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                  <XAxis dataKey="label" tick={sumbu} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={sumbu} axisLine={false} tickLine={false} width={34} />
                  <Tooltip {...tooltipProps} cursor={{ stroke: W['--wr-cursor'] }} />
                  <Line type="monotone" dataKey="Masuk" stroke={W['--wr-out']} strokeWidth={2.4} dot={{ r: 3, strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="Keluar" stroke={W['--wr-warn']} strokeWidth={2.4} dot={{ r: 3, strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Panel>
          <Panel judul="Harga Beli per Pembelian"
            baca={selisihHarga === null ? 'Perubahan harga satuan dari waktu ke waktu.' : `Harga ${selisihHarga >= 0 ? 'naik' : 'turun'} ${Math.abs(selisihHarga).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% sejak pembelian pertama.`} tinggi={200}>
            {harga.length < 2 ? <div className="sp2-kosong">Perlu minimal dua pembelian berharga.</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={harga} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                  <XAxis dataKey="label" hide />
                  <YAxis tickFormatter={tickRupiah} tick={sumbu} axisLine={false} tickLine={false} width={46} domain={['auto', 'auto']} />
                  <Tooltip {...tooltipProps} formatter={(v: unknown) => rp(Number(v) || 0)} cursor={{ stroke: W['--wr-cursor'] }} />
                  <Line type="monotone" dataKey="Harga" stroke={W['--wr-aset']} strokeWidth={2.4} dot={{ r: 3, strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>

        <h3 className="sp2-h3" style={{ margin: '0 0 .5rem' }}>Transaksi Terakhir</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="sp2-tbl" style={{ minWidth: 560 }}>
            <thead><tr><th>Tanggal</th><th>Arah</th><th>Site</th><th className="r">Jumlah</th><th className="r">Nilai</th><th>Keterangan</th></tr></thead>
            <tbody>
              {terakhir.map((r) => (
                <tr key={r.id}>
                  <td>{fmtTanggal(waktuBaris(r))}</td>
                  <td>{r.direction === 'IN' ? <span style={{ color: NADA.out.teks, fontWeight: 700 }}>Masuk</span> : <span style={{ color: NADA.warn.teks, fontWeight: 700 }}>Keluar</span>}</td>
                  <td>{namaSite(r.site)}</td><td className="r">{qty(r.jumlah)} {r.satuan}</td><td className="r">{rp(r.totalHarga)}</td>
                  <td>{potong(r.alokasi || r.detailAlokasi || '—', 40)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}