/**
 * Admin add / edit vendor product for a specific vendor.
 * Params: vendorId, vendorName?, mode?: 'add' | 'edit', productId?, listingType?: 'product' | 'service'
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { adminService, AdminCategory, AdminService } from '../../services/adminService';
import {
  adminVendorManagementService,
} from '../../services/adminVendorManagementService';
import {
  vendorService,
  type VendorProductDetail,
  type CreateVendorProductParams,
} from '../../services/vendorService';
import {
  catalogImagePickerOptions,
  compressCatalogImageForUpload,
  compressCatalogImagesForUpload,
  ImageTooLargeError,
} from '../../utils/compressImage';
import { hasLocalOptionImageUploads, isLocalImageUri } from '../../utils/adminProductOptions';
import ProductCustomizationBuilder from '../../components/admin/ProductCustomizationBuilder';
import type { ProductCustomizationConfig } from '../../types/productCustomization';
import { setProductCustomization } from '../../services/productCustomizationService';
import {
  writeAdminVendorListingType,
  writeCachedProductServiceId as writeCachedProductServiceIdShared,
  vendorProductServiceCacheKey,
} from '../../utils/adminVendorProductListingCache';

const STATUS_VALUES = ['active', 'draft', 'archived'] as const;
const WEIGHT_UNITS = ['kg', 'g', 'lb', 'oz'] as const;
const SCREEN_BG = COLORS.surfaceLight;

const vendorProductCategoryCacheKey = (id: string) => `@admin_vendor_product_category:${id}`;

function inferVendorListingType(
  detail: VendorProductDetail,
  fallback: 'product' | 'service'
): 'product' | 'service' {
  const hasService =
    (detail.service_ids?.length ?? 0) > 0 ||
    (detail.service_id != null && detail.service_id > 0) ||
    Boolean(detail.service?.trim() && detail.service !== '—');
  if (hasService) return 'service';
  if (detail.category_id != null && detail.category_id > 0) return 'product';
  return fallback;
}

async function readCachedProductCategoryId(productId: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(vendorProductCategoryCacheKey(productId));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function writeCachedProductCategoryId(productId: string, categoryId: number): Promise<void> {
  try {
    await AsyncStorage.setItem(vendorProductCategoryCacheKey(productId), String(categoryId));
  } catch {
    // ignore
  }
}

async function readCachedProductServiceId(productId: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(vendorProductServiceCacheKey(productId));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

const AdminVendorProductFormScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const vendorId = String(route.params?.vendorId ?? '').trim();
  const vendorName = route.params?.vendorName as string | undefined;
  const mode: 'add' | 'edit' = route.params?.mode === 'edit' ? 'edit' : 'add';
  const productId =
    route.params?.productId != null ? String(route.params.productId).trim() : '';
  const initialCategoryIdParam = route.params?.initialCategoryId;
  const initialCategoryNameParam = route.params?.initialCategoryName as string | undefined;
  const initialServiceIdParam = route.params?.initialServiceId;
  const initialServiceNameParam = route.params?.initialServiceName as string | undefined;
  const initialSkuParam = route.params?.initialSku as string | undefined;
  const initialHandleParam = route.params?.initialHandle as string | undefined;
  const initialListingTypeParam =
    route.params?.listingType === 'service' ? 'service' : 'product';

  const isEdit = mode === 'edit' && Boolean(productId);
  const scrollRef = useRef<ScrollView>(null);

  const [listingType, setListingType] = useState<'product' | 'service'>(initialListingTypeParam);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [status, setStatus] = useState('active');
  const [categoryId, setCategoryId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [isFeatured, setIsFeatured] = useState(false);
  const [sku, setSku] = useState('');
  const [handle, setHandle] = useState('');
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [jobDuration, setJobDuration] = useState('');
  const [mainImage, setMainImage] = useState<{ uri: string; id?: number } | null>(null);
  const [extraImages, setExtraImages] = useState<{ uri: string; id?: number }[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<number[]>([]);
  const [removeMainImageFlag, setRemoveMainImageFlag] = useState(false);
  const [customizationConfig, setCustomizationConfig] = useState<ProductCustomizationConfig>({
    groups: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showWeightUnitDropdown, setShowWeightUnitDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [pickingMain, setPickingMain] = useState(false);
  const [pickingExtra, setPickingExtra] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isProductListing = listingType === 'product';

  const alignDetailCategoryWithPlatform = (
    detail: VendorProductDetail,
    platformCategories: Awaited<
      ReturnType<typeof adminVendorManagementService.getVendorPlatformCategories>
    >
  ): VendorProductDetail => {
    let categoryId = detail.category_id;
    const label = detail.category?.trim();
    const hasLabel = Boolean(label && label !== '—');

    if (hasLabel) {
      const normalized = label!.toLowerCase();
      const exact = platformCategories.find((c) => c.name.trim().toLowerCase() === normalized);
      if (exact) categoryId = exact.id;
    }

    if (
      categoryId != null &&
      categoryId > 0 &&
      !platformCategories.some((c) => c.id === categoryId) &&
      hasLabel
    ) {
      const normalized = label!.toLowerCase();
      const byName = platformCategories.find((c) => c.name.trim().toLowerCase() === normalized);
      if (byName) categoryId = byName.id;
    }

    if ((categoryId == null || categoryId <= 0) && hasLabel) {
      const normalized = label!.toLowerCase();
      const byName = platformCategories.find((c) => c.name.trim().toLowerCase() === normalized);
      if (byName) categoryId = byName.id;
    }

    if (categoryId != null && categoryId > 0 && categoryId !== detail.category_id) {
      return { ...detail, category_id: categoryId };
    }
    if ((categoryId == null || categoryId <= 0) && detail.category_id == null) {
      return detail;
    }
    if (categoryId != null && categoryId > 0) {
      return { ...detail, category_id: categoryId };
    }
    return detail;
  };

  /** Vendor marketplace products require platform category ids (not GET /admin/categories). */
  const fetchCategories = useCallback(async () => {
    try {
      const list = await adminVendorManagementService.getVendorPlatformCategories(vendorId);
      const next = list.map((c) => ({ id: c.id, name: c.name } as AdminCategory));
      setCategories((prev) => {
        const extras = prev.filter((p) => !next.some((n) => n.id === p.id));
        return [...next, ...extras];
      });
    } catch {
      setCategories((prev) => (prev.length > 0 ? prev : []));
    }
  }, [vendorId]);

  const fetchServices = useCallback(async () => {
    try {
      const res = await adminService.getServices({ page: 1, per_page: 100 });
      const list = Array.isArray(res.data) ? res.data : (res as { data?: AdminService[] })?.data ?? [];
      setServices(Array.isArray(list) ? list : []);
    } catch {
      try {
        const list = await vendorService.getProductServices();
        setServices(list.map((s) => ({ id: s.id, name: s.name } as AdminService)));
      } catch {
        setServices([]);
      }
    }
  }, []);

  const applyDetailToForm = useCallback(
    (detail: VendorProductDetail, listingFallback: 'product' | 'service' = 'product') => {
    const listing = inferVendorListingType(detail, listingFallback);
    setListingType(listing);
    setName(detail.name);
    setDescription(detail.description ?? '');
    setPrice(String(detail.price ?? ''));
    setStock(String(detail.stock_quantity ?? ''));
    setStatus(detail.product_status ?? 'active');

    const resolvedServiceId =
      detail.service_ids?.[0] != null && detail.service_ids[0] > 0
        ? detail.service_ids[0]
        : detail.service_id != null && detail.service_id > 0
          ? detail.service_id
          : null;

    if (listing === 'service') {
      setCategoryId('');
      if (resolvedServiceId != null) {
        const serviceLabel =
          detail.service && detail.service.trim() && detail.service !== '—'
            ? detail.service.trim()
            : `Service #${resolvedServiceId}`;
        setServices((prev) => {
          if (prev.some((s) => s.id === resolvedServiceId)) return prev;
          return [...prev, { id: resolvedServiceId, name: serviceLabel } as AdminService];
        });
      }
      setServiceId(resolvedServiceId != null ? String(resolvedServiceId) : '');
    } else {
      setServiceId('');
      const resolvedCategoryId =
        detail.category_id != null && detail.category_id > 0 ? detail.category_id : null;
      setCategoryId(resolvedCategoryId != null ? String(resolvedCategoryId) : '');
      if (resolvedCategoryId != null) {
        const label =
          detail.category && detail.category.trim() && detail.category !== '—'
            ? detail.category.trim()
            : `Category #${resolvedCategoryId}`;
        setCategories((prev) => {
          if (prev.some((c) => c.id === resolvedCategoryId)) return prev;
          return [...prev, { id: resolvedCategoryId, name: label, slug: '' } as AdminCategory];
        });
      }
    }
    setWeightUnit(detail.weight_unit ?? 'kg');
    setIsFeatured(Boolean(detail.is_featured));
    setSku(detail.sku ?? '');
    setHandle(detail.handle ?? '');
    setEstimatedArrival(detail.estimated_arrival ?? '');
    setJobDuration(detail.job_duration ?? '');
    const productImages: VendorProductDetail['product_images'] =
      detail.product_images && detail.product_images.length > 0
        ? detail.product_images
        : detail.images.map((uri) => ({ uri }));
    const primary =
      productImages?.find((img) => img.is_primary) ?? productImages?.[0] ?? null;
    const extras = (productImages ?? []).filter((img) => img !== primary && Boolean(img.uri));
    setMainImage(primary?.uri ? { uri: primary.uri, id: primary.id } : null);
    setExtraImages(extras.map((img) => ({ uri: img.uri, id: img.id })));
    setRemovedImageIds([]);
    setRemoveMainImageFlag(false);
    setCustomizationConfig(detail.customization ?? { groups: [] });
    setErrors({});
  },
  []
  );

  const loadProductDetail = useCallback(async () => {
    if (!isEdit || !vendorId || !productId) {
      setLoadingDetail(false);
      return;
    }
    setLoadingDetail(true);
    setLoadError(null);
    try {
      try {
        const res = await adminService.getServices({ page: 1, per_page: 100 });
        const list = Array.isArray(res.data) ? res.data : (res as { data?: AdminService[] })?.data ?? [];
        setServices(Array.isArray(list) ? list : []);
      } catch {
        try {
          const list = await vendorService.getProductServices();
          setServices(list.map((s) => ({ id: s.id, name: s.name } as AdminService)));
        } catch {
          setServices([]);
        }
      }

      const platformCategories =
        await adminVendorManagementService.getVendorPlatformCategories(vendorId);
      setCategories((prev) => {
        const next = platformCategories.map(
          (c) => ({ id: c.id, name: c.name }) as AdminCategory
        );
        const extras = prev.filter((p) => !next.some((n) => n.id === p.id));
        return [...next, ...extras];
      });

      let detail = await adminVendorManagementService.getVendorProduct(vendorId, productId);

      if (!detail.sku?.trim() && initialSkuParam?.trim()) {
        detail = { ...detail, sku: initialSkuParam.trim() };
      }
      if (!detail.handle?.trim() && initialHandleParam?.trim()) {
        detail = { ...detail, handle: initialHandleParam.trim() };
      }

      const routeServiceId =
        initialServiceIdParam != null ? Number(initialServiceIdParam) : NaN;
      if (
        (detail.service_id == null || detail.service_id <= 0) &&
        !(detail.service_ids?.length ?? 0) &&
        Number.isFinite(routeServiceId) &&
        routeServiceId > 0
      ) {
        detail = {
          ...detail,
          service_id: routeServiceId,
          service_ids: [routeServiceId],
          service:
            initialServiceNameParam?.trim() ||
            detail.service ||
            `Service #${routeServiceId}`,
        };
      }

      if (
        (detail.service_id == null || detail.service_id <= 0) &&
        !(detail.service_ids?.length ?? 0)
      ) {
        const cachedServiceId = await readCachedProductServiceId(productId);
        if (cachedServiceId != null) {
          detail = {
            ...detail,
            service_id: cachedServiceId,
            service_ids: [cachedServiceId],
          };
        }
      }

      let listingHint = inferVendorListingType(detail, initialListingTypeParam);

      if (listingHint === 'product') {
        if (detail.category_id == null || detail.category_id <= 0) {
          const cachedCategoryId = await readCachedProductCategoryId(productId);
          if (cachedCategoryId != null) {
            detail = { ...detail, category_id: cachedCategoryId };
          }
        }

        const routeCategoryId =
          initialCategoryIdParam != null ? Number(initialCategoryIdParam) : NaN;
        if (
          (detail.category_id == null || detail.category_id <= 0) &&
          Number.isFinite(routeCategoryId) &&
          routeCategoryId > 0
        ) {
          detail = {
            ...detail,
            category_id: routeCategoryId,
            category:
              initialCategoryNameParam?.trim() ||
              detail.category ||
              `Category #${routeCategoryId}`,
          };
        }

        detail = alignDetailCategoryWithPlatform(detail, platformCategories);
        listingHint = inferVendorListingType(detail, initialListingTypeParam);
      }

      if (listingHint === 'service') {
        detail = { ...detail, category_id: undefined };
      }

      applyDetailToForm(detail, initialListingTypeParam);
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error
          ? err.message
          : t('adminVendorManagement.productForm.loadFailed', { defaultValue: 'Failed to load product.' })
      );
    } finally {
      setLoadingDetail(false);
    }
  }, [
    isEdit,
    vendorId,
    productId,
    applyDetailToForm,
    initialCategoryIdParam,
    initialCategoryNameParam,
    initialServiceIdParam,
    initialServiceNameParam,
    initialListingTypeParam,
    initialSkuParam,
    initialHandleParam,
    t,
  ]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (isEdit) {
          if (!cancelled) {
            await loadProductDetail();
          }
        } else {
          await fetchCategories();
        }
      })();
      fetchServices();
      return () => {
        cancelled = true;
      };
    }, [fetchCategories, fetchServices, isEdit, loadProductDetail])
  );

  const categoryOptions = useMemo(() => {
    const opts = categories.map((c) => ({ value: String(c.id), label: c.name }));
    if (isProductListing) {
      return opts;
    }
    return [{ value: '', label: t('admin.addProduct.noCategory') }, ...opts];
  }, [categories, isProductListing, t]);

  const serviceOptions = useMemo(
    () => [
      { value: '', label: t('admin.addProduct.noService') },
      ...services.map((s) => ({ value: String(s.id), label: s.name })),
    ],
    [services, t]
  );

  const statusOptions = useMemo(
    () =>
      STATUS_VALUES.map((v) => ({
        value: v,
        label: t(`admin.addProduct.status.${v}`),
      })),
    [t]
  );

  const weightUnitOptions = useMemo(
    () =>
      WEIGHT_UNITS.map((v) => ({
        value: v,
        label: t(`admin.addProduct.weightUnits.${v}`),
      })),
    [t]
  );

  const switchListingType = (next: 'product' | 'service') => {
    if (isEdit || next === listingType) return;
    setListingType(next);
    setShowCategoryDropdown(false);
    setShowServiceDropdown(false);
    setErrors((prev) => {
      const { category_id: _c, service_id: _s, ...rest } = prev;
      return rest;
    });
    if (next === 'product') {
      setServiceId('');
    } else {
      setCategoryId('');
    }
  };

  const pickMainImageFromDevice = async () => {
    if (pickingMain) return;
    setPickingMain(true);
    try {
      const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm !== 'granted') {
        Alert.alert('Permission needed', 'Allow access to your photos.', [{ text: 'OK' }]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync(catalogImagePickerOptions());
      if (!result.canceled && result.assets?.[0]) {
        try {
          const uri = await compressCatalogImageForUpload(
            result.assets[0].uri,
            result.assets[0].fileSize
          );
          setMainImage({ uri });
          setRemoveMainImageFlag(false);
        } catch (sizeErr: any) {
          if (sizeErr?.name === 'ImageTooLargeError' || sizeErr instanceof ImageTooLargeError) {
            Alert.alert(
              'Error',
              sizeErr.message ||
                'You can upload an image of up to 5 MB only. Please choose a smaller file.'
            );
            return;
          }
          throw sizeErr;
        }
      }
    } catch (err: unknown) {
      Alert.alert('Unable to open photos', err instanceof Error ? err.message : 'Error', [{ text: 'OK' }]);
    } finally {
      setPickingMain(false);
    }
  };

  const pickExtraImagesFromDevice = async () => {
    if (pickingExtra) return;
    setPickingExtra(true);
    try {
      const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm !== 'granted') {
        Alert.alert('Permission needed', 'Allow access to your photos.', [{ text: 'OK' }]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync(
        catalogImagePickerOptions({ allowsMultipleSelection: true })
      );
      if (!result.canceled && result.assets?.length) {
        try {
          const uris = await compressCatalogImagesForUpload(
            result.assets.map((a) => ({ uri: a.uri, fileSize: a.fileSize }))
          );
          setExtraImages((prev) => [...prev, ...uris.map((uri) => ({ uri }))]);
        } catch (sizeErr: any) {
          if (sizeErr?.name === 'ImageTooLargeError' || sizeErr instanceof ImageTooLargeError) {
            Alert.alert(
              'Error',
              sizeErr.message ||
                'You can upload an image of up to 5 MB only. Please choose a smaller file.'
            );
            return;
          }
          throw sizeErr;
        }
      }
    } catch (err: unknown) {
      Alert.alert('Unable to open photos', err instanceof Error ? err.message : 'Error', [{ text: 'OK' }]);
    } finally {
      setPickingExtra(false);
    }
  };

  const removeMainImage = () => {
    setMainImage((prev) => {
      if (prev && !isLocalImageUri(prev.uri)) {
        setRemoveMainImageFlag(true);
      }
      return null;
    });
  };

  const removeExtraImage = (index: number) => {
    setExtraImages((prev) => {
      const target = prev[index];
      if (target?.id != null) {
        setRemovedImageIds((ids) =>
          ids.includes(target.id!) ? ids : [...ids, target.id!]
        );
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const showValidationErrors = (newErrors: Record<string, string>) => {
    setErrors(newErrors);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    const messages = Object.values(newErrors).filter(Boolean);
    Alert.alert(
      t('admin.addProduct.missingFieldsTitle'),
      messages.length > 0 ? `• ${messages.join('\n• ')}` : t('admin.addProduct.missingFieldsMessage'),
      [{ text: t('common.ok', { defaultValue: 'OK' }) }]
    );
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = t('admin.editProduct.errorNameRequired', { defaultValue: 'Product name is required' });
    const priceNum = parseFloat(price);
    if (!price.trim()) newErrors.price = t('admin.addProduct.errorPriceRequired');
    else if (Number.isNaN(priceNum) || priceNum < 0) newErrors.price = t('admin.addProduct.errorPriceInvalid');
    const stockNum = parseInt(stock, 10);
    if (!stock.trim()) newErrors.stock = t('admin.addProduct.errorStockRequired');
    else if (Number.isNaN(stockNum) || stockNum < 0) newErrors.stock = t('admin.addProduct.errorStockInvalid');
    if (!status) newErrors.status = t('admin.addProduct.errorStatusRequired');
    if (!sku.trim()) newErrors.sku = t('admin.addProduct.errorSkuRequired');
    if (!handle.trim()) newErrors.handle = t('admin.addProduct.errorHandleRequired');
    if (isProductListing && !categoryId.trim()) {
      newErrors.category_id = t('adminVendorManagement.productForm.categoryRequired', {
        defaultValue: 'Category is required',
      });
    }
    if (!isProductListing && !serviceId.trim()) {
      newErrors.service_id = t('vendorAddProduct.errorServiceRequired', {
        defaultValue: 'Please select a service',
      });
    }
    if (Object.keys(newErrors).length > 0) {
      showValidationErrors(newErrors);
      return false;
    }
    return true;
  };

  const buildPayload = (): CreateVendorProductParams => {
    const categoryIdNum = categoryId.trim() ? parseInt(categoryId, 10) : NaN;
    const serviceIdNum = serviceId.trim() ? parseInt(serviceId, 10) : NaN;
    const timingFields = {
      ...(estimatedArrival.trim() ? { estimated_arrival: estimatedArrival.trim() } : {}),
      ...(jobDuration.trim() ? { job_duration: jobDuration.trim() } : {}),
    };
    const base = {
      name: name.trim(),
      description: description.trim() || undefined,
      price: parseFloat(price),
      stock: parseInt(stock, 10),
      status,
      category_id:
        isProductListing && Number.isFinite(categoryIdNum) && categoryIdNum > 0
          ? categoryIdNum
          : null,
      service_id:
        !isProductListing && Number.isFinite(serviceIdNum) && serviceIdNum > 0
          ? serviceIdNum
          : null,
      weight_unit: weightUnit,
      is_featured: isFeatured ? 1 : 0,
      sku: sku.trim(),
      handle: handle.trim(),
      product_type: (customizationConfig.groups.length > 0 ? 'variable' : 'simple') as
        | 'simple'
        | 'variable',
      customization: customizationConfig,
      ...timingFields,
    };

    if (isEdit) {
      const localMainImage =
        mainImage && isLocalImageUri(mainImage.uri) ? { uri: mainImage.uri } : undefined;
      const localExtraImages = extraImages.filter((img) => isLocalImageUri(img.uri));
      const keepImageIds =
        localExtraImages.length === 0
          ? [
              ...extraImages
                .filter((img) => img.id != null && !isLocalImageUri(img.uri))
                .map((img) => img.id!),
              ...(mainImage?.id != null &&
              !isLocalImageUri(mainImage.uri) &&
              !removeMainImageFlag
                ? [mainImage.id]
                : []),
            ].filter((id, index, arr) => arr.indexOf(id) === index)
          : [];

      return {
        ...base,
        mainImage: localMainImage,
        extraImages: localExtraImages.map((img) => ({ uri: img.uri })),
        removed_image_ids: removedImageIds.length > 0 ? removedImageIds : undefined,
        keep_image_ids: keepImageIds.length > 0 ? keepImageIds : undefined,
        remove_main_image: Boolean(removeMainImageFlag && !localMainImage),
      };
    }

    const mainFile =
      mainImage && isLocalImageUri(mainImage.uri)
        ? { uri: mainImage.uri }
        : !mainImage && extraImages[0] && isLocalImageUri(extraImages[0].uri)
          ? { uri: extraImages[0].uri }
          : undefined;
    const extraFiles = (
      mainImage && isLocalImageUri(mainImage.uri)
        ? extraImages
        : mainImage
          ? extraImages
          : extraImages.slice(1)
    ).filter((img) => isLocalImageUri(img.uri));

    return {
      ...base,
      mainImage: mainFile,
      extraImages: extraFiles.map((img) => ({ uri: img.uri })),
    };
  };

  const handleSubmit = async () => {
    if (!vendorId) {
      Alert.alert(t('common.error'), t('adminVendorManagement.missingVendor'));
      return;
    }
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = buildPayload();
      const result = isEdit
        ? await adminVendorManagementService.updateVendorProduct(vendorId, productId, payload)
        : await adminVendorManagementService.createVendorProduct(vendorId, payload);

      const savedId =
        result.product?.vendor_product_id ||
        result.product?.id ||
        (isEdit ? productId : undefined);
      const savedCategoryId = parseInt(categoryId, 10);
      const savedServiceId = parseInt(serviceId, 10);
      if (
        savedId &&
        isProductListing &&
        Number.isFinite(savedCategoryId) &&
        savedCategoryId > 0
      ) {
        void writeCachedProductCategoryId(String(savedId), savedCategoryId);
      }
      if (savedId) {
        void writeAdminVendorListingType(
          String(savedId),
          isProductListing ? 'product' : 'service'
        );
      }
      if (
        savedId &&
        !isProductListing &&
        Number.isFinite(savedServiceId) &&
        savedServiceId > 0
      ) {
        const serviceLabel = services.find((s) => s.id === savedServiceId)?.name;
        void writeCachedProductServiceIdShared(String(savedId), savedServiceId, serviceLabel);
      }
      if (savedId && hasLocalOptionImageUploads(customizationConfig)) {
        try {
          await setProductCustomization(savedId, customizationConfig);
        } catch {
          // optional cache
        }
      }

      Alert.alert(t('common.success', { defaultValue: 'Success' }), result.message, [
        { text: t('common.ok', { defaultValue: 'OK' }), onPress: () => navigation.goBack() },
      ]);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string; errors?: Record<string, string[]> } };
        message?: string;
      };
      const errorMessage =
        axiosErr.response?.data?.message ||
        (err instanceof Error ? err.message : '') ||
        (isEdit
          ? t('adminVendorManagement.productForm.updateFailed', { defaultValue: 'Failed to update product.' })
          : t('adminVendorManagement.productForm.createFailed', { defaultValue: 'Failed to create product.' }));
      if (axiosErr.response?.data?.errors) {
        const apiErrors: Record<string, string> = {};
        Object.keys(axiosErr.response.data.errors).forEach((key) => {
          apiErrors[key] = axiosErr.response!.data!.errors![key][0];
        });
        showValidationErrors(apiErrors);
      } else {
        Alert.alert(t('common.error'), errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  const renderDropdown = (
    label: string,
    value: string,
    options: Array<{ value: string; label: string }>,
    show: boolean,
    onToggle: () => void,
    onSelect: (v: string) => void,
    error?: string
  ) => (
    <View style={styles.dropdownWrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.dropdown, show && styles.dropdownOpen, error ? styles.dropdownError : null]}
        onPress={onToggle}
        activeOpacity={0.85}
      >
        <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]} numberOfLines={1}>
          {options.find((o) => o.value === value)?.label ||
            (value ? `#${value}` : t('admin.addProduct.selectCategory', { defaultValue: 'Select category' }))}
        </Text>
        <Ionicons name={show ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {show ? (
        <Modal transparent visible={show} animationType="fade" onRequestClose={onToggle}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onToggle}>
            <View style={styles.dropdownListWrap} onStartShouldSetResponder={() => true}>
              <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled">
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt.value || '__empty'}
                    style={[styles.dropdownItem, value === opt.value && styles.dropdownItemSelected]}
                    onPress={() => {
                      onSelect(opt.value);
                      onToggle();
                    }}
                  >
                    <Text
                      style={[styles.dropdownItemText, value === opt.value && styles.dropdownItemTextSelected]}
                      numberOfLines={1}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      ) : null}
    </View>
  );

  const screenTitle = isEdit
    ? isProductListing
      ? t('adminVendorManagement.productForm.editTitle', { defaultValue: 'Edit product' })
      : t('adminVendorManagement.productForm.editServiceTitle', { defaultValue: 'Edit service' })
    : isProductListing
      ? t('adminVendorManagement.productForm.addProductTitle', { defaultValue: 'Add product' })
      : t('adminVendorManagement.productForm.addServiceTitle', { defaultValue: 'Add service' });

  if (!vendorId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('adminVendorManagement.missingVendor')}</Text>
      </View>
    );
  }

  if (loadingDetail) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>
          {t('adminVendorManagement.productForm.loadingDetail', { defaultValue: 'Loading…' })}
        </Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity onPress={loadProductDetail}>
          <Text style={styles.retryLink}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <SafeAreaView edges={['top']} style={styles.hero}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>{screenTitle}</Text>
            {vendorName ? (
              <Text style={styles.heroSubtitle} numberOfLines={1}>
                {vendorName}
              </Text>
            ) : null}
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isEdit ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('adminVendorManagement.productForm.listingType', { defaultValue: 'Listing type' })}
              </Text>
              <View style={styles.listingTypeReadonly}>
                <Ionicons
                  name={isProductListing ? 'cube-outline' : 'construct-outline'}
                  size={18}
                  color={COLORS.primary}
                />
                <Text style={styles.listingTypeReadonlyText}>
                  {isProductListing
                    ? t('adminVendorManagement.productForm.product', { defaultValue: 'Product' })
                    : t('adminVendorManagement.productForm.service', { defaultValue: 'Service' })}
                </Text>
              </View>
            </View>
          ) : null}
          {!isEdit ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('adminVendorManagement.productForm.listingType', { defaultValue: 'Listing type' })}
              </Text>
              <View style={styles.listingTypeRow}>
                <TouchableOpacity
                  style={[styles.listingTypeBtn, isProductListing && styles.listingTypeBtnActive]}
                  onPress={() => switchListingType('product')}
                  activeOpacity={0.88}
                >
                  <Ionicons
                    name="cube-outline"
                    size={18}
                    color={isProductListing ? '#fff' : COLORS.textSecondary}
                  />
                  <Text style={[styles.listingTypeText, isProductListing && styles.listingTypeTextActive]}>
                    {t('adminVendorManagement.productForm.product', { defaultValue: 'Product' })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.listingTypeBtn, !isProductListing && styles.listingTypeBtnActive]}
                  onPress={() => switchListingType('service')}
                  activeOpacity={0.88}
                >
                  <Ionicons
                    name="construct-outline"
                    size={18}
                    color={!isProductListing ? '#fff' : COLORS.textSecondary}
                  />
                  <Text style={[styles.listingTypeText, !isProductListing && styles.listingTypeTextActive]}>
                    {t('adminVendorManagement.productForm.service', { defaultValue: 'Service' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.addProduct.productDetails')}</Text>
            <Input
              label={t('admin.addProduct.nameLabel')}
              value={name}
              onChangeText={setName}
              error={errors.name}
              placeholder={t('admin.addProduct.namePlaceholder')}
            />
            <Input
              label={t('admin.addProduct.descriptionLabel')}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              placeholder={t('admin.addProduct.descriptionPlaceholder')}
            />
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Input
                  label={t('admin.addProduct.priceLabel')}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  error={errors.price}
                  placeholder={t('admin.addProduct.pricePlaceholder')}
                />
              </View>
              <View style={styles.halfField}>
                <Input
                  label={t('admin.addProduct.stockLabel')}
                  value={stock}
                  onChangeText={setStock}
                  keyboardType="numeric"
                  error={errors.stock}
                  placeholder={t('admin.addProduct.stockPlaceholder')}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Input
                  label={t('admin.addProduct.skuLabel')}
                  value={sku}
                  onChangeText={setSku}
                  error={errors.sku}
                  placeholder={t('admin.addProduct.skuPlaceholder')}
                />
              </View>
              <View style={styles.halfField}>
                <Input
                  label={t('admin.addProduct.handleLabel')}
                  value={handle}
                  onChangeText={setHandle}
                  error={errors.handle}
                  placeholder={t('admin.addProduct.handlePlaceholder')}
                />
              </View>
            </View>
            {renderDropdown(
              t('admin.addProduct.statusLabel'),
              status,
              statusOptions,
              showStatusDropdown,
              () => setShowStatusDropdown((v) => !v),
              setStatus,
              errors.status
            )}
            {renderDropdown(
              t('admin.addProduct.weightUnitLabel'),
              weightUnit,
              weightUnitOptions,
              showWeightUnitDropdown,
              () => setShowWeightUnitDropdown((v) => !v),
              setWeightUnit
            )}
            {isProductListing
              ? renderDropdown(
                  t('admin.addProduct.categoryLabel'),
                  categoryId,
                  categoryOptions,
                  showCategoryDropdown,
                  () => setShowCategoryDropdown((v) => !v),
                  setCategoryId,
                  errors.category_id
                )
              : null}
            {!isProductListing
              ? renderDropdown(
                  t('admin.addProduct.serviceLabel'),
                  serviceId,
                  serviceOptions,
                  showServiceDropdown,
                  () => setShowServiceDropdown((v) => !v),
                  setServiceId,
                  errors.service_id
                )
              : null}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('admin.addProduct.featuredLabel')}</Text>
              <Switch
                value={isFeatured}
                onValueChange={setIsFeatured}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
                thumbColor={isFeatured ? COLORS.primary : '#f4f3f4'}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.addProduct.serviceTimingTitle')}</Text>
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Input
                  label={t('admin.addProduct.estimatedArrivalLabel')}
                  value={estimatedArrival}
                  onChangeText={setEstimatedArrival}
                  placeholder={t('admin.addProduct.estimatedArrivalPlaceholder')}
                />
              </View>
              <View style={styles.halfField}>
                <Input
                  label={t('admin.addProduct.jobDurationLabel')}
                  value={jobDuration}
                  onChangeText={setJobDuration}
                  placeholder={t('admin.addProduct.jobDurationPlaceholder')}
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.addProduct.customizationTitle')}</Text>
            <ProductCustomizationBuilder value={customizationConfig} onChange={setCustomizationConfig} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.addProduct.mainImageTitle')}</Text>
            <TouchableOpacity
              style={[styles.uploadBtn, pickingMain && styles.uploadBtnDisabled]}
              onPress={pickMainImageFromDevice}
              disabled={pickingMain}
            >
              <Ionicons name="cloud-upload-outline" size={22} color={COLORS.primary} />
              <Text style={styles.uploadBtnText}>
                {pickingMain ? t('admin.addProduct.opening') : t('admin.addProduct.uploadFromDevice')}
              </Text>
            </TouchableOpacity>
            {mainImage ? (
              <View style={styles.thumbWrap}>
                <Image source={{ uri: mainImage.uri }} style={styles.thumb} contentFit="cover" />
                <TouchableOpacity style={styles.thumbRemove} onPress={removeMainImage}>
                  <Ionicons name="close-circle" size={24} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.addProduct.extraImagesTitle')}</Text>
            <TouchableOpacity
              style={[styles.uploadBtn, pickingExtra && styles.uploadBtnDisabled]}
              onPress={pickExtraImagesFromDevice}
              disabled={pickingExtra}
            >
              <Ionicons name="images-outline" size={22} color={COLORS.primary} />
              <Text style={styles.uploadBtnText}>
                {pickingExtra ? t('admin.addProduct.opening') : t('admin.addProduct.uploadFromDevice')}
              </Text>
            </TouchableOpacity>
            {extraImages.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbScroll}>
                {extraImages.map((img, index) => (
                  <View key={`${img.uri}-${index}`} style={styles.thumbWrap}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} contentFit="cover" />
                    <TouchableOpacity style={styles.thumbRemove} onPress={() => removeExtraImage(index)}>
                      <Ionicons name="close-circle" size={24} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <Button
            title={
              isEdit
                ? t('adminVendorManagement.productForm.saveButton', { defaultValue: 'Save changes' })
                : t('adminVendorManagement.productForm.createButton', { defaultValue: 'Create listing' })
            }
            onPress={handleSubmit}
            loading={saving}
            disabled={saving}
            style={styles.submitButton}
          />
          <View style={styles.bottomPad} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SCREEN_BG },
  hero: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: { flex: 1 },
  heroTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: '#fff' },
  heroSubtitle: { fontSize: FONT_SIZES.xs, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  section: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  listingTypeReadonly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  listingTypeReadonlyText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  listingTypeRow: { flexDirection: 'row', gap: SPACING.sm },
  listingTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
  },
  listingTypeBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  listingTypeText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.textSecondary },
  listingTypeTextActive: { color: '#fff' },
  row: { flexDirection: 'row', gap: SPACING.sm },
  halfField: { flex: 1, minWidth: 0 },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  dropdownWrapper: { marginBottom: SPACING.md },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  dropdownOpen: { borderColor: COLORS.primary },
  dropdownError: { borderColor: COLORS.error },
  dropdownText: { fontSize: FONT_SIZES.md, color: COLORS.text, flex: 1 },
  dropdownPlaceholder: { color: COLORS.textSecondary },
  dropdownListWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  dropdownScroll: {
    maxHeight: 320,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dropdownItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  dropdownItemSelected: { backgroundColor: COLORS.primary + '14' },
  dropdownItemText: { fontSize: FONT_SIZES.md, color: COLORS.text },
  dropdownItemTextSelected: { fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.primary },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  switchLabel: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.medium, color: COLORS.text },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surfaceLight,
    marginBottom: SPACING.sm,
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.primary },
  thumbScroll: { marginTop: SPACING.sm },
  thumbWrap: {
    width: 88,
    height: 88,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: { position: 'absolute', top: 4, right: 4 },
  submitButton: { marginTop: SPACING.sm },
  bottomPad: { height: SPACING.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  loadingText: { marginTop: SPACING.md, color: COLORS.textSecondary },
  errorText: { color: COLORS.textSecondary, textAlign: 'center' },
  retryLink: { color: COLORS.primary, marginTop: SPACING.sm, fontWeight: FONT_WEIGHTS.semiBold },
  errorTextField: { fontSize: FONT_SIZES.xs, color: COLORS.error, marginTop: SPACING.xs },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
  },
});

export default AdminVendorProductFormScreen;
