import apiClient from './api';
import type { ServicePriceIncludes } from './servicePricingService';
import {
  DEFAULT_VENDOR_PRODUCT_AREA_INCLUDES,
  type VendorProductAreaPricing,
  type VendorProductAreaPricingSaveBody,
} from '../types/vendorProductAreaPricing';
import type {
  VendorServiceAreaPricingListItem,
  VendorServiceAreaPricingListPayload,
} from '../types/vendorServiceAreaPricingList';

function parseBool(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw === 1;
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }
  return false;
}

function parseAmount(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function isAxiosNotFound(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 404;
}

/** Unwrap `{ success, data }` and optional nested pricing objects from vendor GET payloads. */
function unwrapVendorProductAreaPricingPayload(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const root = body as Record<string, unknown>;
  if (root.success === false) return null;

  let node: unknown = root.data ?? root;
  if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (record.data != null && typeof record.data === 'object') {
      node = record.data;
    } else if (record.area_pricing != null && typeof record.area_pricing === 'object') {
      node = record.area_pricing;
    } else if (record.settings != null && typeof record.settings === 'object') {
      node = record.settings;
    }
  }
  return node && typeof node === 'object' ? (node as Record<string, unknown>) : null;
}

function parseIncludes(data: Record<string, unknown>): ServicePriceIncludes {
  const raw =
    (data.price_includes && typeof data.price_includes === 'object'
      ? (data.price_includes as Record<string, unknown>)
      : null) ?? {};
  const base = DEFAULT_VENDOR_PRODUCT_AREA_INCLUDES;
  return {
    materials: raw.materials != null ? parseBool(raw.materials) : base.materials,
    installation: raw.installation != null ? parseBool(raw.installation) : base.installation,
    labor: raw.labor != null ? parseBool(raw.labor) : base.labor,
    transportation: raw.transportation != null ? parseBool(raw.transportation) : base.transportation,
    delivery: raw.delivery != null ? parseBool(raw.delivery) : base.delivery,
  };
}

export function parseVendorProductAreaPricing(raw: unknown): VendorProductAreaPricing | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  if (root.success === false) return null;
  const data =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;

  const pricePerM2 = parseAmount(
    data.per_m2_price ?? data.price_per_m2 ?? data.m2_unit_price
  );
  const fixedPrice = parseAmount(data.fixed_price ?? data.checkout_price);
  const enablePerM2 =
    data.enable_per_m2 !== undefined && data.enable_per_m2 !== null
      ? parseBool(data.enable_per_m2)
      : pricePerM2 != null;
  const enableFixed =
    data.enable_fixed_price !== undefined && data.enable_fixed_price !== null
      ? parseBool(data.enable_fixed_price)
      : fixedPrice != null;

  const areaEnabled =
    data.area_pricing_enabled !== undefined && data.area_pricing_enabled !== null
      ? parseBool(data.area_pricing_enabled)
      : enablePerM2 || enableFixed;

  const showOnClient =
    data.show_on_client_products_services !== undefined &&
    data.show_on_client_products_services !== null
      ? parseBool(data.show_on_client_products_services)
      : data.show_on_client !== undefined && data.show_on_client !== null
        ? parseBool(data.show_on_client)
        : data.show_area_pricing_on_client !== undefined &&
            data.show_area_pricing_on_client !== null
          ? parseBool(data.show_area_pricing_on_client)
          : true;

  return {
    area_pricing_enabled: areaEnabled,
    show_on_client: showOnClient,
    enable_per_m2: enablePerM2,
    price_per_m2: pricePerM2,
    enable_fixed_price: enableFixed,
    fixed_price: fixedPrice,
    requires_area: parseBool(
      data.require_area_before_checkout ?? data.requires_area
    ),
    price_includes: parseIncludes(data),
    currency: typeof data.currency === 'string' ? data.currency : 'AED',
  };
}

function parseListItem(raw: unknown): VendorServiceAreaPricingListItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const productId = parseAmount(
    row.product_id ?? row.vendor_product_id ?? row.shop_product_id ?? row.id
  );
  if (productId == null || productId <= 0) return null;
  const name = String(
    row.name ?? row.product_name ?? row.title ?? row.service_name ?? ''
  ).trim();
  if (!name) return null;
  return {
    product_id: productId,
    name,
    description: row.description != null ? String(row.description) : null,
    type: row.type != null ? String(row.type) : null,
    status: row.status != null ? String(row.status) : null,
    catalog_price: parseAmount(row.catalog_price),
    catalog_price_label:
      row.catalog_price_label != null ? String(row.catalog_price_label) : null,
    area_pricing_configured: parseBool(row.area_pricing_configured),
    price_per_m2: parseAmount(row.price_per_m2 ?? row.per_m2_price),
    price_per_m2_label:
      row.price_per_m2_label != null ? String(row.price_per_m2_label) : null,
    show_on_client_products_services: parseBool(row.show_on_client_products_services),
    detail_endpoint: row.detail_endpoint != null ? String(row.detail_endpoint) : null,
  };
}

export function parseVendorServiceAreaPricingList(
  raw: unknown
): VendorServiceAreaPricingListPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  if (root.success === false) return null;
  const data =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;
  const itemsRaw = data.items ?? data.products ?? data.services ?? data.list;
  const itemsArray = Array.isArray(itemsRaw)
    ? itemsRaw
    : itemsRaw && typeof itemsRaw === 'object' && Array.isArray((itemsRaw as { items?: unknown }).items)
      ? ((itemsRaw as { items: unknown[] }).items)
      : [];
  const items = itemsArray
    .map(parseListItem)
    .filter((item): item is VendorServiceAreaPricingListItem => item != null);
  return {
    screen_title: String(data.screen_title ?? 'Service products').trim(),
    screen_description: String(
      data.screen_description ??
        'Tap a service to set its price per m² (and optional fixed price) for the customer app.'
    ).trim(),
    items,
  };
}

