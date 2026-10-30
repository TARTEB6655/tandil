import apiClient from './api';
import { buildFullImageUrl } from '../config/api';
import type {
  ContractorSignupRequest,
  ContractorSignupStatus,
  ContractorSignupStatusFilter,
} from '../types/contractorSignup';

export interface AdminRecentContractorRequestsResult {
  items: ContractorSignupRequest[];
  total_pending: number;
  has_more: boolean;
}

export interface AdminContractorSummary {
  pending: number;
  active: number;
  total: number;
}

export interface AdminContractorFilterCounts {
  pending: number;
  active: number;
  inactive: number;
  suspended: number;
  rejected: number;
  all: number;
}

export interface AdminContractorPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface AdminContractorListResult {
  items: ContractorSignupRequest[];
  summary: AdminContractorSummary;
  filters: AdminContractorFilterCounts;
  pagination: AdminContractorPagination;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
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

function normalizeStatus(raw: unknown): ContractorSignupStatus {
  const token = String(raw ?? 'pending')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (token === 'active' || token === 'approved') return 'active';
  if (token === 'rejected' || token === 'declined') return 'rejected';
  if (token === 'inactive' || token === 'disabled') return 'inactive';
  if (token === 'suspended') return 'suspended';
  return 'pending';
}

function flattenRegistrationPayload(input: Record<string, unknown>): Record<string, unknown> {
  const nested = asRecord(input.registration) ?? asRecord(input.application) ?? asRecord(input.data);
  let r: Record<string, unknown> = nested ? { ...nested, ...input } : { ...input };

  const personal = asRecord(r.personal);
  if (personal) {
    r = {
      ...r,
      name: firstNonEmpty(r.name, personal.full_name, personal.name),
      email: firstNonEmpty(r.email, personal.email),
      phone: firstNonEmpty(r.phone, personal.phone),
    };
  }

  const company = asRecord(r.company);
  if (company) {
    const tradeLicenseFile = asRecord(company.trade_license_file);
    r = {
      ...r,
      company_name: firstNonEmpty(r.company_name, company.company_name),
      trade_license_number: firstNonEmpty(
        r.trade_license_number,
        company.trade_license_number,
        company.trade_license
      ),
      trade_license_expiry_date: firstNonEmpty(
        r.trade_license_expiry_date,
        company.trade_license_expiry_date,
        company.expiry
      ),
      trn: firstNonEmpty(r.trn, company.trn),
      emirate: firstNonEmpty(r.emirate, company.emirate),
      company_emirate: firstNonEmpty(r.company_emirate, company.emirate),
      city: firstNonEmpty(r.city, company.city),
      company_address: firstNonEmpty(r.company_address, company.company_address, company.address),
      address: firstNonEmpty(r.address, company.address, company.company_address),
      trade_license_file_name: firstNonEmpty(
        r.trade_license_file_name,
        tradeLicenseFile?.name,
        tradeLicenseFile?.file_name,
        tradeLicenseFile?.original_name
      ),
      trade_license_file_url: firstNonEmpty(
        r.trade_license_file_url,
        tradeLicenseFile?.url,
        tradeLicenseFile?.file_url
      ),
    };
  }

  const bank = asRecord(r.bank);
  if (bank) {
    r = {
      ...r,
      bank_name: firstNonEmpty(r.bank_name, bank.bank_name),
      account_holder_name: firstNonEmpty(r.account_holder_name, bank.account_holder_name),
      bank_account_number: firstNonEmpty(r.bank_account_number, bank.bank_account_number),
      iban: firstNonEmpty(r.iban, bank.iban),
    };
  }

  const coverage = asRecord(r.coverage);
  if (coverage) {
    r = {
      ...r,
      main_service_categories:
        coverage.main_service_categories ?? r.main_service_categories ?? r.main_categories,
      service_subcategories: coverage.service_subcategories ?? r.service_subcategories,
      selected_services: coverage.selected_services ?? r.selected_services,
      emirates: coverage.emirates ?? r.emirates ?? r.coverage_emirates,
      cities: coverage.cities ?? r.cities ?? r.coverage_cities,
      service_coverage_areas:
        coverage.service_coverage_areas ?? r.service_coverage_areas ?? r.coverage_areas,
      main_service_category_labels: coverage.main_service_category_labels ?? r.main_service_category_labels,
      service_subcategory_labels: coverage.service_subcategory_labels ?? r.service_subcategory_labels,
      selected_service_labels: coverage.selected_service_labels ?? r.selected_service_labels,
      emirate_labels: coverage.emirate_labels ?? r.emirate_labels,
      city_labels: coverage.city_labels ?? r.city_labels,
      service_coverage_area_labels:
        coverage.service_coverage_area_labels ?? r.service_coverage_area_labels,
    };
  }

  return r;
}

function resolveFileUrl(raw: unknown): string | undefined {
  const s = firstNonEmpty(raw);
  if (!s) return undefined;
  return s.startsWith('http') ? s : buildFullImageUrl(s);
}

function fileFromDocuments(
  documents: unknown,
  type: string
): { name: string; url?: string } {
  if (!Array.isArray(documents)) return { name: '' };
  for (const entry of documents) {
    const row = asRecord(entry);
    if (!row || String(row.type ?? '').trim() !== type) continue;
    return {
      name: firstNonEmpty(row.original_name, row.file_name, row.name),
      url: resolveFileUrl(firstNonEmpty(row.file_url, row.url)),
    };
  }
  return { name: '' };
}

function fileNameFromDocuments(documents: unknown, type: string): string {
  return fileFromDocuments(documents, type).name;
}

function fileUrlFromDocuments(documents: unknown, type: string): string | undefined {
  return fileFromDocuments(documents, type).url;
}

function asSlugOrNameList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    if (typeof value === 'string' && value.trim()) {
      return value.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }
  return value
    .map((entry) => {
      if (typeof entry === 'number' && Number.isFinite(entry)) return String(entry);
      if (typeof entry === 'string') return entry.trim();
      const row = asRecord(entry);
      if (!row) return '';
      return firstNonEmpty(row.name, row.label, row.title, row.slug, row.id);
    })
    .filter(Boolean);
}

