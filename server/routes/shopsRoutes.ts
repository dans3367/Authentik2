import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { users, shops } from '@shared/schema';
import { authenticateToken, requireRole } from '../middleware/auth-middleware';
import { createShopSchema, updateShopSchema, type ShopFilters } from '@shared/schema';
import { sanitizeString } from '../utils/sanitization';

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

    const shopsData = await db.query.shops.findMany({
      where: whereClause,
      with: {
        manager: {
          columns: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: sql`${shops.createdAt} DESC`,
      limit: Number(limit),
      offset,
    });

    const [totalCountResult] = await db.select({
      count: sql<number>`count(*)`,
    }).from(shops).where(whereClause);

    res.json({
      shops: shopsData,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCountResult.count,
        pages: Math.ceil(totalCountResult.count / Number(limit)),
      },
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

    const shop = await db.query.shops.findFirst({
      where: sql`${shops.id} = ${id} AND ${shops.tenantId} = ${req.user.tenantId}`,
      with: {
        manager: {
          columns: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

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
    const validatedData = createShopSchema.parse(req.body);
    const { name, description, address, phone, email, managerId, status } = validatedData;

    const sanitizedName = sanitizeString(name);
    const sanitizedDescription = description ? sanitizeString(description) : null;
    const sanitizedAddress = address ? sanitizeString(address) : null;
    const sanitizedPhone = phone ? sanitizeString(phone) : null;
    const sanitizedEmail = email ? sanitizeString(email) : null;

    // Verify manager belongs to the same company
    if (managerId) {
      const manager = await db.query.users.findFirst({
        where: sql`${users.id} = ${managerId} AND ${users.tenantId} = ${req.user.tenantId}`,
      });

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
      managerId,
      status: status || 'active',
      tenantId: req.user.tenantId,
      country: 'United States',
      updatedAt: new Date(),
    }).returning();

    res.status(201).json(newShop[0]);
  } catch (error) {
    console.error('Create shop error:', error);
    res.status(500).json({ message: 'Failed to create shop' });
  }
});

// Update shop
shopsRoutes.put("/:id", authenticateToken, requireRole(["Owner", "Administrator", "Manager"]), async (req: any, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateShopSchema.parse(req.body);
    const { name, description, address, phone, email, managerId, status } = validatedData;

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
      if (managerId) {
        // Verify manager belongs to the same company
        const manager = await db.query.users.findFirst({
          where: sql`${users.id} = ${managerId} AND ${users.tenantId} = ${req.user.tenantId}`,
        });

        if (!manager) {
          return res.status(400).json({ message: 'Manager not found or does not belong to your company' });
        }
      }
      updateData.managerId = managerId;
    }

    if (status !== undefined) {
      updateData.status = status;
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
    const managers = await db.query.users.findMany({
      where: sql`${users.tenantId} = ${req.user.tenantId} AND ${users.role} IN ('Manager', 'Administrator', 'Owner')`,
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      orderBy: sql`${users.firstName} ASC`,
    });

    res.json(managers);
  } catch (error) {
    console.error('Get managers list error:', error);
    res.status(500).json({ message: 'Failed to get managers list' });
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