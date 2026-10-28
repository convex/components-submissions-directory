import { v, type Infer } from "convex/values";

// Shared by schema.ts, userActivity.ts and userAccounts.ts so the Activity
// and Users tabs, the schema and the logging helper agree on every literal.

export const userActivityTypeValidator = v.union(
  v.literal("submitted"),
  v.literal("message_sent"),
  v.literal("reply_sent"),
  v.literal("admin_reply"),
  v.literal("github_reply"),
  v.literal("system_message"),
  v.literal("message_deleted"),
  v.literal("message_status_changed"),
  v.literal("details_updated"),
  v.literal("links_updated"),
  v.literal("readme_updated"),
  v.literal("readme_refresh_requested"),
  v.literal("media_updated"),
  v.literal("visibility_changed"),
  v.literal("deletion_requested"),
  v.literal("deletion_cancelled"),
  v.literal("rereview_requested"),
  v.literal("api_key_created"),
  v.literal("api_key_revoked"),
  v.literal("first_sign_in"),
  v.literal("account_deleted"),
  v.literal("account_status_changed"),
);
export type UserActivityType = Infer<typeof userActivityTypeValidator>;

// Filter groups for the Activity tab chips. Stored on each row so every
// chip is one index range instead of a merge across several types.
export const userActivityCategoryValidator = v.union(
  v.literal("submission"),
  v.literal("message"),
  v.literal("edit"),
  v.literal("readme"),
  v.literal("links"),
  v.literal("media"),
  v.literal("account"),
);
export type UserActivityCategory = Infer<typeof userActivityCategoryValidator>;

const CATEGORY_BY_TYPE: Record<UserActivityType, UserActivityCategory> = {
  submitted: "submission",
  visibility_changed: "submission",
  deletion_requested: "submission",
  deletion_cancelled: "submission",
  rereview_requested: "submission",
  message_sent: "message",
  reply_sent: "message",
  admin_reply: "message",
  github_reply: "message",
  system_message: "message",
  message_deleted: "message",
  message_status_changed: "message",
  details_updated: "edit",
  readme_updated: "readme",
  readme_refresh_requested: "readme",
  links_updated: "links",
  media_updated: "media",
  api_key_created: "account",
  api_key_revoked: "account",
  first_sign_in: "account",
  account_deleted: "account",
  account_status_changed: "account",
};

export function categoryForActivityType(
  type: UserActivityType,
): UserActivityCategory {
  return CATEGORY_BY_TYPE[type];
}

export const userActivityRoleValidator = v.union(
  v.literal("user"),
  v.literal("admin"),
  v.literal("system"),
);
export type UserActivityRole = Infer<typeof userActivityRoleValidator>;

export const userAccountStatusValidator = v.union(
  v.literal("active"),
  v.literal("deactivated"),
  v.literal("banned"),
);
export type UserAccountStatus = Infer<typeof userAccountStatusValidator>;

// Table fields, shared by schema.ts and the admin query return validators
export const userActivityFields = {
  actorEmail: v.string(), // lowercased; "AI" for automated rows
  actorName: v.optional(v.string()),
  actorRole: userActivityRoleValidator,
  type: userActivityTypeValidator,
  category: userActivityCategoryValidator,
  packageId: v.optional(v.id("packages")),
  packageName: v.optional(v.string()),
  summary: v.string(),
  changedFields: v.optional(v.array(v.string())),
  createdAt: v.number(),
  // Stable key for backfilled rows so reruns insert nothing new
  sourceKey: v.optional(v.string()),
  // actorEmail + actorName + packageName + summary, for the search index
  searchText: v.string(),
};

export const userAccountFields = {
  email: v.string(), // lowercased
  name: v.optional(v.string()),
  pictureUrl: v.optional(v.string()),
  // Matches apiKeys.tokenIdentifier so a ban can revoke the user's keys
  tokenIdentifier: v.optional(v.string()),
  firstSeenAt: v.number(),
  lastSeenAt: v.number(),
  status: userAccountStatusValidator,
  statusReason: v.optional(v.string()),
  statusChangedAt: v.optional(v.number()),
  statusChangedBy: v.optional(v.string()),
  // Set by an admin Kick; the app shell signs the browser out and clears it
  forceSignOutAt: v.optional(v.number()),
  // email + name, for the search index
  searchText: v.string(),
};

// Admin actions on an account
export const userAccountActionValidator = v.union(
  v.literal("kick"),
  v.literal("deactivate"),
  v.literal("ban"),
  v.literal("reactivate"),
);
export type UserAccountAction = Infer<typeof userAccountActionValidator>;

// What happens to the user's submissions on deactivate or ban
export const userSubmissionHandlingValidator = v.union(
  v.literal("keep"),
  v.literal("hide"),
  v.literal("archive"),
  v.literal("delete"),
);
export type UserSubmissionHandling = Infer<
  typeof userSubmissionHandlingValidator
>;
