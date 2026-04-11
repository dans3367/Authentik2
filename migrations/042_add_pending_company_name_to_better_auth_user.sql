-- Persist the company name entered at signup so that tenant/company provisioning
-- (which may run long after signup, post Stripe checkout) can read it reliably.
-- Previously stored only in an in-memory 5-minute Map, which caused the provisioning
-- fallback to generate "${user.name}'s Organization" and pollute tenant/company/shop
-- and downstream email/blog design company name fields.
ALTER TABLE "better_auth_user" ADD COLUMN IF NOT EXISTS "pending_company_name" text;
