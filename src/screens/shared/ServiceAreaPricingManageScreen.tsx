import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING } from '../../constants';
import Header from '../../components/common/Header';
import VendorProductServiceAreaPricingSection from '../../components/vendor/VendorProductServiceAreaPricingSection';

type RouteParams = {
  portal: 'admin' | 'vendor';
  vendorId?: string;
  vendorProductId: string;
  listingName?: string;
  serviceName?: string;
  currency?: string;
};

const ServiceAreaPricingManageScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as RouteParams;
  const portal = params.portal === 'admin' ? 'admin' : 'vendor';
  const title =
    params.serviceName?.trim() ||
    params.listingName?.trim() ||
    t('vendorProductAreaPricing.manageTitle', { defaultValue: 'Service area pricing' });

  return (
    <View style={styles.container}>
      <Header title={title} showBack onBackPress={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <VendorProductServiceAreaPricingSection
          portal={portal}
          vendorId={params.vendorId}
          vendorProductId={params.vendorProductId}
          canEdit
          currency={params.currency ?? 'AED'}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
});

export default ServiceAreaPricingManageScreen;
