// Halaman "Aset Tetap & Depresiasi": satu tempat untuk memahami aset perusahaan.
//
//  • Ringkasan Aset      — angka kunci, temuan, grafik, dan rangkuman Asset Management
//  • Register & Depresiasi — daftar aset tetap beserta nilai buku, penyusutan, garansi, maintenance
//  • Asset Management    — daftar aset dari sheet (Equipment / Building) secara lengkap
//
// Tab dikendalikan dari luar (`tab`) supaya sub-menu di sidebar dan tab di halaman selalu sinkron.
import { useState } from 'react';
import { Building2, PieChart, Table2, Boxes } from 'lucide-react';
import type { AuthState, FixedAsset, WorkOrder } from '../../types';
import { PageHeader } from './AdminExtraViews';
import { WR_CSS } from './wrTema';
import { EAM_CSS } from './eamUi';
import { AssetRegistryView } from './AssetRegistryView';
import type { Perhatian } from './AssetRegistryView';
import { AsetRingkasan } from './AsetRingkasan';
import { WeeklyReportView } from './WeeklyReportView';
import type { AsetTab } from './Sidebar';

const TAB: { id: AsetTab; label: string; ikon: React.ElementType; ket: string }[] = [
  { id: 'RINGKASAN', label: 'Ringkasan Aset', ikon: PieChart, ket: 'Gambaran cepat kondisi aset' },
  { id: 'REGISTER', label: 'Register & Depresiasi', ikon: Table2, ket: 'Daftar aset tetap dan penyusutannya' },
  { id: 'ASSET_MGMT', label: 'Asset Management', ikon: Boxes, ket: 'Daftar aset dari sheet' },
];

interface Props {
  auth: AuthState;
  fixedAssets: FixedAsset[];
  workOrders: WorkOrder[];
  tab: AsetTab;
  onTabChange: (t: AsetTab) => void;
  onSave: (patch: Partial<FixedAsset>) => void;
  onDelete: (id: string) => void;
  onSaveWorkOrder: (patch: Partial<WorkOrder>) => void;
}

export function AsetTetapView({ auth, fixedAssets, workOrders, tab, onTabChange, onSave, onDelete, onSaveWorkOrder }: Props) {
  // Filter "perlu perhatian" yang dibawa dari Ringkasan ke Register; `k` memaksa Register dibuat ulang.
  const [preset, setPreset] = useState<{ k: number; p: Perhatian | null }>({ k: 0, p: null });

  const buka = (t: AsetTab, perhatian?: Perhatian) => {
    if (t === 'REGISTER') setPreset((s) => ({ k: s.k + 1, p: perhatian ?? null }));
    onTabChange(t);
  };

  return (
    <>
      <style>{WR_CSS}{EAM_CSS}</style>
      <PageHeader icon={Building2} title="Aset Tetap & Depresiasi"
        sub="Pantau nilai, penyusutan, dan kondisi aset perusahaan — dari ringkasan analitik sampai daftar aset per item." />

      <div className="eam-seg" role="tablist" aria-label="Bagian Aset Tetap & Depresiasi" style={{ marginBottom: '1rem', maxWidth: '100%', overflowX: 'auto' }}>
        {TAB.map((t) => {
          const Ikon = t.ikon;
          return (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} aria-pressed={tab === t.id}
              title={t.ket} onClick={() => buka(t.id)}>
              <Ikon size={15} aria-hidden="true" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'RINGKASAN' && <AsetRingkasan auth={auth} fixedAssets={fixedAssets} workOrders={workOrders} onBuka={buka} />}
      {tab === 'REGISTER' && (
        <AssetRegistryView key={preset.k} tanpaHeader perhatianAwal={preset.p} fixedAssets={fixedAssets} workOrders={workOrders}
          onSave={onSave} onDelete={onDelete} onSaveWorkOrder={onSaveWorkOrder} />
      )}
      {tab === 'ASSET_MGMT' && <WeeklyReportView auth={auth} mode="ASET" tanpaHeader />}
    </>
  );
}