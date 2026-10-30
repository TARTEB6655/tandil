import apiClient from './api';
import { buildFullImageUrl } from '../config/api';
import {
  parseServicePricingSettings,
  parseServicePricingType,
  parseTreePalmPricingSettings,
  resolveServiceShowOnClientFromSettings,
  resolveTreePalmShowOnClientFromSettings,
  type ServicePriceIncludes,
  type ServicePricingSettings,
} from './servicePricingService';
import type { AdminVendorAreaPricingType } from './adminVendorPricingStore';
import {
  buildVendorServicePricingSaveBody,
  type VendorServicePricingUpdateBody,
} from './vendorServicePricingService';

export interface AdminVendorPricingPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/** Pricing summary shown on list cards (from list API). */
export interface AdminVendorPricingSummary {
  areaShowOnClient: boolean;
  areaPricingType: AdminVendorAreaPricingType | null;
  fixedPrice: number | null;
  pricePerM2: number | null;
  treePalmShowOnClient: boolean;
  pricePerTree: number | null;
  pricePerPalm: number | null;
  hasAnyConfigured: boolean;
}

export interface AdminVendorPricingListItem {
  vendorId: string;
  businessName: string;
  contactName?: string;
  email?: string;
  logoUrl?: string;
  currency: string;
  pricing: AdminVendorPricingSummary;
}

export interface AdminVendorPricingListResult {
  items: AdminVendorPricingListItem[];
  pagination: AdminVendorPricingPagination;
}

export interface AdminVendorPricingDetail {
  vendorId: string;
  areaShowOnClient: boolean;
  areaPricingType: AdminVendorAreaPricingType;
  fixedPrice: number | null;
  pricePerM2: number | null;
  areaPriceIncludes: ServicePriceIncludes;
  treePalmShowOnClient: boolean;
  pricePerTree: number | null;
  pricePerPalm: number | null;
  treePalmPriceIncludes: ServicePriceIncludes;
  currency: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (value == null) continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return '';
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (value == null || value === '') continue;
    const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseBoolFlag(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw === 1;
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }
  return false;
}

function readBoolFieldIfPresent(
  data: Record<string, unknown>,
  keys: readonly string[]
): boolean | undefined {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    const raw = data[key];
    if (raw === undefined || raw === null || raw === '') continue;
    return parseBoolFlag(raw);
  }
  return undefined;
}

const TREE_PALM_SHOW_ON_CLIENT_KEYS = [
  'show_on_client_products_services',
  'showOnClientProductsServices',
  'show_on_client_product_services',
  'show_on_client',
  'show_on_customer_service_products',
  'tree_palm_pricing_enabled',
  'tree_palm_enabled',
  'show_tree_palm_pricing',
] as const;

function readTreePalmShowOnClientFromRecord(
  data: Record<string, unknown>
): boolean | undefined {
  return readBoolFieldIfPresent(data, TREE_PALM_SHOW_ON_CLIENT_KEYS);
}

function showOnClientFromData(data: Record<string, unknown>): boolean | undefined {
  const raw =
    data.show_on_client_products_services ??
    data.show_on_customer_service_products ??
    data.show_service_options ??
    data.service_pricing_enabled;
  if (raw === undefined || raw === null || raw === '') return undefined;
  return parseBoolFlag(raw);
}

function unwrapAdminPricingPayload(data: Record<string, unknown>): Record<string, unknown> {
  const nested =
    asRecord(data.settings) ??
    asRecord(data.pricing) ??
    asRecord(data.vendor_pricing);
  return nested ? { ...nested, ...data } : data;
}

/** POST /api/admin/vendors/{id}/pricing/service — dual fixed + per m² (same as vendor settings). */
export type AdminVendorServicePricingUpdateBody = VendorServicePricingUpdateBody;

/** POST /api/admin/vendors/{id}/pricing/tree-palm — admin JSON contract. */
export interface AdminVendorTreePalmPricingUpdateBody {
  show_on_client_products_services: boolean;
  price_per_tree: number;
  price_per_palm_tree: number;
  price_includes: ServicePriceIncludes;
}

