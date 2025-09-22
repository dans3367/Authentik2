"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enable2FASchema = exports.changePasswordSchema = exports.resendVerificationSchema = exports.verifyEmailSchema = exports.updateProfileSchema = exports.forgotPasswordSchema = exports.registerOwnerSchema = exports.registerSchema = exports.loginSchema = exports.insertUserSchema = exports.shopRelations = exports.storeRelations = exports.subscriptionPlanRelations = exports.subscriptionRelations = exports.verificationTokenRelations = exports.refreshTokenRelations = exports.formResponseRelations = exports.formRelations = exports.companyRelations = exports.betterAuthUserRelations = exports.tenantRelations = exports.bouncedEmails = exports.emailActivity = exports.campaigns = exports.newsletterTaskStatus = exports.newsletters = exports.formResponses = exports.forms = exports.companies = exports.contactTagAssignments = exports.contactListMemberships = exports.contactTags = exports.emailLists = exports.emailContacts = exports.temp2faSessions = exports.verificationTokens = exports.shopLimitEvents = exports.tenantLimitsRelations = exports.tenantLimits = exports.subscriptions = exports.subscriptionPlans = exports.shops = exports.stores = exports.refreshTokens = exports.tenants = exports.userRoles = exports.betterAuthVerification = exports.betterAuthAccount = exports.betterAuthSession = exports.betterAuthUser = void 0;
exports.insertCampaignSchema = exports.updateCampaignSchema = exports.createCampaignSchema = exports.campaignRelations = exports.insertNewsletterTaskStatusSchema = exports.updateNewsletterTaskStatusSchema = exports.createNewsletterTaskStatusSchema = exports.insertNewsletterSchema = exports.updateNewsletterSchema = exports.createNewsletterSchema = exports.newsletterTaskStatusRelations = exports.newsletterRelations = exports.insertEmailActivitySchema = exports.createEmailActivitySchema = exports.createContactTagSchema = exports.createEmailListSchema = exports.updateEmailContactSchema = exports.createEmailContactSchema = exports.bouncedEmailRelations = exports.emailActivityRelations = exports.contactTagAssignmentRelations = exports.contactListMembershipRelations = exports.contactTagRelations = exports.emailListRelations = exports.emailContactRelations = exports.updateShopSchema = exports.createShopSchema = exports.insertShopSchema = exports.submitFormResponseSchema = exports.updateFormSchema = exports.createFormSchema = exports.updateTenantSchema = exports.createTenantSchema = exports.tenantSchema = exports.createCompanySchema = exports.updateCompanySchema = exports.insertCompanySchema = exports.createStoreSchema = exports.updateStoreSchema = exports.insertStoreSchema = exports.billingInfoSchema = exports.createSubscriptionSchema = exports.subscriptionPlanSchema = exports.userFiltersSchema = exports.updateUserSchema = exports.createUserSchema = exports.nonOwnerRoles = exports.createDeviceSessionSchema = exports.verify2FASchema = exports.disable2FASchema = void 0;
exports.createAppointmentReminderSchema = exports.updateAppointmentSchema = exports.createAppointmentSchema = exports.tenantRelationsUpdated = exports.appointmentReminderRelations = exports.appointmentRelations = exports.appointmentReminders = exports.appointments = exports.insertPromotionSchema = exports.updatePromotionSchema = exports.createPromotionSchema = exports.promotionRelations = exports.promotions = exports.insertBirthdaySettingsSchema = exports.updateBirthdaySettingsSchema = exports.createBirthdaySettingsSchema = exports.birthdaySettingsRelations = exports.insertShopLimitEventSchema = exports.createShopLimitEventSchema = exports.insertTenantLimitsSchema = exports.updateTenantLimitsSchema = exports.createTenantLimitsSchema = exports.birthdaySettings = exports.insertBouncedEmailSchema = exports.updateBouncedEmailSchema = exports.createBouncedEmailSchema = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_2 = require("drizzle-orm");
const drizzle_zod_1 = require("drizzle-zod");
const zod_1 = require("zod");
// Better Auth Tables
exports.betterAuthUser = (0, pg_core_1.pgTable)("better_auth_user", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    emailVerified: (0, pg_core_1.boolean)("email_verified").notNull(),
    image: (0, pg_core_1.text)("image"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull(),
    role: (0, pg_core_1.text)("role").default('Employee').notNull(), // Keep our existing role system
    tenantId: (0, pg_core_1.varchar)("tenant_id").default((0, drizzle_orm_1.sql) `'29c69b4f-3129-4aa4-a475-7bf892e5c5b9'`).notNull(), // Default value for multi-tenancy
    // Additional fields from users table
    firstName: (0, pg_core_1.text)("first_name"),
    lastName: (0, pg_core_1.text)("last_name"),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    twoFactorEnabled: (0, pg_core_1.boolean)("two_factor_enabled").default(false),
    twoFactorSecret: (0, pg_core_1.text)("two_factor_secret"),
    emailVerificationToken: (0, pg_core_1.text)("email_verification_token"),
    emailVerificationExpires: (0, pg_core_1.timestamp)("email_verification_expires"),
    lastVerificationEmailSent: (0, pg_core_1.timestamp)("last_verification_email_sent"),
    lastLoginAt: (0, pg_core_1.timestamp)("last_login_at"), // Track last login for user management
    menuExpanded: (0, pg_core_1.boolean)("menu_expanded").default(false), // New field for menu preference
    theme: (0, pg_core_1.text)("theme").default('light'), // Theme preference: 'light' or 'dark'
    language: (0, pg_core_1.text)("language").default('en'), // Language preference: 'en' or 'es'
    avatarUrl: (0, pg_core_1.text)("avatar_url"), // User avatar URL from Cloudflare R2
    tokenValidAfter: (0, pg_core_1.timestamp)("token_valid_after").defaultNow(), // Tokens issued before this time are invalid
    // Stripe fields for subscription management
    stripeCustomerId: (0, pg_core_1.text)("stripe_customer_id"),
    stripeSubscriptionId: (0, pg_core_1.text)("stripe_subscription_id"),
    subscriptionStatus: (0, pg_core_1.text)("subscription_status").default('inactive'), // active, inactive, canceled, past_due
    subscriptionPlanId: (0, pg_core_1.varchar)("subscription_plan_id"),
    subscriptionStartDate: (0, pg_core_1.timestamp)("subscription_start_date"),
    subscriptionEndDate: (0, pg_core_1.timestamp)("subscription_end_date"),
    trialEndsAt: (0, pg_core_1.timestamp)("trial_ends_at"),
});
exports.betterAuthSession = (0, pg_core_1.pgTable)("better_auth_session", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    token: (0, pg_core_1.text)("token").notNull().unique(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull(),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
    userId: (0, pg_core_1.text)("user_id").notNull().references(() => exports.betterAuthUser.id, { onDelete: 'cascade' }),
});
exports.betterAuthAccount = (0, pg_core_1.pgTable)("better_auth_account", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    accountId: (0, pg_core_1.text)("account_id").notNull(),
    providerId: (0, pg_core_1.text)("provider_id").notNull(),
    userId: (0, pg_core_1.text)("user_id").notNull().references(() => exports.betterAuthUser.id, { onDelete: 'cascade' }),
    accessToken: (0, pg_core_1.text)("access_token"),
    refreshToken: (0, pg_core_1.text)("refresh_token"),
    idToken: (0, pg_core_1.text)("id_token"),
    accessTokenExpiresAt: (0, pg_core_1.timestamp)("access_token_expires_at"),
    refreshTokenExpiresAt: (0, pg_core_1.timestamp)("refresh_token_expires_at"),
    scope: (0, pg_core_1.text)("scope"),
    password: (0, pg_core_1.text)("password"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull(),
});
exports.betterAuthVerification = (0, pg_core_1.pgTable)("better_auth_verification", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    identifier: (0, pg_core_1.text)("identifier").notNull(),
    value: (0, pg_core_1.text)("value").notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").notNull(),
});
// User roles enum
exports.userRoles = ['Owner', 'Administrator', 'Manager', 'Employee'];
// Tenants table for multi-tenancy
exports.tenants = (0, pg_core_1.pgTable)("tenants", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    name: (0, pg_core_1.text)("name").notNull(),
    slug: (0, pg_core_1.text)("slug").notNull().unique(), // URL-friendly identifier
    domain: (0, pg_core_1.text)("domain"), // Custom domain (optional)
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    settings: (0, pg_core_1.text)("settings").default('{}'), // JSON settings
    maxUsers: (0, pg_core_1.integer)("max_users").default(10), // User limit per tenant
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Users table removed - now using better_auth_user table only
exports.refreshTokens = (0, pg_core_1.pgTable)("refresh_tokens", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.betterAuthUser.id, { onDelete: 'cascade' }),
    token: (0, pg_core_1.text)("token").notNull().unique(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    // Device tracking fields
    deviceId: (0, pg_core_1.text)("device_id").default((0, drizzle_orm_1.sql) `gen_random_uuid()`).notNull(), // Unique identifier for the device/session
    deviceName: (0, pg_core_1.text)("device_name"), // User-friendly device name
    userAgent: (0, pg_core_1.text)("user_agent"), // Browser/app user agent
    ipAddress: (0, pg_core_1.text)("ip_address"), // IP address at login
    location: (0, pg_core_1.text)("location"), // Approximate location (optional)
    lastUsed: (0, pg_core_1.timestamp)("last_used").defaultNow(),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
});
// Stores table for multi-tenant shop management
exports.stores = (0, pg_core_1.pgTable)("stores", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.text)("name").notNull(),
    address: (0, pg_core_1.text)("address").notNull(),
    telephone: (0, pg_core_1.text)("telephone").notNull(),
    email: (0, pg_core_1.text)("email").notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Shops table for enhanced multi-tenant shop management
