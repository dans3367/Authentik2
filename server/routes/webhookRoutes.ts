import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { emailSends, bouncedEmails, emailContacts, emailEvents } from '@shared/schema';
import { authenticateToken } from '../middleware/auth-middleware';
import { createHmac } from 'crypto';
import { getConvexClient, api } from '../utils/convexClient';

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

    // Extract newsletter tracking tags from webhook data for correlation
    const newsletterTags = event.data ? extractNewsletterTags(event.data) : null;

    console.log('Resend webhook event received:', {
      type: event.type,
      data: event.data,
      ...(newsletterTags && { newsletterTags }),
      timestamp: new Date().toISOString(),
    });

    // Forward to Convex internal handler (fire-and-forget)
    const client = getConvexClient();
    if (client) {
      client.action(api.webhookHandlers.handleResendWebhook, { payload: event })
        .catch(err => console.error('Convex Resend webhook handler failed:', err));
    }

    // Handle different event types (SQL updates)
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
      case 'email.suppressed':
        await handleEmailSuppressed(event.data);
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

    // Forward to Convex internal handler (fire-and-forget)
    const client = getConvexClient();
    if (client) {
      client.action(api.webhookHandlers.handlePostmarkWebhook, { payload: event })
        .catch(err => console.error('Convex Postmark webhook handler failed:', err));
    }

    // Handle different event types (SQL updates)
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