export function buildAdminVendorTreePalmPricingSaveBody(input: {
  show_on_client_products_services: boolean;
  price_per_tree: number | null;
  price_per_palm_tree: number | null;
  price_includes: ServicePriceIncludes;
}): AdminVendorTreePalmPricingUpdateBody {
  return {
    show_on_client_products_services: input.show_on_client_products_services,
    price_per_tree: input.price_per_tree != null && input.price_per_tree >= 0 ? input.price_per_tree : 0,
    price_per_palm_tree:
      input.price_per_palm_tree != null && input.price_per_palm_tree >= 0
        ? input.price_per_palm_tree
        : 0,
    price_includes: input.price_includes,
  };
}

/** Saves both fixed and per m² when both fields have values (`activeEditorTab` is UI-only). */
export function buildAdminVendorServicePricingSaveBody(input: {
  show_on_client_products_services: boolean;
  areaPricingType: AdminVendorAreaPricingType;
  fixedPrice: number | null;
  pricePerM2: number | null;
  price_includes: ServicePriceIncludes;
}): AdminVendorServicePricingUpdateBody {
  return buildVendorServicePricingSaveBody({
    show_on_client_products_services: input.show_on_client_products_services,
    activeEditorTab: input.areaPricingType,
    fixedPrice: input.fixedPrice,
    pricePerM2: input.pricePerM2,
    price_includes: input.price_includes,
  });
}

function resolveLogoUrl(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  return s.startsWith('http') ? s : buildFullImageUrl(s);
}

function extractListRows(payload: unknown): Record<string, unknown>[] {
  const body = asRecord(payload) ?? {};
  if (body.success === false) {
    throw new Error(pickString(body.message) || 'Failed to load vendor pricing list.');
  }
  const data = asRecord(body.data) ?? body;
  if (Array.isArray(data.items)) {
    return data.items.map((row) => asRecord(row)).filter(Boolean) as Record<string, unknown>[];
  }
  if (Array.isArray(data.vendors)) {
    return data.vendors.map((row) => asRecord(row)).filter(Boolean) as Record<string, unknown>[];
  }
  if (Array.isArray(body.items)) {
    return body.items.map((row) => asRecord(row)).filter(Boolean) as Record<string, unknown>[];
  }
  return [];
}

function parsePagination(
  payload: unknown,
  page: number,
  perPage: number,
  itemCount: number
): AdminVendorPricingPagination {
  const body = asRecord(payload) ?? {};
  const data = asRecord(body.data) ?? body;
  const meta =
    asRecord(data.pagination) ??
    asRecord(data.meta) ??
    asRecord(body.pagination) ??
    asRecord(body.meta) ??
    {};

  const current = pickNumber(meta.current_page, page) ?? page;
  const per = pickNumber(meta.per_page, perPage) ?? perPage;
  const total = pickNumber(meta.total, itemCount) ?? itemCount;
  const last =
    pickNumber(meta.last_page, Math.max(1, Math.ceil(total / per))) ??
    Math.max(1, Math.ceil(total / per));

  return {
    current_page: current,
    last_page: last,
    per_page: per,
    total,
  };
}

function inferAreaPricingType(
  ...typeCandidates: unknown[]
): AdminVendorAreaPricingType | null {
  for (const raw of typeCandidates) {
    if (raw == null || raw === '') continue;
    const parsed = parseServicePricingType(raw);
    if (parsed === 'per_m2' || parsed === 'fixed') {
      return parsed;
    }
  }
  return null;
}

