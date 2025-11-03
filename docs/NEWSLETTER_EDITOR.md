# Newsletter Editor Documentation

## Overview

The Newsletter Editor is a fully-featured drag-and-drop email newsletter builder implemented at `/newsletter/create`. It provides an intuitive interface for creating professional newsletters with a three-panel layout.

## Architecture

### Three-Panel Layout

1. **Left Sidebar (BlocksSidebar)** - Block library with collapsible categories
2. **Center Canvas (EditorCanvas)** - Main editing area with drag-and-drop functionality
3. **Right Sidebar (SettingsSidebar)** - Block and global settings panel

### Key Components

#### 1. NewsletterEditor (`/client/src/components/NewsletterEditor/NewsletterEditor.tsx`)
- Main container component
- Manages editor state (blocks, selection, global styles)
- Handles drag-and-drop logic using @dnd-kit
- Coordinates between all child components

#### 2. BlocksSidebar (`/client/src/components/NewsletterEditor/BlocksSidebar.tsx`)
- Displays available block types in collapsible categories
- Implements draggable block items
- Includes search functionality
- Categories:
  - Saved blocks
  - Navigation
  - Hero
  - Sections (Columns)
  - Elements (Text, Button, Divider, Spacer)
  - Content (Image, Gallery)
  - Social
  - E-commerce
  - Gallery
  - Blog and RSS
  - Social and sharing
  - Footer

#### 3. EditorCanvas (`/client/src/components/NewsletterEditor/EditorCanvas.tsx`)
- Main editing area
- Displays newsletter preview
- Handles block drop zones
- Shows empty state when no blocks
- Provides Save and Preview buttons

#### 4. SettingsSidebar (`/client/src/components/NewsletterEditor/SettingsSidebar.tsx`)
- Three tabs: Template, Settings, Layout
- **Settings Tab**: Block-specific settings (appears when block is selected)
- **Layout Tab**: Global styling options (fonts, colors)
- **Template Tab**: Pre-built templates (future feature)

#### 5. BlockRenderer (`/client/src/components/NewsletterEditor/BlockRenderer.tsx`)
- Renders individual blocks in the canvas
- Provides drag handle and delete button
- Handles block selection
- Supports all block types

### Block Types

#### Implemented Blocks

1. **Hero Block**
   - Title, subtitle
   - Image
   - Call-to-action button
   - Customizable styling

2. **Text Block**
   - Rich text content (HTML supported)
   - Text alignment
   - Color and background customization

3. **Image Block**
   - Image URL
   - Alt text
   - Optional link

4. **Button Block**
   - Button text and URL
   - Three variants: primary, secondary, outline
   - Customizable styling

5. **Divider Block**
   - Horizontal line separator
   - Customizable height and color

6. **Spacer Block**
   - Empty space for layout
   - Adjustable height

7. **Columns Block**
   - Multi-column layout
   - Nested block support
   - Adjustable column widths

8. **Gallery Block**
   - Image grid
   - Configurable columns
   - Optional links on images

9. **Social Block**
   - Social media icons/links
   - Supports: Facebook, Twitter, Instagram, LinkedIn, YouTube

10. **Footer Block**
    - Company name and address
    - Unsubscribe link
    - Customizable text

### Type System

All types are defined in `/client/src/types/newsletter-editor.ts`:

- `BlockType` - Union type of all block types
- `BlockStyle` - Common styling properties
- `NewsletterBlock` - Union type of all block interfaces
- `NewsletterTemplate` - Template structure
- `NewsletterEditorState` - Editor state management

## Features

### Drag and Drop
- Drag blocks from sidebar to canvas
- Reorder blocks within canvas
- Visual feedback during drag operations
- Powered by @dnd-kit library

### Block Management
- Add blocks via drag-and-drop
- Select blocks to edit
- Delete blocks
- Reorder blocks

### Styling
- **Block-level styling**: Each block has its own style settings
- **Global styling**: Font family, background color, primary/secondary colors
- **Text alignment**: Left, center, right
- **Colors**: Text color, background color with color pickers
- **Spacing**: Padding and margin controls

### Settings Panel
- Context-sensitive settings based on selected block
- Color pickers for easy color selection
- Dropdown selectors for predefined options
- Text inputs for custom values

## Usage

### Basic Workflow

1. **Navigate to `/newsletter/create`**
2. **Drag blocks** from the left sidebar to the canvas
3. **Click a block** to select it and view its settings
4. **Edit block content** in the right sidebar
5. **Adjust styling** using the Layout tab
6. **Save** your newsletter

### Example: Creating a Simple Newsletter

