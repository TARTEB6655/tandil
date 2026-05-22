/**
 * Customer shop coupons — GET /shop/coupons/browse (Bearer customer token).
 */
import apiClient from './api';
import type { AppliedCouponResult, Coupon } from '../types/coupon';
import type { CouponApplyContext } from '../types/coupon';
import type { OrderSummaryData } from './cartService';
import { getCouponErrorFeedback } from '../utils/couponApiErrors';
import {
  setCustomerCouponCatalog,
  getCustomerCouponCatalogSync,
} from './customerCouponCatalog';
import { normalizeAdminCoupon, adminCouponToCustomerCoupon } from '../utils/couponMapping';
import {
  evaluateCouponForCart,
  type CheckoutCouponOffer,
} from '../utils/couponAvailability';
import { formatCouponScopeLabel } from '../utils/couponScopeLabel';
import { formatCouponDiscountPreview } from '../utils/couponDisplay';

export type BrowseCouponsParams = {
  /** GET /shop/coupons/browse?all=1 — list all coupons for checkout picker */
  all?: boolean | number;
  category_id?: number;
  service_id?: number;
  subtotal?: number;
};

export type CartLineForCoupons = {
  categoryId?: number | null;
  serviceId?: number | null;
};

export type BrowseCouponsResult = {
  coupons: Coupon[];
  eligible: CheckoutCouponOffer[];
  ineligible: CheckoutCouponOffer[];
  fromApi: boolean;
};

export type ApplyShopCouponResult =
  | { ok: true; result: AppliedCouponResult; orderSummary?: OrderSummaryData }
  | { ok: false; message: string };

function mapRawToCustomerCoupon(raw: Record<string, unknown>): Coupon | null {
  try {
    const code = String(raw.code ?? '').trim();
    if (!code) return null;
    const admin = normalizeAdminCoupon(raw);
    // Browse API often omits is_active; treat missing as active.
    if (raw.is_active === undefined || raw.is_active === null) {
      admin.is_active = true;
    }
    return adminCouponToCustomerCoupon(admin);
  } catch {
    return null;
  }
}

function discountPreview(coupon: Coupon): string {
  return formatCouponDiscountPreview(coupon);
}

function rawToOffer(
  raw: Record<string, unknown>,
  categoryNames?: Map<number, string>,
  serviceNames?: Map<number, string>
): CheckoutCouponOffer | null {
  const coupon =
    raw.coupon && typeof raw.coupon === 'object'
      ? mapRawToCustomerCoupon(raw.coupon as Record<string, unknown>)
      : mapRawToCustomerCoupon(raw);
  if (!coupon) return null;
  const scopeLabel = formatCouponScopeLabel(coupon, categoryNames, serviceNames);
  const discountLabel = discountPreview(coupon);
  const eligible =
    raw.eligible === true ||
    raw.eligible === 1 ||
    raw.eligible === '1' ||
    raw.is_eligible === true;
  const reason =
    typeof raw.reason === 'string'
      ? raw.reason
      : typeof raw.message === 'string'
        ? raw.message
        : undefined;
  if (eligible) {
    return { coupon, scopeLabel, discountLabel, eligible: true };
  }
  return {
    coupon,
    scopeLabel,
    discountLabel,
    eligible: false,
    reason: reason || 'Not eligible for this cart.',
  };
}

function extractCouponObjects(data: unknown): Record<string, unknown>[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
  }
  if (typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;

  for (const key of ['coupons', 'items', 'results', 'list']) {
    const val = d[key];
    if (Array.isArray(val)) {
      return val.filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
    }
  }

  const nested = d.data;
  if (Array.isArray(nested)) {
    return nested.filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
  }
  if (nested && typeof nested === 'object') {
    return extractCouponObjects(nested);
  }

  return [];
}

function parseBrowseResponse(
  body: unknown,
  categoryNames?: Map<number, string>,
  serviceNames?: Map<number, string>
): BrowseCouponsResult {
  const empty: BrowseCouponsResult = {
    coupons: [],
    eligible: [],
    ineligible: [],
    fromApi: false,
  };

  if (!body || typeof body !== 'object') return empty;
  const root = body as Record<string, unknown>;
  if (root.success === false) return empty;

  const data = root.data ?? root;
  if (!data || typeof data !== 'object') return empty;

  const d = data as Record<string, unknown>;
  const serverEligible = Array.isArray(d.eligible) ? d.eligible : [];
  const serverIneligible = Array.isArray(d.ineligible) ? d.ineligible : [];

  if (serverEligible.length > 0 || serverIneligible.length > 0) {
    const eligible: CheckoutCouponOffer[] = [];
    const ineligible: CheckoutCouponOffer[] = [];
    const coupons: Coupon[] = [];

    for (const row of serverEligible) {
      if (!row || typeof row !== 'object') continue;
      const offer = rawToOffer(row as Record<string, unknown>, categoryNames, serviceNames);
      if (offer) {
        eligible.push({ ...offer, eligible: true });
        coupons.push(offer.coupon);
      }
    }
    for (const row of serverIneligible) {
      if (!row || typeof row !== 'object') continue;
      const offer = rawToOffer(row as Record<string, unknown>, categoryNames, serviceNames);
      if (offer) {
        ineligible.push({ ...offer, eligible: false });
        coupons.push(offer.coupon);
      }
    }

    return {
      coupons: mergeCouponsByCode(coupons),
      eligible,
      ineligible,
      fromApi: coupons.length > 0,
    };
  }

  const raws = extractCouponObjects(data);
  const coupons = raws
    .map((raw) => mapRawToCustomerCoupon(raw))
    .filter((c): c is Coupon => c != null);

  return {
    coupons: mergeCouponsByCode(coupons),
    eligible: [],
    ineligible: [],
    fromApi: coupons.length > 0,
  };
}

