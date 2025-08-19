# Form Server Setup Guide

The form server is a standalone frontend application that serves forms to customers without requiring authentication. It's completely separate from the main application and only accesses forms by UUID from the database.

## Architecture

```
Main Application (Port 5000)  ←→  Database
Form Server API (Port 3001)   ←→  Database (forms only)
Form Server UI (Port 3002)    ←→  Form Server API
```

## Quick Start Options

### Option 1: Start Everything Together
```bash
./start-all-servers.sh
```
This starts:
- Main application on port 5000
- Form server API on port 3001
- Form server frontend on port 3002

### Option 2: Form Server Only
```bash
./start-forms-only.sh
```
This starts only:
- Form server API on port 3001
- Form server frontend on port 3002

### Option 3: Default (Main App Only)
```bash
npm run dev
```
Or use the Replit "Run" button - starts only main application on port 5000

## Manual Development

### Form Server Development
```bash
cd fserver

# Start both API and frontend
npm run dev

# Or start individually
npm run dev:server  # API only on port 3001
npm run dev:client  # Frontend only on port 3002
```

## Accessing Forms

Once the form server is running, access forms at:
```
http://localhost:3002/form/[FORM_UUID]
```

Example with existing form:
```
http://localhost:3002/form/dc1ebca2-8aeb-4057-ab32-4b4ce248eb04
```

## API Endpoints

- `GET /api/forms/:uuid` - Retrieve form data
- `POST /api/forms/:uuid/submit` - Submit form response

## Features

- **Public Access**: No authentication required
- **Security**: Rate limiting, CORS protection, IP tracking
- **Responsive**: Mobile-friendly form rendering
- **Error Handling**: Comprehensive error states
- **Theme Support**: Uses form's configured theme
- **Submission Tracking**: Stores responses with metadata

## Replit Compatibility

The form server is configured to work with Replit's dynamic hostnames using `allowedHosts: 'all'` in the Vite configuration.