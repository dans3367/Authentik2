import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { tenants, betterAuthUser } from '@shared/schema';
// Note: bcrypt removed - better-auth handles password hashing
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { randomUUID } from 'crypto';

export const devRoutes = Router();

// Health check endpoint with temporal status
devRoutes.get("/health", async (req, res) => {
  try {
    // Database health check
    let dbStatus = 'disconnected';
    try {
      await db.execute(sql`SELECT 1`);
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    // server-node service status
    let serverNodeStatus = null;
    try {
      const response = await fetch('http://localhost:3502/health', { timeout: 2000 });
      if (response.ok) {
        const health = await response.json();
        serverNodeStatus = {
          connected: true,
          status: 'connected',
          healthCheck: true,
          response: health
        };
      } else {
        serverNodeStatus = {
          connected: false,
          status: `HTTP ${response.status}`,
          healthCheck: false
        };
      }
    } catch (error) {
      serverNodeStatus = {
        connected: false,
        status: 'connection failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus,
          connected: dbStatus === 'connected'
        },
        serverNode: serverNodeStatus
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        temporalGrpcServer: process.env.TEMPORAL_GRPC_SERVER || 'localhost:50051',
        serverNodeUrl: 'http://localhost:3502'
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Create test managers
devRoutes.post("/create-test-managers", async (req, res) => {
  try {
    // This endpoint is for development/testing purposes only
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'This endpoint is not available in production' });
    }

    const { companyId, count = 5 } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: 'Company ID is required' });
    }

    const managers = [];
    // Note: Password hashing removed - better-auth handles authentication
    // Test managers will need to set passwords through better-auth

    for (let i = 1; i <= count; i++) {
      const manager = await db.insert(betterAuthUser).values({
        email: `manager${i}@test.com`,
        // Note: password field removed - better-auth handles authentication
        firstName: `Manager`,
        lastName: `${i}`,
        role: 'Manager',
        emailVerified: true,
        tenantId: companyId,
        createdAt: new Date(),
      }).returning();

      managers.push(manager[0]);
    }

    res.json({
      message: `${count} test managers created successfully`,
      managers: managers.map(m => ({
        id: m.id,
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        role: m.role,
      })),
    });
  } catch (error) {
    console.error('Create test managers error:', error);
    res.status(500).json({ message: 'Failed to create test managers' });
  }
});

// Update test user
devRoutes.post("/update-test-user", async (req, res) => {
  try {
    // This endpoint is for development/testing purposes only
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'This endpoint is not available in production' });
    }

    const { userId, updates } = req.body;

    if (!userId || !updates) {
      return res.status(400).json({ message: 'User ID and updates are required' });
    }

    const user = await db.query.betterAuthUser.findFirst({
      where: sql`${betterAuthUser.id} = ${userId}`,
    });

    // For dev routes, skip tenant check if no tenantId provided (for testing purposes)
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = await db.update(betterAuthUser)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(sql`${betterAuthUser.id} = ${userId}`)
      .returning();

    res.json({
      message: 'Test user updated successfully',
      user: updatedUser[0],
    });
  } catch (error) {
    console.error('Update test user error:', error);
    res.status(500).json({ message: 'Failed to update test user' });
  }
});

// Test token generation
devRoutes.post("/test-token", async (req, res) => {
  try {
    // This endpoint is for development/testing purposes only
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'This endpoint is not available in production' });
    }

    const { userId, email, role, companyId } = req.body;

    if (!userId || !email || !role) {
      return res.status(400).json({ message: 'User ID, email, and role are required' });
    }

    // Note: JWT token generation removed - better-auth handles authentication
    // Use better-auth endpoints for authentication instead

    res.json({
      message: 'Authentication now handled by better-auth',
      note: 'Use /api/auth endpoints for login/register',
      userInfo: {
        userId,
        email,
        role,
        tenantId: companyId || null,
      },
    });
  } catch (error) {
    console.error('Test token generation error:', error);
    res.status(500).json({ message: 'Failed to generate test token' });
  }
});

