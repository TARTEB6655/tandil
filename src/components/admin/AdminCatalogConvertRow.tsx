import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import type { CatalogConvertDirection } from './AdminCatalogConvertModal';

type Props = {
  direction: CatalogConvertDirection;
  onPress: () => void;
  disabled?: boolean;
};

const AdminCatalogConvertRow: React.FC<Props> = ({ direction, onPress, disabled }) => {
  const { t } = useTranslation();
  const categoryToService = direction === 'category_to_service';

  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <View style={[styles.iconCircle, categoryToService ? styles.iconCategory : styles.iconService]}>
        <Ionicons
          name={categoryToService ? 'construct-outline' : 'pricetag-outline'}
          size={18}
          color={COLORS.primary}
        />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>
          {categoryToService
            ? t('admin.catalogConvert.rowTitleCategory', {
                defaultValue: 'Convert to service',
              })
            : t('admin.catalogConvert.rowTitleService', {
                defaultValue: 'Convert to category',
              })}
        </Text>
        <Text style={styles.sub}>
          {categoryToService
            ? t('admin.catalogConvert.rowSubCategory', {
                defaultValue: 'Move this category into the Services catalog',
              })
            : t('admin.catalogConvert.rowSubService', {
                defaultValue: 'Move this service into the Categories catalog',
              })}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: '#FFF8E8',
    borderWidth: 1,
    borderColor: COLORS.primary + '35',
    gap: SPACING.sm,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCategory: {
    backgroundColor: COLORS.primary + '15',
  },
  iconService: {
    backgroundColor: COLORS.primary + '15',
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  sub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});

export default AdminCatalogConvertRow;
