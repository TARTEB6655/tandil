import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import apiClient from './api';
import { API_CONFIG } from '../config/api';

export type VendorAnalyticsPeriod = 'week' | 'month' | 'quarter' | 'year' | string;

export interface VendorAnalyticsFilter {
  id: string;
  label: string;
  selected?: boolean;
}

export interface VendorAnalyticsMetric {
  value: number;
  subtitle?: string;
  currency?: string;
  unit?: string;
  display?: string;
  growth_percent?: number;
  growth_display?: string;
  max?: number;
  available?: boolean;
}

export interface VendorAnalyticsDataPoint {
  label: string;
  orders?: number;
  revenue?: number;
}

export interface VendorAnalyticsTopProduct {
  name?: string;
  title?: string;
  orders?: number;
  revenue?: number | string;
  revenue_display?: string;
  growth?: string;
  growth_display?: string;
}

export interface VendorAnalyticsActivity {
  type?: string;
  message?: string;
  time?: string;
  time_ago?: string;
  value?: string;
  value_display?: string;
}

export interface VendorAnalyticsAction {
  id: string;
  label: string;
  available?: boolean;
}

export interface VendorAnalyticsShareLink {
  token: string;
  period: string;
  share_url: string;
  view_url?: string;
  file_url?: string;
  expires_at?: string;
  expires_in_days?: number;
}

export interface VendorAnalyticsPayload {
  title: string;
  subtitle: string;
  period: string;
  period_label: string;
  filters: VendorAnalyticsFilter[];
  overview: {
    title?: string;
    period_label?: string;
    total_products?: VendorAnalyticsMetric;
    total_orders?: VendorAnalyticsMetric;
    total_revenue?: VendorAnalyticsMetric;
    total_views?: VendorAnalyticsMetric;
  };
  performance_metrics: {
    conversion_rate?: VendorAnalyticsMetric;
    avg_order_value?: VendorAnalyticsMetric;
    satisfaction?: VendorAnalyticsMetric;
    return_rate?: VendorAnalyticsMetric;
  };
  trends: {
    daily_performance?: {
      title?: string;
      data_points?: VendorAnalyticsDataPoint[];
      data_points_count?: number;
    };
    weekly_revenue?: {
      title?: string;
      data_points?: VendorAnalyticsDataPoint[];
      data_points_count?: number;
    };
  };
  top_products: VendorAnalyticsTopProduct[];
  recent_activity: VendorAnalyticsActivity[];
  actions: VendorAnalyticsAction[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function pickNumber(...values: unknown[]): number {
  for (const value of values) {
    if (value == null || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function mapMetric(raw: unknown): VendorAnalyticsMetric | undefined {
  const row = asRecord(raw);
  if (!row) return undefined;
  return {
    value: pickNumber(row.value),
    subtitle: pickString(row.subtitle) || undefined,
    currency: pickString(row.currency) || undefined,
    unit: pickString(row.unit) || undefined,
    display: pickString(row.display) || undefined,
    growth_percent:
      row.growth_percent == null || row.growth_percent === ''
        ? undefined
        : Number(row.growth_percent),
    growth_display: pickString(row.growth_display) || undefined,
    max: row.max == null || row.max === '' ? undefined : Number(row.max),
    available: typeof row.available === 'boolean' ? row.available : undefined,
  };
}

function mapDataPoints(raw: unknown): VendorAnalyticsDataPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = asRecord(item) ?? {};
    return {
      label: pickString(row.label, row.day, row.week) || '—',
      orders: pickNumber(row.orders),
      revenue: pickNumber(row.revenue),
    };
  });
}

function mapTopProducts(raw: unknown): VendorAnalyticsTopProduct[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = asRecord(item) ?? {};
    return {
      name: pickString(row.name, row.title, row.product_name) || undefined,
      title: pickString(row.title, row.name) || undefined,
      orders: pickNumber(row.orders),
      revenue: row.revenue as number | string | undefined,
      revenue_display: pickString(row.revenue_display, row.revenue) || undefined,
      growth: pickString(row.growth, row.growth_display) || undefined,
      growth_display: pickString(row.growth_display, row.growth) || undefined,
    };
  });
}

