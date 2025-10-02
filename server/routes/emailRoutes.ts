import { Router } from 'express';
import { enhancedEmailService } from '../emailService';

export const emailRoutes = Router();

// Email system status endpoint
emailRoutes.get('/status', async (req, res) => {
  try {
    const status = enhancedEmailService.getStatus();
    const healthCheck = await enhancedEmailService.healthCheck();
    
    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      health: healthCheck,
      details: status
    });
  } catch (error) {
    console.error('[EmailRoutes] Status check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Queue status endpoint
emailRoutes.get('/queue/status', async (req, res) => {
  try {
    const queueStatus = enhancedEmailService.getQueueStatus();
    const statistics = enhancedEmailService.getStatus().queue;
    
    res.json({
      status: queueStatus,
      statistics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EmailRoutes] Queue status check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get specific email status
emailRoutes.get('/status/:emailId', async (req, res) => {
  try {
    const { emailId } = req.params;
    const emailStatus = enhancedEmailService.getEmailStatus(emailId);
    
    if (!emailStatus) {
      return res.status(404).json({
        status: 'not_found',
        message: 'Email not found in queue',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      email: emailStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EmailRoutes] Email status check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send custom email endpoint (for testing)
emailRoutes.post('/send', async (req, res) => {
  try {
    const { 
      to, 
      subject, 
      html, 
      text, 
      preferredProvider, 
      useQueue, 
      metadata, 
      fromEmail,
      tenantId,
      tenantName 
    } = req.body;
    
    if (!to || !subject || !html) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: to, subject, html',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await enhancedEmailService.sendCustomEmail(
      to,
      subject,
      html,
      {
        text,
        from: fromEmail,
        preferredProvider,
        useQueue: useQueue || false,
        metadata: {
          source: 'api',
          requestId: req.get('x-request-id') || 'unknown',
          tenantId,
          tenantName,
          ...(metadata || {})
        }
      }
    );
    
    res.json({
      status: 'success',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EmailRoutes] Send email failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Batch email sending endpoint
emailRoutes.post('/send/batch', async (req, res) => {
  try {
    const { emails, options = {} } = req.body;
    
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'emails must be a non-empty array',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate each email object
    for (const email of emails) {
      if (!email.to || !email.subject || !email.html) {
        return res.status(400).json({
          status: 'error',
          message: 'Each email must have to, subject, and html fields',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    const result = await enhancedEmailService.sendBatchEmails(emails, options);
    
    res.json({
      status: 'success',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EmailRoutes] Batch send failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cleanup old emails
emailRoutes.post('/cleanup', async (req, res) => {
  try {
    const { olderThanHours = 24 } = req.body;
    
    enhancedEmailService.cleanupOldEmails(olderThanHours);
    
    res.json({
      status: 'success',
      message: `Cleanup initiated for emails older than ${olderThanHours} hours`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EmailRoutes] Cleanup failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint
emailRoutes.get('/health', async (req, res) => {
  try {
    const health = await enhancedEmailService.healthCheck();
    const isHealthy = health.healthy;
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      providers: health.providers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EmailRoutes] Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Provider configuration endpoints (for admin use)
emailRoutes.get('/providers', async (req, res) => {
  try {
    const status = enhancedEmailService.getStatus();
    
    res.json({
      providers: status.providers,
      summary: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EmailRoutes] Provider list failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});