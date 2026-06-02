import { Router } from 'express';
import { db } from '../db';
import { emailActivity, emailSends, emailContent, emailContacts, masterEmailDesign, companies, bouncedEmails } from '@shared/schema';
import { authenticateInternalService, InternalServiceRequest } from '../middleware/internal-service-auth';
import crypto from 'crypto';
import { sql, eq, and, or, ne } from 'drizzle-orm';
import { wrapNewsletterContent } from '../utils/newsletterEmailWrapper';
import {
  initEmailCampaign,
  trackEmailCampaignSend,
  completeEmailCampaign,
  buildCampaignId,
} from '../utils/convexEmailTracker';

const router = Router();

/**
 * Internal endpoint for sending promotional emails
 * Called by Trigger.dev tasks to execute email sends with proper database logging
 */
router.post(
  '/send-promotional-email',
  authenticateInternalService,
  async (req: InternalServiceRequest, res) => {
    try {
      const {
        tenantId,
        contactId,
        recipientEmail,
        recipientName,
        senderName,
        promoSubject,
        htmlPromo,
        unsubscribeToken,
        promotionId,
        manual,
      } = req.body;

      // Validate required fields
      if (!tenantId || !contactId || !recipientEmail || !promoSubject || !htmlPromo) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
        });
      }

      console.log(`📧 [Internal API] Sending promotional email to ${recipientEmail}`);

      // Pre-send suppression check: block sending to suppressed/bounced emails
      const emailLower = recipientEmail.toLowerCase().trim();
      const suppressionEntry = await db.query.bouncedEmails.findFirst({
        where: and(
          sql`LOWER(${bouncedEmails.email}) = ${emailLower}`,
          eq(bouncedEmails.isActive, true as any),
          or(
            ne(bouncedEmails.bounceType, 'complaint'),
            and(
              eq(bouncedEmails.bounceType, 'complaint'),
              eq(bouncedEmails.sourceTenantId, tenantId)
            )
          )
        ),
      });

      if (suppressionEntry) {
        console.warn(`🚫 [Internal API] Blocked promotional email to suppressed address: ${recipientEmail} (type: ${suppressionEntry.bounceType})`);
        return res.status(200).json({
          success: false,
          blocked: true,
          reason: suppressionEntry.bounceType,
          recipientEmail,
          contactId,
        });
      }

      // Also check contact status
      if (contactId) {
        const contact = await db.query.emailContacts.findFirst({
          where: and(
            eq(emailContacts.id, contactId),
            eq(emailContacts.tenantId, tenantId)
          ),
          columns: { status: true },
        });
        if (contact && (contact.status === 'suppressed' || contact.status === 'bounced' || contact.status === 'unsubscribed')) {
          console.warn(`🚫 [Internal API] Blocked promotional email - contact ${contactId} status: ${contact.status}`);
          return res.status(200).json({
            success: false,
            blocked: true,
            reason: `contact_${contact.status}`,
            recipientEmail,
            contactId,
          });
        }
      }

      const wrappedHtmlPromo = await wrapNewsletterContent(tenantId, htmlPromo);

      // Import email service
      const { enhancedEmailService } = await import('../emailService');

      // Send the promotional email
      const promoResult = await enhancedEmailService.sendCustomEmail(
        recipientEmail,
        `🎁 ${promoSubject}`,
        wrappedHtmlPromo,
        {
          text: wrappedHtmlPromo.replace(/<[^>]*>/g, ''),
          from: 'admin@zendwise.com',
          metadata: {
            type: 'birthday-promotion',
            contactId,
            tenantId,
            manual: !!manual,
            tags: ['birthday', ...(manual ? ['manual'] : []), 'promotion', `tenant-${tenantId}`],
            unsubscribeToken: unsubscribeToken || 'none',
          },
        }
      );

      // Check if email send was successful
      if (!promoResult.success) {
        console.error(`❌ [Internal API] Failed to send promotional email:`, {
          recipient: recipientEmail,
          contactId,
          tenantId,
          error: promoResult.error,
          providerId: promoResult.providerId,
        });

        // Log failed activity
        try {
          await db.insert(emailActivity).values({
            tenantId,
            contactId,
            activityType: 'failed',
            activityData: JSON.stringify({
              type: 'birthday-promotion',
              manual: !!manual,
              split: true,
              subject: `🎁 ${promoSubject}`,
              recipient: recipientEmail,
              from: 'admin@zendwise.com',
              error: promoResult.error,
              providerId: promoResult.providerId,
            }),
            occurredAt: new Date(),
          });
        } catch (logError) {
          console.error(`⚠️ [Internal API] Failed to log failed email activity:`, logError);
        }

        // Log failed send to email_sends table
        try {
          const emailSendId = crypto.randomUUID();
          await db.insert(emailSends).values({
            id: emailSendId,
            tenantId,
            recipientEmail,
            recipientName: recipientName || recipientEmail,
            senderEmail: 'admin@zendwise.com',
            senderName: senderName || 'Your Team',
            subject: `🎁 ${promoSubject}`,
            emailType: 'promotional',
            provider: promoResult.providerId || 'resend',
            providerMessageId: promoResult.messageId || null,
            status: 'failed',
            contactId,
            sentAt: new Date(),
          });

          // Log email content
          await db.insert(emailContent).values({
            emailSendId,
            htmlContent: wrappedHtmlPromo,
            textContent: wrappedHtmlPromo.replace(/<[^>]*>/g, ''),
          });
        } catch (logError) {
          console.error(`⚠️ [Internal API] Failed to log to email_sends table:`, logError);
        }

        return res.status(500).json({
          success: false,
          error: promoResult.error || 'Failed to send email',
          providerId: promoResult.providerId,
        });
      }

      console.log(`✅ [Internal API] Promotional email sent successfully:`, {
        recipient: recipientEmail,
        contactId,
        messageId: promoResult.messageId,
      });

      // Log successful activity
      try {
        await db.insert(emailActivity).values({
          tenantId,
          contactId,
          activityType: 'sent',
          activityData: JSON.stringify({
            type: 'birthday-promotion',
            manual: !!manual,
            split: true,
            subject: `🎁 ${promoSubject}`,
            recipient: recipientEmail,
            from: 'admin@zendwise.com',
            messageId: promoResult.messageId,
            providerId: promoResult.providerId,
          }),
          occurredAt: new Date(),
        });
      } catch (logError) {
        console.error(`⚠️ [Internal API] Failed to log email activity:`, logError);
      }

      // Log successful send to email_sends table
      try {
        const emailSendId = crypto.randomUUID();
        await db.insert(emailSends).values({
          id: emailSendId,
          tenantId,
          recipientEmail,
          recipientName: recipientName || recipientEmail,
          senderEmail: 'admin@zendwise.com',
          senderName: senderName || 'Your Team',
          subject: `🎁 ${promoSubject}`,
          emailType: 'promotional',
          provider: promoResult.providerId || 'resend',
          providerMessageId: promoResult.messageId || null,
          status: 'sent',
          contactId,
          sentAt: new Date(),
        });

        // Log email content
        await db.insert(emailContent).values({
          emailSendId,
          htmlContent: wrappedHtmlPromo,
          textContent: wrappedHtmlPromo.replace(/<[^>]*>/g, ''),
        });
      } catch (logError) {
        console.error(`⚠️ [Internal API] Failed to log to email_sends table:`, logError);
      }

      return res.json({
        success: true,
        messageId: promoResult.messageId,
        providerId: promoResult.providerId,
        contactId,
        recipientEmail,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [Internal API] Error sending promotional email:', errorMessage);
      return res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }
);

