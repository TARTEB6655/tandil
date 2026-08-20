import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { useTranslation } from 'react-i18next';
import { getWalletSummary, WalletCredit, WalletSummaryData } from '../../services/walletService';
import { getShopSettings } from '../../services/shopSettingsService';

function formatIsoDate(iso: string | undefined | null): string {
  if (!iso || typeof iso !== 'string') return '—';
  const d = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  try {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return iso;
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

function creditReasonLabel(t: (key: string, options?: { defaultValue?: string }) => string, reason: string): string {
  const key = `wallet.reason.${reason}`;
  const human = reason.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return t(key, { defaultValue: human });
}

const WalletScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [summary, setSummary] = useState<WalletSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState('AED');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [walletRes, settings] = await Promise.all([getWalletSummary(), getShopSettings()]);
    setCurrency(settings?.currency ?? 'AED');
    if (walletRes.data) {
      setSummary(walletRes.data);
    } else {
      setSummary(null);
      setError(walletRes.message || t('wallet.loadFailed', 'Could not load wallet. Pull to try again.'));
    }
    setLoading(false);
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const balance = summary != null ? Number(summary.balance) : 0;
  const credits: WalletCredit[] = [...(summary?.credits ?? [])].sort((a, b) => {
    const ta = new Date(a.credited_at).getTime();
    const tb = new Date(b.credited_at).getTime();
    return tb - ta;
  });
  const forfeited = summary != null ? Number(summary.forfeited_total) : 0;

  const renderCredit = (c: WalletCredit) => (
    <View key={c.id} style={styles.creditCard}>
      <View style={styles.creditHeader}>
        <Text style={styles.creditAmount}>
          +{currency} {Number(c.amount).toFixed(2)}
        </Text>
        <View style={[styles.statusPill, c.status === 'active' && styles.statusPillActive]}>
          <Text style={[styles.statusPillText, c.status === 'active' && styles.statusPillTextActive]}>{c.status}</Text>
        </View>
      </View>
      <Text style={styles.creditReason}>{creditReasonLabel(t, c.reason)}</Text>
      <View style={styles.creditMeta}>
        <Text style={styles.creditMetaLabel}>{t('wallet.creditedOn', 'Credited')}</Text>
        <Text style={styles.creditMetaValue}>{formatIsoDate(c.credited_at)}</Text>
      </View>
      <View style={styles.creditMeta}>
        <Text style={styles.creditMetaLabel}>{t('wallet.expiresOn', 'Expires')}</Text>
        <Text style={styles.creditMetaValue}>{formatIsoDate(c.expires_at)}</Text>
      </View>
      {c.order_id != null ? (
        <Text style={styles.creditOrderId}>
          {t('wallet.orderId', 'Order')} #{c.order_id}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title={t('wallet.title', 'Wallet')} showBack />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : null}

        {!loading && error && !summary ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={24} color={COLORS.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryBtnText}>{t('wallet.retry', 'Retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && summary ? (
          <>
            <View style={styles.topCard}>
              <View style={styles.balanceHero}>
                <View style={styles.balanceHeroIconRing}>
                  <Ionicons name="wallet" size={30} color={COLORS.primary} />
                </View>
                <Text style={styles.balanceHeroLabel}>{t('wallet.availableBalance', 'Available balance')}</Text>
                <Text style={styles.balanceHeroAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                  {currency} {balance.toFixed(2)}
                </Text>
                {forfeited > 0 ? (
                  <Text style={styles.forfeitedNoteHero}>
                    {t('wallet.forfeitedTotal', 'Forfeited (no longer usable): {{amount}}', {
                      amount: `${currency} ${forfeited.toFixed(2)}`,
                    })}
                  </Text>
                ) : null}
                <Button
                  title={t('wallet.addMoney.cta', 'Add Money')}
                  onPress={() => navigation.navigate('AddMoney')}
                  style={styles.addMoneyBtn}
                  icon={<Ionicons name="add-circle-outline" size={18} color={COLORS.background} style={{ marginRight: 6 }} />}
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>{t('wallet.refundAndCredits', 'Refunds & credits')}</Text>
            {credits.length === 0 ? (
              <Text style={styles.emptyCredits}>{t('wallet.noCredits', 'No wallet credits yet.')}</Text>
            ) : (
              credits.map(renderCredit)
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  centered: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  errorBox: {
    alignItems: 'center',
    padding: SPACING.lg,
    marginTop: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  retryBtnText: {
    color: COLORS.background,
    fontWeight: FONT_WEIGHTS.semiBold,
    fontSize: FONT_SIZES.sm,
  },
  topCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  balanceHero: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surfaceLight,
  },
  balanceHeroIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.primary + '33',
    marginBottom: SPACING.md,
  },
  balanceHeroLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  balanceHeroAmount: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  forfeitedNoteHero: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: SPACING.sm,
  },
  addMoneyBtn: {
    marginTop: SPACING.lg,
    alignSelf: 'stretch',
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  emptyCredits: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  creditCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  creditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  creditAmount: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.success,
  },
  statusPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.border,
  },
  statusPillActive: {
    backgroundColor: COLORS.success + '22',
  },
  statusPillText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  statusPillTextActive: {
    color: COLORS.success,
    fontWeight: FONT_WEIGHTS.medium,
  },
  creditReason: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  creditMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  creditMetaLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  creditMetaValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  creditOrderId: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
});

export default WalletScreen;
