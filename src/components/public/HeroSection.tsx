import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';
import { ArrowDown, Flame, Cpu, Calculator, ChevronRight, Activity, Minus, Plus, Fuel, Snowflake, Leaf } from 'lucide-react';
import type { Language } from '../../types';

interface HeroSectionProps {
  lang: Language;
  onOpenAdminLogin: () => void;
}

type EnergyKey = 'CNG' | 'LNG' | 'Biomass';

/** Smoothly animates a numeric value whenever `target` changes. */
function useAnimatedNumber(target: number, duration = 550) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) return;
    const start = performance.now();

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out-cubic
      setValue(from + delta * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ lang, onOpenAdminLogin }) => {
  const [fuelVolume, setFuelVolume] = useState<number>(25000);
  const [energyType, setEnergyType] = useState<EnergyKey>('CNG');
  const [isDragging, setIsDragging] = useState(false);
  const [spotlight, setSpotlight] = useState({ x: 50, y: 0, active: false });
  const cardRef = useRef<HTMLDivElement | null>(null);
  const copyRef = useRef<HTMLDivElement | null>(null);

  /** Orchestrated page-load entrance: tagline → heading → copy → CTAs, card slides in alongside. */
  useLayoutEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      const copyItems = copyRef.current ? gsap.utils.toArray<HTMLElement>(copyRef.current.children) : [];
      const card = cardRef.current;

      if (reduceMotion) {
        gsap.set(card ? [...copyItems, card] : copyItems, { opacity: 1, x: 0, y: 0 });
        return;
      }

      gsap.set(copyItems, { opacity: 0, y: 22 });
      if (card) gsap.set(card, { opacity: 0, x: 26 });

      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.to(copyItems, { opacity: 1, y: 0, duration: 0.75, stagger: 0.09 }, 0.05);
      if (card) tl.to(card, { opacity: 1, x: 0, duration: 0.85 }, 0.25);
    });
    return () => ctx.revert();
  }, []);

  const handleCardMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSpotlight({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
      active: true,
    });
  }, []);

  const ENERGY_CONFIG: Record<EnergyKey, { ratio: number; carbonFactor: number; icon: React.ReactNode; color: string }> = {
    CNG: { ratio: 0.70, carbonFactor: 2.68, icon: <Fuel size={14} strokeWidth={2.5} />, color: '#00D084' },
    LNG: { ratio: 0.63, carbonFactor: 2.75, icon: <Snowflake size={14} strokeWidth={2.5} />, color: '#60A5FA' },
    Biomass: { ratio: 0.52, carbonFactor: 3.10, icon: <Leaf size={14} strokeWidth={2.5} />, color: '#C084FC' },
  };

  const dieselCostPerLiter = 16500;
  const activeConfig = ENERGY_CONFIG[energyType];
  const cngEquivalentCost = dieselCostPerLiter * activeConfig.ratio;
  const monthlySavings = fuelVolume * (dieselCostPerLiter - cngEquivalentCost);
  const yearlyCarbonOffsetTons = Math.round((fuelVolume * 12 * activeConfig.carbonFactor) / 1000);
  const yearlySavings = monthlySavings * 12;
  const pct = Math.round(((fuelVolume - 5000) / (150000 - 5000)) * 100);
  const sliderBg = `linear-gradient(to right, ${activeConfig.color} 0%, ${activeConfig.color} ${pct}%, #1E293B ${pct}%, #1E293B 100%)`;

  const animatedSavings = useAnimatedNumber(yearlySavings);
  const animatedCarbon = useAnimatedNumber(yearlyCarbonOffsetTons);
  const dieselTotalCost = fuelVolume * dieselCostPerLiter * 12;
  const reethauTotalCost = fuelVolume * cngEquivalentCost * 12;
  const savingsPct = Math.round((1 - reethauTotalCost / dieselTotalCost) * 100);

  const step = 2500;
  const clamp = (v: number) => Math.min(150000, Math.max(5000, v));

  const formatIDR = (v: number) =>
    `Rp ${Math.round(v).toLocaleString('id-ID')}`;

  const t = {
    IDN: {
      tagline: 'PT REETHAU CLEAN ENERGY',
      line1: 'Sumber Energi yang',
      line2: 'Ramah Lingkungan',
      line3: 'sebagai Solusi.',
      desc: 'Reethau menyediakan jaringan terintegrasi pasokan Compressed Natural Gas (CNG), Liquefied Natural Gas (LNG), dan Biomassa untuk sektor industri modern di seluruh Indonesia.',
      cta1: 'Jelajahi Produk Energi',
      cta2: 'Portal Inventaris Spare Part',
      scroll: 'Gulir untuk Jelajahi',
      calcTitle: 'Kalkulator Efisiensi Energi',
      calcSub: 'Estimasi penghematan biaya & pengurangan emisi',
      sliderLabel: 'Konsumsi Solar Industri / Bulan:',
      savLabel: 'ESTIMASI PENGHEMATAN / TAHUN',
      co2Label: 'PENGURANGAN CO₂ / TAHUN',
      ctaCalc: 'Minta Penawaran Energi Konversi',
      chooseEnergy: 'Pilih Energi Konversi:',
      dieselLabel: 'Solar (Existing)',
      reethauLabel: `${energyType} (Reethau)`,
      savingsPctLabel: 'lebih hemat',
      dragHint: 'Geser untuk simulasi',
    },
    ENG: {
      tagline: 'PT REETHAU CLEAN ENERGY',
      line1: 'Environmentally Friendly',
      line2: 'Energy Sources',
      line3: 'as a Solution.',
      desc: 'Reethau delivers an integrated supply chain of Compressed Natural Gas (CNG), Liquefied Natural Gas (LNG), and Biomass tailored for modern industrial facilities across Indonesia.',
      cta1: 'Explore Clean Energy',
      cta2: 'Spare Part Inventory Portal',
      scroll: 'Scroll to Explore',
      calcTitle: 'Energy Efficiency Calculator',
      calcSub: 'Estimate your cost savings & emission reduction',
      sliderLabel: 'Monthly Diesel Consumption:',
      savLabel: 'ESTIMATED YEARLY SAVINGS',
      co2Label: 'YEARLY CO₂ OFFSET',
      ctaCalc: 'Request Energy Transition Quote',
      chooseEnergy: 'Choose Conversion Energy:',
      dieselLabel: 'Diesel (Existing)',
      reethauLabel: `${energyType} (Reethau)`,
      savingsPctLabel: 'cheaper',
      dragHint: 'Drag to simulate',
    },
  }[lang];

  return (
    <section
      id="beranda"
      className="section-x-pad"
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 'clamp(4.75rem, 12vh, 6.25rem) 2rem clamp(1rem, 3vh, 1.75rem)',
        backgroundImage: [
          'linear-gradient(125deg, rgba(7,12,24,0.97) 0%, rgba(10,18,34,0.90) 45%, rgba(7,12,24,0.97) 100%)',
          "url('/assets/images/distribution-truck.webp')",
        ].join(', '),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'scroll',
        overflow: 'hidden',
      }}
    >
      {/* Radial glow accent */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'radial-gradient(ellipse 60% 50% at 70% 50%, rgba(0,208,132,0.07) 0%, transparent 70%)',
      }} />

      <div style={{ maxWidth: '1320px', margin: '0 auto', width: '100%', position: 'relative', zIndex: 10 }}>

        {/* ── TWO-COLUMN GRID ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))',
          gap: 'clamp(1.75rem, 4vh, 3rem)',
          alignItems: 'center',
        }}>

          {/* LEFT — Hero Copy */}
          <div ref={copyRef}>
            {/* Tagline pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.55rem',
              padding: '0.35rem 1.1rem',
              background: 'rgba(0,208,132,0.09)',
              border: '1px solid rgba(0,208,132,0.4)',
              borderRadius: '9999px',
              color: '#00D084',
              fontSize: '0.68rem',
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginBottom: 'clamp(0.85rem, 2vh, 1.25rem)',
              boxShadow: '0 0 20px rgba(0,208,132,0.15)',
            }}>
              <Activity size={13} strokeWidth={2.5} />
              {t.tagline}
            </div>

            {/* Display heading */}
            <h1 style={{
              fontSize: 'clamp(1.85rem, 3.4vw + 1vh, 3.15rem)',
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
              marginBottom: 'clamp(0.75rem, 2vh, 1.1rem)',
              color: '#FFFFFF',
            }}>
              {t.line1}<br />
              <span style={{
                color: '#00D084',
                textShadow: '0 0 40px rgba(0,208,132,0.4)',
              }}>{t.line2}</span><br />
              {t.line3}
            </h1>

            <p style={{
              fontSize: '0.98rem',
              color: '#CBD5E1',
              maxWidth: '580px',
              lineHeight: 1.65,
              marginBottom: 'clamp(1.1rem, 3vh, 1.75rem)',
            }}>
              {t.desc}
            </p>

            {/* CTA Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              <a href="#produk" className="btn-primary" style={{ fontSize: '0.85rem' }}>
                <Flame size={17} strokeWidth={2.5} />
                {t.cta1}
              </a>
              <button onClick={onOpenAdminLogin} className="btn-outline" style={{ fontSize: '0.85rem' }}>
                <Cpu size={17} strokeWidth={2} />
                {t.cta2}
              </button>
            </div>
          </div>

          {/* RIGHT — Calculator Widget */}
          <div
            ref={cardRef}
            onMouseMove={handleCardMouseMove}
            onMouseLeave={() => setSpotlight(s => ({ ...s, active: false }))}
            style={{
            transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
            background: 'rgba(13,21,37,0.88)',
            backdropFilter: 'blur(24px) saturate(150%)',
            WebkitBackdropFilter: 'blur(24px) saturate(150%)',
            border: `1.5px solid ${isDragging ? activeConfig.color : 'rgba(0,208,132,0.3)'}`,
            borderRadius: '20px',
            padding: 'clamp(1.2rem, 3vh, 1.6rem) 1.75rem',
            boxShadow: isDragging
              ? `0 24px 56px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04), 0 0 50px ${activeConfig.color}33`
              : '0 24px 56px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04), 0 0 40px rgba(0,208,132,0.08)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Mouse-follow spotlight */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
              opacity: spotlight.active ? 1 : 0,
              transition: 'opacity 0.4s ease',
              background: `radial-gradient(280px circle at ${spotlight.x}% ${spotlight.y}%, ${activeConfig.color}1a, transparent 70%)`,
            }} />
            {/* Top accent bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
              background: `linear-gradient(90deg, transparent 0%, ${activeConfig.color} 50%, transparent 100%)`,
              boxShadow: `0 0 12px ${activeConfig.color}cc`,
              transition: 'background 0.3s ease, box-shadow 0.3s ease',
            }} />

            {/* Content wrapper — sits above spotlight layer */}
            <div style={{ position: 'relative', zIndex: 1 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', marginBottom: 'clamp(0.7rem, 2vh, 1rem)' }}>
              <div style={{
                width: '38px', height: '38px', flexShrink: 0,
                borderRadius: '11px',
                background: `${activeConfig.color}1f`,
                border: `1px solid ${activeConfig.color}59`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: activeConfig.color,
                boxShadow: `0 0 20px ${activeConfig.color}33`,
                transition: 'all 0.3s ease',
              }}>
                <Calculator size={19} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.25 }}>
                  {t.calcTitle}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
                  {t.calcSub}
                </div>
              </div>
            </div>

            {/* Energy type selector tabs */}
            <div style={{ marginBottom: 'clamp(0.65rem, 2vh, 0.9rem)' }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                {t.chooseEnergy}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {(Object.keys(ENERGY_CONFIG) as EnergyKey[]).map((key) => {
                  const cfg = ENERGY_CONFIG[key];
                  const isActive = energyType === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setEnergyType(key)}
                      aria-pressed={isActive}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                        padding: '0.42rem 0.35rem',
                        borderRadius: '9px',
                        border: `1.5px solid ${isActive ? cfg.color : 'rgba(255,255,255,0.08)'}`,
                        background: isActive ? `${cfg.color}1f` : 'rgba(255,255,255,0.02)',
                        color: isActive ? cfg.color : '#94A3B8',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.25s var(--ease-out-expo)',
                        boxShadow: isActive ? `0 0 16px ${cfg.color}26` : 'none',
                      }}
                    >
                      {cfg.icon}
                      {key}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: 'clamp(0.7rem, 2vh, 1rem)' }} />

            {/* Slider */}
            <div style={{ marginBottom: 'clamp(0.7rem, 2vh, 1rem)' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '0.45rem',
              }}>
                <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 500 }}>
                  {t.sliderLabel}
                </span>
                <span style={{
                  fontSize: '0.95rem', fontWeight: 800, color: activeConfig.color,
                  background: `${activeConfig.color}1a`,
                  padding: '0.18rem 0.65rem',
                  borderRadius: '6px',
                  border: `1px solid ${activeConfig.color}40`,
                  transition: 'all 0.3s ease',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {fuelVolume.toLocaleString('id-ID')} L
                </span>
              </div>

              {/* Slider row with stepper buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  aria-label="Kurangi volume"
                  onClick={() => setFuelVolume(v => clamp(v - step))}
                  disabled={fuelVolume <= 5000}
                  style={{
                    flexShrink: 0, width: '26px', height: '26px', borderRadius: '7px',
                    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                    color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: fuelVolume <= 5000 ? 'not-allowed' : 'pointer',
                    opacity: fuelVolume <= 5000 ? 0.4 : 1,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Minus size={14} strokeWidth={2.5} />
                </button>

                <div style={{ position: 'relative', flex: 1 }}>
                  {isDragging && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: `${pct}%`, transform: 'translateX(-50%)',
                      marginBottom: '10px', padding: '0.3rem 0.6rem', borderRadius: '7px',
                      background: activeConfig.color, color: '#0A0F1D', fontSize: '0.72rem', fontWeight: 800,
                      whiteSpace: 'nowrap', boxShadow: `0 4px 14px ${activeConfig.color}66`,
                      animation: 'fadeIn 0.15s ease',
                    }}>
                      {fuelVolume.toLocaleString('id-ID')} L
                    </div>
                  )}
                  <input
                    type="range"
                    min={5000} max={150000} step={5000}
                    value={fuelVolume}
                    onChange={e => setFuelVolume(+e.target.value)}
                    onPointerDown={() => setIsDragging(true)}
                    onPointerUp={() => setIsDragging(false)}
                    style={{ width: '100%', background: sliderBg }}
                    aria-label={t.sliderLabel}
                  />
                </div>

                <button
                  aria-label="Tambah volume"
                  onClick={() => setFuelVolume(v => clamp(v + step))}
                  disabled={fuelVolume >= 150000}
                  style={{
                    flexShrink: 0, width: '26px', height: '26px', borderRadius: '7px',
                    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                    color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: fuelVolume >= 150000 ? 'not-allowed' : 'pointer',
                    opacity: fuelVolume >= 150000 ? 0.4 : 1,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Plus size={14} strokeWidth={2.5} />
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#475569', marginTop: '4px' }}>
                <span>5.000 L</span>
                <span style={{ fontStyle: 'italic', opacity: 0.8 }}>{t.dragHint}</span>
                <span>150.000 L</span>
              </div>
            </div>

            {/* Cost comparison bar chart */}
            <div style={{ marginBottom: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>{t.dieselLabel}</span>
                <span style={{ fontSize: '0.76rem', color: '#E2E8F0', fontWeight: 700 }}>{formatIDR(dieselTotalCost)}</span>
              </div>
              <div style={{ height: '7px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: '0.55rem' }}>
                <div style={{ width: '100%', height: '100%', background: '#64748B', borderRadius: '4px' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', color: activeConfig.color, fontWeight: 700 }}>{t.reethauLabel}</span>
                <span style={{ fontSize: '0.76rem', color: activeConfig.color, fontWeight: 800 }}>{formatIDR(reethauTotalCost)}</span>
              </div>
              <div style={{ height: '7px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max(4, 100 - savingsPct)}%`, height: '100%',
                  background: `linear-gradient(90deg, ${activeConfig.color}, ${activeConfig.color}cc)`,
                  borderRadius: '4px',
                  boxShadow: `0 0 12px ${activeConfig.color}80`,
                  transition: 'width 0.55s var(--ease-out-expo), background 0.3s ease',
                }} />
              </div>
              <div style={{ textAlign: 'right', marginTop: '0.3rem', fontSize: '0.7rem', color: activeConfig.color, fontWeight: 700 }}>
                −{savingsPct}% {t.savingsPctLabel}
              </div>
            </div>

            {/* Result Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.7rem', marginBottom: '1rem' }}>
              {/* Savings */}
              <div style={{
                background: `${activeConfig.color}12`,
                border: `1px solid ${activeConfig.color}40`,
                borderRadius: '11px',
                padding: '0.8rem 0.85rem',
                transition: 'all 0.3s ease',
              }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.3rem' }}>
                  {t.savLabel}
                </div>
                <div style={{ fontSize: '1.02rem', fontWeight: 800, color: activeConfig.color, letterSpacing: '-0.025em', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
                  {formatIDR(animatedSavings)}
                </div>
              </div>
              {/* CO2 */}
              <div style={{
                background: 'rgba(96,165,250,0.07)',
                border: '1px solid rgba(96,165,250,0.25)',
                borderRadius: '11px',
                padding: '0.8rem 0.85rem',
              }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.3rem' }}>
                  {t.co2Label}
                </div>
                <div style={{ fontSize: '1.02rem', fontWeight: 800, color: '#60A5FA', letterSpacing: '-0.025em', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
                  ~{Math.round(animatedCarbon)} Tons CO₂
                </div>
              </div>
            </div>

            {/* CTA */}
            <a href="#kontak" className="btn-primary" style={{
              width: '100%', justifyContent: 'center',
              fontSize: '0.85rem', fontWeight: 800,
              padding: '0.7rem 1.85rem',
              background: activeConfig.color,
              transition: 'background 0.3s ease',
            }}>
              {t.ctaCalc}
              <ChevronRight size={17} strokeWidth={2.5} />
            </a>

            </div>{/* /content wrapper */}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div style={{
        position: 'absolute', bottom: 'clamp(0.4rem, 1.5vh, 0.9rem)', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem',
        color: '#475569', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        <span>{t.scroll}</span>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          border: '1.5px solid rgba(0,208,132,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#00D084',
          animation: 'bounceDot 2s ease-in-out infinite',
          boxShadow: '0 0 12px rgba(0,208,132,0.25)',
        }}>
          <ArrowDown size={13} strokeWidth={2.5} />
        </div>
      </div>
    </section>
  );
};