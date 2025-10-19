import { Router } from 'express';
import { db } from '../db';
import { sql, eq, and, ilike, or, asc, desc } from 'drizzle-orm';
import { templates, betterAuthUser } from '@shared/schema';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { sanitizeString } from '../utils/sanitization';
import type { TemplateFilters, CreateTemplateData, UpdateTemplateData } from '@shared/schema';

export const templateRoutes = Router();

// Get all templates for the tenant with filtering and search
templateRoutes.get("/", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    // Double-check tenant ID is present (defense in depth)
    if (!req.user?.tenantId) {
      console.error('❌ [Templates] Missing tenant ID in request');
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    console.log('🔍 [Templates] Fetching templates for tenant:', req.user.tenantId, 'user:', req.user.email);

    const { 
      page = 1, 
      limit = 50, 
      search, 
      channel, 
      category, 
      favoritesOnly,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    // Build conditions for tenant isolation + filters
    // CRITICAL: Always filter by tenant ID first
    const conditions: any[] = [
      eq(templates.tenantId, req.user.tenantId),
      eq(templates.isActive, true),
    ];

    // Apply search filter
    if (search) {
      const sanitizedSearch = sanitizeString(search as string);
      const tagMatch = sql`${sanitizedSearch} = ANY(${templates.tags})`;
      conditions.push(
        or(
          ilike(templates.name, `%${sanitizedSearch}%`),
          ilike(templates.subjectLine, `%${sanitizedSearch}%`),
          tagMatch,
        )
      );
    }

    // Apply channel filter
    if (channel && channel !== 'all') {
      conditions.push(eq(templates.channel, channel as string));
    }

    // Apply category filter
    if (category && category !== 'all') {
      conditions.push(eq(templates.category, category as string));
    }

    // Apply favorites filter
    if (favoritesOnly === 'true') {
      conditions.push(eq(templates.isFavorite, true));
    }

    // Build order clause
    const column =
      sortBy === 'name' ? templates.name :
      sortBy === 'usageCount' ? templates.usageCount :
      sortBy === 'lastUsed' ? templates.lastUsed :
      templates.createdAt;

    const orderByExpr = sortOrder === 'asc' ? asc(column) : desc(column);

    // Fetch templates with user details
    const templatesData = await db.query.templates.findMany({
      where: and(...conditions),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: orderByExpr,
      limit: Number(limit),
      offset,
    });

    // Get total count for pagination
    const [totalCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(templates)
      .where(and(...conditions));

    console.log('✅ [Templates] Returning', templatesData.length, 'templates for tenant:', req.user.tenantId, 'total:', totalCountResult.count);

    res.json({
      templates: templatesData,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCountResult.count,
        pages: Math.ceil(totalCountResult.count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ message: 'Failed to get templates' });
  }
});

// Get template statistics
templateRoutes.get("/stats", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    // Double-check tenant ID is present (defense in depth)
    if (!req.user?.tenantId) {
      console.error('❌ [Templates Stats] Missing tenant ID in request');
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    console.log('🔍 [Templates Stats] Fetching stats for tenant:', req.user.tenantId);

    const stats = await db.select({
      totalTemplates: sql<number>`count(*)`,
      activeTemplates: sql<number>`count(*) filter (where is_active = true)`,
      favoriteTemplates: sql<number>`count(*) filter (where is_favorite = true)`,
      individualTemplates: sql<number>`count(*) filter (where channel = 'individual')`,
      promotionalTemplates: sql<number>`count(*) filter (where channel = 'promotional')`,
      newsletterTemplates: sql<number>`count(*) filter (where channel = 'newsletter')`,
      transactionalTemplates: sql<number>`count(*) filter (where channel = 'transactional')`,
      averageUsageCount: sql<number>`avg(usage_count)`,
    }).from(templates).where(sql`${templates.tenantId} = ${req.user.tenantId}`);

    console.log('✅ [Templates Stats] Returning stats for tenant:', req.user.tenantId, 'total templates:', stats[0].totalTemplates);

    res.json(stats[0]);
  } catch (error) {
    console.error('Get template stats error:', error);
    res.status(500).json({ message: 'Failed to get template statistics' });
  }
});

// Get specific template by ID
templateRoutes.get("/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    // Double-check tenant ID is present (defense in depth)
    if (!req.user?.tenantId) {
      console.error('❌ [Template Get] Missing tenant ID in request');
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { id } = req.params;
    console.log('🔍 [Template Get] Fetching template', id, 'for tenant:', req.user.tenantId);

    const template = await db.query.templates.findFirst({
      where: sql`${templates.id} = ${id} AND ${templates.tenantId} = ${req.user.tenantId}`,
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    res.json({ template });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ message: 'Failed to get template' });
  }
});

