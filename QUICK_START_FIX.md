# Quick Start: Apply Onboarding Fix

## The Problem
New users signing up don't see the onboarding modal.

## The Solution
Run these commands in order:

### 1. Apply Database Migration
```bash
npm run db:push
```

This adds the required onboarding fields to the companies table.

### 2. Fix Existing Users (if you have any)
```bash
tsx fix-missing-companies.ts
```

This creates company records for users who signed up before the fix.

### 3. Test the Fix
```bash
tsx test-onboarding-fix.ts
```

This verifies everything is working correctly.

### 4. Restart Your Server
```bash
npm run dev
```

## What Changed?
- **server/auth.ts**: Now creates a company record (with `setupCompleted: false`) when users sign up
- **shared/schema.js**: Updated companies table definition to include onboarding fields
- **migrations/025_add_onboarding_fields_to_companies.sql**: Database migration

## Test New User Signup
1. Create a new account
2. Log in
3. ✅ The onboarding modal should appear automatically
4. Complete the wizard
5. ✅ Modal closes and won't appear again

## Need Help?
- Run `tsx debug-onboarding.ts` to check current onboarding status
- Run `tsx reset-onboarding.ts` to reset onboarding for testing
- See `ONBOARDING_FIX.md` for detailed documentation

## Verification
After applying the fix, new signups will:
1. ✅ Get a tenant created
2. ✅ Get a company created (with setupCompleted: false)
3. ✅ See the onboarding modal on first login
4. ✅ Have setupCompleted set to true after completing the wizard

