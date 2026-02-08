# How Unsubscribe Tokens Work

## Overview

The unsubscribe token system allows customers to opt-out of birthday card emails through a secure, one-time-use link. This document explains the complete lifecycle of unsubscribe tokens.

## Token Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    TOKEN LIFECYCLE                          │
└─────────────────────────────────────────────────────────────┘

1. GENERATION          2. EMBEDDING         3. CUSTOMER CLICK
   (When sending          (In email            (From email)
    birthday email)        footer)
        ↓                      ↓                    ↓
   [32-byte random]      [URL with token]     [Browser opens]
        ↓                      ↓                    ↓
   [Stored in DB]        [Sent to customer]   [Shows form]
        ↓                                           ↓
                                            4. SUBMISSION
                                               (Customer
                                                confirms)
                                                   ↓
                                            5. PROCESSING
                                               [Validate]
                                                   ↓
                                            [Mark as used]
                                                   ↓
                                            [Update contact]
                                                   ↓
                                            [Show success]
```

## Step-by-Step Process

### 1️⃣ Token Generation (When Sending Birthday Email)

**Where:** `cardprocessor-go/internal/temporal/workflows.go`

```go
// Step 1: Generate unsubscribe token
var unsubscribeTokenResult TokenResult
err := workflow.ExecuteActivity(ctx, GenerateBirthdayUnsubscribeToken, TokenInput{
    ContactID: input.UserID,
    TenantID:  input.TenantID,
    Action:    "unsubscribe_birthday",
    ExpiresIn: "never",
}).Get(ctx, &unsubscribeTokenResult)
```

**What Happens:**
1. **Generate Random Token:** 32 bytes of cryptographically secure random data
2. **Encode to Hex:** Convert bytes to readable string (64 characters)
3. **Store in Database:** Save to `birthday_unsubscribe_tokens` table

**Code:** `cardprocessor-go/internal/handlers/birthday.go` (lines 579-589)

```go
// Generate secure random token
tokenBytes := make([]byte, 32)    // 32 bytes = 256 bits
_, err = rand.Read(tokenBytes)     // Cryptographically secure random
token := hex.EncodeToString(tokenBytes)  // Convert to hex string (64 chars)
```

**Database Record Created:**

| Field | Value | Description |
|-------|-------|-------------|
| `id` | UUID | Unique identifier |
| `tenant_id` | "abc-123..." | Tenant who owns this token |
| `contact_id` | "contact-456..." | Which contact this is for |
| `token` | "a1b2c3d4..." | The actual 64-character token |
| `used` | `false` | Whether token has been used |
| `created_at` | `2025-09-30 10:00:00` | When token was created |
| `used_at` | `NULL` | When token was used (null initially) |

### 2️⃣ Token Embedded in Email

**Where:** `cardprocessor-go/internal/temporal/activities.go`

```go
// Add unsubscribe token to custom theme data
if enrichedInput.CustomThemeData == nil {
    enrichedInput.CustomThemeData = make(map[string]interface{})
}
enrichedInput.CustomThemeData["unsubscribeToken"] = tokenToAdd
```

**Email Footer Includes:**

```html
<a href="https://yourdomain.com/api/unsubscribe/birthday?token=a1b2c3d4e5f6...">
    Unsubscribe from birthday emails
</a>
```

**Full URL Example:**
```
https://yourdomain.com/api/unsubscribe/birthday?token=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8
```

### 3️⃣ Customer Clicks Link

**Flow:**
```
Customer Email Client
    ↓ (clicks link)
https://yourdomain.com/api/unsubscribe/birthday?token=xxx
    ↓
Express Server (Port 5000) - Proxy
    ↓
Cardprocessor-Go (Port 5004)
    ↓
