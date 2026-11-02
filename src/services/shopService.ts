import { publicApiClient } from './api';
import {
  isShopProductInStock,
  resolveShopProductStock,
  type ShopProductStockSource,
} from '../utils/shopProductStock';

export interface ShopProductCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  image?: string | null;
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
  products_count?: number;
  coming_soon?: boolean;
  /** Optional display order provided by admin panel. */
  sort_order?: number;
}

export interface ShopCategoriesResponse {
  success: boolean;
  message?: string;
  data: ShopProductCategory[];
}

export interface ShopProductBookingDate {
  date: string;
  day?: string;
  day_number?: number;
  month?: string;
  available: boolean;
}

export interface ShopProductBookingSlot {
  id: number | string;
  time: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  booked_count?: number;
  remaining?: number;
  max_bookings?: number;
  blocked?: boolean;
  available: boolean;
}

export interface ShopProductTreePricingUnit {
  key?: string;
  label?: string;
  unit?: string;
  unit_price?: number;
  unit_price_label?: string;
  optional?: boolean;
}

/** GET /shop/products/:id — optional `data.area_pricing` (mirror of tree_pricing for m²). */
export interface ShopProductAreaPricing {
  enabled?: boolean;
  optional?: boolean;
  unit_price?: number | string | null;
  price_per_m2?: number | string | null;
  unit_price_label?: string | null;
  label?: string | null;
  note?: string | null;
}

/** GET /shop/products/:id — `data.tree_pricing` */
export interface ShopProductTreePricing {
  enabled?: boolean;
  optional?: boolean;
  requires_quantity?: boolean;
  note?: string;
  trees?: ShopProductTreePricingUnit;
  palm_trees?: ShopProductTreePricingUnit;
}

/** Booking calendar from GET /shop/products/:id (`data.booking`). */
export interface ShopProductBooking {
  enabled: boolean;
  product_id?: number;
  slot_source?: string;
  capacity_scope?: string;
  date_selection_required?: boolean;
  time_selection_required?: boolean;
  max_bookings_per_slot?: number;
  max_bookings_per_day?: number;
  dates?: ShopProductBookingDate[];
  selected_date?: string | null;
  slots?: ShopProductBookingSlot[];
}

