/**
 * Admin + public APIs for vendor signup metadata.
 *
 * Postman: F2. Admin - Vendor Types & Emirates
 *
 * A. Vendor Types
 *   GET    /admin/vendor-types              — List
 *   POST   /admin/vendor-types              — Create (form-data: name*, slug?, is_active? 1|0)
 *   GET    /admin/vendor-types/:id          — Get one
 *   POST   /admin/vendor-types/:id          — Update (form-data)
 *   DELETE /admin/vendor-types/:id          — Delete
 *   POST   /admin/vendor-types/:id/toggle-status
 *
 * B. Emirates
 *   GET    /admin/emirates                  — List emirate
 *   POST   /admin/emirates                  — Create emirate (form-data: name*, slug?, is_active? 1|0)
 *   POST   /admin/emirates/:id              — Update emirate (form-data)
 *   GET    /admin/emirates/:id              — Get emirate
 *   DELETE /admin/emirates/:id              — Delete emirate
 *   POST   /admin/emirates/:id/toggle-status
 *
 * Public (vendor registration — no token):
 *   GET /vendor/auth/registration-options   — vendor_types + emirates
 */
import apiClient, { publicApiClient } from './api';
import type {
  AdminVendorMetaInput,
  AdminVendorMetaItem,
  VendorSignupOption,
} from '../types/adminVendorMeta';

type ApiEnvelope<T> = {
  success?: boolean;
  status?: boolean;
  message?: string;
  data?: T;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickString(...values: unknown[]): string {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

function pickBool(...values: unknown[]): boolean {
  for (const v of values) {
    if (typeof v === 'boolean') return v;
    if (v === 1 || v === '1' || v === 'true') return true;
    if (v === 0 || v === '0' || v === 'false') return false;
  }
  return true;
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const v of values) {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function slugifyVendorMetaName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function unwrapList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  if (!root) return [];
  if (Array.isArray(root.data)) return root.data;
  const nested = asRecord(root.data);
  if (nested) {
    if (Array.isArray(nested.data)) return nested.data;
    if (Array.isArray(nested.items)) return nested.items;
    if (Array.isArray(nested.vendor_types)) return nested.vendor_types;
    if (Array.isArray(nested.emirates)) return nested.emirates;
  }
  if (Array.isArray(root.items)) return root.items;
  if (Array.isArray(root.vendor_types)) return root.vendor_types;
  if (Array.isArray(root.emirates)) return root.emirates;
  return [];
}

function mapMetaItem(raw: unknown, index: number): AdminVendorMetaItem | null {
  if (typeof raw === 'string' && raw.trim()) {
    const name = raw.trim();
    return {
      id: index + 1,
      name,
      slug: slugifyVendorMetaName(name),
      is_active: true,
      sort_order: index,
    };
  }
  const row = asRecord(raw);
  if (!row) return null;
  const name = pickString(row.name, row.title, row.label, row.emirate, row.vendor_type);
  if (!name) return null;
  const id = pickNumber(row.id) ?? index + 1;
  const slug = pickString(row.slug, row.code, row.key) || slugifyVendorMetaName(name);
  return {
    id,
    name,
    slug,
    is_active: pickBool(row.is_active, row.active, row.status !== 'inactive'),
    sort_order: pickNumber(row.sort_order, row.order, row.position) ?? index,
    created_at: pickString(row.created_at) || undefined,
    updated_at: pickString(row.updated_at) || undefined,
  };
}

function mapMetaList(payload: unknown): AdminVendorMetaItem[] {
  return unwrapList(payload)
    .map((item, index) => mapMetaItem(item, index))
    .filter((item): item is AdminVendorMetaItem => item != null)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
}

function mapSignupOptions(payload: unknown): VendorSignupOption[] {
  return mapMetaList(payload)
    .filter((item) => item.is_active)
    .map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug || slugifyVendorMetaName(item.name),
    }));
}

function getErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
  return (
    anyErr?.response?.data?.message ||
    anyErr?.response?.data?.error ||
    anyErr?.message ||
    fallback
  );
}

/** Build form-data matching Postman Create vendor type / emirate. */
function buildVendorMetaFormData(input: AdminVendorMetaInput): FormData {
  const formData = new FormData();
  formData.append('name', input.name.trim());
  // Optional — leave empty so backend auto-generates from name
  const slug = input.slug?.trim();
  if (slug) {
    formData.append('slug', slug);
  }
  // Optional — 1 = active (default), 0 = inactive
  formData.append('is_active', input.is_active === false ? '0' : '1');
  if (input.sort_order != null && Number.isFinite(input.sort_order)) {
    formData.append('sort_order', String(input.sort_order));
  }
  return formData;
}

