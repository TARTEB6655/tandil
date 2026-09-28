import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { VENDOR_BANK_OPTIONS } from '../../constants/uaeBanks';
import { VENDOR_DELIVERY_RADIUS_OPTIONS } from '../../constants/vendorDeliveryRadius';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import MapPickerModal from '../../components/MapPickerModal';
import type { AddressFromLocation } from '../../utils/addressFromLocation';
import {
  vendorSignupRequestService,
  PickedUploadFile,
} from '../../services/vendorSignupRequestService';
import {
  adminVendorMetaService,
  DEFAULT_EMIRATE_OPTIONS,
  DEFAULT_VENDOR_TYPE_OPTIONS,
} from '../../services/adminVendorMetaService';
import type { VendorSignupOption } from '../../types/adminVendorMeta';
import {
  catalogImagePickerOptions,
  compressProfileImageForUpload,
  ensureVendorDocumentWithinLimit,
  isImageTooLargeError,
  MAX_VENDOR_DOCUMENT_MB,
} from '../../utils/compressImage';

function formatTimeHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function parseHHMMToDate(value: string, fallbackHour: number, fallbackMinute = 0): Date {
  const d = new Date();
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (match) {
    d.setHours(Number(match[1]), Number(match[2]), 0, 0);
  } else {
    d.setHours(fallbackHour, fallbackMinute, 0, 0);
  }
  return d;
}

/** Fallback file input HTML (only used inside a Modal when DocumentPicker is unavailable). */
const FILE_PICKER_FALLBACK_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    html, body { margin: 0; height: 100%; background: #fff; font-family: -apple-system, sans-serif; }
    .wrap { min-height: 100%; display: flex; align-items: center; justify-content: center; padding: 24px; }
    label {
      position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px;
      width: 100%; max-width: 320px; padding: 28px 20px; border: 1.5px dashed #2d6a4f;
      border-radius: 16px; text-align: center; font-size: 16px; font-weight: 600; color: #2d6a4f;
    }
    label span { font-size: 13px; font-weight: 400; color: #6b7280; }
    input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div class="wrap">
    <label>
      Tap to select PDF or image
      <span>Opens Files on your phone</span>
      <input id="file" type="file" accept="application/pdf,image/*" />
    </label>
  </div>
  <script>
    document.getElementById('file').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ canceled: true }));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = String(reader.result || '');
        var base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : '';
        window.ReactNativeWebView.postMessage(JSON.stringify({
          canceled: false,
          name: file.name || 'document',
          mimeType: file.type || 'application/octet-stream',
          base64: base64
        }));
      };
      reader.onerror = function () {
        window.ReactNativeWebView.postMessage(JSON.stringify({ canceled: true }));
      };
      reader.readAsDataURL(file);
    });
    setTimeout(function () {
      try { document.getElementById('file').click(); } catch (e) {}
    }, 200);
  </script>
