import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { betterAuthUser, shops } from '@shared/schema';
import { authenticateToken, requireRole } from '../middleware/auth-middleware';
import { createShopSchema, updateShopSchema, type ShopFilters } from '@shared/schema';
import { sanitizeString } from '../utils/sanitization';
import { storage } from '../storage';
import { logActivity, computeChanges, SHOP_TRACKED_FIELDS } from '../utils/activityLogger';

export const shopsRoutes = Router();

// Get all shops for the company
shopsRoutes.get("/", authenticateToken, async (req: any, res) => {
  try {
    const { page = 1, limit = 50, search, status, managerId } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`${shops.tenantId} = ${req.user.tenantId}`;

    if (search) {
      const sanitizedSearch = sanitizeString(search as string);
      whereClause = sql`${whereClause} AND (
        ${shops.name} ILIKE ${`%${sanitizedSearch}%`} OR
        ${shops.description} ILIKE ${`%${sanitizedSearch}%`} OR
        ${shops.address} ILIKE ${`%${sanitizedSearch}%`}
      )`;
    }

    if (status) {
      whereClause = sql`${whereClause} AND ${shops.status} = ${status}`;
    }

    if (managerId) {
      whereClause = sql`${whereClause} AND ${shops.managerId} = ${managerId}`;
    }

    const shopsData = await db.select({
      id: shops.id,
      name: shops.name,
      description: shops.description,
      address: shops.address,
      city: shops.city,
      state: shops.state,
      zipCode: shops.zipCode,
      country: shops.country,
      phone: shops.phone,
      email: shops.email,
      website: shops.website,
      logoUrl: shops.logoUrl,
      managerId: shops.managerId,
      operatingHours: shops.operatingHours,
      status: shops.status,
      category: shops.category,
      tags: shops.tags,
      socialMedia: shops.socialMedia,
      settings: shops.settings,
      isActive: shops.isActive,
      tenantId: shops.tenantId,
      createdAt: shops.createdAt,
      updatedAt: shops.updatedAt,
      managerFirstName: betterAuthUser.firstName,
      managerLastName: betterAuthUser.lastName,
      managerEmail: betterAuthUser.email,
    }).from(shops)
      .leftJoin(betterAuthUser, sql`${shops.managerId} = ${betterAuthUser.id}`)
      .where(whereClause)
      .orderBy(sql`${shops.createdAt} DESC`)
      .limit(Number(limit))
      .offset(offset);

    // Transform the data to include manager object
    const shopsWithManager = shopsData.map((shop: any) => {
      const { managerFirstName, managerLastName, managerEmail, ...shopFields } = shop;
      return {
        ...shopFields,
        manager: shopFields.managerId ? {
          id: shopFields.managerId,
          firstName: managerFirstName,
          lastName: managerLastName,
          email: managerEmail,
        } : null,
      };
    });

    const [totalCountResult] = await db.select({
      count: sql<number>`count(*)`,
    }).from(shops).where(whereClause);

    // Get shop limits and stats using proper storage method
    const limits = await storage.checkShopLimits(req.user.tenantId);
    const stats = { totalShops: totalCountResult.count, activeShops: shopsWithManager.filter((s: any) => s.status === 'active').length, shopsByCategory: {} };

    const response = {
      shops: shopsWithManager,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCountResult.count,
        pages: Math.ceil(totalCountResult.count / Number(limit)),
      },
      limits,
      stats,
    };

    res.json(response);
  } catch (error) {
    console.error('❌ [Shops API] Get shops error occurred:');
    console.error('❌ [Shops API] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      userId: req.user?.id,
      tenantId: req.user?.tenantId
    });

    const errorResponse = {
      message: 'Failed to get shops',
      debug: {
        errorMessage: error instanceof Error ? error.message : String(error),
        tenantId: req.user?.tenantId,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      }
    };

    console.error('❌ [Shops API] Sending error response:', errorResponse);
    res.status(500).json(errorResponse);
  }
});