ShowBirthdayUnsubscribePage() Handler
```

**Handler Code:** `cardprocessor-go/internal/handlers/birthday.go` (lines 612-661)

```go
func (h *BirthdayHandler) ShowBirthdayUnsubscribePage(c *gin.Context) {
    token := c.Query("token")
    
    // 1. Validate token exists
    if token == "" {
        // Show error: Token is missing
    }
    
    // 2. Lookup token in database
    unsubToken, err := h.repo.GetBirthdayUnsubscribeToken(ctx, token)
    
    // 3. Check if token exists
    if unsubToken == nil {
        // Show error: Token not found
    }
    
    // 4. Check if already used
    if unsubToken.Used {
        // Show success: Already unsubscribed
    }
    
    // 5. Get contact information
    contact, err := h.repo.GetContactByID(ctx, unsubToken.TenantID, unsubToken.ContactID)
    
    // 6. Show unsubscribe form with contact info
    c.HTML(http.StatusOK, "unsubscribe.html", gin.H{
        "Token":     token,
        "Email":     contact.Email,
        "FirstName": contact.FirstName,
        "LastName":  contact.LastName,
    })
}
```

**Customer Sees:**
```html
┌──────────────────────────────────────┐
│   Unsubscribe from Birthday Cards    │
│                                      │
│   John Smith                         │
│   john.smith@example.com             │
│                                      │
│   Why are you unsubscribing?         │
│   [Dropdown: Select a reason...]     │
│                                      │
│   Additional feedback (optional)     │
│   [Text area for feedback]           │
│                                      │
│   [Unsubscribe]  [Cancel]            │
└──────────────────────────────────────┘
```

### 4️⃣ Customer Submits Form

**Form Data:**
```
POST /api/unsubscribe/birthday

token=a1b2c3d4e5f6...
reason=not_interested
feedback=I don't celebrate birthdays
```

**Handler:** `cardprocessor-go/internal/handlers/birthday.go` (lines 664-735)

### 5️⃣ Processing Unsubscribe

**Step-by-Step:**

```go
// 1. Validate token again
unsubToken, err := h.repo.GetBirthdayUnsubscribeToken(ctx, req.Token)

// 2. Check if already used
if unsubToken.Used {
    return error("Token already used")
}

// 3. Get contact info
contact, err := h.repo.GetContactByID(ctx, unsubToken.TenantID, unsubToken.ContactID)

// 4. Unsubscribe the contact
err = h.repo.UnsubscribeContactFromBirthdayEmails(ctx, unsubToken.ContactID, req.Reason)

// 5. Mark token as used
err = h.repo.MarkBirthdayUnsubscribeTokenUsed(ctx, unsubToken.ID)

// 6. Show success page
c.HTML(http.StatusOK, "unsubscribe_success.html", ...)
```

**Database Updates:**

**Table: `birthday_unsubscribe_tokens`**
```sql
UPDATE birthday_unsubscribe_tokens 
SET used = true, 
    used_at = NOW()
WHERE id = 'token-id';
```

**Table: `email_contacts`**
```sql
UPDATE email_contacts 
SET birthday_email_enabled = false,
    birthday_unsubscribe_reason = 'not_interested',
    birthday_unsubscribed_at = NOW(),
    updated_at = NOW()
WHERE id = 'contact-id';
```

## Database Schema

### Table: `birthday_unsubscribe_tokens`

```sql
CREATE TABLE birthday_unsubscribe_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    contact_id VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,        -- 64-char hex string
    used BOOLEAN DEFAULT FALSE,                 -- One-time use flag
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE,          -- When token was used
    FOREIGN KEY (contact_id) REFERENCES email_contacts(id) ON DELETE CASCADE
);

