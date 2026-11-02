/**
 * Public services API (no auth).
 * GET /api/services?per_page=12 - list services for user dashboard.
 */
import { publicApiClient } from './api';
import type { ShopProduct } from './shopService';

export interface PublicService {
  id: number;
  name: string;
  slug?: string;
  description?: string | null;
  image?: string | null;
  image_url?: string | null;
  icon?: string | null;
  is_active?: boolean;
  products_count?: number;
}

export interface PublicServicesResponse {
  data?: PublicService[];
  success?: boolean;
  message?: string;
  pagination?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

/** Product returned by GET /services/:service_id/products or GET /services/products */
export interface PublicServiceProduct {
  /** Shop catalog id for GET /shop/products/:id (resolved in normalize). */
  id: number;
  shop_product_id?: number;
  vendor_product_id?: number;
  name: string;
  description?: string | null;
  price?: string | number;
  currency?: string;
  image?: string | null;
  image_url?: string | null;
  main_image?: { image_url?: string } | null;
  sku?: string;
  status?: string;
  stock?: number | string | null;
  stock_quantity?: number | string | null;
  in_stock?: boolean | number | string | null;
  is_in_stock?: boolean | number | string | null;
  track_quantity?: boolean | number | string | null;
  allow_backorder?: boolean | number | string | null;
  service_names?: string[];
  category?: unknown;
}

const PER_PAGE = 12;

function pickPositiveInt(...values: unknown[]): number | null {
  for (const value of values) {
    if (value == null || value === '') continue;
    const n = typeof value === 'number' ? value : parseInt(String(value), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Services list APIs may send vendor listing id separately from shop product id. */
export function resolvePublicServiceProductShopId(
  raw: PublicServiceProduct | Record<string, unknown>
): number {
  const row = raw as Record<string, unknown>;
  const shopNested = row.shop_product;
  const nestedShopId =
    shopNested && typeof shopNested === 'object'
      ? (shopNested as Record<string, unknown>).id
      : undefined;
  return (
    pickPositiveInt(
      row.shop_product_id,
      nestedShopId,
      row.catalog_product_id,
      row.product_id,
      row.id
    ) ?? 0
  );
}

function normalizePublicServiceProduct(raw: unknown): PublicServiceProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const shopId = resolvePublicServiceProductShopId(row);
  if (!shopId) return null;
  const vendorId = pickPositiveInt(row.vendor_product_id, row.vendor_product?.id);
  const name = String(row.name ?? row.title ?? '').trim();
  if (!name) return null;
  return {
    ...(row as PublicServiceProduct),
    id: shopId,
    shop_product_id: shopId,
    vendor_product_id: vendorId ?? undefined,
    name,
  };
}

/**
 * Services list rows include full pricing UI fields; map to shop product shape when
 * GET /shop/products/:id returns a different row (id/sku mismatch).
 */
export function mapPublicServiceCatalogItemToShopProduct(
  raw: PublicServiceProduct | Record<string, unknown>
): ShopProduct {
  const row = raw as Record<string, unknown>;
  const id = resolvePublicServiceProductShopId(row);
  const price = row.price ?? row.catalog_price ?? 0;
  const stockRaw = row.stock ?? row.stock_quantity ?? 100;
  const stock =
    typeof stockRaw === 'number' ? stockRaw : parseInt(String(stockRaw), 10) || 100;
  return {
    ...(row as ShopProduct),
    id,
    name: String(row.name ?? ''),
    price: price as string | number,
    catalog_price: (row.catalog_price ?? price) as string | number,
    base_price: (row.base_price ?? row.catalog_price ?? price) as string | number,
    status: String(row.status ?? 'active'),
    stock,
    product_type: String(row.type ?? row.product_type ?? 'service'),
    type: String(row.type ?? 'service'),
    is_service: true,
  };
}

function normalizePublicServiceProductList(raw: unknown): PublicServiceProduct[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizePublicServiceProduct)
    .filter((p): p is PublicServiceProduct => p != null);
}

export const publicServiceService = {
  /**
   * GET /services?per_page=12 (no token).
   * Returns list of services for dashboard "Place Service Orders" section.
   */
  getServices: async (params?: { page?: number; per_page?: number }): Promise<PublicService[]> => {
    const response = await publicApiClient.get<PublicServicesResponse>('/services', {
      params: { per_page: params?.per_page ?? PER_PAGE, page: params?.page ?? 1 },
    });
    const data = response.data?.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
      return (data as any).data;
    }
    return [];
  },

  /**
   * GET /services/:service_id/products (no token).
   * API returns: { success, message, data: { service_id, service_name, products: [...] } }
   * Uses 15s timeout so UI doesn't hang.
   */
  getProductsByServiceId: async (serviceId: number): Promise<PublicServiceProduct[]> => {
    const response = await publicApiClient.get<{
      success?: boolean;
      message?: string;
      data?: { service_id?: number; service_name?: string; products?: PublicServiceProduct[] };
    }>(`/services/${serviceId}/products`, { timeout: 15000 });
    const data = response.data?.data;
    if (data && typeof data === 'object' && Array.isArray((data as any).products)) {
      return normalizePublicServiceProductList((data as any).products);
    }
    if (Array.isArray(data)) return normalizePublicServiceProductList(data);
    return [];
  },

  /**
   * GET /services/products?per_page=20&service_id= (optional). No token.
   * Returns all service products or filtered by service_id. API: { data: { data: Product[] } }
   * Uses 15s timeout so UI doesn't hang if the API is slow.
   */
  getAllServiceProducts: async (params?: {
    per_page?: number;
    page?: number;
    service_id?: number;
    category_id?: number;
    search?: string;
  }): Promise<PublicServiceProduct[]> => {
    const { search, ...rest } = params ?? {};
    const requestParams = {
      per_page: params?.per_page ?? 20,
      page: params?.page ?? 1,
      ...rest,
      ...(search ? { search } : {}),
    };
    const response = await publicApiClient.get<{
      success?: boolean;
      message?: string;
      data?: { data?: PublicServiceProduct[] } | PublicServiceProduct[];
    }>('/services/products', { params: requestParams, timeout: 15000 });
    const data = response.data?.data;
    if (Array.isArray(data)) return normalizePublicServiceProductList(data);
    if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
      return normalizePublicServiceProductList((data as any).data);
    }
    return [];
  },
};
