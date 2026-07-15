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
      ...Platform.select({
        ios: {
          shadowColor: '#0f2513',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        android: {
          elevation: 12,
        },
      }),
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
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: COLORS.primary + '16',
  },
});
