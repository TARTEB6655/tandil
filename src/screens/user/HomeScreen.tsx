import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  FlatList,
  Linking,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { UserStackParamList } from '../../types';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { ServiceCard } from '../../components/cards/ServiceCard';
import { OrderCard } from '../../components/cards/OrderCard';
import { useAppStore } from '../../store';
import { mockServices, mockOrders } from '../../data/mockData';
import Header from '../../components/common/Header';
import BeforeAfter from '../../components/common/BeforeAfter';
import { useTranslation } from 'react-i18next';
import { getBanners, getBannerImageUrl, Banner } from '../../services/bannerService';
import {
  getMaintenancePhotos,
  getMaintenancePhotoImageUrl,
  MaintenancePhoto,
} from '../../services/maintenancePhotosService';
import { shopService, ShopProductCategory, ShopProduct } from '../../services/shopService';
import { publicServiceService, PublicService } from '../../services/publicServiceService';
import { getExclusiveOffers, PublicExclusiveOffer } from '../../services/exclusiveOffersService';
import { buildFullImageUrl } from '../../config/api';
import { WeatherData } from '../../services/weatherService';
import { getClientNotifications } from '../../services/clientNotificationService';
import { getClientLoyaltyDashboard } from '../../services/loyaltyService';
import { useCartBadgeCount } from '../../hooks/useCartBadgeCount';
import { useIsAuthenticated } from '../../store';
import {
  type DashboardWeatherPermission,
  getCachedDashboardWeather,
  loadDashboardWeather,
  reconcileWeatherCacheWithSystem,
} from '../../utils/dashboardWeather';
import { resolveLocationAccessForApp } from '../../utils/deviceLocation';

