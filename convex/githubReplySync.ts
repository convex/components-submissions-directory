// GitHub reply sync: mirrors submitter replies on issues we opened back into
// the package's private message thread, lights the admin bell, and posts to
// Slack.
//
// Why polling: issues live on submitters' repos, so per repo webhooks are not
// an option. The token user is auto subscribed to every issue it opens, so
// GET /notifications?participating=true returns replies across every repo in
// one request. GitHub answers 304 for free when nothing changed and tells us
// how often to poll via X-Poll-Interval.
//
// Token requirement: the notifications endpoints only accept a personal
// access token (classic) with the `notifications` scope. Fine grained tokens
// are rejected. We try GITHUB_NOTIFICATIONS_TOKEN first, then GITHUB_TOKEN.

import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { getAdminIdentity, requireAdminIdentity } from "./auth";
import {
  GITHUB_API,
  getGitHubIssueState,
  githubHeaders,
  issueKeyFromUrl,
  parseIssueKey,
} from "./githubIssues";
import { formatSlackNotification } from "./slack";
import { logUserActivity } from "./userAccess";

// ============ Constants ============

const SETTING_KEY = "githubReplySyncEnabled";
const DEFAULT_POLL_INTERVAL_SECONDS = 60;
// First poll after enabling looks back this far.
const INITIAL_LOOKBACK_MS = 24 * 60 * 60_000;
// Comments are fetched from a little before the last poll so a comment posted
// while the previous poll was running is not missed. Dedup by id handles the
// overlap.
const COMMENT_LOOKBACK_MS = 10 * 60_000;
const MAX_THREADS_PER_POLL = 50;
const MAX_COMMENTS_PER_ISSUE = 100;
const MAX_REPLIES_PER_POLL = 200;
const REQUEST_TIMEOUT_MS = 15_000;

type TokenSource = "notifications" | "default";
const tokenSourceValidator = v.union(
  v.literal("notifications"),
  v.literal("default"),
);

// ============ Token helpers ============

function resolveTokens(): Array<{ source: TokenSource; token: string }> {
  const tokens: Array<{ source: TokenSource; token: string }> = [];
  const notifications = process.env.GITHUB_NOTIFICATIONS_TOKEN?.trim();
  const fallback = process.env.GITHUB_TOKEN?.trim();
  if (notifications) tokens.push({ source: "notifications", token: notifications });
  if (fallback && fallback !== notifications) {
    tokens.push({ source: "default", token: fallback });
  }
  return tokens;
}

