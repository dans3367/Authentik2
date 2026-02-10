# Port Configuration Summary

## Current Port Mapping

| Port | Service | Description |
|------|---------|-------------|
| **5000** | **Express Server** | Main API server, authentication, proxy |
| 3004 | Form Server | Form serving service |
| 3502 | Server Node | Temporal client |
| **5004** | **Cardprocessor-Go** | Birthday cards & Unsubscribe handling |
| 50051 | Temporal Server | GRPC bridge |
| 3505 | Webhook Server | Webhook handling |

## Key Configuration Changes

### Express Server (Port 5000)
- **Environment Variable:** `PORT=5000`
- **Files Updated:**
  - `start.sh` - Sets `PORT=5000` and starts server on port 5000
  - `server/index.ts` - Default port changed to 5000
  - `server/auth.ts` - baseURL and trustedOrigins use port 5000

### Unsubscribe Proxy Flow
```
Customer Request
    ↓
https://yourdomain.com/api/unsubscribe/birthday?token=xxx
    ↓
Express Server (Port 5000)
    ↓ [Proxy]
Cardprocessor-Go (Port 5004)
    ↓
PostgreSQL Database
```

## Testing URLs

### Via Proxy (Production Path)
```bash
# Health check
curl http://localhost:5002/health

# Unsubscribe page
curl "http://localhost:5002/api/unsubscribe/birthday?token=YOUR_TOKEN"
```

### Direct Access (Development)
```bash
# Cardprocessor-go health
curl http://localhost:5004/health

# Direct unsubscribe access
curl "http://localhost:5004/api/unsubscribe/birthday?token=YOUR_TOKEN"
```

## Environment Variables

```bash
# Main Express Server
PORT=5000                      # Express server port
NODE_ENV=development          # Environment mode

# Other Services
FSERVER_PORT=3004             # Form server port
TEMPORAL_SERVER_PORT=50051    # Temporal server port
WEBHOOK_PORT=3505             # Webhook server port
CARDPROCESSOR_PORT=5004       # Cardprocessor-go port
```

## Starting Services

### All Services
```bash
./start.sh
```

This will start:
1. Main Server on port 5000
2. Form Server on port 3004
3. Server Node on port 3502
4. Temporal Server on port 50051
5. Webhook Server on port 3505
6. Cardprocessor-Go on port 5004

### Individual Services

#### Express Server Only
```bash
PORT=5000 NODE_ENV=development npx tsx server/index.ts
```

#### Cardprocessor-Go Only
```bash
cd cardprocessor-go
go run main.go
```

## Firewall / Security Notes

- **Port 5000** - Main entry point, should be exposed to internet
- **Port 5004** - Internal service, proxied through port 5000
- Other ports (3004, 3502, 3505, 50051) - Internal services

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Kill process on port 5004
lsof -ti:5004 | xargs kill -9
```

### Check What's Running
```bash
# Check all service ports
lsof -i :5000
lsof -i :3004
lsof -i :3502
lsof -i :5004
lsof -i :50051
lsof -i :3505
```

### Verify Services
```bash
# Express server
curl http://localhost:5002/health

# Cardprocessor-go
curl http://localhost:5004/health

# Form server
curl http://localhost:3004/health

# Server node
curl http://localhost:3502/health
```

## Production Deployment

In production, you'll typically:

1. **Expose port 5000** to the internet via load balancer
2. **Keep port 5004** internal (not exposed)
3. Set `BASE_URL` environment variable to your domain:
   ```bash
   BASE_URL=https://yourdomain.com
   ```

## Configuration Files Reference

### Port Definitions
- `start.sh` - Line 128: Main Server port 5000
- `start.sh` - Line 153: `export PORT=5000`
- `start.sh` - Line 167: Starts server with `PORT=5000`

### Server Configuration
- `server/index.ts` - Line 187: Default port 5000
- `server/auth.ts` - Line 38: baseURL with port 5000
- `server/auth.ts` - Line 41: trustedOrigins with port 5000

### Proxy Configuration
- `server/routes.ts` - Lines 193-253: Unsubscribe proxy to port 5004

## Migration History

- **Previous:** Express on port 3500
- **Current:** Express on port 5000
- **Reason:** Updated to match default server configuration

---

**Last Updated:** September 30, 2025  
**Configuration Version:** 2.0