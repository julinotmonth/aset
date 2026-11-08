// Panduan interaktif "Sambungkan Google Sheet": langkah demi langkah + uji koneksi langsung ke server
// (GET /weekly-reports/input/diagnosa). Setiap tahap diperiksa nyata — bukan sekadar daftar centang —
// sehingga pengguna tahu persis tahap mana yang masih kurang dan apa pesan galat dari Google.
import { useCallback, useEffect, useState } from 'react';
import { X, CheckCircle2, XCircle, Circle, Loader2, RefreshCw, Copy, ExternalLink, Send, ChevronDown, BookOpen } from 'lucide-react';
import { api } from '../../lib/api';
import './formModal.css';
import './inputTransaksi.css';
import './sambungSheet.css';

interface Diagnosa {
  kredensial: { ok: boolean; email: string | null; error: string };
  token: { ok: boolean; error: string };
  sheet: { ok: boolean; error: string; judul: string; status: number };
  tabs: { nama: string; ada: boolean }[];
  tulis: { ok: boolean; error: string };
  sheetDiatur: boolean; tertunda: number; linkSheet: string | null;
}
interface Props { buka: boolean; site: string; siteLabel: string; onTutup: () => void; onSelesai?: () => void }

type Os = 'win' | 'mac';
const CMD: Record<Os, string> = {
  win: '[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\\Downloads\\kunci.json")) | Set-Clipboard',
  mac: 'base64 -i ~/Downloads/kunci.json | tr -d "\\n" | pbcopy   # Linux: base64 -w0 kunci.json',
};

