import type { Coupon } from '../types/coupon';

let customerCatalogCache: Coupon[] = [];

export function setCustomerCouponCatalog(coupons: Coupon[]): void {
  customerCatalogCache = coupons;
}

/** API-backed catalog cache (no demo merge). */
export function getCustomerCouponCatalogSync(): Coupon[] {
  return customerCatalogCache;
}
