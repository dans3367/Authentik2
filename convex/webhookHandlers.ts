import { action, httpAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";

// ─── RESEND ──────────────────────────────────────────────────────────────────

/**
 * Internal handler for Resend webhook events.
 * Called from Express after signature verification.
 */
export const handleResendWebhook = action({
  args: { payload: v.any() },
  handler: async (ctx, { payload: event }) => {
    try {
      // payload is already parsed JSON object passed from Express

      // Map Resend event type → normalised type
      const eventTypeMap: Record<string, string> = {
        "email.sent": "sent",
        "email.delivered": "delivered",
        "email.bounced": "bounced",
        "email.complained": "complained",
        "email.opened": "opened",
        "email.clicked": "clicked",
        "email.suppressed": "suppressed",
      };

      const normalisedType = eventTypeMap[event.type];
      if (!normalisedType) {
        console.log(`Unhandled Resend event type: ${event.type}`);
        return;
      }

      const data = event.data ?? {};
      const providerMessageId: string | undefined =
        data.email_id ?? data.id ?? undefined;
      const recipientEmail = extractRecipientEmail(data);

      if (!recipientEmail) {
        console.error("Could not extract recipient email from Resend webhook");
        return;
      }

      // Derive tenantId + newsletterId from the existing newsletterSends record
      const ids = await resolveIds(ctx, providerMessageId, recipientEmail);

      if (ids) {
        await ctx.runMutation(internal.newsletterTracking.trackEmailEvent, {
          tenantId: ids.tenantId,
          newsletterId: ids.newsletterId,
          recipientEmail,
          providerMessageId,
          eventType: normalisedType as any,
          metadata: buildMetadata(data),
        });
      } else {
        console.log(
          `No matching newsletterSend for providerMessageId=${providerMessageId}, email=${recipientEmail}`,
        );
      }
    } catch (error) {
      console.error("Resend webhook error:", error);
      throw error; // Let Express handle the error
    }
  },
});

// ─── POSTMARK ────────────────────────────────────────────────────────────────

/**
 * Internal handler for Postmark webhook events.
 * Called from Express after signature verification.
 */
export const handlePostmarkWebhook = action({
  args: { payload: v.any() },
  handler: async (ctx, { payload: event }) => {
    try {
      // payload is already parsed JSON object passed from Express

      // Map Postmark RecordType → normalised type
      const eventTypeMap: Record<string, string> = {
        Sent: "sent",
        Delivered: "delivered",
        Bounce: "bounced",
        SpamComplaint: "complained",
        Open: "opened",
        Click: "clicked",
      };

      const normalisedType = eventTypeMap[event.RecordType];
      if (!normalisedType) {
        console.log(`Unhandled Postmark event type: ${event.RecordType}`);
        return;
      }

      const providerMessageId: string | undefined =
        event.MessageID ?? event.id ?? undefined;
      const recipientEmail =
        event.Email ?? event.Recipient ?? extractRecipientEmail(event);

      if (!recipientEmail) {
        console.error("Could not extract recipient email from Postmark webhook");
        return;
      }

      const ids = await resolveIds(ctx, providerMessageId, recipientEmail);

      if (ids) {
        await ctx.runMutation(internal.newsletterTracking.trackEmailEvent, {
          tenantId: ids.tenantId,
          newsletterId: ids.newsletterId,
          recipientEmail,
          providerMessageId,
          eventType: normalisedType as any,
          metadata: buildMetadata(event),
        });
      } else {
        console.log(
          `No matching newsletterSend for providerMessageId=${providerMessageId}, email=${recipientEmail}`,
        );
      }
    } catch (error) {
      console.error("Postmark webhook error:", error);
      throw error; // Let Express handle the error
    }
  },
});

// ─── AHASEND ──────────────────────────────────────────────────────────────────

/**
 * Internal handler for AhaSend webhook events.
 * Called from Express after signature verification.
 *
 * AhaSend event types:
 *   message.reception  → queued (email accepted)
 *   message.delivered   → delivered
 *   message.opened      → opened
 *   message.clicked     → clicked
 *   message.bounced     → bounced
 *   message.failed      → failed
 *   message.suppressed  → suppressed
 *   suppression.created → suppressed
 */
export const handleAhaSendWebhook = action({
  args: { payload: v.any() },
  handler: async (ctx, { payload: event }) => {
    try {
      // AhaSend event lifecycle:
      //   message.reception  → AhaSend received & queued the email (maps to "sent")
      //   message.delivered   → Recipient mail server accepted it (maps to "delivered")
      //   message.opened      → Recipient opened the email (requires open tracking enabled)
      //   message.clicked     → Recipient clicked a link
      //   message.bounced     → Delivery bounced
      //   message.failed      → Permanent failure
      //   message.suppressed  → Suppressed by AhaSend
      //
      // Note: AhaSend has NO separate "sent to recipient server" event.
      // message.delivered implies the email was also sent, so we fire "sent"
      // before "delivered" to ensure correct Queued → Sent → Delivered ordering.
      const eventTypeMap: Record<string, string> = {
        "message.reception": "sent",
        "message.delivered": "delivered",
        "message.opened": "opened",
        "message.clicked": "clicked",
        "message.bounced": "bounced",
        "message.failed": "failed",
        "message.suppressed": "suppressed",
        "message.deferred": "deferred",
        "message.transient_error": "deferred",
        "suppression.created": "suppressed",
      };

      const normalisedType = eventTypeMap[event.type];
      if (!normalisedType || normalisedType === "deferred") {
        console.log(`Unhandled or skipped AhaSend event type: ${event.type}`);
        return;
      }

      const data = event.data ?? {};
      const providerMessageId: string | undefined = data.id ?? undefined;
      const recipientEmail: string | undefined = data.recipient ?? undefined;

      if (!recipientEmail) {
        console.error("Could not extract recipient email from AhaSend webhook");
        return;
      }

      const ids = await resolveIds(ctx, providerMessageId, recipientEmail);

      if (ids) {
        const metadata = buildAhaSendMetadata(data);

        // For delivered/opened/clicked: ensure "sent" event exists first
        // so the status progression is always Queued → Sent → Delivered → Opened
        if (normalisedType === "delivered" || normalisedType === "opened" || normalisedType === "clicked") {
          await ctx.runMutation(internal.newsletterTracking.trackEmailEvent, {
            tenantId: ids.tenantId,
            newsletterId: ids.newsletterId,
            recipientEmail,
            providerMessageId,
            eventType: "sent" as any,
            metadata: { ...metadata, synthetic: true },
          });
        }

        await ctx.runMutation(internal.newsletterTracking.trackEmailEvent, {
          tenantId: ids.tenantId,
          newsletterId: ids.newsletterId,
          recipientEmail,
          providerMessageId,
          eventType: normalisedType as any,
          metadata,
        });
      } else {
        console.log(
          `No matching newsletterSend for AhaSend providerMessageId=${providerMessageId}, email=${recipientEmail}`,
        );
      }
    } catch (error) {
      console.error("AhaSend webhook error:", error);
      throw error;
    }
  },
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Look up tenantId + newsletterId from an existing newsletterSends record,
 * first by providerMessageId, then by recipientEmail.
 */
async function resolveIds(
  ctx: any,
  providerMessageId: string | undefined,
  recipientEmail: string,
): Promise<{ tenantId: string; newsletterId: string } | null> {
  // Try by providerMessageId first
  if (providerMessageId) {
    const send = await ctx.runQuery(
      api.newsletterTracking.findSendByProviderMessageId,
      { providerMessageId },
    );
    if (send) {
      return { tenantId: send.tenantId, newsletterId: send.newsletterId };
    }
  }

  // Fallback: most recent send for this email
  const send = await ctx.runQuery(
    api.newsletterTracking.findSendByRecipientEmail,
    { recipientEmail },
  );
  if (send) {
    return { tenantId: send.tenantId, newsletterId: send.newsletterId };
  }

  return null;
}

/**
 * Extract recipient email from various webhook payload formats.
 */
function extractRecipientEmail(data: any): string | null {
  if (data.to && Array.isArray(data.to)) {
    const first = data.to[0];
    if (typeof first === "string") return first;
    if (first?.email) return first.email;
  }
  if (typeof data.to === "string") return data.to;
  if (data.email) return data.email;
  if (data.Email) return data.Email;
  if (data.Recipient) return data.Recipient;
  return null;
}

/**
 * Build a metadata object from webhook data for storage.
 */
function buildMetadata(data: any): Record<string, any> | undefined {
  const meta: Record<string, any> = {};
  if (data.user_agent || data.UserAgent)
    meta.userAgent = data.user_agent || data.UserAgent;
  if (data.ip_address || data.IPAddress)
    meta.ipAddress = data.ip_address || data.IPAddress;
  if (data.link || data.click?.link)
    meta.link = data.link || data.click?.link;
  if (data.Geo) meta.geo = data.Geo;
  if (data.suppressed) {
    meta.message = data.suppressed.message;
    meta.type = data.suppressed.type;
  }
  // Capture Resend tags for newsletter tracking correlation
  if (data.tags && typeof data.tags === "object") {
    meta.tags = data.tags;
    if (data.tags.trackingId) meta.trackingId = data.tags.trackingId;
    if (data.tags.groupUUID) meta.groupUUID = data.tags.groupUUID;
  }
  return Object.keys(meta).length > 0 ? meta : undefined;
}

/**
 * Build a metadata object from AhaSend webhook data for storage.
 */
function buildAhaSendMetadata(data: any): Record<string, any> | undefined {
  const meta: Record<string, any> = {};
  if (data.from) meta.from = data.from;
  if (data.subject) meta.subject = data.subject;
  if (data.message_id_header) meta.messageIdHeader = data.message_id_header;
  if (data.account_id) meta.accountId = data.account_id;
  if (data.event) meta.event = data.event;
  if (data.reason) meta.reason = data.reason;
  if (data.sending_domain) meta.sendingDomain = data.sending_domain;
  return Object.keys(meta).length > 0 ? meta : undefined;
}

// ─── HTTP ENDPOINTS ─────────────────────────────────────────────────────────────

/**
 * Direct HTTP endpoint for Resend health check.
 * Called directly by Resend service.
 */
export const resendHealthCheck = httpAction(async (ctx, request) => {
  return new Response("Systems all good", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
});

/**
 * Direct HTTP endpoint for Resend webhook events.
 * Handles signature verification and forwards to the action.
 */
export const resendWebhook = httpAction(async (ctx, request) => {
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("RESEND_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing signature headers", { status: 401 });
  }

  // Reject timestamps older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(svixTimestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > 300) {
    return new Response("Timestamp too old", { status: 401 });
  }

  const body = await request.text();

  // Svix secret is base64-encoded after the "whsec_" prefix
  if (!webhookSecret.startsWith("whsec_")) {
    console.error("RESEND_WEBHOOK_SECRET has invalid format (expected whsec_<base64>)");
    return new Response("Webhook secret misconfigured", { status: 500 });
  }
  const secretBase64 = webhookSecret.slice(6);

  // Decode base64 secret to raw bytes
  let secretBytes: ArrayBuffer;
  try {
    const decoded = atob(secretBase64);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    secretBytes = bytes.buffer;
  } catch (e) {
    console.error("RESEND_WEBHOOK_SECRET is not valid base64:", e);
    return new Response("Webhook secret misconfigured", { status: 500 });
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // Svix signs: "${msgId}.${timestamp}.${body}"
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(signedContent),
  );

  // Convert to base64 for comparison
  const expectedSignature = btoa(
    Array.from(new Uint8Array(signatureBytes), (b) => String.fromCharCode(b)).join(""),
  );

  // svix-signature header can contain multiple signatures: "v1,<base64> v1,<base64>"
  const signatures = svixSignature.split(" ");
  const isValid = signatures.some((sig) => {
    const parts = sig.split(",");
    if (parts.length !== 2 || parts[0] !== "v1") return false;
    return parts[1] === expectedSignature;
  });

  if (!isValid) {
    console.error("Invalid webhook signature");
    return new Response("Invalid signature", { status: 401 });
  }

  try {
    const event = JSON.parse(body);
    await ctx.runAction(api.webhookHandlers.handleResendWebhook, {
      payload: event,
    });
  } catch (error) {
    console.error("Error parsing webhook body:", error);
    return new Response("Invalid JSON body", { status: 400 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

/**
 * Direct HTTP endpoint for Postmark webhook events.
 * Handles signature verification and forwards to the action.
 */
export const postmarkWebhook = httpAction(async (ctx, request) => {
  const signature = request.headers.get("x-postmark-signature");
  const webhookSecret = process.env.POSTMARK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("POSTMARK_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  // Verify webhook signature
  if (signature) {
    const body = await request.text();
    const expectedSignature = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(webhookSecret + body)
    );
    const expectedSignatureHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== expectedSignatureHex) {
      console.error("Invalid Postmark webhook signature");
      return new Response("Invalid signature", { status: 401 });
    }

    // Parse and forward to action
    const event = JSON.parse(body);
    await ctx.runAction(api.webhookHandlers.handlePostmarkWebhook, { payload: event });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

/**
 * Direct HTTP endpoint for AhaSend webhook events.
 * AhaSend uses Standard Webhooks spec: webhook-id, webhook-timestamp, webhook-signature headers.
 */
export const ahasendWebhook = httpAction(async (ctx, request) => {
  const webhookId = request.headers.get("webhook-id");
  const webhookTimestamp = request.headers.get("webhook-timestamp");
  const webhookSignature = request.headers.get("webhook-signature");

  const body = await request.text();

  // Parse event early so we can log details
  let event: any;
  try {
    event = JSON.parse(body);
  } catch (error) {
    console.error("Error parsing AhaSend webhook body:", error);
    return new Response("Invalid JSON body", { status: 400 });
  }

  // Log incoming webhook with full details for debugging
  console.log("AhaSend webhook received", {
    webhookId,
    webhookTimestamp,
    hasSignature: !!webhookSignature,
    eventType: event?.type,
    recipient: event?.data?.recipient,
    messageId: event?.data?.id,
    subject: event?.data?.subject,
    from: event?.data?.from,
    timestamp: event?.timestamp,
  });

  // Basic replay protection: reject timestamps older than 5 minutes
  if (webhookTimestamp) {
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(webhookTimestamp, 10);
    if (!isNaN(ts) && Math.abs(now - ts) > 300) {
      console.warn("AhaSend webhook rejected: timestamp too old", { webhookTimestamp, now, diff: Math.abs(now - ts) });
      return new Response("Timestamp too old", { status: 401 });
    }
  }

  // TODO: Implement full Standard Webhooks HMAC signature verification
  // AhaSend uses the standardwebhooks library with aha-whsec- prefixed secrets.
  // For now, we accept events based on the presence of valid webhook headers
  // and replay protection. Add full HMAC verification via the standardwebhooks
  // npm package in the Express server layer (server/routes/webhookRoutes.ts).
  if (!webhookId || !webhookSignature) {
    console.error("Missing AhaSend webhook headers");
    return new Response("Missing webhook headers", { status: 401 });
  }

  try {
    await ctx.runAction(api.webhookHandlers.handleAhaSendWebhook, {
      payload: event,
    });
  } catch (error) {
    console.error("Error processing AhaSend webhook:", error);
    return new Response("Webhook processing failed", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