export interface ShopProduct {
  id: number;
  category_id?: number | null;
  name: string;
  vendor?: string;
  type?: string;
  sku?: string;
  barcode?: string;
  description?: string;
  handle?: string;
  product_type?: string | null;
  price: string | number;
  compare_at_price?: string | number;
  weight?: string;
  weight_unit?: string;
  stock: number;
  stock_quantity?: number | null;
  in_stock?: boolean | number | null;
  track_quantity?: boolean | number | null;
  allow_backorder?: boolean | number | null;
  status: string;
  is_featured?: boolean | number;
  image?: string | null;
  image_url?: string | null;
  main_image?: { id: number; image_path: string; image_url?: string } | null;
  gallery_images?: Array<{ id: number; image_path: string; image_url?: string; sort_order?: number }>;
  /** Optional service-oriented copy from admin product (shop API). */
  estimated_arrival?: string | null;
  job_duration?: string | null;
  /** Area-based pricing (when returned by shop API / service settings). */
  pricing_type?: 'fixed' | 'per_m2' | 'per_tree' | 'per_palm' | string | null;
  catalog_price?: string | number | null;
  price_per_m2?: string | number | null;
  unit_rate?: string | number | null;
  unit_rate_label?: string | null;
  checkout_rate_label?: string | null;
  price_label?: string | null;
  list_price_label?: string | null;
  currency?: string | null;
  price_unit?: string | null;
  requires_area?: boolean | null;
  area_optional?: boolean | null;
  price_per_tree?: string | number | null;
  price_per_palm?: string | number | null;
  price_includes_labels?: string[] | null;
  show_tree_options?: boolean | null;
  /** When true, show area (m²) and/or fixed vendor pricing breakdown on client product detail. */
  show_area_pricing_on_client?: boolean | null;
  /** Merged from GET /shop/vendors/:id/pricing/service when product payload omits area pricing. */
  vendor_service_pricing?: Record<string, unknown> | null;
  vendor_id?: number | null;
  is_vendor_product?: boolean | null;
  base_price?: string | number | null;
  fixed_price?: string | number | null;
  fixed_price_addon?: string | number | null;
  checkout_price?: string | number | null;
  enable_fixed_price?: boolean | number | null;
  enable_per_m2?: boolean | number | null;
  area_pricing_options?: {
    fixed?: {
      checkout_price?: number | string | null;
      fixed_price?: number | string | null;
      customer_preview?: { checkout_total?: number | string | null };
    };
    per_m2?: Record<string, unknown>;
  } | null;
  price_breakdown?: {
    display_only?: boolean;
    do_not_add_lines?: boolean;
    note?: string;
    lines?: Array<{
      key?: string;
      label?: string;
      amount?: number;
      amount_label?: string;
    }>;
  } | null;
  area_pricing?: ShopProductAreaPricing | null;
  /** When true, show optional area (m²) input on service detail (shop API). */
  show_area_input?: boolean | null;
  tree_pricing?: ShopProductTreePricing | null;
  customer_preview?: {
    mode?: string;
    price_display?: string;
    checkout_rate_display?: string;
    catalog_price_label?: string;
    fixed_price_label?: string;
    checkout_total?: number;
    checkout_total_label?: string;
    fixed?: {
      checkout_total?: number | string | null;
      checkout_total_label?: string;
      breakdown?: {
        display_only?: boolean;
        note?: string;
        lines?: Array<{
          key?: string;
          label?: string;
          amount?: number;
          amount_label?: string;
        }>;
      };
      note?: string;
    };
    when_fixed_selected?: {
      checkout_total?: number | string | null;
      checkout_total_label?: string;
      breakdown?: {
        display_only?: boolean;
        note?: string;
        lines?: Array<{
          key?: string;
          label?: string;
          amount?: number;
          amount_label?: string;
        }>;
      };
      note?: string;
    };
    price_per_m2?: number | string | null;
    per_m2_rate?: number | string | null;
    note?: string;
    example?: { area?: number; price_per_m2?: number; total?: number; total_label?: string };
    breakdown?: {
      display_only?: boolean;
      do_not_add_lines?: boolean;
      catalog_price?: number;
      catalog_price_label?: string;
      fixed_price?: number;
      fixed_price_label?: string;
      note?: string;
      lines?: Array<{
        key?: string;
        label?: string;
        amount?: number;
        amount_label?: string;
      }>;
    };
  } | null;
  price_includes?: {
    materials?: boolean | number | string | null;
    installation?: boolean | number | string | null;
    labor?: boolean | number | string | null;
    transportation?: boolean | number | string | null;
    delivery?: boolean | number | string | null;
  } | null;
  created_at?: string;
  updated_at?: string;
  /** Optional display order within category (lower = earlier). */
  sort_order?: number;
  category?: ShopProductCategory | null;
  option_groups?: Array<{
    id?: number;
    name: string;
    subtitle?: string | null;
    input_type: 'single' | 'multiple' | string;
    is_required: boolean;
    sort_order?: number;
    options: Array<{
      id?: number;
      label: string;
      subtitle?: string | null;
      price_modifier?: number;
      image_path?: string | null;
      image_url?: string | null;
      sort_order?: number;
    }>;
  }>;
  /** From GET /shop/products/:id — preferred date & time slots. */
  booking?: ShopProductBooking | null;
  /** From GET /shop/products/:id — show Compare vendors button when available is true. */
  compare_vendors?: {
    available?: boolean;
    vendor_count?: number;
    label?: string;
    match_by?: string;
    product_name?: string;
  } | null;
}

export interface ShopFeaturedProductsResponse {
  success?: boolean;
  data?: ShopProduct[];
}

export interface ShopProductsByCategoryResponse {
  success: boolean;
  message?: string;
  data: {
    category: ShopProductCategory;
    products: ShopProduct[];
    pagination: { current_page: number; last_page: number; per_page: number; total: number };
  };
}

export interface ShopProductsResponse {
  success: boolean;
  message?: string;
  data: ShopProduct[];
}

export interface ShopProductDetailResponse {
  success: boolean;
  message?: string;
  data: ShopProduct;
}

