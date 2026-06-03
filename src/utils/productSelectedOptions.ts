import type { ProductCustomizationConfig } from '../types/productCustomization';

/** Flatten UI selections into numeric product option IDs for shop APIs. */
export function selectedOptionsToIds(selectedOptions: Record<string, string[]>): number[] {
  const ids = new Set<number>();
  Object.values(selectedOptions).forEach((optionIds) => {
    optionIds.forEach((id) => {
      const n = Number(id);
      if (Number.isFinite(n) && n > 0) ids.add(n);
    });
  });
  return Array.from(ids);
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
