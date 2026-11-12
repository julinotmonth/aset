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
  Plus, FileDown, FileUp, Download, Pencil, Trash2, CalendarPlus, Lock, ArrowUpRight, Tags, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { SiteMeta } from '../../data/siteStore';
import { labelPenuh } from './siteLabel';
import { NADA, WR_CSS } from './wrTema';
import type { Nada } from './wrTema';
import { PicaFormModal, PicaMingguModal } from './PicaFormModal';
import { PicaImportModal } from './PicaImportModal';
import { KelolaKategoriPica } from './KelolaKategoriPica';
import type { KategoriPica } from './KelolaKategoriPica';
import { buatExcelPica, simpanBerkas, labelMinggu, nomorMingguDari, nomorDariLabel } from './picaTemplate';
import type { PicaItem } from './picaTemplate';

interface PicaUpdate { week: string; catatan: string }

interface PicaSource {
  site: string; sheetId: string; gid: string;
  autoSync: boolean; lastSyncAt: string | null; lastStatus: string;
}

interface Props {
  site: string; labelSite: string; sites: SiteMeta[];
  onSiteChange: (site: string) => void; siteTerkunci: boolean;
  /** Hanya Super Admin yang melihat tombol Kelola Kategori (server juga menolak akun lain). */
  superAdmin?: boolean;
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


const SEMUA_SITE = '__semua__';

export function PicaView({ site, labelSite, sites, onSiteChange, siteTerkunci, superAdmin = false }: Props) {
  // Mode "Semua Site" (Super Admin / akun tanpa batas site): semua isu dari semua site sekaligus, tanpa buka satu per satu.
  const [semuaSite, setSemuaSite] = useState(false);
  const [filterSite, setFilterSite] = useState<string | null>(null);
  const modeSemua = semuaSite && !siteTerkunci;
  // Kategori: daftar resmi (diatur Super Admin), penyaring chip, dan pengurutan kolom Kategori.
  const [kategoriList, setKategoriList] = useState<KategoriPica[]>([]);
  const [filterKategori, setFilterKategori] = useState<string | null>(null);   // null = semua, '' = tanpa kategori
  const [urutKategori, setUrutKategori] = useState<'asc' | 'desc' | null>(null);
  const [kelolaKategori, setKelolaKategori] = useState(false);
  const namaKategori = useMemo(() => kategoriList.map((k) => k.nama), [kategoriList]);
  const muatKategori = useCallback(async () => {
    try { setKategoriList(await api.get<KategoriPica[]>('/pica/kategori')); } catch { /* daftar kosong: dropdown & chip menyesuaikan */ }
  }, []);
  useEffect(() => { void muatKategori(); }, [muatKategori]);
  const namaSite = useCallback((key: string) => labelPenuh(sites.find((x) => x.key === key)?.label ?? key), [sites]);
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
  // Input manual: form isu (baru/ubah), form catatan mingguan, import Excel, konfirmasi hapus.
  const [form, setForm] = useState<{ item: PicaItem | null } | null>(null);
  const [itemMinggu, setItemMinggu] = useState<PicaItem | null>(null);
  const [importTerbuka, setImportTerbuka] = useState(false);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState<string | null>(null);
  const [mengunduh, setMengunduh] = useState<'' | 'template' | 'export'>('');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      if (modeSemua) {
        setItems(await api.get<PicaItem[]>('/pica/semua'));
        setSource(null);
      } else {
        const [data, src] = await Promise.all([
          api.get<PicaItem[]>(`/pica?site=${encodeURIComponent(site)}`),
          api.get<PicaSource | null>(`/pica/source?site=${encodeURIComponent(site)}`),
        ]);
        setItems(data);
        setSource(src);
      }
    } catch (err) {
      setPesan({ tipe: 'error', teks: err instanceof Error ? err.message : 'Gagal memuat data PICA.' });
    } finally {
      setMemuat(false);
    }
  }, [site, modeSemua]);

  useEffect(() => { void muat(); }, [muat]);
  useEffect(() => { setFilterGolongan('SEMUA'); setCari(''); setExpanded(new Set()); setKonfirmasiHapus(null); setFilterSite(null); setFilterKategori(null); }, [site, modeSemua]);

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

  const selesaiSimpan = async (pesanOk: string, bukaId?: string) => {
    setForm(null); setItemMinggu(null); setImportTerbuka(false);
    setPesan({ tipe: 'ok', teks: pesanOk });
    await muat();
    if (bukaId) setExpanded((prev) => new Set(prev).add(bukaId));
  };

  const hapusIsu = async (it: PicaItem) => {
    try {
      await api.delete(`/pica/${it.id}`);
      setKonfirmasiHapus(null);
      setPesan({ tipe: 'ok', teks: `Isu No ${it.no} dihapus.` });
      await muat();
    } catch (err) {
      setPesan({ tipe: 'error', teks: err instanceof Error ? err.message : 'Gagal menghapus isu.' });
    }
  };

  const namaBerkas = (jenis: string) => `PICA_${labelSite.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${jenis}.xlsx`;

  const unduhTemplate = async () => {
    setMengunduh('template');
    try {
      const sekarang = nomorMingguDari();
      const minggu = [sekarang - 3, sekarang - 2, sekarang - 1, sekarang].filter((n) => n >= 1).map(labelMinggu);
      simpanBerkas(await buatExcelPica({ namaSite: labelSite, minggu, kategori: namaKategori }), namaBerkas('Template'));
      setPesan({ tipe: 'ok', teks: 'Template diunduh. Isi di Excel (petunjuknya ada di sheet “Petunjuk”), lalu unggah lewat tombol Import.' });
    } catch (err) {
      setPesan({ tipe: 'error', teks: err instanceof Error ? err.message : 'Gagal membuat template.' });
    } finally { setMengunduh(''); }
  };

  const unduhExport = async () => {
    setMengunduh('export');
    try {
      const adaMinggu = new Set<string>();
      for (const it of items) for (const u of it.updates) adaMinggu.add(u.week);
      if (!adaMinggu.size) adaMinggu.add(labelMinggu(nomorMingguDari()));
      const minggu = [...adaMinggu].sort((a, b) => nomorDariLabel(a) - nomorDariLabel(b));
      const isu = items.map((it) => ({
        no: it.no, tanggal: it.tanggal?.slice(0, 10) ?? '', problem: it.problem, identifikasi: it.identifikasi, deskripsi: it.deskripsi,
        targetDate: it.targetDate?.slice(0, 10) ?? '', pic: it.pic, status: it.status, kategori: it.kategori ?? '',
        updates: it.updates, origin: it.origin ?? 'sheet',
      }));
      const tgl = new Date().toISOString().slice(0, 10);
      simpanBerkas(await buatExcelPica({ namaSite: labelSite, minggu, isu, kategori: namaKategori }), namaBerkas(tgl));
      setPesan({ tipe: 'ok', teks: `${items.length} isu diekspor. Isu bersumber Google Sheet tidak akan berubah bila file ini diimpor kembali.` });
    } catch (err) {
      setPesan({ tipe: 'error', teks: err instanceof Error ? err.message : 'Gagal mengekspor.' });
    } finally { setMengunduh(''); }
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Isu yang jadi dasar kartu & tabel: seluruh isu, atau hanya satu site bila kartu site dipilih (mode Semua Site).
  const dasar = useMemo(() => (modeSemua && filterSite ? items.filter((it) => it.site === filterSite) : items), [items, modeSemua, filterSite]);

  const samaKategori = (it: PicaItem, f: string) => (it.kategori ?? '').toLowerCase() === f.toLowerCase();
  const berKategori = useMemo(
    () => (filterKategori === null ? dasar : dasar.filter((it) => samaKategori(it, filterKategori))), [dasar, filterKategori]);

  const ringkasan = useMemo(() => {
    const r = { total: berKategori.length, jalan: 0, overdue: 0, selesai: 0 };
    for (const it of berKategori) r[golonganStatus(it.status)]++;
    return r;
  }, [berKategori]);

  // Ringkasan per site: yang paling banyak overdue di paling atas — supaya masalah terlihat tanpa membuka site satu per satu.
  const perSite = useMemo(() => {
    const m = new Map<string, { key: string; label: string; total: number; jalan: number; overdue: number; selesai: number }>();
    for (const it of items) {
      const e = m.get(it.site) ?? { key: it.site, label: namaSite(it.site), total: 0, jalan: 0, overdue: 0, selesai: 0 };
      e.total++; e[golonganStatus(it.status)]++;
      m.set(it.site, e);
    }
    return [...m.values()].sort((a, b) => b.overdue - a.overdue || b.jalan - a.jalan || a.label.localeCompare(b.label));
  }, [items, namaSite]);
  const siteTanpaIsu = useMemo(() => sites.filter((x) => !items.some((it) => it.site === x.key)).map((x) => labelPenuh(x.label)), [sites, items]);

  const lolosStatusCari = useCallback((it: PicaItem) => {
    if (filterGolongan !== 'SEMUA' && golonganStatus(it.status) !== filterGolongan) return false;
    const q = cari.trim().toLowerCase();
    if (!q) return true;
    return `${modeSemua ? namaSite(it.site) : ''} ${it.no} ${it.problem} ${it.identifikasi} ${it.deskripsi} ${it.pic} ${it.kategori ?? ''}`.toLowerCase().includes(q);
  }, [filterGolongan, cari, modeSemua, namaSite]);

  // Chip kategori: jumlah mengikuti penyaring lain (site, status, pencarian) tapi bukan penyaring kategorinya sendiri.
  const chipKategori = useMemo(() => {
    const hitung = new Map<string, number>();
    for (const it of dasar) if (lolosStatusCari(it)) { const k = it.kategori ?? ''; hitung.set(k.toLowerCase(), (hitung.get(k.toLowerCase()) ?? 0) + 1); }
    const resmi = namaKategori.map((n) => ({ nama: n, jumlah: hitung.get(n.toLowerCase()) ?? 0 }));
    // Nama di data yang tak ada di daftar resmi (sisa data lama) tetap bisa disaring.
    const lain = [...hitung.keys()].filter((k) => k && !namaKategori.some((n) => n.toLowerCase() === k))
      .map((k) => ({ nama: dasar.find((it) => (it.kategori ?? '').toLowerCase() === k)?.kategori ?? k, jumlah: hitung.get(k) ?? 0 }));
    return { daftar: [...resmi, ...lain], tanpa: hitung.get('') ?? 0, semua: [...hitung.values()].reduce((a, b) => a + b, 0) };
  }, [dasar, lolosStatusCari, namaKategori]);

  const ditampilkan = useMemo(() => {
    const hasil = berKategori.filter(lolosStatusCari);
    if (!urutKategori) return hasil;
    // Urut menurut urutan kategori di Kelola Kategori; "tanpa kategori" selalu di akhir. Sort stabil: urutan awal (site, tanggal) terjaga.
    const posisi = (it: PicaItem) => { const i = namaKategori.findIndex((n) => n.toLowerCase() === (it.kategori ?? '').toLowerCase()); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
    const arah = urutKategori === 'asc' ? 1 : -1;
    return hasil.slice().sort((a, b) => {
      const pa = posisi(a), pb = posisi(b);
      if (pa === pb) return 0;
      if (pa === Number.MAX_SAFE_INTEGER) return 1;
      if (pb === Number.MAX_SAFE_INTEGER) return -1;
      return (pa - pb) * arah;
    });
  }, [berKategori, lolosStatusCari, urutKategori, namaKategori]);

  const kosong = !memuat && !items.length;

  return (
    <>
      <style>{WR_CSS}</style>
      {/* Filter + aksi */}
      <div className="glass-panel" style={{ borderRadius: 16, padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '.75rem', alignItems: 'center' }}>
        <select value={modeSemua ? SEMUA_SITE : site} disabled={siteTerkunci} aria-label="Pilih site"
          onChange={(e) => {
            if (e.target.value === SEMUA_SITE) { setSemuaSite(true); return; }
            setSemuaSite(false); onSiteChange(e.target.value);
          }}
          className="wr-ctl" style={kontrol}>
          {!siteTerkunci && <option value={SEMUA_SITE}>Semua Site</option>}
          {sites.map((s) => <option key={s.key} value={s.key}>{labelPenuh(s.label)}</option>)}
        </select>

        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--wr-txt-muted)' }} />
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari problem / PIC / no…" aria-label="Cari isu"
            className="wr-ctl" style={{ ...kontrol, paddingLeft: '2rem', width: 220, maxWidth: '100%' }} />
        </div>

        {modeSemua && (
          <span style={{ fontSize: '.76rem', color: 'var(--wr-txt-muted)' }}>
            Ringkasan seluruh site — pilih satu site untuk menambah, import, atau sinkron.
          </span>
        )}
        {!modeSemua && <>
        <button type="button" className="wr-btn wr-btn--primary" onClick={() => setForm({ item: null })} style={{ ...tombol, padding: '.5rem .95rem' }}>
          <Plus size={15} /> Tambah Isu
        </button>
        <button type="button" className="wr-btn" onClick={unduhTemplate} disabled={!!mengunduh} style={tombol}
          title="Unduh template Excel kosong untuk diisi lalu diimpor">
          {mengunduh === 'template' ? <Loader2 size={15} /> : <FileDown size={15} />} Template
        </button>
        <button type="button" className="wr-btn" onClick={() => setImportTerbuka(true)} style={tombol}
          title="Unggah template Excel yang sudah diisi">
          <FileUp size={15} /> Import
        </button>
        <button type="button" className="wr-btn" onClick={unduhExport} disabled={!!mengunduh || !items.length} style={{ ...tombol, opacity: items.length ? 1 : .5 }}
          title="Unduh semua isu site ini ke Excel">
          {mengunduh === 'export' ? <Loader2 size={15} /> : <Download size={15} />} Export
        </button>
        </>}

        <div style={{ flex: 1 }} />

        {superAdmin && (
          <button type="button" className="wr-btn" onClick={() => setKelolaKategori(true)} style={tombol} title="Tambah, ubah, urutkan, atau hapus kategori PICA (khusus Super Admin)">
            <Tags size={15} /> Kelola Kategori
          </button>
        )}

        {!modeSemua && <>
        <button type="button" className="wr-btn wr-btn--info" onClick={() => setPanelSumberTerbuka((v) => !v)}
          style={tombol}>
          <Link2 size={15} /> Sumber Sheet
        </button>

        <button type="button" className="wr-btn wr-btn--primary" onClick={sinkronkan} disabled={menyinkron || !source}
          title={source ? 'Tarik ulang dari Google Spreadsheet' : 'Atur sumber sheet terlebih dahulu'}
          style={{ ...tombol, padding: '.5rem .95rem', cursor: source ? 'pointer' : 'not-allowed', opacity: source ? 1 : .5 }}>
          {menyinkron ? <Loader2 size={15} /> : <RefreshCw size={15} />} Sync Sekarang
        </button>
        </>}
      </div>

      {/* Panel konfigurasi sumber */}
      {panelSumberTerbuka && !modeSemua && (
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
            Sheet harus dibagikan sebagai <strong>Anyone with the link — Viewer</strong>. Disinkronkan otomatis tiap 5 menit. Isu yang diinput manual lewat aplikasi tidak ikut terhapus oleh sinkronisasi.
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
          {modeSemua ? (
            <>
              <div>Belum ada data PICA di site mana pun.</div>
              <div style={{ fontSize: '.8rem', marginTop: '.4rem' }}>Pilih satu site di atas untuk mulai mencatat isu atau menyinkronkan dari Google Sheet.</div>
            </>
          ) : (
            <>
              <div>Belum ada data PICA untuk {labelSite}.</div>
              <div style={{ fontSize: '.8rem', marginTop: '.4rem' }}>
                Catat isu pertama lewat “Tambah Isu”, isi banyak sekaligus lewat “Template” lalu “Import”,
                atau atur sumber spreadsheet dan klik “Sync Sekarang”.
              </div>
            </>
          )}
        </div>
      )}

      <PicaFormModal isOpen={!!form} item={form?.item ?? null} site={form?.item?.site ?? site} labelSite={form?.item ? namaSite(form.item.site) : labelSite} kategori={namaKategori}
        onClose={() => setForm(null)} onSaved={(it, teks) => void selesaiSimpan(teks, it.id)} />
      <PicaMingguModal isOpen={!!itemMinggu} item={itemMinggu} onClose={() => setItemMinggu(null)}
        onSaved={(it, teks) => void selesaiSimpan(teks, it.id)} />
      {superAdmin && (
        <KelolaKategoriPica isOpen={kelolaKategori} onClose={() => setKelolaKategori(false)}
          onBerubah={() => { setFilterKategori(null); void muatKategori(); void muat(); }} />
      )}
      <PicaImportModal isOpen={importTerbuka} site={site} labelSite={labelSite} onClose={() => setImportTerbuka(false)}
        onDone={(teks) => void selesaiSimpan(teks)} />

      {!memuat && !kosong && (
        <>
          {/* Mode Semua Site: kondisi tiap site dalam satu pandangan — klik kartu untuk menyaring tabel ke site itu */}
          {modeSemua && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '.6rem', flexWrap: 'wrap', marginBottom: '.5rem' }}>
                <span style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--wr-txt-muted)' }}>
                  Kondisi per site · {perSite.length} site punya isu
                </span>
                {filterSite && (
                  <button type="button" className="wr-btn" onClick={() => setFilterSite(null)} style={{ ...tombol, padding: '.2rem .6rem', fontSize: '.72rem' }}>
                    Tampilkan semua site
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '.6rem' }}>
                {perSite.map((e) => {
                  const aktif = filterSite === e.key;
                  const n = e.overdue ? NADA.neg : e.jalan ? NADA.warn : NADA.in;
                  return (
                    <button key={e.key} type="button" className="wr-kpi" aria-pressed={aktif} onClick={() => setFilterSite(aktif ? null : e.key)}
                      style={{ textAlign: 'left', cursor: 'pointer', borderRadius: 14, padding: '.7rem .9rem',
                        ...(aktif ? { background: n.bg, border: `1px solid ${n.garis}`, boxShadow: `inset 0 -3px 0 ${n.warna}` } : {}) }}>
                      <div style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--txt-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.label}</div>
                      <div style={{ display: 'flex', gap: '.7rem', marginTop: '.35rem', fontSize: '.72rem', color: 'var(--wr-txt-muted)' }}>
                        <span style={{ color: e.overdue ? NADA.neg.teks : undefined, fontWeight: e.overdue ? 700 : 400 }}>{e.overdue} overdue</span>
                        <span>{e.jalan} berjalan</span>
                        <span>{e.selesai} close</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {siteTanpaIsu.length > 0 && (
                <div style={{ marginTop: '.5rem', fontSize: '.74rem', color: 'var(--wr-txt-muted)' }}>
                  Belum ada isu PICA tercatat: {siteTanpaIsu.join(', ')}.
                </div>
              )}
            </div>
          )}

          {/* Ringkasan status — klik untuk filter cepat */}
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <KartuRingkas label="Semua Isu" nilai={ringkasan.total} nada={NADA.info} aktif={filterGolongan === 'SEMUA'} onClick={() => setFilterGolongan('SEMUA')} />
            <KartuRingkas label="On Going" nilai={ringkasan.jalan} nada={NADA.warn} aktif={filterGolongan === 'jalan'} onClick={() => setFilterGolongan('jalan')} />
            <KartuRingkas label="Overdue" nilai={ringkasan.overdue} nada={NADA.neg} aktif={filterGolongan === 'overdue'} onClick={() => setFilterGolongan('overdue')} />
            <KartuRingkas label="Selesai / Close" nilai={ringkasan.selesai} nada={NADA.in} aktif={filterGolongan === 'selesai'} onClick={() => setFilterGolongan('selesai')} />
          </div>

          {(namaKategori.length > 0 || chipKategori.daftar.some((c) => c.jumlah > 0)) && (
            <div role="group" aria-label="Saring menurut kategori" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.4rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--wr-txt-muted)', marginRight: '.25rem' }}>Kategori</span>
              {[
                { kunci: null as string | null, nama: 'Semua', jumlah: chipKategori.semua },
                ...chipKategori.daftar.filter((c) => c.jumlah > 0 || (filterKategori ?? '').toLowerCase() === c.nama.toLowerCase()).map((c) => ({ kunci: c.nama as string | null, nama: c.nama, jumlah: c.jumlah })),
                ...(chipKategori.tanpa > 0 || filterKategori === '' ? [{ kunci: '' as string | null, nama: 'Tanpa kategori', jumlah: chipKategori.tanpa }] : []),
              ].map((c) => {
                const aktif = c.kunci === null ? filterKategori === null : filterKategori !== null && filterKategori.toLowerCase() === c.kunci.toLowerCase();
                return (
                  <button key={c.nama} type="button" className="wr-btn" aria-pressed={aktif} onClick={() => setFilterKategori(c.kunci)}
                    style={{ ...tombol, padding: '.3rem .7rem', fontSize: '.76rem', borderRadius: 999, gap: '.35rem',
                      ...(aktif ? { background: NADA.info.bg, borderColor: NADA.info.garis, color: NADA.info.teks, fontWeight: 700 } : {}) }}>
                    {c.nama}
                    <span style={{ fontSize: '.68rem', opacity: .75 }}>{c.jumlah}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="glass-panel" style={{ borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="wr-tbl wr-tbl--plain" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th style={{ padding: '.6rem .5rem', width: 28 }} />
                    {modeSemua && <th style={{ padding: '.6rem .5rem' }}>Site</th>}
                    <th style={{ padding: '.6rem .5rem' }}>No</th>
                    <th style={{ padding: '.6rem .5rem' }}>Tanggal</th>
                    <th style={{ padding: '.6rem .5rem', minWidth: 200 }}>Problem</th>
                    <th style={{ padding: '.6rem .5rem' }} aria-sort={urutKategori === 'asc' ? 'ascending' : urutKategori === 'desc' ? 'descending' : 'none'}>
                      <button type="button" onClick={() => setUrutKategori((v) => (v === null ? 'asc' : v === 'asc' ? 'desc' : null))}
                        title="Urutkan menurut kategori (klik lagi untuk membalik, sekali lagi untuk batal)"
                        style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '.3rem', font: 'inherit', color: urutKategori ? NADA.info.teks : 'inherit' }}>
                        Kategori
                        {urutKategori === 'asc' ? <ArrowUp size={12} /> : urutKategori === 'desc' ? <ArrowDown size={12} /> : <ArrowUpDown size={12} style={{ opacity: .55 }} />}
                      </button>
                    </th>
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
                    const manual = it.origin === 'manual';
                    const punyaDetail = manual || it.identifikasi || it.deskripsi || it.updates.length > 0;
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
                          {modeSemua && <td style={{ padding: '.6rem .5rem', whiteSpace: 'nowrap', fontWeight: 600 }}>{namaSite(it.site)}</td>}
                          <td style={{ padding: '.6rem .5rem', color: 'var(--wr-txt-muted)', whiteSpace: 'nowrap' }}>
                            {it.no}
                            {manual && <span title="Diinput lewat aplikasi — bisa diubah di sini" style={{ marginLeft: '.35rem', fontSize: '.6rem', fontWeight: 700, padding: '.05rem .35rem', borderRadius: 6,
                              background: NADA.info.bg, color: NADA.info.teks, border: `1px solid ${NADA.info.garis}`, verticalAlign: 'middle' }}>MANUAL</span>}
                          </td>
                          <td style={{ padding: '.6rem .5rem', whiteSpace: 'nowrap' }}>{fmtTgl(it.tanggal)}</td>
                          <td style={{ padding: '.6rem .5rem', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.problem}>
                            {it.problem || '-'}
                          </td>
                          <td style={{ padding: '.6rem .5rem', whiteSpace: 'nowrap', color: it.kategori ? 'inherit' : 'var(--wr-txt-muted)' }}>{it.kategori || '-'}</td>
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
                            <td colSpan={modeSemua ? 9 : 8} style={{ padding: '.9rem 1rem 1.1rem 1.6rem' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', alignItems: 'center', marginBottom: '.9rem' }} onClick={(e) => e.stopPropagation()}>
                                {modeSemua && (
                                  <button type="button" className="wr-btn wr-btn--info" onClick={() => { setSemuaSite(false); onSiteChange(it.site); }}
                                    style={{ ...tombol, padding: '.35rem .75rem', fontSize: '.78rem' }} title="Buka halaman PICA site ini">
                                    <ArrowUpRight size={14} /> Buka {namaSite(it.site)}
                                  </button>
                                )}
                                {manual ? (
                                  konfirmasiHapus === it.id ? (
                                    <>
                                      <span style={{ fontSize: '.78rem', color: NADA.neg.teks, fontWeight: 600 }}>Hapus isu No {it.no} beserta seluruh catatan mingguannya?</span>
                                      <button type="button" className="wr-btn" onClick={() => void hapusIsu(it)} style={{ ...tombol, padding: '.35rem .75rem', fontSize: '.78rem', color: NADA.neg.teks }}>Ya, hapus</button>
                                      <button type="button" className="wr-btn" onClick={() => setKonfirmasiHapus(null)} style={{ ...tombol, padding: '.35rem .75rem', fontSize: '.78rem' }}>Batal</button>
                                    </>
                                  ) : (
                                    <>
                                      <button type="button" className="wr-btn wr-btn--primary" onClick={() => setItemMinggu(it)} style={{ ...tombol, padding: '.35rem .75rem', fontSize: '.78rem' }}>
                                        <CalendarPlus size={14} /> Update Minggu
                                      </button>
                                      <button type="button" className="wr-btn" onClick={() => setForm({ item: it })} style={{ ...tombol, padding: '.35rem .75rem', fontSize: '.78rem' }}>
                                        <Pencil size={14} /> Ubah
                                      </button>
                                      <button type="button" className="wr-btn" onClick={() => setKonfirmasiHapus(it.id)} style={{ ...tombol, padding: '.35rem .75rem', fontSize: '.78rem' }}>
                                        <Trash2 size={14} /> Hapus
                                      </button>
                                    </>
                                  )
                                ) : (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem', fontSize: '.74rem', color: 'var(--wr-txt-muted)' }}>
                                    <Lock size={13} /> Isu ini ditarik dari Google Sheet — ubah di sheet-nya.
                                  </span>
                                )}
                              </div>
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
                    <tr><td colSpan={modeSemua ? 10 : 9} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--wr-txt-muted)', fontSize: '.8rem' }}>
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