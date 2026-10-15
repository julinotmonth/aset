// Komponen & gaya bersama untuk Aset Tetap dan Jadwal Maintenance.
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const EAM_CSS = `
.eam-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr));gap:.9rem;margin-bottom:1rem}
.eam-kpi{display:flex;align-items:center;gap:.8rem;text-align:left;border-radius:16px;padding:1rem 1.1rem;font:inherit;color:inherit;
  background:var(--wr-tab-bg);border:1px solid var(--wr-line)}
button.eam-kpi{cursor:pointer}
button.eam-kpi:hover{background:var(--wr-btn-bg-hover)}
button.eam-kpi[aria-pressed='true']{border-color:var(--wr-in);box-shadow:0 0 0 1px var(--wr-in) inset}
.eam-kpi-ico{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex-shrink:0}
.eam-kpi-lbl{font-size:.72rem;letter-spacing:.04em;text-transform:uppercase;color:var(--wr-txt-muted)}
.eam-kpi-val{font-size:1.4rem;font-weight:800;color:var(--txt-primary);line-height:1.15}
.eam-kpi-sub{font-size:.72rem;color:var(--wr-txt-muted);margin-top:2px}
.eam-chips{display:flex;flex-wrap:wrap;gap:.45rem}
.eam-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.4rem .8rem;border-radius:999px;font:inherit;font-size:.8rem;font-weight:600;cursor:pointer;
  background:var(--wr-tab-bg);color:var(--wr-txt-muted);border:1px solid var(--wr-line)}
.eam-chip:hover{background:var(--wr-btn-bg-hover);color:var(--txt-primary)}
.eam-chip[aria-pressed='true']{background:var(--wr-in);color:var(--wr-on-in);border-color:transparent}
.eam-chip-n{font-size:.7rem;font-weight:700;padding:1px 7px;border-radius:999px;background:rgba(127,127,127,.18)}
.eam-chip[aria-pressed='true'] .eam-chip-n{background:rgba(0,0,0,.18)}
.eam-kpi:focus-visible,.eam-chip:focus-visible,.eam-pg:focus-visible,.eam-ib:focus-visible,.eam-seg button:focus-visible,.eam-row:focus-visible{outline:2px solid var(--wr-focus,#00D084);outline-offset:2px}
.eam-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.eam-bar{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}
.eam-search{position:relative;flex:1 1 240px;min-width:200px}
.eam-search input{width:100%;padding:.62rem 2.2rem .62rem 2.5rem;border-radius:10px;font-size:.88rem;outline:none}
.eam-search .eam-ico{position:absolute;left:.85rem;top:50%;transform:translateY(-50%);color:var(--wr-txt-muted);pointer-events:none}
.eam-search .eam-clear{position:absolute;right:.45rem;top:50%;transform:translateY(-50%);display:grid;place-items:center;padding:4px;border-radius:6px;background:none;border:0;color:var(--wr-txt-muted);cursor:pointer}
.eam-sel{padding:.62rem .9rem;border-radius:10px;font-size:.85rem;outline:none}
.eam-btn{display:inline-flex;align-items:center;gap:.45rem;padding:.62rem 1rem;border-radius:10px;font:inherit;font-size:.85rem;cursor:pointer}
.eam-btn:disabled{opacity:.5;cursor:not-allowed}
.eam-lbl{font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--wr-txt-muted);margin-bottom:.5rem}
.eam-pill{display:inline-flex;align-items:center;gap:.3rem;font-size:.72rem;font-weight:700;padding:.2rem .6rem;border-radius:999px;white-space:nowrap}
.eam-ib{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;padding:0;cursor:pointer;background:var(--chip-bg);border:1px solid var(--chip-border);color:var(--txt-primary);transition:filter 150ms}
.eam-ib:hover:not(:disabled){filter:brightness(1.2)}
.eam-ib:disabled{opacity:.4;cursor:not-allowed}
.eam-ib.ok{background:rgba(0,208,132,.1);border-color:rgba(0,208,132,.3);color:#00D084}
.eam-ib.info{background:rgba(96,165,250,.1);border-color:rgba(96,165,250,.3);color:#60A5FA}
.eam-ib.bad{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.25);color:#F87171}
.eam-foot{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;justify-content:space-between;margin-top:1rem;font-size:.8rem;color:var(--wr-txt-muted)}
.eam-pager{display:flex;align-items:center;gap:.35rem}
.eam-pg{min-width:32px;height:32px;padding:0 .4rem;border-radius:8px;display:grid;place-items:center;font:inherit;font-size:.8rem;font-weight:600;cursor:pointer;background:var(--wr-tab-bg);color:var(--txt-primary);border:1px solid var(--wr-line)}
.eam-pg:hover:not(:disabled){background:var(--wr-btn-bg-hover)}
.eam-pg:disabled{opacity:.4;cursor:not-allowed}
.eam-pg[aria-current='page']{background:var(--wr-in);color:var(--wr-on-in);border-color:transparent}
.eam-seg{display:inline-flex;border-radius:10px;overflow:hidden;border:1px solid var(--wr-line)}
.eam-seg button{display:inline-flex;align-items:center;gap:.4rem;padding:.55rem .9rem;font:inherit;font-size:.82rem;font-weight:600;cursor:pointer;background:var(--wr-tab-bg);color:var(--wr-txt-muted);border:0}
.eam-seg button[aria-pressed='true']{background:var(--wr-in);color:var(--wr-on-in)}
.eam-seg button:not([aria-pressed='true']):hover{background:var(--wr-btn-bg-hover);color:var(--txt-primary)}
.eam-tbl{width:100%;border-collapse:collapse;font-size:.85rem}
.eam-tbl th{text-align:left;font-size:.7rem;letter-spacing:.05em;text-transform:uppercase;color:var(--wr-txt-muted);padding:.7rem .8rem;border-bottom:1px solid var(--wr-line);white-space:nowrap}
.eam-tbl td{padding:.75rem .8rem;border-bottom:1px solid var(--wr-line);vertical-align:middle}
.eam-tbl tbody tr.eam-row{cursor:pointer}
.eam-tbl tbody tr.eam-row:hover{background:var(--wr-row-hover)}
.eam-scroll{overflow-x:auto}
.eam-thumb{width:46px;height:46px;border-radius:10px;overflow:hidden;flex-shrink:0;display:grid;place-items:center;background:var(--bg-root);border:1px solid var(--border-subtle)}
.eam-thumb img{width:100%;height:100%;object-fit:cover}
.eam-prog{height:6px;border-radius:99px;background:var(--chip-bg);overflow:hidden;min-width:70px}
.eam-prog>span{display:block;height:100%;border-radius:99px}
.eam-empty{text-align:center;padding:3rem 1.5rem;color:var(--wr-txt-muted)}
.eam-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr));gap:.7rem}
.eam-mini{border-radius:12px;padding:.75rem .9rem;background:var(--wr-tab-bg);border:1px solid var(--wr-line)}
.eam-mini b{display:block;font-size:1rem;color:var(--txt-primary);margin-top:2px}
.eam-mini span{font-size:.7rem;letter-spacing:.04em;text-transform:uppercase;color:var(--wr-txt-muted)}
`;

