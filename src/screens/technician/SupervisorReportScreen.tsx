import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Button } from '../../components/common/Button';
import {
  getSupervisorReportDetail,
  finalizeSupervisorVisitReport,
  SupervisorReportDetail,
} from '../../services/supervisorService';

interface ReportOption {
  id: string;
  label: string;
  icon: string;
  selected: boolean;
}

const SupervisorReportScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const reportId = (route.params as { reportId?: number })?.reportId;

  const [report, setReport] = useState<SupervisorReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [reportOptions, setReportOptions] = useState<ReportOption[]>([
    { id: 'fertilizer', label: 'Needs Fertilizer', icon: 'nutrition-outline', selected: false },
    { id: 'vitamins', label: 'Needs Vitamins', icon: 'medical-outline', selected: false },
    { id: 'watering', label: 'Needs Watering', icon: 'water-outline', selected: false },
    { id: 'soil', label: 'Needs New Soil', icon: 'cube-outline', selected: false },
    { id: 'pruning', label: 'Needs Pruning', icon: 'cut-outline', selected: false },
  ]);

  useFocusEffect(
    useCallback(() => {
      if (reportId == null) {
        setLoading(false);
        setError('Report ID is missing.');
        return;
      }
      let cancelled = false;
      setLoading(true);
      setError(null);
      getSupervisorReportDetail(reportId)
        .then((data) => {
          if (!cancelled && data) {
            setReport(data);
            setError(null);
            setSupervisorNotes(data.supervisor_notes ?? '');
          } else if (!cancelled) {
            setReport(null);
            setError('Failed to load report.');
          }
        })
        .catch(() => {
          if (!cancelled) setError('Failed to load report.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [reportId])
  );

  const toggleOption = (id: string) => {
    setReportOptions(reportOptions.map(option => 
      option.id === id ? { ...option, selected: !option.selected } : option
    ));
  };

  const handleSubmitReport = async () => {
    const selectedOptions = reportOptions.filter(opt => opt.selected);
    if (selectedOptions.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one recommendation');
      return;
    }
    if (!report) return;
    const visitId = report.visit_id;
    const recommendations = selectedOptions.map(opt => opt.label);
    const customerName = report.visit?.client_name ?? report.location ?? 'client';
    const confirm = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Submit Supervisor Report',
        `Send report to ${customerName} with recommendations: ${recommendations.join(', ')}?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Send Report', onPress: () => resolve(true) },
        ]
      );
    });
    if (!confirm) return;
    setSubmitting(true);
    try {
      const result = await finalizeSupervisorVisitReport({
        visit_id: visitId,
        supervisor_notes: supervisorNotes,
        recommendations,
      });
      if (result.success) {
        Alert.alert('Success', result.message ?? 'Supervisor report sent to client successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', result.message ?? 'Failed to submit report.');
      }
    } catch {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('technician.supervisorReport')}</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading report…</Text>
        </View>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('technician.supervisorReport')}</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Report not found.'}</Text>
        </View>
      </View>
    );
  }

  const visitDate = report.submitted_at
    ? dayjs(report.submitted_at).format('YYYY-MM-DD')
    : (report.visit?.scheduled_at ? dayjs(report.visit.scheduled_at).format('YYYY-MM-DD') : '—');
  const visitTime = report.submitted_at
    ? dayjs(report.submitted_at).format('h:mm A')
    : (report.visit?.scheduled_at ? dayjs(report.visit.scheduled_at).format('h:mm A') : '—');
  const displayLocation = report.location || (report.visit?.client_name ?? '—');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('technician.supervisorReport')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Technician Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Field Worker</Text>
          <View style={styles.techCard}>
            <View style={styles.techInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(report.technician_name || ' ').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.techName}>{report.technician_name}</Text>
                <Text style={styles.techId}>ID: {report.employee_id}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Visit Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visit Information</Text>
          <View style={styles.visitCard}>
            <Text style={styles.customerName}>{displayLocation}</Text>
            <Text style={styles.serviceName}>{report.service}</Text>
            <View style={styles.visitDetails}>
              <View style={styles.detailItem}>
                <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.detailText}>{visitDate}</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.detailText}>{visitTime}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Field Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Field Notes</Text>
          <View style={styles.notesCard}>
            <Text style={styles.notesText}>
              {report.technician_notes ?? 'No notes provided.'}
            </Text>
          </View>
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Field Photos</Text>
          <View style={styles.photosContainer}>
            {report.before_photos?.length > 0 && (
              <>
                <Text style={styles.photoLabel}>Before</Text>
                {report.before_photos.map((p) => (
                  <Image key={p.id} source={{ uri: p.photo_url }} style={styles.photo} />
                ))}
              </>
            )}
            {report.after_photos?.length > 0 && (
              <>
                <Text style={styles.photoLabel}>After</Text>
                {report.after_photos.map((p) => (
                  <Image key={p.id} source={{ uri: p.photo_url }} style={styles.photo} />
                ))}
              </>
            )}
            {(!report.before_photos?.length && !report.after_photos?.length) && (
              <Text style={styles.noPhotosText}>No photos</Text>
            )}
          </View>
        </View>

        {/* Supervisor Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supervisor Notes</Text>
          <View style={styles.notesCard}>
            <TextInput
              style={styles.supervisorNotesInput}
              placeholder="Add your notes about this report…"
              placeholderTextColor={COLORS.textSecondary}
              value={supervisorNotes}
              onChangeText={setSupervisorNotes}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Supervisor Recommendations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Recommendations</Text>
          <Text style={styles.sectionSubtitle}>
            Choose what the farm needs based on the field report
          </Text>
          <View style={styles.optionsContainer}>
            {reportOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionCard,
                  option.selected && styles.optionCardSelected
                ]}
                onPress={() => toggleOption(option.id)}
              >
                <View style={[
                  styles.optionIcon,
                  option.selected && styles.optionIconSelected
                ]}>
                  <Ionicons 
                    name={option.icon as any} 
                    size={24} 
                    color={option.selected ? COLORS.background : COLORS.primary} 
                  />
                </View>
                <Text style={[
                  styles.optionLabel,
                  option.selected && styles.optionLabelSelected
                ]}>
                  {option.label}
                </Text>
                {option.selected && (
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Submit Button */}
        <View style={styles.section}>
          <Button
            title={submitting ? 'Sending…' : 'Submit Report to Client'}
            onPress={handleSubmitReport}
            style={styles.submitButton}
            disabled={submitting}
          />
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
    textAlign: 'center',
  },
  section: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  techCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  techInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  techName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  techId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  visitCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  customerName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  serviceName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  visitDetails: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  notesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  notesText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 22,
  },
  supervisorNotesInput: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 22,
    minHeight: 100,
    padding: 0,
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    alignItems: 'flex-start',
  },
  photoLabel: {
    width: '100%',
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  noPhotosText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  photo: {
    width: 160,
    height: 160,
    borderRadius: BORDER_RADIUS.md,
  },
  optionsContainer: {
    gap: SPACING.sm,
  },
  optionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  optionIconSelected: {
    backgroundColor: COLORS.primary,
  },
  optionLabel: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  optionLabelSelected: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  submitButton: {
    width: '100%',
  },
});

export default SupervisorReportScreen;










