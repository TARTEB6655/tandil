import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { adminService, AdminUser } from '../../services/adminService';

const ROLE_KEYS: Record<string, string> = {
  technician: 'admin.users.roleFieldWorker',
  worker: 'admin.users.roleFieldWorker',
  supervisor: 'admin.users.roleSupervisor',
  team_leader: 'admin.users.roleSupervisor',
  area_manager: 'admin.users.roleAreaManager',
  manager: 'admin.users.roleAreaManager',
  hr: 'admin.users.roleHrManager',
  client: 'admin.users.roleClient',
  customer: 'admin.users.roleClient',
  admin: 'admin.users.roleAdmin',
};

// Generate employee ID based on role and user ID
const generateEmployeeId = (role: string, userId: number): string => {
  const prefixMap: { [key: string]: string } = {
    'technician': 'EMP',
    'supervisor': 'SUP',
    'area_manager': 'AM',
    'hr': 'HR',
    'client': 'CLT',
    'admin': 'ADMIN',
  };
  const prefix = prefixMap[role] || 'USR';
  return `${prefix}-${userId.toString().padStart(4, '0')}`;
};

/** Normalize role from API (user.role or user.roles[0].name) for consistent filtering */
function getNormalizedRole(user: AdminUser): string {
  const raw = (user.role || user.roles?.[0]?.name || '').toString().trim();
  const lower = raw.toLowerCase();
  if (lower === 'area manager') return 'area_manager';
  if (lower === 'hr manager' || lower === 'hr_manager') return 'hr';
  const normalized = lower.replace(/\s+/g, '_');
  return normalized || '';
}

const UsersManagementScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userStats, setUserStats] = useState<{
    all_users: number;
    workers: number;
    supervisors: number;
    managers: number;
    clients?: number;
  } | null>(null);

  // Fetch user statistics (global counts from API; clients from API or 0)
  const fetchUserStatistics = useCallback(async () => {
    try {
      const response = await adminService.getUsersStatistics();
      if (response.success && response.data) {
        const data = response.data as { all_users: number; workers: number; supervisors: number; managers: number; clients?: number };
        setUserStats({
          ...data,
          clients: data.clients ?? 0,
        });
      }
    } catch (err: any) {
      console.error('Error fetching user statistics:', err);
    }
  }, []);

  // Map UI filter to API role param (backend may use different names)
  const getRoleParamForApi = useCallback((filter: string): string | undefined => {
    if (filter === 'all') return undefined;
    if (filter === 'worker') return 'technician';
    if (filter === 'supervisor') return 'supervisor';
    if (filter === 'client') return 'client';
    if (filter === 'manager') return undefined; // fetch all and filter client-side (area_manager + hr)
    return undefined;
  }, []);

  // Fetch users from API (optionally by role so the correct tab shows data)
  const fetchUsers = useCallback(async (roleFilter: string, showLoading = true) => {
    try {
      setError(null);
      if (showLoading) {
        setLoading(true);
      }
      const roleParam = getRoleParamForApi(roleFilter);
      let response = await adminService.getUsers({
        role: roleParam,
        per_page: 200,
        page: 1,
      });

      let usersArray: AdminUser[] = [];
      if (response && response.data) {
        if (Array.isArray(response.data)) {
          usersArray = response.data;
        } else if (response.data && typeof response.data === 'object' && 'data' in response.data && Array.isArray((response.data as { data: AdminUser[] }).data)) {
          usersArray = (response.data as { data: AdminUser[] }).data;
        }
      }

      // If we requested a specific role but got none, backend may use different role names — fetch all and filter client-side
      if (roleParam && usersArray.length === 0) {
        const allResponse = await adminService.getUsers({ per_page: 200, page: 1 });
        if (allResponse && allResponse.data) {
          const all = Array.isArray(allResponse.data)
            ? allResponse.data
            : (allResponse.data as { data?: AdminUser[] })?.data ?? [];
          usersArray = all.filter(u => {
            const r = getNormalizedRole(u);
            if (roleFilter === 'worker') return r === 'technician' || r === 'worker';
            if (roleFilter === 'supervisor') return r === 'supervisor' || r === 'team_leader';
            if (roleFilter === 'client') return r === 'client' || r === 'customer';
            return false;
          });
        }
      }

      setUsers(usersArray);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      const errorMessage = err.response?.data?.message || err.message || t('admin.users.loadFailed');
      setError(errorMessage);
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsInitialLoad(false);
    }
  }, [t, getRoleParamForApi]);

  useEffect(() => {
    fetchUsers(selectedFilter);
  }, [selectedFilter]);

  useEffect(() => {
    fetchUserStatistics();
  }, [fetchUserStatistics]);

  // Refresh users when screen comes into focus (e.g., after adding a user)
  useFocusEffect(
    useCallback(() => {
      if (!isInitialLoad && !loading) {
        fetchUsers(selectedFilter, false);
        fetchUserStatistics();
      }
    }, [isInitialLoad, loading, selectedFilter, fetchUsers, fetchUserStatistics])
  );

  // Filter by search and by role (role filter for manager tab: area_manager + hr; API may have already filtered others)
  const filteredUsers = users.filter(user => {
    const role = getNormalizedRole(user);
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      generateEmployeeId(role, user.id).toLowerCase().includes(searchQuery.toLowerCase());

    if (selectedFilter === 'all') return matchesSearch;
    if (selectedFilter === 'worker') return matchesSearch && (role === 'technician' || role === 'worker');
    if (selectedFilter === 'supervisor') return matchesSearch && (role === 'supervisor' || role === 'team_leader');
    if (selectedFilter === 'manager') return matchesSearch && (role === 'area_manager' || role === 'hr' || role === 'manager');
    if (selectedFilter === 'client') return matchesSearch && (role === 'client' || role === 'customer');
    return matchesSearch;
  });

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers(selectedFilter);
  };

  const handleMenuPress = (user: AdminUser) => {
    setSelectedUser(user);
    setShowMenu(true);
  };

  const handleEdit = () => {
    if (selectedUser) {
      setShowMenu(false);
      navigation.navigate('EditUser' as never, { user: selectedUser } as never);
    }
  };

  const handleDelete = () => {
    if (!selectedUser) return;
    Alert.alert(
      t('admin.users.deleteTitle'),
      t('admin.users.deleteMessage', { name: selectedUser.name }),
      [
        {
          text: t('admin.users.cancel'),
          style: 'cancel',
          onPress: () => setShowMenu(false),
        },
        {
          text: t('admin.users.delete'),
          style: 'destructive',
          onPress: async () => {
            setShowMenu(false);
            try {
              await adminService.deleteUser(selectedUser.id);
              Alert.alert(t('admin.users.success'), t('admin.users.deleteSuccess'));
              fetchUsers(selectedFilter, false);
            } catch (err: any) {
              console.error('Error deleting user:', err);
              const errorMessage =
                err.response?.data?.message || err.message || t('admin.users.deleteFailed');
              Alert.alert(t('admin.users.error'), errorMessage);
            }
          },
        },
      ]
    );
  };

  const renderUser = ({ item }: { item: AdminUser }) => {
    const employeeId = generateEmployeeId(getNormalizedRole(item), item.id);
    const normalizedRole = getNormalizedRole(item);
    const roleDisplayName = t(ROLE_KEYS[normalizedRole] || normalizedRole || item.role);
    const avatarInitial = item.name.charAt(0).toUpperCase();

    return (
      <TouchableOpacity style={styles.userCard}>
        <View style={styles.userAvatar}>
          <Text style={styles.avatarText}>{avatarInitial}</Text>
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={styles.userMeta}>
            <Text style={styles.employeeId}>{employeeId}</Text>
            <Text style={styles.separator}>•</Text>
            <Text style={styles.userRole}>{roleDisplayName}</Text>
          </View>
        </View>

        <View style={styles.userActions}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: item.status === 'active' ? COLORS.success + '20' : COLORS.textSecondary + '20' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: item.status === 'active' ? COLORS.success : COLORS.textSecondary }
            ]}>
              {item.status}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.moreButton}
            onPress={() => handleMenuPress(item)}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStatsRow = () => (
    userStats ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statisticsContainer}
      >
        <TouchableOpacity
          style={[styles.statCard, selectedFilter === 'all' && styles.statCardActive]}
          onPress={() => setSelectedFilter('all')}
        >
          <Text numberOfLines={1} style={[styles.statLabel, selectedFilter === 'all' && styles.statLabelActive]}>{t('admin.users.allUsers')}</Text>
          <Text style={[styles.statValue, selectedFilter === 'all' && styles.statValueActive]}>{userStats.all_users.toLocaleString('en-US')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, selectedFilter === 'worker' && styles.statCardActive]}
          onPress={() => setSelectedFilter('worker')}
        >
          <Text numberOfLines={1} style={[styles.statLabel, selectedFilter === 'worker' && styles.statLabelActive]}>{t('admin.users.workers')}</Text>
          <Text style={[styles.statValue, selectedFilter === 'worker' && styles.statValueActive]}>{userStats.workers.toLocaleString('en-US')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, selectedFilter === 'supervisor' && styles.statCardActive]}
          onPress={() => setSelectedFilter('supervisor')}
        >
          <Text numberOfLines={1} style={[styles.statLabel, selectedFilter === 'supervisor' && styles.statLabelActive]}>{t('admin.users.supervisors')}</Text>
          <Text style={[styles.statValue, selectedFilter === 'supervisor' && styles.statValueActive]}>{userStats.supervisors.toLocaleString('en-US')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, selectedFilter === 'manager' && styles.statCardActive]}
          onPress={() => setSelectedFilter('manager')}
        >
          <Text numberOfLines={1} style={[styles.statLabel, selectedFilter === 'manager' && styles.statLabelActive]}>{t('admin.users.managers')}</Text>
          <Text style={[styles.statValue, selectedFilter === 'manager' && styles.statValueActive]}>{userStats.managers.toLocaleString('en-US')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, selectedFilter === 'client' && styles.statCardActive]}
          onPress={() => setSelectedFilter('client')}
        >
          <Text numberOfLines={1} style={[styles.statLabel, selectedFilter === 'client' && styles.statLabelActive]}>{t('admin.users.clients')}</Text>
          <Text style={[styles.statValue, selectedFilter === 'client' && styles.statValueActive]}>{(userStats.clients ?? 0).toLocaleString('en-US')}</Text>
        </TouchableOpacity>
      </ScrollView>
    ) : null
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('admin.users.title')}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddUser' as never)}
        >
          <Ionicons name="person-add" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('admin.users.searchPlaceholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* Users List: single ScrollView so tabs and list are one flow = no gap */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('admin.users.loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchUsers(selectedFilter)}>
            <Text style={styles.retryButtonText}>{t('admin.users.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
        >
          {renderStatsRow()}
          <View style={styles.listContent}>
            {filteredUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>{t('admin.users.noUsers')}</Text>
              </View>
            ) : (
              filteredUsers.map((item) => (
                <View key={item.id.toString()}>{renderUser({ item })}</View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* Action Menu Modal */}
      <Modal
        transparent
        visible={showMenu}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer} onStartShouldSetResponder={() => true}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleEdit}
            >
              <Ionicons name="create-outline" size={20} color={COLORS.primary} />
              <Text style={styles.menuItemText}>{t('admin.users.edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>{t('admin.users.delete')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  addButton: {
    padding: SPACING.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  filtersContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    maxHeight: 50,
  },
  filterChip: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.sm,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  filterTextActive: {
    color: COLORS.background,
  },
  list: {
    flex: 1,
  },
  listScrollContent: {
    paddingBottom: SPACING.sm,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  userAvatar: {
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
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeeId: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  separator: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginHorizontal: SPACING.xs,
  },
  userRole: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  userActions: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    textTransform: 'capitalize',
  },
  moreButton: {
    padding: SPACING.xs,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  loadingText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
    paddingHorizontal: SPACING.lg,
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  retryButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  menuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  menuItemText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.medium,
  },
  menuItemTextDanger: {
    color: COLORS.error,
  },
  statisticsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    marginBottom: 0,
    gap: SPACING.xs,
  },
  statCard: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
    marginBottom: 2,
    textAlign: 'center',
  },
  statLabelActive: {
    color: COLORS.background,
  },
  statValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  statValueActive: {
    color: COLORS.background,
  },
});

export default UsersManagementScreen;

