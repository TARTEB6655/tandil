/**
 * Client memberships API.
 * List: GET /api/subscriptions (Postman List My Memberships).
 * Optional screen meta: GET /api/client/memberships/screen.
 * Uses apiClient so Bearer client token is sent.
 */
import apiClient from './api';
import { buildFullImageUrl } from '../config/api';
import type { AxiosError } from 'axios';

export type MembershipPaymentMethod = 'stripe' | 'apple_pay';
export type MembershipPurchaseMode = 'purchase' | 'renew' | 'upgrade';

export interface MembershipPaymentMethodOption {
  id: MembershipPaymentMethod | string;
  label: string;
  description?: string;
}

export interface MembershipUpgradePlan {
  plan: string;
  label: string;
  price: number;
  price_difference?: number;
}

/** Compact current membership inside active_membership */
export interface MembershipCurrentSummary {
  subscription_id: number;
  plan: string;
  plan_name?: string | null;
  amount: number | string;
  start_date: string;
  end_date: string;
  payment_status: string;
  status: string;
}

export interface MembershipHistoryItem {
  id?: number;
  subscription_id?: number;
  plan?: string;
  plan_name?: string | null;
  amount?: number | string;
  start_date?: string;
  end_date?: string;
  payment_status?: string;
  status?: string;
  [key: string]: unknown;
}

/** Full membership row from data.memberships */
export interface ClientMembership {
  id: number;
  client_id?: number;
  plan: string;
  plan_name?: string | null;
  subtitle?: string | null;
  features?: string[] | null;
  apply_to_all?: boolean;
  target_type?: string | null;
  start_date: string;
  end_date: string;
  amount: string | number;
  picture?: string | null;
  description?: string | null;
  payment_status: string;
  payment_reference?: string | null;
  paid_at?: string | null;
  completed_visits?: number;
  total_visits?: number;
  created_at?: string;
  updated_at?: string;
  picture_url?: string | null;
  status?: string;
  visits?: unknown[];
}

export interface ActiveMembershipBlock {
  currency?: string;
  current_membership: MembershipCurrentSummary | null;
  renew_price?: number | null;
  upgrade_plans?: MembershipUpgradePlan[];
  payment_methods?: MembershipPaymentMethodOption[];
  history?: MembershipHistoryItem[];
}

export interface MembershipScreenData {
  active_membership: ActiveMembershipBlock | null;
  memberships: ClientMembership[];
}

export interface MembershipScreenResponse {
  success?: boolean;
  message?: string;
  data?: MembershipScreenData;
}

/** @deprecated Prefer MembershipScreenResponse */
export interface ClientMembershipsResponse {
  success?: boolean;
  message?: string;
  data: ClientMembership[];
  total: number;
}

export type MembershipPaymentStubResult = {
  success: false;
  notImplemented: true;
  message: string;
};

export type MembershipPaymentIntentData = {
  client_secret: string;
  ephemeral_key?: string;
  customer?: string;
  payment_intent_id?: string;
};

export type MembershipPaymentIntentResult = {
  data: MembershipPaymentIntentData | null;
  message?: string;
  notImplemented?: boolean;
};

/** Allowed upgrade target_plan values (Postman). */
export type MembershipTargetPlan = '1_month' | '3_month' | '6_month' | '12_month' | string;

function firstLaravelErrorMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  if (typeof d.message === 'string' && d.message) return d.message;
  const err = d.errors;
  if (err && typeof err === 'object') {
    for (const v of Object.values(err as Record<string, unknown>)) {
      if (Array.isArray(v) && v[0] != null) return String(v[0]);
      if (typeof v === 'string') return v;
    }
  }
  return undefined;
}

