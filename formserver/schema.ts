// Simplified schema file for the form frontend server
// Only includes the forms and formResponses tables needed for form serving

import { pgTable, varchar, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Forms table for storing form definitions
export const forms = pgTable("forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  formData: text("form_data").notNull(), // JSON string of form structure
  theme: text("theme").default('modern'),
  isActive: boolean("is_active").default(true),
  responseCount: integer("response_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Form responses table for storing form submissions
export const formResponses = pgTable("form_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  formId: varchar("form_id").notNull(),
  responseData: text("response_data").notNull(), // JSON string of form responses
  submittedAt: timestamp("submitted_at").defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

// Email events table for tracking email lifecycle events from Resend webhooks
export const emailEvents = pgTable("email_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  emailId: varchar("email_id").notNull(), // Resend email ID
  eventType: text("event_type").notNull(), // bounced, clicked, complained, delivered, delivery_delayed, failed, opened, scheduled, sent
  eventData: text("event_data").notNull(), // JSON string of webhook payload
  recipientEmail: text("recipient_email"),
  timestamp: timestamp("timestamp").defaultNow(),
  webhookId: varchar("webhook_id"), // Resend webhook ID for deduplication
  processed: boolean("processed").default(false), // Track if event has been processed
  createdAt: timestamp("created_at").defaultNow(),
});