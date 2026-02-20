import { Router } from 'express';
import { db, schema } from '../db';
import { sql } from 'drizzle-orm';
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

// Test webhook endpoint for testing email events (no auth required in standalone server)
webhookRoutes.post("/test/webhook-event", async (req: any, res) => {
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

// Resend webhook endpoint (POST)
webhookRoutes.post("/resend", async (req, res) => {
  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      path: req.path,
      ip: req.ip,
      ips: req.ips,
      protocol: req.protocol,
      secure: req.secure,
      headers: req.headers,
      query: req.query,
      params: req.params,
      body: req.body,
      rawBody: (req as any).rawBody,
      cookies: req.cookies,
      hostname: req.hostname,
      subdomains: req.subdomains,
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
      contentLength: req.get('Content-Length'),
      authorization: req.get('Authorization'),
      origin: req.get('Origin'),
      referer: req.get('Referer'),
      acceptLanguage: req.get('Accept-Language'),
      acceptEncoding: req.get('Accept-Encoding'),
      resendSignature: req.get('resend-signature'),
      postmarkSignature: req.get('x-postmark-signature'),
      bodySize: JSON.stringify(req.body).length,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    console.log('🔔 RESEND WEBHOOK RECEIVED - FULL DEBUG INFO:');
    console.log('═'.repeat(80));
    console.log(JSON.stringify(debugInfo, null, 2));
    console.log('═'.repeat(80));

    const signature = req.headers['resend-signature'] as string;
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    // For testing purposes, skip signature verification if no secret is configured
    if (!webhookSecret) {
      console.warn('⚠️ RESEND_WEBHOOK_SECRET not configured - skipping signature verification');
    }

    // Verify webhook signature (only if secret is configured)
    if (signature && webhookSecret) {
      const expectedSignature = createHmac('sha256', webhookSecret!)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('❌ Invalid webhook signature');
        return res.status(401).json({ message: 'Invalid signature' });
      }
      console.log('✅ Webhook signature verified');
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
    const debugInfo = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      path: req.path,
      ip: req.ip,
      ips: req.ips,
      protocol: req.protocol,
      secure: req.secure,
      headers: req.headers,
      query: req.query,
      params: req.params,
      body: req.body,
      rawBody: (req as any).rawBody,
      cookies: req.cookies,
      hostname: req.hostname,
      subdomains: req.subdomains,
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
      contentLength: req.get('Content-Length'),
      authorization: req.get('Authorization'),
      origin: req.get('Origin'),
      referer: req.get('Referer'),
      acceptLanguage: req.get('Accept-Language'),
      acceptEncoding: req.get('Accept-Encoding'),
      resendSignature: req.get('resend-signature'),
      postmarkSignature: req.get('x-postmark-signature'),
      bodySize: JSON.stringify(req.body).length,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    console.log('🔔 POSTMARK WEBHOOK RECEIVED - FULL DEBUG INFO:');
    console.log('═'.repeat(80));
    console.log(JSON.stringify(debugInfo, null, 2));
    console.log('═'.repeat(80));

    const signature = req.headers['x-postmark-signature'] as string;
    const webhookSecret = process.env.POSTMARK_WEBHOOK_SECRET;

    // For testing purposes, skip signature verification if no secret is configured
    if (!webhookSecret) {
      console.warn('⚠️ POSTMARK_WEBHOOK_SECRET not configured - skipping signature verification');
    }

    // Verify webhook signature
    if (signature) {
      const expectedSignature = createHmac('sha256', webhookSecret!)
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
    //   message.opened      → Recipient opened (requires open tracking enabled)
    //   message.clicked     → Recipient clicked a link
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

    // Handle SQL updates using existing handlers with normalized AhaSend data
    if (normalisedType && normalisedType !== 'deferred' && event.data) {
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
    const nlTags = extractNewsletterTags(data);
    console.log('Email delivered event:', { providerMessageId: data.email_id || data.id, ...(nlTags && { newsletterTags: nlTags }) });

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
    const nlTags = extractNewsletterTags(data);
    console.log('Email bounced event:', { providerMessageId: data.email_id || data.id, ...(nlTags && { newsletterTags: nlTags }) });
    
    // Add to bounced emails table
    const email = data.email || data.Email;
    const bounceType = data.bounceType || data.Type || 'hard';
    const bounceReason = data.bounceReason || data.Description || 'Email bounced';

    if (email) {
      // Check if already exists
      const existingBounce = await db.query.bouncedEmails.findFirst({
        where: sql`${schema.bouncedEmails.email} = ${email}`,
      });

      if (!existingBounce) {
        await db.insert(schema.bouncedEmails).values({
          email,
          bounceType,
          bounceReason,
          firstBouncedAt: new Date(),
          lastBouncedAt: new Date(),
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
    
    const email = data.email || data.Email;
    const bounceReason = 'Spam complaint received';

    // Try to derive sourceTenantId from the most recent email_send to this address
    let sourceTenantId: string | null = null;
    if (email) {
      try {
        const recentSend = await db.query.emailSends.findFirst({
          where: sql`${schema.emailSends.recipientEmail} = ${email}`,
          orderBy: sql`${schema.emailSends.createdAt} DESC`,
        });
        if (recentSend) {
          sourceTenantId = recentSend.tenantId || null;
        }
      } catch (lookupErr) {
        console.warn('Could not derive sourceTenantId for complaint:', lookupErr);
      }
    }

    if (email) {
      // Check if already exists
      const existingBounce = await db.query.bouncedEmails.findFirst({
        where: sql`${schema.bouncedEmails.email} = ${email}`,
      });

      if (!existingBounce) {
        await db.insert(schema.bouncedEmails).values({
          email,
          bounceType: 'complaint',
          bounceReason,
          firstBouncedAt: new Date(),
          lastBouncedAt: new Date(),
          sourceTenantId: sourceTenantId,
          suppressionReason: 'spam_complaint',
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

    // Use extractRecipientEmail to handle Resend's data.to array format (same as all other handlers)
    const email = extractRecipientEmail(data) || data.email || data.Email;
    const reason = data.reason || data.type || 'suppressed';
    const description = data.description || data.message || 'Email suppressed by provider';

    if (!email) {
      console.error('Could not extract email from suppression webhook data:', JSON.stringify(data, null, 2));
      return;
    }

    console.log(`Processing suppression event for: ${email}`);

    // Derive sourceTenantId from the most recent email_send to this address
    let sourceTenantId: string | null = null;
    if (email) {
      try {
        const recentSend = await db.query.emailSends.findFirst({
          where: sql`${schema.emailSends.recipientEmail} = ${email}`,
          orderBy: sql`${schema.emailSends.createdAt} DESC`,
        });
        if (recentSend) {
          sourceTenantId = recentSend.tenantId || null;
        }
      } catch (lookupErr) {
        console.warn('Could not derive sourceTenantId for suppression:', lookupErr);
      }
    }

    // Add to global suppression list (bouncedEmails table)
    if (email) {
      const emailLower = email.toLowerCase().trim();

      const existingSuppression = await db.query.bouncedEmails.findFirst({
        where: sql`${schema.bouncedEmails.email} = ${emailLower}`,
      });

      if (!existingSuppression) {
        await db.insert(schema.bouncedEmails).values({
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
        await db.update(schema.bouncedEmails)
          .set({
            lastBouncedAt: new Date(),
            bounceCount: sql`COALESCE(${schema.bouncedEmails.bounceCount}, 1) + 1`,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(sql`${schema.bouncedEmails.id} = ${existingSuppression.id}`);
      }

      // Update contact status to 'suppressed' for all tenants
      try {
        await db.update(schema.emailContacts)
          .set({
            status: 'suppressed',
            lastActivity: new Date(),
            updatedAt: new Date(),
          })
          .where(sql`LOWER(${schema.emailContacts.email}) = ${emailLower} AND ${schema.emailContacts.status} != 'suppressed'`);
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
    const nlTags = extractNewsletterTags(data);
    console.log('Email clicked event:', { providerMessageId: data.email_id || data.id, ...(nlTags && { newsletterTags: nlTags }) });

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

// Helper function to extract newsletter tracking tags from Resend webhook data
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
    const tenantId = process.env.DEFAULT_TENANT_ID || '991c761b-bc2e-40c4-ac8e-aa9391f58eef';

    const contact = await db.query.emailContacts.findFirst({
      where: sql`${schema.emailContacts.email} = ${email} AND ${schema.emailContacts.tenantId} = ${tenantId}`,
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
        updateData.emailsSent = sql`${schema.emailContacts.emailsSent} + 1`;
        break;
      case 'opened':
        updateData.emailsOpened = sql`${schema.emailContacts.emailsOpened} + 1`;
        break;
      case 'clicked':
        // Clicks also count as opens
        updateData.emailsOpened = sql`${schema.emailContacts.emailsOpened} + 1`;
        break;
    }

    await db.update(schema.emailContacts)
      .set(updateData)
      .where(sql`${schema.emailContacts.id} = ${contactId}`);

    console.log(`Updated contact ${contactId} metrics for ${activityType}`);
  } catch (error) {
    console.error('Error updating contact metrics:', error);
  }
}

// Helper function to create email activity record
async function createEmailActivity(contactId: string, webhookData: any, activityType: string, recipientEmail: string) {
  try {
    // Get tenant ID from environment or request context
    const tenantId = process.env.DEFAULT_TENANT_ID || '991c761b-bc2e-40c4-ac8e-aa9391f58eef';

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

    await db.insert(schema.emailActivity).values({
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

// Catch-all route for any webhook requests that don't match specific endpoints
// This should be LAST to catch unmatched routes
webhookRoutes.all("*", async (req, res, next) => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    path: req.path,
    ip: req.ip,
    ips: req.ips,
    protocol: req.protocol,
    secure: req.secure,
    headers: req.headers,
    query: req.query,
    params: req.params,
    body: req.body,
    rawBody: (req as any).rawBody,
    cookies: req.cookies,
    hostname: req.hostname,
    subdomains: req.subdomains,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    authorization: req.get('Authorization'),
    origin: req.get('Origin'),
    referer: req.get('Referer'),
    acceptLanguage: req.get('Accept-Language'),
    acceptEncoding: req.get('Accept-Encoding'),
    resendSignature: req.get('resend-signature'),
    postmarkSignature: req.get('x-postmark-signature'),
    bodySize: req.body ? JSON.stringify(req.body).length : 0,
    requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  console.log('🔔 CATCH-ALL WEBHOOK RECEIVED - FULL DEBUG INFO:');
  console.log('═'.repeat(80));
  console.log('🚨 UNMATCHED WEBHOOK PATH:', req.path);
  console.log(JSON.stringify(debugInfo, null, 2));
  console.log('═'.repeat(80));

  // Send a response indicating we received but didn't process
  res.status(200).json({
    received: true,
    message: 'Webhook received but no specific handler found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /resend',
      'POST /resend', 
      'POST /postmark',
      'POST /test/webhook-event'
    ]
  });
});
