# Puck Newsletter Editor Integration

## Overview

The newsletter creation system now integrates [@measured/puck](https://github.com/measuredco/puck), a visual page builder that allows users to create beautiful newsletters using drag-and-drop components.

## Features

### Visual Editor Components

The Puck editor includes the following components for newsletter creation:

1. **HeadlineText** - Customizable headlines with three size options (Small, Medium, Large)
2. **Paragraph** - Text paragraphs with left/center/right alignment
3. **Image** - Images with URL input, alt text, and size controls
4. **Button** - Call-to-action buttons with customizable text, URL, and styles (Primary, Secondary, Outline)
5. **Divider** - Horizontal dividers with different styles (Solid, Dashed, Dotted)
6. **Spacer** - Empty space with Small, Medium, or Large height options

### Editor Modes

The newsletter creation page supports two editing modes:

- **Visual Mode** (default): Drag-and-drop interface using Puck
- **HTML Mode**: Direct HTML editing for advanced users

Users can switch between modes using the toggle buttons in the Content Card header.

## Implementation Details

### Files Modified

1. **`client/src/components/PuckNewsletterEditor.tsx`** (NEW)
   - Puck editor component with custom configuration
   - Defines all available newsletter components
   - Handles data changes and conversion

2. **`client/src/pages/newsletter-create.tsx`**
   - Integrated Puck editor alongside existing HTML editor
   - Added editor mode toggle (Visual/HTML)
   - Implemented data conversion between Puck and HTML

3. **`client/src/index.css`**
   - Added Puck CSS imports for proper styling

### Usage

When creating a newsletter:

1. Navigate to `/newsletter/create`
2. Choose between Visual or HTML mode using the toggle buttons
3. In Visual mode:
   - Drag components from the left sidebar
   - Configure each component using the properties panel
   - Arrange components by dragging and dropping
4. In HTML mode:
   - Write or paste HTML directly
   - Use promotion content insertion for pre-built templates

## Data Storage

The Puck editor data is converted to HTML/JSON format before being stored in the database. This ensures:

- Backward compatibility with existing newsletter system
- Ability to edit newsletters created in HTML mode
- Preservation of visual structure for future editing

## Future Enhancements

Potential improvements to consider:

1. Add more component types (e.g., columns, grids, product cards)
2. Implement real-time HTML preview of Puck content
3. Create newsletter templates using Puck configurations
4. Add image upload functionality within Puck components
5. Implement responsive preview modes (desktop/mobile)
6. Add undo/redo functionality
7. Create a library of reusable component presets

## Dependencies

- `@measured/puck@latest` - Visual page builder framework

## Notes

- The visual editor provides a better UX for non-technical users
- HTML mode remains available for power users who prefer coding
- The data conversion is currently basic - enhance `renderPuckToHtml()` function for better HTML output
- Consider implementing a proper HTML renderer that converts Puck JSON to email-compatible HTML
