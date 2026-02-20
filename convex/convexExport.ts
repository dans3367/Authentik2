import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Export queries for syncing Convex data to PostgreSQL.
 * Uses cursor-based pagination to avoid unbounded memory usage.
 */

const DEFAULT_EXPORT_PAGE_SIZE = 500;
const MAX_EXPORT_PAGE_SIZE = 2000;

function getPageSize(limit?: number) {
  if (!limit) return DEFAULT_EXPORT_PAGE_SIZE;
  return Math.min(Math.max(Math.floor(limit), 1), MAX_EXPORT_PAGE_SIZE);
}

export const exportAllSends = query({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.query("newsletterSends").paginate({
      cursor: args.cursor ?? null,
      numItems: getPageSize(args.limit),
    });
  },
});

export const exportAllEvents = query({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.query("newsletterEvents").paginate({
      cursor: args.cursor ?? null,
      numItems: getPageSize(args.limit),
    });
  },
});

export const exportAllStats = query({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.query("newsletterStats").paginate({
      cursor: args.cursor ?? null,
      numItems: getPageSize(args.limit),
    });
  },
});
