# Coupon API contract (for Laravel backend)

This document matches the **Tandil admin app UI** (Coupons screens). Implement these endpoints so the mobile app can switch from local demo storage to live API.

Base URL: same as existing admin/shop APIs (e.g. `/api/admin/...`, `/api/shop/...`). All admin routes require **Bearer token** with admin role.

---

## 1. Admin — coupon resource

### List coupons

`GET /admin/coupons`

Query (optional): `page`, `per_page`, `search` (matches `code` or `title`)

**Response 200**

```json
{
  "success": true,
  "message": "Coupons loaded.",
  "data": [
    {
      "id": 1,
      "code": "SAVE10",
      "title": "10% off",
      "description": "10% off orders over AED 50.",
      "discount_type": "percentage",
      "discount_value": 10,
      "min_order_amount": 50,
      "max_discount_amount": 30,
      "starts_at": "2026-01-01",
      "ends_at": null,
      "is_active": true,
      "usage_limit": null,
      "usage_limit_per_user": 3,
      "created_at": "2026-05-01T10:00:00.000000Z",
      "updated_at": "2026-05-01T10:00:00.000000Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "total": 1
  }
}
```

`data` may also be paginated as `{ "data": [ ... ], "current_page": 1, ... }` (same pattern as exclusive offers).

---

### Get one coupon

`GET /admin/coupons/{id}`

**Headers:** `Authorization: Bearer {token}`, `Accept: application/json`

**Response 200**

```json
{
  "success": true,
  "message": "Coupon retrieved.",
  "data": {
    "id": 1,
    "code": "SAVE10",
    "title": "10% off",
    "description": "10% off orders over AED 50 (max AED 30 off). All store products.",
    "discount_type": "percentage",
    "discount_value": 10,
    "min_order_amount": 50,
    "max_discount_amount": 30,
    "starts_at": "2026-04-20",
    "ends_at": null,
    "is_active": true,
    "usage_limit": null,
    "usage_limit_per_user": 3,
    "applies_to": "all",
    "catalog_scope": "products",
    "category_ids": [],
    "service_ids": [],
    "paid_redemptions": 0,
    "created_at": "2026-05-20T10:50:53+00:00",
    "updated_at": "2026-05-20T10:50:53+00:00"
  }
}
```

**Mobile:** Edit screen calls `adminCouponService.getCouponById(id)` on open and fills the form from `data`.

**Backend (service scope):** When `applies_to` is `services`, the response **must** include either:

- `service_ids`: `[1, 2]` (array of integers), **or**
- `services`: `[{ "id": 1, "name": "House care" }, ...]` (relation)

If only `applies_to: "services"` is returned with empty `service_ids` and no `services` array, the app cannot show selected services on edit (API did not persist or did not serialize the pivot).

---

### Create coupon

`POST /admin/coupons`

**Headers:** `Authorization: Bearer {token}`, `Accept: application/json`

**Content-Type:** `multipart/form-data`

| Field | Example | Notes |
|-------|---------|--------|
| `code` | `SAVE10` | Unique, uppercase |
| `title` | `10% off` | |
| `description` | `10% off orders over AED 50...` | |
| `discount_type` | `percentage` | `percentage` \| `fixed_amount` \| `free_shipping` |
| `discount_value` | `10` | % or AED |
| `min_order_amount` | `50` | AED |
| `max_discount_amount` | `30` | Percentage only (optional) |
| `starts_at` | `2026-01-01` | `YYYY-MM-DD` |
| `ends_at` | `2026-12-31` | `YYYY-MM-DD` |
| `usage_limit` | *(empty)* | Global limit (optional) |
| `usage_limit_per_user` | `3` | Per customer (optional) |
| `applies_to` | `all` | `all` \| `categories` \| `services` |
| `catalog_scope` | `products` | `products` \| `services` \| `both` |
| `category_ids[]` | `3`, `7` | When `applies_to=categories` |
| `service_ids[]` | `2` | When `applies_to=services` — repeat per id (`service_ids[]=1&service_ids[]=2`). Mobile does **not** use `service_ids[0]` indexed keys. |
| `is_active` | `1` | `1` or `0` |

