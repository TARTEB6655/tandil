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
import type { ContractorSignupRequest } from '../../types/contractorSignup';

type Props = {
  visible: boolean;
  request: ContractorSignupRequest | null;
  title: string;
  message: string;
  confirmLabel: string;
  loading?: boolean;
  /** When true, empty reason blocks confirm (reject API). */
  requireReason?: boolean;
  /** Render inside an existing Modal (avoids stacked RN Modals not appearing). */
  embedded?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

const ContractorRejectReasonModal: React.FC<Props> = ({
  visible,
  request,
  title,
  message,
  confirmLabel,
  loading = false,
  requireReason = false,
  embedded = false,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) setReason('');
  }, [visible, request?.id]);

  if (!visible) return null;

  const sheetContent = (
    <KeyboardAvoidingView
      style={[styles.overlay, embedded && styles.overlayEmbedded]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.label}>
          {requireReason
            ? t('adminContractor.reasonRequiredLabel', { defaultValue: 'Reason *' })
            : t('adminContractor.reasonLabel', { defaultValue: 'Reason (optional)' })}
        </Text>
        <TextInput
          style={styles.input}
          value={reason}
          onChangeText={setReason}
          placeholder={t('adminContractor.reasonPlaceholder', {
            defaultValue: 'Enter reason for client…',
          })}
          placeholderTextColor={COLORS.textSecondary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          editable={!loading}
        />
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onClose} disabled={loading}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.btn,
              styles.confirmBtn,
              requireReason && !reason.trim() && styles.confirmDisabled,
            ]}
            onPress={() => onConfirm(reason)}
            disabled={loading || (requireReason && !reason.trim())}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  if (embedded) {
    return sheetContent;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {sheetContent}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayEmbedded: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
  },
  title: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  message: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  label: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.medium, color: COLORS.text },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    minHeight: 88,
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  btn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  cancelBtn: { backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border },
  cancelText: { fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  confirmBtn: { backgroundColor: COLORS.error },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { fontWeight: FONT_WEIGHTS.semiBold, color: '#fff' },
});

export default ContractorRejectReasonModal;
