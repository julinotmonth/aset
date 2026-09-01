export type SiteLocation = 'bekasi' | 'indramayu' | 'blora' | 'setu';
export type SiteFilter = SiteLocation | 'global';

// Kept as `string` (rather than a fixed union) so users can add their own categories
// from the Add/Edit Spare Part form. See src/data/categoryStore.ts for the default
// catalog, persistence of custom categories, and safe visual/icon lookups.
export type SparePartCategory = string;
export type ProductEnergyCategory = string;

export interface SparePart {
  id: string;
  sku: string;
  name: string;
  category: SparePartCategory;
  productEnergy: ProductEnergyCategory;
  site: SiteLocation;
  stock: number;
  minStock: number;
  unit: string;
  priceEstimate: number; // in IDR
  status: 'In Stock' | 'Low Stock' | 'Critical' | 'Maintenance Needed';
  lastInspected: string;
  specifications: string;
  imageUrl?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  action: 'TRANSFER' | 'STOCK_UPDATE' | 'ADD_SPARE_PART' | 'DELETE_SPARE_PART';
  description: string;
  performedBy: string;
  siteFrom?: SiteLocation;
  siteTo?: SiteLocation;
}

export interface AuthState {
  isAuthenticated: boolean;
  username: string;
  role: 'Super Admin' | 'Site Manager' | 'Maintenance Engineer';
  assignedSite: SiteFilter;
}

export type Language = 'IDN' | 'ENG';