import type { CouponAppliesTo } from '../types/coupon';

/** Parse id list from scalar, array, or comma-separated string. */
export function parseIdList(raw: unknown): number[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((x) => {
        if (x == null) return NaN;
        if (typeof x === 'object') {
          const o = x as Record<string, unknown>;
          const id = o.id ?? o.service_id ?? o.category_id;
          return Number(id);
        }
        return Number(x);
      })
      .filter((n) => !Number.isNaN(n) && n > 0);
  }
  if (typeof raw === 'number' && raw > 0) return [raw];
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(/[,;]/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
  }
  return [];
}

/** IDs from `service_ids` / `category_ids`, or nested `services` / `categories` from API. */
export function parseRelationIds(
  idsRaw: unknown,
  relationRaw: unknown,
  relationIdKeys: ('id' | 'service_id' | 'category_id')[] = ['id', 'service_id', 'category_id']
): number[] {
  const fromIds = parseIdList(idsRaw);
  if (fromIds.length > 0) return fromIds;
  if (!Array.isArray(relationRaw)) return [];
  const out: number[] = [];
  for (const item of relationRaw) {
    if (item == null) continue;
    if (typeof item === 'number' || typeof item === 'string') {
      const n = Number(item);
      if (!Number.isNaN(n) && n > 0) out.push(n);
      continue;
    }
    if (typeof item === 'object') {
      const o = item as Record<string, unknown>;
      for (const key of relationIdKeys) {
        if (o[key] != null) {
          const n = Number(o[key]);
          if (!Number.isNaN(n) && n > 0) {
            out.push(n);
            break;
          }
        }
      }
    }
  }
  return [...new Set(out)];
}

export function normalizeCouponAppliesTo(raw: unknown): CouponAppliesTo {
  const v = String(raw ?? '')
    .toLowerCase()
    .trim();
  if (v === 'categories' || v === 'category') return 'categories';
  if (v === 'services' || v === 'service') return 'services';
  return 'all';
}

/** Positive integer IDs only — for validation and API payload. */
export function normalizePositiveIds(ids: unknown[]): number[] {
  const out: number[] = [];
  for (const raw of ids) {
    const n = Number(raw);
    if (!Number.isNaN(n) && n > 0 && Number.isInteger(n)) {
      out.push(n);
    }
  }
  return [...new Set(out)];
}

export function idsInclude(selected: number[], itemId: number | string): boolean {
  const id = Number(itemId);
  if (Number.isNaN(id)) return false;
  return selected.some((s) => Number(s) === id);
}

export function toggleIdInList(
  list: number[],
  itemId: number | string,
  selected: boolean
): number[] {
  const id = Number(itemId);
  if (Number.isNaN(id)) return list;
  const normalized = list.map(Number).filter((n) => !Number.isNaN(n));
  if (selected) {
    return normalized.filter((x) => x !== id);
  }
  if (normalized.includes(id)) return normalized;
  return [...normalized, id];
}
