import { Router } from 'express';
import { db } from '../db';
import { sql, eq, and, like, desc, inArray } from 'drizzle-orm';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { createNewsletterSchema, updateNewsletterSchema, insertNewsletterSchema, newsletters, betterAuthUser, emailContacts, contactTagAssignments, bouncedEmails, unsubscribeTokens } from '@shared/schema';
import { sanitizeString } from '../utils/sanitization';
import { emailService, enhancedEmailService } from '../emailService';
// Temporal service removed - now using server-node proxy
import crypto from 'crypto';

export const newsletterRoutes = Router();

// Helper function to get newsletter recipients based on segmentation
async function getNewsletterRecipients(newsletter: any, tenantId: string) {
  console.log(`[Newsletter] Getting recipients for newsletter ${newsletter.id}, type: ${newsletter.recipientType}`);
  
  try {
    let recipients: Array<{ id: string; email: string; firstName?: string; lastName?: string }> = [];

    switch (newsletter.recipientType) {
      case 'all':
        // Get all active email contacts for the tenant
        recipients = await db.query.emailContacts.findMany({
          where: and(
            eq(emailContacts.tenantId, tenantId),
            eq(emailContacts.status, 'active')
          ),
          columns: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        });
        break;

      case 'selected':
        // Get specific contacts by IDs
        if (newsletter.selectedContactIds && newsletter.selectedContactIds.length > 0) {
          recipients = await db.query.emailContacts.findMany({
            where: and(
              eq(emailContacts.tenantId, tenantId),
              inArray(emailContacts.id, newsletter.selectedContactIds),
              eq(emailContacts.status, 'active')
            ),
            columns: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            }
          });
        }
        break;

      case 'tags':
        // Get contacts by tag IDs
        if (newsletter.selectedTagIds && newsletter.selectedTagIds.length > 0) {
          const contactIds = await db
            .select({ contactId: contactTagAssignments.contactId })
            .from(contactTagAssignments)
            .where(inArray(contactTagAssignments.tagId, newsletter.selectedTagIds));

          if (contactIds.length > 0) {
            recipients = await db.query.emailContacts.findMany({
              where: and(
                eq(emailContacts.tenantId, tenantId),
                inArray(emailContacts.id, contactIds.map(c => c.contactId)),
                eq(emailContacts.status, 'active')
              ),
              columns: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              }
            });
          }
        }
        break;

      default:
        console.warn(`[Newsletter] Unknown recipient type: ${newsletter.recipientType}`);
        break;
    }

    console.log(`[Newsletter] Found ${recipients.length} recipients for newsletter ${newsletter.id}`);
    return recipients;
  } catch (error) {
    console.error(`[Newsletter] Error getting recipients for newsletter ${newsletter.id}:`, error);
    throw error;
  }
}

// Get all newsletters
newsletterRoutes.get("/", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`${newsletters.tenantId} = ${req.user.tenantId}`;

    if (search) {
      const sanitizedSearch = sanitizeString(search as string);
      whereClause = sql`${whereClause} AND (
        ${newsletters.subject} ILIKE ${`%${sanitizedSearch}%`} OR
        ${newsletters.title} ILIKE ${`%${sanitizedSearch}%`}
      )`;
    }

    if (status) {
      whereClause = sql`${whereClause} AND ${newsletters.status} = ${status}`;
    }

    const allNewsletters = await db.query.newsletters.findMany({
      where: whereClause,
      orderBy: desc(newsletters.createdAt),
      limit: Number(limit),
      offset,
      with: {
        user: true
      }
    });

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(newsletters).where(whereClause);

    res.json({
      newsletters: allNewsletters,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get newsletters error:', error);
    res.status(500).json({ message: 'Failed to get newsletters' });
  }
});

// Get specific newsletter
newsletterRoutes.get("/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId}`,
      with: {
        user: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    res.json({ newsletter });
  } catch (error) {
    console.error('Get newsletter error:', error);
    res.status(500).json({ message: 'Failed to get newsletter' });
  }
});

import { requireRole } from '../middleware/auth-middleware';

