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
}

/** Order summary from GET /shop/cart response data.order_summary */
export interface CartOrderSummary {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  currency: string;
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
  }
): Promise<BuyNowSummaryData | null> {
  const selectedOptionIds = options?.selected_option_ids?.filter(
    (id) => Number.isFinite(id) && id > 0
  );
  const response = await apiClient.post<GetBuyNowSummaryResponse>(
    '/shop/buy-now/summary',
    {
      product_id: productId,
      quantity,
      ...(selectedOptionIds?.length ? { selected_option_ids: selectedOptionIds } : {}),
      ...(typeof options?.use_wallet === 'boolean' ? { use_wallet: options.use_wallet } : {}),
      ...(typeof options?.wallet_amount === 'number' ? { wallet_amount: options.wallet_amount } : {}),
    },
    { timeout: 15000 }
  );
  if (response.data?.success && response.data?.data) return response.data.data;
  return null;
}

/**
 * Add item to cart. Requires user to be logged in (customer token).
 * POST /shop/cart/add with JSON body: { product_id, quantity, selected_option_ids? }.
 */
export async function addCartItem(
  productId: number,
  quantity: number,
  selectedOptionIds?: number[]
): Promise<AddCartItemResponse> {
  const optionIds = selectedOptionIds?.filter((id) => Number.isFinite(id) && id > 0);
  const response = await apiClient.post<AddCartItemResponse>(
    '/shop/cart/add',
    {
      product_id: productId,
      quantity,
      ...(optionIds?.length ? { selected_option_ids: optionIds } : {}),
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
