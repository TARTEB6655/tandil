/**
 * Client wallet add-money (Stripe / Apple Pay).
 * Separate from shop checkout (`paymentService.ts`) so product/service payments are unaffected.
 *
 * Backend (Postman):
 * - POST /client/wallet/add-money/payment-intent  { amount, payment_method: "stripe" | "apple_pay" }
 * - POST /client/wallet/add-money/confirm         { payment_intent_id }
 */
import apiClient from './api';
import type { AxiosError } from 'axios';

export type WalletTopUpPaymentMethod = 'stripe' | 'apple_pay';

export interface WalletTopUpPaymentIntentData {
  client_secret: string;
  ephemeral_key?: string;
  customer?: string;
  payment_intent_id?: string;
}

export interface CreateWalletTopUpPaymentIntentBody {
  amount: number;
  payment_method: WalletTopUpPaymentMethod;
}

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

function parsePaymentIntentPayload(body: unknown): WalletTopUpPaymentIntentData | null {
  if (!body || typeof body !== 'object') return null;
  const root = body as Record<string, unknown>;
  const inner = root.data;

  const fromObject = (obj: Record<string, unknown>): WalletTopUpPaymentIntentData | null => {
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

export function extractWalletTopUpPaymentIntentId(clientSecret: string): string | null {
  const idx = clientSecret.indexOf('_secret_');
  if (idx <= 0) return null;
  return clientSecret.slice(0, idx);
}

/** POST /client/wallet/add-money/payment-intent */
export async function createWalletTopUpPaymentIntent(
  body: CreateWalletTopUpPaymentIntentBody
): Promise<{ data: WalletTopUpPaymentIntentData | null; message?: string; notImplemented?: boolean }> {
  try {
    const payload = {
      amount: Math.round(Number(body.amount) * 100) / 100,
      payment_method: body.payment_method,
    };
    if (__DEV__) {
      console.log('[wallet-top-up] payment-intent payload', payload);
    }

    const response = await apiClient.post<{
      success?: boolean;
      message?: string;
      data?: WalletTopUpPaymentIntentData;
    }>('/client/wallet/add-money/payment-intent', payload, { timeout: 60000 });

    const root = response.data as Record<string, unknown> | undefined;
    if (!root || typeof root !== 'object') {
      return { data: null, message: 'Could not start wallet top-up payment.' };
    }
    const parsed = parsePaymentIntentPayload(root);
    if (parsed?.client_secret) {
      if (root.success === false) {
        return {
          data: null,
          message:
            (typeof root.message === 'string' && root.message) ||
            'Wallet top-up payment could not be started.',
        };
      }
      return { data: parsed };
    }
    return {
      data: null,
      message:
        (typeof root.message === 'string' && root.message) ||
        firstLaravelErrorMessage(root) ||
        'Could not start wallet top-up payment.',
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
          'Wallet top-up payment API is not available yet. Backend endpoint POST /client/wallet/add-money/payment-intent is required.',
      };
    }

    return { data: null, message: msg || 'Could not start wallet top-up payment.' };
  }
}

/** POST /client/wallet/add-money/confirm */
export async function confirmWalletTopUpAfterStripe(
  paymentIntentId: string
): Promise<{ success: boolean; message?: string; notImplemented?: boolean; balance?: number }> {
  try {
    if (__DEV__) {
      console.log('[wallet-top-up] confirm payment_intent_id:', paymentIntentId);
    }

    const response = await apiClient.post<{
      success?: boolean;
      message?: string;
      data?: { balance?: number; wallet_balance?: number; [key: string]: unknown };
    }>('/client/wallet/add-money/confirm', { payment_intent_id: paymentIntentId }, { timeout: 60000 });

    const d = response.data;
    if (d?.success === false) {
      return {
        success: false,
        message: typeof d.message === 'string' ? d.message : 'Could not confirm wallet top-up.',
      };
    }

    const data = d?.data;
    const balanceRaw =
      data && typeof data === 'object'
        ? (data.balance ?? data.wallet_balance)
        : undefined;
    const balance =
      balanceRaw != null && Number.isFinite(Number(balanceRaw)) ? Number(balanceRaw) : undefined;

    return {
      success: true,
      message: typeof d?.message === 'string' ? d.message : undefined,
      balance,
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
          'Wallet top-up confirm API is not available yet. Backend endpoint POST /client/wallet/add-money/confirm is required.',
      };
    }

    return { success: false, message: msg || 'Could not confirm wallet top-up.' };
  }
}
