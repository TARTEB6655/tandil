import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { VendorPageHeader, VendorCard, VENDOR_SCREEN_BG } from '../../components/vendor/VendorUi';
import { vendorOrderService, VendorOrderContact } from '../../services/vendorOrderService';
import type { VendorStackParamList } from '../../types';

type Route = RouteProp<VendorStackParamList, 'OrderContact'>;

function buildTelUrl(phone: string): string {
  return `tel:${phone.replace(/\s/g, '')}`;
}

function buildWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '').replace(/^\+/, '');
  return `https://wa.me/${digits}`;
}

function buildMailtoUrl(email: string): string {
  return `mailto:${email}`;
}

export default function VendorOrderContactScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const { t } = useTranslation();
  const { orderId } = route.params;
  const [contact, setContact] = useState<VendorOrderContact | null>(null);
  const [loading, setLoading] = useState(true);

  const openUrl = useCallback(
    (url: string, label: string) => {
      Linking.openURL(url).catch(() =>
        Alert.alert(t('common.error'), t('vendorOrders.openFailed', { label }))
      );
    },
    [t]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await vendorOrderService.getOrderContact(orderId);
      setContact(data);
    } catch (error: unknown) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('vendorOrders.contactLoadFailed')
      );
      setContact(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const callUrl = contact?.call_url ?? (contact?.phone ? buildTelUrl(contact.phone) : undefined);
  const whatsappUrl =
    contact?.whatsapp_url ?? (contact?.phone ? buildWhatsAppUrl(contact.phone) : undefined);
  const mailtoUrl = contact?.mailto_url ?? (contact?.email ? buildMailtoUrl(contact.email) : undefined);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <VendorPageHeader
        title={t('vendorOrders.contactCustomer')}
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : contact ? (
        <View style={styles.content}>
          <VendorCard>
            <Text style={styles.customerName}>{contact.customer_name}</Text>
            {contact.phone ? (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.infoText}>{contact.phone}</Text>
              </View>
            ) : null}
            {contact.email ? (
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={18} color={COLORS.textSecondary} />
                <Text style={styles.infoText}>{contact.email}</Text>
              </View>
            ) : null}
          </VendorCard>

          <View style={styles.actions}>
            {callUrl ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.callBtn]}
                onPress={() => openUrl(callUrl, t('vendorOrders.call'))}
              >
                <Ionicons name="call" size={22} color="#fff" />
                <Text style={styles.actionText}>{t('vendorOrders.call')}</Text>
              </TouchableOpacity>
            ) : null}
            {whatsappUrl ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.whatsappBtn]}
                onPress={() => openUrl(whatsappUrl, t('vendorOrders.whatsapp'))}
              >
                <Ionicons name="logo-whatsapp" size={22} color="#fff" />
                <Text style={styles.actionText}>{t('vendorOrders.whatsapp')}</Text>
              </TouchableOpacity>
            ) : null}
            {mailtoUrl ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.emailBtn]}
                onPress={() => openUrl(mailtoUrl, t('vendorOrders.email'))}
              >
                <Ionicons name="mail" size={22} color="#fff" />
                <Text style={styles.actionText}>{t('vendorOrders.email')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {!callUrl && !whatsappUrl && !mailtoUrl ? (
            <Text style={styles.noContact}>{t('vendorOrders.noContactMethods')}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.centered}>
          <Text style={styles.noContact}>{t('vendorOrders.contactUnavailableShort')}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VENDOR_SCREEN_BG },
  content: { padding: SPACING.md },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  customerName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  infoText: { fontSize: FONT_SIZES.md, color: COLORS.text },
  actions: { gap: SPACING.sm, marginTop: SPACING.md },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  callBtn: { backgroundColor: COLORS.primary },
  whatsappBtn: { backgroundColor: '#25D366' },
  emailBtn: { backgroundColor: COLORS.info },
  actionText: { color: '#fff', fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold },
  noContact: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
});
