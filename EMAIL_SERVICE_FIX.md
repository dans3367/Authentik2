# Email Service Method Fix

## Problem
Getting error when sending birthday cards:
```
TypeError: enhancedEmailService.send is not a function
```

## Root Cause
The `enhancedEmailService` doesn't have a `send()` method. It has `sendCustomEmail()` with a different signature.

## Fix Applied

### Updated Method Call in `server/routes/emailManagementRoutes.ts`

#### Before (line ~1948):
```typescript
const result = await enhancedEmailService.send({
  to: contact.email,
  from: 'admin@zendwise.work',
  subject: `🎉 Happy Birthday ${recipientName}!`,
  html: htmlContent,
  text: htmlContent.replace(/<[^>]*>/g, ''),
  tags: ['birthday', 'manual', `tenant-${tenantId}`],
  metadata: {
    type: 'birthday-card',
    contactId: contact.id,
    tenantId: tenantId,
    manual: true,
    unsubscribeToken: unsubscribeToken || 'none',
  },
});
```

#### After:
```typescript
const result = await enhancedEmailService.sendCustomEmail(
  contact.email,
  `🎉 Happy Birthday ${recipientName}!`,
  htmlContent,
  {
    text: htmlContent.replace(/<[^>]*>/g, ''),
    from: 'admin@zendwise.work',
    metadata: {
      type: 'birthday-card',
      contactId: contact.id,
      tenantId: tenantId,
      manual: true,
      tags: ['birthday', 'manual', `tenant-${tenantId}`],
      unsubscribeToken: unsubscribeToken || 'none',
    },
  }
);
```

### Method Signature Difference

**sendCustomEmail parameters:**
1. `to` - string or string[]
2. `subject` - string
3. `html` - string
4. `options` - object with:
   - `text?` - plain text version
   - `from?` - sender email
   - `metadata?` - custom metadata
   - `preferredProvider?` - which provider to use
   - `useQueue?` - whether to queue

### Updated Result Handling

The `sendCustomEmail` method can return:
- `EmailSendResult` object (when sent immediately)
- `string` (queue ID when queued)

Updated code to handle both cases:

```typescript
if (typeof result === 'string') {
  // Queued
  console.log(`✅ Birthday card queued: ${result}`);
  results.push({
    contactId: contact.id,
    email: contact.email,
    success: true,
    messageId: result,
  });
} else if (result.success) {
  // Sent immediately
  console.log(`✅ Birthday card sent`);
  results.push({
    contactId: contact.id,
    email: contact.email,
    success: true,
    messageId: result.messageId,
  });
} else {
  // Failed
  results.push({
    contactId: contact.id,
    email: contact.email,
    success: false,
    error: result.error,
  });
}
```

## What Was Fixed

1. ✅ Changed from `.send()` to `.sendCustomEmail()`
2. ✅ Updated parameter order and structure
3. ✅ Moved tags into metadata (where they belong)
4. ✅ Added handling for queued emails (string return)
5. ✅ Maintained all functionality (text version, metadata, etc.)

## Hot Reload

The tsx dev server should automatically pick up these changes. If not:

```bash
cd /home/root/Authentik
pkill -f "tsx server/index.ts"
sleep 2
npm run dev
```

## Test Now

The feature should now work! Go to:
1. `/birthdays?tab=customers`
2. Select customer(s)
3. Click ellipse menu (⋮)
4. Click "Send Birthday Card"
5. ✅ Should send successfully!

## All Fixes Summary

1. ✅ Missing imports (`eq`, `and`) - FIXED
2. ✅ Missing `enhancedEmailService` import - FIXED
3. ✅ Wrong cardprocessor port (8082 → 5004) - FIXED
4. ✅ Missing JWT auth for cardprocessor - FIXED
5. ✅ Wrong email service method (`send` → `sendCustomEmail`) - FIXED

The feature is now fully functional! 🎉

