// @refresh reset
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { VENDOR_BANK_OPTIONS } from '../../constants/uaeBanks';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import type { VendorSignupOption } from '../../types/adminVendorMeta';
import { contractorRegistrationMetaService } from '../../services/contractorRegistrationMetaService';
import type { ContractorSignupOptions } from '../../types/contractorRegistrationMeta';
import {
  catalogImagePickerOptions,
  ensureVendorDocumentWithinLimit,
  isImageTooLargeError,
  MAX_CATALOG_IMAGE_MB,
  MAX_VENDOR_DOCUMENT_MB,
} from '../../utils/compressImage';
import { contractorAuthService } from '../../services/contractorAuthService';
import MapPickerModal from '../../components/MapPickerModal';
import type { AddressFromLocation } from '../../utils/addressFromLocation';

type PickedFile = { uri: string; name: string; mimeType: string };

function toSignupOption(item: { id?: number; name: string; slug: string }): VendorSignupOption {
  return { id: item.id, name: item.name, slug: item.slug };
}

/** Unique key for multi-select (Arabic names often have no ASCII slug). */
function optionSelectKey(item: VendorSignupOption): string {
  if (item.id != null) return `id:${item.id}`;
  const slug = item.slug?.trim();
  if (slug) return slug;
  return item.name;
}

