import apiClient, { publicApiClient } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { loginWithDedicatedOrFallback } from './socialAuthBridge';
import type {
  LoginApiRole,
  LoginCredentials,
  LoginResponse,
  LoginResponseUser,
  RegisterData,
} from './authTypes';

export type {
  LoginApiRole,
  LoginCredentials,
  LoginResponse,
  LoginResponseRole,
  LoginResponseUser,
  RegisterData,
} from './authTypes';

/** POST /auth/google — matches backend Postman collection */
export interface GoogleSignInRequest {
  id_token: string;
  roles: 'client';
}

/** POST /auth/apple — matches backend Postman collection */
export interface AppleSignInRequest {
  id_token: string;
  roles: 'client';
  name?: string;
  email?: string;
}

async function clearAuthStorage(): Promise<void> {
  await AsyncStorage.multiRemove(['auth_token', 'auth_role', 'auth_slug', 'user']);
}

const mapLaravelUserToAppUser = (laravelUser: LoginResponseUser): User => {
  const phone = laravelUser.phone != null ? String(laravelUser.phone) : '';
  const avatar =
    laravelUser.profile_picture_url != null && String(laravelUser.profile_picture_url).trim() !== ''
      ? String(laravelUser.profile_picture_url)
      : undefined;
  return {
    id: String(laravelUser.id),
    name: laravelUser.name,
    email: laravelUser.email,
    phone,
    avatar,
    loyaltyPoints: 0,
    address: {
      id: 'default',
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'UAE',
    },
    preferences: {
      language: (laravelUser.preferred_locale === 'ar' || laravelUser.preferred_locale === 'ur'
        ? laravelUser.preferred_locale
        : 'en') as User['preferences']['language'],
      theme: 'light',
      notifications: true,
    },
  };
};

function assertLoginSuccess(responseData: LoginResponse): void {
  if (!responseData?.success) {
    throw new Error(responseData?.message || 'Sign-in failed.');
  }
  if (!responseData.data?.token) {
    throw new Error(responseData?.message || 'Sign-in succeeded but no token was returned.');
  }
}

async function persistAuthPayload(responseData: LoginResponse): Promise<void> {
  assertLoginSuccess(responseData);
  const token = responseData.data.token;
  const role = responseData.data?.role;
  const slug = responseData.data?.slug;
  const userData = responseData.data?.user;
  await AsyncStorage.setItem('auth_token', token);
  if (role) {
    await AsyncStorage.setItem('auth_role', role);
  } else {
    await AsyncStorage.removeItem('auth_role');
  }
  if (slug != null && String(slug).trim() !== '') {
    await AsyncStorage.setItem('auth_slug', String(slug));
  } else {
    await AsyncStorage.removeItem('auth_slug');
  }
  if (userData) {
    const appUser = mapLaravelUserToAppUser(userData);
    await AsyncStorage.setItem('user', JSON.stringify(appUser));
  }
}

async function postGoogleSignIn(idToken: string): Promise<LoginResponse> {
  const body: GoogleSignInRequest = {
    id_token: idToken,
    roles: 'client',
  };
  const response = await publicApiClient.post<LoginResponse>('/auth/google', body);
  return response.data;
}

async function postAppleSignIn(params: {
  idToken: string;
  name?: string | null;
  email?: string | null;
}): Promise<LoginResponse> {
  const body: AppleSignInRequest = {
    id_token: params.idToken,
    roles: 'client',
  };
  if (params.name?.trim()) body.name = params.name.trim();
  if (params.email?.trim()) body.email = params.email.trim();
  const response = await publicApiClient.post<LoginResponse>('/auth/apple', body);
  return response.data;
}

export const authService = {
  clearLocalSession: clearAuthStorage,

  /** Google: POST /auth/google { id_token, roles: "client" } */
  loginWithGoogle: async (idToken: string): Promise<LoginResponse> => {
    try {
      const responseData = await loginWithDedicatedOrFallback(
        'google',
        () => postGoogleSignIn(idToken),
        { idToken }
      );
      await persistAuthPayload(responseData);
      return responseData;
    } catch (error: unknown) {
      console.error('Google login API Error:', error);
      throw error;
    }
  },

  /** Apple: POST /auth/apple { id_token, roles, name?, email? } */
  loginWithApple: async (params: {
    idToken: string;
    name?: string | null;
    email?: string | null;
  }): Promise<LoginResponse> => {
    try {
      const responseData = await loginWithDedicatedOrFallback(
        'apple',
        () => postAppleSignIn(params),
        {
          idToken: params.idToken,
          email: params.email,
          name: params.name,
        }
      );
      await persistAuthPayload(responseData);
      return responseData;
    } catch (error: unknown) {
      console.error('Apple login API Error:', error);
      throw error;
    }
  },

  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
      const body = {
        email: credentials.email.trim(),
        password: credentials.password,
        roles: credentials.roles,
      };
      const response = await publicApiClient.post<LoginResponse>('/auth/login', body);
      const responseData = response.data;
      await persistAuthPayload(responseData);
      return responseData;
    } catch (error: unknown) {
      console.error('Login API Error:', error);
      throw error;
    }
  },

  register: async (data: RegisterData): Promise<LoginResponse> => {
    try {
      const response = await apiClient.post<LoginResponse>('/auth/register', data);
      const responseData = response.data;
      await persistAuthPayload(responseData);
      return responseData;
    } catch (error: unknown) {
      console.error('Register API Error:', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await clearAuthStorage();
    }
  },

  /** POST /vendor/auth/logout — Bearer token (vendor portal). */
  vendorLogout: async () => {
    try {
      await apiClient.post('/vendor/auth/logout');
    } catch (error) {
      console.error('Vendor logout error:', error);
    } finally {
      await clearAuthStorage();
    }
  },

  /** POST /auth/delete-account — Bearer token only; no request body (matches backend Postman). */
  deleteAccount: async (): Promise<{ success: boolean; message?: string }> => {
    const response = await apiClient.request<{ success?: boolean; message?: string }>({
      method: 'POST',
      url: '/auth/delete-account',
      timeout: 30000,
    });
    const data = response.data;
    return {
      success: response.status >= 200 && response.status < 300 && data?.success !== false,
      message: data?.message,
    };
  },

  getStoredUser: async (): Promise<User | null> => {
    try {
      const userJson = await AsyncStorage.getItem('user');
      if (userJson) {
        return JSON.parse(userJson);
      }
      return null;
    } catch (error) {
      console.error('Error getting stored user:', error);
      return null;
    }
  },

  getStoredToken: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('auth_token');
    } catch (error) {
      console.error('Error getting stored token:', error);
      return null;
    }
  },

  getStoredRole: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('auth_role');
    } catch (error) {
      console.error('Error getting stored role:', error);
      return null;
    }
  },

  getStoredSlug: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('auth_slug');
    } catch (error) {
      console.error('Error getting stored slug:', error);
      return null;
    }
  },
};
