import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';
import { shopService, ShopProduct, isShopProductInStock } from '../../services/shopService';
import { addCartItem, getBuyNowSummary } from '../../services/cartService';
import { getShopSettings, ShopSettings } from '../../services/shopSettingsService';
import { useIsAuthenticated } from '../../store';
import { useCartBadgeCount } from '../../hooks/useCartBadgeCount';
import { ensureMinimumOrderAmount } from '../../utils/shopOrderMinimum';
import {
  selectedOptionsToIds,
  validateRequiredProductOptions,
} from '../../utils/productSelectedOptions';
import { navigateToClientAuth } from '../../navigation/clientAuthNavigation';
import type { ProductCustomizationConfig } from '../../types/productCustomization';

const { width: screenWidth } = Dimensions.get('window');

export type ProductDetailDisplay = {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  rating: number;
  reviews: number;
  image: string;
  badge: string;
  inStock: boolean;
  description?: string;
  features?: string[];
  estimatedArrival?: string;
  jobDuration?: string;
};

interface ProductDetailScreenProps {
  route: {
    params: {
      product: ProductDetailDisplay;
    };
  };
}

function shopProductToDisplay(p: ShopProduct | null): ProductDetailDisplay | null {
  if (!p) return null;
  const priceNum = typeof p.price === 'string' ? parseFloat(p.price) || 0 : p.price;
  const compareNum = typeof p.compare_at_price === 'string' ? parseFloat(p.compare_at_price) || 0 : (p.compare_at_price ?? 0);
  const imageUrl = p.image_url ?? (p.main_image as any)?.image_url ?? p.image ?? '';
  const image = typeof imageUrl === 'string' ? imageUrl : '';
  return {
    id: String(p.id),
    name: p.name,
    price: priceNum,
    originalPrice: compareNum,
    rating: 4.5,
    reviews: 0,
    image,
    badge: '',
    inStock: isShopProductInStock(p),
    description: p.description ?? undefined,
    features: [],
    estimatedArrival: p.estimated_arrival ?? undefined,
    jobDuration: p.job_duration ?? undefined,
  };
}

function mapApiOptionGroupsToCustomization(p: ShopProduct | null): ProductCustomizationConfig | null {
  const groups = p?.option_groups;
  if (!Array.isArray(groups) || groups.length === 0) return null;
  return {
    groups: groups
      .map((group, groupIndex) => ({
        id: String(group.id ?? `group_${groupIndex}`),
        title: String(group.name ?? ''),
        subtitle: typeof group.subtitle === 'string' ? group.subtitle : '',
        required: Boolean(group.is_required),
        selectionMode: group.input_type === 'multiple' ? 'multiple' : 'single',
        options: Array.isArray(group.options)
          ? group.options.map((opt, optionIndex) => ({
              id: String(opt.id ?? `opt_${groupIndex}_${optionIndex}`),
              label: String(opt.label ?? ''),
              subtitle: typeof opt.subtitle === 'string' ? opt.subtitle : '',
              priceDelta: Number(opt.price_modifier ?? 0),
              imageUrl: typeof opt.image_url === 'string' ? opt.image_url : '',
            }))
          : [],
      }))
      .filter((g) => g.options.length > 0),
  };
}

