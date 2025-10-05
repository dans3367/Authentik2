// Send manual birthday cards to selected contacts
emailManagementRoutes.post("/email-contacts/send-birthday-card", authenticateToken, async (req: any, res) => {
  try {
    const { contactIds } = req.body;
    const tenantId = req.user.tenantId;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Contact IDs are required',
      });
    }

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
    const { enhancedEmailService } = await import('../emailService');

    // Send birthday cards to each contact
    for (const contact of contacts) {
      try {
        // Generate unsubscribe token
        let unsubscribeToken: string | undefined;
        try {
          // Generate a JWT token for internal API call to cardprocessor
          const internalToken = jwt.sign(
            {
              sub: req.user.id,
              tenant: tenantId,
              type: 'internal',
            },
            process.env.JWT_SECRET || '',
            { expiresIn: '5m' }
          );

          const tokenResponse = await fetch(`${cardprocessorUrl}/api/birthday-unsubscribe-token/${contact.id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${internalToken}`,
            },
          });

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            unsubscribeToken = tokenData.token;
            console.log(`🔗 [ManualBirthdayCard] Generated unsubscribe token for ${contact.email}`);
          } else {
            console.warn(`⚠️ [ManualBirthdayCard] Failed to generate unsubscribe token for ${contact.email}`);
          }
        } catch (error) {
          console.warn(`⚠️ [ManualBirthdayCard] Error generating unsubscribe token for ${contact.email}:`, error);
        }

        // Prepare recipient name
        const recipientName = contact.firstName || contact.lastName
          ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
          : contact.email.split('@')[0];

        // Render birthday template
        const htmlContent = renderBirthdayTemplate(settings.emailTemplate as any, {
          recipientName,
          message: settings.customMessage || 'Wishing you a wonderful birthday!',
          brandName: req.user.tenantName || 'Your Company',
          customThemeData: settings.customThemeData ? JSON.parse(settings.customThemeData) : null,
          senderName: settings.senderName || 'Your Team',
          promotionContent: settings.promotion?.content,
          promotionTitle: settings.promotion?.title,
          promotionDescription: settings.promotion?.description,
          unsubscribeToken,
        });

        // Send the birthday email
        const result = await enhancedEmailService.sendCustomEmail(
          contact.email,
          `🎉 Happy Birthday ${recipientName}!`,
          htmlContent,
          {
            text: htmlContent.replace(/<[^>]*>/g, ''),
            from: 'admin@zendwise.work',
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
          console.log(`✅ [ManualBirthdayCard] Birthday card queued for ${contact.email}: ${result}`);
          results.push({
            contactId: contact.id,
            email: contact.email,
            success: true,
            messageId: result,
          });
        } else if (result.success) {
          console.log(`✅ [ManualBirthdayCard] Birthday card sent to ${contact.email}`);
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

    res.json({
      success: true,
      message: `Birthday cards sent: ${successCount} successful, ${failureCount} failed`,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
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

// Helper function to process placeholders in content
function processPlaceholders(content: string, params: { recipientName?: string }): string {
  if (!content) return content;

  let processed = content;

  // Handle {{firstName}} and {{lastName}} placeholders
  const nameParts = (params.recipientName || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  processed = processed.replace(/\{\{firstName\}\}/g, firstName);
  processed = processed.replace(/\{\{lastName\}\}/g, lastName);

  return processed;
}

// Helper function to render birthday template
function renderBirthdayTemplate(
  template: 'default' | 'confetti' | 'balloons' | 'custom',
  params: {
    recipientName?: string;
    message?: string;
    brandName?: string;
    customThemeData?: any;
    senderName?: string;
    promotionContent?: string;
    promotionTitle?: string;
    promotionDescription?: string;
    unsubscribeToken?: string;
  }
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
    const message = processPlaceholders(customData.message || params.message || 'Wishing you a wonderful day!', params);
    const signature = customData.signature || '';
    const fromMessage = params.senderName || 'The Team';
