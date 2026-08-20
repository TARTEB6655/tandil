/**
 * Admin Loyalty Points — types for configurable loyalty system.
 * Dashboard control center uses real GET /admin/loyalty; other screens still mock until wired.
 */

export type LoyaltyEligibleActivity =
  | 'shop_orders'
  | 'service_orders'
  | 'memberships'
  | 'referrals'
  | 'reviews';

export type LoyaltyCustomerGroup = 'all' | 'specific';

export type LoyaltyCampaignMultiplier = 2 | 3;

/** GET /admin/loyalty — Loyalty control center dashboard */
export interface AdminLoyaltyControlCenter {
  loyalty_system_enabled: boolean;
  status: string;
  status_label: string;
  points_per_aed: number;
  activities: number;
  expiry_months: number | null;
}

/** Eligible activities as returned/sent by loyalty settings API */
export type AdminLoyaltyEligibleActivitiesMap = Partial<
  Record<LoyaltyEligibleActivity, boolean>
>;

/** GET/PUT /admin/loyalty/settings — API payload shape */
export interface AdminLoyaltySettingsApi {
  loyalty_system_enabled: boolean;
  points_per_aed: number;
  eligible_activities: AdminLoyaltyEligibleActivitiesMap;
  points_expiry_months: number | null;
  rewards_expiry_months: number | null;
  cities: string;
  customer_targeting: LoyaltyCustomerGroup;
  customer_targeting_label?: string;
  specific_customer_ids: number[];
  specific_customers?: string[];
  campaign_periods_only: boolean;
  activities_selected?: number;
  status?: string;
}

export interface AdminLoyaltySettings {
  enabled: boolean;
  points_per_aed: number;
  eligible_activities: LoyaltyEligibleActivity[];
  points_expire_after_months: number | null;
  rewards_expire_after_months: number | null;
  restrict_cities: string[];
  restrict_customer_groups: LoyaltyCustomerGroup[];
  restrict_customer_ids: number[];
  /** Labels aligned with specific_customer_ids from API */
  specific_customers: { id: number; name: string }[];
  restrict_campaign_only: boolean;
  status?: string;
}

/** Settings screen activities supported by backend */
export const LOYALTY_SETTINGS_ACTIVITY_OPTIONS: {
  id: Extract<LoyaltyEligibleActivity, 'shop_orders' | 'service_orders' | 'memberships'>;
  labelKey: string;
  defaultLabel: string;
}[] = [
  { id: 'shop_orders', labelKey: 'admin.loyalty.activities.shopOrders', defaultLabel: 'Shop orders' },
  { id: 'service_orders', labelKey: 'admin.loyalty.activities.serviceOrders', defaultLabel: 'Service orders' },
  { id: 'memberships', labelKey: 'admin.loyalty.activities.memberships', defaultLabel: 'Memberships' },
];

/** Shape returned by GET /admin/loyalty/rewards */
export interface AdminLoyaltyRewardApi {
  id: number;
  title: string;
  description: string;
  points_required: number;
  points_label: string;
  is_active: boolean;
  status: string;
  expires_at: string | null;
  cities: string;
  customer_targeting: LoyaltyCustomerGroup;
  customer_targeting_label: string;
  specific_customer_ids: number[];
  specific_customers: string[];
}

export interface AdminLoyaltyRewardsListResponse {
  summary: {
    total: number;
    active: number;
    starts_at: number;
  };
  rewards: AdminLoyaltyRewardApi[];
}

export interface AdminLoyaltyReward {
  id: number;
  title: string;
  description: string;
  points_required: number;
  points_label: string;
  is_active: boolean;
  status: string;
  expires_at: string | null;
  cities: string;
  customer_targeting: LoyaltyCustomerGroup;
  customer_targeting_label: string;
  specific_customer_ids: number[];
  specific_customers: string[];
  /** kept for backwards compatibility with form/edit code */
  customer_groups: LoyaltyCustomerGroup[];
  customer_ids: number[];
  campaign_ids: number[];
  created_at?: string;
  updated_at?: string;
}

/** Shape returned by GET /admin/loyalty/campaigns */
export interface AdminLoyaltyCampaignApi {
  id: number;
  title: string;
  multiplier: number;
  boost_label?: string;
  start_date: string;
  end_date: string;
  date_range?: string;
  cities: string;
  customer_targeting: LoyaltyCustomerGroup;
  customer_targeting_label?: string;
  specific_customer_ids: number[];
  specific_customers?: string[];
  eligible_activities: AdminLoyaltyEligibleActivitiesMap;
  notes?: string | null;
  is_enabled: boolean;
  status?: string;
}

