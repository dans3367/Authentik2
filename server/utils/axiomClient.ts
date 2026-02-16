/**
 * Axiom Client Singleton
 * 
 * Provides a shared Axiom client instance for sending activity logs
 * and querying data from Axiom datasets.
 * 
 * Required environment variables:
 *   AXIOM_TOKEN - API token with ingest and query permissions
 *   AXIOM_ORG_ID - (optional) Organization ID for Axiom
 */

import { Axiom } from '@axiomhq/js';

const AXIOM_DATASET = 'activity-logs';

let axiomClient: Axiom | null = null;

export function getAxiomClient(): Axiom | null {
    if (axiomClient) return axiomClient;

    const token = process.env.AXIOM_TOKEN;
    if (!token) {
        console.warn('[Axiom] AXIOM_TOKEN not set — Axiom activity logging is disabled');
        return null;
    }

    axiomClient = new Axiom({
        token,
        orgId: process.env.AXIOM_ORG_ID || undefined,
    });

    console.log('[Axiom] Client initialized');
    return axiomClient;
}

export { AXIOM_DATASET };
