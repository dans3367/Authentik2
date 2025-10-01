# Error Logging Improvements for 500 Internal Server Errors

## Overview
This document describes the extensive console logging improvements added to the cardprocessor-go service for better debugging and monitoring of HTTP 500 Internal Server Errors.

## Changes Made

### 1. Enhanced HTTP Handler Error Logging (`internal/handlers/birthday.go`)

Added detailed error logging for all 500 error responses in the following handlers:

#### **UpdateBirthdaySettings**
- Tenant ID
- Error type and message
- Settings values (enabled, template, segment filter)
- Request path and method
- Client IP
- Stack trace

#### **GetBirthdayContacts**
- Tenant ID
- Query parameters (page, limit, upcomingOnly)
- Offset calculation
- Error details and stack trace
- Request context

#### **UpdateContactBirthday**
- Tenant ID and Contact ID
- Birthday value and email enabled status
- Error details and stack trace
- Request context

#### **UpdateBulkBirthdayEmailPreference**
- Tenant ID
- Contact IDs count and list
- Email enabled status
- Error details and stack trace
- Request context

#### **SendTestBirthdayCard**
- Tenant ID and User ID
- User email and template information
- Promotion ID
- Temporal client connection status
- Error details and stack trace
- Request context

#### **GenerateBirthdayUnsubscribeToken**
- Token generation errors
- Contact retrieval errors
- Database token creation errors
- All include tenant/contact IDs, request context, and stack traces

#### **ShowBirthdayUnsubscribePage**
- Token validation errors
- Contact retrieval errors
- Query string information
- Stack traces

#### **ProcessBirthdayUnsubscribe**
- Token validation errors
- Contact retrieval errors
- Unsubscribe operation errors
- Reason for unsubscribing
- Full context and stack traces

### 2. Global Error Logging Middleware (`internal/middleware/error_logger.go`)

Created two new middleware functions:

#### **ErrorLogger()**
Automatically logs detailed information for ALL HTTP 500+ responses:

```
╔═══════════════════════════════════════════════════════════════════════
║ 🚨 SERVER ERROR DETECTED - HTTP 500
╠═══════════════════════════════════════════════════════════════════════
║ Timestamp:       2025-10-01 12:34:56.789 UTC
║ Request ID:      1234567890123
║ Method:          POST
║ Path:            /api/birthday/settings
║ Full URL:        /api/birthday/settings?param=value
║ Query String:    param=value
║ Status Code:     500
║ Client IP:       192.168.1.100
║ User Agent:      Mozilla/5.0...
║ Referer:         https://example.com
║ Duration:        123ms
║ Content-Type:    application/json
║ Content-Length:  1234
║ Accept:          application/json
║ User ID:         user-123
║ Tenant ID:       tenant-456
║ Context Errors:
║   [1] Type: ErrorTypeBind, Error: invalid request
╚═══════════════════════════════════════════════════════════════════════
```

#### **RequestLogger()**
Logs all incoming requests with a unique request ID:
```
➡️  [1234567890123] POST /api/birthday/settings - IP: 192.168.1.100
```

### 3. Database Connection Error Logging (`internal/database/database.go`)

Enhanced database connection errors with:
- Database host, port, and name
- SSL mode
- Connection pool settings
- Error type and message
- Stack trace information

### 4. Middleware Integration (`internal/router/router.go`)

Updated middleware chain to include:
1. `RequestLogger()` - Logs incoming requests with IDs
2. `gin.Logger()` - Default Gin logger
3. `gin.Recovery()` - Panic recovery
4. `ErrorLogger()` - Catches all 500+ errors
5. `SetupCORS()` - CORS configuration

## Error Log Format

All error logs follow a consistent format:

```
❌ [500 ERROR] <Operation> failed
   └─ <Context Key>: <Value>
   └─ Error Type: <Go type>
   └─ Error Message: <Error message>
   └─ <Additional context>
   └─ Request Path: <Method> <Path>
   └─ Client IP: <IP address>
   └─ Stack Trace: <Error stack trace>
```

## Benefits

1. **Rapid Debugging**: Detailed context makes it easy to identify root causes
2. **Request Tracing**: Request IDs allow tracking requests across logs
3. **Complete Context**: All relevant information captured at error time
4. **User Context**: Tenant ID and User ID included when available
5. **Performance Monitoring**: Request duration logged automatically
6. **Database Diagnostics**: Connection errors include full configuration details
7. **Consistent Format**: All errors follow the same logging pattern

## Usage

The error logging is automatic. Simply run the application normally:

```bash
cd cardprocessor-go
go run main.go
```

All 500 errors will be logged to stdout with extensive details.

## Log Levels

- ✅ Success operations (existing)
- ➡️  Incoming requests (new)
- ⚠️  Warnings (existing)
- ❌ Errors (enhanced with details)
- 🚨 Global 500 errors (new middleware)

## Example Output

When a database error occurs:

```
❌ [500 ERROR] GetBirthdayContacts failed
   └─ Tenant ID: tenant-abc-123
   └─ Error Type: *pq.Error
   └─ Error Message: pq: relation "email_contacts" does not exist
   └─ Query Parameters: page=1, limit=50, upcomingOnly=false
   └─ Offset: 0
   └─ Request Path: GET /api/birthday/contacts
   └─ Client IP: 172.18.0.1
   └─ Stack Trace: failed to query birthday contacts: pq: relation "email_contacts" does not exist

╔═══════════════════════════════════════════════════════════════════════
║ 🚨 SERVER ERROR DETECTED - HTTP 500
╠═══════════════════════════════════════════════════════════════════════
║ Timestamp:       2025-10-01 14:23:45.123 UTC
║ Request ID:      1727795025123
║ Method:          GET
║ Path:            /api/birthday/contacts
║ Status Code:     500
║ Client IP:       172.18.0.1
║ Tenant ID:       tenant-abc-123
║ Duration:        45ms
╚═══════════════════════════════════════════════════════════════════════
```

## Files Modified

1. `/internal/handlers/birthday.go` - Enhanced all 500 error responses
2. `/internal/middleware/error_logger.go` - New middleware for global error logging
3. `/internal/router/router.go` - Added error logging middleware
4. `/internal/database/database.go` - Enhanced database connection errors

## Testing

To test the error logging:

1. **Trigger a database error**: Temporarily change database credentials
2. **Trigger a validation error**: Send invalid request data
3. **Trigger a workflow error**: Disable Temporal and send a test card
4. **Monitor logs**: All errors will include extensive context

## Future Enhancements

Consider adding:
- Structured logging (JSON format) for log aggregation tools
- Error metrics and alerting integration
- Request/response body logging (with sensitive data masking)
- Performance profiling for slow requests
- Log rotation and archival
- Integration with error tracking services (Sentry, Rollbar, etc.)

## Notes

- All sensitive data (passwords, tokens) are NOT logged
- Stack traces use `%+v` format for detailed error context
- Request IDs are timestamp-based (nanoseconds)
- Logs are written to stdout (container-friendly)
- No external dependencies added for logging

