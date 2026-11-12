// Form input PICA (isu baru / ubah isu) dan form catatan mingguan. Memakai gaya modal yang sama
// dengan form Pengguna & Site (formModal.css), jadi tampil dan berperilaku seperti form lain di portal.
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, ClipboardList, Save, Plus, Loader2, CalendarCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { PICA_STATUS, labelMinggu, nomorMingguDari, nomorDariLabel } from './picaTemplate';
import type { PicaItem } from './picaTemplate';
import './formModal.css';

const hariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Pesan galat dari server: tampilkan tiap masalah sebagai butir kalau ada banyak. */
function daftarGalat(err: unknown): string[] {
  const g = (err as { data?: { galat?: unknown } })?.data?.galat;
  if (Array.isArray(g) && g.length) return g.map(String);
  return [err instanceof Error ? err.message : 'Gagal menyimpan.'];
}

function useModalDasar(buka: boolean, tutup: () => void) {
  useEffect(() => {
    if (!buka) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') tutup(); };
    const sebelum = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = sebelum; };
  }, [buka, tutup]);
}

function KotakGalat({ galat }: { galat: string[] }) {
  if (!galat.length) return null;
  return (
    <div className="fm-error" role="alert">
      {galat.length === 1 ? galat[0] : <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>{galat.map((g, i) => <li key={i}>{g}</li>)}</ul>}
    </div>
  );
}

// ── Isu baru / ubah isu ───────────────────────────────────────────────────
interface FormProps {
  isOpen: boolean; item: PicaItem | null; site: string; labelSite: string; kategori: string[];
  onClose: () => void; onSaved: (item: PicaItem, pesan: string) => void;
}

