import type { AppliedCouponResult, Coupon, CouponApplyContext } from '../types/coupon';
import { getCustomerCouponCatalogSync } from '../services/customerCouponCatalog';
import { validateCouponCatalog, validateCouponDates } from './couponEligibility';

export function findCouponByCode(code: string): Coupon | undefined {
  const normalized = code.trim().toUpperCase();
  const list = getCustomerCouponCatalogSync();
  return list.find((c) => c.code.toUpperCase() === normalized);
}

/**
 * Validate and compute coupon discount on cart subtotal (before coupon).
 * `catalogDiscount` = discount already returned by API (product/offer discounts).
 */
export function applyCouponToSubtotal(
  code: string,
  subtotal: number,
  catalogDiscount: number = 0,
  context?: CouponApplyContext
): { ok: true; result: AppliedCouponResult } | { ok: false; message: string } {
  const coupon = findCouponByCode(code);
  if (!coupon) {
    return { ok: false, message: 'Invalid coupon code.' };
  }
  if (!coupon.is_active) {
    return { ok: false, message: 'This coupon is no longer active.' };
  }

  const dateError = validateCouponDates(coupon);
  if (dateError) {
    return { ok: false, message: dateError };
  }

  const catalogError = validateCouponCatalog(coupon, context);
  if (catalogError) {
    return { ok: false, message: catalogError };
  }

  const base = Math.max(0, Number(subtotal) || 0);
  const afterCatalog = Math.max(0, base - Math.max(0, catalogDiscount));

  if (afterCatalog < coupon.min_order_amount) {
    return {
      ok: false,
      message: `Minimum order is ${coupon.min_order_amount} AED after discounts.`,
    };
  }

  if (coupon.discount_type === 'free_shipping') {
    return {
      ok: true,
      result: { coupon, coupon_discount: 0, free_shipping: true },
    };
  }

  let couponDiscount = 0;
  if (coupon.discount_type === 'percentage') {
    couponDiscount = Math.round(afterCatalog * (coupon.discount_value / 100) * 100) / 100;
    if (coupon.max_discount_amount != null && couponDiscount > coupon.max_discount_amount) {
      couponDiscount = coupon.max_discount_amount;
    }
  } else if (coupon.discount_type === 'fixed_amount') {
    couponDiscount = Math.min(coupon.discount_value, afterCatalog);
  }

  couponDiscount = Math.max(0, Math.round(couponDiscount * 100) / 100);

  return {
    ok: true,
    result: { coupon, coupon_discount: couponDiscount, free_shipping: false },
  };
}
