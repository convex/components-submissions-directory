// Admin Users tab plus the signed-in user's own account status.
// The write gate itself lives in userAccess.ts (assertEmailActive).
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getAdminIdentity, requireAdminIdentity } from "./auth";
import { recountCategoryStats } from "./packages";
import {
  blockMessageForStatus,
  findAccountByEmail,
  isAdminEmail,
  logUserActivity,
  normalizeEmail,
  packageDisplayName,
  upsertSeenAccount,
} from "./userAccess";
import {
  userAccountActionValidator,
  userAccountFields,
  userAccountStatusValidator,
  userActivityFields,
  userSubmissionHandlingValidator,
  type UserAccountAction,
  type UserSubmissionHandling,
} from "./userValidators";

const LAST_SEEN_THRESHOLD_MS = 60 * 60 * 1000;
const SUBMISSIONS_PER_USER_CAP = 200;
const STATUS_COUNT_CAP = 500;
const MAX_REASON_LENGTH = 1000;

// ============ Signed-in user ============

// Called once per session by AccountStatusGuard. Creates the account on first
// sign-in and only bumps lastSeenAt once an hour to keep writes rare.
export const touchMyAccount = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const email = identity?.email;
    if (!identity || !email) return null;

    const { account, created, linkedToken } = await upsertSeenAccount(ctx, {
      email,
      name: identity.name ?? undefined,
      pictureUrl: identity.pictureUrl ?? undefined,
      tokenIdentifier: identity.tokenIdentifier,
      seenAt: Date.now(),
      lastSeenThresholdMs: LAST_SEEN_THRESHOLD_MS,
    });

    if ((created || linkedToken) && !isAdminEmail(email)) {
      await logUserActivity(ctx, {
        actorEmail: account.email,
        actorName: account.name,
        type: "first_sign_in",
        summary: "Signed in for the first time",
      });
    }
    return null;
  },
});

export const myAccountStatus = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      status: userAccountStatusValidator,
      message: v.optional(v.string()),
      reason: v.optional(v.string()),
      forceSignOutAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const email = identity?.email;
    if (!email) return null;
    if (isAdminEmail(email)) return { status: "active" as const };

    const account = await findAccountByEmail(ctx, email);
    if (!account) return { status: "active" as const };
    return {
      status: account.status,
      message: blockMessageForStatus(account.status) ?? undefined,
      reason: account.statusReason,
      forceSignOutAt: account.forceSignOutAt,
    };
  },
});

// The browser calls this right before signing itself out after a Kick
export const acknowledgeForcedSignOut = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const email = identity?.email;
    if (!email) return null;
    const account = await findAccountByEmail(ctx, email);
    if (!account || account.forceSignOutAt === undefined) return null;
    await ctx.db.patch("userAccounts", account._id, {
      forceSignOutAt: undefined,
    });
    return null;
  },
});

// ============ Admin: list ============

const userRowValidator = v.object({
  _id: v.id("userAccounts"),
  _creationTime: v.number(),
  ...userAccountFields,
  isAdmin: v.boolean(),
  submissionCount: v.number(),
  approvedCount: v.number(),
  pendingCount: v.number(),
});

async function submissionsForEmail(
  ctx: QueryCtx | MutationCtx,
  email: string,
): Promise<Array<Doc<"packages">>> {
  return await ctx.db
    .query("packages")
    .withIndex("by_submitter_email", (q) => q.eq("submitterEmail", email))
    .take(SUBMISSIONS_PER_USER_CAP);
}

export const listUsers = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    status: v.optional(userAccountStatusValidator),
  },
  returns: v.object({
    page: v.array(userRowValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null(),
      ),
    ),
  }),
  handler: async (ctx, args) => {
    const admin = await getAdminIdentity(ctx);
    if (!admin) return { page: [], isDone: true, continueCursor: "" };

    const search = args.search?.trim();
    const status = args.status;
    const result = await (() => {
      if (search) {
        return ctx.db
          .query("userAccounts")
          .withSearchIndex("search_text", (q) =>
            status
              ? q.search("searchText", search).eq("status", status)
              : q.search("searchText", search),
          )
          .paginate(args.paginationOpts);
      }
      if (status) {
        return ctx.db
          .query("userAccounts")
          .withIndex("by_status_and_lastSeenAt", (q) => q.eq("status", status))
          .order("desc")
          .paginate(args.paginationOpts);
      }
      return ctx.db
        .query("userAccounts")
        .withIndex("by_lastSeenAt")
        .order("desc")
        .paginate(args.paginationOpts);
    })();

    const page = await Promise.all(
      result.page.map(async (account) => {
        const submissions = await submissionsForEmail(ctx, account.email);
        let approvedCount = 0;
        let pendingCount = 0;
        for (const pkg of submissions) {
          const reviewStatus = pkg.reviewStatus ?? "pending";
          if (reviewStatus === "approved") approvedCount++;
          if (reviewStatus === "pending" || reviewStatus === "in_review") {
            pendingCount++;
          }
        }
        return {
          ...account,
          isAdmin: isAdminEmail(account.email),
          submissionCount: submissions.length,
          approvedCount,
          pendingCount,
        };
      }),
    );

    return { ...result, page };
  },
});

