import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Linking,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import type { ContractorSignupRequest } from '../../types/contractorSignup';

const SCREEN_WIDTH = Dimensions.get('window').width;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DocumentTile({
  label,
  fileName,
  url,
  onPreview,
}: {
  label: string;
  fileName?: string;
  url?: string;
  onPreview: (url: string, title: string) => void;
}) {
  const hasUrl = Boolean(url?.trim());
  const isPdf = hasUrl && isPdfUrl(url!);

  const open = () => {
    if (!url?.trim()) return;
    if (isPdf) {
      void Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Could not open this document.');
      });
      return;
    }
    onPreview(url, label);
  };

  return (
    <TouchableOpacity
      style={styles.docTile}
      disabled={!hasUrl}
      onPress={open}
      activeOpacity={0.85}
    >
      {hasUrl && !isPdf ? (
        <Image source={{ uri: url }} style={styles.docThumb} contentFit="cover" />
      ) : (
        <View style={styles.docPlaceholder}>
          <Ionicons
            name={isPdf ? 'document-text-outline' : 'image-outline'}
            size={26}
            color={hasUrl ? COLORS.primary : COLORS.textSecondary}
          />
        </View>
      )}
      <Text style={styles.docLabel} numberOfLines={2}>
        {label}
      </Text>
      {fileName?.trim() ? (
        <Text style={styles.docFileName} numberOfLines={1}>
          {fileName}
        </Text>
      ) : null}
      <Text style={hasUrl ? styles.docTap : styles.docMissing}>
        {hasUrl ? (isPdf ? 'Tap to open PDF' : 'Tap to view') : 'Not uploaded'}
      </Text>
    </TouchableOpacity>
  );
}

type Props = {
  visible: boolean;
  request: ContractorSignupRequest | null;
  loading?: boolean;
  actioning?: boolean;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onSuspend?: () => void;
  onDeactivate?: () => void;
  onActivate?: () => void;
  onDelete?: () => void;
  /** Approve/reject sheets rendered inside this modal (stacked RN Modals often do not show). */
  overlay?: React.ReactNode;
};

const ContractorSignupDetailModal: React.FC<Props> = ({
  visible,
  request,
  loading,
  actioning,
  onClose,
  onApprove,
  onReject,
  onSuspend,
  onActivate,
  onDelete,
  overlay,
}) => {
  const insets = useSafeAreaInsets();
  const status = request?.status;
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  const openPreview = useCallback((url: string, title: string) => {
    setPreview({ url, title });
  }, []);

  const closePreview = useCallback(() => setPreview(null), []);

  useEffect(() => {
    if (!visible) setPreview(null);
  }, [visible, request?.id]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contractor application</Text>
          <View style={styles.closeBtn} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : !request ? (
          <View style={styles.center}>
            <Text style={styles.empty}>No application selected.</Text>
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <View style={styles.statusBanner}>
                <Text style={styles.companyName}>{request.company_name}</Text>
                <View style={styles.statusPillWrap}>
                  <Text style={styles.statusPillText}>{request.status_label || request.status}</Text>
                </View>
                <Text style={styles.submitted}>Submitted {formatDate(request.created_at)}</Text>
              </View>

              <Section title="Personal">
                <Row label="Full name" value={request.name} />
                <Row label="Email" value={request.email} />
                <Row label="Phone" value={request.phone} />
              </Section>

              <Section title="Company">
                <Row label="Trade license" value={request.trade_license_number} />
                <Row label="Expiry" value={request.trade_license_expiry_date} />
                <Row label="TRN" value={request.trn} />
                <Row label="Emirate" value={request.company_emirate} />
                <Row label="City" value={request.city} />
                <Row label="Address" value={request.company_address} />
                <Text style={styles.docSectionLabel}>Documents</Text>
                <View style={styles.docRow}>
                  <DocumentTile
                    label="Trade license"
                    fileName={request.trade_license_file_name}
                    url={request.trade_license_file_url}
                    onPreview={openPreview}
                  />
                  <DocumentTile
                    label="VAT certificate"
                    fileName={request.vat_certificate_file_name}
                    url={request.vat_certificate_file_url}
                    onPreview={openPreview}
                  />
                </View>
              </Section>

              <Section title="Bank">
                <Row label="Bank" value={request.bank_name} />
                <Row label="Account holder" value={request.account_holder_name} />
                <Row label="Account number" value={request.bank_account_number} />
                <Row label="IBAN" value={request.iban} />
                <Text style={styles.docSectionLabel}>Confirmation letter</Text>
                <View style={styles.docRow}>
                  <DocumentTile
                    label="Bank letter"
                    fileName={request.bank_confirmation_file_name}
                    url={request.bank_confirmation_file_url}
                    onPreview={openPreview}
                  />
                </View>
              </Section>

              <Section title="Services & coverage">
                <Row label="Main categories" value={request.main_service_categories?.join(', ')} />
                <Row label="Subcategories" value={request.service_subcategories?.join(', ')} />
                <Row label="Services" value={request.selected_services?.join(', ')} />
                <Row label="Emirates" value={request.coverage_emirates?.join(', ')} />
                <Row label="Cities" value={request.coverage_cities?.join(', ')} />
                <Row label="Coverage areas" value={request.service_coverage_areas?.join(', ')} />
              </Section>

              {request.rejection_reason ? (
                <Section title="Rejection reason">
                  <Text style={styles.reasonText}>{request.rejection_reason}</Text>
                </Section>
              ) : null}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
              {status === 'pending' ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={onApprove}
                    disabled={actioning}
                  >
                    <Text style={styles.approveText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={onReject}
                    disabled={actioning}
                  >
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {status === 'active' && onSuspend ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.warnBtn, styles.fullBtn]}
                  onPress={onSuspend}
                  disabled={actioning}
                >
                  <Text style={styles.warnText}>Suspend</Text>
                </TouchableOpacity>
              ) : null}
              {(status === 'inactive' || status === 'suspended') && onActivate ? (
                <TouchableOpacity style={[styles.actionBtn, styles.approveBtn, styles.fullBtn]} onPress={onActivate} disabled={actioning}>
                  <Text style={styles.approveText}>Activate</Text>
                </TouchableOpacity>
              ) : null}
              {onDelete && status !== 'active' ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn, styles.fullBtn]}
                  onPress={onDelete}
                  disabled={actioning}
                >
                  {actioning ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.deleteText}>Delete contractor</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        )}

        {preview ? (
          <View style={[styles.lightbox, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.lightboxHeader}>
              <Text style={styles.lightboxTitle} numberOfLines={1}>
                {preview.title}
              </Text>
              <TouchableOpacity onPress={closePreview} style={styles.lightboxCloseBtn} hitSlop={12}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.lightboxBody}>
              <Image source={{ uri: preview.url }} style={styles.lightboxImage} contentFit="contain" />
            </View>
          </View>
        ) : null}

        {overlay}
      </View>
    </Modal>
  );
};

