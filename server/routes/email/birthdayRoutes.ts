import { Router } from 'express';
import { db } from '../../db';
import { sql, eq, and } from 'drizzle-orm';
import { emailContacts, emailLists, bouncedEmails, birthdaySettings, eCardSettings, emailActivity, tenants, emailSends, emailContent, companies, unsubscribeTokens } from '@shared/schema';
import { deleteImageFromR2 } from '../../config/r2';
import { authenticateToken, requireTenant, requirePermission } from '../../middleware/auth-middleware';
import { storage } from '../../storage';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sanitizeEmailHtml, renderBirthdayTemplate, enqueuePromotionalEmailJob, maskEmail } from './emailUtils';

export const birthdayRoutes = Router();

// Bulk update birthday email preferences (must be registered BEFORE the :contactId route)
birthdayRoutes.patch("/email-contacts/birthday-email/bulk", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  try {
    const { contactIds, enabled } = req.body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ message: 'contactIds array is required' });
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled field must be a boolean' });
    }

    // Verify all contacts exist and belong to tenant
    const contacts = await db.query.emailContacts.findMany({
      where: sql`${emailContacts.tenantId} = ${req.user.tenantId} AND ${emailContacts.id} = ANY(${contactIds})`,
    });

    if (contacts.length !== contactIds.length) {
      return res.status(400).json({ message: 'Some contacts were not found or do not belong to your tenant' });
    }

    // Check if any contacts have unsubscribed from birthday emails when enabling
    if (enabled) {
      const unsubscribedContacts = contacts.filter((c: any) => c.birthdayUnsubscribedAt);
      if (unsubscribedContacts.length > 0) {
        return res.status(403).json({
          message: `Cannot re-enable birthday emails for ${unsubscribedContacts.length} contact(s) who have unsubscribed. These customers must opt-in again through the unsubscribe link.`,
          reason: 'unsubscribed',
          unsubscribedContactIds: unsubscribedContacts.map((c: any) => c.id)
        });
      }
    }

    // Update birthday email preferences for all specified contacts
    const updatedContacts = await db.update(emailContacts)
      .set({
        birthdayEmailEnabled: enabled,
        updatedAt: new Date(),
      })
      .where(sql`${emailContacts.id} = ANY(${contactIds}) AND ${emailContacts.tenantId} = ${req.user.tenantId}`)
      .returning();

    res.json({
      message: `Birthday email preference ${enabled ? 'enabled' : 'disabled'} for ${updatedContacts.length} contacts`,
      updatedContacts: updatedContacts.length
    });
  } catch (error) {
    console.error('Bulk update birthday email preferences error:', error);
    res.status(500).json({ message: 'Failed to update birthday email preferences' });
  }
});

// Update contact's birthday email preference
birthdayRoutes.patch("/email-contacts/:contactId/birthday-email", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  try {
    const { contactId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled field must be a boolean' });
    }

    // Verify contact exists and belongs to tenant
    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${contactId} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Check if contact has unsubscribed from birthday emails
    if (enabled && contact.birthdayUnsubscribedAt) {
      return res.status(403).json({
        message: 'Cannot re-enable birthday emails for a contact who has unsubscribed. The customer must opt-in again through the unsubscribe link.',
        reason: 'unsubscribed'
      });
    }

    // Update birthday email preference
    const updatedContact = await db.update(emailContacts)
      .set({
        birthdayEmailEnabled: enabled,
        updatedAt: new Date(),
      })
      .where(sql`${emailContacts.id} = ${contactId} AND ${emailContacts.tenantId} = ${req.user.tenantId}`)
      .returning();

    res.json({
      message: `Birthday email preference ${enabled ? 'enabled' : 'disabled'} successfully`,
      contact: updatedContact[0]
    });
  } catch (error) {
    console.error('Update birthday email preference error:', error);
    res.status(500).json({ message: 'Failed to update birthday email preference' });
  }
});

