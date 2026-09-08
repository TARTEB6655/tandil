import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { adminService, type ShopOrderDetail } from '../../services/adminService';
import { buildFullImageUrl } from '../../config/api';

function money(value: unknown, currency = 'AED'): string {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${currency} ${n.toFixed(2)}`;
}

function formatDateTime(value?: string | null, locale = 'en-US'): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusColor(status?: string): string {
  const s = String(status || '').toLowerCase();
  if (s.includes('pending') || s.includes('new')) return COLORS.warning;
  if (s.includes('process') || s.includes('confirm') || s.includes('assign')) return COLORS.info;
  if (s.includes('ship')) return COLORS.primary;
  if (s.includes('deliver') || s.includes('complete')) return COLORS.success;
  if (s.includes('cancel') || s.includes('fail') || s.includes('refund')) return COLORS.error;
  return COLORS.textSecondary;
}

const AdminOrderDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t, i18n } = useTranslation();
  const orderId = route.params?.orderId;
  const locale =
    i18n.language === 'ar' ? 'ar-EG' : i18n.language === 'ur' ? 'ur-PK' : 'en-US';

  const [order, setOrder] = useState<ShopOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (orderId == null || orderId === '') {
        setError(t('admin.orderDetail.invalid', { defaultValue: 'Invalid order.' }));
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await adminService.getShopOrderDetail(orderId);
        setOrder(data);
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (e as Error)?.message ||
          t('admin.orderDetail.loadFailed', { defaultValue: 'Could not load order detail.' });
        setError(msg);
        setOrder(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId, t]
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load])
  );

  const handleDelete = () => {
    if (!order?.id) return;
    const label = `#${order.order_number || order.id}`;
    Alert.alert(
      t('admin.orderStatistics.deleteTitle', { defaultValue: 'Delete order' }),
      t('admin.orderStatistics.deleteConfirm', {
        defaultValue: 'Delete order {{order}}? This cannot be undone.',
        order: label,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeleting(true);
              try {
                const res = await adminService.bulkDeleteOrders([order.id]);
                Alert.alert(
                  t('common.success', { defaultValue: 'Success' }),
                  res.message ||
                    t('admin.orderStatistics.deleteSuccess', {
                      defaultValue: 'Order deleted.',
                    }),
                  [{ text: t('common.ok', { defaultValue: 'OK' }), onPress: () => navigation.goBack() }]
                );
              } catch (e: unknown) {
                const msg =
                  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                  (e as Error)?.message ||
                  t('admin.orderStatistics.deleteFailed', {
                    defaultValue: 'Could not delete order.',
                  });
                Alert.alert(t('common.error', { defaultValue: 'Error' }), msg);
              } finally {
                setDeleting(false);
              }
            })();
          },
        },
      ]
    );
  };

  const orderStatus = order?.order_status || order?.status || '—';
  const color = statusColor(orderStatus);
  const customerName =
    order?.user?.name || order?.customer?.name || t('admin.orderStatistics.guest', { defaultValue: 'Guest' });
  const customerEmail = order?.user?.email || order?.customer?.email || '—';
  const customerPhone =
    order?.shipping_address?.phone_number ||
    (order as { user?: { phone?: string } })?.user?.phone ||
    '—';
  const items = Array.isArray(order?.items) ? order!.items! : [];
  const address = order?.shipping_address;
  const addressLine = address
    ? [
        address.street_address,
        address.city,
        address.state,
        address.zip_code,
        address.country,
      ]
        .filter(Boolean)
        .join(', ')
    : '—';

  const total = order?.total_amount ?? order?.total;

  const customerInitial = customerName.charAt(0).toUpperCase();

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerDecor} />
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEyebrow}>
            {t('admin.orderDetail.eyebrow', { defaultValue: 'Order' })}
          </Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            #{order?.order_number || order?.id || '—'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.headerDeleteBtn, (!order || deleting) && { opacity: 0.5 }]}
          disabled={!order || deleting}
          onPress={handleDelete}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="trash-outline" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {error && !order ? (
        <View style={styles.errorState}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load(false)}>
            <Text style={styles.retryText}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={COLORS.primary}
            />
          }
        >
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>
                  {t('admin.orderDetail.totalPaid', { defaultValue: 'Order total' })}
                </Text>
                <Text style={styles.heroTotal}>{money(total)}</Text>
                <Text style={styles.heroDate}>{formatDateTime(order?.created_at, locale)}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: color + '22' }]}>
                <View style={[styles.statusDot, { backgroundColor: color }]} />
                <Text style={[styles.statusPillText, { color }]}>{orderStatus}</Text>
              </View>
            </View>
            {(order?.booking_date || order?.booking_slot) && (
              <View style={styles.heroMetaRow}>
                <Ionicons name="calendar" size={14} color="rgba(255,255,255,0.85)" />
                <Text style={styles.heroMetaText}>
                  {[order?.booking_date, order?.booking_slot].filter(Boolean).join(' · ')}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="person" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>
                {t('admin.orderDetail.customer', { defaultValue: 'Customer' })}
              </Text>
            </View>
            <View style={styles.customerBanner}>
              <View style={[styles.customerAvatar, { backgroundColor: color + '22' }]}>
                <Text style={[styles.customerAvatarText, { color }]}>{customerInitial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{customerName}</Text>
                <Text style={styles.customerSub}>{customerEmail}</Text>
              </View>
            </View>
            <InfoRow
              icon="call-outline"
              label={t('admin.orderDetail.phone', { defaultValue: 'Phone' })}
              value={customerPhone}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="card" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>
                {t('admin.orderDetail.payment', { defaultValue: 'Payment' })}
              </Text>
            </View>
            <View style={styles.chipRow}>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipLabel}>
                  {t('admin.orderDetail.paymentMethod', { defaultValue: 'Method' })}
                </Text>
                <Text style={styles.metaChipValue}>{order?.payment_method || '—'}</Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipLabel}>
                  {t('admin.orderDetail.paymentStatus', { defaultValue: 'Status' })}
                </Text>
                <Text style={styles.metaChipValue}>{order?.payment_status || '—'}</Text>
              </View>
              {order?.fulfillment_type ? (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipLabel}>
                    {t('admin.orderDetail.fulfillment', { defaultValue: 'Fulfillment' })}
                  </Text>
                  <Text style={styles.metaChipValue}>{order.fulfillment_type}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="location" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>
                {t('admin.orderDetail.shipping', { defaultValue: 'Shipping address' })}
              </Text>
            </View>
            {address?.full_name ? (
              <Text style={styles.addressName}>{address.full_name}</Text>
            ) : null}
            <Text style={styles.addressText}>{addressLine}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="bag-handle" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>
                {t('admin.orderDetail.items', { defaultValue: 'Items' })}
              </Text>
            </View>
            {items.length === 0 ? (
              <Text style={styles.emptyItems}>
                {t('admin.orderDetail.noItems', { defaultValue: 'No line items.' })}
              </Text>
            ) : (
              items.map((item, index) => {
                const imgRaw = item.product?.image_url || item.product?.image;
                const img =
                  imgRaw &&
                  (String(imgRaw).startsWith('http')
                    ? String(imgRaw)
                    : buildFullImageUrl(String(imgRaw)));
                return (
                  <View
                    key={`item-${item.id ?? index}`}
                    style={[styles.itemRow, index > 0 && styles.itemRowBorder]}
                  >
                    {img ? (
                      <Image source={{ uri: img }} style={styles.itemThumb} />
                    ) : (
                      <View style={[styles.itemThumb, styles.itemThumbFallback]}>
                        <Ionicons name="cube-outline" size={20} color={COLORS.primary} />
                      </View>
                    )}
                    <View style={styles.itemMeta}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.product?.name || `Product #${item.product_id ?? '—'}`}
                      </Text>
                      <Text style={styles.itemQty}>
                        {t('admin.orderDetail.qty', {
                          defaultValue: 'Qty {{count}}',
                          count: item.quantity ?? 1,
                        })}
                      </Text>
                      {item.area_m2 != null && Number(item.area_m2) > 0 ? (
                        <>
                          <Text style={styles.itemQty}>
                            {t('orders.areaValue', {
                              defaultValue: 'Area: {{area}} m²',
                              area: item.area_m2,
                            })}
                          </Text>
                          {(item.unit_price != null || item.price_per_m2 != null) ? (
                            <Text style={styles.itemQty}>
                              {t('orders.unitPriceValue', {
                                defaultValue: 'Unit price: AED {{price}}/m²',
                                price: Number(item.unit_price ?? item.price_per_m2).toFixed(2),
                              })}
                            </Text>
                          ) : null}
                        </>
                      ) : null}
                    </View>
                    <Text style={styles.itemPrice}>{money(item.subtotal ?? item.price)}</Text>
                  </View>
                );
              })
            )}
          </View>

          <View style={[styles.card, styles.totalsCard]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="calculator" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>
                {t('admin.orderDetail.totals', { defaultValue: 'Totals' })}
              </Text>
            </View>
            <TotalRow
              label={t('admin.orderDetail.subtotal', { defaultValue: 'Subtotal' })}
              value={money(order?.subtotal_amount)}
            />
            <TotalRow
              label={t('admin.orderDetail.shippingFee', { defaultValue: 'Shipping' })}
              value={money(order?.shipping_amount)}
            />
            <TotalRow
              label={t('admin.orderDetail.tax', { defaultValue: 'Tax' })}
              value={money(order?.tax_amount)}
            />
            {order?.wallet_amount_applied != null && Number(order.wallet_amount_applied) > 0 ? (
              <TotalRow
                label={t('admin.orderDetail.wallet', { defaultValue: 'Wallet' })}
                value={`- ${money(order.wallet_amount_applied)}`}
              />
            ) : null}
            <View style={styles.totalDivider} />
            <TotalRow
              label={t('admin.orderDetail.total', { defaultValue: 'Total' })}
              value={money(total)}
              bold
            />
          </View>

          {order?.special_instructions ? (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons name="chatbubble-ellipses" size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.sectionTitle}>
                  {t('admin.orderDetail.notes', { defaultValue: 'Notes' })}
                </Text>
              </View>
              <Text style={styles.addressText}>{order.special_instructions}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
};

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={16} color={COLORS.primary} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function TotalRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, bold && styles.totalBold]}>{label}</Text>
      <Text style={[styles.totalValue, bold && styles.totalValueBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute',
    top: -36,
    right: -24,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerEyebrow: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: FONT_WEIGHTS.medium,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
  },
  headerSpacer: { width: 40 },
  headerDeleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(209,67,67,0.35)',
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
    gap: SPACING.md,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
  },
  retryText: {
    color: '#fff',
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    padding: SPACING.lg,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroLabel: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 4,
  },
  heroTotal: {
    fontSize: 28,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
  },
  heroDate: {
    marginTop: 6,
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    textTransform: 'capitalize',
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  totalsCard: {
    borderColor: COLORS.primary + '33',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  sectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  customerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceLight,
  },
  customerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
  },
  customerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  customerSub: {
    marginTop: 2,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  metaChip: {
    minWidth: '30%',
    flexGrow: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  metaChipLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  metaChipValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  infoIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  infoText: { flex: 1 },
  infoLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    marginTop: 2,
    fontWeight: FONT_WEIGHTS.medium,
  },
  addressName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: 4,
  },
  addressText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  emptyItems: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  itemRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  itemThumb: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceLight,
  },
  itemThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary + '14',
  },
  itemMeta: { flex: 1, minWidth: 0 },
  itemName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  itemQty: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  itemPrice: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  totalLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  totalValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  totalBold: {
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
  },
  totalValueBold: {
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
  },
  totalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
});

export default AdminOrderDetailScreen;
