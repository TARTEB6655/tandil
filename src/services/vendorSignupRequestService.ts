import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { publicApiClient } from './api';

const STORAGE_KEY = 'vendor_signup_requests_v2';

export type VendorSignupStatus = 'pending' | 'approved' | 'rejected';

export type VendorSignupStatusFilter = VendorSignupStatus | 'all';

export type VendorType =
  | 'Fruits'
  | 'Vegetables'
  | 'Poultry'
  | 'Seafood'
  | 'Meat'
  | 'Honey'
  | 'Nuts'
  | 'Restaurant'
  | 'Other';

/** API slugs for POST /vendor/auth/register */
export type VendorTypeApi =
  | 'fruits'
  | 'vegetables'
  | 'poultry'
  | 'seafood'
  | 'meat'
  | 'honey'
  | 'nuts'
  | 'rest';

export interface PickedUploadFile {
  uri: string;
  name: string;
  mimeType: string;
}

export interface VendorSignupPayload {
  company_name: string;
  authorized_person_name: string;
  email: string;
  phone: string;
  trade_license_number: string;
  trade_license_upload?: PickedUploadFile | null;
  address: string;
  password: string;
  password_confirmation: string;
  company_logo?: PickedUploadFile | null;
  vat_number?: string;
  emirates_id_upload?: PickedUploadFile | null;
  vendor_type: VendorType;
  emirate: string;
  city: string;
  latitude?: number;
  longitude?: number;
  map_address?: string;
  bank_name: string;
  iban: string;
  account_holder_name: string;
  delivery_radius_km: number;
  operating_hours_open: string;
  operating_hours_close: string;
  minimum_order_amount: number;
  terms_accepted: boolean;
}

export interface VendorSignupRequest {
  id: number | string;
  company_name: string;
  authorized_person_name: string;
  email: string;
  phone: string;
  vendor_type: string;
  emirate: string;
  city?: string;
  address?: string;
  trade_license_number?: string;
  vat_number?: string;
  bank_name?: string;
  iban?: string;
  account_holder_name?: string;
  delivery_radius_km?: number;
  minimum_order_amount?: number;
  opens_at?: string;
  closes_at?: string;
  google_maps_location?: string;
  logo_url?: string;
  trade_license_url?: string;
  emirates_id_url?: string;
  status: VendorSignupStatus;
  created_at: string;
  updated_at?: string;
}

export interface VendorSignupListResult {
  requests: VendorSignupRequest[];
  meta?: { total?: number; pending?: number; approved?: number; rejected?: number };
}

async function readLocal(): Promise<VendorSignupRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocal(list: VendorSignupRequest[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function vendorTypeToApi(type: VendorType | string): VendorTypeApi {
  const map: Record<string, VendorTypeApi> = {
    Fruits: 'fruits',
    fruits: 'fruits',
    Vegetables: 'vegetables',
    vegetables: 'vegetables',
    Poultry: 'poultry',
    poultry: 'poultry',
    Seafood: 'seafood',
    seafood: 'seafood',
    Meat: 'meat',
    meat: 'meat',
    Honey: 'honey',
    honey: 'honey',
    Nuts: 'nuts',
    nuts: 'nuts',
    Restaurant: 'rest',
    Other: 'rest',
    rest: 'rest',
  };
  return map[String(type)] ?? 'rest';
}

export function vendorTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    fruits: 'Fruits',
    vegetables: 'Vegetables',
    poultry: 'Poultry',
    seafood: 'Seafood',
    meat: 'Meat',
    honey: 'Honey',
    nuts: 'Nuts',
    rest: 'Restaurant / Other',
  };
  return labels[type.toLowerCase()] ?? type;
}

function normalizeUploadUri(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('http')) {
    return uri;
  }
  // iOS / local paths often need the file:// prefix for multipart uploads
  if (uri.startsWith('/')) return `file://${uri}`;
  return uri;
}