function parsePricingSummaryFromRow(row: Record<string, unknown>): AdminVendorPricingSummary {
  const pricingRoot =
    asRecord(row.pricing) ??
    asRecord(row.pricing_summary) ??
    asRecord(row.vendor_pricing) ??
    row;

  let serviceRaw =
    asRecord(pricingRoot.service_pricing) ??
    asRecord(pricingRoot.service) ??
    asRecord(row.service_pricing) ??
    asRecord(row.service);

  let treeRaw =
    asRecord(pricingRoot.tree_palm_pricing) ??
    asRecord(pricingRoot.tree_palm) ??
    asRecord(row.tree_palm_pricing) ??
    asRecord(row.tree_palm);

  if (!serviceRaw && parseServicePricingSettings(pricingRoot)) {
    serviceRaw = pricingRoot;
  }
  if (!serviceRaw && parseServicePricingSettings(row)) {
    serviceRaw = row;
  }
  if (!treeRaw && parseTreePalmPricingSettings(pricingRoot)) {
    treeRaw = pricingRoot;
  }
  if (!treeRaw && parseTreePalmPricingSettings(row)) {
    treeRaw = row;
  }

  const serviceSettings = serviceRaw
    ? parseServicePricingSettings(serviceRaw) ?? parseServicePricingSettings({ data: serviceRaw })
    : parseServicePricingSettings(pricingRoot) ?? parseServicePricingSettings(row);
  const treeSettings = treeRaw
    ? parseTreePalmPricingSettings(treeRaw) ?? parseTreePalmPricingSettings({ data: treeRaw })
    : parseTreePalmPricingSettings(pricingRoot) ?? parseTreePalmPricingSettings(row);

  let areaPricingType = inferAreaPricingType(
    serviceRaw?.pricing_type,
    serviceRaw?.pricingType,
    pricingRoot.pricing_type,
    row.pricing_type,
    serviceSettings?.pricing_type
  );

  let fixedPrice = pickNumber(
    serviceRaw?.price,
    serviceSettings?.price,
    pricingRoot.fixed_price,
    pricingRoot.service_price,
    row.fixed_price,
    row.service_price
  );
  let pricePerM2 = pickNumber(
    serviceRaw?.price_per_m2,
    serviceSettings?.price_per_m2,
    pricingRoot.price_per_m2,
    pricingRoot.m2_price,
    row.price_per_m2
  );

  const unifiedAreaPrice = pickNumber(
    serviceRaw?.price,
    serviceSettings?.price,
    serviceSettings?.price_per_m2,
    pricingRoot.price,
    row.price
  );

  if (areaPricingType == null) {
    if (pricePerM2 != null || serviceSettings?.pricing_type === 'per_m2') {
      areaPricingType = 'per_m2';
    } else if (fixedPrice != null || serviceSettings?.pricing_type === 'fixed') {
      areaPricingType = 'fixed';
    } else if (unifiedAreaPrice != null) {
      areaPricingType =
        pickNumber(serviceRaw?.price_per_m2, pricingRoot.price_per_m2, row.price_per_m2) != null
          ? 'per_m2'
          : 'fixed';
    }
  }

  if (areaPricingType === 'per_m2' && pricePerM2 == null) {
    pricePerM2 = pickNumber(
      serviceSettings?.price_per_m2,
      serviceSettings?.price,
      unifiedAreaPrice
    );
  }
  if (areaPricingType === 'fixed' && fixedPrice == null) {
    fixedPrice = pickNumber(serviceSettings?.price, unifiedAreaPrice);
  }
  if (pricePerM2 == null && fixedPrice == null && unifiedAreaPrice != null) {
    if (areaPricingType === 'fixed') {
      fixedPrice = unifiedAreaPrice;
    } else {
      areaPricingType = areaPricingType ?? 'per_m2';
      pricePerM2 = unifiedAreaPrice;
    }
  }

  const areaShowOnClient =
    showOnClientFromData(asRecord(serviceRaw) ?? pricingRoot) ??
    serviceSettings?.service_pricing_enabled !== false;

  const treeShowRaw = asRecord(treeRaw) ?? pricingRoot;
  const treePalmShowOnClient = treeSettings
    ? resolveTreePalmShowOnClientFromSettings(treeSettings)
    : showOnClientFromData(treeShowRaw) ?? false;

  const pricePerTree = pickNumber(
    treeRaw?.price_per_tree,
    treeSettings?.price_per_tree,
    pricingRoot.price_per_tree,
    row.price_per_tree
  );
  const pricePerPalm = pickNumber(
    treeRaw?.price_per_palm_tree,
    treeRaw?.price_per_palm,
    treeSettings?.price_per_palm,
    pricingRoot.price_per_palm_tree,
    pricingRoot.price_per_palm,
    row.price_per_palm_tree,
    row.price_per_palm
  );

  const hasAnyConfigured =
    fixedPrice != null ||
    pricePerM2 != null ||
    pricePerTree != null ||
    pricePerPalm != null ||
    parseBoolFlag(row.has_service_pricing) ||
    parseBoolFlag(row.has_tree_palm_pricing) ||
    parseBoolFlag(pricingRoot.has_service_pricing) ||
    parseBoolFlag(pricingRoot.has_tree_palm_pricing) ||
    parseBoolFlag(row.pricing_configured) ||
    Boolean(serviceRaw || treeRaw || serviceSettings || treeSettings);

  return {
    areaShowOnClient,
    areaPricingType,
    fixedPrice,
    pricePerM2,
    treePalmShowOnClient,
    pricePerTree,
    pricePerPalm,
    hasAnyConfigured,
  };
}

