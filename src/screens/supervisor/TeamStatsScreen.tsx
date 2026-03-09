import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  getSupervisorTeamStats,
  SupervisorTeamStatsData,
  SupervisorTeamStatsMember,
} from '../../services/supervisorService';

const STAT_CONFIG = [
  { id: 's-1', label: 'Visits Today', key: 'visits_today' as const, icon: 'calendar-outline', color: COLORS.primary },
  { id: 's-2', label: 'Avg Duration', key: 'avg_duration_minutes' as const, icon: 'time-outline', color: COLORS.warning },
  { id: 's-3', label: 'Customer Rating', key: 'customer_rating' as const, icon: 'star-outline', color: COLORS.success },
  { id: 's-4', label: 'Open Issues', key: 'open_issues' as const, icon: 'alert-circle-outline', color: COLORS.error },
];

function formatStatValue(key: keyof SupervisorTeamStatsData, data: SupervisorTeamStatsData): string | number {
  switch (key) {
    case 'avg_duration_minutes':
      return `${data.avg_duration_minutes}m`;
    case 'customer_rating':
      return data.customer_rating === 0 ? '0' : data.customer_rating.toFixed(1);
    default:
      return (data as Record<string, number>)[key] ?? 0;
  }
}

const TeamStatsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [data, setData] = useState<SupervisorTeamStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      getSupervisorTeamStats()
        .then((res) => {
          if (!cancelled) {
            setData(res ?? null);
            setError(res ? null : 'Failed to load team stats.');
          }
        })
        .catch(() => {
          if (!cancelled) setError('Failed to load team stats.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [])
  );

  const renderMember = ({ item }: { item: SupervisorTeamStatsMember }) => (
    <TouchableOpacity
      style={styles.memberRow}
      activeOpacity={0.7}
      onPress={() =>
        navigation.navigate('TeamMemberProgress', {
          memberId: item.id,
          name: item.name,
          initial: item.initial || item.name.charAt(0),
          completed: item.completed,
          rating: item.rating,
        })
      }
    >
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>{item.initial || item.name.charAt(0)}</Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.name}</Text>
        <Text style={styles.memberMeta}>Completed: {item.completed} • Rating: {item.rating === 0 ? '0' : item.rating.toFixed(1)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Team Stats</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Team Stats</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statsData = data ?? {
    visits_today: 0,
    avg_duration_minutes: 0,
    customer_rating: 0,
    open_issues: 0,
    members: [],
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Stats</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        ListHeaderComponent={
          <>
            <View style={styles.statsGrid}>
              {STAT_CONFIG.map((s) => (
                <View key={s.id} style={styles.gridItem}>
                  <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: s.color + '20' }]}>
                      <Ionicons name={s.icon as any} size={20} color={s.color} />
                    </View>
                    <Text style={styles.statValue}>{formatStatValue(s.key, statsData)}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.sectionTitle}>Members</Text>
          </>
        }
        data={statsData.members}
        renderItem={renderMember}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  backBtn: { padding: SPACING.xs },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  loadingText: { marginTop: SPACING.md, fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  errorText: { fontSize: FONT_SIZES.md, color: COLORS.error, textAlign: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  gridItem: { width: '48%' },
  statCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  statValue: { fontSize: FONT_SIZES.xl, color: COLORS.text, fontWeight: FONT_WEIGHTS.bold },
  statLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  sectionTitle: { color: COLORS.textSecondary, marginVertical: SPACING.sm },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary + '10', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm },
  memberAvatarText: { color: COLORS.primary, fontWeight: FONT_WEIGHTS.bold },
  memberInfo: { flex: 1 },
  memberName: { color: COLORS.text, fontWeight: FONT_WEIGHTS.medium },
  memberMeta: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
});

export default TeamStatsScreen;












