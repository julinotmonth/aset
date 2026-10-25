// Halaman menu "Transfer Antar Site": dua tab.
//  • Rekomendasi Transfer — usulan otomatis site mana mengirim ke site mana (data Laporan Mingguan)
//  • Riwayat Transfer     — catatan transfer yang sudah dilakukan + form transfer baru (yang sudah ada)
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeftRight, Lightbulb, History } from 'lucide-react';
import type { AuthState } from '../../types';
import { PageHeader } from './AdminExtraViews';
import { WR_CSS } from './wrTema';
import { EAM_CSS } from './eamUi';
import { TransferRekomendasi } from './TransferRekomendasi';

type Tab = 'REKOMENDASI' | 'RIWAYAT';
const TAB: { id: Tab; label: string; ikon: React.ElementType; ket: string }[] = [
  { id: 'REKOMENDASI', label: 'Rekomendasi Transfer', ikon: Lightbulb, ket: 'Usulan otomatis berdasarkan kelebihan & kekurangan stok' },
  { id: 'RIWAYAT', label: 'Riwayat Transfer', ikon: History, ket: 'Catatan transfer dan form transfer baru' },
];

export function TransferHub({ auth, riwayat }: { auth: AuthState; riwayat: ReactNode }) {
  const [tab, setTab] = useState<Tab>('REKOMENDASI');
  return (
    <>
      <style>{WR_CSS}{EAM_CSS}</style>
      <PageHeader icon={ArrowLeftRight} title="Transfer Antar Site" />
      <div className="eam-seg" role="tablist" aria-label="Bagian Transfer Antar Site" style={{ marginBottom: '1rem', maxWidth: '100%', overflowX: 'auto' }}>
        {TAB.map((t) => {
          const Ikon = t.ikon;
          return (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} aria-pressed={tab === t.id} title={t.ket} onClick={() => setTab(t.id)}>
              <Ikon size={15} aria-hidden="true" /> {t.label}
            </button>
          );
        })}
      </div>
      {tab === 'REKOMENDASI' ? <TransferRekomendasi auth={auth} /> : riwayat}
    </>
  );
}