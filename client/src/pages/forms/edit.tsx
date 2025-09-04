import { FormWizard } from '@/components/form-builder/form-wizard';
import { useLocation, useRoute } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useReduxAuth } from '@/hooks/useReduxAuth';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface FormData {
  id: string;
  title: string;
  description: string;
  formData: string;
  theme: string;
  isActive: boolean;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function EditForm() {
  const { isAuthenticated, isLoading: authLoading, isInitialized } = useReduxAuth();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/forms/:id/edit');
  const formId = params?.id;

  // Fetch form data for editing
  const { data: formData, isLoading: formLoading, error } = useQuery({
    queryKey: ['/api/forms', formId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/forms/${formId}`);
      const result = await response.json();
      return result.form as FormData;
    },
    enabled: isAuthenticated && isInitialized && !!formId,
  });

  // Redirect unauthenticated users immediately
  if (isInitialized && !isAuthenticated) {
    setLocation('/auth');
    return null;
  }

  // Show loading while authentication is being determined
  if (!isInitialized || authLoading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-4">Authenticating...</span>
        </div>
      </div>
    );
  }

  // Show loading while form data is being fetched
  if (formLoading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-4">Loading form...</span>
        </div>
      </div>
    );
  }

  // Handle form not found or error
  if (error || !formData) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Form Not Found</h1>
          <p className="text-gray-600 mb-6">The form you're trying to edit doesn't exist or you don't have permission to access it.</p>
          <button
            onClick={() => setLocation('/forms')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Forms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <FormWizard editMode={true} formData={formData} />
    </div>
  );
}