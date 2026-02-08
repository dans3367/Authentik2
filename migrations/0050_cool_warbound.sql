CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"role" text NOT NULL,
	"permissions" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_tenant_role_idx" ON "role_permissions" USING btree ("tenant_id","role");--> statement-breakpoint
CREATE INDEX "role_permissions_tenant_id_idx" ON "role_permissions" USING btree ("tenant_id");