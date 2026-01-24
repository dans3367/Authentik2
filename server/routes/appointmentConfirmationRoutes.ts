import { Router, Request, Response } from 'express';
import { db } from '../db';
import { appointments, emailContacts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

// GET /api/appointments/:id/confirm - Confirm appointment attendance
router.get('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const appointmentId = req.params.id;

    // Fetch appointment with customer details
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
      .where(eq(appointments.id, appointmentId))
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
            <h1>❌ Appointment Not Found</h1>
            <p>We couldn't find the appointment you're trying to confirm. It may have been cancelled or the link may be invalid.</p>
          </div>
        </body>
        </html>
      `);
    }

    const { appointment, customer } = appointmentData[0];

    // Update appointment status to confirmed
    await db
      .update(appointments)
      .set({
        status: 'confirmed',
        confirmationReceived: true,
        confirmationReceivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId));

    const customerName = customer?.firstName 
      ? `${customer.firstName} ${customer.lastName || ''}`.trim()
      : 'Valued Customer';

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
          <div class="icon">✅</div>
          <h1>Appointment Confirmed!</h1>
          <p>Thank you, ${customerName}! Your appointment has been confirmed.</p>
          
          <div class="details">
            <p><strong>Appointment:</strong> ${appointment.title}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            ${appointment.location ? `<p><strong>Location:</strong> ${appointment.location}</p>` : ''}
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
router.get('/:id/decline', async (req: Request, res: Response) => {
  try {
    const appointmentId = req.params.id;

    // Fetch appointment with customer details
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
      .where(eq(appointments.id, appointmentId))
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
            <h1>❌ Appointment Not Found</h1>
            <p>We couldn't find the appointment you're trying to update. It may have been cancelled or the link may be invalid.</p>
          </div>
        </body>
        </html>
      `);
    }

    const { appointment, customer } = appointmentData[0];

    // Update appointment status to cancelled
    await db
      .update(appointments)
      .set({
        status: 'cancelled',
        confirmationReceived: true,
        confirmationReceivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId));

    const customerName = customer?.firstName 
      ? `${customer.firstName} ${customer.lastName || ''}`.trim()
      : 'Valued Customer';

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
          <div class="icon">📅</div>
          <h1>Appointment Cancelled</h1>
          <p>Thank you for letting us know, ${customerName}. Your appointment has been cancelled.</p>
          
          <div class="details">
            <p><strong>Cancelled Appointment:</strong> ${appointment.title}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            ${appointment.location ? `<p><strong>Location:</strong> ${appointment.location}</p>` : ''}
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
