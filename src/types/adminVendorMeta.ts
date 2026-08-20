export type AdminVendorMetaItem = {
  id: number;
  name: string;
  slug?: string;
  is_active: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
};

export type AdminVendorMetaInput = {
  name: string;
  slug?: string;
  is_active?: boolean;
  sort_order?: number;
};

export type VendorSignupOption = {
  id?: number;
  name: string;
  slug: string;
};
