import React, { useState, useCallback, useMemo, useRef } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { buildFullImageUrl } from '../../config/api';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import {
  VendorCard,
  VendorHeroBanner,
  VendorPageHeader,
  VENDOR_SCREEN_BG,
} from '../../components/vendor/VendorUi';
import { vendorService } from '../../services/vendorService';
import { setPendingProductImage } from '../admin/pendingProductImage';
import { compressImageForUpload, compressImagesForUpload } from '../../utils/compressImage';
import ProductCustomizationBuilder from '../../components/admin/ProductCustomizationBuilder';
import type { ProductCustomizationConfig } from '../../types/productCustomization';
import { setProductCustomization } from '../../services/productCustomizationService';

const STATUS_VALUES = ['active', 'draft', 'archived'] as const;
const WEIGHT_UNITS = ['kg', 'g', 'lb', 'oz'] as const;

function isSuccessCreateMessage(message?: string): boolean {
  if (!message?.trim()) return false;
  return /product created|created successfully|successfully created/i.test(message.trim());
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

const VendorAddProductScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
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
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const scrollRef = useRef<ScrollView>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showWeightUnitDropdown, setShowWeightUnitDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [pickingMain, setPickingMain] = useState(false);
  const [pickingExtra, setPickingExtra] = useState(false);
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

  useFocusEffect(useCallback(() => { fetchCategories(); fetchServices(); }, [fetchCategories, fetchServices]));

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

  const showValidationErrors = (newErrors: { [key: string]: string }) => {
    setErrors(newErrors);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    const messages = Object.values(newErrors).filter(Boolean);
    Alert.alert(
      t('admin.addProduct.missingFieldsTitle'),
      messages.length > 0
        ? `• ${messages.join('\n• ')}`
        : t('admin.addProduct.missingFieldsMessage'),
      [{ text: t('common.ok', { defaultValue: 'OK' }) }]
    );
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
    if (Object.keys(newErrors).length > 0) {
      showValidationErrors(newErrors);
      return false;
    }
    return true;
  };

  const handleCreateProduct = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const categoryIdNum = parseInt(categoryId, 10);
      if (!Number.isFinite(categoryIdNum) || categoryIdNum <= 0) {
        showValidationErrors({
          category_id: t('vendorAddProduct.errorCategoryRequired', {
            defaultValue: 'Please select a category',
          }),
        });
        return;
      }

      const serviceIdNum = serviceId.trim() ? parseInt(serviceId, 10) : undefined;
      const timingFields = {
        ...(estimatedArrival.trim() ? { estimated_arrival: estimatedArrival.trim() } : {}),
        ...(jobDuration.trim() ? { job_duration: jobDuration.trim() } : {}),
      };

      const mainFile = mainImage ?? (extraImages[0] ? { uri: extraImages[0].uri } : undefined);
      const extraFiles = mainImage ? extraImages : extraImages.slice(1);

      const res = await vendorService.createProduct({
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
        product_type: customizationConfig.groups.length > 0 ? 'variable' : 'simple',
        customization: customizationConfig,
        ...timingFields,
        mainImage: mainFile,
        extraImages: extraFiles.map((i) => ({ uri: i.uri })),
      });

      const createdData = res.data;

      const rawImageUrl =
        (typeof createdData?.image_url === 'string' && createdData.image_url.trim() ? createdData.image_url : null) ??
        (typeof createdData?.primary_image?.image_url === 'string' && createdData.primary_image.image_url.trim()
          ? createdData.primary_image.image_url
          : null) ??
        (createdData?.images?.length && typeof createdData.images[0]?.image_url === 'string'
          ? createdData.images[0].image_url
          : null) ??
        (typeof createdData?.image === 'string' && createdData.image.trim() ? createdData.image : null) ??
        (typeof createdData?.primary_image?.image_path === 'string' ? createdData.primary_image.image_path : null) ??
        (createdData?.images?.[0]?.image_path ?? null);
      if (rawImageUrl) {
        const fullUrl = buildFullImageUrl(rawImageUrl);
        Image.prefetch(fullUrl, { cachePolicy: 'disk' }).catch(() => {});
      }

      const createdProductId = createdData?.id;
      if (createdProductId != null && Number(createdProductId) > 0 && mainImage) {
        setPendingProductImage(createdProductId, mainImage.uri);
      }
      if (createdProductId != null && Number(createdProductId) > 0) {
        try {
          await setProductCustomization(createdProductId, customizationConfig);
        } catch {
          // Product was created; customization cache is optional.
        }
      }

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        res.message || t('admin.addProduct.success'),
        [
          {
            text: 'OK',
            onPress: () => {
              setName('');
              setDescription('');
              setPrice('');
              setStock('');
              setStatus('active');
              setCategoryId('');
              setServiceId('');
              setWeightUnit('kg');
              setIsFeatured(false);
              setSku('');
              setHandle('');
              setEstimatedArrival('');
              setJobDuration('');
              setMainImage(null);
              setExtraImages([]);
              setCustomizationConfig({ groups: [] });
              setErrors({});
              navigation.goBack();
            },
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
        t('admin.addProduct.createFailed');

      if (isSuccessCreateMessage(errorMessage)) {
        Alert.alert(
          t('common.success', { defaultValue: 'Success' }),
          errorMessage,
          [{ text: t('common.ok', { defaultValue: 'OK' }), onPress: () => navigation.goBack() }]
        );
        return;
      }

      if (axiosErr.response?.data?.errors) {
        const apiErrors: { [key: string]: string } = {};
        Object.keys(axiosErr.response.data.errors).forEach((key) => {
          apiErrors[key] = axiosErr.response!.data!.errors![key][0];
        });
        showValidationErrors(apiErrors);
      } else {
        Alert.alert(t('common.error', { defaultValue: 'Error' }), errorMessage);
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
        title={t('admin.addProduct.title')}
        subtitle={t('vendorAddProduct.subtitle', { defaultValue: 'Fill in details to list on Tandil marketplace' })}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <VendorHeroBanner
            badge={t('vendorAddProduct.newListing', { defaultValue: 'New listing' })}
            title={t('vendorAddProduct.heroTitle', { defaultValue: 'Create your product' })}
            subtitle={t('vendorAddProduct.heroSubtitle', {
              defaultValue: 'Add photos, pricing, and inventory for your store',
            })}
          />

          {Object.keys(errors).length > 0 ? (
            <View style={styles.validationBanner}>
              <Ionicons name="alert-circle" size={22} color={COLORS.error} />
              <View style={styles.validationBannerTextWrap}>
                <Text style={styles.validationBannerTitle}>
                  {t('vendorAddProduct.fixErrors', { defaultValue: 'Please fix the following:' })}
                </Text>
                {Object.entries(errors).map(([key, message]) => (
                  <Text key={key} style={styles.validationBannerItem}>
                    • {message}
                  </Text>
                ))}
              </View>
            </View>
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
            title={t('admin.addProduct.createButton', { defaultValue: 'Create Product' })}
            onPress={handleCreateProduct}
            disabled={loading}
            loading={loading}
            style={styles.submitButton}
          />
        </View>
      </KeyboardAvoidingView>
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
  validationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.error + '12',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.error + '44',
  },
  validationBannerTextWrap: {
    flex: 1,
  },
  validationBannerTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.error,
    marginBottom: SPACING.xs,
  },
  validationBannerItem: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
    marginTop: 2,
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
  bottomPad: { height: SPACING.sm },
});

export default VendorAddProductScreen;
