# Outgoing Email Tracking Implementation

## Completed Steps

### 1. Database Migration ✅
- Created `019_add_outgoing_emails_tracking.sql`
- Table includes:
  - Provider details (Resend email ID, provider name)
  - Email metadata (recipient, sender, subject, type)
  - Status tracking (sent, delivered, bounced, failed)
  - Foreign keys to related tables (contacts, newsletters, campaigns, promotions)
  - Comprehensive indexes for performance

### 2. Go Models ✅
- Added `OutgoingEmail` struct in `cardprocessor-go/internal/models/models.go`
- Added `CreateOutgoingEmailRequest` struct for creating records

### 3. Repository Methods ✅
- Added `CreateOutgoingEmailRecord` in `cardprocessor-go/internal/repository/repository.go`
- Added `UpdateOutgoingEmailStatus` for status updates
- Added `GetOutgoingEmailByProviderMessageID` for lookups

### 4. Go Activities - Partial ✅
- Added `EmailContext` struct to hold tracking metadata
- Added `recordOutgoingEmail` helper function
- Updated `sendViaResend`, `sendViaSendGrid`, `sendViaMailgun` signatures to accept EmailContext
- Updated `sendEmailViaProvider` signature
- Added recording logic to `sendViaResend` after successful send

## Remaining Work

### Update Activity Functions
The following functions need to be updated to pass EmailContext:

1. **SendBirthdayTestEmail** (line ~213)
   - Needs tenant_id and email_type ('test_card' or 'birthday_card')
   - Should extract from workflow input

2. **SendBirthdayInvitationEmail** (line ~273)
   - Needs tenant_id, contact_id, and email_type ('invitation')

3. **SendPromotionalEmail** (line ~700+)
   - Needs tenant_id, promotion_id, contact_id, and email_type ('promotional')

### Example Update Pattern

```go
// Before:
func SendBirthdayTestEmail(ctx context.Context, content EmailContent) (EmailSendResult, error) {
    // ...
    result, err := sendEmailViaProvider(ctx, provider, content)
    // ...
}

// After:
func SendBirthdayTestEmail(ctx context.Context, content EmailContent, tenantID string, emailType string) (EmailSendResult, error) {
    // Create EmailContext
    emailCtx := &EmailContext{
        TenantID:  tenantID,
        EmailType: emailType,
        Metadata: map[string]interface{}{
            "recipientName": content.To, // or extract from content
        },
    }
    
    // ...
    result, err := sendEmailViaProvider(ctx, provider, content, emailCtx)
    // ...
}
```

### Workflow Updates
Workflows calling these activities need to pass the additional parameters:
- `BirthdayTestWorkflow` 
- `BirthdayInvitationWorkflow`
- `SendPromotionalEmailWorkflow` (if using split email flow)

## Testing

After completing the remaining work:

1. Run migration: `psql -d your_db -f migrations/019_add_outgoing_emails_tracking.sql`
2. Rebuild Go binary: `cd cardprocessor-go && go build`
3. Send test birthday email
4. Query database:
   ```sql
   SELECT * FROM outgoing_emails ORDER BY created_at DESC LIMIT 10;
   ```

5. Verify:
   - provider_message_id contains Resend email ID
   - status is 'sent'
   - email_type is correct
   - tenant_id is populated

## Benefits

- **Complete audit trail** of all outgoing emails
- **Provider details** including Resend message IDs for tracking
- **Debugging support** - easy to see if emails failed and why
- **Analytics ready** - can query by type, tenant, date, status
- **Compliance** - audit trail for regulatory requirements
- **Webhook integration ready** - can update status when delivery events arrive

## TypeScript Schema Update (Optional)

For full-stack integration, add to `shared/schema.ts`:

```typescript
export const outgoingEmails = pgTable("outgoing_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name"),
  senderEmail: text("sender_email").notNull(),
  senderName: text("sender_name"),
  subject: text("subject").notNull(),
  emailType: text("email_type").notNull(),
  provider: text("provider").notNull(),
  providerMessageId: text("provider_message_id"),
  providerResponse: text("provider_response"),
  status: text("status").notNull().default('pending'),
  sendAttempts: integer("send_attempts").default(1),
  errorMessage: text("error_message"),
  contactId: varchar("contact_id").references(() => emailContacts.id, { onDelete: 'set null' }),
  newsletterId: varchar("newsletter_id").references(() => newsletters.id, { onDelete: 'set null' }),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: 'set null' }),
  promotionId: varchar("promotion_id").references(() => promotions.id, { onDelete: 'set null' }),
  metadata: text("metadata"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```
