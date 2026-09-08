import apiClient from './api';
import { publicApiClient } from './api';

export type ServicePricingType = 'fixed' | 'per_m2';

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
  /** Unit price when pricing_type is per_m2. */
  price_per_m2: number | null;
  currency?: string;
  requires_area?: boolean;
  price_includes: ServicePriceIncludes;
  price_includes_labels?: string[];
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

function parsePricingType(raw: unknown): ServicePricingType {
  return String(raw || '').toLowerCase() === 'per_m2' ? 'per_m2' : 'fixed';
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

  const pricing_type = parsePricingType(data.pricing_type ?? data.pricingType);
  const fixedPrice = parseAmount(data.price ?? data.amount);
  const perM2Price = parseAmount(data.price_per_m2);

  if (pricing_type === 'fixed' && fixedPrice == null && perM2Price == null) return null;
  if (pricing_type === 'per_m2' && perM2Price == null && fixedPrice == null) return null;

  return {
    pricing_type,
    price: fixedPrice,
    price_per_m2: perM2Price,
    currency: typeof data.currency === 'string' ? data.currency : 'AED',
    requires_area: Boolean(data.requires_area ?? pricing_type === 'per_m2'),
    price_includes: parseIncludes(data),
    price_includes_labels: Array.isArray(data.price_includes_labels)
      ? data.price_includes_labels.map(String)
      : undefined,
  };
}

/**
 * Public/customer service pricing (area-based vs fixed).
 * Tries several endpoints so admin-updated settings appear on the client.
 */
export async function getServicePricingSettings(): Promise<ServicePricingSettings | null> {
  const paths = [
    '/settings/service-pricing',
    '/shop/settings/service-pricing',
    '/shop/service-pricing',
    '/admin/settings/service-pricing',
  ];

  for (const path of paths) {
    try {
      const res = await publicApiClient.get(path, { timeout: 15000 });
      const parsed =
        parseServicePricingSettings(res?.data) ?? parseServicePricingSettings(res?.data?.data);
      if (parsed) return parsed;
    } catch {
      // try next
    }
  }

  try {
    const res = await apiClient.get('/settings/service-pricing', { timeout: 15000 });
    const parsed =
      parseServicePricingSettings(res?.data) ?? parseServicePricingSettings(res?.data?.data);
    if (parsed) return parsed;
  } catch {
    // ignore
  }

  try {
    const res = await apiClient.get('/admin/settings/service-pricing', { timeout: 15000 });
    const parsed =
      parseServicePricingSettings(res?.data) ?? parseServicePricingSettings(res?.data?.data);
    if (parsed) return parsed;
  } catch {
    // ignore
  }

  return null;
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

/** Effective unit rate for per_m2, or fixed price amount. */
export function getEffectiveServicePrice(settings: ServicePricingSettings | null): number | null {
  if (!settings) return null;
  if (settings.pricing_type === 'per_m2') {
    return settings.price_per_m2 ?? settings.price;
  }
  return settings.price ?? settings.price_per_m2;
}
