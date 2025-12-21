import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { LucideIcon } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
}

interface PageTitleContextType {
  title: string;
  subtitle?: string;
  breadcrumbs: BreadcrumbItem[];
  setPageTitle: (title: string, subtitle?: string) => void;
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void;
}

const PageTitleContext = createContext<PageTitleContextType | undefined>(undefined);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState<string | undefined>();
  const [breadcrumbs, setBreadcrumbsState] = useState<BreadcrumbItem[]>([]);

  const setPageTitle = useCallback((newTitle: string, newSubtitle?: string) => {
    setTitle((prev) => (prev === newTitle ? prev : newTitle));
    setSubtitle((prev) => (prev === newSubtitle ? prev : newSubtitle));
  }, []);

  const setBreadcrumbs = useCallback((newBreadcrumbs: BreadcrumbItem[]) => {
    setBreadcrumbsState(newBreadcrumbs);
  }, []);

  const value = useMemo(
    () => ({ title, subtitle, breadcrumbs, setPageTitle, setBreadcrumbs }),
    [title, subtitle, breadcrumbs, setPageTitle, setBreadcrumbs],
  );

  return (
    <PageTitleContext.Provider value={value}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle() {
  const context = useContext(PageTitleContext);
  if (!context) {
    throw new Error("usePageTitle must be used within a PageTitleProvider");
  }
  return context;
}

// Hook for pages to set their title on mount
export function useSetPageTitle(title: string, subtitle?: string) {
  const { setPageTitle } = usePageTitle();
  
  useEffect(() => {
    setPageTitle(title, subtitle);
  }, [title, subtitle, setPageTitle]);
}

// Hook for pages to set breadcrumbs on mount
export function useSetBreadcrumbs(breadcrumbs: BreadcrumbItem[]) {
  const { setBreadcrumbs } = usePageTitle();
  
  useEffect(() => {
    setBreadcrumbs(breadcrumbs);
    return () => setBreadcrumbs([]);
  }, [JSON.stringify(breadcrumbs), setBreadcrumbs]);
}
