import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, decimal, integer, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Better Auth Tables
export const betterAuthUser = pgTable("better_auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  role: text("role").default('Owner').notNull(), // New users default to Owner role
  tenantId: varchar("tenant_id").default(sql`'2f6f5ec2-a56f-47d0-887d-c6b9c1bb56ff'`).notNull(), // Temporary default, will be updated by signup hook
  // Additional fields from users table
  firstName: text("first_name"),
  lastName: text("last_name"),
  isActive: boolean("is_active").default(true),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: text("two_factor_secret"),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  lastVerificationEmailSent: timestamp("last_verification_email_sent"),
  lastLoginAt: timestamp("last_login_at"), // Track last login for user management
  menuExpanded: boolean("menu_expanded").default(false), // New field for menu preference
  theme: text("theme").default('light'), // Theme preference: 'light' or 'dark'
  language: text("language").default('en'), // Language preference: 'en' or 'es'
  timezone: text("timezone").default('America/Chicago'), // User timezone in IANA format
  avatarUrl: text("avatar_url"), // User avatar URL from Cloudflare R2
  tokenValidAfter: timestamp("token_valid_after").defaultNow(), // Tokens issued before this time are invalid
  // Stripe fields for subscription management
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").default('inactive'), // active, inactive, canceled, past_due
  subscriptionPlanId: varchar("subscription_plan_id"),
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  trialEndsAt: timestamp("trial_ends_at"),
});

export const betterAuthSession = pgTable("better_auth_session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }),
});

export const betterAuthAccount = pgTable("better_auth_account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const betterAuthVerification = pgTable("better_auth_verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

// User roles enum
export const userRoles = ['Owner', 'Administrator', 'Manager', 'Employee'] as const;
export type UserRole = typeof userRoles[number];

// Tenants table for multi-tenancy
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // URL-friendly identifier
  domain: text("domain"), // Custom domain (optional)
  isActive: boolean("is_active").default(true),
  settings: text("settings").default('{}'), // JSON settings
  maxUsers: integer("max_users").default(10), // User limit per tenant
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Users table removed - now using better_auth_user table only
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  // Device tracking fields
  deviceId: text("device_id").default(sql`gen_random_uuid()`).notNull(), // Unique identifier for the device/session
  deviceName: text("device_name"), // User-friendly device name
  userAgent: text("user_agent"), // Browser/app user agent
  ipAddress: text("ip_address"), // IP address at login
  location: text("location"), // Approximate location (optional)
  lastUsed: timestamp("last_used").defaultNow(),
  isActive: boolean("is_active").default(true),
});

// Stores table for multi-tenant shop management
export const stores = pgTable("stores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  address: text("address").notNull(),
  telephone: text("telephone").notNull(),
  email: text("email").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Shops table for enhanced multi-tenant shop management
export const shops = pgTable("shops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country").notNull().default('United States'),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  website: text("website"),
  managerId: varchar("manager_id").references(() => betterAuthUser.id, { onDelete: 'set null' }),
  operatingHours: text("operating_hours"), // JSON string
  status: text("status").default('active'), // active, inactive, maintenance
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  category: text("category"), // retail, restaurant, service, etc.
  tags: text("tags").array(), // Array of tags
  socialMedia: text("social_media"), // JSON string of social media links
  settings: text("settings"), // JSON string of custom settings
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subscription plans table
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Basic, Pro, Enterprise
  displayName: text("display_name").notNull(), // User-friendly name
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Monthly price
  yearlyPrice: decimal("yearly_price", { precision: 10, scale: 2 }), // Yearly price (optional discount)
  stripePriceId: text("stripe_price_id").notNull(), // Stripe Price ID for monthly
  stripeYearlyPriceId: text("stripe_yearly_price_id"), // Stripe Price ID for yearly
  features: text("features").array().notNull(), // Array of feature descriptions
  maxUsers: integer("max_users"), // null = unlimited
  maxProjects: integer("max_projects"), // null = unlimited
  maxShops: integer("max_shops"), // null = unlimited
  storageLimit: integer("storage_limit"), // in GB, null = unlimited
  supportLevel: text("support_level").default('email'), // email, priority, dedicated
  trialDays: integer("trial_days").default(14),
  isPopular: boolean("is_popular").default(false),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User subscriptions history table
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }),
  planId: varchar("plan_id").notNull().references(() => subscriptionPlans.id),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  status: text("status").notNull(), // active, canceled, incomplete, past_due, trialing, etc.
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  canceledAt: timestamp("canceled_at"),
  isYearly: boolean("is_yearly").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tenant-specific limit overrides
export const tenantLimits = pgTable("tenant_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }).unique(),
  maxShops: integer("max_shops"), // NULL means use subscription plan limit
  maxUsers: integer("max_users"), // NULL means use subscription plan limit
  maxStorageGb: integer("max_storage_gb"), // NULL means use subscription plan limit
  customLimits: text("custom_limits").default('{}'), // JSON for future extensibility
  overrideReason: text("override_reason"), // Why this tenant has custom limits
  createdBy: varchar("created_by").references(() => betterAuthUser.id, { onDelete: 'set null' }),
  expiresAt: timestamp("expires_at"), // NULL means no expiration
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email tracking split tables - replacing the monolithic outgoing_emails table
export const emailSends = pgTable("email_sends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Email details
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name"),
  senderEmail: text("sender_email").notNull(),
  senderName: text("sender_name"),
  subject: text("subject").notNull(),
  emailType: text("email_type").notNull(), // 'birthday_card', 'test_card', 'promotional', 'newsletter', 'invitation', 'appointment_reminder'

  // Provider details
  provider: text("provider").notNull(), // 'resend', 'sendgrid', 'mailgun'
  providerMessageId: text("provider_message_id"), // Provider's unique message ID (e.g., Resend email ID)

  // Status tracking
  status: text("status").notNull().default('pending'), // 'pending', 'sent', 'delivered', 'bounced', 'failed'
  sendAttempts: integer("send_attempts").default(1),
  errorMessage: text("error_message"),

  // Related records
  contactId: varchar("contact_id").references(() => emailContacts.id, { onDelete: 'set null' }),
  newsletterId: varchar("newsletter_id").references(() => newsletters.id, { onDelete: 'set null' }),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: 'set null' }),
  promotionId: varchar("promotion_id").references(() => promotions.id, { onDelete: 'set null' }),

  // Timestamps
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emailContent = pgTable("email_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailSendId: varchar("email_send_id").notNull().references(() => emailSends.id, { onDelete: 'cascade' }),

  // Email content
  htmlContent: text("html_content"),
  textContent: text("text_content"),

  // Provider response data
  providerResponse: text("provider_response"), // JSON response from provider

  // Metadata
  metadata: text("metadata"), // JSON for additional custom data

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emailEvents = pgTable("email_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailSendId: varchar("email_send_id").notNull().references(() => emailSends.id, { onDelete: 'cascade' }),

  // Event details
  eventType: text("event_type").notNull(), // 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed'
  eventData: text("event_data"), // JSON webhook payload or event data

  // Event metadata
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  webhookId: text("webhook_id"), // Provider webhook event ID

  // Timestamps
  occurredAt: timestamp("occurred_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for tenant limits (used by relational queries with `with:`)
export const tenantLimitsRelations = relations(tenantLimits, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantLimits.tenantId],
    references: [tenants.id],
  }),
  createdByUser: one(betterAuthUser, {
    fields: [tenantLimits.createdBy],
    references: [betterAuthUser.id],
  }),
}));

// Shop limit events for audit and analytics
export const shopLimitEvents = pgTable("shop_limit_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  eventType: text("event_type").notNull(), // 'limit_reached', 'limit_exceeded', 'limit_increased', etc.
  shopCount: integer("shop_count").notNull(),
  limitValue: integer("limit_value"), // The limit at the time of the event
  subscriptionPlanId: varchar("subscription_plan_id").references(() => subscriptionPlans.id, { onDelete: 'set null' }),
  customLimitId: varchar("custom_limit_id").references(() => tenantLimits.id, { onDelete: 'set null' }),
  metadata: text("metadata").default('{}'), // JSON for additional event data
  createdAt: timestamp("created_at").defaultNow(),
});

