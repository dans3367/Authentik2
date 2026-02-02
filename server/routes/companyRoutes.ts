import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { betterAuthUser, tenants, shops, stores, companies, forms, formResponses } from '@shared/schema';
import { authenticateToken, requireRole } from '../middleware/auth-middleware';
import { createCompanySchema, updateCompanySchema, completeOnboardingSchema } from '@shared/schema';
import { sanitizeString } from '../utils/sanitization';

export const companyRoutes = Router();

// Get company information
companyRoutes.get("/", authenticateToken, async (req: any, res) => {
  try {
    console.log(`🏢 [GET /api/company] Fetching company for user ${req.user.email}, tenantId: ${req.user.tenantId}`);

    const company = await db.query.companies.findFirst({
      where: sql`${companies.tenantId} = ${req.user.tenantId}`,
    });

    if (!company) {
      console.warn(`⚠️ [GET /api/company] No company found for tenant ${req.user.tenantId}`);
      console.warn(`   User: ${req.user.email}`);
      console.warn(`   This user won't see the onboarding modal!`);
      return res.status(404).json({ message: 'Company not found' });
    }

    console.log(`✅ [GET /api/company] Found company:`, {
      name: company.name,
      setupCompleted: company.setupCompleted,
      tenantId: company.tenantId,
    });

    res.json(company);
  } catch (error) {
    console.error('❌ [GET /api/company] Error:', error);
    res.status(500).json({ message: 'Failed to get company information' });
  }
});

// Create company (for owners)
companyRoutes.post("/", authenticateToken, requireRole(["Owner", "Administrator"]), async (req: any, res) => {
  try {
    const validatedData = createCompanySchema.parse(req.body);
    const { name, description, website, address, companyType, companyEmail, phone } = validatedData;

    const sanitizedName = sanitizeString(name) ?? name.trim();
    const sanitizedDescription = description ? sanitizeString(description) : null;
    const sanitizedWebsite = website ? sanitizeString(website) : null;
    const sanitizedAddress = address ? sanitizeString(address) : null;
    const sanitizedCompanyType = companyType ? sanitizeString(companyType) : null;
    const sanitizedCompanyEmail = companyEmail ? sanitizeString(companyEmail) : null;
    const sanitizedPhone = phone ? sanitizeString(phone) : null;

    // Check if company name is already taken (tenant isolation not needed for global uniqueness)
    const existingCompany = await db.query.companies.findFirst({
      where: sql`${companies.name} = ${sanitizedName}`,
    });

    if (existingCompany) {
      return res.status(400).json({ message: 'Company name already exists' });
    }

    const newCompany = await db.insert(companies).values({
      tenantId: req.user.tenantId,
      name: sanitizedName,
      description: sanitizedDescription,
      website: sanitizedWebsite,
      address: sanitizedAddress,
      companyType: sanitizedCompanyType,
      companyEmail: sanitizedCompanyEmail,
      phone: sanitizedPhone,
      ownerId: req.user.id,
      createdAt: new Date(),
    }).returning();

    res.status(201).json(newCompany[0]);
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ message: 'Failed to create company' });
  }
});

