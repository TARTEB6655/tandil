import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING, BORDER_RADIUS } from '../constants';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { restoreSessionAndGetRoute } from '../utils/sessionRestore';

const { width, height } = Dimensions.get('window');

const SPLASH_MIN_MS = 2000;

const SplashScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const setUser = useAppStore((s) => s.setUser);
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);
  const hasNavigated = useRef(false);

  const goNext = useCallback(async () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;

    const route = await restoreSessionAndGetRoute(setUser, setAuthenticated);
    navigation.replace(route);
  }, [navigation, setAuthenticated, setUser]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_MS));
      if (!cancelled) {
        await goNext();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [goNext]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      <View style={styles.content}>
        <View style={styles.logoContainer}>
        <Image source={require('../../assets/logo.png')} style={styles.logoImage} />
        </View>
        <Text style={styles.subtitle}>{t('splash.subtitle')}</Text>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.loadingText}>{t('splash.loading')}</Text>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => {
            void goNext();
          }}
        >
          <Text style={styles.skipButtonText}>{t('splash.skip')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: height * 0.1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 150,
    height: 150,
    borderRadius: 100,
    // Removed background to avoid white circle behind logo
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    borderRadius: 100,
  },
  title: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.background,
    opacity: 0.9,
  },
  footer: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.background,
    opacity: 0.8,
  },
  skipButton: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background + '20',
    borderRadius: BORDER_RADIUS.md,
  },
  skipButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.medium,
  },
});

export default SplashScreen; 