import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';
import { publicServiceService, PublicServiceProduct } from '../../services/publicServiceService';
import { buildFullImageUrl } from '../../config/api';
import { useCartBadgeCount } from '../../hooks/useCartBadgeCount';

/** Shape expected by ProductDetail screen */
interface ProductDetailDisplay {
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
}

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=60';
const { width: screenWidth } = Dimensions.get('window');

const ServiceProductsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const route = useRoute<any>();
  const serviceId = route.params?.serviceId ?? 0;
  const serviceName = route.params?.serviceName ?? t('services.title', 'Service');
  const { count: cartItemCount } = useCartBadgeCount();

  const [products, setProducts] = useState<PublicServiceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [comingSoonShown, setComingSoonShown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!serviceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    publicServiceService
      .getProductsByServiceId(serviceId)
      .then((list) => {
        if (cancelled) return;
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [serviceId]);

  // When loading finishes and there are no products, show Coming Soon popup once
  useEffect(() => {
    if (!loading && products.length === 0 && serviceId && !comingSoonShown) {
      setComingSoonShown(true);
      Alert.alert(
        t('serviceProducts.comingSoonTitle', 'Coming Soon'),
        t('serviceProducts.comingSoonMessage', 'Products for this service are not available yet. Check back later!'),
        [{ text: t('common.done', 'OK'), onPress: () => navigation.goBack() }]
      );
    }
  }, [loading, products.length, serviceId, comingSoonShown, navigation, t]);

  const getProductImage = useCallback((p: PublicServiceProduct) => {
    const raw = p.image_url ?? (p.main_image as any)?.image_url ?? p.image;
    if (typeof raw === 'string' && raw.trim()) {
      return raw.startsWith('http') ? raw : buildFullImageUrl(raw);
    }
    return FALLBACK_IMAGE;
  }, []);

  const toDetailProduct = useCallback((p: PublicServiceProduct): ProductDetailDisplay => {
    const priceNum = typeof p.price === 'string' ? parseFloat(p.price) || 0 : (p.price ?? 0);
    return {
      id: String(p.id),
      name: p.name,
      price: priceNum,
      originalPrice: priceNum,
      rating: 4.5,
      reviews: 0,
      image: getProductImage(p),
      badge: '',
      inStock: (p.stock ?? 0) > 0,
      description: p.description ?? undefined,
      features: [],
    };
  }, [getProductImage]);

  const renderProductCard = ({ item }: { item: PublicServiceProduct }) => {
    const detail = toDetailProduct(item);
    const imageUri = getProductImage(item);
    const priceNum = typeof item.price === 'string' ? parseFloat(item.price) || 0 : (item.price ?? 0);
    const inStock = (item.stock ?? 0) > 0;
    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => navigation.navigate('ProductDetail', { product: detail })}
      >
        <View style={styles.productImageContainer}>
          <Image source={{ uri: imageUri }} style={styles.productImage} contentFit="cover" />
          {!inStock && (
            <View style={styles.outOfStockOverlay}>
              <Text style={styles.outOfStockText}>{t('product.outOfStock', 'Out of Stock')}</Text>
            </View>
          )}
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.currentPrice}>{t('orders.currency', { defaultValue: 'AED' })} {priceNum}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!serviceId) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title={serviceName} showBack showCart cartItemCount={cartItemCount} />
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>{t('serviceProducts.invalidService', 'Invalid service')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header title={serviceName} showBack showCart cartItemCount={cartItemCount} />

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('serviceProducts.loading', 'Loading products…')}</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.centerWrap}>
          <Ionicons name="time-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.comingSoonTitle}>{t('serviceProducts.comingSoonTitle', 'Coming Soon')}</Text>
          <Text style={styles.comingSoonSub}>{t('serviceProducts.comingSoonMessage', 'Products for this service are not available yet.')}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>{t('common.back', 'Go back')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProductCard}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.productRow}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: { marginTop: SPACING.md, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  errorText: { fontSize: FONT_SIZES.sm, color: COLORS.error },
  comingSoonTitle: {
    marginTop: SPACING.lg,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  comingSoonSub: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  backBtnText: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.background },
  listContent: { padding: SPACING.md, paddingBottom: SPACING.xl * 2 },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  productCard: {
    width: (screenWidth - SPACING.md * 3) / 2,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productImageContainer: {
    position: 'relative',
    height: 150,
  },
  productImage: { width: '100%', height: '100%' },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockText: { color: COLORS.background, fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold },
  productInfo: { padding: SPACING.sm },
  productName: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.medium, color: COLORS.text },
  priceContainer: { marginTop: 4 },
  currentPrice: { fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold, color: COLORS.primary },
});

export default ServiceProductsScreen;
