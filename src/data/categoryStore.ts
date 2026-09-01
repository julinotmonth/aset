import { Gauge, Cylinder, SlidersHorizontal, GitBranch, Radar, Filter, Package, Flame, Droplet, Leaf } from 'lucide-react';
import type { ElementType } from 'react';

// ---- Default category catalogs -------------------------------------------------

export const DEFAULT_SPARE_PART_CATEGORIES: string[] = [
  'Compressors',
  'Cylinders & Storage',
  'Valves & Control',
  'Piping & Connectors',
  'Instruments & Sensors',
  'Filtration & Purification',
];

export const DEFAULT_PRODUCT_ENERGY_CATEGORIES: string[] = ['CNG', 'LNG', 'Biomass'];

export const CATEGORY_VISUAL: Record<string, { icon: ElementType; color: string; bg: string }> = {
  'Compressors': { icon: Gauge, color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.12)' },
  'Cylinders & Storage': { icon: Cylinder, color: '#F472B6', bg: 'rgba(244, 114, 182, 0.12)' },
  'Valves & Control': { icon: SlidersHorizontal, color: '#00D084', bg: 'rgba(0, 208, 132, 0.12)' },
  'Piping & Connectors': { icon: GitBranch, color: '#A3E635', bg: 'rgba(163, 230, 53, 0.12)' },
  'Instruments & Sensors': { icon: Radar, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  'Filtration & Purification': { icon: Filter, color: '#818CF8', bg: 'rgba(129, 140, 248, 0.12)' },
};

export const PRODUCT_ENERGY_VISUAL: Record<string, { icon: ElementType; color: string; bg: string }> = {
  'CNG': { icon: Flame, color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.12)' },
  'LNG': { icon: Droplet, color: '#818CF8', bg: 'rgba(129, 140, 248, 0.12)' },
  'Biomass': { icon: Leaf, color: '#A3E635', bg: 'rgba(163, 230, 53, 0.12)' },
};

const FALLBACK_VISUAL = { icon: Package, color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.12)' };

/** Safe lookup that always returns a visual, even for user-added categories. */
export const getCategoryVisual = (name: string) => CATEGORY_VISUAL[name] ?? FALLBACK_VISUAL;
export const getProductEnergyVisual = (name: string) => PRODUCT_ENERGY_VISUAL[name] ?? FALLBACK_VISUAL;

// ---- Category persistence (backend-backed, in-memory cache) -------------------
import React from 'react';
import { api } from '../lib/api';

const CHANGE_EVENT = 'reethau:categories-changed';
const notify = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT)); };

let cache: { sparePart: string[]; productEnergy: string[] } = {
  sparePart: [...DEFAULT_SPARE_PART_CATEGORIES],
  productEnergy: [...DEFAULT_PRODUCT_ENERGY_CATEGORIES],
};
let loaded = false;

/** Fetches the current category lists from the backend into the in-memory
 * cache. Call once after login, before any UI that reads getX Categories()
 * renders — same pattern as initSitesStore(). */
export async function initCategoriesStore(): Promise<typeof cache> {
  cache = await api.get('/categories');
  loaded = true;
  notify();
  return cache;
}

export const isCategoriesStoreLoaded = (): boolean => loaded;

/** Returns default + previously-added custom categories, de-duplicated. */
export const getSparePartCategories = (): string[] => Array.from(new Set(cache.sparePart));

export const getProductEnergyCategories = (): string[] => Array.from(new Set(cache.productEnergy));

/** Adds a new spare part category and persists it server-side. */
export const addSparePartCategory = async (name: string): Promise<void> => {
  const trimmed = name.trim();
  if (!trimmed) return;
  const { sparePart } = await api.post<{ sparePart: string[] }>('/categories/spare-part', { name: trimmed });
  cache = { ...cache, sparePart };
  notify();
};

/** Adds a new product energy category and persists it server-side. */
export const addProductEnergyCategory = async (name: string): Promise<void> => {
  const trimmed = name.trim();
  if (!trimmed) return;
  const { productEnergy } = await api.post<{ productEnergy: string[] }>('/categories/product-energy', { name: trimmed });
  cache = { ...cache, productEnergy };
  notify();
};

/** Forces the calling component to re-render whenever categories change
 * anywhere in the app (add/initial load). */
export function useCategoriesRefresh(): number {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);
  return tick;
}
