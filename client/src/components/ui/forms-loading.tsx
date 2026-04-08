import { FileText, Loader2 } from "lucide-react";

export function FormsLoading() {
  console.log('⏳ FormsLoading component rendered - lazy loading form builder in progress');
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="relative mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-xl flex items-center justify-center mx-auto shadow-lg">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <Loader2 className="w-3 h-3 text-white animate-spin" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">Loading Form Builder</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
          Preparing the drag-and-drop form builder...
        </p>
        <div className="flex items-center justify-center space-x-2 text-xs text-slate-500 dark:text-slate-500">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
} 