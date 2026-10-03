// Sistem warna & helper bersama untuk menu "Laporan Mingguan" dan tab-tab di
// dalamnya (Barang Keluar/Masuk/Aset, PICA, Work Target).
//
// Semua warna datang dari token --wr-* di index.css (dark = :root, light =
// html[data-theme='light']). Di sini hanya ada pemetaan, helper chart, dan CSS
// untuk state yang tidak bisa ditulis inline (hover, focus, zebra).
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

// Nada warna semantik: warna = fill/stroke grafik, teks = teks & ikon kecil
// (lolos 4.5:1), bg/garis = latar & border badge/chip/kartu.
export interface Nada { warna: string; teks: string; bg: string; garis: string }
const nada = (n: string): Nada => ({
  warna: `var(--wr-${n})`, teks: `var(--wr-${n}-text)`, bg: `var(--wr-${n}-bg)`, garis: `var(--wr-${n}-border)`,
});
export const NADA = {
  in: nada('in'), out: nada('out'), aset: nada('aset'), warn: nada('warn'), info: nada('info'),
  /** Negatif sungguhan (di bawah target) — bukan sekadar kategori. */
  neg: nada('neg'),
  /** Netral: belum ada data / tidak dinilai. */
  neutral: nada('neutral'),
};

// Urutan seri dipilih agar warna bersebelahan kontras dan hangat-dingin
// berselang-seling (ala IBM Carbon); tidak ada merah murni supaya tidak
// terbaca sebagai status error. Seri ke-9 (netral) untuk grup dengan banyak PIC.
export const SERI = ['var(--wr-in)', 'var(--wr-out)', 'var(--wr-warn)', 'var(--wr-aset)',
  'var(--wr-info)', 'var(--wr-c6)', 'var(--wr-c7)', 'var(--wr-c8)'];
export const SERI_PANJANG = [...SERI, 'var(--wr-neutral)'];

// Pola garis per urutan seri — pembeda selain warna (WCAG 1.4.1).
export const POLA_GARIS: (string | undefined)[] = [
  undefined, '7 4', '2 3', '10 3 2 3', '1 5', '5 2 1 2', '3 5', '12 3', '2 6',
];

export const tooltipStyle: CSSProperties = {
  background: 'var(--wr-tooltip-bg)', border: '1px solid var(--wr-tooltip-border)',
  borderRadius: 10, fontSize: '.75rem', color: 'var(--txt-primary)', boxShadow: 'var(--wr-tooltip-shadow)',
};
export const tooltipProps = {
  contentStyle: tooltipStyle,
  itemStyle: { color: 'var(--txt-primary)' } as CSSProperties,
  labelStyle: { color: 'var(--wr-txt-muted)', fontWeight: 600 } as CSSProperties,
};

// Teks legenda selalu netral (terbaca di kedua tema); warna seri hanya di
// penanda. Legenda pie menambah persentase agar tak bergantung pada warna.
export const fmtLegend = (v: unknown) => <span style={{ color: 'var(--txt-secondary)' }}>{String(v)}</span>;
export const fmtLegendPie = (data: { name: string; value: number }[]) => {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (v: unknown) => {
    const d = data.find((x) => x.name === v);
    return (
      <span style={{ color: 'var(--txt-secondary)' }}>
        {String(v)}{d && total > 0 ? ` · ${Math.round((d.value / total) * 100)}%` : ''}
      </span>
    );
  };
};

// Atribut SVG recharts dibaca sebagai nilai hasil-hitung (bukan var()), lalu
// dibaca ulang saat atribut tema di <html> berganti.
const WR_VARS = ['--wr-in', '--wr-out', '--wr-aset', '--wr-warn', '--wr-info', '--wr-c6', '--wr-c7', '--wr-c8',
  '--wr-neutral', '--wr-in-text', '--wr-neg', '--wr-txt-muted', '--wr-grid', '--wr-cursor', '--wr-cursor-fill',
  '--wr-seg-gap'] as const;
export type WrWarna = Record<(typeof WR_VARS)[number], string>;
const bacaWarna = (): WrWarna => {
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(WR_VARS.map((v) => [v, cs.getPropertyValue(v).trim()])) as WrWarna;
};
export function useWrWarna(): WrWarna {
  const [w, setW] = useState<WrWarna>(bacaWarna);
  useEffect(() => {
    const ob = new MutationObserver(() => setW(bacaWarna()));
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => ob.disconnect();
  }, []);
  return w;
}

