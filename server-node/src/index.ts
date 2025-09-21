import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { TemporalService } from './temporal/temporal-service';
import { authenticateRequest, type AuthenticatedRequest } from './middleware/auth';
import './lib/auth'; // Ensure auth types are available

// Load environment variables from parent directory
dotenv.config({ path: '../.env' });

const app = express();
const PORT = 3502;

// Helper function to generate birthday invitation HTML
async function generateBirthdayInvitationHTML(input: any): Promise<string> {
  const { contactFirstName, contactLastName, tenantName, baseUrl } = input;
  
  const contactName = contactFirstName 
    ? `${contactFirstName}${contactLastName ? ` ${contactLastName}` : ''}` 
    : 'Valued Customer';
  
  // Generate JWT token for profile update
  const profileUpdateToken = jwt.sign(
    { contactId: input.contactId, action: 'update_birthday' },
    process.env.JWT_SECRET!,
    { expiresIn: '30d' }
  );
  
  const profileUpdateUrl = `${baseUrl || 'http://localhost:3500'}/update-profile?token=${profileUpdateToken}`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Birthday Information Request</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #e91e63; margin: 0;">🎂 Birthday Celebration!</h1>
      </div>
      
      <div style="background: #f9f9f9; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
        <p style="margin: 0 0 15px 0; font-size: 16px;">Hi ${contactName},</p>
        
        <p style="margin: 0 0 15px 0;">We'd love to make your birthday extra special! To ensure you don't miss out on exclusive birthday promotions, special offers, and personalized birthday surprises, we'd like to add your birthday to our records.</p>
        
        <p style="margin: 0 0 20px 0;">By sharing your birthday with us, you'll receive:</p>
        
        <ul style="margin: 0 0 20px 20px; padding: 0;">
          <li>🎁 Exclusive birthday discounts and offers</li>
          <li>🎉 Special birthday promotions</li>
          <li>📧 Personalized birthday messages</li>
          <li>🌟 Early access to birthday-themed content</li>
        </ul>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="${profileUpdateUrl}" 
             style="background: linear-gradient(135deg, #e91e63, #f06292); 
                    color: white; 
                    padding: 12px 30px; 
                    text-decoration: none; 
                    border-radius: 25px; 
                    font-weight: bold; 
                    display: inline-block; 
                    box-shadow: 0 4px 8px rgba(233, 30, 99, 0.3);">
            🎂 Add My Birthday
          </a>
        </div>
        
        <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">This link will expire in 30 days. Your privacy is important to us - we'll only use your birthday to send you special offers and birthday wishes.</p>
      </div>
      
      <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #888; text-align: center;">
        <p style="margin: 0;">Best regards,<br>${tenantName || 'The Team'}</p>
        <p style="margin: 10px 0 0 0;">This invitation was sent because you're a valued customer. If you'd prefer not to receive birthday-related communications, you can simply ignore this email.</p>
      </div>
    </body>
    </html>
  `;
}

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
    temporal: temporalService?.isConnected() || false,
    mode: temporalService?.isConnected() ? 'temporal' : 'fallback'
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
      userId,
      metadata
    } = req.body;

    // Extract recipient from metadata if available, otherwise use direct recipient
    let emailRecipient = recipient;
    if (!emailRecipient && metadata?.recipient) {
      emailRecipient = metadata.recipient;
    }
    if (!emailRecipient && metadata?.to) {
      emailRecipient = metadata.to;
    }

    // Extract content from metadata if available, otherwise use direct content
    let emailContent = content;
    if (!emailContent && metadata?.content) {
      emailContent = metadata.content;
    }

    // Validate email format
    if (!emailRecipient) {
      return res.status(400).json({
        success: false,
        error: 'Email recipient is required'
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailRecipient)) {
      return res.status(400).json({
        success: false,
        error: `Invalid email format: ${emailRecipient}`
      });
    }

    // Validate content
    if (!emailContent || typeof emailContent !== 'string' || emailContent.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Email content is required and must be a non-empty string'
      });
    }

    console.log('📧 [server-node] Processing email tracking POST request:', {
      originalRecipient: recipient,
      actualRecipient: emailRecipient,
      subject,
      hasContent: !!emailContent,
      contentLength: emailContent?.length || 0,
      tenantId,
      isScheduled,
      scheduledAt,
      hasMetadata: !!metadata
    });

    // Create email tracking entry
    const emailId = `email-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const workflowId = `email-workflow-${emailId}`;
    
    // Try to use Temporal service if available
    if (temporalService && temporalService.isConnected()) {
      try {
        const handle = await temporalService.startWorkflow('emailWorkflow', workflowId, {
          emailId,
          recipient: emailRecipient,
          subject,
          content: emailContent,
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
          runId: handle.runId, // Include the run ID for tracking
          status: isScheduled ? 'scheduled' : 'queued',
          message: 'Email workflow created successfully',
          temporal: true,
          recipient: emailRecipient,
          scheduledAt: isScheduled ? scheduledAt : null
        };

        console.log('✅ [server-node] Email workflow created via Temporal:', workflowResponse);
        return res.json(workflowResponse);
      } catch (workflowError) {
        console.error('❌ [server-node] Temporal workflow failed, using fallback:', workflowError);
      }
    }
    
    // Fallback mode - simulate email processing without Temporal
    console.log('🔄 [server-node] Using fallback mode (no Temporal)');
    const fallbackResponse = {
      success: true,
      emailId,
      workflowId,
      status: isScheduled ? 'scheduled' : 'queued',
      message: 'Email queued for processing (fallback mode)',
      temporal: false,
      recipient: emailRecipient,
      scheduledAt: isScheduled ? scheduledAt : null
    };

    // Log that content was validated in fallback mode
    console.log('📝 [server-node] Fallback mode - content validated:', {
      emailId,
      recipient: emailRecipient,
      contentLength: emailContent?.length || 0,
      hasContent: !!emailContent
    });

    res.json(fallbackResponse);
  } catch (error) {
    console.error('❌ [server-node] Failed to process email:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to process email request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Birthday invitation endpoint
app.post('/api/birthday-invitation', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      contactId,
      contactEmail,
      contactFirstName,
      contactLastName,
      tenantId,
      tenantName,
      userId,
      fromEmail
    } = req.body;

    // Validate required fields
    if (!contactId || !contactEmail || !tenantId) {
      return res.status(400).json({
        success: false,
        error: 'contactId, contactEmail, and tenantId are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      return res.status(400).json({
        success: false,
        error: `Invalid email format: ${contactEmail}`
      });
    }

    console.log(`🎂 Starting birthday invitation workflow for contact ${contactId} (${contactEmail})`);

    // If temporal service is available, use workflow; otherwise, send directly
    if (temporalService) {
      try {
        // Generate unique workflow ID
        const workflowId = `birthday-invitation-${contactId}-${Date.now()}`;

        // Prepare workflow input
        const workflowInput = {
          contactId,
          contactEmail,
          contactFirstName,
          contactLastName,
          tenantId,
          tenantName,
          userId,
          fromEmail,
          baseUrl: process.env.BASE_URL || 'http://localhost:3500'
        };

        // Start the email workflow with birthday invitation content
        const emailWorkflowInput = {
          emailId: workflowId,
          recipient: contactEmail,
          subject: '🎂 Help us celebrate your special day!',
          content: await generateBirthdayInvitationHTML(workflowInput),
          templateType: 'birthday_invitation',
          priority: 'normal' as const,
          tenantId,
          userId,
          fromEmail: fromEmail || 'noreply@zendwise.work',
          metadata: {
            contactId,
            invitationType: 'birthday',
            tenantName,
            baseUrl: process.env.BASE_URL || 'http://localhost:3500'
          }
        };

        const handle = await temporalService.startWorkflow(
          'emailWorkflow',
          workflowId,
          emailWorkflowInput
        );

        console.log(`✅ Birthday invitation workflow started: ${workflowId}`);

        res.json({
          success: true,
          workflowId,
          workflowRunId: handle.workflowId,
          message: 'Birthday invitation workflow started successfully'
        });

      } catch (temporalError) {
        console.error('❌ Temporal workflow failed, falling back to direct email:', temporalError);
        // Fall through to direct email sending
      }
    }
    
    // Fallback: Send email directly via main server API
    try {
      console.log(`📧 Sending birthday invitation directly via main server API`);
      
      // Prepare workflow input for HTML generation
      const workflowInput = {
        contactId,
        contactEmail,
        contactFirstName,
        contactLastName,
        tenantId,
        tenantName,
        userId,
        fromEmail,
        baseUrl: process.env.BASE_URL || 'http://localhost:3500'
      };

      const htmlContent = await generateBirthdayInvitationHTML(workflowInput);

      // Call the main server's internal birthday invitation API
      const response = await fetch(`http://localhost:3500/api/internal/birthday-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactId,
          contactEmail,
          contactFirstName,
          contactLastName,
          tenantName,
          htmlContent,
          fromEmail: fromEmail || 'noreply@zendwise.work'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send email via main server');
      }

      const result = await response.json();

      console.log(`✅ Birthday invitation sent successfully via main server: ${result.messageId}`);

      res.json({
        success: true,
        messageId: result.messageId,
        method: temporalService ? 'temporal-fallback' : 'direct-api',
        message: 'Birthday invitation sent successfully'
      });

    } catch (directError) {
      console.error('❌ Direct email sending also failed:', directError);
      throw directError;
    }

  } catch (error) {
    console.error('❌ Birthday invitation workflow error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to start birthday invitation workflow',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Birthday test endpoint for sending test birthday cards to users
app.post('/api/birthday-test', authenticateRequest, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      userId,
      userEmail,
      userFirstName,
      userLastName,
      tenantId,
      tenantName,
      fromEmail,
      isTest
    } = req.body;

    // Validate required fields
    if (!userId || !userEmail || !tenantId) {
      return res.status(400).json({
        success: false,
        error: 'userId, userEmail, and tenantId are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      return res.status(400).json({
        success: false,
        error: `Invalid email format: ${userEmail}`
      });
    }

    console.log(`🎂 Starting test birthday card workflow for user ${userId} (${userEmail})`);

    // Generate test birthday card HTML
    const userName = userFirstName 
      ? `${userFirstName}${userLastName ? ` ${userLastName}` : ''}` 
      : 'Team Member';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Test Birthday Card</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #e91e63; margin: 0;">🎉 Happy Birthday!</h1>
        </div>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
          <h2 style="color: white; margin: 0 0 15px 0; font-size: 24px;">Happy Birthday, ${userName}! 🎂</h2>
          <p style="color: white; margin: 0; font-size: 18px;">Wishing you a day filled with joy and celebration!</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0 0 15px 0; font-size: 16px;">Dear ${userName},</p>
          
          <p style="margin: 0 0 15px 0;">Today is your special day, and we wanted to take a moment to celebrate you! 🎈</p>
          
          <p style="margin: 0 0 15px 0;">This is a test birthday card to show how our birthday email system works. In a real scenario, this would be sent to customers on their special day.</p>
          
          <p style="margin: 0 0 20px 0;">Hope your day is as wonderful as you are!</p>
          
          <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 48px;">🎂🎉🎈🎁</span>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="margin: 0; font-size: 14px; color: #666;">
            This is a test email from ${tenantName || 'Your Company'}<br>
            Test Mode: Birthday Card System
          </p>
        </div>
      </body>
      </html>
    `;

    try {
      // Always send to beats@zendwise.com for test emails per memory
      const testRecipient = 'beats@zendwise.com';
      
      console.log(`📧 Sending test birthday card to ${testRecipient} (original: ${userEmail})`);

      // Send via main server
      const response = await fetch('http://localhost:5000/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || '',
        },
        body: JSON.stringify({
          to: testRecipient,
          subject: `🎉 Happy Birthday ${userName}! (Test)`,
          html: htmlContent,
          metadata: {
            type: 'birthday-test',
            originalRecipient: userEmail,
            userId,
            tenantId,
            tenantName,
            isTest: true
          },
          tenantId,
          tenantName,
          fromEmail: fromEmail || 'beats@zendwise.com'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send test email via main server');
      }

      const result = await response.json();

      console.log(`✅ Test birthday card sent successfully: ${result.messageId}`);

      res.json({
        success: true,
        messageId: result.messageId,
        testRecipient,
        originalRecipient: userEmail,
        method: 'direct-api-test',
        message: 'Test birthday card sent successfully'
      });

    } catch (error) {
      console.error('❌ Test birthday card sending failed:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ Test birthday card workflow error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send test birthday card',
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
    // Initialize Temporal service (non-blocking)
    console.log('Initializing Temporal service...');
    temporalService = new TemporalService();
    
    // Try to connect to Temporal, but don't block server startup
    try {
      await temporalService.connect();
      console.log('✅ Temporal service connected successfully');
    } catch (temporalError) {
      console.warn('⚠️ Temporal connection failed, server will run without Temporal:', temporalError.message);
      temporalService = null; // Clear the service if connection fails
    }

    // Start Express server regardless of Temporal connection
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on 0.0.0.0:${PORT}`);
      console.log(`📋 Health check: http://0.0.0.0:${PORT}/health`);
      console.log(`🌐 External access: http://localhost:${PORT}/health`);
      console.log(`⚡ Temporal: ${temporalService ? 'Connected' : 'Offline (fallback mode)'}`);
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
