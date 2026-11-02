/**
 * List cards for per-service m² pricing hub.
 * Vendor: GET /api/vendor/products/area-pricing
 * Admin: GET /api/admin/vendors/{vendor_id}/products/area-pricing
 */
export interface VendorServiceAreaPricingListItem {
  product_id: number;
  name: string;
  description?: string | null;
  type?: string | null;
  status?: string | null;
  catalog_price?: number | null;
  catalog_price_label?: string | null;
  area_pricing_configured?: boolean;
  price_per_m2?: number | null;
  price_per_m2_label?: string | null;
  show_on_client_products_services?: boolean;
  detail_endpoint?: string | null;
}

export interface VendorServiceAreaPricingListPayload {
  screen_title: string;
  screen_description: string;
  items: VendorServiceAreaPricingListItem[];
}
