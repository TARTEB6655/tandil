import apiClient from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
  role: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    role: string;
    user: {
      id: number;
      name: string;
      email: string;
      phone: string;
      role: string;
      status: string;
      email_verified_at: string | null;
      created_at: string;
      updated_at: string;
    };
  };
}

// Map Laravel user response to app User type
const mapLaravelUserToAppUser = (laravelUser: LoginResponse['data']['user']): User => {
  return {
    id: laravelUser.id.toString(),
    name: laravelUser.name,
    email: laravelUser.email,
    phone: laravelUser.phone,
    avatar: undefined,
    loyaltyPoints: 0, // Default value, update if API provides this
    address: {
      id: 'default',
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'UAE',
    },
    preferences: {
      language: 'en',
      theme: 'light',
      notifications: true,
    },
  };
};

export const authService = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
      const responseData = response.data;
      
      console.log('Login API Response:', responseData);
      
      // Extract token, role, and user from response.data.data
      const token = responseData.data?.token;
      const role = responseData.data?.role;
      const userData = responseData.data?.user;
      
      // Store token, role, and user
      if (token) {
        await AsyncStorage.setItem('auth_token', token);
        if (role) {
          await AsyncStorage.setItem('auth_role', role);
        }
        if (userData) {
          const appUser = mapLaravelUserToAppUser(userData);
          await AsyncStorage.setItem('user', JSON.stringify(appUser));
        }
      }

      // Return response in expected format for backward compatibility
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
      
      // Extract token, role, and user from response.data.data
      const token = responseData.data?.token;
      const userData = responseData.data?.user;
      
      // Store token and user
      if (token) {
        await AsyncStorage.setItem('auth_token', token);
        if (userData) {
          const appUser = mapLaravelUserToAppUser(userData);
          await AsyncStorage.setItem('user', JSON.stringify(appUser));
        }
      }
      
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
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('auth_role');
      await AsyncStorage.removeItem('user');
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
};