// Create new template
templateRoutes.post("/", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    // Double-check tenant ID is present (defense in depth)
    if (!req.user?.tenantId) {
      console.error('❌ [Template Create] Missing tenant ID in request');
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    console.log('🔍 [Template Create] Creating template for tenant:', req.user.tenantId);

    const templateData: CreateTemplateData = req.body;

    // Validate required fields
    if (!templateData.name?.trim() || !templateData.subjectLine?.trim() || !templateData.body?.trim()) {
      return res.status(400).json({ 
        message: 'Template name, subject line, and body are required' 
      });
    }

    // Generate preview from body if not provided
    const preview = templateData.preview || templateData.body
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .substring(0, 160) // Limit to 160 characters
      .trim();

    const [newTemplate] = await db.insert(templates).values({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      name: templateData.name.trim(),
      channel: templateData.channel,
      category: templateData.category,
      subjectLine: templateData.subjectLine.trim(),
      preview,
      body: templateData.body.trim(),
      tags: templateData.tags || [],
      isFavorite: templateData.isFavorite || false,
    }).returning();

    // Fetch the complete template with user details
    const completeTemplate = await db.query.templates.findFirst({
      where: eq(templates.id, newTemplate.id),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.status(201).json({ 
      message: 'Template created successfully',
      template: completeTemplate 
    });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ message: 'Failed to create template' });
  }
});

// Update template
templateRoutes.patch("/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    // Double-check tenant ID is present (defense in depth)
    if (!req.user?.tenantId) {
      console.error('❌ [Template Update] Missing tenant ID in request');
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { id } = req.params;
    const updateData: UpdateTemplateData = req.body;

    console.log('🔍 [Template Update] Updating template', id, 'for tenant:', req.user.tenantId);

    // Check if template exists and belongs to the tenant
    const existingTemplate = await db.query.templates.findFirst({
      where: sql`${templates.id} = ${id} AND ${templates.tenantId} = ${req.user.tenantId}`,
    });

    if (!existingTemplate) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Prepare update data, filtering out undefined values
    const updateFields: any = {};
    if (updateData.name !== undefined) updateFields.name = updateData.name.trim();
    if (updateData.channel !== undefined) updateFields.channel = updateData.channel;
    if (updateData.category !== undefined) updateFields.category = updateData.category;
    if (updateData.subjectLine !== undefined) updateFields.subjectLine = updateData.subjectLine.trim();
    if (updateData.body !== undefined) {
      updateFields.body = updateData.body.trim();
      // Update preview if body is changing
      updateFields.preview = updateData.preview || updateData.body
        .replace(/<[^>]*>/g, '')
        .substring(0, 160)
        .trim();
    }
    if (updateData.preview !== undefined) updateFields.preview = updateData.preview;
    if (updateData.tags !== undefined) updateFields.tags = updateData.tags;
    if (updateData.isFavorite !== undefined) updateFields.isFavorite = updateData.isFavorite;
    if (updateData.isActive !== undefined) updateFields.isActive = updateData.isActive;

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const [updatedTemplate] = await db.update(templates)
      .set(updateFields)
      .where(sql`${templates.id} = ${id} AND ${templates.tenantId} = ${req.user.tenantId}`)
      .returning();

    // Fetch the complete updated template with user details
    const completeTemplate = await db.query.templates.findFirst({
      where: eq(templates.id, updatedTemplate.id),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.json({ 
      message: 'Template updated successfully',
      template: completeTemplate 
    });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ message: 'Failed to update template' });
  }
});

// Toggle template favorite status
templateRoutes.post("/:id/favorite", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    // Double-check tenant ID is present (defense in depth)
    if (!req.user?.tenantId) {
      console.error('❌ [Template Favorite] Missing tenant ID in request');
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { id } = req.params;

    const existingTemplate = await db.query.templates.findFirst({
      where: sql`${templates.id} = ${id} AND ${templates.tenantId} = ${req.user.tenantId}`,
    });

    if (!existingTemplate) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const [updatedTemplate] = await db.update(templates)
      .set({ isFavorite: !existingTemplate.isFavorite })
      .where(sql`${templates.id} = ${id} AND ${templates.tenantId} = ${req.user.tenantId}`)
      .returning();

    res.json({ 
      message: `Template ${updatedTemplate.isFavorite ? 'added to' : 'removed from'} favorites`,
      isFavorite: updatedTemplate.isFavorite 
    });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ message: 'Failed to toggle favorite status' });
  }
});

