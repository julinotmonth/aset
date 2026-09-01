import React from 'react';
import { api } from '../lib/api';

export interface SiteMeta {
  key: string;
  label: string;
  subtitle: string;
  color: string;
  imageUrl: string;
  isDefault?: boolean;
  createdAt: string;
}

const FALLBACK_META = (key: string): SiteMeta => ({
  key,
  label: key.charAt(0).toUpperCase() + key.slice(1),
  subtitle: 'Site Operasional',
  color: '#94A3B8',
  imageUrl: '/assets/images/cng-cylinder.webp',
  createdAt: '',
});

const CHANGE_EVENT = 'reethau:sites-changed';

// Sites are fetched from the backend once (see initSitesStore, called on
// app boot) and kept here so every existing `getSites()` call site can stay
// perfectly synchronous — mutations hit the API, then update this cache and
// fire the change event so mounted components refresh immediately.
let cache: SiteMeta[] = [];
let loaded = false;

const notify = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
};

/** Fetches the current site list from the backend into the in-memory cache.
 * Call once after login, before any UI that reads getSites() renders. */
export async function initSitesStore(): Promise<SiteMeta[]> {
  cache = await api.get<SiteMeta[]>('/sites');
  loaded = true;
  notify();
  return cache;
}

export const isSitesStoreLoaded = (): boolean => loaded;

/** Synchronous read from the in-memory cache — populated by initSitesStore(). */
export const getSites = (): SiteMeta[] => cache;

export const getSiteMeta = (key: string): SiteMeta => cache.find((s) => s.key === key) ?? FALLBACK_META(key);

export const isKnownSite = (key: string): boolean => cache.some((s) => s.key === key);

export const isDefaultSite = (key: string): boolean => cache.find((s) => s.key === key)?.isDefault ?? false;

export const addSite = async (input: { label: string; subtitle?: string; color?: string; imageUrl?: string }): Promise<SiteMeta> => {
  const created = await api.post<SiteMeta>('/sites', input);
  cache = [...cache, created];
  notify();
  return created;
};

export const updateSite = async (key: string, patch: Partial<Omit<SiteMeta, 'key' | 'createdAt'>>): Promise<SiteMeta> => {
  const updated = await api.patch<SiteMeta>(`/sites/${encodeURIComponent(key)}`, patch);
  cache = cache.map((s) => (s.key === key ? updated : s));
  notify();
  return updated;
};

export const deleteSite = async (key: string): Promise<void> => {
  await api.delete(`/sites/${encodeURIComponent(key)}`);
  cache = cache.filter((s) => s.key !== key);
  notify();
};

/** Proxy-backed Record<string, string> so existing `SITE_LABEL[key]`-style
 * lookups (incl. Object.keys(), `in`, spreads) keep working unchanged, while
 * the underlying data stays fully dynamic (reads the live cache on every
 * access instead of a frozen snapshot). */
function createSiteRecordProxy(pick: (meta: SiteMeta) => string): Record<string, string> {
  return new Proxy({} as Record<string, string>, {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      return pick(getSiteMeta(prop));
    },
    has(_target, prop) {
      return typeof prop === 'string' && isKnownSite(prop);
    },
    ownKeys() {
      return getSites().map((s) => s.key);
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop === 'string' && isKnownSite(prop)) {
        return { enumerable: true, configurable: true, value: pick(getSiteMeta(prop)) };
      }
      return undefined;
    },
  });
}

export const SITE_LABEL = createSiteRecordProxy((m) => m.label);
export const SITE_SUB = createSiteRecordProxy((m) => m.subtitle);
export const SITE_IMAGE = createSiteRecordProxy((m) => m.imageUrl);
export const SITE_COLOR = createSiteRecordProxy((m) => m.color);

/** Forces the calling component to re-render whenever the site list changes
 * anywhere in the app (add/edit/delete/initial load) — even if this
 * component wasn't the one that made the change. Combine with a fresh
 * `getSites()` call in the render body to always show current data. */
export function useSitesRefresh(): number {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);
  return tick;
}
