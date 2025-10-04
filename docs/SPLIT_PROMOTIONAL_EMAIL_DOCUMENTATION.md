# Split Promotional Email Feature - Documentation

## Overview

The "Split Promotional Email" feature allows you to send birthday cards and promotional content as **separate emails** to improve email deliverability and engagement rates.

## Database Implementation

### Table: `birthday_settings`

**Column Added:** `split_promotional_email`

```sql
split_promotional_email BOOLEAN DEFAULT false
```

**Purpose:** When enabled, the system will send:
1. A birthday greeting email (primary message)
2. A separate promotional email (if a promotion is attached)

## Benefits

✅ **Better Deliverability**: Smaller, focused emails are less likely to be flagged as spam
✅ **Higher Engagement**: Recipients can engage with birthday wishes separately from promotions
✅ **Improved Analytics**: Track birthday email opens vs. promotional email opens independently
✅ **Compliance**: Easier to manage unsubscribe preferences for different email types

## Database Schema

### Current Schema Location
- Schema file: `shared/schema.ts`
- Migration file: `migrations/018_add_split_promotional_email_to_birthday_settings.sql`

### Related Columns

```typescript
export const birthdaySettings = pgTable("birthday_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  enabled: boolean("enabled").default(false),
  emailTemplate: text("email_template").default('default'),
  segmentFilter: text("segment_filter").default('all'),
  customMessage: text("custom_message").default(''),
  customThemeData: text("custom_theme_data"),
  promotionId: varchar("promotion_id").references(() => promotions.id),
  splitPromotionalEmail: boolean("split_promotional_email").default(false), // ⭐ NEW
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

## SQL Queries

### Enable Split Promotional Email

```sql
UPDATE birthday_settings
SET split_promotional_email = true,
    updated_at = NOW()
WHERE tenant_id = 'YOUR_TENANT_ID';
```

### Disable Split Promotional Email

```sql
UPDATE birthday_settings
SET split_promotional_email = false,
    updated_at = NOW()
WHERE tenant_id = 'YOUR_TENANT_ID';
```

### Query Settings with Split Email Enabled

```sql
SELECT 
  id,
  tenant_id,
  enabled,
  split_promotional_email,
  promotion_id,
  email_template
FROM birthday_settings
WHERE split_promotional_email = true;
```

### Get Complete Birthday Settings for a Tenant

```sql
SELECT 
  bs.*,
  p.title as promotion_title,
  p.content as promotion_content,
  p.type as promotion_type
FROM birthday_settings bs
LEFT JOIN promotions p ON bs.promotion_id = p.id
WHERE bs.tenant_id = 'YOUR_TENANT_ID';
```

## API Integration Examples

### TypeScript/Node.js Example

```typescript
import postgres from 'postgres';

const sql = postgres(DATABASE_URL);

// Get birthday settings with split email status
async function getBirthdaySettings(tenantId: string) {
  const settings = await sql`
    SELECT 
      id,
      enabled,
      split_promotional_email,
      promotion_id,
      custom_message
    FROM birthday_settings
    WHERE tenant_id = ${tenantId}
  `;
  
  return settings[0];
}

// Enable split promotional email
async function enableSplitPromotionalEmail(tenantId: string) {
  await sql`
    UPDATE birthday_settings
    SET 
      split_promotional_email = true,
      updated_at = NOW()
    WHERE tenant_id = ${tenantId}
  `;
}

// Check if promotional email should be split
async function shouldSplitPromotionalEmail(tenantId: string): Promise<boolean> {
  const settings = await sql`
    SELECT split_promotional_email
    FROM birthday_settings
    WHERE tenant_id = ${tenantId}
  `;
  
  return settings[0]?.split_promotional_email ?? false;
}
```

## Implementation Logic

### Email Sending Flow

```typescript
async function sendBirthdayEmail(contact: EmailContact, tenantId: string) {
  const settings = await getBirthdaySettings(tenantId);
  
  // Always send the birthday card
  await sendBirthdayCard(contact, settings);
  
  // Check if we should send promotional email separately
  if (settings.promotion_id && settings.split_promotional_email) {
    // Send promotion as a separate email
    await sendPromotionalEmail(contact, settings.promotion_id);
  } else if (settings.promotion_id && !settings.split_promotional_email) {
    // Promotion is already included in the birthday card (legacy behavior)
    // No additional action needed
  }
}
```

## Testing

### Test Script

A comprehensive test script is available at `test-split-promotional-email.js`:

```bash
node test-split-promotional-email.js
```

This script will:
1. Query all birthday settings
2. Show which settings have split email enabled
3. Demonstrate updating the setting
4. Revert changes (safe to run)

### Manual Testing

```sql
-- Step 1: Check current state
SELECT tenant_id, split_promotional_email, promotion_id 
FROM birthday_settings;

-- Step 2: Enable split email for testing
UPDATE birthday_settings
SET split_promotional_email = true
WHERE tenant_id = 'YOUR_TEST_TENANT_ID';

