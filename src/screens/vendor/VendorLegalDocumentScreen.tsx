import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { VendorPageHeader, VENDOR_SCREEN_BG } from '../../components/vendor/VendorUi';
import { TANDIL_TERMS_META } from '../../data/tandilTermsContent';
import { fetchAppContentPage } from '../../services/appInfoService';

type DocumentType = 'terms' | 'privacy';

type RouteParams = {
  document: DocumentType;
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const VendorLegalDocumentScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { t } = useTranslation();
  const document = route.params?.document ?? 'terms';
  const isTerms = document === 'terms';

  const [loading, setLoading] = useState(true);
  const [privacyTitle, setPrivacyTitle] = useState(
    t('vendorProfile.privacy', { defaultValue: 'Privacy Policy' })
  );
  const [privacyParagraphs, setPrivacyParagraphs] = useState<string[]>([]);
  const [termsTitle, setTermsTitle] = useState(
    t('vendorProfile.terms', { defaultValue: TANDIL_TERMS_META.title })
  );
  const [termsParagraphs, setTermsParagraphs] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const pageKey = isTerms ? 'terms_conditions' : 'privacy_policy';
    const fallbackPrivacy = t('profile.appInfo.privacyPolicy.body', {
      defaultValue:
        'We respect your privacy. Tandil collects only the information needed to provide services, process orders, and improve your experience.\n\nWe do not sell your personal data. Data may be shared with payment providers and delivery partners only to fulfil your orders. You can delete your account at any time from Profile → Delete Account in the app.\n\nFor the full policy, refer to updates published by Tandil or contact info@tandil.ae.',
    });

    fetchAppContentPage('vendor', pageKey)
      .then((content) => {
        if (cancelled) return;
        if (isTerms) {
          if (content?.title) setTermsTitle(content.title);
          const body = content?.body ? stripHtml(content.body) : '';
          setTermsParagraphs(body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean));
        } else if (content?.body) {
          if (content.title) setPrivacyTitle(content.title);
          const body = stripHtml(content.body);
          setPrivacyParagraphs(body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean));
        } else {
          setPrivacyParagraphs(fallbackPrivacy.split(/\n\n+/).map((p) => p.trim()).filter(Boolean));
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (isTerms) {
          setTermsParagraphs([]);
        } else {
          setPrivacyParagraphs(fallbackPrivacy.split(/\n\n+/).map((p) => p.trim()).filter(Boolean));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isTerms, t]);

  const screenTitle = isTerms ? termsTitle : privacyTitle;

  const heroSubtitle = useMemo(() => {
    if (isTerms) {
      return t('vendorLegal.termsSubtitle', {
        defaultValue: 'Effective Date: {{date}}',
        date: TANDIL_TERMS_META.effectiveDate,
      });
    }
    return t('vendorLegal.privacySubtitle', {
      defaultValue: 'How Tandil collects, uses, and protects your information',
    });
  }, [isTerms, t]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <VendorPageHeader
        title={screenTitle}
        subtitle={heroSubtitle}
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
            <View style={styles.heroIconWrap}>
              <Ionicons
                name={isTerms ? 'document-text' : 'shield-checkmark'}
                size={26}
                color={COLORS.background}
              />
            </View>
            <Text style={styles.heroTitle}>{screenTitle}</Text>
            <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
          </View>

          {isTerms ? (
            <View style={styles.introCard}>
              {termsParagraphs.length > 0 ? (
                termsParagraphs.map((paragraph, index) => (
                  <Text key={`${index}-${paragraph.slice(0, 24)}`} style={styles.introParagraph}>
                    {paragraph}
                  </Text>
                ))
              ) : (
                <Text style={styles.introParagraph}>
                  {t('vendorLegal.noTerms', {
                    defaultValue: 'Terms & Conditions are not available yet.',
                  })}
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.introCard}>
              {privacyParagraphs.map((paragraph, index) => (
                <Text key={`${index}-${paragraph.slice(0, 24)}`} style={styles.introParagraph}>
                  {paragraph}
                </Text>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.contactLink}
            onPress={() => navigation.navigate('ContactUs')}
          >
            <Ionicons name="mail-outline" size={18} color={COLORS.background} />
            <Text style={styles.contactLinkText}>
              {t('vendorLegal.questionsContact', { defaultValue: 'Questions? Contact Tandil' })}
            </Text>
          </TouchableOpacity>
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
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  heroTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 20,
  },
  introCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  introParagraph: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 24,
    marginBottom: SPACING.sm,
  },
  contactLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  contactLinkText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default VendorLegalDocumentScreen;
