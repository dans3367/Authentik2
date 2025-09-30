# Unsubscribe Server

A dedicated Go-based HTTP server for handling birthday card email unsubscribe requests.

## Overview

The unsubscribe server is a standalone service running on **port 7070** that provides a customer-facing interface for users to unsubscribe from birthday card emails. It is proxied through the main Express server to provide seamless access.

## Architecture

```
Client Request
    ↓
Express Server (Port 3500)
    ↓ (Proxy)
Unsubscribe Server (Port 7070)
    ↓
Database (PostgreSQL)
```

## Features

- ✅ **Token-based validation** - Secure unsubscribe links using unique tokens
- ✅ **Customer-facing HTML pages** - Professional unsubscribe interface
- ✅ **Database integration** - Updates contact preferences in real-time
- ✅ **Reason tracking** - Collects optional feedback on why users unsubscribe
- ✅ **No authentication required** - Public access for customer convenience
- ✅ **Graceful error handling** - User-friendly error pages

## Endpoints

### GET `/api/unsubscribe/birthday?token={token}`
Display the unsubscribe confirmation page.

**Query Parameters:**
- `token` (required): Unique unsubscribe token

**Response:** HTML page with unsubscribe form

### POST `/api/unsubscribe/birthday`
Process the unsubscribe request.

**Form Data:**
- `token` (required): Unsubscribe token
- `reason` (optional): Reason for unsubscribing
- `feedback` (optional): Additional feedback

**Response:** HTML success or error page

### GET `/health`
Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "ok",
  "service": "unsubscribe-server",
  "version": "1.0.0",
  "port": "7070"
}
```

## Running the Server

### Standalone Mode

```bash
cd cardprocessor-go
go run unsubscribe-server.go
```

The server will start on port 7070.

### With Full Stack

Use the provided start script which automatically starts all services:

```bash
./start.sh
```

This will start:
1. Main Server (port 3500) - with proxy to unsubscribe server
2. Unsubscribe Server (port 7070)
3. Other services...

## Database Schema

The server uses the following database tables:

### `birthday_unsubscribe_tokens`
Stores unique tokens for unsubscribe links.

```sql
CREATE TABLE birthday_unsubscribe_tokens (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    contact_id VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (contact_id) REFERENCES email_contacts(id)
);
```

### `email_contacts`
Updated fields:
- `birthday_unsubscribe_reason` - Reason for unsubscribing
- `birthday_unsubscribed_at` - Timestamp of unsubscribe
- `birthday_email_enabled` - Set to false when unsubscribed

## Configuration

The server uses the same configuration as the main cardprocessor-go service:

```env
DATABASE_URL=postgres://...
JWT_SECRET=your-secret-key
PORT=7070  # Default port for unsubscribe server
```

## HTML Templates

The server uses three HTML templates located in `cardprocessor-go/templates/`:

1. **unsubscribe.html** - Main unsubscribe form page
2. **unsubscribe_success.html** - Success confirmation page
3. **unsubscribe_error.html** - Error page with helpful troubleshooting

All templates are styled with inline CSS for consistent rendering across email clients and browsers.

## Proxy Configuration

The Express server (port 3500) proxies unsubscribe requests to this server:

```typescript
// In server/routes.ts
app.get("/api/unsubscribe/birthday", async (req, res) => {
  // Forward to http://localhost:7070/api/unsubscribe/birthday
});

app.post("/api/unsubscribe/birthday", async (req, res) => {
  // Forward to http://localhost:7070/api/unsubscribe/birthday
});
```

This allows customers to use the main domain URL for unsubscribing:
```
https://yourdomain.com/api/unsubscribe/birthday?token=abc123...
```

## Security Considerations

- ✅ Tokens are cryptographically secure (32-byte random)
- ✅ Tokens can only be used once
- ✅ No authentication required (by design for customer convenience)
- ✅ All database queries use parameterized statements
- ✅ CORS enabled for cross-origin access
- ✅ Rate limiting handled by the Express proxy layer

## Monitoring

Check server health:

```bash
curl http://localhost:7070/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "unsubscribe-server",
  "version": "1.0.0",
  "port": "7070"
}
```

## Development

### Building

```bash
cd cardprocessor-go
go build -o bin/unsubscribe-server unsubscribe-server.go
```

### Testing

Test the unsubscribe flow:

1. Generate a token (via the main API)
2. Visit: `http://localhost:7070/api/unsubscribe/birthday?token={token}`
3. Submit the form
4. Verify the contact is marked as unsubscribed in the database

## Troubleshooting

### Port 7070 already in use
```bash
lsof -ti:7070 | xargs kill -9
```

### Cannot connect to database
- Check `DATABASE_URL` environment variable
- Ensure PostgreSQL is running
- Verify database credentials

### Templates not loading
- Ensure you're running from the project root
- Check that `cardprocessor-go/templates/*.html` files exist
- Template path is relative to the working directory

## Integration with Email System

When sending birthday card emails, include the unsubscribe link:

```go
unsubscribeURL := fmt.Sprintf(
    "https://yourdomain.com/api/unsubscribe/birthday?token=%s",
    token,
)
```

The token should be generated using the `GenerateBirthdayUnsubscribeToken` handler in the main cardprocessor-go API.

## Future Enhancements

- [ ] Add analytics tracking for unsubscribe reasons
- [ ] Implement re-subscribe functionality
- [ ] Add multi-language support
- [ ] Email confirmation after unsubscribe
- [ ] Admin dashboard for viewing unsubscribe statistics