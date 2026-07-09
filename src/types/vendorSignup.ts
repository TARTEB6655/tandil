export type VendorSignupStatus = 'pending' | 'approved' | 'rejected';

export type VendorSignupStatusFilter = VendorSignupStatus | 'all';

export interface VendorSignupRequest {
  id: number | string;
  vendor_id?: number | string;
  company_name: string;
  authorized_person_name: string;
  email: string;
  phone: string;
  vendor_type: string;
  vendor_type_label?: string;
  emirate: string;
  city?: string;
  address?: string;
  trade_license_number?: string;
  vat_number?: string;
  bank_name?: string;
  iban?: string;
  account_holder_name?: string;
  delivery_radius_km?: number;
  minimum_order_amount?: number;
  opens_at?: string;
  closes_at?: string;
  operating_hours?: string;
  google_maps_location?: string;
  logo_url?: string;
  trade_license_url?: string;
  emirates_id_url?: string;
  description?: string;
  categories?: Array<{ id: number; name: string }>;
  completion_percent?: number;
  submitted_at_formatted?: string;
  status: VendorSignupStatus;
  status_label?: string;
  created_at: string;
  updated_at?: string;
}
