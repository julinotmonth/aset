// Template laporan Barang Keluar per site — disalin dari file
// "Report Weekly All MS_WS_RET (Week 45).xlsx", sheet "Week MS Wunut", "Week MS Blora",
// "Week MS KHT", "Week MS SETU", "Week LNG Sngkurilang", "Week RET" dan "Week Workshop Jabar".
//
// Isi: urutan & nama baris tiap seksi, judul seksi, nama baris total, dan nama Grand Total persis
// seperti di sheet Excel. Baris di Excel diisi lewat SUMIFS(Total Harga; Alokasi = nama baris;
// Minggu = kolom; kode MH/OH/OLI/R/...), jadi di sini baris juga dicocokkan lewat nama Alokasi.
//
// Daftar baris di bawah DIGENERATE dari file Excel — kalau template Excel berubah (unit mesin
// baru, dst), ubah di sini juga.

export type SeksiKey = 'MAINT' | 'OH' | 'OLI' | 'LAIN' | 'ISOTANK'
  // Kelompok sheet "Week Workshop Jabar" — dikelompokkan per jenis aset, bukan per jenis biaya.
  | 'HT' | 'OHHT' | 'TS10' | 'TS20' | 'TS40' | 'BT' | 'PRS' | 'KSO' | 'DF' | 'TOOLS' | 'OTHERS';

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
  /**
   * Kode biaya di kolom "MH/OH" sheet yang boleh masuk seksi ini (mis. ['MH'], ['OH'], ['DF']).
   * Hanya dipakai template yang `bagiPerAlokasi` — di sheet Excel kode inilah yang ditulis di SUMIFS tiap baris.
   */
  kode?: string[];
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
  /** Nama site untuk nama sheet export ("Week Workshop Jabar"); kosong = pakai label site. */
  namaSite?: string;
  /**
   * true = seksi sebuah transaksi TIDAK diambil dari klasifikasi server (Part Maintenance / OH / Oli / Lain-Lain),
   * tapi dari kode biaya + nama Alokasi yang dicari di baris template (lihat bagiBarisKeSeksi). Dipakai Workshop Jabar,
   * yang tabelnya dikelompokkan per jenis aset (Head Truck, Tube Skid, PRS, ...).
   */
  bagiPerAlokasi?: boolean;
}

