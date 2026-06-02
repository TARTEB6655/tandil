import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Input } from '../common/Input';
import { BORDER_RADIUS, COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING } from '../../constants';
import type { ProductCustomizationConfig, ProductOptionGroup } from '../../types/productCustomization';
import { compressImageForUpload } from '../../utils/compressImage';

type Props = {
  value: ProductCustomizationConfig;
  onChange: (next: ProductCustomizationConfig) => void;
};

function newGroup(): ProductOptionGroup {
  const base = Date.now().toString(36);
  return {
    id: `group_${base}`,
    title: '',
    subtitle: '',
    required: false,
    selectionMode: 'single',
    options: [{ id: `opt_${base}`, label: '', subtitle: '', priceDelta: 0 }],
  };
}

export const ProductCustomizationBuilder: React.FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const groups = value.groups ?? [];
  const [uploadingOptionKey, setUploadingOptionKey] = useState<string | null>(null);

  const setGroups = (next: ProductOptionGroup[]) => {
    onChange({ groups: next });
  };

  const updateGroup = (groupId: string, patch: Partial<ProductOptionGroup>) => {
    setGroups(groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)));
  };

  const addGroup = () => setGroups([...groups, newGroup()]);
  const removeGroup = (groupId: string) => setGroups(groups.filter((g) => g.id !== groupId));

  const addOption = (groupId: string) => {
    setGroups(
      groups.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              options: [
                ...g.options,
                { id: `opt_${Date.now().toString(36)}`, label: '', subtitle: '', priceDelta: 0 },
              ],
            }
      )
    );
  };

  const removeOption = (groupId: string, optionId: string) => {
    setGroups(
      groups.map((g) =>
        g.id !== groupId
          ? g
          : { ...g, options: g.options.filter((o) => o.id !== optionId) }
      )
    );
  };

  const updateOption = (
    groupId: string,
    optionId: string,
    patch: { label?: string; subtitle?: string; priceDelta?: number; imageUrl?: string }
  ) => {
    setGroups(
      groups.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              options: g.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
            }
      )
    );
  };

  const pickOptionImage = async (groupId: string, optionId: string) => {
    const optionKey = `${groupId}:${optionId}`;
    setUploadingOptionKey(optionKey);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          t('common.permission', { defaultValue: 'Permission' }),
          t('admin.addProduct.imagePermissionDenied', {
            defaultValue: 'Please allow photo library access to upload an image.',
          })
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const compressedUri = await compressImageForUpload(result.assets[0].uri);
      updateOption(groupId, optionId, { imageUrl: compressedUri });
    } catch {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('admin.addProduct.imagePickError', {
          defaultValue: 'Could not pick image. Please try again.',
        })
      );
    } finally {
      setUploadingOptionKey(null);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.title}>
          {t('admin.addProduct.customizationTitle', { defaultValue: 'Product options (dummy)' })}
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={addGroup}>
          <Ionicons name="add-circle-outline" size={18} color={COLORS.background} />
          <Text style={styles.addBtnText}>
            {t('admin.addProduct.addOptionGroup', { defaultValue: 'Add group' })}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        {t('admin.addProduct.customizationHint', {
          defaultValue:
            'Use this for sheep options like packaging, cutting, packing, contains, and weight. Dummy storage now; API can be connected later.',
        })}
      </Text>

      {groups.map((group, index) => (
        <View key={group.id} style={styles.groupCard}>
          <View style={styles.groupHead}>
            <Text style={styles.groupTitle}>
              {t('admin.addProduct.groupLabel', { defaultValue: 'Group' })} {index + 1}
            </Text>
            <TouchableOpacity onPress={() => removeGroup(group.id)} style={styles.removeBtn}>
              <Ionicons name="trash-outline" size={18} color={COLORS.error} />
            </TouchableOpacity>
          </View>
          <Text style={styles.groupMetaText}>
            {group.options.length} {t('admin.addProduct.optionLabel', { defaultValue: 'Option' })}{group.options.length > 1 ? 's' : ''}
          </Text>

          <Input
            label={t('admin.addProduct.groupTitleLabel', { defaultValue: 'Group title' })}
            placeholder={t('admin.addProduct.groupTitlePlaceholder', { defaultValue: 'e.g. Packaging type' })}
            value={group.title}
            onChangeText={(txt) => updateGroup(group.id, { title: txt })}
          />
          <Input
            label={t('admin.addProduct.groupSubtitleLabel', { defaultValue: 'Group subtitle' })}
            placeholder={t('admin.addProduct.groupSubtitlePlaceholder', { defaultValue: 'e.g. Required - Select one' })}
            value={group.subtitle ?? ''}
            onChangeText={(txt) => updateGroup(group.id, { subtitle: txt })}
          />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>
              {t('admin.addProduct.groupRequiredLabel', { defaultValue: 'Required' })}
            </Text>
            <Switch value={group.required} onValueChange={(v) => updateGroup(group.id, { required: v })} />
          </View>

          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, group.selectionMode === 'single' && styles.modeBtnActive]}
              onPress={() => updateGroup(group.id, { selectionMode: 'single' })}
            >
              <Text style={[styles.modeText, group.selectionMode === 'single' && styles.modeTextActive]}>
                {t('admin.addProduct.selectOne', { defaultValue: 'Select one' })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, group.selectionMode === 'multiple' && styles.modeBtnActive]}
              onPress={() => updateGroup(group.id, { selectionMode: 'multiple' })}
            >
              <Text
                style={[styles.modeText, group.selectionMode === 'multiple' && styles.modeTextActive]}
              >
                {t('admin.addProduct.selectMany', { defaultValue: 'Select many' })}
              </Text>
            </TouchableOpacity>
          </View>

          {group.options.map((option) => (
            <View key={option.id} style={styles.optionCard}>
              <View style={styles.optionHead}>
                <Text style={styles.optionTitle}>
                  {t('admin.addProduct.optionLabel', { defaultValue: 'Option' })}
                </Text>
                <TouchableOpacity onPress={() => removeOption(group.id, option.id)}>
                  <Ionicons name="close-circle" size={18} color={COLORS.error} />
                </TouchableOpacity>
              </View>
              <Input
                label={t('admin.addProduct.optionNameLabel', { defaultValue: 'Option name' })}
                placeholder={t('admin.addProduct.optionNamePlaceholder', { defaultValue: 'e.g. Foam' })}
                value={option.label}
                onChangeText={(txt) => updateOption(group.id, option.id, { label: txt })}
              />
              <Input
                label={t('admin.addProduct.optionSubtitleLabel', { defaultValue: 'Option subtitle (optional)' })}
                placeholder={t('admin.addProduct.optionSubtitlePlaceholder', { defaultValue: 'e.g. age 3-4' })}
                value={option.subtitle ?? ''}
                onChangeText={(txt) => updateOption(group.id, option.id, { subtitle: txt })}
              />
              <Input
                label={t('admin.addProduct.optionPriceLabel', { defaultValue: 'Extra price (AED, 0 = Free)' })}
                placeholder="0"
                value={String(option.priceDelta ?? 0)}
                keyboardType="numeric"
                onChangeText={(txt) =>
                  updateOption(group.id, option.id, {
                    priceDelta: Number.isFinite(Number(txt)) ? Number(txt) : 0,
                  })
                }
              />
              <Text style={styles.optionImageLabel}>
                {t('admin.addProduct.optionImageUploadLabel', { defaultValue: 'Option image (optional)' })}
              </Text>
              {option.imageUrl ? (
                <View style={styles.optionImagePreviewWrap}>
                  <Image source={{ uri: option.imageUrl }} style={styles.optionImagePreview} contentFit="cover" />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => updateOption(group.id, option.id, { imageUrl: '' })}
                  >
                    <Ionicons name="close" size={14} color={COLORS.background} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.optionImagePlaceholder}>
                  <Ionicons name="image-outline" size={20} color={COLORS.textSecondary} />
                  <Text style={styles.optionImagePlaceholderText}>
                    {t('admin.addProduct.noImage', { defaultValue: 'No image selected' })}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={() => pickOptionImage(group.id, option.id)}
                disabled={uploadingOptionKey === `${group.id}:${option.id}`}
              >
                {uploadingOptionKey === `${group.id}:${option.id}` ? (
                  <ActivityIndicator size="small" color={COLORS.background} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={16} color={COLORS.background} />
                    <Text style={styles.uploadBtnText}>
                      {option.imageUrl
                        ? t('admin.addProduct.changeImage', { defaultValue: 'Change image' })
                        : t('admin.addProduct.uploadImage', { defaultValue: 'Upload image' })}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addOptionBtn} onPress={() => addOption(group.id)}>
            <Ionicons name="add-outline" size={16} color={COLORS.primary} />
            <Text style={styles.addOptionText}>
              {t('admin.addProduct.addOption', { defaultValue: 'Add option' })}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
  },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    flex: 1,
  },
  hint: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  addBtnText: { color: COLORS.background, fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold },
  groupCard: {
    borderWidth: 1,
    borderColor: COLORS.primary + '25',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupTitle: { color: COLORS.text, fontSize: FONT_SIZES.md, fontWeight: FONT_WEIGHTS.semiBold },
  groupMetaText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
    marginBottom: SPACING.xs,
  },
  removeBtn: { padding: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  rowLabel: { color: COLORS.text, fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.medium },
  modeRow: {
    flexDirection: 'row',
    gap: 0,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 0,
    backgroundColor: COLORS.background,
  },
  modeBtnActive: {
    backgroundColor: COLORS.primary + '1A',
    borderWidth: 1,
    borderColor: COLORS.primary + '55',
  },
  modeText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.medium },
  modeTextActive: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.semiBold },
  optionCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.background,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary + '88',
  },
  optionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optionTitle: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.medium },
  optionImageLabel: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  optionImagePreviewWrap: {
    width: 88,
    height: 88,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
    marginBottom: SPACING.sm,
  },
  optionImagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
  },
  optionImagePlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  optionImagePlaceholderText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
  },
  uploadBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    marginBottom: SPACING.xs,
  },
  uploadBtnText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
    backgroundColor: COLORS.primary + '10',
  },
  addOptionText: { color: COLORS.primary, fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold },
});

export default ProductCustomizationBuilder;
