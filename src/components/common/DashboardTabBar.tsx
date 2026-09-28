import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';

type IconName = keyof typeof Ionicons.glyphMap;

export function DashboardTabIcon({
  focused,
  name,
  outlineName,
}: {
  focused: boolean;
  name: IconName;
  outlineName: IconName;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons
        name={focused ? name : outlineName}
        size={focused ? 22 : 21}
        color={focused ? COLORS.primary : COLORS.textSecondary}
      />
    </View>
  );
}

/** Shared bottom-tab look for all role dashboards */
export function useDashboardTabOptions() {
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'android') {
    // Android: pad only once for system nav (match client). Do not set a fixed tall
    // height — that stretches icon/label and leaves a white strip under the menu.
    // Navigators must use edges={['top']} on Android so this is not double-applied.
    const bottomPad = Math.max(insets.bottom, 4);
    return {
      headerShown: false as const,
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textSecondary,
      safeAreaInsets: { bottom: 0 },
      tabBarStyle: {
        backgroundColor: COLORS.background,
        borderTopWidth: 0,
        elevation: 12,
        paddingTop: 4,
        paddingBottom: bottomPad,
        minHeight: 0,
      },
      tabBarItemStyle: {
        paddingTop: 0,
        paddingBottom: 0,
        justifyContent: 'center' as const,
      },
      tabBarLabelStyle: {
        textTransform: 'none' as const,
        fontSize: FONT_SIZES.xs,
        fontWeight: FONT_WEIGHTS.semiBold,
        marginTop: 0,
        marginBottom: 0,
        lineHeight: 14,
      },
      tabBarIconStyle: {
        marginTop: 0,
        marginBottom: 0,
      },
    };
  }

  // iOS — leave existing look unchanged
  const bottomPad = Math.max(insets.bottom, 8);
  return {
    headerShown: false as const,
    tabBarActiveTintColor: COLORS.primary,
    tabBarInactiveTintColor: COLORS.textSecondary,
    tabBarStyle: {
      backgroundColor: COLORS.background,
      borderTopWidth: 0,
      paddingBottom: bottomPad,
      paddingTop: 8,
      height: 64 + bottomPad,
      shadowColor: '#0f2513',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    tabBarItemStyle: {
      paddingTop: 2,
    },
    tabBarLabelStyle: {
      textTransform: 'none' as const,
      fontSize: FONT_SIZES.xs,
      fontWeight: FONT_WEIGHTS.semiBold,
      marginTop: 2,
    },
  };
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: Platform.OS === 'android' ? 28 : 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: COLORS.primary + '16',
  },
});