exports.shops = (0, pg_core_1.pgTable)("shops", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description"),
    address: (0, pg_core_1.text)("address"),
    city: (0, pg_core_1.text)("city"),
    state: (0, pg_core_1.text)("state"),
    zipCode: (0, pg_core_1.text)("zip_code"),
    country: (0, pg_core_1.text)("country").notNull().default('United States'),
    phone: (0, pg_core_1.text)("phone").notNull(),
    email: (0, pg_core_1.text)("email").notNull(),
    website: (0, pg_core_1.text)("website"),
    managerId: (0, pg_core_1.varchar)("manager_id").references(() => exports.betterAuthUser.id, { onDelete: 'set null' }),
    operatingHours: (0, pg_core_1.text)("operating_hours"), // JSON string
    status: (0, pg_core_1.text)("status").default('active'), // active, inactive, maintenance
    logoUrl: (0, pg_core_1.text)("logo_url"),
    bannerUrl: (0, pg_core_1.text)("banner_url"),
    category: (0, pg_core_1.text)("category"), // retail, restaurant, service, etc.
    tags: (0, pg_core_1.text)("tags").array(), // Array of tags
    socialMedia: (0, pg_core_1.text)("social_media"), // JSON string of social media links
    settings: (0, pg_core_1.text)("settings"), // JSON string of custom settings
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Subscription plans table
exports.subscriptionPlans = (0, pg_core_1.pgTable)("subscription_plans", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    name: (0, pg_core_1.text)("name").notNull(), // Basic, Pro, Enterprise
    displayName: (0, pg_core_1.text)("display_name").notNull(), // User-friendly name
    description: (0, pg_core_1.text)("description").notNull(),
    price: (0, pg_core_1.decimal)("price", { precision: 10, scale: 2 }).notNull(), // Monthly price
    yearlyPrice: (0, pg_core_1.decimal)("yearly_price", { precision: 10, scale: 2 }), // Yearly price (optional discount)
    stripePriceId: (0, pg_core_1.text)("stripe_price_id").notNull(), // Stripe Price ID for monthly
    stripeYearlyPriceId: (0, pg_core_1.text)("stripe_yearly_price_id"), // Stripe Price ID for yearly
    features: (0, pg_core_1.text)("features").array().notNull(), // Array of feature descriptions
    maxUsers: (0, pg_core_1.integer)("max_users"), // null = unlimited
    maxProjects: (0, pg_core_1.integer)("max_projects"), // null = unlimited
    maxShops: (0, pg_core_1.integer)("max_shops"), // null = unlimited
    storageLimit: (0, pg_core_1.integer)("storage_limit"), // in GB, null = unlimited
    supportLevel: (0, pg_core_1.text)("support_level").default('email'), // email, priority, dedicated
    trialDays: (0, pg_core_1.integer)("trial_days").default(14),
    isPopular: (0, pg_core_1.boolean)("is_popular").default(false),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    sortOrder: (0, pg_core_1.integer)("sort_order").default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// User subscriptions history table
exports.subscriptions = (0, pg_core_1.pgTable)("subscriptions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.betterAuthUser.id, { onDelete: 'cascade' }),
    planId: (0, pg_core_1.varchar)("plan_id").notNull().references(() => exports.subscriptionPlans.id),
    stripeSubscriptionId: (0, pg_core_1.text)("stripe_subscription_id").notNull().unique(),
    stripeCustomerId: (0, pg_core_1.text)("stripe_customer_id").notNull(),
    status: (0, pg_core_1.text)("status").notNull(), // active, canceled, incomplete, past_due, trialing, etc.
    currentPeriodStart: (0, pg_core_1.timestamp)("current_period_start").notNull(),
    currentPeriodEnd: (0, pg_core_1.timestamp)("current_period_end").notNull(),
    trialStart: (0, pg_core_1.timestamp)("trial_start"),
    trialEnd: (0, pg_core_1.timestamp)("trial_end"),
    cancelAtPeriodEnd: (0, pg_core_1.boolean)("cancel_at_period_end").default(false),
    canceledAt: (0, pg_core_1.timestamp)("canceled_at"),
    isYearly: (0, pg_core_1.boolean)("is_yearly").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Tenant-specific limit overrides
exports.tenantLimits = (0, pg_core_1.pgTable)("tenant_limits", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }).unique(),
    maxShops: (0, pg_core_1.integer)("max_shops"), // NULL means use subscription plan limit
    maxUsers: (0, pg_core_1.integer)("max_users"), // NULL means use subscription plan limit
    maxStorageGb: (0, pg_core_1.integer)("max_storage_gb"), // NULL means use subscription plan limit
    customLimits: (0, pg_core_1.text)("custom_limits").default('{}'), // JSON for future extensibility
    overrideReason: (0, pg_core_1.text)("override_reason"), // Why this tenant has custom limits
    createdBy: (0, pg_core_1.varchar)("created_by").references(() => exports.betterAuthUser.id, { onDelete: 'set null' }),
    expiresAt: (0, pg_core_1.timestamp)("expires_at"), // NULL means no expiration
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Relations for tenant limits (used by relational queries with `with:`)
exports.tenantLimitsRelations = (0, drizzle_orm_2.relations)(exports.tenantLimits, ({ one }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.tenantLimits.tenantId],
        references: [exports.tenants.id],
    }),
    createdByUser: one(exports.betterAuthUser, {
        fields: [exports.tenantLimits.createdBy],
        references: [exports.betterAuthUser.id],
    }),
}));
// Shop limit events for audit and analytics
exports.shopLimitEvents = (0, pg_core_1.pgTable)("shop_limit_events", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    eventType: (0, pg_core_1.text)("event_type").notNull(), // 'limit_reached', 'limit_exceeded', 'limit_increased', etc.
    shopCount: (0, pg_core_1.integer)("shop_count").notNull(),
    limitValue: (0, pg_core_1.integer)("limit_value"), // The limit at the time of the event
    subscriptionPlanId: (0, pg_core_1.varchar)("subscription_plan_id").references(() => exports.subscriptionPlans.id, { onDelete: 'set null' }),
    customLimitId: (0, pg_core_1.varchar)("custom_limit_id").references(() => exports.tenantLimits.id, { onDelete: 'set null' }),
    metadata: (0, pg_core_1.text)("metadata").default('{}'), // JSON for additional event data
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// Email verification tokens table (missing from current schema)
exports.verificationTokens = (0, pg_core_1.pgTable)("verification_tokens", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.betterAuthUser.id, { onDelete: 'cascade' }),
    token: (0, pg_core_1.text)("token").notNull().unique(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// Temporary 2FA sessions table for managing 2FA verification flow
exports.temp2faSessions = (0, pg_core_1.pgTable)("temp_2fa_sessions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    sessionToken: (0, pg_core_1.text)("session_token").notNull().unique(), // Better Auth session token
    userId: (0, pg_core_1.text)("user_id").notNull().references(() => exports.betterAuthUser.id, { onDelete: 'cascade' }),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// Email contacts tables for contact management
exports.emailContacts = (0, pg_core_1.pgTable)("email_contacts", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    email: (0, pg_core_1.text)("email").notNull(),
    firstName: (0, pg_core_1.text)("first_name"),
    lastName: (0, pg_core_1.text)("last_name"),
    status: (0, pg_core_1.text)("status").notNull().default('active'), // active, unsubscribed, bounced, pending
    addedDate: (0, pg_core_1.timestamp)("added_date").defaultNow(),
    lastActivity: (0, pg_core_1.timestamp)("last_activity"),
    emailsSent: (0, pg_core_1.integer)("emails_sent").default(0),
    emailsOpened: (0, pg_core_1.integer)("emails_opened").default(0),
    // Birthday tracking fields
    birthday: (0, pg_core_1.text)("birthday"), // Date in YYYY-MM-DD format
    birthdayEmailEnabled: (0, pg_core_1.boolean)("birthday_email_enabled").default(false), // Whether user wants birthday emails
    // Consent tracking fields
    consentGiven: (0, pg_core_1.boolean)("consent_given").notNull().default(false),
    consentDate: (0, pg_core_1.timestamp)("consent_date"),
    consentMethod: (0, pg_core_1.text)("consent_method"), // 'manual_add', 'form_submission', 'import', 'api'
    consentIpAddress: (0, pg_core_1.text)("consent_ip_address"),
    consentUserAgent: (0, pg_core_1.text)("consent_user_agent"),
    addedByUserId: (0, pg_core_1.varchar)("added_by_user_id").references(() => exports.betterAuthUser.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.emailLists = (0, pg_core_1.pgTable)("email_lists", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.contactTags = (0, pg_core_1.pgTable)("contact_tags", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.text)("name").notNull(),
    color: (0, pg_core_1.text)("color").default('#3B82F6'),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// Junction tables for many-to-many relationships
exports.contactListMemberships = (0, pg_core_1.pgTable)("contact_list_memberships", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    contactId: (0, pg_core_1.varchar)("contact_id").notNull().references(() => exports.emailContacts.id, { onDelete: 'cascade' }),
    listId: (0, pg_core_1.varchar)("list_id").notNull().references(() => exports.emailLists.id, { onDelete: 'cascade' }),
    addedAt: (0, pg_core_1.timestamp)("added_at").defaultNow(),
});
exports.contactTagAssignments = (0, pg_core_1.pgTable)("contact_tag_assignments", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    contactId: (0, pg_core_1.varchar)("contact_id").notNull().references(() => exports.emailContacts.id, { onDelete: 'cascade' }),
    tagId: (0, pg_core_1.varchar)("tag_id").notNull().references(() => exports.contactTags.id, { onDelete: 'cascade' }),
    assignedAt: (0, pg_core_1.timestamp)("assigned_at").defaultNow(),
});
// Companies table for multi-tenant company information
exports.companies = (0, pg_core_1.pgTable)("companies", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    ownerId: (0, pg_core_1.varchar)("owner_id").notNull().references(() => exports.betterAuthUser.id, { onDelete: 'cascade' }), // Links to account owner
    name: (0, pg_core_1.text)("name").notNull(),
    address: (0, pg_core_1.text)("address"),
    companyType: (0, pg_core_1.text)("company_type"), // e.g., Corporation, LLC, Partnership, etc.
    companyEmail: (0, pg_core_1.text)("company_email"),
    phone: (0, pg_core_1.text)("phone"),
    website: (0, pg_core_1.text)("website"),
    description: (0, pg_core_1.text)("description"),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Forms table for DragFormMaster integration with multi-tenancy
exports.forms = (0, pg_core_1.pgTable)("forms", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.betterAuthUser.id, { onDelete: 'cascade' }),
    title: (0, pg_core_1.text)("title").notNull(),
    description: (0, pg_core_1.text)("description"),
    formData: (0, pg_core_1.text)("form_data").notNull(), // JSON string of form structure
    theme: (0, pg_core_1.text)("theme").default('modern'),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    isEmbeddable: (0, pg_core_1.boolean)("is_embeddable").default(true), // Allow form to be embedded on external sites
    responseCount: (0, pg_core_1.integer)("response_count").default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Form responses table for storing form submissions
exports.formResponses = (0, pg_core_1.pgTable)("form_responses", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    formId: (0, pg_core_1.varchar)("form_id").notNull().references(() => exports.forms.id, { onDelete: 'cascade' }),
    responseData: (0, pg_core_1.text)("response_data").notNull(), // JSON string of form responses
    submittedAt: (0, pg_core_1.timestamp)("submitted_at").defaultNow(),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    userAgent: (0, pg_core_1.text)("user_agent"),
});
// Newsletters table for newsletter management
exports.newsletters = (0, pg_core_1.pgTable)("newsletters", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.betterAuthUser.id, { onDelete: 'cascade' }),
    title: (0, pg_core_1.text)("title").notNull(),
    subject: (0, pg_core_1.text)("subject").notNull(),
    content: (0, pg_core_1.text)("content").notNull(), // HTML content of the newsletter
    status: (0, pg_core_1.text)("status").notNull().default('draft'), // draft, scheduled, sent
    scheduledAt: (0, pg_core_1.timestamp)("scheduled_at"),
    sentAt: (0, pg_core_1.timestamp)("sent_at"),
    // Customer segmentation fields
    recipientType: (0, pg_core_1.text)("recipient_type").notNull().default('all'), // all, selected, tags
    selectedContactIds: (0, pg_core_1.text)("selected_contact_ids").array(), // Array of contact IDs
    selectedTagIds: (0, pg_core_1.text)("selected_tag_ids").array(), // Array of tag IDs
    recipientCount: (0, pg_core_1.integer)("recipient_count").default(0),
    openCount: (0, pg_core_1.integer)("open_count").default(0),
    uniqueOpenCount: (0, pg_core_1.integer)("unique_open_count").default(0),
    clickCount: (0, pg_core_1.integer)("click_count").default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Newsletter task status for tracking processing stages
exports.newsletterTaskStatus = (0, pg_core_1.pgTable)("newsletter_task_status", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    newsletterId: (0, pg_core_1.varchar)("newsletter_id").notNull().references(() => exports.newsletters.id, { onDelete: 'cascade' }),
    taskType: (0, pg_core_1.text)("task_type").notNull(), // 'validation', 'processing', 'sending', 'analytics'
    taskName: (0, pg_core_1.text)("task_name").notNull(),
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // 'pending', 'running', 'completed', 'failed'
    progress: (0, pg_core_1.integer)("progress").default(0), // 0-100
    startedAt: (0, pg_core_1.timestamp)("started_at"),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
    duration: (0, pg_core_1.integer)("duration"), // Duration in milliseconds
    details: (0, pg_core_1.text)("details"), // Additional status information
    errorMessage: (0, pg_core_1.text)("error_message"), // Error details if failed
    metadata: (0, pg_core_1.text)("metadata"), // JSON string for additional data
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Campaigns table for campaign management
exports.campaigns = (0, pg_core_1.pgTable)("campaigns", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.betterAuthUser.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description"),
    type: (0, pg_core_1.text)("type").notNull().default('email'), // email, sms, push, social
    status: (0, pg_core_1.text)("status").notNull().default('draft'), // draft, active, paused, completed, cancelled
    budget: (0, pg_core_1.decimal)("budget", { precision: 10, scale: 2 }),
    currency: (0, pg_core_1.text)("currency").default('USD'),
    startDate: (0, pg_core_1.timestamp)("start_date"),
    endDate: (0, pg_core_1.timestamp)("end_date"),
    targetAudience: (0, pg_core_1.text)("target_audience"), // JSON string describing target audience
    goals: (0, pg_core_1.text)("goals").array(), // Array of campaign goals
    kpis: (0, pg_core_1.text)("kpis"), // JSON string of key performance indicators
    settings: (0, pg_core_1.text)("settings"), // JSON string of campaign-specific settings
    // Analytics fields
    impressions: (0, pg_core_1.integer)("impressions").default(0),
    clicks: (0, pg_core_1.integer)("clicks").default(0),
    conversions: (0, pg_core_1.integer)("conversions").default(0),
    spent: (0, pg_core_1.decimal)("spent", { precision: 10, scale: 2 }).default('0'),
    // Reviewer approval fields
    requiresReviewerApproval: (0, pg_core_1.boolean)("requires_reviewer_approval").default(false),
    reviewerId: (0, pg_core_1.varchar)("reviewer_id").references(() => exports.betterAuthUser.id),
    reviewStatus: (0, pg_core_1.text)("review_status").default('pending'), // pending, approved, rejected
    reviewedAt: (0, pg_core_1.timestamp)("reviewed_at"),
    reviewNotes: (0, pg_core_1.text)("review_notes"),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Email activity tracking for webhook events
exports.emailActivity = (0, pg_core_1.pgTable)("email_activity", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    contactId: (0, pg_core_1.varchar)("contact_id").notNull().references(() => exports.emailContacts.id, { onDelete: 'cascade' }),
    campaignId: (0, pg_core_1.varchar)("campaign_id").references(() => exports.campaigns.id, { onDelete: 'set null' }),
    newsletterId: (0, pg_core_1.varchar)("newsletter_id").references(() => exports.newsletters.id, { onDelete: 'set null' }),
    activityType: (0, pg_core_1.text)("activity_type").notNull(), // 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed'
    activityData: (0, pg_core_1.text)("activity_data"), // JSON string with additional event data
    userAgent: (0, pg_core_1.text)("user_agent"),
    ipAddress: (0, pg_core_1.text)("ip_address"),
    webhookId: (0, pg_core_1.text)("webhook_id"), // Resend webhook event ID
    webhookData: (0, pg_core_1.text)("webhook_data"), // Full webhook payload for debugging
    occurredAt: (0, pg_core_1.timestamp)("occurred_at").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// Universal bounced emails list - prevents sending to any email that has ever bounced
exports.bouncedEmails = (0, pg_core_1.pgTable)("bounced_emails", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    email: (0, pg_core_1.text)("email").notNull().unique(), // The bounced email address
    bounceType: (0, pg_core_1.text)("bounce_type").notNull().default('hard'), // 'hard', 'soft', 'complaint'
    bounceReason: (0, pg_core_1.text)("bounce_reason"), // Detailed reason for the bounce
    bounceSubType: (0, pg_core_1.text)("bounce_sub_type"), // More specific bounce classification
    firstBouncedAt: (0, pg_core_1.timestamp)("first_bounced_at").notNull(), // When this email first bounced
    lastBouncedAt: (0, pg_core_1.timestamp)("last_bounced_at").notNull(), // Most recent bounce
    bounceCount: (0, pg_core_1.integer)("bounce_count").default(1), // Number of times this email has bounced
    // Source information
    sourceTenantId: (0, pg_core_1.varchar)("source_tenant_id").references(() => exports.tenants.id), // Tenant where first bounce occurred
    sourceNewsletterId: (0, pg_core_1.varchar)("source_newsletter_id").references(() => exports.newsletters.id), // Newsletter that caused first bounce
    sourceCampaignId: (0, pg_core_1.varchar)("source_campaign_id").references(() => exports.campaigns.id), // Campaign that caused first bounce
    // Webhook information
    webhookId: (0, pg_core_1.text)("webhook_id"), // Resend webhook event ID that triggered this
    webhookData: (0, pg_core_1.text)("webhook_data"), // Full webhook payload for debugging
    // Status tracking
    isActive: (0, pg_core_1.boolean)("is_active").default(true), // Whether this bounce is still active
    suppressionReason: (0, pg_core_1.text)("suppression_reason"), // Why this email is suppressed
    lastAttemptedAt: (0, pg_core_1.timestamp)("last_attempted_at"), // Last time we tried to send to this email
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Relations
exports.tenantRelations = (0, drizzle_orm_2.relations)(exports.tenants, ({ many }) => ({
    users: many(exports.betterAuthUser),
    stores: many(exports.stores),
    shops: many(exports.shops),
    forms: many(exports.forms),
    refreshTokens: many(exports.refreshTokens),
    verificationTokens: many(exports.verificationTokens),
    formResponses: many(exports.formResponses),
    emailContacts: many(exports.emailContacts),
    emailLists: many(exports.emailLists),
    contactTags: many(exports.contactTags),
    contactListMemberships: many(exports.contactListMemberships),
    contactTagAssignments: many(exports.contactTagAssignments),
    newsletters: many(exports.newsletters),
    campaigns: many(exports.campaigns),
    emailActivities: many(exports.emailActivity),
    bouncedEmails: many(exports.bouncedEmails),
    birthdaySettings: many(exports.birthdaySettings),
}));
exports.betterAuthUserRelations = (0, drizzle_orm_2.relations)(exports.betterAuthUser, ({ one, many }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.betterAuthUser.tenantId],
        references: [exports.tenants.id],
    }),
    refreshTokens: many(exports.refreshTokens),
    forms: many(exports.forms),
    verificationTokens: many(exports.verificationTokens),
    ownedCompanies: many(exports.companies),
    newsletters: many(exports.newsletters),
    campaigns: many(exports.campaigns),
    managedShops: many(exports.shops),
    subscription: one(exports.subscriptions, {
        fields: [exports.betterAuthUser.id],
        references: [exports.subscriptions.userId],
    }),
}));
exports.companyRelations = (0, drizzle_orm_2.relations)(exports.companies, ({ one }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.companies.tenantId],
        references: [exports.tenants.id],
    }),
    owner: one(exports.betterAuthUser, {
        fields: [exports.companies.ownerId],
        references: [exports.betterAuthUser.id],
    }),
}));
exports.formRelations = (0, drizzle_orm_2.relations)(exports.forms, ({ one, many }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.forms.tenantId],
        references: [exports.tenants.id],
    }),
    user: one(exports.betterAuthUser, {
        fields: [exports.forms.userId],
        references: [exports.betterAuthUser.id],
    }),
    responses: many(exports.formResponses),
}));
exports.formResponseRelations = (0, drizzle_orm_2.relations)(exports.formResponses, ({ one }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.formResponses.tenantId],
        references: [exports.tenants.id],
    }),
    form: one(exports.forms, {
        fields: [exports.formResponses.formId],
        references: [exports.forms.id],
    }),
}));
exports.refreshTokenRelations = (0, drizzle_orm_2.relations)(exports.refreshTokens, ({ one }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.refreshTokens.tenantId],
        references: [exports.tenants.id],
    }),
    user: one(exports.betterAuthUser, {
        fields: [exports.refreshTokens.userId],
        references: [exports.betterAuthUser.id],
    }),
}));
exports.verificationTokenRelations = (0, drizzle_orm_2.relations)(exports.verificationTokens, ({ one }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.verificationTokens.tenantId],
        references: [exports.tenants.id],
    }),
    user: one(exports.betterAuthUser, {
        fields: [exports.verificationTokens.userId],
        references: [exports.betterAuthUser.id],
    }),
}));
exports.subscriptionRelations = (0, drizzle_orm_2.relations)(exports.subscriptions, ({ one }) => ({
    user: one(exports.betterAuthUser, {
        fields: [exports.subscriptions.userId],
        references: [exports.betterAuthUser.id],
    }),
    plan: one(exports.subscriptionPlans, {
        fields: [exports.subscriptions.planId],
        references: [exports.subscriptionPlans.id],
    }),
}));
exports.subscriptionPlanRelations = (0, drizzle_orm_2.relations)(exports.subscriptionPlans, ({ many }) => ({
    subscriptions: many(exports.subscriptions),
}));
exports.storeRelations = (0, drizzle_orm_2.relations)(exports.stores, ({ one }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.stores.tenantId],
        references: [exports.tenants.id],
    }),
}));
exports.shopRelations = (0, drizzle_orm_2.relations)(exports.shops, ({ one }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.shops.tenantId],
        references: [exports.tenants.id],
    }),
    manager: one(exports.betterAuthUser, {
        fields: [exports.shops.managerId],
        references: [exports.betterAuthUser.id],
    }),
}));
exports.insertUserSchema = (0, drizzle_zod_1.createInsertSchema)(exports.betterAuthUser).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Please enter a valid email address"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
    twoFactorToken: zod_1.z.string().optional(),
    rememberMe: zod_1.z.boolean().optional().default(false),
});
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email("Please enter a valid email address"),
    password: zod_1.z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[0-9]/, "Password must contain at least one number"),
    firstName: zod_1.z.string().min(1, "First name is required"),
    lastName: zod_1.z.string().min(1, "Last name is required"),
    confirmPassword: zod_1.z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});
