import type { Coupon, CouponApplyContext } from '../types/coupon';

function normalizeIds(ids: number[] | undefined): number[] {
  return (ids ?? [])
    .map((x) => Number(x))
    .filter((n) => !Number.isNaN(n) && n > 0);
}

function hasIdOverlap(allowed: number[], cartIds: number[]): boolean {
  const a = new Set(normalizeIds(allowed));
  return normalizeIds(cartIds).some((id) => a.has(id));
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function validateCouponDates(coupon: Coupon): string | null {
  const today = todayYmd();
  if (coupon.start_date && today < coupon.start_date) {
    return 'This coupon is not valid yet.';
  }
  if (coupon.end_date && today > coupon.end_date) {
    return 'This coupon has expired.';
  }
  return null;
}

export function validateCouponCatalog(
  coupon: Coupon,
  context?: CouponApplyContext
): string | null {
  const cartCatalog = context?.cartCatalog ?? 'products';

  if (coupon.applies_to === 'all') {
    if (cartCatalog === 'services') {
      return 'This coupon applies to store products only.';
    }
    return null;
  }

  if (coupon.applies_to === 'services') {
    if (cartCatalog === 'products') {
      return 'This coupon applies to selected services only, not the store cart.';
    }
    const allowed = coupon.service_ids ?? [];
    if (allowed.length === 0) {
      return 'This coupon has no services configured.';
    }
    const cartIds = context?.cartServiceIds ?? [];
    if (cartIds.length === 0) {
      return 'This offer applies to specific services only.';
    }
    if (!hasIdOverlap(allowed, cartIds)) {
      return 'This coupon does not apply to the selected service.';
    }
    return null;
  }

  const allowed = coupon.category_ids ?? [];
  if (allowed.length === 0) {
    return 'This coupon has no categories configured.';
  }

  const cartIds = context?.cartCategoryIds ?? [];
  if (cartIds.length === 0) {
    return 'This offer applies to specific categories. Your cart does not include eligible category items.';
  }

  if (!hasIdOverlap(allowed, cartIds)) {
    return 'This coupon does not apply to items in your cart.';
  }
  return null;
}
