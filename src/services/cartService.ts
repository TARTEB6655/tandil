/**
 * Cart API for logged-in customers.
 * Uses apiClient so Authorization: Bearer <customer token> is sent automatically.
 * POST /api/shop/cart/add – add item. GET /api/shop/cart – view cart.
 */
import apiClient from './api';

export interface AddCartItemRequest {
  product_id: number;
  quantity: number;
  selected_option_ids?: number[];
  /** Preferred visit date Y-m-d, e.g. "2026-08-24" */
  booking_date?: string;
  /** Preferred time slot label, e.g. "10:00 AM - 12:00 PM" */
  booking_slot?: string;
  /** Required area in m² for area-based (per_m2) pricing */
  area_m2?: number;
  area_pricing_mode?: 'base' | 'fixed' | 'per_m2' | string;
  tree_quantity?: number;
  palm_tree_quantity?: number;
}

export interface AddCartItemResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
}

/** Cart item from GET /shop/cart response data.items */
export interface CartApiItem {
  id: number;
  product_id: number;
  name: string;
  image_url: string | null;
  category: string | null;
  category_id?: number | null;
  service_id?: number | null;
  brand: string | null;
  current_price: number;
  original_price: number | null;
  quantity: number;
  line_total: number;
  currency: string;
  /** Area-based pricing fields (when present) */
  area_m2?: number | string | null;
  unit_price?: number | string | null;
  pricing_type?: string | null;
  price_per_m2?: number | string | null;
}

/** Order summary from GET /shop/cart response data.order_summary */
export interface CartOrderSummary {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  currency: string;
  tax?: number;
  tax_percent?: number;
  is_instant_order?: boolean;
  instant_order_fee?: number;
  instant_order_fee_label?: string | null;
}

/** Order summary from GET /shop/order-summary API (Auth required) */
export interface OrderSummaryData {
  subtotal: number;
  discount: number;
  shipping: number;
  shipping_label?: string | null;
  tax_percent?: number;
  /** Calculated tax amount; may be omitted when API only returns tax_percent + total */
  tax?: number;
  total: number;
  currency: string;
  is_instant_order?: boolean;
  instant_order_fee?: number;
  instant_order_fee_label?: string | null;
  wallet_available?: boolean;
  wallet_balance?: number;
  use_wallet?: boolean;
  wallet_amount_applied?: number;
  amount_due?: number;
}

export interface GetOrderSummaryResponse {
  success?: boolean;
  message?: string;
  data?: OrderSummaryData;
}

export interface BuyNowSummaryItem {
  id: number;
  product_id: number;
  name: string;
  image_url: string | null;
  category: string | null;
  category_id?: number | null;
  service_id?: number | null;
  brand: string | null;
  current_price: number;
  original_price: number | null;
  quantity: number;
  line_total: number;
  currency: string;
  area_m2?: number | string | null;
  unit_price?: number | string | null;
  pricing_type?: string | null;
  price_per_m2?: number | string | null;
}

export interface BuyNowSummaryData {
  item: BuyNowSummaryItem;
  order_summary: OrderSummaryData;
}

interface GetBuyNowSummaryResponse {
  success?: boolean;
  message?: string;
  data?: BuyNowSummaryData;
}

/**
 * Get order summary for current cart. Requires customer token.
 * GET /shop/order-summary. Returns subtotal, discount, shipping, tax, total, currency.
 */
export async function getOrderSummary(
  options?: {
    use_wallet?: boolean;
    wallet_amount?: number;
    coupon_code?: string;
  }
): Promise<OrderSummaryData | null> {
  const params: Record<string, string | number> = {};
  if (typeof options?.use_wallet === 'boolean') {
    params.use_wallet = options.use_wallet ? 1 : 0;
  }
  if (typeof options?.wallet_amount === 'number') {
    params.wallet_amount = options.wallet_amount;
  }
  const couponCode = options?.coupon_code?.trim().toUpperCase();
  if (couponCode) {
    params.coupon_code = couponCode;
  }
  const response = await apiClient.get<GetOrderSummaryResponse>('/shop/order-summary', {
    timeout: 15000,
    params: Object.keys(params).length ? params : undefined,
  });
  if (response.data?.success && response.data?.data) return response.data.data;
  return null;
}

/**
 * Get order summary for direct Buy Now from product details.
 * POST /shop/buy-now/summary with JSON body: { product_id, quantity, selected_option_ids? }.
 */
