// Tab "Ringkasan Aset" di halaman Aset Tetap & Depresiasi.
//
// Seluruh angka bersumber dari Asset Management (sheet "LIST ALL ASET"). Karena sheet itu
// tidak menyimpan tanggal beli/umur manfaat, penyusutan di sini berupa SIMULASI: pengguna
// memilih tarif % per tahun dan lama waktu, lalu halaman menghitung harga aset setelah
// disusutkan (garis lurus, tanpa nilai sisa).
import { useEffect, useMemo, useState } from 'react';
import {
  Package, MapPin, Banknote, Wallet, TrendingDown, Download, ArrowRight, Lightbulb, Layers, Boxes, Loader2,
  CheckCircle2, Calculator, ListChecks,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { AuthState } from '../../types';
import { api } from '../../lib/api';
import { labelSiteDariKey } from './siteLabel';
import { NADA, tooltipProps, useWrTema } from './wrTema';
import type { Nada } from './wrTema';
import { KpiKartu } from './eamUi';
import { angka, rupiahRingkas, unduhCsv, hariIni } from './eamHelpers';
import { tambahKlasifikasi, ringkasKlasifikasi, jenisTakDikenal, nilaiBaris } from './asetKlasifikasi';
import { KartuKelas, BadgeKategori } from './AsetKlasifikasiUi';
import type { AsetTab } from './Sidebar';

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const fmtTooltip = (v: unknown) => rp(Number(v) || 0);
/** Label sumbu: 12.500.000 → "12,5 jt" (tanpa awalan Rp supaya sumbu tidak penuh). */
const tickRupiah = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (a >= 1e6) return `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (a >= 1e3) return `${(n / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
  return String(Math.round(n));
};
/** Latar slider: bagian terisi hijau, sisanya abu-abu yang kontras di mode terang maupun gelap. */
const trackSlider = (v: number, min: number, max: number): React.CSSProperties => {
  const p = ((v - min) / (max - min)) * 100;
  return { background: `linear-gradient(to right, #00B572 ${p}%, color-mix(in srgb, var(--txt-primary) 22%, transparent) ${p}%)` };
};
const potong = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const batas = (n: number, min: number, max: number) => Math.min(Math.max(Number.isFinite(n) ? n : min, min), max);

// Baris Asset Management (subset kolom yang dipakai di sini).
interface BarisAm {
  id: string; site: string; namaBarang: string; jenis: string; merk: string; tipe: string;
  jumlah: number; alokasi: string; detailAlokasi: string; totalHarga: number; hargaEstimasi?: number;
}

// ── Potongan UI kecil ────────────────────────────────────────────────────
function Panel({ judul, baca, children, tinggi = 280 }: {
  judul: string; baca?: string; children: React.ReactNode; tinggi?: number | 'auto';
}) {
  return (
    <section className="glass-panel as-panel" aria-label={judul}>
      <h3 className="as-h3">{judul}</h3>
      {baca && <p className="as-baca">{baca}</p>}
      <div style={tinggi === 'auto' ? undefined : { height: tinggi }}>{children}</div>
    </section>
  );
}

function JudulBagian({ ikon: Ikon, teks, sub, aksi }: { ikon: React.ElementType; teks: string; sub?: string; aksi?: React.ReactNode }) {
  return (
    <div className="as-sec">
      <div style={{ minWidth: 0 }}>
        <div className="as-sec-t"><Ikon size={17} aria-hidden="true" /> {teks}</div>
        {sub && <div className="as-sec-s">{sub}</div>}
      </div>
      {aksi}
    </div>
  );
}

const Kosong = ({ teks }: { teks: string }) => <div className="as-kosong">{teks}</div>;

interface Temuan { id: string; nada: Nada; ikon: React.ElementType; judul: string; rincian: string; aksi?: { label: string; klik: () => void } }

export const AS_CSS = `
.as-panel{border-radius:18px;padding:1rem 1.1rem;min-width:0}
.as-h3{margin:0;font-size:.84rem;font-weight:700;color:var(--txt-primary)}
.as-baca{margin:.2rem 0 .7rem;font-size:.72rem;line-height:1.5;color:var(--wr-txt-muted)}
.as-row{display:grid;gap:1rem;margin-bottom:1rem;grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))}
.as-sec{display:flex;align-items:flex-end;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin:1.6rem 0 .8rem}
.as-sec-t{display:flex;align-items:center;gap:.5rem;font-size:.95rem;font-weight:800;color:var(--txt-primary)}
.as-sec-s{font-size:.76rem;color:var(--wr-txt-muted);margin-top:2px}
.as-kosong{height:100%;min-height:90px;display:grid;place-items:center;text-align:center;padding:1rem;font-size:.8rem;color:var(--wr-txt-muted)}
.as-temuan{display:grid;grid-template-columns:auto 1fr auto;gap:.75rem;align-items:center;padding:.7rem .85rem;border-radius:14px;background:var(--wr-tab-bg);border:1px solid var(--wr-line)}
.as-temuan-i{width:34px;height:34px;border-radius:10px;display:grid;place-items:center}
.as-temuan-j{font-size:.82rem;font-weight:700;color:var(--txt-primary)}
.as-temuan-r{font-size:.74rem;color:var(--wr-txt-muted);margin-top:1px;line-height:1.45}
.as-link{display:inline-flex;align-items:center;gap:.35rem;padding:.4rem .75rem;border-radius:9px;font:inherit;font-size:.76rem;font-weight:700;cursor:pointer;white-space:nowrap;
  background:var(--wr-btn-bg);color:var(--txt-primary);border:1px solid var(--wr-field-border)}
.as-link:hover{background:var(--wr-btn-bg-hover)}
.as-link:focus-visible{outline:2px solid var(--wr-focus,#00D084);outline-offset:2px}
.as-tbl{width:100%;border-collapse:collapse;font-size:.8rem}
.as-tbl th{text-align:left;font-size:.67rem;letter-spacing:.05em;text-transform:uppercase;color:var(--wr-txt-muted);padding:.5rem .55rem;border-bottom:1px solid var(--wr-line);white-space:nowrap}
.as-tbl th.r,.as-tbl td.r{text-align:right;font-variant-numeric:tabular-nums}
.as-tbl td{padding:.55rem .55rem;border-bottom:1px solid var(--wr-line);vertical-align:middle;color:var(--txt-secondary)}
.as-tbl td.k{color:var(--txt-primary);font-weight:600}
.as-tbl tbody tr:last-child td{border-bottom:0}
.as-tbl tfoot td{border-top:2px solid var(--wr-line);border-bottom:0;font-weight:800;color:var(--txt-primary)}
.as-tbl tr.sorot td{background:rgba(0,208,132,.10)}
.as-sim{display:grid;gap:.9rem}
.as-ctl{display:grid;gap:.35rem}
.as-ctl label{font-size:.72rem;font-weight:700;color:var(--txt-secondary)}
.as-ctl-row{display:flex;align-items:center;gap:.7rem}
.as-ctl input.as-range{flex:1;min-width:0;height:6px;border-radius:99px}
.as-num{width:84px;padding:.45rem .6rem;border-radius:10px;font:inherit;font-size:.85rem;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}
.as-hasil{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem}
.as-hasil>div{padding:.7rem .8rem;border-radius:14px;background:var(--wr-tab-bg);border:1px solid var(--wr-line)}
.as-hasil small{display:block;font-size:.68rem;letter-spacing:.04em;text-transform:uppercase;color:var(--wr-txt-muted)}
.as-hasil b{display:block;margin-top:.2rem;font-size:1.02rem;font-variant-numeric:tabular-nums;color:var(--txt-primary)}
.as-hasil>div.utama{background:rgba(0,208,132,.10);border-color:rgba(0,208,132,.45)}
.as-hasil>div.utama b{color:var(--wr-in-text,#00B572)}
.as-hasil em{display:block;margin-top:.1rem;font-size:.7rem;font-style:normal;color:var(--wr-txt-muted)}
@keyframes as-spin{to{transform:rotate(360deg)}}
.as-spin{animation:as-spin .9s linear infinite}
@media (prefers-reduced-motion:reduce){.as-spin{animation:none}}
`;

interface Props {
  auth: AuthState;
  /** Pindah tab (mis. ke Asset Management untuk melihat detail). */
  onBuka: (tab: AsetTab) => void;
}

export function AsetRingkasan({ auth, onBuka }: Props) {
  const { W } = useWrTema();

  // ── Data: Asset Management (sheet) — ditarik sekali saat tab dibuka ────
  const siteTerkunci = auth.role !== 'Super Admin' && auth.assignedSite !== 'global';
  const siteAm = siteTerkunci ? auth.assignedSite : 'global';
  const [am, setAm] = useState<BarisAm[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let batal = false;
    setMemuat(true);
    api.get<BarisAm[]>(`/weekly-reports?${new URLSearchParams({ site: siteAm, direction: 'ASET' })}`)
      .then((d) => { if (!batal) { setAm(d); setError(''); } })
      .catch((e: unknown) => { if (!batal) setError(e instanceof Error ? e.message : 'Gagal memuat data Asset Management.'); })
      .finally(() => { if (!batal) setMemuat(false); });
    return () => { batal = true; };
  }, [siteAm]);

  // ── Simulasi penyusutan ────────────────────────────────────────────────
  const [tarif, setTarif] = useState(20);   // % per tahun
  const [lama, setLama] = useState(1);      // tahun
  const tarifOk = batas(tarif, 0, 100);
  const lamaOk = Math.round(batas(lama, 1, 20));
  const totalPersen = Math.min(tarifOk * lamaOk, 100);     // % harga yang sudah disusutkan
  const sisaFaktor = 1 - totalPersen / 100;

  // ── Agregasi ───────────────────────────────────────────────────────────
  const m = useMemo(() => {
    const baris = tambahKlasifikasi(am);
    const nilaiTercatat = am.reduce((t, r) => t + r.totalHarga, 0);
    const nilaiEstimasi = am.reduce((t, r) => t + (r.totalHarga ? 0 : r.hargaEstimasi ?? 0), 0);
    const nilai = nilaiTercatat + nilaiEstimasi;

    const perLokasi = new Map<string, number>();
    for (const r of baris) perLokasi.set(r.alokasi || 'Tanpa lokasi', (perLokasi.get(r.alokasi || 'Tanpa lokasi') ?? 0) + nilaiBaris(r));
    const lokasi = [...perLokasi.entries()].map(([nama, v]) => ({ nama, 'Nilai Aset': v })).sort((a, b) => b['Nilai Aset'] - a['Nilai Aset']);

    const klas = ringkasKlasifikasi(baris);
    // Pareto: sub-kategori diurutkan dari nilai terbesar + persen kumulatif.
    const semuaSub = klas.flatMap((k) => k.subs.map((s) => ({ nama: s.nama, kelas: k.kelas, nilai: s.nilai, jumlah: s.jumlahAset })))
      .filter((s) => s.nilai > 0).sort((a, b) => b.nilai - a.nilai);
    const pareto = semuaSub.slice(0, 8).map((s) => ({ nama: potong(s.nama, 14), 'Nilai Aset': s.nilai }));

    return {
      jumlah: am.length, unit: am.reduce((t, r) => t + r.jumlah, 0), nilaiTercatat, nilaiEstimasi, nilai,
      lokasi, jumlahLokasi: lokasi.length, klas, pareto, semuaSub,
      takDikenal: jenisTakDikenal(baris),
      belumKlas: baris.filter((r) => r.kelas === 'Belum Terklasifikasi').length,
      tanpaHarga: am.filter((r) => !r.totalHarga && !r.hargaEstimasi).length,
      terklasifikasiPersen: baris.length ? Math.round((baris.filter((r) => r.kelas !== 'Belum Terklasifikasi').length / baris.length) * 100) : 0,
      termahal: [...baris].sort((a, b) => nilaiBaris(b) - nilaiBaris(a)).slice(0, 10),
    };
  }, [am]);

  // Kurva nilai per tahun (satu garis: total), sampai habis atau minimal sepanjang `lama`.
  const kurva = useMemo(() => {
    const horizon = tarifOk > 0 ? Math.min(Math.max(Math.ceil(100 / tarifOk), lamaOk), 20) : Math.max(lamaOk, 5);
    return Array.from({ length: horizon + 1 }, (_, t) => ({
      tahun: `Th ${t}`, Total: Math.round(m.nilai * Math.max(1 - (tarifOk * t) / 100, 0)),
    }));
  }, [m.nilai, tarifOk, lamaOk]);

  const skenario = useMemo(() => Array.from({ length: 11 }, (_, i) => {
    const p = i * 10;
    return { p, potongan: (m.nilai * p) / 100, nilai: (m.nilai * (100 - p)) / 100 };
  }), [m.nilai]);
  const barisSorot = Math.round(totalPersen / 10);   // baris skenario terdekat dengan hasil simulasi

  const nilaiSetelah = m.nilai * sisaFaktor;
  const potonganRp = m.nilai - nilaiSetelah;

  // ── Temuan otomatis ────────────────────────────────────────────────────
  const temuan = useMemo<Temuan[]>(() => {
    const t: Temuan[] = [];
    if (m.belumKlas > 0) t.push({
      id: 'belumklas', nada: NADA.info, ikon: Boxes,
      judul: `${m.belumKlas} item belum terklasifikasi`,
      rincian: 'Jenis pada sheet belum dikenali aturan Equipment/Building, jadi belum masuk rangkuman per kelas.',
      aksi: { label: 'Buka Asset Management', klik: () => onBuka('ASSET_MGMT') },
    });
    if (m.tanpaHarga > 0) t.push({
      id: 'tanpaharga', nada: NADA.warn, ikon: Banknote,
      judul: `${m.tanpaHarga} item belum punya harga`,
      rincian: 'Item ini tidak ikut terhitung dalam total harga aset, sehingga nilai bisa lebih rendah dari kenyataan.',
      aksi: { label: 'Buka Asset Management', klik: () => onBuka('ASSET_MGMT') },
    });
    if (m.nilai > 0 && m.nilaiEstimasi / m.nilai >= 0.3) t.push({
      id: 'estimasi', nada: NADA.warn, ikon: Wallet,
      judul: `${Math.round((m.nilaiEstimasi / m.nilai) * 100)}% total harga berasal dari estimasi`,
      rincian: 'Banyak item tidak punya harga pasti pada sheet. Lengkapi harga agar penyusutan lebih akurat.',
    });
    const terbesar = m.semuaSub[0];
    if (terbesar && m.nilai > 0 && m.semuaSub.length > 1) {
      const porsi = Math.round((terbesar.nilai / m.nilai) * 100);
      if (porsi >= 50) t.push({
        id: 'konsentrasi', nada: NADA.info, ikon: Layers,
        judul: `“${terbesar.nama}” menyumbang ${porsi}% total harga aset`,
        rincian: 'Nilai terkonsentrasi pada satu sub-kategori — perhatikan risiko dan kebutuhan penggantiannya.',
      });
    }
    return t;
  }, [m, onBuka]);

  const ekspor = () => unduhCsv(`ringkasan-aset-${hariIni()}.csv`, [
    ['RINGKASAN ASSET MANAGEMENT'],
    ['Item terdaftar', m.jumlah], ['Total unit', m.unit], ['Nilai tercatat', m.nilaiTercatat], ['Nilai estimasi', m.nilaiEstimasi], ['Total harga aset', m.nilai],
    [],
    ['SIMULASI PENYUSUTAN'], ['Tarif per tahun (%)', tarifOk], ['Lama (tahun)', lamaOk], ['Disusutkan (%)', totalPersen],
    ['Penyusutan (Rp)', Math.round(potonganRp)], ['Nilai setelah penyusutan (Rp)', Math.round(nilaiSetelah)],
    [],
    ['PER SUB-KATEGORI'], ['Kelas', 'Sub-kategori', 'Jumlah', 'Harga Awal', 'Penyusutan', 'Nilai Setelah Penyusutan'],
    ...m.klas.flatMap((k) => k.subs.map((s) => [k.kelas, s.nama, s.jumlahAset, s.nilai, Math.round(s.nilai - s.nilai * sisaFaktor), Math.round(s.nilai * sisaFaktor)])),
    [],
    ['NILAI PER TAHUN'], ['Tahun', 'Total'],
    ...kurva.map((p) => [p.tahun, p.Total]),
    [],
    ['SKENARIO PENYUSUTAN'], ['Disusutkan (%)', 'Penyusutan (Rp)', 'Nilai Aset (Rp)'],
    ...skenario.map((s) => [s.p, Math.round(s.potongan), Math.round(s.nilai)]),
  ]);

  const sumbu = { fontSize: 11, fill: W['--wr-txt-muted'] };
  const dot = { r: 3.5, strokeWidth: 2 };
  const adaData = !memuat && !error && m.jumlah > 0;

  return (
    <>
      <style>{AS_CSS}</style>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '.7rem' }}>
        <button type="button" className="wr-btn eam-btn" onClick={ekspor} disabled={!adaData} title="Unduh ringkasan dan simulasi sebagai CSV"><Download size={16} /> Export Ringkasan</button>
      </div>

      {memuat && <div className="glass-panel as-panel"><div className="as-kosong"><span style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem' }}><Loader2 size={16} className="as-spin" aria-hidden="true" /> Memuat data Asset Management…</span></div></div>}
      {!memuat && error && <div className="glass-panel as-panel"><div className="as-kosong" style={{ color: NADA.neg.teks }}>{error}</div></div>}
      {!memuat && !error && m.jumlah === 0 && (
        <div className="glass-panel as-panel">
          <Kosong teks="Belum ada data Asset Management. Sinkronkan sheet-nya di tab Asset Management — ringkasan di sini akan terisi otomatis." />
        </div>
      )}

      {adaData && (
        <>
          {/* ── 1. Angka kunci ── */}
          <div className="eam-kpis">
            <KpiKartu ikon={Package} warna="#A78BFA" label="Item Aset" nilai={angka(m.jumlah)} sub={`${angka(m.unit)} unit · ${m.terklasifikasiPersen}% terklasifikasi`} onKlik={() => onBuka('ASSET_MGMT')} />
            <KpiKartu ikon={Wallet} warna="#60A5FA" label="Total Harga Aset" nilai={rupiahRingkas(m.nilai)} sub={`tercatat ${rupiahRingkas(m.nilaiTercatat)} · estimasi ${rupiahRingkas(m.nilaiEstimasi)}`} />
            <KpiKartu ikon={MapPin} warna="#F59E0B" label="Lokasi" nilai={angka(m.jumlahLokasi)} sub="lokasi penyimpanan / penggunaan" />
            <KpiKartu ikon={TrendingDown} warna="#34D399" label="Nilai Setelah Penyusutan" nilai={rupiahRingkas(nilaiSetelah)} nilaiWarna="#34D399"
              sub={`disusutkan ${totalPersen.toLocaleString('id-ID', { maximumFractionDigits: 1 })}% (${tarifOk}%/th × ${lamaOk} th)`} />
          </div>

          {/* ── 2. Simulasi penyusutan ── */}
          <JudulBagian ikon={Calculator} teks="Simulasi Penyusutan" sub="Atur tarif dan lama penyusutan — harga aset setelah disusutkan langsung dihitung. Metode garis lurus, tanpa nilai sisa." />
          <div className="as-row">
            <section className="glass-panel as-panel as-sim" aria-label="Pengaturan simulasi">
              <div className="as-ctl">
                <label htmlFor="as-tarif">Penyusutan per tahun (%)</label>
                <div className="as-ctl-row">
                  <input id="as-tarif" type="range" min={0} max={100} step={1} value={tarifOk} className="as-range" style={trackSlider(tarifOk, 0, 100)} onChange={(e) => setTarif(Number(e.target.value))} aria-label="Tarif penyusutan per tahun" />
                  <input type="number" className="wr-ctl as-num" min={0} max={100} value={tarif} onChange={(e) => setTarif(Number(e.target.value))} aria-label="Tarif penyusutan per tahun dalam persen" />
                </div>
              </div>
              <div className="as-ctl">
                <label htmlFor="as-lama">Setelah berapa tahun</label>
                <div className="as-ctl-row">
                  <input id="as-lama" type="range" min={1} max={20} step={1} value={lamaOk} className="as-range" style={trackSlider(lamaOk, 1, 20)} onChange={(e) => setLama(Number(e.target.value))} aria-label="Lama penyusutan dalam tahun" />
                  <input type="number" className="wr-ctl as-num" min={1} max={20} value={lama} onChange={(e) => setLama(Number(e.target.value))} aria-label="Lama penyusutan dalam tahun" />
                </div>
              </div>
              <div className="as-hasil" aria-live="polite">
                <div><small>Harga awal</small><b>{rp(m.nilai)}</b></div>
                <div><small>Penyusutan {totalPersen.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%</small><b>− {rp(potonganRp)}</b></div>
                <div className="utama"><small>Nilai setelah penyusutan</small><b>{rp(nilaiSetelah)}</b>
                  <em>{totalPersen >= 100 ? 'habis disusutkan' : `${(100 - totalPersen).toLocaleString('id-ID', { maximumFractionDigits: 1 })}% dari harga awal`}</em></div>
              </div>
              {tarifOk > 0 && <p className="as-baca" style={{ margin: 0 }}>Dengan {tarifOk}% per tahun, aset habis disusutkan dalam ± {(100 / tarifOk).toLocaleString('id-ID', { maximumFractionDigits: 1 })} tahun.</p>}
            </section>

            <Panel judul="Nilai Aset menurut Tahun" baca="Turunnya nilai total aset dari tahun ke tahun. Garis putus-putus menandai tahun yang Anda pilih." tinggi={300}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={kurva} margin={{ top: 8, right: 14, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                  <XAxis dataKey="tahun" tick={sumbu} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={tickRupiah} tick={sumbu} axisLine={false} tickLine={false} width={52} />
                  <Tooltip {...tooltipProps} formatter={fmtTooltip} cursor={{ stroke: W['--wr-cursor'] }} />
                  <ReferenceLine x={`Th ${lamaOk}`} stroke={W['--wr-neutral']} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="Total" name="Nilai Aset" stroke={W['--wr-out']} strokeWidth={2.6} dot={dot} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          <div className="as-row">
            <Panel judul="Harga Aset per Sub-Kategori Setelah Penyusutan" baca={`Hasil simulasi ${tarifOk}% × ${lamaOk} tahun diterapkan ke tiap sub-kategori.`} tinggi="auto">
              <div style={{ overflowX: 'auto' }}>
                <table className="as-tbl" style={{ minWidth: 520 }}>
                  <thead><tr><th>Kategori</th><th className="r">Item</th><th className="r">Harga Awal</th><th className="r">Penyusutan</th><th className="r">Nilai Setelah</th></tr></thead>
                  <tbody>
                    {m.klas.flatMap((k) => k.subs.filter((s) => s.nilai > 0 || s.jumlahAset > 0).map((s) => (
                      <tr key={`${k.kelas}-${s.nama}`}>
                        <td className="k"><BadgeKategori kelas={k.kelas} sub={s.nama} /></td>
                        <td className="r">{angka(s.jumlahAset)}</td>
                        <td className="r">{rp(s.nilai)}</td>
                        <td className="r">− {rp(s.nilai - s.nilai * sisaFaktor)}</td>
                        <td className="r k">{rp(s.nilai * sisaFaktor)}</td>
                      </tr>
                    )))}
                  </tbody>
                  <tfoot><tr><td>Total</td><td className="r">{angka(m.jumlah)}</td><td className="r">{rp(m.nilai)}</td><td className="r">− {rp(potonganRp)}</td><td className="r">{rp(nilaiSetelah)}</td></tr></tfoot>
                </table>
              </div>
            </Panel>

            <Panel judul="Tabel Skenario: Disusutkan Berapa %, Jadi Berapa" baca="Harga seluruh aset pada tiap tingkat penyusutan. Baris hijau = paling dekat dengan simulasi Anda." tinggi="auto">
              <div style={{ overflowX: 'auto' }}>
                <table className="as-tbl">
                  <thead><tr><th>Disusutkan</th><th className="r">Penyusutan</th><th className="r">Nilai Aset</th></tr></thead>
                  <tbody>
                    {skenario.map((s, i) => (
                      <tr key={s.p} className={i === barisSorot ? 'sorot' : undefined}>
                        <td className="k">{s.p}%</td>
                        <td className="r">− {rp(s.potongan)}</td>
                        <td className="r k">{rp(s.nilai)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          {/* ── 3. Analisis ── */}
          <JudulBagian ikon={ListChecks} teks="Analisis Nilai Aset" sub="Dari sub-kategori dan lokasi mana nilai aset berasal." />
          <div className="as-row">
            <Panel judul="Nilai Aset per Sub-Kategori" baca="Harga tiap sub-kategori, diurutkan dari yang terbesar. Makin tinggi titiknya, makin besar kontribusinya pada total aset." tinggi={300}>
              {m.pareto.length === 0 ? <Kosong teks="Belum ada sub-kategori bernilai." /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={m.pareto} margin={{ top: 8, right: 14, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                    <XAxis dataKey="nama" tick={{ ...sumbu, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tickFormatter={tickRupiah} tick={sumbu} axisLine={false} tickLine={false} width={52} />
                    <Tooltip {...tooltipProps} formatter={fmtTooltip} cursor={{ stroke: W['--wr-cursor'] }} />
                    <Line type="monotone" dataKey="Nilai Aset" stroke={W['--wr-out']} strokeWidth={2.6} dot={dot} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Panel>

            <Panel judul="Nilai Aset per Lokasi" baca="Delapan lokasi dengan harga aset tertinggi (terbesar ke terkecil)." tinggi={300}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={m.lokasi.slice(0, 8).map((l) => ({ ...l, nama: potong(l.nama, 14) }))} margin={{ top: 8, right: 14, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={W['--wr-grid']} vertical={false} />
                  <XAxis dataKey="nama" tick={{ ...sumbu, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tickFormatter={tickRupiah} tick={sumbu} axisLine={false} tickLine={false} width={52} />
                  <Tooltip {...tooltipProps} formatter={fmtTooltip} cursor={{ stroke: W['--wr-cursor'] }} />
                  <Line type="monotone" dataKey="Nilai Aset" stroke={W['--wr-out']} strokeWidth={2.6} dot={dot} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          <div className="as-row" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(300px,100%),1fr))' }}>
            {m.klas.map((k) => (
              <KartuKelas key={k.kelas} data={k} kelasAktif={null} subAktif={null} fmtNilai={rupiahRingkas}
                jenisTakDikenal={m.takDikenal} onPilih={() => onBuka('ASSET_MGMT')} />
            ))}
          </div>

          {/* ── 4. Daftar harga setelah penyusutan ── */}
          <JudulBagian ikon={Wallet} teks="10 Aset Bernilai Tertinggi" sub={`Harga awal dan nilai setelah penyusutan ${totalPersen.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%${siteTerkunci ? ` — site ${labelSiteDariKey(auth.assignedSite)}` : ' — seluruh site'}.`}
            aksi={<button type="button" className="as-link" onClick={() => onBuka('ASSET_MGMT')}>Lihat semua aset <ArrowRight size={13} aria-hidden="true" /></button>} />
          <div className="glass-panel as-panel" style={{ marginBottom: '1rem' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="as-tbl" style={{ minWidth: 640 }}>
                <thead><tr><th>Barang</th><th>Kategori</th><th className="r">Harga Awal</th><th className="r">Penyusutan</th><th className="r">Nilai Setelah</th></tr></thead>
                <tbody>
                  {m.termahal.map((r) => {
                    const awal = nilaiBaris(r);
                    return (
                      <tr key={r.id}>
                        <td className="k">{r.namaBarang}<br /><span style={{ fontSize: '.7rem', fontWeight: 400, color: 'var(--wr-txt-muted)' }}>{r.alokasi}</span></td>
                        <td><BadgeKategori kelas={r.kelas} sub={r.sub} /></td>
                        <td className="r">{rp(awal)}{!r.totalHarga && r.hargaEstimasi ? <span title="Harga estimasi" style={{ color: 'var(--wr-txt-muted)' }}> *</span> : null}</td>
                        <td className="r">− {rp(awal - awal * sisaFaktor)}</td>
                        <td className="r k">{rp(awal * sisaFaktor)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="as-baca" style={{ margin: '.6rem 0 0' }}>* harga estimasi (sheet tidak memuat harga pasti).</p>
          </div>

          {/* ── 5. Temuan ── */}
          <JudulBagian ikon={Lightbulb} teks="Catatan Kualitas Data" sub="Hal yang memengaruhi ketepatan angka di atas." />
          <div className="glass-panel as-panel" style={{ display: 'grid', gap: '.6rem' }}>
            {temuan.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', fontSize: '.84rem', color: NADA.in.teks }}>
                <CheckCircle2 size={18} aria-hidden="true" /> Data lengkap — tidak ada catatan.
              </div>
            ) : temuan.map((x) => {
              const Ikon = x.ikon;
              return (
                <div key={x.id} className="as-temuan">
                  <span className="as-temuan-i" style={{ background: x.nada.bg, color: x.nada.teks, border: `1px solid ${x.nada.garis}` }}><Ikon size={17} aria-hidden="true" /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="as-temuan-j">{x.judul}</div>
                    <div className="as-temuan-r">{x.rincian}</div>
                  </div>
                  {x.aksi && <button type="button" className="as-link" onClick={x.aksi.klik}>{x.aksi.label} <ArrowRight size={13} aria-hidden="true" /></button>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}