// Use template (increment usage count)
templateRoutes.post("/:id/use", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    // Double-check tenant ID is present (defense in depth)
    if (!req.user?.tenantId) {
      console.error('❌ [Template Use] Missing tenant ID in request');
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { id } = req.params;

    const existingTemplate = await db.query.templates.findFirst({
      where: sql`${templates.id} = ${id} AND ${templates.tenantId} = ${req.user.tenantId}`,
    });

    if (!existingTemplate) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const [updatedTemplate] = await db.update(templates)
      .set({ 
        usageCount: sql`${templates.usageCount} + 1`,
        lastUsed: sql`NOW()`,
      })
      .where(sql`${templates.id} = ${id} AND ${templates.tenantId} = ${req.user.tenantId}`)
      .returning();

    res.json({ 
      message: 'Template usage recorded',
      usageCount: updatedTemplate.usageCount,
      lastUsed: updatedTemplate.lastUsed
    });
  } catch (error) {
    console.error('Use template error:', error);
    res.status(500).json({ message: 'Failed to record template usage' });
  }
});

// Duplicate template
templateRoutes.post("/:id/duplicate", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    // Double-check tenant ID is present (defense in depth)
    if (!req.user?.tenantId) {
      console.error('❌ [Template Duplicate] Missing tenant ID in request');
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { id } = req.params;
    const { name } = req.body;

    const existingTemplate = await db.query.templates.findFirst({
      where: sql`${templates.id} = ${id} AND ${templates.tenantId} = ${req.user.tenantId}`,
    });

    if (!existingTemplate) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const duplicateName = name || `${existingTemplate.name} (Copy)`;

    const [duplicatedTemplate] = await db.insert(templates).values({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      name: duplicateName,
      channel: existingTemplate.channel,
      category: existingTemplate.category,
      subjectLine: existingTemplate.subjectLine,
      preview: existingTemplate.preview,
      body: existingTemplate.body,
      tags: existingTemplate.tags,
      isFavorite: false, // New duplicates are not favorites by default
      usageCount: 0, // Reset usage count for duplicates
    }).returning();

    // Fetch the complete template with user details
    const completeTemplate = await db.query.templates.findFirst({
      where: eq(templates.id, duplicatedTemplate.id),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.status(201).json({ 
      message: 'Template duplicated successfully',
      template: completeTemplate 
    });
  } catch (error) {
    console.error('Duplicate template error:', error);
    res.status(500).json({ message: 'Failed to duplicate template' });
  }
});

// Delete template (soft delete by setting isActive to false)
templateRoutes.delete("/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    // Double-check tenant ID is present (defense in depth)
    if (!req.user?.tenantId) {
      console.error('❌ [Template Delete] Missing tenant ID in request');
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { id } = req.params;
    console.log('🔍 [Template Delete] Deleting template', id, 'for tenant:', req.user.tenantId);

    const existingTemplate = await db.query.templates.findFirst({
      where: sql`${templates.id} = ${id} AND ${templates.tenantId} = ${req.user.tenantId}`,
    });

    if (!existingTemplate) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Soft delete by setting isActive to false
    await db.update(templates)
      .set({ isActive: false })
      .where(sql`${templates.id} = ${id} AND ${templates.tenantId} = ${req.user.tenantId}`);

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ message: 'Failed to delete template' });
  }
});

// Hard delete template (permanent deletion - admin only)
templateRoutes.delete("/:id/permanent", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    // Double-check tenant ID is present (defense in depth)
    if (!req.user?.tenantId) {
      console.error('❌ [Template Permanent Delete] Missing tenant ID in request');
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    // Check if user has admin role
    if (req.user.role !== 'Owner' && req.user.role !== 'Administrator') {
      return res.status(403).json({ message: 'Insufficient permissions for permanent deletion' });
    }

    const { id } = req.params;
    console.log('🔍 [Template Permanent Delete] Permanently deleting template', id, 'for tenant:', req.user.tenantId);

    const existingTemplate = await db.query.templates.findFirst({
      where: sql`${templates.id} = ${id} AND ${templates.tenantId} = ${req.user.tenantId}`,
    });

    if (!existingTemplate) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Hard delete from database
    await db.delete(templates)
      .where(sql`${templates.id} = ${id} AND ${templates.tenantId} = ${req.user.tenantId}`);

    res.json({ message: 'Template permanently deleted' });
  } catch (error) {
    console.error('Permanent delete template error:', error);
    res.status(500).json({ message: 'Failed to permanently delete template' });
  }
});