import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { buildFullImageUrl } from '../../config/api';
import { adminService, AdminVideoBanner } from '../../services/adminService';

/** Max upload size for home featured video banner. */
const MAX_VIDEO_BANNER_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_BANNER_MB = 30;

function isActiveFlag(value: AdminVideoBanner['is_active']): boolean {
  return value !== false && value !== 0 && value !== '0';
}

async function resolveVideoFileSizeBytes(
  uri: string,
  knownSize?: number | null
): Promise<number | null> {
  if (typeof knownSize === 'number' && knownSize > 0) return knownSize;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && 'size' in info && typeof info.size === 'number' && info.size > 0) {
      return info.size;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Live preview of the selected / existing MP4 on the current banner card. */
const AdminVideoPreviewPlayer: React.FC<{ uri: string }> = ({ uri }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
  });
  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });

  useEventListener(player, 'playToEnd', () => {
    try {
      player.currentTime = 0;
    } catch {
      // ignore
    }
  });

  return (
    <TouchableOpacity
      style={styles.previewVideoWrap}
      activeOpacity={0.95}
      onPress={() => {
        if (isPlaying) player.pause();
        else player.play();
      }}
    >
      <VideoView
        style={styles.previewImage}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
      />
      <View style={styles.previewPlayHint} pointerEvents="none">
        <View style={styles.previewPlayIcon}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#fff" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const AdminVideoBannerScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  const [banner, setBanner] = useState<AdminVideoBanner | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formBadgeText, setFormBadgeText] = useState('');
  const [formButtonText, setFormButtonText] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [videoMimeType, setVideoMimeType] = useState<string | null>(null);

  const fillForm = useCallback((data: AdminVideoBanner | null) => {
    setBanner(data);
    setFormTitle(data?.title ?? '');
    setFormBadgeText(data?.badge_text ?? '');
    setFormButtonText(data?.button_text ?? '');
    setFormIsActive(data ? isActiveFlag(data.is_active) : true);
    setVideoUri(null);
    setVideoName(null);
    setVideoMimeType(null);
  }, []);

  const fetchBanner = useCallback(
    async (isRefresh = false, knownId?: number | null) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const id = knownId ?? banner?.id;
        let res: { success?: boolean; message?: string; data: AdminVideoBanner | null };

        if (id) {
          // Postman: GET /api/admin/video-banners/{{video_banner_id}}
          res = await adminService.getVideoBannerById(id);
        } else {
          // No id yet — list then get-by-id for the first banner
          res = await adminService.getVideoBanner();
        }

        fillForm(res.data ?? null);
      } catch (err: any) {
        // 404 = no banner yet — empty form for create
        if (err?.response?.status === 404) {
          fillForm(null);
        } else {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              t('admin.videoBanner.errorLoad', { defaultValue: 'Failed to load video banner' })
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [banner?.id, fillForm, t]
  );

  useFocusEffect(
    useCallback(() => {
      fetchBanner();
    }, [fetchBanner])
  );

  const rejectIfVideoTooLarge = useCallback(
    async (uri: string, knownSize?: number | null): Promise<boolean> => {
      const size = await resolveVideoFileSizeBytes(uri, knownSize);
      if (size != null && size > MAX_VIDEO_BANNER_BYTES) {
        Alert.alert(
          t('admin.users.error', { defaultValue: 'Error' }),
          t('admin.videoBanner.errorMaxSize', {
            defaultValue: `You can upload a video of up to ${MAX_VIDEO_BANNER_MB} MB only. Please choose a smaller file.`,
            maxMb: MAX_VIDEO_BANNER_MB,
          })
        );
        return true;
      }
      return false;
    },
    [t]
  );

  const pickVideoFromPhotos = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          t('admin.videoBanner.permissionTitle', { defaultValue: 'Permission needed' }),
          t('admin.videoBanner.permissionVideo', {
            defaultValue: 'Please allow media access to choose a video.',
          })
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 120,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        const asset = res.assets[0];
        const tooLarge = await rejectIfVideoTooLarge(asset.uri, asset.fileSize ?? null);
        if (tooLarge) return;
        setVideoUri(asset.uri);
        setVideoName(asset.fileName || 'video-banner.mp4');
        setVideoMimeType(asset.mimeType || 'video/mp4');
      }
    } catch (e: any) {
      Alert.alert(
        t('admin.users.error', { defaultValue: 'Error' }),
        e?.message ||
          t('admin.videoBanner.errorPickVideo', { defaultValue: 'Could not pick video.' })
      );
    }
  }, [rejectIfVideoTooLarge, t]);

  const pickVideoFromDocuments = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['video/*', 'public.movie', 'public.mpeg-4'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      const asset = res.assets[0];
      const tooLarge = await rejectIfVideoTooLarge(asset.uri, asset.size ?? null);
      if (tooLarge) return;
      setVideoUri(asset.uri);
      setVideoName(asset.name || 'video-banner.mp4');
      setVideoMimeType(asset.mimeType || 'video/mp4');
    } catch (e: any) {
      Alert.alert(
        t('admin.users.error', { defaultValue: 'Error' }),
        e?.message ||
          t('admin.videoBanner.errorPickVideo', { defaultValue: 'Could not pick video.' })
      );
    }
  }, [rejectIfVideoTooLarge, t]);

  const pickVideo = useCallback(() => {
    Alert.alert(
      t('admin.videoBanner.chooseVideoSourceTitle', {
        defaultValue: 'Choose video',
      }),
      t('admin.videoBanner.chooseVideoSourceBody', {
        defaultValue: `Max ${MAX_VIDEO_BANNER_MB} MB. Select a video from Photos or from Files/Downloads.`,
        maxMb: MAX_VIDEO_BANNER_MB,
      }),
      [
        {
          text: t('admin.videoBanner.fromPhotos', {
            defaultValue: 'Photos & Videos',
          }),
          onPress: () => void pickVideoFromPhotos(),
        },
        {
          text: t('admin.videoBanner.fromDocuments', {
            defaultValue: 'Files / Downloads',
          }),
          onPress: () => void pickVideoFromDocuments(),
        },
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
      ]
    );
  }, [pickVideoFromDocuments, pickVideoFromPhotos, t]);

  const handleSave = useCallback(async () => {
    if (!formTitle.trim()) {
      Alert.alert(
        t('admin.users.error', { defaultValue: 'Error' }),
        t('admin.videoBanner.errorTitleRequired', { defaultValue: 'Please enter a title.' })
      );
      return;
    }
    if (!banner && !videoUri) {
      Alert.alert(
        t('admin.users.error', { defaultValue: 'Error' }),
        t('admin.videoBanner.errorVideoRequired', {
          defaultValue: 'Please choose a video file.',
        })
      );
      return;
    }
    if (videoUri && (await rejectIfVideoTooLarge(videoUri))) {
      return;
    }

    const payload = {
      title: formTitle.trim(),
      badge_text: formBadgeText.trim(),
      button_text: formButtonText.trim(),
      is_active: formIsActive ? '1' : '0',
      // Only attach video when the admin picked a new file (optional replace on update)
      video: videoUri
        ? {
            uri: videoUri,
            name: videoName || 'video-banner.mp4',
            type: videoMimeType || undefined,
          }
        : undefined,
    };

    setSaving(true);
    try {
      let savedId = banner?.id ?? null;
      if (banner?.id) {
        // POST /api/admin/video-banners/{{video_banner_id}}
        const updated = await adminService.updateVideoBanner(banner.id, payload);
        savedId = updated?.data?.id ?? banner.id;
        Alert.alert(
          t('admin.users.success', { defaultValue: 'Success' }),
          t('admin.videoBanner.successUpdated', {
            defaultValue: 'Video banner updated successfully.',
          })
        );
      } else {
        const created = await adminService.createVideoBanner(payload);
        savedId = created?.data?.id ?? null;
        Alert.alert(
          t('admin.users.success', { defaultValue: 'Success' }),
          t('admin.videoBanner.successCreated', {
            defaultValue: 'Video banner created successfully.',
          })
        );
      }
      // Reload via GET /admin/video-banners/:id
      await fetchBanner(true, savedId);
    } catch (err: any) {
      Alert.alert(
        t('admin.users.error', { defaultValue: 'Error' }),
        err?.response?.data?.message ||
          err?.message ||
          t('admin.videoBanner.errorSave', { defaultValue: 'Failed to save video banner.' })
      );
    } finally {
      setSaving(false);
    }
  }, [
    banner,
    fetchBanner,
    formBadgeText,
    formButtonText,
    formIsActive,
    formTitle,
    rejectIfVideoTooLarge,
    t,
    videoMimeType,
    videoName,
    videoUri,
  ]);

  const handleToggle = useCallback(async () => {
    if (!banner?.id) {
      setFormIsActive((prev) => !prev);
      return;
    }
    setToggling(true);
    try {
      const res = await adminService.toggleVideoBannerStatus(banner.id);
      const next = res.data ? isActiveFlag(res.data.is_active) : !formIsActive;
      setFormIsActive(next);
      setBanner((prev) => (prev ? { ...prev, is_active: next } : prev));
    } catch (err: any) {
      Alert.alert(
        t('admin.users.error', { defaultValue: 'Error' }),
        err?.response?.data?.message ||
          err?.message ||
          t('admin.videoBanner.errorToggle', { defaultValue: 'Failed to update status.' })
      );
    } finally {
      setToggling(false);
    }
  }, [banner?.id, formIsActive, t]);

  const handleDelete = useCallback(() => {
    if (!banner?.id) return;
    Alert.alert(
      t('admin.videoBanner.deleteTitle', { defaultValue: 'Delete Video Banner' }),
      t('admin.videoBanner.deleteMessage', {
        defaultValue: 'Delete this video banner? This cannot be undone.',
      }),
      [
        { text: t('admin.settings.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('admin.users.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              // DELETE /api/admin/video-banners/{{video_banner_id}}
              await adminService.deleteVideoBanner(banner.id);
              fillForm(null);
              setError(null);
              Alert.alert(
                t('admin.users.success', { defaultValue: 'Success' }),
                t('admin.videoBanner.successDeleted', {
                  defaultValue: 'Video banner deleted.',
                })
              );
            } catch (err: any) {
              Alert.alert(
                t('admin.users.error', { defaultValue: 'Error' }),
                err?.response?.data?.message ||
                  err?.message ||
                  t('admin.videoBanner.errorDelete', {
                    defaultValue: 'Failed to delete video banner.',
                  })
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [banner?.id, fillForm, t]);

  const existingVideo =
    banner?.video_url || (banner?.video ? buildFullImageUrl(banner.video) : null);
  // Newly picked local video takes priority so it shows immediately on the current banner card
  const videoPreview = videoUri || existingVideo;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('admin.videoBanner.title', { defaultValue: 'Video Banner' })}
          </Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {t('admin.videoBanner.loading', { defaultValue: 'Loading video banner…' })}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('admin.videoBanner.title', { defaultValue: 'Video Banner' })}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchBanner(true)} />
        }
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>
          {t('admin.videoBanner.sectionHint', {
            defaultValue:
              'Manage the single featured video shown on the client home dashboard.',
          })}
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => fetchBanner()}>
              <Text style={styles.retryText}>
                {t('admin.videoBanner.retry', { defaultValue: 'Retry' })}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {banner
              ? t('admin.videoBanner.editCard', { defaultValue: 'Current video banner' })
              : t('admin.videoBanner.createCard', { defaultValue: 'Create video banner' })}
          </Text>

          <View style={styles.preview}>
            {videoPreview ? (
              <AdminVideoPreviewPlayer key={videoPreview} uri={videoPreview} />
            ) : (
              <View style={[styles.previewImage, styles.previewPlaceholder]}>
                <Ionicons name="videocam-outline" size={40} color={COLORS.textSecondary} />
                <Text style={styles.previewEmptyHint}>
                  {t('admin.videoBanner.previewEmpty', {
                    defaultValue: 'Choose an MP4 to preview it here',
                  })}
                </Text>
              </View>
            )}
            <View style={styles.previewOverlay} pointerEvents="none">
              <View style={styles.previewBadge}>
                <Ionicons name="videocam" size={12} color="#fff" />
                <Text style={styles.previewBadgeText}>
                  {formBadgeText.trim() ||
                    t('admin.videoBanner.badgeDefault', { defaultValue: 'Video' })}
                </Text>
              </View>
              {formTitle.trim() ? (
                <Text style={styles.previewTitle} numberOfLines={2}>
                  {formTitle.trim()}
                </Text>
              ) : null}
            </View>
          </View>

          <Text style={styles.label}>
            {t('admin.videoBanner.titleLabel', { defaultValue: 'Title *' })}
          </Text>
          <TextInput
            style={styles.input}
            value={formTitle}
            onChangeText={setFormTitle}
            placeholder={t('admin.videoBanner.placeholderTitle', {
              defaultValue: 'See Tandil in action',
            })}
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>
            {t('admin.videoBanner.badgeLabel', { defaultValue: 'Badge text' })}
          </Text>
          <TextInput
            style={styles.input}
            value={formBadgeText}
            onChangeText={setFormBadgeText}
            placeholder={t('admin.videoBanner.placeholderBadge', {
              defaultValue: 'Watch now',
            })}
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>
            {t('admin.videoBanner.buttonTextLabel', { defaultValue: 'Button text' })}
          </Text>
          <TextInput
            style={styles.input}
            value={formButtonText}
            onChangeText={setFormButtonText}
            placeholder={t('admin.videoBanner.placeholderButton', {
              defaultValue: 'Explore services',
            })}
            placeholderTextColor={COLORS.textSecondary}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.labelInline}>
                {t('admin.videoBanner.activeLabel', { defaultValue: 'Active on client app' })}
              </Text>
              <Text style={styles.switchHint}>
                {t('admin.videoBanner.activeHint', {
                  defaultValue: 'When off, the video banner is hidden on Home.',
                })}
              </Text>
            </View>
            {toggling ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Switch
                value={formIsActive}
                onValueChange={(value) => {
                  if (banner?.id) void handleToggle();
                  else setFormIsActive(value);
                }}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '88' }}
                thumbColor={formIsActive ? COLORS.primary : '#f4f3f4'}
              />
            )}
          </View>

          <Text style={styles.label}>
            {t('admin.videoBanner.videoLabel', { defaultValue: 'Video file (MP4)' })}
          </Text>
          <Text style={styles.videoSizeHint}>
            {t('admin.videoBanner.maxSizeHint', {
              defaultValue: `You can upload a video of up to ${MAX_VIDEO_BANNER_MB} MB only.`,
              maxMb: MAX_VIDEO_BANNER_MB,
            })}
          </Text>
          <TouchableOpacity style={styles.mediaBtn} onPress={pickVideo} activeOpacity={0.85}>
            <Ionicons name="videocam-outline" size={20} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.mediaBtnText}>
                {videoUri
                  ? t('admin.videoBanner.changeVideo', { defaultValue: 'Change video' })
                  : existingVideo
                    ? t('admin.videoBanner.replaceVideo', {
                        defaultValue: 'Replace video (optional)',
                      })
                    : t('admin.videoBanner.chooseVideo', { defaultValue: 'Choose video *' })}
              </Text>
              {(videoName || existingVideo) && (
                <Text style={styles.mediaSub} numberOfLines={1}>
                  {videoName || existingVideo}
                </Text>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.88}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>
                {banner
                  ? t('admin.videoBanner.update', { defaultValue: 'Update Video Banner' })
                  : t('admin.videoBanner.create', { defaultValue: 'Create Video Banner' })}
              </Text>
            )}
          </TouchableOpacity>

          {banner?.id ? (
            <TouchableOpacity
              style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
              onPress={handleDelete}
              disabled={deleting}
              activeOpacity={0.88}
            >
              {deleting ? (
                <ActivityIndicator color={COLORS.error} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  <Text style={styles.deleteBtnText}>
                    {t('admin.videoBanner.delete', { defaultValue: 'Delete Video Banner' })}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surfaceLight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SPACING.xs, marginRight: SPACING.sm },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  headerRight: { width: 32 },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
  hint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: COLORS.error + '12',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  errorText: { color: COLORS.error, marginBottom: SPACING.sm },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  retryText: { color: '#fff', fontWeight: FONT_WEIGHTS.semiBold },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  preview: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F2513',
    marginBottom: SPACING.lg,
  },
  previewImage: { width: '100%', height: '100%' },
  previewVideoWrap: { width: '100%', height: '100%' },
  previewPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    gap: SPACING.sm,
  },
  previewEmptyHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  previewPlayHint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlayIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: SPACING.md,
    backgroundColor: 'rgba(8,20,12,0.28)',
  },
  previewBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    marginBottom: SPACING.sm,
  },
  previewBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: FONT_WEIGHTS.semiBold,
    textTransform: 'uppercase',
  },
  previewTitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  videoSizeHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: -2,
  },
  labelInline: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceLight,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  switchHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  mediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary + '55',
    backgroundColor: COLORS.primary + '0D',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  mediaBtnText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  mediaSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  saveBtn: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: {
    color: '#fff',
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
  deleteBtn: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.error + '55',
    borderRadius: BORDER_RADIUS.lg,
    minHeight: 48,
  },
  deleteBtnText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default AdminVideoBannerScreen;
