# Coupon flow — guide for Tandil (mobile + Laravel)

This document explains **how coupons should work** end-to-end. The app currently includes a **dummy/demo** layer so you can test UX before the backend is ready.

## 1. Coupon vs exclusive offer

| Feature | Exclusive offer | Coupon code |
|--------|-----------------|-------------|
| Who sets it | Admin | Admin |
| How customer gets it | Taps offer on home → product list | Types code at **Cart / Checkout** |
| Discount | Often tied to specific products | Usually on **whole cart** (or shipping) |
| Your app today | API: `/exclusive-offers` | **Demo only** (`dummyCoupons.ts`) |

## 2. Client requirements (confirmed)

| Requirement | Admin UI field | API field |
|-------------|----------------|-----------|
| Percentage discount (10%, 20%) | Discount type → Percentage | `discount_type: percentage`, `discount_value` |
| Fixed amount (20 AED, 50 AED) | Discount type → Fixed amount | `discount_type: fixed_amount`, `discount_value` |
| Expiry dates | Valid from / Valid until | `starts_at`, `ends_at` |
| Limit usage per user | Uses per customer | `usage_limit_per_user` |
| Minimum order amount | Minimum order (AED) | `min_order_amount` |
| Enable / disable anytime | Active toggle | `is_active` |
| All products OR specific category OR specific service | Where it applies | `applies_to`, `category_ids`, `service_ids` |

**Where it applies (3 options in admin UI):**

1. **All products** — entire store cart.
2. **Specific category** — multi-select product categories.
3. **Specific service** — multi-select services from `/admin/services`.

Optional (still supported): **Free shipping** coupon type for legacy/demo codes.

Optional rules (backend may add later): global usage limit, first-order-only, etc.

## 3. Money flow (how totals are calculated)

Example cart (API order summary):

```
Subtotal (items)           AED 200
Catalog discount           AED  20   ← from products/offers (API `discount`)
─────────────────────────────────
After catalog              AED 180

Coupon SAVE10 (10%)        AED  18   ← app demo: 10% of 180, max cap if set
─────────────────────────────────
Taxable base               AED 162
Tax 5%                     AED   8.10
Shipping                   AED  10   ← 0 if free-shipping coupon
─────────────────────────────────
Total                      AED 180.10
```

**Important:** Laravel must apply the **same math** when you go live. The mobile app should send `coupon_code` on:

- `GET /shop/order-summary?coupon_code=SAVE10`
- `POST /shop/checkout/stripe/payment-intent` (body includes `coupon_code`)

Payment amount must match server total (Stripe charges what backend calculates).

## 4. Demo codes (try in the app now)

| Code | Type | Rule |
|------|------|------|
| `SAVE10` | 10% | Min AED 50, max AED 30 off |
| `FLAT20` | Fixed | AED 20 off, min AED 100 |
| `WELCOME15` | 15% | Min AED 80, max AED 50 off |
| `FREESHIP` | Free shipping | Min AED 75 |
| `EXPIRED` | — | Inactive (should error) |

**Admin → Coupons** screen lists the same demo coupons.

## 5. What to build on Laravel (checklist)

**Full request/response spec:** see **`docs/COUPON_API.md`** (matches admin app forms).

### Admin API

- `GET /admin/coupons` — list
- `POST /admin/coupons` — create
- `PUT /admin/coupons/{id}` — update
- `DELETE /admin/coupons/{id}` — delete

Fields: `code`, `title`, `description`, `discount_type`, `discount_value`, `min_order_amount`, `max_discount_amount`, `starts_at`, `ends_at`, `is_active`, `usage_limit`, `usage_limit_per_user`.

### Shop API (customer)

- `POST /shop/coupons/validate` — body `{ code }` → returns discount preview or error
- Extend `GET /shop/order-summary` and cart with `coupon_code` query/body
- Extend `POST /shop/checkout/stripe/payment-intent` with `coupon_code`
- Store `coupon_id` on `orders` when order is created

### Mobile (after API exists)

- Replace `dummyCoupons.ts` + `couponStore` local math with API calls
- Pass `coupon_code` into `getOrderSummary` and `createStripePaymentIntent`

## 6. Admin UI (implemented)

**Admin → Coupons** — list, add (+), edit, delete.

Form fields (same as `COUPON_API.md`):

1. **Code** (unique, uppercase)
2. **Title** / **Description**
3. **Discount type** — percentage or fixed amount (AED)
4. **Discount value** / **Max discount cap** (percentage)
5. **Minimum order (AED)**
6. **Where it applies** — all products, selected categories, or selected services
7. **Valid from / until** (expiry)
8. **Uses per customer** / global usage limit
9. **Active** toggle (enable/disable anytime)

## 7. Where to test in the app

1. Add items to cart → **Cart** → enter `SAVE10` → see coupon line in summary
2. **Checkout** → coupon should still apply (same store)
3. **Admin dashboard** → **Coupons** → read demo list and flow explanation

When backend is ready, remove or gate `DUMMY_COUPONS` behind `__DEV__` or a feature flag.
