import { Router } from 'express';
import { db } from '../../db';
import { sql, eq, and } from 'drizzle-orm';
import { emailContacts, emailActivity, companies, masterEmailDesign, blogDesign, contactCustomFields, contactCustomFieldValues } from '@shared/schema';
import { authenticateToken, requireTenant, requirePermission } from '../../middleware/auth-middleware';
import { authenticateInternalService, InternalServiceRequest } from '../../middleware/internal-service-auth';
import { sanitizeString } from '../../utils/sanitization';
import crypto from 'crypto';
import { allowedActivityTypes } from '../../utils/activityLogger';
import { sendPromotionalEmailJob } from './emailUtils';
import { ALLOWED_HEADER_MODES, ALLOWED_LOGO_SIZES, ALLOWED_LOGO_ALIGNMENTS, ALLOWED_FONT_FAMILIES, validateDesignColor, validateDesignUrl, sanitizeDesignText, validateSocialLinks } from './emailUtils';

export const emailDesignRoutes = Router();

// Get master email design settings
emailDesignRoutes.get("/master-email-design", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const design = await db.query.masterEmailDesign.findFirst({
      where: sql`${masterEmailDesign.tenantId} = ${req.user.tenantId}`,
    });

    // Get company info for defaults
    const company = await db.query.companies.findFirst({
      where: sql`${companies.tenantId} = ${req.user.tenantId} AND ${companies.isActive} = true`,
    });

    // If no design exists, return default settings
    if (!design) {
      console.log('🎨 [Master Email Design GET] No design found, returning defaults');
      const defaultDesign = {
        id: '',
        tenantId: req.user.tenantId,
        companyName: company?.name || '',
        headerMode: 'logo',
        logoUrl: null,
        logoSize: 'medium',
        logoAlignment: 'center',
        bannerUrl: null,
        showCompanyName: 'true',
        primaryColor: '#3B82F6',
        secondaryColor: '#1E40AF',
        accentColor: '#10B981',
        fontFamily: 'Arial, sans-serif',
        headerText: null,
        footerText: company?.name ? `© ${new Date().getFullYear()} ${company.name}. All rights reserved.` : null,
        socialLinks: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return res.json(defaultDesign);
    }

    console.log('🎨 [Master Email Design GET] Returning design:', { id: design.id });
    res.json(design);
  } catch (error) {
    console.error('Get master email design error:', error);
    res.status(500).json({ message: 'Failed to get master email design' });
  }
});