function guessMimeType(name: string, fallback = 'image/jpeg'): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return fallback;
}

function appendFile(form: FormData, key: string, file?: PickedUploadFile | null) {
  if (!file?.uri) return;
  const name = file.name?.trim() || `${key}.jpg`;
  const type = file.mimeType?.trim() || guessMimeType(name);
  form.append(key, {
    uri: normalizeUploadUri(file.uri),
    name,
    type,
  } as unknown as Blob);
}

function buildGoogleMapsLocation(params: VendorSignupPayload): string {
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

function resolveFileUrl(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object' && 'url' in (value as object)) {
      const url = (value as { url?: string }).url;
      if (url?.trim()) return url.trim();
    }
  }
  return undefined;
}

function resolveVendorStatus(r: Record<string, unknown>): VendorSignupStatus {
  const statusRaw = String(r.status ?? r.approval_status ?? '').toLowerCase();
  if (statusRaw === 'approved' || statusRaw === 'active') return 'approved';
  if (
    statusRaw === 'rejected' ||
    statusRaw === 'declined' ||
    statusRaw === 'cancelled' ||
    statusRaw === 'canceled'
  ) {
    return 'rejected';
  }
  if (statusRaw === 'under_review') return 'pending';

  const statusLabel = String(r.status_label ?? '').toLowerCase();
  if (statusLabel.includes('approved')) return 'approved';
  if (
    statusLabel.includes('rejected') ||
    statusLabel.includes('declined') ||
    statusLabel.includes('cancelled') ||
    statusLabel.includes('canceled')
  ) {
    return 'rejected';
  }
  if (statusLabel.includes('review') || statusLabel.includes('pending')) return 'pending';

  const displayStatus = String(r.display_status ?? '').toUpperCase();
  if (displayStatus === 'APPROVED') return 'approved';
  if (displayStatus === 'REJECTED') return 'rejected';
  if (displayStatus === 'PENDING') return 'pending';

  if (r.is_rejected === true || r.rejected_at != null) return 'rejected';
  if (r.is_approved === true || r.approved === true || r.approved === 1) return 'approved';
  if (r.is_approved === false || r.approved === false || r.approved === 0) return 'pending';
  if (r.is_verified === false || String(r.verification_status ?? '').toLowerCase() === 'pending') {
    return 'pending';
  }
  if (statusRaw === 'pending' || !statusRaw) return 'pending';
  return 'pending';
}

function asVendorRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseOperatingHours(value: unknown): {
  opens_at?: string;
  closes_at?: string;
  operating_hours?: string;
} {
  if (value == null || value === '') return {};
  const str = String(value).trim();
  const range = str.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/);
  if (range) {
    return { opens_at: range[1], closes_at: range[2], operating_hours: str };
  }
  return { operating_hours: str };
}

function mergeDocumentsIntoRow(flat: Record<string, unknown>, documents: unknown) {
  if (!Array.isArray(documents)) return;
  for (const doc of documents) {
    const row = asVendorRecord(doc);
    if (!row) continue;
    const type = String(row.type ?? row.document_type ?? '').toLowerCase();
    const url = row.file_url ?? row.url ?? row.path ?? row.document_url;
    if (typeof url !== 'string' || !url.trim()) continue;
    if (type.includes('trade')) flat.trade_license_url = url.trim();
    else if (type.includes('emirates')) flat.emirates_id_url = url.trim();
    else if (type.includes('logo')) flat.logo_url = url.trim();
  }
}

