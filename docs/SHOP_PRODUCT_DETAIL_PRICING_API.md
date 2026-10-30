# Shop product detail pricing (backend contract)

Customer app screen: **Product Details** (`GET /api/shop/products/{id}`).

When admin enables vendor **area** pricing (fixed and/or per m²) and **tree/palm** pricing with **Show on client**, the product detail response should expose enough fields for tabs, m² input, and tree counters without extra calls.

## Required top-level fields (recommended)

| Field | Type | Purpose |
| --- | --- | --- |
| `vendor_id` | number | Vendor-scoped pricing |
| `show_area_pricing_on_client` | boolean | `true` when vendor area pricing is visible on client |
| `enable_fixed_price` | boolean | Fixed checkout option |
| `enable_per_m2` | boolean | Per m² option |
| `fixed_price` | number | Fixed checkout amount (not catalog-only) |
| `price_per_m2` or `per_m2_price` | number | Unit rate for m² |
| `catalog_price` or `base_price` | number | Base/catalog line (for “Base price” tab) |
| `price` | number | List/catalog price fallback |
| `show_tree_options` | boolean | `true` to show tree/palm counters |
| `tree_pricing` | object | See below |
| `customer_preview` | object | Labels, checkout totals, display breakdown |
| `area_pricing_options` | object | Optional structured fixed / per_m² blocks |
| `price_includes` | object | Materials, installation, labor, etc. |

## `tree_pricing` example

```json
{
  "enabled": true,
  "optional": true,
  "trees": {
    "unit_price": 50,
    "label": "Number of trees",
    "unit_price_label": "AED / tree"
  },
  "palm_trees": {
    "unit_price": 50,
    "label": "Number of palm trees",
    "unit_price_label": "AED / palm"
  }
}
```

Alternatively: `price_per_tree` and `price_per_palm` (or `price_per_palm_tree`) on the product root.

## `customer_preview` (for fixed tab breakdown)

```json
{
  "when_fixed_selected": {
    "checkout_total": 600,
    "checkout_total_label": "AED 600",
    "breakdown": {
      "display_only": true,
      "lines": [
        { "key": "catalog", "label": "Product price", "amount": 300, "amount_label": "AED 300" },
        { "key": "fixed", "label": "Fixed price", "amount": 300, "amount_label": "AED 300" }
      ]
    }
  }
}
```

## Cart / buy-now (customer POST bodies)

App may send:

- `area_pricing_mode`: `"base"` | `"fixed"` | `"per_m2"`
- `area_m2`: number (when mode is `per_m2`)
- `tree_quantity`, `palm_tree_quantity`: optional counts

Ensure `/shop/cart/add` and `/shop/buy-now/summary` honor these when pricing is vendor-configured.

## Fallback endpoints (app uses if product GET is incomplete)

- `GET /api/shop/vendors/{vendor_id}/pricing/service`
- `GET /api/shop/vendors/{vendor_id}/pricing/tree-palm`

These should return the same flags and amounts as merged on the product when **Show on client** is on.

## Common gap (matches reported bug)

Vendor toggles are on in admin, but product GET returns:

- `show_tree_options: true` and `tree_pricing` (trees visible), **without**
- `show_area_pricing_on_client: true`, `enable_fixed_price`, `enable_per_m2`, rates, or `customer_preview`

**Fix:** Merge vendor service pricing into `GET /shop/products/{id}` for that vendor’s products/services (or set the fields on the product record when publishing).
