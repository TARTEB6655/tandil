import React, { useState, useCallback, useMemo } from 'react';
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
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { buildFullImageUrl } from '../../config/api';
import {
  adminService,
  AdminMaintenancePhoto,
  isMaintenancePhotoActive,
} from '../../services/adminService';
import { compressImageForUpload } from '../../utils/compressImage';

const SCREEN_WIDTH = Dimensions.get('window').width;

function photoImageUrl(photo: AdminMaintenancePhoto, kind: 'before' | 'after'): string | null {
  const raw =
    kind === 'before'
      ? photo.before_image_url ?? photo.before_image ?? null
      : photo.after_image_url ?? photo.after_image ?? null;
  if (!raw) return null;
  return raw.startsWith('http') ? raw : buildFullImageUrl(raw);
}

const AdminMaintenancePhotosScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [photos, setPhotos] = useState<AdminMaintenancePhoto[]>([]);
  const [listMeta, setListMeta] = useState<{ total?: number; per_page?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<AdminMaintenancePhoto | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formPriority, setFormPriority] = useState('0');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formBeforeUri, setFormBeforeUri] = useState<string | null>(null);
  const [formAfterUri, setFormAfterUri] = useState<string | null>(null);
  const [compressingKind, setCompressingKind] = useState<'before' | 'after' | null>(null);

  const activeCount = useMemo(
    () => photos.filter((p) => isMaintenancePhotoActive(p)).length,
    [photos]
  );

  const fetchPhotos = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await adminService.getMaintenancePhotos({ per_page: 20 });
      const sorted = [...(response.data ?? [])].sort(
        (a, b) => (a.priority ?? 0) - (b.priority ?? 0)
      );
      setPhotos(sorted);
      setListMeta(response.meta ?? { total: sorted.length, per_page: 20 });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message || ax.message || t('admin.maintenancePhotos.errorLoad'));
      setPhotos([]);
      setListMeta(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      fetchPhotos();
    }, [fetchPhotos])
  );

  const resetForm = useCallback(() => {
    setEditingPhoto(null);
    setFormTitle('');
    setFormPriority('0');
    setFormIsActive(true);
    setFormBeforeUri(null);
    setFormAfterUri(null);
  }, []);

  const openCreateForm = useCallback(() => {
    resetForm();
    setFormVisible(true);
  }, [resetForm]);

  const openEditForm = useCallback((photo: AdminMaintenancePhoto) => {
    setEditingPhoto(photo);
    setFormTitle(photo.title ?? '');
    setFormPriority(String(photo.priority ?? 0));
    setFormIsActive(isMaintenancePhotoActive(photo));
    setFormBeforeUri(null);
    setFormAfterUri(null);
    setFormVisible(true);
  }, []);

  const pickImage = useCallback(
    async (kind: 'before' | 'after') => {
      try {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
          return;
        }

        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 5],
          quality: 0.85,
        });
        if (!res.canceled && res.assets?.[0]?.uri) {
          const originalUri = res.assets[0].uri;
          setCompressingKind(kind);
          try {
            const compressedUri = await compressImageForUpload(originalUri);
            if (kind === 'before') setFormBeforeUri(compressedUri);
            else setFormAfterUri(compressedUri);
          } catch {
            if (kind === 'before') setFormBeforeUri(originalUri);
            else setFormAfterUri(originalUri);
          } finally {
            setCompressingKind(null);
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        Alert.alert(t('admin.users.error'), msg || t('admin.maintenancePhotos.errorPickImage'));
        setCompressingKind(null);
      }
    },
    [t]
  );

  const handleSave = useCallback(async () => {
    const priorityNumber = Number(formPriority);
    if (Number.isNaN(priorityNumber)) {
      Alert.alert(t('admin.users.error'), t('admin.maintenancePhotos.errorPriorityNumber'));
      return;
    }

    if (!editingPhoto && (!formBeforeUri || !formAfterUri)) {
      Alert.alert(t('admin.users.error'), t('admin.maintenancePhotos.errorBothImagesRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formTitle.trim() || undefined,
        priority: priorityNumber,
        active: formIsActive ? 1 : 0,
        before_image: formBeforeUri ? { uri: formBeforeUri } : undefined,
        after_image: formAfterUri ? { uri: formAfterUri } : undefined,
      };

      if (editingPhoto) {
        await adminService.updateMaintenancePhoto(editingPhoto.id, payload);
        Alert.alert(t('admin.users.success'), t('admin.maintenancePhotos.successUpdated'));
      } else {
        await adminService.createMaintenancePhoto({
          ...payload,
          before_image: { uri: formBeforeUri! },
          after_image: { uri: formAfterUri! },
        });
        Alert.alert(t('admin.users.success'), t('admin.maintenancePhotos.successCreated'));
      }
      setFormVisible(false);
      resetForm();
      fetchPhotos(true);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      const msg =
        ax.response?.data?.message ||
        ax.message ||
        (editingPhoto
          ? t('admin.maintenancePhotos.errorUpdate')
          : t('admin.maintenancePhotos.errorCreate'));
      Alert.alert(t('admin.users.error'), msg);
    } finally {
      setSaving(false);
    }
  }, [
    editingPhoto,
    fetchPhotos,
    formAfterUri,
    formBeforeUri,
    formIsActive,
    formPriority,
    formTitle,
    resetForm,
    t,
  ]);

  const handleDelete = useCallback(
    (photo: AdminMaintenancePhoto) => {
      Alert.alert(
        t('admin.maintenancePhotos.deleteTitle'),
        t('admin.maintenancePhotos.deleteMessage', {
          name: photo.title || t('admin.maintenancePhotos.untitled'),
        }),
        [
          { text: t('admin.settings.cancel'), style: 'cancel' },
          {
            text: t('admin.users.delete'),
            style: 'destructive',
            onPress: async () => {
              setDeletingId(photo.id);
              try {
                await adminService.deleteMaintenancePhoto(photo.id);
                fetchPhotos(true);
                Alert.alert(t('admin.users.success'), t('admin.maintenancePhotos.successDeleted'));
              } catch (err: unknown) {
                const ax = err as { response?: { data?: { message?: string } }; message?: string };
                Alert.alert(
                  t('admin.users.error'),
                  ax.response?.data?.message || ax.message || t('admin.maintenancePhotos.errorDelete')
                );
              } finally {
                setDeletingId(null);
              }
            },
          },
        ]
      );
    },
    [fetchPhotos, t]
  );

  const renderImageSlot = (
    kind: 'before' | 'after',
    uri: string | null,
    existingUri: string | null
  ) => {
    const previewUri = uri ?? existingUri;
    const isBefore = kind === 'before';
    const label = isBefore
      ? t('admin.maintenancePhotos.before')
      : t('admin.maintenancePhotos.after');
    const isCompressing = compressingKind === kind;

    return (
      <TouchableOpacity
        style={[styles.uploadSlot, isBefore ? styles.uploadSlotBefore : styles.uploadSlotAfter]}
        onPress={() => pickImage(kind)}
        activeOpacity={0.85}
        disabled={isCompressing}
      >
        {previewUri ? (
          <>
            <Image source={{ uri: previewUri }} style={styles.uploadPreview} contentFit="cover" />
            <View style={styles.uploadOverlay}>
              <Ionicons name="camera" size={18} color="#fff" />
              <Text style={styles.uploadOverlayText}>{t('admin.maintenancePhotos.changeImage')}</Text>
            </View>
          </>
        ) : (
          <View style={styles.uploadEmpty}>
            {isCompressing ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <>
                <View style={[styles.uploadIconCircle, isBefore && styles.uploadIconCircleBefore]}>
                  <Ionicons
                    name={isBefore ? 'image-outline' : 'sparkles-outline'}
                    size={22}
                    color={isBefore ? '#8B6914' : COLORS.primary}
                  />
                </View>
                <Text style={styles.uploadEmptyTitle}>{label}</Text>
                <Text style={styles.uploadEmptyHint}>{t('admin.maintenancePhotos.tapToUpload')}</Text>
              </>
            )}
          </View>
        )}
        <View style={[styles.kindBadge, isBefore ? styles.kindBadgeBefore : styles.kindBadgeAfter]}>
          <Text style={styles.kindBadgeText}>{label}</Text>
        </View>
        {uri ? (
          <TouchableOpacity
            style={styles.clearImageBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              if (kind === 'before') setFormBeforeUri(null);
              else setFormAfterUri(null);
            }}
          >
            <Ionicons name="close-circle" size={22} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: AdminMaintenancePhoto }) => {
    const beforeUri = photoImageUrl(item, 'before');
    const afterUri = photoImageUrl(item, 'after');
    const isDeleting = deletingId === item.id;
    const itemActive = isMaintenancePhotoActive(item);

    return (
      <View style={styles.card}>
        <View style={styles.cardImageRow}>
          <View style={styles.cardImageHalf}>
            {beforeUri ? (
              <Image source={{ uri: beforeUri }} style={styles.cardImage} contentFit="cover" />
            ) : (
              <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                <Ionicons name="image-outline" size={28} color={COLORS.textSecondary} />
              </View>
            )}
            <View style={[styles.cardBadge, styles.cardBadgeBefore]}>
              <Text style={styles.cardBadgeText}>{t('admin.maintenancePhotos.before')}</Text>
            </View>
          </View>
          <View style={styles.cardDivider}>
            <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
          </View>
          <View style={styles.cardImageHalf}>
            {afterUri ? (
              <Image source={{ uri: afterUri }} style={styles.cardImage} contentFit="cover" />
            ) : (
              <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                <Ionicons name="image-outline" size={28} color={COLORS.textSecondary} />
              </View>
            )}
            <View style={[styles.cardBadge, styles.cardBadgeAfter]}>
              <Text style={styles.cardBadgeText}>{t('admin.maintenancePhotos.after')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title || t('admin.maintenancePhotos.untitled')}
            </Text>
            <View style={styles.cardMetaRow}>
              <View style={styles.metaPill}>
                <Ionicons name="reorder-three-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.metaPillText}>
                  {t('admin.maintenancePhotos.priority')}: {item.priority ?? 0}
                </Text>
              </View>
              <View style={[styles.metaPill, itemActive ? styles.metaPillActive : styles.metaPillInactive]}>
                <View style={[styles.statusDot, itemActive && styles.statusDotActive]} />
                <Text style={[styles.metaPillText, itemActive && styles.metaPillTextActive]}>
                  {itemActive
                    ? t('admin.maintenancePhotos.active')
                    : t('admin.maintenancePhotos.inactive')}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.editBtn} onPress={() => openEditForm(item)}>
              <Ionicons name="create-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={COLORS.error} />
              ) : (
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const listHeader = (
    <View style={styles.heroCard}>
      <View style={styles.heroIconWrap}>
        <Ionicons name="images" size={28} color={COLORS.primary} />
      </View>
      <View style={styles.heroText}>
        <Text style={styles.heroTitle}>{t('admin.maintenancePhotos.heroTitle')}</Text>
        <Text style={styles.heroSubtitle}>{t('admin.maintenancePhotos.sectionHint')}</Text>
      </View>
      <View style={styles.heroStats}>
        <Text style={styles.heroStatNumber}>{listMeta?.total ?? photos.length}</Text>
        <Text style={styles.heroStatLabel}>{t('admin.maintenancePhotos.total')}</Text>
        <Text style={[styles.heroStatNumber, { marginTop: 6 }]}>{activeCount}</Text>
        <Text style={styles.heroStatLabel}>{t('admin.maintenancePhotos.active')}</Text>
      </View>
    </View>
  );

  const listFooter =
    photos.length > 0 ? (
      <Text style={styles.listFooterText}>
        {t('admin.maintenancePhotos.listCount', {
          count: photos.length,
          total: listMeta?.total ?? photos.length,
        })}
      </Text>
    ) : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.maintenancePhotos.title')}</Text>
        <TouchableOpacity style={styles.headerAddBtn} onPress={openCreateForm}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('admin.maintenancePhotos.loading')}</Text>
        </View>
      ) : error && photos.length === 0 ? (
        <View style={styles.centerWrap}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={40} color={COLORS.error} />
          </View>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPhotos()}>
            <Text style={styles.retryBtnText}>{t('admin.maintenancePhotos.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={photos}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchPhotos(true)} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="albums-outline" size={44} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t('admin.maintenancePhotos.emptyTitle')}</Text>
              <Text style={styles.emptyText}>{t('admin.maintenancePhotos.empty')}</Text>
              <TouchableOpacity style={styles.emptyCta} onPress={openCreateForm}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.emptyCtaText}>{t('admin.maintenancePhotos.createPhoto')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={openCreateForm}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingPhoto
                    ? t('admin.maintenancePhotos.updatePhoto')
                    : t('admin.maintenancePhotos.createPhoto')}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {t('admin.maintenancePhotos.formSubtitle')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setFormVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>{t('admin.maintenancePhotos.detailsSection')}</Text>
                <Text style={styles.inputLabel}>{t('admin.maintenancePhotos.titleLabel')}</Text>
                <TextInput
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholder={t('admin.maintenancePhotos.placeholderTitle')}
                  placeholderTextColor={COLORS.textSecondary}
                  style={styles.input}
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>{t('admin.maintenancePhotos.imagesSection')}</Text>
                <View style={styles.uploadRow}>
                  {renderImageSlot(
                    'before',
                    formBeforeUri,
                    editingPhoto ? photoImageUrl(editingPhoto, 'before') : null
                  )}
                  {renderImageSlot(
                    'after',
                    formAfterUri,
                    editingPhoto ? photoImageUrl(editingPhoto, 'after') : null
                  )}
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>{t('admin.maintenancePhotos.displaySection')}</Text>
                <View style={styles.settingsCard}>
                  <View style={styles.settingsRow}>
                    <View style={styles.settingsRowText}>
                      <Text style={styles.settingsRowTitle}>{t('admin.maintenancePhotos.priorityLabel')}</Text>
                      <Text style={styles.settingsRowHint}>
                        {t('admin.maintenancePhotos.priorityHint')}
                      </Text>
                    </View>
                    <TextInput
                      value={formPriority}
                      onChangeText={setFormPriority}
                      placeholder="0"
                      placeholderTextColor={COLORS.textSecondary}
                      style={styles.priorityInput}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.settingsDivider} />
                  <View style={styles.settingsRow}>
                    <View style={styles.settingsRowText}>
                      <Text style={styles.settingsRowTitle}>{t('admin.maintenancePhotos.activeLabel')}</Text>
                      <Text style={styles.settingsRowHint}>
                        {t('admin.maintenancePhotos.activeHint')}
                      </Text>
                    </View>
                    <Switch
                      value={formIsActive}
                      onValueChange={setFormIsActive}
                      trackColor={{ false: COLORS.border, true: COLORS.primary + '55' }}
                      thumbColor={formIsActive ? COLORS.primary : COLORS.background}
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
                )}
                <Text style={styles.saveBtnText}>
                  {saving
                    ? t('admin.maintenancePhotos.saving')
                    : editingPhoto
                      ? t('admin.maintenancePhotos.update')
                      : t('admin.maintenancePhotos.save')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const SLOT_WIDTH = (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.sm) / 2;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SPACING.xs, marginRight: SPACING.sm },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  headerAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  loadingText: { marginTop: SPACING.md, color: COLORS.textSecondary },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: SPACING.md,
    color: COLORS.error,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.lg,
  },
  retryBtnText: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold },
  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: 110 },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '12',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '25',
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  heroText: { flex: 1 },
  heroTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  heroSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  heroStats: { alignItems: 'center', minWidth: 44 },
  heroStatNumber: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.primary },
  heroStatLabel: { fontSize: 10, color: COLORS.textSecondary },
  listFooterText: {
    textAlign: 'center',
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    paddingVertical: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardImageRow: { flexDirection: 'row', height: 130, backgroundColor: '#ECEAE4' },
  cardImageHalf: { flex: 1, position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E6E0' },
  cardDivider: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    zIndex: 2,
    marginHorizontal: -14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.primary + '30',
  },
  cardBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
  },
  cardBadgeBefore: { backgroundColor: 'rgba(0,0,0,0.55)' },
  cardBadgeAfter: { backgroundColor: COLORS.primary },
  cardBadgeText: { color: '#fff', fontSize: 10, fontWeight: FONT_WEIGHTS.semiBold },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  cardMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: 8 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  metaPillActive: { backgroundColor: COLORS.primary + '15' },
  metaPillInactive: { backgroundColor: '#EEE' },
  metaPillText: { fontSize: 11, color: COLORS.textSecondary },
  metaPillTextActive: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.medium },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#AAA' },
  statusDotActive: { backgroundColor: COLORS.primary },
  cardActions: { flexDirection: 'row', gap: SPACING.xs },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.error + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: { alignItems: 'center', paddingTop: SPACING.xl, paddingHorizontal: SPACING.lg },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.lg,
  },
  emptyCtaText: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold },
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
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    maxHeight: '94%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  modalTitle: { fontSize: FONT_SIZES.xl, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  modalSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
    maxWidth: SCREEN_WIDTH * 0.72,
  },
  modalCloseBtn: { padding: SPACING.xs },
  modalScroll: { paddingBottom: SPACING.xl },
  formSection: { marginBottom: SPACING.lg },
  sectionLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inputLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: '#F8FAF7',
    borderWidth: 1.5,
    borderColor: '#D5DCE5',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
  },
  uploadRow: { flexDirection: 'row', gap: SPACING.sm },
  uploadSlot: {
    width: SLOT_WIDTH,
    height: SLOT_WIDTH * 1.2,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderStyle: 'dashed',
    position: 'relative',
  },
  uploadSlotBefore: { borderColor: '#C9B896', backgroundColor: '#FAF7F0' },
  uploadSlotAfter: { borderColor: COLORS.primary + '55', backgroundColor: COLORS.primary + '08' },
  uploadPreview: { width: '100%', height: '100%' },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  uploadOverlayText: { color: '#fff', fontSize: 11, fontWeight: FONT_WEIGHTS.semiBold },
  uploadEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.sm },
  uploadIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  uploadIconCircleBefore: { backgroundColor: '#EDE4D3' },
  uploadEmptyTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  uploadEmptyHint: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
  kindBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
  },
  kindBadgeBefore: { backgroundColor: 'rgba(0,0,0,0.6)' },
  kindBadgeAfter: { backgroundColor: COLORS.primary },
  kindBadgeText: { color: '#fff', fontSize: 10, fontWeight: FONT_WEIGHTS.bold },
  clearImageBtn: { position: 'absolute', top: 8, right: 8 },
  settingsCard: {
    backgroundColor: '#F8FAF7',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  settingsRowText: { flex: 1 },
  settingsRowTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.medium, color: COLORS.text },
  settingsRowHint: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  settingsDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },
  priorityInput: {
    width: 56,
    textAlign: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md + 2,
    marginTop: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBtnText: { color: '#fff', fontWeight: FONT_WEIGHTS.bold, fontSize: FONT_SIZES.md },
});

export default AdminMaintenancePhotosScreen;
