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
  action: 'TRANSFER' | 'STOCK_UPDATE' | 'ADD_SPARE_PART' | 'DELETE_SPARE_PART' | 'ADD_FIXED_ASSET' | 'WORK_ORDER';
  description: string;
  performedBy: string;
  siteFrom?: SiteLocation;
  siteTo?: SiteLocation;
}

/** Capital / fixed assets (machinery, tanks, vehicles) tracked individually
 * with acquisition cost and depreciation — distinct from `SparePart`, which
 * is consumable stock counted by quantity. Depreciation fields are computed
 * server-side (straight-line) on every read, so the frontend never needs to
 * re-derive them. */
export interface FixedAsset {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  site: SiteLocation;
  acquisitionDate: string;
  acquisitionCost: number; // IDR
  usefulLifeYears: number;
  salvageValue: number; // IDR
  depreciationMethod: 'straight-line';
  status: 'Active' | 'Under Maintenance' | 'Retired' | 'Disposed';
  serialNumber?: string;
  warrantyExpiry?: string;
  notes: string;
  imageUrl?: string;
  createdAt: string;
  // Computed (straight-line depreciation), always current as of "now":
  annualDepreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
  depreciationPct: number;
  fullyDepreciated: boolean;
}

/** Dated, assignable preventive/corrective maintenance task against a
 * specific FixedAsset — distinct from SparePart.status === 'Maintenance
 * Needed', which is only a stock-level flag with no schedule or owner. */
export interface WorkOrder {
  id: string;
  assetId: string;
  title: string;
  type: 'Preventive' | 'Corrective' | 'Inspection';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled';
  dueDate: string;
  completedDate?: string;
  assignedTo?: string;
  notes: string;
  createdAt: string;
}

export interface ReportsSummary {
  totalAssets: number;
  totalAcquisitionValue: number;
  totalBookValue: number;
  totalAccumulatedDepreciation: number;
  totalInventoryValue: number;
  assetsByCategory: { category: string; acquisitionCost: number; bookValue: number; count: number }[];
  workOrders: { overdue: number; upcoming: number; completed: number; total: number };
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