import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { getAccountBlockMessage } from "./userAccess";

const CONTENT_GENERATION_WINDOW_MS = 60 * 60 * 1000;
const MAX_CONTENT_GENERATIONS_PER_WINDOW = 5;

export const _checkRateLimit = internalQuery({
  args: {
    userKey: v.string(),
    now: v.number(),
    email: v.optional(v.string()),
  },
  returns: v.object({
    allowed: v.boolean(),
    resetAt: v.optional(v.number()),
    blockedMessage: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Deactivated and banned accounts cannot spend AI generations
    if (args.email) {
      const blockedMessage = await getAccountBlockMessage(ctx, args.email);
      if (blockedMessage) return { allowed: false, blockedMessage };
    }

    const windowStart = args.now - CONTENT_GENERATION_WINDOW_MS;

    const recentRequests = await ctx.db
      .query("contentGenerationRequests")
      .withIndex("by_userKey_and_createdAt", (q) =>
        q.eq("userKey", args.userKey).gt("createdAt", windowStart),
      )
      .take(1000);

    const allowed = recentRequests.length < MAX_CONTENT_GENERATIONS_PER_WINDOW;

    if (allowed || recentRequests.length === 0) {
      return { allowed, resetAt: undefined };
    }

    const oldestRequest = recentRequests.reduce((oldest, current) =>
      current.createdAt < oldest.createdAt ? current : oldest,
    );

    return {
      allowed,
      resetAt: oldestRequest.createdAt + CONTENT_GENERATION_WINDOW_MS,
    };
  },
});

export const _recordRequest = internalMutation({
  args: {
    userKey: v.string(),
    source: v.union(v.literal("submit"), v.literal("profile")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("contentGenerationRequests", {
      userKey: args.userKey,
      source: args.source,
      createdAt: Date.now(),
    });
    return null;
  },
});
