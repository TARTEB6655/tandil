import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import {
  fetchAdminAppContentPage,
  getDefaultContactInfo,
  parseContactInfoFromBody,
  saveAdminAppContentPage,
  serializeContactInfo,
} from '../../services/adminAppContentService';
import type { AppContactInfo, AppContentPageKey, AppInfoAudience } from '../../types/appInfo';
import { TANDIL_TERMS_META } from '../../data/tandilTermsContent';

type ContentTab = AppContentPageKey;

const CONTENT_TABS: Array<{ key: ContentTab; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'contact_us', icon: 'mail-outline' },
  { key: 'terms_conditions', icon: 'document-text-outline' },
  { key: 'privacy_policy', icon: 'shield-checkmark-outline' },
];

const AdminAppContentSettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const [audience, setAudience] = useState<AppInfoAudience>('client');
  const [contentTab, setContentTab] = useState<ContentTab>('contact_us');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [body, setBody] = useState('');
  const [contact, setContact] = useState<AppContactInfo>(() => getDefaultContactInfo('client'));

  const isContactTab = contentTab === 'contact_us';

  const defaultTitle = useMemo(() => {
    switch (contentTab) {
      case 'contact_us':
        return t('admin.settings.appContent.contactUs', { defaultValue: 'Contact Us' });
      case 'terms_conditions':
        return t('admin.settings.appContent.termsConditions', { defaultValue: 'Terms & Conditions' });
      case 'privacy_policy':
      default:
        return t('admin.settings.appContent.privacyPolicy', { defaultValue: 'Privacy Policy' });
    }
  }, [contentTab, t]);

  const contentFallback = useMemo(() => {
    if (contentTab === 'contact_us') return null;

    // Do not inject hardcoded vendor terms — that default "About Tandil" text
    // was reappearing after edits because it was treated as fallback content.
    if (audience === 'vendor' && contentTab === 'terms_conditions') {
      return {
        title: TANDIL_TERMS_META.title,
        body: '',
      };
    }

    const translationKey =
      contentTab === 'terms_conditions' ? 'termsConditions' : 'privacyPolicy';
    return {
      title:
        audience === 'vendor' && contentTab === 'privacy_policy'
          ? t('vendorProfile.privacy', { defaultValue: 'Privacy Policy' })
          : t(`profile.appInfo.${translationKey}.title`, {
              defaultValue: defaultTitle,
            }),
      body: t(`profile.appInfo.${translationKey}.body`, {
        defaultValue: '',
      }),
    };
  }, [audience, contentTab, defaultTitle, t]);

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchAdminAppContentPage(audience, contentTab);
      if (contentTab === 'contact_us') {
        const defaults = getDefaultContactInfo(audience);
        if (audience === 'client') {
          defaults.phone = t('helpCenter.contact.phone', {
            defaultValue: defaults.phone,
          });
          defaults.email = t('helpCenter.contact.email', {
            defaultValue: defaults.email,
          });
        }
        const parsed = parseContactInfoFromBody(page?.body);
        setTitle(page?.title || defaultTitle);
        setSubtitle(page?.subtitle || '');
        setContact({ ...defaults, ...(parsed ?? {}) });
        setBody('');
      } else if (page) {
        // Use API content only. Do not re-inject hardcoded vendor fallback over saved text.
        setTitle(page.title || defaultTitle);
        setSubtitle(page.subtitle || '');
        setBody(page.body ?? '');
      } else {
        setTitle(contentFallback?.title || defaultTitle);
        setSubtitle('');
        setBody(contentFallback?.body || '');
      }
    } catch {
      if (contentTab === 'contact_us') {
        setTitle(defaultTitle);
        setSubtitle('');
        const defaults = getDefaultContactInfo(audience);
        if (audience === 'client') {
          defaults.phone = t('helpCenter.contact.phone', {
            defaultValue: defaults.phone,
          });
          defaults.email = t('helpCenter.contact.email', {
            defaultValue: defaults.email,
          });
        }
        setContact(defaults);
      } else {
        setTitle(contentFallback?.title || defaultTitle);
        setSubtitle('');
        setBody(contentFallback?.body || '');
      }
    } finally {
      setLoading(false);
    }
  }, [audience, contentFallback, contentTab, defaultTitle, t]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const updateContactField = (field: keyof AppContactInfo, value: string) => {
    setContact((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (isContactTab) {
      if (!contact.email?.trim() && !contact.phone?.trim() && !contact.whatsappDial?.trim()) {
        Alert.alert(
          t('common.error'),
          t('admin.settings.appContent.contactRequired', {
            defaultValue: 'Add at least one contact method (email, phone, or WhatsApp).',
          })
        );
        return;
      }
    } else if (!body.trim()) {
      Alert.alert(
        t('common.error'),
        t('admin.settings.appContent.bodyRequired', { defaultValue: 'Content body is required.' })
      );
      return;
    }

    setSaving(true);
    try {
      const payload = isContactTab
        ? {
            title: title.trim() || defaultTitle,
            subtitle: subtitle.trim() || undefined,
            body: serializeContactInfo(contact),
          }
        : {
            title: title.trim() || defaultTitle,
            subtitle: subtitle.trim() || undefined,
            body: body.trim(),
          };

      const result = await saveAdminAppContentPage(audience, contentTab, payload);
      setSaving(false);

      if (result.success) {
        // Keep the text the admin just saved. Avoid reloading legacy sections that
        // can make removed/replaced terms content reappear.
        if (!isContactTab) {
          setTitle(title.trim() || defaultTitle);
          setSubtitle(subtitle.trim());
          setBody(body.trim());
        } else if (result.data) {
          const parsed = parseContactInfoFromBody(result.data.body);
          setTitle(result.data.title || title);
          setSubtitle(result.data.subtitle || subtitle);
          if (parsed) setContact((prev) => ({ ...prev, ...parsed }));
        } else {
          await loadContent();
        }
        Alert.alert(
          t('admin.settings.success'),
          result.message ||
            t('admin.settings.appContent.saved', { defaultValue: 'Content saved successfully.' })
        );
      } else {
        Alert.alert(
          t('common.error'),
          result.message ||
            t('admin.settings.appContent.saveFailed', { defaultValue: 'Failed to save content.' })
        );
      }
    } catch (error: any) {
      setSaving(false);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        t('admin.settings.appContent.saveFailed', { defaultValue: 'Failed to save content.' });
      Alert.alert(t('common.error'), typeof message === 'string' ? message : JSON.stringify(message));
    }
  };

  const renderContactField = (
    label: string,
    field: keyof AppContactInfo,
    options?: { multiline?: boolean; placeholder?: string; keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url' }
  ) => (
    <View style={styles.fieldGroup} key={field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, options?.multiline && styles.textArea]}
        value={String(contact[field] ?? '')}
        onChangeText={(value) => updateContactField(field, value)}
        placeholder={options?.placeholder}
        placeholderTextColor={COLORS.textSecondary}
        keyboardType={options?.keyboardType ?? 'default'}
        autoCapitalize={options?.keyboardType === 'email-address' ? 'none' : 'sentences'}
        multiline={options?.multiline}
        textAlignVertical={options?.multiline ? 'top' : 'center'}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <Header
        title={t('admin.settings.appContent.title', { defaultValue: 'Legal & Contact Content' })}
        showBack
        showLanguage={false}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>
          {t('admin.settings.appContent.audienceSection', { defaultValue: 'Audience' })}
        </Text>
        <View style={styles.segmentRow}>
          {(['client', 'vendor'] as AppInfoAudience[]).map((item) => {
            const active = audience === item;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.segmentButton, active && styles.segmentButtonActive]}
                onPress={() => setAudience(item)}
              >
                <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                  {item === 'client'
                    ? t('admin.settings.appContent.clientApp', { defaultValue: 'Client App' })
                    : t('admin.settings.appContent.vendorApp', { defaultValue: 'Vendor App' })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>
          {t('admin.settings.appContent.contentSection', { defaultValue: 'Content Type' })}
        </Text>
        <View style={styles.tabRow}>
          {CONTENT_TABS.map((tab) => {
            const active = contentTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, active && styles.tabButtonActive]}
                onPress={() => setContentTab(tab.key)}
              >
                <Ionicons
                  name={tab.icon}
                  size={18}
                  color={active ? COLORS.primary : COLORS.textSecondary}
                />
                <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>
                  {tab.key === 'contact_us'
                    ? t('admin.settings.appContent.contactUs', { defaultValue: 'Contact Us' })
                    : tab.key === 'terms_conditions'
                      ? t('admin.settings.appContent.termsConditions', { defaultValue: 'Terms & Conditions' })
                      : t('admin.settings.appContent.privacyPolicy', { defaultValue: 'Privacy Policy' })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <View style={styles.formCard}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {t('admin.settings.appContent.pageTitle', { defaultValue: 'Page Title' })}
              </Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={defaultTitle}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            {!isContactTab ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {t('admin.settings.appContent.pageSubtitle', { defaultValue: 'Subtitle' })}
                </Text>
                <TextInput
                  style={styles.input}
                  value={subtitle}
                  onChangeText={setSubtitle}
                  placeholder={t('admin.settings.appContent.subtitlePlaceholder', {
                    defaultValue: 'Short subtitle shown under the title',
                  })}
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            ) : null}

            {isContactTab ? (
              <>
                {renderContactField(
                  t('admin.settings.appContent.company', { defaultValue: 'Company Name' }),
                  'company',
                  { placeholder: 'Tandil' }
                )}
                {renderContactField(
                  t('admin.settings.appContent.website', { defaultValue: 'Website URL' }),
                  'website',
                  { placeholder: 'https://tandil.ae', keyboardType: 'url' }
                )}
                {renderContactField(
                  t('admin.settings.appContent.websiteLabel', { defaultValue: 'Website Label' }),
                  'websiteLabel',
                  { placeholder: 'tandil.ae' }
                )}
                {renderContactField(
                  t('admin.settings.appContent.email', { defaultValue: 'Email' }),
                  'email',
                  { placeholder: 'info@tandil.ae', keyboardType: 'email-address' }
                )}
                {renderContactField(
                  t('admin.settings.appContent.phone', { defaultValue: 'Phone' }),
                  'phone',
                  { placeholder: '+971569206959', keyboardType: 'phone-pad' }
                )}
                {renderContactField(
                  t('admin.settings.appContent.whatsappDisplay', { defaultValue: 'WhatsApp (display)' }),
                  'whatsappDisplay',
                  { placeholder: '+971 569206959', keyboardType: 'phone-pad' }
                )}
                {renderContactField(
                  t('admin.settings.appContent.whatsappDial', { defaultValue: 'WhatsApp (dial number)' }),
                  'whatsappDial',
                  { placeholder: '+971569206959', keyboardType: 'phone-pad' }
                )}
                {renderContactField(
                  t('admin.settings.appContent.country', { defaultValue: 'Country' }),
                  'country',
                  { placeholder: 'United Arab Emirates' }
                )}
                {renderContactField(
                  t('admin.settings.appContent.heroTitle', { defaultValue: 'Hero Title' }),
                  'heroTitle',
                  { placeholder: 'Get in touch with Tandil' }
                )}
                {renderContactField(
                  t('admin.settings.appContent.heroText', { defaultValue: 'Hero Description' }),
                  'heroText',
                  { multiline: true, placeholder: 'Short description shown on the contact page.' }
                )}
                {renderContactField(
                  t('admin.settings.appContent.note', { defaultValue: 'Support Note' }),
                  'note',
                  { multiline: true, placeholder: 'Our support team typically responds within 24–48 hours.' }
                )}
              </>
            ) : (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {t('admin.settings.appContent.body', { defaultValue: 'Content Body' })}
                </Text>
                <Text style={styles.fieldHint}>
                  {t('admin.settings.appContent.bodyHint', {
                    defaultValue: 'Plain text or HTML. Use blank lines to separate paragraphs.',
                  })}
                </Text>
                <TextInput
                  style={[styles.input, styles.textAreaLarge]}
                  value={body}
                  onChangeText={setBody}
                  placeholder={t('admin.settings.appContent.bodyPlaceholder', {
                    defaultValue: 'Enter terms or privacy policy content...',
                  })}
                  placeholderTextColor={COLORS.textSecondary}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, (loading || saving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.background} />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color={COLORS.background} />
              <Text style={styles.saveButtonText}>
                {t('admin.settings.appContent.save', { defaultValue: 'Save Changes' })}
              </Text>
            </>
          )}
        </TouchableOpacity>
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
    paddingBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  segmentButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  segmentButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
  },
  segmentButtonTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  tabRow: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  tabButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  tabButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  tabButtonTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  loadingWrap: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
  },
  formCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fieldGroup: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  fieldHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  textArea: {
    minHeight: 88,
    paddingTop: SPACING.sm,
  },
  textAreaLarge: {
    minHeight: 260,
    paddingTop: SPACING.sm,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default AdminAppContentSettingsScreen;
