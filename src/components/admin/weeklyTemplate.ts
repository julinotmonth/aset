// Template laporan Barang Keluar per site — disalin dari file
// "Report Weekly All MS_WS_RET (Week 45).xlsx", sheet "Week MS Wunut", "Week MS Blora",
// "Week MS KHT", "Week MS SETU", "Week LNG Sngkurilang" dan "Week RET".
//
// Isi: urutan & nama baris tiap seksi, judul seksi, nama baris total, dan nama Grand Total persis
// seperti di sheet Excel. Baris di Excel diisi lewat SUMIFS(Total Harga; Alokasi = nama baris;
// Minggu = kolom; kode MH/OH/OLI/R/...), jadi di sini baris juga dicocokkan lewat nama Alokasi.
//
// Daftar baris di bawah DIGENERATE dari file Excel — kalau template Excel berubah (unit mesin
// baru, dst), ubah di sini juga.

export type SeksiKey = 'MAINT' | 'OH' | 'OLI' | 'LAIN' | 'ISOTANK';

export interface BarisTemplate {
  label: string;
  /** Nama lain yang dikenali untuk baris yang sama (mis. nomor ISO Tank "IT-01" ↔ kode kontainer). */
  alias?: string;
}

export interface SeksiTemplate {
  key: SeksiKey;
  /** Judul di atas tabel seksi (mis. "Part Maintenance Per-Week"). */
  judul: string;
  /** Judul kolom pertama (mis. "Overhold" / "Overhaul" / "Oil Consumption"). */
  labelKolom: string;
  /** Nama baris total seksi (mis. "Total Harga OH"). */
  totalLabel: string;
  baris: BarisTemplate[];
}

export interface TemplateSite {
  /** Sheet asal di file Excel — hanya untuk dokumentasi. */
  sumber: string;
  /** Judul sheet di Excel, mis. "Inventory MS Wunut" (tahun ditambahkan saat tampil). */
  judulSheet: string;
  seksi: SeksiTemplate[];
  grandLabel: string;
  /** Kata yang dipakai di blok "NB :" Excel ("Overhold" vs "Overhaul", "Pemakaian OLI" vs "OLI"). */
  namaOH?: string;
  namaOLI?: string;
}

export type KunciTemplate = 'wunut' | 'blora' | 'kht' | 'setu' | 'sangkulirang' | 'ret';

