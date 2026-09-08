import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import apiClient from './api';
import { API_CONFIG, buildFullImageUrl } from '../config/api';

export type VendorOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface VendorOrderListItem {
  id: string;
  /** Parent shop order id when present. */
  order_id?: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  product_name?: string;
  product_image?: string;
  items_count?: number;
  quantity?: number;
  unit_price?: number;
  total_amount: number;
  status: VendorOrderStatus;
  status_label?: string;
  order_date: string;
  delivery_date?: string;
  tracking_number?: string;
  /** product | service — confirm/ship only apply to product. */
  fulfillment_type?: string;
  can_confirm?: boolean;
  can_ship?: boolean;
  can_mark_delivered?: boolean;
  can_cancel?: boolean;
  can_update_status?: boolean;
  uses_delivery_otp?: boolean;
  can_confirm_delivery_otp?: boolean;
  can_resend_delivery_otp?: boolean;
  confirm_delivery_endpoint?: string | null;
  resend_delivery_otp_endpoint?: string | null;
  primary_action?: string | null;
  primary_action_label?: string | null;
}

export interface VendorOrderTimelineStep {
  status: string;
  label?: string;
  note?: string;
  at?: string;
  at_display?: string;
  completed?: boolean;
  current?: boolean;
}

export interface VendorOrderLineItem {
  id?: string;
  product_id?: string;
  product_name: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
  total?: number;
  sku?: string;
  area_m2?: number;
  price_per_m2?: number;
  pricing_type?: string;
}

export interface VendorOrderNote {
  id?: string | number;
  note: string;
  created_at?: string;
  author?: string;
}

export interface VendorOrderStatusOption {
  value: VendorOrderStatus | string;
  label: string;
  enabled?: boolean;
  selected?: boolean;
  completed?: boolean;
}

export interface VendorOrderDetail extends VendorOrderListItem {
  /** Parent shop order id (used by some action endpoints). */
  shop_order_id?: string;
  currency?: string;
  subtotal?: number;
  shipping?: number;
  tax?: number;
  payment_method?: string;
  payment_status?: string;
  order_date_display?: string;
  delivery_date_display?: string;
  tracking_display?: string;
  notes: VendorOrderNote[];
  timeline: VendorOrderTimelineStep[];
  items: VendorOrderLineItem[];
  available_statuses: VendorOrderStatusOption[];
  can_confirm?: boolean;
  can_ship?: boolean;
  can_mark_delivered?: boolean;
  can_cancel?: boolean;
  /** Product orders only — when false, vendor can track but not change status. */
  can_update_status?: boolean;
  /** Product delivery flow uses OTP confirmation when true. */
  uses_delivery_otp?: boolean;
  can_confirm_delivery_otp?: boolean;
  can_resend_delivery_otp?: boolean;
  resend_delivery_otp_available_in_seconds?: number;
  confirm_delivery_endpoint?: string | null;
  resend_delivery_otp_endpoint?: string | null;
  fulfillment_note?: string | null;
  can_contact_customer: boolean;
  can_print_invoice: boolean;
  can_download_order: boolean;
  contact_path?: string;
  invoice_path?: string;
  download_path?: string;
  track_path?: string;
}

export interface VendorOrderContact {
  customer_name: string;
  phone?: string;
  email?: string;
  call_url?: string;
  whatsapp_url?: string;
  mailto_url?: string;
}

export interface VendorOrderTrackTimelineItem {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  current?: boolean;
  timestamp: string | null;
  date?: string | null;
  date_display?: string | null;
  icon?: string;
  color?: string;
}

export interface VendorOrderTrackData {
  order_id?: string;
  vendor_order_id: string;
  order_number: string;
  order_number_short?: string;
  tracking_number?: string;
  tracking_display?: string;
  fulfillment_type?: string;
  status: string;
  status_label?: string;
  current_status?: string;
  vendor_status?: string;
  vendor_status_label?: string;
  timeline: VendorOrderTrackTimelineItem[];
}

export interface VendorOrderStatusUpdate {
  status: VendorOrderStatus;
  note?: string;
  tracking_number?: string;
}