/** Flatten nested vendor list/detail payloads (contact, business_details, bank_details, documents). */
export function flattenVendorPayload(input: Record<string, unknown>): Record<string, unknown> {
  const profile = asVendorRecord(input.profile);
  const vendor = asVendorRecord(input.vendor);
  const contact = asVendorRecord(input.contact);
  const businessDetails = asVendorRecord(input.business_details);
  const bankDetails =
    asVendorRecord(input.bank_details) ?? asVendorRecord(input.bank) ?? asVendorRecord(input.banking);
  const application = asVendorRecord(input.application);
  const user = asVendorRecord(input.user);

  const flat: Record<string, unknown> = {
    ...input,
    ...(vendor ?? {}),
    ...(profile ?? {}),
    ...(businessDetails ?? {}),
    ...(bankDetails ?? {}),
  };

  if (contact) {
    if (contact.email != null) flat.email = contact.email;
    if (contact.phone != null) flat.phone = contact.phone;
    if (contact.authorized_person_name != null) {
      flat.authorized_person_name = contact.authorized_person_name;
    }
  }

  if (user) {
    if (!flat.email) flat.email = user.email;
    if (!flat.phone) flat.phone = user.phone;
    if (!flat.authorized_person_name) flat.authorized_person_name = user.name;
  }

  flat.company_name = input.business_name ?? flat.company_name ?? flat.business_name;
  flat.authorized_person_name =
    input.owner_name ?? flat.authorized_person_name ?? contact?.authorized_person_name;

  if (businessDetails?.tax_vat_number != null) {
    flat.vat_number = businessDetails.tax_vat_number;
  }
  if (businessDetails?.vendor_type_label != null) {
    flat.vendor_type_label = businessDetails.vendor_type_label;
  }
  if (businessDetails?.description != null) {
    flat.description = businessDetails.description;
  }
  if (Array.isArray(businessDetails?.categories)) {
    flat.categories = businessDetails.categories;
  }

  const hours = parseOperatingHours(businessDetails?.operating_hours ?? flat.operating_hours);
  Object.assign(flat, hours);

  mergeDocumentsIntoRow(flat, input.documents);
  mergeDocumentsIntoRow(flat, application?.required_documents);

  if (application?.completion_percent != null) {
    flat.completion_percent = application.completion_percent;
  } else if (input.completion_percent != null) {
    flat.completion_percent = input.completion_percent;
  }

  flat.id = input.vendor_id ?? input.id ?? profile?.vendor_id ?? vendor?.id;
  flat.vendor_id = input.vendor_id ?? flat.id;
  flat.status = input.status ?? vendor?.status ?? profile?.status;
  flat.display_status = input.display_status ?? flat.display_status;
  flat.status_label = input.status_label ?? flat.status_label;
  flat.created_at = input.submitted_at ?? input.created_at ?? flat.created_at;
  if (input.submitted_at_formatted != null) {
    flat.submitted_at_formatted = input.submitted_at_formatted;
  }
  if (input.logo_url != null) flat.logo_url = input.logo_url;

  return flat;
}

export function mapVendorApiRow(input: Record<string, unknown>): VendorSignupRequest {
  return normalizeApiRow(flattenVendorPayload(input));
}