// Header pills on the Users tab. Restricted accounts are rare, so a capped
// read per status is cheap.
export const getUserStatusCounts = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      deactivated: v.number(),
      banned: v.number(),
      capped: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const admin = await getAdminIdentity(ctx);
    if (!admin) return null;
    const [deactivated, banned] = await Promise.all(
      (["deactivated", "banned"] as const).map((status) =>
        ctx.db
          .query("userAccounts")
          .withIndex("by_status_and_lastSeenAt", (q) => q.eq("status", status))
          .take(STATUS_COUNT_CAP),
      ),
    );
    return {
      deactivated: deactivated.length,
      banned: banned.length,
      capped:
        deactivated.length === STATUS_COUNT_CAP ||
        banned.length === STATUS_COUNT_CAP,
    };
  },
});

// ============ Admin: detail ============

const detailSubmissionValidator = v.object({
  _id: v.id("packages"),
  name: v.string(),
  displayName: v.string(),
  slug: v.optional(v.string()),
  reviewStatus: v.string(),
  visibility: v.string(),
  markedForDeletion: v.boolean(),
  submittedAt: v.number(),
});

export const getUserDetail = query({
  args: { email: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      email: v.string(),
      isAdmin: v.boolean(),
      account: v.union(
        v.null(),
        v.object({
          _id: v.id("userAccounts"),
          _creationTime: v.number(),
          ...userAccountFields,
        }),
      ),
      submissions: v.array(detailSubmissionValidator),
      recentActivity: v.array(
        v.object({
          _id: v.id("userActivity"),
          _creationTime: v.number(),
          ...userActivityFields,
        }),
      ),
      apiKey: v.union(
        v.null(),
        v.object({
          keyPrefix: v.string(),
          createdAt: v.number(),
          lastUsedAt: v.optional(v.number()),
          requestCount: v.number(),
        }),
      ),
      apiGrant: v.union(
        v.null(),
        v.object({ revoked: v.boolean(), grantedAt: v.number() }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const admin = await getAdminIdentity(ctx);
    if (!admin) return null;

    const email = normalizeEmail(args.email);
    const account = await findAccountByEmail(ctx, email);
    const tokenIdentifier = account?.tokenIdentifier;

    const [submissions, recentActivity, apiKey, apiGrant] = await Promise.all([
      submissionsForEmail(ctx, email),
      ctx.db
        .query("userActivity")
        .withIndex("by_actorEmail_and_createdAt", (q) =>
          q.eq("actorEmail", email),
        )
        .order("desc")
        .take(20),
      tokenIdentifier
        ? ctx.db
            .query("apiKeys")
            .withIndex("by_tokenIdentifier_and_status", (q) =>
              q.eq("tokenIdentifier", tokenIdentifier).eq("status", "active"),
            )
            .first()
        : Promise.resolve(null),
      ctx.db
        .query("apiAccessGrants")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first(),
    ]);

    return {
      email,
      isAdmin: isAdminEmail(email),
      account,
      submissions: submissions
        .sort((a, b) => b.submittedAt - a.submittedAt)
        .map((pkg) => ({
          _id: pkg._id,
          name: pkg.name,
          displayName: packageDisplayName(pkg),
          slug: pkg.slug,
          reviewStatus: pkg.reviewStatus ?? "pending",
          visibility: pkg.visibility ?? "visible",
          markedForDeletion: pkg.markedForDeletion === true,
          submittedAt: pkg.submittedAt,
        })),
      recentActivity,
      apiKey: apiKey
        ? {
            keyPrefix: apiKey.keyPrefix,
            createdAt: apiKey.createdAt,
            lastUsedAt: apiKey.lastUsedAt,
            requestCount: apiKey.requestCount,
          }
        : null,
      apiGrant: apiGrant
        ? { revoked: apiGrant.revoked, grantedAt: apiGrant.grantedAt }
        : null,
    };
  },
});

// ============ Admin: status changes ============

const ACTION_LABEL: Record<UserAccountAction, string> = {
  kick: "Signed out",
  deactivate: "Deactivated",
  ban: "Banned",
  reactivate: "Reactivated",
};

const HANDLING_LABEL: Record<UserSubmissionHandling, string> = {
  keep: "kept",
  hide: "hidden",
  archive: "archived",
  delete: "deleted",
};

// Hide, archive or delete the account's primary submissions. Packages where the
// user is only an additional email are left alone. Deletes hide first (so
// category counts drop in this transaction), then run the same cascade as the
// admin permanent delete, one scheduled transaction per package.
async function applySubmissionHandling(
  ctx: MutationCtx,
  email: string,
  handling: UserSubmissionHandling,
): Promise<number> {
  if (handling === "keep") return 0;
  const submissions = await submissionsForEmail(ctx, email);

  let changed = 0;
  await Promise.all(
    submissions.map(async (pkg) => {
      if (handling === "delete") {
        if (pkg.visibility !== "hidden") {
          await ctx.db.patch("packages", pkg._id, { visibility: "hidden" });
        }
        await ctx.scheduler.runAfter(
          0,
          internal.packages._permanentlyDeletePackage,
          { packageId: pkg._id },
        );
        changed++;
        return;
      }
      const visibility = handling === "hide" ? "hidden" : "archived";
      if (pkg.visibility === visibility) return;
      // Hiding never un-archives an archived package
      if (handling === "hide" && pkg.visibility === "archived") return;
      await ctx.db.patch("packages", pkg._id, { visibility });
      changed++;
    }),
  );

  if (changed > 0) await recountCategoryStats(ctx);
  return changed;
}

// Ban revokes the user's active API key and API access grant
async function revokeApiAccess(
  ctx: MutationCtx,
  account: Doc<"userAccounts">,
): Promise<void> {
  const tokenIdentifier = account.tokenIdentifier;
  const [keys, grant] = await Promise.all([
    tokenIdentifier
      ? ctx.db
          .query("apiKeys")
          .withIndex("by_tokenIdentifier_and_status", (q) =>
            q.eq("tokenIdentifier", tokenIdentifier).eq("status", "active"),
          )
          .take(10)
      : Promise.resolve([]),
    ctx.db
      .query("apiAccessGrants")
      .withIndex("by_email", (q) => q.eq("email", account.email))
      .first(),
  ]);
  await Promise.all(
    keys.map((key) => ctx.db.patch("apiKeys", key._id, { status: "revoked" })),
  );
  if (grant && !grant.revoked) {
    await ctx.db.patch("apiAccessGrants", grant._id, {
      revoked: true,
      revokedAt: Date.now(),
    });
  }
}

export const setUserStatus = mutation({
  args: {
    email: v.string(),
    action: userAccountActionValidator,
    reason: v.optional(v.string()),
    // Only used by deactivate and ban; defaults to keep
    submissions: v.optional(userSubmissionHandlingValidator),
  },
  returns: v.object({ affectedSubmissions: v.number() }),
  handler: async (ctx, args) => {
    const { email: adminEmail } = await requireAdminIdentity(ctx);
    const email = normalizeEmail(args.email);
    if (!email.includes("@")) throw new ConvexError("Invalid email");
    if (isAdminEmail(email)) {
      throw new ConvexError("Admin accounts can't be changed here");
    }
    const reason = args.reason?.trim().slice(0, MAX_REASON_LENGTH) || undefined;
    const handling: UserSubmissionHandling =
      args.action === "deactivate" || args.action === "ban"
        ? (args.submissions ?? "keep")
        : "keep";

    const now = Date.now();
    // Create the row only when missing so an email can be restricted before it
    // signs in; existing rows keep their real lastSeenAt
    const account =
      (await findAccountByEmail(ctx, email)) ??
      (await upsertSeenAccount(ctx, { email, seenAt: now })).account;

    // Idempotent: nothing to do when the status is already in place
    const targetStatus =
      args.action === "ban"
        ? "banned"
        : args.action === "deactivate"
          ? "deactivated"
          : args.action === "reactivate"
            ? "active"
            : account.status;
    if (
      args.action !== "kick" &&
      account.status === targetStatus &&
      handling === "keep"
    ) {
      return { affectedSubmissions: 0 };
    }

    if (args.action === "kick") {
      await ctx.db.patch("userAccounts", account._id, { forceSignOutAt: now });
    } else if (args.action === "reactivate") {
      await ctx.db.patch("userAccounts", account._id, {
        status: "active",
        statusReason: undefined,
        statusChangedAt: now,
        statusChangedBy: adminEmail,
        forceSignOutAt: undefined,
      });
    } else {
      await ctx.db.patch("userAccounts", account._id, {
        status: targetStatus,
        statusReason: reason,
        statusChangedAt: now,
        statusChangedBy: adminEmail,
        // Banned browsers are signed out right away
        forceSignOutAt: args.action === "ban" ? now : account.forceSignOutAt,
      });
      if (args.action === "ban") await revokeApiAccess(ctx, account);
    }

    const affectedSubmissions = await applySubmissionHandling(
      ctx,
      email,
      handling,
    );

    // Logged under the target email so it shows in the user's own timeline
    const parts = [`${ACTION_LABEL[args.action]} by ${adminEmail}`];
    if (reason) parts.push(`Reason: ${reason}`);
    if (handling !== "keep") {
      parts.push(
        `${affectedSubmissions} submission${affectedSubmissions === 1 ? "" : "s"} ${HANDLING_LABEL[handling]}`,
      );
    }
    await logUserActivity(ctx, {
      actorEmail: email,
      actorName: account.name,
      actorRole: "admin",
      type: "account_status_changed",
      summary: parts.join(". "),
      changedFields: [args.action, ...(handling !== "keep" ? [handling] : [])],
    });

    return { affectedSubmissions };
  },
});
