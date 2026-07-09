import apiClient from './api';
import { flattenVendorPayload, mapVendorApiRow } from './vendorSignupRequestService';
import type { VendorSignupRequest, VendorSignupStatusFilter } from '../types/vendorSignup';

export interface AdminVendorStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  suspended: number;
  under_review: number;
  disabled: number;
}

export interface AdminVendorPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface AdminVendorListResult {
  items: VendorSignupRequest[];
  pagination: AdminVendorPagination;
}

export interface AdminRecentVendorRequestsResult {
  items: VendorSignupRequest[];
  total_pending: number;
  has_more: boolean;
}

function extractApiMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const root = body as Record<string, unknown>;
  if (typeof root.message === 'string' && root.message.trim()) {
    return root.message.trim();
  }
  const errors = root.errors;
  if (errors && typeof errors === 'object') {
    for (const value of Object.values(errors as Record<string, unknown>)) {
      if (Array.isArray(value) && value[0] != null) return String(value[0]);
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  return fallback;
}

export function resolveVendorId(item: Pick<VendorSignupRequest, 'id' | 'vendor_id'>): number | string {
  return item.vendor_id ?? item.id;
}

function parsePagination(
  data: Record<string, unknown>,
  fallback: { page: number; perPage: number; total: number }
): AdminVendorPagination {
  const meta = (data.pagination ?? data.meta ?? data) as Record<string, unknown>;
  const current = Number(meta.current_page ?? fallback.page) || fallback.page;
  const perPage = Number(meta.per_page ?? fallback.perPage) || fallback.perPage;
  const total = Number(meta.total ?? fallback.total) || fallback.total;
  const lastPage = Number(meta.last_page ?? Math.max(1, Math.ceil(total / perPage))) || 1;
  return {
    current_page: current,
    last_page: lastPage,
    per_page: perPage,
    total,
  };
}

export function filterToApiStatus(filter: VendorSignupStatusFilter): string | undefined {
  if (filter === 'pending') return 'pending,under_review';
  if (filter === 'approved') return 'approved';
  if (filter === 'rejected') return 'rejected';
  return undefined;
}

export function statsToUiCounts(stats: AdminVendorStats) {
  return {
    pending: (stats.pending ?? 0) + (stats.under_review ?? 0),
    approved: stats.approved ?? 0,
    rejected: stats.rejected ?? 0,
    total: stats.total ?? 0,
  };
}

/** Flatten nested application-detail payload before mapping to UI model. */
export function flattenApplicationDetail(data: Record<string, unknown>): Record<string, unknown> {
  return flattenVendorPayload(data);
}

export function mapApplicationDetail(data: Record<string, unknown>): VendorSignupRequest {
  return mapVendorApiRow(data);
}

function mergeOptional<T>(primary: T | undefined | null, fallback: T | undefined | null): T | undefined {
  if (primary != null && primary !== '') return primary;
  if (fallback != null && fallback !== '') return fallback;
  return undefined;
}

export function mergeVendorPreview(
  detail: VendorSignupRequest,
  preview?: VendorSignupRequest | null
): VendorSignupRequest {
  if (!preview) return detail;
  const mergedStatus =
    preview.status === 'approved' || preview.status === 'rejected'
      ? preview.status
      : detail.status;
  const mergedStatusLabel =
    preview.status === 'approved' || preview.status === 'rejected'
      ? preview.status_label
      : detail.status_label;
  return {
    ...detail,
    logo_url: mergeOptional(detail.logo_url, preview.logo_url),
    company_name: detail.company_name || preview.company_name,
    authorized_person_name: detail.authorized_person_name || preview.authorized_person_name,
    email: detail.email || preview.email,
    phone: detail.phone || preview.phone,
    vendor_type: detail.vendor_type || preview.vendor_type,
    vendor_type_label: mergeOptional(detail.vendor_type_label, preview.vendor_type_label),
    emirate: detail.emirate || preview.emirate,
    city: mergeOptional(detail.city, preview.city),
    address: mergeOptional(detail.address, preview.address),
    trade_license_number: mergeOptional(detail.trade_license_number, preview.trade_license_number),
    vat_number: mergeOptional(detail.vat_number, preview.vat_number),
    bank_name: mergeOptional(detail.bank_name, preview.bank_name),
    iban: mergeOptional(detail.iban, preview.iban),
    account_holder_name: mergeOptional(detail.account_holder_name, preview.account_holder_name),
    delivery_radius_km: detail.delivery_radius_km ?? preview.delivery_radius_km,
    minimum_order_amount: detail.minimum_order_amount ?? preview.minimum_order_amount,
    opens_at: mergeOptional(detail.opens_at, preview.opens_at),
    closes_at: mergeOptional(detail.closes_at, preview.closes_at),
    operating_hours: mergeOptional(detail.operating_hours, preview.operating_hours),
    google_maps_location: mergeOptional(detail.google_maps_location, preview.google_maps_location),
    trade_license_url: mergeOptional(detail.trade_license_url, preview.trade_license_url),
    emirates_id_url: mergeOptional(detail.emirates_id_url, preview.emirates_id_url),
    description: mergeOptional(detail.description, preview.description),
    categories: detail.categories ?? preview.categories,
    completion_percent: detail.completion_percent ?? preview.completion_percent,
    submitted_at_formatted: mergeOptional(detail.submitted_at_formatted, preview.submitted_at_formatted),
    status: mergedStatus,
    status_label: mergeOptional(mergedStatusLabel, detail.status_label),
  };
}

export const adminVendorService = {
  /** GET /admin/vendors/recent-requests?limit=3 — dashboard cards */
  async getRecentRequests(limit = 3): Promise<AdminRecentVendorRequestsResult> {
    const response = await apiClient.get<{
      success?: boolean;
      message?: string;
      data?: {
        items?: Record<string, unknown>[];
        total_pending?: number;
        has_more?: boolean;
      };
    }>('/admin/vendors/recent-requests', {
      params: { limit },
      timeout: 15000,
    });
    const data = (response.data?.data ?? {}) as Record<string, unknown>;
    const rows = Array.isArray(data.items) ? data.items : [];
    return {
      items: rows.map((row) => mapVendorApiRow(row)),
      total_pending: Number(data.total_pending ?? 0),
      has_more: Boolean(data.has_more),
    };
  },

  /** GET /admin/vendors/stats — view-all summary row */
  async getStats(): Promise<AdminVendorStats> {
    const response = await apiClient.get<{
      success?: boolean;
      message?: string;
      data?: Partial<AdminVendorStats>;
    }>('/admin/vendors/stats', { timeout: 15000 });
    const data = response.data?.data ?? {};
    return {
      total: Number(data.total ?? 0),
      pending: Number(data.pending ?? 0),
      approved: Number(data.approved ?? 0),
      rejected: Number(data.rejected ?? 0),
      suspended: Number(data.suspended ?? 0),
      under_review: Number(data.under_review ?? 0),
      disabled: Number(data.disabled ?? 0),
    };
  },

  /** GET /admin/vendors — paginated list (view all) */
  async getVendors(params: {
    status?: string;
    page?: number;
    per_page?: number;
    sort?: string;
  }): Promise<AdminVendorListResult> {
    const page = params.page ?? 1;
    const perPage = params.per_page ?? 10;
    const response = await apiClient.get<{
      success?: boolean;
      message?: string;
      data?: Record<string, unknown>;
    }>('/admin/vendors', {
      params: {
        status: params.status,
        page,
        per_page: perPage,
        sort: params.sort ?? 'newest',
      },
      timeout: 15000,
    });
    const data = (response.data?.data ?? {}) as Record<string, unknown>;
    const rows = Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.data)
        ? data.data
        : [];
    const items = (rows as Record<string, unknown>[]).map((row) => mapVendorApiRow(row));
    return {
      items,
      pagination: parsePagination(data, { page, perPage, total: items.length }),
    };
  },

  /** GET /admin/vendors/:id/application-detail */
  async getApplicationDetail(id: number | string): Promise<VendorSignupRequest> {
    try {
      const response = await apiClient.get<{
        success?: boolean;
        message?: string;
        data?: Record<string, unknown>;
      }>(`/admin/vendors/${id}/application-detail`, { timeout: 15000 });
      const body = response.data ?? {};
      if (body.success === false) {
        throw new Error(extractApiMessage(body, 'Could not load vendor application details.'));
      }
      const data = body.data;
      if (!data || typeof data !== 'object') {
        throw new Error('Vendor application details not found.');
      }
      return mapApplicationDetail(data);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } }).response?.data;
      if (data) {
        throw new Error(extractApiMessage(data, 'Could not load vendor application details.'));
      }
      if (err instanceof Error) throw err;
      throw new Error('Could not load vendor application details.');
    }
  },

  /** POST /admin/vendors/:id/approve */
  async approve(id: number | string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.post<{ success?: boolean; message?: string }>(
        `/admin/vendors/${id}/approve`,
        {},
        { timeout: 15000 }
      );
      const body = response.data ?? {};
      if (body.success === false) {
        throw new Error(extractApiMessage(body, 'Could not approve vendor.'));
      }
      return { success: true, message: body.message };
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } }).response?.data;
      if (data) {
        throw new Error(extractApiMessage(data, 'Could not approve vendor.'));
      }
      if (err instanceof Error) throw err;
      throw new Error('Could not approve vendor.');
    }
  },

  /** POST /admin/vendors/:id/reject */
  async reject(
    id: number | string,
    reason?: string
  ): Promise<{ success: boolean; message?: string }> {
    const trimmedReason = reason?.trim();
    const payload = trimmedReason
      ? { reason: trimmedReason, rejection_reason: trimmedReason }
      : {};
    try {
      const response = await apiClient.post<{ success?: boolean; message?: string }>(
        `/admin/vendors/${id}/reject`,
        payload,
        { timeout: 15000 }
      );
      const body = response.data ?? {};
      if (body.success === false) {
        throw new Error(extractApiMessage(body, 'Could not reject application.'));
      }
      return { success: true, message: body.message };
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } }).response?.data;
      if (data) {
        throw new Error(extractApiMessage(data, 'Could not reject application.'));
      }
      if (err instanceof Error) throw err;
      throw new Error('Could not reject application.');
    }
  },

  /** DELETE /admin/vendors/:id */
  async remove(id: number | string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.delete<{ success?: boolean; message?: string }>(
        `/admin/vendors/${id}`,
        { timeout: 15000 }
      );
      const body = response.data ?? {};
      if (body.success === false) {
        throw new Error(extractApiMessage(body, 'Could not delete vendor.'));
      }
      return { success: true, message: body.message };
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } }).response?.data;
      if (data) {
        throw new Error(extractApiMessage(data, 'Could not delete vendor.'));
      }
      if (err instanceof Error) throw err;
      throw new Error('Could not delete vendor.');
    }
  },
};
