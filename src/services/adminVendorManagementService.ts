import apiClient from './api';
import { buildFullImageUrl } from '../config/api';
import {
  buildVendorProductFormData,
  extractProductCategoryIdFromPayload,
  extractProductDescriptionFromPayload,
  extractProductServiceIdFromPayload,
  extractScalarFromPayload,
  parseVendorPlatformCategoryOptions,
  parseVendorProductDetail,
  resolveVendorProductCategoryFromRow,
  resolveVendorProductServiceFromRow,
  type CreateVendorProductParams,
  type VendorProductCategoryOption,
  type VendorProductDetail,
} from './vendorService';
import { shopService } from './shopService';

export interface AdminManagedVendor {
  id: string;
  vendor_id?: string;
  business_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  logo_url?: string;
  status?: string;
  status_label?: string;
  products_count: number;
  active_products: number;
  revenue: number;
  revenue_formatted?: string;
  currency: string;
  orders_count?: number;
}

export type AdminVendorFormStatus = 'approved' | 'under_review' | 'pending';
/** @deprecated Use AdminVendorFormStatus */
export type AdminVendorCreateStatus = AdminVendorFormStatus;

export type AdminVendorUploadFile = {
  uri: string;
  name: string;
  mimeType: string;
};

/** Shared fields for create/update vendor multipart form-data. */
export type AdminVendorFormPayload = {
  company_name: string;
  authorized_person_name: string;
  email: string;
  phone: string;
  trade_license_number: string;
  address: string;
  logo?: AdminVendorUploadFile | null;
  vat_number?: string;
  vendor_types: string[];
  emirate: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  map_address?: string;
  bank_name?: string;
  iban: string;
  account_holder_name: string;
  delivery_radius_km: number;
  opens_at: string;
  closes_at: string;
  minimum_order_amount: number;
  terms_accepted?: boolean;
  /** Optional: approved (default), under_review, pending */
  status?: AdminVendorFormStatus;
};

/** Payload for POST /admin/vendors (multipart form-data). */
export type AdminCreateVendorPayload = AdminVendorFormPayload & {
  trade_license: AdminVendorUploadFile;
  emirates_id: AdminVendorUploadFile;
  password: string;
  password_confirmation: string;
};

/** Payload for POST /admin/vendors/:id (multipart). Files/password optional if unchanged. */
export type AdminUpdateVendorPayload = AdminVendorFormPayload & {
  trade_license?: AdminVendorUploadFile | null;
  emirates_id?: AdminVendorUploadFile | null;
  password?: string;
  password_confirmation?: string;
};

export interface AdminManagedVendorProduct {
  id: string;
  vendor_product_id?: string;
  product_id?: string;
  name: string;
  image_url?: string;
  price: number;
  price_formatted?: string;
  currency: string;
  stock: number;
  is_available: boolean;
  status?: string;
  status_label?: string;
  display_status?: string;
  display_status_label?: string;
  approval_status?: string;
  disabled_by_admin?: boolean;
  can_toggle: boolean;
  toggle_endpoint?: string;
  can_delete?: boolean;
  delete_endpoint?: string;
  revenue?: number;
  /** When present on management list rows — used to pre-fill edit form. */
  category_id?: number;
  category_name?: string;
  service_id?: number;
  service_name?: string;
  sku?: string;
  handle?: string;
  listing_type: 'product' | 'service';
}

export interface AdminVendorDetailSummary {
  total_revenue: number;
  total_revenue_formatted?: string;
  total_products: number;
  enabled_products: number;
  disabled_products: number;
  pending_products: number;
  currency: string;
}

export interface AdminVendorManagementOverview {
  total_vendors: number;
  total_products: number;
  active_products: number;
  total_revenue: number;
  revenue_formatted?: string;
  currency: string;
}

