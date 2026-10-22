// How old a catalog response from the directory-page edge function is, in
// milliseconds. Edge copies can be up to ten minutes old, and
// src/lib/convexHttp.ts uses this to decide whether to refresh one straight
// from Convex. Kept free of imports so scripts/test-directory-page-edge.mjs
// can check it under plain node.
//
// Only server timestamps are compared: Date (when the response was sent)
// minus X-Directory-Page-Fetched-At (when the edge fetched it from Convex),
// and the Age header Netlify adds to hits. The larger of the two wins, each
// used only when it parses, and 0 when neither does. The device clock can be
// minutes off, so it's never used against them. In production the page goes
// through Vercel's rewrite to Netlify, which may change Date or Age (taking
// the larger means one rewritten header can't make an old copy look fresh),
// so the result is clamped at 0 and anything over a day counts as a day
// (stale, but still a number the caches can store).

const MAX_BELIEVABLE_AGE_MS = 24 * 60 * 60 * 1000;

export function catalogResponseAgeMs(headers: {
  get(name: string): string | null;
}): number {
  const ages: number[] = [];
  const sentAt = Date.parse(headers.get("date") ?? "");
  const fetchedAt = Date.parse(
    headers.get("x-directory-page-fetched-at") ?? "",
  );
  if (Number.isFinite(sentAt) && Number.isFinite(fetchedAt)) {
    ages.push(sentAt - fetchedAt);
  }
  const ageHeader = headers.get("age")?.trim() ?? "";
  if (/^\d+$/.test(ageHeader)) ages.push(Number(ageHeader) * 1000);
  if (ages.length === 0) return 0;
  return Math.min(Math.max(...ages, 0), MAX_BELIEVABLE_AGE_MS);
}
