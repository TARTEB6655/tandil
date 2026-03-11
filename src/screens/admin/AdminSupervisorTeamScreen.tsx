import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { adminService, type AdminSupervisor, type AdminTechnician } from '../../services/adminService';

type SupervisorTeamMember = {
  id: number;
  name: string;
  email: string;
  employee_id: string;
  service_areas: string[];
  specializations: string[];
  assigned_zones: { id: number; name: string }[];
};

type SupervisorDetail = {
  id: number;
  name: string;
  email: string;
  employee_id: string;
  assigned_zones: { id: number; name: string }[];
};

const AdminSupervisorTeamScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const supervisorParam = route.params?.supervisor as AdminSupervisor | undefined;
  const supervisorId = supervisorParam && typeof (supervisorParam as any).id === 'number'
    ? (supervisorParam as AdminSupervisor).id
    : null;

  const [supervisor, setSupervisor] = useState<SupervisorDetail | null>(null);
  const [team, setTeam] = useState<SupervisorTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [allTechnicians, setAllTechnicians] = useState<AdminTechnician[]>([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [addingTechnicianId, setAddingTechnicianId] = useState<number | null>(null);

  const fetchTeam = useCallback(async (isRefresh = false) => {
    if (supervisorId == null) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await adminService.getSupervisorTeam(supervisorId);
      const data = res.data;
      if (data?.supervisor) setSupervisor(data.supervisor);
      if (Array.isArray(data?.team)) setTeam(data.team);
      else setTeam([]);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? t('admin.supervisorTeam.failedToLoadTeam'));
      setTeam([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supervisorId, t]);

  useFocusEffect(
    useCallback(() => {
      if (supervisorId != null) fetchTeam();
    }, [supervisorId, fetchTeam])
  );

  const onRefresh = useCallback(() => fetchTeam(true), [fetchTeam]);

  const loadTechniciansForModal = useCallback(async () => {
    setLoadingTechnicians(true);
    try {
      const res = await adminService.getTechnicians({ per_page: 100 });
      setAllTechnicians(res.data ?? []);
    } catch {
      setAllTechnicians([]);
    } finally {
      setLoadingTechnicians(false);
    }
  }, []);

  useEffect(() => {
    if (assignModalVisible && allTechnicians.length === 0) loadTechniciansForModal();
  }, [assignModalVisible, allTechnicians.length, loadTechniciansForModal]);

  const techniciansNotInTeam = allTechnicians.filter(
    (tech) => !team.some((t) => t.id === tech.id)
  );

  const addToTeam = async (tech: AdminTechnician) => {
    if (supervisorId == null) return;
    setAddingTechnicianId(tech.id);
    try {
      await adminService.addSupervisorTeamMember(supervisorId, tech.id);
      setTeam((prev) => [
        ...prev,
        {
          id: tech.id,
          name: tech.name,
          email: tech.email,
          employee_id: tech.employee_id,
          service_areas: tech.service_areas ?? [],
          specializations: tech.specializations ?? [],
          assigned_zones: tech.zone ? [tech.zone] : [],
        },
      ]);
      setAssignModalVisible(false);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? t('admin.supervisorTeam.failedToAddTechnician');
      Alert.alert(t('admin.supervisorTeam.error'), msg);
    } finally {
      setAddingTechnicianId(null);
    }
  };

  const removeFromTeam = (tech: SupervisorTeamMember) => {
    if (supervisorId == null) return;
    Alert.alert(
      t('admin.supervisorTeam.removeFromTeamTitle'),
      t('admin.supervisorTeam.removeFromTeamMessage'),
      [
        { text: t('admin.zones.cancel'), style: 'cancel' },
        {
          text: t('admin.supervisorTeam.remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await adminService.removeSupervisorTeamMember(supervisorId, tech.id);
              setTeam((prev) => prev.filter((tm) => tm.id !== tech.id));
            } catch (e: any) {
              const msg = e?.response?.data?.message ?? e?.message ?? t('admin.supervisorTeam.failedToRemoveTechnician');
              Alert.alert(t('admin.supervisorTeam.error'), msg);
            }
          },
        },
      ]
    );
  };

  if (!supervisorParam) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.errorText}>{t('admin.supervisorTeam.noSupervisorSelected')}</Text>
      </View>
    );
  }

  const displaySupervisor = supervisor ?? {
    id: (supervisorParam as AdminSupervisor).id,
    name: supervisorParam.name,
    email: (supervisorParam as AdminSupervisor).email ?? '',
    employee_id: (supervisorParam as AdminSupervisor).employee_id ?? '',
    assigned_zones: (supervisorParam as AdminSupervisor).assigned_zones ?? [],
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.supervisorTeam.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={24} color={COLORS.error} />
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchTeam()}>
            <Text style={styles.retryBtnText}>{t('admin.supervisorTeam.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.supervisorCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displaySupervisor.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.supervisorInfo}>
          <Text style={styles.supervisorName}>{displaySupervisor.name}</Text>
          <Text style={styles.supervisorId}>{displaySupervisor.employee_id}</Text>
          {displaySupervisor.assigned_zones?.length > 0 && (
            <Text style={styles.supervisorZones}>
              {displaySupervisor.assigned_zones.map((z) => z.name).join(', ')}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('admin.supervisorTeam.techniciansInTeam')}</Text>
        <TouchableOpacity
          style={styles.assignButton}
          onPress={() => setAssignModalVisible(true)}
        >
          <Ionicons name="person-add" size={20} color={COLORS.primary} />
          <Text style={styles.assignButtonText}>{t('admin.supervisorTeam.assignTechnicians')}</Text>
        </TouchableOpacity>
      </View>

      {loading && team.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('admin.supervisorTeam.loadingTeam')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
        >
          {team.length === 0 ? (
            <Text style={styles.emptyText}>{t('admin.supervisorTeam.noTechniciansAssigned')}</Text>
          ) : (
            team.map((tech) => (
              <View key={tech.id} style={styles.techRow}>
                <View style={styles.techAvatar}>
                  <Text style={styles.techAvatarText}>{tech.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.techInfo}>
                  <Text style={styles.techName}>{tech.name}</Text>
                  <Text style={styles.techId}>{tech.employee_id}</Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeFromTeam(tech)}
                >
                  <Ionicons name="close-circle-outline" size={24} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={assignModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('admin.supervisorTeam.modalTitle')}</Text>
              <TouchableOpacity onPress={() => setAssignModalVisible(false)}>
                <Ionicons name="close" size={28} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {loadingTechnicians ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.modalLoadingText}>{t('admin.supervisorTeam.loadingTechnicians')}</Text>
              </View>
            ) : (
              <FlatList
                data={techniciansNotInTeam}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => {
                  const isAdding = addingTechnicianId === item.id;
                  return (
                    <TouchableOpacity
                      style={[styles.modalRow, isAdding && styles.modalRowDisabled]}
                      onPress={() => addToTeam(item)}
                      disabled={isAdding}
                    >
                      <View style={styles.modalRowContent}>
                        <View style={styles.modalRowTop}>
                          <Text style={styles.modalRowName}>{item.name}</Text>
                          {isAdding ? (
                            <ActivityIndicator size="small" color={COLORS.primary} />
                          ) : (
                            <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
                          )}
                        </View>
                      <Text style={styles.modalRowId}>{item.employee_id}</Text>
                      <View style={styles.modalRowMeta}>
                        <View style={styles.modalRowMetaItem}>
                          <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
                          <Text style={styles.modalRowMetaText}>
                            {item.zone?.name ?? (item.service_areas?.length ? item.service_areas.join(', ') : '—')}
                          </Text>
                        </View>
                        <View style={styles.modalRowMetaItem}>
                          <Ionicons name="person-outline" size={12} color={COLORS.textSecondary} />
                          <Text style={styles.modalRowMetaText}>
                            {item.supervisor?.name ?? '—'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <Text style={styles.modalEmpty}>{t('admin.supervisorTeam.allTechniciansInTeam')}</Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>
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
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  errorText: {
    padding: SPACING.lg,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  errorBox: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: COLORS.error + '15',
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error + '40',
  },
  errorMsg: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  retryBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: '#fff',
  },
  supervisorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
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
  supervisorInfo: {
    flex: 1,
  },
  supervisorName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  supervisorId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginTop: 2,
  },
  supervisorZones: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  assignButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  techAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '40',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  techAvatarText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  techInfo: {
    flex: 1,
  },
  techName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  techId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  removeButton: {
    padding: SPACING.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  modalLoading: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  modalLoadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  modalRow: {
    padding: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalRowDisabled: {
    opacity: 0.6,
  },
  modalRowContent: {
    flex: 1,
  },
  modalRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalRowName: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  modalRowId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginTop: 2,
  },
  modalRowMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  modalRowMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalRowMetaText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  modalEmpty: {
    padding: SPACING.lg,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default AdminSupervisorTeamScreen;
