/**
 * Birthday Test Service
 * 
 * Extracted from routes.ts to improve testability and separation of concerns.
 * Handles sending test birthday cards via Trigger.dev + Resend.
 */

import { db } from '../db';
import { birthdaySettings, companies, emailContacts, unsubscribeTokens } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { tasks } from '@trigger.dev/sdk/v3';
import { renderBirthdayTemplate, sanitizeEmailHtml } from '../routes/emailManagementRoutes';

export interface BirthdayTestRequest {
    userEmail: string;
    userFirstName?: string;
    userLastName?: string;
    emailTemplate?: string;
    customMessage?: string;
    customThemeData?: any;
    senderName?: string;
    promotionId?: string;
    splitPromotionalEmail?: boolean;
}

export interface BirthdayTestResult {
    success: boolean;
    message?: string;
    error?: string;
    runId?: string;
    promoRunId?: string;
    recipient?: string;
    split?: boolean;
}

/**
 * Fetches or creates an unsubscribe token for a contact
 */
async function getOrCreateUnsubscribeToken(
    tenantId: string,
    contactEmail: string
): Promise<{ token?: string; isOptedOut: boolean }> {
    try {
        const contact = await db.query.emailContacts.findFirst({
            where: and(eq(emailContacts.email, contactEmail), eq(emailContacts.tenantId, tenantId)),
            columns: { id: true, prefCustomerEngagement: true },
        });

        if (contact && contact.prefCustomerEngagement === false) {
            return { isOptedOut: true };
        }

        if (!contact) {
            console.log(`⚠️ [Birthday Test] No contact found for ${contactEmail}, skipping unsubscribe token`);
            return { isOptedOut: false };
        }

        // Look for existing unused token
        let existingToken = await db.query.unsubscribeTokens.findFirst({
            where: and(
                eq(unsubscribeTokens.tenantId, tenantId),
                eq(unsubscribeTokens.contactId, contact.id),
                sql`${unsubscribeTokens.usedAt} IS NULL`
            ),
        });

        if (!existingToken) {
            const token = crypto.randomBytes(24).toString('base64url');
            const created = await db.insert(unsubscribeTokens).values({
                tenantId,
                contactId: contact.id,
                token,
            }).returning();
            existingToken = created[0];
        }

        console.log(`🔗 [Birthday Test] Generated unsubscribe token for ${contactEmail}`);
        return { token: existingToken?.token, isOptedOut: false };
    } catch (error) {
        console.warn(`⚠️ [Birthday Test] Error generating unsubscribe token:`, error);
        return { isOptedOut: false };
    }
}

/**
 * Sends test birthday email(s) - either combined or split flow
 */
