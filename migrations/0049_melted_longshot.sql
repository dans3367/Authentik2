ALTER TABLE "activity_logs" DROP CONSTRAINT "activity_logs_user_id_better_auth_user_id_fk";
--> statement-breakpoint
ALTER TABLE "activity_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_better_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_tenant_id_idx" ON "activity_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_entity_type_idx" ON "activity_logs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "activity_logs_tenant_created_at_idx" ON "activity_logs" USING btree ("tenant_id","created_at");