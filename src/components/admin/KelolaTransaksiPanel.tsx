// Kelola Data (CRUD) Barang Masuk / Keluar langsung dari website.
//
// Tabel interaktif: cari langsung (ketik), saring tab/status/periode, urutkan lewat judul kolom, halaman, pilih banyak lalu hapus,
// ubah (form yang sama dengan "Catat", ada tinjauan sebelum → sesudah), salin jadi catatan baru, hapus dengan konfirmasi satu klik
// dan tombol "Urungkan". Semua perubahan ditulis ke Google Sheet (bila tersambung) lalu ke aplikasi — lihat server/src/weeklyInput.js.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, Plus, Pencil, Copy, Trash2, RefreshCw, Loader2, CloudOff, Cloud, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Undo2, AlertTriangle, CheckCircle2, BookOpen, Send, ListChecks } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { InputBarangPanel } from './InputBarangPanel';
import type { BarisKelola } from './InputBarangPanel';
import './formModal.css';
import './inputTransaksi.css';
import './kelolaTransaksi.css';

interface Baris {
  id: string; tab: string; entitas: string; tanggal: string | null; kode: string; nama: string; jumlah: number; satuan: string; alokasi: string;
  harga: number; totalHarga: number; pic: string; keterangan: string; noMr: string; status: 'ok' | 'pending' | 'gagal'; barisSheet: number | null; error: string;
  dariWeb: boolean; oleh: string; diubahOleh: string; diubahPada: string | null; waktu: string; nilai: Record<string, string | number> | null; alasanTerkunci: string;
}
interface Data {
  total: number; halaman: number; batas: number; tersambung: boolean; emailLayanan: string | null; sheetDiatur: boolean;
  ringkas: { total: number; tertunda: number }; tabs: { tab: string; entitas: string; jumlah: number }[]; baris: Baris[];
}
interface HasilHapus { ok: boolean; id: string; tab: string; nilai: Record<string, string | number> | null; pesan: string }
interface Toast { id: number; jenis: 'ok' | 'bad' | 'info'; teks: string; urungkan?: () => void }
type Urut = 'tanggal' | 'nama' | 'jumlah' | 'waktu';
type Periode = 'semua' | '7' | '30' | 'bulan';

interface Props {
  buka: boolean; site: string; siteLabel: string; arah: 'IN' | 'OUT'; entitasAwal?: string;
  onTutup: () => void; onBerubah: () => void; onBukaPanduan: () => void;
}

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pad = (n: number) => String(n).padStart(2, '0');
const isoLokal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const tgl = (iso: string | null) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${Number(iso.slice(8))} ${BLN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : '—');
const angka = (n: number, m = 2) => n.toLocaleString('id-ID', { maximumFractionDigits: m });
const NAMA_ENTITAS: Record<string, string> = { RDA: 'Mother Station', RCE: 'Workshop', RET: 'RET', UMUM: 'Umum' };

function rentang(p: Periode): { dari: string; sampai: string } {
  const h = new Date(), akhir = isoLokal(h);
  if (p === '7') { const d = new Date(h); d.setDate(d.getDate() - 6); return { dari: isoLokal(d), sampai: akhir }; }
  if (p === '30') { const d = new Date(h); d.setDate(d.getDate() - 29); return { dari: isoLokal(d), sampai: akhir }; }
  if (p === 'bulan') return { dari: `${h.getFullYear()}-${pad(h.getMonth() + 1)}-01`, sampai: akhir };
  return { dari: '', sampai: '' };
}

