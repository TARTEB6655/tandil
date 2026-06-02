import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getDefaultSheepCustomization,
  isSheepLikeProductName,
} from '../config/dummyProductCustomization';
import type { ProductCustomizationConfig } from '../types/productCustomization';

const STORAGE_KEY = 'product_customization_config_v1';

type CustomizationMap = Record<string, ProductCustomizationConfig>;

async function readMap(): Promise<CustomizationMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CustomizationMap;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // ignore parse/storage errors for dummy mode
  }
  return {};
}

async function writeMap(map: CustomizationMap): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors for dummy mode
  }
}

export async function getProductCustomization(
  productId: string | number
): Promise<ProductCustomizationConfig | null> {
  const key = String(productId);
  const map = await readMap();
  return map[key] ?? null;
}

export async function setProductCustomization(
  productId: string | number,
  config: ProductCustomizationConfig | null
): Promise<void> {
  const key = String(productId);
  const map = await readMap();
  if (!config || !Array.isArray(config.groups) || config.groups.length === 0) {
    delete map[key];
  } else {
    map[key] = config;
  }
  await writeMap(map);
}

export async function getEffectiveProductCustomization(params: {
  productId: string | number;
  productName: string;
}): Promise<ProductCustomizationConfig | null> {
  const saved = await getProductCustomization(params.productId);
  if (saved) return saved;
  if (isSheepLikeProductName(params.productName)) return getDefaultSheepCustomization();
  return null;
}