export interface VendorOrdersPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface VendorOrdersListResult {
  orders: VendorOrderListItem[];
  pagination: VendorOrdersPagination | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return undefined;
}

function pickBool(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
  }
  return undefined;
}

/** Prefer API validation message; map 422 confirm-delivery failures to "Invalid OTP". */
function toConfirmDeliveryError(error: unknown): Error {
  const ax = error as {
    response?: {
      status?: number;
      data?: {
        message?: string;
        error?: string;
        errors?: Record<string, string[] | string>;
      };
    };
    message?: string;
  };
  const status = ax.response?.status;
  const data = ax.response?.data;
  const fieldErrors = data?.errors;
  let fieldMessage = '';
  if (fieldErrors && typeof fieldErrors === 'object') {
    const otpErr = fieldErrors.otp;
    if (Array.isArray(otpErr) && otpErr[0]) fieldMessage = String(otpErr[0]);
    else if (typeof otpErr === 'string') fieldMessage = otpErr;
    else {
      const firstKey = Object.keys(fieldErrors)[0];
      const first = firstKey ? fieldErrors[firstKey] : null;
      if (Array.isArray(first) && first[0]) fieldMessage = String(first[0]);
      else if (typeof first === 'string') fieldMessage = first;
    }
  }
  const apiMessage = pickString(data?.message, data?.error, fieldMessage);

  if (status === 422) {
    return new Error(apiMessage || 'Invalid OTP');
  }
  if (apiMessage) return new Error(apiMessage);

  const raw = String(ax.message || '').trim();
  if (/status code 422/i.test(raw)) return new Error('Invalid OTP');
  if (raw && !/^request failed with status code/i.test(raw)) return new Error(raw);
  return new Error(raw || 'Could not confirm delivery. Check the OTP and try again.');
}

function extractPayload(payload: unknown): Record<string, unknown> {
  const body = asRecord(payload);
  if (!body) throw new Error('Invalid order response.');
  if (body.success === false || body.status === false) {
    throw new Error(pickString(body.message) || 'Order request failed.');
  }
  return asRecord(body.data) ?? body;
}

function mapImage(raw: unknown): string | undefined {
  const value = pickString(raw);
  if (!value) return undefined;
  return buildFullImageUrl(value);
}

function mapStatus(raw: unknown): VendorOrderStatus {
  const status = pickString(raw).toLowerCase();
  if (
    status === 'pending' ||
    status === 'confirmed' ||
    status === 'processing' ||
    status === 'shipped' ||
    status === 'delivered' ||
    status === 'cancelled'
  ) {
    return status;
  }
  return 'pending';
}

function mapPagination(raw: unknown): VendorOrdersPagination | null {
  const row = asRecord(raw);
  if (!row) return null;
  const current_page = pickNumber(row.current_page, row.page);
  const last_page = pickNumber(row.last_page, row.total_pages);
  const per_page = pickNumber(row.per_page, row.limit);
  const total = pickNumber(row.total);
  if (current_page == null || last_page == null || per_page == null || total == null) {
    return null;
  }
  return { current_page, last_page, per_page, total };
}

function mapLineItem(raw: unknown): VendorOrderLineItem | null {
  const row = asRecord(raw);
  if (!row) return null;
  const product_name = pickString(row.product_name, row.name, row.title);
  if (!product_name) return null;
  const quantity = pickNumber(row.quantity, row.qty) ?? 1;
  const unit_price = pickNumber(row.unit_price, row.price) ?? 0;
  return {
    id: pickString(row.id, row.order_item_id, row.item_id) || undefined,
    product_id: pickString(row.product_id, row.vendor_product_id) || undefined,
    product_name,
    product_image: mapImage(row.product_image ?? row.image ?? row.image_url),
    quantity,
    unit_price,
    total: pickNumber(row.total, row.line_total, row.subtotal) ?? quantity * unit_price,
    sku: pickString(row.sku) || undefined,
    area_m2: pickNumber(row.area_m2, row.area, row.required_area) ?? undefined,
    price_per_m2: pickNumber(row.price_per_m2, row.unit_price_per_m2) ?? undefined,
    pricing_type: pickString(row.pricing_type) || undefined,
  };
}

