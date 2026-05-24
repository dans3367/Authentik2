import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── Unified email tracking tables (newsletter + individual sends) ────────
  // `sendType` distinguishes campaign-style newsletter sends from one-off
  // individual emails (contact "Send Email" button, scheduled contact email, etc.).
  // `campaignId` holds either the Postgres newsletter UUID or a synthetic
  // `individual:<postgresEmailSendId>` for one-off sends.
  trackedEmailSends: defineTable({
    tenantId: v.string(),
    sendType: v.string(), // 'newsletter' | 'individual'
    campaignId: v.string(),
    groupUUID: v.optional(v.string()), // Batch group identifier from Trigger.dev (newsletter only)
    recipientEmail: v.string(),
    recipientId: v.optional(v.string()), // Contact ID from PostgreSQL
    recipientName: v.optional(v.string()),
    providerMessageId: v.optional(v.string()), // Resend email ID
    status: v.string(),
    error: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    firstOpenedAt: v.optional(v.number()),
    lastOpenedAt: v.optional(v.number()),
    firstClickedAt: v.optional(v.number()),
    openCount: v.number(),
    clickCount: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_tenant_campaign", ["tenantId", "campaignId"])
    .index("by_provider_message", ["providerMessageId"])
    .index("by_recipient", ["tenantId", "recipientEmail"])
    .index("by_recipient_and_campaign", ["recipientEmail", "campaignId"])
    .index("by_status", ["campaignId", "status"])
    .index("by_recipient_email", ["recipientEmail"])
    .index("by_campaign_recipient", ["campaignId", "recipientEmail"])
    .index("by_tenant_sendtype", ["tenantId", "sendType"]),

  trackedEmailEvents: defineTable({
    tenantId: v.string(),
    sendType: v.string(),
    campaignId: v.string(),
    trackedSendId: v.optional(v.id("trackedEmailSends")),
    recipientEmail: v.string(),
    eventType: v.string(),
    providerMessageId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    occurredAt: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_campaign", ["tenantId", "campaignId"])
    .index("by_send", ["trackedSendId"])
    .index("by_type", ["campaignId", "eventType"])
    .index("by_occurred", ["campaignId", "occurredAt"])
    .index("by_provider_event", ["providerMessageId", "eventType"])
    .index("by_recipient_campaign_event", ["recipientEmail", "campaignId", "eventType"])
    .index("by_tenant_sendtype", ["tenantId", "sendType"]),

  trackedEmailStats: defineTable({
    tenantId: v.string(),
    shopId: v.optional(v.string()),
    sendType: v.string(),
    campaignId: v.string(),
    status: v.string(),
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
    suppressed: v.optional(v.number()),
    unsubscribed: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    lastEventAt: v.optional(v.number()),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_shop", ["tenantId", "shopId"])
    .index("by_tenant_sendtype", ["tenantId", "sendType"]),

  // ── Legacy newsletter tables (kept until migration verified) ────────────
  // TODO: remove after migrateNewsletterToTrackedEmail run + verified in prod.
  newsletterSends: defineTable({
    tenantId: v.string(),
    newsletterId: v.string(),
    groupUUID: v.string(), // Batch group identifier from Trigger.dev
    recipientEmail: v.string(),
    recipientId: v.optional(v.string()), // Contact ID from PostgreSQL
    recipientName: v.optional(v.string()),
    providerMessageId: v.optional(v.string()), // Resend email ID
    status: v.string(), // 'queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'complained', 'suppressed'
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
    .index("by_recipient_and_newsletter", ["recipientEmail", "newsletterId"])
    .index("by_status", ["newsletterId", "status"])
    .index("by_recipient_email", ["recipientEmail"])
    .index("by_newsletter_recipient", ["newsletterId", "recipientEmail"]),

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
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_newsletter", ["tenantId", "newsletterId"])
    .index("by_send", ["newsletterSendId"])
    .index("by_type", ["newsletterId", "eventType"])
    .index("by_occurred", ["newsletterId", "occurredAt"])
    .index("by_provider_event", ["providerMessageId", "eventType"])
    .index("by_recipient_newsletter_event", ["recipientEmail", "newsletterId", "eventType"]),

  // Lightweight mirror of PostgreSQL newsletters for real-time kanban updates.
  // Only stores fields the kanban card displays — no content/puckData.
  newsletterListItems: defineTable({
    tenantId: v.string(),
    shopId: v.optional(v.string()),
    newsletterId: v.string(), // PostgreSQL newsletter.id
    title: v.string(),
    subject: v.string(),
    status: v.string(), // draft, ready_to_send, pending_review, scheduled, sending, sent
    emailType: v.string(), // newsletter, advertise
    recipientCount: v.number(),
    openCount: v.number(),
    uniqueOpenCount: v.number(),
    clickCount: v.number(),
    reviewStatus: v.optional(v.string()), // pending, approved, rejected
    reviewerId: v.optional(v.string()),
    reviewNotes: v.optional(v.string()),
    scheduledAt: v.optional(v.number()), // timestamp ms
    sentAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    authorFirstName: v.optional(v.string()),
    authorLastName: v.optional(v.string()),
    recipientType: v.optional(v.string()), // all, selected, tags
  })
    .index("by_tenant", ["tenantId"])
    .index("by_newsletter", ["newsletterId"])
    .index("by_tenant_shop", ["tenantId", "shopId"]),

  // Aggregated real-time stats per newsletter (updated on each event)
  newsletterStats: defineTable({
    tenantId: v.string(),
    shopId: v.optional(v.string()),
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
    suppressed: v.optional(v.number()),
    unsubscribed: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    lastEventAt: v.optional(v.number()),
  })
    .index("by_newsletter", ["newsletterId"])
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_shop", ["tenantId", "shopId"]),
});
