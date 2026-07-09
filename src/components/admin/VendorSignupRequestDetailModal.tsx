import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { buildFullImageUrl } from '../../config/api';
import type { VendorSignupRequest } from '../../types/vendorSignup';
import VendorRequestLogo, { resolveVendorLogoUrl } from './VendorRequestLogo';
import { resolveVendorId } from '../../services/adminVendorService';

const SCREEN_WIDTH = Dimensions.get('window').width;

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function resolveDocUrl(raw?: string): string | null {
  if (!raw?.trim()) return null;
  return raw.startsWith('http') ? raw.trim() : buildFullImageUrl(raw.trim());
}

function statusStyle(status: VendorSignupRequest['status']) {
  if (status === 'approved') {
    return { bg: COLORS.success + '18', text: COLORS.success, icon: 'checkmark-circle' as const };
  }
  if (status === 'rejected') {
    return { bg: COLORS.error + '18', text: COLORS.error, icon: 'close-circle' as const };
  }
  return { bg: COLORS.warning + '20', text: COLORS.warning, icon: 'time' as const };
}

function vendorTypeLabel(type: string, label?: string): string {
  if (label?.trim()) return label.trim();
  const labels: Record<string, string> = {
    fruits: 'Fruits',
    vegetables: 'Vegetables',
    poultry: 'Poultry',
    seafood: 'Seafood',
    meat: 'Meat',
    honey: 'Honey',
    nuts: 'Nuts',
    rest: 'Restaurant / Other',
  };
  return labels[type.toLowerCase()] ?? type;
}

function formatCategories(categories?: Array<{ id: number; name: string }>): string | undefined {
  if (!categories?.length) return undefined;
  return categories.map((category) => category.name).join(', ');
}

function formatOperatingHours(request: VendorSignupRequest): string | undefined {
  if (request.operating_hours?.trim()) return request.operating_hours.trim();
  if (request.opens_at && request.closes_at) {
    return `${request.opens_at} – ${request.closes_at}`;
  }
  return request.opens_at || request.closes_at;
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>
          <Ionicons name={icon as any} size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.sectionHeading}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  onPress,
  isLast = false,
}: {
  icon: string;
  label: string;
  value?: string | number | null;
  onPress?: () => void;
  isLast?: boolean;
}) {
  if (value == null || value === '') return null;

  const row = (
    <View style={[styles.detailRow, isLast && styles.detailRowLast]}>
      <View style={styles.detailIconWrap}>
        <Ionicons name={icon as any} size={17} color={COLORS.primary} />
      </View>
      <View style={styles.detailBody}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} selectable>
          {String(value)}
        </Text>
      </View>
      {onPress ? (
        <View style={styles.openLink}>
          <Ionicons name="open-outline" size={16} color={COLORS.primary} />
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        {row}
      </TouchableOpacity>
    );
  }
  return row;
}

function DetailRows({
  rows,
}: {
  rows: Array<{
    icon: string;
    label: string;
    value?: string | number | null;
    onPress?: () => void;
  }>;
}) {
  const visible = rows.filter((r) => r.value != null && r.value !== '');
  return (
    <>
      {visible.map((row, index) => (
        <DetailRow
          key={`${row.label}-${index}`}
          icon={row.icon}
          label={row.label}
          value={row.value}
          onPress={row.onPress}
          isLast={index === visible.length - 1}
        />
      ))}
    </>
  );
}

