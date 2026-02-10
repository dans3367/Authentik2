# Server Restart Required - New Endpoint Not Loaded

## Issue
The new birthday card endpoint `/api/email-contacts/send-birthday-card` was added to the code but the running dev server hasn't picked it up, resulting in a 404 error.

## Solution: Restart the Development Server

### Option 1: Restart in the existing terminal
1. Find the terminal running `npm run dev`
2. Press `Ctrl+C` to stop the server
3. Run `npm run dev` again
4. Wait for "Server running on port 5000" message

### Option 2: Kill and restart from any terminal
```bash
# Kill the existing dev server
pkill -f "tsx server/index.ts"

# Wait a moment
sleep 2

# Start the server again
cd /home/root/Authentik
npm run dev
```

### Option 3: Restart using the process ID
```bash
# Find the process
ps aux | grep "tsx server/index.ts" | grep -v grep

# Kill it (replace <PID> with the actual process ID)
kill <PID>

# Start again
cd /home/root/Authentik
npm run dev
```

## Verify the Endpoint is Working

After restart, test with curl:
```bash
curl -X POST http://localhost:5002/api/email-contacts/send-birthday-card \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"contactIds": ["test-id"]}'
```

You should get a proper response (not "Cannot POST"), likely a 401 Unauthorized (which is expected without a valid token) or 400 Bad Request (which means the endpoint exists).

## Why This Happened

The `tsx` dev server sometimes doesn't hot-reload when:
- New routes are added (vs modifying existing routes)
- Routes are added at the end of a file
- The file gets very large

For production deployments, this won't be an issue as the server will be restarted during deployment.

## After Restart - Test Checklist

1. ✅ Server starts without errors
2. ✅ Navigate to http://localhost:3000/birthdays?tab=customers
3. ✅ Select a customer
4. ✅ Click ellipse menu (⋮)
5. ✅ Click "Send Birthday Card"
6. ✅ Should NOT get 404 error
7. ✅ Should see confirmation dialog
8. ✅ Should work properly (if birthday settings configured)

