/**
 * ClickHouse Activity Logs API Routes
 *
 * Replaces the Axiom-backed axiomActivityRoutes.ts.
 * Provides the same filtering, pagination, and response shape so the
 * frontend works without changes.
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth-middleware';
import { getClickHouseClient, CLICKHOUSE_TABLE } from '../utils/clickhouseClient';
import { isAdmin } from '../utils/routeHelpers';
import { db } from '../db';
import { betterAuthUser } from '@shared/schema';
import { inArray } from 'drizzle-orm';

export const clickhouseActivityRoutes = Router();

/**
 * Validates and clamps pagination parameters.
 */
function validatePaginationParams(limit?: string | string[], offset?: string | string[], maxLimit: number = 100) {
    const parsedLimit = parseInt(Array.isArray(limit) ? limit[0] : (limit || '20'), 10);
    const parsedOffset = parseInt(Array.isArray(offset) ? offset[0] : (offset || '0'), 10);

    if (!Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > maxLimit) {
        throw new Error(`Invalid limit: must be a positive integer <= ${maxLimit}`);
    }

    if (!Number.isFinite(parsedOffset) || parsedOffset < 0) {
        throw new Error('Invalid offset: must be a non-negative integer');
    }

    return { limit: parsedLimit, offset: parsedOffset };
}

/**
 * Looks up user details from the DB for a set of user IDs.
 */
async function fetchUserMap(userIds: string[]): Promise<Map<string, { firstName: string | null; lastName: string | null; email: string; avatarUrl: string | null }>> {
    const map = new Map();
    if (userIds.length === 0) return map;
    try {
        const users = await db
            .select({
                id: betterAuthUser.id,
                firstName: betterAuthUser.firstName,
                lastName: betterAuthUser.lastName,
                email: betterAuthUser.email,
                avatarUrl: betterAuthUser.avatarUrl,
            })
            .from(betterAuthUser)
            .where(inArray(betterAuthUser.id, userIds));
        for (const u of users) {
            map.set(u.id, u);
        }
    } catch (err) {
        console.error('[ClickHouseActivityRoutes] User lookup failed:', err);
    }
    return map;
}

/**
 * Transforms ClickHouse rows into the standard activity log response shape.
 */
function transformRows(rows: any[], req: any, userMap: Map<string, any>) {
    return rows.map((row: any) => {
        const dbUser = row.user_id ? userMap.get(row.user_id) : null;

        const log: any = {
            id: row.id,
            tenantId: row.tenant_id,
            userId: row.user_id,
            entityType: row.entity_type,
            entityId: row.entity_id,
            entityName: row.entity_name,
            activityType: row.activity_type,
            description: row.description,
            changes: row.changes ? safeJsonParse(row.changes) : null,
            metadata: row.metadata ? safeJsonParse(row.metadata) : null,
            createdAt: row.created_at,
            user: dbUser ? {
                id: row.user_id,
                firstName: dbUser.firstName,
                lastName: dbUser.lastName,
                email: dbUser.email,
                avatarUrl: dbUser.avatarUrl,
            } : row.user_id ? {
                id: row.user_id,
                firstName: null,
                lastName: null,
                email: null,
                avatarUrl: null,
            } : {
                id: null,
                firstName: 'System',
                lastName: '',
                email: null,
                avatarUrl: null,
            },
        };

        if (isAdmin(req)) {
            log.ipAddress = row.ip_address;
            log.userAgent = row.user_agent;
        }

        return log;
    });
}

function safeJsonParse(value: string): any {
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

/**
 * Builds a paginated response with user enrichment.
 */
async function buildPaginationResponse(rows: any[], pagination: { limit: number; offset: number }, total: number, req: any) {
    const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))] as string[];
    const userMap = await fetchUserMap(userIds);

    return {
        logs: transformRows(rows, req, userMap),
        pagination: {
            limit: pagination.limit,
            offset: pagination.offset,
            total,
            hasMore: pagination.offset + rows.length < total,
        },
        source: 'clickhouse',
    };
}

/**
 * Escapes a string for use in ClickHouse SQL to prevent injection.
 */
