// Admin Activity tab: list and stats queries over userActivity, the one-time
// history backfill, and the retention purge. Rows are written by
// logUserActivity in userAccess.ts from each user write path.
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  internalMutation,
  mutation,
  query,
  MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { getAdminIdentity, requireAdminIdentity } from "./auth";
import {
  isAdminEmail,
  logUserActivity,
  normalizeEmail,
  packageDisplayName,
  upsertSeenAccount,
} from "./userAccess";
import {
  userActivityCategoryValidator,
  userActivityFields,
  type UserActivityType,
} from "./userValidators";

const RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
const PURGE_BATCH = 500;
const BACKFILL_PACKAGES_PER_BATCH = 20;
const STATS_ROW_CAP = 2000;

// ============ List ============

const activityRowValidator = v.object({
  _id: v.id("userActivity"),
  _creationTime: v.number(),
  ...userActivityFields,
  // Joined from packages / userAccounts so the tab can link without extra reads
  packageExists: v.boolean(),
  packageSlug: v.optional(v.string()),
  packageReviewStatus: v.optional(v.string()),
  packageVisibility: v.optional(v.string()),
  actorPictureUrl: v.optional(v.string()),
});

const paginatedActivityValidator = v.object({
  page: v.array(activityRowValidator),
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
});

export const listUserActivity = query({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(userActivityCategoryValidator),
    actorEmail: v.optional(v.string()),
    packageId: v.optional(v.id("packages")),
    search: v.optional(v.string()),
    // Lower bound on createdAt, captured once by the client
    since: v.optional(v.number()),
  },
  returns: paginatedActivityValidator,
  handler: async (ctx, args) => {
    const admin = await getAdminIdentity(ctx);
    if (!admin) return { page: [], isDone: true, continueCursor: "" };

    const category = args.category;
    const actorEmail = args.actorEmail
      ? normalizeEmail(args.actorEmail)
      : undefined;
    const since = args.since ?? 0;
    const search = args.search?.trim();

    // Pick the narrowest index for the active filters. Search and package
    // lookups can't range on createdAt or category in the index, so those
    // two are trimmed from the returned page below.
    const result = await (() => {
      if (search) {
        return ctx.db
          .query("userActivity")
          .withSearchIndex("search_text", (q) => {
            const base = q.search("searchText", search);
            if (category && actorEmail) {
              return base.eq("category", category).eq("actorEmail", actorEmail);
            }
            if (category) return base.eq("category", category);
            if (actorEmail) return base.eq("actorEmail", actorEmail);
            return base;
          })
          .paginate(args.paginationOpts);
      }
      if (args.packageId) {
        const packageId = args.packageId;
        return ctx.db
          .query("userActivity")
          .withIndex("by_packageId_and_createdAt", (q) =>
            q.eq("packageId", packageId).gte("createdAt", since),
          )
          .order("desc")
          .paginate(args.paginationOpts);
      }
      if (actorEmail && category) {
        return ctx.db
          .query("userActivity")
          .withIndex("by_actorEmail_and_category_and_createdAt", (q) =>
            q
              .eq("actorEmail", actorEmail)
              .eq("category", category)
              .gte("createdAt", since),
          )
          .order("desc")
          .paginate(args.paginationOpts);
      }
      if (actorEmail) {
        return ctx.db
          .query("userActivity")
          .withIndex("by_actorEmail_and_createdAt", (q) =>
            q.eq("actorEmail", actorEmail).gte("createdAt", since),
          )
          .order("desc")
          .paginate(args.paginationOpts);
      }
      if (category) {
        return ctx.db
          .query("userActivity")
          .withIndex("by_category_and_createdAt", (q) =>
            q.eq("category", category).gte("createdAt", since),
          )
          .order("desc")
          .paginate(args.paginationOpts);
      }
      return ctx.db
        .query("userActivity")
        .withIndex("by_createdAt", (q) => q.gte("createdAt", since))
        .order("desc")
        .paginate(args.paginationOpts);
    })();

    const rows = result.page.filter(
      (row) =>
        row.createdAt >= since &&
        (category === undefined || row.category === category),
    );

    // Join package and avatar once per distinct id in the page
    const packageIds = [
      ...new Set(
        rows
          .map((row) => row.packageId)
          .filter((id): id is Id<"packages"> => id !== undefined),
      ),
    ];
    const emails = [
      ...new Set(
        rows
          .filter((row) => row.actorRole !== "system")
          .map((row) => row.actorEmail),
      ),
    ];
    const [packages, accounts] = await Promise.all([
      Promise.all(packageIds.map((id) => ctx.db.get("packages", id))),
      Promise.all(
        emails.map((email) =>
          ctx.db
            .query("userAccounts")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique(),
        ),
      ),
    ]);
    const packageById = new Map<string, Doc<"packages">>();
    for (const pkg of packages) if (pkg) packageById.set(pkg._id, pkg);
    const pictureByEmail = new Map<string, string>();
    for (const account of accounts) {
      if (account?.pictureUrl) {
        pictureByEmail.set(account.email, account.pictureUrl);
      }
    }

    return {
      ...result,
      page: rows.map((row) => {
        const pkg = row.packageId ? packageById.get(row.packageId) : undefined;
        return {
          ...row,
          packageExists: pkg !== undefined,
          packageSlug: pkg?.slug,
          packageReviewStatus: pkg
            ? (pkg.reviewStatus ?? "pending")
            : undefined,
          packageVisibility: pkg?.visibility,
          actorPictureUrl: pictureByEmail.get(row.actorEmail),
        };
      }),
    };
  },
});

// ============ Stats ============

