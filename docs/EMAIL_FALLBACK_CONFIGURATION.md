# Email Fallback Configuration

## Overview
This document explains the email fallback mechanism control system that determines whether emails can be sent directly (bypassing Temporal) when the Temporal workflow service is unavailable.

## Environment Variable

### `ENABLE_EMAIL_FALLBACK`

**Type**: Boolean  
**Default**: `false`  
**Location**: `cardprocessor-go/.env`

Controls whether the system can fall back to direct email sending when Temporal is unavailable.

```bash
# Development - Allow fallback for testing
ENABLE_EMAIL_FALLBACK=true

# Production - Require Temporal (recommended)
ENABLE_EMAIL_FALLBACK=false
```

## Behavior

### When `ENABLE_EMAIL_FALLBACK=false` (Default - Recommended for Production)

**Temporal Available**: ✅ Emails sent via Temporal workflow (normal operation)  
**Temporal Unavailable**: ❌ Requests fail with `503 Service Unavailable`

**Response when Temporal is unavailable**:
```json
{
  "success": false,
  "error": "Temporal workflow service is unavailable and email fallback is disabled. Please check Temporal connection or enable fallback for development (ENABLE_EMAIL_FALLBACK=true).",
  "details": {
    "temporalAvailable": false,
    "fallbackEnabled": false
  }
}
```

**Logs**:
```
❌ [Birthday Test] Email fallback is DISABLED. Temporal is required but unavailable.
   └─ Temporal Client: true
   └─ Temporal Connected: false
   └─ To enable fallback for development, set ENABLE_EMAIL_FALLBACK=true in .env
   └─ WARNING: Fallback should NEVER be enabled in production!
```

### When `ENABLE_EMAIL_FALLBACK=true` (Development Only)

**Temporal Available**: ✅ Emails sent via Temporal workflow (preferred)  
**Temporal Unavailable**: ⚠️ Falls back to direct email sending

**Response when using fallback**:
```json
{
  "success": true,
  "message": "Test birthday card queued (fallback mode - Temporal unavailable)",
  "warning": "Email sent via fallback mechanism. Temporal workflow service is unavailable.",
  "recipient": {
    "userId": "user-id",
    "userEmail": "user@example.com"
  },
  "fallbackMode": true
}
```

**Logs**:
```
⚠️ [Birthday Test] Using FALLBACK mode (direct email sending)
⚠️ WARNING: Fallback mode is active! This bypasses Temporal workflow.
⚠️ WARNING: This should ONLY be used in development environments!
⚠️ WARNING: Production deployments must use Temporal for reliability.
```

## Why This Matters

### Production Requirements
- **Reliability**: Temporal provides durability, retries, and workflow orchestration
- **Observability**: Temporal gives full visibility into workflow execution
- **Scalability**: Temporal handles load balancing and task distribution
- **Consistency**: Temporal ensures exactly-once execution semantics

### Problems with Direct Email Sending (Fallback)
- ❌ No automatic retries on failure
- ❌ No workflow state management
- ❌ No visibility into execution history
- ❌ No durability guarantees
- ❌ Bypasses split email logic for promotions
- ❌ No coordination with other workflow activities

## Configuration Steps

### For Development
If Temporal is not running and you need to test other features:

1. Edit `cardprocessor-go/.env`:
   ```bash
   ENABLE_EMAIL_FALLBACK=true
   ```

2. Restart the Go service:
   ```bash
   cd /home/root/Authentik/cardprocessor-go
   go build && ./cardprocessor-go
   ```

3. You'll see warnings in logs when fallback is used

### For Production
**Always keep fallback disabled**:

1. Ensure `cardprocessor-go/.env`:
   ```bash
   ENABLE_EMAIL_FALLBACK=false
   ```

2. Ensure Temporal is running and properly configured:
   ```bash
   TEMPORAL_ADDRESS=your-temporal-server:7233
   TEMPORAL_NAMESPACE=production
   TEMPORAL_TASK_QUEUE=authentik-tasks
   TEMPORAL_WORKER_ENABLED=true
   ```

3. Monitor Temporal connection health

## Troubleshooting

### "Service Unavailable" Error
If you see `503 Service Unavailable` with message about Temporal:

1. **Check Temporal is running**:
   ```bash
   # If using Docker
   docker ps | grep temporal
   
   # Check Temporal UI
   open http://localhost:8080
   ```

2. **Verify connection settings** in `.env`:
   ```bash
   TEMPORAL_ADDRESS=localhost:7233
   ```

3. **For development only**: Enable fallback temporarily:
   ```bash
   ENABLE_EMAIL_FALLBACK=true
   ```

### Warning About Fallback in Logs
If you see fallback warnings:

1. **In production**: This is a critical issue! Fix Temporal immediately.
2. **In development**: Expected if you enabled fallback intentionally.

## Code Changes

### Files Modified
1. `cardprocessor-go/.env.example` - Added `ENABLE_EMAIL_FALLBACK` with documentation
2. `cardprocessor-go/.env` - Added the configuration variable
3. `cardprocessor-go/internal/config/config.go` - Added config field and loading
4. `cardprocessor-go/internal/handlers/birthday.go` - Modified fallback logic with checks

### Implementation Details

The fallback check happens in `SendTestBirthdayCard` handler:

```go
// Check if Temporal is available
if h.temporalClient != nil && h.temporalClient.IsConnected() {
    // Use Temporal workflow (preferred)
    ...
}

// Temporal not available - check fallback config
if !h.config.EnableEmailFallback {
    // Fallback disabled - return error
    c.JSON(http.StatusServiceUnavailable, ...)
    return
}

// Fallback enabled - use direct sending with warnings
...
```

## Best Practices

### ✅ DO
- Keep `ENABLE_EMAIL_FALLBACK=false` in production
- Monitor Temporal health proactively
- Use fallback only for development/testing
- Fix Temporal issues rather than relying on fallback

### ❌ DON'T
- Enable fallback in production
- Use fallback as a long-term solution
- Ignore warnings about fallback usage
- Deploy without Temporal in production

## Monitoring

### Recommended Alerts
Set up monitoring for:
- Temporal service availability
- `503` errors from email endpoints
- Log messages containing "FALLBACK mode"
- `fallbackMode: true` in API responses

### Health Check
The API response includes fallback status:
```json
{
  "details": {
    "temporalAvailable": true/false,
    "fallbackEnabled": true/false
  }
}
```

## Migration from Old System

### Old Behavior (Before)
- Fallback was always active
- No configuration control
- Silent fallback without warnings
- Confusing in both dev and production

### New Behavior (After)
- Fallback controlled by env variable
- Default: disabled (production-safe)
- Clear warnings when fallback is used
- Explicit errors when Temporal is required but unavailable

## Related Features

This fallback control integrates with:
- **Split Promotional Emails**: Fallback bypasses split email logic
- **Birthday Card Workflows**: Fallback skips workflow orchestration
- **Email Activity Tracking**: Fallback may not log activities properly

## Support

If you encounter issues:
1. Check Temporal service status
2. Verify `.env` configuration
3. Review application logs for detailed error messages
4. Ensure all Temporal env variables are set correctly

## Version History

- **v1.0** (2025-10-04): Initial implementation of fallback control system
