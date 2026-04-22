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
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { getSupervisorTeamMember, SupervisorTeamMemberDetail } from '../../services/supervisorService';

const SupervisorTeamMemberDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const technicianId = route.params?.technicianId ?? route.params?.technician_id;
  const [member, setMember] = useState<SupervisorTeamMemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (technicianId == null) {
        setError(t('supervisorDashboard.noMemberSelected'));
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      setError(null);
      getSupervisorTeamMember(Number(technicianId))
        .then((data) => {
          if (!cancelled) setMember(data ?? null);
        })
        .catch(() => {
          if (!cancelled) {
            setError(t('supervisorDashboard.couldNotLoadMember'));
            setMember(null);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [technicianId, t])
  );

  const openEmail = () => {
    const email = member?.email?.trim();
    if (!email) return;
    const url = `mailto:${email}`;
    Linking.openURL(url).catch(() => Alert.alert(t('common.error'), t('supervisorDashboard.couldNotOpenEmail')));
  };

  const openPhone = () => {
    const phone = member?.phone?.trim();
    if (!phone) return;
    const url = `tel:${phone.replace(/\s/g, '')}`;
    Linking.openURL(url).catch(() => Alert.alert(t('common.error'), t('supervisorDashboard.couldNotOpenPhone')));
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('supervisorDashboard.teamMemberTitle')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('supervisorDashboard.loadingDetail')}</Text>
        </View>
      </View>
    );
  }

  if (error || !member) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('supervisorDashboard.teamMemberTitle')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerBox}>
          <Ionicons name="person-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.errorText}>{error || t('supervisorDashboard.memberNotFound')}</Text>
        </View>
      </View>
    );
  }

  const isActive = (member.status || '').toLowerCase() === 'active';
  const taskPercent = member.tasks_total > 0
    ? Math.round((member.tasks_completed / member.tasks_total) * 100)
    : 0;
  const emailList = [member.email, ...(member.emails ?? [])]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
  const phoneList = [member.phone, ...(member.phones ?? [])]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('supervisorDashboard.teamMemberTitle')}</Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() =>
            navigation.navigate('SupervisorEditTeamMember', {
              technicianId: member.id,
              member,
            })
          }
        >
          <Ionicons name="create-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            {member.profile_picture_url ? (
              <Image
                source={{ uri: member.profile_picture_url }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>
                  {(member.name || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.name}>{member.name}</Text>
          <Text style={styles.employeeId}>{member.employee_id}</Text>
          <View style={[
            styles.statusPill,
            { backgroundColor: isActive ? COLORS.success + '22' : COLORS.warning + '22' }
          ]}>
            <View style={[styles.statusDot, { backgroundColor: isActive ? COLORS.success : COLORS.warning }]} />
            <Text style={[styles.statusLabel, { color: isActive ? COLORS.success : COLORS.warning }]}>
              {member.status || '—'}
            </Text>
          </View>
        </View>

        {/* Current activity */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="flash-outline" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>{t('supervisorDashboard.currentActivity')}</Text>
          </View>
          <Text style={styles.activityText}>{member.current_activity || '—'}</Text>
        </View>

        {/* Tasks */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="checkbox-outline" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>{t('supervisorDashboard.tasks')}</Text>
          </View>
          <View style={styles.tasksRow}>
            <Text style={styles.tasksDisplay}>{member.tasks_display || '0/0'}</Text>
            <Text style={styles.tasksLabel}>
              {t('supervisorDashboard.tasksCompletedOfTotal', { completed: member.tasks_completed, total: member.tasks_total })}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${taskPercent}%` }
              ]}
            />
          </View>
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="call-outline" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>{t('supervisorDashboard.contact')}</Text>
          </View>
          {(emailList.length > 0 || phoneList.length > 0) ? (
            <Text style={styles.contactSectionTitle}>Primary</Text>
          ) : null}
          {emailList[0] ? (
            <TouchableOpacity
              key={`email-primary-${emailList[0]}`}
              style={styles.contactRow}
              onPress={() => Linking.openURL(`mailto:${emailList[0]}`).catch(() => Alert.alert(t('common.error'), t('supervisorDashboard.couldNotOpenEmail')))}
              activeOpacity={0.7}
            >
              <Ionicons name="mail-outline" size={22} color={COLORS.textSecondary} />
              <Text style={styles.contactValue}>{emailList[0]}</Text>
              <Ionicons name="open-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          ) : null}
          {phoneList[0] ? (
            <TouchableOpacity
              key={`phone-primary-${phoneList[0]}`}
              style={styles.contactRow}
              onPress={() => Linking.openURL(`tel:${phoneList[0].replace(/\s/g, '')}`).catch(() => Alert.alert(t('common.error'), t('supervisorDashboard.couldNotOpenPhone')))}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={22} color={COLORS.textSecondary} />
              <Text style={styles.contactValue}>{phoneList[0]}</Text>
              <Ionicons name="open-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          ) : null}
          {emailList.slice(1).length > 0 || phoneList.slice(1).length > 0 ? (
            <>
              <Text style={styles.contactSectionTitle}>Additional</Text>
              <View style={styles.additionalWrap}>
                {emailList.slice(1).map((email) => (
                  <TouchableOpacity
                    key={`email-${email}`}
                    style={styles.additionalChip}
                    onPress={() => Linking.openURL(`mailto:${email}`).catch(() => Alert.alert(t('common.error'), t('supervisorDashboard.couldNotOpenEmail')))}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="mail-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.additionalChipText} numberOfLines={1}>{email}</Text>
                    <Ionicons name="open-outline" size={14} color={COLORS.primary} />
                  </TouchableOpacity>
                ))}
                {phoneList.slice(1).map((phone) => (
                  <TouchableOpacity
                    key={`phone-${phone}`}
                    style={styles.additionalChip}
                    onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => Alert.alert(t('common.error'), t('supervisorDashboard.couldNotOpenPhone')))}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="call-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.additionalChipText} numberOfLines={1}>{phone}</Text>
                    <Ionicons name="open-outline" size={14} color={COLORS.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}
          {emailList.length === 0 && phoneList.length === 0 && (
            <Text style={styles.contactEmpty}>{t('supervisorDashboard.noContactInfo')}</Text>
          )}
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
  editBtn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xs,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
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
  avatarWrap: {
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  name: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  employeeId: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    gap: SPACING.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
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
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  tasksRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  tasksDisplay: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.primary,
  },
  tasksLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactSectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  contactValue: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  additionalWrap: {
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  additionalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '10',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  additionalChipText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  contactEmpty: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
});

export default SupervisorTeamMemberDetailScreen;
