import apiClient from './api';
import { publicApiClient } from './api';
import type { ShopProduct } from './shopService';

export type ServicePricingType = 'fixed' | 'per_m2' | 'per_tree' | 'per_palm';

const SERVICE_PRICING_TYPES: ServicePricingType[] = [
  'fixed',
  'per_m2',
  'per_tree',
  'per_palm',
];

export function parseServicePricingType(raw: unknown): ServicePricingType {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (v === 'per_m2' || v === 'per_square_meter' || v === 'square_meter') return 'per_m2';
  if (v === 'per_tree' || v === 'tree' || v === 'price_per_tree') return 'per_tree';
  if (
    v === 'per_palm' ||
    v === 'per_palm_tree' ||
    v === 'palm' ||
    v === 'price_per_palm'
  ) {
    return 'per_palm';
  }
  if ((SERVICE_PRICING_TYPES as string[]).includes(v)) return v as ServicePricingType;
  return 'fixed';
}

export function isPerM2ServicePricing(type: ServicePricingType): boolean {
  return type === 'per_m2';
}

export function isPerTreeServicePricing(type: ServicePricingType): boolean {
  return type === 'per_tree';
}

export function isPerPalmServicePricing(type: ServicePricingType): boolean {
  return type === 'per_palm';
}

export function isUnitQuantityServicePricing(type: ServicePricingType): boolean {
  return type === 'per_tree' || type === 'per_palm';
}

export interface ServicePriceIncludes {
  materials: boolean;
  installation: boolean;
  labor: boolean;
  transportation: boolean;
  delivery: boolean;
}

export interface ServicePricingSettings {
  pricing_type: ServicePricingType;
  /** Fixed catalog/service price when pricing_type is fixed. */
  price: number | null;
  /** Explicit fixed amount when API sends `fixed_price` alongside per m². */
  fixed_price?: number | null;
  enable_fixed_price?: boolean;
  enable_per_m2?: boolean;
  /** @deprecated API alias */
  enable_price_per_m2?: boolean;
  per_m2_price?: number | null;
  /** Unit price when pricing_type is per_m2. */
  price_per_m2: number | null;
  /** Unit price when pricing_type is per_tree. */
  price_per_tree: number | null;
  /** Unit price when pricing_type is per_palm. */
  price_per_palm: number | null;
  /** Admin toggle: show tree/palm quantity section on customer service products. */
  tree_palm_pricing_enabled?: boolean;
  /** Vendor toggle: show fixed / per m² service pricing on customer products & services. */
  service_pricing_enabled?: boolean;
  /** Vendor API flag from GET/POST (`show_on_client_products_services`). */
  show_on_client_products_services?: boolean;
  currency?: string;
  requires_area?: boolean;
  /** Price includes for service / area (m²) pricing from service-pricing settings. */
  price_includes: ServicePriceIncludes;
  price_includes_labels?: string[];
  /** Price includes for tree & palm pricing from tree-palm-pricing settings (separate from area). */
  tree_palm_price_includes?: ServicePriceIncludes;
  tree_palm_price_includes_labels?: string[];
  /** From GET /settings/tree-palm-pricing (optional copy for customer UI). */
  price_per_tree_suffix?: string;
  price_per_palm_tree_suffix?: string;
  price_per_tree_label?: string;
  price_per_palm_tree_label?: string;
}

/** Customer visibility for tree/palm pricing — do not treat `show_tree_options` as this toggle. */
function treePalmShowOnClientToggleFromData(
  data: Record<string, unknown>
): boolean | undefined {
  const raw =
    data.show_on_client_products_services ??
    data.show_on_customer_service_products ??
    data.tree_palm_pricing_enabled ??
    data.tree_palm_enabled ??
    data.show_tree_palm_pricing;
  if (raw === undefined || raw === null || raw === '') return undefined;
  return parseBool(raw);
}

function treePalmToggleFromData(data: Record<string, unknown>): boolean {
  const explicit = treePalmShowOnClientToggleFromData(data);
  if (explicit !== undefined) return explicit;
  return false;
}

function servicePricingToggleFromData(data: Record<string, unknown>): boolean | undefined {
  const raw =
    data.show_on_client_products_services ??
    data.show_service_options ??
    data.show_on_customer_service_products ??
    data.service_pricing_enabled ??
    data.show_service_pricing ??
    data.show_area_pricing;
  if (raw === undefined || raw === null || raw === '') return undefined;
  return parseBool(raw);
}

/** Resolve “show on client” for fixed / per m² service pricing from a parsed settings object. */
export function resolveServiceShowOnClientFromSettings(
  settings: Pick<
    ServicePricingSettings,
    'show_on_client_products_services' | 'service_pricing_enabled'
  >
): boolean {
  if (settings.show_on_client_products_services === false) return false;
  if (settings.show_on_client_products_services === true) return true;
  if (settings.service_pricing_enabled === false) return false;
  if (settings.service_pricing_enabled === true) return true;
  return true;
}

/** Resolve “show on client” for tree & palm pricing from a parsed settings object. */
export function resolveTreePalmShowOnClientFromSettings(
  settings: Pick<
    ServicePricingSettings,
    'show_on_client_products_services' | 'tree_palm_pricing_enabled'
  >
): boolean {
  if (settings.show_on_client_products_services === false) return false;
  if (settings.show_on_client_products_services === true) return true;
  if (settings.tree_palm_pricing_enabled === false) return false;
  if (settings.tree_palm_pricing_enabled === true) return true;
  return false;
}

/** Parse GET …/tree-palm-pricing (admin or public). */
export function parseTreePalmPricingSettings(raw: unknown): ServicePricingSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  if (root.success === false) return null;
  const data =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;
  if (!data || typeof data !== 'object') return null;

  const perTreePrice = parseAmount(data.price_per_tree);
  const perPalmPrice = parseAmount(data.price_per_palm_tree ?? data.price_per_palm);
  const showOnClient = treePalmShowOnClientToggleFromData(data);

  return {
    pricing_type: 'fixed',
    price: null,
    price_per_m2: null,
    price_per_tree: perTreePrice,
    price_per_palm: perPalmPrice,
    tree_palm_pricing_enabled: showOnClient,
    show_on_client_products_services: showOnClient,
    currency: typeof data.currency === 'string' ? data.currency : 'AED',
    requires_area: false,
    price_includes: parseIncludes(data),
    price_includes_labels: Array.isArray(data.price_includes_labels)
      ? data.price_includes_labels.map(String)
      : undefined,
    price_per_tree_suffix:
      typeof data.price_per_tree_suffix === 'string' ? data.price_per_tree_suffix : undefined,
    price_per_palm_tree_suffix:
      typeof data.price_per_palm_tree_suffix === 'string'
        ? data.price_per_palm_tree_suffix
        : undefined,
    price_per_tree_label:
      typeof data.price_per_tree_label === 'string' ? data.price_per_tree_label : undefined,
    price_per_palm_tree_label:
      typeof data.price_per_palm_tree_label === 'string'
        ? data.price_per_palm_tree_label
        : undefined,
  };
}

function coalesceUnitPrice(
  primary: number | null | undefined,
  fallback: number | null | undefined
): number | null {
  if (isPositiveUnitPrice(primary)) return primary as number;
  if (isPositiveUnitPrice(fallback)) return fallback as number;
  return primary ?? fallback ?? null;
}