export interface WrTema {
  W: WrWarna;
  /** Ubah 'var(--wr-x)' menjadi nilai hasil-hitungnya untuk atribut SVG recharts. */
  rv: (v: string) => string;
}
export function useWrTema(): WrTema {
  const W = useWrWarna();
  const rv = (v: string) => {
    const m = /^var\((--[\w-]+)\)$/.exec(v);
    return (m && (W as Record<string, string>)[m[1]]) || v;
  };
  return { W, rv };
}

// Gaya bersama: kontrol, tombol, tab, tabel. Hover/focus/zebra tidak bisa
// ditulis inline. Tabel .wr-tbl sengaja TIDAK diubah menjadi kartu di layar
// sempit (aturan .simple-table di index.css): tabel ini lebar & tanpa
// data-label, jadi tetap berupa tabel yang bisa digeser horizontal.
export const WR_CSS = `
.wr-ctl{background:var(--wr-field-bg);color:var(--txt-primary);border:1px solid var(--wr-field-border)}
.wr-ctl::placeholder{color:var(--wr-txt-muted);opacity:1}
.wr-ctl:hover:not(:disabled){border-color:var(--wr-field-border-hover)}
select.wr-ctl{color-scheme:inherit;cursor:pointer}
select.wr-ctl:disabled{cursor:not-allowed}
select.wr-ctl option{background:var(--wr-option-bg,var(--bg-card,#111827));color:var(--txt-primary,#fff)}
select.wr-ctl option:hover{background:var(--wr-option-hover-bg,var(--bg-card-hover,#222836));color:var(--txt-primary,#fff)}
select.wr-ctl option:checked{background:var(--wr-option-selected-bg,var(--bg-card-hover,#222836));color:var(--txt-primary,#fff);font-weight:600}
.wr-ctl:disabled{opacity:.6;cursor:not-allowed}
.wr-btn{background:var(--wr-btn-bg);color:var(--txt-primary);border:1px solid var(--wr-field-border);font-weight:500}
.wr-btn:not(.wr-btn--info):not(.wr-btn--primary):hover:not(:disabled){background:var(--wr-btn-bg-hover)}
.wr-btn--info{background:var(--wr-info-bg);color:var(--wr-info-text);border-color:var(--wr-info-border)}
.wr-btn--primary{background:var(--wr-in);color:var(--wr-on-in);border-color:transparent;font-weight:600}
.wr-btn--info:hover:not(:disabled),.wr-btn--primary:hover:not(:disabled){filter:brightness(.92)}
.wr-tab{background:var(--wr-tab-bg);color:var(--wr-txt-muted);border:1px solid var(--wr-line)}
.wr-tab:not([aria-pressed='true']):hover{background:var(--wr-btn-bg-hover);color:var(--txt-primary)}
.wr-kpi{background:var(--wr-tab-bg);border:1px solid var(--wr-line)}
.wr-kpi:not([aria-pressed='true']):hover{background:var(--wr-btn-bg-hover)}
.wr-sub{background:transparent;border:1px solid transparent;color:inherit}
.wr-sub:not([aria-pressed='true']):hover{background:var(--wr-btn-bg-hover)}
.wr-chev{display:grid;place-items:center;background:none;border:0;padding:2px;color:inherit;cursor:pointer;border-radius:4px}
.wr-ctl:focus-visible,.wr-btn:focus-visible,.wr-tab:focus-visible,.wr-kpi:focus-visible,.wr-sub:focus-visible,.wr-chev:focus-visible{outline:2px solid var(--wr-focus);outline-offset:2px}
.wr-tbl th{color:var(--wr-txt-muted);background:var(--wr-th-bg)}
.wr-tbl tr.wr-row--kosong td{color:var(--wr-txt-muted)}
@media (max-width:760px){
.simple-table.wr-tbl{display:table;width:100%}
.simple-table.wr-tbl thead{display:table-header-group}
.simple-table.wr-tbl tbody{display:table-row-group;width:auto}
.simple-table.wr-tbl tr{display:table-row;width:auto;margin:0;padding:0;border:0;border-radius:0;background:transparent}
.simple-table.wr-tbl th,.simple-table.wr-tbl td{display:table-cell;text-align:left;border-bottom:1px solid var(--border-subtle)}
}
.wr-tbl tbody tr.wr-row:nth-child(even){background:var(--wr-zebra)}
.wr-tbl--plain tbody tr.wr-row:nth-child(even){background:transparent}
.wr-tbl tbody tr.wr-row:hover{background:var(--wr-row-hover)}
.wr-tbl tbody tr.wr-row[aria-selected='true']{background:var(--wr-row-selected)}
`;