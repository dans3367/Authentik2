import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { FormElement, FormElementType } from '@/types/form-builder';
import { FormElementRenderer } from './form-element-renderer';
import { SortableFormElement } from './sortable-form-element';
import { DropInsertionIndicator } from './drop-insertion-indicator';
import { useTranslation } from 'react-i18next';

// End drop zone component for adding elements at the end of the list
function EndDropZone({ elementCount }: { elementCount: number }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'insert-end',
    data: {
      elementId: 'end',
      position: 'bottom',
      isInsertionPoint: true,
      insertIndex: elementCount,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative transition-all duration-150 mt-1 ${
        isOver ? 'h-8' : 'h-4'
      }`}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`w-full h-0.5 rounded-full transition-all duration-150 ${
            isOver 
              ? 'bg-amber-500 shadow-md shadow-amber-500/40 h-1' 
              : 'bg-transparent'
          }`}
        />
      </div>
      {isOver && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-md">
          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  );
}

interface DroppableCanvasProps {
  elements: FormElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onRemoveElement: (id: string) => void;
  onUpdateElement: (id: string, updates: Partial<FormElement>) => void;
  formTitle: string;
  previewMode: boolean;
  draggedType: FormElementType | null;
  onMobileEdit?: (id: string) => void;
  isDragging?: boolean;
  onMoveElement?: (fromIndex: number, toIndex: number) => void;
  showMoveIndicators?: boolean;
  moveDirection?: 'up' | 'down' | null;
  moveFromIndex?: number;
}

export function DroppableCanvas({
  elements,
  selectedElementId,
  onSelectElement,
  onRemoveElement,
  onUpdateElement,
  formTitle,
  previewMode,
  draggedType,
  onMobileEdit,
  isDragging = false,
  onMoveElement,
  showMoveIndicators = false,
  moveDirection = null,
  moveFromIndex = -1,
}: DroppableCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'form-canvas',
  });
  const { t } = useTranslation();
  const isMobile = window.innerWidth < 1024; // lg breakpoint

  if (previewMode) {
    return (
      <div className="p-6 bg-stone-50 dark:bg-neutral-950">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-stone-200 dark:border-neutral-800 p-8">
            <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-200 mb-6">{formTitle}</h1>
            <form className="space-y-6">
              {elements.map((element) => (
                <FormElementRenderer
                  key={element.id}
                  element={element}
                  isSelected={false}
                  onSelect={() => {}}
                  onRemove={() => {}}
                  previewMode={true}
                />
              ))}
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 bg-stone-50 dark:bg-neutral-950">
      <div className="max-w-4xl mx-auto">
        <div
          ref={setNodeRef}
          className={`min-h-80 md:min-h-96 bg-white dark:bg-neutral-900 rounded-xl md:rounded-2xl shadow-sm border-2 transition-all duration-200 relative ${
            isOver
              ? 'border-amber-400 border-solid shadow-amber-100/50 dark:shadow-amber-500/5'
              : isDragging
              ? 'border-amber-300/60 border-dashed'
              : 'border-stone-200 dark:border-neutral-800 border-dashed hover:border-stone-300 dark:hover:border-neutral-700'
          } ${elements.length === 0 ? 'p-4 md:p-8' : 'p-3 md:p-6'}`}
        >
          {elements.length === 0 ? (
            <div className="text-center py-16 md:py-24">
              <div className="relative mb-6">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-500/20 dark:to-amber-600/20 rounded-2xl flex items-center justify-center mx-auto">
                  <svg
                    className="w-7 h-7 md:w-8 md:h-8 text-amber-600 dark:text-amber-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
              </div>

              <h3 className="text-lg md:text-xl font-semibold text-stone-800 dark:text-stone-200 mb-2 tracking-tight">{t('formBuilder.canvas.heroTitle', 'Build Your Perfect Form')}</h3>
              <p className="text-sm text-stone-400 dark:text-neutral-500 mb-8 max-w-sm mx-auto leading-relaxed">
                <span className="hidden md:inline">{t('formBuilder.canvas.heroSubtitleDesktop', 'Start by dragging components from the sidebar, or click on any component to add it instantly.')}</span>
                <span className="md:hidden">{t('formBuilder.canvas.heroSubtitleMobile', 'Tap components to add them to your form.')}</span>
              </p>

              <div className="flex flex-wrap justify-center gap-2 mb-6 px-4">
                {[t('formBuilder.canvas.heroBadgeTextInput','Text Input'), t('formBuilder.canvas.heroBadgeEmail','Email'), t('formBuilder.canvas.heroBadgeDropdown','Dropdown'), t('formBuilder.canvas.heroBadgeSubmit','Submit Button')].map((component, index) => (
                  <span
                    key={`${component}-${index}`}
                    className="px-3 py-1.5 bg-stone-100 dark:bg-neutral-800 text-stone-500 dark:text-neutral-400 text-xs font-medium rounded-full border border-stone-200/60 dark:border-neutral-700/60"
                  >
                    {component}
                  </span>
                ))}
              </div>

              <div className="hidden md:block">
                <div className="text-xs text-stone-400 dark:text-neutral-500">{t('formBuilder.canvas.tryIt','Try it now ↗')}</div>
              </div>
            </div>
          ) : (
            <SortableContext items={elements.map(el => el.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0 pl-8">
                {/* First element drop zone */}
                {isDragging && elements.length > 0 && (
                  <DropInsertionIndicator
                    id="insert-first"
                    position="top"
                    elementId={elements[0].id}
                    isVisible={true}
                  />
                )}
                
                {elements.map((element, index) => {
                  const isMovingElement = showMoveIndicators && moveFromIndex === index;
                  const showMoveIndicatorAbove = showMoveIndicators && moveDirection === 'up' && moveFromIndex === index + 1;
                  const showMoveIndicatorBelow = showMoveIndicators && moveDirection === 'down' && moveFromIndex === index - 1;
                  
                  return (
                    <div key={element.id} className="relative group">
                      {/* Move indicator above */}
                      {showMoveIndicatorAbove && (
                        <div className="h-6 flex items-center justify-center mb-2">
                          <div className="w-full h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 rounded-full shadow-lg shadow-purple-500/30 animate-pulse" />
                        </div>
                      )}
                      
                      <div
                        className={`animate-slide-up relative ${isMovingElement ? 'opacity-50' : ''}`}
                        style={{ 
                          animationDelay: `${index * 50}ms`,
                          zIndex: selectedElementId === element.id ? 200 : 10
                        }}
                      >
                        <SortableFormElement
                          element={element}
                          isSelected={selectedElementId === element.id}
                          onSelect={onSelectElement}
                          onRemove={onRemoveElement}
                          onUpdate={onUpdateElement}
                          onMobileEdit={onMobileEdit}
                          isGlobalDragging={isDragging}
                          showDropIndicators={!isMobile && isDragging}
                          elementIndex={index}
                        />
                      </div>
                      
                      {/* Move indicator below */}
                      {showMoveIndicatorBelow && (
                        <div className="h-6 flex items-center justify-center mt-2">
                          <div className="w-full h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 rounded-full shadow-lg shadow-purple-500/30 animate-pulse" />
                        </div>
                      )}
                      
                    </div>
                  );
                })}
                
                {/* End of list drop zone - always visible when dragging */}
                {isDragging && elements.length > 0 && (
                  <EndDropZone elementCount={elements.length} />
                )}
              </div>
            </SortableContext>
          )}
        </div>
        
        {/* Floating action hints */}
        {elements.length > 0 && (
          <div className="mt-4 text-center">
            <p className="text-xs text-stone-400 dark:text-neutral-500">
              {elements.length} field{elements.length !== 1 ? 's' : ''} added
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


