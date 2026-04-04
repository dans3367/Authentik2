import { Router } from 'express';
import { authenticateToken } from '../middleware/auth-middleware';
import { db } from '../db';
import { betterAuthUser } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { invalidateUserSecurity } from '../utils/userSecurityCache';

export const twoFactorRoutes = Router();

// Server-side store for pending 2FA secrets (keyed by userId, auto-expires)
const pending2FASecrets = new Map<string, { secret: string; expiresAt: number }>();
const PENDING_2FA_TTL_MS = 10 * 60 * 1000; // 10 minutes

function storePending2FASecret(userId: string, secret: string) {
  // Clean up expired entries (cap at 1000)
  if (pending2FASecrets.size > 1000) {
    const now = Date.now();
    Array.from(pending2FASecrets.entries()).forEach(([key, val]) => {
      if (val.expiresAt < now) pending2FASecrets.delete(key);
    });
  }
  pending2FASecrets.set(userId, { secret, expiresAt: Date.now() + PENDING_2FA_TTL_MS });
}

function getPending2FASecret(userId: string): string | null {
  const entry = pending2FASecrets.get(userId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    pending2FASecrets.delete(userId);
    return null;
  }
  return entry.secret;
}

function clearPending2FASecret(userId: string) {
  pending2FASecrets.delete(userId);
}

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

    // Store secret server-side until user verifies and enables 2FA
    storePending2FASecret(userId, secret);

    res.json({
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
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    // Retrieve the pending secret from server-side storage (NOT from client)
    const secret = getPending2FASecret(userId);
    if (!secret) {
      return res.status(400).json({ message: '2FA setup has expired or was not initiated. Please start setup again.' });
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
      clearPending2FASecret(userId);
      return res.status(400).json({ message: '2FA is already enabled' });
    }

    // Verify the token with the server-stored secret
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

    // Clear the pending secret now that 2FA is enabled
    clearPending2FASecret(userId);

    // Invalidate security cache after 2FA change
    invalidateUserSecurity(userId, '2fa_change', {
      tenantId,
      req,
    });

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

    // Invalidate security cache after 2FA change
    invalidateUserSecurity(userId, '2fa_change', {
      tenantId,
      req,
    });

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
    };

    res.json(result);
  } catch (error) {
    console.error('❌ [2FA Status] Error:', error);
    res.status(500).json({ message: 'Failed to get 2FA status' });
  }
});

