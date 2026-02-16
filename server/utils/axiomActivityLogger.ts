/**
 * Axiom Activity Logger
 * 
 * Mirrors the database activity logger but sends events to Axiom.
 * Called alongside the existing logActivity() so both stores receive data.
 * Axiom provides fast full-text search, aggregations, and long-term retention.
 */

import { getAxiomClient, AXIOM_DATASET } from './axiomClient';
import type { LogActivityParams } from './activityLogger';

/**
 * Sends an activity log event to Axiom.
 * Non-blocking — failures are logged but never throw.
 */
export async function logActivityToAxiom(params: LogActivityParams): Promise<void> {
    try {
        const client = getAxiomClient();
        if (!client) return; // Axiom not configured

        const ipAddress = params.req?.ip || params.req?.headers['x-forwarded-for']?.toString() || null;
        const userAgent = params.req?.headers['user-agent'] || null;

        const event = {
            _time: new Date().toISOString(),
            tenantId: params.tenantId,
            userId: params.userId || null,
            entityType: params.entityType,
            entityId: params.entityId || null,
            entityName: params.entityName || null,
            activityType: params.activityType,
            description: params.description || null,
            changes: params.changes || null,
            metadata: params.metadata || null,
            ipAddress,
            userAgent,
        };

        client.ingest(AXIOM_DATASET, [event]);
        await client.flush();
    } catch (error) {
        // Never break main flows — just log the error
        console.error('[AxiomActivityLogger] Failed to send event to Axiom:', error);
    }
}
