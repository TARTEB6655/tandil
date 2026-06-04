export type ProductOptionSelectionMode = 'single' | 'multiple';

export interface ProductOptionItem {
  /** temp_key for API (e.g. opt_434); used in option_groups_json and option_images[field]. */
  id: string;
  /** Database option id from GET /admin/products/:id — sent on update when present. */
  apiOptionId?: number;
  label: string;
  subtitle?: string;
  priceDelta: number;
  imageUrl?: string;
}

export interface ProductOptionGroup {
  id: string;
  /** Database group id from GET /admin/products/:id — sent on update when present. */
  apiGroupId?: number;
  title: string;
  subtitle?: string;
  required: boolean;
  selectionMode: ProductOptionSelectionMode;
  options: ProductOptionItem[];
}

export interface ProductCustomizationConfig {
  groups: ProductOptionGroup[];
}
