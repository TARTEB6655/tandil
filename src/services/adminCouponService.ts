import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './api';
import { DUMMY_COUPONS } from '../config/dummyCoupons';
import type { Coupon } from '../types/coupon';
import type {
  AdminCoupon,
  AdminCouponPayload,
  AdminCouponsListMeta,
} from '../types/adminCoupon';
import { extractCouponFieldErrors } from '../utils/couponApiErrors';
import { normalizePositiveIds } from '../utils/couponRelationIds';
import { setCustomerCouponCatalog } from './customerCouponCatalog';
import {
  normalizeAdminCoupon,
  adminCouponToCustomerCoupon,
} from '../utils/couponMapping';

export { normalizeAdminCoupon, adminCouponToCustomerCoupon } from '../utils/couponMapping';

const STORAGE_KEY = 'tandil_admin_coupons_v2';

function parseListBody(body: any): AdminCoupon[] {
  const raw = body?.data;
  if (Array.isArray(raw)) return raw.map(normalizeAdminCoupon);
  if (raw && Array.isArray(raw.data)) return raw.data.map(normalizeAdminCoupon);
  return [];
}

/** Offline or route not implemented — use local demo storage. */
function shouldUseLocalFallback(err: unknown): boolean {
  const status = (err as any)?.response?.status;
  if (!status) return true;
  return status === 404 || status === 501;
}

/** DELETE/PUT failures should not fall back to local when the resource is missing or forbidden. */
function shouldUseLocalFallbackForMutation(err: unknown): boolean {
  const status = (err as any)?.response?.status;
  if (!status) return true;
  return status === 501;
}

/** Laravel admin coupons expect multipart form-data (see Postman PUT). */
function buildCouponFormData(payload: AdminCouponPayload): FormData {
  const formData = new FormData();
  formData.append('code', payload.code.trim().toUpperCase());
  formData.append('title', payload.title.trim());
  if (payload.description != null && String(payload.description).trim()) {
    formData.append('description', String(payload.description).trim());
  }
  formData.append('discount_type', payload.discount_type);
  formData.append('discount_value', String(payload.discount_value ?? 0));
  formData.append('min_order_amount', String(payload.min_order_amount ?? 0));
  if (payload.max_discount_amount != null) {
    formData.append('max_discount_amount', String(payload.max_discount_amount));
  }
  if (payload.starts_at) {
    formData.append('starts_at', String(payload.starts_at).slice(0, 10));
  }
  if (payload.ends_at) {
    formData.append('ends_at', String(payload.ends_at).slice(0, 10));
  }
  if (payload.usage_limit != null) {
    formData.append('usage_limit', String(payload.usage_limit));
  }
  if (payload.usage_limit_per_user != null) {
    formData.append('usage_limit_per_user', String(payload.usage_limit_per_user));
  }
  formData.append('is_active', payload.is_active ? '1' : '0');
  formData.append('applies_to', payload.applies_to);
  formData.append('catalog_scope', payload.catalog_scope);
  (payload.category_ids ?? []).forEach((id) => {
    formData.append('category_ids[]', String(id));
  });
  if (payload.applies_to === 'services') {
    normalizePositiveIds(payload.service_ids ?? []).forEach((id) => {
      formData.append('service_ids[]', String(id));
    });
  }
  return formData;
}

function throwCouponApiError(body: {
  message?: string;
  errors?: unknown;
}): never {
  const fieldErrors = extractCouponFieldErrors(body?.errors);
  const firstField = Object.values(fieldErrors).find(Boolean);
  const message = firstField || body?.message || 'Request failed.';
  const err = new Error(message);
  (err as any).response = { data: body };
  (err as any).fieldErrors = fieldErrors;
  throw err;
}

function parseCouponMutationResponse(response: any): AdminCoupon {
  const body = response?.data ?? response;
  if (body?.success === false) {
    throwCouponApiError(body);
  }
  const raw = body?.data ?? body;
  if (raw && typeof raw === 'object' && raw.code) {
    return normalizeAdminCoupon(raw);
  }
  throwCouponApiError(
    typeof body === 'object' && body ? body : { message: 'Unexpected response from server.' }
  );
}

/** Re-throw axios errors with parsed Laravel field errors (e.g. 422 duplicate code). */
export function enrichCouponAxiosError(err: unknown): never {
  const ax = err as { response?: { data?: { message?: string; errors?: unknown } }; message?: string };
  const data = ax?.response?.data;
  if (data) {
    throwCouponApiError(data);
  }
  throw err;
}