// Create newsletter
newsletterRoutes.post("/", authenticateToken, requireTenant, requireRole(['Owner', 'Administrator', 'Manager']), async (req: any, res) => {
  try {
    const validatedData = createNewsletterSchema.parse(req.body);
    const { title, subject, content, scheduledAt, status } = validatedData;

    const sanitizedTitle = sanitizeString(title);
    const sanitizedSubject = sanitizeString(subject);

    // Get the correct user ID from the betterAuthUser table based on email
    // since authentication uses betterAuthUser and newsletters now reference betterAuthUser table
    const userRecord = await db.query.betterAuthUser.findFirst({
      where: sql`${betterAuthUser.email} = ${req.user.email}`,
    });

    if (!userRecord) {
      console.error('User not found in betterAuthUser table for newsletter creation:', req.user.email);
      return res.status(404).json({ message: 'User account not found. Please contact support.' });
    }

    const newNewsletter = await db.insert(newsletters).values({
      tenantId: req.user.tenantId,
      userId: userRecord.id,
      title: sanitizedTitle,
      subject: sanitizedSubject,
      content,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: status || 'draft',
      recipientType: 'all',
      recipientCount: 0,
      openCount: 0,
      uniqueOpenCount: 0,
      clickCount: 0,
    } as any).returning();

    res.status(201).json(newNewsletter[0]);
  } catch (error) {
    console.error('Create newsletter error:', error);
    res.status(500).json({ message: 'Failed to create newsletter' });
  }
});

// Update newsletter
newsletterRoutes.put("/:id", authenticateToken, requireTenant, requireRole(['Owner', 'Administrator', 'Manager']), async (req: any, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateNewsletterSchema.parse(req.body);
    const { title, subject, content, scheduledAt, status } = validatedData;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId}`,
      with: {
        user: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (title !== undefined) {
      updateData.title = sanitizeString(title);
    }

    if (subject !== undefined) {
      updateData.subject = sanitizeString(subject);
    }

    if (content !== undefined) {
      updateData.content = content;
    }


    if (scheduledAt !== undefined) {
      updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    const updatedNewsletter = await db.update(newsletters)
      .set(updateData)
      .where(sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId}`)
      .returning();

    res.json(updatedNewsletter[0]);
  } catch (error) {
    console.error('Update newsletter error:', error);
    res.status(500).json({ message: 'Failed to update newsletter' });
  }
});

// Delete newsletter
newsletterRoutes.delete("/:id", authenticateToken, requireTenant, requireRole(['Owner', 'Administrator']), async (req: any, res) => {
  try {
    const { id } = req.params;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId}`,
      with: {
        user: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    // Delete newsletter
    await db.delete(newsletters)
      .where(sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId}`);

    res.json({ message: 'Newsletter deleted successfully' });
  } catch (error) {
    console.error('Delete newsletter error:', error);
    res.status(500).json({ message: 'Failed to delete newsletter' });
  }
});