// Email verification tokens table (missing from current schema)
export const verificationTokens = pgTable("verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Temporary 2FA sessions table for managing 2FA verification flow
export const temp2faSessions = pgTable("temp_2fa_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionToken: text("session_token").notNull().unique(), // Better Auth session token
  userId: text("user_id").notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Email contacts tables for contact management
export const emailContacts = pgTable("email_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  status: text("status").notNull().default('active'), // active, unsubscribed, bounced, pending
  addedDate: timestamp("added_date").defaultNow(),
  lastActivity: timestamp("last_activity"),
  emailsSent: integer("emails_sent").default(0),
  emailsOpened: integer("emails_opened").default(0),
  // Birthday tracking fields
  birthday: text("birthday"), // Date in YYYY-MM-DD format
  birthdayEmailEnabled: boolean("birthday_email_enabled").default(false), // Whether user wants birthday emails
  birthdayUnsubscribeReason: text("birthday_unsubscribe_reason"), // Reason for unsubscribing from birthday emails
  birthdayUnsubscribedAt: timestamp("birthday_unsubscribed_at"), // Timestamp when unsubscribed from birthday emails
  // Consent tracking fields
  consentGiven: boolean("consent_given").notNull().default(false),
  consentDate: timestamp("consent_date"),
  consentMethod: text("consent_method"), // 'manual_add', 'form_submission', 'import', 'api'
  consentIpAddress: text("consent_ip_address"),
  consentUserAgent: text("consent_user_agent"),
  addedByUserId: varchar("added_by_user_id").references(() => betterAuthUser.id),
  // Address fields
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country"),
  // Contact fields
  phoneNumber: text("phone_number"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const emailLists = pgTable("email_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contactTags = pgTable("contact_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  color: text("color").default('#3B82F6'),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Junction tables for many-to-many relationships
export const contactListMemberships = pgTable("contact_list_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").notNull().references(() => emailContacts.id, { onDelete: 'cascade' }),
  listId: varchar("list_id").notNull().references(() => emailLists.id, { onDelete: 'cascade' }),
  addedAt: timestamp("added_at").defaultNow(),
});

export const contactTagAssignments = pgTable("contact_tag_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").notNull().references(() => emailContacts.id, { onDelete: 'cascade' }),
  tagId: varchar("tag_id").notNull().references(() => contactTags.id, { onDelete: 'cascade' }),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

// Segment lists for customer segmentation
export const segmentLists = pgTable("segment_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'all', 'selected', 'tags'
  selectedContactIds: text("selected_contact_ids").array().default(sql`'{}'::text[]`), // Array of contact IDs for 'selected' type
  selectedTagIds: text("selected_tag_ids").array().default(sql`'{}'::text[]`), // Array of tag IDs for 'tags' type
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Companies table for multi-tenant company information
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  ownerId: varchar("owner_id").notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }), // Links to account owner
  name: text("name").notNull(),
  address: text("address"),
  companyType: text("company_type"), // e.g., Corporation, LLC, Partnership, etc.
  companyEmail: text("company_email"),
  phone: text("phone"),
  website: text("website"),
  description: text("description"),
  // Onboarding wizard fields
  setupCompleted: boolean("setup_completed").default(false),
  geographicalLocation: text("geographical_location"),
  language: text("language").default('en'), // Language for outgoing communications
  businessDescription: text("business_description"), // AI context for platform personalization
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


// Forms table for DragFormMaster integration with multi-tenancy
export const forms = pgTable("forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  formData: text("form_data").notNull(), // JSON string of form structure
  theme: text("theme").default('modern'),
  isActive: boolean("is_active").default(true),
  isEmbeddable: boolean("is_embeddable").default(true), // Allow form to be embedded on external sites
  responseCount: integer("response_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Form responses table for storing form submissions
export const formResponses = pgTable("form_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  formId: varchar("form_id").notNull().references(() => forms.id, { onDelete: 'cascade' }),
  responseData: text("response_data").notNull(), // JSON string of form responses
  submittedAt: timestamp("submitted_at").defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

// Newsletters table for newsletter management
export const newsletters = pgTable("newsletters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(), // HTML content of the newsletter
  status: text("status").notNull().default('draft'), // draft, scheduled, sent
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  // Customer segmentation fields
  recipientType: text("recipient_type").notNull().default('all'), // all, selected, tags
  selectedContactIds: text("selected_contact_ids").array(), // Array of contact IDs
  selectedTagIds: text("selected_tag_ids").array(), // Array of tag IDs
  recipientCount: integer("recipient_count").default(0),
  openCount: integer("open_count").default(0),
  uniqueOpenCount: integer("unique_open_count").default(0),
  clickCount: integer("click_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Newsletter task status for tracking processing stages
export const newsletterTaskStatus = pgTable("newsletter_task_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  newsletterId: varchar("newsletter_id").notNull().references(() => newsletters.id, { onDelete: 'cascade' }),
  taskType: text("task_type").notNull(), // 'validation', 'processing', 'sending', 'analytics'
  taskName: text("task_name").notNull(),
  status: text("status").notNull().default('pending'), // 'pending', 'running', 'completed', 'failed'
  progress: integer("progress").default(0), // 0-100
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // Duration in milliseconds
  details: text("details"), // Additional status information
  errorMessage: text("error_message"), // Error details if failed
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Campaigns table for campaign management
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default('email'), // email, sms, push, social
  status: text("status").notNull().default('draft'), // draft, active, paused, completed, cancelled
  budget: decimal("budget", { precision: 10, scale: 2 }),
  currency: text("currency").default('USD'),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  targetAudience: text("target_audience"), // JSON string describing target audience
  goals: text("goals").array(), // Array of campaign goals
  kpis: text("kpis"), // JSON string of key performance indicators
  settings: text("settings"), // JSON string of campaign-specific settings
  // Analytics fields
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  conversions: integer("conversions").default(0),
  spent: decimal("spent", { precision: 10, scale: 2 }).default('0'),
  // Reviewer approval fields
  requiresReviewerApproval: boolean("requires_reviewer_approval").default(false),
  reviewerId: varchar("reviewer_id").references(() => betterAuthUser.id),
  reviewStatus: text("review_status").default('pending'), // pending, approved, rejected
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email activity tracking for webhook events
export const emailActivity = pgTable("email_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").notNull().references(() => emailContacts.id, { onDelete: 'cascade' }),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: 'set null' }),
  newsletterId: varchar("newsletter_id").references(() => newsletters.id, { onDelete: 'set null' }),
  activityType: text("activity_type").notNull(), // 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed'
  activityData: text("activity_data"), // JSON string with additional event data
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  webhookId: text("webhook_id"), // Resend webhook event ID
  webhookData: text("webhook_data"), // Full webhook payload for debugging
  occurredAt: timestamp("occurred_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Unique constraint on (webhookId, tenantId) for idempotent webhook processing
  // Used by ON CONFLICT clause to prevent duplicate activity logging
  // Note: PostgreSQL allows multiple NULL values in unique constraints
  webhookIdTenantIdUnique: uniqueIndex("email_activity_webhook_id_tenant_id_unique")
    .on(table.webhookId, table.tenantId),
}));

// Per-contact unsubscribe tokens (long-lived until used once)
export const unsubscribeTokens = pgTable("unsubscribe_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").notNull().references(() => emailContacts.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Universal bounced emails list - prevents sending to any email that has ever bounced
export const bouncedEmails = pgTable("bounced_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(), // The bounced email address
  bounceType: text("bounce_type").notNull().default('hard'), // 'hard', 'soft', 'complaint'
  bounceReason: text("bounce_reason"), // Detailed reason for the bounce
  bounceSubType: text("bounce_sub_type"), // More specific bounce classification
  firstBouncedAt: timestamp("first_bounced_at").notNull(), // When this email first bounced
  lastBouncedAt: timestamp("last_bounced_at").notNull(), // Most recent bounce
  bounceCount: integer("bounce_count").default(1), // Number of times this email has bounced
  // Source information
  sourceTenantId: varchar("source_tenant_id").references(() => tenants.id), // Tenant where first bounce occurred
  sourceNewsletterId: varchar("source_newsletter_id").references(() => newsletters.id), // Newsletter that caused first bounce
  sourceCampaignId: varchar("source_campaign_id").references(() => campaigns.id), // Campaign that caused first bounce
  // Webhook information
  webhookId: text("webhook_id"), // Resend webhook event ID that triggered this
  webhookData: text("webhook_data"), // Full webhook payload for debugging
  // Status tracking
  isActive: boolean("is_active").default(true), // Whether this bounce is still active
  suppressionReason: text("suppression_reason"), // Why this email is suppressed
  lastAttemptedAt: timestamp("last_attempted_at"), // Last time we tried to send to this email
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Scheduled emails table - persists scheduled emails across server restarts
export const scheduledEmails = pgTable("scheduled_emails", {
  id: varchar("id").primaryKey(), // Use the queue ID from the email queue
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").references(() => emailContacts.id, { onDelete: 'cascade' }),
  // Email details
  to: text("to").notNull(), // JSON array of recipient emails
  subject: text("subject").notNull(),
  html: text("html"),
  text: text("text"),
  // Scheduling details
  scheduledAt: timestamp("scheduled_at").notNull(), // When the email should be sent
  status: text("status").notNull().default('pending'), // 'pending', 'processing', 'sent', 'failed', 'retrying'
  providerId: text("provider_id"), // Email provider to use
  // Attempt tracking
  attemptCount: integer("attempt_count").default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  nextRetryAt: timestamp("next_retry_at"),
  error: text("error"), // Last error message if failed
  // Metadata
  metadata: text("metadata"), // JSON metadata (contactId, recipientId, type, etc.)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const tenantRelations = relations(tenants, ({ many }) => ({
  users: many(betterAuthUser),
  stores: many(stores),
  shops: many(shops),
  forms: many(forms),
  refreshTokens: many(refreshTokens),
  verificationTokens: many(verificationTokens),
  formResponses: many(formResponses),
  emailContacts: many(emailContacts),
  emailLists: many(emailLists),
  contactTags: many(contactTags),
  contactListMemberships: many(contactListMemberships),
  contactTagAssignments: many(contactTagAssignments),
  segmentLists: many(segmentLists),
  newsletters: many(newsletters),
  campaigns: many(campaigns),
  emailActivities: many(emailActivity),
  bouncedEmails: many(bouncedEmails),
  birthdaySettings: many(birthdaySettings),
}));

export const betterAuthUserRelations = relations(betterAuthUser, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [betterAuthUser.tenantId],
    references: [tenants.id],
  }),
  refreshTokens: many(refreshTokens),
  forms: many(forms),
  verificationTokens: many(verificationTokens),
  ownedCompanies: many(companies),
  newsletters: many(newsletters),
  campaigns: many(campaigns),
  managedShops: many(shops),
  subscription: one(subscriptions, {
    fields: [betterAuthUser.id],
    references: [subscriptions.userId],
  }),
}));

export const companyRelations = relations(companies, ({ one }) => ({
  tenant: one(tenants, {
    fields: [companies.tenantId],
    references: [tenants.id],
  }),
  owner: one(betterAuthUser, {
    fields: [companies.ownerId],
    references: [betterAuthUser.id],
  }),
}));


export const formRelations = relations(forms, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [forms.tenantId],
    references: [tenants.id],
  }),
  user: one(betterAuthUser, {
    fields: [forms.userId],
    references: [betterAuthUser.id],
  }),
  responses: many(formResponses),
}));

