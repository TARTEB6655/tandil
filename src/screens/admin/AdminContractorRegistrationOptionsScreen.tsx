import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
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
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import {
  adminContractorSignupOptionsService,
  CONTRACTOR_SIGNUP_PARENT_LABEL,
  CONTRACTOR_SIGNUP_PARENT_TAB,
  CONTRACTOR_SIGNUP_TAB_SINGULAR,
  contractorSignupTabIcon,
  isContractorSignupTabHidden,
  normalizeContractorSignupTabKey,
  signupOptionTabForItem,
  type ContractorSignupOptionItem,
  type ContractorSignupOptionsScreen,
  type ContractorSignupOptionsTab,
  type ContractorSignupOptionsTabKey,
} from '../../services/adminContractorSignupOptionsService';
import MapPickerModal from '../../components/MapPickerModal';
import type { AddressFromLocation } from '../../utils/addressFromLocation';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const LOCATION_SIGNUP_TABS: ContractorSignupOptionsTabKey[] = ['emirates', 'coverage'];

function isLocationSignupTab(tabKey: ContractorSignupOptionsTabKey): boolean {
  return LOCATION_SIGNUP_TABS.includes(tabKey);
}

function slugifyAscii(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function displayNameFromMap(
  tabKey: ContractorSignupOptionsTabKey,
  address: AddressFromLocation
): string {
  switch (tabKey) {
    case 'emirates':
      return address.state || address.city || address.street_address;
    case 'coverage':
      return (
        [address.street_address, address.city].filter(Boolean).join(', ') ||
        address.city ||
        address.state
      );
    default:
      return address.street_address;
  }
}

function tabIconName(icon: string): IoniconName {
  return (contractorSignupTabIcon(icon) as IoniconName) || 'ellipse-outline';
}

type FormState = {
  id?: number;
  name: string;
  slug: string;
  is_active: boolean;
  parent_id: number | null;
  latitude: number | null;
  longitude: number | null;
};

const emptyForm = (): FormState => ({
  name: '',
  slug: '',
  is_active: true,
  parent_id: null,
  latitude: null,
  longitude: null,
});

const AdminContractorRegistrationOptionsScreen: React.FC = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<ContractorSignupOptionsTabKey>('categories');
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const [screen, setScreen] = useState<ContractorSignupOptionsScreen | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [togglingRegistration, setTogglingRegistration] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [parentOptions, setParentOptions] = useState<ContractorSignupOptionItem[]>([]);
  const [parentOptionsCache, setParentOptionsCache] = useState<
    Partial<Record<ContractorSignupOptionsTabKey, ContractorSignupOptionItem[]>>
  >({});
  const parentOptionsCacheRef = useRef(parentOptionsCache);
  parentOptionsCacheRef.current = parentOptionsCache;
  const [loadingParents, setLoadingParents] = useState(false);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  /** True when map opened from "Add from map" banner (not from + / Edit form). */
  const [mapOnlyMode, setMapOnlyMode] = useState(false);

  const tabs = (screen?.tabs ?? []).filter((row) => !isContractorSignupTabHidden(row.key));
  const list = screen?.items ?? [];
  const isEdit = form.id != null;
  const parentTab = CONTRACTOR_SIGNUP_PARENT_TAB[tab];
  const parentLabelRaw = CONTRACTOR_SIGNUP_PARENT_LABEL[tab];
  const parentLabel = parentLabelRaw
    ? t(`adminContractorSignupOptions.parentLabel.${tab}`, { defaultValue: parentLabelRaw })
    : undefined;
  const isLocationTab = isLocationSignupTab(tab);

  const localizedTabLabel = (key: ContractorSignupOptionsTabKey, fallback: string) =>
    t(`adminContractorSignupOptions.tabs.${key}`, { defaultValue: fallback });

  const localizedTabSingular = (key: ContractorSignupOptionsTabKey) =>
    t(`adminContractorSignupOptions.tabSingular.${key}`, {
      defaultValue: CONTRACTOR_SIGNUP_TAB_SINGULAR[key],
    });

  const activeTabDef = tabs.find((row) => row.key === tab) ?? tabs[0];

  const applyMapSelection = useCallback(
    (
      address: AddressFromLocation,
      coords?: { latitude: number; longitude: number }
    ) => {
      const tabKey = tabRef.current;
      const name = displayNameFromMap(tabKey, address).trim();
      if (!name) return;
      const slug = slugifyAscii(name);
      setForm((prev) => ({
        ...prev,
        name,
        slug: prev.slug.trim() || slug,
        latitude:
          coords != null && Number.isFinite(coords.latitude) ? coords.latitude : prev.latitude,
        longitude:
          coords != null && Number.isFinite(coords.longitude) ? coords.longitude : prev.longitude,
      }));
    },
    []
  );

  const mapInitialCenter =
    form.latitude != null &&
    form.longitude != null &&
    Number.isFinite(form.latitude) &&
    Number.isFinite(form.longitude)
      ? { latitude: form.latitude, longitude: form.longitude }
      : null;

  const load = useCallback(
    async (tabKey: ContractorSignupOptionsTabKey, isRefresh = false) => {
      const effectiveTab = normalizeContractorSignupTabKey(tabKey);
      if (effectiveTab !== tabKey) {
        setTab(effectiveTab);
        tabRef.current = effectiveTab;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const data = await adminContractorSignupOptionsService.getScreen(effectiveTab);
        setScreen(data);
        const activeTab = normalizeContractorSignupTabKey(data.tab);
        setTab(activeTab);
        tabRef.current = activeTab;
        setParentOptionsCache((prev) => ({ ...prev, [effectiveTab]: data.items }));
        if (effectiveTab === 'categories' && data.items.length) {
          setParentOptions(data.items);
        }
      } catch (err) {
        Alert.alert(
          t('admin.users.error', 'Error'),
          adminContractorSignupOptionsService.getErrorMessage(err, t('adminContractorSignupOptions.loadFailed'))
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
      void load(tabRef.current);
    }, [load])
  );

  const loadParentOptions = useCallback(async () => {
    if (!CONTRACTOR_SIGNUP_PARENT_TAB[tab]) return;
    const parentKey = CONTRACTOR_SIGNUP_PARENT_TAB[tab]!;
    const cached = parentOptionsCacheRef.current[parentKey];
    if (cached?.length) {
      setParentOptions(cached);
    }
    setLoadingParents(true);
    try {
      const items = await adminContractorSignupOptionsService.getParentOptions(tab);
      setParentOptions(items);
      setParentOptionsCache((prev) => ({ ...prev, [parentKey]: items }));
    } catch (err) {
      Alert.alert(
        t('admin.users.error', 'Error'),
        adminContractorSignupOptionsService.getErrorMessage(
          err,
          t('adminContractorSignupOptions.loadParentsFailed')
        )
      );
    } finally {
      setLoadingParents(false);
    }
  }, [tab, t]);

  useEffect(() => {
    if (!modalVisible || !CONTRACTOR_SIGNUP_PARENT_TAB[tab]) return;
    void loadParentOptions();
  }, [modalVisible, tab, loadParentOptions]);

  const onSelectTab = (next: ContractorSignupOptionsTabKey) => {
    if (isContractorSignupTabHidden(next)) return;
    if (next === tab) return;
    setTab(next);
    tabRef.current = next;
    void load(next);
  };

  const openCreate = () => {
    setForm(emptyForm());
    setModalVisible(true);
    if (parentTab) void loadParentOptions();
  };

  const openAddFromMap = useCallback(() => {
    setForm(emptyForm());
    setModalVisible(false);
    setMapOnlyMode(true);
    setMapPickerVisible(true);
  }, []);

  const closeMapPicker = useCallback(() => {
    setMapPickerVisible(false);
    setMapOnlyMode(false);
  }, []);

  const confirmMapSelection = useCallback(
    (address: AddressFromLocation, coords?: { latitude: number; longitude: number }) => {
      applyMapSelection(address, coords);
      setMapPickerVisible(false);
      if (mapOnlyMode) {
        setMapOnlyMode(false);
        setModalVisible(true);
      }
    },
    [applyMapSelection, mapOnlyMode]
  );

  const openMapFromForm = useCallback(() => {
    setMapOnlyMode(false);
    setMapPickerVisible(true);
  }, []);

  const openEdit = (item: ContractorSignupOptionItem) => {
    setForm({
      id: item.id,
      name: item.name,
      slug: item.slug || item.subtitle || '',
      is_active: item.is_active,
      parent_id: item.parent_id,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
    });
    setModalVisible(true);
    if (parentTab) void loadParentOptions();
  };

  const closeModal = () => {
    if (saving) return;
    setMapPickerVisible(false);
    setMapOnlyMode(false);
    setModalVisible(false);
    setForm(emptyForm());
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      Alert.alert(t('admin.users.error', 'Error'), t('adminContractorSignupOptions.nameRequired'));
      return;
    }
    if (parentTab && form.parent_id == null) {
      Alert.alert(
        t('admin.users.error', 'Error'),
        t('adminContractorSignupOptions.parentRequired', { parent: parentLabel ?? '' })
      );
      return;
    }
    if (
      isLocationTab &&
      (form.latitude == null ||
        form.longitude == null ||
        !Number.isFinite(form.latitude) ||
        !Number.isFinite(form.longitude))
    ) {
      Alert.alert(
        t('admin.users.error', 'Error'),
        t('adminContractorSignupOptions.locationRequired')
      );
      return;
    }
    setSaving(true);
    try {
      const editingItem =
        isEdit && form.id != null ? list.find((row) => row.id === form.id) : undefined;
      const apiTab = editingItem ? signupOptionTabForItem(editingItem, tab) : tab;
      const payload = {
        tab: apiTab,
        name,
        slug: form.slug.trim() || undefined,
        parent_id: parentTab ? form.parent_id : undefined,
        is_active: form.is_active,
        ...(isLocationTab &&
        form.latitude != null &&
        form.longitude != null &&
        Number.isFinite(form.latitude) &&
        Number.isFinite(form.longitude)
          ? { latitude: form.latitude, longitude: form.longitude }
          : {}),
      };
      if (isEdit && form.id != null) {
        await adminContractorSignupOptionsService.updateItem(form.id, payload);
      } else {
        await adminContractorSignupOptionsService.createItem(payload);
      }
      closeModal();
      await load(tab, true);
    } catch (err) {
      Alert.alert(
        t('admin.users.error', 'Error'),
        adminContractorSignupOptionsService.getErrorMessage(err, t('adminContractorSignupOptions.saveFailed'))
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: ContractorSignupOptionItem) => {
    if (!item.actions.delete) return;
    Alert.alert(
      t('adminContractorSignupOptions.deleteTitle'),
      t('adminContractorSignupOptions.deleteMessage', { name: item.name }),
      [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('common.delete', 'Delete'),
        style: 'destructive',
        onPress: async () => {
          const screenTab = tabRef.current;
          const apiTab = signupOptionTabForItem(item, screenTab);
          setDeletingId(item.id);
          try {
            const res = await adminContractorSignupOptionsService.deleteItem(item.id, apiTab);
            await load(screenTab, true);
            if (res.message) {
              Alert.alert(t('common.success', 'Success'), res.message);
            }
          } catch (err) {
            Alert.alert(
              t('admin.users.error', 'Error'),
              adminContractorSignupOptionsService.getErrorMessage(
                err,
                t('adminContractorSignupOptions.deleteFailed')
              )
            );
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const handleToggleStatus = async (item: ContractorSignupOptionItem) => {
    if (!item.actions.toggle || togglingId != null) return;
    setTogglingId(item.id);
    const prevActive = item.is_active;
    setScreen((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((row) =>
              row.id === item.id ? { ...row, is_active: !prevActive } : row
            ),
          }
        : prev
    );
    try {
      const apiTab = signupOptionTabForItem(item, tab);
      await adminContractorSignupOptionsService.toggleItem(item.id, apiTab);
      await load(tab, true);
    } catch (err) {
      setScreen((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((row) =>
                row.id === item.id ? { ...row, is_active: prevActive } : row
              ),
            }
          : prev
      );
      Alert.alert(
        t('admin.users.error', 'Error'),
        adminContractorSignupOptionsService.getErrorMessage(
          err,
          t('adminContractorSignupOptions.toggleFailed')
        )
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleRegistrationToggle = async (value: boolean) => {
    setTogglingRegistration(true);
    const prev = screen?.registration.is_open ?? true;
    setScreen((current) =>
      current
        ? {
            ...current,
            registration: { ...current.registration, is_open: value },
          }
        : current
    );
    try {
      await adminContractorSignupOptionsService.setRegistrationOpen(value);
      await load(tab, true);
    } catch (err) {
      setScreen((current) =>
        current
          ? {
              ...current,
              registration: { ...current.registration, is_open: prev },
            }
          : current
      );
      Alert.alert(
        t('admin.users.error', 'Error'),
        adminContractorSignupOptionsService.getErrorMessage(
          err,
          t('adminContractorSignupOptions.registrationToggleFailed')
        )
      );
    } finally {
      setTogglingRegistration(false);
    }
  };

  const parentNameById = (id: number | null) => {
    if (id == null) return '';
    return parentOptions.find((p) => p.id === id)?.name ?? String(id);
  };

  const renderTab = (tdef: ContractorSignupOptionsTab) => {
    const active = tab === tdef.key;
    const icon = tabIconName(tdef.icon);
    return (
      <TouchableOpacity
        key={tdef.key}
        style={[styles.tabChip, active && styles.tabChipActive]}
        onPress={() => onSelectTab(tdef.key)}
        activeOpacity={0.88}
      >
        <Ionicons name={icon} size={15} color={active ? '#fff' : COLORS.primary} />
        <Text
          style={[styles.tabChipText, active && styles.tabChipTextActive]}
          numberOfLines={1}
        >
          {localizedTabLabel(tdef.key, tdef.label)}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: ContractorSignupOptionItem }) => {
    const deleting = deletingId === item.id;
    const toggling = togglingId === item.id;
    const accent = item.is_active ? COLORS.primary : COLORS.textSecondary;
    const rowIcon = tabIconName(activeTabDef?.icon ?? 'grid');

    return (
      <View style={[styles.card, !item.is_active && styles.cardInactive]}>
        <TouchableOpacity
          style={styles.cardMain}
          onPress={() => item.actions.edit && openEdit(item)}
          activeOpacity={0.88}
          disabled={!item.actions.edit}
        >
          <View style={[styles.cardIcon, { backgroundColor: accent + '14' }]}>
            <Ionicons name={rowIcon} size={22} color={accent} />
          </View>
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.name}
            </Text>
            {!!item.parent_name && (
              <Text style={styles.cardParent} numberOfLines={1}>
                {item.parent_name}
              </Text>
            )}
            {!!item.subtitle && (
              <View style={styles.slugChip}>
                <Text style={styles.cardSlug} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>
            )}
          </View>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: item.is_active ? COLORS.primary + '14' : '#EEF0F2' },
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
                ? t('adminContractorSignupOptions.statusActive')
                : t('adminContractorSignupOptions.statusHidden')}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.cardFooter}>
          {item.actions.toggle ? (
            <View style={styles.footerToggleRow}>
              <Text style={styles.footerToggleLabel}>
                {t('adminContractorSignupOptions.showOnSignup')}
              </Text>
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
          ) : (
            <View style={styles.footerToggleRow} />
          )}

          <View style={styles.footerActions}>
            {item.actions.edit ? (
              <TouchableOpacity
                style={styles.footerIconBtn}
                onPress={() => openEdit(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="create-outline" size={19} color={COLORS.primary} />
              </TouchableOpacity>
            ) : null}
            {item.actions.delete ? (
              <TouchableOpacity
                style={[styles.footerIconBtn, styles.footerIconBtnDanger]}
                onPress={() => handleDelete(item)}
                disabled={deleting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={COLORS.error} />
                ) : (
                  <Ionicons name="trash-outline" size={19} color={COLORS.error} />
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  const registration = screen?.registration;

  return (
    <SafeAreaView style={styles.safe} edges={Platform.OS === 'ios' ? ['bottom'] : []}>
      <Header
        title={t('adminContractorSignupOptions.title')}
        showBack
        rightComponent={
          <TouchableOpacity onPress={openCreate} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="add-circle" size={28} color={COLORS.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.registrationBanner}>
        <View style={styles.registrationAccent} />
        <View style={styles.registrationTextWrap}>
          <Text style={styles.registrationTitle}>
            {registration?.title ?? t('adminContractorSignupOptions.registrationTitle')}
          </Text>
          <Text style={styles.registrationSub}>
            {registration?.subtitle ?? t('adminContractorSignupOptions.registrationSubDefault')}
          </Text>
        </View>
        {togglingRegistration ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          <Switch
            value={registration?.is_open ?? true}
            onValueChange={handleRegistrationToggle}
            trackColor={{ false: COLORS.border, true: COLORS.primary + '80' }}
            thumbColor={registration?.is_open ? COLORS.primary : '#f4f3f4'}
          />
        )}
      </View>

      <View style={styles.tabsSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}
        >
          {tabs.map(renderTab)}
        </ScrollView>
      </View>

      {!loading && screen?.summary?.label ? (
        <View style={styles.summaryRow}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
          <Text style={styles.summaryText}>{screen.summary.label}</Text>
        </View>
      ) : null}

      {!loading && isLocationTab ? (
        <TouchableOpacity style={styles.mapAddBanner} onPress={openAddFromMap} activeOpacity={0.88}>
          <Ionicons name="map-outline" size={22} color={COLORS.primary} />
          <View style={styles.mapAddBannerTextWrap}>
            <Text style={styles.mapAddBannerTitle}>
              {t('adminContractorSignupOptions.addFromMap')}
            </Text>
            <Text style={styles.mapAddBannerSub}>
              {t('adminContractorSignupOptions.addFromMapSub', {
                item: localizedTabSingular(tab).toLowerCase(),
              })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
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
          contentContainerStyle={[
            list.length === 0 ? styles.emptyContent : styles.listContent,
            Platform.OS === 'android' && { paddingBottom: SPACING.xxl + Math.max(insets.bottom, 8) },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(tab, true)} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons
                name={tabIconName(activeTabDef?.icon ?? 'grid')}
                size={40}
                color={COLORS.primary}
              />
              <Text style={styles.emptyText}>{t('adminContractorSignupOptions.emptyList')}</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={mapPickerVisible && mapOnlyMode}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeMapPicker}
      >
        <View style={styles.mapOnlyShell}>
          <MapPickerModal
            key={`contractor-map-banner-${mapInitialCenter?.latitude ?? 'x'}-${mapInitialCenter?.longitude ?? 'y'}`}
            embedded
            visible
            initialCenter={mapInitialCenter}
            onClose={closeMapPicker}
            onSelect={confirmMapSelection}
            confirmMessage={t('adminContractorSignupOptions.useThisLocation')}
          />
        </View>
      </Modal>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (mapPickerVisible) {
            closeMapPicker();
            return;
          }
          closeModal();
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' && !mapPickerVisible ? 'padding' : undefined}
        >
          {!mapPickerVisible ? (
            <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={closeModal} />
          ) : null}
          <View
            style={[styles.modalCard, mapPickerVisible && styles.modalCardMap]}
            pointerEvents="box-none"
          >
            {mapPickerVisible && !mapOnlyMode ? (
              <MapPickerModal
                key={`contractor-map-form-${form.id ?? 'new'}-${mapInitialCenter?.latitude ?? 'x'}-${mapInitialCenter?.longitude ?? 'y'}`}
                embedded
                visible
                initialCenter={mapInitialCenter}
                onClose={closeMapPicker}
                onSelect={confirmMapSelection}
                confirmMessage={t('adminContractorSignupOptions.useThisLocation')}
              />
            ) : null}
            {!mapPickerVisible ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Text style={styles.modalTitle}>
                  {isEdit
                    ? t('adminContractorSignupOptions.edit')
                    : t('adminContractorSignupOptions.add')}{' '}
                  {localizedTabSingular(tab) ?? activeTabDef?.label ?? 'item'}
                </Text>

                {parentTab ? (
                  <>
                <Text style={styles.fieldLabel}>{parentLabel} *</Text>
                <Text style={styles.fieldHint}>
                  {t('adminContractorSignupOptions.parentLinkHint')}
                </Text>
                <View style={styles.inlineParentBox}>
                  <Text style={styles.inlineParentBoxTitle}>
                    {loadingParents
                      ? t('adminContractorSignupOptions.loadingCategories')
                      : t('adminContractorSignupOptions.parentCount', {
                          count: parentOptions.length,
                          parent: (parentLabel ?? '').toLowerCase(),
                        })}
                  </Text>
                  {loadingParents ? (
                    <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.md }} />
                  ) : parentOptions.length === 0 ? (
                    <View style={styles.parentEmptyWrap}>
                      <Text style={styles.emptyText}>
                        {t('adminContractorSignupOptions.parentEmpty')}
                      </Text>
                      <TouchableOpacity
                        style={styles.parentEmptyBtn}
                        onPress={() => {
                          closeModal();
                          onSelectTab('categories');
                        }}
                      >
                        <Text style={styles.parentEmptyBtnText}>
                          {t('adminContractorSignupOptions.goToCategories')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <ScrollView
                      style={styles.inlineParentScroll}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                    >
                      {parentOptions.map((item) => {
                        const selected = form.parent_id === item.id;
                        return (
                          <TouchableOpacity
                            key={String(item.id)}
                            style={[styles.parentRow, selected && styles.parentRowSelected]}
                            onPress={() =>
                              setForm((prev) => ({ ...prev, parent_id: item.id }))
                            }
                          >
                            <View style={styles.parentRowTextWrap}>
                              <Text style={styles.parentRowText} numberOfLines={2}>
                                {item.name}
                              </Text>
                              {!!item.subtitle && (
                                <Text style={styles.parentRowSub} numberOfLines={1}>
                                  {item.subtitle}
                                </Text>
                              )}
                            </View>
                            {selected ? (
                              <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                            ) : (
                              <Ionicons name="ellipse-outline" size={22} color={COLORS.border} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
                  </>
                ) : null}

                {isLocationTab ? (
                  <>
                <Text style={styles.fieldLabel}>{t('adminContractorSignupOptions.location')}</Text>
                <TouchableOpacity
                  style={styles.mapPickBtn}
                  onPress={openMapFromForm}
                  activeOpacity={0.85}
                >
                  <Ionicons name="map-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.mapPickBtnText}>
                    {form.name.trim()
                      ? t('adminContractorSignupOptions.changeLocationOnMap')
                      : t('adminContractorSignupOptions.pickLocationOnMap')}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.fieldHint}>
                  {tab === 'emirates'
                    ? t('adminContractorSignupOptions.emiratesMapHint')
                    : t('adminContractorSignupOptions.coverageMapHint')}
                </Text>
                {form.latitude != null && form.longitude != null ? (
                  <Text style={styles.coordsHint}>
                    {t('adminContractorSignupOptions.savedPin', {
                      coords: `${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}`,
                    })}
                  </Text>
                ) : null}
                  </>
                ) : null}

                <Text style={styles.fieldLabel}>{t('adminContractorSignupOptions.nameLabel')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={form.name}
                  onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
                  placeholder={t('adminContractorSignupOptions.namePlaceholder')}
                  placeholderTextColor={COLORS.textSecondary}
                />

                <Text style={styles.fieldLabel}>{t('adminContractorSignupOptions.slugLabel')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={form.slug}
                  onChangeText={(slug) => setForm((prev) => ({ ...prev, slug }))}
                  placeholder={t('adminContractorSignupOptions.slugPlaceholder')}
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="none"
                />

                <View style={styles.switchRow}>
                  <Text style={styles.fieldLabelInline}>
                    {t('adminContractorSignupOptions.showOnSignupActive')}
                  </Text>
                  <Switch
                    value={form.is_active}
                    onValueChange={(is_active) => setForm((prev) => ({ ...prev, is_active }))}
                    trackColor={{ false: COLORS.border, true: COLORS.primary + '80' }}
                    thumbColor={form.is_active ? COLORS.primary : '#f4f3f4'}
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModal} disabled={saving}>
                    <Text style={styles.cancelBtnText}>{t('common.cancel', 'Cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.saveBtnText}>{t('common.save', 'Save')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default AdminContractorRegistrationOptionsScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F6F4' },
  registrationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    paddingLeft: SPACING.md + 4,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
    overflow: 'hidden',
    shadowColor: '#0B3D2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  registrationAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: COLORS.primary,
  },
  registrationTextWrap: { flex: 1 },
  registrationTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  registrationSub: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 4, lineHeight: 20 },
  tabsSection: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  tabsScroll: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    alignItems: 'center',
    paddingVertical: 2,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md + 2,
    paddingVertical: 10,
    minHeight: 40,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexShrink: 0,
  },
  tabChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabChipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
    flexShrink: 0,
  },
  tabChipTextActive: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary + '10',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '22',
  },
  summaryText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: FONT_WEIGHTS.medium },
  mapAddBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
    backgroundColor: COLORS.primary + '0C',
  },
  mapAddBannerTextWrap: { flex: 1, minWidth: 0 },
  mapAddBannerTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  mapAddBannerSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  mapPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#FAFBFA',
    marginBottom: SPACING.xs,
  },
  mapPickBtnText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
  listContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xs, paddingBottom: SPACING.xxl },
  emptyContent: { flexGrow: 1, justifyContent: 'center', padding: SPACING.xl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0B3D2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardInactive: { opacity: 0.92, backgroundColor: '#FAFBFA' },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardTextWrap: { flex: 1, minWidth: 0, paddingRight: SPACING.xs },
  cardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    lineHeight: 22,
  },
  cardParent: { fontSize: FONT_SIZES.xs, color: COLORS.primary, marginTop: 4, fontWeight: FONT_WEIGHTS.medium },
  slugChip: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: '#F0F2F1',
    maxWidth: '100%',
  },
  cardSlug: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    flexShrink: 0,
    marginTop: 2,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 10, fontWeight: FONT_WEIGHTS.semiBold },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: '#FAFBFA',
  },
  footerToggleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  footerToggleLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  footerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary + '12',
  },
  footerIconBtnDanger: { backgroundColor: COLORS.error + '12' },
  emptyWrap: { alignItems: 'center', gap: SPACING.md },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  mapOnlyShell: { flex: 1, backgroundColor: COLORS.background },
  modalDismiss: { flex: 1 },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  modalCardMap: {
    flex: 1,
    width: '100%',
    maxHeight: '92%',
    minHeight: '78%',
    padding: 0,
    paddingBottom: 0,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
  },
  modalTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text, marginBottom: SPACING.md },
  fieldLabel: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.medium, color: COLORS.textSecondary, marginBottom: 6 },
  fieldHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    lineHeight: 18,
  },
  coordsHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  inlineParentBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#FAFBFA',
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  inlineParentBoxTitle: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  inlineParentScroll: { maxHeight: 200 },
  fieldLabelInline: { fontSize: FONT_SIZES.md, color: COLORS.text, flex: 1 },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    marginBottom: SPACING.md,
  },
  inputText: { fontSize: FONT_SIZES.md, color: COLORS.text },
  inputPlaceholder: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  modalActions: { flexDirection: 'row', gap: SPACING.md },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelBtnText: { color: COLORS.text, fontWeight: FONT_WEIGHTS.medium },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold },
  parentOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  parentBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  parentSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '70%',
    minHeight: 280,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  parentSheetTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  parentSheetSub: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: 4,
  },
  parentScroll: { flexGrow: 0, maxHeight: 420 },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  parentRowSelected: { backgroundColor: COLORS.primary + '08' },
  parentRowTextWrap: { flex: 1, minWidth: 0 },
  parentRowText: { fontSize: FONT_SIZES.md, color: COLORS.text, fontWeight: FONT_WEIGHTS.medium },
  parentRowSub: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  parentEmptyWrap: { paddingVertical: SPACING.md, gap: SPACING.md, alignItems: 'center' },
  parentEmptyBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  parentEmptyBtnText: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold, fontSize: FONT_SIZES.sm },
});