export const TEMPLATE_SITE: Record<KunciTemplate, TemplateSite> = {
  wunut: {
    sumber: "Week MS Wunut", judulSheet: "Inventory MS Wunut", grandLabel: "Grand Total Price",
    namaOH: "Overhold", namaOLI: "Pemakaian OLI",
    seksi: [
      {
        key: "MAINT", judul: "Part Maintenance Per-Week", labelKolom: "Maintenance", totalLabel: "Total Harga",
        baris: [
          { label: "Compressor Ariel 1" }, { label: "Compressor Ariel 2" }, { label: "Compressor Ariel 3" },
          { label: "Gas Engine Caterpillar 1" }, { label: "Gas Engine Caterpillar 2" },
          { label: "Gas Engine Caterpillar 3" }, { label: "Air Compressor" }, { label: "Dispenser Filling Post" },
          { label: "Dryer Xebec" }, { label: "Control Panel" }, { label: "Genset" }, { label: "OTHERS" },
          { label: "Metering" },
        ],
      },
      {
        key: "OH", judul: "Penggunaan Part OH Per-Week", labelKolom: "Overhold", totalLabel: "Total Harga OH",
        baris: [
          { label: "Compressor Ariel 1" }, { label: "Compressor Ariel 2" }, { label: "Compressor Ariel 3" },
          { label: "Gas Engine Caterpillar 1" }, { label: "Gas Engine Caterpillar 2" },
          { label: "Gas Engine Caterpillar 3" }, { label: "Dryer" },
        ],
      },
      {
        key: "OLI", judul: "Consumption OLI Per-Week", labelKolom: "Consumption OLI", totalLabel: "Total Harga Comp OLI",
        baris: [
          { label: "Compressor Ariel 1" }, { label: "Compressor Ariel 2" }, { label: "Compressor Ariel 3" },
          { label: "Gas Engine Caterpillar 1" }, { label: "Gas Engine Caterpillar 2" },
          { label: "Gas Engine Caterpillar 3" }, { label: "Dryer" },
        ],
      },
      {
        key: "LAIN", judul: "Lain-Lain Per-Week", labelKolom: "Lain-Lain", totalLabel: "Total Harga Lain-Lain",
        baris: [
          { label: "Jasa Service & Repair" }, { label: "Jasa New Instalasi" }, { label: "Jasa Kalibrasi" },
          { label: "Sedot Limbah B3" }, { label: "Jasa Analisa GAS" }, { label: "Jasa Analisa OLI" },
          { label: "OTHERS" },
        ],
      },
    ],
  },
  blora: {
    sumber: "Week MS Blora", judulSheet: "Inventory MS Blora", grandLabel: "Grand Total Harga",
    namaOH: "Overhold", namaOLI: "OLI",
    seksi: [
      {
        key: "MAINT", judul: "Penggunaan Part Per-Week", labelKolom: "Maintenance", totalLabel: "Total Harga",
        baris: [
          { label: "Compressor Enric 1" }, { label: "Compressor Enric 2" }, { label: "Compressor IMW" },
          { label: "Air Comp. Multipro" }, { label: "Dispenser Filling Post" }, { label: "Dryer" },
          { label: "Genset CAT" }, { label: "Control Panel" }, { label: "Tools" }, { label: "Other" },
        ],
      },
      {
        key: "OH", judul: "Penggunaan Part OH Per-Week", labelKolom: "Overhold", totalLabel: "Total Harga",
        baris: [
          { label: "Compressor Enric 1" }, { label: "Compressor Enric 2" }, { label: "Compressor IMW" },
          { label: "Dryer" },
        ],
      },
      {
        key: "OLI", judul: "Consumption OLI Per-Week", labelKolom: "Consumption OLI", totalLabel: "Total Harga",
        baris: [
          { label: "Compressor Enric 1" }, { label: "Compressor Enric 2" }, { label: "Compressor IMW" },
          { label: "Dryer" },
        ],
      },
      {
        key: "LAIN", judul: "Lain-Lain Per-Week", labelKolom: "Lain-Lain", totalLabel: "Total Harga",
        baris: [
          { label: "Jasa Service & Repair" }, { label: "Jasa New Instalasi" }, { label: "Sedot Limbah B3" },
          { label: "Jasa Analisa GAS" }, { label: "OTHERS" },
        ],
      },
    ],
  },
  kht: {
    sumber: "Week MS KHT", judulSheet: "Inventory MS KHT", grandLabel: "Grand Total Harga",
    namaOH: "Overhaul", namaOLI: "Pemakaian OLI",
    seksi: [
      {
        key: "MAINT", judul: "PM Per-Week", labelKolom: "Maintenance", totalLabel: "Total Harga",
        baris: [
          { label: "Compressor Adekom 1" }, { label: "Compressor Adekom 2" }, { label: "Compressor Cubogas 1000" },
          { label: "Compressor Cubogas 2000" }, { label: "Dispenser Filling Post" }, { label: "Dryer Adekom" },
          { label: "Dryer Enric" }, { label: "Genset" }, { label: "Metering" }, { label: "Scrubber" },
          { label: "Control Panel" }, { label: "OTHER" },
        ],
      },
      {
        key: "OH", judul: "Penggunaan Part OH Per-Week", labelKolom: "Overhaul", totalLabel: "Total Harga",
        baris: [
          { label: "Compressor Adekom 1" }, { label: "Compressor Adekom 2" }, { label: "Dryer Adekom" },
          { label: "Dryer Enric" }, { label: "Compressor Cubogas 1000" }, { label: "Compressor Cubogas 2000" },
        ],
      },
      {
        key: "OLI", judul: "Consumption OLI Per-Week", labelKolom: "Oil Consumption", totalLabel: "Total Harga",
        baris: [
          { label: "Compressor Adekom 1" }, { label: "Compressor Adekom 2" }, { label: "Compressor Cubogas 1000" },
          { label: "Compressor Cubogas 2000" }, { label: "Dryer Adekom" }, { label: "Dryer Enric" },
        ],
      },
      {
        key: "LAIN", judul: "Lain-Lain Per-Week", labelKolom: "Lain-Lain", totalLabel: "Total Harga",
        baris: [
          { label: "Jasa Service & Repair" }, { label: "Jasa New Instalasi" }, { label: "Jasa Kalibrasi" },
          { label: "Sedot Limbah B3" }, { label: "Jasa Analisa GAS" }, { label: "OTHER" },
        ],
      },
    ],
  },
  setu: {
    sumber: "Week MS SETU", judulSheet: "Inventory MS SETU", grandLabel: "Grand Total Price",
    namaOH: "Overhold", namaOLI: "Pemakaian OLI",
    seksi: [
      {
        key: "MAINT", judul: "Part Maintenance Per-Week", labelKolom: "Maintenance", totalLabel: "Total Harga",
        baris: [
          { label: "Compressor Ariel 1" }, { label: "Compressor Ariel 2" }, { label: "Compressor Enric" },
          { label: "Gas Engine Doosan 1" }, { label: "Gas Engine Doosan 2" }, { label: "Dispenser Filling Post" },
          { label: "Air Compressor" }, { label: "Genset" }, { label: "Dryer Xebec" }, { label: "LVMDB" },
          { label: "OTHER" }, { label: "Metering (project)" },
        ],
      },
      {
        key: "OH", judul: "Penggunaan Part OH Per-Week", labelKolom: "Overhold", totalLabel: "Total Harga OH",
        baris: [
          { label: "Compressor Ariel 1" }, { label: "Compressor Ariel 2" }, { label: "Compressor Enric" },
          { label: "Gas Engine Doosan 1" }, { label: "Gas Engine Doosan 2" }, { label: "Dryer" },
          { label: "Genset" },
        ],
      },
      {
        key: "OLI", judul: "Consumption OLI Per-Week", labelKolom: "Consumption OLI", totalLabel: "Total Harga Comp OLI",
        baris: [
          { label: "Compressor Ariel 1" }, { label: "Compressor Ariel 2" }, { label: "Compressor Enric" },
          { label: "Gas Engine Doosan 1" }, { label: "Gas Engine Doosan 2" }, { label: "Dryer" },
        ],
      },
      {
        key: "LAIN", judul: "Lain-Lain Per-Week", labelKolom: "Lain-Lain", totalLabel: "Total Harga Lain-Lain",
        baris: [
          { label: "Jasa Service & Repair" }, { label: "Jasa New Instalasi" }, { label: "Jasa Kalibrasi" },
          { label: "Sedot Limbah B3" }, { label: "Jasa Analisa GAS" }, { label: "Jasa Analisa OLI" },
          { label: "OTHERS" },
        ],
      },
    ],
  },
  sangkulirang: {
    sumber: "Week LNG Sngkurilang", judulSheet: "LNG Sangkulirang", grandLabel: "Grand Total Harga",
    seksi: [
      {
        key: "ISOTANK", judul: "ISO Tank Per-Week", labelKolom: "ISO TANK", totalLabel: "Total_ISOTANK",
        baris: [
          { label: "RDAU1581209", alias: "IT-01" }, { label: "RDAU1581214", alias: "IT-02" },
          { label: "RDAU1581220", alias: "IT-03" }, { label: "RDAU1581235", alias: "IT-04" },
          { label: "RDAU1581240", alias: "IT-05" }, { label: "RDAU1581256", alias: "IT-06" },
          { label: "RDAU1581261", alias: "IT-07" }, { label: "RDAU1581277", alias: "IT-08" },
          { label: "RDAU1581282", alias: "IT-09" }, { label: "RDAU1581298", alias: "IT-10" },
          { label: "RDAU1581301", alias: "IT-11" }, { label: "RDAU1581317", alias: "IT-12" },
          { label: "RDAU1581322", alias: "IT-13" }, { label: "RDAU1581338", alias: "IT-14" },
          { label: "RDAU1581343", alias: "IT-15" }, { label: "RDAU1581359", alias: "IT-16" },
          { label: "RDAU1581364", alias: "IT-17" }, { label: "RDAU1581370", alias: "IT-18" },
          { label: "RDAU1581385", alias: "IT-19" }, { label: "RDAU1581390", alias: "IT-20" },
          { label: "RDAU1581404", alias: "IT-21" }, { label: "RDAU1581410", alias: "IT-22" },
          { label: "RDAU1581425", alias: "IT-23" }, { label: "RDAU1581430", alias: "IT-24" },
          { label: "RDAU1581446", alias: "IT-25" }, { label: "RDAU1581451", alias: "IT-26" },
          { label: "RDAU1581467", alias: "IT-27" }, { label: "RDAU1581472", alias: "IT-28" },
          { label: "RDAU1581488", alias: "IT-29" }, { label: "RDAU1581493", alias: "IT-30" },
          { label: "RDAU1581507", alias: "IT-31" }, { label: "RDAU1581512", alias: "IT-32" },
          { label: "RDAU1581528", alias: "IT-33" }, { label: "RDAU1581533", alias: "IT-34" },
          { label: "RDAU1581549", alias: "IT-35" }, { label: "RDAU1581554", alias: "IT-36" },
          { label: "RDAU1581560", alias: "IT-37" }, { label: "RDAU1581575", alias: "IT-38" },
          { label: "RDAU1581580", alias: "IT-39" }, { label: "RDAU1581596", alias: "IT-40" },
          { label: "RDAU1581600", alias: "IT-41" }, { label: "RDAU1581615", alias: "IT-42" },
          { label: "RDAU1581620", alias: "IT-43" }, { label: "RDAU1581636", alias: "IT-44" },
          { label: "RDAU1581641", alias: "IT-45" }, { label: "RDAU1581657", alias: "IT-46" },
          { label: "RDAU1581662", alias: "IT-47" }, { label: "RDAU1581678", alias: "IT-48" },
          { label: "RDAU1581683", alias: "IT-49" }, { label: "RDAU1581699", alias: "IT-50" },
          { label: "RDAU1581702", alias: "IT-51" }, { label: "RDAU1581718", alias: "IT-52" },
          { label: "RDAU1581723", alias: "IT-53" }, { label: "RDAU1581744", alias: "IT-54" },
          { label: "RDAU1581750", alias: "IT-55" }, { label: "RDAU1581765", alias: "IT-56" },
          { label: "RDAU1581770", alias: "IT-57" }, { label: "RDAU1582000", alias: "IT-58" },
          { label: "RDAU1581997", alias: "IT-59" }, { label: "RDAU1581960", alias: "IT-60" },
          { label: "RDAU1581976", alias: "IT-61" }, { label: "RDAU1581934", alias: "IT-62" },
          { label: "RDAU1582015", alias: "IT-63" }, { label: "RDAU1581940", alias: "IT-64" },
          { label: "RDAU1581955", alias: "IT-65" }, { label: "RDAU1581739", alias: "IT-66" },
          { label: "RDAU1581929", alias: "IT-67" }, { label: "RDAU1581873", alias: "IT-68" },
          { label: "RDAU1581913", alias: "IT-69" }, { label: "RDAU1581908", alias: "IT-70" },
          { label: "RDAU1581894", alias: "IT-71" }, { label: "RDAU1581889", alias: "IT-72" },
          { label: "RDAU1581868", alias: "IT-73" }, { label: "RDAU1581852", alias: "IT-74" },
          { label: "RDAU1581847", alias: "IT-75" }, { label: "RDAU1581831", alias: "IT-76" },
          { label: "RDAU1581826", alias: "IT-77" }, { label: "RDAU1581810", alias: "IT-78" },
          { label: "RDAU1581805", alias: "IT-79" }, { label: "RDAU1581791", alias: "IT-80" },
          { label: "RDAU1581786", alias: "IT-81" }, { label: "RDAU1581981", alias: "IT-82" },
        ],
      },
      {
        key: "LAIN", judul: "Lain-Lain Per-Week", labelKolom: "Lain-Lain", totalLabel: "Total Harga Lain-Lain",
        baris: [
          { label: "PRS" }, { label: "Vaporizer" }, { label: "Metering" }, { label: "Tools Mekanik" },
          { label: "Control Panel" }, { label: "Skid Pump" }, { label: "HSE" }, { label: "Jasa Service & Repair" },
          { label: "Reach Staker" }, { label: "Crane" }, { label: "B 9818 SEH" }, { label: "B 9821 KEH" },
          { label: "B 9776 KEH" }, { label: "HILUX" }, { label: "OTHER" },
        ],
      },
    ],
  },
  ret: {
    sumber: "Week RET", judulSheet: "RET", grandLabel: "Grand Total Harga",
    namaOH: "Overhaul", namaOLI: "Oli",
    seksi: [
      {
        key: "MAINT", judul: "Part Maintenance Per-Week", labelKolom: "Maintenance", totalLabel: "Total Harga",
        baris: [
          { label: "Blower" }, { label: "Louder" }, { label: "Capasitor Bank" }, { label: "Chain Saw" },
          { label: "Conveyor" }, { label: "Cyclone" }, { label: "Dryer" }, { label: "Furnace" },
          { label: "Gear Box" }, { label: "IDF Fan" }, { label: "Panel" }, { label: "Utility" }, { label: "Viar" },
          { label: "Others" },
        ],
      },
      {
        key: "OH", judul: "Overhaul Per-Week", labelKolom: "Overhaul", totalLabel: "Total Harga",
        baris: [
          { label: "Blower" }, { label: "Louder" }, { label: "Conveyor" }, { label: "Cyclone" }, { label: "Dryer" },
          { label: "Furnace" },
        ],
      },
      {
        key: "OLI", judul: "Oil Consumption Per-Week", labelKolom: "Oil Consumption", totalLabel: "Total Harga",
        baris: [
          { label: "Louder" }, { label: "Viar" }, { label: "Gear Box" }, { label: "Utility" },
        ],
      },
      {
        key: "LAIN", judul: "Lain-Lain Per-Week", labelKolom: "Lain-Lain", totalLabel: "Total Harga",
        baris: [
          { label: "Jasa Service & Repair" }, { label: "Jasa New Instalasi" }, { label: "Tools" },
        ],
      },
    ],
  },
};

