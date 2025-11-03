import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { NewsletterBlock } from '@/types/newsletter-editor';
import { GripVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SortableNestedBlockProps {
  block: NewsletterBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<NewsletterBlock>) => void;
  onDelete: () => void;
}

export function SortableNestedBlock({
  block,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}: SortableNestedBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleClick = (e: React.MouseEvent) => {
    // Don't select if clicking on a link or button
    const target = e.target as HTMLElement;
    if (target.tagName === 'A' || target.tagName === 'BUTTON' || target.closest('a, button')) {
      return;
    }
    onSelect();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group border-2 rounded transition-all bg-white cursor-pointer',
        isDragging && 'opacity-50 shadow-lg',
        isSelected ? 'border-blue-500 shadow-sm' : 'border-transparent hover:border-gray-300'
      )}
      onClick={handleClick}
    >
      {/* Drag Handle & Delete Button */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
        <button
          {...attributes}
          {...listeners}
          className="p-1 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3 h-3 text-gray-600" />
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 h-auto bg-white border border-gray-300 rounded shadow-sm hover:bg-red-50"
        >
          <Trash2 className="w-3 h-3 text-red-500" />
        </Button>
      </div>

      {/* Block Content */}
      <div style={block.style} className="p-2 pointer-events-none">
        {renderNestedBlockContent(block)}
      </div>
    </div>
  );
}

function renderNestedBlockContent(block: NewsletterBlock) {
  switch (block.type) {
    case 'text':
      return (
        <div
          className="prose prose-sm max-w-none"
          style={{
            color: block.style?.textColor,
            textAlign: block.style?.textAlign,
          }}
          dangerouslySetInnerHTML={{ __html: block.content }}
        />
      );

    case 'image':
      return (
        <div>
          {block.link ? (
            <a href={block.link} target="_blank" rel="noopener noreferrer">
              <img src={block.url} alt={block.alt || ''} className="w-full rounded" />
            </a>
          ) : (
            <img src={block.url} alt={block.alt || ''} className="w-full rounded" />
          )}
        </div>
      );

    case 'button':
      return (
        <div className="text-center" style={block.style}>
          <a
            href={block.url}
            className={cn(
              'inline-block px-4 py-2 rounded text-sm font-medium transition-colors',
              block.variant === 'primary' && 'bg-blue-600 text-white hover:bg-blue-700',
              block.variant === 'secondary' && 'bg-gray-600 text-white hover:bg-gray-700',
              block.variant === 'outline' && 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
            )}
          >
            {block.text}
          </a>
        </div>
      );

    case 'divider':
      return (
        <hr
          style={{
            height: block.height,
            backgroundColor: block.color,
            border: 'none',
          }}
        />
      );

    case 'spacer':
      return (
        <div
          style={{
            height: block.height,
            ...block.style,
          }}
        />
      );

    default:
      return (
        <div className="text-xs text-gray-400 p-2">
          {block.type} block
        </div>
      );
  }
}
