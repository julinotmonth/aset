import React from 'react';
import type { GalleryItem, SiteLocation } from '../types';
import { api } from '../lib/api';

const EVENT_NAME = 'reethau:gallery-changed';
const notify = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT_NAME)); };

// Photos are fetched from the backend once (see initGalleryStore, called on
// app boot) and kept here so `getGallery()` can stay perfectly synchronous
// for every existing call site — mutations hit the API, then update this
// cache and fire the change event so mounted components refresh immediately.
let cache: GalleryItem[] = [];
let loaded = false;

/** Fetches every gallery photo from the backend into the in-memory cache.
 * Call once after login, before any UI that reads getGallery() renders. */
export async function initGalleryStore(): Promise<GalleryItem[]> {
  cache = await api.get<GalleryItem[]>('/gallery');
  loaded = true;
  notify();
  return cache;
}

export const isGalleryStoreLoaded = (): boolean => loaded;

/** All gallery photos across every site (defaults + user-uploaded). */
export const getGallery = (): GalleryItem[] => cache;

export const getGalleryBySite = (site: SiteLocation): GalleryItem[] => cache.filter((g) => g.site === site);

export const isDefaultGalleryItem = (id: string): boolean =>
  cache.find((g) => g.id === id)?.isDefault ?? false;

export const addGalleryItem = async (input: {
  site: SiteLocation;
  src: string;
  caption: string;
  description?: string;
  uploadedBy?: string;
}): Promise<GalleryItem> => {
  const created = await api.post<GalleryItem>('/gallery', input);
  cache = [created, ...cache];
  notify();
  return created;
};

export const deleteGalleryItem = async (id: string): Promise<void> => {
  await api.delete(`/gallery/${encodeURIComponent(id)}`);
  cache = cache.filter((g) => g.id !== id);
  notify();
};

/** Re-renders the calling component whenever the gallery changes anywhere
 * in the app (upload/delete/initial load). */
export function useGalleryRefresh(): number {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);
  return tick;
}
