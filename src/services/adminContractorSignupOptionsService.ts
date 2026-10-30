import apiClient from './api';

export type ContractorSignupOptionsTabKey =
  | 'categories'
  | 'subcategories'
  | 'services'
  | 'emirates'
  | 'cities'
  | 'coverage';

/** Tabs hidden in admin UI (API may still support them). */
export const CONTRACTOR_SIGNUP_HIDDEN_TABS: ContractorSignupOptionsTabKey[] = ['cities'];

export function isContractorSignupTabHidden(key: ContractorSignupOptionsTabKey): boolean {
  return CONTRACTOR_SIGNUP_HIDDEN_TABS.includes(key);
}

export function normalizeContractorSignupTabKey(
  key: ContractorSignupOptionsTabKey
): ContractorSignupOptionsTabKey {
  return isContractorSignupTabHidden(key) ? 'emirates' : key;
}

export type ContractorSignupOptionItem = {
  id: number;
  type: string;
  name: string;
  slug: string;
  parent_id: number | null;
  parent_name: string | null;
  subtitle: string;
  is_active: boolean;
  latitude?: number | null;
  longitude?: number | null;
  actions: {
    edit: boolean;
    delete: boolean;
    toggle: boolean;
  };
};

export type ContractorSignupOptionsTab = {
  key: ContractorSignupOptionsTabKey;
  label: string;
  icon: string;
};

export type ContractorSignupOptionsScreen = {
  registration: {
    is_open: boolean;
    title: string;
    subtitle: string;
  };
  tabs: ContractorSignupOptionsTab[];
  tab: ContractorSignupOptionsTabKey;
  summary: {
    total: number;
    active: number;
    label: string;
  };
  items: ContractorSignupOptionItem[];
};

export const CONTRACTOR_SIGNUP_PARENT_TAB: Partial<
  Record<ContractorSignupOptionsTabKey, ContractorSignupOptionsTabKey>
> = {
  subcategories: 'categories',
  cities: 'emirates',
};

export const CONTRACTOR_SIGNUP_PARENT_LABEL: Partial<
  Record<ContractorSignupOptionsTabKey, string>
> = {
  subcategories: 'Category',
  cities: 'Emirate',
};

