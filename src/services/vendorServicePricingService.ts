import apiClient from './api';
import {
  parseServicePricingSettings,
  parseTreePalmPricingSettings,
  type ServicePriceIncludes,
  type ServicePricingSettings,
} from './servicePricingService';

export type VendorAreaPricingType = 'fixed' | 'per_m2';

/** POST /api/vendor/settings/service-pricing — vendor dual pricing contract. */
export interface VendorServicePricingUpdateBody {
  show_on_client_products_services: boolean;
  enable_fixed_price: boolean;
  enable_per_m2: boolean;
  fixed_price?: number;
  per_m2_price?: number;
  price_includes: ServicePriceIncludes;
}

/** Build POST body for vendor service pricing (fixed + per m² can both be set). */
export function buildVendorServicePricingSaveBody(input: {
  show_on_client_products_services: boolean;
  activeEditorTab: VendorAreaPricingType;
  fixedPrice: number | null;
  pricePerM2: number | null;
  price_includes: ServicePriceIncludes;
}): VendorServicePricingUpdateBody {
  const hasFixed = input.fixedPrice != null && input.fixedPrice >= 0;
  const hasM2 = input.pricePerM2 != null && input.pricePerM2 >= 0;

  const body: VendorServicePricingUpdateBody = {
    show_on_client_products_services: input.show_on_client_products_services,
    enable_fixed_price: hasFixed,
    enable_per_m2: hasM2,
    price_includes: input.price_includes,
  };

  if (hasFixed) body.fixed_price = input.fixedPrice!;
  if (hasM2) body.per_m2_price = input.pricePerM2!;

  return body;
}

export interface VendorServicePricingResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
}

export interface VendorTreePalmPricingUpdateBody {
  show_on_client_products_services: boolean;
  price_per_tree: number | null;
  price_per_palm_tree: number | null;
  price_includes: ServicePriceIncludes;
}

function isAxiosNotFound(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 404;
}

/** Unwrap `{ success, data }` and optional nested `data` / `settings` from vendor GET payloads. */
function unwrapVendorSettingsBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const root = body as Record<string, unknown>;
  if (root.success === false) {
    return body;
  }
  let node: unknown = root.data ?? root;
  if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (record.data != null && typeof record.data === 'object') {
      node = record.data;
    } else if (record.settings != null && typeof record.settings === 'object') {
      node = record.settings;
    }
  }
  return node;
}

function assertVendorGetSuccess(body: unknown): void {
  if (!body || typeof body !== 'object') return;
  const root = body as Record<string, unknown>;
  if (root.success === false) {
    throw new Error(String(root.message || 'Request failed'));
  }
}

function parseSettingsFromResponse(body: unknown): ServicePricingSettings | null {
  assertVendorGetSuccess(body);
  const unwrapped = unwrapVendorSettingsBody(body);
  return (
    parseServicePricingSettings(unwrapped) ??
    parseServicePricingSettings(body)
  );
}

function parseTreePalmFromResponse(body: unknown): ServicePricingSettings | null {
  assertVendorGetSuccess(body);
  const unwrapped = unwrapVendorSettingsBody(body);
  return (
    parseTreePalmPricingSettings(unwrapped) ??
    parseTreePalmPricingSettings(body)
  );
}

async function vendorGetSettings(
  path: string,
  parse: (body: unknown) => ServicePricingSettings | null
): Promise<ServicePricingSettings | null> {
  try {
    const response = await apiClient.get<VendorServicePricingResponse>(path, {
      timeout: 15000,
      headers: { Accept: 'application/json' },
    });
    return parse(response.data);
  } catch (error: unknown) {
    if (isAxiosNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Vendor catalog service pricing — GET/POST /vendor/settings/service-pricing */
export const vendorServicePricingService = {
  /** GET /api/vendor/settings/service-pricing (Bearer vendor token, Accept: application/json) */
  getServicePricing: async (): Promise<ServicePricingSettings | null> =>
    vendorGetSettings('/vendor/settings/service-pricing', parseSettingsFromResponse),

  /**
   * POST /api/vendor/settings/service-pricing (JSON)
   * Body: { show_on_client_products_services, enable_fixed_price, enable_per_m2, fixed_price?, per_m2_price?, price_includes }
   */
  updateServicePricing: async (
    body: VendorServicePricingUpdateBody
  ): Promise<VendorServicePricingResponse> => {
    const response = await apiClient.post<VendorServicePricingResponse>(
      '/vendor/settings/service-pricing',
      body,
      {
        timeout: 15000,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  },

  /** GET /api/vendor/settings/tree-palm-pricing (Bearer vendor token, Accept: application/json) */
  getTreePalmPricing: async (): Promise<ServicePricingSettings | null> =>
    vendorGetSettings('/vendor/settings/tree-palm-pricing', parseTreePalmFromResponse),

  /**
   * POST /api/vendor/settings/tree-palm-pricing (JSON)
   * Body: { show_on_client_products_services, price_per_tree, price_per_palm_tree, price_includes }
   */
  updateTreePalmPricing: async (
    body: VendorTreePalmPricingUpdateBody
  ): Promise<VendorServicePricingResponse> => {
    const response = await apiClient.post<VendorServicePricingResponse>(
      '/vendor/settings/tree-palm-pricing',
      body,
      {
        timeout: 15000,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  },
};
