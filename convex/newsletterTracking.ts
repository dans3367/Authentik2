import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── INTERNAL STATS HELPERS ─────────────────────────────────────────────────
// These small mutations ONLY touch the newsletterStats document.
// By scheduling them separately, we avoid holding a write lock on the
// high-contention stats row while also writing sends/events in the same
// transaction.  If a stats update hits a write conflict Convex will
// automatically retry it (up to the built-in limit).

/**
 * Atomically apply a delta to the newsletterStats counters for a given
 * newsletter.  Each field in `deltas` is added to the current value.
 */
export const applyStatsDelta = internalMutation({
  args: {
    newsletterId: v.string(),
    deltas: v.object({
      queued: v.optional(v.number()),
      sent: v.optional(v.number()),
      delivered: v.optional(v.number()),
      opened: v.optional(v.number()),
      uniqueOpens: v.optional(v.number()),
      clicked: v.optional(v.number()),
      uniqueClicks: v.optional(v.number()),
      bounced: v.optional(v.number()),
      complained: v.optional(v.number()),
      failed: v.optional(v.number()),
      suppressed: v.optional(v.number()),
      unsubscribed: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("newsletterStats")
      .withIndex("by_newsletter", (q) => q.eq("newsletterId", args.newsletterId))
      .first();

    if (!stats) return;

    const updates: any = { lastEventAt: Date.now() };
    for (const [key, delta] of Object.entries(args.deltas)) {
      if (delta !== undefined && delta !== 0) {
        const current = (stats as any)[key] ?? 0;
        updates[key] = Math.max(0, current + delta);
      }
    }

    await ctx.db.patch(stats._id, updates);
  },
});

// ─── MUTATIONS ───────────────────────────────────────────────────────────────

/**
 * Initialize tracking for a newsletter send campaign.
 * Called once when a newsletter starts sending.
 */
export const initNewsletterSend = mutation({
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
        suppressed: 0,
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
      suppressed: 0,
      unsubscribed: 0,
      startedAt: Date.now(),
    });
  },
});

/**
 * Track an individual email being queued/sent within a newsletter.
 * Called for each recipient when the email is dispatched.
 *
 * Stats update is scheduled as a SEPARATE mutation to avoid write-conflicts
 * on the shared newsletterStats row.
 */
export const trackEmailSend = mutation({
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
      eventType: args.status === "sent" ? "sent" : args.status === "failed" ? "failed" : args.status === "suppressed" ? "suppressed" : "queued",
      providerMessageId: args.providerMessageId,
      occurredAt: now,
    });

    // ── Schedule stats update in a SEPARATE mutation ──
    // This avoids write-conflicts: the send/event inserts commit independently
    // of the stats counter update.
    const deltas: Record<string, number> = {};
    if (args.status === "sent") {
      deltas.sent = 1;
      deltas.queued = -1;
    } else if (args.status === "failed") {
      deltas.failed = 1;
      deltas.queued = -1;
    } else if (args.status === "suppressed") {
      deltas.suppressed = 1;
      deltas.queued = -1;
    }

    if (Object.keys(deltas).length > 0) {
      await ctx.scheduler.runAfter(0, internal.newsletterTracking.applyStatsDelta, {
        newsletterId: args.newsletterId,
        deltas,
      });
    }

    return sendId;
  },
});

/**
 * Track a webhook event (delivered, opened, clicked, bounced, complained, unsubscribed).
 * Called from webhook handlers when email provider sends event data.
 *
 * The event record + send record update happen in this transaction.
 * The aggregated stats update is scheduled separately to avoid contention.
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
    const oneTimeEvents = new Set(["delivered", "sent", "bounced", "complained", "failed", "suppressed", "unsubscribed"]);
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

    // Update the send record status (this only touches ONE row, not the shared stats)
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
        case "suppressed":
          sendUpdates.status = "suppressed";
          sendUpdates.error = args.metadata?.message || args.metadata?.type || "Suppressed by Resend";
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

    // ── Schedule stats update in a SEPARATE mutation ──
    // Determine if this is a unique open/click based on send record state
    const deltas: Record<string, number> = {};

    switch (args.eventType) {
      case "delivered":
        deltas.delivered = 1;
        break;
      case "opened":
        deltas.opened = 1;
        if (sendRecord && !sendRecord.firstOpenedAt) {
          deltas.uniqueOpens = 1;
        }
        break;
      case "clicked":
        deltas.clicked = 1;
        if (sendRecord && !sendRecord.firstClickedAt) {
          deltas.uniqueClicks = 1;
        }
        if (sendRecord && !sendRecord.firstOpenedAt) {
          deltas.opened = (deltas.opened ?? 0) + 1;
          deltas.uniqueOpens = 1;
        }
        break;
      case "bounced":
        deltas.bounced = 1;
        break;
      case "complained":
        deltas.complained = 1;
        break;
      case "suppressed":
        deltas.suppressed = 1;
        break;
      case "unsubscribed":
        deltas.unsubscribed = 1;
        break;
      case "failed":
        deltas.failed = 1;
        break;
    }

    if (Object.keys(deltas).length > 0) {
      await ctx.scheduler.runAfter(0, internal.newsletterTracking.applyStatsDelta, {
        newsletterId: args.newsletterId,
        deltas,
      });
    }

    return eventId;
  },
});

/**
 * Mark a newsletter send campaign as completed.
 */
export const completeNewsletterSend = mutation({
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
        suppressed: stats.suppressed ?? 0,
        unsubscribed: stats.unsubscribed,
      },
      rates: {
        deliveryRate: stats.sent > 0 ? ((stats.delivered / stats.sent) * 100).toFixed(1) : "0",
        openRate: stats.delivered > 0 ? ((stats.uniqueOpens / stats.delivered) * 100).toFixed(1) : "0",
        clickRate: stats.delivered > 0 ? ((stats.uniqueClicks / stats.delivered) * 100).toFixed(1) : "0",
        bounceRate: stats.sent > 0 ? ((stats.bounced / stats.sent) * 100).toFixed(1) : "0",
        suppressionRate: stats.totalRecipients > 0 ? (((stats.suppressed ?? 0) / stats.totalRecipients) * 100).toFixed(1) : "0",
      },
    };
  },
});