/** Singular label for add/edit modal titles */
export const CONTRACTOR_SIGNUP_TAB_SINGULAR: Record<ContractorSignupOptionsTabKey, string> = {
  categories: 'Category',
  subcategories: 'Subcategory',
  services: 'Service',
  emirates: 'Emirate',
  cities: 'City',
  coverage: 'Coverage area',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickBool(...values: unknown[]): boolean {
  for (const v of values) {
    if (typeof v === 'boolean') return v;
    if (v === 1 || v === '1' || v === 'true') return true;
    if (v === 0 || v === '0' || v === 'false') return false;
  }
  return false;
}

function pickString(...values: unknown[]): string {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickCoordinate(...values: unknown[]): number | null {
  for (const value of values) {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
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

function mapTab(raw: unknown): ContractorSignupOptionsTab | null {
  const row = asRecord(raw);
  if (!row) return null;
  const key = pickString(row.key) as ContractorSignupOptionsTabKey;
  if (!key) return null;
  return {
    key,
    label: pickString(row.label, key) || key,
    icon: pickString(row.icon, 'grid'),
  };
}

function mapItem(
  raw: unknown,
  defaultTab?: ContractorSignupOptionsTabKey
): ContractorSignupOptionItem | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = pickNumber(row.id, row.category_id, row.subcategory_id, row.emirate_id, row.value);
  if (id == null) return null;
  const actionsRaw = asRecord(row.actions) ?? {};
  const slug = pickString(row.slug, row.subtitle);
  return {
    id,
    type: pickString(row.type, row.resource_type, row.option_type, defaultTab, 'item'),
    name: pickString(row.name, row.label) || `Item ${id}`,
    slug,
    parent_id: pickNumber(row.parent_id, row.category_id, row.subcategory_id, row.emirate_id),
    parent_name: pickString(row.parent_name) || null,
    subtitle: pickString(row.subtitle, slug),
    is_active: pickBool(row.is_active, row.active, true),
    latitude: pickCoordinate(row.latitude, row.lat, row.map_latitude),
    longitude: pickCoordinate(row.longitude, row.lng, row.lon, row.map_longitude),
    actions: {
      edit: pickBool(actionsRaw.edit, actionsRaw.can_edit, true),
      delete: pickBool(actionsRaw.delete, actionsRaw.can_delete, true),
      toggle: pickBool(actionsRaw.toggle, actionsRaw.can_toggle, true),
    },
  };
}

function mapScreen(body: unknown): ContractorSignupOptionsScreen {
  const root = asRecord(body);
  const data = asRecord(root?.data) ?? root ?? {};
  const registrationRaw = asRecord(data.registration) ?? {};
  const summaryRaw = asRecord(data.summary) ?? {};
  const tabsRaw = Array.isArray(data.tabs) ? data.tabs : [];
  const itemsRaw = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.parent_options)
      ? data.parent_options
      : Array.isArray(data.categories)
        ? data.categories
        : Array.isArray(data.options)
          ? data.options
          : [];

  let tab = (pickString(data.tab, 'categories') || 'categories') as ContractorSignupOptionsTabKey;
  if (isContractorSignupTabHidden(tab)) {
    tab = 'emirates';
  }
  const tabs = tabsRaw
    .map(mapTab)
    .filter((x): x is ContractorSignupOptionsTab => x != null)
    .filter((row) => !isContractorSignupTabHidden(row.key));
  const items = itemsRaw
    .map((raw) => mapItem(raw, tab))
    .filter((x): x is ContractorSignupOptionItem => x != null);

  const total = Number(summaryRaw.total ?? items.length) || 0;
  const active = Number(summaryRaw.active ?? items.filter((i) => i.is_active).length) || 0;

  return {
    registration: {
      is_open: pickBool(registrationRaw.is_open, registrationRaw.isOpen, true),
      title: pickString(registrationRaw.title, 'Contractor registration'),
      subtitle: pickString(
        registrationRaw.subtitle,
        'Options below appear on contractor registration.'
      ),
    },
    tabs: tabs.length
      ? tabs
      : [
          { key: 'categories', label: 'Categories', icon: 'grid' },
          { key: 'subcategories', label: 'Subcategories', icon: 'layers' },
          { key: 'services', label: 'Services', icon: 'tools' },
          { key: 'emirates', label: 'Emirates', icon: 'pin' },
          { key: 'coverage', label: 'Coverage', icon: 'map' },
        ],
    tab,
    summary: {
      total,
      active,
      label:
        pickString(summaryRaw.label) ||
        `${total} total · ${active} active on signup`,
    },
    items,
  };
}

function collectParentOptionArrays(data: Record<string, unknown>): unknown[] {
  const keys = [
    'parent_options',
    'parent_categories',
    'available_categories',
    'categories',
    'category_options',
    'parents',
    'options',
  ];
  for (const key of keys) {
    if (Array.isArray(data[key]) && (data[key] as unknown[]).length) {
      return data[key] as unknown[];
    }
  }
  const parents = asRecord(data.parents);
  if (parents && Array.isArray(parents.items)) return parents.items as unknown[];
  return [];
}

/** API `tab` query for CRUD — from item.type, else current screen tab. */
export function signupOptionTabForItem(
  item: Pick<ContractorSignupOptionItem, 'type'>,
  fallbackTab: ContractorSignupOptionsTabKey
): ContractorSignupOptionsTabKey {
  const raw = (item.type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const map: Record<string, ContractorSignupOptionsTabKey> = {
    category: 'categories',
    categories: 'categories',
    main_category: 'categories',
    main_service_category: 'categories',
    subcategory: 'subcategories',
    subcategories: 'subcategories',
    service_subcategory: 'subcategories',
    service: 'services',
    services: 'services',
    available_service: 'services',
    emirate: 'emirates',
    emirates: 'emirates',
    city: 'cities',
    cities: 'cities',
    coverage: 'coverage',
    coverage_area: 'coverage',
    service_coverage_area: 'coverage',
  };
  if (map[raw]) return map[raw];
  if (raw.includes('subcategor')) return 'subcategories';
  if (raw.includes('main') && raw.includes('categor')) return 'categories';
  if (raw.includes('categor')) return 'categories';
  if (raw.includes('service')) return 'services';
  if (raw.includes('emirate')) return 'emirates';
  if (raw.includes('city')) return 'cities';
  if (raw.includes('coverage') || raw.includes('area')) return 'coverage';
  return fallbackTab;
}

export function contractorSignupTabIcon(icon: string): string {
  switch (icon) {
    case 'grid':
      return 'grid-outline';
    case 'layers':
      return 'layers-outline';
    case 'tools':
      return 'construct-outline';
    case 'pin':
      return 'location-outline';
    case 'building':
      return 'business-outline';
    case 'map':
      return 'map-outline';
    default:
      return 'ellipse-outline';
  }
}

export const adminContractorSignupOptionsService = {
  /** GET /admin/contractor-signup-options?tab= */
  async getScreen(tab: ContractorSignupOptionsTabKey): Promise<ContractorSignupOptionsScreen> {
    const apiTab = normalizeContractorSignupTabKey(tab);
    const response = await apiClient.get<{ success?: boolean; message?: string; data?: unknown }>(
      '/admin/contractor-signup-options',
      {
        params: { tab: apiTab },
        timeout: 20000,
      }
    );
    const body = response.data ?? {};
    if (body.success === false) {
      throw new Error(extractApiMessage(body, 'Failed to load contractor signup options.'));
    }
    return mapScreen(body);
  },

  /**
   * Parent rows for add/edit (e.g. categories when adding a subcategory).
   * Tries parent tab list, then parent arrays embedded on the child tab response.
   */
  async getParentOptions(
    childTab: ContractorSignupOptionsTabKey
  ): Promise<ContractorSignupOptionItem[]> {
    const parentTab = CONTRACTOR_SIGNUP_PARENT_TAB[childTab];
    if (!parentTab) return [];

    const parentScreen = await this.getScreen(parentTab);
    if (parentScreen.items.length) return parentScreen.items;

    const childResponse = await apiClient.get<{ success?: boolean; data?: unknown }>(
      '/admin/contractor-signup-options',
      { params: { tab: childTab }, timeout: 20000 }
    );
    const childBody = childResponse.data ?? {};
    const childData = asRecord(asRecord(childBody)?.data) ?? asRecord(childBody) ?? {};
    const embedded = collectParentOptionArrays(childData)
      .map(mapItem)
      .filter((x): x is ContractorSignupOptionItem => x != null);
    if (embedded.length) return embedded;

    try {
      const parentsResponse = await apiClient.get<{ success?: boolean; data?: unknown }>(
        '/admin/contractor-signup-options/parents',
        { params: { tab: childTab }, timeout: 20000 }
      );
      const parentsBody = parentsResponse.data ?? {};
      const parentsData = asRecord(asRecord(parentsBody)?.data) ?? asRecord(parentsBody) ?? {};
      const fromParents = (
        Array.isArray(parentsData.items)
          ? parentsData.items
          : collectParentOptionArrays(parentsData)
      )
        .map(mapItem)
        .filter((x): x is ContractorSignupOptionItem => x != null);
      if (fromParents.length) return fromParents;
    } catch {
      // optional endpoint
    }

    return parentScreen.items;
  },

  /** PUT /admin/contractor-signup-options/settings — { is_open: boolean } */
  async setRegistrationOpen(isOpen: boolean): Promise<void> {
    const response = await apiClient.put<{ success?: boolean; message?: string }>(
      '/admin/contractor-signup-options/settings',
      { is_open: isOpen },
      {
        timeout: 20000,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      }
    );
    if (response.data?.success === false) {
      throw new Error(extractApiMessage(response.data, 'Could not update registration setting.'));
    }
  },

  /** POST /admin/contractor-signup-options */
  async createItem(input: {
    tab: ContractorSignupOptionsTabKey;
    name: string;
    slug?: string;
    parent_id?: number | null;
    is_active?: boolean;
    latitude?: number | null;
    longitude?: number | null;
  }): Promise<void> {
    const form = new FormData();
    form.append('tab', input.tab);
    form.append('name', input.name.trim());
    if (input.slug?.trim()) form.append('slug', input.slug.trim());
    if (input.parent_id != null) {
      form.append('parent_id', String(input.parent_id));
      if (input.tab === 'subcategories') {
        form.append('category_id', String(input.parent_id));
      } else if (input.tab === 'services') {
        form.append('subcategory_id', String(input.parent_id));
      } else if (input.tab === 'cities') {
        form.append('emirate_id', String(input.parent_id));
      }
    }
    if (input.is_active != null) form.append('is_active', input.is_active ? '1' : '0');
    if (input.latitude != null && Number.isFinite(input.latitude)) {
      form.append('latitude', String(input.latitude));
      form.append('lat', String(input.latitude));
    }
    if (input.longitude != null && Number.isFinite(input.longitude)) {
      form.append('longitude', String(input.longitude));
      form.append('lng', String(input.longitude));
    }

    const response = await apiClient.post<{ success?: boolean; message?: string }>(
      '/admin/contractor-signup-options',
      form,
      {
        timeout: 30000,
        headers: { Accept: 'application/json' },
        transformRequest: [(data) => data],
      }
    );
    if (response.data?.success === false) {
      throw new Error(extractApiMessage(response.data, 'Failed to create item.'));
    }
  },

  /** PUT /admin/contractor-signup-options/:id — JSON body { tab, name, slug, ... } */
  async updateItem(
    id: number,
    input: {
      tab: ContractorSignupOptionsTabKey;
      name: string;
      slug?: string;
      parent_id?: number | null;
      is_active?: boolean;
      latitude?: number | null;
      longitude?: number | null;
    }
  ): Promise<void> {
    const body: Record<string, unknown> = {
      tab: input.tab,
      name: input.name.trim(),
    };
    const slug = input.slug?.trim();
    if (slug) body.slug = slug;
    if (input.is_active != null) body.is_active = input.is_active;
    if (input.parent_id != null) {
      body.parent_id = input.parent_id;
      if (input.tab === 'subcategories') {
        body.category_id = input.parent_id;
      } else if (input.tab === 'cities') {
        body.emirate_id = input.parent_id;
      }
    }
    if (input.latitude != null && Number.isFinite(input.latitude)) {
      body.latitude = input.latitude;
      body.lat = input.latitude;
    }
    if (input.longitude != null && Number.isFinite(input.longitude)) {
      body.longitude = input.longitude;
      body.lng = input.longitude;
    }

    const response = await apiClient.put<{ success?: boolean; message?: string }>(
      `/admin/contractor-signup-options/${id}`,
      body,
      {
        timeout: 30000,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      }
    );
    if (response.data?.success === false) {
      throw new Error(extractApiMessage(response.data, 'Failed to update item.'));
    }
  },

  /**
   * DELETE /admin/contractor-signup-options/:id?tab=categories|subcategories|...
   * Postman: 6. Delete option
   */
  async deleteItem(
    id: number,
    tab: ContractorSignupOptionsTabKey
  ): Promise<{ success: boolean; message?: string }> {
    if (!Number.isFinite(id)) {
      throw new Error('Invalid signup option ID.');
    }
    try {
      const response = await apiClient.delete<{ success?: boolean; message?: string }>(
        `/admin/contractor-signup-options/${encodeURIComponent(String(id))}`,
        {
          params: { tab },
          timeout: 20000,
          headers: { Accept: 'application/json' },
        }
      );
      const body = response.data ?? {};
      if (body.success === false) {
        throw new Error(extractApiMessage(body, 'Failed to delete item.'));
      }
      return {
        success: true,
        message: typeof body.message === 'string' ? body.message : undefined,
      };
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } }).response?.data;
      if (data) {
        throw new Error(extractApiMessage(data, 'Failed to delete item.'));
      }
      if (err instanceof Error) throw err;
      throw new Error('Failed to delete item.');
    }
  },

  /** POST /admin/contractor-signup-options/:id/toggle-status */
  async toggleItem(id: number, tab: ContractorSignupOptionsTabKey): Promise<void> {
    const response = await apiClient.post<{ success?: boolean; message?: string }>(
      `/admin/contractor-signup-options/${id}/toggle-status`,
      { tab },
      { timeout: 20000 }
    );
    if (response.data?.success === false) {
      throw new Error(extractApiMessage(response.data, 'Failed to update status.'));
    }
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
