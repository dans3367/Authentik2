import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, desc, sql, like, or, count, and, gte, isNotNull, inArray } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  decimal,
} from 'drizzle-orm/pg-core';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env from parent project
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const PORT = process.env.ADMIN_PORT || 5100;
if (!process.env.ADMIN_JWT_SECRET) {
  throw new Error('ADMIN_JWT_SECRET environment variable is required. Set it in your .env file.');
}
const JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 5002}`;

// --- Admin credentials (mutable in-memory; reset on server restart) ---
// Seed from env vars; falls back to defaults ONLY in development.
let adminEmail = process.env.ADMIN_EMAIL || (IS_PRODUCTION ? '' : 'admin@zendwise.com');
let adminPasswordHash = process.env.ADMIN_PASSWORD_HASH
  || (IS_PRODUCTION ? '' : bcrypt.hashSync('changeme', 10));
let adminName = process.env.ADMIN_NAME || 'Super Admin';
if (IS_PRODUCTION && (!adminEmail || !adminPasswordHash)) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD_HASH environment variables are required in production.');
}

// --- Schema (inline to avoid import issues with parent project) ---
const betterAuthUser = pgTable('better_auth_user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  role: text('role').default('Owner').notNull(),
  tenantId: varchar('tenant_id').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  isActive: boolean('is_active').default(true),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  lastLoginAt: timestamp('last_login_at'),
  theme: text('theme').default('light'),
  language: text('language').default('en'),
  timezone: text('timezone').default('America/Chicago'),
  avatarUrl: text('avatar_url'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionStatus: text('subscription_status').default('inactive'),
  subscriptionPlanId: varchar('subscription_plan_id'),
  subscriptionStartDate: timestamp('subscription_start_date'),
  subscriptionEndDate: timestamp('subscription_end_date'),
  trialEndsAt: timestamp('trial_ends_at'),
  suspendedByDowngrade: boolean('suspended_by_downgrade').default(false),
  suspendedAt: timestamp('suspended_at'),
});

const betterAuthSession = pgTable('better_auth_session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull(),
});

const tenants = pgTable('tenants', {
  id: varchar('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  domain: text('domain'),
  isActive: boolean('is_active').default(true),
  settings: text('settings').default('{}'),
  maxUsers: integer('max_users').default(10),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

const subscriptionPlans = pgTable('subscription_plans', {
  id: varchar('id').primaryKey(),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  yearlyPrice: decimal('yearly_price', { precision: 10, scale: 2 }),
  stripePriceId: text('stripe_price_id').notNull(),
  stripeYearlyPriceId: text('stripe_yearly_price_id'),
  features: text('features').array().notNull(),
  maxUsers: integer('max_users'),
  maxProjects: integer('max_projects'),
  maxShops: integer('max_shops'),
  storageLimit: integer('storage_limit'),
  supportLevel: text('support_level').default('email'),
  trialDays: integer('trial_days').default(14),
  isPopular: boolean('is_popular').default(false),
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
  monthlyEmailLimit: integer('monthly_email_limit').default(100),
  allowUsersManagement: boolean('allow_users_management').default(false),
  allowRolesManagement: boolean('allow_roles_management').default(false),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

const subscriptions = pgTable('subscriptions', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  userId: varchar('user_id').notNull(),
  planId: varchar('plan_id').notNull(),
  stripeSubscriptionId: text('stripe_subscription_id').notNull(),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  status: text('status').notNull(),
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  trialStart: timestamp('trial_start'),
  trialEnd: timestamp('trial_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  canceledAt: timestamp('canceled_at'),
  isYearly: boolean('is_yearly').default(false),
  downgradeTargetPlanId: varchar('downgrade_target_plan_id'),
  downgradeScheduledAt: timestamp('downgrade_scheduled_at'),
  previousPlanId: varchar('previous_plan_id'),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

const tenantLimits = pgTable('tenant_limits', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  maxShops: integer('max_shops'),
  maxUsers: integer('max_users'),
  maxStorageGb: integer('max_storage_gb'),
  monthlyEmailLimit: integer('monthly_email_limit'),
  customLimits: text('custom_limits').default('{}'),
  overrideReason: text('override_reason'),
  createdBy: varchar('created_by'),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

const companies = pgTable('companies', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  ownerId: varchar('owner_id').notNull(),
  name: text('name').notNull(),
  address: text('address'),
  companyType: text('company_type'),
  companyEmail: text('company_email'),
  phone: text('phone'),
  website: text('website'),
  description: text('description'),
  setupCompleted: boolean('setup_completed').default(false),
  geographicalLocation: text('geographical_location'),
  language: text('language').default('en'),
  businessDescription: text('business_description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

const shops = pgTable('shops', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  address: text('address'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

const emailContacts = pgTable('email_contacts', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  email: text('email').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at'),
});

const emailSends = pgTable('email_sends', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  status: text('status'),
  createdAt: timestamp('created_at'),
});

const newsletters = pgTable('newsletters', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  status: text('status'),
  createdAt: timestamp('created_at'),
});

const forms = pgTable('forms', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  createdAt: timestamp('created_at'),
});

const formResponses = pgTable('form_responses', {
  id: varchar('id').primaryKey(),
  formId: varchar('form_id').notNull(),
  createdAt: timestamp('created_at'),
});

const campaigns = pgTable('campaigns', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  status: text('status'),
  createdAt: timestamp('created_at'),
});

const templates = pgTable('templates', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id').notNull(),
  createdAt: timestamp('created_at'),
});

const bouncedEmails = pgTable('bounced_emails', {
  id: varchar('id').primaryKey(),
  tenantId: varchar('tenant_id'),
  createdAt: timestamp('created_at'),
});

// --- Database setup ---
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required. Set it in ../.env');
  process.exit(1);
}

const requiresSSL = databaseUrl.includes('sslmode=require') || databaseUrl.includes('neon.tech');
const pool = postgres(databaseUrl, {
  ssl: requiresSSL ? 'require' : false,
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
});
const db = drizzle(pool);

// --- Express app ---
const app = express();
const ADMIN_CORS_ORIGIN = process.env.ADMIN_CORS_ORIGIN || `http://localhost:${PORT}`;
app.use(cors({ origin: ADMIN_CORS_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// --- Auth middleware ---
interface AdminTokenPayload {
  email: string;
  iat: number;
  exp: number;
}

function maskEmail(email: string): string {
  if (!email) return '(empty)';
  const [local, domain] = email.split('@');
  if (!domain) return `${local.slice(0, 2)}***`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function authenticateAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.cookies?.admin_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    console.warn(`[admin-auth] 401 Not authenticated — ${req.method} ${req.originalUrl} (no cookie/bearer token, origin=${req.headers.origin || 'n/a'})`);
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
    if (decoded.email !== adminEmail) {
      console.warn(`[admin-auth] 403 Forbidden — ${req.method} ${req.originalUrl} (token email=${maskEmail(decoded.email)} does not match current adminEmail=${maskEmail(adminEmail)}; admin email may have been changed since token was issued)`);
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  } catch (err: any) {
    console.warn(`[admin-auth] 401 Invalid/expired token — ${req.method} ${req.originalUrl} (${err?.name || 'JWTError'}: ${err?.message || 'unknown'})`);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// --- Auth routes ---

// Simple in-memory rate limiter for login
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= LOGIN_MAX_ATTEMPTS) {
      return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
    }
    entry.count++;
    return { allowed: true };
  }
  loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  return { allowed: true };
}

// Cleanup stale entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now >= entry.resetAt) loginAttempts.delete(ip);
  }
}, 30 * 60 * 1000);

