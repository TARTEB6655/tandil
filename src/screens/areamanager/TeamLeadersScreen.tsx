import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import {
  getAreaManagerTeamLeaders,
  AreaManagerTeamLeader,
} from '../../services/areaManagerService';

const TeamLeadersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [teamLeaders, setTeamLeaders] = useState<AreaManagerTeamLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await getAreaManagerTeamLeaders();
      setTeamLeaders(Array.isArray(data) ? data : []);
    } catch {
      setTeamLeaders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const renderItem = ({ item }: { item: AreaManagerTeamLeader }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('TeamLeaderDetail', { teamLeaderId: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          {item.profile_picture_url ? (
            <Image
              source={{ uri: item.profile_picture_url }}
              style={styles.avatarImage}
              contentFit="cover"
            />
          ) : (
            <Text style={styles.avatarText}>{item.initial || item.name.charAt(0)}</Text>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.employeeId}>{item.employee_id}</Text>
          {item.location ? (
            <Text style={styles.location} numberOfLines={1}>{item.location}</Text>
          ) : null}
        </View>
        <View style={styles.performanceBadge}>
          <Text style={styles.performanceText}>{item.performance_percent}%</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Team</Text>
          <Text style={styles.statValue}>{item.team}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Active</Text>
          <Text style={styles.statValue}>{item.active}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Done</Text>
          <Text style={styles.statValue}>{item.done}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading && teamLeaders.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Team Leaders</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Leaders</Text>
        <View style={styles.headerSpacer} />
      </View>
      <FlatList
        data={teamLeaders}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No team leaders yet.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />
        }
      />
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
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  info: { flex: 1 },
  name: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  employeeId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
  },
  location: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  performanceBadge: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  performanceText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statItem: { alignItems: 'center' },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
});

export default TeamLeadersScreen;
