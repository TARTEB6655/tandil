import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { buildFullImageUrl } from '../../config/api';
import { getProductImageUri } from '../../utils/productImage';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { adminService, AdminProduct, AdminCategory, AdminService } from '../../services/adminService';
import { setPendingProductImage } from './pendingProductImage';
import { compressImageForUpload, compressImagesForUpload } from '../../utils/compressImage';

const STATUS_VALUES = ['active', 'draft', 'archived'] as const;
const WEIGHT_VALUES = ['kg', 'g', 'lb', 'oz'] as const;

const CurrentProductImage: React.FC<{
  uri: string;
  couldNotLoadLabel?: string;
  noImageLabel?: string;
}> = ({ uri, couldNotLoadLabel = 'Could not load', noImageLabel = 'No image' }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={[styles.thumbWrap, styles.currentImagePlaceholder]}>
        <Ionicons name="broken-image-outline" size={32} color={COLORS.textSecondary} />
        <Text style={styles.placeholderLabel}>{couldNotLoadLabel}</Text>
      </View>
    );
  }
  return (
    <View style={styles.thumbWrap}>
      <Image
        source={{ uri }}
        style={styles.thumb}
        contentFit="cover"
        cachePolicy="disk"
        onError={() => setFailed(true)}
      />
    </View>
  );
};

type AdminEditProductParams = { product: AdminProduct };

const AdminEditProductScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: AdminEditProductParams }, 'params'>>();
  const initialProduct = route.params?.product;
  const productId = initialProduct?.id;
  const [productDetails, setProductDetails] = useState<AdminProduct | null>(initialProduct ?? null);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [imageFetchKey, setImageFetchKey] = useState(() => Date.now());

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [status, setStatus] = useState('active');
  const [categoryId, setCategoryId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [isFeatured, setIsFeatured] = useState(false); // 0 = no, 1 = yes
  const [sku, setSku] = useState('');
  const [handle, setHandle] = useState('');
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [jobDuration, setJobDuration] = useState('');
  const [mainImage, setMainImage] = useState<{ uri: string } | null>(null);
  const [extraImages, setExtraImages] = useState<{ uri: string }[]>([]);
  const [removedGalleryImageIds, setRemovedGalleryImageIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showWeightUnitDropdown, setShowWeightUnitDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [pickingMain, setPickingMain] = useState(false);
  const [pickingExtra, setPickingExtra] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await adminService.getCategories({ page: 1, per_page: 100 });
      const list = Array.isArray(res.data) ? res.data : (res.data as any)?.data ?? [];
      setCategories(Array.isArray(list) ? list : []);
    } catch (_) {
      setCategories([]);
    }
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      const res = await adminService.getServices({ page: 1, per_page: 100 });
      const list = Array.isArray(res.data) ? res.data : (res as any)?.data ?? [];
      setServices(Array.isArray(list) ? list : []);
    } catch (_) {
      setServices([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchCategories(); fetchServices(); }, [fetchCategories, fetchServices]));

  const categoryOptions = useMemo(
    () => [
      { value: '', label: t('admin.editProduct.noCategory') },
      ...categories.map((c) => ({ value: String(c.id), label: c.name })),
    ],
    [categories, t]
  );

  const serviceOptions = useMemo(
    () => [
      { value: '', label: t('admin.editProduct.noService') },
      ...services.map((s) => ({ value: String(s.id), label: s.name })),
    ],
    [services, t]
  );

  const statusOptions = useMemo(
    () =>
      STATUS_VALUES.map((v) => ({
        value: v,
        label: t(`admin.editProduct.status.${v}`),
      })),
    [t]
  );

  const weightUnitOptions = useMemo(
    () =>
      WEIGHT_VALUES.map((v) => ({
        value: v,
        label: t(`admin.editProduct.weightUnits.${v}`),
      })),
    [t]
  );

  useEffect(() => {
    if (!productDetails || hasUserEdited) return;
    setName(productDetails.name ?? '');
    setDescription(productDetails.description ?? '');
    setPrice(
      typeof productDetails.price === 'string'
        ? productDetails.price
        : String(productDetails.price ?? '')
    );
    setStock(String(productDetails.stock ?? ''));
    setStatus((productDetails.status as string) ?? 'active');
    setCategoryId(productDetails.category_id != null ? String(productDetails.category_id) : '');
    setServiceId(productDetails.service_id != null ? String(productDetails.service_id) : '');
    setWeightUnit(productDetails.weight_unit ?? 'kg');
    // API may return is_featured as 1, "1", or boolean – treat as featured when truthy/1
    const raw = (productDetails as any)?.is_featured;
    setIsFeatured(Number(raw) === 1 || raw === true);
    setSku(productDetails.sku ?? '');
    setHandle(productDetails.handle ?? '');
    setEstimatedArrival(
      productDetails.estimated_arrival != null ? String(productDetails.estimated_arrival) : ''
    );
    setJobDuration(productDetails.job_duration != null ? String(productDetails.job_duration) : '');
  }, [productDetails, hasUserEdited]);

  useFocusEffect(
    React.useCallback(() => {
      if (!productId) return;
      let alive = true;
      setLoadingProduct(true);
      adminService
        .getProductById(productId)
        .then((res) => {
          if (!alive) return;
          // Response shape can vary:
          // - { id, ...product }
          // - { status/success, data: { id, ...product } }
          // - { status/success, data: { data: { id, ...product } } }
          const candidate =
            (res as any)?.id != null ? (res as any) :
            (res as any)?.data?.id != null ? (res as any).data :
            (res as any)?.data?.data?.id != null ? (res as any).data.data :
            null;
          if (candidate) {
            setProductDetails(candidate);
            setImageFetchKey(Date.now());
            setRemovedGalleryImageIds([]);
          }
        })
        .catch(() => {
          // Ignore: we still have initialProduct from navigation
        })
        .finally(() => {
          if (alive) setLoadingProduct(false);
        });
      return () => {
        alive = false;
      };
    }, [productId])
  );

  const pickMainImageFromDevice = async () => {
    if (pickingMain) return;
    setPickingMain(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('admin.editProduct.permissionNeeded'), t('admin.editProduct.permissionMessageMain'), [{ text: 'OK' }]);
        return;
      }
      if (typeof ImagePicker.launchImageLibraryAsync !== 'function') {
        Alert.alert(t('admin.editProduct.notAvailable'), t('admin.editProduct.notAvailableMessage'), [{ text: 'OK' }]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        const uri = await compressImageForUpload(result.assets[0].uri);
        setMainImage({ uri });
      }
    } catch (err: any) {
      Alert.alert(t('admin.editProduct.unableToOpenPhotos'), err?.message ?? t('admin.editProduct.unableToOpenPhotos'), [{ text: 'OK' }]);
    } finally {
      setPickingMain(false);
    }
  };

  const pickExtraImagesFromDevice = async () => {
    if (pickingExtra) return;
    setPickingExtra(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('admin.editProduct.permissionNeeded'), t('admin.editProduct.permissionMessageExtra'), [{ text: 'OK' }]);
        return;
      }
      if (typeof ImagePicker.launchImageLibraryAsync !== 'function') {
        Alert.alert(t('admin.editProduct.notAvailable'), t('admin.editProduct.notAvailableMessage'), [{ text: 'OK' }]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        const uris = await compressImagesForUpload(result.assets!.map((a) => a.uri));
        setExtraImages((prev) => [...prev, ...uris.map((uri) => ({ uri }))]);
      }
    } catch (err: any) {
      Alert.alert(t('admin.editProduct.unableToOpenPhotos'), err?.message ?? t('admin.editProduct.unableToOpenPhotos'), [{ text: 'OK' }]);
    } finally {
      setPickingExtra(false);
    }
  };

  const removeMainImage = () => setMainImage(null);
  const removeExtraImage = (index: number) => {
    setExtraImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingGalleryImage = (imageId: number) => {
    setRemovedGalleryImageIds((prev) => (prev.includes(imageId) ? prev : [...prev, imageId]));
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!name.trim()) newErrors.name = t('admin.editProduct.errorNameRequired');
    const priceNum = parseFloat(price);
    if (!price.trim()) newErrors.price = t('admin.editProduct.errorPriceRequired');
    else if (isNaN(priceNum) || priceNum < 0) newErrors.price = t('admin.editProduct.errorPriceInvalid');
    const stockNum = parseInt(stock, 10);
    if (!stock.trim()) newErrors.stock = t('admin.editProduct.errorStockRequired');
    else if (isNaN(stockNum) || stockNum < 0) newErrors.stock = t('admin.editProduct.errorStockInvalid');
    if (!status) newErrors.status = t('admin.editProduct.errorStatusRequired');
    if (!sku.trim()) newErrors.sku = t('admin.editProduct.errorSkuRequired');
    if (!handle.trim()) newErrors.handle = t('admin.editProduct.errorHandleRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdateProduct = async () => {
    if (!productId) {
      Alert.alert(t('admin.users.error'), t('admin.editProduct.productNotFound'));
      return;
    }
    if (!validateForm()) {
      Alert.alert(
        t('admin.editProduct.missingFieldsTitle'),
        t('admin.editProduct.missingFieldsMessage'),
        [{ text: 'OK' }]
      );
      return;
    }

    setLoading(true);
    try {
      const categoryIdNum = categoryId.trim() ? parseInt(categoryId, 10) : undefined;
      const serviceIdNum = serviceId.trim() ? parseInt(serviceId, 10) : undefined;
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: parseFloat(price),
        stock: parseInt(stock, 10),
        status,
        category_id: categoryIdNum ?? null,
        service_id: serviceIdNum ?? null,
        weight_unit: weightUnit,
        is_featured: isFeatured ? 1 : 0,
        sku: sku.trim(),
        handle: handle.trim(),
        estimated_arrival: estimatedArrival.trim(),
        job_duration: jobDuration.trim(),
        image_ids_to_remove: removedGalleryImageIds.length > 0 ? removedGalleryImageIds : undefined,
      };

      const hasMainFile = mainImage != null;
      const hasExtraFiles = extraImages.length > 0;
      let updatedData: {
        image_url?: string;
        image?: string;
        primary_image?: { image_url?: string; image_path?: string };
        main_image?: { image_url?: string; image_path?: string };
        images?: Array<{ image_url?: string; image_path?: string }>;
        gallery_images?: Array<{ image_url?: string; image_path?: string }>;
      } | undefined;

      if (hasMainFile || hasExtraFiles) {
        const res = await adminService.updateProductWithImages(productId, {
          ...payload,
          image_ids_to_remove: removedGalleryImageIds.length > 0 ? removedGalleryImageIds : undefined,
          mainImage: mainImage ?? undefined,
          extraImages: extraImages.map((i) => ({ uri: i.uri })),
        });
        updatedData = res.data;
      } else {
        const res = await adminService.updateProduct(productId, payload);
        updatedData = res.data;
      }

      const rawImageUrl =
        (typeof updatedData?.image_url === 'string' && updatedData.image_url.trim() ? updatedData.image_url : null) ??
        (typeof updatedData?.primary_image?.image_url === 'string' && updatedData.primary_image.image_url.trim() ? updatedData.primary_image.image_url : null) ??
        (typeof updatedData?.main_image?.image_url === 'string' && updatedData.main_image.image_url.trim() ? updatedData.main_image.image_url : null) ??
        (updatedData?.images?.length && typeof updatedData.images[0]?.image_url === 'string' ? updatedData.images[0].image_url : null) ??
        (updatedData?.gallery_images?.length && typeof updatedData.gallery_images[0]?.image_url === 'string' ? updatedData.gallery_images[0].image_url : null) ??
        (typeof updatedData?.image === 'string' && updatedData.image.trim() ? updatedData.image : null) ??
        (typeof updatedData?.primary_image?.image_path === 'string' ? updatedData.primary_image.image_path : null) ??
        (typeof updatedData?.main_image?.image_path === 'string' ? updatedData.main_image.image_path : null) ??
        (updatedData?.images?.[0]?.image_path ?? null) ??
        (updatedData?.gallery_images?.[0]?.image_path ?? null);
      if (rawImageUrl) {
        const fullUrl = buildFullImageUrl(rawImageUrl);
        Image.prefetch(fullUrl, { cachePolicy: 'disk' }).catch(() => {});
      }

      if (mainImage) {
        setPendingProductImage(productId, mainImage.uri);
      }

      // Keep local productDetails in sync with saved is_featured so toggle state is correct
      setProductDetails((prev) =>
        prev ? { ...prev, is_featured: isFeatured ? 1 : 0 } : prev
      );

      Alert.alert(
        t('admin.users.success'),
        t('admin.editProduct.success'),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        t('admin.editProduct.updateFailed');
      if (err.response?.data?.errors) {
        const apiErrors: { [key: string]: string } = {};
        Object.keys(err.response.data.errors).forEach((key) => {
          apiErrors[key] = err.response.data.errors[key][0];
        });
        setErrors(apiErrors);
      } else {
        Alert.alert(t('admin.users.error'), errorMessage);
      }
    } finally {
      setLoading(false);
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
        style={[styles.dropdown, show && styles.dropdownOpen, error && styles.dropdownError]}
        onPress={onToggle}
      >
        <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
          {options.find((o) => o.value === value)?.label || label}
        </Text>
        <Ionicons name={show ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {show && (
        <Modal transparent visible={show} animationType="fade" onRequestClose={onToggle}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onToggle}>
            <View style={styles.dropdownListWrap} onStartShouldSetResponder={() => true}>
              <View style={styles.dropdownList}>
                <Text style={styles.dropdownListTitle} numberOfLines={1}>
                  {label}
                </Text>
                <ScrollView
                  style={styles.dropdownScroll}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                >
                  {options.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.dropdownItem, value === opt.value && styles.dropdownItemSelected]}
                      onPress={() => {
                        onSelect(opt.value);
                        onToggle();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dropdownItemText, value === opt.value && styles.dropdownItemTextSelected]} numberOfLines={1}>
                        {opt.label}
                      </Text>
                      {value === opt.value ? (
                        <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );

  const existingMainUri = (() => {
    const base = productDetails ? getProductImageUri(productDetails) : null;
    if (!base) return null;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}fk=${imageFetchKey}`;
  })();
  type ExtraImageItem = { uri: string; id?: number };
  const existingExtraItems: ExtraImageItem[] = (() => {
    if (!productDetails) return [];
    const pd = productDetails as Record<string, unknown>;
    const cacheBuster =
      (productDetails as any)?.updated_at ??
      (productDetails as any)?.primary_image?.updated_at ??
      (productDetails as any)?.primary_image?.id ??
      (productDetails as any)?.main_image?.updated_at ??
      (productDetails as any)?.main_image?.id ??
      null;
    const imagesArr = (pd['images'] ?? pd['gallery_images']) as Array<{ id?: number; image_url?: string; image_path?: string; is_primary?: number }> | undefined;
    if (!Array.isArray(imagesArr) || imagesArr.length === 0) return [];
    const nonPrimary =
      pd['gallery_images'] != null
        ? imagesArr
        : imagesArr.filter((i) => i.is_primary !== 1 && i.is_primary !== true);
    const sep = (url: string) => (url.includes('?') ? '&' : '?');
    return nonPrimary
      .filter((i) => i.id == null || !removedGalleryImageIds.includes(i.id))
      .map((i) => {
        const raw = (typeof i.image_url === 'string' && i.image_url.trim() ? i.image_url : null) ?? (typeof i.image_path === 'string' ? i.image_path : null);
        if (!raw) return null;
        const url = buildFullImageUrl(raw);
        const v = cacheBuster ? `${url}${sep(url)}v=${encodeURIComponent(String(cacheBuster))}` : url;
        return { uri: `${v}${sep(v)}fk=${imageFetchKey}`, id: i.id };
      })
      .filter((x): x is ExtraImageItem => x != null);
  })();

  if (!productId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('admin.editProduct.title')}</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={styles.errorText}>{t('admin.editProduct.productNotFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.editProduct.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.editProduct.productDetails')}</Text>

            <Input
              label={t('admin.editProduct.nameLabel')}
              placeholder={t('admin.editProduct.namePlaceholder')}
              value={name}
              onChangeText={(txt) => { setName(txt); if (errors.name) setErrors({ ...errors, name: '' }); }}
              leftIcon="pricetag-outline"
              error={errors.name}
            />
            <Input
              label={t('admin.editProduct.descriptionLabel')}
              placeholder={t('admin.editProduct.descriptionPlaceholder')}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              error={errors.description}
            />
            <Input
              label={t('admin.editProduct.priceLabel')}
              placeholder={t('admin.editProduct.pricePlaceholder')}
              value={price}
              onChangeText={(txt) => { setPrice(txt); if (errors.price) setErrors({ ...errors, price: '' }); }}
              keyboardType="numeric"
              leftIcon="cash-outline"
              error={errors.price}
            />
            <Input
              label={t('admin.editProduct.stockLabel')}
              placeholder={t('admin.editProduct.stockPlaceholder')}
              value={stock}
              onChangeText={(txt) => { setStock(txt); if (errors.stock) setErrors({ ...errors, stock: '' }); }}
              keyboardType="number-pad"
              leftIcon="cube-outline"
              error={errors.stock}
            />
            {renderDropdown(
              t('admin.editProduct.statusLabel'),
              status,
              statusOptions,
              showStatusDropdown,
              () => setShowStatusDropdown((v) => !v),
              (v) => { setStatus(v); if (errors.status) setErrors({ ...errors, status: '' }); },
              errors.status
            )}
            {renderDropdown(
              t('admin.editProduct.categoryLabel'),
              categoryId,
              categoryOptions,
              showCategoryDropdown,
              () => setShowCategoryDropdown((v) => !v),
              (v) => { setCategoryId(v); if (errors.category_id) setErrors({ ...errors, category_id: '' }); },
              errors.category_id
            )}
            {renderDropdown(
              t('admin.editProduct.serviceLabel'),
              serviceId,
              serviceOptions,
              showServiceDropdown,
              () => setShowServiceDropdown((v) => !v),
              (v) => { setServiceId(v); if (errors.service_id) setErrors({ ...errors, service_id: '' }); },
              errors.service_id
            )}
            {renderDropdown(
              t('admin.editProduct.weightUnitLabel'),
              weightUnit,
              weightUnitOptions,
              showWeightUnitDropdown,
              () => setShowWeightUnitDropdown((v) => !v),
              setWeightUnit
            )}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('admin.editProduct.featuredLabel')}</Text>
              <Switch
                value={isFeatured}
                onValueChange={(value) => {
                  setIsFeatured(value);
                  setHasUserEdited(true);
                }}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '99' }}
                thumbColor={isFeatured ? COLORS.primary : COLORS.textSecondary}
              />
            </View>
            <Input
              label={t('admin.editProduct.skuLabel')}
              placeholder={t('admin.editProduct.skuPlaceholder')}
              value={sku}
              onChangeText={(txt) => { setSku(txt); if (errors.sku) setErrors({ ...errors, sku: '' }); }}
              error={errors.sku}
            />
            <Input
              label={t('admin.editProduct.handleLabel')}
              placeholder={t('admin.editProduct.handlePlaceholder')}
              value={handle}
              onChangeText={(txt) => { setHandle(txt); if (errors.handle) setErrors({ ...errors, handle: '' }); }}
              autoCapitalize="none"
              error={errors.handle}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.serviceTimingCard}>
              <Text style={styles.serviceTimingTitle}>
                {t('admin.addProduct.serviceTimingTitle')}
              </Text>
              <Text style={styles.serviceTimingHint}>
                {t('admin.addProduct.serviceTimingHint')}
              </Text>
              <View style={styles.serviceTimingRow}>
                <View style={styles.serviceTimingField}>
                  <Input
                    label={t('admin.addProduct.estimatedArrivalLabel')}
                    placeholder={t('admin.addProduct.estimatedArrivalPlaceholder')}
                    value={estimatedArrival}
                    onChangeText={setEstimatedArrival}
                  />
                </View>
                <View style={styles.serviceTimingField}>
                  <Input
                    label={t('admin.addProduct.jobDurationLabel')}
                    placeholder={t('admin.addProduct.jobDurationPlaceholder')}
                    value={jobDuration}
                    onChangeText={setJobDuration}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.editProduct.mainImageTitle')}</Text>
            <Text style={styles.uploadedHint}>{t('admin.editProduct.mainImageHint')}</Text>
            {!mainImage && (
              <View style={styles.uploadedPreviewWrap}>
                <Text style={styles.uploadedLabel}>{t('admin.editProduct.currentMainImage')}</Text>
                {existingMainUri ? (
                  <CurrentProductImage
                    uri={existingMainUri}
                    couldNotLoadLabel={t('admin.editProduct.couldNotLoad')}
                    noImageLabel={t('admin.editProduct.noImage')}
                  />
                ) : (
                  <View style={[styles.thumbWrap, styles.currentImagePlaceholder]}>
                    <Ionicons name="image-outline" size={32} color={COLORS.textSecondary} />
                    <Text style={styles.placeholderLabel}>{t('admin.editProduct.noImage')}</Text>
                  </View>
                )}
              </View>
            )}
            <TouchableOpacity
              style={[styles.uploadFromDeviceBtn, pickingMain && styles.uploadFromDeviceBtnDisabled]}
              onPress={pickMainImageFromDevice}
              disabled={pickingMain}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="image-outline" size={24} color={COLORS.primary} />
              <Text style={styles.uploadFromDeviceText}>
                {pickingMain ? t('admin.editProduct.opening') : t('admin.editProduct.uploadFromDevice')}
              </Text>
            </TouchableOpacity>
            {mainImage && (
              <View style={styles.uploadedPreviewWrap}>
                <View style={[styles.thumbWrap, styles.primaryThumbWrap]}>
                  <Image source={{ uri: mainImage.uri }} style={styles.thumb} contentFit="cover" />
                  <View style={styles.primaryBadge}>
                    <Ionicons name="star" size={12} color={COLORS.background} />
                    <Text style={styles.primaryBadgeText}>{t('admin.editProduct.mainBadge')}</Text>
                  </View>
                  <TouchableOpacity style={styles.thumbRemove} onPress={removeMainImage}>
                    <Ionicons name="close-circle" size={24} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.editProduct.extraImagesTitle')}</Text>
            <Text style={styles.uploadedHint}>{t('admin.editProduct.extraImagesHint')}</Text>
            {extraImages.length === 0 && existingExtraItems.length > 0 && (
              <View style={styles.extraImagesCard}>
                <Text style={styles.extraImagesCardTitle}>{t('admin.editProduct.currentGalleryImages')}</Text>
                <View style={styles.extraImagesGrid}>
                  {existingExtraItems.map((item, index) => (
                    <View key={item.id ?? index} style={styles.extraImageCard}>
                      <CurrentProductImage
                        uri={item.uri}
                        couldNotLoadLabel={t('admin.editProduct.couldNotLoad')}
                        noImageLabel={t('admin.editProduct.noImage')}
                      />
                      <TouchableOpacity
                        style={styles.extraImageRemoveBtn}
                        onPress={() => item.id != null && removeExistingGalleryImage(item.id)}
                      >
                        <Ionicons name="close-circle" size={26} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}
            <TouchableOpacity
              style={[styles.uploadFromDeviceBtn, pickingExtra && styles.uploadFromDeviceBtnDisabled]}
              onPress={pickExtraImagesFromDevice}
              disabled={pickingExtra}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="images-outline" size={24} color={COLORS.primary} />
              <Text style={styles.uploadFromDeviceText}>
                {pickingExtra ? t('admin.editProduct.opening') : t('admin.editProduct.uploadFromDevice')}
              </Text>
            </TouchableOpacity>
            {extraImages.length > 0 && (
              <View style={styles.uploadedPreviewWrap}>
                <Text style={styles.uploadedLabel}>{t('admin.editProduct.newExtraImages')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbScroll}>
                  {extraImages.map((img, index) => (
                    <View key={index} style={styles.thumbWrap}>
                      <Image source={{ uri: img.uri }} style={styles.thumb} contentFit="cover" />
                      <TouchableOpacity style={styles.thumbRemove} onPress={() => removeExtraImage(index)}>
                        <Ionicons name="close-circle" size={24} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <Button
            title={t('admin.editProduct.updateProduct')}
            onPress={handleUpdateProduct}
            disabled={loading}
            loading={loading}
            style={styles.submitButton}
          />
          <View style={styles.bottomPad} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: { padding: SPACING.xs },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  headerRight: { width: 40 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg },
  section: { marginBottom: SPACING.xl },
  serviceTimingCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
  },
  serviceTimingTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  serviceTimingHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  serviceTimingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  serviceTimingField: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  dropdownWrapper: { marginBottom: SPACING.md },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  switchLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
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
  dropdownText: { fontSize: FONT_SIZES.md, color: COLORS.text },
  dropdownPlaceholder: { color: COLORS.textSecondary },
  dropdownListWrap: {
    width: '100%',
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownList: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    width: '100%',
    maxWidth: 340,
    maxHeight: 320,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  dropdownListTitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  dropdownScroll: {
    maxHeight: 272,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  dropdownItemSelected: { backgroundColor: COLORS.primary + '18' },
  dropdownItemText: { fontSize: FONT_SIZES.md, color: COLORS.text, flex: 1 },
  dropdownItemTextSelected: { fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.primary },
  errorText: { fontSize: FONT_SIZES.xs, color: COLORS.error, marginTop: SPACING.xs },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  uploadRow: { marginBottom: SPACING.md },
  uploadFromDeviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  uploadFromDeviceBtnDisabled: { opacity: 0.6 },
  uploadFromDeviceText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  uploadedPreviewWrap: { marginTop: SPACING.sm },
  uploadedLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  uploadedHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  thumbScroll: { marginHorizontal: -SPACING.lg },
  extraImagesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  extraImagesCardTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  extraImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  extraImageCard: {
    width: 88,
    position: 'relative',
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  extraImageRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.background,
    borderRadius: 14,
  },
  thumbWrap: {
    width: 80,
    height: 80,
    marginRight: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  currentImagePlaceholder: {
    backgroundColor: COLORS.border + '40',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  placeholderLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  primaryThumbWrap: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  setPrimaryBtn: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: COLORS.background,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  setPrimaryBtnText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  imageUrlsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  addUrlBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  addUrlText: { fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: FONT_WEIGHTS.medium },
  imageUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  urlInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  removeUrlBtn: { padding: SPACING.xs },
  submitButton: { marginTop: SPACING.md },
  bottomPad: { height: SPACING.xl * 2 },
});

export default AdminEditProductScreen;
