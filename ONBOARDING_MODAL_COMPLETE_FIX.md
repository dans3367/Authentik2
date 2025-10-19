# Complete Onboarding Modal Fix - Summary

## Problem
Onboarding modal not showing for newly signed up users.

## Root Cause
The auth hook was creating tenants but NOT creating company records. Without a company record, the `/api/company` endpoint returns 404, and the onboarding modal doesn't show.

## Complete Solution Implemented

### 1. Backend Fixes

#### Updated `server/auth.ts` ✅
The signup hook now creates **BOTH** tenant and company:
```typescript
// Create tenant
const [newTenant] = await db.insert(tenants).values({...});

// Update user with tenant ID
await db.update(betterAuthUser).set({...});

// CREATE COMPANY (THIS WAS MISSING!)
await db.insert(companies).values({
  tenantId: newTenant.id,
  ownerId: user.id,
  name: companyName,
  setupCompleted: false, // Triggers onboarding modal
  isActive: true,
});
```

#### Added Company Name Collection ✅
- Created `/api/signup/store-company-name` endpoint
- Stores company name before Better Auth signup
- Auth hook retrieves it and uses it for company creation

#### Enhanced Logging ✅
Added comprehensive logging to:
- `server/routes/companyRoutes.ts` - Company API logging
- `client/src/components/AppLayout.tsx` - Frontend onboarding checks
- `server/auth.ts` - Auth hook execution

### 2. Frontend Fixes

#### Updated Signup Form ✅
Added company name field to registration:
- Location: After first/last name, before email
- Validation: Minimum 2 characters
- Required field

#### Enhanced AppLayout Logging ✅
Now logs:
- When checking onboarding status
- Company API response details
- Whether modal will show or not
- Warnings when company is missing

### 3. Database Migration ✅
Created `migrations/025_add_onboarding_fields_to_companies.sql`:
- `setup_completed` (boolean, default: false)
- `geographical_location` (text)
- `language` (text, default: 'en')
- `business_description` (text)

### 4. Helper Scripts ✅
- `test-onboarding-fix.ts` - Verify database schema and relationships
- `test-signup-flow.ts` - Test complete signup process
- `fix-missing-companies.ts` - Create companies for existing users
- `create-test-account.ts` - Create test account for verification
- `debug-onboarding.ts` - Check onboarding status
- `reset-onboarding.ts` - Reset onboarding for testing

---

## Testing

### ✅ Test Account Created
A test account has been created to verify the onboarding modal:

**Login Credentials:**
- Email: `testuser1760869940263@example.com`
- Password: `Test123!`
- Company: "Test Company for Onboarding"
- Setup Completed: `false` (should show modal)

### Testing Instructions

#### Step 1: Start the Server
```bash
cd /Users/root1/Documents/GitHub/Authentik
npm run dev
```

#### Step 2: Test with Pre-Created Account
1. Open browser and navigate to login page
2. Log in with: `testuser1760869940263@example.com` / `Test123!`
3. Watch **Browser Console** for:
   ```
   🏢 [Onboarding] Checking onboarding status for user: testuser...
   🏢 [Onboarding] Company API response: { status: 200, ok: true }
   🏢 [Onboarding] Company data: { name: 'Test Company...', setupCompleted: false }
   🎯 [Onboarding] Showing onboarding modal (setupCompleted: false)
   ```

4. Watch **Server Console** for:
   ```
   🏢 [GET /api/company] Fetching company for user testuser...
   ✅ [GET /api/company] Found company: { name: '...', setupCompleted: false }
   ```

5. ✅ **Onboarding modal should appear!**

#### Step 3: Test with NEW Signup
1. Go to signup page
2. Fill in the form:
   - First Name: John
   - Last Name: Doe
   - **Company Name: My Test Company** ← NEW FIELD!
   - Email: your-test@example.com
   - Password: Test123!
   - Confirm Password: Test123!

3. Watch **Server Console** for:
   ```
   🔧 Creating tenant and company for new user: your-test@example.com
   📝 Company name for your-test@example.com: My Test Company (from signup form)
   ✅ Tenant and company created for your-test@example.com: {
     tenantId: '...',
     tenantName: 'My Test Company',
     companyName: 'My Test Company'
   }
   ```

4. Verify email and log in
5. Watch for onboarding modal logs (same as Step 2)
6. ✅ **Onboarding modal should appear!**

---

## Complete Signup Flow

```
User fills signup form
    ↓
Frontend: POST /api/signup/store-company-name
    { email, companyName: "My Test Company" }
    ↓
Server: Store in global.pendingCompanyNames[email]
    ↓
Frontend: Better Auth signup
    ↓
Better Auth: Create user in database
    ↓
Auth Hook: Run after user creation
    ↓
Auth Hook: Retrieve companyName from global.pendingCompanyNames
    ↓
Auth Hook: Create tenant: "My Test Company"
    ↓
Auth Hook: Update user.tenantId
    ↓
Auth Hook: Create company: 
    { 
      name: "My Test Company",
      setupCompleted: false 
    } ← THIS TRIGGERS THE MODAL!
    ↓
Auth Hook: Clean up global.pendingCompanyNames
    ↓
User verifies email and logs in
    ↓
AppLayout: GET /api/company
    ↓
Server: Returns company with setupCompleted: false
    ↓
AppLayout: Show onboarding modal
    ✅ Success!
```

