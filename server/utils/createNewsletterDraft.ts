import { sql } from 'drizzle-orm';
import { db } from '../db';
import { betterAuthUser, newsletters } from '@shared/schema';
import { sanitizeString } from './sanitization';
import { logActivity } from './activityLogger';
import { syncNewsletterToConvex } from './convexNewsletterListSync';

export interface CreateNewsletterDraftInput {
  tenantId: string;
  userEmail: string;
  shopId?: string | null;
  title: string;
  subject: string;
  content?: string | null;
  /** Either a JSON string (as posted by the Puck editor) or a plain object that will be stringified. */
  puckData?: unknown | null;
  scheduledAt?: Date | null;
  emailType?: 'newsletter' | 'advertise';
  req?: any;
}

export interface CreateNewsletterDraftResult {
  newsletter: typeof newsletters.$inferSelect;
  userId: string;
}

/**
 * Insert a new newsletter row in draft status, log the activity, and sync to
 * Convex for realtime kanban updates. Shared by the standard create endpoint
 * and the AI wizard finalize endpoint so both paths go through the same logic.
 */
export async function createNewsletterDraft(
  input: CreateNewsletterDraftInput,
): Promise<CreateNewsletterDraftResult> {
  const { tenantId, userEmail, shopId = null, title, subject, content = '', puckData = null, scheduledAt = null, emailType = 'newsletter', req } = input;

  const sanitizedTitle = sanitizeString(title);
  const sanitizedSubject = sanitizeString(subject);

  const userRecord = await db.query.betterAuthUser.findFirst({
    where: sql`${betterAuthUser.email} = ${userEmail}`,
  });

  if (!userRecord) {
    throw new Error('User account not found in betterAuthUser table');
  }

  const puckDataSerialized =
    puckData == null
      ? null
      : typeof puckData === 'string'
      ? puckData
      : JSON.stringify(puckData);

  const inserted = await db.insert(newsletters).values({
    tenantId,
    shopId,
    userId: userRecord.id,
    title: sanitizedTitle,
    subject: sanitizedSubject,
    content: content || '',
    puckData: puckDataSerialized,
    scheduledAt,
    status: 'draft',
    emailType,
    recipientType: 'all',
    recipientCount: 0,
    openCount: 0,
    uniqueOpenCount: 0,
    clickCount: 0,
  } as any).returning();

  const newsletter = inserted[0];

  await logActivity({
    tenantId,
    userId: userRecord.id,
    entityType: 'newsletter',
    entityId: newsletter.id,
    entityName: sanitizedTitle,
    activityType: 'created',
    description: `Created newsletter "${sanitizedTitle}"`,
    metadata: { subject: sanitizedSubject, status: 'draft' },
    req,
  });

  syncNewsletterToConvex({ ...newsletter, user: { firstName: userRecord.firstName, lastName: userRecord.lastName } });

  return { newsletter, userId: userRecord.id };
}
