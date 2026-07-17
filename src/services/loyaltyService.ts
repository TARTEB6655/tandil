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