/** Site mana yang punya template? Site RET dikenali dari label/key (key-nya dibuat dinamis lewat Site Operasional). */
export function kunciTemplate(siteKey: string, siteLabel?: string): KunciTemplate | null {
  const k = (siteKey || '').toLowerCase();
  if (k in TEMPLATE_SITE) return k as KunciTemplate;
  if (/^\s*ret\b/i.test(siteLabel ?? '') || /^ret([-_]|$)/.test(k)) return 'ret';
  return null;
}

/**
 * Samakan penulisan nama alokasi supaya salah ketik kecil di sheet tidak memecah baris:
 * huruf kecil, tanda baca/spasi dibuang, "Compreesor" → "compressor", "OTHERS" = "OTHER".
 */
export function normalisasiAlokasi(s: string): string {
  const n = (s || '').toLowerCase()
    .replace(/compre+sor|kompre+sor/g, 'compressor')
    .replace(/[^a-z0-9]+/g, '');
  return n === 'others' ? 'other' : n;
}

/** Nama baris template yang cocok untuk sebuah alokasi, atau null bila tidak ada di template. */
export function cocokkanBarisTemplate(seksi: SeksiTemplate, alokasi: string): string | null {
  const n = normalisasiAlokasi(alokasi);
  if (!n) return null;
  for (const b of seksi.baris) {
    if (normalisasiAlokasi(b.label) === n) return b.label;
    if (b.alias && normalisasiAlokasi(b.alias) === n) return b.label;
  }
  // Seksi OH & OLI di template hanya punya satu baris "Dryer", sedangkan di Maintenance dryer
  // disebut per unit ("Dryer Xebec", "Dryer Adekom") — semua unit dryer masuk baris itu.
  if ((seksi.key === 'OH' || seksi.key === 'OLI') && n.startsWith('dryer')) {
    const d = seksi.baris.find((b) => normalisasiAlokasi(b.label) === 'dryer');
    if (d) return d.label;
  }
  return null;
}

