import { publicApiClient } from './api';

export interface ShopProductCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  image?: string | null;
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
  products_count?: number;
  coming_soon?: boolean;
}

export interface ShopCategoriesResponse {
  success: boolean;
  message?: string;
  data: ShopProductCategory[];
}

export interface ShopProduct {
  id: number;
  category_id?: number | null;
  name: string;
  vendor?: string;
  type?: string;
  sku?: string;
  barcode?: string;
  description?: string;
  handle?: string;
  price: string | number;
  compare_at_price?: string | number;
  weight?: string;
  weight_unit?: string;
  stock: number;
  status: string;
  is_featured?: boolean | number;
  image?: string | null;
  image_url?: string | null;
  main_image?: { id: number; image_path: string; image_url?: string } | null;
  gallery_images?: Array<{ id: number; image_path: string; image_url?: string; sort_order?: number }>;
  /** Optional service-oriented copy from admin product (shop API). */
  estimated_arrival?: string | null;
  job_duration?: string | null;
  created_at?: string;
  updated_at?: string;
  category?: ShopProductCategory | null;
}

export interface ShopFeaturedProductsResponse {
  success?: boolean;
  data?: ShopProduct[];
}

export interface ShopProductsByCategoryResponse {
  success: boolean;
  message?: string;
  data: {
    category: ShopProductCategory;
    products: ShopProduct[];
    pagination: { current_page: number; last_page: number; per_page: number; total: number };
  };
}

export interface ShopProductsResponse {
  success: boolean;
  message?: string;
  data: ShopProduct[];
}

export interface ShopProductDetailResponse {
  success: boolean;
  message?: string;
  data: ShopProduct;
}

export const shopService = {
  getProducts: async (params?: { per_page?: number; page?: number; search?: string }): Promise<ShopProductsResponse> => {
    const { search, ...rest } = params ?? {};
    const sendParams = { ...rest } as { per_page?: number; page?: number; search?: string };
    if (search != null && search.trim() !== '') sendParams.search = search.trim();
    const response = await publicApiClient.get<ShopProductsResponse>('/shop/products', { params: sendParams });
    return response.data;
  },

  /** GET /shop/products/categories – public, no auth. Returns categories for Shop by Category. */
  getProductCategories: async (): Promise<ShopProductCategory[]> => {
    try {
      const response = await publicApiClient.get<ShopCategoriesResponse>('/shop/products/categories', {
        timeout: 15000,
      });
      const body = response?.data ?? response;
      const list = Array.isArray((body as any)?.data) ? (body as any).data : [];
      return list;
    } catch (_) {
      return [];
    }
  },

  /** GET /shop/products/:product_id – public. Returns single product details. */
  getProductById: async (productId: string | number): Promise<ShopProduct | null> => {
    try {
      const response = await publicApiClient.get<ShopProductDetailResponse>(`/shop/products/${productId}`, {
        timeout: 15000,
      });
      const data = (response?.data as any)?.data ?? null;
      return data;
    } catch (_) {
      return null;
    }
  },

  /** GET /shop/products/category/:category_id – public. Returns category + products + pagination. */
  getProductsByCategory: async (
    categoryId: string | number,
    params?: { page?: number }
  ): Promise<ShopProductsByCategoryResponse['data'] | null> => {
    try {
      const response = await publicApiClient.get<ShopProductsByCategoryResponse>(
        `/shop/products/category/${categoryId}`,
        { params: params ?? {}, timeout: 15000 }
      );
      const data = (response?.data as any)?.data ?? null;
      return data;
    } catch (_) {
      return null;
    }
  },

  /** GET /shop/products/featured?limit=10 – public. Returns featured products for Home & View All. */
  getFeaturedProducts: async (limit: number = 10): Promise<ShopProduct[]> => {
    try {
      const response = await publicApiClient.get<ShopFeaturedProductsResponse>('/shop/products/featured', {
        params: { limit },
        timeout: 15000,
      });
      const body = response?.data ?? response;
      const list = Array.isArray((body as any)?.data) ? (body as any).data : Array.isArray(body) ? body : [];
      return list;
    } catch (_) {
      return [];
    }
  },
};
