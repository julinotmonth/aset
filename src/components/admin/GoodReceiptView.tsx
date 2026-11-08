// Menu "Good Receipt" (Inventory): arsip dokumen GR per site — RDA (Mother Station), RCE (Workshop), RET.
//
// • Seret-lepas / pilih banyak PDF sekaligus. Tiap berkas langsung diperiksa ke server SEBELUM diunggah:
//   "Siap" · "Sudah ada" (isi PDF sama persis atau nama sama → otomatis tidak bisa diunggah) · "PO sama" (boleh dilanjutkan).
// • Nomor PO dan entitas (RDA/RCE/RET) dibaca otomatis dari nama berkas, bisa dikoreksi sebelum unggah.
// • Pengguna site hanya melihat/mengunggah GR site-nya; Super Admin melihat semua site dan bisa mengunggah ke site mana pun.
// • Daftar: cari, saring entitas/site, urutkan, lihat (pratinjau PDF langsung di halaman), unduh, ubah, hapus.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileCheck2, CloudUpload, FileText, Search, Eye, Download, Trash2, Pencil, X, Loader2, CheckCircle2, AlertTriangle, RefreshCw,
  ChevronLeft, ChevronRight, Copy, Building2,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { getSites, getSiteMeta } from '../../data/siteStore';
import type { AuthState } from '../../types';
import { labelPenuh } from './siteLabel';
import { PageHeader } from './AdminExtraViews';
import './goodReceipt.css';

type Entitas = 'RDA' | 'RCE' | 'RET' | 'UMUM';
const ENTITAS: Entitas[] = ['RDA', 'RCE', 'RET', 'UMUM'];
const NAMA_E: Record<Entitas, string> = { RDA: 'Mother Station', RCE: 'Workshop', RET: 'RET', UMUM: 'Lainnya' };
const MAKS_BYTE = 15 * 1024 * 1024;

interface Dok {
  id: string; site: string; entitas: Entitas; nomor: string; judul: string; namaFile: string; ukuran: number; catatan: string;
  diunggahOleh: string; diunggahPada: string; tanggalFile: string | null; bisaUbah: boolean;
}
interface Daftar {
  total: number; halaman: number; batas: number; bisaPilihSite: boolean; siteAktif: string | null;
  ringkas: { total: number; perEntitas: Partial<Record<Entitas, number>>; perSite: { site: string; n: number }[] };
  baris: Dok[];
}
interface Ringkas { id: string; site: string; namaFile: string; oleh: string; pada: string; sebab: 'isi' | 'nama' | 'nomor' }
type StatusItem = 'memeriksa' | 'siap' | 'po-sama' | 'duplikat' | 'unggah' | 'selesai' | 'gagal';
interface Item {
  kunci: string; file: File; sha: string; entitas: Entitas; nomor: string; status: StatusItem; pesan: string; progres: number; lanjutPo: boolean;
}
interface HasilCek { kunci: string; status: 'siap' | 'po-sama' | 'duplikat'; entitas: Entitas; nomor: string; duplikat?: Ringkas; poSama?: Ringkas[] }
interface Toast { id: number; jenis: 'ok' | 'bad'; teks: string }

