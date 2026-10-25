// Potongan UI bersama untuk menu Spare Part & Transfer Antar Site.
import type { ReactNode } from 'react';
import { NADA } from './wrTema';
import type { Nada } from './wrTema';
import type { StatusSp, Urgensi } from './sparePartData';
import { labelSiteDariKey } from './siteLabel';

export const rp = (n: number): string => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
export const qty = (n: number): string => n.toLocaleString('id-ID', { maximumFractionDigits: 1 });
export const tickRupiah = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (a >= 1e6) return `${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 0 })} jt`;
  if (a >= 1e3) return `${(n / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
  return String(Math.round(n));
};
export const namaSite = (key: string): string => labelSiteDariKey(key);
export const potong = (t: string, n: number): string => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
/** Sisa stok yang mudah dibaca: nol/negatif ditampilkan "Habis" (angka negatif hanya membingungkan). */
export const fmtSisa = (n: number): string => (n <= 0 ? 'Habis' : qty(n));
/** Lama stok cukup: "8,5 minggu" / "habis" / "tidak terpakai". */
export const fmtCover = (c: number | null): string => (c === null ? 'tidak terpakai' : c <= 0 ? 'habis' : c >= 104 ? 'lebih dari 2 tahun' : `${c.toLocaleString('id-ID', { maximumFractionDigits: 1 })} minggu`);
/** Ringkasan kondisi stok satu site, mis. "Sisa 22 · cukup untuk 44 minggu" atau "Stok habis". */
export const ketStok = (saldo: number, cover: number | null): string =>
  saldo <= 0 ? 'Stok habis' : cover === null ? `Sisa ${qty(saldo)} · tidak terpakai` : `Sisa ${qty(saldo)} · cukup untuk ${fmtCover(cover)}`;

export const NADA_STATUS: Record<StatusSp, Nada> = {
  Aman: NADA.in, Waspada: NADA.warn, Kritis: NADA.neg, 'Tidak Bergerak': NADA.neutral, 'Cek Stok': NADA.info,
};
export const NADA_URGENSI: Record<Urgensi, Nada> = { Tinggi: NADA.neg, Sedang: NADA.warn, Rendah: NADA.info };
export const KETERANGAN_STATUS: Record<StatusSp, string> = {
  Aman: 'Sisa stok cukup untuk 8 minggu atau lebih pada laju pemakaian terakhir',
  Waspada: 'Sisa stok cukup untuk 4–8 minggu',
  Kritis: 'Sisa stok cukup kurang dari 4 minggu',
  'Tidak Bergerak': 'Masih ada sisa stok, tetapi tidak dipakai dalam 12 minggu terakhir',
  'Cek Stok': 'Sisa stok tercatat habis (barang keluar lebih banyak dari yang tercatat masuk) — kemungkinan stok awal belum dicatat, cek stok fisik',
};

export function Chip({ nada, teks, title }: { nada: Nada; teks: string; title?: string }) {
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', fontSize: '.68rem', fontWeight: 700, padding: '2px 9px', borderRadius: 99,
      background: nada.bg, color: nada.teks, border: `1px solid ${nada.garis}`, whiteSpace: 'nowrap',
    }}>{teks}</span>
  );
}
export const ChipStatus = ({ s }: { s: StatusSp }) => <Chip nada={NADA_STATUS[s]} teks={s} title={KETERANGAN_STATUS[s]} />;
export const ChipEntitas = ({ e }: { e: 'RDA' | 'RCE' }) => (
  <Chip nada={e === 'RDA' ? NADA.out : NADA.aset} teks={e} title={e === 'RDA' ? 'PT Reethau Dharma Andalan' : 'Reethau Clean Energy'} />
);

export function Panel({ judul, baca, aksi, children, tinggi }: {
  judul: string; baca?: string; aksi?: ReactNode; children: ReactNode; tinggi?: number;
}) {
  return (
    <section className="glass-panel sp2-panel" aria-label={judul}>
      <div className="sp2-ph">
        <div style={{ minWidth: 0 }}>
          <h3 className="sp2-h3">{judul}</h3>
          {baca && <p className="sp2-baca">{baca}</p>}
        </div>
        {aksi}
      </div>
      <div style={tinggi ? { height: tinggi } : undefined}>{children}</div>
    </section>
  );
}

/** Daftar peringkat dengan batang proporsional — lebih jelas dari grafik untuk membandingkan kategori. */
export function Peringkat({ baris, warna, kosong }: {
  baris: { label: string; sub?: string; nilai: number; teks: string }[]; warna: string; kosong: string;
}) {
  const maks = Math.max(...baris.map((b) => b.nilai), 0);
  if (!baris.length || maks <= 0) return <div className="sp2-kosong">{kosong}</div>;
  return (
    <ol className="sp2-rank">
      {baris.map((b, i) => (
        <li key={`${b.label}-${i}`}>
          <span className="sp2-rank-no">{i + 1}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="sp2-rank-top"><span title={b.label} className="sp2-rank-l">{b.label}</span><b>{b.teks}</b></div>
            {b.sub && <div className="sp2-rank-sub">{b.sub}</div>}
            <div className="sp2-bar"><span style={{ width: `${Math.max((b.nilai / maks) * 100, 2)}%`, background: warna }} /></div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export const SP_CSS = `
