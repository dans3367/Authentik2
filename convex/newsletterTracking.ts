import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";

// ─── MUTATIONS ───────────────────────────────────────────────────────────────

/**
 * Initialize tracking for a newsletter send campaign.
 * Called once when a newsletter starts sending.
 */
export const initNewsletterSend = internalMutation({
  args: {
    tenantId: v.string(),
    newsletterId: v.string(),
    totalRecipients: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if stats already exist for this newsletter
    const existing = await ctx.db
      .query("newsletterStats")
      .withIndex("by_newsletter", (q) => q.eq("newsletterId", args.newsletterId))
      .first();

    if (existing) {
      // Reset all counters so a re-init behaves like a fresh send
      await ctx.db.patch(existing._id, {
        status: "sending",
        totalRecipients: args.totalRecipients,
        queued: args.totalRecipients,
        sent: 0,
        delivered: 0,
        opened: 0,
        uniqueOpens: 0,
        clicked: 0,
        uniqueClicks: 0,
        bounced: 0,
        complained: 0,
        failed: 0,
        unsubscribed: 0,
        startedAt: Date.now(),
        lastEventAt: Date.now(),
      });
      return existing._id;
    }

    // Create new stats record
    return await ctx.db.insert("newsletterStats", {
      tenantId: args.tenantId,
      newsletterId: args.newsletterId,
      status: "sending",
      totalRecipients: args.totalRecipients,
      queued: args.totalRecipients,
      sent: 0,
      delivered: 0,
      opened: 0,
      uniqueOpens: 0,
      clicked: 0,
      uniqueClicks: 0,
      bounced: 0,
      complained: 0,
      failed: 0,
      unsubscribed: 0,
      startedAt: Date.now(),
    });
  },
});

/**
 * Track an individual email being queued/sent within a newsletter.
 * Called for each recipient when the email is dispatched.
 */
export const trackEmailSend = internalMutation({
  args: {
    tenantId: v.string(),
    newsletterId: v.string(),
    groupUUID: v.string(),
    recipientEmail: v.string(),
    recipientId: v.optional(v.string()),
    recipientName: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    status: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // ── Idempotency guard: skip if a send record already exists for this recipient+newsletter ──
    const existingSend = await ctx.db
      .query("newsletterSends")
      .withIndex("by_newsletter_recipient", (q) =>
        q.eq("newsletterId", args.newsletterId).eq("recipientEmail", args.recipientEmail)
      )
      .first();

    if (existingSend) {
      // If the retry carries a providerMessageId we didn't have before, patch it in
      if (args.providerMessageId && !existingSend.providerMessageId) {
        await ctx.db.patch(existingSend._id, { providerMessageId: args.providerMessageId });
      }
      return existingSend._id;
    }

    const sendId = await ctx.db.insert("newsletterSends", {
      tenantId: args.tenantId,
      newsletterId: args.newsletterId,
      groupUUID: args.groupUUID,
      recipientEmail: args.recipientEmail,
      recipientId: args.recipientId,
      recipientName: args.recipientName,
      providerMessageId: args.providerMessageId,
      status: args.status,
      error: args.error,
      sentAt: args.status === "sent" ? now : undefined,
      openCount: 0,
      clickCount: 0,
    });

    // Also create an event record
    await ctx.db.insert("newsletterEvents", {
      tenantId: args.tenantId,
      newsletterId: args.newsletterId,
      newsletterSendId: sendId,
      recipientEmail: args.recipientEmail,
      eventType: args.status === "sent" ? "sent" : args.status === "failed" ? "failed" : "queued",
      providerMessageId: args.providerMessageId,
      occurredAt: now,
    });

    // Update aggregated stats
    const stats = await ctx.db
      .query("newsletterStats")
      .withIndex("by_newsletter", (q) => q.eq("newsletterId", args.newsletterId))
      .first();

    if (stats) {
      const updates: any = { lastEventAt: now };
      if (args.status === "sent") {
        updates.sent = stats.sent + 1;
        updates.queued = Math.max(0, stats.queued - 1);
      } else if (args.status === "failed") {
        updates.failed = stats.failed + 1;
        updates.queued = Math.max(0, stats.queued - 1);
      }
      await ctx.db.patch(stats._id, updates);
    }

    return sendId;
  },
});

/**
 * Track a webhook event (delivered, opened, clicked, bounced, complained, unsubscribed).
 * Called from webhook handlers when email provider sends event data.
 */
