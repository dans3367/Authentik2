# Split Promotional Email Feature

## Overview
This feature allows sending birthday cards and promotional content as two separate emails to improve email deliverability and avoid spam filters.

## Implementation Summary

### 1. Frontend Changes (`client/src/pages/birthdays.tsx`)
- Added state variable `splitPromotionalEmail` to track the toggle
- Added UI toggle in the Promotions tab that appears when a promotion is selected
- Toggle updates birthday settings when changed
- Integrated into the birthday settings mutation

### 2. Database Changes
- **Migration**: `migrations/018_add_split_promotional_email_to_birthday_settings.sql`
- Added column `split_promotional_email` (BOOLEAN, default: false) to `birthday_settings` table
- **Schema**: Updated `shared/schema.ts` with the new field

### 3. Go Backend Changes

#### Models (`cardprocessor-go/internal/models/models.go`)
- Added `SplitPromotionalEmail` field to `BirthdaySettings` struct
- Added `SplitPromotionalEmail` field to `UpdateBirthdaySettingsRequest` struct

#### Handlers (`cardprocessor-go/internal/handlers/birthday.go`)
- Updated `UpdateBirthdaySettings` to handle the new field
- Updated `SendTestBirthdayCard` to pass `SplitPromotionalEmail` to workflow
- Added `getBoolValue` helper function

#### Temporal Activities (`cardprocessor-go/internal/temporal/activities.go`)
- Added `PreparePromotionalEmailInput` struct
- Created `PreparePromotionalEmail` activity
- Created `SendPromotionalEmail` activity
- Created `generatePromotionalHTML` function

#### Temporal Workflows (`cardprocessor-go/internal/temporal/workflows.go`)
- Added `SplitPromotionalEmail` field to `BirthdayTestWorkflowInput`
- Modified workflow logic to:
  - Check if `SplitPromotionalEmail` is enabled
  - If enabled:
    1. Send birthday card WITHOUT promotion
    2. Wait 30 seconds (for deliverability)
    3. Send promotional email separately
  - If disabled: Send combined email (existing behavior)

## How It Works

### When Split Email is Enabled:
1. User enables "Send promotion as separate email" in the Promotions tab
2. Setting is saved to database
3. When sending birthday cards:
   - Birthday card is sent first (clean, focused message)
   - System waits 30 seconds
   - Promotional email is sent as a follow-up
   - Both emails have unsubscribe links
   - If promotional email fails, birthday card success is still reported

### When Split Email is Disabled (Default):
- Works as before: birthday card and promotion are combined in one email

## Benefits
- **Better Deliverability**: Separate emails reduce spam filter triggers
- **Higher Engagement**: Clean birthday message followed by focused promotion
- **Improved Metrics**: Can track open/click rates separately for each email type
- **Fault Tolerance**: Birthday card is always sent, even if promotion fails

## Testing Instructions

### 1. Restart Services
```bash
# Restart the Go backend
cd /home/root/Authentik/cardprocessor-go
go build && ./cardprocessor-go

# Or if using systemd
sudo systemctl restart cardprocessor-go
```

### 2. Test the UI
1. Navigate to `/birthdays?tab=promotions`
2. Select a promotion
3. You should see a new checkbox: "Send promotion as separate email (Better Deliverability)"
4. Enable the checkbox
5. Save settings

### 3. Test Email Sending
1. Go to `/birthdays?tab=test`
2. Select a test user
3. Click "Send Test Card"
4. With split email enabled, you should receive:
   - First email: Birthday card only
   - Second email: Promotional content (after ~30 seconds)

### 4. Verify Database
```sql
SELECT split_promotional_email FROM birthday_settings WHERE tenant_id = 'your-tenant-id';
```

## Configuration
No additional configuration needed. The feature uses existing email service (Resend) and settings.

## Notes
- The 30-second delay between emails is configurable in the workflow (line with `workflow.Sleep`)
- Promotional emails have their own subject line format: "🎁 Special Offer: [Promotion Title]"
- Both emails include unsubscribe links
- Feature is tenant-specific (each tenant can configure independently)

## Rollback
If needed, to disable the feature:
1. Set `split_promotional_email = false` in database
2. OR uncheck the toggle in UI

To completely remove the feature:
```sql
ALTER TABLE birthday_settings DROP COLUMN IF EXISTS split_promotional_email;
```

## Future Enhancements
- Add delay configuration in UI
- Add email analytics for split vs combined emails
- Support for multiple promotional emails
- A/B testing capabilities
