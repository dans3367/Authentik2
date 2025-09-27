# Birthday Card Processor with Temporal Worker

This implementation adds a Temporal worker to the cardprocessor-go service for processing birthday card test emails and birthday invitations.

## Features

- **Temporal Worker Integration**: Processes birthday test cards and invitations using Temporal workflows
- **Multiple Email Providers**: Supports Resend, SendGrid, and Mailgun with automatic fallback
- **Graceful Shutdown**: Properly handles shutdown signals and stops the Temporal worker
- **Configuration**: Environment-based configuration for Temporal settings

## Architecture

### Temporal Workflows

1. **BirthdayTestWorkflow**: Handles sending test birthday cards
   - Prepares email content with custom templates
   - Sends via multiple email providers with fallback
   - Updates tracking status

2. **BirthdayInvitationWorkflow**: Handles birthday invitation emails
   - Generates secure invitation tokens
   - Prepares invitation email content
   - Sends invitation emails
   - Updates contact invitation status

### Activities

- `PrepareBirthdayTestEmail`: Generates HTML/text content for test cards
- `SendBirthdayTestEmail`: Sends test emails via multiple providers
- `PrepareBirthdayInvitationEmail`: Generates invitation email content
- `SendBirthdayInvitationEmail`: Sends invitation emails
- `GenerateBirthdayInvitationToken`: Creates secure tokens for invitations
- `UpdateBirthdayTestStatus`: Tracks test email results
- `UpdateContactInvitationStatus`: Updates invitation tracking

## Configuration

Add these environment variables to enable the Temporal worker:

```bash
# Temporal Configuration
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=authentik-tasks
TEMPORAL_WORKER_ENABLED=true

# Email Providers (at least one required)
RESEND_API_KEY=your_resend_api_key
SENDGRID_API_KEY=your_sendgrid_api_key
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_mailgun_domain

# Default Email Settings
DEFAULT_FROM_EMAIL=admin@zendwise.work
DEFAULT_FROM_NAME=Authentik
```

## API Endpoints

### POST /api/birthday-test

Sends a test birthday card using the Temporal workflow.

**Request Body:**
```json
{
  "userEmail": "test@example.com",
  "userFirstName": "John",
  "userLastName": "Doe",
  "emailTemplate": "default",
  "customMessage": "Happy Birthday!",
  "customThemeData": {},
  "senderName": "Your Company"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Birthday test workflow started successfully",
  "workflowId": "birthday-test-user123-1234567890",
  "workflowRunId": "workflow-run-id",
  "recipient": {
    "userId": "user123",
    "userEmail": "test@example.com"
  }
}
```

## Usage

1. **Start Temporal Server**: Ensure Temporal server is running on `localhost:7233`
2. **Configure Environment**: Set the required environment variables
3. **Start the Service**: Run the cardprocessor-go service
4. **Send Test Cards**: Use the `/api/birthday-test` endpoint to send test birthday cards

## Dependencies

- `go.temporal.io/sdk v1.25.1`: Temporal Go SDK
- Existing dependencies (Gin, PostgreSQL, etc.)

## Error Handling

- **Temporal Connection Failure**: Service continues without Temporal worker
- **Email Provider Failure**: Automatic fallback to next provider
- **Workflow Failures**: Proper error reporting and status tracking

## Development

The implementation follows the same patterns as the server-node temporal worker but adapted for Go:

- Uses Go Temporal SDK instead of TypeScript SDK
- Implements similar workflow and activity patterns
- Maintains compatibility with existing API endpoints
- Adds graceful shutdown handling

## Future Enhancements

- Add JWT token generation for birthday invitations
- Implement database tracking for workflow results
- Add workflow monitoring and metrics
- Implement retry policies for failed workflows

