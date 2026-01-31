import { tasks, runs } from "@trigger.dev/sdk/v3";
import { createHmac } from 'crypto';
import { db } from '../db';
import { triggerTasks, type TriggerTaskStatus, type TriggerTaskRelatedType } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { sendReminderTask, scheduleReminderTask, sendBulkRemindersTask, ReminderPayload } from "../../src/trigger/reminders";
import type { sendRescheduleEmailTask, RescheduleEmailPayload } from "../../src/trigger/appointmentRescheduleEmail";

/**
 * Log a task to the trigger_tasks table for local tracking
 */
export async function logTriggerTask(params: {
  taskId: string;
  runId?: string;
  payload: object;
  status: TriggerTaskStatus;
  tenantId?: string;
  relatedType?: TriggerTaskRelatedType;
  relatedId?: string;
  scheduledFor?: Date;
  idempotencyKey?: string;
}): Promise<string | null> {
  try {
    const result = await db.insert(triggerTasks).values({
      taskId: params.taskId,
      runId: params.runId,
      payload: JSON.stringify(params.payload),
      status: params.status,
      tenantId: params.tenantId,
      relatedType: params.relatedType,
      relatedId: params.relatedId,
      scheduledFor: params.scheduledFor,
      idempotencyKey: params.idempotencyKey,
      triggeredAt: params.runId ? new Date() : null,
    }).returning({ id: triggerTasks.id });

    console.log(`📝 [Trigger Tasks] Logged task ${params.taskId}, id: ${result[0]?.id}`);
    return result[0]?.id || null;
  } catch (error) {
    console.error('[Trigger Tasks] Failed to log task:', error);
    return null;
  }
}

/**
 * Update a task's status in the trigger_tasks table
 */
