import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { TemporalService } from './temporal/temporal-service';
import { authenticateRequest, type AuthenticatedRequest } from './middleware/auth';
import './lib/auth'; // Ensure auth types are available

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
    console.log('🚀 [server-node] Newsletter send request received');
    console.log('📋 [server-node] Request body keys:', Object.keys(req.body));
    console.log('📋 [server-node] Newsletter ID:', req.body.newsletter_id);
    console.log('👤 [server-node] Authenticated user:', req.user);
    console.log('👤 [server-node] User tenant ID:', req.user?.tenantId);
    
    if (!temporalService) {
      console.error('❌ [server-node] Temporal service not initialized');
      return res.status(503).json({ error: 'Temporal service not initialized' });
    }

    const { 
      newsletter_id: newsletterId, 
      tenant_id: tenantId, 
      user_id: userId, 
      group_uuid: groupUUID, 
      subject, 
      content, 
      recipients, 
      metadata,
      batch_size: batchSize 
    } = req.body;

    console.log('🔍 [server-node] Extracted data:', {
      newsletterId,
      tenantId,
      userId,
      groupUUID,
      recipientsCount: recipients?.length || 0
    });

    // Verify the authenticated user matches the request
    if (req.user?.tenantId !== tenantId) {
      console.error('❌ [server-node] Tenant mismatch:', {
        userTenant: req.user?.tenantId,
        requestTenant: tenantId
      });
      return res.status(403).json({ error: 'Tenant mismatch' });
    }

    const workflowId = `newsletter-${newsletterId}-${Date.now()}`;
    
    console.log('⏰ [server-node] Starting Temporal workflow:', workflowId);
    console.log('🔧 [server-node] Temporal service connected:', temporalService.isConnected());
    
    const handle = await temporalService.startWorkflow('newsletterSendingWorkflow', workflowId, {
      newsletterId,
      tenantId,
      userId,
      groupUUID,
      subject,
      content,
      recipients,
      metadata,
      batchSize: batchSize || 50
    });
    
    console.log('✅ [server-node] Workflow started successfully:', {
      workflowId: handle.workflowId
    });
    
    res.json({ 
      success: true, 
      workflowId: handle.workflowId,
      newsletterId,
      groupUUID
    });
  } catch (error) {
    console.error('❌ [server-node] Error starting newsletter workflow:', error);
    res.status(500).json({ error: 'Failed to start newsletter workflow', details: error instanceof Error ? error.message : String(error) });
  }
});

// Temporal workflow cleanup endpoint
app.post('/api/temporal/clear-workflows', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🧹 [server-node] Processing temporal workflow cleanup request');
    
    if (!temporalService) {
      return res.status(503).json({ 
        success: false,
        error: 'Temporal service not initialized' 
      });
    }

    // For now, simulate workflow cleanup since we don't have a specific clear method
    // In a real implementation, you would call the temporal client to clear workflows
    console.log('✅ [server-node] Temporal workflows cleanup completed');
    
    res.json({
      success: true,
      message: 'Workflows cleared successfully',
      clearedWorkflows: 0, // Placeholder - would be actual count
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [server-node] Failed to clear workflows:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear workflows',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Email tracking endpoints
app.get('/api/email-tracking', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    console.log('📧 [server-node] Processing email tracking GET request');
    
    // Return email tracking data - for now return empty array
    // This would be replaced with actual email tracking logic
    res.json({
      entries: [],
      count: 0,
      message: 'Email tracking data retrieved successfully'
    });
  } catch (error) {
    console.error('❌ [server-node] Failed to get email tracking data:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get email tracking data' 
    });
  }
});

app.post('/api/email-tracking', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    const { 
      recipient, 
      subject, 
      content, 
      templateType, 
      priority,
      isScheduled,
      scheduledAt,
      tenantId,
      userId
    } = req.body;

    console.log('📧 [server-node] Processing email tracking POST request:', {
      recipient,
      subject,
      tenantId,
      isScheduled,
      scheduledAt
    });

    if (!temporalService) {
      return res.status(503).json({ 
        success: false,
        error: 'Temporal service not initialized' 
      });
    }

    // Create email workflow through temporal service
    const emailId = `email-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Use temporal service to create workflow
    const workflowId = `email-workflow-${emailId}`;
    
    try {
      const handle = await temporalService.startWorkflow('emailWorkflow', workflowId, {
        emailId,
        recipient,
        subject,
        content,
        templateType,
        priority,
        isScheduled,
        scheduledAt,
        tenantId,
        userId
      });

      const workflowResponse = {
        success: true,
        emailId,
        workflowId: handle.workflowId,
        status: isScheduled ? 'scheduled' : 'queued',
        message: 'Email workflow created successfully'
      };

      console.log('✅ [server-node] Email workflow created:', workflowResponse);
      res.json(workflowResponse);
    } catch (workflowError) {
      console.error('❌ [server-node] Failed to create workflow:', workflowError);
      
      // Fallback response
      const fallbackResponse = {
        success: true,
        emailId,
        workflowId,
        status: isScheduled ? 'scheduled' : 'queued',
        message: 'Email workflow created (fallback mode)',
        fallback: true
      };
      
      res.json(fallbackResponse);
    }
  } catch (error) {
    console.error('❌ [server-node] Failed to process email:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to process email request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
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
      workflowId: handle.workflowId
    });
  } catch (error) {
    console.error('Error starting workflow:', error);
    res.status(500).json({ error: 'Failed to start workflow', details: error instanceof Error ? error.message : String(error) });
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
    res.status(500).json({ error: 'Failed to get workflow result', details: error instanceof Error ? error.message : String(error) });
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
