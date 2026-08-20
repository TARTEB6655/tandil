import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import {
  adminVendorMetaService,
} from '../../services/adminVendorMetaService';
import type { AdminVendorMetaItem } from '../../types/adminVendorMeta';

type TabKey = 'types' | 'emirates';

type FormState = {
  id?: number;
  name: string;
  slug: string;
  is_active: boolean;
};

const emptyForm = (): FormState => ({
  name: '',
  slug: '',
  is_active: true,
});

const AdminVendorTypesEmiratesScreen: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>('types');
  const [types, setTypes] = useState<AdminVendorMetaItem[]>([]);
  const [emirates, setEmirates] = useState<AdminVendorMetaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const isTypes = tab === 'types';
  const list = isTypes ? types : emirates;
  const isEdit = form.id != null;

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [typesRes, emiratesRes] = await Promise.all([
          adminVendorMetaService.listVendorTypes(),
          adminVendorMetaService.listEmirates(),
        ]);
        setTypes(typesRes);
        setEmirates(emiratesRes);
      } catch (err) {
        Alert.alert(
          t('admin.users.error', 'Error'),
          adminVendorMetaService.getErrorMessage(
            err,
            t('admin.vendorMeta.loadFailed', 'Failed to load list.')
          )
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openCreate = () => {
    setForm(emptyForm());
    setModalVisible(true);
  };

  const openEdit = async (item: AdminVendorMetaItem) => {
    // Prefill from list, then refresh via GET /admin/vendor-types/:id (or emirates)
    setForm({
      id: item.id,
      name: item.name,
      slug: item.slug || '',
      is_active: item.is_active,
    });
    setModalVisible(true);
    setLoadingDetail(true);
    try {
      const detail = isTypes
        ? await adminVendorMetaService.getVendorType(item.id)
        : await adminVendorMetaService.getEmirate(item.id);
      setForm({
        id: detail.id,
        name: detail.name,
        slug: detail.slug || '',
        is_active: detail.is_active,
      });
    } catch (err) {
      // Keep list values; surface soft warning
      Alert.alert(
        t('admin.users.error', 'Error'),
        adminVendorMetaService.getErrorMessage(
          err,
          t('admin.vendorMeta.loadFailed', 'Failed to load list.')
        )
      );
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeModal = () => {
    if (saving || loadingDetail) return;
    setModalVisible(false);
    setForm(emptyForm());
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      Alert.alert(
        t('admin.users.error', 'Error'),
        t('admin.vendorMeta.nameRequired', 'Name is required.')
      );
      return;
    }
    setSaving(true);
    try {
      const input = {
        name,
        slug: form.slug.trim() || undefined,
        is_active: form.is_active,
      };
      if (isEdit && form.id != null) {
        const updated = isTypes
          ? await adminVendorMetaService.updateVendorType(form.id, input)
          : await adminVendorMetaService.updateEmirate(form.id, input);
        if (isTypes) {
          setTypes((prev) => prev.map((row) => (row.id === form.id ? updated : row)));
        } else {
          setEmirates((prev) => prev.map((row) => (row.id === form.id ? updated : row)));
        }
      } else {
        const created = isTypes
          ? await adminVendorMetaService.createVendorType(input)
          : await adminVendorMetaService.createEmirate(input);
        if (isTypes) setTypes((prev) => [...prev, created]);
        else setEmirates((prev) => [...prev, created]);
      }
      setModalVisible(false);
      setForm(emptyForm());
      load(true);
    } catch (err) {
      Alert.alert(
        t('admin.users.error', 'Error'),
        adminVendorMetaService.getErrorMessage(
          err,
          t('admin.vendorMeta.saveFailed', 'Failed to save.')
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: AdminVendorMetaItem) => {
    const message = isTypes
      ? t('admin.vendorMeta.deleteTypeMessage', 'Delete vendor type "{{name}}?"').replace(
          '{{name}}',
          item.name
        )
      : t('admin.vendorMeta.deleteEmirateMessage', 'Delete emirate "{{name}}?"').replace(
          '{{name}}',
          item.name
        );

    Alert.alert(t('admin.vendorMeta.deleteTitle', 'Delete?'), message, [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('common.delete', 'Delete'),
        style: 'destructive',
        onPress: async () => {
          setDeletingId(item.id);
          try {
            if (isTypes) await adminVendorMetaService.deleteVendorType(item.id);
            else await adminVendorMetaService.deleteEmirate(item.id);
            if (isTypes) setTypes((prev) => prev.filter((row) => row.id !== item.id));
            else setEmirates((prev) => prev.filter((row) => row.id !== item.id));
          } catch (err) {
            Alert.alert(
              t('admin.users.error', 'Error'),
              adminVendorMetaService.getErrorMessage(
                err,
                t('admin.vendorMeta.deleteFailed', 'Failed to delete.')
              )
            );
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const handleToggleStatus = async (item: AdminVendorMetaItem) => {
    if (togglingId != null) return;
    setTogglingId(item.id);
    const prevActive = item.is_active;
    const applyLocal = (active: boolean) => {
      const patch = (row: AdminVendorMetaItem) =>
        row.id === item.id ? { ...row, is_active: active } : row;
      if (isTypes) setTypes((rows) => rows.map(patch));
      else setEmirates((rows) => rows.map(patch));
    };
    applyLocal(!prevActive);
    try {
      const updated = isTypes
        ? await adminVendorMetaService.toggleVendorTypeStatus(item.id)
        : await adminVendorMetaService.toggleEmirateStatus(item.id);
      if (updated) {
        const patch = (row: AdminVendorMetaItem) => (row.id === item.id ? updated : row);
        if (isTypes) setTypes((rows) => rows.map(patch));
        else setEmirates((rows) => rows.map(patch));
      }
    } catch (err) {
      applyLocal(prevActive);
      Alert.alert(
        t('admin.users.error', 'Error'),
        adminVendorMetaService.getErrorMessage(
          err,
          t('admin.vendorMeta.toggleFailed', 'Failed to update status.')
        )
      );
    } finally {
      setTogglingId(null);
    }
  };

  const modalTitle = useMemo(() => {
    if (isTypes) {
      return isEdit
        ? t('admin.vendorMeta.editType', 'Edit vendor type')
        : t('admin.vendorMeta.addType', 'Add vendor type');
    }
    return isEdit
      ? t('admin.vendorMeta.editEmirate', 'Edit emirate')
      : t('admin.vendorMeta.addEmirate', 'Add emirate');
  }, [isEdit, isTypes, t]);

  const activeCount = useMemo(() => list.filter((i) => i.is_active).length, [list]);

  const renderItem = ({ item }: { item: AdminVendorMetaItem }) => {
    const deleting = deletingId === item.id;
    const toggling = togglingId === item.id;
    const accent = item.is_active ? COLORS.primary : COLORS.textSecondary;

    return (
      <View style={[styles.card, !item.is_active && styles.cardInactive]}>
        <View style={[styles.cardAccent, { backgroundColor: accent }]} />
        <TouchableOpacity
          style={styles.cardBody}
          onPress={() => openEdit(item)}
          activeOpacity={0.88}
        >
          <View style={[styles.cardIcon, { backgroundColor: accent + '18' }]}>
            <Ionicons name={isTypes ? 'leaf' : 'location'} size={20} color={accent} />
          </View>
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.cardMetaRow}>
              {!!item.slug && (
                <Text style={styles.cardSlug} numberOfLines={1}>
                  {item.slug}
                </Text>
              )}
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: item.is_active ? COLORS.primary + '16' : '#EEF0F2' },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: item.is_active ? COLORS.primary : COLORS.textSecondary },
                  ]}
                />
                <Text
                  style={[
                    styles.statusPillText,
                    { color: item.is_active ? COLORS.primary : COLORS.textSecondary },
                  ]}
                >
                  {item.is_active
                    ? t('admin.vendorMeta.active', 'Active')
                    : t('admin.vendorMeta.inactive', 'Inactive')}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.cardActions}>
          <View style={styles.toggleWrap}>
            {toggling ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Switch
                value={item.is_active}
                onValueChange={() => handleToggleStatus(item)}
                trackColor={{ false: '#D1D5DB', true: COLORS.primary + 'AA' }}
                thumbColor={item.is_active ? COLORS.primary : '#f4f3f4'}
                ios_backgroundColor="#D1D5DB"
              />
            )}
          </View>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => openEdit(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="create-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleDelete(item)}
            disabled={deleting}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={COLORS.error} />
            ) : (
              <Ionicons name="trash-outline" size={18} color={COLORS.error} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Header
        title={t('admin.vendorMeta.title', 'Vendor types & Emirates')}
        showBack
        rightComponent={
          <TouchableOpacity
            onPress={openCreate}
            style={styles.headerAddBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add-circle" size={28} color={COLORS.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, isTypes && styles.tabActive]}
          onPress={() => setTab('types')}
        >
          <Ionicons
            name="leaf-outline"
            size={16}
            color={isTypes ? '#fff' : COLORS.textSecondary}
          />
          <Text style={[styles.tabText, isTypes && styles.tabTextActive]}>
            {t('admin.vendorMeta.tabTypes', 'Vendor types')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, !isTypes && styles.tabActive]}
          onPress={() => setTab('emirates')}
        >
          <Ionicons
            name="location-outline"
            size={16}
            color={!isTypes ? '#fff' : COLORS.textSecondary}
          />
          <Text style={[styles.tabText, !isTypes && styles.tabTextActive]}>
            {t('admin.vendorMeta.tabEmirates', 'Emirates')}
          </Text>
        </TouchableOpacity>
      </View>

      {!loading && list.length > 0 ? (
        <View style={styles.summaryRow}>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryValue}>{list.length}</Text>
            <Text style={styles.summaryLabel}>{t('admin.vendorMeta.total', 'Total')}</Text>
          </View>
          <View style={[styles.summaryChip, styles.summaryChipActive]}>
            <Text style={[styles.summaryValue, { color: COLORS.primary }]}>{activeCount}</Text>
            <Text style={[styles.summaryLabel, { color: COLORS.primary }]}>
              {t('admin.vendorMeta.active', 'Active')}
            </Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryValue}>{list.length - activeCount}</Text>
            <Text style={styles.summaryLabel}>{t('admin.vendorMeta.inactive', 'Inactive')}</Text>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => `${tab}-${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={list.length === 0 ? styles.emptyContent : styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name={isTypes ? 'leaf-outline' : 'location-outline'}
                  size={36}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.emptyText}>
                {isTypes
                  ? t('admin.vendorMeta.emptyTypes', 'No vendor types yet. Tap + to add one.')
                  : t('admin.vendorMeta.emptyEmirates', 'No emirates yet. Tap + to add one.')}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={closeModal} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            {loadingDetail ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>{t('admin.vendorMeta.name', 'Name')}</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
              placeholder={
                isTypes
                  ? t('admin.vendorMeta.namePlaceholderType', 'e.g. Fruits')
                  : t('admin.vendorMeta.namePlaceholderEmirate', 'e.g. Dubai')
              }
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="words"
              editable={!loadingDetail}
            />

            <Text style={styles.fieldLabel}>{t('admin.vendorMeta.slug', 'Slug (optional)')}</Text>
            <TextInput
              style={styles.input}
              value={form.slug}
              onChangeText={(slug) => setForm((prev) => ({ ...prev, slug }))}
              placeholder={t('admin.vendorMeta.slugPlaceholder', 'Auto from name if empty')}
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loadingDetail}
            />

            <View style={styles.switchRow}>
              <Text style={styles.fieldLabelInline}>
                {t('admin.vendorMeta.active', 'Active')}
              </Text>
              <Switch
                value={form.is_active}
                onValueChange={(is_active) => setForm((prev) => ({ ...prev, is_active }))}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '80' }}
                thumbColor={form.is_active ? COLORS.primary : '#f4f3f4'}
                disabled={loadingDetail}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={closeModal}
                disabled={saving || loadingDetail}
              >
                <Text style={styles.cancelText}>{t('admin.vendorMeta.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving || loadingDetail}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>{t('admin.vendorMeta.save', 'Save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F6F4' },
  headerAddBtn: { paddingHorizontal: SPACING.xs },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
  },
  tabTextActive: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold },
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  summaryChip: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryChipActive: {
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '10',
  },
  summaryValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  emptyContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACING.xl },
  emptyWrap: { alignItems: 'center', gap: SPACING.md },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    shadowColor: '#0B3D2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardInactive: {
    opacity: 0.88,
    backgroundColor: '#FAFBFA',
  },
  cardAccent: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextWrap: { flex: 1, gap: 4 },
  cardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardSlug: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    maxWidth: '55%',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.round,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: SPACING.sm,
    gap: 2,
  },
  toggleWrap: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalDismiss: { flex: 1 },
  modalCard: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  modalLoading: {
    alignItems: 'center',
    paddingBottom: SPACING.sm,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  fieldLabelInline: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceLight,
    marginBottom: SPACING.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  saveText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: '#fff',
  },
});

export default AdminVendorTypesEmiratesScreen;