export const formResponseRelations = relations(formResponses, ({ one }) => ({
  tenant: one(tenants, {
    fields: [formResponses.tenantId],
    references: [tenants.id],
  }),
  form: one(forms, {
    fields: [formResponses.formId],
    references: [forms.id],
  }),
}));

export const refreshTokenRelations = relations(refreshTokens, ({ one }) => ({
  tenant: one(tenants, {
    fields: [refreshTokens.tenantId],
    references: [tenants.id],
  }),
  user: one(betterAuthUser, {
    fields: [refreshTokens.userId],
    references: [betterAuthUser.id],
  }),
}));

export const verificationTokenRelations = relations(verificationTokens, ({ one }) => ({
  tenant: one(tenants, {
    fields: [verificationTokens.tenantId],
    references: [tenants.id],
  }),
  user: one(betterAuthUser, {
    fields: [verificationTokens.userId],
    references: [betterAuthUser.id],
  }),
}));

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  user: one(betterAuthUser, {
    fields: [subscriptions.userId],
    references: [betterAuthUser.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [subscriptions.planId],
    references: [subscriptionPlans.id],
  }),
}));

export const subscriptionPlanRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const storeRelations = relations(stores, ({ one }) => ({
  tenant: one(tenants, {
    fields: [stores.tenantId],
    references: [tenants.id],
  }),
}));

export const shopRelations = relations(shops, ({ one }) => ({
  tenant: one(tenants, {
    fields: [shops.tenantId],
    references: [tenants.id],
  }),
  manager: one(betterAuthUser, {
    fields: [shops.managerId],
    references: [betterAuthUser.id],
  }),
}));

export const insertUserSchema = createInsertSchema(betterAuthUser).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  twoFactorToken: z.string().optional(),
  rememberMe: z.boolean().optional().default(false),
});

export const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Owner registration schema - includes organization details
export const registerOwnerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  organizationName: z.string().min(1, "Organization name is required"),
  organizationSlug: z.string()
    .min(1, "Organization identifier is required")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens allowed")
    .max(50, "Organization identifier must be 50 characters or less"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  theme: z.enum(['light', 'dark']).optional(),
  language: z.enum(['en', 'es']).optional(),
  timezone: z.string().optional(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

export const resendVerificationSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const enable2FASchema = z.object({
  token: z.string().min(6, "Please enter a 6-digit code").max(6, "Please enter a 6-digit code"),
});

export const disable2FASchema = z.object({
  token: z.string().min(6, "Please enter a 6-digit code").max(6, "Please enter a 6-digit code"),
});

export const verify2FASchema = z.object({
  token: z.string().min(6, "Please enter a 6-digit code").max(6, "Please enter a 6-digit code"),
});

// Device session management schemas
export const createDeviceSessionSchema = z.object({
  deviceName: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  location: z.string().optional(),
});

// User management schemas - excludes Owner role from regular user creation/editing
const nonOwnerRoles = ['Administrator', 'Manager', 'Employee'] as const;
export { nonOwnerRoles };
export const createUserSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(nonOwnerRoles).default('Employee'),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
  emailVerified: z.boolean().default(true),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(nonOwnerRoles),
  isActive: z.boolean(),
});

export const userFiltersSchema = z.object({
  search: z.string().optional(),
  role: z.enum(userRoles).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  showInactive: z.preprocess((val) => {
    if (typeof val === 'string') {
      return val === 'true';
    }
    return val;
  }, z.boolean()).default(false),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof betterAuthUser.$inferSelect;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export type RegisterOwnerData = z.infer<typeof registerOwnerSchema>;
export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
export type UpdateProfileData = z.infer<typeof updateProfileSchema>;
export type ChangePasswordData = z.infer<typeof changePasswordSchema>;
export type Enable2FAData = z.infer<typeof enable2FASchema>;
export type Disable2FAData = z.infer<typeof disable2FASchema>;
export type Verify2FAData = z.infer<typeof verify2FASchema>;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type DeviceSession = typeof refreshTokens.$inferSelect;
export type CreateDeviceSessionData = z.infer<typeof createDeviceSessionSchema>;
export type VerifyEmailData = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationData = z.infer<typeof resendVerificationSchema>;

// User management types
export type CreateUserData = z.infer<typeof createUserSchema>;
export type UpdateUserData = z.infer<typeof updateUserSchema>;
export type UserFilters = z.infer<typeof userFiltersSchema>;

// Subscription types
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// API Response types
export interface UserSubscriptionResponse {
  subscription: (Subscription & { plan: SubscriptionPlan }) | null;
}

// Subscription schemas
export const subscriptionPlanSchema = createInsertSchema(subscriptionPlans);
export const createSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Billing schemas
export const billingInfoSchema = z.object({
  planId: z.string(),
  billingCycle: z.enum(['monthly', 'yearly']),
  paymentMethodId: z.string().optional(),
});

export type BillingInfo = z.infer<typeof billingInfoSchema>;

// Store types
export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type CreateStoreData = z.infer<typeof createStoreSchema>;
export type UpdateStoreData = z.infer<typeof updateStoreSchema>;

// Store schemas
export const insertStoreSchema = createInsertSchema(stores).omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateStoreSchema = insertStoreSchema.partial();

export const createStoreSchema = z.object({
  name: z.string().min(1, "Store name is required"),
  address: z.string().min(1, "Address is required"),
  telephone: z.string().min(1, "Telephone is required"),
  email: z.string().email("Please enter a valid email address"),
});

// Company schemas
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  address: z.string().optional(),
  companyType: z.string().optional(),
  companyEmail: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().url("Please enter a valid website URL").optional().or(z.literal("")),
  description: z.string().optional(),
  setupCompleted: z.boolean().optional(),
  geographicalLocation: z.string().optional(),
  language: z.string().optional(),
  businessDescription: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  address: z.string().optional(),
  companyType: z.string().optional(),
  companyEmail: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().url("Please enter a valid website URL").optional().or(z.literal("")),
  description: z.string().optional(),
});

// Onboarding wizard schemas
export const completeOnboardingSchema = z.object({
  geographicalLocation: z.string().min(1, "Geographical location is required"),
  language: z.string().min(1, "Language is required"),
  businessDescription: z.string().min(10, "Please provide at least 10 characters describing your business"),
});

// Company types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type CreateCompanyData = z.infer<typeof createCompanySchema>;
export type UpdateCompanyData = z.infer<typeof updateCompanySchema>;
export type CompleteOnboardingData = z.infer<typeof completeOnboardingSchema>;

// Multi-tenancy schemas and types
export const tenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const createTenantSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  slug: z.string().min(1, "Organization identifier is required").regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens allowed"),
  domain: z.string().optional(),
  maxUsers: z.number().default(10),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  domain: z.string().optional(),
  isActive: z.boolean(),
  maxUsers: z.number().min(1),
});


// Form schemas
export const createFormSchema = z.object({
  title: z.string().min(1, "Form title is required"),
  description: z.string().optional(),
  formData: z.string().min(1, "Form structure is required"),
  theme: z.string().default('modern'),
  isEmbeddable: z.boolean().default(true),
});

export const updateFormSchema = z.object({
  title: z.string().min(1, "Form title is required"),
  description: z.string().optional(),
  formData: z.string().min(1, "Form structure is required"),
  theme: z.string(),
  isActive: z.boolean(),
  isEmbeddable: z.boolean(),
});