// Update master email design settings
emailDesignRoutes.put("/master-email-design", authenticateToken, requireTenant, requirePermission('emails.manage_design'), async (req: any, res) => {
  try {
    const {
      companyName,
      headerMode,
      logoUrl,
      logoSize,
      logoAlignment,
      bannerUrl,
      showCompanyName,
      primaryColor,
      secondaryColor,
      accentColor,
      fontFamily,
      headerText,
      footerText,
      socialLinks,
    } = req.body;

    console.log('🎨 [Master Email Design PUT] Received:', { companyName, headerMode, logoUrl, logoSize, logoAlignment, bannerUrl, headerText, primaryColor, tenantId: req.user.tenantId });

    // ── Validate all inputs ──────────────────────────────────────────────

    // Enum fields
    if (headerMode !== undefined && !ALLOWED_HEADER_MODES.includes(headerMode)) {
      return res.status(400).json({ message: `Invalid headerMode. Must be one of: ${ALLOWED_HEADER_MODES.join(', ')}` });
    }
    if (logoSize !== undefined && !ALLOWED_LOGO_SIZES.includes(logoSize)) {
      return res.status(400).json({ message: `Invalid logoSize. Must be one of: ${ALLOWED_LOGO_SIZES.join(', ')}` });
    }
    if (logoAlignment !== undefined && !ALLOWED_LOGO_ALIGNMENTS.includes(logoAlignment)) {
      return res.status(400).json({ message: `Invalid logoAlignment. Must be one of: ${ALLOWED_LOGO_ALIGNMENTS.join(', ')}` });
    }
    if (showCompanyName !== undefined && showCompanyName !== 'true' && showCompanyName !== 'false') {
      return res.status(400).json({ message: 'showCompanyName must be "true" or "false"' });
    }

    // Font family: match case-insensitively against allowlist, fall back to Arial
    let safeFontFamily: string | undefined;
    if (fontFamily !== undefined && fontFamily !== null) {
      const normalized = String(fontFamily).trim();
      const match = ALLOWED_FONT_FAMILIES.find(f => f.toLowerCase() === normalized.toLowerCase());
      safeFontFamily = match || 'Arial, sans-serif';
    }

    // Colors: validate hex format
    const safeColors: Record<string, string | undefined> = {};
    if (primaryColor !== undefined) {
      const validated = validateDesignColor(primaryColor);
      if (!validated) return res.status(400).json({ message: 'Invalid primaryColor. Must be a hex color (e.g. #3B82F6)' });
      safeColors.primaryColor = validated;
    }
    if (secondaryColor !== undefined) {
      const validated = validateDesignColor(secondaryColor);
      if (!validated) return res.status(400).json({ message: 'Invalid secondaryColor. Must be a hex color (e.g. #1E40AF)' });
      safeColors.secondaryColor = validated;
    }
    if (accentColor !== undefined) {
      const validated = validateDesignColor(accentColor);
      if (!validated) return res.status(400).json({ message: 'Invalid accentColor. Must be a hex color (e.g. #10B981)' });
      safeColors.accentColor = validated;
    }

    // URLs: validate http(s) only, reject javascript:/data:/etc.
    const safeLogoUrl = logoUrl !== undefined ? validateDesignUrl(logoUrl) : undefined;
    const safeBannerUrl = bannerUrl !== undefined ? validateDesignUrl(bannerUrl) : undefined;
    // If a non-empty URL was provided but failed validation, reject
    if (logoUrl !== undefined && logoUrl !== null && logoUrl !== '' && safeLogoUrl === null) {
      return res.status(400).json({ message: 'Invalid logoUrl. Must be a valid http(s) URL.' });
    }
    if (bannerUrl !== undefined && bannerUrl !== null && bannerUrl !== '' && safeBannerUrl === null) {
      return res.status(400).json({ message: 'Invalid bannerUrl. Must be a valid http(s) URL.' });
    }

    // Text fields: sanitize and length-limit
    const safeCompanyName = companyName !== undefined ? sanitizeDesignText(companyName, 200) : undefined;
    const safeHeaderText = headerText !== undefined ? sanitizeDesignText(headerText, 500) : undefined;
    const safeFooterText = footerText !== undefined ? sanitizeDesignText(footerText, 1000) : undefined;

    // Social links: validate each URL
    const hasSocialLinks = Object.prototype.hasOwnProperty.call(req.body, 'socialLinks');
    let safeSocialLinksStr: string | null | undefined;
    if (hasSocialLinks) {
      const validated = validateSocialLinks(socialLinks);
      safeSocialLinksStr = validated ? JSON.stringify(validated) : null;
    }

    // ── Persist ──────────────────────────────────────────────────────────

    // Check if design already exists
    const existingDesign = await db.query.masterEmailDesign.findFirst({
      where: sql`${masterEmailDesign.tenantId} = ${req.user.tenantId}`,
    });

    let updatedDesign;

    if (existingDesign) {
      // Update existing design
      const updateSet: Record<string, unknown> = {
        companyName: safeCompanyName !== undefined ? (safeCompanyName ?? '') : existingDesign.companyName,
        headerMode: headerMode !== undefined ? headerMode : existingDesign.headerMode,
        logoUrl: logoUrl !== undefined ? (safeLogoUrl ?? null) : existingDesign.logoUrl,
        logoSize: logoSize !== undefined ? logoSize : existingDesign.logoSize,
        logoAlignment: logoAlignment !== undefined ? logoAlignment : existingDesign.logoAlignment,
        bannerUrl: bannerUrl !== undefined ? (safeBannerUrl ?? null) : existingDesign.bannerUrl,
        showCompanyName: showCompanyName !== undefined ? showCompanyName : existingDesign.showCompanyName,
        primaryColor: safeColors.primaryColor ?? existingDesign.primaryColor,
        secondaryColor: safeColors.secondaryColor ?? existingDesign.secondaryColor,
        accentColor: safeColors.accentColor ?? existingDesign.accentColor,
        fontFamily: safeFontFamily ?? existingDesign.fontFamily,
        headerText: headerText !== undefined ? safeHeaderText : existingDesign.headerText,
        footerText: footerText !== undefined ? safeFooterText : existingDesign.footerText,
        updatedAt: new Date(),
      };

      if (hasSocialLinks) {
        updateSet.socialLinks = safeSocialLinksStr;
      }

      updatedDesign = await db.update(masterEmailDesign)
        .set(updateSet)
        .where(sql`${masterEmailDesign.tenantId} = ${req.user.tenantId}`)
        .returning();
    } else {
      // Create new design
      updatedDesign = await db.insert(masterEmailDesign)
        .values({
          tenantId: req.user.tenantId,
          companyName: safeCompanyName || '',
          headerMode: headerMode || 'logo',
          logoUrl: safeLogoUrl || null,
          logoSize: logoSize || 'medium',
          logoAlignment: logoAlignment || 'center',
          bannerUrl: safeBannerUrl || null,
          showCompanyName: showCompanyName || 'true',
          primaryColor: safeColors.primaryColor || '#3B82F6',
          secondaryColor: safeColors.secondaryColor || '#1E40AF',
          accentColor: safeColors.accentColor || '#10B981',
          fontFamily: safeFontFamily || 'Arial, sans-serif',
          headerText: safeHeaderText || null,
          footerText: safeFooterText || null,
          socialLinks: hasSocialLinks ? safeSocialLinksStr : null,
        })
        .returning();
    }

    console.log('🎨 [Master Email Design PUT] Updated design:', { id: updatedDesign[0]?.id });
    res.json(updatedDesign[0]);
  } catch (error) {
    console.error('Update master email design error:', error);
    res.status(500).json({ message: 'Failed to update master email design' });
  }
});

