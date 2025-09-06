import { Router } from 'express';
import { authenticateToken } from '../middleware/auth-middleware';
import { db } from '../db';
import { users, betterAuthUser } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';

export const twoFactorRoutes = Router();

// Helper function to get or create user from betterAuthUser
export async function getOrCreateUser(userId: string, tenantId: string) {
  // Get user - first check if user exists in users table
  let user = await db.query.users.findFirst({
    where: and(
      eq(users.id, userId),
      eq(users.tenantId, tenantId)
    ),
  });

  // If user doesn't exist in users table, get from betterAuthUser and create/update
  if (!user) {
    const betterAuthUserRecord = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.id, userId)
    });

    if (!betterAuthUserRecord) {
      throw new Error('User not found in betterAuthUser table');
    }

    // Check if a user with this email already exists
    const existingUserByEmail = await db.query.users.findFirst({
      where: eq(users.email, betterAuthUserRecord.email)
    });

      if (existingUserByEmail) {
        // Log ID mismatch for debugging
        if (existingUserByEmail.id !== betterAuthUserRecord.id) {
          console.log(`User ID mismatch: existing user ID ${existingUserByEmail.id} != better-auth ID ${betterAuthUserRecord.id} for email ${betterAuthUserRecord.email}`);
        }
        
        // Update existing user record with better-auth data (but keep existing ID to preserve foreign key relationships)
        await db.update(users)
          .set({
            // Don't update ID - keep existing to preserve foreign key relationships
            tenantId: betterAuthUserRecord.tenantId,
            firstName: betterAuthUserRecord.name ? betterAuthUserRecord.name.split(' ')[0] : null,
            lastName: betterAuthUserRecord.name ? betterAuthUserRecord.name.split(' ').slice(1).join(' ') : null,
            role: betterAuthUserRecord.role || existingUserByEmail.role || 'Employee',
            emailVerified: betterAuthUserRecord.emailVerified,
            updatedAt: new Date(),
          })
          .where(eq(users.email, betterAuthUserRecord.email));
        
        // Get the updated user record (fetch fresh after update)
        user = await db.query.users.findFirst({
          where: eq(users.id, existingUserByEmail.id)
        });
    } else {
      // Create new user record in users table
      await db.insert(users).values({
        id: betterAuthUserRecord.id,
        tenantId: betterAuthUserRecord.tenantId,
        email: betterAuthUserRecord.email,
        password: null, // Using better-auth system, no password needed here
        firstName: betterAuthUserRecord.name ? betterAuthUserRecord.name.split(' ')[0] : null,
        lastName: betterAuthUserRecord.name ? betterAuthUserRecord.name.split(' ').slice(1).join(' ') : null,
        role: betterAuthUserRecord.role || 'Employee',
        isActive: true,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        emailVerified: betterAuthUserRecord.emailVerified,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      // Get the newly created user record
      user = await db.query.users.findFirst({
        where: and(
          eq(users.id, betterAuthUserRecord.id),
          eq(users.tenantId, betterAuthUserRecord.tenantId)
        ),
      });
    }

    if (!user) {
      throw new Error('Failed to create or update user record');
    }
  }

  return user;
}

// Setup 2FA - Generate secret and QR code
twoFactorRoutes.post('/setup', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    // Get or create user using helper function
    let user;
    try {
      user = await getOrCreateUser(userId, tenantId);
    } catch (error) {
      console.error('Error getting or creating user:', error);
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is already enabled' });
    }

    // Generate TOTP secret
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'Authentik', secret);

    // Generate QR code
    const qrCodeDataURL = await qrcode.toDataURL(otpauth);

    // Store temporary secret (not yet enabled)
    // We'll store it in a temporary field or cache for now
    // In production, consider using Redis or a temporary table

    res.json({
      secret,
      qrCode: qrCodeDataURL,
      otpauth,
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ message: 'Failed to setup 2FA' });
  }
});

// Enable 2FA - Verify token and enable
twoFactorRoutes.post('/enable', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;
    const { token, secret } = req.body;

    if (!token || !secret) {
      return res.status(400).json({ message: 'Token and secret are required' });
    }

    // Get or create user using helper function
    let user;
    try {
      user = await getOrCreateUser(userId, tenantId);
    } catch (error) {
      console.error('Error getting or creating user:', error);
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is already enabled' });
    }

    // Verify the token with the provided secret
    const isValid = authenticator.verify({ token, secret });

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Enable 2FA by storing the secret
    await db.update(users)
      .set({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        updatedAt: new Date(),
      })
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId)
      ));

    res.json({ message: '2FA enabled successfully' });
  } catch (error) {
    console.error('2FA enable error:', error);
    res.status(500).json({ message: 'Failed to enable 2FA' });
  }
});

// Disable 2FA - Require current token for verification
twoFactorRoutes.post('/disable', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    // Get or create user using helper function
    let user;
    try {
      user = await getOrCreateUser(userId, tenantId);
    } catch (error) {
      console.error('Error getting or creating user:', error);
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ message: '2FA is not enabled' });
    }

    // Verify the token
    const isValid = authenticator.verify({
      token,
      secret: user.twoFactorSecret
    });

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Disable 2FA
    await db.update(users)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId)
      ));

    res.json({ message: '2FA disabled successfully' });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({ message: 'Failed to disable 2FA' });
  }
});

// Verify 2FA token (for login or other verification)
twoFactorRoutes.post('/verify', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    // Get or create user using helper function
    let user;
    try {
      user = await getOrCreateUser(userId, tenantId);
    } catch (error) {
      console.error('Error getting or creating user:', error);
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ message: '2FA is not enabled for this user' });
    }

    // Verify the token
    const isValid = authenticator.verify({
      token,
      secret: user.twoFactorSecret
    });

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    res.json({ message: '2FA verification successful', valid: true });
  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({ message: 'Failed to verify 2FA token' });
  }
});

// Get 2FA status
twoFactorRoutes.get('/status', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    // Get or create user using helper function
    let user;
    try {
      user = await getOrCreateUser(userId, tenantId);
    } catch (error) {
      console.error('Error getting or creating user:', error);
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      enabled: user.twoFactorEnabled || false,
      hasSecret: !!user.twoFactorSecret,
    });
  } catch (error) {
    console.error('2FA status error:', error);
    res.status(500).json({ message: 'Failed to get 2FA status' });
  }
});