function mapTimelineStep(raw: unknown): VendorOrderTimelineStep | null {
  const row = asRecord(raw);
  if (!row) return null;
  const known = new Set([
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
  ]);
  const keyOrStep = pickString(row.key, row.step).toLowerCase();
  const statusField = pickString(row.status).toLowerCase();
  const status = known.has(keyOrStep)
    ? keyOrStep
    : known.has(statusField)
      ? statusField
      : pickString(row.key, row.step, row.status);
  if (!status) return null;
  return {
    status,
    label: pickString(row.label, row.title, row.status_label) || undefined,
    note: pickString(row.note, row.description) || undefined,
    at: pickString(row.at, row.date, row.created_at, row.timestamp) || undefined,
    at_display: pickString(row.date_display, row.at_display) || undefined,
    completed: pickBool(row.completed, row.is_completed, row.done),
    current: pickBool(row.current, row.is_current),
  };
}

function mapNote(raw: unknown): VendorOrderNote | null {
  if (typeof raw === 'string' && raw.trim()) {
    return { note: raw.trim() };
  }
  const row = asRecord(raw);
  if (!row) return null;
  const note = pickString(row.note, row.message, row.content, row.text);
  if (!note) return null;
  return {
    id: row.id as string | number | undefined,
    note,
    created_at: pickString(row.created_at, row.at) || undefined,
    author: pickString(row.author, row.created_by, row.user_name) || undefined,
  };
}

function mapCustomerFields(row: Record<string, unknown>): {
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
} {
  const customer = asRecord(row.customer);
  const address = asRecord(customer?.address);
  const composedAddress = [
    pickString(address?.street_address),
    [pickString(address?.city), pickString(address?.state), pickString(address?.zip_code)]
      .filter(Boolean)
      .join(' '),
    pickString(address?.country),
  ]
    .filter(Boolean)
    .join('\n');
  const addressText = pickString(
    row.customer_address,
    row.address,
    row.shipping_address,
    customer?.address_display,
    customer?.address_text,
    composedAddress,
    customer?.location
  );

  return {
    customer_name: pickString(
      row.customer_name,
      row.buyer_name,
      customer?.name,
      address?.full_name,
      row.name,
      'Customer'
    ),
    customer_phone:
      pickString(
        row.customer_phone,
        row.phone,
        row.mobile,
        customer?.phone_display,
        customer?.phone,
        address?.phone_number
      ) || undefined,
    customer_email:
      pickString(row.customer_email, row.email, customer?.email_display, customer?.email) ||
      undefined,
    customer_address: addressText || undefined,
  };
}

function collectLineItems(row: Record<string, unknown>): VendorOrderLineItem[] {
  const itemsRaw = Array.isArray(row.items)
    ? row.items
    : Array.isArray(row.products)
      ? row.products
      : Array.isArray(row.line_items)
        ? row.line_items
        : [];
  const items = itemsRaw
    .map(mapLineItem)
    .filter((item): item is VendorOrderLineItem => item != null);

  if (items.length === 0 && row.product != null) {
    const single = mapLineItem(row.product);
    if (single) items.push(single);
  }
  return items;
}

