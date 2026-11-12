// Template, export, dan pembaca file import untuk PICA.
//
// Tata letak kolom sengaja SAMA dengan sheet PICA di Google Sheets (NO, DATE, PROBLEM, IDENTIFICATION,
// DESCRIPTION, kolom Week …, TARGET DATE, PIC, STATUS) — tim lapangan sudah terbiasa dengan urutan itu,
// dan isi sheet bisa ditempel langsung ke template. Kolom yang hanya ada di aplikasi (KATEGORI, SUMBER)
// ditaruh di paling kanan supaya tidak mengganggu urutan tersebut.
//
// Pembaca file mencari baris judul lewat teks "PROBLEM" + "DATE" (bukan nomor baris tetap) dan memetakan
// kolom lewat judulnya — jadi aman kalau pengguna menyisipkan baris/kolom, atau menambah kolom Week baru.
import type { CellValue, DataValidation } from 'exceljs';

export const PICA_STATUS = ['On Going', 'Close', 'Overdue'] as const;

export interface PicaUpdateExcel { week: string; catatan: string }

/** Isu PICA seperti dikirim API (/pica). */
export interface PicaItem {
  id: string; site: string; no: string; tanggal: string | null;
  problem: string; identifikasi: string; deskripsi: string;
  targetDate: string | null; pic: string; status: string;
  updates: { week: string; catatan: string }[]; latestWeek: string; latestNote: string;
  /** 'manual' = diinput lewat aplikasi/Excel (bisa diubah); 'sheet' = ditarik dari Google Sheet (hanya baca). */
  origin?: 'manual' | 'sheet'; kategori?: string;
}

/** Satu isu dalam bentuk yang dipakai template (juga bentuk kiriman import ke server). */
export interface BarisPica {
  baris?: number;               // nomor baris di Excel (untuk pesan galat)
  no: string; tanggal: string; problem: string; identifikasi: string; deskripsi: string;
  targetDate: string; pic: string; status: string; kategori: string;
  updates: PicaUpdateExcel[];
  origin?: string;              // hanya untuk export ("manual" / "sheet")
}

// ── Penomoran minggu ──────────────────────────────────────────────────────
// Sheet laporan memakai nomor minggu awal-Senin (WEEKNUM tipe 2): Week 1 memuat 1 Januari.
export function nomorMingguDari(d: Date = new Date()): number {
  const hari = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 86_400_000);
  const senin0 = (new Date(d.getFullYear(), 0, 1).getDay() + 6) % 7; // 0 = Senin
  return Math.floor((hari + senin0) / 7) + 1;
}
export const labelMinggu = (n: number) => `Week ${String(n).padStart(2, '0')}`;
export const nomorDariLabel = (label: string) => Number(/(\d+)/.exec(label)?.[1] ?? 0);

// ── Pembantu tampilan sel ─────────────────────────────────────────────────
const HIJAU = 'FF0B6B4F';
const TEAL = 'FF0E7490';
const ABU = 'FF667085';
const GARIS = 'FFBFC7D1';
const FONT = 'Calibri';

const garisTipis = { style: 'thin' as const, color: { argb: GARIS } };
const kotak = { top: garisTipis, left: garisTipis, bottom: garisTipis, right: garisTipis };

const isoKeDate = (iso: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
};
const dateKeIso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

interface KolomDef { kunci: string; judul: string; lebar: number; jenis: 'teks' | 'tanggal' | 'minggu' | 'info'; }

