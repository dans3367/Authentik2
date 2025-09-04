import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { users, tenants } from '@shared/schema';
import { authenticateToken } from './authRoutes';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export const devRoutes = Router();

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
    const hashedPassword = await bcrypt.hash('test123', 12);

    for (let i = 1; i <= count; i++) {
      const manager = await db.insert(users).values({
        email: `manager${i}@test.com`,
        password: hashedPassword,
        firstName: `Manager`,
        lastName: `${i}`,
        role: 'Manager',
        emailVerified: true,
        companyId,
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

    const user = await db.query.users.findFirst({
      where: sql`${users.id} = ${userId}`,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = await db.update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(sql`${users.id} = ${userId}`)
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

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key";

    const token = jwt.sign(
      { 
        userId, 
        email, 
        role,
        companyId: companyId || null,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Test token generated successfully',
      token,
      payload: {
        userId,
        email,
        role,
        companyId: companyId || null,
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

    const user = await db.query.users.findFirst({
      where: sql`${users.email} = ${email}`,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate new verification token
    const verificationToken = randomUUID();
    await db.update(users)
      .set({ 
        verificationToken,
        updatedAt: new Date(),
      })
      .where(sql`${users.id} = ${user.id}`);

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

    const user = await db.query.users.findFirst({
      where: sql`${users.id} = ${req.user.userId}`,
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

    const user = await db.query.users.findFirst({
      where: sql`${users.email} = ${email}`,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await db.update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(sql`${users.id} = ${user.id}`);

    res.json({
      message: 'Password reset successfully',
      email: user.email,
      newPassword,
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