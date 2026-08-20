import apiClient from './api';

export interface LoyaltyReward {
  id: string;
  title: string;
  description: string;
  pointsRequired: number;
  canRedeem: boolean;
}

export interface LoyaltyTransaction {
  id: string;
  type: 'earned' | 'redeemed';
  points: number;
  description: string;
  date: string;
}

export interface LoyaltyCampaign {
  id: string;
  title: string;
  multiplier: number;
  boostLabel: string;
  startsAt: string;
  endsAt: string;
  dateRange: string;
  notes: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  activities: string[];
  cities: string;
}

export interface LoyaltyCampaignsSummary {
  total: number;
  live: number;
  topBoost: string;
}

export interface LoyaltyCampaignsResult {
  summary: LoyaltyCampaignsSummary;
  campaigns: LoyaltyCampaign[];
}

export interface LoyaltyDashboard {
  points: number;
  earnInfo?: string;
  rewards: LoyaltyReward[];
  transactions: LoyaltyTransaction[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function numberValue(source: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = Number(source[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function booleanValue(source: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = source[key];
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

function arrayFrom(source: Record<string, unknown>, ...keys: string[]): unknown[] {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
    const nested = record(value);
    if (nested && Array.isArray(nested.data)) return nested.data;
  }
  return [];
}

function normalizeReward(value: unknown, availablePoints: number, index: number): LoyaltyReward | null {
  const row = record(value);
  if (!row) return null;
  const pointsRequired = numberValue(
    row,
    'points_required',
    'required_points',
    'points',
    'cost'
  );
  return {
    id: text(row, 'id', 'reward_id') || String(index),
    title: text(row, 'title', 'name') || 'Reward',
    description: text(row, 'description', 'subtitle'),
    pointsRequired,
    canRedeem: booleanValue(row, 'can_redeem', availablePoints >= pointsRequired),
  };
}

function normalizeTransaction(value: unknown, index: number): LoyaltyTransaction | null {
  const row = record(value);
  if (!row) return null;
  const rawType = text(row, 'type', 'transaction_type', 'action').toLowerCase();
  const rawPoints = numberValue(row, 'points', 'amount', 'points_amount');
  const redeemed =
    rawType.includes('redeem') ||
    rawType.includes('debit') ||
    rawType.includes('spent') ||
    rawPoints < 0;
  return {
    id: text(row, 'id', 'transaction_id') || String(index),
    type: redeemed ? 'redeemed' : 'earned',
    points: redeemed ? -Math.abs(rawPoints) : Math.abs(rawPoints),
    description:
      text(row, 'description', 'title', 'reason') ||
      (redeemed ? 'Reward redeemed' : 'Points earned'),
    date: text(row, 'date', 'created_at', 'transaction_date'),
  };
}

function formatDateLabel(value: string): string {
  if (!value) return '';
  const stamp = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(stamp.getTime())) return value;
  return stamp.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateRange(raw: string, startsAt: string, endsAt: string): string {
  const cleaned = raw.replace(/\s*->\s*/g, ' – ').trim();
  if (cleaned) {
    // Prefer friendly labels when range is ISO dates
    const parts = cleaned.split(/\s+[–-]\s+/);
    if (parts.length === 2) {
      const from = formatDateLabel(parts[0].trim()) || parts[0].trim();
      const to = formatDateLabel(parts[1].trim()) || parts[1].trim();
      return `${from} – ${to}`;
    }
    return cleaned;
  }
  return [formatDateLabel(startsAt), formatDateLabel(endsAt)].filter(Boolean).join(' – ');
}

function parseActivities(row: Record<string, unknown>): string[] {
  const list = arrayFrom(row, 'eligible_activities', 'activities');
  if (list.length) {
    return list
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        const nested = record(item);
        return nested ? text(nested, 'key', 'name', 'label', 'id') : '';
      })
      .filter(Boolean);
  }

  const map = record(row.eligible_activities) ?? record(row.activities);
  if (!map) return [];
  return Object.keys(map).filter((key) => {
    const value = map[key];
    return value === true || value === 1 || value === '1' || value === 'true';
  });
}

/**
 * Maps one campaign from GET /client/loyalty/campaigns
 * Example:
 * {
 *   id, title, multiplier, boost_label, start_date, end_date,
 *   date_range, status, status_label, subtitle
 * }
 */
function normalizeCampaign(value: unknown, index: number): LoyaltyCampaign | null {
  const row = record(value);
  if (!row) return null;

  const status = text(row, 'status', 'status_label');
  const statusLower = status.toLowerCase();
  if (
    statusLower === 'inactive' ||
    statusLower === 'ended' ||
    statusLower === 'expired' ||
    statusLower === 'disabled'
  ) {
    return null;
  }
  if (
    row.is_enabled === false ||
    row.is_active === false ||
    row.enabled === false ||
    row.active === false
  ) {
    return null;
  }

  const startsAt = text(row, 'start_date', 'starts_at', 'from_date', 'start');
  const endsAt = text(row, 'end_date', 'ends_at', 'to_date', 'end');
  const multiplier = Math.max(
    1,
    numberValue(row, 'multiplier', 'boost', 'points_multiplier') || 2
  );
  const boostLabel =
    text(row, 'boost_label', 'multiplier_label') || `${multiplier}x points`;
  const subtitle = text(row, 'subtitle', 'notes', 'description');
  const dateRange = formatDateRange(text(row, 'date_range'), startsAt, endsAt);

  const citiesRaw = row.cities;
  const cities =
    typeof citiesRaw === 'string'
      ? citiesRaw.trim()
      : Array.isArray(citiesRaw)
        ? citiesRaw.map(String).filter(Boolean).join(', ')
        : text(row, 'cities_label', 'city');

  return {
    id: text(row, 'id', 'campaign_id') || String(index),
    title: text(row, 'title', 'name') || 'Campaign',
    multiplier,
    boostLabel,
    startsAt,
    endsAt,
    dateRange,
    notes: subtitle,
    subtitle,
    status,
    statusLabel: text(row, 'status_label', 'status') || status,
    activities: parseActivities(row),
    cities,
  };
}

function parseCampaignsPayload(payload: unknown): LoyaltyCampaignsResult {
  const root = record(payload) ?? {};
  const data = record(root.data) ?? root;
  const summarySrc = record(data.summary) ?? {};

  const campaigns = arrayFrom(data, 'campaigns')
    .map((item, index) => normalizeCampaign(item, index))
    .filter((item): item is LoyaltyCampaign => item !== null);

  return {
    summary: {
      total: numberValue(summarySrc, 'total') || campaigns.length,
      live: numberValue(summarySrc, 'live') || campaigns.length,
      topBoost: text(summarySrc, 'top_boost') || campaigns[0]?.boostLabel || '',
    },
    campaigns,
  };
}

function parseDashboard(payload: unknown): LoyaltyDashboard {
  const root = record(payload) ?? {};
  const data = record(root.data) ?? root;
  const loyalty = record(data.loyalty) ?? data;
  const user = record(loyalty.user) ?? record(data.user) ?? {};
  const points =
    numberValue(
      loyalty,
      'points',
      'loyalty_points',
      'available_points',
      'current_points',
      'balance',
      'points_balance'
    ) ||
    numberValue(user, 'points', 'loyalty_points', 'available_points');

  const rewards = arrayFrom(loyalty, 'rewards', 'available_rewards')
    .map((item, index) => normalizeReward(item, points, index))
    .filter((item): item is LoyaltyReward => item !== null);

  const transactions = arrayFrom(
    loyalty,
    'recent_transactions',
    'transactions',
    'history',
    'points_history'
  )
    .map((item, index) => normalizeTransaction(item, index))
    .filter((item): item is LoyaltyTransaction => item !== null);

  return {
    points,
    earnInfo: text(loyalty, 'earn_info', 'earning_rule', 'description'),
    rewards,
    transactions,
  };
}

/** GET /client/loyalty — points, rewards, transactions */
export async function getClientLoyaltyDashboard(): Promise<LoyaltyDashboard> {
  let response;
  try {
    response = await apiClient.get('/client/loyalty', { timeout: 20000 });
  } catch (error: unknown) {
    const status =
      error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined;
    if (status !== 404 && status !== 405) throw error;
    response = await apiClient.get('/user/loyalty', { timeout: 20000 });
  }
  const body = response.data as { success?: boolean; message?: string };
  if (body?.success === false) {
    throw new Error(body.message || 'Failed to load loyalty points.');
  }
  return parseDashboard(response.data);
}

/**
 * GET /client/loyalty/campaigns
 * Response: { success, message, data: { summary, campaigns: [...] } }
 */
export async function getClientLoyaltyCampaigns(): Promise<LoyaltyCampaignsResult> {
  const response = await apiClient.get('/client/loyalty/campaigns', { timeout: 20000 });
  const body = record(response.data) ?? {};
  if (body.success === false) {
    throw new Error(text(body, 'message') || 'Failed to load loyalty campaigns.');
  }
  const parsed = parseCampaignsPayload(response.data);
  return {
    summary: parsed.summary,
    campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
  };
}

export interface RedeemRewardResult {
  message: string;
}

export async function redeemClientLoyaltyReward(
  rewardId: string
): Promise<RedeemRewardResult> {
  const response = await apiClient.post(
    `/client/loyalty/rewards/${encodeURIComponent(rewardId)}/redeem`,
    undefined,
    { timeout: 20000 }
  );
  const body = record(response.data) ?? {};
  if (body.success === false) {
    throw new Error(text(body, 'message') || 'Unable to redeem this reward.');
  }
  return {
    message: text(body, 'message') || 'Reward redeemed successfully.',
  };
}