// Get blog design settings
emailDesignRoutes.get("/blog-design", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const design = await db.query.blogDesign.findFirst({
      where: sql`${blogDesign.tenantId} = ${req.user.tenantId}`,
    });

    // Get company info for defaults
    const company = await db.query.companies.findFirst({
      where: sql`${companies.tenantId} = ${req.user.tenantId} AND ${companies.isActive} = true`,
    });

    // If no blog design exists, return default settings
    if (!design) {
      console.log('🎨 [Blog Design GET] No design found, returning defaults');
      const defaultDesign = {
        id: '',
        tenantId: req.user.tenantId,
        companyName: company?.name || '',
        headerMode: 'logo',
        logoUrl: null,
        logoSize: 'medium',
        logoAlignment: 'center',
        bannerUrl: null,
        showCompanyName: 'true',
        primaryColor: '#3B82F6',
        secondaryColor: '#1E40AF',
        accentColor: '#10B981',
        pageBackgroundColor: '#F3F4F6',
        fontFamily: 'Arial, sans-serif',
        headerText: null,
        footerText: company?.name ? `© ${new Date().getFullYear()} ${company.name}. All rights reserved.` : null,
        socialLinks: null,
        newsletterEditorType: 'classic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return res.json(defaultDesign);
    }

    console.log('🎨 [Blog Design GET] Returning design:', { id: design.id });
    res.json(design);
  } catch (error) {
    console.error('Get blog design error:', error);
    res.status(500).json({ message: 'Failed to get blog design' });
  }
});

