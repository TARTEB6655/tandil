import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { getSupervisorAssignmentDetail, SupervisorAssignmentDetail } from '../../services/supervisorService';

const statusColor: Record<string, string> = {
  pending: COLORS.warning,
  completed: COLORS.success,
  in_progress: COLORS.info,
  cancelled: COLORS.textSecondary,
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const SupervisorAssignmentDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const assignmentId = route.params?.assignmentId ?? route.params?.visit_id ?? route.params?.id;
  const [assignment, setAssignment] = useState<SupervisorAssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (assignmentId == null) {
        setError('No assignment selected.');
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      setError(null);
      getSupervisorAssignmentDetail(Number(assignmentId))
        .then((data) => {
          if (!cancelled) setAssignment(data ?? null);
        })
        .catch(() => {
          if (!cancelled) {
            setError('Could not load assignment.');
            setAssignment(null);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [assignmentId])
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Task Detail</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </View>
    );
  }

  if (error || !assignment) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Task Detail</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerBox}>
          <Ionicons name="document-text-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.errorText}>{error || 'Assignment not found.'}</Text>
        </View>
      </View>
    );
  }

  const status = (assignment.status || 'pending').toLowerCase();
  const statusBg = statusColor[status] ?? COLORS.warning;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Task Detail</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="leaf" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.serviceName}>{assignment.service_name}</Text>
          {assignment.title ? (
            <Text style={styles.jobTitle}>{assignment.title}</Text>
          ) : null}
          <View style={[styles.statusPill, { backgroundColor: statusBg + '22' }]}>
            <Text style={[styles.statusText, { color: statusBg }]}>
              {(assignment.status || 'pending').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Customer / Client */}
        {assignment.customer ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="person-outline" size={20} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Customer</Text>
            </View>
            <View style={styles.customerRow}>
              {assignment.customer.profile_picture_url ? (
                <Image
                  source={{ uri: assignment.customer.profile_picture_url }}
                  style={styles.customerAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.customerAvatarPlaceholder}>
                  <Text style={styles.customerAvatarLetter}>
                    {(assignment.customer.name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{assignment.customer.name}</Text>
                {assignment.customer.email ? (
                  <TouchableOpacity
                    style={styles.contactLine}
                    onPress={() => {
                      const url = `mailto:${assignment.customer!.email}`;
                      Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open email.'));
                    }}
                  >
                    <Ionicons name="mail-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.contactLink}>{assignment.customer.email}</Text>
                  </TouchableOpacity>
                ) : null}
                {assignment.customer.phone ? (
                  <TouchableOpacity
                    style={styles.contactLine}
                    onPress={() => {
                      const url = `tel:${assignment.customer!.phone.replace(/\s/g, '')}`;
                      Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open phone.'));
                    }}
                  >
                    <Ionicons name="call-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.contactLink}>{assignment.customer.phone}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {/* Assigned technician */}
        {assignment.technician ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="construct-outline" size={20} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Assigned Technician</Text>
            </View>
            <View style={styles.customerRow}>
              {assignment.technician.profile_picture_url ? (
                <Image
                  source={{ uri: assignment.technician.profile_picture_url }}
                  style={styles.customerAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.customerAvatarPlaceholder}>
                  <Text style={styles.customerAvatarLetter}>
                    {(assignment.technician.name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{assignment.technician.name}</Text>
                {assignment.technician.employee_id ? (
                  <Text style={styles.technicianId}>{assignment.technician.employee_id}</Text>
                ) : null}
                {assignment.technician.phone ? (
                  <TouchableOpacity
                    style={styles.contactLine}
                    onPress={() => {
                      const url = `tel:${(assignment.technician!.phone || '').replace(/\s/g, '')}`;
                      Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open phone.'));
                    }}
                  >
                    <Ionicons name="call-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.contactLink}>{assignment.technician.phone}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {/* Overview */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Overview</Text>
          </View>
          {assignment.job_time ? (
            <View style={styles.row}>
              <Ionicons name="time-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.rowLabel}>Scheduled</Text>
              <Text style={styles.rowValue}>{assignment.job_time}</Text>
            </View>
          ) : null}
          {assignment.location ? (
            <View style={styles.row}>
              <Ionicons name="location-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.rowLabel}>Location</Text>
              <Text style={styles.rowValue}>{assignment.location}</Text>
            </View>
          ) : null}
        </View>

        {/* Service & duration */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="construct-outline" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Service</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Duration</Text>
            <Text style={styles.rowValue}>{formatDuration(assignment.duration_minutes)}</Text>
          </View>
          {assignment.price_display ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Price</Text>
              <Text style={[styles.rowValue, styles.price]}>{assignment.price_display}</Text>
            </View>
          ) : null}
        </View>

        {/* Notes */}
        {assignment.notes && assignment.notes.trim() ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Notes</Text>
            </View>
            <Text style={styles.notesText}>{assignment.notes.trim()}</Text>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SPACING.sm },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  serviceName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  jobTitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  statusPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
  },
  statusText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  rowLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    minWidth: 80,
  },
  rowValue: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  price: {
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  notesText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: SPACING.md,
  },
  customerAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  customerAvatarLetter: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  customerInfo: { flex: 1 },
  customerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: 4,
  },
  technicianId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginBottom: 4,
  },
  contactLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 2,
  },
  contactLink: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
  },
});

export default SupervisorAssignmentDetailScreen;