export const trackEmailEvent = internalMutation({
  args: {
    tenantId: v.string(),
    newsletterId: v.string(),
    recipientEmail: v.string(),
    providerMessageId: v.optional(v.string()),
    eventType: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // ── Idempotency guard ──────────────────────────────────────────────────
    // For one-time events (delivered, bounced, complained, failed, unsubscribed)
    // we dedupe: if an identical event already exists, return early.
    // For repeatable events (opened, clicked) we allow multiple event records
    // but the counter logic already guards uniqueness via firstOpenedAt/firstClickedAt.
    const oneTimeEvents = new Set(["delivered", "sent", "bounced", "complained", "failed", "unsubscribed"]);
    const isOneTime = oneTimeEvents.has(args.eventType);

    if (isOneTime) {
      let existingEvent = null;
      if (args.providerMessageId) {
        existingEvent = await ctx.db
          .query("newsletterEvents")
          .withIndex("by_provider_event", (q) =>
            q.eq("providerMessageId", args.providerMessageId).eq("eventType", args.eventType)
          )
          .first();
      }
      if (!existingEvent) {
        existingEvent = await ctx.db
          .query("newsletterEvents")
          .withIndex("by_recipient_newsletter_event", (q) =>
            q.eq("recipientEmail", args.recipientEmail)
              .eq("newsletterId", args.newsletterId)
              .eq("eventType", args.eventType)
          )
          .first();
      }
      if (existingEvent) {
        return existingEvent._id;
      }
    }

    // Find the send record by providerMessageId, falling back to recipientEmail+newsletterId
    let sendRecord = null;
    if (args.providerMessageId) {
      sendRecord = await ctx.db
        .query("newsletterSends")
        .withIndex("by_provider_message", (q) => q.eq("providerMessageId", args.providerMessageId))
        .first();
    }
    if (!sendRecord) {
      sendRecord = await ctx.db
        .query("newsletterSends")
        .withIndex("by_recipient_and_newsletter", (q) =>
          q.eq("recipientEmail", args.recipientEmail).eq("newsletterId", args.newsletterId)
        )
        .first();
    }

    // Create event record
    const eventId = await ctx.db.insert("newsletterEvents", {
      tenantId: args.tenantId,
      newsletterId: args.newsletterId,
      newsletterSendId: sendRecord?._id,
      recipientEmail: args.recipientEmail,
      eventType: args.eventType,
      providerMessageId: args.providerMessageId,
      metadata: args.metadata,
      occurredAt: now,
    });

    // Update the send record status
    if (sendRecord) {
      const sendUpdates: any = {};

      switch (args.eventType) {
        case "delivered":
          sendUpdates.status = "delivered";
          sendUpdates.deliveredAt = now;
          break;
        case "opened":
          sendUpdates.status = sendRecord.status === "clicked" ? "clicked" : "opened";
          sendUpdates.openCount = sendRecord.openCount + 1;
          if (!sendRecord.firstOpenedAt) sendUpdates.firstOpenedAt = now;
          sendUpdates.lastOpenedAt = now;
          break;
        case "clicked":
          sendUpdates.status = "clicked";
          sendUpdates.clickCount = sendRecord.clickCount + 1;
          if (!sendRecord.firstClickedAt) sendUpdates.firstClickedAt = now;
          // Also count as an open if not already opened
          if (!sendRecord.firstOpenedAt) {
            sendUpdates.firstOpenedAt = now;
            sendUpdates.lastOpenedAt = now;
            sendUpdates.openCount = sendRecord.openCount + 1;
          }
          break;
        case "bounced":
          sendUpdates.status = "bounced";
          break;
        case "complained":
          sendUpdates.status = "complained";
          break;
        case "unsubscribed":
          // Don't change status, just record the event
          break;
        case "failed":
          sendUpdates.status = "failed";
          sendUpdates.error = args.metadata?.error || "Unknown error";
          break;
      }

      if (Object.keys(sendUpdates).length > 0) {
        await ctx.db.patch(sendRecord._id, sendUpdates);
      }
    }

    // Update aggregated stats
    const stats = await ctx.db
      .query("newsletterStats")
      .withIndex("by_newsletter", (q) => q.eq("newsletterId", args.newsletterId))
      .first();

    if (stats) {
      const statsUpdates: any = { lastEventAt: now };

      switch (args.eventType) {
        case "delivered":
          statsUpdates.delivered = stats.delivered + 1;
          break;
        case "opened":
          statsUpdates.opened = stats.opened + 1;
          // Check if this is a unique open (first open for this recipient)
          if (sendRecord && !sendRecord.firstOpenedAt) {
            statsUpdates.uniqueOpens = stats.uniqueOpens + 1;
          }
          break;
        case "clicked":
          statsUpdates.clicked = stats.clicked + 1;
          if (sendRecord && !sendRecord.firstClickedAt) {
            statsUpdates.uniqueClicks = stats.uniqueClicks + 1;
          }
          // Also count as unique open if first interaction
          if (sendRecord && !sendRecord.firstOpenedAt) {
            statsUpdates.opened = (statsUpdates.opened ?? stats.opened) + 1;
            statsUpdates.uniqueOpens = stats.uniqueOpens + 1;
          }
          break;
        case "bounced":
          statsUpdates.bounced = stats.bounced + 1;
          break;
        case "complained":
          statsUpdates.complained = stats.complained + 1;
          break;
        case "unsubscribed":
          statsUpdates.unsubscribed = stats.unsubscribed + 1;
          break;
        case "failed":
          statsUpdates.failed = stats.failed + 1;
          break;
      }

      await ctx.db.patch(stats._id, statsUpdates);
    }

    return eventId;
  },
});