// Update blog design settings
emailDesignRoutes.put("/blog-design", authenticateToken, requireTenant, requirePermission('emails.manage_design'), async (req: any, res) => {
  try {
    const {
      companyName,
      headerMode,
      logoUrl,
      logoSize,
      logoAlignment,
      bannerUrl,
      showCompanyName,
      primaryColor,
      secondaryColor,
      accentColor,
      pageBackgroundColor,
      fontFamily,
      headerText,
      footerText,
      socialLinks,
      newsletterEditorType,
    } = req.body;

    console.log('🎨 [Blog Design PUT] Received:', { companyName, headerMode, logoUrl, logoSize, logoAlignment, bannerUrl, headerText, primaryColor, tenantId: req.user.tenantId });

    // ── Validate all inputs (reuse same validation helpers as email design) ──

    // Enum fields
    if (headerMode !== undefined && !ALLOWED_HEADER_MODES.includes(headerMode)) {
      return res.status(400).json({ message: `Invalid headerMode. Must be one of: ${ALLOWED_HEADER_MODES.join(', ')}` });
    }
    if (logoSize !== undefined && !ALLOWED_LOGO_SIZES.includes(logoSize)) {
      return res.status(400).json({ message: `Invalid logoSize. Must be one of: ${ALLOWED_LOGO_SIZES.join(', ')}` });
    }
    if (logoAlignment !== undefined && !ALLOWED_LOGO_ALIGNMENTS.includes(logoAlignment)) {
      return res.status(400).json({ message: `Invalid logoAlignment. Must be one of: ${ALLOWED_LOGO_ALIGNMENTS.join(', ')}` });
    }
    if (showCompanyName !== undefined && showCompanyName !== 'true' && showCompanyName !== 'false') {
      return res.status(400).json({ message: 'showCompanyName must be "true" or "false"' });
    }

    // Font family
    let safeFontFamily: string | undefined;
    if (fontFamily !== undefined && fontFamily !== null) {
      const normalized = String(fontFamily).trim();
      const match = ALLOWED_FONT_FAMILIES.find(f => f.toLowerCase() === normalized.toLowerCase());
      safeFontFamily = match || 'Arial, sans-serif';
    }

    // Colors
    const safeColors: Record<string, string | undefined> = {};
    if (primaryColor !== undefined) {
      const validated = validateDesignColor(primaryColor);
      if (!validated) return res.status(400).json({ message: 'Invalid primaryColor. Must be a hex color (e.g. #3B82F6)' });
      safeColors.primaryColor = validated;
    }
    if (secondaryColor !== undefined) {
      const validated = validateDesignColor(secondaryColor);
      if (!validated) return res.status(400).json({ message: 'Invalid secondaryColor. Must be a hex color (e.g. #1E40AF)' });
      safeColors.secondaryColor = validated;
    }
    if (accentColor !== undefined) {
      const validated = validateDesignColor(accentColor);
      if (!validated) return res.status(400).json({ message: 'Invalid accentColor. Must be a hex color (e.g. #10B981)' });
      safeColors.accentColor = validated;
    }
    if (pageBackgroundColor !== undefined) {
      const validated = validateDesignColor(pageBackgroundColor);
      if (!validated) return res.status(400).json({ message: 'Invalid pageBackgroundColor. Must be a hex color (e.g. #F3F4F6)' });
      safeColors.pageBackgroundColor = validated;
    }

    // URLs
    const safeLogoUrl = logoUrl !== undefined ? validateDesignUrl(logoUrl) : undefined;
    const safeBannerUrl = bannerUrl !== undefined ? validateDesignUrl(bannerUrl) : undefined;
    if (logoUrl !== undefined && logoUrl !== null && logoUrl !== '' && safeLogoUrl === null) {
      return res.status(400).json({ message: 'Invalid logoUrl. Must be a valid http(s) URL.' });
    }
    if (bannerUrl !== undefined && bannerUrl !== null && bannerUrl !== '' && safeBannerUrl === null) {
      return res.status(400).json({ message: 'Invalid bannerUrl. Must be a valid http(s) URL.' });
    }

    // Text fields
    const safeCompanyName = companyName !== undefined ? sanitizeDesignText(companyName, 200) : undefined;
    const safeHeaderText = headerText !== undefined ? sanitizeDesignText(headerText, 500) : undefined;
    const safeFooterText = footerText !== undefined ? sanitizeDesignText(footerText, 1000) : undefined;

    // Social links
    const hasSocialLinks = Object.prototype.hasOwnProperty.call(req.body, 'socialLinks');
    let safeSocialLinksStr: string | null | undefined;
    if (hasSocialLinks) {
      const validated = validateSocialLinks(socialLinks);
      safeSocialLinksStr = validated ? JSON.stringify(validated) : null;
    }

    // Newsletter editor type
    const ALLOWED_EDITOR_TYPES = ['classic', 'notion'] as const;
    if (newsletterEditorType !== undefined && !ALLOWED_EDITOR_TYPES.includes(newsletterEditorType)) {
      return res.status(400).json({ message: `Invalid newsletterEditorType. Must be one of: ${ALLOWED_EDITOR_TYPES.join(', ')}` });
    }

    // ── Persist ──

    const existingDesign = await db.query.blogDesign.findFirst({
      where: sql`${blogDesign.tenantId} = ${req.user.tenantId}`,
    });

    let updatedDesign;

    if (existingDesign) {
      const updateSet: Record<string, unknown> = {
        companyName: safeCompanyName !== undefined ? (safeCompanyName ?? '') : existingDesign.companyName,
        headerMode: headerMode !== undefined ? headerMode : existingDesign.headerMode,
        logoUrl: logoUrl !== undefined ? (safeLogoUrl ?? null) : existingDesign.logoUrl,
        logoSize: logoSize !== undefined ? logoSize : existingDesign.logoSize,
        logoAlignment: logoAlignment !== undefined ? logoAlignment : existingDesign.logoAlignment,
        bannerUrl: bannerUrl !== undefined ? (safeBannerUrl ?? null) : existingDesign.bannerUrl,
        showCompanyName: showCompanyName !== undefined ? showCompanyName : existingDesign.showCompanyName,
        primaryColor: safeColors.primaryColor ?? existingDesign.primaryColor,
        secondaryColor: safeColors.secondaryColor ?? existingDesign.secondaryColor,
        accentColor: safeColors.accentColor ?? existingDesign.accentColor,
        pageBackgroundColor: safeColors.pageBackgroundColor ?? existingDesign.pageBackgroundColor,
        fontFamily: safeFontFamily ?? existingDesign.fontFamily,
        headerText: headerText !== undefined ? safeHeaderText : existingDesign.headerText,
        footerText: footerText !== undefined ? safeFooterText : existingDesign.footerText,
        newsletterEditorType: newsletterEditorType !== undefined ? newsletterEditorType : existingDesign.newsletterEditorType,
        updatedAt: new Date(),
      };

      if (hasSocialLinks) {
        updateSet.socialLinks = safeSocialLinksStr;
      }

      updatedDesign = await db.update(blogDesign)
        .set(updateSet)
        .where(sql`${blogDesign.tenantId} = ${req.user.tenantId}`)
        .returning();
    } else {
      updatedDesign = await db.insert(blogDesign)
        .values({
          tenantId: req.user.tenantId,
          companyName: safeCompanyName || '',
          headerMode: headerMode || 'logo',
          logoUrl: safeLogoUrl || null,
          logoSize: logoSize || 'medium',
          logoAlignment: logoAlignment || 'center',
          bannerUrl: safeBannerUrl || null,
          showCompanyName: showCompanyName || 'true',
          primaryColor: safeColors.primaryColor || '#3B82F6',
          secondaryColor: safeColors.secondaryColor || '#1E40AF',
          accentColor: safeColors.accentColor || '#10B981',
          pageBackgroundColor: safeColors.pageBackgroundColor || '#F3F4F6',
          fontFamily: safeFontFamily || 'Arial, sans-serif',
          headerText: safeHeaderText || null,
          footerText: safeFooterText || null,
          socialLinks: hasSocialLinks ? safeSocialLinksStr : null,
          newsletterEditorType: newsletterEditorType || 'classic',
        })
        .returning();
    }

    console.log('🎨 [Blog Design PUT] Updated design:', { id: updatedDesign[0]?.id });
    res.json(updatedDesign[0]);
  } catch (error) {
    console.error('Update blog design error:', error);
    res.status(500).json({ message: 'Failed to update blog design' });
  }
});

