import "dotenv/config";
import express from "express";
import { serve } from "inngest/express";
import { inngest } from "./client";
import {
  sendTrackedEvent,
  getPendingEvents,
  getEventsByStatus,
  getEventStats,
  resendPendingEvents,
  cancelEvent,
  getTenantEvents,
  type InngestEventStatus,
} from "./event-tracker";
import {
  sendEmailFunction,
  sendBulkEmailFunction,
  sendScheduledEmailFunction,
  sendNewsletterFunction,
  scheduleNewsletterFunction,
  sendReminderFunction,
  sendScheduledReminderFunction,
  sendBulkRemindersFunction,
} from "./functions";

const app = express();

app.use(express.json());

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "inngest-email-server" });
});

// Inngest serve endpoint
app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: [
      sendEmailFunction,
      sendBulkEmailFunction,
      sendScheduledEmailFunction,
      sendNewsletterFunction,
      scheduleNewsletterFunction,
      sendReminderFunction,
      sendScheduledReminderFunction,
      sendBulkRemindersFunction,
    ],
  })
);

// API endpoint to trigger email sending directly
app.post("/api/send-email", async (req, res) => {
  try {
    const { to, from, subject, html, text, replyTo, cc, bcc, tags, metadata } = req.body;

    if (!to || !subject) {
      res.status(400).json({ error: "Missing required fields: to, subject" });
      return;
    }

    const result = await sendTrackedEvent(
      "email/send",
      { to, from, subject, html, text, replyTo, cc, bcc, tags, metadata },
      { relatedType: "email" }
    );

    if (!result.success) {
      res.status(500).json({ error: "Failed to queue email", details: result.error });
      return;
    }

    res.json({ success: true, message: "Email queued for sending", trackingId: result.eventTrackingId });
  } catch (error) {
    console.error("Error queuing email:", error);
    res.status(500).json({ error: "Failed to queue email" });
  }
});

// API endpoint to send bulk emails
app.post("/api/send-bulk-email", async (req, res) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      res.status(400).json({ error: "Missing or invalid emails array" });
      return;
    }

    const result = await sendTrackedEvent(
      "email/send.bulk",
      { emails },
      { relatedType: "bulk_email" }
    );

    if (!result.success) {
      res.status(500).json({ error: "Failed to queue bulk emails", details: result.error });
      return;
    }

    res.json({ success: true, message: `${emails.length} emails queued for sending`, trackingId: result.eventTrackingId });
  } catch (error) {
    console.error("Error queuing bulk emails:", error);
    res.status(500).json({ error: "Failed to queue bulk emails" });
  }
});

// API endpoint to send newsletter
app.post("/api/send-newsletter", async (req, res) => {
  try {
    const { newsletterId, subject, html, text, from, replyTo, recipients, trackingEnabled, tenantId } = req.body;

    if (!newsletterId || !subject || !html || !recipients) {
      res.status(400).json({ error: "Missing required fields: newsletterId, subject, html, recipients" });
      return;
    }

    const result = await sendTrackedEvent(
      "newsletter/send",
      { newsletterId, subject, html, text, from, replyTo, recipients, trackingEnabled, tenantId },
      { tenantId, relatedType: "newsletter", relatedId: newsletterId }
    );

    if (!result.success) {
      res.status(500).json({ error: "Failed to queue newsletter", details: result.error });
      return;
    }

    res.json({ success: true, message: `Newsletter queued for ${recipients.length} recipients`, trackingId: result.eventTrackingId });
  } catch (error) {
    console.error("Error queuing newsletter:", error);
    res.status(500).json({ error: "Failed to queue newsletter" });
  }
});