async function listVendorServiceAreaPricing(): Promise<VendorServiceAreaPricingListPayload | null> {
  const res = await apiClient.get('/vendor/products/area-pricing', {
    timeout: 15000,
    headers: { Accept: 'application/json' },
  });
  return parseVendorServiceAreaPricingList(res.data);
}

async function listAdminVendorServiceAreaPricing(
  vendorId: string
): Promise<VendorServiceAreaPricingListPayload> {
  const id = encodeURIComponent(String(vendorId).trim());
  if (!id) {
    throw new Error('Vendor not found.');
  }
  try {
    const res = await apiClient.get(`/admin/vendors/${id}/products/area-pricing`, {
      timeout: 20000,
      headers: { Accept: 'application/json' },
    });
    const root = res.data as Record<string, unknown> | null;
    if (root?.success === false) {
      throw new Error(String(root.message || 'Failed to load service products for area pricing.'));
    }
    const parsed = parseVendorServiceAreaPricingList(res.data);
    if (!parsed) {
      throw new Error('Failed to load service products for area pricing.');
    }
    return parsed;
  } catch (error: unknown) {
    if (isAxiosNotFound(error)) {
      return {
        screen_title: 'Service products',
        screen_description:
          'Tap a service to set its price per m² (and optional fixed price) for the customer app.',
        items: [],
      };
    }
    throw error;
  }
}

export function buildVendorProductAreaPricingSaveBody(input: {
  showOnClient: boolean;
  enablePerM2: boolean;
  pricePerM2: number | null;
  enableFixed: boolean;
  fixedPrice: number | null;
  requiresArea: boolean;
  priceIncludes: ServicePriceIncludes;
}): VendorProductAreaPricingSaveBody {
  return {
    show_on_client_products_services: input.showOnClient,
    enable_fixed_price: input.enableFixed,
    enable_per_m2: input.enablePerM2,
    require_area_before_checkout: input.requiresArea,
    fixed_price: input.fixedPrice != null && input.fixedPrice >= 0 ? input.fixedPrice : 0,
    per_m2_price: input.pricePerM2 != null && input.pricePerM2 >= 0 ? input.pricePerM2 : 0,
    price_includes: input.priceIncludes,
  };
}

async function fetchProductAreaPricing(
  path: string
): Promise<VendorProductAreaPricing | null> {
  try {
    const res = await apiClient.get(path, {
      timeout: 20000,
      headers: { Accept: 'application/json' },
    });
    const root = res.data as Record<string, unknown> | null;
    if (root?.success === false) {
      throw new Error(String(root.message || 'Failed to load area pricing.'));
    }
    const unwrapped = unwrapVendorProductAreaPricingPayload(res.data);
    if (unwrapped) {
      return parseVendorProductAreaPricing({ success: true, data: unwrapped });
    }
    return parseVendorProductAreaPricing(res.data);
  } catch (error: unknown) {
    if (isAxiosNotFound(error)) return null;
    throw error;
  }
}

async function getAdminProductAreaPricing(
  vendorId: string,
  vendorProductId: string
): Promise<VendorProductAreaPricing | null> {
  return fetchProductAreaPricing(
    `/admin/vendors/${encodeURIComponent(vendorId)}/products/${encodeURIComponent(vendorProductId)}/area-pricing`
  );
}

async function postAdminProductAreaPricing(
  vendorId: string,
  vendorProductId: string,
  body: VendorProductAreaPricingSaveBody
): Promise<{ success?: boolean; message?: string }> {
  const res = await apiClient.post(
    `/admin/vendors/${encodeURIComponent(vendorId)}/products/${encodeURIComponent(vendorProductId)}/area-pricing`,
    body,
    {
      timeout: 20000,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }
  );
  const data = (res.data ?? {}) as { success?: boolean; message?: string };
  if (data.success === false) {
    throw new Error(data.message || 'Failed to save area pricing.');
  }
  return data;
}

async function getVendorProductAreaPricing(
  vendorProductId: string
): Promise<VendorProductAreaPricing | null> {
  return fetchProductAreaPricing(
    `/vendor/products/${encodeURIComponent(vendorProductId)}/area-pricing`
  );
}

async function postVendorProductAreaPricing(
  vendorProductId: string,
  body: VendorProductAreaPricingSaveBody
): Promise<{ success?: boolean; message?: string }> {
  const res = await apiClient.post(
    `/vendor/products/${encodeURIComponent(vendorProductId)}/area-pricing`,
    body,
    {
      timeout: 20000,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }
  );
  const data = (res.data ?? {}) as { success?: boolean; message?: string };
  if (data.success === false) {
    throw new Error(data.message || 'Failed to save area pricing.');
  }
  return data;
}

export const vendorProductAreaPricingService = {
  listForVendor: listVendorServiceAreaPricing,
  listForAdminVendor: listAdminVendorServiceAreaPricing,
  getForAdmin: getAdminProductAreaPricing,
  saveForAdmin: postAdminProductAreaPricing,
  getForVendor: getVendorProductAreaPricing,
  saveForVendor: postVendorProductAreaPricing,
};
