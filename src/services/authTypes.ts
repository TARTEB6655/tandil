/** Role sent with POST /auth/login (must match backend). */
export type LoginApiRole =
  | 'client'
  | 'admin'
  | 'hr'
  | 'area_manager'
  | 'supervisor'
  | 'technician'
  | 'vendor';

export interface LoginCredentials {
  email: string;
  password: string;
  roles: LoginApiRole;
}

export interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
  role: string;
}

export interface LoginResponseRole {
  id: number;
  name: string;
  description?: string;
  guard_name?: string;
  created_at?: string;
  updated_at?: string;
  pivot?: {
    model_type: string;
    model_id: number;
    role_id: number;
  };
}

export interface LoginResponseUser {
  id: number;
  name: string;
  email: string;
  extra_emails?: string | null;
  phone?: string | null;
  extra_phones?: string | null;
  profile_picture?: string | null;
  role: string;
  preferred_locale?: string;
  status: string;
  wallet_balance?: string | number | null;
  wallet_forfeited_total?: string | number | null;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  profile_picture_url?: string | null;
  roles?: LoginResponseRole[];
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    role: string;
    slug?: string;
    user: LoginResponseUser;
  };
}
