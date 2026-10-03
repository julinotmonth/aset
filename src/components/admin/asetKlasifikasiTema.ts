// Pemetaan Kelas/Sub aset → warna & ikon. Dipisah dari AsetKlasifikasiUi.tsx
// supaya berkas komponen hanya mengekspor komponen (syarat fast-refresh).
import { Wrench, Building2, CircleHelp, Zap, PencilRuler, Armchair, Shapes } from 'lucide-react';
import { NADA } from './wrTema';
import type { Nada } from './wrTema';
import type { KelasAset } from './asetKlasifikasi';

// Equipment = cyan, Building = ungu, belum terklasifikasi = netral. Ikon & label
// selalu menyertai warna (tidak mengandalkan warna saja).
export const NADA_KELAS: Record<KelasAset, Nada> = {
  Equipment: NADA.info, Building: NADA.aset, 'Belum Terklasifikasi': NADA.neutral,
};
export const IKON_KELAS: Record<KelasAset, React.ElementType> = {
  Equipment: Wrench, Building: Building2, 'Belum Terklasifikasi': CircleHelp,
};
const IKON_SUB: Record<string, React.ElementType> = { Electrical: Zap, ATK: PencilRuler, Furniture: Armchair };
export const ikonSub = (kelas: KelasAset, sub: string): React.ElementType =>
  IKON_SUB[sub] ?? (kelas === 'Equipment' ? Wrench : kelas === 'Belum Terklasifikasi' ? CircleHelp : Shapes);