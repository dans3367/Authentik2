# Migration: Unsubscribe Server to Port 5004

## Summary

The unsubscribe functionality has been consolidated into the main cardprocessor-go server (port 5004) instead of running as a separate server on port 7070.

## What Changed

### 1. Removed Standalone Server
- ❌ Deleted `/cardprocessor-go/unsubscribe-server.go`
- The functionality already existed in the main server at `/cardprocessor-go/main.go`

### 2. Updated Express Proxy
**File:** `/server/routes.ts`

**Before:**
```typescript
// Proxied to port 7070
const url = `http://localhost:7070/api/unsubscribe/birthday...`;
```

**After:**
```typescript
// Proxies to port 5004
const url = `http://localhost:5004/api/unsubscribe/birthday...`;
```

### 3. Updated Start Script
**File:** `/start.sh`

**Changes:**
- Removed "Unsubscribe Server" on port 7070
- Added "Cardprocessor Go" on port 5004
- Updated port environment variables

**Before:**
```bash
[\"Unsubscribe Server\"]=\"7070\"
export UNSUBSCRIBE_PORT=${UNSUBSCRIBE_PORT:-7070}
go run unsubscribe-server.go
```

**After:**
```bash
[\"Cardprocessor Go\"]=\"5004\"
export CARDPROCESSOR_PORT=${CARDPROCESSOR_PORT:-5004}
go run main.go
```

### 4. Updated Documentation
All documentation files updated to reflect port 5004:
- `/UNSUBSCRIBE_IMPLEMENTATION.md`
- `/cardprocessor-go/UNSUBSCRIBE_SERVER.md`
- `/cardprocessor-go/UNSUBSCRIBE_FLOW.txt`

## Architecture

### Before
```
Express (3500) → Standalone Unsubscribe Server (7070) → Database
                            ↓
                    Separate process
                    Separate startup
```

### After
```
Express (5000) → Cardprocessor-Go Server (5004) → Database
                          ↓
                 Single unified process
                 Birthday cards + Unsubscribe
```

## Benefits

✅ **Simplified Architecture**
- One server instead of two
- Single codebase for all birthday card functionality

✅ **Reduced Resource Usage**
- One database connection pool
- One process to monitor and manage

✅ **Easier Deployment**
- Fewer ports to manage
- Simpler startup sequence

✅ **Unified Logging**
- All birthday card operations in one log stream

✅ **Better Code Reuse**
- Handlers and repository already existed
- No code duplication

## Port Mapping

| Service | Port | Purpose |
|---------|------|---------|
| Express Server | 5000 | Main API, frontend, proxy |
| Form Server | 3004 | Form serving |
| Server Node | 3502 | Temporal client |
| Temporal Server | 50051 | GRPC bridge |
| Webhook Server | 3505 | Webhook handling |
| **Cardprocessor-Go** | **5004** | **Birthday cards & Unsubscribe** |

## Testing

### Health Check
```bash
# Via proxy
curl http://localhost:5002/api/unsubscribe/birthday

# Direct
curl http://localhost:5004/health
```

### Unsubscribe Flow
```bash
# Via proxy (production URL path)
curl "http://localhost:5002/api/unsubscribe/birthday?token=YOUR_TOKEN"

# Direct to cardprocessor-go
curl "http://localhost:5004/api/unsubscribe/birthday?token=YOUR_TOKEN"
```

## Routes in Cardprocessor-Go

The main server (`/cardprocessor-go/internal/router/router.go`) has:

### Public Routes (No Auth)
- `GET /health` - Health check
- `GET /api/unsubscribe/birthday?token=xxx` - Show unsubscribe form
- `POST /api/unsubscribe/birthday` - Process unsubscribe

### Authenticated Routes
- `GET /api/birthday-settings` - Get birthday settings
- `PUT /api/birthday-settings` - Update settings
- `GET /api/birthday-contacts` - List birthday contacts
- `PUT /api/email-contacts/:contactId` - Update contact birthday
- `PATCH /api/email-contacts/birthday-email/bulk` - Bulk update preferences
- `POST /api/birthday-invitation/:contactId` - Send birthday invitation
- `POST /api/birthday-test` - Test birthday card
- `POST /api/birthday-unsubscribe-token/:contactId` - Generate unsubscribe token

## Database Schema

No changes needed - uses existing tables:
- `birthday_unsubscribe_tokens`
- `email_contacts`

## Configuration

No new environment variables needed. Uses existing:
```env
DATABASE_URL=postgres://...
JWT_SECRET=your-secret-key
PORT=5004  # Default for cardprocessor-go
```

## Startup

### Full Stack
```bash
./start.sh
```

Output includes:
```
[SERVICE] Starting Cardprocessor Go on port 5004...
[PORT] Cardprocessor Go: http://localhost:5004 (Birthday cards & Unsubscribe)
```

### Standalone
```bash
cd cardprocessor-go
go run main.go
```

## Migration Checklist

- [x] Removed standalone unsubscribe-server.go
- [x] Updated Express proxy to port 5004
- [x] Updated start.sh to launch cardprocessor-go
- [x] Fixed template loading path
- [x] Updated all documentation
- [x] Verified routes are correct
- [x] Tested template form submission

## Rollback (if needed)

If you need to rollback to the standalone server:

1. Restore `unsubscribe-server.go` from git history
2. Change proxy port in `/server/routes.ts` back to 7070
3. Update `/start.sh` to launch unsubscribe server on 7070
4. Revert documentation changes

## Notes

- The main cardprocessor-go server already had all the unsubscribe handlers
- No code changes were needed to handlers or repository
- Only routing/proxy and documentation updates required
- Templates remain unchanged in `cardprocessor-go/templates/`

## Verification

After migration, verify:

1. ✅ Cardprocessor-Go starts on port 5004
2. ✅ Health endpoint responds: `curl http://localhost:5004/health`
3. ✅ Unsubscribe page loads with valid token
4. ✅ Form submission works
5. ✅ Database is updated correctly
6. ✅ Express proxy forwards correctly

---

**Migration Date:** September 30, 2025  
**Status:** ✅ Complete  
**Impact:** Low - Simplified architecture, no functional changes