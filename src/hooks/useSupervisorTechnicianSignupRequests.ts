import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  approveSupervisorTechnicianSignupRequest,
  getSupervisorTechnicianSignupRequests,
  rejectSupervisorTechnicianSignupRequest,
  SupervisorTechnicianSignupRequest,
} from '../services/supervisorService';

export function useSupervisorTechnicianSignupRequests() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<SupervisorTechnicianSignupRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actioningId, setActioningId] = useState<number | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getSupervisorTechnicianSignupRequests();
      setRequests(list);
      return list;
    } catch {
      setRequests([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const onApprove = useCallback(
    (item: SupervisorTechnicianSignupRequest) => {
      Alert.alert(
        t('supervisorSignupRequests.approveTitle'),
        t('supervisorSignupRequests.approveMessage', { name: item.name }),
        [
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: t('supervisorSignupRequests.approve'),
            onPress: async () => {
              setActioningId(item.id);
              try {
                const res = await approveSupervisorTechnicianSignupRequest(item.id);
                if (!res.success) {
                  throw new Error(res.message || t('supervisorSignupRequests.approveFailed'));
                }
                setRequests((prev) => prev.filter((row) => row.id !== item.id));
                Alert.alert(
                  t('common.success', { defaultValue: 'Success' }),
                  t('supervisorSignupRequests.approvedSuccess')
                );
              } catch (err: unknown) {
                const message =
                  (err as { response?: { data?: { message?: string } }; message?: string })?.response
                    ?.data?.message ||
                  (err instanceof Error ? err.message : '') ||
                  t('supervisorSignupRequests.approveFailed');
                Alert.alert(t('common.error', { defaultValue: 'Error' }), message);
              } finally {
                setActioningId(null);
              }
            },
          },
        ]
      );
    },
    [t]
  );

  const onReject = useCallback(
    (item: SupervisorTechnicianSignupRequest) => {
      Alert.alert(
        t('supervisorSignupRequests.rejectTitle'),
        t('supervisorSignupRequests.rejectMessage', { name: item.name }),
        [
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: t('supervisorSignupRequests.reject'),
            style: 'destructive',
            onPress: async () => {
              setActioningId(item.id);
              try {
                const res = await rejectSupervisorTechnicianSignupRequest(item.id);
                if (!res.success) {
                  throw new Error(res.message || t('supervisorSignupRequests.rejectFailed'));
                }
                setRequests((prev) => prev.filter((row) => row.id !== item.id));
              } catch (err: unknown) {
                const message =
                  (err as { response?: { data?: { message?: string } }; message?: string })?.response
                    ?.data?.message ||
                  (err instanceof Error ? err.message : '') ||
                  t('supervisorSignupRequests.rejectFailed');
                Alert.alert(t('common.error', { defaultValue: 'Error' }), message);
              } finally {
                setActioningId(null);
              }
            },
          },
        ]
      );
    },
    [t]
  );

  return {
    requests,
    loading,
    actioningId,
    loadRequests,
    onApprove,
    onReject,
    setRequests,
  };
}
