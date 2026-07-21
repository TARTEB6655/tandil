import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Alert,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  adminVendorManagementService,
  AdminManagedVendor,
  AdminManagedVendorProduct,
  AdminVendorDetailSummary,
} from '../../services/adminVendorManagementService';

const SCREEN_BG = COLORS.surfaceLight;

function ProductThumb({ uri, style }: { uri?: string; style: object }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(uri) && !failed;

  if (!showImage) {
    return <View style={[style, styles.productImageEmpty]} />;
  }

  return (
    <Image
      source={{ uri: uri! }}
      style={style}
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={() => setFailed(true)}
    />
  );
}

function VendorLogo({ uri }: { uri?: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(uri) && !failed;

  if (!showImage) {
    return (
      <View style={[styles.vendorLogo, styles.vendorLogoFallback]}>
        <Ionicons name="storefront" size={26} color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: uri! }}
      style={styles.vendorLogo}
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={() => setFailed(true)}
    />
  );
}

function ProductRow({
  item,
  busy,
  enabled,
  onToggle,
  onDelete,
  t,
}: {
  item: AdminManagedVendorProduct;
  busy: boolean;
  enabled: boolean;
  onToggle: () => void;
  onDelete: () => void;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  return (
    <View style={styles.productCard}>
      <ProductThumb uri={item.image_url} style={styles.productImage} />
      <View style={styles.productMeta}>
        <Text style={[styles.productName, !enabled && styles.mutedText]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.productPrice}>
          {item.price_formatted || `${item.currency} ${item.price.toFixed(2)}`}
        </Text>
        <View style={styles.productMetaRow}>
          <View style={styles.metaChip}>
            <Ionicons name="layers-outline" size={12} color={COLORS.textSecondary} />
            <Text style={styles.productStock}>
              {t('adminVendorManagement.stock', { defaultValue: 'Stock' })} {item.stock}
            </Text>
          </View>
        </View>
        {/* API display_status_label only (Draft, Disabled by Admin, Out of Stock, …) */}
        {item.display_status_label ? (
          <View style={styles.badgesRow}>
            <View style={[styles.statusPill, { backgroundColor: '#D4A01718' }]}>
              <Text style={[styles.statusPillText, { color: '#B8860B' }]}>
                {item.display_status_label}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
      <View style={styles.actionsWrap}>
        {busy ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <>
            <Switch
              value={enabled}
              onValueChange={onToggle}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
              thumbColor={enabled ? COLORS.primary : '#f4f3f4'}
            />
            {item.can_delete !== false ? (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={onDelete}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('adminVendorManagement.deleteProduct', {
                  defaultValue: 'Delete product',
                })}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const AdminVendorProductsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const vendorId = String(route.params?.vendorId ?? '');
  const vendorNameParam = route.params?.vendorName as string | undefined;

  const [vendor, setVendor] = useState<AdminManagedVendor | null>(null);
  const [summary, setSummary] = useState<AdminVendorDetailSummary | null>(null);
  const [products, setProducts] = useState<AdminManagedVendorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [suspending, setSuspending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (pageNum = 1, isRefresh = false) => {
      if (!vendorId) {
        setError(t('adminVendorManagement.missingVendor', { defaultValue: 'Vendor not found.' }));
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const detail = await adminVendorManagementService.getVendorDetail(vendorId, {
          page: pageNum,
          per_page: 20,
        });
        if (pageNum === 1) {
          setVendor(detail.vendor);
          setSummary(detail.summary);
          setProducts(detail.products);
        } else {
          setProducts((prev) => [...prev, ...detail.products]);
        }
        setPage(detail.pagination.current_page);
        setHasMore(detail.pagination.current_page < detail.pagination.last_page);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : t('adminVendorManagement.detailFailed', {
                defaultValue: 'Failed to load vendor products.',
              })
        );
        // Never wipe an already-loaded vendor on refresh failure (e.g. after suspend).
        if (pageNum === 1 && !isRefresh) {
          setProducts([]);
          setVendor(null);
          setSummary(null);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [vendorId, t]
  );

  useFocusEffect(
    useCallback(() => {
      load(1);
    }, [load])
  );

  const handleToggle = async (product: AdminManagedVendorProduct) => {
    const nextEnabled = !product.is_available;
    const actionLabel = nextEnabled
      ? t('adminVendorManagement.enable', { defaultValue: 'Enable' })
      : t('adminVendorManagement.disable', { defaultValue: 'Disable' });

    // Draft / pending: API often sets can_toggle=false — explain before calling.
    if (!product.can_toggle) {
      const isDraft =
        String(product.display_status || '').toLowerCase() === 'draft' ||
        String(product.approval_status || '').toLowerCase() === 'pending';
      Alert.alert(
        t('adminVendorManagement.toggleNotAllowedTitle', {
          defaultValue: 'Cannot change status',
        }),
        isDraft
          ? t('adminVendorManagement.toggleDraftBlocked', {
              defaultValue:
                'This product is still Draft / pending approval. Approve it first, then you can enable or disable it as admin.',
            })
          : t('adminVendorManagement.toggleNotAllowed', {
              defaultValue: 'The API does not allow toggling this product right now.',
            })
      );
      return;
    }

    Alert.alert(
      actionLabel,
      t('adminVendorManagement.toggleConfirm', {
        defaultValue: '{{action}} "{{name}}"?',
        action: actionLabel,
        name: product.name,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: actionLabel,
          onPress: async () => {
            setTogglingId(product.id);
            const previous = products;
            const previousSummary = summary;

            setProducts((list) =>
              list.map((p) =>
                p.id === product.id
                  ? {
                      ...p,
                      is_available: nextEnabled,
                      status: nextEnabled ? 'enabled' : 'disabled',
                      status_label: nextEnabled ? 'Enabled' : 'Disabled',
                      display_status_label: nextEnabled
                        ? p.display_status_label
                        : 'Disabled by Admin',
                      disabled_by_admin: !nextEnabled,
                    }
                  : p
              )
            );
            if (summary) {
              setSummary({
                ...summary,
                enabled_products: Math.max(
                  0,
                  summary.enabled_products + (nextEnabled ? 1 : -1)
                ),
                disabled_products: Math.max(
                  0,
                  summary.disabled_products + (nextEnabled ? -1 : 1)
                ),
              });
            }

            try {
              const updated = await adminVendorManagementService.toggleProduct(
                vendorId,
                product
              );
              if (updated) {
                setProducts((list) =>
                  list.map((p) => (p.id === product.id ? { ...p, ...updated } : p))
                );
              }
              await load(1, true);
            } catch (err: unknown) {
              setProducts(previous);
              setSummary(previousSummary);
              Alert.alert(
                t('common.error'),
                err instanceof Error
                  ? err.message
                  : t('adminVendorManagement.toggleFailed', {
                      defaultValue: 'Failed to update product availability.',
                    })
              );
            } finally {
              setTogglingId(null);
            }
          },
        },
      ]
    );
  };

  const handleDelete = (product: AdminManagedVendorProduct) => {
    if (product.can_delete === false) {
      Alert.alert(
        t('adminVendorManagement.deleteNotAllowedTitle', {
          defaultValue: 'Cannot delete',
        }),
        t('adminVendorManagement.deleteNotAllowed', {
          defaultValue: 'This product cannot be deleted right now.',
        })
      );
      return;
    }

    Alert.alert(
      t('adminVendorManagement.deleteProduct', { defaultValue: 'Delete product' }),
      t('adminVendorManagement.deleteConfirm', {
        defaultValue: 'Delete "{{name}}"? This cannot be undone.',
        name: product.name,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: async () => {
            setDeletingId(product.id);
            const previous = products;
            const previousSummary = summary;
            setProducts((list) => list.filter((p) => p.id !== product.id));
            if (summary) {
              setSummary({
                ...summary,
                total_products: Math.max(0, summary.total_products - 1),
                enabled_products: Math.max(
                  0,
                  summary.enabled_products - (product.is_available ? 1 : 0)
                ),
                disabled_products: Math.max(
                  0,
                  summary.disabled_products - (product.is_available ? 0 : 1)
                ),
              });
            }
            try {
              await adminVendorManagementService.deleteProduct(vendorId, product);
              await load(1, true);
            } catch (err: unknown) {
              setProducts(previous);
              setSummary(previousSummary);
              Alert.alert(
                t('common.error'),
                err instanceof Error
                  ? err.message
                  : t('adminVendorManagement.deleteFailed', {
                      defaultValue: 'Failed to delete product.',
                    })
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const title =
    vendor?.business_name ||
    vendorNameParam ||
    t('adminVendorManagement.vendorProducts', { defaultValue: 'Vendor Products' });

  const isVendorSuspended =
    String(vendor?.status || '').toLowerCase().includes('suspend') ||
    String(vendor?.status_label || '').toLowerCase().includes('suspend');

  const accountStatusLabel = isVendorSuspended
    ? t('adminVendorManagement.suspended', { defaultValue: 'Suspended' })
    : vendor?.status_label ||
      t('adminVendorManagement.approved', { defaultValue: 'Approved' });

  const applyAccountStatus = (next: 'suspended' | 'approved', statusLabel?: string) => {
    setVendor((prev) =>
      prev
        ? {
            ...prev,
            status: next,
            status_label:
              statusLabel ||
              (next === 'suspended'
                ? t('adminVendorManagement.suspended', { defaultValue: 'Suspended' })
                : t('adminVendorManagement.approved', { defaultValue: 'Approved' })),
          }
        : prev
    );
  };

  const updateAccountStatus = async (action: 'suspend' | 'activate') => {
    if (!vendorId || suspending) return;
    setSuspending(true);
    setError(null);
    try {
      const result = await adminVendorManagementService.updateVendorAccountStatus(
        vendorId,
        action
      );
      const nextStatus =
        result.status?.toLowerCase().includes('suspend') || action === 'suspend'
          ? 'suspended'
          : 'approved';
      applyAccountStatus(nextStatus, result.status_label);
      // Do not hard-reload detail after suspend/activate — some backends hide
      // suspended vendors from the management detail endpoint, which looked like
      // the vendor was deleted. Status from the account-status response is enough.
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        result.message
      );
    } catch (err: unknown) {
      Alert.alert(
        t('common.error'),
        err instanceof Error
          ? err.message
          : t('adminVendorManagement.accountStatusFailed', {
              defaultValue: 'Failed to update vendor account status.',
            })
      );
    } finally {
      setSuspending(false);
    }
  };

  const handleSuspendVendor = () => {
    if (!vendorId || suspending || isVendorSuspended) return;

    Alert.alert(
      t('adminVendorManagement.suspendVendor', {
        defaultValue: 'Suspend Vendor Account',
      }),
      t('adminVendorManagement.suspendConfirm', {
        defaultValue: 'Are you sure you want to suspend this vendor account?',
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('adminVendorManagement.suspend', { defaultValue: 'Suspend' }),
          style: 'destructive',
          onPress: () => {
            updateAccountStatus('suspend');
          },
        },
      ]
    );
  };

  const handleReactivateVendor = () => {
    if (!vendorId || suspending || !isVendorSuspended) return;

    Alert.alert(
      t('adminVendorManagement.reactivateVendor', {
        defaultValue: 'Reactivate Vendor Account',
      }),
      t('adminVendorManagement.reactivateConfirm', {
        defaultValue: 'Are you sure you want to reactivate this vendor account?',
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('adminVendorManagement.reactivate', { defaultValue: 'Reactivate' }),
          onPress: () => {
            updateAccountStatus('activate');
          },
        },
      ]
    );
  };

  const revenueDisplay =
    summary?.total_revenue_formatted ||
    `${summary?.currency || 'AED'} ${Math.round(summary?.total_revenue ?? 0)}`;

  const renderProduct = ({ item }: { item: AdminManagedVendorProduct }) => {
    const busy = togglingId === item.id || deletingId === item.id;
    const enabled = item.is_available;
    return (
      <ProductRow
        item={item}
        busy={busy}
        enabled={enabled}
        onToggle={() => handleToggle(item)}
        onDelete={() => handleDelete(item)}
        t={t}
      />
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error && products.length === 0 && !vendor ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load(1, true)}>
            <Text style={styles.retryLink}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderProduct}
          contentContainerStyle={styles.listContent}
          onEndReached={() => {
            if (hasMore && !loadingMore && !loading) load(page + 1);
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                style={{ marginVertical: SPACING.md }}
                color={COLORS.primary}
              />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(1, true)}
              tintColor={COLORS.primary}
            />
          }
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <View style={styles.hero}>
                <View style={styles.heroDecor} />
                <View style={styles.heroTopRow}>
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.vendorBanner}>
                  <VendorLogo uri={vendor?.logo_url} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bannerName} numberOfLines={2}>
                      {title}
                    </Text>
                    {vendor?.contact_name ? (
                      <Text style={styles.bannerSub} numberOfLines={1}>
                        {vendor.contact_name}
                      </Text>
                    ) : null}
                    {vendor?.email ? (
                      <Text style={styles.bannerSub} numberOfLines={1}>
                        {vendor.email}
                      </Text>
                    ) : null}
                    {vendor?.phone ? (
                      <Text style={styles.bannerSub} numberOfLines={1}>
                        {vendor.phone}
                      </Text>
                    ) : null}
                    <View
                      style={[
                        styles.vendorStatusBadge,
                        isVendorSuspended && styles.vendorStatusBadgeSuspended,
                      ]}
                    >
                      <Text style={styles.vendorStatusText}>{accountStatusLabel}</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.accountActionBtn,
                    isVendorSuspended
                      ? styles.accountActionBtnReactivate
                      : styles.accountActionBtnSuspend,
                    suspending && styles.accountActionBtnDisabled,
                  ]}
                  onPress={isVendorSuspended ? handleReactivateVendor : handleSuspendVendor}
                  disabled={suspending}
                  activeOpacity={0.88}
                >
                  {suspending ? (
                    <ActivityIndicator
                      size="small"
                      color={isVendorSuspended ? COLORS.primary : COLORS.error}
                    />
                  ) : (
                    <>
                      <View
                        style={[
                          styles.accountActionIconWrap,
                          isVendorSuspended
                            ? styles.accountActionIconReactivate
                            : styles.accountActionIconSuspend,
                        ]}
                      >
                        <Ionicons
                          name={isVendorSuspended ? 'play' : 'pause'}
                          size={14}
                          color="#fff"
                        />
                      </View>
                      <Text
                        style={[
                          styles.accountActionBtnText,
                          isVendorSuspended
                            ? styles.accountActionBtnTextReactivate
                            : styles.accountActionBtnTextSuspend,
                        ]}
                        numberOfLines={1}
                      >
                        {isVendorSuspended
                          ? t('adminVendorManagement.reactivateVendor', {
                              defaultValue: 'Reactivate Vendor Account',
                            })
                          : t('adminVendorManagement.suspendVendor', {
                              defaultValue: 'Suspend Vendor Account',
                            })}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.metricsRow}>
                <View style={[styles.metricCard, styles.metricPrimary]}>
                  <Ionicons name="cash-outline" size={18} color="#fff" />
                  <Text style={styles.metricValueLight} numberOfLines={1}>
                    {revenueDisplay}
                  </Text>
                  <Text style={styles.metricLabelLight}>
                    {t('adminVendorManagement.totalRevenue', { defaultValue: 'Total revenue' })}
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Ionicons name="cube-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.metricValue}>{summary?.total_products ?? products.length}</Text>
                  <Text style={styles.metricLabel}>
                    {t('adminVendorManagement.totalProducts', { defaultValue: 'Total products' })}
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.success} />
                  <Text style={styles.metricValue}>{summary?.enabled_products ?? 0}</Text>
                  <Text style={styles.metricLabel}>
                    {t('adminVendorManagement.enabled', { defaultValue: 'Enabled' })}
                  </Text>
                </View>
              </View>

              <View style={styles.secondaryMetrics}>
                <View style={styles.secondaryChip}>
                  <Text style={styles.secondaryValue}>{summary?.disabled_products ?? 0}</Text>
                  <Text style={styles.secondaryLabel}>
                    {t('adminVendorManagement.disabled', { defaultValue: 'Disabled' })}
                  </Text>
                </View>
                <View style={styles.secondaryChip}>
                  <Text style={styles.secondaryValue}>{summary?.pending_products ?? 0}</Text>
                  <Text style={styles.secondaryLabel}>
                    {t('adminVendorManagement.pending', { defaultValue: 'Pending' })}
                  </Text>
                </View>
              </View>

              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>
                  {t('adminVendorManagement.productsList', { defaultValue: 'Products' })}
                </Text>
                <Text style={styles.sectionCount}>
                  {summary?.total_products ?? products.length}
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="cube-outline" size={36} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyText}>
                {t('adminVendorManagement.noProducts', {
                  defaultValue: 'No products for this vendor yet.',
                })}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SCREEN_BG },
  listContent: { paddingBottom: SPACING.xxl },
  headerBlock: { marginBottom: SPACING.sm },
  hero: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroDecor: {
    position: 'absolute',
    bottom: -50,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountActionBtn: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: 48,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: '#fff',
    borderWidth: 1.5,
  },
  accountActionBtnSuspend: {
    borderColor: 'rgba(255,255,255,0.55)',
  },
  accountActionBtnReactivate: {
    borderColor: 'rgba(255,255,255,0.55)',
  },
  accountActionBtnDisabled: {
    opacity: 0.7,
  },
  accountActionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountActionIconSuspend: {
    backgroundColor: COLORS.error,
  },
  accountActionIconReactivate: {
    backgroundColor: COLORS.primary,
  },
  accountActionBtnText: {
    flexShrink: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
  },
  accountActionBtnTextSuspend: {
    color: COLORS.error,
  },
  accountActionBtnTextReactivate: {
    color: COLORS.primary,
  },
  vendorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  vendorLogo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  vendorLogoFallback: { alignItems: 'center', justifyContent: 'center' },
  bannerName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
  },
  bannerSub: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 3,
  },
  vendorStatusBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
  },
  vendorStatusBadgeSuspended: {
    backgroundColor: 'rgba(220, 53, 69, 0.85)',
  },
  vendorStatusText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: '#fff',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: -18,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  metricPrimary: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
  },
  metricValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  metricValueLight: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
  },
  metricLabel: { fontSize: 10, color: COLORS.textSecondary, textAlign: 'center' },
  metricLabelLight: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  secondaryMetrics: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  secondaryChip: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  secondaryValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  secondaryLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  sectionCount: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    backgroundColor: COLORS.primary + '14',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.round,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  productImage: {
    width: 72,
    height: 72,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  productImageEmpty: {
    backgroundColor: COLORS.surface,
  },
  productMeta: { flex: 1, marginHorizontal: SPACING.sm },
  productName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  mutedText: { color: COLORS.textSecondary },
  productPrice: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.bold,
    marginTop: 3,
  },
  productMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  productStock: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.round,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 10, fontWeight: FONT_WEIGHTS.semiBold },
  toggleWrap: { width: 52, alignItems: 'center', justifyContent: 'center' },
  actionsWrap: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.error + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  errorText: { color: COLORS.textSecondary, textAlign: 'center' },
  retryLink: { color: COLORS.primary, marginTop: SPACING.sm, fontWeight: FONT_WEIGHTS.semiBold },
  emptyWrap: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: SPACING.lg },
});

export default AdminVendorProductsScreen;
