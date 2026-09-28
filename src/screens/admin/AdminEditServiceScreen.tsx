import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { buildFullImageUrl } from '../../config/api';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { adminService, AdminService } from '../../services/adminService';
import {
  catalogImagePickerOptions,
  compressCatalogImageForUpload,
  ImageTooLargeError,
} from '../../utils/compressImage';

type AdminEditServiceParams = { service: AdminService } | { serviceId: number };

const AdminEditServiceScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: AdminEditServiceParams }, 'params'>>();
  const params = route.params;
  const serviceId = params && 'serviceId' in params ? params.serviceId : params?.service?.id;
  const initialService = params && 'service' in params ? params.service : null;

  const [service, setService] = useState<AdminService | null>(initialService ?? null);
  const [name, setName] = useState(initialService?.name ?? '');
  const [slug, setSlug] = useState(initialService?.slug ?? '');
  const [description, setDescription] = useState(initialService?.description ?? '');
  const [image, setImage] = useState<{ uri: string } | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [isActive, setIsActive] = useState(initialService?.is_active !== false);
  const [loadingDetail, setLoadingDetail] = useState(!!serviceId);
  const [loading, setLoading] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchServiceDetail = useCallback(async () => {
    if (!serviceId) return;
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await adminService.getServiceById(serviceId);
      const data = res.data;
      if (data) {
        setService(data);
        setName(data.name ?? '');
        setSlug(data.slug ?? '');
        setDescription(data.description ?? '');
        setIsActive(data.is_active !== false);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || t('admin.services.loadError');
      setDetailError(msg);
    } finally {
      setLoadingDetail(false);
    }
  }, [serviceId, t]);

  useEffect(() => {
    fetchServiceDetail();
  }, [fetchServiceDetail]);

  const currentImageUri =
    image?.uri ?? (service?.image_url ? service.image_url : service?.image ? buildFullImageUrl(service.image) : null);

  const pickImageFromDevice = async () => {
    if (pickingImage) return;
    setPickingImage(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('admin.categoryForm.permissionTitle'),
          t('admin.categoryForm.permissionBody'),
          [{ text: t('common.ok') }]
        );
        return;
      }
      if (typeof ImagePicker.launchImageLibraryAsync !== 'function') {
        Alert.alert(
          t('admin.categoryForm.notAvailableTitle'),
          t('admin.categoryForm.notAvailableBody'),
          [{ text: t('common.ok') }]
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync(catalogImagePickerOptions());
      if (!result.canceled && result.assets?.[0]) {
        try {
          const uri = await compressCatalogImageForUpload(
            result.assets[0].uri,
            result.assets[0].fileSize
          );
          setImage({ uri });
          setImageRemoved(false);
        } catch (sizeErr: any) {
          if (sizeErr?.name === 'ImageTooLargeError' || sizeErr instanceof ImageTooLargeError) {
            Alert.alert(
              t('common.error', { defaultValue: 'Error' }),
              sizeErr.message ||
                t('common.imageMaxSize', {
                  defaultValue: 'You can upload an image of up to 5 MB only. Please choose a smaller file.',
                })
            );
            return;
          }
          throw sizeErr;
        }
      }
    } catch (err: any) {
      Alert.alert(
        t('admin.categoryForm.unableToOpenTitle'),
        err?.message ?? t('admin.categoryForm.unableToOpenBody'),
        [{ text: t('common.ok') }]
      );
    } finally {
      setPickingImage(false);
    }
  };

  const removeImage = () => {
    setImage(null);
    setImageRemoved(true);
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!name.trim()) newErrors.name = t('admin.services.errorNameRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdateService = async () => {
    if (!serviceId) return;
    if (!validateForm()) {
      Alert.alert(
        t('admin.categoryForm.missingFieldTitle'),
        t('admin.categoryForm.missingFieldMessage'),
        [{ text: t('common.ok') }]
      );
      return;
    }

    setLoading(true);
    try {
      await adminService.updateService(serviceId, {
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
        image: image ?? undefined,
        image_remove: imageRemoved || undefined,
        is_active: isActive,
      });
      Alert.alert(
        t('admin.users.success'),
        t('admin.services.successUpdate'),
        [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        t('admin.services.updateFailed');
      Alert.alert(t('admin.users.error'), message);
    } finally {
      setLoading(false);
    }
  };

  if (!serviceId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('admin.services.editTitle')}</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>{t('admin.services.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadingDetail) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('admin.services.editTitle')}</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('admin.services.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (detailError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('admin.services.editTitle')}</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>{detailError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchServiceDetail}>
            <Text style={styles.retryBtnText}>{t('admin.users.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.services.editTitle')}</Text>
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
            <Text style={styles.sectionTitle}>{t('admin.services.detailsSection')}</Text>

            <Input
              label={t('admin.services.nameLabel')}
              placeholder={t('admin.services.namePlaceholder')}
              value={name}
              onChangeText={(txt) => { setName(txt); if (errors.name) setErrors({ ...errors, name: '' }); }}
              leftIcon="construct-outline"
              error={errors.name}
            />

            <Input
              label={t('admin.services.slugLabel')}
              placeholder={t('admin.services.slugPlaceholder')}
              value={slug}
              onChangeText={setSlug}
              autoCapitalize="none"
            />

            <Input
              label={t('admin.services.descriptionLabel')}
              placeholder={t('admin.services.descriptionPlaceholder')}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('admin.services.isActive')}</Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.background}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.categoryForm.imageSection')}</Text>
            <Text style={styles.uploadedHint}>{t('admin.categoryForm.currentImageHint')}</Text>
            {!image && currentImageUri && (
              <View style={styles.imagePreviewWrap}>
                <Text style={styles.currentLabel}>{t('admin.categoryForm.currentImageLabel')}</Text>
                <View style={styles.thumbWrap}>
                  <Image source={{ uri: currentImageUri }} style={styles.thumb} contentFit="cover" />
                </View>
              </View>
            )}
            <TouchableOpacity
              style={[styles.uploadBtn, pickingImage && styles.uploadBtnDisabled]}
              onPress={pickImageFromDevice}
              disabled={pickingImage}
              activeOpacity={0.7}
            >
              <Ionicons name="image-outline" size={24} color={COLORS.primary} />
              <Text style={styles.uploadBtnText}>
                {pickingImage
                  ? t('admin.categoryForm.opening')
                  : image
                    ? t('admin.categoryForm.replaceImage')
                    : t('admin.categoryForm.uploadFromDevice')}
              </Text>
            </TouchableOpacity>
            {image && (
              <View style={styles.imagePreviewWrap}>
                <View style={styles.thumbWrap}>
                  <Image source={{ uri: image.uri }} style={styles.thumb} contentFit="cover" />
                  <TouchableOpacity style={styles.thumbRemove} onPress={removeImage}>
                    <Ionicons name="close-circle" size={24} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <Button
            title={t('admin.services.submitUpdate')}
            onPress={handleUpdateService}
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
  backBtn: { padding: SPACING.xs },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  headerRight: { width: 40 },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  errorText: { fontSize: FONT_SIZES.sm, color: COLORS.error, textAlign: 'center' },
  loadingText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  retryBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  retryBtnText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.background },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg },
  section: { marginBottom: SPACING.xl },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  switchLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  uploadedHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  currentLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  uploadBtn: {
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
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  imagePreviewWrap: { marginTop: SPACING.sm },
  thumbWrap: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  submitButton: { marginTop: SPACING.md },
  bottomPad: { height: SPACING.xl * 2 },
});

export default AdminEditServiceScreen;
