import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ContractorMetaEntity,
  ContractorMetaInput,
  ContractorMetaItem,
  ContractorRegistrationStore,
  ContractorSignupOptions,
} from '../types/contractorRegistrationMeta';

const STORAGE_KEY = 'contractor_registration_meta_v1';

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64) || `item_${Date.now()}`;
}

function nextId(items: ContractorMetaItem[]): number {
  if (!items.length) return 1;
  return Math.max(...items.map((i) => i.id)) + 1;
}

function defaultStore(): ContractorRegistrationStore {
  const main_categories: ContractorMetaItem[] = [
    { id: 1, name: 'Home Maintenance', slug: 'home_maintenance', is_active: true, sort_order: 1 },
    { id: 2, name: 'Cleaning', slug: 'cleaning', is_active: true, sort_order: 2 },
    { id: 3, name: 'Landscaping', slug: 'landscaping', is_active: true, sort_order: 3 },
    { id: 4, name: 'Pest Control', slug: 'pest_control', is_active: true, sort_order: 4 },
  ];
  const subcategories: ContractorMetaItem[] = [
    { id: 1, name: 'AC Services', slug: 'ac_services', is_active: true, parent_slug: 'home_maintenance', sort_order: 1 },
    { id: 2, name: 'Plumbing', slug: 'plumbing', is_active: true, parent_slug: 'home_maintenance', sort_order: 2 },
    { id: 3, name: 'Electrical', slug: 'electrical', is_active: true, parent_slug: 'home_maintenance', sort_order: 3 },
    { id: 4, name: 'Deep Cleaning', slug: 'deep_cleaning', is_active: true, parent_slug: 'cleaning', sort_order: 4 },
  ];
  const services: ContractorMetaItem[] = [
    { id: 1, name: 'AC Installation', slug: 'ac_installation', is_active: true, parent_slug: 'ac_services', sort_order: 1 },
    { id: 2, name: 'AC Repair', slug: 'ac_repair', is_active: true, parent_slug: 'ac_services', sort_order: 2 },
    { id: 3, name: 'Pipe Fixing', slug: 'pipe_fixing', is_active: true, parent_slug: 'plumbing', sort_order: 3 },
    { id: 4, name: 'Wiring Check', slug: 'wiring_check', is_active: true, parent_slug: 'electrical', sort_order: 4 },
  ];
  const emirates: ContractorMetaItem[] = [
    { id: 1, name: 'Abu Dhabi', slug: 'abu_dhabi', is_active: true, sort_order: 1 },
    { id: 2, name: 'Dubai', slug: 'dubai', is_active: true, sort_order: 2 },
    { id: 3, name: 'Sharjah', slug: 'sharjah', is_active: true, sort_order: 3 },
  ];
  const cities: ContractorMetaItem[] = [
    { id: 1, name: 'Abu Dhabi City', slug: 'abu_dhabi_city', is_active: true, parent_slug: 'abu_dhabi', sort_order: 1 },
    { id: 2, name: 'Al Ain', slug: 'al_ain', is_active: true, parent_slug: 'abu_dhabi', sort_order: 2 },
    { id: 3, name: 'Dubai', slug: 'dubai_city', is_active: true, parent_slug: 'dubai', sort_order: 3 },
    { id: 4, name: 'Jebel Ali', slug: 'jebel_ali', is_active: true, parent_slug: 'dubai', sort_order: 4 },
    { id: 5, name: 'Sharjah', slug: 'sharjah_city', is_active: true, parent_slug: 'sharjah', sort_order: 5 },
  ];
  const coverage_areas: ContractorMetaItem[] = [
    { id: 1, name: 'Downtown Zone', slug: 'downtown_zone', is_active: true, sort_order: 1 },
    { id: 2, name: 'Industrial Zone', slug: 'industrial_zone', is_active: true, sort_order: 2 },
    { id: 3, name: 'Residential North', slug: 'residential_north', is_active: true, sort_order: 3 },
    { id: 4, name: 'Residential South', slug: 'residential_south', is_active: true, sort_order: 4 },
  ];
  return {
    registration_enabled: true,
    main_categories,
    subcategories,
    services,
    emirates,
    cities,
    coverage_areas,
  };
}