export function PicaFormModal({ isOpen, item, site, labelSite, kategori, onClose, onSaved }: FormProps) {
  const [f, setF] = useState({ tanggal: '', problem: '', identifikasi: '', deskripsi: '', kategori: '', pic: '', targetDate: '', status: 'On Going' as string });
  const [galat, setGalat] = useState<string[]>([]);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setF(item
      ? { tanggal: item.tanggal?.slice(0, 10) ?? '', problem: item.problem, identifikasi: item.identifikasi, deskripsi: item.deskripsi,
          kategori: item.kategori ?? '', pic: item.pic, targetDate: item.targetDate?.slice(0, 10) ?? '', status: item.status || 'On Going' }
      : { tanggal: hariIni(), problem: '', identifikasi: '', deskripsi: '', kategori: '', pic: '', targetDate: '', status: 'On Going' });
    setGalat([]); setMenyimpan(false);
  }, [isOpen, item]);
  useModalDasar(isOpen, onClose);
  if (!isOpen) return null;

  const set = <K extends keyof typeof f>(k: K, v: string) => setF((x) => ({ ...x, [k]: v }));
  const judul = item ? `Ubah Isu No ${item.no}` : 'Tambah Isu PICA';

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    setGalat([]); setMenyimpan(true);
    try {
      const hasil = item
        ? await api.patch<PicaItem>(`/pica/items/${item.id}`, f)
        : await api.post<PicaItem>('/pica/items', { site, ...f });
      onSaved(hasil, item ? `Isu No ${hasil.no} diperbarui.` : `Isu No ${hasil.no} ditambahkan ke ${labelSite}.`);
    } catch (err) {
      setGalat(daftarGalat(err));
      setMenyimpan(false);
    }
  };

  return createPortal(
    <div className="fm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-panel fm-panel" role="dialog" aria-modal="true" aria-label={judul} style={{ maxWidth: 640 }}>
        <div className="fm-head">
          <div className="fm-head-ico"><ClipboardList size={22} color="#00D084" /></div>
          <div style={{ minWidth: 0 }}>
            <h3 className="fm-title">{judul}</h3>
            <div className="fm-sub">{labelSite} · catatan mingguan ditambahkan setelah isu tersimpan</div>
          </div>
          <button type="button" className="fm-close" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>

        <form className="fm-form" onSubmit={kirim}>
          <div className="fm-body">
            <KotakGalat galat={galat} />

            <div>
              <label className="fm-label" htmlFor="pica-problem">Problem <span style={{ color: '#F87171' }}>*</span></label>
              <input id="pica-problem" className="fm-input" value={f.problem} maxLength={500} autoFocus
                onChange={(e) => set('problem', e.target.value)} placeholder="Masalahnya dalam satu kalimat, mis. Vendor oli belum ada yang bersedia" />
            </div>

            <div className="fm-grid2">
              <div>
                <label className="fm-label" htmlFor="pica-tgl">Date <span style={{ color: '#F87171' }}>*</span></label>
                <input id="pica-tgl" type="date" className="fm-input" value={f.tanggal} onChange={(e) => set('tanggal', e.target.value)} />
              </div>
              <div>
                <label className="fm-label" htmlFor="pica-target">Target Date</label>
                <input id="pica-target" type="date" className="fm-input" value={f.targetDate} min={f.tanggal || undefined} onChange={(e) => set('targetDate', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="fm-label" htmlFor="pica-ident">Identification</label>
              <textarea id="pica-ident" className="fm-input" rows={2} value={f.identifikasi} style={{ resize: 'vertical' }}
                onChange={(e) => set('identifikasi', e.target.value)} placeholder="Penyebab atau hasil identifikasi masalah" />
            </div>

            <div>
              <label className="fm-label" htmlFor="pica-desc">Description (Corrective Action)</label>
              <textarea id="pica-desc" className="fm-input" rows={4} value={f.deskripsi} style={{ resize: 'vertical' }}
                onChange={(e) => set('deskripsi', e.target.value)} placeholder={'Tindakan korektif. Untuk beberapa langkah tulis bernomor:\n1. …\n2. …'} />
            </div>

            <div className="fm-grid2">
              <div>
                <label className="fm-label" htmlFor="pica-pic">PIC</label>
                <input id="pica-pic" className="fm-input" value={f.pic} maxLength={120} onChange={(e) => set('pic', e.target.value)} placeholder="Penanggung jawab" />
              </div>
              <div>
                <label className="fm-label" htmlFor="pica-kat">Kategori</label>
                <select id="pica-kat" className="fm-input" value={f.kategori} onChange={(e) => set('kategori', e.target.value)}>
                  <option value="">— Pilih —</option>
                  {kategori.map((k) => <option key={k} value={k}>{k}</option>)}
                  {/* Kategori lama yang sudah tidak ada di daftar tetap tampil supaya tidak hilang diam-diam saat disimpan ulang. */}
                  {f.kategori && !kategori.some((k) => k.toLowerCase() === f.kategori.toLowerCase()) && <option value={f.kategori}>{f.kategori}</option>}
                </select>
              </div>
            </div>

            <div>
              <label className="fm-label" htmlFor="pica-status">Status</label>
              <select id="pica-status" className="fm-input" value={f.status} onChange={(e) => set('status', e.target.value)}>
                {PICA_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="fm-foot">
            <button type="button" className="btn-chip" onClick={onClose}>Batal</button>
            <button type="submit" className="btn-primary" disabled={menyimpan}>
              {menyimpan ? <Loader2 size={16} className="fm-spin" /> : item ? <Save size={16} /> : <Plus size={16} />}
              {item ? 'Simpan Perubahan' : 'Simpan Isu'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

// ── Catatan mingguan ──────────────────────────────────────────────────────
interface MingguProps {
  isOpen: boolean; item: PicaItem | null; onClose: () => void; onSaved: (item: PicaItem, pesan: string) => void;
}

export function PicaMingguModal({ isOpen, item, onClose, onSaved }: MingguProps) {
  const [minggu, setMinggu] = useState(labelMinggu(nomorMingguDari()));
  const [catatan, setCatatan] = useState('');
  const [status, setStatus] = useState('On Going');
  const [galat, setGalat] = useState<string[]>([]);
  const [menyimpan, setMenyimpan] = useState(false);

  // Minggu berjalan, plus semua minggu yang sudah punya catatan (supaya bisa dikoreksi).
  const pilihan = useMemo(() => {
    const set = new Set<string>([labelMinggu(nomorMingguDari())]);
    for (const u of item?.updates ?? []) set.add(u.week);
    return [...set].sort((a, b) => nomorDariLabel(b) - nomorDariLabel(a));
  }, [item]);

  useEffect(() => {
    if (!isOpen || !item) return;
    const sekarang = labelMinggu(nomorMingguDari());
    setMinggu(sekarang);
    setCatatan(item.updates.find((u) => u.week === sekarang)?.catatan ?? '');
    setStatus(item.status || 'On Going');
    setGalat([]); setMenyimpan(false);
  }, [isOpen, item]);
  useModalDasar(isOpen, onClose);
  if (!isOpen || !item) return null;

  const ganti = (w: string) => { setMinggu(w); setCatatan(item.updates.find((u) => u.week === w)?.catatan ?? ''); };
  const adaCatatan = item.updates.some((u) => u.week === minggu);

  const kirim = async (e: FormEvent) => {
    e.preventDefault();
    setGalat([]); setMenyimpan(true);
    try {
      const hasil = await api.post<PicaItem>(`/pica/items/${item.id}/minggu`, { week: minggu, catatan, status });
      onSaved(hasil, catatan.trim() ? `Catatan ${minggu} untuk No ${hasil.no} tersimpan.` : `Catatan ${minggu} untuk No ${hasil.no} dihapus.`);
    } catch (err) {
      setGalat(daftarGalat(err));
      setMenyimpan(false);
    }
  };

  return createPortal(
    <div className="fm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-panel fm-panel fm-sm" role="dialog" aria-modal="true" aria-label="Update mingguan" style={{ maxWidth: 520 }}>
        <div className="fm-head">
          <div className="fm-head-ico"><CalendarCheck size={22} color="#00D084" /></div>
          <div style={{ minWidth: 0 }}>
            <h3 className="fm-title">Update Mingguan</h3>
            <div className="fm-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>No {item.no} · {item.problem}</div>
          </div>
          <button type="button" className="fm-close" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>

        <form className="fm-form" onSubmit={kirim}>
          <div className="fm-body">
            <KotakGalat galat={galat} />
            <div className="fm-grid2">
              <div>
                <label className="fm-label" htmlFor="pica-mg">Minggu</label>
                <select id="pica-mg" className="fm-input" value={minggu} onChange={(e) => ganti(e.target.value)}>
                  {pilihan.map((w) => <option key={w} value={w}>{w}{item.updates.some((u) => u.week === w) ? ' · sudah ada catatan' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="fm-label" htmlFor="pica-mg-status">Status</label>
                <select id="pica-mg-status" className="fm-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {PICA_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="fm-label" htmlFor="pica-mg-cat">Perkembangan minggu ini</label>
              <textarea id="pica-mg-cat" className="fm-input" rows={5} value={catatan} style={{ resize: 'vertical' }} autoFocus
                onChange={(e) => setCatatan(e.target.value)} placeholder="Apa yang sudah dikerjakan, hambatan, dan rencana berikutnya" />
              <p className="fm-hint">
                {adaCatatan ? `${minggu} sudah punya catatan — menyimpan akan menimpanya. Kosongkan kolom ini untuk menghapusnya.` : 'Catatan terbaru yang tampil di tabel adalah minggu dengan nomor terbesar yang terisi.'}
              </p>
            </div>
          </div>
          <div className="fm-foot">
            <button type="button" className="btn-chip" onClick={onClose}>Batal</button>
            <button type="submit" className="btn-primary" disabled={menyimpan}>
              {menyimpan ? <Loader2 size={16} className="fm-spin" /> : <Save size={16} />} Simpan Update
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}