export const submitFormResponseSchema = z.object({
  formId: z.string(),
  responseData: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

// Multi-tenancy types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof tenantSchema>;
export type CreateTenantData = z.infer<typeof createTenantSchema>;
export type UpdateTenantData = z.infer<typeof updateTenantSchema>;

// Form types
export type Form = typeof forms.$inferSelect;
export type InsertForm = typeof forms.$inferInsert;
export type CreateFormData = z.infer<typeof createFormSchema>;
export type UpdateFormData = z.infer<typeof updateFormSchema>;
export type FormResponse = typeof formResponses.$inferSelect;
export type InsertFormResponse = typeof formResponses.$inferInsert;
export type SubmitFormResponseData = z.infer<typeof submitFormResponseSchema>;

// Extended types for tenant-aware operations
export interface UserWithTenant extends User {
  tenant: Tenant;
}

export interface FormWithDetails extends Form {
  user: User;
  tenant: Tenant;
  responseCount: number;
}

export interface RefreshTokenInfo {
  expiresAt: string;
  timeLeft: number;
  days: number;
  hours: number;
  minutes: number;
  isExpired: boolean;
}

// Shop schemas
export const insertShopSchema = createInsertSchema(shops).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const createShopSchema = z.object({
  name: z.string().min(1, "Shop name is required"),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().default('United States'),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Please enter a valid email address"),
  website: z.string().url("Please enter a valid website URL").optional().or(z.literal("")),
  managerId: z.string().optional().nullable(),
  operatingHours: z.string().optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).default('active'),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  socialMedia: z.string().optional(),
  settings: z.string().optional(),
});

export const updateShopSchema = z.object({
  name: z.string().min(1, "Shop name is required"),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string(),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Please enter a valid email address"),
  website: z.string().url("Please enter a valid website URL").optional().or(z.literal("")),
  managerId: z.string().optional().nullable(),
  operatingHours: z.string().optional(),
  status: z.enum(['active', 'inactive', 'maintenance']),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  socialMedia: z.string().optional(),
  settings: z.string().optional(),
  isActive: z.boolean(),
});

// Shop types
export type Shop = typeof shops.$inferSelect;
export type InsertShop = z.infer<typeof insertShopSchema>;
export type CreateShopData = z.infer<typeof createShopSchema>;
export type UpdateShopData = z.infer<typeof updateShopSchema>;

export interface ShopWithManager extends Shop {
  manager?: User;
}

export interface ShopFilters {
  search?: string;
  status?: 'active' | 'inactive' | 'maintenance' | 'all';
  category?: string;
  managerId?: string;
}

// Email contact relations
export const emailContactRelations = relations(emailContacts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [emailContacts.tenantId],
    references: [tenants.id],
  }),
  listMemberships: many(contactListMemberships),
  tagAssignments: many(contactTagAssignments),
  activities: many(emailActivity),
}));

export const emailListRelations = relations(emailLists, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [emailLists.tenantId],
    references: [tenants.id],
  }),
  memberships: many(contactListMemberships),
}));

export const contactTagRelations = relations(contactTags, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [contactTags.tenantId],
    references: [tenants.id],
  }),
  assignments: many(contactTagAssignments),
}));

export const contactListMembershipRelations = relations(contactListMemberships, ({ one }) => ({
  tenant: one(tenants, {
    fields: [contactListMemberships.tenantId],
    references: [tenants.id],
  }),
  contact: one(emailContacts, {
    fields: [contactListMemberships.contactId],
    references: [emailContacts.id],
  }),
  list: one(emailLists, {
    fields: [contactListMemberships.listId],
    references: [emailLists.id],
  }),
}));

export const contactTagAssignmentRelations = relations(contactTagAssignments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [contactTagAssignments.tenantId],
    references: [tenants.id],
  }),
  contact: one(emailContacts, {
    fields: [contactTagAssignments.contactId],
    references: [emailContacts.id],
  }),
  tag: one(contactTags, {
    fields: [contactTagAssignments.tagId],
    references: [contactTags.id],
  }),
}));

export const segmentListRelations = relations(segmentLists, ({ one }) => ({
  tenant: one(tenants, {
    fields: [segmentLists.tenantId],
    references: [tenants.id],
  }),
}));

export const emailActivityRelations = relations(emailActivity, ({ one }) => ({
  tenant: one(tenants, {
    fields: [emailActivity.tenantId],
    references: [tenants.id],
  }),
  contact: one(emailContacts, {
    fields: [emailActivity.contactId],
    references: [emailContacts.id],
  }),
  campaign: one(campaigns, {
    fields: [emailActivity.campaignId],
    references: [campaigns.id],
  }),
  newsletter: one(newsletters, {
    fields: [emailActivity.newsletterId],
    references: [newsletters.id],
  }),
}));

export const bouncedEmailRelations = relations(bouncedEmails, ({ one }) => ({
  sourceTenant: one(tenants, {
    fields: [bouncedEmails.sourceTenantId],
    references: [tenants.id],
  }),
  sourceNewsletter: one(newsletters, {
    fields: [bouncedEmails.sourceNewsletterId],
    references: [newsletters.id],
  }),
  sourceCampaign: one(campaigns, {
    fields: [bouncedEmails.sourceCampaignId],
    references: [campaigns.id],
  }),
}));

// New split table relations
export const emailSendsRelations = relations(emailSends, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [emailSends.tenantId],
    references: [tenants.id],
  }),
  contact: one(emailContacts, {
    fields: [emailSends.contactId],
    references: [emailContacts.id],
  }),
  campaign: one(campaigns, {
    fields: [emailSends.campaignId],
    references: [campaigns.id],
  }),
  newsletter: one(newsletters, {
    fields: [emailSends.newsletterId],
    references: [newsletters.id],
  }),
  content: one(emailContent),
  events: many(emailEvents),
}));

export const emailContentRelations = relations(emailContent, ({ one, many }) => ({
  emailSend: one(emailSends, {
    fields: [emailContent.emailSendId],
    references: [emailSends.id],
  }),
}));

export const emailEventsRelations = relations(emailEvents, ({ one }) => ({
  send: one(emailSends, {
    fields: [emailEvents.emailSendId],
    references: [emailSends.id],
  }),
}));

// Email contact schemas
export const createEmailContactSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  status: z.enum(['active', 'unsubscribed', 'bounced', 'pending']).default('active'),
  tags: z.array(z.string()).optional(),
  lists: z.array(z.string()).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Birthday must be in YYYY-MM-DD format").optional(),
  birthdayEmailEnabled: z.boolean().default(false),
  consentGiven: z.boolean().refine(val => val === true, {
    message: "You must acknowledge consent before adding this contact"
  }),
  consentMethod: z.string().default('manual_add'),
  // Address fields
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  // Contact fields
  phoneNumber: z.string().optional(),
});

export const updateEmailContactSchema = z.object({
  email: z.string().email("Please enter a valid email address").optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  status: z.enum(['active', 'unsubscribed', 'bounced', 'pending']).optional(),
  emailsOpened: z.number().optional(),
  lastActivity: z.date().optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Birthday must be in YYYY-MM-DD format").optional(),
  birthdayEmailEnabled: z.boolean().optional(),
  // Address fields
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  // Contact fields
  phoneNumber: z.string().optional(),
});

export const createEmailListSchema = z.object({
  name: z.string().min(1, "List name is required"),
  description: z.string().optional(),
});

export const createContactTagSchema = z.object({
  name: z.string().min(1, "Tag name is required"),
  color: z.string().default('#3B82F6'),
});

// Email contact types
export type EmailContact = typeof emailContacts.$inferSelect;
export type InsertEmailContact = typeof emailContacts.$inferInsert;
export type CreateEmailContactData = z.infer<typeof createEmailContactSchema>;
export type UpdateEmailContactData = z.infer<typeof updateEmailContactSchema>;

export type EmailList = typeof emailLists.$inferSelect;
export type InsertEmailList = typeof emailLists.$inferInsert;
export type CreateEmailListData = z.infer<typeof createEmailListSchema>;

export type ContactTag = typeof contactTags.$inferSelect;
export type InsertContactTag = typeof contactTags.$inferInsert;
export type CreateContactTagData = z.infer<typeof createContactTagSchema>;

export type ContactListMembership = typeof contactListMemberships.$inferSelect;
export type ContactTagAssignment = typeof contactTagAssignments.$inferSelect;

// Segment list types and schemas
export const createSegmentListSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(['all', 'selected', 'tags']),
  selectedContactIds: z.array(z.string()).default([]),
  selectedTagIds: z.array(z.string()).default([]),
});

export const updateSegmentListSchema = createSegmentListSchema.partial();

export type SegmentList = typeof segmentLists.$inferSelect;
export type InsertSegmentList = typeof segmentLists.$inferInsert;
export type CreateSegmentListData = z.infer<typeof createSegmentListSchema>;
export type UpdateSegmentListData = z.infer<typeof updateSegmentListSchema>;

// Email activity types and schemas
export const createEmailActivitySchema = z.object({
  contactId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  newsletterId: z.string().uuid().optional(),
  activityType: z.enum(['sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed']),
  activityData: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  webhookId: z.string().optional(),
  webhookData: z.string().optional(),
  occurredAt: z.date(),
});

export const insertEmailActivitySchema = createInsertSchema(emailActivity).omit({
  id: true,
  tenantId: true,
  createdAt: true,
});

export type EmailActivity = typeof emailActivity.$inferSelect;
export type InsertEmailActivity = z.infer<typeof insertEmailActivitySchema>;
export type CreateEmailActivityData = z.infer<typeof createEmailActivitySchema>;

