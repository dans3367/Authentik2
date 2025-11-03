# Newsletter Columns - Nested Drag-and-Drop Implementation

## Overview

Implemented full nested drag-and-drop functionality for the Columns block in the newsletter editor. Users can now drag blocks from the sidebar directly into column drop zones and manage nested content within multi-column layouts.

## What Was Implemented

### New Components

1. **ColumnDropZone** (`/client/src/components/NewsletterEditor/ColumnDropZone.tsx`)
   - Creates droppable zones for each column
   - Uses `useDroppable` from @dnd-kit
   - Provides visual feedback when hovering (blue border/background)
   - Shows "Drop blocks here" placeholder when empty
   - Manages SortableContext for nested blocks

2. **SortableNestedBlock** (`/client/src/components/NewsletterEditor/SortableNestedBlock.tsx`)
   - Renders individual blocks within columns
   - Smaller, more compact design for nested contexts
   - Supports: text, image, button, divider, spacer blocks
   - Has its own drag handle and delete button (top-right, smaller)
   - Handles selection and updates

### Updated Components

#### BlockRenderer
- Added optional props for nested block handlers:
  - `selectedBlockId`
  - `onBlockSelect`
  - `onBlockUpdate`
  - `onBlockDelete`
- Updated `renderBlockContent` to accept these handlers
- Columns case now uses `ColumnDropZone` components
- Properly passes handlers down to nested contexts

#### EditorCanvas
- Passes nested block handlers to `BlockRenderer`:
  - `selectedBlockId`
  - `onBlockSelect`
  - `onBlockUpdate`
  - `onBlockDelete`

#### NewsletterEditor
- **Enhanced `handleDragEnd`**:
  - Detects drops into columns by checking `over.data.current.type === 'column'`
  - Adds new blocks to specific columns when dropped
  - Maintains existing reorder functionality for main canvas
  
- **Enhanced `handleBlockUpdate`**:
  - Updates blocks in main canvas
  - Updates nested blocks within columns
  - Preserves column structure

- **Enhanced `handleBlockDelete`**:
  - Deletes blocks from main canvas
  - Deletes nested blocks from columns
  - Maintains proper state consistency

#### BlocksSidebar
- Re-enabled the Columns block
- Updated description: "Multi-column layout with nested blocks"

## How It Works

### 1. Adding a Columns Block

```typescript
// User drags "Columns" from sidebar to canvas
// Creates a 2-column layout by default
{
  type: 'columns',
  columns: [
    { id: 'col-1', blocks: [], width: '50%' },
    { id: 'col-2', blocks: [], width: '50%' }
  ]
}
```

### 2. Dropping Blocks into Columns

```typescript
// Drag flow:
1. User drags block from sidebar
2. Hovers over a column drop zone
3. Column highlights (blue border)
4. On drop, handleDragEnd detects column type
5. Block is added to that specific column's blocks array
```

### 3. Managing Nested Blocks

- **Selection**: Click any nested block to select it
- **Editing**: Selected block shows in right sidebar settings
- **Deletion**: Click delete button on nested block
- **Reordering**: Drag nested blocks within the same column

## Supported Nested Blocks

Currently, these block types work well in columns:
- ✅ Text
- ✅ Image  
- ✅ Button
- ✅ Divider
- ✅ Spacer

Not recommended for nesting (too large):
- ❌ Hero
- ❌ Gallery
- ❌ Footer
- ❌ Columns (no recursive nesting yet)

## Visual Design

### Column Drop Zones
- **Empty state**: Dashed border, gray background, "Drop blocks here" text
- **Hover state**: Blue border, blue background tint
- **With content**: Clean spacing between nested blocks

### Nested Blocks
- **Compact design**: Smaller padding, tighter spacing
- **Controls**: Smaller drag handle and delete button (top-right)
- **Selection**: Blue border when selected
- **Drag feedback**: Opacity and shadow during drag

## State Management

The state structure for columns:

