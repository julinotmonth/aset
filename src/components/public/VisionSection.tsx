import React, { useState, useRef } from 'react';
import { Leaf, Factory, Truck, MapPin, X, Eye, ShieldCheck } from 'lucide-react';
import type { Language } from '../../types';
import { useScrollReveal } from '../../hooks/useScrollReveal';

interface VisionSectionProps { lang: Language; }

export const VisionSection: React.FC<VisionSectionProps> = ({ lang }) => {
  const [activeSite, setActiveSite] = useState<'Bekasi' | 'Indramayu' | 'Blora'>('Bekasi');
  const [selectedImage, setSelectedImage] = useState<{ src: string; caption: string; desc: string } | null>(null);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [hoveredGallery, setHoveredGallery] = useState<number | null>(null);
  const [hoveredStatus, setHoveredStatus] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useScrollReveal(sectionRef, '.reveal-item', [lang]);

  const siteDetails = {
    Bekasi: {
      title: 'Mother Station CNG Bekasi',
      role: 'Pusat Kompresi & Distribusi Utama JABODETABEK',
      desc: 'Fasilitas Mother Station berkapasitas kompresi tinggi yang menyalurkan gas alam terkompresi (CNG) ke berbagai kawasan industri manufaktur di Jawa Barat dan sekitarnya.',
      capacity: '3.5 MMSCFD',
      activeSpareParts: 142,
      image: '/assets/images/gallery-5.webp',
      features: ['24/7 High-pressure Compression', 'Dedicated Workshop & Test Bench', 'Real-time Telemetry Control Room'],
      statusColor: '#00D084',
      statusLabel: 'OPERATIONAL',
    },
    Indramayu: {
      title: 'Daughter Station & LNG Depot Indramayu',
      role: 'Hub De-kompresi & Depo Kriosfer LNG',
      desc: 'Stasiun penerimaan dan penurunan tekanan gas serta penyimpanan LNG berteknologi tinggi untuk mendukung efisiensi energi pabrik semen, keramik, dan tekstil.',
      capacity: '2.0 MMSCFD + Cryogenic',
      activeSpareParts: 98,
      image: '/assets/images/lng-storage.webp',
      features: ['Regasification Unit', 'Cryogenic Tanker Fleet Terminal', 'Automated Safety Pressure Valves'],
      statusColor: '#60A5FA',
      statusLabel: 'ACTIVE',
    },
    Blora: {
      title: 'Wellhead & Biomass Facility Blora',
      role: 'Sumur Gas Alam & Pabrik Pengolahan Biomassa',
      desc: 'Pusat ekstrasi sumur gas alam dan pengolahan limbah kayu menjadi woodchip dan biomassa terbarukan berkadar air rendah (<20%) dengan standar netral karbon.',
      capacity: '500 Tons Biomass/Mo + Gas',
      activeSpareParts: 85,
      image: '/assets/images/biomass.webp',
      features: ['Woodchip Drying & Sizing Line', 'Raw Gas Pre-treatment', 'Biomass Quality Control Lab'],
      statusColor: '#34D399',
      statusLabel: 'PRODUCTION',
    },
  };

  const galleryImages = [
    { src: '/assets/images/cng-cylinder.webp', caption: 'CNG Cylinder Storage', desc: 'Tabung gas alam bertekanan tinggi 250 Bar bersertifikasi uji tekan.' },
    { src: '/assets/images/distribution-truck.webp', caption: 'Logistics Fleet', desc: 'Armada truk pengangkut CNG & LNG terdistribusi 24/7.' },
    { src: '/assets/images/gallery-1.webp', caption: 'Compressor Engine', desc: 'Mesin kompresor gas tugas berat dengan perawatan berkala ketat.' },
    { src: '/assets/images/gallery-2.webp', caption: 'Control Station', desc: 'Stasiun pengatur tekanan dan aliran gas otomatis.' },
    { src: '/assets/images/gallery-3.webp', caption: 'Processing Plant', desc: 'Fasilitas pemurnian gas alam sebelum masuk ke sistem kompresi.' },
    { src: '/assets/images/gallery-4.webp', caption: 'Site Workshop', desc: 'Bengkel perawatan spare part valves, regulator & instrumen.' },
    { src: '/assets/images/gallery-5.webp', caption: 'Mother Station', desc: 'Pusat kompresi Mother Station utama Reethau.' },
    { src: '/assets/images/gallery-6.webp', caption: 'LNG Station Depot', desc: 'Depo penyimpanan dan regasifikasi LNG kriogenik.' },
  ];

  const c = {
    IDN: {
      overline: 'VISI, MISI & JARINGAN OPERASIONAL',
      h2a: 'Membentuk masa depan yang lebih',
      h2b: 'bersih dengan energi hijau',
      desc: 'Penggunaan sumber energi ramah lingkungan adalah langkah nyata menjaga kelestarian ekosistem dan keandalan industri nasional.',
      sitesLabel: 'Pusat Operasional Site Reethau:',
      inspectTitle: 'Inspeksi Fasilitas Site Reethau',
      galleryTitle: 'Galeri Infrastruktur & Operasional',
      gallerySub: 'Klik foto untuk memperbesar dan melihat rincian fasilitas',
      pillars: [
        { title: 'Ramah Lingkungan', text: 'Mengurangi emisi CO₂ hingga 30% dibanding solar melalui gas alam terkompresi dan biomassa netral karbon.' },
        { title: 'Keandalan Pasokan 24/7', text: 'Jaringan Mother & Daughter station menjamin suplai bahan bakar industri tanpa terputus sepanjang tahun.' },
        { title: 'Distribusi Non-Pipa', text: 'Logistik mobile CNG & LNG menjangkau lokasi industri terpencil yang belum terhubung jaringan pipa gas.' },
      ],
    },
    ENG: {
      overline: 'VISION, MISSION & OPERATIONAL NETWORK',
      h2a: 'Shaping a cleaner future with',
      h2b: 'green energy solutions',
      desc: 'Utilizing environmentally friendly energy sources is vital to preserving our ecosystem and sustaining industrial power.',
      sitesLabel: 'Reethau Operational Sites Network:',
      inspectTitle: 'Reethau Operational Sites Inspection',
      galleryTitle: 'Field Infrastructure & Operations Gallery',
      gallerySub: 'Click any photo to enlarge and view facility details',
      pillars: [
        { title: 'Eco-Friendly', text: 'Lowering CO₂ emissions up to 30% versus diesel through compressed natural gas and carbon-neutral biomass.' },
        { title: '24/7 Supply Guarantee', text: 'Integrated Mother & Daughter station logistics ensuring round-the-clock uninterrupted fuel delivery.' },
        { title: 'Off-Grid Delivery', text: 'Mobile CNG & LNG transport serving remote industrial facilities beyond traditional gas pipelines.' },
      ],
    },
  }[lang];

  const pillarIcons = [
    <Leaf size={26} strokeWidth={2} />,
    <Factory size={26} strokeWidth={2} />,
    <Truck size={26} strokeWidth={2} />,
  ];

  const currentSite = siteDetails[activeSite];

  const statusStrip: { key: 'Bekasi' | 'Indramayu' | 'Blora'; status: string }[] = [
    { key: 'Bekasi', status: lang === 'IDN' ? '24/7 Pasokan Aktif' : '24/7 Active Supply' },
    { key: 'Indramayu', status: lang === 'IDN' ? 'Stasiun Tekanan Tinggi' : 'High Pressure Station' },
    { key: 'Blora', status: lang === 'IDN' ? 'Feedstock Aktif' : 'Feedstock Active' },
  ];

  return (
    <section
      ref={sectionRef}
      id="tentang"
      className="section-x-pad"
      style={{ padding: '7rem 2rem', background: 'var(--bg-root)', position: 'relative', overflow: 'hidden' }}
    >
      {/* Subtle background accent */}
      <div style={{
        position: 'absolute', top: '20%', left: '-10%', width: '40%', paddingBottom: '40%',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,208,132,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '1320px', margin: '0 auto', position: 'relative' }}>

        {/* Section Header */}
        <div className="reveal-item" style={{ maxWidth: '760px', marginBottom: '2.5rem' }}>
          <div className="section-label">{c.overline}</div>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 800, marginTop: '0.5rem', lineHeight: 1.15 }}>
            {c.h2a} <span style={{ color: '#00D084' }}>{c.h2b}</span>
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '1.05rem', marginTop: '1rem', lineHeight: 1.8 }}>
            {c.desc}
          </p>
        </div>

        {/* ── QUICK SITE STATUS STRIP (moved here from Hero) ── */}
        <div className="reveal-item" style={{ marginBottom: '3.5rem' }}>
          <div style={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#475569', marginBottom: '0.75rem' }}>
            {c.sitesLabel}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '0.75rem' }}>
            {statusStrip.map((s, i) => {
              const detail = siteDetails[s.key];
              const isActive = activeSite === s.key;
              const isHovered = hoveredStatus === i;
              return (
                <button
                  key={s.key}
                  className="glass-panel glass-panel-hover"
                  aria-pressed={isActive}
                  onClick={() => setActiveSite(s.key)}
                  onMouseEnter={() => setHoveredStatus(i)}
                  onMouseLeave={() => setHoveredStatus(null)}
                  style={{
                    padding: '0.7rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.7rem', cursor: 'pointer',
                    textAlign: 'left', font: 'inherit', color: 'inherit',
                    border: isActive || isHovered ? '1.5px solid rgba(0,208,132,0.55)' : undefined,
                    boxShadow: isActive ? '0 0 0 1px rgba(0,208,132,0.2), 0 0 24px rgba(0,208,132,0.18)' : undefined,
                    transform: isActive ? 'translateY(-2px)' : undefined,
                    transition: 'all 0.25s var(--ease-out-expo)',
                  }}
                >
                  <div style={{
                    width: '34px', height: '34px', flexShrink: 0,
                    borderRadius: '9px',
                    background: 'rgba(0,208,132,0.1)',
                    border: '1px solid rgba(0,208,132,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#00D084',
                  }}>
                    <MapPin size={16} strokeWidth={2} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#FFFFFF' }}>Site {s.key}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{detail.role}</div>
                    <div style={{ fontSize: '0.66rem', color: detail.statusColor, fontWeight: 700, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%', background: detail.statusColor, display: 'inline-block',
                        animation: 'pulseGlow 1.8s ease-in-out infinite',
                      }} />
                      {s.status}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 3 PILLAR CARDS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '1.5rem', marginBottom: '5rem' }}>
          {c.pillars.map((card, i) => (
            <div
              key={i}
              className="card-pillar reveal-item"
              style={{ cursor: 'default' }}
              onMouseEnter={() => setHoveredCard(i)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              {/* Icon */}
              <div style={{
                width: '54px', height: '54px',
                borderRadius: '14px',
                background: hoveredCard === i ? 'rgba(0,208,132,0.18)' : 'rgba(0,208,132,0.1)',
                border: `1px solid ${hoveredCard === i ? 'rgba(0,208,132,0.5)' : 'rgba(0,208,132,0.25)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#00D084',
                marginBottom: '1.5rem',
                transition: 'all 250ms ease',
                boxShadow: hoveredCard === i ? '0 0 20px rgba(0,208,132,0.3)' : 'none',
              }}>
                {pillarIcons[i]}
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.75rem' }}>
                {card.title}
              </h3>
              <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.75 }}>{card.text}</p>
            </div>
          ))}
        </div>

        {/* ── INTERACTIVE SITE INSPECTOR ── */}
        <div className="reveal-item product-panel" style={{
          background: 'rgba(13,21,37,0.85)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          border: '1.5px solid rgba(0,208,132,0.25)',
          borderRadius: '20px',
          padding: '2.5rem',
          marginBottom: '5rem',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: 'linear-gradient(90deg, transparent, #00D084, transparent)',
          }} />

          {/* Inspector Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <div className="section-label">LIVE SITE INSPECTION</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFFFFF', marginTop: '0.25rem' }}>
                {c.inspectTitle}
              </h3>
            </div>
            {/* Tab Pills */}
            <div className="site-tab-pills" style={{
              display: 'flex', gap: '4px',
              background: 'rgba(7,12,24,0.8)', padding: '4px',
              borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.07)',
              maxWidth: '100%', overflowX: 'auto',
            }}>
              {(['Bekasi', 'Indramayu', 'Blora'] as const).map(site => (
                <button
                  key={site}
                  onClick={() => setActiveSite(site)}
                  style={{
                    background: activeSite === site ? '#00D084' : 'transparent',
                    color: activeSite === site ? '#060C18' : '#94A3B8',
                    border: 'none',
                    padding: '0.55rem 1.35rem',
                    borderRadius: '9999px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 220ms ease',
                    fontFamily: 'var(--font-main)',
                    boxShadow: activeSite === site ? '0 0 16px rgba(0,208,132,0.5)' : 'none',
                  }}
                >
                  {site}
                </button>
              ))}
            </div>
          </div>

          {/* Site Content */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '2.5rem', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#00D084', fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.85rem' }}>
                <MapPin size={14} />
                {currentSite.role}
              </div>
              <h4 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1rem', letterSpacing: '-0.015em' }}>
                {currentSite.title}
              </h4>
              <p style={{ color: '#94A3B8', lineHeight: 1.75, fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                {currentSite.desc}
              </p>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.9rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(0,208,132,0.08)', border: '1px solid rgba(0,208,132,0.25)', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Kapasitas Operasional</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#00D084', marginTop: '4px' }}>{currentSite.capacity}</div>
                </div>
                <div style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Spare Part MS Active</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#60A5FA', marginTop: '4px' }}>{currentSite.activeSpareParts} Items</div>
                </div>
              </div>

              {/* Features */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {currentSite.features.map((feat, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#CBD5E1', fontSize: '0.875rem' }}>
                    <ShieldCheck size={15} color="#00D084" strokeWidth={2.5} />
                    {feat}
                  </div>
                ))}
              </div>
            </div>

            {/* Image Panel */}
            <div style={{
              position: 'relative', borderRadius: '16px', overflow: 'hidden',
              height: '340px',
              border: '1px solid rgba(0,208,132,0.2)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            }}>
              <img src={currentSite.image} alt={currentSite.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(7,12,24,0.95) 0%, transparent 55%)' }} />
              <div style={{ position: 'absolute', bottom: '1.25rem', left: '1.25rem', right: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.875rem' }}>{currentSite.title}</span>
                <span style={{
                  background: currentSite.statusColor, color: '#060C18',
                  padding: '0.2rem 0.7rem', borderRadius: '9999px',
                  fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em',
                }}>
                  {currentSite.statusLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── GALLERY ── */}
        <div className="reveal-item">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div className="section-label" style={{ justifyContent: 'center' }}>INTERACTIVE GALLERY</div>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FFFFFF', marginTop: '0.5rem' }}>
              {c.galleryTitle}
            </h3>
            <p style={{ color: '#64748B', fontSize: '0.875rem', marginTop: '0.5rem' }}>{c.gallerySub}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '1rem' }}>
            {galleryImages.map((img, i) => (
              <div
                key={i}
                onClick={() => setSelectedImage(img)}
                onMouseEnter={() => setHoveredGallery(i)}
                onMouseLeave={() => setHoveredGallery(null)}
                style={{
                  position: 'relative',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  height: '190px',
                  border: hoveredGallery === i ? '1px solid rgba(0,208,132,0.5)' : '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  transition: 'all 250ms var(--ease-out-expo)',
                  transform: hoveredGallery === i ? 'scale(1.03) translateY(-3px)' : 'scale(1)',
                  boxShadow: hoveredGallery === i ? '0 16px 40px rgba(0,0,0,0.5), 0 0 20px rgba(0,208,132,0.1)' : '0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                <img src={img.src} alt={img.caption} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 350ms ease' }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  background: hoveredGallery === i
                    ? 'linear-gradient(to top, rgba(7,12,24,0.95) 0%, rgba(7,12,24,0.3) 100%)'
                    : 'linear-gradient(to top, rgba(7,12,24,0.88) 0%, transparent 55%)',
                  transition: 'background 250ms ease',
                  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0.9rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.82rem' }}>{img.caption}</span>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: hoveredGallery === i ? '#00D084' : 'rgba(0,208,132,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: hoveredGallery === i ? '#060C18' : '#00D084',
                      transition: 'all 200ms ease',
                    }}>
                      <Eye size={13} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── LIGHTBOX ── */}
      {selectedImage && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(4,8,18,0.92)',
            backdropFilter: 'blur(16px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '2rem',
            animation: 'fadeIn 0.25s ease',
          }}
          onClick={() => setSelectedImage(null)}
        >
          <div
            style={{
              position: 'relative', maxWidth: '860px', width: '100%',
              background: '#111827',
              border: '1px solid rgba(0,208,132,0.3)',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(0,208,132,0.1)',
              animation: 'fadeInUp 0.3s var(--ease-out-expo)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              style={{
                position: 'absolute', top: '1rem', right: '1rem', zIndex: 10,
                width: '40px', height: '40px', borderRadius: '50%',
                background: 'rgba(7,12,24,0.8)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#FFFFFF', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <img src={selectedImage.src} alt={selectedImage.caption} style={{ width: '100%', maxHeight: '500px', objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: '1.75rem' }}>
              <div className="section-label">FASILITAS LAPANGAN REETHAU</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFFFFF', marginTop: '0.5rem' }}>{selectedImage.caption}</h3>
              <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: 1.7 }}>{selectedImage.desc}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