**Mobile:** `adminCouponService.createCoupon(payload)` — sends form-data via POST.

**Client requirements (confirmed):**

- Discount types: **percentage** and **fixed amount** (AED)
- **Expiry dates** (`starts_at`, `ends_at`)
- **Usage limit per user** (`usage_limit_per_user`)
- **Minimum order amount** (`min_order_amount`)
- **Enable/disable** anytime (`is_active`)
- **All products** OR **specific categories** OR **specific services** (`applies_to` + `category_ids` / `service_ids`)

**Example — percentage**

```json
{
  "code": "SAVE10",
  "title": "10% off",
  "description": "10% off orders over AED 50 (max AED 30 off).",
  "discount_type": "percentage",
  "discount_value": 10,
  "min_order_amount": 50,
  "max_discount_amount": 30,
  "starts_at": null,
  "ends_at": null,
  "is_active": true,
  "usage_limit": null,
  "usage_limit_per_user": 3,
  "applies_to": "all",
  "catalog_scope": "products",
  "category_ids": []
}
```

**Example — fixed amount**

```json
{
  "code": "FLAT20",
  "title": "AED 20 off",
  "discount_type": "fixed_amount",
  "discount_value": 20,
  "min_order_amount": 100,
  "is_active": true,
  "applies_to": "all",
  "catalog_scope": "both",
  "category_ids": []
}
```

**Example — specific categories only**

```json
{
  "code": "FERT15",
  "title": "15% off fertilizers",
  "discount_type": "percentage",
  "discount_value": 15,
  "min_order_amount": 80,
  "max_discount_amount": 40,
  "starts_at": "2026-06-01",
  "ends_at": "2026-08-31",
  "is_active": true,
  "usage_limit_per_user": 1,
  "applies_to": "categories",
  "catalog_scope": "both",
  "category_ids": [3, 7]
}
```

**Example — free shipping** (optional type)

```json
{
  "code": "FREESHIP",
  "title": "Free shipping",
  "discount_type": "free_shipping",
  "discount_value": 0,
  "min_order_amount": 75,
  "is_active": true
}
```

**Response 201**

```json
{
  "success": true,
  "message": "Coupon created.",
  "data": { "id": 6, "code": "SAVE10", "...": "..." }
}
```

**Errors:** `422` validation (duplicate `code`, invalid dates, missing `discount_value` for percentage).

---

### Update coupon

`PUT /admin/coupons/{id}`

**Headers:** `Authorization: Bearer {token}`, `Accept: application/json`

**Content-Type:** `multipart/form-data`

| Field | Example |
|-------|---------|
| `code` | `SAVE10` |
| `title` | `10% off (updated)` |
| `description` | `10% off orders over AED 50...` |
| `discount_type` | `percentage` |
| `discount_value` | `10` |
| `min_order_amount` | `50` |
| `max_discount_amount` | `30` |
| `starts_at` | `2026-01-01` |
| `ends_at` | `2026-12-31` |
| `usage_limit` | *(empty or number)* |
| `usage_limit_per_user` | `1` |
| `is_active` | `1` or `0` |
| `applies_to` | `all` \| `categories` \| `services` |
| `catalog_scope` | `products` \| `services` \| `both` |
| `category_ids[]` | `3`, `7` *(when categories)* |
| `service_ids[]` | `2` *(when services)* |

**Response 200**

```json
{
  "success": true,
  "message": "Coupon updated.",
  "data": { "id": 1, "code": "SAVE10", "...": "..." }
}
```

**Mobile:** `adminCouponService.updateCoupon(id, payload)` — sends form-data via PUT.

---

### Delete coupon

`DELETE /admin/coupons/{id}`

**Headers:** `Authorization: Bearer {token}`, `Accept: application/json`

**Response 200**

```json
{
  "success": true,
  "message": "Coupon deleted."
}
```

