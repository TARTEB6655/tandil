import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { ServiceCard } from '../../components/cards/ServiceCard';
import { useTranslation } from 'react-i18next';
import { mockServices, mockServiceCategories } from '../../data/mockData';
import { useCartBadgeCount } from '../../hooks/useCartBadgeCount';

const ServiceCategoryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const route = useRoute<any>();
  const { category } = route.params;
  const { count: cartItemCount } = useCartBadgeCount();
  
  const [selectedSort, setSelectedSort] = useState('popular');

  // Agriculture services (rebranded)
  const cleaningServices = [
    {
      id: 'agri_1',
      name: 'Tree Watering Visit',
      description: 'Scheduled irrigation and moisture checks for trees & palms',
      price: 120,
      category: 'watering',
      image: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=800&q=60&v=svc1',
      rating: 4.8,
      duration: '60 minutes',
      type: 'standard'
    },
    {
      id: 'agri_2',
      name: 'Garden Cleaning',
      description: 'Debris removal, raking, and general garden cleaning',
      price: 150,
      category: 'cleaning',
      image: 'https://images.unsplash.com/photo-1597262975002-c5c3b14bbd62?auto=format&fit=crop&w=800&q=60&v=svc2',
      rating: 4.6,
      duration: '90 minutes',
      type: 'standard'
    },
    {
      id: 'agri_3',
      name: 'Planting Service',
      description: 'Soil preparation and planting of saplings with aftercare',
      price: 200,
      category: 'planting',
      image: 'https://images.unsplash.com/photo-1461354464878-ad92f492a5a0?auto=format&fit=crop&w=800&q=60&v=svc3',
      rating: 4.7,
      duration: '120 minutes',
      type: 'premium'
    },
    {
      id: 'agri_4',
      name: 'Full Care Visit',
      description: 'Pruning, fertilizing, pest check, and seasonal maintenance',
      price: 260,
      category: 'care',
      image: 'https://images.unsplash.com/photo-1553531888-a99fa7a5d8c0?auto=format&fit=crop&w=800&q=60&v=svc4',
      rating: 4.9,
      duration: '120 minutes',
      type: 'premium'
    }
  ];

  // Get services based on category
  const getCategoryServices = () => {
    switch (category?.id) {
      case 'cleaning':
        return cleaningServices;
      case 'repair':
        return mockServices.filter(service => service.category === 'repair');
      case 'polish':
        return mockServices.filter(service => service.category === 'polish');
      case 'waterproofing':
        return mockServices.filter(service => service.category === 'waterproofing');
      default:
        return cleaningServices; // Default to cleaning services
    }
  };

  const categoryServices = getCategoryServices();

  const sortOptions = [
    { id: 'popular', label: t('services.sort.popular') },
    { id: 'price_low', label: t('services.sort.price_low') },
    { id: 'price_high', label: t('services.sort.price_high') },
    { id: 'rating', label: t('services.sort.rating') },
  ];



  const getFilteredAndSortedServices = () => {
    let filtered = [...categoryServices];
    
    // Apply sorting
    switch (selectedSort) {
      case 'price_low':
        return filtered.sort((a, b) => a.price - b.price);
      case 'price_high':
        return filtered.sort((a, b) => b.price - a.price);
      case 'rating':
        return filtered.sort((a, b) => ((b as any).rating || 0) - ((a as any).rating || 0));
      default:
        return filtered; // Most popular (default order)
    }
  };

  const renderServiceItem = ({ item }: { item: any }) => (
    <ServiceCard
      service={item}
      onPress={() => navigation.navigate('ServiceDetail', { service: item })}
      variant="default"
    />
  );

  const renderSortOption = (option: any) => (
    <TouchableOpacity
      key={option.id}
      style={[
        styles.sortOption,
        selectedSort === option.id && styles.sortOptionActive
      ]}
      onPress={() => setSelectedSort(option.id)}
    >
      <Text style={[
        styles.sortOptionText,
        selectedSort === option.id && styles.sortOptionTextActive
      ]}>
        {option.label}
      </Text>
    </TouchableOpacity>
  );



  return (
    <View style={styles.container}>
      <Header 
        title={category.name}
        showBack={true}
        showCart={true}
        cartItemCount={cartItemCount}
        rightComponent={
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name="filter" size={24} color={COLORS.text} />
          </TouchableOpacity>
        }
      />

      {/* Sort Options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('services.sortBy')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {sortOptions.map(renderSortOption)}
        </ScrollView>
      </View>



      {/* Services List */}
      <View style={styles.servicesContainer}>
        <FlatList
          data={getFilteredAndSortedServices()}
          renderItem={renderServiceItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.servicesList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="construct-outline" size={64} color={COLORS.textSecondary} />
              <Text style={styles.emptyStateTitle}>{t('services.emptyTitle')}</Text>
              <Text style={styles.emptyStateDescription}>
                {t('services.emptyBody')}
              </Text>
            </View>
          }
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
    paddingBottom: SPACING.lg,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  filterButton: {
    padding: SPACING.sm,
  },
  categoryInfo: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    margin: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  categoryIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  categoryContent: {
    flex: 1,
  },
  categoryName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  categoryDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  serviceCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  section: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  sortOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sortOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sortOptionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  sortOptionTextActive: {
    color: COLORS.background,
  },

  servicesContainer: {
    flex: 1,
  },
  servicesList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyStateTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyStateDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
});

export default ServiceCategoryScreen;
