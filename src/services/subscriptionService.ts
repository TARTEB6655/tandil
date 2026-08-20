import api from './api';
import { buildFullImageUrl } from '../config/api';

/** API plan values from POST /subscriptions (Postman) */
export type SubscriptionPlan = '1_month' | '3_month' | '6_month' | '12_month' | string;

export type SubscriptionPaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'cancelled';

/** API targeting: all_users | specific_clients */
export type SubscriptionTargetType = 'all_users' | 'specific_clients';

/** @deprecated use SubscriptionTargetType */
export type SubscriptionAudience = 'all' | 'specific' | SubscriptionTargetType;

export interface SubscriptionClient {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
}

export interface AdminSubscription {
  id: number;
  client_id?: number | null;
  plan: SubscriptionPlan | string;
  plan_name?: string | null;
  start_date: string;
  end_date: string;
  amount: number | string;
  payment_status: SubscriptionPaymentStatus | string;
  payment_reference?: string | null;
  paid_at?: string | null;
  total_visits?: number;
  completed_visits?: number;
  remaining_visits?: number;
  features?: string[] | null;
  target_type?: SubscriptionTargetType | string | null;
  client_ids?: number[] | null;
  audience?: SubscriptionAudience | string | null;
  apply_to_all?: boolean | number | string | null;
  /** @deprecated prefer plan_name */
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  picture?: string | null;
  picture_url?: string | null;
  image?: string | null;
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
  client?: SubscriptionClient;
  /** UI-only: collapsed all_users rows (same plan assigned per client) */
  _groupIds?: number[];
  _groupCount?: number;
}

/** @deprecated Prefer AdminSubscription */
export type Subscription = AdminSubscription;

/**
 * Create payload — Postman + targeting:
 * plan, plan_name, subtitle, description, picture, amount,
 * payment_status, payment_reference, start_date, end_date,
 * target_type: all_users | specific_clients (+ client_ids when specific)
 */
export interface CreateSubscriptionPayload {
  /** all_users | specific_clients */
  target_type: SubscriptionTargetType;
  /** Required when target_type is specific_clients */
  client_ids?: number[];
  /** Prefer with target_type=all_users so API creates one plan, not one row per client */
  apply_to_all?: boolean;
  /** @deprecated prefer target_type */
  audience?: SubscriptionAudience;
  /** @deprecated prefer client_ids */
  client_id?: number | null;
  /** API: 1_month | 3_month | 6_month | 12_month */
  plan: SubscriptionPlan | string;
  plan_name: string;
  subtitle?: string | null;
  description?: string | null;
  start_date: string;
  end_date: string;
  amount: number;
  payment_status: SubscriptionPaymentStatus | string;
  payment_reference?: string | null;
  paid_at?: string | null;
  features?: string[];
  /** Local file URI → form field `picture` */
  picture?: { uri: string } | null;
  /** @deprecated use picture */
  image?: { uri: string } | null;
  /** @deprecated use plan_name */
  title?: string | null;
}

export interface UpdateSubscriptionPayload {
  plan?: SubscriptionPlan | string;
  plan_name?: string;
  start_date?: string;
  end_date?: string;
  amount?: number;
  payment_status?: SubscriptionPaymentStatus | string;
  payment_reference?: string | null;
  paid_at?: string | null;
  features?: string[];
  target_type?: SubscriptionTargetType;
  audience?: SubscriptionAudience;
  client_id?: number | null;
  client_ids?: number[];
  subtitle?: string | null;
  description?: string | null;
  picture?: { uri: string } | null;
  image?: { uri: string } | null;
  picture_remove?: boolean;
  image_remove?: boolean;
  title?: string | null;
}

export interface SubscriptionPlanOption {
  /** Unique UI key (Basic vs VIP can share same API plan duration) */
  key: string;
  /** Sent as form field `plan` */
  value: '1_month' | '3_month' | '6_month' | '12_month';
  label: string;
  defaultAmount: number;
  months: number;
  defaultVisits: number;
  defaultFeatures: string[];
  /** Sent as form field `plan_name` */
  title: string;
  subtitle: string;
  description: string;
}

