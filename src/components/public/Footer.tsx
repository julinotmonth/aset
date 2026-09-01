import React, { useRef, useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { MapPin, Mail, Phone, Lock, ArrowUpRight, QrCode } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

interface FooterProps { onOpenAdminLogin: () => void; }

export const Footer: React.FC<FooterProps> = ({ onOpenAdminLogin }) => {
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const footerRef = useRef<HTMLElement>(null);

  useScrollReveal(footerRef, '.reveal-item', [], { y: 20, start: 'top 92%' });

  useEffect(() => {
    const target = typeof window !== 'undefined' ? window.location.href : 'https://reethau.id';
    QRCode.toDataURL(target, {
      width: 240,
      margin: 1,
      color: { dark: '#0A0F1D', light: '#FFFFFFFF' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, []);

  const sites = [
    {
      name: 'Site Bekasi (Mother Station)',
      detail: 'Kawasan Industri Bekasi, Jawa Barat. Pusat Kompresi Utama CNG.',
    },
    {
      name: 'Site Indramayu (Daughter Station)',
      detail: 'Depo Kriogenik LNG & Stasiun Regasifikasi.',
    },
    {
      name: 'Site Blora (Wellhead & Biomass)',
      detail: 'Fasilitas Ekstraksi Gas Sumur & Woodchip Processing.',
    },
    {
      name: 'Site Setu (Compressor Station)',
      detail: 'Fleet Room & Stasiun Kompresi CNG, Setu, Bekasi.',
    },
  ];

  const footerLinks = ['Kebijakan Privasi', 'Syarat & Ketentuan', 'Sertifikasi HSE'];

  return (
    <footer
      ref={footerRef}
      id="kontak"
      className="section-x-pad"
      style={{
        background: 'var(--bg-root)',
        borderTop: '1px solid rgba(0,208,132,0.2)',
        padding: '6rem 2rem 2.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent glow */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '60%', height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(0,208,132,0.6), transparent)',
        boxShadow: '0 0 20px rgba(0,208,132,0.4)',
      }} />

      <div style={{ maxWidth: '1320px', margin: '0 auto' }}>
        {/* Top section: 3-column grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
          gap: '4rem',
          marginBottom: '4.5rem',
        }}>

          {/* Brand Column */}
          <div className="reveal-item">
            <div style={{ marginBottom: '1.5rem' }}>
              <img
                src="/assets/images/logo-white.webp"
                alt="PT Reethau Clean Energy"
                style={{ height: '52px', objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(0,208,132,0.3))' }}
              />
            </div>
            <p style={{ color: '#64748B', fontSize: '0.875rem', lineHeight: 1.75, marginBottom: '1.75rem', maxWidth: '340px' }}>
              PT Reethau Clean Energy bergerak di bidang pengolahan dan penyaluran gas alam (CNG, LNG) serta energi biomassa terbarukan untuk mendukung industri hijau Indonesia.
            </p>

            {/* Portal Button */}
            <button
              onClick={onOpenAdminLogin}
              style={{
                background: 'rgba(0,208,132,0.08)',
                color: '#00D084',
                border: '1px solid rgba(0,208,132,0.3)',
                padding: '0.7rem 1.25rem',
                borderRadius: '12px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                transition: 'all 220ms ease',
                fontFamily: 'var(--font-main)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#00D084';
                e.currentTarget.style.color = '#060C18';
                e.currentTarget.style.boxShadow = '0 0 24px rgba(0,208,132,0.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(0,208,132,0.08)';
                e.currentTarget.style.color = '#00D084';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <Lock size={14} />
              Portal Inventory MS & Spare Parts
              <ArrowUpRight size={14} />
            </button>

            {/* Scan-to-visit QR badge */}
            <div
              style={{
                marginTop: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                padding: '0.75rem',
                maxWidth: '300px',
              }}
            >
              <div
                style={{
                  width: '58px', height: '58px', flexShrink: 0,
                  borderRadius: '10px', overflow: 'hidden',
                  background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code Situs Reethau" style={{ width: '100%', height: '100%' }} />
                ) : (
                  <QrCode size={22} color="#0A0F1D" />
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#E2E8F0', fontWeight: 700, fontSize: '0.78rem' }}>Pindai untuk membuka situs</div>
                <div style={{ color: '#64748B', fontSize: '0.72rem', lineHeight: 1.5 }}>Akses cepat dari perangkat mobile Anda</div>
              </div>
            </div>
          </div>

          {/* Sites Column */}
          <div className="reveal-item">
            <h4 style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '1rem', marginBottom: '1.5rem', letterSpacing: '-0.01em' }}>
              Jaringan Site Operasional
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {sites.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.85rem' }}>
                  <div style={{
                    width: '32px', height: '32px', flexShrink: 0,
                    borderRadius: '8px',
                    background: 'rgba(0,208,132,0.1)',
                    border: '1px solid rgba(0,208,132,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: '1px',
                  }}>
                    <MapPin size={14} color="#00D084" />
                  </div>
                  <div>
                    <div style={{ color: '#E2E8F0', fontWeight: 700, fontSize: '0.875rem', marginBottom: '2px' }}>{s.name}</div>
                    <div style={{ color: '#64748B', fontSize: '0.8rem', lineHeight: 1.6 }}>{s.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Column */}
          <div className="reveal-item">
            <h4 style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '1rem', marginBottom: '1.5rem', letterSpacing: '-0.01em' }}>
              Head Office & Marketing
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', marginBottom: '2rem' }}>
              <p style={{ color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.7 }}>
                <span style={{ color: '#E2E8F0', fontWeight: 600 }}>Head Office:</span><br />
                Jl. Darmawangsa Raya No. 8, Kebayoran Baru<br />
                Jakarta Selatan 12160
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#94A3B8', fontSize: '0.875rem' }}>
                <Mail size={16} color="#00D084" strokeWidth={2} />
                marketing@reethau.com
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#94A3B8', fontSize: '0.875rem' }}>
                <Phone size={16} color="#00D084" strokeWidth={2} />
                +62 21 723 1238 / 720 7130
              </div>
            </div>

            {/* ISO Badge */}
            <div>
              <div style={{ color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: '0.75rem' }}>
                Sertifikasi Mutu ISO
              </div>
              <img
                src="/assets/images/certificate.webp"
                alt="ISO Certificate"
                style={{ height: '56px', objectFit: 'contain', opacity: 0.85 }}
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '2rem' }} />

        {/* Bottom Bar */}
        <div className="reveal-item" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '1rem',
        }}>
          <div style={{ color: '#475569', fontSize: '0.78rem' }}>
            © {new Date().getFullYear()} PT Reethau Clean Energy. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: '1.75rem' }}>
            {footerLinks.map(link => (
              <a
                key={link}
                href="#"
                style={{
                  color: hoveredLink === link ? '#00D084' : '#475569',
                  textDecoration: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  transition: 'color 180ms ease',
                }}
                onMouseEnter={() => setHoveredLink(link)}
                onMouseLeave={() => setHoveredLink(null)}
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};
