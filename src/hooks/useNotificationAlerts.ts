import { useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { NotificationAlertFetcher, NotificationAlertItem } from '../types/notificationAlert';
import {
  initNotificationAlerts,
  playNotificationAlert,
} from '../services/notificationSoundService';
import { useAppStore } from '../store';

const POLL_MS = 30_000;

function unreadItems(list: NotificationAlertItem[]): NotificationAlertItem[] {
  return list.filter((n) => !n.read_at);
}

/**
 * Polls role notifications while the app is open; plays system sound when new unread arrive.
 */
export function useNotificationAlerts(
  enabled: boolean,
  fetchNotifications: NotificationAlertFetcher
): void {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetcherRef = useRef(fetchNotifications);

  if (fetcherRef.current !== fetchNotifications) {
    fetcherRef.current = fetchNotifications;
    seededRef.current = false;
    seenIdsRef.current = new Set();
  }

  const processList = useCallback((list: NotificationAlertItem[]) => {
    const unread = unreadItems(list);
    const seen = seenIdsRef.current;

    if (!seededRef.current) {
      unread.forEach((n) => seen.add(n.id));
      seededRef.current = true;
      return;
    }

    const fresh = unread.filter((n) => !seen.has(n.id));
    fresh.forEach((n) => {
      seen.add(n.id);
      playNotificationAlert(n).catch(() => {});
    });

    const unreadIdSet = new Set(unread.map((n) => n.id));
    for (const id of [...seen]) {
      if (!unreadIdSet.has(id)) seen.delete(id);
    }
  }, []);

  const poll = useCallback(async () => {
    if (!enabled || !isAuthenticated) return;
    try {
      const list = await fetchNotifications();
      processList(list);
    } catch {
      /* ignore network errors during poll */
    }
  }, [enabled, isAuthenticated, fetchNotifications, processList]);

  useEffect(() => {
    if (!enabled || !isAuthenticated) {
      seededRef.current = false;
      seenIdsRef.current = new Set();
      return;
    }

    let cancelled = false;

    (async () => {
      await initNotificationAlerts();
      if (cancelled) return;
      await poll();
    })();

    pollingRef.current = setInterval(() => {
      poll();
    }, POLL_MS);

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') poll();
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      cancelled = true;
      if (pollingRef.current) clearInterval(pollingRef.current);
      sub.remove();
    };
  }, [enabled, isAuthenticated, poll]);
}
