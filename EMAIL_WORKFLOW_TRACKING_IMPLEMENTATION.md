# Email Workflow Tracking Implementation

## Summary
Added a first activity to the `emailWorkflow` that inserts full email details into the `outgoing_emails` table **before** sending the email. The `provider_message_id` (resendID) is initially left as NULL and will be updated in a later step after the email is actually sent.

## Changes Made

### 1. Go Activities (cardprocessor-go)

#### `internal/temporal/activities.go`
Added new activity function and types:

```go
// InsertOutgoingEmailInput represents input for inserting outgoing email record
type InsertOutgoingEmailInput struct {
    TenantID       string
    RecipientEmail string
    RecipientName  *string
    SenderEmail    string
    SenderName     *string
    Subject        string
    EmailType      string  // 'birthday_card', 'test_card', 'promotional', 'newsletter', etc.
    Provider       string  // 'resend', 'sendgrid', 'mailgun', 'other'
    HTMLContent    string
    TextContent    string
    ContactID      *string
    NewsletterID   *string
    CampaignID     *string
    PromotionID    *string
    Metadata       map[string]interface{}
}

// InsertOutgoingEmailResult represents the result of inserting outgoing email
type InsertOutgoingEmailResult struct {
    Success         bool
    OutgoingEmailID *string
    Error           string
}

// InsertOutgoingEmail creates an initial record in the outgoing_emails table
// This is called BEFORE sending the email, so resendID/provider_message_id is left NULL
func InsertOutgoingEmail(ctx context.Context, input InsertOutgoingEmailInput) (InsertOutgoingEmailResult, error)
```

**Key Features:**
- Creates record with `status = 'pending'`
- `provider_message_id` is set to NULL (will be updated after send)
- `provider_response` is set to NULL (will be updated after send)
- `send_attempts` is set to 0
- Includes full HTML and text content
- Non-blocking: if insert fails, workflow continues

#### `internal/temporal/worker.go`
Registered the new activity:

```go
// Register outgoing email tracking
w.RegisterActivity(InsertOutgoingEmail)
```

### 2. TypeScript Activities (temporal-server)

#### `src/activities/database-activities.ts` (NEW FILE)
Created activity stub for TypeScript workflows to call the Go activity:

```typescript
export interface InsertOutgoingEmailInput {
  tenantId: string;
  recipientEmail: string;
  recipientName?: string;
  senderEmail: string;
  senderName?: string;
  subject: string;
  emailType: string;
  provider: string;
  htmlContent: string;
  textContent: string;
  contactId?: string;
  newsletterId?: string;
  campaignId?: string;
  promotionId?: string;
  metadata?: Record<string, any>;
}

export interface InsertOutgoingEmailResult {
  success: boolean;
  outgoingEmailId?: string;
  error?: string;
}

export async function insertOutgoingEmail(
  input: InsertOutgoingEmailInput
): Promise<InsertOutgoingEmailResult>
```

#### `src/activities/index.ts`
Exported the new database activities:

```typescript
export * from './database-activities';
```

### 3. Email Workflow Updates (temporal-server)

#### `src/workflows/email-workflow.ts`
Modified the `emailWorkflow` to include the new first step:

**Step 1: Insert Database Record (NEW)**
```typescript
// ** NEW STEP 1: Insert outgoing email record into database (BEFORE sending) **
if (input.tenantId) {
  workflowLogger.info(`📝 Step 1: Inserting outgoing email record (status=pending, no resendID yet)`);
  
  const insertResult = await insertOutgoingEmail({
    tenantId: input.tenantId,
    recipientEmail: input.recipient,
    // ... all email details
    htmlContent: htmlContent,
    textContent: textContent,
  });

  if (insertResult.success) {
    outgoingEmailId = insertResult.outgoingEmailId;
    workflowLogger.info(`✅ Step 1 complete: Outgoing email record created with ID: ${outgoingEmailId}`);
  }
}
```

**Step 2: Send Email (EXISTING)**
```typescript
// ** STEP 2: Send the email **
workflowLogger.info(`📤 Step 2: Sending email ${input.emailId} to ${input.recipient}`);

const result = await sendEmail(
  emailContent.to,
  emailContent.from,
  emailContent.subject,
  emailContent.html,
  emailContent.text,
  emailContent.tags,
  {
    ...emailContent.metadata,
    outgoingEmailId: outgoingEmailId, // Link to the tracking record
  }
);
```

