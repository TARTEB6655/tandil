import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/common/Header';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  hrService,
  HRVisitAssignmentSummaryData,
  HRVisitAssignmentListItem,
  HRVisitAssignmentTeamMember,
} from '../../services/hrService';

type Scope = 'all' | 'assignable' | 'unassigned';

type VisitItem = {
  id: number;
  status: 'pending' | 'assigned_pending' | 'confirmed';
  assignmentState: 'unassigned' | 'assigned';
  clientName: string;
  title?: string;
  serviceName?: string;
  area: string;
  location?: string;
  scheduledDate: string;
  price: number;
  notesPreview?: string;
  currentTechnician?: string;
};

type AssignmentForm = {
  technicianId: number | null;
  scheduledDate: string;
  note: string;
};

const HRAssignVisitsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [scope, setScope] = useState<Scope>('assignable');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [perPage, setPerPage] = useState<'10' | '12' | '20'>('12');
  const [visits, setVisits] = useState<VisitItem[]>([]);
  const [visitsMeta, setVisitsMeta] = useState<{
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  } | null>(null);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitsError, setVisitsError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<HRVisitAssignmentTeamMember[]>([]);
  const [forms, setForms] = useState<Record<number, AssignmentForm>>({});
  const [selectorVisitId, setSelectorVisitId] = useState<number | null>(null);
  const [summary, setSummary] = useState<HRVisitAssignmentSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [assigningVisitId, setAssigningVisitId] = useState<number | null>(null);

  const stats = useMemo(() => {
    const total = visits.length;
    const unassigned = visits.filter(v => v.assignmentState === 'unassigned').length;
    const pendingAcceptance = visits.filter(v => v.status === 'assigned_pending').length;
    return { total, unassigned, pendingAcceptance };
  }, [visits]);

  const mapAssignmentToVisit = (item: HRVisitAssignmentListItem): VisitItem => ({
    id: item.id,
    status:
      item.flags?.is_pending_acceptance === true
        ? 'assigned_pending'
        : item.status === 'confirmed'
        ? 'confirmed'
        : 'pending',
    assignmentState: item.flags?.is_unassigned ? 'unassigned' : 'assigned',
    clientName: item.client?.name || item.title || 'Client',
    title: item.title,
    serviceName: item.service_name,
    area: item.area?.name || item.location || '—',
    location: item.location,
    scheduledDate: item.scheduled_date,
    price: Number(item.price || 0),
    notesPreview: item.notes_preview,
    currentTechnician: item.technician?.name || undefined,
  });

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const response = await hrService.getVisitAssignmentsSummary({
        scope: scope === 'all' ? undefined : scope,
        date_from: fromDate.trim() || undefined,
        date_to: toDate.trim() || undefined,
      });
      if (response?.success && response?.data) {
        setSummary(response.data);
      } else {
        throw new Error('Invalid summary response');
      }
    } catch (err: any) {
      setSummary(null);
      setSummaryError(err?.response?.data?.message || err?.message || 'Failed to load summary');
    } finally {
      setSummaryLoading(false);
    }
  }, [scope, fromDate, toDate]);

  const fetchVisits = useCallback(async () => {
    setVisitsLoading(true);
    setVisitsError(null);
    try {
      const response = await hrService.getVisitAssignmentsAssignScreen({
        scope,
        date_from: fromDate.trim() || undefined,
        date_to: toDate.trim() || undefined,
        per_page: Number(perPage),
      });
      if (response?.success && response?.data) {
        const tasks = Array.isArray(response.data.available_tasks) ? response.data.available_tasks : [];
        const members = Array.isArray(response.data.team_members) ? response.data.team_members : [];
        setVisits(tasks.map(mapAssignmentToVisit));
        setTeamMembers(members.filter(member => !member.on_leave_today));
        setVisitsMeta(response.meta || null);
      } else {
        throw new Error('Invalid visit assignments response');
      }
    } catch (err: any) {
      setVisits([]);
      setTeamMembers([]);
      setVisitsMeta(null);
      setVisitsError(err?.response?.data?.message || err?.message || 'Failed to load assignments');
    } finally {
      setVisitsLoading(false);
    }
  }, [scope, fromDate, toDate, perPage]);

  useEffect(() => {
    fetchSummary();
    fetchVisits();
  }, [fetchSummary, fetchVisits]);

  const getForm = (visitId: number): AssignmentForm =>
    forms[visitId] ?? {
      technicianId: null,
      scheduledDate: '',
      note: '',
    };

  const setFormValue = (
    visitId: number,
    key: keyof AssignmentForm,
    value: AssignmentForm[keyof AssignmentForm]
  ) => {
    setForms(prev => ({
      ...prev,
      [visitId]: {
        ...getForm(visitId),
        [key]: value,
      },
    }));
  };

  const selectedTechnicianName = (visitId: number) => {
    const selected = teamMembers.find(t => t.id === getForm(visitId).technicianId);
    return selected?.name ?? '';
  };

  const handleAssign = async (visit: VisitItem) => {
    const form = getForm(visit.id);
    if (!form.technicianId) {
      Alert.alert('Assign Technician', 'Please select a technician first.');
      return;
    }
    const scheduledDate = form.scheduledDate.trim() || visit.scheduledDate;
    const note = form.note.trim();
    try {
      setAssigningVisitId(visit.id);
      const res = await hrService.offerVisitToTechnician(visit.id, {
        technician_id: form.technicianId,
        scheduled_date: scheduledDate,
        note,
      });
      if (res?.success === false) {
        throw new Error(res?.message || 'Failed to assign visit');
      }
      await Promise.all([fetchSummary(), fetchVisits()]);
      Alert.alert('Success', res?.message || `Visit #${visit.id} assigned successfully.`);
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.response?.data?.message || err?.message || 'Failed to assign visit.'
      );
    } finally {
      setAssigningVisitId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Assign Visits" showBack onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Manage unassigned jobs and quickly assign technicians.</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Jobs</Text>
            <Text style={styles.statValue}>{summary?.total_jobs ?? stats.total}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Unassigned</Text>
            <Text style={[styles.statValue, { color: COLORS.error }]}>
              {summary?.unassigned ?? stats.unassigned}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pending Acceptance</Text>
            <Text style={[styles.statValue, { color: COLORS.warning }]}>
              {summary?.pending_acceptance ?? stats.pendingAcceptance}
            </Text>
          </View>
        </View>
        {summaryLoading ? (
          <View style={styles.summaryStatus}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.summaryStatusText}>Updating summary...</Text>
          </View>
        ) : null}
        {summaryError ? <Text style={styles.summaryErrorText}>{summaryError}</Text> : null}

        <View style={styles.filtersCard}>
          <Text style={styles.sectionTitle}>Filters</Text>
          <View style={styles.scopeRow}>
            {[
              { id: 'all', label: 'All' },
              { id: 'assignable', label: 'Assignable' },
              { id: 'unassigned', label: 'Unassigned' },
            ].map(option => {
              const isActive = scope === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => setScope(option.id as Scope)}
                  style={[styles.scopeChip, isActive && styles.scopeChipActive]}
                >
                  <Text style={[styles.scopeChipText, isActive && styles.scopeChipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.dateRow}>
            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>From</Text>
              <TextInput
                value={fromDate}
                onChangeText={setFromDate}
                placeholder="yyyy-mm-dd"
                placeholderTextColor={COLORS.textSecondary}
                style={styles.input}
              />
            </View>
            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>To</Text>
              <TextInput
                value={toDate}
                onChangeText={setToDate}
                placeholder="yyyy-mm-dd"
                placeholderTextColor={COLORS.textSecondary}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.perPageWrap}>
            <Text style={styles.inputLabel}>Per Page</Text>
            <View style={styles.perPageRow}>
              {(['10', '12', '20'] as const).map(value => {
                const active = perPage === value;
                return (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setPerPage(value)}
                    style={[styles.perPageChip, active && styles.perPageChipActive]}
                  >
                    <Text style={[styles.perPageText, active && styles.perPageTextActive]}>{value}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <Text style={styles.countText}>
          {visitsMeta
            ? `Page ${visitsMeta.current_page} / ${visitsMeta.last_page} - Showing ${visits.length} of ${visitsMeta.total} jobs`
            : `Showing ${visits.length} jobs`}
        </Text>

        {visitsLoading ? (
          <View style={styles.visitsLoadingWrap}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.visitsLoadingText}>Loading assignments...</Text>
          </View>
        ) : null}
        {visitsError ? <Text style={styles.summaryErrorText}>{visitsError}</Text> : null}

        {visits.map(visit => {
          const form = getForm(visit.id);
          const technicianName = selectedTechnicianName(visit.id);
          return (
            <View style={styles.visitCard} key={visit.id}>
              <View style={styles.visitHeader}>
                <View style={styles.badgesRow}>
                  <Text style={styles.visitId}>#{visit.id}</Text>
                  <View style={[styles.badge, styles.badgePending]}>
                    <Text style={styles.badgePendingText}>
                      {visit.status === 'assigned_pending'
                        ? 'Pending'
                        : visit.status.charAt(0).toUpperCase() + visit.status.slice(1)}
                    </Text>
                  </View>
                  <View style={[styles.badge, visit.assignmentState === 'unassigned' ? styles.badgeUnassigned : styles.badgeAssigned]}>
                    <Text
                      style={[
                        styles.badgePlainText,
                        { color: visit.assignmentState === 'unassigned' ? COLORS.error : COLORS.success },
                      ]}
                    >
                      {visit.assignmentState === 'unassigned' ? 'Unassigned' : 'Assigned'}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.clientName}>{visit.clientName}</Text>
              <View style={styles.metaGridCompact}>
                <View style={styles.metaColumn}>
                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={15} color={COLORS.textSecondary} />
                    <View style={styles.metaTextWrap}>
                      <Text style={styles.metaLabel}>Area</Text>
                      <Text style={styles.metaValue} numberOfLines={2}>
                        {visit.area}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="person-outline" size={15} color={COLORS.textSecondary} />
                    <View style={styles.metaTextWrap}>
                      <Text style={styles.metaLabel}>Current Tech</Text>
                      <Text style={styles.metaValue} numberOfLines={2}>
                        {visit.currentTechnician || 'Unassigned'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.metaColumn}>
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={15} color={COLORS.textSecondary} />
                    <View style={styles.metaTextWrap}>
                      <Text style={styles.metaLabel}>Scheduled</Text>
                      <Text style={styles.metaValue} numberOfLines={2}>
                        {visit.scheduledDate}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="cash-outline" size={15} color={COLORS.textSecondary} />
                    <View style={styles.metaTextWrap}>
                      <Text style={styles.metaLabel}>Price</Text>
                      <Text style={styles.metaValue} numberOfLines={2}>
                        AED {visit.price.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.assignBox}>
                <Text style={styles.assignTitle}>Assign Technician</Text>

                <TouchableOpacity
                  style={styles.selector}
                  onPress={() => setSelectorVisitId(visit.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.selectorText, !technicianName && styles.selectorPlaceholder]}>
                    {technicianName || 'Select technician'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>

                <Text style={styles.inputLabel}>Scheduled Date</Text>
                <TextInput
                  value={form.scheduledDate}
                  onChangeText={value => setFormValue(visit.id, 'scheduledDate', value)}
                  placeholder={visit.scheduledDate}
                  placeholderTextColor={COLORS.textSecondary}
                  style={styles.input}
                />

                <Text style={styles.inputLabel}>Note</Text>
                <TextInput
                  value={form.note}
                  onChangeText={value => setFormValue(visit.id, 'note', value)}
                  placeholder="Optional note"
                  placeholderTextColor={COLORS.textSecondary}
                  style={[styles.input, styles.noteInput]}
                  multiline
                />

                <TouchableOpacity
                  style={[styles.assignButton, assigningVisitId === visit.id && styles.assignButtonDisabled]}
                  onPress={() => handleAssign(visit)}
                  disabled={assigningVisitId !== null}
                >
                  {assigningVisitId === visit.id ? (
                    <ActivityIndicator size="small" color={COLORS.background} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.background} />
                      <Text style={styles.assignButtonText}>Assign Now</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={selectorVisitId !== null} transparent animationType="fade" onRequestClose={() => setSelectorVisitId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Technician</Text>
            {teamMembers.map(tech => {
              const active = selectorVisitId !== null && getForm(selectorVisitId).technicianId === tech.id;
              return (
                <TouchableOpacity
                  key={tech.id}
                  style={[styles.modalItem, active && styles.modalItemActive]}
                  onPress={() => {
                    if (selectorVisitId !== null) {
                      setFormValue(selectorVisitId, 'technicianId', tech.id);
                    }
                    setSelectorVisitId(null);
                  }}
                >
                  <Text style={[styles.modalItemText, active && styles.modalItemTextActive]}>
                    {tech.name}
                    {tech.employee_id ? ` (${tech.employee_id})` : ''}
                  </Text>
                  {active ? <Ionicons name="checkmark" size={16} color={COLORS.primary} /> : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectorVisitId(null)}>
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
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  subtitle: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: SPACING.md },
  statsRow: { gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    fontWeight: FONT_WEIGHTS.medium,
  },
  statValue: {
    marginTop: 6,
    fontSize: FONT_SIZES.xl,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.bold,
  },
  summaryStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  summaryStatusText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
  },
  summaryErrorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.xs,
    marginBottom: SPACING.sm,
  },
  visitsLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  visitsLoadingText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
  },
  filtersCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: { fontSize: FONT_SIZES.md, color: COLORS.text, fontWeight: FONT_WEIGHTS.semiBold, marginBottom: SPACING.sm },
  scopeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md, flexWrap: 'wrap' },
  scopeChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  scopeChipActive: { backgroundColor: COLORS.primary + '18', borderColor: COLORS.primary },
  scopeChipText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.medium },
  scopeChipTextActive: { color: COLORS.primary },
  dateRow: { flexDirection: 'row', gap: SPACING.sm },
  inputBlock: { flex: 1 },
  inputLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginBottom: 6, marginTop: SPACING.xs },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
  },
  perPageWrap: { marginTop: SPACING.sm },
  perPageRow: { flexDirection: 'row', gap: SPACING.sm },
  perPageChip: {
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  perPageChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  perPageText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.medium },
  perPageTextActive: { color: COLORS.primary },
  countText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  visitCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border + 'AA',
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  visitHeader: { marginBottom: SPACING.sm },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexWrap: 'wrap' },
  visitId: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, fontWeight: FONT_WEIGHTS.bold },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.sm },
  badgePending: { backgroundColor: '#ECEAFF', borderWidth: 1, borderColor: '#D7D2FE' },
  badgePendingText: { color: '#4F46E5', fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.semiBold, textTransform: 'capitalize' },
  badgeUnassigned: { backgroundColor: '#FDECEC', borderWidth: 1, borderColor: '#FBC8C8' },
  badgeAssigned: { backgroundColor: '#EAF8EE', borderWidth: 1, borderColor: '#BFE7CC' },
  badgePlainText: { fontSize: FONT_SIZES.xs, fontWeight: FONT_WEIGHTS.medium },
  clientName: { fontSize: FONT_SIZES.xl, color: COLORS.text, fontWeight: FONT_WEIGHTS.bold, marginBottom: SPACING.xs },
  metaGridCompact: {
    marginTop: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  metaColumn: {
    flex: 1,
    gap: SPACING.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    minHeight: 52,
  },
  metaTextWrap: {
    flex: 1,
  },
  metaLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  assignBox: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  assignTitle: { fontSize: FONT_SIZES.sm, color: COLORS.text, fontWeight: FONT_WEIGHTS.semiBold, marginBottom: SPACING.xs },
  selector: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorText: { fontSize: FONT_SIZES.sm, color: COLORS.text },
  selectorPlaceholder: { color: COLORS.textSecondary },
  noteInput: { minHeight: 70, textAlignVertical: 'top' },
  assignButton: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  assignButtonDisabled: {
    opacity: 0.75,
  },
  assignButtonText: { color: COLORS.background, fontSize: FONT_SIZES.sm, fontWeight: FONT_WEIGHTS.semiBold },
  modalBackdrop: { flex: 1, backgroundColor: '#00000055', justifyContent: 'center', padding: SPACING.lg },
  modalCard: { backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md },
  modalTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
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
});

export default HRAssignVisitsScreen;
