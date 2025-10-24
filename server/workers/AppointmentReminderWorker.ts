import { EventEmitter } from 'events';
import { db } from '../db';
import { appointmentReminders, appointments, emailContacts } from '@shared/schema';
import { and, eq, lte } from 'drizzle-orm';

// Optional enhanced email service (fallback to console if unavailable)
let sendEmail: (args: { to: string; subject: string; html: string; text?: string }) => Promise<{ success: boolean; messageId?: string; error?: string; provider?: string }>;
try {
  // Lazy import to avoid hard dependency if not present
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { enhancedEmailService } = require('../emailService');
  sendEmail = async ({ to, subject, html, text }) => enhancedEmailService.send({ to, subject, html, text });
} catch {
  sendEmail = async ({ to, subject, html }) => {
    console.log(`[ReminderWorker] Simulated send to ${to}: ${subject} (${html.substring(0, 80)}...)`);
    return { success: true, messageId: `sim-${Date.now()}` };
  };
}

export class AppointmentReminderWorker extends EventEmitter {
  private running = false;
  private timer?: NodeJS.Timeout;
  private readonly intervalMs: number;
  private processing = false;

  constructor(intervalMs = 60 * 1000) { // default every 60s
    super();
    this.intervalMs = intervalMs;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.scheduleNext();
    this.emit('started');
    console.log('🔔 [ReminderWorker] Started');
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.emit('stopped');
    console.log('🔕 [ReminderWorker] Stopped');
  }

  private scheduleNext() {
    if (!this.running) return;
    this.timer = setTimeout(() => this.tick(), this.intervalMs);
  }

  private async tick() {
    try {
      await this.processDueNow();
    } finally {
      this.scheduleNext();
    }
  }

  async processDueNow() {
    if (this.processing) return;
    this.processing = true;
    try {
      const now = new Date();

      // Fetch due pending reminders with joins
      const due = await db
        .select({
          reminder: appointmentReminders,
          appointment: {
            id: appointments.id,
            title: appointments.title,
            appointmentDate: appointments.appointmentDate,
            location: appointments.location,
            duration: appointments.duration,
          },
          customer: {
            id: emailContacts.id,
            email: emailContacts.email,
            firstName: emailContacts.firstName,
            lastName: emailContacts.lastName,
          }
        })
        .from(appointmentReminders)
        .leftJoin(appointments, eq(appointmentReminders.appointmentId, appointments.id))
        .leftJoin(emailContacts, eq(appointmentReminders.customerId, emailContacts.id))
        .where(and(
          eq(appointmentReminders.status, 'pending'),
          lte(appointmentReminders.scheduledFor, now)
        ));

      if (due.length === 0) return;

      console.log(`🔔 [ReminderWorker] Processing ${due.length} scheduled reminder(s)`);

      for (const row of due) {
        const r = row.reminder;
        const a = row.appointment;
        const c = row.customer;
        if (!c?.email) {
          await db.update(appointmentReminders)
            .set({ status: 'failed', errorMessage: 'Missing customer email', updatedAt: new Date() })
            .where(eq(appointmentReminders.id, r.id));
          continue;
        }

        const customerName = c.firstName ? `${c.firstName}${c.lastName ? ' ' + c.lastName : ''}` : c.email;
        const apptTime = a?.appointmentDate ? new Date(a.appointmentDate).toLocaleString('en-US', { hour12: true }) : '';

        const subject = `Reminder: ${a?.title || 'Appointment'}`;
        const html = r.content || `
          <div>
            <p>Hi ${customerName},</p>
            <p>This is a reminder about your upcoming appointment.</p>
            ${a?.title ? `<p><strong>Title:</strong> ${a.title}</p>` : ''}
            ${apptTime ? `<p><strong>When:</strong> ${apptTime}</p>` : ''}
            ${a?.location ? `<p><strong>Location:</strong> ${a.location}</p>` : ''}
            ${a?.duration ? `<p><strong>Duration:</strong> ${a.duration} minutes</p>` : ''}
            <p>If you need to reschedule, please let us know.</p>
          </div>
        `;

        try {
          const result = await sendEmail({ to: c.email, subject, html, text: html.replace(/<[^>]*>/g, '') });
          if (result.success) {
            await db.update(appointmentReminders)
              .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date(), errorMessage: null })
              .where(eq(appointmentReminders.id, r.id));
          } else {
            await db.update(appointmentReminders)
              .set({ status: 'failed', updatedAt: new Date(), errorMessage: result.error || 'Failed to send' })
              .where(eq(appointmentReminders.id, r.id));
          }
        } catch (err: any) {
          await db.update(appointmentReminders)
            .set({ status: 'failed', updatedAt: new Date(), errorMessage: err?.message || 'Error sending reminder' })
            .where(eq(appointmentReminders.id, r.id));
        }
      }
    } catch (e) {
      console.error('❌ [ReminderWorker] Error processing due reminders:', e);
    } finally {
      this.processing = false;
    }
  }
}

export const appointmentReminderWorker = new AppointmentReminderWorker(60 * 1000);