// Owner registration schema - includes organization details
exports.registerOwnerSchema = zod_1.z.object({
    email: zod_1.z.string().email("Please enter a valid email address"),
    password: zod_1.z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: zod_1.z.string(),
    firstName: zod_1.z.string().min(1, "First name is required"),
    lastName: zod_1.z.string().min(1, "Last name is required"),
    organizationName: zod_1.z.string().min(1, "Organization name is required"),
    organizationSlug: zod_1.z.string()
        .min(1, "Organization identifier is required")
        .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens allowed")
        .max(50, "Organization identifier must be 50 characters or less"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email("Please enter a valid email address"),
});
exports.updateProfileSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, "First name is required"),
    lastName: zod_1.z.string().min(1, "Last name is required"),
    email: zod_1.z.string().email("Please enter a valid email address"),
    theme: zod_1.z.enum(['light', 'dark']).optional(),
    language: zod_1.z.enum(['en', 'es']).optional(),
});
exports.verifyEmailSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, "Verification token is required"),
});
exports.resendVerificationSchema = zod_1.z.object({
    email: zod_1.z.string().email("Please enter a valid email address"),
});
exports.changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, "Current password is required"),
    newPassword: zod_1.z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: zod_1.z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});
exports.enable2FASchema = zod_1.z.object({
    token: zod_1.z.string().min(6, "Please enter a 6-digit code").max(6, "Please enter a 6-digit code"),
});
exports.disable2FASchema = zod_1.z.object({
    token: zod_1.z.string().min(6, "Please enter a 6-digit code").max(6, "Please enter a 6-digit code"),
});
exports.verify2FASchema = zod_1.z.object({
    token: zod_1.z.string().min(6, "Please enter a 6-digit code").max(6, "Please enter a 6-digit code"),
});
// Device session management schemas
exports.createDeviceSessionSchema = zod_1.z.object({
    deviceName: zod_1.z.string().optional(),
    userAgent: zod_1.z.string().optional(),
    ipAddress: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
});
// User management schemas - excludes Owner role from regular user creation/editing
const nonOwnerRoles = ['Administrator', 'Manager', 'Employee'];
exports.nonOwnerRoles = nonOwnerRoles;
exports.createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email("Please enter a valid email address"),
    firstName: zod_1.z.string().min(1, "First name is required"),
    lastName: zod_1.z.string().min(1, "Last name is required"),
    role: zod_1.z.enum(nonOwnerRoles).default('Employee'),
    password: zod_1.z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: zod_1.z.string(),
    emailVerified: zod_1.z.boolean().default(true),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});
