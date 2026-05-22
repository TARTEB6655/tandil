import type { TFunction } from 'i18next';
import type { CouponDiscountType } from '../types/coupon';
import type { AdminCoupon } from '../types/adminCoupon';
import i18n from '../i18n';

function t(key: string, fallback: string, tFn?: TFunction): string {
  const fn = tFn ?? i18n.t.bind(i18n);
  return String(fn(key, fallback));
}

export function getCouponDiscountBadge(
  coupon: Pick<AdminCoupon, 'discount_type' | 'discount_value'>,
  tFn?: TFunction
) {
  if (coupon.discount_type === 'percentage') {
    return {
      main: `${coupon.discount_value}%`,
      sub: t('admin.coupons.badgeOff', 'OFF', tFn),
      icon: 'trending-down-outline' as const,
    };
  }
  if (coupon.discount_type === 'fixed_amount') {
    return {
      main: `${coupon.discount_value}`,
      sub: t('admin.coupons.badgeAedOff', 'AED OFF', tFn),
      icon: 'cash-outline' as const,
    };
  }
  return {
    main: t('admin.coupons.badgeFree', 'FREE', tFn),
    sub: t('admin.coupons.badgeShipping', 'SHIPPING', tFn),
    icon: 'car-outline' as const,
  };
}

export function getDiscountTypeLabel(type: CouponDiscountType, tFn?: TFunction): string {
  switch (type) {
    case 'percentage':
      return t('admin.coupons.typePercent', 'Percentage (%)', tFn);
    case 'fixed_amount':
      return t('admin.coupons.typeFixed', 'Fixed amount (AED)', tFn);
    case 'free_shipping':
      return t('admin.coupons.typeFreeShip', 'Free shipping', tFn);
    default:
      return type;
  }
}

export function formatCouponDiscountPreview(
  coupon: Pick<AdminCoupon, 'discount_type' | 'discount_value'>,
  tFn?: TFunction
): string {
  if (coupon.discount_type === 'free_shipping') {
    return t('coupon.freeShippingShort', 'Free shipping', tFn);
  }
  const badge = getCouponDiscountBadge(coupon, tFn);
  return `${badge.main} ${badge.sub}`.trim();
}
