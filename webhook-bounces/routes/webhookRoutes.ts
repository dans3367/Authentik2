import { Router } from 'express';
import { db, schema } from '../db';
import { sql, eq, and } from 'drizzle-orm';

const { bouncedEmails, emailContacts } = schema;

export const webhookRoutes = Router();

// ─── HELPERS ────────────────────────────────────────────────────────────────

/**
 * Extract recipient email from various webhook payload formats.
 * Resend uses data.to (array), Postmark uses data.Email, etc.
 */
function extractRecipientEmail(data: any): string | null {
  // Resend format - 'to' as array of recipients
  if (data.to && Array.isArray(data.to)) {
    const recipient = data.to[0];
    if (typeof recipient === 'string') return recipient;
    if (recipient && recipient.email) return recipient.email;
  } else if (data.to && typeof data.to === 'string') {
    return data.to;
  }

  // Direct email field
  if (data.email) return data.email;

  // Postmark format
  if (data.Email) return data.Email;

  return null;
}

/**
 * Determine bounce type from webhook event data.
 */
function classifyBounceType(eventType: string, data: any): string {
  if (eventType === 'email.suppressed') return 'suppressed';
  if (eventType === 'email.complained') return 'complaint';

  // Resend bounce classification
  if (data.bounce?.type === 'hard' || data.Type === 'HardBounce') return 'hard';
  if (data.bounce?.type === 'soft' || data.Type === 'SoftBounce') return 'soft';

  // Default for generic bounce events
  return 'hard';
}

/**
 * Add or update an entry in the bouncedEmails table, then update emailContacts status.
 */
async function recordBounce(params: {
  email: string;
  bounceType: string;
  reason: string;
  sourceTenantId?: string | null;
}) {
  const emailLower = params.email.toLowerCase().trim();

  // 1. Upsert into bouncedEmails
  const existing = await db.query.bouncedEmails.findFirst({
    where: sql`LOWER(${bouncedEmails.email}) = ${emailLower}`,
  });

  if (!existing) {
    await db.insert(bouncedEmails).values({
      email: emailLower,
      bounceType: params.bounceType as any,
      bounceReason: params.reason,
      firstBouncedAt: new Date() as any,
      lastBouncedAt: new Date() as any,
      isActive: true as any,
      bounceCount: 1,
      sourceTenantId: params.sourceTenantId || null,
      suppressionReason: params.reason,
    });
    console.log(`[Bounce] Added new entry: ${emailLower} (${params.bounceType})`);
  } else {
    await db.update(bouncedEmails)
      .set({
        lastBouncedAt: new Date() as any,
        bounceCount: sql`COALESCE(${bouncedEmails.bounceCount}, 1) + 1`,
        isActive: true as any,
        bounceType: params.bounceType as any,
        bounceReason: params.reason,
        updatedAt: new Date() as any,
      })
      .where(sql`${bouncedEmails.id} = ${existing.id}`);
    console.log(`[Bounce] Updated existing entry: ${emailLower} (${params.bounceType}, count: ${((existing as any).bounceCount || 1) + 1})`);
  }

  // 2. Update emailContacts status
  const contactStatus = params.bounceType === 'complaint' ? 'unsubscribed' : 
                         params.bounceType === 'suppressed' ? 'suppressed' : 'bounced';
  try {
    const result = await db.update(emailContacts)
      .set({
        status: contactStatus as any,
        lastActivity: new Date() as any,
        updatedAt: new Date() as any,
      })
      .where(sql`LOWER(${emailContacts.email}) = ${emailLower} AND ${emailContacts.status} = 'active'`);
    console.log(`[Bounce] Updated contact status to '${contactStatus}' for: ${emailLower}`);
  } catch (err) {
    console.error(`[Bounce] Error updating contact status for ${emailLower}:`, err);
  }
}

// ─── RESEND WEBHOOK ENDPOINT ────────────────────────────────────────────────

