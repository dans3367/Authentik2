# Birthday Unsubscribe UI & Backend Changes

## Summary
This document describes the changes made to handle birthday email unsubscribe status in both the frontend UI and backend API.

## Changes Made

### 1. Backend API Changes (`server/routes/emailManagementRoutes.ts`)

#### Single Contact Birthday Email Preference (PATCH `/api/email-contacts/:contactId/birthday-email`)
- **Added Check**: Before enabling birthday emails, the endpoint now checks if the contact has previously unsubscribed (`birthdayUnsubscribedAt` is not null)
- **Error Response**: Returns HTTP 403 with message explaining that customers who have unsubscribed cannot be re-enabled by admins
- **Reasoning**: Once a customer unsubscribes via the unsubscribe link, they must opt back in themselves; admins cannot override this

```typescript
// Check if contact has unsubscribed from birthday emails
if (enabled && contact.birthdayUnsubscribedAt) {
  return res.status(403).json({ 
    message: 'Cannot re-enable birthday emails for a contact who has unsubscribed. The customer must opt-in again through the unsubscribe link.',
    reason: 'unsubscribed'
  });
}
```

#### Bulk Birthday Email Preference (PATCH `/api/email-contacts/birthday-email/bulk`)
- **Added Check**: Before enabling birthday emails for multiple contacts, checks if any have previously unsubscribed
- **Error Response**: Returns HTTP 403 with list of unsubscribed contact IDs and count
- **Reasoning**: Prevents bulk operations from accidentally re-enabling emails for unsubscribed customers

```typescript
// Check if any contacts have unsubscribed from birthday emails when enabling
if (enabled) {
  const unsubscribedContacts = contacts.filter(c => c.birthdayUnsubscribedAt);
  if (unsubscribedContacts.length > 0) {
    return res.status(403).json({ 
      message: `Cannot re-enable birthday emails for ${unsubscribedContacts.length} contact(s) who have unsubscribed...`,
      reason: 'unsubscribed',
      unsubscribedContactIds: unsubscribedContacts.map(c => c.id)
    });
  }
}
```

### 2. Database Schema Changes (`shared/schema.ts`)

Added the following fields to the `emailContacts` table schema:
```typescript
birthdayUnsubscribeReason: text("birthday_unsubscribe_reason"), // Reason for unsubscribing
birthdayUnsubscribedAt: timestamp("birthday_unsubscribed_at"), // Timestamp when unsubscribed
```

**Note**: These fields were already added to the database via migration `017_add_birthday_unsubscribe_tokens.sql` but were missing from the TypeScript schema definition.

### 3. Frontend UI Changes

#### Birthdays Page (`client/src/pages/birthdays.tsx`)

**Contact Interface Updated**:
```typescript
interface Contact {
  // ... existing fields ...
  birthdayUnsubscribedAt?: Date | null;
  birthdayUnsubscribeReason?: string | null;
}
```

**Birthday Cards Column (Customers Tab)**:
- **Previous Behavior**: Showed a switch to enable/disable birthday emails for all contacts with birthdays
- **New Behavior**: 
  - If `birthdayUnsubscribedAt` is not null, shows an orange "unsubscribed" badge instead of the switch
  - This prevents admins from accidentally re-enabling emails for unsubscribed customers
  - The switch remains for contacts who haven't unsubscribed

```tsx
{contact.birthday ? (
  contact.birthdayUnsubscribedAt ? (
    <Badge className="bg-orange-100 text-orange-800">
      unsubscribed
    </Badge>
  ) : (
    <Switch
      checked={contact.birthdayEmailEnabled || false}
      onCheckedChange={() => handleToggleBirthdayEmail(...)}
      disabled={toggleBirthdayEmailMutation.isPending}
    />
  )
) : (
  <span className="text-gray-400 text-sm">{t('birthdays.table.na')}</span>
)}
```

#### Upcoming Birthdays Card (`client/src/components/ui/upcoming-birthdays-card.tsx`)

**Contact Interface Updated**: Added `birthdayUnsubscribedAt` field

**Visual Indicator**:
- **Previous Behavior**: Showed green checkmark for enabled, red X for disabled
- **New Behavior**: 
  - Orange alert triangle icon for unsubscribed contacts
  - Green checkmark for enabled contacts
  - Red X for disabled contacts

```tsx
{contact.birthdayUnsubscribedAt ? (
  <AlertTriangle className="h-4 w-4 text-orange-500 ml-2" title="Unsubscribed from birthday emails" />
) : contact.birthdayEmailEnabled ? (
  <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
) : (
  <XCircle className="h-4 w-4 text-red-500 ml-2" />
)}
```

## User Flow

### For Admins
1. **View Customers Tab**: 
   - See "unsubscribed" badge in the Birthday Cards column for customers who have unsubscribed
   - Cannot toggle the switch for these customers
   
2. **Attempt to Re-enable**:
   - If admin tries to use the switch on an unsubscribed customer (not possible in UI but possible via API), backend returns 403 error
   - Error message explains that customer must opt back in themselves

