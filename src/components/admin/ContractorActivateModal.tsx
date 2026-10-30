import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import type { ContractorSignupRequest } from '../../types/contractorSignup';

type SheetProps = {
  request: ContractorSignupRequest | null;
  loading: boolean;
  embedded: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function ContractorActivateSheet({
  request,
  loading,
  embedded,
  onClose,
  onConfirm,
}: SheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const companyName =
    request?.company_name?.trim() ||
    t('adminContractor.contractorFallback', { defaultValue: 'this contractor' });

  return (
    <View style={[styles.overlay, embedded && styles.overlayEmbedded]}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
        <Text style={styles.title}>
          {t('adminContractor.activateTitle', { defaultValue: 'Activate contractor' })}
        </Text>
        <Text style={styles.message}>
          {t('adminContractor.activateConfirmInTandil', {
            defaultValue: 'Activate {{name}} in Tandil?',
            name: companyName,
          })}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onClose} disabled={loading}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.confirmBtn, loading && styles.confirmDisabled]}
            onPress={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.confirmText}>
                {t('adminContractor.activate', { defaultValue: 'Activate' })}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

type Props = {
  visible: boolean;
  request: ContractorSignupRequest | null;
  loading?: boolean;
  embedded?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const ContractorActivateModal: React.FC<Props> = ({
  visible,
  request,
  loading = false,
  embedded = false,
  onClose,
  onConfirm,
}) => {
  if (!visible) return null;

  const sheet = (
    <ContractorActivateSheet
      request={request}
      loading={loading}
      embedded={embedded}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );

  if (embedded) return sheet;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {sheet}
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
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  btn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  cancelBtn: { backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border },
  cancelText: { fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  confirmBtn: { backgroundColor: COLORS.success },
  confirmDisabled: { opacity: 0.6 },
  confirmText: { fontWeight: FONT_WEIGHTS.semiBold, color: '#fff' },
});

export default ContractorActivateModal;
