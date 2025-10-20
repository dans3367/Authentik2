import { Router } from 'express';
import { db } from '../db';
import { betterAuthUser, tenants, companies } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { authenticateToken, requireRole } from '../middleware/auth-middleware';

export const tenantFixRoutes = Router();

/**
 * Admin endpoint to create unique tenants for users stuck in default/shared tenants
 * Only accessible by owners/administrators
 */
tenantFixRoutes.post(
  '/create-unique-tenant/:userId',
  authenticateToken,
  requireRole(['Owner', 'Administrator']),
  async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { companyName } = req.body;

      console.log(`🔧 [Tenant Fix] Creating unique tenant for user: ${userId}`);

      // Get the user
      const user = await db.query.betterAuthUser.findFirst({
        where: eq(betterAuthUser.id, userId),
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if user is in a shared/default tenant
      const sharedTenantIds = [
        '00000000-0000-0000-0000-000000000000',
        '29c69b4f-3129-4aa4-a475-7bf892e5c5b9',
        '2f6f5ec2-a56f-47d0-887d-c6b9c1bb56ff',
      ];

      if (!sharedTenantIds.includes(user.tenantId)) {
        // Check if this tenant has multiple users
        const tenantUsers = await db.query.betterAuthUser.findMany({
          where: eq(betterAuthUser.tenantId, user.tenantId),
        });

        if (tenantUsers.length === 1) {
          return res.status(400).json({
            message: 'User already has a unique tenant',
            tenantId: user.tenantId,
          });
        }
      }

      // Generate a unique slug
      let baseSlug = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
      let slug = baseSlug;
      let attempts = 0;

      while (attempts < 10) {
        const existingTenant = await db.query.tenants.findFirst({
          where: eq(tenants.slug, slug),
        });

        if (!existingTenant) break;

        attempts++;
        slug = `${baseSlug}-${attempts}`;
      }

      if (attempts >= 10) {
        return res.status(500).json({ message: 'Could not generate unique slug' });
      }

      // Create new tenant
      const newCompanyName = companyName || (user.name ? `${user.name}'s Organization` : 'My Organization');

      const [newTenant] = await db
        .insert(tenants)
        .values({
          name: newCompanyName,
          slug: slug,
          isActive: true,
          maxUsers: 10,
        })
        .returning();

      console.log(`✅ [Tenant Fix] Tenant created: ${newTenant.id}`);

      // Update user
      await db
        .update(betterAuthUser)
        .set({
          tenantId: newTenant.id,
          role: 'Owner',
          updatedAt: new Date(),
        })
        .where(eq(betterAuthUser.id, user.id));

      console.log(`✅ [Tenant Fix] User updated with new tenant`);

      // Create company
      const [newCompany] = await db
        .insert(companies)
        .values({
          tenantId: newTenant.id,
          ownerId: user.id,
          name: newCompanyName,
          setupCompleted: true,
          isActive: true,
        })
        .returning();

      console.log(`✅ [Tenant Fix] Company created: ${newCompany.id}`);

      res.json({
        message: 'Unique tenant created successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        tenant: {
          id: newTenant.id,
          name: newTenant.name,
          slug: newTenant.slug,
        },
        company: {
          id: newCompany.id,
          name: newCompany.name,
        },
      });
    } catch (error) {
      console.error('Create unique tenant error:', error);
      res.status(500).json({ message: 'Failed to create unique tenant' });
    }
  }
);

/**
 * List users in shared tenants that need fixing
 */
