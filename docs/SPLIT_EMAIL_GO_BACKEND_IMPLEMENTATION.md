# Split Promotional Email - Go Backend Implementation

## Overview

The Go backend (`cardprocessor-go`) now supports sending birthday cards and promotional emails as **separate emails** for better deliverability when the `splitPromotionalEmail` flag is enabled.

## Implementation Details

### 1. Workflow Changes (`internal/temporal/workflows.go`)

#### **Test Birthday Workflow** (`BirthdayTestWorkflow`)

The workflow now includes a conditional branch that checks if `input.SplitPromotionalEmail` is enabled:

```go
// Step 4: Check if we should send promotion separately (split email flow)
if input.SplitPromotionalEmail && promotion != nil {
    // Send birthday card WITHOUT promotion (separate emails for better deliverability)
    logger.Info("📧 Sending birthday card and promotion as SEPARATE emails for better deliverability")
    
    // 1. Prepare birthday card WITHOUT promotion
    // 2. Send birthday email first
    // 3. Wait 30 seconds between emails
    // 4. Prepare and send promotional email separately
}
```

**Flow when `splitPromotionalEmail = true`:**

1. ✅ Generate unsubscribe token
2. ✅ Fetch promotion data (if promotion ID provided)
3. ✅ **Prepare birthday card WITHOUT promotion** using `PrepareBirthdayTestEmail`
4. ✅ **Send birthday card**
5. ⏱️  **Wait 30 seconds** (for better deliverability)
6. ✅ **Prepare promotional email** using `PreparePromotionalEmail`
7. ✅ **Send promotional email** using `SendPromotionalEmail`
8. ✅ Update status

**Flow when `splitPromotionalEmail = false` (default):**

1. ✅ Generate unsubscribe token
2. ✅ Fetch promotion data
3. ✅ **Prepare birthday card WITH promotion** using `PrepareBirthdayTestEmailWithPromotion`
4. ✅ **Send combined email**
5. ✅ Update status

### 2. Activities (`internal/temporal/activities.go`)

#### **New/Updated Activities:**

**`PreparePromotionalEmail`** - Prepares promotional email content
```go
func PreparePromotionalEmail(ctx context.Context, input PreparePromotionalEmailInput) (EmailContent, error)
```

- **Input:**
  - `ToEmail`: Recipient email
  - `FromEmail`: Sender email
  - `Promotion`: Promotion data
  - `BusinessName`: Tenant/business name
  - `UnsubscribeToken`: Token for unsubscribe link

- **Output:** `EmailContent` with promotional email HTML

**`SendPromotionalEmail`** - Sends the promotional email
```go
func SendPromotionalEmail(ctx context.Context, content EmailContent) (EmailSendResult, error)
```

- Uses the same email sending logic as birthday emails
- Supports Resend, SendGrid, and Mailgun providers
- Records heartbeat for Temporal monitoring

#### **Input Structure:**

```go
type PreparePromotionalEmailInput struct {
    ToEmail           string            `json:"toEmail"`
    FromEmail         string            `json:"fromEmail"`
    Promotion         *models.Promotion `json:"promotion"`
    BusinessName      string            `json:"businessName"`
    UnsubscribeToken  string            `json:"unsubscribeToken"`
}
```

### 3. Models (`internal/models/models.go`)

**`BirthdaySettings` struct** - Already includes the field:

```go
type BirthdaySettings struct {
    ID                    string    `json:"id" db:"id"`
    TenantID              string    `json:"tenantId" db:"tenant_id"`
    // ... other fields ...
    SplitPromotionalEmail bool      `json:"splitPromotionalEmail" db:"split_promotional_email"`
    CreatedAt             time.Time `json:"createdAt" db:"created_at"`
    UpdatedAt             time.Time `json:"updatedAt" db:"updated_at"`
}
```

### 4. Handlers (`internal/handlers/birthday.go`)

**Test Birthday Card Handler** - Passes the setting to the workflow:

```go
workflowInput := temporal.BirthdayTestWorkflowInput{
    // ... other fields ...
    SplitPromotionalEmail: birthdaySettings != nil && birthdaySettings.SplitPromotionalEmail,
    IsTest: true,
}
```

**Update Birthday Settings Handler** - Accepts and stores the field:

```go
settings := &models.BirthdaySettings{
    // ... other fields ...
    SplitPromotionalEmail: getBoolValue(req.SplitPromotionalEmail),
    UpdatedAt: time.Now(),
}
```

## Email Templates

### Promotional Email Template

The promotional email uses a clean, focused template:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[Promotion Title]</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <!-- Header with gradient -->
    <h1>🎁 Special Offer</h1>
    
    <!-- Promotion Content -->
    <h2>[Promotion Title]</h2>
    <div>[Promotion Description/Content]</div>
    
    <!-- CTA Button -->
    <a href="#">Claim Your Offer</a>
    
    <!-- Footer with unsubscribe -->
    <p>[Business Name]</p>
    <a href="[Unsubscribe URL]">Unsubscribe</a>
</body>
</html>
```

## Workflow Execution

### Timeline for Split Emails:

```
T+0s:  Start workflow
T+1s:  Generate unsubscribe token
T+2s:  Fetch promotion data
T+3s:  Prepare birthday card (WITHOUT promotion)
T+4s:  Send birthday card ✉️
       ↓
T+34s: Wait 30 seconds ⏱️
       ↓
