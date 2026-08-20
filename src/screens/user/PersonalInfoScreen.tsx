import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { useAppStore } from '../../store';
import {
  getUserProfile,
  updateUserProfile,
  UserProfileData,
  getProfilePictureUrl,
} from '../../services/userService';

const PersonalInfoScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user, setUser } = useAppStore();

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePicture, setProfilePicture] = useState<{ uri: string; type?: string; name?: string } | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUserProfile();
      setProfile(data ?? null);
      if (data) {
        setName(data.name ?? '');
        setEmail(data.email ?? '');
        setPhone(data.phone ?? data.phone_number ?? data.mobile ?? '');
      } else {
        setName(user?.name ?? '');
        setEmail(user?.email ?? '');
        setPhone(user?.phone ?? '');
      }
    } catch {
      setName(user?.name ?? '');
      setEmail(user?.email ?? '');
      setPhone(user?.phone ?? '');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const displayImageUri = profilePicture?.uri ?? getProfilePictureUrl(profile);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('personalInfo.permissionTitle', 'Permission needed'), t('personalInfo.permissionMessage', 'Allow access to photos to change profile picture.'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
        const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
        setProfilePicture({
          uri: asset.uri,
          type: mime,
          name: `profile.${ext}`,
        });
      }
    } catch (err: any) {
      Alert.alert(t('personalInfo.error', 'Error'), err?.message ?? t('personalInfo.pickError', 'Could not open photos'));
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      Alert.alert(t('personalInfo.error', 'Error'), t('personalInfo.nameRequired', 'Name is required.'));
      return;
    }
    if (!trimmedEmail) {
      Alert.alert(t('personalInfo.error', 'Error'), t('personalInfo.emailRequired', 'Email is required.'));
      return;
    }

    setSaving(true);
    try {
      const updated = await updateUserProfile({
        name: trimmedName,
        email: trimmedEmail,
        // Always send phone (including "") so clearing it actually updates the profile.
        phone: phone.trim(),
        profile_picture: profilePicture ?? undefined,
      });
      if (updated) {
        setProfile(updated);
        setProfilePicture(null);
        if (user) {
          const nextPhone =
            updated.phone ?? updated.phone_number ?? updated.mobile ?? phone.trim();
          setUser({
            ...user,
            name: updated.name,
            email: updated.email,
            phone: nextPhone != null ? String(nextPhone) : '',
          });
        }
        Alert.alert(t('personalInfo.success', 'Saved'), t('personalInfo.savedMessage', 'Profile updated successfully.'), [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert(t('personalInfo.error', 'Error'), t('personalInfo.updateFailed', 'Failed to update profile.'));
      }
    } catch (err: any) {
      const message = err.response?.data?.message ?? err.message ?? t('personalInfo.updateFailed', 'Failed to update profile.');
      Alert.alert(t('personalInfo.error', 'Error'), message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('personalInfo.title')}</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('personalInfo.title')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.formWrap} showsVerticalScrollIndicator={false}>
        {/* Profile picture - param from API that was not in the form before */}
        <Text style={styles.sectionLabel}>{t('personalInfo.profilePhoto', 'Profile Photo')}</Text>
        <TouchableOpacity style={styles.avatarWrap} onPress={pickImage}>
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

        <Text style={styles.label}>{t('personalInfo.fullName')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('personalInfo.placeholderName')}
          placeholderTextColor={COLORS.textSecondary}
          editable={!saving}
        />
        <Text style={styles.label}>{t('personalInfo.email')}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t('personalInfo.placeholderEmail')}
          placeholderTextColor={COLORS.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!saving}
        />
        <Text style={styles.label}>{t('personalInfo.phone')}</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder={t('personalInfo.placeholderPhone')}
          placeholderTextColor={COLORS.textSecondary}
          keyboardType="phone-pad"
          editable={!saving}
        />

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>{t('personalInfo.saveChanges')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  backBtn: { padding: SPACING.xs },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  formWrap: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  sectionLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: SPACING.lg,
    position: 'relative',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
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
  label: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginBottom: SPACING.xs },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  saveBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontWeight: FONT_WEIGHTS.medium },
});

export default PersonalInfoScreen;