// API endpoint to schedule newsletter
app.post("/api/schedule-newsletter", async (req, res) => {
  try {
    const { newsletterId, subject, html, text, from, replyTo, recipients, trackingEnabled, tenantId, scheduledFor } = req.body;

    if (!newsletterId || !subject || !html || !recipients || !scheduledFor) {
      res.status(400).json({ error: "Missing required fields: newsletterId, subject, html, recipients, scheduledFor" });
      return;
    }

    const result = await sendTrackedEvent(
      "newsletter/schedule",
      { newsletterId, subject, html, text, from, replyTo, recipients, trackingEnabled, tenantId, scheduledFor },
      { tenantId, relatedType: "newsletter", relatedId: newsletterId, scheduledFor: new Date(scheduledFor) }
    );

    if (!result.success) {
      res.status(500).json({ error: "Failed to schedule newsletter", details: result.error });
      return;
    }

    res.json({ success: true, message: `Newsletter scheduled for ${scheduledFor}`, trackingId: result.eventTrackingId });
  } catch (error) {
    console.error("Error scheduling newsletter:", error);
    res.status(500).json({ error: "Failed to schedule newsletter" });
  }
});

// API endpoint to send appointment reminder
app.post("/api/send-reminder", async (req, res) => {
  try {
    const { reminderId, appointmentId, customerId, customerEmail, customerName, appointmentTitle, appointmentDate, appointmentTime, location, reminderType, content, tenantId, from, replyTo } = req.body;

    if (!appointmentId || !customerEmail || !customerName || !appointmentTitle || !appointmentDate || !appointmentTime || !tenantId) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const result = await sendTrackedEvent(
      "reminder/send",
      { reminderId, appointmentId, customerId, customerEmail, customerName, appointmentTitle, appointmentDate, appointmentTime, location, reminderType: reminderType || "email", content, tenantId, from, replyTo },
      { tenantId, relatedType: "appointment_reminder", relatedId: reminderId || appointmentId }
    );

    if (!result.success) {
      res.status(500).json({ error: "Failed to queue reminder", details: result.error });
      return;
    }

    res.json({ success: true, message: "Reminder queued for sending", trackingId: result.eventTrackingId });
  } catch (error) {
    console.error("Error queuing reminder:", error);
    res.status(500).json({ error: "Failed to queue reminder" });
  }
});

// API endpoint to schedule appointment reminder
app.post("/api/schedule-reminder", async (req, res) => {
  try {
    const { reminderId, appointmentId, customerId, customerEmail, customerName, appointmentTitle, appointmentDate, appointmentTime, location, reminderType, content, tenantId, from, replyTo, scheduledFor } = req.body;

    if (!reminderId || !appointmentId || !customerEmail || !customerName || !appointmentTitle || !appointmentDate || !appointmentTime || !tenantId || !scheduledFor) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const result = await sendTrackedEvent(
      "reminder/schedule",
      { reminderId, appointmentId, customerId, customerEmail, customerName, appointmentTitle, appointmentDate, appointmentTime, location, reminderType: reminderType || "email", content, tenantId, from, replyTo, scheduledFor },
      { tenantId, relatedType: "appointment_reminder", relatedId: reminderId, scheduledFor: new Date(scheduledFor) }
    );

    if (!result.success) {
      res.status(500).json({ error: "Failed to schedule reminder", details: result.error });
      return;
    }

    res.json({ success: true, message: `Reminder scheduled for ${scheduledFor}`, trackingId: result.eventTrackingId });
  } catch (error) {
    console.error("Error scheduling reminder:", error);
    res.status(500).json({ error: "Failed to schedule reminder" });
  }
});

// API endpoint to send bulk reminders
app.post("/api/send-bulk-reminders", async (req, res) => {
  try {
    const { reminders } = req.body;

    if (!reminders || !Array.isArray(reminders) || reminders.length === 0) {
      res.status(400).json({ error: "Missing or invalid reminders array" });
      return;
    }

    const result = await sendTrackedEvent(
      "reminder/send.bulk",
      { reminders },
      { relatedType: "appointment_reminder" }
    );

    if (!result.success) {
      res.status(500).json({ error: "Failed to queue bulk reminders", details: result.error });
      return;
    }

    res.json({ success: true, message: `${reminders.length} reminders queued for sending`, trackingId: result.eventTrackingId });
  } catch (error) {
    console.error("Error queuing bulk reminders:", error);
    res.status(500).json({ error: "Failed to queue bulk reminders" });
  }
});