function parseMembershipPaymentIntentPayload(body: unknown): MembershipPaymentIntentData | null {
  if (!body || typeof body !== 'object') return null;
  const root = body as Record<string, unknown>;
  const inner = root.data;

  const fromObject = (obj: Record<string, unknown>): MembershipPaymentIntentData | null => {
    const secret =
      typeof obj.client_secret === 'string'
        ? obj.client_secret
        : typeof obj.clientSecret === 'string'
          ? obj.clientSecret
          : null;
    if (!secret) return null;
    return {
      client_secret: secret,
      ephemeral_key:
        typeof obj.ephemeral_key === 'string'
          ? obj.ephemeral_key
          : typeof obj.ephemeralKey === 'string'
            ? obj.ephemeralKey
            : undefined,
      customer: typeof obj.customer === 'string' ? obj.customer : undefined,
      payment_intent_id:
        typeof obj.payment_intent_id === 'string'
          ? obj.payment_intent_id
          : typeof obj.paymentIntentId === 'string'
            ? obj.paymentIntentId
            : undefined,
    };
  };

  if (inner && typeof inner === 'object') {
    const parsed = fromObject(inner as Record<string, unknown>);
    if (parsed) return parsed;
  }
  return fromObject(root);
}

export function extractMembershipPaymentIntentId(clientSecret: string): string | null {
  const idx = clientSecret.indexOf('_secret_');
  if (idx <= 0) return null;
  return clientSecret.slice(0, idx);
}

