import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { forms, formResponses } from '@shared/schema';
import { authenticateToken, requireRole } from '../middleware/auth-middleware';
import { sanitizeString } from '../utils/sanitization';

export const formsRoutes = Router();

// Get all forms for the user's company
formsRoutes.get("/", authenticateToken, async (req: any, res) => {
  try {
    const { page = 1, limit = 50, search, published } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`${forms.tenantId} = ${req.user.tenantId}`;

    if (search) {
      const sanitizedSearch = sanitizeString(search as string);
      whereClause = sql`${whereClause} AND (
        ${forms.title} ILIKE ${`%${sanitizedSearch}%`} OR
        ${forms.description} ILIKE ${`%${sanitizedSearch}%`}
      )`;
    }

    if (published !== undefined) {
      whereClause = sql`${whereClause} AND ${forms.published} = ${published === 'true'}`;
    }

    const formsList = await db.query.forms.findMany({
      where: whereClause,
      orderBy: sql`${forms.updatedAt} DESC`,
      limit: Number(limit),
      offset,
    });

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(forms).where(whereClause);

    res.json({
      forms: formsList,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get forms error:', error);
    res.status(500).json({ message: 'Failed to get forms' });
  }
});

// Get specific form
formsRoutes.get("/:id", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;

    const form = await db.query.forms.findFirst({
      where: sql`${forms.id} = ${id} AND ${forms.tenantId} = ${req.user.tenantId}`,
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    res.json(form);
  } catch (error) {
    console.error('Get form error:', error);
    res.status(500).json({ message: 'Failed to get form' });
  }
});

// Create new form
formsRoutes.post("/", authenticateToken, async (req: any, res) => {
  try {
    const { title, description, formData, theme } = req.body;

    if (!title || !formData) {
      return res.status(400).json({ message: 'Title and formData are required' });
    }

    const sanitizedTitle = sanitizeString(title);
    const sanitizedDescription = description ? sanitizeString(description) : null;

    const newForm = await db.insert(forms).values({
      title: sanitizedTitle,
      description: sanitizedDescription,
      formData: JSON.stringify(formData),
      theme: theme || 'modern',
      tenantId: req.user.tenantId,
      userId: req.user.userId,
      isActive: true,
    }).returning();

    res.status(201).json(newForm[0]);
  } catch (error) {
    console.error('Create form error:', error);
    res.status(500).json({ message: 'Failed to create form' });
  }
});

// Update form
formsRoutes.put("/:id", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { title, description, schema, settings, theme, published } = req.body;

    // Check if form exists and belongs to user's company
    const existingForm = await db.query.forms.findFirst({
      where: sql`${forms.id} = ${id} AND ${forms.tenantId} = ${req.user.tenantId}`,
    });

    if (!existingForm) {
      return res.status(404).json({ message: 'Form not found' });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (title !== undefined) {
      updateData.title = sanitizeString(title);
    }

    if (description !== undefined) {
      updateData.description = description ? sanitizeString(description) : null;
    }

    if (schema !== undefined) {
      updateData.schema = JSON.stringify(schema);
    }

    if (settings !== undefined) {
      updateData.settings = settings ? JSON.stringify(settings) : null;
    }

    if (theme !== undefined) {
      updateData.theme = theme ? JSON.stringify(theme) : null;
    }

    if (published !== undefined) {
      updateData.published = published;
    }

    const updatedForm = await db.update(forms)
      .set(updateData)
      .where(sql`${forms.id} = ${id}`)
      .returning();

    res.json(updatedForm[0]);
  } catch (error) {
    console.error('Update form error:', error);
    res.status(500).json({ message: 'Failed to update form' });
  }
});

// Delete form
formsRoutes.delete("/:id", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;

    // Check if form exists and belongs to user's company
    const existingForm = await db.query.forms.findFirst({
      where: sql`${forms.id} = ${id} AND ${forms.tenantId} = ${req.user.tenantId}`,
    });

    if (!existingForm) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // Delete form (this will cascade to form responses)
    await db.delete(forms)
      .where(sql`${forms.id} = ${id}`);

    res.json({ message: 'Form deleted successfully' });
  } catch (error) {
    console.error('Delete form error:', error);
    res.status(500).json({ message: 'Failed to delete form' });
  }
});

