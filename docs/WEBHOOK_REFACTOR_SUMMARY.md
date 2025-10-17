# Webhook Refactoring Summary

## Overview
Refactored the webhook implementation to use `provider_message_id` for targeting emails instead of finding records by email address. This change leverages the `email_sends` table as the central tracking mechanism for all outgoing emails.

## Key Changes

### 1. Provider Message ID Targeting
- **Before**: Webhooks found contacts by email address
- **After**: Webhooks find `email_sends` records by `provider_message_id`
- **Resend**: Uses `email_id` field from webhook payload
- **Postmark**: Uses `MessageID` field from webhook payload

### 2. Data Flow
```
Webhook Event → Extract provider_message_id (email_id from Resend)
              → Find email_sends record by provider_message_id
              → Update email_sends status
              → Create email_events record linked to email_sends
              → Update contact metrics (if contact is linked)
```

### 3. New Helper Functions

#### `extractProviderMessageId(data: any): string | null`
Extracts the provider's message ID from webhook data:
- Resend: `data.email_id`
- Postmark: `data.MessageID`
- Fallback: `data.id`

#### `findEmailSendByProviderId(providerMessageId: string)`
Finds `email_sends` record by querying the `provider_message_id` column.

#### `createEmailEvent(emailSendId: string, webhookData: any, eventType: string)`
Creates records in the `email_events` table instead of `email_activity`.

### 4. Modified Event Handlers

All event handlers now follow this pattern:
1. Extract `provider_message_id` from webhook data
2. Find `email_sends` record
3. Update `email_sends` status (for sent/delivered/bounced events)
4. Create `email_events` record with full webhook payload
5. Update contact metrics if contact is linked to the email send

**Modified Handlers**:
- `handleEmailSent()` - Updates status to 'sent', sets sentAt timestamp
- `handleEmailDelivered()` - Updates status to 'delivered', sets deliveredAt timestamp
- `handleEmailBounced()` - Updates status to 'bounced', stores error message
- `handleEmailComplained()` - Creates complaint event
- `handleEmailOpened()` - Creates open event
- `handleEmailClicked()` - Creates click event

### 5. Self-Contained Email Tracking

The `email_sends` table now contains all necessary information:
```typescript
email_sends:
- id (primary key)
- provider_message_id (from Resend/Postmark)
- recipient_email
- subject
- status (pending/sent/delivered/bounced/failed)
- contact_id (optional link to email_contacts)
- newsletter_id (optional)
- campaign_id (optional)
- sent_at, delivered_at timestamps
```

The `email_events` table tracks all webhook events:
```typescript
email_events:
- id (primary key)
- email_send_id (foreign key to email_sends)
- event_type (sent/delivered/opened/clicked/bounced/complained)
- event_data (full webhook payload as JSON)
- webhook_id
- occurred_at
```

## Benefits

1. **Accurate Tracking**: Each email send has a unique provider_message_id, eliminating ambiguity
2. **Self-Contained**: email_sends records contain all email metadata
3. **Event History**: email_events table maintains complete webhook history
4. **Scalability**: No need to search by email address, direct lookup by indexed provider_message_id
5. **Multi-Recipient Support**: Can track multiple emails to the same recipient separately
6. **Provider Agnostic**: Works with any email provider that provides unique message IDs

## Testing

The test endpoint has been updated to accept `email_id` instead of `email`:
```bash
POST /api/webhook/test/webhook-event
{
  "email_id": "<provider_message_id>",
  "eventType": "opened" // or sent, delivered, clicked
}
```

## Migration Notes

- Existing code that creates `email_sends` records MUST populate the `provider_message_id` field
- The provider's response (e.g., Resend's API response) contains the message ID that should be stored
- Example: `providerMessageId: typeof result === 'string' ? result : result.id`

## Files Modified

- `/home/root/Authentik/server/routes/webhookRoutes.ts`

## Backup Created

- `/home/root/Authentik/server/routes/webhookRoutes.ts.backup_<timestamp>`
