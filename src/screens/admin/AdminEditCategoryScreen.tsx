import React, { useState, useEffect } from 'react';
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
import { adminService, AdminCategory } from '../../services/adminService';
import { compressImageForUpload } from '../../utils/compressImage';

type AdminEditCategoryParams = { category: AdminCategory };

const AdminEditCategoryScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: AdminEditCategoryParams }, 'params'>>();
  const category = route.params?.category;
  const categoryId = category?.id;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [image, setImage] = useState<{ uri: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (category) {
      setName(category.name ?? '');
      setSlug(category.slug ?? '');
      setDescription(category.description ?? '');
      const activeVal = category.is_active;
      setIsActive(activeVal === 0 || activeVal === false ? false : true);
    }
  }, [category]);

  const currentImageUri =
    image?.uri ?? (category?.image_url ? category.image_url : category?.image ? buildFullImageUrl(category.image) : null);

  const pickImageFromDevice = async () => {
    if (pickingImage) return;
    setPickingImage(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('admin.categoryForm.permissionTitle'),
          t('admin.categoryForm.permissionBody'),
          [{ text: t('common.done') }]
        );
        return;
      }
      if (typeof ImagePicker.launchImageLibraryAsync !== 'function') {
        Alert.alert(
          t('admin.categoryForm.notAvailableTitle'),
          t('admin.categoryForm.notAvailableBody'),
          [{ text: t('common.done') }]
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
        setImage({ uri });
      }
    } catch (err: any) {
      Alert.alert(
        t('admin.categoryForm.unableToOpenTitle'),
        err?.message ?? t('admin.categoryForm.unableToOpenBody'),
        [{ text: t('common.done') }]
      );
    } finally {
      setPickingImage(false);
    }
  };

  const removeImage = () => setImage(null);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!name.trim()) newErrors.name = t('admin.categoryForm.errorNameRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdateCategory = async () => {
    if (!categoryId) return;
    if (!validateForm()) {
      Alert.alert(
        t('admin.categoryForm.missingFieldTitle'),
        t('admin.categoryForm.missingFieldMessage'),
        [{ text: t('common.done') }]
      );
      return;
    }

    setLoading(true);
    try {
      await adminService.updateCategory(categoryId, {
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
        is_active: isActive ? 1 : 0,
        image: image ?? undefined,
      });
      Alert.alert(
        t('admin.users.success'),
        t('admin.categoryForm.successUpdate'),
        [{ text: t('common.done'), onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        t('admin.categoryForm.updateFailed');
      Alert.alert(t('admin.users.error'), message);
    } finally {
      setLoading(false);
    }
  };

  if (!categoryId || !category) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('admin.categoryForm.editTitle')}</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>{t('admin.categoryForm.notFound')}</Text>
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
        <Text style={styles.headerTitle}>{t('admin.categoryForm.editTitle')}</Text>
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
            <Text style={styles.sectionTitle}>{t('admin.categoryForm.detailsSection')}</Text>

            <Input
              label={t('admin.categoryForm.nameLabel')}
              placeholder={t('admin.categoryForm.namePlaceholder')}
              value={name}
              onChangeText={(txt) => { setName(txt); if (errors.name) setErrors({ ...errors, name: '' }); }}
              leftIcon="pricetag-outline"
              error={errors.name}
            />

            <Input
              label={t('admin.categoryForm.slugLabel')}
              placeholder={t('admin.categoryForm.slugPlaceholder')}
              value={slug}
              onChangeText={setSlug}
              autoCapitalize="none"
            />

            <Input
              label={t('admin.categoryForm.descriptionLabel')}
              placeholder={t('admin.categoryForm.descriptionPlaceholder')}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>
                {t('admin.categoryForm.isActiveLabel', 'Status')}
              </Text>
              <View style={styles.toggleRight}>
                <Text style={styles.toggleValue}>
                  {isActive
                    ? t('admin.categoryForm.isActiveActive', 'Active')
                    : t('admin.categoryForm.inactiveStatus', 'Inactive')}
                </Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={COLORS.background}
                />
              </View>
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
            title={t('admin.categoryForm.submitUpdate')}
            onPress={handleUpdateCategory}
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
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: FONT_SIZES.sm, color: COLORS.error },
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  toggleLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  toggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  toggleValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
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

export default AdminEditCategoryScreen;
