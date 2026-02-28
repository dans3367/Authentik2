import { Router, Request, Response } from 'express';
import { db } from '../db';
import { appointments, emailContacts, masterEmailDesign } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

const LOCKOUT_MINUTES = 5;

/**
 * Generates a "locked" HTML page explaining why the action cannot be performed.
 */
function renderLockedPage(title: string, message: string, logoUrl?: string | null): string {
  const logoHtml = logoUrl 
    ? `<img src="${escapeHtml(logoUrl)}" alt="Company Logo" class="logo" />`
    : `<div class="icon">&#x1F512;</div>`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 50px auto; background: white; padding: 50px 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
        .icon { font-size: 64px; margin-bottom: 24px; color: #f59e0b; }
        .logo { max-width: 150px; max-height: 80px; margin-bottom: 30px; object-fit: contain; }
        h1 { color: #1f2937; margin: 0 0 16px 0; font-size: 24px; }
        p { color: #4b5563; line-height: 1.6; font-size: 16px; margin: 0; }
        .message-box { background: #fffbeb; border: 1px solid #fde68a; padding: 20px; border-radius: 8px; margin-top: 24px; }
        .message-box p { color: #92400e; font-size: 15px; }
        .contact-btn { display: inline-block; margin-top: 30px; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; transition: background-color 0.2s; }
        .contact-btn:hover { background-color: #4338ca; }
      </style>
    </head>
    <body>
      <div class="container">
        ${logoHtml}
        <h1>${title}</h1>
        <p>${message}</p>
        <div class="message-box">
          <p>Please contact us directly if you need to make changes to your appointment.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Checks if an appointment status change is allowed.
 * Returns null if allowed, or an error object { title, message } if blocked.
 */
function checkStatusChangeLock(appointment: { appointmentDate: Date; confirmationReceivedAt: Date | null; confirmationReceived: boolean | null }): { title: string; message: string } | null {
  const now = new Date();

  // Block if appointment time has already passed
  const appointmentTime = new Date(appointment.appointmentDate);
  if (appointmentTime <= now) {
    return {
      title: 'Appointment Has Passed',
      message: 'This appointment has already occurred. Status changes are no longer allowed.'
    };
  }

  // Block if status was already changed within the lockout window
  if (appointment.confirmationReceived && appointment.confirmationReceivedAt) {
    const confirmedAt = new Date(appointment.confirmationReceivedAt);
    const lockoutExpiry = new Date(confirmedAt.getTime() + LOCKOUT_MINUTES * 60 * 1000);
    if (now >= lockoutExpiry) {
      return {
        title: 'Change Window Expired',
        message: `Your response was already recorded more than ${LOCKOUT_MINUTES} minutes ago. Status changes are no longer allowed.`
      };
    }
  }

  return null;
}

/**
 * HTML escape helper to prevent XSS attacks.
 * Escapes &, <, >, ", and ' characters.
 */
function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// GET /api/appointments/:id/confirm - Confirm appointment attendance
// Security: Requires valid confirmationToken query parameter
router.get('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const appointmentId = req.params.id;
    const token = req.query.token as string;

    // Require confirmation token for security
    if (!token) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invalid Link</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
            h1 { color: #ef4444; margin: 0 0 20px 0; }
            p { color: #6b7280; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>&#x26A0;&#xFE0F; Invalid Link</h1>
            <p>This confirmation link is invalid or incomplete. Please use the link from your appointment reminder email.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Fetch appointment with customer details and tenant logo, validating the token
    const appointmentData = await db
      .select({
        appointment: appointments,
        customer: {
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
          email: emailContacts.email,
        },
        design: {
          logoUrl: masterEmailDesign.logoUrl
        }
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .leftJoin(masterEmailDesign, eq(appointments.tenantId, masterEmailDesign.tenantId))
      .where(and(
        eq(appointments.id, appointmentId),
        eq(appointments.confirmationToken, token)
      ))
      .limit(1);

    if (appointmentData.length === 0) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Appointment Not Found</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
            h1 { color: #ef4444; margin: 0 0 20px 0; }
            p { color: #6b7280; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>&#x274C; Appointment Not Found</h1>
            <p>We couldn't find the appointment you're trying to confirm. It may have been cancelled or the link may be invalid.</p>
          </div>
        </body>
        </html>
      `);
    }

    const { appointment, customer, design } = appointmentData[0];
    const logoUrl = design?.logoUrl || null;

    // Block if appointment time has passed or lockout window expired
    const confirmLock = checkStatusChangeLock(appointment);
    if (confirmLock) {
      return res.status(403).send(renderLockedPage(confirmLock.title, confirmLock.message, logoUrl));
    }

    // Idempotency check: if already confirmed, show success without re-updating
    if (appointment.status === 'confirmed' && appointment.confirmationReceived) {
      const customerName = escapeHtml(customer?.firstName 
        ? `${customer.firstName} ${customer.lastName || ''}`.trim()
        : 'Valued Customer');

      const appointmentDate = new Date(appointment.appointmentDate);
      const formattedDate = appointmentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Appointment Already Confirmed</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
            .icon { font-size: 64px; text-align: center; margin-bottom: 20px; }
            h1 { color: #10b981; margin: 0 0 20px 0; text-align: center; }
            .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .details p { margin: 10px 0; color: #374151; }
            .details strong { color: #1f2937; }
            p { color: #6b7280; line-height: 1.6; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">&#x2705;</div>
            <h1>Already Confirmed</h1>
            <p>Hi ${customerName}, your appointment is already confirmed!</p>
            
            <div class="details">
              <p><strong>Appointment:</strong> ${escapeHtml(appointment.title)}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${formattedTime}</p>
              ${appointment.location ? `<p><strong>Location:</strong> ${escapeHtml(appointment.location)}</p>` : ''}
            </div>
            
            <p>We look forward to seeing you!</p>
          </div>
        </body>
        </html>
      `);
    }

    // Update appointment status to confirmed
    await db
      .update(appointments)
      .set({
        status: 'confirmed',
        confirmationReceived: true,
        confirmationReceivedAt: new Date(),
        statusChangedBy: 'Customer',
        updatedAt: new Date(),
      })
      .where(and(
        eq(appointments.id, appointmentId),
        eq(appointments.confirmationToken, token)
      ));

    const customerName = escapeHtml(customer?.firstName 
      ? `${customer.firstName} ${customer.lastName || ''}`.trim()
      : 'Valued Customer');

    const appointmentDate = new Date(appointment.appointmentDate);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    console.log(`✅ Appointment ${appointmentId} confirmed by customer`);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appointment Confirmed</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
          .icon { font-size: 64px; text-align: center; margin-bottom: 20px; }
          h1 { color: #10b981; margin: 0 0 20px 0; text-align: center; }
          .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .details p { margin: 10px 0; color: #374151; }
          .details strong { color: #1f2937; }
          p { color: #6b7280; line-height: 1.6; text-align: center; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">&#x2705;</div>
          <h1>Appointment Confirmed!</h1>
          <p>Thank you, ${customerName}! Your appointment has been confirmed.</p>
          
          <div class="details">
            <p><strong>Appointment:</strong> ${escapeHtml(appointment.title)}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            ${appointment.location ? `<p><strong>Location:</strong> ${escapeHtml(appointment.location)}</p>` : ''}
            ${appointment.duration ? `<p><strong>Duration:</strong> ${appointment.duration} minutes</p>` : ''}
          </div>
          
          <p>We look forward to seeing you! If you need to make any changes, please contact us directly.</p>
          
          <div class="footer">
            <p>This confirmation was recorded on ${new Date().toLocaleString('en-US')}</p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error confirming appointment:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
          h1 { color: #ef4444; margin: 0 0 20px 0; }
          p { color: #6b7280; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>⚠️ Error</h1>
          <p>We encountered an error while confirming your appointment. Please try again or contact us directly.</p>
        </div>
      </body>
      </html>
    `);
  }
});

// GET /api/appointments/:id/decline - Show decline reason form
// Security: Requires valid confirmationToken query parameter
router.get('/:id/decline', async (req: Request, res: Response) => {
  try {
    const appointmentId = req.params.id;
    const token = req.query.token as string;

    // Require confirmation token for security
    if (!token) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invalid Link</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
            h1 { color: #ef4444; margin: 0 0 20px 0; }
            p { color: #6b7280; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>&#x26A0;&#xFE0F; Invalid Link</h1>
            <p>This link is invalid or incomplete. Please use the link from your appointment reminder email.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Fetch appointment with customer details and tenant logo, validating the token
    const appointmentData = await db
      .select({
        appointment: appointments,
        customer: {
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
          email: emailContacts.email,
        },
        design: {
          logoUrl: masterEmailDesign.logoUrl
        }
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .leftJoin(masterEmailDesign, eq(appointments.tenantId, masterEmailDesign.tenantId))
      .where(and(
        eq(appointments.id, appointmentId),
        eq(appointments.confirmationToken, token)
      ))
      .limit(1);

    if (appointmentData.length === 0) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Appointment Not Found</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
            h1 { color: #ef4444; margin: 0 0 20px 0; }
            p { color: #6b7280; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>&#x274C; Appointment Not Found</h1>
            <p>We couldn't find the appointment you're trying to update. It may have been cancelled or the link may be invalid.</p>
          </div>
        </body>
        </html>
      `);
    }

    const { appointment, customer, design } = appointmentData[0];
    const logoUrl = design?.logoUrl || null;

    // Block if appointment time has passed or lockout window expired
    const declineLock = checkStatusChangeLock(appointment);
    if (declineLock) {
      return res.status(403).send(renderLockedPage(declineLock.title, declineLock.message, logoUrl));
    }

    // Idempotency check: if already cancelled, show already-cancelled page
    if (appointment.status === 'cancelled' && appointment.confirmationReceived) {
      const customerName = escapeHtml(customer?.firstName 
        ? `${customer.firstName} ${customer.lastName || ''}`.trim()
        : 'Valued Customer');

      const appointmentDate = new Date(appointment.appointmentDate);
      const formattedDate = appointmentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Appointment Already Cancelled</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
            .icon { font-size: 64px; text-align: center; margin-bottom: 20px; }
            h1 { color: #ef4444; margin: 0 0 20px 0; text-align: center; }
            .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .details p { margin: 10px 0; color: #374151; }
            .details strong { color: #1f2937; }
            p { color: #6b7280; line-height: 1.6; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">&#x1F4C5;</div>
            <h1>Already Cancelled</h1>
            <p>Hi ${customerName}, this appointment was already cancelled.</p>
            
            <div class="details">
              <p><strong>Cancelled Appointment:</strong> ${escapeHtml(appointment.title)}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${formattedTime}</p>
              ${appointment.location ? `<p><strong>Location:</strong> ${escapeHtml(appointment.location)}</p>` : ''}
            </div>
            
            <p>If you'd like to reschedule, please contact us.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Show decline reason form instead of immediately cancelling
    const customerName = escapeHtml(customer?.firstName 
      ? `${customer.firstName} ${customer.lastName || ''}`.trim()
      : 'Valued Customer');

    const appointmentDate = new Date(appointment.appointmentDate);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cancel Appointment</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
          .icon { font-size: 64px; text-align: center; margin-bottom: 20px; }
          h1 { color: #ef4444; margin: 0 0 20px 0; text-align: center; }
          .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .details p { margin: 10px 0; color: #374151; }
          .details strong { color: #1f2937; }
          p { color: #6b7280; line-height: 1.6; text-align: center; }
          .form-group { margin: 24px 0; text-align: left; }
          .form-group label { display: block; font-weight: 600; color: #374151; margin-bottom: 8px; font-size: 14px; }
          .form-group textarea { width: 100%; min-height: 100px; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-family: inherit; font-size: 14px; resize: vertical; box-sizing: border-box; transition: border-color 0.2s; }
          .form-group textarea:focus { outline: none; border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1); }
          .form-group .hint { font-size: 12px; color: #9ca3af; margin-top: 4px; }
          .btn-submit { display: inline-block; padding: 12px 32px; background-color: #ef4444; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background-color 0.2s; width: 100%; }
          .btn-submit:hover { background-color: #dc2626; }
          .btn-submit:disabled { background-color: #fca5a5; cursor: not-allowed; }
          .btn-back { display: inline-block; margin-top: 12px; padding: 10px 24px; background-color: transparent; color: #6b7280; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; cursor: pointer; transition: all 0.2s; width: 100%; text-align: center; text-decoration: none; }
          .btn-back:hover { background-color: #f9fafb; color: #374151; }
          .success-msg { display: none; }
          .error-msg { display: none; color: #ef4444; text-align: center; margin-top: 12px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div id="formView">
            <div class="icon">&#x1F4C5;</div>
            <h1>Cancel Appointment</h1>
            <p>Hi ${customerName}, we're sorry to see you go. Please let us know why you can't make it.</p>
            
            <div class="details">
              <p><strong>Appointment:</strong> ${escapeHtml(appointment.title)}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${formattedTime}</p>
              ${appointment.location ? `<p><strong>Location:</strong> ${escapeHtml(appointment.location)}</p>` : ''}
            </div>

            <div class="form-group">
              <label for="reason">Reason for cancellation</label>
              <textarea id="reason" placeholder="Please share why you're unable to attend (optional)..." maxlength="500"></textarea>
              <p class="hint"><span id="charCount">0</span>/500 characters</p>
            </div>

            <input type="hidden" id="confirmToken" value="${escapeHtml(token)}" />
            <input type="hidden" id="customerDisplayName" value="${customerName}" />

            <button class="btn-submit" id="submitBtn">Confirm Cancellation</button>
            <p class="error-msg" id="errorMsg"></p>
          </div>

          <div id="successView" class="success-msg">
            <div class="icon">&#x1F4C5;</div>
            <h1>Appointment Cancelled</h1>
            <p id="successText"></p>
            
            <div class="details">
              <p><strong>Cancelled Appointment:</strong> ${escapeHtml(appointment.title)}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${formattedTime}</p>
              ${appointment.location ? `<p><strong>Location:</strong> ${escapeHtml(appointment.location)}</p>` : ''}
            </div>
            
            <p>If you'd like to reschedule or have any questions, please don't hesitate to contact us.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 14px;">
              <p id="timestampText"></p>
            </div>
          </div>
        </div>

        <script>
          var reasonEl = document.getElementById('reason');
          var charCountEl = document.getElementById('charCount');
          var confirmToken = document.getElementById('confirmToken').value;
          var customerDisplayName = document.getElementById('customerDisplayName').value;
          reasonEl.addEventListener('input', function() {
            charCountEl.textContent = reasonEl.value.length;
          });

          document.getElementById('submitBtn').addEventListener('click', submitDecline);

          function submitDecline() {
            var btn = document.getElementById('submitBtn');
            var errorMsg = document.getElementById('errorMsg');
            btn.disabled = true;
            btn.textContent = 'Submitting...';
            errorMsg.style.display = 'none';

            var reason = reasonEl.value.trim();
            var postUrl = window.location.origin + window.location.pathname;

            var xhr = new XMLHttpRequest();
            xhr.open('POST', postUrl, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onreadystatechange = function() {
              if (xhr.readyState !== 4) return;
              try {
                var data = JSON.parse(xhr.responseText);
                if (data.success) {
                  document.getElementById('formView').style.display = 'none';
                  var successView = document.getElementById('successView');
                  successView.style.display = 'block';
                  document.getElementById('successText').textContent = 'Thank you for letting us know, ' + customerDisplayName + '. Your appointment has been cancelled.';
                  document.getElementById('timestampText').textContent = 'This cancellation was recorded on ' + new Date().toLocaleString('en-US');
                } else {
                  errorMsg.textContent = data.error || 'Something went wrong. Please try again.';
                  errorMsg.style.display = 'block';
                  btn.disabled = false;
                  btn.textContent = 'Confirm Cancellation';
                }
              } catch(e) {
                errorMsg.textContent = 'Error processing response (status: ' + xhr.status + '). Please try again.';
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'Confirm Cancellation';
              }
            };
            xhr.onerror = function() {
              errorMsg.textContent = 'Network error. Please try again.';
              errorMsg.style.display = 'block';
              btn.disabled = false;
              btn.textContent = 'Confirm Cancellation';
            };
            xhr.send(JSON.stringify({ token: confirmToken, reason: reason }));
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error showing decline form:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
          h1 { color: #ef4444; margin: 0 0 20px 0; }
          p { color: #6b7280; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>&#x26A0;&#xFE0F; Error</h1>
          <p>We encountered an error while processing your response. Please try again or contact us directly.</p>
        </div>
      </body>
      </html>
    `);
  }
});

// POST /api/appointments/:id/decline - Submit decline with reason
// Security: Requires valid confirmationToken in request body
router.post('/:id/decline', async (req: Request, res: Response) => {
  try {
    const appointmentId = req.params.id;
    const { token, reason } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Missing confirmation token' });
    }

    // Sanitize reason: trim, limit to 500 chars
    const sanitizedReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : null;

    // Fetch appointment validating the token
    const appointmentData = await db
      .select({
        appointment: appointments,
        customer: {
          firstName: emailContacts.firstName,
          lastName: emailContacts.lastName,
          email: emailContacts.email,
        }
      })
      .from(appointments)
      .leftJoin(emailContacts, eq(appointments.customerId, emailContacts.id))
      .where(and(
        eq(appointments.id, appointmentId),
        eq(appointments.confirmationToken, token)
      ))
      .limit(1);

    if (appointmentData.length === 0) {
      return res.status(404).json({ success: false, error: 'Appointment not found or invalid token' });
    }

    const { appointment } = appointmentData[0];

    // Block if appointment time has passed or lockout window expired
    const postDeclineLock = checkStatusChangeLock(appointment);
    if (postDeclineLock) {
      return res.status(403).json({ success: false, error: postDeclineLock.message });
    }

    // Idempotency: if already cancelled, still return success
    if (appointment.status === 'cancelled' && appointment.confirmationReceived) {
      return res.json({ success: true, alreadyCancelled: true });
    }

    // Update appointment status to cancelled with the decline reason
    await db
      .update(appointments)
      .set({
        status: 'cancelled',
        confirmationReceived: true,
        confirmationReceivedAt: new Date(),
        statusChangedBy: 'Customer',
        declineReason: sanitizedReason || null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(appointments.id, appointmentId),
        eq(appointments.confirmationToken, token)
      ));

    console.log(`❌ Appointment ${appointmentId} declined by customer${sanitizedReason ? ` (reason: ${sanitizedReason})` : ''}`);

    return res.json({ success: true });
  } catch (error) {
    console.error('Error declining appointment:', error);
    return res.status(500).json({ success: false, error: 'Failed to cancel appointment' });
  }
});

export default router;
