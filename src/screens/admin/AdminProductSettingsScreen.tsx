import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { adminService } from '../../services/adminService';

const AdminProductSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [lowStockWarning, setLowStockWarning] = useState(true);
  const [allowBackorders, setAllowBackorders] = useState(false);
  const [showOutOfStock, setShowOutOfStock] = useState(true);

  const [taxPercent, setTaxPercent] = useState('');
  const [shopSettingsLoading, setShopSettingsLoading] = useState(true);
  const [shopSettingsSaving, setShopSettingsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminService
      .getShopSettings()
      .then((res) => {
        if (cancelled) return;
        const d = res.data;
        if (d) {
          setTaxPercent(String(d.tax_percent ?? 0));
        }
      })
      .catch(() => {
        if (!cancelled) setTaxPercent('5');
      })
      .finally(() => {
        if (!cancelled) setShopSettingsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSaveTax = () => {
    const tax = parseFloat(taxPercent);
    if (Number.isNaN(tax) || tax < 0 || tax > 100) {
      Alert.alert(t('common.error'), t('admin.settings.productSettings.taxInvalid'));
      return;
    }
    setShopSettingsSaving(true);
    adminService
      .updateShopSettings({ tax_percent: tax })
      .then(() => {
        Alert.alert(t('admin.settings.success'), t('admin.settings.productSettings.saved'));
      })
      .catch((err: any) => {
        Alert.alert(
          t('common.error'),
          err.response?.data?.message || err.message || t('admin.settings.productSettings.saveFailed')
        );
      })
      .finally(() => setShopSettingsSaving(false));
  };

  return (
    <View style={styles.container}>
      <Header
        title={t('admin.settings.productSettings.title')}
        showBack
        showLanguage={false}
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('admin.settings.productSettings.inventory')}
          </Text>
          <View style={styles.sectionContent}>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Ionicons name="warning-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>
                  {t('admin.settings.productSettings.lowStockWarning.title')}
                </Text>
                <Text style={styles.settingSubtitle}>
                  {t('admin.settings.productSettings.lowStockWarning.subtitle')}
                </Text>
              </View>
              <Switch
                value={lowStockWarning}
                onValueChange={setLowStockWarning}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                thumbColor={lowStockWarning ? COLORS.primary : COLORS.background}
              />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Ionicons name="layers-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>
                  {t('admin.settings.productSettings.allowBackorders.title')}
                </Text>
                <Text style={styles.settingSubtitle}>
                  {t('admin.settings.productSettings.allowBackorders.subtitle')}
                </Text>
              </View>
              <Switch
                value={allowBackorders}
                onValueChange={setAllowBackorders}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                thumbColor={allowBackorders ? COLORS.primary : COLORS.background}
              />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Ionicons name="eye-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>
                  {t('admin.settings.productSettings.showOutOfStock.title')}
                </Text>
                <Text style={styles.settingSubtitle}>
                  {t('admin.settings.productSettings.showOutOfStock.subtitle')}
                </Text>
              </View>
              <Switch
                value={showOutOfStock}
                onValueChange={setShowOutOfStock}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '40' }}
                thumbColor={showOutOfStock ? COLORS.primary : COLORS.background}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('admin.settings.productSettings.taxSection')}
          </Text>
          <View style={styles.sectionContent}>
            {shopSettingsLoading ? (
              <View style={styles.settingItem}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.settingSubtitle}>{t('admin.settings.loading')}</Text>
              </View>
            ) : (
              <>
                <View style={styles.settingItem}>
                  <View style={styles.settingIcon}>
                    <Ionicons name="pricetag-outline" size={24} color={COLORS.primary} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>
                      {t('admin.settings.productSettings.taxPercent')}
                    </Text>
                    <Text style={styles.settingSubtitle}>
                      {t('admin.settings.productSettings.taxPercentHint')}
                    </Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={taxPercent}
                    onChangeText={setTaxPercent}
                    keyboardType="decimal-pad"
                    placeholder="5"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.saveButton, shopSettingsSaving && styles.saveButtonDisabled]}
                  onPress={handleSaveTax}
                  disabled={shopSettingsSaving}
                >
                  {shopSettingsSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>{t('admin.settings.productSettings.save')}</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('admin.settings.productSettings.display')}
          </Text>
          <View style={styles.sectionContent}>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Ionicons name="cash-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>
                  {t('admin.settings.productSettings.currency.title')}
                </Text>
                <Text style={styles.settingSubtitle}>AED</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionContent: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    minWidth: 72,
    textAlign: 'right',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    margin: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: '#fff',
  },
});

export default AdminProductSettingsScreen;
