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
}

export interface VendorOrderTimelineStep {
  status: string;
  label?: string;
  note?: string;
  at?: string;
  completed?: boolean;
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
}

export interface VendorOrderNote {
  id?: string | number;
  note: string;
  created_at?: string;
  author?: string;
}

export interface VendorOrderDetail extends VendorOrderListItem {
  subtotal?: number;
  shipping?: number;
  tax?: number;
  notes: VendorOrderNote[];
  timeline: VendorOrderTimelineStep[];
  items: VendorOrderLineItem[];
  can_contact_customer: boolean;
  can_print_invoice: boolean;
  can_download_order: boolean;
  contact_path?: string;
  invoice_path?: string;
  download_path?: string;
}

export interface VendorOrderContact {
  customer_name: string;
  phone?: string;
  email?: string;
  call_url?: string;
  whatsapp_url?: string;
  mailto_url?: string;
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
  };
}

function mapTimelineStep(raw: unknown): VendorOrderTimelineStep | null {
  const row = asRecord(raw);
  if (!row) return null;
  const status = pickString(row.status, row.key, row.step);
  if (!status) return null;
  return {
    status,
    label: pickString(row.label, row.title, row.status_label) || undefined,
    note: pickString(row.note, row.description) || undefined,
    at: pickString(row.at, row.date, row.created_at, row.timestamp) || undefined,
    completed: pickBool(row.completed, row.is_completed, row.done),
  };
}

function mapNote(raw: unknown): VendorOrderNote | null {
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

function mapOrderListItem(raw: unknown): VendorOrderListItem | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = pickString(
    row.id,
    row.vendor_order_mapping_id,
    row.order_mapping_id,
    row.order_id
  );
  if (!id) return null;

  const items = Array.isArray(row.items)
    ? row.items
    : Array.isArray(row.products)
      ? row.products
      : Array.isArray(row.line_items)
        ? row.line_items
        : [];
  const firstItem = items.length > 0 ? mapLineItem(items[0]) : null;

  return {
    id,
    order_number: pickString(row.order_number, row.number, row.reference, `ORD-${id}`),
    customer_name: pickString(row.customer_name, row.buyer_name, row.name, 'Customer'),
    customer_phone: pickString(row.customer_phone, row.phone, row.mobile) || undefined,
    customer_email: pickString(row.customer_email, row.email) || undefined,
    customer_address: pickString(row.customer_address, row.address, row.shipping_address) || undefined,
    product_name: pickString(row.product_name, firstItem?.product_name) || undefined,
    product_image: mapImage(row.product_image ?? firstItem?.product_image),
    items_count: pickNumber(row.items_count, row.products_count, items.length) ?? undefined,
    quantity: pickNumber(row.quantity, firstItem?.quantity) ?? undefined,
    unit_price: pickNumber(row.unit_price, firstItem?.unit_price) ?? undefined,
    total_amount:
      pickNumber(row.total_amount, row.total, row.grand_total, row.amount) ?? 0,
    status: mapStatus(row.status),
    status_label: pickString(row.status_label, row.status_display) || undefined,
    order_date: pickString(row.order_date, row.created_at, row.placed_at) || '',
    delivery_date: pickString(row.delivery_date, row.delivered_at, row.expected_delivery) || undefined,
    tracking_number: pickString(row.tracking_number, row.tracking) || undefined,
  };
}

function mapOrderDetail(raw: unknown): VendorOrderDetail {
  const row = asRecord(raw);
  if (!row) throw new Error('Order not found.');

  const base = mapOrderListItem(row);
  if (!base) throw new Error('Order not found.');

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

  const notesRaw = Array.isArray(row.notes)
    ? row.notes
    : Array.isArray(row.order_notes)
      ? row.order_notes
      : [];
  const notes = notesRaw.map(mapNote).filter((note): note is VendorOrderNote => note != null);

  const actions = asRecord(row.actions) ?? row;

  return {
    ...base,
    product_name: base.product_name ?? items[0]?.product_name,
    product_image: base.product_image ?? items[0]?.product_image,
    items_count: base.items_count ?? items.length,
    subtotal: pickNumber(row.subtotal, row.sub_total) ?? undefined,
    shipping: pickNumber(row.shipping, row.shipping_amount, row.shipping_fee) ?? undefined,
    tax: pickNumber(row.tax, row.tax_amount, row.vat) ?? undefined,
    notes,
    timeline,
    items,
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
      pickString(row.contact_path, row.contact_url, actions.contact_path) || undefined,
    invoice_path:
      pickString(row.invoice_path, row.invoice_url, actions.invoice_path) || undefined,
    download_path:
      pickString(row.download_path, row.download_url, actions.download_path) || undefined,
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
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
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

  /** GET /vendor/orders/{id} */
  async getOrder(orderId: string): Promise<VendorOrderDetail> {
    const response = await apiClient.get(`/vendor/orders/${orderId}`, { timeout: 20000 });
    const payload = extractPayload(response.data);
    const orderRaw = asRecord(payload.order) ?? payload;
    return mapOrderDetail(orderRaw);
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