-- Indexes for fast lookups
CREATE INDEX idx_birthday_unsubscribe_tokens_token ON birthday_unsubscribe_tokens(token);
CREATE INDEX idx_birthday_unsubscribe_tokens_contact_id ON birthday_unsubscribe_tokens(contact_id);
CREATE INDEX idx_birthday_unsubscribe_tokens_tenant_id ON birthday_unsubscribe_tokens(tenant_id);
```

### Table: `email_contacts` (Additional Fields)

```sql
ALTER TABLE email_contacts 
ADD COLUMN birthday_unsubscribe_reason TEXT,
ADD COLUMN birthday_unsubscribed_at TIMESTAMP WITH TIME ZONE,
-- birthday_email_enabled already exists (set to false when unsubscribed)
```

## Security Features

### 🔒 Cryptographically Secure
- Uses `crypto/rand` for token generation
- 32 bytes (256 bits) of entropy
- Effectively impossible to guess

### 🔒 One-Time Use
- Token marked as `used = true` after processing
- Subsequent attempts show "already unsubscribed" message
- Prevents replay attacks

### 🔒 No Expiration (By Design)
- Tokens never expire
- Customer can unsubscribe anytime, even years later
- Simplifies user experience

### 🔒 Tenant Isolation
- Each token linked to specific tenant
- Cross-tenant access prevented
- Multi-tenant security maintained

### 🔒 No Authentication Required
- Public access by design
- Token itself is the authentication
- Simplifies unsubscribe flow for customers

## Code Locations

### Generation
- **Handler:** `cardprocessor-go/internal/handlers/birthday.go` (lines 541-609)
- **Repository:** `cardprocessor-go/internal/repository/repository.go` (lines 625-652)
- **Workflow:** `cardprocessor-go/internal/temporal/workflows.go` (lines 82-99)
- **Activity:** `cardprocessor-go/internal/temporal/activities.go` (lines 455-476)

### Validation & Processing
- **Show Form:** `cardprocessor-go/internal/handlers/birthday.go` (lines 612-661)
- **Process Form:** `cardprocessor-go/internal/handlers/birthday.go` (lines 664-735)
- **Get Token:** `cardprocessor-go/internal/repository/repository.go` (lines 654-681)
- **Mark Used:** `cardprocessor-go/internal/repository/repository.go` (lines 683-698)
- **Unsubscribe Contact:** `cardprocessor-go/internal/repository/repository.go` (lines 700-718)

### Templates
- **Unsubscribe Form:** `cardprocessor-go/templates/unsubscribe.html`
- **Success Page:** `cardprocessor-go/templates/unsubscribe_success.html`
- **Error Page:** `cardprocessor-go/templates/unsubscribe_error.html`

### Routing
- **Router Setup:** `cardprocessor-go/internal/router/router.go` (lines 44-45)
- **Express Proxy:** `server/routes.ts` (lines 193-253)

## Token Format

### Structure
```
Token: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
       └────────────────────────────────────┬──────────────────────────────────┘
                           64 characters (hex-encoded 32 bytes)
```

### Example Token
```
Bytes:  [0xA1, 0xB2, 0xC3, ..., 0xF2]  (32 bytes)
Hex:    "a1b2c3f2..."                   (64 characters)
```

## Testing Tokens

### Generate Test Token
```bash
# Via API (authenticated)
curl -X POST http://localhost:5004/api/birthday-unsubscribe-token/CONTACT_ID \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json"

# Response:
{
  "success": true,
  "token": "a1b2c3d4e5f6...",
  "contact": {
    "id": "contact-123",
    "email": "john@example.com"
  }
}
```

### Test Unsubscribe Flow
```bash
# 1. Get the form
curl "http://localhost:5002/api/unsubscribe/birthday?token=YOUR_TOKEN"

# 2. Submit unsubscribe
curl -X POST http://localhost:5002/api/unsubscribe/birthday \
  -d "token=YOUR_TOKEN" \
  -d "reason=not_interested" \
  -d "feedback=Just testing"
```

### Verify in Database
```sql
-- Check token status
SELECT * FROM birthday_unsubscribe_tokens 
WHERE token = 'YOUR_TOKEN';

-- Check contact status
SELECT 
  email,
  birthday_email_enabled,
  birthday_unsubscribe_reason,
  birthday_unsubscribed_at
FROM email_contacts 
WHERE id = 'CONTACT_ID';
```

## Future Email Checks

When birthday workers process contacts:

```go
// Workers query only contacts who haven't unsubscribed
SELECT * FROM email_contacts 
WHERE birthday_email_enabled = true  -- Excludes unsubscribed contacts
  AND birthday IS NOT NULL
  AND /* other conditions */
```

Unsubscribed contacts are automatically excluded from future birthday emails.

## Troubleshooting

### Token Not Found
- Check if token is complete (64 characters)
- Verify token exists in database
- Check if URL was truncated in email

### Token Already Used
- Normal behavior for re-clicking link
- Shows success message
- Contact remains unsubscribed

### Database Connection Issues
- Verify cardprocessor-go is running
- Check `DATABASE_URL` environment variable
- Review cardprocessor-go logs

## Related Documentation

- 📄 `/UNSUBSCRIBE_IMPLEMENTATION.md` - Implementation guide
- 📄 `/cardprocessor-go/UNSUBSCRIBE_SERVER.md` - Server details
- 📄 `/cardprocessor-go/UNSUBSCRIBE_FLOW.txt` - Visual flow diagram
- 📄 `/PORT_CONFIGURATION.md` - Port setup

---

**Last Updated:** September 30, 2025  
**Token Security:** Cryptographically secure, one-time use  
**Token Expiration:** Never (by design)