// Update company information
companyRoutes.patch("/", authenticateToken, requireRole(["Owner", "Administrator"]), async (req: any, res) => {
  try {
    const validatedData = updateCompanySchema.parse(req.body);
    const { name, description, website, address, companyType, companyEmail, phone, isActive } = validatedData;

    const company = await db.query.companies.findFirst({
      where: sql`${companies.tenantId} = ${req.user.tenantId}`,
    });

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      const sanitizedName = sanitizeString(name) ?? name.trim();

      // Check if new name is already taken by another company
      const existingCompany = await db.query.companies.findFirst({
        where: sql`${companies.name} = ${sanitizedName} AND ${companies.tenantId} != ${req.user.tenantId}`,
      });

      if (existingCompany) {
        return res.status(400).json({ message: 'Company name already exists' });
      }

      updateData.name = sanitizedName;
    }

    if (description !== undefined) {
      updateData.description = description ? sanitizeString(description) : null;
    }

    if (website !== undefined) {
      updateData.website = website ? sanitizeString(website) : null;
    }

    if (address !== undefined) {
      updateData.address = address ? sanitizeString(address) : null;
    }

    if (companyType !== undefined) {
      updateData.companyType = companyType ? sanitizeString(companyType) : null;
    }

    if (companyEmail !== undefined) {
      updateData.companyEmail = companyEmail ? sanitizeString(companyEmail) : null;
    }

    if (phone !== undefined) {
      updateData.phone = phone ? sanitizeString(phone) : null;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    // No 'industry' field in schema

    const updatedCompany = await db.update(companies)
      .set(updateData)
      .where(sql`${companies.tenantId} = ${req.user.tenantId}`)
      .returning();

    res.json(updatedCompany[0]);
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ message: 'Failed to update company information' });
  }
});

