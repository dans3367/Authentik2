import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, desc, sql, like, or, count, and } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  decimal,
} from 'drizzle-orm/pg-core';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env from parent project
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const PORT = process.env.ADMIN_PORT || 5100;
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'admin-panel-secret-key-change-in-production';

// --- Admin credentials (mutable in-memory; reset on server restart) ---
let adminEmail = 'admin@zendwise.com';
let adminPasswordHash = bcrypt.hashSync('Bulls2398$', 10);
let adminName = 'Super Admin';

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
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// --- Auth middleware ---
interface AdminTokenPayload {
  email: string;
  iat: number;
  exp: number;
}

function authenticateAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.cookies?.admin_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
    if (decoded.email !== adminEmail) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// --- Auth routes ---
app.post('/admin-api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (email !== adminEmail || !bcrypt.compareSync(password, adminPasswordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ email: adminEmail }, JWT_SECRET, { expiresIn: '24h' });
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
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
    secure: process.env.NODE_ENV === 'production',
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
  adminPasswordHash = bcrypt.hashSync(newPassword, 10);
  return res.json({ success: true });
});

// --- Dashboard stats ---
app.get('/admin-api/stats', authenticateAdmin, async (_req, res) => {
  try {
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

    // Role breakdown
    const roleBreakdown = await db
      .select({ role: betterAuthUser.role, count: count() })
      .from(betterAuthUser)
      .groupBy(betterAuthUser.role);

    // Subscription breakdown
    const subscriptionBreakdown = await db
      .select({ status: betterAuthUser.subscriptionStatus, count: count() })
      .from(betterAuthUser)
      .groupBy(betterAuthUser.subscriptionStatus);

    return res.json({
      users: { total: userCount.count, active: activeUsers.count, verified: verifiedUsers.count },
      sessions: { total: sessionCount.count },
      tenants: { total: tenantCount.count },
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
    const limit = parseInt(req.query.limit as string) || 25;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const offset = (page - 1) * limit;

    let query = db.select().from(betterAuthUser);
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          like(betterAuthUser.email, `%${search}%`),
          like(betterAuthUser.name, `%${search}%`)
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

    const [total] = await db.select({ count: count() }).from(betterAuthUser);

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
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;

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
    const limit = parseInt(req.query.limit as string) || 25;
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
    return res.json({ tenants: allTenants });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

app.patch('/admin-api/tenants/:id', authenticateAdmin, async (req, res) => {
  try {
    const { name, isActive, maxUsers } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (isActive !== undefined) updates.isActive = isActive;
    if (maxUsers !== undefined) updates.maxUsers = maxUsers;

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

    // Update the active subscription if one exists
    const existing = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, 'active')));

    if (existing.length > 0) {
      await db
        .update(subscriptions)
        .set({
          planId,
          isYearly,
          previousPlanId: existing[0].planId,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existing[0].id));
    } else {
      // Also check for trialing subscriptions
      const trialing = await db
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, 'trialing')));
      if (trialing.length > 0) {
        await db
          .update(subscriptions)
          .set({ planId, isYearly, previousPlanId: trialing[0].planId, updatedAt: now })
          .where(eq(subscriptions.id, trialing[0].id));
      }
    }

    // Always update the owner user's subscription plan fields
    const [owner] = await db
      .select()
      .from(betterAuthUser)
      .where(and(eq(betterAuthUser.tenantId, tenantId), eq(betterAuthUser.role, 'Owner')));

    if (owner) {
      await db
        .update(betterAuthUser)
        .set({ subscriptionPlanId: planId, updatedAt: now })
        .where(eq(betterAuthUser.id, owner.id));
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

// --- Serve static files in production ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'dist');

app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  Admin Panel Server running on http://localhost:${PORT}`);
  console.log(`  Login: ${adminEmail}\n`);
});
