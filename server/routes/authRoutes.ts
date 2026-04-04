import { Router } from 'express';
import { db } from '../db';
import { betterAuthSession, betterAuthUser, updateProfileSchema } from '@shared/schema';
import { eq, and, not } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth-middleware';
import { avatarUpload, handleUploadError } from '../middleware/upload';
import { uploadToR2, deleteImageFromR2, R2_CONFIG } from '../config/r2';
import { optimizeAvatar } from '../lib/imageOptimizer';
import { auth } from '../auth';
import crypto from 'crypto';
import { invalidateUserSecurity } from '../utils/userSecurityCache';

export const authRoutes = Router();

// Helper function to extract base token from Better Auth session cookie
// Better Auth cookies have format: token.signature - we need just the token part
function extractBaseToken(cookieToken: string | undefined): string | undefined {
  if (!cookieToken) return undefined;
  // If the token contains a dot, it has a signature suffix - extract just the base token
  const dotIndex = cookieToken.indexOf('.');
  return dotIndex > 0 ? cookieToken.substring(0, dotIndex) : cookieToken;
}

// Get user's own sessions
authRoutes.get("/user-sessions", authenticateToken, async (req: any, res) => {
  try {
    // Get the actual user ID from the authenticated session
    const userId = req.user.id;
    console.log('📊 [Sessions] Fetching sessions for user:', userId);

    // Use Better Auth's getSession to reliably identify the current session
    let currentSessionId: string | null = null;
    try {
      const sessionResult = await auth.api.getSession({
        headers: req.headers as any,
      });
      console.log('🔍 [Sessions] getSession result keys:', sessionResult ? Object.keys(sessionResult) : 'null');
      currentSessionId = sessionResult?.session?.id || null;
      console.log('🔍 [Sessions] Current session ID from Better Auth:', currentSessionId);
    } catch (e) {
      console.warn('⚠️ [Sessions] Could not determine current session via Better Auth API:', e);
    }

    // Fallback: match session token from cookie if getSession didn't return an ID
    if (!currentSessionId) {
      const cookieToken = extractBaseToken(req.cookies?.['better-auth.session_token']);
      if (cookieToken) {
        const matchedSession = await db.query.betterAuthSession.findFirst({
          where: and(
            eq(betterAuthSession.userId, userId),
            eq(betterAuthSession.token, cookieToken)
          ),
        });
        if (matchedSession) {
          currentSessionId = matchedSession.id;
          console.log('🔍 [Sessions] Current session ID from cookie fallback:', currentSessionId);
        }
      }
    }

    // Get all Better Auth sessions for this user
    const userSessions = await db.query.betterAuthSession.findMany({
      where: eq(betterAuthSession.userId, userId),
      orderBy: (sessions: any, { desc }: any) => [desc(sessions.createdAt)],
    });
    
    console.log(`� [Sessions] Found ${userSessions.length} sessions for user ${userId}`);
    
    // Format sessions for frontend (adapt Better Auth data structure)
    const sessions = userSessions.map((session: any) => {
      // Parse user agent to get device info
      const userAgent = session.userAgent || '';
      const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
      const isTablet = /tablet|ipad/i.test(userAgent);
      const isDesktop = !isMobile && !isTablet;

      let deviceName = 'Unknown Device';
      if (isMobile) deviceName = 'Mobile Device';
      else if (isTablet) deviceName = 'Tablet Device';
      else if (isDesktop) deviceName = 'Desktop Device';

      // Try to extract browser/OS info from user agent
      if (userAgent.includes('Chrome')) deviceName = 'Chrome on Desktop';
      else if (userAgent.includes('Firefox')) deviceName = 'Firefox on Desktop';
      else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) deviceName = 'Safari on Desktop';
      else if (userAgent.includes('Edge')) deviceName = 'Edge on Desktop';

      return {
        id: session.id,
        deviceId: session.id, // Use session ID as device ID
        deviceName: deviceName,
        ipAddress: session.ipAddress || 'Unknown',
        userAgent: userAgent,
        location: null, // Better Auth doesn't store location data
        isCurrent: session.id === currentSessionId,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      };
    });

    res.json({ sessions });
  } catch (error) {
    console.error('Get user sessions error:', error);
    res.status(500).json({ message: 'Failed to get sessions' });
  }
});