// Get specific shop
shopsRoutes.get("/:id", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;

    const [shopData] = await db.select({
      id: shops.id,
      name: shops.name,
      description: shops.description,
      address: shops.address,
      city: shops.city,
      state: shops.state,
      zipCode: shops.zipCode,
      country: shops.country,
      phone: shops.phone,
      email: shops.email,
      website: shops.website,
      logoUrl: shops.logoUrl,
      managerId: shops.managerId,
      operatingHours: shops.operatingHours,
      status: shops.status,
      category: shops.category,
      tags: shops.tags,
      socialMedia: shops.socialMedia,
      settings: shops.settings,
      isActive: shops.isActive,
      tenantId: shops.tenantId,
      createdAt: shops.createdAt,
      updatedAt: shops.updatedAt,
      managerFirstName: betterAuthUser.firstName,
      managerLastName: betterAuthUser.lastName,
      managerEmail: betterAuthUser.email,
    }).from(shops)
      .leftJoin(betterAuthUser, sql`${shops.managerId} = ${betterAuthUser.id}`)
      .where(sql`${shops.id} = ${id} AND ${shops.tenantId} = ${req.user.tenantId}`)
      .limit(1);

    if (!shopData) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Transform to include manager object
    const shop = {
      ...shopData,
      manager: shopData.managerId ? {
        id: shopData.managerId,
        firstName: shopData.managerFirstName,
        lastName: shopData.managerLastName,
        email: shopData.managerEmail,
      } : null,
    };

    res.json({ shop });
  } catch (error) {
    console.error('Get shop error:', error);
    res.status(500).json({ message: 'Failed to get shop' });
  }
});

// Create new shop
shopsRoutes.post("/", authenticateToken, requireRole(["Owner", "Administrator", "Manager"]), async (req: any, res) => {
  try {
    // Check shop limits before creating
    await storage.validateShopCreation(req.user.tenantId);

    const validatedData = createShopSchema.parse(req.body);
    const { name, description, address, phone, email, managerId, status, category, city, state, zipCode, country, website, operatingHours, tags, socialMedia, settings } = validatedData;

    const sanitizedName = sanitizeString(name) || name;
    const sanitizedDescription = description ? sanitizeString(description) : null;
    const sanitizedAddress = address ? sanitizeString(address) : null;
    const sanitizedPhone = phone ? sanitizeString(phone) || phone : null;
    const sanitizedEmail = email ? sanitizeString(email) || email : null;
    const sanitizedCategory = category ? sanitizeString(category) : null;
    const sanitizedCity = city ? sanitizeString(city) : null;
    const sanitizedState = state ? sanitizeString(state) : null;
    const sanitizedZipCode = zipCode ? sanitizeString(zipCode) : null;
    const sanitizedCountry = country ? sanitizeString(country) : 'United States';
    const sanitizedWebsite = website ? sanitizeString(website) : null;
    const sanitizedOperatingHours = operatingHours ? sanitizeString(operatingHours) : null;
    const sanitizedSocialMedia = socialMedia ? sanitizeString(socialMedia) : null;
    const sanitizedSettings = settings ? sanitizeString(settings) : null;

    // Validate required fields
    if (!sanitizedName || !sanitizedPhone || !sanitizedEmail) {
      return res.status(400).json({
        message: 'Name, phone and email are required fields',
        missingFields: {
          name: !sanitizedName,
          phone: !sanitizedPhone,
          email: !sanitizedEmail
        }
      });
    }

    // Verify manager belongs to the same company
    if (managerId) {
      const [manager] = await db.select().from(betterAuthUser)
        .where(sql`${betterAuthUser.id} = ${managerId} AND ${betterAuthUser.tenantId} = ${req.user.tenantId}`)
        .limit(1);

      if (!manager) {
        return res.status(400).json({ message: 'Manager not found or does not belong to your company' });
      }
    }

    const newShop = await db.insert(shops).values({
      name: sanitizedName,
      description: sanitizedDescription,
      address: sanitizedAddress,
      city: sanitizedCity,
      state: sanitizedState,
      zipCode: sanitizedZipCode,
      country: sanitizedCountry,
      phone: sanitizedPhone,
      email: sanitizedEmail,
      website: sanitizedWebsite,
      managerId: managerId || null,
      operatingHours: sanitizedOperatingHours,
      status: status || 'active',
      category: sanitizedCategory,
      tags: tags || [],
      socialMedia: sanitizedSocialMedia,
      settings: sanitizedSettings,
      tenantId: req.user.tenantId,
    }).returning();

    // Log activity
    await logActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      entityType: 'shop',
      entityId: newShop[0].id,
      entityName: newShop[0].name,
      activityType: 'created',
      description: `Shop "${newShop[0].name}" was created`,
      metadata: {
        status: newShop[0].status,
        category: newShop[0].category,
        managerId: newShop[0].managerId,
      },
      req,
    });

    res.status(201).json(newShop[0]);
  } catch (error) {
    console.error('Create shop error:', error);
    if (error instanceof Error && error.message.includes('Shop limit reached')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to create shop' });
  }
});

