import { create } from 'zustand';
import type { AppliedCouponResult, CouponApplyContext } from '../types/coupon';
import { applyCouponToSubtotal } from '../utils/couponMath';

interface CouponStore {
  applied: AppliedCouponResult | null;
  appliedCode: string | null;
  apply: (
    code: string,
    subtotal: number,
    catalogDiscount?: number,
    context?: CouponApplyContext
  ) => { ok: boolean; message?: string };
  clear: () => void;
}

export const useCouponStore = create<CouponStore>((set) => ({
  applied: null,
  appliedCode: null,
  apply: (code, subtotal, catalogDiscount = 0, context) => {
    const res = applyCouponToSubtotal(code, subtotal, catalogDiscount, context);
    if (!res.ok) {
      return { ok: false, message: res.message };
    }
    set({ applied: res.result, appliedCode: res.result.coupon.code });
    return { ok: true };
  },
  clear: () => set({ applied: null, appliedCode: null }),
}));
