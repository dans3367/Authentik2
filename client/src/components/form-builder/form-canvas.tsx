import { FormElement, FormElementType } from '@/types/form-builder';
import { DroppableCanvas } from './droppable-canvas';
import { useTranslation } from 'react-i18next';

interface FormCanvasProps {
  formTitle: string;
  elements: FormElement[];
  selectedElementId: string | null;
  previewMode: boolean;
  draggedType: FormElementType | null;
  onSelectElement: (id: string | null) => void;
  onRemoveElement: (id: string) => void;
  onUpdateElement: (id: string, updates: Partial<FormElement>) => void;
  onUpdateFormTitle: (title: string) => void;
  onTogglePreview: () => void;
  onMobileEdit?: (id: string) => void;
  isDragging?: boolean;
  onMoveElement?: (fromIndex: number, toIndex: number) => void;
}

export function FormCanvas({
  formTitle,
  elements,
  selectedElementId,
  previewMode,
  draggedType,
  onSelectElement,
  onRemoveElement,
  onUpdateElement,
  onUpdateFormTitle,
  onTogglePreview,
  onMobileEdit,
  isDragging = false,
  onMoveElement,
}: FormCanvasProps) {
  const { t } = useTranslation();
  return (
    <main className="flex flex-col bg-stone-50 dark:bg-neutral-950">
      {/* Canvas Header */}
      <div className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm border-b border-stone-200/60 dark:border-neutral-800/60 px-3 md:px-5 py-2.5 md:py-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-stone-400 dark:text-neutral-500 flex items-center">
              {previewMode ? (
                <>
                  <svg className="w-3 h-3 mr-1.5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                  </svg>
                  <span className="hidden sm:inline">{t('formBuilder.canvas.previewFull', 'Preview mode - see how your form will look to users')}</span>
                  <span className="sm:hidden">{t('formBuilder.canvas.previewShort', 'Preview mode')}</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse flex-shrink-0"></div>
                  <span className="hidden sm:inline">{t('formBuilder.canvas.buildFull', 'Build mode - drag or click to add')}</span>
                  <span className="sm:hidden">{t('formBuilder.canvas.buildShort', 'Build mode')}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center">
            <div className="flex bg-stone-100 dark:bg-neutral-800 rounded-lg p-0.5">
              <button
                className={`px-2.5 md:px-3.5 py-1.5 text-xs font-medium rounded-md transition-all duration-150 flex items-center space-x-1.5 ${
                  !previewMode
                    ? 'bg-white dark:bg-neutral-700 text-stone-800 dark:text-stone-200 shadow-sm'
                    : 'text-stone-500 dark:text-neutral-400 hover:text-stone-700 dark:hover:text-stone-300'
                }`}
                onClick={onTogglePreview}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                </svg>
                <span className="hidden sm:inline">{t('formBuilder.canvas.buttons.edit', 'Edit')}</span>
              </button>
              <button
                className={`px-2.5 md:px-3.5 py-1.5 text-xs font-medium rounded-md transition-all duration-150 flex items-center space-x-1.5 ${
                  previewMode
                    ? 'bg-white dark:bg-neutral-700 text-stone-800 dark:text-stone-200 shadow-sm'
                    : 'text-stone-500 dark:text-neutral-400 hover:text-stone-700 dark:hover:text-stone-300'
                }`}
                onClick={onTogglePreview}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                </svg>
                <span className="hidden sm:inline">{t('formBuilder.canvas.buttons.preview', 'Preview')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <DroppableCanvas
        elements={elements}
        selectedElementId={selectedElementId}
        onSelectElement={onSelectElement}
        onRemoveElement={onRemoveElement}
        onUpdateElement={onUpdateElement}
        formTitle={formTitle}
        previewMode={previewMode}
        draggedType={draggedType}
        onMobileEdit={onMobileEdit}
        isDragging={isDragging}
        onMoveElement={onMoveElement}
      />
    </main>
  );
}