export const SUBSCRIPTION_PLAN_OPTIONS: SubscriptionPlanOption[] = [
  {
    key: 'basic_1_month',
    value: '1_month',
    label: 'Basic 1 Month',
    title: 'Basic 1 Month',
    subtitle: 'Essential care package',
    description:
      'A starter membership with monthly tree health checks and basic pruning for healthy palms.',
    defaultAmount: 450,
    months: 1,
    defaultVisits: 2,
    defaultFeatures: [
      'Monthly tree health check',
      'Basic pruning & cleanup',
      'Soil moisture assessment',
      'WhatsApp support',
    ],
  },
  {
    key: 'basic_3_month',
    value: '3_month',
    label: 'Basic 3 Months',
    title: 'Basic 3 Months',
    subtitle: 'Quarterly care plan',
    description:
      'Three months of scheduled visits covering pruning, pest checks, and fertilizer for steady growth.',
    defaultAmount: 1200,
    months: 3,
    defaultVisits: 6,
    defaultFeatures: [
      'Bi-weekly visits',
      'Pruning & shaping',
      'Pest inspection',
      'Fertilizer application',
      'Photo reports',
    ],
  },
  {
    key: 'basic_6_month',
    value: '6_month',
    label: 'Basic 6 Months',
    title: 'Basic 6 Months',
    subtitle: 'Half-year care plan',
    description:
      'Half-year care with seasonal treatments, soil enrichment, and priority booking for your trees.',
    defaultAmount: 2200,
    months: 6,
    defaultVisits: 12,
    defaultFeatures: [
      'Regular scheduled visits',
      'Seasonal treatments',
      'Soil enrichment',
      'Priority booking',
      'Detailed reports',
    ],
  },
  {
    key: 'basic_12_month',
    value: '12_month',
    label: 'Basic 12 Months',
    title: 'Basic 12 Months',
    subtitle: 'Full year care plan',
    description:
      'Full-year membership with year-round care, seasonal treatments, and a dedicated care advisor.',
    defaultAmount: 4000,
    months: 12,
    defaultVisits: 24,
    defaultFeatures: [
      'Year-round care',
      'All seasonal treatments',
      'Emergency visits included',
      'Dedicated care advisor',
      'Full documentation',
    ],
  },
  {
    key: 'vip_3_month',
    value: '3_month',
    label: 'VIP 3 Months',
    title: 'VIP 3 Months',
    subtitle: 'VIP quarterly plan',
    description:
      'Premium quarterly VIP plan with regular visits, organic treatments, and priority support.',
    defaultAmount: 2900,
    months: 3,
    defaultVisits: 12,
    defaultFeatures: [
      'VIP regular visits',
      'Premium tree care',
      'Organic treatments',
      'Professional photos',
      'Priority support',
    ],
  },
  {
    key: 'vip_6_month',
    value: '6_month',
    label: 'VIP 6 Months',
    title: 'VIP 6 Months',
    subtitle: 'VIP half-year plan',
    description:
      'Six months of VIP care including bi-weekly visits, expert consultation, and 24/7 support.',
    defaultAmount: 5600,
    months: 6,
    defaultVisits: 24,
    defaultFeatures: [
      'VIP bi-weekly visits',
      'Premium full care',
      'Expert consultation',
      'Professional photos',
      '24/7 support',
    ],
  },
  {
    key: 'vip_12_month',
    value: '12_month',
    label: 'VIP 12 Months',
    title: 'VIP 12 Months',
    subtitle: 'VIP annual plan',
    description:
      'Our flagship VIP annual plan with weekly visits, premium full service, and exclusive treatments year-round.',
    defaultAmount: 11000,
    months: 12,
    defaultVisits: 52,
    defaultFeatures: [
      'VIP weekly visits',
      'Premium full service',
      'Year-round expertise',
      'Professional photos',
      '24/7 priority support',
      'Exclusive treatments',
    ],
  },
];

/** Normalize legacy / alternate plan keys to API values */
export function normalizeSubscriptionPlan(plan: string): string {
  const map: Record<string, string> = {
    monthly: '1_month',
    '1_months': '1_month',
    '3_months': '3_month',
    '6_months': '6_month',
    yearly: '12_month',
    '12_months': '12_month',
    vip_3_months: '3_month',
    vip_6_months: '6_month',
    vip_yearly: '12_month',
  };
  return map[plan] || plan;
}

