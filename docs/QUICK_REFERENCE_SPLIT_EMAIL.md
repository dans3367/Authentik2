# Quick Reference: Split Promotional Email Feature

## TL;DR

The `split_promotional_email` boolean field in `birthday_settings` table controls whether birthday greetings and promotions are sent as one combined email or two separate emails.

## Quick Commands

### Check if feature is available
```bash
node test-split-promotional-email.js
```

### Enable for a tenant (SQL)
```sql
UPDATE birthday_settings
SET split_promotional_email = true
WHERE tenant_id = 'YOUR_TENANT_ID';
```

### Query current state
```sql
SELECT tenant_id, split_promotional_email, promotion_id 
FROM birthday_settings;
```

## Database Details

- **Table:** `birthday_settings`
- **Column:** `split_promotional_email`
- **Type:** `BOOLEAN`
- **Default:** `false`
- **Migration:** `018_add_split_promotional_email_to_birthday_settings.sql`

## When to Use

✅ Use when:
- You want better email deliverability
- You have promotional content attached to birthdays
- You want separate analytics for birthday vs promotional emails
- You want to reduce spam filter triggers

❌ Don't use when:
- You have limited email quotas
- Promotions are integral to the birthday message
- You want to minimize email volume

## Files to Reference

1. **Documentation:** `SPLIT_PROMOTIONAL_EMAIL_DOCUMENTATION.md`
2. **Test Script:** `test-split-promotional-email.js`
3. **Schema:** `shared/schema.ts`
4. **Migration:** `migrations/018_add_split_promotional_email_to_birthday_settings.sql`

## Status

✅ Feature is **READY** and **AVAILABLE** for use
✅ Database migration has been **APPLIED**
✅ No additional setup required

---
**Quick Access:** Run `cat SPLIT_PROMOTIONAL_EMAIL_DOCUMENTATION.md` for full docs
