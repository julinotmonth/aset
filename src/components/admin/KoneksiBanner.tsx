import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Loader2 } from 'lucide-react';
import { getKoneksi, subscribeKoneksi } from '../../lib/api';

const CSS = `
.kb{position:fixed;left:50%;top:calc(.85rem + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:150;display:flex;align-items:center;gap:.65rem;max-width:min(560px,calc(100vw - 1.5rem));padding:.65rem 1rem;border-radius:14px;font-size:.84rem;line-height:1.4;color:var(--txt-primary);background:var(--bg-surface);border:1px solid rgba(251,191,36,.55);box-shadow:0 10px 30px rgba(0,0,0,.35)}
.kb svg{flex-shrink:0;color:#FBBF24;animation:kb-spin .9s linear infinite}
.kb small{display:block;color:var(--txt-muted);font-size:.74rem;margin-top:.1rem}
@keyframes kb-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.kb svg{animation:none}}
`;

/**
 * Muncul bila permintaan ke server sedang diulang otomatis — biasanya karena backend baru bangun
 * dari mode tidur. Memberi tahu pengguna bahwa ini normal dan akan pulih sendiri, alih-alih error merah.
 */
export const KoneksiBanner: React.FC = () => {
  const status = useSyncExternalStore(subscribeKoneksi, getKoneksi, () => 'ok' as const);
  const [detik, setDetik] = useState<number | null>(null);

  useEffect(() => {
    if (status !== 'menyambung') { setDetik(null); return; }
    // Tunda sebentar agar gangguan singkat tidak membuat banner berkedip.
    const mulai = Date.now();
    const t = setInterval(() => {
      const d = Math.floor((Date.now() - mulai) / 1000);
      setDetik(d >= 1 ? d : null);
    }, 500);
    return () => clearInterval(t);
  }, [status]);

  if (status !== 'menyambung' || detik === null) return null;
  return (
    <div className="kb" role="status" aria-live="polite">
      <style>{CSS}</style>
      <Loader2 size={18} aria-hidden="true" />
      <div>
        <b>Menyambungkan ke server… ({detik} dtk)</b>
        <small>Server sedang bangun dari mode tidur. Biasanya 10–30 detik, lalu data muncul sendiri.</small>
      </div>
    </div>
  );
};