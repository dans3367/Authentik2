import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { NewsletterBlock } from '@/types/newsletter-editor';
import { GripVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ColumnDropZone } from './ColumnDropZone';

interface BlockRendererProps {
  block: NewsletterBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<NewsletterBlock>) => void;
  onDelete: () => void;
  selectedBlockId?: string | null;
  onBlockSelect?: (blockId: string) => void;
  onBlockUpdate?: (blockId: string, updates: Partial<NewsletterBlock>) => void;
  onBlockDelete?: (blockId: string) => void;
}

export function BlockRenderer({ 
  block, 
  isSelected, 
  onSelect, 
  onUpdate, 
  onDelete,
  selectedBlockId,
  onBlockSelect,
  onBlockUpdate,
  onBlockDelete,
}: BlockRendererProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group border-2 border-transparent transition-all',
        isDragging && 'opacity-50',
        isSelected && 'border-blue-500'
      )}
      onClick={onSelect}
    >
      {/* Drag Handle & Delete Button - Positioned at top right */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
        <button
          {...attributes}
          {...listeners}
          className="p-2 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4 text-gray-600" />
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 h-auto bg-white border border-gray-300 rounded shadow-sm hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </div>

      {/* Block Content */}
      <div style={block.style}>
        {renderBlockContent(block, selectedBlockId, onBlockSelect, onBlockUpdate, onBlockDelete)}
      </div>
    </div>
  );
}

function renderBlockContent(
  block: NewsletterBlock,
  selectedBlockId?: string | null,
  onBlockSelect?: (blockId: string) => void,
  onBlockUpdate?: (blockId: string, updates: Partial<NewsletterBlock>) => void,
  onBlockDelete?: (blockId: string) => void
) {
  switch (block.type) {
    case 'hero':
      return (
        <div className="relative p-8 text-center" style={block.style}>
          {block.imageUrl && (
            <div className="mb-6">
              <img
                src={block.imageUrl}
                alt={block.title}
                className="max-w-sm mx-auto rounded-lg"
              />
            </div>
          )}
          <h1 className="text-4xl font-bold mb-4" style={{ color: block.style?.textColor }}>
            {block.title}
          </h1>
          {block.subtitle && (
            <p className="text-xl text-gray-600 mb-6">{block.subtitle}</p>
          )}
          {block.buttonText && (
            <button
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              style={{ backgroundColor: block.style?.backgroundColor }}
            >
              {block.buttonText}
            </button>
          )}
        </div>
      );

    case 'text':
      return (
        <div className="p-6" style={block.style}>
          <div
            className="prose max-w-none"
            style={{
              color: block.style?.textColor,
              textAlign: block.style?.textAlign,
            }}
            dangerouslySetInnerHTML={{ __html: block.content }}
          />
        </div>
      );

    case 'image':
      return (
        <div className="p-4" style={block.style}>
          {block.link ? (
            <a href={block.link} target="_blank" rel="noopener noreferrer">
              <img src={block.url} alt={block.alt || ''} className="w-full rounded-lg" />
            </a>
          ) : (
            <img src={block.url} alt={block.alt || ''} className="w-full rounded-lg" />
          )}
        </div>
      );

    case 'button':
      return (
        <div className="p-6 text-center" style={block.style}>
          <a
            href={block.url}
            className={cn(
              'inline-block px-8 py-3 rounded-lg font-medium transition-colors',
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
        <div className="px-6 py-4" style={block.style}>
          <hr
            style={{
              height: block.height,
              backgroundColor: block.color,
              border: 'none',
            }}
          />
        </div>
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

    case 'columns':
      if (!onBlockSelect || !onBlockUpdate || !onBlockDelete) {
        return (
          <div className="p-6" style={block.style}>
            <div className="flex gap-4">
              {block.columns.map((column, index) => (
                <div
                  key={column.id}
                  className="flex-1 border-2 border-dashed border-gray-300 bg-gray-50 p-8 rounded-lg"
                  style={{ width: column.width }}
                >
                  <div className="text-center space-y-2">
                    <div className="text-lg font-medium text-gray-400">Column {index + 1}</div>
                    <p className="text-sm text-gray-400">Missing handlers</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }
      
      return (
        <div className="p-6" style={block.style}>
          <div className="flex gap-4">
            {block.columns.map((column) => (
              <ColumnDropZone
                key={column.id}
                columnId={column.id}
                blocks={column.blocks}
                width={column.width}
                onBlockSelect={onBlockSelect}
                onBlockUpdate={onBlockUpdate}
                onBlockDelete={onBlockDelete}
                selectedBlockId={selectedBlockId || null}
              />
            ))}
          </div>
        </div>
      );

    case 'gallery':
      return (
        <div className="p-6" style={block.style}>
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${block.columns || 3}, 1fr)`,
            }}
          >
            {block.images.map((image, index) => (
              <div key={index} className="relative">
                {image.link ? (
                  <a href={image.link} target="_blank" rel="noopener noreferrer">
                    <img
                      src={image.url}
                      alt={image.alt || ''}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </a>
                ) : (
                  <img
                    src={image.url}
                    alt={image.alt || ''}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      );

    case 'social':
      return (
        <div className="p-6 text-center" style={block.style}>
          <div className="flex justify-center gap-4">
            {block.links.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
              >
                <span className="text-sm font-medium">{link.platform[0].toUpperCase()}</span>
              </a>
            ))}
          </div>
        </div>
      );

    case 'footer':
      return (
        <div className="p-8 bg-gray-100 text-center text-sm text-gray-600" style={block.style}>
          {block.companyName && <p className="font-medium mb-2">{block.companyName}</p>}
          {block.address && <p className="mb-4">{block.address}</p>}
          {block.unsubscribeText && (
            <p className="text-xs">
              <a href="#unsubscribe" className="text-blue-600 hover:underline">
                {block.unsubscribeText}
              </a>
            </p>
          )}
        </div>
      );

    default:
      return <div className="p-6 text-gray-400">Unknown block type</div>;
  }
}