function escapeClickHouse(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Converts an ISO 8601 timestamp to ClickHouse DateTime64 format.
 * ClickHouse expects 'YYYY-MM-DD HH:MM:SS.sss', not 'YYYY-MM-DDTHH:MM:SS.sssZ'.
 */
function toClickHouseTimestamp(iso: string): string {
    return new Date(iso).toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * Queries activity logs from ClickHouse with filtering, time range, and pagination.
 */
async function queryClickHouseLogs(opts: {
    tenantId: string;
    entityType?: string;
    entityId?: string;
    activityType?: string;
    limit: number;
    offset: number;
    startTime?: string;
    endTime?: string;
}): Promise<{ rows: any[]; total: number }> {
    const client = getClickHouseClient();
    if (!client) {
        return { rows: [], total: 0 };
    }

    // Build WHERE clause with parameterized values
    const conditions: string[] = [`tenant_id = '${escapeClickHouse(opts.tenantId)}'`];

    if (opts.entityType) {
        conditions.push(`entity_type = '${escapeClickHouse(opts.entityType)}'`);
    }
    if (opts.entityId) {
        conditions.push(`entity_id = '${escapeClickHouse(opts.entityId)}'`);
    }
    if (opts.activityType) {
        conditions.push(`activity_type = '${escapeClickHouse(opts.activityType)}'`);
    }

    // Time range defaults — convert to ClickHouse DateTime64 format
    const startTime = opts.startTime || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const endTime = opts.endTime || new Date().toISOString();
    conditions.push(`created_at >= '${toClickHouseTimestamp(startTime)}'`);
    conditions.push(`created_at <= '${toClickHouseTimestamp(endTime)}'`);

    const whereClause = conditions.join(' AND ');

    let total = 0;
    try {
        const countResult = await client.query({
            query: `SELECT count() as total FROM ${CLICKHOUSE_TABLE} WHERE ${whereClause}`,
            format: 'JSONEachRow',
        });
        const countRows = await countResult.json<{ total: string }>();
        if (countRows.length > 0) {
            total = Number(countRows[0].total) || 0;
        }
    } catch (err) {
        console.error('[ClickHouseActivityRoutes] Count query failed:', err);
    }

    let rows: any[] = [];
    try {
        const dataResult = await client.query({
            query: `SELECT * FROM ${CLICKHOUSE_TABLE} WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${opts.limit} OFFSET ${opts.offset}`,
            format: 'JSONEachRow',
        });
        rows = await dataResult.json();
    } catch (err) {
        console.error('[ClickHouseActivityRoutes] Data query failed:', err);
    }

    return { rows, total: total || rows.length };
}

/**
 * GET /api/axiom-activity-logs
 * Fetch activity logs from ClickHouse with optional filtering.
 */
clickhouseActivityRoutes.get("/", authenticateToken, async (req: any, res) => {
    try {
        const client = getClickHouseClient();
        if (!client) {
            return res.status(503).json({ message: 'ClickHouse is not configured. Set CLICKHOUSE_URL to enable.' });
        }

        const { entityType, entityId, activityType, limit, offset, startTime, endTime } = req.query;

        let paginationParams;
        try {
            paginationParams = validatePaginationParams(limit, offset);
        } catch (validationError: unknown) {
            return res.status(400).json({ message: validationError instanceof Error ? validationError.message : 'Invalid pagination parameters' });
        }

        const { rows, total } = await queryClickHouseLogs({
            tenantId: req.user.tenantId,
            entityType: entityType as string | undefined,
            entityId: entityId as string | undefined,
            activityType: activityType as string | undefined,
            limit: paginationParams.limit,
            offset: paginationParams.offset,
            startTime: startTime as string | undefined,
            endTime: endTime as string | undefined,
        });

        res.json(await buildPaginationResponse(rows, paginationParams, total, req));
    } catch (error) {
        console.error('[ClickHouseActivityRoutes] GET / error:', error);
        res.status(500).json({ message: 'Failed to get activity logs from ClickHouse' });
    }
});

/**
 * GET /api/axiom-activity-logs/entity/:entityType/:entityId
 * Shorthand endpoint for fetching activities for a specific entity.
 */
clickhouseActivityRoutes.get("/entity/:entityType/:entityId", authenticateToken, async (req: any, res) => {
    try {
        const client = getClickHouseClient();
        if (!client) {
            return res.status(503).json({ message: 'ClickHouse is not configured. Set CLICKHOUSE_URL to enable.' });
        }

        const { entityType, entityId } = req.params;
        const { limit, offset, startTime, endTime } = req.query;

        let paginationParams;
        try {
            paginationParams = validatePaginationParams(limit, offset);
        } catch (validationError: unknown) {
            return res.status(400).json({ message: validationError instanceof Error ? validationError.message : 'Invalid pagination parameters' });
        }

        const { rows, total } = await queryClickHouseLogs({
            tenantId: req.user.tenantId,
            entityType,
            entityId,
            limit: paginationParams.limit,
            offset: paginationParams.offset,
            startTime: startTime as string | undefined,
            endTime: endTime as string | undefined,
        });

        res.json(await buildPaginationResponse(rows, paginationParams, total, req));
    } catch (error) {
        console.error('[ClickHouseActivityRoutes] GET /entity error:', error);
        res.status(500).json({ message: 'Failed to get activity logs from ClickHouse' });
    }
});

/**
 * GET /api/axiom-activity-logs/stats
 * Aggregated activity stats from ClickHouse.
 */
clickhouseActivityRoutes.get("/stats", authenticateToken, async (req: any, res) => {
    try {
        const client = getClickHouseClient();
        if (!client) {
            return res.status(503).json({ message: 'ClickHouse is not configured. Set CLICKHOUSE_URL to enable.' });
        }

        const tenantId = req.user.tenantId;
        const { startTime, endTime } = req.query;
        const start = (startTime as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const end = (endTime as string) || new Date().toISOString();

        const escapedTenantId = escapeClickHouse(tenantId);
        const timeFilter = `tenant_id = '${escapedTenantId}' AND created_at >= '${toClickHouseTimestamp(start)}' AND created_at <= '${toClickHouseTimestamp(end)}'`;

        const [byEntityResult, byActivityResult, timelineResult] = await Promise.all([
            client.query({
                query: `SELECT entity_type AS entityType, count() AS count FROM ${CLICKHOUSE_TABLE} WHERE ${timeFilter} GROUP BY entity_type ORDER BY count DESC`,
                format: 'JSONEachRow',
            }).catch(() => null),
            client.query({
                query: `SELECT activity_type AS activityType, count() AS count FROM ${CLICKHOUSE_TABLE} WHERE ${timeFilter} GROUP BY activity_type ORDER BY count DESC`,
                format: 'JSONEachRow',
            }).catch(() => null),
            client.query({
                query: `SELECT toStartOfHour(created_at) AS startTime, toStartOfHour(created_at) + INTERVAL 1 HOUR AS endTime, count() AS count FROM ${CLICKHOUSE_TABLE} WHERE ${timeFilter} GROUP BY toStartOfHour(created_at) ORDER BY startTime`,
                format: 'JSONEachRow',
            }).catch(() => null),
        ]);

        const toJson = async (result: any) => {
            if (!result) return [];
            try {
                const rows = await result.json();
                return rows.map((r: any) => ({ ...r, count: Number(r.count) || 0 }));
            } catch {
                return [];
            }
        };

        res.json({
            byEntityType: await toJson(byEntityResult),
            byActivityType: await toJson(byActivityResult),
            timeline: await toJson(timelineResult),
            source: 'clickhouse',
        });
    } catch (error) {
        console.error('[ClickHouseActivityRoutes] GET /stats error:', error);
        res.status(500).json({ message: 'Failed to get activity stats from ClickHouse' });
    }
});

/**
 * GET /api/axiom-activity-logs/search
 * Full-text search across activity logs in ClickHouse.
 */
clickhouseActivityRoutes.get("/search", authenticateToken, async (req: any, res) => {
    try {
        const client = getClickHouseClient();
        if (!client) {
            return res.status(503).json({ message: 'ClickHouse is not configured. Set CLICKHOUSE_URL to enable.' });
        }

        const { q, limit, offset, startTime, endTime, entityType, activityType } = req.query;
        if (!q) {
            return res.status(400).json({ message: 'Search query parameter "q" is required' });
        }

        let paginationParams;
        try {
            paginationParams = validatePaginationParams(limit, offset);
        } catch (validationError: unknown) {
            return res.status(400).json({ message: validationError instanceof Error ? validationError.message : 'Invalid pagination parameters' });
        }

        const tenantId = req.user.tenantId;
        const searchTerm = escapeClickHouse(q as string);
        const start = (startTime as string) || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const end = (endTime as string) || new Date().toISOString();

        const escapedTenantId = escapeClickHouse(tenantId);

        const searchCondition = `(
            description ILIKE '%${searchTerm}%'
            OR entity_name ILIKE '%${searchTerm}%'
            OR entity_type ILIKE '%${searchTerm}%'
            OR activity_type ILIKE '%${searchTerm}%'
            OR changes ILIKE '%${searchTerm}%'
            OR metadata ILIKE '%${searchTerm}%'
        )`;

        const conditions = [
            `tenant_id = '${escapedTenantId}'`,
            `created_at >= '${toClickHouseTimestamp(start)}'`,
            `created_at <= '${toClickHouseTimestamp(end)}'`,
            searchCondition,
        ];

        if (entityType) {
            conditions.push(`entity_type = '${escapeClickHouse(entityType as string)}'`);
        }
        if (activityType) {
            conditions.push(`activity_type = '${escapeClickHouse(activityType as string)}'`);
        }

        const whereClause = conditions.join(' AND ');

        // Count
        let total = 0;
        try {
            const countResult = await client.query({
                query: `SELECT count() AS total FROM ${CLICKHOUSE_TABLE} WHERE ${whereClause}`,
                format: 'JSONEachRow',
            });
            const countRows = await countResult.json<{ total: string }>();
            if (countRows.length > 0) {
                total = Number(countRows[0].total) || 0;
            }
        } catch (err) {
            console.error('[ClickHouseActivityRoutes] Search count query failed:', err);
        }

        // Data
        let rows: any[] = [];
        try {
            const dataResult = await client.query({
                query: `SELECT * FROM ${CLICKHOUSE_TABLE} WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${paginationParams.limit} OFFSET ${paginationParams.offset}`,
                format: 'JSONEachRow',
            });
            rows = await dataResult.json();
        } catch (err) {
            console.error('[ClickHouseActivityRoutes] Search data query failed:', err);
        }

        res.json(await buildPaginationResponse(rows, paginationParams, total, req));
    } catch (error) {
        console.error('[ClickHouseActivityRoutes] GET /search error:', error);
        res.status(500).json({ message: 'Failed to search activity logs in ClickHouse' });
    }
});
