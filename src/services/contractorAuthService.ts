import { publicApiClient } from './api';
import type {
  ContractorSignupOptionRow,
  ContractorSignupOptions,
} from '../types/contractorRegistrationMeta';

export type ContractorRegisterUpload = {
  uri: string;
  name: string;
  mimeType: string;
};

/** Payload for POST /api/contractor/auth/register (multipart form-data). */
export type ContractorRegisterPayload = {
  name: string;
  phone: string;
  email: string;
  password: string;
  password_confirmation: string;
  company_name: string;
  trade_license_number: string;
  trade_license_upload: ContractorRegisterUpload;
  trade_license_expiry_date: string;
  trn?: string;
  vat_certificate?: ContractorRegisterUpload | null;
  /** Company emirate display name */
  emirate: string;
  /** Company city; API requires it — use emirate name when not collected separately */
  city?: string;
  company_address: string;
  bank_name: string;
  account_holder_name: string;
  bank_account_number: string;
  iban: string;
  bank_confirmation_letter: ContractorRegisterUpload;
  main_service_category_ids: number[];
  service_subcategory_ids: number[];
  selected_service_ids: number[];
  coverage_emirate_ids: number[];
  coverage_city_ids: number[];
  service_coverage_area_ids: number[];
};

function normalizeUploadUri(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('http')) {
    return uri;
  }
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

function appendFile(form: FormData, key: string, file?: ContractorRegisterUpload | null) {
  if (!file?.uri) return;
  const name = file.name?.trim() || `${key}.jpg`;
  const type = file.mimeType?.trim() || guessMimeType(name);
  form.append(key, {
    uri: normalizeUploadUri(file.uri),
    name,
    type,
  } as unknown as Blob);
}

function appendIdArray(form: FormData, key: string, ids: number[]) {
  ids.forEach((id) => form.append(`${key}[]`, String(id)));
}

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

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function listFromPayload(payload: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  if (!root) return [];
  for (const key of keys) {
    if (Array.isArray(root[key])) return root[key] as unknown[];
  }
  const data = asRecord(root.data);
  if (data) {
    for (const key of keys) {
      if (Array.isArray(data[key])) return data[key] as unknown[];
    }
  }
  return [];
}

function mapSignupOptionRow(
  raw: unknown,
  index: number
): ContractorSignupOptionRow | null {
  if (typeof raw === 'string' && raw.trim()) {
    const name = raw.trim();
    return { id: index + 1, name, slug: slugifyName(name) };
  }
  const row = asRecord(raw);
  if (!row) return null;
  const name = pickString(row.name, row.label, row.title);
  if (!name) return null;
  const id = pickNumber(
    row.id,
    row.value,
    row.category_id,
    row.subcategory_id,
    row.emirate_id,
    row.city_id,
    row.service_id
  );
  if (id == null) return null;
  let slug = pickString(row.slug, row.code) || slugifyName(name);
  if (!slug) slug = `id_${id}`;
  const parent_id = pickNumber(row.parent_id, row.emirate_id);
  const parent_slug = pickString(
    row.parent_slug,
    row.category_slug,
    row.emirate_slug,
    row.subcategory_slug,
    asRecord(row.parent)?.slug,
    asRecord(row.emirate)?.slug,
    asRecord(row.category)?.slug
  );
  let isActive = pickBool(row.is_active, row.active, true);
  if (typeof row.status === 'string' && row.status.trim() && row.status !== 'active') {
    isActive = false;
  }
  if (!isActive) return null;
  const out: ContractorSignupOptionRow = {
    id,
    name,
    slug,
  };
  if (parent_id != null) out.parent_id = parent_id;
  if (parent_slug) out.parent_slug = parent_slug;
  return out;
}

function idToSlugMap(
  rows: ContractorSignupOptionRow[]
): Map<number, string> {
  return new Map(rows.map((r) => [r.id, r.slug]));
}

function linkParentSlug(
  item: ContractorSignupOptionRow,
  parentId: number | undefined,
  parentMap: Map<number, string>
): ContractorSignupOptionRow {
  if (parentId == null) return item;
  const parent_slug = item.parent_slug ?? parentMap.get(parentId);
  return {
    ...item,
    parent_id: parentId,
    ...(parent_slug ? { parent_slug } : {}),
  };
}

function unwrapRegistrationOptionsPayload(body: unknown): Record<string, unknown> | null {
  let current: unknown = body;
  for (let depth = 0; depth < 4; depth++) {
    const root = asRecord(current);
    if (!root) return null;
    if (
      Array.isArray(root.main_service_categories) ||
      Array.isArray(root.main_categories) ||
      Array.isArray(root.emirates) ||
      Array.isArray(root.available_services)
    ) {
      return root;
    }
    if (root.data != null) {
      current = root.data;
      continue;
    }
    return root;
  }
  return asRecord(current);
}