function mapListItem(row: Record<string, unknown>): AdminVendorPricingListItem {
  const business = asRecord(row.business) ?? {};
  const vendorId = pickString(row.vendor_id, row.id, business.id);
  const revenueFormatted = pickString(row.revenue_formatted);
  const currencyMatch = revenueFormatted.match(/^([A-Za-z]{3})\b/);
  const currency =
    pickString(row.currency, business.currency) || currencyMatch?.[1] || 'AED';

  return {
    vendorId,
    businessName: pickString(
      row.business_name,
      row.company_name,
      business.name,
      business.business_name,
      row.name
    ),
    contactName: pickString(row.contact_name, row.owner_name, row.vendor_name, business.contact_name),
    email: pickString(row.email, business.email) || undefined,
    logoUrl: resolveLogoUrl(
      row.logo_url ??
        row.logo ??
        business.logo_url ??
        business.logo ??
        row.image_url
    ),
    currency,
    pricing: parsePricingSummaryFromRow(row),
  };
}

function defaultIncludes(): ServicePriceIncludes {
  return {
    materials: true,
    installation: true,
    labor: true,
    transportation: false,
    delivery: false,
  };
}

function includesFromSettings(settings: ServicePricingSettings | null): ServicePriceIncludes {
  return settings?.price_includes ?? defaultIncludes();
}

function assertSuccessPayload(payload: unknown, fallbackMessage: string): Record<string, unknown> {
  const body = asRecord(payload) ?? {};
  if (body.success === false) {
    throw new Error(pickString(body.message) || fallbackMessage);
  }
  return asRecord(body.data) ?? body;
}

function defaultVendorPricingDetail(vendorId: string): AdminVendorPricingDetail {
  return {
    vendorId,
    areaShowOnClient: true,
    areaPricingType: 'per_m2',
    fixedPrice: null,
    pricePerM2: null,
    areaPriceIncludes: defaultIncludes(),
    treePalmShowOnClient: false,
    pricePerTree: null,
    pricePerPalm: null,
    treePalmPriceIncludes: defaultIncludes(),
    currency: 'AED',
  };
}

/** GET …/pricing/service — response is service pricing fields (or nested under service). */
function serviceDetailFromPayload(payload: unknown): Pick<
  AdminVendorPricingDetail,
  | 'areaShowOnClient'
  | 'areaPricingType'
  | 'fixedPrice'
  | 'pricePerM2'
  | 'areaPriceIncludes'
  | 'currency'
