import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { NewsletterBlock } from '@/types/newsletter-editor';
import { SortableNestedBlock } from './SortableNestedBlock';
import { cn } from '@/lib/utils';

interface ColumnDropZoneProps {
  columnId: string;
  blocks: NewsletterBlock[];
  width?: string;
  onBlockSelect: (blockId: string) => void;
  onBlockUpdate: (blockId: string, updates: Partial<NewsletterBlock>) => void;
  onBlockDelete: (blockId: string) => void;
  selectedBlockId: string | null;
}

export function ColumnDropZone({
  columnId,
  blocks,
  width,
  onBlockSelect,
  onBlockUpdate,
  onBlockDelete,
  selectedBlockId,
}: ColumnDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: {
      type: 'column',
      columnId,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 min-h-[200px] border-2 border-dashed rounded-lg p-4 transition-colors',
        isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50/30'
      )}
      style={{ width }}
    >
      <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
        {blocks.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[150px]">
            <p className="text-sm text-gray-400 text-center">
              Drop blocks here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {blocks.map((block) => (
              <SortableNestedBlock
                key={block.id}
                block={block}
                isSelected={block.id === selectedBlockId}
                onSelect={() => onBlockSelect(block.id)}
                onUpdate={(updates: Partial<NewsletterBlock>) => onBlockUpdate(block.id, updates)}
                onDelete={() => onBlockDelete(block.id)}
              />
            ))}
          </div>
        )}
      </SortableContext>
    </div>
  );
}