function susunKolom(minggu: string[], denganSumber: boolean): KolomDef[] {
  return [
    { kunci: 'no', judul: 'NO', lebar: 7, jenis: 'teks' },
    { kunci: 'tanggal', judul: 'DATE', lebar: 13, jenis: 'tanggal' },
    { kunci: 'problem', judul: 'PROBLEM', lebar: 38, jenis: 'teks' },
    { kunci: 'identifikasi', judul: 'IDENTIFICATION', lebar: 32, jenis: 'teks' },
    { kunci: 'deskripsi', judul: 'DESCRIPTION', lebar: 46, jenis: 'teks' },
    ...minggu.map((w): KolomDef => ({ kunci: `minggu:${w}`, judul: w, lebar: 30, jenis: 'minggu' })),
    { kunci: 'targetDate', judul: 'TARGET DATE', lebar: 13, jenis: 'tanggal' },
    { kunci: 'pic', judul: 'PIC', lebar: 15, jenis: 'teks' },
    { kunci: 'status', judul: 'STATUS', lebar: 12, jenis: 'teks' },
    { kunci: 'kategori', judul: 'KATEGORI', lebar: 19, jenis: 'teks' },
    ...(denganSumber ? [{ kunci: 'sumber', judul: 'SUMBER', lebar: 14, jenis: 'info' as const }] : []),
  ];
}

const huruf = (n: number) => { let s = ''; for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s; return s; };

export interface OpsiBuatExcel {
  namaSite: string;
  /** Kosong = template isian; terisi = export isu yang ada. */
  isu?: BarisPica[];
  /** Judul kolom minggu (mis. ["Week 43", …]). Export memakai semua minggu yang ada di data. */
  minggu: string[];
  /** Daftar kategori resmi (diatur Super Admin) — jadi dropdown di kolom KATEGORI. */
  kategori: string[];
}

