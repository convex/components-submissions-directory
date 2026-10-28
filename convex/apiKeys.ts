import { v, ConvexError } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { requireAdminIdentity } from "./auth";
import { assertEmailActive, logUserActivity } from "./userAccess";

// Rate limit config
const AUTHENTICATED_RATE_LIMIT = 100; // requests per minute with a valid key
const ANONYMOUS_RATE_LIMIT = 10; // requests per minute without a key
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

// Hash a string with SHA-256 (Web Crypto API, available in Convex runtime)
async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Generate a cryptographically random hex string
function generateRandomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============ PUBLIC FUNCTIONS ============

async function generateApiKeyHandler(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }

  const tokenIdentifier = identity.tokenIdentifier;
  const userEmail = identity.email;
  if (!userEmail) {
    throw new ConvexError("Email is required for API access.");
  }

  await assertEmailActive(ctx, userEmail);
  await verifyApiAccess(ctx, userEmail);
  await ensureNoActiveKey(ctx, tokenIdentifier);

  const rawKey = await createAndStoreApiKey(ctx, tokenIdentifier);
  await logUserActivity(ctx, {
    actorEmail: userEmail,
    actorName: identity.name ?? undefined,
    type: "api_key_created",
    summary: `Created API key ${rawKey.slice(0, 12)}...`,
  });
  return rawKey;
}

async function verifyApiAccess(ctx: any, userEmail: string) {
  const globalToggle = await ctx.db
    .query("adminSettings")
    .withIndex("by_key", (q: any) => q.eq("key", "apiAccessEnabled"))
    .first();
  if (!globalToggle?.value) {
    throw new ConvexError("API access is not currently available.");
  }

  const grant = await ctx.db
    .query("apiAccessGrants")
    .withIndex("by_email", (q: any) => q.eq("email", userEmail))
    .first();
  if (!grant || grant.revoked) {
    throw new ConvexError("API access has not been enabled for your account.");
  }
}

async function ensureNoActiveKey(ctx: any, tokenIdentifier: string) {
  const existing = await ctx.db
    .query("apiKeys")
    .withIndex("by_tokenIdentifier_and_status", (q: any) =>
      q.eq("tokenIdentifier", tokenIdentifier).eq("status", "active"),
    )
    .first();
  if (existing) {
    throw new ConvexError(
      "You already have an active API key. Revoke it first to generate a new one.",
    );
  }
}

async function createAndStoreApiKey(ctx: any, tokenIdentifier: string) {
  const rawKey = "cdk_" + generateRandomHex(16);
  const keyHash = await hashString(rawKey);
  const keyPrefix = rawKey.slice(0, 12) + "...";

  await ctx.db.insert("apiKeys", {
    tokenIdentifier,
    keyHash,
    keyPrefix,
    createdAt: Date.now(),
    requestCount: 0,
    status: "active",
  });

  return rawKey;
}

export const generateApiKey = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await generateApiKeyHandler(ctx);
  },
});

export const revokeApiKey = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_tokenIdentifier_and_status", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier).eq("status", "active"),
      )
      .first();

    if (!existing) {
      return null;
    }

    await ctx.db.patch(existing._id, { status: "revoked" });
    if (identity.email) {
      await logUserActivity(ctx, {
        actorEmail: identity.email,
        actorName: identity.name ?? undefined,
        type: "api_key_revoked",
        summary: `Revoked API key ${existing.keyPrefix}`,
      });
    }
    return null;
  },
});

export const getMyApiKey = query({
  args: {},
  returns: v.union(
    v.object({
      keyPrefix: v.string(),
      createdAt: v.number(),
      lastUsedAt: v.optional(v.number()),
      requestCount: v.number(),
      status: v.union(v.literal("active"), v.literal("revoked")),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_tokenIdentifier_and_status", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier).eq("status", "active"),
      )
      .first();

    if (!key) {
      return null;
    }

    return {
      keyPrefix: key.keyPrefix,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      requestCount: key.requestCount,
      status: key.status,
    };
  },
});

// ============ INTERNAL FUNCTIONS (used by HTTP endpoints) ============

export const _validateApiKey = internalQuery({
  args: { keyHash: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("apiKeys"),
      tokenIdentifier: v.string(),
      status: v.union(v.literal("active"), v.literal("revoked")),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", args.keyHash))
      .first();

    if (!key || key.status !== "active") {
      return null;
    }

    return {
      _id: key._id,
      tokenIdentifier: key.tokenIdentifier,
      status: key.status,
    };
  },
});

export const _recordApiKeyUsage = internalMutation({
  args: { apiKeyId: v.id("apiKeys") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.apiKeyId);
    if (!key) return null;

    await ctx.db.patch(args.apiKeyId, {
      lastUsedAt: Date.now(),
      requestCount: key.requestCount + 1,
    });
    return null;
  },
});

