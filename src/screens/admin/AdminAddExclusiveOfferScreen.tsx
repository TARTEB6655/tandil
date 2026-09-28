import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import Header from '../../components/common/Header';
import { adminService, AdminProduct } from '../../services/adminService';
import {
  catalogImagePickerOptions,
  compressCatalogImageForUpload,
  isImageTooLargeError,
} from '../../utils/compressImage';
import { Image } from 'expo-image';

const DISCOUNT_TYPES = ['percentage', 'fixed_amount', 'buy_one_get_one'] as const;

const AdminAddExclusiveOfferScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<(typeof DISCOUNT_TYPES)[number]>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [appliesTo, setAppliesTo] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState('0');
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [image, setImage] = useState<{ uri: string } | null>(null);

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showDiscountTypeModal, setShowDiscountTypeModal] = useState(false);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const res = await adminService.getProducts({ per_page: 100 });
      const list = Array.isArray(res.data) ? res.data : (res as any).data?.data ?? [];
      setProducts(Array.isArray(list) ? list : []);
    } catch (_) {
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [fetchProducts])
  );

  const toggleProduct = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const pickImageFromDevice = async () => {
    if (pickingImage) return;
    setPickingImage(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.permissionNeeded', 'Permission needed'),
          t('admin.exclusiveOffers.photoPermission', 'Allow access to photos to add an image.'),
          [{ text: t('common.done', 'OK') }]
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync(catalogImagePickerOptions());
      if (!result.canceled && result.assets?.[0]) {
        const uri = await compressCatalogImageForUpload(
          result.assets[0].uri,
          result.assets[0].fileSize
        );
        setImage({ uri });
      }
    } catch (err: any) {
      Alert.alert(
        t('admin.users.error', 'Error'),
        isImageTooLargeError(err)
          ? err.message
          : err?.message ?? 'Could not open photos'
      );
    } finally {
      setPickingImage(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!title.trim()) newErrors.title = t('admin.exclusiveOffers.errorTitleRequired', 'Title is required');
    if (!discountType) newErrors.discount_type = t('admin.exclusiveOffers.errorDiscountTypeRequired', 'Discount type is required');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) {
      Alert.alert(
        t('admin.exclusiveOffers.missingFields', 'Missing required fields'),
        t('admin.exclusiveOffers.fillRequired', 'Please fill in title and discount type.'),
        [{ text: t('common.done', 'OK') }]
      );
      return;
    }

    setLoading(true);
    try {
      await adminService.createExclusiveOffer({
        title: title.trim(),
        description: description.trim() || undefined,
        discount_type: discountType,
        discount_value: discountValue.trim() ? discountValue.trim() : undefined,
        applies_to: appliesTo.trim() || undefined,
        start_date: startDate.trim() || undefined,
        end_date: endDate.trim() || undefined,
        is_active: isActive,
        sort_order: sortOrder.trim() !== '' ? (parseInt(sortOrder, 10) || 0) : undefined,
        product_ids: selectedProductIds.length > 0 ? selectedProductIds : undefined,
        image: image ?? undefined,
      });
      Alert.alert(
        t('admin.users.success', 'Success'),
        t('admin.exclusiveOffers.createSuccess', 'Exclusive offer created successfully.'),
        [{ text: t('common.done', 'OK'), onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        t('admin.exclusiveOffers.createFailed', 'Failed to create offer. Please try again.');
      Alert.alert(t('admin.users.error', 'Error'), message);
    } finally {
      setLoading(false);
    }
  };

  const discountTypeLabel = (key: string) => {
    if (key === 'percentage') return t('admin.exclusiveOffers.discountPercentage', 'Percentage');
    if (key === 'fixed_amount') return t('admin.exclusiveOffers.discountFixed', 'Fixed amount');
    if (key === 'buy_one_get_one') return t('admin.exclusiveOffers.discountBogo', 'Buy one get one');
    return key;
  };

  const selectedProductNames = products
    .filter((p) => selectedProductIds.includes(p.id))
    .map((p) => p.name)
    .join(', ');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header
        title={t('admin.exclusiveOffers.addOffer', 'Add Exclusive Offer')}
        showBack={true}
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>{t('admin.exclusiveOffers.details', 'Offer details')}</Text>

          <Input
            label={t('admin.exclusiveOffers.titleLabel', 'Title')}
            placeholder={t('admin.exclusiveOffers.titlePlaceholder', 'e.g. Farm Fresh Week')}
            value={title}
            onChangeText={(v) => { setTitle(v); if (errors.title) setErrors({ ...errors, title: '' }); }}
            error={errors.title}
          />

          <Input
            label={t('admin.exclusiveOffers.descriptionLabel', 'Description')}
            placeholder={t('admin.exclusiveOffers.descriptionPlaceholder', 'e.g. Up to 30% OFF on fresh produce')}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <View style={styles.fieldRow}>
            <Text style={styles.label}>{t('admin.exclusiveOffers.discountTypeLabel', 'Discount type')}</Text>
            <TouchableOpacity
              style={[styles.dropdown, errors.discount_type && styles.dropdownError]}
              onPress={() => setShowDiscountTypeModal(true)}
            >
              <Text style={styles.dropdownText}>{discountTypeLabel(discountType)}</Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {errors.discount_type ? <Text style={styles.errorText}>{errors.discount_type}</Text> : null}
          </View>

          <Input
            label={t('admin.exclusiveOffers.discountValueLabel', 'Discount value')}
            placeholder={t('admin.exclusiveOffers.discountValuePlaceholder', 'e.g. 30')}
            value={discountValue}
            onChangeText={setDiscountValue}
            keyboardType="decimal-pad"
          />

          <Input
            label={t('admin.exclusiveOffers.appliesToLabel', 'Applies to')}
            placeholder={t('admin.exclusiveOffers.appliesToPlaceholder', 'e.g. fresh produce')}
            value={appliesTo}
            onChangeText={setAppliesTo}
          />

          <View style={styles.rowTwo}>
            <View style={styles.halfField}>
              <Input
                label={t('admin.exclusiveOffers.startDateLabel', 'Start date')}
                placeholder="YYYY-MM-DD"
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>
            <View style={styles.halfField}>
              <Input
                label={t('admin.exclusiveOffers.endDateLabel', 'End date')}
                placeholder="YYYY-MM-DD"
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.label}>{t('admin.exclusiveOffers.isActiveLabel', 'Active')}</Text>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '99' }}
              thumbColor={isActive ? COLORS.primary : COLORS.textSecondary}
            />
          </View>

          <Input
            label={t('admin.exclusiveOffers.sortOrderLabel', 'Sort order')}
            placeholder="0"
            value={sortOrder}
            onChangeText={setSortOrder}
            keyboardType="number-pad"
          />

          <View style={styles.fieldRow}>
            <Text style={styles.label}>{t('admin.exclusiveOffers.productsLabel', 'Products')}</Text>
            <TouchableOpacity style={styles.productSelectBtn} onPress={() => setShowProductModal(true)}>
              <Text style={styles.productSelectBtnText} numberOfLines={1}>
                {productsLoading
                  ? t('admin.exclusiveOffers.loadingProducts', 'Loading…')
                  : selectedProductIds.length > 0
                    ? t('admin.exclusiveOffers.selectedCount', { count: selectedProductIds.length, defaultValue: '{{count}} selected' })
                    : t('admin.exclusiveOffers.selectProducts', 'Select products')}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {selectedProductIds.length > 0 && selectedProductNames ? (
              <Text style={styles.selectedNames} numberOfLines={2}>{selectedProductNames}</Text>
            ) : null}
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.label}>{t('admin.exclusiveOffers.imageLabel', 'Image')}</Text>
            <Text style={styles.imageSizeHint}>
              {t('admin.exclusiveOffers.imageMaxSizeHint', {
                defaultValue: 'Max file size: 5 MB',
              })}
            </Text>
            <TouchableOpacity
              style={[styles.imageBtn, pickingImage && styles.imageBtnDisabled]}
              onPress={pickImageFromDevice}
              disabled={pickingImage}
            >
              <Ionicons name="image-outline" size={24} color={COLORS.primary} />
              <Text style={styles.imageBtnText}>
                {pickingImage ? t('common.loading', 'Loading…') : image ? t('admin.exclusiveOffers.imageSelected', 'Image selected') : t('admin.exclusiveOffers.uploadImage', 'Upload image')}
              </Text>
            </TouchableOpacity>
            {image?.uri ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: image.uri }} style={styles.imagePreview} contentFit="cover" />
                <TouchableOpacity style={styles.imagePreviewRemove} onPress={() => setImage(null)}>
                  <Ionicons name="close-circle" size={28} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <Button
            title={t('admin.exclusiveOffers.createButton', 'Create offer')}
            onPress={handleCreate}
            disabled={loading}
            loading={loading}
            style={styles.submitBtn}
          />
          <View style={styles.bottomPad} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Discount type modal */}
      <Modal transparent visible={showDiscountTypeModal} animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDiscountTypeModal(false)}>
          <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('admin.exclusiveOffers.discountTypeLabel', 'Discount type')}</Text>
            {DISCOUNT_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.modalOption, discountType === type && styles.modalOptionSelected]}
                onPress={() => {
                  setDiscountType(type);
                  setShowDiscountTypeModal(false);
                  if (errors.discount_type) setErrors({ ...errors, discount_type: '' });
                }}
              >
                <Text style={[styles.modalOptionText, discountType === type && styles.modalOptionTextSelected]}>{discountTypeLabel(type)}</Text>
                {discountType === type && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDiscountTypeModal(false)}>
              <Text style={styles.modalCancelText}>{t('common.cancel', 'Cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Product list modal */}
      <Modal visible={showProductModal} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>{t('admin.exclusiveOffers.selectProducts', 'Select products')}</Text>
            <TouchableOpacity onPress={() => setShowProductModal(false)}>
              <Ionicons name="close" size={28} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          {productsLoading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => {
                const isSelected = selectedProductIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={styles.productRow}
                    onPress={() => toggleProduct(item.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={isSelected ? COLORS.primary : COLORS.textSecondary}
                    />
                    <Text style={styles.productRowName} numberOfLines={2}>{item.name ?? `#${item.id}`}</Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>{t('admin.exclusiveOffers.noProducts', 'No products found')}</Text>
                </View>
              }
            />
          )}
          <View style={styles.modalFooter}>
            <Button
              title={t('common.done', 'Done')}
              onPress={() => setShowProductModal(false)}
              style={styles.modalDoneBtn}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
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
  fieldRow: { marginBottom: SPACING.md },
  imageSizeHint: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
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
  dropdownError: { borderColor: COLORS.error },
  dropdownText: { fontSize: FONT_SIZES.md, color: COLORS.text },
  errorText: { fontSize: FONT_SIZES.xs, color: COLORS.error, marginTop: SPACING.xs },
  rowTwo: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  halfField: { flex: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  productSelectBtn: {
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
  productSelectBtnText: { fontSize: FONT_SIZES.md, color: COLORS.text, flex: 1 },
  selectedNames: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: SPACING.xs },
  imageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  imageBtnDisabled: { opacity: 0.6 },
  imageBtnText: { fontSize: FONT_SIZES.md, color: COLORS.text },
  imagePreviewWrap: {
    marginTop: SPACING.sm,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.border + '40',
  },
  imagePreviewRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  submitBtn: { marginTop: SPACING.lg },
  bottomPad: { height: SPACING.xl },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    width: '85%',
    maxWidth: 340,
    padding: SPACING.lg,
  },
  modalTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text, marginBottom: SPACING.md },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  modalOptionSelected: { backgroundColor: COLORS.primary + '15', borderWidth: 1, borderColor: COLORS.primary },
  modalOptionText: { fontSize: FONT_SIZES.md, color: COLORS.text },
  modalOptionTextSelected: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.semiBold },
  modalCancel: { marginTop: SPACING.sm, alignSelf: 'flex-end' },
  modalCancelText: { fontSize: FONT_SIZES.sm, color: COLORS.primary },

  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalHeaderTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  modalLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalEmpty: { padding: SPACING.xl, alignItems: 'center' },
  modalEmptyText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  productRowName: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.text },
  modalFooter: { padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border },
  modalDoneBtn: {},
});

export default AdminAddExclusiveOfferScreen;
