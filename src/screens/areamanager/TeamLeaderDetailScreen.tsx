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
import {
  getAreaManagerTeamLeaderDetail,
  AreaManagerTeamLeaderDetail,
} from '../../services/areaManagerService';

const TeamLeaderDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const teamLeaderId = (route.params as { teamLeaderId?: number })?.teamLeaderId;

  const [leader, setLeader] = useState<AreaManagerTeamLeaderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (teamLeaderId == null) {
        setError('No team leader selected.');
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      setError(null);
      getAreaManagerTeamLeaderDetail(teamLeaderId)
        .then((data) => {
          if (!cancelled) {
            setLeader(data ?? null);
            setError(data ? null : 'Failed to load team leader.');
          }
        })
        .catch(() => {
          if (!cancelled) setError('Failed to load team leader.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [teamLeaderId])
  );

  const openEmail = () => {
    const email = leader?.email?.trim();
    if (!email) return;
    Linking.openURL(`mailto:${email}`).catch(() =>
      Alert.alert('Error', 'Could not open email.')
    );
  };

  const openPhone = () => {
    const phone = leader?.phone?.trim();
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() =>
      Alert.alert('Error', 'Could not open phone.')
    );
  };

  if (teamLeaderId == null) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Team Leader</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>No team leader selected.</Text>
        </View>
      </View>
    );
  }

  if (loading && !leader) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Team Leader</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </View>
    );
  }

  if (error && !leader) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Team Leader</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  const displayName = leader!.name ?? '—';
  const initial = (leader!.initial || displayName.charAt(0)).toUpperCase();
  const profileUrl = leader!.profile_picture_url ?? null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Leader</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          {profileUrl ? (
            <Image
              source={{ uri: profileUrl }}
              style={styles.heroAvatar}
              contentFit="cover"
            />
          ) : (
            <View style={styles.heroAvatarPlaceholder}>
              <Text style={styles.heroAvatarText}>{initial}</Text>
            </View>
          )}
          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroEmployeeId}>{leader!.employee_id}</Text>
          {leader!.location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.heroLocation}>{leader!.location}</Text>
            </View>
          ) : null}
        </View>

        {/* Performance */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Performance</Text>
          <View style={styles.performanceRow}>
            <Text style={styles.performanceValue}>{leader!.performance_percent}%</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(leader!.performance_percent, 100)}%` },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="people-outline" size={28} color={COLORS.primary} />
            <Text style={styles.statCardValue}>{leader!.team}</Text>
            <Text style={styles.statCardLabel}>Team</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="flash-outline" size={28} color={COLORS.warning} />
            <Text style={styles.statCardValue}>{leader!.active}</Text>
            <Text style={styles.statCardLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={28} color={COLORS.success} />
            <Text style={styles.statCardValue}>{leader!.done}</Text>
            <Text style={styles.statCardLabel}>Done</Text>
          </View>
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact</Text>
          {leader!.email ? (
            <TouchableOpacity style={styles.contactRow} onPress={openEmail} activeOpacity={0.7}>
              <Ionicons name="mail-outline" size={22} color={COLORS.textSecondary} />
              <Text style={styles.contactValue}>{leader!.email}</Text>
              <Ionicons name="open-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          ) : null}
          {leader!.phone ? (
            <TouchableOpacity style={styles.contactRow} onPress={openPhone} activeOpacity={0.7}>
              <Ionicons name="call-outline" size={22} color={COLORS.textSecondary} />
              <Text style={styles.contactValue}>{leader!.phone}</Text>
              <Ionicons name="open-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          ) : null}
          {!leader!.email && !leader!.phone && (
            <Text style={styles.contactEmpty}>No contact info</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.xxl },
  hero: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.primary,
  },
  heroAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: SPACING.md,
  },
  heroAvatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  heroAvatarText: {
    fontSize: 36,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  heroName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
    marginBottom: SPACING.xs,
  },
  heroEmployeeId: {
    fontSize: FONT_SIZES.md,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: SPACING.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  heroLocation: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.9)',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  performanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  performanceValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    minWidth: 56,
  },
  progressTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 5,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statCardValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  statCardLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactValue: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  contactEmpty: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
});

export default TeamLeaderDetailScreen;
