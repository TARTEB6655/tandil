import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { vendorService } from '../../services/vendorService';
import { VendorProduct } from '../../types';

const { width, height } = Dimensions.get('window');

const VendorProductDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { productId } = route.params || {};

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAvailable, setIsAvailable] = useState(true);

  // Demo product data
  const demoProduct: VendorProduct = {
    id: '1',
    vendorId: 'vendor_001',
    name: 'Premium Leather Sneakers',
    description: 'High-quality leather sneakers with comfortable sole, perfect for daily wear and casual outings. Features premium craftsmanship, breathable design, and durable construction.',
    category: 'shoes',
    images: [
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400',
      'https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=400',
      'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=400',
      'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=400',
    ],
    isAvailable: true,
    createdAt: new Date('2024-01-15'),
  };

  const productDetails = {
    brand: 'Premium Brand',
    material: 'Genuine Leather',
    size: '42',
    color: 'Brown',
    condition: 'New',
    quantity: 15,
    price: 'AED 299',
    rating: 4.8,
    reviews: 156,
    views: 1247,
    orders: 23,
  };

  useEffect(() => {
    if (productId && demoProduct) {
      setIsAvailable(demoProduct.isAvailable);
    }
  }, [productId]);

  const handleEditProduct = () => {
    navigation.navigate('EditProduct', { productId });
  };

  const handleToggleAvailability = () => {
    Alert.alert(
      'Toggle Availability',
      `Do you want to ${isAvailable ? 'disable' : 'enable'} this product?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => {
          setIsAvailable(!isAvailable);
          Alert.alert('Success', `Product ${isAvailable ? 'disabled' : 'enabled'} successfully!`);
        }},
      ]
    );
  };

  const handleDeleteProduct = () => {
    if (!productId) return;
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await vendorService.deleteProduct(String(productId));
              Alert.alert('Deleted', 'Product has been deleted successfully.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (err: unknown) {
              const message =
                (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
                  ?.message ||
                (err as { message?: string })?.message ||
                'Failed to delete product.';
              Alert.alert('Error', message);
            }
          },
        },
      ]
    );
  };

  const renderImageItem = ({ item, index }: { item: string; index: number }) => (
    <View style={styles.imageContainer}>
      <Image source={{ uri: item }} style={styles.productImage} resizeMode="cover" />
      <View style={styles.imageOverlay}>
        <View style={styles.imageNumber}>
          <Text style={styles.imageNumberText}>{index + 1}</Text>
        </View>
      </View>
    </View>
  );

  const renderImageIndicator = () => (
    <View style={styles.imageIndicators}>
      {demoProduct.images.map((_, index) => (
        <View
          key={index}
          style={[
            styles.indicator,
            index === currentImageIndex && styles.indicatorActive
          ]}
        />
      ))}
    </View>
  );

  const renderDetailRow = (label: string, value: string, icon?: string) => (
    <View style={styles.detailRow}>
      <View style={styles.detailLabel}>
        {icon && <Ionicons name={icon as any} size={16} color={COLORS.textSecondary} />}
        <Text style={styles.detailLabelText}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );

  const renderStatsCard = (title: string, value: string, icon: string, color: string) => (
    <View style={styles.statsCard}>
      <View style={[styles.statsIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statsValue}>{value}</Text>
      <Text style={styles.statsTitle}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.background} />
        </TouchableOpacity>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleEditProduct}
          >
            <Ionicons name="create-outline" size={24} color={COLORS.background} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleDeleteProduct}
          >
            <Ionicons name="trash-outline" size={24} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        {/* Image Gallery */}
        <View style={styles.imageSection}>
          <FlatList
            data={demoProduct.images}
            renderItem={renderImageItem}
            keyExtractor={(item, index) => index.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / width);
              setCurrentImageIndex(index);
            }}
            style={styles.imageList}
          />
          {renderImageIndicator()}
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <View style={styles.productHeader}>
            <Text style={styles.productName}>{demoProduct.name}</Text>
            <View style={[styles.availabilityBadge, { 
              backgroundColor: isAvailable ? COLORS.success + '20' : COLORS.error + '20' 
            }]}>
              <Ionicons 
                name={isAvailable ? "checkmark-circle" : "close-circle"} 
                size={16} 
                color={isAvailable ? COLORS.success : COLORS.error} 
              />
              <Text style={[styles.availabilityText, { 
                color: isAvailable ? COLORS.success : COLORS.error 
              }]}>
                {isAvailable ? 'Available' : 'Out of Stock'}
              </Text>
            </View>
          </View>

          <Text style={styles.productDescription}>{demoProduct.description}</Text>

          <View style={styles.productMeta}>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color={COLORS.warning} />
              <Text style={styles.ratingText}>{productDetails.rating}</Text>
              <Text style={styles.reviewsText}>({productDetails.reviews} reviews)</Text>
            </View>
            
            <Text style={styles.priceText}>{productDetails.price}</Text>
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Product Performance</Text>
          <View style={styles.statsGrid}>
            {renderStatsCard('Views', productDetails.views.toString(), 'eye-outline', COLORS.info)}
            {renderStatsCard('Orders', productDetails.orders.toString(), 'bag-outline', COLORS.success)}
            {renderStatsCard('Rating', productDetails.rating.toString(), 'star-outline', COLORS.warning)}
          </View>
        </View>

        {/* Product Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Product Details</Text>
          
          <View style={styles.detailsContainer}>
            {renderDetailRow('Brand', productDetails.brand, 'business-outline')}
            {renderDetailRow('Material', productDetails.material, 'cube-outline')}
            {renderDetailRow('Size', productDetails.size, 'resize-outline')}
            {renderDetailRow('Color', productDetails.color, 'color-palette-outline')}
            {renderDetailRow('Condition', productDetails.condition, 'shield-checkmark-outline')}
            {renderDetailRow('Quantity', productDetails.quantity.toString(), 'layers-outline')}
            {renderDetailRow('Category', demoProduct.category.charAt(0).toUpperCase() + demoProduct.category.slice(1), 'pricetag-outline')}
            {renderDetailRow('Added', demoProduct.createdAt.toLocaleDateString(), 'calendar-outline')}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={handleEditProduct}
          >
            <Ionicons name="create-outline" size={24} color={COLORS.background} />
            <Text style={styles.actionButtonText}>Edit Product</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { 
              backgroundColor: isAvailable ? COLORS.error + '20' : COLORS.success + '20',
              borderColor: isAvailable ? COLORS.error : COLORS.success
            }]}
            onPress={handleToggleAvailability}
          >
            <Ionicons 
              name={isAvailable ? "close-circle-outline" : "checkmark-circle-outline"} 
              size={24} 
              color={isAvailable ? COLORS.error : COLORS.success} 
            />
            <Text style={[styles.actionButtonText, { 
              color: isAvailable ? COLORS.error : COLORS.success 
            }]}>
              {isAvailable ? 'Disable Product' : 'Enable Product'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  imageSection: {
    height: height * 0.4,
    position: 'relative',
  },
  imageList: {
    flex: 1,
  },
  imageContainer: {
    width: width,
    height: height * 0.4,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: SPACING.md,
  },
  imageNumber: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
  },
  imageNumberText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
  },
  imageIndicators: {
    position: 'absolute',
    bottom: SPACING.lg,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  indicatorActive: {
    backgroundColor: COLORS.background,
    width: 24,
  },
  productInfo: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  productName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.md,
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
  },
  availabilityText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    marginLeft: SPACING.xs,
  },
  productDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  productMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  ratingText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  reviewsText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  priceText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  statsSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.surface,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statsCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statsValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  statsTitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  detailsSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  detailsContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  detailLabelText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  actionsSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  editButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    marginLeft: SPACING.sm,
  },
});

export default VendorProductDetailScreen;
