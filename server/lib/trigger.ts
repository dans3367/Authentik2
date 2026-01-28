import { tasks, runs } from "@trigger.dev/sdk/v3";
import type { sendReminderTask, scheduleReminderTask, sendBulkRemindersTask, ReminderPayload } from "../../src/trigger/reminders";

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
