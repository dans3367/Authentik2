/**
 * ClickHouse Activity Logger
 *
 * Mirrors the database activity logger but sends events to ClickHouse.
 * Called alongside the existing logActivity() so both stores receive data.
 * ClickHouse provides fast full-text search, aggregations, and long-term retention.
 */

import { getClickHouseClient, CLICKHOUSE_TABLE } from './clickhouseClient';
import type { LogActivityParams } from './activityLogger';

/**
 * Sends an activity log event to ClickHouse.
 * Non-blocking — failures are logged but never throw.
 */
export async function logActivityToClickHouse(params: LogActivityParams): Promise<void> {
    try {
        const client = getClickHouseClient();
        if (!client) return; // ClickHouse not configured

        const ipAddress = params.req?.ip || params.req?.headers['x-forwarded-for']?.toString() || null;
        const userAgent = params.req?.headers['user-agent'] || null;

        await client.insert({
            table: CLICKHOUSE_TABLE,
            values: [{
                tenant_id: params.tenantId,
                user_id: params.userId || null,
                entity_type: params.entityType,
                entity_id: params.entityId || null,
                entity_name: params.entityName || null,
                activity_type: params.activityType,
                description: params.description || null,
                changes: params.changes ? JSON.stringify(params.changes) : null,
                metadata: params.metadata ? JSON.stringify(params.metadata) : null,
                ip_address: ipAddress,
                user_agent: userAgent,
            }],
            format: 'JSONEachRow',
        });
    } catch (error) {
        // Never break main flows — just log the error
        console.error('[ClickHouseActivityLogger] Failed to send event to ClickHouse:', error);
    }
}