---

## Verification Checklist

After starting the server, verify:

### Database Schema
```bash
tsx test-onboarding-fix.ts
```
Expected output:
- ✅ All onboarding fields exist
- ✅ All users have company records
- ✅ Shows users needing onboarding

### Auth Hook
Check `server/auth.ts` lines 144-151:
```typescript
await db.insert(companies).values({
  tenantId: newTenant.id,
  ownerId: user.id,
  name: companyName,
  setupCompleted: false, // ← Must be false!
  isActive: true,
});
```

### Frontend Logging
Check `client/src/components/AppLayout.tsx` lines 78-125:
- Logs when checking onboarding status
- Logs company data received
- Logs whether modal will show

### Server Logging
Check `server/routes/companyRoutes.ts` lines 11-38:
- Logs every /api/company request
- Warns when company is missing
- Shows setupCompleted status

---

## Console Logs Reference

### Success Pattern (Modal Shows)

**Browser Console:**
```
🏢 [Onboarding] Checking onboarding status for user: user@example.com
🏢 [Onboarding] Company API response: { status: 200, ok: true }
🏢 [Onboarding] Company data: { name: 'Company Name', setupCompleted: false }
🎯 [Onboarding] Showing onboarding modal (setupCompleted: false)
```

**Server Console:**
```
🏢 [GET /api/company] Fetching company for user user@example.com
✅ [GET /api/company] Found company: { name: '...', setupCompleted: false }
```

### Failure Pattern (Modal Doesn't Show)

**Browser Console:**
```
🏢 [Onboarding] Checking onboarding status for user: user@example.com
🏢 [Onboarding] Company API response: { status: 404, ok: false }
⚠️ [Onboarding] Company not found (status: 404)
   This might mean the user has no company record
   Onboarding modal will NOT show
```

**Server Console:**
```
🏢 [GET /api/company] Fetching company for user user@example.com
⚠️ [GET /api/company] No company found for tenant [id]
   User: user@example.com
   This user won't see the onboarding modal!
```

**Fix:** Run `tsx fix-missing-companies.ts`

---

## Files Modified

### Backend
- ✅ `server/auth.ts` - Creates company in signup hook
- ✅ `server/routes/signupRoutes.ts` - Stores company name (NEW)
- ✅ `server/routes.ts` - Registered signup routes
- ✅ `server/routes/companyRoutes.ts` - Enhanced logging

### Frontend
- ✅ `shared/schema.ts` - Added companyName to register schema
- ✅ `shared/schema.js` - Added companyName to register schema
- ✅ `client/src/pages/auth.tsx` - Added company name input
- ✅ `client/src/hooks/useAuth.ts` - Store company name API call
- ✅ `client/src/components/AppLayout.tsx` - Enhanced logging

### Database
- ✅ `migrations/025_add_onboarding_fields_to_companies.sql`

### Scripts
- ✅ `test-onboarding-fix.ts` - Verify setup
- ✅ `test-signup-flow.ts` - Test flow
- ✅ `create-test-account.ts` - Create test account
- ✅ `fix-missing-companies.ts` - Fix existing users

---

## Quick Commands

```bash
# 1. Apply migration (if not done)
npm run db:push

# 2. Test database schema
tsx test-onboarding-fix.ts

# 3. Create test account
tsx create-test-account.ts

# 4. Fix existing users (if needed)
tsx fix-missing-companies.ts

# 5. Check onboarding status
tsx debug-onboarding.ts

# 6. Reset onboarding for testing
tsx reset-onboarding.ts

# 7. Start server
npm run dev
```

---

## Next Steps

1. ✅ Test with pre-created account (`testuser1760869940263@example.com`)
2. ✅ Test with new signup
3. ✅ Verify console logs match expected patterns
4. ✅ Complete onboarding wizard
5. ✅ Verify `setupCompleted` changes to `true`
6. ✅ Confirm modal doesn't show again

---

## Troubleshooting

### Modal Still Doesn't Show

1. **Check browser console** - Look for warnings
2. **Check server console** - Look for company not found
3. **Run diagnostic:**
   ```bash
   tsx test-onboarding-fix.ts
   ```
4. **If user has no company:**
   ```bash
   tsx fix-missing-companies.ts
   ```

### Auth Hook Not Running

1. Check `server/auth.ts` lines 92-168
2. Ensure hook is defined in `betterAuth()` config
3. Watch server console during signup for:
   - `🔧 Creating tenant and company for new user`
   - `✅ Tenant and company created`

### Company Name Not Showing

1. Check `/api/signup/store-company-name` endpoint
2. Verify `global.pendingCompanyNames` is populated
3. Check auth hook retrieves it correctly

---

## Success Criteria

✅ New signups create tenant AND company
✅ Company has `setupCompleted: false`
✅ Onboarding modal appears on first login  
✅ Modal has 2 steps (location/language, business description)
✅ After completion, `setupCompleted` changes to `true`
✅ Modal never shows again for that user

---

**Status: ✅ READY FOR TESTING**

The complete fix is in place and a test account has been created. Follow the testing instructions above to verify everything works!


