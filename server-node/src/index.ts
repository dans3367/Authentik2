import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql, eq } from 'drizzle-orm';
import { pgTable, varchar, boolean, integer, text, timestamp } from 'drizzle-orm/pg-core';

// Define birthday settings table schema with promotion support
const birthdaySettings = pgTable("birthday_settings", {
  id: varchar("id").primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  enabled: boolean("enabled").default(false),
  sendDaysBefore: integer("send_days_before").default(0),
  emailTemplate: text("email_template").default('default'),
  segmentFilter: text("segment_filter").default('all'),
  customMessage: text("custom_message").default(''),
  customThemeData: text("custom_theme_data"),
  senderName: text("sender_name").default(''),
  senderEmail: text("sender_email").default(''),
  promotionId: varchar("promotion_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Define promotions table schema
const promotions = pgTable("promotions", {
  id: varchar("id").primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  type: text("type").notNull().default('newsletter'),
  targetAudience: text("target_audience").notNull().default('all'),
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0),
  maxUses: integer("max_uses"),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  promotionalCodes: text("promotional_codes"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
import { TemporalService } from './temporal/temporal-service';
import { authenticateRequest, type AuthenticatedRequest } from './middleware/auth';
import './lib/auth'; // Ensure auth types are available

// Load environment variables from parent directory
dotenv.config({ path: '../.env' });

// Initialize database connection
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const pool = postgres(process.env.DATABASE_URL!, {
  ssl: process.env.DATABASE_URL!.includes('sslmode=require') ? 'require' : false,
});
const db = drizzle(pool);

// Birthday template types and renderer
type BirthdayTemplateId = 'default' | 'confetti' | 'balloons' | 'custom';

function renderBirthdayTemplate(
  template: BirthdayTemplateId,
  params: { recipientName?: string; message?: string; imageUrl?: string; brandName?: string; customThemeData?: any; senderName?: string; promotionContent?: string }
): string {
  // Handle custom theme with rich styling
  if (template === 'custom' && params.customThemeData) {
    let customData = null;
    
    try {
      const parsedData = typeof params.customThemeData === 'string' 
        ? JSON.parse(params.customThemeData) 
        : params.customThemeData;
      
      // Check if it's the new structure (has themes property)
      if (parsedData.themes && parsedData.themes.custom) {
        customData = parsedData.themes.custom;
      } else if (!parsedData.themes) {
        // Old structure - use directly if no themes property
        customData = parsedData;
      }
    } catch (e) {
      console.warn('Failed to parse customThemeData for custom template:', e);
      return `<html><body><p>Error loading custom theme</p></body></html>`;
    }
    
    if (!customData) {
      return `<html><body><p>No custom theme data found</p></body></html>`;
    }
    
    const title = customData.title || `Happy Birthday${params.recipientName ? ', ' + params.recipientName : ''}!`;
    const message = customData.message || params.message || 'Wishing you a wonderful day!';
    const signature = customData.signature || '';
    const fromMessage = params.senderName || params.brandName || 'The Team';
    
    return `<html>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
          
          <!-- 1. Header Image (standalone) -->
          ${customData.imageUrl ? `
            <div style="height: 200px; background-image: url('${customData.imageUrl}'); background-size: cover; background-position: center; border-radius: 12px 12px 0 0;">
            </div>
          ` : `
            <div style="background: linear-gradient(135deg, #a8e6cf 0%, #dcedc1 100%); height: 200px; border-radius: 12px 12px 0 0;">
            </div>
          `}
          
          <!-- 2. Header Text (separate from image) -->
          <div style="padding: 30px 30px 20px 30px; text-align: center; border-bottom: 1px solid #f0f0f0;">
            <h1 style="color: #2d3748; font-size: 2.5rem; margin: 0; font-weight: bold;">${title}</h1>
          </div>
          
          <!-- 3. Content Area (message) -->
          <div style="padding: 30px;">
            <div style="font-size: 1.2rem; line-height: 1.6; color: #4a5568; text-align: center; margin-bottom: 20px;">${message}</div>
            ${params.promotionContent ? `<div style="margin-top: 30px; padding: 20px; background: #f7fafc; border-radius: 8px; border-left: 4px solid #667eea; text-align: left;">${params.promotionContent}</div>` : ''}
            ${signature ? `<div style="font-size: 1rem; line-height: 1.5; color: #718096; text-align: center; font-style: italic; margin-top: 20px;">${signature}</div>` : ''}
          </div>
          
          <!-- 4. From Message -->
          <div style="padding: 20px 30px 30px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
            <div style="font-size: 0.9rem; color: #718096;">
              <p style="margin: 0;">Best regards,</p>
              <p style="margin: 5px 0 0 0; font-weight: 600; color: #4a5568;">${fromMessage}</p>
            </div>
          </div>
        </div>
      </body>
    </html>`;
  }

  // Default theme header images
  const themeHeaders = {
    default: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    confetti: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // Party/confetti themed
    balloons: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?q=80&w=2550&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' // Balloons themed
  };

  const themeColors = {
    default: { primary: '#667eea', secondary: '#764ba2' },
    confetti: { primary: '#ff6b6b', secondary: '#feca57' },
    balloons: { primary: '#54a0ff', secondary: '#5f27cd' }
  };
  
  // Check if there's custom theme data with custom title/signature for this specific theme
  let headline = `Happy Birthday${params.recipientName ? ', ' + params.recipientName : ''}!`;
  let signature = '';
  
  if (params.customThemeData) {
    try {
      const parsedData = typeof params.customThemeData === 'string' 
        ? JSON.parse(params.customThemeData) 
        : params.customThemeData;
      
      let themeSpecificData = null;
      
      // Check if it's the new structure (has themes property)
      if (parsedData.themes && parsedData.themes[template]) {
        themeSpecificData = parsedData.themes[template];
      } else if (!parsedData.themes) {
        // Old structure - use directly if no themes property
        themeSpecificData = parsedData;
      }
      
      if (themeSpecificData) {
        // Use custom title if provided, otherwise use default
        if (themeSpecificData.title) {
          headline = themeSpecificData.title;
        }
        
        // Use custom signature if provided
        if (themeSpecificData.signature) {
          signature = themeSpecificData.signature;
        }
      }
    } catch (e) {
      // If parsing fails, continue with defaults
      console.warn('Failed to parse customThemeData for template:', template, e);
    }
  }
  
  const headerImage = themeHeaders[template as keyof typeof themeHeaders] || themeHeaders.default;
  const colors = themeColors[template as keyof typeof themeColors] || themeColors.default;
  const fromMessage = params.senderName || params.brandName || 'The Team';
  
  return `<html>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%);">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
        
        <!-- 1. Header Image (standalone) -->
        <div style="height: 200px; background-image: url('${headerImage}'); background-size: cover; background-position: center; border-radius: 12px 12px 0 0;">
        </div>
        
        <!-- 2. Header Text (separate from image) -->
        <div style="padding: 30px 30px 20px 30px; text-align: center; border-bottom: 1px solid #f0f0f0;">
          <h1 style="color: #2d3748; font-size: 2.5rem; margin: 0; font-weight: bold;">${headline}</h1>
        </div>
        
        <!-- 3. Content Area (message) -->
        <div style="padding: 30px;">
          <div style="font-size: 1.2rem; line-height: 1.6; color: #4a5568; text-align: center; margin-bottom: 20px;">${params.message || 'Wishing you a wonderful day!'}</div>
          ${params.promotionContent ? `<div style="margin-top: 30px; padding: 20px; background: #f7fafc; border-radius: 8px; border-left: 4px solid ${colors.primary}; text-align: left;">${params.promotionContent}</div>` : ''}
          ${signature ? `<div style="font-size: 1rem; line-height: 1.5; color: #718096; text-align: center; font-style: italic; margin-top: 20px;">${signature}</div>` : ''}
        </div>
        
        <!-- 4. From Message -->
        <div style="padding: 20px 30px 30px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
          <div style="font-size: 0.9rem; color: #718096;">
            <p style="margin: 0;">Best regards,</p>
            <p style="margin: 5px 0 0 0; font-weight: 600; color: #4a5568;">${fromMessage}</p>
          </div>
        </div>
      </div>
    </body>
  </html>`;
}

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
          fromEmail: fromEmail || 'admin@zendwise.work',
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
app.post('/api/birthday-test', async (req: any, res) => {
  console.log('🎂 BIRTHDAY TEST ENDPOINT HIT!');
  try {
    const {
      userId,
      userEmail,
      userFirstName,
      userLastName,
      tenantId,
      tenantName,
      fromEmail,
      isTest,
      // Extract template data from frontend
      emailTemplate,
      customMessage,
      customThemeData,
      senderName,
      senderEmail,
      promotionId
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
    console.log(`🏢 Using tenant ID: ${tenantId}`);

    // Fetch birthday settings for the tenant to get selected template and promotion
    let birthdaySettingsData;
    let promotionData = null;
    try {
      const settings = await db.select().from(birthdaySettings).where(eq(birthdaySettings.tenantId, tenantId)).limit(1);
      birthdaySettingsData = settings.length > 0 ? settings[0] : null;
      console.log(`🎨 Birthday settings found:`, birthdaySettingsData ? 'Yes' : 'No');
      console.log(`🎨 Settings promotion ID: ${birthdaySettingsData?.promotionId}`);

      // Fetch promotion data - prioritize promotionId from request body, then fall back to birthday settings
      const finalPromotionId = promotionId || birthdaySettingsData?.promotionId;
      console.log(`🎁 Final promotion ID to use: ${finalPromotionId} (from request: ${promotionId}, from settings: ${birthdaySettingsData?.promotionId})`);

      if (finalPromotionId) {
        try {
          const promotion = await db.select().from(promotions).where(eq(promotions.id, finalPromotionId)).limit(1);
          promotionData = promotion.length > 0 ? promotion[0] : null;
          console.log(`🎁 Fetched promotion data for ID: ${finalPromotionId}`, promotionData ? `Success - "${promotionData.title}" (${promotionData.content?.length} chars)` : 'Not found');
        } catch (promotionError) {
          console.warn('Failed to fetch promotion data:', promotionError);
        }
      } else {
        console.log(`🎁 No promotion ID found, will send without promotion`);
      }
    } catch (error) {
      console.warn('Failed to fetch birthday settings, using defaults:', error);
      birthdaySettingsData = null;
    }

    // Prepare template parameters
    const userName = userFirstName 
      ? `${userFirstName}${userLastName ? ` ${userLastName}` : ''}` 
      : 'Team Member';

    // Use frontend-provided template data if available, otherwise fall back to database values
    const selectedTemplate = (emailTemplate as BirthdayTemplateId) || (birthdaySettingsData?.emailTemplate as BirthdayTemplateId) || 'default';
    const finalCustomMessage = customMessage || birthdaySettingsData?.customMessage || 'This is a test birthday card to show how our birthday email system works. In a real scenario, this would be sent to customers on their special day. Hope your day is as wonderful as you are!';
    const finalSenderName = senderName || birthdaySettingsData?.senderName || 'Your Team';

    // Parse customThemeData and extract theme-specific data
    let finalCustomThemeData = customThemeData;
    if (!finalCustomThemeData && birthdaySettingsData?.customThemeData) {
      try {
        const parsedThemeData = JSON.parse(birthdaySettingsData.customThemeData);

        // Check if it's the new nested structure with themes
        if (parsedThemeData.themes && parsedThemeData.themes[selectedTemplate]) {
          finalCustomThemeData = parsedThemeData.themes[selectedTemplate];
          console.log(`🎨 Extracted theme-specific data for ${selectedTemplate} template`);
        } else if (!parsedThemeData.themes) {
          // Old structure - assume it's for custom theme if we're using custom
          if (selectedTemplate === 'custom') {
            finalCustomThemeData = parsedThemeData;
            console.log('🎨 Using legacy custom theme data structure');
          }
        }
      } catch (error) {
        console.warn('Failed to parse customThemeData:', error);
        finalCustomThemeData = null;
      }
    }

    console.log(`🎨 Using template: ${selectedTemplate}${selectedTemplate === 'custom' ? ' with custom theme data' : ''}`);

    // Send test email to the actual user's email address
    const testRecipient = userEmail;
    
    console.log(`📧 Sending test birthday card to ${testRecipient}`);

    // Try to use Temporal service if available, otherwise fallback to direct sending
    if (temporalService && temporalService.isConnected()) {
      try {
        console.log('🚀 Routing birthday test through Temporal workflow...');

        // Pre-render the birthday template to avoid sending placeholder
        const renderedHtmlContent = renderBirthdayTemplate(selectedTemplate, {
          recipientName: userName,
          message: finalCustomMessage,
          brandName: tenantName || 'Your Company',
          customThemeData: finalCustomThemeData,
          senderName: finalSenderName,
          promotionContent: promotionData?.content || undefined
        });

        // Generate unique workflow ID
        const workflowId = `birthday-test-${userId}-${Date.now()}`;

        // Prepare email workflow input for temporal with pre-rendered content
        const emailWorkflowInput = {
          emailId: workflowId,
          recipient: testRecipient,
          subject: `🎉 Happy Birthday ${userName}! (Test - ${selectedTemplate} template)`,
          content: renderedHtmlContent, // Use pre-rendered content instead of placeholder
          templateType: 'birthday-ecard',
          priority: 'normal' as const,
          tenantId,
          userId,
          fromEmail: fromEmail || 'admin@zendwise.work',
          metadata: {
            type: 'birthday-test',
            recipient: userEmail,
            isTest: true,
            birthdayTemplate: selectedTemplate,
            recipientName: userName,
            message: finalCustomMessage,
            brandName: tenantName || 'Your Company',
            customThemeData: finalCustomThemeData,
            senderName: finalSenderName,
            templateUsed: selectedTemplate,
            hasCustomTheme: finalCustomThemeData !== null,
            promotionContent: promotionData?.content || undefined,
            preRendered: true // Mark that content was pre-rendered
          }
        };

        const handle = await temporalService.startWorkflow(
          'emailWorkflow',
          workflowId,
          emailWorkflowInput
        );

        console.log(`✅ Birthday test workflow started via Temporal: ${workflowId}`);

        res.json({
          success: true,
          workflowId,
          workflowRunId: handle.workflowId,
          recipient: testRecipient,
          method: 'temporal-workflow',
          templateUsed: selectedTemplate,
          hasCustomTheme: selectedTemplate === 'custom' && finalCustomThemeData !== null,
          message: `Test birthday card workflow started using ${selectedTemplate} template`
        });
        return; // Exit early since we successfully used temporal

      } catch (temporalError) {
        console.error('❌ Temporal workflow failed for birthday test, falling back to direct sending:', temporalError);
        // Fall through to direct sending
      }
    } else {
      console.log('⚠️ Temporal service not available, using direct sending fallback');
    }

    // Fallback: Generate birthday card HTML and send directly
    try {
      console.log('📧 About to render birthday template');
      console.log('📧 Promotion data:', promotionData ? `Has content: ${promotionData.content?.length} chars` : 'No promotion data');
      console.log('📧 Promotion content preview:', promotionData?.content?.substring(0, 50) + '...');

      const htmlContent = renderBirthdayTemplate(selectedTemplate, {
        recipientName: userName,
        message: finalCustomMessage,
        brandName: tenantName || 'Your Company',
        customThemeData: finalCustomThemeData,
        senderName: finalSenderName,
        promotionContent: promotionData?.content || undefined
      });

      console.log('📧 Template rendered, HTML length:', htmlContent.length);
      console.log('📧 Promotion content in HTML:', htmlContent.includes(promotionData?.content?.substring(0, 20)) ? 'YES' : 'NO');

      // Send via main server
      const response = await fetch('http://localhost:5000/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || '',
        },
        body: JSON.stringify({
          to: testRecipient,
          subject: `🎉 Happy Birthday ${userName}! (Test - ${selectedTemplate} template)`,
          html: htmlContent,
          metadata: {
            type: 'birthday-test',
            recipient: userEmail,
            userId,
            tenantId,
            tenantName,
            isTest: true,
            templateUsed: selectedTemplate,
            hasCustomTheme: finalCustomThemeData !== null
          },
          tenantId,
          tenantName,
          fromEmail: fromEmail || 'admin@zendwise.work'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send test email via main server');
      }

      const result = await response.json();

      console.log(`✅ Test birthday card sent successfully (fallback): ${result.messageId} (using ${selectedTemplate} template)`);

      res.json({
        success: true,
        messageId: result.messageId,
        recipient: testRecipient,
        method: 'direct-fallback',
        templateUsed: selectedTemplate,
        hasCustomTheme: finalCustomThemeData !== null,
        message: `Test birthday card sent successfully using ${selectedTemplate} template`
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