export interface KpiProps {
  ikon: React.ElementType; warna: string; label: string; nilai: string; sub?: string;
  /** Bila diberikan, kartu menjadi tombol filter. */
  aktif?: boolean; onKlik?: () => void; nilaiWarna?: string; nilaiUkuran?: string;
}
export const KpiKartu: React.FC<KpiProps> = ({ ikon: Ikon, warna, label, nilai, sub, aktif, onKlik, nilaiWarna, nilaiUkuran }) => {
  const isi = (
    <>
      <div className="eam-kpi-ico" style={{ background: `${warna}22` }}><Ikon size={20} color={warna} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="eam-kpi-lbl">{label}</div>
        <div className="eam-kpi-val" style={{ color: nilaiWarna, fontSize: nilaiUkuran }}>{nilai}</div>
        {sub && <div className="eam-kpi-sub">{sub}</div>}
      </div>
    </>
  );
  return onKlik
    ? <button type="button" className="eam-kpi" aria-pressed={!!aktif} onClick={onKlik}>{isi}</button>
    : <div className="eam-kpi">{isi}</div>;
};

export const PER_HALAMAN = 10;

/** Paginasi: menampilkan "Menampilkan a–b dari n" dan tombol halaman ringkas. */
export const Pager: React.FC<{ halaman: number; total: number; perHalaman?: number; satuan: string; onUbah: (h: number) => void }> = ({
  halaman, total, perHalaman = PER_HALAMAN, satuan, onUbah,
}) => {
  const totalHal = Math.max(1, Math.ceil(total / perHalaman));
  const aktif = Math.min(halaman, totalHal);
  const mulai = (aktif - 1) * perHalaman;
  const akhir = Math.min(mulai + perHalaman, total);
  const set = new Set<number>([1, totalHal, aktif - 1, aktif, aktif + 1]);
  const a = [...set].filter((n) => n >= 1 && n <= totalHal).sort((x, y) => x - y);
  const nomor: (number | '…')[] = [];
  a.forEach((n, i) => { if (i && n - a[i - 1] > 1) nomor.push('…'); nomor.push(n); });
  if (total === 0) return null;
  return (
    <div className="eam-foot">
      <span aria-live="polite">Menampilkan {mulai + 1}–{akhir} dari {total} {satuan}</span>
      {totalHal > 1 && (
        <nav className="eam-pager" aria-label="Halaman">
          <button type="button" className="eam-pg" aria-label="Halaman sebelumnya" disabled={aktif === 1} onClick={() => onUbah(aktif - 1)}><ChevronLeft size={15} /></button>
          {nomor.map((n, i) => n === '…'
            ? <span key={`e${i}`} style={{ padding: '0 .2rem' }}>…</span>
            : <button key={n} type="button" className="eam-pg" aria-current={n === aktif ? 'page' : undefined} onClick={() => onUbah(n)}>{n}</button>)}
          <button type="button" className="eam-pg" aria-label="Halaman berikutnya" disabled={aktif === totalHal} onClick={() => onUbah(aktif + 1)}><ChevronRight size={15} /></button>
        </nav>
      )}
    </div>
  );
};

/** Potong daftar sesuai halaman aktif (dijepit ke halaman terakhir yang valid). */
export function potongHalaman<T>(daftar: T[], halaman: number, perHalaman = PER_HALAMAN): T[] {
  const totalHal = Math.max(1, Math.ceil(daftar.length / perHalaman));
  const h = Math.min(halaman, totalHal);
  return daftar.slice((h - 1) * perHalaman, h * perHalaman);
}

export const Pil: React.FC<{ warna: string; bg: string; children: React.ReactNode; title?: string }> = ({ warna, bg, children, title }) => (
  <span className="eam-pill" style={{ color: warna, background: bg }} title={title}>{children}</span>
);
