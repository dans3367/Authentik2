import { query } from "./_generated/server";

/**
 * Export queries for syncing Convex data to PostgreSQL.
 * These are intentionally simple .collect() queries for bulk export.
 */

export const exportAllSends = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("newsletterSends").collect();
    },
});

export const exportAllEvents = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("newsletterEvents").collect();
    },
});

export const exportAllStats = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("newsletterStats").collect();
    },
});