-- Step 3: Verify the change
SELECT tenant_id, split_promotional_email, updated_at
FROM birthday_settings
WHERE tenant_id = 'YOUR_TEST_TENANT_ID';

-- Step 4: Revert if needed
UPDATE birthday_settings
SET split_promotional_email = false
WHERE tenant_id = 'YOUR_TEST_TENANT_ID';
```

## Migration History

### Migration 018: Add split_promotional_email column

**File:** `migrations/018_add_split_promotional_email_to_birthday_settings.sql`

```sql
-- Migration: Add split_promotional_email column to birthday_settings table
-- This enables sending birthday cards and promotions as separate emails for better deliverability

ALTER TABLE birthday_settings 
ADD COLUMN IF NOT EXISTS split_promotional_email BOOLEAN DEFAULT false;

COMMENT ON COLUMN birthday_settings.split_promotional_email IS 
  'When enabled, sends birthday card and promotional email separately to improve deliverability';
```

**Status:** ✅ Applied

## Frontend Integration

### UI Checkbox Example

```typescript
// In your birthday settings form
<FormField
  control={form.control}
  name="splitPromotionalEmail"
  render={({ field }) => (
    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
      <FormControl>
        <Checkbox
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      </FormControl>
      <div className="space-y-1 leading-none">
        <FormLabel>
          Send promotion as separate email (Better Deliverability)
        </FormLabel>
        <FormDescription>
          When enabled, birthday greetings and promotions will be sent 
          as two separate emails to improve deliverability rates
        </FormDescription>
      </div>
    </FormItem>
  )}
/>
```

## Performance Considerations

1. **Email Volume**: Enabling this feature will increase email volume by up to 2x for contacts with birthdays and promotions
2. **Rate Limiting**: Ensure your email service provider can handle the increased volume
3. **Tracking**: Set up separate tracking for birthday emails vs promotional emails
4. **Unsubscribe Logic**: Consider implementing separate unsubscribe options for:
   - Birthday emails
   - Promotional emails

## Best Practices

✅ **DO:**
- Enable this for high-value promotional campaigns
- Monitor deliverability metrics before and after enabling
- A/B test with a small segment first
- Provide clear unsubscribe options for both email types

❌ **DON'T:**
- Enable for tenants with very small email quotas
- Send promotional emails too frequently
- Combine this with aggressive promotional content

## Monitoring & Analytics

### Key Metrics to Track

```sql
-- Track email open rates by type
SELECT 
  ea.activity_type,
  COUNT(*) as count,
  bs.split_promotional_email
FROM email_activity ea
JOIN birthday_settings bs ON ea.tenant_id = bs.tenant_id
WHERE ea.activity_type IN ('opened', 'clicked')
  AND ea.occurred_at >= NOW() - INTERVAL '30 days'
GROUP BY ea.activity_type, bs.split_promotional_email;
```

### Deliverability Comparison

```sql
-- Compare bounce rates with/without split emails
SELECT 
  bs.split_promotional_email,
  COUNT(CASE WHEN ea.activity_type = 'bounced' THEN 1 END) as bounces,
  COUNT(CASE WHEN ea.activity_type = 'delivered' THEN 1 END) as delivered,
  ROUND(
    COUNT(CASE WHEN ea.activity_type = 'bounced' THEN 1 END)::numeric / 
    NULLIF(COUNT(CASE WHEN ea.activity_type = 'delivered' THEN 1 END), 0) * 100,
    2
  ) as bounce_rate_pct
FROM email_activity ea
JOIN birthday_settings bs ON ea.tenant_id = bs.tenant_id
WHERE ea.occurred_at >= NOW() - INTERVAL '30 days'
GROUP BY bs.split_promotional_email;
```

## Troubleshooting

### Issue: Setting not being saved

```sql
-- Check if column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'birthday_settings' 
  AND column_name = 'split_promotional_email';
```

### Issue: Promotional emails not being split

```typescript
// Debug query
const debugInfo = await sql`
  SELECT 
    bs.tenant_id,
    bs.split_promotional_email,
    bs.promotion_id,
    p.title as promotion_title
  FROM birthday_settings bs
  LEFT JOIN promotions p ON bs.promotion_id = p.id
  WHERE bs.tenant_id = ${tenantId}
`;

console.log('Debug Info:', debugInfo[0]);
```

## Rollback Instructions

If you need to remove this feature:

```sql
-- Rollback migration
ALTER TABLE birthday_settings 
DROP COLUMN IF EXISTS split_promotional_email;
```

**Note:** This will permanently delete all split email preferences. Make sure to backup data first.

## Support & Questions

For questions or issues related to this feature:

1. Check the test script: `node test-split-promotional-email.js`
2. Review migration logs: `migrations/018_add_split_promotional_email_to_birthday_settings.sql`
3. Check database state: Run verification queries above

## Version History

- **v1.0** (2025-10-03): Initial implementation
  - Added `split_promotional_email` column to `birthday_settings` table
  - Created migration 018
  - Added test scripts and documentation

---

**Last Updated:** 2025-10-03  
**Feature Status:** ✅ Production Ready  
**Database Migration:** ✅ Applied
