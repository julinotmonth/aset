// Import isu PICA dari template Excel. Dua langkah: file dibaca dan DIPERIKSA dulu oleh server (simulasi,
// tidak menulis apa pun), hasilnya ditampilkan, baru diterapkan setelah pengguna menekan "Terapkan".
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FileUp, Loader2, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { bacaExcelPica, GalatTemplatePica } from './picaTemplate';
import type { BarisPica } from './picaTemplate';
import { NADA } from './wrTema';
import './formModal.css';

interface BarisHasil { baris: number; no: string; aksi: 'baru' | 'ubah' | 'sama' | 'ditolak'; pesan?: string }
interface HasilImport { simulasi: boolean; baru: number; ubah: number; sama: number; ditolak: number; baris: BarisHasil[] }

interface Props { isOpen: boolean; site: string; labelSite: string; onClose: () => void; onDone: (pesan: string) => void }

export function PicaImportModal({ isOpen, site, labelSite, onClose, onDone }: Props) {
  const [namaFile, setNamaFile] = useState('');
  const [rows, setRows] = useState<BarisPica[] | null>(null);
  const [hasil, setHasil] = useState<HasilImport | null>(null);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState<'' | 'memeriksa' | 'menerapkan'>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const ulang = useCallback(() => { setNamaFile(''); setRows(null); setHasil(null); setGalat(''); setSibuk(''); }, []);
  useEffect(() => { if (isOpen) ulang(); }, [isOpen, ulang]);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sibuk) onClose(); };
    const sebelum = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = sebelum; };
  }, [isOpen, onClose, sibuk]);
  if (!isOpen) return null;

  const pilihFile = async (file: File | undefined) => {
    if (!file) return;
    ulang();
    setNamaFile(file.name);
    if (!/\.xlsx$/i.test(file.name)) { setGalat('Gunakan file Excel berformat .xlsx (hasil tombol Template atau Export).'); return; }
    setSibuk('memeriksa');
    try {
      const baris = await bacaExcelPica(await file.arrayBuffer());
      if (!baris.length) throw new GalatTemplatePica('Tidak ada baris isu di file ini. Isi minimal kolom DATE dan PROBLEM, lalu coba lagi.');
      setRows(baris);
      setHasil(await api.post<HasilImport>('/pica/import', { site, rows: baris, simulasi: true }, { timeoutMs: 120_000 }));
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'File tidak bisa diperiksa.');
    } finally {
      setSibuk('');
    }
  };

  const terapkan = async () => {
    if (!rows) return;
    setSibuk('menerapkan'); setGalat('');
    try {
      const h = await api.post<HasilImport>('/pica/import', { site, rows }, { timeoutMs: 120_000 });
      const bagian = [h.baru && `${h.baru} isu baru`, h.ubah && `${h.ubah} diperbarui`, h.sama && `${h.sama} tidak berubah`, h.ditolak && `${h.ditolak} ditolak`].filter(Boolean).join(', ');
      onDone(`Import ke ${labelSite} selesai — ${bagian}.`);
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Import gagal.');
      setSibuk('');
    }
  };

  const ditolak = hasil?.baris.filter((b) => b.aksi === 'ditolak') ?? [];
  const bisaTerapkan = !!hasil && hasil.baru + hasil.ubah > 0 && !sibuk;
  const Kartu = ({ label, nilai, nada }: { label: string; nilai: number; nada: typeof NADA.in }) => (
    <div style={{ flex: '1 1 110px', padding: '.7rem .85rem', borderRadius: 12, background: nada.bg, border: `1px solid ${nada.garis}` }}>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: nada.teks, lineHeight: 1.1 }}>{nilai}</div>
      <div style={{ fontSize: '.72rem', color: 'var(--txt-secondary)', marginTop: '.15rem' }}>{label}</div>
    </div>
  );

  return createPortal(
    <div className="fm-overlay" onClick={(e) => { if (e.target === e.currentTarget && !sibuk) onClose(); }}>
      <div className="glass-panel fm-panel" role="dialog" aria-modal="true" aria-label="Import PICA" style={{ maxWidth: 640 }}>
        <div className="fm-head">
          <div className="fm-head-ico"><FileUp size={22} color="#00D084" /></div>
          <div style={{ minWidth: 0 }}>
            <h3 className="fm-title">Import PICA dari Excel</h3>
            <div className="fm-sub">{labelSite} · file diperiksa dulu, baru diterapkan setelah Anda setuju</div>
          </div>
          <button type="button" className="fm-close" onClick={onClose} aria-label="Tutup" disabled={!!sibuk}><X size={18} /></button>
        </div>

        <div className="fm-body">
          <input ref={inputRef} type="file" accept=".xlsx" style={{ display: 'none' }}
            onChange={(e) => { void pilihFile(e.target.files?.[0]); e.target.value = ''; }} />

          {!hasil && (
            <button type="button" className="btn-chip" disabled={!!sibuk} onClick={() => inputRef.current?.click()}
              style={{ padding: '1.6rem 1rem', width: '100%', justifyContent: 'center', borderStyle: 'dashed', flexDirection: 'column', gap: '.4rem', height: 'auto' }}>
              {sibuk === 'memeriksa' ? <Loader2 size={22} className="fm-spin" /> : <FileSpreadsheet size={22} />}
              <span style={{ fontWeight: 700 }}>{sibuk === 'memeriksa' ? `Memeriksa ${namaFile}…` : 'Pilih file Excel (.xlsx)'}</span>
              <span style={{ fontSize: '.74rem', fontWeight: 400, color: 'var(--txt-muted)' }}>Gunakan file dari tombol “Template” atau “Export”</span>
            </button>
          )}

          {galat && <div className="fm-error" role="alert" style={{ whiteSpace: 'pre-wrap' }}>{galat}</div>}

          {hasil && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.82rem', color: 'var(--txt-secondary)' }}>
                <FileSpreadsheet size={16} /> <strong style={{ color: 'var(--txt-primary)' }}>{namaFile}</strong> · {rows?.length} baris terbaca
                <button type="button" className="btn-chip" onClick={() => { ulang(); inputRef.current?.click(); }} style={{ marginLeft: 'auto' }} disabled={!!sibuk}>Ganti file</button>
              </div>
              <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
                <Kartu label="Isu baru" nilai={hasil.baru} nada={NADA.in} />
                <Kartu label="Diperbarui" nilai={hasil.ubah} nada={NADA.info} />
                <Kartu label="Tidak berubah" nilai={hasil.sama} nada={NADA.neutral} />
                <Kartu label="Ditolak" nilai={hasil.ditolak} nada={ditolak.length ? NADA.neg : NADA.neutral} />
              </div>

              {ditolak.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.8rem', fontWeight: 700, color: NADA.neg.teks, marginBottom: '.4rem' }}>
                    <AlertTriangle size={15} /> Baris yang ditolak — perbaiki di Excel lalu import ulang (baris lain tetap diproses)
                  </div>
                  <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                      <tbody>
                        {ditolak.map((b) => (
                          <tr key={b.baris} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '.45rem .6rem', whiteSpace: 'nowrap', color: 'var(--txt-muted)', verticalAlign: 'top' }}>Baris {b.baris}</td>
                            <td style={{ padding: '.45rem .6rem' }}>{b.pesan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!ditolak.length && hasil.baru + hasil.ubah > 0 && (
                <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center', fontSize: '.8rem', color: NADA.in.teks }}>
                  <CheckCircle2 size={15} /> Semua baris valid.
                </div>
              )}
              {hasil.baru + hasil.ubah === 0 && (
                <div style={{ fontSize: '.8rem', color: 'var(--txt-muted)' }}>Tidak ada yang perlu ditambahkan atau diperbarui dari file ini.</div>
              )}
            </>
          )}
        </div>

        <div className="fm-foot">
          <button type="button" className="btn-chip" onClick={onClose} disabled={!!sibuk}>Tutup</button>
          <button type="button" className="btn-primary" onClick={terapkan} disabled={!bisaTerapkan}>
            {sibuk === 'menerapkan' ? <Loader2 size={16} className="fm-spin" /> : <FileUp size={16} />}
            Terapkan Import{hasil ? ` (${hasil.baru + hasil.ubah})` : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}