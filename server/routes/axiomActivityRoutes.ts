/**
 * Axiom Activity Logs API Routes
 * 
 * Mirrors the database-backed activityRoutes.ts but queries from Axiom.
 * Provides the same filtering, pagination, and response shape so the
 * frontend can switch between DB and Axiom seamlessly.
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth-middleware';
import { getAxiomClient, AXIOM_DATASET } from '../utils/axiomClient';
import { isAdmin } from '../utils/routeHelpers';
import { db } from '../db';
import { betterAuthUser } from '@shared/schema';
import { inArray } from 'drizzle-orm';

export const axiomActivityRoutes = Router();

/**
 * Validates and clamps pagination parameters (mirrors DB route helper)
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
 * Returns a map of userId -> { firstName, lastName, email, avatarUrl }.
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
        console.error('[AxiomActivityRoutes] User lookup failed:', err);
    }
    return map;
}

/**
 * Transforms raw Axiom rows into the same shape as the DB activity routes.
 * Axiom stores changes/metadata as objects already (not JSON strings).
 */
function transformAxiomLogs(rows: any[], req: any, userMap: Map<string, any>) {
    return rows.map((row: any) => {
        const dbUser = row.userId ? userMap.get(row.userId) : null;
        const log: any = {
            id: row._rowId || row._time, // Axiom doesn't have a UUID; use rowId or timestamp
            tenantId: row.tenantId,
            userId: row.userId,
            entityType: row.entityType,
            entityId: row.entityId,
            entityName: row.entityName,
            activityType: row.activityType,
            description: row.description,
            changes: row.changes || null,
            metadata: row.metadata || null,
            createdAt: row._time,
            user: dbUser ? {
                id: row.userId,
                firstName: dbUser.firstName,
                lastName: dbUser.lastName,
                email: dbUser.email,
                avatarUrl: dbUser.avatarUrl,
            } : row.userId ? {
                id: row.userId,
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

        // PII fields only for admin
        if (isAdmin(req)) {
            log.ipAddress = row.ipAddress;
            log.userAgent = row.userAgent;
        }

        return log;
    });
}

async function buildPaginationResponse(rows: any[], pagination: { limit: number; offset: number }, total: number, req: any) {
    // Collect unique userIds and fetch user details from DB
    const userIds = [...new Set(rows.map((r: any) => r.userId).filter(Boolean))] as string[];
    const userMap = await fetchUserMap(userIds);

    return {
        logs: transformAxiomLogs(rows, req, userMap),
        pagination: {
            limit: pagination.limit,
            offset: pagination.offset,
            total,
            hasMore: pagination.offset + rows.length < total,
        },
        source: 'axiom',
    };
}

/**
 * Runs an APL query against the activity-logs dataset.
 * Returns { rows, total }.
 */
async function queryAxiomLogs(opts: {
    tenantId: string;
    entityType?: string;
    entityId?: string;
    activityType?: string;
    limit: number;
    offset: number;
    startTime?: string;
    endTime?: string;
}): Promise<{ rows: any[]; total: number }> {
    const client = getAxiomClient();
    if (!client) {
        return { rows: [], total: 0 };
    }

    // Build APL filter clauses
    const filters: string[] = [`['tenantId'] == "${opts.tenantId}"`];

    if (opts.entityType) {
        filters.push(`['entityType'] == "${opts.entityType}"`);
    }
    if (opts.entityId) {
        filters.push(`['entityId'] == "${opts.entityId}"`);
    }
    if (opts.activityType) {
        filters.push(`['activityType'] == "${opts.activityType}"`);
    }

    const whereClause = filters.join(' and ');

    const startTime = opts.startTime || 'now-90d';
    const endTime = opts.endTime || 'now';
    const queryOpts = {
        startTime: new Date(startTime === 'now-90d' ? Date.now() - 90 * 24 * 60 * 60 * 1000 : startTime).toISOString(),
        endTime: new Date(endTime === 'now' ? Date.now() : endTime).toISOString(),
    };

    // Count query
    const countApl = `['${AXIOM_DATASET}'] | where ${whereClause} | summarize total=count()`;

    let total = 0;
    try {
        const countResult = await client.query(countApl, queryOpts);
        // Aggregation results come in status.rowsMatched or buckets.totals
        if (countResult.buckets?.totals && countResult.buckets.totals.length > 0) {
            const agg = countResult.buckets.totals[0].aggregations;
            if (agg && agg.length > 0) {
                total = Number(agg[0].value) || 0;
            }
        }
        // Fallback: use rowsMatched from status
        if (total === 0) {
            total = countResult.status?.rowsMatched || 0;
        }
    } catch (err) {
        console.error('[AxiomActivityRoutes] Count query failed:', err);
    }

    // Data query — fetch enough rows to cover offset+limit, then slice in JS.
    // Avoids reliance on APL `offset` operator which may not be supported in all Axiom plans.
    const fetchLimit = opts.offset + opts.limit;
    const dataApl = `['${AXIOM_DATASET}'] | where ${whereClause} | sort by _time desc | take ${fetchLimit}`;

    let rows: any[] = [];
    try {
        const dataResult = await client.query(dataApl, queryOpts);

        // query() in legacy format returns matches as Entry[] with { _rowId, _time, data }
        if (dataResult.matches && dataResult.matches.length > 0) {
            const allRows = dataResult.matches.map((m: any) => ({ _rowId: m._rowId, _time: m._time, ...m.data }));
            // Apply offset in JS
            rows = allRows.slice(opts.offset);
        }
    } catch (err) {
        console.error('[AxiomActivityRoutes] Data query failed:', err);
    }

    return { rows, total: total || rows.length };
}

/**
 * GET /api/axiom-activity-logs
 * Fetch activity logs from Axiom with optional filtering by entity type, entity ID, activity type.
 * Supports pagination via limit and offset query params.
 */
axiomActivityRoutes.get("/", authenticateToken, async (req: any, res) => {
    try {
        const client = getAxiomClient();
        if (!client) {
            return res.status(503).json({ message: 'Axiom is not configured. Set AXIOM_TOKEN to enable.' });
        }

        const { entityType, entityId, activityType, limit, offset, startTime, endTime } = req.query;

        let paginationParams;
        try {
            paginationParams = validatePaginationParams(limit, offset);
        } catch (validationError: unknown) {
            return res.status(400).json({ message: validationError instanceof Error ? validationError.message : 'Invalid pagination parameters' });
        }

        const { rows, total } = await queryAxiomLogs({
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
        console.error('[AxiomActivityRoutes] GET / error:', error);
        res.status(500).json({ message: 'Failed to get activity logs from Axiom' });
    }
});

/**
 * GET /api/axiom-activity-logs/entity/:entityType/:entityId
 * Shorthand endpoint for fetching activities for a specific entity from Axiom.
 */
axiomActivityRoutes.get("/entity/:entityType/:entityId", authenticateToken, async (req: any, res) => {
    try {
        const client = getAxiomClient();
        if (!client) {
            return res.status(503).json({ message: 'Axiom is not configured. Set AXIOM_TOKEN to enable.' });
        }

        const { entityType, entityId } = req.params;
        const { limit, offset, startTime, endTime } = req.query;

        let paginationParams;
        try {
            paginationParams = validatePaginationParams(limit, offset);
        } catch (validationError: unknown) {
            return res.status(400).json({ message: validationError instanceof Error ? validationError.message : 'Invalid pagination parameters' });
        }

        const { rows, total } = await queryAxiomLogs({
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
        console.error('[AxiomActivityRoutes] GET /entity error:', error);
        res.status(500).json({ message: 'Failed to get activity logs from Axiom' });
    }
});

/**
 * GET /api/axiom-activity-logs/stats
 * Aggregated activity stats from Axiom — counts by entityType and activityType.
 * Bonus endpoint that leverages Axiom's aggregation strength.
 */
axiomActivityRoutes.get("/stats", authenticateToken, async (req: any, res) => {
    try {
        const client = getAxiomClient();
        if (!client) {
            return res.status(503).json({ message: 'Axiom is not configured. Set AXIOM_TOKEN to enable.' });
        }

        const tenantId = req.user.tenantId;
        const { startTime, endTime } = req.query;
        const start = startTime as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const end = endTime as string || new Date().toISOString();

        // Count by entity type
        const byEntityApl = `['${AXIOM_DATASET}'] | where ['tenantId'] == "${tenantId}" | summarize count=count() by ['entityType']`;
        // Count by activity type
        const byActivityApl = `['${AXIOM_DATASET}'] | where ['tenantId'] == "${tenantId}" | summarize count=count() by ['activityType']`;
        // Timeline (hourly buckets)
        const timelineApl = `['${AXIOM_DATASET}'] | where ['tenantId'] == "${tenantId}" | summarize count=count() by bin(_time, 1h)`;

        const queryOpts = {
            startTime: new Date(start).toISOString(),
            endTime: new Date(end).toISOString(),
        };

        const [byEntityResult, byActivityResult, timelineResult] = await Promise.all([
            client.query(byEntityApl, queryOpts).catch(() => null),
            client.query(byActivityApl, queryOpts).catch(() => null),
            client.query(timelineApl, queryOpts).catch(() => null),
        ]);

        // For aggregation queries, results are in buckets.totals[].aggregations
        // or buckets.series[].groups[].aggregations
        const extractAggregations = (result: any) => {
            if (!result) return [];
            // Grouped aggregations come in buckets.totals
            if (result.buckets?.totals) {
                return result.buckets.totals.map((t: any) => ({
                    ...t.group,
                    count: t.aggregations?.[0]?.value || 0,
                }));
            }
            // Timeline data comes in buckets.series
            if (result.buckets?.series) {
                return result.buckets.series.map((interval: any) => ({
                    startTime: interval.startTime,
                    endTime: interval.endTime,
                    count: interval.groups?.[0]?.aggregations?.[0]?.value || 0,
                }));
            }
            return [];
        };

        res.json({
            byEntityType: extractAggregations(byEntityResult),
            byActivityType: extractAggregations(byActivityResult),
            timeline: extractAggregations(timelineResult),
            source: 'axiom',
        });
    } catch (error) {
        console.error('[AxiomActivityRoutes] GET /stats error:', error);
        res.status(500).json({ message: 'Failed to get activity stats from Axiom' });
    }
});

/**
 * GET /api/axiom-activity-logs/search
 * Full-text search across activity logs in Axiom.
 * Bonus endpoint that leverages Axiom's search capability.
 */
axiomActivityRoutes.get("/search", authenticateToken, async (req: any, res) => {
    try {
        const client = getAxiomClient();
        if (!client) {
            return res.status(503).json({ message: 'Axiom is not configured. Set AXIOM_TOKEN to enable.' });
        }

        const { q, limit, offset, startTime, endTime } = req.query;
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
        const searchTerm = (q as string).replace(/"/g, '\\"');
        const start = startTime as string || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const end = endTime as string || new Date().toISOString();

        const searchApl = `['${AXIOM_DATASET}'] | where ['tenantId'] == "${tenantId}" | search "${searchTerm}" | sort by _time desc | offset ${paginationParams.offset} | limit ${paginationParams.limit}`;

        const queryOpts = {
            startTime: new Date(start).toISOString(),
            endTime: new Date(end).toISOString(),
        };

        const result = await client.query(searchApl, queryOpts);

        let rows: any[] = [];
        if (result.matches) {
            rows = result.matches.map((m) => ({ _rowId: m._rowId, _time: m._time, ...m.data }));
        }

        res.json(await buildPaginationResponse(rows, paginationParams, rows.length, req));
    } catch (error) {
        console.error('[AxiomActivityRoutes] GET /search error:', error);
        res.status(500).json({ message: 'Failed to search activity logs in Axiom' });
    }
});