/**
 * Internal endpoint for updating email_sends record with actual provider message ID
 * Called by Trigger.dev tasks after successfully sending an email
 */
router.post(
  '/update-email-send',
  authenticateInternalService,
  async (req: InternalServiceRequest, res) => {
    try {
      let { emailTrackingId, providerMessageId, status, errorMessage } = req.body;

      // Normalize 'queued' to 'pending' to support external callers (e.g. Trigger.dev)
      if (status === 'queued') {
        status = 'pending';
      }

      const allowedStatuses = [
        'pending',
        'sent',
        'delivered',
        'bounced',
        'suppressed',
        'failed',
      ];

      if (status !== undefined && (!status || !allowedStatuses.includes(status))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status value',
          allowedStatuses,
        });
      }

      const validatedStatus = status || 'sent';

      if (!emailTrackingId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: emailTrackingId',
        });
      }

      // Only require providerMessageId for terminal success statuses (sent, delivered)
      // 'pending' is a pre-send status update where providerMessageId doesn't exist yet
      if (!['failed', 'pending', 'suppressed'].includes(validatedStatus) && !providerMessageId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: providerMessageId is required for sent/delivered statuses',
        });
      }

      const existingSend = await db.query.emailSends.findFirst({
        where: eq(emailSends.id, emailTrackingId),
        columns: { id: true, tenantId: true },
      });

      if (!existingSend) {
        console.warn(`⚠️ [Internal API] No email_sends record found for tracking ID ${emailTrackingId}`);
        return res.status(404).json({
          success: false,
          error: 'Email send record not found',
        });
      }

      console.log(`📧 [Internal API] Updating email_sends record for tracking ID ${emailTrackingId} with status ${validatedStatus}${providerMessageId ? ` and provider ID ${providerMessageId}` : ''}`);

      // Find and update the email_sends record by the email tracking ID
      const now = new Date();

      const updatePayload: Record<string, unknown> = {
        status: validatedStatus,
        updatedAt: now,
      };

      // Only include providerMessageId in updatePayload when a real value is provided
      if (providerMessageId) {
        updatePayload.providerMessageId = providerMessageId;
      }
      if (errorMessage) {
        updatePayload.errorMessage = String(errorMessage).slice(0, 1000);
      }

      if (validatedStatus === 'sent') {
        updatePayload.sentAt = now;
      }

      const result = await db.update(emailSends)
        .set(updatePayload)
        .where(and(
          eq(emailSends.id, emailTrackingId),
          eq(emailSends.tenantId, existingSend.tenantId)
        ))
        .returning();

      if (result.length === 0) {
        console.warn(`⚠️ [Internal API] No email_sends record found for tracking ID ${emailTrackingId}`);
        return res.status(404).json({
          success: false,
          error: 'Email send record not found',
        });
      }

      // Increment emailsSent counter on the contact when status is 'sent'
      if (validatedStatus === 'sent' && result[0].contactId) {
        try {
          await db.update(emailContacts)
            .set({
              emailsSent: sql`COALESCE(${emailContacts.emailsSent}, 0) + 1`,
              lastActivity: now,
              updatedAt: now,
            })
            .where(and(
              eq(emailContacts.id, result[0].contactId),
              eq(emailContacts.tenantId, result[0].tenantId)
            ));
          console.log(`✅ [Internal API] Incremented emailsSent for contact ${result[0].contactId}`);
        } catch (metricsUpdateError) {
          console.warn(`⚠️ [Internal API] Failed to update contact emailsSent:`, metricsUpdateError);
        }
      }

      // Mirror to Convex live tracking for individual email sends (scheduled,
      // direct-send retries, etc.). campaignId mirrors the Postgres emailSends.id
      // so webhook events resolve back here. Fire-and-forget.
      const sendRow = result[0];
      if (validatedStatus === 'sent' || validatedStatus === 'failed' || validatedStatus === 'suppressed') {
        const campaignId = buildCampaignId('individual', sendRow.id);
        const trackStatus: 'sent' | 'failed' | 'suppressed' = validatedStatus;
        (async () => {
          await initEmailCampaign({
            tenantId: sendRow.tenantId,
            sendType: 'individual',
            campaignId,
            totalRecipients: 1,
            shopId: sendRow.shopId || undefined,
          });
          await trackEmailCampaignSend({
            tenantId: sendRow.tenantId,
            sendType: 'individual',
            campaignId,
            recipientEmail: sendRow.recipientEmail,
            recipientId: sendRow.contactId || undefined,
            recipientName: sendRow.recipientName || undefined,
            providerMessageId: providerMessageId || undefined,
            status: trackStatus,
            error: errorMessage ? String(errorMessage).slice(0, 500) : undefined,
          });
          await completeEmailCampaign({
            campaignId,
            sentCount: trackStatus === 'sent' ? 1 : 0,
            failedCount: trackStatus === 'sent' ? 0 : 1,
          });
        })().catch((convexErr) => {
          console.warn('[Internal API] Convex live tracking failed (non-fatal):', convexErr);
        });
      }

      console.log(`✅ [Internal API] Updated email_sends record ${result[0].id} with status ${validatedStatus}${providerMessageId ? ` and provider ID ${providerMessageId}` : ''}`);

      return res.json({
        success: true,
        emailSendId: result[0].id,
        providerMessageId,
        status: validatedStatus,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [Internal API] Error updating email_sends:', errorMessage);
      return res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }
);

