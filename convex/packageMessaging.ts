// Helpers for the private submitter thread and review outcome drafts.
// No Convex function exports here so packages.ts and reviewMessages.ts can
// both import it without a cycle.
import { MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { parseGitHubRepo } from "./githubIssues";
import { formatSlackNotification } from "./slack";
import { logUserActivity } from "./userAccess";
import {
  buildApprovalMessage,
  buildRejectionMessage,
  directoryListingUrl,
  hasRejectionReasons,
} from "../shared/reviewMessages";

export const SYSTEM_AUTHOR = "AI";
export const TEAM_AUTHOR_NAME = "Convex Components Team";
export const MAX_MESSAGE_LENGTH = 10000;

export type ReviewMessageKind = "rejected" | "approved";

// Messages from the directory team: admins on @convex.dev plus auto sent rows.
export function isTeamComment(comment: {
  authorEmail: string;
  source?: "github" | "system";
}): boolean {
  return (
    comment.source === "system" || comment.authorEmail.endsWith("@convex.dev")
  );
}

// Insert a thread message, optionally mirror it to GitHub, and notify Slack.
export async function insertPackageComment(
  ctx: MutationCtx,
  args: {
    pkg: Doc<"packages">;
    content: string;
    authorEmail: string;
    authorName?: string;
    isAdmin: boolean;
    alsoCreateGithubIssue: boolean;
    source?: "system";
  },
): Promise<Id<"packageComments">> {
  // Only team messages mirror to GitHub, and only when the repo is on github.com.
  const mirrorToGithub =
    args.isAdmin &&
    args.alsoCreateGithubIssue &&
    parseGitHubRepo(args.pkg.repositoryUrl) !== null;

  const commentId = await ctx.db.insert("packageComments", {
    packageId: args.pkg._id,
    content: args.content,
    authorEmail: args.authorEmail,
    authorName: args.authorName,
    createdAt: Date.now(),
    adminHasRead: args.isAdmin,
    userHasRead: !args.isAdmin,
    status: "active",
    githubIssueStatus: mirrorToGithub ? "pending" : undefined,
    source: args.source,
  });

  if (mirrorToGithub) {
    await ctx.scheduler.runAfter(
      0,
      internal.githubIssues.createIssueForComment,
      { commentId },
    );
  }

  // Submitter messages after the team has written count as replies
  let activityType: "system_message" | "admin_reply" | "reply_sent" | "message_sent";
  if (args.source === "system") {
    activityType = "system_message";
  } else if (args.isAdmin) {
    activityType = "admin_reply";
  } else {
    const thread = await ctx.db
      .query("packageComments")
      .withIndex("by_package_and_created", (q) =>
        q.eq("packageId", args.pkg._id),
      )
      .order("desc")
      .take(50);
    activityType = thread.some((c) => c._id !== commentId && isTeamComment(c))
      ? "reply_sent"
      : "message_sent";
  }
  await logUserActivity(ctx, {
    actorEmail: args.authorEmail,
    actorName: args.authorName,
    type: activityType,
    pkg: args.pkg,
    summary: args.content,
  });

  const fromLabel =
    args.source === "system"
      ? "Auto-sent review message"
      : args.isAdmin
        ? `Admin (${args.authorEmail})`
        : `Submitter (${args.authorEmail})`;
  const text = formatSlackNotification(
    args.pkg,
    "New private message on",
    fromLabel,
    args.content,
  );
  await ctx.scheduler.runAfter(0, internal.slack.sendMessage, { text });

  return commentId;
}

// ============ Review outcome drafts ============

function displayName(pkg: Doc<"packages">): string {
  return pkg.componentName ?? pkg.name;
}

// Returns null when there is nothing honest to say (no failed review or no
// usable reasons), so no draft ever ships with placeholder text.
export function buildDraftContent(
  pkg: Doc<"packages">,
  kind: ReviewMessageKind,
): string | null {
  if (kind === "approved") {
    return buildApprovalMessage({
      displayName: displayName(pkg),
      listingUrl: directoryListingUrl(pkg),
    });
  }
  if (
    pkg.aiReviewStatus !== "failed" ||
    !hasRejectionReasons(pkg.aiReviewCriteria, pkg.aiReviewSummary)
  ) {
    return null;
  }
  return buildRejectionMessage({
    displayName: displayName(pkg),
    criteria: pkg.aiReviewCriteria ?? [],
    summary: pkg.aiReviewSummary,
  });
}

async function draftsWithStatus(
  ctx: QueryCtx | MutationCtx,
  packageId: Id<"packages">,
  status: Doc<"reviewMessageDrafts">["status"],
): Promise<Array<Doc<"reviewMessageDrafts">>> {
  return await ctx.db
    .query("reviewMessageDrafts")
    .withIndex("by_package_and_status", (q) =>
      q.eq("packageId", packageId).eq("status", status),
    )
    .take(50);
}

export async function getPendingDraft(
  ctx: QueryCtx | MutationCtx,
  packageId: Id<"packages">,
  kind?: ReviewMessageKind,
): Promise<Doc<"reviewMessageDrafts"> | null> {
  const pending = await draftsWithStatus(ctx, packageId, "draft");
  const matching = kind ? pending.filter((d) => d.kind === kind) : pending;
  // Newest first so a fresh outcome wins over an older leftover.
  matching.sort((a, b) => b.createdAt - a.createdAt);
  return matching[0] ?? null;
}

// True when the admin already sent or discarded a rejection message built
// from this exact AI review run.
export async function wasRejectionRunHandled(
  ctx: QueryCtx | MutationCtx,
  pkg: Doc<"packages">,
): Promise<boolean> {
  const [sent, dismissed] = await Promise.all([
    draftsWithStatus(ctx, pkg._id, "sent"),
    draftsWithStatus(ctx, pkg._id, "dismissed"),
  ]);
  return [...sent, ...dismissed].some(
    (d) => d.kind === "rejected" && d.sourceAiReviewedAt === pkg.aiReviewedAt,
  );
}

// Create or refresh the rejection draft for the package's latest failed AI
// review. Admin edits are kept, and a run the admin already sent or
// discarded is never drafted again.
export async function upsertRejectionDraft(
  ctx: MutationCtx,
  pkg: Doc<"packages">,
): Promise<Id<"reviewMessageDrafts"> | null> {
  const content = buildDraftContent(pkg, "rejected");
  if (content === null) return null;
  if (await wasRejectionRunHandled(ctx, pkg)) return null;

  const pending = await getPendingDraft(ctx, pkg._id, "rejected");
  if (pending) {
    if (pending.editedAt === undefined && pending.content !== content) {
      await ctx.db.patch("reviewMessageDrafts", pending._id, {
        content,
        sourceAiReviewedAt: pkg.aiReviewedAt,
      });
    }
    return pending._id;
  }

  return await ctx.db.insert("reviewMessageDrafts", {
    packageId: pkg._id,
    kind: "rejected",
    content,
    status: "draft",
    sourceAiReviewedAt: pkg.aiReviewedAt,
    createdAt: Date.now(),
  });
}

// One approval message per package: skip if one already went out.
export async function createApprovalDraft(
  ctx: MutationCtx,
  pkg: Doc<"packages">,
): Promise<Id<"reviewMessageDrafts"> | null> {
  const sent = await draftsWithStatus(ctx, pkg._id, "sent");
  if (sent.some((d) => d.kind === "approved")) return null;

  const pending = await getPendingDraft(ctx, pkg._id, "approved");
  if (pending) return pending._id;

  const content = buildDraftContent(pkg, "approved");
  if (content === null) return null;
  return await ctx.db.insert("reviewMessageDrafts", {
    packageId: pkg._id,
    kind: "approved",
    content,
    status: "draft",
    createdAt: Date.now(),
  });
}

export async function dismissPendingDrafts(
  ctx: MutationCtx,
  packageId: Id<"packages">,
  kind: ReviewMessageKind,
): Promise<void> {
  const pending = await draftsWithStatus(ctx, packageId, "draft");
  await Promise.all(
    pending
      .filter((d) => d.kind === kind)
      .map((d) =>
        ctx.db.patch("reviewMessageDrafts", d._id, { status: "dismissed" }),
      ),
  );
}

// Post the draft to the thread and mark it sent in the same transaction.
export async function sendDraft(
  ctx: MutationCtx,
  args: {
    draft: Doc<"reviewMessageDrafts">;
    pkg: Doc<"packages">;
    content: string;
    authorEmail: string;
    authorName?: string;
    alsoCreateGithubIssue: boolean;
    source?: "system";
  },
): Promise<Id<"packageComments">> {
  const commentId = await insertPackageComment(ctx, {
    pkg: args.pkg,
    content: args.content,
    authorEmail: args.authorEmail,
    authorName: args.authorName,
    isAdmin: true,
    alsoCreateGithubIssue: args.alsoCreateGithubIssue,
    source: args.source,
  });
  await ctx.db.patch("reviewMessageDrafts", args.draft._id, {
    content: args.content,
    status: "sent",
    sentAt: Date.now(),
    sentBy: args.authorEmail,
    sentCommentId: commentId,
  });
  return commentId;
}

async function readBooleanSetting(
  ctx: MutationCtx,
  key: string,
  fallback: boolean,
): Promise<boolean> {
  const row = await ctx.db
    .query("adminSettings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  return row?.value ?? fallback;
}

const AUTO_SEND_KEYS: Record<
  ReviewMessageKind,
  { enabled: string; github: string }
> = {
  rejected: {
    enabled: "autoSendRejectionMessage",
    github: "autoSendRejectionMessageToGithub",
  },
  approved: {
    enabled: "autoSendApprovalMessage",
    github: "autoSendApprovalMessageToGithub",
  },
};

// Send the pending draft right away when the matching setting is on.
// A discarded draft is not pending, so it is never auto sent.
export async function maybeAutoSend(
  ctx: MutationCtx,
  pkg: Doc<"packages">,
  kind: ReviewMessageKind,
): Promise<void> {
  const keys = AUTO_SEND_KEYS[kind];
  if (!(await readBooleanSetting(ctx, keys.enabled, false))) return;

  const draft = await getPendingDraft(ctx, pkg._id, kind);
  if (!draft) return;

  const toGithub = await readBooleanSetting(ctx, keys.github, true);
  await sendDraft(ctx, {
    draft,
    pkg,
    content: draft.content,
    authorEmail: SYSTEM_AUTHOR,
    authorName: TEAM_AUTHOR_NAME,
    alsoCreateGithubIssue: toGithub,
    source: "system",
  });
}