function normalizeApiRow(r: Record<string, unknown>): VendorSignupRequest {
  const status = resolveVendorStatus(r);
  const user =
    r.user && typeof r.user === 'object' ? (r.user as Record<string, unknown>) : null;

  return {
    id: (r.id ?? r.vendor_id ?? r.request_id) as number | string,
    vendor_id: (r.vendor_id ?? r.id ?? r.request_id) as number | string | undefined,
    company_name: String(
      r.company_name ?? r.business_name ?? r.shop_name ?? ''
    ),
    authorized_person_name: String(
      r.authorized_person_name ??
        r.owner_name ??
        r.contact_name ??
        r.contact_person ??
        r.name ??
        user?.name ??
        ''
    ),
    email: String(r.email ?? user?.email ?? ''),
    phone:
      r.phone != null && String(r.phone).trim()
        ? String(r.phone)
        : user?.phone != null
          ? String(user.phone)
          : '',
    vendor_type: String(
      r.vendor_type ?? r.vendor_category ?? r.category ?? r.business_type ?? ''
    ),
    vendor_type_label:
      r.vendor_type_label != null ? String(r.vendor_type_label) : undefined,
    emirate: r.emirate != null ? String(r.emirate) : '',
    city: r.city != null ? String(r.city) : undefined,
    address: r.address != null ? String(r.address) : undefined,
    trade_license_number:
      r.trade_license_number != null
        ? String(r.trade_license_number)
        : typeof r.trade_license === 'string'
          ? r.trade_license
          : undefined,
    vat_number:
      r.vat_number != null
        ? String(r.vat_number)
        : r.tax_vat_number != null
          ? String(r.tax_vat_number)
          : undefined,
    bank_name: r.bank_name != null ? String(r.bank_name) : undefined,
    iban: r.iban != null ? String(r.iban) : undefined,
    account_holder_name:
      r.account_holder_name != null ? String(r.account_holder_name) : undefined,
    delivery_radius_km:
      r.delivery_radius_km != null
        ? Number(r.delivery_radius_km)
        : r.delivery_radius != null
          ? Number(r.delivery_radius)
          : undefined,
    minimum_order_amount:
      r.minimum_order_amount != null ? Number(r.minimum_order_amount) : undefined,
    opens_at:
      r.opens_at != null
        ? String(r.opens_at)
        : r.operating_hours_open != null
          ? String(r.operating_hours_open)
          : undefined,
    closes_at:
      r.closes_at != null
        ? String(r.closes_at)
        : r.operating_hours_close != null
          ? String(r.operating_hours_close)
          : undefined,
    operating_hours: r.operating_hours != null ? String(r.operating_hours) : undefined,
    google_maps_location:
      r.google_maps_location != null ? String(r.google_maps_location) : undefined,
    logo_url: resolveFileUrl(r, [
      'logo_url',
      'logo',
      'company_logo_url',
      'company_logo',
    ]),
    trade_license_url: resolveFileUrl(r, [
      'trade_license_url',
      'trade_license_file',
      'trade_license_upload',
      'trade_license_document',
      'trade_license_document_url',
    ]),
    emirates_id_url: resolveFileUrl(r, [
      'emirates_id_url',
      'emirates_id',
      'emirates_id_upload',
      'emirates_id_document',
      'emirates_id_document_url',
    ]),
    status,
    status_label: r.status_label != null ? String(r.status_label) : undefined,
    description: r.description != null ? String(r.description) : undefined,
    categories: Array.isArray(r.categories)
      ? (r.categories as Array<{ id: number; name: string }>)
      : undefined,
    completion_percent:
      r.completion_percent != null ? Number(r.completion_percent) : undefined,
    submitted_at_formatted:
      r.submitted_at_formatted != null ? String(r.submitted_at_formatted) : undefined,
    created_at: String(r.created_at ?? new Date().toISOString()),
    updated_at: r.updated_at != null ? String(r.updated_at) : undefined,
  };
}

function extractRows(body: Record<string, unknown>): Record<string, unknown>[] {
  const data = body.data;
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === 'object') {
    const nested = data as Record<string, unknown>;
    if (Array.isArray(nested.items)) return nested.items as Record<string, unknown>[];
    if (Array.isArray(nested.data)) return nested.data as Record<string, unknown>[];
    if (Array.isArray(nested.requests)) return nested.requests as Record<string, unknown>[];
    if (Array.isArray(nested.vendors)) return nested.vendors as Record<string, unknown>[];
  }
  if (Array.isArray(body.requests)) return body.requests as Record<string, unknown>[];
  if (Array.isArray(body.vendors)) return body.vendors as Record<string, unknown>[];
  return [];
}

function extractMeta(body: Record<string, unknown>): VendorSignupListResult['meta'] {
  const meta = (body.meta ?? body.pagination ?? {}) as Record<string, unknown>;
  return {
    total: meta.total != null ? Number(meta.total) : undefined,
    pending: meta.pending != null ? Number(meta.pending) : undefined,
    approved: meta.approved != null ? Number(meta.approved) : undefined,
    rejected: meta.rejected != null ? Number(meta.rejected) : undefined,
  };
}

