import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { TemporalService } from './temporal/temporal-service';
import { authenticateRequest, type AuthenticatedRequest } from './middleware/auth';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3502;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5000'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Temporal service
let temporalService: TemporalService;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    temporal: temporalService?.isConnected() || false
  });
});

// Newsletter workflow endpoint - authenticated
app.post('/api/newsletter/send', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    if (!temporalService) {
      return res.status(503).json({ error: 'Temporal service not initialized' });
    }

    const { 
      newsletterId, 
      tenantId, 
      userId, 
      groupUUID, 
      subject, 
      content, 
      recipients, 
      metadata 
    } = req.body;

    // Verify the authenticated user matches the request
    if (req.user?.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Tenant mismatch' });
    }

    const workflowId = `newsletter-${newsletterId}-${Date.now()}`;
    
    const handle = await temporalService.startWorkflow('newsletterSendingWorkflow', workflowId, {
      newsletterId,
      tenantId,
      userId,
      groupUUID,
      subject,
      content,
      recipients,
      metadata
    });
    
    res.json({ 
      success: true, 
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
      newsletterId,
      groupUUID
    });
  } catch (error) {
    console.error('Error starting newsletter workflow:', error);
    res.status(500).json({ error: 'Failed to start newsletter workflow', details: error.message });
  }
});

// Generic workflow endpoint for other workflows
app.post('/workflows/:workflowType', async (req, res) => {
  try {
    if (!temporalService) {
      return res.status(503).json({ error: 'Temporal service not initialized' });
    }

    const { workflowType } = req.params;
    const { workflowId, input } = req.body;

    const handle = await temporalService.startWorkflow(workflowType, workflowId, input);
    
    res.json({ 
      success: true, 
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId
    });
  } catch (error) {
    console.error('Error starting workflow:', error);
    res.status(500).json({ error: 'Failed to start workflow', details: error.message });
  }
});

app.get('/workflows/:workflowId', async (req, res) => {
  try {
    if (!temporalService) {
      return res.status(503).json({ error: 'Temporal service not initialized' });
    }

    const { workflowId } = req.params;
    const result = await temporalService.getWorkflowResult(workflowId);
    
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error getting workflow result:', error);
    res.status(500).json({ error: 'Failed to get workflow result', details: error.message });
  }
});

// Start server
async function startServer() {
  try {
    // Initialize Temporal service
    console.log('Initializing Temporal service...');
    temporalService = new TemporalService();
    await temporalService.connect();
    console.log('Temporal service connected successfully');

    // Start Express server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on 0.0.0.0:${PORT}`);
      console.log(`📋 Health check: http://0.0.0.0:${PORT}/health`);
      console.log(`🌐 External access: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  
  if (temporalService) {
    await temporalService.disconnect();
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  
  if (temporalService) {
    await temporalService.disconnect();
  }
  
  process.exit(0);
});

startServer().catch(console.error);
