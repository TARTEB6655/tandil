import { publicApiClient } from './api';
import { buildFullImageUrl } from '../config/api';
import { ShopProduct, isShopProductInStock } from './shopService';
import {
  resolveShopProductStock,
  type ShopProductStockSource,
} from '../utils/shopProductStock';

/**
 * Client Vendor Store (public) — Postman: P. Vendor Store
 *
 * GET /shop/vendors/{vendor_id}?search=&sort_by=
 * sort_by: sort_order | price | name
 *
 * Combined response: vendor profile + products catalog.
 */

export type VendorStoreSortBy = 'sort_order' | 'price' | 'name';

export interface ShopVendorProfile {
  id: string;
  business_name: string;
  owner_name?: string;
  logo_url?: string;
  rating?: number;
  products_count?: number;
  description?: string;
  phone?: string;
  email?: string;
  status_label?: string;
}

export interface ShopVendorStorePage {
  vendor?: ShopVendorProfile | null;
  products: ShopProduct[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function pickNumber(...values: unknown[]): number {
  for (const value of values) {
    if (value == null || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function resolveLogo(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const trimmed = raw.trim();
  return trimmed.startsWith('http') ? trimmed : buildFullImageUrl(trimmed);
}

function mapVendorProfile(row: Record<string, unknown> | null): ShopVendorProfile | null {
  if (!row) return null;
  const id = pickString(row.id, row.vendor_id);
  const name = pickString(
    row.business_name,
    row.company_name,
    row.vendor_name,
    row.name
  );
  if (!id && !name) return null;
  return {
    id: id || name,
    business_name: name || 'Vendor',
    owner_name: pickString(row.owner_name, row.authorized_person_name) || undefined,
    logo_url: resolveLogo(
      pickString(row.logo_url, row.logo, row.vendor_logo, row.profile_picture_url)
    ),
    rating: pickNumber(row.rating, row.vendor_rating, row.average_rating) || undefined,
    products_count: pickNumber(row.products_count, row.total_products) || undefined,
    description: pickString(row.description, row.about) || undefined,
    phone: pickString(row.phone) || undefined,
    email: pickString(row.email) || undefined,
    status_label: pickString(row.status_label, row.status) || undefined,
  };
}

function normalizeProduct(raw: unknown): ShopProduct {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const nested =
    row.product && typeof row.product === 'object' && !Array.isArray(row.product)
      ? (row.product as Record<string, unknown>)
      : null;

  // Cart + Product Detail need the catalog shop product id, not the vendor-product pivot id.
  const catalogId =
    pickNumber(
      nested?.id,
      nested?.product_id,
      row.product_id,
      row.shop_product_id,
      row.catalog_product_id,
      // only use row.id if it looks like a shop product id (numeric) and product_id isn't set
      row.product_id == null && nested == null ? row.id : undefined
    ) || pickNumber(row.id);

  const merged: Record<string, unknown> = {
    ...nested,
    ...row,
    id: catalogId || pickNumber(row.id, nested?.id),
    name: pickString(row.name, nested?.name, row.product_name) || 'Product',
    description: pickString(row.description, nested?.description) || undefined,
    price: row.price ?? nested?.price ?? 0,
    compare_at_price: row.compare_at_price ?? nested?.compare_at_price,
    image: row.image ?? nested?.image,
    image_url: row.image_url ?? nested?.image_url ?? nested?.main_image_url,
    main_image: row.main_image ?? nested?.main_image,
    stock: row.stock ?? row.stock_quantity ?? nested?.stock ?? nested?.stock_quantity,
    stock_quantity: row.stock_quantity ?? nested?.stock_quantity,
    in_stock: row.in_stock ?? nested?.in_stock,
    status: pickString(row.status, nested?.status) || 'active',
    estimated_arrival: row.estimated_arrival ?? nested?.estimated_arrival,
    job_duration: row.job_duration ?? nested?.job_duration,
  };

  // Drop nested product object so callers don't confuse pivot vs catalog
  delete merged.product;

  const item = merged as unknown as ShopProduct & ShopProductStockSource;
  const stock = resolveShopProductStock(item);
  return {
    ...item,
    id: Number(item.id) || (catalogId as number),
    stock,
    in_stock: isShopProductInStock(item),
  };
}

function extractProductList(payload: unknown): unknown[] {
  const body = asRecord(payload);
  if (!body) return [];
  const data = body.data ?? body;
  if (Array.isArray(data)) return data;
  const nested = asRecord(data);
  if (!nested) return [];
  const list =
    nested.products ??
    nested.items ??
    nested.vendor_products ??
    nested.data ??
    nested.results;
  return Array.isArray(list) ? list : [];
}

export const shopVendorStoreService = {
  /**
   * GET /shop/vendors/{vendor_id}?search=&sort_by=
   * Returns vendor + products in one response (Postman "Get vendor store").
   */
  async getVendorStore(
    vendorId: string,
    params?: {
      search?: string;
      sort_by?: VendorStoreSortBy;
      page?: number;
      per_page?: number;
    }
  ): Promise<ShopVendorStorePage> {
    const id = String(vendorId ?? '').trim();
    if (!id) {
      return {
        vendor: null,
        products: [],
        pagination: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
      };
    }

    const page = params?.page ?? 1;
    const perPage = params?.per_page ?? 20;
    const search = params?.search?.trim();
    const sortBy = params?.sort_by ?? 'sort_order';

    const response = await publicApiClient.get(
      `/shop/vendors/${encodeURIComponent(id)}`,
      {
        params: {
          ...(search ? { search } : {}),
          sort_by: sortBy,
          page,
          per_page: perPage,
        },
        timeout: 20000,
      }
    );

    const body = asRecord(response.data) ?? {};
    if (body.success === false) {
      throw new Error(pickString(body.message) || 'Failed to load vendor store.');
    }

    const data = asRecord(body.data) ?? body;
    const products = extractProductList(response.data)
      .map(normalizeProduct)
      .filter((p) => Number.isFinite(Number(p.id)) && Number(p.id) > 0);

    // Vendor can be nested under data.vendor, or the data object itself may be the vendor
    // when products sit beside it / under a products key.
    const vendor =
      mapVendorProfile(asRecord(data.vendor) ?? asRecord(data.profile)) ??
      (asRecord(data) && (data.business_name || data.vendor_name || data.company_name)
        ? mapVendorProfile(asRecord(data))
        : null);

    const meta =
      asRecord(data.pagination) ?? asRecord(data.meta) ?? asRecord(body.meta) ?? {};

    const total =
      pickNumber(meta.total, data.products_count, vendor?.products_count, products.length) ||
      products.length;
    const per = pickNumber(meta.per_page, perPage) || perPage;
    const current = pickNumber(meta.current_page, page) || page;
    const last =
      pickNumber(meta.last_page, Math.max(1, Math.ceil(total / Math.max(per, 1)))) ||
      Math.max(1, Math.ceil(total / Math.max(per, 1)));

    return {
      vendor: vendor
        ? {
            ...vendor,
            products_count: vendor.products_count ?? total,
          }
        : null,
      products,
      pagination: {
        current_page: current,
        last_page: last,
        per_page: per,
        total,
      },
    };
  },

  /** @deprecated Prefer getVendorStore — same combined endpoint. */
  async getVendorProfile(vendorId: string): Promise<ShopVendorProfile | null> {
    try {
      const page = await this.getVendorStore(vendorId, { per_page: 1 });
      return page.vendor;
    } catch {
      return null;
    }
  },

  /** @deprecated Prefer getVendorStore — kept for call-site compatibility. */
  async getVendorProducts(
    vendorId: string,
    params?: {
      page?: number;
      per_page?: number;
      search?: string;
      sort_by?: VendorStoreSortBy;
    }
  ): Promise<ShopVendorStorePage> {
    return this.getVendorStore(vendorId, params);
  },
};