```typescript
{
  id: 'block-123',
  type: 'columns',
  style: {},
  columns: [
    {
      id: 'col-1',
      width: '50%',
      blocks: [
        { id: 'nested-1', type: 'text', content: 'Column 1 content' },
        { id: 'nested-2', type: 'button', text: 'CTA', url: '#' }
      ]
    },
    {
      id: 'col-2', 
      width: '50%',
      blocks: [
        { id: 'nested-3', type: 'image', url: 'https://...' }
      ]
    }
  ]
}
```

## Drop Detection Logic

```typescript
const overData = over.data.current;

if (overData?.type === 'column') {
  // Dropping into a column
  const columnId = overData.columnId;
  // Add block to this specific column
} else {
  // Dropping into main canvas
  // Add block to main blocks array
}
```

## Future Enhancements

### Planned Features
1. **Reorder columns**: Allow dragging columns to rearrange them
2. **Adjust column widths**: Visual handles to resize columns
3. **Add/remove columns**: Dynamic column management (2, 3, or 4 columns)
4. **Move blocks between columns**: Drag blocks from one column to another
5. **Recursive nesting**: Support columns within columns (carefully)
6. **Column presets**: Templates like 1/3-2/3, 1/4-3/4, etc.
7. **Mobile responsive**: Auto-stack columns on mobile preview
8. **Copy/paste columns**: Duplicate entire column structures

### Technical Improvements
- Optimize re-renders for nested structures
- Add keyboard navigation for nested blocks
- Improve accessibility (ARIA labels)
- Add undo/redo support for nested operations

## Usage Example

```typescript
// 1. Drag "Columns" block from Sections to canvas
// 2. Drag "Text" block from Elements to left column
// 3. Drag "Button" block from Elements to left column  
// 4. Drag "Image" block from Content to right column
// 5. Result: Two-column layout with text+button left, image right
```

## Code References

### Key Files
- `/client/src/components/NewsletterEditor/ColumnDropZone.tsx` - Column drop zone logic
- `/client/src/components/NewsletterEditor/SortableNestedBlock.tsx` - Nested block rendering
- `/client/src/components/NewsletterEditor/NewsletterEditor.tsx` - State management
- `/client/src/components/NewsletterEditor/BlockRenderer.tsx` - Column rendering

### Key Functions
- `handleDragEnd` - Detects and handles column drops
- `handleBlockUpdate` - Updates nested blocks
- `handleBlockDelete` - Removes nested blocks
- `renderBlockContent` - Renders columns with drop zones

## Testing

To test the implementation:

1. Navigate to `/newsletter/create`
2. Drag "Columns" block from "Sections" to canvas
3. Drag various blocks into each column
4. Try selecting, editing, and deleting nested blocks
5. Verify drag and drop works smoothly
6. Check that state updates correctly

## Known Limitations

1. **No cross-column dragging**: Can't drag blocks between columns (yet)
2. **Fixed 2-column layout**: Always creates 2 columns (50/50)
3. **No nested columns**: Can't put columns inside columns
4. **Limited block types**: Some blocks too large for columns

## Performance Considerations

- Nested structures add complexity to state updates
- Each column has its own SortableContext
- Updates traverse the entire blocks tree
- Consider memoization for large newsletters

## Accessibility

- Drag handles have proper ARIA labels
- Keyboard navigation supported via @dnd-kit
- Screen readers announce drop zones
- Focus management handled automatically

## Browser Support

Works on all modern browsers that support:
- ES6+
- CSS Grid/Flexbox
- Drag and Drop API (via @dnd-kit polyfill)

## Troubleshooting

### Blocks not dropping into columns
- Check console for errors
- Verify column IDs are unique
- Ensure drop zone is properly rendered

### Nested blocks not updating
- Check that handlers are passed correctly
- Verify state structure matches types
- Look for TypeScript errors

### UI not updating
- Check React DevTools for state changes
- Verify re-renders are triggered
- Look for memo/optimization issues

## Resources

- @dnd-kit documentation: https://docs.dndkit.com/
- Newsletter editor docs: `/docs/NEWSLETTER_EDITOR.md`
- Type definitions: `/client/src/types/newsletter-editor.ts`
