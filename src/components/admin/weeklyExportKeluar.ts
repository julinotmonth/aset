// Export Barang Keluar → Excel dengan susunan yang sama seperti file "Report Weekly All MS_WS_RET":
//
//   • "Week <site>"   — tabel seperti sheet Week di template (seksi, baris per alokasi, kolom per minggu,
//                       Total Harga, Grand Total, Sales Order/m3, Rp/m3, blok NB). Angkanya RUMUS SUMIFS yang
//                       menunjuk ke sheet Report, jadi bisa difilter / diubah di Excel dan ikut terhitung ulang.
//   • "Report <site>" — data detail per transaksi (urut per minggu, belang per minggu, filter di tiap kolom).
//                       Dua kolom bantu di ujung kanan ("Seksi" dan "Baris Template") adalah kunci SUMIFS.
//   • "Per Minggu"    — rekap satu baris per minggu: biaya tiap seksi, Grand Total, jumlah transaksi, Rp/m3,
//                       plus porsi tiap seksi — untuk analisa tren mingguan.
//
// Modul ini murni (tidak membaca state React / API) supaya mudah diuji. exceljs dimuat lewat dynamic import
// agar tidak ikut membesarkan bundel awal aplikasi.
import type { SeksiKey } from './weeklyTemplate';

export interface BarisLaporan {
  minggu: number; tanggal: string | null; bulan: number; tahun: number;
  kode: string; namaBarang: string; jumlah: number; satuan: string;
  alokasi: string; detailAlokasi: string; pic: string; harga: number; totalHarga: number;
  noMr: string; keterangan: string; kodeBiaya: string;
  section: SeksiKey;
  /** Nama baris di tabel Week tempat baris ini dijumlahkan (baris template, atau alokasi aslinya). */
  baris: string;
}

export interface SeksiExport {
  key: SeksiKey; judul: string; labelKolom: string; totalLabel: string;
  /** Kode biaya sheet (MH/OH/DF/O) — ditulis di kolom A tiap baris bila baris tak punya alias (seperti kolom A \"Week Workshop Jabar\"). */
  kode?: string;
  baris: { label: string; alias?: string }[];
}

/**
 * total = total seksi · rata = rata-rata total seksi per minggu · grand = Grand Total ·
 * terakhir = Grand Total minggu terakhir · rataGrand = rata-rata Grand Total per minggu.
 */
export interface NbExport { teks: string; jenis: 'total' | 'rata' | 'grand' | 'terakhir' | 'rataGrand'; seksi?: SeksiKey }

export interface OpsiExportKeluar {
  /** Mis. "MS Wunut" — dipakai untuk nama sheet. */
  namaSite: string;
  /** Mis. "Inventory MS Wunut" — judul di sheet Week (periode ditambahkan otomatis). */
  judulSheet: string;
  tahun: number;
  /** 0 = semua bulan. */
  bulan: number;
  /** 0 = semua minggu; selain itu hanya minggu tsb yang diekspor. */
  minggu: number;
  seksi: SeksiExport[];
  grandLabel: string;
  rows: BarisLaporan[];
  mingguList: number[];
  volumes: Record<number, number>;
  nb: NbExport[] | null;
}

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
// Kunci seksi di kolom \"Seksi\" sheet Report (kunci SUMIFS). Tiap seksi punya kunci sendiri — di Workshop Jabar
// banyak seksi berkode biaya sama (MH), jadi kuncinya bukan kode biaya.
const KODE_SEKSI: Record<SeksiKey, string> = {
  MAINT: 'MH', OH: 'OH', OLI: 'OLI', LAIN: 'LAIN', ISOTANK: 'ISOTANK',
  HT: 'HT', OHHT: 'OHHT', TS10: 'TS10', TS20: 'TS20', TS40: 'TS40', BT: 'BT', PRS: 'PRS', KSO: 'KSO', DF: 'DF',
  TOOLS: 'TOOLS', OTHERS: 'OTHERS',
};
const URUT_SEKSI: SeksiKey[] = ['MAINT', 'OH', 'OLI', 'LAIN', 'ISOTANK',
  'HT', 'OHHT', 'TS10', 'TS20', 'TS40', 'BT', 'PRS', 'KSO', 'DF', 'TOOLS', 'OTHERS'];

