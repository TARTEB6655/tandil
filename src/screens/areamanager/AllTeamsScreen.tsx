import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { getAreaManagerTeamLeaders, AreaManagerTeamLeader } from '../../services/areaManagerService';

const AllTeamsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [teamLeaders, setTeamLeaders] = useState<AreaManagerTeamLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      getAreaManagerTeamLeaders()
        .then((list) => {
          if (!cancelled) {
            setTeamLeaders(Array.isArray(list) ? list : []);
          }
        })
        .catch(() => {
          if (!cancelled) setError(t('admin.areaManagerAllTeams.failedToLoad'));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [t])
  );

  const renderTeam = ({ item }: { item: AreaManagerTeamLeader }) => (
    <TouchableOpacity
      style={styles.teamCard}
      activeOpacity={0.7}
      onPress={() =>
        navigation.navigate('SupervisorTeamMembers', {
          teamLeaderId: item.id,
          supervisorId: item.employee_id,
          supervisorName: item.name,
          location: item.location ?? '',
        })
      }
    >
      <View style={styles.teamHeader}>
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
        <View style={{ flex: 1 }}>
          <Text style={styles.teamLead}>{item.name}</Text>
          <Text style={styles.teamMeta}>{item.employee_id} • {item.location || '—'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </View>
      <View style={styles.metricsRow}>
        <View style={styles.metricChip}>
          <Ionicons name="people-outline" size={16} color={COLORS.primary} />
          <Text style={styles.metricText}>{t('admin.areaManagerAllTeams.teamCount', { count: item.team })}</Text>
        </View>
        <View style={styles.metricChip}>
          <Ionicons name="flash-outline" size={16} color={COLORS.warning} />
          <Text style={styles.metricText}>{t('admin.areaManagerAllTeams.activeCount', { count: item.active })}</Text>
        </View>
        <View style={styles.metricChip}>
          <Ionicons name="checkmark-done-outline" size={16} color={COLORS.success} />
          <Text style={styles.metricText}>{t('admin.areaManagerAllTeams.doneCount', { count: item.done })}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading && teamLeaders.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('admin.areaManagerAllTeams.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('admin.areaManagerAllTeams.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && teamLeaders.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('admin.areaManagerAllTeams.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.areaManagerAllTeams.title')}</Text>
        <View style={{ width: 24 }} />
      </View>
      <FlatList
        data={teamLeaders}
        renderItem={renderTeam}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.sm }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  backBtn: { padding: SPACING.xs },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHTS.bold, color: COLORS.text },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  loadingText: { marginTop: SPACING.md, fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  errorText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, textAlign: 'center' },
  teamCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md },
  teamHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md, overflow: 'hidden' },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  avatarText: { color: COLORS.background, fontWeight: FONT_WEIGHTS.bold, fontSize: FONT_SIZES.md },
  teamLead: { color: COLORS.text, fontWeight: FONT_WEIGHTS.medium },
  teamMeta: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricChip: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  metricText: { color: COLORS.text },
});

export default AllTeamsScreen;












