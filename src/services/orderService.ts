/**
 * Client order list (shop + services). Uses apiClient (Bearer customer token).
 * GET /api/orders — list with pagination.
 */
import apiClient from './api';
import type { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Order, OrderStatus, Address, PaymentMethod } from '../types';

const RATED_ORDERS_STORAGE_KEY = 'client_rated_order_ids';

export interface ShopOrderLineItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  price: string;
  subtotal: string;
  booking_date?: string | null;
  booking_slot?: string | null;
  /** Area-based pricing (when present on order line) */
  area_m2?: number | string | null;
  unit_price?: number | string | null;
  price_per_m2?: number | string | null;
  pricing_type?: string | null;
  product?: {
    id: number;
    name: string;
    description?: string | null;
    image?: string | null;
    image_url?: string | null;
    sku?: string | null;
    type?: string | null;
    estimated_arrival?: string | null;
    job_duration?: string | null;
    category?: { id?: number; name?: string } | null;
  } | null;
}

export interface ShopOrderVendorMapping {
  id: number;
  order_id?: number;
  vendor_id?: number;
  status?: string;
  tracking_number?: string | null;
  delivery_otp?: string | null;
  delivery_otp_expires_at?: string | null;
  delivery_otp_confirmed_at?: string | null;
  delivery_otp_sent_at?: string | null;
  delivery_otp_sent_to?: string | null;
  total_amount?: string | number | null;
}

export interface DeliveryOtpInfo {
  otp?: string | null;
  code?: string | null;
  expired?: boolean | null;
  delivery_channel?: string | null;
  expires_at?: string | null;
  instruction?: string | null;
}

export interface ShopOrderApi {
  id: number;
  user_id: number;
  total_amount: string;
  subtotal_amount?: string | null;
  tax_amount?: string | null;
  shipping_amount?: string | null;
  payment_status: string;
  order_status: string;
  payment_method: string;
  refunded_at?: string | null;
  refund_amount?: string | null;
  refund_reason?: string | null;
  created_at: string;
  booking_date?: string | null;
  booking_slot?: string | null;
  estimated_arrival?: string | null;
  job_duration?: string | null;
  special_instructions?: string | null;
  order_number?: string | null;
  fulfillment_type?: string | null;
  uses_delivery_otp?: boolean | null;
  delivery_otp?: string | DeliveryOtpInfo | null;
  otp?: string | null;
  items: ShopOrderLineItem[];
  shipping_address?: {
    id?: number;
    full_name?: string;
    phone_number?: string;
    street_address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    country?: string;
  } | null;
  vendor_mappings?: ShopOrderVendorMapping[];
}

export interface OrdersListPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number;
  to?: number;
}

export interface GetClientOrdersResponse {
  success?: boolean;
  message?: string;
  data?: ShopOrderApi[];
  pagination?: OrdersListPagination;
}

