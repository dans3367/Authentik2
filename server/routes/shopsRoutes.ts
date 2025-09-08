import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { betterAuthUser, shops } from '@shared/schema';
import { authenticateToken, requireRole } from '../middleware/auth-middleware';
import { createShopSchema, updateShopSchema, type ShopFilters } from '@shared/schema';
import { sanitizeString } from '../utils/sanitization';
import { storage } from '../storage';

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

    const shopsData = await db.select().from(shops)
      .where(whereClause)
      .orderBy(sql`${shops.createdAt} DESC`)
      .limit(Number(limit))
      .offset(offset);

    const [totalCountResult] = await db.select({
      count: sql<number>`count(*)`,
    }).from(shops).where(whereClause);

    // Get shop limits and stats - temporarily simplified
    const limits = { currentShops: shopsData.length, maxShops: null, canAddShop: true, planName: "Basic" };
    const stats = { totalShops: shopsData.length, activeShops: shopsData.filter(s => s.status === 'active').length, shopsByCategory: {} };

    res.json({
      shops: shopsData,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCountResult.count,
        pages: Math.ceil(totalCountResult.count / Number(limit)),
      },
      limits,
      stats,
    });
  } catch (error) {
    console.error('Get shops error:', error);
    res.status(500).json({ message: 'Failed to get shops' });
  }
});

// Get specific shop
shopsRoutes.get("/:id", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;

    const [shop] = await db.select().from(shops)
      .where(sql`${shops.id} = ${id} AND ${shops.tenantId} = ${req.user.tenantId}`)
      .limit(1);

    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

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
    const { name, description, address, phone, email, managerId, status } = validatedData;

    const sanitizedName = sanitizeString(name);
    const sanitizedDescription = description ? sanitizeString(description) : null;
    const sanitizedAddress = address ? sanitizeString(address) : null;
    const sanitizedPhone = phone ? sanitizeString(phone) : null;
    const sanitizedEmail = email ? sanitizeString(email) : null;

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
      phone: sanitizedPhone,
      email: sanitizedEmail,
      managerId: managerId || null,
      status: status || 'active',
      tenantId: req.user.tenantId,
      country: 'United States',
    }).returning();

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