export async function sendBirthdayTestEmail(
    tenantId: string,
    userId: string,
    request: BirthdayTestRequest
): Promise<BirthdayTestResult> {
    const { userEmail, userFirstName, userLastName, emailTemplate, customMessage, customThemeData, senderName, splitPromotionalEmail } = request;

    console.log('🎂 [Birthday Test] Sending test birthday card to:', userEmail, 'for tenant:', tenantId);

    if (!userEmail) {
        return { success: false, error: 'userEmail is required' };
    }

    // Fetch birthday settings for this tenant
    const settings = await db.query.birthdaySettings.findFirst({
        where: eq(birthdaySettings.tenantId, tenantId),
        with: { promotion: true },
    });

    // Fetch company info for branding
    const company = await db.query.companies.findFirst({
        where: and(eq(companies.tenantId, tenantId), eq(companies.isActive, true)),
    });

    const resolvedTemplate = emailTemplate || settings?.emailTemplate || 'default';
    const resolvedMessage = customMessage || settings?.customMessage || 'Wishing you a wonderful birthday!';
    const resolvedCustomThemeData = customThemeData || settings?.customThemeData || null;
    const resolvedSenderName = senderName || settings?.senderName || company?.name || 'Your Team';
    const companyName = company?.name || resolvedSenderName;

    // Build recipient name
    const recipientName = userFirstName
        ? `${userFirstName}${userLastName ? ` ${userLastName}` : ''}`
        : userEmail.split('@')[0];

    // Get or create unsubscribe token
    const { token: unsubscribeToken, isOptedOut } = await getOrCreateUnsubscribeToken(tenantId, userEmail);

    if (isOptedOut) {
        console.log(`🚫 [Birthday Test] Contact ${userEmail} has opted out of Customer Engagement emails`);
        return {
            success: false,
            error: 'This contact has opted out of Customer Engagement emails. The birthday card was not sent.',
        };
    }

    // Build unsubscribe URL for List-Unsubscribe header
    const baseUrl = process.env.APP_URL || 'http://localhost:5000';
    const unsubscribeUrl = unsubscribeToken
        ? `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&type=customer_engagement`
        : undefined;

    // Determine if we should split the email
    const shouldSplit = (splitPromotionalEmail ?? settings?.splitPromotionalEmail) && settings?.promotion;

    console.log(`📧 [Birthday Test] Split email enabled: ${splitPromotionalEmail ?? settings?.splitPromotionalEmail}, Has promotion: ${!!settings?.promotion}, Will split: ${!!shouldSplit}`);

    if (shouldSplit && settings?.promotion) {
        return await sendSplitBirthdayEmails(tenantId, userId, {
            userEmail,
            recipientName,
            resolvedTemplate,
            resolvedMessage,
            resolvedCustomThemeData,
            resolvedSenderName,
            companyName,
            unsubscribeToken,
            unsubscribeUrl,
            promotion: settings.promotion,
        });
    } else {
        return await sendCombinedBirthdayEmail(tenantId, userId, {
            userEmail,
            recipientName,
            resolvedTemplate,
            resolvedMessage,
            resolvedCustomThemeData,
            resolvedSenderName,
            companyName,
            unsubscribeToken,
            unsubscribeUrl,
            promotion: settings?.promotion,
        });
    }
}

interface EmailSendParams {
    userEmail: string;
    recipientName: string;
    resolvedTemplate: string;
    resolvedMessage: string;
    resolvedCustomThemeData: any;
    resolvedSenderName: string;
    companyName: string;
    unsubscribeToken?: string;
    unsubscribeUrl?: string;
    promotion?: {
        id?: string;
        title?: string;
        description?: string;
        content?: string;
    } | null;
}

/**
 * Send birthday card and promotion as separate emails (split flow)
 */
async function sendSplitBirthdayEmails(
    tenantId: string,
    userId: string,
    params: EmailSendParams
): Promise<BirthdayTestResult> {
    const { userEmail, recipientName, resolvedTemplate, resolvedMessage, resolvedCustomThemeData, resolvedSenderName, companyName, unsubscribeToken, unsubscribeUrl, promotion } = params;

    console.log(`✅ [Birthday Test SPLIT FLOW] Sending birthday and promo as SEPARATE emails to ${userEmail}`);

    // Email 1: Birthday card WITHOUT promotion
    const htmlBirthday = renderBirthdayTemplate(resolvedTemplate as any, {
        recipientName,
        message: resolvedMessage,
        brandName: companyName,
        customThemeData: resolvedCustomThemeData ? (typeof resolvedCustomThemeData === 'string' ? JSON.parse(resolvedCustomThemeData) : resolvedCustomThemeData) : null,
        senderName: resolvedSenderName,
        // NO promotion fields - intentionally omitted for split flow
        unsubscribeToken,
    });

    const birthdaySubject = `🎉 Happy Birthday ${recipientName}! (Test)`;
    const birthdayHandle = await tasks.trigger('send-email', {
        to: userEmail,
        subject: birthdaySubject,
        html: htmlBirthday,
        from: process.env.EMAIL_FROM || 'admin@zendwise.com',
        headers: unsubscribeUrl ? {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        } : undefined,
        metadata: {
            type: 'birthday-card-test',
            tenantId,
            userId,
            test: true,
            split: true,
        },
    });

    console.log(`✅ [Birthday Test SPLIT FLOW] Email 1/2: Birthday card sent, runId: ${birthdayHandle.id}`);

    // Email 2: Promotional email queued with 20s delay
    // Sanitize promotion fields to prevent XSS/HTML injection
    const safePromoTitle = sanitizeEmailHtml(promotion?.title || 'Special Birthday Offer!');
    const safePromoDescription = promotion?.description ? sanitizeEmailHtml(promotion.description) : '';
    const safePromoContent = sanitizeEmailHtml(promotion?.content || '');

    const promoSubject = promotion?.title || 'Special Birthday Offer! (Test)';
    const htmlPromo = buildPromotionalEmailHtml(safePromoTitle, safePromoDescription, safePromoContent, unsubscribeUrl);

    const promoHandle = await tasks.trigger('send-email', {
        to: userEmail,
        subject: `${promoSubject} (Test)`,
        html: htmlPromo,
        from: process.env.EMAIL_FROM || 'admin@zendwise.com',
        headers: unsubscribeUrl ? {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        } : undefined,
        metadata: {
            type: 'birthday-promotion-test',
            tenantId,
            userId,
            test: true,
            split: true,
        },
    }, {
        delay: '20s',
    });

    console.log(`✅ [Birthday Test SPLIT FLOW] Email 2/2: Promotional email queued (20s delay), runId: ${promoHandle.id}`);

    return {
        success: true,
        message: 'Test birthday card sent (split flow: birthday card sent, promotion queued with 20s delay)',
        runId: birthdayHandle.id,
        promoRunId: promoHandle.id,
        recipient: userEmail,
        split: true,
    };
}

