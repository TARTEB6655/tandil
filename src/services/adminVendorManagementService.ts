import apiClient from './api';
import { buildFullImageUrl } from '../config/api';

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
};
