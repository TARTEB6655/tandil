/** Coupon discount types — align with what admin will manage and Laravel will store. */
export type CouponDiscountType = 'percentage' | 'fixed_amount' | 'free_shipping';

/**
 * Where the coupon applies:
 * - `all` — entire store product catalog
 * - `categories` — only selected category_ids
 * - `services` — only selected service_ids
 */
export type CouponAppliesTo = 'all' | 'categories' | 'services';

/** Legacy / API helper when applies_to is `all` (always products in current UI). */
export type CouponCatalogScope = 'products' | 'services' | 'both';

export interface Coupon {
  id: string;
  code: string;
  title: string;
  description?: string;
  discount_type: CouponDiscountType;
  discount_value: number;
  min_order_amount: number;
  max_discount_amount?: number;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  usage_limit?: number;
  usage_limit_per_user?: number;
  applies_to: CouponAppliesTo;
  catalog_scope: CouponCatalogScope;
  category_ids: number[];
  service_ids: number[];
}

export interface CouponApplyContext {
  cartCategoryIds?: number[];
  cartServiceIds?: number[];
  cartCatalog?: 'products' | 'services';
}

export interface AppliedCouponResult {
  coupon: Coupon;
  coupon_discount: number;
  free_shipping: boolean;
}