// Internal endpoint for Trigger.dev to log email activity
// Secured with HMAC signature verification
emailDesignRoutes.post("/internal/email-activity", authenticateInternalService, async (req: InternalServiceRequest, res) => {
  console.log('📧 [Internal Email Activity] Received authenticated request:', {
    service: req.internalService?.service,
    tenantId: req.body.tenantId,
    contactId: req.body.contactId,
    activityType: req.body.activityType,
    activityData: '[REDACTED - PII]',
    occurredAt: req.body.occurredAt
  });

  try {
    const {
      tenantId,
      contactId,
      activityType,
      activityData,
      occurredAt,
      webhookId
    } = req.body;

    // Validate required fields
    if (!tenantId || !contactId || !activityType) {
      return res.status(400).json({
        error: 'tenantId, contactId, and activityType are required'
      });
    }

    // Validate webhookId for idempotency
    if (!webhookId) {
      return res.status(400).json({
        error: 'webhookId is required for idempotency'
      });
    }

    // Validate activityType
    if (!allowedActivityTypes.includes(activityType)) {
      return res.status(400).json({
        error: `Invalid activityType. Must be one of: ${allowedActivityTypes.join(', ')}`
      });
    }

    // Verify contact exists
    const existingContact = await db
      .select({ id: emailContacts.id })
      .from(emailContacts)
      .where(and(
        eq(emailContacts.id, contactId),
        eq(emailContacts.tenantId, tenantId)
      ))
      .limit(1);

    if (existingContact.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Validate occurredAt if provided
    let validatedOccurredAt = new Date();
    if (occurredAt) {
      const parsed = new Date(occurredAt);
      if (isFinite(parsed.getTime())) {
        validatedOccurredAt = parsed;
      } else {
        return res.status(400).json({
          error: 'Invalid occurredAt format. Must be a valid date.'
        });
      }
    }

    const txResult = await db.transaction(async (tx: any) => {
      const insertedActivities = await tx
        .insert(emailActivity)
        .values({
          tenantId,
          contactId,
          activityType,
          activityData: activityData ? JSON.stringify(activityData) : null,
          webhookId,
          occurredAt: validatedOccurredAt,
        })
        .onConflictDoNothing({
          target: [emailActivity.webhookId, emailActivity.tenantId],
        })
        .returning();

      if (insertedActivities.length > 0) {
        const activity = insertedActivities[0];

        // Update contact's lastActivity timestamp only when we actually inserted a new activity
        await tx
          .update(emailContacts)
          .set({
            lastActivity: new Date(),
            updatedAt: new Date(),
            // Increment emailsSent counter if this is a 'sent' activity
            ...(activityType === 'sent'
              ? { emailsSent: sql`coalesce(${emailContacts.emailsSent}, 0) + 1` }
              : {}),
          })
          .where(
            and(eq(emailContacts.id, contactId), eq(emailContacts.tenantId, tenantId))
          );

        return { inserted: true as const, activity };
      }

      // Conflict path: webhookId already exists
      const existingActivities = await tx
        .select()
        .from(emailActivity)
        .where(and(eq(emailActivity.webhookId, webhookId), eq(emailActivity.tenantId, tenantId)))
        .limit(1);

      if (existingActivities.length === 0) {
        throw new Error('Email activity conflict detected but existing row could not be found');
      }

      const activity = existingActivities[0];

      if (activity.contactId !== contactId) {
        return { inserted: false as const, contactMismatch: true as const, activity };
      }

      return { inserted: false as const, activity };
    });

    if ('contactMismatch' in txResult && txResult.contactMismatch) {
      console.warn(
        `📧 [Internal Email Activity] webhookId ${webhookId} already used for different contact (existing ${txResult.activity.contactId}, incoming ${contactId})`
      );
      return res.status(409).json({
        error: 'webhookId already used for a different contactId',
        webhookId,
      });
    }

    if (!txResult.inserted) {
      console.log(
        `📧 [Internal Email Activity] Found existing activity ${txResult.activity.id} for webhookId ${webhookId}`
      );
      return res.json({
        activity: txResult.activity,
        message: 'Email activity already exists (idempotent request)',
      });
    }

    console.log(
      `📧 [Internal Email Activity] Created activity ${txResult.activity.id} for contact ${contactId}`
    );

    res.json({
      activity: txResult.activity,
      message: 'Email activity logged successfully',
    });
  } catch (error) {
    console.error('Failed to log email activity (internal):', error);
    res.status(500).json({ error: 'Failed to log email activity' });
  }
});

// Internal endpoint for Trigger.dev to send promotional emails
// Secured with HMAC signature verification
emailDesignRoutes.post("/internal/send-promotional-email", authenticateInternalService, async (req: InternalServiceRequest, res) => {
  console.log('🎁 [Internal Promotional Email] Received authenticated request:', {
    service: req.internalService?.service,
    tenantId: req.body.tenantId,
    contactId: req.body.contactId,
    recipientEmail: req.body.recipientEmail,
  });

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
    if (!tenantId || !contactId || !recipientEmail || !recipientName || !senderName || !promoSubject || !htmlPromo) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, contactId, recipientEmail, recipientName, senderName, promoSubject, htmlPromo'
      });
    }

    // Call the existing sendPromotionalEmailJob function
    await sendPromotionalEmailJob({
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
    });

    console.log(`✅ [Internal Promotional Email] Successfully sent promotional email for contact ${contactId}`);

    res.json({
      success: true,
      message: 'Promotional email sent successfully',
      contactId,
      recipientEmail,
    });
  } catch (error) {
    console.error('Failed to send promotional email (internal):', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send promotional email',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Email Template Management Routes

// Get email templates
emailDesignRoutes.get("/email-templates", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    // For now, return mock data. In production, this would query a database table
    const mockTemplates = [
      {
        id: "1",
        name: "Summer Sale Template",
        category: "promotional",
        subject: "🌞 Summer Sale - Up to 50% Off!",
        preview: "Get ready for summer with our biggest sale of the year.",
        htmlContent: "<html><body>Sample HTML</body></html>",
        primaryColor: "#EC4899",
        secondaryColor: "#BE185D",
        usageCount: 15,
        lastUsed: "2025-07-25",
        createdAt: "2025-06-10",
        isFavorite: true,
        tenantId: req.user.tenantId,
      },
      {
        id: "2",
        name: "Welcome Email Series",
        category: "welcome",
        subject: "Welcome to {{company_name}}! 🎉",
        preview: "Hi {{first_name}}, Welcome aboard! We're thrilled to have you.",
        htmlContent: "<html><body>Sample HTML</body></html>",
        primaryColor: "#3B82F6",
        secondaryColor: "#1E40AF",
        usageCount: 243,
        lastUsed: "2025-07-29",
        createdAt: "2025-03-15",
        isFavorite: true,
        tenantId: req.user.tenantId,
      },
    ];

    res.json({ templates: mockTemplates });
  } catch (error: any) {
    console.error('[EmailDesignRoutes] Get email templates error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get email templates"
    });
  }
});

