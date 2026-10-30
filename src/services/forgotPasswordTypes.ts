import type { LoginApiRole } from './authTypes';

/** Roles that can use forgot-password (includes delivery portal UI). */
export type ForgotPasswordRole = LoginApiRole | 'delivery';

export const FORGOT_PASSWORD_OTP_LENGTH = 6;
export const FORGOT_PASSWORD_RESEND_SECONDS = 60;
export const FORGOT_PASSWORD_MIN_PASSWORD_LENGTH = 6;

export interface RequestForgotPasswordOtpBody {
  phone: string;
  role: ForgotPasswordRole;
}

export interface RequestForgotPasswordOtpResponse {
  success?: boolean;
  message?: string;
  data?: {
    masked_phone?: string;
    resend_after_seconds?: number;
  };
}

/** POST /auth/verify-otp — `role` is sent as JSON field `roles` (same as login). */
export interface VerifyForgotPasswordOtpBody {
  phone: string;
  role: ForgotPasswordRole;
  otp: string;
}

export interface VerifyForgotPasswordOtpResponse {
  success?: boolean;
  message?: string;
  data?: {
    reset_token?: string;
    expires_in_seconds?: number;
  };
}

/** POST /auth/reset-password — token from verify-otp; same endpoint for every portal. */
export interface ResetPasswordWithTokenBody {
  /** Value from POST /auth/verify-otp → `data.reset_token` */
  reset_token: string;
  password: string;
  password_confirmation: string;
}

export interface ResetPasswordWithTokenResponse {
  success?: boolean;
  message?: string;
}