// Test email verification
devRoutes.post("/test-verification", async (req, res) => {
  try {
    // This endpoint is for development/testing purposes only
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'This endpoint is not available in production' });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await db.query.betterAuthUser.findFirst({
      where: sql`${betterAuthUser.email} = ${email}`,
    });

    // For dev routes, skip tenant check if no tenantId provided (for testing purposes)
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate new verification token
    const verificationToken = randomUUID();
    await db.update(betterAuthUser)
      .set({ 
        verificationToken,
        updatedAt: new Date(),
      })
      .where(sql`${betterAuthUser.id} = ${user.id}`);

    res.json({
      message: 'Verification token generated successfully',
      email: user.email,
      verificationToken,
      verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
    });
  } catch (error) {
    console.error('Test verification error:', error);
    res.status(500).json({ message: 'Failed to generate verification token' });
  }
});

// Get debug information
devRoutes.get("/debug/info", authenticateToken, async (req: any, res) => {
  try {
    // This endpoint is for development/testing purposes only
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'This endpoint is not available in production' });
    }

    const user = await db.query.betterAuthUser.findFirst({
      where: sql`${betterAuthUser.id} = ${req.user.id}`,
      with: {
        company: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        companyId: user.companyId,
        company: user.company,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
      token: req.user,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        databaseUrl: process.env.DATABASE_URL ? 'configured' : 'not configured',
        jwtSecret: process.env.JWT_SECRET ? 'configured' : 'not configured',
        stripeSecret: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not configured',
        resendApiKey: process.env.RESEND_API_KEY ? 'configured' : 'not configured',
      },
    });
  } catch (error) {
    console.error('Debug info error:', error);
    res.status(500).json({ message: 'Failed to get debug information' });
  }
});

// Reset user password (dev only)
devRoutes.post("/reset-password", async (req, res) => {
  try {
    // This endpoint is for development/testing purposes only
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'This endpoint is not available in production' });
    }

    const { email, newPassword = 'test123' } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await db.query.betterAuthUser.findFirst({
      where: sql`${betterAuthUser.email} = ${email}`,
    });

    // For dev routes, skip tenant check if no tenantId provided (for testing purposes)
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Note: Password hashing removed - better-auth handles password management
    // In a real application, you would use better-auth's password reset flow

    await db.update(betterAuthUser)
      .set({
        // Note: password field removed - better-auth handles authentication
        updatedAt: new Date(),
      })
      .where(sql`${betterAuthUser.id} = ${user.id}`);

    res.json({
      message: 'User updated (password management now handled by better-auth)',
      email: user.email,
      note: 'Use better-auth password reset flow for password changes',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// Create test data
devRoutes.post("/create-test-data", async (req, res) => {
  try {
    // This endpoint is for development/testing purposes only
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'This endpoint is not available in production' });
    }

    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: 'Company ID is required' });
    }

    // Create test forms
    const testForms = [];
    for (let i = 1; i <= 3; i++) {
      const form = await db.insert(db.forms).values({
        title: `Test Form ${i}`,
        description: `This is a test form ${i}`,
        schema: JSON.stringify({
          fields: [
            {
              type: 'text',
              name: 'name',
              label: 'Name',
              required: true,
            },
            {
              type: 'email',
              name: 'email',
              label: 'Email',
              required: true,
            },
          ],
        }),
        companyId,
        published: i <= 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      testForms.push(form[0]);
    }

    // Create test email contacts
    const testContacts = [];
    for (let i = 1; i <= 5; i++) {
      const contact = await db.insert(db.emailContacts).values({
        email: `test${i}@example.com`,
        firstName: `Test`,
        lastName: `User ${i}`,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      testContacts.push(contact[0]);
    }

    res.json({
      message: 'Test data created successfully',
      forms: testForms.length,
      contacts: testContacts.length,
    });
  } catch (error) {
    console.error('Create test data error:', error);
    res.status(500).json({ message: 'Failed to create test data' });
  }
});

// Create test newsletter
devRoutes.post("/create-test-newsletter", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    // This endpoint is for development/testing purposes only
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'This endpoint is not available in production' });
    }

    const { newsletters } = await import('@shared/schema');
    const { sql } = await import('drizzle-orm');

    const testNewsletter = await db.insert(newsletters).values({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      title: 'Test Newsletter',
      subject: 'Test Subject',
      content: '<h1>Test Newsletter Content</h1><p>This is a test newsletter.</p>',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    res.json({
      message: 'Test newsletter created successfully',
      newsletter: testNewsletter[0],
    });
  } catch (error) {
    console.error('Create test newsletter error:', error);
    res.status(500).json({ message: 'Failed to create test newsletter' });
  }
});