export async function getBuyNowSummary(
  productId: number,
  quantity: number,
  options?: {
    use_wallet?: boolean;
    wallet_amount?: number;
    selected_option_ids?: number[];
    coupon_code?: string;
    area_m2?: number;
    area_pricing_mode?: 'base' | 'fixed' | 'per_m2' | string;
    tree_quantity?: number;
    palm_tree_quantity?: number;
  }
): Promise<BuyNowSummaryData | null> {
  const selectedOptionIds = options?.selected_option_ids?.filter(
    (id) => Number.isFinite(id) && id > 0
  );
  const couponCode = options?.coupon_code?.trim().toUpperCase();
  const response = await apiClient.post<GetBuyNowSummaryResponse>(
    '/shop/buy-now/summary',
    {
      product_id: productId,
      quantity,
      ...(selectedOptionIds?.length ? { selected_option_ids: selectedOptionIds } : {}),
      ...(typeof options?.use_wallet === 'boolean' ? { use_wallet: options.use_wallet } : {}),
      ...(typeof options?.wallet_amount === 'number' ? { wallet_amount: options.wallet_amount } : {}),
      ...(couponCode ? { coupon_code: couponCode } : {}),
      ...(typeof options?.area_m2 === 'number' && options.area_m2 > 0
        ? { area_m2: options.area_m2 }
        : {}),
      ...(options?.area_pricing_mode ? { area_pricing_mode: options.area_pricing_mode } : {}),
      ...(typeof options?.tree_quantity === 'number' && options.tree_quantity > 0
        ? { tree_quantity: options.tree_quantity }
        : {}),
      ...(typeof options?.palm_tree_quantity === 'number' && options.palm_tree_quantity > 0
        ? { palm_tree_quantity: options.palm_tree_quantity }
        : {}),
    },
    { timeout: 15000 }
  );
  if (response.data?.success && response.data?.data) return response.data.data;
  return null;
}

/**
 * Add item to cart. Requires user to be logged in (customer token).
 * POST /shop/cart/add with JSON body:
 * { product_id, quantity, selected_option_ids?, booking_date?, booking_slot?, area_m2? }.
 */
export async function addCartItem(
  productId: number,
  quantity: number,
  selectedOptionIds?: number[],
  booking?: {
    booking_date?: string;
    booking_slot?: string;
    area_m2?: number;
    area_pricing_mode?: 'base' | 'fixed' | 'per_m2' | string;
    tree_quantity?: number;
    palm_tree_quantity?: number;
  }
): Promise<AddCartItemResponse> {
  const optionIds = selectedOptionIds?.filter((id) => Number.isFinite(id) && id > 0);
  const bookingDate = booking?.booking_date?.trim();
  const bookingSlot = booking?.booking_slot?.trim();
  const areaM2 =
    typeof booking?.area_m2 === 'number' && booking.area_m2 > 0 ? booking.area_m2 : undefined;
  const treeQty =
    typeof booking?.tree_quantity === 'number' && booking.tree_quantity > 0
      ? booking.tree_quantity
      : undefined;
  const palmQty =
    typeof booking?.palm_tree_quantity === 'number' && booking.palm_tree_quantity > 0
      ? booking.palm_tree_quantity
      : undefined;
  const response = await apiClient.post<AddCartItemResponse>(
    '/shop/cart/add',
    {
      product_id: productId,
      quantity,
      ...(optionIds?.length ? { selected_option_ids: optionIds } : {}),
      ...(bookingDate ? { booking_date: bookingDate } : {}),
      ...(bookingSlot ? { booking_slot: bookingSlot } : {}),
      ...(areaM2 != null ? { area_m2: areaM2 } : {}),
      ...(booking?.area_pricing_mode ? { area_pricing_mode: booking.area_pricing_mode } : {}),
      ...(treeQty != null ? { tree_quantity: treeQty } : {}),
      ...(palmQty != null ? { palm_tree_quantity: palmQty } : {}),
    } as AddCartItemRequest,
    {
      timeout: 15000,
    }
  );
  return response.data ?? {};
}

export interface GetCartResponse {
  success?: boolean;
  message?: string;
  data?: {
    items?: CartApiItem[];
    order_summary?: CartOrderSummary;
  };
}

/**
 * Get cart for logged-in customer. Requires customer token.
 * GET /shop/cart. Returns { data: { items, order_summary } }.
 */
export async function getCart(): Promise<GetCartResponse> {
  const response = await apiClient.get<GetCartResponse>('/shop/cart', { timeout: 15000 });
  const data = response.data ?? {};
  if (data.success === false && data.message) {
    const err: any = new Error(data.message);
    err.response = { data: { message: data.message }, status: 422 };
    throw err;
  }
  return data;
}

/**
 * Update cart item quantity. Requires customer token.
 * PUT /shop/cart/:cart_item_id with JSON body: { quantity }.
 */
export async function updateCartItemQuantity(cartItemId: number, quantity: number): Promise<{ success?: boolean; message?: string }> {
  const response = await apiClient.put<{ success?: boolean; message?: string }>(`/shop/cart/${cartItemId}`, { quantity }, {
    timeout: 15000,
  });
  return response.data ?? {};
}

/**
 * Remove item from cart. Requires customer token.
 * DELETE /shop/cart/:cart_item_id
 */
export async function removeCartItem(cartItemId: number): Promise<{ success?: boolean; message?: string }> {
  const response = await apiClient.delete<{ success?: boolean; message?: string }>(`/shop/cart/${cartItemId}`, {
    timeout: 15000,
  });
  return response.data ?? {};
}