async function listAdmin(path: string): Promise<AdminVendorMetaItem[]> {
  const response = await apiClient.get<ApiEnvelope<unknown> | unknown[]>(path, {
    headers: { Accept: 'application/json' },
  });
  return mapMetaList(response.data);
}

/** GET /admin/vendor-types/:id or /admin/emirates/:id */
async function getAdmin(path: string, id: number): Promise<AdminVendorMetaItem> {
  const response = await apiClient.get<ApiEnvelope<unknown>>(`${path}/${id}`, {
    headers: { Accept: 'application/json' },
  });
  const mapped = mapMetaItem(asRecord(response.data)?.data ?? response.data, 0);
  if (!mapped) {
    throw new Error('Vendor meta item not found');
  }
  return { ...mapped, id: mapped.id || id };
}

async function createAdmin(path: string, input: AdminVendorMetaInput): Promise<AdminVendorMetaItem> {
  const formData = buildVendorMetaFormData(input);
  const response = await apiClient.post<ApiEnvelope<unknown>>(path, formData, {
    headers: { Accept: 'application/json' },
  });
  const mapped = mapMetaItem(asRecord(response.data)?.data ?? response.data, 0);
  if (!mapped) {
    // Create succeeded but body shape unexpected — return optimistic row from input
    return {
      id: pickNumber(asRecord(response.data)?.id) ?? Date.now(),
      name: input.name.trim(),
      slug: input.slug?.trim() || slugifyVendorMetaName(input.name),
      is_active: input.is_active !== false,
      sort_order: input.sort_order,
    };
  }
  return mapped;
}

/**
 * POST /admin/vendor-types/:id — Update (form-data, same fields as create).
 * Postman: Update vendor type
 */
async function updateAdmin(
  path: string,
  id: number,
  input: AdminVendorMetaInput
): Promise<AdminVendorMetaItem> {
  const formData = buildVendorMetaFormData(input);
  const response = await apiClient.post<ApiEnvelope<unknown>>(`${path}/${id}`, formData, {
    headers: { Accept: 'application/json' },
  });
  const mapped = mapMetaItem(asRecord(response.data)?.data ?? response.data, 0);
  if (!mapped) {
    return {
      id,
      name: input.name.trim(),
      slug: input.slug?.trim() || slugifyVendorMetaName(input.name),
      is_active: input.is_active !== false,
      sort_order: input.sort_order,
    };
  }
  return { ...mapped, id: mapped.id || id };
}

/** DELETE /admin/vendor-types/:id or /admin/emirates/:id */
async function deleteAdmin(path: string, id: number): Promise<void> {
  await apiClient.delete(`${path}/${id}`, {
    headers: { Accept: 'application/json' },
  });
}

/**
 * POST /admin/vendor-types/:id/toggle-status
 * POST /admin/emirates/:id/toggle-status
 * Postman: Toggle status (Bearer + Accept: application/json, no body)
 */
async function toggleStatusAdmin(path: string, id: number): Promise<AdminVendorMetaItem | null> {
  const response = await apiClient.post<ApiEnvelope<unknown>>(
    `${path}/${id}/toggle-status`,
    null,
    { headers: { Accept: 'application/json' } }
  );
  const mapped = mapMetaItem(asRecord(response.data)?.data ?? response.data, 0);
  return mapped ? { ...mapped, id: mapped.id || id } : null;
}

async function listPublic(path: string): Promise<VendorSignupOption[]> {
  const response = await publicApiClient.get<ApiEnvelope<unknown> | unknown[]>(path);
  return mapSignupOptions(response.data);
}

export const DEFAULT_VENDOR_TYPE_OPTIONS: VendorSignupOption[] = [
  { name: 'Fruits', slug: 'fruits' },
  { name: 'Vegetables', slug: 'vegetables' },
  { name: 'Poultry', slug: 'poultry' },
  { name: 'Seafood', slug: 'seafood' },
  { name: 'Meat', slug: 'meat' },
  { name: 'Honey', slug: 'honey' },
  { name: 'Nuts', slug: 'nuts' },
  { name: 'Restaurant', slug: 'restaurant' },
  { name: 'Other', slug: 'other' },
];

export const DEFAULT_EMIRATE_OPTIONS: VendorSignupOption[] = [
  { name: 'Abu Dhabi', slug: 'abu_dhabi' },
  { name: 'Dubai', slug: 'dubai' },
  { name: 'Sharjah', slug: 'sharjah' },
  { name: 'Ajman', slug: 'ajman' },
  { name: 'Umm Al Quwain', slug: 'umm_al_quwain' },
  { name: 'Ras Al Khaimah', slug: 'ras_al_khaimah' },
  { name: 'Fujairah', slug: 'fujairah' },
];