**Updated EmailWorkflowResult:**
```typescript
export interface EmailWorkflowResult {
  emailId: string;
  success: boolean;
  messageId?: string;  // This is the resendID/provider_message_id
  error?: string;
  provider?: string;
  sentAt: string;
  recipient: string;
  outgoingEmailId?: string;  // NEW: ID of the record in outgoing_emails table
}
```

## Workflow Execution Flow

1. **Email Workflow Starts** → `emailWorkflow(input)`

2. **Step 1: Pre-Send Database Insert** (NEW)
   - Validates tenant existence
   - Inserts record into `outgoing_emails` table:
     - `status = 'pending'`
     - `provider_message_id = NULL`
     - `provider_response = NULL`
     - `send_attempts = 0`
     - Full HTML/text content saved
   - Returns `outgoingEmailId`
   - **Non-blocking:** If insert fails, workflow continues

3. **Step 2: Send Email** (EXISTING)
   - Sends email via Resend/Postmark
   - Receives `messageId` (resendID) from provider
   - Returns success/failure

4. **Step 3: Update Database with ResendID** (FUTURE)
   - TODO: Add activity to update the `outgoing_emails` record:
     - `provider_message_id = messageId` (resendID)
     - `status = 'sent'` or `'failed'`
     - `provider_response = response JSON`
     - `send_attempts = 1`

## Database Schema

The `outgoing_emails` table (from migration 019):

```sql
CREATE TABLE outgoing_emails (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    recipient_email TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    email_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_message_id TEXT,  -- NULL initially, updated after send
    provider_response TEXT,    -- NULL initially, updated after send
    status TEXT DEFAULT 'pending',
    send_attempts INTEGER DEFAULT 1,
    html_content TEXT,         -- Added in migration 020
    text_content TEXT,         -- Added in migration 020
    -- ... other fields ...
    sent_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Testing

To test the implementation:

1. **Start the Go worker:**
   ```bash
   cd cardprocessor-go
   go run cmd/server/main.go
   ```

2. **Start the TypeScript temporal-server:**
   ```bash
   cd temporal-server
   npm run dev
   ```

3. **Trigger an email workflow:**
   - The workflow will now create a database record BEFORE sending
   - Check the `outgoing_emails` table for the new record with `status='pending'`
   - After the email is sent, you'll see `messageId` (resendID) in the workflow result

4. **Verify database:**
   ```sql
   SELECT id, recipient_email, status, provider_message_id, created_at
   FROM outgoing_emails
   ORDER BY created_at DESC
   LIMIT 10;
   ```

## Next Steps

1. **Add Update Activity:** Create `UpdateOutgoingEmailWithResendID` activity to update the record after email is sent:
   ```go
   func UpdateOutgoingEmailWithResendID(ctx context.Context, input UpdateOutgoingEmailInput) error {
       // Update provider_message_id, status, provider_response, send_attempts
   }
   ```

2. **Add to Workflow:** Call the update activity after Step 2 (send email):
   ```typescript
   if (result.success && outgoingEmailId) {
       await updateOutgoingEmailWithResendID({
           outgoingEmailId: outgoingEmailId,
           providerMessageId: result.messageId,
           status: 'sent',
           providerResponse: JSON.stringify(result)
       });
   }
   ```

3. **Handle Failures:** Update status to 'failed' if email send fails

4. **Add Retry Logic:** Increment `send_attempts` on each retry

## Files Changed

```
cardprocessor-go/
├── internal/temporal/
│   ├── activities.go     (NEW: InsertOutgoingEmail activity)
│   └── worker.go          (MODIFIED: Register new activity)

temporal-server/
├── src/activities/
│   ├── database-activities.ts  (NEW: Activity stubs)
│   └── index.ts                (MODIFIED: Export database activities)
└── src/workflows/
    └── email-workflow.ts       (MODIFIED: Add Step 1 - insert before send)
```

## Benefits

1. **Complete Tracking:** Every email is tracked from the moment the workflow starts
2. **Audit Trail:** Full email content saved for compliance/debugging
3. **Status Tracking:** Can see emails that are pending vs. sent vs. failed
4. **Resend ID Linking:** Can correlate internal tracking with provider message IDs
5. **Non-Blocking:** Tracking failures don't prevent email from being sent
6. **Future-Proof:** Ready for webhook updates and delivery tracking

