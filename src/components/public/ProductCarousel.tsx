import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Gauge, Flame, TreeDeciduous, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';
import type { Language } from '../../types';
import { useScrollReveal } from '../../hooks/useScrollReveal';

// This public marketing carousel only ever shows these three fixed energy products,
// regardless of any custom "Kategori Produk Energi" values added in the admin panel.
type CarouselProduct = 'CNG' | 'LNG' | 'Biomass';

interface ProductCarouselProps { lang: Language; }

export const ProductCarousel: React.FC<ProductCarouselProps> = ({ lang }) => {
  const [activeProduct, setActiveProduct] = useState<CarouselProduct>('CNG');
  const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'safety'>('overview');
  const sectionRef = useRef<HTMLElement>(null);

  useScrollReveal(sectionRef, '.reveal-item', [lang]);

  // Reset tab on product switch
  useEffect(() => setActiveTab('overview'), [activeProduct]);

  const products = {
    CNG: {
      label: 'CNG', icon: <Gauge size={18} strokeWidth={2} />, accentColor: '#00D084',
      title: 'CNG (Compressed Natural Gas)',
      tagline: lang === 'IDN' ? 'Gas Alam Terkompresi untuk Efisiensi Manufaktur' : 'Compressed Natural Gas for Manufacturing Efficiency',
      description: lang === 'IDN'
        ? 'Gas alam bertekanan tinggi 200–250 Bar yang disalurkan dari Mother Station ke Daughter Station menggunakan sistem trailer kompresi teruji. Menggantikan bahan bakar minyak beremisi tinggi secara efisien.'
        : 'High-pressure natural gas (200–250 Bar) dispatched from Mother Stations via compression trailers to customer plants. Replaces high-emission diesel efficiently.',
      specs: lang === 'IDN'
        ? ['Tekanan Pengiriman: 200–250 Bar', 'Hemat Biaya: Efisiensi hingga 30% dibanding Solar', 'Pengawasan Telemetri: Pemantauan tekanan real-time 24/7', 'Instalasi PRS (Pressure Reduction System) siap pakai']
        : ['Delivery Pressure: 200–250 Bar', 'Cost Savings: Up to 30% efficiency vs Diesel', 'Telemetry Monitoring: 24/7 real-time pressure tracking', 'Turnkey PRS (Pressure Reduction System) unit'],
      safety: lang === 'IDN'
        ? ['Sistem valve pemutus darurat otomatis (ESD)', 'Inspeksi tabung berkala bersertifikasi Ditjen Migas', 'Grounding & proteksi petir terintegrasi']
        : ['Automatic Emergency Shut-Off Valve (ESD)', 'Certified periodic pressure vessel testing', 'Integrated grounding & surge protection'],
      image: '/assets/images/cng-pipe.webp',
    },
    LNG: {
      label: 'LNG', icon: <Flame size={18} strokeWidth={2} />, accentColor: '#60A5FA',
      title: 'LNG (Liquefied Natural Gas)',
      tagline: lang === 'IDN' ? 'Gas Alam Cair Kepadatan Energi Tinggi' : 'High Energy-Density Liquefied Natural Gas',
      description: lang === 'IDN'
        ? 'Gas alam kriogenik cair yang didinginkan hingga -162°C, mengecilkan volume gas hingga 600 kali. Memungkinkan pasokan energi skala besar untuk pembakaran boiler, oven keramik, dan kiln semen.'
        : 'Cryogenic natural gas liquefied at -162°C, reducing volume by 600x. Enables high-volume fuel supply for power plants, ceramic kilns, and glass manufacturing.',
      specs: lang === 'IDN'
        ? ['Suhu Penyimpanan Kriogenik: -162°C', 'Kepadatan Energi per volume sangat tinggi', 'Transportasi Iso-Tank: Pengiriman aman antar pulau', 'Cocok untuk Industri Skala Besar & Pembangkit']
        : ['Cryogenic Temp: -162°C storage', 'Ultra High Energy Density per volume', 'Iso-Tank Intermodal Transport Fleet', 'Optimized for Large-Scale Heavy Industry'],
      safety: lang === 'IDN'
        ? ['Tangki vakum berisolasi ganda (Double-walled)', 'Sistem pelepasan tekanan berlebih (PRV)', 'Detektor kebocoran gas metana otomatis']
        : ['Double-walled vacuum insulated tanks', 'Pressure Relief Valves (PRV) redundancy', 'Automated Methane Gas Leak Detectors'],
      image: '/assets/images/lng-storage.webp',
    },
    Biomass: {
      label: 'Biomass', icon: <TreeDeciduous size={18} strokeWidth={2} />, accentColor: '#34D399',
      title: lang === 'IDN' ? 'Biomassa & Woodchip' : 'Biomass & Woodchips',
      tagline: lang === 'IDN' ? 'Energi Padat Terbarukan Netral Karbon' : 'Renewable Carbon-Neutral Solid Energy',
      description: lang === 'IDN'
        ? 'Bahan bakar padat terbarukan hasil olahan limbah kayu pilihan berkadar air rendah (<20%). Memberikan nilai kalori stabil dan emisi CO₂ netral untuk boiler industri modern.'
        : 'Renewable solid fuel processed from low-moisture (<20%) wood residuals. Delivers stable calorific value and net-zero CO₂ lifecycle for modern industrial boilers.',
      specs: lang === 'IDN'
        ? ['Kadar Air Teruji: < 20% MC', 'Nilai Kalor: > 3.800 kcal/kg', 'Siklus Netral Karbon (Zero Net CO₂)', 'Residu Abu Rendah: < 2% ash residue']
        : ['Moisture Content: < 20% MC', 'Calorific Value: > 3,800 kcal/kg', 'Zero Net Carbon Lifecycle', 'Ultra Low Ash Residue: < 2%'],
      safety: lang === 'IDN'
        ? ['Penyimpanan area kering terlindung dari kelembapan', 'Deteksi dini suhu tumpukan kayu', 'Standar kayu terverifikasi legalitas (SVLK)']
        : ['Dry covered storage preventing humidity', 'Thermal heap monitoring sensors', '100% Legally certified wood supply (SVLK)'],
      image: '/assets/images/biomass.webp',
    },
  };

  const current = products[activeProduct];
  const subLabel = lang === 'IDN' ? 'PORTOFOLIO PRODUK ENERGI BERSIH' : 'CLEAN ENERGY PRODUCT PORTFOLIO';
  const heading = lang === 'IDN' ? 'Solusi Bahan Bakar Industri Bebas Emisi Tinggi' : 'Industrial Energy Solutions Free from High Emissions';
  const consultLabel = lang === 'IDN' ? `Konsultasi Pasokan ${activeProduct}` : `Consult ${activeProduct} Supply`;

  const tabLabels = {
    overview: lang === 'IDN' ? 'Ringkasan' : 'Overview',
    specs: lang === 'IDN' ? 'Spesifikasi Teknis' : 'Technical Specs',
    safety: lang === 'IDN' ? 'Standar Keselamatan' : 'Safety Standards',
  };

  return (
    <section
      ref={sectionRef}
      id="produk"
      className="section-x-pad"
      style={{ padding: '7rem 2rem', background: 'linear-gradient(to bottom, var(--bg-root), var(--bg-surface))', position: 'relative', overflow: 'hidden' }}
    >
      {/* Accent */}
      <div style={{
        position: 'absolute', bottom: '10%', right: '-8%', width: '35%', paddingBottom: '35%',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,208,132,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '1320px', margin: '0 auto', position: 'relative' }}>

        {/* Header */}
        <div className="reveal-item" style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>{subLabel}</div>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', fontWeight: 800, color: '#FFFFFF', marginTop: '0.5rem', maxWidth: '680px', margin: '0.5rem auto 0' }}>
            {heading}
          </h2>
        </div>

        {/* Product Selector Tabs */}
        <div className="reveal-item" style={{
          display: 'flex', justifyContent: 'center', gap: '0.85rem',
          marginBottom: '3rem', flexWrap: 'wrap',
        }}>
          {(['CNG', 'LNG', 'Biomass'] as CarouselProduct[]).map(prod => {
            const p = products[prod];
            const active = activeProduct === prod;
            return (
              <button
                key={prod}
                onClick={() => setActiveProduct(prod)}
                style={{
                  padding: '0.85rem 2rem',
                  borderRadius: '14px',
                  border: active ? `2px solid ${p.accentColor}` : '1px solid rgba(255,255,255,0.08)',
                  background: active
                    ? `rgba(${p.accentColor === '#00D084' ? '0,208,132' : p.accentColor === '#60A5FA' ? '96,165,250' : '52,211,153'},0.12)`
                    : 'rgba(13,21,37,0.8)',
                  color: active ? p.accentColor : '#64748B',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 250ms ease',
                  display: 'flex', alignItems: 'center', gap: '0.65rem',
                  fontFamily: 'var(--font-main)',
                  boxShadow: active ? `0 0 20px ${p.accentColor}33` : 'none',
                  letterSpacing: '-0.01em',
                }}
              >
                <span style={{ color: active ? p.accentColor : '#475569', transition: 'color 200ms ease' }}>
                  {p.icon}
                </span>
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Main Product Panel */}
        <div className="reveal-item product-panel" style={{
          background: 'rgba(13,21,37,0.9)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          border: `1.5px solid ${current.accentColor}40`,
          borderRadius: '20px',
          padding: '3rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
          gap: '3.5rem',
          alignItems: 'center',
          boxShadow: `0 20px 56px rgba(0,0,0,0.5), 0 0 40px ${current.accentColor}0d`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Top accent */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: `linear-gradient(90deg, transparent, ${current.accentColor}, transparent)`,
            transition: 'background 400ms ease',
          }} />

          {/* Left — Content */}
          <div>
            {/* Tab Switcher */}
            <div className="site-tab-pills" style={{
              display: 'flex', gap: '4px',
              background: 'rgba(7,12,24,0.8)', padding: '4px', borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.5rem',
              width: 'fit-content', maxWidth: '100%', overflowX: 'auto',
            }}>
              {(['overview', 'specs', 'safety'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: activeTab === tab ? current.accentColor : 'transparent',
                    color: activeTab === tab ? '#060C18' : '#64748B',
                    border: 'none',
                    padding: '0.4rem 1rem',
                    borderRadius: '7px',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    transition: 'all 180ms ease',
                    fontFamily: 'var(--font-main)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tabLabels[tab]}
                </button>
              ))}
            </div>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.015em', marginBottom: '0.4rem' }}>
              {current.title}
            </h3>
            <p style={{ color: current.accentColor, fontWeight: 700, fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              {current.tagline}
            </p>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <>
                <p style={{ color: '#94A3B8', lineHeight: 1.8, fontSize: '0.9rem', marginBottom: '1.75rem' }}>
                  {current.description}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {current.specs.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#E2E8F0', fontSize: '0.875rem' }}>
                      <CheckCircle2 size={18} color={current.accentColor} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                      {s}
                    </div>
                  ))}
                </div>
              </>
            )}
            {activeTab === 'specs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '0.5rem 0 1.5rem' }}>
                {current.specs.map((s, i) => (
                  <div key={i} style={{
                    background: 'rgba(7,12,24,0.7)',
                    border: `1px solid ${current.accentColor}33`,
                    borderRadius: '10px',
                    padding: '0.85rem 1.1rem',
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    color: current.accentColor, fontWeight: 600, fontSize: '0.875rem',
                  }}>
                    <Cpu size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
                    {s}
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'safety' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '0.5rem 0 1.5rem' }}>
                {current.safety.map((s, i) => (
                  <div key={i} style={{
                    background: 'rgba(7,12,24,0.7)',
                    border: '1px solid rgba(96,165,250,0.2)',
                    borderRadius: '10px',
                    padding: '0.85rem 1.1rem',
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    color: '#60A5FA', fontWeight: 600, fontSize: '0.875rem',
                  }}>
                    <ShieldAlert size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
                    {s}
                  </div>
                ))}
              </div>
            )}

            <a
              href="#kontak"
              className="btn-primary"
              style={{
                marginTop: '1.75rem',
                background: current.accentColor,
                boxShadow: `0 4px 20px ${current.accentColor}55`,
                color: '#060C18',
              }}
            >
              {consultLabel}
              <ArrowRight size={17} strokeWidth={2.5} />
            </a>
          </div>

          {/* Right — Image */}
          <div style={{
            position: 'relative', borderRadius: '16px', overflow: 'hidden',
            height: '420px',
            border: `1px solid ${current.accentColor}33`,
            boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 30px ${current.accentColor}15`,
            transition: 'border-color 400ms ease, box-shadow 400ms ease',
          }}>
            <img
              src={current.image}
              alt={current.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 400ms ease' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(7,12,24,0.96) 0%, transparent 60%)',
            }} />
            <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', right: '1.5rem' }}>
              <span style={{
                background: current.accentColor, color: '#060C18',
                padding: '0.25rem 0.8rem', borderRadius: '6px',
                fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em',
              }}>
                REETHAU CLEAN ENERGY
              </span>
              <div style={{ color: '#FFFFFF', fontSize: '1.1rem', fontWeight: 800, marginTop: '0.5rem', letterSpacing: '-0.015em' }}>
                {current.title}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};