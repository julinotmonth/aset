// Tab "Rekomendasi Transfer" di menu Transfer Antar Site.
//
// Mencocokkan site yang KELEBIHAN stok (sisa stok cukup lama / tidak terpakai) dengan site
// yang KEKURANGAN (pemakaian ada tetapi sisa stok menipis), per kode I-RDA / I-RCE, memakai
// data Laporan Mingguan semua site. Hasilnya daftar usulan transfer berurutan menurut
// urgensi; pilih beberapa untuk dijadikan Rencana Transfer lalu ekspor / salin.
//
// Catatan: saldo = masuk − keluar pada data laporan (tanpa stok awal) → semua angka adalah
// estimasi. Usulan dengan saldo penerima ≤ 0 diberi tanda "verifikasi" agar stok fisik dicek dulu.
import { useMemo, useState } from 'react';
import {
  ArrowRight, Loader2, RefreshCw, Download, Copy, Check, Search, Boxes, Wallet, AlertTriangle, SlidersHorizontal, ClipboardList, ShoppingCart,
} from 'lucide-react';
import type { AuthState } from '../../types';
import { NADA, WR_CSS } from './wrTema';
import { KpiKartu, EAM_CSS } from './eamUi';
import { angka, rupiahRingkas, unduhCsv, hariIni } from './eamHelpers';
import {
  useDataSparePart, bangunItem, hitungRekomendasi, PARAM_TRANSFER_DEFAULT,
} from './sparePartData';
import type { ParamTransfer, Rekomendasi, Urgensi } from './sparePartData';
import {
  SP_CSS, Panel, Chip, ChipEntitas, NADA_URGENSI, rp, qty, namaSite, fmtCover, fmtSisa, ketStok, potong,
} from './sparePartUi';

const URGENSI: Urgensi[] = ['Tinggi', 'Sedang', 'Rendah'];
const batas = (n: number, min: number, max: number) => Math.min(Math.max(Number.isFinite(n) ? n : min, min), max);

