import { create } from 'zustand';
import type { AppliedCouponResult, CouponApplyContext } from '../types/coupon';
import type { OrderSummaryData } from '../services/cartService';
import { applyShopCoupon } from '../services/shopCouponService';

export type CouponApplyResponse = {
  ok: boolean;
  message?: string;
  orderSummary?: OrderSummaryData;
};

interface CouponStore {
  applied: AppliedCouponResult | null;
  appliedCode: string | null;
  /** POST /shop/coupons/apply */
  apply: (code: string) => Promise<CouponApplyResponse>;
  clear: () => void;
}

export const useCouponStore = create<CouponStore>((set) => ({
  applied: null,
  appliedCode: null,
  apply: async (code) => {
    const res = await applyShopCoupon(code);
    if (!res.ok) {
      return { ok: false, message: res.message };
    }
    set({
      applied: res.result,
      appliedCode: res.result.coupon.code,
    });
    return { ok: true, orderSummary: res.orderSummary };
  },
  clear: () => set({ applied: null, appliedCode: null }),
}));
