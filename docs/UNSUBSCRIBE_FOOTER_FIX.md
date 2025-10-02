# Unsubscribe Footer Fix for Birthday Cards

## Summary
Fixed the unsubscribe footer injection in outgoing birthday cards sent from the `/cardprocessor-go` server to ensure all birthday card emails properly include an unsubscribe link when an unsubscribe token is present.

## Changes Made

### 1. Updated `internal/temporal/templates.go`

#### Fixed `renderCustomTemplate()` function:
- **Removed** inline `renderUnsubscribeSection(params)` call from `fromMessageSection`
- **Changed** padding from `30px` to `10px` in the `fromMessageSection` to make room for footer
- **Added** separate `unsubscribeSection` variable after `fromMessageSection` declaration
- **Added** `%s` placeholder for unsubscribe section in the HTML template
- **Added** `unsubscribeSection` to the return arguments

#### Fixed `renderPredefinedTemplate()` function:
- **Changed** padding from `30px` to `10px` in the `fromMessageSection`
- **Added** separate `unsubscribeSection` variable after `fromMessageSection` declaration
- **Added** `%s` placeholder for unsubscribe section in the HTML template
- **Added** `unsubscribeSection` to the return arguments

#### Enhanced `renderUnsubscribeSection()` function:
- **Updated** styling with improved visual appearance
- **Changed** from `margin-top: 40px; padding-top: 20px` to `padding: 20px 30px`
- **Added** `background-color: #f7fafc` for better visibility
- **Added** `font-weight: 500` to the unsubscribe link for emphasis
- Returns empty string if `UnsubscribeToken` is not provided

### 2. Existing Infrastructure (Verified)

The following components were already in place and functioning correctly:

- **BirthdayWorker** (`/server/workers/BirthdayWorker.ts`): Already generates unsubscribe tokens via API call to cardprocessor-go
- **Unsubscribe Token API** (`/cardprocessor-go/internal/handlers/birthday.go`): Handles token generation and storage
- **Database tables**: `birthday_unsubscribe_tokens` table for storing tokens
- **Unsubscribe page**: HTML templates for unsubscribe confirmation pages

## Technical Details

### Unsubscribe Footer Structure
```html
<div style="padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align: center; background-color: #f7fafc;">
    <p style="margin: 0; font-size: 0.8rem; color: #a0aec0; line-height: 1.4;">
        Don't want to receive birthday cards? 
        <a href="http://localhost:5000/api/unsubscribe/birthday?token={TOKEN}" style="color: #667eea; text-decoration: none; font-weight: 500;">Unsubscribe here</a>
    </p>
</div>
```

### Template Rendering Flow

1. **Test Emails** (`BirthdayTestWorkflow`):
   - Generates unsubscribe token in memory
   - Passes token to `PrepareBirthdayTestEmailWithPromotion` activity
   - Renders template with `RenderBirthdayTemplate()`
   - Token included in email HTML

2. **Production Emails** (`BirthdayWorker`):
   - Calls cardprocessor-go API to generate token: `POST /api/birthday-unsubscribe-token/{contactId}`
   - Token stored in database with contact association
   - Passes token to template renderer
   - Renders template with unsubscribe footer

3. **Unsubscribe Process**:
   - User clicks unsubscribe link with token
   - Server validates token from database
   - Updates `email_contacts` table: `birthday_email_enabled = false`
   - Marks token as used
   - Shows confirmation page

## Files Modified

- `/cardprocessor-go/internal/temporal/templates.go` - Fixed template rendering functions

## Files Backed Up

- `/cardprocessor-go/internal/temporal/templates.go.backup` - Original version before changes

## Testing

### Compilation Test
```bash
cd /home/root/Authentik/cardprocessor-go
go build -o /tmp/cardprocessor-test
# Result: ✅ Successful compilation with no errors
```

### Unit Test
```bash
go run /tmp/test_unsubscribe.go
# Results:
# ✅ Unsubscribe footer test PASSED - Token is properly included
# ✅ Unsubscribe URL: http://localhost:5000/api/unsubscribe/birthday?token=test123token456
# ✅ Footer styling PASSED - Background color included
# ✅ Link styling PASSED - Font weight included
```

## Impact

### Before Fix:
- ❌ Custom template: Unsubscribe footer embedded in `fromMessageSection` (only shown when no signature)
- ❌ Predefined templates: No unsubscribe footer rendered at all
- ❌ Inconsistent footer placement

### After Fix:
- ✅ Custom template: Unsubscribe footer always rendered separately when token present
- ✅ Predefined templates: Unsubscribe footer always rendered when token present
- ✅ Consistent footer placement across all templates
- ✅ Better visual styling with background color
- ✅ Proper separation from main content

## Deployment Notes

1. Rebuild the cardprocessor-go binary:
   ```bash
   cd /home/root/Authentik/cardprocessor-go
   go build -o cardprocessor-go
   ```

2. Restart the cardprocessor-go service:
   ```bash
   # If using systemd
   sudo systemctl restart cardprocessor-go
   
   # Or if running manually
   ./cardprocessor-go
   ```

3. No database migrations required - all necessary tables already exist

## Verification

To verify the fix is working:

1. Send a test birthday card with the unsubscribe token
2. Check the received email HTML
3. Verify the unsubscribe footer appears at the bottom
4. Click the unsubscribe link to verify functionality

## Environment Configuration

The unsubscribe URL uses `http://localhost:5000` by default. Update this in production:

```go
// In templates.go, line ~322
unsubscribeUrl := fmt.Sprintf("http://localhost:5000/api/unsubscribe/birthday?token=%s", params.UnsubscribeToken)
```

Change to your production domain:
```go
unsubscribeUrl := fmt.Sprintf("https://yourdomain.com/api/unsubscribe/birthday?token=%s", params.UnsubscribeToken)
```

## Compliance

This fix ensures compliance with:
- CAN-SPAM Act requirements
- GDPR unsubscribe requirements  
- Email marketing best practices

All birthday card emails now include a functional unsubscribe mechanism with proper tracking and database updates.

---

**Fixed by:** AI Assistant
**Date:** 2025-09-29
**Status:** ✅ Complete and Tested

---

## Update: Fixed %!s(MISSING) Error

**Date:** 2025-09-29 23:52

### Issue
Birthday card emails showed `%!s(MISSING)` at the bottom, indicating a mismatch between format string placeholders and arguments.

### Root Cause
During the initial fix, an extra `%s` placeholder was accidentally added inside the content div closing section, but no corresponding argument was provided to `fmt.Sprintf`.

### Solution
Removed the extra `%s` placeholder from both `renderCustomTemplate()` and `renderPredefinedTemplate()` functions.

**Correct structure:**
```html
<!-- 3. Content Area (message) -->
<div style="padding: 30px;">
    <div>%s</div>   ← message
    %s              ← promotionContent
    %s              ← signature
</div>              ← closes content div (no placeholder here)

%s                  ← fromMessageSection
%s                  ← unsubscribeSection
```

### Testing
```bash
cd /home/root/Authentik/cardprocessor-go
go build -o /tmp/cardprocessor-test
# Result: ✅ Successful compilation

go run /tmp/test_no_missing.go
# Results:
# ✅ PASSED: Custom template has no %!s(MISSING)
# ✅ PASSED: Predefined template has no %!s(MISSING)
```

### Final Status
✅ **Complete** - Unsubscribe footer properly injected without any format string errors.

