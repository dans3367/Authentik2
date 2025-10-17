import { Router } from 'express';
import { db } from '../db';
import { betterAuthSession, betterAuthUser, updateProfileSchema } from '@shared/schema';
import { eq, and, not } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth-middleware';

export const authRoutes = Router();

// Get user's own sessions
authRoutes.get("/user-sessions", authenticateToken, async (req: any, res) => {
  try {
    // Get the actual user ID from the authenticated session
    const userId = req.user.id;
    console.log('📊 [Sessions] Fetching sessions for user:', userId);

    // Get all Better Auth sessions for this user
    const userSessions = await db.query.betterAuthSession.findMany({
      where: eq(betterAuthSession.userId, userId),
      orderBy: (betterAuthSession, { desc }) => [desc(betterAuthSession.createdAt)],
    });
    
    console.log(`📊 [Sessions] Found ${userSessions.length} sessions for user ${userId}`);

    // Log the current session token from cookies for debugging
    const currentToken = req.cookies?.['better-auth.session_token'];
    console.log('🔍 [Sessions] Current session token from cookie:', currentToken ? `${currentToken.substring(0, 8)}...` : 'None');
    
    // Format sessions for frontend (adapt Better Auth data structure)
    const sessions = userSessions.map(session => {
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
        isCurrent: session.token === req.cookies?.['better-auth.session_token'],
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

    if (session.token === currentSessionToken) {
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
    const currentSession = await db.query.betterAuthSession.findFirst({
      where: and(
        eq(betterAuthSession.userId, userId),
        eq(betterAuthSession.token, currentSessionToken)
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