// Update shop
shopsRoutes.put("/:id", authenticateToken, requireRole(["Owner", "Administrator", "Manager"]), async (req: any, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateShopSchema.parse(req.body);
    const { name, description, address, city, state, zipCode, country, phone, email, website, managerId, operatingHours, status, category, tags, socialMedia, settings, isActive } = validatedData;

    // Check if shop exists and belongs to user's company
    const existingShop = await db.query.shops.findFirst({
      where: sql`${shops.id} = ${id} AND ${shops.tenantId} = ${req.user.tenantId}`,
    });

    if (!existingShop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      updateData.name = sanitizeString(name);
    }

    if (description !== undefined) {
      updateData.description = description ? sanitizeString(description) : null;
    }

    if (address !== undefined) {
      updateData.address = address ? sanitizeString(address) : null;
    }

    if (phone !== undefined) {
      updateData.phone = phone ? sanitizeString(phone) : null;
    }

    if (email !== undefined) {
      updateData.email = email ? sanitizeString(email) : null;
    }

    if (managerId !== undefined) {
      if (managerId && managerId.trim() !== '') {
        // Verify manager belongs to the same company
        const manager = await db.query.betterAuthUser.findFirst({
          where: sql`${betterAuthUser.id} = ${managerId} AND ${betterAuthUser.tenantId} = ${req.user.tenantId}`,
        });

        if (!manager) {
          return res.status(400).json({ message: 'Manager not found or does not belong to your company' });
        }
        updateData.managerId = managerId;
      } else {
        // Set to null for no manager or empty string
        updateData.managerId = null;
      }
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    if (city !== undefined) {
      updateData.city = city ? sanitizeString(city) : null;
    }

    if (state !== undefined) {
      updateData.state = state ? sanitizeString(state) : null;
    }

    if (zipCode !== undefined) {
      updateData.zipCode = zipCode ? sanitizeString(zipCode) : null;
    }

    if (country !== undefined) {
      updateData.country = sanitizeString(country);
    }

    if (website !== undefined) {
      updateData.website = website ? sanitizeString(website) : null;
    }

    if (operatingHours !== undefined) {
      updateData.operatingHours = operatingHours ? sanitizeString(operatingHours) : null;
    }

    if (category !== undefined) {
      updateData.category = category ? sanitizeString(category) : null;
    }

    if (tags !== undefined) {
      updateData.tags = tags;
    }

    if (socialMedia !== undefined) {
      updateData.socialMedia = socialMedia ? sanitizeString(socialMedia) : null;
    }

    if (settings !== undefined) {
      updateData.settings = settings ? sanitizeString(settings) : null;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const updatedShop = await db.update(shops)
      .set(updateData)
      .where(sql`${shops.id} = ${id}`)
      .returning();

    // Compute and log changes
    const changes = computeChanges(existingShop, updatedShop[0], SHOP_TRACKED_FIELDS);
    if (changes) {
      await logActivity({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        entityType: 'shop',
        entityId: id,
        entityName: updatedShop[0].name,
        activityType: 'updated',
        description: `Shop "${updatedShop[0].name}" was updated`,
        changes,
        req,
      });
    }

    res.json(updatedShop[0]);
  } catch (error) {
    console.error('Update shop error:', error);
    res.status(500).json({ message: 'Failed to update shop' });
  }
});

// Toggle shop status
shopsRoutes.patch("/:id/toggle-status", authenticateToken, requireRole(["Owner", "Administrator", "Manager"]), async (req: any, res) => {
  try {
    const { id } = req.params;

    // Check if shop exists and belongs to user's company
    const existingShop = await db.query.shops.findFirst({
      where: sql`${shops.id} = ${id} AND ${shops.tenantId} = ${req.user.tenantId}`,
    });

    if (!existingShop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    const newStatus = existingShop.status === 'active' ? 'inactive' : 'active';

    const updatedShop = await db.update(shops)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(sql`${shops.id} = ${id}`)
      .returning();

    // Log activity for status change
    await logActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      entityType: 'shop',
      entityId: id,
      entityName: updatedShop[0].name,
      activityType: 'updated',
      description: `Shop "${updatedShop[0].name}" status changed to ${newStatus}`,
      changes: {
        status: {
          old: existingShop.status,
          new: newStatus,
        },
      },
      metadata: {
        action: 'toggle_status',
        previousStatus: existingShop.status,
        newStatus: newStatus,
      },
      req,
    });

    res.json(updatedShop[0]);
  } catch (error) {
    console.error('Toggle shop status error:', error);
    res.status(500).json({ message: 'Failed to toggle shop status' });
  }
});

