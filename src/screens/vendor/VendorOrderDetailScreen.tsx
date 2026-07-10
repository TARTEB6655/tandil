import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Sharing from 'expo-sharing';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  VENDOR_SCREEN_BG,
  VendorPageHeader,
  VendorCard,
} from '../../components/vendor/VendorUi';
import {
  vendorOrderService,
  VendorOrderDetail,
} from '../../services/vendorOrderService';

const STATUS_STEP_META = [
  { id: 'pending', icon: 'time', color: COLORS.warning },
  { id: 'confirmed', icon: 'checkmark-circle', color: COLORS.info },
  { id: 'processing', icon: 'cog', color: COLORS.primary },
  { id: 'shipped', icon: 'car', color: COLORS.success },
  { id: 'delivered', icon: 'checkmark-done-circle', color: COLORS.success },
] as const;

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusColor(status: string): string {
  const step = STATUS_STEP_META.find((s) => s.id === status);
  return step?.color ?? COLORS.textSecondary;
}

const VendorOrderDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const { orderId } = route.params || {};

  const [order, setOrder] = useState<VendorOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [shipModalVisible, setShipModalVisible] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shipNote, setShipNote] = useState('');

  const statusSteps = STATUS_STEP_META.map((step) => ({
    ...step,
    name: t(`vendorOrders.${step.id}`),
  }));

  const orderStatus = order?.status ?? 'pending';
  const currentIndex = statusSteps.findIndex((s) => s.id === orderStatus);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const data = await vendorOrderService.getOrder(orderId);
      setOrder(data);
    } catch (error: unknown) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('vendorOrders.loadFailed')
      );
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [loadOrder])
  );

  const firstItem = order?.items?.[0];
  const notesText = order?.notes?.map((n) => n.note).filter(Boolean).join('\n\n') || '';

  const handleStatusUpdate = (newStatus: string) => {
    if (!order) return;
    if (newStatus === orderStatus) return;

    if (newStatus === 'confirmed' && orderStatus === 'pending') {
      Alert.alert(t('vendorOrders.updateStatusTitle'), t('vendorOrders.confirmThisOrder'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('vendorOrders.confirm'),
          onPress: async () => {
            setActionLoading(true);
            try {
              const updated = await vendorOrderService.updateOrderStatus(orderId, {
                status: 'confirmed',
                note: t('vendorOrders.noteAccepted'),
              });
              setOrder(updated);
              Alert.alert(t('common.success'), t('vendorOrders.orderConfirmed'));
            } catch (error: unknown) {
              Alert.alert(
                t('common.error'),
                error instanceof Error ? error.message : t('vendorOrders.deliverFailed')
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]);
      return;
    }

    if (newStatus === 'shipped' && (orderStatus === 'confirmed' || orderStatus === 'processing')) {
      setShipNote(t('vendorOrders.noteDefault'));
      setShipModalVisible(true);
      return;
    }

    if (newStatus === 'delivered' && orderStatus === 'shipped') {
      Alert.alert(t('vendorOrders.updateStatusTitle'), t('vendorOrders.markDeliveredConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('vendorOrders.update'),
          onPress: async () => {
            setActionLoading(true);
            try {
              const updated = await vendorOrderService.updateOrderStatus(orderId, {
                status: 'delivered',
                note: t('vendorOrders.noteDelivered'),
              });
              setOrder(updated);
              Alert.alert(t('common.success'), t('vendorOrders.orderDelivered'));
            } catch (error: unknown) {
              Alert.alert(
                t('common.error'),
                error instanceof Error ? error.message : t('vendorOrders.deliverFailed')
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]);
      return;
    }

    Alert.alert(t('vendorOrders.updateStatusTitle'), t('vendorOrders.statusNotAllowed'));
  };

  const handleShip = async () => {
    if (!trackingNumber.trim()) {
      Alert.alert(t('vendorOrders.trackingRequired'), t('vendorOrders.trackingRequiredMessage'));
      return;
    }
    setActionLoading(true);
    try {
      const updated = await vendorOrderService.updateOrderStatus(orderId, {
        status: 'shipped',
        note: shipNote.trim() || t('vendorOrders.noteDefault'),
        tracking_number: trackingNumber.trim(),
      });
      setOrder(updated);
      setShipModalVisible(false);
      setTrackingNumber('');
      Alert.alert(t('common.success'), t('vendorOrders.orderShipped'));
    } catch (error: unknown) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('vendorOrders.shipFailed')
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleContactCustomer = () => {
    if (order?.can_contact_customer) {
      navigation.navigate('OrderContact', { orderId });
      return;
    }
    Alert.alert(t('vendorOrders.contactCustomer'), t('vendorOrders.contactUnavailable'));
  };

  const handlePrintInvoice = async () => {
    if (!order?.can_print_invoice) {
      Alert.alert(t('vendorOrders.printInvoice'), t('vendorOrders.invoiceUnavailable'));
      return;
    }
    setActionLoading(true);
    try {
      const uri = await vendorOrderService.downloadInvoicePdf(orderId);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: t('vendorOrders.printInvoice'),
        });
      } else {
        await Linking.openURL(uri);
      }
    } catch (error: unknown) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('vendorOrders.invoiceFailed')
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadOrder = async () => {
    if (!order?.can_download_order) {
      Alert.alert(t('vendorOrders.download'), t('vendorOrders.downloadUnavailable'));
      return;
    }
    setActionLoading(true);
    try {
      const uri = await vendorOrderService.downloadOrderPdf(orderId);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: t('vendorOrders.downloadOrder'),
        });
      } else {
        await Linking.openURL(uri);
      }
    } catch (error: unknown) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('vendorOrders.downloadFailed')
      );
    } finally {
      setActionLoading(false);
    }
  };

  const renderInfoRow = (label: string, value: string, icon: string) => (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <View style={styles.infoIcon}>
          <Ionicons name={icon as any} size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <VendorPageHeader title={t('vendorOrders.detailTitle')} onBack={() => navigation.goBack()} />
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <VendorPageHeader title={t('vendorOrders.detailTitle')} onBack={() => navigation.goBack()} />
        <View style={styles.loadingState}>
          <Text style={styles.emptyText}>{t('vendorOrders.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const color = statusColor(orderStatus);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <VendorPageHeader
        title={t('vendorOrders.detailTitle')}
        subtitle={order.order_number}
        onBack={() => navigation.goBack()}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <VendorCard style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroOrderId}>{order.order_number}</Text>
              <Text style={styles.heroDate}>{formatDateTime(order.order_date)}</Text>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: color + '18' }]}>
              <Ionicons
                name={(statusSteps.find((s) => s.id === orderStatus)?.icon || 'help-circle') as any}
                size={14}
                color={color}
              />
              <Text style={[styles.heroBadgeText, { color }]}>
                {statusSteps.find((s) => s.id === orderStatus)?.name || orderStatus}
              </Text>
            </View>
          </View>
          <Text style={styles.heroAmount}>
            {order.total_amount > 0
              ? `AED ${order.total_amount.toFixed(2)}`
              : t('vendorOrders.free')}
          </Text>
        </VendorCard>

        <Text style={styles.sectionLabel}>{t('vendorOrders.orderProgress')}</Text>
        <VendorCard style={styles.timelineCard}>
          <View style={styles.timelineRow}>
            {statusSteps.map((step, index) => {
              const done = currentIndex >= index;
              const active = orderStatus === step.id;
              return (
                <View key={step.id} style={styles.timelineItem}>
                  <View
                    style={[
                      styles.timelineDot,
                      done && { backgroundColor: step.color, borderColor: step.color },
                      active && { transform: [{ scale: 1.15 }] },
                    ]}
                  >
                    <Ionicons
                      name={step.icon as any}
                      size={14}
                      color={done ? '#fff' : COLORS.textSecondary}
                    />
                  </View>
                  <Text
                    style={[styles.timelineLabel, done && { color: step.color, fontWeight: FONT_WEIGHTS.semiBold }]}
                    numberOfLines={1}
                  >
                    {step.name}
                  </Text>
                  {index < statusSteps.length - 1 ? (
                    <View
                      style={[
                        styles.timelineConnector,
                        currentIndex > index && { backgroundColor: step.color },
                      ]}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </VendorCard>

        <Text style={styles.sectionLabel}>{t('vendorOrders.product')}</Text>
        <VendorCard>
          <View style={styles.productRow}>
            {firstItem?.product_image || order.product_image ? (
              <Image
                source={{ uri: firstItem?.product_image || order.product_image }}
                style={styles.productImage}
              />
            ) : (
              <View style={[styles.productImage, styles.productFallback]}>
                <Ionicons name="cube" size={28} color={COLORS.primary} />
              </View>
            )}
            <View style={styles.productMeta}>
              <Text style={styles.productName}>
                {firstItem?.product_name || order.product_name || t('vendorOrders.product')}
              </Text>
              <Text style={styles.productQty}>
                {t('vendorOrders.qtyValue', {
                  count: firstItem?.quantity ?? order.quantity ?? 1,
                })}
              </Text>
              <Text style={styles.productPrice}>
                {order.total_amount > 0
                  ? `AED ${(firstItem?.total ?? order.total_amount).toFixed(2)}`
                  : t('vendorOrders.freeProduct')}
              </Text>
            </View>
          </View>
        </VendorCard>

        <Text style={styles.sectionLabel}>{t('vendorOrders.orderInfo')}</Text>
        <VendorCard style={styles.infoCard}>
          {renderInfoRow(t('vendorOrders.orderDate'), formatDateTime(order.order_date), 'calendar-outline')}
          {renderInfoRow(t('vendorOrders.deliveryDate'), formatDate(order.delivery_date), 'bicycle-outline')}
          {renderInfoRow(t('vendorOrders.tracking'), order.tracking_number || '—', 'navigate-outline')}
        </VendorCard>

        <Text style={styles.sectionLabel}>{t('vendorOrders.customer')}</Text>
        <VendorCard style={styles.infoCard}>
          <View style={styles.customerHeader}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerInitial}>
                {(order.customer_name || 'C').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.customerName}>{order.customer_name}</Text>
              <Text style={styles.customerSub}>
                {order.customer_phone || t('vendorOrders.noPhone')}
              </Text>
            </View>
          </View>
          {renderInfoRow(t('vendorOrders.email'), order.customer_email || '—', 'mail-outline')}
          {renderInfoRow(t('vendorOrders.address'), order.customer_address || '—', 'location-outline')}
        </VendorCard>

        {notesText ? (
          <>
            <Text style={styles.sectionLabel}>{t('vendorOrders.notes')}</Text>
            <VendorCard>
              <Text style={styles.notesText}>{notesText}</Text>
            </VendorCard>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>{t('vendorOrders.actions')}</Text>
        <View style={styles.actionsWrap}>
          {(order.can_contact_customer ?? true) && (
            <TouchableOpacity
              style={styles.actionPrimary}
              onPress={handleContactCustomer}
              disabled={actionLoading}
            >
              <Ionicons name="call" size={20} color="#fff" />
              <Text style={styles.actionPrimaryText}>{t('vendorOrders.contactCustomer')}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.actionSecondaryRow}>
            {(order.can_print_invoice ?? true) && (
              <TouchableOpacity
                style={styles.actionSecondary}
                onPress={handlePrintInvoice}
                disabled={actionLoading}
              >
                <Ionicons name="print-outline" size={20} color={COLORS.primary} />
                <Text style={styles.actionSecondaryText}>{t('vendorOrders.invoice')}</Text>
              </TouchableOpacity>
            )}
            {(order.can_download_order ?? true) && (
              <TouchableOpacity
                style={styles.actionSecondary}
                onPress={handleDownloadOrder}
                disabled={actionLoading}
              >
                <Ionicons name="download-outline" size={20} color={COLORS.primary} />
                <Text style={styles.actionSecondaryText}>{t('vendorOrders.download')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t('vendorOrders.updateStatus')}</Text>
        <VendorCard>
          <View style={styles.statusGrid}>
            {statusSteps.map((step) => {
              const active = orderStatus === step.id;
              return (
                <TouchableOpacity
                  key={step.id}
                  style={[
                    styles.statusChip,
                    active && { backgroundColor: step.color + '18', borderColor: step.color },
                  ]}
                  onPress={() => handleStatusUpdate(step.id)}
                  disabled={actionLoading}
                >
                  <Ionicons
                    name={step.icon as any}
                    size={16}
                    color={active ? step.color : COLORS.textSecondary}
                  />
                  <Text style={[styles.statusChipText, active && { color: step.color }]}>
                    {step.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </VendorCard>
      </ScrollView>

      <Modal visible={shipModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('vendorOrders.shipOrder')}</Text>
            <Text style={styles.fieldLabel}>{t('vendorOrders.trackingNumber')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('vendorOrders.trackingPlaceholder')}
              placeholderTextColor={COLORS.textSecondary}
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              autoCapitalize="characters"
            />
            <Text style={styles.fieldLabel}>{t('vendorOrders.note')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('vendorOrders.noteDefault')}
              placeholderTextColor={COLORS.textSecondary}
              value={shipNote}
              onChangeText={setShipNote}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShipModalVisible(false)}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleShip}>
                <Text style={styles.modalConfirmText}>{t('vendorOrders.ship')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VENDOR_SCREEN_BG,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },
  heroCard: {
    marginTop: SPACING.md,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  heroOrderId: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  heroDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
  },
  heroBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  heroAmount: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  sectionLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  timelineCard: {
    paddingVertical: SPACING.md,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    zIndex: 2,
  },
  timelineLabel: {
    fontSize: 9,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  timelineConnector: {
    position: 'absolute',
    top: 13,
    left: '55%',
    right: '-45%',
    height: 2,
    backgroundColor: COLORS.border,
    zIndex: 1,
  },
  productRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
  },
  productFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '14',
  },
  productMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  productQty: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  productPrice: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    marginTop: 6,
  },
  infoCard: {
    paddingVertical: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    maxWidth: '48%',
    textAlign: 'right',
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerInitial: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  customerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  customerSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  notesText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  actionsWrap: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  actionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.lg,
  },
  actionPrimaryText: {
    color: '#fff',
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  actionSecondaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.lg,
  },
  actionSecondaryText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
  },
  statusChipText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceLight,
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: {
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default VendorOrderDetailScreen;
