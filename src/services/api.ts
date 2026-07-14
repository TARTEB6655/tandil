import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';

// Create axios instance (adds Bearer token via interceptor)
const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers,
});

// Public API client - no auth token (for endpoints like GET /shop/products)
export const publicApiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers,
});

/** Ensure multipart FormData is not sent as application/json (breaks file uploads). */
function stripJsonContentTypeForFormData(config: {
  data?: unknown;
  headers?: { delete?: (key: string) => void; [key: string]: unknown };
}) {
  if (!(config.data instanceof FormData) || !config.headers) return config;
  if (typeof config.headers.delete === 'function') {
    config.headers.delete('Content-Type');
    config.headers.delete('content-type');
  } else {
    delete config.headers['Content-Type'];
    delete config.headers['content-type'];
  }
  return config;
}

// Request interceptor - Add auth token to all requests
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return stripJsonContentTypeForFormData(config as any);
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Public client also posts FormData (e.g. vendor signup) — strip JSON content-type
publicApiClient.interceptors.request.use(
  (config) => stripJsonContentTypeForFormData(config as any),
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor - Handle errors globally
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    // Handle 401 Unauthorized - Token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { invalidateClientSession } = await import('../utils/invalidateClientSession');
        await invalidateClientSession();
      } catch (e) {
        console.error('Error clearing session after 401:', e);
      }
    }

    // No HTTP response: offline, DNS failure, or request timeout (not a 401 — see block above)
    if (!error.response) {
      const isTimeout =
        error.code === 'ECONNABORTED' || /timeout/i.test(error.message ?? '');
      if (__DEV__ && !isTimeout) {
        console.warn('Network Error:', error.message);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

