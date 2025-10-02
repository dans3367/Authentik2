# Vercel AI SDK Integration - Birthday Card Message Generation

## Overview
Integrated the Vercel AI SDK with Google's Gemini 2.0 Flash model via AI Gateway to generate personalized birthday card messages for customers.

## Components Added/Modified

### 1. Dependencies
- **Installed packages**: `ai@^5.0.59` and `@ai-sdk/google@^2.0.17`
  - Note: Only `ai` package is required for AI Gateway integration
  - `@ai-sdk/google` can be removed if not used elsewhere

### 2. Server-Side API (Backend)
- **File**: `server/routes/aiRoutes.ts` (NEW)
  - Endpoint: `POST /api/ai/generate-birthday-message`
  - Uses Vercel AI SDK with AI Gateway and plain model string
  - Model: `'google:gemini-2.0-flash-exp'`
  - Accepts: `customerName`, `businessName`
  - Returns: Generated birthday message text
  - Uses `AI_GATEWAY_API_KEY` from environment variables

- **File**: `server/routes.ts` (MODIFIED)
  - Added import for `aiRoutes`
  - Registered route: `app.use("/api/ai", aiRoutes)`

### 3. Client-Side API Layer
- **File**: `client/src/lib/aiApi.ts` (NEW)
  - Function: `generateBirthdayMessage(params)`
  - Handles API calls to the backend endpoint
  - Includes error handling and response parsing

### 4. UI Components

#### RichTextEditor Component
- **File**: `client/src/components/RichTextEditor.tsx` (MODIFIED)
  - Added new props: `businessName`, `onGenerateStart`, `onGenerateEnd`
  - Added state: `isGenerating` (boolean)
  - Added function: `handleGenerateMessage()` - calls AI API
  - Added UI: "Generate Message" button with Sparkles icon
  - Position: In the bubble toolbar, before "First Name" button
  - Button shows "Generating..." with pulsing icon when active
  - Sets editor content with generated message on success

#### CardDesignerDialog Component
- **File**: `client/src/components/CardDesignerDialog.tsx` (MODIFIED)
  - Added prop: `businessName?: string`
  - Passes `businessName` to RichTextEditor component

#### Birthdays Page
- **File**: `client/src/pages/birthdays.tsx` (MODIFIED)
  - Passes `businessName={currentUser?.name}` to CardDesignerDialog
  - Uses existing `currentUser` context for business name

## Configuration

### Environment Variable
```bash
AI_GATEWAY_API_KEY=vck_8nU6B66CkiNGrapjX8WraaHoypC0Waht31AseSP7UH9mKPQyor2RQ3wO
```

### AI Model Configuration (Using AI Gateway)
```typescript
import { generateText } from 'ai';

const { text } = await generateText({
  model: 'google:gemini-2.0-flash-exp',
  prompt: promptText,
});
```

**Note**: Using plain model string with AI Gateway instead of provider-specific imports. The AI Gateway handles authentication and routing to Google's Gemini model.

## Usage Flow

1. User opens the Birthday Card Designer dialog
2. User selects text in the message editor (bubble toolbar appears)
3. User clicks "Generate Message" button (with sparkles icon)
4. Button shows "Generating..." with animated sparkle icon
5. AI generates personalized birthday message based on:
   - Customer's first name (if available)
   - Business name from current user profile
6. Generated message appears in the editor
7. User can edit the generated message or regenerate if needed

## Prompt Template
The AI prompt used for generation:
```
Create a warm and professional happy birthday card greeting from {businessName} to our customer {customerName}. 
The message should be friendly, sincere, and appropriate for a business-to-customer relationship. 
Keep it concise (2-3 sentences) and celebratory. 
Do not include a greeting like "Dear" or a signature - just the birthday message body.
```

## Files Modified/Created

### Created:
- `server/routes/aiRoutes.ts`
- `client/src/lib/aiApi.ts`

### Modified:
- `server/routes.ts`
- `client/src/components/RichTextEditor.tsx`
- `client/src/components/CardDesignerDialog.tsx`
- `client/src/pages/birthdays.tsx`

### Backup Files Created:
- `client/src/components/RichTextEditor.tsx.backup`
- `client/src/components/CardDesignerDialog.tsx.backup2`

## Testing

To test the integration:
1. Navigate to the Birthdays page
2. Click to design a birthday card
3. Select text in the message editor
4. Click the "Generate Message" button in the bubble toolbar
5. Verify the generated message appears in the editor
6. Try generating multiple times to see different variations

## AI Gateway Benefits

Using the AI Gateway approach provides:
- **Simplified Integration**: No need for provider-specific SDK imports
- **Unified Interface**: Single API key works across multiple providers
- **Easy Provider Switching**: Change providers by updating the model string
- **Centralized Management**: API keys and rate limits managed at gateway level
- **Enhanced Security**: Backend API key never exposed to client

## Notes
- The Generate button is positioned in the bubble toolbar that appears when text is selected
- It appears before the "First Name" and "Last Name" placeholder buttons
- The button uses a purple color scheme to distinguish it from other toolbar buttons
- The Sparkles icon animates with a pulse effect during generation
- Using AI Gateway with plain model string format: `'google:gemini-2.0-flash-exp'`
