import type { ServicePriceIncludes } from '../services/servicePricingService';

/** Per vendor service listing (one shop product / vendor_product row). */
export interface VendorProductAreaPricing {
  /** Master toggle: this listing uses its own area pricing (not only vendor default). */
  area_pricing_enabled: boolean;
  /** When true, customer product detail shows m² / fixed options for this listing. */
  show_on_client: boolean;
  enable_per_m2: boolean;
  price_per_m2: number | null;
  enable_fixed_price: boolean;
  fixed_price: number | null;
  /** When true, customer must enter area before add-to-cart (per m² mode). */
  requires_area: boolean;
  price_includes: ServicePriceIncludes;
  currency?: string;
}

/**
 * GET /api/vendor/products/{product_id}/area-pricing — same fields as save (vendor mobile v6.3).
 * Wrapped in `{ success, message?, data: { ... } }`.
 */
export interface VendorProductAreaPricingApiFields {
  product_id?: number;
  show_on_client_products_services?: boolean;
  enable_fixed_price?: boolean;
  enable_per_m2?: boolean;
  require_area_before_checkout?: boolean;
  fixed_price?: number | string | null;
  per_m2_price?: number | string | null;
  price_includes?: ServicePriceIncludes;
  currency?: string;
}

/**
 * Save body (vendor + admin v6.3):
 * - POST /api/vendor/products/{product_id}/area-pricing
 * - POST /api/admin/vendors/{vendor_id}/products/{product_id}/area-pricing
 */
export interface VendorProductAreaPricingSaveBody {
  show_on_client_products_services: boolean;
  enable_fixed_price: boolean;
  enable_per_m2: boolean;
  require_area_before_checkout: boolean;
  fixed_price: number;
  per_m2_price: number;
  price_includes: ServicePriceIncludes;
}

export const DEFAULT_VENDOR_PRODUCT_AREA_INCLUDES: ServicePriceIncludes = {
  materials: true,
  installation: true,
  labor: true,
  transportation: false,
  delivery: false,
};
