import { Dimensions } from 'react-native';

// Theme Colors - Tandil Brand
export const COLORS = {
  primary: '#1c4b27', // Tandil green
  primaryDark: '#0f2513',
  primaryLight: '#2d7541',

  secondary: '#6D4C41', // brown
  secondaryLight: '#8D6E63',

  background: '#FFFFFF',
  backgroundDark: '#0F172A',

  surface: '#eeeade', // Tandil light beige
  surfaceLight: '#F8F6F0', // lighter variant
  surfaceDark: '#24303A',

  text: '#1E293B',
  textDark: '#FFFFFF',
  textSecondary: '#64748B',
  textSecondaryDark: '#94A3B8',

  success: '#1c4b27',
  warning: '#E0A100',
  error: '#D14343',
  info: '#2B8AE0',

  border: '#E3E8EF',
  borderDark: '#3A4551',

  shadow: 'rgba(16, 24, 40, 0.08)',
  shadowDark: 'rgba(0, 0, 0, 0.3)',
};

// Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border Radius
export const BORDER_RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  round: 50,
};

// Font Sizes (responsive)
// Base reference is iPhone width 375. We clamp scale for usability on very small screens (e.g., 320px)
const { width: deviceWidth } = Dimensions.get('window');
const referenceWidth = 375;
const rawScale = deviceWidth / referenceWidth;
// Only downscale on smaller screens; never upscale above 1 to avoid oversized text
const clampedScale = Math.max(0.8, Math.min(1, rawScale));
const scaleFont = (size: number) => Math.round(size * clampedScale);

export const FONT_SIZES = {
  xs: scaleFont(12),
  sm: scaleFont(14),
  md: scaleFont(16),
  lg: scaleFont(18),
  xl: scaleFont(20),
  xxl: scaleFont(24),
  xxxl: scaleFont(32),
};

// Font Weights
export const FONT_WEIGHTS = {
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
};

// Screen Dimensions
export const SCREEN = {
  width: 375, // iPhone 12 Pro width
  height: 812, // iPhone 12 Pro height
};

// Animation Durations
export const ANIMATION = {
  fast: 200,
  normal: 300,
  slow: 500,
};

// API Endpoints (Mock)
export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    forgotPassword: '/auth/forgot-password',
    verifyOTP: '/auth/verify-otp',
    resetPassword: '/auth/reset-password',
  },
  services: {
    categories: '/services/categories',
    services: '/services',
    service: '/services/:id',
  },
  orders: {
    create: '/orders',
    list: '/orders',
    detail: '/orders/:id',
    track: '/orders/:id/track',
    update: '/orders/:id',
  },
  products: {
    list: '/products',
    detail: '/products/:id',
    search: '/products/search',
  },
  user: {
    profile: '/user/profile',
    loyalty: '/user/loyalty',
    notifications: '/user/notifications',
  },
};

// Order Status Labels
export const ORDER_STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// Service Categories
export const SERVICE_CATEGORIES = [
  {
    id: 'watering',
    name: 'Watering',
    description: 'Scheduled irrigation for trees and palms',
    icon: 'water',
  },
  {
    id: 'planting',
    name: 'Planting',
    description: 'Soil preparation and sapling/seed planting',
    icon: 'leaf',
  },
  {
    id: 'cleaning',
    name: 'Cleaning',
    description: 'Garden area cleaning and waste removal',
    icon: 'brush',
  },
  {
    id: 'care',
    name: 'Full Care',
    description: 'Pruning, fertilizing and seasonal maintenance',
    icon: 'construct',
  },
];

// Payment Methods
export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash on Delivery', icon: 'money' },
  { id: 'card', label: 'Credit/Debit Card', icon: 'card' },
  { id: 'wallet', label: 'Digital Wallet', icon: 'wallet' },
];

// Languages
export const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ur', name: 'اردو', flag: '🇵🇰' },
];

// Mock Data IDs
export const MOCK_IDS = {
  user: 'user_001',
  order: 'order_001',
  service: 'service_001',
  product: 'product_001',
  technician: 'tech_001',
  delivery: 'delivery_001',
}; 