.sp2-panel{border-radius:18px;padding:1rem 1.1rem;min-width:0}
.sp2-ph{display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start;margin-bottom:.7rem}
.sp2-h3{margin:0;font-size:.86rem;font-weight:800;color:var(--txt-primary)}
.sp2-baca{margin:.2rem 0 0;font-size:.72rem;line-height:1.5;color:var(--wr-txt-muted)}
.sp2-row{display:grid;gap:1rem;margin-bottom:1rem;grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))}
.sp2-kosong{display:grid;place-items:center;text-align:center;min-height:110px;padding:1rem;font-size:.8rem;color:var(--wr-txt-muted)}
.sp2-filter{display:flex;gap:.55rem;flex-wrap:wrap;align-items:center;margin-bottom:.9rem}
.sp2-filter label{font-size:.72rem;font-weight:700;color:var(--txt-secondary);display:flex;align-items:center;gap:.4rem}
.sp2-ctl{padding:.45rem .7rem;border-radius:10px;font:inherit;font-size:.82rem;min-width:0}
.sp2-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.38rem .8rem;border-radius:99px;font:inherit;font-size:.76rem;font-weight:700;cursor:pointer;
  background:var(--wr-tab-bg);color:var(--txt-secondary);border:1px solid var(--wr-line)}
.sp2-chip:hover{background:var(--wr-btn-bg-hover)}
.sp2-chip[aria-pressed='true']{background:var(--wr-in-bg);color:var(--wr-in-text);border-color:var(--wr-in-border)}
.sp2-chip:focus-visible,.sp2-th:focus-visible,.sp2-tr:focus-visible,.sp2-btn:focus-visible{outline:2px solid var(--wr-focus,#00D084);outline-offset:2px}
.sp2-chip small{font-weight:600;opacity:.75}
.sp2-btn{display:inline-flex;align-items:center;gap:.4rem;padding:.45rem .8rem;border-radius:10px;font:inherit;font-size:.78rem;font-weight:700;cursor:pointer;
  background:var(--wr-btn-bg);color:var(--txt-primary);border:1px solid var(--wr-field-border)}
.sp2-btn:hover{background:var(--wr-btn-bg-hover)}
.sp2-btn:disabled{opacity:.5;cursor:not-allowed}
.sp2-btn.utama{background:var(--wr-in);color:var(--wr-on-in);border-color:transparent}
.sp2-tbl{width:100%;border-collapse:collapse;font-size:.8rem}
.sp2-tbl th{text-align:left;font-size:.66rem;letter-spacing:.05em;text-transform:uppercase;color:var(--wr-txt-muted);padding:.55rem .6rem;border-bottom:1px solid var(--wr-line);white-space:nowrap;font-weight:700}
.sp2-tbl th.r,.sp2-tbl td.r{text-align:right;font-variant-numeric:tabular-nums}
.sp2-th{cursor:pointer;user-select:none;background:none;border:0;font:inherit;color:inherit;text-transform:inherit;letter-spacing:inherit;padding:0;display:inline-flex;gap:.25rem;align-items:center}
.sp2-tbl td{padding:.6rem;border-bottom:1px solid var(--wr-line);vertical-align:middle;color:var(--txt-secondary)}
.sp2-tbl td.k{color:var(--txt-primary);font-weight:600}
.sp2-tr{cursor:pointer}
.sp2-tr:hover td{background:var(--wr-btn-bg-hover)}
.sp2-tbl tbody tr:last-child td{border-bottom:0}
.sp2-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.72rem;color:var(--wr-in-text)}
.sp2-rank{list-style:none;margin:0;padding:0;display:grid;gap:.7rem}
.sp2-rank li{display:flex;gap:.7rem;align-items:flex-start}
.sp2-rank-no{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:.7rem;font-weight:800;background:var(--wr-tab-bg);color:var(--txt-secondary);border:1px solid var(--wr-line);flex-shrink:0;margin-top:1px}
.sp2-rank-top{display:flex;justify-content:space-between;gap:.6rem;font-size:.78rem}
.sp2-rank-l{color:var(--txt-primary);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sp2-rank-top b{color:var(--txt-primary);font-variant-numeric:tabular-nums;white-space:nowrap}
.sp2-rank-sub{font-size:.68rem;color:var(--wr-txt-muted);margin-top:1px}
.sp2-bar{height:6px;border-radius:99px;background:var(--wr-line);overflow:hidden;margin-top:.3rem}
.sp2-bar>span{display:block;height:100%;border-radius:99px}
.sp2-note{display:flex;gap:.5rem;align-items:flex-start;font-size:.72rem;line-height:1.5;color:var(--wr-txt-muted);margin:0 0 1rem}
.sp2-pg{display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap;padding-top:.8rem;font-size:.76rem;color:var(--wr-txt-muted)}
.sp2-modal{position:fixed;inset:0;z-index:120;background:rgba(8,12,20,.55);display:grid;place-items:center;padding:1rem}
.sp2-dlg{width:min(880px,100%);max-height:92vh;overflow:auto;border-radius:20px;padding:1.2rem 1.3rem;background:var(--bg-card,var(--wr-tab-bg));border:1px solid var(--wr-line);box-shadow:0 24px 64px rgba(0,0,0,.35)}
.sp2-mini{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.55rem;margin:.9rem 0}
.sp2-mini>div{padding:.6rem .75rem;border-radius:12px;background:var(--wr-tab-bg);border:1px solid var(--wr-line)}
.sp2-mini small{display:block;font-size:.64rem;letter-spacing:.04em;text-transform:uppercase;color:var(--wr-txt-muted)}
.sp2-mini b{display:block;margin-top:.15rem;font-size:.95rem;color:var(--txt-primary);font-variant-numeric:tabular-nums}
@keyframes sp2-spin{to{transform:rotate(360deg)}}
.sp2-spin{animation:sp2-spin .9s linear infinite}
@media (prefers-reduced-motion:reduce){.sp2-spin{animation:none}}
`;