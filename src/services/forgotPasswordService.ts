/**
 * Forgot password API (public, no Bearer token).
 * All portals: POST /auth/forgot-password { phone, roles } — only `roles` changes.
 */
import { publicApiClient } from './api';
import type { ForgotPasswordRole } from './forgotPasswordTypes';
import type {
  RequestForgotPasswordOtpBody,
  RequestForgotPasswordOtpResponse,
  ResetPasswordWithTokenBody,
  ResetPasswordWithTokenResponse,
  VerifyForgotPasswordOtpBody,
  VerifyForgotPasswordOtpResponse,
} from './forgotPasswordTypes';
import { toForgotPasswordApiRoles } from './forgotPasswordApiRoles';
import { normalizePhoneForApi } from '../utils/phoneValidation';

function extractMessage(err: unknown, fallback: string): string {
  const axiosErr = err as {
    response?: { data?: Record<string, unknown> };
    message?: string;
  };
  const data = axiosErr.response?.data;
  if (data && typeof data === 'object') {
    const message = data.message;
    if (typeof message === 'string' && message.trim()) return message.trim();
    const error = data.error;
    if (typeof error === 'string' && error.trim()) return error.trim();
    const errors = data.errors;
    if (errors && typeof errors === 'object') {
      for (const value of Object.values(errors as Record<string, unknown>)) {
        if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
        if (typeof value === 'string') return value;
      }
    }
  }
  return axiosErr.message || fallback;
}

function pickRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  return data as Record<string, unknown>;
}

function pickString(obj: Record<string, unknown> | null, ...keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function pickNumber(obj: Record<string, unknown> | null, ...keys: string[]): number | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

function parseRequestOtpResponse(raw: unknown): RequestForgotPasswordOtpResponse {
  const root = pickRecord(raw) ?? {};
  const payload = pickRecord(root.data) ?? root;
  return {
    success: root.success !== false,
    message: pickString(root, 'message'),
    data: {
      masked_phone:
        pickString(payload, 'masked_phone', 'maskedPhone', 'phone_masked') ??
        pickString(root, 'masked_phone'),
      resend_after_seconds:
        pickNumber(payload, 'resend_after_seconds', 'resendAfterSeconds', 'cooldown_seconds') ??
        pickNumber(root, 'resend_after_seconds'),
    },
  };
}

function parseVerifyOtpResponse(raw: unknown): VerifyForgotPasswordOtpResponse {
  const root = pickRecord(raw) ?? {};
  const dataOuter = pickRecord(root.data);
  const payload = pickRecord(dataOuter?.data) ?? dataOuter ?? root;
  const resetToken =
    pickString(payload, 'reset_token', 'resetToken', 'token', 'password_reset_token') ??
    pickString(dataOuter, 'reset_token', 'resetToken', 'token') ??
    pickString(root, 'reset_token', 'resetToken', 'token');
  return {
    success: root.success !== false,
    message: pickString(root, 'message') ?? pickString(dataOuter, 'message'),
    data: {
      reset_token: resetToken,
      expires_in_seconds:
        pickNumber(payload, 'expires_in_seconds', 'expiresInSeconds', 'expires_in') ??
        pickNumber(dataOuter, 'expires_in_seconds', 'expiresInSeconds') ??
        pickNumber(root, 'expires_in_seconds'),
    },
  };
}

/** Shared body prefix: normalized phone + login `roles` for this portal. */
function withPhoneAndRoles(
  role: ForgotPasswordRole,
  phone: string,
  extra: Record<string, unknown>
): Record<string, unknown> {
  return {
    phone: normalizePhoneForApi(phone),
    roles: toForgotPasswordApiRoles(role),
    ...extra,
  };
}

export const forgotPasswordService = {
  /** POST /auth/forgot-password */
  requestOtp: async (body: RequestForgotPasswordOtpBody): Promise<RequestForgotPasswordOtpResponse> => {
    try {
      const response = await publicApiClient.post<unknown>(
        '/auth/forgot-password',
        withPhoneAndRoles(body.role, body.phone, {}),
        { timeout: 20000 }
      );
      const parsed = parseRequestOtpResponse(response.data);
      if (parsed.success === false) {
        throw new Error(parsed.message || 'Could not send verification code.');
      }
      return parsed;
    } catch (err) {
      if (err instanceof Error && !(err as { response?: unknown }).response) throw err;
      throw new Error(extractMessage(err, 'Could not send verification code.'));
    }
  },

  /**
   * POST /auth/verify-otp
   * Body (all portals — only `roles` changes): { phone, roles, otp }
   * Example client: { phone: "+971...", roles: "client", otp: "123456" }
   */
  verifyOtp: async (body: VerifyForgotPasswordOtpBody): Promise<VerifyForgotPasswordOtpResponse> => {
    const otp = body.otp.replace(/\D/g, '').trim();
    try {
      const response = await publicApiClient.post<unknown>(
        '/auth/verify-otp',
        withPhoneAndRoles(body.role, body.phone, { otp }),
        { timeout: 20000 }
      );
      const parsed = parseVerifyOtpResponse(response.data);
      if (parsed.success === false) {
        throw new Error(parsed.message || 'Invalid verification code.');
      }
      if (!parsed.data?.reset_token) {
        throw new Error(parsed.message || 'Verification succeeded but no reset token was returned.');
      }
      return parsed;
    } catch (err) {
      if (err instanceof Error && !(err as { response?: unknown }).response) throw err;
      throw new Error(extractMessage(err, 'Verification failed.'));
    }
  },

  /**
   * POST /auth/reset-password (step 3 — all portals, same URL/body shape)
   * Body: { reset_token, password, password_confirmation }
   * `reset_token` must come from verify-otp for the same portal (roles sent in step 2).
   */
  resetPassword: async (body: ResetPasswordWithTokenBody): Promise<ResetPasswordWithTokenResponse> => {
    const resetToken = body.reset_token.trim();
    if (!resetToken) {
      throw new Error('Missing password reset token. Please verify your code again.');
    }
    const payload = {
      reset_token: resetToken,
      password: body.password,
      password_confirmation: body.password_confirmation,
    };
    try {
      const response = await publicApiClient.post<unknown>('/auth/reset-password', payload, {
        timeout: 20000,
      });
      const root = pickRecord(response.data) ?? {};
      const dataInner = pickRecord(root.data);
      const parsed: ResetPasswordWithTokenResponse = {
        success: root.success !== false,
        message:
          pickString(root, 'message') ??
          pickString(dataInner, 'message') ??
          pickString(root, 'msg'),
      };
      if (parsed.success === false) {
        throw new Error(parsed.message || 'Could not reset password.');
      }
      return parsed;
    } catch (err) {
      if (err instanceof Error && !(err as { response?: unknown }).response) throw err;
      throw new Error(extractMessage(err, 'Could not reset password.'));
    }
  },
};