> {
  const data = unwrapAdminPricingPayload(
    assertSuccessPayload(payload, 'Failed to load vendor service pricing.')
  );
  const serviceRaw =
    asRecord(data.service_pricing) ?? asRecord(data.service) ?? data;

  const serviceSettings =
    parseServicePricingSettings(serviceRaw) ??
    parseServicePricingSettings(data) ??
    parseServicePricingSettings({ data: serviceRaw });

  const pricingType = serviceSettings?.pricing_type ?? 'per_m2';
  const enableFixedFlag = serviceRaw.enable_fixed_price ?? serviceSettings?.enable_fixed_price;
  const enableM2Flag =
    serviceRaw.enable_per_m2 ??
    serviceSettings?.enable_per_m2 ??
    serviceRaw.enable_price_per_m2;
  const enableFixed = enableFixedFlag === true;
  const enableM2 = enableM2Flag === true;
  const hasEnableFlags = enableFixedFlag != null || enableM2Flag != null;

  let areaPricingType: AdminVendorAreaPricingType =
    pricingType === 'fixed' ? 'fixed' : 'per_m2';
  if (hasEnableFlags) {
    areaPricingType =
      enableFixed && !enableM2 ? 'fixed' : enableM2 ? 'per_m2' : areaPricingType;
  }

  let resolvedM2: number | null = pickNumber(
    serviceSettings?.per_m2_price,
    serviceRaw.per_m2_price,
    serviceSettings?.price_per_m2,
    serviceRaw.price_per_m2,
    serviceRaw.m2_price
  );
  let resolvedFixed: number | null = pickNumber(
    serviceSettings?.fixed_price,
    serviceRaw.fixed_price,
    serviceSettings?.price,
    serviceRaw.price
  );

  if (!hasEnableFlags) {
    if (resolvedFixed == null && pricingType === 'fixed') {
      resolvedFixed = pickNumber(serviceSettings?.price, serviceRaw.price);
    }
    if (resolvedM2 == null && pricingType === 'per_m2') {
      resolvedM2 = pickNumber(serviceSettings?.price, serviceRaw.price, serviceSettings?.price_per_m2);
    }
  } else {
    if (!enableFixed) resolvedFixed = null;
    if (!enableM2) resolvedM2 = null;
  }

  const serviceMerged: Record<string, unknown> = { ...data, ...serviceRaw };
  const areaShowOnClient =
    readBoolFieldIfPresent(serviceMerged, [
      'show_on_client_products_services',
      'showOnClientProductsServices',
      'show_on_customer_service_products',
      'service_pricing_enabled',
    ]) ??
    (serviceSettings ? resolveServiceShowOnClientFromSettings(serviceSettings) : true);

  return {
    areaShowOnClient,
    areaPricingType,
    fixedPrice: resolvedFixed,
    pricePerM2: resolvedM2,
    areaPriceIncludes: includesFromSettings(serviceSettings),
    currency: pickString(data.currency, serviceRaw.currency) || 'AED',
  };
}

/** GET …/pricing/tree-palm — response is tree/palm fields (or nested under tree_palm). */
function treePalmDetailFromPayload(payload: unknown): Pick<
  AdminVendorPricingDetail,
  | 'treePalmShowOnClient'
  | 'pricePerTree'
  | 'pricePerPalm'
  | 'treePalmPriceIncludes'
  | 'currency'
> {
  const data = unwrapAdminPricingPayload(
    assertSuccessPayload(payload, 'Failed to load vendor tree/palm pricing.')
  );
  const treeRaw =
    asRecord(data.tree_palm_pricing) ?? asRecord(data.tree_palm) ?? data;
  const mergedTree: Record<string, unknown> = { ...data, ...treeRaw };

  const treeSettings =
    parseTreePalmPricingSettings(treeRaw) ??
    parseTreePalmPricingSettings(data) ??
    parseTreePalmPricingSettings({ data: treeRaw });

  const treePalmShowOnClient =
    readTreePalmShowOnClientFromRecord(mergedTree) ??
    readTreePalmShowOnClientFromRecord(treeRaw) ??
    (treeSettings ? resolveTreePalmShowOnClientFromSettings(treeSettings) : false);

  return {
    treePalmShowOnClient,
    pricePerTree: pickNumber(
      treeSettings?.price_per_tree,
      mergedTree.price_per_tree,
      treeRaw.price_per_tree
    ),
    pricePerPalm: pickNumber(
      treeSettings?.price_per_palm,
      mergedTree.price_per_palm_tree,
      mergedTree.price_per_palm,
      treeRaw.price_per_palm_tree,
      treeRaw.price_per_palm
    ),
    treePalmPriceIncludes:
      treeSettings?.tree_palm_price_includes ??
      treeSettings?.price_includes ??
      defaultIncludes(),
    currency: pickString(data.currency, treeRaw.currency) || 'AED',
  };
}

