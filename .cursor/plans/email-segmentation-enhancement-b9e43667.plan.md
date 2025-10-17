<!-- b9e43667-52f9-4cfe-8cff-1cf725e684a9 1c2c830e-ba7b-405b-8e3c-bad471f58489 -->
# Email Segmentation Enhancement Plan

## Overview

Transform the current email type system from scattered hardcoded values to a robust two-tier categorization system with centralized management and category-level unsubscribe preferences.

## Problem Statement

- Email types are hardcoded in 10+ locations (TypeScript, Go, migrations)
- No distinction between transactional and marketing emails (compliance risk)
- Cannot offer category-level unsubscribe preferences
- Types don't match business requirements (need: transactional, marketing, ecard, reminder, notice, bill)

## Architecture Changes

### 1. Two-Tier Type System

**Category** (4 high-level buckets for preferences/compliance):

- `transactional` - Cannot unsubscribe (bills, receipts, password resets)
- `marketing` - Can unsubscribe (promotional, newsletters)
- `notification` - Can unsubscribe (reminders, notices, alerts)
- `ecard` - Can unsubscribe (birthday, anniversary, holiday cards)

**Type** (specific email purpose, maps to category):

- `bill`, `receipt`, `password_reset`, `account_notification` → transactional
- `promotional`, `newsletter`, `announcement` → marketing
- `reminder`, `notice`, `alert`, `appointment_reminder` → notification
- `birthday`, `anniversary`, `holiday`, `test_card` → ecard

### 2. Database Schema Changes

#### New Table: `email_type_config`

```sql
CREATE TABLE email_type_config (
  type VARCHAR PRIMARY KEY,
  category VARCHAR NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  can_unsubscribe BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true
);
```

#### New Table: `email_preferences`

```sql
CREATE TABLE email_preferences (
  id VARCHAR PRIMARY KEY,
  contact_id VARCHAR REFERENCES email_contacts(id),
  category VARCHAR NOT NULL,
  is_subscribed BOOLEAN NOT NULL DEFAULT true,
  unsubscribed_at TIMESTAMP,
  unsubscribe_reason TEXT,
  unsubscribe_ip TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### Update Existing Tables

- Add `email_category` column to `email_sends` table
- Remove hardcoded CHECK constraints on `email_type`
- Add foreign key constraint to `email_type_config`

### 3. Code Changes

#### TypeScript (`shared/schema.ts`)

- Add `emailTypeConfig` and `emailPreferences` table schemas
- Create enums: `EmailCategory`, `EmailType`
- Add validation schemas using Zod
- Export centralized type mappings

#### Go Backend (`cardprocessor-go/`)

- Create `internal/types/email_types.go` with constants
- Update `models.go` to add Category field
- Add validation functions in repository layer
- Update all email sending activities to include category

#### Server (`server/`)

- Update `EmailService` to validate category/type
- Add preference checking before sending marketing/notification emails
- Create API endpoints for managing email preferences
- Add unsubscribe link generation with category support

#### Temporal Workflows

- Update email activities to pass both type and category
- Add preference validation before sending non-transactional emails
- Update email recording to include category

### 4. Migration Strategy

**Phase 1: Add New Infrastructure** (Non-breaking)

- Create `email_type_config` table with seed data
- Create `email_preferences` table
- Add `email_category` column (nullable initially)

**Phase 2: Migrate Existing Data**

- Map old types to new type/category pairs
- Populate category field based on type mapping
- Migrate existing unsubscribe data to preferences table

**Phase 3: Update Code** (Feature flag protected)

- Deploy code changes with feature flag OFF
- Test in production with flag OFF
- Enable feature flag gradually

**Phase 4: Cleanup**

- Make `email_category` NOT NULL
- Remove old CHECK constraints
- Remove feature flags
- Update documentation

## Implementation Steps

### Step 1: Database Schema

**Files**: `migrations/023_email_type_config.sql`, `migrations/024_email_preferences.sql`

- Create email_type_config table with seed data for all types
- Create email_preferences table with proper indexes
- Add email_category column to email_sends

### Step 2: TypeScript Schema Updates

**Files**: `shared/schema.ts`

- Add emailTypeConfig and emailPreferences table definitions
- Create EmailCategory and EmailType enums
- Add Zod validation schemas
- Export type mapping constants

### Step 3: Go Backend Updates

**Files**: `cardprocessor-go/internal/types/email_types.go`, `internal/models/models.go`, `internal/repository/repository.go`

- Define email type/category constants
- Add Category field to email models
- Add GetEmailTypeConfig() repository method
- Add ValidateEmailType() function
- Update CreateOutgoingEmailRecord to include category

### Step 4: Email Service Updates

**Files**: `server/emailService.ts`, `server/providers/enhancedEmailService.ts`

- Add category parameter to all sendEmail methods
- Implement preference checking before sending
- Add automatic category detection from type
- Update all email sending calls to include type/category

### Step 5: Temporal Activities Updates

**Files**: `temporal-server/src/activities/email-activities.ts`, `cardprocessor-go/internal/temporal/activities.go`

- Add category to EmailContext and SendEmailRequest
- Add preference validation before sending
- Update recordOutgoingEmail to include category
- Update all activity calls to pass category

### Step 6: Data Migration

**Files**: `migrations/025_migrate_email_types.sql`

- Map existing email_type values to new categories
- Populate email_category field
- Migrate birthday_unsubscribed contacts to email_preferences

### Step 7: API Endpoints

**Files**: `server/routes/emailPreferencesRoutes.ts` (new)

- GET /api/email-preferences/:contactId - Get preferences
- PUT /api/email-preferences/:contactId - Update preferences
- POST /api/unsubscribe/:token - Handle unsubscribe links
- GET /api/email-types - List available types/categories

### Step 8: Frontend Updates (Optional)

**Files**: `client/src/pages/email-preferences/` (new)

- Preference management UI for contacts
- Unsubscribe page with category selection
- Email type documentation page

### Step 9: Validation & Constraints

**Files**: `migrations/026_add_email_type_constraints.sql`

- Add foreign key constraint on email_sends.email_type → email_type_config.type
- Make email_category NOT NULL
- Add unique constraint on email_preferences (contact_id, category)
- Remove old CHECK constraints

### Step 10: Documentation & Testing

**Files**: `docs/EMAIL_SEGMENTATION.md`

- Document new type system and mappings
- Create unsubscribe flow documentation
- Add API documentation
- Update email sending examples

## Type Mapping Reference

### Current → New Mapping

```
birthday_card → type: birthday, category: ecard
test_card → type: test_card, category: ecard
promotional → type: promotional, category: marketing
newsletter → type: newsletter, category: marketing
invitation → type: invitation, category: notification
appointment_reminder → type: appointment_reminder, category: notification
```

### New Types to Add

```
Transactional:
  - bill, receipt, password_reset, account_notification
  
