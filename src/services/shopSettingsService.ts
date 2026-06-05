import apiClient from './api';
import { publicApiClient } from './api';

export interface ShopSettings {
  shipping_amount: number;
  tax_percent: number;
  currency: string;
}

const DEFAULTS: ShopSettings = {
  shipping_amount: 0,
  tax_percent: 5,
  currency: 'AED',
};

function parseSettings(raw: any): ShopSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const shipping = raw.shipping_amount;
  const tax = raw.tax_percent;
  const currency = raw.currency;
  return {
    shipping_amount: Number(shipping) === Number(shipping) ? Number(shipping) : DEFAULTS.shipping_amount,
    tax_percent: Number(tax) === Number(tax) ? Number(tax) : DEFAULTS.tax_percent,
    currency: typeof currency === 'string' && currency.trim() ? currency.trim() : DEFAULTS.currency,
  };
}

/**
 * Get shop settings for customer (order summary). Tries multiple endpoints so admin-updated tax/shipping show correctly.
 */
export async function getShopSettings(): Promise<ShopSettings> {
  const tryResponse = (res: any): ShopSettings | null => {
    const data = res?.data;
    const payload = data?.data ?? data;
    return parseSettings(payload);
  };

  try {
    const res = await publicApiClient.get('/settings/shop', { timeout: 20000 });
    const parsed = tryResponse(res);
    if (parsed) return parsed;
  } catch (_) {
    // ignore
  }
  try {
    const res = await apiClient.get('/settings/shop', { timeout: 20000 });
    const parsed = tryResponse(res);
    if (parsed) return parsed;
  } catch (_) {
    // ignore
  }
  try {
    const res = await apiClient.get('/admin/settings/shop', { timeout: 20000 });
    const parsed = tryResponse(res);
    if (parsed) return parsed;
  } catch (_) {
    // ignore
  }
  try {
    const res = await publicApiClient.get('/shop/settings', { timeout: 20000 });
    const parsed = tryResponse(res);
    if (parsed) return parsed;
  } catch (_) {
    // ignore
  }
  return { ...DEFAULTS };
}
