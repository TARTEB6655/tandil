import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Button } from '../../components/common/Button';
import Header from '../../components/common/Header';
import AdminCouponFormFields, {
  type CouponFormState,
  validateCouponForm,
  formToPayload,
} from '../../components/admin/AdminCouponFormFields';
import { adminCouponService } from '../../services/adminCouponService';
import { adminService } from '../../services/adminService';
import { getCouponErrorFeedback } from '../../utils/couponApiErrors';
import { parseAdminServicesList } from '../../utils/adminServicesList';

const emptyForm = (): CouponFormState => ({
  code: '',
  title: '',
  description: '',
  discountType: 'percentage',
  discountValue: '',
  minOrderAmount: '0',
  maxDiscountAmount: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
  usageLimit: '',
  usageLimitPerUser: '',
  appliesTo: 'all',
  selectedCategoryIds: [],
  selectedServiceIds: [],
});

const AdminAddCouponScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [form, setForm] = useState<CouponFormState>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [services, setServices] = useState<{ id: number; name: string }[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const res = await adminService.getCategories({ per_page: 100 });
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : (raw as any)?.data ?? [];
      setCategories(
        (Array.isArray(list) ? list : []).map((c: { id: number; name: string }) => ({
          id: c.id,
          name: c.name,
        }))
      );
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
      setServices(parseAdminServicesList(res.data));
    } catch {
      setServices([]);
    } finally {
      setServicesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadServices();
  }, [loadCategories, loadServices]);

  const handleCreate = async () => {
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
      const res = await adminCouponService.createCoupon(formToPayload(form));
      Alert.alert(
        t('admin.users.success', 'Success'),
        res.message || t('admin.couponForm.created', 'Coupon created.'),
        [{ text: t('common.ok', 'OK'), onPress: () => navigation.goBack() }]
      );
    } catch (err: unknown) {
      const { alertMessage, fieldErrors } = getCouponErrorFeedback(err);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
      }
      Alert.alert(
        fieldErrors.code
          ? t('admin.couponForm.validationTitle', 'Check the form')
          : t('admin.users.error', 'Error'),
        alertMessage
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header
        title={t('admin.couponForm.addTitle', 'Create coupon')}
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
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>
              {t('admin.couponForm.heroTitle', 'New discount code')}
            </Text>
            <Text style={styles.heroSub}>
              {t(
                'admin.couponForm.heroSub',
                'Customers will enter this code at cart or checkout.'
              )}
            </Text>
          </View>

          <AdminCouponFormFields
            form={form}
            setForm={setForm}
            errors={errors}
            setErrors={setErrors}
            categories={categories}
            categoriesLoading={categoriesLoading}
            services={services}
            servicesLoading={servicesLoading}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={t('admin.couponForm.createButton', 'Create coupon')}
            onPress={handleCreate}
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
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.md },
  hero: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  heroTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  heroSub: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.background,
    opacity: 0.9,
    marginTop: SPACING.xs,
    lineHeight: 20,
  },
  footer: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});

export default AdminAddCouponScreen;
