import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/birthday-invitation-activities';

// Proxy activities to be used in workflows
const {
  generateBirthdayInvitationToken,
  prepareBirthdayInvitationEmail,
  sendBirthdayInvitationEmail,
  updateContactInvitationStatus
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  heartbeatTimeout: '1 minute',
  retry: {
    initialInterval: '1 second',
    maximumInterval: '30 seconds',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export interface BirthdayInvitationWorkflowInput {
  contactId: string;
  contactEmail: string;
  contactFirstName?: string;
  contactLastName?: string;
  tenantId: string;
  tenantName?: string;
  userId?: string;
  fromEmail?: string;
  baseUrl?: string;
}

export interface BirthdayInvitationWorkflowResult {
  contactId: string;
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
  sentAt: string;
  invitationToken?: string;
}

/**
 * Birthday invitation workflow that handles the complete process
 * of inviting customers to add their birthday information
 */
export async function birthdayInvitationWorkflow(
  input: BirthdayInvitationWorkflowInput
): Promise<BirthdayInvitationWorkflowResult> {
  
  console.log(`🎂 Starting birthday invitation workflow for contact ${input.contactId}`);

  try {
    // Step 1: Generate secure JWT token for birthday update
    const tokenResult = await generateBirthdayInvitationToken({
      contactId: input.contactId,
      action: 'update_birthday',
      expiresIn: '30d'
    });

    if (!tokenResult.success || !tokenResult.token) {
      throw new Error(`Failed to generate invitation token: ${tokenResult.error}`);
    }

    // Step 2: Prepare email content
    const emailData = await prepareBirthdayInvitationEmail({
      contactId: input.contactId,
      contactEmail: input.contactEmail,
      contactFirstName: input.contactFirstName,
      contactLastName: input.contactLastName,
      tenantName: input.tenantName,
      invitationToken: tokenResult.token,
      baseUrl: input.baseUrl
    });

    if (!emailData.success) {
      throw new Error(`Failed to prepare email: ${emailData.error}`);
    }

    // Step 3: Send the invitation email
    const sendResult = await sendBirthdayInvitationEmail({
      to: input.contactEmail,
      from: input.fromEmail || 'noreply@zendwise.work',
      subject: emailData.subject!,
      html: emailData.htmlContent!,
      text: emailData.textContent!,
      tenantId: input.tenantId,
      contactId: input.contactId,
      invitationToken: tokenResult.token
    });

    if (!sendResult.success) {
      throw new Error(`Failed to send email: ${sendResult.error}`);
    }

    // Step 4: Update contact invitation status (optional tracking)
    await updateContactInvitationStatus({
      contactId: input.contactId,
      tenantId: input.tenantId,
      invitationSent: true,
      invitationToken: tokenResult.token,
      sentAt: new Date().toISOString()
    });

    console.log(`✅ Birthday invitation workflow completed for contact ${input.contactId}`);

    return {
      contactId: input.contactId,
      success: true,
      messageId: sendResult.messageId,
      provider: sendResult.provider,
      sentAt: new Date().toISOString(),
      invitationToken: tokenResult.token
    };

  } catch (error) {
    console.error(`❌ Birthday invitation workflow failed for contact ${input.contactId}:`, error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      contactId: input.contactId,
      success: false,
      error: errorMessage,
      sentAt: new Date().toISOString()
    };
  }
}

