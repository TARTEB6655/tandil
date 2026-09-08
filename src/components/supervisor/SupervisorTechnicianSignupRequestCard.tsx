import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import type { SupervisorTechnicianSignupRequest } from '../../services/supervisorService';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  } catch {
    return iso;
  }
}

type Props = {
  item: SupervisorTechnicianSignupRequest;
  isActioning?: boolean;
  onApprove: (item: SupervisorTechnicianSignupRequest) => void;
  onReject: (item: SupervisorTechnicianSignupRequest) => void;
};

const SupervisorTechnicianSignupRequestCard: React.FC<Props> = ({
  item,
  isActioning = false,
  onApprove,
  onReject,
}) => {
  const { t } = useTranslation();
  const areaText = item.area?.name?.trim() || item.service_area?.trim();

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.meta}>{item.email}</Text>
      <Text style={styles.meta}>{item.phone}</Text>
      {areaText ? <Text style={styles.meta}>{areaText}</Text> : null}
      <Text style={styles.date}>
        {t('supervisorSignupRequests.requestedAt')} {formatDate(item.created_at)}
      </Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.approveButton, isActioning && styles.disabledButton]}
          onPress={() => onApprove(item)}
          disabled={isActioning}
        >
          {isActioning ? (
            <ActivityIndicator size="small" color={COLORS.background} />
          ) : (
            <>
              <Ionicons name="checkmark" size={16} color={COLORS.background} />
              <Text style={styles.approveText}>{t('supervisorSignupRequests.approve')}</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rejectButton, isActioning && styles.disabledButton]}
          onPress={() => onReject(item)}
          disabled={isActioning}
        >
          {isActioning ? (
            <ActivityIndicator size="small" color={COLORS.background} />
          ) : (
            <>
              <Ionicons name="close" size={16} color={COLORS.background} />
              <Text style={styles.rejectText}>{t('supervisorSignupRequests.reject')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  name: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.text },
  meta: { marginTop: SPACING.xs, fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  date: { marginTop: SPACING.sm, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  actionsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.success,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  approveText: { color: COLORS.background, fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  rejectText: { color: COLORS.background, fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold },
  disabledButton: { opacity: 0.7 },
});

export default SupervisorTechnicianSignupRequestCard;