// AhaSend webhook endpoint
webhookRoutes.post("/ahasend", async (req, res) => {
  try {
    const webhookId = req.headers['webhook-id'] as string;
    const webhookTimestamp = req.headers['webhook-timestamp'] as string;
    const webhookSignature = req.headers['webhook-signature'] as string;
    const webhookSecret = process.env.AHASEND_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('⚠️ AHASEND_WEBHOOK_SECRET not configured - skipping signature verification');
    }

    // Verify Standard Webhooks signature if secret is configured
    if (webhookSecret && webhookId && webhookTimestamp && webhookSignature) {
      // Standard Webhooks: sign "${webhook-id}.${webhook-timestamp}.${body}"
      const secretBase64 = webhookSecret.startsWith('whsec_')
        ? webhookSecret.slice(6)
        : webhookSecret;
      const secretBuffer = Buffer.from(secretBase64, 'base64');
      const signedContent = `${webhookId}.${webhookTimestamp}.${JSON.stringify(req.body)}`;
      const expectedSignature = createHmac('sha256', secretBuffer)
        .update(signedContent)
        .digest('base64');

      const signatures = webhookSignature.split(' ');
      const isValid = signatures.some((sig) => {
        const parts = sig.split(',');
        if (parts.length !== 2 || parts[0] !== 'v1') return false;
        return parts[1] === expectedSignature;
      });

      if (!isValid) {
        console.error('Invalid AhaSend webhook signature');
        return res.status(401).json({ message: 'Invalid signature' });
      }
      console.log('✅ AhaSend webhook signature verified');
    }

    const event = req.body;

    // AhaSend event lifecycle:
    //   message.reception  → AhaSend received & queued (maps to "sent")
    //   message.delivered   → Recipient mail server accepted (maps to "delivered")
    //   message.opened      → Recipient opened (requires open tracking enabled in AhaSend)
    //   message.clicked     → Recipient clicked a link
    // Note: AhaSend has NO separate "sent to recipient server" event.
    // For delivered/opened/clicked we fire a synthetic "sent" first to ensure
    // correct Queued → Sent → Delivered → Opened ordering.
    const ahasendEventTypeMap: Record<string, string> = {
      'message.reception': 'sent',
      'message.delivered': 'delivered',
      'message.opened': 'opened',
      'message.clicked': 'clicked',
      'message.bounced': 'bounced',
      'message.failed': 'failed',
      'message.suppressed': 'suppressed',
      'message.deferred': 'deferred',
      'message.transient_error': 'deferred',
      'suppression.created': 'suppressed',
    };

    const normalisedType = ahasendEventTypeMap[event.type];

    console.log('AhaSend webhook event received:', {
      type: event.type,
      normalisedType,
      recipient: event.data?.recipient,
      id: event.data?.id,
      timestamp: new Date().toISOString(),
    });

    // Forward to Convex internal handler (fire-and-forget)
    const client = getConvexClient();
    if (client) {
      client.action(api.webhookHandlers.handleAhaSendWebhook, { payload: event })
        .catch(err => console.error('Convex AhaSend webhook handler failed:', err));
    }

    // Handle SQL updates using existing handlers with normalized AhaSend data
    if (normalisedType && normalisedType !== 'deferred' && event.data) {
      // Normalize AhaSend data to match the format expected by existing handlers
      const normalizedData = {
        ...event.data,
        to: event.data.recipient ? [event.data.recipient] : [],
        email_id: event.data.id,
      };

      // For delivered/opened/clicked: fire synthetic "sent" first to ensure ordering
      if (normalisedType === 'delivered' || normalisedType === 'opened' || normalisedType === 'clicked') {
        await handleEmailSent(normalizedData);
      }

      switch (normalisedType) {
        case 'sent':
          await handleEmailSent(normalizedData);
          break;
        case 'delivered':
          await handleEmailDelivered(normalizedData);
          break;
        case 'bounced':
          await handleEmailBounced(normalizedData);
          break;
        case 'opened':
          await handleEmailOpened(normalizedData);
          break;
        case 'clicked':
          await handleEmailClicked(normalizedData);
          break;
        case 'suppressed':
          await handleEmailSuppressed(normalizedData);
          break;
        case 'failed':
          await handleEmailBounced(normalizedData);
          break;
        default:
          console.log(`Unhandled AhaSend event type: ${event.type}`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('AhaSend webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

// Helper functions for webhook event handling
async function handleEmailSent(data: any) {
  try {
    const nlTags = extractNewsletterTags(data);
    console.log('Email sent event:', { providerMessageId: data.email_id || data.id, ...(nlTags && { newsletterTags: nlTags }) });

    // Extract provider_message_id from webhook data
    const providerMessageId = extractProviderMessageId(data);
    if (!providerMessageId) {
      console.error('Could not extract provider_message_id from webhook data');
      return;
    }

    console.log(`Processing sent event for provider_message_id: ${providerMessageId}`, nlTags ? `[trackingId=${nlTags.trackingId}]` : '');

    // Find the email_sends record
    const emailSend = await findEmailSendByProviderId(providerMessageId);
    if (!emailSend) {
      console.log(`Email send record not found for provider_message_id: ${providerMessageId}`);
      return;
    }

    // Update email_sends status
    await db.update(emailSends)
      .set({
        status: 'sent',
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(sql`${emailSends.id} = ${emailSend.id}`);

    // Create email_events record
    await createEmailEvent(emailSend.id, data, 'sent');

    // Update contact metrics if contact is linked
    if (emailSend.contactId) {
      await updateContactMetrics(emailSend.contactId, 'sent');
    }



    console.log(`Successfully processed sent event for email_send: ${emailSend.id}`);
  } catch (error) {
    console.error('Error handling email sent event:', error);
  }
}

async function handleEmailDelivered(data: any) {
  try {
    const nlTags = extractNewsletterTags(data);
    console.log('Email delivered event:', { providerMessageId: data.email_id || data.id, ...(nlTags && { newsletterTags: nlTags }) });

    // Extract provider_message_id from webhook data
    const providerMessageId = extractProviderMessageId(data);
    if (!providerMessageId) {
      console.error('Could not extract provider_message_id from webhook data');
      return;
    }

    console.log(`Processing delivered event for provider_message_id: ${providerMessageId}`, nlTags ? `[trackingId=${nlTags.trackingId}]` : '');

    // Find the email_sends record
    const emailSend = await findEmailSendByProviderId(providerMessageId);
    if (!emailSend) {
      console.log(`Email send record not found for provider_message_id: ${providerMessageId}`);
      return;
    }

    // Update email_sends status
    await db.update(emailSends)
      .set({
        status: 'delivered',
        deliveredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(sql`${emailSends.id} = ${emailSend.id}`);

    // Create email_events record
    await createEmailEvent(emailSend.id, data, 'delivered');

    // Update contact metrics if contact is linked
    if (emailSend.contactId) {
      await updateContactMetrics(emailSend.contactId, 'delivered');
    }



    console.log(`Successfully processed delivered event for email_send: ${emailSend.id}`);
  } catch (error) {
    console.error('Error handling email delivered event:', error);
  }
}

async function handleEmailBounced(data: any) {
  try {
    const nlTags = extractNewsletterTags(data);
    console.log('Email bounced event:', { providerMessageId: data.email_id || data.id, ...(nlTags && { newsletterTags: nlTags }) });

    // Extract provider_message_id from webhook data
    const providerMessageId = extractProviderMessageId(data);
    const email = data.email || data.Email;
    const reason = data.reason || data.Type || 'bounce';
    const description = data.description || data.Description || 'Email bounced';

    // Update email_sends if we have provider_message_id
    if (providerMessageId) {
      const emailSend = await findEmailSendByProviderId(providerMessageId);
      if (emailSend) {
        await db.update(emailSends)
          .set({
            status: 'bounced',
            errorMessage: description,
            updatedAt: new Date(),
          })
          .where(sql`${emailSends.id} = ${emailSend.id}`);

        // Create email_events record
        await createEmailEvent(emailSend.id, data, 'bounced');



        console.log(`Updated email_send ${emailSend.id} as bounced`);
      }
    }

    // Add to bounced emails table
    if (email) {
      // Check if already exists
      const existingBounce = await db.query.bouncedEmails.findFirst({
        where: sql`${bouncedEmails.email} = ${email}`,
      });

      if (!existingBounce) {
        await db.insert(bouncedEmails).values({
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
    const nlTags = extractNewsletterTags(data);
    console.log('Email complained event:', { providerMessageId: data.email_id || data.id, ...(nlTags && { newsletterTags: nlTags }) });

    // Extract provider_message_id from webhook data
    const providerMessageId = extractProviderMessageId(data);
    const email = data.email || data.Email;
    const reason = 'spam_complaint';
    const description = 'Spam complaint received';

    // Derive tenantId from the originating email_send record
    let sourceTenantId: string | null = null;

    // Update email_sends if we have provider_message_id
    if (providerMessageId) {
      const emailSend = await findEmailSendByProviderId(providerMessageId);
      if (emailSend) {
        sourceTenantId = emailSend.tenantId || null;

        // Create email_events record
        await createEmailEvent(emailSend.id, data, 'complained');



        console.log(`Recorded complaint event for email_send ${emailSend.id}`);
      }
    }

    // Add to bounced emails table with tenant-scoped complaint
    if (email) {
      // Check if already exists
      const existingBounce = await db.query.bouncedEmails.findFirst({
        where: sql`${bouncedEmails.email} = ${email}`,
      });

      if (!existingBounce) {
        await db.insert(bouncedEmails).values({
          email,
          bounceType: 'complaint',
          bounceReason: description,
          firstBouncedAt: new Date(),
          lastBouncedAt: new Date(),
          sourceTenantId: sourceTenantId,
          suppressionReason: reason,
        });
        console.log(`Added spam complaint: ${email} (sourceTenantId=${sourceTenantId || 'unknown'})`);
      }
    }
  } catch (error) {
    console.error('Error handling email complained event:', error);
  }
}

async function handleEmailSuppressed(data: any) {
  try {
    const nlTags = extractNewsletterTags(data);
    console.log('Email suppressed event:', { providerMessageId: data.email_id || data.id, ...(nlTags && { newsletterTags: nlTags }) });

    const providerMessageId = extractProviderMessageId(data);
    // Use extractRecipientEmail to handle Resend's data.to array format (same as all other handlers)
    const email = extractRecipientEmail(data) || data.email || data.Email;
    const reason = data.reason || data.type || 'suppressed';
    const description = data.description || data.message || 'Email suppressed by provider';

    if (!email) {
      console.error('Could not extract email from suppression webhook data:', JSON.stringify(data, null, 2));
      return;
    }

    console.log(`Processing suppression event for: ${email}`);

    let sourceTenantId: string | null = null;

    // Update email_sends if we have provider_message_id
    if (providerMessageId) {
      const emailSend = await findEmailSendByProviderId(providerMessageId);
      if (emailSend) {
        sourceTenantId = emailSend.tenantId || null;

        await db.update(emailSends)
          .set({
            status: 'suppressed',
            errorMessage: description,
            updatedAt: new Date(),
          })
          .where(sql`${emailSends.id} = ${emailSend.id}`);

        // Create email_events record
        await createEmailEvent(emailSend.id, data, 'suppressed');



        console.log(`Updated email_send ${emailSend.id} as suppressed`);
      }
    }

    // Add to global suppression list (bouncedEmails table)
    if (email) {
      const emailLower = email.toLowerCase().trim();

      const existingSuppression = await db.query.bouncedEmails.findFirst({
        where: sql`${bouncedEmails.email} = ${emailLower}`,
      });

      if (!existingSuppression) {
        await db.insert(bouncedEmails).values({
          email: emailLower,
          bounceType: 'suppressed',
          bounceReason: description,
          firstBouncedAt: new Date(),
          lastBouncedAt: new Date(),
          sourceTenantId,
          suppressionReason: reason,
        });
        console.log(`Added suppressed email to global list: ${emailLower}`);
      } else {
        // Update existing record with latest suppression info
        await db.update(bouncedEmails)
          .set({
            lastBouncedAt: new Date(),
            bounceCount: sql`COALESCE(${bouncedEmails.bounceCount}, 1) + 1`,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(sql`${bouncedEmails.id} = ${existingSuppression.id}`);
      }

      // Update contact status to 'suppressed' for all tenants that have this contact
      try {
        await db.update(emailContacts)
          .set({
            status: 'suppressed',
            lastActivity: new Date(),
            updatedAt: new Date(),
          })
          .where(sql`LOWER(${emailContacts.email}) = ${emailLower} AND ${emailContacts.status} != 'suppressed'`);
        console.log(`Updated contact status to suppressed for: ${emailLower}`);
      } catch (contactErr) {
        console.error('Error updating contact status for suppressed email:', contactErr);
      }
    }
  } catch (error) {
    console.error('Error handling email suppressed event:', error);
  }
}

async function handleEmailOpened(data: any) {
  try {
    const nlTags = extractNewsletterTags(data);
    console.log('Email opened event:', { providerMessageId: data.email_id || data.id, ...(nlTags && { newsletterTags: nlTags }) });

    // Extract provider_message_id from webhook data
    const providerMessageId = extractProviderMessageId(data);
    if (!providerMessageId) {
      console.error('Could not extract provider_message_id from webhook data');
      return;
    }

    console.log(`Processing opened event for provider_message_id: ${providerMessageId}`, nlTags ? `[trackingId=${nlTags.trackingId}]` : '');

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



    console.log(`Successfully processed opened event for email_send: ${emailSend.id}`);
  } catch (error) {
    console.error('Error handling email opened event:', error);
  }
}

async function handleEmailClicked(data: any) {
  try {
    const nlTags = extractNewsletterTags(data);
    console.log('Email clicked event:', { providerMessageId: data.email_id || data.id, ...(nlTags && { newsletterTags: nlTags }) });

    // Extract provider_message_id from webhook data
    const providerMessageId = extractProviderMessageId(data);
    if (!providerMessageId) {
      console.error('Could not extract provider_message_id from webhook data');
      return;
    }

    console.log(`Processing clicked event for provider_message_id: ${providerMessageId}`, nlTags ? `[trackingId=${nlTags.trackingId}]` : '');

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

// Helper function to extract newsletter tracking tags from Resend webhook data
// Resend sends tags as an object: { tagName: tagValue } in the webhook payload
function extractNewsletterTags(data: any): { type?: string; newsletterId?: string; groupUUID?: string; tenantId?: string; recipientId?: string; trackingId?: string } | null {
  const tags = data.tags;
  if (!tags || typeof tags !== 'object') return null;

  const result: any = {};
  if (tags.type) result.type = tags.type;
  if (tags.newsletterId) result.newsletterId = tags.newsletterId;
  if (tags.groupUUID) result.groupUUID = tags.groupUUID;
  if (tags.tenantId) result.tenantId = tags.tenantId;
  if (tags.recipientId) result.recipientId = tags.recipientId;
  if (tags.trackingId) result.trackingId = tags.trackingId;

  return Object.keys(result).length > 0 ? result : null;
}

// Helper function to extract recipient email from webhook data
function extractRecipientEmail(data: any): string | null {
  // Resend format - uses 'to' as array of recipients
  if (data.to && Array.isArray(data.to)) {
    const recipient = data.to[0];
    if (typeof recipient === 'string') return recipient;
    if (recipient && recipient.email) return recipient.email;
  } else if (data.to && typeof data.to === 'string') {
    return data.to;
  }

  // Direct email field fallback
  if (data.email) return data.email;

  // Postmark format
  if (data.Email) return data.Email;

  return null;
}

// Helper function to find email_sends by provider_message_id
async function findEmailSendByProviderId(providerMessageId: string) {
  try {
    const emailSend = await db.query.emailSends.findFirst({
      where: sql`${emailSends.providerMessageId} = ${providerMessageId}`,
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
        updateData.emailsSent = sql`${emailContacts.emailsSent} + 1`;
        break;
      case 'opened':
        updateData.emailsOpened = sql`${emailContacts.emailsOpened} + 1`;
        break;
      case 'clicked':
        // Clicks also count as opens
        updateData.emailsOpened = sql`${emailContacts.emailsOpened} + 1`;
        break;
    }

    await db.update(emailContacts)
      .set(updateData)
      .where(sql`${emailContacts.id} = ${contactId}`);

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

    await db.insert(emailEvents).values({
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