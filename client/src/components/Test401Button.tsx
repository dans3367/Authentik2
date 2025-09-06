import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";

export function Test401Button() {
  const [testType, setTestType] = useState<'api' | 'query' | null>(null);

  // Test 401 via direct API call
  const testApiMutation = useMutation({
    mutationFn: async () => {
      console.log('🧪 [Test] Triggering 401 via direct API call...');
      // Try to access an endpoint that should return 401 when not authorized
      return await apiRequest('GET', '/api/test/unauthorized');
    },
    onError: (error) => {
      console.log('🧪 [Test] API mutation error caught:', error);
    }
  });

  // Test 401 via React Query
  const { refetch: testQuery, isError, error, isFetching } = useQuery({
    queryKey: ['/api/test/unauthorized'],
    enabled: false, // Don't run automatically
    retry: false, // Don't retry on error for testing
  });

  const handleTestApi = () => {
    setTestType('api');
    testApiMutation.mutate();
  };

  const handleTestQuery = () => {
    setTestType('query');
    testQuery();
  };

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700">
      <h3 className="font-semibold text-sm mb-2">401 Error Handler Test</h3>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        These buttons will trigger 401 errors to test the automatic logout and redirect functionality.
      </p>
      <div className="flex gap-2 flex-wrap">
        <Button 
          size="sm" 
          variant="outline"
          onClick={handleTestApi}
          disabled={testApiMutation.isPending}
        >
          {testApiMutation.isPending ? 'Testing API...' : 'Test 401 (API)'}
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={handleTestQuery}
          disabled={isFetching}
        >
          {isFetching ? 'Testing Query...' : 'Test 401 (Query)'}
        </Button>
      </div>
      {testType && (
        <div className="mt-2 text-xs">
          <p className="text-blue-600 dark:text-blue-400">
            🔍 Check console for logs. If working correctly, you should be redirected to /auth
          </p>
        </div>
      )}
    </div>
  );
}