async function githubGet(
  path: string,
  token: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    headers: { ...githubHeaders(token), ...extraHeaders },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function fetchTokenLogin(token: string): Promise<string | null> {
  try {
    const response = await githubGet("/user", token);
    if (!response.ok) return null;
    const data = (await response.json()) as { login?: unknown };
    return typeof data.login === "string" ? data.login : null;
  } catch {
    return null;
  }
}

// Turns a failed /notifications response into the sentence the admin sees.
function describeNotificationsFailure(status: number): string {
  switch (status) {
    case 401:
      return "GitHub rejected the token (401). Check GITHUB_NOTIFICATIONS_TOKEN or GITHUB_TOKEN.";
    case 403:
      return "GitHub refused access to notifications (403). Use a personal access token (classic) with the notifications scope; fine grained tokens are not accepted for this endpoint.";
    case 404:
      return "Notifications endpoint returned 404. This usually means the token is fine grained or lacks the notifications scope.";
    default:
      return `GitHub returned ${status} from /notifications.`;
  }
}

// ============ Sync state singleton ============

async function getSyncStateDoc(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"githubSyncState"> | null> {
  return await ctx.db.query("githubSyncState").first();
}

async function isEnabled(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const setting = await ctx.db
    .query("adminSettings")
    .withIndex("by_key", (q) => q.eq("key", SETTING_KEY))
    .unique();
  return setting?.value ?? false;
}

const syncStateValidator = v.object({
  tokenLogin: v.optional(v.string()),
  tokenSource: v.optional(tokenSourceValidator),
  lastPolledAt: v.optional(v.number()),
  lastModified: v.optional(v.string()),
  pollIntervalSeconds: v.optional(v.number()),
  lastRunSummary: v.optional(v.string()),
  lastError: v.optional(v.string()),
});

type SyncState = {
  tokenLogin?: string;
  tokenSource?: TokenSource;
  lastPolledAt?: number;
  lastModified?: string;
  pollIntervalSeconds?: number;
  lastRunSummary?: string;
  lastError?: string;
};

function toSyncState(doc: Doc<"githubSyncState"> | null): SyncState {
  if (!doc) return {};
  return {
    tokenLogin: doc.tokenLogin,
    tokenSource: doc.tokenSource,
    lastPolledAt: doc.lastPolledAt,
    lastModified: doc.lastModified,
    pollIntervalSeconds: doc.pollIntervalSeconds,
    lastRunSummary: doc.lastRunSummary,
    lastError: doc.lastError,
  };
}

export const _getSyncState = internalQuery({
  args: {},
  returns: v.object({ enabled: v.boolean(), state: syncStateValidator }),
  handler: async (ctx) => {
    const [enabled, doc] = await Promise.all([
      isEnabled(ctx),
      getSyncStateDoc(ctx),
    ]);
    return { enabled, state: toSyncState(doc) };
  },
});

// Upsert. Pass `clearError: true` to drop a stale lastError after a good run.
export const _patchSyncState = internalMutation({
  args: {
    tokenLogin: v.optional(v.string()),
    tokenSource: v.optional(tokenSourceValidator),
    lastPolledAt: v.optional(v.number()),
    lastModified: v.optional(v.string()),
    pollIntervalSeconds: v.optional(v.number()),
    lastRunSummary: v.optional(v.string()),
    lastError: v.optional(v.string()),
    clearError: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { clearError, ...fields } = args;
    const patch: Partial<Doc<"githubSyncState">> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        (patch as Record<string, unknown>)[key] = value;
      }
    }
    if (clearError) patch.lastError = undefined;
    const existing = await getSyncStateDoc(ctx);
    if (existing) {
      await ctx.db.patch("githubSyncState", existing._id, patch);
    } else {
      await ctx.db.insert("githubSyncState", {
        ...patch,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

// ============ Matching issues to packages ============

type IssueTarget = {
  issueKey: string;
  packageId: Id<"packages">;
  broadcastId?: Id<"githubBroadcasts">;
  broadcastItemId?: Id<"githubBroadcastItems">;
};

const issueTargetValidator = v.object({
  issueKey: v.string(),
  packageId: v.id("packages"),
  broadcastId: v.optional(v.id("githubBroadcasts")),
  broadcastItemId: v.optional(v.id("githubBroadcastItems")),
});

// One query for the whole poll: thread rows first (direct conversation), then
// broadcast items. Unknown keys are simply absent from the result.
export const _findIssueTargets = internalQuery({
  args: { issueKeys: v.array(v.string()) },
  returns: v.array(issueTargetValidator),
  handler: async (ctx, args) => {
    const targets: Array<IssueTarget> = [];
    for (const issueKey of args.issueKeys) {
      const comment = await ctx.db
        .query("packageComments")
        .withIndex("by_github_issue_key", (q) => q.eq("githubIssueKey", issueKey))
        .first();
      if (comment) {
        targets.push({ issueKey, packageId: comment.packageId });
        continue;
      }
      const item = await ctx.db
        .query("githubBroadcastItems")
        .withIndex("by_issue_key", (q) => q.eq("issueKey", issueKey))
        .first();
      if (item) {
        targets.push({
          issueKey,
          packageId: item.packageId,
          broadcastId: item.broadcastId,
          broadcastItemId: item._id,
        });
      }
    }
    return targets;
  },
});

// ============ Mirroring replies ============

const incomingReplyValidator = v.object({
  issueKey: v.string(),
  packageId: v.id("packages"),
  broadcastId: v.optional(v.id("githubBroadcasts")),
  broadcastItemId: v.optional(v.id("githubBroadcastItems")),
  commentId: v.number(),
  commentUrl: v.string(),
  authorLogin: v.string(),
  body: v.string(),
  createdAt: v.number(),
});

// The submitter's own GitHub login maps to their directory email so the
// message renders as "You" on their profile. Anyone else gets GitHub's real
// noreply address form. Neither ends in @convex.dev, so every existing
// isFromAdmin and unread check treats the row as a submitter message.
function mirroredAuthorEmail(
  pkg: Doc<"packages"> | null,
  login: string,
): string {
  if (
    pkg?.submitterEmail &&
    pkg.authorUsername &&
    pkg.authorUsername.toLowerCase() === login.toLowerCase()
  ) {
    return pkg.submitterEmail;
  }
  return `${login}@users.noreply.github.com`;
}

// Idempotent on githubCommentId. Inserts the thread row, bumps broadcast
// reply counters once per broadcast, and schedules one Slack post per reply.
export const _mirrorGithubReplies = internalMutation({
  args: { replies: v.array(incomingReplyValidator) },
  returns: v.object({ inserted: v.number(), duplicates: v.number() }),
  handler: async (ctx, args) => {
    let inserted = 0;
    let duplicates = 0;
    const itemIncrements = new Map<Id<"githubBroadcastItems">, number>();
    const broadcastIncrements = new Map<Id<"githubBroadcasts">, number>();
    const packageCache = new Map<Id<"packages">, Doc<"packages"> | null>();
    const broadcastCache = new Map<
      Id<"githubBroadcasts">,
      Doc<"githubBroadcasts"> | null
    >();

    for (const reply of args.replies) {
      const existing = await ctx.db
        .query("packageComments")
        .withIndex("by_github_comment_id", (q) =>
          q.eq("githubCommentId", reply.commentId),
        )
        .first();
      if (existing) {
        duplicates += 1;
        continue;
      }

      let pkg = packageCache.get(reply.packageId);
      if (pkg === undefined) {
        pkg = await ctx.db.get("packages", reply.packageId);
        packageCache.set(reply.packageId, pkg);
      }
      if (!pkg) continue; // Package deleted since the issue was opened.

      await ctx.db.insert("packageComments", {
        packageId: reply.packageId,
        content: reply.body,
        authorEmail: mirroredAuthorEmail(pkg, reply.authorLogin),
        authorName: reply.authorLogin,
        createdAt: reply.createdAt,
        adminHasRead: false,
        userHasRead: true,
        status: "active",
        source: "github",
        githubIssueKey: reply.issueKey,
        githubCommentId: reply.commentId,
        githubCommentUrl: reply.commentUrl,
        githubAuthorLogin: reply.authorLogin,
        githubBroadcastId: reply.broadcastId,
      });
      await logUserActivity(ctx, {
        actorEmail: mirroredAuthorEmail(pkg, reply.authorLogin),
        actorName: reply.authorLogin,
        actorRole: "user",
        type: "github_reply",
        pkg,
        summary: reply.body,
        createdAt: reply.createdAt,
      });
      inserted += 1;

      if (reply.broadcastItemId) {
        itemIncrements.set(
          reply.broadcastItemId,
          (itemIncrements.get(reply.broadcastItemId) ?? 0) + 1,
        );
      }
      if (reply.broadcastId) {
        broadcastIncrements.set(
          reply.broadcastId,
          (broadcastIncrements.get(reply.broadcastId) ?? 0) + 1,
        );
      }

      let fromLabel = `@${reply.authorLogin} via GitHub`;
      if (reply.broadcastId) {
        let broadcast = broadcastCache.get(reply.broadcastId);
        if (broadcast === undefined) {
          broadcast = await ctx.db.get("githubBroadcasts", reply.broadcastId);
          broadcastCache.set(reply.broadcastId, broadcast);
        }
        if (broadcast) fromLabel += ` (broadcast: ${broadcast.title})`;
      }
      const text =
        formatSlackNotification(
          pkg,
          "New GitHub reply on",
          fromLabel,
          reply.body,
        ) + `\nGitHub: ${reply.commentUrl}`;
      await ctx.scheduler.runAfter(0, internal.slack.sendMessage, { text });
    }

    // Counters are patched once per document, after the loop, so a poll with
    // several replies on one broadcast is a single write per row.
    const counterPatches: Array<Promise<void>> = [];
    for (const [itemId, count] of itemIncrements) {
      const item = await ctx.db.get("githubBroadcastItems", itemId);
      if (item) {
        counterPatches.push(
          ctx.db.patch("githubBroadcastItems", itemId, {
            replyCount: (item.replyCount ?? 0) + count,
          }),
        );
      }
    }
    for (const [broadcastId, count] of broadcastIncrements) {
      const broadcast =
        broadcastCache.get(broadcastId) ??
        (await ctx.db.get("githubBroadcasts", broadcastId));
      if (broadcast) {
        counterPatches.push(
          ctx.db.patch("githubBroadcasts", broadcastId, {
            replies: (broadcast.replies ?? 0) + count,
          }),
        );
      }
    }
    await Promise.all(counterPatches);

    return { inserted, duplicates };
  },
});

// ============ The poller ============

type NotificationThread = {
  id: string;
  reason?: string;
  subject?: { type?: string; url?: string | null };
};

type IssueComment = {
  id: number;
  html_url: string;
  body?: string | null;
  created_at: string;
  user?: { login?: string; type?: string } | null;
};

// Cron target. Never throws for GitHub level failures; they land in
// lastError so the admin card shows them. `force` ignores the enabled flag
// and poll interval (used by Sync now) and `lookbackMs` widens the window.
export const pollNotifications = internalAction({
  args: { force: v.optional(v.boolean()), lookbackMs: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { enabled, state } = await ctx.runQuery(
      internal.githubReplySync._getSyncState,
      {},
    );
    if (!enabled && !args.force) return null;

    const now = Date.now();
    const intervalMs =
      (state.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS) * 1000;
    if (
      !args.force &&
      state.lastPolledAt !== undefined &&
      state.lastPolledAt + intervalMs > now
    ) {
      return null;
    }

    const tokens = resolveTokens();
    if (tokens.length === 0) {
      await ctx.runMutation(internal.githubReplySync._patchSyncState, {
        lastError:
          "No GitHub token configured. Set GITHUB_NOTIFICATIONS_TOKEN (classic, notifications scope) on the deployment.",
      });
      return null;
    }
    // Prefer the token that worked last time so a bad fallback is not retried
    // every poll.
    const ordered = state.tokenSource
      ? [...tokens].sort((a) => (a.source === state.tokenSource ? -1 : 1))
      : tokens;

    const lookback = args.lookbackMs ?? INITIAL_LOOKBACK_MS;
    const sinceMs = args.force
      ? now - lookback
      : (state.lastPolledAt ?? now - lookback) - COMMENT_LOOKBACK_MS;
    const since = new Date(sinceMs).toISOString();

    // Find a token that can read notifications.
    let response: Response | null = null;
    let chosen: { source: TokenSource; token: string } | null = null;
    let lastFailure = "";
    for (const candidate of ordered) {
      try {
        const headers: Record<string, string> = {};
        if (state.lastModified && !args.force) {
          headers["If-Modified-Since"] = state.lastModified;
        }
        const res = await githubGet(
          `/notifications?participating=true&since=${encodeURIComponent(since)}&per_page=${MAX_THREADS_PER_POLL}`,
          candidate.token,
          headers,
        );
        if (res.ok || res.status === 304) {
          response = res;
          chosen = candidate;
          break;
        }
        lastFailure = describeNotificationsFailure(res.status);
      } catch (error) {
        lastFailure = `Network error reaching GitHub: ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    }
    if (!response || !chosen) {
      await ctx.runMutation(internal.githubReplySync._patchSyncState, {
        lastPolledAt: now,
        lastError: lastFailure || "Could not reach GitHub notifications.",
      });
      return null;
    }

    const pollHeader = Number(response.headers.get("x-poll-interval"));
    const pollIntervalSeconds =
      Number.isFinite(pollHeader) && pollHeader > 0
        ? pollHeader
        : DEFAULT_POLL_INTERVAL_SECONDS;
    const lastModified = response.headers.get("last-modified") ?? undefined;

    // Cache the login the first time a token works, or when the source changed.
    let tokenLogin = state.tokenLogin;
    if (!tokenLogin || state.tokenSource !== chosen.source) {
      tokenLogin = (await fetchTokenLogin(chosen.token)) ?? undefined;
    }

    if (response.status === 304) {
      await ctx.runMutation(internal.githubReplySync._patchSyncState, {
        tokenLogin,
        tokenSource: chosen.source,
        lastPolledAt: now,
        pollIntervalSeconds,
        lastRunSummary: "No new notifications",
        clearError: true,
      });
      return null;
    }

    const threads = (await response.json()) as Array<NotificationThread>;
    const issueThreads = threads
      .map((thread) => ({
        thread,
        issueKey:
          thread.subject?.type === "Issue"
            ? issueKeyFromUrl(thread.subject.url)
            : null,
      }))
      .filter(
        (entry): entry is { thread: NotificationThread; issueKey: string } =>
          entry.issueKey !== null,
      );

    const targets: Array<IssueTarget> =
      issueThreads.length > 0
        ? await ctx.runQuery(internal.githubReplySync._findIssueTargets, {
            issueKeys: Array.from(new Set(issueThreads.map((t) => t.issueKey))),
          })
        : [];
    const targetByKey = new Map(targets.map((t) => [t.issueKey, t]));

    const replies: Array<{
      issueKey: string;
      packageId: Id<"packages">;
      broadcastId?: Id<"githubBroadcasts">;
      broadcastItemId?: Id<"githubBroadcastItems">;
      commentId: number;
      commentUrl: string;
      authorLogin: string;
      body: string;
      createdAt: number;
    }> = [];
    const handledThreadIds: Array<string> = [];
    let unmatched = threads.length - issueThreads.length;
    let stateChanges = 0;
    let fetchErrors = 0;

    for (const { thread, issueKey } of issueThreads) {
      const target = targetByKey.get(issueKey);
      const ref = parseIssueKey(issueKey);
      if (!target || !ref) {
        unmatched += 1;
        continue; // Not ours. Leave the notification unread.
      }

      // Closed or reopened: refresh the stored state so the admin checkbox
      // knows whether the next message becomes a comment or a new issue.
      if (thread.reason === "state_change") {
        const issueState = await getGitHubIssueState(ref, chosen.token);
        if (issueState) {
          await ctx.runMutation(internal.githubIssues._setIssueState, {
            issueKey,
            state: issueState,
          });
          stateChanges += 1;
        }
      }

      try {
        const res = await githubGet(
          `/repos/${ref.owner}/${ref.repo}/issues/${ref.number}/comments?since=${encodeURIComponent(since)}&per_page=${MAX_COMMENTS_PER_ISSUE}`,
          chosen.token,
        );
        if (!res.ok) {
          fetchErrors += 1;
          continue;
        }
        const comments = (await res.json()) as Array<IssueComment>;
        for (const comment of comments) {
          const login = comment.user?.login;
          if (!login) continue;
          // Loop prevention: never mirror our own issue body echoes or bots.
          if (tokenLogin && login.toLowerCase() === tokenLogin.toLowerCase()) {
            continue;
          }
          if (comment.user?.type === "Bot") continue;
          const body = (comment.body ?? "").trim();
          if (!body) continue;
          replies.push({
            issueKey,
            packageId: target.packageId,
            broadcastId: target.broadcastId,
            broadcastItemId: target.broadcastItemId,
            commentId: comment.id,
            commentUrl: comment.html_url,
            authorLogin: login,
            body,
            createdAt: Date.parse(comment.created_at) || now,
          });
          if (replies.length >= MAX_REPLIES_PER_POLL) break;
        }
        handledThreadIds.push(thread.id);
      } catch {
        fetchErrors += 1;
      }
      if (replies.length >= MAX_REPLIES_PER_POLL) break;
    }

    let inserted = 0;
    let duplicates = 0;
    if (replies.length > 0) {
      const result = await ctx.runMutation(
        internal.githubReplySync._mirrorGithubReplies,
        { replies },
      );
      inserted = result.inserted;
      duplicates = result.duplicates;
    }

    // Mark handled threads read so they drop out of the next poll. Best
    // effort: a failure here only means we see the thread again and dedupe.
    await Promise.all(
      handledThreadIds.map((id) =>
        fetch(`${GITHUB_API}/notifications/threads/${id}`, {
          method: "PATCH",
          headers: githubHeaders(chosen.token),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }).catch(() => undefined),
      ),
    );

    const parts = [
      `${issueThreads.length} issue thread${issueThreads.length === 1 ? "" : "s"}`,
      `${inserted} new repl${inserted === 1 ? "y" : "ies"}`,
    ];
    if (duplicates > 0) parts.push(`${duplicates} already synced`);
    if (unmatched > 0) parts.push(`${unmatched} unmatched`);
    if (stateChanges > 0) parts.push(`${stateChanges} state change${stateChanges === 1 ? "" : "s"}`);
    if (fetchErrors > 0) parts.push(`${fetchErrors} fetch error${fetchErrors === 1 ? "" : "s"}`);

    await ctx.runMutation(internal.githubReplySync._patchSyncState, {
      tokenLogin,
      tokenSource: chosen.source,
      lastPolledAt: now,
      lastModified,
      pollIntervalSeconds,
      lastRunSummary: parts.join(", "),
      clearError: true,
    });
    return null;
  },
});

// ============ Admin controls ============

const testResultValidator = v.object({
  ok: v.boolean(),
  login: v.optional(v.string()),
  source: v.optional(tokenSourceValidator),
  message: v.string(),
});

// Tries each token against /user and /notifications so the admin learns in
// one click which token works and which login the issues will come from.
export const testConnection = action({
  args: {},
  returns: testResultValidator,
  handler: async (ctx) => {
    await requireAdminIdentity(ctx);
    const tokens = resolveTokens();
    if (tokens.length === 0) {
      return {
        ok: false,
        message:
          "No GitHub token configured. Set GITHUB_NOTIFICATIONS_TOKEN (personal access token, classic, with the notifications scope).",
      };
    }

    const failures: Array<string> = [];
    for (const candidate of tokens) {
      const label =
        candidate.source === "notifications"
          ? "GITHUB_NOTIFICATIONS_TOKEN"
          : "GITHUB_TOKEN";
      const login = await fetchTokenLogin(candidate.token);
      if (!login) {
        failures.push(`${label}: GitHub rejected the token on /user.`);
        continue;
      }
      let status = 0;
      try {
        const res = await githubGet(
          "/notifications?participating=true&per_page=1",
          candidate.token,
        );
        status = res.status;
      } catch (error) {
        failures.push(
          `${label}: network error (${error instanceof Error ? error.message : String(error)}).`,
        );
        continue;
      }
      if (status === 200 || status === 304) {
        await ctx.runMutation(internal.githubReplySync._patchSyncState, {
          tokenLogin: login,
          tokenSource: candidate.source,
          clearError: true,
        });
        return {
          ok: true,
          login,
          source: candidate.source,
          message: `Connected as @${login} using ${label}. Notifications scope OK.`,
        };
      }
      failures.push(`${label} (@${login}): ${describeNotificationsFailure(status)}`);
    }

    const message = failures.join(" ");
    await ctx.runMutation(internal.githubReplySync._patchSyncState, {
      lastError: message,
    });
    return { ok: false, message };
  },
});

// Runs one poll now, ignoring the enabled flag and interval, with a 24 hour
// window. Useful right after enabling or when a reply is known to be waiting.
export const syncNow = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdminIdentity(ctx);
    await ctx.scheduler.runAfter(0, internal.githubReplySync.pollNotifications, {
      force: true,
      lookbackMs: INITIAL_LOOKBACK_MS,
    });
    return null;
  },
});

export const getSyncStatus = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      enabled: v.boolean(),
      notificationsTokenConfigured: v.boolean(),
      defaultTokenConfigured: v.boolean(),
      state: syncStateValidator,
    }),
  ),
  handler: async (ctx) => {
    const admin = await getAdminIdentity(ctx);
    if (!admin) return null;
    const [enabled, doc] = await Promise.all([
      isEnabled(ctx),
      getSyncStateDoc(ctx),
    ]);
    return {
      enabled,
      notificationsTokenConfigured: Boolean(
        process.env.GITHUB_NOTIFICATIONS_TOKEN?.trim(),
      ),
      defaultTokenConfigured: Boolean(process.env.GITHUB_TOKEN?.trim()),
      state: toSyncState(doc),
    };
  },
});

export const setReplySyncEnabled = mutation({
  args: { enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminIdentity(ctx);
    const existing = await ctx.db
      .query("adminSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTING_KEY))
      .unique();
    if (existing) {
      if (existing.value === args.enabled) return null;
      await ctx.db.patch("adminSettings", existing._id, { value: args.enabled });
    } else {
      await ctx.db.insert("adminSettings", {
        key: SETTING_KEY,
        value: args.enabled,
      });
    }
    // Turning it on triggers a catch up poll so the admin sees results fast.
    if (args.enabled) {
      await ctx.scheduler.runAfter(
        0,
        internal.githubReplySync.pollNotifications,
        { force: true, lookbackMs: INITIAL_LOOKBACK_MS },
      );
    }
    return null;
  },
});
