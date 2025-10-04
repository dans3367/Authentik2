# Testing Split Promotional Email Feature

## Quick Test Checklist

### ✅ Step 1: Enable the Feature
1. Go to Birthday Settings page
2. Select a promotion from dropdown
3. **Check the "Send promotion as separate email" checkbox**
4. Verify you see a success toast

### ✅ Step 2: Verify Database
```bash
node -e "
import('postgres').then(async ({ default: postgres }) => {
  const sql = postgres(process.env.DATABASE_URL);
  const settings = await sql\`
    SELECT 
      split_promotional_email, 
      promotion_id, 
      enabled 
    FROM birthday_settings
  \`;
  console.log('Birthday Settings:', settings);
  await sql.end();
});
"
```

**Expected Output:**
```json
[
  {
    "split_promotional_email": true,
    "promotion_id": "some-uuid",
    "enabled": true
  }
]
```

### ✅ Step 3: Send Test Birthday Card

1. Go to Birthday Settings page
2. Click "Send Test Card" button
3. **Watch the logs carefully**

### ✅ Step 4: Check Logs

Look for these log messages in your Go backend logs:

#### Handler Logs (birthday.go):
```
🎁 [Birthday Test] Found promotion ID in settings: <uuid>
📧 [Birthday Test] Split Promotional Email setting: true    ← MUST BE TRUE
🎂 [Birthday Test] Workflow input prepared: ...
📧 [Birthday Test] Will split promotional email: true (settings exist: true, split enabled: true)
```

#### Workflow Logs (Temporal):
```
📊 [Debug] Workflow settings splitPromotionalEmail=true hasPromotionID=true
📊 [Debug] Checking split email condition splitPromotionalEmail=true hasPromotion=true willSplit=true
✅ 📧 Sending birthday card and promotion as SEPARATE emails for better deliverability
```

### ✅ Step 5: Verify Emails

You should receive **TWO SEPARATE EMAILS**:

1. **Email 1 (Birthday Card)** - Arrives immediately
   - Subject: "🎉 Happy Birthday [Name]!"
   - Content: Birthday greeting **WITHOUT** promotion
   
2. **Email 2 (Promotion)** - Arrives 30 seconds later
   - Subject: "🎁 Special Offer: [Promotion Title]"
   - Content: Promotional offer

## Troubleshooting

### Problem: Still receiving combined email

#### Check 1: Is the checkbox saving?
```bash
# In browser console after clicking checkbox:
# You should see network request to PUT /api/v1/email/birthday-settings
# Response should include: "splitPromotionalEmail": true
```

#### Check 2: Is the database updated?
```bash
node -e "
import('postgres').then(async ({ default: postgres }) => {
  const sql = postgres(process.env.DATABASE_URL);
  const settings = await sql\`SELECT split_promotional_email FROM birthday_settings\`;
  console.log('Split Email:', settings[0].split_promotional_email);
  await sql.end();
});
"
```

#### Check 3: Is the Go backend reading it?
Look for this log when sending test:
```
📧 [Birthday Test] Split Promotional Email setting: true
```

**If this shows `false`:**
- Backend is reading old data
- Try restarting the Go backend
- Check database connection

#### Check 4: Is the workflow receiving it?
Look for this log in Temporal:
```
📊 [Debug] Workflow settings splitPromotionalEmail=true
```

**If this shows `false`:**
- The handler is not passing it correctly
- Check `birthdaySettings` is not nil

#### Check 5: Is the condition being met?
Look for this log:
```
📊 [Debug] Checking split email condition ... willSplit=true
```

**If `willSplit=false`:**
- Check both conditions:
  - `splitPromotionalEmail` must be `true`
  - `promotion` must not be `nil`

### Problem: Workflow logs show "Sending COMBINED email"

This means the split condition is not being met. Check:

```bash
# Verify both conditions:
# 1. splitPromotionalEmail = true
# 2. promotion_id is set and promotion was fetched
```

Look for:
```
✅ Promotion fetched successfully promotionId=<uuid>
```

**If promotion fetch failed:**
- Check promotion exists in database
- Check promotion is active
- Check tenant_id matches

### Problem: No logs appearing

**Backend not running:**
```bash
# Check if Go backend is running
ps aux | grep cardprocessor

# Start it if needed
cd /home/root/Authentik/cardprocessor-go
./cardprocessor
```

**Temporal worker not running:**
```bash
# Check Temporal worker
# Look for worker registration logs
```

## Debug Commands

