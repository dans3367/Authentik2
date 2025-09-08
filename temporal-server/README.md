# Authentik Temporal Server

A dedicated Temporal server that handles newsletter workflows and integrates with Resend and Postmark APIs for email delivery.

## Architecture

This temporal server provides:
- **GRPC Bridge**: Communicates with the main Authentik backend via GRPC
- **Email Integration**: Supports both Resend and Postmark APIs with automatic failover
- **Newsletter Workflows**: Handles batch newsletter sending with proper error handling and status tracking
- **Workflow Management**: Generic workflow support for future extensions

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example configuration:

```bash
cp config.example.env .env
```

Edit `.env` with your actual values:

```env
# Temporal Server Configuration
TEMPORAL_SERVER_PORT=50051
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# Email Provider Configuration
PRIMARY_EMAIL_PROVIDER=resend
RESEND_API_KEY=your_resend_api_key_here
POSTMARK_API_KEY=your_postmark_api_key_here

# Email Settings
FROM_EMAIL=noreply@zendwise.work
EMAIL_CONCURRENCY_LIMIT=5

# Newsletter Settings
NEWSLETTER_BATCH_SIZE=50

# Backend Integration
BACKEND_URL=http://localhost:3501
FRONTEND_URL=https://app.zendwise.work
```

### 3. Start the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

Using the start script:
```bash
./start.sh
```

## Services

### Newsletter Service (GRPC)

- `SendNewsletter`: Starts a newsletter workflow
- `GetNewsletterStatus`: Gets the status of a newsletter workflow
- `CancelNewsletter`: Cancels a running newsletter workflow

### Workflow Service (GRPC)

- `StartWorkflow`: Starts any generic workflow
- `GetWorkflowResult`: Gets the result of a workflow
- `SignalWorkflow`: Sends a signal to a running workflow
- `CancelWorkflow`: Cancels a running workflow

## Email Providers

### Resend Integration

- High-performance email delivery
- Detailed delivery tracking
- Automatic retry on failures

### Postmark Integration

- Reliable transactional email service
- Excellent deliverability rates
- Automatic failover from Resend

### Failover Strategy

The system automatically falls back to the secondary provider if the primary provider fails:
- If Resend fails → Falls back to Postmark
- If Postmark fails → Falls back to Resend

## Workflows

### Newsletter Sending Workflow

The newsletter workflow handles:
1. **Batch Processing**: Splits recipients into manageable batches
2. **Email Personalization**: Personalizes content with recipient data
3. **Delivery Tracking**: Tracks delivery status and metrics
4. **Error Handling**: Proper retry and error handling
5. **Status Updates**: Updates newsletter status in the backend database

### Workflow Features

- **Batch Size Control**: Configurable batch sizes to avoid rate limits
- **Concurrency Control**: Limits concurrent email sending to avoid provider limits
- **Progress Tracking**: Real-time progress updates
- **Error Recovery**: Automatic retry on transient failures
- **Status Reporting**: Detailed status reporting back to the main backend

## Development

### Project Structure

```
temporal-server/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── services/             # GRPC service implementations
│   │   ├── temporal-worker.ts    # Temporal worker service
│   │   ├── newsletter-grpc-service.ts
│   │   └── workflow-grpc-service.ts
│   ├── activities/           # Temporal activities
│   │   ├── newsletter-activities.ts
│   │   └── email-activities.ts
│   ├── workflows/            # Temporal workflows
│   │   └── newsletter-workflow.ts
│   └── utils/
│       └── proto-loader.ts   # Protocol buffer loader
├── proto/
│   └── temporal-bridge.proto # GRPC service definitions
└── package.json
```

### Adding New Workflows

1. Create a new workflow in `src/workflows/`
2. Create corresponding activities in `src/activities/`
3. Update the proto definitions if needed
4. Add GRPC service methods if required

### Testing

```bash
# Type checking
npm run type-check

# Build
npm run build
```

## Production Deployment

### Environment Variables

Ensure all required environment variables are set:
- Email provider API keys
- Temporal server connection details
- Backend service URLs

### Monitoring

The server provides health checks and detailed logging:
- GRPC service status
- Temporal connection status
- Email provider availability
- Workflow execution metrics

### Scaling

The temporal server can be scaled horizontally:
- Multiple instances can run simultaneously
- Temporal handles load balancing automatically
- Email rate limits are per-instance

## Integration with Main Backend

The main Authentik backend communicates with this temporal server via GRPC:

1. Backend creates GRPC client connection
2. Newsletter requests are sent via GRPC
3. Temporal server executes workflows
4. Status updates are sent back to backend via REST API
5. Final results are tracked in the main database

## Troubleshooting

### Common Issues

1. **GRPC Connection Failed**: Check temporal server address and port
2. **Email Provider Errors**: Verify API keys and provider status
3. **Temporal Connection Failed**: Ensure Temporal server is running
4. **Permission Denied**: Check internal service authentication headers

### Logs

The server provides detailed logging for:
- GRPC requests and responses
- Email sending attempts and results
- Workflow execution progress
- Error conditions and recovery

### Health Check

Check server health:
```bash
curl http://localhost:50051/health
```

## Security

- Internal service authentication for backend callbacks
- Secure GRPC communication
- Email provider API key protection
- Input validation and sanitization


