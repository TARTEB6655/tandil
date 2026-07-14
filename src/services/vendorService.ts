import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { publicApiClient } from './api';
import { buildFullImageUrl } from '../config/api';
import type { ProductCustomizationConfig } from '../types/productCustomization';
import { mapCustomizationConfigToApiPayload } from '../utils/adminProductOptions';
import { mapAdminApiOptionGroupsToCustomization } from '../utils/adminProductOptions';

function parseProductOptionItems(payload: unknown): VendorProductCategoryOption[] {
  const root = payload as { data?: { items?: unknown[] } | unknown[]; items?: unknown[] };
  const items = Array.isArray(root?.data)
    ? root.data
    : Array.isArray((root?.data as { items?: unknown[] })?.items)
      ? (root.data as { items: unknown[] }).items
      : Array.isArray(root?.items)
        ? root.items
        : [];
  return items
    .map((row) => {
      const item = row as { id?: number | string; name?: string };
      const id = Number(item.id);
      const name = item.name != null ? String(item.name).trim() : '';
      if (!Number.isFinite(id) || id <= 0 || !name) return null;
      return { id, name };
    })
    .filter((item): item is VendorProductCategoryOption => item != null);
}

function mapCustomizationToApi(customization?: ProductCustomizationConfig | null): {
  productType?: 'simple' | 'variable';
  optionGroupsJson?: string;
  optionImageFiles: Array<{ key: string; uri: string }>;
} {
  const payload = mapCustomizationConfigToApiPayload(customization);
  return {
    productType: payload.productType,
    optionGroupsJson: payload.optionGroupsJson,
    optionImageFiles: payload.optionImageFiles,
  };
}

export interface VendorProductCreated {
  id: number;
  name: string;
  description?: string | null;
  price?: number | string;
  stock?: number;
  status?: string;
  sku?: string;
  handle?: string;
  image?: string | null;
  image_url?: string | null;
  primary_image?: { image_url?: string; image_path?: string } | null;
  images?: Array<{ image_url?: string; image_path?: string }>;
}

export interface VendorProductCategoryOption {
  id: number;
  name: string;
}

export interface VendorProductServiceOption {
  id: number;
  name: string;
}

/** POST /vendor/products — multipart form-data (matches Postman collection). */
export interface CreateVendorProductParams {
  name: string;
  description?: string;
  price: number;
  stock: number;
  status: string;
  category_id: number;
  service_id?: number | null;
  weight_unit?: string;
  sku: string;
  handle: string;
  image_urls?: string[];
  is_featured?: number;
  estimated_arrival?: string;
  job_duration?: string;
  product_type?: 'simple' | 'variable';
  customization?: ProductCustomizationConfig | null;
  mainImage?: { uri: string };
  extraImages?: { uri: string }[];
  /** Existing product image IDs to delete on update (multipart removed_image_ids[]). */
  removed_image_ids?: number[];
  /** Set true when clearing the existing main image without uploading a replacement. */
  remove_main_image?: boolean;
}

export interface VendorProductCreateResponse {
  success?: boolean;
  status?: boolean;
  message?: string;
  data: VendorProductCreated;
}

function buildVendorProductFormData(params: CreateVendorProductParams): FormData {
  const customizationPayload = mapCustomizationToApi(params.customization);
  const productType =
    customizationPayload.productType ?? params.product_type ?? 'simple';

  const formData = new FormData();
  formData.append('name', params.name);
  if (params.description) formData.append('description', params.description);
  formData.append('price', String(params.price));
  formData.append('stock', String(params.stock));
  formData.append('status', params.status);
  formData.append('is_featured', String(params.is_featured ?? 0));
  formData.append('category_id', String(params.category_id));
  if (params.service_id != null) formData.append('service_id', String(params.service_id));
  if (params.weight_unit) formData.append('weight_unit', params.weight_unit);
  formData.append('sku', params.sku);
  formData.append('handle', params.handle);
  formData.append('product_type', productType);
  if (params.estimated_arrival?.trim()) formData.append('estimated_arrival', params.estimated_arrival.trim());
  if (params.job_duration?.trim()) formData.append('job_duration', params.job_duration.trim());
  if (customizationPayload.optionGroupsJson) {
    formData.append('option_groups_json', customizationPayload.optionGroupsJson);
  }
  if (params.image_urls?.length) {
    formData.append('image_urls', JSON.stringify(params.image_urls));
  }
  // Backend requires removed_image_ids[] when deleting existing gallery images.
  (params.removed_image_ids ?? []).forEach((id) => {
    if (Number.isFinite(id)) {
      formData.append('removed_image_ids[]', String(id));
    }
  });
  if (params.remove_main_image) {
    formData.append('remove_main_image', '1');
  }
  if (params.mainImage?.uri) {
    formData.append('main_image', {
      uri: params.mainImage.uri,
      type: 'image/jpeg',
      name: 'main-image.jpg',
    } as unknown as Blob);
  }
  (params.extraImages ?? []).forEach((file, index) => {
    formData.append('images[]', {
      uri: file.uri,
      type: 'image/jpeg',
      name: `image-${index}.jpg`,
    } as unknown as Blob);
  });
  customizationPayload.optionImageFiles.forEach((file) => {
    formData.append(`option_images[${file.key}]`, {
      uri: file.uri,
      type: 'image/jpeg',
      name: `${file.key}.jpg`,
    } as unknown as Blob);
  });
  return formData;
}