export const adminVendorMetaService = {
  /** GET /admin/vendor-types */
  listVendorTypes: () => listAdmin('/admin/vendor-types'),
  /** GET /admin/vendor-types/:id */
  getVendorType: (id: number) => getAdmin('/admin/vendor-types', id),
  /** POST /admin/vendor-types (form-data) */
  createVendorType: (input: AdminVendorMetaInput) => createAdmin('/admin/vendor-types', input),
  /** POST /admin/vendor-types/:id (form-data) */
  updateVendorType: (id: number, input: AdminVendorMetaInput) =>
    updateAdmin('/admin/vendor-types', id, input),
  /** DELETE /admin/vendor-types/:id */
  deleteVendorType: (id: number) => deleteAdmin('/admin/vendor-types', id),
  /** POST /admin/vendor-types/:id/toggle-status */
  toggleVendorTypeStatus: (id: number) => toggleStatusAdmin('/admin/vendor-types', id),

  // —— B. Emirates (Postman) ——

  /** GET /admin/emirates — List emirate (Bearer + Accept: application/json) */
  listEmirates: () => listAdmin('/admin/emirates'),
  /** GET /admin/emirates/:id — Get emirate */
  getEmirate: (id: number) => getAdmin('/admin/emirates', id),
  /**
   * POST /admin/emirates — Create emirate
   * form-data: name* (e.g. Dubai), slug? (auto if empty), is_active? (1|0)
   */
  createEmirate: (input: AdminVendorMetaInput) => createAdmin('/admin/emirates', input),
  /**
   * POST /admin/emirates/:id — Update emirate
   * form-data: name*, slug?, is_active? (1|0)
   */
  updateEmirate: (id: number, input: AdminVendorMetaInput) =>
    updateAdmin('/admin/emirates', id, input),
  /** DELETE /admin/emirates/:id — Delete emirate */
  deleteEmirate: (id: number) => deleteAdmin('/admin/emirates', id),
  /** POST /admin/emirates/:id/toggle-status — Toggle emirate status */
  toggleEmirateStatus: (id: number) => toggleStatusAdmin('/admin/emirates', id),

  // —— C. Public — Registration options (no token) ——

  /**
   * GET /vendor/auth/registration-options
   * Public. Returns active vendor_types + emirates for Vendor Registration chips.
   */
  getRegistrationOptions: async (): Promise<{
    vendor_types: VendorSignupOption[];
    emirates: VendorSignupOption[];
  }> => {
    try {
      const response = await publicApiClient.get<ApiEnvelope<unknown>>(
        '/vendor/auth/registration-options',
        { headers: { Accept: 'application/json' } }
      );
      const root = asRecord(response.data);
      const data = asRecord(root?.data) ?? root;
      const vendorTypesRaw = data?.vendor_types;
      const emiratesRaw = data?.emirates;

      const vendor_types = mapMetaList(
        Array.isArray(vendorTypesRaw) ? vendorTypesRaw : []
      )
        .filter((i) => i.is_active)
        .map((i) => ({
          id: i.id,
          name: i.name,
          slug: i.slug || slugifyVendorMetaName(i.name),
        }));

      const emirates = mapMetaList(Array.isArray(emiratesRaw) ? emiratesRaw : [])
        .filter((i) => i.is_active)
        .map((i) => ({
          id: i.id,
          name: i.name,
          slug: i.slug || slugifyVendorMetaName(i.name),
        }));

      if (vendor_types.length || emirates.length) {
        return {
          vendor_types: vendor_types.length ? vendor_types : DEFAULT_VENDOR_TYPE_OPTIONS,
          emirates: emirates.length ? emirates : DEFAULT_EMIRATE_OPTIONS,
        };
      }
    } catch {
      // fall through to defaults
    }
    return {
      vendor_types: DEFAULT_VENDOR_TYPE_OPTIONS,
      emirates: DEFAULT_EMIRATE_OPTIONS,
    };
  },

  /** @deprecated Prefer getRegistrationOptions() */
  getSignupVendorTypes: async (): Promise<VendorSignupOption[]> => {
    const opts = await adminVendorMetaService.getRegistrationOptions();
    return opts.vendor_types;
  },

  /** @deprecated Prefer getRegistrationOptions() */
  getSignupEmirates: async (): Promise<VendorSignupOption[]> => {
    const opts = await adminVendorMetaService.getRegistrationOptions();
    return opts.emirates;
  },

  getErrorMessage,
};
