# Onboarding Feature Troubleshooting

## "Unexpected token DOCTYPE" Error

This error occurs when the API returns HTML instead of JSON. Here are the most common causes and solutions:

### 1. **Server Not Restarted** (Most Common)
The new endpoint won't be available until the server is restarted.

**Solution:**
```bash
# Stop your current server (Ctrl+C)
# Then restart it:
npm run dev
# or
npm run dev:server
```

### 2. **Wrong API Endpoint**
Check if the endpoint URL is correct.

**Expected:** `http://localhost:5000/api/company/complete-onboarding`

**To verify:**
```bash
# Check server logs for the mounted routes
# Look for: "app.use('/api/company', companyRoutes)"
```

### 3. **Authentication Issues**
The endpoint requires authentication. If auth fails, it might redirect to login (HTML page).

**To verify:**
- Open browser DevTools → Network tab
- Look at the response for the `/complete-onboarding` request
- Check if status code is 401 (Unauthorized) or 302 (Redirect)

### 4. **CORS or Proxy Issues**
If running frontend and backend on different ports without proper proxy setup.

**Check your setup:**
- Frontend: typically `http://localhost:5173` (Vite)
- Backend: typically `http://localhost:5000`
- Vite proxy should be configured in `vite.config.ts`

### 5. **Route Import Missing**
Verify the route is properly imported and registered.

**Verify in `server/routes.ts`:**
```typescript
import { companyRoutes } from "./routes/companyRoutes";
// ...
app.use("/api/company", companyRoutes);
```

## Debugging Steps

### Step 1: Check Server Logs
When you submit the onboarding form, watch your server console for:
```
📝 [Onboarding] Request body: { ... }
👤 [Onboarding] User: { ... }
🏢 [Onboarding] Found company: ...
```

If you don't see these logs, the request isn't reaching the endpoint.

### Step 2: Check Browser Network Tab
1. Open DevTools (F12)
2. Go to Network tab
3. Submit the onboarding form
4. Find the `complete-onboarding` request
5. Check:
   - **Request URL**: Should be `/api/company/complete-onboarding`
   - **Status Code**: Should be 200 (success) or 400/500 (error)
   - **Response**: Should be JSON, not HTML
   - **Response Headers**: `Content-Type` should be `application/json`

### Step 3: Test with cURL
Test the endpoint directly:

```bash
# First, get your session cookie from browser DevTools
# Application → Cookies → copy the auth cookie value

curl -X POST http://localhost:5000/api/company/complete-onboarding \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_TOKEN_HERE" \
  -d '{
    "geographicalLocation": "north-america",
    "language": "en",
    "businessDescription": "Test business with more than 10 characters"
  }' \
  -w "\nStatus: %{http_code}\n"
```

### Step 4: Check Database
Verify the columns exist:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'companies' 
AND column_name IN ('setup_completed', 'geographical_location', 'language', 'business_description');
```

### Step 5: Check Company Status
See if your company exists and needs onboarding:

```sql
SELECT id, name, setup_completed, geographical_location, language 
FROM companies 
ORDER BY created_at DESC 
LIMIT 5;
```

## Common Fixes

### Fix 1: Restart the Server
```bash
# Kill the running server
pkill -f "tsx server/index.ts"

# Start it again
npm run dev:server
```

### Fix 2: Clear Browser Cache
Sometimes the browser caches the old API routes:
- Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Or clear cache in DevTools → Network → "Disable cache" checkbox

### Fix 3: Check for TypeScript Errors
```bash
npm run check
```

If there are TypeScript errors in the route file, the server might not start properly.

### Fix 4: Verify Imports
Make sure these imports are present in the component:

```typescript
// In OnboardingWizard.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
```

## Still Having Issues?

### Check Server Port
Make sure the backend is running on the expected port:
```bash
# Check if port 5000 is in use
lsof -i :5000
```

### Check Environment Variables
Verify your `.env` file has correct values:
```env
DATABASE_URL=your_database_url
NODE_ENV=development
```

### Verbose Logging
Add more logging to see exactly what's happening:

In `OnboardingWizard.tsx`, before the fetch:
```typescript
console.log('Submitting onboarding:', formData);
console.log('Endpoint:', '/api/company/complete-onboarding');
```

### Check Network Tab Response
If you see HTML in the response:
1. Copy the HTML
2. Check if it's:
   - A 404 page (route not found)
   - A 500 error page (server error)
   - A login page (authentication failed)
   - An index.html (wrong route/proxy issue)

## Prevention

### Always Restart After Backend Changes
Backend changes (routes, controllers, middleware) require a server restart:
```bash
# Use nodemon or tsx watch for auto-restart
npm run dev:server
```

### Use TypeScript Strict Mode
Catch errors at compile time:
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true
  }
}
```

### Test Endpoints Separately
Test new endpoints with cURL or Postman before integrating with frontend.

## Quick Checklist

- [ ] Server is running (`npm run dev:server`)
- [ ] Server was restarted after adding the endpoint
- [ ] No TypeScript errors (`npm run check`)
- [ ] Database columns exist (check with SQL query)
- [ ] User is authenticated (check cookies in DevTools)
- [ ] Request URL is correct (check Network tab)
- [ ] Response is JSON, not HTML (check Network tab)
- [ ] Server logs show the request (check console)

## Need More Help?

If none of these solutions work:
1. Check server logs for any errors
2. Check browser console for any errors
3. Verify database connection is working
4. Try creating a new company and testing with that
5. Check if other API endpoints work (e.g., `/api/company`)
