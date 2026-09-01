/** A site key is now a dynamic slug (e.g. "bekasi", or any custom site an
 * admin adds later) rather than a fixed set — see src/data/siteStore.ts. */
export type SiteLocation = string;
export type SiteFilter = SiteLocation | 'global';

export type SparePartCategory = 
  | 'Compressors' 
  | 'Cylinders & Storage' 
  | 'Valves & Control' 
  | 'Piping & Connectors' 
  | 'Instruments & Sensors' 
  | 'Filtration & Purification';

export type ProductEnergyCategory = 'CNG' | 'LNG' | 'Biomass';

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

export type UserRole = 'Super Admin' | 'Site Manager' | 'Maintenance Engineer';

export interface GalleryItem {
  id: string;
  site: SiteLocation;
  src: string;
  caption: string;
  description?: string;
  uploadedBy?: string;
  isDefault?: boolean;
  createdAt: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  /** Freeform display title, e.g. "Site Manager Bekasi" or "Admin Inventaris". */
  position: string;
  /** Permission tier — controls what the account can access. */
  role: UserRole;
  assignedSite: SiteFilter;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  userId?: string;
  username: string;
  role: UserRole;
  assignedSite: SiteFilter;
  avatarUrl?: string;
  position?: string;
}

export type Language = 'IDN' | 'ENG';