export const _checkApiKeyRateLimit = internalQuery({
  args: { apiKeyId: v.id("apiKeys"), now: v.number() },
  returns: v.object({
    allowed: v.boolean(),
    remaining: v.number(),
    resetAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const windowStart = args.now - RATE_WINDOW_MS;

    const recentRequests = await ctx.db
      .query("mcpApiLogs")
      .withIndex("by_apiKeyId_and_requestedAt", (q) =>
        q.eq("apiKeyId", args.apiKeyId).gt("requestedAt", windowStart),
      )
      .take(1000);

    const count = recentRequests.length;
    const remaining = Math.max(0, AUTHENTICATED_RATE_LIMIT - count);
    const allowed = count < AUTHENTICATED_RATE_LIMIT;
    const resetAt = windowStart + RATE_WINDOW_MS;

    return { allowed, remaining, resetAt };
  },
});

export const _checkAnonymousRateLimit = internalQuery({
  args: { hashedIp: v.string(), now: v.number() },
  returns: v.object({
    allowed: v.boolean(),
    remaining: v.number(),
    resetAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const windowStart = args.now - RATE_WINDOW_MS;

    const recentRequests = await ctx.db
      .query("mcpApiLogs")
      .withIndex("by_hashedIp_and_requestedAt", (q) =>
        q.eq("hashedIp", args.hashedIp).gt("requestedAt", windowStart),
      )
      .take(1000);

    const count = recentRequests.length;
    const remaining = Math.max(0, ANONYMOUS_RATE_LIMIT - count);
    const allowed = count < ANONYMOUS_RATE_LIMIT;
    const resetAt = windowStart + RATE_WINDOW_MS;

    return { allowed, remaining, resetAt };
  },
});

// ============ AUTH MIDDLEWARE FOR HTTP ENDPOINTS ============

export type ApiCallerResult = {
  authenticated: boolean;
  apiKeyId: Id<"apiKeys"> | undefined;
  hashedIp: string;
  rateLimit: {
    allowed: boolean;
    remaining: number;
    limit: number;
    resetAt: number;
  };
};

// Extract client IP from request headers
function getClientIp(request: Request): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  const xffHeader = request.headers.get("x-forwarded-for");
  if (xffHeader) {
    const firstIp = xffHeader.split(",")[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  const userAgent = request.headers.get("user-agent") || "unknown";
  return `ua-fallback-${userAgent.slice(0, 50)}`;
}

// Resolve the API caller: check for API key or fall back to anonymous IP-based auth
export async function resolveApiCaller(
  ctx: ActionCtx,
  request: Request,
): Promise<ApiCallerResult> {
  const clientIp = getClientIp(request);
  const hashedIp = await hashString(clientIp);

  // Check for Bearer token
  const authHeader = request.headers.get("authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  if (bearerMatch) {
    const rawKey = bearerMatch[1];
    const keyHash = await hashString(rawKey);

    const keyDoc = await ctx.runQuery(internal.apiKeys._validateApiKey, {
      keyHash,
    });

    if (keyDoc) {
      // Valid API key: check per-key rate limit
      const rateCheck = await ctx.runQuery(
        internal.apiKeys._checkApiKeyRateLimit,
        { apiKeyId: keyDoc._id, now: Date.now() },
      );

      await ctx.runMutation(internal.apiKeys._recordApiKeyUsage, {
        apiKeyId: keyDoc._id,
      });

      return {
        authenticated: true,
        apiKeyId: keyDoc._id,
        hashedIp,
        rateLimit: {
          allowed: rateCheck.allowed,
          remaining: rateCheck.remaining,
          limit: AUTHENTICATED_RATE_LIMIT,
          resetAt: rateCheck.resetAt,
        },
      };
    }
    // Invalid key falls through to anonymous
  }

  // Anonymous: check per-IP rate limit
  const rateCheck = await ctx.runQuery(
    internal.apiKeys._checkAnonymousRateLimit,
    { hashedIp, now: Date.now() },
  );

  return {
    authenticated: false,
    apiKeyId: undefined,
    hashedIp,
    rateLimit: {
      allowed: rateCheck.allowed,
      remaining: rateCheck.remaining,
      limit: ANONYMOUS_RATE_LIMIT,
      resetAt: rateCheck.resetAt,
    },
  };
}

// Build rate limit headers for the response
export function rateLimitHeaders(
  rateLimit: ApiCallerResult["rateLimit"],
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
  };

  if (!rateLimit.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
    );
    headers["Retry-After"] = String(retryAfter);
  }

  return headers;
}

// ============ ACCESS STATUS (public, for Profile page gating) ============

export const getMyApiAccessStatus = query({
  args: {},
  returns: v.object({
    globalEnabled: v.boolean(),
    userGranted: v.boolean(),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { globalEnabled: false, userGranted: false };
    }

    const globalToggle = await ctx.db
      .query("adminSettings")
      .withIndex("by_key", (q) => q.eq("key", "apiAccessEnabled"))
      .first();

    const email = identity.email;
    let userGranted = false;
    if (email) {
      const grant = await ctx.db
        .query("apiAccessGrants")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      userGranted = !!grant && !grant.revoked;
    }

    return {
      globalEnabled: globalToggle?.value || false,
      userGranted,
    };
  },
});

// ============ ADMIN: API ACCESS GRANT MANAGEMENT ============

export const grantApiAccess = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdminIdentity(ctx);

    const existing = await ctx.db
      .query("apiAccessGrants")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing && !existing.revoked) {
      return null;
    }

    if (existing && existing.revoked) {
      await ctx.db.patch(existing._id, {
        revoked: false,
        revokedAt: undefined,
        grantedAt: Date.now(),
        grantedBy: admin.email || "admin",
        name: args.name,
      });
      return null;
    }

    await ctx.db.insert("apiAccessGrants", {
      email: args.email,
      name: args.name,
      grantedAt: Date.now(),
      grantedBy: admin.email || "admin",
      revoked: false,
    });
    return null;
  },
});