function pricingSummaryFromDetailParts(
  service: Awaited<ReturnType<typeof serviceDetailFromPayload>> | null,
  tree: Awaited<ReturnType<typeof treePalmDetailFromPayload>> | null
): AdminVendorPricingSummary {
  const fixedPrice = service?.fixedPrice ?? null;
  const pricePerM2 = service?.pricePerM2 ?? null;
  const pricePerTree = tree?.pricePerTree ?? null;
  const pricePerPalm = tree?.pricePerPalm ?? null;
  return {
    areaShowOnClient: service?.areaShowOnClient !== false,
    areaPricingType: service?.areaPricingType ?? null,
    fixedPrice,
    pricePerM2,
    treePalmShowOnClient: tree?.treePalmShowOnClient ?? false,
    pricePerTree,
    pricePerPalm,
    hasAnyConfigured:
      fixedPrice != null ||
      pricePerM2 != null ||
      pricePerTree != null ||
      pricePerPalm != null,
  };
}

function listItemNeedsPricingEnrich(pricing: AdminVendorPricingSummary): boolean {
  return (
    pricing.fixedPrice == null &&
    pricing.pricePerM2 == null &&
    pricing.pricePerTree == null &&
    pricing.pricePerPalm == null
  );
}

async function enrichListItemPricing(
  item: AdminVendorPricingListItem
): Promise<AdminVendorPricingListItem> {
  if (!item.vendorId || !listItemNeedsPricingEnrich(item.pricing)) {
    return item;
  }

  const id = encodeURIComponent(String(item.vendorId).trim());
  const [serviceResult, treeResult] = await Promise.allSettled([
    apiClient.get(`/admin/vendors/${id}/pricing/service`, {
      timeout: 20000,
      headers: { Accept: 'application/json' },
    }),
    apiClient.get(`/admin/vendors/${id}/pricing/tree-palm`, {
      timeout: 20000,
      headers: { Accept: 'application/json' },
    }),
  ]);

  const servicePart =
    serviceResult.status === 'fulfilled'
      ? serviceDetailFromPayload(serviceResult.value.data)
      : null;
  const treePart =
    treeResult.status === 'fulfilled'
      ? treePalmDetailFromPayload(treeResult.value.data)
      : null;

  if (!servicePart && !treePart) {
    return item;
  }

  const pricing = pricingSummaryFromDetailParts(servicePart, treePart);
  return {
    ...item,
    currency:
      pickString(servicePart?.currency, treePart?.currency, item.currency) || item.currency,
    pricing,
  };
}

function mergeVendorPricingDetail(
  vendorId: string,
  servicePart?: Partial<AdminVendorPricingDetail> | null,
  treePart?: Partial<AdminVendorPricingDetail> | null
): AdminVendorPricingDetail {
  const base = defaultVendorPricingDetail(vendorId);
  return {
    ...base,
    ...(servicePart ?? {}),
    ...(treePart ?? {}),
    vendorId,
    currency:
      pickString(servicePart?.currency, treePart?.currency, base.currency) || base.currency,
  };
}

