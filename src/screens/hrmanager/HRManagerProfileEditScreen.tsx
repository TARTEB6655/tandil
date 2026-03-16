import React, { useState, useCallback } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { hrService, HRProfileData } from '../../services/hrService';

const HRManagerProfileEditScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<HRProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePicture, setProfilePicture] = useState<{
    uri: string;
    type?: string;
    name?: string;
  } | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrService.getProfile();
      const data = res?.success ? res.data : null;
      setProfile(data ?? null);
      if (data) {
        setName(data.name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
      }
      setProfilePicture(null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('technician.permissionNeeded', 'Permission needed'),
          t('technician.allowPhotos', 'Please allow access to photos.')
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        setProfilePicture({
          uri: result.assets[0].uri,
          type: 'image/jpeg',
          name: 'profile.jpg',
        });
      }
    } catch (err: any) {
      Alert.alert(
        t('technician.error', 'Error'),
        err?.message ?? t('technician.profileEdit.openPhotosFailed', 'Could not open photos.')
      );
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(
        t('technician.error', 'Error'),
        t('technician.profileEdit.nameRequired', 'Name is required.')
      );
      return;
    }
    if (!email.trim()) {
      Alert.alert(
        t('technician.error', 'Error'),
        t('technician.profileEdit.emailRequired', 'Email is required.')
      );
      return;
    }
    setSaving(true);
    try {
      const updated = await hrService.updateProfile({
        name: name.trim(),
        email: email.trim(),
        phone: (phone || '').trim(),
        profile_picture: profilePicture || undefined,
      });
      setSaving(false);
      if (updated) {
        Alert.alert(
          t('technician.success', 'Success'),
          t('technician.profileEdit.profileUpdatedSuccess', 'Profile updated successfully.'),
          [{ text: t('technician.ok', 'OK'), onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert(
          t('technician.error', 'Error'),
          t('technician.profileEdit.updateFailed', 'Failed to update profile.')
        );
      }
    } catch (err: any) {
      setSaving(false);
      const msg =
        (err as any)?.response?.data?.message ??
        (err as Error)?.message ??
        t('technician.profileEdit.updateFailed', 'Failed to update profile.');
      Alert.alert(t('technician.error', 'Error'), typeof msg === 'string' ? msg : String(msg));
    }
  };

  if (loading && !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('technician.profileEdit.personalInfo', 'Profile information')}</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  const displayImageUri = profilePicture?.uri ?? profile?.profile_picture_url ?? profile?.profile_picture;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('technician.profileEdit.personalInfo', 'Profile information')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.profileEdit.profilePhoto', 'Profile photo')}</Text>
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
          <Text style={styles.photoHint}>{t('personalInformation.optionalPhoto', 'Optional. Add file to update photo.')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.profileEdit.personalInfo', 'Personal information')}</Text>
          <Text style={styles.label}>{t('technician.profileEdit.nameLabel', 'Name')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('technician.fullName', 'Full name')}
            placeholderTextColor={COLORS.textSecondary}
          />
          <Text style={styles.label}>{t('technician.profileEdit.emailLabel', 'Email')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={t('technician.profileEdit.emailPlaceholder', 'Email address')}
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={styles.label}>{t('technician.profileEdit.phoneLabel', 'Phone')}</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('technician.profileEdit.phonePlaceholder', 'Phone number')}
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="phone-pad"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>{t('technician.profileEdit.saveChanges', 'Save changes')}</Text>
          )}
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
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
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
  avatarWrap: { alignSelf: 'center', position: 'relative', marginBottom: SPACING.xs },
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
  photoHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
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

export default HRManagerProfileEditScreen;
