# Puck Newsletter Editor - AI Assistant

## Overview

The Puck newsletter editor now includes an AI-powered text assistant that helps you refine and transform text content in real-time.

## Features

The Text Content block now includes **two AI assistants** to help you create and refine newsletter content:

### 1. AI Helper Button (Top-right of field)

Located next to the "Text Content" label, provides:

1. **Generate** - Creates new text content from scratch
2. **Make longer** - Expands existing text to be more detailed
3. **Make shorter** - Condenses existing text to be more concise
4. **More formal** - Rewrites in a professional tone
5. **Less formal** - Rewrites in a casual tone
6. **Fix grammar** - Corrects grammar and spelling errors
7. **Simplify** - Makes text easier to understand

### 2. AI Assistant (Selection-based)

Appears when you select text inside the textarea:

- Same transformation options as AI Helper
- Works on selected text only
- Useful for editing specific portions

## How to Use

### Using AI Helper Button

1. **Add a Text Component** to your newsletter
2. **Click "AI Helper"** button (top-right of the field)
3. **Choose an action**:
   - **Generate**: Creates new content (works on empty or existing text)
   - **Transform options**: Require existing text to modify
4. **Wait** for the AI (1-2 seconds)
5. Text is automatically updated

### Using Selection AI Assistant

1. **Type or paste content** into the text field
2. **Select text** you want to transform by highlighting it
3. **Click the AI Assistant button** that appears above selection
4. **Choose an action** from the menu
5. **Wait** for transformation
6. Selected text is automatically replaced

## Visual Flow

### AI Helper Button
```
Click AI Helper → Choose Generate/Transform → Text created/updated
```

### Selection AI Assistant
```
Type text → Select text → AI button appears → Choose action → Selection transforms
```

## Requirements

### Environment Variables

The AI assistant requires the following environment variable to be set:

```bash
AI_GATEWAY_API_KEY=your_api_key_here
```

This key is used to access the AI model (Google Gemini 2.5 Flash Lite by default).

### API Endpoint

The feature uses the `/api/ai/transform-text` endpoint which:
- Accepts text and a transformation prompt
- Returns the transformed text
- Handles errors gracefully

## Technical Details

### Components

- **AITextareaWithHelper** (`client/src/components/AITextareaWithHelper.tsx`)
  - Enhanced textarea with dual AI assistance:
    - **AI Helper Button**: Fixed button for generating/transforming entire content
    - **Selection AI Assistant**: Floating button for transforming selected text
  - Custom textarea component with text selection detection
  - Popover menus with transformation options
  - Loading states and toast notifications
  - Uses existing AI API client pattern from cards section
  
- **AITextarea** (`client/src/components/AITextarea.tsx`)
  - Original component with selection-based AI only
  - Still available for other use cases

- **AI API Client** (`client/src/lib/aiApi.ts`)
  - Reuses existing AI infrastructure from birthday cards
  - Type-safe API functions with proper error handling
  - Includes `credentials: "include"` for authentication
  - Specialized endpoints: `expandText`, `shortenText`, `makeMoreFormalText`, `makeMoreCasualText`
  - Generic endpoint: `transformText` for custom prompts

- **API Routes** (`server/routes/aiRoutes.ts`)
  - Existing endpoints reused from birthday cards feature
  - `/api/ai/expand-text` - Make text longer
  - `/api/ai/shorten-text` - Make text shorter  
  - `/api/ai/more-formal-text` - More formal tone
  - `/api/ai/more-casual-text` - More casual tone
  - `/api/ai/transform-text` - Generic transformation
  - Uses Google Gemini AI model
  - Consistent error handling and response format

### Integration

The AI textarea is integrated into Puck using a custom field type:

```typescript
content: {
  type: "custom",
  label: "Text Content",
  render: ({ value, onChange }) => (
    <AITextarea
      value={value || ""}
      onChange={onChange}
      placeholder="Enter your text content here..."
    />
  ),
}
```

## Customization

### Adding New Actions

To add new AI actions, edit the `aiActions` array in `AITextarea.tsx`:

```typescript
const aiActions = [
  { 
    label: "Your Action", 
    prompt: "Your transformation instruction" 
  },
  // ... existing actions
];
```

### Changing AI Model

To use a different AI model, update the `AI_MODEL` constant in `server/routes/aiRoutes.ts`:

```typescript
const AI_MODEL = 'google/gemini-2.5-flash-lite'; // or another model
```

## Troubleshooting

### AI Assistant doesn't appear
- Make sure you've **selected text** (highlight with mouse)
- Check that the text field is focused

### Transformations fail
- Verify `AI_GATEWAY_API_KEY` is set in your environment
- Check server logs for API errors
- Ensure you have internet connectivity

### Slow response times
- AI transformations typically take 1-3 seconds
- Longer text selections may take slightly longer
- Network latency can affect response times

## Future Enhancements

Potential improvements to consider:

1. Add **translation** options (e.g., "Translate to Spanish")
2. Include **tone options** (e.g., "Make playful", "Make urgent")
3. Add **custom prompts** where users can type their own instructions
4. Implement **undo/redo** for AI transformations
5. Add **keyboard shortcuts** for common actions
6. Show **comparison view** before applying changes
7. Add **batch processing** for multiple selections
