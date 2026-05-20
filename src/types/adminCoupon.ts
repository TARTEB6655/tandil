import type { CouponAppliesTo, CouponCatalogScope, CouponDiscountType } from './coupon';

export interface AdminCoupon {
  id: number | string;
  code: string;
  title: string;
  description?: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  min_order_amount: number;
  max_discount_amount?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active: boolean | number;
  usage_limit?: number | null;
  usage_limit_per_user?: number | null;
  applies_to: CouponAppliesTo;
  catalog_scope: CouponCatalogScope;
  category_ids: number[];
  service_ids: number[];
  paid_redemptions?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AdminCouponsListMeta {
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}

export interface AdminCouponsListResponse {
  success?: boolean;
  message?: string;
  data: AdminCoupon[];
  meta?: AdminCouponsListMeta;
}

export type AdminCouponPayload = {
  code: string;
  title: string;
  description?: string;
  discount_type: CouponDiscountType;
  discount_value: number;
  min_order_amount: number;
  max_discount_amount?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active: boolean;
  usage_limit?: number | null;
  usage_limit_per_user?: number | null;
  applies_to: CouponAppliesTo;
  catalog_scope: CouponCatalogScope;
  category_ids: number[];
  service_ids: number[];
};
