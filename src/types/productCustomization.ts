export type ProductOptionSelectionMode = 'single' | 'multiple';

export interface ProductOptionItem {
  id: string;
  label: string;
  subtitle?: string;
  priceDelta: number;
  imageUrl?: string;
}

export interface ProductOptionGroup {
  id: string;
  title: string;
  subtitle?: string;
  required: boolean;
  selectionMode: ProductOptionSelectionMode;
  options: ProductOptionItem[];
}

export interface ProductCustomizationConfig {
  groups: ProductOptionGroup[];
}
