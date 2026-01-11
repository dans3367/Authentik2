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
        
        const baseUrl = process.env.API_URL || 'http://localhost:3000';
        const confirmUrl = `${baseUrl}/api/appointments/${a?.id}/confirm`;
        const declineUrl = `${baseUrl}/api/appointments/${a?.id}/decline`;
        
        const html = r.content || `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Appointment Reminder</h1>
            </div>
            
            <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 20px 0;">Hi ${customerName},</p>
              
              <p style="margin: 0 0 20px 0;">This is a friendly reminder about your upcoming appointment:</p>
              
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                ${a?.title ? `<h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">${a.title}</h2>` : ''}
                ${apptTime ? `<p style="margin: 0 0 10px 0;"><strong>When:</strong> ${apptTime}</p>` : ''}
                ${a?.location ? `<p style="margin: 0 0 10px 0;"><strong>Location:</strong> ${a.location}</p>` : ''}
                ${a?.duration ? `<p style="margin: 0 0 10px 0;"><strong>Duration:</strong> ${a.duration} minutes</p>` : ''}
              </div>
              
              <div style="margin: 30px 0; text-align: center;">
                <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #1f2937;">Will you be attending?</p>
                <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                  <tr>
                    <td style="padding: 0 8px;">
                      <a href="${confirmUrl}" style="display: inline-block; padding: 12px 32px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Confirm</a>
                    </td>
                    <td style="padding: 0 8px;">
                      <a href="${declineUrl}" style="display: inline-block; padding: 12px 32px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Not attending</a>
                    </td>
                  </tr>
                </table>
              </div>
              
              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px;">
                If you need to reschedule or cancel, please contact us as soon as possible.
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">This is an automated reminder. Please do not reply to this email.</p>
            </div>
          </body>
          </html>
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