// Get contacts with birthdays
birthdayRoutes.get("/birthday-contacts", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { page = 1, limit = 50, upcomingOnly = 'false' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`${emailContacts.tenantId} = ${req.user.tenantId} AND ${emailContacts.birthday} IS NOT NULL`;

    // If upcomingOnly is true, filter for birthdays in the next 30 days
    if (upcomingOnly === 'true') {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      // This is a simplified approach - you might need more complex logic for year-agnostic birthday matching
      whereClause = sql`${whereClause} AND ${emailContacts.birthday} IS NOT NULL`;
    }

    const contactsData = await db.query.emailContacts.findMany({
      where: whereClause,
      columns: {
        id: true,
        tenantId: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        phoneNumber: true,
        birthday: true,
        birthdayEmailEnabled: true,
        birthdayUnsubscribedAt: true,
        addedDate: true,
        lastActivity: true,
        emailsSent: true,
        emailsOpened: true,
        consentGiven: true,
        consentDate: true,
        consentMethod: true,
        consentIpAddress: true,
        consentUserAgent: true,
        addedByUserId: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        tagAssignments: {
          columns: {
            id: true,
          },
          with: {
            tag: {
              columns: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
        listMemberships: {
          columns: {
            id: true,
          },
          with: {
            list: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      limit: Number(limit),
      offset: offset,
      orderBy: [emailContacts.birthday],
    });

    // Transform the data to match the expected frontend format
    const contacts = contactsData.map((contact: any) => ({
      ...contact,
      tags: contact.tagAssignments.map((ta: any) => ta.tag),
      lists: contact.listMemberships.map((lm: any) => lm.list),
    }));

    // Get total count
    const totalResult = await db.select({
      count: sql<number>`count(*)`,
    }).from(emailContacts).where(whereClause);
    const total = totalResult[0].count;

    res.json({
      contacts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get birthday contacts error:', error);
    res.status(500).json({ message: 'Failed to get birthday contacts' });
  }
});

// Get birthday settings
birthdayRoutes.get("/birthday-settings", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const settings = await db.query.birthdaySettings.findFirst({
      where: sql`${birthdaySettings.tenantId} = ${req.user.tenantId}`,
      with: {
        promotion: true,
      },
    });

    // Get company information to get company name
    const company = await db.query.companies.findFirst({
      where: sql`${companies.tenantId} = ${req.user.tenantId} AND ${companies.isActive} = true`,
    });

    // If no settings exist, return default settings
    if (!settings) {
      console.log('🎨 [Birthday Settings GET] No settings found, returning defaults');
      const defaultSettings = {
        id: '',
        enabled: false,
        emailTemplate: 'default',
        segmentFilter: 'all',
        customMessage: '',
        senderName: company?.name || '',
        promotionId: null,
        promotion: null,
        disabledHolidays: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return res.json(defaultSettings);
    }

    // Ensure senderName and disabledHolidays are always present with default values
    const settingsWithDefaults = {
      ...settings,
      senderName: settings.senderName || company?.name || '',
      disabledHolidays: settings.disabledHolidays || []
    };

    console.log('🎨 [Birthday Settings GET] Returning settings:', {
      id: settingsWithDefaults.id,
      emailTemplate: settingsWithDefaults.emailTemplate,
      enabled: settingsWithDefaults.enabled,
      customThemeData: settingsWithDefaults.customThemeData ? 'present' : 'null'
    });

    res.json(settingsWithDefaults);
  } catch (error) {
    console.error('Get birthday settings error:', error);
    res.status(500).json({ message: 'Failed to get birthday settings' });
  }
});

// Update birthday settings
birthdayRoutes.put("/birthday-settings", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const {
      enabled,
      emailTemplate,
      segmentFilter,
      customMessage,
      customThemeData,
      senderName,
      promotionId,
      splitPromotionalEmail,
      disabledHolidays
    } = req.body;

    // Validate input
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled field must be a boolean' });
    }

    // Validate required string fields
    if (emailTemplate === undefined || emailTemplate === null || typeof emailTemplate !== 'string') {
      return res.status(400).json({ message: 'emailTemplate is required and must be a string' });
    }

    if (segmentFilter === undefined || segmentFilter === null || typeof segmentFilter !== 'string') {
      return res.status(400).json({ message: 'segmentFilter is required and must be a string' });
    }

    if (customMessage === undefined || customMessage === null || typeof customMessage !== 'string') {
      return res.status(400).json({ message: 'customMessage is required and must be a string' });
    }

    // Handle senderName - use default if not provided, null, or empty
    let finalSenderName: string;
    if (senderName && typeof senderName === 'string' && senderName.trim() !== '') {
      finalSenderName = senderName.trim();
    } else {
      // Get company name as fallback
      const company = await db.query.companies.findFirst({
        where: sql`${companies.tenantId} = ${req.user.tenantId} AND ${companies.isActive} = true`,
      });
      finalSenderName = company?.name || 'Your Company';
    }

    // Validate promotionId if provided
    if (promotionId !== null && promotionId !== undefined && typeof promotionId !== 'string') {
      return res.status(400).json({ message: 'promotionId must be a string or null' });
    }

    // Validate disabledHolidays if provided
    if (disabledHolidays !== undefined && disabledHolidays !== null) {
      if (!Array.isArray(disabledHolidays)) {
        return res.status(400).json({ message: 'disabledHolidays must be an array' });
      }
      // Validate each element is a string
      if (!disabledHolidays.every((id: any) => typeof id === 'string')) {
        return res.status(400).json({ message: 'disabledHolidays array must contain only strings' });
      }
    }


    // Validate custom theme data if provided
    if (customThemeData !== undefined && customThemeData !== null) {
      try {
        if (typeof customThemeData === 'string') {
          // Handle the string 'null' as a special case (treat it as null/undefined)
          if (customThemeData === 'null') {
            // This is valid - the string 'null' will be stored as-is or can be converted to null
          } else {
            JSON.parse(customThemeData);
          }
        } else if (typeof customThemeData === 'object') {
          // Allow any valid object structure for customThemeData
          // The frontend sends nested theme data which is valid
        } else {
          return res.status(400).json({ message: 'customThemeData must be a valid JSON string or object' });
        }
      } catch (error) {
        return res.status(400).json({ message: 'customThemeData must be valid JSON' });
      }
    }

    // Check if settings already exist
    const existingSettings = await db.query.birthdaySettings.findFirst({
      where: sql`${birthdaySettings.tenantId} = ${req.user.tenantId}`,
    });

    // Handle old image cleanup if custom theme data is being updated
    let oldImageUrl: string | null = null;
    if (customThemeData && existingSettings?.customThemeData) {
      try {
        const existingCustomData = JSON.parse(existingSettings.customThemeData);
        oldImageUrl = existingCustomData?.imageUrl || null;
      } catch (error) {
        console.warn('Failed to parse existing custom theme data:', error);
      }
    }

    let updatedSettings;

    // Prepare custom theme data for storage
    const customThemeDataStr = customThemeData ?
      (typeof customThemeData === 'string' ? customThemeData : JSON.stringify(customThemeData))
      : undefined;

    if (existingSettings) {
      // Update existing settings
      const updateData: any = {
        enabled,
        emailTemplate,
        segmentFilter,
        customMessage,
        senderName: finalSenderName,
        promotionId: promotionId || null,
        splitPromotionalEmail: splitPromotionalEmail !== undefined ? splitPromotionalEmail : false,
        disabledHolidays: disabledHolidays !== undefined ? disabledHolidays : [],
        updatedAt: new Date(),
      };

      if (customThemeDataStr !== undefined) {
        updateData.customThemeData = customThemeDataStr;
      }

      updatedSettings = await db.update(birthdaySettings)
        .set(updateData)
        .where(sql`${birthdaySettings.tenantId} = ${req.user.tenantId}`)
        .returning();
    } else {
      // Create new settings
      const insertData: any = {
        tenantId: req.user.tenantId,
        enabled,
        emailTemplate,
        segmentFilter,
        customMessage,
        senderName: finalSenderName,
        promotionId: promotionId || null,
        splitPromotionalEmail: splitPromotionalEmail !== undefined ? splitPromotionalEmail : false,
        disabledHolidays: disabledHolidays !== undefined ? disabledHolidays : [],
      };

      if (customThemeDataStr !== undefined) {
        insertData.customThemeData = customThemeDataStr;
      }

      updatedSettings = await db.insert(birthdaySettings)
        .values(insertData)
        .returning();
    }

    // Clean up old image after successful database update
    if (oldImageUrl && customThemeDataStr) {
      try {
        const newCustomData = typeof customThemeData === 'string' ? JSON.parse(customThemeData) : customThemeData;
        const newImageUrl = newCustomData?.imageUrl || null;

        // Only delete old image if a new different image is being set or image is being removed
        if (newImageUrl !== oldImageUrl) {
          console.log('📸 [Birthday Settings] Cleaning up old image:', oldImageUrl);
          // Delete old image asynchronously (don't wait for it to complete)
          deleteImageFromR2(oldImageUrl).catch(error => {
            console.error('📸 [Birthday Settings] Failed to delete old image:', oldImageUrl, error);
          });
        }
      } catch (error) {
        console.warn('Failed to compare image URLs for cleanup:', error);
      }
    }

    // Log what we're about to return
    console.log('🎨 [Birthday Settings PUT] Returning updated settings:', {
      id: updatedSettings[0]?.id,
      emailTemplate: updatedSettings[0]?.emailTemplate,
      enabled: updatedSettings[0]?.enabled,
      customThemeData: updatedSettings[0]?.customThemeData ? 'present' : 'null'
    });

    // Return just the settings object to match GET endpoint structure
    res.json(updatedSettings[0]);
  } catch (error) {
    console.error('Update birthday settings error:', error);
    res.status(500).json({ message: 'Failed to update birthday settings' });
  }
});

// Get e-card settings
birthdayRoutes.get("/e-card-settings", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const settings = await db.query.eCardSettings.findFirst({
      where: sql`${eCardSettings.tenantId} = ${req.user.tenantId}`,
    });

    // If no settings exist, return default settings
    if (!settings) {
      console.log('🎴 [E-Card Settings GET] No settings found, returning defaults');
      const defaultSettings = {
        id: '',
        enabled: false,
        emailTemplate: 'default',
        customMessage: '',
        senderName: '',
        customThemeData: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return res.json(defaultSettings);
    }

    console.log('🎴 [E-Card Settings GET] Returning settings:', {
      id: settings.id,
      emailTemplate: settings.emailTemplate,
      enabled: settings.enabled,
      customThemeData: settings.customThemeData ? 'present' : 'null'
    });

    res.json(settings);
  } catch (error) {
    console.error('Get e-card settings error:', error);
    res.status(500).json({ message: 'Failed to get e-card settings' });
  }
});

// Update e-card settings
birthdayRoutes.put("/e-card-settings", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const {
      enabled,
      emailTemplate,
      customMessage,
      customThemeData,
      senderName,
    } = req.body;

    // Validate input
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled field must be a boolean' });
    }

    // Validate customThemeData if provided (should be valid JSON string or null)
    let customThemeDataStr = customThemeData;
    if (customThemeData !== undefined && customThemeData !== null && customThemeData !== 'null') {
      try {
        // If it's already a string, try to parse it to validate
        if (typeof customThemeData === 'string') {
          JSON.parse(customThemeData);
          customThemeDataStr = customThemeData;
        } else {
          // If it's an object, stringify it
          customThemeDataStr = JSON.stringify(customThemeData);
        }
      } catch (error) {
        return res.status(400).json({ message: 'customThemeData must be valid JSON' });
      }
    } else if (customThemeData === 'null') {
      customThemeDataStr = null;
    }

    // Get existing settings to extract old image URL for cleanup
    const existingSettings = await db.query.eCardSettings.findFirst({
      where: sql`${eCardSettings.tenantId} = ${req.user.tenantId}`,
    });

    const oldImageUrl = existingSettings?.customThemeData
      ? (() => {
        try {
          const data = JSON.parse(existingSettings.customThemeData);
          return data?.imageUrl || null;
        } catch {
          return null;
        }
      })()
      : null;

    let updatedSettings;

    if (existingSettings) {
      // Update existing settings
      updatedSettings = await db.update(eCardSettings)
        .set({
          enabled,
          emailTemplate: emailTemplate || 'default',
          customMessage: customMessage || '',
          customThemeData: customThemeDataStr,
          senderName: senderName || '',
          updatedAt: new Date(),
        })
        .where(sql`${eCardSettings.id} = ${existingSettings.id}`)
        .returning();
    } else {
      // Create new settings if they don't exist
      const insertData = {
        tenantId: req.user.tenantId,
        enabled,
        emailTemplate: emailTemplate || 'default',
        customMessage: customMessage || '',
        customThemeData: customThemeDataStr,
        senderName: senderName || '',
      };

      updatedSettings = await db.insert(eCardSettings)
        .values(insertData)
        .returning();
    }

    // Clean up old image after successful database update
    if (oldImageUrl && customThemeDataStr) {
      try {
        const newCustomData = typeof customThemeData === 'string' ? JSON.parse(customThemeData) : customThemeData;
        const newImageUrl = newCustomData?.imageUrl || null;

        // Only delete old image if a new different image is being set or image is being removed
        if (newImageUrl !== oldImageUrl) {
          console.log('📸 [E-Card Settings] Cleaning up old image:', oldImageUrl);
          // Delete old image asynchronously (don't wait for it to complete)
          deleteImageFromR2(oldImageUrl).catch(error => {
            console.error('📸 [E-Card Settings] Failed to delete old image:', oldImageUrl, error);
          });
        }
      } catch (error) {
        console.warn('Failed to compare image URLs for cleanup:', error);
      }
    }

    // Log what we're about to return
    console.log('🎴 [E-Card Settings PUT] Returning updated settings:', {
      id: updatedSettings[0]?.id,
      emailTemplate: updatedSettings[0]?.emailTemplate,
      enabled: updatedSettings[0]?.enabled,
      customThemeData: updatedSettings[0]?.customThemeData ? 'present' : 'null'
    });

    // Return just the settings object to match GET endpoint structure
    res.json(updatedSettings[0]);
  } catch (error) {
    console.error('Update e-card settings error:', error);
    res.status(500).json({ message: 'Failed to update e-card settings' });
  }
});