function extractVendorProductCreated(raw: unknown): VendorProductCreated | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const product = (obj.product ?? obj) as Record<string, unknown>;
  const idCandidate =
    obj.id ?? obj.vendor_product_id ?? product.id ?? obj.product_id;
  if (idCandidate == null || String(idCandidate).trim() === '') return null;
  const id = Number(idCandidate);
  if (!Number.isFinite(id) || id <= 0) return null;

  return {
    id,
    name: String(product.name ?? obj.name ?? ''),
    description:
      product.description != null
        ? String(product.description)
        : obj.description != null
          ? String(obj.description)
          : undefined,
    price: product.price ?? obj.price,
    stock: product.stock != null ? Number(product.stock) : obj.stock != null ? Number(obj.stock) : undefined,
    status: product.status != null ? String(product.status) : obj.status != null ? String(obj.status) : undefined,
    sku: product.sku != null ? String(product.sku) : obj.sku != null ? String(product.sku) : undefined,
    handle: product.handle != null ? String(product.handle) : obj.handle != null ? String(obj.handle) : undefined,
    image_url:
      typeof product.image_url === 'string'
        ? product.image_url
        : typeof obj.image_url === 'string'
          ? obj.image_url
          : undefined,
    image: typeof product.image === 'string' ? product.image : typeof obj.image === 'string' ? obj.image : undefined,
    primary_image: (product.primary_image ?? obj.primary_image) as VendorProductCreated['primary_image'],
    images: Array.isArray(product.images)
      ? (product.images as VendorProductCreated['images'])
      : Array.isArray(obj.images)
        ? (obj.images as VendorProductCreated['images'])
        : undefined,
  };
}

function isVendorProductSuccessMessage(message?: string): boolean {
  if (!message?.trim()) return false;
  return /product created|created successfully|successfully created/i.test(message.trim());
}

function throwIfVendorProductCreateFailed(data: VendorProductCreateResponse): VendorProductCreated {
  if (data?.success === false || data?.status === false) {
    const err = new Error(data?.message || 'Failed to create product.') as Error & {
      response?: { data: VendorProductCreateResponse };
    };
    err.response = { data };
    throw err;
  }

  const created = extractVendorProductCreated(data?.data) ?? extractVendorProductCreated(data);
  if (created) return created;

  if (data?.success === true || data?.status === true || isVendorProductSuccessMessage(data?.message)) {
    return { id: 0, name: '' };
  }

  throw new Error(data?.message || 'Failed to create product.');
}

export type UpdateVendorProductParams = CreateVendorProductParams;

export interface VendorProductUpdateResponse {
  success?: boolean;
  status?: boolean;
  message?: string;
  data?: VendorProductCreated;
}

function throwIfVendorProductUpdateFailed(data: VendorProductUpdateResponse): void {
  if (data?.success === false || data?.status === false) {
    const err = new Error(data?.message || 'Failed to update product.') as Error & {
      response?: { data: VendorProductUpdateResponse };
    };
    err.response = { data };
    throw err;
  }
}

const PRODUCTS_KEY = 'vendor_products_v1';
const INVENTORY_KEY = 'vendor_inventory_v1';
const PRICING_KEY = 'vendor_pricing_v1';

export type VendorOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface VendorDashboardStats {
  currency: string;
  totalProducts: number;
  activeProducts: number;
  lowStockCount: number;
  pendingOrders: number;
  totalOrders: number;
  deliveredOrders: number;
  revenue: number;
}

export interface VendorCatalogProduct {
  id: string;
  vendor_id?: string;
  product_id?: string;
  name: string;
  description: string;
  category: string;
  sku?: string;
  images: string[];
  price: number;
  compare_at_price?: number;
  stock_quantity: number;
  low_stock_threshold: number;
  is_available: boolean;
  listing_status?: string;
  approval_status?: string;
  rejection_reason?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface VendorProductsPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface VendorProductsListResult {
  items: VendorCatalogProduct[];
  pagination: VendorProductsPagination | null;
}

/** Full vendor product row from GET /vendor/products/:id (edit form). */
export interface VendorProductImageItem {
  id?: number;
  uri: string;
  is_primary?: boolean;
}

export interface VendorProductDetail extends VendorCatalogProduct {
  product_status?: string;
  category_id?: number;
  service_ids?: number[];
  weight_unit?: string;
  is_featured?: boolean;
  handle?: string;
  estimated_arrival?: string;
  job_duration?: string;
  product_type?: 'simple' | 'variable';
  customization?: ProductCustomizationConfig | null;
  /** Images with IDs for edit/remove (removed_image_ids[]). */
  product_images?: VendorProductImageItem[];
}

export interface VendorOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  product_id: string;
  product_name: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: VendorOrderStatus;
  order_date: string;
  delivery_date?: string;
}

