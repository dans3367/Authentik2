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
  category: text("category").notNull().default('intake'), // 'intake', 'survey', or 'email-signup'
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

// Email contacts table (subset for newsletter signup via Google Sign-In)
export const emailContacts = pgTable("email_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  status: text("status").notNull().default('active'),
  addedDate: timestamp("added_date").defaultNow(),
  lastActivity: timestamp("last_activity"),
  emailsSent: integer("emails_sent").default(0),
  emailsOpened: integer("emails_opened").default(0),
  consentGiven: boolean("consent_given").notNull().default(false),
  consentDate: timestamp("consent_date"),
  consentMethod: text("consent_method"),
  consentIpAddress: text("consent_ip_address"),
  consentUserAgent: text("consent_user_agent"),
  prefTransactional: boolean("pref_transactional").notNull().default(true),
  prefMarketing: boolean("pref_marketing").notNull().default(true),
  prefCustomerEngagement: boolean("pref_customer_engagement").notNull().default(true),
  prefNewsletters: boolean("pref_newsletters").notNull().default(true),
  prefSurveysForms: boolean("pref_surveys_forms").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Promotions table for managing promotional content templates
export const promotions = pgTable("promotions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content").notNull(), // HTML content of the promotion
  type: text("type").notNull().default('newsletter'),
  targetAudience: text("target_audience").notNull().default('all'),
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0),
  maxUses: integer("max_uses"),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  promotionalCodes: text("promotional_codes"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Unsubscribe tokens table (for generating unsubscribe links in promotion emails)
export const unsubscribeTokens = pgTable("unsubscribe_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  contactId: varchar("contact_id").notNull(),
  token: text("token").notNull().unique(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Master email design settings (read-only, for wrapping promotion emails)
export const masterEmailDesign = pgTable("master_email_design", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().unique(),
  companyName: text("company_name").default(''),
  headerMode: text("header_mode").default('logo'),
  logoUrl: text("logo_url"),
  logoSize: text("logo_size").default('medium'),
  logoAlignment: text("logo_alignment").default('center'),
  bannerUrl: text("banner_url"),
  showCompanyName: text("show_company_name").default('true'),
  primaryColor: text("primary_color").default('#3B82F6'),
  secondaryColor: text("secondary_color").default('#1E40AF'),
  accentColor: text("accent_color").default('#10B981'),
  fontFamily: text("font_family").default('Arial, sans-serif'),
  headerText: text("header_text"),
  footerText: text("footer_text"),
  socialLinks: text("social_links"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Companies table (read-only, for fallback company name in email wrapper)
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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