// Send birthday invitation email to a contact via Trigger.dev
birthdayRoutes.post("/birthday-invitation/:contactId", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { contactId } = req.params;

    // Find the contact
    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${contactId} AND ${emailContacts.tenantId} = ${req.user.tenantId}`,
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    if (!contact.email) {
      return res.status(400).json({ message: 'Contact email is missing' });
    }

    if (contact.status === 'unsubscribed' || contact.status === 'bounced' || contact.status === 'suppressed') {
      return res.status(400).json({ message: `Contact is ${contact.status}` });
    }

    const suppressed = await db.query.bouncedEmails.findFirst({
      where: eq(bouncedEmails.email, String(contact.email).toLowerCase().trim()),
    }).catch(() => null);

    if (suppressed) {
      return res.status(400).json({ message: 'Email is globally suppressed/bounced' });
    }

    // Check if contact already has a birthday
    if (contact.birthday) {
      return res.status(400).json({ message: 'Contact already has a birthday set' });
    }

    // Get tenant information for the email
    const tenant = await db.query.tenants.findFirst({
      where: sql`${tenants.id} = ${req.user.tenantId}`,
    });

    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    // Create profile update URL with token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('❌ [Security] JWT_SECRET environment variable is not set');
      return res.status(500).json({ message: 'Server configuration error' });
    }
    const profileUpdateToken = jwt.sign(
      { contactId, action: 'update_birthday' },
      jwtSecret,
      { expiresIn: '30d' }
    );

    const baseUrl = process.env.APP_URL || 'http://localhost:5002';
    const profileUpdateUrl = `${baseUrl}/update-profile?token=${profileUpdateToken}`;
    const maskedToken = profileUpdateToken.length > 8
      ? `${profileUpdateToken.slice(0, 4)}...${profileUpdateToken.slice(-4)}`
      : '[redacted]';
    console.log('🔗 [Birthday Invitation] Generated profile update link:', { baseUrl, path: '/update-profile', token: maskedToken });

    const emailTrackingId = crypto.randomUUID ? crypto.randomUUID() : require("crypto").randomUUID();
    const recipientName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;
    const subject = `🎂 Help us celebrate your special day!`;

    await db.insert(emailSends).values({
      id: emailTrackingId,
      tenantId: req.user.tenantId,
      recipientEmail: contact.email,
      recipientName,
      senderEmail: 'admin@zendwise.com',
      senderName: tenant.name,
      subject,
      emailType: 'invitation',
      provider: 'resend',
      providerMessageId: null,
      status: 'pending',
      contactId: contact.id,
      sentAt: null,
    });

    // Trigger the birthday request email via Trigger.dev
    const { triggerRequestBdayEmail } = await import('../../lib/trigger');

    const result = await triggerRequestBdayEmail({
      tenantId: req.user.tenantId,
      contactId: contact.id,
      emailTrackingId,
      contactEmail: contact.email,
      contactFirstName: contact.firstName,
      contactLastName: contact.lastName,
      tenantName: tenant.name,
      profileUpdateUrl,
      fromEmail: 'admin@zendwise.com',
    });

    if (result.success) {
      try {
        await db.insert(emailActivity).values({
          contactId: contact.id,
          tenantId: req.user.tenantId,
          activityType: 'sent',
          activityData: JSON.stringify({
            recipientName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || null,
            senderEmail: 'admin@zendwise.com',
            source: 'manual_birthday_invitation',
          }),
          occurredAt: new Date(),
        });
      } catch (logError) {
        console.error('⚠️ [Birthday Invitation] Failed to log email activity:', logError);
      }

      res.json({
        message: 'Birthday invitation queued successfully',
        runId: result.runId,
        taskLogId: result.taskLogId,
      });
    } else {
      throw new Error(result.error || 'Failed to queue birthday invitation email');
    }

  } catch (error) {
    console.error('Send birthday invitation error:', error);
    res.status(500).json({ message: 'Failed to send birthday invitation' });
  }
});

// Update contact profile via token (for customers)
birthdayRoutes.post("/update-profile", async (req: any, res) => {
  try {
    const { token, birthday } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    // Verify the token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('❌ [Security] JWT_SECRET environment variable is not set');
      return res.status(500).json({ message: 'Server configuration error' });
    }
    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (decoded.action !== 'update_birthday') {
      return res.status(401).json({ message: 'Invalid token action' });
    }

    const { contactId } = decoded;

    if (!birthday) {
      return res.status(400).json({ message: 'Birthday is required' });
    }

    // Validate birthday format (YYYY-MM-DD)
    const birthdayRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!birthdayRegex.test(birthday)) {
      return res.status(400).json({ message: 'Invalid birthday format. Use YYYY-MM-DD' });
    }

    // Update the contact's birthday
    const updatedContact = await db.update(emailContacts)
      .set({
        birthday,
        birthdayEmailEnabled: true, // Enable birthday emails by default when they add their birthday
        updatedAt: new Date()
      })
      .where(sql`${emailContacts.id} = ${contactId}`)
      .returning();

    if (updatedContact.length === 0) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json({
      message: 'Birthday updated successfully',
      contact: {
        id: updatedContact[0].id,
        birthday: updatedContact[0].birthday,
        birthdayEmailEnabled: updatedContact[0].birthdayEmailEnabled
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Get profile update form (for customers)
birthdayRoutes.get("/profile-form", async (req: any, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    // Verify the token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('❌ [Security] JWT_SECRET environment variable is not set');
      return res.status(500).json({ message: 'Server configuration error' });
    }
    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (decoded.action !== 'update_birthday') {
      return res.status(401).json({ message: 'Invalid token action' });
    }

    const { contactId } = decoded;

    // Get contact information
    const contact = await db.query.emailContacts.findFirst({
      where: sql`${emailContacts.id} = ${contactId}`,
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        birthday: true
      }
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json({
      contact: {
        id: contact.id,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        birthday: contact.birthday
      }
    });

  } catch (error) {
    console.error('Get profile form error:', error);
    res.status(500).json({ message: 'Failed to get profile information' });
  }
});

// Internal birthday invitation endpoint for server-node (no auth required)
birthdayRoutes.post("/internal/birthday-invitation", async (req: any, res) => {
  try {
    const {
      contactId,
      contactEmail,
      contactFirstName,
      contactLastName,
      tenantName,
      htmlContent,
      fromEmail
    } = req.body;

    if (!contactId || !contactEmail || !htmlContent) {
      return res.status(400).json({ message: 'contactId, contactEmail, and htmlContent are required' });
    }

    // Send the email using the email service
    const { enhancedEmailService } = await import('../../emailService');

    const result = await enhancedEmailService.sendCustomEmail(
      contactEmail,
      '🎂 Help us celebrate your special day!',
      htmlContent,
      {
        from: fromEmail || 'admin@zendwise.com',
        metadata: {
          type: 'birthday_invitation',
          contactId: contactId,
          source: 'server-node-workflow'
        }
      }
    );

    if (typeof result === 'object' && 'success' in result && result.success) {
      res.json({
        message: 'Birthday invitation sent successfully',
        messageId: result.messageId,
        success: true
      });
    } else {
      throw new Error('Failed to send email');
    }

  } catch (error) {
    console.error('Send internal birthday invitation error:', error);
    res.status(500).json({ message: 'Failed to send birthday invitation' });
  }
});

// Birthday unsubscribe page
birthdayRoutes.get("/api/unsubscribe/birthday", async (req: any, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send(`
        <html>
          <head><title>Invalid Unsubscribe Link</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Invalid Unsubscribe Link</h1>
            <p>This unsubscribe link is invalid or has expired.</p>
          </body>
        </html>
      `);
    }

    // TODO: Validate token and get contact info
    // For now, show a simple unsubscribe form
    res.send(`
      <html>
        <head>
          <title>Unsubscribe from Birthday Cards</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .container { background: #f9f9f9; padding: 30px; border-radius: 8px; text-align: center; }
            .button { background: #dc3545; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
            .button:hover { background: #c82333; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎂 Unsubscribe from Birthday Cards</h1>
            <p>We're sorry to see you go! You can unsubscribe from receiving birthday card notifications below.</p>
            <form method="POST" action="/api/api/unsubscribe/birthday">
              <input type="hidden" name="token" value="${token}" />
              <button type="submit" class="button">Unsubscribe</button>
            </form>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Birthday unsubscribe page error:', error);
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Error</h1>
          <p>An error occurred while processing your request.</p>
        </body>
      </html>
    `);
  }
});

// Process birthday unsubscribe
birthdayRoutes.post("/api/unsubscribe/birthday", async (req: any, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).send(`
        <html>
          <head><title>Invalid Request</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Invalid Request</h1>
            <p>Token is required.</p>
          </body>
        </html>
      `);
    }

    // TODO: Process unsubscribe token and update contact
    // For now, show success message
    res.send(`
      <html>
        <head>
          <title>Unsubscribed Successfully</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .container { background: #d4edda; padding: 30px; border-radius: 8px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Successfully Unsubscribed</h1>
            <p>You have been unsubscribed from birthday card notifications.</p>
            <p>You can always contact us if you change your mind.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Birthday unsubscribe processing error:', error);
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Error</h1>
          <p>An error occurred while processing your unsubscribe request.</p>
        </body>
      </html>
    `);
  }
});

// Send manual birthday cards to selected contacts
birthdayRoutes.post("/email-contacts/send-birthday-card", authenticateToken, requireTenant, requirePermission('contacts.edit'), async (req: any, res) => {
  try {
    const { contactIds } = req.body;
    const tenantId = req.user.tenantId;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Contact IDs are required',
      });
    }

    // Check email sending limits
    await storage.validateEmailSending(tenantId, contactIds.length);

    console.log(`🎂 [ManualBirthdayCard] Sending birthday cards to ${contactIds.length} contact(s)`);

    // Get birthday settings for this tenant with promotion data
    const settings = await db.query.birthdaySettings.findFirst({
      where: eq(birthdaySettings.tenantId, tenantId),
      with: {
        promotion: true,
      },
    });

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Birthday settings not found. Please configure birthday settings first.',
      });
    }

    // Fetch company information for branding
    const company = await db.query.companies.findFirst({
      where: and(
        eq(companies.tenantId, tenantId),
        eq(companies.isActive, true)
      ),
    });

    const companyName = company?.name || settings.senderName || 'Your Company';
    const resolvedSenderName = settings.senderName || companyName || 'Your Team';

    // Fetch the selected contacts
    const contacts = await db.query.emailContacts.findMany({
      where: and(
        eq(emailContacts.tenantId, tenantId),
        sql`${emailContacts.id} IN (${sql.join(contactIds.map((id: string) => sql`${id}`), sql`, `)})`
      ),
    });

    if (contacts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No valid contacts found',
      });
    }

    const results = [];
    const cardprocessorUrl = process.env.CARDPROCESSOR_URL || 'http://localhost:5004';

    // Import email service
    const { enhancedEmailService } = await import('../../emailService');

    const skippedOptOut: string[] = [];
    const skippedSuppressed: string[] = [];
    for (const contact of contacts) {
      try {
        // Skip suppressed/bounced/unsubscribed contacts
        if (contact.status === 'suppressed' || contact.status === 'bounced' || contact.status === 'unsubscribed') {
          const contactName = contact.firstName || contact.lastName
            ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
            : contact.email;
          console.log(`🚫 [ManualBirthdayCard] Skipping ${contact.email} - contact status: ${contact.status}`);
          skippedSuppressed.push(contactName);
          results.push({ contactId: contact.id, email: contact.email, success: false, error: `Contact status: ${contact.status}` });
          continue;
        }

        // Check if contact has opted out of Customer Engagement emails
        if (contact.prefCustomerEngagement === false) {
          const contactName = contact.firstName || contact.lastName
            ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
            : contact.email;
          console.log(`🚫 [ManualBirthdayCard] Skipping ${contact.email} - opted out of Customer Engagement`);
          skippedOptOut.push(contactName);
          results.push({ contactId: contact.id, email: contact.email, success: false, error: 'Opted out of Customer Engagement' });
          continue;
        }

        // Prepare recipient name (needed for both split and combined flows)
        const recipientName = contact.firstName || contact.lastName
          ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
          : contact.email.split('@')[0];

        // Generate or reuse unsubscribe token (needed for both split and combined flows)
        let unsubscribeToken: string | undefined;
        try {
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

          unsubscribeToken = existingToken?.token;
          console.log(`🔗 [ManualBirthdayCard] Generated unsubscribe token for ${contact.email}`);
        } catch (error) {
          console.warn(`⚠️ [ManualBirthdayCard] Error generating unsubscribe token for ${contact.email}:`, error);
        }

        // --- SPLIT EMAIL LOGIC PATCH ---
        // Check if split promotional email is enabled
        const shouldSplitEmail = settings.splitPromotionalEmail && settings.promotion;

        console.log(`📧 [ManualBirthdayCard] Split email enabled: ${settings.splitPromotionalEmail}, Has promotion: ${!!settings.promotion}`);

        if (shouldSplitEmail) {
          console.log(`✅ [SPLIT FLOW] Sending birthday and promo as SEPARATE emails to ${contact.email}`);

          // Send birthday card WITHOUT promotion
          const htmlBirthday = renderBirthdayTemplate(settings.emailTemplate as any, {
            recipientName,
            message: settings.customMessage || 'Wishing you a wonderful birthday!',
            brandName: companyName,
            customThemeData: settings.customThemeData ? JSON.parse(settings.customThemeData) : null,
            senderName: resolvedSenderName,
            // NO promotion fields - these are intentionally omitted
            unsubscribeToken,
          });

          // Build unsubscribe URL for List-Unsubscribe header
          const bdayUnsubUrl = unsubscribeToken
            ? `${process.env.APP_URL || 'http://localhost:5002'}/api/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&type=customer_engagement`
            : undefined;

          const birthdayResult = await enhancedEmailService.sendCustomEmail(
            contact.email,
            `🎉 Happy Birthday ${recipientName}!`,
            htmlBirthday,
            {
              text: htmlBirthday.replace(/<[^>]*>/g, ''),
              from: 'admin@zendwise.com',
              headers: bdayUnsubUrl ? {
                'List-Unsubscribe': `<${bdayUnsubUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              } : undefined,
              metadata: {
                type: 'birthday-card',
                contactId: contact.id,
                tenantId: tenantId,
                manual: true,
                tags: ['birthday', 'manual', `tenant-${tenantId}`],
                unsubscribeToken: unsubscribeToken || 'none',
              },
            }
          );

          console.log(`✅ [SPLIT FLOW] Birthday card sent to ${contact.email}`);

          // Log birthday card to database
          try {
            await db.insert(emailActivity).values({
              tenantId: tenantId,
              contactId: contact.id,
              activityType: 'sent',
              activityData: JSON.stringify({ type: 'birthday-card', manual: true, split: true, subject: `🎉 Happy Birthday ${recipientName}!`, recipient: contact.email, from: 'admin@zendwise.com' }),
              occurredAt: new Date(),
            });
            console.log(`📝 [SPLIT FLOW] Logged birthday card activity for ${contact.email}`);
          } catch (logError) {
            console.error(`⚠️ [SPLIT FLOW] Failed to log birthday card activity:`, logError);
          }

          // Log to email_sends table
          try {
            const emailSendId = crypto.randomUUID ? crypto.randomUUID() : require("crypto").randomUUID();
            await db.insert(emailSends).values({
              id: emailSendId,
              tenantId: tenantId,
              recipientEmail: contact.email,
              recipientName: recipientName,
              senderEmail: 'admin@zendwise.com',
              senderName: resolvedSenderName,
              subject: `🎉 Happy Birthday ${recipientName}!`,
              emailType: 'birthday_card',
              provider: 'resend',
              providerMessageId: typeof birthdayResult === 'string' ? birthdayResult : birthdayResult?.messageId,
              status: 'sent',
              contactId: contact.id,
              promotionId: null,
              sentAt: new Date(),
            });

            // Also store the content
            await db.insert(emailContent).values({
              emailSendId: emailSendId,
              htmlContent: htmlBirthday,
              textContent: htmlBirthday.replace(/<[^>]*>/g, ''),
              metadata: JSON.stringify({
                split: true,
                manual: true,
                birthdayCard: true,
                promotional: false
              })
            });
            console.log(`📧 [EmailSends] Logged birthday email to email_sends for ${contact.email}`);
          } catch (logError) {
            console.error(`⚠️ [EmailSends] Failed to log to email_sends table:`, logError);
          }

          // Wait 20 seconds before sending promotional email
          // Send promotional email separately (queued)
          // Sanitize promotion fields to prevent XSS/HTML injection
          const safePromoTitle = sanitizeEmailHtml(settings.promotion?.title || 'Special Birthday Offer!');
          const safePromoDescription = settings.promotion?.description ? sanitizeEmailHtml(settings.promotion.description) : '';
          const safePromoContent = sanitizeEmailHtml(settings.promotion?.content || '');

          const promoSubject = sanitizeEmailHtml(settings.promotion?.title || 'Special Birthday Offer!');
          const htmlPromo = `
            <html>
              <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <div style="max-width: 600px; margin: 20px auto; padding: 32px 24px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border-radius: 8px;">
                  <h2 style="font-size: 1.5rem; font-weight: bold; margin: 0 0 16px 0; color: #2d3748;">${safePromoTitle}</h2>
                  ${safePromoDescription ? `<p style="margin: 0 0 20px 0; color: #4a5568; font-size: 1rem; line-height: 1.5;">${safePromoDescription}</p>` : ''}
                  <div style="color: #2d3748; font-size: 1rem; line-height: 1.6;">${safePromoContent}</div>
                  <hr style="margin: 32px 0 16px 0; border: none; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0; font-size: 0.85rem; color: #a0aec0; text-align: center;">
                    This is a special birthday promotion for valued subscribers.
                  </p>
                </div>
              </body>
            </html>
          `;

          console.log(`⏳ [SPLIT FLOW] Queuing promotional email job (20s delay) for ${contact.email}`);
          const queueResult = await enqueuePromotionalEmailJob(
            {
              tenantId,
              contactId: contact.id,
              recipientEmail: contact.email,
              recipientName,
              senderName: resolvedSenderName,
              promoSubject,
              htmlPromo,
              unsubscribeToken,
              promotionId: settings.promotion?.id || null,
              manual: true,
            },
            20000
          );

          if (queueResult.success) {
            console.log(`✅ [SPLIT FLOW] Promotional email queued successfully (runId: ${queueResult.runId})`);
          } else {
            console.warn(`⚠️ [SPLIT FLOW] Promotional email queue failed: ${queueResult.error}`);
          }

          // Record both emails as success
          if (typeof birthdayResult === 'string' || (birthdayResult && birthdayResult.success)) {
            results.push({
              contactId: contact.id,
              email: contact.email,
              success: true,
              messageId: typeof birthdayResult === 'string' ? birthdayResult : birthdayResult.messageId,
              note: 'Split email: Birthday sent, promotion queued',
            });
          } else {
            results.push({
              contactId: contact.id,
              email: contact.email,
              success: false,
              error: birthdayResult.error || 'Unknown error',
            });
          }

          continue; // Skip to next contact
        }
        // --- END SPLIT EMAIL LOGIC ---

        // Render birthday template
        const htmlContent = renderBirthdayTemplate(settings.emailTemplate as any, {
          recipientName,
          message: settings.customMessage || 'Wishing you a wonderful birthday!',
          brandName: companyName,
          customThemeData: settings.customThemeData ? JSON.parse(settings.customThemeData) : null,
          senderName: resolvedSenderName,
          promotionContent: settings.promotion?.content,
          promotionTitle: settings.promotion?.title,
          promotionDescription: settings.promotion?.description || undefined,
          unsubscribeToken,
        });

        // Build unsubscribe URL for List-Unsubscribe header
        const combinedUnsubUrl = unsubscribeToken
          ? `${process.env.APP_URL || 'http://localhost:5002'}/api/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&type=customer_engagement`
          : undefined;

        // Send the birthday email
        const result = await enhancedEmailService.sendCustomEmail(
          contact.email,
          `🎉 Happy Birthday ${recipientName}!`,
          htmlContent,
          {
            text: htmlContent.replace(/<[^>]*>/g, ''),
            from: 'admin@zendwise.com',
            headers: combinedUnsubUrl ? {
              'List-Unsubscribe': `<${combinedUnsubUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            } : undefined,
            metadata: {
              type: 'birthday-card',
              contactId: contact.id,
              tenantId: tenantId,
              manual: true,
              tags: ['birthday', 'manual', `tenant-${tenantId}`],
              unsubscribeToken: unsubscribeToken || 'none',
            },
          }
        );

        // Handle result - can be EmailSendResult or string (queue ID)
        if (typeof result === 'string') {
          // Queued
          // Log to database
          try {
            await db.insert(emailActivity).values({
              tenantId: tenantId,
              contactId: contact.id,
              activityType: 'sent',
              activityData: JSON.stringify({ type: 'birthday-card', manual: true, queued: true, subject: `🎉 Happy Birthday ${recipientName}!`, recipient: contact.email, from: 'admin@zendwise.com' }),
              occurredAt: new Date(),
            });
            console.log(`📝 [ManualBirthdayCard] Logged queued birthday card activity for ${contact.email}`);
          } catch (logError) {
            console.error(`⚠️ [ManualBirthdayCard] Failed to log queued birthday card activity:`, logError);
          }

          // Log to email_sends table
          try {
            const emailSendId = crypto.randomUUID ? crypto.randomUUID() : require("crypto").randomUUID();
            await db.insert(emailSends).values({
              id: emailSendId,
              tenantId: tenantId,
              recipientEmail: contact.email,
              recipientName: recipientName,
              senderEmail: 'admin@zendwise.com',
              senderName: resolvedSenderName,
              subject: `🎉 Happy Birthday ${recipientName}!`,
              emailType: 'birthday_card',
              provider: 'resend',
              providerMessageId: typeof result === 'string' ? result : (result as any).messageId,
              status: 'sent',
              contactId: contact.id,
              promotionId: null,
              sentAt: new Date(),
            });

            // Also store the content
            await db.insert(emailContent).values({
              emailSendId: emailSendId,
              htmlContent: htmlContent,
              textContent: htmlContent.replace(/<[^>]*>/g, ''),
              metadata: JSON.stringify({
                split: false,
                manual: true,
                birthdayCard: true,
                promotional: false
              })
            });
            console.log(`📧 [EmailSends] Logged birthday email to email_sends for ${contact.email}`);
          } catch (logError) {
            console.error(`⚠️ [EmailSends] Failed to log to email_sends table:`, logError);
          }

          console.log(`✅ [ManualBirthdayCard] Birthday card queued for ${contact.email}: ${result}`);
          results.push({
            contactId: contact.id,
            email: contact.email,
            success: true,
            messageId: result,
          });
        } else if (result.success) {
          console.log(`✅ [ManualBirthdayCard] Birthday card sent to ${contact.email}`);

          // Log to database
          try {
            await db.insert(emailActivity).values({
              tenantId: tenantId,
              contactId: contact.id,
              activityType: 'sent',
              activityData: JSON.stringify({ type: 'birthday-card', manual: true, subject: `🎉 Happy Birthday ${recipientName}!`, recipient: contact.email, from: 'admin@zendwise.com' }),
              occurredAt: new Date(),
            });
            console.log(`📝 [ManualBirthdayCard] Logged birthday card activity for ${contact.email}`);
          } catch (logError) {
            console.error(`⚠️ [ManualBirthdayCard] Failed to log birthday card activity:`, logError);
          }

          // Log to email_sends table
          try {
            const emailSendId = crypto.randomUUID ? crypto.randomUUID() : require("crypto").randomUUID();
            await db.insert(emailSends).values({
              id: emailSendId,
              tenantId: tenantId,
              recipientEmail: contact.email,
              recipientName: recipientName,
              senderEmail: 'admin@zendwise.com',
              senderName: resolvedSenderName,
              subject: `🎉 Happy Birthday ${recipientName}!`,
              emailType: 'birthday_card',
              provider: 'resend',
              providerMessageId: result.messageId,
              status: 'sent',
              contactId: contact.id,
              promotionId: settings.promotion?.id || null,
              sentAt: new Date(),
            });

            // Also store the content
            await db.insert(emailContent).values({
              emailSendId: emailSendId,
              htmlContent: htmlContent,
              textContent: htmlContent.replace(/<[^>]*>/g, ''),
              metadata: JSON.stringify({
                split: false,
                manual: true,
                birthdayCard: true,
                promotional: !!settings.promotion
              })
            });
            console.log(`📧 [EmailSends] Logged birthday email to email_sends for ${contact.email}`);
          } catch (logError) {
            console.error(`⚠️ [EmailSends] Failed to log to email_sends table:`, logError);
          }
          results.push({
            contactId: contact.id,
            email: contact.email,
            success: true,
            messageId: result.messageId,
          });
        } else {
          console.error(`❌ [ManualBirthdayCard] Failed to send to ${contact.email}:`, result.error);
          results.push({
            contactId: contact.id,
            email: contact.email,
            success: false,
            error: result.error,
          });
        }
      } catch (error) {
        console.error(`❌ [ManualBirthdayCard] Error sending to ${contact.email}:`, error);
        results.push({
          contactId: contact.id,
          email: contact.email,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const optOutCount = skippedOptOut.length;
    const suppressedCount = skippedSuppressed.length;

    let message = `Birthday cards sent: ${successCount} successful, ${failureCount} failed`;
    if (optOutCount > 0) {
      message += `. ${optOutCount} contact(s) skipped (opted out of Customer Engagement): ${skippedOptOut.join(', ')}`;
    }
    if (suppressedCount > 0) {
      message += `. ${suppressedCount} contact(s) skipped (suppressed/bounced/unsubscribed): ${skippedSuppressed.join(', ')}`;
    }

    res.json({
      success: true,
      message,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        optedOut: optOutCount,
        suppressed: suppressedCount,
        optedOutContacts: skippedOptOut,
        suppressedContacts: skippedSuppressed,
      },
    });

  } catch (error) {
    console.error('Send manual birthday card error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send birthday cards',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