// Create email template
emailDesignRoutes.post("/email-templates", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { name, category, subject, preview, htmlContent, primaryColor, secondaryColor } = req.body;

    if (!name || !category || !subject) {
      return res.status(400).json({
        success: false,
        message: "Name, category, and subject are required"
      });
    }

    // In production, this would insert into a database table
    const newTemplate = {
      id: crypto.randomBytes(16).toString('hex'),
      name: sanitizeString(name),
      category,
      subject: sanitizeString(subject),
      preview: preview ? sanitizeString(preview) : "",
      htmlContent: htmlContent || "",
      primaryColor: primaryColor || "#3B82F6",
      secondaryColor: secondaryColor || "#1E40AF",
      usageCount: 0,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      tenantId: req.user.tenantId,
    };

    res.json({
      success: true,
      template: newTemplate
    });
  } catch (error: any) {
    console.error('[EmailDesignRoutes] Create email template error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create email template"
    });
  }
});

// Update email template
emailDesignRoutes.put("/email-templates/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { name, category, subject, preview, htmlContent, primaryColor, secondaryColor, isFavorite } = req.body;

    if (!name || !category || !subject) {
      return res.status(400).json({
        success: false,
        message: "Name, category, and subject are required"
      });
    }

    // In production, this would update the database table
    const updatedTemplate = {
      id,
      name: sanitizeString(name),
      category,
      subject: sanitizeString(subject),
      preview: preview ? sanitizeString(preview) : "",
      htmlContent: htmlContent || "",
      primaryColor: primaryColor || "#3B82F6",
      secondaryColor: secondaryColor || "#1E40AF",
      isFavorite: isFavorite || false,
      updatedAt: new Date().toISOString(),
      tenantId: req.user.tenantId,
    };

    res.json({
      success: true,
      template: updatedTemplate
    });
  } catch (error: any) {
    console.error('[EmailDesignRoutes] Update email template error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update email template"
    });
  }
});

