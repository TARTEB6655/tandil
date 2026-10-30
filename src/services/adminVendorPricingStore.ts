/** Local draft vendor pricing until admin vendor-pricing APIs exist. */

import type { ServicePriceIncludes } from './servicePricingService';

export type AdminVendorAreaPricingType = 'fixed' | 'per_m2';

export const DEFAULT_ADMIN_VENDOR_PRICE_INCLUDES: ServicePriceIncludes = {
  materials: true,
  installation: true,
  labor: true,
  transportation: false,
  delivery: false,
};

export interface AdminVendorPricingDraft {
  /** Show area/fixed pricing on customer products & services (`show_on_client_products_services`). */
  areaShowOnClient: boolean;
  areaPricingType: AdminVendorAreaPricingType;
  fixedPrice: string;
  pricePerM2: string;
  areaPriceIncludes: ServicePriceIncludes;
  treePalmEnabled: boolean;
  pricePerTree: string;
  pricePerPalm: string;
  treePalmPriceIncludes: ServicePriceIncludes;
  updatedAt: string;
}

const drafts = new Map<string, AdminVendorPricingDraft>();

export function getAdminVendorPricingDraft(vendorId: string): AdminVendorPricingDraft | null {
  const key = String(vendorId).trim();
  if (!key) return null;
  return drafts.get(key) ?? null;
}

export function setAdminVendorPricingDraft(
  vendorId: string,
  draft: Omit<AdminVendorPricingDraft, 'updatedAt'>
): AdminVendorPricingDraft {
  const key = String(vendorId).trim();
  const saved: AdminVendorPricingDraft = {
    ...draft,
    updatedAt: new Date().toISOString(),
  };
  drafts.set(key, saved);
  return saved;
}

export function listAdminVendorPricingDraftIds(): string[] {
  return Array.from(drafts.keys());
}
