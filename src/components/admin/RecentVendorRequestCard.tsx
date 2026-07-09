import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import type { VendorSignupRequest } from '../../types/vendorSignup';
import { resolveVendorId } from '../../services/adminVendorService';
import VendorRequestLogo from './VendorRequestLogo';

export interface RecentVendorRequestCardProps {
  item: VendorSignupRequest;
  actioningId?: number | string | null;
  onPress: (item: VendorSignupRequest) => void;
  onApprove: (item: VendorSignupRequest) => void;
  onCancel: (item: VendorSignupRequest) => void;
}

const RecentVendorRequestCard: React.FC<RecentVendorRequestCardProps> = ({
  item,
  actioningId = null,
  onPress,
  onApprove,
  onCancel,
}) => {
  const { t } = useTranslation();
  const isLoading = actioningId != null && String(actioningId) === String(resolveVendorId(item));

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.mainRow} activeOpacity={0.88} onPress={() => onPress(item)}>
        <VendorRequestLogo logoUrl={item.logo_url} size={48} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.company_name || item.authorized_person_name || '—'}
            </Text>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>
                {t('adminVendorRequests.status.pending')}
              </Text>
            </View>
          </View>
          <View style={styles.emailRow}>
            <Ionicons name="mail-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.email} numberOfLines={1}>
              {item.email}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <View style={styles.divider} />

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.cancelBtn, isLoading && styles.btnDisabled]}
          onPress={() => onCancel(item)}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          <Ionicons name="close-circle-outline" size={18} color={COLORS.error} />
          <Text style={styles.cancelText}>{t('adminVendorRequests.cancel')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.approveBtn, isLoading && styles.btnDisabled]}
          onPress={() => onApprove(item)}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={COLORS.background} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.background} />
              <Text style={styles.approveText}>{t('adminVendorRequests.approve')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  info: { flex: 1, minWidth: 0 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  pendingBadge: {
    backgroundColor: COLORS.warning + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.warning,
    textTransform: 'uppercase',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  email: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    paddingTop: SPACING.sm,
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.error,
    backgroundColor: COLORS.error + '08',
  },
  cancelText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.error,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
  },
  approveText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  btnDisabled: { opacity: 0.65 },
});

export default RecentVendorRequestCard;
