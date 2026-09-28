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
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { getTechnicianProfile, updateTechnicianProfile, TechnicianProfileData } from '../../services/technicianService';
import {
  catalogImagePickerOptions,
  compressProfileImageForUpload,
  isImageTooLargeError,
} from '../../utils/compressImage';

const TechnicianProfileEditScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [profile, setProfile] = useState<TechnicianProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [profilePicture, setProfilePicture] = useState<{ uri: string; type?: string; name?: string } | null>(null);

  useEffect(() => {
    getTechnicianProfile().then((data) => {
      setProfile(data ?? null);
      if (data) {
        setName(data.name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('technician.permissionNeeded'), t('technician.allowPhotos'));
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
              t('technician.error'),
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
      Alert.alert(t('technician.error'), err?.message ?? t('technician.profileEdit.openPhotosFailed'));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('technician.error'), t('technician.profileEdit.nameRequired'));
      return;
    }
    if (!email.trim()) {
      Alert.alert(t('technician.error'), t('technician.profileEdit.emailRequired'));
      return;
    }
    if (password || passwordConfirmation) {
      if (password !== passwordConfirmation) {
        Alert.alert(t('technician.error'), t('technician.profileEdit.passwordMismatch'));
        return;
      }
      if (password.length < 6) {
        Alert.alert(t('technician.error'), t('technician.profileEdit.passwordMinLength'));
        return;
      }
    }
    setSaving(true);
    try {
      const updated = await updateTechnicianProfile({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password: password || undefined,
        password_confirmation: passwordConfirmation || undefined,
        profile_picture: profilePicture || undefined,
      });
      setSaving(false);
      if (updated) {
        Alert.alert(t('technician.success'), t('technician.profileEdit.profileUpdatedSuccess'), [
          { text: t('technician.ok'), onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert(t('technician.error'), t('technician.profileEdit.updateFailed'));
      }
    } catch (err: any) {
      setSaving(false);
      const msg = err.response?.data?.message ?? err.message ?? t('technician.profileEdit.updateFailed');
      Alert.alert(t('technician.error'), typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  if (loading && !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('technician.editProfile')}</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  const displayImageUri = profilePicture?.uri ?? profile?.profile_picture_url;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('technician.editProfile')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.profileEdit.profilePhoto')}</Text>
          <TouchableOpacity onPress={pickImage} style={styles.avatarWrap}>
            {displayImageUri ? (
              <Image source={{ uri: displayImageUri }} style={styles.avatarImage} />
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
          <Text style={styles.sectionTitle}>{t('technician.profileEdit.personalInfo')}</Text>
          <Text style={styles.label}>{t('technician.profileEdit.nameLabel')}</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t('technician.fullName')} />
          <Text style={styles.label}>{t('technician.profileEdit.emailLabel')}</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder={t('technician.profileEdit.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.label}>{t('technician.profileEdit.phoneLabel')}</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder={t('technician.profileEdit.phonePlaceholder')} keyboardType="phone-pad" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.profileEdit.changePassword')}</Text>
          <Text style={styles.label}>{t('technician.profileEdit.newPassword')}</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder={t('technician.profileEdit.newPasswordPlaceholder')} secureTextEntry />
          <Text style={styles.label}>{t('technician.profileEdit.confirmPassword')}</Text>
          <TextInput style={styles.input} value={passwordConfirmation} onChangeText={setPasswordConfirmation} placeholder={t('technician.profileEdit.confirmPasswordPlaceholder')} secureTextEntry />
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>{t('technician.profileEdit.saveChanges')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SPACING.sm, minWidth: 40 },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
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

export default TechnicianProfileEditScreen;