async function fetchFromApi(
  status: VendorSignupStatusFilter,
  perPage = 50
): Promise<VendorSignupListResult | null> {
  const endpoints = [
    '/admin/vendors',
    '/admin/vendor-signup-requests',
    '/admin/vendor-registrations',
    '/admin/vendor-requests',
  ];

  const paramSets: Record<string, string | number>[] = [];
  if (status === 'pending') {
    paramSets.push(
      { per_page: perPage, status: 'pending' },
      { per_page: perPage, approval_status: 'pending' },
      { per_page: perPage, is_approved: 0 },
      { per_page: perPage, verified: 0 },
      { per_page: perPage }
    );
  } else if (status !== 'all') {
    paramSets.push({ per_page: perPage, status });
  } else {
    paramSets.push({ per_page: perPage });
  }

  for (const path of endpoints) {
    for (const params of paramSets) {
      try {
        const response = await apiClient.get(path, { params });
        const body = (response?.data ?? {}) as Record<string, unknown>;
        const rows = extractRows(body);
        if (rows.length > 0) {
          const requests = rows.map(mapVendorApiRow);
          return {
            requests,
            meta: extractMeta(body),
          };
        }
        if (body.success === true && Array.isArray(body.data) && body.data.length === 0) {
          return { requests: [], meta: extractMeta(body) };
        }
      } catch (err: unknown) {
        const statusCode = (err as { response?: { status?: number } })?.response?.status;
        if (statusCode && statusCode !== 404) {
          if (statusCode === 401 || statusCode === 403) throw err;
        }
      }
    }
  }
  return null;
}

/** Matches Postman: POST /api/vendor/auth/register (multipart form-data). */
function buildFormData(params: VendorSignupPayload): FormData {
  const form = new FormData();
  form.append('company_name', params.company_name.trim());
  form.append('authorized_person_name', params.authorized_person_name.trim());
  form.append('email', params.email.trim());
  form.append('phone', params.phone.trim());
  form.append('trade_license_number', params.trade_license_number.trim());
  form.append('address', params.address.trim());
  form.append('password', params.password);
  form.append('password_confirmation', params.password_confirmation);
  form.append('vendor_type', vendorTypeToApi(params.vendor_type));
  form.append('emirate', params.emirate.trim());
  if (params.city?.trim()) {
    form.append('city', params.city.trim());
  }
  form.append('google_maps_location', buildGoogleMapsLocation(params));
  form.append('bank_name', params.bank_name.trim());
  form.append('iban', params.iban.trim());
  form.append('account_holder_name', params.account_holder_name.trim());
  form.append('delivery_radius', String(params.delivery_radius_km));
  form.append('opens_at', params.operating_hours_open.trim());
  form.append('closes_at', params.operating_hours_close.trim());
  form.append('minimum_order_amount', String(params.minimum_order_amount));
  form.append('terms_accepted', params.terms_accepted ? '1' : '0');

  if (params.vat_number?.trim()) {
    form.append('vat_number', params.vat_number.trim());
  }

  appendFile(form, 'trade_license', params.trade_license_upload);
  appendFile(form, 'logo', params.company_logo);
  appendFile(form, 'emirates_id', params.emirates_id_upload);

  return form;
}

