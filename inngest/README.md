# Inngest Email Server

Express-based server using Inngest for background job processing and Resend for email delivery.

## Setup

1. Install dependencies:
```bash
cd inngest
npm install
```

2. Configure environment variables (in root `.env` or `inngest/.env`):
```env
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@yourdomain.com
INNGEST_PORT=3006
TRACKING_URL=https://yourdomain.com
```

3. Start the Inngest Dev Server (for local development):
```bash
npx inngest-cli@latest dev
```

4. Start the email server:
```bash
npm run dev
```

## Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/inngest` | POST | Inngest webhook endpoint |
| `/api/send-email` | POST | Send a single email |
| `/api/send-bulk-email` | POST | Send multiple emails |
| `/api/send-newsletter` | POST | Send newsletter campaign |
| `/api/schedule-newsletter` | POST | Schedule newsletter for later |

## API Examples

### Send Single Email
```bash
curl -X POST http://localhost:3006/api/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "subject": "Hello",
    "html": "<h1>Hello World</h1>",
    "from": "sender@yourdomain.com"
  }'
```

### Send Bulk Emails
```bash
curl -X POST http://localhost:3006/api/send-bulk-email \
  -H "Content-Type: application/json" \
  -d '{
    "emails": [
      {"to": "user1@example.com", "subject": "Hello 1", "html": "<p>Email 1</p>"},
      {"to": "user2@example.com", "subject": "Hello 2", "html": "<p>Email 2</p>"}
    ]
  }'
```

### Send Newsletter
```bash
curl -X POST http://localhost:3006/api/send-newsletter \
  -H "Content-Type: application/json" \
  -d '{
    "newsletterId": "nl-123",
    "subject": "Monthly Newsletter",
    "html": "<h1>Newsletter</h1><p>Hello {{firstName}}</p>",
    "recipients": [
      {"email": "user@example.com", "firstName": "John", "contactId": "c-1"}
    ],
    "trackingEnabled": true
  }'
```

### Schedule Newsletter
```bash
curl -X POST http://localhost:3006/api/schedule-newsletter \
  -H "Content-Type: application/json" \
  -d '{
    "newsletterId": "nl-123",
    "subject": "Scheduled Newsletter",
    "html": "<h1>Newsletter</h1>",
    "recipients": [{"email": "user@example.com"}],
    "scheduledFor": "2024-12-25T10:00:00Z"
  }'
```

## Inngest Events

| Event | Description |
|-------|-------------|
| `email/send` | Send a single email |
| `email/send.bulk` | Send multiple emails in batch |
| `email/schedule` | Schedule email for future delivery |
| `newsletter/send` | Send newsletter to recipients |
| `newsletter/schedule` | Schedule newsletter for future delivery |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Your App      │────▶│  Inngest Server │────▶│  Email Server   │
│                 │     │  (localhost:8288)│     │  (localhost:3006)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │     Resend      │
                                                │   Email API     │
                                                └─────────────────┘
```

## Features

- **Automatic retries**: Failed emails are automatically retried
- **Rate limiting**: Built-in delays between batch emails
- **Scheduling**: Schedule emails for future delivery
- **Personalization**: Template variables like `{{firstName}}` in newsletters
- **Tracking**: Optional open tracking for newsletters
- **Batching**: Process large recipient lists in batches