app.post('/admin-api/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  console.log(`[admin-login] attempt — email=${maskEmail(email || '')} ip=${ip}`);

  // Rate limit check
  const rateCheck = checkLoginRateLimit(ip);
  if (!rateCheck.allowed) {
    console.warn(`[admin-login] 429 Rate limited — ip=${ip} retryAfter=${rateCheck.retryAfterSec}s`);
    res.set('Retry-After', String(rateCheck.retryAfterSec));
    return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
  }

  if (!email || !password) {
    console.warn(`[admin-login] 400 Missing fields`);
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Cap password length to prevent bcrypt DoS (bcrypt truncates at 72 bytes anyway)
  if (password.length > 72) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const emailMatches = email === adminEmail;
  const passwordMatches = emailMatches && bcrypt.compareSync(password, adminPasswordHash);

  if (!emailMatches || !passwordMatches) {
    // Don't reveal whether it was the email or password that failed
    console.warn(`[admin-login] 401 Invalid credentials — ip=${ip}`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Reset rate limit on successful login
  loginAttempts.delete(ip);

  const token = jwt.sign({ email: adminEmail }, JWT_SECRET, { expiresIn: '24h' });
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
  console.log(`[admin-login] 200 Success — ${maskEmail(adminEmail)} signed in (cookie set, secure=${IS_PRODUCTION})`);
  return res.json({ success: true, email: adminEmail });
});

app.post('/admin-api/auth/logout', (_req, res) => {
  res.clearCookie('admin_token');
  return res.json({ success: true });
});

app.get('/admin-api/auth/me', authenticateAdmin, (_req, res) => {
  return res.json({ email: adminEmail, name: adminName, role: 'super_admin' });
});

app.patch('/admin-api/auth/profile', authenticateAdmin, (req, res) => {
  const { name, email } = req.body;
  if (name !== undefined) adminName = String(name).trim();
  if (email !== undefined) {
    const trimmed = String(email).trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    adminEmail = trimmed;
  }
  // Re-issue JWT so the new email is encoded in the token
  const token = jwt.sign({ email: adminEmail }, JWT_SECRET, { expiresIn: '24h' });
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
  return res.json({ email: adminEmail, name: adminName, role: 'super_admin' });
});

app.post('/admin-api/auth/change-password', authenticateAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (!bcrypt.compareSync(currentPassword, adminPasswordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  if (newPassword.length > 72) {
    return res.status(400).json({ error: 'New password must be at most 72 characters' });
  }
  adminPasswordHash = bcrypt.hashSync(newPassword, 10);
  return res.json({ success: true });
});

// --- Dashboard stats ---
app.get('/admin-api/stats', authenticateAdmin, async (_req, res) => {
  try {
    // Core counts
    const [userCount] = await db.select({ count: count() }).from(betterAuthUser);
    const [sessionCount] = await db.select({ count: count() }).from(betterAuthSession);
    const [tenantCount] = await db.select({ count: count() }).from(tenants);
    const [activeUsers] = await db
      .select({ count: count() })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.isActive, true));
    const [verifiedUsers] = await db
      .select({ count: count() })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.emailVerified, true));

    // Tenant status
    const [activeTenants] = await db
      .select({ count: count() })
      .from(tenants)
      .where(eq(tenants.isActive, true));

    // Companies & shops
    const [companyCount] = await db.select({ count: count() }).from(companies);
    const [setupComplete] = await db.select({ count: count() }).from(companies).where(eq(companies.setupCompleted, true));
    const [shopCount] = await db.select({ count: count() }).from(shops);
    const [activeShops] = await db.select({ count: count() }).from(shops).where(eq(shops.isActive, true));

    // Subscriptions
    const [activeSubCount] = await db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, 'active'));
    const [trialingCount] = await db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, 'trialing'));
    const [canceledSubCount] = await db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, 'canceled'));
    const [pastDueCount] = await db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, 'past_due'));

    // Plan breakdown (how many active subscriptions per plan)
    const planBreakdown = await db
      .select({ planName: subscriptionPlans.displayName, count: count() })
      .from(subscriptions)
      .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId))
      .where(inArray(subscriptions.status, ['active', 'trialing']))
      .groupBy(subscriptionPlans.displayName);

    // Email & marketing (wrapped in try/catch so missing tables don't break the whole endpoint)
    let contactCount = 0, emailSendCount = 0, newsletterCount = 0, formCount = 0, formResponseCount = 0, campaignCount = 0, templateCount = 0, bounceCount = 0;
    try { const [r] = await db.select({ count: count() }).from(emailContacts); contactCount = r.count; } catch {}
    try { const [r] = await db.select({ count: count() }).from(emailSends); emailSendCount = r.count; } catch {}
    try { const [r] = await db.select({ count: count() }).from(newsletters); newsletterCount = r.count; } catch {}
    try { const [r] = await db.select({ count: count() }).from(forms); formCount = r.count; } catch {}
    try { const [r] = await db.select({ count: count() }).from(formResponses); formResponseCount = r.count; } catch {}
    try { const [r] = await db.select({ count: count() }).from(campaigns); campaignCount = r.count; } catch {}
    try { const [r] = await db.select({ count: count() }).from(templates); templateCount = r.count; } catch {}
    try { const [r] = await db.select({ count: count() }).from(bouncedEmails); bounceCount = r.count; } catch {}

    // 2FA adoption
    const [twoFaUsers] = await db
      .select({ count: count() })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.twoFactorEnabled, true));

    // Recent signups (last 7 days & 30 days)
    const now = new Date();
    const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
    const [signups7d] = await db.select({ count: count() }).from(betterAuthUser).where(gte(betterAuthUser.createdAt, d7));
    const [signups30d] = await db.select({ count: count() }).from(betterAuthUser).where(gte(betterAuthUser.createdAt, d30));
    const [newTenants7d] = await db.select({ count: count() }).from(tenants).where(gte(tenants.createdAt, d7));
    const [newTenants30d] = await db.select({ count: count() }).from(tenants).where(gte(tenants.createdAt, d30));

    // Role breakdown
    const roleBreakdown = await db
      .select({ role: betterAuthUser.role, count: count() })
      .from(betterAuthUser)
      .groupBy(betterAuthUser.role);

    // Subscription status breakdown (per-user)
    const subscriptionBreakdown = await db
      .select({ status: betterAuthUser.subscriptionStatus, count: count() })
      .from(betterAuthUser)
      .groupBy(betterAuthUser.subscriptionStatus);

    return res.json({
      users: {
        total: userCount.count,
        active: activeUsers.count,
        verified: verifiedUsers.count,
        twoFa: twoFaUsers.count,
        signups7d: signups7d.count,
        signups30d: signups30d.count,
      },
      sessions: { total: sessionCount.count },
      tenants: {
        total: tenantCount.count,
        active: activeTenants.count,
        new7d: newTenants7d.count,
        new30d: newTenants30d.count,
      },
      companies: { total: companyCount.count, setupComplete: setupComplete.count },
      shops: { total: shopCount.count, active: activeShops.count },
      subscriptions: {
        active: activeSubCount.count,
        trialing: trialingCount.count,
        canceled: canceledSubCount.count,
        pastDue: pastDueCount.count,
      },
      email: {
        contacts: contactCount,
        sends: emailSendCount,
        newsletters: newsletterCount,
        bounces: bounceCount,
      },
      marketing: {
        forms: formCount,
        formResponses: formResponseCount,
        campaigns: campaignCount,
        templates: templateCount,
      },
      planBreakdown,
      roleBreakdown,
      subscriptionBreakdown,
    });
  } catch (err) {
    console.error('Stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// --- Users CRUD ---
app.get('/admin-api/users', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const search = req.query.search as string;
    const role = req.query.role as string;
    const offset = (page - 1) * limit;

    let query = db.select().from(betterAuthUser);
    const conditions = [];

    if (search) {
      // Escape LIKE special characters to prevent wildcard injection
      const escaped = search.replace(/[%_\\]/g, '\\$&');
      conditions.push(
        or(
          like(betterAuthUser.email, `%${escaped}%`),
          like(betterAuthUser.name, `%${escaped}%`)
        )
      );
    }
    if (role) {
      conditions.push(eq(betterAuthUser.role, role));
    }

    if (conditions.length > 0) {
      for (const cond of conditions) {
        query = query.where(cond!) as any;
      }
    }

    const users = await (query as any)
      .orderBy(desc(betterAuthUser.createdAt))
      .limit(limit)
      .offset(offset);

    // Total count respecting the same filters
    let countQuery = db.select({ count: count() }).from(betterAuthUser);
    if (conditions.length > 0) {
      for (const cond of conditions) {
        countQuery = countQuery.where(cond!) as any;
      }
    }
    const [total] = await (countQuery as any);

    return res.json({ users, total: total.count, page, limit });
  } catch (err) {
    console.error('Users fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/admin-api/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(betterAuthUser)
      .where(eq(betterAuthUser.id, req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.patch('/admin-api/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const { role, isActive, name, email } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (role !== undefined) {
      const validRoles = ['Owner', 'Administrator', 'Manager', 'Employee'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
      }
      updates.role = role;
    }
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (name !== undefined) updates.name = String(name).trim();
    if (email !== undefined) {
      const trimmed = String(email).trim().toLowerCase();
      if (!trimmed || !trimmed.includes('@')) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
      updates.email = trimmed;
    }

    const [updated] = await db
      .update(betterAuthUser)
      .set(updates)
      .where(eq(betterAuthUser.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'User not found' });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/admin-api/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const [deleted] = await db
      .delete(betterAuthUser)
      .where(eq(betterAuthUser.id, req.params.id))
      .returning();
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    return res.json({ success: true, deleted });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

// --- Sessions ---
app.get('/admin-api/sessions', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const offset = (page - 1) * limit;

    const sessions = await db
      .select()
      .from(betterAuthSession)
      .orderBy(desc(betterAuthSession.createdAt))
      .limit(limit)
      .offset(offset);

    const [total] = await db.select({ count: count() }).from(betterAuthSession);

    return res.json({ sessions, total: total.count, page, limit });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

app.delete('/admin-api/sessions/:id', authenticateAdmin, async (req, res) => {
  try {
    const [deleted] = await db
      .delete(betterAuthSession)
      .where(eq(betterAuthSession.id, req.params.id))
      .returning();
    if (!deleted) return res.status(404).json({ error: 'Session not found' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete session' });
  }
});

// --- Tenants ---
app.get('/admin-api/tenants', authenticateAdmin, async (_req, res) => {
  try {
    const allTenants = await db
      .select()
      .from(tenants)
      .orderBy(desc(tenants.createdAt));

    if (allTenants.length === 0) return res.json({ tenants: [] });

    const tenantIds = allTenants.map((t) => t.id);

    // Fetch active/trialing subscriptions with plan names for all tenants at once
    const activeSubs = await db
      .select({
        tenantId: subscriptions.tenantId,
        planName: subscriptionPlans.displayName,
        createdAt: subscriptions.createdAt,
      })
      .from(subscriptions)
      .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId))
      .where(
        and(
          inArray(subscriptions.tenantId, tenantIds),
          or(eq(subscriptions.status, 'active'), eq(subscriptions.status, 'trialing'))
        )
      )
      .orderBy(desc(subscriptions.createdAt));

    // Build a map: tenantId → planName (most recent active sub wins)
    const planByTenant = new Map<string, string | null>();
    for (const sub of activeSubs) {
      if (!planByTenant.has(sub.tenantId)) {
        planByTenant.set(sub.tenantId, sub.planName ?? null);
      }
    }

    // Fallback: for tenants with no active subscription row, check owner user's subscriptionPlanId
    const missingIds = tenantIds.filter((id) => !planByTenant.has(id));
    if (missingIds.length > 0) {
      const ownerPlans = await db
        .select({
          tenantId: betterAuthUser.tenantId,
          planName: subscriptionPlans.displayName,
        })
        .from(betterAuthUser)
        .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, betterAuthUser.subscriptionPlanId))
        .where(
          and(
            inArray(betterAuthUser.tenantId, missingIds),
            eq(betterAuthUser.role, 'Owner')
          )
        );
      for (const row of ownerPlans) {
        if (!planByTenant.has(row.tenantId)) {
          planByTenant.set(row.tenantId, row.planName ?? null);
        }
      }
    }

    const tenantsWithPlan = allTenants.map((t) => ({
      ...t,
      planName: planByTenant.get(t.id) ?? null,
    }));

    return res.json({ tenants: tenantsWithPlan });
  } catch (err) {
    console.error('Fetch tenants error:', err);
    return res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

app.patch('/admin-api/tenants/:id', authenticateAdmin, async (req, res) => {
  try {
    const { name, isActive, maxUsers } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ error: 'Tenant name cannot be empty' });
      updates.name = trimmed;
    }
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (maxUsers !== undefined) {
      const parsed = parseInt(maxUsers);
      if (isNaN(parsed) || parsed < 1 || parsed > 10000) {
        return res.status(400).json({ error: 'maxUsers must be between 1 and 10000' });
      }
      updates.maxUsers = parsed;
    }

    const [updated] = await db
      .update(tenants)
      .set(updates)
      .where(eq(tenants.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Tenant not found' });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update tenant' });
  }
});

// --- Plans ---
app.get('/admin-api/plans', authenticateAdmin, async (_req, res) => {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.sortOrder);
    return res.json({ plans });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// --- Tenant Details (aggregated) ---
app.get('/admin-api/tenants/:id/details', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.params.id;

    // Fetch tenant
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Fetch all related data in parallel
    const [
      tenantUsers,
      tenantSubscriptions,
      tenantCompanies,
      tenantLimitOverrides,
      tenantShops,
      [userCount],
    ] = await Promise.all([
      db.select().from(betterAuthUser).where(eq(betterAuthUser.tenantId, tenantId)).orderBy(desc(betterAuthUser.createdAt)),
      db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId)).orderBy(desc(subscriptions.createdAt)),
      db.select().from(companies).where(eq(companies.tenantId, tenantId)),
      db.select().from(tenantLimits).where(eq(tenantLimits.tenantId, tenantId)),
      db.select().from(shops).where(eq(shops.tenantId, tenantId)),
      db.select({ count: count() }).from(betterAuthUser).where(eq(betterAuthUser.tenantId, tenantId)),
    ]);

    // Fetch subscription plan details for each subscription
    const subscriptionsWithPlans = await Promise.all(
      tenantSubscriptions.map(async (sub) => {
        const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub.planId));
        return { ...sub, plan: plan || null };
      })
    );

    // Find the owner user (role = Owner)
    const owner = tenantUsers.find((u) => u.role === 'Owner') || tenantUsers[0] || null;

    return res.json({
      tenant,
      owner,
      users: tenantUsers,
      userCount: userCount.count,
      subscriptions: subscriptionsWithPlans,
      activeSubscription: subscriptionsWithPlans.find((s) => s.status === 'active' || s.status === 'trialing') || null,
      company: tenantCompanies[0] || null,
      limits: tenantLimitOverrides[0] || null,
      shops: tenantShops,
    });
  } catch (err) {
    console.error('Tenant details error:', err);
    return res.status(500).json({ error: 'Failed to fetch tenant details' });
  }
});