export interface VendorProductOffer {
  vendor_id: string;
  vendor_name: string;
  vendor_logo?: string;
  vendor_rating: number;
  product_id: string;
  product_name: string;
  price: number;
  compare_at_price?: number;
  stock_quantity: number;
  delivery_days: number;
  /** Human-readable delivery label from API when available (e.g. "2 day delivery"). */
  delivery_label?: string;
  is_available: boolean;
  is_best_price?: boolean;
  discount_percent?: number;
  currency?: string;
}

export type VendorCompareSortBy = 'price' | 'rating' | 'delivery';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickCompareNumber(...values: unknown[]): number {
  for (const value of values) {
    if (value == null || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function pickCompareString(...values: unknown[]): string {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function extractCompareVendorRows(payload: unknown): unknown[] {
  const body = asRecord(payload);
  if (!body) return [];
  const data = body.data ?? body;
  if (Array.isArray(data)) return data;
  const nested = asRecord(data);
  if (!nested) return [];
  const list =
    nested.vendors ??
    nested.items ??
    nested.offers ??
    nested.results ??
    nested.compare_vendors ??
    nested.data;
  return Array.isArray(list) ? list : [];
}

function mapCompareVendorOffer(
  row: unknown,
  productId: string,
  productName?: string
): VendorProductOffer {
  const o = asRecord(row) ?? {};
  const vendor = asRecord(o.vendor) ?? {};
  const price = pickCompareNumber(
    o.price,
    o.sale_price,
    o.current_price,
    o.amount
  );
  const compareAt = pickCompareNumber(
    o.compare_at_price,
    o.original_price,
    o.regular_price,
    o.mrp
  );
  const discountFromApi = pickCompareNumber(
    o.discount_percent,
    o.discount_percentage,
    o.discount
  );
  const discount =
    discountFromApi > 0
      ? discountFromApi
      : compareAt > price && price > 0
        ? Math.round(((compareAt - price) / compareAt) * 100)
        : 0;
  const deliveryLabel = pickCompareString(
    o.delivery_label,
    o.estimated_arrival,
    o.delivery_time,
    o.delivery_text,
    o.delivery
  );
  const deliveryDays =
    pickCompareNumber(o.delivery_days, o.delivery_day, o.estimated_days) ||
    (deliveryLabel.match(/(\d+)/)?.[1] != null
      ? Number(deliveryLabel.match(/(\d+)/)?.[1])
      : 0);

  const logoRaw = pickCompareString(
    o.vendor_logo,
    o.logo,
    o.logo_url,
    vendor.logo_url,
    vendor.logo,
    vendor.profile_picture_url
  );
  const logo =
    logoRaw && !logoRaw.startsWith('http')
      ? buildFullImageUrl(logoRaw)
      : logoRaw || undefined;

  const priceFormatted = pickCompareString(o.price_formatted, o.sale_price_formatted);
  const currencyFromPrice =
    priceFormatted.match(/^([A-Za-z]{3})\b/)?.[1] ||
    pickCompareString(o.currency) ||
    'AED';

  return {
    vendor_id: pickCompareString(
      o.vendor_id,
      o.id,
      vendor.id,
      o.vendor_product_id
    ) || String(o.vendor_id ?? o.id ?? ''),
    vendor_name:
      pickCompareString(
        o.vendor_name,
        o.business_name,
        o.company_name,
        vendor.business_name,
        vendor.company_name,
        vendor.name,
        o.name
      ) || 'Vendor',
    vendor_logo: logo,
    vendor_rating: pickCompareNumber(
      o.vendor_rating,
      o.rating,
      vendor.rating,
      o.average_rating,
      o.stars
    ),
    product_id: pickCompareString(o.product_id, productId) || productId,
    product_name:
      pickCompareString(o.product_name, productName) || productName || '',
    price,
    compare_at_price: compareAt > 0 ? compareAt : undefined,
    stock_quantity: pickCompareNumber(
      o.stock_quantity,
      o.stock,
      o.stock_count,
      o.quantity
    ),
    delivery_days: deliveryDays,
    delivery_label: deliveryLabel || undefined,
    is_available:
      o.is_available !== false &&
      o.available !== false &&
      String(o.status ?? '').toLowerCase() !== 'unavailable',
    is_best_price:
      o.is_best_price === true ||
      o.best_price === true ||
      o.is_lowest_price === true,
    discount_percent: discount > 0 ? discount : undefined,
    currency: currencyFromPrice,
  };
}

function demoProducts(): VendorCatalogProduct[] {
  return [
    {
      id: 'vp-1',
      name: 'Organic Potting Mix 20L',
      description: 'Premium organic soil blend for indoor and outdoor plants.',
      category: 'Soil & Fertilizers',
      sku: 'OPM-20',
      images: ['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400'],
      price: 45,
      compare_at_price: 55,
      stock_quantity: 120,
      low_stock_threshold: 20,
      is_available: true,
      created_at: '2024-01-15T10:00:00Z',
    },
    {
      id: 'vp-2',
      name: 'Desert Rose Seedling',
      description: 'Healthy desert rose seedlings ready for transplant.',
      category: 'Plants',
      sku: 'DRS-01',
      images: ['https://images.unsplash.com/photo-1466781783364-36c667e55134?w=400'],
      price: 35,
      stock_quantity: 8,
      low_stock_threshold: 15,
      is_available: true,
      created_at: '2024-01-10T10:00:00Z',
    },
    {
      id: 'vp-3',
      name: 'Drip Irrigation Kit',
      description: 'Complete drip irrigation set for balcony gardens.',
      category: 'Irrigation',
      sku: 'DIK-100',
      images: ['https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400'],
      price: 89,
      compare_at_price: 110,
      stock_quantity: 0,
      low_stock_threshold: 10,
      is_available: false,
      created_at: '2024-01-05T10:00:00Z',
    },
  ];
}

function demoOrders(): VendorOrder[] {
  return [
    {
      id: 'vo-1',
      order_number: 'VND-2024-1042',
      customer_name: 'Ahmed Al Mansouri',
      customer_phone: '+971 50 123 4567',
      customer_address: 'Dubai Marina, Dubai',
      product_id: 'vp-1',
      product_name: 'Organic Potting Mix 20L',
      product_image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400',
      quantity: 2,
      unit_price: 45,
      total_amount: 90,
      status: 'confirmed',
      order_date: '2024-01-20T09:30:00Z',
      delivery_date: '2024-01-22T14:00:00Z',
    },
    {
      id: 'vo-2',
      order_number: 'VND-2024-1043',
      customer_name: 'Fatima Hassan',
      customer_phone: '+971 55 987 6543',
      customer_address: 'Abu Dhabi Corniche',
      product_id: 'vp-2',
      product_name: 'Desert Rose Seedling',
      product_image: 'https://images.unsplash.com/photo-1466781783364-36c667e55134?w=400',
      quantity: 1,
      unit_price: 35,
      total_amount: 35,
      status: 'pending',
      order_date: '2024-01-21T11:00:00Z',
    },
  ];
}

function demoVendorOffers(productId: string, productName: string): VendorProductOffer[] {
  return [
    {
      vendor_id: 'v-1',
      vendor_name: 'Green Valley Nursery',
      vendor_logo: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=100',
      vendor_rating: 4.8,
      product_id: productId,
      product_name: productName,
      price: 42,
      compare_at_price: 55,
      stock_quantity: 85,
      delivery_days: 2,
      is_available: true,
    },
    {
      vendor_id: 'v-2',
      vendor_name: 'Desert Bloom Supplies',
      vendor_rating: 4.5,
      product_id: productId,
      product_name: productName,
      price: 45,
      compare_at_price: 50,
      stock_quantity: 30,
      delivery_days: 1,
      is_available: true,
    },
    {
      vendor_id: 'v-3',
      vendor_name: 'Al Ain Garden Center',
      vendor_rating: 4.2,
      product_id: productId,
      product_name: productName,
      price: 48,
      stock_quantity: 12,
      delivery_days: 3,
      is_available: true,
    },
  ];
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

function resolveProductImageUrl(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string' && raw.trim()) {
    const trimmed = raw.trim();
    return trimmed.startsWith('http') ? trimmed : buildFullImageUrl(trimmed);
  }
  if (typeof raw === 'object') {
    const obj = raw as { image_url?: string; url?: string; image_path?: string };
    const candidate = obj.image_url ?? obj.url ?? obj.image_path;
    if (candidate && String(candidate).trim()) {
      const trimmed = String(candidate).trim();
      return trimmed.startsWith('http') ? trimmed : buildFullImageUrl(trimmed);
    }
  }
  return null;
}

/** Collect product images with IDs from detail/list payloads. */
function extractProductImages(product: Record<string, unknown>): VendorProductImageItem[] {
  const items: VendorProductImageItem[] = [];
  const seen = new Set<string>();

  const push = (raw: unknown, forcePrimary?: boolean) => {
    if (raw == null) return;
    if (typeof raw === 'string') {
      const uri = resolveProductImageUrl(raw);
      if (!uri || seen.has(uri)) return;
      seen.add(uri);
      items.push({ uri, is_primary: forcePrimary === true });
      return;
    }
    if (typeof raw !== 'object') return;
    const obj = raw as {
      id?: number | string;
      image_url?: string;
      url?: string;
      image_path?: string;
      is_primary?: number | boolean;
    };
    const uri = resolveProductImageUrl(obj);
    if (!uri || seen.has(uri)) return;
    seen.add(uri);
    const idNum = obj.id != null ? Number(obj.id) : NaN;
    items.push({
      uri,
      id: Number.isFinite(idNum) && idNum > 0 ? idNum : undefined,
      is_primary:
        forcePrimary === true || obj.is_primary === 1 || obj.is_primary === true,
    });
  };

  push(product.primary_image ?? product.main_image, true);
  if (typeof product.image_url === 'string') push(product.image_url, items.length === 0);

  const gallery = Array.isArray(product.gallery_images) ? product.gallery_images : [];
  const images = Array.isArray(product.images) ? product.images : [];

  if (gallery.length > 0) {
    gallery.forEach((g) => push(g, false));
  } else {
    images.forEach((img, index) => {
      const obj =
        img && typeof img === 'object'
          ? (img as { is_primary?: number | boolean })
          : null;
      const isPrimary =
        obj?.is_primary === 1 ||
        obj?.is_primary === true ||
        (index === 0 && items.length === 0);
      push(img, isPrimary);
    });
  }

  if (items.length > 0 && !items.some((i) => i.is_primary)) {
    items[0] = { ...items[0], is_primary: true };
  }

  return items;
}

/** Map GET /vendor/products item → catalog row for UI. */
function mapVendorProductListItem(row: Record<string, unknown>): VendorCatalogProduct {
  const product = (row.product ?? {}) as Record<string, unknown>;
  const inventory = (row.inventory ?? {}) as Record<string, unknown>;
  const currentPrice = (row.current_price ?? {}) as Record<string, unknown>;
  const category = product.category as { name?: string } | string | undefined;

  const imageCandidates: unknown[] = [
    product.image_url,
    product.image,
    (product.main_image as { image_url?: string } | undefined)?.image_url,
    ...(Array.isArray(product.gallery_images) ? product.gallery_images : []),
    ...(Array.isArray(product.images) ? product.images : []),
  ];
  const images = imageCandidates
    .map(resolveProductImageUrl)
    .filter((url): url is string => Boolean(url));

  const listingStatus = String(row.status ?? '').toLowerCase();

  return {
    id: String(row.id),
    vendor_id: row.vendor_id != null ? String(row.vendor_id) : undefined,
    product_id: row.product_id != null ? String(row.product_id) : undefined,
    name: String(product.name ?? ''),
    description: String(product.description ?? ''),
    category:
      typeof category === 'object' && category?.name
        ? String(category.name)
        : typeof category === 'string'
          ? category
          : '—',
    sku: product.sku != null ? String(product.sku) : undefined,
    images,
    price: Number(currentPrice.price ?? product.price ?? 0),
    compare_at_price:
      currentPrice.compare_at_price != null ? Number(currentPrice.compare_at_price) : undefined,
    stock_quantity: Number(inventory.quantity ?? product.stock ?? 0),
    low_stock_threshold: Number(inventory.low_stock_threshold ?? 5),
    is_available: listingStatus === 'active',
    listing_status: row.status != null ? String(row.status) : undefined,
    approval_status: row.approval_status != null ? String(row.approval_status) : undefined,
    rejection_reason:
      row.rejection_reason != null ? String(row.rejection_reason) : null,
    created_at: String(product.created_at ?? row.created_at ?? new Date().toISOString()),
    updated_at: product.updated_at != null ? String(product.updated_at) : undefined,
  };
}

function buildVendorRowFromFlatProduct(product: Record<string, unknown>): Record<string, unknown> {
  const category = product.category as { id?: number; name?: string } | string | undefined;
  const categoryId =
    product.category_id != null
      ? product.category_id
      : typeof category === 'object' && category?.id != null
        ? category.id
        : undefined;

  return {
    id: product.vendor_product_id ?? product.id,
    vendor_id: product.vendor_id,
    product_id: product.product_id ?? product.id,
    status: product.listing_status ?? product.status,
    approval_status: product.approval_status,
    rejection_reason: product.rejection_reason,
    inventory: product.inventory ?? {
      quantity: product.stock ?? product.stock_quantity,
      low_stock_threshold: product.low_stock_threshold,
    },
    current_price: product.current_price ?? {
      price: product.price,
      compare_at_price: product.compare_at_price,
    },
    product: {
      ...product,
      category_id: categoryId,
    },
  };
}

function extractVendorProductRowFromPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Product not found.');
  }

  const body = payload as Record<string, unknown>;
  if (body.success === false) {
    throw new Error(String(body.message || 'Product not found.'));
  }

  const data = body.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const dataObj = data as Record<string, unknown>;
    if (dataObj.product != null || dataObj.inventory != null || dataObj.current_price != null) {
      return dataObj;
    }

    const nested = dataObj.item ?? dataObj.vendor_product ?? dataObj.vendorProduct;
    if (nested && typeof nested === 'object') {
      return nested as Record<string, unknown>;
    }

    if (dataObj.name != null) {
      return buildVendorRowFromFlatProduct(dataObj);
    }
  }

  if (body.product != null || body.inventory != null || body.current_price != null) {
    return body;
  }

  const wrapped = body.item ?? body.vendor_product ?? body.vendorProduct;
  if (wrapped && typeof wrapped === 'object') {
    return wrapped as Record<string, unknown>;
  }

  if (body.name != null) {
    return buildVendorRowFromFlatProduct(body);
  }

  throw new Error('Product not found.');
}

function resolveProductCategoryId(product: Record<string, unknown>): number | undefined {
  if (product.category_id != null) {
    const categoryId = Number(product.category_id);
    return Number.isFinite(categoryId) ? categoryId : undefined;
  }
  const category = product.category as { id?: number } | undefined;
  if (category?.id != null) {
    const categoryId = Number(category.id);
    return Number.isFinite(categoryId) ? categoryId : undefined;
  }
  return undefined;
}

function mapVendorProductDetail(payload: unknown): VendorProductDetail {
  const row = extractVendorProductRowFromPayload(payload);
  const base = mapVendorProductListItem(row);
  const product = (row.product ?? {}) as Record<string, unknown>;
  const serviceIds = Array.isArray(product.service_ids)
    ? product.service_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
    : [];
  let customization: ProductCustomizationConfig | null = null;
  try {
    customization = mapAdminApiOptionGroupsToCustomization(product.option_groups);
  } catch {
    customization = null;
  }

  const productImages = extractProductImages(product);
  const imageUris =
    productImages.length > 0 ? productImages.map((i) => i.uri) : base.images;

  return {
    ...base,
    images: imageUris,
    product_images: productImages,
    product_status: product.status != null ? String(product.status) : undefined,
    category_id: resolveProductCategoryId(product),
    service_ids: serviceIds,
    weight_unit: product.weight_unit != null ? String(product.weight_unit) : undefined,
    is_featured: Boolean(product.is_featured),
    handle: product.handle != null ? String(product.handle) : undefined,
    estimated_arrival:
      product.estimated_arrival != null ? String(product.estimated_arrival) : undefined,
    job_duration: product.job_duration != null ? String(product.job_duration) : undefined,
    product_type:
      product.product_type === 'variable' || product.product_type === 'simple'
        ? product.product_type
        : undefined,
    customization,
  };
}

async function fetchVendorProductDetailFromList(id: string): Promise<VendorProductDetail | null> {
  try {
    const response = await apiClient.get('/vendor/products', {
      params: { page: 1, per_page: 100 },
    });
    const body = response.data as { data?: { items?: unknown[] } };
    const items = Array.isArray(body?.data?.items) ? body.data.items : [];
    const row = items.find(
      (item) => item != null && String((item as Record<string, unknown>).id) === String(id)
    );
    if (!row || typeof row !== 'object') return null;
    return mapVendorProductDetail({ success: true, data: row });
  } catch {
    return null;
  }
}

function parseVendorProductsResponse(payload: unknown): VendorProductsListResult {
  const body = payload as {
    success?: boolean;
    message?: string;
    data?: {
      items?: unknown[];
      pagination?: VendorProductsPagination;
    };
  };
  if (body?.success === false) {
    throw new Error(body.message || 'Failed to load products.');
  }
  const items = Array.isArray(body?.data?.items) ? body.data.items : [];
  return {
    items: items.map((row) => mapVendorProductListItem(row as Record<string, unknown>)),
    pagination: body?.data?.pagination ?? null,
  };
}

function normalizeProduct(raw: Record<string, unknown>): VendorCatalogProduct {
  if (raw.product != null) {
    return mapVendorProductListItem(raw);
  }
  return {
    id: String(raw.id),
    vendor_id: raw.vendor_id != null ? String(raw.vendor_id) : undefined,
    product_id: raw.product_id != null ? String(raw.product_id) : undefined,
    name: String(raw.name ?? ''),
    description: String(raw.description ?? ''),
    category: String(raw.category ?? raw.category_name ?? '—'),
    sku: raw.sku != null ? String(raw.sku) : undefined,
    images: Array.isArray(raw.images)
      ? raw.images.map(resolveProductImageUrl).filter((url): url is string => Boolean(url))
      : raw.image_url
        ? [resolveProductImageUrl(raw.image_url)!].filter(Boolean)
        : [],
    price: Number(raw.price ?? 0),
    compare_at_price: raw.compare_at_price != null ? Number(raw.compare_at_price) : undefined,
    stock_quantity: Number(raw.stock_quantity ?? raw.stock ?? 0),
    low_stock_threshold: Number(raw.low_stock_threshold ?? 10),
    is_available: raw.is_available !== false && raw.is_active !== false,
    created_at: String(raw.created_at ?? new Date().toISOString()),
    updated_at: raw.updated_at != null ? String(raw.updated_at) : undefined,
  };
}

export const vendorService = {
  /** GET /vendor/dashboard/summary – mobile dashboard cards */
  async getDashboardStats(): Promise<VendorDashboardStats> {
    const response = await apiClient.get('/vendor/dashboard/summary');
    const data = response?.data?.data ?? response?.data ?? {};
    return {
      currency: String(data.currency ?? 'AED'),
      totalProducts: Number(data.products ?? data.total_products ?? 0),
      activeProducts: Number(data.active ?? data.active_products ?? 0),
      lowStockCount: Number(data.low_stock ?? data.low_stock_count ?? 0),
      pendingOrders: Number(data.pending_orders ?? 0),
      totalOrders: Number(data.total_orders ?? 0),
      deliveredOrders: Number(data.delivered_orders ?? 0),
      revenue: Number(data.revenue ?? 0),
    };
  },

  async getProducts(params?: { page?: number; per_page?: number }): Promise<VendorCatalogProduct[]> {
    const result = await this.getProductsPage(params);
    return result.items;
  },

  /** GET /vendor/products — paginated list with nested product/inventory/price. */
  async getProductsPage(params?: {
    page?: number;
    per_page?: number;
  }): Promise<VendorProductsListResult> {
    const response = await apiClient.get('/vendor/products', {
      params: {
        page: params?.page ?? 1,
        per_page: params?.per_page ?? 15,
      },
    });
    return parseVendorProductsResponse(response.data);
  },

  async getProductById(id: string): Promise<VendorProductDetail> {
    const vendorProductId = String(id).trim();
    if (!vendorProductId) {
      throw new Error('Product not found.');
    }

    try {
      const response = await apiClient.get(`/vendor/products/${encodeURIComponent(vendorProductId)}`);
      const detail = mapVendorProductDetail(response.data);
      if (!detail.name?.trim()) {
        throw new Error('Product data is incomplete.');
      }
      return detail;
    } catch (primaryErr) {
      const fromList = await fetchVendorProductDetailFromList(vendorProductId);
      if (fromList?.name?.trim()) {
        return fromList;
      }
      throw primaryErr;
    }
  },

  async findProductInList(id: string): Promise<VendorCatalogProduct | null> {
    const products = await this.getProducts();
    return products.find((p) => p.id === id) ?? null;
  },

  /** GET /vendor/product-options/categories — id + name for add-product dropdown. */
  async getProductCategories(): Promise<VendorProductCategoryOption[]> {
    const response = await apiClient.get('/vendor/product-options/categories');
    return parseProductOptionItems(response.data);
  },

  /** GET /vendor/product-options/services — id + name for add-product dropdown. */
  async getProductServices(): Promise<VendorProductServiceOption[]> {
    const response = await apiClient.get('/vendor/product-options/services');
    return parseProductOptionItems(response.data);
  },

  /** POST /vendor/products — multipart form-data (same as admin + Postman). */
  async createProduct(params: CreateVendorProductParams): Promise<VendorProductCreateResponse> {
    const formData = buildVendorProductFormData(params);
    const response = await apiClient.post<VendorProductCreateResponse>('/vendor/products', formData, {
      timeout: 300000,
    });
    const created = throwIfVendorProductCreateFailed(response.data);
    return {
      ...response.data,
      success: response.data?.success ?? true,
      data: created,
    };
  },

  /** POST /vendor/products/:id — multipart update (same fields as create). */
  async updateProduct(
    vendorProductId: string,
    params: UpdateVendorProductParams
  ): Promise<VendorProductUpdateResponse> {
    const id = String(vendorProductId).trim();
    if (!id) {
      throw new Error('Product not found.');
    }
    const formData = buildVendorProductFormData(params);
    const response = await apiClient.post<VendorProductUpdateResponse>(
      `/vendor/products/${encodeURIComponent(id)}`,
      formData,
      { timeout: 300000 }
    );
    throwIfVendorProductUpdateFailed(response.data);
    return response.data;
  },

  /** DELETE /vendor/products/:id */
  async deleteProduct(vendorProductId: string): Promise<{ success?: boolean; status?: boolean; message?: string }> {
    const id = String(vendorProductId).trim();
    if (!id) {
      throw new Error('Product not found.');
    }
    const response = await apiClient.delete<{ success?: boolean; status?: boolean; message?: string }>(
      `/vendor/products/${encodeURIComponent(id)}`
    );
    const body = response.data ?? {};
    if (body.success === false || body.status === false) {
      throw new Error(body.message || 'Failed to delete product.');
    }
    return body;
  },

  /** @deprecated Use createProduct — kept for callers that used the old name. */
  async createProductWithImages(
    params: CreateVendorProductParams
  ): Promise<VendorProductCreateResponse> {
    return this.createProduct(params);
  },

  async saveProduct(
    input: Partial<VendorCatalogProduct> & { name: string; category: string },
    id?: string
  ): Promise<VendorCatalogProduct> {
    try {
      const payload = {
        name: input.name,
        description: input.description ?? '',
        category: input.category,
        sku: input.sku,
        price: input.price ?? 0,
        compare_at_price: input.compare_at_price,
        stock_quantity: input.stock_quantity ?? 0,
        low_stock_threshold: input.low_stock_threshold ?? 10,
        is_available: input.is_available !== false,
      };
      const response = id
        ? await apiClient.put(`/vendor/products/${id}`, payload)
        : await apiClient.post('/vendor/products', payload);
      const raw = response?.data?.data ?? response?.data;
      if (raw) return normalizeProduct({ ...raw, id: raw.id ?? id });
    } catch {
      // local fallback
    }
    const products = await this.getProducts();
    const now = new Date().toISOString();
    if (id) {
      const idx = products.findIndex((p) => p.id === id);
      if (idx >= 0) {
        products[idx] = {
          ...products[idx],
          ...input,
          name: input.name,
          category: input.category,
          updated_at: now,
        };
        await writeJson(PRODUCTS_KEY, products);
        return products[idx];
      }
    }
    const created: VendorCatalogProduct = {
      id: `vp-${Date.now()}`,
      name: input.name,
      description: input.description ?? '',
      category: input.category,
      sku: input.sku,
      images: input.images ?? [],
      price: input.price ?? 0,
      compare_at_price: input.compare_at_price,
      stock_quantity: input.stock_quantity ?? 0,
      low_stock_threshold: input.low_stock_threshold ?? 10,
      is_available: input.is_available !== false,
      created_at: now,
    };
    products.unshift(created);
    await writeJson(PRODUCTS_KEY, products);
    return created;
  },

  async toggleProductAvailability(id: string, isAvailable: boolean): Promise<void> {
    try {
      await apiClient.patch(`/vendor/products/${id}/availability`, { is_available: isAvailable });
      return;
    } catch {
      // local
    }
    const products = await this.getProducts();
    const idx = products.findIndex((p) => p.id === id);
    if (idx >= 0) {
      products[idx].is_available = isAvailable;
      await writeJson(PRODUCTS_KEY, products);
    }
  },

  async updateInventory(
    productId: string,
    stockQuantity: number,
    lowStockThreshold?: number
  ): Promise<void> {
    try {
      await apiClient.put(`/vendor/inventory/${productId}`, {
        stock_quantity: stockQuantity,
        low_stock_threshold: lowStockThreshold,
      });
      return;
    } catch {
      // local
    }
    const products = await this.getProducts();
    const idx = products.findIndex((p) => p.id === productId);
    if (idx >= 0) {
      products[idx].stock_quantity = stockQuantity;
      if (lowStockThreshold != null) {
        products[idx].low_stock_threshold = lowStockThreshold;
      }
      await writeJson(PRODUCTS_KEY, products);
    }
    const inventory = await readJson<Record<string, { stock: number; threshold: number }>>(
      INVENTORY_KEY,
      {}
    );
    inventory[productId] = {
      stock: stockQuantity,
      threshold: lowStockThreshold ?? inventory[productId]?.threshold ?? 10,
    };
    await writeJson(INVENTORY_KEY, inventory);
  },

  async updateProductPricing(
    productId: string,
    price: number,
    compareAtPrice?: number
  ): Promise<void> {
    try {
      await apiClient.put(`/vendor/products/${productId}/pricing`, {
        price,
        compare_at_price: compareAtPrice,
      });
      return;
    } catch {
      // local
    }
    const products = await this.getProducts();
    const idx = products.findIndex((p) => p.id === productId);
    if (idx >= 0) {
      products[idx].price = price;
      products[idx].compare_at_price = compareAtPrice;
      await writeJson(PRODUCTS_KEY, products);
    }
    const pricing = await readJson<Record<string, { price: number; compare?: number }>>(
      PRICING_KEY,
      {}
    );
    pricing[productId] = { price, compare: compareAtPrice };
    await writeJson(PRICING_KEY, pricing);
  },

  async getOrders(status?: VendorOrderStatus | 'all'): Promise<VendorOrder[]> {
    try {
      const { vendorOrderService } = await import('./vendorOrderService');
      const result = await vendorOrderService.listOrders({
        status,
        per_page: 50,
      });
      if (result.orders.length > 0) {
        return result.orders.map((o) => ({
          id: o.id,
          order_number: o.order_number,
          customer_name: o.customer_name,
          customer_phone: o.customer_phone ?? '',
          customer_address: o.customer_address ?? '',
          product_id: '',
          product_name: o.product_name ?? '',
          product_image: o.product_image,
          quantity: o.quantity ?? o.items_count ?? 1,
          unit_price: o.unit_price ?? 0,
          total_amount: o.total_amount,
          status: o.status,
          order_date: o.order_date,
          delivery_date: o.delivery_date,
        }));
      }
    } catch {
      // demo
    }
    const orders = demoOrders();
    if (!status || status === 'all') return orders;
    return orders.filter((o) => o.status === status);
  },

  async updateOrderStatus(orderId: string, status: VendorOrderStatus): Promise<void> {
    try {
      const { vendorOrderService } = await import('./vendorOrderService');
      await vendorOrderService.updateOrderStatus(orderId, { status });
    } catch {
      // demo — no persistence for orders in local mode
    }
  },

  /**
   * GET /shop/products/{product_id}/compare-vendors?sort_by=price|rating|delivery
   * Fallback: GET /vendor/compare/products/{product_id}?sort_by=...
   */
  async getVendorOffersForProduct(
    productId: string,
    productName?: string,
    sortBy: VendorCompareSortBy = 'price'
  ): Promise<VendorProductOffer[]> {
    const id = String(productId ?? '').trim();
    if (!id) return [];

    const sort = sortBy === 'rating' || sortBy === 'delivery' ? sortBy : 'price';
    const endpoints = [
      `/shop/products/${encodeURIComponent(id)}/compare-vendors`,
      `/vendor/compare/products/${encodeURIComponent(id)}`,
    ];

    let lastError: unknown;
    for (const url of endpoints) {
      try {
        const response = await publicApiClient.get(url, {
          params: { sort_by: sort },
          timeout: 20000,
        });
        const body = asRecord(response.data) ?? {};
        if (body.success === false) {
          throw new Error(
            pickCompareString(body.message) || 'Failed to load vendor comparison.'
          );
        }
        const rows = extractCompareVendorRows(response.data);
        return rows.map((row) => mapCompareVendorOffer(row, id, productName));
      } catch (error) {
        lastError = error;
      }
    }

    const ax = lastError as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    throw new Error(
      ax?.response?.data?.message ||
        ax?.message ||
        'Failed to load vendor comparison.'
    );
  },
};
