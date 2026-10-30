import { COLORS } from '../constants';
import type { ForgotPasswordRole } from '../services/forgotPasswordTypes';

export type ForgotPasswordRoleTheme = {
  accent: string;
  icon: 'person' | 'shield-checkmark' | 'briefcase' | 'map' | 'people' | 'leaf' | 'storefront' | 'bicycle';
};

const THEMES: Record<ForgotPasswordRole, ForgotPasswordRoleTheme> = {
  client: { accent: COLORS.primary, icon: 'person' },
  admin: { accent: '#1A3A24', icon: 'shield-checkmark' },
  hr: { accent: COLORS.secondary, icon: 'briefcase' },
  area_manager: { accent: '#5B7C5A', icon: 'map' },
  supervisor: { accent: '#3D6B4F', icon: 'people' },
  technician: { accent: '#2E7D4F', icon: 'leaf' },
  vendor: { accent: '#8B6914', icon: 'storefront' },
  delivery: { accent: '#2563EB', icon: 'bicycle' },
};

export function getForgotPasswordRoleTheme(role: ForgotPasswordRole): ForgotPasswordRoleTheme {
  return THEMES[role] ?? THEMES.client;
}
