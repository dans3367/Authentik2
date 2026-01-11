import "dotenv/config";
import express from "express";
import { serve } from "inngest/express";
import { inngest } from "./client";
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

    await inngest.send({
      name: "email/send",
      data: { to, from, subject, html, text, replyTo, cc, bcc, tags, metadata },
    });

    res.json({ success: true, message: "Email queued for sending" });
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

    await inngest.send({
      name: "email/send.bulk",
      data: { emails },
    });

    res.json({ success: true, message: `${emails.length} emails queued for sending` });
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

    await inngest.send({
      name: "newsletter/send",
      data: { newsletterId, subject, html, text, from, replyTo, recipients, trackingEnabled, tenantId },
    });

    res.json({ success: true, message: `Newsletter queued for ${recipients.length} recipients` });
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

    await inngest.send({
      name: "newsletter/schedule",
      data: { newsletterId, subject, html, text, from, replyTo, recipients, trackingEnabled, tenantId, scheduledFor },
    });

    res.json({ success: true, message: `Newsletter scheduled for ${scheduledFor}` });
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

    await inngest.send({
      name: "reminder/send",
      data: { reminderId, appointmentId, customerId, customerEmail, customerName, appointmentTitle, appointmentDate, appointmentTime, location, reminderType: reminderType || "email", content, tenantId, from, replyTo },
    });

    res.json({ success: true, message: "Reminder queued for sending" });
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

    await inngest.send({
      name: "reminder/schedule",
      data: { reminderId, appointmentId, customerId, customerEmail, customerName, appointmentTitle, appointmentDate, appointmentTime, location, reminderType: reminderType || "email", content, tenantId, from, replyTo, scheduledFor },
    });

    res.json({ success: true, message: `Reminder scheduled for ${scheduledFor}` });
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

    await inngest.send({
      name: "reminder/send.bulk",
      data: { reminders },
    });

    res.json({ success: true, message: `${reminders.length} reminders queued for sending` });
  } catch (error) {
    console.error("Error queuing bulk reminders:", error);
    res.status(500).json({ error: "Failed to queue bulk reminders" });
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
});
