/**
 * Convex Client Utility (Server-side)
 * 
 * Provides a ConvexHttpClient for calling Convex mutations/queries
 * from the Express backend (webhook handlers, API routes, etc.).
 * 
 * Required environment variable:
 *   CONVEX_URL - Your Convex deployment URL (e.g. https://xxx.convex.cloud)
 */

import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "../../convex/_generated/api";

let convexClient: ConvexHttpClient | null = null;

export function getConvexClient(): ConvexHttpClient | null {
    if (convexClient) return convexClient;

    const url = process.env.CONVEX_URL;
    if (!url) {
        console.warn('[Convex] CONVEX_URL not set — Convex newsletter tracking is disabled');
        return null;
    }

    convexClient = new ConvexHttpClient(url);
    console.log('[Convex] HTTP client initialized');
    return convexClient;
}

export { api, internal };
