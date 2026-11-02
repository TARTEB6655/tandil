import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  adminVendorManagementService,
  type AdminManagedVendorProduct,
} from '../services/adminVendorManagementService';

const listingTypeKey = (id: string) => `@admin_vendor_listing_type:${id}`;
export const vendorProductServiceCacheKey = (id: string) => `@admin_vendor_product_service:${id}`;
const vendorProductServiceNameCacheKey = (id: string) => `@admin_vendor_product_service_name:${id}`;

export async function writeAdminVendorListingType(
  productId: string,
  listingType: 'product' | 'service'
): Promise<void> {
  try {
    await AsyncStorage.setItem(listingTypeKey(productId), listingType);
  } catch {
    // ignore
  }
}

export async function readVendorProductListingMeta(productId: string): Promise<{
  listingType?: 'product' | 'service';
  serviceId?: number;
  serviceName?: string;
}> {
  const id = String(productId).trim();
  if (!id) return {};
  try {
    const [listingRaw, serviceRaw, serviceNameRaw] = await Promise.all([
      AsyncStorage.getItem(listingTypeKey(id)),
      AsyncStorage.getItem(vendorProductServiceCacheKey(id)),
      AsyncStorage.getItem(vendorProductServiceNameCacheKey(id)),
    ]);
    const serviceIdNum = serviceRaw != null ? Number(serviceRaw) : NaN;
    return {
      listingType:
        listingRaw === 'product' || listingRaw === 'service' ? listingRaw : undefined,
      serviceId: Number.isFinite(serviceIdNum) && serviceIdNum > 0 ? serviceIdNum : undefined,
      serviceName: serviceNameRaw?.trim() || undefined,
    };
  } catch {
    return {};
  }
}

export async function writeCachedProductServiceId(
  productId: string,
  serviceId: number,
  serviceName?: string
): Promise<void> {
  try {
    await AsyncStorage.setItem(vendorProductServiceCacheKey(productId), String(serviceId));
    if (serviceName?.trim()) {
      await AsyncStorage.setItem(vendorProductServiceNameCacheKey(productId), serviceName.trim());
    }
  } catch {
    // ignore
  }
}

export async function enrichAdminManagedProducts(
  items: AdminManagedVendorProduct[]
): Promise<AdminManagedVendorProduct[]> {
  return Promise.all(
    items.map(async (item) => {
      const id = String(item.vendor_product_id || item.id).trim();
      if (!id) return item;

      let listing_type = item.listing_type;
      let service_id = item.service_id;
      let service_name = item.service_name;

      try {
        const [listingRaw, serviceRaw, serviceNameRaw] = await Promise.all([
          AsyncStorage.getItem(listingTypeKey(id)),
          AsyncStorage.getItem(vendorProductServiceCacheKey(id)),
          AsyncStorage.getItem(vendorProductServiceNameCacheKey(id)),
        ]);

        const cachedServiceId =
          serviceRaw != null ? Number(serviceRaw) : NaN;
        const hasCachedService =
          Number.isFinite(cachedServiceId) && cachedServiceId > 0;

        if (listingRaw === 'service' || hasCachedService) {
          listing_type = 'service';
          if (hasCachedService) service_id = cachedServiceId;
          if (serviceNameRaw?.trim()) service_name = serviceNameRaw.trim();
        } else if (listingRaw === 'product') {
          listing_type = 'product';
        }
      } catch {
        // keep API values
      }

      if (
        listing_type === item.listing_type &&
        service_id === item.service_id &&
        service_name === item.service_name
      ) {
        return item;
      }

      return { ...item, listing_type, service_id, service_name };
    })
  );
}

async function hasCachedListingTypeDecision(id: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(listingTypeKey(id));
    return raw === 'product' || raw === 'service';
  } catch {
    return false;
  }
}

/** When management list omits service_id, load detail once and cache product vs service. */
export async function reconcileAdminManagedProductListingTypes(
  vendorId: string,
  items: AdminManagedVendorProduct[]
): Promise<AdminManagedVendorProduct[]> {
  if (!vendorId.trim() || items.length === 0) return items;

  const patchById = new Map<string, AdminManagedVendorProduct>();

  await Promise.all(
    items.map(async (item) => {
      if (item.listing_type === 'service' && item.service_id) return;

      const id = String(item.vendor_product_id || item.id).trim();
      if (!id) return;

      if (await hasCachedListingTypeDecision(id)) return;

      try {
        const detail = await adminVendorManagementService.getVendorProduct(vendorId, id);
        const serviceId =
          detail.service_id ??
          (detail.service_ids?.length ? detail.service_ids[0] : undefined);
        const hasService =
          serviceId != null && serviceId > 0
            ? true
            : Boolean(detail.service?.trim() && detail.service !== '—');

        if (hasService) {
          const serviceName =
            detail.service?.trim() && detail.service !== '—' ? detail.service.trim() : undefined;
          await writeAdminVendorListingType(id, 'service');
          if (serviceId != null && serviceId > 0) {
            await writeCachedProductServiceId(id, serviceId, serviceName);
          }
          patchById.set(item.id, {
            ...item,
            listing_type: 'service',
            service_id: serviceId ?? item.service_id,
            service_name: serviceName ?? item.service_name,
          });
          return;
        }

        await writeAdminVendorListingType(id, 'product');
      } catch {
        // ignore — keep list row as-is
      }
    })
  );

  if (patchById.size === 0) return items;
  return items.map((row) => patchById.get(row.id) ?? row);
}