const statsValidator = v.object({
  events: v.number(),
  submissions: v.number(),
  userMessages: v.number(),
  edits: v.number(),
  activeUsers: v.number(),
  // True when the window had more rows than STATS_ROW_CAP
  capped: v.boolean(),
});

const EDIT_TYPES: ReadonlySet<UserActivityType> = new Set([
  "details_updated",
  "links_updated",
  "readme_updated",
  "readme_refresh_requested",
  "media_updated",
]);

export const getActivityStats = query({
  args: { since: v.number() },
  returns: v.union(statsValidator, v.null()),
  handler: async (ctx, args) => {
    const admin = await getAdminIdentity(ctx);
    if (!admin) return null;

    const rows = await ctx.db
      .query("userActivity")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", args.since))
      .order("desc")
      .take(STATS_ROW_CAP + 1);
    const capped = rows.length > STATS_ROW_CAP;
    const windowRows = capped ? rows.slice(0, STATS_ROW_CAP) : rows;

    const activeUsers = new Set<string>();
    let submissions = 0;
    let userMessages = 0;
    let edits = 0;
    for (const row of windowRows) {
      if (row.actorRole === "user") activeUsers.add(row.actorEmail);
      if (row.type === "submitted") submissions++;
      if (row.type === "message_sent" || row.type === "reply_sent") {
        userMessages++;
      }
      if (EDIT_TYPES.has(row.type)) edits++;
    }

    return {
      events: windowRows.length,
      submissions,
      userMessages,
      edits,
      activeUsers: activeUsers.size,
      capped,
    };
  },
});

// ============ Backfill ============

// Admin button: import submissions, messages and submitter accounts that
// predate the log. Idempotent through sourceKey, so it is safe to rerun.
export const startActivityBackfill = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdminIdentity(ctx);
    await ctx.scheduler.runAfter(0, internal.userActivity._backfillBatch, {
      cursor: null,
      inserted: 0,
    });
    return null;
  },
});

async function insertIfMissing(
  ctx: MutationCtx,
  sourceKey: string,
  insert: () => Promise<void>,
): Promise<boolean> {
  const existing = await ctx.db
    .query("userActivity")
    .withIndex("by_sourceKey", (q) => q.eq("sourceKey", sourceKey))
    .first();
  if (existing) return false;
  await insert();
  return true;
}

async function backfillPackage(
  ctx: MutationCtx,
  pkg: Doc<"packages">,
): Promise<number> {
  let inserted = 0;
  const submitterEmail = pkg.submitterEmail?.trim();

  if (submitterEmail) {
    if (!isAdminEmail(submitterEmail)) {
      await upsertSeenAccount(ctx, {
        email: submitterEmail,
        name: pkg.submitterName,
        seenAt: pkg.submittedAt,
      });
    }
    const sourceKey = `pkg:${pkg._id}:submitted`;
    const added = await insertIfMissing(ctx, sourceKey, () =>
      logUserActivity(ctx, {
        actorEmail: submitterEmail,
        actorName: pkg.submitterName,
        type: "submitted",
        pkg,
        summary: `Submitted ${packageDisplayName(pkg)}`,
        createdAt: pkg.submittedAt,
        sourceKey,
      }),
    );
    if (added) inserted++;
  }

  // Walk the thread oldest first so user replies after a team message are
  // labeled as replies, matching the live logging rule
  const comments = await ctx.db
    .query("packageComments")
    .withIndex("by_package_and_created", (q) => q.eq("packageId", pkg._id))
    .take(500);
  let teamHasWritten = false;
  for (const comment of comments) {
    const isSystem = comment.source === "system";
    const isGithub = comment.source === "github";
    const isTeam = isSystem || isAdminEmail(comment.authorEmail);
    const type: UserActivityType = isSystem
      ? "system_message"
      : isGithub
        ? "github_reply"
        : isTeam
          ? "admin_reply"
          : teamHasWritten
            ? "reply_sent"
            : "message_sent";
    if (isTeam) teamHasWritten = true;

    if (!isTeam && !isGithub && comment.authorEmail.includes("@")) {
      await upsertSeenAccount(ctx, {
        email: comment.authorEmail,
        name: comment.authorName,
        seenAt: comment.createdAt,
      });
    }

    const sourceKey = `comment:${comment._id}`;
    const added = await insertIfMissing(ctx, sourceKey, () =>
      logUserActivity(ctx, {
        actorEmail: comment.authorEmail,
        actorName: isGithub
          ? (comment.githubAuthorLogin ?? comment.authorName)
          : comment.authorName,
        actorRole: isGithub ? "user" : undefined,
        type,
        pkg,
        summary: comment.content,
        createdAt: comment.createdAt,
        sourceKey,
      }),
    );
    if (added) inserted++;
  }

  return inserted;
}

export const _backfillBatch = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    inserted: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("packages")
      .paginate({ cursor: args.cursor, numItems: BACKFILL_PACKAGES_PER_BATCH });

    let inserted = args.inserted;
    for (const pkg of result.page) {
      inserted += await backfillPackage(ctx, pkg);
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.userActivity._backfillBatch, {
        cursor: result.continueCursor,
        inserted,
      });
    } else {
      console.log(`userActivity backfill complete: ${inserted} rows inserted`);
    }
    return null;
  },
});

// ============ Retention ============

// Daily cron: delete rows older than 180 days, 500 per run, rescheduling
// itself until the backlog is gone.
export const _purgeOldActivity = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_MS;
    const old = await ctx.db
      .query("userActivity")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(PURGE_BATCH);
    await Promise.all(old.map((row) => ctx.db.delete("userActivity", row._id)));
    if (old.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(
        0,
        internal.userActivity._purgeOldActivity,
        {},
      );
    }
    return null;
  },
});