export async function updateTriggerTaskStatus(params: {
  id?: string;
  runId?: string;
  status: TriggerTaskStatus;
  output?: object;
  errorMessage?: string;
  errorCode?: string;
}): Promise<boolean> {
  try {
    const updateData: Record<string, any> = {
      status: params.status,
      updatedAt: new Date(),
    };

    if (params.output) {
      updateData.output = JSON.stringify(params.output);
    }
    if (params.errorMessage) {
      updateData.errorMessage = params.errorMessage;
    }
    if (params.errorCode) {
      updateData.errorCode = params.errorCode;
    }
    if (params.status === 'running') {
      updateData.startedAt = new Date();
    }
    if (params.status === 'completed' || params.status === 'failed' || params.status === 'cancelled') {
      updateData.completedAt = new Date();
    }

    if (params.id) {
      await db.update(triggerTasks)
        .set(updateData)
        .where(eq(triggerTasks.id, params.id));
    } else if (params.runId) {
      await db.update(triggerTasks)
        .set(updateData)
        .where(eq(triggerTasks.runId, params.runId));
    } else {
      console.error('[Trigger Tasks] No id or runId provided for status update');
      return false;
    }

    console.log(`📝 [Trigger Tasks] Updated status to ${params.status}`);
    return true;
  } catch (error) {
    console.error('[Trigger Tasks] Failed to update task status:', error);
    return false;
  }
}

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
  taskLogId?: string;
  error?: string;
}> {
  const taskId = "send-appointment-reminder";
  let taskLogId: string | null = null;

  try {
    const handle = await tasks.trigger<typeof sendReminderTask>(taskId, payload);

    console.log(`📧 [Trigger.dev] Triggered ${taskId}, runId: ${handle.id}`);

    // Log to trigger_tasks table
    taskLogId = await logTriggerTask({
      taskId,
      runId: handle.id,
      payload,
      status: 'triggered',
      tenantId: payload.tenantId,
      relatedType: 'appointment_reminder',
      relatedId: payload.reminderId,
    });

    return {
      success: true,
      runId: handle.id,
      taskLogId: taskLogId || undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`📧 [Trigger.dev] Failed to trigger ${taskId}:`, errorMessage);

    // Log failed attempt
    await logTriggerTask({
      taskId,
      payload,
      status: 'failed',
      tenantId: payload.tenantId,
      relatedType: 'appointment_reminder',
      relatedId: payload.reminderId,
    });

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
  taskLogId?: string;
  error?: string;
}> {
  const taskId = "schedule-appointment-reminder";

  if (!payload.scheduledFor) {
    return {
      success: false,
      error: "scheduledFor is required for scheduled reminders",
    };
  }

  try {
    const handle = await tasks.trigger<typeof scheduleReminderTask>(taskId, payload);

    console.log(`📅 [Trigger.dev] Triggered ${taskId} for ${payload.scheduledFor}, runId: ${handle.id}`);

    // Log to trigger_tasks table
    const taskLogId = await logTriggerTask({
      taskId,
      runId: handle.id,
      payload,
      status: 'triggered',
      tenantId: payload.tenantId,
      relatedType: 'appointment_reminder',
      relatedId: payload.reminderId,
      scheduledFor: new Date(payload.scheduledFor),
    });

    return {
      success: true,
      runId: handle.id,
      taskLogId: taskLogId || undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`📅 [Trigger.dev] Failed to trigger ${taskId}:`, errorMessage);

    // Log failed attempt
    await logTriggerTask({
      taskId,
      payload,
      status: 'failed',
      tenantId: payload.tenantId,
      relatedType: 'appointment_reminder',
      relatedId: payload.reminderId,
      scheduledFor: new Date(payload.scheduledFor),
    });

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
  taskLogId?: string;
  error?: string;
}> {
  const taskId = "send-bulk-reminders";
  const payload = { reminders };
  const tenantId = reminders[0]?.tenantId;

  try {
    const handle = await tasks.trigger<typeof sendBulkRemindersTask>(taskId, payload);

    console.log(`📧 [Trigger.dev] Triggered ${taskId} for ${reminders.length} reminders, runId: ${handle.id}`);

    // Log to trigger_tasks table
    const taskLogId = await logTriggerTask({
      taskId,
      runId: handle.id,
      payload,
      status: 'triggered',
      tenantId,
      relatedType: 'bulk_email',
    });

    return {
      success: true,
      runId: handle.id,
      taskLogId: taskLogId || undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`📧 [Trigger.dev] Failed to trigger ${taskId}:`, errorMessage);

    // Log failed attempt
    await logTriggerTask({
      taskId,
      payload,
      status: 'failed',
      tenantId,
      relatedType: 'bulk_email',
    });

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

    // Update task status in trigger_tasks table
    await updateTriggerTaskStatus({
      runId,
      status: 'cancelled',
    });

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

/**
 * Trigger a reschedule invitation email via Trigger.dev
 * Sent when an appointment is marked as cancelled or no-show
 */
export async function triggerRescheduleEmail(payload: RescheduleEmailPayload): Promise<{
  success: boolean;
  runId?: string;
  taskLogId?: string;
  error?: string;
}> {
  const taskId = "send-reschedule-email";
  let taskLogId: string | null = null;

  try {
    const handle = await tasks.trigger<typeof sendRescheduleEmailTask>(taskId, payload);

    console.log(`📧 [Trigger.dev] Triggered ${taskId}, runId: ${handle.id}`);

    // Log to trigger_tasks table
    taskLogId = await logTriggerTask({
      taskId,
      runId: handle.id,
      payload,
      status: 'triggered',
      tenantId: payload.tenantId,
      relatedType: 'email',
      relatedId: payload.appointmentId,
    });

    return {
      success: true,
      runId: handle.id,
      taskLogId: taskLogId || undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`📧 [Trigger.dev] Failed to trigger ${taskId}:`, errorMessage);

    // Log failed attempt
    await logTriggerTask({
      taskId,
      payload,
      status: 'failed',
      tenantId: payload.tenantId,
      relatedType: 'email',
      relatedId: payload.appointmentId,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}
