# Form Server - Single Server Architecture

## Overview

The Form Server now uses a **single-server architecture** similar to the main `/server` directory, where both the API and frontend are served from one Express server instance.

## Architecture Changes (August 10, 2025)

Successfully migrated from a dual-server setup to a single-server architecture:

### Before:
- **Backend**: Express server on port 3001 (`index.ts`)
- **Frontend**: Vite dev server on port 3004
- **Coordination**: `start.sh` script to run both servers
- **API calls**: Hardcoded to `http://localhost:3004`

### After:
- **Single Server**: Express server on port 3001
- **Frontend Integration**: Served via middleware in development
- **API Routing**: Same server handles `/api/*` routes
- **Frontend Routing**: Same server serves HTML for all other routes
- **API calls**: Relative paths (e.g., `/api/forms/123`)

## Key Files Modified

### Core Architecture:
- **`index.ts`**: Updated to use single-server pattern with Vite integration
- **`vite.ts`**: Created middleware to serve frontend and handle routing
- **`src/components/FormView.tsx`**: Updated API calls to use relative paths
- **`package.json`**: Simplified scripts to run single server

### Removed:
- **`start.sh`**: No longer needed with single-server setup

## Running the Server

```bash
# Development
cd fserver
npm run dev

# Production (after build)
npm run build
npm start
```

## Testing

### API Endpoint Test:
```bash
curl http://localhost:3004/api/forms/test
# Returns: {"error":"Form not found or inactive"}
```

### Frontend Test:
```bash
curl http://localhost:3004/
# Returns: HTML template
```

## Benefits

1. **Simplified Development**: Single command to start everything
2. **No CORS Issues**: Frontend and API on same origin
3. **Unified Port**: Everything accessible from port 3001
4. **Production Ready**: Same architecture in dev and production
5. **Resource Efficient**: One server process instead of two

## Architecture Alignment

This change aligns the Form Server with the main application's architecture pattern in `/server`, ensuring consistency across the codebase.