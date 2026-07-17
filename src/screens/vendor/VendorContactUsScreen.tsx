import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  VENDOR_SCREEN_BG,
  VendorPageHeader,
  VendorCard,
} from '../../components/vendor/VendorUi';
import {
  fetchAppContactInfo,
  getDefaultContactInfo,
} from '../../services/appInfoService';
import type { AppContactInfo, AppInfoAudience } from '../../types/appInfo';

type ContactMethod = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  hint: string;
  color: string;
  onPress: () => void;
};

interface ContactUsContentScreenProps {
  audience?: AppInfoAudience;
  title?: string;
  subtitle?: string;
  showLiveChat?: boolean;
}

export const ContactUsContentScreen: React.FC<ContactUsContentScreenProps> = ({
  audience = 'vendor',
  title,
  subtitle,
  showLiveChat = true,
}) => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<AppContactInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAppContactInfo(audience)
      .then((data) => {
        if (!cancelled) setContact(data);
      })
      .catch(() => {
        if (!cancelled) setContact(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audience]);

  const defaultContact = getDefaultContactInfo(audience);
  const contactInfo = contact ?? {
    ...defaultContact,
    heroTitle:
      defaultContact.heroTitle ||
      t('vendorContact.heroTitle', { defaultValue: 'Get in touch with Tandil' }),
    heroText:
      defaultContact.heroText ||
      t('vendorContact.heroText', {
        defaultValue:
          'For any questions regarding these Terms, please contact us using any of the options below.',
      }),
    note:
      defaultContact.note ||
      t('vendorContact.note', {
        defaultValue: 'Our support team typically responds within 24–48 hours on business days.',
      }),
  };

  const openLink = useCallback(async (url: string, errorMessage: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(t('common.error', { defaultValue: 'Error' }), errorMessage);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), errorMessage);
    }
  }, [t]);

  const openWebsite = useCallback(() => {
    openLink(
      contactInfo.website || 'https://tandil.ae',
      t('vendorContact.websiteError', { defaultValue: 'Could not open website.' })
    );
  }, [contactInfo.website, openLink, t]);

  const openEmail = useCallback(() => {
    if (!contactInfo.email) return;
    openLink(
      `mailto:${contactInfo.email}`,
      t('vendorContact.emailError', { defaultValue: 'Could not open email app.' })
    );
  }, [contactInfo.email, openLink, t]);

  const openWhatsApp = useCallback(() => {
    const dial = contactInfo.whatsappDial || contactInfo.phone || '';
    const digits = dial.replace(/\D/g, '');
    if (!digits) return;
    openLink(
      `https://wa.me/${digits}`,
      t('vendorContact.whatsappError', { defaultValue: 'Could not open WhatsApp.' })
    );
  }, [contactInfo.phone, contactInfo.whatsappDial, openLink, t]);

  const methods: ContactMethod[] = [
    ...(contactInfo.website
      ? [{
          id: 'website',
          icon: 'globe-outline' as const,
          label: t('vendorContact.website', { defaultValue: 'Website' }),
          value: contactInfo.websiteLabel || contactInfo.website,
          hint: t('vendorContact.websiteHint', { defaultValue: 'Visit our official site' }),
          color: '#2563EB',
          onPress: openWebsite,
        }]
      : []),
    ...(contactInfo.email
      ? [{
          id: 'email',
          icon: 'mail-outline' as const,
          label: t('vendorContact.email', { defaultValue: 'Email' }),
          value: contactInfo.email,
          hint: t('vendorContact.emailHint', { defaultValue: 'Send us your questions' }),
          color: COLORS.primary,
          onPress: openEmail,
        }]
      : []),
    ...(contactInfo.whatsappDial || contactInfo.phone
      ? [{
          id: 'whatsapp',
          icon: 'logo-whatsapp' as const,
          label: t('vendorContact.whatsapp', { defaultValue: 'WhatsApp' }),
          value: contactInfo.whatsappDisplay || contactInfo.phone || '',
          hint: t('vendorContact.whatsappHint', { defaultValue: 'Chat with our team' }),
          color: '#25D366',
          onPress: openWhatsApp,
        }]
      : []),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <VendorPageHeader
        title={title ?? t('vendorProfile.contactUs', { defaultValue: 'Contact Us' })}
        subtitle={
          subtitle ??
          t('vendorContact.subtitle', { defaultValue: 'We are here to help vendors' })
        }
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.hero}>
            <View style={styles.heroDecor} />
            <View style={styles.heroIconWrap}>
              <Ionicons name="headset" size={28} color={COLORS.background} />
            </View>
            <Text style={styles.heroTitle}>
              {contactInfo.heroTitle ||
                t('vendorContact.heroTitle', { defaultValue: 'Get in touch with Tandil' })}
            </Text>
            <Text style={styles.heroText}>
              {contactInfo.heroText ||
                t('vendorContact.heroText', {
                  defaultValue:
                    'For any questions regarding these Terms, please contact us using any of the options below.',
                })}
            </Text>
          </View>

          <VendorCard style={styles.brandCard}>
            <View style={styles.brandRow}>
              <View style={styles.brandLogo}>
                <Text style={styles.brandLogoText}>T</Text>
              </View>
              <View>
                <Text style={styles.brandName}>{contactInfo.company || 'Tandil'}</Text>
                {contactInfo.country ? (
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.brandLocation}>{contactInfo.country}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </VendorCard>

          <Text style={styles.sectionTitle}>
            {t('vendorContact.reachUs', { defaultValue: 'Reach us' })}
          </Text>

          {methods.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={styles.methodCard}
              onPress={method.onPress}
              activeOpacity={0.88}
            >
              <View style={[styles.methodIcon, { backgroundColor: method.color + '18' }]}>
                <Ionicons name={method.icon} size={24} color={method.color} />
              </View>
              <View style={styles.methodContent}>
                <Text style={styles.methodLabel}>{method.label}</Text>
                <Text style={styles.methodValue}>{method.value}</Text>
                <Text style={styles.methodHint}>{method.hint}</Text>
              </View>
              <View style={[styles.methodAction, { backgroundColor: method.color + '14' }]}>
                <Ionicons name="arrow-forward" size={18} color={method.color} />
              </View>
            </TouchableOpacity>
          ))}

          <VendorCard style={styles.noteCard}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
            <Text style={styles.noteText}>
              {contactInfo.note ||
                t('vendorContact.note', {
                  defaultValue:
                    'Our support team typically responds within 24–48 hours on business days.',
                })}
            </Text>
          </VendorCard>

          {showLiveChat ? (
            <TouchableOpacity style={styles.liveChatBtn} onPress={() => navigation.navigate('LiveChat')}>
              <Ionicons name="chatbubbles-outline" size={20} color={COLORS.background} />
              <Text style={styles.liveChatText}>
                {t('vendorContact.openLiveChat', { defaultValue: 'Open Live Chat' })}
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VENDOR_SCREEN_BG },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  heroDecor: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -30,
    right: -20,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    marginBottom: SPACING.sm,
  },
  heroText: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
  },
  brandCard: { marginBottom: SPACING.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  brandLogo: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  brandName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  brandLocation: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: SPACING.sm,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  methodContent: { flex: 1 },
  methodLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  methodValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginTop: 2,
  },
  methodHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  methodAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary + '08',
    borderColor: COLORS.primary + '22',
  },
  noteText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  liveChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  liveChatText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
});

const VendorContactUsScreen: React.FC = () => <ContactUsContentScreen />;

export default VendorContactUsScreen;
