import type { AdminCoupon } from '../types/adminCoupon';

export function formatCouponScopeLabel(
  coupon: Pick<AdminCoupon, 'applies_to' | 'catalog_scope' | 'category_ids' | 'service_ids'>,
  categoryNames?: Map<number, string>,
  serviceNames?: Map<number, string>
): string {
  if (coupon.applies_to === 'all') {
    return 'All products';
  }

  if (coupon.applies_to === 'services') {
    const ids = coupon.service_ids ?? [];
    if (ids.length === 0) return 'Specific services';
    if (serviceNames && serviceNames.size > 0) {
      const names = ids
        .map((id) => serviceNames.get(id))
        .filter(Boolean)
        .slice(0, 2);
      const extra = ids.length - names.length;
      const base = names.join(', ');
      return extra > 0 ? `Services: ${base} +${extra} more` : `Service: ${base}`;
    }
    return `${ids.length} service(s)`;
  }

  const ids = coupon.category_ids ?? [];
  if (ids.length === 0) return 'Specific categories';
  if (categoryNames && categoryNames.size > 0) {
    const names = ids
      .map((id) => categoryNames.get(id))
      .filter(Boolean)
      .slice(0, 2);
    const extra = ids.length - names.length;
    const base = names.join(', ');
    return extra > 0 ? `Categories: ${base} +${extra} more` : `Category: ${base}`;
  }
  return `${ids.length} categor(ies)`;
}