function lineItemsSummary(items: ShopOrderLineItem[] | undefined): string {
  if (!items?.length) return '—';
  const names = items
    .map((i) => i.product?.name?.trim() || `Product #${i.product_id}`)
    .filter(Boolean);
  if (names.length === 0) return '—';
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1} more`;
}

const ORDER_STATUS_MAP: Record<string, OrderStatus> = {
  pending: 'pending',
  processing: 'in_progress',
  confirmed: 'confirmed',
  assigned: 'assigned',
  in_progress: 'in_progress',
  completed: 'completed',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

const PAYMENT_MAP: Record<string, PaymentMethod> = {
  stripe: 'card',
  card: 'card',
  cash: 'cash',
  wallet: 'wallet',
  paypal: 'wallet',
};

/**
 * Map Laravel shop order to legacy `Order` shape for `OrderCard`.
 */
export function shopOrderToOrder(o: ShopOrderApi): Order {
  const status = ORDER_STATUS_MAP[String(o.order_status || '').toLowerCase()] ?? 'pending';
  const pay = PAYMENT_MAP[String(o.payment_method || '').toLowerCase()] ?? 'card';
  const total = parseFloat(String(o.total_amount ?? '0')) || 0;
  const created = new Date(o.created_at);
  const summary = lineItemsSummary(o.items);
  const addr: Address = {
    id: '0',
    street: summary,
    city: o.payment_status === 'paid' ? 'Paid' : o.payment_status || '—',
    state: '',
    zipCode: '',
    country: '',
  };
  return {
    id: String(o.id),
    userId: String(o.user_id),
    serviceId: String(o.items?.[0]?.product_id ?? o.id),
    status,
    totalAmount: total,
    createdAt: created,
    scheduledDate: created,
    address: addr,
    tracking: [],
    paymentMethod: pay,
  };
}

/**
 * GET /orders — customer order history (Postman: Orders - List).
 */
export async function getClientOrders(params?: {
  page?: number;
  per_page?: number;
}): Promise<{
  orders: ShopOrderApi[];
  pagination: OrdersListPagination | null;
  message?: string;
}> {
  const response = await apiClient.get<GetClientOrdersResponse>('/orders', {
    params: {
      page: params?.page ?? 1,
      per_page: params?.per_page ?? 30,
    },
    timeout: 20000,
  });
  const body = response.data;
  if (body?.success && Array.isArray(body.data)) {
    return { orders: body.data, pagination: body.pagination ?? null, message: body.message };
  }
  if (Array.isArray(body?.data)) {
    return { orders: body.data, pagination: body.pagination ?? null, message: body?.message };
  }
  return { orders: [], pagination: null, message: body?.message };
}

/**
 * GET /orders/cancelled — customer cancelled orders list.
 */
export async function getClientCancelledOrders(params?: {
  page?: number;
  per_page?: number;
}): Promise<{
  orders: ShopOrderApi[];
  pagination: OrdersListPagination | null;
  message?: string;
}> {
  const response = await apiClient.get<GetClientOrdersResponse>('/orders/cancelled', {
    params: {
      page: params?.page ?? 1,
      per_page: params?.per_page ?? 15,
    },
    timeout: 20000,
  });
  const body = response.data;
  if (body?.success && Array.isArray(body.data)) {
    return { orders: body.data, pagination: body.pagination ?? null, message: body.message };
  }
  if (Array.isArray(body?.data)) {
    return { orders: body.data, pagination: body.pagination ?? null, message: body?.message };
  }
  return { orders: [], pagination: null, message: body?.message };
}

export function mapShopOrdersToOrders(rows: ShopOrderApi[]): Order[] {
  return rows.map(shopOrderToOrder);
}

/** GET /orders/:id/track — order tracking (timeline, summary, photos). */
export interface TrackTimelineItem {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  timestamp: string | null;
}

export interface OrderTrackSummary {
  placed_at: string;
  booking_date?: string | null;
  booking_slot?: string | null;
  slot_start_time?: string | null;
  slot_end_time?: string | null;
  delivery_address: string;
  payment_method: string;
  payment_method_code?: string;
  total: number;
  currency: string;
  payment_status?: string;
  refund_amount?: number | string | null;
  refund_reason?: string | null;
  refunded_at?: string | null;
  special_instructions?: string | null;
  estimated_arrival?: string | null;
  job_duration?: string | null;
}

export interface OrderTrackData {
  order_id: number;
  order_number: string;
  order_number_short: string;
  order: ShopOrderApi & {
    shipping_address?: unknown;
    items?: ShopOrderLineItem[];
    vendor_mappings?: ShopOrderVendorMapping[];
  };
  order_summary: OrderTrackSummary;
  current_status: string;
  tracking: {
    status: string;
    payment_status?: string;
    timeline: TrackTimelineItem[];
    created_at?: string;
    updated_at?: string;
    paid_at?: string;
  };
  maintenance_photos: unknown[];
  can_cancel: boolean;
  /** Whether the client can still rate this order (preferred). */
  can_rate?: boolean;
  has_rated?: boolean;
  is_rated?: boolean;
  rating?: number | null;
  customer_rating?: number | null;
  review?: string | null;
  /** product | service */
  fulfillment_type?: string | null;
  /** When true, delivery is confirmed via in-app OTP (no SMS). */
  uses_delivery_otp?: boolean | null;
  /**
   * OTP shown to customer after vendor ships (in-app only).
   * Backend may send a plain string or an object `{ otp, code, expired, instruction }`.
   */
  delivery_otp?: string | DeliveryOtpInfo | null;
  delivery_otp_code?: string | null;
  show_delivery_otp?: boolean | null;
  delivery_otp_message?: string | null;
  otp?: string | null;
  vendor_mappings?: ShopOrderVendorMapping[];
}

/** Pull a usable OTP string — never stringify objects (avoids "[object Object]"). */
function pickOtpCode(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (candidate == null) continue;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      const digits = String(Math.trunc(candidate));
      if (digits.length >= 4) return digits;
      continue;
    }
    if (typeof candidate === 'string') {
      const s = candidate.trim().replace(/\s+/g, '');
      if (!s || s.toLowerCase() === '[objectobject]' || s.toLowerCase() === 'null') continue;
      if (/^\d{4,12}$/.test(s)) return s;
      if (/^[A-Za-z0-9-]{4,16}$/.test(s)) return s;
      continue;
    }
    if (typeof candidate === 'object') {
      const obj = candidate as Record<string, unknown>;
      const nested = pickOtpCode(obj.otp, obj.code, obj.delivery_otp, obj.delivery_otp_code);
      if (nested) return nested;
    }
  }
  return null;
}

function deliveryOtpMeta(value: unknown): {
  code: string | null;
  expired: boolean;
  instruction: string | null;
} {
  if (value == null) return { code: null, expired: false, instruction: null };
  if (typeof value === 'string' || typeof value === 'number') {
    return { code: pickOtpCode(value), expired: false, instruction: null };
  }
  if (typeof value === 'object') {
    const obj = value as DeliveryOtpInfo & Record<string, unknown>;
    return {
      code: pickOtpCode(obj.otp, obj.code),
      expired: Boolean(obj.expired),
      instruction:
        typeof obj.instruction === 'string' && obj.instruction.trim()
          ? obj.instruction.trim()
          : null,
    };
  }
  return { code: null, expired: false, instruction: null };
}

function otpFromVendorMappings(mappings: unknown): string | null {
  if (!Array.isArray(mappings)) return null;
  for (const row of mappings) {
    if (!row || typeof row !== 'object') continue;
    const m = row as ShopOrderVendorMapping;
    const code = pickOtpCode(m.delivery_otp);
    if (code) return code;
  }
  return null;
}

/** Resolve delivery OTP from track / detail payload (flexible backend field names). */
export function resolveDeliveryOtpFromTrack(
  track: OrderTrackData | null | undefined,
  detail?: ShopOrderApi | ClientOrderDetails | null
): {
  otp: string | null;
  visible: boolean;
  expired: boolean;
  instruction: string | null;
  fulfillmentType: string;
  usesOtp: boolean;
} {
  if (!track && !detail) {
    return {
      otp: null,
      visible: false,
      expired: false,
      instruction: null,
      fulfillmentType: '',
      usesOtp: false,
    };
  }
  const anyTrack = (track ?? {}) as OrderTrackData & Record<string, unknown>;
  const order = (track?.order ?? detail ?? {}) as Record<string, unknown>;
  const tracking = (track?.tracking ?? {}) as Record<string, unknown>;
  const fulfillmentType = String(
    track?.fulfillment_type ??
      detail?.fulfillment_type ??
      order.fulfillment_type ??
      tracking.fulfillment_type ??
      ''
  )
    .trim()
    .toLowerCase();
  const usesOtp = Boolean(
    track?.uses_delivery_otp ??
      detail?.uses_delivery_otp ??
      order.uses_delivery_otp ??
      tracking.uses_delivery_otp
  );

  const rootMeta = deliveryOtpMeta(
    track?.delivery_otp ?? detail?.delivery_otp ?? order.delivery_otp ?? anyTrack.delivery_otp
  );
  const otp =
    pickOtpCode(
      otpFromVendorMappings(detail?.vendor_mappings),
      otpFromVendorMappings(track?.vendor_mappings),
      otpFromVendorMappings(order.vendor_mappings),
      rootMeta.code,
      track?.delivery_otp_code,
      detail?.otp,
      track?.otp,
      anyTrack.otp,
      order.otp
    ) || null;

  const status = String(
    track?.tracking?.status ?? track?.current_status ?? detail?.order_status ?? order.order_status ?? ''
  )
    .trim()
    .toLowerCase();
  const isShippedPhase =
    status.includes('ship') ||
    status.includes('out_for_delivery') ||
    status.includes('out for delivery') ||
    status === 'dispatched';
  const showFlag = Boolean(
    track?.show_delivery_otp ?? order.show_delivery_otp ?? tracking.show_delivery_otp
  );
  const instruction = rootMeta.instruction;
  const expired = rootMeta.expired && !otp;
  const visible =
    (Boolean(otp) || expired || Boolean(instruction)) &&
    (fulfillmentType === 'product' || fulfillmentType === '' || usesOtp || showFlag) &&
    (isShippedPhase || showFlag || usesOtp || Boolean(otp) || expired);

  return {
    otp,
    visible: visible && (Boolean(otp) || expired || Boolean(instruction)),
    expired,
    instruction,
    fulfillmentType,
    usesOtp: usesOtp || Boolean(otp) || expired,
  };
}

export interface GetOrderTrackResponse {
  success?: boolean;
  message?: string;
  data?: OrderTrackData;
}

/** GET /orders/:id — full client order details (Postman alternative route). */
export interface ClientOrderDetails extends ShopOrderApi {
  order_number?: string | null;
  fulfillment_type?: string | null;
  uses_delivery_otp?: boolean | null;
  delivery_otp?: string | DeliveryOtpInfo | null;
  otp?: string | null;
  vendor_mappings?: ShopOrderVendorMapping[];
}

export interface GetClientOrderDetailsResponse {
  success?: boolean;
  message?: string;
  data?: ClientOrderDetails;
  order_number?: string;
  order_number_short?: string;
  order_summary?: OrderTrackSummary;
  fulfillment_type?: string | null;
  uses_delivery_otp?: boolean | null;
  delivery_otp?: string | DeliveryOtpInfo | null;
  otp?: string | null;
}

/**
 * GET /orders/:id
 * Postman: "Orders - Get Details (Alternative Route)"
 */
export async function getClientOrderDetails(
  orderId: string | number
): Promise<{
  data: ClientOrderDetails | null;
  order_summary?: OrderTrackSummary | null;
  message?: string;
  delivery_otp?: string | DeliveryOtpInfo | null;
  uses_delivery_otp?: boolean | null;
  fulfillment_type?: string | null;
}> {
  const id = encodeURIComponent(String(orderId));
  const response = await apiClient.get<GetClientOrderDetailsResponse>(`/orders/${id}`, {
    timeout: 25000,
  });
  const body = response.data;
  const raw = body?.data ?? null;
  if (!raw) {
    return { data: null, message: body?.message };
  }
  const merged: ClientOrderDetails = {
    ...raw,
    order_number: raw.order_number ?? body.order_number ?? null,
    fulfillment_type: raw.fulfillment_type ?? body.fulfillment_type ?? null,
    uses_delivery_otp: raw.uses_delivery_otp ?? body.uses_delivery_otp ?? null,
    delivery_otp: raw.delivery_otp ?? body.delivery_otp ?? null,
    otp: raw.otp ?? body.otp ?? null,
  };
  return {
    data: merged,
    order_summary: body.order_summary ?? null,
    message: body.message,
    delivery_otp: merged.delivery_otp,
    uses_delivery_otp: merged.uses_delivery_otp,
    fulfillment_type: merged.fulfillment_type,
  };
}

/**
 * GET /orders/:id/track
 */
export async function getOrderTrack(
  orderId: string | number
): Promise<{ data: OrderTrackData | null; message?: string }> {
  const id = encodeURIComponent(String(orderId));
  const response = await apiClient.get<GetOrderTrackResponse>(`/orders/${id}/track`, {
    timeout: 25000,
  });
  const body = response.data;
  if (body?.success && body.data) {
    return { data: body.data, message: body.message };
  }
  if (body?.data) {
    return { data: body.data, message: body.message };
  }
  return { data: null, message: body?.message };
}

/** Root `refund` object on POST /orders/:id/cancel (alongside `data` order). */
export interface CancelOrderRefundSummary {
  stage?: string;
  refund_percent?: number;
  refund_amount?: number;
  service_fee_amount?: number;
  wallet_credited?: number;
  wallet_expires_at?: string;
}

export interface CancelClientOrderResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
  refund?: CancelOrderRefundSummary;
}

/**
 * POST /orders/:id/cancel — cancel order (logged-in customer).
 * Matches Postman: `POST {{base_url}}/api/orders/{{order_id}}/cancel`
 */
export async function cancelClientOrder(
  orderId: string | number
): Promise<{ success: boolean; message?: string; refund?: CancelOrderRefundSummary }> {
  const id = encodeURIComponent(String(orderId));
  try {
    const response = await apiClient.post<CancelClientOrderResponse>(`/orders/${id}/cancel`, {}, { timeout: 30000 });
    const body = response.data;
    if (body?.success === true) {
      return { success: true, message: body.message, refund: body.refund };
    }
    if (response.status >= 200 && response.status < 300 && body?.success !== false) {
      return { success: true, message: body?.message, refund: body.refund };
    }
    return { success: false, message: body?.message || 'Could not cancel order.' };
  } catch (e) {
    const ax = e as AxiosError<{ message?: string }>;
    const msg = ax.response?.data?.message || ax.message;
    return { success: false, message: msg };
  }
}

/**
 * GET /orders/:id/cancel-track — cancelled order refund tracking.
 */
export async function getCancelledOrderTrack(
  orderId: string | number
): Promise<{ data: OrderTrackData | null; message?: string }> {
  const id = encodeURIComponent(String(orderId));
  const response = await apiClient.get<GetOrderTrackResponse>(`/orders/${id}/cancel-track`, {
    timeout: 25000,
  });
  const body = response.data;
  if (body?.success && body.data) {
    return { data: body.data, message: body.message };
  }
  if (body?.data) {
    return { data: body.data, message: body.message };
  }
  return { data: null, message: body?.message };
}

/**
 * POST /orders/:id/rate — rate a completed/delivered order.
 * Body: { rating: number, review: string }
 */
export async function rateClientOrder(params: {
  orderId: string | number;
  rating: number;
  review: string;
}): Promise<{ success: boolean; message?: string }> {
  const id = encodeURIComponent(String(params.orderId));
  try {
    const response = await apiClient.post<{ success?: boolean; message?: string }>(
      `/orders/${id}/rate`,
      {
        rating: params.rating,
        review: params.review.trim(),
      },
      {
        timeout: 20000,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      }
    );
    const body = response.data;
    if (body?.success === true) {
      await markOrderAsRatedLocally(params.orderId);
      return { success: true, message: body.message };
    }
    if (response.status >= 200 && response.status < 300 && body?.success !== false) {
      await markOrderAsRatedLocally(params.orderId);
      return { success: true, message: body?.message };
    }
    return { success: false, message: body?.message || 'Could not submit rating.' };
  } catch (e) {
    const ax = e as AxiosError<{ message?: string }>;
    return {
      success: false,
      message: ax.response?.data?.message || ax.message || 'Could not submit rating.',
    };
  }
}

async function getRatedOrderIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RATED_ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Persist that this order was rated so Rate Service stays hidden after submit. */
export async function markOrderAsRatedLocally(orderId: string | number): Promise<void> {
  const id = String(orderId);
  const ids = await getRatedOrderIds();
  if (ids.includes(id)) return;
  ids.push(id);
  await AsyncStorage.setItem(RATED_ORDERS_STORAGE_KEY, JSON.stringify(ids));
}

export async function isOrderRatedLocally(orderId: string | number): Promise<boolean> {
  const ids = await getRatedOrderIds();
  return ids.includes(String(orderId));
}

/** True when this order should no longer show the Rate Service button. */
export function isOrderAlreadyRated(track: OrderTrackData | null | undefined): boolean {
  if (!track) return false;

  if (track.can_rate === false) return true;
  if (track.has_rated === true || track.is_rated === true) return true;

  const ratingValue = Number(track.rating ?? track.customer_rating ?? 0);
  if (Number.isFinite(ratingValue) && ratingValue > 0) return true;

  if (typeof track.review === 'string' && track.review.trim().length > 0) return true;

  return false;
}

export function maintenancePhotoUrl(entry: unknown): string | null {
  if (typeof entry === 'string') {
    const s = entry.trim();
    if (s.length > 0) return s;
  }
  if (entry && typeof entry === 'object' && 'url' in entry && typeof (entry as { url: string }).url === 'string') {
    return (entry as { url: string }).url;
  }
  if (entry && typeof entry === 'object' && 'image_url' in entry) {
    const u = (entry as { image_url?: string }).image_url;
    if (typeof u === 'string' && u.length > 0) return u;
  }
  return null;
}
