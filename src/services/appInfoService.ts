/**
 * App info / legal pages for the client app.
 * Tries public API first; callers fall back to i18n when unavailable.
 */
import { publicApiClient } from './api';
import { APP_INFO_PAGE_SLUG, AppInfoPageKey } from '../types/appInfo';

export interface AppInfoPageContent {
  title?: string;
  body: string;
}

function extractBody(data: unknown): AppInfoPageContent | null {
  if (!data || typeof data !== 'object') return null;
  const root = data as Record<string, unknown>;
  const nested = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root;
  const title =
    (typeof nested.title === 'string' && nested.title) ||
    (typeof nested.name === 'string' && nested.name) ||
    undefined;
  const body =
    (typeof nested.content === 'string' && nested.content) ||
    (typeof nested.body === 'string' && nested.body) ||
    (typeof nested.description === 'string' && nested.description) ||
    (typeof nested.html === 'string' && nested.html) ||
    '';
  if (!body.trim()) return null;
  return { title, body: body.trim() };
}

/**
 * GET /shop/pages/:slug (public). Returns null if endpoint missing or empty.
 */
export async function fetchAppInfoPage(key: AppInfoPageKey): Promise<AppInfoPageContent | null> {
  const slug = APP_INFO_PAGE_SLUG[key];
  const paths = [`/shop/pages/${slug}`, `/client/pages/${slug}`, `/pages/${slug}`];
  for (const path of paths) {
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
