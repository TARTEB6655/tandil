import type { Coupon } from '../types/coupon';
import type { AdminCoupon } from '../types/adminCoupon';
import {
  normalizeCouponAppliesTo,
  parseRelationIds,
} from './couponRelationIds';

export function normalizeAdminCoupon(raw: any): AdminCoupon {
  return {
    id: raw.id ?? raw.coupon_id ?? String(Date.now()),
    code: String(raw.code ?? '').trim().toUpperCase(),
    title: String(raw.title ?? raw.name ?? ''),
    description: raw.description ?? null,
    discount_type: raw.discount_type ?? 'percentage',
    discount_value: Number(raw.discount_value ?? 0),
    min_order_amount: Number(raw.min_order_amount ?? 0),
    max_discount_amount:
      raw.max_discount_amount != null && raw.max_discount_amount !== ''
        ? Number(raw.max_discount_amount)
        : null,
    starts_at: raw.starts_at ?? raw.start_date ?? null,
    ends_at: raw.ends_at ?? raw.end_date ?? null,
    is_active: raw.is_active === true || raw.is_active === 1 || raw.is_active === '1',
    usage_limit: raw.usage_limit != null ? Number(raw.usage_limit) : null,
    usage_limit_per_user:
      raw.usage_limit_per_user != null ? Number(raw.usage_limit_per_user) : null,
    applies_to: normalizeCouponAppliesTo(raw.applies_to),
    catalog_scope:
      raw.catalog_scope === 'products' || raw.catalog_scope === 'services'
        ? raw.catalog_scope
        : normalizeCouponAppliesTo(raw.applies_to) === 'services'
          ? 'services'
          : 'products',
    category_ids: parseRelationIds(raw.category_ids, raw.categories, [
      'id',
      'category_id',
    ]),
    service_ids: parseRelationIds(raw.service_ids, raw.services, [
      'id',
      'service_id',
    ]),
    paid_redemptions:
      raw.paid_redemptions != null ? Number(raw.paid_redemptions) : null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export function adminCouponToCustomerCoupon(c: AdminCoupon): Coupon {
  return {
    id: String(c.id),
    code: c.code,
    title: c.title,
    description: c.description ?? undefined,
    discount_type: c.discount_type,
    discount_value: c.discount_value,
    min_order_amount: c.min_order_amount,
    max_discount_amount: c.max_discount_amount ?? undefined,
    start_date: c.starts_at ?? undefined,
    end_date: c.ends_at ?? undefined,
    is_active: c.is_active === true || c.is_active === 1,
    usage_limit: c.usage_limit ?? undefined,
    usage_limit_per_user: c.usage_limit_per_user ?? undefined,
    applies_to: c.applies_to,
    catalog_scope: c.catalog_scope,
    category_ids: c.category_ids ?? [],
    service_ids: c.service_ids ?? [],
  };
}
