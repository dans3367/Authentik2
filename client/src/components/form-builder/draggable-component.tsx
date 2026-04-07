import { useDraggable } from '@dnd-kit/core';
import { ComponentPaletteItem, FormElementType } from '@/types/form-builder';
import { Type, Mail, FileText, Hash, ChevronDown, CheckSquare, Circle, Send, RotateCcw, Image, Star, User, ToggleLeft, Calendar, TextCursorInput } from 'lucide-react';

interface DraggableComponentProps {
  item: ComponentPaletteItem;
  onAddElement: (type: FormElementType) => void;
  isMobile?: boolean;
}

const iconMap = {
  'text-input': Type,
  'email-input': Mail,
  'textarea': FileText,
  'number-input': Hash,
  'select': ChevronDown,
  'checkbox': CheckSquare,
  'radio': Circle,
  'submit-button': Send,
  'reset-button': RotateCcw,
  'image': Image,
  'rate-scale': Star,
  'full-name': User,
  'boolean-switch': ToggleLeft,
  'datetime-picker': Calendar,
  'label': TextCursorInput,
};

export function DraggableComponent({ item, onAddElement, isMobile = false }: DraggableComponentProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `palette-${item.type}`,
    data: {
      type: item.type,
      isNew: true,
    },
  });

  // Don't transform the original item - the DragOverlay handles the visual ghost
  const style = isDragging ? {
    opacity: 0.4,
    zIndex: 1,
  } : undefined;

  const IconComponent = iconMap[item.type] || Type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative bg-stone-50/50 dark:bg-neutral-800/50 rounded-lg hover:bg-white dark:hover:bg-neutral-800 border border-transparent hover:border-stone-200 dark:hover:border-neutral-700 hover:shadow-sm transition-all duration-150 select-none"
    >
      <div
        {...listeners}
        {...attributes}
        className="px-3 py-2.5 cursor-grab active:cursor-grabbing active:scale-[0.98] relative"
        onClick={(e) => {
          if (!isDragging) {
            onAddElement(item.type);
          }
        }}
      >
        <div className="relative flex items-center space-x-2.5">
          <div className={`w-8 h-8 ${item.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
            <IconComponent size={14} className="text-current" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-stone-700 dark:text-stone-200 group-hover:text-stone-900 dark:group-hover:text-white transition-colors leading-tight">
              {item.label}
            </div>
            <div className="text-[11px] text-stone-400 dark:text-neutral-500 truncate leading-tight mt-0.5">
              {item.description}
            </div>
          </div>
          <div className="text-stone-300 dark:text-neutral-600 group-hover:text-stone-400 dark:group-hover:text-neutral-500 transition-colors flex-shrink-0">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <circle cx="6" cy="4" r="1.5" fill="currentColor"/>
              <circle cx="10" cy="4" r="1.5" fill="currentColor"/>
              <circle cx="6" cy="8" r="1.5" fill="currentColor"/>
              <circle cx="10" cy="8" r="1.5" fill="currentColor"/>
              <circle cx="6" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="10" cy="12" r="1.5" fill="currentColor"/>
            </svg>
          </div>
        </div>

        {isDragging && (
          <div className="absolute inset-0 rounded-lg border-2 border-amber-400 bg-amber-50/20 dark:bg-amber-500/10"></div>
        )}
      </div>
    </div>
  );
}