function mapActivity(raw: unknown): VendorAnalyticsActivity[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = asRecord(item) ?? {};
    return {
      type: pickString(row.type) || undefined,
      message: pickString(row.message, row.title, row.description) || undefined,
      time: pickString(row.time, row.time_ago, row.created_at) || undefined,
      time_ago: pickString(row.time_ago, row.time) || undefined,
      value: pickString(row.value, row.value_display) || undefined,
      value_display: pickString(row.value_display, row.value) || undefined,
    };
  });
}

function mapActions(raw: unknown): VendorAnalyticsAction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = asRecord(item) ?? {};
      const id = pickString(row.id);
      const label = pickString(row.label, row.title);
      if (!id && !label) return null;
      return {
        id: id || label.toLowerCase().replace(/\s+/g, '_'),
        label: label || id,
        available: typeof row.available === 'boolean' ? row.available : true,
      };
    })
    .filter((item): item is VendorAnalyticsAction => item != null);
}

function mapAnalyticsPayload(raw: Record<string, unknown>): VendorAnalyticsPayload {
  const overview = asRecord(raw.overview) ?? {};
  const performance = asRecord(raw.performance_metrics) ?? asRecord(raw.performance) ?? {};
  const trends = asRecord(raw.trends) ?? {};
  const daily = asRecord(trends.daily_performance) ?? {};
  const weekly = asRecord(trends.weekly_revenue) ?? {};

  const filtersRaw = Array.isArray(raw.filters) ? raw.filters : [];
  const filters: VendorAnalyticsFilter[] = filtersRaw
    .map((item) => {
      const row = asRecord(item) ?? {};
      const id = pickString(row.id);
      const label = pickString(row.label, row.name);
      if (!id && !label) return null;
      return {
        id: id || label.toLowerCase(),
        label: label || id,
        selected: Boolean(row.selected),
      };
    })
    .filter((item): item is VendorAnalyticsFilter => item != null);

  return {
    title: pickString(raw.title) || 'Analytics',
    subtitle: pickString(raw.subtitle) || 'Sales, orders & performance',
    period: pickString(raw.period) || 'month',
    period_label: pickString(raw.period_label, overview.period_label) || 'This Month',
    filters:
      filters.length > 0
        ? filters
        : [
            { id: 'week', label: 'Week' },
            { id: 'month', label: 'Month', selected: true },
            { id: 'quarter', label: 'Quarter' },
            { id: 'year', label: 'Year' },
          ],
    overview: {
      title: pickString(overview.title) || 'Overview',
      period_label: pickString(overview.period_label, raw.period_label) || undefined,
      total_products: mapMetric(overview.total_products),
      total_orders: mapMetric(overview.total_orders),
      total_revenue: mapMetric(overview.total_revenue),
      total_views: mapMetric(overview.total_views),
    },
    performance_metrics: {
      conversion_rate: mapMetric(performance.conversion_rate),
      avg_order_value: mapMetric(performance.avg_order_value),
      satisfaction: mapMetric(performance.satisfaction),
      return_rate: mapMetric(performance.return_rate),
    },
    trends: {
      daily_performance: {
        title: pickString(daily.title) || 'Daily Performance',
        data_points: mapDataPoints(daily.data_points),
        data_points_count: pickNumber(daily.data_points_count, (daily.data_points as unknown[])?.length),
      },
      weekly_revenue: {
        title: pickString(weekly.title) || 'Weekly Revenue',
        data_points: mapDataPoints(weekly.data_points),
        data_points_count: pickNumber(
          weekly.data_points_count,
          (weekly.data_points as unknown[])?.length
        ),
      },
    },
    top_products: mapTopProducts(raw.top_products),
    recent_activity: mapActivity(raw.recent_activity),
    actions: mapActions(raw.actions),
  };
}

