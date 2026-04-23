import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  hrService,
  HRVisitAssignmentTeamMember,
  HRGeneratedReportItem,
} from '../../services/hrService';

type ReportStatus = 'generated' | 'pending' | 'failed';

type ReportItem = {
  id: string | number;
  technicianName: string;
  title?: string;
  year: string;
  month: string;
  generatedAt: string;
  status: ReportStatus;
  downloadUrl?: string | null;
};

const MONTH_NAMES: Record<string, string> = {
  '1': 'January',
  '2': 'February',
  '3': 'March',
  '4': 'April',
  '5': 'May',
  '6': 'June',
  '7': 'July',
  '8': 'August',
  '9': 'September',
  '10': 'October',
  '11': 'November',
  '12': 'December',
};

const HRReportsScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [previewTechnicianId, setPreviewTechnicianId] = useState('');
  const [previewYear, setPreviewYear] = useState('2026');
  const [previewMonth, setPreviewMonth] = useState('4');

  const [pdfTechnicianId, setPdfTechnicianId] = useState('');
  const [pdfYear, setPdfYear] = useState('2026');
  const [pdfMonth, setPdfMonth] = useState('4');

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | number | null>(null);
  const [technicians, setTechnicians] = useState<HRVisitAssignmentTeamMember[]>([]);
  const [techLoading, setTechLoading] = useState(false);
  const [selectorType, setSelectorType] = useState<'preview' | 'pdf' | null>(null);

  const previewTechnician = useMemo(
    () => technicians.find(t => String(t.id) === previewTechnicianId)?.name || 'Choose technician',
    [previewTechnicianId, technicians]
  );
  const pdfTechnician = useMemo(
    () => technicians.find(t => String(t.id) === pdfTechnicianId)?.name || 'Choose technician',
    [pdfTechnicianId, technicians]
  );

  useEffect(() => {
    const loadTechnicians = async () => {
      setTechLoading(true);
      try {
        const res = await hrService.getVisitAssignmentsAssignScreen({ per_page: 50 });
        const team = Array.isArray(res?.data?.team_members) ? res.data.team_members : [];
        setTechnicians(team);
      } catch {
        setTechnicians([]);
      } finally {
        setTechLoading(false);
      }
    };
    loadTechnicians();
  }, []);

  const mapReport = (item: HRGeneratedReportItem): ReportItem => ({
    id: item.id,
    technicianName: item.technician_name || item.technician?.name || 'Technician',
    title: (item as any).title || undefined,
    year: String(item.year ?? (item as any)?.parameters?.year ?? ''),
    month: String(item.month ?? (item as any)?.parameters?.month ?? ''),
    generatedAt: String(item.generated_at || item.created_at || ''),
    status:
      item.status === 'pending'
        ? 'pending'
        : item.status === 'failed'
        ? 'failed'
        : 'generated',
    downloadUrl: item.download_url || item.file_url || null,
  });

  const loadReports = async () => {
    setReportsLoading(true);
    try {
      const res = await hrService.getGeneratedReports({ per_page: 15 });
      const list = Array.isArray(res?.data) ? res.data : [];
      setReports(list.map(mapReport));
    } catch {
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const onGeneratePdf = async () => {
    if (!pdfTechnicianId) {
      Alert.alert('Generate PDF', 'Please select technician first.');
      return;
    }
    try {
      setGeneratingPdf(true);
      const res = await hrService.generateReport({
        technician_id: Number(pdfTechnicianId),
        year: Number(pdfYear),
        month: Number(pdfMonth),
        format: 'pdf',
      });

      if (res?.success === false) {
        throw new Error(res?.message || 'Failed to generate report');
      }

      if (res?.data) {
        const created = mapReport(res.data as any);
        setReports(prev => [created, ...prev.filter(r => r.id !== created.id)]);
      }
      Alert.alert(
        'PDF Generation Started',
        res?.message || 'Report generation started. You will be notified when it is ready.'
      );
      await loadReports();
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.response?.data?.message || err?.message || 'Failed to generate PDF.'
      );
    } finally {
      setGeneratingPdf(false);
    }
  };

  const onPreview = () => {
    if (!previewTechnicianId) {
      Alert.alert('Preview Detail', 'Please select technician for preview.');
      return;
    }
    navigation.navigate('HRReportPreviewDetail', {
      technicianId: Number(previewTechnicianId),
      technicianName: previewTechnician,
      year: Number(previewYear),
      month: Number(previewMonth),
    });
  };


  const onDownload = async (item: ReportItem) => {
    if (item.status !== 'generated') return;
    if (!item.downloadUrl) {
      Alert.alert('Download', 'Download URL is not ready yet.');
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(item.downloadUrl);
      if (!canOpen) {
        Alert.alert('Download', 'Cannot open this file URL on device.');
        return;
      }
      await Linking.openURL(item.downloadUrl);
    } catch {
      Alert.alert('Download', 'Failed to open download URL.');
    }
  };

  const onDeleteReport = (item: ReportItem) => {
    Alert.alert(
      'Delete Report',
      'Are you sure you want to delete this report?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingReportId(item.id);
              const res = await hrService.deleteGeneratedReport(item.id);
              if (res?.success === false) {
                throw new Error(res?.message || 'Failed to delete report');
              }
              setReports(prev => prev.filter(r => r.id !== item.id));
              Alert.alert('Deleted', res?.message || 'Report deleted successfully.');
              await loadReports();
            } catch (err: any) {
              Alert.alert(
                'Error',
                err?.response?.data?.message || err?.message || 'Failed to delete report.'
              );
            } finally {
              setDeletingReportId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Technician Monthly Reports" showBack onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Technician and Month</Text>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Preview Detail</Text>
            <TouchableOpacity style={styles.dropdownBtn} onPress={() => setSelectorType('preview')}>
              <Text style={[styles.dropdownText, !previewTechnicianId && styles.dropdownPlaceholder]}>
                {previewTechnician}
              </Text>
              <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.selectionText}>Selected: {previewTechnician}</Text>

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>Year</Text>
                <TextInput
                  value={previewYear}
                  onChangeText={setPreviewYear}
                  style={styles.input}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Month</Text>
                <TextInput
                  value={previewMonth}
                  onChangeText={setPreviewMonth}
                  style={styles.input}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.previewButton} onPress={onPreview}>
              <Ionicons name="eye-outline" size={16} color={COLORS.background} />
              <Text style={styles.previewButtonText}>Preview Detail</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Generate PDF</Text>
            <TouchableOpacity style={styles.dropdownBtn} onPress={() => setSelectorType('pdf')}>
              <Text style={[styles.dropdownText, !pdfTechnicianId && styles.dropdownPlaceholder]}>
                {pdfTechnician}
              </Text>
              <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.selectionText}>Selected: {pdfTechnician}</Text>

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>Year</Text>
                <TextInput
                  value={pdfYear}
                  onChangeText={setPdfYear}
                  style={styles.input}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Month</Text>
                <TextInput
                  value={pdfMonth}
                  onChangeText={setPdfMonth}
                  style={styles.input}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.generateButton} onPress={onGeneratePdf} disabled={generatingPdf}>
              {generatingPdf ? (
                <ActivityIndicator size="small" color={COLORS.background} />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={16} color={COLORS.background} />
                  <Text style={styles.generateButtonText}>Generate & Download PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Generated PDFs</Text>
          {reportsLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading generated reports...</Text>
            </View>
          ) : null}
          {reports.map(item => (
            <View key={item.id} style={styles.reportRow}>
              <View style={styles.reportInfo}>
                <Text style={styles.reportName}>
                  {item.title || `${item.technicianName} - ${MONTH_NAMES[item.month] || item.month} ${item.year}`}
                </Text>
                <Text style={styles.reportMeta}>
                  {item.generatedAt} -{' '}
                  {item.status === 'generated'
                    ? 'Generated'
                    : item.status === 'failed'
                    ? 'Failed'
                    : 'Pending'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => onDownload(item)}
                disabled={item.status !== 'generated'}
                style={styles.downloadWrap}
              >
                <Text
                  style={[
                    styles.downloadText,
                    item.status !== 'generated' && styles.pendingText,
                  ]}
                >
                  {item.status === 'generated' ? 'Download' : item.status === 'failed' ? 'Failed' : 'Pending'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDeleteReport(item)}
                disabled={deletingReportId === item.id}
                style={styles.deleteWrap}
              >
                {deletingReportId === item.id ? (
                  <ActivityIndicator size="small" color={COLORS.error} />
                ) : (
                  <Text style={styles.deleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={selectorType !== null} transparent animationType="fade" onRequestClose={() => setSelectorType(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Technician</Text>
            {techLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading technicians...</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalList}>
                {technicians.map(item => {
                  const id = String(item.id);
                  const active = selectorType === 'preview' ? previewTechnicianId === id : pdfTechnicianId === id;
                  return (
                    <TouchableOpacity
                      key={id}
                      style={[styles.modalItem, active && styles.modalItemActive]}
                      onPress={() => {
                        if (selectorType === 'preview') setPreviewTechnicianId(id);
                        if (selectorType === 'pdf') setPdfTechnicianId(id);
                        setSelectorType(null);
                      }}
                    >
                      <Text style={[styles.modalItemText, active && styles.modalItemTextActive]}>
                        {item.name}
                        {item.employee_id ? ` (${item.employee_id})` : ''}
                      </Text>
                      {active ? <Ionicons name="checkmark" size={16} color={COLORS.primary} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectorType(null)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  cardTitle: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
    marginBottom: SPACING.md,
  },
  panel: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  panelTitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
    marginBottom: SPACING.sm,
  },
  dropdownBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: { fontSize: FONT_SIZES.md, color: COLORS.text },
  dropdownPlaceholder: { color: COLORS.textSecondary },
  selectionText: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
  modalBackdrop: { flex: 1, backgroundColor: '#00000055', justifyContent: 'center', padding: SPACING.lg },
  modalCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
    marginBottom: SPACING.sm,
  },
  modalList: { maxHeight: 320 },
  modalItem: {
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalItemActive: { backgroundColor: COLORS.primary + '10' },
  modalItemText: { fontSize: FONT_SIZES.sm, color: COLORS.text },
  modalItemTextActive: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.semiBold },
  modalCloseButton: {
    marginTop: SPACING.sm,
    alignSelf: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  modalCloseText: { color: COLORS.primary, fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm },
  loadingText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  row: { flexDirection: 'row', gap: SPACING.sm },
  field: { flex: 1 },
  label: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
  },
  previewButton: {
    marginTop: SPACING.md,
    backgroundColor: '#1F2937',
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  previewButtonText: { color: COLORS.background, fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold },
  generateButton: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  generateButtonText: { color: COLORS.background, fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: SPACING.md,
  },
  reportInfo: { flex: 1, paddingRight: SPACING.md },
  reportName: { fontSize: FONT_SIZES.md, color: COLORS.text, fontWeight: FONT_WEIGHTS.medium },
  reportMeta: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 4 },
  downloadWrap: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm },
  downloadText: { color: COLORS.primary, fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold },
  pendingText: { color: COLORS.textSecondary, fontWeight: FONT_WEIGHTS.medium },
  deleteWrap: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm },
  deleteText: { color: COLORS.error, fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold },
});

export default HRReportsScreen;
