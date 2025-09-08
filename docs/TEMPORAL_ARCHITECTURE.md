# Authentik Temporal Server Architecture

This document describes the new temporal server architecture implemented for Authentik, including the GRPC bridge between the backend and temporal server.

## Architecture Overview

```
┌─────────────────┐
│    Frontend     │
│  (React App)    │
└─────────┬───────┘
          │ HTTP/REST
          v
┌─────────────────┐
│ Backend Public  │
│ Server (3501)   │
└─────────┬───────┘
          │ GRPC
          v
┌─────────────────┐
│ Temporal Node   │
│ Server (50051)  │
└─────┬─────┬─────┘
      │     │
      v     v
┌─────────┐ ┌─────────────┐
│ Resend  │ │ Postmark    │
│   API   │ │    API      │
└─────────┘ └─────────────┘
```

## Components

### 1. Frontend (React App)
- **Port**: 5173 (development) / 3501 (production)
- **Purpose**: User interface for creating and managing newsletters
- **Communication**: HTTP/REST API calls to Backend Public Server

### 2. Backend Public Server
- **Port**: 3501
- **Purpose**: Main application server handling authentication, business logic, and data management
- **Key Features**:
  - User authentication and authorization
  - Newsletter CRUD operations
  - Database operations
  - GRPC client for temporal communication
- **Communication**: 
  - Receives HTTP/REST from frontend
  - Sends GRPC calls to Temporal Server
  - Receives HTTP callbacks from Temporal Server for status updates

### 3. Temporal Node Server
- **Port**: 50051 (GRPC)
- **Purpose**: Dedicated temporal server for workflow execution and email processing
- **Key Features**:
  - GRPC server for receiving workflow requests
  - Temporal worker for executing workflows
  - Email provider integrations (Resend + Postmark)
  - Batch email processing with error handling
- **Communication**:
  - Receives GRPC calls from Backend Server
  - Makes HTTP callbacks to Backend Server for status updates
  - Calls external email APIs (Resend/Postmark)

### 4. Email Service Providers
- **Resend API**: Primary email service provider
- **Postmark API**: Secondary provider with automatic failover

## Communication Flow

### Newsletter Sending Flow

1. **User Initiation**:
   ```
   Frontend → Backend: POST /api/newsletters/:id/send
   ```

2. **Backend Processing**:
   - Validates user permissions
   - Retrieves newsletter and recipients from database
   - Prepares GRPC request

3. **GRPC Communication**:
   ```
   Backend → Temporal Server: sendNewsletter(NewsletterRequest)
   Temporal Server → Backend: NewsletterResponse
   ```

4. **Workflow Execution**:
   - Temporal server starts newsletter workflow
   - Processes recipients in batches
   - Sends emails via Resend/Postmark APIs
   - Updates status via HTTP callbacks to backend

5. **Status Updates**:
   ```
   Temporal Server → Backend: PUT /api/newsletters/:id/status
   Temporal Server → Backend: POST /api/newsletters/:id/log
   ```

## GRPC Service Definitions

### Newsletter Service

```protobuf
service NewsletterService {
  rpc SendNewsletter(NewsletterRequest) returns (NewsletterResponse);
  rpc GetNewsletterStatus(NewsletterStatusRequest) returns (NewsletterStatusResponse);
  rpc CancelNewsletter(CancelNewsletterRequest) returns (CancelNewsletterResponse);
}
```

### Workflow Service

```protobuf
service WorkflowService {
  rpc StartWorkflow(WorkflowRequest) returns (WorkflowResponse);
  rpc GetWorkflowResult(WorkflowResultRequest) returns (WorkflowResultResponse);
  rpc SignalWorkflow(WorkflowSignalRequest) returns (WorkflowSignalResponse);
  rpc CancelWorkflow(WorkflowCancelRequest) returns (WorkflowCancelResponse);
}
```

## Key Features

### 1. Email Provider Integration

#### Resend Integration
- **Primary Provider**: High-performance email delivery
- **Features**: Detailed tracking, metadata support, batch sending
- **Rate Limits**: Handled automatically

#### Postmark Integration
- **Secondary Provider**: Reliable transactional email service
- **Features**: Excellent deliverability, detailed analytics
- **Failover**: Automatic fallback from Resend

