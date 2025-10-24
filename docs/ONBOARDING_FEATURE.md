# Onboarding Wizard Feature

## Overview
A new onboarding wizard has been implemented to help new companies complete their setup after signup. The wizard collects essential information to personalize the user experience and improve AI-powered features throughout the platform.

## Features

### Step 1: Geography & Language
- **Geographical Location**: Users select their region from:
  - North America
  - South America
  - Europe
  - Asia
  - Africa
  - Oceania
  - Middle East

- **Preferred Language**: Users select their communication language from:
  - English
  - Spanish
  - French
  - German
  - Italian
  - Portuguese
  - Chinese
  - Japanese
  - Korean
  - Arabic

The selected language is used for all outgoing communications including emails and notifications.

### Step 2: Business Description
- Users provide a detailed description of their business (minimum 10 characters)
- This information helps AI features understand the business context and provide better assistance
- The platform language switches immediately to the selected language from Step 1

## Technical Implementation

### Database Schema Changes
Added the following columns to the `companies` table:
- `setup_completed` (boolean, default: false) - Tracks if onboarding is complete
- `geographical_location` (text) - Stores the selected region
- `language` (text, default: 'en') - Language for outgoing communications
- `business_description` (text) - AI context for platform personalization

### Backend Changes

#### Schema Updates (`shared/schema.ts`)
```typescript
// Companies table with onboarding fields
export const companies = pgTable("companies", {
  // ... existing fields
  setupCompleted: boolean("setup_completed").default(false),
  geographicalLocation: text("geographical_location"),
  language: text("language").default('en'),
  businessDescription: text("business_description"),
  // ...
});

// Onboarding validation schema
export const completeOnboardingSchema = z.object({
  geographicalLocation: z.string().min(1, "Geographical location is required"),
  language: z.string().min(1, "Language is required"),
  businessDescription: z.string().min(10, "Please provide at least 10 characters describing your business"),
});
```

#### API Endpoint (`server/routes/companyRoutes.ts`)
New endpoint: `POST /api/company/complete-onboarding`
- Validates onboarding data using Zod schema
- Checks that company exists and setup is not already completed
- Sanitizes all user input
- Updates company record with onboarding information
- Sets `setupCompleted` to true

### Frontend Changes

#### OnboardingWizard Component (`client/src/components/OnboardingWizard.tsx`)
- Modal dialog that cannot be dismissed (no close button)
- Two-step wizard with progress indicator
- Step 1: Collects geographical location and language
- Step 2: Collects business description
- Real-time language switching (applied immediately after Step 1)
- Form validation with error messages
- API integration with loading states

#### AppLayout Integration (`client/src/components/AppLayout.tsx`)
- Checks company onboarding status on mount
- Automatically displays wizard if `setupCompleted` is false
- Refreshes company data after onboarding completion
- Non-blocking - wizard appears as overlay

## User Flow

1. **New Signup**: User creates account and company
2. **First Login**: User logs in and is immediately presented with onboarding wizard
3. **Step 1 Completion**: User selects location and language, clicks "Next"
4. **Step 2 Completion**: User provides business description in their selected language
5. **Submission**: Data is saved, `setupCompleted` set to true
6. **Platform Access**: Wizard closes, user has full access to platform with personalized settings

## Benefits

### For Users
- Guided setup process for new accounts
- Personalized experience based on location and language
- Better AI assistance tailored to their business context
- Clear communication preferences from the start

### For Platform
- Collects valuable business context for AI features
- Ensures consistent language settings across all communications
- Better understanding of user base demographics
- Improved user engagement with personalized onboarding

## Future Enhancements

Potential improvements for the onboarding feature:
1. Add industry/vertical selection
2. Include company size/team size
3. Add use case selection (e.g., marketing, sales, support)
4. Allow users to skip and complete later (with persistent reminder)
5. Add onboarding completion tracking/analytics
6. Multi-language support for wizard interface itself
7. Add tooltips and help text for each field
8. Include video tutorials or documentation links

## Testing

### Manual Testing Checklist
- [ ] New company signup shows wizard on first login
- [ ] Cannot close wizard without completing
- [ ] Step 1 validation works (location and language required)
- [ ] Step 2 validation works (minimum 10 characters)
- [ ] Language switches immediately after Step 1
- [ ] Back button works between steps
- [ ] API successfully saves all onboarding data
- [ ] Wizard doesn't appear after completion
- [ ] setupCompleted flag is properly set
- [ ] Error messages display correctly
- [ ] Loading states work properly

### Database Verification
```sql
-- Check if columns exist
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'companies' 
  AND column_name IN ('setup_completed', 'geographical_location', 'language', 'business_description');

-- Check onboarding status for a company
SELECT id, name, setup_completed, geographical_location, language, business_description 
FROM companies 
WHERE tenant_id = '<your-tenant-id>';
```

## Rollback Plan

If issues arise, the feature can be rolled back by:
1. Setting `setupCompleted = true` for all companies in database
2. Removing OnboardingWizard import from AppLayout.tsx
3. Reverting database schema changes is not required (columns can remain for future use)

## Migration Notes

For existing companies:
- `setupCompleted` defaults to `false` for new companies
- Existing companies will have `setupCompleted = NULL` initially
- Update script needed if wanting to enable onboarding for existing companies
- Alternatively, set `setupCompleted = true` for all existing companies to skip onboarding