// Clear test data
devRoutes.delete("/clear-test-data", async (req, res) => {
  try {
    // This endpoint is for development/testing purposes only
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'This endpoint is not available in production' });
    }

    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: 'Company ID is required' });
    }

    // Delete test forms
    const deletedForms = await db.delete(db.forms)
      .where(sql`${db.forms.companyId} = ${companyId} AND ${db.forms.title} LIKE 'Test Form%'`)
      .returning();

    // Delete test email contacts
    const deletedContacts = await db.delete(db.emailContacts)
      .where(sql`${db.emailContacts.email} LIKE 'test%@example.com'`)
      .returning();

    res.json({
      message: 'Test data cleared successfully',
      deletedForms: deletedForms.length,
      deletedContacts: deletedContacts.length,
    });
  } catch (error) {
    console.error('Clear test data error:', error);
    res.status(500).json({ message: 'Failed to clear test data' });
  }
});

// Debug 2FA status for a user
devRoutes.get("/debug-2fa/:email", async (req, res) => {
  try {
    // This endpoint is for development/testing purposes only
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'This endpoint is not available in production' });
    }

    const { email } = req.params;
    console.log(`🔍 Debug 2FA for email: ${email}`);
    
    // Check better-auth user
    const betterAuthUserRecord = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.email, email)
    });
    
    console.log('Better-auth user:', betterAuthUserRecord ? {
      id: betterAuthUserRecord.id,
      email: betterAuthUserRecord.email,
      tenantId: betterAuthUserRecord.tenantId
    } : 'Not found');
    
    // Check users table
    const user = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.email, email)
    });
    
    console.log('Users table record:', user ? {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      twoFactorEnabled: user.twoFactorEnabled,
      hasSecret: !!user.twoFactorSecret,
      secretPreview: user.twoFactorSecret ? `${user.twoFactorSecret.substring(0, 8)}...` : 'None'
    } : 'Not found');
    
    // If both exist, check ID mismatch
    const idMatch = betterAuthUserRecord && user ? betterAuthUserRecord.id === user.id : null;
    const tenantMatch = betterAuthUserRecord && user ? betterAuthUserRecord.tenantId === user.tenantId : null;
    
    const result = {
      email,
      betterAuthUser: betterAuthUserRecord ? {
        id: betterAuthUserRecord.id,
        email: betterAuthUserRecord.email,
        tenantId: betterAuthUserRecord.tenantId
      } : null,
      usersTableRecord: user ? {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        twoFactorEnabled: user.twoFactorEnabled,
        hasSecret: !!user.twoFactorSecret,
        secretPreview: user.twoFactorSecret ? `${user.twoFactorSecret.substring(0, 8)}...` : null
      } : null,
      matches: {
        idMatch,
        tenantMatch
      },
      issues: []
    };
    
    // Identify potential issues
    if (!betterAuthUserRecord) {
      result.issues.push('User not found in better_auth_user table');
    }
    if (!user) {
      result.issues.push('User not found in users table');
    }
    if (betterAuthUserRecord && user && idMatch === false) {
      result.issues.push('ID mismatch between better-auth and users table');
    }
    if (betterAuthUserRecord && user && tenantMatch === false) {
      result.issues.push('Tenant ID mismatch between better-auth and users table');
    }
    if (user && user.twoFactorEnabled && !user.twoFactorSecret) {
      result.issues.push('2FA enabled but no secret stored');
    }
    
    res.json(result);
  } catch (error) {
    console.error('Debug 2FA error:', error);
    res.status(500).json({ message: 'Failed to debug 2FA status' });
  }
});

