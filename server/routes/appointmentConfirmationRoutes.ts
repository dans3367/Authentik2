import { Router, Request, Response } from 'express';
import { db } from '../db';
import { appointments, emailContacts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

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

    // Fetch appointment with customer details, validating the token
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

    const { appointment, customer } = appointmentData[0];

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

// GET /api/appointments/:id/decline - Decline appointment attendance
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

    // Fetch appointment with customer details, validating the token
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

    const { appointment, customer } = appointmentData[0];

    // Idempotency check: if already cancelled, show success without re-updating
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

    // Update appointment status to cancelled
    await db
      .update(appointments)
      .set({
        status: 'cancelled',
        confirmationReceived: true,
        confirmationReceivedAt: new Date(),
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

    console.log(`❌ Appointment ${appointmentId} declined by customer`);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appointment Cancelled</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
          .icon { font-size: 64px; text-align: center; margin-bottom: 20px; }
          h1 { color: #ef4444; margin: 0 0 20px 0; text-align: center; }
          .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .details p { margin: 10px 0; color: #374151; }
          .details strong { color: #1f2937; }
          p { color: #6b7280; line-height: 1.6; text-align: center; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">&#x1F4C5;</div>
          <h1>Appointment Cancelled</h1>
          <p>Thank you for letting us know, ${customerName}. Your appointment has been cancelled.</p>
          
          <div class="details">
            <p><strong>Cancelled Appointment:</strong> ${escapeHtml(appointment.title)}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            ${appointment.location ? `<p><strong>Location:</strong> ${escapeHtml(appointment.location)}</p>` : ''}
          </div>
          
          <p>If you'd like to reschedule or have any questions, please don't hesitate to contact us.</p>
          
          <div class="footer">
            <p>This cancellation was recorded on ${new Date().toLocaleString('en-US')}</p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error declining appointment:', error);
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
          <p>We encountered an error while processing your response. Please try again or contact us directly.</p>
        </div>
      </body>
      </html>
    `);
  }
});

export default router;
