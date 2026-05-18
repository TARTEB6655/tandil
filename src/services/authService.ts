import apiClient from './api';
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

async function clearAuthStorage(): Promise<void> {
  await AsyncStorage.multiRemove(['auth_token', 'auth_role', 'auth_slug', 'user']);
}

// Map Laravel user response to app User type
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

async function persistAuthPayload(responseData: LoginResponse): Promise<void> {
  const token = responseData.data?.token;
  const role = responseData.data?.role;
  const slug = responseData.data?.slug;
  const userData = responseData.data?.user;
  if (token) {
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
}

export const authService = {
  /** Clears local token/user without calling the logout API (e.g. wrong portal after login). */
  clearLocalSession: clearAuthStorage,

  /** Google sign-in: tries POST /auth/google, then register/login fallback if route missing. */
  loginWithGoogle: async (idToken: string): Promise<LoginResponse> => {
    try {
      const responseData = await loginWithDedicatedOrFallback(
        'google',
        async () => {
          const response = await apiClient.post<LoginResponse>('/auth/google', {
            id_token: idToken,
            roles: 'client',
          });
          return response.data;
        },
        { idToken }
      );
      await persistAuthPayload(responseData);
      return responseData;
    } catch (error: unknown) {
      console.error('Google login API Error:', error);
      throw error;
    }
  },

  /** Apple sign-in: tries POST /auth/apple, then register/login fallback if route missing. */
  loginWithApple: async (params: {
    idToken: string;
    name?: string | null;
    email?: string | null;
  }): Promise<LoginResponse> => {
    try {
      const responseData = await loginWithDedicatedOrFallback(
        'apple',
        async () => {
          const response = await apiClient.post<LoginResponse>('/auth/apple', {
            id_token: params.idToken,
            roles: 'client',
            ...(params.name?.trim() ? { name: params.name.trim() } : {}),
            ...(params.email?.trim() ? { email: params.email.trim() } : {}),
          });
          return response.data;
        },
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
      const response = await apiClient.post<LoginResponse>('/auth/login', body);
      const responseData = response.data;

      console.log('Login API Response:', responseData);

      await persistAuthPayload(responseData);

      return responseData;
    } catch (error: any) {
      console.error('Login API Error:', error);
      console.error('Error Response:', error.response?.data);
      console.error('Error Status:', error.response?.status);
      throw error;
    }
  },

  register: async (data: RegisterData): Promise<LoginResponse> => {
    try {
      const response = await apiClient.post<LoginResponse>('/auth/register', data);
      const responseData = response.data;

      console.log('Register API Response:', responseData);

      await persistAuthPayload(responseData);

      return responseData;
    } catch (error: any) {
      console.error('Register API Error:', error);
      console.error('Error Response:', error.response?.data);
      console.error('Error Status:', error.response?.status);
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