export function getSubscriptionPlanLabel(plan: string): string {
  const normalized = normalizeSubscriptionPlan(plan);
  const found = SUBSCRIPTION_PLAN_OPTIONS.find((p) => p.value === normalized);
  if (found) return found.label;
  const map: Record<string, string> = {
    '1_month': '1 Month',
    '3_month': '3 Months',
    '6_month': '6 Months',
    '12_month': '12 Months',
  };
  return map[normalized] || plan;
}

export function getPlanOption(planOrKey: string) {
  return (
    SUBSCRIPTION_PLAN_OPTIONS.find((p) => p.key === planOrKey) ||
    SUBSCRIPTION_PLAN_OPTIONS.find((p) => p.value === normalizeSubscriptionPlan(planOrKey))
  );
}

export function addMonthsToDate(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setMonth(d.getMonth() + months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function resolveSubscriptionImageUrl(
  raw?: string | null,
  fallback?: string | null
): string | undefined {
  const value = (raw || fallback || '').trim();
  if (!value || value === 'null' || value === 'undefined') return undefined;
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file:') ||
    value.startsWith('content:') ||
    value.startsWith('ph:') ||
    value.startsWith('data:')
  ) {
    return value;
  }
  return buildFullImageUrl(value);
}

function isLocalImageUri(uri: string): boolean {
  return (
    uri.startsWith('file:') ||
    uri.startsWith('content:') ||
    uri.startsWith('ph:') ||
    uri.startsWith('assets-library:')
  );
}

function appendNullable(formData: FormData, key: string, value: string | number | null | undefined) {
  if (value === undefined) return;
  formData.append(key, value === null ? '' : String(value));
}

/**
 * Build multipart body matching Create Subscription API:
 * plan, plan_name, subtitle, description, picture, amount,
 * payment_status, payment_reference, start_date, end_date,
 * target_type (all_users | specific_clients), client_ids[] when specific
 */
function resolveTargetType(
  payload: CreateSubscriptionPayload | UpdateSubscriptionPayload
): SubscriptionTargetType | undefined {
  const p = payload as CreateSubscriptionPayload & UpdateSubscriptionPayload;
  if (p.target_type === 'all_users' || p.target_type === 'specific_clients') {
    return p.target_type;
  }
  if (p.audience === 'all' || p.audience === 'all_users') return 'all_users';
  if (p.audience === 'specific' || p.audience === 'specific_clients') return 'specific_clients';
  return undefined;
}

function buildSubscriptionFormData(
  payload: CreateSubscriptionPayload | UpdateSubscriptionPayload
): FormData {
  const formData = new FormData();
  const p = payload as CreateSubscriptionPayload & UpdateSubscriptionPayload;

  if (p.plan != null) {
    formData.append('plan', normalizeSubscriptionPlan(String(p.plan)));
  }

  const planName = (p.plan_name ?? p.title ?? '').trim();
  if (planName) formData.append('plan_name', planName);

  appendNullable(formData, 'subtitle', p.subtitle);
  appendNullable(formData, 'description', p.description);

  if (p.amount != null) formData.append('amount', String(p.amount));
  if (p.payment_status != null) formData.append('payment_status', String(p.payment_status));
  appendNullable(formData, 'payment_reference', p.payment_reference);
  if (p.start_date != null) formData.append('start_date', String(p.start_date));
  if (p.end_date != null) formData.append('end_date', String(p.end_date));

  const targetType = resolveTargetType(p);

  // Catalog plan for everyone — never send client_ids (backend expands those into N rows)
  if (targetType === 'all_users' || p.apply_to_all === true) {
    formData.append('target_type', 'all_users');
    formData.append('apply_to_all', '1');
  } else if (targetType === 'specific_clients') {
    formData.append('target_type', 'specific_clients');
    formData.append('apply_to_all', '0');
    const rawIds =
      Array.isArray(p.client_ids) && p.client_ids.length
        ? p.client_ids
        : p.client_id != null
          ? [p.client_id]
          : [];
    // Unique IDs only — duplicate client_ids[] entries make the API create duplicate rows
    const ids = [
      ...new Set(
        rawIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    ];
    ids.forEach((id) => formData.append('client_ids[]', String(id)));
  } else if (targetType) {
    formData.append('target_type', targetType);
  }

  appendNullable(formData, 'paid_at', p.paid_at);
  // Postman: features[] (repeat for multiple) — unique trimmed lines only
  if (Array.isArray(p.features)) {
    const seenFeatures = new Set<string>();
    p.features.forEach((feature) => {
      const text = String(feature).trim();
      if (!text) return;
      const key = text.toLowerCase();
      if (seenFeatures.has(key)) return;
      seenFeatures.add(key);
      formData.append('features[]', text);
    });
  }

  if (p.picture_remove || p.image_remove) {
    formData.append('picture_remove', '1');
  }

  const localFile = p.picture?.uri || p.image?.uri;
  if (localFile && isLocalImageUri(localFile)) {
    formData.append('picture', {
      uri: localFile,
      type: 'image/jpeg',
      name: 'subscription-picture.jpg',
    } as any);
  }

  return formData;
}

export async function getSubscriptions(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  payment_status?: string;
  plan?: string;
  target_type?: string;
}): Promise<{
  success?: boolean;
  message?: string;
  data: AdminSubscription[];
  meta?: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
  };
  raw?: unknown;
}> {
  const response = await api.get('/subscriptions', { params });
  const body = response.data;
  const list = extractSubscriptionsList(body);
  const nested =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).data
      : null;
  const metaSource =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;

  return {
    success: body?.success ?? body?.status ?? true,
    message: body?.message,
    data: list,
    meta: metaSource
      ? {
          current_page: Number(metaSource.current_page ?? metaSource.page) || undefined,
          last_page: Number(metaSource.last_page) || undefined,
          per_page: Number(metaSource.per_page) || undefined,
          total: Number(metaSource.total) || undefined,
        }
      : undefined,
    raw: body,
  };
}

