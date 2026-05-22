import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Button } from '../../components/common/Button';
import { useAppStore } from '../../store';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';
import { useCartBadgeCount } from '../../hooks/useCartBadgeCount';

const ServiceDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();
  const { service } = route.params;
  const { addToCart } = useAppStore();
  const { count: cartItemCount } = useCartBadgeCount();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const nameKey = `services.items.${service.id}.name`;
  const descKey = `services.items.${service.id}.description`;
  const translatedName = t(nameKey, { defaultValue: service.name });
  const translatedDescription = t(descKey, { defaultValue: service.description });
  const categoryName = service.category 
    ? t(`home.categories.${service.category}.name`, { defaultValue: service.category.charAt(0).toUpperCase() + service.category.slice(1) })
    : '';

  // Fallback image component
  const FallbackImage = ({ uri }: { uri: string }) => {
    const [currentUri, setCurrentUri] = useState(uri);
    const fallback = 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=800&q=60&v=service-fallback';
    return (
      <Image
        source={{ uri: currentUri }}
        style={styles.serviceImage}
        onError={() => setCurrentUri(fallback)}
      />
    );
  };

  const handleBookNow = () => {
    navigation.navigate('BookingForm', { service });
  };

  const handleAddToCart = () => {
    // For demo purposes, we'll add the service to cart
    Alert.alert(t('services.details.success'), t('services.details.addedToCart'));
  };

  const renderFeature = (feature: string, index: number) => (
    <View key={index} style={styles.featureItem}>
      <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
      <Text style={styles.featureText}>{feature}</Text>
    </View>
  );

  const renderReview = (review: any, index: number) => (
    <View key={index} style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          <View style={styles.reviewerAvatar}>
            <Text style={styles.reviewerInitial}>
              {review.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.reviewerName}>{review.name}</Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= review.rating ? 'star' : 'star-outline'}
                  size={14}
                  color={COLORS.warning}
                />
              ))}
            </View>
          </View>
        </View>
        <Text style={styles.reviewDate}>{review.date}</Text>
      </View>
      <Text style={styles.reviewText}>{review.comment}</Text>
    </View>
  );

  const mockReviews = [
    {
      name: 'John Doe',
      rating: 5,
      date: '2 days ago',
      comment: 'Excellent service! My garden looks amazing and the trees are thriving. Highly recommended.',
    },
    {
      name: 'Sarah Smith',
      rating: 4,
      date: '1 week ago',
      comment: 'Great quality work on pruning and fertilizing. Very professional team.',
    },
    {
      name: 'Mike Johnson',
      rating: 5,
      date: '2 weeks ago',
      comment: 'Outstanding care for my palm trees and plants. Very satisfied with the results.',
    },
  ];

  return (
    <View style={styles.container}>
      <Header 
        title={t('services.details.title')} 
        showBack={true}
        showCart={true}
        cartItemCount={cartItemCount}
        rightComponent={
          <TouchableOpacity style={styles.shareButton}>
            <Ionicons name="share-outline" size={24} color={COLORS.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Service Image */}
        <View style={styles.imageContainer}>
          <FallbackImage uri={service.image} />
        </View>

        {/* Service Info */}
        <View style={styles.content}>
          <View style={styles.serviceHeader}>
            <Text style={styles.serviceName}>{translatedName}</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color={COLORS.warning} />
              <Text style={styles.ratingText}>{service.rating || 4.8}</Text>
              <Text style={styles.reviewCount}>({mockReviews.length} {t('services.details.reviewWord')})</Text>
            </View>
          </View>

          <Text style={styles.serviceDescription}>{translatedDescription}</Text>

          {/* Price and Duration */}
          <View style={styles.priceContainer}>
            <View style={styles.priceInfo}>
              <Text style={styles.price}>{t('orders.currency', { defaultValue: 'AED' })} {service.price}</Text>
              {service.duration && (
                <Text style={styles.duration}>{service.duration} {t('services.details.minutes', { defaultValue: 'minutes' })}</Text>
              )}
            </View>
            {categoryName && (
              <View style={styles.categoryTag}>
                <Text style={styles.categoryText}>{categoryName}</Text>
              </View>
            )}
          </View>

          {/* Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('services.details.whatsIncluded')}</Text>
            {(() => {
              const raw = t(`services.items.${service.id}.features`, { returnObjects: true }) as unknown;
              const translatedFeatures = Array.isArray(raw) ? (raw as string[]) : [];
              const featuresToRender = translatedFeatures.length > 0 ? translatedFeatures : Array.isArray(service.features) ? service.features : [];
              return featuresToRender.map(renderFeature);
            })()}
          </View>

          {/* Reviews */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('services.details.reviews')}</Text>
            {(() => {
              const raw = t(`services.items.${service.id}.reviews`, { returnObjects: true }) as unknown;
              const list = Array.isArray(raw) ? (raw as any[]) : mockReviews;
              return list.map((review, index) => (
                typeof review === 'string'
                  ? renderReview({ name: t('common.user'), rating: 5, date: t('services.details.daysAgo', { count: 2 }), comment: review } as any, index)
                  : renderReview(review, index)
              ));
            })()}
          </View>

          {/* Related Services */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('services.details.related')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[
                { id: 'service_001', price: 35, image: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=400&q=60&v=rel1' },
                { id: 'service_002', price: 25, image: 'https://images.unsplash.com/photo-1461354464878-ad92f492a5a0?auto=format&fit=crop&w=400&q=60&v=rel2' },
                { id: 'service_003', price: 20, image: 'https://images.unsplash.com/photo-1597262975002-c5c3b14bbd62?auto=format&fit=crop&w=400&q=60&v=rel3' },
              ].map((item, index) => (
                <TouchableOpacity key={index} style={styles.relatedService}>
                  <Image source={{ uri: item.image }} style={styles.relatedServiceImage} />
                  <Text style={styles.relatedServiceName}>{t(`services.items.${item.id}.name`, { defaultValue: '' })}</Text>
                  <Text style={styles.relatedServicePrice}>{t('orders.currency', { defaultValue: 'AED' })} {item.price}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.cartButton} onPress={handleAddToCart}>
          <Ionicons name="cart-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Button
          title={t('services.details.bookNow')}
          onPress={handleBookNow}
          style={styles.bookButton}
        />
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  backButton: {
    padding: SPACING.sm,
  },
  shareButton: {
    padding: SPACING.sm,
  },
  imageContainer: {
    height: 200,
    backgroundColor: COLORS.primary + '10',
  },
  serviceImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  content: {
    padding: SPACING.lg,
  },
  serviceHeader: {
    marginBottom: SPACING.md,
  },
  serviceName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginLeft: SPACING.xs,
  },
  reviewCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  serviceDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 24,
    marginBottom: SPACING.lg,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    marginRight: SPACING.md,
  },
  duration: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  categoryTag: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  categoryText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
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
  reviewItem: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  reviewerInitial: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.bold,
  },
  reviewerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  reviewDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  reviewText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  relatedService: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginRight: SPACING.md,
    width: 120,
    alignItems: 'center',
  },
  relatedServiceImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: SPACING.sm,
    resizeMode: 'cover',
  },
  relatedServiceName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  relatedServicePrice: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cartButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  bookButton: {
    flex: 1,
  },
});

export default ServiceDetailScreen;
