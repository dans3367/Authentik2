import jwt from 'jsonwebtoken';

export interface GenerateTokenInput {
  contactId: string;
  action: string;
  expiresIn: string;
}

export interface GenerateTokenResult {
  success: boolean;
  token?: string;
  error?: string;
}

export interface PrepareEmailInput {
  contactId: string;
  contactEmail: string;
  contactFirstName?: string;
  contactLastName?: string;
  tenantName?: string;
  invitationToken: string;
  baseUrl?: string;
  promotionId?: string;
  promotionContent?: string;
}

export interface PrepareEmailResult {
  success: boolean;
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  error?: string;
}

export interface SendEmailInput {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  tenantId: string;
  contactId: string;
  invitationToken: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
}

export interface UpdateStatusInput {
  contactId: string;
  tenantId: string;
  invitationSent: boolean;
  invitationToken: string;
  sentAt: string;
}

export interface UpdateStatusResult {
  success: boolean;
  error?: string;
}

/**
 * Generate a secure JWT token for birthday invitation
 */
export async function generateBirthdayInvitationToken(
  input: GenerateTokenInput
): Promise<GenerateTokenResult> {
  try {
    console.log(`🔐 Generating invitation token for contact ${input.contactId}`);

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }

    const token = jwt.sign(
      { 
        contactId: input.contactId, 
        action: input.action 
      },
      jwtSecret,
      { expiresIn: input.expiresIn }
    );

    console.log(`✅ Generated invitation token for contact ${input.contactId}`);

    return {
      success: true,
      token
    };

  } catch (error) {
    console.error(`❌ Failed to generate token for contact ${input.contactId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Prepare birthday invitation email content
 */
export async function prepareBirthdayInvitationEmail(
  input: PrepareEmailInput
): Promise<PrepareEmailResult> {
  try {
    console.log(`📝 Preparing birthday invitation email for contact ${input.contactId}`);

    const baseUrl = input.baseUrl || process.env.BASE_URL || 'http://localhost:3500';
    const profileUpdateUrl = `${baseUrl}/update-profile?token=${input.invitationToken}`;
    
    const contactName = input.contactFirstName 
      ? `${input.contactFirstName}${input.contactLastName ? ` ${input.contactLastName}` : ''}` 
      : 'Valued Customer';
    
    const subject = `🎂 Help us celebrate your special day!`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Birthday Information Request</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #e91e63; margin: 0;">🎂 Birthday Celebration!</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0 0 15px 0; font-size: 16px;">Hi ${contactName},</p>
          
          <p style="margin: 0 0 15px 0;">We'd love to make your birthday extra special! To ensure you don't miss out on exclusive birthday promotions, special offers, and personalized birthday surprises, we'd like to add your birthday to our records.</p>
          
          <p style="margin: 0 0 20px 0;">By sharing your birthday with us, you'll receive:</p>
          
          <ul style="margin: 0 0 20px 20px; padding: 0;">
            <li>🎁 Exclusive birthday discounts and offers</li>
            <li>🎉 Special birthday promotions</li>
            <li>📧 Personalized birthday messages</li>
            <li>🌟 Early access to birthday-themed content</li>
          </ul>
          
          ${input.promotionContent ? `
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <h3 style="color: #856404; margin: 0 0 10px 0; font-size: 16px;">🎉 Special Promotion Just for You!</h3>
            <div style="color: #856404;">${input.promotionContent}</div>
          </div>
          ` : ''}
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${profileUpdateUrl}" 
               style="background: linear-gradient(135deg, #e91e63, #f06292); 
                      color: white; 
                      padding: 12px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      font-weight: bold; 
                      display: inline-block; 
                      box-shadow: 0 4px 8px rgba(233, 30, 99, 0.3);">
              🎂 Add My Birthday
            </a>
          </div>
          
          <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">This link will expire in 30 days. Your privacy is important to us - we'll only use your birthday to send you special offers and birthday wishes.</p>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #888; text-align: center;">
          <p style="margin: 0;">Best regards,<br>${input.tenantName || 'The Team'}</p>
          <p style="margin: 10px 0 0 0;">This invitation was sent because you're a valued customer. If you'd prefer not to receive birthday-related communications, you can simply ignore this email.</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Hi ${contactName},

We'd love to make your birthday extra special! To ensure you don't miss out on exclusive birthday promotions, special offers, and personalized birthday surprises, we'd like to add your birthday to our records.

By sharing your birthday with us, you'll receive:
• Exclusive birthday discounts and offers
• Special birthday promotions  
• Personalized birthday messages
• Early access to birthday-themed content

Add your birthday here: ${profileUpdateUrl}

This link will expire in 30 days. Your privacy is important to us - we'll only use your birthday to send you special offers and birthday wishes.

Best regards,
${input.tenantName || 'The Team'}

This invitation was sent because you're a valued customer. If you'd prefer not to receive birthday-related communications, you can simply ignore this email.
    `;

    console.log(`✅ Prepared birthday invitation email for contact ${input.contactId}`);

    return {
      success: true,
      subject,
      htmlContent,
      textContent
    };

  } catch (error) {
    console.error(`❌ Failed to prepare email for contact ${input.contactId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Send birthday invitation email by calling the main server's API
 */
export async function sendBirthdayInvitationEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  try {
    console.log(`📤 Sending birthday invitation email to ${input.to}`);

    // Call the main server's enhanced email service via HTTP
    const response = await fetch('http://localhost:3500/api/birthday-invitation/' + input.contactId, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In a real application, you would need proper authentication here
      },
      body: JSON.stringify({
        to: input.to,
        from: input.from,
        subject: input.subject,
        html: input.html,
        text: input.text,
        tenantId: input.tenantId,
        contactId: input.contactId,
        invitationToken: input.invitationToken
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send email via main server');
    }

    const result = await response.json();

    console.log(`✅ Birthday invitation email sent successfully to ${input.to}: ${result.messageId}`);
    return {
      success: true,
      messageId: result.messageId,
      provider: 'main-server'
    };

  } catch (error) {
    console.error(`❌ Failed to send birthday invitation email to ${input.to}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Update contact invitation status in database (optional tracking)
 */
export async function updateContactInvitationStatus(
  input: UpdateStatusInput
): Promise<UpdateStatusResult> {
  try {
    console.log(`📊 Updating invitation status for contact ${input.contactId}`);

    // For now, we'll just log this. In a full implementation, you might want to
    // add fields to track invitation status in the database
    console.log(`Contact ${input.contactId} invitation status:`, {
      invitationSent: input.invitationSent,
      sentAt: input.sentAt,
      hasToken: !!input.invitationToken
    });

    console.log(`✅ Updated invitation status for contact ${input.contactId}`);

    return {
      success: true
    };

  } catch (error) {
    console.error(`❌ Failed to update invitation status for contact ${input.contactId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