function mergeCouponsByCode(list: Coupon[]): Coupon[] {
  const byCode = new Map<string, Coupon>();
  list.forEach((c) => byCode.set(c.code.toUpperCase(), c));
  return Array.from(byCode.values());
}

function mergeBrowseResults(results: BrowseCouponsResult[]): BrowseCouponsResult {
  const coupons = mergeCouponsByCode(results.flatMap((r) => r.coupons));
  const eligibleByCode = new Map<string, CheckoutCouponOffer>();
  const ineligibleByCode = new Map<string, CheckoutCouponOffer>();

  for (const r of results) {
    for (const o of r.eligible) eligibleByCode.set(o.coupon.code.toUpperCase(), o);
    for (const o of r.ineligible) {
      const key = o.coupon.code.toUpperCase();
      if (!eligibleByCode.has(key)) ineligibleByCode.set(key, o);
    }
  }

  return {
    coupons,
    eligible: Array.from(eligibleByCode.values()),
    ineligible: Array.from(ineligibleByCode.values()),
    fromApi: results.some((r) => r.fromApi),
  };
}

export { setCustomerCouponCatalog, getCustomerCouponCatalogSync } from './customerCouponCatalog';

export function buildCouponApplyContext(lines: CartLineForCoupons[]): CouponApplyContext {
  const categoryIds = [
    ...new Set(
      lines
        .map((l) => l.categoryId)
        .filter((id): id is number => typeof id === 'number' && id > 0)
    ),
  ];
  const serviceIds = [
    ...new Set(
      lines
        .map((l) => l.serviceId)
        .filter((id): id is number => typeof id === 'number' && id > 0)
    ),
  ];
  return {
    cartCatalog: serviceIds.length > 0 ? 'services' : 'products',
    cartCategoryIds: categoryIds,
    cartServiceIds: serviceIds,
  };
}

/**
 * Browse query variants per API:
 * - ?all=1 — all coupons (checkout modal)
 * - ?category_id=N — coupons for a cart category
 * - ?service_id=N — coupons for a cart service
 */
