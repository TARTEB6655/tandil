import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { vendorProductAreaPricingService } from '../../services/vendorProductAreaPricingService';
import type { VendorServiceAreaPricingListItem } from '../../types/vendorServiceAreaPricingList';

type Portal = 'admin' | 'vendor';

type RouteParams = {
  portal?: Portal;
  vendorId?: string;
  vendorName?: string;
  currency?: string;
};

const ServiceAreaPricingListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as RouteParams;
  const portal: Portal = params.portal === 'admin' ? 'admin' : 'vendor';
  const vendorId = String(params.vendorId ?? '').trim();

  const notSet = t('vendorProductAreaPricing.notSet', { defaultValue: 'Not set' });

  const screenTitle =
    portal === 'admin'
      ? t('vendorProductAreaPricing.adminListTitle', { defaultValue: 'Services' })
      : t('vendorProductAreaPricing.vendorListTitle', {
          defaultValue: 'My services — m² pricing',
        });
  const screenDescription =
    portal === 'admin'
      ? t('vendorProductAreaPricing.adminListDescription', {
          defaultValue:
            'Tap a service to set its price per m² (and optional fixed price) for the customer app.',
        })
      : t('vendorProductAreaPricing.vendorListDescription', {
          defaultValue:
            'Set price per m² and optional fixed price for each of your service listings.',
        });
  const [items, setItems] = useState<VendorServiceAreaPricingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (portal === 'admin' && !vendorId) {
        setError(t('adminVendorManagement.missingVendor', { defaultValue: 'Vendor not found.' }));
        setLoading(false);
        return;
      }
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const payload =
          portal === 'admin'
            ? await vendorProductAreaPricingService.listForAdminVendor(vendorId)
            : await vendorProductAreaPricingService.listForVendor();
        if (!payload) {
          throw new Error(
            t('vendorProductAreaPricing.listLoadFailed', {
              defaultValue: 'Failed to load services.',
            })
          );
        }
        setItems(payload.items);
      } catch (err: unknown) {
        setItems([]);
        const ax = err as { response?: { data?: { message?: string } }; message?: string };
        setError(
          ax.response?.data?.message ||
            (err instanceof Error ? err.message : '') ||
            t('vendorProductAreaPricing.listLoadFailed', {
              defaultValue: 'Failed to load services.',
            })
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [portal, t, vendorId]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const openManage = (item: VendorServiceAreaPricingListItem) => {
    navigation.navigate('ServiceAreaPricingManage', {
      portal,
      vendorId: portal === 'admin' ? vendorId : undefined,
      vendorProductId: String(item.product_id),
      listingName: item.name,
      serviceName: item.name,
      currency: params.currency ?? 'AED',
    });
  };

  const currency = params.currency ?? 'AED';

  const renderItem = ({ item }: { item: VendorServiceAreaPricingListItem }) => {
    const m2Label =
      item.price_per_m2 != null && item.price_per_m2 > 0
        ? t('vendorProductAreaPricing.ratePerM2Short', {
            defaultValue: '{{currency}} {{price}} / m²',
            currency,
            price: Number(item.price_per_m2).toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          })
        : notSet;
    const configured = Boolean(item.area_pricing_configured);

    return (
      <TouchableOpacity style={styles.card} onPress={() => openManage(item)} activeOpacity={0.88}>
        <View style={styles.cardMain}>
          <View style={styles.titleRow}>
            <Text style={styles.serviceName} numberOfLines={2}>
              {item.name}
            </Text>
            {item.status ? (
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{item.status}</Text>
              </View>
            ) : null}
          </View>
          {item.description?.trim() ? (
            <Text style={styles.description} numberOfLines={3}>
              {item.description.trim()}
            </Text>
          ) : null}
          {item.catalog_price != null ? (
            <Text style={styles.catalogLine}>
              {t('vendorProductAreaPricing.catalogPrice', {
                defaultValue: 'Catalog: {{currency}} {{price}}',
                currency,
                price: Number(item.catalog_price).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                }),
              })}
            </Text>
          ) : null}
          {item.show_on_client_products_services ? (
            <Text style={styles.onClientLine}>
              {t('vendorProductAreaPricing.visibleOnClient', {
                defaultValue: 'Visible on customer app',
              })}
            </Text>
          ) : null}
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.ratePill, configured && styles.ratePillActive]}>
            <Text style={[styles.ratePillText, configured && styles.ratePillTextActive]}>
              {m2Label}
            </Text>
          </View>
          {!configured ? (
            <View style={styles.setupBadge}>
              <Text style={styles.setupBadgeText}>
                {t('vendorProductAreaPricing.setupBadge', { defaultValue: 'Setup' })}
              </Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header title={screenTitle} showBack onBackPress={() => navigation.goBack()} />

      {params.vendorName ? (
        <Text style={styles.vendorName} numberOfLines={1}>
          {params.vendorName}
        </Text>
      ) : null}

      {screenDescription ? <Text style={styles.intro}>{screenDescription}</Text> : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => void load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="construct-outline" size={40} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>
            {t('vendorProductAreaPricing.emptyTitle', { defaultValue: 'No service listings yet' })}
          </Text>
          <Text style={styles.emptyBody}>
            {t('vendorProductAreaPricing.emptyBody', {
              defaultValue: 'Add a service under Products first, then return here to set m² rates.',
            })}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.product_id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  vendorName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  intro: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    flexWrap: 'wrap',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardMain: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  serviceName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    flex: 1,
  },
  statusPill: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusPillText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  description: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  catalogLine: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  onClientLine: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
    marginTop: 4,
    fontWeight: FONT_WEIGHTS.medium,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 4,
    maxWidth: '40%',
  },
  ratePill: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ratePillActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  ratePillText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  ratePillTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  setupBadge: {
    backgroundColor: COLORS.textSecondary + '18',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  setupBadgeText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textSecondary,
  },
  centered: {
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
    padding: SPACING.sm,
  },
  retryText: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
});

export default ServiceAreaPricingListScreen;