/** Workbook berisi sheet "PICA" (data) dan "Petunjuk". Dipakai sama untuk template kosong maupun export. */
export async function buatExcelPica({ namaSite, isu, minggu, kategori }: OpsiBuatExcel): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Reethau Inventory';
  wb.created = new Date();

  const adaData = !!isu;
  const kolom = susunKolom(minggu, adaData);
  const ws = wb.addWorksheet('PICA', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 4, showGridLines: false }],
    properties: { defaultRowHeight: 18 },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, printTitlesRow: '4:4',
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
  });
  ws.columns = kolom.map((k) => ({ width: k.lebar }));

  // Judul
  const akhir = kolom.length;
  ws.mergeCells(1, 1, 1, Math.min(akhir, 8));
  const judul = ws.getCell(1, 1);
  judul.value = `PICA — ${namaSite}`;
  judul.font = { name: FONT, size: 15, bold: true, color: { argb: HIJAU } };
  judul.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 26;
  ws.mergeCells(2, 1, 2, Math.min(akhir, 8));
  const sub = ws.getCell(2, 1);
  sub.value = adaData
    ? `Problem · Identification · Corrective Action — diekspor ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}, ${isu!.length} isu`
    : 'Problem · Identification · Corrective Action — template isian. Cara pengisian ada di sheet “Petunjuk”.';
  sub.font = { name: FONT, size: 10, color: { argb: ABU } };

  // Header
  const BARIS_HEADER = 4;
  const hr = ws.getRow(BARIS_HEADER);
  hr.height = 30;
  kolom.forEach((k, i) => {
    const c = hr.getCell(i + 1);
    c.value = k.judul;
    const warna = k.jenis === 'minggu' ? TEAL : k.jenis === 'info' ? ABU : HIJAU;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: warna } };
    c.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = kotak;
  });

  // Isi
  const BARIS_AWAL = BARIS_HEADER + 1;
  const jumlahIsi = adaData ? isu!.length : 0;
  // Ruang kosong ber-validasi di bawah data supaya baris baru langsung bisa diisi.
  const jumlahBaris = jumlahIsi + (adaData ? 40 : 60);
  const idx = (kunci: string) => kolom.findIndex((k) => k.kunci === kunci) + 1;

  for (let i = 0; i < jumlahBaris; i++) {
    const r = ws.getRow(BARIS_AWAL + i);
    const d = i < jumlahIsi ? isu![i] : null;
    kolom.forEach((k, ci) => {
      const c = r.getCell(ci + 1);
      c.border = kotak;
      c.font = { name: FONT, size: 10, ...(k.jenis === 'info' ? { color: { argb: ABU } } : {}) };
      c.alignment = { vertical: 'top', wrapText: k.jenis !== 'tanggal', horizontal: k.jenis === 'tanggal' || k.kunci === 'no' ? 'center' : 'left' };
      if (k.jenis === 'tanggal') c.numFmt = 'dd-mmm-yyyy';
      if (!d) return;
      if (k.jenis === 'minggu') c.value = d.updates.find((u) => u.week === k.judul)?.catatan || null;
      else if (k.jenis === 'tanggal') c.value = isoKeDate(d[k.kunci as 'tanggal' | 'targetDate']) ?? null;
      else if (k.kunci === 'sumber') c.value = d.origin === 'manual' ? 'Input manual' : 'Google Sheet';
      else if (k.kunci === 'no') c.value = /^\d+$/.test(d.no) ? Number(d.no) : d.no;
      else c.value = (d as unknown as Record<string, string>)[k.kunci] || null;
    });
  }
  const barisAkhir = BARIS_AWAL + jumlahBaris - 1;
  const rentang = (kunci: string) => `${huruf(idx(kunci))}${BARIS_AWAL}:${huruf(idx(kunci))}${barisAkhir}`;

  // Validasi isian
  const status = rentang('status'), kategoriRentang = rentang('kategori');
  const terapkan = (alamat: string, v: DataValidation) => {
    const [a, b] = alamat.split(':');
    const kolomHuruf = a.replace(/\d+/g, '');
    const dari = Number(a.replace(/\D+/g, '')), sampai = Number(b.replace(/\D+/g, ''));
    for (let r = dari; r <= sampai; r++) ws.getCell(`${kolomHuruf}${r}`).dataValidation = v;
  };
  terapkan(status, { type: 'list', allowBlank: true, formulae: [`"${PICA_STATUS.join(',')}"`],
    showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Status', error: `Pilih salah satu: ${PICA_STATUS.join(', ')}.` });
  // Daftar kategori ditaruh di sheet tersembunyi "Daftar": jumlahnya bebas (rumus daftar langsung dibatasi 255 karakter),
  // dan nama yang memuat koma tetap aman.
  if (kategori.length) {
    const dft = wb.addWorksheet('Daftar', { state: 'hidden' });
    dft.getCell('A1').value = 'Kategori';
    kategori.forEach((k, i) => { dft.getCell(i + 2, 1).value = k; });
    terapkan(kategoriRentang, { type: 'list', allowBlank: true, formulae: [`Daftar!$A$2:$A$${kategori.length + 1}`],
      showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Kategori', error: 'Pilih salah satu dari daftar kategori.' });
  }
  for (const kunci of ['tanggal', 'targetDate']) {
    terapkan(rentang(kunci), { type: 'date', operator: 'greaterThan', allowBlank: true, formulae: [new Date(Date.UTC(2000, 0, 1))],
      showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Tanggal', error: 'Isi tanggal yang valid, mis. 17/05/2026.' });
  }

  // Warna status (pembeda tambahan di luar teks)
  ws.addConditionalFormatting({ ref: status, rules: [
    { type: 'cellIs', operator: 'equal', formulae: ['"Close"'], priority: 1, style: { font: { color: { argb: 'FF0B6B4F' }, bold: true }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFE3F4EC' } } } },
    { type: 'cellIs', operator: 'equal', formulae: ['"Overdue"'], priority: 2, style: { font: { color: { argb: 'FFB42318' }, bold: true }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFDE7E5' } } } },
    { type: 'cellIs', operator: 'equal', formulae: ['"On Going"'], priority: 3, style: { font: { color: { argb: 'FF8A5A00' } }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFF3D6' } } } },
  ] });

  ws.autoFilter = { from: { row: BARIS_HEADER, column: 1 }, to: { row: barisAkhir, column: kolom.length } };

  // ── Sheet Petunjuk ──────────────────────────────────────────────────────
  const pt = wb.addWorksheet('Petunjuk', {
    views: [{ showGridLines: false }], properties: { defaultRowHeight: 18 },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  pt.columns = [{ width: 20 }, { width: 11 }, { width: 92 }];
  pt.mergeCells('A1:C1');
  pt.getCell('A1').value = 'Cara mengisi template PICA';
  pt.getCell('A1').font = { name: FONT, size: 15, bold: true, color: { argb: HIJAU } };
  pt.getRow(1).height = 26;

  const barisPt: [string, string, string][] = [
    ['Kolom', 'Wajib', 'Isi'],
    ['NO', 'Tidak', 'Kosongkan untuk isu baru — nomor dibuat otomatis. Isi nomor yang sudah ada untuk memperbarui isu yang dulu diinput lewat aplikasi.'],
    ['DATE', 'Ya', 'Tanggal isu ditemukan. Contoh: 17/05/2026 atau 17-Mei-2026.'],
    ['PROBLEM', 'Ya', 'Masalahnya dalam satu kalimat singkat (maks. 500 karakter). Rinciannya taruh di Description.'],
    ['IDENTIFICATION', 'Tidak', 'Penyebab atau hasil identifikasi masalah.'],
    ['DESCRIPTION', 'Tidak', 'Tindakan korektif yang direncanakan atau sedang dijalankan. Kalau ada beberapa langkah, tulis bernomor: 1. … 2. …'],
    ['Week NN', 'Tidak', 'Catatan perkembangan pada minggu itu. Untuk minggu berikutnya, sisipkan kolom baru sebelum TARGET DATE dengan judul seperti “Week 47”. Catatan terbaru yang tampil di aplikasi adalah minggu dengan nomor terbesar yang terisi.'],
    ['TARGET DATE', 'Tidak', 'Batas waktu penyelesaian. Tidak boleh lebih awal dari DATE.'],
    ['PIC', 'Tidak', 'Penanggung jawab isu.'],
    ['STATUS', 'Tidak', `Pilih ${PICA_STATUS.join(' / ')}. Kosong dianggap On Going.`],
    ['KATEGORI', 'Tidak', kategori.length ? `Pilih dari daftar: ${kategori.join(', ')}. Daftar diatur Super Admin di aplikasi.` : 'Belum ada kategori yang diatur di aplikasi.'],
    ['SUMBER', '—', 'Hanya ada pada hasil Export, menunjukkan isu input manual atau dari Google Sheet. Diabaikan saat import.'],
  ];
  barisPt.forEach((b, i) => {
    const r = pt.getRow(3 + i);
    r.height = Math.max(20, Math.ceil(b[2].length / 88) * 14 + 8);
    b.forEach((v, ci) => {
      const c = r.getCell(ci + 1);
      c.value = v;
      c.border = kotak;
      c.alignment = { vertical: 'top', wrapText: true, horizontal: ci === 1 ? 'center' : 'left' };
      c.font = i === 0 ? { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } } : { name: FONT, size: 10, bold: ci === 0 };
      if (i === 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HIJAU } };
    });
  });
  const mulaiAturan = 3 + barisPt.length + 1;
  pt.getCell(`A${mulaiAturan}`).value = 'Yang perlu diperhatikan';
  pt.getCell(`A${mulaiAturan}`).font = { name: FONT, size: 11, bold: true, color: { argb: HIJAU } };
  [
    'Satu baris = satu isu. Jangan mengubah atau menghapus judul kolom.',
    'Import hanya menambah dan memperbarui. Menghapus baris di Excel tidak menghapus isu di aplikasi.',
    'Isu yang bersumber dari Google Sheet tidak bisa diubah lewat import — ubah di sheet-nya. Baris seperti itu akan ditolak.',
    'Baris yang bermasalah ditolak beserta alasannya; baris lain tetap diproses. Sebelum diterapkan, hasilnya ditampilkan dulu untuk dicek.',
    'Catatan minggu yang sama akan ditimpa dengan isi file. Minggu yang tidak ada di file dibiarkan seperti semula.',
    'Mengimpor file yang sama dua kali tidak menggandakan isu (dikenali dari NO, atau dari DATE + PROBLEM yang sama).',
  ].forEach((t, i) => {
    pt.mergeCells(`A${mulaiAturan + 1 + i}:C${mulaiAturan + 1 + i}`);
    const c = pt.getCell(`A${mulaiAturan + 1 + i}`);
    c.value = `${i + 1}.  ${t}`;
    c.alignment = { vertical: 'top', wrapText: true };
    c.font = { name: FONT, size: 10 };
    pt.getRow(mulaiAturan + 1 + i).height = Math.max(20, Math.ceil(t.length / 120) * 14 + 8);
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ── Pembaca file import ───────────────────────────────────────────────────
const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

function teksSel(v: CellValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return dateKeIso(v);
  if (typeof v === 'object') {
    const o = v as unknown as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join('');
    if ('result' in o) return teksSel(o.result as CellValue);
    if ('text' in o) return String(o.text ?? '');
    if ('error' in o) return '';
  }
  return String(v).trim();
}

const POLA_MINGGU = /^(week|minggu|wk|mg)\s*0*\d{1,2}$/;

export class GalatTemplatePica extends Error {}

/** Baca file .xlsx hasil Template / Export. Melempar GalatTemplatePica dengan pesan yang bisa langsung ditampilkan. */
export async function bacaExcelPica(buffer: ArrayBuffer): Promise<BarisPica[]> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buffer); } catch { throw new GalatTemplatePica('File tidak bisa dibuka. Pastikan formatnya Excel (.xlsx), bukan .xls atau CSV.'); }
  const ws = wb.worksheets.find((s) => norm(s.name).startsWith('pica')) ?? wb.worksheets[0];
  if (!ws) throw new GalatTemplatePica('File tidak berisi sheet.');

  // Baris judul = baris pertama (dalam 20 baris awal) yang memuat PROBLEM dan DATE.
  let barisJudul = 0;
  const petaKolom = new Map<string, number>();
  const kolomMinggu: { c: number; label: string }[] = [];
  for (let r = 1; r <= Math.min(20, ws.rowCount) && !barisJudul; r++) {
    const judul = new Map<string, number>();
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, c) => judul.set(norm(teksSel(cell.value)), c));
    if (judul.has('problem') && (judul.has('date') || judul.has('tanggal'))) {
      barisJudul = r;
      judul.forEach((c, h) => {
        if (POLA_MINGGU.test(h)) kolomMinggu.push({ c, label: `Week ${/\d+/.exec(h)![0]}` });
        else petaKolom.set(h === 'tanggal' ? 'date' : h, c);
      });
    }
  }
  if (!barisJudul) {
    throw new GalatTemplatePica('Baris judul tidak ditemukan. Kolom “DATE” dan “PROBLEM” harus ada — gunakan template dari tombol “Template”.');
  }
  const alias = (...nama: string[]) => nama.map((n) => petaKolom.get(n)).find((c) => c !== undefined);
  const kol = {
    no: alias('no', 'nomor'), tanggal: alias('date'), problem: alias('problem'),
    identifikasi: alias('identification', 'identifikasi'), deskripsi: alias('description', 'deskripsi', 'corrective action'),
    targetDate: alias('target date'), pic: alias('pic'), status: alias('status'), kategori: alias('kategori', 'category'),
  };
  const ambil = (r: number, c?: number) => (c ? teksSel(ws.getCell(r, c).value) : '');

  const hasil: BarisPica[] = [];
  for (let r = barisJudul + 1; r <= ws.rowCount; r++) {
    const b: BarisPica = {
      baris: r, no: ambil(r, kol.no), tanggal: ambil(r, kol.tanggal), problem: ambil(r, kol.problem),
      identifikasi: ambil(r, kol.identifikasi), deskripsi: ambil(r, kol.deskripsi), targetDate: ambil(r, kol.targetDate),
      pic: ambil(r, kol.pic), status: ambil(r, kol.status), kategori: ambil(r, kol.kategori),
      updates: kolomMinggu.map(({ c, label }) => ({ week: label, catatan: ambil(r, c) })).filter((u) => u.catatan),
    };
    // Baris yang sepenuhnya kosong (ruang isian template yang tak dipakai) dilewati.
    const isi = [b.no, b.tanggal, b.problem, b.identifikasi, b.deskripsi, b.targetDate, b.pic, b.updates.length ? 'x' : ''].some(Boolean);
    if (isi) hasil.push(b);
  }
  return hasil;
}

/** Unduh Blob sebagai berkas. */
export function simpanBerkas(blob: Blob, namaFile: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = namaFile;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}