async function readStore(): Promise<ContractorRegistrationStore> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = defaultStore();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw) as ContractorRegistrationStore;
    return {
      ...defaultStore(),
      ...parsed,
      main_categories: parsed.main_categories ?? [],
      subcategories: parsed.subcategories ?? [],
      services: parsed.services ?? [],
      emirates: parsed.emirates ?? [],
      cities: parsed.cities ?? [],
      coverage_areas: parsed.coverage_areas ?? [],
    };
  } catch {
    const seeded = defaultStore();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

async function writeStore(store: ContractorRegistrationStore): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function sortItems(items: ContractorMetaItem[]): ContractorMetaItem[] {
  return [...items].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.name.localeCompare(b.name));
}

function toSignupItem(item: ContractorMetaItem) {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    ...(item.parent_slug ? { parent_slug: item.parent_slug } : {}),
  };
}

export const contractorRegistrationMetaService = {
  async getStore(): Promise<ContractorRegistrationStore> {
    return readStore();
  },

  async setRegistrationEnabled(enabled: boolean): Promise<boolean> {
    const store = await readStore();
    store.registration_enabled = enabled;
    await writeStore(store);
    return enabled;
  },

  async list(entity: ContractorMetaEntity): Promise<ContractorMetaItem[]> {
    const store = await readStore();
    return sortItems(store[entity]);
  },

  async create(entity: ContractorMetaEntity, input: ContractorMetaInput): Promise<ContractorMetaItem> {
    const store = await readStore();
    const list = store[entity];
    const slug = (input.slug?.trim() || slugify(input.name)).toLowerCase();
    if (list.some((i) => i.slug === slug)) {
      throw new Error('An item with this slug already exists.');
    }
    const item: ContractorMetaItem = {
      id: nextId(list),
      name: input.name.trim(),
      slug,
      is_active: input.is_active ?? true,
      parent_slug: input.parent_slug?.trim() || undefined,
      sort_order: input.sort_order,
    };
    store[entity] = [...list, item];
    await writeStore(store);
    return item;
  },

  async update(
    entity: ContractorMetaEntity,
    id: number,
    input: ContractorMetaInput
  ): Promise<ContractorMetaItem> {
    const store = await readStore();
    const list = store[entity];
    const idx = list.findIndex((i) => i.id === id);
    if (idx < 0) throw new Error('Item not found.');
    const slug = (input.slug?.trim() || slugify(input.name)).toLowerCase();
    if (list.some((i) => i.slug === slug && i.id !== id)) {
      throw new Error('An item with this slug already exists.');
    }
    const updated: ContractorMetaItem = {
      ...list[idx],
      name: input.name.trim(),
      slug,
      is_active: input.is_active ?? list[idx].is_active,
      parent_slug: input.parent_slug?.trim() || undefined,
      sort_order: input.sort_order ?? list[idx].sort_order,
    };
    const next = [...list];
    next[idx] = updated;
    store[entity] = next;
    await writeStore(store);
    return updated;
  },

  async delete(entity: ContractorMetaEntity, id: number): Promise<void> {
    const store = await readStore();
    store[entity] = store[entity].filter((i) => i.id !== id);
    await writeStore(store);
  },

  async toggleActive(entity: ContractorMetaEntity, id: number): Promise<ContractorMetaItem | null> {
    const store = await readStore();
    const list = store[entity];
    const idx = list.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    const updated = { ...list[idx], is_active: !list[idx].is_active };
    const next = [...list];
    next[idx] = updated;
    store[entity] = next;
    await writeStore(store);
    return updated;
  },

  async getSignupOptions(): Promise<ContractorSignupOptions> {
    const store = await readStore();
    const active = (items: ContractorMetaItem[]) =>
      sortItems(items.filter((i) => i.is_active)).map(toSignupItem);

    return {
      registration_enabled: store.registration_enabled,
      main_categories: active(store.main_categories),
      subcategories: active(store.subcategories),
      services: active(store.services),
      emirates: active(store.emirates),
      cities: active(store.cities),
      coverage_areas: active(store.coverage_areas),
    };
  },

  getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  },
};