const FONT = 'Arial';
const HIJAU = 'FF0B6B4F';
const GARIS = { style: 'thin' as const, color: { argb: 'FFD5DBE1' } };
const BORDER = { top: GARIS, left: GARIS, bottom: GARIS, right: GARIS };
const GARIS_MINGGU = { style: 'medium' as const, color: { argb: 'FF8FA3B3' } };
const FMT_RP = '"Rp "#,##0;-"Rp "#,##0;"-"';
const FMT_RP_DESIMAL = '"Rp "#,##0.00;-"Rp "#,##0.00;"-"';
const WARNA_SEKSI: Record<SeksiKey, string> = {
  MAINT: 'FF0B6B4F', OH: 'FF1D4ED8', OLI: 'FF9A5B00', LAIN: 'FF6D28D9', ISOTANK: 'FF0E7490',
  HT: 'FF0B6B4F', OHHT: 'FF1D4ED8', TS10: 'FF0E7490', TS20: 'FF9A5B00', TS40: 'FF6D28D9', BT: 'FF475569', PRS: 'FF0B6B4F',
  KSO: 'FF1D4ED8', DF: 'FF9A5B00', TOOLS: 'FF6D28D9', OTHERS: 'FF0E7490',
};
const BG_TOTAL: Record<SeksiKey, string> = {
  MAINT: 'FFE6F4EE', OH: 'FFE3ECFB', OLI: 'FFFBEFDD', LAIN: 'FFEEE7FA', ISOTANK: 'FFDFF3F7',
  HT: 'FFE6F4EE', OHHT: 'FFE3ECFB', TS10: 'FFDFF3F7', TS20: 'FFFBEFDD', TS40: 'FFEEE7FA', BT: 'FFEDF0F3', PRS: 'FFE6F4EE',
  KSO: 'FFE3ECFB', DF: 'FFFBEFDD', TOOLS: 'FFEEE7FA', OTHERS: 'FFDFF3F7',
};