function labelListOrIds(
  labels: unknown,
  ids: unknown
): string[] {
  const fromLabels = asSlugOrNameList(labels);
  if (fromLabels.length) return fromLabels;
  return asSlugOrNameList(ids);
}

/** Map GET /admin/supervisor-registrations* row → dashboard UI model. */
export function mapContractorApiRow(input: Record<string, unknown>): ContractorSignupRequest {
  const r = flattenRegistrationPayload(input);
  const user = asRecord(r.user) ?? asRecord(r.supervisor);

  const status = normalizeStatus(
    r.status ?? r.registration_status ?? r.approval_status ?? r.account_status
  );

  return {
    id: String(r.id ?? r.registration_id ?? r.supervisor_registration_id ?? ''),
    name: firstNonEmpty(r.name, user?.name, r.full_name, r.contact_name),
    email: firstNonEmpty(r.email, user?.email),
    phone: firstNonEmpty(r.phone, user?.phone, r.mobile),
    password: '',
    password_confirmation: '',
    company_name: firstNonEmpty(r.company_name, r.business_name, r.organization_name),
    trade_license_number: firstNonEmpty(r.trade_license_number, r.trade_license_no),
    trade_license_expiry_date: firstNonEmpty(
      r.trade_license_expiry_date,
      r.trade_license_expiry,
      r.license_expiry_date
    ),
    trn: firstNonEmpty(r.trn, r.vat_number, r.tax_number) || undefined,
    company_emirate: firstNonEmpty(r.emirate, r.company_emirate, r.emirate_name),
    city: firstNonEmpty(r.city, r.company_city, r.city_name),
    company_address: firstNonEmpty(r.company_address, r.address),
    bank_name: firstNonEmpty(r.bank_name),
    account_holder_name: firstNonEmpty(r.account_holder_name),
    bank_account_number: firstNonEmpty(r.bank_account_number, r.account_number),
    iban: firstNonEmpty(r.iban),
    main_service_categories: labelListOrIds(
      r.main_service_category_labels ?? r.main_service_categories_labels,
      r.main_service_categories ?? r.main_categories ?? r.categories
    ),
    service_subcategories: labelListOrIds(
      r.service_subcategory_labels ?? r.service_subcategories_labels,
      r.service_subcategories ?? r.subcategories
    ),
    selected_services: labelListOrIds(
      r.selected_service_labels ?? r.selected_services_labels,
      r.selected_services ?? r.services
    ),
    coverage_emirates: labelListOrIds(
      r.emirate_labels ?? r.coverage_emirate_labels,
      r.emirates ?? r.coverage_emirates
    ),
    coverage_cities: labelListOrIds(r.city_labels ?? r.coverage_city_labels, r.cities ?? r.coverage_cities),
    service_coverage_areas: labelListOrIds(
      r.service_coverage_area_labels ?? r.coverage_area_labels,
      r.service_coverage_areas ?? r.coverage_areas
    ),
    trade_license_file_name:
      firstNonEmpty(r.trade_license_file_name, r.trade_license_upload) ||
      fileNameFromDocuments(r.documents, 'trade_license') ||
      undefined,
    vat_certificate_file_name:
      firstNonEmpty(r.vat_certificate_file_name, r.vat_certificate) ||
      fileNameFromDocuments(r.documents, 'vat_certificate') ||
      undefined,
    bank_confirmation_file_name:
      firstNonEmpty(r.bank_confirmation_file_name, r.bank_confirmation_letter) ||
      fileNameFromDocuments(r.documents, 'bank_confirmation_letter') ||
      undefined,
    trade_license_file_url:
      resolveFileUrl(r.trade_license_file_url) ||
      fileUrlFromDocuments(r.documents, 'trade_license'),
    vat_certificate_file_url:
      resolveFileUrl(r.vat_certificate_file_url) ||
      fileUrlFromDocuments(r.documents, 'vat_certificate'),
    bank_confirmation_file_url:
      resolveFileUrl(r.bank_confirmation_file_url) ||
      fileUrlFromDocuments(r.documents, 'bank_confirmation_letter'),
    status,
    status_label:
      r.status_label != null
        ? String(r.status_label)
        : status.charAt(0).toUpperCase() + status.slice(1),
    rejection_reason:
      r.rejection_reason != null
        ? String(r.rejection_reason)
        : r.reject_reason != null
          ? String(r.reject_reason)
          : null,
    missing_documents_reason:
      r.missing_documents_reason != null ? String(r.missing_documents_reason) : null,
    created_at: firstNonEmpty(r.created_at, r.submitted_at, r.registered_at) || new Date().toISOString(),
    updated_at: firstNonEmpty(r.updated_at) || undefined,
  };
}

