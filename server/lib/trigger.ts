import { tasks, runs } from "@trigger.dev/sdk/v3";
import { createHmac } from 'crypto';
import type { sendReminderTask, scheduleReminderTask, sendBulkRemindersTask, ReminderPayload } from "../../src/trigger/reminders";

/**
 * Generate HMAC signature for internal service authentication.
 * This should be used when making requests to internal endpoints from Trigger.dev tasks.
 */
export function generateInternalSignature(
  payload: object,
  timestamp: number,
  secret: string
): string {
  const signaturePayload = `${timestamp}.${JSON.stringify(payload)}`;
  return createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');
}

/**
 * Make an authenticated request to an internal endpoint.
 * Used by Trigger.dev tasks to call back to the main server securely.
 */
export async function callInternalEndpoint(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  payload?: object
): Promise<{ success: boolean; data?: any; error?: string }> {
  const apiUrl = process.env.API_URL || 'http://localhost:5002';
  const secret = process.env.INTERNAL_SERVICE_SECRET;

  if (!secret) {
    console.error('[Internal API] INTERNAL_SERVICE_SECRET is not configured');
    return { success: false, error: 'Internal service secret not configured' };
  }

  const timestamp = Date.now();
  const body = payload || {};
  const signature = generateInternalSignature(body, timestamp, secret);

  try {
    const response = await fetch(`${apiUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': 'trigger.dev',
        'x-internal-timestamp': timestamp.toString(),
        'x-internal-signature': signature,
      },
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[Internal API] Request failed: ${response.status}`, data);
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Internal API] Request error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Update reminder status via authenticated internal endpoint.
 * Used by Trigger.dev tasks after sending reminders.
 */
export async function updateReminderStatus(
  reminderId: string,
  status: 'pending' | 'sent' | 'failed' | 'cancelled',
  errorMessage?: string
): Promise<{ success: boolean; error?: string }> {
  const result = await callInternalEndpoint(
    `/api/appointment-reminders/internal/${reminderId}/status`,
    'PUT',
    { status, errorMessage }
  );

  if (result.success) {
    console.log(`[Internal API] Reminder ${reminderId} status updated to: ${status}`);
  }

  return result;
}

/**
 * Trigger an immediate reminder send via Trigger.dev
 */
export async function triggerSendReminder(payload: ReminderPayload): Promise<{
  success: boolean;
  runId?: string;
  error?: string;
}> {
  try {
    const handle = await tasks.trigger<typeof sendReminderTask>(
      "send-appointment-reminder",
      payload
    );

    console.log(`📧 [Trigger.dev] Triggered send-appointment-reminder, runId: ${handle.id}`);

    return {
      success: true,
      runId: handle.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`📧 [Trigger.dev] Failed to trigger send-appointment-reminder:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Trigger a scheduled reminder via Trigger.dev
 * The task will wait until the scheduled time before sending
 */
export async function triggerScheduleReminder(payload: ReminderPayload): Promise<{
  success: boolean;
  runId?: string;
  error?: string;
}> {
  try {
    if (!payload.scheduledFor) {
      return {
        success: false,
        error: "scheduledFor is required for scheduled reminders",
      };
    }

    const handle = await tasks.trigger<typeof scheduleReminderTask>(
      "schedule-appointment-reminder",
      payload
    );

    console.log(`📅 [Trigger.dev] Triggered schedule-appointment-reminder for ${payload.scheduledFor}, runId: ${handle.id}`);

    return {
      success: true,
      runId: handle.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`📅 [Trigger.dev] Failed to trigger schedule-appointment-reminder:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Trigger bulk reminder send via Trigger.dev
 */
export async function triggerBulkReminders(reminders: ReminderPayload[]): Promise<{
  success: boolean;
  runId?: string;
  error?: string;
}> {
  try {
    const handle = await tasks.trigger<typeof sendBulkRemindersTask>(
      "send-bulk-reminders",
      { reminders }
    );

    console.log(`📧 [Trigger.dev] Triggered send-bulk-reminders for ${reminders.length} reminders, runId: ${handle.id}`);

    return {
      success: true,
      runId: handle.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`📧 [Trigger.dev] Failed to trigger send-bulk-reminders:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Cancel a scheduled reminder run
 * Only cancels if the ID is a valid Trigger.dev run ID (starts with 'run_')
 */
export async function cancelReminderRun(runId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  // Validate that this is a Trigger.dev run ID (not a legacy Inngest event ID)
  if (!runId.startsWith('run_')) {
    console.log(`🚫 [Trigger.dev] Skipping cancellation - not a Trigger.dev run ID: ${runId}`);
    return {
      success: false,
      error: `Not a Trigger.dev run ID: ${runId}`,
    };
  }

  try {
    console.log(`🚫 [Trigger.dev] Attempting to cancel run ${runId}...`);
    await runs.cancel(runId);
    console.log(`🚫 [Trigger.dev] Successfully cancelled run ${runId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`🚫 [Trigger.dev] Failed to cancel run ${runId}:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Get the status of a reminder run
 */
export async function getReminderRunStatus(runId: string): Promise<{
  success: boolean;
  status?: string;
  output?: any;
  error?: string;
}> {
  try {
    const run = await runs.retrieve(runId);
    return {
      success: true,
      status: run.status,
      output: run.output,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`📊 [Trigger.dev] Failed to get run status ${runId}:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
