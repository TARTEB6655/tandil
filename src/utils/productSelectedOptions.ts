import type { ProductCustomizationConfig } from '../types/productCustomization';

function parseNumericOptionId(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Resolve a shop option row id from API fields or UI temp_key (e.g. opt_434). */
export function resolveShopOptionApiId(opt: {
  id?: unknown;
  option_id?: unknown;
  temp_key?: unknown;
}): number | null {
  return (
    parseNumericOptionId(opt.id) ??
    parseNumericOptionId(opt.option_id) ??
    (() => {
      const key = opt.temp_key != null ? String(opt.temp_key).trim() : '';
      const match = /^opt_(\d+)$/.exec(key);
      return match ? parseNumericOptionId(match[1]) : null;
    })()
  );
}

function resolveUiOptionId(
  opt: { id?: unknown; option_id?: unknown; temp_key?: unknown },
  groupIndex: number,
  optionIndex: number,
  apiOptionId: number | null
): string {
  if (apiOptionId != null) return String(apiOptionId);
  const tempKey = opt.temp_key != null ? String(opt.temp_key).trim() : '';
  if (tempKey) return tempKey;
  return `opt_${groupIndex}_${optionIndex}`;
}

function resolveApiIdFromUiSelection(
  group: ProductCustomizationConfig['groups'][number],
  uiId: string
): number | null {
  const opt = group.options.find((o) => o.id === uiId);
  if (opt?.apiOptionId != null) return opt.apiOptionId;
  const direct = parseNumericOptionId(uiId);
  if (direct != null) return direct;
  const match = /^opt_(\d+)$/.exec(uiId);
  return match ? parseNumericOptionId(match[1]) : null;
}

/** Map GET /shop/products/:id option_groups → product detail customization state. */
export function mapShopApiOptionGroupsToCustomization(
  optionGroups: unknown
): ProductCustomizationConfig | null {
  if (!Array.isArray(optionGroups) || optionGroups.length === 0) return null;
  const groups = [...optionGroups]
    .sort((a: any, b: any) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0))
    .map((group: any, groupIndex: number) => {
      const apiGroupId = parseNumericOptionId(group?.id);
      const options = Array.isArray(group?.options)
        ? [...group.options]
            .sort((a: any, b: any) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0))
            .map((opt: any, optionIndex: number) => {
              const apiOptionId = resolveShopOptionApiId(opt);
              return {
                id: resolveUiOptionId(opt, groupIndex, optionIndex, apiOptionId),
                apiOptionId: apiOptionId ?? undefined,
                label: String(opt?.label ?? ''),
                subtitle: typeof opt?.subtitle === 'string' ? opt.subtitle : '',
                priceDelta: Number(opt?.price_modifier ?? 0),
                imageUrl: typeof opt?.image_url === 'string' ? opt.image_url : '',
              };
            })
            .filter((opt) => opt.label.trim() !== '')
        : [];
      return {
        id: apiGroupId != null ? String(apiGroupId) : `group_${groupIndex}`,
        apiGroupId: apiGroupId ?? undefined,
        title: String(group?.name ?? ''),
        subtitle: typeof group?.subtitle === 'string' ? group.subtitle : '',
        required: Boolean(group?.is_required),
        selectionMode: group?.input_type === 'multiple' ? ('multiple' as const) : ('single' as const),
        options,
      };
    })
    .filter((g) => g.options.length > 0);
  return groups.length ? { groups } : null;
}

/** @deprecated Alias for older bundles — use mapShopApiOptionGroupsToCustomization */
export const mapApiOptionGroupsToCustomization = mapShopApiOptionGroupsToCustomization;

/** Flatten UI selections into numeric product option IDs for shop APIs (group order). */
export function selectedOptionsToIds(
  selectedOptions: Record<string, string[]>,
  customization?: ProductCustomizationConfig | null
): number[] {
  if (customization?.groups?.length) {
    const ids: number[] = [];
    customization.groups.forEach((group) => {
      const chosen = selectedOptions[group.id] ?? [];
      chosen.forEach((uiId) => {
        const apiId = resolveApiIdFromUiSelection(group, uiId);
        if (apiId != null) ids.push(apiId);
      });
    });
    return ids;
  }

  const ids = new Set<number>();
  Object.values(selectedOptions).forEach((optionIds) => {
    optionIds.forEach((id) => {
      const direct = parseNumericOptionId(id);
      if (direct != null) ids.add(direct);
      else {
        const match = /^opt_(\d+)$/.exec(id);
        if (match) {
          const fromKey = parseNumericOptionId(match[1]);
          if (fromKey != null) ids.add(fromKey);
        }
      }
    });
  });
  return Array.from(ids);
}

/** Ensure every required group has a valid API option id before cart/checkout calls. */
export function validateSelectedOptionsForCartApi(
  customization: ProductCustomizationConfig | null,
  selectedOptions: Record<string, string[]>
): { valid: boolean; missingGroupTitle?: string } {
  if (!customization?.groups?.length) return { valid: true };

  const requiredGroups = customization.groups.filter((g) => g.required);
  for (const group of requiredGroups) {
    const chosen = selectedOptions[group.id] ?? [];
    if (chosen.length === 0) {
      return { valid: false, missingGroupTitle: group.title };
    }
    if (group.selectionMode === 'single' && chosen.length !== 1) {
      return { valid: false, missingGroupTitle: group.title };
    }
    const hasApiId = chosen.some((uiId) => resolveApiIdFromUiSelection(group, uiId) != null);
    if (!hasApiId) {
      return { valid: false, missingGroupTitle: group.title };
    }
  }

  const requiredIds = requiredGroups.flatMap((group) => {
    const chosen = selectedOptions[group.id] ?? [];
    return chosen
      .map((uiId) => resolveApiIdFromUiSelection(group, uiId))
      .filter((id): id is number => id != null);
  });

  if (requiredGroups.length > 0 && requiredIds.length < requiredGroups.length) {
    const missing = requiredGroups.find((group) => {
      const chosen = selectedOptions[group.id] ?? [];
      return !chosen.some((uiId) => resolveApiIdFromUiSelection(group, uiId) != null);
    });
    return { valid: false, missingGroupTitle: missing?.title };
  }

  return { valid: true };
}

export function productRequiresOptionSelection(product: {
  product_type?: string | null;
  option_groups?: unknown;
}): boolean {
  if (product.product_type === 'variable') return true;
  if (!Array.isArray(product.option_groups) || product.option_groups.length === 0) return false;
  return product.option_groups.some(
    (group: any) =>
      Boolean(group?.is_required) && Array.isArray(group?.options) && group.options.length > 0
  );
}

export function validateRequiredProductOptions(
  customization: ProductCustomizationConfig | null,
  selectedOptions: Record<string, string[]>
): { valid: boolean; missingGroupTitle?: string } {
  if (!customization?.groups?.length) return { valid: true };
  for (const group of customization.groups) {
    if (!group.required) continue;
    const chosen = selectedOptions[group.id] ?? [];
    if (chosen.length === 0) {
      return { valid: false, missingGroupTitle: group.title };
    }
  }
  return { valid: true };
}