function mapOrderListItem(raw: unknown): VendorOrderListItem | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = pickString(
    row.id,
    row.vendor_order_mapping_id,
    row.order_mapping_id,
    row.vendor_order_id
  );
  if (!id) return null;

  const items = collectLineItems(row);
  const firstItem = items[0] ?? null;
  const customer = mapCustomerFields(row);
  const product = asRecord(row.product);
  const actions = asRecord(row.actions) ?? {};
  const fulfillmentType = pickString(row.fulfillment_type).toLowerCase() || undefined;

  return {
    id,
    order_id: pickString(row.order_id) || undefined,
    order_number: pickString(row.order_number, row.number, row.reference, `ORD-${id}`),
    customer_name: customer.customer_name,
    customer_phone: customer.customer_phone,
    customer_email: customer.customer_email,
    customer_address: customer.customer_address,
    product_name:
      pickString(row.product_name, product?.name, firstItem?.product_name) || undefined,
    product_image: mapImage(
      row.product_image ?? product?.image_url ?? product?.image ?? firstItem?.product_image
    ),
    items_count:
      pickNumber(row.items_count, row.product_count, row.products_count, items.length) ??
      undefined,
    quantity: pickNumber(row.quantity, product?.qty, firstItem?.quantity) ?? undefined,
    unit_price: pickNumber(row.unit_price, product?.unit_price, firstItem?.unit_price) ?? undefined,
    total_amount:
      pickNumber(row.total_amount, row.total, row.grand_total, row.amount) ?? 0,
    status: mapStatus(row.status ?? row.shop_status ?? row.vendor_status ?? row.current_status),
    status_label:
      pickString(
        row.status_label,
        row.vendor_status_label,
        row.status_display,
        row.shop_status_label,
        row.current_status
      ) || undefined,
    order_date:
      pickString(
        row.order_date,
        row.order_date_label,
        row.created_at,
        row.placed_at,
        asRecord(row.order_info)?.placed_at
      ) || '',
    delivery_date:
      pickString(
        row.delivery_date,
        row.delivered_at,
        row.expected_delivery,
        asRecord(row.order_info)?.estimated_delivery
      ) || undefined,
    tracking_number:
      pickString(row.tracking_number, row.tracking) || undefined,
    fulfillment_type: fulfillmentType,
    can_confirm: pickBool(actions.can_confirm) ?? undefined,
    can_ship: pickBool(actions.can_ship) ?? undefined,
    can_mark_delivered: pickBool(actions.can_mark_delivered) ?? undefined,
    can_cancel: pickBool(actions.can_cancel) ?? undefined,
    can_update_status: pickBool(row.can_update_status, actions.can_update_status) ?? undefined,
    uses_delivery_otp: pickBool(row.uses_delivery_otp, actions.uses_delivery_otp) ?? undefined,
    can_confirm_delivery_otp: pickBool(actions.can_confirm_delivery_otp) ?? undefined,
    can_resend_delivery_otp: pickBool(actions.can_resend_delivery_otp) ?? undefined,
    confirm_delivery_endpoint: pickString(actions.confirm_delivery_endpoint) || null,
    resend_delivery_otp_endpoint: pickString(actions.resend_delivery_otp_endpoint) || null,
    primary_action: pickString(actions.primary_action) || null,
    primary_action_label: pickString(actions.primary_action_label) || null,
  };
}

function mapAvailableStatuses(row: Record<string, unknown>): VendorOrderStatusOption[] {
  const availableRaw = Array.isArray(row.available_statuses) ? row.available_statuses : [];
  const fromAvailable = availableRaw
    .map((item) => {
      const opt = asRecord(item);
      if (!opt) return null;
      const value = pickString(opt.value, opt.status, opt.key);
      if (!value) return null;
      return {
        value,
        label: pickString(opt.label, opt.name, value),
        enabled: pickBool(opt.enabled) ?? true,
        selected: pickBool(opt.selected) ?? false,
        completed: pickBool(opt.completed) ?? false,
      };
    })
    .filter((item): item is VendorOrderStatusOption => item != null);

  if (fromAvailable.length > 0) return fromAvailable;

  const optionsRaw = Array.isArray(row.status_options) ? row.status_options : [];
  return optionsRaw
    .map((item) => {
      const opt = asRecord(item);
      if (!opt) return null;
      const value = pickString(opt.value, opt.status, opt.key);
      if (!value) return null;
      const enabled = pickBool(opt.enabled) ?? true;
      if (!enabled) return null;
      return {
        value,
        label: pickString(opt.label, opt.name, value),
        enabled,
        selected: pickBool(opt.selected) ?? false,
        completed: pickBool(opt.completed) ?? false,
      };
    })
    .filter((item): item is VendorOrderStatusOption => item != null);
}

