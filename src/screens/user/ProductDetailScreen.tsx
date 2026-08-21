import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { shopService, ShopProduct, isShopProductInStock, resolveShopProductStock } from '../../services/shopService';
import { addCartItem, getBuyNowSummary } from '../../services/cartService';
import { getShopSettings, ShopSettings } from '../../services/shopSettingsService';
import { useIsAuthenticated } from '../../store';
import { useCartBadgeCount } from '../../hooks/useCartBadgeCount';
import { ensureMinimumOrderAmount } from '../../utils/shopOrderMinimum';
import {
  mapShopApiOptionGroupsToCustomization,
  selectedOptionsToIds,
  validateRequiredProductOptions,
  validateSelectedOptionsForCartApi,
} from '../../utils/productSelectedOptions';
import { navigateToClientAuth } from '../../navigation/clientAuthNavigation';
import type { ProductCustomizationConfig } from '../../types/productCustomization';
import { formatDisplayDate } from '../../services/schedulingMockService';
import {
  isPastBookingSlotInDubai,
  parseSlotLabelToMinutes,
  splitSlotLabel,
} from '../../utils/dubaiTime';

const mapApiOptionGroupsToCustomization = mapShopApiOptionGroupsToCustomization;

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
  /** Available stock units from shop API (caps quantity picker). */
  stock?: number;
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
    stock: resolveShopProductStock(p),
    description: p.description ?? undefined,
    features: [],
    estimatedArrival: p.estimated_arrival ?? undefined,
    jobDuration: p.job_duration ?? undefined,
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
  /** Booking from GET /shop/products/:id (`data.booking`) */
  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(null);
  const [selectedSlotLabel, setSelectedSlotLabel] = useState<string>('');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const isAuthenticated = useIsAuthenticated();
  const { count: cartItemCount, refresh: refreshCartBadge } = useCartBadgeCount();

  const booking = apiProduct?.booking ?? null;
  const bookingEnabled = Boolean(booking?.enabled);
  const bookingDates = booking?.dates ?? [];
  const bookingSlots = useMemo(() => {
    const slots = booking?.slots ?? [];
    return [...slots].sort((a, b) => {
      const am = parseSlotLabelToMinutes(a.time) ?? Number.MAX_SAFE_INTEGER;
      const bm = parseSlotLabelToMinutes(b.time) ?? Number.MAX_SAFE_INTEGER;
      return am - bm;
    });
  }, [booking?.slots]);

  const selectDate = useCallback(
    async (date: string, available: boolean) => {
      if (!available || !initialProduct?.id) return;
      if (selectedDateIso === date) return;
      setSelectedDateIso(date);
      setSelectedSlotLabel('');
      setSlotsLoading(true);
      try {
        const data = await shopService.getProductById(initialProduct.id, { date });
        if (data) {
          setApiProduct(data);
          const nextSelected = data.booking?.selected_date || date;
          setSelectedDateIso(nextSelected);
        }
      } finally {
        setSlotsLoading(false);
      }
    },
    [initialProduct?.id, selectedDateIso]
  );

  const shiftWeek = useCallback(
    async (delta: number) => {
      if (!initialProduct?.id || !bookingDates.length) return;
      const first = bookingDates[0]?.date;
      if (!first) return;
      const d = new Date(first + 'T12:00:00');
      d.setDate(d.getDate() + delta * 7);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setSelectedSlotLabel('');
      setSlotsLoading(true);
      try {
        const data = await shopService.getProductById(initialProduct.id, { date: iso });
        if (data) {
          setApiProduct(data);
          const dates = data.booking?.dates ?? [];
          const preferred =
            data.booking?.selected_date ||
            dates.find((day) => day.available)?.date ||
            dates[0]?.date ||
            null;
          setSelectedDateIso(preferred);
        }
      } finally {
        setSlotsLoading(false);
      }
    },
    [bookingDates, initialProduct?.id]
  );

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
        if (cancelled) return;
        setApiProduct(data);
        const b = data?.booking;
        if (b?.enabled) {
          const preferred =
            b.selected_date ||
            b.dates?.find((day) => day.available)?.date ||
            b.dates?.[0]?.date ||
            null;
          setSelectedDateIso(preferred);
          setSelectedSlotLabel('');
        } else {
          setSelectedDateIso(null);
          setSelectedSlotLabel('');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialProduct?.id]);

  const product = useMemo(() => {
    const fromApi = shopProductToDisplay(apiProduct);
    if (fromApi) return fromApi;
    // Ensure route product id is a numeric catalog id string
    const rid = Number(initialProduct?.id);
    if (initialProduct && Number.isFinite(rid) && rid > 0) {
      return { ...initialProduct, id: String(rid) };
    }
    return initialProduct;
  }, [apiProduct, initialProduct]);

  const maxQuantity = useMemo(() => {
    const stockSource = apiProduct ?? null;
    if (stockSource) {
      const trackOff =
        stockSource.track_quantity === false ||
        stockSource.track_quantity === 0 ||
        stockSource.track_quantity === '0';
      const allowBackorder =
        stockSource.allow_backorder === true ||
        stockSource.allow_backorder === 1 ||
        stockSource.allow_backorder === '1';
      if (trackOff || allowBackorder) {
        const stock = resolveShopProductStock(stockSource);
        return Math.max(stock > 0 ? stock : 9999, 1);
      }
      return Math.max(1, resolveShopProductStock(stockSource));
    }
    const routeStock = Number(product?.stock);
    if (Number.isFinite(routeStock) && routeStock > 0) return routeStock;
    return product?.inStock ? 9999 : 1;
  }, [apiProduct, product?.stock, product?.inStock]);

  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), maxQuantity));
  }, [maxQuantity]);

  useEffect(() => {
    getShopSettings().then(setShopSettings).catch(() => setShopSettings(null));
  }, []);

  // Clear selection if today's chosen slot has already passed (Asia/Dubai).
  useEffect(() => {
    if (!selectedDateIso || !selectedSlotLabel) return;
    if (isPastBookingSlotInDubai(selectedDateIso, selectedSlotLabel)) {
      setSelectedSlotLabel('');
    }
  }, [selectedDateIso, selectedSlotLabel, bookingSlots]);

  useEffect(() => {
    const cfg = mapApiOptionGroupsToCustomization(apiProduct?.option_groups);
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
    () => selectedOptionsToIds(selectedOptions, customization),
    [selectedOptions, customization]
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

  const addToCartSubtotal = useMemo(() => {
    const unitPrice = product.price + selectedOptionsExtra;
    return Math.round(unitPrice * quantity * 100) / 100;
  }, [product.price, selectedOptionsExtra, quantity]);

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

  const ensureScheduleSelected = (): boolean => {
    if (!bookingEnabled) return true;
    const selectedDate = bookingDates.find((d) => d.date === selectedDateIso);
    if (!selectedDateIso || !selectedSlotLabel || !selectedDate?.available) {
      Alert.alert(
        t('product.scheduleRequiredTitle', { defaultValue: 'Select date & time' }),
        t('product.scheduleRequiredBody', {
          defaultValue: 'Please choose an available date and time slot before continuing.',
        })
      );
      return false;
    }
    const slot = bookingSlots.find((s) => s.time === selectedSlotLabel);
    if (!slot || !slot.available || slot.blocked || isPastBookingSlotInDubai(selectedDateIso, selectedSlotLabel)) {
      Alert.alert(
        t('product.scheduleRequiredTitle', { defaultValue: 'Select date & time' }),
        t('product.slotUnavailable', {
          defaultValue: 'That time slot is no longer available. Please pick another.',
        })
      );
      return false;
    }
    return true;
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
    if (!ensureScheduleSelected()) return;
    if (!ensureCustomizationValid()) return;
    const optionApiCheck = validateSelectedOptionsForCartApi(customization, selectedOptions);
    if (!optionApiCheck.valid) {
      Alert.alert(
        t('common.error', 'Error'),
        optionApiCheck.missingGroupTitle
          ? t('product.requiredOptionMissing', {
              defaultValue: 'Please select required option(s) for {{group}}.',
              group: optionApiCheck.missingGroupTitle,
            })
          : t('product.invalidOptions', {
              defaultValue: 'Could not save your selected options. Please try again.',
            })
      );
      return;
    }
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
      if (!Number.isFinite(productId) || productId <= 0) {
        Alert.alert(t('common.error', 'Error'), t('product.invalidProduct', { defaultValue: 'Invalid product.' }));
        return;
      }
      const mustSendOptions = Boolean(customization?.groups?.some((g) => g.required));
      await addCartItem(
        productId,
        quantity,
        mustSendOptions || selectedOptionIds.length > 0 ? selectedOptionIds : undefined,
        {
          booking_date: selectedDateIso || undefined,
          booking_slot: selectedSlotLabel || undefined,
        }
      );
      refreshCartBadge(true);
      Alert.alert(
        t('product.addedToCart'),
        `${product.name} (Qty: ${quantity})\n${formatDisplayDate(selectedDateIso!)} · ${selectedSlotLabel}`,
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
    if (!ensureScheduleSelected()) return;
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
          // Dummy schedule — wire to checkout/order API later
          scheduledDate: selectedDateIso,
          scheduledTime: selectedSlotLabel,
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
        scheduledDate: selectedDateIso,
        scheduledTime: selectedSlotLabel,
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
    if (quantity < maxQuantity) {
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

          {apiProduct?.compare_vendors?.available === true ? (
            <TouchableOpacity
              style={styles.compareVendorsBtn}
              onPress={() =>
                navigation.navigate('VendorCompare', {
                  productId: String(product.id),
                  productName:
                    apiProduct.compare_vendors?.product_name || product.name,
                })
              }
              activeOpacity={0.9}
            >
              <View style={styles.compareDecor} />
              <View style={styles.compareIconWrap}>
                <Ionicons name="git-compare" size={20} color="#fff" />
              </View>
              <View style={styles.compareTextCol}>
                <Text style={styles.compareVendorsText} numberOfLines={1}>
                  {t('vendorCompare.compareButton')}
                </Text>
                <Text style={styles.compareVendorsSub} numberOfLines={1}>
                  {apiProduct.compare_vendors?.vendor_count != null &&
                  apiProduct.compare_vendors.vendor_count > 0
                    ? t('vendorCompare.offersCount', {
                        count: apiProduct.compare_vendors.vendor_count,
                      })
                    : t('vendorCompare.compareHint')}
                </Text>
              </View>
              <View style={styles.compareChevron}>
                <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
              </View>
            </TouchableOpacity>
          ) : null}

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
                disabled={quantity >= maxQuantity}
              >
                <Ionicons 
                  name="add" 
                  size={20} 
                  color={quantity >= maxQuantity ? COLORS.border : COLORS.text} 
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

          {/* Preferred date & time — from product detail `booking` */}
          {bookingEnabled ? (
          <View style={styles.scheduleSection}>
            <Text style={styles.sectionTitle}>
              {t('product.scheduleTitle', { defaultValue: 'Preferred date & time' })}
            </Text>
            <View style={styles.scheduleBanner}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
              <Text style={styles.scheduleBannerText}>
                {t('product.scheduleHint', {
                  defaultValue:
                    'Select an available date and time. Red dates or slots cannot be booked.',
                })}
              </Text>
            </View>

            <View style={styles.scheduleWeekHeader}>
              <TouchableOpacity onPress={() => void shiftWeek(-1)} style={styles.scheduleWeekNav} hitSlop={10}>
                <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <Text style={styles.scheduleLabel}>
                {t('product.scheduleDate', { defaultValue: 'Date' })}
              </Text>
              <TouchableOpacity onPress={() => void shiftWeek(1)} style={styles.scheduleWeekNav} hitSlop={10}>
                <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scheduleChipsScroll}>
              <View style={styles.scheduleChipsRow}>
                {bookingDates.map((day) => {
                  const weekday = day.day || new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
                  const dayNum = day.day_number != null ? String(day.day_number) : String(new Date(day.date + 'T12:00:00').getDate());
                  const month = day.month || new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' });
                  const active = selectedDateIso === day.date;
                  const unavailable = !day.available;
                  return (
                    <TouchableOpacity
                      key={day.date}
                      style={[
                        styles.scheduleDateChip,
                        active && styles.scheduleDateChipActive,
                        unavailable && styles.scheduleDateChipUnavailable,
                      ]}
                      onPress={() => void selectDate(day.date, day.available)}
                      activeOpacity={unavailable ? 1 : 0.85}
                      disabled={unavailable || slotsLoading}
                    >
                      <Text
                        style={[
                          styles.scheduleDateWeekday,
                          active && styles.scheduleDateTextActive,
                          unavailable && styles.scheduleUnavailableText,
                        ]}
                      >
                        {weekday}
                      </Text>
                      <Text
                        style={[
                          styles.scheduleDateDay,
                          active && styles.scheduleDateTextActive,
                          unavailable && styles.scheduleUnavailableText,
                        ]}
                      >
                        {dayNum}
                      </Text>
                      <Text
                        style={[
                          styles.scheduleDateMonth,
                          active && styles.scheduleDateTextActiveMuted,
                          unavailable && styles.scheduleUnavailableText,
                        ]}
                      >
                        {month}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.scheduleTimeHeader}>
              <Text style={styles.scheduleLabel}>
                {t('product.scheduleTime', { defaultValue: 'Time slot' })}
              </Text>
              {selectedSlotLabel ? (
                <View style={styles.scheduleSelectedPill}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
                  <Text style={styles.scheduleSelectedPillText}>{selectedSlotLabel}</Text>
                </View>
              ) : null}
            </View>
            {slotsLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.sm }} />
            ) : !selectedDateIso ? (
              <Text style={styles.scheduleEmpty}>
                {t('product.noSlots', { defaultValue: 'No slots for this day.' })}
              </Text>
            ) : bookingDates.find((d) => d.date === selectedDateIso)?.available === false ? (
              <Text style={styles.scheduleEmpty}>
                {t('product.dateUnavailable', {
                  defaultValue: 'This date is not available for booking.',
                })}
              </Text>
            ) : bookingSlots.length === 0 ? (
              <Text style={styles.scheduleEmpty}>
                {t('product.noSlots', { defaultValue: 'No slots for this day.' })}
              </Text>
            ) : (
              <View style={styles.scheduleSlotsWrap}>
                {bookingSlots.map((slot) => {
                  const past = isPastBookingSlotInDubai(selectedDateIso, slot.time);
                  const available = Boolean(slot.available) && !slot.blocked && !past;
                  const selected = selectedSlotLabel === slot.time && available;
                  const { clock, period } = splitSlotLabel(slot.time);
                  return (
                    <TouchableOpacity
                      key={String(slot.id)}
                      style={[
                        styles.scheduleChip,
                        past
                          ? styles.scheduleChipPast
                          : available
                            ? styles.scheduleChipAvailable
                            : styles.scheduleChipUnavailable,
                        selected && styles.scheduleChipActive,
                      ]}
                      disabled={!available}
                      onPress={() => setSelectedSlotLabel(slot.time)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.scheduleChipInner}>
                        <Text
                          style={[
                            styles.scheduleChipClock,
                            past
                              ? styles.scheduleChipTextPast
                              : available
                                ? styles.scheduleChipTextAvailable
                                : styles.scheduleUnavailableText,
                            selected && styles.scheduleChipTextActive,
                          ]}
                        >
                          {clock}
                        </Text>
                        {period ? (
                          <Text
                            style={[
                              styles.scheduleChipPeriod,
                              past
                                ? styles.scheduleChipTextPast
                                : available
                                  ? styles.scheduleChipPeriodAvailable
                                  : styles.scheduleUnavailableText,
                              selected && styles.scheduleChipPeriodActive,
                            ]}
                          >
                            {period}
                          </Text>
                        ) : null}
                      </View>
                      {selected ? (
                        <View style={styles.scheduleChipCheck}>
                          <Ionicons name="checkmark" size={12} color={COLORS.background} />
                        </View>
                      ) : null}
                      {past ? (
                        <Text style={styles.scheduleChipPastTag}>
                          {t('product.slotPassed', { defaultValue: 'Passed' })}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
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
            <View style={styles.addToCartInner}>
              <View style={styles.addToCartLabelRow}>
                <Ionicons name="cart-outline" size={18} color={COLORS.primary} />
                <Text style={styles.addToCartText} numberOfLines={1}>
                  {t('product.addToCart')}
                </Text>
              </View>
              <Text style={styles.addToCartPrice} numberOfLines={1}>
                {currency} {addToCartSubtotal.toFixed(2)}
              </Text>
            </View>
          )}
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
  compareVendorsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: SPACING.lg,
    backgroundColor: '#E8F2EA',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#C5DBC9',
    overflow: 'hidden',
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  compareDecor: {
    position: 'absolute',
    top: -28,
    right: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(28,75,39,0.08)',
  },
  compareIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareTextCol: {
    flex: 1,
    gap: 2,
  },
  compareVendorsText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primaryDark,
  },
  compareVendorsSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
    opacity: 0.85,
  },
  compareChevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C5DBC9',
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
  },
  scheduleSection: {
    marginBottom: SPACING.lg,
  },
  scheduleBanner: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary + '12',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  scheduleBannerText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  scheduleLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: 0,
  },
  scheduleTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  scheduleSelectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary + '14',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  scheduleSelectedPillText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  scheduleChipsScroll: {
    marginBottom: SPACING.xs,
  },
  scheduleChipsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingRight: SPACING.md,
  },
  scheduleDateChip: {
    width: 64,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleDateChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  scheduleDateChipUnavailable: {
    backgroundColor: '#FEF2F2',
    borderColor: COLORS.error,
  },
  scheduleWeekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  scheduleWeekNav: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scheduleDateWeekday: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  scheduleDateDay: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginVertical: 2,
    lineHeight: FONT_SIZES.xl + 2,
  },
  scheduleDateMonth: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
  },
  scheduleDateTextActive: {
    color: COLORS.background,
  },
  scheduleDateTextActiveMuted: {
    color: 'rgba(255,255,255,0.85)',
  },
  scheduleSlotsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.sm,
  },
  scheduleChip: {
    width: '48.5%',
    minHeight: 64,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#1c4b27',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  scheduleChipInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleChipAvailable: {
    backgroundColor: COLORS.surfaceLight,
    borderColor: COLORS.primary + '55',
  },
  scheduleChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  scheduleChipUnavailable: {
    backgroundColor: '#F3F4F6',
    borderColor: COLORS.border,
    opacity: 0.85,
    shadowOpacity: 0,
    elevation: 0,
  },
  scheduleChipPast: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    shadowOpacity: 0,
    elevation: 0,
  },
  scheduleChipDisabled: {
    opacity: 0.45,
  },
  scheduleChipClock: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  scheduleChipPeriod: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  scheduleChipPeriodAvailable: {
    color: COLORS.primaryLight,
  },
  scheduleChipPeriodActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  scheduleChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  scheduleChipTextAvailable: {
    color: COLORS.primary,
  },
  scheduleChipTextActive: {
    color: COLORS.background,
  },
  scheduleChipTextPast: {
    color: COLORS.error,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  scheduleChipTextDisabled: {
    color: COLORS.textSecondary,
  },
  scheduleChipCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleChipPastTag: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.error,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  scheduleUnavailableText: {
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  scheduleEmpty: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
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
    flex: 1.15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    minHeight: 56,
  },
  addToCartInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  addToCartLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 2,
  },
  addToCartText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  addToCartPrice: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    textAlign: 'center',
  },
  buyNowButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    minHeight: 56,
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
