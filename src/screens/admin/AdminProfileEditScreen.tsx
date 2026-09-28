import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { adminService, AdminDashboardProfile } from '../../services/adminService';
import Header from '../../components/common/Header';
import {
  catalogImagePickerOptions,
  compressProfileImageForUpload,
  isImageTooLargeError,
} from '../../utils/compressImage';

const AdminProfileEditScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<AdminDashboardProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [profilePicture, setProfilePicture] = useState<{ uri: string; type?: string; name?: string } | null>(null);

  useEffect(() => {
    adminService
      .getDashboardProfile()
      .then((res) => {
        if (res.success && res.data) {
          setProfile(res.data);
          setName(res.data.name || '');
          setEmail(res.data.email || '');
          setPhone(res.data.phone || '');
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.error'),
          t('admin.settings.profileSetting.photoPermission')
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync(catalogImagePickerOptions());
      if (!result.canceled && result.assets?.[0]) {
        try {
          const uri = await compressProfileImageForUpload(
            result.assets[0].uri,
            result.assets[0].fileSize
          );
          setProfilePicture({
            uri,
            type: 'image/jpeg',
            name: 'profile.jpg',
          });
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
            return;
          }
          throw sizeErr;
        }
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? t('admin.settings.profileSetting.openPhotosFailed'));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('admin.settings.profileSetting.nameRequired'));
      return;
    }
    if (!email.trim()) {
      Alert.alert(t('common.error'), t('admin.settings.profileSetting.emailRequired'));
      return;
    }
    if (password || passwordConfirmation) {
      if (password !== passwordConfirmation) {
        Alert.alert(t('common.error'), t('admin.settings.profileSetting.passwordMismatch'));
        return;
      }
      if (password.length < 8) {
        Alert.alert(t('common.error'), t('admin.settings.profileSetting.passwordMin'));
        return;
      }
    }
    setSaving(true);
    try {
      const res = await adminService.updateDashboardProfile({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password: password || undefined,
        password_confirmation: passwordConfirmation || undefined,
        profile_picture: profilePicture || undefined,
      });
      setSaving(false);
      if (res.success) {
        Alert.alert(
          t('admin.settings.success'),
          t('admin.settings.profileSetting.saved'),
          [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert(t('common.error'), res.message ?? t('admin.settings.profileSetting.saveFailed'));
      }
    } catch (err: any) {
      setSaving(false);
      const msg = err.response?.data?.message ?? err.message ?? t('admin.settings.profileSetting.saveFailed');
      Alert.alert(t('common.error'), typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  if (loading && !profile) {
    return (
      <View style={styles.container}>
        <Header title={t('admin.settings.profileSetting.title')} showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  const displayImageUri = profilePicture?.uri ?? profile?.profile_picture_url;

  return (
    <View style={styles.container}>
      <Header title={t('admin.settings.profileSetting.title')} showBack onBackPress={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.settings.profileSetting.profilePhoto')}</Text>
          <TouchableOpacity onPress={pickImage} style={styles.avatarWrap}>
            {displayImageUri ? (
              <Image source={{ uri: displayImageUri }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="camera" size={36} color={COLORS.textSecondary} />
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="create" size={14} color={COLORS.background} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.settings.profileSetting.personalInfo')}</Text>
          <Text style={styles.label}>{t('admin.settings.profileSetting.name')} *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t('admin.settings.profileSetting.namePlaceholder')} />
          <Text style={styles.label}>{t('admin.settings.profileSetting.email')} *</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder={t('admin.settings.profileSetting.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.label}>{t('admin.settings.profileSetting.phone')}</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder={t('admin.settings.profileSetting.phonePlaceholder')} keyboardType="phone-pad" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.settings.profileSetting.changePassword')}</Text>
          <Text style={styles.label}>{t('admin.settings.profileSetting.newPassword')}</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder={t('admin.settings.profileSetting.passwordPlaceholder')} secureTextEntry />
          <Text style={styles.label}>{t('admin.settings.profileSetting.confirmPassword')}</Text>
          <TextInput style={styles.input} value={passwordConfirmation} onChangeText={setPasswordConfirmation} placeholder={t('admin.settings.profileSetting.confirmPasswordPlaceholder')} secureTextEntry />
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>{t('admin.settings.profileSetting.save')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  section: { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text, marginBottom: SPACING.sm },
  label: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  avatarWrap: { alignSelf: 'center', position: 'relative', marginBottom: SPACING.md },
  avatarImage: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold, color: '#fff' },
});

export default AdminProfileEditScreen;
