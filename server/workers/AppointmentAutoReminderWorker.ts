/**
 * Appointment Auto-Reminder Worker
 *
 * Runs every 5 minutes. For tenants with auto-reminders enabled, finds
 * appointments starting within the next hour that have not been confirmed
 * and have not already received an auto-reminder. Sends a "your appointment
 * is nearing — please call the office to confirm" email via Trigger.dev.
 */

import { db } from '../db';
import {
  appointments,
  appointmentReminders,
  appointmentAutoReminderSettings,
  emailContacts,
  bouncedEmails,
} from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { triggerSendReminder } from '../lib/trigger';
import type { ReminderPayload } from '../../src/trigger/reminders';

const FIVE_MINUTES = 5 * 60 * 1000;
const AUTO_REMINDER_TIMING = 'auto_1h'; // marker stored in appointment_reminders

let workerTimer: NodeJS.Timeout | null = null;

async function processAutoReminders(): Promise<void> {
  try {
    // Find tenants with auto-reminder enabled
    const enabledTenants = await db.query.appointmentAutoReminderSettings.findMany({
      where: eq(appointmentAutoReminderSettings.enabled, true),
    });

    if (enabledTenants.length === 0) return;

    const tenantIds = enabledTenants.map(t => t.tenantId);

    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // For each enabled tenant, find unconfirmed appointments within the next hour
    for (const tenantId of tenantIds) {
      try {
        await processAutoRemindersForTenant(tenantId, now, oneHourFromNow);
      } catch (err) {
        console.error(`[AutoReminder] Error processing tenant ${tenantId}:`, err);
      }
    }
  } catch (error) {
    console.error('[AutoReminder] Worker error:', error);
  }
}

async function processAutoRemindersForTenant(
  tenantId: string,
  now: Date,
  oneHourFromNow: Date,
): Promise<void> {
  // Find appointments in the next hour that are still 'scheduled' (not confirmed)
  // and where confirmationReceived is false.
  const upcomingUnconfirmed = await db.query.appointments.findMany({
    where: and(
      eq(appointments.tenantId, tenantId),
      eq(appointments.status, 'scheduled'),
      eq(appointments.confirmationReceived, false),
      gte(appointments.appointmentDate, now),
      lte(appointments.appointmentDate, oneHourFromNow),
    ),
    with: {
      customer: true,
    },
  });

  if (upcomingUnconfirmed.length === 0) return;

  for (const appointment of upcomingUnconfirmed) {
    try {
      // Check if we already sent an auto-reminder for this appointment
      const existingAutoReminder = await db.query.appointmentReminders.findFirst({
        where: and(
          eq(appointmentReminders.appointmentId, appointment.id),
          eq(appointmentReminders.reminderTiming, AUTO_REMINDER_TIMING),
        ),
      });

      if (existingAutoReminder) continue; // already handled

      const customer = appointment.customer as any;
      if (!customer?.email) continue;

      // Check email suppression
      const emailLower = customer.email.toLowerCase().trim();
      const suppression = await db.query.bouncedEmails.findFirst({
        where: and(
          eq(bouncedEmails.email, emailLower),
          eq(bouncedEmails.isActive, true),
        ),
      });
      if (suppression) continue;

      // Check contact is active
      if (customer.status && customer.status !== 'active') continue;

      // Create the reminder record first (prevents duplicates on re-runs)
      const [reminder] = await db.insert(appointmentReminders).values({
        tenantId,
        appointmentId: appointment.id,
        customerId: appointment.customerId,
        reminderType: 'email',
        reminderTiming: AUTO_REMINDER_TIMING,
        scheduledFor: now,
        status: 'pending',
        content: 'Your appointment is coming up soon. If you haven\'t already, please call our office to confirm that you will be attending. We look forward to seeing you!',
        metadata: JSON.stringify({ source: 'auto_reminder_worker' }),
      } as any).returning();

      // Build Trigger.dev payload
      const appointmentDate = new Date(appointment.appointmentDate);
      const payload: ReminderPayload = {
        reminderId: reminder.id,
        appointmentId: appointment.id,
        customerId: appointment.customerId,
        customerEmail: customer.email,
        customerName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email,
        appointmentTitle: appointment.title,
        appointmentDate: appointmentDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'America/Chicago',
        }),
        appointmentTime: appointmentDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Chicago',
        }),
        duration: appointment.duration || undefined,
        location: appointment.location || undefined,
        reminderType: 'email',
        content: 'Your appointment is coming up soon. If you haven\'t already, please call our office to confirm that you will be attending. We look forward to seeing you!',
        tenantId,
        confirmationToken: appointment.confirmationToken || undefined,
      };

      const result = await triggerSendReminder(payload);

      if (!result.success) {
        await db.update(appointmentReminders)
          .set({ status: 'failed', errorMessage: result.error || 'Trigger.dev send failed', updatedAt: new Date() })
          .where(eq(appointmentReminders.id, reminder.id));
        console.error(`[AutoReminder] Failed to send for appointment ${appointment.id}:`, result.error);
      } else {
        // Store the run ID for potential cancellation
        await db.update(appointmentReminders)
          .set({ inngestEventId: result.runId || null, updatedAt: new Date() })
          .where(eq(appointmentReminders.id, reminder.id));
        console.log(`[AutoReminder] Sent reminder for appointment ${appointment.id} to ${customer.email}`);
      }
    } catch (err) {
      console.error(`[AutoReminder] Error sending for appointment ${appointment.id}:`, err);
    }
  }
}

export function startAppointmentAutoReminderWorker(): void {
  if (workerTimer) {
    console.log('[AutoReminder] Worker already running');
    return;
  }

  console.log('[AutoReminder] Starting worker (runs every 5 minutes)');

  // First run after a short delay to let the server finish starting
  setTimeout(() => {
    processAutoReminders();
  }, 15_000);

  workerTimer = setInterval(() => {
    processAutoReminders();
  }, FIVE_MINUTES);

  if (workerTimer.unref) {
    workerTimer.unref();
  }
}

export function stopAppointmentAutoReminderWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    console.log('[AutoReminder] Worker stopped');
  }
}
