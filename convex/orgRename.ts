// One-off data fix for the GitHub org rename (get-convex to convex).
// GitHub still redirects old repo URLs, but the old org page and avatar 404.
//
// Run a dry run first, then the real run. Running it again changes nothing.
//   npx convex run orgRename:migrateConvexOrgRename '{"dryRun":true}'
//   npx convex run orgRename:migrateConvexOrgRename '{"dryRun":false}'
// Add --prod to target production.
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { OFFICIAL_CATEGORY_SLUG } from "../shared/officialComponents";

const OLD_OWNER = "get-convex";
const NEW_OWNER = "convex";
const OLD_REPO_PREFIX = /github\.com\/get-convex\//i;
const OLD_AVATAR = /^https:\/\/github\.com\/get-convex\.png(\?.*)?$/i;
const NEW_AVATAR = `https://github.com/${NEW_OWNER}.png`;
const OLD_ORG_PHRASE = "get-convex GitHub org";
const NEW_ORG_PHRASE = "convex GitHub org";

// The packages table is ~5 MB at 190 rows, well inside one transaction.
const MAX_PACKAGES = 1000;

export const migrateConvexOrgRename = internalMutation({
  args: { dryRun: v.boolean() },
  returns: v.object({
    dryRun: v.boolean(),
    scanned: v.number(),
    truncated: v.boolean(),
    repositoryUrlUpdates: v.number(),
    authorUsernameUpdates: v.number(),
    authorAvatarUpdates: v.number(),
    categoryDescriptionUpdated: v.boolean(),
    packageNames: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const packages = await ctx.db.query("packages").take(MAX_PACKAGES);

    let repositoryUrlUpdates = 0;
    let authorUsernameUpdates = 0;
    let authorAvatarUpdates = 0;
    const packageNames: Array<string> = [];
    const writes: Array<Promise<void>> = [];

    // Build a minimal patch per package, skipping rows already migrated
    for (const pkg of packages) {
      const patch: {
        repositoryUrl?: string;
        authorUsername?: string;
        authorAvatar?: string;
      } = {};

      if (pkg.repositoryUrl && OLD_REPO_PREFIX.test(pkg.repositoryUrl)) {
        patch.repositoryUrl = pkg.repositoryUrl.replace(
          OLD_REPO_PREFIX,
          `github.com/${NEW_OWNER}/`,
        );
        repositoryUrlUpdates++;
      }
      if (pkg.authorUsername?.toLowerCase() === OLD_OWNER) {
        patch.authorUsername = NEW_OWNER;
        authorUsernameUpdates++;
      }
      if (pkg.authorAvatar && OLD_AVATAR.test(pkg.authorAvatar)) {
        patch.authorAvatar = NEW_AVATAR;
        authorAvatarUpdates++;
      }

      if (Object.keys(patch).length === 0) continue;
      packageNames.push(pkg.name);
      if (!args.dryRun) writes.push(ctx.db.patch("packages", pkg._id, patch));
    }

    // The official category keeps its get-convex slug; only the copy changes
    const category = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", OFFICIAL_CATEGORY_SLUG))
      .unique();
    const categoryDescriptionUpdated =
      !!category?.description && category.description.includes(OLD_ORG_PHRASE);
    if (category && categoryDescriptionUpdated && !args.dryRun) {
      writes.push(
        ctx.db.patch("categories", category._id, {
          description: category.description!.replace(OLD_ORG_PHRASE, NEW_ORG_PHRASE),
        }),
      );
    }

    await Promise.all(writes);

    return {
      dryRun: args.dryRun,
      scanned: packages.length,
      truncated: packages.length === MAX_PACKAGES,
      repositoryUrlUpdates,
      authorUsernameUpdates,
      authorAvatarUpdates,
      categoryDescriptionUpdated,
      packageNames,
    };
  },
});