webhookRoutes.post('/resend', async (req, res) => {
  try {
    const payload = req.body;
    console.log(`\n📨 [Resend Webhook] Received event: ${payload.type}`);

    const eventType = payload.type;
    const data = payload.data;

    if (!data) {
      console.warn('[Resend Webhook] No data in payload');
      return res.status(200).json({ received: true, skipped: 'no data' });
    }

    // Only process suppressed and bounce events
    const handledEvents = [
      'email.bounced',
      'email.suppressed',
      'email.complained',
    ];

    if (!handledEvents.includes(eventType)) {
      console.log(`[Resend Webhook] Ignoring event type: ${eventType}`);
      return res.status(200).json({ received: true, skipped: eventType });
    }

    const email = extractRecipientEmail(data);
    if (!email) {
      console.error('[Resend Webhook] Could not extract email from payload:', JSON.stringify(data, null, 2));
      return res.status(200).json({ received: true, error: 'no email found' });
    }

    const bounceType = classifyBounceType(eventType, data);
    const reason = data.reason || data.bounce?.message || data.description || data.message || eventType;

    console.log(`[Resend Webhook] Processing ${eventType} for ${email} (type: ${bounceType})`);

    await recordBounce({
      email,
      bounceType,
      reason: String(reason),
      sourceTenantId: null, // Resend webhooks don't carry tenant info
    });

    console.log(`[Resend Webhook] Successfully processed ${eventType} for ${email}`);
    return res.status(200).json({ received: true, processed: eventType, email });

  } catch (error) {
    console.error('[Resend Webhook] Error processing event:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POSTMARK WEBHOOK ENDPOINT ──────────────────────────────────────────────

webhookRoutes.post('/postmark', async (req, res) => {
  try {
    const data = req.body;
    const recordType = data.RecordType;
    console.log(`\n📨 [Postmark Webhook] Received event: ${recordType}`);

    // Only process bounce and spam complaint events
    const handledTypes = ['Bounce', 'SpamComplaint'];
    if (!handledTypes.includes(recordType)) {
      console.log(`[Postmark Webhook] Ignoring event type: ${recordType}`);
      return res.status(200).json({ received: true, skipped: recordType });
    }

    const email = data.Email;
    if (!email) {
      console.error('[Postmark Webhook] No email in payload');
      return res.status(200).json({ received: true, error: 'no email found' });
    }

    const bounceType = recordType === 'SpamComplaint' ? 'complaint' :
                        data.Type === 'HardBounce' ? 'hard' : 'soft';
    const reason = data.Description || data.Details || recordType;

    console.log(`[Postmark Webhook] Processing ${recordType} for ${email} (type: ${bounceType})`);

    await recordBounce({
      email,
      bounceType,
      reason: String(reason),
      sourceTenantId: null,
    });

    console.log(`[Postmark Webhook] Successfully processed ${recordType} for ${email}`);
    return res.status(200).json({ received: true, processed: recordType, email });

  } catch (error) {
    console.error('[Postmark Webhook] Error processing event:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GENERIC / MANUAL ENDPOINT ──────────────────────────────────────────────

/**
 * Manual endpoint to add an email to the suppression list.
 * POST /add { email, bounceType?, reason? }
 */
webhookRoutes.post('/add', async (req, res) => {
  try {
    const { email, bounceType, reason } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email is required' });
    }

    console.log(`\n📨 [Manual Add] Adding ${email} to suppression list`);

    await recordBounce({
      email,
      bounceType: bounceType || 'suppressed',
      reason: reason || 'Manually added to suppression list',
      sourceTenantId: null,
    });

    return res.status(200).json({ success: true, email: email.toLowerCase().trim() });

  } catch (error) {
    console.error('[Manual Add] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── LIST ENDPOINT ──────────────────────────────────────────────────────────

/**
 * GET /list - List all active suppressed/bounced emails
 */
webhookRoutes.get('/list', async (req, res) => {
  try {
    const entries = await db.query.bouncedEmails.findMany({
      where: eq(bouncedEmails.isActive, true as any),
      orderBy: sql`${bouncedEmails.lastBouncedAt} DESC`,
    });

    return res.status(200).json({
      count: entries.length,
      entries: entries.map((e: any) => ({
        email: e.email,
        bounceType: e.bounceType,
        reason: e.bounceReason,
        bounceCount: e.bounceCount,
        firstBouncedAt: e.firstBouncedAt,
        lastBouncedAt: e.lastBouncedAt,
      })),
    });
  } catch (error) {
    console.error('[List] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
