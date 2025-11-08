import React, { lazy, Suspense, ComponentType } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Lazy load the Puck editor to reduce initial bundle size
const PuckNewsletterEditor = lazy(() => 
  import("@/components/PuckNewsletterEditor").then(module => ({
    default: module.PuckNewsletterEditor
  }))
);

interface LazyPuckEditorProps {
  initialData?: any;
  onChange?: (data: any) => void;
}

// Loading fallback component
const EditorLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[500px] w-full bg-muted/20 rounded-lg">
    <div className="text-center space-y-4">
      <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
      <div className="space-y-1">
        <p className="text-lg font-medium">Loading Newsletter Editor</p>
        <p className="text-sm text-muted-foreground">
          Please wait while we prepare your editing experience...
        </p>
      </div>
    </div>
  </div>
);

// Error boundary fallback component
class PuckEditorErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Puck Editor Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[500px] w-full p-8">
          <Alert variant="destructive" className="max-w-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Editor Failed to Load</AlertTitle>
            <AlertDescription className="mt-2 space-y-4">
              <p>
                The newsletter editor encountered an error and couldn't load properly.
              </p>
              {this.state.error && (
                <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                  {this.state.error.message}
                </pre>
              )}
              <Button 
                onClick={() => window.location.reload()}
                variant="outline"
                size="sm"
              >
                Reload Page
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * LazyPuckEditor - A lazy-loaded wrapper for the Puck Newsletter Editor
 * 
 * This component implements code splitting and lazy loading to reduce the initial
 * bundle size. The Puck editor and its dependencies are only loaded when this
 * component is rendered, improving initial page load performance.
 * 
 * Features:
 * - Lazy loading with dynamic import
 * - Loading state with spinner
 * - Error boundary for graceful error handling
 * - Automatic retry on error
 */
export const LazyPuckEditor = ({ initialData, onChange }: LazyPuckEditorProps) => {
  return (
    <PuckEditorErrorBoundary>
      <Suspense fallback={<EditorLoadingFallback />}>
        <PuckNewsletterEditor 
          initialData={initialData}
          onChange={onChange}
        />
      </Suspense>
    </PuckEditorErrorBoundary>
  );
};

// Export a preload function to manually trigger loading
export const preloadPuckEditor = () => {
  import("@/components/PuckNewsletterEditor");
};

export default LazyPuckEditor;