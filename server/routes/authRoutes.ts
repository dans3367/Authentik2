import { Router } from 'express';
import { db } from '../db';
import { betterAuthSession, betterAuthUser, updateProfileSchema } from '@shared/schema';
import { eq, and, not } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth-middleware';
import { avatarUpload, handleUploadError } from '../middleware/upload';
import { uploadToR2, deleteImageFromR2, R2_CONFIG } from '../config/r2';
import { optimizeAvatar } from '../lib/imageOptimizer';
import crypto from 'crypto';

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

    // Get all Better Auth sessions for this user
    const userSessions = await db.query.betterAuthSession.findMany({
      where: eq(betterAuthSession.userId, userId),
      orderBy: (sessions: any, { desc }: any) => [desc(sessions.createdAt)],
    });
    
    console.log(`📊 [Sessions] Found ${userSessions.length} sessions for user ${userId}`);

    // Log the current session token from cookies for debugging
    const currentToken = req.cookies?.['better-auth.session_token'];
    console.log('🔍 [Sessions] Current session token from cookie:', currentToken ? `${currentToken.substring(0, 8)}...` : 'None');
    
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
        location: null, // Better Auth doesn't store location data
        // Better Auth stores the session token in the cookie, not the session ID
        // Check both token and ID for compatibility
        isCurrent: session.token === extractBaseToken(req.cookies?.['better-auth.session_token']),
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

    // Prevent deleting current session using Better Auth cookie
    const currentSessionToken = req.cookies?.['better-auth.session_token'];
    
    console.log('🔍 [Session Delete] Session to delete:', sessionId);
    console.log('🔍 [Session Delete] Session token to delete:', session.token.substring(0, 8) + '...');
    console.log('🔍 [Session Delete] Current session token:', currentSessionToken ? currentSessionToken.substring(0, 8) + '...' : 'None');
    console.log('🔍 [Session Delete] Is current session?:', session.token === currentSessionToken);

    if (session.token === extractBaseToken(currentSessionToken)) {
      console.log('❌ [Session Delete] Prevented deletion of current session');
      return res.status(400).json({ message: 'Cannot delete current session. Use logout instead.' });
    }

    // Delete the session from Better Auth table
    const deleteResult = await db.delete(betterAuthSession)
      .where(eq(betterAuthSession.id, sessionId));

    console.log('✅ [Session Delete] Successfully deleted session:', sessionId);
    console.log('📊 [Session Delete] Rows affected:', deleteResult.rowCount || 0);

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

    // Get current session token from Better Auth cookie
    const currentSessionToken = req.cookies?.['better-auth.session_token'];

    if (!currentSessionToken) {
      return res.status(400).json({ message: 'No current session found' });
    }

    // Find current session to exclude it from deletion
    // Extract base token from cookie (Better Auth cookies have format: token.signature)
    const baseToken = extractBaseToken(currentSessionToken);
    
    if (!baseToken) {
      return res.status(400).json({ message: 'Invalid session token format' });
    }
    
    const currentSession = await db.query.betterAuthSession.findFirst({
      where: and(
        eq(betterAuthSession.userId, userId),
        eq(betterAuthSession.token, baseToken)
      ),
    });

    if (!currentSession) {
      return res.status(400).json({ message: 'Current session not found' });
    }

    // Delete all sessions except the current one
    const result = await db.delete(betterAuthSession)
      .where(and(
        eq(betterAuthSession.userId, userId),
        not(eq(betterAuthSession.id, currentSession.id)) // Don't delete current session
      ));

    const deletedCount = result.rowCount || 0;

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

    // Update the user's profile
    const updatedUser = await db.update(betterAuthUser)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(betterAuthUser.id, userId))
      .returning();

    if (updatedUser.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

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

      // Delete old avatar if exists
      if (currentUser?.avatarUrl) {
        await deleteImageFromR2(currentUser.avatarUrl).catch(err => {
          console.warn('Failed to delete old avatar:', err);
        });
      }

      // Optimize image using sharp before upload
      const optimized = await optimizeAvatar(file.buffer);
      console.log(`📸 [Avatar] Optimized image: ${optimized.originalSize} -> ${optimized.optimizedSize} bytes (${Math.round((1 - optimized.optimizedSize / optimized.originalSize) * 100)}% reduction)`);

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
