import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { hrService, Employee } from '../../services/hrService';
import { useTranslation } from 'react-i18next';

export type RoleFilter = 'all' | 'supervisor' | 'technician';

function matchesRoleFilter(employee: Employee, filter: RoleFilter): boolean {
  if (filter === 'all') return true;
  const role = (employee.user?.role ?? '').toLowerCase();
  const designation = (employee.designation ?? '').toLowerCase();
  if (filter === 'supervisor') {
    return role === 'supervisor' || designation.includes('supervisor') || designation.includes('team leader');
  }
  if (filter === 'technician') {
    return (
      role === 'technician' ||
      designation.includes('technician') ||
      designation.includes('field worker') ||
      designation.includes('field technician') ||
      designation.includes('garden') ||
      designation.includes('maintenance') ||
      designation.includes('senior technician')
    );
  }
  return true;
}

// Format date for display
const formatDate = (dateString: string | null | undefined): string => {
  if (dateString == null || String(dateString).trim() === '') return '—';
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toISOString().split('T')[0];
  } catch {
    return '—';
  }
};

const PER_PAGE = 20;

const EmployeeListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const getRoleDisplayName = useCallback((designation: string | null | undefined): string => {
    const d = designation ?? '';
    const roleMap: { [key: string]: string } = {
      Technician: t('admin.hrEmployees.fieldWorker', 'Field Worker'),
      'Field Technician': t('admin.hrEmployees.fieldTechnician', 'Field Technician'),
      'Senior Technician': t('admin.hrEmployees.seniorTechnician', 'Senior Technician'),
      'Garden Technician': t('admin.hrEmployees.gardenTechnician', 'Garden Technician'),
      'Maintenance Technician': t('admin.hrEmployees.maintenanceTechnician', 'Maintenance Technician'),
      Supervisor: t('admin.hrEmployees.teamLeader', 'Team Leader'),
      'Area Manager': t('admin.hrEmployees.areaManager', 'Area Manager'),
      HR: t('admin.hrEmployees.hrStaff', 'HR Staff'),
    };
    return roleMap[d] || d || '—';
  }, [t]);

  type FetchMode = 'initial' | 'refresh' | 'loadMore';

  const fetchEmployees = useCallback(async (mode: FetchMode = 'initial') => {
    const isLoadMore = mode === 'loadMore';
    const isRefresh = mode === 'refresh';
    const nextPage = isLoadMore ? page + 1 : 1;
    if (isLoadMore && (loadingMore || nextPage > lastPage)) return;
    try {
      setError(null);
      if (mode === 'initial' || isRefresh) {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
      } else {
        setLoadingMore(true);
      }
      const response = await hrService.getEmployees({ page: nextPage, per_page: PER_PAGE });
      const list = response?.data;
      if (response && Array.isArray(list)) {
        if (isLoadMore) {
          setEmployees(prev => [...prev, ...list]);
          setPage(nextPage);
        } else {
          setEmployees(list);
          setPage(1);
        }
        setTotal(response.total ?? list.length);
        const meta = response.meta;
        if (meta) setLastPage(meta.last_page);
        else setLastPage(1);
      } else {
        if (!isLoadMore) {
          setEmployees([]);
          setError(String(t('admin.hrEmployees.invalidResponse', 'Invalid response format from server')));
        }
      }
    } catch (err: any) {
      console.error('Error fetching employees:', err);
      const errorMessage =
        err.response?.data?.message ?? err.message ?? t('admin.hrEmployees.failedToLoad', 'Failed to load employees');
      setError(String(errorMessage));
      if (!isLoadMore) setEmployees([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [page, lastPage, loadingMore]);

  useEffect(() => {
    fetchEmployees('initial');
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!loading && employees.length === 0 && !error) {
        fetchEmployees('refresh');
      }
    }, [loading, employees.length, error, fetchEmployees])
  );

  const onRefresh = () => {
    fetchEmployees('refresh');
  };

  const onEndReached = useCallback(() => {
    if (!loadingMore && page < lastPage && !loading && !error) {
      fetchEmployees('loadMore');
    }
  }, [loadingMore, page, lastPage, loading, error, fetchEmployees]);

  const handleMenuPress = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowMenu(true);
  };

  const handleEdit = () => {
    if (selectedEmployee) {
      setShowMenu(false);
      navigation.navigate('EditEmployee' as never, { employee: selectedEmployee } as never);
    }
  };

  const handleDelete = () => {
    if (!selectedEmployee) return;
    
    Alert.alert(
      t('admin.hrEmployees.deleteTitle', 'Delete Employee'),
      t('admin.hrEmployees.deleteConfirm', {
        name: selectedEmployee.name,
        defaultValue: `Are you sure you want to delete ${selectedEmployee.name}? This action cannot be undone.`,
      }),
      [
        {
          text: t('common.cancel', 'Cancel'),
          style: 'cancel',
          onPress: () => setShowMenu(false),
        },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            setShowMenu(false);
            try {
              await hrService.deleteEmployee(selectedEmployee.id);
              Alert.alert(
                t('admin.hrManagerDashboard.successTitle', 'Success'),
                t('admin.hrEmployees.deletedSuccess', 'Employee deleted successfully')
              );
              fetchEmployees('refresh');
            } catch (err: any) {
              console.error('Error deleting employee:', err);
              const errorMessage = 
                err.response?.data?.message || 
                err.message || 
                t('admin.hrEmployees.deleteFailed', 'Failed to delete employee. Please try again.');
              Alert.alert(t('common.error', 'Error'), errorMessage);
            }
          },
        },
      ]
    );
  };

  // Filter by role then by search query
  const filteredEmployees = employees.filter(employee => {
    if (!matchesRoleFilter(employee, roleFilter)) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const name = (employee.name ?? '').toString().toLowerCase();
    const email = (employee.email ?? '').toString().toLowerCase();
    const empId = (employee.employee_id ?? '').toString().toLowerCase();
    const role = getRoleDisplayName(employee.designation ?? '').toLowerCase();
    return name.includes(q) || email.includes(q) || empId.includes(q) || role.includes(q);
  });

  const renderEmployee = ({ item }: { item: Employee }) => {
    const name = item.name ?? '';
    const avatarInitial = (item.initial ?? name.charAt(0) ?? '?').toString().toUpperCase().slice(0, 1);
    const roleDisplayName = getRoleDisplayName(item.designation);
    const joiningDate = formatDate(item.joining_date ?? '');
    const status = (item.status ?? 'active').toString();
    const leaveDisplay = item.leave_remaining_days != null ? item.leave_remaining_days : (item.leave_balance ?? 0);

    return (
      <TouchableOpacity style={styles.employeeCard}>
        <View style={styles.employeeAvatar}>
          {item.profile_picture_url ? (
            <Image source={{ uri: item.profile_picture_url }} style={styles.employeeAvatarImage} />
          ) : (
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          )}
        </View>

        <View style={styles.employeeInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.employeeName} numberOfLines={2}>
              {name || '—'}
            </Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: status === 'active' ? COLORS.success + '20' : COLORS.warning + '20' }
            ]}>
              <Text style={[
                styles.statusText,
                { color: status === 'active' ? COLORS.success : COLORS.warning }
              ]}>
                {status === 'active'
                  ? t('admin.hrManagerDashboard.active', 'Active')
                  : t('admin.hrManagerDashboard.onLeave', 'On Leave')}
              </Text>
            </View>
          </View>
          <View style={styles.employeeMeta}>
            <Text style={styles.employeeId}>{item.employee_id ?? '—'}</Text>
            <Text style={styles.separator}>•</Text>
            <Text style={styles.employeeRole}>{roleDisplayName}</Text>
          </View>
          <View style={styles.bottomRow}>
            <Text style={styles.joiningDate}>
              {t('admin.hrManagerDashboard.joined', { date: joiningDate, defaultValue: `Joined: ${joiningDate}` })}
            </Text>
            <Text style={styles.leaveBalance}>
              {t('admin.hrManagerDashboard.leaveDays', {
                count: leaveDisplay,
                defaultValue: `Leave: ${leaveDisplay} days`,
              })}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.moreButton}
          onPress={() => handleMenuPress(item)}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={styles.container}
      // Android: bottom inset is handled by the tab bar — extra bottom safe area
      // creates a white gap above the menu and shrinks list space. iOS unchanged.
      edges={Platform.OS === 'android' ? ['top'] : ['top', 'bottom']}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t('admin.hrManagerDashboard.employeeDirectory', 'Employee Directory')}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('admin.hrEmployees.searchPlaceholder', 'Search employees...')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={COLORS.textSecondary}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Role filter: All | Supervisors | Technicians — fixed widths so labels never truncate */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.roleFilterRow}
        style={styles.roleFilterScroll}
      >
        <TouchableOpacity
          style={[
            styles.roleChip,
            roleFilter === 'all' && styles.roleChipSelected,
          ]}
          onPress={() => setRoleFilter('all')}
        >
          <Text style={[styles.roleChipText, roleFilter === 'all' && styles.roleChipTextSelected]}>
            {t('common.all', 'All')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.roleChip,
            roleFilter === 'supervisor' && styles.roleChipSelected,
          ]}
          onPress={() => setRoleFilter('supervisor')}
        >
          <Text style={[styles.roleChipText, roleFilter === 'supervisor' && styles.roleChipTextSelected]}>
            {t('admin.hrEmployees.supervisors', 'Supervisors')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.roleChip,
            roleFilter === 'technician' && styles.roleChipSelected,
          ]}
          onPress={() => setRoleFilter('technician')}
        >
          <Text style={[styles.roleChipText, roleFilter === 'technician' && styles.roleChipTextSelected]}>
            {t('admin.hrEmployees.technicians', 'Technicians')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Employees List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('admin.hrEmployees.loading', 'Loading employees...')}</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>{String(error)}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchEmployees('initial')}>
            <Text style={styles.retryButtonText}>{t('common.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredEmployees}
          renderItem={renderEmployee}
          keyExtractor={(item, index) => `emp-${item?.id ?? index}-${index}`}
          contentContainerStyle={[
            styles.listContent,
            filteredEmployees.length === 0 && { flex: 1 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {searchQuery
                  ? t('admin.hrEmployees.emptySearch', 'No employees found')
                  : t('admin.hrEmployees.emptyList', 'No employees yet')}
              </Text>
            </View>
          }
          ListFooterComponent={
            <>
              {loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.footerLoaderText}>{t('common.loadingMore', 'Loading more...')}</Text>
                </View>
              ) : null}
              {!loading && !loadingMore && total > 0 && (
                <Text style={styles.footerCount}>
                  {employees.length} of {total} employees
                </Text>
              )}
            </>
          }
        />
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
              <Text style={styles.menuItemText}>{t('common.edit', 'Edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>
                {t('common.delete', 'Delete')}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
    flexShrink: 0,
  },
  headerTitleWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: SPACING.sm,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  headerRight: {
    width: 40,
    flexShrink: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  roleFilterScroll: {
    flexGrow: 0,
    minHeight: 64,
  },
  roleFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
    alignItems: 'center',
    flexGrow: 0,
  },
  roleChip: {
    minWidth: 96,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    minHeight: 48,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  roleChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleChipText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHTS.medium,
    textAlign: 'center',
    paddingTop: 2,
    paddingBottom: 1,
  },
  roleChipTextSelected: {
    color: COLORS.background,
  },
  listContent: {
    padding: SPACING.lg,
  },
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  employeeAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    overflow: 'hidden',
  },
  employeeAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.background,
  },
  employeeInfo: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  employeeName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    flex: 1,
    minWidth: 0,
  },
  employeeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
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
  employeeRole: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  joiningDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: SPACING.sm,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: FONT_WEIGHTS.semiBold,
    textTransform: 'capitalize',
  },
  leaveBalance: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  moreButton: {
    padding: SPACING.xs,
    alignSelf: 'flex-start',
    marginTop: SPACING.xs,
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
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  footerLoaderText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  footerCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.xl,
  },
});

export default EmployeeListScreen;