const { width: screenWidth } = Dimensions.get('window');

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, orders } = useAppStore();
  const isAuthenticated = useIsAuthenticated();
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [productCategories, setProductCategories] = useState<Array<{ id: string; name: string; image: string | null; products_count?: number; coming_soon?: boolean }>>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [dashboardServices, setDashboardServices] = useState<PublicService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [featuredProducts, setFeaturedProducts] = useState<ShopProduct[]>([]);
  const [featuredProductsLoading, setFeaturedProductsLoading] = useState(true);
  const [exclusiveOffers, setExclusiveOffers] = useState<PublicExclusiveOffer[]>([]);
  const [exclusiveOffersLoading, setExclusiveOffersLoading] = useState(true);
  const [maintenancePhotos, setMaintenancePhotos] = useState<MaintenancePhoto[]>([]);
  const [maintenancePhotosLoading, setMaintenancePhotosLoading] = useState(true);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [locationPermissionStatus, setLocationPermissionStatus] =
    useState<DashboardWeatherPermission | null>(null);
  /** Boolean mirror — avoids ReferenceError if a hot-reload still references `locationPermission`. */
  const locationPermission =
    locationPermissionStatus === 'granted'
      ? true
      : locationPermissionStatus === 'denied'
        ? false
        : null;
  const weatherPromptedRef = useRef(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [loyaltyPoints, setLoyaltyPoints] = useState(user?.loyaltyPoints ?? 0);
  const { count: cartItemCount } = useCartBadgeCount();

  useFocusEffect(
    useCallback(() => {
      getClientNotifications({ per_page: 1, page: 1 })
        .then((res) => setUnreadNotificationCount(res.unreadCount ?? 0))
        .catch(() => setUnreadNotificationCount(0));
      if (isAuthenticated) {
        getClientLoyaltyDashboard()
          .then((dashboard) => setLoyaltyPoints(dashboard.points))
          .catch(() => setLoyaltyPoints(user?.loyaltyPoints ?? 0));
      }
    }, [isAuthenticated, user?.loyaltyPoints])
  );

  const recentOrders = Array.isArray(orders) ? orders.slice(0, 3) : [];
  // Extract first order that has before/after photos in its tracking (if any)
  const orderWithPhotos: any | undefined = Array.isArray(orders)
    ? orders.find((o: any) => Array.isArray(o.tracking) && o.tracking.some((t: any) => t.photos && ((t.photos.before && t.photos.before.length) || (t.photos.after && t.photos.after.length))))
    : undefined;
  const photoStep: any | undefined = orderWithPhotos?.tracking?.find((t: any) => t.photos && ((t.photos.before && t.photos.before.length) || (t.photos.after && t.photos.after.length)));
  
  // Ensure orders are initialized
  useEffect(() => {
    if (!Array.isArray(orders)) {
      console.log('Orders not initialized yet:', orders);
    }
  }, [orders]);
  
  // Main service categories with their sub-services (Agriculture)
  const serviceCategories = [
    {
      id: 'watering',
      name: t('home.categories.watering.name'),
      description: t('home.categories.watering.description'),
      icon: 'water-outline',
      services: t('home.categories.watering.services', { returnObjects: true }) as string[],
    },
    {
      id: 'planting',
      name: t('home.categories.planting.name'),
      description: t('home.categories.planting.description'),
      icon: 'leaf-outline',
      services: t('home.categories.planting.services', { returnObjects: true }) as string[],
    },
    {
      id: 'cleaning',
      name: t('home.categories.cleaning.name'),
      description: t('home.categories.cleaning.description'),
      icon: 'brush-outline',
      services: t('home.categories.cleaning.services', { returnObjects: true }) as string[],
    },
    {
      id: 'care',
      name: t('home.categories.care.name'),
      description: t('home.categories.care.description'),
      icon: 'construct-outline',
      services: t('home.categories.care.services', { returnObjects: true }) as string[],
    }
  ];

  // Helper functions for order status
  const getOrderIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'time-outline';
      case 'confirmed':
        return 'checkmark-circle-outline';
      case 'in_progress':
        return 'construct-outline';
      case 'completed':
        return 'checkmark-circle';
      case 'cancelled':
        return 'close-circle-outline';
      default:
        return 'document-outline';
    }
  };

  const getOrderColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return COLORS.warning;
      case 'confirmed':
        return COLORS.primary;
      case 'in_progress':
        return COLORS.info;
      case 'completed':
        return COLORS.success;
      case 'cancelled':
        return COLORS.error;
      default:
        return COLORS.textSecondary;
    }
  };

  // Weather condition → Ionicons name for widget
  const getWeatherIcon = (condition: string) => {
    const c = condition.toLowerCase();
    if (c.includes('clear')) return 'sunny';
    if (c.includes('fog') || c.includes('mist')) return 'cloudy';
    if (c.includes('rain') || c.includes('drizzle')) return 'rainy';
    if (c.includes('snow')) return 'snow';
    if (c.includes('thunder')) return 'thunderstorm';
    if (c.includes('cloud')) return 'partly-sunny';
    return 'partly-sunny';
  };

  // Helper function for service icons
  const getServiceIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'watering':
        return 'water-outline';
      case 'planting':
        return 'leaf-outline';
      case 'cleaning':
        return 'brush-outline';
      case 'care':
        return 'construct-outline';
      default:
        return 'construct-outline';
    }
  };

  // Fetch banners from API (priority-ordered); fallback slides when none; prefetch images for fast display
  useEffect(() => {
    let cancelled = false;
    setBannersLoading(true);
    getBanners()
      .then((list) => {
        if (!cancelled) {
          setBanners(list);
          const uris = list.map((b) => getBannerImageUrl(b)).filter(Boolean) as string[];
          if (uris.length > 0) Image.prefetch(uris, { cachePolicy: 'disk' }).catch(() => {});
        }
      })
      .finally(() => {
        if (!cancelled) setBannersLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMaintenancePhotosLoading(true);
    getMaintenancePhotos(20)
      .then((list) => {
        if (!cancelled) setMaintenancePhotos(list);
      })
      .finally(() => {
        if (!cancelled) setMaintenancePhotosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getMaintenancePhotos(20).then((list) => {
        if (!cancelled) setMaintenancePhotos(list);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const applyWeatherResult = useCallback(
    (result: {
      weather: WeatherData | null;
      permissionStatus?: DashboardWeatherPermission;
      permissionGranted?: boolean;
    }) => {
      const status: DashboardWeatherPermission =
        result.permissionStatus ??
        (result.permissionGranted === true
          ? 'granted'
          : result.permissionGranted === false
            ? 'denied'
            : 'undetermined');
      setLocationPermissionStatus(status);
      setWeather(result.weather);
    },
    []
  );

  const refreshDashboardWeather = useCallback(
    async (options?: { force?: boolean; requestPermission?: boolean }) => {
      const force = options?.force ?? false;
      const requestPermission = options?.requestPermission ?? false;

      if (!force) {
        const cached = getCachedDashboardWeather(isAuthenticated);
        if (cached) {
          applyWeatherResult(cached);
          setWeatherLoading(false);
          return;
        }
      }

      setWeatherLoading(true);
      try {
        const result = await loadDashboardWeather(isAuthenticated, { force, requestPermission });
        applyWeatherResult(result);
      } catch {
        setWeather(null);
        resolveLocationAccessForApp()
          .then(setLocationPermissionStatus)
          .catch(() => setLocationPermissionStatus('undetermined'));
      } finally {
        setWeatherLoading(false);
      }
    },
    [applyWeatherResult, isAuthenticated]
  );

  useEffect(() => {
    if (weatherPromptedRef.current) return;
    weatherPromptedRef.current = true;
    refreshDashboardWeather({ requestPermission: true });
  }, [refreshDashboardWeather]);

  const prevAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    if (prevAuthenticatedRef.current === isAuthenticated) return;
    prevAuthenticatedRef.current = isAuthenticated;
    refreshDashboardWeather({ force: true, requestPermission: false });
  }, [isAuthenticated, refreshDashboardWeather]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const livePermission = await reconcileWeatherCacheWithSystem(isAuthenticated);
        if (cancelled) return;

        setLocationPermissionStatus(livePermission);

        const cached = getCachedDashboardWeather(isAuthenticated);
        if (cached?.weather) {
          applyWeatherResult(cached);
          setWeatherLoading(false);
          return;
        }

        if (livePermission === 'granted') {
          await refreshDashboardWeather({ force: true, requestPermission: false });
          return;
        }

        if (cached) {
          applyWeatherResult(cached);
        }
        setWeatherLoading(false);
      })();

      return () => {
        cancelled = true;
      };
    }, [applyWeatherResult, isAuthenticated, refreshDashboardWeather])
  );

  const showLocationSettingsAlert = useCallback(() => {
    Alert.alert(
      t('home.weather.permissionTitle', 'Location access is off'),
      isAuthenticated
        ? t(
            'home.weather.permissionMessage',
            'Enable location access for Tandil in your phone Settings to show local weather on your dashboard.'
          )
        : t(
            'home.weather.permissionMessageGuest',
            'No account is required. Enable location for Tandil in your phone Settings to show local weather while you browse.'
          ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('checkout.openSettings', 'Open Settings'),
          onPress: () => {
            Linking.openSettings().catch(() => {});
          },
        },
      ]
    );
  }, [isAuthenticated, t]);

  const handleWeatherCardPress = useCallback(async () => {
    if (weatherLoading) return;
    if (weather) return;

    const livePermission = await resolveLocationAccessForApp({ requestIfNeeded: true });
    setLocationPermissionStatus(livePermission);

    if (livePermission === 'denied') {
      showLocationSettingsAlert();
      return;
    }

    await refreshDashboardWeather({
      force: true,
      requestPermission: false,
    });
  }, [weather, weatherLoading, refreshDashboardWeather, showLocationSettingsAlert]);

  const renderWeatherPrompt = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    subtitle: string
  ) => (
    <View style={styles.weatherPromptRow}>
      <View style={styles.weatherIconCircle}>
        <Ionicons name={icon} size={26} color="#fff" />
      </View>
      <View style={styles.weatherPromptTextCol}>
        <Text style={styles.weatherPromptTitle}>{title}</Text>
        <Text style={styles.weatherPromptSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.75)" />
    </View>
  );

  // Fetch public services for Place Service Orders (GET /services?per_page=12, no auth)
  useEffect(() => {
    let cancelled = false;
    setServicesLoading(true);
    publicServiceService
      .getServices({ per_page: 12 })
      .then((list) => {
        if (!cancelled) setDashboardServices(list);
        const uris = list
          .map((s) => s.image_url || (s.image ? buildFullImageUrl(s.image) : null))
          .filter(Boolean) as string[];
        if (uris.length > 0) Image.prefetch(uris, { cachePolicy: 'disk' }).catch(() => {});
      })
      .finally(() => {
        if (!cancelled) setServicesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Fetch featured products (GET /shop/products/featured?limit=10) – show first 3 on Home, View All shows all
  useEffect(() => {
    let cancelled = false;
    setFeaturedProductsLoading(true);
    shopService
      .getFeaturedProducts(10)
      .then((list) => {
        if (!cancelled) setFeaturedProducts(list);
        const uris = list
          .map((p) => p.image_url ?? (p.main_image as any)?.image_url ?? p.image)
          .filter((u): u is string => typeof u === 'string' && u.length > 0)
          .map((u) => (u.startsWith('http') ? u : buildFullImageUrl(u)));
        if (uris.length > 0) Image.prefetch(uris.slice(0, 6), { cachePolicy: 'disk' }).catch(() => {});
      })
      .catch(() => { if (!cancelled) setFeaturedProducts([]); })
      .finally(() => { if (!cancelled) setFeaturedProductsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Fetch exclusive offers (GET /api/exclusive-offers, no auth) – first 3 for dashboard
  useEffect(() => {
    let cancelled = false;
    setExclusiveOffersLoading(true);
    getExclusiveOffers({ per_page: 3 })
      .then((list) => { if (!cancelled) setExclusiveOffers(list); })
      .catch(() => { if (!cancelled) setExclusiveOffers([]); })
      .finally(() => { if (!cancelled) setExclusiveOffersLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Fetch product categories for Shop by Category (GET /shop/products/categories)
  useEffect(() => {
    let cancelled = false;
    setCategoriesLoading(true);
    shopService
      .getProductCategories()
      .then((list: ShopProductCategory[]) => {
        if (!cancelled) {
          const mapped = list.map((c) => ({
            id: String(c.id),
            name: c.name || '',
            image: c.image_url || (c.image ? buildFullImageUrl(c.image) : null),
            products_count: c.products_count ?? 0,
            coming_soon: c.coming_soon ?? false,
          }));
          setProductCategories(mapped);
          const uris = mapped.map((c) => c.image).filter(Boolean);
          if (uris.length > 0) Image.prefetch(uris, { cachePolicy: 'disk' }).catch(() => {});
        }
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Promotional slider: API banners (priority order) or fallback static slides
  const promotionalSlides = (() => {
    if (banners.length > 0) {
      return banners.map((b) => ({
        id: String(b.id),
        title: b.title || t('home.title'),
        subtitle: b.description || t('home.learnMore'),
        buttonText: b.button_text || t('home.learnMore'),
        buttonLink: b.button_link || null,
        image: getBannerImageUrl(b) || 'https://images.unsplash.com/photo-1461354464878-ad92f492a5a0?w=800',
        backgroundColor: COLORS.primary,
      }));
    }
    return [
      { id: '1', title: t('home.title'), subtitle: t('home.learnMore'), buttonText: t('home.learnMore'), buttonLink: null, image: 'https://images.unsplash.com/photo-1461354464878-ad92f492a5a0?w=800', backgroundColor: COLORS.primary },
      { id: '2', title: t('home.quickActions'), subtitle: t('home.bookService'), buttonText: t('home.learnMore'), buttonLink: null, image: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800', backgroundColor: '#1c4b27' },
      { id: '3', title: t('home.loyaltyPoints'), subtitle: t('home.viewRewards'), buttonText: t('home.learnMore'), buttonLink: null, image: 'https://images.unsplash.com/photo-1506806732259-39c2d0268443?w=800', backgroundColor: '#6D8F5B' },
    ];
  })();

  // Shop by Category: use API categories when available, else static fallback
  const staticCategoryFallback = [
    { id: 'fertilizer', name: t('store.categories.fertilizer', { defaultValue: 'Fertilizer' }), image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=60', products_count: 1, coming_soon: false },
    { id: 'soil', name: t('store.categories.soil', { defaultValue: 'Soil' }), image: 'https://images.unsplash.com/photo-1457530378978-8bac673b8062?auto=format&fit=crop&w=800&q=60', products_count: 1, coming_soon: false },
    { id: 'tools', name: t('store.categories.tools', { defaultValue: 'Tools' }), image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=60', products_count: 1, coming_soon: false },
    { id: 'irrigation', name: t('store.categories.irrigation', { defaultValue: 'Irrigation' }), image: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=800&q=60', products_count: 1, coming_soon: false },
    { id: 'produce', name: t('store.categories.produce', { defaultValue: 'Produce' }), image: 'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=800&q=60', products_count: 1, coming_soon: false },
  ];
  const displayCategories = productCategories.length > 0 ? productCategories : staticCategoryFallback;

  const onBannerButtonPress = useCallback(
    (buttonLink: string | null, bannerTitle?: string) => {
      const openCategory = (category: {
        id: string;
        name: string;
        image: string | null;
        products_count?: number;
        coming_soon?: boolean;
      }) => {
        const noProducts =
          category.coming_soon ||
          (category.products_count !== undefined && category.products_count === 0);
        if (noProducts) {
          Alert.alert(
            t('category.comingSoon', { defaultValue: 'Coming Soon' }),
            t('category.comingSoonMessage', {
              defaultValue: 'Products in this category are coming soon.',
            })
          );
          return;
        }
        navigation.navigate('CategoryProducts', {
          category: {
            id: category.id,
            name: category.name,
            image: category.image ?? '',
          },
        });
      };

      const findCategory = (raw: string | null | undefined) => {
        if (!raw?.trim() || displayCategories.length === 0) return null;
        const needle = raw.trim().toLowerCase();
        const idMatch = needle.match(
          /(?:category|categories|shop\/category)[\/:=\s-]*(\d+)/i
        );
        if (idMatch?.[1]) {
          return (
            displayCategories.find((c) => String(c.id) === idMatch[1]) ?? null
          );
        }
        if (/^\d+$/.test(needle)) {
          return displayCategories.find((c) => String(c.id) === needle) ?? null;
        }
        // Match by name / partial (e.g. "fruits", "Fresh Fruits & Vegetables")
        const byName = displayCategories.find((c) => {
          const name = (c.name || '').toLowerCase();
          return (
            name === needle ||
            name.includes(needle) ||
            needle.includes(name) ||
            needle.split(/[\s&,|/+-]+/).some((token) => token.length > 2 && name.includes(token))
          );
        });
        if (byName) return byName;

        // Common produce keywords → fruits / vegetables category (EN + AR)
        const produceHint =
          /\b(fruit|fruits|vegetable|vegetables|produce|fresh)\b/i.test(needle) ||
          /فواكه|خضروات|خضار/.test(raw);
        if (produceHint) {
          return (
            displayCategories.find((c) => {
              const name = (c.name || '').toLowerCase();
              return (
                /\b(fruit|fruits|vegetable|vegetables|produce)\b/i.test(name) ||
                /فواكه|خضروات|خضار/.test(c.name || '')
              );
            }) ?? null
          );
        }
        return null;
      };

      const link = buttonLink?.trim() || null;

      if (link && (link.startsWith('http://') || link.startsWith('https://'))) {
        // Prefer in-app if URL path still points at a category id
        const fromUrl = findCategory(link);
        if (fromUrl) {
          openCategory(fromUrl);
          return;
        }
        Linking.openURL(link).catch(() => {});
        return;
      }

      const fromLink = findCategory(link);
      if (fromLink) {
        openCategory(fromLink);
        return;
      }

      const fromTitle = findCategory(bannerTitle);
      if (fromTitle) {
        openCategory(fromTitle);
        return;
      }

      // Default: open Store so user can pick a category
      navigation.navigate('Main' as never, { screen: 'Store' } as never);
    },
    [displayCategories, navigation, t]
  );

  const scrollToSlide = (index: number) => {
    if (!flatListRef.current) return;
    const clamped = Math.max(0, Math.min(index, promotionalSlides.length - 1));
    try {
      flatListRef.current.scrollToOffset({ offset: clamped * screenWidth, animated: true });
    } catch {}
    setCurrentSlide(clamped);
  };

  const goPrev = () => scrollToSlide(currentSlide - 1);
  const goNext = () => scrollToSlide(currentSlide + 1);

  const getOfferImageUrl = (offer: PublicExclusiveOffer): string | null => {
    const raw = offer.image_url ?? (offer as any).image ?? (offer as any).image_path;
    if (typeof raw !== 'string' || !raw.trim()) return null;
    return raw.startsWith('http') ? raw : buildFullImageUrl(raw);
  };

  const offerSubtitle = (offer: PublicExclusiveOffer): string =>
    offer.description?.trim() || offer.applies_to?.trim() || '';
  const offerTitle = (offer: PublicExclusiveOffer): string =>
    offer.title?.trim() || t('home.exclusiveOffer', 'Offer');

  // Featured products: first 3 from API for the Home section; View All opens FeaturedProductsScreen
  const featuredProductsFirst3 = featuredProducts.slice(0, 3);
  const getFeaturedProductImage = (p: ShopProduct) => {
    const raw = p.image_url ?? (p.main_image as any)?.image_url ?? p.image;
    if (typeof raw === 'string' && raw.trim()) return raw.startsWith('http') ? raw : buildFullImageUrl(raw);
    return 'https://images.unsplash.com/photo-1461354464878-ad92f492a5a0?w=400';
  };
  const featuredProductToDetail = (p: ShopProduct) => ({
    id: String(p.id),
    name: p.name,
    price: typeof p.price === 'string' ? parseFloat(p.price) || 0 : p.price,
    originalPrice: typeof p.compare_at_price === 'string' ? parseFloat(p.compare_at_price) || 0 : (p.compare_at_price ?? 0),
    rating: 4.5,
    reviews: 0,
    image: getFeaturedProductImage(p),
    badge: '',
    inStock: (p.stock ?? 0) > 0,
    description: p.description ?? undefined,
    features: [] as string[],
  });
  const featuredBadges = [t('home.badges.popular'), t('home.badges.new'), t('home.badges.bestValue')];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header 
        title={t('home.title')}
        showBack={false}
        showLanguage={true}
        showNotifications={true}
        notificationCount={unreadNotificationCount}
        onNotificationPress={() => navigation.navigate('Notifications')}
        showCart={true}
        cartItemCount={cartItemCount}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
      {/* Weather widget – premium card with location, temperature, condition */}
      <TouchableOpacity
        style={styles.weatherCard}
        activeOpacity={weather || weatherLoading ? 1 : 0.85}
        onPress={handleWeatherCardPress}
        disabled={weatherLoading || !!weather}
      >
        <View style={styles.weatherDecorLarge} />
        <View style={styles.weatherDecorSmall} />
        {weatherLoading ? (
          <View style={styles.weatherPromptRow}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.weatherPromptSubtitle}>
              {t('home.weather.loading', 'Getting weather…')}
            </Text>
          </View>
        ) : !weather && locationPermissionStatus === 'denied' ? (
          renderWeatherPrompt(
            'location-outline',
            t('home.weather.settingsTitle', 'Location access is off'),
            isAuthenticated
              ? t('home.weather.settingsSubtitle', 'Tap to open Settings and allow location')
              : t(
                  'home.weather.settingsSubtitleGuest',
                  'Tap to open Settings · no sign-in needed'
                )
          )
        ) : !weather && locationPermissionStatus === 'undetermined' ? (
          renderWeatherPrompt(
            'navigate-outline',
            t('home.weather.enableTitle', 'Local weather'),
            isAuthenticated
              ? t('home.weather.enableSubtitle', 'Tap to allow location for your area')
              : t('home.weather.enableSubtitleGuest', 'Tap to allow location · guests welcome')
          )
        ) : weather ? (
          <>
            <View style={styles.weatherRow}>
              <View style={styles.weatherIconCircle}>
                <Ionicons name={getWeatherIcon(weather.condition) as any} size={40} color="#fff" />
              </View>
              <View style={styles.weatherMain}>
                <View style={styles.weatherTempRow}>
                  <Text style={styles.weatherTemp}>{Math.round(weather.temperature)}</Text>
                  <Text style={styles.weatherTempUnit}>°C</Text>
                </View>
                <View style={styles.weatherConditionPill}>
                  <Text style={styles.weatherConditionText}>{weather.condition}</Text>
                </View>
              </View>
            </View>
            <View style={styles.weatherLocationRow}>
              <Ionicons name="location" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={styles.weatherLocationText} numberOfLines={2}>
                {weather.locationName?.trim() && weather.locationName !== 'Current location'
                  ? weather.locationName
                  : weather.coordinates
                    ? `${t('home.weather.yourLocation', 'Your location')} (${weather.coordinates})`
                    : t('home.weather.currentLocation', 'Current location')}
              </Text>
            </View>
          </>
        ) : (
          renderWeatherPrompt(
            'cloud-outline',
            t('home.weather.refreshTitle', 'Load local weather'),
            t('home.weather.refreshSubtitle', 'Tap to try again')
          )
        )}
      </TouchableOpacity>

      {/* Promotional Slider */}
      <View style={styles.sliderContainer}>
        <FlatList
          ref={flatListRef}
          data={promotionalSlides}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
            setCurrentSlide(index);
          }}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <View style={[styles.slideInner, { backgroundColor: item.backgroundColor || COLORS.primary }]}>
                <View style={styles.slideContent}>
                  <View style={styles.slideTextContainer}>
                    <Text style={styles.slideTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.slideSubtitle} numberOfLines={2}>{item.subtitle}</Text>
                    <TouchableOpacity
                      style={styles.slideButton}
                      onPress={() => onBannerButtonPress(item.buttonLink ?? null, item.title)}
                    >
                      <Text style={styles.slideButtonText}>{item.buttonText}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.slideImageContainer}>
                    <Image
                      source={{ uri: item.image }}
                      style={styles.slideImage}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="disk"
                    />
                  </View>
                </View>
              </View>
            </View>
          )}
          keyExtractor={(item) => item.id}
        />

        {/* Left/Right Arrows */}
        <TouchableOpacity
          onPress={goPrev}
          activeOpacity={0.8}
          disabled={currentSlide === 0}
          style={[
            styles.arrowButton,
            styles.arrowLeft,
            currentSlide === 0 && { opacity: 0.4 }
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.background} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={goNext}
          activeOpacity={0.8}
          disabled={currentSlide === promotionalSlides.length - 1}
          style={[
            styles.arrowButton,
            styles.arrowRight,
            currentSlide === promotionalSlides.length - 1 && { opacity: 0.4 }
          ]}
        >
          <Ionicons name="chevron-forward" size={22} color={COLORS.background} />
        </TouchableOpacity>
        
        {/* Slider Indicators */}
        <View style={styles.sliderIndicators}>
          {promotionalSlides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === currentSlide && styles.indicatorActive
              ]}
            />
          ))}
        </View>
      </View>

      {/* Loyalty Points */}
      <View style={styles.loyaltyCard}>
        <View style={styles.loyaltyDecor} />
        <View style={styles.loyaltyContent}>
          <View style={styles.loyaltyLeft}>
            <View style={styles.loyaltyIconWrap}>
              <Ionicons name="gift-outline" size={22} color="#fff" />
            </View>
            <View>
              <Text style={styles.loyaltyTitle}>{t('home.loyaltyPoints')}</Text>
              <Text style={styles.loyaltyPoints}>
                {loyaltyPoints} {t('common.points')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.loyaltyButton}
            onPress={() => navigation.navigate('LoyaltyPoints')}
            activeOpacity={0.88}
          >
            <Text style={styles.loyaltyButtonText}>{t('home.viewRewards')}</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Maintenance Photos – GET /api/maintenance-photos?per_page=20 */}
      {(() => {
        const pairs = maintenancePhotos
          .map((photo) => {
            const before = getMaintenancePhotoImageUrl(photo, 'before');
            const after = getMaintenancePhotoImageUrl(photo, 'after');
            if (!before || !after) return null;
            return { id: photo.id, before, after };
          })
          .filter((p): p is { id: number; before: string; after: string } => p != null);

        if (!maintenancePhotosLoading && pairs.length === 0) {
          return null;
        }

        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, styles.sectionTitleInHeader]}>
                {t('home.maintenancePhotos')}
              </Text>
              {orderWithPhotos?.id ? (
                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={() => navigation.navigate('OrderTracking', { orderId: orderWithPhotos.id })}
                >
                  <Text style={styles.viewAllText}>{t('home.viewOrder')}</Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                </TouchableOpacity>
              ) : null}
            </View>

            {maintenancePhotosLoading && pairs.length === 0 ? (
              <View style={styles.maintenanceLoadingWrap}>
                <ActivityIndicator color={COLORS.primary} />
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.maintenanceScrollContent}
              >
                {pairs.map((pair) => (
                  <View key={`maintenance-photo-${pair.id}`} style={styles.maintenanceCard}>
                    <BeforeAfter
                      beforeUri={pair.before}
                      afterUri={pair.after}
                      width={300}
                      aspectRatio={0.6}
                    />
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        );
      })()}

      {/* Exclusive Offers – dynamic from GET /api/exclusive-offers (first 3) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, styles.sectionTitleInHeader]}>{t('home.exclusiveOffers')}</Text>
          <TouchableOpacity style={styles.viewAllButton} onPress={() => navigation.navigate('Offers')}>
            <Text style={styles.viewAllText}>{t('home.viewAll')}</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        {exclusiveOffersLoading ? (
          <View style={[styles.offerBannerFull, styles.offerPlaceholder]}>
            <Text style={styles.offerPlaceholderText}>{t('home.loading', 'Loading...')}</Text>
          </View>
        ) : exclusiveOffers.length >= 1 ? (
          <>
            <TouchableOpacity style={styles.offerBannerFull} onPress={() => navigation.navigate('ExclusiveOfferProducts', { offer: exclusiveOffers[0] })}>
              <HomeOfferCardBackground uri={getOfferImageUrl(exclusiveOffers[0])} style={styles.offerImageFull} />
              <View style={styles.offerOverlay} />
              <View style={styles.offerContentFull}>
                <Text style={styles.offerTitle} numberOfLines={1} ellipsizeMode="tail">{offerTitle(exclusiveOffers[0])}</Text>
                <Text style={styles.offerSubtitle} numberOfLines={2} ellipsizeMode="tail">{offerSubtitle(exclusiveOffers[0])}</Text>
              </View>
            </TouchableOpacity>
            {exclusiveOffers.length >= 2 && (
              <View style={styles.offerRow}>
                <TouchableOpacity style={styles.offerHalf} onPress={() => navigation.navigate('ExclusiveOfferProducts', { offer: exclusiveOffers[1] })}>
                  <HomeOfferCardBackground uri={getOfferImageUrl(exclusiveOffers[1])} style={styles.offerImageHalf} />
                  <View style={styles.offerOverlay} />
                  <View style={styles.offerContentHalf}>
                    <Text style={styles.offerTitleSm} numberOfLines={1} ellipsizeMode="tail">{offerTitle(exclusiveOffers[1])}</Text>
                    <Text style={styles.offerSubtitleSm} numberOfLines={2} ellipsizeMode="tail">{offerSubtitle(exclusiveOffers[1])}</Text>
                  </View>
                </TouchableOpacity>
                {exclusiveOffers.length >= 3 ? (
                  <TouchableOpacity style={styles.offerHalf} onPress={() => navigation.navigate('ExclusiveOfferProducts', { offer: exclusiveOffers[2] })}>
                    <HomeOfferCardBackground uri={getOfferImageUrl(exclusiveOffers[2])} style={styles.offerImageHalf} />
                    <View style={styles.offerOverlay} />
                    <View style={styles.offerContentHalf}>
                      <Text style={styles.offerTitleSm} numberOfLines={1} ellipsizeMode="tail">{offerTitle(exclusiveOffers[2])}</Text>
                      <Text style={styles.offerSubtitleSm} numberOfLines={2} ellipsizeMode="tail">{offerSubtitle(exclusiveOffers[2])}</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.offerHalf} />
                )}
              </View>
            )}
          </>
        ) : null}
      </View>

      {/* Place Service Orders - dynamic from GET /services (public API) or static fallback */}
       <View style={styles.section}>
         <View style={styles.sectionHeader}>
           <Text style={[styles.sectionTitle, styles.sectionTitleInHeader]}>{t('home.placeServiceOrders')}</Text>
           <TouchableOpacity
             style={styles.viewAllButton}
             onPress={() => navigation.navigate('Main' as never, { screen: 'Services' } as never)}
           >
             <Text style={styles.viewAllText}>{t('home.viewAll')}</Text>
             <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
           </TouchableOpacity>
         </View>

         {servicesLoading ? (
           <View style={styles.serviceGridPlaceholder}>
             <Text style={styles.placeholderText}>{t('home.loading', 'Loading...')}</Text>
           </View>
         ) : dashboardServices.length > 0 ? (
           <View style={styles.serviceGrid}>
             {dashboardServices.map((service) => {
               const imageUri = service.image_url ?? (service.image ? buildFullImageUrl(service.image) : null);
               return (
                 <TouchableOpacity
                   key={service.id}
                   style={styles.serviceGridCard}
                   onPress={() => navigation.navigate('ServiceProducts', { serviceId: service.id, serviceName: service.name })}
                 >
                   <View style={styles.serviceGridIconContainer}>
                     {imageUri ? (
                       <Image source={{ uri: imageUri }} style={styles.serviceGridImageFull} contentFit="cover" />
                     ) : (
                       <View style={styles.serviceGridIcon}>
                         <Ionicons name={getServiceIcon(service.slug || service.name)} size={32} color={COLORS.primary} />
                       </View>
                     )}
                     <View style={styles.serviceGridBadge}>
                       <Text style={styles.serviceGridBadgeText}>
                         {service.products_count ?? 0} {t('category.products', 'products')}
                       </Text>
                     </View>
                   </View>
                   <View style={styles.serviceGridContent}>
                     <Text style={styles.serviceGridTitle} numberOfLines={1}>{service.name}</Text>
                     <Text style={styles.serviceGridDescription} numberOfLines={2}>{service.description || t('home.professionalServices')}</Text>
                   </View>
                 </TouchableOpacity>
               );
             })}
           </View>
         ) : (
           <View style={styles.serviceGrid}>
             {serviceCategories.map((category) => (
               <TouchableOpacity
                 key={category.id}
                 style={styles.serviceGridCard}
                 onPress={() => navigation.navigate('ServiceCategory', {
                   category: {
                     id: category.id,
                     name: category.name,
                     description: category.description,
                     icon: category.icon,
                     services: category.services,
                   },
                 })}
               >
                 <View style={styles.serviceGridIconContainer}>
                   <View style={styles.serviceGridIcon}>
                     <Ionicons name={category.icon as any} size={32} color={COLORS.primary} />
                   </View>
                   <View style={styles.serviceGridBadge}>
                     <Text style={styles.serviceGridBadgeText}>{category.services?.length || 4} {t('category.products', 'products')}</Text>
                   </View>
                 </View>
                 <View style={styles.serviceGridContent}>
                   <Text style={styles.serviceGridTitle} numberOfLines={1}>{category.name}</Text>
                   <Text style={styles.serviceGridDescription} numberOfLines={2}>{category.description}</Text>
                   <View style={styles.serviceGridServices}>
                     <Text style={styles.serviceGridServicesText}>
                       {category.services?.slice(0, 2).join(', ') || t('home.professionalServices')}
                       {category.services && category.services.length > 2 && '...'}
                     </Text>
                   </View>
                 </View>
               </TouchableOpacity>
             ))}
           </View>
         )}
       </View>

      {/* Featured Products (from API: first 3 here, View All shows all) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, styles.sectionTitleInHeader]}>{t('home.featured')}</Text>
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => navigation.navigate('FeaturedProducts' as never)}
          >
            <Text style={styles.viewAllText}>{t('home.viewAll')}</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {featuredProductsLoading ? (
          <View style={styles.featuredLoadingWrap}>
            <Text style={styles.featuredLoadingText}>{t('home.loading', { defaultValue: 'Loading…' })}</Text>
          </View>
        ) : featuredProductsFirst3.length === 0 ? (
          <View style={styles.featuredLoadingWrap}>
            <Text style={styles.featuredLoadingText}>{t('home.noFeatured', { defaultValue: 'No featured products' })}</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {featuredProductsFirst3.map((product, index) => {
              const priceNum = typeof product.price === 'string' ? parseFloat(product.price) || 0 : product.price;
              const detail = featuredProductToDetail(product);
              const imageUri = getFeaturedProductImage(product);
              const currency = t('orders.currency', { defaultValue: 'AED' });
              return (
                <TouchableOpacity
                  key={product.id}
                  style={styles.featuredServiceCard}
                  onPress={() => navigation.navigate('ProductDetail', { product: detail })}
                >
                  <View style={styles.featuredServiceImageContainer}>
                    <HomeOfferImage uri={imageUri} style={styles.featuredServiceImage} />
                    <View style={styles.featuredServiceBadge}>
                      <Text style={styles.featuredServiceBadgeText}>{featuredBadges[index] ?? t('home.badges.popular')}</Text>
                    </View>
                  </View>
                  <View style={styles.featuredServiceContent}>
                    <Text style={styles.featuredServiceName}>{product.name}</Text>
                    <Text style={styles.featuredServiceDescription} numberOfLines={2}>{product.description || ''}</Text>
                    <View style={styles.featuredServiceFooter}>
                      <Text style={styles.featuredServicePrice}>{currency} {priceNum}</Text>
                      <View style={styles.featuredServiceRating}>
                        <Ionicons name="star" size={14} color={COLORS.warning} />
                        <Text style={styles.featuredServiceRatingText}>4.5</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Product Categories */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, styles.sectionTitleInHeader]}>{t('home.shopByCategory')}</Text>
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => navigation.navigate('Main' as never, { screen: 'Store' } as never)}
          >
            <Text style={styles.viewAllText}>{t('home.viewAll')}</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.categoriesGrid}>
          {displayCategories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryCard}
              onPress={() => {
                const noProducts = category.coming_soon || (category.products_count !== undefined && category.products_count === 0);
                if (noProducts) {
                  Alert.alert(
                    t('category.comingSoon', { defaultValue: 'Coming Soon' }),
                    t('category.comingSoonMessage', { defaultValue: 'Products in this category are coming soon.' })
                  );
                  return;
                }
                navigation.navigate('CategoryProducts', { category });
              }}
            >
              <View style={styles.categoryImageContainer}>
                <HomeCategoryImage uri={category.image} />
              </View>
              <Text style={styles.categoryName}>{category.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.sectionTitleInHeader, { marginBottom: SPACING.md }]}>
          {t('home.quickActions')}
        </Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickAction, styles.quickActionBook]}
            onPress={() => navigation.navigate('Main' as never, { screen: 'Services' } as never)}
            activeOpacity={0.88}
          >
            <View style={[styles.quickActionIcon, styles.quickActionIconBook]}>
              <Ionicons name="construct" size={24} color="#fff" />
            </View>
            <View style={styles.quickActionTextCol}>
              <Text style={styles.quickActionText}>{t('home.bookService')}</Text>
              <Text style={styles.quickActionHint}>{t('home.bookServiceHint', 'Schedule a visit')}</Text>
            </View>
            <View style={styles.quickActionChevron}>
              <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAction, styles.quickActionTrack]}
            onPress={() => navigation.navigate('Main' as never, { screen: 'Orders' } as never)}
            activeOpacity={0.88}
          >
            <View style={[styles.quickActionIcon, styles.quickActionIconTrack]}>
              <Ionicons name="navigate" size={24} color="#fff" />
            </View>
            <View style={styles.quickActionTextCol}>
              <Text style={styles.quickActionText}>{t('home.trackOrder')}</Text>
              <Text style={styles.quickActionHint}>{t('home.trackOrderHint', 'Live status')}</Text>
            </View>
            <View style={styles.quickActionChevron}>
              <Ionicons name="chevron-forward" size={16} color="#B8860B" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAction, styles.quickActionShop]}
            onPress={() => navigation.navigate('Main' as never, { screen: 'Store' } as never)}
            activeOpacity={0.88}
          >
            <View style={[styles.quickActionIcon, styles.quickActionIconShop]}>
              <Ionicons name="bag-handle" size={24} color="#fff" />
            </View>
            <View style={styles.quickActionTextCol}>
              <Text style={styles.quickActionText}>{t('home.shopProducts')}</Text>
              <Text style={styles.quickActionHint}>{t('home.shopProductsHint', 'Browse store')}</Text>
            </View>
            <View style={styles.quickActionChevron}>
              <Ionicons name="chevron-forward" size={16} color={COLORS.primaryLight} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAction, styles.quickActionHistory]}
            onPress={() => navigation.navigate('OrderHistory')}
            activeOpacity={0.88}
          >
            <View style={[styles.quickActionIcon, styles.quickActionIconHistory]}>
              <Ionicons name="time" size={24} color="#fff" />
            </View>
            <View style={styles.quickActionTextCol}>
              <Text style={styles.quickActionText}>{t('home.orderHistory')}</Text>
              <Text style={styles.quickActionHint}>{t('home.orderHistoryHint', 'Past orders')}</Text>
            </View>
            <View style={styles.quickActionChevron}>
              <Ionicons name="chevron-forward" size={16} color={COLORS.secondary} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  scrollContent: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxl,
  },
  greetingContainer: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  greeting: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  userName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  notificationButton: {
    position: 'relative',
    padding: SPACING.sm,
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  loyaltyCard: {
    backgroundColor: COLORS.primaryDark,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: 20,
    padding: SPACING.lg,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primaryDark,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: { elevation: 5 },
    }),
  },
  loyaltyDecor: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  loyaltyContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loyaltyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  loyaltyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyTitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.85)',
  },
  loyaltyPoints: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
    marginTop: 2,
  },
  loyaltyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#fff',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.round,
  },
  loyaltyButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  section: {
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },

  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  sectionTitleInHeader: {
    marginBottom: 0,
  },
  maintenanceScrollContent: {
    paddingRight: SPACING.lg,
  },
  maintenanceCard: {
    width: 300,
    marginRight: SPACING.md,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  maintenanceLoadingWrap: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary + '12',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
  },
  viewAllText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
     serviceCard: {
     width: 200,
     backgroundColor: COLORS.surface,
     borderRadius: BORDER_RADIUS.lg,
     marginRight: SPACING.md,
     overflow: 'hidden',
     shadowColor: COLORS.text,
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.1,
     shadowRadius: 4,
     elevation: 3,
   },
   serviceCardImageContainer: {
     height: 120,
     position: 'relative',
   },
   serviceCardImage: {
     width: '100%',
     height: '100%',
     resizeMode: 'cover',
   },
   serviceCardBadge: {
     position: 'absolute',
     top: SPACING.sm,
     left: SPACING.sm,
     backgroundColor: COLORS.primary,
     paddingHorizontal: SPACING.sm,
     paddingVertical: 2,
     borderRadius: BORDER_RADIUS.xs,
   },
   serviceCardBadgeText: {
     fontSize: FONT_SIZES.xs,
     fontWeight: FONT_WEIGHTS.bold,
     color: COLORS.background,
   },
   serviceCardContent: {
     padding: SPACING.md,
   },
   serviceCardTitle: {
     fontSize: FONT_SIZES.md,
     fontWeight: FONT_WEIGHTS.semiBold,
     color: COLORS.text,
     marginBottom: SPACING.xs,
   },
   serviceCardDescription: {
     fontSize: FONT_SIZES.sm,
     color: COLORS.textSecondary,
     marginBottom: SPACING.sm,
   },
   serviceCardFooter: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
   },
   serviceCardPrice: {
     fontSize: FONT_SIZES.md,
     fontWeight: FONT_WEIGHTS.bold,
     color: COLORS.primary,
   },
   serviceCardRating: {
     flexDirection: 'row',
     alignItems: 'center',
   },
   serviceCardRatingText: {
     fontSize: FONT_SIZES.xs,
     color: COLORS.textSecondary,
     marginLeft: SPACING.xs,
   },
     // Service Grid Styles
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceGridCard: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: SPACING.md,
  },
   serviceGridIconContainer: {
     height: 120,
     position: 'relative',
     justifyContent: 'center',
     alignItems: 'center',
     backgroundColor: COLORS.primary + '10',
     overflow: 'hidden',
   },
   serviceGridIcon: {
     width: 48,
     height: 48,
     borderRadius: 24,
     backgroundColor: COLORS.primary + '20',
     justifyContent: 'center',
     alignItems: 'center',
   },
   serviceGridImageFull: {
     position: 'absolute',
     left: 0,
     right: 0,
     top: 0,
     bottom: 0,
     width: '100%',
     height: '100%',
     backgroundColor: COLORS.primary + '20',
   },
   serviceGridImage: {
     width: 48,
     height: 48,
     borderRadius: 24,
     backgroundColor: COLORS.primary + '20',
   },
   serviceGridPlaceholder: {
     minHeight: 120,
     justifyContent: 'center',
     alignItems: 'center',
     paddingVertical: SPACING.lg,
   },
   placeholderText: {
     fontSize: FONT_SIZES.sm,
     color: COLORS.textSecondary,
   },
   serviceGridBadge: {
     position: 'absolute',
     top: SPACING.sm,
     left: SPACING.sm,
     backgroundColor: COLORS.primary,
     paddingHorizontal: 10,
     paddingVertical: 4,
     borderRadius: BORDER_RADIUS.round,
   },
   serviceGridBadgeText: {
     fontSize: FONT_SIZES.xs,
     fontWeight: FONT_WEIGHTS.bold,
     color: COLORS.background,
   },
   serviceGridContent: {
     padding: SPACING.md,
     backgroundColor: COLORS.background,
   },
   serviceGridTitle: {
     fontSize: FONT_SIZES.sm,
     fontWeight: FONT_WEIGHTS.bold,
     color: COLORS.text,
     marginBottom: SPACING.xs,
   },
   serviceGridDescription: {
     fontSize: FONT_SIZES.xs,
     color: COLORS.textSecondary,
     marginBottom: SPACING.sm,
   },
   serviceGridFooter: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
   },
   serviceGridPrice: {
     fontSize: FONT_SIZES.sm,
     fontWeight: FONT_WEIGHTS.bold,
     color: COLORS.primary,
   },
   serviceGridRating: {
     flexDirection: 'row',
     alignItems: 'center',
   },
       serviceGridRatingText: {
      fontSize: FONT_SIZES.xs,
      color: COLORS.textSecondary,
      marginLeft: SPACING.xs,
    },
    serviceGridServices: {
      marginTop: SPACING.xs,
    },
    serviceGridServicesText: {
      fontSize: FONT_SIZES.xs,
      color: COLORS.primary,
      fontWeight: FONT_WEIGHTS.medium,
    },
  serviceCategories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  serviceCategory: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
    position: 'relative',
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  categoryTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  categorySubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyStateText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptyStateSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  quickActions: {
    gap: SPACING.sm,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  quickActionBook: {
    backgroundColor: '#E8F2EA',
    borderColor: '#C5DBC9',
  },
  quickActionTrack: {
    backgroundColor: '#FBF5E6',
    borderColor: '#EBD9A8',
  },
  quickActionShop: {
    backgroundColor: '#EAF6EE',
    borderColor: '#C8E2D0',
  },
  quickActionHistory: {
    backgroundColor: '#F3EBE7',
    borderColor: '#DFCEC5',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickActionIconBook: {
    backgroundColor: COLORS.primary,
  },
  quickActionIconTrack: {
    backgroundColor: '#C9970A',
  },
  quickActionIconShop: {
    backgroundColor: COLORS.primaryLight,
  },
  quickActionIconHistory: {
    backgroundColor: COLORS.secondary,
  },
  quickActionTextCol: {
    flex: 1,
    gap: 2,
  },
  quickActionText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  quickActionHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  quickActionChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Weather widget – premium dark card
  weatherCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primaryDark,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 14,
      },
      android: { elevation: 7 },
    }),
  },
  weatherDecorLarge: {
    position: 'absolute',
    top: -48,
    right: -36,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  weatherDecorSmall: {
    position: 'absolute',
    bottom: -28,
    left: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  weatherContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  weatherPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: 72,
  },
  weatherPromptTextCol: {
    flex: 1,
    gap: 4,
  },
  weatherPromptTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold as any,
    color: '#fff',
  },
  weatherPromptSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 18,
  },
  weatherIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.md,
  },
  weatherMain: {
    flex: 1,
  },
  weatherTempRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  weatherTemp: {
    fontSize: 44,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  weatherTempUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 2,
    marginBottom: 6,
  },
  weatherConditionPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.round,
    marginTop: 6,
  },
  weatherConditionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold as any,
    color: '#fff',
  },
  weatherCardSubtext: {
    fontSize: FONT_SIZES.md,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  weatherCardHint: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  weatherLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  weatherLocationText: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
  },
  // Slider Styles
  sliderContainer: {
    marginBottom: SPACING.lg,
  },
  arrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,37,19,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  arrowLeft: { left: SPACING.lg + 6 },
  arrowRight: { right: SPACING.lg + 6 },
  slide: {
    width: screenWidth,
    height: 210,
    paddingHorizontal: SPACING.lg,
  },
  slideInner: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  slideContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  slideTextContainer: {
    flex: 1,
    marginRight: SPACING.md,
  },
  slideTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    marginBottom: SPACING.xs,
  },
  slideSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.background,
    opacity: 0.9,
    marginBottom: SPACING.md,
  },
  slideButton: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.round,
    alignSelf: 'flex-start',
  },
  slideButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  slideImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
  },
  slideImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  sliderIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  indicatorActive: {
    backgroundColor: COLORS.primary,
    width: 24,
  },
  // Featured Products Styles
  featuredLoadingWrap: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  featuredLoadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  featuredServiceCard: {
    width: 280,
    backgroundColor: COLORS.background,
    borderRadius: 18,
    marginRight: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  featuredServiceImageContainer: {
    height: 160,
    position: 'relative',
  },
  featuredServiceImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  featuredServiceBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
  },
  featuredServiceBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  featuredServiceContent: {
    padding: SPACING.md,
  },
  featuredServiceName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  featuredServiceDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  featuredServiceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featuredServicePrice: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  featuredServiceRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featuredServiceRatingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  // Categories Grid Styles
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: SPACING.md,
  },
  categoryImageContainer: {
    height: 120,
    position: 'relative',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  categoryImageEmpty: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryImageEmptyIcon: {
    opacity: 0.5,
  },
  categoryImageEmptyText: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    opacity: 0.8,
  },
  categoryName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    textAlign: 'center',
    padding: SPACING.md,
  },
  // Category Badge Styles
  categoryBadge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  categoryBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  // Recent Orders Styles
  recentOrdersContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  recentOrderCard: {
    width: 280,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginRight: SPACING.md,
    marginVertical: SPACING.xs,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  recentOrderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  recentOrderIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  recentOrderStatusContainer: {
    flex: 1,
  },
  recentOrderStatus: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    textTransform: 'capitalize',
  },
  recentOrderDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  recentOrderContent: {
    padding: SPACING.md,
  },
  recentOrderServiceInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  recentOrderServiceIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  recentOrderServiceDetails: {
    flex: 1,
  },
  recentOrderTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  recentOrderDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  recentOrderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentOrderPriceContainer: {
    flex: 1,
  },
  recentOrderPriceLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  recentOrderPrice: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  recentOrderActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  recentOrderActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    gap: SPACING.xs,
  },
  recentOrderActionText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
  // Enhanced Empty State Styles
  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyStateButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  emptyStateButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.background,
  },
  // Offers styles
  offerBannerFull: {
    height: 168,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  offerPlaceholder: {
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offerPlaceholderText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
  offerImageFull: { width: '100%', height: '100%' },
  offerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,37,19,0.35)' },
  offerContentFull: { position: 'absolute', left: SPACING.lg, right: SPACING.lg, bottom: SPACING.lg },
  offerTitle: { color: COLORS.background, fontSize: FONT_SIZES.xl, fontWeight: FONT_WEIGHTS.bold },
  offerSubtitle: { color: COLORS.background, opacity: 0.9, marginTop: 2 },
  offerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md },
  offerHalf: {
    flex: 1,
    height: 128,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  offerImageHalf: { width: '100%', height: '100%' },
  offerContentHalf: { position: 'absolute', left: SPACING.md, right: SPACING.md, bottom: SPACING.md },
  offerTitleSm: { color: COLORS.background, fontWeight: FONT_WEIGHTS.semiBold },
  offerSubtitleSm: { color: COLORS.background, opacity: 0.9, fontSize: FONT_SIZES.xs },
});

const HomeCategoryImage = React.memo(function HomeCategoryImage({
  uri,
}: {
  uri: string | null;
}) {
  if (!uri) {
    return (
      <View style={homeStyles.categoryImageEmpty}>
        <Ionicons name="image-outline" size={20} color={COLORS.textSecondary} style={homeStyles.categoryImageEmptyIcon} />
        <Text style={homeStyles.categoryImageEmptyText}>No image</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={homeStyles.categoryImage}
      contentFit="cover"
      transition={0}
      cachePolicy="disk"
    />
  );
});

const HomeOfferImage = React.memo(function HomeOfferImage({ uri, style }: { uri: string; style: object }) {
  return (
    <Image source={{ uri }} style={style} contentFit="cover" transition={0} cachePolicy="disk" />
  );
});

const HomeOfferCardBackground = React.memo(function HomeOfferCardBackground({
  uri,
  style,
}: {
  uri: string | null;
  style: object;
}) {
  if (uri) {
    return <Image source={{ uri }} style={style} contentFit="cover" transition={0} cachePolicy="disk" />;
  }
  return <View style={[style, homeStyles.offerPlaceholder]} />;
});

const homeStyles = styles;

export default HomeScreen; 