### Check Current Settings:
```bash
# Full settings dump
node -e "
import('postgres').then(async ({ default: postgres }) => {
  const sql = postgres(process.env.DATABASE_URL);
  const settings = await sql\`SELECT * FROM birthday_settings\`;
  console.log(JSON.stringify(settings, null, 2));
  await sql.end();
});
"
```

### Manually Enable Split Email:
```sql
UPDATE birthday_settings 
SET split_promotional_email = true 
WHERE tenant_id = 'YOUR_TENANT_ID';
```

### Check Promotion:
```sql
SELECT id, title, type, is_active 
FROM promotions 
WHERE id = 'YOUR_PROMOTION_ID';
```

### Force Test with cURL:
```bash
curl -X POST http://localhost:8080/api/birthday/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userEmail": "test@example.com",
    "userFirstName": "Test",
    "userLastName": "User",
    "emailTemplate": "default",
    "customMessage": "Happy Birthday!",
    "senderName": "Birthday Team"
  }'
```

## Expected Log Flow (Success)

```
=== HANDLER ===
🎂 [Birthday Test] Using Temporal workflow
🎁 [Birthday Test] Found promotion ID in settings: abc-123
📧 [Birthday Test] Split Promotional Email setting: true
🎂 [Birthday Test] Workflow input prepared: ...
📧 [Birthday Test] Will split promotional email: true (settings exist: true, split enabled: true)

=== WORKFLOW ===
🎂 Starting birthday test workflow userId=... email=...
✅ Unsubscribe token generated successfully
📊 [Debug] Workflow settings splitPromotionalEmail=true hasPromotionID=true
🎁 Fetching promotion data promotionId=abc-123
✅ Promotion fetched successfully promotionId=abc-123 title="Special Offer"
📊 [Debug] Checking split email condition splitPromotionalEmail=true hasPromotion=true willSplit=true
✅ 📧 Sending birthday card and promotion as SEPARATE emails for better deliverability

=== ACTIVITIES ===
📧 Preparing birthday test email userId=... email=...
📤 Sending birthday test email to=... subject="🎉 Happy Birthday..."
✅ Birthday card sent successfully, waiting before sending promotion...
[30 second sleep]
📧 Preparing promotional email email=... promotionId=abc-123
📤 Sending promotional email to=... subject="🎁 Special Offer..."
✅ Promotional email sent successfully messageId=...
✅ Birthday test workflow completed with split emails success=true
```

## Common Issues

### Issue: "promotion is nil"
**Cause:** Promotion not fetched from database
**Solution:** 
- Verify promotion exists: `SELECT * FROM promotions WHERE id = '...'`
- Check promotion is_active = true
- Check tenant_id matches

### Issue: "splitPromotionalEmail is false"
**Cause:** Setting not saved or not loaded
**Solution:**
- Check database: `SELECT split_promotional_email FROM birthday_settings`
- Manually update if needed
- Restart Go backend to reload

### Issue: "Combined email still sent"
**Cause:** Condition not met in workflow
**Solution:**
- Check BOTH conditions must be true:
  1. `input.SplitPromotionalEmail == true`
  2. `promotion != nil`
- Review workflow debug logs

## Success Criteria

✅ Checkbox saves to database  
✅ Database shows `split_promotional_email = true`  
✅ Go handler reads `true` from database  
✅ Workflow receives `SplitPromotionalEmail: true`  
✅ Promotion is fetched successfully  
✅ Workflow takes split email branch  
✅ Birthday email sent WITHOUT promotion  
✅ 30 second delay occurs  
✅ Promotional email sent separately  
✅ Two emails received in inbox  

## Next Steps

If all checks pass but you're still not receiving separate emails:

1. **Check email provider** - Are both emails being sent?
2. **Check spam folder** - Is the promotional email being filtered?
3. **Check email tracking** - Look in `email_activity` table
4. **Check Temporal UI** - View workflow execution history

```bash
# Check email activity
node -e "
import('postgres').then(async ({ default: postgres }) => {
  const sql = postgres(process.env.DATABASE_URL);
  const activity = await sql\`
    SELECT activity_type, occurred_at 
    FROM email_activity 
    WHERE contact_id = 'YOUR_USER_ID'
    ORDER BY occurred_at DESC 
    LIMIT 10
  \`;
  console.log('Recent Email Activity:', activity);
  await sql.end();
});
"
```

---

**For Support:** Check logs at each layer (Frontend → Node Backend → Go Backend → Temporal → Email Provider)
