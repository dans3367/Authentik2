import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  ChevronRight,
  ChevronDown,
  Image,
  Type,
  MousePointerClick,
  Minus,
  Space,
  Columns2,
  Images,
  Share2,
  Mail,
  Bookmark,
  Navigation,
  Lightbulb,
  LayoutGrid,
  MessageSquare,
  ShoppingBag,
  ImageIcon,
  Rss,
  Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface BlockCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  blocks: BlockItem[];
}

interface BlockItem {
  id: string;
  type: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const blockCategories: BlockCategory[] = [
  {
    id: 'saved-blocks',
    name: 'Saved blocks',
    icon: Bookmark,
    blocks: [],
  },
  {
    id: 'navigation',
    name: 'Navigation',
    icon: Navigation,
    blocks: [],
  },
  {
    id: 'hero',
    name: 'Hero',
    icon: Lightbulb,
    blocks: [
      {
        id: 'hero',
        type: 'hero',
        name: 'Hero Section',
        icon: Lightbulb,
        description: 'Large header with title, subtitle, and CTA',
      },
    ],
  },
  {
    id: 'sections',
    name: 'Sections',
    icon: LayoutGrid,
    blocks: [
      {
        id: 'columns',
        type: 'columns',
        name: 'Columns',
        icon: Columns2,
        description: 'Multi-column layout with nested blocks',
      },
    ],
  },
  {
    id: 'elements',
    name: 'Elements',
    icon: MessageSquare,
    blocks: [
      {
        id: 'text',
        type: 'text',
        name: 'Text',
        icon: Type,
        description: 'Rich text content',
      },
      {
        id: 'button',
        type: 'button',
        name: 'Button',
        icon: MousePointerClick,
        description: 'Call-to-action button',
      },
      {
        id: 'divider',
        type: 'divider',
        name: 'Divider',
        icon: Minus,
        description: 'Horizontal line separator',
      },
      {
        id: 'spacer',
        type: 'spacer',
        name: 'Spacer',
        icon: Space,
        description: 'Empty space for layout',
      },
    ],
  },
  {
    id: 'content',
    name: 'Content',
    icon: MessageSquare,
    blocks: [
      {
        id: 'image',
        type: 'image',
        name: 'Image',
        icon: Image,
        description: 'Single image block',
      },
      {
        id: 'gallery',
        type: 'gallery',
        name: 'Gallery',
        icon: Images,
        description: 'Image gallery grid',
      },
    ],
  },
  {
    id: 'social',
    name: 'Social',
    icon: Share2,
    blocks: [
      {
        id: 'social',
        type: 'social',
        name: 'Social Links',
        icon: Share2,
        description: 'Social media icons',
      },
    ],
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    icon: ShoppingBag,
    blocks: [],
  },
  {
    id: 'gallery-section',
    name: 'Gallery',
    icon: ImageIcon,
    blocks: [],
  },
  {
    id: 'blog',
    name: 'Blog and RSS',
    icon: Rss,
    blocks: [],
  },
  {
    id: 'social-sharing',
    name: 'Social and sharing',
    icon: Users,
    blocks: [],
  },
  {
    id: 'footer',
    name: 'Footer',
    icon: Mail,
    blocks: [
      {
        id: 'footer',
        type: 'footer',
        name: 'Footer',
        icon: Mail,
        description: 'Newsletter footer with company info',
      },
    ],
  },
];

function DraggableBlock({ block }: { block: BlockItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-${block.type}`,
    data: { type: block.type },
  });

  const Icon = block.icon;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white cursor-grab hover:border-blue-400 hover:shadow-sm transition-all',
        isDragging && 'opacity-50'
      )}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center">
        <Icon className="w-4 h-4 text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{block.name}</div>
        <div className="text-xs text-gray-500 truncate">{block.description}</div>
      </div>
    </div>
  );
}

function CategorySection({ category }: { category: BlockCategory }) {
  const [isExpanded, setIsExpanded] = useState(category.blocks.length > 0);
  const Icon = category.icon;

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">{category.name}</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {isExpanded && category.blocks.length > 0 && (
        <div className="p-3 space-y-2 bg-gray-50">
          {category.blocks.map((block) => (
            <DraggableBlock key={block.id} block={block} />
          ))}
        </div>
      )}
      {isExpanded && category.blocks.length === 0 && (
        <div className="p-3 text-xs text-gray-400 text-center bg-gray-50">
          No blocks available
        </div>
      )}
    </div>
  );
}

export function BlocksSidebar() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = blockCategories.map(category => ({
    ...category,
    blocks: category.blocks.filter(block =>
      block.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      block.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  }));

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <Input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Categories */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-gray-200">
          {filteredCategories.map((category) => (
            <CategorySection key={category.id} category={category} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
