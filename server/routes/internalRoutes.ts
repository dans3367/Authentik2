import { Router } from 'express';
import { db } from '../db';
import { emailActivity, emailSends, emailContent, emailContacts } from '@shared/schema';
import { authenticateInternalService, InternalServiceRequest } from '../middleware/internal-service-auth';
import crypto from 'crypto';
import { sql, eq } from 'drizzle-orm';

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

      // Import email service
      const { enhancedEmailService } = await import('../emailService');

      // Send the promotional email
      const promoResult = await enhancedEmailService.sendCustomEmail(
        recipientEmail,
        `🎁 ${promoSubject}`,
        htmlPromo,
        {
          text: htmlPromo.replace(/<[^>]*>/g, ''),
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
            htmlContent: htmlPromo,
            textContent: htmlPromo.replace(/<[^>]*>/g, ''),
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
          htmlContent: htmlPromo,
          textContent: htmlPromo.replace(/<[^>]*>/g, ''),
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
      let { emailTrackingId, providerMessageId, status } = req.body;

      // Normalize 'queued' to 'pending' to support external callers (e.g. Trigger.dev)
      if (status === 'queued') {
        status = 'pending';
      }

      const allowedStatuses = [
        'pending',
        'sent',
        'delivered',
        'bounced',
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

      // Only require providerMessageId for non-failed statuses
      if (validatedStatus !== 'failed' && !providerMessageId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: providerMessageId is required for non-failed statuses',
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

      if (validatedStatus === 'sent') {
        updatePayload.sentAt = now;
      }

      const result = await db.update(emailSends)
        .set(updatePayload)
        .where(eq(emailSends.id, emailTrackingId))
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
            .where(eq(emailContacts.id, result[0].contactId));
          console.log(`✅ [Internal API] Incremented emailsSent for contact ${result[0].contactId}`);
        } catch (metricsUpdateError) {
          console.warn(`⚠️ [Internal API] Failed to update contact emailsSent:`, metricsUpdateError);
        }
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

export default router;