// New split table types and schemas
export const createEmailSendSchema = z.object({
  contactId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  newsletterId: z.string().uuid().optional(),
  contentId: z.string().uuid(),
  provider: z.enum(['resend', 'sendgrid', 'mailgun', 'ses']),
  providerId: z.string(),
  status: z.enum(['pending', 'sent', 'delivered', 'failed', 'bounced']).default('pending'),
  sentAt: z.date().optional(),
  deliveredAt: z.date().optional(),
  failedAt: z.date().optional(),
  errorMessage: z.string().optional(),
  metadata: z.string().optional(),
});

export const createEmailContentSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  htmlContent: z.string().min(1, "HTML content is required"),
  textContent: z.string().optional(),
  templateId: z.string().optional(),
  templateData: z.string().optional(),
  attachments: z.string().optional(),
});

export const createEmailEventSchema = z.object({
  sendId: z.string().uuid(),
  eventType: z.enum(['sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed']),
  eventData: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  webhookId: z.string().optional(),
  webhookData: z.string().optional(),
  occurredAt: z.date(),
});

export const insertEmailSendSchema = createInsertSchema(emailSends).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailContentSchema = createInsertSchema(emailContent).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailEventSchema = createInsertSchema(emailEvents).omit({
  id: true,
  createdAt: true,
});

export type EmailSend = typeof emailSends.$inferSelect;
export type InsertEmailSend = z.infer<typeof insertEmailSendSchema>;
export type CreateEmailSendData = z.infer<typeof createEmailSendSchema>;

export type EmailContent = typeof emailContent.$inferSelect;
export type InsertEmailContent = z.infer<typeof insertEmailContentSchema>;
export type CreateEmailContentData = z.infer<typeof createEmailContentSchema>;

export type EmailEvent = typeof emailEvents.$inferSelect;
export type InsertEmailEvent = z.infer<typeof insertEmailEventSchema>;
export type CreateEmailEventData = z.infer<typeof createEmailEventSchema>;

// Extended types for the new split tables
export interface EmailSendWithDetails extends EmailSend {
  contact: EmailContact;
  content: EmailContent;
  campaign?: Campaign;
  newsletter?: Newsletter;
  events?: EmailEvent[];
}

export interface EmailContentWithSends extends EmailContent {
  sends: EmailSend[];
}

// Extended types for email contacts
export interface EmailContactWithDetails extends EmailContact {
  tags: ContactTag[];
  lists: EmailList[];
  activities?: EmailActivity[];
}

export interface EmailListWithCount extends EmailList {
  count: number;
}

export interface ContactTagWithCount extends ContactTag {
  contactCount: number;
}

export interface ContactFilters {
  search?: string;
  status?: 'active' | 'unsubscribed' | 'bounced' | 'pending' | 'all';
  listId?: string;
  tagId?: string;
}

// Newsletter relations
export const newsletterRelations = relations(newsletters, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [newsletters.tenantId],
    references: [tenants.id],
  }),
  user: one(betterAuthUser, {
    fields: [newsletters.userId],
    references: [betterAuthUser.id],
  }),
  taskStatuses: many(newsletterTaskStatus),
}));

export const newsletterTaskStatusRelations = relations(newsletterTaskStatus, ({ one }) => ({
  newsletter: one(newsletters, {
    fields: [newsletterTaskStatus.newsletterId],
    references: [newsletters.id],
  }),
  tenant: one(tenants, {
    fields: [newsletterTaskStatus.tenantId],
    references: [tenants.id],
  }),
}));

// Newsletter schemas
export const createNewsletterSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Content is required"),
  // On create, disallow setting status to "sent"; use the send endpoint instead
  status: z.enum(['draft', 'scheduled']).default('draft'),
  scheduledAt: z.date().optional(),
  recipientType: z.enum(['all', 'selected', 'tags']).default('all'),
  selectedContactIds: z.array(z.string()).optional(),
  selectedTagIds: z.array(z.string()).optional(),
});

export const updateNewsletterSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  subject: z.string().min(1, "Subject is required").optional(),
  content: z.string().min(1, "Content is required").optional(),
  status: z.enum(['draft', 'scheduled', 'sent']).optional(),
  scheduledAt: z.date().optional(),
  sentAt: z.date().optional(),
  recipientType: z.enum(['all', 'selected', 'tags']).optional(),
  selectedContactIds: z.array(z.string()).optional(),
  selectedTagIds: z.array(z.string()).optional(),
  recipientCount: z.number().int().nonnegative().optional(),
  openCount: z.number().int().nonnegative().optional(),
  uniqueOpenCount: z.number().int().nonnegative().optional(),
  clickCount: z.number().int().nonnegative().optional(),
});

export const insertNewsletterSchema = createInsertSchema(newsletters).omit({
  id: true,
  tenantId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Newsletter types
export type Newsletter = typeof newsletters.$inferSelect;
export type InsertNewsletter = z.infer<typeof insertNewsletterSchema>;
export type CreateNewsletterData = z.infer<typeof createNewsletterSchema>;
export type UpdateNewsletterData = z.infer<typeof updateNewsletterSchema>;

// Newsletter Task Status schemas
export const createNewsletterTaskStatusSchema = z.object({
  taskType: z.enum(['validation', 'processing', 'sending', 'analytics']),
  taskName: z.string().min(1, "Task name is required"),
  status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
  progress: z.number().int().min(0).max(100).default(0),
  details: z.string().optional(),
  errorMessage: z.string().optional(),
  metadata: z.string().optional(),
});

export const updateNewsletterTaskStatusSchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  duration: z.number().int().nonnegative().optional(),
  details: z.string().optional(),
  errorMessage: z.string().optional(),
  metadata: z.string().optional(),
});

export const insertNewsletterTaskStatusSchema = createInsertSchema(newsletterTaskStatus).omit({
  id: true,
  tenantId: true,
  newsletterId: true,
  createdAt: true,
  updatedAt: true,
});

// Newsletter Task Status types
export type NewsletterTaskStatus = typeof newsletterTaskStatus.$inferSelect;
export type InsertNewsletterTaskStatus = z.infer<typeof insertNewsletterTaskStatusSchema>;
export type CreateNewsletterTaskStatusData = z.infer<typeof createNewsletterTaskStatusSchema>;
export type UpdateNewsletterTaskStatusData = z.infer<typeof updateNewsletterTaskStatusSchema>;

// Campaign relations
export const campaignRelations = relations(campaigns, ({ one }) => ({
  tenant: one(tenants, {
    fields: [campaigns.tenantId],
    references: [tenants.id],
  }),
  user: one(betterAuthUser, {
    fields: [campaigns.userId],
    references: [betterAuthUser.id],
  }),
  reviewer: one(betterAuthUser, {
    fields: [campaigns.reviewerId],
    references: [betterAuthUser.id],
  }),
}));

// Campaign schemas
export const createCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().optional(),
  type: z.enum(['email', 'sms', 'push', 'social']).default('email'),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']).default('draft'),
  budget: z.number().positive("Budget must be positive").optional(),
  currency: z.string().default('USD'),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  targetAudience: z.string().optional(),
  goals: z.array(z.string()).optional(),
  kpis: z.string().optional(),
  settings: z.string().optional(),
  requiresReviewerApproval: z.boolean().default(false),
  reviewerId: z.string().optional(),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required").optional(),
  description: z.string().optional(),
  type: z.enum(['email', 'sms', 'push', 'social']).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']).optional(),
  budget: z.number().positive("Budget must be positive").optional(),
  currency: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  targetAudience: z.string().optional(),
  goals: z.array(z.string()).optional(),
  kpis: z.string().optional(),
  settings: z.string().optional(),
  requiresReviewerApproval: z.boolean().optional(),
  reviewerId: z.string().optional(),
  reviewStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  reviewNotes: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  tenantId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Campaign types
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type CreateCampaignData = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignData = z.infer<typeof updateCampaignSchema>;

export interface NewsletterWithUser extends Newsletter {
  user: User;
  // API transformation fields for unique/total opens
  opens?: number; // Unique opens (primary metric)
  totalOpens?: number; // Total opens (includes repeats)
}

// Bounced emails schemas
export const createBouncedEmailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  bounceType: z.enum(['hard', 'soft', 'complaint']).default('hard'),
  bounceReason: z.string().optional(),
  bounceSubType: z.string().optional(),
  firstBouncedAt: z.date(),
  lastBouncedAt: z.date(),
  bounceCount: z.number().int().positive().default(1),
  sourceTenantId: z.string().uuid().optional(),
  sourceNewsletterId: z.string().uuid().optional(),
  sourceCampaignId: z.string().uuid().optional(),
  webhookId: z.string().optional(),
  webhookData: z.string().optional(),
  suppressionReason: z.string().optional(),
  lastAttemptedAt: z.date().optional(),
});

export const updateBouncedEmailSchema = z.object({
  bounceType: z.enum(['hard', 'soft', 'complaint']).optional(),
  bounceReason: z.string().optional(),
  bounceSubType: z.string().optional(),
  lastBouncedAt: z.date().optional(),
  bounceCount: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  suppressionReason: z.string().optional(),
  lastAttemptedAt: z.date().optional(),
});

export const insertBouncedEmailSchema = createInsertSchema(bouncedEmails).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Bounced emails types
export type BouncedEmail = typeof bouncedEmails.$inferSelect;
export type InsertBouncedEmail = z.infer<typeof insertBouncedEmailSchema>;
export type CreateBouncedEmailData = z.infer<typeof createBouncedEmailSchema>;
export type UpdateBouncedEmailData = z.infer<typeof updateBouncedEmailSchema>;