function mapSignupOptionsFromApi(body: unknown): ContractorSignupOptions | null {
  const data = unwrapRegistrationOptionsPayload(body);
  if (!data) return null;

  const main_categories = listFromPayload(data, 'main_service_categories', 'main_categories')
    .map(mapSignupOptionRow)
    .filter((x): x is NonNullable<typeof x> => x != null);
  const categorySlugById = idToSlugMap(main_categories);

  const subcategories = listFromPayload(data, 'service_subcategories', 'subcategories')
    .map((raw) => {
      const item = mapSignupOptionRow(raw);
      if (!item) return null;
      const row = asRecord(raw);
      const parentId = pickNumber(row?.parent_id, row?.category_id);
      return linkParentSlug(item, parentId, categorySlugById);
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const subcategorySlugById = idToSlugMap(subcategories);

  const services = listFromPayload(
    data,
    'available_services',
    'services',
    'selected_services'
  )
    .map((raw) => {
      const item = mapSignupOptionRow(raw);
      if (!item) return null;
      const row = asRecord(raw);
      const parentId = pickNumber(row?.subcategory_id, row?.category_id, row?.parent_id);
      return linkParentSlug(item, parentId, subcategorySlugById);
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const emirates = listFromPayload(data, 'emirates', 'coverage_emirates')
    .map(mapSignupOptionRow)
    .filter((x): x is NonNullable<typeof x> => x != null);
  const emirateSlugById = idToSlugMap(emirates);

  const cities = listFromPayload(data, 'cities', 'coverage_cities')
    .map((raw) => {
      const item = mapSignupOptionRow(raw);
      if (!item) return null;
      const row = asRecord(raw);
      const parentId = pickNumber(row?.emirate_id, row?.parent_id);
      return linkParentSlug(item, parentId, emirateSlugById);
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const coverage_areas = listFromPayload(data, 'service_coverage_areas', 'coverage_areas')
    .map(mapSignupOptionRow)
    .filter((x): x is NonNullable<typeof x> => x != null);

  const registration_enabled = pickBool(
    data.registration_enabled,
    data.is_registration_open,
    data.contractor_registration_enabled,
    data.registration?.is_open,
    true
  );

  return {
    registration_enabled,
    main_categories,
    subcategories,
    services,
    emirates,
    cities,
    coverage_areas,
  };
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

function buildRegisterFormData(params: ContractorRegisterPayload): FormData {
  const form = new FormData();
  form.append('name', params.name.trim());
  form.append('phone', params.phone.trim());
  form.append('email', params.email.trim());
  form.append('password', params.password);
  form.append('password_confirmation', params.password_confirmation);
  form.append('company_name', params.company_name.trim());
  form.append('trade_license_number', params.trade_license_number.trim());
  form.append('trade_license_expiry_date', params.trade_license_expiry_date.trim());
  if (params.trn?.trim()) {
    form.append('trn', params.trn.trim());
  }
  form.append('emirate', params.emirate.trim());
  const city = params.city?.trim() || params.emirate.trim();
  form.append('city', city);
  form.append('company_address', params.company_address.trim());
  form.append('bank_name', params.bank_name.trim());
  form.append('account_holder_name', params.account_holder_name.trim());
  form.append('bank_account_number', params.bank_account_number.trim());
  form.append('iban', params.iban.trim());

  appendFile(form, 'trade_license_upload', params.trade_license_upload);
  appendFile(form, 'vat_certificate', params.vat_certificate);
  appendFile(form, 'bank_confirmation_letter', params.bank_confirmation_letter);

  appendIdArray(form, 'main_service_categories', params.main_service_category_ids);
  if (params.service_subcategory_ids.length) {
    appendIdArray(form, 'service_subcategories', params.service_subcategory_ids);
  }
  appendIdArray(form, 'selected_services', params.selected_service_ids);
  appendIdArray(form, 'emirates', params.coverage_emirate_ids);
  if (params.coverage_city_ids.length) {
    appendIdArray(form, 'cities', params.coverage_city_ids);
  }
  appendIdArray(form, 'service_coverage_areas', params.service_coverage_area_ids);

  return form;
}

export const contractorAuthService = {
  /**
   * GET /api/contractor/auth/registration-options
   * Public lists for contractor signup (IDs match register payload).
   */
  async getRegistrationOptions(): Promise<ContractorSignupOptions> {
    const response = await publicApiClient.get<{ success?: boolean; message?: string; data?: unknown }>(
      '/contractor/auth/registration-options',
      {
        headers: { Accept: 'application/json' },
        timeout: 30000,
      }
    );
    if (response.data?.success === false) {
      throw new Error(
        extractApiMessage(response.data, 'Could not load registration options.')
      );
    }
    const mapped = mapSignupOptionsFromApi(response.data);
    if (!mapped) {
      throw new Error('Registration options response was empty or invalid.');
    }
    return mapped;
  },

  /** POST /api/contractor/auth/register — multipart form-data (no auth). */
  async register(params: ContractorRegisterPayload): Promise<unknown> {
    if (!params.trade_license_upload?.uri) {
      throw new Error('Trade license file is required.');
    }
    if (!params.bank_confirmation_letter?.uri) {
      throw new Error('Bank confirmation letter is required.');
    }
    if (!params.main_service_category_ids.length) {
      throw new Error('Select at least one main service category.');
    }
    if (!params.selected_service_ids.length) {
      throw new Error('Select at least one service.');
    }
    if (!params.coverage_emirate_ids.length) {
      throw new Error('Select at least one coverage emirate.');
    }
    if (!params.service_coverage_area_ids.length) {
      throw new Error('Select at least one service coverage area.');
    }

    const form = buildRegisterFormData(params);
    try {
      const response = await publicApiClient.post('/contractor/auth/register', form, {
        timeout: 120000,
        headers: { Accept: 'application/json' },
        transformRequest: [(data) => data],
      });
      const body = response?.data ?? {};
      if (body?.success === false) {
        throw new Error(extractApiMessage(body, 'Contractor registration failed.'));
      }
      return body?.data ?? body;
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: unknown; status?: number };
        message?: string;
      };
      if (ax.response?.data) {
        throw new Error(
          extractApiMessage(ax.response.data, ax.message || 'Contractor registration failed.')
        );
      }
      throw err;
    }
  },

  getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message.trim()) return err.message.trim();
    return fallback;
  },
};