export function SambungSheetPanduan({ buka, site, siteLabel, onTutup, onSelesai }: Props) {
  const [d, setD] = useState<Diagnosa | null>(null);
  const [memeriksa, setMemeriksa] = useState(false);
  const [galat, setGalat] = useState('');
  const [terbuka, setTerbuka] = useState<number>(1);
  const [os, setOs] = useState<Os>('win');
  const [tersalin, setTersalin] = useState('');
  const [mengirim, setMengirim] = useState(false);
  const [hasilKirim, setHasilKirim] = useState('');

  const periksa = useCallback(async () => {
    setMemeriksa(true); setGalat('');
    try { setD(await api.get<Diagnosa>(`/weekly-reports/input/diagnosa?site=${encodeURIComponent(site)}`, { timeoutMs: 60_000 })); }
    catch (e) { setGalat((e as Error).message); }
    finally { setMemeriksa(false); }
  }, [site]);

  useEffect(() => { if (buka) { setD(null); setHasilKirim(''); void periksa(); } }, [buka, periksa]);

  // Langkah pertama yang belum lolos dibuka otomatis setiap hasil pemeriksaan tiba.
  const lolos = d ? [d.kredensial.ok && d.token.ok, d.kredensial.ok && d.token.ok, d.kredensial.ok && d.token.ok, d.kredensial.ok && d.token.ok, d.sheet.ok && d.tulis.ok, d.sheet.ok && d.tabs.length > 0 && d.tabs.every((t) => t.ada), d.tertunda === 0 && d.tulis.ok] : [];
  useEffect(() => {
    if (!d) return;
    // langkah 1-3 (Google Cloud) tak bisa dideteksi terpisah: dianggap selesai bila server sudah punya kunci valid.
    const i = lolos.findIndex((x, k) => !x && (k >= 3 || !d.kredensial.ok));
    setTerbuka(i < 0 ? 7 : i + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  if (!buka) return null;
  const email = d?.kredensial.email ?? null;
  const salin = async (teks: string, kunci: string) => { try { await navigator.clipboard.writeText(teks); setTersalin(kunci); setTimeout(() => setTersalin(''), 1600); } catch { /* clipboard tidak tersedia */ } };

  const kirim = async () => {
    setMengirim(true); setHasilKirim('');
    try {
      const r = await api.post<{ total: number; terkirim: number; gagal: number; pesanGagal: string }>('/weekly-reports/input/kirim-tertunda', { site }, { timeoutMs: 180_000, ulang: false });
      setHasilKirim(r.gagal ? `${r.terkirim} terkirim, ${r.gagal} gagal: ${r.pesanGagal}` : `${r.terkirim} data terkirim ke Google Sheet.`);
      onSelesai?.(); await periksa();
    } catch (e) { setHasilKirim((e as Error).message); }
    finally { setMengirim(false); }
  };

  const Ikon = ({ s }: { s: 'ok' | 'bad' | 'tunggu' }) => s === 'ok' ? <CheckCircle2 size={16} className="pd-ok" /> : s === 'bad' ? <XCircle size={16} className="pd-bad" /> : <Circle size={16} className="pd-tunggu" />;
  const st = (ok: boolean | undefined, dicoba: boolean): 'ok' | 'bad' | 'tunggu' => (!d || !dicoba ? 'tunggu' : ok ? 'ok' : 'bad');

  const Kode = ({ teks, kunci }: { teks: string; kunci: string }) => (
    <div className="pd-kode"><code>{teks}</code><button type="button" className="im-chip" onClick={() => void salin(teks, kunci)}>{tersalin === kunci ? 'Tersalin ✓' : <><Copy size={11} style={{ verticalAlign: '-1px' }} /> Salin</>}</button></div>
  );

  const langkah: { judul: string; ok: boolean; isi: React.ReactNode }[] = [
    { judul: 'Buat proyek & akun layanan di Google Cloud', ok: lolos[0], isi: (
      <ol>
        <li>Buka <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">console.cloud.google.com <ExternalLink size={11} /></a> dan masuk dengan akun Google perusahaan. Buat proyek baru (mis. <b>reethau-inventory</b>) atau pakai yang sudah ada.</li>
        <li>Menu <b>IAM &amp; Admin → Service Accounts → Create service account</b>. Nama bebas (mis. <b>sheets-writer</b>), klik <b>Create and continue</b>. Tidak perlu memilih role — langsung <b>Done</b>.</li>
        <li>Catat <b>email</b> akun layanan (berakhiran <code>.iam.gserviceaccount.com</code>) — dipakai di langkah 5.</li>
      </ol>) },
    { judul: 'Aktifkan Google Sheets API', ok: lolos[1], isi: (
      <ol>
        <li>Di proyek yang sama: <b>APIs &amp; Services → Library</b>, cari <b>Google Sheets API</b>, klik <b>Enable</b>.</li>
        <li>Pintasan: <a href="https://console.cloud.google.com/apis/library/sheets.googleapis.com" target="_blank" rel="noreferrer">buka halaman Sheets API <ExternalLink size={11} /></a>.</li>
      </ol>) },
    { judul: 'Unduh kunci JSON lalu ubah ke Base64', ok: lolos[2], isi: (
      <>
        <ol>
          <li>Klik akun layanan tadi → tab <b>Keys → Add key → Create new key → JSON → Create</b>. File <code>.json</code> terunduh. <b>Rahasiakan</b>: jangan diunggah ke GitHub atau dikirim lewat chat.</li>
          <li>Ubah isinya ke Base64 (hasil langsung masuk clipboard). Ganti nama/lokasi file bila berbeda:</li>
        </ol>
        <div className="im-chips" role="group" aria-label="Sistem operasi">
          <button type="button" className="im-chip" aria-pressed={os === 'win'} onClick={() => setOs('win')}>Windows (PowerShell)</button>
          <button type="button" className="im-chip" aria-pressed={os === 'mac'} onClick={() => setOs('mac')}>macOS / Linux</button>
        </div>
        <Kode teks={CMD[os]} kunci="cmd" />
      </>) },
    { judul: 'Isi variabel GOOGLE_SERVICE_ACCOUNT_B64 di hosting backend', ok: lolos[3], isi: (
      <>
        <ol>
          <li>Buka dashboard hosting <b>backend</b> (tempat server Node.js berjalan) → <b>Environment / Variables</b>.</li>
          <li>Tambah variabel dengan nama persis:</li>
        </ol>
        <Kode teks="GOOGLE_SERVICE_ACCOUNT_B64" kunci="var" />
        <ol start={3}>
          <li>Tempel hasil Base64 tadi sebagai nilainya (satu baris panjang, tanpa spasi/enter), simpan.</li>
          <li><b>Deploy ulang / restart</b> backend, tunggu ±30 detik, lalu klik <b>Periksa koneksi</b> di atas.</li>
        </ol>
        {d && !d.kredensial.ok && <p className="pd-catatan bad">{d.kredensial.error}</p>}
        {d && d.kredensial.ok && !d.token.ok && <p className="pd-catatan bad">{d.token.error}</p>}
        {d?.kredensial.ok && d.token.ok && <p className="pd-catatan ok">Server mengenali akun layanan <b>{email}</b> dan Google menerima kuncinya.</p>}
      </>) },
    { judul: 'Bagikan Google Sheet sebagai Editor', ok: lolos[4], isi: (
      <>
        <ol>
          <li>Buka spreadsheet {siteLabel}{d?.linkSheet && <> (<a href={d.linkSheet} target="_blank" rel="noreferrer">buka <ExternalLink size={11} /></a>)</>} → tombol <b>Share</b>.</li>
          <li>Tambahkan email akun layanan berikut dengan peran <b>Editor</b> (hilangkan centang “Notify people”):</li>
        </ol>
        {email ? <Kode teks={email} kunci="email" /> : <p className="pd-catatan warn">Email akan tampil di sini setelah langkah 4 selesai.</p>}
        <p className="pd-catatan warn">File harus berformat <b>Google Sheets</b> asli. Bila di Drive berlabel “.xlsx”, buka lalu pilih <b>File → Save as Google Sheets</b> dan atur ulang Sumber Sheet dengan link baru.</p>
        {d?.kredensial.ok && d.token.ok && !d.sheet.ok && <p className="pd-catatan bad">{d.sheet.error}</p>}
        {d?.sheet.ok && !d.tulis.ok && <p className="pd-catatan bad">{d.tulis.error}</p>}
        {d?.sheet.ok && d.tulis.ok && <p className="pd-catatan ok">Terhubung ke “{d.sheet.judul}” dan punya izin Editor.</p>}
      </>) },
    { judul: 'Pastikan Sumber Sheet & nama tab sesuai', ok: lolos[5], isi: (
      <>
        <ol>
          <li>Di halaman Laporan klik <b>Sumber Sheet</b>, tempel link spreadsheet, pilih tab Barang Masuk/Keluar, simpan.</li>
          <li>Klik <b>Sync Sekarang</b> sekali agar kolom form mengikuti template sheet.</li>
        </ol>
        {d && !d.sheetDiatur && <p className="pd-catatan bad">Sumber Sheet untuk {siteLabel} belum diatur.</p>}
        {d && d.tabs.length > 0 && (
          <ul className="pd-tabs">{d.tabs.map((t) => <li key={t.nama}><Ikon s={t.ada ? 'ok' : 'bad'} /> {t.nama}{!t.ada && <span> — tidak ada di spreadsheet (periksa ejaan)</span>}</li>)}</ul>
        )}
      </>) },
    { judul: 'Kirim data yang tertunda', ok: lolos[6], isi: (
      <>
        <p>Data yang sudah dicatat sebelum koneksi aktif tersimpan di aplikasi dan akan dikirim otomatis tiap sinkron (5 menit). Bisa juga dikirim sekarang:</p>
        <div className="pd-aksi">
          <button type="button" className="btn-primary" disabled={mengirim || !d?.tulis.ok || !d.tertunda} onClick={() => void kirim()}>
            {mengirim ? <><Loader2 size={15} className="im-putar" /> Mengirim…</> : <><Send size={15} /> Kirim {d?.tertunda ?? 0} data sekarang</>}
          </button>
          {hasilKirim && <span className="pd-catatan ok" style={{ margin: 0 }}>{hasilKirim}</span>}
        </div>
        {d && d.tertunda === 0 && <p className="pd-catatan ok">Tidak ada data yang menunggu.</p>}
      </>) },
  ];

  const semuaOk = !!d && lolos.every(Boolean);

  return (
    <div className="im-overlay pd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onTutup(); }}>
      <div className="im-panel" role="dialog" aria-modal="true" aria-label="Sambungkan Google Sheet" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onTutup(); } }}>
        <div className="im-head">
          <div className="im-head-ico"><BookOpen size={22} /></div>
          <div style={{ minWidth: 0 }}>
            <h3 className="im-title">Sambungkan Google Sheet</h3>
            <div className="im-sub">{siteLabel} · sekali setup, sesudahnya semua input/ubah/hapus otomatis masuk ke sheet</div>
          </div>
          <button type="button" className="fm-close" onClick={onTutup} aria-label="Tutup"><X size={18} /></button>
        </div>

        <div className="im-body">
          <div className={`im-status ${semuaOk ? 'ok' : 'warn'}`}>
            {memeriksa ? <Loader2 size={16} className="im-putar" /> : semuaOk ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <div style={{ flex: 1 }}>
              <b>{memeriksa ? 'Memeriksa koneksi…' : semuaOk ? 'Semua tersambung 🎉' : 'Belum tersambung penuh'}</b>
              <div className="pd-cek">
                <span><Ikon s={st(d?.kredensial.ok && d.token.ok, !!d)} /> Akun layanan di server</span>
                <span><Ikon s={st(d?.sheet.ok, !!d?.kredensial.ok && !!d.token.ok)} /> Sheet terbaca</span>
                <span><Ikon s={st(d?.tulis.ok, !!d?.sheet.ok)} /> Izin Editor</span>
                <span><Ikon s={st(d ? d.tabs.length > 0 && d.tabs.every((t) => t.ada) : false, !!d?.sheet.ok)} /> Tab ditemukan</span>
              </div>
            </div>
            <button type="button" className="im-btn-sec" onClick={() => void periksa()} disabled={memeriksa}><RefreshCw size={14} className={memeriksa ? 'im-putar' : undefined} /> Periksa koneksi</button>
          </div>
          {galat && <div className="fm-error" role="alert">{galat}</div>}

          <ol className="pd-langkah">
            {langkah.map((l, i) => (
              <li key={l.judul} className={`${terbuka === i + 1 ? 'buka' : ''}${d ? (l.ok ? ' selesai' : '') : ''}`}>
                <button type="button" className="pd-kepala" aria-expanded={terbuka === i + 1} onClick={() => setTerbuka(terbuka === i + 1 ? 0 : i + 1)}>
                  <span className="pd-no">{d && l.ok ? <CheckCircle2 size={16} /> : i + 1}</span>
                  <span className="pd-judul">{l.judul}</span>
                  <ChevronDown size={16} className="pd-panah" />
                </button>
                {terbuka === i + 1 && <div className="pd-isi">{l.isi}</div>}
              </li>
            ))}
          </ol>
          <p className="pd-catatan">Keamanan: kunci JSON setara password. Simpan hanya di variabel environment hosting; bila bocor, hapus kuncinya di Google Cloud dan buat yang baru.</p>
        </div>
      </div>
    </div>
  );
}