export function isPositiveUnitPrice(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value) && value > 0;
}

export function resolveTreeUnitPrice(settings: ServicePricingSettings | null): number | null {
  if (!settings) return null;
  return isPositiveUnitPrice(settings.price_per_tree) ? settings.price_per_tree : null;
}

export function resolvePalmUnitPrice(settings: ServicePricingSettings | null): number | null {
  if (!settings) return null;
  return isPositiveUnitPrice(settings.price_per_palm) ? settings.price_per_palm : null;
}

/** Admin toggle for tree/palm options on customer service products. */
export function isTreePalmPricingEnabled(settings: ServicePricingSettings | null): boolean {
  return Boolean(settings?.tree_palm_pricing_enabled);
}

/** Vendor/service-pricing toggle: show area or fixed pricing on customer app (default on if unset). */
export function isCustomerServicePricingVisible(
  settings: ServicePricingSettings | null | undefined
): boolean {
  if (!settings) return false;
  if (settings.service_pricing_enabled === false) return false;
  return true;
}

/** Customer tree/palm block: enabled in admin (rows still depend on unit prices). */
export function shouldShowCustomerTreePalmSection(
  settings: ServicePricingSettings | null
): boolean {
  return isTreePalmPricingEnabled(settings);
}

const DEFAULT_INCLUDES: ServicePriceIncludes = {
  materials: false,
  installation: false,
  labor: false,
  transportation: false,
  delivery: false,
};

function parseAmount(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseBool(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw === 1;
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }
  return false;
}


function parseIncludes(data: Record<string, unknown>): ServicePriceIncludes {
  const includesRaw =
    (data.price_includes && typeof data.price_includes === 'object'
      ? (data.price_includes as Record<string, unknown>)
      : null) ||
    (data.includes && typeof data.includes === 'object'
      ? (data.includes as Record<string, unknown>)
      : null) ||
    {};

  const fromObject: ServicePriceIncludes = {
    materials: parseBool(includesRaw.materials ?? DEFAULT_INCLUDES.materials),
    installation: parseBool(includesRaw.installation ?? DEFAULT_INCLUDES.installation),
    labor: parseBool(includesRaw.labor ?? DEFAULT_INCLUDES.labor),
    transportation: parseBool(includesRaw.transportation ?? DEFAULT_INCLUDES.transportation),
    delivery: parseBool(includesRaw.delivery ?? DEFAULT_INCLUDES.delivery),
  };

  const options = data.price_includes_options;
  if (!Array.isArray(options) || options.length === 0) return fromObject;

  const next = { ...fromObject };
  options.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const item = row as Record<string, unknown>;
    const key = String(item.key || '').toLowerCase() as keyof ServicePriceIncludes;
    if (!(key in next)) return;
    next[key] = parseBool(item.selected);
  });
  return next;
}

export function parseServicePricingSettings(raw: unknown): ServicePricingSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const data =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;

  const hasPricingTypeField =
    (data.pricing_type != null && String(data.pricing_type).trim() !== '') ||
    (data.pricingType != null && String(data.pricingType).trim() !== '');

  const legacyPrice = parseAmount(data.price ?? data.amount);
  const explicitFixed = parseAmount(
    data.fixed_price ?? data.fixed_price_addon ?? data.service_fixed_price
  );
  let perM2Price = parseAmount(
    data.price_per_m2 ?? data.m2_price ?? data.per_m2_price
  );
  const unitPriceFromBlock = parseAmount(
    data.unit_price ?? data.m2_unit_price ?? data.area_unit_price
  );
  if (!isPositiveUnitPrice(perM2Price) && isPositiveUnitPrice(unitPriceFromBlock)) {
    perM2Price = unitPriceFromBlock;
  }
  const perTreePrice = parseAmount(data.price_per_tree);
  const perPalmPrice = parseAmount(data.price_per_palm_tree ?? data.price_per_palm);

  const enableFixedFlag =
    data.enable_fixed_price !== undefined && data.enable_fixed_price !== null
      ? parseBool(data.enable_fixed_price)
      : undefined;
  const enablePerM2Flag =
    data.enable_per_m2 !== undefined && data.enable_per_m2 !== null
      ? parseBool(data.enable_per_m2)
      : data.enable_price_per_m2 !== undefined && data.enable_price_per_m2 !== null
        ? parseBool(data.enable_price_per_m2)
        : undefined;

  let pricing_type = parseServicePricingType(data.pricing_type ?? data.pricingType);
  if (!hasPricingTypeField && enablePerM2Flag === true && enableFixedFlag !== true) {
    pricing_type = 'per_m2';
  } else if (!hasPricingTypeField && enableFixedFlag === true && enablePerM2Flag !== true) {
    pricing_type = 'fixed';
  } else if (
    !hasPricingTypeField &&
    parseBool(data.enabled) &&
    isPositiveUnitPrice(perM2Price)
  ) {
    pricing_type = 'per_m2';
  }

  let catalogFixed: number | null = explicitFixed;
  let m2Rate: number | null = perM2Price;

  if (catalogFixed == null && m2Rate == null && legacyPrice != null) {
    if (pricing_type === 'per_m2') m2Rate = legacyPrice;
    else catalogFixed = legacyPrice;
  } else {
    if (catalogFixed == null && pricing_type === 'fixed' && legacyPrice != null) {
      catalogFixed = legacyPrice;
    }
    if (
      m2Rate == null &&
      pricing_type === 'per_m2' &&
      legacyPrice != null &&
      catalogFixed == null
    ) {
      m2Rate = legacyPrice;
    }
  }

  const activeUnit =
    pricing_type === 'per_m2'
      ? m2Rate ?? catalogFixed
      : pricing_type === 'per_tree'
        ? perTreePrice ?? catalogFixed
        : pricing_type === 'per_palm'
          ? perPalmPrice ?? catalogFixed
          : catalogFixed ?? m2Rate;

  const treePalmEnabled = treePalmToggleFromData(data);
  const servicePricingEnabled = servicePricingToggleFromData(data);
  const showOnClient =
    servicePricingEnabled !== undefined ? servicePricingEnabled : undefined;

  if (
    activeUnit == null &&
    catalogFixed == null &&
    m2Rate == null &&
    perTreePrice == null &&
    perPalmPrice == null &&
    !hasPricingTypeField &&
    !treePalmEnabled &&
    servicePricingEnabled === undefined
  ) {
    return null;
  }

  return {
    pricing_type,
    price: catalogFixed,
    fixed_price: catalogFixed,
    price_per_m2: m2Rate,
    per_m2_price: m2Rate,
    enable_fixed_price: enableFixedFlag,
    enable_per_m2: enablePerM2Flag,
    enable_price_per_m2: enablePerM2Flag,
    price_per_tree: perTreePrice,
    price_per_palm: perPalmPrice,
    tree_palm_pricing_enabled: treePalmEnabled,
    service_pricing_enabled: servicePricingEnabled,
    show_on_client_products_services: showOnClient,
    currency: typeof data.currency === 'string' ? data.currency : 'AED',
    requires_area: Boolean(data.requires_area ?? pricing_type === 'per_m2'),
    price_includes: parseIncludes(data),
    price_includes_labels: Array.isArray(data.price_includes_labels)
      ? data.price_includes_labels.map(String)
      : undefined,
  };
}