**Mobile:** `adminCouponService.deleteCoupon(id)` — then reloads the list via `GET /admin/coupons`.

---

## 2. Shop — customer apply coupon

### Validate coupon (preview)

`POST /shop/coupons/validate`

**Body**

```json
{
  "code": "SAVE10",
  "subtotal": 200,
  "catalog_discount": 20
}
```

- `subtotal` — cart subtotal from order summary
- `catalog_discount` — product/offer discount already applied (optional, default 0)

**Response 200 — valid**

```json
{
  "success": true,
  "data": {
    "coupon_id": 1,
    "code": "SAVE10",
    "discount_type": "percentage",
    "coupon_discount": 18,
    "free_shipping": false,
    "message": "Coupon applied."
  }
}
```

**Response 422 — invalid**

```json
{
  "success": false,
  "message": "Minimum order is 50 AED after discounts."
}
```

Server must use the **same math** as mobile (see `docs/COUPON_FLOW.md`).

---

### Order summary with coupon

`GET /shop/order-summary?coupon_code=SAVE10`

(or `POST` with body `{ "coupon_code": "SAVE10" }` if your cart API is POST-only)

Extend existing order summary response:

```json
{
  "subtotal": 200,
  "discount": 20,
  "coupon_discount": 18,
  "coupon_code": "SAVE10",
  "shipping": 10,
  "tax_percent": 5,
  "tax": 8.1,
  "total": 180.1,
  "currency": "AED"
}
```

When `free_shipping` coupon applies: `shipping` = 0.

---

### Stripe payment intent

`POST /shop/checkout/stripe/payment-intent`

Add to existing body:

```json
{
  "coupon_code": "SAVE10",
  "address": { "...": "..." }
}
```

**Amount charged must equal server `total` after coupon.** Reject mismatches.

---

### Order record

On order create, store `coupon_id` and `coupon_code` on the `orders` table for reporting.

---

## 3. Discount calculation (server-side)

Given:

- `subtotal` — sum of line items
- `catalog_discount` — from products/exclusive offers
- `after_catalog = max(0, subtotal - catalog_discount)`

**Percentage**

```
raw = after_catalog * (discount_value / 100)
coupon_discount = min(raw, max_discount_amount)  // if max set
```

**Fixed amount**

```
coupon_discount = min(discount_value, after_catalog)
```

**Free shipping**

```
coupon_discount = 0
free_shipping = true
shipping = 0
```

**Tax** (align with shop settings):

```
taxable = max(0, after_catalog - coupon_discount)
tax = taxable * (tax_percent / 100)
total = taxable + tax + shipping
```

Also validate: `is_active`, date range (`starts_at` / `ends_at`), `min_order_amount`, usage limits.

---

## 4. Mobile integration checklist

When Laravel is ready:

1. `src/services/adminCouponService.ts` — already calls these endpoints; remove local-only fallback or gate with env flag.
2. `POST /shop/coupons/validate` — replace client-side `couponMath` in checkout.
3. Pass `coupon_code` in `getOrderSummary` and `createStripePaymentIntent`.

---

## 5. UI field → API field map

| Admin app label | API field |
|-----------------|-----------|
| Coupon code | `code` |
| Title | `title` |
| Description | `description` |
| Discount type | `discount_type` |
| Discount value | `discount_value` |
| Minimum order (AED) | `min_order_amount` |
| Maximum discount (AED) | `max_discount_amount` |
| Valid from | `starts_at` |
| Valid until | `ends_at` |
| Active | `is_active` |
| Global usage limit | `usage_limit` |
| Per-user usage limit | `usage_limit_per_user` |
| Applies to (all vs categories) | `applies_to` |
| Catalog scope (products / services / both) | `catalog_scope` |
| Selected category IDs | `category_ids` |

### Shop validation body (extra fields)

| Context | API field |
|---------|-----------|
| Cart category IDs | `cart_category_ids` |
| Cart type | `cart_catalog` (`products` / `services`) |
