# Promotional Email Scheduling with Trigger.dev

## Overview

The promotional email scheduling system has been migrated from volatile `setTimeout` to durable Trigger.dev tasks. This ensures that scheduled promotional emails are persisted and will be sent even if the server restarts.

## Architecture

### Components

1. **Trigger.dev Task** (`src/trigger/email.ts`)
   - `schedulePromotionalEmailTask`: Durable task that waits for a specified delay, then calls back to the server's internal API

2. **Internal API Endpoint** (`server/routes/emailManagementRoutes.ts`)
   - `POST /api/internal/send-promotional-email`: Secured endpoint that executes the email send with database logging

3. **Enqueue Function** (`server/routes/emailManagementRoutes.ts`)
   - `enqueuePromotionalEmailJob`: Triggers the Trigger.dev task with fallback to direct execution

4. **Execution Function** (`server/routes/emailManagementRoutes.ts`)
   - `sendPromotionalEmailJob`: Handles the actual email sending and database logging (unchanged)

## Flow

```
Birthday Card Send
    ↓
enqueuePromotionalEmailJob (with 20s delay)
    ↓
Trigger.dev schedulePromotionalEmailTask
    ↓
wait.for({ milliseconds: delayMs })
    ↓
POST /api/internal/send-promotional-email (HMAC authenticated)
    ↓
sendPromotionalEmailJob
    ↓
- Send email via enhancedEmailService
- Log to emailActivity table
- Log to emailSends table
- Log to emailContent table
```

## Benefits

### Before (setTimeout)
- ❌ Volatile: Lost on server restart
- ❌ No retry mechanism
- ❌ No visibility into scheduled jobs
- ❌ No persistence

### After (Trigger.dev)
- ✅ Durable: Persisted across restarts
- ✅ Built-in retries (3 attempts with exponential backoff)
- ✅ Visibility via Trigger.dev dashboard
- ✅ Persistent task queue
- ✅ Automatic error handling and logging

## Security

The internal API endpoint is secured using HMAC signature verification:
- Requires `INTERNAL_SERVICE_SECRET` environment variable
- Uses timing-safe comparison to prevent timing attacks
- Validates timestamp to prevent replay attacks
- Only accessible from authenticated internal services (Trigger.dev)

## Configuration

### Environment Variables

```bash
# Required for Trigger.dev task to call back to server
API_URL=http://localhost:5000  # or your production URL
INTERNAL_SERVICE_SECRET=your-secret-key

# Required for email sending
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=admin@zendwise.work
```

### Trigger.dev Setup

Ensure Trigger.dev worker is running:
```bash
npm run dev:trigger
```

## Usage

The system is automatically used when sending split birthday emails with promotional content:

```typescript
// Automatically called from birthday card sending flow
enqueuePromotionalEmailJob(
  {
    tenantId,
    contactId: contact.id,
    recipientEmail: contact.email,
    recipientName,
    senderName: resolvedSenderName,
    promoSubject,
    htmlPromo,
    unsubscribeToken,
    promotionId: settings.promotion?.id || null,
    manual: true,
  },
  20000 // 20 second delay
);
```

## Monitoring

### Trigger.dev Dashboard
- View scheduled tasks
- Monitor task execution
- Check retry attempts
- View error logs

### Server Logs
```
✅ [PromotionalEmailJob] Scheduled via Trigger.dev (ID: task_123) with 20000ms delay for user@example.com
🎁 [Internal Promotional Email] Received authenticated request
✅ [Internal Promotional Email] Successfully sent promotional email for contact abc-123
```

## Error Handling

### Trigger.dev Unavailable
If Trigger.dev is unavailable, the system falls back to direct execution:
```
⚠️ [PromotionalEmailJob] Falling back to direct execution
```

### Email Send Failure
- Logged to `emailActivity` table with `activityType: 'failed'`
- Logged to `emailSends` table with `status: 'failed'`
- Automatic retries via Trigger.dev (up to 3 attempts)

### Internal API Failure
- Trigger.dev will retry with exponential backoff
- Errors logged in Trigger.dev dashboard
- Server logs contain detailed error information

## Database Schema

### emailActivity
```sql
INSERT INTO email_activity (
  tenant_id,
  contact_id,
  activity_type,  -- 'sent' or 'failed'
  activity_data,  -- JSON with email details
  occurred_at
)
```

### emailSends
```sql
INSERT INTO email_sends (
  id,
  tenant_id,
  recipient_email,
  recipient_name,
  sender_email,
  sender_name,
  subject,
  email_type,      -- 'promotional'
  provider,
  provider_message_id,
  status,          -- 'sent' or 'failed'
  contact_id,
  promotion_id,
  sent_at
)
```

### emailContent
```sql
INSERT INTO email_content (
  email_send_id,
  html_content,
  text_content,
  metadata  -- JSON with split, manual, promotional flags
)
```

## Testing

### Manual Test
```bash
# 1. Start Trigger.dev worker
npm run dev:trigger

# 2. Send a birthday card with split promotional email enabled
# 3. Check Trigger.dev dashboard for scheduled task
# 4. Wait 20 seconds
# 5. Verify email was sent and logged in database
```

### Check Scheduled Tasks
```bash
# View Trigger.dev dashboard
# Navigate to: https://cloud.trigger.dev/projects/your-project/runs
```

## Troubleshooting

### Task Not Scheduling
- Check `INTERNAL_SERVICE_SECRET` is set
- Verify Trigger.dev worker is running
- Check server logs for error messages

### Email Not Sending
- Verify `RESEND_API_KEY` is valid
- Check `API_URL` points to correct server
- Review Trigger.dev task logs
- Check internal API endpoint logs

### Authentication Failures
- Ensure `INTERNAL_SERVICE_SECRET` matches between server and Trigger.dev
- Verify HMAC signature is being generated correctly
- Check timestamp is within acceptable range

## Migration Notes

### What Changed
- Removed `setTimeout` from `enqueuePromotionalEmailJob`
- Added Trigger.dev task `schedulePromotionalEmailTask`
- Added internal API endpoint `/api/internal/send-promotional-email`
- `sendPromotionalEmailJob` remains unchanged (preserves all logging logic)

### Backward Compatibility
- Fallback to direct execution if Trigger.dev is unavailable
- All database logging remains identical
- No changes to email content or delivery

### Deployment Checklist
- [ ] Set `INTERNAL_SERVICE_SECRET` environment variable
- [ ] Set `API_URL` environment variable
- [ ] Deploy Trigger.dev worker
- [ ] Verify Trigger.dev connection
- [ ] Test promotional email scheduling
- [ ] Monitor Trigger.dev dashboard
