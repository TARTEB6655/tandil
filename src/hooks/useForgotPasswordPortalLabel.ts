import { useTranslation } from 'react-i18next';
import type { ForgotPasswordRole } from '../services/forgotPasswordTypes';
import { getForgotPasswordRoleTitleKey } from '../utils/forgotPasswordRoleLabel';

export function useForgotPasswordPortalLabel(role: ForgotPasswordRole): string {
  const { t } = useTranslation();
  return t(getForgotPasswordRoleTitleKey(role));
}
