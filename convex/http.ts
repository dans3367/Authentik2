import { httpRouter } from "convex/server";
import {
  resendHealthCheck,
  resendWebhook,
  postmarkWebhook,
  ahasendWebhook,
} from "./webhookHandlers";

const http = httpRouter();

// Resend health-check (Resend pings this GET endpoint on setup)
http.route({
  path: "/webhooks/resend",
  method: "GET",
  handler: resendHealthCheck,
});

// Resend webhook events (delivered, opened, clicked, bounced, etc.)
http.route({
  path: "/webhooks/resend",
  method: "POST",
  handler: resendWebhook,
});

// Postmark webhook events
http.route({
  path: "/webhooks/postmark",
  method: "POST",
  handler: postmarkWebhook,
});

// AhaSend webhook events (delivered, opened, clicked, bounced, etc.)
http.route({
  path: "/webhooks/ahasend",
  method: "POST",
  handler: ahasendWebhook,
});

export default http;
