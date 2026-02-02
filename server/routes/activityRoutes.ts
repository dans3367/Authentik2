/**
 * Activity Logs API Routes
 * 
 * Provides endpoints for fetching activity logs with filtering and pagination.
 */

import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { activityLogs, betterAuthUser } from '@shared/schema';
import { authenticateToken } from '../middleware/auth-middleware';
import { activityLogQuerySchema } from '@shared/schema';

export const activityRoutes = Router();

/**
 * GET /api/activity-logs
 * Fetch activity logs with optional filtering by entity type, entity ID, activity type
 * Supports pagination via limit and offset query params
 */
activityRoutes.get("/", authenticateToken, async (req: any, res) => {
    try {
        const { entityType, entityId, activityType, limit = '20', offset = '0' } = req.query;

        // Build where clause
        let whereClause = sql`${activityLogs.tenantId} = ${req.user.tenantId}`;

        if (entityType) {
            whereClause = sql`${whereClause} AND ${activityLogs.entityType} = ${entityType}`;
        }

        if (entityId) {
            whereClause = sql`${whereClause} AND ${activityLogs.entityId} = ${entityId}`;
        }

        if (activityType) {
            whereClause = sql`${whereClause} AND ${activityLogs.activityType} = ${activityType}`;
        }

        // Fetch logs with user details
        const logs = await db.select({
            id: activityLogs.id,
            tenantId: activityLogs.tenantId,
            userId: activityLogs.userId,
            entityType: activityLogs.entityType,
            entityId: activityLogs.entityId,
            entityName: activityLogs.entityName,
            activityType: activityLogs.activityType,
            description: activityLogs.description,
            changes: activityLogs.changes,
            metadata: activityLogs.metadata,
            ipAddress: activityLogs.ipAddress,
            userAgent: activityLogs.userAgent,
            createdAt: activityLogs.createdAt,
            // User fields
            userFirstName: betterAuthUser.firstName,
            userLastName: betterAuthUser.lastName,
            userEmail: betterAuthUser.email,
            userAvatarUrl: betterAuthUser.avatarUrl,
        })
            .from(activityLogs)
            .leftJoin(betterAuthUser, sql`${activityLogs.userId} = ${betterAuthUser.id}`)
            .where(whereClause)
            .orderBy(sql`${activityLogs.createdAt} DESC`)
            .limit(Number(limit))
            .offset(Number(offset));

        // Get total count for pagination
        const [countResult] = await db.select({
            count: sql<number>`count(*)::int`,
        })
            .from(activityLogs)
            .where(whereClause);

        // Transform to include user object
        const logsWithUser = logs.map((log: any) => ({
            id: log.id,
            tenantId: log.tenantId,
            userId: log.userId,
            entityType: log.entityType,
            entityId: log.entityId,
            entityName: log.entityName,
            activityType: log.activityType,
            description: log.description,
            changes: log.changes ? JSON.parse(log.changes) : null,
            metadata: log.metadata ? JSON.parse(log.metadata) : null,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            createdAt: log.createdAt,
            user: {
                id: log.userId,
                firstName: log.userFirstName,
                lastName: log.userLastName,
                email: log.userEmail,
                avatarUrl: log.userAvatarUrl,
            },
        }));

        res.json({
            logs: logsWithUser,
            pagination: {
                limit: Number(limit),
                offset: Number(offset),
                total: countResult.count,
                hasMore: Number(offset) + logs.length < countResult.count,
            },
        });
    } catch (error) {
        console.error('Get activity logs error:', error);
        res.status(500).json({ message: 'Failed to get activity logs' });
    }
});

/**
 * GET /api/activity-logs/entity/:entityType/:entityId
 * Shorthand endpoint for fetching activities for a specific entity
 */
activityRoutes.get("/entity/:entityType/:entityId", authenticateToken, async (req: any, res) => {
    try {
        const { entityType, entityId } = req.params;
        const { limit = '20', offset = '0' } = req.query;

        const logs = await db.select({
            id: activityLogs.id,
            tenantId: activityLogs.tenantId,
            userId: activityLogs.userId,
            entityType: activityLogs.entityType,
            entityId: activityLogs.entityId,
            entityName: activityLogs.entityName,
            activityType: activityLogs.activityType,
            description: activityLogs.description,
            changes: activityLogs.changes,
            metadata: activityLogs.metadata,
            ipAddress: activityLogs.ipAddress,
            userAgent: activityLogs.userAgent,
            createdAt: activityLogs.createdAt,
            // User fields
            userFirstName: betterAuthUser.firstName,
            userLastName: betterAuthUser.lastName,
            userEmail: betterAuthUser.email,
            userAvatarUrl: betterAuthUser.avatarUrl,
        })
            .from(activityLogs)
            .leftJoin(betterAuthUser, sql`${activityLogs.userId} = ${betterAuthUser.id}`)
            .where(sql`${activityLogs.tenantId} = ${req.user.tenantId} 
                 AND ${activityLogs.entityType} = ${entityType} 
                 AND ${activityLogs.entityId} = ${entityId}`)
            .orderBy(sql`${activityLogs.createdAt} DESC`)
            .limit(Number(limit))
            .offset(Number(offset));

        // Get total count
        const [countResult] = await db.select({
            count: sql<number>`count(*)::int`,
        })
            .from(activityLogs)
            .where(sql`${activityLogs.tenantId} = ${req.user.tenantId} 
                 AND ${activityLogs.entityType} = ${entityType} 
                 AND ${activityLogs.entityId} = ${entityId}`);

        // Transform to include user object
        const logsWithUser = logs.map((log: any) => ({
            id: log.id,
            tenantId: log.tenantId,
            userId: log.userId,
            entityType: log.entityType,
            entityId: log.entityId,
            entityName: log.entityName,
            activityType: log.activityType,
            description: log.description,
            changes: log.changes ? JSON.parse(log.changes) : null,
            metadata: log.metadata ? JSON.parse(log.metadata) : null,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            createdAt: log.createdAt,
            user: {
                id: log.userId,
                firstName: log.userFirstName,
                lastName: log.userLastName,
                email: log.userEmail,
                avatarUrl: log.userAvatarUrl,
            },
        }));

        res.json({
            logs: logsWithUser,
            pagination: {
                limit: Number(limit),
                offset: Number(offset),
                total: countResult.count,
                hasMore: Number(offset) + logs.length < countResult.count,
            },
        });
    } catch (error) {
        console.error('Get entity activity logs error:', error);
        res.status(500).json({ message: 'Failed to get activity logs' });
    }
});