// Birthday settings table for managing birthday email campaigns
export const birthdaySettings = pgTable("birthday_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  enabled: boolean("enabled").default(false),
  emailTemplate: text("email_template").default('default'), // Email template to use
  segmentFilter: text("segment_filter").default('all'), // Which contacts to include
  customMessage: text("custom_message").default(''), // Custom birthday message
  customThemeData: text("custom_theme_data"), // JSON data for custom theme
  promotionId: varchar("promotion_id").references(() => promotions.id, { onDelete: 'set null' }), // Optional promotion to include in birthday emails
  splitPromotionalEmail: boolean("split_promotional_email").default(false), // Send promotion as separate email for better deliverability
  disabledHolidays: text("disabled_holidays").array(), // Array of disabled holiday IDs (e.g., ['valentine', 'stpatrick'])
  senderName: text("sender_name").default(''), // Sender name for birthday emails
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eCardSettings = pgTable("e_card_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  enabled: boolean("enabled").default(false),
  emailTemplate: text("email_template").default('default'), // Email template to use
  customMessage: text("custom_message").default(''), // Custom e-card message
  customThemeData: text("custom_theme_data"), // JSON data for custom themes (separate from birthday cards)
  senderName: text("sender_name").default(''), // Sender name for e-cards
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Master email design settings for tenant-wide email branding
export const masterEmailDesign = pgTable("master_email_design", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().unique().references(() => tenants.id, { onDelete: 'cascade' }),
  companyName: text("company_name").default(''),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default('#3B82F6'),
  secondaryColor: text("secondary_color").default('#1E40AF'),
  accentColor: text("accent_color").default('#10B981'),
  fontFamily: text("font_family").default('Arial, sans-serif'),
  headerText: text("header_text"),
  footerText: text("footer_text"),
  socialLinks: text("social_links"), // JSON: { facebook, twitter, instagram, linkedin }
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Master email design relations
export const masterEmailDesignRelations = relations(masterEmailDesign, ({ one }) => ({
  tenant: one(tenants, {
    fields: [masterEmailDesign.tenantId],
    references: [tenants.id],
  }),
}));

// Master email design types
export type MasterEmailDesign = typeof masterEmailDesign.$inferSelect;
export type InsertMasterEmailDesign = typeof masterEmailDesign.$inferInsert;

export const birthdayUnsubscribeTokens = pgTable("birthday_unsubscribe_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").notNull().references(() => emailContacts.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  usedAt: timestamp("used_at"),
});

// Extended types for bounced emails with relations
export interface BouncedEmailWithDetails extends BouncedEmail {
  sourceTenant?: Tenant;
  sourceNewsletter?: Newsletter;
  sourceCampaign?: Campaign;
}

export interface BouncedEmailFilters {
  search?: string;
  bounceType?: 'hard' | 'soft' | 'complaint' | 'all';
  isActive?: boolean;
  tenantId?: string;
}

// Tenant Limits schemas and types
export const createTenantLimitsSchema = z.object({
  maxShops: z.number().int().positive().optional(),
  maxUsers: z.number().int().positive().optional(),
  maxStorageGb: z.number().int().positive().optional(),
  customLimits: z.string().default('{}'),
  overrideReason: z.string().optional(),
  expiresAt: z.date().optional(),
});

export const updateTenantLimitsSchema = z.object({
  maxShops: z.number().int().positive().optional(),
  maxUsers: z.number().int().positive().optional(),
  maxStorageGb: z.number().int().positive().optional(),
  customLimits: z.string().optional(),
  overrideReason: z.string().optional(),
  expiresAt: z.date().optional(),
  isActive: z.boolean().optional(),
});

export const insertTenantLimitsSchema = createInsertSchema(tenantLimits).omit({
  id: true,
  tenantId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export type TenantLimits = typeof tenantLimits.$inferSelect;
export type InsertTenantLimits = z.infer<typeof insertTenantLimitsSchema>;
export type CreateTenantLimitsData = z.infer<typeof createTenantLimitsSchema>;
export type UpdateTenantLimitsData = z.infer<typeof updateTenantLimitsSchema>;

// Shop Limit Events schemas and types
export const createShopLimitEventSchema = z.object({
  eventType: z.enum(['limit_reached', 'limit_exceeded', 'limit_increased', 'limit_decreased', 'shop_created', 'shop_deleted']),
  shopCount: z.number().int().nonnegative(),
  limitValue: z.number().int().positive().optional(),
  subscriptionPlanId: z.string().uuid().optional(),
  customLimitId: z.string().uuid().optional(),
  metadata: z.string().default('{}'),
});

export const insertShopLimitEventSchema = createInsertSchema(shopLimitEvents).omit({
  id: true,
  tenantId: true,
  createdAt: true,
});

export type ShopLimitEvent = typeof shopLimitEvents.$inferSelect;
export type InsertShopLimitEvent = z.infer<typeof insertShopLimitEventSchema>;
export type CreateShopLimitEventData = z.infer<typeof createShopLimitEventSchema>;

// Enhanced shop limits interface
export interface EnhancedShopLimits {
  currentShops: number;
  maxShops: number | null;
  canAddShop: boolean;
  planName: string;
  isCustomLimit: boolean;
  customLimitReason?: string;
  expiresAt?: Date;
  remainingShops?: number;
}

// Tenant limits with relationships
export interface TenantLimitsWithDetails extends TenantLimits {
  createdByUser?: User;
  tenant?: Tenant;
}

// Shop limit event types
export type ShopLimitEventType = 'limit_reached' | 'limit_exceeded' | 'limit_increased' | 'limit_decreased' | 'shop_created' | 'shop_deleted';

// Enhanced shop limit filters
export interface ShopLimitFilters {
  tenantId?: string;
  eventType?: ShopLimitEventType;
  fromDate?: Date;
  toDate?: Date;
  includeMetadata?: boolean;
}

// Birthday settings relations
export const birthdaySettingsRelations = relations(birthdaySettings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [birthdaySettings.tenantId],
    references: [tenants.id],
  }),
  promotion: one(promotions, {
    fields: [birthdaySettings.promotionId],
    references: [promotions.id],
  }),
}));

export const eCardSettingsRelations = relations(eCardSettings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [eCardSettings.tenantId],
    references: [tenants.id],
  }),
}));

// Birthday settings schemas
export const createBirthdaySettingsSchema = z.object({
  enabled: z.boolean().default(false),
  emailTemplate: z.string().default('default'),
  segmentFilter: z.string().default('all'),
  customMessage: z.string().default(''),
  senderName: z.string().default(''),
  promotionId: z.string().optional(),
});

export const updateBirthdaySettingsSchema = z.object({
  enabled: z.boolean().optional(),
  emailTemplate: z.string().optional(),
  segmentFilter: z.string().optional(),
  customMessage: z.string().optional(),
  senderName: z.string().optional(),
  promotionId: z.string().optional(),
});

export const insertBirthdaySettingsSchema = createInsertSchema(birthdaySettings).omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
});

// Birthday settings types
export type BirthdaySettings = typeof birthdaySettings.$inferSelect;
export type InsertBirthdaySettings = z.infer<typeof insertBirthdaySettingsSchema>;
export type CreateBirthdaySettingsData = z.infer<typeof createBirthdaySettingsSchema>;
export type UpdateBirthdaySettingsData = z.infer<typeof updateBirthdaySettingsSchema>;

// E-Card settings schemas
export const createECardSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  emailTemplate: z.string().default('default'),
  customMessage: z.string().default(''),
  senderName: z.string().default(''),
});

export const updateECardSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  emailTemplate: z.string().optional(),
  customMessage: z.string().optional(),
  senderName: z.string().optional(),
  customThemeData: z.string().optional(),
});

export const insertECardSettingsSchema = createInsertSchema(eCardSettings).omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
});

// E-Card settings types
export type ECardSettings = typeof eCardSettings.$inferSelect;
export type InsertECardSettings = z.infer<typeof insertECardSettingsSchema>;
export type CreateECardSettingsData = z.infer<typeof createECardSettingsSchema>;
export type UpdateECardSettingsData = z.infer<typeof updateECardSettingsSchema>;

// Custom theme data structure for birthday cards
export interface CustomThemeData {
  title: string;
  description?: string;
  message: string;
  signature: string;
  imageUrl?: string | null;
  customImage: boolean;
  imagePosition: { x: number; y: number };
  imageScale: number;
}

// Custom e-cards table for storing user-created custom holiday/occasion cards
export const customCards = pgTable("custom_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }),
  name: text("name").notNull(), // Card name (e.g., "Mother's Day Card")
  occasionType: text("occasion_type"), // Type of occasion (e.g., "Mother's Day", "Christmas")
  sendDate: text("send_date").notNull(), // Date to send card in YYYY-MM-DD format
  active: boolean("active").default(true), // Whether the card is active/enabled
  cardData: text("card_data").notNull(), // JSON string containing CustomThemeData
  promotionIds: text("promotion_ids").array(), // Array of promotion IDs to attach to this card
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Promotions table for managing promotional content templates
export const promotions = pgTable("promotions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content").notNull(), // HTML content of the promotion
  type: text("type").notNull().default('newsletter'), // newsletter, survey, birthday, announcement, sale, event
  targetAudience: text("target_audience").notNull().default('all'), // all, subscribers, customers, prospects, vip
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0), // Track how many times this promotion has been used
  maxUses: integer("max_uses"), // Maximum times this promotion can be used (null = unlimited)
  validFrom: timestamp("valid_from"), // Promotion becomes available from this date
  validTo: timestamp("valid_to"), // Promotion expires after this date
  promotionalCodes: text("promotional_codes"), // JSON array of promotional codes
  metadata: text("metadata"), // JSON string for additional settings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Custom card relations