function normalizeShopProduct(raw: unknown): ShopProduct {
  const item = (raw && typeof raw === 'object' ? raw : {}) as ShopProduct &
    ShopProductStockSource;
  const stock = resolveShopProductStock(item);
  return {
    ...item,
    stock,
    in_stock: isShopProductInStock(item),
  };
}

function normalizeShopProductList(list: unknown): ShopProduct[] {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeShopProduct);
}

function sortShopProductsByOrder(products: ShopProduct[]): ShopProduct[] {
  return [...products].sort((a, b) => {
    if (a.sort_order == null && b.sort_order == null) return 0;
    if (a.sort_order == null) return 1;
    if (b.sort_order == null) return -1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

export { isShopProductInStock, resolveShopProductStock } from '../utils/shopProductStock';

export const shopService = {
  getProducts: async (params?: { per_page?: number; page?: number; search?: string }): Promise<ShopProductsResponse> => {
    const { search, ...rest } = params ?? {};
    const sendParams = { ...rest } as { per_page?: number; page?: number; search?: string };
    if (search != null && search.trim() !== '') sendParams.search = search.trim();
    const response = await publicApiClient.get<ShopProductsResponse>('/shop/products', { params: sendParams });
    const body = response.data;
    if (body?.data) {
      body.data = normalizeShopProductList(body.data);
    }
    return body;
  },

  /** GET /shop/products/categories – public, no auth. Returns categories for Shop by Category. */
  getProductCategories: async (): Promise<ShopProductCategory[]> => {
    try {
      const response = await publicApiClient.get<ShopCategoriesResponse>('/shop/products/categories', {
        timeout: 15000,
      });
      const body = response?.data ?? response;
      const list = Array.isArray((body as any)?.data) ? (body as any).data : [];
      return list;
    } catch (_) {
      return [];
    }
  },

  /**
   * GET /shop/products/:product_id – public.
   * Optional `date` (YYYY-MM-DD) refreshes `booking.slots` for that day.
   */
  getProductById: async (
    productId: string | number,
    options?: { date?: string }
  ): Promise<ShopProduct | null> => {
    try {
      const date = options?.date?.trim();
      const response = await publicApiClient.get<ShopProductDetailResponse>(
        `/shop/products/${productId}`,
        {
          timeout: 15000,
          params: date ? { date } : undefined,
        }
      );
      const data = (response?.data as any)?.data ?? null;
      if (!data) return null;
      const normalized = normalizeShopProduct(data);
      /** Reject SKU/handle collisions where URL id ≠ catalog row id (e.g. GET /shop/products/317 → id 244). */
      if (String(normalized.id) !== String(productId)) {
        return null;
      }
      const { applyShopProductAreaRateFields } = await import('./servicePricingService');
      /** Return immediately; product detail enriches per-m² in background if needed. */
      return applyShopProductAreaRateFields(normalized);
    } catch (_) {
      return null;
    }
  },

  /** GET /shop/products/category/:category_id – public. Returns category + products + pagination. */
  getProductsByCategory: async (
    categoryId: string | number,
    params?: { page?: number }
  ): Promise<ShopProductsByCategoryResponse['data'] | null> => {
    try {
      const response = await publicApiClient.get<ShopProductsByCategoryResponse>(
        `/shop/products/category/${categoryId}`,
        { params: params ?? {}, timeout: 15000 }
      );
      const data = (response?.data as any)?.data ?? null;
      if (data?.products) {
        data.products = sortShopProductsByOrder(normalizeShopProductList(data.products));
      }
      return data;
    } catch (_) {
      return null;
    }
  },

  /** GET /shop/products/featured?limit=10 – public. Returns featured products for Home & View All. */
  getFeaturedProducts: async (limit: number = 10): Promise<ShopProduct[]> => {
    try {
      const response = await publicApiClient.get<ShopFeaturedProductsResponse>('/shop/products/featured', {
        params: { limit },
        timeout: 15000,
      });
      const body = response?.data ?? response;
      const list = Array.isArray((body as any)?.data) ? (body as any).data : Array.isArray(body) ? body : [];
      return normalizeShopProductList(list);
    } catch (_) {
      return [];
    }
  },
};
