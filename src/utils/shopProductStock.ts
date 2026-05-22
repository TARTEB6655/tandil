/** Parse stock / availability fields from shop product API payloads. */

export type ShopProductStockSource = {
  stock?: number | string | null;
  stock_quantity?: number | string | null;
  quantity?: number | string | null;
  available_stock?: number | string | null;
  in_stock?: boolean | number | string | null;
  is_in_stock?: boolean | number | string | null;
  track_quantity?: boolean | number | string | null;
  allow_backorder?: boolean | number | string | null;
  status?: string | null;
};

export function parseStockValue(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : null;
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

function isFalsyFlag(value: unknown): boolean {
  return value === false || value === 0 || value === '0';
}

/**
 * Whether a shop product can be ordered.
 * Handles Laravel variants: stock, stock_quantity, in_stock, track_quantity, status.
 */
export function isShopProductInStock(product: ShopProductStockSource): boolean {
  if (isTruthyFlag(product.in_stock) || isTruthyFlag(product.is_in_stock)) {
    return true;
  }
  if (isFalsyFlag(product.in_stock) || isFalsyFlag(product.is_in_stock)) {
    return false;
  }

  if (isFalsyFlag(product.track_quantity)) {
    return true;
  }

  if (isTruthyFlag(product.allow_backorder)) {
    return true;
  }

  const stock =
    parseStockValue(product.stock) ??
    parseStockValue(product.stock_quantity) ??
    parseStockValue(product.quantity) ??
    parseStockValue(product.available_stock);

  if (stock != null) {
    return stock > 0;
  }

  const status = String(product.status ?? '').toLowerCase().trim();
  if (
    status === 'active' ||
    status === 'published' ||
    status === 'available' ||
    status === '1'
  ) {
    return true;
  }
  if (status === 'inactive' || status === 'draft' || status === 'out_of_stock') {
    return false;
  }

  return true;
}

/** Numeric stock for display; uses parsed fields or 1/0 from availability. */
export function resolveShopProductStock(product: ShopProductStockSource): number {
  const parsed =
    parseStockValue(product.stock) ??
    parseStockValue(product.stock_quantity) ??
    parseStockValue(product.quantity) ??
    parseStockValue(product.available_stock);

  if (parsed != null) return parsed;
  return isShopProductInStock(product) ? 1 : 0;
}