export const customCardRelations = relations(customCards, ({ one }) => ({
  tenant: one(tenants, {
    fields: [customCards.tenantId],
    references: [tenants.id],
  }),
  user: one(betterAuthUser, {
    fields: [customCards.userId],
    references: [betterAuthUser.id],
  }),
}));

// Promotion relations
export const promotionRelations = relations(promotions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [promotions.tenantId],
    references: [tenants.id],
  }),
  user: one(betterAuthUser, {
    fields: [promotions.userId],
    references: [betterAuthUser.id],
  }),
}));

// Promotion schemas
export const createPromotionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  type: z.enum(['newsletter', 'survey', 'birthday', 'announcement', 'sale', 'event']).default('newsletter'),
  targetAudience: z.enum(['all', 'subscribers', 'customers', 'prospects', 'vip']).default('all'),
  isActive: z.boolean().default(true),
  maxUses: z.number().int().positive().optional(),
  validFrom: z.date().optional(),
  validTo: z.date().optional(),
  promotionalCodes: z.array(z.string()).optional(),
  metadata: z.string().optional(),
});

export const updatePromotionSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().optional(),
  content: z.string().min(1, "Content is required").optional(),
  type: z.enum(['newsletter', 'survey', 'birthday', 'announcement', 'sale', 'event']).optional(),
  targetAudience: z.enum(['all', 'subscribers', 'customers', 'prospects', 'vip']).optional(),
  isActive: z.boolean().optional(),
  maxUses: z.number().int().positive().optional(),
  validFrom: z.date().optional(),
  validTo: z.date().optional(),
  promotionalCodes: z.array(z.string()).optional(),
  metadata: z.string().optional(),
});

export const insertPromotionSchema = createInsertSchema(promotions).omit({
  id: true,
  tenantId: true,
  userId: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

// Promotion types
export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type CreatePromotionData = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionData = z.infer<typeof updatePromotionSchema>;

// Custom card schemas
export const createCustomCardSchema = z.object({
  name: z.string().min(1, "Card name is required"),
  occasionType: z.string().optional(),
  sendDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Send date must be in YYYY-MM-DD format"),
  active: z.boolean().default(true),
  cardData: z.string().min(1, "Card data is required"), // JSON string
  promotionIds: z.array(z.string()).optional(),
});

export const updateCustomCardSchema = z.object({
  name: z.string().min(1, "Card name is required").optional(),
  occasionType: z.string().optional(),
  sendDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Send date must be in YYYY-MM-DD format").optional(),
  active: z.boolean().optional(),
  cardData: z.string().optional(),
  promotionIds: z.array(z.string()).optional(),
});

export const insertCustomCardSchema = createInsertSchema(customCards).omit({
  id: true,
  tenantId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Custom card types
export type CustomCard = typeof customCards.$inferSelect;
export type InsertCustomCard = z.infer<typeof insertCustomCardSchema>;
export type CreateCustomCardData = z.infer<typeof createCustomCardSchema>;
export type UpdateCustomCardData = z.infer<typeof updateCustomCardSchema>;

// Appointments table for managing appointments and reminders
export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: varchar("customer_id").notNull().references(() => emailContacts.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }), // Who created the appointment
  title: text("title").notNull(),
  description: text("description"),
  appointmentDate: timestamp("appointment_date").notNull(),
  duration: integer("duration").default(60), // Duration in minutes
  location: text("location"),
  serviceType: text("service_type"), // e.g., "consultation", "meeting", "service"
  status: text("status").notNull().default('scheduled'), // scheduled, confirmed, cancelled, completed, no_show
  notes: text("notes"),
  reminderSent: boolean("reminder_sent").default(false),
  reminderSentAt: timestamp("reminder_sent_at"),
  confirmationReceived: boolean("confirmation_received").default(false),
  confirmationReceivedAt: timestamp("confirmation_received_at"),
  confirmationToken: text("confirmation_token"), // Unique token for confirmation links
  reminderSettings: text("reminder_settings"), // JSON: when to send reminders
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Appointment notes table for storing multiple notes per appointment
export const appointmentNotes = pgTable("appointment_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  appointmentId: varchar("appointment_id").notNull().references(() => appointments.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }), // Who created the note
  content: text("content").notNull(), // Multiline text content
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Appointment reminders table for tracking reminder history
export const appointmentReminders = pgTable("appointment_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  appointmentId: varchar("appointment_id").notNull().references(() => appointments.id, { onDelete: 'cascade' }),
  customerId: varchar("customer_id").notNull().references(() => emailContacts.id, { onDelete: 'cascade' }),
  reminderType: text("reminder_type").notNull(), // 'email', 'sms', 'push'
  reminderTiming: text("reminder_timing").notNull(), // '5m', '30m', '1h', '5h', '10h', 'custom'
  customMinutesBefore: integer("custom_minutes_before"), // Custom minutes before appointment when reminder should be sent
  scheduledFor: timestamp("scheduled_for").notNull(),
  timezone: text("timezone").default('America/Chicago'), // Timezone for the reminder (IANA timezone identifier)
  inngestEventId: text("inngest_event_id"), // Task queue run ID for tracking/cancellation (Trigger.dev run ID or legacy Inngest event ID)
  sentAt: timestamp("sent_at"),
  status: text("status").notNull().default('pending'), // pending, sent, failed, cancelled
  content: text("content"), // The reminder message content
  errorMessage: text("error_message"), // If failed, what was the error
  metadata: text("metadata"), // JSON for additional data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Appointment relations
export const appointmentRelations = relations(appointments, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [appointments.tenantId],
    references: [tenants.id],
  }),
  customer: one(emailContacts, {
    fields: [appointments.customerId],
    references: [emailContacts.id],
  }),
  user: one(betterAuthUser, {
    fields: [appointments.userId],
    references: [betterAuthUser.id],
  }),
  reminders: many(appointmentReminders),
  notes: many(appointmentNotes),
}));

// Appointment notes relations
export const appointmentNoteRelations = relations(appointmentNotes, ({ one }) => ({
  tenant: one(tenants, {
    fields: [appointmentNotes.tenantId],
    references: [tenants.id],
  }),
  appointment: one(appointments, {
    fields: [appointmentNotes.appointmentId],
    references: [appointments.id],
  }),
  user: one(betterAuthUser, {
    fields: [appointmentNotes.userId],
    references: [betterAuthUser.id],
  }),
}));

export const appointmentReminderRelations = relations(appointmentReminders, ({ one }) => ({
  tenant: one(tenants, {
    fields: [appointmentReminders.tenantId],
    references: [tenants.id],
  }),
  appointment: one(appointments, {
    fields: [appointmentReminders.appointmentId],
    references: [appointments.id],
  }),
  customer: one(emailContacts, {
    fields: [appointmentReminders.customerId],
    references: [emailContacts.id],
  }),
}));

// Update tenant relations to include appointments and templates
export const tenantRelationsUpdated = relations(tenants, ({ many }) => ({
  users: many(betterAuthUser),
  stores: many(stores),
  shops: many(shops),
  forms: many(forms),
  refreshTokens: many(refreshTokens),
  verificationTokens: many(verificationTokens),
  formResponses: many(formResponses),
  emailContacts: many(emailContacts),
  emailLists: many(emailLists),
  contactTags: many(contactTags),
  contactListMemberships: many(contactListMemberships),
  contactTagAssignments: many(contactTagAssignments),
  newsletters: many(newsletters),
  campaigns: many(campaigns),
  emailActivities: many(emailActivity),
  bouncedEmails: many(bouncedEmails),
  emailSends: many(emailSends),
  emailContent: many(emailContent),
  emailEvents: many(emailEvents),
  birthdaySettings: many(birthdaySettings),
  appointments: many(appointments),
  appointmentReminders: many(appointmentReminders),
  templates: many(templates),
  triggerTasks: many(triggerTasks),
}));

// Trigger.dev Tasks tracking table for recording all background tasks
// Tracks outgoing tasks and their status updates at a local level
export const triggerTasks = pgTable("trigger_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: 'cascade' }),

  // Task identification
  taskId: text("task_id").notNull(), // Trigger.dev task identifier e.g., 'send-appointment-reminder'
  runId: text("run_id"), // Trigger.dev run ID (starts with 'run_')
  idempotencyKey: text("idempotency_key").unique(), // Prevent duplicate triggers

  // Task payload
  payload: text("payload").notNull(), // JSON payload sent to Trigger.dev

  // Status tracking
  status: text("status").notNull().default('pending'), // pending, triggered, running, completed, failed, cancelled

  // Retry tracking
  attemptCount: integer("attempt_count").default(0),
  maxAttempts: integer("max_attempts").default(3),
  lastAttemptAt: timestamp("last_attempt_at"),

  // Scheduling
  scheduledFor: timestamp("scheduled_for"), // If task is scheduled for future execution

  // Result tracking
  output: text("output"), // JSON output from task execution
  errorMessage: text("error_message"),
  errorCode: text("error_code"), // Error code if failed

  // Related records (for easier querying)
  relatedType: text("related_type"), // 'appointment_reminder', 'newsletter', 'email', 'bulk_email'
  relatedId: varchar("related_id"), // ID of the related record

  // Timestamps
  triggeredAt: timestamp("triggered_at"), // When task was triggered to Trigger.dev
  startedAt: timestamp("started_at"), // When task started executing
  completedAt: timestamp("completed_at"), // When task finished (success or failure)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Trigger tasks relations
export const triggerTaskRelations = relations(triggerTasks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [triggerTasks.tenantId],
    references: [tenants.id],
  }),
}));

