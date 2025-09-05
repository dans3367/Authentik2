import { Router } from 'express';
import { db } from '../db';
import { sql, eq, and, like, desc } from 'drizzle-orm';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { createNewsletterSchema, updateNewsletterSchema, newsletters } from '@shared/schema';
import { sanitizeString } from '../utils/sanitization';
import { emailService } from '../emailService';

export const newsletterRoutes = Router();

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

    res.json(newsletter);
  } catch (error) {
    console.error('Get newsletter error:', error);
    res.status(500).json({ message: 'Failed to get newsletter' });
  }
});

// Create newsletter
newsletterRoutes.post("/", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const validatedData = createNewsletterSchema.parse(req.body);
    const { title, subject, content, scheduledAt, status } = validatedData;

    const sanitizedTitle = sanitizeString(title);
    const sanitizedSubject = sanitizeString(subject);

    const newNewsletter = await db.insert(newsletters).values({
      tenantId: req.user.tenantId,
      userId: req.user.userId,
      title: sanitizedTitle,
      subject: sanitizedSubject,
      content,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: status || 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    res.status(201).json(newNewsletter[0]);
  } catch (error) {
    console.error('Create newsletter error:', error);
    res.status(500).json({ message: 'Failed to create newsletter' });
  }
});

// Update newsletter
newsletterRoutes.put("/:id", authenticateToken, requireTenant, async (req: any, res) => {
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
newsletterRoutes.delete("/:id", authenticateToken, requireTenant, async (req: any, res) => {
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

// Update newsletter task status
newsletterRoutes.post("/:id/task-status", authenticateToken, async (req: any, res) => {
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
newsletterRoutes.put("/:newsletterId/task-status/:taskId", authenticateToken, async (req: any, res) => {
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
newsletterRoutes.post("/:id/initialize-tasks", authenticateToken, async (req: any, res) => {
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

// Send newsletter
newsletterRoutes.post("/:id/send", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { testEmail } = req.body;

    const newsletter = await db.query.newsletters.findFirst({
      where: eq(newsletters.id, id),
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

    // Update newsletter status to sending
    await db.update(newsletters)
      .set({
        status: 'sending',
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(newsletters.id, id));

    // Here you would typically:
    // 1. Get the email list
    // 2. Queue the emails for sending
    // 3. Process them in batches
    // 4. Update the newsletter status to 'sent' when complete

    res.json({
      message: 'Newsletter sending initiated successfully',
      newsletterId: id,
      status: 'sending',
    });
  } catch (error) {
    console.error('Send newsletter error:', error);
    res.status(500).json({ message: 'Failed to send newsletter' });
  }
});