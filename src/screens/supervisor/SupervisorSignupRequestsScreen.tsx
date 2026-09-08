import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Header from '../../components/common/Header';
import SupervisorTechnicianSignupRequestCard from '../../components/supervisor/SupervisorTechnicianSignupRequestCard';
import { COLORS, SPACING } from '../../constants';
import { useSupervisorTechnicianSignupRequests } from '../../hooks/useSupervisorTechnicianSignupRequests';
import type { SupervisorTechnicianSignupRequest } from '../../services/supervisorService';

const SupervisorSignupRequestsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { requests, loading, actioningId, loadRequests, onApprove, onReject } =
    useSupervisorTechnicianSignupRequests();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: SupervisorTechnicianSignupRequest }) => (
    <SupervisorTechnicianSignupRequestCard
      item={item}
      isActioning={actioningId === item.id}
      onApprove={onApprove}
      onReject={onReject}
    />
  );

  return (
    <View style={styles.container}>
      <Header
        title={t('supervisorSignupRequests.title')}
        showBack
        onBackPress={() => navigation.goBack()}
      />
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="mail-open-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>{t('supervisorSignupRequests.empty')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  empty: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyText: { marginTop: SPACING.md, fontSize: 16, color: COLORS.textSecondary },
});

export default SupervisorSignupRequestsScreen;
