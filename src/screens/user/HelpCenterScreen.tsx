import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { useTranslation } from 'react-i18next';

const HelpCenterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const faqRaw = (t('helpCenter.faqItems', { returnObjects: true }) as any[]) || [];
  const faqData = faqRaw.map((item: any) =>
    item && typeof item === 'object'
      ? { question: item.q ?? item.question, answer: item.a ?? item.answer }
      : { question: String(item ?? ''), answer: '' }
  );

  const supportPhone = (t('helpCenter.contact.phone') || '+1234567890').replace(/\s*[()\-]\s*/g, '').trim() || '+1234567890';
  const supportEmail = (t('helpCenter.contact.email') || 'support@tandil.com').trim() || 'support@tandil.com';

  const openPhone = () => {
    const url = `tel:${supportPhone}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(t('common.error'), t('helpCenter.callNotAvailable'));
    });
  };

  const openEmail = () => {
    const url = `mailto:${supportEmail}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(t('common.error'), t('helpCenter.emailNotAvailable'));
    });
  };

  const supportCategories = [
    {
      icon: 'call-outline',
      title: t('helpCenter.categories.call.title'),
      subtitle: t('helpCenter.categories.call.subtitle'),
      action: openPhone,
    },
    {
      icon: 'mail-outline',
      title: t('helpCenter.categories.email.title'),
      subtitle: t('helpCenter.categories.email.subtitle'),
      action: openEmail,
    },
    {
      icon: 'document-text-outline',
      title: t('helpCenter.categories.ticket.title'),
      subtitle: t('helpCenter.categories.ticket.subtitle'),
      action: () => navigation.navigate('SubmitTicket'),
    },
    {
      icon: 'list-outline',
      title: t('helpCenter.categories.myTickets.title'),
      subtitle: t('helpCenter.categories.myTickets.subtitle'),
      action: () => navigation.navigate('MyTickets'),
    },
  ];

  const handleFaqPress = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const renderFaqItem = (item: any, index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.faqItem}
      onPress={() => handleFaqPress(index)}
    >
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{item.question}</Text>
        <Ionicons
          name={expandedFaq === index ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={COLORS.textSecondary}
        />
      </View>
      {expandedFaq === index && (
        <Text style={styles.faqAnswer}>{item.answer}</Text>
      )}
    </TouchableOpacity>
  );

  const renderSupportCategory = (category: any) => (
    <TouchableOpacity
      key={category.title}
      style={styles.supportCategory}
      onPress={category.action}
    >
      <View style={styles.categoryIcon}>
        <Ionicons name={category.icon as any} size={24} color={COLORS.primary} />
      </View>
      <View style={styles.categoryContent}>
        <Text style={styles.categoryTitle}>{category.title}</Text>
        <Text style={styles.categorySubtitle}>{category.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Header 
        title={t('helpCenter.title')} 
        showBack={true}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Welcome Section */}
        <View style={styles.welcomeCard}>
          <Ionicons name="help-circle" size={48} color={COLORS.primary} />
          <Text style={styles.welcomeTitle}>{t('helpCenter.welcomeTitle')}</Text>
          <Text style={styles.welcomeSubtitle}>
            {t('helpCenter.welcomeSubtitle')}
          </Text>
        </View>

        {/* Support Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('helpCenter.getSupport')}</Text>
          <View style={styles.supportCategories}>
            {supportCategories.map(renderSupportCategory)}
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('helpCenter.faq')}</Text>
          <View style={styles.faqContainer}>
            {faqData.map(renderFaqItem)}
          </View>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('helpCenter.contactInformation')}</Text>
          <View style={styles.contactCard}>
            <View style={styles.contactItem}>
              <Ionicons name="call-outline" size={20} color={COLORS.primary} />
              <Text style={styles.contactText}>{t('helpCenter.contact.phone')}</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="mail-outline" size={20} color={COLORS.primary} />
              <Text style={styles.contactText}>{t('helpCenter.contact.email')}</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="time-outline" size={20} color={COLORS.primary} />
              <Text style={styles.contactText}>{t('helpCenter.contact.hours')}</Text>
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
  placeholder: {
    width: 40,
  },
  welcomeCard: {
    backgroundColor: COLORS.primary,
    margin: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  welcomeSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.background,
    opacity: 0.9,
    textAlign: 'center',
  },
  section: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  supportCategories: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  supportCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  categoryContent: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  categorySubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  faqContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  faqItem: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.sm,
  },
  faqAnswer: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
  contactCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  contactText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
});

export default HelpCenterScreen;
