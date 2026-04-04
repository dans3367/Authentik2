# Critical / High Priority

## Onboarding

- [ ] FIX and update welcome onboarding to be more modern and ask for all proper information to setup the main shop
  - Collect shop name, address, business type, logo, contact info during onboarding
  - Modern multi-step wizard UI
- [ ] Test full onboarding from signup to plan management and upgrade
  - Verify signup -> email verification -> onboarding wizard -> plan selection -> dashboard flow end-to-end
  - Test upgrade/downgrade paths from plan management

## Webhooks & Data

- [ ] Remove old webhooks previously created to internally catch all email statuses
  - Identify and remove legacy webhook endpoints
  - Ensure no active integrations depend on them before removal
- [ ] Create new webhook for local data storage
  - Replace old external webhook pattern with local data ingestion
  - Store email status events in ClickHouse or local DB

## Account Management

- [ ] Implement a solid plan for account deletion flows
  - Define data retention policy (what gets deleted, what gets anonymized)
  - Handle cascading deletes: users, shops, contacts, emails, templates, forms
  - Add confirmation step with grace period
  - Ensure compliance with data protection requirements
  - Clean up R2 storage (avatars, card images) on account deletion
