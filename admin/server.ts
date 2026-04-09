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

// --- Hardcoded admin credentials ---
const ADMIN_EMAIL = 'admin@zendiwse.com';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('Bulls2398$', 10);

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
    if (decoded.email !== ADMIN_EMAIL) {
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
  if (email !== ADMIN_EMAIL || !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '24h' });
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
  return res.json({ success: true, email });
});

app.post('/admin-api/auth/logout', (_req, res) => {
  res.clearCookie('admin_token');
  return res.json({ success: true });
});

app.get('/admin-api/auth/me', authenticateAdmin, (_req, res) => {
  return res.json({ email: ADMIN_EMAIL, role: 'super_admin' });
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

// --- Serve static files in production ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'dist');

app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  Admin Panel Server running on http://localhost:${PORT}`);
  console.log(`  Login: ${ADMIN_EMAIL}\n`);
});
