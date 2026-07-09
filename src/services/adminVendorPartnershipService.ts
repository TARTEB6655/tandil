import apiClient from './api';

export interface VendorPartnershipTierFeatures {
  partner_logo?: boolean;
  product_images?: boolean;
  shop_mention?: boolean;
  monthly_report?: boolean;
  app_banner?: boolean;
  home_banner?: boolean;
  social_media_post?: boolean;
  discount_code?: boolean;
  video_content?: boolean;
  [key: string]: boolean | undefined;
}

export interface VendorPartnershipTier {
  id: number | string;
  slug: string;
  name: string;
  badge_color: string;
  price: number;
  currency: string;
  duration_months: number;
  required_products_min: number;
  required_products_max: number;
  max_product_listings: number;
  max_partner_product_images: number;
  marketing_exposure: string;
  social_media_posts_per_month: number;
  app_banners: number;
  home_banner_size: string;
  benefits: string[];
  features: VendorPartnershipTierFeatures;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface VendorPartnershipTierPayload {
  slug: string;
  name: string;
  badge_color: string;
  price: number;
  currency: string;
  duration_months: number;
  required_products_min: number;
  required_products_max: number;
  max_product_listings: number;
  max_partner_product_images: number;
  marketing_exposure: string;
  social_media_posts_per_month: number;
  app_banners: number;
  home_banner_size: string;
  benefits: string[];
  features: VendorPartnershipTierFeatures;
  sort_order: number;
  is_active: boolean;
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

function pickNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  if (!Number.isNaN(num)) return num;
  return fallback;
}

function pickBool(value: unknown, fallback = false): boolean {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

function mapFeatures(raw: unknown): VendorPartnershipTierFeatures {
  const row = asRecord(raw);
  if (!row) return {};
  const features: VendorPartnershipTierFeatures = {};
  Object.entries(row).forEach(([key, value]) => {
    if (typeof value === 'boolean') features[key] = value;
  });
  return features;
}

function mapTier(raw: unknown): VendorPartnershipTier | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = row.id ?? row.tier_id ?? row.partnership_tier_id;
  if (id == null || id === '') return null;

  const benefitsRaw = row.benefits;
  const benefits = Array.isArray(benefitsRaw)
    ? benefitsRaw.map((item) => String(item).trim()).filter(Boolean)
    : pickString(benefitsRaw)
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);

  return {
    id,
    slug: pickString(row.slug),
    name: pickString(row.name, row.title) || 'Tier',
    badge_color: pickString(row.badge_color, row.color) || 'green',
    price: pickNumber(row.price),
    currency: pickString(row.currency) || 'AED',
    duration_months: pickNumber(row.duration_months, 1),
    required_products_min: pickNumber(row.required_products_min),
    required_products_max: pickNumber(row.required_products_max),
    max_product_listings: pickNumber(row.max_product_listings),
    max_partner_product_images: pickNumber(row.max_partner_product_images, 1),
    marketing_exposure: pickString(row.marketing_exposure) || 'low',
    social_media_posts_per_month: pickNumber(row.social_media_posts_per_month),
    app_banners: pickNumber(row.app_banners),
    home_banner_size: pickString(row.home_banner_size) || 'none',
    benefits,
    features: mapFeatures(row.features),
    sort_order: pickNumber(row.sort_order),
    is_active: pickBool(row.is_active, true),
    created_at: pickString(row.created_at) || undefined,
    updated_at: pickString(row.updated_at) || undefined,
  };
}

function mapTiers(raw: unknown): VendorPartnershipTier[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(mapTier)
    .filter((item): item is VendorPartnershipTier => item != null)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function extractPayload(payload: unknown): Record<string, unknown> {
  const body = asRecord(payload);
  if (!body) throw new Error('Invalid response.');
  if (body.success === false || body.status === false) {
    throw new Error(pickString(body.message) || 'Request failed.');
  }
  return asRecord(body.data) ?? body;
}

function extractTierList(payload: unknown): VendorPartnershipTier[] {
  const data = extractPayload(payload);
  if (Array.isArray(data)) return mapTiers(data);
  const nested = asRecord(data.data);
  if (Array.isArray(nested)) return mapTiers(nested);
  if (nested && Array.isArray(nested.data)) return mapTiers(nested.data);
  if (Array.isArray(data.tiers)) return mapTiers(data.tiers);
  if (Array.isArray(data.items)) return mapTiers(data.items);
  return [];
}

function extractTier(payload: unknown): VendorPartnershipTier {
  const data = extractPayload(payload);
  const tier =
    mapTier(data.tier) ??
    mapTier(data.partnership_tier) ??
    mapTier(asRecord(data.data)?.tier) ??
    mapTier(asRecord(data.data)) ??
    mapTier(data);
  if (!tier) throw new Error('Tier not found in response.');
  return tier;
}

function sanitizeFeatures(features: VendorPartnershipTierFeatures): VendorPartnershipTierFeatures {
  const cleaned: VendorPartnershipTierFeatures = {};
  Object.entries(features).forEach(([key, value]) => {
    if (value === true) cleaned[key] = true;
  });
  return cleaned;
}

function sanitizePayload(payload: VendorPartnershipTierPayload): VendorPartnershipTierPayload {
  return {
    ...payload,
    slug: payload.slug.trim().toLowerCase(),
    name: payload.name.trim(),
    currency: payload.currency.trim().toUpperCase(),
    benefits: payload.benefits.map((item) => item.trim()).filter(Boolean),
    features: sanitizeFeatures(payload.features),
  };
}

export const adminVendorPartnershipService = {
  /** GET /admin/vendor-partnership/tiers */
  async listTiers(): Promise<VendorPartnershipTier[]> {
    const response = await apiClient.get('/admin/vendor-partnership/tiers', { timeout: 20000 });
    return extractTierList(response.data);
  },

  /** GET /admin/vendor-partnership/tiers/:id */
  async getTier(tierId: number | string): Promise<VendorPartnershipTier> {
    const response = await apiClient.get(`/admin/vendor-partnership/tiers/${tierId}`, {
      timeout: 20000,
    });
    return extractTier(response.data);
  },

  /** POST /admin/vendor-partnership/tiers */
  async createTier(payload: VendorPartnershipTierPayload): Promise<VendorPartnershipTier> {
    const response = await apiClient.post(
      '/admin/vendor-partnership/tiers',
      sanitizePayload(payload),
      {
        timeout: 20000,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      }
    );
    return extractTier(response.data);
  },

  /** PUT /admin/vendor-partnership/tiers/:id */
  async updateTier(
    tierId: number | string,
    payload: VendorPartnershipTierPayload
  ): Promise<VendorPartnershipTier> {
    const response = await apiClient.put(
      `/admin/vendor-partnership/tiers/${tierId}`,
      sanitizePayload(payload),
      {
        timeout: 20000,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      }
    );
    return extractTier(response.data);
  },

  /** DELETE /admin/vendor-partnership/tiers/:id */
  async deactivateTier(tierId: number | string): Promise<string> {
    const response = await apiClient.delete(`/admin/vendor-partnership/tiers/${tierId}`, {
      timeout: 15000,
      headers: { Accept: 'application/json' },
    });
    const body = asRecord(response.data);
    if (body?.success === false) {
      throw new Error(pickString(body.message) || 'Failed to deactivate tier.');
    }
    return pickString(body?.message) || 'Tier deactivated.';
  },
};
