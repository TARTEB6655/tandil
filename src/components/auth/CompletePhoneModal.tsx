import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';

export interface CompletePhoneModalProps {
  visible: boolean;
  onSubmit: (phone: string) => Promise<void> | void;
  onLater?: () => void;
  /** When true, hide the "Later" action (phone is required to continue). */
  required?: boolean;
}

/**
 * Attractive post–Google/Apple signup prompt to collect a phone number.
 */
const CompletePhoneModal: React.FC<CompletePhoneModalProps> = ({
  visible,
  onSubmit,
  onLater,
  required = false,
}) => {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setPhone('');
      setError(null);
      setSaving(false);
    }
  }, [visible]);

  const handleSave = async () => {
    const trimmed = phone.trim();
    const digits = trimmed.replace(/\D/g, '');
    if (!trimmed) {
      setError(
        t('auth.completePhone.errorRequired', {
          defaultValue: 'Please enter your phone number',
        })
      );
      return;
    }
    if (digits.length < 8) {
      setError(
        t('auth.completePhone.errorInvalid', {
          defaultValue: 'Enter a valid phone number (at least 8 digits)',
        })
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as { message?: string })?.message ||
        t('auth.completePhone.errorSave', {
          defaultValue: 'Could not save your phone number. Please try again.',
        });
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!required && onLater) onLater();
      }}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (!required && onLater) onLater();
          }}
        />

        <View style={styles.sheet}>
          <View style={styles.accentBar} />

          <View style={styles.iconWrap}>
            <View style={styles.iconRing}>
              <Ionicons name="call" size={28} color={COLORS.primary} />
            </View>
          </View>

          <Text style={styles.eyebrow}>
            {t('auth.completePhone.eyebrow', { defaultValue: 'One quick step' })}
          </Text>
          <Text style={styles.title}>
            {t('auth.completePhone.title', { defaultValue: 'Add your phone number' })}
          </Text>
          <Text style={styles.subtitle}>
            {t('auth.completePhone.subtitle', {
              defaultValue:
                'We use it to confirm bookings, share visit updates, and reach you when it matters.',
            })}
          </Text>

          <View style={[styles.inputWrap, error ? styles.inputWrapError : null]}>
            <Ionicons name="call-outline" size={18} color={COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (error) setError(null);
              }}
              placeholder={t('auth.completePhone.placeholder', {
                defaultValue: '+971 50 123 4567',
              })}
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="phone-pad"
              autoFocus
              editable={!saving}
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={() => void handleSave()}
            />
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <Text style={styles.hint}>
              {t('auth.completePhone.hint', {
                defaultValue: 'Include your country code for the best results.',
              })}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
            onPress={() => void handleSave()}
            disabled={saving}
            activeOpacity={0.88}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>
                  {t('auth.completePhone.save', { defaultValue: 'Save phone number' })}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          {!required && onLater ? (
            <TouchableOpacity
              style={styles.laterBtn}
              onPress={onLater}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.laterBtnText}>
                {t('auth.completePhone.later', { defaultValue: 'I\'ll do this later' })}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 37, 19, 0.55)',
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderRadius: 24,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F2513',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
      },
      android: { elevation: 10 },
    }),
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: COLORS.primary,
  },
  iconWrap: {
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  iconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.primary + '14',
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    textAlign: 'center',
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    textAlign: 'center',
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: FONT_SIZES.sm,
    lineHeight: 21,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    paddingHorizontal: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: SPACING.md,
    minHeight: 52,
  },
  inputWrapError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.error + '08',
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  hint: {
    marginTop: 8,
    marginBottom: SPACING.lg,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: SPACING.lg,
    justifyContent: 'center',
  },
  errorText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
    flexShrink: 1,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    minHeight: 52,
    paddingHorizontal: SPACING.lg,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  laterBtn: {
    marginTop: SPACING.md,
    alignItems: 'center',
    paddingVertical: 8,
  },
  laterBtnText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
});

export default CompletePhoneModal;
