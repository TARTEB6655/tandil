export type ContractorMetaItem = {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  /** Links subcategory → main category, service → subcategory, city → emirate */
  parent_slug?: string;
  sort_order?: number;
};

export type ContractorMetaInput = {
  name: string;
  slug?: string;
  is_active?: boolean;
  parent_slug?: string;
  sort_order?: number;
};

export type ContractorMetaEntity =
  | 'main_categories'
  | 'subcategories'
  | 'services'
  | 'emirates'
  | 'cities'
  | 'coverage_areas';

export type ContractorRegistrationStore = {
  registration_enabled: boolean;
  main_categories: ContractorMetaItem[];
  subcategories: ContractorMetaItem[];
  services: ContractorMetaItem[];
  emirates: ContractorMetaItem[];
  cities: ContractorMetaItem[];
  coverage_areas: ContractorMetaItem[];
};

export type ContractorSignupOptionRow = {
  id: number;
  name: string;
  slug: string;
  parent_id?: number;
  parent_slug?: string;
};

export type ContractorSignupOptions = {
  registration_enabled: boolean;
  main_categories: ContractorSignupOptionRow[];
  subcategories: ContractorSignupOptionRow[];
  services: ContractorSignupOptionRow[];
  emirates: ContractorSignupOptionRow[];
  cities: ContractorSignupOptionRow[];
  coverage_areas: ContractorSignupOptionRow[];
};
