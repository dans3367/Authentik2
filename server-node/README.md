# Authentik Temporal Service

A Node.js backend service that integrates with Temporal.io for workflow orchestration. This service runs on port 5003 and connects to a Temporal server.

## Features

- Express.js REST API server
- Temporal client integration
- TypeScript support
- Example workflows and activities
- Health check endpoint
- Graceful shutdown handling

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```

3. **Environment Variables:**
   ```
   PORT=5003
   TEMPORAL_SERVER_URL=100.125.36.104:7233
   TEMPORAL_NAMESPACE=default
   TEMPORAL_TASK_QUEUE=authentik-tasks
   ```

## Development

Start the development server with hot reload:
```bash
npm run dev
```

## Production

Build and start the production server:
```bash
npm run build
npm start
```

## API Endpoints

### Health Check
```
GET /health
```
Returns server and Temporal connection status.

### Start Workflow
```
POST /workflows/:workflowType
Content-Type: application/json

{
  "workflowId": "unique-workflow-id",
  "input": {
    "data": "example data",
    "userId": "user123"
  }
}
```

### Get Workflow Result
```
GET /workflows/:workflowId
```

## Temporal Components

### Workflows
Located in `src/temporal/workflows/`:
- `example-workflow.ts` - Sample workflow demonstrating basic functionality

### Activities
Located in `src/temporal/activities/`:
- `example-activities.ts` - Sample activities for data processing and notifications

### Worker
The Temporal worker can be started separately:
```bash
npx tsx src/temporal/worker.ts
```

## Example Usage

1. Start the server:
   ```bash
   npm run dev
   ```

2. Check health:
   ```bash
   curl http://localhost:5003/health
   ```

3. Start a workflow:
   ```bash
   curl -X POST http://localhost:5003/workflows/exampleWorkflow \
     -H "Content-Type: application/json" \
     -d '{
       "workflowId": "test-workflow-1",
       "input": {
         "data": "hello world",
         "userId": "user123"
       }
     }'
   ```

4. Get workflow result:
   ```bash
   curl http://localhost:5003/workflows/test-workflow-1
   ```

## Architecture

```
server-node/
├── src/
│   ├── index.ts                    # Main Express server
│   └── temporal/
│       ├── temporal-service.ts     # Temporal client wrapper
│       ├── worker.ts              # Temporal worker
│       ├── workflows/             # Workflow definitions
│       └── activities/            # Activity functions
├── package.json
├── tsconfig.json
└── README.md
```

## Notes

- The service connects to Temporal at `100.125.36.104:7233`
- Default namespace is `default`
- Default task queue is `authentik-tasks`
- All configuration is done via environment variables
- The server includes graceful shutdown handling
