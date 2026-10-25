// Halaman menu "Spare Part": katalog & pergerakan spare part dari Laporan Mingguan SEMUA site
// (kode berawalan I-RDA / I-RCE).
import { Package } from 'lucide-react';
import type { AuthState } from '../../types';
import { PageHeader } from './AdminExtraViews';
import { WR_CSS } from './wrTema';
import { EAM_CSS } from './eamUi';
import { SparePartKatalog } from './SparePartKatalog';

export function SparePartHub({ auth, cariAwal }: { auth: AuthState; cariAwal?: string }) {
  return (
    <>
      <style>{WR_CSS}{EAM_CSS}</style>
      <PageHeader icon={Package} title="Spare Part" />
      <SparePartKatalog auth={auth} cariAwal={cariAwal} />
    </>
  );
}