function mapOrderDetail(raw: unknown): VendorOrderDetail {
  const row = asRecord(raw);
  if (!row) throw new Error('Order not found.');

  const base = mapOrderListItem(row);
  if (!base) throw new Error('Order not found.');

  const items = collectLineItems(row);

  const timelineRaw = Array.isArray(row.timeline)
    ? row.timeline
    : Array.isArray(row.status_timeline)
      ? row.status_timeline
      : Array.isArray(row.tracking)
        ? row.tracking
        : [];
  const timeline = timelineRaw
    .map(mapTimelineStep)
    .filter((step): step is VendorOrderTimelineStep => step != null);

  let notes: VendorOrderNote[] = [];
  if (typeof row.order_notes === 'string' && row.order_notes.trim()) {
    notes = [{ note: row.order_notes.trim() }];
  } else if (typeof row.notes === 'string' && row.notes.trim()) {
    notes = [{ note: row.notes.trim() }];
  } else {
    const notesRaw = Array.isArray(row.notes)
      ? row.notes
      : Array.isArray(row.order_notes)
        ? row.order_notes
        : [];
    notes = notesRaw.map(mapNote).filter((note): note is VendorOrderNote => note != null);
  }

  const actions = asRecord(row.actions) ?? {};
  const orderInfo = asRecord(row.order_info) ?? {};

  return {
    ...base,
    shop_order_id: pickString(row.order_id) || undefined,
    product_name: base.product_name ?? items[0]?.product_name,
    product_image: base.product_image ?? items[0]?.product_image,
    items_count: base.items_count ?? items.length,
    currency: pickString(row.currency) || 'AED',
    subtotal: pickNumber(row.subtotal, row.sub_total) ?? undefined,
    shipping: pickNumber(row.shipping, row.shipping_amount, row.shipping_fee) ?? undefined,
    tax: pickNumber(row.tax, row.tax_amount, row.vat) ?? undefined,
    payment_method: pickString(row.payment_method) || undefined,
    payment_status: pickString(row.payment_status) || undefined,
    order_date_display:
      pickString(row.order_date_display, orderInfo.order_date, base.order_date) || undefined,
    delivery_date_display:
      pickString(row.delivery_date_display, orderInfo.delivery_date, base.delivery_date) ||
      undefined,
    tracking_display:
      pickString(row.tracking_display, orderInfo.tracking, base.tracking_number) || undefined,
    notes,
    timeline,
    items,
    available_statuses: mapAvailableStatuses(row),
    can_confirm: pickBool(actions.can_confirm) ?? undefined,
    can_ship: pickBool(actions.can_ship) ?? undefined,
    can_mark_delivered: pickBool(actions.can_mark_delivered) ?? undefined,
    can_cancel: pickBool(actions.can_cancel) ?? undefined,
    can_update_status: pickBool(row.can_update_status, actions.can_update_status) ?? undefined,
    uses_delivery_otp: pickBool(row.uses_delivery_otp, actions.uses_delivery_otp) ?? undefined,
    can_confirm_delivery_otp: pickBool(actions.can_confirm_delivery_otp) ?? undefined,
    can_resend_delivery_otp: pickBool(actions.can_resend_delivery_otp) ?? undefined,
    resend_delivery_otp_available_in_seconds:
      pickNumber(actions.resend_delivery_otp_available_in_seconds) ?? undefined,
    confirm_delivery_endpoint:
      pickString(actions.confirm_delivery_endpoint) || null,
    resend_delivery_otp_endpoint:
      pickString(actions.resend_delivery_otp_endpoint) || null,
    fulfillment_note: pickString(actions.fulfillment_note) || null,
    can_contact_customer:
      pickBool(
        row.can_contact_customer,
        actions.can_contact_customer,
        row.contact_customer
      ) ?? false,
    can_print_invoice:
      pickBool(row.can_print_invoice, actions.can_print_invoice, row.print_invoice) ?? false,
    can_download_order:
      pickBool(row.can_download_order, actions.can_download_order, row.download_order) ?? false,
    contact_path:
      pickString(
        row.contact_path,
        row.contact_url,
        actions.contact_path,
        actions.contact_endpoint
      ) || undefined,
    invoice_path:
      pickString(
        row.invoice_path,
        row.invoice_url,
        actions.invoice_path,
        actions.invoice_endpoint
      ) || undefined,
    download_path:
      pickString(
        row.download_path,
        row.download_url,
        actions.download_path,
        actions.download_endpoint
      ) || undefined,
    track_path:
      pickString(row.track_path, row.track_url, actions.track_path, actions.track_endpoint) ||
      undefined,
  };
}