export interface AdminVendorManagementPage {
  overview: AdminVendorManagementOverview;
  vendors: AdminManagedVendor[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface AdminVendorManagementDetail {
  vendor: AdminManagedVendor;
  summary: AdminVendorDetailSummary;
  products: AdminManagedVendorProduct[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  revenue: number;
  currency: string;
}

function normalizeUploadUri(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('http')) {
    return uri;
  }
  if (uri.startsWith('/')) return `file://${uri}`;
  return uri;
}

function guessMimeType(name: string, fallback = 'application/octet-stream'): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return fallback;
}

function appendVendorFile(form: FormData, key: string, file?: AdminVendorUploadFile | null) {
  if (!file?.uri) return;
  const name = file.name?.trim() || `${key}.jpg`;
  const type = file.mimeType?.trim() || guessMimeType(name);
  form.append(key, {
    uri: normalizeUploadUri(file.uri),
    name,
    type,
  } as unknown as Blob);
}

function buildGoogleMapsLocation(params: {
  latitude?: number;
  longitude?: number;
  map_address?: string;
}): string {
  if (params.latitude != null && params.longitude != null) {
    return `${params.latitude},${params.longitude}`;
  }
  return params.map_address?.trim() ?? '';
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

function buildVendorFormData(params: AdminUpdateVendorPayload): FormData {
  const form = new FormData();
  form.append('company_name', params.company_name.trim());
  form.append('authorized_person_name', params.authorized_person_name.trim());
  form.append('email', params.email.trim());
  form.append('phone', params.phone.trim());
  form.append('trade_license_number', params.trade_license_number.trim());
  form.append('address', params.address.trim());
  Array.from(new Set((params.vendor_types || []).map((type) => type.trim()).filter(Boolean))).forEach(
    (type) => {
      form.append('vendor_type[]', type);
    }
  );
  form.append('emirate', params.emirate.trim());
  if (params.city?.trim()) {
    form.append('city', params.city.trim());
  }
  form.append('google_maps_location', buildGoogleMapsLocation(params));
  if (params.bank_name?.trim()) {
    form.append('bank_name', params.bank_name.trim());
  }
  form.append('iban', params.iban.trim());
  form.append('account_holder_name', params.account_holder_name.trim());
  form.append('delivery_radius', String(params.delivery_radius_km));
  form.append('opens_at', params.opens_at.trim());
  form.append('closes_at', params.closes_at.trim());
  form.append('minimum_order_amount', String(params.minimum_order_amount));
  form.append('terms_accepted', params.terms_accepted === false ? '0' : '1');
  form.append('status', params.status || 'approved');

  if (params.vat_number?.trim()) {
    form.append('vat_number', params.vat_number.trim());
  }

  if (params.password) {
    form.append('password', params.password);
    form.append('password_confirmation', params.password_confirmation || params.password);
  }

  appendVendorFile(form, 'trade_license', params.trade_license);
  appendVendorFile(form, 'emirates_id', params.emirates_id);
  if (params.logo) {
    appendVendorFile(form, 'logo', params.logo);
  }

  return form;
}

function parseVendorMutationResponse(
  responseData: unknown,
  fallbackMessage: string
): { message: string; vendor?: AdminManagedVendor } {
  const body = asRecord(responseData) ?? {};
  if (body.success === false) {
    throw new Error(extractApiMessage(body, fallbackMessage));
  }
  const data = asRecord(body.data) ?? body;
  const vendorRow = asRecord(data.vendor) ?? asRecord(data.item) ?? data;
  const vendor =
    vendorRow && (pickString(vendorRow.id, vendorRow.vendor_id) || vendorRow.business_name)
      ? mapVendor(vendorRow)
      : undefined;
  return {
    message: pickString(body.message) || fallbackMessage,
    vendor,
  };
}

function throwVendorMutationError(error: unknown, fallback: string): never {
  if (error instanceof Error && !('response' in error)) {
    throw error;
  }
  const ax = error as {
    response?: { data?: unknown };
    message?: string;
  };
  if (ax.response?.data) {
    throw new Error(extractApiMessage(ax.response.data, ax.message || fallback));
  }
  throw error instanceof Error ? error : new Error(fallback);
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

function pickNumber(...values: unknown[]): number {
  for (const value of values) {
    if (value == null || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function resolveImageUrl(raw?: string | null): string | undefined {
  if (raw == null) return undefined;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return undefined;
  return trimmed.startsWith('http') ? trimmed : buildFullImageUrl(trimmed);
}

function extractImageCandidate(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return resolveImageUrl(value);
  const obj = asRecord(value);
  if (!obj) return undefined;
  return resolveImageUrl(
    pickString(obj.image_url, obj.url, obj.image_path, obj.path, obj.src, obj.thumbnail)
  );
}

/** Prefer any usable product image field from management / nested product payloads. */
function extractProductImageUrl(row: Record<string, unknown>): string | undefined {
  const product = asRecord(row.product) ?? {};
  const primary = asRecord(row.primary_image) ?? asRecord(product.primary_image);
  const main = asRecord(row.main_image) ?? asRecord(product.main_image);
  const lists = [
    row.images,
    row.gallery_images,
    product.images,
    product.gallery_images,
  ];

  const direct = [
    row.image_url,
    row.image,
    row.thumbnail,
    row.thumbnail_url,
    row.photo,
    row.photo_url,
    product.image_url,
    product.image,
    product.thumbnail,
    product.thumbnail_url,
    primary?.image_url,
    primary?.image_path,
    primary?.url,
    main?.image_url,
    main?.image_path,
    main?.url,
  ];

  for (const candidate of direct) {
    const url = extractImageCandidate(candidate);
    if (url) return url;
  }

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const url = extractImageCandidate(item);
      if (url) return url;
    }
  }

  return undefined;
}

function currencyFromFormatted(formatted?: string, fallback = 'AED'): string {
  if (!formatted?.trim()) return fallback;
  const match = formatted.trim().match(/^([A-Za-z]{3})\b/);
  return match?.[1] ?? fallback;
}

/** Map item from GET /admin/vendors/management */
function mapVendor(row: Record<string, unknown>): AdminManagedVendor {
  const business = asRecord(row.business) ?? {};
  const stats = asRecord(row.stats) ?? {};
  const revenueFormatted = pickString(row.revenue_formatted, stats.revenue_formatted) || undefined;
  const currency =
    pickString(row.currency, stats.currency) ||
    currencyFromFormatted(revenueFormatted) ||
    'AED';

  return {
    id: pickString(row.vendor_id, row.id, business.id) || String(row.id ?? ''),
    vendor_id: pickString(row.vendor_id, row.id) || undefined,
    business_name:
      pickString(
        row.business_name,
        row.company_name,
        business.name,
        business.business_name,
        row.name
      ) || 'Vendor',
    contact_name:
      pickString(
        row.owner_name,
        row.authorized_person_name,
        row.contact_person,
        row.name
      ) || undefined,
    email: pickString(row.email) || undefined,
    phone: pickString(row.phone) || undefined,
    logo_url: resolveImageUrl(
      pickString(row.logo_url, row.logo, business.logo_url, row.profile_picture_url)
    ),
    status: pickString(row.status) || undefined,
    status_label:
      pickString(row.status_label) ||
      (pickString(row.status)
        ? pickString(row.status).charAt(0).toUpperCase() +
          pickString(row.status).slice(1).replace(/_/g, ' ')
        : undefined),
    products_count: pickNumber(
      row.products_count,
      row.total_products,
      stats.products,
      stats.total_products
    ),
    active_products: pickNumber(
      row.active_products,
      row.active_products_count,
      stats.active,
      stats.active_products
    ),
    revenue: pickNumber(row.revenue, row.total_revenue, stats.revenue),
    revenue_formatted: revenueFormatted,
    currency,
    orders_count: pickNumber(row.orders_count, row.total_orders, stats.orders, stats.total_orders),
  };
}

function normalizeApiPath(endpoint?: string): string | undefined {
  if (!endpoint?.trim()) return undefined;
  let path = endpoint.trim();
  if (path.startsWith('http')) {
    try {
      path = new URL(path).pathname;
    } catch {
      return undefined;
    }
  }
  if (path.startsWith('/api/')) path = path.slice(4);
  if (!path.startsWith('/')) path = `/${path}`;
  return path;
}

function pickTruthyFlag(...values: unknown[]): boolean {
  for (const v of values) {
    if (v === true || v === 1 || v === '1' || v === 'true') return true;
  }
  return false;
}

function inferManagedProductListingType(
  row: Record<string, unknown>,
  product: Record<string, unknown>,
  serviceFields: ReturnType<typeof resolveVendorProductServiceFromRow>
): 'product' | 'service' {
  if (serviceFields.service_id != null && serviceFields.service_id > 0) return 'service';
  if (serviceFields.service_name?.trim()) return 'service';

  if (
    pickTruthyFlag(
      row.is_service,
      product.is_service,
      row.service_listing,
      product.service_listing,
      row.is_service_listing,
      product.is_service_listing
    )
  ) {
    return 'service';
  }

  const raw = pickString(
    row.listing_type,
    product.listing_type,
    row.listing_kind,
    product.listing_kind,
    row.type,
    product.type
  ).toLowerCase();
  if (raw === 'service' || raw === 'services') return 'service';
  return 'product';
}

/** Map product from GET /admin/vendors/{id}/management → products.items */
function mapProduct(row: Record<string, unknown>): AdminManagedVendorProduct {
  const product = asRecord(row.product) ?? {};
  const inventory = asRecord(row.inventory) ?? {};
  const price = asRecord(row.price) ?? {};
  const actions = asRecord(row.actions) ?? {};
  const toggle = asRecord(actions.toggle) ?? {};
  const del = asRecord(actions.delete) ?? {};
  const priceFormatted = pickString(row.price_formatted) || undefined;
  const status = pickString(row.status).toLowerCase();
  const isEnabled =
    row.is_enabled === true ||
    row.is_available === true ||
    status === 'enabled' ||
    status === 'active';

  const deleteEndpoint = normalizeApiPath(pickString(del.endpoint));
  const categoryFields = resolveVendorProductCategoryFromRow(row);
  const serviceFields = resolveVendorProductServiceFromRow(row);
  const deepServiceId = extractProductServiceIdFromPayload({ success: true, data: row });
  const service_id =
    serviceFields.service_id ??
    (deepServiceId != null && deepServiceId > 0 ? deepServiceId : undefined);
  const service_name = serviceFields.service_name;
  const mergedServiceFields = {
    ...(service_id != null ? { service_id } : {}),
    ...(service_name ? { service_name } : {}),
  };

  return {
    id: pickString(row.vendor_product_id, row.id, row.product_id, product.id),
    vendor_product_id: pickString(row.vendor_product_id, row.id) || undefined,
    product_id: pickString(row.product_id, product.id) || undefined,
    name: pickString(row.name, product.name) || 'Product',
    image_url: extractProductImageUrl(row),
    price: pickNumber(row.price, price.amount, price.price, product.price),
    price_formatted: priceFormatted,
    currency:
      pickString(row.currency, price.currency) ||
      currencyFromFormatted(priceFormatted) ||
      'AED',
    stock: pickNumber(row.stock, row.stock_quantity, inventory.quantity, inventory.stock),
    is_available: isEnabled,
    status: pickString(row.status) || undefined,
    status_label: pickString(row.status_label) || undefined,
    display_status: pickString(row.display_status) || undefined,
    display_status_label: pickString(row.display_status_label) || undefined,
    approval_status: pickString(row.approval_status, row.listing_status) || undefined,
    disabled_by_admin: row.disabled_by_admin === true,
    can_toggle: row.can_toggle === true,
    toggle_endpoint: normalizeApiPath(pickString(toggle.endpoint)),
    can_delete: row.can_delete !== false,
    delete_endpoint: deleteEndpoint || undefined,
    revenue: pickNumber(row.revenue, row.total_revenue),
    category_id: categoryFields.category_id,
    category_name: categoryFields.category_name,
    service_id,
    service_name,
    sku: pickString(product.sku, row.sku) || undefined,
    handle: pickString(product.handle, row.handle) || undefined,
    listing_type: inferManagedProductListingType(row, product, mergedServiceFields),
  };
}

function mapDetailSummary(
  summary: Record<string, unknown> | null,
  products: AdminManagedVendorProduct[]
): AdminVendorDetailSummary {
  const revenueFormatted =
    pickString(summary?.total_revenue_formatted, summary?.revenue_formatted) || undefined;
  return {
    total_revenue: pickNumber(summary?.total_revenue, summary?.revenue),
    total_revenue_formatted: revenueFormatted,
    total_products: pickNumber(summary?.total_products, products.length) || products.length,
    enabled_products:
      pickNumber(summary?.enabled_products) ||
      products.filter((p) => p.is_available).length,
    disabled_products:
      pickNumber(summary?.disabled_products) ||
      products.filter((p) => !p.is_available).length,
    pending_products: pickNumber(summary?.pending_products),
    currency: currencyFromFormatted(revenueFormatted) || 'AED',
  };
}

function extractList(payload: unknown): Record<string, unknown>[] {
  const body = asRecord(payload);
  if (!body) return [];
  const data = body.data ?? body;
  if (Array.isArray(data)) {
    return data.map((row) => asRecord(row)).filter(Boolean) as Record<string, unknown>[];
  }
  const nested = asRecord(data);
  if (!nested) return [];
  const list =
    nested.items ?? nested.vendors ?? nested.data ?? nested.products ?? nested.results;
  if (!Array.isArray(list)) return [];
  return list.map((row) => asRecord(row)).filter(Boolean) as Record<string, unknown>[];
}

function mapSummary(
  summary: Record<string, unknown> | null,
  fallback?: Partial<AdminVendorManagementOverview>
): AdminVendorManagementOverview {
  const revenueFormatted =
    pickString(summary?.revenue_formatted) || fallback?.revenue_formatted || undefined;
  const currency =
    pickString(summary?.currency) ||
    currencyFromFormatted(revenueFormatted) ||
    fallback?.currency ||
    'AED';

  return {
    total_vendors: pickNumber(summary?.vendors, summary?.total_vendors, fallback?.total_vendors),
    total_products: pickNumber(summary?.products, summary?.total_products, fallback?.total_products),
    active_products: pickNumber(
      summary?.active_products,
      summary?.active,
      fallback?.active_products
    ),
    total_revenue: pickNumber(summary?.revenue, summary?.total_revenue, fallback?.total_revenue),
    revenue_formatted: revenueFormatted,
    currency,
  };
}

function parsePagination(
  data: Record<string, unknown>,
  page: number,
  perPage: number,
  itemCount: number
) {
  const meta =
    asRecord(data.pagination) ??
    asRecord(data.meta) ??
    asRecord(asRecord(data.data)?.pagination) ??
    asRecord(asRecord(data.data)?.meta) ??
    {};

  const current = pickNumber(meta.current_page, page) || page;
  const per = pickNumber(meta.per_page, perPage) || perPage;
  const total = pickNumber(meta.total, itemCount) || itemCount;
  const last =
    pickNumber(meta.last_page, Math.max(1, Math.ceil(total / per))) ||
    Math.max(1, Math.ceil(total / per));

  return {
    current_page: current,
    last_page: last,
    per_page: per,
    total,
  };
}

export const adminVendorManagementService = {
  /**
   * POST /admin/vendors (multipart form-data)
   * Creates a vendor from admin. status: approved | under_review | pending (default approved).
   */
  async createVendor(params: AdminCreateVendorPayload): Promise<{
    message: string;
    vendor?: AdminManagedVendor;
  }> {
    if (!params.trade_license?.uri) {
      throw new Error('Trade license file is required.');
    }
    if (!params.emirates_id?.uri) {
      throw new Error('Emirates ID file is required.');
    }
    if (!params.password || params.password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    if (params.password !== params.password_confirmation) {
      throw new Error('Password confirmation does not match.');
    }
    if (!buildGoogleMapsLocation(params)) {
      throw new Error('Google Maps location is required.');
    }

    const form = buildVendorFormData(params);
    try {
      const response = await apiClient.post('/admin/vendors', form, {
        timeout: 120000,
        headers: { Accept: 'application/json' },
        transformRequest: [(data) => data],
      });
      return parseVendorMutationResponse(response.data, 'Vendor created successfully.');
    } catch (error: unknown) {
      throwVendorMutationError(error, 'Failed to create vendor.');
    }
  },

  /**
   * POST /admin/vendors/:vendor_id (multipart form-data)
   * Full update. Files/password optional when unchanged. status: approved | under_review | pending.
   */
  async updateVendor(
    vendorId: string | number,
    params: AdminUpdateVendorPayload
  ): Promise<{
    message: string;
    vendor?: AdminManagedVendor;
  }> {
    if (!vendorId && vendorId !== 0) {
      throw new Error('Vendor id is required.');
    }
    if (params.password) {
      if (params.password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }
      if (params.password !== (params.password_confirmation || '')) {
        throw new Error('Password confirmation does not match.');
      }
    }
    if (!buildGoogleMapsLocation(params)) {
      throw new Error('Google Maps location is required.');
    }

    const form = buildVendorFormData(params);
    try {
      const response = await apiClient.post(
        `/admin/vendors/${encodeURIComponent(String(vendorId))}`,
        form,
        {
          timeout: 120000,
          headers: { Accept: 'application/json' },
          transformRequest: [(data) => data],
        }
      );
      return parseVendorMutationResponse(response.data, 'Vendor updated successfully.');
    } catch (error: unknown) {
      throwVendorMutationError(error, 'Failed to update vendor.');
    }
  },

  /**
   * GET /admin/vendors/management?per_page=15&sort=newest
   * Returns summary + vendor items for the management home page.
   */
  async getManagementPage(params?: {
    page?: number;
    per_page?: number;
    sort?: string;
    search?: string;
  }): Promise<AdminVendorManagementPage> {
    const page = params?.page ?? 1;
    const perPage = params?.per_page ?? 15;
    const sort = params?.sort ?? 'newest';
    const search = params?.search?.trim();

    const response = await apiClient.get('/admin/vendors/management', {
      params: {
        page,
        per_page: perPage,
        sort,
        include_suspended: 1,
        ...(search ? { search } : {}),
      },
    });

    const body = asRecord(response.data) ?? {};
    if (body.success === false) {
      throw new Error(pickString(body.message) || 'Failed to load vendor management.');
    }

    const data = asRecord(body.data) ?? body;
    const summary = asRecord(data.summary);
    const items = Array.isArray(data.items)
      ? (data.items.map((row) => asRecord(row)).filter(Boolean) as Record<string, unknown>[])
      : extractList(response.data);

    const vendors = items.map(mapVendor);
    const pagination = parsePagination(data, page, perPage, vendors.length);

    return {
      overview: mapSummary(summary, {
        total_vendors: vendors.length,
        total_products: vendors.reduce((sum, v) => sum + v.products_count, 0),
        total_revenue: vendors.reduce((sum, v) => sum + v.revenue, 0),
        currency: vendors[0]?.currency || 'AED',
      }),
      vendors,
      pagination,
    };
  },

  /** @deprecated Prefer getManagementPage — kept for compatibility */
  async getOverview(): Promise<AdminVendorManagementOverview> {
    const page = await this.getManagementPage({ page: 1, per_page: 15, sort: 'newest' });
    return page.overview;
  },

  /** @deprecated Prefer getManagementPage — kept for compatibility */
  async listVendors(params?: {
    page?: number;
    per_page?: number;
    search?: string;
  }): Promise<{ vendors: AdminManagedVendor[]; hasMore: boolean }> {
    const page = await this.getManagementPage({
      page: params?.page ?? 1,
      per_page: params?.per_page ?? 15,
      sort: 'newest',
      search: params?.search,
    });
    return {
      vendors: page.vendors,
      hasMore: page.pagination.current_page < page.pagination.last_page,
    };
  },

  /**
   * GET /admin/vendors/{vendor_id}/management?per_page=20
   * Vendor profile + summary + paginated products.
   */
  async getVendorDetail(
    vendorId: string,
    params?: { page?: number; per_page?: number; search?: string; status?: string }
  ): Promise<AdminVendorManagementDetail> {
    const page = params?.page ?? 1;
    const perPage = params?.per_page ?? 20;
    const search = params?.search?.trim();
    const status = params?.status?.trim();

    const response = await apiClient.get(
      `/admin/vendors/${encodeURIComponent(vendorId)}/management`,
      {
        params: {
          page,
          per_page: perPage,
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
        },
      }
    );

    const body = asRecord(response.data) ?? {};
    if (body.success === false) {
      throw new Error(pickString(body.message) || 'Failed to load vendor management detail.');
    }

    const data = asRecord(body.data) ?? body;
    const vendorRow = asRecord(data.vendor) ?? {};
    const summaryRow = asRecord(data.summary);
    const productsBlock = asRecord(data.products) ?? {};
    const items = Array.isArray(productsBlock.items)
      ? (productsBlock.items
          .map((row) => asRecord(row))
          .filter(Boolean) as Record<string, unknown>[])
      : Array.isArray(data.products)
        ? (data.products.map((row) => asRecord(row)).filter(Boolean) as Record<string, unknown>[])
        : [];

    const products = items.map(mapProduct);
    const summary = mapDetailSummary(summaryRow, products);
    const vendor = mapVendor({
      ...vendorRow,
      products_count: summary.total_products,
      active_products: summary.enabled_products,
      revenue: summary.total_revenue,
      revenue_formatted: summary.total_revenue_formatted,
    });
    const pagination = parsePagination(
      productsBlock,
      page,
      perPage,
      pickNumber(productsBlock.count, products.length) || products.length
    );

    return {
      vendor,
      summary,
      products,
      pagination,
      revenue: summary.total_revenue,
      currency: summary.currency,
    };
  },

  /**
   * POST /admin/vendors/{vendor_id}/products/{vendor_product_id}/toggle
   * Enable / disable a vendor product (no body required).
   */
  async toggleProduct(
    vendorId: string,
    product: AdminManagedVendorProduct
  ): Promise<AdminManagedVendorProduct | null> {
    const vendorProductId = product.vendor_product_id || product.id;
    if (!vendorId || !vendorProductId) {
      throw new Error('Missing vendor or product id for toggle.');
    }

    const endpoint = `/admin/vendors/${encodeURIComponent(vendorId)}/products/${encodeURIComponent(vendorProductId)}/toggle`;

    try {
      const response = await apiClient.post(endpoint);
      const body = asRecord(response.data) ?? {};
      if (body.success === false) {
        throw new Error(pickString(body.message) || 'Failed to toggle product.');
      }

      const data = asRecord(body.data);
      const productRow =
        asRecord(data?.product) ??
        asRecord(data?.item) ??
        (data && (data.is_enabled != null || data.status != null) ? data : null);

      return productRow ? mapProduct(productRow) : null;
    } catch (error: unknown) {
      if (error instanceof Error && !('response' in error)) {
        throw error;
      }
      const ax = error as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      throw new Error(
        ax.response?.data?.message ||
          ax.response?.data?.error ||
          ax.message ||
          'Failed to toggle product.'
      );
    }
  },

  /**
   * DELETE /admin/vendors/{vendor_id}/products/{vendor_product_id}
   * Remove a vendor product listing.
   */
  async deleteProduct(
    vendorId: string,
    product: AdminManagedVendorProduct
  ): Promise<void> {
    const vendorProductId = product.vendor_product_id || product.id;
    if (!vendorId || !vendorProductId) {
      throw new Error('Missing vendor or product id for delete.');
    }

    const endpoint =
      product.delete_endpoint ||
      `/admin/vendors/${encodeURIComponent(vendorId)}/products/${encodeURIComponent(vendorProductId)}`;

    try {
      const response = await apiClient.delete(endpoint);
      const body = asRecord(response.data) ?? {};
      if (body.success === false) {
        throw new Error(pickString(body.message) || 'Failed to delete product.');
      }
    } catch (error: unknown) {
      if (error instanceof Error && !('response' in error)) {
        throw error;
      }
      const ax = error as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      throw new Error(
        ax.response?.data?.message ||
          ax.response?.data?.error ||
          ax.message ||
          'Failed to delete product.'
      );
    }
  },

  /**
   * POST /admin/vendors/{vendor_id}/account-status
   * Suspend or reactivate a vendor account.
   * Body: { action: "suspend" | "activate", notes?: string }
   */
  async updateVendorAccountStatus(
    vendorId: string,
    action: 'suspend' | 'activate',
    notes?: string
  ): Promise<{ message: string; status?: string; status_label?: string }> {
    if (!vendorId) {
      throw new Error('Missing vendor id for account status update.');
    }

    try {
      const response = await apiClient.post(
        `/admin/vendors/${encodeURIComponent(vendorId)}/account-status`,
        {
          action,
          notes:
            notes ||
            (action === 'suspend'
              ? 'Suspended from admin mobile app'
              : 'Reactivated from admin mobile app'),
        },
        { timeout: 20000 }
      );
      const body = asRecord(response.data) ?? {};
      if (body.success === false) {
        throw new Error(
          pickString(body.message) || 'Failed to update vendor account status.'
        );
      }

      const data = asRecord(body.data) ?? {};
      const vendorRow = asRecord(data.vendor) ?? {};
      const status = pickString(vendorRow.status, data.status) || undefined;
      const statusLabel =
        pickString(vendorRow.status_label, data.status_label) ||
        (status
          ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
          : undefined);

      return {
        message:
          pickString(body.message) ||
          (action === 'suspend' ? 'Vendor suspended.' : 'Vendor activated.'),
        status,
        status_label: statusLabel,
      };
    } catch (error: unknown) {
      if (error instanceof Error && !('response' in error)) {
        throw error;
      }
      const ax = error as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      throw new Error(
        ax.response?.data?.message ||
          ax.response?.data?.error ||
          ax.message ||
          'Failed to update vendor account status.'
      );
    }
  },

  /** @deprecated Prefer toggleProduct */
  async setProductAvailability(
    vendorId: string,
    productId: string,
    _isAvailable: boolean
  ): Promise<void> {
    await this.toggleProduct(vendorId, {
      id: productId,
      vendor_product_id: productId,
      name: '',
      price: 0,
      currency: 'AED',
      stock: 0,
      is_available: _isAvailable,
      can_toggle: true,
    });
  },

  async findProductRowInManagementList(
    vendorId: string,
    productId: string
  ): Promise<{
    category_id?: number;
    category_name?: string;
    service_id?: number;
    service_name?: string;
    description?: string;
    sku?: string;
    handle?: string;
  } | null> {
    const targetId = productId.trim();
    if (!vendorId?.trim() || !targetId) return null;

    for (let page = 1; page <= 10; page++) {
      try {
        const response = await apiClient.get(
          `/admin/vendors/${encodeURIComponent(vendorId)}/management`,
          { params: { per_page: 50, page }, timeout: 20000 }
        );
        const body = asRecord(response.data) ?? {};
        const data = asRecord(body.data) ?? body;
        const productsBlock = asRecord(data.products) ?? {};
        const items = Array.isArray(productsBlock.items)
          ? (productsBlock.items
              .map((row) => asRecord(row))
              .filter(Boolean) as Record<string, unknown>[])
          : Array.isArray(data.products)
            ? (data.products
                .map((row) => asRecord(row))
                .filter(Boolean) as Record<string, unknown>[])
            : [];
        if (items.length === 0) break;

        for (const row of items) {
          const rowId = pickString(row.vendor_product_id, row.id, asRecord(row.product)?.id);
          if (rowId !== targetId) continue;
          const categoryFields = resolveVendorProductCategoryFromRow(row);
          const serviceFields = resolveVendorProductServiceFromRow(row);
          const description =
            extractProductDescriptionFromPayload({ success: true, data: row }) ||
            undefined;
          const sku =
            extractScalarFromPayload({ success: true, data: row }, 'sku') ||
            undefined;
          const handle =
            extractScalarFromPayload({ success: true, data: row }, 'handle') ||
            undefined;
          return {
            ...categoryFields,
            ...serviceFields,
            ...(description ? { description } : {}),
            ...(sku ? { sku } : {}),
            ...(handle ? { handle } : {}),
          };
        }

        const pagination = asRecord(productsBlock.pagination) ?? asRecord(data.pagination);
        const lastPage = pickNumber(pagination?.last_page, pagination?.total_pages) ?? 1;
        if (page >= lastPage) break;
      } catch {
        break;
      }
    }
    return null;
  },

  /**
   * GET /admin/vendors/{vendor_id}/products/{vendor_product_id}
   */
  async getVendorProduct(vendorId: string, productId: string): Promise<VendorProductDetail> {
    if (!vendorId?.trim() || !productId?.trim()) {
      throw new Error('Missing vendor or product id.');
    }
    try {
      const response = await apiClient.get(
        `/admin/vendors/${encodeURIComponent(vendorId)}/products/${encodeURIComponent(productId)}`
      );
      const body = asRecord(response.data) ?? {};
      if (body.success === false) {
        throw new Error(pickString(body.message) || 'Failed to load product.');
      }
      let detail = parseVendorProductDetail(response.data);
      if (!detail.name?.trim()) {
        throw new Error('Product data is incomplete.');
      }

      if (detail.category_id == null || detail.category_id <= 0) {
        const deepId = extractProductCategoryIdFromPayload(response.data);
        if (deepId != null && deepId > 0) {
          detail = { ...detail, category_id: deepId };
        }
      }

      const fromList = await this.findProductRowInManagementList(vendorId, productId);
      if (fromList) {
        if (!detail.sku?.trim() && fromList.sku?.trim()) {
          detail = { ...detail, sku: fromList.sku.trim() };
        }
        if (!detail.handle?.trim() && fromList.handle?.trim()) {
          detail = { ...detail, handle: fromList.handle.trim() };
        }
        if (!detail.description?.trim() && fromList.description?.trim()) {
          detail = { ...detail, description: fromList.description.trim() };
        }
        if (
          (detail.service_id == null || detail.service_id <= 0) &&
          !(detail.service_ids?.length ?? 0) &&
          fromList.service_id != null &&
          fromList.service_id > 0
        ) {
          detail = {
            ...detail,
            service_id: fromList.service_id,
            service_ids: [fromList.service_id],
            service: fromList.service_name || detail.service,
          };
        }
        if (detail.category_id == null || detail.category_id <= 0) {
          if (fromList.category_id != null && fromList.category_id > 0) {
            detail = {
              ...detail,
              category_id: fromList.category_id,
              category: fromList.category_name || detail.category,
            };
          } else if (fromList.category_name && (!detail.category || detail.category === '—')) {
            detail = { ...detail, category: fromList.category_name };
          }
        }
      }

      if (!detail.description?.trim()) {
        const deepDescription = extractProductDescriptionFromPayload(response.data);
        if (deepDescription?.trim()) {
          detail = { ...detail, description: deepDescription.trim() };
        }
      }

      if (!detail.sku?.trim()) {
        const deepSku = extractScalarFromPayload(response.data, 'sku');
        if (deepSku?.trim()) detail = { ...detail, sku: deepSku.trim() };
      }
      if (!detail.handle?.trim()) {
        const deepHandle = extractScalarFromPayload(response.data, 'handle');
        if (deepHandle?.trim()) detail = { ...detail, handle: deepHandle.trim() };
      }

      if (
        (detail.service_id == null || detail.service_id <= 0) &&
        !(detail.service_ids?.length ?? 0)
      ) {
        const deepServiceId = extractProductServiceIdFromPayload(response.data);
        if (deepServiceId != null && deepServiceId > 0) {
          detail = {
            ...detail,
            service_id: deepServiceId,
            service_ids: [deepServiceId],
          };
        }
      }

      return detail;
    } catch (error: unknown) {
      throwVendorMutationError(error, 'Failed to load product.');
    }
  },

  /**
   * POST /admin/vendors/{vendor_id}/products — multipart form-data
   * Matches Postman: name, description, price, stock, status, is_featured,
   * category_id (required), service_id (optional), weight_unit, sku, handle,
   * product_type, option_groups_json, main_image / image, images[].
   */
  async createVendorProduct(
    vendorId: string,
    params: CreateVendorProductParams
  ): Promise<{ message: string; product?: AdminManagedVendorProduct }> {
    if (!vendorId?.trim()) {
      throw new Error('Vendor id is required.');
    }
    const hasCategory =
      params.category_id != null && Number(params.category_id) > 0;
    const hasService = params.service_id != null && Number(params.service_id) > 0;
    if (!hasCategory && !hasService) {
      throw new Error('Category or service is required.');
    }

    const formData = buildVendorProductFormData(params, {
      mainImageAlias: true,
      normalizeUris: true,
    });

    try {
      const response = await apiClient.post(
        `/admin/vendors/${encodeURIComponent(vendorId)}/products`,
        formData,
        {
          timeout: 300000,
          headers: { Accept: 'application/json' },
          transformRequest: [(data) => data],
        }
      );
      const body = asRecord(response.data) ?? {};
      if (body.success === false) {
        throw new Error(extractApiMessage(body, 'Failed to create product.'));
      }
      const data = asRecord(body.data) ?? body;
      const productRow =
        asRecord(data.vendor_product) ??
        asRecord(data.product) ??
        asRecord(data.item) ??
        (data.vendor_product_id != null || data.id != null ? data : null);
      return {
        message: pickString(body.message) || 'Product created successfully.',
        product: productRow ? mapProduct(productRow) : undefined,
      };
    } catch (error: unknown) {
      throwVendorMutationError(error, 'Failed to create product.');
    }
  },

  /**
   * POST /admin/vendors/{vendor_id}/products/{vendor_product_id} — multipart update
   * Matches Postman: price, stock, status, category_id, service_id, weight_unit, sku,
   * handle, product_type, option_groups_json, main_image, images[], removed_image_ids[],
   * keep_image_ids[], remove_main_image.
   */
  async updateVendorProduct(
    vendorId: string,
    productId: string,
    params: CreateVendorProductParams
  ): Promise<{ message: string; product?: AdminManagedVendorProduct }> {
    if (!vendorId?.trim() || !productId?.trim()) {
      throw new Error('Missing vendor or product id.');
    }
    const hasCategory =
      params.category_id != null && Number(params.category_id) > 0;
    const hasService = params.service_id != null && Number(params.service_id) > 0;
    if (!hasCategory && !hasService) {
      throw new Error('Category or service is required.');
    }

    const formData = buildVendorProductFormData(params, {
      normalizeUris: true,
      mode: 'update',
    });
    try {
      const response = await apiClient.post(
        `/admin/vendors/${encodeURIComponent(vendorId)}/products/${encodeURIComponent(productId)}`,
        formData,
        {
          timeout: 300000,
          headers: { Accept: 'application/json' },
          transformRequest: [(data) => data],
        }
      );
      const body = asRecord(response.data) ?? {};
      if (body.success === false) {
        throw new Error(extractApiMessage(body, 'Failed to update product.'));
      }
      const data = asRecord(body.data) ?? body;
      const productRow =
        asRecord(data.vendor_product) ??
        asRecord(data.product) ??
        asRecord(data.item) ??
        (data.vendor_product_id != null || data.id != null ? data : null);
      return {
        message: pickString(body.message) || 'Product updated successfully.',
        product: productRow ? mapProduct(productRow) : undefined,
      };
    } catch (error: unknown) {
      throwVendorMutationError(error, 'Failed to update product.');
    }
  },

  /**
   * Marketplace category ids for POST /admin/vendors/{id}/products.
   * Tries admin/vendor auth routes, then public GET /shop/products/categories (same platform ids).
   */
  async getVendorPlatformCategories(vendorId?: string): Promise<VendorProductCategoryOption[]> {
    const paths: string[] = [];
    const id = vendorId?.trim();
    if (id) {
      paths.push(`/admin/vendors/${encodeURIComponent(id)}/product-options/categories`);
    }
    paths.push(
      '/admin/vendors/product-options/categories',
      '/admin/vendor/product-options/categories',
      '/vendor/categories',
      '/vendor/product-options/categories'
    );

    for (const path of paths) {
      try {
        const response = await apiClient.get(path, { timeout: 20000 });
        const parsed = parseVendorPlatformCategoryOptions(response.data);
        if (parsed.length > 0) return parsed;
      } catch {
        // try next route
      }
    }

    try {
      const shopCategories = await shopService.getProductCategories();
      const fromShop = shopCategories
        .map((c) => {
          const categoryId = Number(c.id);
          const name = c.name != null ? String(c.name).trim() : '';
          if (!Number.isFinite(categoryId) || categoryId <= 0 || !name) return null;
          if (c.coming_soon === true) return null;
          const active = (c as { is_active?: boolean | number }).is_active;
          if (active === false || active === 0) return null;
          return { id: categoryId, name };
        })
        .filter((row): row is VendorProductCategoryOption => row != null);
      if (fromShop.length > 0) return fromShop;
    } catch {
      // ignore
    }

    return [];
  },
};