export const adminVendorPricingService = {
  /**
   * GET /api/admin/vendors/pricing?per_page=15&page=1&search=
   * Search: company name, vendor/owner name, or email.
   */
  async listVendors(params?: {
    page?: number;
    per_page?: number;
    search?: string;
  }): Promise<AdminVendorPricingListResult> {
    const page = params?.page ?? 1;
    const perPage = params?.per_page ?? 15;
    const search = params?.search?.trim();

    const response = await apiClient.get('/admin/vendors/pricing', {
      timeout: 20000,
      params: {
        page,
        per_page: perPage,
        search: search ?? '',
      },
    });

    const rows = extractListRows(response.data);
    const mapped = rows.map(mapListItem).filter((item) => item.vendorId);
    const items = await Promise.all(mapped.map((item) => enrichListItemPricing(item)));
    return {
      items,
      pagination: parsePagination(response.data, page, perPage, rows.length),
    };
  },

  /** GET /api/admin/vendors/{vendor_id}/pricing/service */
  async getVendorServicePricing(
    vendorId: string
  ): Promise<
    Pick<
      AdminVendorPricingDetail,
      | 'areaShowOnClient'
      | 'areaPricingType'
      | 'fixedPrice'
      | 'pricePerM2'
      | 'areaPriceIncludes'
      | 'currency'
    >
  > {
    const id = encodeURIComponent(String(vendorId).trim());
    const response = await apiClient.get(`/admin/vendors/${id}/pricing/service`, {
      timeout: 20000,
      headers: { Accept: 'application/json' },
    });
    return serviceDetailFromPayload(response.data);
  },

  /** GET /api/admin/vendors/{vendor_id}/pricing/tree-palm */
  async getVendorTreePalmPricing(
    vendorId: string
  ): Promise<
    Pick<
      AdminVendorPricingDetail,
      | 'treePalmShowOnClient'
      | 'pricePerTree'
      | 'pricePerPalm'
      | 'treePalmPriceIncludes'
      | 'currency'
    >
  > {
    const id = encodeURIComponent(String(vendorId).trim());
    const response = await apiClient.get(`/admin/vendors/${id}/pricing/tree-palm`, {
      timeout: 20000,
      headers: { Accept: 'application/json' },
    });
    if (__DEV__) {
      const parsed = treePalmDetailFromPayload(response.data);
      console.log('[AdminVendorPricing] GET tree-palm', {
        vendorId: id,
        raw: response.data,
        parsedShowOnClient: parsed.treePalmShowOnClient,
      });
    }
    return treePalmDetailFromPayload(response.data);
  },

  /** Loads service + tree/palm pricing in parallel for the manage screen. */
  async getVendorPricing(vendorId: string): Promise<AdminVendorPricingDetail> {
    const [serviceResult, treeResult] = await Promise.allSettled([
      this.getVendorServicePricing(vendorId),
      this.getVendorTreePalmPricing(vendorId),
    ]);

    const servicePart =
      serviceResult.status === 'fulfilled' ? serviceResult.value : null;
    const treePart = treeResult.status === 'fulfilled' ? treeResult.value : null;

    if (!servicePart && !treePart) {
      const err =
        serviceResult.status === 'rejected'
          ? serviceResult.reason
          : treeResult.status === 'rejected'
            ? treeResult.reason
            : new Error('Failed to load vendor pricing.');
      throw err instanceof Error ? err : new Error(String(err));
    }

    return mergeVendorPricingDetail(vendorId, servicePart, treePart);
  },

  /** POST /api/admin/vendors/{vendor_id}/pricing/service (JSON) */
  async updateServicePricing(
    vendorId: string,
    body: AdminVendorServicePricingUpdateBody
  ): Promise<{ success?: boolean; message?: string }> {
    const id = encodeURIComponent(String(vendorId).trim());
    const response = await apiClient.post(`/admin/vendors/${id}/pricing/service`, body, {
      timeout: 20000,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
    const data = response.data as { success?: boolean; message?: string };
    if (data?.success === false) {
      throw new Error(data.message || 'Failed to save service pricing.');
    }
    return data;
  },

  /** POST /api/admin/vendors/{vendor_id}/pricing/tree-palm (JSON) */
  async updateTreePalmPricing(
    vendorId: string,
    body: AdminVendorTreePalmPricingUpdateBody
  ): Promise<{
    success?: boolean;
    message?: string;
    treePalm?: ReturnType<typeof treePalmDetailFromPayload>;
  }> {
    const id = encodeURIComponent(String(vendorId).trim());
    const response = await apiClient.post(`/admin/vendors/${id}/pricing/tree-palm`, body, {
      timeout: 20000,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
    const data = response.data as { success?: boolean; message?: string };
    if (__DEV__) {
      console.log('[AdminVendorPricing] POST tree-palm', {
        vendorId: id,
        requestBody: body,
        response: response.data,
      });
    }
    if (data?.success === false) {
      throw new Error(data.message || 'Failed to save tree/palm pricing.');
    }
    let treePalm: ReturnType<typeof treePalmDetailFromPayload> | undefined;
    try {
      treePalm = treePalmDetailFromPayload(response.data);
    } catch {
      treePalm = undefined;
    }
    return { ...data, treePalm };
  },
};