function DocumentTile({
  label,
  url,
  onOpen,
}: {
  label: string;
  url: string | null;
  onOpen: (url: string) => void;
}) {
  const { t } = useTranslation();
  const isPdf = url?.toLowerCase().includes('.pdf');
  return (
    <TouchableOpacity
      style={styles.docTile}
      disabled={!url}
      onPress={() => url && onOpen(url)}
      activeOpacity={0.85}
    >
      {url && !isPdf ? (
        <Image source={{ uri: url }} style={styles.docImage} contentFit="cover" />
      ) : (
        <View style={styles.docPlaceholder}>
          <Ionicons
            name={isPdf ? 'document-text-outline' : 'image-outline'}
            size={26}
            color={url ? COLORS.primary : COLORS.textSecondary}
          />
        </View>
      )}
      <Text style={styles.docLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={url ? styles.docTap : styles.docMissing}>
        {url ? t('adminVendorRequests.tapToOpen', { defaultValue: 'Tap to open' }) : t('adminVendorRequests.notUploaded', { defaultValue: 'Not uploaded' })}
      </Text>
    </TouchableOpacity>
  );
}

export interface VendorSignupRequestDetailModalProps {
  visible: boolean;
  request: VendorSignupRequest | null;
  loading?: boolean;
  actioningId?: number | string | null;
  onClose: () => void;
  onApprove?: (item: VendorSignupRequest) => void;
  onReject?: (item: VendorSignupRequest) => void;
  onDelete?: (item: VendorSignupRequest) => void;
}

const VendorSignupRequestDetailModal: React.FC<VendorSignupRequestDetailModalProps> = ({
  visible,
  request,
  loading = false,
  actioningId = null,
  onClose,
  onApprove,
  onReject,
  onDelete,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const selectedLogo = useMemo(
    () => resolveVendorLogoUrl(request?.logo_url),
    [request?.logo_url]
  );
  const selectedTradeLicense = useMemo(
    () => resolveDocUrl(request?.trade_license_url),
    [request?.trade_license_url]
  );
  const selectedEmiratesId = useMemo(
    () => resolveDocUrl(request?.emirates_id_url),
    [request?.emirates_id_url]
  );

  const showReviewActions =
    request?.status === 'pending' && onApprove != null && onReject != null;
  const showDeleteAction =
    request != null && request.status !== 'pending' && onDelete != null;
  const isActioning =
    request != null &&
    actioningId != null &&
    String(actioningId) === String(resolveVendorId(request));

  const openDocument = useCallback(
    async (url: string) => {
      try {
        const can = await Linking.canOpenURL(url);
        if (can) await Linking.openURL(url);
        else Alert.alert(t('common.error'), t('adminVendorRequests.cannotOpenDocument'));
      } catch {
        Alert.alert(t('common.error'), t('adminVendorRequests.cannotOpenDocument'));
      }
    },
    [t]
  );

  const openMap = useCallback(
    (location?: string) => {
      if (!location?.trim()) return;
      const trimmed = location.trim();
      const coords = trimmed.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
      const url = coords
        ? `https://www.google.com/maps?q=${coords[1]},${coords[2]}`
        : trimmed.startsWith('http')
          ? trimmed
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
      openDocument(url);
    },
    [openDocument]
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalSafe}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={[styles.modalHeader, { paddingTop: insets.top + SPACING.sm }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle} numberOfLines={1}>
            {t('adminVendorRequests.detailTitle')}
          </Text>
          <View style={styles.headerBtn} />
        </View>

        {!request && loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator style={styles.loader} color={COLORS.primary} />
            <Text style={styles.loaderText}>
              {t('adminVendorRequests.loadingDetail', { defaultValue: 'Loading application details...' })}
            </Text>
          </View>
        ) : request ? (
          <>
            {loading ? (
              <View style={styles.detailLoadingBanner}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.detailLoadingText}>
                  {t('adminVendorRequests.loadingDetail', { defaultValue: 'Loading application details...' })}
                </Text>
              </View>
            ) : null}
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.modalContent,
                (showReviewActions || showDeleteAction) && { paddingBottom: SPACING.lg },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.detailHero}>
                <View style={styles.detailLogoWrap}>
                  <VendorRequestLogo logoUrl={request.logo_url} size={80} />
                </View>
                <Text style={styles.detailCompany}>{request.company_name}</Text>
                <Text style={styles.detailPerson}>{request.authorized_person_name}</Text>
                {(() => {
                  const st = statusStyle(request.status);
                  return (
                    <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                      <Ionicons name={st.icon} size={14} color={st.text} />
                      <Text style={[styles.statusText, { color: st.text }]}>
                        {request.status_label ||
                          t(`adminVendorRequests.status.${request.status}`)}
                      </Text>
                    </View>
                  );
                })()}
                <Text style={styles.detailDate}>
                  {request.submitted_at_formatted ||
                    t('adminVendorRequests.submittedAt', {
                      date: formatDate(request.created_at),
                    })}
                </Text>
                {request.completion_percent != null ? (
                  <Text style={styles.completionText}>
                    {t('adminVendorRequests.completionPercent', {
                      defaultValue: '{{percent}}% complete',
                      percent: request.completion_percent,
                    })}
                  </Text>
                ) : null}
              </View>

              <SectionCard title={t('adminVendorRequests.sectionContact')} icon="mail-outline">
                <DetailRows
                  rows={[
                    { icon: 'mail-outline', label: t('auth.emailLabel'), value: request.email },
                    { icon: 'call-outline', label: t('auth.phoneLabel'), value: request.phone },
                    {
                      icon: 'person-outline',
                      label: t('vendorSignup.authorizedPersonName'),
                      value: request.authorized_person_name,
                    },
                  ]}
                />
              </SectionCard>

              <SectionCard title={t('adminVendorRequests.sectionBusiness')} icon="leaf-outline">
                <DetailRows
                  rows={[
                    {
                      icon: 'leaf-outline',
                      label: t('vendorSignup.vendorType'),
                      value: vendorTypeLabel(request.vendor_type, request.vendor_type_label),
                    },
                    {
                      icon: 'grid-outline',
                      label: t('adminVendorRequests.categories', { defaultValue: 'Categories' }),
                      value: formatCategories(request.categories),
                    },
                    { icon: 'map-outline', label: t('vendorSignup.emirate'), value: request.emirate },
                    { icon: 'business-outline', label: t('vendorSignup.city'), value: request.city },
                    {
                      icon: 'location-outline',
                      label: t('vendorSignup.address'),
                      value: request.address,
                    },
                    {
                      icon: 'navigate-outline',
                      label: t('adminVendorRequests.mapLocation'),
                      value: request.google_maps_location,
                      onPress: request.google_maps_location
                        ? () => openMap(request.google_maps_location)
                        : undefined,
                    },
                    {
                      icon: 'document-text-outline',
                      label: t('vendorSignup.tradeLicenseNumber'),
                      value: request.trade_license_number,
                    },
                    {
                      icon: 'receipt-outline',
                      label: t('vendorSignup.vatNumber'),
                      value: request.vat_number,
                    },
                    {
                      icon: 'document-text-outline',
                      label: t('adminVendorRequests.description', { defaultValue: 'Description' }),
                      value: request.description,
                    },
                  ]}
                />
              </SectionCard>

              <SectionCard title={t('adminVendorRequests.sectionBank')} icon="card-outline">
                <DetailRows
                  rows={[
                    { icon: 'card-outline', label: t('vendorSignup.bankName'), value: request.bank_name },
                    { icon: 'cash-outline', label: t('vendorSignup.iban'), value: request.iban },
                    {
                      icon: 'person-circle-outline',
                      label: t('vendorSignup.accountHolderName'),
                      value: request.account_holder_name,
                    },
                  ]}
                />
              </SectionCard>

              <SectionCard title={t('adminVendorRequests.sectionOperations')} icon="time-outline">
                <DetailRows
                  rows={[
                    {
                      icon: 'bicycle-outline',
                      label: t('vendorSignup.deliveryRadius'),
                      value:
                        request.delivery_radius_km != null
                          ? `${request.delivery_radius_km} km`
                          : undefined,
                    },
                    {
                      icon: 'time-outline',
                      label: t('adminVendorRequests.operatingHours'),
                      value: formatOperatingHours(request),
                    },
                    {
                      icon: 'pricetag-outline',
                      label: t('vendorSignup.minimumOrderAmount'),
                      value:
                        request.minimum_order_amount != null
                          ? `AED ${request.minimum_order_amount}`
                          : undefined,
                    },
                  ]}
                />
              </SectionCard>

              <SectionCard title={t('adminVendorRequests.sectionDocuments')} icon="folder-outline">
                <View style={styles.docRow}>
                  <DocumentTile
                    label={t('vendorSignup.companyLogo')}
                    url={selectedLogo}
                    onOpen={openDocument}
                  />
                  <DocumentTile
                    label={t('vendorSignup.tradeLicenseUpload')}
                    url={selectedTradeLicense}
                    onOpen={openDocument}
                  />
                  <DocumentTile
                    label={t('vendorSignup.emiratesIdUpload')}
                    url={selectedEmiratesId}
                    onOpen={openDocument}
                  />
                </View>
              </SectionCard>
            </ScrollView>

            {showReviewActions || showDeleteAction ? (
              <View
                style={[
                  styles.footer,
                  { paddingBottom: Math.max(insets.bottom, SPACING.md) },
                ]}
              >
                {showDeleteAction ? (
                  <TouchableOpacity
                    style={[styles.footerBtn, styles.deleteBtn]}
                    onPress={() => onDelete!(request)}
                    disabled={isActioning}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                    <Text style={styles.deleteText}>{t('common.delete', { defaultValue: 'Delete' })}</Text>
                  </TouchableOpacity>
                ) : null}
                {showReviewActions ? (
                  <>
                    <TouchableOpacity
                      style={[styles.footerBtn, styles.cancelBtn]}
                      onPress={() => onReject!(request)}
                      disabled={isActioning}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="close" size={20} color={COLORS.error} />
                      <Text style={styles.cancelText}>{t('adminVendorRequests.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.footerBtn, styles.approveBtn]}
                      onPress={() => onApprove!(request)}
                      disabled={isActioning}
                      activeOpacity={0.85}
                    >
                      {isActioning ? (
                        <ActivityIndicator color={COLORS.background} />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={20} color={COLORS.background} />
                          <Text style={styles.approveText}>{t('adminVendorRequests.approve')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalSafe: { flex: 1, backgroundColor: COLORS.surfaceLight },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    paddingHorizontal: SPACING.xs,
  },
  scroll: { flex: 1 },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  loader: { marginTop: 0 },
  loaderText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  detailLoadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.primary + '10',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLoadingText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  modalContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
  },
  detailHero: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  detailLogoWrap: {
    marginBottom: SPACING.md,
  },
  detailCompany: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    textAlign: 'center',
  },
  detailPerson: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
  },
  statusText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold },
  detailDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  completionText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    marginTop: SPACING.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    textAlign: 'center',
  },
  section: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
  },
  sectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  sectionBody: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  detailRowLast: {
    borderBottomWidth: 0,
    paddingBottom: SPACING.md,
  },
  detailIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  detailBody: { flex: 1, minWidth: 0 },
  detailLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
    lineHeight: 22,
  },
  openLink: {
    paddingTop: 4,
  },
  docRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  docTile: {
    width: (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.lg * 2 - SPACING.sm * 2) / 3,
    minWidth: 96,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  docImage: {
    width: '100%',
    height: 68,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
  },
  docPlaceholder: {
    width: '100%',
    height: 68,
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
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    lineHeight: 16,
  },
  docTap: { fontSize: 10, color: COLORS.primary, marginTop: 4 },
  docMissing: { fontSize: 10, color: COLORS.textSecondary, marginTop: 4 },
  footer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    minHeight: 52,
  },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.error,
    backgroundColor: COLORS.error + '08',
  },
  deleteBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.error,
    backgroundColor: COLORS.background,
  },
  cancelText: {
    color: COLORS.error,
    fontWeight: FONT_WEIGHTS.bold,
    fontSize: FONT_SIZES.sm,
  },
  deleteText: {
    color: COLORS.error,
    fontWeight: FONT_WEIGHTS.bold,
    fontSize: FONT_SIZES.sm,
  },
  approveBtn: { backgroundColor: COLORS.primary },
  approveText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.bold,
    fontSize: FONT_SIZES.sm,
  },
});

export default VendorSignupRequestDetailModal;
