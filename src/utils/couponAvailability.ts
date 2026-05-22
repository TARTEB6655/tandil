import type { Coupon, CouponApplyContext } from '../types/coupon';
import { getCustomerCouponCatalogSync } from '../services/customerCouponCatalog';
import { applyCouponToSubtotal } from './couponMath';
import { formatCouponScopeLabel } from './couponScopeLabel';
import { formatCouponDiscountPreview } from './couponDisplay';
import i18n from '../i18n';

export type CheckoutCouponOffer = {
  coupon: Coupon;
  scopeLabel: string;
  discountLabel: string;
  eligible: boolean;
  reason?: string;
};

function discountPreview(coupon: Coupon): string {
  return formatCouponDiscountPreview(coupon);
}

/** Why a coupon does not match this cart (category / service / dates / min order). */
export function evaluateCouponForCart(
  coupon: Coupon,
  subtotal: number,
  catalogDiscount: number,
  context?: CouponApplyContext,
  categoryNames?: Map<number, string>,
  serviceNames?: Map<number, string>
): CheckoutCouponOffer {
  const scopeLabel = formatCouponScopeLabel(coupon, categoryNames, serviceNames);
  const discountLabel = discountPreview(coupon);

  if (!coupon.is_active) {
    return {
      coupon,
      scopeLabel,
      discountLabel,
      eligible: false,
      reason: i18n.t('coupon.offerInactive', 'This offer is not active.'),
    };
  }

  const dry = applyCouponToSubtotal(coupon.code, subtotal, catalogDiscount, context);
  if (dry.ok) {
    return { coupon, scopeLabel, discountLabel, eligible: true };
  }
  return {
    coupon,
    scopeLabel,
    discountLabel,
    eligible: false,
    reason: dry.message,
  };
}

export function listCheckoutCouponOffers(
  subtotal: number,
  catalogDiscount: number,
  context?: CouponApplyContext,
  categoryNames?: Map<number, string>,
  serviceNames?: Map<number, string>,
  catalog?: Coupon[]
): { eligible: CheckoutCouponOffer[]; ineligible: CheckoutCouponOffer[] } {
  const list = catalog ?? getCustomerCouponCatalogSync();
  const offers = list.map((c) =>
    evaluateCouponForCart(c, subtotal, catalogDiscount, context, categoryNames, serviceNames)
  );
  return {
    eligible: offers.filter((o) => o.eligible),
    ineligible: offers.filter((o) => !o.eligible),
  };
}

/** Human-readable cart categories for checkout hint. */
export function formatCartCategoryHint(
  categoryIds: number[],
  categoryNames?: Map<number, string>
): string | null {
  if (!categoryIds.length) return null;
  if (categoryNames && categoryNames.size > 0) {
    const names = categoryIds
      .map((id) => categoryNames.get(id))
      .filter(Boolean) as string[];
    if (names.length) return names.join(', ');
  }
  return null;
}