// Get detailed newsletter statistics
newsletterRoutes.get("/:id/detailed-stats", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId}`,
      with: {
        user: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    // Get newsletter statistics (placeholder - you might have more specific metrics)
    const stats = {
      newsletterId: id,
      totalSent: 0, // Placeholder
      totalDelivered: 0, // Placeholder
      totalOpened: 0, // Placeholder
      totalClicked: 0, // Placeholder
      totalBounced: 0, // Placeholder
      totalUnsubscribed: 0, // Placeholder
      openRate: 0, // Placeholder
      clickRate: 0, // Placeholder
      bounceRate: 0, // Placeholder
      createdAt: newsletter.createdAt,
      sentAt: newsletter.sentAt,
    };

    res.json(stats);
  } catch (error) {
    console.error('Get detailed newsletter stats error:', error);
    res.status(500).json({ message: 'Failed to get detailed newsletter statistics' });
  }
});

// Get email trajectory
newsletterRoutes.get("/emails/:resendId/trajectory", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { resendId } = req.params;

    // This is a placeholder for email trajectory tracking
    // You would typically fetch this data from your email service provider
    const trajectory = {
      resendId,
      events: [
        {
          type: 'sent',
          timestamp: new Date().toISOString(),
          status: 'success',
        },
        {
          type: 'delivered',
          timestamp: new Date(Date.now() + 1000).toISOString(),
          status: 'success',
        },
      ],
    };

    res.json(trajectory);
  } catch (error) {
    console.error('Get email trajectory error:', error);
    res.status(500).json({ message: 'Failed to get email trajectory' });
  }
});

// Get newsletter task status
newsletterRoutes.get("/:id/task-status", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const newsletter = await db.query.newsletters.findFirst({
      where: sql`${newsletters.id} = ${id} AND ${newsletters.tenantId} = ${req.user.tenantId}`,
      with: {
        user: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    // Get task status (placeholder)
    const taskStatus = {
      newsletterId: id,
      status: 'pending', // pending, processing, completed, failed
      progress: 0,
      totalRecipients: 0,
      processedRecipients: 0,
      failedRecipients: 0,
      startedAt: null,
      completedAt: null,
      error: null,
    };

    res.json(taskStatus);
  } catch (error) {
    console.error('Get newsletter task status error:', error);
    res.status(500).json({ message: 'Failed to get newsletter task status' });
  }
});

// Update newsletter status (internal service endpoint for temporal server)
newsletterRoutes.put("/:id/status", async (req: any, res) => {
  try {
    // Check for internal service authentication
    const internalServiceHeader = req.headers['x-internal-service'];
    if (internalServiceHeader !== 'temporal-server') {
      return res.status(403).json({ message: 'Unauthorized: Internal service access only' });
    }

    const { id } = req.params;
    const { status, metadata } = req.body;

    console.log(`[Newsletter] Updating newsletter ${id} status to: ${status}`);

    // Update newsletter status in database
    const updatedNewsletter = await db.update(newsletters)
      .set({
        status,
        ...(metadata && {
          recipientCount: metadata.recipientCount,
          updatedAt: new Date(),
        }),
        ...(status === 'sent' && metadata?.completedAt && {
          sentAt: new Date(metadata.completedAt)
        })
      })
      .where(eq(newsletters.id, id))
      .returning();

    if (updatedNewsletter.length === 0) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    console.log(`[Newsletter] Successfully updated newsletter ${id} status to: ${status}`);
    res.json({ 
      message: 'Newsletter status updated successfully',
      newsletter: updatedNewsletter[0]
    });

  } catch (error) {
    console.error('Update newsletter status error:', error);
    res.status(500).json({ message: 'Failed to update newsletter status' });
  }
});

// Log newsletter activity (internal service endpoint for temporal server)
newsletterRoutes.post("/:id/log", async (req: any, res) => {
  try {
    // Check for internal service authentication
    const internalServiceHeader = req.headers['x-internal-service'];
    if (internalServiceHeader !== 'temporal-server') {
      return res.status(403).json({ message: 'Unauthorized: Internal service access only' });
    }

    const { id } = req.params;
    const { activity, details, timestamp } = req.body;

    console.log(`[Newsletter Activity] ${id}: ${activity}`, {
      details,
      timestamp,
      source: 'temporal-server'
    });

    // Here you could store activity logs in a separate table if needed
    // For now, we just log to console and return success
    
    res.json({ 
      message: 'Newsletter activity logged successfully',
      newsletterId: id,
      activity,
      timestamp
    });

  } catch (error) {
    console.error('Log newsletter activity error:', error);
    res.status(500).json({ message: 'Failed to log newsletter activity' });
  }
});

// Update newsletter task status
newsletterRoutes.post("/:id/task-status", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { status, progress, totalRecipients, processedRecipients, failedRecipients, error } = req.body;

    const newsletter = await db.query.newsletters.findFirst({
      where: eq(newsletters.id, id),
      with: {
        user: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    // Update task status (placeholder - you might have a separate task status table)
    const taskStatus = {
      newsletterId: id,
      status: status || 'pending',
      progress: progress || 0,
      totalRecipients: totalRecipients || 0,
      processedRecipients: processedRecipients || 0,
      failedRecipients: failedRecipients || 0,
      startedAt: status === 'processing' ? new Date().toISOString() : null,
      completedAt: status === 'completed' ? new Date().toISOString() : null,
      error: error || null,
    };

    res.json(taskStatus);
  } catch (error) {
    console.error('Update newsletter task status error:', error);
    res.status(500).json({ message: 'Failed to update newsletter task status' });
  }
});

// Update specific task status
newsletterRoutes.put("/:newsletterId/task-status/:taskId", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { newsletterId, taskId } = req.params;
    const { status, progress, error } = req.body;

    const newsletter = await db.query.newsletters.findFirst({
      where: eq(newsletters.id, newsletterId),
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    // Update specific task status (placeholder)
    const taskStatus = {
      taskId,
      newsletterId,
      status: status || 'pending',
      progress: progress || 0,
      error: error || null,
      updatedAt: new Date().toISOString(),
    };

    res.json(taskStatus);
  } catch (error) {
    console.error('Update specific task status error:', error);
    res.status(500).json({ message: 'Failed to update task status' });
  }
});

// Initialize newsletter tasks
newsletterRoutes.post("/:id/initialize-tasks", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const newsletter = await db.query.newsletters.findFirst({
      where: eq(newsletters.id, id),
      with: {
        user: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    // Initialize tasks for newsletter sending (placeholder)
    const tasks = [
      {
        id: `task-${id}-1`,
        type: 'prepare_recipients',
        status: 'pending',
        progress: 0,
      },
      {
        id: `task-${id}-2`,
        type: 'send_emails',
        status: 'pending',
        progress: 0,
      },
      {
        id: `task-${id}-3`,
        type: 'track_results',
        status: 'pending',
        progress: 0,
      },
    ];

    res.json({
      message: 'Newsletter tasks initialized successfully',
      newsletterId: id,
      tasks,
    });
  } catch (error) {
    console.error('Initialize newsletter tasks error:', error);
    res.status(500).json({ message: 'Failed to initialize newsletter tasks' });
  }
});

// Send newsletter - Updated to follow the flowchart
newsletterRoutes.post("/:id/send", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { testEmail } = req.body;

    // Execute Auth Ver checks (from flowchart)
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ message: 'Authentication verification failed' });
    }

    const newsletter = await db.query.newsletters.findFirst({
      where: and(
        eq(newsletters.id, id),
        eq(newsletters.tenantId, req.user.tenantId)
      ),
      with: {
        user: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    if (newsletter.status === 'sent') {
      return res.status(400).json({ message: 'Newsletter has already been sent' });
    }

    // If test email is provided, send test email
    if (testEmail) {
      try {
        await emailService.sendCustomEmail(testEmail, newsletter.subject, newsletter.content, 'test');
        res.json({
          message: 'Test newsletter sent successfully',
          testEmail,
        });
      } catch (emailError) {
        console.error('Failed to send test newsletter:', emailError);
        res.status(500).json({ message: 'Failed to send test newsletter' });
      }
      return;
    }

    // Save Newsletter to DB (update status)
    await db.update(newsletters)
      .set({
        status: 'sending',
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(newsletters.id, id));

    try {
      // Generate unique group UUID for tracking
      const groupUUID = crypto.randomUUID();
      console.log(`[Newsletter] Starting to send newsletter ${id} with groupUUID: ${groupUUID}`);

      // Get recipients based on newsletter segmentation
      const recipients = await getNewsletterRecipients(newsletter, req.user.tenantId);

      // Global suppression filter: remove recipients present in global bounced/suppressed list
      const suppressed = await db.select({ email: bouncedEmails.email, type: bouncedEmails.bounceType })
        .from(bouncedEmails)
        .where(sql`${bouncedEmails.isActive} = ${true}`);

      const suppressedMap = new Map<string, string>(suppressed.map(r => [String(r.email).toLowerCase().trim(), r.type]));

      const dedupedRecipients = Array.from(new Map(recipients.map((r: any) => [String(r.email).toLowerCase().trim(), r])).values());
      const allowedRecipients = dedupedRecipients.filter((r: any) => !suppressedMap.has(String(r.email).toLowerCase().trim()));
      const blockedRecipients = dedupedRecipients.filter((r: any) => suppressedMap.has(String(r.email).toLowerCase().trim()));

      if (blockedRecipients.length > 0) {
        console.log(`[Newsletter] Suppressed ${blockedRecipients.length} recipient(s) due to global bans/bounces.`);

        // Update contact status for blocked recipients based on suppression type
        const complaintEmails = blockedRecipients
          .filter((r: any) => suppressedMap.get(String(r.email).toLowerCase().trim()) === 'complaint')
          .map((r: any) => String(r.email).toLowerCase().trim());

        const bouncedTypeEmails = blockedRecipients
          .filter((r: any) => suppressedMap.get(String(r.email).toLowerCase().trim()) !== 'complaint')
          .map((r: any) => String(r.email).toLowerCase().trim());

        if (complaintEmails.length > 0) {
          await db.update(emailContacts)
            .set({ status: 'unsubscribed' as any, updatedAt: new Date() as any })
            .where(and(eq(emailContacts.tenantId, req.user.tenantId), inArray(emailContacts.email, complaintEmails)));
        }
        if (bouncedTypeEmails.length > 0) {
          await db.update(emailContacts)
            .set({ status: 'bounced' as any, updatedAt: new Date() as any })
            .where(and(eq(emailContacts.tenantId, req.user.tenantId), inArray(emailContacts.email, bouncedTypeEmails)));
        }
      }

      if (allowedRecipients.length === 0) {
        await db.update(newsletters)
          .set({ status: 'draft', updatedAt: new Date() })
          .where(eq(newsletters.id, id));
        return res.status(400).json({ message: 'All recipients are globally suppressed. No emails will be sent.' });
      }
      
      if (recipients.length === 0) {
        await db.update(newsletters)
          .set({
            status: 'draft',
            updatedAt: new Date(),
          })
          .where(eq(newsletters.id, id));

        return res.status(400).json({ 
          message: 'No recipients found for newsletter. Please check your segmentation settings or add email contacts.' 
        });
      }

      console.log(`[Newsletter] Found ${recipients.length} recipients for newsletter ${id}. ${allowedRecipients.length} allowed after suppression filter.`);

      // Send to Temporal Server via GRPC to create newsletter workflow
      try {
        console.log(`[Newsletter] Sending to temporal server via GRPC for newsletter workflow creation`);
        
        // Prepare the request for temporal server
        const temporalRequest = {
          newsletter_id: newsletter.id,
          tenant_id: req.user.tenantId,
          user_id: req.user.id,
          group_uuid: groupUUID,
          subject: newsletter.subject,
          content: newsletter.content,
          recipients: allowedRecipients.map((contact: { id: string; email: string; firstName?: string; lastName?: string }) => ({
            id: contact.id,
            email: contact.email,
            first_name: contact.firstName || '',
            last_name: contact.lastName || ''
          })),
          metadata: {
            tags: [`newsletter-${newsletter.id}`, `group-${groupUUID}`, `tenant-${req.user.tenantId}`]
          },
          batch_size: 50 // Add batch size configuration
        };

        // Send to server-node for temporal processing
        console.log('📧 [Newsletter Proxy] Forwarding newsletter request to server-node');
        
        // Get the session token from cookies to forward to server-node
        const sessionToken = req.cookies?.['better-auth.session_token'];
        console.log('📧 [Newsletter Proxy] Session token found:', sessionToken ? 'Yes' : 'No');
        
        const response = await fetch('http://localhost:3502/api/newsletter/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': sessionToken ? `Bearer ${sessionToken}` : '',
            'Cookie': sessionToken ? `better-auth.session_token=${sessionToken}` : '',
          },
          body: JSON.stringify(temporalRequest)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ [Newsletter Proxy] server-node returned error:', response.status, errorText);
          throw new Error(`server-node request failed: ${errorText}`);
        }

        const temporalResponse = await response.json();

        if (!temporalResponse.success) {
          throw new Error(`Temporal server returned error: ${temporalResponse.error}`);
        }

        console.log(`[Newsletter] Temporal newsletter workflow created:`, {
          workflowId: temporalResponse.workflow_id,
          runId: temporalResponse.run_id,
          newsletterId: temporalResponse.newsletter_id
        });

        // Update newsletter status to sent
        await db.update(newsletters)
          .set({
            status: 'sent',
            recipientCount: recipients.length,
            updatedAt: new Date(),
          })
          .where(eq(newsletters.id, id));

        // Return success response
        res.json({
          message: 'Newsletter workflow started successfully',
          workflowId: temporalResponse.workflow_id,
          runId: temporalResponse.run_id,
          newsletterId: temporalResponse.newsletter_id,
          groupUUID: temporalResponse.group_uuid,
          recipientCount: recipients.length
        });

      } catch (temporalError: any) {
        console.error(`[Newsletter] Failed to create temporal newsletter workflow:`, temporalError);
        
        // Fallback to direct sending if temporal server is unavailable
        console.log(`[Newsletter] Falling back to direct email sending`);
        
        // Generate or reuse unsubscribe tokens per recipient (single-use, long-lived until used)
        const tokenMap = new Map<string, string>();
        for (const r of allowedRecipients) {
          let unsub = await db.query.unsubscribeTokens.findFirst({
            where: and(eq(unsubscribeTokens.tenantId, req.user.tenantId), eq(unsubscribeTokens.contactId, r.id), sql`${unsubscribeTokens.usedAt} IS NULL`),
          });
          if (!unsub) {
            const token = crypto.randomBytes(24).toString('base64url');
            const created = await db.insert(unsubscribeTokens).values({ tenantId: req.user.tenantId, contactId: r.id, token }).returning();
            unsub = created[0];
          }
          tokenMap.set(r.id, unsub.token);
        }

        // Prepare emails for batch sending (append unsubscribe link)
        const emails = allowedRecipients.map((contact: { id: string; email: string; firstName?: string; lastName?: string }) => {
          const token = tokenMap.get(contact.id)!;
          const unsubscribeUrl = `${req.protocol}://${req.get('host')}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
          const html = `${newsletter.content}
            <div style="padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a>
              </p>
            </div>`;
          const text = `${newsletter.content.replace(/<[^>]*>/g, '')}\n\nUnsubscribe: ${unsubscribeUrl}`;
          return {
            to: contact.email,
            subject: newsletter.subject,
            html,
            text,
            headers: {
              'List-Unsubscribe': `<${unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            },
            metadata: {
              type: 'newsletter',
              newsletterId: newsletter.id,
              groupUUID,
              recipientId: contact.id,
              tags: [`newsletter-${newsletter.id}`, `groupUUID-${groupUUID}`]
            }
          };
        });

        // Send emails in batches
        console.log(`[Newsletter] Sending ${emails.length} emails for newsletter ${id} (after suppression filter)`);
        const result = await enhancedEmailService.sendBatchEmails(emails, {
          batchSize: 10,
          delayBetweenBatches: 1000 // 1 second delay between batches
        });

        console.log(`[Newsletter] Batch sending complete for ${id}:`, {
          queued: result.queued.length,
          errors: result.errors.length
        });

        // Update newsletter status based on results
        const successful = result.queued.length;
        const failed = result.errors.length;
        const totalSent = successful + failed;

        await db.update(newsletters)
          .set({
            status: 'sent',
            recipientCount: totalSent,
            updatedAt: new Date(),
          })
          .where(eq(newsletters.id, id));

        res.json({
          message: 'Newsletter sent successfully (direct mode)',
          newsletterId: id,
          status: 'sent',
          successful,
          failed,
          total: totalSent,
          groupUUID,
          note: 'Temporal server was unavailable, sent directly'
        });
      }

    } catch (sendError) {
      console.error(`[Newsletter] Failed to send newsletter ${id}:`, sendError);
      
      // Update newsletter status back to draft on failure
      await db.update(newsletters)
        .set({
          status: 'draft',
          updatedAt: new Date(),
        })
        .where(eq(newsletters.id, id));

      res.status(500).json({ 
        message: 'Failed to create temporal workflow for newsletter sending',
        error: sendError instanceof Error ? sendError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Send newsletter error:', error);
    res.status(500).json({ message: 'Failed to send newsletter' });
  }
});

// Endpoint for sending a single newsletter email (called by Temporal activities)
newsletterRoutes.post('/:id/send-single', async (req, res) => {
  try {
    const { id } = req.params;
    const { recipient, subject, content, groupUUID, tenantId } = req.body;

    console.log(`[Newsletter] Sending single email for newsletter ${id} to ${recipient.email}`);

    // Pre-send suppression filter for single-send as a safety net
    try {
      const [suppressed] = await db.select({ email: bouncedEmails.email, type: bouncedEmails.bounceType })
        .from(bouncedEmails)
        .where(and(
          eq(bouncedEmails.isActive, true as any),
          sql`${bouncedEmails.email} = ${String(recipient.email).toLowerCase().trim()}`
        ));

      if (suppressed) {
        console.warn(`[Newsletter] Blocking send to suppressed email: ${recipient.email} (type=${suppressed.type})`);

        // Update contact status based on suppression type
        const lowerEmail = String(recipient.email).toLowerCase().trim();
        const statusUpdate = suppressed.type === 'complaint' ? 'unsubscribed' : 'bounced';
        await db.update(emailContacts)
          .set({ status: statusUpdate as any, updatedAt: new Date() as any })
          .where(and(eq(emailContacts.tenantId, tenantId), sql`${emailContacts.email} = ${lowerEmail}`));

        return res.json({
          success: true,
          blocked: true,
          reason: suppressed.type,
          recipient: recipient.email,
        });
      }
    } catch (suppressionError) {
      console.error('[Newsletter] Suppression check failed, proceeding cautiously:', suppressionError);
    }

    // Prepare the email message
    // Generate or reuse unsubscribe token (single-use, long-lived until used)
    let unsub = await db.query.unsubscribeTokens.findFirst({
      where: and(eq(unsubscribeTokens.tenantId, tenantId), eq(unsubscribeTokens.contactId, recipient.id), sql`${unsubscribeTokens.usedAt} IS NULL`),
    });
    if (!unsub) {
      const token = crypto.randomBytes(24).toString('base64url');
      const created = await db.insert(unsubscribeTokens).values({ tenantId, contactId: recipient.id, token }).returning();
      unsub = created[0];
    }
    const unsubscribeUrl = `${req.protocol}://${req.get('host')}/api/email/unsubscribe?token=${encodeURIComponent(unsub.token)}`;

    const email = {
      to: recipient.email,
      subject: subject,
      html: `${content}
        <div style="padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">
            <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a>
          </p>
        </div>`,
      from: process.env.EMAIL_FROM || 'noreply@saas-app.com',
      tags: [
        `newsletter-${id}`,
        `groupUUID-${groupUUID}`,
        `tenant-${tenantId}`,
        `contact-${recipient.id}`
      ]
    };

    // Send email using the enhanced email service
    try {
      const result = await enhancedEmailService.sendCustomEmail(
        email.to,
        email.subject,
        email.html,
        {
          from: email.from,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
          },
          metadata: { tags: email.tags },
        }
      );

      console.log(`[Newsletter] Email sent successfully to ${recipient.email}:`, result);

      res.json({
        success: true,
        messageId: result.id || result.messageId,
        recipient: recipient.email
      });

    } catch (sendError) {
      console.error(`[Newsletter] Failed to send email to ${recipient.email}:`, sendError);
      res.status(500).json({
        success: false,
        error: sendError instanceof Error ? sendError.message : 'Failed to send email',
        recipient: recipient.email
      });
    }

  } catch (error) {
    console.error('[Newsletter] Send single email error:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});