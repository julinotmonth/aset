// Kelola kategori PICA — khusus Super Admin. Tambah, ubah nama, atur urutan, dan hapus kategori.
// Berlaku untuk semua site: kategori dipakai di form isu, dropdown template Excel, dan penyaring tabel.
// Server juga menolak perubahan dari akun non-Super Admin, jadi pembatasan tidak hanya di tampilan.
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Tags, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Check, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { NADA } from './wrTema';
import './formModal.css';

export interface KategoriPica { id: string; nama: string; urutan: number; dipakai: number }

interface Props { isOpen: boolean; onClose: () => void; onBerubah: () => void }

export function KelolaKategoriPica({ isOpen, onClose, onBerubah }: Props) {
  const [daftar, setDaftar] = useState<KategoriPica[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');
  const [baru, setBaru] = useState('');
  const [ubahId, setUbahId] = useState<string | null>(null);
  const [ubahNama, setUbahNama] = useState('');
  const [hapusId, setHapusId] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try { setDaftar(await api.get<KategoriPica[]>('/pica/kategori')); }
    catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal memuat kategori.'); }
    finally { setMemuat(false); }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setGalat(''); setBaru(''); setUbahId(null); setHapusId(null);
    void muat();
  }, [isOpen, muat]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sibuk) onClose(); };
    const sebelum = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = sebelum; };
  }, [isOpen, onClose, sibuk]);
  if (!isOpen) return null;

  /** Jalankan satu aksi ke server; hasilnya (daftar terbaru) langsung dipakai, lalu halaman PICA diberi tahu. */
  const jalankan = async (aksi: () => Promise<KategoriPica[] | void>) => {
    setSibuk(true); setGalat('');
    try {
      const hasil = await aksi();
      if (hasil) setDaftar(hasil);
      onBerubah();
      return true;
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan perubahan.');
      return false;
    } finally { setSibuk(false); }
  };

  const tambah = async (e: FormEvent) => {
    e.preventDefault();
    if (!baru.trim()) return;
    if (await jalankan(() => api.post<KategoriPica[]>('/pica/kategori', { nama: baru }))) setBaru('');
  };
  const simpanNama = async (k: KategoriPica) => {
    if (ubahNama.trim() === k.nama) { setUbahId(null); return; }
    if (await jalankan(() => api.patch<KategoriPica[]>(`/pica/kategori/${k.id}`, { nama: ubahNama }))) setUbahId(null);
  };
  const geser = (i: number, arah: -1 | 1) => {
    const j = i + arah;
    if (j < 0 || j >= daftar.length) return;
    const urut = daftar.slice();
    [urut[i], urut[j]] = [urut[j], urut[i]];
    void jalankan(() => api.post<KategoriPica[]>('/pica/kategori/urutan', { ids: urut.map((k) => k.id) }));
  };
  const hapus = async (k: KategoriPica) => {
    const ok = await jalankan(async () => {
      const r = await api.delete<{ kategori: KategoriPica[] }>(`/pica/kategori/${k.id}`);
      return r?.kategori;
    });
    if (ok) setHapusId(null);
  };

  const ikon = { width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, borderRadius: 8 } as const;

  return createPortal(
    <div className="fm-overlay" onClick={(e) => { if (e.target === e.currentTarget && !sibuk) onClose(); }}>
      <div className="glass-panel fm-panel" role="dialog" aria-modal="true" aria-label="Kelola kategori PICA" style={{ maxWidth: 560 }}>
        <div className="fm-head">
          <div className="fm-head-ico"><Tags size={22} color="#00D084" /></div>
          <div style={{ minWidth: 0 }}>
            <h3 className="fm-title">Kelola Kategori PICA</h3>
            <div className="fm-sub">Khusus Super Admin · berlaku untuk semua site</div>
          </div>
          <button type="button" className="fm-close" onClick={onClose} aria-label="Tutup" disabled={sibuk}><X size={18} /></button>
        </div>

        <div className="fm-body">
          {galat && <div className="fm-error" role="alert">{galat}</div>}

          <form onSubmit={tambah} style={{ display: 'flex', gap: '.5rem' }}>
            <input className="fm-input" value={baru} maxLength={40} onChange={(e) => setBaru(e.target.value)}
              placeholder="Nama kategori baru" aria-label="Nama kategori baru" style={{ flex: 1 }} />
            <button type="submit" className="btn-primary" disabled={sibuk || !baru.trim()}>
              {sibuk ? <Loader2 size={16} className="fm-spin" /> : <Plus size={16} />} Tambah
            </button>
          </form>

          <div>
            <div className="fm-label" style={{ marginBottom: '.4rem' }}>Urutan ini dipakai di dropdown dan saat tabel diurutkan menurut kategori</div>
            {memuat && !daftar.length && <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--txt-muted)', fontSize: '.82rem' }}>Memuat…</div>}
            {!memuat && !daftar.length && (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--txt-muted)', fontSize: '.82rem' }}>
                Belum ada kategori. Tambahkan yang pertama di atas — sampai itu, isu dicatat tanpa kategori.
              </div>
            )}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: daftar.length ? '1px solid var(--border-subtle)' : 'none', borderRadius: 12, overflow: 'hidden' }}>
              {daftar.map((k, i) => (
                <li key={k.id} style={{ borderTop: i ? '1px solid var(--border-subtle)' : 'none', padding: '.5rem .6rem' }}>
                  {hapusId === k.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                      <span style={{ flex: 1, minWidth: 200, fontSize: '.8rem', color: NADA.neg.teks }}>
                        Hapus “{k.nama}”?{k.dipakai > 0 ? ` ${k.dipakai} isu yang memakainya tidak ikut terhapus — kategorinya dikosongkan.` : ''}
                      </span>
                      <button type="button" className="btn-chip" onClick={() => void hapus(k)} disabled={sibuk} style={{ color: NADA.neg.teks }}>Ya, hapus</button>
                      <button type="button" className="btn-chip" onClick={() => setHapusId(null)} disabled={sibuk}>Batal</button>
                    </div>
                  ) : ubahId === k.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); void simpanNama(k); }} style={{ display: 'flex', gap: '.4rem' }}>
                      <input className="fm-input" value={ubahNama} maxLength={40} autoFocus onChange={(e) => setUbahNama(e.target.value)} aria-label={`Nama baru untuk ${k.nama}`} style={{ flex: 1, minHeight: 34, padding: '.35rem .6rem' }} />
                      <button type="submit" className="btn-chip" style={ikon} disabled={sibuk || !ubahNama.trim()} aria-label="Simpan nama"><Check size={15} /></button>
                      <button type="button" className="btn-chip" style={ikon} onClick={() => setUbahId(null)} disabled={sibuk} aria-label="Batal ubah"><X size={15} /></button>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                      <div style={{ display: 'grid' }}>
                        <button type="button" className="btn-chip" style={{ ...ikon, height: 18, width: 28, border: 'none', background: 'transparent' }} disabled={sibuk || i === 0} onClick={() => geser(i, -1)} aria-label={`Naikkan ${k.nama}`}><ChevronUp size={14} /></button>
                        <button type="button" className="btn-chip" style={{ ...ikon, height: 18, width: 28, border: 'none', background: 'transparent' }} disabled={sibuk || i === daftar.length - 1} onClick={() => geser(i, 1)} aria-label={`Turunkan ${k.nama}`}><ChevronDown size={14} /></button>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--txt-primary)' }}>{k.nama}</div>
                        <div style={{ fontSize: '.72rem', color: 'var(--txt-muted)' }}>{k.dipakai ? `dipakai ${k.dipakai} isu` : 'belum dipakai'}</div>
                      </div>
                      <button type="button" className="btn-chip" style={ikon} disabled={sibuk} onClick={() => { setUbahId(k.id); setUbahNama(k.nama); setHapusId(null); }} aria-label={`Ubah nama ${k.nama}`}><Pencil size={14} /></button>
                      <button type="button" className="btn-chip" style={ikon} disabled={sibuk} onClick={() => { setHapusId(k.id); setUbahId(null); }} aria-label={`Hapus ${k.nama}`}><Trash2 size={14} /></button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="fm-foot">
          <button type="button" className="btn-primary" onClick={onClose} disabled={sibuk}>Selesai</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}