export type KunciTemplate = 'wunut' | 'blora' | 'kht' | 'setu' | 'sangkulirang' | 'ret' | 'jabar';

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
  jabar: {
    sumber: "Week Workshop Jabar", judulSheet: "Inventory Workshop Jabar", grandLabel: "Grand Total Harga",
    namaSite: "Workshop Jabar", bagiPerAlokasi: true,
    seksi: [
      {
        key: "HT", judul: "Head Truck", labelKolom: "Head Truck", totalLabel: "Total_Head Truck", kode: ["MH"],
        baris: [
          { label: "B 9403 SXR" }, { label: "B 9590 KYU" }, { label: "B 9594 KYU" }, { label: "B 9410 SXR" },
          { label: "B 9405 SXR" }, { label: "B 9407 SXR" }, { label: "B 9825 PXR" }, { label: "B 9925 PXR" },
          { label: "B 9827 PXR" }, { label: "B 9591 KYU" }, { label: "B 9593 KYU" }, { label: "B 9411 SXR" },
          { label: "B 9412 SXR" }, { label: "B 9408 SXR" }, { label: "B 9406 SXR" }, { label: "B 9592 KYU" },
          { label: "B 9557 PEI" }, { label: "B 9475 KEH" }, { label: "B 9476 KEH" }, { label: "B 9477 KEH" },
          { label: "B 9808 SEH" }, { label: "B 9809 SEH" }, { label: "B 9139 SQU" }, { label: "B 9981 SEH" },
          { label: "B 9968 SEH" }, { label: "B 9839 SEH" }, { label: "B 9840 SEH" }, { label: "B 9903 SEH" },
          { label: "B 9904 SEH" }, { label: "B 9907 SEH" }, { label: "B 9790 KEH" }, { label: "B 9838 SEH" },
          { label: "B 9976 SEH" }, { label: "B 9978 SEH" }, { label: "B 9980 SEH" }, { label: "B 9776 KEH" },
          { label: "B 9972 SEH" }, { label: "B 9821 SEH" }, { label: "B 9818 SEH" }, { label: "B 9970 SEI" },
          { label: "B 9971 SEI" }, { label: "B 9982 SEI" }, { label: "B 9983 SEI" }, { label: "B 9984 SEI" },
          { label: "B 9985 SEI" }, { label: "B 9986 SEI" }, { label: "B 9987 SEI" }, { label: "B 9989 SEI" },
          { label: "B 9990 SEI" }, { label: "B 9901 SEJ" }, { label: "B 9010 SEJ" }, { label: "B 9011 SEJ" },
          { label: "B 9012 SEJ" }, { label: "B 9116 SEJ" }, { label: "B 9121 SEJ" }, { label: "B 9122 SEJ" },
        ],
      },
      {
        key: "OHHT", judul: "OH Head Truck", labelKolom: "OH Head Truck", totalLabel: "Total_OH Head Truck", kode: ["OH"],
        baris: [
          { label: "B 9406 SXR" }, { label: "B 9477 KEH" }, { label: "B 9907 SEH" }, { label: "B 9405 SXR" },
        ],
      },
      {
        key: "TS10", judul: "Tube Skid 10 Feet", labelKolom: "Tube Skid 10 Feet", totalLabel: "Total_Tube Skid 10 Feet", kode: ["MH"],
        baris: [
          { label: "TS-1" }, { label: "TS-2" }, { label: "TS-3" }, { label: "TS-4" },
          { label: "TS-5" }, { label: "TS-6" }, { label: "TS-7" }, { label: "TS-8" },
          { label: "TS-9" }, { label: "TS-10" }, { label: "TS-11" }, { label: "TS-12" },
          { label: "TS-13" }, { label: "TS-14" }, { label: "TS-15" }, { label: "TS-16" },
          { label: "TS-17" }, { label: "TS-18" },
        ],
      },
      {
        key: "TS20", judul: "Tube Skid 20 Feet", labelKolom: "Tube Skid 20 Feet", totalLabel: "Total_Tube Skid 20 Feet", kode: ["MH"],
        baris: [
          { label: "TS-01" }, { label: "TS-02" }, { label: "TS-03" }, { label: "TS-04" },
          { label: "TS-05" }, { label: "TS-06" }, { label: "TS-07" }, { label: "TS-08" },
          { label: "TS-09" }, { label: "TS-010" }, { label: "TS-011" }, { label: "TS-012" },
          { label: "TS-013" }, { label: "TS-014" }, { label: "TS-015" }, { label: "TS-016" },
          { label: "TS-017" }, { label: "TS-018" }, { label: "TS-019" }, { label: "TS-020" },
          { label: "TS-021" }, { label: "TS-022" }, { label: "TS-023" }, { label: "TS-024" },
          { label: "TS-025" }, { label: "TS-026" }, { label: "TS-027" }, { label: "TS-028" },
          { label: "TS-029" }, { label: "TS-030" }, { label: "TS-031" }, { label: "TS-032" },
          { label: "TS-033" }, { label: "TS-034" }, { label: "TS-035" }, { label: "TS-036" },
          { label: "TS-037" }, { label: "TS-038" }, { label: "TS-036 NES" }, { label: "TS-040" },
          { label: "TS-041" }, { label: "TS-042 (NKCU100519)" }, { label: "TS-043 (NKCU108035)" }, { label: "TS-044" },
          { label: "TS-045" }, { label: "TS-046" }, { label: "TS-047" }, { label: "TS-048" },
          { label: "TS-049" }, { label: "TS-050" }, { label: "TS-051" }, { label: "TS-052" },
        ],
      },
      {
        key: "TS40", judul: "Tube Skid 40 Feet", labelKolom: "Tube Skid 40 Feet", totalLabel: "Total_Tube Skid 40 Feet", kode: ["MH"],
        baris: [
          { label: "TS-001" }, { label: "TS-002" }, { label: "TS-003" }, { label: "TS-004" },
          { label: "TS-005" }, { label: "TS-006" }, { label: "TS-007" }, { label: "TS-008" },
          { label: "TS-009" }, { label: "TS-0010" }, { label: "TS-0011" }, { label: "TS-0012" },
          { label: "TS-0013" }, { label: "TS-0014" }, { label: "TS-0015" }, { label: "TS-0016" },
          { label: "TS-0017" }, { label: "TS-0018" }, { label: "TS-0019" }, { label: "TS-0020" },
          { label: "TS-0021" }, { label: "TS-0022" }, { label: "TS-0023" }, { label: "TS-0024" },
          { label: "TS-0025" }, { label: "TS-0026" }, { label: "TS-0027" }, { label: "TS-0028" },
          { label: "TS-0029" }, { label: "TS-0030" }, { label: "TS-0031" }, { label: "TS-0032" },
          { label: "TS-0033" }, { label: "TS-0034" }, { label: "TS-0037" }, { label: "TS-0038" },
          { label: "TS-0039" }, { label: "TS-0040" }, { label: "TS-0041" }, { label: "TS-0042" },
          { label: "TS-0043" }, { label: "TS-0044" }, { label: "TS-0046" }, { label: "TS-0047" },
          { label: "TS-0048" }, { label: "TS-0049" }, { label: "TS-0050" }, { label: "TS-0051" },
          { label: "TS-0052" }, { label: "TS-0053" }, { label: "TS-0054" }, { label: "TS-0055" },
          { label: "TS-0056" }, { label: "TS-0057" }, { label: "TS-0058" }, { label: "TS-0059" },
        ],
      },
      {
        key: "BT", judul: "Bad Trailer 20-40 Feet", labelKolom: "Bad Trailer 20-40 Feet", totalLabel: "Total_Bad Trailer 20-40 Feet", kode: ["MH"],
        baris: [
          { label: "BT TS-01" }, { label: "BT TS-02" }, { label: "BT TS-03" }, { label: "BT TS-04" },
          { label: "BT TS-05" }, { label: "BT TS-06" }, { label: "BT TS-07" }, { label: "BT TS-08" },
          { label: "BT TS-09" }, { label: "BT TS-010" }, { label: "BT TS-011" }, { label: "BT TS-012" },
          { label: "BT TS-013" }, { label: "BT TS-014" }, { label: "BT TS-015" }, { label: "BT TS-016" },
          { label: "BT TS-017" }, { label: "BT TS-018" }, { label: "BT TS-019" }, { label: "BT TS-020" },
          { label: "BT TS-021" }, { label: "BT TS-022" }, { label: "BT TS-023" }, { label: "BT TS-024" },
          { label: "BT TS-025" }, { label: "BT TS-026" }, { label: "BT TS-027" }, { label: "BT TS-028" },
          { label: "BT TS-029" }, { label: "BT TS-030" }, { label: "BT TS-031" }, { label: "BT TS-032" },
          { label: "BT TS-033" }, { label: "BT TS-034" }, { label: "BT TS-035" }, { label: "BT TS-036" },
          { label: "BT TS-037" }, { label: "BT TS-038" }, { label: "BT TS-039" }, { label: "BT TS-040" },
          { label: "BT TS-041" }, { label: "BT TS-042" }, { label: "BT TS-043" }, { label: "BT TS-044" },
          { label: "BT TS-045" }, { label: "BT TS-046" }, { label: "BT TS-047" }, { label: "BT TS-048" },
          { label: "BT TS-049" }, { label: "BT TS-050" }, { label: "BT TS-051" }, { label: "BT TS-052" },
          { label: "BT TS-001" }, { label: "BT TS-002" }, { label: "BT TS-003" }, { label: "BT TS-004" },
          { label: "BT TS-005" }, { label: "BT TS-006" }, { label: "BT TS-007" }, { label: "BT TS-008" },
          { label: "BT TS-009" }, { label: "BT TS-0010" }, { label: "BT TS-0011" }, { label: "BT TS-0012" },
          { label: "BT TS-0013" }, { label: "BT TS-0014" }, { label: "BT TS-0015" }, { label: "BT TS-0016" },
          { label: "BT TS-0017" }, { label: "BT TS-0018" }, { label: "BT TS-0019" }, { label: "BT TS-0020" },
          { label: "BT TS-0021" }, { label: "BT TS-0022" }, { label: "BT TS-0023" }, { label: "BT TS-0024" },
          { label: "BT TS-0025" }, { label: "BT TS-0026" }, { label: "BT TS-0027" }, { label: "BT TS-0028" },
          { label: "BT TS-0029" }, { label: "BT TS-0030" }, { label: "BT TS-0031" }, { label: "BT TS-0032" },
          { label: "BT TS-0033" }, { label: "BT TS-0034" }, { label: "BT TS-0035" }, { label: "BT TS-0036" },
          { label: "BT TS-0037" }, { label: "BT TS-0038" }, { label: "BT TS-0039" }, { label: "BT TS-0040" },
          { label: "BT TS-0041" }, { label: "BT TS-0042" }, { label: "BT TS-0043" }, { label: "BT TS-0044" },
          { label: "BT TS-0046" }, { label: "BT TS-0047" }, { label: "BT TS-0048" }, { label: "BT TS-0049" },
          { label: "BT TS-0050" }, { label: "BT TS-0051" }, { label: "BT TS-0052" }, { label: "BT TS-0053" },
          { label: "BT TS-0054" }, { label: "BT TS-0055" }, { label: "BT TS-0056" }, { label: "BT TS-0057" },
          { label: "BT TS-0058" }, { label: "BT TS-0059" }, { label: "BT TS-00163" }, { label: "BT TS-0166" },
        ],
      },
      {
        key: "PRS", judul: "PRS", labelKolom: "PRS", totalLabel: "Total_PRS", kode: ["MH"],
        baris: [
          { label: "RCE-001" }, { label: "RCE-002" }, { label: "RCE-003" }, { label: "RCE-004" },
          { label: "RCE-005" }, { label: "RCE-006" }, { label: "RCE-007" }, { label: "RCE-008" },
          { label: "RCE-009" }, { label: "RCE-010" }, { label: "RCE-011" }, { label: "RCE-012" },
          { label: "RCE-013" }, { label: "RCE-014" }, { label: "RCE-015" }, { label: "RCE-016" },
          { label: "RCE-017" }, { label: "RCE-018" }, { label: "RCE-019" }, { label: "RCE-020" },
          { label: "RCE-021" }, { label: "RCE-022" }, { label: "RCE-023" }, { label: "RCE-024" },
          { label: "RCE-025" }, { label: "RCE-026" }, { label: "RCE-027" }, { label: "RCE-028" },
          { label: "RCE-029" }, { label: "RCE-030" }, { label: "RCE-031" }, { label: "RCE-032" },
          { label: "RCE-033" }, { label: "RCE-034" }, { label: "RCE-035" }, { label: "RCE-036" },
          { label: "RCE-037" }, { label: "RCE-038" }, { label: "RCE-039" }, { label: "RCE-040" },
          { label: "RCE-041" }, { label: "RCE-042" }, { label: "RCE-043" }, { label: "RCE-044" },
          { label: "RCE-045" }, { label: "RCE-046" }, { label: "RCE-047" }, { label: "RCE-048" },
          { label: "RCE-049" }, { label: "RCE-050" }, { label: "RCE-051" }, { label: "RCE-052" },
          { label: "RCE-053" }, { label: "Equi-Nox" },
        ],
      },
      {
        key: "KSO", judul: "KSO", labelKolom: "KSO", totalLabel: "Total_KSO", kode: ["MH"],
        baris: [
          { label: "PT APE" }, { label: "Pertamina lubricant" }, { label: "Sampoerna" }, { label: "JARGAS" },
          { label: "KSO" },
        ],
      },
      {
        key: "DF", judul: "Dual Fuel", labelKolom: "Dual Fuel", totalLabel: "Total_Dual Fuel", kode: ["DF"],
        baris: [
          { label: "B 9557 PEI" }, { label: "B 9907 SEH" }, { label: "B 9476 KEH" }, { label: "B 9477 KEH" },
          { label: "B 9475 KEH" }, { label: "B 9838 SEH" }, { label: "B 9839 SEH" }, { label: "B 9903 SEH" },
          { label: "B 9904 SEH" }, { label: "B 9968 SEH" }, { label: "B 9976 SEH" }, { label: "B 9978 SEH" },
          { label: "B 9980 SEH" }, { label: "B 9840 SEH" }, { label: "B 9809 SEH" }, { label: "B 9808 SEH" },
          { label: "B 9990 SEI" }, { label: "B 9984 SEI" }, { label: "B 9011 SEJ" }, { label: "B 9986 SEI" },
          { label: "Dual fuel" },
        ],
      },
      {
        key: "TOOLS", judul: "Tools Mekanik", labelKolom: "Tools Mekanik", totalLabel: "Total_Tools Mekanik", kode: ["MH"],
        baris: [
          { label: "Teknisi TS & PRS" }, { label: "Teknisi HT" }, { label: "Teknisi DS" }, { label: "Dispacther" },
          { label: "Teknisi IT" },
        ],
      },
      {
        key: "OTHERS", judul: "Others", labelKolom: "Others", totalLabel: "Total Others", kode: ["MH", "O"],
        baris: [
          { label: "Others" },
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
  // Workshop Jawa Barat — key dibuat dinamis lewat Site Operasional, jadi dikenali dari label/key ("Workshop Jabar", "WS Jabar", "Jawa Barat").
  if (/\bjabar\b|jawa\s*barat/i.test(siteLabel ?? '') || /jabar|jawa[-_ ]?barat/.test(k)) return 'jabar';
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

// ── Template yang membagi seksi per jenis aset (Workshop Jabar) ───────────────────────────────────────────
//
// Di sheet \"Week Workshop Jabar\" tiap baris dijumlahkan lewat SUMIFS(Total Harga; Alokasi = nama baris; Minggu = kolom;
// kode MH/OH/DF = kode biaya), jadi SEKSI-nya ditentukan oleh baris template yang cocok — bukan oleh klasifikasi server.
// Kode yang sama (MH) dipakai banyak seksi (Head Truck, Tube Skid, PRS, ...); yang membedakan hanya nama alokasinya.

export interface BarisUntukSeksi {
  alokasi: string;
  /** Kode biaya dari sheet (MH/OH/DF/O); boleh kosong. */
  kodeBiaya?: string;
  /** Klasifikasi server (MAINT/OH/...), hanya dipakai sebagai petunjuk bila kode biaya kosong. */
  section?: SeksiKey;
  namaBarang?: string; detailAlokasi?: string; keterangan?: string;
}

interface IndeksTemplate {
  /** kode biaya → nama alokasi ternormalisasi → seksi & label baris template. */
  perKode: Map<string, Map<string, { seksi: SeksiKey; label: string }>>;
  /** nama alokasi ternormalisasi → semua kecocokan (urutan template). */
  semua: Map<string, { seksi: SeksiKey; label: string; kode: string[] }[]>;
  /** Nama seksi ternormalisasi (\"dualfuel\", \"prs\", ...) → seksi: alokasi yang isinya nama kelompok itu sendiri. */
  perNamaSeksi: Map<string, SeksiKey>;
  /** Seksi tempat kode biaya itu bermuara bila alokasinya tidak ada di template. */
  seksiKode: Map<string, SeksiKey>;
}
const CACHE_INDEKS = new WeakMap<TemplateSite, IndeksTemplate>();

function indeksTemplate(tpl: TemplateSite): IndeksTemplate {
  const ada = CACHE_INDEKS.get(tpl);
  if (ada) return ada;
  const perKode: IndeksTemplate['perKode'] = new Map();
  const semua: IndeksTemplate['semua'] = new Map();
  const perNamaSeksi = new Map<string, SeksiKey>();
  const seksiKode = new Map<string, SeksiKey>();
  for (const s of tpl.seksi) {
    const kodes = s.kode ?? [];
    perNamaSeksi.set(normalisasiAlokasi(s.judul), s.key);
    for (const k of kodes) if (!seksiKode.has(k)) seksiKode.set(k, s.key);
    for (const b of s.baris) {
      const names = [b.label, ...(b.alias ? [b.alias] : [])].map(normalisasiAlokasi).filter(Boolean);
      for (const n of names) {
        for (const k of kodes) {
          let m = perKode.get(k);
          if (!m) perKode.set(k, (m = new Map()));
          if (!m.has(n)) m.set(n, { seksi: s.key, label: b.label });
        }
        const l = semua.get(n) ?? [];
        l.push({ seksi: s.key, label: b.label, kode: kodes });
        semua.set(n, l);
      }
    }
  }
  const idx = { perKode, semua, perNamaSeksi, seksiKode };
  CACHE_INDEKS.set(tpl, idx);
  return idx;
}

const POLA_PLAT = /^b\d{3,4}[a-z]{2,3}$/;

/**
 * Seksi + nama baris tempat sebuah transaksi dijumlahkan pada template `bagiPerAlokasi` (Workshop Jabar).
 *
 *  1. Kode biaya ada (MH/OH/DF/O)  → cari alokasi di baris seksi-seksi berkode itu (persis SUMIFS di Excel).
 *  2. Kode kosong                  → cari di semua seksi; bila ada beberapa (plat yang sama di Head Truck, OH, dan Dual Fuel)
 *                                    dipilih lewat petunjuk (klasifikasi OH dari server, kata \"dual fuel\"), selain itu seksi pertama.
 *  3. Tak ada di template          → TETAP dihitung supaya total tidak hilang, sebagai baris tambahan \"(di luar template)\":
 *                                    DF → Dual Fuel, OH → OH Head Truck, O → Others; selain itu menurut pola nama
 *                                    (plat → Head Truck, \"BT TS-…\" → Bad Trailer, \"RCE-…\" → PRS), sisanya Others.
 */
export function bagiBarisKeSeksi(tpl: TemplateSite, r: BarisUntukSeksi): { seksi: SeksiKey; baris: string } {
  const idx = indeksTemplate(tpl);
  const asli = (r.alokasi || '').replace(/\s+/g, ' ').trim();
  const n = normalisasiAlokasi(asli);
  const kode = (r.kodeBiaya || '').trim().toUpperCase();
  const kodeDikenal = idx.perKode.has(kode);

  if (n) {
    if (kodeDikenal) {
      const hit = idx.perKode.get(kode)!.get(n);
      if (hit) return { seksi: hit.seksi, baris: hit.label };
    } else {
      const hits = idx.semua.get(n);
      if (hits?.length) {
        const teks = `${r.detailAlokasi ?? ''} ${r.keterangan ?? ''} ${r.namaBarang ?? ''}`;
        const mau: SeksiKey | null = /dual\s*fuel|\bdf\b/i.test(teks) ? 'DF' : r.section === 'OH' ? 'OHHT' : null;
        const h = (mau && hits.find((x) => x.seksi === mau)) || hits[0];
        return { seksi: h.seksi, baris: h.label };
      }
    }
    // Alokasi yang isinya nama kelompok itu sendiri (mis. \"Dual Fuel\" berkode MH) → baris/kelompok tersebut.
    const sNama = idx.perNamaSeksi.get(n);
    if (sNama) {
      const s = tpl.seksi.find((x) => x.key === sNama)!;
      const b = s.baris.find((x) => normalisasiAlokasi(x.label) === n);
      if (b) return { seksi: sNama, baris: b.label };
    }
  }

  const label = asli || '(Tanpa Alokasi)';
  const dariKode = kodeDikenal && kode !== 'MH' ? idx.seksiKode.get(kode) : undefined;
  if (dariKode) return { seksi: dariKode, baris: label };
  if (POLA_PLAT.test(n)) return { seksi: 'HT', baris: label };
  if (/^btts\d/.test(n)) return { seksi: 'BT', baris: label };
  if (/^rce\d/.test(n)) return { seksi: 'PRS', baris: label };
  return { seksi: 'OTHERS', baris: label };
}