// Delete a specific session
authRoutes.delete("/user-sessions", authenticateToken, async (req: any, res) => {
  try {
    const { sessionId } = req.body;
    // Get the actual user ID from the authenticated session
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    // Find the session and verify ownership
    const session = await db.query.betterAuthSession.findFirst({
      where: and(
        eq(betterAuthSession.id, sessionId),
        eq(betterAuthSession.userId, userId)
      ),
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Prevent deleting current session - use Better Auth's getSession for reliable detection
    let currentSessionId: string | null = null;
    try {
      const sessionResult = await auth.api.getSession({
        headers: req.headers as any,
      });
      currentSessionId = sessionResult?.session?.id || null;
    } catch (e) {
      console.warn('⚠️ [Session Delete] Could not determine current session via API:', e);
    }

    // Fallback: match session token from cookie
    if (!currentSessionId) {
      const cookieToken = extractBaseToken(req.cookies?.['better-auth.session_token']);
      if (cookieToken) {
        const matchedSession = await db.query.betterAuthSession.findFirst({
          where: and(
            eq(betterAuthSession.userId, userId),
            eq(betterAuthSession.token, cookieToken)
          ),
        });
        currentSessionId = matchedSession?.id || null;
      }
    }

    console.log('🔍 [Session Delete] Session to delete:', sessionId);
    console.log('🔍 [Session Delete] Current session ID:', currentSessionId);

    if (currentSessionId && sessionId === currentSessionId) {
      console.log('❌ [Session Delete] Prevented deletion of current session');
      return res.status(400).json({ message: 'Cannot delete current session. Use logout instead.' });
    }

    // Delete the session from Better Auth table (scoped to user for defense-in-depth)
    const deletedSession = await db.delete(betterAuthSession)
      .where(and(
        eq(betterAuthSession.id, sessionId),
        eq(betterAuthSession.userId, userId)
      ))
      .returning({ id: betterAuthSession.id });

    console.log('✅ [Session Delete] Successfully deleted session:', sessionId);
    console.log('📊 [Session Delete] Rows affected:', deletedSession.length);

    // Invalidate security cache — a session was revoked
    invalidateUserSecurity(userId, 'session_revoked', {
      tenantId: req.user.tenantId,
      performedBy: req.user.id,
      req,
    });

    res.json({
      message: 'Session ended successfully',
      sessionId,
      deleted: true
    });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ message: 'Failed to delete session' });
  }
});

// Log out all other sessions
authRoutes.post("/logout-all", authenticateToken, async (req: any, res) => {
  try {
    // Get the actual user ID from the authenticated session
    const userId = req.user.id;

    // Use Better Auth's getSession for reliable current session detection
    let currentSessionId: string | null = null;
    try {
      const sessionResult = await auth.api.getSession({
        headers: req.headers as any,
      });
      currentSessionId = sessionResult?.session?.id || null;
    } catch (e) {
      console.warn('⚠️ [Logout All] Could not determine current session via API:', e);
    }

    // Fallback: match session token from cookie
    if (!currentSessionId) {
      const cookieToken = extractBaseToken(req.cookies?.['better-auth.session_token']);
      if (cookieToken) {
        const matchedSession = await db.query.betterAuthSession.findFirst({
          where: and(
            eq(betterAuthSession.userId, userId),
            eq(betterAuthSession.token, cookieToken)
          ),
        });
        currentSessionId = matchedSession?.id || null;
      }
    }

    if (!currentSessionId) {
      return res.status(400).json({ message: 'Could not identify current session' });
    }

    // Delete all sessions except the current one
    const deletedSessions = await db.delete(betterAuthSession)
      .where(and(
        eq(betterAuthSession.userId, userId),
        not(eq(betterAuthSession.id, currentSessionId))
      ))
      .returning({ id: betterAuthSession.id });

    const deletedCount = deletedSessions.length;

    // Invalidate security cache — all other sessions revoked
    invalidateUserSecurity(userId, 'logout_all', {
      tenantId: req.user.tenantId,
      performedBy: req.user.id,
      req,
    });

    res.json({
      message: `Successfully logged out ${deletedCount} other session${deletedCount !== 1 ? 's' : ''}`,
      sessionsEnded: deletedCount
    });
  } catch (error) {
    console.error('Logout all sessions error:', error);
    res.status(500).json({ message: 'Failed to logout other sessions' });
  }
});

