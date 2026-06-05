import type { AdminCategory } from '../services/adminService';

export function parseCategoryNumber(
  value: number | string | null | undefined
): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function getCategoryShippingCost(category: AdminCategory): number | null {
  return parseCategoryNumber(category.shipping_cost ?? category.shipping_amount);
}

export function getCategoryTaxPercentage(category: AdminCategory): number | null {
  return parseCategoryNumber(category.tax_percentage ?? category.tax_percent);
}
