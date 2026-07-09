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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import type { VendorSignupRequest } from '../../types/vendorSignup';

export interface VendorRejectModalProps {
  visible: boolean;
  request: VendorSignupRequest | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

const VendorRejectModal: React.FC<VendorRejectModalProps> = ({
  visible,
  request,
  loading = false,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) setReason('');
  }, [visible, request?.id]);

  const name = request?.company_name || request?.authorized_person_name || '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
          <Text style={styles.title}>{t('adminVendorRequests.rejectTitle')}</Text>
          <Text style={styles.message}>
            {t('adminVendorRequests.rejectMessage', { name })}
          </Text>
          <Text style={styles.label}>
            {t('adminVendorRequests.rejectReasonLabel', { defaultValue: 'Reason (optional)' })}
          </Text>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder={t('adminVendorRequests.rejectReasonPlaceholder', {
              defaultValue: 'Enter rejection reason...',
            })}
            placeholderTextColor={COLORS.textSecondary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!loading}
          />
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.rejectBtn, loading && styles.btnDisabled]}
              onPress={() => onConfirm(reason)}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.background} />
              ) : (
                <Text style={styles.rejectText}>{t('adminVendorRequests.reject')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  message: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceLight,
    marginBottom: SPACING.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  btn: {
    flex: 1,
    minHeight: 48,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  rejectBtn: {
    backgroundColor: COLORS.error,
  },
  btnDisabled: { opacity: 0.7 },
  cancelText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  rejectText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
});

export default VendorRejectModal;