function payloadToStoredRequest(params: VendorSignupPayload, id: number | string): VendorSignupRequest {
  return {
    id,
    company_name: params.company_name.trim(),
    authorized_person_name: params.authorized_person_name.trim(),
    email: params.email.trim(),
    phone: params.phone.trim(),
    vendor_type: vendorTypeToApi(params.vendor_type),
    emirate: params.emirate.trim(),
    city: params.city.trim(),
    address: params.address.trim(),
    trade_license_number: params.trade_license_number.trim(),
    vat_number: params.vat_number?.trim(),
    bank_name: params.bank_name.trim(),
    iban: params.iban.trim(),
    account_holder_name: params.account_holder_name.trim(),
    delivery_radius_km: params.delivery_radius_km,
    minimum_order_amount: params.minimum_order_amount,
    opens_at: params.operating_hours_open.trim(),
    closes_at: params.operating_hours_close.trim(),
    google_maps_location: buildGoogleMapsLocation(params),
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}

function filterByStatus(
  list: VendorSignupRequest[],
  status: VendorSignupStatusFilter
): VendorSignupRequest[] {
  if (status === 'all') return list;
  return list.filter((r) => r.status === status);
}

function countByStatus(list: VendorSignupRequest[]) {
  return {
    pending: list.filter((r) => r.status === 'pending').length,
    approved: list.filter((r) => r.status === 'approved').length,
    rejected: list.filter((r) => r.status === 'rejected').length,
    total: list.length,
  };
}

export const vendorSignupRequestService = {
  /** POST /api/vendor/auth/register */
  async createRequest(params: VendorSignupPayload): Promise<VendorSignupRequest> {
    if (!params.trade_license_upload?.uri) {
      throw new Error('Trade license file is required.');
    }
    if (!params.emirates_id_upload?.uri) {
      throw new Error('Emirates ID file is required.');
    }
    if (!params.company_logo?.uri) {
      throw new Error('Company logo file is required.');
    }
    if (!buildGoogleMapsLocation(params)) {
      throw new Error('Google Maps location is required.');
    }

    const form = buildFormData(params);
    try {
      const response = await publicApiClient.post('/vendor/auth/register', form, {
        timeout: 120000,
        headers: { Accept: 'application/json' },
        transformRequest: [(data) => data],
      });
      const body = response?.data ?? {};
      if (body?.success === false) {
        throw new Error(extractApiMessage(body, 'Vendor registration failed.'));
      }
      const id =
        body?.data?.id ??
        body?.data?.vendor_id ??
        body?.data?.request_id ??
        body?.vendor?.id ??
        Date.now();
      return payloadToStoredRequest(params, id);
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: unknown; status?: number };
        message?: string;
      };
      if (ax.response?.data) {
        throw new Error(
          extractApiMessage(ax.response.data, ax.message || 'Vendor registration failed.')
        );
      }
      throw err;
    }
  },

  async getRequests(
    status: VendorSignupStatusFilter = 'pending'
  ): Promise<VendorSignupListResult> {
    let apiResult = await fetchFromApi(status);
    if (status === 'pending' && apiResult) {
      const hasPending = apiResult.requests.some((r) => r.status === 'pending');
      if (!hasPending) {
        const allResult = await fetchFromApi('all');
        if (allResult && allResult.requests.length > 0) {
          apiResult = allResult;
        }
      }
    }
    if (apiResult) {
      const filtered =
        status === 'all'
          ? apiResult.requests
          : apiResult.requests.filter((r) => r.status === status);
      const counts = countByStatus(apiResult.requests);
      return {
        requests: filtered.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
        meta: {
          ...apiResult.meta,
          pending: apiResult.meta?.pending ?? counts.pending,
          approved: apiResult.meta?.approved ?? counts.approved,
          rejected: apiResult.meta?.rejected ?? counts.rejected,
          total: apiResult.meta?.total ?? counts.total,
        },
      };
    }

    const local = await readLocal();
    const filtered = filterByStatus(local, status);
    const counts = countByStatus(local);
    return {
      requests: filtered.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      meta: counts,
    };
  },

  async getPendingRequests(): Promise<VendorSignupRequest[]> {
    const result = await this.getRequests('pending');
    return result.requests;
  },

  async getPendingCount(): Promise<number> {
    const result = await this.getRequests('pending');
    return result.meta?.pending ?? result.requests.length;
  },

  async getRequestById(id: number | string): Promise<VendorSignupRequest | null> {
    const endpoints = [
      `/admin/vendors/${id}/application-detail`,
      `/admin/vendor-signup-requests/${id}`,
      `/admin/vendors/${id}`,
      `/admin/vendor-registrations/${id}`,
    ];
    for (const path of endpoints) {
      try {
        const response = await apiClient.get(path);
        const body = (response?.data ?? {}) as Record<string, unknown>;
        const row =
          (body.data && typeof body.data === 'object' ? body.data : body) as Record<
            string,
            unknown
          >;
        if (row?.id != null || row?.vendor_id != null) {
          return mapVendorApiRow(row);
        }
      } catch (err: unknown) {
        const statusCode = (err as { response?: { status?: number } })?.response?.status;
        if (statusCode && statusCode !== 404) throw err;
      }
    }
    const local = await readLocal();
    return local.find((r) => String(r.id) === String(id)) ?? null;
  },

  async approveRequest(id: number | string): Promise<{ success: boolean; message?: string }> {
    const postEndpoints = [
      `/admin/vendors/${id}/approve`,
      `/admin/vendor-signup-requests/${id}/approve`,
    ];
    for (const path of postEndpoints) {
      try {
        const response = await apiClient.post(path);
        const body = response?.data ?? {};
        return { success: body?.success !== false, message: body?.message };
      } catch (err: unknown) {
        const statusCode = (err as { response?: { status?: number } })?.response?.status;
        if (statusCode && statusCode !== 404) {
          const data = (err as { response?: { data?: unknown } }).response?.data;
          throw new Error(extractApiMessage(data, 'Could not approve vendor.'));
        }
      }
    }
    try {
      const response = await apiClient.patch(`/admin/vendors/${id}`, {
        is_approved: 1,
        status: 'approved',
      });
      const body = response?.data ?? {};
      return { success: body?.success !== false, message: body?.message };
    } catch (err: unknown) {
      const statusCode = (err as { response?: { status?: number } })?.response?.status;
      if (statusCode && statusCode !== 404) {
        const data = (err as { response?: { data?: unknown } }).response?.data;
        throw new Error(extractApiMessage(data, 'Could not approve vendor.'));
      }
    }
    const list = await readLocal();
    const idx = list.findIndex((r) => String(r.id) === String(id));
    if (idx >= 0) {
      list[idx] = { ...list[idx], status: 'approved' };
      await writeLocal(list);
    }
    return { success: true, message: 'Vendor approved.' };
  },

  async rejectRequest(
    id: number | string,
    reason?: string
  ): Promise<{ success: boolean; message?: string }> {
    const postEndpoints = [
      `/admin/vendors/${id}/reject`,
      `/admin/vendor-signup-requests/${id}/reject`,
    ];
    for (const path of postEndpoints) {
      try {
        const response = await apiClient.post(path, reason ? { reason } : undefined);
        const body = response?.data ?? {};
        return { success: body?.success !== false, message: body?.message };
      } catch (err: unknown) {
        const statusCode = (err as { response?: { status?: number } })?.response?.status;
        if (statusCode && statusCode !== 404) {
          const data = (err as { response?: { data?: unknown } }).response?.data;
          throw new Error(extractApiMessage(data, 'Could not reject application.'));
        }
      }
    }
    try {
      const response = await apiClient.patch(`/admin/vendors/${id}`, {
        is_approved: 0,
        status: 'rejected',
      });
      const body = response?.data ?? {};
      return { success: body?.success !== false, message: body?.message };
    } catch (err: unknown) {
      const statusCode = (err as { response?: { status?: number } })?.response?.status;
      if (statusCode && statusCode !== 404) {
        const data = (err as { response?: { data?: unknown } }).response?.data;
        throw new Error(extractApiMessage(data, 'Could not reject application.'));
      }
    }
    const list = await readLocal();
    const idx = list.findIndex((r) => String(r.id) === String(id));
    if (idx >= 0) {
      list[idx] = { ...list[idx], status: 'rejected' };
      await writeLocal(list);
    }
    return { success: true, message: 'Vendor application rejected.' };
  },
};
