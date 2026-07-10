import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import {
  VendorCard,
  VendorPageHeader,
  VENDOR_SCREEN_BG,
} from '../../components/vendor/VendorUi';
import {
  vendorProfileService,
  VendorProfileData,
} from '../../services/vendorProfileService';
import { useAppStore } from '../../store';

function ReadOnlyRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.readOnlyRow}>
      <View style={styles.readOnlyIconWrap}>
        <Ionicons name={icon} size={16} color={COLORS.textSecondary} />
      </View>
      <View style={styles.readOnlyTextWrap}>
        <Text style={styles.readOnlyLabel}>{label}</Text>
        <Text style={styles.readOnlyValue}>{value || '—'}</Text>
      </View>
      <Ionicons name="lock-closed" size={14} color={COLORS.textSecondary} />
    </View>
  );
}

const VendorEditProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const scrollRef = useRef<ScrollView>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<VendorProfileData | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [authorizedPersonName, setAuthorizedPersonName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [deliveryRadius, setDeliveryRadius] = useState('');
  const [minimumOrderAmount, setMinimumOrderAmount] = useState('');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [logoFile, setLogoFile] = useState<{ uri: string; type?: string; name?: string } | null>(null);
  const [profilePictureFile, setProfilePictureFile] = useState<{
    uri: string;
    type?: string;
    name?: string;
  } | null>(null);
  const [pickingLogo, setPickingLogo] = useState(false);
  const [pickingProfilePicture, setPickingProfilePicture] = useState(false);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeProfilePicture, setRemoveProfilePicture] = useState(false);

  const applyProfileToForm = useCallback((data: VendorProfileData) => {
    setProfile(data);
    setBusinessName(data.business_name || '');
    setAuthorizedPersonName(data.authorized_person_name || '');
    setPhone(data.phone || '');
    setAddress(data.address || '');
    setCity(data.city || '');
    setDescription(data.description || '');
    setBankName(data.bank_name || '');
    setIban(data.iban || '');
    setAccountHolderName(data.account_holder_name || '');
    setDeliveryRadius(data.delivery_radius_km != null ? String(data.delivery_radius_km) : '');
    setMinimumOrderAmount(
      data.minimum_order_amount != null ? String(data.minimum_order_amount) : ''
    );
    setOpensAt(data.opens_at || '');
    setClosesAt(data.closes_at || '');
    setLogoFile(null);
    setProfilePictureFile(null);
    setRemoveLogo(false);
    setRemoveProfilePicture(false);
    setErrors({});
  }, []);

  const buildFallbackProfile = useCallback((): VendorProfileData => {
    return {
      business_name: user?.name || '',
      authorized_person_name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    };
  }, [user]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await vendorProfileService.getProfile();
      if (data) {
        applyProfileToForm(data);
      } else {
        applyProfileToForm(buildFallbackProfile());
        setLoadError(
          t('vendorEditProfile.loadPartial', {
            defaultValue: 'Some profile details could not be loaded. You can still update contact and operations.',
          })
        );
      }
    } catch (err: unknown) {
      applyProfileToForm(buildFallbackProfile());
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string })?.message ||
        t('vendorEditProfile.loadFailed', { defaultValue: 'Failed to load profile.' });
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [applyProfileToForm, buildFallbackProfile, t]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const pickImage = async (
    kind: 'logo' | 'profile_picture',
    setPicking: (v: boolean) => void,
    onPicked: (file: { uri: string; type?: string; name?: string }) => void
  ) => {
    setPicking(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          t('vendorEditProfile.photoPermission', {
            defaultValue: 'Allow photo access to update your images.',
          })
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.[0]) {
        onPicked({
          uri: result.assets[0].uri,
          type: 'image/jpeg',
          name: kind === 'logo' ? 'logo.jpg' : 'profile_picture.jpg',
        });
      }
    } catch (err: unknown) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        (err as { message?: string })?.message ||
          t('vendorEditProfile.photoFailed', { defaultValue: 'Could not open photos.' })
      );
    } finally {
      setPicking(false);
    }
  };

  const pickLogo = () =>
    pickImage('logo', setPickingLogo, (file) => {
      setLogoFile(file);
      setRemoveLogo(false);
    });

  const pickProfilePicture = () =>
    pickImage('profile_picture', setPickingProfilePicture, (file) => {
      setProfilePictureFile(file);
      setRemoveProfilePicture(false);
    });

  const clearLogo = () => {
    setLogoFile(null);
    setRemoveLogo(true);
  };

  const clearProfilePicture = () => {
    setProfilePictureFile(null);
    setRemoveProfilePicture(true);
  };

  const showValidationErrors = (newErrors: Record<string, string>) => {
    setErrors(newErrors);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    const messages = Object.values(newErrors).filter(Boolean);
    Alert.alert(
      t('admin.addProduct.missingFieldsTitle'),
      messages.length > 0 ? `• ${messages.join('\n• ')}` : t('admin.addProduct.missingFieldsMessage'),
      [{ text: t('common.ok', { defaultValue: 'OK' }) }]
    );
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!authorizedPersonName.trim()) {
      newErrors.authorized_person_name = t('vendorEditProfile.contactNameRequired', {
        defaultValue: 'Contact person name is required.',
      });
    }
    if (!phone.trim()) {
      newErrors.phone = t('vendorEditProfile.phoneRequired', {
        defaultValue: 'Phone number is required.',
      });
    }
    if (deliveryRadius.trim()) {
      const radius = Number(deliveryRadius);
      if (!Number.isFinite(radius) || radius < 0) {
        newErrors.delivery_radius_km = t('vendorEditProfile.radiusInvalid', {
          defaultValue: 'Enter a valid delivery radius.',
        });
      }
    }
    if (minimumOrderAmount.trim()) {
      const minOrder = Number(minimumOrderAmount);
      if (!Number.isFinite(minOrder) || minOrder < 0) {
        newErrors.minimum_order_amount = t('vendorEditProfile.minOrderInvalid', {
          defaultValue: 'Enter a valid minimum order amount.',
        });
      }
    }
    if (Object.keys(newErrors).length > 0) {
      showValidationErrors(newErrors);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const updated = await vendorProfileService.updateProfile({
        business_name: businessName.trim(),
        contact_person: authorizedPersonName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        store_description: description.trim(),
        bank_name: bankName.trim(),
        iban: iban.trim(),
        account_holder_name: accountHolderName.trim(),
        delivery_radius_km: deliveryRadius.trim() ? Number(deliveryRadius) : undefined,
        minimum_order_amount: minimumOrderAmount.trim() ? Number(minimumOrderAmount) : undefined,
        opens_at: opensAt.trim(),
        closes_at: closesAt.trim(),
        logo: logoFile || undefined,
        profile_picture: profilePictureFile || undefined,
        remove_logo: removeLogo && !logoFile,
        remove_profile_picture: removeProfilePicture && !profilePictureFile,
      });

      if (updated) {
        applyProfileToForm(updated);
      } else {
        // Refresh so UI shows latest values after a message-only success response.
        try {
          const fresh = await vendorProfileService.getProfile();
          if (fresh) applyProfileToForm(fresh);
        } catch {
          // Keep local form values if refresh fails.
        }
      }

      if (user) {
        setUser({
          ...user,
          name: authorizedPersonName.trim() || user.name,
          phone: phone.trim() || user.phone,
        });
      }

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('vendorEditProfile.updateSuccess', { defaultValue: 'Profile updated successfully.' }),
        [{ text: t('common.ok', { defaultValue: 'OK' }), onPress: () => navigation.goBack() }]
      );
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string; errors?: Record<string, string[]> } };
        message?: string;
      };
      const errorMessage =
        axiosErr.response?.data?.message ||
        axiosErr.message ||
        t('vendorEditProfile.updateFailed', { defaultValue: 'Failed to update profile.' });
      if (axiosErr.response?.data?.errors) {
        const apiErrors: Record<string, string> = {};
        Object.keys(axiosErr.response.data.errors).forEach((key) => {
          const mappedKey =
            key === 'contact_person'
              ? 'authorized_person_name'
              : key === 'store_description'
                ? 'description'
                : key;
          apiErrors[mappedKey] = axiosErr.response!.data!.errors![key][0];
        });
        showValidationErrors(apiErrors);
      } else {
        Alert.alert(t('common.error', { defaultValue: 'Error' }), errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  const displayLogoUri = logoFile?.uri ?? (removeLogo ? undefined : profile?.logo_url);
  const displayProfilePictureUri =
    profilePictureFile?.uri ??
    (removeProfilePicture ? undefined : profile?.profile_picture_url);

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <VendorPageHeader
          title={t('vendorEditProfile.title', { defaultValue: 'Edit Profile' })}
          subtitle={t('vendorEditProfile.subtitle', { defaultValue: 'Update contact and store operations' })}
          onBack={() => navigation.goBack()}
        />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <VendorPageHeader
        title={t('vendorEditProfile.title', { defaultValue: 'Edit Profile' })}
        subtitle={t('vendorEditProfile.subtitle', { defaultValue: 'Update contact and store operations' })}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loadError ? (
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle-outline" size={20} color={COLORS.warning} />
              <Text style={styles.infoBannerText}>{loadError}</Text>
            </View>
          ) : null}

          {Object.keys(errors).length > 0 ? (
            <View style={styles.validationBanner}>
              <Ionicons name="alert-circle" size={22} color={COLORS.error} />
              <View style={styles.validationBannerTextWrap}>
                <Text style={styles.validationBannerTitle}>
                  {t('vendorAddProduct.fixErrors', { defaultValue: 'Please fix the following:' })}
                </Text>
                {Object.entries(errors).map(([key, message]) => (
                  <Text key={key} style={styles.validationBannerItem}>
                    • {message}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}

          <VendorCard style={styles.card}>
            <Text style={[styles.sectionTitle, styles.brandingTitle]}>
              {t('vendorEditProfile.storeBranding', { defaultValue: 'Store branding' })}
            </Text>

            <View style={styles.mediaRow}>
              <View style={styles.mediaCol}>
                <Text style={styles.mediaLabel}>
                  {t('vendorEditProfile.profilePicture', { defaultValue: 'Profile picture' })}
                </Text>
                <View style={styles.logoWrap}>
                  <TouchableOpacity
                    onPress={pickProfilePicture}
                    disabled={pickingProfilePicture}
                    activeOpacity={0.85}
                  >
                    {displayProfilePictureUri ? (
                      <Image
                        source={{ uri: displayProfilePictureUri }}
                        style={styles.logoImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.logoPlaceholder}>
                        <Ionicons name="person-outline" size={32} color={COLORS.textSecondary} />
                      </View>
                    )}
                    <View style={styles.logoBadge}>
                      {pickingProfilePicture ? (
                        <ActivityIndicator size="small" color={COLORS.background} />
                      ) : (
                        <Ionicons name="camera" size={14} color={COLORS.background} />
                      )}
                    </View>
                  </TouchableOpacity>
                  {displayProfilePictureUri ? (
                    <TouchableOpacity
                      style={styles.removeBadge}
                      onPress={clearProfilePicture}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      accessibilityLabel={t('vendorEditProfile.removeProfilePicture', {
                        defaultValue: 'Remove profile picture',
                      })}
                    >
                      <Ionicons name="close" size={14} color={COLORS.background} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <View style={styles.mediaCol}>
                <Text style={styles.mediaLabel}>
                  {t('vendorEditProfile.businessLogo', { defaultValue: 'Business logo' })}
                </Text>
                <View style={styles.logoWrap}>
                  <TouchableOpacity
                    onPress={pickLogo}
                    disabled={pickingLogo}
                    activeOpacity={0.85}
                  >
                    {displayLogoUri ? (
                      <Image source={{ uri: displayLogoUri }} style={styles.logoImage} contentFit="cover" />
                    ) : (
                      <View style={styles.logoPlaceholder}>
                        <Ionicons name="storefront-outline" size={32} color={COLORS.textSecondary} />
                      </View>
                    )}
                    <View style={styles.logoBadge}>
                      {pickingLogo ? (
                        <ActivityIndicator size="small" color={COLORS.background} />
                      ) : (
                        <Ionicons name="camera" size={14} color={COLORS.background} />
                      )}
                    </View>
                  </TouchableOpacity>
                  {displayLogoUri ? (
                    <TouchableOpacity
                      style={styles.removeBadge}
                      onPress={clearLogo}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      accessibilityLabel={t('vendorEditProfile.removeLogo', {
                        defaultValue: 'Remove business logo',
                      })}
                    >
                      <Ionicons name="close" size={14} color={COLORS.background} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          </VendorCard>

          <VendorCard style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="create-outline" size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>
                {t('vendorEditProfile.businessSection', { defaultValue: 'Business & contact' })}
              </Text>
            </View>
            <Input
              label={t('vendorEditProfile.businessName', { defaultValue: 'Business name' })}
              placeholder={t('vendorEditProfile.businessNamePlaceholder', { defaultValue: 'Registered business name' })}
              value={businessName}
              onChangeText={setBusinessName}
              leftIcon="business-outline"
            />
            <Text style={styles.fieldNote}>
              {profile?.business_name_note ||
                t('vendorEditProfile.businessNameNote', {
                  defaultValue: 'May require admin approval if changed after verification.',
                })}
            </Text>
            <Input
              label={t('vendorEditProfile.contactName', { defaultValue: 'Contact person' })}
              placeholder={t('vendorEditProfile.contactNamePlaceholder', { defaultValue: 'Authorized person name' })}
              value={authorizedPersonName}
              onChangeText={(text) => {
                setAuthorizedPersonName(text);
                if (errors.authorized_person_name) {
                  setErrors((prev) => ({ ...prev, authorized_person_name: '' }));
                }
              }}
              leftIcon="person-outline"
              error={errors.authorized_person_name}
            />
            <Input
              label={t('vendorEditProfile.phone', { defaultValue: 'Phone' })}
              placeholder="+971 50 000 0000"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
              }}
              keyboardType="phone-pad"
              leftIcon="call-outline"
              error={errors.phone}
            />
            <Input
              label={t('vendorEditProfile.address', { defaultValue: 'Address' })}
              placeholder={t('vendorEditProfile.addressPlaceholder', { defaultValue: 'Warehouse or store address' })}
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
              leftIcon="navigate-outline"
            />
            <Input
              label={t('vendorEditProfile.city', { defaultValue: 'City' })}
              placeholder={t('vendorEditProfile.cityPlaceholder', { defaultValue: 'City' })}
              value={city}
              onChangeText={setCity}
              leftIcon="location-outline"
            />
            <Input
              label={t('vendorEditProfile.description', { defaultValue: 'Store description' })}
              placeholder={t('vendorEditProfile.descriptionPlaceholder', {
                defaultValue: 'Tell customers about your store',
              })}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </VendorCard>

          <VendorCard style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="time-outline" size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>
                {t('vendorEditProfile.hoursSection', { defaultValue: 'Business hours' })}
              </Text>
            </View>
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Input
                  label={t('vendorEditProfile.opensAt', { defaultValue: 'Opens at' })}
                  placeholder="09:00"
                  value={opensAt}
                  onChangeText={setOpensAt}
                  leftIcon="sunny-outline"
                />
              </View>
              <View style={styles.halfField}>
                <Input
                  label={t('vendorEditProfile.closesAt', { defaultValue: 'Closes at' })}
                  placeholder="22:00"
                  value={closesAt}
                  onChangeText={setClosesAt}
                  leftIcon="moon-outline"
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Input
                  label={t('vendorEditProfile.deliveryRadius', { defaultValue: 'Delivery radius (km)' })}
                  placeholder="25"
                  value={deliveryRadius}
                  onChangeText={(text) => {
                    setDeliveryRadius(text);
                    if (errors.delivery_radius_km) {
                      setErrors((prev) => ({ ...prev, delivery_radius_km: '' }));
                    }
                  }}
                  keyboardType="numeric"
                  leftIcon="radio-outline"
                  error={errors.delivery_radius_km}
                />
              </View>
              <View style={styles.halfField}>
                <Input
                  label={t('vendorEditProfile.minOrder', { defaultValue: 'Min. order (AED)' })}
                  placeholder="50"
                  value={minimumOrderAmount}
                  onChangeText={(text) => {
                    setMinimumOrderAmount(text);
                    if (errors.minimum_order_amount) {
                      setErrors((prev) => ({ ...prev, minimum_order_amount: '' }));
                    }
                  }}
                  keyboardType="numeric"
                  leftIcon="cash-outline"
                  error={errors.minimum_order_amount}
                />
              </View>
            </View>
          </VendorCard>

          <VendorCard style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="wallet-outline" size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>
                {t('vendorEditProfile.bankSection', { defaultValue: 'Bank account details' })}
              </Text>
            </View>
            <Text style={styles.sectionHint}>
              {profile?.bank_hint ||
                t('vendorEditProfile.bankHint', {
                  defaultValue: 'Used for payouts. Ensure details match your trade license.',
                })}
            </Text>
            <Input
              label={t('vendorEditProfile.bank', { defaultValue: 'Bank name' })}
              placeholder={t('vendorEditProfile.bankPlaceholder', { defaultValue: 'e.g. Emirates NBD' })}
              value={bankName}
              onChangeText={setBankName}
              leftIcon="card-outline"
            />
            <Input
              label={t('vendorEditProfile.iban', { defaultValue: 'IBAN' })}
              placeholder="AE070331234567890123456"
              value={iban}
              onChangeText={setIban}
              autoCapitalize="characters"
              leftIcon="wallet-outline"
            />
            <Input
              label={t('vendorEditProfile.accountHolder', { defaultValue: 'Account holder' })}
              placeholder={t('vendorEditProfile.accountHolderPlaceholder', { defaultValue: 'Name on bank account' })}
              value={accountHolderName}
              onChangeText={setAccountHolderName}
              leftIcon="person-outline"
            />
          </VendorCard>

          <VendorCard style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.sectionTitle}>
                {t('vendorEditProfile.verifiedInfo', { defaultValue: 'Verified by admin' })}
              </Text>
            </View>
            <Text style={styles.sectionHint}>
              {t('vendorEditProfile.verifiedHint', {
                defaultValue: 'These fields are set during registration. Contact support to request changes.',
              })}
            </Text>
            <ReadOnlyRow
              label={t('vendorEditProfile.email', { defaultValue: 'Email' })}
              value={profile?.email || user?.email || ''}
              icon="mail-outline"
            />
            <ReadOnlyRow
              label={t('vendorEditProfile.vendorType', { defaultValue: 'Business type' })}
              value={profile?.vendor_type_label || profile?.vendor_type || ''}
              icon="leaf-outline"
            />
            <ReadOnlyRow
              label={t('vendorEditProfile.emirate', { defaultValue: 'Emirate' })}
              value={profile?.emirate || ''}
              icon="location-outline"
            />
            <ReadOnlyRow
              label={t('vendorEditProfile.tradeLicense', { defaultValue: 'Trade license' })}
              value={profile?.trade_license_number || ''}
              icon="document-text-outline"
            />
            <ReadOnlyRow
              label={t('vendorEditProfile.vat', { defaultValue: 'VAT / TRN' })}
              value={profile?.vat_number || ''}
              icon="receipt-outline"
            />
            {profile?.status_label ? (
              <View style={styles.statusPills}>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>{profile.status_label}</Text>
                </View>
              </View>
            ) : null}
          </VendorCard>

          <View style={styles.bottomPad} />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={t('vendorEditProfile.saveButton', { defaultValue: 'Save Changes' })}
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={styles.saveButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VENDOR_SCREEN_BG },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.md },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  brandingTitle: {
    marginBottom: SPACING.md,
  },
  sectionHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.warning + '14',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.warning + '44',
  },
  infoBannerText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  validationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.error + '12',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.error + '44',
  },
  validationBannerTextWrap: { flex: 1 },
  validationBannerTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.error,
    marginBottom: SPACING.xs,
  },
  validationBannerItem: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
    marginTop: 2,
  },
  logoWrap: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: SPACING.sm,
  },
  mediaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  mediaCol: {
    flex: 1,
    alignItems: 'center',
  },
  logoImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  logoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  logoBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  removeBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
    zIndex: 2,
  },
  mediaLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  fieldNote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: -SPACING.sm,
    marginBottom: SPACING.md,
  },
  readOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  readOnlyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readOnlyTextWrap: { flex: 1 },
  readOnlyLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  readOnlyValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  statusPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  statusPill: {
    backgroundColor: COLORS.warning + '22',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  tierPill: {
    backgroundColor: COLORS.primary + '18',
  },
  statusPillText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.warning,
  },
  tierPillText: {
    color: COLORS.primary,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  halfField: {
    flex: 1,
    minWidth: 0,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveButton: { marginTop: 0 },
  bottomPad: { height: SPACING.sm },
});

export default VendorEditProfileScreen;
