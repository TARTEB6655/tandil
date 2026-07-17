/**
 * Admin CRUD for legal / contact pages.
 * Real API (Postman 19. Legal & Contact Content):
 *   GET/PUT /admin/{client|vendor}/{contact-us|terms-and-conditions|privacy-policy}
 * Public:
 *   GET /{client|vendor}/{contact-us|terms-and-conditions|privacy-policy}
 *
 * Response shapes:
 * - privacy: { title, subtitle, body }
 * - terms: { title, effective_date, intro, sections[] }
 * - contact: { title, subtitle, hero, company, reach_us[], response_notice }
 */
import apiClient from './api';
import {
  APP_CONTENT_PAGE_SLUG,
  AppContactInfo,
  AppContentPageKey,
  AppInfoAudience,
  DEFAULT_CLIENT_CONTACT,
  DEFAULT_VENDOR_CONTACT,
} from '../types/appInfo';
import { AppInfoPageContent } from './appInfoService';

export interface AdminAppContentPage extends AppInfoPageContent {
  slug?: string;
  audience?: AppInfoAudience;
  pageKey?: AppContentPageKey;
  subtitle?: string;
}

export interface SaveAdminAppContentPayload {
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

function toHtmlParagraphs(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  return trimmed
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function extractNestedData(data: unknown): Record<string, unknown> | null {
  const root = asRecord(data);
  if (!root) return null;
  return asRecord(root.data) ?? root;
}

function extractPrivacyOrTerms(data: unknown): AdminAppContentPage | null {
  const nested = extractNestedData(data);
  if (!nested) return null;

  const title = stringField(nested, 'title', 'page_title', 'name');
  const subtitle = stringField(nested, 'subtitle');

  // Terms/privacy editable content is flat text only.
  // Never append legacy `sections` — backend keeps old section rows after
  // content_body updates, which made default "About Tandil" text reappear.
  const body =
    stringField(nested, 'content_body', 'body', 'content', 'html', 'intro') || '';

  if (!body.trim() && !title) return null;
  return {
    title,
    subtitle,
    body: stripHtml(body),
  };
}

function extractContactInfo(data: unknown): AppContactInfo | null {
  const nested = extractNestedData(data);
  if (!nested) return null;

  // Flat / legacy fields
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

  // Structured API shape
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

  return Object.values(flat).some((value) => Boolean(value?.trim())) ? flat : null;
}

function append(form: FormData, key: string, value: string | undefined | null): void {
  if (value == null) return;
  form.append(key, value);
}

function createPrivacyOrTermsForm(
  pageKey: AppContentPageKey,
  payload: SaveAdminAppContentPayload,
  spoofPut: boolean
): FormData {
  const form = new FormData();
  if (spoofPut) form.append('_method', 'PUT');

  const text = payload.body ?? '';
  const html = toHtmlParagraphs(text);

  if (pageKey === 'terms_conditions') {
    // Exact keys from Postman: Save Terms & Conditions — form-data
    append(form, 'page_title', payload.title?.trim() || 'Terms & Conditions');
    append(form, 'content_body', html);
    // Keep public GET intro in sync with what admin edited.
    append(form, 'intro', html);
    // Replace legacy sections with the new text only (backend does not delete old rows
    // when only content_body is sent, so old "About Tandil" kept coming back).
    append(
      form,
      'sections',
      JSON.stringify([
        {
          number: 1,
          title: payload.title?.trim() || 'Terms & Conditions',
          body: stripHtml(text),
        },
      ])
    );
    return form;
  }

  // Privacy (until Postman fields confirmed)
  append(form, 'page_title', payload.title?.trim() || 'Privacy Policy');
  append(form, 'title', payload.title?.trim() || 'Privacy Policy');
  append(form, 'locale', 'en');
  append(
    form,
    'subtitle',
    payload.subtitle?.trim() ||
      'How Tandil collects, uses, and protects your information'
  );
  append(form, 'body', html);
  append(form, 'content_body', html);

  return form;
}

function createContactForm(payload: SaveAdminAppContentPayload, spoofPut: boolean): FormData {
  const form = new FormData();
  if (spoofPut) form.append('_method', 'PUT');

  const contact = parseContactInfoFromBody(payload.body) ?? {};
  // Exact keys from Postman: Save Contact Us — form-data
  append(form, 'page_title', payload.title?.trim() || 'Contact Us');
  append(form, 'company_name', contact.company);
  append(form, 'website_url', contact.website);
  append(form, 'website_label', contact.websiteLabel);
  append(form, 'email', contact.email);
  append(form, 'phone', contact.phone);
  append(form, 'whatsapp_display', contact.whatsappDisplay);
  append(form, 'whatsapp_dial_number', contact.whatsappDial);
  append(form, 'country', contact.country);
  append(form, 'hero_title', contact.heroTitle);
  append(form, 'hero_description', contact.heroText);
  append(form, 'support_note', contact.note);

  return form;
}

function createContentFormData(
  pageKey: AppContentPageKey,
  payload: SaveAdminAppContentPayload,
  spoofPut = false
): FormData {
  if (pageKey === 'contact_us') return createContactForm(payload, spoofPut);
  return createPrivacyOrTermsForm(pageKey, payload, spoofPut);
}

function createJsonPayload(pageKey: AppContentPageKey, payload: SaveAdminAppContentPayload) {
  if (pageKey === 'contact_us') {
    const contact = parseContactInfoFromBody(payload.body) ?? {};
    return {
      page_title: payload.title?.trim() || 'Contact Us',
      company_name: contact.company || '',
      website_url: contact.website || '',
      website_label: contact.websiteLabel || '',
      email: contact.email || '',
      phone: contact.phone || '',
      whatsapp_display: contact.whatsappDisplay || '',
      whatsapp_dial_number: contact.whatsappDial || '',
      country: contact.country || '',
      hero_title: contact.heroTitle || '',
      hero_description: contact.heroText || '',
      support_note: contact.note || '',
    };
  }

  const html = toHtmlParagraphs(payload.body);
  if (pageKey === 'terms_conditions') {
    return {
      page_title: payload.title?.trim() || 'Terms & Conditions',
      content_body: html,
      intro: html,
      sections: [
        {
          number: 1,
          title: payload.title?.trim() || 'Terms & Conditions',
          body: stripHtml(payload.body),
        },
      ],
    };
  }

  return {
    page_title: payload.title?.trim() || 'Privacy Policy',
    title: payload.title?.trim() || 'Privacy Policy',
    subtitle:
      payload.subtitle?.trim() ||
      'How Tandil collects, uses, and protects your information',
    locale: 'en',
    body: html,
    content_body: html,
  };
}

function extractErrorMessage(error: unknown): string {
  const ax = error as {
    message?: string;
    response?: {
      status?: number;
      data?: {
        message?: string;
        error?: string;
        errors?: Record<string, string[] | string>;
      };
    };
  };
  const data = ax?.response?.data;
  if (data?.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors)
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .find((v) => typeof v === 'string' && v.trim());
    if (first) return String(first);
  }
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (ax?.response?.status) return `Request failed (${ax.response.status}).`;
  return ax?.message || 'Failed to save content.';
}

function isSuccessfulSave(response: { status: number; data?: unknown }): boolean {
  if (response.status < 200 || response.status >= 300) return false;
  const body = asRecord(response.data) ?? {};
  if (body.success === false) return false;
  if (body.status === false || body.status === 0 || body.status === '0') return false;
  return true;
}

export function getAppContentSlug(
  audience: AppInfoAudience,
  pageKey: AppContentPageKey
): string {
  return APP_CONTENT_PAGE_SLUG[audience][pageKey];
}

export function getDefaultContactInfo(audience: AppInfoAudience): AppContactInfo {
  return audience === 'vendor' ? { ...DEFAULT_VENDOR_CONTACT } : { ...DEFAULT_CLIENT_CONTACT };
}

export function parseContactInfoFromBody(body: string | undefined | null): AppContactInfo | null {
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

export function serializeContactInfo(contact: AppContactInfo): string {
  return JSON.stringify(contact, null, 2);
}

export async function fetchAdminAppContentPage(
  audience: AppInfoAudience,
  pageKey: AppContentPageKey
): Promise<AdminAppContentPage | null> {
  const slug = getAppContentSlug(audience, pageKey);
  const path = `/admin/${audience}/${slug}`;
  try {
    const response = await apiClient.get(path, { timeout: 15000 });
    if (pageKey === 'contact_us') {
      const contact = extractContactInfo(response.data);
      if (!contact) return null;
      const nested = extractNestedData(response.data) ?? {};
      return {
        title: stringField(nested, 'page_title', 'title') || 'Contact Us',
        subtitle: stringField(nested, 'subtitle'),
        body: serializeContactInfo(contact),
        slug,
        audience,
        pageKey,
      };
    }
    const parsed = extractPrivacyOrTerms(response.data);
    if (!parsed) return null;
    return { ...parsed, slug, audience, pageKey };
  } catch {
    return null;
  }
}

export async function saveAdminAppContentPage(
  audience: AppInfoAudience,
  pageKey: AppContentPageKey,
  payload: SaveAdminAppContentPayload
): Promise<{ success: boolean; message?: string; data?: AdminAppContentPage | null }> {
  const slug = getAppContentSlug(audience, pageKey);
  const path = `/admin/${audience}/${slug}`;
  let lastError: unknown = null;

  const attempts: Array<() => Promise<{ status: number; data?: unknown }>> = [
    // Exact method shown in Postman.
    () =>
      apiClient.put(path, createContentFormData(pageKey, payload, false), {
        timeout: 20000,
        headers: { Accept: 'application/json' },
      }),
    // Laravel multipart fallback.
    () =>
      apiClient.post(path, createContentFormData(pageKey, payload, true), {
        timeout: 20000,
        headers: { Accept: 'application/json' },
      }),
    // JSON PUT with exact API field names
    () =>
      apiClient.put(path, createJsonPayload(pageKey, payload), {
        timeout: 20000,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      }),
  ];

  for (const attempt of attempts) {
    try {
      const response = await attempt();
      if (!isSuccessfulSave(response)) {
        lastError = { response: { status: response.status, data: response.data } };
        continue;
      }

      // Prefer returned payload; otherwise re-fetch admin page
      let parsed: AdminAppContentPage | null = null;
      if (pageKey === 'contact_us') {
        const contact = extractContactInfo(response.data);
        if (contact) {
          parsed = {
            title: payload.title,
            body: serializeContactInfo(contact),
            slug,
            audience,
            pageKey,
          };
        }
      } else {
        parsed = extractPrivacyOrTerms(response.data);
      }
      if (!parsed) {
        parsed = await fetchAdminAppContentPage(audience, pageKey);
      }

      return {
        success: true,
        message: (asRecord(response.data)?.message as string | undefined) || 'Content saved successfully.',
        data: parsed ? { ...parsed, slug, audience, pageKey } : null,
      };
    } catch (error) {
      lastError = error;
    }
  }

  return { success: false, message: extractErrorMessage(lastError) };
}