export interface AdminLoyaltyCampaignsListResponse {
  summary: {
    total: number;
    live: number;
    top_boost: string;
  };
  campaigns: AdminLoyaltyCampaignApi[];
}

export interface AdminLoyaltyCampaign {
  id: number;
  title: string;
  multiplier: LoyaltyCampaignMultiplier;
  boost_label?: string;
  starts_at: string;
  ends_at: string;
  date_range?: string;
  is_active: boolean;
  status?: string;
  cities: string[];
  /** Raw cities string from API (for display) */
  cities_label?: string;
  customer_targeting?: LoyaltyCustomerGroup;
  customer_targeting_label?: string;
  customer_groups: LoyaltyCustomerGroup[];
  customer_ids: number[];
  specific_customers?: string[];
  eligible_activities: LoyaltyEligibleActivity[];
  notes?: string;
}

export type LoyaltyLedgerType = 'earn' | 'redeem' | 'adjust_add' | 'adjust_deduct' | 'expire';

export interface AdminLoyaltyLedgerItem {
  id: number;
  type: LoyaltyLedgerType;
  points: number;
  reason: string;
  created_at: string;
  order_id?: number | null;
  admin_name?: string | null;
}

export interface AdminLoyaltyCustomer {
  id: number;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  group: LoyaltyCustomerGroup;
  points_balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  last_activity_at: string;
  profile_picture_url?: string | null;
}

export interface AdminLoyaltyCustomerDetail extends AdminLoyaltyCustomer {
  ledger: AdminLoyaltyLedgerItem[];
}

export interface AdminLoyaltyReportSummary {
  total_customers_with_points: number;
  total_points_outstanding: number;
  points_earned_period: number;
  points_redeemed_period: number;
  rewards_redeemed_count: number;
  active_campaigns: number;
}

export type LoyaltyReportCustomerScope = 'all' | 'specific';
/** UI uses `custom`; API expects `specific` for custom date range */
export type LoyaltyReportPeriod = 'week' | 'month' | 'custom';

export interface AdminLoyaltyReportFilters {
  customer_scope: LoyaltyReportCustomerScope;
  customer_ids: number[];
  period: LoyaltyReportPeriod;
  from_date?: string | null;
  to_date?: string | null;
}

export type LoyaltyReportExportFormat = 'pdf' | 'csv' | 'json';

export interface AdminLoyaltyReportExportResult {
  uri: string;
  mimeType: string;
  fileName: string;
}

export interface AdminLoyaltyRewardInput {
  title: string;
  description: string;
  points_required: number;
  is_active: boolean;
  expires_at: string | null;
  cities: string[];
  customer_groups: LoyaltyCustomerGroup[];
  customer_ids: number[];
  campaign_ids: number[];
}

export interface AdminLoyaltyCampaignInput {
  title: string;
  multiplier: LoyaltyCampaignMultiplier;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  cities: string[];
  customer_groups: LoyaltyCustomerGroup[];
  customer_ids: number[];
  eligible_activities: LoyaltyEligibleActivity[];
  notes?: string;
}

export const LOYALTY_ACTIVITY_OPTIONS: {
  id: LoyaltyEligibleActivity;
  labelKey: string;
  defaultLabel: string;
}[] = [
  { id: 'shop_orders', labelKey: 'admin.loyalty.activities.shopOrders', defaultLabel: 'Shop orders' },
  { id: 'service_orders', labelKey: 'admin.loyalty.activities.serviceOrders', defaultLabel: 'Service orders' },
  { id: 'memberships', labelKey: 'admin.loyalty.activities.memberships', defaultLabel: 'Memberships' },
  { id: 'referrals', labelKey: 'admin.loyalty.activities.referrals', defaultLabel: 'Referrals' },
  { id: 'reviews', labelKey: 'admin.loyalty.activities.reviews', defaultLabel: 'Reviews' },
];

export const LOYALTY_GROUP_OPTIONS: {
  id: LoyaltyCustomerGroup;
  labelKey: string;
  defaultLabel: string;
}[] = [
  { id: 'all', labelKey: 'admin.loyalty.groups.all', defaultLabel: 'All customers' },
  { id: 'specific', labelKey: 'admin.loyalty.groups.specific', defaultLabel: 'Specific customer' },
];