exports.updateUserSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, "First name is required"),
    lastName: zod_1.z.string().min(1, "Last name is required"),
    email: zod_1.z.string().email("Please enter a valid email address"),
    role: zod_1.z.enum(nonOwnerRoles),
    isActive: zod_1.z.boolean(),
});
exports.userFiltersSchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    role: zod_1.z.enum(exports.userRoles).optional(),
    status: zod_1.z.enum(['active', 'inactive']).optional(),
    showInactive: zod_1.z.preprocess((val) => {
        if (typeof val === 'string') {
            return val === 'true';
        }
        return val;
    }, zod_1.z.boolean()).default(false),
});
// Subscription schemas
exports.subscriptionPlanSchema = (0, drizzle_zod_1.createInsertSchema)(exports.subscriptionPlans);
exports.createSubscriptionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.subscriptions).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Billing schemas
exports.billingInfoSchema = zod_1.z.object({
    planId: zod_1.z.string(),
    billingCycle: zod_1.z.enum(['monthly', 'yearly']),
    paymentMethodId: zod_1.z.string().optional(),
});
// Store schemas
exports.insertStoreSchema = (0, drizzle_zod_1.createInsertSchema)(exports.stores).omit({
    id: true,
    tenantId: true,
    createdAt: true,
    updatedAt: true,
});
exports.updateStoreSchema = exports.insertStoreSchema.partial();
exports.createStoreSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Store name is required"),
    address: zod_1.z.string().min(1, "Address is required"),
    telephone: zod_1.z.string().min(1, "Telephone is required"),
    email: zod_1.z.string().email("Please enter a valid email address"),
});
// Company schemas
exports.insertCompanySchema = (0, drizzle_zod_1.createInsertSchema)(exports.companies).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.updateCompanySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Company name is required"),
    address: zod_1.z.string().optional(),
    companyType: zod_1.z.string().optional(),
    companyEmail: zod_1.z.string().email("Please enter a valid email address").optional().or(zod_1.z.literal("")),
    phone: zod_1.z.string().optional(),
    website: zod_1.z.string().url("Please enter a valid website URL").optional().or(zod_1.z.literal("")),
    description: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().default(true),
});
exports.createCompanySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Company name is required"),
    address: zod_1.z.string().optional(),
    companyType: zod_1.z.string().optional(),
    companyEmail: zod_1.z.string().email("Please enter a valid email address").optional().or(zod_1.z.literal("")),
    phone: zod_1.z.string().optional(),
    website: zod_1.z.string().url("Please enter a valid website URL").optional().or(zod_1.z.literal("")),
    description: zod_1.z.string().optional(),
});
// Multi-tenancy schemas and types
exports.tenantSchema = (0, drizzle_zod_1.createInsertSchema)(exports.tenants).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.createTenantSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Organization name is required"),
    slug: zod_1.z.string().min(1, "Organization identifier is required").regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens allowed"),
    domain: zod_1.z.string().optional(),
    maxUsers: zod_1.z.number().default(10),
});
exports.updateTenantSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Organization name is required"),
    domain: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean(),
    maxUsers: zod_1.z.number().min(1),
});
// Form schemas
exports.createFormSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Form title is required"),
    description: zod_1.z.string().optional(),
    formData: zod_1.z.string().min(1, "Form structure is required"),
    theme: zod_1.z.string().default('modern'),
    isEmbeddable: zod_1.z.boolean().default(true),
});
exports.updateFormSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Form title is required"),
    description: zod_1.z.string().optional(),
    formData: zod_1.z.string().min(1, "Form structure is required"),
    theme: zod_1.z.string(),
    isActive: zod_1.z.boolean(),
    isEmbeddable: zod_1.z.boolean(),
});
exports.submitFormResponseSchema = zod_1.z.object({
    formId: zod_1.z.string(),
    responseData: zod_1.z.string(),
    ipAddress: zod_1.z.string().optional(),
    userAgent: zod_1.z.string().optional(),
});
// Shop schemas
exports.insertShopSchema = (0, drizzle_zod_1.createInsertSchema)(exports.shops).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.createShopSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Shop name is required"),
    description: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    zipCode: zod_1.z.string().optional(),
    country: zod_1.z.string().default('United States'),
    phone: zod_1.z.string().min(1, "Phone is required"),
    email: zod_1.z.string().email("Please enter a valid email address"),
    website: zod_1.z.string().url("Please enter a valid website URL").optional().or(zod_1.z.literal("")),
    managerId: zod_1.z.string().optional().nullable(),
    operatingHours: zod_1.z.string().optional(),
    status: zod_1.z.enum(['active', 'inactive', 'maintenance']).default('active'),
    category: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    socialMedia: zod_1.z.string().optional(),
    settings: zod_1.z.string().optional(),
});
exports.updateShopSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Shop name is required"),
    description: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    zipCode: zod_1.z.string().optional(),
    country: zod_1.z.string(),
    phone: zod_1.z.string().min(1, "Phone is required"),
    email: zod_1.z.string().email("Please enter a valid email address"),
    website: zod_1.z.string().url("Please enter a valid website URL").optional().or(zod_1.z.literal("")),
    managerId: zod_1.z.string().optional().nullable(),
    operatingHours: zod_1.z.string().optional(),
    status: zod_1.z.enum(['active', 'inactive', 'maintenance']),
    category: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    socialMedia: zod_1.z.string().optional(),
    settings: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean(),
});
// Email contact relations
exports.emailContactRelations = (0, drizzle_orm_2.relations)(exports.emailContacts, ({ one, many }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.emailContacts.tenantId],
        references: [exports.tenants.id],
    }),
    listMemberships: many(exports.contactListMemberships),
    tagAssignments: many(exports.contactTagAssignments),
    activities: many(exports.emailActivity),
}));
exports.emailListRelations = (0, drizzle_orm_2.relations)(exports.emailLists, ({ one, many }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.emailLists.tenantId],
        references: [exports.tenants.id],
    }),
    memberships: many(exports.contactListMemberships),
}));
exports.contactTagRelations = (0, drizzle_orm_2.relations)(exports.contactTags, ({ one, many }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.contactTags.tenantId],
        references: [exports.tenants.id],
    }),
    assignments: many(exports.contactTagAssignments),
}));
exports.contactListMembershipRelations = (0, drizzle_orm_2.relations)(exports.contactListMemberships, ({ one }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.contactListMemberships.tenantId],
        references: [exports.tenants.id],
    }),
    contact: one(exports.emailContacts, {
        fields: [exports.contactListMemberships.contactId],
        references: [exports.emailContacts.id],
    }),
    list: one(exports.emailLists, {
        fields: [exports.contactListMemberships.listId],
        references: [exports.emailLists.id],
    }),
}));
exports.contactTagAssignmentRelations = (0, drizzle_orm_2.relations)(exports.contactTagAssignments, ({ one }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.contactTagAssignments.tenantId],
        references: [exports.tenants.id],
    }),
    contact: one(exports.emailContacts, {
        fields: [exports.contactTagAssignments.contactId],
        references: [exports.emailContacts.id],
    }),
    tag: one(exports.contactTags, {
        fields: [exports.contactTagAssignments.tagId],
        references: [exports.contactTags.id],
    }),
}));
exports.emailActivityRelations = (0, drizzle_orm_2.relations)(exports.emailActivity, ({ one }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.emailActivity.tenantId],
        references: [exports.tenants.id],
    }),
    contact: one(exports.emailContacts, {
        fields: [exports.emailActivity.contactId],
        references: [exports.emailContacts.id],
    }),
    campaign: one(exports.campaigns, {
        fields: [exports.emailActivity.campaignId],
        references: [exports.campaigns.id],
    }),
    newsletter: one(exports.newsletters, {
        fields: [exports.emailActivity.newsletterId],
        references: [exports.newsletters.id],
    }),
}));
exports.bouncedEmailRelations = (0, drizzle_orm_2.relations)(exports.bouncedEmails, ({ one }) => ({
    sourceTenant: one(exports.tenants, {
        fields: [exports.bouncedEmails.sourceTenantId],
        references: [exports.tenants.id],
    }),
    sourceNewsletter: one(exports.newsletters, {
        fields: [exports.bouncedEmails.sourceNewsletterId],
        references: [exports.newsletters.id],
    }),
    sourceCampaign: one(exports.campaigns, {
        fields: [exports.bouncedEmails.sourceCampaignId],
        references: [exports.campaigns.id],
    }),
}));
// Email contact schemas
exports.createEmailContactSchema = zod_1.z.object({
    email: zod_1.z.string().email("Please enter a valid email address"),
    firstName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
    status: zod_1.z.enum(['active', 'unsubscribed', 'bounced', 'pending']).default('active'),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    lists: zod_1.z.array(zod_1.z.string()).optional(),
    birthday: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Birthday must be in YYYY-MM-DD format").optional(),
    birthdayEmailEnabled: zod_1.z.boolean().default(false),
    consentGiven: zod_1.z.boolean().refine(val => val === true, {
        message: "You must acknowledge consent before adding this contact"
    }),
    consentMethod: zod_1.z.string().default('manual_add'),
});
exports.updateEmailContactSchema = zod_1.z.object({
    email: zod_1.z.string().email("Please enter a valid email address").optional(),
    firstName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
    status: zod_1.z.enum(['active', 'unsubscribed', 'bounced', 'pending']).optional(),
    emailsOpened: zod_1.z.number().optional(),
    lastActivity: zod_1.z.date().optional(),
    birthday: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Birthday must be in YYYY-MM-DD format").optional(),
    birthdayEmailEnabled: zod_1.z.boolean().optional(),
});
exports.createEmailListSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "List name is required"),
    description: zod_1.z.string().optional(),
});
exports.createContactTagSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Tag name is required"),
    color: zod_1.z.string().default('#3B82F6'),
});
// Email activity types and schemas
exports.createEmailActivitySchema = zod_1.z.object({
    contactId: zod_1.z.string().uuid(),
    campaignId: zod_1.z.string().uuid().optional(),
    newsletterId: zod_1.z.string().uuid().optional(),
    activityType: zod_1.z.enum(['sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed']),
    activityData: zod_1.z.string().optional(),
    userAgent: zod_1.z.string().optional(),
    ipAddress: zod_1.z.string().optional(),
    webhookId: zod_1.z.string().optional(),
    webhookData: zod_1.z.string().optional(),
    occurredAt: zod_1.z.date(),
});
exports.insertEmailActivitySchema = (0, drizzle_zod_1.createInsertSchema)(exports.emailActivity).omit({
    id: true,
    tenantId: true,
    createdAt: true,
});
// Newsletter relations
exports.newsletterRelations = (0, drizzle_orm_2.relations)(exports.newsletters, ({ one, many }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.newsletters.tenantId],
        references: [exports.tenants.id],
    }),
    user: one(exports.betterAuthUser, {
        fields: [exports.newsletters.userId],
        references: [exports.betterAuthUser.id],
    }),
    taskStatuses: many(exports.newsletterTaskStatus),
}));
exports.newsletterTaskStatusRelations = (0, drizzle_orm_2.relations)(exports.newsletterTaskStatus, ({ one }) => ({
    newsletter: one(exports.newsletters, {
        fields: [exports.newsletterTaskStatus.newsletterId],
        references: [exports.newsletters.id],
    }),
    tenant: one(exports.tenants, {
        fields: [exports.newsletterTaskStatus.tenantId],
        references: [exports.tenants.id],
    }),
}));
// Newsletter schemas
exports.createNewsletterSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required"),
    subject: zod_1.z.string().min(1, "Subject is required"),
    content: zod_1.z.string().min(1, "Content is required"),
    // On create, disallow setting status to "sent"; use the send endpoint instead
    status: zod_1.z.enum(['draft', 'scheduled']).default('draft'),
    scheduledAt: zod_1.z.date().optional(),
    recipientType: zod_1.z.enum(['all', 'selected', 'tags']).default('all'),
    selectedContactIds: zod_1.z.array(zod_1.z.string()).optional(),
    selectedTagIds: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.updateNewsletterSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required").optional(),
    subject: zod_1.z.string().min(1, "Subject is required").optional(),
    content: zod_1.z.string().min(1, "Content is required").optional(),
    status: zod_1.z.enum(['draft', 'scheduled', 'sent']).optional(),
    scheduledAt: zod_1.z.date().optional(),
    sentAt: zod_1.z.date().optional(),
    recipientType: zod_1.z.enum(['all', 'selected', 'tags']).optional(),
    selectedContactIds: zod_1.z.array(zod_1.z.string()).optional(),
    selectedTagIds: zod_1.z.array(zod_1.z.string()).optional(),
    recipientCount: zod_1.z.number().int().nonnegative().optional(),
    openCount: zod_1.z.number().int().nonnegative().optional(),
    uniqueOpenCount: zod_1.z.number().int().nonnegative().optional(),
    clickCount: zod_1.z.number().int().nonnegative().optional(),
});
exports.insertNewsletterSchema = (0, drizzle_zod_1.createInsertSchema)(exports.newsletters).omit({
    id: true,
    tenantId: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
});
// Newsletter Task Status schemas
exports.createNewsletterTaskStatusSchema = zod_1.z.object({
    taskType: zod_1.z.enum(['validation', 'processing', 'sending', 'analytics']),
    taskName: zod_1.z.string().min(1, "Task name is required"),
    status: zod_1.z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
    progress: zod_1.z.number().int().min(0).max(100).default(0),
    details: zod_1.z.string().optional(),
    errorMessage: zod_1.z.string().optional(),
    metadata: zod_1.z.string().optional(),
});
exports.updateNewsletterTaskStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'running', 'completed', 'failed']).optional(),
    progress: zod_1.z.number().int().min(0).max(100).optional(),
    startedAt: zod_1.z.date().optional(),
    completedAt: zod_1.z.date().optional(),
    duration: zod_1.z.number().int().nonnegative().optional(),
    details: zod_1.z.string().optional(),
    errorMessage: zod_1.z.string().optional(),
    metadata: zod_1.z.string().optional(),
});
exports.insertNewsletterTaskStatusSchema = (0, drizzle_zod_1.createInsertSchema)(exports.newsletterTaskStatus).omit({
    id: true,
    tenantId: true,
    newsletterId: true,
    createdAt: true,
    updatedAt: true,
});
// Campaign relations
exports.campaignRelations = (0, drizzle_orm_2.relations)(exports.campaigns, ({ one }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.campaigns.tenantId],
        references: [exports.tenants.id],
    }),
    user: one(exports.betterAuthUser, {
        fields: [exports.campaigns.userId],
        references: [exports.betterAuthUser.id],
    }),
    reviewer: one(exports.betterAuthUser, {
        fields: [exports.campaigns.reviewerId],
        references: [exports.betterAuthUser.id],
    }),
}));
// Campaign schemas
exports.createCampaignSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Campaign name is required"),
    description: zod_1.z.string().optional(),
    type: zod_1.z.enum(['email', 'sms', 'push', 'social']).default('email'),
    status: zod_1.z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']).default('draft'),
    budget: zod_1.z.number().positive("Budget must be positive").optional(),
    currency: zod_1.z.string().default('USD'),
    startDate: zod_1.z.date().optional(),
    endDate: zod_1.z.date().optional(),
    targetAudience: zod_1.z.string().optional(),
    goals: zod_1.z.array(zod_1.z.string()).optional(),
    kpis: zod_1.z.string().optional(),
    settings: zod_1.z.string().optional(),
    requiresReviewerApproval: zod_1.z.boolean().default(false),
    reviewerId: zod_1.z.string().optional(),
});
exports.updateCampaignSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Campaign name is required").optional(),
    description: zod_1.z.string().optional(),
    type: zod_1.z.enum(['email', 'sms', 'push', 'social']).optional(),
    status: zod_1.z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']).optional(),
    budget: zod_1.z.number().positive("Budget must be positive").optional(),
    currency: zod_1.z.string().optional(),
    startDate: zod_1.z.date().optional(),
    endDate: zod_1.z.date().optional(),
    targetAudience: zod_1.z.string().optional(),
    goals: zod_1.z.array(zod_1.z.string()).optional(),
    kpis: zod_1.z.string().optional(),
    settings: zod_1.z.string().optional(),
    requiresReviewerApproval: zod_1.z.boolean().optional(),
    reviewerId: zod_1.z.string().optional(),
    reviewStatus: zod_1.z.enum(['pending', 'approved', 'rejected']).optional(),
    reviewNotes: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.insertCampaignSchema = (0, drizzle_zod_1.createInsertSchema)(exports.campaigns).omit({
    id: true,
    tenantId: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
});
// Bounced emails schemas
exports.createBouncedEmailSchema = zod_1.z.object({
    email: zod_1.z.string().email("Please enter a valid email address"),
    bounceType: zod_1.z.enum(['hard', 'soft', 'complaint']).default('hard'),
    bounceReason: zod_1.z.string().optional(),
    bounceSubType: zod_1.z.string().optional(),
    firstBouncedAt: zod_1.z.date(),
    lastBouncedAt: zod_1.z.date(),
    bounceCount: zod_1.z.number().int().positive().default(1),
    sourceTenantId: zod_1.z.string().uuid().optional(),
    sourceNewsletterId: zod_1.z.string().uuid().optional(),
    sourceCampaignId: zod_1.z.string().uuid().optional(),
    webhookId: zod_1.z.string().optional(),
    webhookData: zod_1.z.string().optional(),
    suppressionReason: zod_1.z.string().optional(),
    lastAttemptedAt: zod_1.z.date().optional(),
});
exports.updateBouncedEmailSchema = zod_1.z.object({
    bounceType: zod_1.z.enum(['hard', 'soft', 'complaint']).optional(),
    bounceReason: zod_1.z.string().optional(),
    bounceSubType: zod_1.z.string().optional(),
    lastBouncedAt: zod_1.z.date().optional(),
    bounceCount: zod_1.z.number().int().positive().optional(),
    isActive: zod_1.z.boolean().optional(),
    suppressionReason: zod_1.z.string().optional(),
    lastAttemptedAt: zod_1.z.date().optional(),
});
exports.insertBouncedEmailSchema = (0, drizzle_zod_1.createInsertSchema)(exports.bouncedEmails).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
// Birthday settings table for managing birthday email campaigns
exports.birthdaySettings = (0, pg_core_1.pgTable)("birthday_settings", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    enabled: (0, pg_core_1.boolean)("enabled").default(false),
    sendDaysBefore: (0, pg_core_1.integer)("send_days_before").default(0), // How many days before birthday to send
    emailTemplate: (0, pg_core_1.text)("email_template").default('default'), // Email template to use
    segmentFilter: (0, pg_core_1.text)("segment_filter").default('all'), // Which contacts to include
    customMessage: (0, pg_core_1.text)("custom_message").default(''), // Custom birthday message
    customThemeData: (0, pg_core_1.text)("custom_theme_data"), // JSON data for custom theme
    senderName: (0, pg_core_1.text)("sender_name").default(''),
    senderEmail: (0, pg_core_1.text)("sender_email").default(''),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Tenant Limits schemas and types
exports.createTenantLimitsSchema = zod_1.z.object({
    maxShops: zod_1.z.number().int().positive().optional(),
    maxUsers: zod_1.z.number().int().positive().optional(),
    maxStorageGb: zod_1.z.number().int().positive().optional(),
    customLimits: zod_1.z.string().default('{}'),
    overrideReason: zod_1.z.string().optional(),
    expiresAt: zod_1.z.date().optional(),
});
exports.updateTenantLimitsSchema = zod_1.z.object({
    maxShops: zod_1.z.number().int().positive().optional(),
    maxUsers: zod_1.z.number().int().positive().optional(),
    maxStorageGb: zod_1.z.number().int().positive().optional(),
    customLimits: zod_1.z.string().optional(),
    overrideReason: zod_1.z.string().optional(),
    expiresAt: zod_1.z.date().optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.insertTenantLimitsSchema = (0, drizzle_zod_1.createInsertSchema)(exports.tenantLimits).omit({
    id: true,
    tenantId: true,
    createdBy: true,
    createdAt: true,
    updatedAt: true,
});
// Shop Limit Events schemas and types
exports.createShopLimitEventSchema = zod_1.z.object({
    eventType: zod_1.z.enum(['limit_reached', 'limit_exceeded', 'limit_increased', 'limit_decreased', 'shop_created', 'shop_deleted']),
    shopCount: zod_1.z.number().int().nonnegative(),
    limitValue: zod_1.z.number().int().positive().optional(),
    subscriptionPlanId: zod_1.z.string().uuid().optional(),
    customLimitId: zod_1.z.string().uuid().optional(),
    metadata: zod_1.z.string().default('{}'),
});
exports.insertShopLimitEventSchema = (0, drizzle_zod_1.createInsertSchema)(exports.shopLimitEvents).omit({
    id: true,
    tenantId: true,
    createdAt: true,
});
// Birthday settings relations
exports.birthdaySettingsRelations = (0, drizzle_orm_2.relations)(exports.birthdaySettings, ({ one }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.birthdaySettings.tenantId],
        references: [exports.tenants.id],
    }),
}));
// Birthday settings schemas
exports.createBirthdaySettingsSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    sendDaysBefore: zod_1.z.number().int().min(0).max(30).default(0),
    emailTemplate: zod_1.z.string().default('default'),
    segmentFilter: zod_1.z.string().default('all'),
    customMessage: zod_1.z.string().default(''),
    senderName: zod_1.z.string().default(''),
    senderEmail: zod_1.z.string().email("Please enter a valid email address").default(''),
});
exports.updateBirthdaySettingsSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().optional(),
    sendDaysBefore: zod_1.z.number().int().min(0).max(30).optional(),
    emailTemplate: zod_1.z.string().optional(),
    segmentFilter: zod_1.z.string().optional(),
    customMessage: zod_1.z.string().optional(),
    senderName: zod_1.z.string().optional(),
    senderEmail: zod_1.z.string().email("Please enter a valid email address").optional(),
});
exports.insertBirthdaySettingsSchema = (0, drizzle_zod_1.createInsertSchema)(exports.birthdaySettings).omit({
    id: true,
    tenantId: true,
    createdAt: true,
    updatedAt: true,
});
// Promotions table for managing promotional content templates
exports.promotions = (0, pg_core_1.pgTable)("promotions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.betterAuthUser.id, { onDelete: 'cascade' }),
    title: (0, pg_core_1.text)("title").notNull(),
    description: (0, pg_core_1.text)("description"),
    content: (0, pg_core_1.text)("content").notNull(), // HTML content of the promotion
    type: (0, pg_core_1.text)("type").notNull().default('newsletter'), // newsletter, survey, birthday, announcement, sale, event
    targetAudience: (0, pg_core_1.text)("target_audience").notNull().default('all'), // all, subscribers, customers, prospects, vip
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    usageCount: (0, pg_core_1.integer)("usage_count").default(0), // Track how many times this promotion has been used
    maxUses: (0, pg_core_1.integer)("max_uses"), // Maximum times this promotion can be used (null = unlimited)
    validFrom: (0, pg_core_1.timestamp)("valid_from"), // Promotion becomes available from this date
    validTo: (0, pg_core_1.timestamp)("valid_to"), // Promotion expires after this date
    promotionalCodes: (0, pg_core_1.text)("promotional_codes"), // JSON array of promotional codes
    metadata: (0, pg_core_1.text)("metadata"), // JSON string for additional settings
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Promotion relations
exports.promotionRelations = (0, drizzle_orm_2.relations)(exports.promotions, ({ one }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.promotions.tenantId],
        references: [exports.tenants.id],
    }),
    user: one(exports.betterAuthUser, {
        fields: [exports.promotions.userId],
        references: [exports.betterAuthUser.id],
    }),
}));
// Promotion schemas
exports.createPromotionSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required"),
    description: zod_1.z.string().optional(),
    content: zod_1.z.string().min(1, "Content is required"),
    type: zod_1.z.enum(['newsletter', 'survey', 'birthday', 'announcement', 'sale', 'event']).default('newsletter'),
    targetAudience: zod_1.z.enum(['all', 'subscribers', 'customers', 'prospects', 'vip']).default('all'),
    isActive: zod_1.z.boolean().default(true),
    maxUses: zod_1.z.number().int().positive().optional(),
    validFrom: zod_1.z.date().optional(),
    validTo: zod_1.z.date().optional(),
    promotionalCodes: zod_1.z.array(zod_1.z.string()).optional(),
    metadata: zod_1.z.string().optional(),
});
exports.updatePromotionSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required").optional(),
    description: zod_1.z.string().optional(),
    content: zod_1.z.string().min(1, "Content is required").optional(),
    type: zod_1.z.enum(['newsletter', 'survey', 'birthday', 'announcement', 'sale', 'event']).optional(),
    targetAudience: zod_1.z.enum(['all', 'subscribers', 'customers', 'prospects', 'vip']).optional(),
    isActive: zod_1.z.boolean().optional(),
    maxUses: zod_1.z.number().int().positive().optional(),
    validFrom: zod_1.z.date().optional(),
    validTo: zod_1.z.date().optional(),
    promotionalCodes: zod_1.z.array(zod_1.z.string()).optional(),
    metadata: zod_1.z.string().optional(),
});
exports.insertPromotionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.promotions).omit({
    id: true,
    tenantId: true,
    userId: true,
    usageCount: true,
    createdAt: true,
    updatedAt: true,
});
// Appointments table for managing appointments and reminders
exports.appointments = (0, pg_core_1.pgTable)("appointments", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    customerId: (0, pg_core_1.varchar)("customer_id").notNull().references(() => exports.emailContacts.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.betterAuthUser.id, { onDelete: 'cascade' }), // Who created the appointment
    title: (0, pg_core_1.text)("title").notNull(),
    description: (0, pg_core_1.text)("description"),
    appointmentDate: (0, pg_core_1.timestamp)("appointment_date").notNull(),
    duration: (0, pg_core_1.integer)("duration").default(60), // Duration in minutes
    location: (0, pg_core_1.text)("location"),
    serviceType: (0, pg_core_1.text)("service_type"), // e.g., "consultation", "meeting", "service"
    status: (0, pg_core_1.text)("status").notNull().default('scheduled'), // scheduled, confirmed, cancelled, completed, no_show
    notes: (0, pg_core_1.text)("notes"),
    reminderSent: (0, pg_core_1.boolean)("reminder_sent").default(false),
    reminderSentAt: (0, pg_core_1.timestamp)("reminder_sent_at"),
    confirmationReceived: (0, pg_core_1.boolean)("confirmation_received").default(false),
    confirmationReceivedAt: (0, pg_core_1.timestamp)("confirmation_received_at"),
    confirmationToken: (0, pg_core_1.text)("confirmation_token"), // Unique token for confirmation links
    reminderSettings: (0, pg_core_1.text)("reminder_settings"), // JSON: when to send reminders
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Appointment reminders table for tracking reminder history
exports.appointmentReminders = (0, pg_core_1.pgTable)("appointment_reminders", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    tenantId: (0, pg_core_1.varchar)("tenant_id").notNull().references(() => exports.tenants.id, { onDelete: 'cascade' }),
    appointmentId: (0, pg_core_1.varchar)("appointment_id").notNull().references(() => exports.appointments.id, { onDelete: 'cascade' }),
    customerId: (0, pg_core_1.varchar)("customer_id").notNull().references(() => exports.emailContacts.id, { onDelete: 'cascade' }),
    reminderType: (0, pg_core_1.text)("reminder_type").notNull(), // 'email', 'sms', 'push'
    reminderTiming: (0, pg_core_1.text)("reminder_timing").notNull(), // '24h', '1h', '30m', 'custom'
    scheduledFor: (0, pg_core_1.timestamp)("scheduled_for").notNull(),
    sentAt: (0, pg_core_1.timestamp)("sent_at"),
    status: (0, pg_core_1.text)("status").notNull().default('pending'), // pending, sent, failed, cancelled
    content: (0, pg_core_1.text)("content"), // The reminder message content
    errorMessage: (0, pg_core_1.text)("error_message"), // If failed, what was the error
    metadata: (0, pg_core_1.text)("metadata"), // JSON for additional data
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Appointment relations
exports.appointmentRelations = (0, drizzle_orm_2.relations)(exports.appointments, ({ one, many }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.appointments.tenantId],
        references: [exports.tenants.id],
    }),
    customer: one(exports.emailContacts, {
        fields: [exports.appointments.customerId],
        references: [exports.emailContacts.id],
    }),
    user: one(exports.betterAuthUser, {
        fields: [exports.appointments.userId],
        references: [exports.betterAuthUser.id],
    }),
    reminders: many(exports.appointmentReminders),
}));
exports.appointmentReminderRelations = (0, drizzle_orm_2.relations)(exports.appointmentReminders, ({ one }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.appointmentReminders.tenantId],
        references: [exports.tenants.id],
    }),
    appointment: one(exports.appointments, {
        fields: [exports.appointmentReminders.appointmentId],
        references: [exports.appointments.id],
    }),
    customer: one(exports.emailContacts, {
        fields: [exports.appointmentReminders.customerId],
        references: [exports.emailContacts.id],
    }),
}));
// Update tenant relations to include appointments
exports.tenantRelationsUpdated = (0, drizzle_orm_2.relations)(exports.tenants, ({ many }) => ({
    users: many(exports.betterAuthUser),
    stores: many(exports.stores),
    shops: many(exports.shops),
    forms: many(exports.forms),
    refreshTokens: many(exports.refreshTokens),
    verificationTokens: many(exports.verificationTokens),
    formResponses: many(exports.formResponses),
    emailContacts: many(exports.emailContacts),
    emailLists: many(exports.emailLists),
    contactTags: many(exports.contactTags),
    contactListMemberships: many(exports.contactListMemberships),
    contactTagAssignments: many(exports.contactTagAssignments),
    newsletters: many(exports.newsletters),
    campaigns: many(exports.campaigns),
    emailActivities: many(exports.emailActivity),
    bouncedEmails: many(exports.bouncedEmails),
    birthdaySettings: many(exports.birthdaySettings),
    appointments: many(exports.appointments),
    appointmentReminders: many(exports.appointmentReminders),
}));
// Appointment schemas
exports.createAppointmentSchema = zod_1.z.object({
    customerId: zod_1.z.string().uuid("Please select a valid customer"),
    title: zod_1.z.string().min(1, "Appointment title is required"),
    description: zod_1.z.string().optional(),
    appointmentDate: zod_1.z.date(),
    duration: zod_1.z.number().int().positive().default(60),
    location: zod_1.z.string().optional(),
    serviceType: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    reminderSettings: zod_1.z.string().optional(), // JSON string
});
exports.updateAppointmentSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Appointment title is required").optional(),
    description: zod_1.z.string().optional(),
    appointmentDate: zod_1.z.date().optional(),
    duration: zod_1.z.number().int().positive().optional(),
    location: zod_1.z.string().optional(),
    serviceType: zod_1.z.string().optional(),
    status: zod_1.z.enum(['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show']).optional(),
    notes: zod_1.z.string().optional(),
    reminderSettings: zod_1.z.string().optional(),
});
exports.createAppointmentReminderSchema = zod_1.z.object({
    appointmentId: zod_1.z.string().uuid(),
    reminderType: zod_1.z.enum(['email', 'sms', 'push']).default('email'),
    reminderTiming: zod_1.z.enum(['24h', '1h', '30m', 'custom']).default('24h'),
    scheduledFor: zod_1.z.date(),
    content: zod_1.z.string().optional(),
});
//# sourceMappingURL=schema.js.map