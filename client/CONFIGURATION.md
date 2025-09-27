# Frontend Configuration

## Environment Variables

The frontend uses the following environment variables for configuration:

### Cardprocessor Service
- `VITE_CARDPROCESSOR_URL`: URL for the birthday card processor service
  - Default: `http://localhost:5003`
  - Used for: Birthday test card API calls

### Better Auth Service
- `VITE_BETTER_AUTH_URL`: URL for the authentication service
  - Default: empty (uses relative URLs)
  - Used for: Authentication API calls

## API Endpoints

### Birthday Test Cards
- **Endpoint**: `POST /api/birthday-test`
- **Service**: Cardprocessor (port 5003)
- **Purpose**: Send test birthday cards using Temporal workflows

### Birthday Invitations
- **Endpoint**: `POST /api/birthday-invitation`
- **Service**: Main server (port 3502)
- **Purpose**: Send birthday invitation emails

## Setup

1. Create a `.env` file in the client directory
2. Add the required environment variables:

```bash
# Cardprocessor service
VITE_CARDPROCESSOR_URL=http://localhost:5003

# Better Auth service (if needed)
VITE_BETTER_AUTH_URL=
```

## Development

The frontend will automatically use the configured URLs for API calls. If no environment variables are set, it will use the default localhost URLs.

