import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { getWalletSummary } from '../../services/walletService';
import { getShopSettings } from '../../services/shopSettingsService';

const PRESET_AMOUNTS = [50, 100, 150, 200] as const;
const POPULAR_PRESET = 100;
const MIN_CUSTOM_AMOUNT = 1;
const MAX_CUSTOM_AMOUNT = 10000;

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'back'],
] as const;

function normalizeAmountInput(text: string): string {
  const westernized = String(text ?? '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');

  const firstDot = westernized.indexOf('.');
  if (firstDot === -1) return westernized;

  const whole = westernized.slice(0, firstDot);
  const frac = westernized
    .slice(firstDot + 1)
    .replace(/\./g, '')
    .slice(0, 2);
  return frac.length > 0 || westernized.endsWith('.') ? `${whole}.${frac}` : whole;
}

function appendAmountDigit(current: string, key: string): string {
  if (key === 'back') return current.slice(0, -1);
  if (key === '.') {
    if (current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }
  if (current === '0') return key;
  const next = `${current}${key}`;
  const [whole, frac] = next.split('.');
  if (frac != null && frac.length > 2) return current;
  if (whole.length > 6) return current;
  return next;
}

function parseAmount(value: string): number {
  if (!value || value === '.') return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

const AddMoneyScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const customInputRef = useRef<TextInput>(null);
  const [currency, setCurrency] = useState('AED');
  const [balance, setBalance] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(100);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [walletRes, settings] = await Promise.all([getWalletSummary(), getShopSettings()]);
        if (cancelled) return;
        setCurrency(settings?.currency ?? 'AED');
        if (walletRes.data) setBalance(Number(walletRes.data.balance) || 0);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const parsedCustom = useMemo(() => parseAmount(customAmount), [customAmount]);

  const selectedAmount = useMemo(() => {
    if (isCustomMode) {
      if (!Number.isFinite(parsedCustom) || parsedCustom <= 0) return null;
      return Math.round(parsedCustom * 100) / 100;
    }
    return selectedPreset;
  }, [isCustomMode, parsedCustom, selectedPreset]);

  const amountError = useMemo(() => {
    if (!isCustomMode) return null;
    if (customAmount.trim() === '' || customAmount === '.' || customAmount.endsWith('.')) return null;
    if (!Number.isFinite(parsedCustom) || parsedCustom < MIN_CUSTOM_AMOUNT) {
      return t('wallet.addMoney.minAmount', {
        amount: `${currency} ${MIN_CUSTOM_AMOUNT}`,
        defaultValue: `Minimum amount is ${currency} ${MIN_CUSTOM_AMOUNT}`,
      });
    }
    if (parsedCustom > MAX_CUSTOM_AMOUNT) {
      return t('wallet.addMoney.maxAmount', {
        amount: `${currency} ${MAX_CUSTOM_AMOUNT}`,
        defaultValue: `Maximum amount is ${currency} ${MAX_CUSTOM_AMOUNT}`,
      });
    }
    return null;
  }, [isCustomMode, customAmount, parsedCustom, currency, t]);

  const canSubmit =
    selectedAmount != null &&
    selectedAmount >= MIN_CUSTOM_AMOUNT &&
    selectedAmount <= MAX_CUSTOM_AMOUNT &&
    !amountError;

  const handleSelectPreset = (amount: number) => {
    setIsCustomMode(false);
    setSelectedPreset(amount);
    setCustomAmount('');
    customInputRef.current?.blur();
  };

  const enableCustomMode = () => {
    setIsCustomMode(true);
    setSelectedPreset(null);
    requestAnimationFrame(() => customInputRef.current?.focus());
  };

  const handleCustomFocus = () => {
    setIsCustomMode(true);
    setSelectedPreset(null);
  };

  const handleCustomChange = (text: string) => {
    setIsCustomMode(true);
    setSelectedPreset(null);
    setCustomAmount(normalizeAmountInput(text));
  };

  const handleKeyPress = (key: string) => {
    setIsCustomMode(true);
    setSelectedPreset(null);
    setCustomAmount((prev) => appendAmountDigit(prev, key));
    customInputRef.current?.focus();
  };

  const handleContinue = () => {
    if (!canSubmit || selectedAmount == null) return;
    navigation.navigate('WalletTopUpPayment', {
      amount: selectedAmount,
      currency,
    });
  };

  const previewAdd = selectedAmount ?? 0;
  const previewNew = balance + previewAdd;

  return (
    <View style={styles.container}>
      <Header title={t('wallet.addMoney.title', 'Add Money')} showBack />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        {/* Hero balance */}
        <View style={styles.heroCard}>
          <View style={styles.heroDecorTop} />
          <View style={styles.heroDecorBottom} />
          <View style={styles.heroIconWrap}>
            <Ionicons name="wallet" size={28} color={COLORS.background} />
          </View>
          <Text style={styles.heroEyebrow}>
            {t('wallet.availableBalance', 'Available balance')}
          </Text>
          <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>
            {currency} {balance.toFixed(2)}
          </Text>
          <View style={styles.heroChipRow}>
            <View style={styles.heroChip}>
              <Ionicons name="flash-outline" size={14} color={COLORS.background} />
              <Text style={styles.heroChipText}>
                {t('wallet.addMoney.instantCredit', 'Instant credit')}
              </Text>
            </View>
            <View style={styles.heroChip}>
              <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.background} />
              <Text style={styles.heroChipText}>
                {t('wallet.addMoney.securePay', 'Secure pay')}
              </Text>
            </View>
          </View>
        </View>

        {/* Presets */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {t('wallet.addMoney.selectAmount', 'Select amount')}
          </Text>
          <Text style={styles.sectionHint}>
            {t(
              'wallet.addMoney.selectAmountHint',
              'Choose a preset or enter a custom amount to top up your wallet.'
            )}
          </Text>

          <View style={styles.presetGrid}>
            {PRESET_AMOUNTS.map((amount) => {
              const selected = !isCustomMode && selectedPreset === amount;
              const popular = amount === POPULAR_PRESET;
              return (
                <TouchableOpacity
                  key={amount}
                  style={[styles.presetChip, selected && styles.presetChipSelected]}
                  onPress={() => handleSelectPreset(amount)}
                  activeOpacity={0.85}
                >
                  {popular ? (
                    <View style={[styles.popularBadge, selected && styles.popularBadgeSelected]}>
                      <Text style={[styles.popularBadgeText, selected && styles.popularBadgeTextSelected]}>
                        {t('wallet.addMoney.popular', 'Popular')}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={[styles.presetCurrency, selected && styles.presetTextSelected]}>
                    {currency}
                  </Text>
                  <Text style={[styles.presetAmount, selected && styles.presetTextSelected]}>
                    {amount}
                  </Text>
                  {selected ? (
                    <View style={styles.presetCheck}>
                      <Ionicons name="checkmark" size={12} color={COLORS.background} />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orLabel}>
              {t('wallet.addMoney.orEnterCustom', 'Or enter custom amount')}
            </Text>
            <View style={styles.orLine} />
          </View>

          <View style={[styles.customInputWrap, isCustomMode && styles.customInputWrapActive]}>
            <View style={styles.currencyPill}>
              <Text style={styles.currencyPillText}>{currency}</Text>
            </View>
            <TextInput
              ref={customInputRef}
              style={styles.customInput}
              value={customAmount}
              onChangeText={handleCustomChange}
              onFocus={handleCustomFocus}
              placeholder={t('wallet.addMoney.customPlaceholder', 'Enter amount')}
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="decimal-pad"
              returnKeyType="done"
              editable
              autoCorrect={false}
              autoCapitalize="none"
              underlineColorAndroid="transparent"
              textAlign="left"
            />
            {customAmount.length > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  setCustomAmount('');
                  enableCustomMode();
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="create-outline" size={20} color={COLORS.primary} />
            )}
          </View>
          {amountError ? <Text style={styles.errorText}>{amountError}</Text> : null}

          {isCustomMode ? (
            <View style={styles.keypad}>
              {KEYPAD_ROWS.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.keypadRow}>
                  {row.map((key) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.keypadKey, key === 'back' && styles.keypadKeyMuted]}
                      onPress={() => handleKeyPress(key)}
                      activeOpacity={0.7}
                    >
                      {key === 'back' ? (
                        <Ionicons name="backspace-outline" size={22} color={COLORS.text} />
                      ) : (
                        <Text style={styles.keypadKeyText}>{key}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Live summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="receipt-outline" size={18} color={COLORS.primary} />
            <Text style={styles.summaryHeaderText}>
              {t('wallet.addMoney.summaryTitle', 'Top-up summary')}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {t('wallet.addMoney.youWillAdd', 'You will add')}
            </Text>
            <Text style={styles.summaryValue}>
              + {currency} {previewAdd.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {t('wallet.addMoney.newBalance', 'New balance')}
            </Text>
            <Text style={styles.summaryValuePrimary}>
              {currency} {previewNew.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.noteCard}>
          <Ionicons name="information-circle" size={20} color={COLORS.primary} />
          <Text style={styles.noteText}>
            {t(
              'wallet.addMoney.secureNote',
              'Funds stay in your wallet and can be used at checkout for services and shop orders.'
            )}
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          Platform.OS === 'android' && {
            paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.sm,
          },
        ]}
      >
        <Button
          title={
            canSubmit && selectedAmount != null
              ? t('wallet.addMoney.continueWithAmount', {
                  amount: `${currency} ${selectedAmount.toFixed(2)}`,
                  defaultValue: `Continue · ${currency} ${selectedAmount.toFixed(2)}`,
                })
              : t('wallet.addMoney.continue', 'Add Money')
          }
          onPress={handleContinue}
          disabled={!canSubmit}
          size="large"
          icon={
            canSubmit ? (
              <Ionicons
                name="arrow-forward"
                size={18}
                color={COLORS.background}
                style={{ marginRight: 8 }}
              />
            ) : undefined
          }
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primaryDark,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  heroDecorTop: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.primaryLight + '55',
    top: -60,
    right: -40,
  },
  heroDecorBottom: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primaryDark + '40',
    bottom: -50,
    left: -30,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroEyebrow: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  heroAmount: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    letterSpacing: -0.5,
    marginBottom: SPACING.md,
  },
  heroChipRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
  },
  heroChipText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.medium,
  },
  sectionCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  presetChip: {
    width: '47%',
    flexGrow: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  presetChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '14',
  },
  popularBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularBadgeSelected: {
    backgroundColor: COLORS.primary,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  popularBadgeTextSelected: {
    color: COLORS.background,
  },
  presetCurrency: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  presetAmount: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  presetTextSelected: {
    color: COLORS.primary,
  },
  presetCheck: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  orLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  customInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    minHeight: 58,
    marginBottom: SPACING.sm,
  },
  customInputWrapActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '0A',
  },
  currencyPill: {
    backgroundColor: COLORS.primary + '18',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.sm,
  },
  currencyPillText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  customInput: {
    flex: 1,
    minHeight: 52,
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    paddingHorizontal: 0,
    margin: 0,
  },
  keypad: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  keypadKey: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Platform.OS === 'ios' ? 15 : 13,
    margin: 4,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  keypadKeyMuted: {
    backgroundColor: COLORS.surface,
  },
  keypadKeyText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    marginBottom: SPACING.sm,
  },
  summaryCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  summaryHeaderText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  summaryValuePrimary: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary + '10',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  noteText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
});

export default AddMoneyScreen;
