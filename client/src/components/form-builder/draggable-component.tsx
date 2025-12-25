import { useDraggable } from '@dnd-kit/core';
import { ComponentPaletteItem, FormElementType } from '@/types/form-builder';
import { Type, Mail, FileText, Hash, ChevronDown, CheckSquare, Circle, Send, RotateCcw, Image, Star, User, ToggleLeft, Calendar } from 'lucide-react';

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

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  } : undefined;

  const IconComponent = iconMap[item.type] || Type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative border-2 border-transparent bg-white rounded-xl hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-200 select-none"

    >
      <div
        {...listeners}
        {...attributes}
        className="p-4 cursor-grab active:cursor-grabbing hover:scale-[1.02] active:scale-[0.98] relative"
        onClick={(e) => {
          // Allow click-to-add on all devices when not actively dragging
          if (!isDragging) {
            onAddElement(item.type);
          }
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50/0 via-blue-50/30 to-purple-50/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        
        <div className="relative flex items-center space-x-3">
          <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow duration-200`}>
            <IconComponent size={18} className="text-current" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-neutral-800 group-hover:text-blue-700 transition-colors">
              {item.label}
            </div>
            <div className="text-xs text-neutral-500 truncate">
              {item.description}
            </div>
          </div>
          <div className="text-neutral-400 group-hover:text-blue-500 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60 group-hover:opacity-100">
              <path d="M6 3C6 2.44772 6.44772 2 7 2H9C9.55228 2 10 2.44772 10 3V4H6V3Z" fill="currentColor"/>
              <path d="M6 6C6 5.44772 6.44772 5 7 5H9C9.55228 5 10 5.44772 10 6V7H6V6Z" fill="currentColor"/>
              <path d="M6 9C6 8.44772 6.44772 8 7 8H9C9.55228 8 10 8.44772 10 9V10H6V9Z" fill="currentColor"/>
              <path d="M6 12C6 11.4477 6.44772 11 7 11H9C9.55228 11 10 11.4477 10 12V13H6V12Z" fill="currentColor"/>
            </svg>
          </div>
        </div>
        
        {isDragging && (
          <div className="absolute inset-0 rounded-xl border-2 border-blue-400 bg-blue-50/20 animate-pulse"></div>
        )}
      </div>
    </div>
  );
}
