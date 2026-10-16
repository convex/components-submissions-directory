// Shared definition of an "official" Convex component.
// Used by the derived get-convex category and by the official llms.txt / markdown endpoints
// so both resolve membership from exactly one rule.

// Slug of the derived category listing official Convex team components. The
// GitHub org is now "convex", but this slug is part of public URLs
// (/components/categories/get-convex, /components/get-convex.md) and stays.
export const OFFICIAL_CATEGORY_SLUG = "get-convex";

// True when a component is built by the Convex team: its repo lives in the
// convex GitHub org (formerly get-convex), or its npm name uses the @convex-dev scope.
export function isOfficialComponent(pkg: {
  repositoryUrl?: string | null;
  name?: string | null;
}): boolean {
  const repo = (pkg.repositoryUrl || "").toLowerCase();
  if (/github\.com\/(get-)?convex(\/|$)/.test(repo)) return true;
  return typeof pkg.name === "string" && pkg.name.startsWith("@convex-dev/");
}
