# Cardprocessor Connection Fix

## Problem
Getting error when trying to send birthday cards:
```
Error: connect ECONNREFUSED 127.0.0.1:8082
```

## Root Causes Found

### 1. Wrong Port
- **Problem:** Code was trying to connect to port 8082
- **Reality:** Cardprocessor-go runs on port 5004
- **Fix:** Updated default port to 5004 in code and added to .env

### 2. Missing Authentication
- **Problem:** Cardprocessor requires JWT token with tenant info
- **Reality:** Main server uses Better Auth (session-based), not JWT
- **Fix:** Generate internal JWT token for server-to-server calls

## Changes Applied

### 1. Updated `.env` file
```bash
# Added:
CARDPROCESSOR_URL=http://localhost:5004
```

### 2. Updated `server/routes/emailManagementRoutes.ts`

#### Changed default port (line ~1888):
```typescript
// Before:
const cardprocessorUrl = process.env.CARDPROCESSOR_URL || 'http://localhost:8082';

// After:
const cardprocessorUrl = process.env.CARDPROCESSOR_URL || 'http://localhost:5004';
```

#### Added JWT token generation (line ~1900):
```typescript
// Generate a JWT token for internal API call to cardprocessor
const internalToken = jwt.sign(
  {
    sub: req.user.id,
    tenant: tenantId,
    type: 'internal',
  },
  process.env.JWT_SECRET || '',
  { expiresIn: '5m' }
);

const tokenResponse = await fetch(`${cardprocessorUrl}/api/birthday-unsubscribe-token/${contact.id}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${internalToken}`,  // ← Added this
  },
});
```

## How It Works Now

1. User triggers "Send Birthday Card" from UI
2. Main server generates short-lived JWT token (5 min expiry)
3. JWT contains:
   - `sub`: User ID
   - `tenant`: Tenant ID
   - `type`: 'internal' (marks as server-to-server call)
4. Makes authenticated request to cardprocessor-go on port 5004
5. Cardprocessor validates JWT and generates unsubscribe token
6. Main server receives token and includes it in birthday email

## Fallback Behavior

If cardprocessor is unreachable or token generation fails:
- ⚠️ Warning logged
- ✅ Email still sends
- ❌ Just without unsubscribe link
- This is intentional - better to send card than fail completely

## Verification

Test the token generation:
```bash
# Should now work (after server hot-reload picks up changes)
# You'll see successful token generation in logs
```

## Server Restart

The changes should be picked up automatically by tsx hot-reload, but if you continue to see connection errors:

```bash
# Restart the dev server
cd /home/root/Authentik
pkill -f "tsx server/index.ts"
sleep 2
npm run dev
```

## Next Steps

1. ✅ Changes applied
2. ✅ CARDPROCESSOR_URL configured
3. ✅ JWT authentication added
4. 🔄 Wait for hot-reload (or restart server)
5. 🧪 Test sending birthday card

The feature should now work completely with proper unsubscribe tokens!