// Force disable 2FA for a user (dev only)
devRoutes.post("/force-disable-2fa/:email", async (req, res) => {
  try {
    // This endpoint is for development/testing purposes only
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'This endpoint is not available in production' });
    }

    const { email } = req.params;
    console.log(`🔍 Force disabling 2FA for email: ${email}`);
    
    // Check current status
    const user = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.email, email)
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found in users table' });
    }
    
    console.log('📊 Current user status:', {
      id: user.id,
      email: user.email,
      twoFactorEnabled: user.twoFactorEnabled,
      hasSecret: !!user.twoFactorSecret
    });
    
    // Force disable 2FA
    const updateResult = await db.update(betterAuthUser)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        updatedAt: new Date(),
      })
      .where(eq(betterAuthUser.id, user.id));
    
    console.log(`✅ Force disable result: ${updateResult.rowCount} rows affected`);
    
    // Verify the update
    const updatedUser = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.id, user.id)
    });
    
    console.log('🔍 Updated user status:', {
      id: updatedUser?.id,
      email: updatedUser?.email,
      twoFactorEnabled: updatedUser?.twoFactorEnabled,
      hasSecret: !!updatedUser?.twoFactorSecret
    });
    
    const result = {
      message: '2FA forcefully disabled',
      email,
      before: {
        twoFactorEnabled: user.twoFactorEnabled,
        hasSecret: !!user.twoFactorSecret
      },
      after: {
        twoFactorEnabled: updatedUser?.twoFactorEnabled || false,
        hasSecret: !!updatedUser?.twoFactorSecret
      },
      rowsAffected: updateResult.rowCount
    };
    
    res.json(result);
  } catch (error) {
    console.error('Force disable 2FA error:', error);
    res.status(500).json({ message: 'Failed to force disable 2FA' });
  }
});

// Force enable 2FA for a user (dev only)
devRoutes.post("/force-enable-2fa/:email", async (req, res) => {
  try {
    // This endpoint is for development/testing purposes only
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'This endpoint is not available in production' });
    }

    const { email } = req.params;
    const { secret } = req.body || {};

    console.log(`🔍 Force enabling 2FA for email: ${email}`);

    // Check current status
    const user = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.email, email)
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found in users table' });
    }

    console.log('📊 Current user status:', {
      id: user.id,
      email: user.email,
      twoFactorEnabled: user.twoFactorEnabled,
      hasSecret: !!user.twoFactorSecret
    });

    // Generate a secret if not provided
    const finalSecret = secret || require('crypto').randomBytes(32).toString('base64');

    // Force enable 2FA
    const updateResult = await db.update(betterAuthUser)
      .set({
        twoFactorEnabled: true,
        twoFactorSecret: finalSecret,
        updatedAt: new Date(),
      })
      .where(eq(betterAuthUser.id, user.id));

    console.log(`✅ Force enable result: ${updateResult.rowCount} rows affected`);

    // Verify the update
    const updatedUser = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.id, user.id)
    });

    console.log('🔍 Updated user status:', {
      id: updatedUser?.id,
      email: updatedUser?.email,
      twoFactorEnabled: updatedUser?.twoFactorEnabled,
      hasSecret: !!updatedUser?.twoFactorSecret,
      secretPreview: updatedUser?.twoFactorSecret ? `${updatedUser.twoFactorSecret.substring(0, 8)}...` : 'None'
    });

    const result = {
      message: '2FA forcefully enabled',
      email,
      before: {
        twoFactorEnabled: user.twoFactorEnabled,
        hasSecret: !!user.twoFactorSecret
      },
      after: {
        twoFactorEnabled: updatedUser?.twoFactorEnabled || false,
        hasSecret: !!updatedUser?.twoFactorSecret
      },
      secret: finalSecret,
      rowsAffected: updateResult.rowCount
    };

    res.json(result);
  } catch (error) {
    console.error('Force enable 2FA error:', error);
    res.status(500).json({ message: 'Failed to force enable 2FA' });
  }
});