/** 1 → A, 27 → AA */
export function hurufKolom(n: number): string {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

const namaSheetAman = (s: string) => s.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet';
const kutip = (nama: string) => `'${nama.replace(/'/g, "''")}'`;

/** "MS_Wunut_2026_Mei_W30" — aman dipakai sebagai nama file. */
export function namaFileKeluar(o: Pick<OpsiExportKeluar, 'namaSite' | 'tahun' | 'bulan' | 'minggu'>): string {
  const bagian = ['Barang_Keluar', o.namaSite.replace(/\s+/g, '_'), String(o.tahun)];
  if (o.bulan) bagian.push(NAMA_BULAN[o.bulan - 1]);
  if (o.minggu) bagian.push(`W${o.minggu}`);
  return `${bagian.join('_').replace(/[^\w-]+/g, '_')}.xlsx`;
}

export async function buatXlsxKeluar(o: OpsiExportKeluar): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;

  // ── 1. Rapikan data: baris & seksi yang konsisten satu sama lain ────────────────────────────
  // SUMIFS tidak membedakan huruf besar/kecil, jadi dua nama baris yang hanya beda huruf besar/kecil
  // digabung ke satu baris — kalau tidak, nilainya terhitung dua kali.
  const seksi: SeksiExport[] = o.seksi.map((s) => ({ ...s, baris: [...s.baris] }));
  for (const r of o.rows) if (!seksi.some((s) => s.key === r.section)) {
    seksi.push({ key: r.section, judul: r.section, labelKolom: r.section, totalLabel: `Total ${r.section}`, baris: [] });
  }
  const kanon = new Map<SeksiKey, Map<string, string>>();
  for (const s of seksi) {
    const m = new Map<string, string>();
    const unik: typeof s.baris = [];
    for (const b of s.baris) {
      const k = b.label.toLowerCase();
      if (!m.has(k)) { m.set(k, b.label); unik.push(b); }
    }
    s.baris = unik;
    kanon.set(s.key, m);
  }
  const rows = o.rows.map((r) => {
    const m = kanon.get(r.section)!;
    const k = r.baris.toLowerCase();
    let label = m.get(k);
    if (!label) {
      label = r.baris;
      m.set(k, label);
      seksi.find((s) => s.key === r.section)!.baris.push({ label });
    }
    return { ...r, baris: label };
  }).sort((a, b) => a.minggu - b.minggu || (a.tanggal ?? '').localeCompare(b.tanggal ?? '')
    || URUT_SEKSI.indexOf(a.section) - URUT_SEKSI.indexOf(b.section) || a.baris.localeCompare(b.baris, 'id', { numeric: true }));

  const weeks = [...o.mingguList];
  const nilai = new Map<string, number>(); // `${seksi}|${baris}|${minggu}` → total
  const kunci = (s: string, b: string, m: number) => `${s}|${b.toLowerCase()}|${m}`;
  for (const r of rows) nilai.set(kunci(r.section, r.baris, r.minggu), (nilai.get(kunci(r.section, r.baris, r.minggu)) ?? 0) + r.totalHarga);
  const v = (s: SeksiKey, b: string, m: number) => nilai.get(kunci(s, b, m)) ?? 0;
  const totalSeksi = (s: SeksiExport, m: number) => s.baris.reduce((t, b) => t + v(s.key, b.label, m), 0);
  const grand = (m: number) => seksi.reduce((t, s) => t + totalSeksi(s, m), 0);
  const rpPerM3 = (m: number) => ((o.volumes[m] ?? 0) > 0 ? grand(m) / o.volumes[m] : 0);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Reethau Inventory Admin Portal';
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };

  const namaWeek = namaSheetAman(`Week ${o.namaSite}`);
  const namaReport = namaSheetAman(`Report ${o.namaSite}`);
  const namaRekap = 'Per Minggu';
  const wsWeek = wb.addWorksheet(namaWeek, { views: [{ state: 'frozen', xSplit: 3, showGridLines: false }], properties: { tabColor: { argb: HIJAU } } });
  const wsRekap = wb.addWorksheet(namaRekap, { views: [{ state: 'frozen', xSplit: 1, ySplit: 1, showGridLines: false }], properties: { tabColor: { argb: 'FF1D4ED8' } } });
  const wsRep = wb.addWorksheet(namaReport, { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }], properties: { tabColor: { argb: 'FF64748B' } } });

  // ── 2. Sheet "Report <site>" — data detail ──────────────────────────────────────────────────
  const KOLOM_REPORT = ['Tanggal', 'Minggu', 'Bulan', 'Tahun', 'Kode', 'Nama Barang', 'Jumlah', 'Satuan', 'Alokasi', 'Detail Alokasi', 'PIC',
    'Harga', 'Total Harga', 'No MR', 'Keterangan', 'MH/OH', 'Seksi', 'Baris Template'];
  const rh = wsRep.addRow(KOLOM_REPORT);
  rh.height = 26;
  rh.eachCell((c) => {
    c.font = { name: FONT, bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HIJAU } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = BORDER;
  });
  // Dua kolom kunci SUMIFS dibedakan warnanya.
  for (const col of [17, 18]) wsRep.getCell(1, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
  let pita = 0, mingguLalu: number | null = null;
  rows.forEach((r, i) => {
    const baru = i > 0 && r.minggu !== mingguLalu;
    if (baru) pita++;
    mingguLalu = r.minggu;
    const tgl = r.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(r.tanggal) ? new Date(`${r.tanggal}T00:00:00Z`) : (r.tanggal ?? '');
    const row = wsRep.addRow([tgl, r.minggu, r.bulan, r.tahun, r.kode, r.namaBarang, r.jumlah, r.satuan, r.alokasi, r.detailAlokasi, r.pic,
      r.harga, r.totalHarga, r.noMr, r.keterangan, r.kodeBiaya, KODE_SEKSI[r.section], r.baris]);
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.font = { name: FONT, size: 10 };
      c.border = baru ? { ...BORDER, top: GARIS_MINGGU } : BORDER;
      c.alignment = { vertical: 'middle', horizontal: typeof c.value === 'number' ? 'right' : 'left' };
      if (pita % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F6F8' } };
      if (col === 1 && c.value instanceof Date) c.numFmt = 'dd-mmm-yyyy';
      if (col === 7) c.numFmt = '#,##0.##';
      if (col === 12 || col === 13) c.numFmt = FMT_RP;
    });
  });
  const lebarReport = [13, 8, 8, 8, 14, 44, 9, 9, 26, 28, 14, 16, 16, 12, 30, 8, 10, 28];
  lebarReport.forEach((w, i) => { wsRep.getColumn(i + 1).width = w; });
  wsRep.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: KOLOM_REPORT.length } };

  const akhir = Math.max(2, rows.length + 1);
  const rep = kutip(namaReport);
  const rng = (huruf: string) => `${rep}!$${huruf}$2:$${huruf}$${akhir}`;
  const RNG_TOTAL = rng('M'), RNG_MINGGU = rng('B'), RNG_SEKSI = rng('Q'), RNG_BARIS = rng('R');

  // ── 3. Sheet "Week <site>" — tabel template ──────────────────────────────────────────────────
  const periode = `${o.bulan ? `${NAMA_BULAN[o.bulan - 1]} ` : ''}${o.tahun}${o.minggu ? ` · Minggu ${o.minggu}` : ''}`;
  const kolomPertama = 4; // D
  const hurufTerakhir = hurufKolom(Math.max(kolomPertama, kolomPertama + weeks.length - 1));
  const huruf = (i: number) => hurufKolom(kolomPertama + i);

  wsWeek.getColumn(1).width = 14; wsWeek.getColumn(2).width = 36; wsWeek.getColumn(3).width = 20;
  weeks.forEach((_, i) => { wsWeek.getColumn(kolomPertama + i).width = 17; });

  const judul = wsWeek.getCell('B1');
  judul.value = `${o.judulSheet} ${periode}`;
  judul.font = { name: FONT, bold: true, size: 14, color: { argb: 'FF1F2937' } };

  let r = 3;
  const barisTotal = new Map<SeksiKey, number>();
  const setRp = (c: import('exceljs').Cell, f: string | null, hasil: number, tebal = false, warna?: string) => {
    c.value = f ? { formula: f, result: hasil } : hasil;
    c.numFmt = FMT_RP;
    c.alignment = { horizontal: 'right', vertical: 'middle' };
    c.font = { name: FONT, size: 10, bold: tebal, ...(warna ? { color: { argb: warna } } : {}) };
  };

  for (const s of seksi) {
    const tJudul = wsWeek.getCell(r, 2);
    tJudul.value = s.judul;
    tJudul.font = { name: FONT, bold: true, size: 11, color: { argb: WARNA_SEKSI[s.key] } };
    r++;
    const rowHeader = r;
    for (let c = 1; c <= kolomPertama + Math.max(weeks.length, 1) - 1; c++) {
      const cell = wsWeek.getCell(r, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HIJAU } };
      cell.font = { name: FONT, bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: c <= 2 ? 'left' : 'right', vertical: 'middle' };
      cell.border = BORDER;
    }
    wsWeek.getCell(r, 2).value = s.labelKolom;
    wsWeek.getCell(r, 3).value = 'Total';
    weeks.forEach((m, i) => { const c = wsWeek.getCell(r, kolomPertama + i); c.value = m; c.numFmt = '"W"0'; });
    r++;
    const awal = r;
    for (const b of s.baris) {
      const ada = weeks.reduce((t, m) => t + v(s.key, b.label, m), 0) !== 0;
      const a = wsWeek.getCell(r, 1); a.value = b.alias ?? s.kode ?? ''; a.font = { name: FONT, size: 9, color: { argb: 'FF64748B' } };
      const lab = wsWeek.getCell(r, 2); lab.value = b.label;
      lab.font = { name: FONT, size: 10, color: { argb: ada ? 'FF111827' : 'FF94A3B8' } };
      const total = weeks.reduce((t, m) => t + v(s.key, b.label, m), 0);
      setRp(wsWeek.getCell(r, 3), weeks.length ? `SUM(${huruf(0)}${r}:${hurufTerakhir}${r})` : null, total, true);
      weeks.forEach((m, i) => {
        const h = huruf(i);
        setRp(wsWeek.getCell(r, kolomPertama + i),
          `SUMIFS(${RNG_TOTAL},${RNG_SEKSI},"${KODE_SEKSI[s.key]}",${RNG_BARIS},$B${r},${RNG_MINGGU},${h}$${rowHeader})`, v(s.key, b.label, m));
      });
      for (let c = 1; c <= kolomPertama + Math.max(weeks.length, 1) - 1; c++) wsWeek.getCell(r, c).border = BORDER;
      r++;
    }
    const akhirBaris = r - 1;
    // Baris total seksi
    const tot = r;
    barisTotal.set(s.key, tot);
    wsWeek.getCell(tot, 2).value = s.totalLabel;
    const totalSemua = weeks.reduce((t, m) => t + totalSeksi(s, m), 0);
    setRp(wsWeek.getCell(tot, 3), akhirBaris >= awal ? `SUM(C${awal}:C${akhirBaris})` : null, totalSemua, true, WARNA_SEKSI[s.key]);
    weeks.forEach((m, i) => setRp(wsWeek.getCell(tot, kolomPertama + i), akhirBaris >= awal ? `SUM(${huruf(i)}${awal}:${huruf(i)}${akhirBaris})` : null, totalSeksi(s, m), true));
    for (let c = 1; c <= kolomPertama + Math.max(weeks.length, 1) - 1; c++) {
      const cell = wsWeek.getCell(tot, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_TOTAL[s.key] } };
      cell.border = BORDER;
      if (c <= 2) cell.font = { name: FONT, bold: true, size: 10 };
    }
    r += 2;
  }

  // Grand Total, Sales Order, Rp/m3
  const rGrand = r;
  const refTotal = (kol: string) => seksi.map((s) => `${kol}${barisTotal.get(s.key)}`).join('+');
  wsWeek.getCell(rGrand, 2).value = o.grandLabel;
  setRp(wsWeek.getCell(rGrand, 3), refTotal('C') || null, weeks.reduce((t, m) => t + grand(m), 0), true, 'FF0B6B4F');
  weeks.forEach((m, i) => setRp(wsWeek.getCell(rGrand, kolomPertama + i), refTotal(huruf(i)) || null, grand(m), true));
  for (let c = 1; c <= kolomPertama + Math.max(weeks.length, 1) - 1; c++) {
    const cell = wsWeek.getCell(rGrand, c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1EBDD' } };
    cell.border = { top: { style: 'medium', color: { argb: HIJAU } }, bottom: { style: 'medium', color: { argb: HIJAU } }, left: GARIS, right: GARIS };
    if (c <= 2) cell.font = { name: FONT, bold: true, size: 10.5 };
  }
  const rSo = rGrand + 1, rRp = rGrand + 2;
  wsWeek.getCell(rSo, 2).value = 'Total Sales Order/m3';
  wsWeek.getCell(rRp, 2).value = 'Rp/m3';
  for (const rr of [rSo, rRp]) wsWeek.getCell(rr, 2).font = { name: FONT, size: 10, color: { argb: 'FF475569' } };
  weeks.forEach((m, i) => {
    const so = wsWeek.getCell(rSo, kolomPertama + i);
    // Input (bukan rumus): volume penjualan dari menu Volume — warna biru sesuai kebiasaan sel input.
    so.value = (o.volumes[m] ?? 0) > 0 ? o.volumes[m] : null;
    so.numFmt = '#,##0;-#,##0;"-"'; so.alignment = { horizontal: 'right' };
    so.font = { name: FONT, size: 10, color: { argb: 'FF0000FF' } };
    const rp = wsWeek.getCell(rRp, kolomPertama + i);
    rp.value = { formula: `IF(N(${huruf(i)}${rSo})>0,${huruf(i)}${rGrand}/${huruf(i)}${rSo},0)`, result: rpPerM3(m) };
    rp.numFmt = FMT_RP_DESIMAL; rp.alignment = { horizontal: 'right' }; rp.font = { name: FONT, size: 10 };
  });
  r = rRp + 2;

  // Blok NB
  if (o.nb?.length) {
    wsWeek.getCell(r, 2).value = 'NB :';
    wsWeek.getCell(r, 2).font = { name: FONT, bold: true, size: 11 };
    r++;
    for (const n of o.nb) {
      wsWeek.getCell(r, 2).value = n.teks;
      wsWeek.getCell(r, 2).font = { name: FONT, size: 10, color: { argb: 'FF475569' } };
      const s = n.seksi ? seksi.find((x) => x.key === n.seksi) : undefined;
      const tr = s ? barisTotal.get(s.key) : undefined;
      let f: string | null = null, hasil = 0;
      if (n.jenis === 'grand') { f = `C${rGrand}`; hasil = weeks.reduce((t, m) => t + grand(m), 0); }
      else if (n.jenis === 'terakhir') {
        if (weeks.length) { f = `${huruf(weeks.length - 1)}${rGrand}`; hasil = grand(weeks[weeks.length - 1]); }
      } else if (n.jenis === 'rataGrand') {
        if (weeks.length) { f = `AVERAGE(${huruf(0)}${rGrand}:${hurufTerakhir}${rGrand})`; hasil = weeks.reduce((t, m) => t + grand(m), 0) / weeks.length; }
      } else if (s && tr) {
        if (n.jenis === 'total') { f = `C${tr}`; hasil = weeks.reduce((t, m) => t + totalSeksi(s, m), 0); }
        else if (weeks.length) { f = `AVERAGE(${huruf(0)}${tr}:${hurufTerakhir}${tr})`; hasil = weeks.reduce((t, m) => t + totalSeksi(s, m), 0) / weeks.length; }
      } else if (n.seksi) hasil = 0; // seksi tak ada di template site ini → 0
      r++;
      setRp(wsWeek.getCell(r, 3), f, hasil, true);
      r += 2;
    }
  }

  // ── 4. Sheet "Per Minggu" — rekap mingguan ──────────────────────────────────────────────────
  const kolomRekap = ['Minggu', ...seksi.map((s) => s.labelKolom), o.grandLabel, 'Jumlah Transaksi', 'Total Sales Order/m3', 'Rp/m3'];
  const rk = wsRekap.addRow(kolomRekap);
  rk.height = 30;
  rk.eachCell((c) => {
    c.font = { name: FONT, bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HIJAU } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = BORDER;
  });
  const nS = seksi.length;
  const cGrand = 2 + nS, cTrans = cGrand + 1, cSo = cTrans + 1, cRp = cSo + 1;
  weeks.forEach((m, i) => {
    const rr = i + 2;
    const row = wsRekap.getRow(rr);
    row.getCell(1).value = m; row.getCell(1).numFmt = '"W"0'; row.getCell(1).font = { name: FONT, bold: true, size: 10 };
    seksi.forEach((s, j) => {
      setRp(row.getCell(2 + j), `SUMIFS(${RNG_TOTAL},${RNG_SEKSI},"${KODE_SEKSI[s.key]}",${RNG_MINGGU},$A${rr})`, totalSeksi(s, m));
    });
    setRp(row.getCell(cGrand), `SUM(B${rr}:${hurufKolom(1 + nS)}${rr})`, grand(m), true);
    const nTrans = rows.filter((x) => x.minggu === m).length;
    row.getCell(cTrans).value = { formula: `COUNTIFS(${RNG_MINGGU},$A${rr})`, result: nTrans };
    row.getCell(cTrans).numFmt = '#,##0'; row.getCell(cTrans).font = { name: FONT, size: 10 };
    const so = row.getCell(cSo);
    so.value = (o.volumes[m] ?? 0) > 0 ? o.volumes[m] : null; so.numFmt = '#,##0;-#,##0;"-"';
    so.font = { name: FONT, size: 10, color: { argb: 'FF0000FF' } };
    const rp = row.getCell(cRp);
    rp.value = { formula: `IF(N(${hurufKolom(cSo)}${rr})>0,${hurufKolom(cGrand)}${rr}/${hurufKolom(cSo)}${rr},0)`, result: rpPerM3(m) };
    rp.numFmt = FMT_RP_DESIMAL; rp.font = { name: FONT, size: 10 };
    for (let c = 1; c <= cRp; c++) { row.getCell(c).border = BORDER; if (c > 1) row.getCell(c).alignment = { horizontal: 'right' }; }
    if (i % 2 === 1) for (let c = 1; c <= cRp; c++) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F6F8' } };
  });
  if (weeks.length) {
    const a = 2, z = weeks.length + 1, rt = z + 1, rp = z + 2;
    const rowT = wsRekap.getRow(rt);
    rowT.getCell(1).value = 'Total';
    const hasilKolom: number[] = [];
    seksi.forEach((s, j) => {
      const h = hurufKolom(2 + j);
      const t = weeks.reduce((x, m) => x + totalSeksi(s, m), 0);
      hasilKolom.push(t);
      setRp(rowT.getCell(2 + j), `SUM(${h}${a}:${h}${z})`, t, true);
    });
    const totalGrand = weeks.reduce((x, m) => x + grand(m), 0);
    setRp(rowT.getCell(cGrand), `SUM(${hurufKolom(cGrand)}${a}:${hurufKolom(cGrand)}${z})`, totalGrand, true);
    rowT.getCell(cTrans).value = { formula: `SUM(${hurufKolom(cTrans)}${a}:${hurufKolom(cTrans)}${z})`, result: rows.length };
    rowT.getCell(cTrans).numFmt = '#,##0'; rowT.getCell(cTrans).font = { name: FONT, size: 10, bold: true };
    for (let c = 1; c <= cRp; c++) {
      const cell = rowT.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1EBDD' } };
      cell.border = { top: { style: 'medium', color: { argb: HIJAU } }, bottom: GARIS, left: GARIS, right: GARIS };
      if (c === 1) cell.font = { name: FONT, bold: true, size: 10 };
    }
    // Porsi tiap seksi terhadap Grand Total
    const rowP = wsRekap.getRow(rp);
    rowP.getCell(1).value = 'Porsi (%)'; rowP.getCell(1).font = { name: FONT, size: 10, italic: true, color: { argb: 'FF475569' } };
    for (let c = 2; c <= cGrand; c++) {
      const h = hurufKolom(c);
      const hasil = totalGrand ? (c === cGrand ? totalGrand : hasilKolom[c - 2]) / totalGrand : 0;
      const cell = rowP.getCell(c);
      cell.value = { formula: `IF(${hurufKolom(cGrand)}${rt}=0,0,${h}${rt}/${hurufKolom(cGrand)}${rt})`, result: hasil };
      cell.numFmt = '0.0%'; cell.font = { name: FONT, size: 10, italic: true, color: { argb: 'FF475569' } }; cell.alignment = { horizontal: 'right' };
    }
  }
  wsRekap.getColumn(1).width = 12;
  for (let c = 2; c <= cRp; c++) wsRekap.getColumn(c).width = c === cTrans ? 14 : 19;

  // Catatan kecil di Report: arti dua kolom kunci.
  wsRep.getCell(1, 17).note = `Kunci SUMIFS sheet Week & Per Minggu: ${seksi.map((s) => `${KODE_SEKSI[s.key]} = ${s.judul}`).join(', ')}.`;
  wsRep.getCell(1, 18).note = 'Nama baris di sheet Week tempat transaksi ini dijumlahkan. Ubah nilainya di sini bila ingin memindahkan transaksi ke baris lain — angka di sheet Week ikut berubah.';

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}