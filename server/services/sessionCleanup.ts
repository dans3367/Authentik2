import { IStorage } from '../storage.js';
import { db } from '../db.js';
import { refreshTokens } from '../../shared/schema.js';
import { and, lt, eq, count, desc, not, inArray, gt } from 'drizzle-orm';

export interface SessionCleanupConfig {
  // Cleanup intervals
  cleanupIntervalMinutes: number; // How often to run cleanup
  
  // Session policies  
  maxSessionsPerUser: number; // Maximum active sessions per user
  inactivityTimeoutDays: number; // Days before inactive session is cleaned up
  
  // Cleanup options
  cleanExpiredTokens: boolean; // Clean tokens past expiresAt
  cleanInactiveSessions: boolean; // Clean sessions not used recently
  enforceSessionLimits: boolean; // Remove oldest sessions if over limit
  
  // Logging
  enableCleanupLogs: boolean;
}

export const defaultSessionConfig: SessionCleanupConfig = {
  cleanupIntervalMinutes: 60, // Run every hour
  maxSessionsPerUser: 10, // Allow up to 10 active sessions per user
  inactivityTimeoutDays: 30, // Clean sessions inactive for 30 days
  cleanExpiredTokens: true,
  cleanInactiveSessions: true,
  enforceSessionLimits: true,
  enableCleanupLogs: true,
};

export interface SessionCleanupStats {
  expiredTokensRemoved: number;
  inactiveSessionsRemoved: number;
  excessSessionsRemoved: number;
  totalSessionsRemoved: number;
  cleanupTimestamp: Date;
  nextCleanupAt: Date;
}

export class SessionCleanupService {
  private storage: IStorage;
  private config: SessionCleanupConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastCleanupStats: SessionCleanupStats | null = null;

  constructor(storage: IStorage, config: Partial<SessionCleanupConfig> = {}) {
    this.storage = storage;
    this.config = { ...defaultSessionConfig, ...config };
  }

