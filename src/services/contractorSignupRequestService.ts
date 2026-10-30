import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ContractorSignupPayload,
  ContractorSignupRequest,
  ContractorSignupStatus,
  ContractorSignupStatusFilter,
} from '../types/contractorSignup';

const STORAGE_KEY = 'contractor_signup_requests_v1';

function buildDummyContractorRequests(): ContractorSignupRequest[] {
  const base = (daysAgo: number) =>
    new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

  const mk = (
    id: string,
    status: ContractorSignupStatus,
    company_name: string,
    name: string,
    email: string,
    phone: string,
    createdDaysAgo: number,
    extra?: Partial<ContractorSignupRequest>
  ): ContractorSignupRequest => ({
    id,
    name,
    email,
    phone,
    password: 'Demo1234!',
    password_confirmation: 'Demo1234!',
    company_name,
    trade_license_number: `TL-${id.slice(-4).toUpperCase()}-2024`,
    trade_license_expiry_date: '2027-12-31',
    trn: '100123456700003',
    company_emirate: 'dubai',
    city: 'Dubai',
    company_address: 'Business Bay, Dubai, UAE',
    bank_name: 'Emirates NBD',
    account_holder_name: company_name,
    bank_account_number: '1234567890',
    iban: 'AE070331234567890123456',
    main_service_categories: ['home_maintenance'],
    service_subcategories: ['ac_services'],
    selected_services: ['ac_repair'],
    coverage_emirates: ['dubai'],
    coverage_cities: ['dubai_city'],
    service_coverage_areas: ['downtown_zone'],
    trade_license_file_name: 'trade_license.pdf',
    bank_confirmation_file_name: 'bank_letter.pdf',
    status,
    status_label: statusLabel(status),
    created_at: base(createdDaysAgo),
    updated_at: base(createdDaysAgo),
    ...extra,
  });

  return [
    mk(
      'ctr_demo_pending_1',
      'pending',
      'Al Barsha Maintenance LLC',
      'Ahmed Al Mansoori',
      'ahmed.contractor@example.com',
      '+971501112233',
      1
    ),
    mk(
      'ctr_demo_pending_2',
      'pending',
      'Green Oasis Landscaping',
      'Sara Hassan',
      'sara.landscape@example.com',
      '+971502223344',
      3
    ),
    mk(
      'ctr_demo_active_1',
      'active',
      'CoolAir Technical Services',
      'Khalid Omar',
      'khalid.coolair@example.com',
      '+971503334455',
      14
    ),
    mk(
      'ctr_demo_inactive_1',
      'inactive',
      'Prime Cleaning Co.',
      'Fatima Ali',
      'fatima.clean@example.com',
      '+971504445566',
      30
    ),
    mk(
      'ctr_demo_suspended_1',
      'suspended',
      'FastFix Plumbing',
      'Rashid Khan',
      'rashid.fastfix@example.com',
      '+971505556677',
      7,
      { missing_documents_reason: 'Bank confirmation letter expired.' }
    ),
    mk(
      'ctr_demo_rejected_1',
      'rejected',
      'Demo Rejected Contracting',
      'John Demo',
      'rejected.demo@example.com',
      '+971506667788',
      5,
      { rejection_reason: 'Trade license document could not be verified.' }
    ),
  ];
}

async function ensureDemoSeedData(): Promise<ContractorSignupRequest[]> {
  const list = await readAll();
  if (list.length > 0) return list;
  const seeded = buildDummyContractorRequests();
  await writeAll(seeded);
  return seeded;
}

function statusLabel(status: ContractorSignupStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending approval';
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    case 'suspended':
      return 'Suspended';
    case 'rejected':
      return 'Rejected';
    default:
      return status;
  }
}

async function readAll(): Promise<ContractorSignupRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(list: ContractorSignupRequest[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function filterList(
  list: ContractorSignupRequest[],
  status: ContractorSignupStatusFilter
): ContractorSignupRequest[] {
  if (status === 'all') return list;
  return list.filter((r) => r.status === status);
}

function sortNewest(list: ContractorSignupRequest[]): ContractorSignupRequest[] {
  return [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export const contractorSignupRequestService = {
  async createRequest(params: ContractorSignupPayload): Promise<ContractorSignupRequest> {
    const list = await readAll();
    const now = new Date().toISOString();
    const entry: ContractorSignupRequest = {
      ...params,
      id: `ctr_${Date.now()}`,
      status: 'pending',
      status_label: statusLabel('pending'),
      created_at: now,
      updated_at: now,
    };
    list.unshift(entry);
    await writeAll(list);
    return entry;
  },

  async list(status: ContractorSignupStatusFilter = 'all'): Promise<ContractorSignupRequest[]> {
    const list = await ensureDemoSeedData();
    return sortNewest(filterList(list, status));
  },

  /** Inserts demo contractors when storage is empty (UI preview / QA). */
  async seedDemoDataIfEmpty(): Promise<number> {
    const before = await readAll();
    if (before.length > 0) return before.length;
    const seeded = buildDummyContractorRequests();
    await writeAll(seeded);
    return seeded.length;
  },

  async getStats(): Promise<{
    pending: number;
    active: number;
    inactive: number;
    suspended: number;
    rejected: number;
    total: number;
  }> {
    const list = await ensureDemoSeedData();
    return {
      pending: list.filter((r) => r.status === 'pending').length,
      active: list.filter((r) => r.status === 'active').length,
      inactive: list.filter((r) => r.status === 'inactive').length,
      suspended: list.filter((r) => r.status === 'suspended').length,
      rejected: list.filter((r) => r.status === 'rejected').length,
      total: list.length,
    };
  },

  async getById(id: string): Promise<ContractorSignupRequest | null> {
    const list = await readAll();
    return list.find((r) => r.id === id) ?? null;
  },

  async updateStatus(
    id: string,
    status: ContractorSignupStatus,
    extra?: { rejection_reason?: string; missing_documents_reason?: string }
  ): Promise<ContractorSignupRequest | null> {
    const list = await readAll();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const updated: ContractorSignupRequest = {
      ...list[idx],
      status,
      status_label: statusLabel(status),
      updated_at: new Date().toISOString(),
      ...extra,
    };
    list[idx] = updated;
    await writeAll(list);
    return updated;
  },

  async approve(id: string): Promise<ContractorSignupRequest | null> {
    return this.updateStatus(id, 'active');
  },

  async reject(id: string, reason: string): Promise<ContractorSignupRequest | null> {
    return this.updateStatus(id, 'rejected', { rejection_reason: reason.trim() || undefined });
  },

  async suspend(id: string, reason?: string): Promise<ContractorSignupRequest | null> {
    return this.updateStatus(id, 'suspended', {
      missing_documents_reason: reason?.trim() || undefined,
    });
  },

  async deactivate(id: string): Promise<ContractorSignupRequest | null> {
    return this.updateStatus(id, 'inactive');
  },

  async activate(id: string): Promise<ContractorSignupRequest | null> {
    return this.updateStatus(id, 'active');
  },

  async remove(id: string): Promise<boolean> {
    const list = await readAll();
    const next = list.filter((r) => r.id !== id);
    if (next.length === list.length) return false;
    await writeAll(next);
    return true;
  },
};