export function TransferRekomendasi({ auth }: { auth: AuthState }) {
  const { rows, memuat, galat, muatUlang } = useDataSparePart(auth);

  const [param, setParam] = useState<ParamTransfer>(PARAM_TRANSFER_DEFAULT);
  const [urgensi, setUrgensi] = useState<'ALL' | Urgensi>('ALL');
  const [dari, setDari] = useState('ALL');
  const [ke, setKe] = useState('ALL');
  const [cari, setCari] = useState('');
  const [pilih, setPilih] = useState<ReadonlySet<string>>(new Set());
  const [tersalin, setTersalin] = useState(false);

  const p: ParamTransfer = {
    targetMinggu: batas(param.targetMinggu, 1, 52),
    batasSurplusMinggu: batas(param.batasSurplusMinggu, 2, 104),
    jendelaMinggu: batas(param.jendelaMinggu, 4, 52),
  };

  const items = useMemo(() => bangunItem(rows, { jendelaMinggu: p.jendelaMinggu }), [rows, p.jendelaMinggu]);
  const hasil = useMemo(() => hitungRekomendasi(items, p), [items, p.targetMinggu, p.batasSurplusMinggu, p.jendelaMinggu]); // eslint-disable-line react-hooks/exhaustive-deps

  const siteAda = useMemo(() => {
    const d = new Set<string>(), k = new Set<string>();
    for (const r of hasil.rekomendasi) { d.add(r.dari); k.add(r.ke); }
    return { dari: [...d].sort(), ke: [...k].sort() };
  }, [hasil]);

  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return hasil.rekomendasi.filter((r) =>
      (urgensi === 'ALL' || r.urgensi === urgensi) && (dari === 'ALL' || r.dari === dari) && (ke === 'ALL' || r.ke === ke) &&
      (!q || r.kode.toLowerCase().includes(q) || r.nama.toLowerCase().includes(q)));
  }, [hasil, urgensi, dari, ke, cari]);

  const ringkas = useMemo(() => {
    const rec = hasil.rekomendasi;
    const nilai = rec.reduce((t, r) => t + r.nilai, 0);
    const kirim = new Map<string, number>(), terima = new Map<string, number>();
    for (const r of rec) { kirim.set(r.dari, (kirim.get(r.dari) ?? 0) + r.nilai); terima.set(r.ke, (terima.get(r.ke) ?? 0) + r.nilai); }
    const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      jumlah: rec.length, nilai, tinggi: rec.filter((r) => r.urgensi === 'Tinggi').length,
      pengirim: top(kirim), penerima: top(terima),
      pengadaan: hasil.belumTerpenuhi.length, nilaiPengadaan: hasil.belumTerpenuhi.reduce((t, x) => t + x.nilai, 0),
    };
  }, [hasil]);

  // Matriks aliran: baris = site pengirim, kolom = site penerima, isi = nilai usulan.
  const matriks = useMemo(() => {
    const sites = [...new Set(hasil.rekomendasi.flatMap((r) => [r.dari, r.ke]))].sort();
    const sel = new Map<string, number>();
    for (const r of hasil.rekomendasi) sel.set(`${r.dari}|${r.ke}`, (sel.get(`${r.dari}|${r.ke}`) ?? 0) + r.nilai);
    return { sites, sel, maks: Math.max(...sel.values(), 0) };
  }, [hasil]);

  // ── Rencana transfer (usulan yang dicentang) ──
  const rencana = useMemo(() => hasil.rekomendasi.filter((r) => pilih.has(r.key)), [hasil, pilih]);
  const rencanaRute = useMemo(() => {
    const m = new Map<string, { dari: string; ke: string; item: number; nilai: number }>();
    for (const r of rencana) {
      const e = m.get(`${r.dari}|${r.ke}`) ?? { dari: r.dari, ke: r.ke, item: 0, nilai: 0 };
      e.item += 1; e.nilai += r.nilai; m.set(`${r.dari}|${r.ke}`, e);
    }
    return [...m.values()].sort((a, b) => b.nilai - a.nilai);
  }, [rencana]);
  const nilaiRencana = rencana.reduce((t, r) => t + r.nilai, 0);

  const toggle = (key: string) => setPilih((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const semuaTerpilih = daftar.length > 0 && daftar.every((r) => pilih.has(r.key));
  const toggleSemua = () => setPilih((s) => {
    const n = new Set(s);
    if (semuaTerpilih) daftar.forEach((r) => n.delete(r.key)); else daftar.forEach((r) => n.add(r.key));
    return n;
  });

  const teksRencana = () => {
    const per = new Map<string, Rekomendasi[]>();
    for (const r of rencana) { const k = `${namaSite(r.dari)} → ${namaSite(r.ke)}`; per.set(k, [...(per.get(k) ?? []), r]); }
    return [`Rencana Transfer Spare Part — ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, '',
      ...[...per.entries()].flatMap(([rute, list]) => [rute, ...list.map((r) => `• ${r.kode} ${r.nama} — ${qty(r.qty)} ${r.satuan}`), '']),
      `Total ${rencana.length} item, estimasi ${rp(nilaiRencana)}.`, 'Catatan: sisa stok dihitung dari data laporan (estimasi) — cek stok fisik sebelum mengirim.'].join('\n');
  };
  const salin = async () => {
    try { await navigator.clipboard.writeText(teksRencana()); setTersalin(true); window.setTimeout(() => setTersalin(false), 2200); }
    catch { window.prompt('Salin teks rencana transfer:', teksRencana()); }
  };
  const eksporRencana = () => unduhCsv(`rencana-transfer-${hariIni()}.csv`, [
    ['Dari Site', 'Ke Site', 'Kode', 'Nama', 'Jumlah', 'Satuan', 'Estimasi Nilai', 'Urgensi', 'Cek Fisik Dulu'],
    ...rencana.map((r) => [namaSite(r.dari), namaSite(r.ke), r.kode, r.nama, r.qty, r.satuan, Math.round(r.nilai), r.urgensi, r.perluVerifikasi ? 'Ya' : '']),
  ]);
  const eksporSemua = () => unduhCsv(`rekomendasi-transfer-${hariIni()}.csv`, [
    ['Dari Site', 'Ke Site', 'Kode', 'Nama', 'Jumlah', 'Satuan', 'Estimasi Nilai', 'Urgensi', 'Sisa Stok Pengirim', 'Cukup Untuk Pengirim (minggu)', 'Sisa Stok Penerima', 'Cukup Untuk Penerima (minggu)', 'Cek Fisik Dulu'],
    ...daftar.map((r) => [namaSite(r.dari), namaSite(r.ke), r.kode, r.nama, r.qty, r.satuan, Math.round(r.nilai), r.urgensi, r.saldoDari,
      r.coverDari === null ? '' : Math.round(r.coverDari * 10) / 10, r.saldoKe, r.coverKe === null ? '' : Math.round(r.coverKe * 10) / 10, r.perluVerifikasi ? 'Ya' : '']),
  ]);

  const ubah = (k: keyof ParamTransfer, v: string) => setParam((s) => ({ ...s, [k]: Number(v) }));

  return (
    <>
      <style>{WR_CSS}{EAM_CSS}{SP_CSS}{TF_CSS}</style>

      {galat && <div className="glass-panel" style={{ borderRadius: 14, padding: '.7rem 1rem', marginBottom: '1rem', fontSize: '.78rem', color: NADA.neg.teks }}>{galat}</div>}

      {/* ── Parameter ── */}
      <section className="glass-panel sp2-panel" style={{ marginBottom: '1rem' }} aria-label="Parameter perhitungan">
        <div className="sp2-ph">
          <div>
            <h3 className="sp2-h3" style={{ display: 'flex', gap: '.45rem', alignItems: 'center' }}><SlidersHorizontal size={15} aria-hidden="true" /> Aturan Perhitungan</h3>
            <p className="sp2-baca">Atur seberapa agresif usulan dibuat. Perubahan langsung diterapkan.</p>
          </div>
          <button type="button" className="sp2-btn" onClick={muatUlang} disabled={memuat}>{memuat ? <Loader2 size={14} className="sp2-spin" /> : <RefreshCw size={14} />} Muat Ulang</button>
        </div>
        <div className="tf-param">
          <label><span>Target kecukupan penerima</span>
            <div><input type="number" className="wr-ctl sp2-ctl" min={1} max={52} value={param.targetMinggu} onChange={(e) => ubah('targetMinggu', e.target.value)} /> <em>minggu pemakaian</em></div></label>
          <label><span>Pengirim dianggap berlebih bila cukup ≥</span>
            <div><input type="number" className="wr-ctl sp2-ctl" min={2} max={104} value={param.batasSurplusMinggu} onChange={(e) => ubah('batasSurplusMinggu', e.target.value)} /> <em>minggu</em></div></label>
          <label><span>Jendela hitung laju pemakaian</span>
            <div><input type="number" className="wr-ctl sp2-ctl" min={4} max={52} value={param.jendelaMinggu} onChange={(e) => ubah('jendelaMinggu', e.target.value)} /> <em>minggu terakhir</em></div></label>
          <button type="button" className="sp2-btn" onClick={() => setParam(PARAM_TRANSFER_DEFAULT)} style={{ alignSelf: 'end' }}>Atur ulang</button>
        </div>
      </section>

      {memuat && rows.length === 0 && <div className="glass-panel sp2-panel"><div className="sp2-kosong"><span style={{ display: 'inline-flex', gap: '.5rem', alignItems: 'center' }}><Loader2 size={16} className="sp2-spin" /> Mengambil data dari semua site…</span></div></div>}
      {!memuat && rows.length === 0 && !galat && <div className="glass-panel sp2-panel"><div className="sp2-kosong">Belum ada data spare part (kode I-RDA / I-RCE) pada Laporan Mingguan, jadi belum ada yang bisa dianalisis.</div></div>}

      {rows.length > 0 && (
        <>
          {/* ── Angka kunci ── */}
          <div className="eam-kpis">
            <KpiKartu ikon={Boxes} warna="#60A5FA" label="Usulan Transfer" nilai={angka(ringkas.jumlah)} sub={`${angka(ringkas.tinggi)} urgensi tinggi · ${angka(items.length)} jenis dianalisis`} />
            <KpiKartu ikon={Wallet} warna="#34D399" label="Estimasi Nilai Dipindahkan" nilai={rupiahRingkas(ringkas.nilai)} sub="qty usulan × harga rata-rata" />
            <KpiKartu ikon={ArrowRight} warna="#A78BFA" label="Pengirim Terbesar" nilai={ringkas.pengirim ? namaSite(ringkas.pengirim[0]) : '–'} sub={ringkas.pengirim ? rupiahRingkas(ringkas.pengirim[1]) : 'tidak ada surplus'} />
            <KpiKartu ikon={ArrowRight} warna="#F59E0B" label="Penerima Terbesar" nilai={ringkas.penerima ? namaSite(ringkas.penerima[0]) : '–'} sub={ringkas.penerima ? rupiahRingkas(ringkas.penerima[1]) : 'tidak ada kekurangan'} />
            <KpiKartu ikon={ShoppingCart} warna="#F87171" label="Perlu Pengadaan" nilai={angka(ringkas.pengadaan)} sub={ringkas.pengadaan ? `${rupiahRingkas(ringkas.nilaiPengadaan)} · tak ada surplus di site lain` : 'semua kebutuhan bisa dipenuhi'} />
          </div>

          {/* ── Peta aliran + rencana ── */}
          <div className="sp2-row" style={{ marginTop: '1rem' }}>
            <Panel judul="Peta Aliran Antar Site" baca="Nilai usulan dari site pengirim (baris) ke site penerima (kolom). Makin pekat, makin besar.">
              {matriks.sites.length === 0 ? <div className="sp2-kosong">Tidak ada usulan transfer pada aturan saat ini.</div> : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="sp2-tbl tf-matriks">
                    <thead><tr><th>Dari ↓ / Ke →</th>{matriks.sites.map((s) => <th key={s} className="r">{namaSite(s)}</th>)}</tr></thead>
                    <tbody>
                      {matriks.sites.map((d) => (
                        <tr key={d}>
                          <td className="k">{namaSite(d)}</td>
                          {matriks.sites.map((t) => {
                            const v = matriks.sel.get(`${d}|${t}`) ?? 0;
                            const pekat = matriks.maks > 0 ? Math.round((v / matriks.maks) * 70) + 8 : 0;
                            return (
                              <td key={t} className="r" title={v ? `${namaSite(d)} → ${namaSite(t)}: ${rp(v)}` : undefined}
                                style={v ? { background: `color-mix(in srgb, var(--wr-out) ${pekat}%, transparent)`, color: 'var(--txt-primary)', fontWeight: 700 } : { opacity: .35 }}>
                                {v ? rupiahRingkas(v).replace('Rp ', '') : d === t ? '·' : '–'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel judul="Rencana Transfer" baca={rencana.length ? `${angka(rencana.length)} item dipilih · estimasi ${rp(nilaiRencana)}` : 'Centang usulan di tabel untuk menyusun rencana, lalu ekspor atau salin sebagai pesan.'}
              aksi={rencana.length > 0 && <button type="button" className="sp2-btn" onClick={() => setPilih(new Set())}>Kosongkan</button>}>
              {rencana.length === 0 ? (
                <div className="sp2-kosong"><span style={{ display: 'inline-flex', gap: '.5rem', alignItems: 'center' }}><ClipboardList size={16} aria-hidden="true" /> Belum ada usulan yang dipilih.</span></div>
              ) : (
                <>
                  <div style={{ display: 'grid', gap: '.4rem', marginBottom: '.8rem' }}>
                    {rencanaRute.map((r) => (
                      <div key={`${r.dari}|${r.ke}`} className="tf-rute">
                        <span><b>{namaSite(r.dari)}</b> <ArrowRight size={12} aria-hidden="true" /> <b>{namaSite(r.ke)}</b></span>
                        <span>{angka(r.item)} item · {rp(r.nilai)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                    <button type="button" className="sp2-btn utama" onClick={salin}>{tersalin ? <Check size={14} /> : <Copy size={14} />} {tersalin ? 'Tersalin' : 'Salin sebagai pesan'}</button>
                    <button type="button" className="sp2-btn" onClick={eksporRencana}><Download size={14} /> Ekspor rencana</button>
                  </div>
                </>
              )}
            </Panel>
          </div>

          {/* ── Daftar usulan ── */}
          <section className="glass-panel sp2-panel" aria-label="Daftar usulan transfer" style={{ marginBottom: '1rem' }}>
            <div className="sp2-ph">
              <div>
                <h3 className="sp2-h3">Usulan Transfer</h3>
                <p className="sp2-baca">{angka(daftar.length)} dari {angka(hasil.rekomendasi.length)} usulan, urut dari paling mendesak.</p>
              </div>
              <button type="button" className="sp2-btn" onClick={eksporSemua} disabled={!daftar.length}><Download size={14} /> Export</button>
            </div>

            <div className="sp2-filter">
              <div role="group" aria-label="Urgensi" style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
                <button type="button" className="sp2-chip" aria-pressed={urgensi === 'ALL'} onClick={() => setUrgensi('ALL')}>Semua</button>
                {URGENSI.map((u) => (
                  <button key={u} type="button" className="sp2-chip" aria-pressed={urgensi === u} onClick={() => setUrgensi(urgensi === u ? 'ALL' : u)}>
                    {u} <small>{hasil.rekomendasi.filter((r) => r.urgensi === u).length}</small>
                  </button>
                ))}
              </div>
              <label>Dari
                <select className="wr-ctl sp2-ctl" value={dari} onChange={(e) => setDari(e.target.value)}>
                  <option value="ALL">Semua</option>{siteAda.dari.map((s) => <option key={s} value={s}>{namaSite(s)}</option>)}
                </select></label>
              <label>Ke
                <select className="wr-ctl sp2-ctl" value={ke} onChange={(e) => setKe(e.target.value)}>
                  <option value="ALL">Semua</option>{siteAda.ke.map((s) => <option key={s} value={s}>{namaSite(s)}</option>)}
                </select></label>
              <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
                <Search size={15} aria-hidden="true" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--wr-txt-muted)' }} />
                <input className="wr-ctl sp2-ctl" style={{ width: '100%', paddingLeft: 32 }} placeholder="Cari kode atau nama…" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari usulan" />
              </div>
            </div>

            {daftar.length === 0 ? (
              <div className="sp2-kosong">{hasil.rekomendasi.length === 0 ? 'Tidak ada usulan: tidak ada site yang berlebih sekaligus ada site lain yang kekurangan pada aturan saat ini. Coba turunkan batas “berlebih”.' : 'Tidak ada usulan yang cocok dengan filter.'}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="sp2-tbl" style={{ minWidth: 940 }}>
                  <thead><tr>
                    <th style={{ width: 32 }}><input type="checkbox" checked={semuaTerpilih} onChange={toggleSemua} aria-label="Pilih semua usulan yang tampil" /></th>
                    <th>Urgensi</th><th>Spare Part</th><th>Dari</th><th>Ke</th><th className="r">Jumlah</th><th className="r">Estimasi Nilai</th>
                  </tr></thead>
                  <tbody>
                    {daftar.slice(0, 200).map((r) => (
                      <tr key={r.key} style={pilih.has(r.key) ? { background: 'var(--wr-in-bg)' } : undefined}>
                        <td><input type="checkbox" checked={pilih.has(r.key)} onChange={() => toggle(r.key)} aria-label={`Pilih ${r.kode} dari ${namaSite(r.dari)} ke ${namaSite(r.ke)}`} /></td>
                        <td><Chip nada={NADA_URGENSI[r.urgensi]} teks={r.urgensi} />
                          {r.perluVerifikasi && <div style={{ marginTop: 3 }}><Chip nada={NADA.info} teks="Cek fisik dulu" title="Stok di site penerima tercatat habis pada laporan. Bisa jadi stok awalnya belum dicatat — pastikan jumlah fisiknya sebelum barang dikirim." /></div>}</td>
                        <td style={{ maxWidth: 260 }}><span className="sp2-mono">{r.kode}</span> <ChipEntitas e={r.entitas} />
                          <div className="k" title={r.nama} style={{ color: 'var(--txt-primary)', fontWeight: 600 }}>{potong(r.nama || '—', 44)}</div></td>
                        <td><b style={{ color: 'var(--txt-primary)' }}>{namaSite(r.dari)}</b>
                          <div className="tf-sub">{ketStok(r.saldoDari, r.coverDari)}</div></td>
                        <td><b style={{ color: 'var(--txt-primary)' }}>{namaSite(r.ke)}</b>
                          <div className="tf-sub" style={{ color: r.saldoKe <= 0 ? NADA.neg.teks : undefined }}>{ketStok(r.saldoKe, r.coverKe)}</div></td>
                        <td className="r k" style={{ color: 'var(--txt-primary)', fontWeight: 800 }}>{qty(r.qty)} <small style={{ fontWeight: 500 }}>{r.satuan}</small></td>
                        <td className="r">{rp(r.nilai)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {daftar.length > 200 && <div className="sp2-pg"><span>Menampilkan 200 usulan teratas dari {angka(daftar.length)}. Persempit dengan filter atau gunakan Export.</span></div>}
              </div>
            )}
          </section>

          {/* ── Kebutuhan tanpa pemasok ── */}
          <Panel judul="Perlu Pengadaan" baca="Site yang kekurangan, tetapi tidak ada site lain yang punya kelebihan untuk dikirim (atau kelebihannya tidak cukup).">
            {hasil.belumTerpenuhi.length === 0 ? <div className="sp2-kosong">Semua kekurangan bisa dipenuhi lewat transfer antar site. 🎉</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table className="sp2-tbl" style={{ minWidth: 640 }}>
                  <thead><tr><th>Spare Part</th><th>Site</th><th className="r">Sisa Stok</th><th className="r">Cukup Untuk</th><th className="r">Kurang</th><th className="r">Estimasi Nilai</th></tr></thead>
                  <tbody>
                    {hasil.belumTerpenuhi.slice(0, 12).map((x) => (
                      <tr key={`${x.kode}|${x.site}`}>
                        <td className="k"><span className="sp2-mono">{x.kode}</span><div title={x.nama}>{potong(x.nama || '—', 44)}</div></td>
                        <td>{namaSite(x.site)}</td>
                        <td className="r" style={{ color: x.saldo <= 0 ? NADA.neg.teks : undefined }}>{fmtSisa(x.saldo)}</td>
                        <td className="r">{fmtCover(x.cover)}</td>
                        <td className="r k">{qty(x.kurang)} <small style={{ fontWeight: 500 }}>{x.satuan}</small></td>
                        <td className="r">{rp(x.nilai)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {hasil.belumTerpenuhi.length > 12 && <div className="sp2-pg"><span>+ {hasil.belumTerpenuhi.length - 12} kebutuhan lainnya.</span></div>}
              </div>
            )}
          </Panel>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', margin: '1rem 0 0', fontSize: '.72rem', color: 'var(--wr-txt-muted)' }}>
            <AlertTriangle size={13} aria-hidden="true" /> Setelah barang benar-benar dikirim, catat transfernya di tab <b>Riwayat Transfer</b> agar stok inventori ikut berubah.
          </div>
        </>
      )}
    </>
  );
}

const TF_CSS = `
.tf-param{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.8rem;align-items:start}
.tf-param label{display:grid;gap:.35rem;font-size:.72rem;font-weight:700;color:var(--txt-secondary)}
.tf-param label>div{display:flex;align-items:center;gap:.5rem}
.tf-param input{width:84px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.tf-param em{font-style:normal;font-weight:500;color:var(--wr-txt-muted);font-size:.72rem}
.tf-rute{display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap;align-items:center;font-size:.78rem;padding:.5rem .7rem;border-radius:12px;background:var(--wr-tab-bg);border:1px solid var(--wr-line);color:var(--txt-secondary)}
.tf-rute b{color:var(--txt-primary)}
.tf-sub{font-size:.68rem;color:var(--wr-txt-muted);margin-top:1px}
.tf-matriks td,.tf-matriks th{padding:.5rem .6rem}
.tf-matriks tbody tr:last-child td{border-bottom:0}
`;