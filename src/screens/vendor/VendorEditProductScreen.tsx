import React, { useState, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import {
  VendorCard,
  VendorHeroBanner,
  VendorPageHeader,
  VENDOR_SCREEN_BG,
} from '../../components/vendor/VendorUi';
import { vendorService, VendorProductDetail } from '../../services/vendorService';
import { compressImageForUpload, compressImagesForUpload } from '../../utils/compressImage';
import { hasLocalOptionImageUploads, isLocalImageUri } from '../../utils/adminProductOptions';
import ProductCustomizationBuilder from '../../components/admin/ProductCustomizationBuilder';
import type { ProductCustomizationConfig } from '../../types/productCustomization';

const STATUS_VALUES = ['active', 'draft', 'archived'] as const;
const WEIGHT_UNITS = ['kg', 'g', 'lb', 'oz'] as const;

function translateProductStatus(
  t: (key: string, options?: Record<string, unknown>) => string,
  raw?: string | null
): string {
  if (!raw?.trim()) return '';
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, '_');
  const keyMap: Record<string, string> = {
    approved: 'vendorEditProduct.statusApproved',
    pending: 'vendorEditProduct.statusPending',
    rejected: 'vendorEditProduct.statusRejected',
    active: 'vendorEditProduct.statusActive',
    inactive: 'vendorEditProduct.statusInactive',
    draft: 'vendorEditProduct.statusDraft',
    archived: 'vendorEditProduct.statusArchived',
  };
  const key = keyMap[normalized];
  return key ? t(key, { defaultValue: raw }) : raw;
}

type CategoryOption = { id: number; name: string };
type ServiceOption = { id: number; name: string };

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={sectionStyles.header}>
      <View style={sectionStyles.iconWrap}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={sectionStyles.textWrap}>
        <Text style={sectionStyles.title}>{title}</Text>
        {subtitle ? <Text style={sectionStyles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
});

const VendorEditProductScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const productId =
    route.params?.productId != null ? String(route.params.productId).trim() : undefined;
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
  const [mainImage, setMainImage] = useState<{ uri: string } | null>(null);
  const [extraImages, setExtraImages] = useState<{ uri: string }[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);
  const [listingStatus, setListingStatus] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showWeightUnitDropdown, setShowWeightUnitDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [pickingMain, setPickingMain] = useState(false);
  const [pickingExtra, setPickingExtra] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [customizationConfig, setCustomizationConfig] = useState<ProductCustomizationConfig>({ groups: [] });

  const fetchCategories = useCallback(async () => {
    try {
      const list = await vendorService.getProductCategories();
      setCategories(list);
    } catch {
      setCategories([]);
    }
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      const list = await vendorService.getProductServices();
      setServices(list);
    } catch {
      setServices([]);
    }
  }, []);

  const applyDetailToForm = useCallback((detail: VendorProductDetail) => {
    setName(detail.name);
    setDescription(detail.description);
    setPrice(String(detail.price));
    setStock(String(detail.stock_quantity));
    setStatus(detail.product_status ?? 'active');
    setCategoryId(detail.category_id != null ? String(detail.category_id) : '');
    setServiceId(detail.service_ids?.[0] != null ? String(detail.service_ids[0]) : '');
    setWeightUnit(detail.weight_unit ?? 'kg');
    setIsFeatured(Boolean(detail.is_featured));
    setSku(detail.sku ?? '');
    setHandle(detail.handle ?? '');
    setEstimatedArrival(detail.estimated_arrival ?? '');
    setJobDuration(detail.job_duration ?? '');
    setApprovalStatus(detail.approval_status ?? null);
    setListingStatus(detail.listing_status ?? null);
    setRejectionReason(detail.rejection_reason ?? null);
    setMainImage(detail.images[0] ? { uri: detail.images[0] } : null);
    setExtraImages(detail.images.slice(1).map((uri) => ({ uri })));
    setCustomizationConfig(detail.customization ?? { groups: [] });
    setErrors({});
  }, []);

  const loadProductDetail = useCallback(async () => {
    if (!productId) {
      setLoadError(t('vendorEditProduct.missingId', { defaultValue: 'Product not found.' }));
      setLoadingDetail(false);
      return;
    }
    setLoadingDetail(true);
    setLoadError(null);
    try {
      const detail = await vendorService.getProductById(productId);
      applyDetailToForm(detail);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setLoadError(
        axiosErr.response?.data?.message ||
          axiosErr.message ||
          t('vendorEditProduct.loadFailed', { defaultValue: 'Failed to load product.' })
      );
    } finally {
      setLoadingDetail(false);
    }
  }, [productId, t, applyDetailToForm]);

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
      fetchServices();
      loadProductDetail();
    }, [fetchCategories, fetchServices, loadProductDetail])
  );

  const categoryOptions = useMemo(
    () => [
      { value: '', label: t('vendorAddProduct.selectCategory', { defaultValue: 'Select category' }) },
      ...categories.map((c) => ({ value: String(c.id), label: c.name })),
    ],
    [categories, t]
  );

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

  const pickMainImageFromDevice = async () => {
    if (pickingMain) return;
    setPickingMain(true);
    try {
      const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Allow access to your photos to add the main image. You can enable it in Settings.',
          [{ text: 'OK' }]
        );
        return;
      }
      if (typeof ImagePicker.launchImageLibraryAsync !== 'function') {
        Alert.alert(
          'Not available',
          'Image picker is not available in this environment. Try running in Expo Go or a development build.',
          [{ text: 'OK' }]
        );
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
    } catch (err: unknown) {
      const message = (err as { message?: string; code?: string })?.message || (err as { code?: string })?.code || 'Could not open photo library.';
      Alert.alert('Unable to open photos', message, [{ text: 'OK' }]);
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
        Alert.alert(
          'Permission needed',
          'Allow access to your photos to add extra images. You can enable it in Settings.',
          [{ text: 'OK' }]
        );
        return;
      }
      if (typeof ImagePicker.launchImageLibraryAsync !== 'function') {
        Alert.alert(
          'Not available',
          'Image picker is not available in this environment. Try running in Expo Go or a development build.',
          [{ text: 'OK' }]
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        const uris = await compressImagesForUpload(result.assets.map((a) => a.uri));
        setExtraImages((prev) => [...prev, ...uris.map((uri) => ({ uri }))]);
      }
    } catch (err: unknown) {
      const message = (err as { message?: string; code?: string })?.message || (err as { code?: string })?.code || 'Could not open photo library.';
      Alert.alert('Unable to open photos', message, [{ text: 'OK' }]);
    } finally {
      setPickingExtra(false);
    }
  };

  const removeMainImage = () => setMainImage(null);
  const removeExtraImage = (index: number) => {
    setExtraImages((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!name.trim()) newErrors.name = t('admin.addProduct.errorNameRequired');
    const priceNum = parseFloat(price);
    if (!price.trim()) newErrors.price = t('admin.addProduct.errorPriceRequired');
    else if (isNaN(priceNum) || priceNum < 0) newErrors.price = t('admin.addProduct.errorPriceInvalid');
    const stockNum = parseInt(stock, 10);
    if (!stock.trim()) newErrors.stock = t('admin.addProduct.errorStockRequired');
    else if (isNaN(stockNum) || stockNum < 0) newErrors.stock = t('admin.addProduct.errorStockInvalid');
    if (!status) newErrors.status = t('admin.addProduct.errorStatusRequired');
    if (!sku.trim()) newErrors.sku = t('admin.addProduct.errorSkuRequired');
    if (!handle.trim()) newErrors.handle = t('admin.addProduct.errorHandleRequired');
    if (!categoryId.trim()) {
      newErrors.category_id = t('vendorAddProduct.errorCategoryRequired', {
        defaultValue: 'Please select a category',
      });
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdateProduct = async () => {
    if (!productId) {
      Alert.alert(t('common.error'), t('vendorEditProduct.missingId', { defaultValue: 'Product not found.' }));
      return;
    }
    if (!validateForm()) {
      Alert.alert(
        t('admin.addProduct.missingFieldsTitle'),
        t('admin.addProduct.missingFieldsMessage'),
        [{ text: t('common.done') }]
      );
      return;
    }

    setSaving(true);
    try {
      const categoryIdNum = parseInt(categoryId, 10);
      if (!Number.isFinite(categoryIdNum) || categoryIdNum <= 0) {
        setErrors((prev) => ({
          ...prev,
          category_id: t('vendorAddProduct.errorCategoryRequired', {
            defaultValue: 'Please select a category',
          }),
        }));
        Alert.alert(
          t('admin.addProduct.missingFieldsTitle'),
          t('vendorAddProduct.errorCategoryRequired', { defaultValue: 'Please select a category' })
        );
        return;
      }

      const serviceIdNum = serviceId.trim() ? parseInt(serviceId, 10) : undefined;
      const timingFields = {
        ...(estimatedArrival.trim() ? { estimated_arrival: estimatedArrival.trim() } : {}),
        ...(jobDuration.trim() ? { job_duration: jobDuration.trim() } : {}),
      };

      const localMainImage = mainImage && isLocalImageUri(mainImage.uri) ? mainImage : undefined;
      const localExtraImages = extraImages.filter((img) => isLocalImageUri(img.uri));

      await vendorService.updateProduct(productId, {
        name: name.trim(),
        description: description.trim() || undefined,
        price: parseFloat(price),
        stock: parseInt(stock, 10),
        status,
        category_id: categoryIdNum,
        service_id: serviceIdNum ?? null,
        weight_unit: weightUnit,
        is_featured: isFeatured ? 1 : 0,
        sku: sku.trim(),
        handle: handle.trim(),
        product_type:
          customizationConfig.groups.length > 0 || hasLocalOptionImageUploads(customizationConfig)
            ? 'variable'
            : 'simple',
        customization: customizationConfig,
        ...timingFields,
        mainImage: localMainImage,
        extraImages: localExtraImages.map((img) => ({ uri: img.uri })),
      });

      Alert.alert(
        t('common.success'),
        t('vendorEditProduct.updateSuccess', { defaultValue: 'Product updated successfully.' }),
        [
          {
            text: t('common.done'),
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string; error?: string; errors?: Record<string, string[]> } };
        message?: string;
      };
      const errorMessage =
        axiosErr.response?.data?.message ||
        axiosErr.response?.data?.error ||
        axiosErr.message ||
        t('vendorEditProduct.updateFailed', { defaultValue: 'Failed to update product.' });
      if (axiosErr.response?.data?.errors) {
        const apiErrors: { [key: string]: string } = {};
        Object.keys(axiosErr.response.data.errors).forEach((key) => {
          apiErrors[key] = axiosErr.response!.data!.errors![key][0];
        });
        setErrors(apiErrors);
      } else {
        Alert.alert(t('common.error'), errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = () => {
    if (!productId) {
      Alert.alert(t('common.error'), t('vendorEditProduct.missingId', { defaultValue: 'Product not found.' }));
      return;
    }

    Alert.alert(
      t('vendorProducts.deleteTitle', { defaultValue: 'Delete product' }),
      t('vendorProducts.deleteMessage', {
        defaultValue: 'Delete "{{name}}"? This cannot be undone.',
        name: name || t('vendorEditProduct.title', { defaultValue: 'this product' }),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const res = await vendorService.deleteProduct(productId);
              Alert.alert(
                t('common.success'),
                res.message ||
                  t('vendorProducts.deleteSuccess', { defaultValue: 'Product deleted successfully.' }),
                [{ text: t('common.done'), onPress: () => navigation.goBack() }]
              );
            } catch (err: unknown) {
              const axiosErr = err as {
                response?: { data?: { message?: string } };
                message?: string;
              };
              Alert.alert(
                t('common.error'),
                axiosErr.response?.data?.message ||
                  axiosErr.message ||
                  t('vendorProducts.deleteFailed', { defaultValue: 'Failed to delete product.' })
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const renderDropdown = (
    label: string,
    value: string,
    options: Array<{ value: string; label: string }>,
    show: boolean,
    onToggle: () => void,
    onSelect: (v: string) => void,
    icon: keyof typeof Ionicons.glyphMap,
    error?: string
  ) => (
    <View style={styles.dropdownWrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.dropdown, show && styles.dropdownOpen, error && styles.dropdownError]}
        onPress={onToggle}
        activeOpacity={0.85}
      >
        <View style={styles.dropdownLeft}>
          <View style={styles.dropdownIconWrap}>
            <Ionicons name={icon} size={16} color={COLORS.primary} />
          </View>
          <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]} numberOfLines={1}>
            {options.find((o) => o.value === value)?.label || t('admin.addUser.selectStatus')}
          </Text>
        </View>
        <Ionicons name={show ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {show ? (
        <Modal transparent visible={show} animationType="fade" onRequestClose={onToggle}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onToggle}>
            <View style={styles.dropdownListWrap} onStartShouldSetResponder={() => true}>
              <View style={styles.dropdownList}>
                <View style={styles.dropdownListHeader}>
                  <Ionicons name={icon} size={18} color={COLORS.primary} />
                  <Text style={styles.dropdownListTitle} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
                <ScrollView
                  style={styles.dropdownScroll}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  {options.map((opt) => (
                    <TouchableOpacity
                      key={opt.value || '__empty'}
                      style={[styles.dropdownItem, value === opt.value && styles.dropdownItemSelected]}
                      onPress={() => {
                        onSelect(opt.value);
                        onToggle();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[styles.dropdownItemText, value === opt.value && styles.dropdownItemTextSelected]}
                        numberOfLines={1}
                      >
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
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <VendorPageHeader
        title={t('vendorEditProduct.title', { defaultValue: 'Edit Product' })}
        subtitle={t('vendorEditProduct.subtitle', { defaultValue: 'View and update your product details' })}
        onBack={() => navigation.goBack()}
      />

      {loadingDetail ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.centerStateText}>
            {t('vendorEditProduct.loading', { defaultValue: 'Loading product…' })}
          </Text>
        </View>
      ) : loadError ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.centerStateTitle}>
            {t('vendorEditProduct.loadFailed', { defaultValue: 'Failed to load product.' })}
          </Text>
          <Text style={styles.centerStateText}>{loadError}</Text>
          <Button
            title={t('common.retry', { defaultValue: 'Retry' })}
            onPress={loadProductDetail}
            style={styles.retryButton}
          />
        </View>
      ) : (
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <VendorHeroBanner
            badge={t('vendorEditProduct.badge', { defaultValue: 'Product details' })}
            title={name || t('vendorEditProduct.title', { defaultValue: 'Edit Product' })}
            subtitle={t('vendorEditProduct.heroSubtitle', {
              defaultValue: 'Review listing, pricing, and inventory',
            })}
          />

          {(approvalStatus || listingStatus) ? (
            <VendorCard style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
                <View style={styles.statusTextWrap}>
                  {approvalStatus ? (
                    <Text style={styles.statusLine}>
                      {t('vendorEditProduct.approval')}:{' '}
                      <Text style={styles.statusValue}>
                        {translateProductStatus(t, approvalStatus)}
                      </Text>
                    </Text>
                  ) : null}
                  {listingStatus ? (
                    <Text style={styles.statusLine}>
                      {t('vendorEditProduct.listing')}:{' '}
                      <Text style={styles.statusValue}>
                        {translateProductStatus(t, listingStatus)}
                      </Text>
                    </Text>
                  ) : null}
                  {rejectionReason ? (
                    <Text style={styles.rejectionText}>{rejectionReason}</Text>
                  ) : null}
                </View>
              </View>
            </VendorCard>
          ) : null}

          <VendorCard style={styles.formCard}>
            <SectionHeader
              icon="cube-outline"
              title={t('admin.addProduct.productDetails')}
              subtitle={t('vendorAddProduct.detailsHint', { defaultValue: 'Basic info customers will see' })}
            />

            <Input
              label={t('admin.addProduct.nameLabel')}
              placeholder={t('admin.addProduct.namePlaceholder')}
              value={name}
              onChangeText={(text) => { setName(text); if (errors.name) setErrors({ ...errors, name: '' }); }}
              leftIcon="pricetag-outline"
              error={errors.name}
            />

            <Input
              label={t('admin.addProduct.descriptionLabel')}
              placeholder={t('admin.addProduct.descriptionPlaceholder')}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              error={errors.description}
            />

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Input
                  label={t('admin.addProduct.priceLabel')}
                  placeholder={t('admin.addProduct.pricePlaceholder')}
                  value={price}
                  onChangeText={(text) => { setPrice(text); if (errors.price) setErrors({ ...errors, price: '' }); }}
                  keyboardType="numeric"
                  leftIcon="cash-outline"
                  error={errors.price}
                />
              </View>
              <View style={styles.halfField}>
                <Input
                  label={t('admin.addProduct.stockLabel')}
                  placeholder={t('admin.addProduct.stockPlaceholder')}
                  value={stock}
                  onChangeText={(text) => { setStock(text); if (errors.stock) setErrors({ ...errors, stock: '' }); }}
                  keyboardType="number-pad"
                  leftIcon="cube-outline"
                  error={errors.stock}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                {renderDropdown(
                  t('admin.addProduct.statusLabel'),
                  status,
                  statusOptions,
                  showStatusDropdown,
                  () => setShowStatusDropdown((v) => !v),
                  (v) => { setStatus(v); if (errors.status) setErrors({ ...errors, status: '' }); },
                  'pulse-outline',
                  errors.status
                )}
              </View>
              <View style={styles.halfField}>
                {renderDropdown(
                  t('admin.addProduct.weightUnitLabel'),
                  weightUnit,
                  weightUnitOptions,
                  showWeightUnitDropdown,
                  () => setShowWeightUnitDropdown((v) => !v),
                  setWeightUnit,
                  'scale-outline'
                )}
              </View>
            </View>

            {renderDropdown(
              t('vendorAddProduct.categoryLabel', { defaultValue: 'Category *' }),
              categoryId,
              categoryOptions,
              showCategoryDropdown,
              () => setShowCategoryDropdown((v) => !v),
              (v) => { setCategoryId(v); if (errors.category_id) setErrors({ ...errors, category_id: '' }); },
              'grid-outline',
              errors.category_id
            )}

            {renderDropdown(
              t('admin.addProduct.serviceLabel'),
              serviceId,
              serviceOptions,
              showServiceDropdown,
              () => setShowServiceDropdown((v) => !v),
              (v) => { setServiceId(v); if (errors.service_id) setErrors({ ...errors, service_id: '' }); },
              'construct-outline',
              errors.service_id
            )}

            <View style={styles.featuredCard}>
              <View style={styles.featuredLeft}>
                <View style={styles.featuredIcon}>
                  <Ionicons name="star-outline" size={18} color={COLORS.warning} />
                </View>
                <View style={styles.featuredText}>
                  <Text style={styles.featuredLabel}>{t('admin.addProduct.featuredLabel')}</Text>
                  <Text style={styles.featuredHint}>
                    {t('vendorAddProduct.featuredHint', { defaultValue: 'Highlight on the home page' })}
                  </Text>
                </View>
              </View>
              <Switch
                value={isFeatured}
                onValueChange={setIsFeatured}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '55' }}
                thumbColor={isFeatured ? COLORS.primary : COLORS.background}
              />
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Input
                  label={t('admin.addProduct.skuLabel')}
                  placeholder={t('admin.addProduct.skuPlaceholder')}
                  value={sku}
                  onChangeText={(text) => { setSku(text); if (errors.sku) setErrors({ ...errors, sku: '' }); }}
                  error={errors.sku}
                />
              </View>
              <View style={styles.halfField}>
                <Input
                  label={t('admin.addProduct.handleLabel')}
                  placeholder={t('admin.addProduct.handlePlaceholder')}
                  value={handle}
                  onChangeText={(text) => { setHandle(text); if (errors.handle) setErrors({ ...errors, handle: '' }); }}
                  autoCapitalize="none"
                  error={errors.handle}
                />
              </View>
            </View>
          </VendorCard>

          <VendorCard style={styles.formCard}>
            <SectionHeader
              icon="time-outline"
              title={t('admin.addProduct.serviceTimingTitle')}
              subtitle={t('admin.addProduct.serviceTimingHint')}
            />
            <View style={styles.serviceTimingRow}>
              <View style={styles.serviceTimingField}>
                <Input
                  label={t('admin.addProduct.estimatedArrivalLabel')}
                  placeholder={t('admin.addProduct.estimatedArrivalPlaceholder')}
                  value={estimatedArrival}
                  onChangeText={setEstimatedArrival}
                  leftIcon="airplane-outline"
                />
              </View>
              <View style={styles.serviceTimingField}>
                <Input
                  label={t('admin.addProduct.jobDurationLabel')}
                  placeholder={t('admin.addProduct.jobDurationPlaceholder')}
                  value={jobDuration}
                  onChangeText={setJobDuration}
                  leftIcon="hourglass-outline"
                />
              </View>
            </View>
          </VendorCard>

          <VendorCard style={styles.formCard}>
            <SectionHeader
              icon="options-outline"
              title={t('vendorAddProduct.customizationTitle', { defaultValue: 'Product options' })}
              subtitle={t('vendorAddProduct.customizationHint', {
                defaultValue: 'Sizes, add-ons, or variants (optional)',
              })}
            />
            <ProductCustomizationBuilder value={customizationConfig} onChange={setCustomizationConfig} />
          </VendorCard>

          <VendorCard style={styles.formCard}>
            <SectionHeader
              icon="image-outline"
              title={t('admin.addProduct.mainImageTitle')}
              subtitle={t('admin.addProduct.mainImageHint')}
            />
            <TouchableOpacity
              style={[styles.uploadBtn, pickingMain && styles.uploadBtnDisabled]}
              onPress={pickMainImageFromDevice}
              disabled={pickingMain}
              activeOpacity={0.88}
            >
              <View style={styles.uploadIconCircle}>
                <Ionicons name="image-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.uploadTextWrap}>
                <Text style={styles.uploadTitle} numberOfLines={1}>
                  {pickingMain ? t('admin.addProduct.opening') : t('admin.addProduct.uploadFromDevice')}
                </Text>
                <Text style={styles.uploadSubtitle} numberOfLines={1}>
                  {t('vendorAddProduct.mainImageTip', { defaultValue: 'JPG or PNG · recommended 800×800' })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {mainImage ? (
              <View style={styles.uploadedPreviewWrap}>
                <View style={[styles.thumbWrap, styles.mainThumbWrap]}>
                  <Image source={{ uri: mainImage.uri }} style={styles.thumb} contentFit="cover" />
                  <View style={styles.mainBadge}>
                    <Ionicons name="star" size={12} color={COLORS.background} />
                    <Text style={styles.mainBadgeText}>{t('admin.addProduct.mainBadge')}</Text>
                  </View>
                  <TouchableOpacity style={styles.thumbRemove} onPress={removeMainImage}>
                    <Ionicons name="close-circle" size={24} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </VendorCard>

          <VendorCard style={styles.formCard}>
            <SectionHeader
              icon="images-outline"
              title={t('admin.addProduct.extraImagesTitle')}
              subtitle={t('admin.addProduct.extraImagesHint')}
            />
            <TouchableOpacity
              style={[styles.uploadBtn, styles.uploadBtnSecondary, pickingExtra && styles.uploadBtnDisabled]}
              onPress={pickExtraImagesFromDevice}
              disabled={pickingExtra}
              activeOpacity={0.88}
            >
              <View style={[styles.uploadIconCircle, styles.uploadIconCircleSecondary]}>
                <Ionicons name="images-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.uploadTextWrap}>
                <Text style={styles.uploadTitle} numberOfLines={1}>
                  {pickingExtra ? t('admin.addProduct.opening') : t('vendorAddProduct.addGallery', { defaultValue: 'Add gallery photos' })}
                </Text>
                <Text style={styles.uploadSubtitle} numberOfLines={1}>
                  {extraImages.length > 0
                    ? t('vendorAddProduct.photosAdded', {
                        defaultValue: '{{count}} photo(s) added',
                        count: extraImages.length,
                      })
                    : t('vendorAddProduct.galleryTip', { defaultValue: 'Optional additional photos' })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {extraImages.length > 0 ? (
              <View style={styles.uploadedPreviewWrap}>
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
            ) : null}
          </VendorCard>

          <View style={styles.bottomPad} />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={t('vendorEditProduct.saveButton', { defaultValue: 'Save Changes' })}
            onPress={handleUpdateProduct}
            disabled={saving || deleting}
            loading={saving}
            style={styles.submitButton}
          />
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteProduct}
            disabled={saving || deleting}
            activeOpacity={0.7}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={COLORS.error} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                <Text style={styles.deleteButtonText}>
                  {t('vendorEditProduct.deleteButton', { defaultValue: 'Delete Product' })}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VENDOR_SCREEN_BG },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingBottom: SPACING.md,
  },
  formCard: {
    marginHorizontal: 0,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  halfField: {
    flex: 1,
    minWidth: 0,
  },
  serviceTimingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  serviceTimingField: {
    flex: 1,
    minWidth: 0,
  },
  featuredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  featuredLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
    gap: SPACING.sm,
  },
  featuredIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.warning + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredText: { flex: 1 },
  featuredLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  featuredHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
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
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
    minHeight: 48,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
    gap: SPACING.sm,
  },
  dropdownIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownOpen: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '06',
  },
  dropdownError: { borderColor: COLORS.error },
  dropdownText: { fontSize: FONT_SIZES.md, color: COLORS.text, flex: 1 },
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
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  dropdownListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
  },
  dropdownListTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    flex: 1,
  },
  dropdownScroll: {
    maxHeight: 272,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  dropdownItemSelected: { backgroundColor: COLORS.primary + '12' },
  dropdownItemText: { fontSize: FONT_SIZES.md, color: COLORS.text, flex: 1 },
  dropdownItemTextSelected: { fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.primary },
  errorText: { fontSize: FONT_SIZES.xs, color: COLORS.error, marginTop: SPACING.xs },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 37, 19, 0.45)',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    minHeight: 52,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    borderStyle: 'dashed',
    backgroundColor: COLORS.primary + '06',
  },
  uploadBtnSecondary: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  uploadIconCircleSecondary: {
    borderColor: COLORS.border,
  },
  uploadTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  uploadTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  uploadSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  uploadedPreviewWrap: { marginTop: SPACING.md },
  thumbScroll: { marginHorizontal: -SPACING.xs },
  thumbWrap: {
    width: 88,
    height: 88,
    marginRight: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    position: 'relative',
  },
  mainThumbWrap: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    width: 120,
    height: 120,
  },
  mainBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BORDER_RADIUS.sm,
  },
  mainBadgeText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  submitButton: { marginTop: 0 },
  deleteButton: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  deleteButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.error,
  },
  bottomPad: { height: SPACING.sm },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  centerStateTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    textAlign: 'center',
  },
  centerStateText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: { marginTop: SPACING.md, minWidth: 140 },
  statusCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  statusTextWrap: { flex: 1 },
  statusLine: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statusValue: {
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  rejectionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
});

export default VendorEditProductScreen;
