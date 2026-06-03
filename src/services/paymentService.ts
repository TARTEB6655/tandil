/**
 * Shop checkout payments (Stripe). Backend must create PaymentIntents and optionally finalize orders.
 *
 * Matches mobile Postman: POST /api/shop/checkout/stripe/payment-intent
 * Body: { is_buy_now, coupon_code, shipping, optional product_id + quantity for buy-now, use_wallet, wallet_amount }
 * Response: { data: { client_secret } } for card flow; wallet-only may return success + order without `client_secret`.
 *
 * - POST /shop/checkout/confirm — body: { payment_intent_id } — after Payment Sheet success (Postman: "8. POST Checkout confirm")
 */
import apiClient from './api';
import { AxiosError } from 'axios';

export interface ShippingPayload {
  full_name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}

export interface CreatePaymentIntentBody {
  is_buy_now?: boolean;
  product_id?: number;
  quantity?: number;
  selected_option_ids?: number[];
  use_wallet?: boolean;
  wallet_amount?: number;
  /** Applied coupon code, or empty string when none (POST /shop/checkout/stripe/payment-intent). */
  coupon_code?: string;
  shipping: ShippingPayload;
}

export interface CreatePaymentIntentData {
  client_secret: string;
  ephemeral_key?: string;
  customer?: string;
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

function parsePaymentIntentPayload(
  body: unknown
): CreatePaymentIntentData | null {
  if (!body || typeof body !== 'object') return null;
  const root = body as Record<string, unknown>;
  const inner = root.data;
  if (inner && typeof inner === 'object' && typeof (inner as CreatePaymentIntentData).client_secret === 'string') {
    return inner as CreatePaymentIntentData;
  }
  if (typeof root.client_secret === 'string') {
    return {
      client_secret: root.client_secret,
      ephemeral_key: typeof root.ephemeral_key === 'string' ? root.ephemeral_key : undefined,
      customer: typeof root.customer === 'string' ? root.customer : undefined,
    };
  }
  return null;
}

/** Laravel finalized checkout with wallet only (no PaymentIntent / no card step). */
function dataIndicatesWalletOnlyComplete(root: Record<string, unknown>): boolean {
  if (root.success === false) return false;
  const raw = root.data;
  if (!raw || typeof raw !== 'object') return false;
  const d = raw as Record<string, unknown>;
  if (typeof d.client_secret === 'string' && d.client_secret.length > 0) return false;
  if (d.checkout_complete === true || d.paid_with_wallet_only === true || d.wallet_only === true) return true;
  if (d.order != null && typeof d.order === 'object') return true;
  if (typeof d.order_id === 'number' && Number.isFinite(d.order_id)) return true;
  if (typeof d.order_id === 'string' && d.order_id.trim().length > 0 && !Number.isNaN(Number(d.order_id))) return true;
  return false;
}

export async function createStripePaymentIntent(
  body: CreatePaymentIntentBody
): Promise<{ data: CreatePaymentIntentData | null; message?: string; walletOnlyComplete?: boolean }> {
  try {
    const response = await apiClient.post<{
      success?: boolean;
      message?: string;
      data?: CreatePaymentIntentData;
    }>('/shop/checkout/stripe/payment-intent', body, { timeout: 60000 });

    const root = response.data as Record<string, unknown> | undefined;
    if (!root || typeof root !== 'object') {
      return { data: null, message: 'Could not start payment.' };
    }
    const parsed = parsePaymentIntentPayload(root);
    const secret = parsed?.client_secret;

    if (secret) {
      if (root.success === false) {
        return {
          data: null,
          message: (typeof root.message === 'string' && root.message) || 'Payment could not be started.',
        };
      }
      return { data: parsed };
    }

    if (dataIndicatesWalletOnlyComplete(root)) {
      return {
        data: null,
        message: typeof root.message === 'string' ? root.message : undefined,
        walletOnlyComplete: true,
      };
    }

    return {
      data: null,
      message:
        (typeof root.message === 'string' && root.message) ||
        firstLaravelErrorMessage(root) ||
        'Could not start payment.',
    };
  } catch (e) {
    const ax = e as AxiosError<Record<string, unknown>>;
    const payload = ax.response?.data;
    const msg =
      firstLaravelErrorMessage(payload) ||
      (typeof payload?.message === 'string' ? payload.message : undefined) ||
      (payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error?: string }).error)
        : undefined) ||
      ax.message;
    return { data: null, message: msg };
  }
}

export function extractPaymentIntentId(clientSecret: string): string | null {
  const idx = clientSecret.indexOf('_secret_');
  if (idx <= 0) return null;
  return clientSecret.slice(0, idx);
}

export async function confirmCheckoutAfterStripe(
  paymentIntentId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await apiClient.post<{
      success?: boolean;
      message?: string;
      data?: unknown;
    }>('/shop/checkout/confirm', { payment_intent_id: paymentIntentId }, { timeout: 60000 });

    const d = response.data;
    if (d?.success === false) {
      return { success: false, message: d.message };
    }
    if (d?.success === true) {
      return { success: true, message: d.message };
    }
    // Laravel may return 200 + { data: { order_id, ... } } without a `success` flag
    if (response.status >= 200 && response.status < 300 && d && d.data != null) {
      return { success: true, message: d.message };
    }
    if (response.status >= 200 && response.status < 300 && d && d.success !== false) {
      return { success: true, message: d.message };
    }
    return { success: false, message: d?.message || 'Order confirmation failed.' };
  } catch (e) {
    const ax = e as AxiosError<{ message?: string }>;
    const msg = ax.response?.data?.message || ax.message;
    return { success: false, message: msg };
  }
}
