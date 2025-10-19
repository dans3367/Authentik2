# Company Name in Signup Process - Implementation Summary

## Overview
Updated the signup process to include a company name field. Users now provide their company name during registration, which is used to create their tenant and company records.

## Changes Made

### 1. Frontend Changes

#### Updated Schemas (`shared/schema.ts` and `shared/schema.js`)
- Added `companyName` field to `registerSchema`
- Validation: Minimum 2 characters required
- Type: `z.string().min(2, "Company name must be at least 2 characters")`

#### Updated Signup Form (`client/src/pages/auth.tsx`)
- Added company name input field
- Positioned after first/last name fields, before email
- Includes validation error display
- Placeholder: "Acme Inc."

#### Updated Registration Hook (`client/src/hooks/useAuth.ts`)
- Calls `/api/signup/store-company-name` before Better Auth signup
- Stores company name on server for auth hook to access
- Improved error handling

### 2. Backend Changes

#### New API Route (`server/routes/signupRoutes.ts`)
- **POST `/api/signup/store-company-name`**: Stores company name temporarily
  - Uses in-memory global storage keyed by email
  - Auto-cleanup after 5 minutes to prevent memory leaks
- **GET `/api/signup/get-company-name/:email`**: Debug endpoint to check stored company names

#### Updated Routes Registration (`server/routes.ts`)
- Added `signupRoutes` import
- Registered at `/api/signup` path

#### Updated Auth Hook (`server/auth.ts`)
- Reads company name from `global.pendingCompanyNames`
- Uses provided company name when creating tenant and company
- Falls back to auto-generated name if not found
- Cleans up global storage after use
- Enhanced logging to show company name source

### 3. Migration (Already Created)
- `migrations/025_add_onboarding_fields_to_companies.sql`
- Adds onboarding fields including `setup_completed`

## How It Works

### Signup Flow

1. **User Fills Signup Form**
   - First Name, Last Name, Company Name, Email, Password

2. **Frontend Stores Company Name**
   ```javascript
   POST /api/signup/store-company-name
   {
     "email": "user@example.com",
     "companyName": "Acme Inc."
   }
   ```
   - Stored in `global.pendingCompanyNames[email]`

3. **Better Auth Creates User**
   - Standard Better Auth signup process
   - Creates user record in database

4. **Auth Hook Executes**
   - Retrieves company name from `global.pendingCompanyNames`
   - Creates tenant with company name
   - Creates company record with `setupCompleted: false`
   - Cleans up global storage
   - Logs success

5. **User Receives Verification Email**
   - Standard Better Auth email verification

6. **User Logs In**
   - Onboarding modal appears (because `setupCompleted: false`)
   - User completes onboarding wizard
   - `setupCompleted` set to `true`

## Data Flow

```
User Input (Form)
    ↓
Frontend calls /api/signup/store-company-name
    ↓
global.pendingCompanyNames[email] = "Acme Inc."
    ↓
Frontend calls Better Auth signup
    ↓
Better Auth creates user
    ↓
Auth hook runs
    ↓
Reads global.pendingCompanyNames[email]
    ↓
Creates tenant: "Acme Inc."
Creates company: "Acme Inc." (setupCompleted: false)
    ↓
Cleans up global.pendingCompanyNames[email]
    ↓
User logs in → Onboarding modal appears
```

## Testing

### Test New Signup
1. Navigate to signup page
2. Fill in:
   - First Name: John
   - Last Name: Doe
   - Company Name: Test Company Inc.
   - Email: john@test.com
   - Password: Test123!
   - Confirm Password: Test123!
3. Click "Create Account"
4. Check email for verification
5. Verify in database:
   ```sql
   SELECT * FROM tenants WHERE name = 'Test Company Inc.';
   SELECT * FROM companies WHERE name = 'Test Company Inc.';
   ```

### Expected Results
- ✅ Tenant created with name "Test Company Inc."
- ✅ Company created with name "Test Company Inc."
- ✅ `setupCompleted` = false
- ✅ User assigned to new tenant
- ✅ User role = "Owner"

### Test Onboarding Modal
1. Log in with new user
2. ✅ Onboarding modal should appear
3. Complete wizard
4. ✅ Modal closes
5. Verify in database: `setupCompleted` = true

## Files Modified

### Frontend
- ✅ `shared/schema.ts` - Added companyName to registerSchema
- ✅ `shared/schema.js` - Added companyName to registerSchema
- ✅ `client/src/pages/auth.tsx` - Added company name input field
- ✅ `client/src/hooks/useAuth.ts` - Added API call to store company name

### Backend
- ✅ `server/routes/signupRoutes.ts` - New route for storing company names (NEW FILE)
- ✅ `server/routes.ts` - Registered signup routes
- ✅ `server/auth.ts` - Updated hook to use stored company name

### Database
- ✅ `migrations/025_add_onboarding_fields_to_companies.sql` - Already created

## Advantages of This Approach

1. **No Database Changes Needed** - Uses in-memory storage
2. **Simple & Fast** - Minimal overhead, auto-cleanup
3. **Concurrent-Safe** - Each email gets its own storage slot
4. **Fallback Friendly** - Auto-generates name if storage fails
5. **Clean Code** - Separation of concerns

## Edge Cases Handled

1. **Company Name Not Stored**
   - Fallback to `${userName}'s Organization`
   - Logs source of company name

2. **Memory Leaks**
   - Auto-cleanup after 5 minutes
   - Cleanup on successful use

3. **Concurrent Signups**
   - Each email gets unique storage key
   - No conflicts

4. **Signup Failures**
   - Company name eventually cleaned up
   - No persistent storage pollution

## Debug Commands

```bash
# Check pending company names (in Node console)
console.log(global.pendingCompanyNames);

# Test the storage endpoint
curl -X POST http://localhost:5000/api/signup/store-company-name \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","companyName":"Test Co"}'

# Check stored name
curl http://localhost:5000/api/signup/get-company-name/test@example.com

# Verify database after signup
psql -d your_database -c "SELECT * FROM companies WHERE name LIKE '%Test%';"
```

## Verification Checklist

After restarting the server:

- [ ] Signup form shows company name field
- [ ] Company name validation works (min 2 chars)
- [ ] Signup stores company name before Better Auth signup
- [ ] Auth hook logs company name source
- [ ] Tenant created with correct name
- [ ] Company created with correct name
- [ ] `setupCompleted` = false
- [ ] Onboarding modal appears on first login
- [ ] Global storage cleaned up after use

## Next Steps

After testing:
1. Apply database migration: `npm run db:push`
2. Restart server: `npm run dev`
3. Test signup flow with a new user
4. Verify onboarding modal appears
5. Optional: Run `tsx fix-missing-companies.ts` for existing users

## Rollback

If needed, revert these changes:

```bash
git checkout HEAD -- \
  shared/schema.ts \
  shared/schema.js \
  client/src/pages/auth.tsx \
  client/src/hooks/useAuth.ts \
  server/auth.ts \
  server/routes.ts

# Remove new file
rm server/routes/signupRoutes.ts
```

Then restart the server.

