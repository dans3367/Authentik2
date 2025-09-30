# Worker Services Configuration

## Overview

Worker services handle background tasks like sending birthday emails and newsletter processing. These services are now managed by the **cardprocessor-go server** on port 5004.

## Current Configuration

### Express Server (Port 5000)
**Status:** Workers DISABLED ❌

The Express server no longer runs worker services. All worker functionality has been moved to cardprocessor-go for better performance and separation of concerns.

```typescript
// In server/index.ts
// Workers are commented out but code is preserved for reference
serverLogger.info('🚫 Newsletter Worker Service: DISABLED (handled by cardprocessor-go)');
serverLogger.info('🚫 Birthday Worker Service: DISABLED (handled by cardprocessor-go)');
```

### Cardprocessor-Go Server (Port 5004)
**Status:** Workers ACTIVE ✅

All worker services run in the cardprocessor-go server:
- Birthday card worker
- Email sending
- Temporal workflows
- Background job processing

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Express Server (5000)                 │
│                                                         │
│  - API endpoints                                        │
│  - Authentication                                       │
│  - Proxy to other services                            │
│  - NO WORKERS ❌                                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              Cardprocessor-Go Server (5004)             │
│                                                         │
│  - Birthday card processing                            │
│  - Unsubscribe handling                                │
│  - Background workers ✅                                │
│  - Temporal workflow integration                       │
│  - Email sending                                       │
└─────────────────────────────────────────────────────────┘
```

## Benefits of This Architecture

### ✅ Separation of Concerns
- Express handles HTTP/API
- Cardprocessor-go handles workers and background tasks

### ✅ Better Performance
- Workers don't block API requests
- Go's concurrency model is ideal for background tasks

### ✅ Independent Scaling
- Scale API server separately from workers
- Workers can be scaled based on job volume

### ✅ Cleaner Codebase
- Each service has a focused responsibility
- Easier to debug and maintain

## Starting Services

### With Workers (Production)
```bash
./start.sh
```

This starts:
1. **Express Server (5000)** - API only, no workers
2. **Cardprocessor-Go (5004)** - With all workers active

### Development Mode

#### API Server Only (No Workers)
```bash
cd /Users/root1/Documents/Authentik
PORT=5000 NODE_ENV=development npx tsx server/index.ts
```

#### Workers Only (No API)
```bash
cd cardprocessor-go
go run main.go
```

## Re-enabling Workers in Express (If Needed)

If you need to re-enable workers in the Express server:

1. Edit `server/index.ts`
2. Find the commented worker sections (lines ~120-148)
3. Uncomment the code blocks:

```typescript
// Uncomment this section:
/*
try {
  serverLogger.info('🏭 Starting Newsletter Worker Service...');
  await newsletterWorkerService.start();
  serverLogger.info('✅ Newsletter Worker Service started');
} catch (error) {
  serverLogger.error("Failed to initialize Newsletter Worker Service:", error);
}
*/

// Uncomment this section:
/*
try {
  serverLogger.info('🎂 Starting Birthday Worker Service...');
  birthdayWorkerService.start();
  serverLogger.info('✅ Birthday Worker Service started');
} catch (error) {
  serverLogger.error("Failed to initialize Birthday Worker Service:", error);
}
*/
```

4. Remove or comment out the "DISABLED" log messages
5. Restart the server

## Monitoring Workers

### Check Worker Status

```bash
# Cardprocessor-go health (includes worker status)
curl http://localhost:5004/health

# Expected response:
{
  "status": "ok",
  "service": "birthday-card-processor",
  "version": "1.0.0"
}
```

### Logs

Workers log to the cardprocessor-go console:
- Check start.sh output for worker logs
- Look for birthday processing messages
- Monitor Temporal workflow execution

### Database

Check worker activity in the database:
```sql
-- Check birthday tokens generated
SELECT COUNT(*) FROM birthday_unsubscribe_tokens 
WHERE created_at > NOW() - INTERVAL '1 day';

-- Check email activity
SELECT activity_type, COUNT(*) 
FROM email_activity 
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY activity_type;
```

## Environment Variables

### Worker Configuration
```bash
# In cardprocessor-go
BIRTHDAY_WORKER_ENABLED=true        # Enable/disable birthday worker
BIRTHDAY_CHECK_INTERVAL=3600        # Check interval in seconds
BIRTHDAY_BATCH_SIZE=50              # Batch size for processing
TEMPORAL_WORKER_ENABLED=true        # Enable Temporal worker
```

## Troubleshooting

### Workers Not Running
```bash
# Check if cardprocessor-go is running
lsof -i :5004

# Check logs
# Look at start.sh output for cardprocessor-go section
```

### Duplicate Jobs
If you accidentally enable workers in both servers:
1. Stop all services: `Ctrl+C` on start.sh
2. Verify workers are disabled in Express (server/index.ts)
3. Restart services: `./start.sh`

### Jobs Not Processing
```bash
# Check Temporal connection
curl http://localhost:50051/health

# Check database connection
# Review cardprocessor-go logs for errors
```

## Migration History

- **Before:** Workers ran in Express server (Node.js)
- **After:** Workers run in cardprocessor-go (Go)
- **Date:** September 30, 2025
- **Reason:** Better performance, separation of concerns

## Related Documentation

- `/cardprocessor-go/TEMPORAL_WORKER.md` - Temporal worker details
- `/PORT_CONFIGURATION.md` - Port and service mapping
- `/UNSUBSCRIBE_IMPLEMENTATION.md` - Unsubscribe flow details

---

**Last Updated:** September 30, 2025  
**Status:** Workers running in cardprocessor-go only ✅