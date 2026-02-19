import { action } from "./_generated/server";
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
  return Object.keys(meta).length > 0 ? meta : undefined;
}