// --- Change tenant plan ---
app.post('/admin-api/tenants/:id/change-plan', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.params.id;
    const { planId, isYearly = false } = req.body;

    if (!planId) return res.status(400).json({ error: 'planId is required' });

    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId));
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(isYearly ? periodEnd.getMonth() + 12 : periodEnd.getMonth() + 1);

    // Look up the tenant owner once (used for subscription creation + user update)
    const [owner] = await db
      .select()
      .from(betterAuthUser)
      .where(and(eq(betterAuthUser.tenantId, tenantId), eq(betterAuthUser.role, 'Owner')));

    // Find any existing subscription for this tenant (active or trialing first)
    const [existing] = await db
      .select()
      .from(subscriptions)
      .where(and(
        eq(subscriptions.tenantId, tenantId),
        inArray(subscriptions.status, ['active', 'trialing']),
      ));

    if (existing) {
      // Update the existing subscription
      await db
        .update(subscriptions)
        .set({
          planId,
          isYearly,
          status: 'active',
          previousPlanId: existing.planId,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existing.id));
    } else {
      // No active/trialing subscription — check for any other (canceled, etc.)
      const [anySub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId));

      if (anySub) {
        // Reactivate the existing row
        await db
          .update(subscriptions)
          .set({
            planId,
            isYearly,
            status: 'active',
            previousPlanId: anySub.planId,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            canceledAt: null,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, anySub.id));
      } else {
        // No subscription record at all — create one
        if (!owner) {
          return res.status(400).json({ error: 'Cannot create subscription: no owner user found for this tenant' });
        }
        await db.insert(subscriptions).values({
          id: crypto.randomUUID(),
          tenantId,
          userId: owner.id,
          planId,
          stripeSubscriptionId: `admin_override_${tenantId}_${Date.now()}`,
          stripeCustomerId: `admin_customer_${tenantId}`,
          status: 'active',
          isYearly,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        });
      }
    }

    // Always update the owner user's subscription plan fields
    if (owner) {
      await db
        .update(betterAuthUser)
        .set({ subscriptionPlanId: planId, updatedAt: now })
        .where(eq(betterAuthUser.id, owner.id));
    }

    // Invalidate the main server's tenant plan cache so changes take effect immediately
    const cacheSecret = process.env.BETTER_AUTH_SECRET;
    if (cacheSecret) {
      try {
        await fetch(`${APP_URL}/api/admin-cache/invalidate-tenant-plan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-secret': cacheSecret,
          },
          body: JSON.stringify({ tenantId }),
        });
      } catch {
        // Non-fatal — cache will expire naturally
      }
    } else {
      console.warn('[Change Plan] BETTER_AUTH_SECRET not set — skipping cache invalidation');
    }

    return res.json({ success: true, plan });
  } catch (err) {
    console.error('Change plan error:', err);
    return res.status(500).json({ error: 'Failed to change plan' });
  }
});

// --- Suspend / reinstate tenant ---
app.post('/admin-api/tenants/:id/suspend', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.params.id;
    const { suspend } = req.body; // boolean

    if (typeof suspend !== 'boolean') {
      return res.status(400).json({ error: '`suspend` must be a boolean' });
    }

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const now = new Date();

    // Update tenant active state
    const [updatedTenant] = await db
      .update(tenants)
      .set({ isActive: !suspend, updatedAt: now })
      .where(eq(tenants.id, tenantId))
      .returning();

    // Cascade to all users in the tenant
    await db
      .update(betterAuthUser)
      .set({ isActive: !suspend, updatedAt: now })
      .where(eq(betterAuthUser.tenantId, tenantId));

    return res.json({ success: true, tenant: updatedTenant });
  } catch (err) {
    console.error('Suspend tenant error:', err);
    return res.status(500).json({ error: 'Failed to update tenant status' });
  }
});

// --- Delete tenant (full cascade) ---
app.delete('/admin-api/tenants/:id', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.params.id;

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Step 1: delete all users belonging to this tenant.
    // betterAuthUser.tenantId has no FK → tenants so the DB won't cascade it automatically.
    // Deleting users DOES cascade their betterAuthSession + betterAuthAccount rows (FK cascade).
    await db.delete(betterAuthUser).where(eq(betterAuthUser.tenantId, tenantId));

    // Step 2: delete the tenant — the DB cascades all 30+ tables that reference tenants.id.
    await db.delete(tenants).where(eq(tenants.id, tenantId));

    return res.json({ success: true, deleted: tenant });
  } catch (err) {
    console.error('Delete tenant error:', err);
    return res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

// --- Impersonate user ---
app.post('/admin-api/impersonate/:userId', authenticateAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Verify user exists and is active
    const [user] = await db
      .select({ id: betterAuthUser.id, name: betterAuthUser.name, email: betterAuthUser.email, isActive: betterAuthUser.isActive })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.id, userId));
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.isActive) return res.status(400).json({ error: 'Cannot impersonate an inactive user' });

    // Create a Better Auth session directly in the DB
    const sessionId = crypto.randomUUID();
    const sessionToken = crypto.randomBytes(32).toString('hex');
    // One-time nonce for the callback URL (never stored as the session token)
    const nonce = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

    await db.insert(betterAuthSession).values({
      id: sessionId,
      token: sessionToken,
      userId,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      ipAddress: req.ip || '127.0.0.1',
      // Embed the nonce in userAgent so the callback can match it without exposing the session token
      userAgent: `Admin Impersonation (${adminEmail}) [nonce:${nonce}]`,
    });

    // Build a callback URL using the nonce — the real session token never appears in the URL
    const impersonateUrl = `${APP_URL}/api/impersonate-callback?nonce=${encodeURIComponent(nonce)}`;

    console.log(`[Impersonation] Admin ${adminEmail} impersonated user ${user.email} (${userId}) from ${req.ip || '127.0.0.1'} at ${now.toISOString()}`);

    return res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email },
      appUrl: impersonateUrl,
    });
  } catch (err) {
    console.error('Impersonate error:', err);
    return res.status(500).json({ error: 'Failed to create impersonation session' });
  }
});

// --- Income / Revenue analytics ---
app.get('/admin-api/income', authenticateAdmin, async (_req, res) => {
  try {
    // All plans (including inactive, for historical accuracy)
    const allPlans = await db
      .select()
      .from(subscriptionPlans)
      .orderBy(subscriptionPlans.sortOrder);

    // Subscription counts grouped by plan × status × billing cycle
    const subStats = await db
      .select({
        planId: subscriptions.planId,
        status: subscriptions.status,
        isYearly: subscriptions.isYearly,
        count: count(),
      })
      .from(subscriptions)
      .groupBy(subscriptions.planId, subscriptions.status, subscriptions.isYearly);

    // Monthly new-subscription trend (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const recentSubs = await db
      .select({
        createdAt: subscriptions.createdAt,
        status: subscriptions.status,
      })
      .from(subscriptions)
      .where(gte(subscriptions.createdAt, twelveMonthsAgo));

    // Aggregate by YYYY-MM
    const trendMap: Record<string, { new: number; canceled: number }> = {};
    for (const sub of recentSubs) {
      if (!sub.createdAt) continue;
      const key = sub.createdAt.toISOString().slice(0, 7); // "2025-03"
      if (!trendMap[key]) trendMap[key] = { new: 0, canceled: 0 };
      trendMap[key].new++;
    }

    // Canceled-at trend (subscriptions canceled in the last 12 months)
    const canceledRecent = await db
      .select({ canceledAt: subscriptions.canceledAt })
      .from(subscriptions)
      .where(
        and(
          isNotNull(subscriptions.canceledAt),
          gte(subscriptions.canceledAt, twelveMonthsAgo)
        )
      );
    for (const sub of canceledRecent) {
      if (!sub.canceledAt) continue;
      const key = sub.canceledAt.toISOString().slice(0, 7);
      if (!trendMap[key]) trendMap[key] = { new: 0, canceled: 0 };
      trendMap[key].canceled++;
    }

    const trend = Object.entries(trendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }));

    // Build per-plan metrics
    const planMetrics = allPlans.map((plan) => {
      const rows = subStats.filter((s) => s.planId === plan.id);

      const get = (status: string, yearly: boolean | null) =>
        rows.find((r) => r.status === status && (yearly === null || r.isYearly === yearly))?.count ?? 0;

      const activeMonthly  = get('active',   false);
      const activeYearly   = get('active',   true);
      const trialingMonthly = get('trialing', false);
      const trialingYearly  = get('trialing', true);
      const pastDueMonthly = get('past_due', false);
      const pastDueYearly  = get('past_due', true);
      const pastDue        = pastDueMonthly + pastDueYearly;
      const canceled       = rows.filter((r) => r.status === 'canceled').reduce((s, r) => s + r.count, 0);
      const incomplete     = rows.filter((r) => r.status === 'incomplete').reduce((s, r) => s + r.count, 0);

      const price       = parseFloat(plan.price as string) || 0;
      const yearlyPrice = parseFloat((plan.yearlyPrice ?? '0') as string) || 0;

      // MRR: monthly subs × price + yearly subs × (yearlyPrice / 12)
      const mrr = activeMonthly * price + activeYearly * (yearlyPrice / 12);
      // ARR: MRR × 12 (normalised)
      const arr = mrr * 12;

      return {
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        price,
        yearlyPrice: yearlyPrice || null,
        isActive: plan.isActive,
        isPopular: plan.isPopular,
        sortOrder: plan.sortOrder,
        activeMonthly,
        activeYearly,
        trialingMonthly,
        trialingYearly,
        pastDue,
        pastDueMonthly,
        pastDueYearly,
        canceled,
        incomplete,
        totalActive: activeMonthly + activeYearly,
        totalTrialing: trialingMonthly + trialingYearly,
        mrr,
        arr,
      };
    });

    // Overall summary
    const totalMrr     = planMetrics.reduce((s, p) => s + p.mrr, 0);
    const totalArr     = totalMrr * 12;
    const totalActive  = planMetrics.reduce((s, p) => s + p.totalActive, 0);
    const totalTrialing = planMetrics.reduce((s, p) => s + p.totalTrialing, 0);
    const totalPastDue = planMetrics.reduce((s, p) => s + p.pastDue, 0);
    const totalCanceled = planMetrics.reduce((s, p) => s + p.canceled, 0);

    // Full status breakdown across all subscriptions
    const statusBreakdown = await db
      .select({ status: subscriptions.status, count: count() })
      .from(subscriptions)
      .groupBy(subscriptions.status);

    return res.json({
      plans: planMetrics,
      summary: { totalMrr, totalArr, totalActive, totalTrialing, totalPastDue, totalCanceled },
      statusBreakdown,
      trend,
    });
  } catch (err) {
    console.error('Income error:', err);
    return res.status(500).json({ error: 'Failed to fetch income data' });
  }
});

// --- Serve static files (production only) ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (IS_PRODUCTION) {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n  Admin Panel Server running on http://localhost:${PORT}`);
  console.log(`  Login: ${adminEmail}\n`);
});