function mergeServicePricingSettings(
  base: ServicePricingSettings | null,
  treePalm: ServicePricingSettings | null
): ServicePricingSettings | null {
  if (!base) {
    return treePalm
      ? {
          ...treePalm,
          tree_palm_price_includes: treePalm.price_includes,
          tree_palm_price_includes_labels: treePalm.price_includes_labels,
        }
      : null;
  }
  if (!treePalm) return base;
  const treePalmActive =
    Boolean(treePalm.tree_palm_pricing_enabled) ||
    isPositiveUnitPrice(treePalm.price_per_tree) ||
    isPositiveUnitPrice(treePalm.price_per_palm);
  return {
    ...base,
    price_per_tree: coalesceUnitPrice(treePalm.price_per_tree, base.price_per_tree),
    price_per_palm: coalesceUnitPrice(treePalm.price_per_palm, base.price_per_palm),
    tree_palm_pricing_enabled: treePalm.tree_palm_pricing_enabled,
    price_includes: base.price_includes,
    price_includes_labels: base.price_includes_labels,
    tree_palm_price_includes: treePalm.price_includes,
    tree_palm_price_includes_labels: treePalm.price_includes_labels,
    price_per_tree_suffix: treePalm.price_per_tree_suffix ?? base.price_per_tree_suffix,
    price_per_palm_tree_suffix:
      treePalm.price_per_palm_tree_suffix ?? base.price_per_palm_tree_suffix,
    price_per_tree_label: treePalm.price_per_tree_label ?? base.price_per_tree_label,
    price_per_palm_tree_label:
      treePalm.price_per_palm_tree_label ?? base.price_per_palm_tree_label,
    currency: treePalm.currency ?? base.currency,
  };
}