// Delete shop
shopsRoutes.delete("/:id", authenticateToken, requireRole(["Owner", "Administrator"]), async (req: any, res) => {
  try {
    const { id } = req.params;

    // Check if shop exists and belongs to user's company
    const existingShop = await db.query.shops.findFirst({
      where: sql`${shops.id} = ${id} AND ${shops.tenantId} = ${req.user.tenantId}`,
    });

    if (!existingShop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Delete shop
    await db.delete(shops)
      .where(sql`${shops.id} = ${id}`);

    // Log activity
    await logActivity({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      entityType: 'shop',
      entityId: id,
      entityName: existingShop.name,
      activityType: 'deleted',
      description: `Shop "${existingShop.name}" was deleted`,
      metadata: {
        deletedShopData: {
          name: existingShop.name,
          status: existingShop.status,
          category: existingShop.category,
        },
      },
      req,
    });

    res.json({ message: 'Shop deleted successfully' });
  } catch (error) {
    console.error('Delete shop error:', error);
    res.status(500).json({ message: 'Failed to delete shop' });
  }
});

// Get available managers for shop assignment
shopsRoutes.get("/managers/list", authenticateToken, async (req: any, res) => {
  try {
    const managers = await db.query.betterAuthUser.findMany({
      where: sql`${betterAuthUser.tenantId} = ${req.user.tenantId} AND ${betterAuthUser.role} IN ('Manager', 'Administrator', 'Owner')`,
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      orderBy: sql`${betterAuthUser.firstName} ASC`,
    });

    res.json(managers);
  } catch (error) {
    console.error('Get managers list error:', error);
    res.status(500).json({ message: 'Failed to get managers list' });
  }
});

// Get shop limits and current usage
shopsRoutes.get("/limits", authenticateToken, async (req: any, res) => {
  try {
    const limits = await storage.checkShopLimits(req.user.tenantId);
    res.json(limits);
  } catch (error) {
    console.error('Get shop limits error:', error);
    res.status(500).json({ message: 'Failed to get shop limits' });
  }
});

// Get shop statistics
shopsRoutes.get("/:id/stats", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;

    // Check if shop exists and belongs to user's company
    const shop = await db.query.shops.findFirst({
      where: sql`${shops.id} = ${id} AND ${shops.tenantId} = ${req.user.tenantId}`,
    });

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Get shop statistics (placeholder - you might have more specific metrics)
    const stats = {
      totalShops: 1, // This shop
      activeShops: shop.status === 'active' ? 1 : 0,
      inactiveShops: shop.status === 'inactive' ? 1 : 0,
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt,
    };

    res.json(stats);
  } catch (error) {
    console.error('Get shop stats error:', error);
    res.status(500).json({ message: 'Failed to get shop statistics' });
  }
});