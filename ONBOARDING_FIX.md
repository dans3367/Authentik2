# Onboarding Modal Fix

## Problem
The onboarding modal was not showing for new signed up users.

## Root Cause
When users signed up via Better Auth:
1. The signup hook in `server/auth.ts` created a **tenant** record
2. But it did NOT create a corresponding **companies** record
3. The onboarding modal checks `/api/company` which queries the **companies** table
4. If no company exists, the API returns 404, and the modal never appears

## Solution

### 1. Updated `server/auth.ts`
- Added `companies` to the imports
- Modified the signup hook to create a company record after creating the tenant
- Set `setupCompleted: false` to trigger the onboarding modal

### 2. Updated Schema Files
- Updated both `shared/schema.js` and `shared/schema.ts` to ensure the companies table includes the onboarding fields:
  - `setupCompleted` (boolean, default: false)
  - `geographicalLocation` (text)
  - `language` (text, default: 'en')
  - `businessDescription` (text)

### 3. Created Database Migration
- `migrations/025_add_onboarding_fields_to_companies.sql`
- Adds the onboarding fields to the companies table

### 4. Created Fix Script for Existing Users
- `fix-missing-companies.ts`
- Creates company records for existing users who have tenants but no companies

## How to Apply the Fix

### Step 1: Apply Database Migration
Run the migration to add the onboarding fields to the companies table:

```bash
npm run db:push
```

Or manually run the migration:

```bash
tsx migrations/025_add_onboarding_fields_to_companies.sql
```

### Step 2: Fix Existing Users (Optional)
If you have existing users who signed up before this fix, run the fix script:

```bash
tsx fix-missing-companies.ts
```

This will:
- Find all users with tenants but no companies
- Create company records for them with `setupCompleted: false`
- They will see the onboarding modal on next login

### Step 3: Restart the Server
```bash
npm run dev
```

## Testing

### Test New User Signup
1. Create a new user account
2. Verify in the database that:
   - A tenant is created
   - A company is created with `setup_completed = false`
3. Log in with the new user
4. The onboarding modal should appear automatically
5. Complete the onboarding wizard
6. Verify in the database that `setup_completed = true`

### Test Existing Users
1. Run the debug script to check current state:
   ```bash
   tsx debug-onboarding.ts
   ```

2. If needed, reset onboarding for testing:
   ```bash
   tsx reset-onboarding.ts
   ```

3. Refresh the browser
4. The onboarding modal should appear

## Files Modified

### Backend
- `server/auth.ts` - Added company creation to signup hook
- `shared/schema.js` - Added onboarding fields to companies table
- `shared/schema.ts` - Already had onboarding fields (kept in sync)

### Database
- `migrations/025_add_onboarding_fields_to_companies.sql` - New migration

### Utility Scripts
- `fix-missing-companies.ts` - New script to fix existing users
- `debug-onboarding.ts` - Existing debug script (unchanged)
- `reset-onboarding.ts` - Existing reset script (unchanged)

## How It Works

1. **User Signs Up**
   - Better Auth creates user record
   - Signup hook creates tenant record
   - **NEW**: Signup hook also creates company record with `setupCompleted: false`

2. **User Logs In**
   - `AppLayout.tsx` component checks `/api/company`
   - If `setupCompleted === false`, shows `OnboardingWizard`
   - Modal cannot be dismissed (no close button)

3. **User Completes Onboarding**
   - Step 1: Select geographical location and language
   - Step 2: Enter business description
   - Data is saved via `POST /api/company/complete-onboarding`
   - `setupCompleted` is set to `true`
   - Modal closes and doesn't show again

## Verification

After applying the fix, verify:

```bash
# Check database structure
psql -d your_database -c "\d companies"

# Should show columns:
# - setup_completed (boolean, default false)
# - geographical_location (text)
# - language (text, default 'en')
# - business_description (text)

# Check existing data
psql -d your_database -c "SELECT id, name, setup_completed FROM companies;"
```

## Future Signup Flow

For all new users:
1. User signs up → Better Auth creates user
2. Signup hook creates tenant → Signup hook creates company (setupCompleted: false)
3. User logs in → AppLayout checks company → Shows onboarding modal
4. User completes wizard → setupCompleted set to true → Modal never shows again

## Rollback

If you need to rollback:

```sql
ALTER TABLE companies DROP COLUMN IF EXISTS setup_completed;
ALTER TABLE companies DROP COLUMN IF EXISTS geographical_location;
ALTER TABLE companies DROP COLUMN IF EXISTS language;
ALTER TABLE companies DROP COLUMN IF EXISTS business_description;
```

Then revert the changes to `server/auth.ts` by removing the company creation code.

