export type ContractorSignupStatus =
  | 'pending'
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'rejected';

export type ContractorSignupStatusFilter = ContractorSignupStatus | 'all';

export interface ContractorSignupPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
  company_name: string;
  trade_license_number: string;
  trade_license_expiry_date: string;
  trn?: string;
  company_emirate: string;
  city: string;
  company_address: string;
  bank_name: string;
  account_holder_name: string;
  bank_account_number: string;
  iban: string;
  main_service_categories: string[];
  service_subcategories: string[];
  selected_services: string[];
  coverage_emirates: string[];
  coverage_cities: string[];
  service_coverage_areas: string[];
  trade_license_file_name?: string;
  vat_certificate_file_name?: string;
  bank_confirmation_file_name?: string;
  trade_license_file_url?: string;
  vat_certificate_file_url?: string;
  bank_confirmation_file_url?: string;
}

export interface ContractorSignupRequest extends ContractorSignupPayload {
  id: string;
  status: ContractorSignupStatus;
  status_label?: string;
  rejection_reason?: string | null;
  missing_documents_reason?: string | null;
  created_at: string;
  updated_at?: string;
}