async function fetchTreePalmPricingSettings(): Promise<ServicePricingSettings | null> {
  const attempts: { get: typeof publicApiClient.get; path: string }[] = [
    { get: publicApiClient.get.bind(publicApiClient), path: '/settings/tree-palm-pricing' },
    { get: publicApiClient.get.bind(publicApiClient), path: '/shop/settings/tree-palm-pricing' },
    { get: publicApiClient.get.bind(publicApiClient), path: '/shop/tree-palm-pricing' },
    { get: apiClient.get.bind(apiClient), path: '/settings/tree-palm-pricing' },
    { get: apiClient.get.bind(apiClient), path: '/shop/settings/tree-palm-pricing' },
  ];

  for (const { get, path } of attempts) {
    try {
      const res = await get(path, {
        timeout: 15000,
        headers: { Accept: 'application/json' },
      });
      const parsed =
        parseTreePalmPricingSettings(res?.data) ??
        parseTreePalmPricingSettings((res?.data as { data?: unknown })?.data);
      if (parsed) return parsed;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Public/customer service pricing (area-based vs fixed).
 * Tries public/shop settings endpoints (global + vendor-backed where exposed).
 */
export async function getServicePricingSettings(): Promise<ServicePricingSettings | null> {
  const paths = [
    '/settings/service-pricing',
    '/shop/settings/service-pricing',
    '/shop/service-pricing',
  ];

  let base: ServicePricingSettings | null = null;

  for (const path of paths) {
    try {
      const res = await publicApiClient.get(path, { timeout: 15000 });
      const parsed =
        parseServicePricingSettings(res?.data) ?? parseServicePricingSettings(res?.data?.data);
      if (parsed) {
        base = parsed;
        break;
      }
    } catch {
      // try next
    }
  }

  if (!base) {
    try {
      const res = await apiClient.get('/settings/service-pricing', { timeout: 15000 });
      base =
        parseServicePricingSettings(res?.data) ?? parseServicePricingSettings(res?.data?.data);
    } catch {
      // ignore
    }
  }

  const treePalm = await fetchTreePalmPricingSettings();
  return mergeServicePricingSettings(base, treePalm);
}

/** Parse customer-entered area (m²); allows decimals like 137.5 */
export function parseAreaM2(value: string): number | null {
  const cleaned = value.trim().replace(',', '.');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatAreaM2(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Effective unit rate for the active pricing type, or fixed price amount. */
export function getEffectiveServicePrice(settings: ServicePricingSettings | null): number | null {
  if (!settings) return null;
  switch (settings.pricing_type) {
    case 'per_m2':
      return settings.price_per_m2 ?? settings.price;
    case 'per_tree':
      return settings.price_per_tree ?? settings.price;
    case 'per_palm':
      return settings.price_per_palm ?? settings.price;
    default:
      return settings.price ?? settings.price_per_m2 ?? settings.price_per_tree ?? settings.price_per_palm;
  }
}

export function resolveProductPricingType(
  productPricingType: unknown,
  settings: ServicePricingSettings | null
): ServicePricingType {
  const fromProduct = productPricingType != null && String(productPricingType).trim() !== '';
  if (fromProduct) return parseServicePricingType(productPricingType);
  if (settings?.pricing_type) return settings.pricing_type;
  if (settings?.requires_area) return 'per_m2';
  return 'fixed';
}

function parseShopProductPriceIncludes(product: ShopProduct): ServicePriceIncludes {
  const raw = product.price_includes;
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_INCLUDES };
  return {
    materials: parseBool(raw.materials),
    installation: parseBool(raw.installation),
    labor: parseBool(raw.labor),
    transportation: parseBool(raw.transportation),
    delivery: parseBool(raw.delivery),
  };
}

/** Product-level admin toggle off (show_tree_options false/0) — hides tree/palm UI for this product. */
export function isProductTreeOptionsDisabled(product: ShopProduct | null | undefined): boolean {
  if (!product) return false;
  const flag = product.show_tree_options;
  if (flag === null || flag === undefined) return false;
  return !parseBool(flag);
}

/** GET /shop/products/:id — tree/palm UI when `show_tree_options` is true and tree_pricing exists. */
export function isProductTreePalmEnabled(product: ShopProduct | null | undefined): boolean {
  if (!product) return false;
  if (!parseBool(product.show_tree_options)) return false;
  const tp = product.tree_pricing;
  if (!tp) return false;
  return (
    parseBool(tp.enabled) ||
    Boolean(tp.trees?.unit_price != null || tp.palm_trees?.unit_price != null) ||
    Boolean(tp.trees || tp.palm_trees)
  );
}

/** Client product detail — pricing tabs when vendor enabled fixed and/or per m² on this product. */
export function isShowAreaPricingOnClient(product: ShopProduct | null | undefined): boolean {
  return resolveShopProductAreaPricing(product).showSection;
}

export interface ShopProductPriceBreakdownLine {
  key: string;
  label: string;
  amount: number | null;
  amountLabel: string;
}

/** Display-only catalog + fixed lines from GET /shop/products/:id `customer_preview.breakdown`. */
function mapBreakdownLines(
  product: ShopProduct,
  rawLines: unknown,
  note?: string
): { lines: ShopProductPriceBreakdownLine[]; note?: string } | null {
  if (!Array.isArray(rawLines) || rawLines.length === 0) return null;

  const lines: ShopProductPriceBreakdownLine[] = rawLines
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const label = String(r.label ?? r.key ?? `line_${index}`).trim();
      const key = String(r.key ?? label ?? index).trim();
      const amount = parseAmount(r.amount);
      const amountLabel =
        String(r.amount_label ?? '').trim() ||
        (amount != null
          ? `${product.currency ?? 'AED'} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          : '—');
      return { key, label, amount, amountLabel };
    })
    .filter((line): line is ShopProductPriceBreakdownLine => line != null && line.label.length > 0);

  if (lines.length === 0) return null;
  return { lines, note: note?.trim() || undefined };
}

/** Display-only breakdown for a pricing mode (fixed checkout vs full multi preview). */
export function parseShopProductDisplayBreakdownForMode(
  product: ShopProduct | null | undefined,
  mode: 'fixed' | 'multi'
): { lines: ShopProductPriceBreakdownLine[]; note?: string } | null {
  if (!product) return null;

  if (mode === 'fixed') {
    const preview = product.customer_preview as Record<string, unknown> | undefined;
    for (const key of ['when_fixed_selected', 'fixed'] as const) {
      const block = preview?.[key];
      if (!block || typeof block !== 'object') continue;
      const breakdown = (block as Record<string, unknown>).breakdown;
      if (!breakdown || typeof breakdown !== 'object') continue;
      const b = breakdown as Record<string, unknown>;
      const mapped = mapBreakdownLines(
        product,
        b.lines,
        String(b.note ?? (block as Record<string, unknown>).note ?? '').trim() || undefined
      );
      if (mapped) return mapped;
    }
  }

  const record = product as Record<string, unknown>;
  const rootBreakdown = record.price_breakdown;
  if (rootBreakdown && typeof rootBreakdown === 'object') {
    const b = rootBreakdown as Record<string, unknown>;
    const mapped = mapBreakdownLines(product, b.lines, String(b.note ?? '').trim() || undefined);
    if (mapped) return mapped;
  }

  return parseShopProductDisplayBreakdown(product);
}

export function parseShopProductDisplayBreakdown(
  product: ShopProduct | null | undefined
): { lines: ShopProductPriceBreakdownLine[]; note?: string } | null {
  if (!product) return null;

  const record = product as Record<string, unknown>;
  const rootBreakdown = record.price_breakdown;
  if (rootBreakdown && typeof rootBreakdown === 'object') {
    const b = rootBreakdown as Record<string, unknown>;
    const mapped = mapBreakdownLines(product, b.lines, String(b.note ?? '').trim() || undefined);
    if (mapped) return mapped;
  }

  if (!product.customer_preview?.breakdown) return null;
  const breakdown = product.customer_preview.breakdown;
  const note = breakdown.note?.trim() || product.customer_preview.note?.trim();
  return mapBreakdownLines(product, breakdown.lines, note || undefined);
}

/** Product / catalog base only (no fixed addon) — `catalog_price`, `base_price`, or list `price`. */
export function resolveShopProductCatalogBase(
  product: ShopProduct | null | undefined
): number | null {
  if (!product) return null;
  const catalog = parseAmount(product.catalog_price ?? product.base_price);
  if (isPositiveUnitPrice(catalog)) return catalog;
  const listPrice = parseAmount(product.price);
  if (isPositiveUnitPrice(listPrice)) return listPrice;
  return null;
}

function resolveFixedModeCheckoutFromPreview(product: ShopProduct): number | null {
  const record = product as Record<string, unknown>;
  const areaOpts = record.area_pricing_options;
  if (areaOpts && typeof areaOpts === 'object') {
    const fixed = (areaOpts as Record<string, unknown>).fixed;
    if (fixed && typeof fixed === 'object') {
      const fromOpt = parseAmount((fixed as Record<string, unknown>).checkout_price);
      if (isPositiveUnitPrice(fromOpt)) return fromOpt;
    }
  }

  const preview = product.customer_preview as Record<string, unknown> | undefined;
  for (const key of ['fixed', 'when_fixed_selected'] as const) {
    const block = preview?.[key];
    if (!block || typeof block !== 'object') continue;
    const total = parseAmount((block as Record<string, unknown>).checkout_total);
    if (isPositiveUnitPrice(total)) return total;
  }

  if (preview && String(preview.mode || '').toLowerCase() === 'fixed') {
    const total = parseAmount(preview.checkout_total);
    if (isPositiveUnitPrice(total)) return total;
  }

  return null;
}

/**
 * Checkout unit price when customer selects fixed pricing (`area_pricing_mode=fixed`).
 * Uses vendor fixed checkout only — catalog is not added again (see shop API `customer_preview.fixed`).
 */
export function resolveShopProductCheckoutBase(product: ShopProduct | null | undefined): number | null {
  if (!product) return null;
  const checkout = parseAmount(product.checkout_price);
  if (isPositiveUnitPrice(checkout)) return checkout;

  const fromPreview = resolveFixedModeCheckoutFromPreview(product);
  if (fromPreview != null) return fromPreview;

  const fixedStandalone = parseAmount(product.fixed_price);
  const pricingType = String(product.pricing_type || '').toLowerCase();
  const multiOrVendor =
    pricingType === 'multi' ||
    parseBool(product.enable_fixed_price) ||
    parseBool(product.show_area_pricing_on_client);
  if (isPositiveUnitPrice(fixedStandalone) && multiOrVendor) {
    return fixedStandalone;
  }
  if (isPositiveUnitPrice(fixedStandalone)) {
    return fixedStandalone;
  }

  /** Legacy: addon on top of catalog only when no standalone fixed_price. */
  const catalog = parseAmount(product.catalog_price ?? product.base_price);
  const fixedAddon = parseAmount(product.fixed_price_addon);
  if (catalog != null && fixedAddon != null) {
    const sum = catalog + fixedAddon;
    if (Number.isFinite(sum) && sum >= 0) return sum;
  }

  const price = parseAmount(product.price);
  return price != null && Number.isFinite(price) && price >= 0 ? price : null;
}

export type ClientProductPricingMode = 'base' | 'fixed' | 'per_m2';

export function clientPricingModeToApiType(mode: ClientProductPricingMode): string {
  return mode;
}

export function resolveProductTreeUnitPrice(product: ShopProduct | null | undefined): number | null {
  const nested = product?.tree_pricing?.trees?.unit_price;
  if (isPositiveUnitPrice(nested)) return nested as number;
  return isPositiveUnitPrice(product?.price_per_tree) ? (product!.price_per_tree as number) : null;
}

export function resolveProductPalmUnitPrice(product: ShopProduct | null | undefined): number | null {
  const nested = product?.tree_pricing?.palm_trees?.unit_price;
  if (isPositiveUnitPrice(nested)) return nested as number;
  return isPositiveUnitPrice(product?.price_per_palm) ? (product!.price_per_palm as number) : null;
}

/**
 * Product detail wins for per-product rates (m², catalog price, tree/palm from `tree_pricing`).
 * Global service-pricing / tree-palm settings fill gaps.
 */
export interface ShopProductAreaPricingResolution {
  showSection: boolean;
  unitPricePerM2: number | null;
  optional: boolean;
  /** Use area × rate in totals when area is entered. */
  usePerM2Totals: boolean;
  /** Fixed-mode vendor pricing: show catalog + fixed lines (not m² input). */
  showFixedBreakdown: boolean;
  /** Show m² input on client when area pricing is enabled. */
  showAreaInput: boolean;
  /** Fixed + per m² both available — customer picks a tab on product detail. */
  showPricingModeTabs: boolean;
}

function pickProductAreaUnitPrice(product: ShopProduct | null | undefined): number | null {
  if (!product) return null;
  const record = product as Record<string, unknown>;
  const fromDirect = pickAmountFields(record, [
    'price_per_m2',
    'per_m2_price',
    'unit_rate',
    'm2_unit_price',
    'per_m2_rate',
    'area_unit_price',
  ]);
  if (fromDirect != null) return fromDirect;

  const areaBlock = record.area_pricing;
  if (areaBlock && typeof areaBlock === 'object') {
    const area = areaBlock as Record<string, unknown>;
    const fromBlock = pickAmountFields(area, ['unit_price', 'price_per_m2']);
    if (fromBlock != null) return fromBlock;
  }

  const preview = product.customer_preview?.example;
  if (preview?.price_per_m2 != null) {
    const n = parseAmount(preview.price_per_m2);
    if (isPositiveUnitPrice(n)) return n;
  }

  const embedded = parseEmbeddedProductServicePricing(product);
  if (embedded?.pricing_type === 'per_m2') {
    const n = getEffectiveServicePrice(embedded);
    if (isPositiveUnitPrice(n)) return n;
  }
  if (isPositiveUnitPrice(embedded?.price_per_m2)) {
    return embedded!.price_per_m2 as number;
  }

  const previewRoot = product.customer_preview;
  if (previewRoot && typeof previewRoot === 'object') {
    const previewRecord = previewRoot as Record<string, unknown>;
    const fromPreview = pickAmountFields(previewRecord, [
      'price_per_m2',
      'per_m2_rate',
      'area_unit_price',
      'unit_rate',
    ]);
    if (isPositiveUnitPrice(fromPreview)) return fromPreview;

    const lines = previewRoot.breakdown?.lines;
    if (Array.isArray(lines)) {
      for (const line of lines) {
        const key = String(line?.key ?? '').toLowerCase();
        if (
          key === 'price_per_m2' ||
          key === 'per_m2' ||
          key === 'area_rate' ||
          key === 'unit_price_per_m2'
        ) {
          const n = parseAmount(line?.amount);
          if (isPositiveUnitPrice(n)) return n;
        }
      }
    }
  }

  for (const nestKey of [
    'vendor_service_pricing',
    'vendor_pricing',
    'service_pricing',
    'service_area_pricing',
  ]) {
    const block = record[nestKey];
    if (!block || typeof block !== 'object') continue;
    const nested = block as Record<string, unknown>;
    const nestedType = String(nested.pricing_type ?? '').toLowerCase();
    const fromNested = pickAmountFields(nested, [
      'price_per_m2',
      'unit_price',
      'm2_unit_price',
      'area_unit_price',
    ]);
    if (!isPositiveUnitPrice(fromNested)) continue;
    if (
      nestedType === 'per_m2' ||
      nestedType === 'per_square_meter' ||
      nestedType.includes('m2') ||
      nestKey === 'vendor_service_pricing'
    ) {
      return fromNested;
    }
  }

  return null;
}

/** Per-m² unit rate from shop product (+ optional fetched vendor rate). */
export function resolveProductUnitPricePerM2(
  product: ShopProduct | null | undefined,
  supplementalRate?: number | null
): number | null {
  const fromProduct = pickProductAreaUnitPrice(product);
  if (isPositiveUnitPrice(fromProduct)) return fromProduct;
  if (isPositiveUnitPrice(supplementalRate)) return supplementalRate;
  return null;
}

function parseAreaRateFromShopPayload(payload: unknown): number | null {
  if (payload == null) return null;
  const root = typeof payload === 'object' && payload !== null ? payload : null;
  if (!root) return null;
  const record = root as Record<string, unknown>;
  const data = (record.data != null ? record.data : root) as Record<string, unknown>;

  const direct = pickAmountFields(data, [
    'price_per_m2',
    'per_m2_price',
    'unit_price',
    'area_unit_price',
    'per_m2_rate',
  ]);
  if (isPositiveUnitPrice(direct)) return direct;

  for (const key of ['area_pricing', 'service_pricing', 'vendor_service_pricing', 'pricing']) {
    const block = data[key];
    if (!block || typeof block !== 'object') continue;
    const nested = block as Record<string, unknown>;
    const fromNested = pickAmountFields(nested, [
      'price_per_m2',
      'per_m2_price',
      'unit_price',
      'm2_unit_price',
    ]);
    if (isPositiveUnitPrice(fromNested)) return fromNested;
  }

  const settings =
    parseServicePricingSettings(data) ?? parseServicePricingSettings({ data });
  if (settings?.enable_per_m2 === false) {
    return null;
  }
  if (isPositiveUnitPrice(settings?.per_m2_price)) return settings!.per_m2_price as number;
  if (settings?.pricing_type === 'per_m2') {
    const n = getEffectiveServicePrice(settings);
    if (isPositiveUnitPrice(n)) return n;
  }
  if (isPositiveUnitPrice(settings?.price_per_m2)) return settings!.price_per_m2 as number;

  return null;
}

/**
 * When GET /shop/products/:id omits price_per_m2, try shop vendor/product pricing endpoints.
 */
export async function fetchShopProductAreaUnitPrice(
  productId: number | string,
  vendorId?: number | null
): Promise<number | null> {
  const id = encodeURIComponent(String(productId));
  const vendor =
    vendorId != null && String(vendorId).trim() !== ''
      ? encodeURIComponent(String(vendorId))
      : '';
  const paths = [
    `/shop/products/${id}/area-pricing`,
    `/shop/products/${id}/pricing`,
    ...(vendor
      ? [
          `/shop/vendors/${vendor}/products/${id}/pricing`,
          `/shop/vendors/${vendor}/products/${id}/area-pricing`,
          `/shop/vendors/${vendor}/pricing/service`,
        ]
      : []),
  ];

  for (const path of paths) {
    try {
      const res = await publicApiClient.get(path, { timeout: 12000 });
      const rate = parseAreaRateFromShopPayload(res?.data);
      if (isPositiveUnitPrice(rate)) return rate;
    } catch {
      // try next path
    }
  }
  return null;
}

/** Lift `area_pricing.unit_price` (and aliases) onto `price_per_m2` for shop product detail math. */
export function applyShopProductAreaRateFields(product: ShopProduct): ShopProduct {
  const existing = resolveProductUnitPricePerM2(product);
  if (isPositiveUnitPrice(existing)) {
    const rate = existing as number;
    const ap = product.area_pricing;
    return {
      ...product,
      price_per_m2: rate,
      area_pricing: {
        ...(ap ?? {}),
        enabled: ap?.enabled ?? true,
        optional: ap?.optional ?? product.area_optional !== false,
        unit_price: rate,
      },
    };
  }
  return product;
}

/** Merge a resolved per-m² rate onto a shop product (after supplemental fetch). */
export function withShopProductAreaUnitRate(
  product: ShopProduct,
  ratePerM2: number
): ShopProduct {
  if (!isPositiveUnitPrice(ratePerM2)) return product;
  const ap = product.area_pricing;
  return applyShopProductAreaRateFields({
    ...product,
    price_per_m2: ratePerM2,
    area_pricing: {
      ...(ap ?? {}),
      enabled: true,
      optional: ap?.optional ?? product.area_optional !== false,
      unit_price: ratePerM2,
      price_per_m2: ratePerM2,
    },
  });
}

/** Normalize area fields, then try public shop pricing endpoints when rate is still missing. */
export async function enrichShopProductWithAreaUnitRate(
  product: ShopProduct
): Promise<ShopProduct> {
  let enriched = applyShopProductAreaRateFields(product);
  if (isPositiveUnitPrice(resolveProductUnitPricePerM2(enriched))) {
    return enriched;
  }

  const clientAreaFlag = enriched.show_area_pricing_on_client;
  if (clientAreaFlag !== null && clientAreaFlag !== undefined && !parseBool(clientAreaFlag)) {
    return enriched;
  }

  const hasVendor = enriched.vendor_id != null && String(enriched.vendor_id).trim() !== '';
  if (!hasVendor && !isVendorPerM2PricingEnabled(enriched)) {
    return enriched;
  }

  const rate = await fetchShopProductAreaUnitPrice(
    enriched.id,
    enriched.vendor_id ?? null
  );
  if (isPositiveUnitPrice(rate)) {
    enriched = withShopProductAreaUnitRate(enriched, rate as number);
    enriched = {
      ...enriched,
      enable_per_m2: enriched.enable_per_m2 ?? true,
      show_area_pricing_on_client: enriched.show_area_pricing_on_client ?? true,
      pricing_type: enriched.pricing_type ?? 'per_m2',
    };
  }
  return enriched;
}

async function fetchShopVendorServicePricingSettings(
  vendorId: number | string
): Promise<ServicePricingSettings | null> {
  const vendor = encodeURIComponent(String(vendorId));
  const paths = [
    `/shop/vendors/${vendor}/pricing/service`,
    `/shop/vendors/${vendor}/service-pricing`,
  ];
  for (const path of paths) {
    try {
      const res = await publicApiClient.get(path, { timeout: 12000 });
      const parsed =
        parseServicePricingSettings(res?.data) ??
        parseServicePricingSettings((res?.data as { data?: unknown })?.data);
      if (parsed) return parsed;
    } catch {
      // try next path
    }
  }
  return null;
}

async function fetchShopVendorTreePalmPricingSettings(
  vendorId: number | string
): Promise<ServicePricingSettings | null> {
  const vendor = encodeURIComponent(String(vendorId));
  const paths = [
    `/shop/vendors/${vendor}/pricing/tree-palm`,
    `/shop/vendors/${vendor}/tree-palm-pricing`,
  ];
  for (const path of paths) {
    try {
      const res = await publicApiClient.get(path, { timeout: 12000 });
      const parsed =
        parseTreePalmPricingSettings(res?.data) ??
        parseTreePalmPricingSettings((res?.data as { data?: unknown })?.data);
      if (parsed) return parsed;
    } catch {
      // try next path
    }
  }
  return null;
}

function mergeVendorServicePricingOntoShopProduct(
  product: ShopProduct,
  settings: ServicePricingSettings
): ShopProduct {
  if (!resolveServiceShowOnClientFromSettings(settings)) return product;

  const enableFixed = settings.enable_fixed_price === true;
  const enablePerM2 = settings.enable_per_m2 === true;
  const fixedPrice = coalesceUnitPrice(settings.fixed_price, settings.price);
  const perM2 = coalesceUnitPrice(settings.price_per_m2, settings.per_m2_price);

  let next: ShopProduct = { ...product };
  const hasVendorAreaPricing =
    enableFixed ||
    enablePerM2 ||
    isPositiveUnitPrice(fixedPrice) ||
    isPositiveUnitPrice(perM2);

  if (hasVendorAreaPricing) {
    next.show_area_pricing_on_client = true;
  }
  if (settings.enable_fixed_price !== undefined) {
    next.enable_fixed_price = enableFixed;
  }
  if (settings.enable_per_m2 !== undefined) {
    next.enable_per_m2 = enablePerM2;
  }
  if (isPositiveUnitPrice(fixedPrice)) {
    next.fixed_price = fixedPrice;
  }
  if (isPositiveUnitPrice(perM2)) {
    next = withShopProductAreaUnitRate(next, perM2 as number);
  }

  const areaOpts: NonNullable<ShopProduct['area_pricing_options']> = {
    ...(product.area_pricing_options ?? {}),
  };
  if (enableFixed && isPositiveUnitPrice(fixedPrice)) {
    areaOpts.fixed = {
      ...(areaOpts.fixed ?? {}),
      enabled: true,
      fixed_price: fixedPrice,
      checkout_price: fixedPrice,
    };
  }
  if (enablePerM2 && isPositiveUnitPrice(perM2)) {
    areaOpts.per_m2 = {
      ...(areaOpts.per_m2 ?? {}),
      enabled: true,
      price_per_m2: perM2,
    };
  }
  if (Object.keys(areaOpts).length > 0) {
    next.area_pricing_options = areaOpts;
  }

  if (settings.price_includes) {
    next.price_includes = settings.price_includes;
  }

  return applyShopProductAreaRateFields({
    ...next,
    vendor_service_pricing: settings as unknown as Record<string, unknown>,
  });
}

function mergeVendorTreePalmOntoShopProduct(
  product: ShopProduct,
  settings: ServicePricingSettings
): ShopProduct {
  if (!resolveTreePalmShowOnClientFromSettings(settings)) return product;

  const treeUnit = resolveTreeUnitPrice(settings);
  const palmUnit = resolvePalmUnitPrice(settings);
  if (!isPositiveUnitPrice(treeUnit) && !isPositiveUnitPrice(palmUnit)) {
    return product;
  }

  const tree_pricing: NonNullable<ShopProduct['tree_pricing']> = {
    enabled: true,
    optional: true,
    ...(product.tree_pricing ?? {}),
  };
  if (isPositiveUnitPrice(treeUnit)) {
    tree_pricing.trees = {
      ...(product.tree_pricing?.trees ?? {}),
      unit_price: treeUnit as number,
      unit_price_label: settings.price_per_tree_suffix,
      label: settings.price_per_tree_label,
    };
  }
  if (isPositiveUnitPrice(palmUnit)) {
    tree_pricing.palm_trees = {
      ...(product.tree_pricing?.palm_trees ?? {}),
      unit_price: palmUnit as number,
      unit_price_label: settings.price_per_palm_tree_suffix,
      label: settings.price_per_palm_tree_label,
    };
  }

  return {
    ...product,
    show_tree_options: true,
    tree_pricing,
    price_per_tree: treeUnit ?? product.price_per_tree,
    price_per_palm: palmUnit ?? product.price_per_palm,
  };
}

/**
 * When GET /shop/products/:id omits vendor pricing flags, merge public vendor pricing endpoints.
 */
export async function enrichShopProductWithClientVendorPricing(
  product: ShopProduct
): Promise<ShopProduct> {
  let enriched = await enrichShopProductWithAreaUnitRate(product);
  const vendorId = enriched.vendor_id;
  if (vendorId == null || String(vendorId).trim() === '') {
    return enriched;
  }

  const needsAreaMerge =
    enriched.show_area_pricing_on_client == null ||
    (!isVendorFixedPricingEnabled(enriched) && !isVendorPerM2PricingEnabled(enriched));

  const needsTreeMerge =
    !isProductTreePalmEnabled(enriched) && enriched.show_tree_options !== false;

  if (needsAreaMerge) {
    const serviceSettings = await fetchShopVendorServicePricingSettings(vendorId);
    if (serviceSettings) {
      enriched = mergeVendorServicePricingOntoShopProduct(enriched, serviceSettings);
    }
  }

  if (needsTreeMerge) {
    const treeSettings = await fetchShopVendorTreePalmPricingSettings(vendorId);
    if (treeSettings) {
      enriched = mergeVendorTreePalmOntoShopProduct(enriched, treeSettings);
    }
  }

  if (
    isVendorPerM2PricingEnabled(enriched) &&
    !isPositiveUnitPrice(resolveProductUnitPricePerM2(enriched))
  ) {
    const rate = await fetchShopProductAreaUnitPrice(enriched.id, vendorId);
    if (isPositiveUnitPrice(rate)) {
      enriched = withShopProductAreaUnitRate(enriched, rate as number);
    }
  }

  return enriched;
}

function pickAmountFields(
  record: Record<string, unknown>,
  keys: string[]
): number | null {
  for (const key of keys) {
    const n = parseAmount(record[key]);
    if (isPositiveUnitPrice(n)) return n;
  }
  return null;
}

/** Vendor turned on fixed checkout for this product (not catalog price alone). */
export function isVendorFixedPricingEnabled(product: ShopProduct | null | undefined): boolean {
  if (!product) return false;
  const record = product as Record<string, unknown>;
  const areaOpts = record.area_pricing_options;
  if (areaOpts && typeof areaOpts === 'object') {
    const fixed = (areaOpts as Record<string, unknown>).fixed;
    if (fixed && typeof fixed === 'object') {
      const f = fixed as Record<string, unknown>;
      if (f.enabled !== undefined && f.enabled !== null && !parseBool(f.enabled)) {
        return false;
      }
      if (parseBool(f.enabled)) {
        const price = parseAmount(f.fixed_price ?? f.checkout_price);
        if (isPositiveUnitPrice(price)) return true;
      }
    }
  }
  if (product.enable_fixed_price === false) return false;
  if (!parseBool(product.enable_fixed_price)) return false;
  return isPositiveUnitPrice(parseAmount(product.fixed_price ?? product.fixed_price_addon));
}

/** Vendor turned on per m² with a unit rate. */
export function isVendorPerM2PricingEnabled(product: ShopProduct | null | undefined): boolean {
  if (!product) return false;
  const record = product as Record<string, unknown>;
  const areaOpts = record.area_pricing_options;
  if (areaOpts && typeof areaOpts === 'object') {
    const perM2 = (areaOpts as Record<string, unknown>).per_m2;
    if (perM2 && typeof perM2 === 'object') {
      const p = perM2 as Record<string, unknown>;
      if (p.enabled !== undefined && p.enabled !== null && !parseBool(p.enabled)) {
        return false;
      }
      if (parseBool(p.enabled)) {
        const rate = parseAmount(p.price_per_m2);
        if (isPositiveUnitPrice(rate)) return true;
      }
    }
  }
  if (product.enable_per_m2 === false) return false;
  if (!parseBool(product.enable_per_m2)) return false;
  return isPositiveUnitPrice(pickProductAreaUnitPrice(product));
}

/** When to show Area (m²) on shop product detail and which unit rate to use. */
export function resolveShopProductAreaPricing(
  product: ShopProduct | null | undefined,
  options?: {
    fromServiceCatalog?: boolean;
    globalSettings?: ServicePricingSettings | null;
  }
): ShopProductAreaPricingResolution {
  const optionalDefault = true;
  const hidden: ShopProductAreaPricingResolution = {
    showSection: false,
    unitPricePerM2: null,
    optional: optionalDefault,
    usePerM2Totals: false,
    showFixedBreakdown: false,
    showAreaInput: false,
    showPricingModeTabs: false,
  };
  if (!product) {
    return hidden;
  }

  const unitPricePerM2 = pickProductAreaUnitPrice(product);
  const record = product as Record<string, unknown>;
  const areaBlock = record.area_pricing as ShopProduct['area_pricing'];

  const clientAreaFlag = product.show_area_pricing_on_client;
  if (clientAreaFlag !== null && clientAreaFlag !== undefined) {
    if (!parseBool(clientAreaFlag)) {
      return hidden;
    }

    const hasVendorFixed = isVendorFixedPricingEnabled(product);
    const hasVendorPerM2 = isVendorPerM2PricingEnabled(product);

    /** Simple catalog products: no fixed / m² tabs unless vendor enabled at least one mode. */
    if (!hasVendorFixed && !hasVendorPerM2) {
      return hidden;
    }

    const hasM2Rate = isPositiveUnitPrice(unitPricePerM2);
    const showFixedBreakdown = hasVendorFixed;
    const showAreaInput = hasVendorPerM2;
    const hasBaseOption = isPositiveUnitPrice(resolveShopProductCatalogBase(product));
    const showPricingModeTabs = hasBaseOption && (hasVendorFixed || hasVendorPerM2);

    return {
      showSection: true,
      unitPricePerM2: hasVendorPerM2 ? unitPricePerM2 : null,
      optional: product.requires_area !== true,
      usePerM2Totals: hasVendorPerM2 && hasM2Rate,
      showFixedBreakdown,
      showAreaInput,
      showPricingModeTabs,
    };
  }

  const legacyVisible = (
    perM2: boolean,
    optional: boolean,
    useTotals: boolean
  ): ShopProductAreaPricingResolution => ({
    showSection: true,
    unitPricePerM2,
    optional,
    usePerM2Totals: useTotals,
    showFixedBreakdown: false,
    showAreaInput: true,
    showPricingModeTabs: false,
  });

  if (areaBlock && parseBool(areaBlock.enabled)) {
    return legacyVisible(
      isPositiveUnitPrice(unitPricePerM2),
      areaBlock.optional !== false,
      isPositiveUnitPrice(unitPricePerM2)
    );
  }

  if (isPerM2ServicePricing(product.pricing_type)) {
    return legacyVisible(
      isPositiveUnitPrice(unitPricePerM2),
      product.requires_area !== true,
      isPositiveUnitPrice(unitPricePerM2)
    );
  }

  if (isPositiveUnitPrice(unitPricePerM2)) {
    return legacyVisible(true, product.area_optional !== false, true);
  }

  if (product.requires_area === true) {
    return legacyVisible(
      isPositiveUnitPrice(unitPricePerM2),
      false,
      isPositiveUnitPrice(unitPricePerM2)
    );
  }

  if (product.show_area_input === true) {
    return legacyVisible(
      isPositiveUnitPrice(unitPricePerM2),
      true,
      isPositiveUnitPrice(unitPricePerM2)
    );
  }

  const global = options?.globalSettings;
  if (
    options?.fromServiceCatalog &&
    isCustomerServicePricingVisible(global) &&
    global?.pricing_type === 'per_m2'
  ) {
    const globalRate = getEffectiveServicePrice(global);
    return legacyVisible(
      isPositiveUnitPrice(globalRate),
      true,
      isPositiveUnitPrice(globalRate)
    );
  }

  return hidden;
}

function parseEmbeddedProductServicePricing(
  product: ShopProduct | null | undefined
): ServicePricingSettings | null {
  if (!product || typeof product !== 'object') return null;
  const record = product as Record<string, unknown>;
  const raw =
    record.service_pricing ??
    record.vendor_service_pricing ??
    record.area_pricing ??
    record.service;
  if (!raw) return null;
  return (
    parseServicePricingSettings(raw) ??
    parseServicePricingSettings({ data: raw })
  );
}

export function mergeShopProductWithServicePricing(
  global: ServicePricingSettings | null,
  product: ShopProduct | null | undefined
): ServicePricingSettings | null {
  if (!product) return global;

  const embeddedService = parseEmbeddedProductServicePricing(product);
  let effectiveGlobal =
    embeddedService && global
      ? {
          ...global,
          ...embeddedService,
          pricing_type: embeddedService.pricing_type ?? global.pricing_type,
          price_per_m2: coalesceUnitPrice(
            embeddedService.price_per_m2,
            embeddedService.per_m2_price,
            global.price_per_m2,
            global.per_m2_price
          ),
          per_m2_price: coalesceUnitPrice(
            embeddedService.per_m2_price,
            embeddedService.price_per_m2,
            global.per_m2_price,
            global.price_per_m2
          ),
          price: coalesceUnitPrice(embeddedService.price, global.price),
          fixed_price: coalesceUnitPrice(embeddedService.fixed_price, global.fixed_price),
          service_pricing_enabled:
            embeddedService.service_pricing_enabled ?? global.service_pricing_enabled,
          price_includes: embeddedService.price_includes ?? global.price_includes,
        }
      : embeddedService ?? global;
  if (global && global.service_pricing_enabled === false) {
    effectiveGlobal = {
      ...global,
      pricing_type: 'fixed',
      price: null,
      price_per_m2: null,
      requires_area: false,
    };
  }

  const overlay: Partial<ServicePricingSettings> = {};

  if (product.pricing_type != null && String(product.pricing_type).trim() !== '') {
    overlay.pricing_type = parseServicePricingType(product.pricing_type);
  }

  const perM2 = parseAmount(
    product.price_per_m2 ??
      product.unit_rate ??
      product.area_pricing?.unit_price ??
      product.area_pricing?.price_per_m2
  );
  if (perM2 != null) {
    overlay.price_per_m2 = perM2;
    overlay.per_m2_price = perM2;
  }

  const catalogPrice = parseAmount(product.catalog_price ?? product.price);
  if (catalogPrice != null) overlay.price = catalogPrice;

  if (product.price_includes && typeof product.price_includes === 'object') {
    overlay.price_includes = parseShopProductPriceIncludes(product);
  }
  if (Array.isArray(product.price_includes_labels) && product.price_includes_labels.length > 0) {
    overlay.price_includes_labels = product.price_includes_labels.map(String);
  }

  if (product.requires_area != null) {
    overlay.requires_area = parseBool(product.requires_area);
  } else if (product.area_optional === true && overlay.pricing_type === 'per_m2') {
    overlay.requires_area = false;
  }

  const treeUnit = resolveProductTreeUnitPrice(product);
  const palmUnit = resolveProductPalmUnitPrice(product);
  if (treeUnit != null) overlay.price_per_tree = treeUnit;
  if (palmUnit != null) overlay.price_per_palm = palmUnit;

  if (isProductTreePalmEnabled(product)) {
    overlay.tree_palm_pricing_enabled = true;
  }

  const treeMeta = product.tree_pricing?.trees;
  const palmMeta = product.tree_pricing?.palm_trees;
  if (treeMeta?.label) overlay.price_per_tree_label = treeMeta.label;
  if (palmMeta?.label) overlay.price_per_palm_tree_label = palmMeta.label;
  if (treeMeta?.unit_price_label) overlay.price_per_tree_suffix = treeMeta.unit_price_label;
  if (palmMeta?.unit_price_label) overlay.price_per_palm_tree_suffix = palmMeta.unit_price_label;

  if (typeof product.currency === 'string' && product.currency.trim()) {
    overlay.currency = product.currency.trim();
  }

  if (!effectiveGlobal) {
    return {
      pricing_type: overlay.pricing_type ?? 'fixed',
      price: overlay.price ?? null,
      price_per_m2: overlay.price_per_m2 ?? null,
      price_per_tree: overlay.price_per_tree ?? null,
      price_per_palm: overlay.price_per_palm ?? null,
      tree_palm_pricing_enabled: overlay.tree_palm_pricing_enabled ?? false,
      service_pricing_enabled: global?.service_pricing_enabled,
      currency: overlay.currency ?? 'AED',
      requires_area: overlay.requires_area ?? false,
      price_includes: overlay.price_includes ?? { ...DEFAULT_INCLUDES },
      price_includes_labels: overlay.price_includes_labels,
      price_per_tree_label: overlay.price_per_tree_label,
      price_per_palm_tree_label: overlay.price_per_palm_tree_label,
      price_per_tree_suffix: overlay.price_per_tree_suffix,
      price_per_palm_tree_suffix: overlay.price_per_palm_tree_suffix,
    };
  }

  return {
    ...effectiveGlobal,
    pricing_type: overlay.pricing_type ?? effectiveGlobal.pricing_type,
    price: overlay.price ?? effectiveGlobal.price,
    fixed_price: coalesceUnitPrice(overlay.fixed_price, effectiveGlobal.fixed_price),
    price_per_m2: coalesceUnitPrice(
      overlay.price_per_m2,
      overlay.per_m2_price,
      effectiveGlobal.price_per_m2,
      effectiveGlobal.per_m2_price
    ),
    per_m2_price: coalesceUnitPrice(
      overlay.per_m2_price,
      overlay.price_per_m2,
      effectiveGlobal.per_m2_price,
      effectiveGlobal.price_per_m2
    ),
    price_per_tree: coalesceUnitPrice(overlay.price_per_tree, effectiveGlobal.price_per_tree),
    price_per_palm: coalesceUnitPrice(overlay.price_per_palm, effectiveGlobal.price_per_palm),
    tree_palm_pricing_enabled:
      overlay.tree_palm_pricing_enabled ?? effectiveGlobal.tree_palm_pricing_enabled,
    service_pricing_enabled: effectiveGlobal.service_pricing_enabled,
    requires_area: overlay.requires_area ?? effectiveGlobal.requires_area,
    price_includes: overlay.price_includes ?? effectiveGlobal.price_includes,
    price_includes_labels: overlay.price_includes_labels ?? effectiveGlobal.price_includes_labels,
    price_per_tree_label: overlay.price_per_tree_label ?? effectiveGlobal.price_per_tree_label,
    price_per_palm_tree_label:
      overlay.price_per_palm_tree_label ?? effectiveGlobal.price_per_palm_tree_label,
    price_per_tree_suffix: overlay.price_per_tree_suffix ?? effectiveGlobal.price_per_tree_suffix,
    price_per_palm_tree_suffix:
      overlay.price_per_palm_tree_suffix ?? effectiveGlobal.price_per_palm_tree_suffix,
    currency: overlay.currency ?? effectiveGlobal.currency,
    tree_palm_price_includes: effectiveGlobal.tree_palm_price_includes,
    tree_palm_price_includes_labels: effectiveGlobal.tree_palm_price_includes_labels,
  };
}
