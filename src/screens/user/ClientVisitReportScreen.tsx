import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import {
  ClientVisitReport,
  getClientVisitReport,
  isClientVisitReportDelivered,
  markClientVisitReportDelivered,
  parseClientVisitReport,
} from '../../services/clientVisitReportService';

function buildPreviewReport(orderId?: string | number): ClientVisitReport {
  return {
    id: 'preview',
    visit_id: 'preview',
    order_id: orderId,
    status: 'sent_to_client',
    technician_name: 'Ahmed Hassan',
    employee_id: 'T-1024',
    location: 'Al Khalidiya, Abu Dhabi',
    service: 'Garden Maintenance Visit',
    submitted_at: new Date().toISOString(),
    technician_notes:
      'Completed watering and pruning. Soil looks dry in the front beds.',
    supervisor_notes:
      'Good work overall. Please follow the recommendations below for the next visit.',
    recommendations: [
      'Needs Fertilizer',
      'Needs Watering',
      'Needs Pruning',
    ],
    before_photos: [],
    after_photos: [],
  };
}

const ClientVisitReportScreen: React.FC = () => {
  const { t } = useTranslation();
  const route = useRoute<any>();
  const reportId = route.params?.reportId as string | number | undefined;
  const visitId = route.params?.visitId as string | number | undefined;
  const orderId = route.params?.orderId as string | number | undefined;
  const forcePreview = Boolean(route.params?.preview);
  const embeddedReport = route.params?.report as ClientVisitReport | undefined;

  const [report, setReport] = useState<ClientVisitReport | null>(
    embeddedReport ? parseClientVisitReport(embeddedReport) : null
  );
  const [loading, setLoading] = useState(!embeddedReport);
  const [error, setError] = useState<string | null>(null);
  const [markingDelivered, setMarkingDelivered] = useState(false);
  const [isDelivered, setIsDelivered] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  const load = useCallback(async () => {
    if (embeddedReport) {
      const parsed = parseClientVisitReport(embeddedReport);
      setReport(parsed);
      setIsPreview(false);
      setIsDelivered(isClientVisitReportDelivered(parsed));
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (forcePreview) {
        setReport(buildPreviewReport(orderId));
        setIsPreview(true);
        setIsDelivered(false);
        return;
      }
      const data = await getClientVisitReport({ reportId, visitId, orderId });
      if (data) {
        setReport(data);
        setIsPreview(false);
        setIsDelivered(isClientVisitReportDelivered(data));
      } else {
        // Show preview UI until backend report API is ready.
        setReport(buildPreviewReport(orderId));
        setIsPreview(true);
        setIsDelivered(false);
      }
    } catch {
      setReport(buildPreviewReport(orderId));
      setIsPreview(true);
      setIsDelivered(false);
    } finally {
      setLoading(false);
    }
  }, [embeddedReport, forcePreview, orderId, reportId, visitId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const isReportDelivered = isDelivered || isClientVisitReportDelivered(report);

  const handleMarkAsDelivered = () => {
    if (!report || markingDelivered || isReportDelivered) return;

    Alert.alert(
      t('clientVisitReport.markDeliveredTitle', {
        defaultValue: 'Mark as Delivered',
      }),
      t('clientVisitReport.markDeliveredConfirm', {
        defaultValue: 'Are you sure you want to mark this service report as delivered?',
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('clientVisitReport.markDelivered', {
            defaultValue: 'Mark as Delivered',
          }),
          onPress: () => {
            void (async () => {
              setMarkingDelivered(true);
              try {
                const result = await markClientVisitReportDelivered({
                  reportId: report.id,
                  visitId: report.visit_id ?? visitId,
                  orderId: report.order_id ?? orderId,
                });
                setIsDelivered(true);
                setReport((prev) =>
                  prev
                    ? {
                        ...prev,
                        status: result.status || 'delivered',
                        order_status: 'delivered',
                        can_mark_delivered: false,
                      }
                    : prev
                );
                Alert.alert(
                  t('common.success', { defaultValue: 'Success' }),
                  result.message ||
                    t('clientVisitReport.markDeliveredSuccess', {
                      defaultValue: 'Report marked as delivered.',
                    })
                );
              } catch (err: unknown) {
                Alert.alert(
                  t('common.error', { defaultValue: 'Error' }),
                  err instanceof Error
                    ? err.message
                    : t('clientVisitReport.markDeliveredFailed', {
                        defaultValue: 'Could not mark this report as delivered.',
                      })
                );
              } finally {
                setMarkingDelivered(false);
              }
            })();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header
          title={t('clientVisitReport.title', { defaultValue: 'Service Report' })}
          showBack
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('clientVisitReport.loading', { defaultValue: 'Loading report…' })}
          </Text>
        </View>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.container}>
        <Header
          title={t('clientVisitReport.title', { defaultValue: 'Service Report' })}
          showBack
        />
        <View style={styles.centered}>
          <Ionicons name="document-text-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.errorText}>
            {error ||
              t('clientVisitReport.notFound', {
                defaultValue: 'No service report is available yet.',
              })}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.88}>
            <Text style={styles.retryText}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const visitDate = report.submitted_at
    ? dayjs(report.submitted_at).format('YYYY-MM-DD')
    : report.visit?.scheduled_at
      ? dayjs(report.visit.scheduled_at).format('YYYY-MM-DD')
      : '—';
  const visitTime = report.submitted_at
    ? dayjs(report.submitted_at).format('h:mm A')
    : report.visit?.scheduled_at
      ? dayjs(report.visit.scheduled_at).format('h:mm A')
      : '—';
  const displayLocation =
    report.location || report.visit?.client_name || report.visit?.area_name || '—';

  return (
    <View style={styles.container}>
      <Header
        title={t('clientVisitReport.title', { defaultValue: 'Service Report' })}
        showBack
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroIcon}>
            <Ionicons
              name={isReportDelivered ? 'checkmark-done' : 'document-text'}
              size={22}
              color="#fff"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>
              {isReportDelivered
                ? t('clientVisitReport.deliveredTitle', {
                    defaultValue: 'Report marked as delivered',
                  })
                : t('clientVisitReport.readyTitle', {
                    defaultValue: 'Your service report is ready',
                  })}
            </Text>
            <Text style={styles.heroSub}>
              {isReportDelivered
                ? t('clientVisitReport.deliveredSubtitle', {
                    defaultValue: 'You confirmed this service report as delivered',
                  })
                : isPreview
                  ? t('clientVisitReport.previewSubtitle', {
                      defaultValue: 'Preview UI — sample report for design review',
                    })
                : t('clientVisitReport.readySubtitle', {
                    defaultValue: 'Reviewed and sent by your supervisor',
                  })}
            </Text>
          </View>
          {isPreview && !isReportDelivered ? (
            <View style={styles.deliveredBadge}>
              <Text style={styles.deliveredBadgeText}>
                {t('clientVisitReport.preview', { defaultValue: 'Preview' })}
              </Text>
            </View>
          ) : isReportDelivered ? (
            <View style={styles.deliveredBadge}>
              <Text style={styles.deliveredBadgeText}>
                {t('clientVisitReport.delivered', { defaultValue: 'Delivered' })}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.summaryStrip}>
          <View style={styles.summaryPill}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
            <View style={styles.summaryPillTextWrap}>
              <Text style={styles.summaryPillLabel}>Visit Date</Text>
              <Text style={styles.summaryPillValue}>{visitDate}</Text>
            </View>
          </View>
          <View style={styles.summaryPill}>
            <Ionicons name="time-outline" size={16} color={COLORS.primary} />
            <View style={styles.summaryPillTextWrap}>
              <Text style={styles.summaryPillLabel}>Visit Time</Text>
              <Text style={styles.summaryPillValue}>{visitTime}</Text>
            </View>
          </View>
        </View>

        {(report.technician_name || report.employee_id) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('supervisorReport.fieldWorker', { defaultValue: 'Field Worker' })}
            </Text>
            <Text style={styles.sectionCaption}>The technician who completed this service visit.</Text>
            <View style={styles.card}>
              <View style={styles.techRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(report.technician_name || 'T').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.techName}>{report.technician_name || '—'}</Text>
                  {report.employee_id ? (
                    <Text style={styles.techId}>
                      {t('supervisorDashboard.idPrefix', { defaultValue: 'ID: ' })}
                      {report.employee_id}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('supervisorReport.visitInformation', { defaultValue: 'Visit Information' })}
          </Text>
          <Text style={styles.sectionCaption}>A quick summary of where and when the work was completed.</Text>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="location-outline" size={18} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{displayLocation}</Text>
                {report.service ? <Text style={styles.serviceName}>{report.service}</Text> : null}
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.visitDetails}>
              <View style={styles.detailChip}>
                <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                <Text style={styles.detailText}>{visitDate}</Text>
              </View>
              <View style={styles.detailChip}>
                <Ionicons name="time-outline" size={16} color={COLORS.primary} />
                <Text style={styles.detailText}>{visitTime}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('supervisorReport.fieldNotes', { defaultValue: 'Field Notes' })}
          </Text>
          <Text style={styles.sectionCaption}>Notes shared by the field team about the completed work.</Text>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.cardHeaderTitle}>Technician Notes</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.notesText}>
              {report.technician_notes ||
                t('supervisorReport.noNotesProvided', { defaultValue: 'No notes provided.' })}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('supervisorReport.fieldPhotos', { defaultValue: 'Field Photos' })}
          </Text>
          <Text style={styles.sectionCaption}>Before and after photos from the service visit.</Text>
          <View style={styles.card}>
            {report.before_photos.length > 0 ? (
              <>
                <View style={styles.photoHeaderRow}>
                  <Text style={styles.photoLabel}>
                    {t('supervisorReport.before', { defaultValue: 'Before' })}
                  </Text>
                </View>
                <View style={styles.photoGrid}>
                  {report.before_photos.map((p) => (
                    <View key={`b-${p.id}`} style={styles.photoFrame}>
                      <Image source={{ uri: p.photo_url }} style={styles.photo} />
                    </View>
                  ))}
                </View>
              </>
            ) : null}
            {report.after_photos.length > 0 ? (
              <>
                <View style={styles.photoHeaderRow}>
                  <Text style={styles.photoLabel}>
                    {t('supervisorReport.after', { defaultValue: 'After' })}
                  </Text>
                </View>
                <View style={styles.photoGrid}>
                  {report.after_photos.map((p) => (
                    <View key={`a-${p.id}`} style={styles.photoFrame}>
                      <Image source={{ uri: p.photo_url }} style={styles.photo} />
                    </View>
                  ))}
                </View>
              </>
            ) : null}
            {!report.before_photos.length && !report.after_photos.length ? (
              <Text style={styles.notesText}>
                {t('supervisorReport.noPhotos', { defaultValue: 'No photos attached.' })}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('supervisorReport.supervisorNotes', { defaultValue: 'Supervisor Notes' })}
          </Text>
          <Text style={styles.sectionCaption}>Final review shared with you by the supervisor.</Text>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.cardHeaderTitle}>Supervisor Review</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.notesText}>
              {report.supervisor_notes ||
                t('clientVisitReport.noSupervisorNotes', {
                  defaultValue: 'No supervisor notes were added.',
                })}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('clientVisitReport.recommendations', {
              defaultValue: 'Recommendations',
            })}
          </Text>
          <Text style={styles.sectionCaption}>Suggested next steps based on the site visit.</Text>
          <View style={styles.card}>
            {report.recommendations && report.recommendations.length > 0 ? (
              <View style={styles.recommendationList}>
                {report.recommendations.map((item, index) => (
                  <View key={`${item}-${index}`} style={styles.recommendationCard}>
                    <View style={styles.recommendationIconWrap}>
                      <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                    </View>
                    <Text style={styles.recommendationText}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.notesText}>
                {t('clientVisitReport.noRecommendations', {
                  defaultValue: 'No recommendations were selected.',
                })}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        {isReportDelivered ? (
          <View style={styles.deliveredBanner}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            <Text style={styles.deliveredBannerText}>
              {t('clientVisitReport.alreadyDelivered', {
                defaultValue: 'This report has been marked as delivered',
              })}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.markDeliveredBtn, markingDelivered && styles.markDeliveredBtnDisabled]}
            onPress={handleMarkAsDelivered}
            disabled={markingDelivered}
            activeOpacity={0.88}
          >
            {markingDelivered ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="cube-outline" size={20} color="#fff" />
                <Text style={styles.markDeliveredBtnText}>
                  {t('clientVisitReport.markDelivered', {
                    defaultValue: 'Mark as Delivered',
                  })}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceLight },
  scroll: { paddingBottom: SPACING.xxl + 72 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },
  errorText: {
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  retryText: {
    color: '#fff',
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  hero: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroGlow: {
    position: 'absolute',
    right: -32,
    top: -24,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#fff',
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FONT_SIZES.sm,
    marginTop: 4,
  },
  deliveredBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deliveredBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  summaryStrip: {
    paddingHorizontal: SPACING.lg,
    marginTop: -SPACING.xs,
    marginBottom: SPACING.lg,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  summaryPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryPillTextWrap: {
    flex: 1,
  },
  summaryPillLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  summaryPillValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  bottomBar: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  markDeliveredBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: 52,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
  },
  markDeliveredBtnDisabled: {
    opacity: 0.7,
  },
  markDeliveredBtnText: {
    color: '#fff',
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
  deliveredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: 52,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.success + '14',
    paddingHorizontal: SPACING.lg,
  },
  deliveredBannerText: {
    flexShrink: 1,
    color: COLORS.success,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    textAlign: 'center',
  },
  section: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  sectionCaption: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  techRow: { flexDirection: 'row', alignItems: 'center' },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  cardHeaderTitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
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
    color: '#fff',
  },
  techName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  techId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginTop: 2,
  },
  customerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  serviceName: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginTop: 4,
  },
  visitDetails: {
    flexDirection: 'row',
    gap: SPACING.lg,
    flexWrap: 'wrap',
  },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  detailText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  notesText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  photoLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoFrame: {
    padding: 4,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photo: {
    width: 110,
    height: 110,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  recommendationList: {
    gap: SPACING.md,
  },
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recommendationIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default ClientVisitReportScreen;