function seedLocalCoupons(): AdminCoupon[] {
  return DUMMY_COUPONS.map((c) =>
    normalizeAdminCoupon({
      ...c,
      starts_at: c.start_date,
      ends_at: c.end_date,
    })
  );
}

async function loadLocalCoupons(): Promise<AdminCoupon[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeAdminCoupon);
      }
    }
  } catch {
    /* use seed */
  }
  const seed = seedLocalCoupons();
  await saveLocalCoupons(seed);
  return seed;
}

async function saveLocalCoupons(list: AdminCoupon[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function nextLocalId(list: AdminCoupon[]): string {
  const nums = list
    .map((c) => parseInt(String(c.id), 10))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return String(max + 1);
}

function setCustomerCatalogFromCoupons(list: AdminCoupon[]): void {
  setCustomerCouponCatalog(list.map(adminCouponToCustomerCoupon));
}

export const adminCouponService = {
  /**
   * GET /admin/coupons — Bearer admin token.
   * Response: { success, message, data: AdminCoupon[], meta }
   */
  listCoupons: async (params?: {
    page?: number;
    per_page?: number;
    search?: string;
  }): Promise<{
    data: AdminCoupon[];
    source: 'api' | 'local';
    message?: string;
    meta?: AdminCouponsListMeta;
  }> => {
    try {
      const response = await apiClient.get('/admin/coupons', {
        params: {
          per_page: 50,
          page: 1,
          ...params,
        },
        timeout: 15000,
      });
      const body = response?.data ?? response;

      if (body?.success === false) {
        throwCouponApiError(body);
      }

      const list = parseListBody(body);
      setCustomerCatalogFromCoupons(list);

      return {
        data: list,
        source: 'api',
        message: body?.message,
        meta: body?.meta,
      };
    } catch (err) {
      if (!shouldUseLocalFallback(err)) {
        throw err;
      }
    }

    let local = await loadLocalCoupons();
    const q = params?.search?.trim().toUpperCase();
    if (q) {
      local = local.filter(
        (c) =>
          c.code.toUpperCase().includes(q) || c.title.toUpperCase().includes(q)
      );
    }
    setCustomerCatalogFromCoupons(local);
    return { data: local, source: 'local', message: 'Offline — showing saved coupons.' };
  },

  /**
   * GET /admin/coupons/:id — Bearer admin token.
   * Response: { success, message, data: AdminCoupon }
   */
  getCouponById: async (
    id: number | string
  ): Promise<{ coupon: AdminCoupon; message?: string }> => {
    const couponId = encodeURIComponent(String(id));
    try {
      const response = await apiClient.get(`/admin/coupons/${couponId}`, {
        timeout: 15000,
        headers: { Accept: 'application/json' },
      });
      const body = response?.data ?? {};

      if (body?.success === false) {
        const err = new Error(body?.message || 'Failed to load coupon.');
        (err as any).response = { data: body };
        throw err;
      }

      const raw = body?.data;
      if (raw && typeof raw === 'object' && raw.code) {
        return {
          coupon: normalizeAdminCoupon(raw),
          message: body?.message,
        };
      }

      const err = new Error('Coupon not found.');
      (err as any).response = { data: body };
      throw err;
    } catch (err) {
      if (!shouldUseLocalFallback(err)) {
        throw err;
      }
    }

    const local = await loadLocalCoupons();
    const found = local.find((c) => String(c.id) === String(id));
    if (!found) {
      throw new Error('Coupon not found.');
    }
    return { coupon: found, message: 'Loaded from device storage.' };
  },

  /**
   * POST /admin/coupons — multipart form-data (Bearer admin token).
   */
  createCoupon: async (
    payload: AdminCouponPayload
  ): Promise<{ data: AdminCoupon; source: 'api' | 'local'; message?: string }> => {
    const body: AdminCouponPayload = {
      ...payload,
      code: payload.code.trim().toUpperCase(),
    };
    const formData = buildCouponFormData(body);

    try {
      const response = await apiClient.post('/admin/coupons', formData, {
        timeout: 60000,
        headers: { Accept: 'application/json' },
      });
      const created = parseCouponMutationResponse(response);
      try {
        await adminCouponService.listCoupons({ per_page: 50, page: 1 });
      } catch {
        /* catalog refresh best-effort */
      }
      const resBody = response?.data ?? {};
      return {
        data: created,
        source: 'api',
        message: resBody?.message || 'Coupon created.',
      };
    } catch (err: unknown) {
      if (!shouldUseLocalFallbackForMutation(err)) {
        enrichCouponAxiosError(err);
      }
    }

    const local = await loadLocalCoupons();
    const duplicate = local.some(
      (c) => c.code.toUpperCase() === body.code.toUpperCase()
    );
    if (duplicate) {
      const e = new Error('The code has already been taken.');
      (e as any).response = {
        data: {
          message: 'Validation failed.',
          errors: { code: ['The code has already been taken.'] },
        },
      };
      (e as any).fieldErrors = { code: 'The code has already been taken.' };
      throw e;
    }
    const created = normalizeAdminCoupon({ ...body, id: nextLocalId(local) });
    await saveLocalCoupons([created, ...local]);
    setCustomerCatalogFromCoupons([created, ...local]);
    return {
      data: created,
      source: 'local',
      message: 'Saved on device (API not available).',
    };
  },

  /**
   * PUT /admin/coupons/:id — multipart form-data (Bearer admin token).
   */
  updateCoupon: async (
    id: number | string,
    payload: AdminCouponPayload
  ): Promise<{ data: AdminCoupon; source: 'api' | 'local'; message?: string }> => {
    const body: AdminCouponPayload = {
      ...payload,
      code: payload.code.trim().toUpperCase(),
    };
    const couponId = encodeURIComponent(String(id));
    const formData = buildCouponFormData(body);

    try {
      const response = await apiClient.put(`/admin/coupons/${couponId}`, formData, {
        timeout: 60000,
        headers: { Accept: 'application/json' },
      });
      const updated = parseCouponMutationResponse(response);
      try {
        await adminCouponService.listCoupons({ per_page: 50, page: 1 });
      } catch {
        /* catalog refresh best-effort */
      }
      const resBody = response?.data ?? {};
      return {
        data: updated,
        source: 'api',
        message: resBody?.message || 'Coupon updated.',
      };
    } catch (err: unknown) {
      if (!shouldUseLocalFallbackForMutation(err)) {
        enrichCouponAxiosError(err);
      }
    }
    const local = await loadLocalCoupons();
    const idx = local.findIndex((c) => String(c.id) === String(id));
    if (idx < 0) {
      throw new Error('Coupon not found.');
    }
    const duplicate = local.some(
      (c, i) => i !== idx && c.code.toUpperCase() === body.code.toUpperCase()
    );
    if (duplicate) {
      const e = new Error('The code has already been taken.');
      (e as any).response = {
        data: {
          message: 'Validation failed.',
          errors: { code: ['The code has already been taken.'] },
        },
      };
      (e as any).fieldErrors = { code: 'The code has already been taken.' };
      throw e;
    }
    const updated = normalizeAdminCoupon({ ...local[idx], ...body, id });
    const next = [...local];
    next[idx] = updated;
    await saveLocalCoupons(next);
    setCustomerCatalogFromCoupons(next);
    return {
      data: updated,
      source: 'local',
      message: 'Updated on device (API not available).',
    };
  },

  /**
   * DELETE /admin/coupons/:id — Bearer admin token.
   * Response: { success, message }
   */
  deleteCoupon: async (
    id: number | string
  ): Promise<{ success: boolean; source: 'api' | 'local'; message?: string }> => {
    const couponId = encodeURIComponent(String(id));
    try {
      const response = await apiClient.delete(`/admin/coupons/${couponId}`, {
        timeout: 15000,
        headers: { Accept: 'application/json' },
      });
      const body = response?.data ?? {};

      if (body?.success === false) {
        const err = new Error(body?.message || 'Failed to delete coupon.');
        (err as any).response = { data: body };
        throw err;
      }

      try {
        await adminCouponService.listCoupons({ per_page: 50, page: 1 });
      } catch {
        /* refresh catalog best-effort */
      }

      return {
        success: body?.success !== false,
        source: 'api',
        message: body?.message || 'Coupon deleted.',
      };
    } catch (err: unknown) {
      if (!shouldUseLocalFallbackForMutation(err)) {
        throw err;
      }
    }

    const local = await loadLocalCoupons();
    const next = local.filter((c) => String(c.id) !== String(id));
    if (next.length === local.length) {
      throw new Error('Coupon not found.');
    }
    await saveLocalCoupons(next);
    setCustomerCatalogFromCoupons(next);
    return { success: true, source: 'local', message: 'Deleted on device.' };
  },
};
