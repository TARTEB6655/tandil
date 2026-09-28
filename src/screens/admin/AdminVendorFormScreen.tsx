/**
 * Admin Add / Edit Vendor form.
 * Create: POST /admin/vendors (multipart).
 * Edit: GET application-detail, then POST /admin/vendors/:id (multipart) including status.
 * Params: { mode?: 'add' | 'edit'; vendorId?: string; vendor?: Partial prefill }
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import MapPickerModal from '../../components/MapPickerModal';
import type { AddressFromLocation } from '../../utils/addressFromLocation';
import { VENDOR_BANK_OPTIONS } from '../../constants/uaeBanks';
import { VENDOR_DELIVERY_RADIUS_OPTIONS } from '../../constants/vendorDeliveryRadius';
import {
  adminVendorMetaService,
  DEFAULT_EMIRATE_OPTIONS,
  DEFAULT_VENDOR_TYPE_OPTIONS,
} from '../../services/adminVendorMetaService';
import type { VendorSignupOption } from '../../types/adminVendorMeta';
import {
  adminVendorManagementService,
  type AdminManagedVendor,
  type AdminVendorFormStatus,
} from '../../services/adminVendorManagementService';
import { adminVendorService } from '../../services/adminVendorService';
import type { VendorSignupRequest } from '../../types/vendorSignup';
import {
  catalogImagePickerOptions,
  ensureVendorDocumentWithinLimit,
  isImageTooLargeError,
  MAX_CATALOG_IMAGE_MB,
  MAX_VENDOR_DOCUMENT_MB,
} from '../../utils/compressImage';

type PickedFile = { uri: string; name: string; mimeType: string };

const VENDOR_STATUS_OPTIONS: {
  value: AdminVendorFormStatus;
  labelKey: string;
  defaultLabel: string;
}[] = [
  { value: 'approved', labelKey: 'adminVendorManagement.form.statusApproved', defaultLabel: 'Approved' },
  {
    value: 'under_review',
    labelKey: 'adminVendorManagement.form.statusUnderReview',
    defaultLabel: 'Under review',
  },
  { value: 'pending', labelKey: 'adminVendorManagement.form.statusPending', defaultLabel: 'Pending' },
];

function normalizeVendorFormStatus(status?: string): AdminVendorFormStatus {
  const raw = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (raw === 'approved' || raw === 'active') return 'approved';
  if (raw === 'under_review' || raw === 'underreview') return 'under_review';
  if (raw === 'pending') return 'pending';
  if (raw.includes('approved')) return 'approved';
  if (raw.includes('under_review') || raw.includes('review')) return 'under_review';
  if (raw.includes('pending')) return 'pending';
  return 'pending';
}

function normalizeTimeHHMM(value?: string): string {
  if (!value?.trim()) return '';
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return value.trim();
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
}

function parseGoogleMapsLocation(location?: string): {
  latitude?: number;
  longitude?: number;
  address?: string;
} {
  if (!location?.trim()) return {};
  const trimmed = location.trim();
  const pair = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(trimmed);
  if (pair) {
    return { latitude: Number(pair[1]), longitude: Number(pair[2]), address: trimmed };
  }
  const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(trimmed);
  if (at) {
    return { latitude: Number(at[1]), longitude: Number(at[2]), address: trimmed };
  }
  const query = /[?&](?:q|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(trimmed);
  if (query) {
    return { latitude: Number(query[1]), longitude: Number(query[2]), address: trimmed };
  }
  return { address: trimmed };
}

function matchOptionSlug(value: string, options: VendorSignupOption[]): string {
  const matched = matchOptionSlugs([value], options);
  return matched[0] || options[0]?.slug || value.trim();
}

function matchOptionSlugs(values: string[], options: VendorSignupOption[]): string[] {
  if (!options.length) {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  }
  const matched = values
    .map((value) => {
      const raw = value.trim();
      if (!raw) return '';
      const lower = raw.toLowerCase();
      const bySlug = options.find((o) => o.slug.toLowerCase() === lower);
      if (bySlug) return bySlug.slug;
      const byName = options.find((o) => o.name.toLowerCase() === lower);
      if (byName) return byName.slug;
      return '';
    })
    .filter(Boolean);
  return Array.from(new Set(matched));
}

function vendorTypeValuesFromDetail(detail: VendorSignupRequest): string[] {
  if (detail.vendor_types?.length) return detail.vendor_types;
  const fromType = (detail.vendor_type || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const fromLabel = (detail.vendor_type_label || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return Array.from(new Set([...fromType, ...fromLabel]));
}

function matchDeliveryRadiusKm(km?: number): number | null {
  if (km == null || !Number.isFinite(km)) return null;
  const exact = VENDOR_DELIVERY_RADIUS_OPTIONS.find((o) => o.value === km);
  if (exact) return exact.value;
  const next = VENDOR_DELIVERY_RADIUS_OPTIONS.find((o) => o.value >= km);
  return (
    next?.value ??
    VENDOR_DELIVERY_RADIUS_OPTIONS[VENDOR_DELIVERY_RADIUS_OPTIONS.length - 1]?.value ??
    null
  );
}

function isLikelyImageUrl(url?: string): boolean {
  if (!url) return false;
  if (/\.pdf(\?|$)/i.test(url)) return false;
  return true;
}

type RouteParams = {
  mode?: 'add' | 'edit';
  vendorId?: string;
  vendor?: AdminManagedVendor;
};

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

function formatTimeHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function parseHHMMToDate(value: string, fallbackHour: number, fallbackMinute = 0): Date {
  const d = new Date();
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (match) d.setHours(Number(match[1]), Number(match[2]), 0, 0);
  else d.setHours(fallbackHour, fallbackMinute, 0, 0);
  return d;
}

function isImageFile(file: PickedFile | null | undefined): boolean {
  if (!file) return false;
  if (file.mimeType?.toLowerCase().startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name || '');
}

function fileFromAsset(
  asset: { uri: string; fileName?: string | null; mimeType?: string | null },
  fallbackName: string
): PickedFile {
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
}): Promise<PickedFile> {
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
  const uri = `${dir}admin-vendor-upload-${Date.now()}-${name}`;
  await FileSystem.writeAsStringAsync(uri, data.base64, { encoding: 'base64' });
  return {
    uri,
    name,
    mimeType: data.mimeType || 'application/octet-stream',
  };
}

/** Same pattern as Vendor Registration: Choose File (PDF/docs) + Choose photo (gallery). */
function FileUploadField({
  label,
  file,
  onPicked,
  onClear,
  required,
  existingUrl,
  maxMb = MAX_VENDOR_DOCUMENT_MB,
}: {
  label: string;
  file: PickedFile | null;
  onPicked: (file: PickedFile) => void;
  onClear: () => void;
  required?: boolean;
  existingUrl?: string;
  maxMb?: number;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<'file' | 'photo' | null>(null);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const showPreview = isImageFile(file);
  const showExistingImage = !file && !!existingUrl && isLikelyImageUrl(existingUrl);

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
    } catch {
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
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      <Text style={styles.uploadSizeHint}>
        {t('vendorSignup.documentMaxSizeHint', {
          defaultValue: `You can upload a file of up to ${maxMb} MB only.`,
          maxMb,
        })}
      </Text>

      {file || existingUrl ? (
        <View style={styles.uploadSelected}>
          {showPreview || showExistingImage ? (
            <Image source={{ uri: file?.uri || existingUrl! }} style={styles.uploadPreview} />
          ) : (
            <View style={styles.uploadIconWrap}>
              <Ionicons name="document-text-outline" size={22} color={COLORS.primary} />
            </View>
          )}
          <View style={styles.uploadTextWrap}>
            <Text style={styles.uploadBtnText} numberOfLines={1}>
              {file?.name ||
                t('adminVendorManagement.form.existingFile', { defaultValue: 'Current file' })}
            </Text>
            <Text style={styles.uploadHint}>
              {showPreview || showExistingImage
                ? t('vendorSignup.photoSelected', { defaultValue: 'Photo selected' })
                : t('vendorSignup.fileSelected', { defaultValue: 'File selected' })}
            </Text>
          </View>
          <TouchableOpacity onPress={onClear} hitSlop={10}>
            <Text style={styles.clearText}>{t('common.remove', { defaultValue: 'Remove' })}</Text>
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

      <Modal visible={fallbackOpen} animationType="slide" onRequestClose={() => setFallbackOpen(false)}>
        <SafeAreaView style={styles.filePickerModal}>
          <View style={styles.filePickerHeader}>
            <Text style={styles.filePickerTitle}>
              {t('vendorSignup.chooseFile', { defaultValue: 'Choose File' })}
            </Text>
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

const Section: React.FC<{ icon: keyof typeof Ionicons.glyphMap; title: string; children: React.ReactNode }> = ({
  icon,
  title,
  children,
}) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const AdminVendorFormScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params || {}) as RouteParams;
  const isEdit = params.mode === 'edit' || !!params.vendorId;
  const existing = params.vendor;
  const vendorId = params.vendorId || existing?.vendor_id || existing?.id;

  const [companyName, setCompanyName] = useState(existing?.business_name || '');
  const [authorizedPersonName, setAuthorizedPersonName] = useState(existing?.contact_name || '');
  const [email, setEmail] = useState(existing?.email || '');
  const [phone, setPhone] = useState(existing?.phone || '');
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState('');
  const [tradeLicenseUpload, setTradeLicenseUpload] = useState<PickedFile | null>(null);
  const [existingTradeLicenseUrl, setExistingTradeLicenseUrl] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyLogo, setCompanyLogo] = useState<PickedFile | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState(existing?.logo_url || '');
  const [vatNumber, setVatNumber] = useState('');
  const [emiratesIdUpload, setEmiratesIdUpload] = useState<PickedFile | null>(null);
  const [existingEmiratesIdUrl, setExistingEmiratesIdUrl] = useState('');

  const [vendorTypeOptions, setVendorTypeOptions] = useState<VendorSignupOption[]>(
    DEFAULT_VENDOR_TYPE_OPTIONS
  );
  const [emirateOptions, setEmirateOptions] = useState<VendorSignupOption[]>(
    DEFAULT_EMIRATE_OPTIONS
  );
  const [vendorTypes, setVendorTypes] = useState<string[]>([DEFAULT_VENDOR_TYPE_OPTIONS[0].slug]);
  const [emirate, setEmirate] = useState(DEFAULT_EMIRATE_OPTIONS[0].slug);
  const [city, setCity] = useState('');
  const [mapAddress, setMapAddress] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [mapVisible, setMapVisible] = useState(false);

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
  const [vendorStatus, setVendorStatus] = useState<AdminVendorFormStatus>(
    normalizeVendorFormStatus(existing?.status)
  );
  const [detailStatusLabel, setDetailStatusLabel] = useState(existing?.status_label || '');
  const [loadingDetail, setLoadingDetail] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const applyApplicationDetail = (
    detail: VendorSignupRequest,
    types: VendorSignupOption[],
    emirates: VendorSignupOption[]
  ) => {
    setCompanyName(
      detail.company_name?.trim() || existing?.business_name?.trim() || ''
    );
    setAuthorizedPersonName(
      detail.authorized_person_name?.trim() || existing?.contact_name?.trim() || ''
    );
    setEmail(detail.email?.trim() || existing?.email?.trim() || '');
    setPhone(detail.phone?.trim() || existing?.phone?.trim() || '');
    setTradeLicenseNumber(detail.trade_license_number?.trim() || '');
    setAddress(detail.address?.trim() || '');
    setVatNumber(detail.vat_number?.trim() || '');
    setCity(detail.city?.trim() || '');
    setBankName(detail.bank_name?.trim() || '');
    setIban(detail.iban?.trim() || '');
    setAccountHolderName(detail.account_holder_name?.trim() || '');
    setDeliveryRadiusKm(matchDeliveryRadiusKm(detail.delivery_radius_km));
    setOperatingHoursOpen(normalizeTimeHHMM(detail.opens_at));
    setOperatingHoursClose(normalizeTimeHHMM(detail.closes_at));
    setMinimumOrderAmount(
      detail.minimum_order_amount != null && Number.isFinite(detail.minimum_order_amount)
        ? String(detail.minimum_order_amount)
        : ''
    );
    setExistingLogoUrl(
      detail.logo_url?.trim() || existing?.logo_url?.trim() || ''
    );
    setExistingTradeLicenseUrl(detail.trade_license_url?.trim() || '');
    setExistingEmiratesIdUrl(detail.emirates_id_url?.trim() || '');
    setVendorStatus(
      normalizeVendorFormStatus(detail.account_status || detail.status_label || detail.status)
    );
    const statusForLabel =
      detail.account_status || detail.status_label || detail.status || '';
    setDetailStatusLabel(
      statusForLabel
        ? statusForLabel.charAt(0).toUpperCase() + statusForLabel.slice(1).replace(/_/g, ' ')
        : ''
    );
    // Password is never returned by API — leave blank on edit (means "keep current").
    setPassword('');
    setConfirmPassword('');

    const maps = parseGoogleMapsLocation(detail.google_maps_location);
    setLatitude(maps.latitude);
    setLongitude(maps.longitude);
    setMapAddress(maps.address || detail.google_maps_location || detail.address || '');

    const selectedTypes = matchOptionSlugs(vendorTypeValuesFromDetail(detail), types);
    setVendorTypes(selectedTypes.length ? selectedTypes : types[0] ? [types[0].slug] : []);
    setEmirate(matchOptionSlug(detail.emirate || '', emirates));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const opts = await adminVendorMetaService.getRegistrationOptions();
      if (cancelled) return;

      let types = DEFAULT_VENDOR_TYPE_OPTIONS;
      let emirates = DEFAULT_EMIRATE_OPTIONS;
      if (opts.vendor_types.length) {
        types = opts.vendor_types;
        setVendorTypeOptions(types);
        setVendorTypes((prev) => {
          const valid = prev.filter((slug) => types.some((o) => o.slug === slug));
          if (valid.length) return valid;
          return types[0] ? [types[0].slug] : [];
        });
      }
      if (opts.emirates.length) {
        emirates = opts.emirates;
        setEmirateOptions(emirates);
        setEmirate((prev) =>
          emirates.some((o) => o.slug === prev) ? prev : emirates[0].slug
        );
      }

      if (!isEdit || !vendorId) {
        setLoadingDetail(false);
        return;
      }

      setLoadingDetail(true);
      try {
        const detail = await adminVendorService.getApplicationDetail(vendorId);
        if (cancelled) return;
        applyApplicationDetail(detail, types, emirates);
      } catch (error: unknown) {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : t('adminVendorManagement.form.detailFailed', {
                defaultValue: 'Could not load vendor details.',
              });
        Alert.alert(t('common.error'), message, [
          { text: t('common.ok'), onPress: () => navigation.goBack() },
        ]);
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, vendorId, navigation, t]);

  const filteredBanks = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    if (!q) return VENDOR_BANK_OPTIONS;
    return VENDOR_BANK_OPTIONS.filter((name) => name.toLowerCase().includes(q));
  }, [bankSearch]);

  const toggleVendorType = useCallback((slug: string) => {
    setVendorTypes((prev) =>
      prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]
    );
  }, []);

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
    const missing: string[] = [];
    if (!companyName.trim()) missing.push(t('vendorSignup.companyName'));
    if (!authorizedPersonName.trim()) missing.push(t('vendorSignup.authorizedPersonName'));
    if (!email.trim()) missing.push(t('auth.emailLabel'));
    if (!phone.trim()) missing.push(t('auth.phoneLabel'));
    if (!tradeLicenseNumber.trim()) missing.push(t('vendorSignup.tradeLicenseNumber'));
    if (!address.trim()) missing.push(t('vendorSignup.address'));
    if (!iban.trim()) missing.push(t('vendorSignup.iban'));
    if (!accountHolderName.trim()) missing.push(t('vendorSignup.accountHolderName'));
    if (deliveryRadiusKm == null) missing.push(t('vendorSignup.deliveryRadius'));
    if (!operatingHoursOpen.trim()) missing.push(t('vendorSignup.operatingHoursOpen'));
    if (!operatingHoursClose.trim()) missing.push(t('vendorSignup.operatingHoursClose'));
    if (!minimumOrderAmount.trim()) missing.push(t('vendorSignup.minimumOrderAmount'));

    if (missing.length) {
      Alert.alert(
        t('common.error'),
        t('adminVendorManagement.form.fillRequiredNamed', {
          defaultValue: 'Please complete: {{fields}}',
          fields: missing.join(', '),
        })
      );
      return false;
    }
    if (!isEdit && (!password || password.length < 6)) {
      Alert.alert(t('common.error'), t('vendorSignup.passwordMin'));
      return false;
    }
    if (!isEdit && password !== confirmPassword) {
      Alert.alert(t('common.error'), t('vendorSignup.passwordMismatch'));
      return false;
    }
    if (isEdit && password && password.length < 6) {
      Alert.alert(t('common.error'), t('vendorSignup.passwordMin'));
      return false;
    }
    if (isEdit && password && password !== confirmPassword) {
      Alert.alert(t('common.error'), t('vendorSignup.passwordMismatch'));
      return false;
    }
    if (!isEdit && (!tradeLicenseUpload || !emiratesIdUpload)) {
      Alert.alert(
        t('common.error'),
        t('adminVendorManagement.form.uploadsRequired', {
          defaultValue: 'Please upload trade license and Emirates ID.',
        })
      );
      return false;
    }
    if (latitude == null || longitude == null) {
      if (!isEdit || !mapAddress.trim()) {
        Alert.alert(t('common.error'), t('vendorSignup.mapRequired'));
        return false;
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert(t('common.error'), t('vendorSignup.invalidEmail'));
      return false;
    }
    if (!vendorTypes.length) {
      Alert.alert(
        t('common.error'),
        t('vendorSignup.vendorTypeRequired', 'Select at least one vendor type.')
      );
      return false;
    }
    const minOrder = parseFloat(minimumOrderAmount);
    if (Number.isNaN(minOrder) || minOrder < 0) {
      Alert.alert(t('common.error'), t('vendorSignup.invalidMinOrder'));
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (deliveryRadiusKm == null) return;
    setSaving(true);
    try {
      const shared = {
        company_name: companyName.trim(),
        authorized_person_name: authorizedPersonName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        trade_license_number: tradeLicenseNumber.trim(),
        address: address.trim(),
        logo: companyLogo,
        vat_number: vatNumber.trim() || undefined,
        vendor_types: vendorTypes,
        emirate: emirateOptions.find((o) => o.slug === emirate)?.name || emirate,
        city: city.trim() || undefined,
        latitude,
        longitude,
        map_address: mapAddress.trim() || address.trim(),
        bank_name: bankName.trim() || undefined,
        iban: iban.trim(),
        account_holder_name: accountHolderName.trim(),
        delivery_radius_km: deliveryRadiusKm,
        opens_at: operatingHoursOpen.trim(),
        closes_at: operatingHoursClose.trim(),
        minimum_order_amount: parseFloat(minimumOrderAmount),
        terms_accepted: true,
        status: vendorStatus,
      };

      if (isEdit) {
        if (!vendorId) {
          Alert.alert(
            t('common.error'),
            t('adminVendorManagement.missingVendor', { defaultValue: 'Vendor not found.' })
          );
          return;
        }
        const result = await adminVendorManagementService.updateVendor(vendorId, {
          ...shared,
          trade_license: tradeLicenseUpload,
          emirates_id: emiratesIdUpload,
          password: password || undefined,
          password_confirmation: password ? confirmPassword : undefined,
        });
        Alert.alert(
          t('common.success', { defaultValue: 'Success' }),
          result.message ||
            t('adminVendorManagement.form.updateSuccess', {
              defaultValue: 'Vendor updated successfully.',
            }),
          [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
        );
        return;
      }

      if (!tradeLicenseUpload || !emiratesIdUpload) return;

      const result = await adminVendorManagementService.createVendor({
        ...shared,
        trade_license: tradeLicenseUpload,
        emirates_id: emiratesIdUpload,
        password,
        password_confirmation: confirmPassword,
      });

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        result.message ||
          t('adminVendorManagement.form.createSuccess', {
            defaultValue: 'Vendor created successfully.',
          }),
        [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : isEdit
            ? t('adminVendorManagement.form.updateFailed', {
                defaultValue: 'Failed to update vendor.',
              })
            : t('adminVendorManagement.form.createFailed', {
                defaultValue: 'Failed to create vendor.',
              });
      Alert.alert(t('common.error'), message);
    } finally {
      setSaving(false);
    }
  };

  const title = isEdit
    ? t('adminVendorManagement.form.editTitle', { defaultValue: 'Edit vendor' })
    : t('adminVendorManagement.form.addTitle', { defaultValue: 'Add vendor' });

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={styles.hero}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>
          {isEdit
            ? detailStatusLabel
              ? t('adminVendorManagement.form.editSubtitleWithStatus', {
                  defaultValue: 'Vendor application · {{status}}',
                  status: detailStatusLabel,
                })
              : t('adminVendorManagement.form.editSubtitle', {
                  defaultValue: 'Update vendor profile and business details',
                })
            : t('adminVendorManagement.form.addSubtitle', {
                defaultValue: 'Create a vendor with the same details as registration',
              })}
        </Text>
      </View>

      {loadingDetail ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('adminVendorManagement.form.loadingDetail', {
              defaultValue: 'Loading vendor details...',
            })}
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Section icon="business-outline" title={t('vendorSignup.sectionCompany')}>
            <Input
              label={`${t('vendorSignup.companyName')} *`}
              value={companyName}
              onChangeText={setCompanyName}
              placeholder={t('vendorSignup.companyNamePlaceholder', {
                defaultValue: 'Enter company name',
              })}
              autoCapitalize="words"
              textContentType="organizationName"
              autoComplete="organization"
            />
            <Input
              label={`${t('vendorSignup.authorizedPersonName')} *`}
              value={authorizedPersonName}
              onChangeText={setAuthorizedPersonName}
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
            />
            <Input
              label={`${t('auth.emailLabel')} *`}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              textContentType="emailAddress"
              autoComplete="email"
            />
            <Input
              label={`${t('auth.phoneLabel')} *`}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
            />
            <Input
              label={`${t('vendorSignup.tradeLicenseNumber')} *`}
              value={tradeLicenseNumber}
              onChangeText={setTradeLicenseNumber}
            />
            <FileUploadField
              label={t('vendorSignup.tradeLicenseUpload')}
              required={!isEdit}
              file={tradeLicenseUpload}
              existingUrl={!tradeLicenseUpload ? existingTradeLicenseUrl : undefined}
              onPicked={setTradeLicenseUpload}
              onClear={() => {
                setTradeLicenseUpload(null);
                setExistingTradeLicenseUrl('');
              }}
            />
            <Input
              label={`${t('vendorSignup.address')} *`}
              value={address}
              onChangeText={setAddress}
              multiline
            />
            <Input
              label={
                isEdit
                  ? t('adminVendorManagement.form.passwordOptional', {
                      defaultValue: 'Password (leave blank to keep)',
                    })
                  : `${t('auth.passwordLabel')} *`
              }
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="none"
              autoComplete="off"
              placeholder={
                isEdit
                  ? t('adminVendorManagement.form.passwordKeepHint', {
                      defaultValue: 'Leave blank to keep current password',
                    })
                  : undefined
              }
            />
            <Input
              label={
                isEdit
                  ? t('adminVendorManagement.form.confirmPasswordOptional', {
                      defaultValue: 'Confirm password',
                    })
                  : `${t('vendorSignup.confirmPassword')} *`
              }
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              textContentType="none"
              autoComplete="off"
            />
          </Section>

          <Section icon="image-outline" title={t('vendorSignup.sectionBranding')}>
            <FileUploadField
              label={t('vendorSignup.companyLogo')}
              required={false}
              maxMb={MAX_CATALOG_IMAGE_MB}
              file={companyLogo}
              existingUrl={!companyLogo ? existingLogoUrl : undefined}
              onPicked={setCompanyLogo}
              onClear={() => {
                setCompanyLogo(null);
                setExistingLogoUrl('');
              }}
            />
            <Input
              label={t('vendorSignup.vatNumber')}
              value={vatNumber}
              onChangeText={setVatNumber}
              placeholder={t('vendorSignup.vatOptional')}
            />
            <FileUploadField
              label={t('vendorSignup.emiratesIdUpload')}
              required={!isEdit}
              file={emiratesIdUpload}
              existingUrl={!emiratesIdUpload ? existingEmiratesIdUrl : undefined}
              onPicked={setEmiratesIdUpload}
              onClear={() => {
                setEmiratesIdUpload(null);
                setExistingEmiratesIdUrl('');
              }}
            />
          </Section>

          <Section
            icon="checkmark-circle-outline"
            title={t('adminVendorManagement.form.statusSection', {
              defaultValue: 'Account status',
            })}
          >
            <Text style={styles.fieldLabel}>
              {t('adminVendorManagement.form.status', { defaultValue: 'Status' })}{' '}
              <Text style={styles.req}>*</Text>
            </Text>
            <View style={styles.chipWrap}>
              {VENDOR_STATUS_OPTIONS.map((option) => {
                const selected = vendorStatus === option.value;
                return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => {
                        setVendorStatus(option.value);
                        setDetailStatusLabel(option.defaultLabel);
                      }}
                    >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {t(option.labelKey, { defaultValue: option.defaultLabel })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          <Section icon="leaf-outline" title={t('vendorSignup.sectionBusiness')}>
            <Text style={styles.fieldLabel}>
              {t('vendorSignup.vendorType')} <Text style={styles.req}>*</Text>
            </Text>
            <Text style={[styles.optional, { marginBottom: SPACING.sm }]}>
              {t('vendorSignup.vendorTypeHint', 'You can select more than one vendor type.')}
            </Text>
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
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    ) : null}
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {option.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>
              {t('vendorSignup.emirate')} <Text style={styles.req}>*</Text>
            </Text>
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

            <Input
              label={t('vendorSignup.city')}
              value={city}
              onChangeText={setCity}
              placeholder={t('vendorSignup.cityPlaceholder')}
            />

            <Text style={styles.fieldLabel}>
              {t('vendorSignup.mapLocation')} <Text style={styles.req}>*</Text>
            </Text>
            <TouchableOpacity style={styles.mapBtn} onPress={() => setMapVisible(true)}>
              <Ionicons name="map-outline" size={20} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.mapBtnTitle}>
                  {mapAddress || t('vendorSignup.pickOnMap')}
                </Text>
                {latitude != null && longitude != null ? (
                  <Text style={styles.mapCoords}>
                    {latitude.toFixed(5)}, {longitude.toFixed(5)}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </Section>

          <Section icon="card-outline" title={t('vendorSignup.sectionBank')}>
            <Text style={styles.fieldLabel}>
              {t('vendorSignup.bankName')}{' '}
              <Text style={styles.optional}>
                ({t('vendorSignup.optional', { defaultValue: 'optional' })})
              </Text>
            </Text>
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={() => {
                setBankSearch('');
                setBankPickerVisible(true);
              }}
            >
              <Text style={[styles.selectText, !bankName && styles.selectPlaceholder]} numberOfLines={2}>
                {bankName ||
                  t('vendorSignup.bankNameSelectPlaceholder', {
                    defaultValue: 'Select bank (optional)',
                  })}
              </Text>
              <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {bankName ? (
              <TouchableOpacity onPress={() => setBankName('')} style={styles.clearBank}>
                <Text style={styles.clearText}>
                  {t('vendorSignup.clearBank', { defaultValue: 'Clear bank' })}
                </Text>
              </TouchableOpacity>
            ) : null}
            <Input
              label={`${t('vendorSignup.iban')} *`}
              value={iban}
              onChangeText={setIban}
              autoCapitalize="characters"
              placeholder="AE00 0000 0000 0000 0000 000"
            />
            <Input
              label={`${t('vendorSignup.accountHolderName')} *`}
              value={accountHolderName}
              onChangeText={setAccountHolderName}
              placeholder={t('vendorSignup.accountHolderPlaceholder')}
            />
          </Section>

          <Section icon="time-outline" title={t('vendorSignup.sectionOperations')}>
            <Text style={styles.fieldLabel}>
              {t('vendorSignup.deliveryRadius')} <Text style={styles.req}>*</Text>
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
                <Text style={styles.fieldLabel}>
                  {t('vendorSignup.operatingHoursOpen')} <Text style={styles.req}>*</Text>
                </Text>
                <TouchableOpacity style={styles.selectBtn} onPress={() => setTimePickerMode('open')}>
                  <Text style={[styles.selectText, !operatingHoursOpen && styles.selectPlaceholder]}>
                    {operatingHoursOpen || t('vendorSignup.selectTime', { defaultValue: 'Select time' })}
                  </Text>
                  <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.hoursCol}>
                <Text style={styles.fieldLabel}>
                  {t('vendorSignup.operatingHoursClose')} <Text style={styles.req}>*</Text>
                </Text>
                <TouchableOpacity style={styles.selectBtn} onPress={() => setTimePickerMode('close')}>
                  <Text style={[styles.selectText, !operatingHoursClose && styles.selectPlaceholder]}>
                    {operatingHoursClose || t('vendorSignup.selectTime', { defaultValue: 'Select time' })}
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
                  <TouchableOpacity style={styles.timeDone} onPress={() => setTimePickerMode(null)}>
                    <Text style={styles.timeDoneText}>{t('common.done', { defaultValue: 'Done' })}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            <Input
              label={`${t('vendorSignup.minimumOrderAmount')} *`}
              value={minimumOrderAmount}
              onChangeText={setMinimumOrderAmount}
              keyboardType="numeric"
              placeholder="0.00"
            />
          </Section>

          <Button
            title={
              isEdit
                ? t('adminVendorManagement.form.saveChanges', { defaultValue: 'Save changes' })
                : t('adminVendorManagement.form.createVendor', { defaultValue: 'Create vendor' })
            }
            onPress={handleSave}
            loading={saving}
          />
          <View style={{ height: SPACING.xxl }} />
        </ScrollView>
        </KeyboardAvoidingView>
      )}

      <MapPickerModal
        visible={mapVisible}
        onClose={() => setMapVisible(false)}
        onSelect={handleMapSelect}
        confirmMessage={t('vendorSignup.useMapLocation')}
      />

      <Modal
        visible={bankPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBankPickerVisible(false)}
      >
        <SafeAreaView style={styles.bankModalSafe} edges={['top', 'bottom']}>
          <View style={styles.bankModalHeader}>
            <TouchableOpacity onPress={() => setBankPickerVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.bankModalTitle}>
              {t('vendorSignup.selectBank', { defaultValue: 'Select bank' })}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setBankName('');
                setBankPickerVisible(false);
              }}
            >
              <Text style={styles.bankModalClear}>{t('vendorSignup.clear', { defaultValue: 'Clear' })}</Text>
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
            />
          </View>
          <FlatList
            data={filteredBanks}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const selected = bankName === item;
              return (
                <TouchableOpacity
                  style={[styles.bankOption, selected && styles.bankOptionSelected]}
                  onPress={() => {
                    setBankName(item);
                    setBankPickerVisible(false);
                  }}
                >
                  <Text style={[styles.bankOptionText, selected && { color: COLORS.primary }]}>
                    {item}
                  </Text>
                  {selected ? <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} /> : null}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyBanks}>
                {t('vendorSignup.noBanksFound', { defaultValue: 'No banks match your search.' })}
              </Text>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surfaceLight },
  flex: { flex: 1 },
  hero: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
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
  heroTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.xl,
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  sectionCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: 4,
  },
  uploadSizeHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
    marginBottom: SPACING.sm,
  },
  req: { color: COLORS.error },
  optional: { color: COLORS.textSecondary, fontWeight: FONT_WEIGHTS.regular, fontSize: FONT_SIZES.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
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
  chipTextActive: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surfaceLight,
    marginBottom: SPACING.sm,
  },
  mapBtnTitle: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.medium, color: COLORS.text },
  mapCoords: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  selectBtn: {
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
  selectText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: FONT_WEIGHTS.medium },
  selectPlaceholder: { color: COLORS.textSecondary, fontWeight: FONT_WEIGHTS.regular },
  clearBank: { marginBottom: SPACING.sm },
  clearText: { fontSize: FONT_SIZES.sm, color: COLORS.error, fontWeight: FONT_WEIGHTS.medium },
  hoursRow: { flexDirection: 'row', gap: SPACING.md },
  hoursCol: { flex: 1 },
  timePickerWrap: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  timeDone: { alignSelf: 'flex-end', padding: SPACING.md },
  timeDoneText: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.semiBold },
  uploadField: { marginBottom: SPACING.sm },
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
  uploadPreview: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  uploadIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadTextWrap: { flex: 1 },
  uploadBtnText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.medium, color: COLORS.text },
  uploadHint: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  uploadLargePreviewWrap: {
    marginBottom: SPACING.sm,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  uploadLargePreview: { width: '100%', height: 160, resizeMode: 'cover' },
  uploadActions: { flexDirection: 'row', gap: SPACING.sm },
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
  filePickerModal: { flex: 1, backgroundColor: COLORS.background },
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
  filePickerWebView: { flex: 1, backgroundColor: COLORS.surfaceLight },
  bankModalSafe: { flex: 1, backgroundColor: COLORS.background },
  bankModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  bankModalTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  bankModalClear: { fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: FONT_WEIGHTS.medium },
  bankSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    margin: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surfaceLight,
  },
  bankSearchInput: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.text, paddingVertical: SPACING.sm },
  bankOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  bankOptionSelected: { backgroundColor: COLORS.primary + '10' },
  bankOptionText: { flex: 1, fontSize: FONT_SIZES.sm, color: COLORS.text },
  emptyBanks: { textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.xl },
});

export default AdminVendorFormScreen;
