import type { CouponDiscountType } from '../types/coupon';
import type { AdminCoupon } from '../types/adminCoupon';

export function getCouponDiscountBadge(coupon: Pick<AdminCoupon, 'discount_type' | 'discount_value'>) {
  if (coupon.discount_type === 'percentage') {
    return { main: `${coupon.discount_value}%`, sub: 'OFF', icon: 'trending-down-outline' as const };
  }
  if (coupon.discount_type === 'fixed_amount') {
    return { main: `${coupon.discount_value}`, sub: 'AED OFF', icon: 'cash-outline' as const };
  }
  return { main: 'FREE', sub: 'SHIPPING', icon: 'car-outline' as const };
}

export function getDiscountTypeLabel(type: CouponDiscountType): string {
  switch (type) {
    case 'percentage':
      return 'Percentage';
    case 'fixed_amount':
      return 'Fixed amount';
    case 'free_shipping':
      return 'Free shipping';
    default:
      return type;
  }
}
