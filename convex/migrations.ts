import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// One-shot migration: copy newsletter* rows into trackedEmail* tables.
// Run after the new schema is deployed and verified.
// Idempotent — checks campaignId+recipientEmail (or eventType for events) before inserting.
//
// Invoke from Convex dashboard: migrations.migrateNewsletterToTrackedEmail({batch: 500})

export const migrateNewsletterToTrackedEmail = internalMutation({
  args: { batch: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const batch = args.batch ?? 500;
    let sendsCopied = 0;
    let eventsCopied = 0;
    let statsCopied = 0;

    // ── Stats ────────────────────────────────────────────────────────────
    const oldStats = await ctx.db.query("newsletterStats").take(batch);
    for (const s of oldStats) {
      const existing = await ctx.db
        .query("trackedEmailStats")
        .withIndex("by_campaign", (q) => q.eq("campaignId", s.newsletterId))
        .first();
      if (existing) continue;

      await ctx.db.insert("trackedEmailStats", {
        tenantId: s.tenantId,
        shopId: s.shopId,
        sendType: "newsletter",
        campaignId: s.newsletterId,
        status: s.status,
        totalRecipients: s.totalRecipients,
        queued: s.queued,
        sent: s.sent,
        delivered: s.delivered,
        opened: s.opened,
        uniqueOpens: s.uniqueOpens,
        clicked: s.clicked,
        uniqueClicks: s.uniqueClicks,
        bounced: s.bounced,
        complained: s.complained,
        failed: s.failed,
        suppressed: s.suppressed,
        unsubscribed: s.unsubscribed,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        lastEventAt: s.lastEventAt,
      });
      statsCopied++;
    }

    // ── Sends ────────────────────────────────────────────────────────────
    const oldOldToNewSendId = new Map<string, any>();
    const oldSends = await ctx.db.query("newsletterSends").take(batch);
    for (const s of oldSends) {
      const existing = await ctx.db
        .query("trackedEmailSends")
        .withIndex("by_campaign_recipient", (q) =>
          q.eq("campaignId", s.newsletterId).eq("recipientEmail", s.recipientEmail)
        )
        .first();
      if (existing) {
        oldOldToNewSendId.set(s._id, existing._id);
        continue;
      }

      const newId = await ctx.db.insert("trackedEmailSends", {
        tenantId: s.tenantId,
        sendType: "newsletter",
        campaignId: s.newsletterId,
        groupUUID: s.groupUUID,
        recipientEmail: s.recipientEmail,
        recipientId: s.recipientId,
        recipientName: s.recipientName,
        providerMessageId: s.providerMessageId,
        status: s.status,
        error: s.error,
        sentAt: s.sentAt,
        deliveredAt: s.deliveredAt,
        firstOpenedAt: s.firstOpenedAt,
        lastOpenedAt: s.lastOpenedAt,
        firstClickedAt: s.firstClickedAt,
        openCount: s.openCount,
        clickCount: s.clickCount,
      });
      oldOldToNewSendId.set(s._id, newId);
      sendsCopied++;
    }

    // ── Events ───────────────────────────────────────────────────────────
    const oldEvents = await ctx.db.query("newsletterEvents").take(batch);
    for (const e of oldEvents) {
      const dupe = await ctx.db
        .query("trackedEmailEvents")
        .withIndex("by_recipient_campaign_event", (q) =>
          q.eq("recipientEmail", e.recipientEmail)
            .eq("campaignId", e.newsletterId)
            .eq("eventType", e.eventType)
        )
        .first();
      if (dupe && dupe.occurredAt === e.occurredAt) continue;

      let mappedSendId: any = undefined;
      if (e.newsletterSendId) {
        mappedSendId = oldOldToNewSendId.get(e.newsletterSendId);
        if (!mappedSendId) {
          const oldSend = await ctx.db.get(e.newsletterSendId);
          if (oldSend) {
            const newSend = await ctx.db
              .query("trackedEmailSends")
              .withIndex("by_campaign_recipient", (q) =>
                q.eq("campaignId", oldSend.newsletterId).eq("recipientEmail", oldSend.recipientEmail)
              )
              .first();
            if (newSend) mappedSendId = newSend._id;
          }
        }
      }

      await ctx.db.insert("trackedEmailEvents", {
        tenantId: e.tenantId,
        sendType: "newsletter",
        campaignId: e.newsletterId,
        trackedSendId: mappedSendId,
        recipientEmail: e.recipientEmail,
        eventType: e.eventType,
        providerMessageId: e.providerMessageId,
        metadata: e.metadata,
        occurredAt: e.occurredAt,
      });
      eventsCopied++;
    }

    return { statsCopied, sendsCopied, eventsCopied };
  },
});