</body>
</html>`;

function isImageFile(file: PickedUploadFile | null | undefined): boolean {
  if (!file) return false;
  if (file.mimeType?.toLowerCase().startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name || '');
}

function fileFromAsset(
  asset: {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
  },
  fallbackName: string
): PickedUploadFile {
  let name = asset.fileName ?? asset.uri.split('/').pop() ?? fallbackName;
  name = name.split('?')[0] || fallbackName;
  if (!/\.[a-zA-Z0-9]+$/.test(name)) {
    name = `${name.replace(/\.$/, '')}.jpg`;
  }
  const mimeType =
    asset.mimeType ??
    (name.toLowerCase().endsWith('.png')
      ? 'image/png'
      : name.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : 'image/jpeg');
  return { uri: asset.uri, name, mimeType };
}

async function savePickedBase64File(data: {
  name?: string;
  mimeType?: string;
  base64: string;
}): Promise<PickedUploadFile> {
  let name = (data.name || 'document').replace(/[^\w.\-()+ ]+/g, '_');
  if (!/\.[a-zA-Z0-9]+$/.test(name)) {
    const ext = data.mimeType?.includes('pdf')
      ? '.pdf'
      : data.mimeType?.includes('png')
        ? '.png'
        : '.jpg';
    name = `${name}${ext}`;
  }
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  const uri = `${dir}vendor-upload-${Date.now()}-${name}`;
  await FileSystem.writeAsStringAsync(uri, data.base64, { encoding: 'base64' });
  return {
    uri,
    name,
    mimeType: data.mimeType || 'application/octet-stream',
  };
}

function SectionTitle({ title, icon }: { title: string; icon?: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      {icon ? (
        <View style={styles.sectionIconWrap}>
          <Ionicons name={icon as any} size={18} color={COLORS.primary} />
        </View>
      ) : null}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.sectionCard}>{children}</View>;
}

function FileUploadField({
  label,
  file,
  onPicked,
  onClear,
  required,
  maxMb = MAX_VENDOR_DOCUMENT_MB,
}: {
  label: string;
  file: PickedUploadFile | null;
  onPicked: (file: PickedUploadFile) => void;
  onClear: () => void;
  required?: boolean;
  hint?: string;
  maxMb?: number;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<'file' | 'photo' | null>(null);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const showPreview = isImageFile(file);

  const handleFallbackMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        canceled?: boolean;
        name?: string;
        mimeType?: string;
        base64?: string;
      };
      if (data.canceled || !data.base64) {
        setFallbackOpen(false);
        return;
      }
      const approxBytes = Math.floor((data.base64.length * 3) / 4);
      await ensureVendorDocumentWithinLimit('', approxBytes, maxMb);
      const picked = await savePickedBase64File({
        name: data.name,
        mimeType: data.mimeType,
        base64: data.base64,
      });
      onPicked(picked);
      setFallbackOpen(false);
    } catch (err) {
      if (isImageTooLargeError(err)) {
        Alert.alert(t('common.error'), err.message);
        setFallbackOpen(false);
        return;
      }
      console.warn('Failed to save picked file', err);
      Alert.alert('Error', 'Could not save the selected file. Please try again.');
      setFallbackOpen(false);
    }
  };

  const pickFile = async () => {
    if (busy) return;
    setBusy('file');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
        copyToCacheDirectory: true,
        multiple: false,
        base64: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        try {
          await ensureVendorDocumentWithinLimit(asset.uri, asset.size, maxMb);
        } catch (sizeErr: unknown) {
          if (isImageTooLargeError(sizeErr)) {
            Alert.alert(t('common.error'), sizeErr.message);
            return;
          }
          throw sizeErr;
        }
        const name = (asset.name || asset.uri.split('/').pop() || 'document').split('?')[0];
        const mimeType =
          asset.mimeType ||
          (name.toLowerCase().endsWith('.pdf')
            ? 'application/pdf'
            : name.toLowerCase().endsWith('.png')
              ? 'image/png'
              : 'image/jpeg');
        onPicked({ uri: asset.uri, name, mimeType });
      }
    } catch (err) {
      if (isImageTooLargeError(err)) {
        Alert.alert(t('common.error'), err.message);
        return;
      }
      console.warn('DocumentPicker unavailable, opening fallback', err);
      setFallbackOpen(true);
    } finally {
      setBusy(null);
    }
  };

  const pickPhoto = async () => {
    if (busy) return;
    setBusy('photo');
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(t('common.error'), t('vendorSignup.photoPermission'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync(catalogImagePickerOptions());
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        try {
          await ensureVendorDocumentWithinLimit(asset.uri, asset.fileSize, maxMb);
          onPicked(fileFromAsset(asset, `photo_${Date.now()}.jpg`));
        } catch (sizeErr: unknown) {
          if (isImageTooLargeError(sizeErr)) {
            Alert.alert(t('common.error'), sizeErr.message);
            return;
          }
          throw sizeErr;
        }
      }
    } catch (err) {
      console.warn('Gallery picker failed', err);
      Alert.alert(
        t('common.error'),
        t('vendorSignup.galleryFailed', {
          defaultValue: 'Could not open photo gallery. Please try again.',
        })
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.uploadField}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <Text style={styles.uploadSizeHint}>
        {t('vendorSignup.documentMaxSizeHint', {
          defaultValue: `You can upload a file of up to ${maxMb} MB only.`,
          maxMb,
        })}
      </Text>

      {file ? (
        <View style={styles.uploadSelected}>
          {showPreview ? (
            <Image source={{ uri: file.uri }} style={styles.uploadPreview} />
          ) : (
            <View style={styles.uploadIconWrap}>
              <Ionicons name="document-text-outline" size={22} color={COLORS.primary} />
            </View>
          )}
          <View style={styles.uploadTextWrap}>
            <Text style={styles.uploadBtnText} numberOfLines={1}>
              {file.name}
            </Text>
            <Text style={styles.uploadHint}>
              {showPreview ? 'Photo selected' : 'File selected'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClear} hitSlop={10}>
            <Text style={styles.clearFileText}>Remove</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {showPreview && file ? (
        <View style={styles.uploadLargePreviewWrap}>
          <Image source={{ uri: file.uri }} style={styles.uploadLargePreview} />
        </View>
      ) : null}

      <View style={styles.uploadActions}>
        <TouchableOpacity
          style={[styles.uploadActionBtn, busy === 'file' && styles.uploadBtnBusy]}
          onPress={() => void pickFile()}
          activeOpacity={0.85}
          disabled={!!busy}
        >
          {busy === 'file' ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="document-outline" size={20} color={COLORS.primary} />
          )}
          <Text style={styles.uploadActionTitle}>
            {t('vendorSignup.chooseFile', { defaultValue: 'Choose File' })}
          </Text>
          <Text style={styles.uploadActionHint}>PDF / Docs · max {maxMb} MB</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.uploadActionBtn, busy === 'photo' && styles.uploadBtnBusy]}
          onPress={() => void pickPhoto()}
          activeOpacity={0.85}
          disabled={!!busy}
        >
          {busy === 'photo' ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="images-outline" size={20} color={COLORS.primary} />
          )}
          <Text style={styles.uploadActionTitle}>
            {t('vendorSignup.choosePhoto', { defaultValue: 'Choose photo' })}
          </Text>
          <Text style={styles.uploadActionHint}>Gallery · max {maxMb} MB</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={fallbackOpen}
        animationType="slide"
        onRequestClose={() => setFallbackOpen(false)}
      >
        <SafeAreaView style={styles.filePickerModal}>
          <View style={styles.filePickerHeader}>
            <Text style={styles.filePickerTitle}>Choose File</Text>
            <TouchableOpacity onPress={() => setFallbackOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <WebView
            originWhitelist={['*']}
            source={{ html: FILE_PICKER_FALLBACK_HTML }}
            onMessage={handleFallbackMessage}
            style={styles.filePickerWebView}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            setSupportMultipleWindows={false}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const VendorSignupScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const [companyName, setCompanyName] = useState('');
  const [authorizedPersonName, setAuthorizedPersonName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState('');
  const [tradeLicenseUpload, setTradeLicenseUpload] = useState<PickedUploadFile | null>(null);
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyLogo, setCompanyLogo] = useState<PickedUploadFile | null>(null);
  const [vatNumber, setVatNumber] = useState('');
  const [emiratesIdUpload, setEmiratesIdUpload] = useState<PickedUploadFile | null>(null);
  const [vendorTypeOptions, setVendorTypeOptions] = useState<VendorSignupOption[]>(
    DEFAULT_VENDOR_TYPE_OPTIONS
  );
  const [emirateOptions, setEmirateOptions] = useState<VendorSignupOption[]>(
    DEFAULT_EMIRATE_OPTIONS
  );
  /** Selected option slugs (multi-select). */
  const [vendorTypes, setVendorTypes] = useState<string[]>([DEFAULT_VENDOR_TYPE_OPTIONS[0].slug]);
  const [emirate, setEmirate] = useState(DEFAULT_EMIRATE_OPTIONS[0].slug);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [city, setCity] = useState('');
  const [mapAddress, setMapAddress] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [bankName, setBankName] = useState('');
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [iban, setIban] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState<number | null>(null);
  const [operatingHoursOpen, setOperatingHoursOpen] = useState('');
  const [operatingHoursClose, setOperatingHoursClose] = useState('');
  const [timePickerMode, setTimePickerMode] = useState<'open' | 'close' | null>(null);
  const [minimumOrderAmount, setMinimumOrderAmount] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setOptionsLoading(true);
      try {
        // Public: GET /vendor/auth/registration-options (no token)
        const opts = await adminVendorMetaService.getRegistrationOptions();
        if (cancelled) return;
        if (opts.vendor_types.length) {
          setVendorTypeOptions(opts.vendor_types);
          setVendorTypes((prev) => {
            const valid = prev.filter((slug) =>
              opts.vendor_types.some((o) => o.slug === slug)
            );
            if (valid.length) return valid;
            return opts.vendor_types[0] ? [opts.vendor_types[0].slug] : [];
          });
        }
        if (opts.emirates.length) {
          setEmirateOptions(opts.emirates);
          setEmirate((prev) =>
            opts.emirates.some((o) => o.slug === prev) ? prev : opts.emirates[0].slug
          );
        }
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleVendorType = useCallback((slug: string) => {
    setVendorTypes((prev) =>
      prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]
    );
  }, []);
  const selectedEmirate = useMemo(
    () => emirateOptions.find((o) => o.slug === emirate) ?? emirateOptions[0],
    [emirateOptions, emirate]
  );

  const filteredBanks = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    if (!q) return VENDOR_BANK_OPTIONS;
    return VENDOR_BANK_OPTIONS.filter((name) => name.toLowerCase().includes(q));
  }, [bankSearch]);

  const openBankPicker = useCallback(() => {
    setBankSearch('');
    setBankPickerVisible(true);
  }, []);

  const closeBankPicker = useCallback(() => {
    setBankPickerVisible(false);
    setBankSearch('');
  }, []);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Login');
    }
  }, [navigation]);

  const pickFile = useCallback(async (forLogo = false): Promise<PickedUploadFile | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('vendorSignup.photoPermission'));
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync(catalogImagePickerOptions());
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    try {
      const uri = await compressProfileImageForUpload(asset.uri, asset.fileSize);
      return fileFromAsset({ ...asset, uri }, forLogo ? 'logo.jpg' : 'upload.jpg');
    } catch (sizeErr: unknown) {
      if (isImageTooLargeError(sizeErr)) {
        Alert.alert(
          t('common.error'),
          sizeErr.message ||
            t('common.imageMaxSize', {
              defaultValue:
                'You can upload an image of up to 5 MB only. Please choose a smaller file.',
            })
        );
        return null;
      }
      throw sizeErr;
    }
  }, [t]);

  const handleMapSelect = (a: AddressFromLocation, coords?: { latitude: number; longitude: number }) => {
    const line = [a.street_address, a.city, a.state, a.country].filter(Boolean).join(', ');
    setMapAddress(line || a.street_address);
    if (!address.trim() && line) setAddress(line);
    if (!city.trim() && a.city) setCity(a.city);
    if (coords) {
      setLatitude(coords.latitude);
      setLongitude(coords.longitude);
    }
  };

  const validate = (): boolean => {
    if (
      !companyName.trim() ||
      !authorizedPersonName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !tradeLicenseNumber.trim() ||
      !tradeLicenseUpload ||
      !companyLogo ||
      !address.trim() ||
      !password.trim() ||
      !confirmPassword.trim() ||
      !emiratesIdUpload ||
      !iban.trim() ||
      !accountHolderName.trim() ||
      deliveryRadiusKm == null ||
      !operatingHoursOpen.trim() ||
      !operatingHoursClose.trim() ||
      !minimumOrderAmount.trim()
    ) {
      Alert.alert(t('common.error'), t('vendorSignup.fillAllFields'));
      return false;
    }
    if (!vendorTypes.length) {
      Alert.alert(
        t('common.error'),
        t('vendorSignup.vendorTypeRequired', 'Select at least one vendor type.')
      );
      return false;
    }
    if (latitude == null || longitude == null) {
      Alert.alert(t('common.error'), t('vendorSignup.mapRequired'));
      return false;
    }
    if (!termsAccepted) {
      Alert.alert(t('common.error'), t('vendorSignup.termsRequired'));
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert(t('common.error'), t('vendorSignup.invalidEmail'));
      return false;
    }
    if (password.length < 6) {
      Alert.alert(t('common.error'), t('vendorSignup.passwordMin'));
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('vendorSignup.passwordMismatch'));
      return false;
    }
    const minOrder = parseFloat(minimumOrderAmount);
    if (
      deliveryRadiusKm == null ||
      !VENDOR_DELIVERY_RADIUS_OPTIONS.some((o) => o.value === deliveryRadiusKm)
    ) {
      Alert.alert(t('common.error'), t('vendorSignup.invalidRadius'));
      return false;
    }
    if (Number.isNaN(minOrder) || minOrder < 0) {
      Alert.alert(t('common.error'), t('vendorSignup.invalidMinOrder'));
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setIsLoading(true);
    setError(null);
    try {
      await vendorSignupRequestService.createRequest({
        company_name: companyName.trim(),
        authorized_person_name: authorizedPersonName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        trade_license_number: tradeLicenseNumber.trim(),
        trade_license_upload: tradeLicenseUpload,
        address: address.trim(),
        password,
        password_confirmation: confirmPassword,
        company_logo: companyLogo,
        vat_number: vatNumber.trim() || undefined,
        emirates_id_upload: emiratesIdUpload,
        vendor_types: vendorTypes,
        emirate: selectedEmirate?.name || emirate,
        city: city.trim(),
        latitude,
        longitude,
        map_address: mapAddress.trim() || address.trim(),
        bank_name: bankName.trim(),
        iban: iban.trim(),
        account_holder_name: accountHolderName.trim(),
        delivery_radius_km: deliveryRadiusKm!,
        operating_hours_open: operatingHoursOpen.trim(),
        operating_hours_close: operatingHoursClose.trim(),
        minimum_order_amount: parseFloat(minimumOrderAmount),
        terms_accepted: termsAccepted,
      });
      Alert.alert(t('common.success'), t('vendorSignup.requestSubmitted'), [
        { text: t('common.ok'), onPress: () => navigation.goBack() },
      ]);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : t('vendorSignup.registrationFailed');
      setError(msg);
      Alert.alert(t('common.error'), msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('vendorSignup.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="document-text-outline" size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.subtitle}>{t('vendorSignup.subtitle')}</Text>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <SectionCard>
          <SectionTitle icon="business-outline" title={t('vendorSignup.sectionCompany')} />
          <Input
            label={t('vendorSignup.companyName')}
            value={companyName}
            onChangeText={setCompanyName}
            placeholder={t('vendorSignup.companyNamePlaceholder')}
          />
          <Input
            label={t('vendorSignup.authorizedPersonName')}
            value={authorizedPersonName}
            onChangeText={setAuthorizedPersonName}
            placeholder={t('vendorSignup.authorizedPersonPlaceholder')}
          />
          <Input
            label={t('auth.emailLabel')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder={t('auth.emailPlaceholder')}
          />
          <Input
            label={t('auth.phoneLabel')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder={t('auth.phonePlaceholder')}
          />
          <Input
            label={t('vendorSignup.tradeLicenseNumber')}
            value={tradeLicenseNumber}
            onChangeText={setTradeLicenseNumber}
            placeholder={t('vendorSignup.tradeLicenseNumberPlaceholder')}
          />
          <FileUploadField
            label={t('vendorSignup.tradeLicenseUpload')}
            file={tradeLicenseUpload}
            required
            onPicked={setTradeLicenseUpload}
            onClear={() => setTradeLicenseUpload(null)}
          />
          <Input
            label={t('vendorSignup.address')}
            value={address}
            onChangeText={setAddress}
            placeholder={t('vendorSignup.addressPlaceholder')}
            multiline
            numberOfLines={2}
          />
          <Input
            label={t('auth.passwordLabel')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={t('auth.passwordPlaceholder')}
          />
          <Input
            label={t('vendorSignup.confirmPassword')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder={t('auth.passwordPlaceholder')}
          />
          </SectionCard>

          <SectionCard>
          <SectionTitle icon="images-outline" title={t('vendorSignup.sectionBranding')} />
          <Text style={styles.label}>{t('vendorSignup.companyLogo')}</Text>
          <TouchableOpacity
            style={styles.logoPicker}
            onPress={async () => {
              const f = await pickFile(true);
              if (f) setCompanyLogo(f);
            }}
          >
            {companyLogo ? (
              <Image source={{ uri: companyLogo.uri }} style={styles.logoPreview} />
            ) : (
              <>
                <Ionicons name="image-outline" size={32} color={COLORS.textSecondary} />
                <Text style={styles.logoHint}>{t('vendorSignup.companyLogoHint')}</Text>
              </>
            )}
          </TouchableOpacity>
          {companyLogo ? (
            <TouchableOpacity onPress={() => setCompanyLogo(null)}>
              <Text style={styles.clearFileText}>{t('vendorSignup.removeLogo')}</Text>
            </TouchableOpacity>
          ) : null}
          <Input
            label={t('vendorSignup.vatNumber')}
            value={vatNumber}
            onChangeText={setVatNumber}
            placeholder={t('vendorSignup.vatOptional')}
          />
          <FileUploadField
            label={t('vendorSignup.emiratesIdUpload')}
            file={emiratesIdUpload}
            required
            onPicked={setEmiratesIdUpload}
            onClear={() => setEmiratesIdUpload(null)}
          />
          </SectionCard>

          <SectionCard>
          <SectionTitle icon="leaf-outline" title={t('vendorSignup.sectionBusiness')} />
          <Text style={styles.label}>{t('vendorSignup.vendorType')} *</Text>
          <Text style={[styles.optionalHint, { marginBottom: SPACING.sm }]}>
            {t('vendorSignup.vendorTypeHint', 'You can select more than one vendor type.')}
          </Text>
          {optionsLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.sm }} />
          ) : (
            <View style={styles.chipWrap}>
              {vendorTypeOptions.map((option) => {
                const selected = vendorTypes.includes(option.slug);
                return (
                  <TouchableOpacity
                    key={`vt-${option.id ?? 'x'}-${option.slug}-${option.name}`}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => toggleVendorType(option.slug)}
                  >
                    {selected ? (
                      <Ionicons name="checkmark" size={14} color={COLORS.background} />
                    ) : null}
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {t(`vendorSignup.vendorTypes.${option.name}`, {
                        defaultValue: option.name,
                      })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={styles.label}>{t('vendorSignup.emirate')} *</Text>
          {optionsLoading ? null : (
            <View style={styles.chipWrap}>
              {emirateOptions.map((option) => {
                const selected = emirate === option.slug;
                return (
                  <TouchableOpacity
                    key={`em-${option.id ?? 'x'}-${option.slug}-${option.name}`}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => setEmirate(option.slug)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {option.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <Input
            label={t('vendorSignup.city')}
            value={city}
            onChangeText={setCity}
            placeholder={t('vendorSignup.cityPlaceholder')}
          />

          <Text style={styles.label}>{t('vendorSignup.mapLocation')} *</Text>
          <TouchableOpacity style={styles.mapBtn} onPress={() => setMapVisible(true)}>
            <Ionicons name="map-outline" size={22} color={COLORS.primary} />
            <View style={styles.mapBtnTextWrap}>
              <Text style={styles.mapBtnTitle}>
                {mapAddress || t('vendorSignup.pickOnMap')}
              </Text>
              {latitude != null && longitude != null ? (
                <Text style={styles.mapCoords}>
                  {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
          </SectionCard>

          <SectionCard>
          <SectionTitle icon="card-outline" title={t('vendorSignup.sectionBank')} />
          <Text style={styles.label}>
            {t('vendorSignup.bankName')}{' '}
            <Text style={styles.optionalHint}>
              ({t('vendorSignup.optional', { defaultValue: 'optional' })})
            </Text>
          </Text>
          <TouchableOpacity
            style={styles.bankSelectBtn}
            onPress={openBankPicker}
            activeOpacity={0.85}
          >
            <View style={styles.bankSelectLeft}>
              <View style={styles.bankSelectIcon}>
                <Ionicons name="business-outline" size={18} color={COLORS.primary} />
              </View>
              <Text
                style={[styles.bankSelectText, !bankName && styles.bankSelectPlaceholder]}
                numberOfLines={2}
              >
                {bankName ||
                  t('vendorSignup.bankNameSelectPlaceholder', {
                    defaultValue: 'Select bank (optional)',
                  })}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {bankName ? (
            <TouchableOpacity
              style={styles.clearBankBtn}
              onPress={() => setBankName('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
              <Text style={styles.clearBankText}>
                {t('vendorSignup.clearBank', { defaultValue: 'Clear bank' })}
              </Text>
            </TouchableOpacity>
          ) : null}
          <Input
            label={t('vendorSignup.iban')}
            value={iban}
            onChangeText={setIban}
            autoCapitalize="characters"
            placeholder="AE00 0000 0000 0000 0000 000"
          />
          <Input
            label={t('vendorSignup.accountHolderName')}
            value={accountHolderName}
            onChangeText={setAccountHolderName}
            placeholder={t('vendorSignup.accountHolderPlaceholder')}
          />
          </SectionCard>

          <SectionCard>
          <SectionTitle icon="time-outline" title={t('vendorSignup.sectionOperations')} />
          <Text style={styles.label}>
            {t('vendorSignup.deliveryRadius')} <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.chipWrap}>
            {VENDOR_DELIVERY_RADIUS_OPTIONS.map((option) => {
              const selected = deliveryRadiusKm === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => setDeliveryRadiusKm(option.value)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.hoursRow}>
            <View style={styles.hoursCol}>
              <Text style={styles.label}>
                {t('vendorSignup.operatingHoursOpen')} <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.timeSelectBtn}
                onPress={() => setTimePickerMode('open')}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.timeSelectText,
                    !operatingHoursOpen && styles.timeSelectPlaceholder,
                  ]}
                >
                  {operatingHoursOpen ||
                    t('vendorSignup.selectTime', { defaultValue: 'Select time' })}
                </Text>
                <Ionicons name="time-outline" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.hoursCol}>
              <Text style={styles.label}>
                {t('vendorSignup.operatingHoursClose')} <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.timeSelectBtn}
                onPress={() => setTimePickerMode('close')}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.timeSelectText,
                    !operatingHoursClose && styles.timeSelectPlaceholder,
                  ]}
                >
                  {operatingHoursClose ||
                    t('vendorSignup.selectTime', { defaultValue: 'Select time' })}
                </Text>
                <Ionicons name="time-outline" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>
          {timePickerMode !== null && (
            <View style={styles.timePickerWrap}>
              <DateTimePicker
                value={
                  timePickerMode === 'open'
                    ? parseHHMMToDate(operatingHoursOpen, 8, 0)
                    : parseHHMMToDate(operatingHoursClose, 22, 0)
                }
                mode="time"
                is24Hour
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  if (Platform.OS === 'android') {
                    setTimePickerMode(null);
                    if (event.type === 'dismissed') return;
                  }
                  if (!selectedDate) return;
                  const formatted = formatTimeHHMM(selectedDate);
                  if (timePickerMode === 'open') setOperatingHoursOpen(formatted);
                  else setOperatingHoursClose(formatted);
                }}
              />
              {Platform.OS === 'ios' ? (
                <TouchableOpacity
                  style={styles.timePickerDone}
                  onPress={() => setTimePickerMode(null)}
                >
                  <Text style={styles.timePickerDoneText}>{t('common.done', { defaultValue: 'Done' })}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
          <Input
            label={t('vendorSignup.minimumOrderAmount')}
            value={minimumOrderAmount}
            onChangeText={setMinimumOrderAmount}
            keyboardType="numeric"
            placeholder="0.00"
          />

          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setTermsAccepted(!termsAccepted)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={termsAccepted ? 'checkbox' : 'square-outline'}
              size={24}
              color={termsAccepted ? COLORS.primary : COLORS.textSecondary}
            />
            <Text style={styles.termsText}>{t('vendorSignup.termsAccept')}</Text>
          </TouchableOpacity>

          <Button title={t('vendorSignup.submit')} onPress={handleSignup} loading={isLoading} />
          </SectionCard>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={bankPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeBankPicker}
      >
        <SafeAreaView style={styles.bankModalSafe} edges={['top', 'bottom']}>
          <View style={styles.bankModalHeader}>
            <TouchableOpacity onPress={closeBankPicker} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.bankModalTitle}>
              {t('vendorSignup.selectBank', { defaultValue: 'Select bank' })}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setBankName('');
                closeBankPicker();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.bankModalClear}>
                {t('vendorSignup.clear', { defaultValue: 'Clear' })}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.bankSearchWrap}>
            <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
            <TextInput
              style={styles.bankSearchInput}
              value={bankSearch}
              onChangeText={setBankSearch}
              placeholder={t('vendorSignup.searchBank', { defaultValue: 'Search banks…' })}
              placeholderTextColor={COLORS.textSecondary}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
          </View>
          <FlatList
            data={filteredBanks}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.bankListContent}
            ListEmptyComponent={
              <Text style={styles.bankEmpty}>
                {t('vendorSignup.noBanksFound', { defaultValue: 'No banks match your search.' })}
              </Text>
            }
            renderItem={({ item }) => {
              const selected = bankName === item;
              return (
                <TouchableOpacity
                  style={[styles.bankOption, selected && styles.bankOptionSelected]}
                  onPress={() => {
                    setBankName(item);
                    closeBankPicker();
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[styles.bankOptionText, selected && styles.bankOptionTextSelected]}
                    numberOfLines={2}
                  >
                    {item}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      <MapPickerModal
        visible={mapVisible}
        onClose={() => setMapVisible(false)}
        onSelect={handleMapSelect}
        confirmMessage={t('vendorSignup.useMapLocation')}
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
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl * 2, gap: SPACING.md },
  hero: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary + '25',
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.sm,
  },
  sectionCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.error + '12',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  errorText: { flex: 1, color: COLORS.error, fontSize: FONT_SIZES.sm, lineHeight: 18 },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  required: { color: COLORS.error },
  chipRow: { marginBottom: SPACING.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: FONT_SIZES.sm, color: COLORS.text },
  chipTextActive: { color: COLORS.background, fontWeight: FONT_WEIGHTS.semiBold },
  uploadField: { marginBottom: SPACING.xs },
  uploadSizeHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
    marginBottom: SPACING.sm,
  },
  uploadSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceLight,
    marginBottom: SPACING.sm,
  },
  uploadActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  uploadActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '40',
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.surfaceLight,
  },
  uploadBtnBusy: { opacity: 0.7 },
  uploadActionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    textAlign: 'center',
  },
  uploadActionHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '40',
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceLight,
  },
  uploadIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadPreview: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  uploadLargePreviewWrap: {
    marginTop: SPACING.sm,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  uploadLargePreview: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  uploadTextWrap: { flex: 1 },
  uploadBtnText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.medium, color: COLORS.text },
  uploadHint: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  clearFile: { marginTop: SPACING.xs },
  clearFileText: { fontSize: FONT_SIZES.sm, color: COLORS.error, fontWeight: FONT_WEIGHTS.medium },
  filePickerModal: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  filePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  filePickerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  filePickerWebView: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  logoPicker: {
    height: 120,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '35',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    marginBottom: SPACING.xs,
  },
  logoPreview: { width: '100%', height: '100%', borderRadius: BORDER_RADIUS.lg },
  logoHint: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surfaceLight,
    marginBottom: SPACING.xs,
  },
  mapBtnTextWrap: { flex: 1 },
  mapBtnTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.medium, color: COLORS.text },
  mapCoords: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  hoursRow: { flexDirection: 'row', gap: SPACING.md },
  hoursCol: { flex: 1 },
  timeSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surfaceLight,
    marginBottom: SPACING.xs,
  },
  timeSelectText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  timeSelectPlaceholder: {
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.regular,
  },
  timePickerWrap: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  timePickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  timePickerDoneText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.md,
  },
  termsText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.text, lineHeight: 20 },
  optionalHint: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.regular,
    color: COLORS.textSecondary,
  },
  bankSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surfaceLight,
    marginBottom: SPACING.xs,
  },
  bankSelectLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bankSelectIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankSelectText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  bankSelectPlaceholder: {
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.regular,
  },
  clearBankBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
  },
  clearBankText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  bankModalSafe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  bankModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  bankModalTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  bankModalClear: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  bankSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.sm : 0,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surfaceLight,
  },
  bankSearchInput: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    paddingVertical: SPACING.sm,
  },
  bankListContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  bankEmpty: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.xl,
  },
  bankOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  bankOptionSelected: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: BORDER_RADIUS.md,
    borderBottomWidth: 0,
  },
  bankOptionText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  bankOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default VendorSignupScreen;
