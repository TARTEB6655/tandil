import type { LoginApiRole } from './authTypes';
import type { ForgotPasswordRole } from './forgotPasswordTypes';

/**
 * POST /auth/forgot-password and POST /auth/verify-otp use the same `roles`
 * string as POST /auth/login (only this value changes per portal).
 */
export const FORGOT_PASSWORD_API_ROLES: readonly ForgotPasswordRole[] = [
  'client',
  'admin',
  'hr',
  'area_manager',
  'supervisor',
  'technician',
  'vendor',
  'delivery',
] as const;

/** Portal opened from login → API `roles` field (must match login request). */
export const LOGIN_PORTAL_TO_API_ROLES: Record<
  | 'user'
  | 'admin'
  | 'hrManager'
  | 'areaManager'
  | 'supervisor'
  | 'technician'
  | 'vendor'
  | 'delivery',
  ForgotPasswordRole
> = {
  user: 'client',
  admin: 'admin',
  hrManager: 'hr',
  areaManager: 'area_manager',
  supervisor: 'supervisor',
  technician: 'technician',
  vendor: 'vendor',
  delivery: 'delivery',
};

export function toForgotPasswordApiRoles(role: ForgotPasswordRole): LoginApiRole | 'delivery' {
  return role;
}

export function isForgotPasswordApiRole(value: string): value is ForgotPasswordRole {
  return (FORGOT_PASSWORD_API_ROLES as readonly string[]).includes(value);
}