const docTileWidth = (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.md * 2 - SPACING.sm) / 2;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceLight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: COLORS.textSecondary },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  statusBanner: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  companyName: { fontSize: FONT_SIZES.xl, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  statusPillWrap: {
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.primary + '18',
  },
  statusPillText: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
    fontSize: FONT_SIZES.xs,
  },
  submitted: { marginTop: SPACING.sm, fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  section: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  row: { marginBottom: SPACING.sm },
  rowLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginBottom: 2 },
  rowValue: { fontSize: FONT_SIZES.sm, color: COLORS.text },
  docSectionLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  docRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  docTile: {
    width: docTileWidth,
    minWidth: 120,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  docThumb: {
    width: '100%',
    height: 88,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.background,
  },
  docPlaceholder: {
    width: '100%',
    height: 88,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  docLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  docFileName: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  docTap: {
    fontSize: 10,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: FONT_WEIGHTS.medium,
  },
  docMissing: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  reasonText: { fontSize: FONT_SIZES.sm, color: COLORS.error },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  actionRow: { flexDirection: 'row', gap: SPACING.sm },
  actionBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  fullBtn: { flex: undefined, width: '100%' },
  approveBtn: { backgroundColor: COLORS.success },
  approveText: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold },
  rejectBtn: { backgroundColor: COLORS.error + '14', borderWidth: 1, borderColor: COLORS.error },
  rejectText: { color: COLORS.error, fontWeight: FONT_WEIGHTS.semiBold },
  warnBtn: { backgroundColor: COLORS.warning + '18', borderWidth: 1, borderColor: COLORS.warning },
  warnText: { color: COLORS.warning, fontWeight: FONT_WEIGHTS.semiBold },
  neutralBtn: { backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border },
  neutralText: { color: COLORS.text, fontWeight: FONT_WEIGHTS.semiBold },
  deleteBtn: { backgroundColor: COLORS.error },
  deleteText: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold },
  lightbox: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
    zIndex: 200,
    elevation: 200,
  },
  lightboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  lightboxTitle: {
    flex: 1,
    color: '#fff',
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  lightboxCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  lightboxImage: {
    width: SCREEN_WIDTH - SPACING.lg * 2,
    height: Dimensions.get('window').height * 0.65,
  },
});

export default ContractorSignupDetailModal;
