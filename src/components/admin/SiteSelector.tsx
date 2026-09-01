import React from 'react';
import { MapPin, Globe } from 'lucide-react';
import type { SiteFilter } from '../../types';
import { getSites, useSitesRefresh } from '../../data/siteStore';

interface SiteSelectorProps {
  currentSite: SiteFilter;
  onSiteChange: (site: SiteFilter) => void;
  siteCounts: Record<string, number>;
}

export const SiteSelector: React.FC<SiteSelectorProps> = ({ currentSite, onSiteChange, siteCounts }) => {
  // Re-renders this component the instant a site is added/edited/deleted
  // anywhere in the app, so the list below is never stale.
  useSitesRefresh();

  const sites: { id: SiteFilter; label: string; sub: string; count: number; image: string }[] = [
    {
      id: 'global',
      label: 'Semua Site (Global)',
      sub: 'Ikhtisar Seluruh Aset',
      count: siteCounts.global ?? 0,
      image: '/assets/images/gallery-6.webp',
    },
    ...getSites().map((s) => ({
      id: s.key,
      label: `Site ${s.label}`,
      sub: s.subtitle,
      count: siteCounts[s.key] ?? 0,
      image: s.imageUrl,
    })),
  ];

  return (
    <div className="site-grid">
      {sites.map((s) => {
        const isActive = currentSite === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSiteChange(s.id)}
            className={`site-card${isActive ? ' active' : ''}`}
          >
            <div className="site-card-bg" style={{ backgroundImage: `url(${s.image})` }} />
            <div className="site-card-overlay" />
            <div className="site-card-content">
              <div>
                <div className="site-card-label">
                  {s.id === 'global' ? <Globe size={16} /> : <MapPin size={16} />}
                  {s.label}
                </div>
                <div className="site-card-sub">{s.sub}</div>
              </div>
              <span className="site-card-count">{s.count}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};