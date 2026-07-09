import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VendorPageHeader, VENDOR_SCREEN_BG } from '../../components/vendor/VendorUi';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { vendorService, VendorCatalogProduct } from '../../services/vendorService';

const VendorPricingScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [products, setProducts] = useState<VendorCatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState('');
  const [compareDraft, setCompareDraft] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      setProducts(await vendorService.getProducts());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const startEdit = (item: VendorCatalogProduct) => {
    setEditingId(item.id);
    setPriceDraft(String(item.price));
    setCompareDraft(item.compare_at_price != null ? String(item.compare_at_price) : '');
  };

  const saveEdit = async (productId: string) => {
    const price = parseFloat(priceDraft);
    const compare = compareDraft.trim() ? parseFloat(compareDraft) : undefined;
    if (Number.isNaN(price) || price < 0) {
      Alert.alert(t('common.error'), t('vendorPricing.invalidPrice'));
      return;
    }
    await vendorService.updateProductPricing(productId, price, compare);
    setEditingId(null);
    await load(true);
    Alert.alert(t('common.success'), t('vendorPricing.saved'));
  };

  const renderItem = ({ item }: { item: VendorCatalogProduct }) => {
    const isEditing = editingId === item.id;
    const discount =
      item.compare_at_price && item.compare_at_price > item.price
        ? Math.round(((item.compare_at_price - item.price) / item.compare_at_price) * 100)
        : 0;

    return (
      <View style={styles.card}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.category}>{item.category}</Text>

        {isEditing ? (
          <View style={styles.editRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('vendorPricing.sellingPrice')}</Text>
              <TextInput
                style={styles.input}
                value={priceDraft}
                onChangeText={setPriceDraft}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('vendorPricing.comparePrice')}</Text>
              <TextInput
                style={styles.input}
                value={compareDraft}
                onChangeText={setCompareDraft}
                keyboardType="decimal-pad"
                placeholder="—"
              />
            </View>
          </View>
        ) : (
          <View style={styles.priceRow}>
            <Text style={styles.price}>AED {item.price.toFixed(2)}</Text>
            {item.compare_at_price ? (
              <Text style={styles.comparePrice}>AED {item.compare_at_price.toFixed(2)}</Text>
            ) : null}
            {discount > 0 ? (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{discount}%</Text>
              </View>
            ) : null}
          </View>
        )}

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => (isEditing ? saveEdit(item.id) : startEdit(item))}
        >
          <Ionicons
            name={isEditing ? 'checkmark-circle-outline' : 'pricetag-outline'}
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.actionText}>
            {isEditing ? t('common.save') : t('vendorPricing.editPrice')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <VendorPageHeader
        title={t('vendorPricing.title')}
        subtitle={t('vendorDashboard.pricing')}
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <ActivityIndicator style={styles.loader} color={COLORS.primary} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('vendorPricing.empty')}</Text>}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VENDOR_SCREEN_BG },
  loader: { marginTop: SPACING.xxl },
  list: { padding: SPACING.lg },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  productName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  category: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  price: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.primary },
  comparePrice: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.round,
  },
  discountText: { fontSize: FONT_SIZES.xs, color: COLORS.success, fontWeight: FONT_WEIGHTS.bold },
  editRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  actionText: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.medium },
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.xxl },
});

export default VendorPricingScreen;
