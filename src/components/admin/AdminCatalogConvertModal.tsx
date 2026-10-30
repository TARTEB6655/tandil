import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  adminService,
  AdminCategory,
  AdminService,
} from '../../services/adminService';

export type CatalogConvertDirection = 'category_to_service' | 'service_to_category';

export type AdminCatalogConvertTarget = {
  direction: CatalogConvertDirection;
  id: number;
  name: string;
};

export interface AdminCatalogConvertModalProps {
  visible: boolean;
  target: AdminCatalogConvertTarget | null;
  onClose: () => void;
  /** Called after successful conversion; `sourceId` is the id removed from the current list. */
  onConverted?: (result: {
    direction: CatalogConvertDirection;
    sourceId: number;
    category?: AdminCategory;
    service?: AdminService;
  }) => void;
}

const AdminCatalogConvertModal: React.FC<AdminCatalogConvertModalProps> = ({
  visible,
  target,
  onClose,
  onConverted,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setError(null);
  }, [visible, target?.id, target?.direction]);

  const isCategoryToService = target?.direction === 'category_to_service';

  const handleConfirm = async () => {
    if (!target || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (isCategoryToService) {
        const res = await adminService.convertCategoryToService(target.id);
        if (res.success === false || res.status === false) {
          throw new Error(res.message || 'Conversion failed.');
        }
        onConverted?.({
          direction: target.direction,
          sourceId: target.id,
          service: res.data,
        });
        onClose();
        return;
      }
      const res = await adminService.convertServiceToCategory(target.id);
      if (res.success === false || res.status === false) {
        throw new Error(res.message || 'Conversion failed.');
      }
      onConverted?.({
        direction: target.direction,
        sourceId: target.id,
        category: res.data,
      });
      onClose();
    } catch (err: any) {
      const status = err.response?.status;
      const apiMessage = (err.response?.data?.message || err.message || '') as string;
      setError(
        apiMessage ||
          t('admin.catalogConvert.failed', {
            defaultValue: 'Conversion failed. Please try again.',
          })
      );
    } finally {
      setLoading(false);
    }
  };

  if (!target) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
          <View style={styles.iconWrap}>
            <Ionicons
              name={isCategoryToService ? 'swap-horizontal' : 'swap-horizontal'}
              size={28}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.title}>
            {isCategoryToService
              ? t('admin.catalogConvert.modalTitleCategory', {
                  defaultValue: 'Convert category to service?',
                })
              : t('admin.catalogConvert.modalTitleService', {
                  defaultValue: 'Convert service to category?',
                })}
          </Text>
          <Text style={styles.itemName} numberOfLines={2}>
            {target.name}
          </Text>
          <ScrollView style={styles.bodyScroll} bounces={false}>
            <Text style={styles.message}>
              {isCategoryToService
                ? t('admin.catalogConvert.modalBodyCategory', {
                    defaultValue:
                      'This category will become a service in the client app. Linked products and settings may be updated on the server. This cannot be undone from the app without converting again.',
                  })
                : t('admin.catalogConvert.modalBodyService', {
                    defaultValue:
                      'This service will become a shop category. Delivery and tax settings may apply after conversion. Confirm only if you intend to move this catalog entry.',
                  })}
            </Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelText}>{t('common.cancel', 'Cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.confirmBtn, loading && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.background} />
              ) : (
                <Text style={styles.confirmText}>
                  {t('admin.catalogConvert.confirm', { defaultValue: 'Convert' })}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    maxHeight: '85%',
  },
  iconWrap: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    textAlign: 'center',
  },
  itemName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  bodyScroll: {
    maxHeight: 220,
    marginBottom: SPACING.md,
  },
  message: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  apiHintBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  apiHintTitle: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  apiHintMono: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  btn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  confirmBtn: {
    backgroundColor: COLORS.primary,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  cancelText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  confirmText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
});

export default AdminCatalogConvertModal;
