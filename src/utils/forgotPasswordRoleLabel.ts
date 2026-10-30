import type { ForgotPasswordRole } from '../services/forgotPasswordTypes';

/** i18n keys under `roleSelection.*.title` for portal badge on forgot-password screens. */
export function getForgotPasswordRoleTitleKey(role: ForgotPasswordRole): string {
  switch (role) {
    case 'client':
      return 'roleSelection.client.title';
    case 'admin':
      return 'roleSelection.admin.title';
    case 'hr':
      return 'roleSelection.hrManager.title';
    case 'area_manager':
      return 'roleSelection.areaManager.title';
    case 'supervisor':
      return 'roleSelection.supervisor.title';
    case 'technician':
      return 'roleSelection.worker.title';
    case 'vendor':
      return 'roleSelection.vendor.title';
    case 'delivery':
      return 'auth.forgotReset.deliveryPortal';
    default:
      return 'roleSelection.client.title';
  }
}
