import { publicApiClient } from './api';
import {
  isShopProductInStock,
  resolveShopProductStock,
  type ShopProductStockSource,
} from '../utils/shopProductStock';

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
  /** Optional display order provided by admin panel. */
  sort_order?: number;
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
  product_type?: string | null;
  price: string | number;
  compare_at_price?: string | number;
  weight?: string;
  weight_unit?: string;
  stock: number;
  stock_quantity?: number | null;
  in_stock?: boolean | number | null;
  track_quantity?: boolean | number | null;
  allow_backorder?: boolean | number | null;
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
  /** Optional display order within category (lower = earlier). */
  sort_order?: number;
  category?: ShopProductCategory | null;
  option_groups?: Array<{
    id?: number;
    name: string;
    subtitle?: string | null;
    input_type: 'single' | 'multiple' | string;
    is_required: boolean;
    sort_order?: number;
    options: Array<{
      id?: number;
      label: string;
      subtitle?: string | null;
      price_modifier?: number;
      image_path?: string | null;
      image_url?: string | null;
      sort_order?: number;
    }>;
  }>;
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

function normalizeShopProduct(raw: unknown): ShopProduct {
  const item = (raw && typeof raw === 'object' ? raw : {}) as ShopProduct &
    ShopProductStockSource;
  const stock = resolveShopProductStock(item);
  return {
    ...item,
    stock,
    in_stock: isShopProductInStock(item),
  };
}

function normalizeShopProductList(list: unknown): ShopProduct[] {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeShopProduct);
}

function sortShopProductsByOrder(products: ShopProduct[]): ShopProduct[] {
  return [...products].sort((a, b) => {
    if (a.sort_order == null && b.sort_order == null) return 0;
    if (a.sort_order == null) return 1;
    if (b.sort_order == null) return -1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

export { isShopProductInStock, resolveShopProductStock } from '../utils/shopProductStock';

export const shopService = {
  getProducts: async (params?: { per_page?: number; page?: number; search?: string }): Promise<ShopProductsResponse> => {
    const { search, ...rest } = params ?? {};
    const sendParams = { ...rest } as { per_page?: number; page?: number; search?: string };
    if (search != null && search.trim() !== '') sendParams.search = search.trim();
    const response = await publicApiClient.get<ShopProductsResponse>('/shop/products', { params: sendParams });
    const body = response.data;
    if (body?.data) {
      body.data = normalizeShopProductList(body.data);
    }
    return body;
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
      return data ? normalizeShopProduct(data) : null;
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
      if (data?.products) {
        data.products = sortShopProductsByOrder(normalizeShopProductList(data.products));
      }
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
      return normalizeShopProductList(list);
    } catch (_) {
      return [];
    }
  },
};
