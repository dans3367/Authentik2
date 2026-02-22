import { pgTable, varchar, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Simplified schema for webhook-bounces server only
export const bouncedEmails = pgTable("bounced_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  bounceType: varchar("bounce_type").notNull(), // 'hard', 'soft', 'suppressed', 'complaint'
  bounceReason: text("bounce_reason"),
  firstBouncedAt: timestamp("first_bounced_at").defaultNow(),
  lastBouncedAt: timestamp("last_bounced_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  bounceCount: integer("bounce_count").default(1),
  sourceTenantId: varchar("source_tenant_id"), // Optional: which tenant this came from
  suppressionReason: text("suppression_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emailContacts = pgTable("email_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  status: varchar("status").notNull().default('active'), // 'active', 'bounced', 'suppressed', 'unsubscribed'
  lastActivity: timestamp("last_activity"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// No indexes defined to avoid the JSON parsing issue
export const schema = {
  bouncedEmails,
  emailContacts,
};