function mapContact(raw: unknown): VendorOrderContact {
  const row = asRecord(raw);
  if (!row) throw new Error('Contact details not available.');
  const nested = asRecord(row.contact) ?? asRecord(row.customer) ?? row;
  return {
    customer_name: pickString(
      nested.customer_name,
      nested.name,
      row.customer_name,
      'Customer'
    ),
    phone: pickString(nested.phone, nested.customer_phone, nested.mobile) || undefined,
    email: pickString(nested.email, nested.customer_email) || undefined,
    call_url: pickString(nested.call_url, nested.tel_url, row.call_url) || undefined,
    whatsapp_url: pickString(nested.whatsapp_url, nested.whatsapp, row.whatsapp_url) || undefined,
    mailto_url: pickString(nested.mailto_url, nested.email_url, row.mailto_url) || undefined,
  };
}

function mapTrackTimelineItem(raw: unknown): VendorOrderTrackTimelineItem | null {
  const row = asRecord(raw);
  if (!row) return null;
  const key = pickString(row.key, row.step, row.status);
  if (!key) return null;
  const completed = pickBool(row.completed, row.is_completed, row.done) ?? false;
  const current = pickBool(row.current, row.is_current) ?? false;
  return {
    key,
    label: pickString(row.label, row.title, row.status_label, key),
    description: pickString(row.description, row.note, row.message) || '',
    completed: completed || current,
    current,
    timestamp:
      pickString(row.date_display, row.timestamp, row.at, row.date) || null,
    date: pickString(row.date) || null,
    date_display: pickString(row.date_display) || null,
    icon: pickString(row.icon) || undefined,
    color: pickString(row.color) || undefined,
  };
}

function mapOrderTrack(raw: unknown): VendorOrderTrackData {
  const row = asRecord(raw);
  if (!row) throw new Error('Tracking information not available.');

  const tracking = asRecord(row.tracking) ?? row;
  const timelineRaw = Array.isArray(tracking.timeline)
    ? tracking.timeline
    : Array.isArray(row.timeline)
      ? row.timeline
      : Array.isArray(row.status_timeline)
        ? row.status_timeline
        : [];
  const timeline = timelineRaw
    .map(mapTrackTimelineItem)
    .filter((step): step is VendorOrderTrackTimelineItem => step != null);

  const vendorOrderId = pickString(
    row.vendor_order_id,
    asRecord(row.order)?.vendor_order_id,
    row.id
  );
  if (!vendorOrderId && timeline.length === 0) {
    throw new Error('Tracking information not available.');
  }

  return {
    order_id: pickString(row.order_id, asRecord(row.order)?.id) || undefined,
    vendor_order_id: vendorOrderId || pickString(row.order_id) || '',
    order_number: pickString(
      row.order_number,
      asRecord(row.order)?.order_number,
      row.order_number_short
    ),
    order_number_short: pickString(row.order_number_short) || undefined,
    tracking_number:
      pickString(row.tracking_number, tracking.tracking_number) || undefined,
    tracking_display:
      pickString(row.tracking_display, tracking.tracking_number) || undefined,
    fulfillment_type:
      pickString(row.fulfillment_type, tracking.fulfillment_type) || undefined,
    status: pickString(row.status, tracking.status, row.vendor_status) || 'pending',
    status_label:
      pickString(
        row.status_label,
        row.current_status,
        tracking.status_label,
        row.vendor_status_label
      ) || undefined,
    current_status: pickString(row.current_status, row.status_label, tracking.status_label) || undefined,
    vendor_status: pickString(row.vendor_status) || undefined,
    vendor_status_label: pickString(row.vendor_status_label) || undefined,
    timeline,
  };
}

async function getAuthToken(): Promise<string> {
  const token = await AsyncStorage.getItem('auth_token');
  if (!token) throw new Error('Please login again.');
  return token;
}

function buildOrderUrl(orderId: string, suffix = ''): string {
  const base = API_CONFIG.baseURL.replace(/\/$/, '');
  return `${base}/vendor/orders/${encodeURIComponent(orderId)}${suffix}`;
}

