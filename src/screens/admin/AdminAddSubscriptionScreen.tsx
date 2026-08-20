/**
 * Admin Add Subscription.
 * POST /subscriptions — features checklist + audience (all users | specific clients).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { adminService, type AdminUser } from '../../services/adminService';
import {
  subscriptionService,
  SUBSCRIPTION_PLAN_OPTIONS,
  addMonthsToDate,
  type SubscriptionTargetType,
  type CreateSubscriptionPayload,
} from '../../services/subscriptionService';
import { compressImageForUpload } from '../../utils/compressImage';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isClientUser(user: AdminUser): boolean {
  const role = (user.role || user.roles?.[0]?.name || '').toLowerCase();
  return role === 'client' || role === 'customer' || role === 'user';
}

const DEFAULT_PLAN =
  SUBSCRIPTION_PLAN_OPTIONS.find((p) => p.key === 'vip_6_month') ||
  SUBSCRIPTION_PLAN_OPTIONS[SUBSCRIPTION_PLAN_OPTIONS.length - 1];

const AdminAddSubscriptionScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [clients, setClients] = useState<AdminUser[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientPickerVisible, setClientPickerVisible] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [targetType, setTargetType] = useState<SubscriptionTargetType>('specific_clients');
  const [selectedClients, setSelectedClients] = useState<AdminUser[]>([]);

  const [planKey, setPlanKey] = useState(DEFAULT_PLAN.key);
  const [plan, setPlan] = useState(DEFAULT_PLAN.value);
  const [planName, setPlanName] = useState(DEFAULT_PLAN.title);
  const [subtitle, setSubtitle] = useState(DEFAULT_PLAN.subtitle);
  const [description, setDescription] = useState(DEFAULT_PLAN.description);
  const [features, setFeatures] = useState<string[]>([...DEFAULT_PLAN.defaultFeatures]);
  const [featureDraft, setFeatureDraft] = useState('');
  const [picture, setPicture] = useState<{ uri: string } | null>(null);
  const [pickingImage, setPickingImage] = useState(false);

  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addMonthsToDate(todayISO(), DEFAULT_PLAN.months));
  const [amount, setAmount] = useState(String(DEFAULT_PLAN.defaultAmount));
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [paymentReference, setPaymentReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const creatingRef = useRef(false);

  const paymentStatuses = [
    { value: 'paid', label: t('admin.subscriptions.statusPaid', { defaultValue: 'Paid' }) },
    {
      value: 'pending',
      label: t('admin.subscriptions.statusPending', { defaultValue: 'Pending' }),
    },
    { value: 'failed', label: t('admin.subscriptions.statusFailed', { defaultValue: 'Failed' }) },
    {
      value: 'refunded',
      label: t('admin.subscriptions.statusRefunded', { defaultValue: 'Refunded' }),
    },
    {
      value: 'cancelled',
      label: t('admin.subscriptions.statusCancelled', { defaultValue: 'Cancelled' }),
    },
  ];

  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const res = await adminService.getUsers({ role: 'client', per_page: 200, page: 1 });
      const raw = res?.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data?: AdminUser[] })?.data)
          ? (raw as { data: AdminUser[] }).data
          : [];
      const filtered = list.filter(isClientUser);
      setClients(filtered.length ? filtered : list);
    } catch {
      try {
        const res = await adminService.getUsers({ per_page: 200, page: 1 });
        const raw = res?.data;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: AdminUser[] })?.data)
            ? (raw as { data: AdminUser[] }).data
            : [];
        setClients(list.filter(isClientUser));
      } catch {
        setClients([]);
      }
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const applyPlanDefaults = (key: string, keepStart = startDate) => {
    const opt = SUBSCRIPTION_PLAN_OPTIONS.find((p) => p.key === key);
    if (!opt) return;
    setPlanKey(opt.key);
    setPlan(opt.value);
    setPlanName(opt.title);
    setSubtitle(opt.subtitle);
    setDescription(opt.description);
    setFeatures([...opt.defaultFeatures]);
    setAmount(String(opt.defaultAmount));
    setEndDate(addMonthsToDate(keepStart || todayISO(), opt.months));
  };

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    );
  }, [clients, clientSearch]);

  const toggleClient = (user: AdminUser) => {
    setSelectedClients((prev) => {
      const exists = prev.some((c) => c.id === user.id);
      if (exists) return prev.filter((c) => c.id !== user.id);
      return [...prev, user];
    });
  };

  const addFeature = () => {
    const text = featureDraft.trim();
    if (!text) return;
    if (features.some((f) => f.toLowerCase() === text.toLowerCase())) {
      setFeatureDraft('');
      return;
    }
    setFeatures((prev) => [...prev, text]);
    setFeatureDraft('');
  };

  const removeFeature = (index: number) => {
    setFeatures((prev) => prev.filter((_, i) => i !== index));
  };

  const pickImageFromDevice = async () => {
    if (pickingImage) return;
    setPickingImage(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('admin.subscriptions.permissionTitle', { defaultValue: 'Permission needed' }),
          t('admin.subscriptions.permissionBody', {
            defaultValue: 'Allow photo access to add a subscription image.',
          })
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
        setPicture({ uri });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not open photo library.';
      Alert.alert(
        t('admin.subscriptions.unableToOpenTitle', { defaultValue: 'Unable to open photos' }),
        message
      );
    } finally {
      setPickingImage(false);
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (targetType === 'specific_clients' && selectedClients.length === 0) {
      next.client = t('admin.subscriptions.clientRequired', {
        defaultValue: 'Please select at least one client.',
      });
    }
    if (!plan) {
      next.plan = t('admin.subscriptions.planRequired', { defaultValue: 'Please select a plan.' });
    }
    if (!planName.trim()) {
      next.plan_name = t('admin.subscriptions.titleRequired', {
        defaultValue: 'Plan name is required.',
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())) {
      next.startDate = t('admin.subscriptions.dateFormat', {
        defaultValue: 'Use YYYY-MM-DD format.',
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())) {
      next.endDate = t('admin.subscriptions.dateFormat', {
        defaultValue: 'Use YYYY-MM-DD format.',
      });
    }
    if (!amount.trim() || Number.isNaN(parseFloat(amount)) || parseFloat(amount) < 0) {
      next.amount = t('admin.subscriptions.amountRequired', {
        defaultValue: 'Enter a valid amount.',
      });
    }
    if (features.length === 0) {
      next.features = t('admin.subscriptions.featuresRequired', {
        defaultValue: 'Add at least one feature (e.g. VIP weekly visits).',
      });
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildBasePayload = (): CreateSubscriptionPayload => ({
    target_type: targetType,
    apply_to_all: targetType === 'all_users',
    client_ids:
      targetType === 'specific_clients' ? selectedClients.map((c) => c.id) : undefined,
    client_id: targetType === 'all_users' ? null : undefined,
    plan,
    plan_name: planName.trim(),
    subtitle: subtitle.trim() || null,
    description: description.trim() || null,
    features: features.map((f) => f.trim()).filter(Boolean),
    start_date: startDate.trim(),
    end_date: endDate.trim(),
    amount: parseFloat(amount.trim()),
    payment_status: paymentStatus,
    payment_reference: paymentReference.trim() || null,
    paid_at: paymentStatus === 'paid' ? new Date().toISOString() : null,
    picture: picture || null,
  });

  const handleCreate = async () => {
    // Lock first so rapid double-taps cannot start two creates
    if (creatingRef.current || saving) return;
    if (!validate()) return;

    creatingRef.current = true;
    setSaving(true);

    try {
      const payload = buildBasePayload();
      if (Array.isArray(payload.client_ids)) {
        payload.client_ids = [...new Set(payload.client_ids.map((id) => Number(id)))].filter(
          (id) => Number.isFinite(id) && id > 0
        );
      }

      const res = await subscriptionService.createSubscription(payload);

      if (res?.success === false || res?.status === false) {
        throw new Error(res.message || 'Failed to create subscription.');
      }

      // Keep lock after success so Create cannot fire again while the alert is open
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        res.message ||
          t('admin.subscriptions.createSuccess', {
            defaultValue: 'Subscription created successfully.',
          }),
        [
          {
            text: t('common.ok', { defaultValue: 'OK' }),
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err: unknown) {
      creatingRef.current = false;
      setSaving(false);

      const ax = err as {
        response?: { data?: { message?: string; errors?: Record<string, string[]> } };
        message?: string;
      };
      if (ax.response?.data?.errors) {
        const apiErrors: Record<string, string> = {};
        Object.entries(ax.response.data.errors).forEach(([key, val]) => {
          apiErrors[key] = Array.isArray(val) ? String(val[0]) : String(val);
        });
        setErrors(apiErrors);
      }
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        ax.response?.data?.message ||
          ax.message ||
          t('admin.subscriptions.createFailed', {
            defaultValue: 'Failed to create subscription.',
          })
      );
    }
  };

  const previewPrice = amount.trim() || '0';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={[styles.hero, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heroTitle}>
          {t('admin.subscriptions.addTitle', { defaultValue: 'Add subscription' })}
        </Text>
        <Text style={styles.heroSubtitle}>
          {t('admin.subscriptions.addSubtitle', {
            defaultValue: 'Create a plan with features for all users or selected clients',
          })}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Audience */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t('admin.subscriptions.sectionAudience', { defaultValue: 'Who is this for?' })}
            </Text>
            <View style={styles.audienceRow}>
              <TouchableOpacity
                style={[
                  styles.audienceBtn,
                  targetType === 'all_users' && styles.audienceBtnActive,
                ]}
                onPress={() => {
                  setTargetType('all_users');
                  setSelectedClients([]);
                }}
              >
                <Ionicons
                  name="people-outline"
                  size={20}
                  color={targetType === 'all_users' ? COLORS.primary : COLORS.textSecondary}
                />
                <Text
                  style={[
                    styles.audienceBtnText,
                    targetType === 'all_users' && styles.audienceBtnTextActive,
                  ]}
                >
                  {t('admin.subscriptions.audienceAll', { defaultValue: 'All users' })}
                </Text>
                <Text style={styles.audienceHint}>
                  {t('admin.subscriptions.audienceAllHint', {
                    defaultValue: 'Available to every client',
                  })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.audienceBtn,
                  targetType === 'specific_clients' && styles.audienceBtnActive,
                ]}
                onPress={() => setTargetType('specific_clients')}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={
                    targetType === 'specific_clients' ? COLORS.primary : COLORS.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.audienceBtnText,
                    targetType === 'specific_clients' && styles.audienceBtnTextActive,
                  ]}
                >
                  {t('admin.subscriptions.audienceSpecific', {
                    defaultValue: 'Specific clients',
                  })}
                </Text>
                <Text style={styles.audienceHint}>
                  {t('admin.subscriptions.audienceSpecificHint', {
                    defaultValue: 'Only selected client IDs',
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            {targetType === 'specific_clients' ? (
              <>
                <TouchableOpacity
                  style={[styles.selectBtn, errors.client ? styles.selectError : null]}
                  onPress={() => {
                    setClientSearch('');
                    setClientPickerVisible(true);
                  }}
                >
                  {selectedClients.length > 0 ? (
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectTitle}>
                        {selectedClients.length === 1
                          ? selectedClients[0].name
                          : t('admin.subscriptions.clientsSelected', {
                              count: selectedClients.length,
                              defaultValue: `${selectedClients.length} clients selected`,
                            })}
                      </Text>
                      <Text style={styles.selectMeta} numberOfLines={2}>
                        {selectedClients.map((c) => c.name).join(', ')}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.selectPlaceholder}>
                      {t('admin.subscriptions.selectClients', {
                        defaultValue: 'Select clients',
                      })}
                    </Text>
                  )}
                  <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
                {errors.client ? <Text style={styles.errorText}>{errors.client}</Text> : null}
                {selectedClients.length > 0 ? (
                  <View style={styles.selectedChips}>
                    {selectedClients.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={styles.selectedChip}
                        onPress={() => toggleClient(c)}
                      >
                        <Text style={styles.selectedChipText}>{c.name}</Text>
                        <Ionicons name="close-circle" size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.allUsersBanner}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                <Text style={styles.allUsersBannerText}>
                  {t('admin.subscriptions.allUsersNote', {
                    defaultValue: 'This plan will be available for all users in the app.',
                  })}
                </Text>
              </View>
            )}
          </View>

          {/* Plan */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t('admin.subscriptions.sectionPlan', { defaultValue: 'Plan' })}
            </Text>
            <View style={styles.chipWrap}>
              {SUBSCRIPTION_PLAN_OPTIONS.map((opt) => {
                const selected = planKey === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => applyPlanDefaults(opt.key)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.chipPrice, selected && styles.chipTextActive]}>
                      AED {opt.defaultAmount}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {errors.plan ? <Text style={styles.errorText}>{errors.plan}</Text> : null}
            <Input
              label={`${t('admin.subscriptions.planName', { defaultValue: 'Plan name' })} *`}
              value={planName}
              onChangeText={setPlanName}
              placeholder="VIP 6 Months"
              error={errors.plan_name || errors.title}
            />
            <Input
              label={t('admin.subscriptions.planSubtitle', {
                defaultValue: 'Subtitle',
              })}
              value={subtitle}
              onChangeText={setSubtitle}
              placeholder="VIP half-year plan"
            />
            <Input
              label={t('admin.subscriptions.description', {
                defaultValue: 'Description',
              })}
              value={description}
              onChangeText={setDescription}
              placeholder={t('admin.subscriptions.descriptionPlaceholder', {
                defaultValue: 'Describe what this subscription includes…',
              })}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Image → API field `picture` */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t('admin.subscriptions.sectionImage', { defaultValue: 'Subscription image' })}
            </Text>
            <Text style={styles.sectionHint}>
              {t('admin.subscriptions.imageHint', {
                defaultValue: 'Uploaded as picture (shown on the membership card).',
              })}
            </Text>
            <TouchableOpacity
              style={[styles.imageBtn, pickingImage && styles.imageBtnDisabled]}
              onPress={() => void pickImageFromDevice()}
              disabled={pickingImage}
            >
              {pickingImage ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <>
                  <Ionicons name="image-outline" size={22} color={COLORS.primary} />
                  <Text style={styles.imageBtnText}>
                    {picture
                      ? t('admin.subscriptions.changeImage', { defaultValue: 'Change image' })
                      : t('admin.subscriptions.addImage', { defaultValue: 'Add image' })}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {picture?.uri ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: picture.uri }} style={styles.imagePreview} contentFit="cover" />
                <TouchableOpacity style={styles.imageRemove} onPress={() => setPicture(null)}>
                  <Ionicons name="close-circle" size={24} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* Features */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t('admin.subscriptions.sectionFeatures', {
                defaultValue: 'Features / benefits',
              })}
            </Text>
            <Text style={styles.sectionHint}>
              {t('admin.subscriptions.featuresHint', {
                defaultValue:
                  'These show with green checkmarks on the membership card (e.g. VIP weekly visits).',
              })}
            </Text>

            {features.map((item, index) => (
              <View key={`${item}-${index}`} style={styles.featureRow}>
                <View style={styles.featureCheck}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
                <Text style={styles.featureText}>{item}</Text>
                <TouchableOpacity
                  onPress={() => removeFeature(index)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.featureAddRow}>
              <TextInput
                style={styles.featureInput}
                value={featureDraft}
                onChangeText={setFeatureDraft}
                placeholder={t('admin.subscriptions.featurePlaceholder', {
                  defaultValue: 'e.g. VIP weekly visits',
                })}
                placeholderTextColor={COLORS.textSecondary}
                onSubmitEditing={addFeature}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.featureAddBtn} onPress={addFeature}>
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            {errors.features ? <Text style={styles.errorText}>{errors.features}</Text> : null}
          </View>

          {/* Preview */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t('admin.subscriptions.preview', { defaultValue: 'Card preview' })}
            </Text>
            <View style={styles.previewCard}>
              {picture?.uri ? (
                <Image source={{ uri: picture.uri }} style={styles.previewHeroImage} contentFit="cover" />
              ) : null}
              <View style={styles.previewHeader}>
                <View style={styles.previewIcon}>
                  <Ionicons name="leaf-outline" size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewTitle}>{planName.trim() || 'Plan name'}</Text>
                  <Text style={styles.previewSubtitle}>
                    {subtitle.trim() || 'Plan subtitle'}
                  </Text>
                </View>
                <Text style={styles.previewPrice}>AED {previewPrice}</Text>
              </View>
              {description.trim() ? (
                <Text style={styles.previewDescription}>{description.trim()}</Text>
              ) : null}
              {features.map((item, index) => (
                <View key={`prev-${index}`} style={styles.previewFeatureRow}>
                  <View style={styles.featureCheck}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                  <Text style={styles.previewFeatureText}>{item}</Text>
                </View>
              ))}
              {features.length === 0 ? (
                <Text style={styles.previewEmpty}>
                  {t('admin.subscriptions.previewEmpty', {
                    defaultValue: 'Add features to see them here.',
                  })}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Details */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t('admin.subscriptions.sectionDetails', { defaultValue: 'Subscription details' })}
            </Text>
            <Input
              label={`${t('admin.subscriptions.startDate', { defaultValue: 'Start date' })} *`}
              value={startDate}
              onChangeText={(v) => {
                setStartDate(v);
                const opt = SUBSCRIPTION_PLAN_OPTIONS.find((p) => p.key === planKey);
                if (opt && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
                  setEndDate(addMonthsToDate(v.trim(), opt.months));
                }
              }}
              placeholder="YYYY-MM-DD"
              error={errors.startDate}
            />
            <Input
              label={`${t('admin.subscriptions.endDate', { defaultValue: 'End date' })} *`}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              error={errors.endDate}
            />
            <Input
              label={`${t('admin.subscriptions.amount', { defaultValue: 'Amount (AED)' })} *`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              error={errors.amount}
            />
          </View>

          {/* Payment */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t('admin.subscriptions.sectionPayment', { defaultValue: 'Payment' })}
            </Text>
            <Text style={styles.fieldLabel}>
              {t('admin.subscriptions.paymentStatus', { defaultValue: 'Payment status' })} *
            </Text>
            <View style={styles.chipWrap}>
              {paymentStatuses.map((opt) => {
                const selected = paymentStatus === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => setPaymentStatus(opt.value)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Input
              label={t('admin.subscriptions.paymentReference', {
                defaultValue: 'Payment reference (optional)',
              })}
              value={paymentReference}
              onChangeText={setPaymentReference}
              placeholder="e.g. ADMIN-REF-001"
            />
          </View>

          <Button
            title={t('admin.subscriptions.create', { defaultValue: 'Create subscription' })}
            onPress={() => void handleCreate()}
            loading={saving}
            disabled={saving}
          />
          <View style={{ height: SPACING.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={clientPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setClientPickerVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setClientPickerVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {t('admin.subscriptions.selectClients', { defaultValue: 'Select clients' })}
            </Text>
            <TouchableOpacity onPress={() => setClientPickerVisible(false)}>
              <Text style={styles.modalDone}>
                {t('common.done', { defaultValue: 'Done' })}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={clientSearch}
              onChangeText={setClientSearch}
              placeholder={t('admin.subscriptions.searchClient', {
                defaultValue: 'Search name, email, phone…',
              })}
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
          {loadingClients ? (
            <ActivityIndicator style={{ marginTop: SPACING.xl }} color={COLORS.primary} />
          ) : (
            <FlatList
              data={filteredClients}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.sm }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {t('admin.subscriptions.noClients', {
                    defaultValue: 'No clients found.',
                  })}
                </Text>
              }
              renderItem={({ item }) => {
                const selected = selectedClients.some((c) => c.id === item.id);
                return (
                  <TouchableOpacity
                    style={[styles.clientRow, selected && styles.clientRowSelected]}
                    onPress={() => toggleClient(item)}
                  >
                    <View style={styles.clientAvatar}>
                      <Text style={styles.clientAvatarText}>
                        {(item.name || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.clientName}>{item.name}</Text>
                      <Text style={styles.clientMeta}>{item.email}</Text>
                    </View>
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selected ? COLORS.primary : COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surfaceLight },
  hero: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroTitle: { fontSize: FONT_SIZES.xl, fontWeight: FONT_WEIGHTS.bold, color: '#fff' },
  heroSubtitle: {
    marginTop: 4,
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.85)',
  },
  content: { padding: SPACING.lg, gap: SPACING.md },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    lineHeight: 18,
  },
  audienceRow: { flexDirection: 'row', gap: SPACING.sm },
  audienceBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceLight,
    gap: 4,
  },
  audienceBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '12',
  },
  audienceBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  audienceBtnTextActive: { color: COLORS.primary },
  audienceHint: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  allUsersBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary + '10',
  },
  allUsersBannerText: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    lineHeight: 18,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceLight,
  },
  selectError: { borderColor: COLORS.error },
  selectTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  selectMeta: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  selectPlaceholder: { flex: 1, color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  selectedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: COLORS.primary + '15',
  },
  selectedChipText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: 4,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    minWidth: '47%',
    flexGrow: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surfaceLight,
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '12' },
  chipText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  chipPrice: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  chipTextActive: { color: COLORS.primary },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 6,
  },
  featureCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  featureAddRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 4 },
  featureInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceLight,
  },
  featureAddBtn: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    backgroundColor: '#fff',
    gap: SPACING.sm,
    overflow: 'hidden',
  },
  previewHeroImage: {
    width: '100%',
    height: 140,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
  },
  imageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 14,
    backgroundColor: COLORS.primary + '08',
  },
  imageBtnDisabled: { opacity: 0.6 },
  imageBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  imagePreviewWrap: {
    marginTop: SPACING.sm,
    position: 'relative',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.surfaceLight,
  },
  imageRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  previewSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  previewDescription: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  previewPrice: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  previewFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  previewFeatureText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  previewEmpty: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, fontStyle: 'italic' },
  errorText: { fontSize: FONT_SIZES.xs, color: COLORS.error },
  modalSafe: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  modalDone: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    margin: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surfaceLight,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: FONT_SIZES.sm, color: COLORS.text },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.xl },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
  },
  clientRowSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.bold },
  clientName: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  clientMeta: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
});

export default AdminAddSubscriptionScreen;
