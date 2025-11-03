import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { NewsletterBlock, NewsletterEditorState } from '@/types/newsletter-editor';
import { BlocksSidebar } from './BlocksSidebar';
import { EditorCanvas } from './EditorCanvas';
import { SettingsSidebar } from './SettingsSidebar';
import { nanoid } from 'nanoid';

interface NewsletterEditorProps {
  initialBlocks?: NewsletterBlock[];
  onSave?: (blocks: NewsletterBlock[]) => void;
}

export function NewsletterEditor({ initialBlocks = [], onSave }: NewsletterEditorProps) {
  const [editorState, setEditorState] = useState<NewsletterEditorState>({
    blocks: initialBlocks,
    selectedBlockId: null,
    template: null,
    globalStyle: {
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#ffffff',
      primaryColor: '#3b82f6',
      secondaryColor: '#64748b',
    },
  });

  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeIdStr = String(active.id);
    const overData = over.data.current;
    
    // Check if we're dropping into a column
    if (overData?.type === 'column') {
      const columnId = overData.columnId;
      const isNewBlock = activeIdStr.startsWith('sidebar-');
      
      if (isNewBlock) {
        // Add new block from sidebar to column at drop position
        const blockType = activeIdStr.replace('sidebar-', '') as NewsletterBlock['type'];
        const newBlock = createDefaultBlock(blockType);
        
        setEditorState(prev => ({
          ...prev,
          blocks: prev.blocks.map(block => {
            if (block.type === 'columns') {
              return {
                ...block,
                columns: block.columns.map(col => {
                  if (col.id === columnId) {
                    // Find if we're dropping over a specific block in the column
                    const overIndex = col.blocks.findIndex(b => b.id === over.id);
                    
                    if (overIndex === -1) {
                      // Add to end of column
                      return { ...col, blocks: [...col.blocks, newBlock] };
                    }
                    
                    // Insert at the drop position in column
                    const newBlocks = [...col.blocks];
                    newBlocks.splice(overIndex + 1, 0, newBlock);
                    return { ...col, blocks: newBlocks };
                  }
                  return col;
                }),
              };
            }
            return block;
          }),
          selectedBlockId: newBlock.id,
          globalStyle: prev.globalStyle || {},
        }));
      } else {
        // Moving existing block between/within columns
        setEditorState(prev => ({
          ...prev,
          blocks: prev.blocks.map(block => {
            if (block.type === 'columns') {
              // Find source column and block
              let sourceColumnId: string | null = null;
              let movedBlock: NewsletterBlock | null = null;
              
              for (const col of block.columns) {
                const blockIndex = col.blocks.findIndex(b => b.id === active.id);
                if (blockIndex !== -1) {
                  sourceColumnId = col.id;
                  movedBlock = col.blocks[blockIndex];
                  break;
                }
              }
              
              if (!movedBlock || !sourceColumnId) {
                return block;
              }
              
              // If moving within the same column
              if (sourceColumnId === columnId) {
                return {
                  ...block,
                  columns: block.columns.map(col => {
                    if (col.id === columnId) {
                      const oldIndex = col.blocks.findIndex(b => b.id === active.id);
                      const newIndex = col.blocks.findIndex(b => b.id === over.id);
                      
                      if (oldIndex !== -1 && newIndex !== -1) {
                        return { ...col, blocks: arrayMove(col.blocks, oldIndex, newIndex) };
                      }
                      return col;
                    }
                    return col;
                  }),
                };
              }
              
              // Moving between different columns
              return {
                ...block,
                columns: block.columns.map(col => {
                  // Remove from source column
                  if (col.id === sourceColumnId) {
                    return {
                      ...col,
                      blocks: col.blocks.filter(b => b.id !== active.id),
                    };
                  }
                  
                  // Add to destination column
                  if (col.id === columnId) {
                    const overIndex = col.blocks.findIndex(b => b.id === over.id);
                    
                    if (overIndex === -1) {
                      // Add to end of column
                      return { ...col, blocks: [...col.blocks, movedBlock] };
                    }
                    
                    // Insert at the drop position
                    const newBlocks = [...col.blocks];
                    newBlocks.splice(overIndex + 1, 0, movedBlock);
                    return { ...col, blocks: newBlocks };
                  }
                  
                  return col;
                }),
              };
            }
            return block;
          }),
          globalStyle: prev.globalStyle || {},
        }));
      }
      setActiveId(null);
      return;
    }

    // Check if we're dragging from the sidebar (new block to main canvas)
    const isNewBlock = activeIdStr.startsWith('sidebar-');
    
    if (isNewBlock) {
      // Add new block to main canvas at the drop position
      const blockType = activeIdStr.replace('sidebar-', '') as NewsletterBlock['type'];
      const newBlock = createDefaultBlock(blockType);
      
      setEditorState(prev => {
        // Find the index where we're dropping
        const overIndex = prev.blocks.findIndex(b => b.id === over.id);
        
        if (overIndex === -1) {
          // If not dropped over a block, add to end
          return {
            ...prev,
            blocks: [...prev.blocks, newBlock],
            selectedBlockId: newBlock.id,
            globalStyle: prev.globalStyle || {},
          };
        }
        
        // Insert at the drop position
        const newBlocks = [...prev.blocks];
        newBlocks.splice(overIndex + 1, 0, newBlock);
        
        return {
          ...prev,
          blocks: newBlocks,
          selectedBlockId: newBlock.id,
          globalStyle: prev.globalStyle || {},
        };
      });
    } else if (active.id !== over.id) {
      // Reorder existing blocks in main canvas
      setEditorState(prev => {
        const oldIndex = prev.blocks.findIndex(b => b.id === active.id);
        const newIndex = prev.blocks.findIndex(b => b.id === over.id);
        
        return {
          ...prev,
          blocks: arrayMove(prev.blocks, oldIndex, newIndex),
          globalStyle: prev.globalStyle || {},
        };
      });
    }
    
    setActiveId(null);
  };

  const handleBlockSelect = (blockId: string) => {
    setEditorState(prev => ({
      ...prev,
      selectedBlockId: blockId,
    }));
  };

  const handleBlockUpdate = (blockId: string, updates: Partial<NewsletterBlock>) => {
    setEditorState(prev => ({
      ...prev,
      blocks: prev.blocks.map(block => {
        // Update main block
        if (block.id === blockId) {
          return { ...block, ...updates };
        }
        // Update nested block in columns
        if (block.type === 'columns') {
          return {
            ...block,
            columns: block.columns.map(col => ({
              ...col,
              blocks: col.blocks.map(nestedBlock =>
                nestedBlock.id === blockId ? { ...nestedBlock, ...updates } : nestedBlock
              ),
            })),
          };
        }
        return block;
      }),
    }));
  };

  const handleBlockDelete = (blockId: string) => {
    setEditorState(prev => ({
      ...prev,
      blocks: prev.blocks
        .filter(block => block.id !== blockId)
        .map(block => {
          // Remove nested block from columns
          if (block.type === 'columns') {
            return {
              ...block,
              columns: block.columns.map(col => ({
                ...col,
                blocks: col.blocks.filter(nestedBlock => nestedBlock.id !== blockId),
              })),
            };
          }
          return block;
        }),
      selectedBlockId: prev.selectedBlockId === blockId ? null : prev.selectedBlockId,
    }));
  };

  const handleGlobalStyleUpdate = (updates: Partial<NewsletterEditorState['globalStyle']>) => {
    setEditorState(prev => ({
      ...prev,
      globalStyle: { ...prev.globalStyle, ...updates },
    }));
  };

  const handleSave = () => {
    onSave?.(editorState.blocks);
  };

  // Helper function to find a block by ID, including nested blocks in columns
  const findBlockById = (blockId: string | null): NewsletterBlock | undefined => {
    if (!blockId) return undefined;
    
    // Search in top-level blocks
    for (const block of editorState.blocks) {
      if (block.id === blockId) {
        return block;
      }
      
      // Search in nested blocks within columns
      if (block.type === 'columns') {
        for (const col of block.columns) {
          const nestedBlock = col.blocks.find(b => b.id === blockId);
          if (nestedBlock) {
            return nestedBlock;
          }
        }
      }
    }
    
    return undefined;
  };

  const selectedBlock = findBlockById(editorState.selectedBlockId);

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen bg-gray-50">
        {/* Left Sidebar - Blocks */}
        <BlocksSidebar />

        {/* Center Canvas */}
        <div className="flex-1 overflow-auto">
          <EditorCanvas
            blocks={editorState.blocks}
            selectedBlockId={editorState.selectedBlockId}
            globalStyle={editorState.globalStyle}
            onBlockSelect={handleBlockSelect}
            onBlockUpdate={handleBlockUpdate}
            onBlockDelete={handleBlockDelete}
            onSave={handleSave}
          />
        </div>

        {/* Right Sidebar - Settings */}
        <SettingsSidebar
          selectedBlock={selectedBlock}
          globalStyle={editorState.globalStyle}
          onBlockUpdate={handleBlockUpdate}
          onGlobalStyleUpdate={handleGlobalStyleUpdate}
        />
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-blue-500">
            Dragging...
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function createDefaultBlock(type: NewsletterBlock['type']): NewsletterBlock {
  const baseBlock = {
    id: nanoid(),
    style: {},
  };

  switch (type) {
    case 'hero':
      return {
        ...baseBlock,
        type: 'hero',
        title: 'My Custom Hero Section',
        subtitle: 'Add your subtitle here',
        buttonText: 'Button',
      };
    case 'text':
      return {
        ...baseBlock,
        type: 'text',
        content: 'Add your text content here...',
      };
    case 'image':
      return {
        ...baseBlock,
        type: 'image',
        url: 'https://via.placeholder.com/600x400',
        alt: 'Placeholder image',
      };
    case 'button':
      return {
        ...baseBlock,
        type: 'button',
        text: 'Click Me',
        url: '#',
        variant: 'primary',
      };
    case 'divider':
      return {
        ...baseBlock,
        type: 'divider',
        height: '2px',
        color: '#e5e7eb',
      };
    case 'spacer':
      return {
        ...baseBlock,
        type: 'spacer',
        height: '40px',
      };
    case 'columns':
      return {
        ...baseBlock,
        type: 'columns',
        columns: [
          { id: nanoid(), blocks: [], width: '50%' },
          { id: nanoid(), blocks: [], width: '50%' },
        ],
      };
    case 'gallery':
      return {
        ...baseBlock,
        type: 'gallery',
        images: [
          { url: 'https://via.placeholder.com/300', alt: 'Gallery image 1' },
          { url: 'https://via.placeholder.com/300', alt: 'Gallery image 2' },
          { url: 'https://via.placeholder.com/300', alt: 'Gallery image 3' },
        ],
        columns: 3,
      };
    case 'social':
      return {
        ...baseBlock,
        type: 'social',
        links: [
          { platform: 'facebook', url: 'https://facebook.com' },
          { platform: 'twitter', url: 'https://twitter.com' },
          { platform: 'instagram', url: 'https://instagram.com' },
        ],
      };
    case 'footer':
      return {
        ...baseBlock,
        type: 'footer',
        companyName: 'Your Company',
        address: '123 Main St, City, State 12345',
        unsubscribeText: 'Unsubscribe from this list',
      };
    default:
      return {
        ...baseBlock,
        type: 'text',
        content: 'Unknown block type',
      };
  }
}
