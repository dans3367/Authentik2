import { Router } from 'express';
import { db } from '../db';
import { betterAuthSession, betterAuthUser } from '@shared/schema';
import { eq, and, not } from 'drizzle-orm';

export const authRoutes = Router();

// Get user's own sessions
authRoutes.get("/user-sessions", async (req: any, res) => {
  try {
    // For now, use a mock user ID since Better Auth session validation
    // would require more complex integration
    // In production, you'd validate the Better Auth session here
    const userId = 'temp-user-id'; // This should come from validated Better Auth session

    // Get all Better Auth sessions for this user
    const userSessions = await db.query.betterAuthSession.findMany({
      where: eq(betterAuthSession.userId, userId),
      orderBy: (betterAuthSession, { desc }) => [desc(betterAuthSession.createdAt)],
    });

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
        isCurrent: session.token === req.cookies?.refreshToken, // Compare with current session token
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
authRoutes.delete("/user-sessions", async (req: any, res) => {
  try {
    const { sessionId } = req.body;
    // Mock user ID for now - should come from validated Better Auth session
    const userId = 'temp-user-id';

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

    // Prevent deleting current session
    // Note: Better Auth might use different cookie names, so we need to be careful here
    const currentSessionToken = req.cookies?.better_auth_session_token ||
                               req.cookies?.session_token ||
                               req.cookies?.refreshToken;

    if (session.token === currentSessionToken) {
      return res.status(400).json({ message: 'Cannot delete current session' });
    }

    // Delete the session from Better Auth table
    await db.delete(betterAuthSession)
      .where(eq(betterAuthSession.id, sessionId));

    res.json({ message: 'Session ended successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ message: 'Failed to delete session' });
  }
});

// Log out all other sessions
authRoutes.post("/logout-all", async (req: any, res) => {
  try {
    // Mock user ID for now - should come from validated Better Auth session
    const userId = 'temp-user-id';

    // Get current session token (Better Auth might use different cookie names)
    const currentSessionToken = req.cookies?.better_auth_session_token ||
                               req.cookies?.session_token ||
                               req.cookies?.refreshToken;

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
