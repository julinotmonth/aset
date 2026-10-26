// Label site untuk ditampilkan ke pengguna.
// - Site bawaan tanpa prefix MS/WS/LNG diberi awalan "MS " (mis. "Blora" → "MS Blora").
// - Site yang ditambahkan admin lewat "Tambah Site" ditampilkan PERSIS seperti yang
//   diketik (mis. "RET Jepara" tetap "RET Jepara", tidak jadi "MS RET Jepara").
import { getSites, getSiteMeta } from '../../data/siteStore';

const PUNYA_PREFIX = /^\s*(ms|ws|lng)\b/i;

export const labelPenuh = (label: string): string => {
  if (PUNYA_PREFIX.test(label)) return label;
  const site = getSites().find((s) => s.label === label);
  if (site && !site.isDefault) return label;
  return `MS ${label}`;
};

/** Nama tampilan site dari key-nya, mis. 'kht' → 'MS KHT', 'indramayu' → 'WS Cibungur'. */
export const labelSiteDariKey = (key: string): string => labelPenuh(getSiteMeta(key).label);