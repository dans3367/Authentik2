import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Unified live tracking for both newsletter campaigns and individual
// one-off email sends. `sendType` distinguishes them; `campaignId` is the
// newsletter UUID for newsletters or `individual:<postgresEmailSendId>`
// for one-off sends.

// ─── INTERNAL STATS HELPERS ─────────────────────────────────────────────────

export const applyStatsDelta = internalMutation({
  args: {
    campaignId: v.string(),
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
      .query("trackedEmailStats")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
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

export const initEmailCampaign = mutation({
  args: {
    tenantId: v.string(),
    sendType: v.string(),
    campaignId: v.string(),
    totalRecipients: v.number(),
    shopId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("trackedEmailStats")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .first();

    if (existing) {
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

    return await ctx.db.insert("trackedEmailStats", {
      tenantId: args.tenantId,
      shopId: args.shopId,
      sendType: args.sendType,
      campaignId: args.campaignId,
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

export const trackEmailSend = mutation({
  args: {
    tenantId: v.string(),
    sendType: v.string(),
    campaignId: v.string(),
    groupUUID: v.optional(v.string()),
    recipientEmail: v.string(),
    recipientId: v.optional(v.string()),
    recipientName: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    status: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existingSend = await ctx.db
      .query("trackedEmailSends")
      .withIndex("by_campaign_recipient", (q) =>
        q.eq("campaignId", args.campaignId).eq("recipientEmail", args.recipientEmail)
      )
      .first();

    if (existingSend) {
      if (args.providerMessageId && !existingSend.providerMessageId) {
        await ctx.db.patch(existingSend._id, { providerMessageId: args.providerMessageId });
      }
      return existingSend._id;
    }

    const sendId = await ctx.db.insert("trackedEmailSends", {
      tenantId: args.tenantId,
      sendType: args.sendType,
      campaignId: args.campaignId,
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

    await ctx.db.insert("trackedEmailEvents", {
      tenantId: args.tenantId,
      sendType: args.sendType,
      campaignId: args.campaignId,
      trackedSendId: sendId,
      recipientEmail: args.recipientEmail,
      eventType: args.status === "sent" ? "sent" : args.status === "failed" ? "failed" : args.status === "suppressed" ? "suppressed" : "queued",
      providerMessageId: args.providerMessageId,
      occurredAt: now,
    });

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
      await ctx.scheduler.runAfter(0, internal.emailTracking.applyStatsDelta, {
        campaignId: args.campaignId,
        deltas,
      });
    }

    return sendId;
  },
});

export const trackEmailEvent = internalMutation({
  args: {
    tenantId: v.string(),
    sendType: v.string(),
    campaignId: v.string(),
    recipientEmail: v.string(),
    providerMessageId: v.optional(v.string()),
    eventType: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const oneTimeEvents = new Set(["delivered", "sent", "bounced", "complained", "failed", "suppressed", "unsubscribed"]);
    const isOneTime = oneTimeEvents.has(args.eventType);

    if (isOneTime) {
      let existingEvent = null;
      if (args.providerMessageId) {
        existingEvent = await ctx.db
          .query("trackedEmailEvents")
          .withIndex("by_provider_event", (q) =>
            q.eq("providerMessageId", args.providerMessageId).eq("eventType", args.eventType)
          )
          .first();
      }
      if (!existingEvent) {
        existingEvent = await ctx.db
          .query("trackedEmailEvents")
          .withIndex("by_recipient_campaign_event", (q) =>
            q.eq("recipientEmail", args.recipientEmail)
              .eq("campaignId", args.campaignId)
              .eq("eventType", args.eventType)
          )
          .first();
      }
      if (existingEvent) {
        return existingEvent._id;
      }
    }

    let sendRecord = null;
    if (args.providerMessageId) {
      sendRecord = await ctx.db
        .query("trackedEmailSends")
        .withIndex("by_provider_message", (q) => q.eq("providerMessageId", args.providerMessageId))
        .first();
    }
    if (!sendRecord) {
      sendRecord = await ctx.db
        .query("trackedEmailSends")
        .withIndex("by_recipient_and_campaign", (q) =>
          q.eq("recipientEmail", args.recipientEmail).eq("campaignId", args.campaignId)
        )
        .first();
    }

    const eventId = await ctx.db.insert("trackedEmailEvents", {
      tenantId: args.tenantId,
      sendType: args.sendType,
      campaignId: args.campaignId,
      trackedSendId: sendRecord?._id,
      recipientEmail: args.recipientEmail,
      eventType: args.eventType,
      providerMessageId: args.providerMessageId,
      metadata: args.metadata,
      occurredAt: now,
    });

    if (sendRecord) {
      const sendUpdates: any = {};

      switch (args.eventType) {
        case "sent":
          if (sendRecord.status === "queued") {
            sendUpdates.status = "sent";
          }
          if (!sendRecord.sentAt) sendUpdates.sentAt = now;
          break;
        case "delivered":
          sendUpdates.status = "delivered";
          sendUpdates.deliveredAt = now;
          if (!sendRecord.sentAt) sendUpdates.sentAt = now;
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

    const deltas: Record<string, number> = {};

    switch (args.eventType) {
      case "sent":
        deltas.sent = 1;
        deltas.queued = -1;
        break;
      case "delivered":
        deltas.delivered = 1;
        if (sendRecord && sendRecord.status === "queued") {
          deltas.sent = 1;
          deltas.queued = -1;
        }
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
      await ctx.scheduler.runAfter(0, internal.emailTracking.applyStatsDelta, {
        campaignId: args.campaignId,
        deltas,
      });
    }

    return eventId;
  },
});

export const completeEmailCampaign = mutation({
  args: {
    campaignId: v.string(),
    sentCount: v.number(),
    failedCount: v.number(),
  },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("trackedEmailStats")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
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

export const getCampaignStats = query({
  args: { campaignId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trackedEmailStats")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .first();
  },
});

export const getTenantCampaignStats = query({
  args: {
    tenantId: v.string(),
    sendType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.sendType) {
      return await ctx.db
        .query("trackedEmailStats")
        .withIndex("by_tenant_sendtype", (q) =>
          q.eq("tenantId", args.tenantId).eq("sendType", args.sendType!)
        )
        .collect();
    }
    return await ctx.db
      .query("trackedEmailStats")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  },
});

export const getTenantRecentEvents = query({
  args: {
    tenantId: v.string(),
    sendType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 25;
    if (args.sendType) {
      return await ctx.db
        .query("trackedEmailEvents")
        .withIndex("by_tenant_sendtype", (q) =>
          q.eq("tenantId", args.tenantId).eq("sendType", args.sendType!)
        )
        .order("desc")
        .take(limit);
    }
    return await ctx.db
      .query("trackedEmailEvents")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(limit);
  },
});

export const getCampaignSends = query({
  args: {
    campaignId: v.string(),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.status) {
      return await ctx.db
        .query("trackedEmailSends")
        .withIndex("by_status", (q) =>
          q.eq("campaignId", args.campaignId).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("trackedEmailSends")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .order("desc")
      .take(limit);
  },
});

export const getCampaignEvents = query({
  args: {
    campaignId: v.string(),
    eventType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.eventType) {
      return await ctx.db
        .query("trackedEmailEvents")
        .withIndex("by_type", (q) =>
          q.eq("campaignId", args.campaignId).eq("eventType", args.eventType!)
        )
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("trackedEmailEvents")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .order("desc")
      .take(limit);
  },
});

export const getEmailTrajectory = query({
  args: {
    trackedSendId: v.id("trackedEmailSends"),
  },
  handler: async (ctx, args) => {
    const send = await ctx.db.get(args.trackedSendId);
    if (!send) return null;

    const events = await ctx.db
      .query("trackedEmailEvents")
      .withIndex("by_send", (q) => q.eq("trackedSendId", args.trackedSendId))
      .order("asc")
      .collect();

    return { send, events };
  },
});

export const findSendByProviderMessageId = query({
  args: { providerMessageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trackedEmailSends")
      .withIndex("by_provider_message", (q) =>
        q.eq("providerMessageId", args.providerMessageId)
      )
      .first();
  },
});

export const findSendByRecipientEmail = query({
  args: { recipientEmail: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trackedEmailSends")
      .withIndex("by_recipient_email", (q) =>
        q.eq("recipientEmail", args.recipientEmail)
      )
      .order("desc")
      .first();
  },
});

// Live aggregate for a single recipient across all their tracked sends.
// Used by the contact-detail Engagement Statistics panel so counters update
// the moment a webhook fires, without round-tripping through Postgres.
export const getRecipientEngagement = query({
  args: { tenantId: v.string(), recipientEmail: v.string() },
  handler: async (ctx, args) => {
    const sends = await ctx.db
      .query("trackedEmailSends")
      .withIndex("by_recipient", (q) =>
        q.eq("tenantId", args.tenantId).eq("recipientEmail", args.recipientEmail)
      )
      .collect();

    let sent = 0;
    let opened = 0;
    let clicked = 0;
    let bounced = 0;
    let totalOpens = 0;
    let totalClicks = 0;
    let lastActivityAt: number | undefined;

    for (const s of sends) {
      if (s.status !== "queued" && s.status !== "failed" && s.status !== "suppressed") sent++;
      if (s.firstOpenedAt) opened++;
      if (s.firstClickedAt) clicked++;
      if (s.status === "bounced") bounced++;
      totalOpens += s.openCount ?? 0;
      totalClicks += s.clickCount ?? 0;
      const candidate = s.lastOpenedAt ?? s.deliveredAt ?? s.sentAt;
      if (candidate && (!lastActivityAt || candidate > lastActivityAt)) {
        lastActivityAt = candidate;
      }
    }

    return {
      sent,
      opened,
      clicked,
      bounced,
      totalOpens,
      totalClicks,
      totalSends: sends.length,
      lastActivityAt,
    };
  },
});

export const getStatusBreakdown = query({
  args: { campaignId: v.string() },
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("trackedEmailStats")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .first();

    if (!stats) return null;

    return {
      campaignId: args.campaignId,
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