function buildBrowseQueryVariants(
  context: CouponApplyContext | undefined
): BrowseCouponsParams[] {
  const serviceIds = [...new Set((context?.cartServiceIds ?? []).filter((id) => id > 0))];
  const categoryIds = [...new Set((context?.cartCategoryIds ?? []).filter((id) => id > 0))];

  const variants: BrowseCouponsParams[] = [{ all: 1 }];

  categoryIds.forEach((category_id) => {
    variants.push({ category_id });
  });
  serviceIds.forEach((service_id) => {
    variants.push({ service_id });
  });

  const seen = new Set<string>();
  return variants.filter((v) => {
    const key = JSON.stringify(v);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * GET /shop/coupons/browse
 * - ?all=1
 * - ?category_id=
 * - ?service_id=
 */
export async function browseShopCoupons(
  params: BrowseCouponsParams = {}
): Promise<BrowseCouponsResult> {
  const query: Record<string, string | number> = {};

  if (params.all === true || params.all === 1 || params.all === '1') {
    query.all = 1;
  } else if (params.category_id != null && params.category_id > 0) {
    query.category_id = params.category_id;
  } else if (params.service_id != null && params.service_id > 0) {
    query.service_id = params.service_id;
  }

  if (params.subtotal != null && params.subtotal >= 0) {
    query.subtotal = params.subtotal;
  }

  const response = await apiClient.get('/shop/coupons/browse', {
    params: query,
    timeout: 15000,
    headers: { Accept: 'application/json' },
  });

  const parsed = parseBrowseResponse(response.data);
  return { ...parsed, fromApi: true };
}

/** All coupons for checkout picker — GET /shop/coupons/browse?all=1 */
export async function browseAllShopCoupons(): Promise<BrowseCouponsResult> {
  return browseShopCoupons({ all: 1 });
}

function parseOrderSummaryFromApply(raw: unknown): OrderSummaryData | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const d = raw as Record<string, unknown>;
  const subtotal = Number(d.subtotal);
  if (!Number.isFinite(subtotal)) return undefined;
  return {
    subtotal,
    discount: Number(d.discount ?? 0) || 0,
    shipping: Number(d.shipping ?? 0) || 0,
    shipping_label:
      typeof d.shipping_label === 'string' ? d.shipping_label : null,
    tax_percent: d.tax_percent != null ? Number(d.tax_percent) : undefined,
    tax: d.tax != null ? Number(d.tax) : undefined,
    total: Number(d.total ?? subtotal) || subtotal,
    currency: String(d.currency ?? 'AED'),
    wallet_available: d.wallet_available as boolean | undefined,
    wallet_balance:
      d.wallet_balance != null ? Number(d.wallet_balance) : undefined,
    use_wallet: d.use_wallet as boolean | undefined,
    wallet_amount_applied:
      d.wallet_amount_applied != null ? Number(d.wallet_amount_applied) : undefined,
    amount_due: d.amount_due != null ? Number(d.amount_due) : undefined,
  };
}

function parseApplyResponse(body: unknown, requestedCode: string): ApplyShopCouponResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Invalid response from server.' };
  }
  const root = body as Record<string, unknown>;
  if (root.success === false) {
    return {
      ok: false,
      message: String(root.message ?? 'Could not apply coupon.'),
    };
  }

  const data = (root.data ?? root) as Record<string, unknown>;
  if (!data || typeof data !== 'object') {
    return { ok: false, message: 'Invalid response from server.' };
  }

  const couponRaw =
    data.coupon && typeof data.coupon === 'object'
      ? (data.coupon as Record<string, unknown>)
      : data;

  let coupon = mapRawToCustomerCoupon(couponRaw);
  if (!coupon) {
    const code = String(couponRaw.code ?? requestedCode).trim().toUpperCase();
    if (!code) {
      return { ok: false, message: 'Invalid coupon response.' };
    }
    coupon = mapRawToCustomerCoupon({
      ...couponRaw,
      code,
      title: String(couponRaw.title ?? couponRaw.name ?? code),
      discount_type: couponRaw.discount_type ?? 'percentage',
      discount_value: Number(couponRaw.discount_value ?? 0),
      min_order_amount: Number(couponRaw.min_order_amount ?? 0),
      is_active: true,
      applies_to: couponRaw.applies_to ?? 'all',
      catalog_scope: couponRaw.catalog_scope ?? 'products',
    });
  }
  if (!coupon) {
    return { ok: false, message: 'Invalid coupon response.' };
  }

  const freeShipping =
    data.free_shipping === true ||
    data.free_shipping === 1 ||
    data.free_shipping === '1' ||
    coupon.discount_type === 'free_shipping';

  const couponDiscount = freeShipping
    ? 0
    : Math.max(
        0,
        Number(
          data.coupon_discount ??
            data.discount_amount ??
            data.discount ??
            0
        ) || 0
      );

  const orderSummary = parseOrderSummaryFromApply(
    data.order_summary ?? data.summary ?? data.orderSummary
  );

  return {
    ok: true,
    result: {
      coupon,
      coupon_discount: couponDiscount,
      free_shipping: freeShipping,
    },
    orderSummary,
  };
}

/**
 * POST /shop/coupons/apply — body { "code": "SAVE10" }
 */
export async function applyShopCoupon(code: string): Promise<ApplyShopCouponResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return { ok: false, message: 'Enter a coupon code.' };
  }

  try {
    const response = await apiClient.post(
      '/shop/coupons/apply',
      { code: normalized },
      {
        timeout: 15000,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    const parsed = parseApplyResponse(response.data, normalized);
    if (parsed.ok) {
      const merged = mergeCouponsByCode([
        ...getCustomerCouponCatalogSync(),
        parsed.result.coupon,
      ]);
      setCustomerCouponCatalog(merged);
    }
    return parsed;
  } catch (err: unknown) {
    const { alertMessage } = getCouponErrorFeedback(err);
    return { ok: false, message: alertMessage };
  }
}

export async function browseCouponsForCheckout(
  context: CouponApplyContext | undefined,
  subtotal: number,
  categoryNames?: Map<number, string>,
  serviceNames?: Map<number, string>
): Promise<BrowseCouponsResult> {
  const variants = buildBrowseQueryVariants(context);
  const results: BrowseCouponsResult[] = [];
  let requestSucceeded = false;

  for (const params of variants) {
    try {
      const parsed = await browseShopCoupons(params);
      requestSucceeded = true;
      if (parsed.eligible.length > 0 || parsed.ineligible.length > 0) {
        results.push(parsed);
      } else if (parsed.coupons.length > 0) {
        const offers = parsed.coupons.map((c) =>
          evaluateCouponForCart(c, subtotal, 0, context, categoryNames, serviceNames)
        );
        results.push({
          coupons: parsed.coupons,
          eligible: offers.filter((o) => o.eligible),
          ineligible: offers.filter((o) => !o.eligible),
          fromApi: true,
        });
      } else {
        results.push(parsed);
      }
    } catch {
      /* try next variant */
    }
  }

  const merged =
    results.length > 0
      ? mergeBrowseResults(results)
      : { coupons: [], eligible: [], ineligible: [], fromApi: requestSucceeded };

  setCustomerCouponCatalog(merged.coupons);
  return merged;
}

export async function refreshCustomerCouponCatalog(
  context?: CouponApplyContext,
  subtotal = 0
): Promise<Coupon[]> {
  const res = await browseCouponsForCheckout(context, subtotal);
  return res.coupons;
}