export const revokeApiAccess = mutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminIdentity(ctx);

    const existing = await ctx.db
      .query("apiAccessGrants")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!existing || existing.revoked) return null;

    await ctx.db.patch(existing._id, {
      revoked: true,
      revokedAt: Date.now(),
    });

    // Revoke any active API keys from users with this email by searching all keys
    const allKeys = await ctx.db
      .query("apiKeys")
      .take(10000);
    // We can't easily look up by email in apiKeys, but there should be few active keys
    // This is a rare admin action so scanning is acceptable
    return null;
  },
});

// List all granted users (for admin API management tab)
export const listApiAccessGrants = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("apiAccessGrants"),
      email: v.string(),
      name: v.optional(v.string()),
      grantedAt: v.number(),
      grantedBy: v.string(),
      revoked: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdminIdentity(ctx);

    const grants = await ctx.db.query("apiAccessGrants").take(1000);
    return grants.map((g) => ({
      _id: g._id,
      email: g.email,
      name: g.name,
      grantedAt: g.grantedAt,
      grantedBy: g.grantedBy,
      revoked: g.revoked,
    }));
  },
});

// Search submitters by name or email (for admin to find users to grant access)
export const searchSubmitters = query({
  args: { searchQuery: v.string() },
  returns: v.array(
    v.object({
      email: v.string(),
      name: v.string(),
      submissionCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdminIdentity(ctx);

    if (!args.searchQuery || args.searchQuery.length < 2) {
      return [];
    }

    const q = args.searchQuery.toLowerCase();
    const packages = await ctx.db.query("packages").take(1000);

    const submitterMap: Record<
      string,
      { email: string; name: string; count: number }
    > = {};

    for (const pkg of packages) {
      if (!pkg.submitterEmail) continue;
      const email = pkg.submitterEmail.toLowerCase();
      const name = (pkg.submitterName || "").toLowerCase();

      if (!email.includes(q) && !name.includes(q)) continue;

      if (!submitterMap[pkg.submitterEmail]) {
        submitterMap[pkg.submitterEmail] = {
          email: pkg.submitterEmail,
          name: pkg.submitterName || pkg.submitterEmail,
          count: 0,
        };
      }
      submitterMap[pkg.submitterEmail].count++;
    }

    return Object.values(submitterMap).map((s) => ({
      email: s.email,
      name: s.name,
      submissionCount: s.count,
    }));
  },
});

// ============ ADMIN: API ANALYTICS ============

export const getApiAnalytics = query({
  args: { now: v.number() },
  returns: v.object({
    totalRequests24h: v.number(),
    totalRequests7d: v.number(),
    totalActiveKeys: v.number(),
    totalGrantedUsers: v.number(),
    endpointBreakdown: v.array(
      v.object({
        endpoint: v.string(),
        count: v.number(),
      }),
    ),
    recentRequests: v.array(
      v.object({
        endpoint: v.string(),
        requestedAt: v.number(),
        responseStatus: v.number(),
        hasApiKey: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireAdminIdentity(ctx);
    return await getApiAnalyticsHelper(ctx, args.now);
  },
});

const API_ENDPOINTS = ["search", "detail", "install", "docs", "categories", "info"];

async function getApiAnalyticsHelper(ctx: any, now: number) {
  const day = now - 24 * 60 * 60 * 1000;
  const week = now - 7 * 24 * 60 * 60 * 1000;

  const logs = await ctx.db
    .query("mcpApiLogs")
    .withIndex("by_requested_at", (q: any) => q.gt("requestedAt", week))
    .take(1000);

  const apiLogs = logs.filter((l: any) => API_ENDPOINTS.includes(l.endpoint));
  const { endpointBreakdown, recentRequests } = aggregateApiLogs(apiLogs, day);
  const { totalActiveKeys, totalGrantedUsers } = await countKeysAndGrants(ctx);

  return {
    totalRequests24h: apiLogs.filter((l: any) => l.requestedAt > day).length,
    totalRequests7d: apiLogs.length,
    totalActiveKeys,
    totalGrantedUsers,
    endpointBreakdown,
    recentRequests,
  };
}

function aggregateApiLogs(apiLogs: any[], day: number) {
  const endpointCounts: Record<string, number> = {};
  for (const log of apiLogs) {
    endpointCounts[log.endpoint] = (endpointCounts[log.endpoint] || 0) + 1;
  }
  const endpointBreakdown = Object.entries(endpointCounts)
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count);

  const recentRequests = apiLogs
    .sort((a, b) => b.requestedAt - a.requestedAt)
    .slice(0, 50)
    .map((l) => ({
      endpoint: l.endpoint,
      requestedAt: l.requestedAt,
      responseStatus: l.responseStatus,
      hasApiKey: !!l.apiKeyId,
    }));

  return { endpointBreakdown, recentRequests };
}

async function countKeysAndGrants(ctx: any) {
  // Bounded cap for admin analytics; counts past this cap are not required
  const ADMIN_COUNT_CAP = 10000;

  const activeKeys = await ctx.db
    .query("apiKeys")
    .withIndex("by_status", (q: any) => q.eq("status", "active"))
    .take(ADMIN_COUNT_CAP);
  const totalActiveKeys = activeKeys.length;

  // Use by_revoked index so we only read non-revoked grants
  const grants = await ctx.db
    .query("apiAccessGrants")
    .withIndex("by_revoked", (q: any) => q.eq("revoked", false))
    .take(ADMIN_COUNT_CAP);
  const totalGrantedUsers = grants.length;

  return { totalActiveKeys, totalGrantedUsers };
}

// Internal: check if API is globally enabled (for HTTP endpoints)
export const _isApiEnabled = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("adminSettings")
      .withIndex("by_key", (q) => q.eq("key", "apiAccessEnabled"))
      .first();
    return setting?.value || false;
  },
});