function extractOrderRows(payload: Record<string, unknown>): unknown[] {
  if (Array.isArray(payload.orders)) return payload.orders;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  const nested = asRecord(payload.data);
  if (nested) {
    if (Array.isArray(nested.items)) return nested.items;
    if (Array.isArray(nested.orders)) return nested.orders;
  }
  return [];
}

export const vendorOrderService = {
  /** GET /vendor/orders */
  async listOrders(params?: {
    status?: VendorOrderStatus | 'all';
    per_page?: number;
    page?: number;
    search?: string;
  }): Promise<VendorOrdersListResult> {
    const query: Record<string, string | number> = {
      per_page: params?.per_page ?? 15,
    };
    if (params?.page) query.page = params.page;
    if (params?.search?.trim()) query.search = params.search.trim();
    if (params?.status && params.status !== 'all') query.status = params.status;

    const response = await apiClient.get('/vendor/orders', {
      params: query,
      timeout: 20000,
    });
    const payload = extractPayload(response.data);
    const rows = extractOrderRows(payload);
    const orders = rows
      .map(mapOrderListItem)
      .filter((order): order is VendorOrderListItem => order != null);

    const pagination =
      mapPagination(payload.pagination) ??
      mapPagination(payload.meta) ??
      mapPagination(asRecord(payload.pagination)?.meta);

    return { orders, pagination };
  },

  /** GET /vendor/orders/{vendor_order_mapping_id} */
  async getOrder(orderId: string): Promise<VendorOrderDetail> {
    const id = String(orderId ?? '').trim();
    if (!id) {
      throw new Error('Order not found.');
    }
    const response = await apiClient.get(`/vendor/orders/${encodeURIComponent(id)}`, {
      timeout: 20000,
    });
    const payload = extractPayload(response.data);
    const orderRaw =
      asRecord(payload.order) ??
      asRecord(payload.vendor_order) ??
      asRecord(payload.data) ??
      payload;
    return mapOrderDetail(orderRaw);
  },

  /** GET /vendor/orders/{vendor_order_id}/track */
  async getOrderTrack(vendorOrderId: string): Promise<VendorOrderTrackData> {
    const id = String(vendorOrderId ?? '').trim();
    if (!id) {
      throw new Error('Tracking information not available.');
    }
    const response = await apiClient.get(`/vendor/orders/${encodeURIComponent(id)}/track`, {
      timeout: 20000,
    });
    const payload = extractPayload(response.data);
    return mapOrderTrack(payload);
  },

  /** GET /vendor/orders/{id}/contact */
  async getOrderContact(orderId: string): Promise<VendorOrderContact> {
    const response = await apiClient.get(`/vendor/orders/${orderId}/contact`, { timeout: 15000 });
    const payload = extractPayload(response.data);
    return mapContact(asRecord(payload.contact) ?? payload);
  },

  /** POST /vendor/orders/{id}/status */
  async updateOrderStatus(orderId: string, input: VendorOrderStatusUpdate): Promise<VendorOrderDetail> {
    const body: Record<string, string> = { status: input.status };
    if (input.note?.trim()) body.note = input.note.trim();
    if (input.tracking_number?.trim()) body.tracking_number = input.tracking_number.trim();

    const response = await apiClient.post(`/vendor/orders/${orderId}/status`, body, {
      timeout: 20000,
    });
    const payload = extractPayload(response.data);
    const orderRaw = asRecord(payload.order) ?? payload;
    if (orderRaw && pickString(orderRaw.id, orderRaw.order_number)) {
      return mapOrderDetail(orderRaw);
    }
    return this.getOrder(orderId);
  },

  /**
   * POST /vendor/orders/{vendor_order_mapping_id}/confirm-delivery
   * Postman: form-data — otp* (6-digit from customer Track), note? optional
   *
   * Always uses the canonical path (ignores brittle endpoint overrides that caused 404s).
   * Retries with shop order_id if mapping id returns 404 (some backends bind either).
   */
  async confirmDeliveryWithOtp(
    orderId: string,
    otp: string,
    options?: { note?: string; shopOrderId?: string | null }
  ): Promise<VendorOrderDetail> {
    const code = String(otp || '').trim().replace(/\s+/g, '');
    if (!code) throw new Error('Please enter the delivery OTP.');

    const mappingId = String(orderId || '').trim();
    const shopOrderId = String(options?.shopOrderId || '').trim();
    const note = options?.note?.trim() || '';

    const candidateIds = [mappingId, shopOrderId].filter(
      (id, index, arr) => Boolean(id) && arr.indexOf(id) === index
    );
    if (candidateIds.length === 0) {
      throw new Error('Order not found.');
    }

    const buildBodies = (): unknown[] => {
      const formData = new FormData();
      formData.append('otp', code);
      if (note) formData.append('note', note);
      // 1) FormData — matches Postman form-data
      // 2) JSON — more reliable on React Native / axios
      return [formData, note ? { otp: code, note } : { otp: code }];
    };

    let lastError: unknown;
    for (const id of candidateIds) {
      const path = `/vendor/orders/${encodeURIComponent(id)}/confirm-delivery`;
      for (const body of buildBodies()) {
        try {
          const response = await apiClient.post(path, body, {
            timeout: 20000,
            headers: {
              Accept: 'application/json',
            },
          });
          const payload = extractPayload(response.data);
          const orderRaw = asRecord(payload.order) ?? payload;
          if (orderRaw && pickString(orderRaw.id, orderRaw.order_number)) {
            return mapOrderDetail(orderRaw);
          }
          return this.getOrder(mappingId || id);
        } catch (error: unknown) {
          lastError = error;
          const status = (error as { response?: { status?: number } })?.response?.status;
          // Retry next body/id only for routing/not-found style failures.
          if (status && status !== 404 && status !== 405) {
            throw toConfirmDeliveryError(error);
          }
        }
      }
    }

    throw toConfirmDeliveryError(
      lastError ?? new Error('Confirm delivery failed (404). Check vendor order mapping id.')
    );
  },

  /**
   * POST /vendor/orders/{vendor_order_mapping_id}/resend-delivery-otp
   * Postman: no body required — regenerates OTP for customer Track screen.
   */
  async resendDeliveryOtp(
    orderId: string,
    options?: { shopOrderId?: string | null }
  ): Promise<{ success: boolean; message?: string }> {
    const mappingId = String(orderId || '').trim();
    const shopOrderId = String(options?.shopOrderId || '').trim();
    const candidateIds = [mappingId, shopOrderId].filter(
      (id, index, arr) => Boolean(id) && arr.indexOf(id) === index
    );
    if (candidateIds.length === 0) {
      throw new Error('Order not found.');
    }

    let lastError: unknown;
    for (const id of candidateIds) {
      const path = `/vendor/orders/${encodeURIComponent(id)}/resend-delivery-otp`;
      try {
        const response = await apiClient.post(path, {}, { timeout: 20000 });
        const body = asRecord(response.data) ?? {};
        return {
          success: body.success !== false,
          message: pickString(body.message) || undefined,
        };
      } catch (error: unknown) {
        lastError = error;
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status !== 404) throw error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Resend delivery OTP failed (404).');
  },

  /** GET /vendor/orders/{id}/invoice — download PDF for print preview */
  async downloadInvoicePdf(orderId: string): Promise<string> {
    const token = await getAuthToken();
    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
    if (!cacheDir) throw new Error('Unable to access device storage.');

    const fileUri = `${cacheDir}vendor-invoice-${orderId}.pdf`;
    const result = await FileSystem.downloadAsync(buildOrderUrl(orderId, '/invoice'), fileUri, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/pdf,application/json,*/*',
      },
    });

    if (result.status !== 200) {
      throw new Error('Failed to load invoice PDF.');
    }
    return result.uri;
  },

  /** GET /vendor/orders/{id}/download — download order PDF attachment */
  async downloadOrderPdf(orderId: string): Promise<string> {
    const token = await getAuthToken();
    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
    if (!cacheDir) throw new Error('Unable to access device storage.');

    const fileUri = `${cacheDir}vendor-order-${orderId}.pdf`;
    const result = await FileSystem.downloadAsync(buildOrderUrl(orderId, '/download'), fileUri, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/pdf,application/json,*/*',
      },
    });

    if (result.status !== 200) {
      throw new Error('Failed to download order PDF.');
    }
    return result.uri;
  },
};
