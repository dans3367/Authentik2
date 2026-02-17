import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth-middleware';
import { createHmac } from 'crypto';
import { trackNewsletterEvent } from '../utils/convexNewsletterTracker';

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
    const { email_id, eventType, metadata } = req.body;

    if (!email_id || !eventType) {
      return res.status(400).json({ message: 'email_id and eventType are required' });
    }

    // Create test webhook data based on the event type
    const testWebhookData = {
      email_id,
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
        email_id,
        eventType,
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

    // Extract provider_message_id from webhook data
    const providerMessageId = extractProviderMessageId(data);
    if (!providerMessageId) {
      console.error('Could not extract provider_message_id from webhook data');
      return;
    }

    console.log(`Processing sent event for provider_message_id: ${providerMessageId}`);

    // Find the email_sends record
    const emailSend = await findEmailSendByProviderId(providerMessageId);
    if (!emailSend) {
      console.log(`Email send record not found for provider_message_id: ${providerMessageId}`);
      return;
    }

    // Update email_sends status
    await db.update(db.emailSends)
      .set({
        status: 'sent',
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(sql`${db.emailSends.id} = ${emailSend.id}`);

    // Create email_events record
    await createEmailEvent(emailSend.id, data, 'sent');

    // Update contact metrics if contact is linked
    if (emailSend.contactId) {
      await updateContactMetrics(emailSend.contactId, 'sent');
    }

    // Track in Convex for live updates (fire-and-forget)
    if (emailSend.newsletterId) {
      trackNewsletterEvent({
        tenantId: emailSend.tenantId,
        newsletterId: emailSend.newsletterId,
        recipientEmail: emailSend.recipientEmail,
        providerMessageId,
        eventType: 'sent',
      }).catch(() => {});
    }

    console.log(`Successfully processed sent event for email_send: ${emailSend.id}`);
  } catch (error) {
    console.error('Error handling email sent event:', error);
  }
}

async function handleEmailDelivered(data: any) {
  try {
    console.log('Email delivered event:', data);

    // Extract provider_message_id from webhook data
    const providerMessageId = extractProviderMessageId(data);
    if (!providerMessageId) {
      console.error('Could not extract provider_message_id from webhook data');
      return;
    }

    console.log(`Processing delivered event for provider_message_id: ${providerMessageId}`);

    // Find the email_sends record
    const emailSend = await findEmailSendByProviderId(providerMessageId);
    if (!emailSend) {
      console.log(`Email send record not found for provider_message_id: ${providerMessageId}`);
      return;
    }

    // Update email_sends status
    await db.update(db.emailSends)
      .set({
        status: 'delivered',
        deliveredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(sql`${db.emailSends.id} = ${emailSend.id}`);

    // Create email_events record
    await createEmailEvent(emailSend.id, data, 'delivered');

    // Update contact metrics if contact is linked
    if (emailSend.contactId) {
      await updateContactMetrics(emailSend.contactId, 'delivered');
    }

    // Track in Convex for live updates (fire-and-forget)
    if (emailSend.newsletterId) {
      trackNewsletterEvent({
        tenantId: emailSend.tenantId,
        newsletterId: emailSend.newsletterId,
        recipientEmail: emailSend.recipientEmail,
        providerMessageId,
        eventType: 'delivered',
      }).catch(() => {});
    }

    console.log(`Successfully processed delivered event for email_send: ${emailSend.id}`);
  } catch (error) {
    console.error('Error handling email delivered event:', error);
  }
}

async function handleEmailBounced(data: any) {
  try {
    console.log('Email bounced event:', data);
    
    // Extract provider_message_id from webhook data
    const providerMessageId = extractProviderMessageId(data);
    const email = data.email || data.Email;
    const reason = data.reason || data.Type || 'bounce';
    const description = data.description || data.Description || 'Email bounced';

    // Update email_sends if we have provider_message_id
    if (providerMessageId) {
      const emailSend = await findEmailSendByProviderId(providerMessageId);
      if (emailSend) {
        await db.update(db.emailSends)
          .set({
            status: 'bounced',
            errorMessage: description,
            updatedAt: new Date(),
          })
          .where(sql`${db.emailSends.id} = ${emailSend.id}`);

        // Create email_events record
        await createEmailEvent(emailSend.id, data, 'bounced');

        // Track in Convex for live updates (fire-and-forget)
        if (emailSend.newsletterId) {
          trackNewsletterEvent({
            tenantId: emailSend.tenantId,
            newsletterId: emailSend.newsletterId,
            recipientEmail: emailSend.recipientEmail,
            providerMessageId,
            eventType: 'bounced',
          }).catch(() => {});
        }

        console.log(`Updated email_send ${emailSend.id} as bounced`);
      }
    }

    // Add to bounced emails table
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
    
    // Extract provider_message_id from webhook data
    const providerMessageId = extractProviderMessageId(data);
    const email = data.email || data.Email;
    const reason = 'spam_complaint';
    const description = 'Spam complaint received';

    // Update email_sends if we have provider_message_id
    if (providerMessageId) {
      const emailSend = await findEmailSendByProviderId(providerMessageId);
      if (emailSend) {
        // Create email_events record
        await createEmailEvent(emailSend.id, data, 'complained');

        // Track in Convex for live updates (fire-and-forget)
        if (emailSend.newsletterId) {
          trackNewsletterEvent({
            tenantId: emailSend.tenantId,
            newsletterId: emailSend.newsletterId,
            recipientEmail: emailSend.recipientEmail,
            providerMessageId,
            eventType: 'complained',
          }).catch(() => {});
        }

        console.log(`Recorded complaint event for email_send ${emailSend.id}`);
      }
    }

    // Add to bounced emails table
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

    // Extract provider_message_id from webhook data
    const providerMessageId = extractProviderMessageId(data);
    if (!providerMessageId) {
      console.error('Could not extract provider_message_id from webhook data');
      return;
    }

    console.log(`Processing opened event for provider_message_id: ${providerMessageId}`);

    // Find the email_sends record
    const emailSend = await findEmailSendByProviderId(providerMessageId);
    if (!emailSend) {
      console.log(`Email send record not found for provider_message_id: ${providerMessageId}`);
      return;
    }

    // Create email_events record
    await createEmailEvent(emailSend.id, data, 'opened');

    // Update contact metrics if contact is linked
    if (emailSend.contactId) {
      await updateContactMetrics(emailSend.contactId, 'opened');
    }

    // Track in Convex for live updates (fire-and-forget)
    if (emailSend.newsletterId) {
      trackNewsletterEvent({
        tenantId: emailSend.tenantId,
        newsletterId: emailSend.newsletterId,
        recipientEmail: emailSend.recipientEmail,
        providerMessageId,
        eventType: 'opened',
        metadata: { userAgent: data.user_agent, ipAddress: data.ip_address },
      }).catch(() => {});
    }

    console.log(`Successfully processed opened event for email_send: ${emailSend.id}`);
  } catch (error) {
    console.error('Error handling email opened event:', error);
  }
}

async function handleEmailClicked(data: any) {
  try {
    console.log('Email clicked event:', data);

    // Extract provider_message_id from webhook data
    const providerMessageId = extractProviderMessageId(data);
    if (!providerMessageId) {
      console.error('Could not extract provider_message_id from webhook data');
      return;
    }

    console.log(`Processing clicked event for provider_message_id: ${providerMessageId}`);

    // Find the email_sends record
    const emailSend = await findEmailSendByProviderId(providerMessageId);
    if (!emailSend) {
      console.log(`Email send record not found for provider_message_id: ${providerMessageId}`);
      return;
    }

    // Create email_events record
    await createEmailEvent(emailSend.id, data, 'clicked');

    // Update contact metrics if contact is linked
    if (emailSend.contactId) {
      await updateContactMetrics(emailSend.contactId, 'clicked');
    }

    // Track in Convex for live updates (fire-and-forget)
    if (emailSend.newsletterId) {
      trackNewsletterEvent({
        tenantId: emailSend.tenantId,
        newsletterId: emailSend.newsletterId,
        recipientEmail: emailSend.recipientEmail,
        providerMessageId,
        eventType: 'clicked',
        metadata: { userAgent: data.user_agent, ipAddress: data.ip_address, link: data.link || data.click?.link },
      }).catch(() => {});
    }

    console.log(`Successfully processed clicked event for email_send: ${emailSend.id}`);
  } catch (error) {
    console.error('Error handling email clicked event:', error);
  }
}

// Helper function to extract provider_message_id from webhook data
function extractProviderMessageId(data: any): string | null {
  // Resend format - uses email_id
  if (data.email_id) {
    return data.email_id;
  }

  // Postmark format - uses MessageID
  if (data.MessageID) {
    return data.MessageID;
  }

  // Fallback for generic id field
  if (data.id) {
    return data.id;
  }

  console.error('Could not find provider_message_id in webhook data:', JSON.stringify(data, null, 2));
  return null;
}

// Helper function to find email_sends by provider_message_id
async function findEmailSendByProviderId(providerMessageId: string) {
  try {
    const emailSend = await db.query.emailSends.findFirst({
      where: sql`${db.emailSends.providerMessageId} = ${providerMessageId}`,
    });

    return emailSend;
  } catch (error) {
    console.error('Error finding email_send by provider_message_id:', error);
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

// Helper function to create email_events record
async function createEmailEvent(emailSendId: string, webhookData: any, eventType: string) {
  try {
    // Extract additional data from webhook
    const userAgent = webhookData.user_agent || webhookData.UserAgent;
    const ipAddress = webhookData.ip_address || webhookData.IPAddress;
    const webhookId = webhookData.id || webhookData.MessageID || webhookData.email_id;

    await db.insert(db.emailEvents).values({
      emailSendId,
      eventType,
      eventData: JSON.stringify(webhookData),
      userAgent,
      ipAddress,
      webhookId,
      occurredAt: new Date(),
    });

    console.log(`Created ${eventType} event record for email_send ${emailSendId}`);
  } catch (error) {
    console.error('Error creating email event record:', error);
  }
}