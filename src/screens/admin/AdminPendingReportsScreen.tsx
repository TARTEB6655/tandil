import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Share,
  Linking,
  Switch,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import {
  adminService,
  AdminReport,
  ReportsMeta,
  AdminReportsStatistics,
} from '../../services/adminService';
import { API_BASE_URL } from '../../config/api';

function formatDateToYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const PER_PAGE = 5;

const REPORT_TYPE_KEYS = ['financial', 'performance', 'customer', 'operational', 'user'] as const;

const REPORT_TYPE_FALLBACKS: Record<(typeof REPORT_TYPE_KEYS)[number], { label: string; description: string }> = {
  financial: {
    label: 'Financial',
    description: 'Revenue, billing and payment summaries',
  },
  performance: {
    label: 'Performance',
    description: 'Team performance and KPI overview',
  },
  customer: {
    label: 'Customer',
    description: 'Customer activity, subscriptions and retention',
  },
  operational: {
    label: 'Operational',
    description: 'Visits, assignments and operational efficiency',
  },
  user: {
    label: 'User',
    description: 'User growth and engagement metrics',
  },
};

const RECURRENCE_OPTIONS: Array<{ value: '' | 'daily' | 'weekly' | 'monthly' | 'yearly'; label: string }> = [
  { value: '', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const AdminPendingReportsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const showBackButton = (route as { name?: string }).name !== 'ReportsTab';
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [statistics, setStatistics] = useState<AdminReportsStatistics | null>(null);
  const [meta, setMeta] = useState<ReportsMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AdminReport | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [reportType, setReportType] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleParamStartDate, setScheduleParamStartDate] = useState('');
  const [scheduleParamEndDate, setScheduleParamEndDate] = useState('');
  const [scheduleFormat, setScheduleFormat] = useState<'pdf' | 'csv' | 'excel'>('pdf');
  const [scheduleIncludeCharts, setScheduleIncludeCharts] = useState(true);
  const [scheduleRecurrence, setScheduleRecurrence] = useState<string>(''); // '' = one-time, or 'daily'|'weekly'|'monthly'|'yearly'
  const [scheduleDatePickerOpen, setScheduleDatePickerOpen] = useState<'date' | 'time' | 'paramStart' | 'paramEnd' | null>(null);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  // Generate report form
  const [generateTitle, setGenerateTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [format, setFormat] = useState<'pdf' | 'csv' | 'excel'>('pdf');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeDetails, setIncludeDetails] = useState(true);
  const [generateSubmitting, setGenerateSubmitting] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState<'start' | 'end' | null>(null);

  const reportTypes = useMemo(
    () =>
      REPORT_TYPE_KEYS.map((value) => ({
        value,
        label: t(
          `admin.reportsManagement.reportTypes.${value}.label`,
          REPORT_TYPE_FALLBACKS[value].label
        ),
        description: t(
          `admin.reportsManagement.reportTypes.${value}.description`,
          REPORT_TYPE_FALLBACKS[value].description
        ),
      })),
    [t]
  );

  const fetchReports = useCallback(async (pageNum: number = 1, isRefresh: boolean = false) => {
    if (isRefresh) setRefreshing(true);
    else if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const response = await adminService.getReports({ page: pageNum, per_page: PER_PAGE });
      const data = Array.isArray(response) ? response : (response as any).data ?? [];
      const list = Array.isArray(data) ? data : [];
      const responseMeta = (response as any).meta ?? null;
      setReports(list);
      setMeta(responseMeta);
      setPage(pageNum);
    } catch (error: any) {
      console.error('Error fetching reports:', error);
      if (pageNum === 1) setReports([]);
      Alert.alert(t('admin.users.error'), error.response?.data?.message || error.message || t('admin.reportsManagement.errorLoadReports'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [t]);

  const fetchStatistics = useCallback(async () => {
    try {
      const response = await adminService.getReportStatistics();
      if (response?.success && response?.data) {
        setStatistics(response.data);
      } else {
        setStatistics(null);
      }
    } catch {
      setStatistics(null);
    }
  }, []);

  useEffect(() => {
    fetchReports(1);
    fetchStatistics();
  }, [fetchReports, fetchStatistics]);

  useFocusEffect(
    useCallback(() => {
      fetchReports(1);
      fetchStatistics();
    }, [fetchReports, fetchStatistics])
  );

  const onRefresh = () => {
    fetchReports(1, true);
  };

  const goToNextPage = useCallback(() => {
    if (!meta || page >= meta.last_page || loadingMore) return;
    fetchReports(page + 1);
  }, [meta, page, loadingMore, fetchReports]);

  const goToPreviousPage = useCallback(() => {
    if (page <= 1 || loadingMore) return;
    fetchReports(page - 1);
  }, [page, loadingMore, fetchReports]);

  const handleMenuPress = (report: AdminReport) => {
    setSelectedReport(report);
    setShowActionMenu(true);
  };

  const handleDeleteReport = () => {
    if (!selectedReport?.id) return;
    setShowActionMenu(false);
    Alert.alert(
      t('admin.reportsManagement.deleteReportTitle'),
      t('admin.reportsManagement.deleteReportMessage'),
      [
        { text: t('admin.reportsManagement.cancel'), style: 'cancel' },
        {
          text: t('admin.reportsManagement.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await adminService.deleteReport(selectedReport.id!);
              Alert.alert(t('admin.users.success'), t('admin.reportsManagement.successDeleted'));
              fetchReports(1);
            } catch (error: any) {
              Alert.alert(t('admin.users.error'), error.response?.data?.message || error.message || t('admin.reportsManagement.errorDeleteReport'));
            }
          },
        },
      ]
    );
  };

  const resetGenerateForm = useCallback(() => {
    setReportType('');
    setGenerateTitle('');
    setStartDate('');
    setEndDate('');
    setFormat('pdf');
    setIncludeCharts(true);
    setIncludeDetails(true);
    setDatePickerOpen(null);
  }, []);

  const handleGenerateReport = async () => {
    if (!reportType) {
      Alert.alert(t('admin.users.error'), t('admin.reportsManagement.errorSelectType'));
      return;
    }
    const title = generateTitle.trim() || (reportTypes.find((r) => r.value === reportType)?.label ?? 'Report');
    if (!startDate || !endDate) {
      Alert.alert(t('admin.users.error'), t('admin.reportsManagement.errorStartEndDate'));
      return;
    }

    setGenerateSubmitting(true);
    try {
      const response = await adminService.generateReport({
        type: reportType,
        title,
        parameters: {
          start_date: startDate.trim(),
          end_date: endDate.trim(),
          format,
          include_charts: includeCharts,
          include_details: includeDetails,
        },
      });
      Alert.alert(t('admin.users.success'), response.message ?? t('admin.reportsManagement.successGenerated'));
      setShowGenerateModal(false);
      resetGenerateForm();
      fetchReports(1);
    } catch (error: any) {
      console.error('Error generating report:', error);
      Alert.alert(t('admin.users.error'), error.response?.data?.message || error.message || t('admin.reportsManagement.errorGenerateReport'));
    } finally {
      setGenerateSubmitting(false);
    }
  };

  const handleShareReport = async (report: AdminReport) => {
    if (!report.file_url) {
      Alert.alert(t('admin.users.error'), t('admin.reportsManagement.errorReportFileNotAvailable'));
      return;
    }

    try {
      await Share.share({
        message: `Check out this ${report.title ?? 'Report'}: ${report.file_url}`,
        url: report.file_url,
        title: report.title ?? 'Report',
      });
      setShowActionMenu(false);
    } catch (error: any) {
      console.error('Error sharing report:', error);
      Alert.alert(t('admin.users.error'), t('admin.reportsManagement.errorShareReport'));
    }
  };

  const formatTimeToHHMMSS = (timeStr: string): string => {
    if (!timeStr) return '09:00:00';
    const parts = timeStr.split(':');
    if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
    return '09:00:00';
  };

  const resetScheduleForm = useCallback(() => {
    setReportType('');
    setScheduleTitle('');
    setScheduleDate('');
    setScheduleTime('');
    setScheduleParamStartDate('');
    setScheduleParamEndDate('');
    setScheduleFormat('pdf');
    setScheduleIncludeCharts(true);
    setScheduleRecurrence('');
    setScheduleDatePickerOpen(null);
  }, []);

  const handleScheduleReport = async () => {
    if (!reportType || !scheduleDate || !scheduleTime) {
      Alert.alert(t('admin.users.error'), t('admin.reportsManagement.errorScheduleDateTime'));
      return;
    }
    if (!scheduleParamStartDate || !scheduleParamEndDate) {
      Alert.alert(t('admin.users.error'), t('admin.reportsManagement.errorParamDates'));
      return;
    }
    const title = scheduleTitle.trim() || (reportTypes.find((r) => r.value === reportType)?.label ?? 'Scheduled Report');
    const scheduled_at = `${scheduleDate} ${formatTimeToHHMMSS(scheduleTime)}`;

    setScheduleSubmitting(true);
    try {
      const response = await adminService.scheduleReport({
        type: reportType,
        title,
        scheduled_at,
        recurrence: scheduleRecurrence === '' ? null : (scheduleRecurrence as 'daily' | 'weekly' | 'monthly' | 'yearly'),
        parameters: {
          start_date: scheduleParamStartDate.trim(),
          end_date: scheduleParamEndDate.trim(),
          format: scheduleFormat,
          include_charts: scheduleIncludeCharts,
        },
      });
      Alert.alert(t('admin.users.success'), response.message ?? t('admin.reportsManagement.successScheduled'));
      setShowScheduleModal(false);
      resetScheduleForm();
      fetchReports(1);
    } catch (error: any) {
      console.error('Error scheduling report:', error);
      Alert.alert(t('admin.users.error'), error.response?.data?.message || error.message || t('admin.reportsManagement.errorScheduleReport'));
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const handleDownloadReport = async (report: AdminReport) => {
    if (report.id == null) {
      Alert.alert(t('admin.users.error'), t('admin.reportsManagement.errorReportFileNotAvailable'));
      return;
    }

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert(t('admin.users.error'), t('auth.loginRequired', { defaultValue: 'Please login again.' }));
        return;
      }

      const downloadUrl = `${API_BASE_URL}/admin/reports/${report.id}/download`;
      const fileUri = `${FileSystem.cacheDirectory}admin-report-${report.id}.pdf`;
      const result = await FileSystem.downloadAsync(downloadUrl, fileUri, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (result.status !== 200) {
        Alert.alert(t('admin.users.error'), t('admin.reportsManagement.errorDownloadReport'));
        return;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: t('admin.reportsManagement.downloadReport'),
        });
      } else {
        await Linking.openURL(result.uri);
      }
      setShowActionMenu(false);
    } catch (error: any) {
      console.error('Error downloading report:', error);
      Alert.alert(t('admin.users.error'), t('admin.reportsManagement.errorDownloadReport'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return COLORS.warning;
      case 'generated':
        return COLORS.success;
      case 'scheduled':
        return COLORS.info;
      default:
        return COLORS.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return t('admin.reportsManagement.statusPending');
      case 'generated':
        return t('admin.reportsManagement.statusGenerated');
      case 'scheduled':
        return t('admin.reportsManagement.statusScheduled');
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const renderReport = ({ item, index }: { item: AdminReport; index: number }) => {
    const normalizedType = (item.type || '').toLowerCase();
    const typeLabel =
      reportTypes.find(t => t.value === item.type)?.label ||
      (normalizedType === 'hr_technician_monthly'
        ? t('admin.reportsManagement.reportTypes.hr_technician_monthly.label', {
            defaultValue: 'HR Technician Monthly',
          })
        : (item.type || 'Report').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    const title = item.title ?? item.type ?? 'Report';
    const status = item.status ?? 'pending';

    return (
      <TouchableOpacity style={styles.reportCard}>
        <View style={styles.reportHeader}>
          <View style={styles.reportInfo}>
            <Text style={styles.reportTitle}>{title}</Text>
            <Text style={styles.reportType}>{typeLabel}</Text>
          </View>
          <View style={styles.reportHeaderRight}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
                {getStatusLabel(status)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.moreButtonHeader}
              onPress={() => handleMenuPress(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.reportMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.metaText}>{t('admin.reportsManagement.created')}: {formatDate(item.created_at ?? '')}</Text>
          </View>
          {item.scheduled_at && (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{t('admin.reportsManagement.scheduled')}: {formatDate(item.scheduled_at)}</Text>
            </View>
          )}
          {item.generated_at && (
            <View style={styles.metaItem}>
              <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.success} />
              <Text style={styles.metaText}>{t('admin.reportsManagement.generated')}: {formatDate(item.generated_at)}</Text>
            </View>
          )}
          {item.created_by?.name && (
            <View style={styles.metaItem}>
              <Ionicons name="person-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{t('admin.reportsManagement.by')} {item.created_by.name}</Text>
            </View>
          )}
        </View>

        {(status === 'generated' && item.file_url) ? (
          <View style={styles.reportActions}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleDownloadReport(item)}
              activeOpacity={0.7}
            >
              <View style={styles.actionCardIconWrap}>
                <Ionicons name="download-outline" size={28} color={COLORS.primary} />
              </View>
              <Text style={styles.actionCardText}>{t('admin.reportsManagement.downloadReport')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleShareReport(item)}
              activeOpacity={0.7}
            >
              <View style={styles.actionCardIconWrap}>
                <Ionicons name="share-outline" size={28} color={COLORS.primary} />
              </View>
              <Text style={styles.actionCardText}>{t('admin.reportsManagement.shareReport')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        {showBackButton ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
        <Text style={styles.headerTitle}>{t('admin.reportsManagement.title')}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowGenerateModal(true)}
        >
          <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionBarButton}
          onPress={() => setShowGenerateModal(true)}
        >
          <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
          <Text style={styles.actionBarButtonText}>{t('admin.reportsManagement.generateReport')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBarButton}
          onPress={() => setShowScheduleModal(true)}
        >
          <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
          <Text style={styles.actionBarButtonText}>{t('admin.reportsManagement.scheduleReport')}</Text>
        </TouchableOpacity>
      </View>

      {statistics ? (
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total</Text>
              <Text style={styles.statValue}>{statistics.total}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Generated</Text>
              <Text style={[styles.statValue, { color: COLORS.success }]}>{statistics.generated}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Pending</Text>
              <Text style={[styles.statValue, { color: COLORS.warning }]}>{statistics.pending}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Scheduled</Text>
              <Text style={[styles.statValue, { color: COLORS.info }]}>{statistics.scheduled}</Text>
            </View>
          </View>
          <View style={styles.typeChipsWrap}>
            {Object.entries(statistics.by_type || {}).map(([type, count]) => (
              <View key={type} style={styles.typeChip}>
                <Text style={styles.typeChipText}>
                  {type.replace(/_/g, ' ')}: {count}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Reports List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('admin.reportsManagement.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          renderItem={renderReport}
          keyExtractor={(item, index) => String(item.id ?? index)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
          ListFooterComponent={
            meta && reports.length > 0 ? (
              <View style={styles.paginationWrap}>
                <TouchableOpacity
                  style={[styles.pageButton, page <= 1 && styles.pageButtonDisabled]}
                  onPress={goToPreviousPage}
                  disabled={page <= 1 || loadingMore}
                >
                  <Text style={[styles.pageButtonText, page <= 1 && styles.pageButtonTextDisabled]}>
                    Previous
                  </Text>
                </TouchableOpacity>
                <Text style={styles.pageText}>
                  Page {page} / {meta.last_page}
                </Text>
                <TouchableOpacity
                  style={[styles.pageButton, page >= meta.last_page && styles.pageButtonDisabled]}
                  onPress={goToNextPage}
                  disabled={page >= meta.last_page || loadingMore}
                >
                  <Text
                    style={[
                      styles.pageButtonText,
                      page >= meta.last_page && styles.pageButtonTextDisabled,
                    ]}
                  >
                    Next
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>{t('admin.reportsManagement.noReports')}</Text>
              <Button
                title={t('admin.reportsManagement.generateNewReport')}
                onPress={() => setShowGenerateModal(true)}
                style={styles.emptyButton}
              />
            </View>
          }
        />
      )}

      {/* Generate Report Modal */}
      <Modal
        transparent
        visible={showGenerateModal}
        animationType="slide"
        onRequestClose={() => { setShowGenerateModal(false); resetGenerateForm(); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('admin.reportsManagement.generateReport')}</Text>
              <TouchableOpacity onPress={() => { setShowGenerateModal(false); resetGenerateForm(); }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalLabel}>{t('admin.reportsManagement.reportType')}</Text>
              {reportTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.reportTypeOption,
                    reportType === type.value && styles.reportTypeOptionActive
                  ]}
                  onPress={() => setReportType(type.value)}
                >
                  <View style={styles.reportTypeInfo}>
                    <Text style={[
                      styles.reportTypeOptionTitle,
                      reportType === type.value && styles.reportTypeOptionTitleActive
                    ]}>
                      {type.label}
                    </Text>
                    <Text style={styles.reportTypeOptionDesc}>{type.description}</Text>
                  </View>
                  {reportType === type.value && (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}

              <Text style={styles.modalLabel}>{t('admin.reportsManagement.titleLabel')}</Text>
              <Input
                placeholder={t('admin.reportsManagement.titlePlaceholder')}
                value={generateTitle}
                onChangeText={setGenerateTitle}
                style={styles.generateInput}
              />

              <Text style={styles.modalLabel}>{t('admin.reportsManagement.startDate')}</Text>
              <TouchableOpacity
                style={styles.dateInputRow}
                onPress={() => setDatePickerOpen('start')}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateInputText, !startDate && styles.dateInputPlaceholder]}>
                  {startDate || t('admin.reportsManagement.selectStartDate')}
                </Text>
                <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>

              <Text style={styles.modalLabel}>{t('admin.reportsManagement.endDate')}</Text>
              <TouchableOpacity
                style={styles.dateInputRow}
                onPress={() => setDatePickerOpen('end')}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateInputText, !endDate && styles.dateInputPlaceholder]}>
                  {endDate || t('admin.reportsManagement.selectEndDate')}
                </Text>
                <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>

              {datePickerOpen !== null && (
                <DateTimePicker
                  value={
                    datePickerOpen === 'start'
                      ? (startDate ? new Date(startDate) : new Date())
                      : (endDate ? new Date(endDate) : new Date())
                  }
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    if (Platform.OS === 'android') {
                      setDatePickerOpen(null);
                    }
                    if (event.type === 'dismissed') return;
                    if (selectedDate) {
                      const formatted = formatDateToYYYYMMDD(selectedDate);
                      if (datePickerOpen === 'start') setStartDate(formatted);
                      else setEndDate(formatted);
                    }
                  }}
                />
              )}
              {Platform.OS === 'ios' && datePickerOpen !== null && (
                <TouchableOpacity style={styles.datePickerDone} onPress={() => setDatePickerOpen(null)}>
                  <Text style={styles.datePickerDoneText}>{t('admin.reportsManagement.done')}</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.modalLabel}>{t('admin.reportsManagement.format')}</Text>
              <View style={styles.formatRow}>
                <TouchableOpacity
                  style={[styles.formatOption, format === 'pdf' && styles.formatOptionActive]}
                  onPress={() => setFormat('pdf')}
                >
                  <Text style={[styles.formatOptionText, format === 'pdf' && styles.formatOptionTextActive]}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formatOption, format === 'csv' && styles.formatOptionActive]}
                  onPress={() => setFormat('csv')}
                >
                  <Text style={[styles.formatOptionText, format === 'csv' && styles.formatOptionTextActive]}>CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formatOption, format === 'excel' && styles.formatOptionActive]}
                  onPress={() => setFormat('excel')}
                >
                  <Text style={[styles.formatOptionText, format === 'excel' && styles.formatOptionTextActive]}>Excel</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t('admin.reportsManagement.includeCharts')}</Text>
                <Switch
                  value={includeCharts}
                  onValueChange={setIncludeCharts}
                  trackColor={{ false: COLORS.border, true: COLORS.primary + '80' }}
                  thumbColor={includeCharts ? COLORS.primary : COLORS.textSecondary}
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t('admin.reportsManagement.includeDetails')}</Text>
                <Switch
                  value={includeDetails}
                  onValueChange={setIncludeDetails}
                  trackColor={{ false: COLORS.border, true: COLORS.primary + '80' }}
                  thumbColor={includeDetails ? COLORS.primary : COLORS.textSecondary}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title={t('admin.reportsManagement.cancel')}
                onPress={() => {
                  setShowGenerateModal(false);
                  resetGenerateForm();
                }}
                variant="outline"
                style={styles.modalButton}
                disabled={generateSubmitting}
              />
              <Button
                title={generateSubmitting ? t('admin.reportsManagement.generating') : t('admin.reportsManagement.generate')}
                onPress={handleGenerateReport}
                style={styles.modalButton}
                disabled={generateSubmitting}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Schedule Report Modal */}
      <Modal
        transparent
        visible={showScheduleModal}
        animationType="slide"
        onRequestClose={() => { setShowScheduleModal(false); resetScheduleForm(); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('admin.reportsManagement.scheduleReport')}</Text>
              <TouchableOpacity onPress={() => { setShowScheduleModal(false); resetScheduleForm(); }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalLabel}>{t('admin.reportsManagement.reportType')}</Text>
              {reportTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.reportTypeOption,
                    reportType === type.value && styles.reportTypeOptionActive
                  ]}
                  onPress={() => setReportType(type.value)}
                >
                  <View style={styles.reportTypeInfo}>
                    <Text style={[
                      styles.reportTypeOptionTitle,
                      reportType === type.value && styles.reportTypeOptionTitleActive
                    ]}>
                      {type.label}
                    </Text>
                    <Text style={styles.reportTypeOptionDesc}>{type.description}</Text>
                  </View>
                  {reportType === type.value && (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}

              <Text style={styles.modalLabel}>{t('admin.reportsManagement.titleLabel')}</Text>
              <Input
                placeholder={t('admin.reportsManagement.titlePlaceholderSchedule')}
                value={scheduleTitle}
                onChangeText={setScheduleTitle}
                style={styles.generateInput}
              />

              <Text style={styles.modalLabel}>{t('admin.reportsManagement.scheduleDate')}</Text>
              <TouchableOpacity style={styles.dateInputRow} onPress={() => setScheduleDatePickerOpen('date')} activeOpacity={0.7}>
                <Text style={[styles.dateInputText, !scheduleDate && styles.dateInputPlaceholder]}>
                  {scheduleDate || t('admin.reportsManagement.selectScheduleDate')}
                </Text>
                <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>

              <Text style={styles.modalLabel}>{t('admin.reportsManagement.scheduleTime')}</Text>
              <TouchableOpacity style={styles.dateInputRow} onPress={() => setScheduleDatePickerOpen('time')} activeOpacity={0.7}>
                <Text style={[styles.dateInputText, !scheduleTime && styles.dateInputPlaceholder]}>
                  {scheduleTime || t('admin.reportsManagement.selectScheduleTime')}
                </Text>
                <Ionicons name="time-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>

              <Text style={styles.modalLabel}>{t('admin.reportsManagement.recurrence')}</Text>
              <View style={styles.recurrenceRow}>
                {RECURRENCE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value || 'none'}
                    style={[
                      styles.recurrenceChip,
                      scheduleRecurrence === option.value && styles.recurrenceChipActive,
                    ]}
                    onPress={() => setScheduleRecurrence(option.value)}
                  >
                    <Text
                      style={[
                        styles.recurrenceChipText,
                        scheduleRecurrence === option.value && styles.recurrenceChipTextActive,
                      ]}
                    >
                      {t(
                        option.value === ''
                          ? 'admin.reportsManagement.recurrenceNone'
                          : `admin.reportsManagement.${option.value}`,
                        option.label
                      )}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>{t('admin.reportsManagement.reportDataRange')}</Text>
              <Text style={styles.modalLabelSmall}>{t('admin.reportsManagement.startDate')}</Text>
              <TouchableOpacity style={styles.dateInputRow} onPress={() => setScheduleDatePickerOpen('paramStart')} activeOpacity={0.7}>
                <Text style={[styles.dateInputText, !scheduleParamStartDate && styles.dateInputPlaceholder]}>
                  {scheduleParamStartDate || t('admin.reportsManagement.selectStartDate')}
                </Text>
                <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
              <Text style={styles.modalLabelSmall}>{t('admin.reportsManagement.endDate')}</Text>
              <TouchableOpacity style={styles.dateInputRow} onPress={() => setScheduleDatePickerOpen('paramEnd')} activeOpacity={0.7}>
                <Text style={[styles.dateInputText, !scheduleParamEndDate && styles.dateInputPlaceholder]}>
                  {scheduleParamEndDate || t('admin.reportsManagement.selectEndDate')}
                </Text>
                <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>

              <Text style={styles.modalLabel}>{t('admin.reportsManagement.format')}</Text>
              <View style={styles.formatRow}>
                <TouchableOpacity style={[styles.formatOption, scheduleFormat === 'pdf' && styles.formatOptionActive]} onPress={() => setScheduleFormat('pdf')}>
                  <Text style={[styles.formatOptionText, scheduleFormat === 'pdf' && styles.formatOptionTextActive]}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formatOption, scheduleFormat === 'csv' && styles.formatOptionActive]} onPress={() => setScheduleFormat('csv')}>
                  <Text style={[styles.formatOptionText, scheduleFormat === 'csv' && styles.formatOptionTextActive]}>CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formatOption, scheduleFormat === 'excel' && styles.formatOptionActive]} onPress={() => setScheduleFormat('excel')}>
                  <Text style={[styles.formatOptionText, scheduleFormat === 'excel' && styles.formatOptionTextActive]}>Excel</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t('admin.reportsManagement.includeCharts')}</Text>
                <Switch
                  value={scheduleIncludeCharts}
                  onValueChange={setScheduleIncludeCharts}
                  trackColor={{ false: COLORS.border, true: COLORS.primary + '80' }}
                  thumbColor={scheduleIncludeCharts ? COLORS.primary : COLORS.textSecondary}
                />
              </View>
            </ScrollView>

            {scheduleDatePickerOpen !== null && (
              <DateTimePicker
                value={
                  scheduleDatePickerOpen === 'date'
                    ? (scheduleDate ? new Date(scheduleDate) : new Date())
                    : scheduleDatePickerOpen === 'time'
                      ? (scheduleTime ? (() => {
                          const [h, m] = scheduleTime.split(':').map(Number);
                          const d = new Date();
                          d.setHours(isNaN(h) ? 9 : h, isNaN(m) ? 0 : m, 0, 0);
                          return d;
                        })() : new Date())
                      : scheduleDatePickerOpen === 'paramStart'
                        ? (scheduleParamStartDate ? new Date(scheduleParamStartDate) : new Date())
                        : (scheduleParamEndDate ? new Date(scheduleParamEndDate) : new Date())
                }
                mode={scheduleDatePickerOpen === 'time' ? 'time' : 'date'}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  if (Platform.OS === 'android') setScheduleDatePickerOpen(null);
                  if (event.type === 'dismissed') return;
                  if (selectedDate) {
                    if (scheduleDatePickerOpen === 'date') {
                      setScheduleDate(formatDateToYYYYMMDD(selectedDate));
                    } else if (scheduleDatePickerOpen === 'time') {
                      const h = selectedDate.getHours();
                      const m = selectedDate.getMinutes();
                      setScheduleTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                    } else if (scheduleDatePickerOpen === 'paramStart') {
                      setScheduleParamStartDate(formatDateToYYYYMMDD(selectedDate));
                    } else {
                      setScheduleParamEndDate(formatDateToYYYYMMDD(selectedDate));
                    }
                  }
                }}
              />
            )}
            {Platform.OS === 'ios' && scheduleDatePickerOpen !== null && (
              <TouchableOpacity style={styles.datePickerDone} onPress={() => setScheduleDatePickerOpen(null)}>
                <Text style={styles.datePickerDoneText}>{t('admin.reportsManagement.done')}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalFooter}>
              <Button
                title={t('admin.reportsManagement.cancel')}
                onPress={() => { setShowScheduleModal(false); resetScheduleForm(); }}
                variant="outline"
                style={styles.modalButton}
                disabled={scheduleSubmitting}
              />
              <Button
                title={scheduleSubmitting ? t('admin.reportsManagement.scheduling') : t('admin.reportsManagement.schedule')}
                onPress={handleScheduleReport}
                style={styles.modalButton}
                disabled={scheduleSubmitting}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Action Menu Modal */}
      <Modal
        transparent
        visible={showActionMenu}
        animationType="fade"
        onRequestClose={() => setShowActionMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowActionMenu(false)}
        >
          <View style={styles.menuContainer} onStartShouldSetResponder={() => true}>
            {selectedReport?.status === 'generated' && selectedReport?.file_url && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowActionMenu(false);
                    handleDownloadReport(selectedReport);
                  }}
                >
                  <Ionicons name="download-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.menuItemText}>Download</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowActionMenu(false);
                    handleShareReport(selectedReport);
                  }}
                >
                  <Ionicons name="share-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.menuItemText}>Share</Text>
                </TouchableOpacity>
              </>
            )}
            {selectedReport?.status === 'scheduled' && selectedReport?.id != null && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowActionMenu(false);
                  Alert.alert(
                    t('admin.reportsManagement.cancelScheduleTitle'),
                    t('admin.reportsManagement.cancelScheduleMessage'),
                    [
                      { text: t('admin.reportsManagement.no'), style: 'cancel' },
                      {
                        text: t('admin.reportsManagement.yes'),
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await adminService.cancelScheduledReport(selectedReport.id!);
                            Alert.alert(t('admin.users.success'), t('admin.reportsManagement.successScheduleCancelled'));
                            fetchReports(1);
                          } catch (error: any) {
                            Alert.alert(t('admin.users.error'), error.response?.data?.message || error.message || t('admin.reportsManagement.errorCancelSchedule'));
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <Ionicons name="close-circle-outline" size={20} color={COLORS.error} />
                <Text style={[styles.menuItemText, { color: COLORS.error }]}>{t('admin.reportsManagement.cancelSchedule')}</Text>
              </TouchableOpacity>
            )}
            {selectedReport?.id != null && selectedReport?.status !== 'scheduled' && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleDeleteReport}
              >
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                <Text style={[styles.menuItemText, { color: COLORS.error }]}>{t('admin.reportsManagement.delete')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  addButton: {
    padding: SPACING.xs,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  actionBarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  actionBarButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
  statsContainer: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  statValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  typeChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  typeChip: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  typeChipText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  listContent: {
    padding: SPACING.lg,
  },
  reportCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  reportInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  reportTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  reportType: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    textTransform: 'capitalize',
  },
  reportHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  moreButtonHeader: {
    padding: SPACING.xs,
  },
  reportMeta: {
    marginBottom: SPACING.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.xs,
  },
  metaText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  reportActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  actionCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionCardIconWrap: {
    marginBottom: SPACING.sm,
  },
  actionCardText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    textAlign: 'center',
  },
  moreButton: {
    padding: SPACING.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  loadingText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  emptyButton: {
    marginTop: SPACING.md,
  },
  paginationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  pageButton: {
    minWidth: 88,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  pageButtonDisabled: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  pageButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
  pageButtonTextDisabled: {
    color: COLORS.textSecondary,
  },
  pageText: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '90%',
    paddingBottom: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  modalScroll: {
    maxHeight: 400,
    paddingHorizontal: SPACING.lg,
  },
  modalLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  reportTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reportTypeOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  reportTypeInfo: {
    flex: 1,
  },
  reportTypeOptionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  reportTypeOptionTitleActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  reportTypeOptionDesc: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  generateInput: {
    marginBottom: SPACING.md,
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  dateInputText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  dateInputPlaceholder: {
    color: COLORS.textSecondary,
  },
  datePickerDone: {
    alignSelf: 'flex-end',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  datePickerDoneText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  formatRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  formatOption: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  formatOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  formatOptionText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  formatOptionTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  switchLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  recurrenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  recurrenceChip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recurrenceChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  recurrenceChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  recurrenceChipTextActive: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  modalLabelSmall: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  dateTimeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  dateTimeText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    gap: SPACING.md,
  },
  modalButton: {
    flex: 1,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  menuItemText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
});

export default AdminPendingReportsScreen;

