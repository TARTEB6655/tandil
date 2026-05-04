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
import { adminService, AdminCategory, AdminService } from '../../services/adminService';
import { setPendingProductImage } from './pendingProductImage';
import { compressImageForUpload, compressImagesForUpload } from '../../utils/compressImage';

const STATUS_VALUES = ['active', 'draft', 'archived'] as const;
const WEIGHT_UNITS = ['kg', 'g', 'lb', 'oz'] as const;

const AdminAddProductScreen: React.FC = () => {
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
  const [isFeatured, setIsFeatured] = useState(false); // 0 = no, 1 = yes → send as is_featured
  const [sku, setSku] = useState('');
  const [handle, setHandle] = useState('');
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [jobDuration, setJobDuration] = useState('');
  const [mainImage, setMainImage] = useState<{ uri: string } | null>(null);
  const [extraImages, setExtraImages] = useState<{ uri: string }[]>([]);
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
      { value: '', label: t('admin.addProduct.noCategory') },
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
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
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
    } catch (err: any) {
      const message = err?.message || err?.code || 'Could not open photo library.';
      Alert.alert('Unable to open photos', message, [{ text: 'OK' }]);
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
        const uris = await compressImagesForUpload(result.assets!.map((a) => a.uri));
        setExtraImages((prev) => [...prev, ...uris.map((uri) => ({ uri }))]);
      }
    } catch (err: any) {
      const message = err?.message || err?.code || 'Could not open photo library.';
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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateProduct = async () => {
    if (!validateForm()) {
      Alert.alert(
        t('admin.addProduct.missingFieldsTitle'),
        t('admin.addProduct.missingFieldsMessage'),
        [{ text: t('common.done') }]
      );
      return;
    }

    setLoading(true);
    try {
      const categoryIdNum = categoryId.trim() ? parseInt(categoryId, 10) : undefined;
      const serviceIdNum = serviceId.trim() ? parseInt(serviceId, 10) : undefined;
      const timingFields = {
        ...(estimatedArrival.trim() ? { estimated_arrival: estimatedArrival.trim() } : {}),
        ...(jobDuration.trim() ? { job_duration: jobDuration.trim() } : {}),
      };
      let createdData: { image_url?: string | null; image?: string | null; primary_image?: { image_url?: string; image_path?: string }; images?: Array<{ image_url?: string; image_path?: string }> } | undefined;

      const hasMainFile = mainImage != null;
      const hasExtraFiles = extraImages.length > 0;

      if (hasMainFile || hasExtraFiles) {
        const mainFile = mainImage ?? (extraImages[0] ? { uri: extraImages[0].uri } : null);
        const extraFiles = mainImage ? extraImages : extraImages.slice(1);
        if (mainFile) {
          const res = await adminService.createProductWithImages({
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
            ...timingFields,
            mainImage: mainFile,
            extraImages: extraFiles.map((i) => ({ uri: i.uri })),
          });
          createdData = res.data;
        }
      }
      if (!createdData) {
        const res = await adminService.createProduct({
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
          ...timingFields,
        });
        createdData = res.data;
      }

      const rawImageUrl =
        (typeof createdData?.image_url === 'string' && createdData.image_url.trim() ? createdData.image_url : null) ??
        (typeof createdData?.primary_image?.image_url === 'string' && createdData.primary_image.image_url.trim() ? createdData.primary_image.image_url : null) ??
        (createdData?.images?.length && typeof createdData.images[0]?.image_url === 'string' ? createdData.images[0].image_url : null) ??
        (typeof createdData?.image === 'string' && createdData.image.trim() ? createdData.image : null) ??
        (typeof createdData?.primary_image?.image_path === 'string' ? createdData.primary_image.image_path : null) ??
        (createdData?.images?.[0]?.image_path ?? null);
      if (rawImageUrl) {
        const fullUrl = buildFullImageUrl(rawImageUrl);
        Image.prefetch(fullUrl, { cachePolicy: 'disk' }).catch(() => {});
      }

      const createdProduct = (createdData as { data?: { id: number } })?.data;
      if (createdProduct?.id != null && mainImage) {
        setPendingProductImage(createdProduct.id, mainImage.uri);
      }

      Alert.alert(
        t('admin.users.success'),
        t('admin.addProduct.success'),
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
              setWeightUnit('kg');
              setSku('');
              setHandle('');
              setEstimatedArrival('');
              setJobDuration('');
              setMainImage(null);
              setExtraImages([]);
              setErrors({});
              navigation.goBack();
            },
          },
        ]
      );
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        t('admin.addProduct.createFailed');
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
          {options.find((o) => o.value === value)?.label || t('admin.addUser.selectStatus')}
        </Text>
        <Ionicons name={show ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {show && (
        <Modal transparent visible={show} animationType="fade" onRequestClose={onToggle}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={onToggle}
          >
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.addProduct.title')}</Text>
        <View style={styles.headerRight} />
      </View>

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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.addProduct.productDetails')}</Text>

            <Input
              label={t('admin.addProduct.nameLabel')}
              placeholder={t('admin.addProduct.namePlaceholder')}
              value={name}
              onChangeText={(t) => { setName(t); if (errors.name) setErrors({ ...errors, name: '' }); }}
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

            <Input
              label={t('admin.addProduct.priceLabel')}
              placeholder={t('admin.addProduct.pricePlaceholder')}
              value={price}
              onChangeText={(t) => { setPrice(t); if (errors.price) setErrors({ ...errors, price: '' }); }}
              keyboardType="numeric"
              leftIcon="cash-outline"
              error={errors.price}
            />

            <Input
              label={t('admin.addProduct.stockLabel')}
              placeholder={t('admin.addProduct.stockPlaceholder')}
              value={stock}
              onChangeText={(t) => { setStock(t); if (errors.stock) setErrors({ ...errors, stock: '' }); }}
              keyboardType="number-pad"
              leftIcon="cube-outline"
              error={errors.stock}
            />

            {renderDropdown(
              t('admin.addProduct.statusLabel'),
              status,
              statusOptions,
              showStatusDropdown,
              () => setShowStatusDropdown((v) => !v),
              (v) => { setStatus(v); if (errors.status) setErrors({ ...errors, status: '' }); },
              errors.status
            )}

            {renderDropdown(
              t('admin.addProduct.categoryLabel'),
              categoryId,
              categoryOptions,
              showCategoryDropdown,
              () => setShowCategoryDropdown((v) => !v),
              (v) => { setCategoryId(v); if (errors.category_id) setErrors({ ...errors, category_id: '' }); },
              errors.category_id
            )}

            {renderDropdown(
              t('admin.addProduct.serviceLabel'),
              serviceId,
              serviceOptions,
              showServiceDropdown,
              () => setShowServiceDropdown((v) => !v),
              (v) => { setServiceId(v); if (errors.service_id) setErrors({ ...errors, service_id: '' }); },
              errors.service_id
            )}

            {renderDropdown(
              t('admin.addProduct.weightUnitLabel'),
              weightUnit,
              weightUnitOptions,
              showWeightUnitDropdown,
              () => setShowWeightUnitDropdown((v) => !v),
              setWeightUnit
            )}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('admin.addProduct.featuredLabel')}</Text>
              <Switch
                value={isFeatured}
                onValueChange={setIsFeatured}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '99' }}
                thumbColor={isFeatured ? COLORS.primary : COLORS.textSecondary}
              />
            </View>

            <Input
              label={t('admin.addProduct.skuLabel')}
              placeholder={t('admin.addProduct.skuPlaceholder')}
              value={sku}
              onChangeText={(t) => { setSku(t); if (errors.sku) setErrors({ ...errors, sku: '' }); }}
              error={errors.sku}
            />

            <Input
              label={t('admin.addProduct.handleLabel')}
              placeholder={t('admin.addProduct.handlePlaceholder')}
              value={handle}
              onChangeText={(t) => { setHandle(t); if (errors.handle) setErrors({ ...errors, handle: '' }); }}
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
            <Text style={styles.sectionTitle}>{t('admin.addProduct.mainImageTitle')}</Text>
            <Text style={styles.uploadedHint}>{t('admin.addProduct.mainImageHint')}</Text>
            <TouchableOpacity
              style={[styles.uploadFromDeviceBtn, pickingMain && styles.uploadFromDeviceBtnDisabled]}
              onPress={pickMainImageFromDevice}
              disabled={pickingMain}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="image-outline" size={24} color={COLORS.primary} />
              <Text style={styles.uploadFromDeviceText}>
                {pickingMain ? t('admin.addProduct.opening') : t('admin.addProduct.uploadFromDevice')}
              </Text>
            </TouchableOpacity>
            {mainImage && (
              <View style={styles.uploadedPreviewWrap}>
                <View style={[styles.thumbWrap, styles.mainThumbWrap]}>
                  <Image source={{ uri: mainImage.uri }} style={styles.thumb} resizeMode="cover" />
                  <View style={styles.mainBadge}>
                    <Ionicons name="star" size={12} color={COLORS.background} />
                    <Text style={styles.mainBadgeText}>{t('admin.addProduct.mainBadge')}</Text>
                  </View>
                  <TouchableOpacity style={styles.thumbRemove} onPress={removeMainImage}>
                    <Ionicons name="close-circle" size={24} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.addProduct.extraImagesTitle')}</Text>
            <Text style={styles.uploadedHint}>{t('admin.addProduct.extraImagesHint')}</Text>
            <TouchableOpacity
              style={[styles.uploadFromDeviceBtn, pickingExtra && styles.uploadFromDeviceBtnDisabled]}
              onPress={pickExtraImagesFromDevice}
              disabled={pickingExtra}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="images-outline" size={24} color={COLORS.primary} />
              <Text style={styles.uploadFromDeviceText}>
                {pickingExtra ? t('admin.addProduct.opening') : t('admin.addProduct.uploadFromDevice')}
              </Text>
            </TouchableOpacity>
            {extraImages.length > 0 && (
              <View style={styles.uploadedPreviewWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbScroll}>
                  {extraImages.map((img, index) => (
                    <View key={index} style={styles.thumbWrap}>
                      <Image source={{ uri: img.uri }} style={styles.thumb} resizeMode="cover" />
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
            title="Create Product"
            onPress={handleCreateProduct}
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
  uploadFromDeviceBtnDisabled: {
    opacity: 0.6,
  },
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
    marginBottom: SPACING.sm,
  },
  thumbScroll: { marginHorizontal: -SPACING.lg },
  thumbWrap: {
    width: 80,
    height: 80,
    marginRight: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  mainThumbWrap: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  mainBadge: {
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
  mainBadgeText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  submitButton: { marginTop: SPACING.md },
  bottomPad: { height: SPACING.xl * 2 },
});

export default AdminAddProductScreen;