function resolveOptionId(
  key: string,
  pool: { id?: number; slug: string }[]
): number | null {
  if (key.startsWith('id:')) {
    const id = Number(key.slice(3));
    return Number.isFinite(id) ? id : null;
  }
  const row = pool.find((p) => p.slug === key);
  return row?.id ?? null;
}

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function SectionTitle({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function UploadField({
  label,
  required,
  file,
  onPicked,
  onClear,
}: {
  label: string;
  required?: boolean;
  file: PickedFile | null;
  onPicked: (f: PickedFile) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const pickDocument = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const name = (asset.name || 'document').split('?')[0];
        const mimeType =
          asset.mimeType ||
          (name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        const isPdf =
          mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
        const maxMb = isPdf ? MAX_VENDOR_DOCUMENT_MB : MAX_CATALOG_IMAGE_MB;
        await ensureVendorDocumentWithinLimit(asset.uri, asset.size, maxMb);
        onPicked({ uri: asset.uri, name, mimeType });
      }
    } catch (err: unknown) {
      if (isImageTooLargeError(err)) {
        Alert.alert(t('common.error'), err.message);
      } else {
        Alert.alert(t('common.error'), t('vendorSignup.chooseFile', { defaultValue: 'Choose File' }));
      }
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(t('common.error'), t('vendorSignup.photoPermission'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync(catalogImagePickerOptions());
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        await ensureVendorDocumentWithinLimit(
          asset.uri,
          asset.fileSize,
          MAX_CATALOG_IMAGE_MB
        );
        onPicked({
          uri: asset.uri,
          name: `photo_${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
        });
      }
    } catch (err: unknown) {
      if (isImageTooLargeError(err)) {
        Alert.alert(t('common.error'), err.message);
      } else {
        Alert.alert(
          t('common.error'),
          t('vendorSignup.galleryFailed', {
            defaultValue: 'Could not open photo gallery. Please try again.',
          })
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.uploadWrap}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      <Text style={styles.uploadHint}>
        {t('supervisorSignup.uploadHint', {
          pdfMb: MAX_VENDOR_DOCUMENT_MB,
          imageMb: MAX_CATALOG_IMAGE_MB,
        })}
      </Text>
      {file ? (
        <View style={styles.uploadSelected}>
          <Ionicons name="document-text-outline" size={22} color={COLORS.primary} />
          <Text style={styles.uploadName} numberOfLines={1}>
            {file.name}
          </Text>
          <TouchableOpacity onPress={onClear} hitSlop={8}>
            <Ionicons name="close-circle" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.uploadActions}>
          <TouchableOpacity style={styles.uploadBtn} onPress={pickDocument} disabled={busy}>
            {busy ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <Ionicons name="folder-open-outline" size={18} color={COLORS.primary} />
                <Text style={styles.uploadBtnText}>{t('supervisorSignup.uploadPdf')}</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadBtn} onPress={pickPhoto} disabled={busy}>
            <Ionicons name="image-outline" size={18} color={COLORS.primary} />
            <Text style={styles.uploadBtnText}>{t('supervisorSignup.uploadPhoto')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const SupervisorSignupScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState('');
  const [tradeLicenseFile, setTradeLicenseFile] = useState<PickedFile | null>(null);
  const [tradeLicenseExpiry, setTradeLicenseExpiry] = useState('');
  const [trn, setTrn] = useState('');
  const [vatCertificate, setVatCertificate] = useState<PickedFile | null>(null);
  const [companyEmirate, setCompanyEmirate] = useState('');
  /** From map geocode when available; register falls back to emirate name for API `city`. */
  const [companyCity, setCompanyCity] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyAddressFromMap, setCompanyAddressFromMap] = useState('');
  const [companyLatitude, setCompanyLatitude] = useState<number | undefined>();
  const [companyLongitude, setCompanyLongitude] = useState<number | undefined>();
  const [mapPickerVisible, setMapPickerVisible] = useState(false);

  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [iban, setIban] = useState('');
  const [bankConfirmationLetter, setBankConfirmationLetter] = useState<PickedFile | null>(null);

  const [mainCategories, setMainCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [coverageEmirates, setCoverageEmirates] = useState<string[]>([]);
  const [coverageCities, setCoverageCities] = useState<string[]>([]);
  const [serviceCoverageAreas, setServiceCoverageAreas] = useState<string[]>([]);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [signupOptions, setSignupOptions] = useState<ContractorSignupOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [registrationClosed, setRegistrationClosed] = useState(false);
  const [emirateOptions, setEmirateOptions] = useState<VendorSignupOption[]>([]);
  const [expiryPickerOpen, setExpiryPickerOpen] = useState(false);
  const [expiryDate, setExpiryDate] = useState(new Date());

  const [pickerModal, setPickerModal] = useState<
    | null
    | { kind: 'company_emirate' | 'bank' }
    | {
        kind: 'multi';
        key:
          | 'mainCategories'
          | 'subcategories'
          | 'selectedServices'
          | 'coverageEmirates'
          | 'coverageCities'
          | 'serviceCoverageAreas';
        title: string;
        options: VendorSignupOption[];
      }
  >(null);
  const [bankSearch, setBankSearch] = useState('');

  const loadSignupOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const opts = await contractorAuthService.getRegistrationOptions();
      setSignupOptions(opts);
      setRegistrationClosed(!opts.registration_enabled);
      setEmirateOptions(opts.emirates.map(toSignupOption));
    } catch (err) {
      try {
        const fallback = await contractorRegistrationMetaService.getSignupOptions();
        setSignupOptions(fallback);
        setRegistrationClosed(!fallback.registration_enabled);
        setEmirateOptions(fallback.emirates.map(toSignupOption));
      } catch {
        setSignupOptions(null);
      }
      Alert.alert(
        t('common.error'),
        contractorAuthService.getErrorMessage(
          err,
          t('supervisorSignup.loadOptionsFailed')
        )
      );
    } finally {
      setOptionsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadSignupOptions();
  }, [loadSignupOptions]);

  const mainCategoryOptions = useMemo(
    () => signupOptions?.main_categories.map(toSignupOption) ?? [],
    [signupOptions]
  );

  const selectedMainCategoryIds = useMemo(() => {
    if (!signupOptions) return new Set<number>();
    return new Set(
      mainCategories
        .map((key) => resolveOptionId(key, signupOptions.main_categories))
        .filter((id): id is number => id != null)
    );
  }, [signupOptions, mainCategories]);

  const selectedSubcategoryIds = useMemo(() => {
    if (!signupOptions) return new Set<number>();
    return new Set(
      subcategories
        .map((key) => resolveOptionId(key, signupOptions.subcategories))
        .filter((id): id is number => id != null)
    );
  }, [signupOptions, subcategories]);

  const subcategoryOptions = useMemo(() => {
    if (!signupOptions) return [];
    return signupOptions.subcategories
      .filter((s) => {
        if (!mainCategories.length) return true;
        if (s.parent_id != null && selectedMainCategoryIds.has(s.parent_id)) return true;
        if (s.parent_slug != null && mainCategories.includes(s.parent_slug)) return true;
        return mainCategories.some(
          (key) => resolveOptionId(key, signupOptions.main_categories) === s.parent_id
        );
      })
      .map(toSignupOption);
  }, [signupOptions, mainCategories, selectedMainCategoryIds]);

  const serviceOptions = useMemo(() => {
    if (!signupOptions) return [];
    return signupOptions.services.filter((s) => {
      if (!subcategories.length) return true;
      if (s.parent_id == null && !s.parent_slug) return true;
      if (s.parent_slug && subcategories.includes(s.parent_slug)) return true;
      if (s.parent_id != null && selectedSubcategoryIds.has(s.parent_id)) return true;
      return subcategories.some(
        (key) => resolveOptionId(key, signupOptions.subcategories) === s.parent_id
      );
    }).map(toSignupOption);
  }, [signupOptions, subcategories, selectedSubcategoryIds]);

  const coverageEmirateOptions = useMemo(
    () => signupOptions?.emirates.map(toSignupOption) ?? [],
    [signupOptions]
  );

  const coverageAreaOptions = useMemo(
    () => signupOptions?.coverage_areas.map(toSignupOption) ?? [],
    [signupOptions]
  );

  const coverageCityOptions = useMemo(() => {
    if (!signupOptions) return [];
    const emiratesSlugs = coverageEmirates.length
      ? coverageEmirates
      : signupOptions.emirates.map((e) => e.slug);
    return signupOptions.cities
      .filter((c) => c.parent_slug != null && emiratesSlugs.includes(c.parent_slug))
      .map(toSignupOption);
  }, [signupOptions, coverageEmirates]);

  type MultiFieldKey =
    | 'mainCategories'
    | 'subcategories'
    | 'selectedServices'
    | 'coverageEmirates'
    | 'coverageCities'
    | 'serviceCoverageAreas';

  const serviceCategoryFields = useMemo((): [string, MultiFieldKey, VendorSignupOption[]][] => {
    const req = (label: string) => `${label} *`;
    const fields: [string, MultiFieldKey, VendorSignupOption[]][] = [
      [req(t('supervisorSignup.fieldMainCategory')), 'mainCategories', mainCategoryOptions],
      [req(t('supervisorSignup.fieldSubcategory')), 'subcategories', subcategoryOptions],
      [req(t('supervisorSignup.fieldServices')), 'selectedServices', serviceOptions],
      [req(t('supervisorSignup.fieldEmirates')), 'coverageEmirates', coverageEmirateOptions],
    ];
    if ((signupOptions?.cities?.length ?? 0) > 0) {
      fields.push([req(t('supervisorSignup.fieldCities')), 'coverageCities', coverageCityOptions]);
    }
    fields.push([
      req(t('supervisorSignup.fieldCoverageAreas')),
      'serviceCoverageAreas',
      coverageAreaOptions,
    ]);
    return fields;
  }, [
    t,
    signupOptions?.cities?.length,
    mainCategoryOptions,
    subcategoryOptions,
    serviceOptions,
    coverageEmirateOptions,
    coverageCityOptions,
    coverageAreaOptions,
  ]);

  const filteredBanks = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    if (!q) return VENDOR_BANK_OPTIONS;
    return VENDOR_BANK_OPTIONS.filter((b) => b.toLowerCase().includes(q));
  }, [bankSearch]);

  const toggleMulti = useCallback((slug: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]);
  }, []);

  const handleCompanyMapSelect = useCallback(
    (a: AddressFromLocation, coords?: { latitude: number; longitude: number }) => {
      const line = [a.street_address, a.city ?? '', a.state, a.country].filter(Boolean).join(', ');
      const full = line || a.street_address;
      setCompanyAddressFromMap(full);
      setCompanyAddress(full);
      const cityFromMap = (a.city ?? a.state ?? '').trim();
      setCompanyCity(cityFromMap);
      if (coords) {
        setCompanyLatitude(coords.latitude);
        setCompanyLongitude(coords.longitude);
      }
      setMapPickerVisible(false);
    },
    []
  );

  const labelForSlugs = (keys: string[], options: VendorSignupOption[]) => {
    if (!keys.length) return '';
    return keys
      .map((key) => {
        if (key.startsWith('id:')) {
          const id = Number(key.slice(3));
          return options.find((o) => o.id === id)?.name ?? key;
        }
        return options.find((o) => o.slug === key)?.name ?? key;
      })
      .join(', ');
  };

  const slugsToIds = (
    keys: string[],
    pool: { id?: number; slug: string; name?: string }[],
    fieldLabel: string
  ): number[] => {
    const ids: number[] = [];
    for (const key of keys) {
      let row: { id?: number } | undefined;
      if (key.startsWith('id:')) {
        const id = Number(key.slice(3));
        row = pool.find((p) => p.id === id);
      } else {
        row = pool.find((p) => p.slug === key);
      }
      if (row?.id == null) {
        throw new Error(
          `${fieldLabel} option is missing an ID. Refresh signup options or contact support.`
        );
      }
      ids.push(row.id);
    }
    return ids;
  };

  const validate = (): boolean => {
    const missing: string[] = [];
    if (!name.trim()) missing.push(t('supervisorSignup.fullName'));
    if (!phone.trim()) missing.push(t('supervisorSignup.mobile'));
    if (!email.trim()) missing.push(t('supervisorSignup.email'));
    if (!password.trim()) missing.push(t('supervisorSignup.password'));
    if (password.length < 6) {
      Alert.alert(t('common.error'), t('supervisorSignup.passwordMin'));
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('technicianSignup.passwordMismatch'));
      return false;
    }
    if (!companyName.trim()) missing.push(t('supervisorSignup.companyName'));
    if (!tradeLicenseNumber.trim()) missing.push(t('supervisorSignup.tradeLicenseNumber'));
    if (!tradeLicenseFile) missing.push(t('supervisorSignup.tradeLicenseUpload'));
    if (!tradeLicenseExpiry) missing.push(t('supervisorSignup.tradeLicenseExpiry'));
    if (!companyEmirate) missing.push(t('supervisorSignup.emirate'));
    if (!companyAddress.trim()) missing.push(t('supervisorSignup.companyAddress'));
    if (!bankName.trim()) missing.push(t('supervisorSignup.bankName'));
    if (!accountHolderName.trim()) missing.push(t('supervisorSignup.accountHolder'));
    if (!bankAccountNumber.trim()) missing.push(t('supervisorSignup.bankAccountNumber'));
    if (!iban.trim()) missing.push(t('supervisorSignup.iban'));
    if (!bankConfirmationLetter) missing.push(t('supervisorSignup.bankConfirmation'));
    if (!mainCategories.length) missing.push(t('supervisorSignup.fieldMainCategory'));
    if ((signupOptions?.subcategories?.length ?? 0) > 0 && !subcategories.length) {
      missing.push(t('supervisorSignup.fieldSubcategory'));
    }
    if (!selectedServices.length) missing.push(t('supervisorSignup.fieldServices'));
    if (!coverageEmirates.length) missing.push(t('supervisorSignup.fieldEmirates'));
    if ((signupOptions?.cities?.length ?? 0) > 0 && !coverageCities.length) {
      missing.push(t('supervisorSignup.fieldCities'));
    }
    if (!serviceCoverageAreas.length) missing.push(t('supervisorSignup.fieldCoverageAreas'));
    if (!termsAccepted) missing.push(t('vendorSignup.termsRequired'));

    if (missing.length) {
      Alert.alert(
        t('booking.missingTitle', { defaultValue: 'Missing Information' }),
        missing.join('\n')
      );
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert(t('common.error'), t('technicianSignup.invalidEmail'));
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (registrationClosed) {
      Alert.alert(
        t('common.error'),
        t('supervisorSignup.registrationClosed')
      );
      return;
    }
    if (!validate()) return;
    if (!tradeLicenseFile || !bankConfirmationLetter) return;
    if (!signupOptions) {
      Alert.alert(t('common.error'), t('supervisorSignup.optionsLoading'));
      return;
    }

    setSubmitting(true);
    try {
      const companyEmirateName =
        emirateOptions.find((e) => e.slug === companyEmirate)?.name?.trim() || companyEmirate;

      await contractorAuthService.register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        password_confirmation: confirmPassword,
        company_name: companyName.trim(),
        trade_license_number: tradeLicenseNumber.trim(),
        trade_license_expiry_date: tradeLicenseExpiry,
        trn: trn.trim() || undefined,
        emirate: companyEmirateName,
        city: companyCity.trim() || companyEmirateName,
        company_address: companyAddress.trim(),
        bank_name: bankName.trim(),
        account_holder_name: accountHolderName.trim(),
        bank_account_number: bankAccountNumber.trim(),
        iban: iban.trim(),
        trade_license_upload: tradeLicenseFile,
        vat_certificate: vatCertificate,
        bank_confirmation_letter: bankConfirmationLetter,
        main_service_category_ids: slugsToIds(
          mainCategories,
          signupOptions.main_categories,
          'Main service category'
        ),
        service_subcategory_ids: slugsToIds(
          subcategories,
          signupOptions.subcategories,
          'Service subcategory'
        ),
        selected_service_ids: slugsToIds(
          selectedServices,
          signupOptions.services,
          'Service'
        ),
        coverage_emirate_ids: slugsToIds(
          coverageEmirates,
          signupOptions.emirates,
          'Coverage emirate'
        ),
        coverage_city_ids: slugsToIds(coverageCities, signupOptions.cities, 'Coverage city'),
        service_coverage_area_ids: slugsToIds(
          serviceCoverageAreas,
          signupOptions.coverage_areas,
          'Coverage area'
        ),
      });
      Alert.alert(
        t('supervisorSignup.submittedTitle'),
        t('supervisorSignup.submitted'),
        [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
      );
    } catch (err: unknown) {
      Alert.alert(
        t('common.error'),
        contractorAuthService.getErrorMessage(
          err,
          t('supervisorSignup.submitFailed')
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openMultiPicker = (
    key:
      | 'mainCategories'
      | 'subcategories'
      | 'selectedServices'
      | 'coverageEmirates'
      | 'coverageCities'
      | 'serviceCoverageAreas',
    title: string,
    options: VendorSignupOption[]
  ) => {
    setPickerModal({ kind: 'multi', key, title, options });
  };

  const multiState = (key: string): [string[], (v: string[]) => void] => {
    switch (key) {
      case 'mainCategories':
        return [mainCategories, setMainCategories];
      case 'subcategories':
        return [subcategories, setSubcategories];
      case 'selectedServices':
        return [selectedServices, setSelectedServices];
      case 'coverageEmirates':
        return [coverageEmirates, setCoverageEmirates];
      case 'coverageCities':
        return [coverageCities, setCoverageCities];
      default:
        return [serviceCoverageAreas, setServiceCoverageAreas];
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{t('supervisorSignup.title')}</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: SPACING.xxl + Math.max(insets.bottom, 12) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>{t('supervisorSignup.subtitle')}</Text>

          {registrationClosed ? (
            <View style={styles.closedBanner}>
              <Ionicons name="lock-closed-outline" size={22} color={COLORS.warning} />
              <Text style={styles.closedBannerText}>
                {t('supervisorSignup.registrationClosedBanner')}
              </Text>
            </View>
          ) : null}

          <SectionTitle icon="person-outline" title={t('supervisorSignup.sectionPersonal')} />
          <View style={styles.sectionCard}>
            <Input
              label={`${t('supervisorSignup.fullName')} *`}
              placeholder={t('supervisorSignup.fullNamePh')}
              value={name}
              onChangeText={setName}
              leftIcon="person-outline"
            />
            <Input
              label={`${t('supervisorSignup.mobile')} *`}
              placeholder={t('supervisorSignup.mobilePh')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              leftIcon="call-outline"
            />
            <Input
              label={`${t('supervisorSignup.email')} *`}
              placeholder={t('supervisorSignup.emailPh')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon="mail-outline"
            />
            <Input
              label={`${t('supervisorSignup.password')} *`}
              placeholder={t('supervisorSignup.passwordPh')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              rightIcon={showPassword ? 'eye-off' : 'eye'}
              onRightIconPress={() => setShowPassword((p) => !p)}
            />
            <Input
              label={`${t('supervisorSignup.confirmPassword')} *`}
              placeholder={t('supervisorSignup.confirmPasswordPh')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              rightIcon={showConfirmPassword ? 'eye-off' : 'eye'}
              onRightIconPress={() => setShowConfirmPassword((p) => !p)}
            />
          </View>

          <SectionTitle icon="business-outline" title={t('supervisorSignup.sectionCompany')} />
          <View style={styles.sectionCard}>
            <Input
              label={`${t('supervisorSignup.companyName')} *`}
              placeholder={t('supervisorSignup.companyNamePh')}
              value={companyName}
              onChangeText={setCompanyName}
              leftIcon="business-outline"
            />
            <Input
              label={`${t('supervisorSignup.tradeLicenseNumber')} *`}
              placeholder={t('supervisorSignup.tradeLicenseNumberPh')}
              value={tradeLicenseNumber}
              onChangeText={setTradeLicenseNumber}
            />
            <UploadField
              label={t('supervisorSignup.tradeLicenseUpload')}
              required
              file={tradeLicenseFile}
              onPicked={setTradeLicenseFile}
              onClear={() => setTradeLicenseFile(null)}
            />
            <Text style={styles.fieldLabel}>{`${t('supervisorSignup.tradeLicenseExpiry')} *`}</Text>
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={() => setExpiryPickerOpen(true)}
            >
              <Text style={[styles.selectText, !tradeLicenseExpiry && styles.placeholder]}>
                {tradeLicenseExpiry || t('supervisorSignup.selectExpiry')}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>
            {expiryPickerOpen && (
              <DateTimePicker
                value={expiryDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(_, selected) => {
                  if (Platform.OS === 'android') setExpiryPickerOpen(false);
                  if (selected) {
                    setExpiryDate(selected);
                    setTradeLicenseExpiry(formatDateYYYYMMDD(selected));
                  }
                }}
              />
            )}
            {Platform.OS === 'ios' && expiryPickerOpen ? (
              <TouchableOpacity style={styles.dateDone} onPress={() => setExpiryPickerOpen(false)}>
                <Text style={styles.dateDoneText}>{t('supervisorSignup.done')}</Text>
              </TouchableOpacity>
            ) : null}
            <Input
              label={t('supervisorSignup.trn')}
              placeholder={t('supervisorSignup.trnPh')}
              value={trn}
              onChangeText={setTrn}
            />
            <UploadField
              label={t('supervisorSignup.vatCertificate')}
              file={vatCertificate}
              onPicked={setVatCertificate}
              onClear={() => setVatCertificate(null)}
            />
            <Text style={styles.fieldLabel}>{`${t('supervisorSignup.emirate')} *`}</Text>
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={() => setPickerModal({ kind: 'company_emirate' })}
            >
              <Text style={[styles.selectText, !companyEmirate && styles.placeholder]}>
                {emirateOptions.find((e) => e.slug === companyEmirate)?.name ||
                  t('supervisorSignup.selectEmirate')}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.fieldLabel}>{`${t('supervisorSignup.companyAddress')} *`}</Text>
            <TouchableOpacity
              style={styles.mapBtn}
              onPress={() => setMapPickerVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="map-outline" size={22} color={COLORS.primary} />
              <View style={styles.mapBtnTextWrap}>
                <Text style={styles.mapBtnTitle} numberOfLines={2}>
                  {companyAddressFromMap || t('supervisorSignup.pickOnMap')}
                </Text>
                {companyLatitude != null && companyLongitude != null ? (
                  <Text style={styles.mapCoords}>
                    {companyLatitude.toFixed(5)}, {companyLongitude.toFixed(5)}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <Input
              label={t('supervisorSignup.addressDetails')}
              placeholder={t('supervisorSignup.companyAddressPh')}
              value={companyAddress}
              onChangeText={(text) => {
                setCompanyAddress(text);
                if (companyAddressFromMap && text.trim() !== companyAddressFromMap.trim()) {
                  setCompanyAddressFromMap('');
                }
              }}
              multiline
              numberOfLines={3}
              leftIcon="location-outline"
            />
          </View>

          <SectionTitle icon="card-outline" title={t('supervisorSignup.sectionBank')} />
          <View style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>{`${t('supervisorSignup.bankName')} *`}</Text>
            <TouchableOpacity style={styles.selectBtn} onPress={() => setPickerModal({ kind: 'bank' })}>
              <Text style={[styles.selectText, !bankName && styles.placeholder]}>
                {bankName || t('supervisorSignup.selectBank')}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <Input
              label={`${t('supervisorSignup.accountHolder')} *`}
              placeholder={t('supervisorSignup.accountHolderPh')}
              value={accountHolderName}
              onChangeText={setAccountHolderName}
            />
            <Input
              label={`${t('supervisorSignup.bankAccountNumber')} *`}
              placeholder={t('supervisorSignup.bankAccountNumberPh')}
              value={bankAccountNumber}
              onChangeText={setBankAccountNumber}
              keyboardType="number-pad"
            />
            <Input
              label={`${t('supervisorSignup.iban')} *`}
              placeholder={t('supervisorSignup.ibanPh')}
              value={iban}
              onChangeText={setIban}
              autoCapitalize="characters"
            />
            <UploadField
              label={t('supervisorSignup.bankConfirmation')}
              required
              file={bankConfirmationLetter}
              onPicked={setBankConfirmationLetter}
              onClear={() => setBankConfirmationLetter(null)}
            />
          </View>

          <SectionTitle icon="grid-outline" title={t('supervisorSignup.sectionCategories')} />
          <View style={styles.sectionCard}>
            <Text style={styles.hint}>{t('supervisorSignup.categoriesHint')}</Text>
            {optionsLoading && (
              <ActivityIndicator style={{ marginVertical: SPACING.lg }} color={COLORS.primary} />
            )}
            {!optionsLoading &&
              serviceCategoryFields.map(([label, key, options]) => {
                const [selected] = multiState(key);
                return (
                  <View key={key} style={styles.multiField}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    <TouchableOpacity
                      style={styles.selectBtn}
                      onPress={() => openMultiPicker(key, label.replace(' *', ''), options)}
                    >
                      <Text
                        style={[styles.selectText, !selected.length && styles.placeholder]}
                        numberOfLines={2}
                      >
                        {selected.length
                          ? labelForSlugs(selected, options)
                          : t('supervisorSignup.selectPlaceholder', {
                              field: label.replace(' *', ''),
                            })}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                );
              })}
          </View>

          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setTermsAccepted((v) => !v)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={termsAccepted ? 'checkbox' : 'square-outline'}
              size={22}
              color={termsAccepted ? COLORS.primary : COLORS.textSecondary}
            />
            <Text style={styles.termsText}>{t('supervisorSignup.termsText')}</Text>
          </TouchableOpacity>

          <Button
            title={submitting ? t('supervisorSignup.submitting') : t('supervisorSignup.submit')}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || registrationClosed || optionsLoading}
            size="large"
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={pickerModal != null} animationType="slide" transparent onRequestClose={() => setPickerModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pickerModal?.kind === 'multi'
                  ? pickerModal.title
                  : pickerModal?.kind === 'bank'
                    ? t('supervisorSignup.selectBank')
                    : t('supervisorSignup.selectEmirate')}
              </Text>
              <TouchableOpacity onPress={() => setPickerModal(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {pickerModal?.kind === 'bank' ? (
              <>
                <TextInput
                  style={styles.bankSearch}
                  placeholder={t('supervisorSignup.searchBanks')}
                  value={bankSearch}
                  onChangeText={setBankSearch}
                />
                <FlatList
                  data={filteredBanks}
                  keyExtractor={(item) => item}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.modalRow}
                      onPress={() => {
                        setBankName(item);
                        setPickerModal(null);
                        setBankSearch('');
                      }}
                    >
                      <Text style={styles.modalRowText}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </>
            ) : pickerModal?.kind === 'company_emirate' ? (
              <FlatList
                data={emirateOptions}
                keyExtractor={(item) => item.slug ?? item.name}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalRow}
                    onPress={() => {
                      setCompanyEmirate(item.slug ?? item.name);
                      setPickerModal(null);
                    }}
                  >
                    <Text style={styles.modalRowText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            ) : pickerModal?.kind === 'multi' ? (
              <FlatList
                data={pickerModal.options}
                keyExtractor={(item) => String(item.id ?? item.slug ?? item.name)}
                renderItem={({ item }) => {
                  const selectKey = optionSelectKey(item);
                  const [selected, setSelected] = multiState(pickerModal.key);
                  const active = selected.includes(selectKey);
                  return (
                    <TouchableOpacity
                      style={[styles.modalRow, active && styles.modalRowActive]}
                      onPress={() => toggleMulti(selectKey, selected, setSelected)}
                    >
                      <Text style={[styles.modalRowText, active && styles.modalRowTextActive]}>
                        {item.name}
                      </Text>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <Text style={styles.pickerEmpty}>{t('supervisorSignup.noOptionsAvailable')}</Text>
                }
                ListFooterComponent={
                  <Button
                    title={t('supervisorSignup.done')}
                    onPress={() => setPickerModal(null)}
                    style={styles.modalDoneBtn}
                  />
                }
              />
            ) : null}
          </View>
        </View>
      </Modal>

      <MapPickerModal
        visible={mapPickerVisible}
        onClose={() => setMapPickerVisible(false)}
        onSelect={handleCompanyMapSelect}
        confirmMessage={t('supervisorSignup.useMapLocation')}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surfaceLight },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  scroll: { padding: SPACING.lg },
  intro: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  sectionCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: 4,
  },
  uploadHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    lineHeight: 16,
  },
  req: { color: COLORS.error },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.surfaceLight,
  },
  selectText: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.text, marginRight: SPACING.sm },
  placeholder: { color: COLORS.textSecondary },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
    marginBottom: SPACING.sm,
  },
  mapBtnTextWrap: { flex: 1, minWidth: 0 },
  mapBtnTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.medium, color: COLORS.text },
  mapCoords: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  hint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    lineHeight: 18,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.warning + '18',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.warning + '40',
  },
  closedBannerText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.text, lineHeight: 20 },
  multiField: { marginBottom: SPACING.xs },
  uploadWrap: { marginBottom: SPACING.sm },
  uploadActions: { flexDirection: 'row', gap: SPACING.sm },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary + '08',
  },
  uploadBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
  uploadSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceLight,
  },
  uploadName: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.text },
  dateDone: { alignSelf: 'flex-end', paddingVertical: SPACING.sm },
  dateDoneText: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.semiBold },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  termsText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, lineHeight: 20 },
  submitBtn: { marginBottom: SPACING.lg },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '75%',
    paddingTop: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  modalRowActive: { backgroundColor: COLORS.primary + '10' },
  modalRowText: { fontSize: FONT_SIZES.md, color: COLORS.text },
  modalRowTextActive: { fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.primary },
  modalDoneBtn: { margin: SPACING.lg },
  pickerEmpty: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    paddingVertical: SPACING.xl,
  },
  bankSearch: {
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
});

export default SupervisorSignupScreen;
