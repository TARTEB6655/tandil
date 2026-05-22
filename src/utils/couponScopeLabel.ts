import type { TFunction } from 'i18next';
import type { AdminCoupon } from '../types/adminCoupon';
import i18n from '../i18n';

function t(key: string, fallback: string, opts?: Record<string, string | number>, tFn?: TFunction): string {
  const fn = tFn ?? i18n.t.bind(i18n);
  return String(fn(key, { defaultValue: fallback, ...opts }));
}

export function formatCouponScopeLabel(
  coupon: Pick<AdminCoupon, 'applies_to' | 'catalog_scope' | 'category_ids' | 'service_ids'>,
  categoryNames?: Map<number, string>,
  serviceNames?: Map<number, string>,
  tFn?: TFunction
): string {
  if (coupon.applies_to === 'all') {
    return t('admin.couponForm.scopeAllProducts', 'All products', undefined, tFn);
  }

  if (coupon.applies_to === 'services') {
    const ids = coupon.service_ids ?? [];
    if (ids.length === 0) {
      return t('admin.coupons.scopeSpecificServices', 'Specific services', undefined, tFn);
    }
    if (serviceNames && serviceNames.size > 0) {
      const names = ids
        .map((id) => serviceNames.get(id))
        .filter(Boolean)
        .slice(0, 2);
      const extra = ids.length - names.length;
      const base = names.join(', ');
      if (extra > 0) {
        return `${t('admin.coupons.scopeServicesList', 'Services: {{names}}', { names: base }, tFn)} ${t('admin.coupons.scopeMoreSuffix', '+{{count}} more', { count: extra }, tFn)}`;
      }
      return t('admin.coupons.scopeServiceList', 'Service: {{names}}', { names: base }, tFn);
    }
    return t('admin.coupons.scopeServiceCount', '{{count}} service(s)', { count: ids.length }, tFn);
  }

  const ids = coupon.category_ids ?? [];
  if (ids.length === 0) {
    return t('admin.coupons.scopeSpecificCategories', 'Specific categories', undefined, tFn);
  }
  if (categoryNames && categoryNames.size > 0) {
    const names = ids
      .map((id) => categoryNames.get(id))
      .filter(Boolean)
      .slice(0, 2);
    const extra = ids.length - names.length;
    const base = names.join(', ');
    if (extra > 0) {
      return `${t('admin.coupons.scopeCategoriesList', 'Categories: {{names}}', { names: base }, tFn)} ${t('admin.coupons.scopeMoreSuffix', '+{{count}} more', { count: extra }, tFn)}`;
    }
    return t('admin.coupons.scopeCategoryList', 'Category: {{names}}', { names: base }, tFn);
  }
  return t('admin.coupons.scopeCategoryCount', '{{count}} categor(ies)', { count: ids.length }, tFn);
}