tenantFixRoutes.get(
  '/users-needing-fix',
  authenticateToken,
  requireRole(['Owner', 'Administrator']),
  async (req: any, res) => {
    try {
      const sharedTenantIds = [
        '00000000-0000-0000-0000-000000000000',
        '29c69b4f-3129-4aa4-a475-7bf892e5c5b9',
        '2f6f5ec2-a56f-47d0-887d-c6b9c1bb56ff',
      ];

      // Get users in shared tenants
      const usersInSharedTenants = await db.query.betterAuthUser.findMany({
        where: inArray(betterAuthUser.tenantId, sharedTenantIds),
        columns: {
          id: true,
          email: true,
          name: true,
          tenantId: true,
          role: true,
          createdAt: true,
        },
      });

      // Get all tenants with multiple users
      const allUsers = await db.query.betterAuthUser.findMany({
        columns: {
          id: true,
          email: true,
          name: true,
          tenantId: true,
          role: true,
        },
      });

      // Group by tenant
      const tenantUserCount: Record<string, any[]> = {};
      for (const user of allUsers) {
        if (!tenantUserCount[user.tenantId]) {
          tenantUserCount[user.tenantId] = [];
        }
        tenantUserCount[user.tenantId].push(user);
      }

      // Find tenants with multiple users (excluding shared tenant owners)
      const tenantsWithMultipleUsers = Object.entries(tenantUserCount)
        .filter(([tenantId, users]) => {
          // Exclude shared tenants from this check
          if (sharedTenantIds.includes(tenantId)) return false;
          // Only flag if there are 2+ users
          return users.length > 1;
        })
        .map(([tenantId, users]) => ({
          tenantId,
          userCount: users.length,
          users: users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role })),
        }));

      res.json({
        usersInSharedTenants: usersInSharedTenants.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          tenantId: u.tenantId,
          role: u.role,
          createdAt: u.createdAt,
        })),
        tenantsWithMultipleUsers,
        summary: {
          totalUsersInSharedTenants: usersInSharedTenants.length,
          totalTenantsWithMultipleUsers: tenantsWithMultipleUsers.length,
        },
      });
    } catch (error) {
      console.error('Get users needing fix error:', error);
      res.status(500).json({ message: 'Failed to get users needing fix' });
    }
  }
);

/**
 * Bulk fix: Create unique tenants for all users in a shared tenant
 */
tenantFixRoutes.post(
  '/bulk-fix-shared-tenant/:tenantId',
  authenticateToken,
  requireRole(['Owner', 'Administrator']),
  async (req: any, res) => {
    try {
      const { tenantId } = req.params;

      console.log(`🔧 [Tenant Fix] Bulk fixing users in tenant: ${tenantId}`);

      // Get all users in this tenant
      const users = await db.query.betterAuthUser.findMany({
        where: eq(betterAuthUser.tenantId, tenantId),
      });

      if (users.length === 0) {
        return res.status(404).json({ message: 'No users found in this tenant' });
      }

      const results = [];
      const errors = [];

      for (const user of users) {
        try {
          // Generate unique slug
          let baseSlug = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
          let slug = baseSlug;
          let attempts = 0;

          while (attempts < 10) {
            const existingTenant = await db.query.tenants.findFirst({
              where: eq(tenants.slug, slug),
            });

            if (!existingTenant) break;

            attempts++;
            slug = `${baseSlug}-${attempts}`;
          }

          // Create new tenant
          const companyName = user.name ? `${user.name}'s Organization` : 'My Organization';

          const [newTenant] = await db
            .insert(tenants)
            .values({
              name: companyName,
              slug: slug,
              isActive: true,
              maxUsers: 10,
            })
            .returning();

          // Update user
          await db
            .update(betterAuthUser)
            .set({
              tenantId: newTenant.id,
              role: 'Owner',
              updatedAt: new Date(),
            })
            .where(eq(betterAuthUser.id, user.id));

          // Create company
          await db.insert(companies).values({
            tenantId: newTenant.id,
            ownerId: user.id,
            name: companyName,
            setupCompleted: true,
            isActive: true,
          });

          results.push({
            userId: user.id,
            email: user.email,
            newTenantId: newTenant.id,
            success: true,
          });

          console.log(`✅ [Tenant Fix] Fixed user: ${user.email} -> ${newTenant.id}`);
        } catch (error) {
          console.error(`❌ [Tenant Fix] Failed to fix user ${user.email}:`, error);
          errors.push({
            userId: user.id,
            email: user.email,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      res.json({
        message: 'Bulk fix completed',
        summary: {
          total: users.length,
          successful: results.length,
          failed: errors.length,
        },
        results,
        errors,
      });
    } catch (error) {
      console.error('Bulk fix error:', error);
      res.status(500).json({ message: 'Failed to perform bulk fix' });
    }
  }
);


