/**
 * ClickHouse Client Singleton
 *
 * Provides a shared ClickHouse client instance for sending activity logs
 * and querying data from the houseclickDB.
 *
 * Required environment variables:
 *   CLICKHOUSE_URL      - HTTP endpoint (e.g. https://your-instance.clickhouse.cloud:8443)
 *   CLICKHOUSE_DATABASE - Database name (default: "default")
 *   CLICKHOUSE_USER     - Username (default: "default")
 *   CLICKHOUSE_PASSWORD - Password
 */

import { createClient, type ClickHouseClient } from '@clickhouse/client';

const CLICKHOUSE_TABLE = 'activity_logs';

let clickhouseClient: ClickHouseClient | null = null;

export function getClickHouseClient(): ClickHouseClient | null {
    if (clickhouseClient) return clickhouseClient;

    const url = process.env.CLICKHOUSE_URL;
    if (!url) {
        console.warn('[ClickHouse] CLICKHOUSE_URL not set — ClickHouse activity logging is disabled');
        return null;
    }

    clickhouseClient = createClient({
        url,
        database: process.env.CLICKHOUSE_DATABASE || 'default',
        username: process.env.CLICKHOUSE_USER || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || '',
    });

    console.log('[ClickHouse] Client initialized');
    return clickhouseClient;
}

export { CLICKHOUSE_TABLE };
