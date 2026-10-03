// Daftar perubahan data Laporan Mingguan di menu notifikasi (bel), lengkap
// dengan nama PIC. Warna dari token --wr-* (lewat NADA) sehingga mengikuti tema;
// tiap jenis perubahan juga punya ikon + kata ("baru"/"diubah"/"dihapus"),
// jadi tidak bergantung pada warna saja.
import { useState } from 'react';
import { Plus, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { getSites } from '../../data/siteStore';
import { NADA } from './wrTema';
import type { Nada } from './wrTema';
import { AREA_LABEL, frasaPerubahan, waktuLalu, waktuMs } from './weeklyChanges';
import type { JenisPerubahan, PerubahanLaporan } from './weeklyChanges';

const NADA_JENIS: Record<JenisPerubahan, Nada> = { baru: NADA.in, ubah: NADA.info, hapus: NADA.neg };
const IKON_JENIS: Record<JenisPerubahan, React.ElementType> = { baru: Plus, ubah: Pencil, hapus: Trash2 };
const BATAS_AWAL = 8;

const labelSite = (key: string) =>
  key === 'global' ? 'Semua site' : getSites().find((s) => s.key === key)?.label ?? key.toUpperCase();

/** "auto-sync" atau nama dari email user yang menekan Sync/Import. */
const labelSumber = (sumber: string) =>
  !sumber ? '' : sumber === 'auto-sync' ? 'auto-sync' : `sync oleh ${sumber.split('@')[0]}`;

interface Props {
  items: PerubahanLaporan[];
  memuat: boolean;
  error: string | null;
  /** Waktu (ms) terakhir notifikasi dibaca SEBELUM panel dibuka — penanda "Baru". */
  bacaSebelumnya: number;
}

const teksPesan: React.CSSProperties = { fontSize: '.8rem', color: 'var(--wr-txt-muted)', padding: '.4rem .2rem', lineHeight: 1.5 };

export function NotifPerubahanLaporan({ items, memuat, error, bacaSebelumnya }: Props) {
  const [semua, setSemua] = useState(false);

  if (memuat && !items.length) return <div style={teksPesan}>Memuat perubahan…</div>;
  if (error && !items.length) {
    return <div role="alert" style={{ ...teksPesan, color: NADA.neg.teks }}>Gagal memuat perubahan: {error}</div>;
  }
  if (!items.length) {
    return (
      <div style={teksPesan}>
        Belum ada perubahan data. Notifikasi muncul di sini saat sinkronisasi sheet menemukan data baru, data yang
        berubah, atau data yang dihapus.
      </div>
    );
  }

  const tampil = semua ? items : items.slice(0, BATAS_AWAL);
  return (
    <>
      {tampil.map((c) => {
        const n = NADA_JENIS[c.kind];
        const Ikon = IKON_JENIS[c.kind];
        const baru = waktuMs(c.createdAt) > bacaSebelumnya;
        const sumber = labelSumber(c.sumber);
        return (
          <div key={c.id} className={`notif-item${baru ? ' is-new' : ''}`}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: n.bg, color: n.teks, border: `1px solid ${n.garis}`,
            }}>
              <Ikon size={16} aria-hidden="true" />
            </div>
            {/* paddingRight: sisakan ruang untuk titik penanda is-new (index.css) di kanan atas */}
            <div style={{ minWidth: 0, flex: 1, paddingRight: baru ? '.9rem' : 0 }}>
              <div style={{ fontSize: '.83rem', lineHeight: 1.4, color: 'var(--txt-primary)' }}>
                <span style={{ color: 'var(--wr-txt-muted)', fontWeight: 600 }}>PIC </span>
                <strong>{c.pic || 'belum diisi'}</strong>
                <span style={{ color: 'var(--txt-secondary)' }}> · {frasaPerubahan(c)}</span>
              </div>

              {c.detail.slice(0, 2).map((d, i) => (
                <div key={i} style={{ fontSize: '.74rem', lineHeight: 1.4, color: 'var(--txt-secondary)', marginTop: '.15rem', overflowWrap: 'anywhere' }}>
                  {d.nama}{d.ket ? <span style={{ color: 'var(--wr-txt-muted)' }}> ({d.ket})</span> : null}
                  {d.perubahan?.slice(0, 2).map((p, j) => (
                    <div key={j} style={{ color: 'var(--wr-txt-muted)' }}>{p.kolom}: {p.dari} → {p.ke}</div>
                  ))}
                </div>
              ))}
              {c.jumlah > 2 && (
                <div style={{ fontSize: '.72rem', color: 'var(--wr-txt-muted)', marginTop: '.1rem' }}>
                  +{(c.jumlah - 2).toLocaleString('id-ID')} lainnya
                </div>
              )}

              <div style={{ fontSize: '.72rem', color: 'var(--wr-txt-muted)', marginTop: '.25rem', display: 'flex', flexWrap: 'wrap', gap: '.25rem .45rem', alignItems: 'center' }}>
                <span>{AREA_LABEL[c.area]} · {labelSite(c.site)} · {waktuLalu(c.createdAt)}{sumber ? ` · ${sumber}` : ''}</span>
                {baru && (
                  <span style={{ fontWeight: 700, fontSize: '.64rem', padding: '.05rem .4rem', borderRadius: 999, color: NADA.in.teks, background: NADA.in.bg, border: `1px solid ${NADA.in.garis}` }}>
                    Baru
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {items.length > BATAS_AWAL && (
        <button type="button" className="btn-chip" onClick={() => setSemua((v) => !v)} aria-expanded={semua}
          style={{ width: '100%', justifyContent: 'center', marginTop: '.25rem' }}>
          {semua ? 'Tampilkan lebih sedikit' : `Lihat ${items.length - BATAS_AWAL} perubahan lainnya`}
          <ChevronDown size={13} aria-hidden="true" style={{ transform: semua ? 'rotate(180deg)' : 'none' }} />
        </button>
      )}
    </>
  );
}