const ProductDetailScreen: React.FC<ProductDetailScreenProps> = ({ route }) => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { product: initialProduct } = route.params;
  const [quantity, setQuantity] = useState(1);
  const [apiProduct, setApiProduct] = useState<ShopProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [buyNowOrderTotal, setBuyNowOrderTotal] = useState<number | null>(null);
  const [customization, setCustomization] = useState<ProductCustomizationConfig | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const isAuthenticated = useIsAuthenticated();
  const { count: cartItemCount, refresh: refreshCartBadge } = useCartBadgeCount();

  useEffect(() => {
    const id = initialProduct?.id;
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    shopService
      .getProductById(id)
      .then((data) => {
        if (!cancelled) setApiProduct(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [initialProduct?.id]);

  const product = useMemo(() => {
    const fromApi = shopProductToDisplay(apiProduct);
    if (fromApi) return fromApi;
    return initialProduct;
  }, [apiProduct, initialProduct]);

  useEffect(() => {
    getShopSettings().then(setShopSettings).catch(() => setShopSettings(null));
  }, []);

  useEffect(() => {
    const cfg = mapApiOptionGroupsToCustomization(apiProduct);
    setCustomization(cfg);
    if (!cfg) {
      setSelectedOptions({});
      return;
    }
    const initialSelected: Record<string, string[]> = {};
    cfg.groups.forEach((g) => {
      if (g.required && g.options.length > 0) {
        initialSelected[g.id] = [g.options[0].id];
      }
    });
    setSelectedOptions(initialSelected);
  }, [apiProduct]);

  const selectedOptionIds = useMemo(
    () => selectedOptionsToIds(selectedOptions),
    [selectedOptions]
  );

  useEffect(() => {
    if (!isAuthenticated || !product.inStock) {
      setBuyNowOrderTotal(null);
      return;
    }
    const productId = Number(product.id);
    if (!Number.isFinite(productId)) {
      setBuyNowOrderTotal(null);
      return;
    }
    let cancelled = false;
    getBuyNowSummary(productId, quantity, {
      selected_option_ids: selectedOptionIds.length ? selectedOptionIds : undefined,
    })
      .then((res) => {
        if (!cancelled) {
          setBuyNowOrderTotal(
            res?.order_summary?.total != null ? Number(res.order_summary.total) : null
          );
        }
      })
      .catch(() => {
        if (!cancelled) setBuyNowOrderTotal(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, product.id, product.inStock, quantity, selectedOptionIds]);

  const currency = t('orders.currency', { defaultValue: 'AED' });
  const estimatedBuyNowTotal = useMemo(() => {
    const subtotal = product.price * quantity;
    const shipping = shopSettings?.shipping_amount ?? 10;
    const taxPercent = shopSettings?.tax_percent ?? 5;
    const tax = Math.round(subtotal * (taxPercent / 100) * 100) / 100;
    return Math.round((subtotal + shipping + tax) * 100) / 100;
  }, [product.price, quantity, shopSettings]);

  const buyNowTotalForMinCheck =
    buyNowOrderTotal != null && Number.isFinite(buyNowOrderTotal)
      ? buyNowOrderTotal
      : estimatedBuyNowTotal;
  const buyNowButtonLabel = t('product.buyNow', { defaultValue: 'Buy Now' });

  const selectedOptionsExtra = useMemo(() => {
    if (!customization) return 0;
    let sum = 0;
    customization.groups.forEach((group) => {
      const ids = selectedOptions[group.id] ?? [];
      ids.forEach((id) => {
        const item = group.options.find((o) => o.id === id);
        if (item) sum += item.priceDelta;
      });
    });
    return sum;
  }, [customization, selectedOptions]);

  const buyNowMinCheckTotalWithOptions = buyNowTotalForMinCheck + selectedOptionsExtra * quantity;

  const ensureCustomizationValid = (): boolean => {
    const check = validateRequiredProductOptions(customization, selectedOptions);
    if (check.valid) return true;
    Alert.alert(
      t('common.error', 'Error'),
      check.missingGroupTitle
        ? t('product.requiredOptionMissing', {
            defaultValue: 'Please select required option(s) for {{group}}.',
            group: check.missingGroupTitle,
          })
        : t('product.requiredOptionsMissing', {
            defaultValue: 'Please select all required product options.',
          })
    );
    return false;
  };

  const toggleOption = (groupId: string, optionId: string, selectionMode: 'single' | 'multiple') => {
    setSelectedOptions((prev) => {
      const existing = prev[groupId] ?? [];
      if (selectionMode === 'single') {
        return { ...prev, [groupId]: [optionId] };
      }
      const next = existing.includes(optionId)
        ? existing.filter((id) => id !== optionId)
        : [...existing, optionId];
      return { ...prev, [groupId]: next };
    });
  };

  const handleAddToCart = async () => {
    if (!product.inStock) {
      Alert.alert(t('category.outOfStock'), t('category.outOfStock'));
      return;
    }
    if (!ensureCustomizationValid()) return;
    if (!isAuthenticated) {
      Alert.alert(
        t('product.loginRequired', { defaultValue: 'Login required' }),
        t('product.loginToAddToCart', { defaultValue: 'Please log in to add items to your cart.' }),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('auth.login', 'Log in'), onPress: () => navigateToClientAuth(navigation) }
        ]
      );
      return;
    }
    setAddingToCart(true);
    try {
      const productId = Number(product.id);
      if (!Number.isFinite(productId)) {
        Alert.alert(t('common.error', 'Error'), t('product.invalidProduct', { defaultValue: 'Invalid product.' }));
        return;
      }
      await addCartItem(
        productId,
        quantity,
        selectedOptionIds.length ? selectedOptionIds : undefined
      );
      refreshCartBadge();
      Alert.alert(
        t('product.addedToCart'),
        `${product.name} (Qty: ${quantity})`,
        [
          {
            text: t('product.continueShopping'),
            style: 'cancel',
            onPress: () => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Main', { screen: 'Store' });
              }
            },
          },
          { text: t('product.viewCart'), onPress: () => navigation.navigate('Cart') },
        ]
      );
    } catch (err: any) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message || t('product.addToCartFailed', { defaultValue: 'Failed to add to cart. Please try again.' });
      if (status === 401) {
        Alert.alert(
          t('product.loginRequired', { defaultValue: 'Login required' }),
          t('product.loginToAddToCart', { defaultValue: 'Please log in to add items to your cart.' }),
          [{ text: t('common.ok', 'OK') }]
        );
      } else {
        Alert.alert(t('common.error', 'Error'), message);
      }
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product.inStock) {
      Alert.alert(t('category.outOfStock'), t('category.outOfStock'));
      return;
    }
    if (!ensureCustomizationValid()) return;

    if (!ensureMinimumOrderAmount(buyNowMinCheckTotalWithOptions, currency, t)) {
      return;
    }

    if (!isAuthenticated) {
      Alert.alert(
        t('product.loginRequired', { defaultValue: 'Login required' }),
        t('product.loginToBuyNow', { defaultValue: 'Please log in to continue with Buy Now.' }),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('auth.login', 'Log in'), onPress: () => navigateToClientAuth(navigation) },
        ]
      );
      return;
    }

    const productId = Number(product.id);
    if (!Number.isFinite(productId)) {
      Alert.alert(t('common.error', 'Error'), t('product.invalidProduct', { defaultValue: 'Invalid product.' }));
      return;
    }

    setBuyingNow(true);
    try {
      const res = await getBuyNowSummary(productId, quantity, {
        selected_option_ids: selectedOptionIds.length ? selectedOptionIds : undefined,
      });
      if (res?.item && res?.order_summary) {
        const buyNowTotal = Number(res.order_summary.total) || 0;
        const buyNowCurrency = res.order_summary.currency || t('orders.currency', { defaultValue: 'AED' });
        if (!ensureMinimumOrderAmount(buyNowTotal, buyNowCurrency, t)) {
          return;
        }
        navigation.navigate('Checkout', {
          cartItems: [
            {
              id: String(res.item.id || res.item.product_id),
              productId: String(res.item.product_id),
              name: res.item.name,
              price: res.item.current_price,
              originalPrice: res.item.original_price ?? undefined,
              image: res.item.image_url || product.image,
              color: '',
              size: '',
              quantity: res.item.quantity,
              categoryId: res.item.category_id ?? undefined,
              serviceId: (res.item as { service_id?: number }).service_id ?? undefined,
            },
          ],
          total: res.order_summary.total,
          buyNowSummary: res.order_summary,
          isBuyNow: true,
          selectedOptionIds: selectedOptionIds.length ? selectedOptionIds : undefined,
        });
        return;
      }

      const estimatedTotal = product.price * quantity;
      const fallbackCurrency = t('orders.currency', { defaultValue: 'AED' });
      if (!ensureMinimumOrderAmount(estimatedTotal, fallbackCurrency, t)) {
        return;
      }
      navigation.navigate('Checkout', {
        cartItems: [
          {
            id: product.id,
            productId: product.id,
            name: product.name,
            price: product.price,
            originalPrice: product.originalPrice > product.price ? product.originalPrice : undefined,
            image: product.image,
            color: '',
            size: '',
            quantity,
          },
        ],
        isBuyNow: true,
        selectedOptionIds: selectedOptionIds.length ? selectedOptionIds : undefined,
      });
    } catch (err: any) {
      const status = err.response?.status;
      const message =
        err.response?.data?.message ||
        err.message ||
        t('checkout.orderSummaryError', { defaultValue: 'Failed to load order summary.' });
      if (status === 401) {
        Alert.alert(
          t('product.loginRequired', { defaultValue: 'Login required' }),
          t('product.loginToBuyNow', { defaultValue: 'Please log in to continue with Buy Now.' }),
          [{ text: t('common.ok', 'OK') }]
        );
      } else {
        Alert.alert(t('common.error', 'Error'), message);
      }
    } finally {
      setBuyingNow(false);
    }
  };

  const increaseQuantity = () => {
    if (quantity < 10) {
      setQuantity(quantity + 1);
    }
  };

  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  if (!product) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Header title={t('product.details')} showBack={true} showCart={true} cartItemCount={cartItemCount} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('product.loading', { defaultValue: 'Loading…' })}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header 
        title={t('product.details')}
        showBack={true}
        showCart={true}
        cartItemCount={cartItemCount}
      />
      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      )}
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          {product.image ? (
            <Image
              source={{ uri: product.image }}
              style={styles.productImage}
              contentFit="cover"
              transition={200}
              cachePolicy="disk"
            />
          ) : (
            <View style={styles.productImageEmpty}>
              <Ionicons name="image-outline" size={26} color={COLORS.textSecondary} />
              <Text style={styles.productImageEmptyText}>{t('home.noImage', { defaultValue: 'No image' })}</Text>
            </View>
          )}
          {product.badge && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{t(`product.badges.${String(product.badge).toLowerCase().replace(/\s+/g, '')}`, { defaultValue: product.badge })}</Text>
            </View>
          )}
          {!product.inStock && (
            <View style={styles.outOfStockOverlay}>
              <Text style={styles.outOfStockText}>{t('category.outOfStock')}</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{t(`products.items.${product.id}.name`, { defaultValue: product.name })}</Text>
          
          <View style={styles.ratingContainer}>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= product.rating ? "star" : "star-outline"}
                  size={20}
                  color={star <= product.rating ? COLORS.warning : COLORS.border}
                />
              ))}
            </View>
            <Text style={styles.ratingText}>{product.rating}</Text>
            <Text style={styles.reviewsText}>({product.reviews} {t('product.reviews')})</Text>
          </View>

          <View style={styles.priceContainer}>
            <Text style={styles.currentPrice}>{t('orders.currency', { defaultValue: 'AED' })} {product.price}</Text>
            {product.originalPrice > product.price && (
              <Text style={styles.originalPrice}>{t('orders.currency', { defaultValue: 'AED' })} {product.originalPrice}</Text>
            )}
            {product.originalPrice > product.price && (
              <View style={styles.discountBadge}>
                 <Text style={styles.discountText}>
                   {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% {t('product.off')}
                 </Text>
              </View>
            )}
          </View>

          {/* Quantity Selection */}
          <View style={styles.quantitySection}>
            <Text style={styles.sectionTitle}>{t('product.quantity')}</Text>
            <View style={styles.quantityContainer}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={decreaseQuantity}
                disabled={quantity <= 1}
              >
                <Ionicons 
                  name="remove" 
                  size={20} 
                  color={quantity <= 1 ? COLORS.border : COLORS.text} 
                />
              </TouchableOpacity>
              
              <Text style={styles.quantityText}>{quantity}</Text>
              
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={increaseQuantity}
                disabled={quantity >= 10}
              >
                <Ionicons 
                  name="add" 
                  size={20} 
                  color={quantity >= 10 ? COLORS.border : COLORS.text} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Product Description */}
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>{t('product.description')}</Text>
            <Text style={styles.descriptionText}>
              {product.description || t('product.noDescription', { defaultValue: 'No description available.' })}
            </Text>
          </View>

          {(product.estimatedArrival || product.jobDuration) ? (
            <View style={styles.serviceTimingSection}>
              <Text style={styles.sectionTitle}>
                {t('product.serviceTiming', { defaultValue: 'Service timing' })}
              </Text>
              <View style={styles.serviceTimingCard}>
                {product.estimatedArrival ? (
                  <View style={styles.serviceTimingRow}>
                    <Ionicons name="navigate-outline" size={22} color={COLORS.primary} style={styles.serviceTimingIcon} />
                    <View style={styles.serviceTimingTextCol}>
                      <Text style={styles.serviceTimingLabel}>
                        {t('product.estimatedArrival', { defaultValue: 'Estimated arrival' })}
                      </Text>
                      <Text style={styles.serviceTimingValue}>{product.estimatedArrival}</Text>
                    </View>
                  </View>
                ) : null}
                {product.jobDuration ? (
                  <View style={[styles.serviceTimingRow, product.estimatedArrival && styles.serviceTimingRowSpaced]}>
                    <Ionicons name="hourglass-outline" size={22} color={COLORS.primary} style={styles.serviceTimingIcon} />
                    <View style={styles.serviceTimingTextCol}>
                      <Text style={styles.serviceTimingLabel}>
                        {t('product.jobDuration', { defaultValue: 'Job duration' })}
                      </Text>
                      <Text style={styles.serviceTimingValue}>{product.jobDuration}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {customization?.groups?.length ? (
            <View style={styles.customizationSection}>
              <Text style={styles.sectionTitle}>
                {t('product.customizationTitle', { defaultValue: 'Product options' })}
              </Text>
              {customization.groups.map((group) => {
                const chosen = selectedOptions[group.id] ?? [];
                return (
                  <View key={group.id} style={styles.customizationGroup}>
                    <View style={styles.customizationHead}>
                      <Text style={styles.customizationTitle}>{group.title}</Text>
                      <Text style={styles.customizationTag}>
                        {group.required
                          ? t('product.required', { defaultValue: 'Required' })
                          : t('product.optional', { defaultValue: 'Optional' })}
                      </Text>
                    </View>
                    {group.subtitle ? (
                      <Text style={styles.customizationSubtitle}>{group.subtitle}</Text>
                    ) : null}
                    {group.options.map((opt) => {
                      const isSelected = chosen.includes(opt.id);
                      const priceText =
                        opt.priceDelta > 0
                          ? `+${opt.priceDelta.toFixed(2)} ${currency}`
                          : t('product.free', { defaultValue: 'Free' });
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                          onPress={() => toggleOption(group.id, opt.id, group.selectionMode)}
                        >
                          <View style={styles.optionCheckWrap}>
                            <Ionicons
                              name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                              size={20}
                              color={isSelected ? COLORS.primary : COLORS.textSecondary}
                            />
                          </View>
                          {opt.imageUrl ? (
                            <Image
                              source={{ uri: opt.imageUrl }}
                              style={styles.optionThumb}
                              contentFit="cover"
                            />
                          ) : null}
                          <View style={styles.optionTextWrap}>
                            <Text style={styles.optionName}>{opt.label}</Text>
                            {opt.subtitle ? (
                              <Text style={styles.optionSubtitle}>{opt.subtitle}</Text>
                            ) : null}
                          </View>
                          <Text style={[styles.optionPrice, opt.priceDelta <= 0 && styles.optionPriceFree]}>
                            {priceText}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          ) : null}

          {product.features && product.features.length > 0 ? (
            <View style={styles.featuresSection}>
              <Text style={styles.sectionTitle}>{t('product.features')}</Text>
              {product.features.map((feature: string, index: number) => (
                <View key={index} style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[styles.addToCartButton, (!product.inStock || addingToCart) && styles.disabledButton]}
          onPress={handleAddToCart}
          disabled={!product.inStock || addingToCart}
        >
          {addingToCart ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="cart-outline" size={20} color={COLORS.primary} />
          )}
          <Text style={styles.addToCartText}>{addingToCart ? t('common.loading', 'Loading…') : t('product.addToCart')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.buyNowButton, (!product.inStock || buyingNow) && styles.disabledButton]}
          onPress={handleBuyNow}
          disabled={!product.inStock || buyingNow}
        >
          {buyingNow ? (
            <ActivityIndicator size="small" color={COLORS.background} />
          ) : (
            <Text style={styles.buyNowText}>{buyNowButtonLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  imageContainer: {
    position: 'relative',
    height: 300,
    backgroundColor: COLORS.surface,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productImageEmpty: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  productImageEmptyText: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  badgeContainer: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  badgeText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  outOfStockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
  },
  productInfo: {
    padding: SPACING.lg,
  },
  productName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
    lineHeight: 28,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  ratingStars: {
    flexDirection: 'row',
    marginRight: SPACING.sm,
  },
  ratingText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginRight: 4,
  },
  reviewsText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  currentPrice: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    marginRight: SPACING.md,
  },
  originalPrice: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
    marginRight: SPACING.md,
  },
  discountBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  discountText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  sizeSection: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  sizeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  sizeButton: {
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  sizeButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  sizeButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  sizeButtonTextSelected: {
    color: COLORS.background,
  },
  quantitySection: {
    marginBottom: SPACING.lg,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  quantityText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    minWidth: 30,
    textAlign: 'center',
  },
  descriptionSection: {
    marginBottom: SPACING.lg,
  },
  customizationSection: {
    marginBottom: SPACING.lg,
  },
  customizationGroup: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.sm,
  },
  customizationHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  customizationTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  customizationTag: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  customizationSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.xs,
  },
  optionRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '12',
  },
  optionCheckWrap: {
    marginRight: SPACING.sm,
  },
  optionThumb: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.border,
  },
  optionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  optionName: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  optionSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  optionPrice: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
    marginLeft: SPACING.sm,
  },
  optionPriceFree: {
    color: COLORS.success,
  },
  serviceTimingSection: {
    marginBottom: SPACING.lg,
  },
  serviceTimingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  serviceTimingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  serviceTimingRowSpaced: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  serviceTimingIcon: {
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  serviceTimingTextCol: {
    flex: 1,
    minWidth: 0,
  },
  serviceTimingLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  serviceTimingValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  featureText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.md,
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    gap: SPACING.xs,
  },
  addToCartText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
  buyNowButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  buyNowText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.background,
  },
  disabledButton: {
    opacity: 0.5,
  },
  loadingBar: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
});

export default ProductDetailScreen;