```typescript
// The editor automatically manages state
// Blocks are saved as an array of NewsletterBlock objects

const exampleBlocks: NewsletterBlock[] = [
  {
    id: 'hero-1',
    type: 'hero',
    title: 'Weekly Newsletter',
    subtitle: 'Your weekly dose of updates',
    buttonText: 'Read More',
    buttonUrl: '#',
    style: {
      backgroundColor: '#f3f4f6',
      textAlign: 'center',
      padding: '40px',
    },
  },
  {
    id: 'text-1',
    type: 'text',
    content: '<p>Welcome to our newsletter...</p>',
    style: {
      padding: '20px',
    },
  },
  {
    id: 'footer-1',
    type: 'footer',
    companyName: 'Your Company',
    address: '123 Main St, City, State 12345',
    unsubscribeText: 'Unsubscribe',
    style: {
      backgroundColor: '#e5e7eb',
    },
  },
];
```

## Integration Points

### Page Integration
The editor is integrated into the app at `/newsletter/create` via:
```typescript
// /client/src/pages/newsletter-create.tsx
import { NewsletterEditor } from "@/components/NewsletterEditor";

export default function NewsletterCreatePage() {
  const handleSave = (blocks: NewsletterBlock[]) => {
    // Save blocks to backend
    console.log('Saving newsletter blocks:', blocks);
  };

  return <NewsletterEditor onSave={handleSave} />;
}
```

### Backend Integration (Future)
To integrate with your backend:

1. **Save Newsletter**:
```typescript
const handleSave = async (blocks: NewsletterBlock[]) => {
  await apiRequest('POST', '/api/newsletters', {
    title: 'Newsletter Title',
    blocks: JSON.stringify(blocks),
    globalStyle: editorState.globalStyle,
  });
};
```

2. **Load Newsletter**:
```typescript
const { data } = useQuery({
  queryKey: ['/api/newsletters', id],
  queryFn: async () => {
    const response = await apiRequest('GET', `/api/newsletters/${id}`);
    return response.json();
  },
});

// Pass to editor
<NewsletterEditor initialBlocks={data?.blocks} />
```

## Dependencies

- **@dnd-kit/core**: Drag and drop functionality
- **@dnd-kit/sortable**: Sortable lists
- **@dnd-kit/utilities**: DnD utilities
- **nanoid**: Unique ID generation
- **lucide-react**: Icons
- **React**: UI framework
- **shadcn/ui**: UI components (Button, Input, Card, etc.)

## Future Enhancements

### Planned Features
1. **Template Library**: Pre-built newsletter templates
2. **Block Library**: Save custom blocks for reuse
3. **Rich Text Editor**: Replace textarea with WYSIWYG editor (TipTap)
4. **Image Upload**: Direct image upload instead of URLs
5. **Preview Mode**: Full-screen preview with responsive views
6. **Export HTML**: Generate email-ready HTML
7. **Undo/Redo**: History management
8. **Keyboard Shortcuts**: Quick actions
9. **Block Duplication**: Clone existing blocks
10. **Nested Columns**: Support for complex layouts

### Potential Improvements
- **Performance**: Virtualization for large newsletters
- **Accessibility**: Enhanced keyboard navigation
- **Mobile**: Touch-friendly drag-and-drop
- **Collaboration**: Real-time multi-user editing
- **Analytics**: Track block usage and performance

## Troubleshooting

### Common Issues

1. **Blocks not dragging**
   - Ensure @dnd-kit dependencies are installed
   - Check that DndContext wraps the editor

2. **Styles not applying**
   - Verify style object structure matches BlockStyle interface
   - Check for CSS conflicts

3. **Type errors**
   - Ensure all block types match the NewsletterBlock union type
   - Check that style properties are optional

## File Structure

```
client/src/
├── components/
│   └── NewsletterEditor/
│       ├── index.tsx                 # Exports
│       ├── NewsletterEditor.tsx      # Main component
│       ├── BlocksSidebar.tsx         # Left sidebar
│       ├── EditorCanvas.tsx          # Center canvas
│       ├── SettingsSidebar.tsx       # Right sidebar
│       └── BlockRenderer.tsx         # Block rendering
├── types/
│   └── newsletter-editor.ts          # Type definitions
└── pages/
    └── newsletter-create.tsx         # Page component
```

## Contributing

When adding new block types:

1. Add the block type to `BlockType` union in types
2. Create a new interface extending `BaseBlock`
3. Add the interface to `NewsletterBlock` union
4. Implement rendering in `BlockRenderer`
5. Add settings UI in `SettingsSidebar`
6. Add to block categories in `BlocksSidebar`
7. Add default creation in `createDefaultBlock` function

## License

This component is part of the Authentik project.