/** Kode biaya Lain-Lain di sheet → nama baris di template (R = Jasa Service & Repair, N = Jasa New Instalasi, dst). */
const NAMA_BARIS_LAIN_DARI_KODE: Record<string, string> = {
  R: 'Jasa Service & Repair', N: 'Jasa New Instalasi', K: 'Jasa Kalibrasi', S: 'Sedot Limbah B3',
  G: 'Jasa Analisa GAS', L: 'Jasa Analisa OLI', O: 'OTHERS', T: 'Tools', TOOLS: 'Tools',
};

/**
 * Baris Lain-Lain untuk sebuah kode biaya. Memakai nama baris template bila site-nya punya baris itu
 * (mis. "OTHER" di KHT), kalau tidak, nama bakunya (baris tambahan "di luar template").
 * Kode yang tak dikenal (mis. P, INV) dikembalikan apa adanya supaya nilainya tetap terlihat.
 */
export function barisLainDariKode(seksi: SeksiTemplate | undefined, kode: string): string | null {
  const k = (kode || '').trim().toUpperCase();
  if (!k) return null;
  const baku = NAMA_BARIS_LAIN_DARI_KODE[k];
  if (!baku) return k === 'MH' || k === 'OH' || k === 'OLI' ? null : k;
  const n = normalisasiAlokasi(baku);
  return seksi?.baris.find((b) => normalisasiAlokasi(b.label) === n)?.label ?? baku;
}