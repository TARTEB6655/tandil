import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { publicApiClient } from './api';
import type { LoginResponse, LoginCredentials, RegisterData } from './authTypes';
import { decodeJwtPayload, readJwtString } from '../utils/jwtPayload';

export type SocialProvider = 'apple' | 'google';

const SOCIAL_EMAIL_PREFIX = 'social_email_';
const SOCIAL_PASSWORD_SALT = 'tandil_social_auth_v1';

function isSocialRouteMissing(error: unknown): boolean {
  const e = error as { response?: { status?: number; data?: { message?: string } } };
  const msg = String(e?.response?.data?.message || '');
  return e?.response?.status === 404 || /route.*could not be found/i.test(msg);
}

async function getOrCreateSocialPassword(provider: SocialProvider, subjectId: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${SOCIAL_PASSWORD_SALT}:${provider}:${subjectId}`
  );
  return `Td1!${digest.slice(0, 20)}Aa`;
}

/** UAE-style mobile unique per social account (backend rejects duplicate phones). */
function deriveSocialPhone(provider: SocialProvider, subjectId: string): string {
  let hash = 0;
  const seed = `${provider}:${subjectId}`;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const eightDigits = String(hash % 100000000).padStart(8, '0');
  return `05${eightDigits}`;
}

function formatApiError(error: unknown, fallback: string): string {
  const e = error as {
    response?: {
      data?: {
        message?: string;
        errors?: Record<string, string[]>;
      };
    };
  };
  const errors = e?.response?.data?.errors;
  if (errors && typeof errors === 'object') {
    const parts = Object.entries(errors).flatMap(([field, msgs]) =>
      (msgs || []).map((m) => `${field}: ${m}`)
    );
    if (parts.length > 0) return parts.join('\n');
  }
  return e?.response?.data?.message || fallback;
}

async function rememberSocialEmail(provider: SocialProvider, subjectId: string, email: string): Promise<void> {
  await AsyncStorage.setItem(`${SOCIAL_EMAIL_PREFIX}${provider}_${subjectId}`, email.trim());
}

async function recallSocialEmail(provider: SocialProvider, subjectId: string): Promise<string> {
  return (await AsyncStorage.getItem(`${SOCIAL_EMAIL_PREFIX}${provider}_${subjectId}`)) || '';
}

function syntheticEmail(provider: SocialProvider, subjectId: string): string {
  const safe = subjectId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
  return `${safe || 'user'}@${provider}.tandil.app`;
}

export async function resolveSocialIdentity(params: {
  provider: SocialProvider;
  idToken: string;
  email?: string | null;
  name?: string | null;
}): Promise<{ subjectId: string; email: string; name: string }> {
  const payload = decodeJwtPayload(params.idToken);
  const subjectId =
    readJwtString(payload, 'sub') || readJwtString(payload, 'user_id') || params.idToken.slice(0, 32);

  let email =
    (params.email && params.email.trim()) ||
    readJwtString(payload, 'email') ||
    (await recallSocialEmail(params.provider, subjectId));

  if (!email) {
    email = syntheticEmail(params.provider, subjectId);
  } else {
    await rememberSocialEmail(params.provider, subjectId, email);
  }

  const name =
    (params.name && params.name.trim()) ||
    readJwtString(payload, 'name') ||
    readJwtString(payload, 'given_name') ||
    'Tandil User';

  return { subjectId, email: email.trim().toLowerCase(), name };
}

async function postLogin(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await publicApiClient.post<LoginResponse>('/auth/login', {
    email: credentials.email.trim(),
    password: credentials.password,
    roles: credentials.roles,
  });
  return response.data;
}

async function postRegister(data: RegisterData): Promise<LoginResponse> {
  const response = await publicApiClient.post<LoginResponse>('/auth/register', data);
  return response.data;
}

function isEmailTakenError(error: unknown): boolean {
  const e = error as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } } };
  const msg = JSON.stringify(e?.response?.data || {}).toLowerCase();
  return (
    e?.response?.status === 422 &&
    (msg.includes('email') && (msg.includes('taken') || msg.includes('already') || msg.includes('exists')))
  );
}

/**
 * When /auth/apple or /auth/google is missing, sign in via existing register + login APIs.
 */
export async function loginWithSocialViaStandardAuth(params: {
  provider: SocialProvider;
  idToken: string;
  email?: string | null;
  name?: string | null;
}): Promise<LoginResponse> {
  const { subjectId, email, name } = await resolveSocialIdentity(params);
  const password = await getOrCreateSocialPassword(params.provider, subjectId);
  const credentials: LoginCredentials = { email, password, roles: 'client' };

  try {
    return await postLogin(credentials);
  } catch (loginErr: unknown) {
    const registerPayload: RegisterData = {
      name,
      email,
      phone: deriveSocialPhone(params.provider, subjectId),
      password,
      password_confirmation: password,
      role: 'client',
    };

    try {
      return await postRegister(registerPayload);
    } catch (registerErr: unknown) {
      if (isEmailTakenError(registerErr)) {
        try {
          return await postLogin(credentials);
        } catch (retryErr: unknown) {
          throw new Error(
            formatApiError(
              retryErr,
              'This email is already registered with a password. Please sign in with email and password.'
            )
          );
        }
      }
      throw new Error(
        formatApiError(registerErr, 'Could not create account for social sign-in.')
      );
    }
  }
}

export async function loginWithDedicatedOrFallback(
  provider: SocialProvider,
  dedicated: () => Promise<LoginResponse>,
  fallbackParams: {
    idToken: string;
    email?: string | null;
    name?: string | null;
  }
): Promise<LoginResponse> {
  try {
    return await dedicated();
  } catch (error: unknown) {
    if (!isSocialRouteMissing(error)) {
      throw error;
    }
    return loginWithSocialViaStandardAuth({
      provider,
      ...fallbackParams,
    });
  }
}
