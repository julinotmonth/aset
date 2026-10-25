// Halaman "Aset Tetap & Depresiasi" — seluruh datanya bersumber dari Asset Management
// (daftar aset pada sheet "LIST ALL ASET").
//
//  • Ringkasan Aset   — angka kunci, temuan, simulasi penyusutan, dan grafik analisis
//  • Asset Management — daftar aset lengkap per item (Equipment / Building)
//
// Tab dikendalikan dari luar (`tab`) supaya sub-menu di sidebar dan tab di halaman selalu sinkron.
import { Building2, PieChart, Boxes } from 'lucide-react';
import type { AuthState } from '../../types';
import { PageHeader } from './AdminExtraViews';
import { WR_CSS } from './wrTema';
import { EAM_CSS } from './eamUi';
import { AsetRingkasan } from './AsetRingkasan';
import { WeeklyReportView } from './WeeklyReportView';
import type { AsetTab } from './Sidebar';

const TAB: { id: AsetTab; label: string; ikon: React.ElementType; ket: string }[] = [
  { id: 'RINGKASAN', label: 'Ringkasan Aset', ikon: PieChart, ket: 'Gambaran cepat nilai dan penyusutan aset' },
  { id: 'ASSET_MGMT', label: 'Asset Management', ikon: Boxes, ket: 'Daftar aset lengkap per item' },
];

interface Props {
  auth: AuthState;
  tab: AsetTab;
  onTabChange: (t: AsetTab) => void;
}

export function AsetTetapView({ auth, tab, onTabChange }: Props) {
  return (
    <>
      <style>{WR_CSS}{EAM_CSS}</style>
      <PageHeader icon={Building2} title="Aset Tetap & Depresiasi"
        sub="Pantau nilai aset dan simulasikan penyusutannya — semua data bersumber dari Asset Management." />

      <div className="eam-seg" role="tablist" aria-label="Bagian Aset Tetap & Depresiasi" style={{ marginBottom: '1rem', maxWidth: '100%', overflowX: 'auto' }}>
        {TAB.map((t) => {
          const Ikon = t.ikon;
          return (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} aria-pressed={tab === t.id}
              title={t.ket} onClick={() => onTabChange(t.id)}>
              <Ikon size={15} aria-hidden="true" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'RINGKASAN' && <AsetRingkasan auth={auth} onBuka={onTabChange} />}
      {tab === 'ASSET_MGMT' && <WeeklyReportView auth={auth} mode="ASET" tanpaHeader />}
    </>
  );
}