// Get company statistics
companyRoutes.get("/stats", authenticateToken, async (req: any, res) => {
  try {
    const [
      userStats,
      formStats,
      responseStats,
    ] = await Promise.all([
      // User statistics
      db.select({
        totalUsers: sql<number>`count(*)`,
        activeUsers: sql<number>`count(*) filter (where last_login > current_date - interval '30 days')`,
        newUsers: sql<number>`count(*) filter (where created_at > current_date - interval '30 days')`,
      }).from(betterAuthUser).where(sql`${betterAuthUser.tenantId} = ${req.user.tenantId}`),

      // Form statistics
      db.select({
        totalForms: sql<number>`count(*)`,
        activeForms: sql<number>`count(*) filter (where is_active = true)`,
        inactiveForms: sql<number>`count(*) filter (where is_active = false)`,
        newForms: sql<number>`count(*) filter (where created_at > current_date - interval '30 days')`,
      }).from(forms).where(sql`${forms.tenantId} = ${req.user.tenantId}`),

      // Response statistics
      db.select({
        totalResponses: sql<number>`count(*)`,
        responsesToday: sql<number>`count(*) filter (where submitted_at >= current_date)`,
        responsesThisWeek: sql<number>`count(*) filter (where submitted_at >= current_date - interval '7 days')`,
        responsesThisMonth: sql<number>`count(*) filter (where submitted_at >= current_date - interval '30 days')`,
      }).from(formResponses)
        .innerJoin(forms, sql`${forms.id} = ${formResponses.formId}`)
        .where(sql`${forms.tenantId} = ${req.user.tenantId}`),
    ]);

    res.json({
      users: userStats[0],
      forms: formStats[0],
      responses: responseStats[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get company stats error:', error);
    res.status(500).json({ message: 'Failed to get company statistics' });
  }
});

// Get company users
companyRoutes.get("/users", authenticateToken, async (req: any, res) => {
  try {
    const { page = 1, limit = 50, role, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`${betterAuthUser.tenantId} = ${req.user.tenantId}`;

    if (role) {
      whereClause = sql`${whereClause} AND ${betterAuthUser.role} = ${role}`;
    }

    if (search) {
      const sanitizedSearch = sanitizeString(search as string);
      whereClause = sql`${whereClause} AND (
        ${betterAuthUser.email} ILIKE ${`%${sanitizedSearch}%`} OR
        ${betterAuthUser.firstName} ILIKE ${`%${sanitizedSearch}%`} OR
        ${betterAuthUser.lastName} ILIKE ${`%${sanitizedSearch}%`}
      )`;
    }

    const userList = await db.query.betterAuthUser.findMany({
      where: whereClause,
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        twoFactorEnabled: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: sql`${betterAuthUser.createdAt} DESC`,
      limit: Number(limit),
      offset,
    });

    const totalCount = await db.select({
      count: sql<number>`count(*)`,
    }).from(betterAuthUser).where(whereClause);

    res.json({
      users: userList,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount[0].count,
        pages: Math.ceil(totalCount[0].count / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get company users error:', error);
    res.status(500).json({ message: 'Failed to get company users' });
  }
});

// Update user role within company
companyRoutes.patch("/users/:userId/role", authenticateToken, requireRole(["Owner", "Administrator"]), async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['Owner', 'Administrator', 'Manager', 'Employee'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Check if user exists and belongs to the same company
    const user = await db.query.betterAuthUser.findFirst({
      where: sql`${betterAuthUser.id} = ${userId} AND ${betterAuthUser.tenantId} = ${req.user.tenantId}`,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent non-owners from promoting users to Owner role
    if (role === 'Owner' && req.user.role !== 'Owner') {
      return res.status(403).json({ message: 'Only owners can promote users to Owner role' });
    }

    // Prevent users from demoting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot change your own role' });
    }

    await db.update(betterAuthUser)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(sql`${betterAuthUser.id} = ${userId}`);

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

// Remove user from company
companyRoutes.delete("/users/:userId", authenticateToken, requireRole(["Owner", "Administrator"]), async (req: any, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists and belongs to the same company
    const user = await db.query.betterAuthUser.findFirst({
      where: sql`${betterAuthUser.id} = ${userId} AND ${betterAuthUser.tenantId} = ${req.user.tenantId}`,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent users from removing themselves
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot remove yourself from the company' });
    }

    // Prevent non-owners from removing owners
    if (user.role === 'Owner' && req.user.role !== 'Owner') {
      return res.status(403).json({ message: 'Only owners can remove other owners' });
    }

    // Delete user (this will cascade to related records)
    await db.delete(betterAuthUser)
      .where(sql`${betterAuthUser.id} = ${userId}`);

    res.json({ message: 'User removed from company successfully' });
  } catch (error) {
    console.error('Remove user error:', error);
    res.status(500).json({ message: 'Failed to remove user from company' });
  }
});

// Complete onboarding wizard
companyRoutes.post("/complete-onboarding", authenticateToken, async (req: any, res) => {
  try {
    console.log('📝 [Onboarding] Request body:', req.body);
    console.log('👤 [Onboarding] User:', { id: req.user?.id, tenantId: req.user?.tenantId });

    // Validate request body
    let validatedData;
    try {
      validatedData = completeOnboardingSchema.parse(req.body);
    } catch (validationError: any) {
      console.error('❌ [Onboarding] Validation error:', validationError);
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationError.errors || validationError.message
      });
    }

    const { geographicalLocation, language, businessDescription } = validatedData;

    const company = await db.query.companies.findFirst({
      where: sql`${companies.tenantId} = ${req.user.tenantId}`,
    });

    console.log('🏢 [Onboarding] Found company:', company ? company.id : 'none');

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    if (company.setupCompleted) {
      return res.status(400).json({ message: 'Onboarding already completed' });
    }

    const sanitizedLocation = sanitizeString(geographicalLocation);
    const sanitizedLanguage = sanitizeString(language);
    const sanitizedDescription = sanitizeString(businessDescription);

    console.log('💾 [Onboarding] Updating company with:', {
      location: sanitizedLocation,
      language: sanitizedLanguage,
      descriptionLength: sanitizedDescription?.length
    });

    const updatedCompany = await db.update(companies)
      .set({
        geographicalLocation: sanitizedLocation,
        language: sanitizedLanguage,
        businessDescription: sanitizedDescription,
        setupCompleted: true,
        updatedAt: new Date(),
      })
      .where(sql`${companies.tenantId} = ${req.user.tenantId}`)
      .returning();

    console.log('✅ [Onboarding] Successfully updated company');

    res.json({
      message: 'Onboarding completed successfully',
      company: updatedCompany[0],
    });
  } catch (error) {
    console.error('❌ [Onboarding] Unexpected error:', error);
    res.status(500).json({
      message: 'Failed to complete onboarding',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
