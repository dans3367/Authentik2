# Send Birthday Card Feature Implementation

## Overview
This feature allows users to manually send birthday cards to selected contacts through the Email Contacts page. The feature is accessible via a "Send Birthday Card" button in the bulk actions menu when one or more contacts are selected.

## Features Implemented

### 1. Backend API Endpoint
**File:** `server/routes/emailManagementRoutes.ts`

- **Endpoint:** `POST /api/email-contacts/send-birthday-card`
- **Authentication:** Required (uses `authenticateToken` middleware)
- **Functionality:**
  - Accepts an array of contact IDs
  - Retrieves birthday settings for the tenant (including promotion data)
  - Generates unique unsubscribe tokens for each recipient
  - Sends personalized birthday cards using the configured template
  - Returns detailed results for each contact (success/failure)

**Key Features:**
- Uses existing birthday settings (template, message, promotion)
- Generates proper unsubscribe tokens via the cardprocessor service
- Includes promotion content if configured
- Provides detailed success/failure reporting
- Tags emails as 'birthday' and 'manual' for tracking

### 2. Frontend Button and UI
**File:** `client/src/pages/email-contacts.tsx`

- **Location:** Bulk Actions section (appears when contacts are selected)
- **Position:** First button, positioned before "Add Tags" button
- **Icon:** Cake icon from lucide-react
- **States:**
  - Default: "Send Birthday Card"
  - Loading: "Sending..." (button disabled during operation)
  - Success: Shows toast notification with results
  - Error: Shows error toast

**Features:**
- Confirmation dialog before sending
- Shows count of selected contacts in confirmation
- Displays success/failure counts in toast notification
- Clears selection after successful send
- Prevents double-clicks with disabled state

### 3. Unsubscribe Token Integration
The implementation properly integrates with the existing birthday unsubscribe system:

1. **Token Generation:**
   - Calls cardprocessor service: `POST /api/birthday-unsubscribe-token/{contactId}`
   - Generates unique token per recipient
   - Falls back gracefully if token generation fails

2. **Token Usage:**
   - Includes unsubscribe link in email footer
   - Uses correct unsubscribe endpoint format
   - Consistent with automated birthday card flows

### 4. Email Template Rendering
**Helper Function:** `renderBirthdayTemplate()`

Replicates the same birthday card rendering logic used by the automated Birthday Worker:

- Supports multiple themes: default, confetti, balloons
- Includes recipient name personalization
- Integrates promotion content (title, description, body)
- Adds proper unsubscribe footer with token link
- Generates responsive HTML email template

## Technical Details

### Request Format
```json
{
  "contactIds": ["contact-id-1", "contact-id-2", "contact-id-3"]
}
```

### Response Format
```json
{
  "success": true,
  "message": "Birthday cards sent: 2 successful, 1 failed",
  "results": [
    {
      "contactId": "contact-id-1",
      "email": "user1@example.com",
      "success": true,
      "messageId": "msg-123"
    },
    {
      "contactId": "contact-id-2",
      "email": "user2@example.com",
      "success": false,
      "error": "Email service unavailable"
    }
  ],
  "summary": {
    "total": 3,
    "successful": 2,
    "failed": 1
  }
}
```

### Email Metadata
Each sent email includes:
```javascript
{
  type: 'birthday-card',
  contactId: 'contact-id',
  tenantId: 'tenant-id',
  manual: true,  // Distinguishes from automated sends
  unsubscribeToken: 'token-value'
}
```

### Tags
- `birthday`: Identifies as birthday content
- `manual`: Distinguishes from automated birthday worker sends
- `tenant-{id}`: Associates with specific tenant

## User Flow

1. User navigates to Email Contacts page
2. User selects one or more contacts via checkboxes
3. Bulk actions bar appears showing "Send Birthday Card" button
4. User clicks "Send Birthday Card"
5. Confirmation dialog appears
6. User confirms
7. System:
   - Retrieves birthday settings
   - Generates unsubscribe tokens
   - Renders personalized emails
   - Sends emails via enhanced email service
   - Shows success/failure notification
8. Selection is cleared
9. User can see results in toast notification

## Integration Points

### Services Used
1. **Birthday Settings Service:** Retrieves tenant birthday configuration
2. **Cardprocessor Service:** Generates unsubscribe tokens
3. **Enhanced Email Service:** Sends actual emails
4. **Database:** Fetches contact and setting data

### Dependencies
- Requires birthday settings to be configured for the tenant
- Requires cardprocessor service to be running (for unsubscribe tokens)
- Uses enhanced email service (supports multiple providers)

## Error Handling

### Backend Errors
- Missing contact IDs: 400 Bad Request
- No birthday settings: 404 Not Found
- No valid contacts: 404 Not Found
- Email send failure: Recorded in results array
- Unsubscribe token failure: Logs warning, continues without token

### Frontend Errors
- Shows error toast with descriptive message
- Maintains contact selection on error
- Allows retry without reselection

## Testing Recommendations

1. **Basic Functionality:**
   - Send to single contact
   - Send to multiple contacts
   - Verify email content and formatting

2. **Error Scenarios:**
   - No birthday settings configured
   - Invalid contact IDs
   - Email service unavailable
   - Cardprocessor service unavailable

3. **Unsubscribe Flow:**
   - Verify token generation
   - Test unsubscribe link functionality
   - Confirm token in email footer

4. **UI/UX:**
   - Button appears only when contacts selected
   - Confirmation dialog works correctly
   - Loading state displays properly
   - Success/failure notifications accurate

## Configuration

### Environment Variables
- `CARDPROCESSOR_URL`: URL for cardprocessor service (default: `http://localhost:8082`)
- `APP_URL`: Base URL for unsubscribe links (default: `http://localhost:5000`)

### Birthday Settings
Configure via the Birthday Settings page:
- Email template selection
- Custom message
- Sender name
- Promotion (optional)
- Custom theme data (optional)

## Comparison with Automated Flow

| Feature | Automated (Birthday Worker) | Manual (This Feature) |
|---------|----------------------------|-----------------------|
| Trigger | Scheduled (birthday date) | User action |
| Recipient Selection | Automatic (birthday today) | User selected |
| Template | From settings | From settings |
| Unsubscribe Token | ✅ Generated | ✅ Generated |
| Promotion Content | ✅ Included | ✅ Included |
| Email Metadata | `automated: true` | `manual: true` |
| Tags | `birthday, automated` | `birthday, manual` |

## Files Modified

1. `server/routes/emailManagementRoutes.ts` - Added endpoint and helper function
2. `client/src/pages/email-contacts.tsx` - Added button, mutation, and handler

## Future Enhancements

Potential improvements:
1. Preview birthday card before sending
2. Bulk send with scheduling
3. Custom message per recipient
4. Send history/audit log
5. A/B testing different templates
6. Recipient timezone consideration
7. Rate limiting for large batches
8. Progress indicator for bulk sends

## Notes

- The feature reuses existing birthday card infrastructure
- Maintains consistency with automated birthday flows
- Properly handles unsubscribe token generation
- Gracefully degrades if token generation fails
- Provides detailed feedback on send results
- Button placement prioritizes birthday card action over other bulk operations
