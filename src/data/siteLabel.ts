// Label site untuk ditampilkan ke pengguna — aturan yang sama dengan dropdown
// di Laporan Mingguan: site tanpa prefix MS/WS/LNG diberi awalan "MS ".
import { getSiteMeta } from '../../data/siteStore';

export const labelPenuh = (label: string): string => (/^\s*(ms|ws|lng)\b/i.test(label) ? label : `MS ${label}`);

/** Nama tampilan site dari key-nya, mis. 'kht' → 'MS KHT', 'indramayu' → 'WS Cibungur'. */
export const labelSiteDariKey = (key: string): string => labelPenuh(getSiteMeta(key).label);