/**
 * Internal pre-send validation for delayed scheduled contact emails.
 * Called by Trigger.dev immediately before handing an email to the provider.
 */
router.post(
  '/validate-scheduled-contact-email',
  authenticateInternalService,
  async (req: InternalServiceRequest, res) => {
    try {
      const { tenantId, contactId, recipientEmail } = req.body || {};

      if (!tenantId || !contactId || !recipientEmail) {
        return res.status(400).json({
          success: false,
          allowed: false,
          reason: 'missing_required_fields',
        });
      }

      const normalizedRecipient = String(recipientEmail).toLowerCase().trim();
      const contact = await db.query.emailContacts.findFirst({
        where: and(
          eq(emailContacts.id, String(contactId)),
          eq(emailContacts.tenantId, String(tenantId))
        ),
        columns: { id: true, email: true, status: true },
      });

      if (!contact) {
        return res.json({
          success: true,
          allowed: false,
          reason: 'contact_not_found',
        });
      }

      if (String(contact.email).toLowerCase().trim() !== normalizedRecipient) {
        return res.json({
          success: true,
          allowed: false,
          reason: 'recipient_mismatch',
          contactStatus: contact.status,
        });
      }

      if (['unsubscribed', 'bounced', 'suppressed'].includes(contact.status || '')) {
        return res.json({
          success: true,
          allowed: false,
          reason: `contact_${contact.status}`,
          contactStatus: contact.status,
        });
      }

      const suppressionRecord = await db.query.bouncedEmails.findFirst({
        where: and(
          sql`LOWER(${bouncedEmails.email}) = ${normalizedRecipient}`,
          eq(bouncedEmails.isActive, true),
        ),
        columns: {
          bounceType: true,
          suppressionReason: true,
          bounceReason: true,
        },
      });

      if (suppressionRecord) {
        return res.json({
          success: true,
          allowed: false,
          reason: suppressionRecord.suppressionReason || suppressionRecord.bounceReason || suppressionRecord.bounceType || 'suppressed',
          contactStatus: contact.status,
          suppressionType: suppressionRecord.bounceType,
        });
      }

      return res.json({
        success: true,
        allowed: true,
        contactStatus: contact.status,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [Internal API] Error validating scheduled contact email:', errorMessage);
      return res.status(500).json({
        success: false,
        allowed: false,
        reason: 'validation_error',
      });
    }
  }
);

/**
 * Internal endpoint for fetching master email design settings for a tenant
 * Called by Trigger.dev tasks to wrap outgoing emails in the tenant's branded template
 */
router.get(
  '/email-design/:tenantId',
  authenticateInternalService,
  async (req: InternalServiceRequest, res) => {
    try {
      const { tenantId } = req.params;

      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'Missing tenantId' });
      }

      // Fetch master email design
      const emailDesign = await db.query.masterEmailDesign.findFirst({
        where: sql`${masterEmailDesign.tenantId} = ${tenantId}`,
      });

      // Fetch company info for fallbacks
      const company = await db.query.companies.findFirst({
        where: eq(companies.tenantId, tenantId),
      });

      const companyName = (company?.name || '').trim();

      return res.json({
        success: true,
        design: {
          primaryColor: emailDesign?.primaryColor || '#3B82F6',
          secondaryColor: emailDesign?.secondaryColor || '#1E40AF',
          accentColor: emailDesign?.accentColor || '#10B981',
          fontFamily: emailDesign?.fontFamily || 'Arial, sans-serif',
          headerMode: emailDesign?.headerMode || 'logo',
          logoUrl: emailDesign?.logoUrl || null,
          logoSize: emailDesign?.logoSize || 'medium',
          logoAlignment: emailDesign?.logoAlignment || 'center',
          bannerUrl: emailDesign?.bannerUrl || null,
          showCompanyName: emailDesign?.showCompanyName || 'true',
          headerText: emailDesign?.headerText || null,
          footerText: emailDesign?.footerText || (companyName ? `© ${new Date().getFullYear()} ${companyName}. All rights reserved.` : ''),
          socialLinks: emailDesign?.socialLinks || null,
          companyName: emailDesign?.companyName || companyName,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [Internal API] Error fetching email design:', errorMessage);
      return res.status(500).json({ success: false, error: 'Failed to fetch email design' });
    }
  }
);

/**
 * Internal endpoint for logging email activity (sent/failed) from Trigger.dev tasks
 * Called after a scheduled email is sent or fails, to update the contact timeline
 */
router.post(
  '/log-email-activity',
  authenticateInternalService,
  async (req: InternalServiceRequest, res) => {
    try {
      const { tenantId, contactId, activityType, activityData } = req.body;

      if (!tenantId || !contactId || !activityType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: tenantId, contactId, activityType',
        });
      }

      const allowedTypes = ['sent', 'failed', 'suppressed', 'delivered', 'bounced', 'opened', 'clicked'];
      if (!allowedTypes.includes(activityType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid activityType. Allowed: ${allowedTypes.join(', ')}`,
        });
      }

      await db.insert(emailActivity).values({
        tenantId,
        contactId,
        activityType,
        activityData: typeof activityData === 'string' ? activityData : JSON.stringify(activityData),
        occurredAt: new Date(),
      });

      // Update contact's lastActivity timestamp (scoped by tenant)
      try {
        const updateResult = await db.update(emailContacts)
          .set({ lastActivity: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(emailContacts.id, contactId),
              eq(emailContacts.tenantId, tenantId)
            )
          )
          .returning({ id: emailContacts.id });

        // Validate that the contact was actually updated
        if (updateResult.length === 0) {
          console.warn(
            `⚠️ [Internal API] Contact update failed - no rows updated. ` +
            `Contact ${contactId} may not exist or does not belong to tenant ${tenantId}`
          );
        }
      } catch (contactUpdateError) {
        console.warn(`⚠️ [Internal API] Failed to update contact lastActivity:`, contactUpdateError);
      }

      console.log(`✅ [Internal API] Logged email_activity: ${activityType} for contact ${contactId}`);

      return res.json({ success: true, activityType, contactId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [Internal API] Error logging email activity:', errorMessage);
      return res.status(500).json({ success: false, error: 'Failed to log email activity' });
    }
  }
);

export default router;
