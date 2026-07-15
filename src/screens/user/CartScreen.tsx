import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';
import {
  getCart,
  removeCartItem,
  updateCartItemQuantity,
  getOrderSummary,
  CartApiItem,
  CartOrderSummary,
  OrderSummaryData,
} from '../../services/cartService';
import { getShopSettings, ShopSettings } from '../../services/shopSettingsService';
import { useIsAuthenticated } from '../../store';
import { invalidateClientSession, isUnauthenticatedError } from '../../utils/invalidateClientSession';
import { useCartBadgeCount } from '../../hooks/useCartBadgeCount';
import { navigateToClientAuth } from '../../navigation/clientAuthNavigation';
import {
  meetsMinimumOrderAmount,
  MIN_ORDER_AMOUNT_AED,
  MIN_ORDER_BUTTON_DISABLED_STYLE,
  showMinimumOrderAlert,
} from '../../utils/shopOrderMinimum';

interface CartItemDisplay {
  id: string;
  productId: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category?: string;
  categoryId?: number;
  serviceId?: number;
  brand?: string;
  quantity: number;
}

function mapApiItemToDisplay(item: CartApiItem): CartItemDisplay {
  return {
    id: String(item.id),
    productId: String(item.product_id),
    name: item.name,
    price: item.current_price,
    originalPrice: item.original_price ?? undefined,
    image: item.image_url || 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=400&q=60',
    category: item.category ?? undefined,
    categoryId: item.category_id ?? undefined,
    serviceId: item.service_id ?? undefined,
    brand: item.brand ?? undefined,
    quantity: item.quantity,
  };
}

const CartScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const isAuthenticated = useIsAuthenticated();
  const { count: cartItemCount } = useCartBadgeCount();

  const [cartItems, setCartItems] = useState<CartItemDisplay[]>([]);
  const [orderSummary, setOrderSummary] = useState<CartOrderSummary | null>(null);
  const [orderSummaryApi, setOrderSummaryApi] = useState<OrderSummaryData | null>(null);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getShopSettings().then((s) => {
      if (!cancelled) setShopSettings(s);
    });
    return () => { cancelled = true; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      getShopSettings().then(setShopSettings);
    }, [])
  );

  const fetchCart = useCallback(async (isRefresh = false) => {
    if (!isAuthenticated) {
      setCartItems([]);
      setOrderSummary(null);
      setOrderSummaryApi(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await getCart();
      const items = res.data?.items ?? [];
      const summary = res.data?.order_summary ?? null;
      setCartItems(items.map(mapApiItemToDisplay));
      setOrderSummary(summary);
      try {
        const summaryRes = await getOrderSummary();
        setOrderSummaryApi(summaryRes ?? null);
      } catch (_) {
        setOrderSummaryApi(null);
      }
    } catch (err: unknown) {
      setCartItems([]);
      setOrderSummary(null);
      setOrderSummaryApi(null);
      if (isUnauthenticatedError(err)) {
        await invalidateClientSession();
        setError(null);
        return;
      }
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setError(
        ax.response?.data?.message ||
          ax.message ||
          t('cart.errorLoad', { defaultValue: 'Failed to load cart' })
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, t]);

  useFocusEffect(
    useCallback(() => {
      fetchCart();
    }, [fetchCart])
  );

  const onRefresh = useCallback(() => {
    fetchCart(true);
  }, [fetchCart]);

  const FallbackImage = ({ uri, style }: { uri: string; style: any }) => {
    const [currentUri, setCurrentUri] = useState(uri);
    const fallback = 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=400&q=60';
    return (
      <Image
        source={{ uri: currentUri }}
        style={style}
        onError={() => setCurrentUri(fallback)}
      />
    );
  };

  const updateQuantity = useCallback(async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    const id = Number(itemId);
    if (!Number.isFinite(id)) return;
    setUpdatingItemId(itemId);
    try {
      await updateCartItemQuantity(id, newQuantity);
      await fetchCart(true);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || t('cart.updateQuantityFailed', { defaultValue: 'Failed to update quantity.' });
      Alert.alert(t('common.error', 'Error'), msg);
    } finally {
      setUpdatingItemId(null);
    }
  }, [fetchCart, t]);

  const removeItem = (itemId: string) => {
    Alert.alert(
      t('cart.removeTitle'),
      t('cart.removeBody'),
      [
        { text: t('cart.cancel'), style: 'cancel' },
        {
          text: t('cart.remove'),
          style: 'destructive',
          onPress: async () => {
            const id = Number(itemId);
            if (!Number.isFinite(id)) return;
            try {
              await removeCartItem(id);
              await fetchCart(true);
            } catch (err: any) {
              const msg = err.response?.data?.message || err.message || t('cart.removeFailed', { defaultValue: 'Failed to remove item.' });
              Alert.alert(t('common.error', 'Error'), msg);
            }
          },
        },
      ]
    );
  };

  const useApiSummary = orderSummaryApi != null;
  const subtotal = useApiSummary ? orderSummaryApi.subtotal : (orderSummary?.subtotal ?? cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const discount = useApiSummary ? orderSummaryApi.discount : (orderSummary?.discount ?? 0);
  const shippingBase = useApiSummary ? orderSummaryApi.shipping : (orderSummary?.shipping ?? shopSettings?.shipping_amount ?? 0);
  const taxPercent = useApiSummary ? (orderSummaryApi.tax_percent ?? 0) : (shopSettings?.tax_percent ?? 0);
  const shipping = shippingBase;
  const taxableBase = Math.max(0, subtotal - discount);
  const taxAmount = Math.round(taxableBase * (taxPercent / 100) * 100) / 100;
  const total = Math.round((taxableBase + shipping + taxAmount) * 100) / 100;
  const currency = useApiSummary ? orderSummaryApi.currency : (orderSummary?.currency || shopSettings?.currency || t('orders.currency', { defaultValue: 'AED' }));
  const canProceedToCheckout = cartItems.length > 0 && meetsMinimumOrderAmount(total);

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert(t('cart.emptyCartTitle'), t('cart.emptyCartBody'));
      return;
    }
    if (!canProceedToCheckout) {
      showMinimumOrderAlert(currency, t);
      return;
    }
    navigation.navigate('Checkout', { cartItems, total });
  };

  const renderCartItem = (item: CartItemDisplay) => {
    const lineTotal = item.price * item.quantity;
    return (
      <View key={item.id} style={styles.cartItem}>
        <FallbackImage uri={item.image} style={styles.itemImage} />

        <View style={styles.itemContent}>
          <View style={styles.itemTopRow}>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.name}
            </Text>
            <TouchableOpacity
              style={[styles.removeButton, updatingItemId === item.id && styles.quantityButtonDisabled]}
              onPress={() => removeItem(item.id)}
              disabled={updatingItemId !== null}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.error} />
            </TouchableOpacity>
          </View>

          {item.category ? (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText} numberOfLines={1}>
                {item.category}
              </Text>
            </View>
          ) : null}

          {item.brand ? (
            <Text style={styles.itemBrand} numberOfLines={1}>
              {item.brand}
            </Text>
          ) : null}

          <View style={styles.itemBottomRow}>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={[
                  styles.quantityButton,
                  (updatingItemId === item.id || item.quantity <= 1) && styles.quantityButtonDisabled,
                ]}
                onPress={() => updateQuantity(item.id, item.quantity - 1)}
                disabled={updatingItemId !== null || item.quantity <= 1}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="remove"
                  size={16}
                  color={item.quantity <= 1 ? COLORS.textSecondary : COLORS.primary}
                />
              </TouchableOpacity>
              {updatingItemId === item.id ? (
                <ActivityIndicator size="small" color={COLORS.primary} style={styles.quantityLoader} />
              ) : (
                <Text style={styles.quantityText}>{item.quantity}</Text>
              )}
              <TouchableOpacity
                style={[
                  styles.quantityButton,
                  styles.quantityButtonPlus,
                  updatingItemId === item.id && styles.quantityButtonDisabled,
                ]}
                onPress={() => updateQuantity(item.id, item.quantity + 1)}
                disabled={updatingItemId !== null}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={16} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.itemPrice}>
              {item.originalPrice != null && item.originalPrice > item.price ? (
                <Text style={styles.originalPrice}>
                  {currency} {(item.originalPrice * item.quantity).toFixed(0)}
                </Text>
              ) : null}
              <Text style={styles.currentPrice}>
                {currency} {lineTotal.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title={t('cart.title')}
        showBack
        showCart
        cartItemCount={cartItemCount}
      />

      {!isAuthenticated ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="log-in-outline" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyStateTitle}>
            {t('cart.loginToView', { defaultValue: 'Log in to view your cart' })}
          </Text>
          <Text style={styles.emptyStateText}>
            {t('cart.loginToViewBody', { defaultValue: 'Sign in to see items you have added.' })}
          </Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => navigateToClientAuth(navigation)}
            activeOpacity={0.88}
          >
            <Text style={styles.shopButtonText}>{t('auth.login', 'Log in')}</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('cart.loading', { defaultValue: 'Loading cart…' })}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconWrap, styles.emptyIconError]}>
            <Ionicons name="alert-circle-outline" size={36} color={COLORS.error} />
          </View>
          <Text style={styles.emptyStateTitle}>{t('common.error', 'Error')}</Text>
          <Text style={styles.emptyStateText}>{error}</Text>
          <TouchableOpacity style={styles.shopButton} onPress={() => fetchCart()} activeOpacity={0.88}>
            <Text style={styles.shopButtonText}>{t('common.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : cartItems.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="bag-handle-outline" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyStateTitle}>{t('cart.emptyTitle')}</Text>
          <Text style={styles.emptyStateText}>{t('cart.emptyText')}</Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => navigation.navigate('Main' as never, { screen: 'Store' } as never)}
            activeOpacity={0.88}
          >
            <Text style={styles.shopButtonText}>{t('cart.startShopping')}</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.cartList}
            contentContainerStyle={styles.cartListContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
            }
          >
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderTitle}>
                {t('cart.itemsTitle', { defaultValue: 'Your items' })}
              </Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>
                  {t('cart.itemCount', {
                    defaultValue: '{{count}} items',
                    count: cartItems.length,
                  })}
                </Text>
              </View>
            </View>

            {cartItems.map(renderCartItem)}

            <View style={styles.orderSummary}>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryIconWrap}>
                  <Ionicons name="receipt-outline" size={18} color={COLORS.primary} />
                </View>
                <Text style={styles.summaryTitle}>{t('cart.orderSummary')}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('cart.subtotal')}</Text>
                <Text style={styles.summaryValue}>
                  {currency} {subtotal.toFixed(2)}
                </Text>
              </View>
              {discount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('cart.discount')}</Text>
                  <Text style={[styles.summaryValue, styles.discountText]}>
                    -{currency} {discount.toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('cart.shipping')}</Text>
                <Text style={styles.summaryValue}>
                  {shipping <= 0 ? t('cart.free') : `${currency} ${shipping.toFixed(2)}`}
                </Text>
              </View>
              {(taxAmount > 0 || taxPercent > 0) && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {taxPercent > 0
                      ? `${t('cart.tax', 'Tax')} (${taxPercent}%)`
                      : t('cart.tax', 'Tax')}
                  </Text>
                  <Text style={styles.summaryValue}>
                    {currency} {taxAmount.toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>{t('cart.total')}</Text>
                <Text style={styles.totalValue}>
                  {currency} {total.toFixed(2)}
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.checkoutContainer}>
            {!canProceedToCheckout ? (
              <Text style={styles.minOrderHint}>
                {t('cart.minOrderHint', {
                  defaultValue:
                    'Minimum order is {{amount}} {{currency}}. Add more items to checkout.',
                  amount: MIN_ORDER_AMOUNT_AED,
                  currency,
                })}
              </Text>
            ) : null}
            <TouchableOpacity
              style={[
                styles.checkoutButton,
                !canProceedToCheckout && styles.checkoutButtonDisabled,
                !canProceedToCheckout && MIN_ORDER_BUTTON_DISABLED_STYLE,
              ]}
              onPress={handleCheckout}
              disabled={!canProceedToCheckout}
              activeOpacity={canProceedToCheckout ? 0.85 : 1}
            >
              <Text
                style={[
                  styles.checkoutButtonText,
                  !canProceedToCheckout && styles.checkoutButtonTextDisabled,
                ]}
              >
                {t('cart.proceed', { amount: `${currency} ${total.toFixed(2)}` })}
              </Text>
              <View
                style={[
                  styles.checkoutArrow,
                  !canProceedToCheckout && styles.checkoutArrowDisabled,
                ]}
              >
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={canProceedToCheckout ? COLORS.primary : 'rgba(255,255,255,0.5)'}
                />
              </View>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyIconError: {
    backgroundColor: COLORS.error + '14',
  },
  emptyStateTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyStateText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  shopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.round,
  },
  shopButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  cartList: {
    flex: 1,
  },
  cartListContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  listHeaderTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  countPill: {
    backgroundColor: COLORS.primary + '14',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
  },
  countPillText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 18,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  itemImage: {
    width: 88,
    height: 88,
    borderRadius: 14,
    marginRight: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  itemContent: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  itemName: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    maxWidth: '100%',
  },
  categoryPillText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  itemBrand: {
    marginTop: 4,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  itemBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  itemPrice: {
    alignItems: 'flex-end',
  },
  currentPrice: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  originalPrice: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  quantityButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonPlus: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.round,
  },
  quantityText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    minWidth: 28,
    textAlign: 'center',
  },
  quantityButtonDisabled: {
    opacity: 0.55,
  },
  quantityLoader: {
    minWidth: 28,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.error + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderSummary: {
    backgroundColor: COLORS.background,
    borderRadius: 20,
    padding: SPACING.lg,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  summaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  discountText: {
    color: COLORS.success,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  totalLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  totalValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  checkoutContainer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  minOrderHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
  checkoutButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.round,
    gap: SPACING.sm,
  },
  checkoutButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  checkoutArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutArrowDisabled: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  checkoutButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
  },
  checkoutButtonTextDisabled: {
    color: 'rgba(255,255,255,0.75)',
  },
});

export default CartScreen;
