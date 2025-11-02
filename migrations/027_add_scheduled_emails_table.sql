-- Add scheduled_emails table for persisting scheduled emails across server restarts
CREATE TABLE IF NOT EXISTS "scheduled_emails" (
  "id" varchar PRIMARY KEY,
  "tenant_id" varchar NOT NULL,
  "contact_id" varchar,
  "to" text NOT NULL,
  "subject" text NOT NULL,
  "html" text,
  "text" text,
  "scheduled_at" timestamp NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "provider_id" text,
  "attempt_count" integer DEFAULT 0,
  "last_attempt_at" timestamp,
  "next_retry_at" timestamp,
  "error" text,
  "metadata" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE "scheduled_emails" ADD CONSTRAINT "scheduled_emails_tenant_id_tenants_id_fk" 
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "scheduled_emails" ADD CONSTRAINT "scheduled_emails_contact_id_email_contacts_id_fk" 
  FOREIGN KEY ("contact_id") REFERENCES "email_contacts"("id") ON DELETE cascade ON UPDATE no action;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "scheduled_emails_tenant_id_idx" ON "scheduled_emails" ("tenant_id");
CREATE INDEX IF NOT EXISTS "scheduled_emails_contact_id_idx" ON "scheduled_emails" ("contact_id");
CREATE INDEX IF NOT EXISTS "scheduled_emails_status_idx" ON "scheduled_emails" ("status");
CREATE INDEX IF NOT EXISTS "scheduled_emails_scheduled_at_idx" ON "scheduled_emails" ("scheduled_at");
CREATE INDEX IF NOT EXISTS "scheduled_emails_next_retry_at_idx" ON "scheduled_emails" ("next_retry_at");