const ukuranTeks = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const tglJam = (iso: string) => { const d = new Date(iso); return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`; };
const tglPendek = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

async function sha256(file: File): Promise<string> {
  try {
    if (!globalThis.crypto?.subtle) return '';
    const h = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch { return ''; }
}
const siteNama = (key: string) => labelPenuh(getSiteMeta(key).label);

export function GoodReceiptView({ auth }: { auth: AuthState }) {
  const semuaSite = auth.role === 'Super Admin' || auth.assignedSite === 'global';
  const sites = useMemo(() => getSites().filter((s) => semuaSite || s.key === auth.assignedSite), [semuaSite, auth.assignedSite]);

  const [siteFilter, setSiteFilter] = useState('semua');
  const [entitas, setEntitas] = useState<Entitas | ''>('');
  const [cari, setCari] = useState('');
  const [q, setQ] = useState('');
  const [urut, setUrut] = useState<'baru' | 'lama' | 'nomor' | 'nama'>('baru');
  const [halaman, setHalaman] = useState(1);
  const [data, setData] = useState<Daftar | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');

  const [siteUnggah, setSiteUnggah] = useState('');
  const [antrean, setAntrean] = useState<Item[]>([]);
  const [seret, setSeret] = useState(false);
  const [mengunggah, setMengunggah] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const antreanRef = useRef<Item[]>([]);
  antreanRef.current = antrean;

  const [pratinjau, setPratinjau] = useState<{ dok: Dok; url: string } | null>(null);
  const [membuka, setMembuka] = useState('');
  const [hapusId, setHapusId] = useState('');
  const [ubah, setUbah] = useState<Dok | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const tid = useRef(0);
  const reqRef = useRef(0);

  const toast = useCallback((jenis: Toast['jenis'], teks: string) => {
    const id = ++tid.current;
    setToasts((t) => [...t.slice(-3), { id, jenis, teks }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  // Site tujuan unggah: pengguna site = site-nya; Super Admin = site yang sedang disaring, atau site pertama.
  useEffect(() => {
    if (!semuaSite) { setSiteUnggah(auth.assignedSite as string); return; }
    setSiteUnggah((s) => (siteFilter !== 'semua' ? siteFilter : s || sites[0]?.key || ''));
  }, [semuaSite, auth.assignedSite, siteFilter, sites]);

  const muat = useCallback(async (senyap = false) => {
    const id = ++reqRef.current;
    if (!senyap) setMemuat(true);
    setGalat('');
    try {
      const p = new URLSearchParams({ site: semuaSite ? siteFilter : String(auth.assignedSite), urut, halaman: String(halaman), batas: '20' });
      if (entitas) p.set('entitas', entitas);
      if (q) p.set('q', q);
      const d = await api.get<Daftar>(`/gr?${p}`);
      if (id !== reqRef.current) return;
      setData(d);
      if (d.baris.length === 0 && d.total > 0 && d.halaman > 1) setHalaman(Math.max(1, Math.ceil(d.total / d.batas)));
    } catch (e) { if (id === reqRef.current) setGalat((e as Error).message); }
    finally { if (id === reqRef.current) setMemuat(false); }
  }, [semuaSite, siteFilter, auth.assignedSite, urut, halaman, entitas, q]);
  useEffect(() => { void muat(); }, [muat]);
  useEffect(() => { const t = setTimeout(() => { setQ(cari.trim()); setHalaman(1); }, 300); return () => clearTimeout(t); }, [cari]);
  useEffect(() => () => { if (pratinjau) URL.revokeObjectURL(pratinjau.url); }, [pratinjau]);

  // ── Antrean unggah ────────────────────────────────────────────────────────
  const terapkanCek = (hasil: HasilCek[]) => setAntrean((a) => a.map((it) => {
    const h = hasil.find((x) => x.kunci === it.kunci);
    if (!h || it.status === 'unggah' || it.status === 'selesai') return it;
    const pesan = h.status === 'duplikat' && h.duplikat
      ? (h.duplikat.sebab === 'isi' ? `Sudah ada: ${h.duplikat.namaFile} — diunggah ${h.duplikat.oleh || 'pengguna lain'}, ${tglPendek(h.duplikat.pada)} (${siteNama(h.duplikat.site)})`
        : `Nama sama sudah ada di site ini — diunggah ${h.duplikat.oleh || 'pengguna lain'}, ${tglPendek(h.duplikat.pada)}`)
      : h.status === 'po-sama' && h.poSama ? `${h.poSama.length} GR untuk ${h.nomor} sudah ada (mis. ${h.poSama[0].namaFile.slice(0, 40)}…). Lanjutkan bila ini GR berbeda.` : '';
    return { ...it, status: h.status, pesan, nomor: h.nomor || it.nomor, entitas: it.status === 'memeriksa' ? h.entitas : it.entitas };
  }));

  const periksaAntrean = useCallback(async (kunciList: string[], site: string) => {
    const daftar = antreanRef.current.filter((i) => kunciList.includes(i.kunci));
    if (!daftar.length || !site) return;
    try {
      const r = await api.post<{ hasil: HasilCek[] }>('/gr/cek', { site, berkas: daftar.map((i) => ({ kunci: i.kunci, nama: i.file.name, sha256: i.sha, ukuran: i.file.size })) });
      terapkanCek(r.hasil);
    } catch (e) {
      setAntrean((a) => a.map((i) => (kunciList.includes(i.kunci) && i.status === 'memeriksa' ? { ...i, status: 'gagal', pesan: (e as Error).message } : i)));
    }
  }, []);

  const tambahBerkas = async (daftar: FileList | File[]) => {
    const semua = [...daftar];
    const pdf = semua.filter((f) => /\.pdf$/i.test(f.name));
    const lewat = semua.length - pdf.length;
    if (lewat) toast('bad', `${lewat} berkas dilewati — hanya PDF yang diterima.`);
    const baru: Item[] = [];
    for (const f of pdf) {
      if (f.size > MAKS_BYTE) { toast('bad', `“${f.name}” melebihi 15 MB.`); continue; }
      if (antreanRef.current.some((i) => i.file.name === f.name && i.file.size === f.size) || baru.some((i) => i.file.name === f.name && i.file.size === f.size)) continue;
      baru.push({ kunci: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file: f, sha: '', entitas: 'UMUM', nomor: '', status: 'memeriksa', pesan: '', progres: 0, lanjutPo: false });
    }
    if (!baru.length) return;
    setAntrean((a) => [...a, ...baru]);
    // hitung sidik jari isi (SHA-256) lalu periksa ke server
    const dgn = await Promise.all(baru.map(async (i) => ({ ...i, sha: await sha256(i.file) })));
    // kembar di dalam antrean sendiri (isi sama)
    const lihat = new Set(antreanRef.current.filter((i) => i.sha).map((i) => i.sha));
    setAntrean((a) => a.map((i) => {
      const d = dgn.find((x) => x.kunci === i.kunci); if (!d) return i;
      if (d.sha && lihat.has(d.sha)) return { ...i, sha: d.sha, status: 'duplikat', pesan: 'Sama persis dengan berkas lain di daftar ini.' };
      if (d.sha) lihat.add(d.sha);
      return { ...i, sha: d.sha };
    }));
    await new Promise((r) => setTimeout(r)); // biarkan state terbarui
    await periksaAntrean(dgn.filter((d) => antreanRef.current.find((i) => i.kunci === d.kunci)?.status === 'memeriksa').map((d) => d.kunci), siteUnggah);
  };

  // Ganti site tujuan → periksa ulang yang belum diunggah
  const ganti = useRef(siteUnggah);
  useEffect(() => {
    if (ganti.current === siteUnggah) return;
    ganti.current = siteUnggah;
    const ulang = antreanRef.current.filter((i) => ['siap', 'po-sama', 'duplikat'].includes(i.status) && !(i.status === 'duplikat' && i.pesan.startsWith('Sama persis dengan berkas lain di daftar'))).map((i) => i.kunci);
    if (ulang.length) { setAntrean((a) => a.map((i) => (ulang.includes(i.kunci) ? { ...i, status: 'memeriksa', pesan: '' } : i))); void periksaAntrean(ulang, siteUnggah); }
  }, [siteUnggah, periksaAntrean]);

  const siapUnggah = (i: Item) => i.status === 'siap' || (i.status === 'po-sama' && i.lanjutPo);
  const adaSiap = antrean.some(siapUnggah);
  const jumlahSiap = antrean.filter(siapUnggah).length;

  const unggahSemua = async () => {
    setMengunggah(true);
    let ok = 0, tolak = 0;
    for (const it of antreanRef.current.filter(siapUnggah)) {
      setAntrean((a) => a.map((i) => (i.kunci === it.kunci ? { ...i, status: 'unggah', progres: 0, pesan: '' } : i)));
      try {
        const p = new URLSearchParams({ site: siteUnggah, nama: it.file.name, entitas: it.entitas });
        if (it.nomor) p.set('nomor', it.nomor);
        if (it.lanjutPo) p.set('abaikan', 'po');
        if (it.file.lastModified) p.set('tanggalFile', new Date(it.file.lastModified).toISOString().slice(0, 10));
        await api.unggah<Dok>(`/gr/upload?${p}`, it.file, { onProgress: (b) => setAntrean((a) => a.map((i) => (i.kunci === it.kunci ? { ...i, progres: b } : i))) });
        ok++;
        setAntrean((a) => a.map((i) => (i.kunci === it.kunci ? { ...i, status: 'selesai', progres: 1 } : i)));
      } catch (e) {
        const err = e as ApiError, konflik = (err.data as { konflik?: string } | undefined)?.konflik;
        tolak++;
        setAntrean((a) => a.map((i) => (i.kunci === it.kunci ? { ...i, status: konflik === 'duplikat' ? 'duplikat' : konflik === 'po-sama' ? 'po-sama' : 'gagal', pesan: err.message } : i)));
      }
    }
    setMengunggah(false);
    if (ok) { toast('ok', `${ok} dokumen GR berhasil diunggah.`); setHalaman(1); void muat(true); }
    if (tolak) toast('bad', `${tolak} berkas tidak bisa diunggah — lihat keterangan di daftar.`);
  };

  // ── Aksi dokumen ──────────────────────────────────────────────────────────
  const lihat = async (d: Dok) => {
    setMembuka(d.id);
    try {
      const h = await api.unduh(`/gr/${d.id}/berkas`);
      setPratinjau({ dok: d, url: URL.createObjectURL(new Blob([h.blob], { type: 'application/pdf' })) });
    } catch (e) { toast('bad', (e as Error).message); }
    finally { setMembuka(''); }
  };
  const unduh = async (d: Dok) => {
    setMembuka(d.id);
    try {
      const h = await api.unduh(`/gr/${d.id}/berkas?unduh=1`);
      const url = URL.createObjectURL(h.blob);
      const a = document.createElement('a'); a.href = url; a.download = d.namaFile; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { toast('bad', (e as Error).message); }
    finally { setMembuka(''); }
  };
  const hapus = async (d: Dok) => {
    setHapusId('');
    try { await api.delete(`/gr/${d.id}`); toast('ok', `“${d.namaFile.slice(0, 50)}” dihapus — berkas ini bisa diunggah lagi.`); await muat(true); }
    catch (e) { toast('bad', (e as Error).message); }
  };

  const jmlHal = data ? Math.max(1, Math.ceil(data.total / data.batas)) : 1;
  const adaFilter = !!(q || entitas || (semuaSite && siteFilter !== 'semua'));
  const tampilSite = semuaSite && (siteFilter === 'semua' || !data?.siteAktif);

  return (
    <>
      <PageHeader icon={FileCheck2} title="Good Receipt (GR)" sub="Arsip dokumen GR RDA · RCE · RET per site — unggah sekali, ambil kapan saja" />

      {/* ── Unggah ─────────────────────────────────────────────── */}
      <section className="gr-card" aria-label="Unggah GR">
        <div className="gr-unggah-kepala">
          <h3><CloudUpload size={18} /> Unggah GR</h3>
          {semuaSite ? (
            <label className="gr-tujuan">Ke site
              <select className="gr-ctl" value={siteUnggah} onChange={(e) => setSiteUnggah(e.target.value)} disabled={mengunggah}>
                {sites.map((s) => <option key={s.key} value={s.key}>{labelPenuh(s.label)}</option>)}
              </select>
            </label>
          ) : <span className="gr-lencana site"><Building2 size={13} /> {siteNama(auth.assignedSite as string)}</span>}
        </div>

        <div
          className={`gr-drop${seret ? ' aktif' : ''}`} role="button" tabIndex={0} aria-label="Pilih atau seret berkas PDF"
          onClick={() => inputRef.current?.click()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setSeret(true); }} onDragLeave={() => setSeret(false)}
          onDrop={(e) => { e.preventDefault(); setSeret(false); if (e.dataTransfer.files.length) void tambahBerkas(e.dataTransfer.files); }}>
          <CloudUpload size={30} aria-hidden="true" />
          <b>Seret PDF GR ke sini, atau klik untuk memilih</b>
          <span>Bisa banyak file sekaligus · PDF maks. 15 MB · nomor PO &amp; entitas dibaca dari nama file · berkas yang sudah ada otomatis ditolak</span>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { if (e.target.files) void tambahBerkas(e.target.files); e.target.value = ''; }} />
        </div>

        {antrean.length > 0 && (
          <div className="gr-antrean">
            {antrean.map((it) => (
              <div key={it.kunci} className={`gr-item ${it.status}`}>
                <div className="gr-item-ico">
                  {it.status === 'memeriksa' || it.status === 'unggah' ? <Loader2 size={18} className="gr-putar" />
                    : it.status === 'selesai' ? <CheckCircle2 size={18} />
                      : it.status === 'duplikat' || it.status === 'gagal' ? <X size={18} /> : it.status === 'po-sama' ? <AlertTriangle size={18} /> : <FileText size={18} />}
                </div>
                <div className="gr-item-isi">
                  <div className="gr-item-nama" title={it.file.name}>{it.file.name}</div>
                  <div className="gr-item-sub">
                    {ukuranTeks(it.file.size)}{it.nomor && <> · <b>{it.nomor}</b></>}
                    {it.status === 'memeriksa' && ' · memeriksa…'}
                    {it.status === 'siap' && ' · siap diunggah'}
                    {it.status === 'selesai' && ' · terunggah'}
                    {it.status === 'unggah' && ` · mengunggah ${Math.round(it.progres * 100)}%`}
                  </div>
                  {it.pesan && <div className={`gr-item-pesan ${it.status}`}>{it.pesan}</div>}
                  {it.status === 'unggah' && <div className="gr-bar"><i style={{ width: `${Math.round(it.progres * 100)}%` }} /></div>}
                  {it.status === 'po-sama' && (
                    <label className="gr-lanjut"><input type="checkbox" checked={it.lanjutPo} onChange={(e) => setAntrean((a) => a.map((i) => (i.kunci === it.kunci ? { ...i, lanjutPo: e.target.checked } : i)))} /> Tetap unggah (GR berbeda untuk PO yang sama)</label>
                  )}
                </div>
                {(it.status === 'siap' || it.status === 'po-sama') && (
                  <select className="gr-ctl kecil" value={it.entitas} aria-label="Entitas" onChange={(e) => setAntrean((a) => a.map((i) => (i.kunci === it.kunci ? { ...i, entitas: e.target.value as Entitas } : i)))}>
                    {ENTITAS.map((e) => <option key={e} value={e}>{e === 'UMUM' ? 'Lainnya' : `${e} · ${NAMA_E[e]}`}</option>)}
                  </select>
                )}
                {it.status !== 'unggah' && <button type="button" className="gr-ikon" aria-label="Keluarkan dari daftar" onClick={() => setAntrean((a) => a.filter((i) => i.kunci !== it.kunci))}><X size={15} /></button>}
              </div>
            ))}
            <div className="gr-antrean-aksi">
              <button type="button" className="btn-primary" disabled={!adaSiap || mengunggah} onClick={() => void unggahSemua()}>
                {mengunggah ? <><Loader2 size={16} className="gr-putar" /> Mengunggah…</> : <><CloudUpload size={16} /> Unggah {jumlahSiap} berkas</>}
              </button>
              <button type="button" className="gr-sec" disabled={mengunggah} onClick={() => setAntrean([])}>Kosongkan daftar</button>
              {antrean.some((i) => i.status === 'selesai') && <button type="button" className="gr-sec" onClick={() => setAntrean((a) => a.filter((i) => i.status !== 'selesai'))}>Bersihkan yang selesai</button>}
            </div>
          </div>
        )}
      </section>

      {/* ── Ringkasan + saringan ─────────────────────────────────── */}
      <div className="gr-ringkas">
        <button type="button" className={`gr-stat${!entitas ? ' aktif' : ''}`} onClick={() => { setEntitas(''); setHalaman(1); }}><span>Semua GR</span><b>{data?.ringkas.total ?? '–'}</b></button>
        {(['RDA', 'RCE', 'RET'] as Entitas[]).map((e) => (
          <button key={e} type="button" className={`gr-stat${entitas === e ? ' aktif' : ''}`} onClick={() => { setEntitas(entitas === e ? '' : e); setHalaman(1); }}><span>{NAMA_E[e]} · {e}</span><b>{data?.ringkas.perEntitas[e] ?? 0}</b></button>
        ))}
      </div>

      <section className="gr-card">
        <div className="gr-filter">
          <div className="gr-cari"><Search size={15} aria-hidden="true" />
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nomor PO, nama file, pengunggah, catatan…" aria-label="Cari GR" />
            {cari && <button type="button" onClick={() => setCari('')} aria-label="Hapus pencarian"><X size={13} /></button>}
          </div>
          {semuaSite && (
            <select className="gr-ctl" value={siteFilter} onChange={(e) => { setSiteFilter(e.target.value); setHalaman(1); }} aria-label="Site">
              <option value="semua">Semua Site{data ? ` (${data.ringkas.perSite.reduce((a, s) => a + s.n, 0)})` : ''}</option>
              {sites.map((s) => <option key={s.key} value={s.key}>{labelPenuh(s.label)}{data?.ringkas.perSite.find((x) => x.site === s.key) ? ` (${data.ringkas.perSite.find((x) => x.site === s.key)!.n})` : ''}</option>)}
            </select>
          )}
          <select className="gr-ctl" value={urut} onChange={(e) => { setUrut(e.target.value as typeof urut); setHalaman(1); }} aria-label="Urutkan">
            <option value="baru">Terbaru diunggah</option><option value="lama">Terlama diunggah</option><option value="nomor">Nomor PO</option><option value="nama">Nama file</option>
          </select>
          <button type="button" className="gr-ikon kotak" onClick={() => void muat()} aria-label="Muat ulang" title="Muat ulang"><RefreshCw size={15} className={memuat ? 'gr-putar' : undefined} /></button>
        </div>

        {galat && <div className="gr-galat" role="alert">{galat}</div>}
        {!data && !galat && <div className="gr-kosong"><Loader2 size={18} className="gr-putar" /> Memuat…</div>}
        {data && data.baris.length === 0 && (
          <div className="gr-kosong">
            <FileCheck2 size={30} aria-hidden="true" />
            <b>{adaFilter ? 'Tidak ada GR yang cocok.' : 'Belum ada GR yang diunggah.'}</b>
            <span>{adaFilter ? 'Ubah kata kunci atau reset saringan.' : 'Unggah PDF GR di bagian atas — nanti tinggal diambil dari sini.'}</span>
          </div>
        )}
        {data && data.baris.length > 0 && (
          <ul className={`gr-daftar${memuat ? ' memuat' : ''}`}>
            {data.baris.map((d) => (
              <li key={d.id} className="gr-baris">
                <div className="gr-pdf" aria-hidden="true"><FileText size={20} /><small>PDF</small></div>
                <div className="gr-utama">
                  <div className="gr-nomor">
                    <b>{d.nomor || 'Tanpa nomor PO'}</b>
                    <span className={`gr-lencana ${d.entitas}`}>{d.entitas === 'UMUM' ? 'Lainnya' : `${NAMA_E[d.entitas]} · ${d.entitas}`}</span>
                    {tampilSite && <span className="gr-lencana site">{siteNama(d.site)}</span>}
                  </div>
                  <div className="gr-nama" title={d.namaFile}>{d.judul || d.namaFile}</div>
                  <div className="gr-meta">{d.diunggahOleh || '—'} · {tglJam(d.diunggahPada)} · {ukuranTeks(d.ukuran)}{d.catatan && <> · <i>{d.catatan}</i></>}</div>
                </div>
                <div className="gr-aksi">
                  {membuka === d.id ? <Loader2 size={17} className="gr-putar" aria-label="Memproses" />
                    : hapusId === d.id ? <><span className="gr-tanya">Hapus GR ini?</span><button type="button" className="gr-bahaya" autoFocus onClick={() => void hapus(d)}>Ya, hapus</button><button type="button" className="gr-sec kecil" onClick={() => setHapusId('')}>Batal</button></>
                      : <>
                        <button type="button" className="gr-tombol" onClick={() => void lihat(d)}><Eye size={15} /> Lihat</button>
                        <button type="button" className="gr-tombol" onClick={() => void unduh(d)}><Download size={15} /> Unduh</button>
                        {d.bisaUbah && <button type="button" className="gr-ikon" onClick={() => setUbah(d)} aria-label="Ubah" title="Ubah entitas / nomor / catatan"><Pencil size={15} /></button>}
                        {d.bisaUbah && <button type="button" className="gr-ikon bahaya" onClick={() => setHapusId(d.id)} aria-label="Hapus" title="Hapus"><Trash2 size={15} /></button>}
                      </>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {data && data.total > data.batas && (
          <div className="gr-halaman">
            <span>{data.total} dokumen</span>
            <div>
              <button type="button" className="gr-ikon kotak" disabled={halaman <= 1 || memuat} onClick={() => setHalaman((h) => h - 1)} aria-label="Sebelumnya"><ChevronLeft size={16} /></button>
              <span>Hal. {halaman} / {jmlHal}</span>
              <button type="button" className="gr-ikon kotak" disabled={halaman >= jmlHal || memuat} onClick={() => setHalaman((h) => h + 1)} aria-label="Berikutnya"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </section>

      {/* ── Pratinjau PDF ────────────────────────────────────────── */}
      {pratinjau && (
        <div className="gr-modal" role="dialog" aria-modal="true" aria-label="Pratinjau GR" onClick={(e) => { if (e.target === e.currentTarget) setPratinjau(null); }} onKeyDown={(e) => { if (e.key === 'Escape') setPratinjau(null); }}>
          <div className="gr-modal-kotak">
            <div className="gr-modal-kepala">
              <div style={{ minWidth: 0 }}><b>{pratinjau.dok.nomor || 'Good Receipt'}</b><span title={pratinjau.dok.namaFile}>{pratinjau.dok.namaFile}</span></div>
              <button type="button" className="gr-tombol" onClick={() => void unduh(pratinjau.dok)}><Download size={15} /> Unduh</button>
              <button type="button" className="gr-ikon kotak" onClick={() => setPratinjau(null)} aria-label="Tutup" autoFocus><X size={17} /></button>
            </div>
            <iframe title="Pratinjau PDF" src={pratinjau.url} className="gr-frame" />
          </div>
        </div>
      )}

      {/* ── Ubah metadata ────────────────────────────────────────── */}
      {ubah && <FormUbah dok={ubah} onTutup={() => setUbah(null)} onSimpan={async (b) => {
        try { await api.patch(`/gr/${ubah.id}`, b); setUbah(null); toast('ok', 'Perubahan disimpan.'); await muat(true); }
        catch (e) { toast('bad', (e as Error).message); }
      }} />}

      <div className="gr-toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`gr-toast ${t.jenis}`}>{t.jenis === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}<span>{t.teks}</span></div>)}
      </div>
    </>
  );
}

function FormUbah({ dok, onTutup, onSimpan }: { dok: Dok; onTutup: () => void; onSimpan: (b: { entitas: Entitas; nomor: string; catatan: string }) => Promise<void> }) {
  const [entitas, setEntitas] = useState<Entitas>(dok.entitas);
  const [nomor, setNomor] = useState(dok.nomor);
  const [catatan, setCatatan] = useState(dok.catatan);
  const [simpan, setSimpan] = useState(false);
  return (
    <div className="gr-modal" role="dialog" aria-modal="true" aria-label="Ubah GR" onClick={(e) => { if (e.target === e.currentTarget) onTutup(); }} onKeyDown={(e) => { if (e.key === 'Escape') onTutup(); }}>
      <div className="gr-modal-kotak kecil">
        <div className="gr-modal-kepala"><div style={{ minWidth: 0 }}><b>Ubah data GR</b><span title={dok.namaFile}>{dok.namaFile}</span></div><button type="button" className="gr-ikon kotak" onClick={onTutup} aria-label="Tutup"><X size={17} /></button></div>
        <div className="gr-form">
          <label>Entitas<select className="gr-ctl" value={entitas} onChange={(e) => setEntitas(e.target.value as Entitas)}>{ENTITAS.map((e) => <option key={e} value={e}>{e === 'UMUM' ? 'Lainnya' : `${e} · ${NAMA_E[e]}`}</option>)}</select></label>
          <label>Nomor PO / GR<input className="gr-ctl" value={nomor} onChange={(e) => setNomor(e.target.value)} placeholder="mis. PO-RDA-2026-0781" maxLength={60} /></label>
          <label>Catatan<textarea className="gr-ctl" rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Opsional" maxLength={500} /></label>
          <p className="gr-bantu"><Copy size={12} /> Isi PDF tidak bisa diganti. Untuk mengganti berkas, hapus lalu unggah yang baru.</p>
          <div className="gr-form-aksi">
            <button type="button" className="btn-primary" disabled={simpan} onClick={async () => { setSimpan(true); await onSimpan({ entitas, nomor, catatan }); setSimpan(false); }}>{simpan ? 'Menyimpan…' : 'Simpan'}</button>
            <button type="button" className="gr-sec" onClick={onTutup}>Batal</button>
          </div>
        </div>
      </div>
    </div>
  );
}