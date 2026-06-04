import type { ProductCustomizationConfig, ProductOptionGroup } from '../types/productCustomization';

export type OptionImageUpload = { key: string; uri: string };

/** True when URI is a new local pick (not an existing remote image_url from GET). */
export function isLocalImageUri(uri: string): boolean {
  const u = uri.trim();
  if (!u) return false;
  if (u.startsWith('http://') || u.startsWith('https://')) return false;
  return (
    u.startsWith('file://') ||
    u.startsWith('content://') ||
    u.startsWith('ph://') ||
    u.startsWith('assets-library://')
  );
}

export function hasLocalOptionImageUploads(customization?: ProductCustomizationConfig | null): boolean {
  if (!customization?.groups?.length) return false;
  return customization.groups.some((group) =>
    (group.options ?? []).some((opt) => isLocalImageUri(opt.imageUrl ?? ''))
  );
}

/** Resolve stable temp_key for option_groups_json and option_images[field]. */
export function resolveOptionTempKey(
  opt: { temp_key?: string | null; id?: number | string | null },
  groupIndex: number,
  optionIndex: number
): string {
  const fromApi = opt.temp_key != null ? String(opt.temp_key).trim() : '';
  if (fromApi) return fromApi;
  const numericId =
    opt.id != null && String(opt.id).trim() !== '' && Number.isFinite(Number(opt.id))
      ? Number(opt.id)
      : null;
  if (numericId != null) return `opt_${numericId}`;
  return `opt_${groupIndex}_${optionIndex}`;
}

function parseNumericId(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Map GET /admin/products/:id option_groups → builder state. */
export function mapAdminApiOptionGroupsToCustomization(
  optionGroups: unknown
): ProductCustomizationConfig | null {
  if (!Array.isArray(optionGroups) || optionGroups.length === 0) return null;
  return {
    groups: optionGroups.map((group: any, groupIndex: number) => {
      const apiGroupId = parseNumericId(group?.id);
      return {
        id: apiGroupId != null ? String(apiGroupId) : `group_${groupIndex}`,
        apiGroupId,
        title: String(group?.name ?? ''),
        subtitle: typeof group?.subtitle === 'string' ? group.subtitle : '',
        required: Boolean(group?.is_required),
        selectionMode: group?.input_type === 'multiple' ? 'multiple' : 'single',
        options: Array.isArray(group?.options)
          ? group.options.map((opt: any, optionIndex: number) => {
              const apiOptionId = parseNumericId(opt?.id);
              const tempKey = resolveOptionTempKey(opt, groupIndex, optionIndex);
              return {
                id: tempKey,
                apiOptionId,
                label: String(opt?.label ?? ''),
                subtitle: typeof opt?.subtitle === 'string' ? opt.subtitle : '',
                priceDelta: Number(opt?.price_modifier ?? 0),
                imageUrl:
                  typeof opt?.image_url === 'string' && opt.image_url.trim()
                    ? opt.image_url.trim()
                    : '',
              };
            })
          : [],
      };
    }),
  };
}

/** Map builder state → option_groups_json + option image uploads for create/update APIs. */
export function mapCustomizationConfigToApiPayload(
  customization?: ProductCustomizationConfig | null
): {
  productType?: 'variable';
  optionGroupsJson?: string;
  optionImageFiles: OptionImageUpload[];
} {
  const groups = customization?.groups ?? [];
  if (groups.length === 0) return { optionImageFiles: [] };

  const optionImageFiles: OptionImageUpload[] = [];
  const apiGroups = groups.map((group: ProductOptionGroup, groupIndex: number) => {
    const apiOptions = (group.options ?? []).map((option, optionIndex) => {
      const tempKey =
        option.id?.trim() ||
        (option.apiOptionId != null ? `opt_${option.apiOptionId}` : '') ||
        resolveOptionTempKey({}, groupIndex, optionIndex);

      const rawImage = typeof option.imageUrl === 'string' ? option.imageUrl.trim() : '';
      if (rawImage && isLocalImageUri(rawImage)) {
        optionImageFiles.push({ key: tempKey, uri: rawImage });
      }

      return {
        ...(option.apiOptionId != null ? { id: option.apiOptionId } : {}),
        temp_key: tempKey,
        label: option.label ?? '',
        subtitle: option.subtitle ?? '',
        price_modifier: Number(option.priceDelta ?? 0),
        sort_order: optionIndex,
      };
    });

    return {
      ...(group.apiGroupId != null ? { id: group.apiGroupId } : {}),
      name: group.title ?? '',
      subtitle: group.subtitle ?? '',
      input_type: group.selectionMode === 'multiple' ? 'multiple' : 'single',
      is_required: Boolean(group.required),
      sort_order: groupIndex,
      options: apiOptions,
    };
  });

  return {
    productType: 'variable',
    optionGroupsJson: JSON.stringify(apiGroups),
    optionImageFiles,
  };
}
