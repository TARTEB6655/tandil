import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { ensureLocalHomeVideo } from '../../services/videoBannerService';

const SCREEN_W = Dimensions.get('window').width;
const BANNER_HEIGHT = Math.round(SCREEN_W * 0.56);

export interface VideoBannerProps {
  title?: string;
  videoUrl: string;
  badgeText?: string;
  onPressCta?: () => void;
  ctaText?: string;
}

const VideoBannerPlayer: React.FC<{
  uri: string;
  displayBadge: string;
  muted: boolean;
  onToggleMute: () => void;
}> = ({ uri, displayBadge, muted, onToggleMute }) => {
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [positionSec, setPositionSec] = useState(0);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = muted;
    p.timeUpdateEventInterval = 0.25;
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });

  useEffect(() => {
    try {
      player.muted = muted;
    } catch {
      // ignore
    }
  }, [muted, player]);

  // Android often stays black while paused until a frame is decoded.
  // Nudge currentTime after mount so a poster frame appears under the play button.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled || hasFirstFrame) return;
      try {
        player.currentTime = 0.05;
      } catch {
        // ignore
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [player, hasFirstFrame]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    setPositionSec(currentTime ?? 0);
  });

  useEventListener(player, 'sourceLoad', ({ duration }) => {
    if (typeof duration === 'number' && duration > 0) {
      setDurationSec(duration);
    }
    try {
      // Seek slightly forward so ExoPlayer paints a frame while still paused.
      player.currentTime = 0.05;
    } catch {
      // ignore
    }
  });

  useEventListener(player, 'playToEnd', () => {
    try {
      player.pause();
      player.currentTime = 0;
    } catch {
      // ignore
    }
  });

  const progress =
    durationSec > 0 ? Math.min(positionSec / durationSec, 1) : 0;

  const togglePlayback = useCallback(() => {
    try {
      if (isPlaying) player.pause();
      else player.play();
    } catch {
      // ignore
    }
  }, [isPlaying, player]);

  return (
    <TouchableOpacity activeOpacity={1} style={styles.media} onPress={togglePlayback}>
      <VideoView
        style={[styles.video, !hasFirstFrame && styles.videoHidden]}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        // false = transparent until first frame (default). Bare `useExoShutter` is true
        // and paints a solid black shutter on Android while paused.
        useExoShutter={false}
        onFirstFrameRender={() => setHasFirstFrame(true)}
      />

      {!hasFirstFrame ? (
        <View style={styles.cover} pointerEvents="none">
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : null}

      {!isPlaying ? (
        <View style={styles.centerOverlay} pointerEvents="none">
          <View style={styles.playBtn}>
            <Ionicons name="play" size={28} color={COLORS.primary} style={{ marginLeft: 3 }} />
          </View>
        </View>
      ) : null}

      <View style={styles.topRow} pointerEvents="box-none">
        {displayBadge ? (
          <View style={styles.badge}>
            <Ionicons name="videocam" size={11} color="#fff" />
            <Text style={styles.badgeText} numberOfLines={1}>
              {displayBadge}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <TouchableOpacity style={styles.chipIcon} onPress={onToggleMute} activeOpacity={0.85}>
          <Ionicons
            name={muted ? 'volume-mute' : 'volume-high'}
            size={15}
            color={COLORS.text}
          />
        </TouchableOpacity>
      </View>

      {(isPlaying || positionSec > 0.05) && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      )}
    </TouchableOpacity>
  );
};

/**
 * Featured video on Home.
 * Downloads the remote MP4 to disk first (uploaded files often lack faststart),
 * then plays the local file so the first frame appears quickly.
 */
const VideoBanner: React.FC<VideoBannerProps> = ({
  title,
  videoUrl,
  badgeText,
  onPressCta,
  ctaText,
}) => {
  const { t } = useTranslation();
  const [muted, setMuted] = useState(true);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [downloadRatio, setDownloadRatio] = useState(0);
  const [preparing, setPreparing] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const prepare = useCallback(async () => {
    setPreparing(true);
    setLoadFailed(false);
    setDownloadRatio(0);
    setLocalUri(null);
    try {
      const uri = await ensureLocalHomeVideo(videoUrl, (ratio) => {
        setDownloadRatio(ratio);
      });
      setLocalUri(uri);
    } catch {
      setLoadFailed(true);
    } finally {
      setPreparing(false);
    }
  }, [videoUrl]);

  useEffect(() => {
    void prepare();
  }, [prepare]);

  const displayTitle =
    title ||
    t('home.videoBanner.title', {
      defaultValue: 'See Tandil in action',
    });
  const displayBadge =
    badgeText ||
    t('home.videoBanner.badge', { defaultValue: 'Watch now' });
  const displayCta =
    ctaText ||
    t('home.videoBanner.cta', { defaultValue: 'Explore services' });

  const percent = Math.max(1, Math.round(downloadRatio * 100));

  return (
    <View style={styles.wrap}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionTitle}>
            {t('home.videoBanner.sectionTitle', { defaultValue: 'Featured Video' })}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        {localUri && !preparing && !loadFailed ? (
          <VideoBannerPlayer
            key={localUri}
            uri={localUri}
            displayBadge={displayBadge}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
          />
        ) : (
          <View style={styles.media}>
            <View style={styles.cover}>
              {loadFailed ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={28} color={COLORS.primary} />
                  <Text style={styles.errorText}>
                    {t('home.videoBanner.loadError', {
                      defaultValue: 'Video could not load',
                    })}
                  </Text>
                  <TouchableOpacity style={styles.retryBtnInline} onPress={() => void prepare()}>
                    <Text style={styles.retryText}>
                      {t('common.retry', { defaultValue: 'Retry' })}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>
                    {t('home.videoBanner.preparing', {
                      defaultValue: 'Preparing video…',
                    })}{' '}
                    {percent}%
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.topRow} pointerEvents="none">
              {displayBadge ? (
                <View style={styles.badge}>
                  <Ionicons name="videocam" size={11} color="#fff" />
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {displayBadge}
                  </Text>
                </View>
              ) : (
                <View />
              )}
            </View>
          </View>
        )}

        <View style={styles.infoPanel}>
          <Text style={styles.title} numberOfLines={2}>
            {displayTitle}
          </Text>
          {onPressCta ? (
            <TouchableOpacity style={styles.cta} onPress={onPressCta} activeOpacity={0.88}>
              <Text style={styles.ctaText}>{displayCta}</Text>
              <Ionicons name="arrow-forward" size={15} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primaryDark,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  media: {
    height: BANNER_HEIGHT,
    width: '100%',
    backgroundColor: '#D7E3D9',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  videoHidden: {
    opacity: 0,
  },
  cover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#D7E3D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: {
    color: COLORS.textSecondary ?? COLORS.text,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
    }),
  },
  errorBox: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  errorText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },
  retryBtnInline: {
    marginTop: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: {
    color: '#fff',
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  topRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badge: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '70%',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  chipIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primaryLight,
  },
  infoPanel: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: COLORS.background,
  },
  title: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    lineHeight: 22,
    marginBottom: 12,
  },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  ctaText: {
    color: '#fff',
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
});

export default VideoBanner;
