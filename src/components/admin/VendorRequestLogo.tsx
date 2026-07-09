import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants';
import { buildFullImageUrl } from '../../config/api';

export function resolveVendorLogoUrl(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  return trimmed.startsWith('http') ? trimmed : buildFullImageUrl(trimmed);
}

export interface VendorRequestLogoProps {
  logoUrl?: string | null;
  size?: number;
}

const VendorRequestLogo: React.FC<VendorRequestLogoProps> = ({ logoUrl, size = 48 }) => {
  const resolved = resolveVendorLogoUrl(logoUrl);
  const radius = size / 2;

  if (resolved) {
    return (
      <Image
        source={{ uri: resolved }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: radius,
          },
        ]}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
      ]}
    >
      <Ionicons name="storefront" size={Math.round(size * 0.46)} color={COLORS.primary} />
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  placeholder: {
    backgroundColor: COLORS.primary + '14',
    borderWidth: 1,
    borderColor: COLORS.primary + '22',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default VendorRequestLogo;
