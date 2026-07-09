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
import {
  TANDIL_TERMS_INTRO,
  TANDIL_TERMS_META,
  TANDIL_TERMS_SECTIONS,
  LegalSection,
} from '../../data/tandilTermsContent';
import { fetchAppInfoPage } from '../../services/appInfoService';

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

function SectionCard({ section }: { section: LegalSection }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        {section.number != null ? (
          <View style={styles.sectionNumber}>
            <Text style={styles.sectionNumberText}>{section.number}</Text>
          </View>
        ) : null}
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>

      {section.paragraphs?.map((paragraph) => (
        <Text key={paragraph} style={styles.paragraph}>
          {paragraph}
        </Text>
      ))}

      {section.bullets?.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const VendorLegalDocumentScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { t } = useTranslation();
  const document = route.params?.document ?? 'terms';
  const isTerms = document === 'terms';

  const [loading, setLoading] = useState(!isTerms);
  const [privacyTitle, setPrivacyTitle] = useState(
    t('vendorProfile.privacy', { defaultValue: 'Privacy Policy' })
  );
  const [privacyParagraphs, setPrivacyParagraphs] = useState<string[]>([]);

  const termsTitle = t('vendorProfile.terms', { defaultValue: TANDIL_TERMS_META.title });

  useEffect(() => {
    if (isTerms) return undefined;
    let cancelled = false;
    setLoading(true);
    const fallback = t('profile.appInfo.privacyPolicy.body', {
      defaultValue:
        'We respect your privacy. Tandil collects only the information needed to provide services, process orders, and improve your experience.\n\nWe do not sell your personal data. Data may be shared with payment providers and delivery partners only to fulfil your orders. You can delete your account at any time from Profile → Delete Account in the app.\n\nFor the full policy, refer to updates published by Tandil or contact info@tandil.ae.',
    });

    fetchAppInfoPage('privacy_policy')
      .then((content) => {
        if (cancelled) return;
        if (content?.title) setPrivacyTitle(content.title);
        const body = content?.body ? stripHtml(content.body) : fallback;
        setPrivacyParagraphs(body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean));
      })
      .catch(() => {
        if (!cancelled) {
          setPrivacyParagraphs(fallback.split(/\n\n+/).map((p) => p.trim()).filter(Boolean));
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
            <>
              <View style={styles.introCard}>
                {TANDIL_TERMS_INTRO.map((paragraph) => (
                  <Text key={paragraph} style={styles.introParagraph}>
                    {paragraph}
                  </Text>
                ))}
              </View>

              {TANDIL_TERMS_SECTIONS.map((section) => (
                <SectionCard key={section.number ?? section.title} section={section} />
              ))}

              <TouchableOpacity
                style={styles.linkCard}
                onPress={() => navigation.navigate('LegalDocument', { document: 'privacy' })}
              >
                  <Ionicons name="shield-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.linkText}>
                    {t('vendorLegal.viewPrivacy', { defaultValue: 'View Privacy Policy' })}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.introCard}>
              {privacyParagraphs.map((paragraph) => (
                <Text key={paragraph} style={styles.introParagraph}>
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
  sectionCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sectionNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionNumberText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  sectionTitle: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  paragraph: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
    paddingLeft: SPACING.xs,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 22,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary + '10',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    padding: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  linkText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
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