function extractSubscriptionsList(body: unknown): AdminSubscription[] {
  if (!body) return [];
  if (Array.isArray(body)) return normalizeSubscriptionsList(body as AdminSubscription[]);

  const root = body as Record<string, unknown>;
  const data = root.data;

  if (Array.isArray(data)) {
    return normalizeSubscriptionsList(data as AdminSubscription[]);
  }

  if (data && typeof data === 'object') {
    const nested = data as Record<string, unknown>;
    if (Array.isArray(nested.data)) {
      return normalizeSubscriptionsList(nested.data as AdminSubscription[]);
    }
    if (Array.isArray(nested.subscriptions)) {
      return normalizeSubscriptionsList(nested.subscriptions as AdminSubscription[]);
    }
    if (Array.isArray(nested.items)) {
      return normalizeSubscriptionsList(nested.items as AdminSubscription[]);
    }
    // Single subscription object in `data`
    if (nested.id != null) {
      return [nested as unknown as AdminSubscription];
    }
  }

  if (Array.isArray(root.subscriptions)) {
    return normalizeSubscriptionsList(root.subscriptions as AdminSubscription[]);
  }
  if (Array.isArray(root.items)) {
    return normalizeSubscriptionsList(root.items as AdminSubscription[]);
  }

  return [];
}

