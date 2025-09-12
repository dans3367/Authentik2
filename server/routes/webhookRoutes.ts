import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth-middleware';
import { createHmac } from 'crypto';

export const webhookRoutes = Router();

// Resend webhook endpoint
webhookRoutes.get("/resend", async (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/plain');
    res.send('Systems all good');
  } catch (error) {
    console.error('Resend webhook GET error:', error);
    res.status(500).send('System error');
  }
});

// Test webhook endpoint for testing email events
webhookRoutes.post("/test/webhook-event", authenticateToken, async (req: any, res) => {
  try {
    const { email, eventType, newsletterId, campaignId, metadata } = req.body;

    if (!email || !eventType) {
      return res.status(400).json({ message: 'Email and eventType are required' });
    }

    // Create test webhook data based on the event type
    const testWebhookData = {
      to: [email],
      email,
      newsletterId,
      campaignId,
      metadata,
      id: `test-webhook-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user_agent: req.get('User-Agent'),
      ip_address: req.ip,
    };

    // Process the webhook event using our existing handlers
    let handlerResult = null;
    switch (eventType) {
      case 'sent':
        handlerResult = await handleEmailSent(testWebhookData);
        break;
      case 'delivered':
        handlerResult = await handleEmailDelivered(testWebhookData);
        break;
      case 'opened':
        handlerResult = await handleEmailOpened(testWebhookData);
        break;
      case 'clicked':
        handlerResult = await handleEmailClicked(testWebhookData);
        break;
      default:
        return res.status(400).json({ message: 'Invalid eventType. Supported: sent, delivered, opened, clicked' });
    }

    res.json({
      message: `Test webhook ${eventType} event processed successfully`,
      received: {
        email,
        eventType,
        newsletterId,
        campaignId,
        metadata,
      },
    });
  } catch (error) {
    console.error('Test webhook event error:', error);
    res.status(500).json({ message: 'Failed to process test webhook event' });
  }
});

// Test webhook open endpoint (keeping for backward compatibility)
webhookRoutes.post("/test/webhook-open", authenticateToken, async (req: any, res) => {
  try {
    const { email, newsletterId, timestamp } = req.body;

    if (!email || !newsletterId) {
      return res.status(400).json({ message: 'Email and newsletterId are required' });
    }

    // Log the webhook event
    console.log('Webhook open event received:', {
      email,
      newsletterId,
      timestamp: timestamp || new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    // Here you would typically:
    // 1. Update email tracking statistics
    // 2. Update contact engagement metrics
    // 3. Trigger any follow-up actions

    res.json({
      message: 'Webhook open event processed successfully',
      received: {
        email,
        newsletterId,
        timestamp: timestamp || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Test webhook open error:', error);
    res.status(500).json({ message: 'Failed to process webhook open event' });
  }
});

// Resend webhook endpoint (POST)
webhookRoutes.post("/resend", async (req, res) => {
  try {
    const signature = req.headers['resend-signature'] as string;
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('RESEND_WEBHOOK_SECRET not configured');
      return res.status(500).json({ message: 'Webhook secret not configured' });
    }

    // Verify webhook signature
    if (signature) {
      const expectedSignature = createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ message: 'Invalid signature' });
      }
    }

    const event = req.body;

    console.log('Resend webhook event received:', {
      type: event.type,
      data: event.data,
      timestamp: new Date().toISOString(),
    });

    // Handle different event types
    switch (event.type) {
      case 'email.sent':
        await handleEmailSent(event.data);
        break;
      case 'email.delivered':
        await handleEmailDelivered(event.data);
        break;
      case 'email.bounced':
        await handleEmailBounced(event.data);
        break;
      case 'email.complained':
        await handleEmailComplained(event.data);
        break;
      case 'email.opened':
        await handleEmailOpened(event.data);
        break;
      case 'email.clicked':
        await handleEmailClicked(event.data);
        break;
      default:
        console.log(`Unhandled Resend event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Resend webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

// Postmark webhook endpoint
webhookRoutes.post("/postmark", async (req, res) => {
  try {
    const signature = req.headers['x-postmark-signature'] as string;
    const webhookSecret = process.env.POSTMARK_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('POSTMARK_WEBHOOK_SECRET not configured');
      return res.status(500).json({ message: 'Webhook secret not configured' });
    }

    // Verify webhook signature
    if (signature) {
      const expectedSignature = createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('Invalid Postmark webhook signature');
        return res.status(401).json({ message: 'Invalid signature' });
      }
    }

    const event = req.body;

    console.log('Postmark webhook event received:', {
      type: event.RecordType,
      data: event,
      timestamp: new Date().toISOString(),
    });

    // Handle different event types
    switch (event.RecordType) {
      case 'Sent':
        await handleEmailSent(event);
        break;
      case 'Delivered':
        await handleEmailDelivered(event);
        break;
      case 'Bounce':
        await handleEmailBounced(event);
        break;
      case 'SpamComplaint':
        await handleEmailComplained(event);
        break;
      case 'Open':
        await handleEmailOpened(event);
        break;
      case 'Click':
        await handleEmailClicked(event);
        break;
      default:
        console.log(`Unhandled Postmark event type: ${event.RecordType}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Postmark webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

// Helper functions for webhook event handling
async function handleEmailSent(data: any) {
  try {
    console.log('Email sent event:', data);

    // Extract recipient email from webhook data
    const recipientEmail = extractRecipientEmail(data);
    if (!recipientEmail) {
      console.error('Could not extract recipient email from webhook data');
      return;
    }

    console.log(`Processing sent event for: ${recipientEmail}`);

    // Find the contact record
    const contact = await findContactByEmail(recipientEmail);
    if (!contact) {
      console.log(`Contact not found for email: ${recipientEmail}`);
      return;
    }

    // Update contact metrics
    await updateContactMetrics(contact.id, 'sent');

    // Create email activity record
    await createEmailActivity(contact.id, data, 'sent', recipientEmail);

    // Update newsletter statistics if newsletterId is provided
    if (data.newsletterId) {
      console.log(`Newsletter ${data.newsletterId} email sent to ${recipientEmail}`);
      // TODO: Update newsletter send count in newsletters table
    }
  } catch (error) {
    console.error('Error handling email sent event:', error);
  }
}

async function handleEmailDelivered(data: any) {
  try {
    console.log('Email delivered event:', data);

    // Extract recipient email from webhook data
    const recipientEmail = extractRecipientEmail(data);
    if (!recipientEmail) {
      console.error('Could not extract recipient email from webhook data');
      return;
    }

    console.log(`Processing delivered event for: ${recipientEmail}`);

    // Find the contact record
    const contact = await findContactByEmail(recipientEmail);
    if (!contact) {
      console.log(`Contact not found for email: ${recipientEmail}`);
      return;
    }

    // Update contact metrics
    await updateContactMetrics(contact.id, 'delivered');

    // Create email activity record
    await createEmailActivity(contact.id, data, 'delivered', recipientEmail);

    // Update newsletter statistics if newsletterId is provided
    if (data.newsletterId) {
      console.log(`Newsletter ${data.newsletterId} email delivered to ${recipientEmail}`);
    }
  } catch (error) {
    console.error('Error handling email delivered event:', error);
  }
}

async function handleEmailBounced(data: any) {
  try {
    console.log('Email bounced event:', data);
    
    // Add to bounced emails table
    const email = data.email || data.Email;
    const reason = data.reason || data.Type || 'bounce';
    const description = data.description || data.Description || 'Email bounced';

    if (email) {
      // Check if already exists
      const existingBounce = await db.query.bouncedEmails.findFirst({
        where: sql`${db.bouncedEmails.email} = ${email}`,
      });

      if (!existingBounce) {
        await db.insert(db.bouncedEmails).values({
          email,
          reason,
          description,
          bouncedAt: new Date(),
        });
        console.log(`Added bounced email: ${email}`);
      }
    }
  } catch (error) {
    console.error('Error handling email bounced event:', error);
  }
}

async function handleEmailComplained(data: any) {
  try {
    console.log('Email complained event:', data);
    
    // Add to bounced emails table with spam complaint reason
    const email = data.email || data.Email;
    const reason = 'spam_complaint';
    const description = 'Spam complaint received';

    if (email) {
      // Check if already exists
      const existingBounce = await db.query.bouncedEmails.findFirst({
        where: sql`${db.bouncedEmails.email} = ${email}`,
      });

      if (!existingBounce) {
        await db.insert(db.bouncedEmails).values({
          email,
          reason,
          description,
          bouncedAt: new Date(),
        });
        console.log(`Added spam complaint: ${email}`);
      }
    }
  } catch (error) {
    console.error('Error handling email complained event:', error);
  }
}

async function handleEmailOpened(data: any) {
  try {
    console.log('Email opened event:', data);

    // Extract recipient email from webhook data
    const recipientEmail = extractRecipientEmail(data);
    if (!recipientEmail) {
      console.error('Could not extract recipient email from webhook data');
      return;
    }

    console.log(`Processing opened event for: ${recipientEmail}`);

    // Find the contact record
    const contact = await findContactByEmail(recipientEmail);
    if (!contact) {
      console.log(`Contact not found for email: ${recipientEmail}`);
      return;
    }

    // Update contact metrics
    await updateContactMetrics(contact.id, 'opened');

    // Create email activity record
    await createEmailActivity(contact.id, data, 'opened', recipientEmail);

    // Update newsletter statistics if newsletterId is provided
    if (data.newsletterId) {
      console.log(`Newsletter ${data.newsletterId} email opened by ${recipientEmail}`);
    }
  } catch (error) {
    console.error('Error handling email opened event:', error);
  }
}

async function handleEmailClicked(data: any) {
  try {
    console.log('Email clicked event:', data);

    // Extract recipient email from webhook data
    const recipientEmail = extractRecipientEmail(data);
    if (!recipientEmail) {
      console.error('Could not extract recipient email from webhook data');
      return;
    }

    console.log(`Processing clicked event for: ${recipientEmail}`);

    // Find the contact record
    const contact = await findContactByEmail(recipientEmail);
    if (!contact) {
      console.log(`Contact not found for email: ${recipientEmail}`);
      return;
    }

    // Update contact metrics
    await updateContactMetrics(contact.id, 'clicked');

    // Create email activity record
    await createEmailActivity(contact.id, data, 'clicked', recipientEmail);

    // Update newsletter statistics if newsletterId is provided
    if (data.newsletterId) {
      console.log(`Newsletter ${data.newsletterId} email clicked by ${recipientEmail}`);
    }
  } catch (error) {
    console.error('Error handling email clicked event:', error);
  }
}

// Helper function to extract recipient email from webhook data
function extractRecipientEmail(data: any): string | null {
  // Handle different webhook formats

  // Resend format
  if (data.to && Array.isArray(data.to)) {
    // Resend webhook has 'to' as array of recipients
    const recipient = data.to[0];
    if (typeof recipient === 'string') {
      return recipient;
    } else if (recipient && recipient.email) {
      return recipient.email;
    }
  } else if (data.to && typeof data.to === 'string') {
    return data.to;
  } else if (data.email) {
    // Fallback for direct email field
    return data.email;
  }

  // Postmark format
  if (data.Email) {
    return data.Email;
  }

  // Check for 'to' field in various formats
  if (data.to) {
    if (Array.isArray(data.to)) {
      const firstRecipient = data.to[0];
      if (typeof firstRecipient === 'string') {
        return firstRecipient;
      } else if (firstRecipient && firstRecipient.email) {
        return firstRecipient.email;
      }
    } else if (typeof data.to === 'string') {
      return data.to;
    }
  }

  console.error('Could not find recipient email in webhook data:', JSON.stringify(data, null, 2));
  return null;
}

// Helper function to find contact by email
async function findContactByEmail(email: string) {
  try {
    // Get tenant ID from environment or request context
    // For now, using default tenant ID - this should be improved to handle multi-tenancy properly
    const tenantId = process.env.DEFAULT_TENANT_ID || '29c69b4f-3129-4aa4-a475-7bf892e5c5b9';

    const contact = await db.query.emailContacts.findFirst({
      where: sql`${db.emailContacts.email} = ${email} AND ${db.emailContacts.tenantId} = ${tenantId}`,
    });

    return contact;
  } catch (error) {
    console.error('Error finding contact by email:', error);
    return null;
  }
}

// Helper function to update contact metrics
async function updateContactMetrics(contactId: string, activityType: string) {
  try {
    const now = new Date();

    // Build the update object based on activity type
    const updateData: any = {
      lastActivity: now,
      updatedAt: now,
    };

    // Update specific metrics based on activity type
    switch (activityType) {
      case 'sent':
        updateData.emailsSent = sql`${db.emailContacts.emailsSent} + 1`;
        break;
      case 'opened':
        updateData.emailsOpened = sql`${db.emailContacts.emailsOpened} + 1`;
        break;
      case 'clicked':
        // Clicks also count as opens
        updateData.emailsOpened = sql`${db.emailContacts.emailsOpened} + 1`;
        break;
    }

    await db.update(db.emailContacts)
      .set(updateData)
      .where(sql`${db.emailContacts.id} = ${contactId}`);

    console.log(`Updated contact ${contactId} metrics for ${activityType}`);
  } catch (error) {
    console.error('Error updating contact metrics:', error);
  }
}

// Helper function to create email activity record
async function createEmailActivity(contactId: string, webhookData: any, activityType: string, recipientEmail: string) {
  try {
    // Get tenant ID from environment or request context
    const tenantId = process.env.DEFAULT_TENANT_ID || '29c69b4f-3129-4aa4-a475-7bf892e5c5b9';

    // Extract additional data from webhook
    const userAgent = webhookData.user_agent || webhookData.UserAgent;
    const ipAddress = webhookData.ip_address || webhookData.IPAddress;
    const webhookId = webhookData.id || webhookData.MessageID;

    // Try to find related newsletter/campaign from webhook data
    let newsletterId = null;
    let campaignId = null;

    // Look for newsletter ID in webhook data
    if (webhookData.newsletterId) {
      newsletterId = webhookData.newsletterId;
    } else if (webhookData.metadata && webhookData.metadata.newsletterId) {
      newsletterId = webhookData.metadata.newsletterId;
    }

    // Look for campaign ID in webhook data
    if (webhookData.campaignId) {
      campaignId = webhookData.campaignId;
    } else if (webhookData.metadata && webhookData.metadata.campaignId) {
      campaignId = webhookData.metadata.campaignId;
    }

    await db.insert(db.emailActivity).values({
      tenantId,
      contactId,
      campaignId,
      newsletterId,
      activityType,
      activityData: JSON.stringify(webhookData),
      userAgent,
      ipAddress,
      webhookId,
      webhookData: JSON.stringify(webhookData),
      occurredAt: new Date(),
    });

    console.log(`Created ${activityType} activity record for contact ${contactId}`);
  } catch (error) {
    console.error('Error creating email activity record:', error);
  }
}