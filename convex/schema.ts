import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Tracks each individual email send within a newsletter campaign
  newsletterSends: defineTable({
    tenantId: v.string(),
    newsletterId: v.string(),
    groupUUID: v.string(), // Batch group identifier from Trigger.dev
    recipientEmail: v.string(),
    recipientId: v.optional(v.string()), // Contact ID from PostgreSQL
    recipientName: v.optional(v.string()),
    providerMessageId: v.optional(v.string()), // Resend email ID
    status: v.string(), // 'queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'complained'
    error: v.optional(v.string()),
    sentAt: v.optional(v.number()), // timestamp ms
    deliveredAt: v.optional(v.number()),
    firstOpenedAt: v.optional(v.number()),
    lastOpenedAt: v.optional(v.number()),
    firstClickedAt: v.optional(v.number()),
    openCount: v.number(),
    clickCount: v.number(),
  })
    .index("by_newsletter", ["newsletterId"])
    .index("by_tenant_newsletter", ["tenantId", "newsletterId"])
    .index("by_provider_message", ["providerMessageId"])
    .index("by_recipient", ["tenantId", "recipientEmail"])
    .index("by_status", ["newsletterId", "status"]),

  // Tracks individual email events (opens, clicks, bounces, etc.)
  newsletterEvents: defineTable({
    tenantId: v.string(),
    newsletterId: v.string(),
    newsletterSendId: v.optional(v.id("newsletterSends")), // Reference to the send record
    recipientEmail: v.string(),
    eventType: v.string(), // 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'failed'
    providerMessageId: v.optional(v.string()),
    metadata: v.optional(v.any()), // Extra event data (link clicked, user agent, IP, etc.)
    occurredAt: v.number(), // timestamp ms
  })
    .index("by_newsletter", ["newsletterId"])
    .index("by_tenant_newsletter", ["tenantId", "newsletterId"])
    .index("by_send", ["newsletterSendId"])
    .index("by_type", ["newsletterId", "eventType"])
    .index("by_occurred", ["newsletterId", "occurredAt"]),

  // Aggregated real-time stats per newsletter (updated on each event)
  newsletterStats: defineTable({
    tenantId: v.string(),
    newsletterId: v.string(),
    status: v.string(), // 'sending', 'sent', 'completed'
    totalRecipients: v.number(),
    queued: v.number(),
    sent: v.number(),
    delivered: v.number(),
    opened: v.number(),
    uniqueOpens: v.number(),
    clicked: v.number(),
    uniqueClicks: v.number(),
    bounced: v.number(),
    complained: v.number(),
    failed: v.number(),
    unsubscribed: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    lastEventAt: v.optional(v.number()),
  })
    .index("by_newsletter", ["newsletterId"])
    .index("by_tenant", ["tenantId"]),
});