function parseSummary(data: Record<string, unknown>): AdminContractorSummary {
  const s = asRecord(data.summary) ?? data;
  return {
    pending: Number(s.pending ?? 0),
    active: Number(s.active ?? 0),
    total: Number(s.total ?? 0),
  };
}

function parseFilters(data: Record<string, unknown>): AdminContractorFilterCounts {
  const f = asRecord(data.filters) ?? {};
  return {
    pending: Number(f.pending ?? 0),
    active: Number(f.active ?? 0),
    inactive: Number(f.inactive ?? 0),
    suspended: Number(f.suspended ?? 0),
    rejected: Number(f.rejected ?? 0),
    all: Number(f.all ?? 0),
  };
}

function parsePagination(
  data: Record<string, unknown>,
  fallback: { page: number; perPage: number; total: number }
): AdminContractorPagination {
  const p = asRecord(data.pagination) ?? data;
  const current = Number(p.current_page ?? fallback.page) || fallback.page;
  const perPage = Number(p.per_page ?? fallback.perPage) || fallback.perPage;
  const total = Number(p.total ?? fallback.total) || fallback.total;
  const lastPage = Number(p.last_page ?? Math.max(1, Math.ceil(total / perPage))) || 1;
  return { current_page: current, last_page: lastPage, per_page: perPage, total };
}

