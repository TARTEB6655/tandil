import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Button } from '../../components/common/Button';
import Header from '../../components/common/Header';
import AdminCouponFormFields, {
  type CouponFormState,
  validateCouponForm,
  formToPayload,
  adminCouponToFormState,
} from '../../components/admin/AdminCouponFormFields';
import { adminCouponService } from '../../services/adminCouponService';
import { adminService } from '../../services/adminService';
import type { AdminCoupon } from '../../types/adminCoupon';
import { getCouponDiscountBadge } from '../../utils/couponDisplay';
import { formatCouponScopeLabel } from '../../utils/couponScopeLabel';
import { getCouponErrorFeedback } from '../../utils/couponApiErrors';
import { parseAdminServicesList } from '../../utils/adminServicesList';

type RouteParams = { coupon?: AdminCoupon; couponId?: number | string };

const AdminEditCouponScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<{ params: RouteParams }>();
  const initial = route.params?.coupon;
  const couponId = initial?.id ?? route.params?.couponId;

  const [coupon, setCoupon] = useState<AdminCoupon | null>(initial ?? null);
  const [form, setForm] = useState<CouponFormState>(
    initial
      ? adminCouponToFormState(initial)
      : adminCouponToFormState({
          code: '',
          title: '',
          discount_type: 'percentage',
          discount_value: 0,
          min_order_amount: 0,
          is_active: true,
          applies_to: 'all',
          category_ids: [],
          service_ids: [],
        })
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingCoupon, setLoadingCoupon] = useState(!!couponId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [services, setServices] = useState<{ id: number; name: string }[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [categoryNameById, setCategoryNameById] = useState<Map<number, string>>(new Map());
  const [serviceNameById, setServiceNameById] = useState<Map<number, string>>(new Map());

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const res = await adminService.getCategories({ per_page: 100 });
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : (raw as any)?.data ?? [];
      const items = (Array.isArray(list) ? list : []).map((c: { id: number; name: string }) => ({
        id: c.id,
        name: c.name,
      }));
      setCategories(items);
      const map = new Map<number, string>();
      items.forEach((c) => map.set(c.id, c.name));
      setCategoryNameById(map);
    } catch {
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const loadServices = useCallback(async () => {
    setServicesLoading(true);
    try {
      const res = await adminService.getServices({ per_page: 100 });
      const items = parseAdminServicesList(res.data);
      setServices(items);
      const map = new Map<number, string>();
      items.forEach((s) => map.set(s.id, s.name));
      setServiceNameById(map);
    } catch {
      setServices([]);
    } finally {
      setServicesLoading(false);
    }
  }, []);

  const loadCoupon = useCallback(async () => {
    if (!couponId) {
      setLoadingCoupon(false);
      setLoadError(t('admin.couponForm.missingId', 'Coupon ID is missing.'));
      return;
    }
    setLoadingCoupon(true);
    setLoadError(null);
    try {
      const res = await adminCouponService.getCouponById(couponId);
      setCoupon(res.coupon);
      setForm(adminCouponToFormState(res.coupon));
    } catch (err: any) {
      setLoadError(
        err.response?.data?.message ||
          err.message ||
          t('admin.couponForm.loadFailed', 'Failed to load coupon details.')
      );
    } finally {
      setLoadingCoupon(false);
    }
  }, [couponId, t]);

  useFocusEffect(
    useCallback(() => {
      loadCoupon();
      loadCategories();
      loadServices();
    }, [loadCoupon, loadCategories, loadServices])
  );

  const handleUpdate = async () => {
    if (!couponId) return;
    const validation = validateCouponForm(form, t);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      Alert.alert(
        t('admin.couponForm.validationTitle', 'Check the form'),
        t('admin.couponForm.validationMessage', 'Fix the highlighted fields.'),
        [{ text: t('common.ok', 'OK') }]
      );
      return;
    }

    setLoading(true);
    try {
      const res = await adminCouponService.updateCoupon(couponId, formToPayload(form));
      Alert.alert(
        t('admin.users.success', 'Success'),
        res.message || t('admin.couponForm.updated', 'Coupon updated.'),
        [{ text: t('common.ok', 'OK'), onPress: () => navigation.goBack() }]
      );
    } catch (err: unknown) {
      const { alertMessage, fieldErrors } = getCouponErrorFeedback(err);
      const fromServer = !!(err as { response?: unknown })?.response;
      if (Object.keys(fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
      }
      Alert.alert(
        fromServer && fieldErrors.service_ids
          ? t('admin.couponForm.serverValidationTitle', 'Server could not save')
          : Object.keys(fieldErrors).length > 0
            ? t('admin.couponForm.validationTitle', 'Check the form')
            : t('admin.users.error', 'Error'),
        fromServer && fieldErrors.service_ids
          ? t(
              'admin.couponForm.serverServiceIdsHint',
              'The app sent your service selection, but the API rejected it. Ask backend to accept service_ids[] on create/update, or fix how service_ids are returned on GET.'
            ) +
              '\n\n' +
              alertMessage
          : alertMessage
      );
    } finally {
      setLoading(false);
    }
  };

  const badge = coupon ? getCouponDiscountBadge(coupon, t) : null;
  const isActive = coupon?.is_active === true || coupon?.is_active === 1;
  const scopeLabel = coupon
    ? formatCouponScopeLabel(coupon, categoryNameById, serviceNameById, t)
    : '';

  if (loadingCoupon) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Header title={t('admin.couponForm.editTitle', 'Edit coupon')} showBack showLanguage={false} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('admin.couponForm.loadingDetail', 'Loading coupon details…')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Header title={t('admin.couponForm.editTitle', 'Edit coupon')} showBack showLanguage={false} />
        <View style={styles.loadingWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadCoupon}>
            <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header
        title={t('admin.couponForm.editTitle', 'Edit coupon')}
        showBack
        showLanguage={false}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {coupon && badge ? (
            <View style={styles.previewCard}>
              <View style={styles.previewBadge}>
                <Text style={styles.previewMain}>{badge.main}</Text>
                <Text style={styles.previewSub}>{badge.sub}</Text>
              </View>
              <View style={styles.previewInfo}>
                <View style={styles.previewTopRow}>
                  <Text style={styles.previewCode}>{coupon.code}</Text>
                  <View
                    style={[styles.statusPill, isActive ? styles.statusActive : styles.statusOff]}
                  >
                    <Text style={[styles.statusText, isActive && styles.statusTextOn]}>
                      {isActive
                        ? t('admin.coupons.active', 'Active')
                        : t('admin.coupons.inactive', 'Inactive')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.previewTitle} numberOfLines={2}>
                  {coupon.title}
                </Text>
                {coupon.description ? (
                  <Text style={styles.previewDesc} numberOfLines={2}>
                    {coupon.description}
                  </Text>
                ) : null}
                <Text style={styles.previewScope}>{scopeLabel}</Text>
                <View style={styles.previewMetaRow}>
                  {(coupon.starts_at || coupon.ends_at) && (
                    <View style={styles.metaChip}>
                      <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />
                      <Text style={styles.metaChipText}>
                        {t('admin.couponForm.previewDateRange', '{{start}} → {{end}}', {
                          start: coupon.starts_at?.slice(0, 10) ?? '—',
                          end: coupon.ends_at?.slice(0, 10) ?? '—',
                        })}
                      </Text>
                    </View>
                  )}
                  {coupon.usage_limit_per_user != null ? (
                    <View style={styles.metaChip}>
                      <Ionicons name="person-outline" size={12} color={COLORS.textSecondary} />
                      <Text style={styles.metaChipText}>
                        {t('admin.couponForm.previewUsagePerUser', '{{count}}× per user', {
                          count: coupon.usage_limit_per_user,
                        })}
                      </Text>
                    </View>
                  ) : null}
                  {(coupon.paid_redemptions ?? 0) >= 0 ? (
                    <View style={styles.metaChip}>
                      <Ionicons name="checkmark-done-outline" size={12} color={COLORS.textSecondary} />
                      <Text style={styles.metaChipText}>
                        {coupon.paid_redemptions ?? 0}{' '}
                        {t('admin.coupons.redeemed', 'redeemed')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          <AdminCouponFormFields
            form={form}
            setForm={setForm}
            errors={errors}
            setErrors={setErrors}
            codeEditable
            categories={categories}
            categoriesLoading={categoriesLoading}
            services={services}
            servicesLoading={servicesLoading}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={t('admin.couponForm.saveButton', 'Save changes')}
            onPress={handleUpdate}
            loading={loading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceLight },
  flex: { flex: 1 },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: { marginTop: SPACING.md, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  errorText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  retryText: { color: COLORS.background, fontWeight: FONT_WEIGHTS.semiBold },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.md },
  previewCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  previewBadge: {
    width: 88,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  previewMain: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  previewSub: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
    opacity: 0.9,
  },
  previewInfo: { flex: 1, padding: SPACING.md, minWidth: 0 },
  previewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  previewCode: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusActive: { backgroundColor: COLORS.success + '20' },
  statusOff: { backgroundColor: COLORS.textSecondary + '25' },
  statusText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.textSecondary },
  statusTextOn: { color: COLORS.success },
  previewTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  previewDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  previewScope: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
    marginTop: SPACING.sm,
  },
  previewMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
  },
  metaChipText: { fontSize: 10, color: COLORS.textSecondary },
  footer: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});

export default AdminEditCouponScreen;
