# Temporal Email Worker System

A comprehensive Temporal Go SDK worker system for handling email campaigns with Resend and Postmark integration. This system provides reliable email sending with automatic retries, workflow orchestration, and real-time tracking.

## Architecture

```
server-go/
├── cmd/
│   ├── server/               # HTTP/REST API server
│   │   └── main.go
│   ├── worker/               # Resend Temporal worker service
│   │   └── main.go
│   └── postmark-worker/      # Postmark Temporal worker service
│       └── main.go
│
├── internal/
│   ├── api/                  # HTTP handlers
│   │   └── email_handler.go
│   ├── workflows/            # Temporal workflow definitions
│   │   └── email_workflow.go
│   ├── activities/           # Temporal activity implementations
│   │   └── send_email.go
│   └── client/               # Temporal client
│       └── temporal_client.go
│
├── config/                   # Configuration files
│   └── config.yaml
│
├── pkg/                      # Shared packages
│   └── logger/
│       └── logger.go
│
├── build.sh                  # Build script
├── go.mod
├── go.sum
└── README.md
```

## Features

- **Temporal Workflow Orchestration**: Reliable email processing with workflow management
- **Dual Email Provider Support**: Professional email sending via Resend API and Postmark API
- **Separate Worker Processes**: Independent workers for Resend and Postmark with different task queues
- **Automatic Retries**: 5 retry attempts with 1-minute intervals on failure
- **Real-time Tracking**: Track email status from queued to sent/failed
- **JWT Authentication**: Secure API endpoints with JWT middleware
- **Structured Logging**: JSON-formatted logs with contextual information
- **Graceful Shutdown**: Proper cleanup and shutdown handling
- **Template Support**: Multiple email templates (marketing, transactional, newsletter, notification)

## Configuration

### config/config.yaml
```yaml
server:
  port: "3501"
  host: "0.0.0.0"

temporal:
  host_port: "172.19.0.4:7233"
  namespace: "default"
  task_queue: "email-task-queue"

email:
  resend_api_key: "re_f27r7h2s_BYXi6aNpimSCfCLwMeec686Q"
  from_email: "noreply@zendwise.work"
  retry_attempts: 5
  retry_interval: "1m"

jwt:
  secret: "your-jwt-secret-here"

logging:
  level: "info"
  format: "json"
```

### Environment Variables (Override config file)
```bash
CONFIG_FILE=config/config.yaml
TEMPORAL_HOST=172.19.0.4:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=email-task-queue
RESEND_API_KEY=re_f27r7h2s_BYXi6aNpimSCfCLwMeec686Q
FROM_EMAIL=noreply@zendwise.work
JWT_SECRET=your-jwt-secret
LOG_LEVEL=info
LOG_FORMAT=json
PORT=3501
HOST=0.0.0.0
```

## Quick Start

### 1. Build the Applications
```bash
./build.sh
```

### 2. Start Temporal Worker
```bash
./worker
```

### 3. Start HTTP Server (in another terminal)
```bash
./server
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Email Tracking (Protected with JWT)
```bash
# Create email tracking entry (triggers workflow)
POST /api/email-tracking
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "emailId": "campaign-123",
  "status": "queued",
  "temporalWorkflow": "email-workflow-campaign-123",
  "metadata": {
    "recipient": "user@example.com",
    "subject": "Test Email",
    "content": "Hello from Temporal!",
    "templateType": "marketing",
    "priority": "normal"
  }
}

# Get all tracking entries
GET /api/email-tracking
Authorization: Bearer <jwt-token>

# Get specific tracking entry
GET /api/email-tracking/{id}
Authorization: Bearer <jwt-token>

# Update tracking entry
PUT /api/email-tracking/{id}
Authorization: Bearer <jwt-token>

# Delete tracking entry
DELETE /api/email-tracking/{id}
Authorization: Bearer <jwt-token>
```

## Email Templates

The system supports multiple email templates:

1. **Marketing**: Gradient header with professional styling
2. **Transactional**: Clean design with green accent
3. **Newsletter**: Blue header with newsletter branding
4. **Notification**: Orange accent for important messages
5. **Default**: Simple HTML formatting

## Workflow Details

### Email Workflow
- **Workflow Name**: `EmailWorkflow`
- **Task Queue**: `email-task-queue`
- **Retry Policy**: 
  - Maximum attempts: 5
  - Retry interval: 1 minute
  - No exponential backoff
- **Activity Timeout**: 2 minutes
- **Heartbeat Timeout**: 30 seconds

### Email Activity
- **Activity Name**: `SendEmail`
- **Provider**: Resend API
- **Features**:
  - Template-based email formatting
  - Activity heartbeats for monitoring
  - Detailed error handling
  - Result tracking with Resend ID

## Monitoring and Logging

The system provides comprehensive logging with structured JSON format:

```json
{
  "time": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "msg": "Successfully sent email via Resend",
  "email_id": "campaign-123",
  "workflow_id": "email-workflow-campaign-123",
  "resend_id": "abc123",
  "recipient": "user@example.com"
}
```

## Development

### Prerequisites
- Go 1.21+
- Temporal server running on 172.19.0.4:7233
- Resend API key

### Building
```bash
go mod tidy
./build.sh
```

### Testing
```bash
go test ./...
```

### Manual Testing
```bash
# Test health endpoint
curl http://localhost:3501/health

# Test email sending (requires JWT token)
curl -X POST http://localhost:3501/api/email-tracking \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "emailId": "test-123",
    "status": "queued",
    "temporalWorkflow": "email-workflow-test-123",
    "metadata": {
      "recipient": "dan@zendwise.work",
      "subject": "Test Email",
      "content": "This is a test email",
      "templateType": "marketing",
      "priority": "normal"
    }
  }'
```

## Production Deployment

### Using Docker
```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
RUN go mod tidy && ./build.sh

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/worker .
COPY --from=builder /app/server .
COPY --from=builder /app/config ./config
```

### Using PM2
```bash
# Start worker
pm2 start ./worker --name "email-worker"

# Start server
pm2 start ./server --name "email-server"
```

## Integration with Frontend

The system integrates with the existing `/email-campaigns` frontend page. When users send campaigns through the UI, the Go server:

1. Receives email tracking requests via JWT-protected API
2. Creates workflow entries in the tracking store
3. Starts Temporal workflows for email processing
4. Updates tracking status in real-time
5. Provides status updates to the frontend via polling

## Error Handling

- **Network Failures**: Automatic retry with 1-minute intervals
- **API Errors**: Detailed error logging and status updates
- **Workflow Failures**: Comprehensive error tracking in metadata
- **Invalid Requests**: Proper HTTP status codes and error messages

## Security

- JWT authentication for all API endpoints
- CORS configuration for allowed origins
- Input validation and sanitization
- Secure error handling without sensitive data exposure

## Performance

- Efficient in-memory tracking store (consider database for production)
- Concurrent workflow processing
- Activity heartbeats for long-running operations
- Graceful shutdown with proper cleanup

## Support

For issues and questions:
1. Check the logs for detailed error information
2. Verify Temporal server connectivity
3. Ensure Resend API key is valid
4. Check JWT token authentication