/**
 * Mark a newsletter send campaign as completed.
 */
export const completeNewsletterSend = internalMutation({
  args: {
    newsletterId: v.string(),
    sentCount: v.number(),
    failedCount: v.number(),
  },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("newsletterStats")
      .withIndex("by_newsletter", (q) => q.eq("newsletterId", args.newsletterId))
      .first();

    if (stats) {
      await ctx.db.patch(stats._id, {
        status: "completed",
        sent: args.sentCount,
        failed: args.failedCount,
        queued: 0,
        completedAt: Date.now(),
        lastEventAt: Date.now(),
      });
    }
  },
});

// ─── QUERIES ─────────────────────────────────────────────────────────────────

/**
 * Get real-time stats for a specific newsletter.
 * Frontend subscribes to this for live updates.
 */
export const getNewsletterStats = query({
  args: { newsletterId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newsletterStats")
      .withIndex("by_newsletter", (q) => q.eq("newsletterId", args.newsletterId))
      .first();
  },
});

/**
 * Get all newsletter stats for a tenant (for dashboard overview).
 */
export const getTenantNewsletterStats = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newsletterStats")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  },
});

/**
 * Get individual email sends for a newsletter (paginated).
 */
export const getNewsletterSends = query({
  args: {
    newsletterId: v.string(),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.status) {
      return await ctx.db
        .query("newsletterSends")
        .withIndex("by_status", (q) =>
          q.eq("newsletterId", args.newsletterId).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("newsletterSends")
      .withIndex("by_newsletter", (q) => q.eq("newsletterId", args.newsletterId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get recent events for a newsletter (live event feed).
 */
export const getNewsletterEvents = query({
  args: {
    newsletterId: v.string(),
    eventType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.eventType) {
      return await ctx.db
        .query("newsletterEvents")
        .withIndex("by_type", (q) =>
          q.eq("newsletterId", args.newsletterId).eq("eventType", args.eventType!)
        )
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("newsletterEvents")
      .withIndex("by_newsletter", (q) => q.eq("newsletterId", args.newsletterId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get the full trajectory of a single email (all events for one recipient).
 */
export const getEmailTrajectory = query({
  args: {
    newsletterSendId: v.id("newsletterSends"),
  },
  handler: async (ctx, args) => {
    const send = await ctx.db.get(args.newsletterSendId);
    if (!send) return null;

    const events = await ctx.db
      .query("newsletterEvents")
      .withIndex("by_send", (q) => q.eq("newsletterSendId", args.newsletterSendId))
      .order("asc")
      .collect();

    return { send, events };
  },
});

/**
 * Get status breakdown counts for a newsletter (for pie/bar charts).
 */
/**
 * Find a newsletterSend record by providerMessageId.
 * Used by Convex HTTP webhook handlers to resolve tenantId/newsletterId.
 */
export const findSendByProviderMessageId = query({
  args: { providerMessageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newsletterSends")
      .withIndex("by_provider_message", (q) =>
        q.eq("providerMessageId", args.providerMessageId)
      )
      .first();
  },
});

/**
 * Find the most recent newsletterSend record by recipientEmail.
 * Fallback lookup used by Convex HTTP webhook handlers.
 */
export const findSendByRecipientEmail = query({
  args: { recipientEmail: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newsletterSends")
      .withIndex("by_recipient_email", (q) =>
        q.eq("recipientEmail", args.recipientEmail)
      )
      .order("desc")
      .first();
  },
});

export const getStatusBreakdown = query({
  args: { newsletterId: v.string() },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("newsletterStats")
      .withIndex("by_newsletter", (q) => q.eq("newsletterId", args.newsletterId))
      .first();

    if (!stats) return null;

    return {
      newsletterId: args.newsletterId,
      total: stats.totalRecipients,
      breakdown: {
        queued: stats.queued,
        sent: stats.sent,
        delivered: stats.delivered,
        opened: stats.uniqueOpens,
        clicked: stats.uniqueClicks,
        bounced: stats.bounced,
        complained: stats.complained,
        failed: stats.failed,
        unsubscribed: stats.unsubscribed,
      },
      rates: {
        deliveryRate: stats.sent > 0 ? ((stats.delivered / stats.sent) * 100).toFixed(1) : "0",
        openRate: stats.delivered > 0 ? ((stats.uniqueOpens / stats.delivered) * 100).toFixed(1) : "0",
        clickRate: stats.delivered > 0 ? ((stats.uniqueClicks / stats.delivered) * 100).toFixed(1) : "0",
        bounceRate: stats.sent > 0 ? ((stats.bounced / stats.sent) * 100).toFixed(1) : "0",
      },
    };
  },
});
