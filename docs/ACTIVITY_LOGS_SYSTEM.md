# Activity Logs System

## Overview

The activity logging system tracks user actions across the platform (shop CRUD, newsletter operations, contact management, etc.). It uses a **dual-write** pattern: every activity is written to both PostgreSQL (primary store) and a secondary analytics store for advanced querying.

**Migration status**: Migrated from Axiom to ClickHouse (houseclickDB) as the secondary analytics store.

---

## Architecture

```
Business Logic (shops, newsletters, contacts, appointments, etc.)
  |
  v
logActivity()  --  server/utils/activityLogger.ts
  |
  +---> PostgreSQL (activity_logs table)
  |       - Primary store, JSON-stringified changes/metadata
  |       - Serves ActivityFeed component on entity detail pages
  |       - Endpoint: /api/activity-logs
  |
  +---> ClickHouse (houseclickDB)
          - Analytics store, optimized for search/aggregation
          - Serves Management page (/management?tab=activity-logs)
          - Endpoint: /api/axiom-activity-logs (legacy path, backed by ClickHouse)
          - Fire-and-forget, non-blocking writes
```

## Data Shape

Each activity log entry contains:

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Auto-generated primary key |
| tenantId | string | Tenant isolation (required) |
| userId | string or null | Who performed the action (null = system) |
| entityType | string | shop, user, contact, newsletter, campaign, appointment, email, tag |
| entityId | string or null | ID of the affected entity |
| entityName | string or null | Human-readable name |
| activityType | string | created, updated, deleted, sent, scheduled, cancelled, archived |
| description | string or null | Human-readable description |
| changes | JSON or null | Field-level diffs: `{ field: { old: value, new: value } }` |
| metadata | JSON or null | Arbitrary context data |
| ipAddress | string or null | PII - admin-only, anonymized after 12 months |
| userAgent | string or null | PII - admin-only, anonymized after 12 months |
| createdAt | timestamp | When the activity occurred |

## API Endpoints

### PostgreSQL-backed (ActivityFeed)

- `GET /api/activity-logs` - Filter by entityType, entityId, activityType; offset pagination
- `GET /api/activity-logs/entity/:entityType/:entityId` - Entity-specific shorthand

### ClickHouse-backed (Management Page)

- `GET /api/axiom-activity-logs` - Filter + time-range + offset pagination
- `GET /api/axiom-activity-logs/entity/:entityType/:entityId` - Entity-specific with time range
- `GET /api/axiom-activity-logs/stats` - Aggregations: count by entityType, activityType, hourly timeline
- `GET /api/axiom-activity-logs/search` - Full-text search with `q` parameter

### Response Shape (both return same structure)

```json
{
  "logs": [{
    "id": "uuid",
    "tenantId": "...",
    "userId": "...",
    "entityType": "shop",
    "entityId": "...",
    "entityName": "My Shop",
    "activityType": "updated",
    "description": "Updated shop name",
    "changes": { "name": { "old": "Old Name", "new": "New Name" } },
    "metadata": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "user": {
      "id": "...",
      "firstName": "Dan",
      "lastName": "Smith",
      "email": "dan@example.com",
      "avatarUrl": null
    }
  }],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 150,
    "hasMore": true
  }
}
```

## Key Files

| Component | Path |
|-----------|------|
| Activity logger (dual-write) | `server/utils/activityLogger.ts` |
| ClickHouse client | `server/utils/clickhouseClient.ts` |
| ClickHouse logger (ingest) | `server/utils/clickhouseActivityLogger.ts` |
| ClickHouse query routes | `server/routes/clickhouseActivityRoutes.ts` |
| DB query routes | `server/routes/activityRoutes.ts` |
| Schema & types | `shared/schema.ts` |
| Client hooks | `client/src/hooks/useActivityLogs.ts` |
| Management page | `client/src/pages/management-activity-logs.tsx` |
| Activity feed component | `client/src/components/activity/ActivityFeed.tsx` |
| GDPR anonymization tool | `tools/anonymize-activity-logs.ts` |

## Where logActivity() Is Called

- `server/routes/newsletterRoutes.ts` - 20+ calls
- `server/routes/shopsRoutes.ts` - 4 calls
- `server/routes/appointmentRoutes.ts` - 4 calls
- `server/routes/email/contactRoutes.ts`
- `server/routes/email/emailScheduleRoutes.ts`
- `server/routes/appointmentRemindersRoutes.ts`

All callers use the same `logActivity()` interface and are unaware of the underlying stores.

## ClickHouse Configuration

Environment variables:
- `CLICKHOUSE_URL` - ClickHouse HTTP endpoint
- `CLICKHOUSE_DATABASE` - Database name (default: `default`)
- `CLICKHOUSE_USER` - Username (default: `default`)
- `CLICKHOUSE_PASSWORD` - Password

## GDPR / PII

- `ipAddress` and `userAgent` are only returned to admin users
- These fields must be anonymized after 12 months (see `tools/anonymize-activity-logs.ts`)
- All queries enforce tenant isolation via `tenantId` filtering