export function filterToApiStatus(filter: ContractorSignupStatusFilter): string | undefined {
  if (filter === 'all') return undefined;
  return filter;
}

export const adminContractorRegistrationService = {
  /** GET /admin/supervisor-registrations/recent?limit=5 — admin dashboard cards */
  async getRecentRequests(limit = 5): Promise<AdminRecentContractorRequestsResult> {
    const response = await apiClient.get<{
      success?: boolean;
      message?: string;
      data?: {
        items?: Record<string, unknown>[];
        total_pending?: number;
        has_more?: boolean;
      };
    }>('/admin/supervisor-registrations/recent', {
      params: { limit },
      timeout: 15000,
    });
    const data = (response.data?.data ?? {}) as Record<string, unknown>;
    const rows = Array.isArray(data.items) ? data.items : [];
    return {
      items: rows.map((row) => mapContractorApiRow(row)),
      total_pending: Number(data.total_pending ?? 0),
      has_more: Boolean(data.has_more),
    };
  },

  /**
   * GET /admin/supervisor-registrations?status=&per_page=&search=&page=
   * Contractor management list + summary + filter counts.
   */
  async getRegistrations(params: {
    status?: ContractorSignupStatusFilter;
    page?: number;
    per_page?: number;
    search?: string;
  }): Promise<AdminContractorListResult> {
    const page = params.page ?? 1;
    const perPage = params.per_page ?? 15;
    const apiStatus = params.status ? filterToApiStatus(params.status) : undefined;
    const response = await apiClient.get<{
      success?: boolean;
      message?: string;
      data?: Record<string, unknown>;
    }>('/admin/supervisor-registrations', {
      params: {
        page,
        per_page: perPage,
        ...(apiStatus ? { status: apiStatus } : {}),
        ...(params.search?.trim() ? { search: params.search.trim() } : {}),
      },
      timeout: 20000,
    });
    const body = response.data ?? {};
    if (body.success === false) {
      throw new Error(extractApiMessage(body, 'Failed to load contractor registrations.'));
    }
    const data = (body.data ?? {}) as Record<string, unknown>;
    const rows = Array.isArray(data.items) ? data.items : [];
    return {
      items: rows.map((row) => mapContractorApiRow(row as Record<string, unknown>)),
      summary: parseSummary(data),
      filters: parseFilters(data),
      pagination: parsePagination(data, { page, perPage, total: rows.length }),
    };
  },

  /** GET /admin/supervisor-registrations/:id */
  async getById(id: number | string): Promise<ContractorSignupRequest | null> {
    try {
      const response = await apiClient.get<{
        success?: boolean;
        data?: Record<string, unknown>;
      }>(`/admin/supervisor-registrations/${id}`, { timeout: 20000 });
      const body = response.data ?? {};
      const data = (body.data ?? body) as Record<string, unknown>;
      const row = asRecord(data.registration) ?? asRecord(data.item) ?? data;
      if (!row?.id && !row?.company_name && !row?.email) return null;
      return mapContractorApiRow(row);
    } catch {
      return null;
    }
  },

  /** POST /admin/supervisor-registrations/:id/approve — no body required */
  async approve(id: number | string): Promise<{ success: boolean; message?: string }> {
    const response = await apiClient.post<{ success?: boolean; message?: string }>(
      `/admin/supervisor-registrations/${id}/approve`,
      {},
      {
        timeout: 30000,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      }
    );
    const body = response.data ?? {};
    if (body.success === false) {
      throw new Error(extractApiMessage(body, 'Could not approve contractor.'));
    }
    return { success: body.success !== false, message: body.message };
  },

  /** POST /admin/supervisor-registrations/:id/reject — JSON { reason } */
  async reject(
    id: number | string,
    reason: string
  ): Promise<{ success: boolean; message?: string }> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new Error('Rejection reason is required.');
    }
    const response = await apiClient.post<{ success?: boolean; message?: string }>(
      `/admin/supervisor-registrations/${id}/reject`,
      { reason: trimmedReason },
      {
        timeout: 30000,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      }
    );
    const body = response.data ?? {};
    if (body.success === false) {
      throw new Error(extractApiMessage(body, 'Could not reject application.'));
    }
    return { success: body.success !== false, message: body.message };
  },

  /** POST /admin/supervisor-registrations/:id/account-status/suspend — no body */
  async suspend(id: number | string): Promise<void> {
    const registrationId = String(id ?? '').trim();
    if (!registrationId) {
      throw new Error('Contractor registration ID is missing.');
    }
    const response = await apiClient.post<{ success?: boolean; message?: string }>(
      `/admin/supervisor-registrations/${encodeURIComponent(registrationId)}/account-status/suspend`,
      {},
      {
        timeout: 30000,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      }
    );
    const body = response.data ?? {};
    if (body.success === false) {
      throw new Error(extractApiMessage(body, 'Could not suspend contractor.'));
    }
  },

  /** POST /admin/supervisor-registrations/:id/account-status/activate — no body */
  async activate(id: number | string): Promise<void> {
    const registrationId = String(id ?? '').trim();
    if (!registrationId) {
      throw new Error('Contractor registration ID is missing.');
    }
    const response = await apiClient.post<{ success?: boolean; message?: string }>(
      `/admin/supervisor-registrations/${encodeURIComponent(registrationId)}/account-status/activate`,
      {},
      {
        timeout: 30000,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      }
    );
    const body = response.data ?? {};
    if (body.success === false) {
      throw new Error(extractApiMessage(body, 'Could not activate contractor.'));
    }
  },

  /** POST /admin/supervisor-registrations/:id/deactivate */
  async deactivate(id: number | string): Promise<void> {
    const response = await apiClient.post<{ success?: boolean; message?: string }>(
      `/admin/supervisor-registrations/${id}/deactivate`,
      {},
      { timeout: 30000 }
    );
    if (response.data?.success === false) {
      throw new Error(extractApiMessage(response.data, 'Could not deactivate contractor.'));
    }
  },

  /** DELETE /admin/supervisor-registrations/:id — no body or query params */
  async remove(id: number | string): Promise<{ success: boolean; message?: string }> {
    const registrationId = String(id ?? '').trim();
    if (!registrationId) {
      throw new Error('Contractor registration ID is missing.');
    }
    try {
      const response = await apiClient.delete<{ success?: boolean; message?: string }>(
        `/admin/supervisor-registrations/${encodeURIComponent(registrationId)}`,
        {
          timeout: 30000,
          headers: { Accept: 'application/json' },
        }
      );
      const body = response.data ?? {};
      if (body.success === false) {
        throw new Error(extractApiMessage(body, 'Could not delete contractor.'));
      }
      return { success: body.success !== false, message: body.message };
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } }).response?.data;
      if (data) {
        throw new Error(extractApiMessage(data, 'Could not delete contractor.'));
      }
      if (err instanceof Error) throw err;
      throw new Error('Could not delete contractor.');
    }
  },

  /** Alias for delete contractor registration (Postman: 8. Delete contractor). */
  async deleteContractor(id: number | string): Promise<{ success: boolean; message?: string }> {
    return this.remove(id);
  },

  getErrorMessage(err: unknown, fallback: string): string {
    const ax = err as { response?: { data?: unknown }; message?: string };
    if (ax.response?.data) {
      return extractApiMessage(ax.response.data, ax.message || fallback);
    }
    if (err instanceof Error && err.message.trim()) return err.message.trim();
    return fallback;
  },
};
