import type { AdminCategory } from '../services/adminService';

/** Admin list + client catalog order: lower `sort_order` first; ties / missing → newest first. */
export function sortAdminCategoriesForDisplay(categories: AdminCategory[]): AdminCategory[] {
  return [...categories].sort((a, b) => {
    const ao =
      a.sort_order != null && !Number.isNaN(Number(a.sort_order)) ? Number(a.sort_order) : null;
    const bo =
      b.sort_order != null && !Number.isNaN(Number(b.sort_order)) ? Number(b.sort_order) : null;
    if (ao != null && bo != null && ao !== bo) return ao - bo;
    if (ao != null && bo == null) return -1;
    if (ao == null && bo != null) return 1;
    const at = a.created_at ? Date.parse(a.created_at) : 0;
    const bt = b.created_at ? Date.parse(b.created_at) : 0;
    if (bt !== at) return bt - at;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}

/** Put a newly created category at the top of ordered lists (sort_order below current minimum). */
export function sortOrderForNewAdminCategory(existing: AdminCategory[]): number {
  const orders = existing
    .map((c) => c.sort_order)
    .filter((v) => v != null && !Number.isNaN(Number(v)))
    .map((v) => Number(v));
  if (orders.length === 0) return 1;
  return Math.min(...orders) - 1;
}
