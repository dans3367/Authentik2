import { lazy, Suspense, ComponentProps } from 'react';

// Lazy load the heavy RichTextEditor component (includes TipTap ~300KB)
const RichTextEditorLazy = lazy(() => import('./RichTextEditor'));

// Loading placeholder that matches the editor's approximate size
function EditorLoadingPlaceholder({ className }: { className?: string }) {
    return (
        <div className={`border rounded-lg ${className || ''}`}>
            {/* Toolbar skeleton */}
            <div className="flex items-center gap-1 p-2 border-b bg-gray-50 dark:bg-gray-800">
                <div className="flex gap-1">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    ))}
                </div>
                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-2" />
                <div className="flex gap-1">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    ))}
                </div>
            </div>
            {/* Content area skeleton */}
            <div className="p-4 min-h-[200px] space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-5/6" />
            </div>
        </div>
    );
}

// Props type - matches the RichTextEditor component
type LazyRichTextEditorProps = ComponentProps<typeof RichTextEditorLazy>;

/**
 * Lazy-loaded wrapper for RichTextEditor.
 * This reduces initial bundle size by ~300-400KB by only loading
 * the TipTap editor when it's actually needed (e.g., when opening dialogs).
 */
export default function LazyRichTextEditor(props: LazyRichTextEditorProps) {
    return (
        <Suspense fallback={<EditorLoadingPlaceholder className={props.className} />}>
            <RichTextEditorLazy {...props} />
        </Suspense>
    );
}