T+35s: Prepare promotional email
T+36s: Send promotional email ✉️
T+37s: Update status
T+38s: Workflow complete ✅
```

### Timeline for Combined Email (default):

```
T+0s:  Start workflow
T+1s:  Generate unsubscribe token
T+2s:  Fetch promotion data
T+3s:  Prepare birthday card (WITH promotion)
T+4s:  Send combined email ✉️
T+5s:  Update status
T+6s:  Workflow complete ✅
```

## Benefits

### ✅ **Better Deliverability**
- Smaller, focused emails are less likely to be flagged as spam
- Promotional content separated from personal birthday greetings

### ✅ **Higher Engagement**
- Recipients can engage with birthday wishes separately
- Promotions don't overshadow birthday message

### ✅ **Improved Analytics**
- Track birthday email opens independently
- Track promotional email clicks separately
- Better understanding of what content resonates

### ✅ **Compliance**
- Easier to manage separate unsubscribe preferences
- Clear separation between transactional and marketing emails

## Error Handling

### Graceful Degradation

If the promotional email fails to send:
- ✅ Birthday email was already sent successfully
- ⚠️  Workflow logs warning but doesn't fail
- ✅ User still receives their birthday card

```go
err = workflow.ExecuteActivity(ctx, SendPromotionalEmail, promoEmailContent).Get(ctx, &promoSendResult)
if err != nil {
    logger.Warn("Failed to send promotional email (birthday was sent)", "error", err)
    // Don't fail the workflow - birthday email was sent successfully
}
```

## Configuration

### Environment Variables

No new environment variables required! The feature uses existing email provider configuration:

- `RESEND_API_KEY` - Resend API key (default provider)
- `SENDGRID_API_KEY` - SendGrid API key
- `MAILGUN_API_KEY` - Mailgun API key
- `MAILGUN_DOMAIN` - Mailgun domain

## Testing

### Manual Test Steps:

1. **Enable split promotional email** in birthday settings UI
2. **Select a promotion** from the dropdown
3. **Send a test birthday card**
4. **Verify two emails are received:**
   - Email 1: Birthday card (without promotion)
   - Email 2: Promotional email (30 seconds later)

### API Test (cURL):

```bash
# Update birthday settings to enable split emails
curl -X PUT http://localhost:8080/api/birthday/settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "enabled": true,
    "emailTemplate": "default",
    "segmentFilter": "all",
    "customMessage": "Happy Birthday!",
    "senderName": "Birthday Team",
    "promotionId": "PROMOTION_ID",
    "splitPromotionalEmail": true
  }'

# Send test birthday card
curl -X POST http://localhost:8080/api/birthday/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userEmail": "test@example.com",
    "userFirstName": "John",
    "userLastName": "Doe"
  }'
```

### Check Temporal Workflow:

```bash
# View workflow execution in Temporal UI
open http://localhost:8233

# Look for workflows with "BirthdayTestWorkflow"
# Check execution history for:
# - PrepareBirthdayTestEmail activity
# - SendBirthdayTestEmail activity
# - 30s sleep
# - PreparePromotionalEmail activity
# - SendPromotionalEmail activity
```

## Monitoring & Logging

### Log Messages to Watch For:

```
✅ Success indicators:
  🎂 Starting birthday test workflow
  📧 Sending birthday card and promotion as SEPARATE emails
  ✅ Birthday card sent successfully, waiting before sending promotion...
  ✅ Promotional email sent successfully

⚠️  Warnings (non-critical):
  Failed to prepare promotional email (birthday was sent)
  Failed to send promotional email (birthday was sent)

❌ Errors (workflow fails):
  Failed to prepare birthday test email
  Failed to send birthday test email
```

## Files Modified

1. ✅ `/home/root/Authentik/cardprocessor-go/internal/temporal/workflows.go`
   - Added split email logic to `BirthdayTestWorkflow`
   - Backup: `workflows.go.backup`

2. ✅ `/home/root/Authentik/cardprocessor-go/internal/temporal/activities.go`
   - Fixed `PreparePromotionalEmail` return values
   - Fixed `generatePromotionalHTML` base URL reference

3. ✅ `/home/root/Authentik/cardprocessor-go/internal/models/models.go`
   - Already has `SplitPromotionalEmail` field (no changes needed)

4. ✅ `/home/root/Authentik/cardprocessor-go/internal/handlers/birthday.go`
   - Already passes `SplitPromotionalEmail` to workflow (no changes needed)

## Build & Deploy

### Build:
```bash
cd /home/root/Authentik/cardprocessor-go
go build -o cardprocessor
```

### Run:
```bash
./cardprocessor
```

### Docker (if using):
```bash
docker build -t cardprocessor-go .
docker run -p 8080:8080 cardprocessor-go
```

## Rollback

If you need to revert:

```bash
cd /home/root/Authentik/cardprocessor-go
cp internal/temporal/workflows.go.backup internal/temporal/workflows.go
go build -o cardprocessor
```

## Future Enhancements

### Potential Improvements:

1. **Configurable Delay** - Allow users to set delay between emails (currently 30s)
2. **Analytics Dashboard** - Show comparison of split vs combined email performance
3. **A/B Testing** - Automatically test split vs combined for a percentage of users
4. **Real Birthday Cards** - Extend implementation to actual birthday card sending (not just tests)
5. **Per-Contact Preferences** - Allow contacts to choose how they receive promotional emails

## Status

✅ **Test Birthday Cards:** Complete and working  
⏳ **Real Birthday Cards:** Needs implementation  
✅ **Build Status:** Compiles successfully  
✅ **Ready for Testing:** Yes

---

**Last Updated:** 2025-10-03  
**Files Changed:** 2  
**Build Status:** ✅ Success  
**Feature Status:** ✅ Ready for Testing
