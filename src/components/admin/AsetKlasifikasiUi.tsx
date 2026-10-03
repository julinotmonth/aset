// Komponen tampilan untuk klasifikasi aset (lihat asetKlasifikasi.ts).
// Semua warna dari token --wr-* (lewat NADA), jadi otomatis mengikuti tema.
import { NADA } from './wrTema';
import type { KelasAset, RingkasKelas } from './asetKlasifikasi';
import { NADA_KELAS, IKON_KELAS, ikonSub } from './asetKlasifikasiTema';

/** Label kecil "Building › Electrical" untuk sel tabel. */
export function BadgeKategori({ kelas, sub }: { kelas: KelasAset; sub: string }) {
  const n = NADA_KELAS[kelas];
  const Ikon = IKON_KELAS[kelas];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '.3rem', padding: '.12rem .5rem', borderRadius: 999,
      fontSize: '.68rem', fontWeight: 700, whiteSpace: 'nowrap', color: n.teks, background: n.bg, border: `1px solid ${n.garis}`,
    }}>
      <Ikon size={11} aria-hidden="true" />
      {kelas === 'Belum Terklasifikasi' ? 'Belum terklasifikasi' : kelas}
      <span style={{ fontWeight: 500, color: 'var(--txt-secondary)' }}>› {sub}</span>
    </span>
  );
}

interface PropsKartu {
  data: RingkasKelas;
  kelasAktif: KelasAset | null;
  subAktif: string | null;
  onPilih: (kelas: KelasAset, sub: string | null) => void;
  fmtNilai: (n: number) => string;
  /** Hanya dipakai kartu "Belum Terklasifikasi": nilai Jenis mentah yang belum dikenali aturan. */
  jenisTakDikenal?: { jenis: string; jumlah: number }[];
}

/** Satu kartu per kelas: total + daftar sub-kategori yang bisa diklik untuk memfilter tabel. */
export function KartuKelas({ data, kelasAktif, subAktif, onPilih, fmtNilai, jenisTakDikenal = [] }: PropsKartu) {
  const n = NADA_KELAS[data.kelas];
  const Ikon = IKON_KELAS[data.kelas];
  const headAktif = kelasAktif === data.kelas && subAktif === null;
  const angka: React.CSSProperties = { fontSize: '.72rem', color: 'var(--txt-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

  return (
    <div className="glass-panel" style={{ borderRadius: 16, padding: '.55rem', minWidth: 0, display: 'grid', gap: '.2rem', alignContent: 'start' }}>
      <button type="button" className="wr-kpi" aria-pressed={headAktif} onClick={() => onPilih(data.kelas, null)}
        style={{
          display: 'flex', alignItems: 'center', gap: '.65rem', width: '100%', textAlign: 'left', padding: '.6rem .7rem',
          borderRadius: 12, cursor: 'pointer',
          ...(headAktif ? { background: n.bg, border: `1px solid ${n.garis}`, boxShadow: `inset 0 -3px 0 ${n.warna}` } : {}),
        }}>
        <span style={{
          width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0,
          background: n.bg, color: n.teks, border: `1px solid ${n.garis}`,
        }}>
          <Ikon size={17} aria-hidden="true" />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: '.82rem', fontWeight: 700, color: n.teks }}>
            {data.kelas === 'Belum Terklasifikasi' ? 'Belum terklasifikasi' : data.kelas}
          </span>
          <span style={{ display: 'block', fontSize: '.7rem', color: 'var(--txt-secondary)' }}>
            {data.jumlahAset.toLocaleString('id-ID')} aset · {data.jumlahBarang.toLocaleString('id-ID')} unit
          </span>
        </span>
        <span style={{ ...angka, fontSize: '.76rem', fontWeight: 700, color: 'var(--txt-primary)' }}>
          {data.nilai ? fmtNilai(data.nilai) : '-'}
        </span>
      </button>

      <div style={{ display: 'grid', gap: '.1rem' }}>
        {data.subs.map((s) => {
          const SubIkon = ikonSub(data.kelas, s.nama);
          const aktif = kelasAktif === data.kelas && subAktif === s.nama;
          const pct = data.jumlahAset ? Math.max(3, Math.round((s.jumlahAset / data.jumlahAset) * 100)) : 0;
          return (
            <button key={s.nama} type="button" className="wr-sub" aria-pressed={aktif} onClick={() => onPilih(data.kelas, s.nama)}
              style={{
                display: 'grid', gap: '.3rem', width: '100%', textAlign: 'left', padding: '.4rem .7rem', borderRadius: 10, cursor: 'pointer',
                ...(aktif ? { background: n.bg, border: `1px solid ${n.garis}` } : {}),
              }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '.45rem', minWidth: 0 }}>
                <SubIkon size={13} aria-hidden="true" style={{ color: n.teks, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: '.76rem', fontWeight: aktif ? 700 : 600, color: 'var(--txt-primary)', overflowWrap: 'anywhere' }}>
                  {s.nama}
                </span>
                <span style={angka}>{s.jumlahAset.toLocaleString('id-ID')} aset</span>
                <span style={{ ...angka, minWidth: 78, textAlign: 'right' }}>{s.nilai ? fmtNilai(s.nilai) : '-'}</span>
              </span>
              {/* Bar = porsi jumlah aset terhadap kelasnya; angkanya tetap tertulis di atas. */}
              <span aria-hidden="true" style={{ display: 'block', height: 4, borderRadius: 2, background: 'var(--wr-line)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: n.warna, borderRadius: 2 }} />
              </span>
            </button>
          );
        })}
      </div>

      {data.kelas === 'Belum Terklasifikasi' && jenisTakDikenal.length > 0 && (
        <div style={{ fontSize: '.68rem', color: 'var(--wr-txt-muted)', padding: '.3rem .7rem .2rem', lineHeight: 1.55 }}>
          Jenis dari sheet yang belum dikenali:{' '}
          {jenisTakDikenal.slice(0, 6).map((j) => `${j.jenis} (${j.jumlah})`).join(', ')}
          {jenisTakDikenal.length > 6 ? ', …' : ''}. Tambahkan ke aturan di <code>asetKlasifikasi.ts</code> agar masuk Equipment/Building.
        </div>
      )}
    </div>
  );
}

/** Kontrol pilih-satu bergaya tab kecil (aria-pressed + garis bawah sebagai penanda aktif). */
export function Segmen<T extends string>({ label, nilai, opsi, onUbah }: {
  label: string; nilai: T; opsi: { id: T; label: string }[]; onUbah: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '.72rem', color: 'var(--wr-txt-muted)', marginRight: '.1rem' }}>{label}</span>
      {opsi.map((o) => {
        const aktif = o.id === nilai;
        return (
          <button key={o.id} type="button" className="wr-tab" aria-pressed={aktif} onClick={() => onUbah(o.id)}
            style={{
              padding: '.3rem .65rem', borderRadius: 8, fontSize: '.72rem', cursor: 'pointer', fontWeight: aktif ? 700 : 600,
              ...(aktif ? { background: NADA.aset.bg, color: NADA.aset.teks, border: `1px solid ${NADA.aset.garis}`, boxShadow: `inset 0 -2px 0 ${NADA.aset.warna}` } : {}),
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}