function extractAnalytics(payload: unknown): VendorAnalyticsPayload {
  const body = asRecord(payload);
  if (!body) throw new Error('Failed to load analytics.');
  if (body.success === false || body.status === false) {
    throw new Error(pickString(body.message) || 'Failed to load analytics.');
  }

  const data = asRecord(body.data) ?? body;
  const analytics = asRecord(data.analytics) ?? data;

  if (!asRecord(analytics.overview) && !asRecord(analytics.performance_metrics)) {
    // Still try mapping — filters/title may be enough, or raise if totally empty
    if (!pickString(analytics.title) && !Array.isArray(analytics.filters)) {
      throw new Error(pickString(body.message) || 'Analytics data missing.');
    }
  }

  return mapAnalyticsPayload(analytics);
}

export const vendorAnalyticsService = {
  /** GET /vendor/analytics/performance?period=month */
  async getPerformance(period: VendorAnalyticsPeriod = 'month'): Promise<VendorAnalyticsPayload> {
    const response = await apiClient.get('/vendor/analytics/performance', {
      params: { period },
      timeout: 20000,
    });
    return extractAnalytics(response.data);
  },

  /**
   * GET /vendor/analytics/performance/export?period=month
   * Downloads CSV to cache and returns the local file URI.
   */
  async exportPerformanceCsv(period: VendorAnalyticsPeriod = 'month'): Promise<string> {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Please login again to export the report.');
    }

    const safePeriod = String(period || 'month');
    const downloadUrl = `${API_CONFIG.baseURL}/vendor/analytics/performance/export?period=${encodeURIComponent(safePeriod)}`;
    const stamp = new Date().toISOString().slice(0, 10);
    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
    if (!cacheDir) {
      throw new Error('Unable to access device storage for export.');
    }
    const fileUri = `${cacheDir}vendor-performance-${safePeriod}-${stamp}.csv`;

    const result = await FileSystem.downloadAsync(downloadUrl, fileUri, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/csv,application/csv,application/json,*/*',
      },
    });

    if (result.status < 200 || result.status >= 300) {
      throw new Error('Failed to export performance report.');
    }

    // If backend returned JSON error as a file, surface the message.
    try {
      const head = await FileSystem.readAsStringAsync(result.uri, {
        length: 200,
        position: 0,
      });
      if (head.trim().startsWith('{')) {
        const parsed = JSON.parse(head) as { message?: string; success?: boolean };
        if (parsed.success === false || parsed.message) {
          throw new Error(parsed.message || 'Failed to export performance report.');
        }
      }
    } catch (err) {
      if (err instanceof Error && /Failed to export|login again|storage/i.test(err.message)) {
        throw err;
      }
      // Not JSON / partial read — treat as valid CSV.
    }

    return result.uri;
  },

  /**
   * POST /vendor/analytics/performance/share?period=month
   * Creates a public share link for performance analytics.
   */
  async sharePerformance(period: VendorAnalyticsPeriod = 'month'): Promise<VendorAnalyticsShareLink> {
    const response = await apiClient.post(
      '/vendor/analytics/performance/share',
      null,
      {
        params: { period },
        timeout: 20000,
      }
    );

    const body = asRecord(response.data);
    if (!body) throw new Error('Failed to create share link.');
    if (body.success === false || body.status === false) {
      throw new Error(pickString(body.message) || 'Failed to create share link.');
    }

    const data = asRecord(body.data) ?? body;
    const share = asRecord(data.share) ?? data;
    const shareUrl = pickString(share.share_url, share.view_url, share.url);
    if (!shareUrl) {
      throw new Error(pickString(body.message) || 'Share link missing from response.');
    }

    return {
      token: pickString(share.token),
      period: pickString(share.period, period) || String(period),
      share_url: shareUrl,
      view_url: pickString(share.view_url, share.share_url) || undefined,
      file_url: pickString(share.file_url, share.download_url) || undefined,
      expires_at: pickString(share.expires_at) || undefined,
      expires_in_days:
        share.expires_in_days == null || share.expires_in_days === ''
          ? undefined
          : Number(share.expires_in_days),
    };
  },
};
