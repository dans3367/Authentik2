/**
 * Database activities (implemented in Go cardprocessor-go server)
 * These are activity stubs for TypeScript workflows to call Go activities
 */

export interface InsertOutgoingEmailInput {
  tenantId: string;
  recipientEmail: string;
  recipientName?: string;
  senderEmail: string;
  senderName?: string;
  subject: string;
  emailType: string; // 'birthday_card', 'test_card', 'promotional', 'newsletter', 'invitation', 'appointment_reminder'
  provider: string; // 'resend', 'sendgrid', 'mailgun', 'postmark', 'other'
  htmlContent: string;
  textContent: string;
  contactId?: string;
  newsletterId?: string;
  campaignId?: string;
  promotionId?: string;
  metadata?: Record<string, any>;
}

export interface InsertOutgoingEmailResult {
  success: boolean;
  outgoingEmailId?: string;
  error?: string;
}

/**
 * Activity stub - actual implementation is in Go cardprocessor-go server
 * This inserts a record into outgoing_emails table BEFORE sending the email
 * The provider_message_id (resendID) will be NULL and updated later after sending
 */
export async function insertOutgoingEmail(
  input: InsertOutgoingEmailInput
): Promise<InsertOutgoingEmailResult> {
  // This is a stub - the actual implementation is in Go
  // Temporal will route this to the Go worker
  throw new Error('This activity should be executed by the Go worker');
}