/** Normalize plan keys like "12 Month" / "12-month" → "12_month". */
export function normalizeMembershipTargetPlan(plan: string): string {
  const raw = String(plan || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const allowed = ['1_month', '3_month', '6_month', '12_month'];
  if (allowed.includes(raw)) return raw;
  const match = raw.match(/^(1|3|6|12)_?m/);
  if (match) return `${match[1]}_month`;
  return raw;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseDate(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatMembershipPlan(plan: string, planName?: string | null): string {
  if (planName?.trim()) return planName.trim();
  if (!plan) return plan;
  const normalized = plan.replace(/_/g, ' ');
  return normalized.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function resolveMembershipPictureUrl(
  raw?: string | null,
  fallback?: string | null
): string | undefined {
  const value = (raw || fallback || '').trim();
  if (!value || value === 'null' || value === 'undefined') return undefined;
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file:') ||
    value.startsWith('data:')
  ) {
    return value;
  }
  return buildFullImageUrl(value);
}

export function isMembershipPaid(m: Pick<ClientMembership, 'payment_status' | 'paid_at'>): boolean {
  const s = String(m.payment_status || '').toLowerCase();
  return (
    s === 'paid' ||
    s === 'completed' ||
    s === 'success' ||
    s === 'successful' ||
    s === 'active' ||
    !!m.paid_at
  );
}

export function isMembershipActive(
  m: Pick<ClientMembership, 'end_date' | 'payment_status' | 'status'>,
  now = new Date()
): boolean {
  const status = String(m.status || '').toLowerCase();
  if (status === 'active') {
    const end = parseDate(m.end_date);
    if (end && startOfDay(end) < startOfDay(now)) return false;
    return true;
  }
  const end = parseDate(m.end_date);
  if (!end) return false;
  if (startOfDay(end) < startOfDay(now)) return false;
  const s = String(m.payment_status || '').toLowerCase();
  if (s === 'failed' || s === 'cancelled' || s === 'canceled' || s === 'refunded') {
    return false;
  }
  return true;
}

export function isMembershipExpired(
  m: Pick<ClientMembership, 'end_date' | 'status'>,
  now = new Date()
): boolean {
  const status = String(m.status || '').toLowerCase();
  if (status === 'expired') return true;
  const end = parseDate(m.end_date);
  if (!end) return false;
  return startOfDay(end) < startOfDay(now);
}

export function daysUntilExpiry(
  m: Pick<ClientMembership, 'end_date'>,
  now = new Date()
): number | null {
  const end = parseDate(m.end_date);
  if (!end) return null;
  const ms = startOfDay(end).getTime() - startOfDay(now).getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function formatMembershipDate(value?: string | null): string {
  const d = parseDate(value);
  if (!d) return '—';
  try {
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value || '—';
  }
}

export function membershipToClientMembership(
  current: MembershipCurrentSummary | null | undefined
): ClientMembership | null {
  if (!current) return null;
  return {
    id: current.subscription_id,
    plan: current.plan,
    plan_name: current.plan_name,
    start_date: current.start_date,
    end_date: current.end_date,
    amount: current.amount,
    payment_status: current.payment_status,
    status: current.status,
    completed_visits: 0,
    total_visits: 0,
  };
}

export function pickPrimaryMembership(list: ClientMembership[]): ClientMembership | null {
  if (!list.length) return null;
  const active = list.filter((m) => isMembershipActive(m));
  const pool = active.length ? active : list;
  return [...pool].sort((a, b) => {
    const ae = parseDate(a.end_date)?.getTime() ?? 0;
    const be = parseDate(b.end_date)?.getTime() ?? 0;
    return be - ae;
  })[0];
}

function normalizeScreenData(raw: unknown): MembershipScreenData {
  if (!raw || typeof raw !== 'object') {
    return { active_membership: null, memberships: [] };
  }
  const root = raw as Record<string, unknown>;

  // Legacy shape: data is already a memberships array
  if (Array.isArray(root)) {
    return { active_membership: null, memberships: root as ClientMembership[] };
  }

  const activeRaw = root.active_membership;
  let active_membership: ActiveMembershipBlock | null = null;

  if (activeRaw && typeof activeRaw === 'object' && !Array.isArray(activeRaw)) {
    const a = activeRaw as Record<string, unknown>;
    const current = a.current_membership;
    const hasCurrent =
      current &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      ((current as MembershipCurrentSummary).subscription_id != null ||
        (current as { id?: number }).id != null);

    active_membership = {
      currency: typeof a.currency === 'string' ? a.currency : 'AED',
      current_membership: hasCurrent
        ? ({
            ...(current as MembershipCurrentSummary),
            subscription_id:
              (current as MembershipCurrentSummary).subscription_id ??
              Number((current as { id?: number }).id),
          } as MembershipCurrentSummary)
        : null,
      renew_price:
        a.renew_price == null || a.renew_price === ''
          ? null
          : Number(a.renew_price),
      upgrade_plans: Array.isArray(a.upgrade_plans)
        ? (a.upgrade_plans as MembershipUpgradePlan[])
        : [],
      payment_methods: Array.isArray(a.payment_methods)
        ? (a.payment_methods as MembershipPaymentMethodOption[])
        : [],
      history: Array.isArray(a.history) ? (a.history as MembershipHistoryItem[]) : [],
    };
  }

  let memberships: ClientMembership[] = [];
  if (Array.isArray(root.memberships)) {
    memberships = root.memberships as ClientMembership[];
  } else if (Array.isArray(root.data)) {
    memberships = root.data as ClientMembership[];
  } else if (
    root.data &&
    typeof root.data === 'object' &&
    Array.isArray((root.data as { memberships?: unknown }).memberships)
  ) {
    memberships = (root.data as { memberships: ClientMembership[] }).memberships;
  }

  // Derive current from memberships if API omitted current_membership
  if (
    (!active_membership || !active_membership.current_membership) &&
    memberships.length > 0
  ) {
    const primary = pickPrimaryMembership(memberships);
    if (primary && isMembershipActive(primary)) {
      const derived: MembershipCurrentSummary = {
        subscription_id: primary.id,
        plan: primary.plan,
        plan_name: primary.plan_name,
        amount: primary.amount,
        start_date: primary.start_date,
        end_date: primary.end_date,
        payment_status: primary.payment_status,
        status: primary.status || 'active',
      };
      active_membership = {
        currency: active_membership?.currency || 'AED',
        current_membership: derived,
        renew_price: active_membership?.renew_price ?? (Number(primary.amount) || null),
        upgrade_plans: active_membership?.upgrade_plans ?? [],
        payment_methods: active_membership?.payment_methods ?? [],
        history: active_membership?.history ?? [],
      };
    }
  }

  return { active_membership, memberships };
}

/** Parse GET /subscriptions (Postman: List My Memberships) into ClientMembership[]. */
function extractSubscriptionsAsMemberships(body: unknown): ClientMembership[] {
  if (!body) return [];
  if (Array.isArray(body)) return body as ClientMembership[];
  const root = body as Record<string, unknown>;
  if (Array.isArray(root.data)) return root.data as ClientMembership[];
  if (root.data && typeof root.data === 'object') {
    const nested = root.data as Record<string, unknown>;
    if (Array.isArray(nested.data)) return nested.data as ClientMembership[];
    if (Array.isArray(nested.subscriptions)) return nested.subscriptions as ClientMembership[];
    if (nested.id != null) return [nested as unknown as ClientMembership];
  }
  if (Array.isArray(root.subscriptions)) return root.subscriptions as ClientMembership[];
  if (Array.isArray(root.memberships)) return root.memberships as ClientMembership[];
  return [];
}

/**
 * GET /api/subscriptions — client "List My Memberships" (Postman).
 * Returns the full subscription rows (plan_name, subtitle, features, …).
 */
export async function listMyMemberships(): Promise<ClientMembership[]> {
  const response = await apiClient.get('/subscriptions', { timeout: 15000 });
  return extractSubscriptionsAsMemberships(response.data);
}

/**
 * Screen payload + memberships list.
 * Prefer GET /subscriptions for the list (Postman List My Memberships).
 * Still tries /client/memberships/screen for active/renew/upgrade metadata when available.
 */
export async function getMembershipScreen(): Promise<MembershipScreenData> {
  let screenMeta: MembershipScreenData | null = null;

  try {
    const response = await apiClient.get<MembershipScreenResponse>(
      '/client/memberships/screen',
      { timeout: 15000 }
    );
    const body = response.data as MembershipScreenResponse & {
      data?: MembershipScreenData | ClientMembership[];
      memberships?: ClientMembership[];
      active_membership?: ActiveMembershipBlock;
    };

    if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
      screenMeta = normalizeScreenData(body.data);
    } else if (Array.isArray(body?.data)) {
      screenMeta = normalizeScreenData({ memberships: body.data });
    } else if (body?.active_membership != null || Array.isArray(body?.memberships)) {
      screenMeta = normalizeScreenData(body);
    } else {
      screenMeta = normalizeScreenData(body);
    }
  } catch (err) {
    if (__DEV__) {
      console.warn('[memberships/screen] failed (will use /subscriptions)', err);
    }
  }

  try {
    const list = await listMyMemberships();
    if (list.length > 0) {
      const merged = normalizeScreenData({
        active_membership: screenMeta?.active_membership ?? null,
        memberships: list,
      });
      return merged;
    }
  } catch (subsErr) {
    if (__DEV__) {
      console.warn('[memberships] GET /subscriptions failed', subsErr);
    }
    if (screenMeta && (screenMeta.memberships.length > 0 || screenMeta.active_membership)) {
      return screenMeta;
    }
    // Last resort: legacy client memberships list
    try {
      const response = await apiClient.get('/client/memberships', { timeout: 15000 });
      const body = response.data;
      if (Array.isArray(body?.data)) {
        return normalizeScreenData({
          active_membership: screenMeta?.active_membership ?? null,
          memberships: body.data,
        });
      }
      if (Array.isArray(body)) {
        return normalizeScreenData({
          active_membership: screenMeta?.active_membership ?? null,
          memberships: body,
        });
      }
      return normalizeScreenData(body?.data ?? body);
    } catch (legacyErr) {
      if (__DEV__) {
        console.warn('[memberships] legacy fallback failed', legacyErr);
      }
      if (screenMeta) return screenMeta;
      throw subsErr;
    }
  }

  if (screenMeta) return screenMeta;
  return { active_membership: null, memberships: [] };
}

/**
 * Convenience wrapper — list of memberships from the screen endpoint.
 * Prefer getMembershipScreen() for full UI data.
 */
export async function getClientMemberships(): Promise<{
  list: ClientMembership[];
  total: number;
  screen: MembershipScreenData;
}> {
  const screen = await getMembershipScreen();
  return {
    list: screen.memberships,
    total: screen.memberships.length,
    screen,
  };
}

/**
 * POST /client/memberships/:subscription_id/renew/payment-intent
 * form-data: payment_method = stripe | apple_pay
 */
export async function createMembershipRenewPaymentIntent(params: {
  subscription_id: number | string;
  payment_method: MembershipPaymentMethod;
}): Promise<MembershipPaymentIntentResult> {
  const id = params.subscription_id;
  if (id == null || id === '') {
    return { data: null, message: 'Missing subscription id for renew.' };
  }

  try {
    const form = new FormData();
    form.append('payment_method', params.payment_method);

    if (__DEV__) {
      console.log('[memberships] renew payment-intent', {
        subscription_id: id,
        payment_method: params.payment_method,
      });
    }

    const response = await apiClient.post(
      `/client/memberships/${id}/renew/payment-intent`,
      form,
      { timeout: 60000, headers: { Accept: 'application/json' } }
    );

    const root = response.data as Record<string, unknown> | undefined;
    if (!root || typeof root !== 'object') {
      return { data: null, message: 'Could not start membership renew payment.' };
    }
    const parsed = parseMembershipPaymentIntentPayload(root);
    if (parsed?.client_secret) {
      if (root.success === false) {
        return {
          data: null,
          message:
            (typeof root.message === 'string' && root.message) ||
            'Membership renew payment could not be started.',
        };
      }
      return { data: parsed };
    }
    return {
      data: null,
      message:
        (typeof root.message === 'string' && root.message) ||
        firstLaravelErrorMessage(root) ||
        'Could not start membership renew payment.',
    };
  } catch (e) {
    const ax = e as AxiosError<Record<string, unknown>>;
    const status = ax.response?.status;
    const payload = ax.response?.data;
    const msg =
      firstLaravelErrorMessage(payload) ||
      (typeof payload?.message === 'string' ? payload.message : undefined) ||
      ax.message;

    if (status === 404 || status === 501 || status === 405) {
      return {
        data: null,
        notImplemented: true,
        message:
          msg ||
          'Renew payment API is not available. Backend endpoint POST /client/memberships/:id/renew/payment-intent is required.',
      };
    }
    return { data: null, message: msg || 'Could not start membership renew payment.' };
  }
}

/**
 * POST /client/memberships/:subscription_id/upgrade/payment-intent
 * form-data: target_plan = 1_month|3_month|6_month|12_month, payment_method = stripe|apple_pay
 */
export async function createMembershipUpgradePaymentIntent(params: {
  subscription_id: number | string;
  target_plan: MembershipTargetPlan;
  payment_method: MembershipPaymentMethod;
}): Promise<MembershipPaymentIntentResult> {
  const id = params.subscription_id;
  const targetPlan = normalizeMembershipTargetPlan(String(params.target_plan || ''));
  if (id == null || id === '') {
    return { data: null, message: 'Missing subscription id for upgrade.' };
  }
  if (!targetPlan) {
    return { data: null, message: 'Missing target plan for upgrade.' };
  }

  try {
    const form = new FormData();
    form.append('target_plan', targetPlan);
    form.append('payment_method', params.payment_method);

    if (__DEV__) {
      console.log('[memberships] upgrade payment-intent', {
        subscription_id: id,
        target_plan: targetPlan,
        payment_method: params.payment_method,
      });
    }

    const response = await apiClient.post(
      `/client/memberships/${id}/upgrade/payment-intent`,
      form,
      { timeout: 60000, headers: { Accept: 'application/json' } }
    );

    const root = response.data as Record<string, unknown> | undefined;
    if (!root || typeof root !== 'object') {
      return { data: null, message: 'Could not start membership upgrade payment.' };
    }
    const parsed = parseMembershipPaymentIntentPayload(root);
    if (parsed?.client_secret) {
      if (root.success === false) {
        return {
          data: null,
          message:
            (typeof root.message === 'string' && root.message) ||
            'Membership upgrade payment could not be started.',
        };
      }
      return { data: parsed };
    }
    return {
      data: null,
      message:
        (typeof root.message === 'string' && root.message) ||
        firstLaravelErrorMessage(root) ||
        'Could not start membership upgrade payment.',
    };
  } catch (e) {
    const ax = e as AxiosError<Record<string, unknown>>;
    const status = ax.response?.status;
    const payload = ax.response?.data;
    const msg =
      firstLaravelErrorMessage(payload) ||
      (typeof payload?.message === 'string' ? payload.message : undefined) ||
      ax.message;

    if (status === 404 || status === 501 || status === 405) {
      return {
        data: null,
        notImplemented: true,
        message:
          msg ||
          'Upgrade payment API is not available. Backend endpoint POST /client/memberships/:id/upgrade/payment-intent is required.',
      };
    }
    return { data: null, message: msg || 'Could not start membership upgrade payment.' };
  }
}

/**
 * Create payment intent for renew or upgrade (Postman).
 * Purchase is not wired — backend only provided renew/upgrade endpoints.
 */
export async function createMembershipPaymentIntent(params: {
  mode: MembershipPurchaseMode;
  plan_key: string;
  plan_id?: string | number;
  membership_id?: number;
  amount: number;
  payment_method: MembershipPaymentMethod;
  currency?: string;
}): Promise<MembershipPaymentIntentResult> {
  if (params.mode === 'renew') {
    if (params.membership_id == null) {
      return { data: null, message: 'Missing membership id for renew.' };
    }
    return createMembershipRenewPaymentIntent({
      subscription_id: params.membership_id,
      payment_method: params.payment_method,
    });
  }

  if (params.mode === 'upgrade') {
    if (params.membership_id == null) {
      return { data: null, message: 'Missing membership id for upgrade.' };
    }
    return createMembershipUpgradePaymentIntent({
      subscription_id: params.membership_id,
      target_plan: params.plan_key,
      payment_method: params.payment_method,
    });
  }

  return {
    data: null,
    notImplemented: true,
    message:
      'New membership purchase API is not available yet. Use Renew or Upgrade on an existing membership.',
  };
}

/**
 * POST /client/memberships/payment/confirm
 * form-data: payment_intent_id (from renew/upgrade payment-intent response)
 */
export async function confirmMembershipAfterStripe(params: {
  payment_intent_id: string;
  mode?: MembershipPurchaseMode;
  membership_id?: number;
}): Promise<{ success: boolean; message?: string; notImplemented?: boolean; data?: unknown }> {
  const paymentIntentId = String(params.payment_intent_id || '').trim();
  if (!paymentIntentId) {
    return { success: false, message: 'Missing payment_intent_id.' };
  }

  try {
    const form = new FormData();
    form.append('payment_intent_id', paymentIntentId);

    if (__DEV__) {
      console.log('[memberships] confirm payment_intent_id:', paymentIntentId);
    }

    const response = await apiClient.post(
      '/client/memberships/payment/confirm',
      form,
      { timeout: 60000, headers: { Accept: 'application/json' } }
    );

    const d = response.data as Record<string, unknown> | undefined;
    if (d?.success === false) {
      return {
        success: false,
        message:
          (typeof d.message === 'string' && d.message) ||
          firstLaravelErrorMessage(d) ||
          'Could not confirm membership payment.',
      };
    }

    return {
      success: true,
      message: typeof d?.message === 'string' ? d.message : undefined,
      data: d?.data,
    };
  } catch (e) {
    const ax = e as AxiosError<Record<string, unknown>>;
    const status = ax.response?.status;
    const payload = ax.response?.data;
    const msg =
      firstLaravelErrorMessage(payload) ||
      (typeof payload?.message === 'string' ? payload.message : undefined) ||
      ax.message;

    if (status === 404 || status === 501 || status === 405) {
      return {
        success: false,
        notImplemented: true,
        message:
          msg ||
          'Confirm API is not available. Backend endpoint POST /client/memberships/payment/confirm is required.',
      };
    }

    return { success: false, message: msg || 'Could not confirm membership payment.' };
  }
}
