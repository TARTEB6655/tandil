import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { useAppStore } from '../../store';
import { authService } from '../../services/authService';

const CONFIRMATION_WORD = 'DELETE';

const CONSEQUENCE_ITEMS = [
  { icon: 'person-outline' as const, key: 'consequenceProfile' },
  { icon: 'location-outline' as const, key: 'consequenceAddresses' },
  { icon: 'receipt-outline' as const, key: 'consequenceOrders' },
];

const DeleteAccountScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { logout } = useAppStore();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const confirmationMatches =
    confirmation.trim().toUpperCase() === CONFIRMATION_WORD;
  const passwordFilled = password.trim().length > 0;
  const canSubmit = passwordFilled && confirmationMatches && !submitting;

  const resetToRoleSelection = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'RoleSelection' }],
    });
  };

  const handleDelete = () => {
    if (!canSubmit) return;

    Alert.alert(
      t('settings.alerts.deleteTitle'),
      t('settings.alerts.deleteBody'),
      [
        { text: t('settings.alerts.cancel'), style: 'cancel' },
        {
          text: t('settings.alerts.delete'),
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              const result = await authService.deleteAccount({
                confirmation: CONFIRMATION_WORD,
                password: password.trim(),
              });
              if (!result.success) {
                Alert.alert(
                  t('common.error'),
                  result.message || t('settings.alerts.deleteFailed')
                );
                return;
              }
              await logout({ skipApi: true });
              resetToRoleSelection();
              Alert.alert(
                t('settings.alerts.deletedTitle'),
                t('settings.alerts.deletedBody')
              );
            } catch (error: unknown) {
              const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data
                  ?.message ||
                (error instanceof Error ? error.message : null) ||
                t('settings.alerts.deleteFailed');
              Alert.alert(t('common.error'), message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header title={t('settings.items.deleteAccount.title')} showBack />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIconRing}>
              <View style={styles.heroIconCircle}>
                <Ionicons name="trash-outline" size={32} color={COLORS.error} />
              </View>
            </View>
            <Text style={styles.heroTitle}>{t('deleteAccount.heroTitle')}</Text>
            <Text style={styles.heroSubtitle}>{t('deleteAccount.warningBody')}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="information-circle-outline" size={20} color={COLORS.error} />
              <Text style={styles.cardTitle}>{t('deleteAccount.consequencesTitle')}</Text>
            </View>
            {CONSEQUENCE_ITEMS.map((item) => (
              <View key={item.key} style={styles.consequenceRow}>
                <View style={styles.consequenceIconWrap}>
                  <Ionicons name={item.icon} size={18} color={COLORS.textSecondary} />
                </View>
                <Text style={styles.consequenceText}>
                  {t(`deleteAccount.${item.key}`)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
              <Text style={[styles.cardTitle, styles.cardTitleDark]}>
                {t('deleteAccount.verifyTitle')}
              </Text>
            </View>

            <Text style={styles.fieldLabel}>{t('deleteAccount.passwordLabel')}</Text>
            <View style={[styles.inputWrap, passwordFilled && styles.inputWrapActive]}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={t('deleteAccount.passwordPlaceholder')}
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                accessibilityLabel={t('deleteAccount.togglePassword')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>{t('deleteAccount.confirmationLabel')}</Text>
            <Text style={styles.fieldHint}>{t('deleteAccount.confirmationHint')}</Text>
            <View
              style={[
                styles.inputWrap,
                confirmation.length > 0 && styles.inputWrapActive,
                confirmationMatches && styles.inputWrapValid,
              ]}
            >
              <Ionicons
                name="text-outline"
                size={18}
                color={confirmationMatches ? COLORS.success : COLORS.textSecondary}
              />
              <TextInput
                style={styles.input}
                value={confirmation}
                onChangeText={setConfirmation}
                placeholder={CONFIRMATION_WORD}
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!submitting}
              />
              {confirmationMatches ? (
                <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.deleteButton, !canSubmit && styles.deleteButtonDisabled]}
            onPress={handleDelete}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color={COLORS.background} />
                <Text style={styles.deleteButtonText}>{t('settings.alerts.delete')}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={submitting}
          >
            <Text style={styles.cancelButtonText}>{t('deleteAccount.keepAccount')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const cardShadow = Platform.select({
  ios: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  android: { elevation: 3 },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  flex: { flex: 1 },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  heroIconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: `${COLORS.error}14`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  heroIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.error}33`,
  },
  heroTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...cardShadow,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.error,
  },
  cardTitleDark: {
    color: COLORS.text,
  },
  consequenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  consequenceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  consequenceText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  fieldHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    lineHeight: 18,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.sm + 2 : SPACING.sm,
    marginBottom: SPACING.md,
  },
  inputWrapActive: {
    borderColor: `${COLORS.primary}55`,
  },
  inputWrapValid: {
    borderColor: COLORS.success,
    backgroundColor: `${COLORS.success}08`,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    paddingVertical: 0,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.error,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  deleteButtonDisabled: {
    opacity: 0.45,
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  deleteButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    marginTop: SPACING.xs,
  },
  cancelButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
});

export default DeleteAccountScreen;
