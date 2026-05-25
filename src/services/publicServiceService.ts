/**
 * Public services API (no auth).
 * GET /api/services?per_page=12 - list services for user dashboard.
 */
import { publicApiClient } from './api';

export interface PublicService {
  id: number;
  name: string;
  slug?: string;
  description?: string | null;
  image?: string | null;
  image_url?: string | null;
  icon?: string | null;
  is_active?: boolean;
  products_count?: number;
}

export interface PublicServicesResponse {
  data?: PublicService[];
  success?: boolean;
  message?: string;
  pagination?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

/** Product returned by GET /services/:service_id/products or GET /services/products */
export interface PublicServiceProduct {
  id: number;
  name: string;
  description?: string | null;
  price?: string | number;
  currency?: string;
  image?: string | null;
  image_url?: string | null;
  main_image?: { image_url?: string } | null;
  sku?: string;
  status?: string;
  stock?: number | string | null;
  stock_quantity?: number | string | null;
  in_stock?: boolean | number | string | null;
  is_in_stock?: boolean | number | string | null;
  track_quantity?: boolean | number | string | null;
  allow_backorder?: boolean | number | string | null;
  service_names?: string[];
  category?: unknown;
}

const PER_PAGE = 12;

export const publicServiceService = {
  /**
   * GET /services?per_page=12 (no token).
   * Returns list of services for dashboard "Place Service Orders" section.
   */
  getServices: async (params?: { page?: number; per_page?: number }): Promise<PublicService[]> => {
    const response = await publicApiClient.get<PublicServicesResponse>('/services', {
      params: { per_page: params?.per_page ?? PER_PAGE, page: params?.page ?? 1 },
    });
    const data = response.data?.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
      return (data as any).data;
    }
    return [];
  },

  /**
   * GET /services/:service_id/products (no token).
   * API returns: { success, message, data: { service_id, service_name, products: [...] } }
   * Uses 15s timeout so UI doesn't hang.
   */
  getProductsByServiceId: async (serviceId: number): Promise<PublicServiceProduct[]> => {
    const response = await publicApiClient.get<{
      success?: boolean;
      message?: string;
      data?: { service_id?: number; service_name?: string; products?: PublicServiceProduct[] };
    }>(`/services/${serviceId}/products`, { timeout: 15000 });
    const data = response.data?.data;
    if (data && typeof data === 'object' && Array.isArray((data as any).products)) {
      return (data as any).products;
    }
    if (Array.isArray(data)) return data;
    return [];
  },

  /**
   * GET /services/products?per_page=20&service_id= (optional). No token.
   * Returns all service products or filtered by service_id. API: { data: { data: Product[] } }
   * Uses 15s timeout so UI doesn't hang if the API is slow.
   */
  getAllServiceProducts: async (params?: {
    per_page?: number;
    page?: number;
    service_id?: number;
    category_id?: number;
    search?: string;
  }): Promise<PublicServiceProduct[]> => {
    const { search, ...rest } = params ?? {};
    const requestParams = {
      per_page: params?.per_page ?? 20,
      page: params?.page ?? 1,
      ...rest,
      ...(search ? { search } : {}),
    };
    const response = await publicApiClient.get<{
      success?: boolean;
      message?: string;
      data?: { data?: PublicServiceProduct[] } | PublicServiceProduct[];
    }>('/services/products', { params: requestParams, timeout: 15000 });
    const data = response.data?.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
      return (data as any).data;
    }
    return [];
  },
};
