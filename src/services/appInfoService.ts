/**
 * App info / legal pages for client & vendor apps.
 * Public routes:
 *   GET /{client|vendor}/{contact-us|terms-and-conditions|privacy-policy}
 */
import { publicApiClient } from './api';
import {
  APP_CONTENT_PAGE_SLUG,
  APP_INFO_PAGE_SLUG,
  AppContactInfo,
  AppContentPageKey,
  AppInfoAudience,
  AppInfoPageKey,
  DEFAULT_CLIENT_CONTACT,
  DEFAULT_VENDOR_CONTACT,
} from '../types/appInfo';

export interface AppInfoPageContent {
  title?: string;
  subtitle?: string;
  body: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(source: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return undefined;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractNestedData(data: unknown): Record<string, unknown> | null {
  const root = asRecord(data);
  if (!root) return null;
  return asRecord(root.data) ?? root;
}

function extractBody(data: unknown): AppInfoPageContent | null {
  const nested = extractNestedData(data);
  if (!nested) return null;

  const title = stringField(nested, 'title', 'page_title', 'name');
  const subtitle = stringField(nested, 'subtitle');

  // Prefer flat content only. Never merge legacy sections (they stay stale on backend).
  const body =
    stringField(nested, 'content_body', 'body', 'content', 'html', 'intro') || '';

  if (!body.trim()) return null;
  return { title, subtitle, body: stripHtml(body) };
}

function getPublicPagePaths(audience: AppInfoAudience, slug: string): string[] {
  const audiencePrefix = audience === 'vendor' ? 'vendor' : 'client';
  return [
    `/${audiencePrefix}/${slug}`,
    `/shop/pages/${slug}`,
    `/${audiencePrefix}/pages/${slug}`,
    `/pages/${slug}`,
  ];
}

/**
 * GET client app-info pages (who-we-are / privacy / terms).
 */
export async function fetchAppInfoPage(key: AppInfoPageKey): Promise<AppInfoPageContent | null> {
  if (key === 'contact_us') {
    // Contact is structured; callers should use fetchAppContactInfo.
    return null;
  }
  if (key === 'privacy_policy' || key === 'terms_conditions') {
    return fetchAppContentPage('client', key);
  }

  const slug = APP_INFO_PAGE_SLUG[key];
  for (const path of getPublicPagePaths('client', slug)) {
    try {
      const response = await publicApiClient.get(path, { timeout: 12000 });
      const parsed = extractBody(response.data);
      if (parsed) return parsed;
    } catch {
      // try next path
    }
  }
  return null;
}

/**
 * Fetch legal page content for client or vendor apps.
 */
export async function fetchAppContentPage(
  audience: AppInfoAudience,
  pageKey: AppContentPageKey
): Promise<AppInfoPageContent | null> {
  if (pageKey === 'contact_us') return null;
  const slug = APP_CONTENT_PAGE_SLUG[audience][pageKey];
  for (const path of getPublicPagePaths(audience, slug)) {
    try {
      const response = await publicApiClient.get(path, { timeout: 12000 });
      const parsed = extractBody(response.data);
      if (parsed) return parsed;
    } catch {
      // try next path
    }
  }
  return null;
}

function parseContactInfoFromBody(body: string | undefined | null): AppContactInfo | null {
  if (!body?.trim()) return null;
  const trimmed = body.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed) as AppContactInfo;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseContactInfoResponse(data: unknown): AppContactInfo | null {
  const nested = extractNestedData(data);
  if (!nested) return null;

  const flat: AppContactInfo = {
    company: stringField(nested, 'company', 'company_name'),
    website: stringField(nested, 'website', 'website_url'),
    websiteLabel: stringField(nested, 'website_label'),
    email: stringField(nested, 'email', 'contact_email', 'support_email'),
    phone: stringField(nested, 'phone', 'contact_phone', 'support_phone'),
    whatsappDisplay: stringField(nested, 'whatsapp_display', 'whatsapp'),
    whatsappDial: stringField(
      nested,
      'whatsapp_dial_number',
      'whatsapp_dial',
      'whatsapp_number'
    ),
    country: stringField(nested, 'country', 'location'),
    heroTitle: stringField(nested, 'hero_title'),
    heroText: stringField(
      nested,
      'hero_description',
      'hero_text',
      'description'
    ),
    note: stringField(nested, 'note', 'support_note', 'response_notice'),
  };

  const hero = asRecord(nested.hero);
  const company = asRecord(nested.company);
  if (hero) {
    flat.heroTitle = flat.heroTitle || stringField(hero, 'title');
    flat.heroText = flat.heroText || stringField(hero, 'description', 'text');
  }
  if (company) {
    flat.company = flat.company || stringField(company, 'name', 'company_name');
    flat.country = flat.country || stringField(company, 'location', 'country');
  }

  const reachUs = Array.isArray(nested.reach_us) ? nested.reach_us : [];
  for (const item of reachUs) {
    const row = asRecord(item);
    if (!row) continue;
    const type = String(row.type || '').toLowerCase();
    const value = stringField(row, 'value') || '';
    if (type === 'website') {
      flat.websiteLabel = flat.websiteLabel || value;
      flat.website =
        flat.website ||
        (value.startsWith('http') ? value : value ? `https://${value}` : undefined);
    } else if (type === 'email') {
      flat.email = flat.email || value;
    } else if (type === 'whatsapp') {
      flat.whatsappDisplay = flat.whatsappDisplay || value;
      flat.whatsappDial = flat.whatsappDial || value.replace(/\s+/g, '');
    } else if (type === 'phone') {
      flat.phone = flat.phone || value;
    }
  }

  // If body is JSON string fallback
  const body = stringField(nested, 'body', 'content');
  const fromBody = parseContactInfoFromBody(body);
  const merged = { ...fromBody, ...flat };

  return Object.values(merged).some((item) => Boolean(item?.trim())) ? merged : null;
}

export function getDefaultContactInfo(audience: AppInfoAudience): AppContactInfo {
  return audience === 'vendor' ? { ...DEFAULT_VENDOR_CONTACT } : { ...DEFAULT_CLIENT_CONTACT };
}

export async function fetchAppContactInfo(audience: AppInfoAudience): Promise<AppContactInfo> {
  const defaults = getDefaultContactInfo(audience);
  const slug = APP_CONTENT_PAGE_SLUG[audience].contact_us;
  for (const path of getPublicPagePaths(audience, slug)) {
    try {
      const response = await publicApiClient.get(path, { timeout: 12000 });
      const direct = parseContactInfoResponse(response.data);
      if (direct) return { ...defaults, ...direct };
    } catch {
      // try next public contact route
    }
  }
  return defaults;
}