// Trigger task status enum
export const triggerTaskStatuses = ['pending', 'triggered', 'running', 'completed', 'failed', 'cancelled'] as const;
export type TriggerTaskStatus = typeof triggerTaskStatuses[number];

// Trigger task related types
export const triggerTaskRelatedTypes = ['appointment_reminder', 'newsletter', 'email', 'bulk_email', 'scheduled_email'] as const;
export type TriggerTaskRelatedType = typeof triggerTaskRelatedTypes[number];

// Trigger task types
export type TriggerTask = typeof triggerTasks.$inferSelect;
export type InsertTriggerTask = typeof triggerTasks.$inferInsert;

// Legacy aliases for backwards compatibility during migration
export const inngestEvents = triggerTasks;
export const inngestEventStatuses = triggerTaskStatuses;
export type InngestEventStatus = TriggerTaskStatus;
export const inngestEventRelatedTypes = triggerTaskRelatedTypes;
export type InngestEventRelatedType = TriggerTaskRelatedType;
export type InngestEvent = TriggerTask;
export type InsertInngestEvent = InsertTriggerTask;

// Appointment schemas
export const createAppointmentSchema = z.object({
  customerId: z.string().uuid("Please select a valid customer"),
  title: z.string().min(1, "Appointment title is required"),
  description: z.string().optional(),
  appointmentDate: z.coerce.date().refine(
    (date) => {
      const now = new Date();
      now.setSeconds(0, 0); // Round down to the minute
      return date >= now;
    },
    { message: "Appointment date must be in the future" }
  ),
  duration: z.number().int().positive().default(60),
  location: z.string().optional(),
  serviceType: z.string().optional(),
  notes: z.string().optional(),
  reminderSettings: z.string().optional(), // JSON string
});

export const updateAppointmentSchema = z.object({
  title: z.string().min(1, "Appointment title is required").optional(),
  description: z.string().optional(),
  appointmentDate: z.coerce.date().refine(
    (date) => {
      const now = new Date();
      now.setSeconds(0, 0); // Round down to the minute
      return date.getTime() >= now.getTime() - 24 * 60 * 60 * 1000; // Allow dates within last 24 hours
    },
    { message: "Appointment date must not be in the distant past" }
  ).optional(),
  duration: z.number().int().positive().optional(),
  location: z.string().optional(),
  serviceType: z.string().optional(),
  status: z.enum(['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show']).optional(),
  notes: z.string().optional(),
  reminderSettings: z.string().optional(),
});

export const createAppointmentReminderSchema = z.object({
  appointmentId: z.string().uuid(),
  reminderType: z.enum(['email', 'sms', 'push']).default('email'),
  reminderTiming: z.enum(['now', '5m', '30m', '1h', '5h', '10h', 'custom']).default('1h'),
  customMinutesBefore: z.number().min(1).max(10080).optional(), // Up to 1 week before
  scheduledFor: z.coerce.date().refine(
    (date) => {
      const now = new Date();
      now.setSeconds(0, 0); // Round down to the minute
      return date >= now;
    },
    { message: "Reminder scheduled time must be in the future" }
  ),
  timezone: z.string().default('America/Chicago'), // IANA timezone identifier
  content: z.string().optional(),
});

// Appointment types
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;
export type CreateAppointmentData = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentData = z.infer<typeof updateAppointmentSchema>;

export type AppointmentReminder = typeof appointmentReminders.$inferSelect;
export type InsertAppointmentReminder = typeof appointmentReminders.$inferInsert;
export type CreateAppointmentReminderData = z.infer<typeof createAppointmentReminderSchema>;

// Appointment note schemas
export const createAppointmentNoteSchema = z.object({
  appointmentId: z.string().uuid("Valid appointment ID is required"),
  content: z.string().min(1, "Note content is required"),
});

export const updateAppointmentNoteSchema = z.object({
  content: z.string().min(1, "Note content is required"),
});

// Appointment note types
export type AppointmentNote = typeof appointmentNotes.$inferSelect;
export type InsertAppointmentNote = typeof appointmentNotes.$inferInsert;
export type CreateAppointmentNoteData = z.infer<typeof createAppointmentNoteSchema>;
export type UpdateAppointmentNoteData = z.infer<typeof updateAppointmentNoteSchema>;

// Extended appointment types with relationships
export interface AppointmentWithDetails extends Appointment {
  customer: EmailContact;
  user: User;
  reminders?: AppointmentReminder[];
  appointmentNotes?: AppointmentNote[];
}

export interface AppointmentFilters {
  search?: string;
  status?: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'all';
  customerId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  serviceType?: string;
}

// Email templates table for reusable email content
export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }), // Who created the template
  name: text("name").notNull(),
  channel: text("channel").notNull(), // individual, promotional, newsletter, transactional
  category: text("category").notNull(), // welcome, retention, seasonal, update, custom
  subjectLine: text("subject_line").notNull(),
  preview: text("preview"), // Preview text for email clients
  body: text("body").notNull(), // HTML or plain text content
  usageCount: integer("usage_count").default(0),
  lastUsed: timestamp("last_used"),
  isFavorite: boolean("is_favorite").default(false),
  tags: text("tags").array().default(sql`'{}'`), // Array of tags for organization
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Template relations
export const templateRelations = relations(templates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [templates.tenantId],
    references: [tenants.id],
  }),
  user: one(betterAuthUser, {
    fields: [templates.userId],
    references: [betterAuthUser.id],
  }),
}));

// Template channel and category enums
export const templateChannels = ['individual', 'promotional', 'newsletter', 'transactional'] as const;
export type TemplateChannel = typeof templateChannels[number];

export const templateCategories = ['welcome', 'retention', 'seasonal', 'update', 'custom'] as const;
export type TemplateCategory = typeof templateCategories[number];

// Template schemas
export const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  channel: z.enum(templateChannels),
  category: z.enum(templateCategories),
  subjectLine: z.string().min(1, "Subject line is required"),
  preview: z.string().optional(),
  body: z.string().min(1, "Template content is required"),
  tags: z.array(z.string()).default([]),
  isFavorite: z.boolean().default(false),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").optional(),
  channel: z.enum(templateChannels).optional(),
  category: z.enum(templateCategories).optional(),
  subjectLine: z.string().min(1, "Subject line is required").optional(),
  preview: z.string().optional(),
  body: z.string().min(1, "Template content is required").optional(),
  tags: z.array(z.string()).optional(),
  isFavorite: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  tenantId: true,
  userId: true,
  usageCount: true,
  lastUsed: true,
  createdAt: true,
  updatedAt: true,
});

// Template types
export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type CreateTemplateData = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateData = z.infer<typeof updateTemplateSchema>;

// Extended template types with relationships
export interface TemplateWithDetails extends Template {
  user: User;
}

export interface TemplateFilters {
  search?: string;
  channel?: TemplateChannel | 'all';
  category?: TemplateCategory | 'all';
  favoritesOnly?: boolean;
  isActive?: boolean;
}

// Activity logs table for tracking all user actions
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => betterAuthUser.id, { onDelete: 'cascade' }),

  // What entity was affected
  entityType: text("entity_type").notNull(), // 'shop', 'user', 'appointment', 'email', 'contact', etc.
  entityId: varchar("entity_id"), // ID of the affected entity
  entityName: text("entity_name"), // Human-readable name (e.g., shop name)

  // What happened
  activityType: text("activity_type").notNull(), // 'created', 'updated', 'deleted', 'sent', 'scheduled', etc.
  description: text("description"), // Human-readable description

  // Change details
  changes: text("changes"), // JSON: { field: { old: value, new: value } }
  metadata: text("metadata"), // JSON: Additional context data

  // Request context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  createdAt: timestamp("created_at").defaultNow(),
});

// Activity log relations
export const activityLogRelations = relations(activityLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [activityLogs.tenantId],
    references: [tenants.id],
  }),
  user: one(betterAuthUser, {
    fields: [activityLogs.userId],
    references: [betterAuthUser.id],
  }),
}));

// Activity log types
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

// Extended type with user details
export interface ActivityLogWithUser extends ActivityLog {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

// Activity log query schema
export const activityLogQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  activityType: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export type ActivityLogQuery = z.infer<typeof activityLogQuerySchema>;
