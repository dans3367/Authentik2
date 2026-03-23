import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ─── MUTATIONS ───────────────────────────────────────────────────────────────

/**
 * Upsert a newsletter list item.
 * Lookup by newsletterId index; patch if exists, insert if not.
 * Single write path used by all backend routes.
 */
export const upsertItem = mutation({
  args: {
    tenantId: v.string(),
    shopId: v.optional(v.string()),
    newsletterId: v.string(),
    title: v.string(),
    subject: v.string(),
    status: v.string(),
    emailType: v.string(),
    recipientCount: v.number(),
    openCount: v.number(),
    uniqueOpenCount: v.number(),
    clickCount: v.number(),
    reviewStatus: v.optional(v.string()),
    reviewerId: v.optional(v.string()),
    reviewNotes: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    authorFirstName: v.optional(v.string()),
    authorLastName: v.optional(v.string()),
    recipientType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("newsletterListItems")
      .withIndex("by_newsletter", (q) => q.eq("newsletterId", args.newsletterId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tenantId: args.tenantId,
        shopId: args.shopId,
        title: args.title,
        subject: args.subject,
        status: args.status,
        emailType: args.emailType,
        recipientCount: args.recipientCount,
        openCount: args.openCount,
        uniqueOpenCount: args.uniqueOpenCount,
        clickCount: args.clickCount,
        reviewStatus: args.reviewStatus,
        reviewerId: args.reviewerId,
        reviewNotes: args.reviewNotes,
        scheduledAt: args.scheduledAt,
        sentAt: args.sentAt,
        createdAt: args.createdAt,
        updatedAt: args.updatedAt,
        archivedAt: args.archivedAt,
        deletedAt: args.deletedAt,
        authorFirstName: args.authorFirstName,
        authorLastName: args.authorLastName,
        recipientType: args.recipientType,
      });
      return existing._id;
    }

    return await ctx.db.insert("newsletterListItems", args);
  },
});

/**
 * Hard-delete the row (for hard-deleted drafts).
 */
export const removeItem = mutation({
  args: {
    newsletterId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("newsletterListItems")
      .withIndex("by_newsletter", (q) => q.eq("newsletterId", args.newsletterId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// ─── QUERIES ─────────────────────────────────────────────────────────────────

/**
 * Returns all newsletter list items for a tenant, optionally filtered by shop.
 * Filters out deletedAt items. If archived is false (default), also filters out archivedAt items.
 * Sorted by updatedAt desc.
 */
export const listByTenant = query({
  args: {
    tenantId: v.string(),
    shopId: v.optional(v.string()),
    archived: v.optional(v.boolean()),
    emailType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("newsletterListItems")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const showArchived = args.archived ?? false;
    const emailTypeFilter = args.emailType ?? "newsletter";
    const shopIdFilter = args.shopId;

    return items
      .filter((item) => {
        // Filter by shopId if provided
        if (shopIdFilter && item.shopId !== shopIdFilter) return false;
        // Filter by emailType
        if (item.emailType !== emailTypeFilter) return false;
        // Always filter out deleted items
        if (item.deletedAt) return false;
        // Filter out archived items unless archived=true
        if (!showArchived && item.archivedAt) return false;
        if (showArchived && !item.archivedAt) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});