// Delete email template
emailDesignRoutes.delete("/email-templates/:id", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;

    // In production, this would delete from the database table
    res.json({
      success: true,
      message: "Email template deleted successfully"
    });
  } catch (error: any) {
    console.error('[EmailDesignRoutes] Delete email template error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete email template"
    });
  }
});

// Toggle favorite status
emailDesignRoutes.patch("/email-templates/:id/favorite", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { isFavorite } = req.body;

    // In production, this would update the database table
    res.json({
      success: true,
      isFavorite
    });
  } catch (error: any) {
    console.error('[EmailDesignRoutes] Toggle favorite error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to toggle favorite status"
    });
  }
});

// ============================================================
// Custom Fields for Email Contacts
// ============================================================

// List all custom field definitions for the tenant
emailDesignRoutes.get("/contact-custom-fields", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const fields = await db.select()
      .from(contactCustomFields)
      .where(eq(contactCustomFields.tenantId, req.user.tenantId))
      .orderBy(contactCustomFields.sortOrder, contactCustomFields.createdAt);

    // Parse options JSON for select fields
    const parsed = fields.map(f => ({
      ...f,
      options: f.options ? JSON.parse(f.options) : [],
    }));

    res.json({ fields: parsed });
  } catch (error) {
    console.error('List custom fields error:', error);
    res.status(500).json({ message: 'Failed to list custom fields' });
  }
});

// Create a custom field definition
emailDesignRoutes.post("/contact-custom-fields", authenticateToken, requireTenant, requirePermission('contacts.create'), async (req: any, res) => {
  try {
    const { name, label, fieldType, mask, options, placeholder, isRequired, sortOrder } = req.body;

    if (!name || !label) {
      return res.status(400).json({ message: 'Name and label are required' });
    }

    const allowedTypes = ['text', 'number', 'date', 'select', 'url', 'boolean'];
    if (fieldType && !allowedTypes.includes(fieldType)) {
      return res.status(400).json({ message: `Invalid field type. Must be one of: ${allowedTypes.join(', ')}` });
    }

    // Check for duplicate name within tenant
    const existing = await db.select().from(contactCustomFields)
      .where(sql`${contactCustomFields.tenantId} = ${req.user.tenantId} AND LOWER(${contactCustomFields.name}) = LOWER(${sanitizeString(name)})`);

    if (existing.length > 0) {
      return res.status(400).json({ message: 'A custom field with this name already exists' });
    }

    const [field] = await db.insert(contactCustomFields).values([{
      tenantId: req.user.tenantId,
      name: sanitizeString(name),
      label: sanitizeString(label),
      fieldType: fieldType || 'text',
      mask: mask ? sanitizeString(mask) : null,
      options: options && Array.isArray(options) ? JSON.stringify(options) : null,
      placeholder: placeholder ? sanitizeString(placeholder) : null,
      isRequired: isRequired || false,
      sortOrder: sortOrder ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]).returning();

    res.status(201).json({
      ...field,
      options: field.options ? JSON.parse(field.options) : [],
    });
  } catch (error) {
    console.error('Create custom field error:', error);
    res.status(500).json({ message: 'Failed to create custom field' });
  }
});

// Update a custom field definition
emailDesignRoutes.put("/contact-custom-fields/:id", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { name, label, fieldType, mask, options, placeholder, isRequired, sortOrder } = req.body;

    const existing = await db.select().from(contactCustomFields)
      .where(sql`${contactCustomFields.id} = ${id} AND ${contactCustomFields.tenantId} = ${req.user.tenantId}`);

    if (existing.length === 0) {
      return res.status(404).json({ message: 'Custom field not found' });
    }

    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = sanitizeString(name);
    if (label !== undefined) updateData.label = sanitizeString(label);
    if (fieldType !== undefined) {
      const allowedTypes = ['text', 'number', 'date', 'select', 'url', 'boolean'];
      if (!allowedTypes.includes(fieldType)) {
        return res.status(400).json({ message: `Invalid field type` });
      }
      updateData.fieldType = fieldType;
    }
    if (mask !== undefined) updateData.mask = mask ? sanitizeString(mask) : null;
    if (options !== undefined) updateData.options = Array.isArray(options) ? JSON.stringify(options) : null;
    if (placeholder !== undefined) updateData.placeholder = placeholder ? sanitizeString(placeholder) : null;
    if (isRequired !== undefined) updateData.isRequired = isRequired;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const [updated] = await db.update(contactCustomFields)
      .set(updateData)
      .where(sql`${contactCustomFields.id} = ${id} AND ${contactCustomFields.tenantId} = ${req.user.tenantId}`)
      .returning();

    res.json({
      ...updated,
      options: updated.options ? JSON.parse(updated.options) : [],
    });
  } catch (error) {
    console.error('Update custom field error:', error);
    res.status(500).json({ message: 'Failed to update custom field' });
  }
});