/** List APIs sometimes repeat the same subscription once per client — keep one row per id. */
function dedupeSubscriptionsById(list: AdminSubscription[]): AdminSubscription[] {
  const seen = new Set<string>();
  const unique: AdminSubscription[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const key =
      item.id != null
        ? `id:${item.id}`
        : `fallback:${item.plan_name || item.title || ''}:${item.plan || ''}:${item.start_date || ''}:${item.amount ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

/**
 * Collapse near-identical rows from accidental double-create
 * (same plan content + same created_at second, different ids).
 */
function dedupeNearIdenticalCreates(list: AdminSubscription[]): AdminSubscription[] {
  const seen = new Set<string>();
  const unique: AdminSubscription[] = [];
  for (const item of list) {
    const createdBucket = item.created_at ? String(item.created_at).slice(0, 19) : '';
    if (!createdBucket) {
      unique.push(item);
      continue;
    }
    const contentKey = [
      String(item.plan_name || item.title || '').trim().toLowerCase(),
      String(item.plan || ''),
      String(item.start_date || ''),
      String(item.end_date || ''),
      String(item.amount ?? ''),
      String(item.target_type || item.audience || ''),
      String(item.client_id ?? ''),
      createdBucket,
    ].join('|');
    if (seen.has(contentKey)) continue;
    seen.add(contentKey);
    unique.push(item);
  }
  return unique;
}

function isAllUsersSubscription(item: AdminSubscription): boolean {
  const raw = String(item.target_type || item.audience || '').toLowerCase();
  if (raw === 'all_users' || raw === 'all') return true;
  const flag = item.apply_to_all;
  return flag === true || flag === 1 || String(flag) === '1' || String(flag).toLowerCase() === 'true';
}

/**
 * Backend often expands "All users" into one row per client.
 * Admin list should show one card per plan, not one per client.
 */
function collapseAllUsersPlans(list: AdminSubscription[]): AdminSubscription[] {
  const result: AdminSubscription[] = [];
  const indexByKey = new Map<string, number>();

  for (const item of list) {
    if (!isAllUsersSubscription(item)) {
      result.push(item);
      continue;
    }

    const key = [
      String(item.plan_name || item.title || '').trim().toLowerCase(),
      String(item.plan || ''),
      String(item.start_date || ''),
      String(item.end_date || ''),
      String(item.amount ?? ''),
    ].join('|');

    const existingIdx = indexByKey.get(key);
    if (existingIdx == null) {
      indexByKey.set(key, result.length);
      result.push({
        ...item,
        target_type: 'all_users',
        apply_to_all: true,
        client: undefined,
        client_id: null,
        _groupIds: item.id != null ? [Number(item.id)] : [],
        _groupCount: 1,
      });
      continue;
    }

    const existing = result[existingIdx];
    if (item.id != null) {
      existing._groupIds = [...(existing._groupIds || []), Number(item.id)];
    }
    existing._groupCount = (existing._groupCount || 1) + 1;
  }

  return result;
}

function normalizeSubscriptionsList(list: AdminSubscription[]): AdminSubscription[] {
  return collapseAllUsersPlans(dedupeNearIdenticalCreates(dedupeSubscriptionsById(list)));
}

export async function getSubscriptionById(id: number | string) {
  const response = await api.get(`/subscriptions/${id}`);
  const body = response.data;
  const item =
    body?.data && !Array.isArray(body.data) ? body.data : body;
  return {
    ...body,
    data: item as AdminSubscription,
  };
}

/** POST /api/subscriptions — multipart form-data (Create Subscription, Bearer admin token) */
let createSubscriptionInFlight: Promise<unknown> | null = null;

export async function createSubscription(payload: CreateSubscriptionPayload) {
  // Reject concurrent creates (double-tap / remount) so the API is only hit once
  if (createSubscriptionInFlight) {
    throw new Error('Subscription create already in progress. Please wait.');
  }

  createSubscriptionInFlight = (async () => {
    const formData = buildSubscriptionFormData(payload);
    if (__DEV__) {
      console.log('[subscriptions] create once', {
        plan: payload.plan,
        plan_name: payload.plan_name,
        target_type: payload.target_type,
        client_ids: payload.client_ids,
      });
    }
    const response = await api.post('/subscriptions', formData, {
      timeout: 60000,
      headers: { Accept: 'application/json' },
    });
    return response.data;
  })();

  try {
    return await createSubscriptionInFlight;
  } finally {
    createSubscriptionInFlight = null;
  }
}

/**
 * POST /api/subscriptions/:subscription_id
 * Multipart form-data (Postman Update Subscription).
 * Auth: Authorization Bearer <admin token> via api interceptor (auth_token).
 * Fields: plan_name, subtitle, description, target_type, picture, amount,
 * payment_status, payment_reference, features[], start_date?, end_date?, plan?
 */
export async function updateSubscription(
  id: number | string,
  payload: UpdateSubscriptionPayload
) {
  const formData = buildSubscriptionFormData(payload);
  const response = await api.post(`/subscriptions/${id}`, formData, {
    timeout: 60000,
    headers: { Accept: 'application/json' },
  });
  return response.data;
}

export async function deleteSubscription(id: number | string) {
  const response = await api.delete(`/subscriptions/${id}`);
  return response.data;
}

export const subscriptionService = {
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  SUBSCRIPTION_PLAN_OPTIONS,
  getSubscriptionPlanLabel,
  getPlanOption,
  normalizeSubscriptionPlan,
  addMonthsToDate,
  resolveSubscriptionImageUrl,
};

export default subscriptionService;
