import { Router } from 'express';
import { db } from '../../db';
import { sql, and, eq } from 'drizzle-orm';
import { bouncedEmails } from '@shared/schema';
import { authenticateToken, requireTenant } from '../../middleware/auth-middleware';
import { sanitizeString, sanitizeEmail } from '../../utils/sanitization';

export const bounceRoutes = Router();

// Get bounced emails
bounceRoutes.get("/bounced-emails", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { page = 1, limit = 50, email, reason, startDate, endDate } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`1=1`;

    if (email) {
      const sanitizedEmail = sanitizeEmail(email as string);
      whereClause = sql`${whereClause} AND ${bouncedEmails.email} = ${sanitizedEmail}`;
    }

    if (reason) {
      whereClause = sql`${whereClause} AND ${bouncedEmails.bounceReason} = ${reason}`;
    }

    if (startDate) {
      whereClause = sql`${whereClause} AND ${bouncedEmails.firstBouncedAt} >= ${new Date(startDate as string)}`;
    }

    if (endDate) {
      whereClause = sql`${whereClause} AND ${bouncedEmails.lastBouncedAt} <= ${new Date(endDate as string)}`;
    }

    const bouncedEmailsData = await db.query.bouncedEmails.findMany({
      where: whereClause,
      orderBy: sql`${bouncedEmails.lastBouncedAt} DESC`,
      limit: Number(limit),
      offset,
    });

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(bouncedEmails).where(whereClause);

    res.json({
      bouncedEmails: bouncedEmailsData,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get bounced emails error:', error);
    res.status(500).json({ message: 'Failed to get bounced emails' });
  }
});

// Check if email is bounced/suppressed
bounceRoutes.get("/bounced-emails/check/:email", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { email } = req.params;
    const sanitizedEmail = sanitizeEmail(email);

    if (!sanitizedEmail) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    const bouncedEmail = await db.query.bouncedEmails.findFirst({
      where: and(
        sql`LOWER(${bouncedEmails.email}) = ${sanitizedEmail.toLowerCase().trim()}`,
        eq(bouncedEmails.isActive, true),
      ),
    });

    const isSuppressed = !!bouncedEmail && bouncedEmail.bounceType === 'suppressed';

    res.json({
      isBounced: !!bouncedEmail,
      isSuppressed,
      bounceType: bouncedEmail?.bounceType || null,
      suppressedSince: bouncedEmail?.firstBouncedAt || null,
      suppressionReason: bouncedEmail?.suppressionReason || bouncedEmail?.bounceReason || null,
    });
  } catch (error) {
    console.error('Check bounced email error:', error);
    res.status(500).json({ message: 'Failed to check bounced email' });
  }
});

// Delete bounced email record
bounceRoutes.delete("/bounced-emails/:email", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { email } = req.params;
    const sanitizedEmail = sanitizeEmail(email);

    const deletedBounce = await db.delete(bouncedEmails)
      .where(sql`${bouncedEmails.email} = ${sanitizedEmail}`)
      .returning();

    if (deletedBounce.length === 0) {
      return res.status(404).json({ message: 'Bounced email record not found' });
    }

    res.json({ message: 'Bounced email record deleted successfully' });
  } catch (error) {
    console.error('Delete bounced email error:', error);
    res.status(500).json({ message: 'Failed to delete bounced email record' });
  }
});

// Add bounced email record
bounceRoutes.post("/bounced-emails", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { email, reason, description } = req.body;

    if (!email || !reason) {
      return res.status(400).json({ message: 'Email and reason are required' });
    }

    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedReason = sanitizeString(reason);
    const sanitizedDescription = description ? sanitizeString(description) : null;

    // Check if already exists
    const existingBounce = await db.query.bouncedEmails.findFirst({
      where: sql`${bouncedEmails.email} = ${sanitizedEmail}`,
    });

    if (existingBounce) {
      return res.status(400).json({ message: 'Bounced email record already exists' });
    }

    const newBouncedEmail = await db.insert(bouncedEmails).values({
      email: sanitizedEmail!,
      bounceType: 'hard',
      bounceReason: sanitizedReason,
      firstBouncedAt: new Date(),
      lastBouncedAt: new Date(),
      bounceCount: 1,
    }).returning();

    res.status(201).json(newBouncedEmail[0]);
  } catch (error) {
    console.error('Add bounced email error:', error);
    res.status(500).json({ message: 'Failed to add bounced email record' });
  }
});

// Get bounced email statistics
bounceRoutes.get("/bounced-emails/stats", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const stats = await db.select({
      totalBounces: sql<number>`count(*)`,
      bouncesToday: sql<number>`count(*) filter (where bounced_at >= current_date)`,
      bouncesThisWeek: sql<number>`count(*) filter (where bounced_at >= current_date - interval '7 days')`,
      bouncesThisMonth: sql<number>`count(*) filter (where bounced_at >= current_date - interval '30 days')`,
      hardBounces: sql<number>`count(*) filter (where reason = 'hard_bounce')`,
      softBounces: sql<number>`count(*) filter (where reason = 'soft_bounce')`,
      spamComplaints: sql<number>`count(*) filter (where reason = 'spam_complaint')`,
    }).from(bouncedEmails);

    res.json(stats[0]);
  } catch (error) {
    console.error('Get bounced email stats error:', error);
    res.status(500).json({ message: 'Failed to get bounced email statistics' });
  }
});
