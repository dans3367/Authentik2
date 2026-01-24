import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormElement } from '@/types/form-builder';
import { FormElementRenderer } from './form-element-renderer';
import { GripVertical } from 'lucide-react';

interface SortableFormElementProps {
  element: FormElement;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<FormElement>) => void;
  onMobileEdit?: (id: string) => void;
  isGlobalDragging?: boolean;
  showDropIndicators?: boolean;
  elementIndex?: number;
}

export function SortableFormElement({
  element,
  isSelected,
  onSelect,
  onRemove,
  onUpdate,
  onMobileEdit,
  isGlobalDragging = false,
  showDropIndicators = false,
  elementIndex = 0,
}: SortableFormElementProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
      >
        <div className="p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors">
          <GripVertical className="w-4 h-4" />
        </div>
      </div>
      <FormElementRenderer
        element={element}
        isSelected={isSelected}
        onSelect={onSelect}
        onRemove={onRemove}
        onUpdate={onUpdate}
        previewMode={false}
        onMobileEdit={onMobileEdit}
        isDragging={isGlobalDragging || isDragging}
        showDropIndicators={showDropIndicators}
        elementIndex={elementIndex}
      />
    </div>
  );
}