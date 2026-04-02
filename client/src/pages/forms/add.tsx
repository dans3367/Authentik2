import { FormWizard } from '@/components/form-builder/form-wizard';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useReduxAuth } from '@/hooks/useReduxAuth';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation as useI18n } from 'react-i18next';
import { usePermissions } from '@/hooks/usePermissions';

export default function AddForm() {
  const { isAuthenticated, isLoading: authLoading, isInitialized } = useReduxAuth();
  const [, setLocation] = useLocation();
  const { t } = useI18n();
  const { hasPermission } = usePermissions();

  // Redirect unauthenticated users immediately
  if (isInitialized && !isAuthenticated) {
    setLocation('/auth');
    return null;
  }

  // Redirect if user doesn't have create permission
  if (!hasPermission('forms.create')) {
    setLocation('/forms');
    return null;
  }

  // Show loading while authentication is being determined
  if (!isInitialized || authLoading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-4">{t('auth.authenticating', 'Authenticating...')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <FormWizard />
    </div>
  );
}