Marketing:
  - announcement
  
Notification:
  - reminder, notice, alert
  
Ecard:
  - anniversary, holiday
```

## Compliance Benefits

- Clear separation of transactional vs marketing emails
- Category-level unsubscribe compliance (CAN-SPAM, GDPR)
- Audit trail of preference changes
- Prevents accidental marketing emails to unsubscribed users

## Key Files to Modify

- `shared/schema.ts` - Add new tables and enums
- `migrations/023-026_*.sql` - Database changes
- `cardprocessor-go/internal/types/email_types.go` - New file for constants
- `cardprocessor-go/internal/models/models.go` - Add Category field
- `cardprocessor-go/internal/repository/repository.go` - Add category methods
- `cardprocessor-go/internal/temporal/activities.go` - Update email sending
- `server/emailService.ts` - Add preference validation
- `server/routes/emailPreferencesRoutes.ts` - New API endpoints
- `temporal-server/src/activities/email-activities.ts` - Add category support

## Success Metrics

- All outgoing emails have valid type + category
- Users can unsubscribe from categories independently
- Zero transactional emails blocked by unsubscribe preferences
- Type definitions centralized in ≤3 locations (config table, TS enums, Go constants)

### To-dos

- [ ] Create database migrations for email_type_config and email_preferences tables
- [ ] Add TypeScript schemas, enums, and type definitions to shared/schema.ts
- [ ] Create Go email types package with constants and validation
- [ ] Update Go models and repository to support category field
- [ ] Update email services to validate preferences and include category
- [ ] Update Temporal activities to pass and validate email categories
- [ ] Create and run migration to populate categories for existing emails
- [ ] Create API endpoints for email preference management
- [ ] Add database constraints and make category field required
- [ ] Create comprehensive documentation for email segmentation system