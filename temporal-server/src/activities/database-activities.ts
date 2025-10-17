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

export interface GetCompanyNameInput {
  tenantId: string;
}

export interface GetCompanyNameResult {
  success: boolean;
  companyName?: string;
  error?: string;
}

/**
 * Activity stub - actual implementation is in Go cardprocessor-go server
 * This fetches the company name for a given tenant ID
 */
export async function getCompanyName(
  input: GetCompanyNameInput
): Promise<GetCompanyNameResult> {
  // This is a stub - the actual implementation is in Go
  // Temporal will route this to the Go worker
  throw new Error('This activity should be executed by the Go worker');
}
