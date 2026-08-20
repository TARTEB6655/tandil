import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { publicApiClient } from './api';
import { buildFullImageUrl } from '../config/api';

const CACHE_KEY = 'client_active_video_banner_v1';

/**
 * Public client video banner (GET /api/video-banners).
 * Matches Postman: Client Dashboard → K2. Video Banner (Public) → Get Active Video Banners
 */
export interface ClientVideoBanner {
  id: number;
  title: string;
  badge_text?: string | null;
  button_text?: string | null;
  video?: string | null;
  video_url?: string | null;
  is_active?: boolean | number | string;
  created_at?: string;
  updated_at?: string;
}

let memoryBanner: ClientVideoBanner | null | undefined;
let inflightFetch: Promise<ClientVideoBanner | null> | null = null;
const localVideoJobs = new Map<string, Promise<string>>();

function isVideoBannerActive(banner: ClientVideoBanner): boolean {
  if (banner.is_active === false || banner.is_active === 0 || banner.is_active === '0') {
    return false;
  }
  return true;
}

function parseVideoBannerList(body: unknown): ClientVideoBanner[] {
  if (!body) return [];
  if (Array.isArray(body)) return body as ClientVideoBanner[];
  if (typeof body !== 'object') return [];

  const root = body as Record<string, unknown>;
  const raw =
    root.data ?? root.video_banners ?? root.video_banner ?? root.banners ?? null;

  if (Array.isArray(raw)) return raw as ClientVideoBanner[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: ClientVideoBanner[] }).data;
  }
  if (raw && typeof raw === 'object' && (raw as ClientVideoBanner).id != null) {
    return [raw as ClientVideoBanner];
  }
  return [];
}

function pickActiveBanner(list: ClientVideoBanner[]): ClientVideoBanner | null {
  const active = list.filter(isVideoBannerActive);
  for (const banner of active) {
    if (getVideoBannerVideoUrl(banner)) return banner;
  }
  return null;
}

export function getVideoBannerVideoUrl(banner: ClientVideoBanner): string | null {
  const raw = banner.video_url ?? banner.video ?? null;
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
  const url = raw.trim();
  return url.startsWith('http') ? url : buildFullImageUrl(url);
}

/** Instant in-memory banner from a previous Home load (same session). */
export function getMemoryVideoBanner(): ClientVideoBanner | null {
  return memoryBanner ?? null;
}

/** Last saved banner for instant Home paint before network returns. */
export async function getCachedVideoBanner(): Promise<ClientVideoBanner | null> {
  if (memoryBanner !== undefined) return memoryBanner;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) {
      memoryBanner = null;
      return null;
    }
    const parsed = JSON.parse(raw) as ClientVideoBanner;
    if (!parsed?.id || !isVideoBannerActive(parsed) || !getVideoBannerVideoUrl(parsed)) {
      memoryBanner = null;
      return null;
    }
    memoryBanner = parsed;
    return parsed;
  } catch {
    memoryBanner = null;
    return null;
  }
}

async function saveCachedVideoBanner(banner: ClientVideoBanner | null): Promise<void> {
  memoryBanner = banner;
  try {
    if (!banner) {
      await AsyncStorage.removeItem(CACHE_KEY);
      return;
    }
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(banner));
  } catch {
    // ignore cache write failures
  }
}

function hashUrl(url: string): string {
  let h = 2166136261;
  for (let i = 0; i < url.length; i += 1) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function localVideoPath(remoteUrl: string): string | null {
  const dir = FileSystem.cacheDirectory;
  if (!dir) return null;
  return `${dir}video_banner_${hashUrl(remoteUrl)}.mp4`;
}

/**
 * Download featured video to disk cache.
 * Needed because uploaded MP4s often have moov at the end (~full file must load
 * before streaming players can decode a frame).
 */
export async function ensureLocalHomeVideo(
  remoteUrl: string,
  onProgress?: (ratio: number) => void
): Promise<string> {
  const existing = localVideoJobs.get(remoteUrl);
  if (existing) {
    const uri = await existing;
    onProgress?.(1);
    return uri;
  }

  const job = (async () => {
    const fileUri = localVideoPath(remoteUrl);
    if (!fileUri) return remoteUrl;

    try {
      const info = await FileSystem.getInfoAsync(fileUri);
      if (info.exists && 'size' in info && typeof info.size === 'number' && info.size > 10_000) {
        onProgress?.(1);
        return fileUri;
      }
    } catch {
      // continue to download
    }

    const download = FileSystem.createDownloadResumable(
      remoteUrl,
      fileUri,
      {},
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        if (totalBytesExpectedToWrite > 0) {
          onProgress?.(Math.min(totalBytesWritten / totalBytesExpectedToWrite, 0.99));
        }
      }
    );

    const result = await download.downloadAsync();
    if (!result?.uri) {
      throw new Error('Video download failed');
    }
    onProgress?.(1);
    return result.uri;
  })();

  localVideoJobs.set(remoteUrl, job);
  try {
    return await job;
  } catch (e) {
    localVideoJobs.delete(remoteUrl);
    throw e;
  }
}

/** Start caching the home featured video in the background. */
export function preloadHomeVideo(url?: string | null): void {
  if (!url) return;
  void ensureLocalHomeVideo(url).catch(() => {
    // ignore preload failures; UI will retry on play
  });
}

/**
 * GET /api/video-banners — public active featured video.
 * Dedupes concurrent calls and writes AsyncStorage for next open.
 */
export async function getActiveVideoBanner(): Promise<ClientVideoBanner | null> {
  if (inflightFetch) return inflightFetch;

  inflightFetch = (async () => {
    try {
      const response = await publicApiClient.get('/video-banners', {
        timeout: 12000,
        headers: { Accept: 'application/json' },
      });
      const body = response?.data ?? response;
      const banner = pickActiveBanner(parseVideoBannerList(body));
      await saveCachedVideoBanner(banner);
      return banner;
    } catch {
      const cached = await getCachedVideoBanner();
      return cached;
    } finally {
      inflightFetch = null;
    }
  })();

  return inflightFetch;
}