// Delete a custom field definition (cascades to values)
emailDesignRoutes.delete("/contact-custom-fields/:id", authenticateToken, requireTenant, requirePermission('contacts.delete'), async (req: any, res) => {
  try {
    const { id } = req.params;

    const existing = await db.select().from(contactCustomFields)
      .where(sql`${contactCustomFields.id} = ${id} AND ${contactCustomFields.tenantId} = ${req.user.tenantId}`);

    if (existing.length === 0) {
      return res.status(404).json({ message: 'Custom field not found' });
    }

    await db.delete(contactCustomFields)
      .where(sql`${contactCustomFields.id} = ${id} AND ${contactCustomFields.tenantId} = ${req.user.tenantId}`);

    res.json({ message: 'Custom field deleted successfully' });
  } catch (error) {
    console.error('Delete custom field error:', error);
    res.status(500).json({ message: 'Failed to delete custom field' });
  }
});

// Get custom field values for a specific contact
emailDesignRoutes.get("/email-contacts/:contactId/custom-fields", authenticateToken, requireTenant, requirePermission('contacts.view'), async (req: any, res) => {
  try {
    const { contactId } = req.params;

    // Verify contact belongs to tenant
    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${contactId} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Get all field definitions for the tenant
    const fields = await db.select()
      .from(contactCustomFields)
      .where(eq(contactCustomFields.tenantId, req.user.tenantId))
      .orderBy(contactCustomFields.sortOrder, contactCustomFields.createdAt);

    // Get all values for this contact
    const values = await db.select()
      .from(contactCustomFieldValues)
      .where(sql`${contactCustomFieldValues.contactId} = ${contactId} AND ${contactCustomFieldValues.tenantId} = ${req.user.tenantId}`);

    // Build a map of fieldId -> value
    const valueMap: Record<string, string | null> = {};
    values.forEach(v => { valueMap[v.fieldId] = v.value; });

    // Merge fields with their values
    const result = fields.map(f => ({
      ...f,
      options: f.options ? JSON.parse(f.options) : [],
      value: valueMap[f.id] ?? null,
    }));

    res.json({ customFields: result });
  } catch (error) {
    console.error('Get contact custom fields error:', error);
    res.status(500).json({ message: 'Failed to get custom field values' });
  }
});

// Save/update custom field values for a contact (batch upsert)
emailDesignRoutes.put("/email-contacts/:contactId/custom-fields", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  try {
    const { contactId } = req.params;
    const { values } = req.body; // Array of { fieldId, value }

    if (!Array.isArray(values)) {
      return res.status(400).json({ message: 'values must be an array of { fieldId, value }' });
    }

    // Verify contact belongs to tenant
    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${contactId} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Batch upsert within transaction
    await db.transaction(async (tx: any) => {
      for (const { fieldId, value } of values) {
        if (!fieldId) continue;

        // Check if value already exists
        const existing = await tx.select().from(contactCustomFieldValues)
          .where(sql`${contactCustomFieldValues.contactId} = ${contactId} AND ${contactCustomFieldValues.fieldId} = ${fieldId} AND ${contactCustomFieldValues.tenantId} = ${req.user.tenantId}`);

        if (existing.length > 0) {
          await tx.update(contactCustomFieldValues)
            .set({ value: value ?? null, updatedAt: new Date() })
            .where(sql`${contactCustomFieldValues.contactId} = ${contactId} AND ${contactCustomFieldValues.fieldId} = ${fieldId} AND ${contactCustomFieldValues.tenantId} = ${req.user.tenantId}`);
        } else {
          await tx.insert(contactCustomFieldValues).values({
            tenantId: req.user.tenantId,
            contactId,
            fieldId,
            value: value ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    });

    res.json({ message: 'Custom field values saved successfully' });
  } catch (error) {
    console.error('Save contact custom fields error:', error);
    res.status(500).json({ message: 'Failed to save custom field values' });
  }
});
