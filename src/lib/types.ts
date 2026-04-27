// Core TypeScript interfaces for the Tunzone platform

/** Mirrors Laravel PlanEntitlements::toPublicArray (camelCase). */
export interface PlanEntitlementsSnapshot {
  planTier: string;
  trialEndsAt?: string | null;
  onTrial: boolean;
  aiChatMonthlyLimit: number | null;
  aiChatRemaining: number | null;
  image3dMonthlyLimit: number;
  image3dRemaining: number;
  inFirstImage3dBonusWindow: boolean;
  publishedLayouts?: boolean;
  customTheme?: boolean;
  bespokeDesign?: boolean;
}

export interface PublicSiteTexts {
  heroTitle?: string;
  heroSubtitle?: string;
  primaryCta?: string;
  secondaryCta?: string;
  catalogTitle?: string;
  catalogSubtitle?: string;
  plannersTitle?: string;
  plannersSubtitle?: string;
  materialsTitle?: string;
  materialsSubtitle?: string;
  footerTagline?: string;
}

export interface PublicSiteTheme {
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
}

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  companyName: string;
  slug: string;
  selectedModeId: string | null;
  selectedSubModeIds: string[];
  logo?: string;
  language: "en" | "ru";
  currency: string;
  paypalEmail?: string;
  /** When set and non-empty, public planners only offer these material ids; null/omitted = all materials. */
  plannerMaterialIds?: string[] | null;
  /**
   * When true, the published site only uses this store’s own catalog in room planners; when false, platform defaults are merged in.
   */
  useCustomPlannerCatalog?: boolean;
  publicSiteLayout?: string;
  publicSiteTexts?: PublicSiteTexts;
  publicSiteTheme?: PublicSiteTheme;
  customDesignKey?: string | null;
  createdAt: string;
  planTier?: string;
  trialEndsAt?: string | null;
  entitlements?: PlanEntitlementsSnapshot;
}

export interface SubMode {
  id: string;
  modeId: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  isActive: boolean;
}

export interface Mode {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  isActive: boolean;
  subModes: SubMode[];
}

export interface CatalogItem {
  id: string;
  adminId: string;
  modeId: string;
  subModeId: string;
  name: string;
  model?: string;
  description: string;
  images: string[];
  sizes: {
    width: number;
    height: number;
    depth: number;
    unit: "cm" | "inch";
  };
  price: number;
  currency: string;
  deliveryDays: number;
  category: string;
  availableColors?: Array<{ name: string; hex: string }>;
  modelUrl?: string;
  modelJobId?: string;
  modelStatus?: 'queued' | 'processing' | 'done' | 'failed';
  modelError?: string;
  isActive: boolean;
  createdAt: string;
}

/** Which axis of the sheet the grain runs along, or "none" for random-rotatable. */
export type MaterialGrainDirection = "along_width" | "along_height" | "none";

export interface Material {
  id: string;
  adminId: string;
  modeId: string;
  subModeId?: string;
  name: string;
  type: string;
  /** Set when imported from a manufacturer catalog template. */
  manufacturer?: string | null;
  /** All catalog types this line applies to (e.g. laminate + MDF). */
  types?: string[];
  /** First category (legacy); prefer `categories` when present. */
  category: string;
  /** All roles this material applies to (frame, door, etc.). */
  categories?: string[];
  color: string;
  colorHex: string;
  colorCode: string;
  price: number;
  pricePerUnit: number;
  currency: string;
  unit: string;
  image?: string;
  imageUrl?: string;
  /**
   * Laminate / MDF / wood / worktop sheet metadata. Nullable in the DB; the
   * backend resource coalesces to 360 × 180 cm / along_width / 3 mm and
   * the frontend `getSheetSpec` mirrors these fallbacks so every consumer
   * sees the same defaults.
   */
  sheetWidthCm?: number;
  sheetHeightCm?: number;
  grainDirection?: MaterialGrainDirection;
  kerfMm?: number;
  isActive: boolean;
}

/** Global decor template (seeded); not tied to an admin until imported. */
export interface MaterialTemplate {
  id: string;
  manufacturer: string;
  externalCode?: string | null;
  name: string;
  type: string;
  /** When set, import uses these slugs (e.g. laminate + mdf). */
  types?: string[];
  category: string;
  categories?: string[];
  color: string;
  colorHex?: string | null;
  colorCode?: string | null;
  unit: string;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  sheetWidthCm?: number | null;
  sheetHeightCm?: number | null;
  grainDirection?: MaterialGrainDirection | null;
  kerfMm?: number | null;
  sortOrder: number;
}

export interface Module {
  id: string;
  adminId: string;
  modeId: string;
  subModeId: string;
  name: string;
  description: string;
  images: string[];
  imageUrl?: string;
  sizes: {
    width: number;
    height: number;
    depth: number;
    unit: "cm" | "inch";
  };
  dimensions?: {
    width: number;
    height: number;
    depth: number;
    unit: string;
  };
  price: number;
  currency: string;
  category: string;
  connectionPoints: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
  compatibleWith: string[];
  isActive: boolean;
  modelUrl?: string;
  modelJobId?: string;
  modelStatus?: 'queued' | 'processing' | 'done' | 'failed';
  modelError?: string;
  placementType: 'floor' | 'wall';
  isConfigurableTemplate?: boolean;
  pricingBodyWeight?: number;
  pricingDoorWeight?: number;
  defaultCabinetMaterialId?: string;
  defaultDoorMaterialId?: string;
  defaultHandleId?: string;
  templateOptions?: Array<{
    id: string;
    label: string;
    priceDelta: number;
    defaultSelected?: boolean;
  }>;
  allowedHandleIds?: string[];
}

export interface OrderItem {
  itemType: "catalog" | "module" | "custom";
  itemId?: string;
  name: string;
  quantity: number;
  price: number;
  selectedMaterials?: string[];
  customData?: object;
}

export interface Order {
  id: string;
  adminId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  type: "catalog" | "module" | "custom";
  items: OrderItem[];
  totalPrice: number;
  currency: string;
  status: "pending" | "confirmed" | "reviewed" | "quoted" | "accepted" | "rejected";
  paymentStatus?: "pending" | "paid" | "failed";
  paypalTransactionId?: string;
  notes?: string;
  createdAt: string;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  companyName: string;
}
