/**
 * Admin Edit Subscription — same fields as Add (plan, title, subtitle, description, features, audience).
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import {
  subscriptionService,
  Subscription,
  SUBSCRIPTION_PLAN_OPTIONS,
  addMonthsToDate,
  getSubscriptionPlanLabel,
  getPlanOption,
  resolveSubscriptionImageUrl,
  type SubscriptionTargetType,
} from '../../services/subscriptionService';
import { compressImageForUpload } from '../../utils/compressImage';

function parseFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((f) => String(f).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((f) => String(f).trim()).filter(Boolean);
      }
    } catch {
      return raw
        .split(/\n|,/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

const EditSubscriptionScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const subscription: Subscription | undefined = route.params?.subscription;

  const [planKey, setPlanKey] = useState('');
  const [plan, setPlan] = useState('');
  const [planName, setPlanName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [featureDraft, setFeatureDraft] = useState('');
  const [targetType, setTargetType] = useState<SubscriptionTargetType>('specific_clients');
  const [picture, setPicture] = useState<{ uri: string } | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | undefined>();
  const [pictureRemoved, setPictureRemoved] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [paymentReference, setPaymentReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  useEffect(() => {
    if (!subscription) return;

    const planValue = String(subscription.plan || '');
    const opt = getPlanOption(planValue);
    const existingFeatures = parseFeatures(subscription.features);

    setPlanKey(opt?.key || '');
    setPlan(opt?.value || planValue);
    setPlanName(
      (subscription.plan_name && String(subscription.plan_name)) ||
        (subscription.title && String(subscription.title)) ||
        opt?.title ||
        getSubscriptionPlanLabel(planValue)
    );
    setSubtitle(
      (subscription.subtitle && String(subscription.subtitle)) || opt?.subtitle || ''
    );
    setDescription(
      (subscription.description && String(subscription.description)) || opt?.description || ''
    );
    setFeatures(
      existingFeatures.length
        ? existingFeatures
        : opt?.defaultFeatures
          ? [...opt.defaultFeatures]
          : []
    );
    const rawTarget = String(subscription.target_type || subscription.audience || '');
    setTargetType(
      rawTarget === 'all_users' || rawTarget === 'all'
        ? 'all_users'
        : 'specific_clients'
    );

    const remoteImage = resolveSubscriptionImageUrl(
      subscription.picture_url || subscription.image_url,
      (typeof subscription.picture === 'string' ? subscription.picture : null) ||
        (typeof subscription.image === 'string' ? subscription.image : null)
    );
    setExistingImageUrl(remoteImage);
    setPicture(null);
    setPictureRemoved(false);

    setStartDate(String(subscription.start_date || '').split('T')[0]);
    setEndDate(String(subscription.end_date || '').split('T')[0]);
    setAmount(String(subscription.amount ?? ''));
    setPaymentStatus(String(subscription.payment_status || 'paid'));
    setPaymentReference(subscription.payment_reference || '');
  }, [subscription]);

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
    if (keepStart && /^\d{4}-\d{2}-\d{2}$/.test(keepStart.trim())) {
      setEndDate(addMonthsToDate(keepStart.trim(), opt.months));
    }
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
        setPictureRemoved(false);
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

  const clearImage = () => {
    setPicture(null);
    if (existingImageUrl) setPictureRemoved(true);
  };

  const displayImageUri = picture?.uri || (!pictureRemoved ? existingImageUrl : undefined);

  const validateForm = (): boolean => {
    const next: Record<string, string> = {};
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

  const handleUpdateSubscription = async () => {
    if (!validateForm() || !subscription) return;

    setLoading(true);
    try {
      const updateData = {
        plan,
        plan_name: planName.trim(),
        subtitle: subtitle.trim() || null,
        description: description.trim() || null,
        features: features.map((f) => f.trim()).filter(Boolean),
        target_type: targetType,
        client_ids:
          targetType === 'specific_clients' && subscription.client_id
            ? [subscription.client_id]
            : subscription.client_ids || undefined,
        start_date: startDate.trim(),
        end_date: endDate.trim(),
        payment_status: paymentStatus,
        amount: parseFloat(amount.trim()),
        payment_reference: paymentReference.trim() || null,
        picture: picture || null,
        picture_remove: pictureRemoved && !picture ? true : undefined,
      };

      const res = await subscriptionService.updateSubscription(subscription.id, updateData);
      // Postman returns the subscription object (may omit success flag)
      if (res?.success === false || res?.status === false) {
        throw new Error(res.message || 'Failed to update subscription.');
      }

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        res?.message ||
          t('admin.subscriptions.updateSuccess', {
            defaultValue: 'Subscription updated successfully.',
          }),
        [{ text: t('common.ok', { defaultValue: 'OK' }), onPress: () => navigation.goBack() }]
      );
    } catch (err: unknown) {
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
          t('admin.subscriptions.updateFailed', {
            defaultValue: 'Failed to update subscription.',
          })
      );
    } finally {
      setLoading(false);
    }
  };

  const previewPrice = useMemo(() => amount.trim() || '0', [amount]);
  const knownPlan = Boolean(planKey) || SUBSCRIPTION_PLAN_OPTIONS.some((p) => p.value === plan);

  if (!subscription) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>
            {t('admin.subscriptions.notFound', {
              defaultValue: 'Subscription data not found',
            })}
          </Text>
          <Button title={t('common.back', { defaultValue: 'Go Back' })} onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={[styles.hero, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heroTitle}>
          {t('admin.subscriptions.editTitle', { defaultValue: 'Edit subscription' })}
        </Text>
        <Text style={styles.heroSubtitle}>
          {t('admin.subscriptions.editSubtitle', {
            defaultValue: 'Update plan details, features, and audience',
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
          {/* Client (read-only) */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t('admin.subscriptions.sectionClient', { defaultValue: 'Client' })}
            </Text>
            <View style={styles.clientInfoCard}>
              <Text style={styles.clientName}>{subscription.client?.name || '—'}</Text>
              <Text style={styles.clientMeta}>{subscription.client?.email || ''}</Text>
              {subscription.client?.phone ? (
                <Text style={styles.clientMeta}>{subscription.client.phone}</Text>
              ) : null}
            </View>
          </View>

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
                onPress={() => setTargetType('all_users')}
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
              </TouchableOpacity>
            </View>
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
            {!knownPlan && plan ? (
              <Text style={styles.unknownPlanNote}>
                {t('admin.subscriptions.currentPlan', {
                  defaultValue: `Current plan: ${getSubscriptionPlanLabel(plan)}`,
                })}
              </Text>
            ) : null}
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
                    {displayImageUri
                      ? t('admin.subscriptions.changeImage', { defaultValue: 'Change image' })
                      : t('admin.subscriptions.addImage', { defaultValue: 'Add image' })}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {displayImageUri ? (
              <View style={styles.imagePreviewWrap}>
                <Image
                  source={{ uri: displayImageUri }}
                  style={styles.imagePreview}
                  contentFit="cover"
                />
                <TouchableOpacity style={styles.imageRemove} onPress={clearImage}>
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
              {displayImageUri ? (
                <Image
                  source={{ uri: displayImageUri }}
                  style={styles.previewHeroImage}
                  contentFit="cover"
                />
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

          <View style={styles.buttonRow}>
            <Button
              title={t('common.cancel', { defaultValue: 'Cancel' })}
              onPress={() => navigation.goBack()}
              variant="outline"
              style={{ flex: 1 }}
            />
            <Button
              title={t('admin.subscriptions.update', { defaultValue: 'Update' })}
              onPress={() => void handleUpdateSubscription()}
              loading={loading}
              style={{ flex: 1 }}
            />
          </View>
          <View style={{ height: SPACING.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  clientInfoCard: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clientName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  clientMeta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
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
  unknownPlanNote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
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
  buttonRow: { flexDirection: 'row', gap: SPACING.md },
  errorText: { fontSize: FONT_SIZES.xs, color: COLORS.error },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
});

export default EditSubscriptionScreen;