/**
 * Send single combined birthday email with promotion embedded
 */
async function sendCombinedBirthdayEmail(
    tenantId: string,
    userId: string,
    params: EmailSendParams
): Promise<BirthdayTestResult> {
    const { userEmail, recipientName, resolvedTemplate, resolvedMessage, resolvedCustomThemeData, resolvedSenderName, companyName, unsubscribeToken, unsubscribeUrl, promotion } = params;

    const htmlContent = renderBirthdayTemplate(resolvedTemplate as any, {
        recipientName,
        message: resolvedMessage,
        brandName: companyName,
        customThemeData: resolvedCustomThemeData ? (typeof resolvedCustomThemeData === 'string' ? JSON.parse(resolvedCustomThemeData) : resolvedCustomThemeData) : null,
        senderName: resolvedSenderName,
        promotionContent: promotion?.content,
        promotionTitle: promotion?.title,
        promotionDescription: promotion?.description,
        unsubscribeToken,
    });

    const subject = `🎉 Happy Birthday ${recipientName}! (Test)`;

    const handle = await tasks.trigger('send-email', {
        to: userEmail,
        subject,
        html: htmlContent,
        from: process.env.EMAIL_FROM || 'admin@zendwise.com',
        headers: unsubscribeUrl ? {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        } : undefined,
        metadata: {
            type: 'birthday-card-test',
            tenantId,
            userId,
            test: true,
        },
    });

    console.log(`✅ [Birthday Test] Triggered send-email task, runId: ${handle.id}`);

    return {
        success: true,
        message: 'Test birthday card sent successfully',
        runId: handle.id,
        recipient: userEmail,
    };
}

/**
 * Build HTML for promotional email (used in split flow)
 */
function buildPromotionalEmailHtml(
    title: string,
    description: string,
    content: string,
    unsubscribeUrl?: string
): string {
    return `
    <html>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 20px auto; padding: 32px 24px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border-radius: 8px;">
          <h2 style="font-size: 1.5rem; font-weight: bold; margin: 0 0 16px 0; color: #2d3748;">${title}</h2>
          ${description ? `<p style="margin: 0 0 20px 0; color: #4a5568; font-size: 1rem; line-height: 1.5;">${description}</p>` : ''}
          <div style="color: #2d3748; font-size: 1rem; line-height: 1.6;">${content}</div>
          <hr style="margin: 32px 0 16px 0; border: none; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 0.85rem; color: #a0aec0; text-align: center;">
            This is a special birthday promotion for valued subscribers.
          </p>
          ${unsubscribeUrl ? `<p style="margin: 8px 0 0 0; font-size: 0.8rem; color: #a0aec0; text-align: center;">
            <a href="${unsubscribeUrl}" style="color: #667eea; text-decoration: none;">Manage preferences</a>
          </p>` : ''}
        </div>
      </body>
    </html>
  `;
}