export function KelolaTransaksiPanel({ buka, site, siteLabel, arah, entitasAwal, onTutup, onBerubah, onBukaPanduan }: Props) {
  const [cari, setCari] = useState('');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('');
  const [status, setStatus] = useState<'semua' | 'ok' | 'tertunda'>('semua');
  const [periode, setPeriode] = useState<Periode>('semua');
  const [urut, setUrut] = useState<Urut>('tanggal');
  const [naik, setNaik] = useState(false);
  const [halaman, setHalaman] = useState(1);
  const [data, setData] = useState<Data | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set());
  const [konfirmasi, setKonfirmasi] = useState(''); // id baris yang menunggu "Ya, hapus", atau 'massal'
  const [bekerja, setBekerja] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [form, setForm] = useState<{ mode: 'tambah' | 'ubah' | 'salin'; baris?: BarisKelola } | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const cariRef = useRef<HTMLInputElement>(null);
  const reqRef = useRef(0);
  const toastId = useRef(0);
  const arahNama = arah === 'IN' ? 'Barang Masuk' : 'Barang Keluar';

  const toast = useCallback((jenis: Toast['jenis'], teks: string, urungkan?: () => void) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, jenis, teks, urungkan }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), urungkan ? 9000 : 4500);
  }, []);

  const muat = useCallback(async (senyap = false) => {
    const id = ++reqRef.current;
    if (!senyap) setMemuat(true);
    setGalat('');
    try {
      const { dari, sampai } = rentang(periode);
      const p = new URLSearchParams({ site, direction: arah, urut, sortir: naik ? 'asc' : 'desc', halaman: String(halaman), batas: '25', status });
      if (q) p.set('q', q);
      if (tab) p.set('tab', tab);
      if (dari) { p.set('dari', dari); p.set('sampai', sampai); }
      const d = await api.get<Data>(`/weekly-reports/input/data?${p}`);
      if (id !== reqRef.current) return; // permintaan lama
      setData(d);
      if (d.halaman > 1 && d.baris.length === 0 && d.total > 0) setHalaman(Math.max(1, Math.ceil(d.total / d.batas)));
    } catch (e) { if (id === reqRef.current) setGalat((e as Error).message); }
    finally { if (id === reqRef.current) setMemuat(false); }
  }, [site, arah, q, tab, status, periode, urut, naik, halaman]);

  // Buka panel: reset saringan. Awal: tab sesuai entitas halaman.
  useEffect(() => {
    if (!buka) return;
    setCari(''); setQ(''); setTab(''); setStatus('semua'); setPeriode('semua'); setUrut('tanggal'); setNaik(false); setHalaman(1);
    setTerpilih(new Set()); setKonfirmasi(''); setData(null); setForm(null);
  }, [buka, site, arah]);
  useEffect(() => { if (buka) void muat(); }, [buka, muat]);
  useEffect(() => {
    if (!data || tab || !entitasAwal) return;
    // pilih tab awal hanya sekali, saat data pertama tiba
    const t = data.tabs.find((x) => x.entitas === entitasAwal);
    if (t && data.tabs.length > 1) { setTab(t.tab); setHalaman(1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data === null]);

  // Cari langsung (tunda 300 ms)
  useEffect(() => {
    const t = setTimeout(() => { setQ(cari.trim()); setHalaman(1); }, 300);
    return () => clearTimeout(t);
  }, [cari]);

  useEffect(() => {
    if (!buka) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [buka]);

  // Auto-segar tiap 60 dtk saat panel terbuka dan tidak sedang mengisi form.
  useEffect(() => {
    if (!buka || form) return;
    const t = setInterval(() => { if (!document.hidden) void muat(true); }, 60_000);
    return () => clearInterval(t);
  }, [buka, form, muat]);

  const tombol = (e: React.KeyboardEvent) => {
    if (form) return;
    if (e.key === 'Escape') { e.stopPropagation(); if (konfirmasi) setKonfirmasi(''); else onTutup(); }
    else if (e.key === '/' && (e.target as HTMLElement).tagName !== 'INPUT') { e.preventDefault(); cariRef.current?.focus(); }
  };

  const tandaiKerja = (id: string, ya: boolean) => setBekerja((s) => { const n = new Set(s); if (ya) n.add(id); else n.delete(id); return n; });

  const bukaUbah = (b: Baris, mode: 'ubah' | 'salin') => {
    if (!b.nilai) { toast('bad', b.alasanTerkunci || 'Baris ini belum bisa diubah.'); return; }
    setForm({ mode, baris: { id: b.id, tab: b.tab, nama: b.nama, nilai: b.nilai } });
  };

  const urungkanHapus = async (h: HasilHapus) => {
    if (!h.nilai) return;
    try {
      const r = await api.post<{ status: string; pesan: string }>('/weekly-reports/input', { site, direction: arah, tab: h.tab, nilai: h.nilai }, { timeoutMs: 90_000, ulang: false });
      toast('ok', r.status === 'ok' ? 'Dikembalikan ke sheet (di baris paling bawah).' : 'Dikembalikan ke aplikasi.');
      void muat(true); onBerubah();
    } catch (e) { toast('bad', `Gagal mengurungkan: ${(e as Error).message}`); }
  };

  const hapusSatu = async (b: Baris) => {
    setKonfirmasi(''); tandaiKerja(b.id, true);
    try {
      const h = await api.delete<HasilHapus>(`/weekly-reports/input/${b.id}`, { timeoutMs: 90_000, ulang: false });
      toast('ok', `“${b.nama}” dihapus. ${h.pesan}`, h.nilai ? () => void urungkanHapus(h) : undefined);
      setTerpilih((s) => { const n = new Set(s); n.delete(b.id); return n; });
      await muat(true); onBerubah();
    } catch (e) {
      const err = e as ApiError;
      toast('bad', err.message);
      if ((err.data as { konflik?: string } | undefined)?.konflik === 'belum-tersambung') onBukaPanduan();
    } finally { tandaiKerja(b.id, false); }
  };

  const hapusMassal = async () => {
    const ids = [...terpilih]; setKonfirmasi('');
    ids.forEach((i) => tandaiKerja(i, true));
    try {
      const r = await api.post<{ hasil: HasilHapus[]; berhasil: number; gagal: number }>('/weekly-reports/input/hapus-massal', { ids }, { timeoutMs: 180_000, ulang: false });
      const berhasil = r.hasil.filter((h) => h.ok);
      toast(r.gagal ? 'bad' : 'ok', `${r.berhasil} baris dihapus${r.gagal ? `, ${r.gagal} gagal: ${r.hasil.find((h) => !h.ok)?.pesan ?? ''}` : '.'}`,
        berhasil.some((h) => h.nilai) ? () => void Promise.all(berhasil.map((h) => urungkanHapus(h))) : undefined);
      setTerpilih(new Set());
      await muat(true); onBerubah();
    } catch (e) { toast('bad', (e as Error).message); }
    finally { ids.forEach((i) => tandaiKerja(i, false)); }
  };

  const kirimTertunda = async () => {
    setMengirim(true);
    try {
      const r = await api.post<{ total: number; terkirim: number; gagal: number; pesanGagal: string }>('/weekly-reports/input/kirim-tertunda', { site }, { timeoutMs: 180_000, ulang: false });
      toast(r.gagal ? 'bad' : 'ok', r.gagal ? `${r.terkirim} terkirim, ${r.gagal} gagal: ${r.pesanGagal}` : `${r.terkirim} data terkirim ke Google Sheet.`);
      await muat(true); onBerubah();
    } catch (e) {
      const err = e as ApiError;
      toast('bad', err.message);
      if ((err.data as { konflik?: string } | undefined)?.konflik === 'belum-tersambung') onBukaPanduan();
    } finally { setMengirim(false); }
  };

  const kirimUlangSatu = async (b: Baris) => {
    tandaiKerja(b.id, true);
    try {
      const r = await api.post<{ status: string; pesan: string }>(`/weekly-reports/input/${b.id}/kirim-ulang`, undefined, { timeoutMs: 90_000, ulang: false });
      toast(r.status === 'ok' ? 'ok' : 'bad', r.pesan);
      await muat(true); onBerubah();
    } catch (e) { toast('bad', (e as Error).message); }
    finally { tandaiKerja(b.id, false); }
  };

  const klikUrut = (u: Urut) => { if (urut === u) setNaik((n) => !n); else { setUrut(u); setNaik(u === 'nama'); } setHalaman(1); };
  const semuaHalaman = !!data && data.baris.length > 0 && data.baris.every((b) => terpilih.has(b.id));
  const ubahSemua = () => setTerpilih((s) => { const n = new Set(s); if (semuaHalaman) data!.baris.forEach((b) => n.delete(b.id)); else data!.baris.forEach((b) => n.add(b.id)); return n; });
  const jmlHalaman = data ? Math.max(1, Math.ceil(data.total / data.batas)) : 1;
  const adaSaringan = !!(q || tab || status !== 'semua' || periode !== 'semua');
  const kunciTerkunci = useMemo(() => data?.baris.find((b) => b.alasanTerkunci.includes('Sambungkan')), [data]);

  if (!buka) return null;

  const Kepala = ({ u, children, kanan }: { u: Urut; children: React.ReactNode; kanan?: boolean }) => (
    <th scope="col" className={`kt-th${kanan ? ' kanan' : ''}`} aria-sort={urut === u ? (naik ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => klikUrut(u)}>{children}{urut === u && (naik ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</button>
    </th>
  );

  return (
    <div className="kt-overlay" onClick={(e) => { if (e.target === e.currentTarget && !form) onTutup(); }}>
      <div className="kt-panel" role="dialog" aria-modal="true" aria-label={`Kelola ${arahNama}`} onKeyDown={tombol}>
        <div className="im-head">
          <div className="im-head-ico"><ListChecks size={22} /></div>
          <div style={{ minWidth: 0 }}>
            <h3 className="im-title">Kelola {arahNama}</h3>
            <div className="im-sub">{siteLabel} · {data ? `${angka(data.ringkas.total, 0)} baris` : 'memuat…'} · ubah, salin, atau hapus — ikut tersinkron ke Google Sheet</div>
          </div>
          <button type="button" className="fm-close" onClick={onTutup} aria-label="Tutup">  <X size={18} /></button>
        </div>

        <div className="kt-bar">
          <div className="kt-cari">
            <Search size={16} aria-hidden="true" />
            <input ref={cariRef} value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama, kode, supplier/alokasi, PIC, No. MR…  (tekan /)" aria-label="Cari" />
            {cari && <button type="button" onClick={() => setCari('')} aria-label="Hapus pencarian"><X size={14} /></button>}
          </div>
          <button type="button" className="btn-primary kt-tambah" onClick={() => setForm({ mode: 'tambah' })}><Plus size={16} /> Tambah</button>
          <button type="button" className="im-btn-sec kt-ikon" onClick={() => void muat()} aria-label="Muat ulang" title="Muat ulang"><RefreshCw size={16} className={memuat ? 'im-putar' : undefined} /></button>
        </div>

        <div className="kt-filter">
          {data && data.tabs.length > 1 && (
            <div className="im-chips" role="group" aria-label="Tab">
              <button type="button" className="im-chip" aria-pressed={!tab} onClick={() => { setTab(''); setHalaman(1); }}>Semua tab</button>
              {data.tabs.map((t) => <button key={t.tab} type="button" className="im-chip" aria-pressed={tab === t.tab} onClick={() => { setTab(t.tab); setHalaman(1); }} title={t.tab}>{NAMA_ENTITAS[t.entitas] ?? t.entitas} · {t.jumlah}</button>)}
            </div>
          )}
          <div className="im-chips" role="group" aria-label="Periode">
            {([['semua', 'Semua tanggal'], ['7', '7 hari'], ['30', '30 hari'], ['bulan', 'Bulan ini']] as [Periode, string][]).map(([k, t]) => <button key={k} type="button" className="im-chip" aria-pressed={periode === k} onClick={() => { setPeriode(k); setHalaman(1); }}>{t}</button>)}
          </div>
          <div className="im-chips" role="group" aria-label="Status sheet">
            {([['semua', 'Semua status'], ['ok', 'Di sheet'], ['tertunda', 'Belum di sheet']] as ['semua' | 'ok' | 'tertunda', string][]).map(([k, t]) => <button key={k} type="button" className="im-chip" aria-pressed={status === k} onClick={() => { setStatus(k); setHalaman(1); }}>{t}</button>)}
            {adaSaringan && <button type="button" className="im-chip" onClick={() => { setCari(''); setQ(''); setTab(''); setStatus('semua'); setPeriode('semua'); setHalaman(1); }}>✕ Reset</button>}
          </div>
        </div>

        {data && !data.tersambung && (
          <div className="kt-info warn"><CloudOff size={16} />
            <div>{data.sheetDiatur ? 'Google Sheet belum tersambung.' : `Sumber Sheet ${siteLabel} belum diatur.`} Baris yang sudah ada di sheet <b>belum bisa diubah/dihapus</b> dari sini; data input web yang belum terkirim tetap bisa.</div>
            <button type="button" className="im-chip" onClick={onBukaPanduan}><BookOpen size={12} style={{ verticalAlign: '-2px' }} /> Panduan sambungkan</button>
          </div>
        )}
        {data && data.tersambung && data.ringkas.tertunda > 0 && (
          <div className="kt-info warn"><AlertTriangle size={16} /><div><b>{data.ringkas.tertunda}</b> data belum masuk ke Google Sheet.</div>
            <button type="button" className="im-chip" disabled={mengirim} onClick={() => void kirimTertunda()}>{mengirim ? 'Mengirim…' : <><Send size={12} style={{ verticalAlign: '-2px' }} /> Kirim sekarang</>}</button></div>
        )}
        {data && data.tersambung && <div className="kt-info ok" style={{ display: data.ringkas.tertunda || kunciTerkunci ? 'none' : undefined }}><Cloud size={16} /><div>Terhubung ke Google Sheet — perubahan langsung ditulis ke sheet.</div></div>}

        {terpilih.size > 0 && (
          <div className="kt-massal" role="status">
            <b>{terpilih.size} dipilih</b>
            {konfirmasi === 'massal'
              ? <><span>Hapus {terpilih.size} baris dari sheet &amp; aplikasi?</span><button type="button" className="kt-bahaya" onClick={() => void hapusMassal()}>Ya, hapus</button><button type="button" className="im-kecil" onClick={() => setKonfirmasi('')}>Batal</button></>
              : <><button type="button" className="kt-bahaya" onClick={() => setKonfirmasi('massal')}><Trash2 size={14} /> Hapus</button><button type="button" className="im-kecil" onClick={() => setTerpilih(new Set())}>Batal pilih</button></>}
          </div>
        )}

        <div className="kt-isi" aria-busy={memuat || undefined}>
          {galat && <div className="fm-error" role="alert" style={{ margin: '0.8rem 1.35rem' }}>{galat}</div>}
          {!data && !galat && <div className="im-muat"><Loader2 size={18} className="im-putar" /> Memuat data…</div>}
          {data && data.baris.length === 0 && (
            <div className="kt-kosong">
              <p><b>{adaSaringan ? 'Tidak ada data yang cocok.' : `Belum ada data ${arahNama.toLowerCase()}.`}</b></p>
              <p>{adaSaringan ? 'Ubah kata kunci atau reset saringan.' : 'Klik Tambah untuk mencatat transaksi pertama, atau Sync Sekarang untuk menarik dari sheet.'}</p>
            </div>
          )}
          {data && data.baris.length > 0 && (
            <div className={`kt-tabel-wrap${memuat ? ' memuat' : ''}`}>
              <table className="kt-tabel">
                <thead>
                  <tr>
                    <th className="kt-cek"><input type="checkbox" checked={semuaHalaman} onChange={ubahSemua} aria-label="Pilih semua di halaman ini" /></th>
                    <Kepala u="tanggal">Tanggal</Kepala>
                    <Kepala u="nama">Barang</Kepala>
                    <Kepala u="jumlah" kanan>Jumlah</Kepala>
                    <th className="kt-th">{arah === 'IN' ? 'Supplier' : 'Alokasi'}</th>
                    <th className="kt-th">PIC</th>
                    <Kepala u="waktu">Status</Kepala>
                    <th className="kt-th kanan">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.baris.map((b) => {
                    const sibuk = bekerja.has(b.id), pilih = terpilih.has(b.id), tanya = konfirmasi === b.id;
                    return (
                      <tr key={b.id} className={`${pilih ? 'dipilih' : ''}${sibuk ? ' sibuk' : ''}${tanya ? ' tanya' : ''}`} onDoubleClick={() => !sibuk && bukaUbah(b, 'ubah')}>
                        <td className="kt-cek"><input type="checkbox" checked={pilih} disabled={sibuk} onChange={() => setTerpilih((s) => { const n = new Set(s); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n; })} aria-label={`Pilih ${b.nama}`} /></td>
                        <td className="kt-tgl">{tgl(b.tanggal)}</td>
                        <td className="kt-brg"><b title={b.nama}>{b.nama}</b><span>{b.kode || '—'}{data.tabs.length > 1 ? ` · ${NAMA_ENTITAS[b.entitas] ?? b.entitas}` : ''}{b.noMr ? ` · MR ${b.noMr}` : ''}</span></td>
                        <td className="kanan kt-num">{angka(b.jumlah)} <small>{b.satuan}</small>{b.totalHarga > 0 && <span>Rp {angka(b.totalHarga, 0)}</span>}</td>
                        <td className="kt-alok" title={b.alokasi}>{b.alokasi || '—'}</td>
                        <td>{b.pic || '—'}</td>
                        <td>
                          <span className={`im-lencana ${b.status}`} title={b.error || undefined}>{b.status === 'ok' ? 'Di sheet' : b.status === 'pending' ? 'Menunggu' : 'Gagal kirim'}</span>
                          {b.diubahOleh && <span className="kt-ubah" title={b.diubahPada ? `Diubah ${new Date(b.diubahPada).toLocaleString('id-ID')}` : undefined}>diubah {b.diubahOleh}</span>}
                        </td>
                        <td className="kanan kt-aksi">
                          {sibuk ? <Loader2 size={16} className="im-putar" aria-label="Memproses" />
                            : tanya ? <><span className="kt-tanya">Hapus?</span><button type="button" className="kt-bahaya" onClick={() => void hapusSatu(b)} autoFocus>Ya</button><button type="button" className="im-kecil" onClick={() => setKonfirmasi('')}>Batal</button></>
                              : <>
                                {b.status !== 'ok' && <button type="button" className="kt-ikon-k" onClick={() => void kirimUlangSatu(b)} title="Kirim ulang ke sheet" aria-label="Kirim ulang"><Send size={15} /></button>}
                                <button type="button" className="kt-ikon-k" onClick={() => bukaUbah(b, 'ubah')} title={b.alasanTerkunci || 'Ubah'} aria-label={`Ubah ${b.nama}`} disabled={!!b.alasanTerkunci}><Pencil size={15} /></button>
                                <button type="button" className="kt-ikon-k" onClick={() => bukaUbah(b, 'salin')} title={b.alasanTerkunci || 'Salin jadi catatan baru'} aria-label={`Salin ${b.nama}`} disabled={!!b.alasanTerkunci}><Copy size={15} /></button>
                                <button type="button" className="kt-ikon-k bahaya" onClick={() => setKonfirmasi(b.id)} title="Hapus" aria-label={`Hapus ${b.nama}`}><Trash2 size={15} /></button>
                              </>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="kt-foot">
          <span>{data ? `${angka(data.total, 0)} baris${adaSaringan ? ' (disaring)' : ''}` : ''} · klik dua kali untuk mengubah</span>
          <div className="kt-hal">
            <button type="button" className="im-btn-sec kt-ikon" disabled={halaman <= 1 || memuat} onClick={() => setHalaman((h) => h - 1)} aria-label="Halaman sebelumnya"><ChevronLeft size={16} /></button>
            <span>Hal. {halaman} / {jmlHalaman}</span>
            <button type="button" className="im-btn-sec kt-ikon" disabled={halaman >= jmlHalaman || memuat} onClick={() => setHalaman((h) => h + 1)} aria-label="Halaman berikutnya"><ChevronRight size={16} /></button>
          </div>
        </div>

        <div className="kt-toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`kt-toast ${t.jenis}`}>
              {t.jenis === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{t.teks}</span>
              {t.urungkan && <button type="button" onClick={() => { const f = t.urungkan!; setToasts((x) => x.filter((y) => y.id !== t.id)); f(); }}><Undo2 size={13} /> Urungkan</button>}
              <button type="button" className="x" aria-label="Tutup" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}><X size={13} /></button>
            </div>
          ))}
        </div>
      </div>

      <InputBarangPanel
        buka={!!form} site={site} siteLabel={siteLabel} arah={arah} entitasAwal={entitasAwal}
        edit={form?.mode === 'ubah' ? form.baris ?? null : null} salin={form?.mode === 'salin' ? form.baris ?? null : null}
        onTutup={() => setForm(null)} onBukaPanduan={onBukaPanduan}
        onTersimpan={() => { void muat(true); onBerubah(); }} />
    </div>
  );
}