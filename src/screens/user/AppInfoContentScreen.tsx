import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { fetchAppInfoPage } from '../../services/appInfoService';
import type { AppInfoPageKey } from '../../types/appInfo';
import type { UserStackParamList } from '../../types';

type Route = RouteProp<UserStackParamList, 'AppInfoContent'>;

const I18N_KEY: Record<AppInfoPageKey, string> = {
  who_we_are: 'whoWeAre',
  privacy_policy: 'privacyPolicy',
  terms_conditions: 'termsConditions',
};

/** Strip simple HTML tags for plain-text display. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const AppInfoContentScreen: React.FC = () => {
  const { t } = useTranslation();
  const route = useRoute<Route>();
  const pageKey = route.params.pageKey;
  const i18nKey = I18N_KEY[pageKey];

  const [loading, setLoading] = useState(true);
  const [apiTitle, setApiTitle] = useState<string | undefined>();
  const [body, setBody] = useState('');

  const fallbackTitle = t(`profile.appInfo.${i18nKey}.title`);
  const fallbackBody = t(`profile.appInfo.${i18nKey}.body`);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const localizedFallback = t(`profile.appInfo.${i18nKey}.body`);
    fetchAppInfoPage(pageKey)
      .then((content) => {
        if (cancelled) return;
        if (content?.body) {
          setApiTitle(content.title);
          setBody(stripHtml(content.body));
        } else {
          setApiTitle(undefined);
          setBody(localizedFallback);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiTitle(undefined);
          setBody(localizedFallback);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageKey, i18nKey, t]);

  const screenTitle = apiTitle || fallbackTitle;

  return (
    <View style={styles.container}>
      <Header title={screenTitle} showBack />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {body.split(/\n\n+/).map((paragraph, index) => (
              <Text key={index} style={[styles.paragraph, index > 0 && styles.paragraphGap]}>
                {paragraph.trim()}
              </Text>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  paragraph: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 24,
  },
  paragraphGap: {
    marginTop: SPACING.md,
  },
});

export default AppInfoContentScreen;
