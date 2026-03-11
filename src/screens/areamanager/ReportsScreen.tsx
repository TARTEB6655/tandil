import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SPACING, FONT_SIZES, FONT_WEIGHTS, BORDER_RADIUS } from '../../constants';
import {
  generateAreaManagerReport,
  getAreaManagerGeneratedReports,
  AreaManagerReportType,
  AreaManagerGeneratedReport,
} from '../../services/areaManagerService';

const REPORT_TYPE_KEYS: Record<AreaManagerReportType, 'typeWeeklySummary' | 'typeTeamPerformance' | 'typeCustomerSatisfaction'> = {
  weekly_summary: 'typeWeeklySummary',
  team_performance: 'typeTeamPerformance',
  customer_satisfaction: 'typeCustomerSatisfaction',
};

function formatDateForApi(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDisplay(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

const ReportsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<AreaManagerReportType[]>([]);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d;
  });
  const [datePickerMode, setDatePickerMode] = useState<'from' | 'to' | null>(null);
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState<AreaManagerGeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReports = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    try {
      const list = await getAreaManagerGeneratedReports();
      setReports(Array.isArray(list) ? list : []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchReports(false);
    }, [fetchReports])
  );

  const toggleReportType = (id: AreaManagerReportType) => {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (selectedTypes.length === 0) {
      Alert.alert(t('common.error'), t('admin.areaManagerRegionReports.errorSelectType'));
      return;
    }
    if (fromDate > toDate) {
      Alert.alert(t('common.error'), t('admin.areaManagerRegionReports.errorFromBeforeTo'));
      return;
    }
    setGenerating(true);
    const dateFrom = formatDateForApi(fromDate);
    const dateTo = formatDateForApi(toDate);
    let successCount = 0;
    let lastError: string | undefined;
    for (const type of selectedTypes) {
      try {
        const result = await generateAreaManagerReport({ type, date_from: dateFrom, date_to: dateTo });
        if (result.success) successCount++;
        else lastError = result.message;
      } catch {
        lastError = t('admin.areaManagerRegionReports.errorGenerateFailed');
      }
    }
    setGenerating(false);
    if (successCount > 0) {
      fetchReports(false);
      Alert.alert(
        t('admin.areaManagerRegionReports.successTitle'),
        successCount === selectedTypes.length
          ? t('admin.areaManagerRegionReports.successGenerated')
          : t('admin.areaManagerRegionReports.successGeneratedPartial', { count: successCount, total: selectedTypes.length }),
        [{ text: t('common.ok'), onPress: () => setCreateModalVisible(false) }]
      );
    } else {
      Alert.alert(t('common.error'), lastError ?? t('admin.areaManagerRegionReports.errorGenerateFailed'));
    }
  };

  const openDownload = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert(t('common.error'), t('admin.areaManagerRegionReports.errorOpenDownload')));
  };

  const openView = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert(t('common.error'), t('admin.areaManagerRegionReports.errorOpenView')));
  };

  const renderReport = ({ item }: { item: AreaManagerGeneratedReport }) => (
    <View style={styles.reportCard}>
      <View style={styles.reportCardLeft}>
        <View style={styles.reportCardIcon}>
          <Ionicons name="document-text" size={22} color={COLORS.primary} />
        </View>
        <View style={styles.reportCardBody}>
          <Text style={styles.reportCardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.reportCardMeta}>{item.report_type}</Text>
          <Text style={styles.reportCardPeriod}>{item.period} · {item.file_size}</Text>
        </View>
      </View>
      <View style={styles.reportCardActions}>
        <TouchableOpacity
          style={styles.reportActionBtn}
          onPress={() => openDownload(item.download_url)}
          activeOpacity={0.7}
        >
          <Ionicons name="download-outline" size={20} color={COLORS.primary} />
          <Text style={styles.reportActionLabel}>{t('admin.areaManagerRegionReports.download')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.reportActionBtn, styles.reportActionBtnSecondary]}
          onPress={() => openView(item.view_url)}
          activeOpacity={0.7}
        >
          <Ionicons name="open-outline" size={20} color={COLORS.textSecondary} />
          <Text style={styles.reportActionLabelSecondary}>{t('admin.areaManagerRegionReports.view')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.areaManagerRegionReports.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.hero}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="document-text" size={28} color={COLORS.background} />
        </View>
        <Text style={styles.heroTitle}>{t('admin.areaManagerRegionReports.heroTitle')}</Text>
        <Text style={styles.heroSubtitle}>{t('admin.areaManagerRegionReports.heroSubtitle')}</Text>
        <TouchableOpacity
          style={styles.generateCta}
          onPress={() => {
            setSelectedTypes([]);
            setCreateModalVisible(true);
          }}
          activeOpacity={0.9}
        >
          <Ionicons name="add-circle-outline" size={22} color={COLORS.background} />
          <Text style={styles.generateCtaText}>{t('admin.areaManagerRegionReports.generatePdf')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('admin.areaManagerRegionReports.recentReports')}</Text>
        {reports.length > 0 && (
          <Text style={styles.sectionCount}>
            {reports.length === 1
              ? t('admin.areaManagerRegionReports.reportsCount', { count: 1 })
              : t('admin.areaManagerRegionReports.reportsCountPlural', { count: reports.length })}
          </Text>
        )}
      </View>
      {loading && reports.length === 0 ? (
        <View style={styles.listLoading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.listLoadingText}>{t('admin.areaManagerRegionReports.loadingReports')}</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          renderItem={renderReport}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.reportListContent,
            reports.length === 0 && styles.reportListContentEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchReports(true)}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyReports}>
              <View style={styles.emptyReportsIconWrap}>
                <Ionicons name="document-text-outline" size={40} color={COLORS.textSecondary} />
              </View>
              <Text style={styles.emptyReportsText}>No reports yet</Text>
              <Text style={styles.emptyReportsSubtext}>Tap “Generate PDF” above to create your first report.</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('admin.areaManagerRegionReports.createNewReport')}</Text>
            <Text style={styles.modalSubtitle}>
              {t('admin.areaManagerRegionReports.createModalSubtitle')}
            </Text>

            <Text style={styles.fieldLabel}>{t('admin.areaManagerRegionReports.reportType')}</Text>
            <View style={styles.checkboxGroup}>
              {(['weekly_summary', 'team_performance', 'customer_satisfaction'] as AreaManagerReportType[]).map((id) => (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.checkboxOption,
                    selectedTypes.includes(id) && styles.checkboxOptionSelected,
                  ]}
                  onPress={() => toggleReportType(id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, selectedTypes.includes(id) && styles.checkboxChecked]}>
                    {selectedTypes.includes(id) ? (
                      <Ionicons name="checkmark" size={16} color={COLORS.background} />
                    ) : null}
                  </View>
                  <Text style={styles.checkboxLabel}>{t(`admin.areaManagerRegionReports.${REPORT_TYPE_KEYS[id]}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t('admin.areaManagerRegionReports.fromDate')}</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setDatePickerMode('from')}
            >
              <Text style={styles.dateInputText}>{formatDateDisplay(fromDate)}</Text>
              <Ionicons name="calendar-outline" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>{t('admin.areaManagerRegionReports.toDate')}</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setDatePickerMode('to')}
            >
              <Text style={styles.dateInputText}>{formatDateDisplay(toDate)}</Text>
              <Ionicons name="calendar-outline" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>

            {datePickerMode !== null && (
              <>
                <DateTimePicker
                  value={datePickerMode === 'from' ? fromDate : toDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, date) => {
                    if (date) {
                      if (datePickerMode === 'from') setFromDate(date);
                      else setToDate(date);
                    }
                    if (Platform.OS === 'android') setDatePickerMode(null);
                  }}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={styles.datePickerDone}
                    onPress={() => setDatePickerMode(null)}
                  >
                    <Text style={styles.datePickerDoneText}>{t('admin.areaManagerRegionReports.done')}</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.generateBtn, generating && styles.generateBtnDisabled]}
                onPress={handleGenerate}
                disabled={generating}
                activeOpacity={0.85}
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={22} color="#fff" />
                    <Text style={styles.generateBtnText}>{t('admin.areaManagerRegionReports.generateReport')}</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.visitBtn}
                onPress={() => setCreateModalVisible(false)}
                disabled={generating}
                activeOpacity={0.7}
              >
                <Text style={styles.visitBtnText}>{t('admin.areaManagerRegionReports.visitReports')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backBtn: { padding: SPACING.xs },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  headerSpacer: { width: 40 },
  hero: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    marginBottom: SPACING.xs,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: SPACING.lg,
  },
  generateCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 12,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    minHeight: 48,
  },
  generateCtaText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  sectionCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  listLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  listLoadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  reportListContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  reportListContentEmpty: { flexGrow: 1 },
  emptyReports: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 1.5,
  },
  emptyReportsIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyReportsText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  emptyReportsSubtext: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  reportCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  reportCardLeft: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.sm },
  reportCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  reportCardBody: { flex: 1 },
  reportCardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: 2,
  },
  reportCardMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
    marginBottom: 2,
  },
  reportCardPeriod: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  reportCardActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  reportActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary + '12',
  },
  reportActionBtnSecondary: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reportActionLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  reportActionLabelSecondary: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  checkboxGroup: { marginBottom: SPACING.md },
  checkboxOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xs,
  },
  checkboxOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxLabel: { fontSize: FONT_SIZES.md, color: COLORS.text },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateInputText: { fontSize: FONT_SIZES.md, color: COLORS.text },
  datePickerDone: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  datePickerDoneText: { fontSize: FONT_SIZES.md, color: COLORS.primary, fontWeight: FONT_WEIGHTS.semiBold },
  modalButtons: {
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    minHeight: 50,
  },
  generateBtnDisabled: { opacity: 0.7 },
  generateBtnText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: '#fff',
  },
  visitBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    minHeight: 50,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  visitBtnText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
});

export default ReportsScreen;
