import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Button } from '../../components/common/Button';
import { submitTechnicianReport, getTechnicianTaskDetail, type TechnicianTaskDetail } from '../../services/technicianService';

const JobDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { jobId, orderId } = route.params ?? {};
  const visitId = jobId ?? orderId;

  const [detail, setDetail] = useState<TechnicianTaskDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [fieldNotes, setFieldNotes] = useState('');
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!visitId) {
      setLoadingDetail(false);
      setDetailError(t('technician.jobDetail.invalidJob'));
      return;
    }
    setLoadingDetail(true);
    setDetailError(null);
    getTechnicianTaskDetail(visitId)
      .then((data) => {
        setDetail(data ?? null);
        const notes = data?.technician_notes ?? data?.field_notes ?? '';
        if (notes) setFieldNotes(notes);
        const photos = data?.before_after_photos;
        if (photos) {
          const toUrls = (arr: Array<{ photo_url: string } | string> | undefined) =>
            (arr ?? []).map((p) => (typeof p === 'string' ? p : p.photo_url));
          setBeforePhotos(toUrls(photos.before));
          setAfterPhotos(toUrls(photos.after));
        }
      })
      .catch(() => {
        setDetail(null);
        setDetailError(t('technician.jobDetail.loadFailed'));
      })
      .finally(() => setLoadingDetail(false));
  }, [visitId, t]);

  const jobStatus = detail?.status ?? 'in_progress';
  const svc = detail?.service_information;
  const customer = detail?.customer_information;
  const address = detail?.service_address;
  const actions = detail?.actions ?? { can_submit_field_report: true, can_complete_visit: true, can_call_customer: true };
  const hasStartVisit = jobStatus === 'assigned';
  const hasSubmitReport = actions.can_submit_field_report && (jobStatus === 'in_progress' || jobStatus === 'accepted');
  const hasCompleteVisit = actions.can_complete_visit && (jobStatus === 'in_progress' || jobStatus === 'accepted');
  const hasCallCustomer = actions.can_call_customer;
  const hasAnyAction = jobStatus !== 'completed' && (hasStartVisit || hasSubmitReport || hasCompleteVisit || hasCallCustomer);

  const job = {
    id: detail?.job_id ?? visitId,
    jobNumber: detail?.job_number ?? `#${visitId}`,
    customerName: customer?.name ?? '—',
    customerPhone: customer?.phone ?? '—',
    customerEmail: customer?.email ?? '—',
    service: svc?.title ?? '—',
    serviceDescription: svc?.description ?? '',
    address: address?.address ?? '—',
    scheduledTime: svc?.time ?? '—',
    estimatedDuration:
      svc?.duration_minutes != null
        ? t('technician.jobDetail.durationMinutes', { count: svc.duration_minutes })
        : '—',
    specialInstructions: detail?.special_instructions ?? null,
    price: svc?.price,
    priceDisplay: svc?.price_display,
    status: jobStatus,
    date: detail?.date ?? '',
  };

  const handleStatusUpdate = (newStatus: string) => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      Alert.alert(
        t('technician.jobDetail.statusUpdatedTitle'),
        t('technician.jobDetail.statusUpdatedBody', { status: getStatusLabel(newStatus) })
      );
    }, 1000);
  };

  const handleCompleteJob = () => {
    Alert.alert(
      t('technician.jobDetail.completeJobTitle'),
      t('technician.jobDetail.completeJobConfirm'),
      [
        { text: t('technician.cancel'), style: 'cancel' },
        { text: t('technician.jobDetail.complete'), onPress: () => handleStatusUpdate('completed') },
      ]
    );
  };

  const handleCallCustomer = () => {
    if (job.customerPhone && job.customerPhone !== '—') {
      Linking.openURL(`tel:${job.customerPhone}`).catch(() =>
        Alert.alert(t('technician.error'), t('technician.jobDetail.callNotAvailable'))
      );
    } else {
      Alert.alert(t('technician.error'), t('technician.jobDetail.noPhone'));
    }
  };

  const handleMessageCustomer = () => {
    if (job.customerEmail && job.customerEmail !== '—') {
      Linking.openURL(`mailto:${job.customerEmail}`).catch(() =>
        Alert.alert(t('technician.error'), t('technician.jobDetail.emailNotAvailable'))
      );
    } else {
      Alert.alert(t('technician.error'), t('technician.jobDetail.noEmail'));
    }
  };

  const handleGetDirections = () => {
    if (address?.address && address.address !== '—') {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.address)}`;
      Linking.openURL(url).catch(() =>
        Alert.alert(t('technician.error'), t('technician.jobDetail.directionsNotAvailable'))
      );
    }
  };

  const handleUploadPhoto = async (kind: 'before' | 'after') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('technician.error'), t('technician.allowPhotos'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        if (kind === 'before') setBeforePhotos((prev) => [...prev, uri]);
        else setAfterPhotos((prev) => [...prev, uri]);
      }
    } catch (err: any) {
      Alert.alert(t('technician.error'), err?.message ?? t('technician.jobDetail.pickImageFailed'));
    }
  };

  const handleSubmitReport = () => {
    const visitIdNum = Number(visitId);
    if (!visitId || Number.isNaN(visitIdNum)) {
      Alert.alert(t('technician.error'), t('technician.jobDetail.invalidJob'));
      return;
    }
    const hasNotes = fieldNotes.trim().length > 0;
    const hasBefore = beforePhotos.length > 0;
    const hasAfter = afterPhotos.length > 0;
    if (!hasNotes && !hasBefore && !hasAfter) {
      Alert.alert(t('technician.jobDetail.required'), t('technician.jobDetail.addFieldNotes'));
      return;
    }
    Alert.alert(
      t('technician.jobDetail.submitReport'),
      t('technician.jobDetail.submitReportConfirm'),
      [
        { text: t('technician.cancel'), style: 'cancel' },
        {
          text: t('technician.jobDetail.submit'),
          onPress: async () => {
            setSubmittingReport(true);
            try {
              const result = await submitTechnicianReport({
                visit_id: visitIdNum,
                technician_notes: fieldNotes.trim() || undefined,
                before_photo: beforePhotos[0] ? { uri: beforePhotos[0] } : undefined,
                after_photo: afterPhotos[0] ? { uri: afterPhotos[0] } : undefined,
              });
              setSubmittingReport(false);
              if (result.success) {
                Alert.alert(
                  t('technician.success'),
                  t('technician.jobDetail.reportSubmitted'),
                  [{ text: t('technician.ok'), onPress: () => navigation.goBack() }]
                );
              } else {
                Alert.alert(t('technician.error'), result.message ?? t('technician.jobDetail.reportFailed'));
              }
            } catch (err: any) {
              setSubmittingReport(false);
              const msg =
                err?.response?.data?.message ??
                (err?.response?.data?.errors && typeof err.response.data.errors === 'object'
                  ? (Object.values(err.response.data.errors).flat() as string[]).join(', ')
                  : null) ??
                err?.message ??
                t('technician.jobDetail.reportFailed');
              Alert.alert(t('technician.error'), typeof msg === 'string' ? msg : JSON.stringify(msg));
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return COLORS.info;
      case 'in_progress': return COLORS.primary;
      case 'accepted': return COLORS.info;
      case 'completed': return COLORS.success;
      case 'cancelled': return COLORS.error;
      case 'rejected': return COLORS.error;
      default: return COLORS.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'assigned': return t('technician.status.assigned');
      case 'in_progress': return t('technician.status.inProgress');
      case 'accepted': return t('technician.status.accepted');
      case 'completed': return t('technician.status.completed');
      case 'cancelled': return t('technician.status.cancelled');
      case 'rejected': return t('technician.status.rejected');
      case 'pending': return t('technician.status.pending');
      default: return status || t('technician.jobDetail.unknown');
    }
  };

  if (loadingDetail && !detail) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('technician.jobDetails')}</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('technician.jobDetail.loading')}</Text>
        </View>
      </View>
    );
  }

  if (detailError && !detail) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('technician.jobDetails')}</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.centeredContent}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.errorText}>{detailError}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('technician.jobDetails')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Job Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(jobStatus) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(jobStatus) }]}>
                {getStatusLabel(jobStatus)}
              </Text>
            </View>
            <Text style={styles.jobId}>
              {typeof job.jobNumber === 'string' && job.jobNumber.startsWith('job_')
                ? job.jobNumber
                : t('technician.jobDetail.jobLabel', { id: job.jobNumber })}
            </Text>
          </View>
          <Text style={styles.jobDate}>{job.date}</Text>
        </View>

        {/* Service Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.jobDetail.serviceInformation')}</Text>
          <View style={styles.serviceCard}>
            <Text style={styles.serviceName}>{job.service}</Text>
            {job.serviceDescription ? <Text style={styles.serviceDescription}>{job.serviceDescription}</Text> : null}
            <View style={styles.serviceDetails}>
              <View style={styles.detailItem}>
                <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.detailText}>{job.scheduledTime}</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="timer-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.detailText}>{job.estimatedDuration}</Text>
              </View>
              {(job.priceDisplay != null && job.priceDisplay !== '') || (job.price != null && Number(job.price) >= 0) ? (
                <View style={styles.detailItem}>
                  <Ionicons name="cash-outline" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.detailText}>{job.priceDisplay ?? `AED ${Number(job.price).toFixed(2)}`}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Customer Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.jobDetail.customerInformation')}</Text>
          <View style={styles.customerCard}>
            <Text style={styles.customerName}>{job.customerName}</Text>
            <View style={styles.customerDetails}>
              <TouchableOpacity style={styles.customerDetail} onPress={handleCallCustomer}>
                <Ionicons name="call-outline" size={16} color={COLORS.primary} />
                <Text style={styles.customerDetailText}>{job.customerPhone}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.customerDetail} onPress={handleMessageCustomer}>
                <Ionicons name="mail-outline" size={16} color={COLORS.primary} />
                <Text style={styles.customerDetailText}>{job.customerEmail}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('technician.jobDetail.serviceAddress')}</Text>
          <View style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <Ionicons name="location-outline" size={20} color={COLORS.primary} />
              <Text style={styles.addressTitle}>
                {!address?.label || address.label === 'Service Location'
                  ? t('technician.jobDetail.serviceLocation')
                  : address.label}
              </Text>
            </View>
            <Text style={styles.addressText}>{job.address}</Text>
            {address?.get_directions !== false && (
              <TouchableOpacity style={styles.directionsButton} onPress={handleGetDirections}>
                <Ionicons name="navigate-outline" size={16} color={COLORS.primary} />
                <Text style={styles.directionsText}>{t('technician.jobDetail.getDirections')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Special Instructions */}
        {job.specialInstructions && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('technician.jobDetail.specialInstructions')}</Text>
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsText}>{job.specialInstructions}</Text>
            </View>
          </View>
        )}

        {/* Field Notes */}
        {actions.can_submit_field_report && (jobStatus === 'in_progress' || jobStatus === 'accepted') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('technician.jobDetail.fieldNotes')}</Text>
            <View style={styles.notesCard}>
              <TextInput
                style={styles.notesInput}
                placeholder={t('technician.jobDetail.fieldNotesPlaceholder')}
                value={fieldNotes}
                onChangeText={setFieldNotes}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
          </View>
        )}

        {/* Photo Upload - Before / After */}
        {actions.can_submit_field_report && (jobStatus === 'in_progress' || jobStatus === 'accepted') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('technician.jobDetail.beforeAfterPhotos')}</Text>
            <View style={styles.photosCard}>
              <Text style={styles.photoGroupTitle}>{t('technician.jobDetail.before')}</Text>
              <View style={styles.photosGrid}>
                {beforePhotos.map((photo, index) => (
                  <View key={`b-${index}`} style={styles.photoItem}>
                    <Image source={{ uri: photo }} style={styles.photoImage} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => setBeforePhotos(beforePhotos.filter((_, i) => i !== index))}
                    >
                      <Ionicons name="close-circle" size={24} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.uploadButton} onPress={() => handleUploadPhoto('before')}>
                  <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
                  <Text style={styles.uploadButtonText}>{t('technician.jobDetail.addBefore')}</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.photoGroupTitle, { marginTop: SPACING.md }]}>{t('technician.jobDetail.after')}</Text>
              <View style={styles.photosGrid}>
                {afterPhotos.map((photo, index) => (
                  <View key={`a-${index}`} style={styles.photoItem}>
                    <Image source={{ uri: photo }} style={styles.photoImage} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => setAfterPhotos(afterPhotos.filter((_, i) => i !== index))}
                    >
                      <Ionicons name="close-circle" size={24} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.uploadButton} onPress={() => handleUploadPhoto('after')}>
                  <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
                  <Text style={styles.uploadButtonText}>{t('technician.jobDetail.addAfter')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Job Actions – show section and "Actions" title only when at least one button is visible */}
        {hasAnyAction && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('technician.jobDetail.actions')}</Text>
            <View style={styles.actionsContainer}>
              {hasStartVisit && (
                <Button
                  title={t('technician.jobDetail.startVisit')}
                  onPress={() => handleStatusUpdate('in_progress')}
                  disabled={isLoading}
                  style={styles.actionButton}
                />
              )}
              {hasSubmitReport && (
                <Button
                  title={t('technician.jobDetail.submitFieldReport')}
                  onPress={handleSubmitReport}
                  disabled={isLoading || submittingReport}
                  loading={submittingReport}
                  style={styles.actionButton}
                />
              )}
              {hasCompleteVisit && (
                <Button
                  title={t('technician.jobDetail.completeVisit')}
                  onPress={handleCompleteJob}
                  disabled={isLoading}
                  variant="outline"
                  style={styles.actionButton}
                />
              )}
              {hasCallCustomer && (
                <Button
                  title={t('technician.jobDetail.callCustomer')}
                  variant="outline"
                  onPress={handleCallCustomer}
                  style={styles.actionButton}
                />
              )}
            </View>
          </View>
        )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  errorText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: COLORS.surface,
    margin: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  statusText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  jobId: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  jobDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  section: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  serviceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  serviceName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  serviceDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  serviceDetails: {
    gap: SPACING.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  customerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  customerName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  customerDetails: {
    gap: SPACING.sm,
  },
  customerDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerDetailText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  addressCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  addressTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  addressText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  directionsText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
    marginLeft: SPACING.xs,
  },
  instructionsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  instructionsText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 20,
  },
  actionsContainer: {
    gap: SPACING.md,
  },
  actionButton: {
    width: '100%',
  },
  notesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  notesInput: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  photosCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  photoGroupTitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  photoItem: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: BORDER_RADIUS.md,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  uploadButton: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
  },
  uploadButtonText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
    marginTop: SPACING.xs,
  },
});

export default JobDetailScreen;