#### Failover Strategy
```typescript
try {
  result = await sendViaResend(email);
} catch (error) {
  console.log('Resend failed, trying Postmark...');
  result = await sendViaPostmark(email);
}
```

### 2. Batch Processing

- **Configurable Batch Size**: Default 50 emails per batch
- **Concurrency Control**: Configurable concurrent email sending
- **Rate Limiting**: Built-in delays between batches
- **Error Handling**: Individual email failures don't stop the batch

### 3. Status Tracking

#### Workflow Statuses
- `draft` → `sending` → `sent` / `partially_sent` / `failed`

#### Progress Tracking
- Real-time updates during batch processing
- Detailed logging of each batch completion
- Final summary with success/failure counts

### 4. Error Handling

#### Retry Policies
```typescript
retryPolicy: {
  initialInterval: '1 second',
  maximumInterval: '30 seconds',
  backoffCoefficient: 2,
  maximumAttempts: 3,
}
```

#### Failure Recovery
- Individual email failures are logged but don't stop processing
- Provider failures trigger automatic failover
- Batch failures are retried according to retry policy
- Workflow failures update newsletter status appropriately

## Security

### GRPC Security
- Currently uses insecure connection for internal communication
- Can be upgraded to TLS for production environments

### Internal Service Authentication
- HTTP callbacks use `X-Internal-Service` header for authentication
- Only temporal server can call internal endpoints

### Input Validation
- All GRPC requests are validated
- Email content is sanitized before sending
- Recipient data is validated

## Configuration

### Backend Server Environment
```env
TEMPORAL_GRPC_ADDRESS=localhost:50051
```

### Temporal Server Environment
```env
TEMPORAL_SERVER_PORT=50051
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

PRIMARY_EMAIL_PROVIDER=resend
RESEND_API_KEY=your_key_here
POSTMARK_API_KEY=your_key_here

FROM_EMAIL=noreply@your-domain.com
EMAIL_CONCURRENCY_LIMIT=5
NEWSLETTER_BATCH_SIZE=50

BACKEND_URL=http://localhost:3501
```

## Deployment

### Development
```bash
# Start both services
./start-temporal-system.sh
```

### Production
```bash
# Build both services
cd temporal-server && npm run build
cd .. && npm run build

# Start temporal server
cd temporal-server && npm start &

# Start backend server
npm start
```

### Docker Deployment
Both services can be containerized and deployed using Docker Compose for easy scaling and management.

## Monitoring

### Health Checks
- Backend server health endpoint: `GET /health`
- Temporal server health check via GRPC connection status

### Logging
- Structured logging for all GRPC operations
- Email sending attempts and results
- Workflow execution progress
- Error conditions and recovery attempts

### Metrics
- Newsletter processing metrics
- Email delivery success rates
- Provider failover statistics
- Workflow execution times

## Troubleshooting

### Common Issues

1. **GRPC Connection Failed**
   - Check if temporal server is running on correct port
   - Verify firewall settings
   - Check `TEMPORAL_GRPC_ADDRESS` configuration

2. **Email Provider Errors**
   - Verify API keys in environment variables
   - Check provider service status
   - Review rate limiting settings

3. **Workflow Execution Failures**
   - Check temporal server logs
   - Verify temporal cluster connectivity
   - Review retry policy settings

4. **Authentication Errors**
   - Verify `X-Internal-Service` header in callbacks
   - Check backend server logs for authentication failures

### Debug Mode
Enable debug logging by setting `LOG_LEVEL=debug` in temporal server environment.

## Future Enhancements

### Planned Features
1. **TLS/SSL Support**: Secure GRPC communication
2. **Load Balancing**: Multiple temporal server instances
3. **Advanced Metrics**: Prometheus/Grafana integration
4. **Webhook Support**: Real-time delivery notifications
5. **Template Engine**: Advanced email templating
6. **A/B Testing**: Newsletter variant testing
7. **Scheduled Sending**: Time-based newsletter delivery

### Scalability Considerations
- Temporal server can be horizontally scaled
- Email providers handle rate limiting automatically
- Database operations are optimized for batch processing
- GRPC provides efficient communication between services

This architecture provides a robust, scalable solution for newsletter management with proper separation of concerns and excellent error handling capabilities.