// Get form responses
formsRoutes.get("/:id/responses", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Check if form exists and belongs to user's company
    const form = await db.query.forms.findFirst({
      where: sql`${forms.id} = ${id} AND ${forms.tenantId} = ${req.user.tenantId}`,
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    const responses = await db.query.formResponses.findMany({
      where: sql`${db.formResponses.formId} = ${id}`,
      orderBy: sql`${db.formResponses.submittedAt} DESC`,
      limit: Number(limit),
      offset,
    });

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(db.formResponses).where(sql`${db.formResponses.formId} = ${id}`);

    res.json({
      responses,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get form responses error:', error);
    res.status(500).json({ message: 'Failed to get form responses' });
  }
});

// Get form statistics
formsRoutes.get("/:id/stats", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;

    // Check if form exists and belongs to user's company
    const form = await db.query.forms.findFirst({
      where: sql`${forms.id} = ${id} AND ${forms.tenantId} = ${req.user.tenantId}`,
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    const stats = await db.select({
      totalResponses: sql<number>`count(*)`,
      responsesToday: sql<number>`count(*) filter (where submitted_at >= current_date)`,
      responsesThisWeek: sql<number>`count(*) filter (where submitted_at >= current_date - interval '7 days')`,
      responsesThisMonth: sql<number>`count(*) filter (where submitted_at >= current_date - interval '30 days')`,
    }).from(db.formResponses).where(sql`${db.formResponses.formId} = ${id}`);

    res.json(stats[0]);
  } catch (error) {
    console.error('Get form stats error:', error);
    res.status(500).json({ message: 'Failed to get form statistics' });
  }
});

// Public form access (no authentication required)
formsRoutes.get("/public/:id", async (req: any, res) => {
  try {
    const { id } = req.params;

    const form = await db.query.forms.findFirst({
      where: sql`${forms.id} = ${id} AND ${forms.published} = true`,
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found or not published' });
    }

    // Return only the necessary data for public access
    res.json({
      id: form.id,
      title: form.title,
      description: form.description,
      schema: JSON.parse(form.schema),
      settings: form.settings ? JSON.parse(form.settings) : null,
      theme: form.theme ? JSON.parse(form.theme) : null,
    });
  } catch (error) {
    console.error('Get public form error:', error);
    res.status(500).json({ message: 'Failed to get form' });
  }
});

// Submit form response (public endpoint)
formsRoutes.post("/public/:id/submit", async (req: any, res) => {
  try {
    const { id } = req.params;
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ message: 'Form data is required' });
    }

    // Check if form exists and is published
    const form = await db.query.forms.findFirst({
      where: sql`${forms.id} = ${id} AND ${forms.published} = true`,
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found or not published' });
    }

    // Create form response
    const newResponse = await db.insert(formResponses).values({
      formId: id,
      data: JSON.stringify(data),
      submittedAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    }).returning();

    res.status(201).json({
      message: 'Form submitted successfully',
      responseId: newResponse[0].id,
    });
  } catch (error) {
    console.error('Submit form error:', error);
    res.status(500).json({ message: 'Failed to submit form' });
  }
});

// Serve form embed script
formsRoutes.get("/js/authentik-forms.js", (req: any, res) => {
  const script = `
    (function() {
      // Authentik Forms Embed Script
      console.log('Authentik Forms script loaded');
    })();
  `;
  
  res.setHeader('Content-Type', 'application/javascript');
  res.send(script);
});

// Form embed example page
formsRoutes.get("/embed-example", (req: any, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Form Embed Example</title>
    </head>
    <body>
      <h1>Form Embed Example</h1>
      <p>This is an example of how to embed forms.</p>
    </body>
    </html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Simple form example page
formsRoutes.get("/simple-example", (req: any, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Simple Form Example</title>
    </head>
    <body>
      <h1>Simple Form Example</h1>
      <p>This is a simple form example.</p>
    </body>
    </html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});