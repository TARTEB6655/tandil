/**
 * Admin Loyalty Points service.
 * Real API:
 * - GET /admin/loyalty — control center dashboard
 * - PUT /admin/loyalty/toggle — enable/disable loyalty system
 * - GET/PUT /admin/loyalty/settings — loyalty system settings
 * Remaining methods still use mock until their APIs are wired.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { API_CONFIG } from '../config/api';
import apiClient from './api';
import type {
  AdminLoyaltyCampaign,
  AdminLoyaltyCampaignApi,
  AdminLoyaltyCampaignInput,
  AdminLoyaltyCampaignsListResponse,
  AdminLoyaltyControlCenter,
  AdminLoyaltyCustomer,
  AdminLoyaltyCustomerDetail,
  AdminLoyaltyEligibleActivitiesMap,
  AdminLoyaltyReportFilters,
  AdminLoyaltyReportExportResult,
  AdminLoyaltyLedgerItem,
  AdminLoyaltyReportSummary,
  LoyaltyReportExportFormat,
  AdminLoyaltyReward,
  AdminLoyaltyRewardApi,
  AdminLoyaltyRewardsListResponse,
  AdminLoyaltyRewardInput,
  AdminLoyaltySettings,
  AdminLoyaltySettingsApi,
  LoyaltyCampaignMultiplier,
  LoyaltyCustomerGroup,
  LoyaltyEligibleActivity,
} from '../types/adminLoyalty';

let nextRewardId = 3;
let nextCampaignId = 2;
let nextLedgerId = 10;

const defaultSettings: AdminLoyaltySettings = {
  enabled: true,
  points_per_aed: 1,
  eligible_activities: ['shop_orders', 'service_orders', 'memberships'],
  points_expire_after_months: 12,
  rewards_expire_after_months: 6,
  restrict_cities: [],
  restrict_customer_groups: ['all'],
  restrict_customer_ids: [],
  specific_customers: [],
  restrict_campaign_only: false,
};

let settings: AdminLoyaltySettings = {
  ...defaultSettings,
  eligible_activities: [...defaultSettings.eligible_activities],
  restrict_cities: [],
  restrict_customer_groups: [...defaultSettings.restrict_customer_groups],
  restrict_customer_ids: [],
  specific_customers: [],
};

let rewards: AdminLoyaltyReward[] = [
  {
    id: 1,
    title: 'AED 10 wallet credit',
    description: 'Redeem for AED 10 wallet credit',
    points_required: 500,
    is_active: true,
    expires_at: null,
    cities: [],
    customer_groups: ['all'],
    customer_ids: [],
    campaign_ids: [],
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-01-10T10:00:00Z',
  },
  {
    id: 2,
    title: 'Free delivery',
    description: 'One free delivery on shop orders',
    points_required: 300,
    is_active: true,
    expires_at: '2026-12-31',
    cities: ['Abu Dhabi', 'Dubai'],
    customer_groups: ['specific'],
    customer_ids: [101, 102],
    campaign_ids: [],
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-01T10:00:00Z',
  },
];

let campaigns: AdminLoyaltyCampaign[] = [
  {
    id: 1,
    title: 'Ramadan Double Points',
    multiplier: 2,
    starts_at: '2026-03-01',
    ends_at: '2026-03-31',
    is_active: true,
    cities: [],
    customer_groups: ['all'],
    customer_ids: [],
    eligible_activities: ['shop_orders', 'service_orders'],
    notes: 'Double points on all eligible orders',
  },
];

const customersSeed: AdminLoyaltyCustomerDetail[] = [
  {
    id: 101,
    name: 'Client One',
    email: 'client1@test.com',
    phone: '70000001',
    city: 'Abu Dhabi',
    group: 'specific',
    points_balance: 820,
    lifetime_earned: 1200,
    lifetime_redeemed: 380,
    last_activity_at: '2026-07-20T14:00:00Z',
    ledger: [
      { id: 1, type: 'earn', points: 150, reason: 'Shop order #1201', created_at: '2026-07-20T14:00:00Z', order_id: 1201 },
      { id: 2, type: 'redeem', points: -300, reason: 'Redeemed Free delivery', created_at: '2026-07-15T09:00:00Z' },
      { id: 3, type: 'adjust_add', points: 50, reason: 'Goodwill credit', created_at: '2026-07-10T11:00:00Z', admin_name: 'Admin' },
    ],
  },
  {
    id: 102,
    name: 'Sara Ahmed',
    email: 'sara@test.com',
    phone: '70000002',
    city: 'Dubai',
    group: 'specific',
    points_balance: 240,
    lifetime_earned: 240,
    lifetime_redeemed: 0,
    last_activity_at: '2026-07-18T08:30:00Z',
    ledger: [
      { id: 4, type: 'earn', points: 100, reason: 'Service order #88', created_at: '2026-07-18T08:30:00Z', order_id: 88 },
      { id: 5, type: 'earn', points: 140, reason: 'Shop order #1190', created_at: '2026-07-12T16:00:00Z', order_id: 1190 },
    ],
  },
  {
    id: 103,
    name: 'Omar Khan',
    email: 'omar@test.com',
    city: 'Sharjah',
    group: 'specific',
    points_balance: 0,
    lifetime_earned: 80,
    lifetime_redeemed: 80,
    last_activity_at: '2026-06-30T12:00:00Z',
    ledger: [
      { id: 6, type: 'earn', points: 80, reason: 'Shop order #1100', created_at: '2026-06-01T12:00:00Z', order_id: 1100 },
      { id: 7, type: 'redeem', points: -80, reason: 'Partial reward', created_at: '2026-06-30T12:00:00Z' },
    ],
  },
];

let customers: AdminLoyaltyCustomerDetail[] = customersSeed.map((c) => ({
  ...c,
  ledger: [...c.ledger],
}));

function delay(ms = 250) {
  return new Promise((r) => setTimeout(r, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function uniqueNumberList(values: number[] = []): number[] {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value) && value > 0)));
}

function normalizeCustomerTarget(groups: ('all' | 'specific')[] = ['all'], customerIds: number[] = []) {
  const ids = uniqueNumberList(customerIds);
  if (groups.includes('specific') && ids.length > 0) {
    return {
      groups: ['specific'] as ('specific')[],
      customer_ids: ids,
    };
  }
  return {
    groups: ['all'] as ('all')[],
    customer_ids: [] as number[],
  };
}

function buildLoyaltyReportQuery(
  filters?: AdminLoyaltyReportFilters,
  format?: LoyaltyReportExportFormat
): string {
  const parts: string[] = [];
  const scope = filters?.customer_scope || 'all';
  const periodApi =
    filters?.period === 'custom' ? 'specific' : filters?.period || 'month';

  parts.push(`customer_scope=${encodeURIComponent(scope)}`);
  parts.push(`period=${encodeURIComponent(periodApi)}`);

  if (scope === 'specific' && filters?.customer_ids?.length) {
    filters.customer_ids.forEach((id) => {
      parts.push(`specific_customer_ids[]=${encodeURIComponent(String(id))}`);
    });
  }

  if (periodApi === 'specific') {
    if (filters?.from_date) {
      parts.push(`date_from=${encodeURIComponent(filters.from_date)}`);
    }
    if (filters?.to_date) {
      parts.push(`date_to=${encodeURIComponent(filters.to_date)}`);
    }
  }

  if (format) {
    parts.push(`format=${encodeURIComponent(format)}`);
  }

  return parts.join('&');
}

function mapReportSummaryApi(data: any): AdminLoyaltyReportSummary {
  const src = data && typeof data === 'object' ? data : {};
  const nested = src.summary && typeof src.summary === 'object' ? src.summary : src;

  return {
    total_customers_with_points: Number(
      nested.total_customers_with_points ??
        nested.customers_with_points ??
        nested.customers ??
        0
    ),
    total_points_outstanding: Number(
      nested.total_points_outstanding ?? nested.points_outstanding ?? nested.outstanding ?? 0
    ),
    points_earned_period: Number(
      nested.points_earned_period ?? nested.points_earned ?? nested.earned ?? 0
    ),
    points_redeemed_period: Number(
      nested.points_redeemed_period ?? nested.points_redeemed ?? nested.redeemed ?? 0
    ),
    rewards_redeemed_count: Number(
      nested.rewards_redeemed_count ?? nested.rewards_redeemed ?? nested.rewards ?? 0
    ),
    active_campaigns: Number(
      nested.active_campaigns ?? nested.live_campaigns ?? nested.campaigns ?? 0
    ),
  };
}

function activitiesMapToList(
  map?: AdminLoyaltyEligibleActivitiesMap | null
): LoyaltyEligibleActivity[] {
  if (!map || typeof map !== 'object') return [];
  return (Object.keys(map) as LoyaltyEligibleActivity[]).filter((key) => !!map[key]);
}

function activitiesListToMap(
  list: LoyaltyEligibleActivity[]
): AdminLoyaltyEligibleActivitiesMap {
  return {
    shop_orders: list.includes('shop_orders'),
    service_orders: list.includes('service_orders'),
    memberships: list.includes('memberships'),
    referrals: list.includes('referrals'),
    reviews: list.includes('reviews'),
  };
}

function parseCitiesString(raw?: string | null): string[] {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapCampaignApiToUi(c: AdminLoyaltyCampaignApi): AdminLoyaltyCampaign {
  const targeting: LoyaltyCustomerGroup =
    c.customer_targeting === 'specific' ? 'specific' : 'all';
  const multiplier = (Number(c.multiplier) === 3 ? 3 : 2) as LoyaltyCampaignMultiplier;
  const citiesList = parseCitiesString(c.cities);

  return {
    id: Number(c.id),
    title: String(c.title || ''),
    multiplier,
    boost_label: c.boost_label ? String(c.boost_label) : undefined,
    starts_at: String(c.start_date || ''),
    ends_at: String(c.end_date || ''),
    date_range: c.date_range ? String(c.date_range) : undefined,
    is_active: !!c.is_enabled,
    status: c.status ? String(c.status) : undefined,
    cities: citiesList,
    cities_label: c.cities ? String(c.cities) : undefined,
    customer_targeting: targeting,
    customer_targeting_label: c.customer_targeting_label
      ? String(c.customer_targeting_label)
      : undefined,
    customer_groups: [targeting],
    customer_ids: Array.isArray(c.specific_customer_ids)
      ? c.specific_customer_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [],
    specific_customers: Array.isArray(c.specific_customers)
      ? c.specific_customers.map((n) => String(n))
      : [],
    eligible_activities: activitiesMapToList(c.eligible_activities),
    notes: c.notes ? String(c.notes) : undefined,
  };
}

function mapSettingsApiToUi(data: Partial<AdminLoyaltySettingsApi>): AdminLoyaltySettings {
  const targeting: LoyaltyCustomerGroup =
    data.customer_targeting === 'specific' ? 'specific' : 'all';
  const ids = Array.isArray(data.specific_customer_ids)
    ? data.specific_customer_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : [];
  const names = Array.isArray(data.specific_customers) ? data.specific_customers : [];
  const specificCustomers = ids.map((id, index) => ({
    id,
    name: String(names[index] || `Customer #${id}`),
  }));

  return {
    enabled: !!data.loyalty_system_enabled,
    points_per_aed: Number(data.points_per_aed ?? 0),
    eligible_activities: activitiesMapToList(data.eligible_activities),
    points_expire_after_months:
      data.points_expiry_months == null || Number.isNaN(Number(data.points_expiry_months))
        ? null
        : Number(data.points_expiry_months),
    rewards_expire_after_months:
      data.rewards_expiry_months == null || Number.isNaN(Number(data.rewards_expiry_months))
        ? null
        : Number(data.rewards_expiry_months),
    restrict_cities: parseCitiesString(data.cities),
    restrict_customer_groups: [targeting],
    restrict_customer_ids: targeting === 'specific' ? ids : [],
    specific_customers: targeting === 'specific' ? specificCustomers : [],
    restrict_campaign_only: !!data.campaign_periods_only,
    status: data.status ? String(data.status) : undefined,
  };
}

function mapSettingsUiToApi(input: AdminLoyaltySettings): AdminLoyaltySettingsApi {
  const targeting: LoyaltyCustomerGroup = input.restrict_customer_groups.includes('specific')
    ? 'specific'
    : 'all';
  const specificIds =
    targeting === 'specific'
      ? uniqueNumberList(input.restrict_customer_ids)
      : [];

  return {
    loyalty_system_enabled: !!input.enabled,
    points_per_aed: Number(input.points_per_aed),
    eligible_activities: activitiesListToMap(input.eligible_activities),
    points_expiry_months: input.points_expire_after_months,
    rewards_expiry_months: input.rewards_expire_after_months,
    cities: input.restrict_cities.join(', '),
    customer_targeting: targeting,
    specific_customer_ids: specificIds,
    campaign_periods_only: !!input.restrict_campaign_only,
  };
}

export const adminLoyaltyService = {
  /** GET /admin/loyalty — Loyalty control center dashboard */
  async getControlCenter(): Promise<AdminLoyaltyControlCenter> {
    const response = await apiClient.get<{
      success?: boolean;
      message?: string;
      data?: Partial<AdminLoyaltyControlCenter> | null;
    }>('/admin/loyalty');

    const body = response.data;
    const data = body?.data;
    if (!data) {
      throw new Error(body?.message || 'Failed to load loyalty control center.');
    }

    return {
      loyalty_system_enabled: !!data.loyalty_system_enabled,
      status: String(data.status ?? (data.loyalty_system_enabled ? 'Active' : 'Paused')),
      status_label: String(
        data.status_label ??
          (data.loyalty_system_enabled
            ? 'Active - customers can earn and redeem'
            : 'Disabled - earning and redeeming paused')
      ),
      points_per_aed: Number(data.points_per_aed ?? 0),
      activities: Number(data.activities ?? 0),
      expiry_months:
        data.expiry_months == null || Number.isNaN(Number(data.expiry_months))
          ? null
          : Number(data.expiry_months),
    };
  },

  /** PUT /admin/loyalty/toggle — enable or disable loyalty system */
  async toggleLoyaltySystem(loyaltySystemEnabled: boolean): Promise<AdminLoyaltyControlCenter> {
    await apiClient.put<{
      success?: boolean;
      message?: string;
      data?: Partial<AdminLoyaltyControlCenter> | null;
    }>('/admin/loyalty/toggle', {
      loyalty_system_enabled: loyaltySystemEnabled,
    });

    // Refresh control center so status + stats stay in sync with backend.
    return this.getControlCenter();
  },

  /** GET /admin/loyalty/settings */
  async getSettings(): Promise<AdminLoyaltySettings> {
    const response = await apiClient.get<{
      success?: boolean;
      message?: string;
      data?: Partial<AdminLoyaltySettingsApi> | null;
    }>('/admin/loyalty/settings');

    const body = response.data;
    const data = body?.data;
    if (!data) {
      throw new Error(body?.message || 'Failed to load loyalty settings.');
    }

    const mapped = mapSettingsApiToUi(data);
    settings = {
      ...mapped,
      eligible_activities: [...mapped.eligible_activities],
      restrict_cities: [...mapped.restrict_cities],
      restrict_customer_groups: [...mapped.restrict_customer_groups],
      restrict_customer_ids: [...mapped.restrict_customer_ids],
      specific_customers: [...mapped.specific_customers],
    };
    return {
      ...settings,
      eligible_activities: [...settings.eligible_activities],
      restrict_cities: [...settings.restrict_cities],
      restrict_customer_groups: [...settings.restrict_customer_groups],
      restrict_customer_ids: [...settings.restrict_customer_ids],
      specific_customers: [...settings.specific_customers],
    };
  },

  /** PUT /admin/loyalty/settings */
  async updateSettings(patch: Partial<AdminLoyaltySettings>): Promise<AdminLoyaltySettings> {
    const targeting = normalizeCustomerTarget(
      patch.restrict_customer_groups ?? settings.restrict_customer_groups,
      patch.restrict_customer_ids ?? settings.restrict_customer_ids
    );

    const nextLocal: AdminLoyaltySettings = {
      ...settings,
      ...patch,
      eligible_activities: patch.eligible_activities
        ? [...patch.eligible_activities]
        : [...settings.eligible_activities],
      restrict_cities: patch.restrict_cities
        ? [...patch.restrict_cities]
        : [...settings.restrict_cities],
      restrict_customer_groups: [...targeting.groups],
      restrict_customer_ids: [...targeting.customer_ids],
      specific_customers:
        targeting.groups[0] === 'specific'
          ? (patch.specific_customers
              ? [...patch.specific_customers]
              : settings.specific_customers.filter((c) =>
                  targeting.customer_ids.includes(c.id)
                ))
          : [],
    };

    const payload = mapSettingsUiToApi(nextLocal);
    const response = await apiClient.put<{
      success?: boolean;
      message?: string;
      data?: Partial<AdminLoyaltySettingsApi> | null;
    }>('/admin/loyalty/settings', payload);

    const body = response.data;
    if (body?.data) {
      return mapSettingsApiToUi(body.data);
    }

    // Backend may return message only — re-fetch canonical settings.
    return this.getSettings();
  },

  /** GET /admin/loyalty/rewards — returns summary + rewards list */
  async listRewards(): Promise<AdminLoyaltyReward[]> {
    const response = await apiClient.get<{
      success?: boolean;
      message?: string;
      data?: AdminLoyaltyRewardsListResponse | null;
    }>('/admin/loyalty/rewards');

    const body = response.data;
    const data = body?.data;
    if (!data?.rewards) {
      throw new Error(body?.message || 'Failed to load rewards.');
    }

    return data.rewards.map((r: AdminLoyaltyRewardApi): AdminLoyaltyReward => ({
      id: r.id,
      title: r.title,
      description: r.description,
      points_required: r.points_required,
      points_label: r.points_label,
      is_active: r.is_active,
      status: r.status,
      expires_at: r.expires_at,
      cities: r.cities,
      customer_targeting: r.customer_targeting,
      customer_targeting_label: r.customer_targeting_label,
      specific_customer_ids: r.specific_customer_ids,
      specific_customers: r.specific_customers,
      // backwards-compat fields for form/edit
      customer_groups: [r.customer_targeting],
      customer_ids: r.specific_customer_ids,
      campaign_ids: [],
    }));
  },

  /** GET /admin/loyalty/customers — also returns summary stats */
  async listCustomersSummary(): Promise<{ visible: number; points_pool: number; holders: number }> {
    try {
      const response = await apiClient.get<{
        data?: { summary?: { visible?: number; points_pool?: number; holders?: number } };
      }>('/admin/loyalty/customers', { timeout: 20000 });
      const s = response.data?.data?.summary;
      return {
        visible: Number(s?.visible ?? 0),
        points_pool: Number(s?.points_pool ?? 0),
        holders: Number(s?.holders ?? 0),
      };
    } catch {
      return { visible: 0, points_pool: 0, holders: 0 };
    }
  },

  /** GET /admin/loyalty/rewards — also returns summary stats */
  async listRewardsSummary(): Promise<AdminLoyaltyRewardsListResponse['summary']> {
    const response = await apiClient.get<{
      success?: boolean;
      data?: AdminLoyaltyRewardsListResponse | null;
    }>('/admin/loyalty/rewards');
    const summary = response.data?.data?.summary;
    return summary ?? { total: 0, active: 0, starts_at: 0 };
  },

  /** POST /admin/loyalty/rewards */
  async createReward(input: AdminLoyaltyRewardInput): Promise<AdminLoyaltyReward> {
    const targeting = (input.customer_groups ?? ['all'])[0] === 'specific' ? 'specific' : 'all';
    const body = {
      title: input.title,
      description: input.description,
      points_required: input.points_required,
      is_active: input.is_active,
      expires_at: input.expires_at,
      cities: Array.isArray(input.cities) ? input.cities.join(', ') : input.cities,
      customer_targeting: targeting,
      specific_customer_ids: targeting === 'specific' ? (input.customer_ids ?? []) : [],
    };
    const response = await apiClient.post<{
      success?: boolean;
      message?: string;
      data?: AdminLoyaltyRewardApi | null;
    }>('/admin/loyalty/rewards', body);
    const data = response.data?.data;
    if (!data) throw new Error(response.data?.message || 'Failed to create reward.');
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      points_required: data.points_required,
      points_label: data.points_label,
      is_active: data.is_active,
      status: data.status,
      expires_at: data.expires_at,
      cities: data.cities,
      customer_targeting: data.customer_targeting,
      customer_targeting_label: data.customer_targeting_label,
      specific_customer_ids: data.specific_customer_ids,
      specific_customers: data.specific_customers,
      customer_groups: [data.customer_targeting],
      customer_ids: data.specific_customer_ids,
      campaign_ids: [],
    };
  },

  /** POST /admin/loyalty/rewards/:id/toggle */
  async toggleReward(id: number, is_active: boolean): Promise<void> {
    const response = await apiClient.post<{ success?: boolean; message?: string }>(
      `/admin/loyalty/rewards/${id}/toggle`,
      { is_active }
    );
    if (response.data?.success === false) {
      throw new Error(response.data?.message || 'Failed to toggle reward.');
    }
  },

  /** PUT /admin/loyalty/rewards/:id */
  async updateReward(id: number, input: Partial<AdminLoyaltyRewardInput>): Promise<AdminLoyaltyReward | null> {
    const targeting = input.customer_groups
      ? ((input.customer_groups)[0] === 'specific' ? 'specific' : 'all')
      : undefined;
    const body: Record<string, unknown> = {};
    if (input.title !== undefined) body.title = input.title;
    if (input.description !== undefined) body.description = input.description;
    if (input.points_required !== undefined) body.points_required = input.points_required;
    if (input.is_active !== undefined) body.is_active = input.is_active;
    if (input.expires_at !== undefined) body.expires_at = input.expires_at;
    if (input.cities !== undefined)
      body.cities = Array.isArray(input.cities) ? input.cities.join(', ') : input.cities;
    if (targeting !== undefined) {
      body.customer_targeting = targeting;
      body.specific_customer_ids = targeting === 'specific' ? (input.customer_ids ?? []) : [];
    }

    const response = await apiClient.put<{
      success?: boolean;
      message?: string;
      data?: AdminLoyaltyRewardApi | null;
    }>(`/admin/loyalty/rewards/${id}`, body);
    const data = response.data?.data;
    if (!data) throw new Error(response.data?.message || 'Failed to update reward.');
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      points_required: data.points_required,
      points_label: data.points_label,
      is_active: data.is_active,
      status: data.status,
      expires_at: data.expires_at,
      cities: data.cities,
      customer_targeting: data.customer_targeting,
      customer_targeting_label: data.customer_targeting_label,
      specific_customer_ids: data.specific_customer_ids,
      specific_customers: data.specific_customers,
      customer_groups: [data.customer_targeting],
      customer_ids: data.specific_customer_ids,
      campaign_ids: [],
    };
  },

  /** DELETE /admin/loyalty/rewards/:id */
  async deleteReward(id: number): Promise<boolean> {
    const response = await apiClient.delete<{
      success?: boolean;
      message?: string;
    }>(`/admin/loyalty/rewards/${id}`);
    if (!response.data?.success) throw new Error(response.data?.message || 'Failed to delete reward.');
    return true;
  },

  /** GET /admin/loyalty/campaigns — returns summary + campaigns list */
  async listCampaigns(): Promise<AdminLoyaltyCampaign[]> {
    const response = await apiClient.get<{
      success?: boolean;
      message?: string;
      data?: AdminLoyaltyCampaignsListResponse | null;
    }>('/admin/loyalty/campaigns');

    const body = response.data;
    const data = body?.data;
    if (!data?.campaigns) {
      throw new Error(body?.message || 'Failed to load campaigns.');
    }

    return data.campaigns.map(mapCampaignApiToUi);
  },

  /** GET /admin/loyalty/campaigns — also returns summary stats */
  async listCampaignsSummary(): Promise<AdminLoyaltyCampaignsListResponse['summary']> {
    const response = await apiClient.get<{
      success?: boolean;
      data?: AdminLoyaltyCampaignsListResponse | null;
    }>('/admin/loyalty/campaigns');
    const summary = response.data?.data?.summary;
    return summary ?? { total: 0, live: 0, top_boost: '0x' };
  },

  /** POST /admin/loyalty/campaigns */
  async createCampaign(input: AdminLoyaltyCampaignInput): Promise<AdminLoyaltyCampaign> {
    const targeting = (input.customer_groups ?? ['all'])[0] === 'specific' ? 'specific' : 'all';
    const body = {
      title: input.title,
      multiplier: input.multiplier,
      start_date: input.starts_at,
      end_date: input.ends_at,
      cities: Array.isArray(input.cities) ? input.cities.join(', ') : String(input.cities || ''),
      customer_targeting: targeting,
      specific_customer_ids: targeting === 'specific' ? (input.customer_ids ?? []) : [],
      eligible_activities: activitiesListToMap(input.eligible_activities ?? []),
      notes: input.notes?.trim() || '',
      is_enabled: !!input.is_active,
    };

    const response = await apiClient.post<{
      success?: boolean;
      message?: string;
      data?: AdminLoyaltyCampaignApi | null;
    }>('/admin/loyalty/campaigns', body);

    const data = response.data?.data;
    if (data) {
      return mapCampaignApiToUi(data);
    }

    // Backend may return success without full campaign object
    if (response.data?.success === false) {
      throw new Error(response.data?.message || 'Failed to create campaign.');
    }

    // Re-fetch list and return newest matching title as fallback
    const list = await this.listCampaigns();
    const created = list.find((c) => c.title === input.title);
    if (created) return created;

    throw new Error(response.data?.message || 'Failed to create campaign.');
  },

  /** PUT /admin/loyalty/campaigns/:id */
  async updateCampaign(
    id: number,
    input: Partial<AdminLoyaltyCampaignInput>
  ): Promise<AdminLoyaltyCampaign | null> {
    const targeting = input.customer_groups
      ? input.customer_groups[0] === 'specific'
        ? 'specific'
        : 'all'
      : undefined;

    const body: Record<string, unknown> = {};
    if (input.title !== undefined) body.title = input.title;
    if (input.multiplier !== undefined) body.multiplier = input.multiplier;
    if (input.starts_at !== undefined) body.start_date = input.starts_at;
    if (input.ends_at !== undefined) body.end_date = input.ends_at;
    if (input.cities !== undefined) {
      body.cities = Array.isArray(input.cities)
        ? input.cities.join(', ')
        : String(input.cities || '');
    }
    if (targeting !== undefined) {
      body.customer_targeting = targeting;
      body.specific_customer_ids =
        targeting === 'specific' ? (input.customer_ids ?? []) : [];
    } else if (input.customer_ids !== undefined) {
      body.specific_customer_ids = input.customer_ids;
    }
    if (input.eligible_activities !== undefined) {
      body.eligible_activities = activitiesListToMap(input.eligible_activities);
    }
    if (input.notes !== undefined) body.notes = input.notes?.trim() || '';
    if (input.is_active !== undefined) body.is_enabled = !!input.is_active;

    const response = await apiClient.put<{
      success?: boolean;
      message?: string;
      data?: AdminLoyaltyCampaignApi | null;
    }>(`/admin/loyalty/campaigns/${id}`, body);

    const data = response.data?.data;
    if (data) {
      return mapCampaignApiToUi(data);
    }

    if (response.data?.success === false) {
      throw new Error(response.data?.message || 'Failed to update campaign.');
    }

    // Re-fetch list and return updated campaign
    const list = await this.listCampaigns();
    return list.find((c) => c.id === id) ?? null;
  },

  /** POST /admin/loyalty/campaigns/:id/toggle */
  async toggleCampaign(id: number, is_enabled: boolean): Promise<void> {
    const response = await apiClient.post<{ success?: boolean; message?: string }>(
      `/admin/loyalty/campaigns/${id}/toggle`,
      { is_enabled }
    );
    if (response.data?.success === false) {
      throw new Error(response.data?.message || 'Failed to toggle campaign.');
    }
  },

  /** DELETE /admin/loyalty/campaigns/:id */
  async deleteCampaign(id: number): Promise<boolean> {
    const response = await apiClient.delete<{
      success?: boolean;
      message?: string;
    }>(`/admin/loyalty/campaigns/${id}`);
    if (response.data?.success === false) {
      throw new Error(response.data?.message || 'Failed to delete campaign.');
    }
    return true;
  },

  async listCustomers(q?: string): Promise<AdminLoyaltyCustomer[]> {
    const query = (q || '').trim();

    try {
      const response = await apiClient.get<{
        success?: boolean;
        message?: string;
        data?: {
          summary?: { visible?: number; points_pool?: number; holders?: number };
          customers?: any[];
        };
      }>('/admin/loyalty/customers', {
        params: query ? { search: query } : undefined,
        timeout: 20000,
      });

      const list = response.data?.data?.customers;
      if (Array.isArray(list)) {
        return list
          .filter((u: any) => u && Number.isFinite(Number(u.id)) && Number(u.id) > 0)
          .map((u: any): AdminLoyaltyCustomer => ({
            id: Number(u.id),
            name: String(u.name || `Customer #${u.id}`),
            email: String(u.email || ''),
            phone: u.phone ? String(u.phone) : undefined,
            city: u.city && u.city !== '—' ? String(u.city) : undefined,
            group: 'specific',
            points_balance: Number(u.points ?? u.points_balance ?? 0),
            lifetime_earned: Number(u.lifetime_earned ?? 0),
            lifetime_redeemed: Number(u.lifetime_redeemed ?? 0),
            last_activity_at: String(u.updated_at || u.created_at || nowIso()),
            profile_picture_url: u.profile_picture_url
              ? String(u.profile_picture_url)
              : null,
          }));
      }
    } catch {
      // fall through to mock
    }

    // Fallback: local mock seed
    const lq = query.toLowerCase();
    await delay();
    return customers
      .filter((c) => {
        if (!lq) return true;
        return (
          c.name.toLowerCase().includes(lq) ||
          c.email.toLowerCase().includes(lq) ||
          (c.phone || '').includes(lq)
        );
      })
      .map(({ ledger: _l, ...rest }) => ({ ...rest }));
  },

  async getCustomerDetail(userId: number): Promise<AdminLoyaltyCustomerDetail | null> {
    try {
      // Try real API first: GET /admin/loyalty/customers/:id
      const response = await apiClient.get<{
        success?: boolean;
        message?: string;
        data?: any;
      }>(`/admin/loyalty/customers/${userId}`);

      const data = response.data?.data;
      if (data) {
        const id = Number(data.id ?? data.user_id ?? userId);

        const parsePointsDisplay = (raw?: any): number => {
          if (raw == null) return 0;
          const s = String(raw);
          // Examples: "+50", "-300", "50"
          const m = s.match(/[-+]?\d+/);
          return m ? Number(m[0]) : 0;
        };

        // New API shape: { name, email, city, balance, earned, redeemed, history: [...] }
        if (Array.isArray(data.history)) {
          const ledger: AdminLoyaltyLedgerItem[] = data.history.map((h: any, idx: number) => ({
            id: Number(h.id ?? idx),
            type: String(h.type ?? 'earn') as any,
            points: parsePointsDisplay(h.points_display),
            reason: String(h.title ?? h.type_label ?? h.note ?? ''),
            created_at: String(h.datetime ?? nowIso()),
            admin_name: undefined,
          }));

          return {
            id,
            name: String(data.name ?? data.full_name ?? `Customer #${id}`),
            email: String(data.email ?? ''),
            phone: data.phone ? String(data.phone) : undefined,
            city: data.city ? String(data.city) : undefined,
            group: 'specific',
            points_balance: Number(data.balance ?? data.points_balance ?? data.loyalty_points ?? 0),
            lifetime_earned: Number(data.earned ?? data.lifetime_earned ?? 0),
            lifetime_redeemed: Number(data.redeemed ?? data.lifetime_redeemed ?? 0),
            last_activity_at: String(data.last_activity_at ?? data.updated_at ?? nowIso()),
            profile_picture_url: data.profile_picture_url
              ? String(data.profile_picture_url)
              : null,
            ledger: ledger.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
          };
        }

        // Older API shape: { ledger: [...] } or { transactions: [...] }
        const ledgerRaw: any[] = Array.isArray(data.ledger)
          ? data.ledger
          : Array.isArray(data.transactions)
            ? data.transactions
            : [];

        if (ledgerRaw.length) {
          const ledger: AdminLoyaltyLedgerItem[] = ledgerRaw.map((item: any, idx: number) => ({
            id: Number(item.id ?? idx),
            type: String(item.type ?? 'earn') as any,
            points: Number(item.points ?? item.amount ?? 0),
            reason: String(item.reason ?? item.note ?? item.description ?? ''),
            created_at: String(item.created_at ?? nowIso()),
            order_id: item.order_id ? Number(item.order_id) : undefined,
            admin_name: item.admin_name ? String(item.admin_name) : undefined,
          }));

          return {
            id,
            name: String(data.name ?? data.full_name ?? `Customer #${id}`),
            email: String(data.email ?? ''),
            phone: data.phone ? String(data.phone) : undefined,
            city: data.city ? String(data.city) : undefined,
            group: 'specific',
            points_balance: Number(data.points_balance ?? data.loyalty_points ?? 0),
            lifetime_earned: Number(data.lifetime_earned ?? data.earned ?? 0),
            lifetime_redeemed: Number(data.lifetime_redeemed ?? data.redeemed ?? 0),
            last_activity_at: String(data.last_activity_at ?? data.updated_at ?? nowIso()),
            profile_picture_url: data.profile_picture_url
              ? String(data.profile_picture_url)
              : null,
            ledger: ledger.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
          };
        }
      }
    } catch {
      // API not available — fall through to user profile + mock ledger
    }

    // Fallback: build detail from admin users API (always returns real customers)
    try {
      const userResp = await apiClient.get<{ success?: boolean; data?: any }>(
        `/admin/users/${userId}`
      );
      const u = userResp.data?.data ?? userResp.data;
      if (u && (u.id || u.user_id)) {
        const id = Number(u.id ?? u.user_id);
        return {
          id,
          name: String(u.name ?? u.full_name ?? `Customer #${id}`),
          email: String(u.email ?? ''),
          phone: u.phone ? String(u.phone) : undefined,
          city: u.city ? String(u.city) : undefined,
          group: 'specific',
          points_balance: Number(u.points_balance ?? u.loyalty_points ?? 0),
          lifetime_earned: Number(u.lifetime_earned ?? 0),
          lifetime_redeemed: Number(u.lifetime_redeemed ?? 0),
          last_activity_at: String(u.updated_at ?? u.created_at ?? nowIso()),
          profile_picture_url: u.profile_picture_url
            ? String(u.profile_picture_url)
            : null,
          ledger: [],
        };
      }
    } catch {
      // fall through to local mock
    }

    // Last resort: local mock seed
    const c = customers.find((x) => x.id === userId);
    if (!c) return null;
    return {
      ...c,
      ledger: [...c.ledger].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    };
  },

  async adjustCustomerPoints(
    userId: number,
    points: number,
    reason: string
  ): Promise<AdminLoyaltyCustomerDetail | null> {
    const delta = Math.trunc(points);
    if (!delta) return this.getCustomerDetail(userId);

    // Try real API first
    try {
      await apiClient.post(`/admin/loyalty/customers/${userId}/adjust`, {
        // Backend expects `amount` (positive credit, negative deduct)
        amount: delta,
        reason: reason.trim() || (delta > 0 ? 'Manual credit' : 'Manual deduction'),
      });
      return this.getCustomerDetail(userId);
    } catch {
      // fall through to mock
    }

    // Fallback: update local mock seed
    const idx = customers.findIndex((c) => c.id === userId);
    if (idx < 0) {
      // customer from real API — refresh detail without local mutation
      return this.getCustomerDetail(userId);
    }
    const c = customers[idx];
    const type = delta > 0 ? 'adjust_add' : 'adjust_deduct';
    const entry: AdminLoyaltyLedgerItem = {
      id: nextLedgerId++,
      type,
      points: delta,
      reason: reason.trim() || (delta > 0 ? 'Manual credit' : 'Manual deduction'),
      created_at: nowIso(),
      admin_name: 'Admin',
    };

    const nextBalance = Math.max(0, c.points_balance + delta);
    const applied = nextBalance - c.points_balance;
    entry.points = applied;

    customers[idx] = {
      ...c,
      points_balance: nextBalance,
      lifetime_earned: delta > 0 ? c.lifetime_earned + applied : c.lifetime_earned,
      lifetime_redeemed: delta < 0 ? c.lifetime_redeemed + Math.abs(applied) : c.lifetime_redeemed,
      last_activity_at: nowIso(),
      ledger: [entry, ...c.ledger],
    };
    return this.getCustomerDetail(userId);
  },

  /** GET /admin/loyalty/reports — apply filters */
  async getReportSummary(filters?: AdminLoyaltyReportFilters): Promise<AdminLoyaltyReportSummary> {
    const query = buildLoyaltyReportQuery(filters);
    const response = await apiClient.get<{
      success?: boolean;
      message?: string;
      data?: any;
    }>(`/admin/loyalty/reports?${query}`);

    const body = response.data;
    if (body?.success === false) {
      throw new Error(body?.message || 'Failed to load loyalty reports.');
    }

    const data = body?.data ?? body;
    if (!data) {
      throw new Error(body?.message || 'Failed to load loyalty reports.');
    }

    return mapReportSummaryApi(data);
  },

  /**
   * GET /admin/loyalty/export
   * Downloads report file (pdf | csv | json). Default format: pdf.
   */
  async exportReport(
    filters?: AdminLoyaltyReportFilters,
    format: LoyaltyReportExportFormat = 'pdf'
  ): Promise<AdminLoyaltyReportExportResult> {
    const query = buildLoyaltyReportQuery(filters, format);
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Please login again.');
    }

    const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'pdf';
    const mimeType =
      format === 'json'
        ? 'application/json'
        : format === 'csv'
          ? 'text/csv'
          : 'application/pdf';
    const fileName = `loyalty-report-${Date.now()}.${ext}`;
    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!cacheDir) {
      throw new Error('Unable to access device storage for export.');
    }
    const fileUri = `${cacheDir}${fileName}`;
    const downloadUrl = `${API_CONFIG.baseURL}/admin/loyalty/export?${query}`;

    const result = await FileSystem.downloadAsync(downloadUrl, fileUri, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: format === 'pdf' ? 'application/pdf' : 'application/json',
      },
    });

    if (result.status < 200 || result.status >= 300) {
      throw new Error('Failed to export loyalty report.');
    }

    return {
      uri: result.uri,
      mimeType,
      fileName,
    };
  },

  /** @deprecated Prefer exportReport(filters, 'csv') */
  async exportReportCsv(filters?: AdminLoyaltyReportFilters): Promise<string> {
    const exported = await this.exportReport(filters, 'csv');
    return FileSystem.readAsStringAsync(exported.uri);
  },
};