// Update user profile (language, theme, menu preferences)
authRoutes.patch("/profile", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    // Validate the update data
    const validatedData = updateProfileSchema.partial().parse(updateData);

    const tenantId = req.user.tenantId;

    // Update the user's profile
    const updatedUser = await db.update(betterAuthUser)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(and(
        eq(betterAuthUser.id, userId),
        eq(betterAuthUser.tenantId, tenantId)
      ))
      .returning();

    if (updatedUser.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Invalidate security cache — language or other cached fields may have changed
    invalidateUserSecurity(userId, 'profile_update', {
      tenantId,
      req,
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser[0],
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Upload avatar
authRoutes.post("/avatar", authenticateToken, (req: any, res) => {
  avatarUpload(req, res, async (err) => {
    if (err) {
      const errorMessage = handleUploadError(err);
      return res.status(400).json({ success: false, error: errorMessage });
    }

    try {
      const userId = req.user.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      // Check if R2 is configured
      if (!R2_CONFIG.isConfigured) {
        return res.status(503).json({ 
          success: false, 
          error: 'Avatar upload service is not configured' 
        });
      }

      // Get current user to check for existing avatar
      const currentUser = await db.query.betterAuthUser.findFirst({
        where: eq(betterAuthUser.id, userId)
      });

      // Optimize image using sharp before upload
      let optimized;
      try {
        optimized = await optimizeAvatar(file.buffer);
        const reduction = optimized.originalSize > 0 
          ? `(${Math.round((1 - optimized.optimizedSize / optimized.originalSize) * 100)}% reduction)` 
          : '';
        console.log(`📸 [Avatar] Optimized image: ${optimized.originalSize} -> ${optimized.optimizedSize} bytes ${reduction}`);
      } catch (error) {
        console.error('Image optimization error:', error);
        return res.status(400).json({ success: false, error: 'Failed to process image. Please ensure the file is a valid image.' });
      }

      // Generate unique filename with webp extension (optimized format)
      const uniqueFilename = `${userId}-${crypto.randomBytes(8).toString('hex')}.webp`;
      const key = `avatars/${uniqueFilename}`;

      // Upload optimized image to R2
      const avatarUrl = await uploadToR2(key, optimized.buffer, optimized.mimetype);

      // Update user record with new avatar URL
      const updatedUser = await db.update(betterAuthUser)
        .set({
          avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(betterAuthUser.id, userId))
        .returning();

      if (updatedUser.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      // Delete old avatar after successful update (safe rollback)
      if (currentUser?.avatarUrl) {
        await deleteImageFromR2(currentUser.avatarUrl).catch(err => {
          console.warn('Failed to delete old avatar:', err);
        });
      }

      console.log('✅ [Avatar] Successfully uploaded avatar for user:', userId);
      res.json({
        success: true,
        url: avatarUrl,
        message: 'Avatar uploaded successfully'
      });
    } catch (error) {
      console.error('Avatar upload error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to upload avatar' 
      });
    }
  });
});

// Delete avatar
authRoutes.delete("/avatar", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;

    // Get current user to check for existing avatar
    const currentUser = await db.query.betterAuthUser.findFirst({
      where: eq(betterAuthUser.id, userId)
    });

    if (!currentUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Delete avatar from R2 if exists
    if (currentUser.avatarUrl) {
      await deleteImageFromR2(currentUser.avatarUrl).catch(err => {
        console.warn('Failed to delete avatar from R2:', err);
      });
    }

    // Update user record to remove avatar URL
    const updatedUser = await db.update(betterAuthUser)
      .set({
        avatarUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(betterAuthUser.id, userId))
      .returning();

    console.log('✅ [Avatar] Successfully deleted avatar for user:', userId);
    res.json({
      success: true,
      message: 'Avatar deleted successfully'
    });
  } catch (error) {
    console.error('Avatar deletion error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete avatar' 
    });
  }
});