  /**
   * Start the automatic session cleanup service
   */
  start(): void {
    if (this.cleanupInterval) {
      this.log('Session cleanup service is already running');
      return;
    }

    this.log(`Starting session cleanup service (interval: ${this.config.cleanupIntervalMinutes}m)`);
    
    // Run initial cleanup
    this.runCleanup().catch(error => {
      console.error('[SessionCleanup] Initial cleanup failed:', error);
    });

    // Schedule recurring cleanup
    const intervalMs = this.config.cleanupIntervalMinutes * 60 * 1000;
    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch(error => {
        console.error('[SessionCleanup] Scheduled cleanup failed:', error);
      });
    }, intervalMs);

    this.isRunning = true;
  }

  /**
   * Stop the automatic session cleanup service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    this.log('Session cleanup service stopped');
  }

  /**
   * Check if the cleanup service is currently running
   */
  isActive(): boolean {
    return this.isRunning && this.cleanupInterval !== null;
  }

  /**
   * Get the last cleanup statistics
   */
  getLastCleanupStats(): SessionCleanupStats | null {
    return this.lastCleanupStats;
  }

  /**
   * Run the complete session cleanup process
   */
  async runCleanup(): Promise<SessionCleanupStats> {
    const startTime = Date.now();
    const stats: SessionCleanupStats = {
      expiredTokensRemoved: 0,
      inactiveSessionsRemoved: 0,
      excessSessionsRemoved: 0,
      totalSessionsRemoved: 0,
      cleanupTimestamp: new Date(),
      nextCleanupAt: new Date(Date.now() + this.config.cleanupIntervalMinutes * 60 * 1000),
    };

    try {
      this.log('Starting session cleanup...');

      // 1. Clean expired tokens
      if (this.config.cleanExpiredTokens) {
        stats.expiredTokensRemoved = await this.cleanExpiredTokens();
      }

      // 2. Clean inactive sessions
      if (this.config.cleanInactiveSessions) {
        stats.inactiveSessionsRemoved = await this.cleanInactiveSessions();
      }

      // 3. Enforce session limits per user
      if (this.config.enforceSessionLimits) {
        stats.excessSessionsRemoved = await this.enforceSessionLimits();
      }

      stats.totalSessionsRemoved = 
        stats.expiredTokensRemoved + 
        stats.inactiveSessionsRemoved + 
        stats.excessSessionsRemoved;

      this.lastCleanupStats = stats;
      
      const duration = Date.now() - startTime;
      this.log(
        `Cleanup completed in ${duration}ms - ` +
        `Removed: ${stats.totalSessionsRemoved} total ` +
        `(${stats.expiredTokensRemoved} expired, ` +
        `${stats.inactiveSessionsRemoved} inactive, ` +
        `${stats.excessSessionsRemoved} excess)`
      );

      return stats;
    } catch (error) {
      console.error('[SessionCleanup] Cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Clean up expired refresh tokens
   */
  private async cleanExpiredTokens(): Promise<number> {
    try {
      const result = await db
        .delete(refreshTokens)
        .where(lt(refreshTokens.expiresAt, new Date()));

      return result.rowCount || 0;
    } catch (error) {
      console.error('[SessionCleanup] Failed to clean expired tokens:', error);
      return 0;
    }
  }

  /**
   * Clean up sessions that haven't been used recently
   */
  private async cleanInactiveSessions(): Promise<number> {
    try {
      const inactivityCutoff = new Date(
        Date.now() - (this.config.inactivityTimeoutDays * 24 * 60 * 60 * 1000)
      );

      const result = await db
        .delete(refreshTokens)
        .where(
          and(
            lt(refreshTokens.lastUsed, inactivityCutoff),
            eq(refreshTokens.isActive, true)
          )
        );

      return result.rowCount || 0;
    } catch (error) {
      console.error('[SessionCleanup] Failed to clean inactive sessions:', error);
      return 0;
    }
  }

  /**
   * Enforce maximum session limits per user
   */
  private async enforceSessionLimits(): Promise<number> {
    try {
      // Get users who have more than the maximum allowed sessions
      const usersWithExcessSessions = await db
        .select({
          userId: refreshTokens.userId,
          tenantId: refreshTokens.tenantId,
          sessionCount: count(refreshTokens.id),
        })
        .from(refreshTokens)
        .where(
          and(
            eq(refreshTokens.isActive, true),
            lt(refreshTokens.expiresAt, new Date()) // Only count non-expired sessions
          )
        )
        .groupBy(refreshTokens.userId, refreshTokens.tenantId)
        .having(({ sessionCount }) => gt(sessionCount, this.config.maxSessionsPerUser));

      let totalRemoved = 0;

      for (const user of usersWithExcessSessions) {
        const excessCount = user.sessionCount - this.config.maxSessionsPerUser;
        
        // Get the oldest sessions for this user (keep the most recent ones)
        const oldestSessions = await db
          .select({ id: refreshTokens.id })
          .from(refreshTokens)
          .where(
            and(
              eq(refreshTokens.userId, user.userId),
              eq(refreshTokens.tenantId, user.tenantId),
              eq(refreshTokens.isActive, true),
              lt(refreshTokens.expiresAt, new Date())
            )
          )
          .orderBy(refreshTokens.lastUsed) // Oldest first
          .limit(excessCount);

        if (oldestSessions.length > 0) {
          const sessionIds = oldestSessions.map(s => s.id);
          
          const result = await db
            .delete(refreshTokens)
            .where(inArray(refreshTokens.id, sessionIds));

          totalRemoved += result.rowCount || 0;
        }
      }

      return totalRemoved;
    } catch (error) {
      console.error('[SessionCleanup] Failed to enforce session limits:', error);
      return 0;
    }
  }

  /**
   * Get detailed session statistics
   */
  async getSessionStats(): Promise<{
    totalActiveSessions: number;
    expiredSessions: number;
    inactiveSessions: number;
    sessionsByTenant: { tenantId: string; count: number }[];
    oldestSession: Date | null;
    newestSession: Date | null;
  }> {
    const now = new Date();
    const inactivityCutoff = new Date(
      Date.now() - (this.config.inactivityTimeoutDays * 24 * 60 * 60 * 1000)
    );

    // Total active sessions
    const [totalActiveResult] = await db
      .select({ count: count(refreshTokens.id) })
      .from(refreshTokens)
      .where(eq(refreshTokens.isActive, true));

    // Expired sessions
    const [expiredResult] = await db
      .select({ count: count(refreshTokens.id) })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.isActive, true),
          lt(refreshTokens.expiresAt, now)
        )
      );

    // Inactive sessions
    const [inactiveResult] = await db
      .select({ count: count(refreshTokens.id) })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.isActive, true),
          lt(refreshTokens.lastUsed, inactivityCutoff)
        )
      );

    // Sessions by tenant
    const sessionsByTenant = await db
      .select({
        tenantId: refreshTokens.tenantId,
        count: count(refreshTokens.id),
      })
      .from(refreshTokens)
      .where(eq(refreshTokens.isActive, true))
      .groupBy(refreshTokens.tenantId);

    // Oldest and newest sessions
    const [oldestSession] = await db
      .select({ createdAt: refreshTokens.createdAt })
      .from(refreshTokens)
      .where(eq(refreshTokens.isActive, true))
      .orderBy(refreshTokens.createdAt)
      .limit(1);

    const [newestSession] = await db
      .select({ createdAt: refreshTokens.createdAt })
      .from(refreshTokens)
      .where(eq(refreshTokens.isActive, true))
      .orderBy(desc(refreshTokens.createdAt))
      .limit(1);

    return {
      totalActiveSessions: totalActiveResult.count,
      expiredSessions: expiredResult.count,
      inactiveSessions: inactiveResult.count,
      sessionsByTenant,
      oldestSession: oldestSession?.createdAt || null,
      newestSession: newestSession?.createdAt || null,
    };
  }

  /**
   * Update the cleanup configuration
   */
  updateConfig(newConfig: Partial<SessionCleanupConfig>): void {
    const oldInterval = this.config.cleanupIntervalMinutes;
    this.config = { ...this.config, ...newConfig };
    
    // If interval changed and service is running, restart it
    if (this.isRunning && oldInterval !== this.config.cleanupIntervalMinutes) {
      this.log('Cleanup interval changed, restarting service...');
      this.stop();
      this.start();
    }
  }

  /**
   * Log messages if logging is enabled
   */
  private log(message: string): void {
    if (this.config.enableCleanupLogs) {
      console.log(`[SessionCleanup] ${message}`);
    }
  }
}
