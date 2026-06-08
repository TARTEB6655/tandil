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
    } catch (err: any) {
      setCartItems([]);
      setOrderSummary(null);
      setOrderSummaryApi(null);
      setError(err.response?.data?.message || err.message || t('cart.errorLoad', { defaultValue: 'Failed to load cart' }));
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

  const renderCartItem = (item: CartItemDisplay) => (
    <View key={item.id} style={styles.cartItem}>
      <FallbackImage uri={item.image} style={styles.itemImage} />
      
      <View style={styles.itemContent}>
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        
        <View style={styles.itemDetails}>
          <View style={styles.itemSpecs}>
            {item.category && <Text style={styles.itemSpec}>{t('cart.category')}: {item.category}</Text>}
            {item.brand && <Text style={styles.itemSpec}>{t('cart.brand')}: {item.brand}</Text>}
          </View>
          
          <View style={styles.itemPrice}>
            <Text style={styles.currentPrice}>{currency} {item.price}</Text>
            {item.originalPrice != null && item.originalPrice > item.price && (
              <Text style={styles.originalPrice}>{currency} {item.originalPrice}</Text>
            )}
          </View>
        </View>
        
        <View style={styles.itemActions}>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={[styles.quantityButton, updatingItemId === item.id && styles.quantityButtonDisabled]}
              onPress={() => updateQuantity(item.id, item.quantity - 1)}
              disabled={updatingItemId !== null || item.quantity <= 1}
            >
              <Ionicons name="remove" size={16} color={item.quantity <= 1 ? COLORS.textSecondary : COLORS.text} />
            </TouchableOpacity>
            {updatingItemId === item.id ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={styles.quantityLoader} />
            ) : (
              <Text style={styles.quantityText}>{item.quantity}</Text>
            )}
            <TouchableOpacity
              style={[styles.quantityButton, updatingItemId === item.id && styles.quantityButtonDisabled]}
              onPress={() => updateQuantity(item.id, item.quantity + 1)}
              disabled={updatingItemId !== null}
            >
              <Ionicons name="add" size={16} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.removeButton, updatingItemId === item.id && styles.quantityButtonDisabled]}
            onPress={() => removeItem(item.id)}
            disabled={updatingItemId !== null}
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

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
          <Ionicons name="log-in-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyStateTitle}>{t('cart.loginToView', { defaultValue: 'Log in to view your cart' })}</Text>
          <Text style={styles.emptyStateText}>{t('cart.loginToViewBody', { defaultValue: 'Sign in to see items you have added.' })}</Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => navigateToClientAuth(navigation)}
          >
            <Text style={styles.shopButtonText}>{t('auth.login', 'Log in')}</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('cart.loading', { defaultValue: 'Loading cart…' })}</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
          <Text style={styles.emptyStateTitle}>{t('common.error', 'Error')}</Text>
          <Text style={styles.emptyStateText}>{error}</Text>
          <TouchableOpacity style={styles.shopButton} onPress={() => fetchCart()}>
            <Text style={styles.shopButtonText}>{t('common.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : cartItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="bag-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyStateTitle}>{t('cart.emptyTitle')}</Text>
          <Text style={styles.emptyStateText}>{t('cart.emptyText')}</Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => navigation.navigate('Main' as never, { screen: 'Store' } as never)}
          >
            <Text style={styles.shopButtonText}>{t('cart.startShopping')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.cartList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
            }
          >
            {cartItems.map(renderCartItem)}
          </ScrollView>

          <View style={styles.orderSummary}>
            <Text style={styles.summaryTitle}>{t('cart.orderSummary')}</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('cart.subtotal')}</Text>
              <Text style={styles.summaryValue}>{currency} {subtotal.toFixed(2)}</Text>
            </View>
            {discount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('cart.discount')}</Text>
                <Text style={[styles.summaryValue, styles.discountText]}>-{currency} {discount.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('cart.shipping')}</Text>
              <Text style={styles.summaryValue}>
                {shipping <= 0
                  ? t('cart.free')
                  : `${currency} ${shipping.toFixed(2)}`}
              </Text>
            </View>
            {(taxAmount > 0 || taxPercent > 0) && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {taxPercent > 0 ? `${t('cart.tax', 'Tax')} (${taxPercent}%)` : t('cart.tax', 'Tax')}
                </Text>
                <Text style={styles.summaryValue}>{currency} {taxAmount.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>{t('cart.total')}</Text>
              <Text style={styles.totalValue}>{currency} {total.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.checkoutContainer}>
            {!canProceedToCheckout ? (
              <Text style={styles.minOrderHint}>
                {t('cart.minOrderHint', {
                  defaultValue: 'Minimum order is {{amount}} {{currency}}. Add more items to checkout.',
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
              <Ionicons
                name="arrow-forward"
                size={20}
                color={canProceedToCheckout ? COLORS.background : 'rgba(255,255,255,0.6)'}
              />
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
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  headerSpacer: {
    width: 40,
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
  emptyStateTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyStateText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  shopButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  shopButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.background,
  },
  cartList: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.md,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  itemSpecs: {
    flex: 1,
  },
  itemSpec: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 2,
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
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quantityButton: {
    padding: SPACING.sm,
    minWidth: 32,
    alignItems: 'center',
  },
  quantityText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    minWidth: 30,
    textAlign: 'center',
  },
  quantityButtonDisabled: {
    opacity: 0.6,
  },
  quantityLoader: {
    minWidth: 30,
  },
  removeButton: {
    padding: SPACING.sm,
  },
  orderSummary: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  summaryTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
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
    fontWeight: FONT_WEIGHTS.medium,
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
    fontSize: FONT_SIZES.lg,
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
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
  },
  checkoutButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.background,
  },
  checkoutButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
  },
  checkoutButtonTextDisabled: {
    color: 'rgba(255,255,255,0.75)',
  },
});

export default CartScreen;