3. **Bulk Operations**:
   - When bulk enabling birthday emails, any unsubscribed customers are automatically excluded
   - Admin receives error message listing affected contacts

### For Customers
1. Customer receives birthday email with unsubscribe link
2. Customer clicks unsubscribe link and confirms
3. `birthday_email_enabled` → `false`
4. `birthday_unsubscribed_at` → current timestamp
5. `birthday_unsubscribe_reason` → optional reason provided
6. Customer must use a re-opt-in mechanism to resume receiving birthday emails (feature to be implemented)

## Visual Design

### Color Scheme
- **Unsubscribed Badge**: Orange (`bg-orange-100 text-orange-800`)
- **Alert Icon**: Orange (`text-orange-500`)
- **Active/Enabled**: Green
- **Disabled**: Red/Gray

### Badge Placement
- **Customers Tab**: Replaces the switch in the "Birthday Cards" column
- **Upcoming Birthdays**: Replaces green checkmark with orange alert triangle

## Database Fields

### email_contacts Table
| Field | Type | Description |
|-------|------|-------------|
| `birthday_email_enabled` | BOOLEAN | Whether birthday emails are enabled (default: false) |
| `birthday_unsubscribed_at` | TIMESTAMP | When the contact unsubscribed from birthday emails |
| `birthday_unsubscribe_reason` | TEXT | Optional reason for unsubscribing |

### birthday_unsubscribe_tokens Table
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | VARCHAR(255) | Tenant ID |
| `contact_id` | VARCHAR(255) | Contact ID (FK to email_contacts) |
| `token` | VARCHAR(255) | Unique unsubscribe token |
| `used` | BOOLEAN | Whether token has been used |
| `created_at` | TIMESTAMP | When token was created |
| `used_at` | TIMESTAMP | When token was used |

## Testing

To test the implementation:

1. **Test Unsubscribe Flow**:
   - Use cardprocessor-go to generate a birthday email with unsubscribe link
   - Click unsubscribe link and confirm
   - Verify `birthday_unsubscribed_at` is set in database

2. **Test UI Display**:
   - Navigate to `/birthdays?tab=customers`
   - Verify unsubscribed customers show orange "unsubscribed" badge
   - Verify normal customers show switch control

3. **Test Backend Prevention**:
   - Try to enable birthday emails for unsubscribed customer via API
   - Verify 403 error is returned
   - Verify error message is clear and helpful

4. **Test Bulk Operations**:
   - Select multiple customers including unsubscribed ones
   - Try to bulk enable birthday emails
   - Verify error message lists unsubscribed contacts

## Future Enhancements

1. **Re-Opt-In Mechanism**: Add a way for customers to re-enable birthday emails after unsubscribing
2. **Admin Notification**: Show tooltip/help text explaining why switch is replaced with badge
3. **Unsubscribe Analytics**: Track unsubscribe rates and reasons
4. **Audit Trail**: Log when admins attempt to re-enable for unsubscribed customers

## Migration Notes

- Migration `017_add_birthday_unsubscribe_tokens.sql` already added the required database fields
- No additional database migration needed
- Frontend and backend code changes are backwards compatible
- Existing contacts without unsubscribe data will work normally

## API Documentation

### PATCH `/api/email-contacts/:contactId/birthday-email`

**Request Body**:
```json
{
  "enabled": true
}
```

**Success Response** (200):
```json
{
  "message": "Birthday email preference enabled successfully",
  "contact": { ... }
}
```

**Error Response** (403 - Unsubscribed):
```json
{
  "message": "Cannot re-enable birthday emails for a contact who has unsubscribed. The customer must opt-in again through the unsubscribe link.",
  "reason": "unsubscribed"
}
```

### PATCH `/api/email-contacts/birthday-email/bulk`

**Request Body**:
```json
{
  "contactIds": ["id1", "id2", ...],
  "enabled": true
}
```

**Error Response** (403 - Some Unsubscribed):
```json
{
  "message": "Cannot re-enable birthday emails for 2 contact(s) who have unsubscribed. These customers must opt-in again through the unsubscribe link.",
  "reason": "unsubscribed",
  "unsubscribedContactIds": ["id1", "id2"]
}
```

## Related Files

### Backend
- `server/routes/emailManagementRoutes.ts` - API endpoints
- `shared/schema.ts` - Database schema
- `migrations/017_add_birthday_unsubscribe_tokens.sql` - Database migration

### Frontend  
- `client/src/pages/birthdays.tsx` - Main birthdays page
- `client/src/components/ui/upcoming-birthdays-card.tsx` - Dashboard widget

### Go Backend (Unsubscribe Processing)
- `cardprocessor-go/internal/handlers/birthday.go` - Unsubscribe handlers
- `cardprocessor-go/internal/repository/repository.go` - Database operations
- `cardprocessor-go/internal/models/models.go` - Data models

---

**Date**: 2024
**Author**: AI Assistant
**Status**: ✅ Implemented and Ready for Testing
