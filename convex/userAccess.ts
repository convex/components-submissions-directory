// Account status gate and activity logging shared by packages.ts,
// packageMessaging.ts, apiKeys.ts and the admin Activity / Users functions.
// No Convex function exports here, so any module can import it without a cycle.
import { ConvexError } from "convex/values";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
  categoryForActivityType,
  type UserAccountStatus,
  type UserActivityRole,
  type UserActivityType,
} from "./userValidators";

const MAX_SUMMARY_LENGTH = 500;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAdminEmail(email: string | undefined | null): boolean {
  return email?.toLowerCase().endsWith("@convex.dev") ?? false;
}

export function packageDisplayName(pkg: Doc<"packages">): string {
  return pkg.componentName ?? pkg.name;
}

// ============ Activity log ============

export type UserActivityEvent = {
  actorEmail: string;
  actorName?: string;
  // Defaults to admin for @convex.dev and "AI", user for everyone else
  actorRole?: UserActivityRole;
  type: UserActivityType;
  pkg?: Doc<"packages">;
  packageId?: Id<"packages">;
  packageName?: string;
  summary: string;
  changedFields?: Array<string>;
  createdAt?: number;
  sourceKey?: string;
};

function defaultRole(actorEmail: string): UserActivityRole {
  if (actorEmail === "AI") return "system";
  return isAdminEmail(actorEmail) ? "admin" : "user";
}

// Insert one Activity row. Callers pass the package doc when they have it so
// the row keeps the display name even after the package is deleted.
export async function logUserActivity(
  ctx: MutationCtx,
  event: UserActivityEvent,
): Promise<void> {
  const actorEmail =
    event.actorEmail === "AI" ? "AI" : normalizeEmail(event.actorEmail);
  const packageId = event.pkg?._id ?? event.packageId;
  const packageName = event.pkg
    ? packageDisplayName(event.pkg)
    : event.packageName;
  const summary = event.summary.slice(0, MAX_SUMMARY_LENGTH);
  const searchText = [actorEmail, event.actorName, packageName, summary]
    .filter((part): part is string => Boolean(part))
    .join(" ");

  await ctx.db.insert("userActivity", {
    actorEmail,
    actorName: event.actorName,
    actorRole: event.actorRole ?? defaultRole(actorEmail),
    type: event.type,
    category: categoryForActivityType(event.type),
    packageId,
    packageName,
    summary,
    changedFields:
      event.changedFields && event.changedFields.length > 0
        ? event.changedFields
        : undefined,
    createdAt: event.createdAt ?? Date.now(),
    sourceKey: event.sourceKey,
    searchText,
  });
}

// ============ Accounts ============

export async function findAccountByEmail(
  ctx: QueryCtx | MutationCtx,
  email: string,
): Promise<Doc<"userAccounts"> | null> {
  return await ctx.db
    .query("userAccounts")
    .withIndex("by_email", (q) => q.eq("email", normalizeEmail(email)))
    .unique();
}

export function accountSearchText(email: string, name?: string): string {
  return name ? `${email} ${name}` : email;
}

// Create the account row on first sight, or widen its first/last seen window.
// Only patches when something changed, so repeat calls write nothing.
export async function upsertSeenAccount(
  ctx: MutationCtx,
  args: {
    email: string;
    name?: string;
    pictureUrl?: string;
    tokenIdentifier?: string;
    seenAt: number;
    // Skip lastSeenAt patches that are newer by less than this many ms
    lastSeenThresholdMs?: number;
  },
): Promise<{
  account: Doc<"userAccounts">;
  created: boolean;
  // True when a backfilled row (no sign-in yet) just got its first token
  linkedToken: boolean;
}> {
  const email = normalizeEmail(args.email);
  const existing = await findAccountByEmail(ctx, email);

  if (!existing) {
    const id = await ctx.db.insert("userAccounts", {
      email,
      name: args.name,
      pictureUrl: args.pictureUrl,
      tokenIdentifier: args.tokenIdentifier,
      firstSeenAt: args.seenAt,
      lastSeenAt: args.seenAt,
      status: "active",
      searchText: accountSearchText(email, args.name),
    });
    const account = await ctx.db.get("userAccounts", id);
    if (!account) throw new ConvexError("Account insert failed");
    return { account, created: true, linkedToken: false };
  }

  const patch: Partial<Doc<"userAccounts">> = {};
  const threshold = args.lastSeenThresholdMs ?? 0;
  if (args.seenAt - existing.lastSeenAt > threshold) {
    patch.lastSeenAt = args.seenAt;
  }
  if (args.seenAt < existing.firstSeenAt) patch.firstSeenAt = args.seenAt;
  if (args.name && args.name !== existing.name) {
    patch.name = args.name;
    patch.searchText = accountSearchText(email, args.name);
  }
  if (args.pictureUrl && args.pictureUrl !== existing.pictureUrl) {
    patch.pictureUrl = args.pictureUrl;
  }
  if (
    args.tokenIdentifier &&
    args.tokenIdentifier !== existing.tokenIdentifier
  ) {
    patch.tokenIdentifier = args.tokenIdentifier;
  }

  const linkedToken = !existing.tokenIdentifier && Boolean(patch.tokenIdentifier);
  if (Object.keys(patch).length === 0) {
    return { account: existing, created: false, linkedToken };
  }
  await ctx.db.patch("userAccounts", existing._id, patch);
  return { account: { ...existing, ...patch }, created: false, linkedToken };
}

// ============ Status gate ============

export const DEACTIVATED_MESSAGE =
  "Your account is deactivated. You can view your submissions and messages, but changes are turned off. Contact the Convex team to restore access.";
export const BANNED_MESSAGE =
  "Your account has been suspended and can't make changes.";

export function blockMessageForStatus(
  status: UserAccountStatus,
): string | null {
  if (status === "deactivated") return DEACTIVATED_MESSAGE;
  if (status === "banned") return BANNED_MESSAGE;
  return null;
}

// Null when the email may write; otherwise the message to show. Admins are
// never blocked so nobody can lock the team out.
export async function getAccountBlockMessage(
  ctx: QueryCtx | MutationCtx,
  email: string,
): Promise<string | null> {
  if (isAdminEmail(email)) return null;
  const account = await findAccountByEmail(ctx, email);
  if (!account) return null;
  return blockMessageForStatus(account.status);
}

export async function assertEmailActive(
  ctx: QueryCtx | MutationCtx,
  email: string,
): Promise<void> {
  const message = await getAccountBlockMessage(ctx, email);
  if (message) throw new ConvexError(message);
}
