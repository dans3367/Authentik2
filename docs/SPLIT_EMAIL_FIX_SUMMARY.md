# Split Promotional Email - Backend Integration Fix

## Problem
The "Send promotion as separate email (Better Deliverability)" checkbox was not saving to the database because:
1. Backend API was not accepting the `splitPromotionalEmail` field
2. Frontend checkbox was only updating local state without triggering a save

## Solution Applied

### 1. Backend Changes (`server/routes/emailManagementRoutes.ts`)

#### Added field to request body destructuring (line ~1297):
```typescript
const {
  enabled,
  emailTemplate,
  segmentFilter,
  customMessage,
  customThemeData,
  senderName,
  promotionId,
  splitPromotionalEmail  // ✅ ADDED
} = req.body;
```

#### Added field to UPDATE operation (line ~1381):
```typescript
const updateData: any = {
  enabled,
  emailTemplate,
  segmentFilter,
  customMessage,
  senderName: finalSenderName,
  promotionId: promotionId || null,
  splitPromotionalEmail: splitPromotionalEmail !== undefined ? splitPromotionalEmail : false,  // ✅ ADDED
  updatedAt: new Date(),
};
```

#### Added field to INSERT operation (line ~1405):
```typescript
const insertData: any = {
  tenantId: req.user.tenantId,
  enabled,
  emailTemplate,
  segmentFilter,
  customMessage,
  senderName: finalSenderName,
  promotionId: promotionId || null,
  splitPromotionalEmail: splitPromotionalEmail !== undefined ? splitPromotionalEmail : false,  // ✅ ADDED
};
```

### 2. Frontend Changes (`client/src/pages/birthdays.tsx`)

#### Updated checkbox handler to trigger immediate save (line ~2161):

**Before:**
```typescript
onCheckedChange={(checked) => setSplitPromotionalEmail(checked as boolean)}
```

**After:**
```typescript
onCheckedChange={(checked) => {
  setSplitPromotionalEmail(checked as boolean);
  if (birthdaySettings) {
    const promotionId = selectedPromotions.length > 0 ? selectedPromotions[0] : null;
    updateSettingsMutation.mutate({
      id: birthdaySettings.id,
      enabled: birthdaySettings.enabled,
      emailTemplate: birthdaySettings.emailTemplate || 'default',
      segmentFilter: birthdaySettings.segmentFilter || 'all',
      customMessage: birthdaySettings.customMessage || '',
      senderName: birthdaySettings.senderName || '',
      customThemeData: birthdaySettings.customThemeData,
      promotionId: promotionId,
      splitPromotionalEmail: checked as boolean,  // ✅ Saves immediately
    });
  }
}}
```

## Files Modified

1. ✅ `/home/root/Authentik/server/routes/emailManagementRoutes.ts`
   - Backup created: `emailManagementRoutes.ts.backup`
   
2. ✅ `/home/root/Authentik/client/src/pages/birthdays.tsx`
   - No backup needed (can revert via git if needed)

## Testing

### Manual Test Steps:

1. **Start the server** (if not running):
   ```bash
   cd /home/root/Authentik
   npm run dev
   ```

2. **Open the birthday settings page** in your browser

3. **Select a promotion** from the dropdown

4. **Toggle the "Send promotion as separate email" checkbox**
   - ✅ Should see a success toast notification
   - ✅ Setting should persist on page reload

5. **Verify in database**:
   ```bash
   node -e "
   import('postgres').then(async ({ default: postgres }) => {
     const sql = postgres(process.env.DATABASE_URL);
     const settings = await sql\`SELECT split_promotional_email, promotion_id FROM birthday_settings\`;
     console.log('Birthday Settings:', settings);
     await sql.end();
   });
   "
   ```

### Expected Behavior:

- ✅ Checking the box immediately saves `split_promotional_email = true` to database
- ✅ Unchecking the box immediately saves `split_promotional_email = false` to database
- ✅ Value persists after page refresh
- ✅ Works for both new settings (INSERT) and existing settings (UPDATE)

## API Endpoint

**PUT** `/api/v1/email/birthday-settings`

**Request Body:**
```json
{
  "id": "birthday-settings-id",
  "enabled": true,
  "emailTemplate": "default",
  "segmentFilter": "all",
  "customMessage": "",
  "senderName": "Birthday Team",
  "promotionId": "promotion-id-or-null",
  "splitPromotionalEmail": true,
  "customThemeData": "{...}"
}
```

**Response:**
```json
{
  "id": "...",
  "tenantId": "...",
  "enabled": true,
  "splitPromotionalEmail": true,
  "promotionId": "...",
  "..."
}
```

## Rollback Instructions

If you need to revert these changes:

### Backend:
```bash
cp /home/root/Authentik/server/routes/emailManagementRoutes.ts.backup \
   /home/root/Authentik/server/routes/emailManagementRoutes.ts
```

### Frontend:
```bash
git checkout client/src/pages/birthdays.tsx
```

## Additional Notes

- The field defaults to `false` if not provided
- The frontend follows the same pattern as promotion selection (immediate save on change)
- No page reload is required - changes take effect immediately
- The fix is backward compatible with existing birthday settings

## Status

✅ **Backend Integration:** Complete  
✅ **Frontend Integration:** Complete  
✅ **Database Schema:** Already in place  
✅ **Ready for Testing:** Yes

---

**Date Fixed:** 2025-10-03  
**Files Changed:** 2  
**Lines Changed:** ~30
