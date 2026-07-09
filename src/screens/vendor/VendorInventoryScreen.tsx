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

const VendorInventoryScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [products, setProducts] = useState<VendorCatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stockDraft, setStockDraft] = useState('');
  const [thresholdDraft, setThresholdDraft] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const list = await vendorService.getProducts();
      setProducts(list);
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
    setStockDraft(String(item.stock_quantity));
    setThresholdDraft(String(item.low_stock_threshold));
  };

  const saveEdit = async (productId: string) => {
    const stock = parseInt(stockDraft, 10);
    const threshold = parseInt(thresholdDraft, 10);
    if (Number.isNaN(stock) || stock < 0) {
      Alert.alert(t('common.error'), t('vendorInventory.invalidStock'));
      return;
    }
    await vendorService.updateInventory(
      productId,
      stock,
      Number.isNaN(threshold) ? undefined : threshold
    );
    setEditingId(null);
    await load(true);
    Alert.alert(t('common.success'), t('vendorInventory.saved'));
  };

  const renderItem = ({ item }: { item: VendorCatalogProduct }) => {
    const isLow = item.stock_quantity <= item.low_stock_threshold;
    const isEditing = editingId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.productName}>{item.name}</Text>
          <View style={[styles.badge, isLow ? styles.badgeLow : styles.badgeOk]}>
            <Text style={styles.badgeText}>
              {isLow ? t('vendorInventory.lowStock') : t('vendorInventory.inStock')}
            </Text>
          </View>
        </View>
        <Text style={styles.sku}>{item.sku || item.category}</Text>

        {isEditing ? (
          <View style={styles.editRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('vendorInventory.quantity')}</Text>
              <TextInput
                style={styles.input}
                value={stockDraft}
                onChangeText={setStockDraft}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('vendorInventory.threshold')}</Text>
              <TextInput
                style={styles.input}
                value={thresholdDraft}
                onChangeText={setThresholdDraft}
                keyboardType="number-pad"
              />
            </View>
          </View>
        ) : (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{item.stock_quantity}</Text>
              <Text style={styles.statLabel}>{t('vendorInventory.onHand')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{item.low_stock_threshold}</Text>
              <Text style={styles.statLabel}>{t('vendorInventory.alertAt')}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => (isEditing ? saveEdit(item.id) : startEdit(item))}
        >
          <Ionicons
            name={isEditing ? 'checkmark-circle-outline' : 'create-outline'}
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.actionText}>
            {isEditing ? t('common.save') : t('vendorInventory.updateStock')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <VendorPageHeader
        title={t('vendorInventory.title')}
        subtitle={t('vendorDashboard.inventory')}
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
          ListEmptyComponent={
            <Text style={styles.empty}>{t('vendorInventory.empty')}</Text>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VENDOR_SCREEN_BG },
  loader: { marginTop: SPACING.xxl },
  list: { padding: SPACING.lg, gap: SPACING.md },
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  productName: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginRight: SPACING.sm,
  },
  sku: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: SPACING.md },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.round },
  badgeLow: { backgroundColor: COLORS.warning + '25' },
  badgeOk: { backgroundColor: COLORS.success + '25' },
  badgeText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.medium, color: COLORS.text },
  statsRow: { flexDirection: 'row', gap: SPACING.lg, marginBottom: SPACING.md },
  stat: { alignItems: 'center' },
  statValue: { fontSize: FONT_SIZES.xl, fontWeight: FONT_WEIGHTS.bold, color: COLORS.primary },
  statLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
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

export default VendorInventoryScreen;
