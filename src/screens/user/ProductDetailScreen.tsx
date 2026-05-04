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
import { shopService, ShopProduct } from '../../services/shopService';
import { addCartItem, getBuyNowSummary } from '../../services/cartService';
import { useIsAuthenticated } from '../../store';

const { width: screenWidth } = Dimensions.get('window');
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1200&q=60';

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
  const imageUrl = p.image_url ?? (p.main_image as any)?.image_url ?? p.image ?? FALLBACK_IMAGE;
  const image = typeof imageUrl === 'string' ? imageUrl : FALLBACK_IMAGE;
  return {
    id: String(p.id),
    name: p.name,
    price: priceNum,
    originalPrice: compareNum,
    rating: 4.5,
    reviews: 0,
    image,
    badge: '',
    inStock: (p.stock ?? 0) > 0,
    description: p.description ?? undefined,
    features: [],
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
  const isAuthenticated = useIsAuthenticated();

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

  const handleAddToCart = async () => {
    if (!product.inStock) {
      Alert.alert(t('category.outOfStock'), t('category.outOfStock'));
      return;
    }
    if (!isAuthenticated) {
      Alert.alert(
        t('product.loginRequired', { defaultValue: 'Login required' }),
        t('product.loginToAddToCart', { defaultValue: 'Please log in to add items to your cart.' }),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('auth.login', 'Log in'), onPress: () => navigation.navigate('Main', { screen: 'Profile' }) }
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
      await addCartItem(productId, quantity);
      Alert.alert(
        t('product.addedToCart'),
        `${product.name} (Qty: ${quantity})`,
        [
          { text: t('product.continueShopping'), style: 'cancel' },
          { text: t('product.viewCart'), onPress: () => navigation.navigate('Cart') }
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

    if (!isAuthenticated) {
      Alert.alert(
        t('product.loginRequired', { defaultValue: 'Login required' }),
        t('product.loginToBuyNow', { defaultValue: 'Please log in to continue with Buy Now.' }),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('auth.login', 'Log in'), onPress: () => navigation.navigate('Main', { screen: 'Profile' }) },
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
      const res = await getBuyNowSummary(productId, quantity);
      if (res?.item && res?.order_summary) {
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
            },
          ],
          total: res.order_summary.total,
          buyNowSummary: res.order_summary,
          isBuyNow: true,
        });
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
        <Header title={t('product.details')} showBack={true} showCart={true} />
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
      />
      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      )}
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: product.image || FALLBACK_IMAGE }}
            style={styles.productImage}
            contentFit="cover"
            transition={200}
            cachePolicy="disk"
          />
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
            <Text style={styles.buyNowText}>{t('product.buyNow')}</Text>
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