// ============================================
// Event Tracking & Recovery Endpoints
// ============================================

// Get event statistics
app.get("/api/events/stats", async (_req, res) => {
  try {
    const stats = await getEventStats();
    res.json(stats);
  } catch (error) {
    console.error("Error getting event stats:", error);
    res.status(500).json({ error: "Failed to get event stats" });
  }
});

// Get pending events (for recovery)
app.get("/api/events/pending", async (_req, res) => {
  try {
    const events = await getPendingEvents();
    res.json({ count: events.length, events });
  } catch (error) {
    console.error("Error getting pending events:", error);
    res.status(500).json({ error: "Failed to get pending events" });
  }
});

// Get events by status
app.get("/api/events/status/:status", async (req, res) => {
  try {
    const status = req.params.status as InngestEventStatus;
    const limit = parseInt(req.query.limit as string) || 100;
    const events = await getEventsByStatus(status, limit);
    res.json({ count: events.length, events });
  } catch (error) {
    console.error("Error getting events by status:", error);
    res.status(500).json({ error: "Failed to get events" });
  }
});

// Get events for a specific tenant
app.get("/api/events/tenant/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const events = await getTenantEvents(tenantId, limit);
    res.json({ count: events.length, events });
  } catch (error) {
    console.error("Error getting tenant events:", error);
    res.status(500).json({ error: "Failed to get tenant events" });
  }
});

// Resend all pending/failed events (recovery endpoint)
app.post("/api/events/resend-pending", async (_req, res) => {
  try {
    const result = await resendPendingEvents();
    res.json(result);
  } catch (error) {
    console.error("Error resending pending events:", error);
    res.status(500).json({ error: "Failed to resend pending events" });
  }
});

// Cancel a specific event
app.post("/api/events/:eventId/cancel", async (req, res) => {
  try {
    const { eventId } = req.params;
    const cancelled = await cancelEvent(eventId);
    if (cancelled) {
      res.json({ success: true, message: "Event cancelled" });
    } else {
      res.status(404).json({ error: "Event not found or cannot be cancelled" });
    }
  } catch (error) {
    console.error("Error cancelling event:", error);
    res.status(500).json({ error: "Failed to cancel event" });
  }
});

const PORT = parseInt(process.env.INNGEST_PORT || "3006", 10);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Inngest Email Server running on port ${PORT}`);
  console.log(`📧 Inngest dashboard: http://localhost:8288`);
  console.log(`🔗 Inngest endpoint: http://localhost:${PORT}/api/inngest`);
  console.log("");
  console.log("Available endpoints:");
  console.log(`  POST /api/send-email - Send a single email`);
  console.log(`  POST /api/send-bulk-email - Send bulk emails`);
  console.log(`  POST /api/send-newsletter - Send newsletter campaign`);
  console.log(`  POST /api/schedule-newsletter - Schedule newsletter for later`);
  console.log(`  POST /api/send-reminder - Send appointment reminder`);
  console.log(`  POST /api/schedule-reminder - Schedule appointment reminder`);
  console.log(`  POST /api/send-bulk-reminders - Send bulk reminders`);
  console.log(`  GET  /health - Health check`);
  console.log("");
  console.log("Event Tracking endpoints:");
  console.log(`  GET  /api/events/stats - Get event statistics`);
  console.log(`  GET  /api/events/pending - Get pending events for recovery`);
  console.log(`  GET  /api/events/status/:status - Get events by status`);
  console.log(`  GET  /api/events/tenant/:tenantId - Get events for a tenant`);
  console.log(`  POST /api/events/resend-pending - Resend all pending/failed events`);
  console.log(`  POST /api/events/:eventId/cancel - Cancel a pending event`);
});
