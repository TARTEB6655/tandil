import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { buildFullImageUrl } from '../../config/api';
import { adminService, AdminBanner } from '../../services/adminService';
import { compressImageForUpload } from '../../utils/compressImage';

const AdminBannersScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const fabBottom = Math.max(insets.bottom, 12) + SPACING.lg;
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createVisible, setCreateVisible] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AdminBanner | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formButtonText, setFormButtonText] = useState('');
  const [formButtonLink, setFormButtonLink] = useState('');
  const [formPriority, setFormPriority] = useState('0');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formImageUri, setFormImageUri] = useState<string | null>(null);
  const [compressingImage, setCompressingImage] = useState(false);

  const fetchBanners = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await adminService.getBanners();
      setBanners(response.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || t('admin.banners.errorLoad'));
      setBanners([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      fetchBanners();
    }, [fetchBanners])
  );

  const onRefresh = useCallback(() => {
    fetchBanners(true);
  }, [fetchBanners]);

  const resetCreateForm = useCallback(() => {
    setEditingBanner(null);
    setFormTitle('');
    setFormDescription('');
    setFormButtonText('');
    setFormButtonLink('');
    setFormPriority('0');
    setFormIsActive(true);
    setFormImageUri(null);
  }, []);

  const openEditForm = useCallback((banner: AdminBanner) => {
    setEditingBanner(banner);
    setFormTitle(banner.title ?? '');
    setFormDescription(banner.description ?? '');
    setFormButtonText(banner.button_text ?? '');
    setFormButtonLink(banner.button_link ?? (banner.link ?? ''));
    setFormPriority(String(banner.priority ?? 0));
    setFormIsActive(banner.is_active !== false);
    setFormImageUri(null);
    setCreateVisible(true);
  }, []);

  const pickImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(t('admin.banners.permissionTitle'), t('admin.banners.permissionBody'));
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        const originalUri = res.assets[0].uri;
        setCompressingImage(true);
        try {
          const compressedUri = await compressImageForUpload(originalUri);
          setFormImageUri(compressedUri);
        } catch (_) {
          setFormImageUri(originalUri);
        } finally {
          setCompressingImage(false);
        }
      }
    } catch (e: any) {
      Alert.alert(t('admin.users.error'), e?.message || t('admin.banners.errorPickImage'));
      setCompressingImage(false);
    }
  }, [t]);

  const handleSaveBanner = useCallback(async () => {
    if (!formTitle.trim()) {
      Alert.alert(t('admin.users.error'), t('admin.banners.errorTitleRequired'));
      return;
    }
    const priorityNumber = Number(formPriority);
    if (Number.isNaN(priorityNumber)) {
      Alert.alert(t('admin.users.error'), t('admin.banners.errorPriorityNumber'));
      return;
    }

    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim() ? formDescription.trim() : undefined,
      button_text: formButtonText.trim() ? formButtonText.trim() : undefined,
      button_link: formButtonLink.trim() ? formButtonLink.trim() : undefined,
      priority: priorityNumber,
      is_active: formIsActive ? 1 : 0,
      image: formImageUri ? { uri: formImageUri } : undefined,
    };

    setCreating(true);
    try {
      if (editingBanner) {
        await adminService.updateBanner(editingBanner.id, payload);
        setCreateVisible(false);
        resetCreateForm();
        fetchBanners(true);
        Alert.alert(t('admin.users.success'), t('admin.banners.successUpdated'));
      } else {
        await adminService.createBanner(payload);
        setCreateVisible(false);
        resetCreateForm();
        fetchBanners(true);
        Alert.alert(t('admin.users.success'), t('admin.banners.successCreated'));
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || (editingBanner ? t('admin.banners.errorUpdate') : t('admin.banners.errorCreate'));
      Alert.alert(t('admin.users.error'), msg);
    } finally {
      setCreating(false);
    }
  }, [
    editingBanner,
    fetchBanners,
    formButtonLink,
    formButtonText,
    formDescription,
    formImageUri,
    formIsActive,
    formPriority,
    formTitle,
    resetCreateForm,
    t,
  ]);

  const handleDeleteBanner = useCallback(
    (banner: AdminBanner) => {
      Alert.alert(
        t('admin.banners.deleteTitle'),
        t('admin.banners.deleteMessage', { name: banner.title || t('admin.banners.untitled') }),
        [
          { text: t('admin.settings.cancel'), style: 'cancel' },
          {
            text: t('admin.users.delete'),
            style: 'destructive',
            onPress: async () => {
              setDeletingId(banner.id);
              try {
                await adminService.deleteBanner(banner.id);
                fetchBanners(true);
                Alert.alert(t('admin.users.success'), t('admin.banners.successDeleted'));
              } catch (err: any) {
                const msg = err.response?.data?.message || err.message || t('admin.banners.errorDelete');
                Alert.alert(t('admin.users.error'), msg);
              } finally {
                setDeletingId(null);
              }
            },
          },
        ]
      );
    },
    [fetchBanners, t]
  );

  const handleToggleStatus = useCallback(
    async (banner: AdminBanner) => {
      setTogglingId(banner.id);
      try {
        const res = await adminService.toggleBannerStatus(banner.id);
        const newActive = res.data?.is_active ?? !banner.is_active;
        setBanners((prev) =>
          prev.map((b) => (b.id === banner.id ? { ...b, is_active: newActive } : b))
        );
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || t('admin.banners.errorUpdateStatus');
        Alert.alert(t('admin.users.error'), msg);
      } finally {
        setTogglingId(null);
      }
    },
    [t]
  );

  const renderItem = ({ item }: { item: AdminBanner }) => {
    const imageUri = item.image_url ?? (item.image ? buildFullImageUrl(item.image) : null);
    const isDeleting = deletingId === item.id;
    const isToggling = togglingId === item.id;
    return (
      <View style={styles.row}>
        <TouchableOpacity style={styles.rowContent} onPress={() => openEditForm(item)} activeOpacity={0.7}>
          <View style={styles.bannerImageWrap}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.bannerImage} contentFit="cover" />
            ) : (
              <View style={[styles.bannerImage, styles.bannerPlaceholder]}>
                <Ionicons name="image-outline" size={32} color={COLORS.textSecondary} />
              </View>
            )}
          </View>
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={2}>{item.title || t('admin.banners.untitled')}</Text>
            {item.description ? (
              <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
            ) : null}
            {item.button_text ? (
              <Text style={styles.buttonText} numberOfLines={1}>{item.button_text}</Text>
            ) : null}
            <View style={styles.meta}>
              {item.priority != null && (
                <Text style={styles.metaText}>{t('admin.banners.priority')}: {item.priority}</Text>
              )}
              <Text style={[styles.metaText, item.is_active ? styles.active : styles.inactive]}>
                {item.is_active ? t('admin.banners.active') : t('admin.banners.inactive')}
              </Text>
            </View>
          </View>
          <View style={styles.arrowWrap}>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </View>
        </TouchableOpacity>
        <View style={styles.toggleWrap}>
          {isToggling ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Switch
              value={item.is_active !== false}
              onValueChange={() => handleToggleStatus(item)}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
              thumbColor={item.is_active !== false ? COLORS.primary : COLORS.background}
            />
          )}
        </View>
        <TouchableOpacity
          style={styles.deleteIconBtn}
          onPress={() => handleDeleteBanner(item)}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={COLORS.error} />
          ) : (
            <Ionicons name="trash-outline" size={22} color={COLORS.error} />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.banners.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      <Text style={styles.sectionHint}>{t('admin.banners.sectionHint')}</Text>

      {loading && !refreshing ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('admin.banners.loading')}</Text>
        </View>
      ) : error && banners.length === 0 ? (
        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchBanners()}>
            <Text style={styles.retryBtnText}>{t('admin.banners.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={banners}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{t('admin.banners.empty')}</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom }]}
        onPress={() => {
          resetCreateForm();
          setCreateVisible(true);
        }}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal visible={createVisible} transparent animationType="slide" onRequestClose={() => setCreateVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingBanner ? t('admin.banners.updateBanner') : t('admin.banners.createBanner')}</Text>
              <TouchableOpacity onPress={() => setCreateVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.md }}>
              <Text style={styles.inputLabel}>{t('admin.banners.titleLabel')}</Text>
              <TextInput
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder={t('admin.banners.placeholderTitle')}
                placeholderTextColor={COLORS.textSecondary}
                style={styles.input}
              />

              <Text style={styles.inputLabel}>{t('admin.banners.descriptionLabel')}</Text>
              <TextInput
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder={t('admin.banners.placeholderDescription')}
                placeholderTextColor={COLORS.textSecondary}
                style={styles.input}
              />

              <Text style={styles.inputLabel}>{t('admin.banners.buttonTextLabel')}</Text>
              <TextInput
                value={formButtonText}
                onChangeText={setFormButtonText}
                placeholder={t('admin.banners.placeholderDescription')}
                placeholderTextColor={COLORS.textSecondary}
                style={styles.input}
              />

              <Text style={styles.inputLabel}>{t('admin.banners.buttonLinkLabel')}</Text>
              <TextInput
                value={formButtonLink}
                onChangeText={setFormButtonLink}
                placeholder={t('admin.banners.placeholderButtonLink')}
                placeholderTextColor={COLORS.textSecondary}
                style={styles.input}
                autoCapitalize="none"
              />

              <View style={styles.rowInline}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t('admin.banners.priorityLabel')}</Text>
                  <TextInput
                    value={formPriority}
                    onChangeText={setFormPriority}
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                    style={styles.input}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.switchWrap}>
                  <Text style={styles.inputLabel}>{t('admin.banners.activeLabel')}</Text>
                  <Switch
                    value={formIsActive}
                    onValueChange={setFormIsActive}
                    trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                    thumbColor={formIsActive ? COLORS.primary : COLORS.background}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>{editingBanner ? t('admin.banners.imageLabelReplace') : t('admin.banners.imageLabel')}</Text>
              <View style={styles.imagePickRow}>
                <TouchableOpacity
                  style={[styles.imagePickBtn, compressingImage && { opacity: 0.7 }]}
                  onPress={pickImage}
                  disabled={compressingImage}
                >
                  {compressingImage ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="image-outline" size={18} color="#fff" />
                  )}
                  <Text style={styles.imagePickBtnText}>
                    {compressingImage ? t('admin.banners.compressing') : formImageUri ? t('admin.banners.changeImage') : t('admin.banners.chooseImage')}
                  </Text>
                </TouchableOpacity>
                {formImageUri ? (
                  <TouchableOpacity onPress={() => setFormImageUri(null)} style={styles.imageClearBtn}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {(() => {
                const previewUri = formImageUri ?? (editingBanner && (editingBanner.image_url ?? (editingBanner.image ? buildFullImageUrl(editingBanner.image) : null)));
                if (!previewUri) return null;
                return (
                  <View style={styles.previewWrap}>
                    <Image source={{ uri: previewUri }} style={styles.previewImage} contentFit="cover" />
                  </View>
                );
              })()}

              <TouchableOpacity
                style={[styles.createBtn, creating && { opacity: 0.7 }]}
                disabled={creating}
                onPress={handleSaveBanner}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                )}
                <Text style={styles.createBtnText}>{creating ? t('admin.banners.saving') : editingBanner ? t('admin.banners.update') : t('admin.banners.save')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  sectionHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  listContent: { padding: SPACING.lg, paddingBottom: SPACING.xl * 3 },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  errorText: { fontSize: FONT_SIZES.sm, color: COLORS.error, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  retryBtnText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.background },
  emptyWrap: { paddingVertical: SPACING.xl * 2, alignItems: 'center' },
  emptyText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  rowContent: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  toggleWrap: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.xs,
  },
  deleteIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.xs,
  },
  bannerImageWrap: {
    width: 72,
    height: 72,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.border + '40',
  },
  bannerImage: { width: '100%', height: '100%' },
  bannerPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  info: { marginLeft: SPACING.md, flex: 1, minWidth: 0 },
  title: { color: COLORS.text, fontWeight: FONT_WEIGHTS.semiBold, fontSize: FONT_SIZES.md, marginBottom: 2 },
  description: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginBottom: 2 },
  buttonText: { color: COLORS.primary, fontSize: FONT_SIZES.xs, marginBottom: 2 },
  meta: { flexDirection: 'row', gap: SPACING.sm, marginTop: 2 },
  metaText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  active: { color: COLORS.success },
  inactive: { color: COLORS.textSecondary },
  arrowWrap: { marginLeft: SPACING.xs },

  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  modalTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  modalCloseBtn: { padding: SPACING.xs },
  inputLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  rowInline: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  switchWrap: { alignItems: 'flex-start', justifyContent: 'flex-end', paddingBottom: SPACING.md },
  imagePickRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  imagePickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  imagePickBtnText: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold, fontSize: FONT_SIZES.sm },
  imageClearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewWrap: {
    width: '100%',
    height: 160,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  previewImage: { width: '100%', height: '100%' },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    marginTop: SPACING.xs,
  },
  createBtnText: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold, fontSize: FONT_SIZES.md },
});

export default AdminBannersScreen;
