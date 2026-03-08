-- Custom field definitions for email contacts (tenant-level)
CREATE TABLE IF NOT EXISTS "contact_custom_fields" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "label" text NOT NULL,
  "field_type" text NOT NULL DEFAULT 'text',
  "options" text,
  "placeholder" text,
  "is_required" boolean DEFAULT false,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Custom field values per contact
CREATE TABLE IF NOT EXISTS "contact_custom_field_values" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" varchar NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "contact_id" varchar NOT NULL REFERENCES "email_contacts"("id") ON DELETE CASCADE,
  "field_id" varchar NOT NULL REFERENCES "contact_custom_fields"("id") ON DELETE CASCADE,
  "value" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_custom_fields_tenant" ON "contact_custom_fields"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_custom_field_values_contact" ON "contact_custom_field_values"("contact_id");
CREATE INDEX IF NOT EXISTS "idx_custom_field_values_field" ON "contact_custom_field_values"("field_id");
CREATE INDEX IF NOT EXISTS "idx_custom_field_values_tenant" ON "contact_custom_field_values"("tenant_id");

-- Unique constraint: one value per field per contact
CREATE UNIQUE INDEX IF NOT EXISTS "idx_custom_field_values_unique" ON "contact_custom_field_values"("contact_id", "field_id");
