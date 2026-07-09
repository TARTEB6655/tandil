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
import * as Sharing from 'expo-sharing';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  vendorOrderService,
  VendorOrderDetail,
} from '../../services/vendorOrderService';

const statusSteps = [
  { id: 'pending', name: 'Pending', icon: 'time-outline', color: COLORS.warning },
  { id: 'confirmed', name: 'Confirmed', icon: 'checkmark-circle-outline', color: COLORS.info },
  { id: 'processing', name: 'Processing', icon: 'cog-outline', color: COLORS.primary },
  { id: 'shipped', name: 'Shipped', icon: 'car-outline', color: COLORS.success },
  { id: 'delivered', name: 'Delivered', icon: 'checkmark-done-circle', color: COLORS.success },
];

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

const VendorOrderDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orderId } = route.params || {};

  const [order, setOrder] = useState<VendorOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [shipModalVisible, setShipModalVisible] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shipNote, setShipNote] = useState('Dispatched via courier');

  const orderStatus = order?.status ?? 'pending';

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const data = await vendorOrderService.getOrder(orderId);
      setOrder(data);
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load order.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [loadOrder])
  );

  const firstItem = order?.items?.[0];
  const notesText =
    order?.notes?.map((n) => n.note).filter(Boolean).join('\n\n') || '';

  const handleStatusUpdate = (newStatus: string) => {
    if (!order) return;
    if (newStatus === orderStatus) return;

    if (newStatus === 'confirmed' && orderStatus === 'pending') {
      Alert.alert('Update Status', 'Confirm this order?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setActionLoading(true);
            try {
              const updated = await vendorOrderService.updateOrderStatus(orderId, {
                status: 'confirmed',
                note: 'Order accepted',
              });
              setOrder(updated);
              Alert.alert('Success', 'Order status updated to confirmed');
            } catch (error: unknown) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update order.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]);
      return;
    }

    if (newStatus === 'shipped' && (orderStatus === 'confirmed' || orderStatus === 'processing')) {
      setShipModalVisible(true);
      return;
    }

    if (newStatus === 'delivered' && orderStatus === 'shipped') {
      Alert.alert('Update Status', 'Mark this order as delivered?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            setActionLoading(true);
            try {
              const updated = await vendorOrderService.updateOrderStatus(orderId, {
                status: 'delivered',
                note: 'Delivered to customer',
              });
              setOrder(updated);
              Alert.alert('Success', 'Order status updated to delivered');
            } catch (error: unknown) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update order.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]);
      return;
    }

    Alert.alert('Update Status', 'This status change is not allowed for the current order.');
  };

  const handleShip = async () => {
    if (!trackingNumber.trim()) {
      Alert.alert('Tracking required', 'Please enter a tracking number.');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await vendorOrderService.updateOrderStatus(orderId, {
        status: 'shipped',
        note: shipNote.trim() || 'Dispatched via courier',
        tracking_number: trackingNumber.trim(),
      });
      setOrder(updated);
      setShipModalVisible(false);
      setTrackingNumber('');
      Alert.alert('Success', 'Order status updated to shipped');
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to ship order.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleContactCustomer = () => {
    if (order?.can_contact_customer) {
      navigation.navigate('OrderContact', { orderId });
      return;
    }
    Alert.alert('Contact Customer', 'Contact details are not available for this order.');
  };

  const handlePrintInvoice = async () => {
    if (!order?.can_print_invoice) {
      Alert.alert('Print Invoice', 'Invoice is not available for this order.');
      return;
    }
    setActionLoading(true);
    try {
      const uri = await vendorOrderService.downloadInvoicePdf(orderId);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Print Invoice',
        });
      } else {
        await Linking.openURL(uri);
      }
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load invoice.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadOrder = async () => {
    if (!order?.can_download_order) {
      Alert.alert('Download', 'Download is not available for this order.');
      return;
    }
    setActionLoading(true);
    try {
      const uri = await vendorOrderService.downloadOrderPdf(orderId);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Download Order',
        });
      } else {
        await Linking.openURL(uri);
      }
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to download order.');
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatusStep = (step: (typeof statusSteps)[0], index: number) => {
    const isActive = orderStatus === step.id;
    const currentIndex = statusSteps.findIndex((s) => s.id === orderStatus);
    const isCompleted = currentIndex >= index;

    return (
      <View key={step.id} style={styles.statusStep}>
        <View
          style={[
            styles.statusIcon,
            isActive && { backgroundColor: step.color + '20' },
            isCompleted && { backgroundColor: step.color + '20' },
          ]}
        >
          <Ionicons
            name={step.icon as any}
            size={20}
            color={isActive || isCompleted ? step.color : COLORS.textSecondary}
          />
        </View>
        <View style={styles.statusInfo}>
          <Text
            style={[
              styles.statusName,
              isActive && { color: step.color },
              isCompleted && { color: step.color },
            ]}
          >
            {step.name}
          </Text>
          {isActive && (
            <Text style={[styles.statusActive, { color: step.color }]}>Current Status</Text>
          )}
        </View>
        {index < statusSteps.length - 1 && (
          <View style={[styles.statusLine, isCompleted && { backgroundColor: step.color }]} />
        )}
      </View>
    );
  };

  const renderInfoRow = (label: string, value: string, icon?: string) => (
    <View style={styles.infoRow}>
      <View style={styles.infoLabel}>
        {icon && <Ionicons name={icon as any} size={16} color={COLORS.textSecondary} />}
        <Text style={styles.infoLabelText}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Order Details</Text>
          <View style={styles.moreButton} />
        </View>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Order Details</Text>
          <View style={styles.moreButton} />
        </View>
        <View style={styles.loadingState}>
          <Text style={styles.emptyText}>Order not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Order Details</Text>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => Alert.alert('More Options', 'Additional order actions coming soon!')}
        >
          <Ionicons name="ellipsis-vertical" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Status</Text>
          <View style={styles.statusContainer}>{statusSteps.map(renderStatusStep)}</View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <View style={styles.orderInfoContainer}>
            {renderInfoRow('Order ID', order.order_number, 'receipt-outline')}
            {renderInfoRow('Order Date', formatDateTime(order.order_date), 'calendar-outline')}
            {renderInfoRow('Delivery Date', formatDate(order.delivery_date), 'calendar-outline')}
            {renderInfoRow(
              'Total Amount',
              order.total_amount > 0 ? `AED ${order.total_amount.toFixed(2)}` : 'FREE',
              'cash-outline'
            )}
            {renderInfoRow('Tracking Number', order.tracking_number || '—', 'location-outline')}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Information</Text>
          <View style={styles.productCard}>
            {firstItem?.product_image ? (
              <Image source={{ uri: firstItem.product_image }} style={styles.productImage} />
            ) : (
              <View style={[styles.productImage, styles.productImagePlaceholder]}>
                <Ionicons name="cube-outline" size={28} color={COLORS.primary} />
              </View>
            )}
            <View style={styles.productInfo}>
              <Text style={styles.productName}>
                {firstItem?.product_name || order.product_name || 'Product'}
              </Text>
              <Text style={styles.productQuantity}>
                Quantity: {firstItem?.quantity ?? order.quantity ?? 1}
              </Text>
              <Text style={styles.productPrice}>
                {order.total_amount > 0
                  ? `AED ${(firstItem?.total ?? order.total_amount).toFixed(2)}`
                  : 'FREE PRODUCT'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.customerInfoContainer}>
            {renderInfoRow('Name', order.customer_name, 'person-outline')}
            {renderInfoRow('Phone', order.customer_phone || '—', 'call-outline')}
            {renderInfoRow('Email', order.customer_email || '—', 'mail-outline')}
            {renderInfoRow('Address', order.customer_address || '—', 'location-outline')}
          </View>
        </View>

        {notesText ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Notes</Text>
            <View style={styles.notesContainer}>
              <Text style={styles.notesText}>{notesText}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.actionsSection}>
          {(order.can_contact_customer ?? true) && (
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton]}
              onPress={handleContactCustomer}
              disabled={actionLoading}
            >
              <Ionicons name="call-outline" size={24} color={COLORS.background} />
              <Text style={styles.primaryButtonText}>Contact Customer</Text>
            </TouchableOpacity>
          )}

          {(order.can_print_invoice ?? true) && (
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={handlePrintInvoice}
              disabled={actionLoading}
            >
              <Ionicons name="print-outline" size={24} color={COLORS.primary} />
              <Text style={styles.secondaryButtonText}>Print Invoice</Text>
            </TouchableOpacity>
          )}

          {(order.can_download_order ?? true) && (
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={handleDownloadOrder}
              disabled={actionLoading}
            >
              <Ionicons name="download-outline" size={24} color={COLORS.primary} />
              <Text style={styles.secondaryButtonText}>Download Order</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Update Order Status</Text>
          <View style={styles.statusUpdateGrid}>
            {statusSteps.map((step) => (
              <TouchableOpacity
                key={step.id}
                style={[
                  styles.statusUpdateButton,
                  orderStatus === step.id && {
                    backgroundColor: step.color + '20',
                    borderColor: step.color,
                  },
                ]}
                onPress={() => handleStatusUpdate(step.id)}
                disabled={actionLoading}
              >
                <Ionicons
                  name={step.icon as any}
                  size={20}
                  color={orderStatus === step.id ? step.color : COLORS.textSecondary}
                />
                <Text
                  style={[
                    styles.statusUpdateText,
                    orderStatus === step.id && { color: step.color },
                  ]}
                >
                  {step.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal visible={shipModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ship Order</Text>
            <Text style={styles.fieldLabel}>Tracking number *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="TRK-2026-0001"
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              autoCapitalize="characters"
            />
            <Text style={styles.fieldLabel}>Note</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Dispatched via courier"
              value={shipNote}
              onChangeText={setShipNote}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShipModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleShip}>
                <Text style={styles.modalConfirmText}>Ship</Text>
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
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  moreButton: {
    padding: SPACING.xs,
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  statusContainer: {
    position: 'relative',
  },
  statusStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    position: 'relative',
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  statusInfo: {
    flex: 1,
  },
  statusName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  statusActive: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
  statusLine: {
    position: 'absolute',
    left: 19,
    top: 40,
    width: 2,
    height: 40,
    backgroundColor: COLORS.border,
  },
  orderInfoContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  infoLabelText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: SPACING.sm,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.md,
  },
  productImagePlaceholder: {
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  productQuantity: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  productPrice: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  customerInfoContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notesContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notesText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  actionsSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  primaryButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  secondaryButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  statusUpdateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statusUpdateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: SPACING.xs,
  },
  statusUpdateText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
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
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
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
    fontWeight: FONT_WEIGHTS.semibold,
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
    fontWeight: FONT_WEIGHTS.semibold,
  },
});

export default VendorOrderDetailScreen;
