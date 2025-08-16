import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, decimal, integer, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").default('Employee').notNull(), // User role for permissions
  isActive: boolean("is_active").default(true),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: text("two_factor_secret"),
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  lastVerificationEmailSent: timestamp("last_verification_email_sent"),
  lastLoginAt: timestamp("last_login_at"), // Track last login for user management
  menuExpanded: boolean("menu_expanded").default(false), // New field for menu preference
  theme: text("theme").default('light'), // Theme preference: 'light' or 'dark'
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  managerId: varchar("manager_id").references(() => users.id, { onDelete: 'set null' }),
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
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
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

// Email verification tokens table (missing from current schema)
export const verificationTokens = pgTable("verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
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
  // Consent tracking fields
  consentGiven: boolean("consent_given").notNull().default(false),
  consentDate: timestamp("consent_date"),
  consentMethod: text("consent_method"), // 'manual_add', 'form_submission', 'import', 'api'
  consentIpAddress: text("consent_ip_address"),
  consentUserAgent: text("consent_user_agent"),
  addedByUserId: varchar("added_by_user_id").references(() => users.id),
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

// Companies table for multi-tenant company information
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Links to account owner
  name: text("name").notNull(),
  address: text("address"),
  companyType: text("company_type"), // e.g., Corporation, LLC, Partnership, etc.
  companyEmail: text("company_email"),
  phone: text("phone"),
  website: text("website"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Forms table for DragFormMaster integration with multi-tenancy
export const forms = pgTable("forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  reviewerId: varchar("reviewer_id").references(() => users.id),
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
});

// Relations
export const tenantRelations = relations(tenants, ({ many }) => ({
  users: many(users),
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
}));

export const userRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  refreshTokens: many(refreshTokens),
  forms: many(forms),
  verificationTokens: many(verificationTokens),
  ownedCompanies: many(companies),
  newsletters: many(newsletters),
  campaigns: many(campaigns),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
}));

export const companyRelations = relations(companies, ({ one }) => ({
  tenant: one(tenants, {
    fields: [companies.tenantId],
    references: [tenants.id],
  }),
  owner: one(users, {
    fields: [companies.ownerId],
    references: [users.id],
  }),
}));

export const formRelations = relations(forms, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [forms.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [forms.userId],
    references: [users.id],
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
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const verificationTokenRelations = relations(verificationTokens, ({ one }) => ({
  tenant: one(tenants, {
    fields: [verificationTokens.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [verificationTokens.userId],
    references: [users.id],
  }),
}));

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
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
  manager: one(users, {
    fields: [shops.managerId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({
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

// User management schemas - excludes Owner role from regular user creation
const nonOwnerRoles = ['Administrator', 'Manager', 'Employee'] as const;
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
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(userRoles),
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
export type User = typeof users.$inferSelect;
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

// Company types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type CreateCompanyData = z.infer<typeof createCompanySchema>;
export type UpdateCompanyData = z.infer<typeof updateCompanySchema>;

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

// Email contact schemas
export const createEmailContactSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  status: z.enum(['active', 'unsubscribed', 'bounced', 'pending']).default('active'),
  tags: z.array(z.string()).optional(),
  lists: z.array(z.string()).optional(),
  consentGiven: z.boolean().refine(val => val === true, {
    message: "You must acknowledge consent before adding this contact"
  }),
  consentMethod: z.string().default('manual_add'),
});

export const updateEmailContactSchema = z.object({
  email: z.string().email("Please enter a valid email address").optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  status: z.enum(['active', 'unsubscribed', 'bounced', 'pending']).optional(),
  emailsOpened: z.number().optional(),
  lastActivity: z.date().optional(),
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

// Extended types for email contacts
export interface EmailContactWithDetails extends EmailContact {
  tags: ContactTag[];
  lists: EmailList[];
  activities?: EmailActivity[];
}

export interface EmailListWithCount extends EmailList {
  count: number;
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
  user: one(users, {
    fields: [newsletters.userId],
    references: [users.id],
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
  user: one(users, {
    fields: [campaigns.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [campaigns.reviewerId],
    references: [users.id],
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
}
