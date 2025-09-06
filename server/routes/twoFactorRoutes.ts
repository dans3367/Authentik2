import { Router } from 'express';
import { authenticateToken } from '../middleware/auth-middleware';
import { db } from '../db';
import { betterAuthUser } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';

export const twoFactorRoutes = Router();

// Helper function to get user from betterAuthUser table
export async function getUser(userId: string) {
  const user = await db.query.betterAuthUser.findFirst({
    where: eq(betterAuthUser.id, userId)
  });

  if (!user) {
    throw new Error('User not found in betterAuthUser table');
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
      user = await getUser(userId);
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
      user = await getUser(userId);
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
    console.log(`🔐 [2FA Enable] Updating 2FA for user ID: ${userId}, tenant: ${tenantId}, actual user ID: ${user.id}`);
    
    const updateResult = await db.update(betterAuthUser)
      .set({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        updatedAt: new Date(),
      })
      .where(eq(betterAuthUser.id, user.id)); // Use the actual user ID from the fetched record, not the auth token

    console.log(`📊 [2FA Enable] Update result:`, updateResult);
    console.log(`✅ [2FA Enable] Rows affected: ${updateResult.rowCount || 0}`);

    if (updateResult.rowCount === 0) {
      console.error(`❌ [2FA Enable] No rows updated! User ID ${user.id} not found in update`);
      return res.status(500).json({ message: 'Failed to enable 2FA - user record not updated' });
    }

    // Verify the update worked by fetching the user again
    const updatedUser = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.id, user.id)
    });

    console.log(`🔍 [2FA Enable] Verification - Updated user 2FA status: ${updatedUser?.twoFactorEnabled}, has secret: ${!!updatedUser?.twoFactorSecret}`);

    res.json({ 
      message: '2FA enabled successfully',
      debug: {
        originalUserId: userId,
        actualUserId: user.id,
        rowsAffected: updateResult.rowCount,
        verifiedEnabled: updatedUser?.twoFactorEnabled,
        verifiedHasSecret: !!updatedUser?.twoFactorSecret
      }
    });
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
      user = await getUser(userId);
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
    await db.update(betterAuthUser)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, tenantId)
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
      user = await getUser(userId);
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

    console.log(`🔍 [2FA Status] Checking for user ID: ${userId}, tenant: ${tenantId}`);

    // Get or create user using helper function
    let user;
    try {
      user = await getUser(userId);
      console.log(`✅ [2FA Status] User found/created: ${user.email}, 2FA enabled: ${user.twoFactorEnabled}, has secret: ${!!user.twoFactorSecret}`);
    } catch (error) {
      console.error('❌ [2FA Status] Error getting or creating user:', error);
      return res.status(404).json({ message: 'User not found' });
    }

    const result = {
      enabled: user.twoFactorEnabled || false,
      hasSecret: !!user.twoFactorSecret,
      debug: {
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId,
        twoFactorEnabled: user.twoFactorEnabled,
        hasSecret: !!user.twoFactorSecret
      }
    };

    console.log(`📊 [2FA Status] Response:`, result);
    res.json(result);
  } catch (error) {
    console.error('❌ [2FA Status] Error:', error);
    res.status(500).json({ message: 'Failed to get 2FA status' });
  }
});

