import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { NewsletterBlock, NewsletterEditorState } from '@/types/newsletter-editor';
import { BlockRenderer } from './BlockRenderer';
import { Button } from '@/components/ui/button';
import { Save, Eye } from 'lucide-react';

interface EditorCanvasProps {
  blocks: NewsletterBlock[];
  selectedBlockId: string | null;
  globalStyle: NewsletterEditorState['globalStyle'];
  onBlockSelect: (blockId: string) => void;
  onBlockUpdate: (blockId: string, updates: Partial<NewsletterBlock>) => void;
  onBlockDelete: (blockId: string) => void;
  onSave: () => void;
}

export function EditorCanvas({
  blocks,
  selectedBlockId,
  globalStyle,
  onBlockSelect,
  onBlockUpdate,
  onBlockDelete,
  onSave,
}: EditorCanvasProps) {
  const { setNodeRef } = useDroppable({
    id: 'canvas',
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Weekly Newsletter</h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button onClick={onSave} size="sm">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          In this week's issue we cover all things bromeliad, as well as how to care for humid loving plants in a dry environment
        </p>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto bg-gray-100 p-8">
        <div
          ref={setNodeRef}
          className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg min-h-[600px]"
          style={{
            fontFamily: globalStyle?.fontFamily,
            backgroundColor: globalStyle?.backgroundColor,
          }}
        >
          <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.length === 0 ? (
              <div className="flex items-center justify-center h-96 text-gray-400">
                <div className="text-center">
                  <p className="text-lg font-medium">Drag blocks here to start building</p>
                  <p className="text-sm mt-2">Choose from the blocks on the left sidebar</p>
                </div>
              </div>
            ) : (
              blocks.map((block) => (
                <BlockRenderer
                  key={block.id}
                  block={block}
                  isSelected={block.id === selectedBlockId}
                  onSelect={() => onBlockSelect(block.id)}
                  onUpdate={(updates: Partial<NewsletterBlock>) => onBlockUpdate(block.id, updates)}
                  onDelete={() => onBlockDelete(block.id)}
                  selectedBlockId={selectedBlockId}
                  onBlockSelect={onBlockSelect}
                  onBlockUpdate={onBlockUpdate}
                  onBlockDelete={onBlockDelete}
                />
              ))
            )}
          </SortableContext>

          {/* Add Block Indicator */}
          {blocks.length > 0 && (
            <div className="p-8 text-center border-t-2 border-dashed border-gray-300">
              <p className="text-sm text-gray-400">
                - - - - - - ADD A NEW BLOCK HERE - - - - - -
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
