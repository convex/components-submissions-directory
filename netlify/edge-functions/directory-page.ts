// Serves the directory's catalog at /components/api/directory-page, a
// same-origin copy of the Convex /api/directory-page HTTP action that
// Netlify's CDN caches (cache = "manual" in netlify.toml).
//
// Without it every first visit fetches the catalog from the US deployment,
// which costs ~350ms from Australia before any card can render. A cached copy
// comes from the nearest Netlify edge node instead (~200ms TTFB from Perth). index.html and
// src/lib/convexHttp.ts request this path in production builds and fall back
// to the convex.site URL if it fails.
//
// Only the query parameters the backend reads (sortBy and category) reach
// Convex or the cache key, so junk parameters can't fragment or poison the
// cache. Pure helpers are exported for scripts/test-directory-page-edge.mjs.

const defaultConvexCloudUrl = "https://giant-grouse-674.convex.cloud";

// Same values as DIRECTORY_SORTS in convex/directoryPage.ts. The backend
// returns 400 for anything else.
export const DIRECTORY_SORTS = [
  "newest",
  "downloads",
  "updated",
  "rating",
  "verified",
] as const;

// The backend's default when sortBy is missing
const DEFAULT_SORT = "downloads";

// Category slugs are stored trimmed and lowercased (upsertCategory). Anything
// that doesn't look like one is rejected here rather than cached; the client
// then falls back to the convex.site URL, which still answers it.
const CATEGORY_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,79}$/;

// How long each Netlify edge node keeps its copy. The cache is per node, and
// one city's traffic is spread over several nodes, so a short lifetime meant
// most first visits missed. Ten minutes keeps nodes warm. Freshness is the
// client's job instead: src/lib/convexHttp.ts reads how old a copy is and, if
// it's over a minute, shows it and then refreshes straight from Convex. Every
// deploy purges these copies. There's no stale-while-revalidate: Netlify
// doesn't honour it for edge function responses (an expired copy is fetched
// again before the request is answered), so it would only mislead.
export const CDN_MAX_AGE_SECONDS = 600;

// Browsers keep the behaviour the convex.site endpoint has today: always
// revalidate. The client keeps its own in-memory and localStorage copies and
// decides when to refetch (CATALOG_REFRESH_AFTER_MS), so a browser HTTP cache
// would only make those refetches return older data.
const BROWSER_CACHE_CONTROL = "no-cache";

// Upstream gets this long before the request fails. The client starts its
// fallback queries after 8 seconds anyway.
const UPSTREAM_TIMEOUT_MS = 10_000;

export type DirectoryPageQuery = { sortBy: string; category?: string };

const QUERY_PARAMS = ["sortBy", "category"] as const;

// The allowlisted parameter a raw query-string name refers to, if any.
// Matched after decoding and ignoring case, so spellings like sort%42y or
// SORTBY are caught (and rejected by the caller) rather than dropped.
function queryParamFor(rawName: string): (typeof QUERY_PARAMS)[number] | null {
  let name: string;
  try {
    name = decodeURIComponent(rawName.replace(/\+/g, " ")).toLowerCase();
  } catch {
    // Malformed percent-encoding can't spell either name
    return null;
  }
  return QUERY_PARAMS.find((param) => param.toLowerCase() === name) ?? null;
}

// Reads the allowlisted parameters from the raw query string (url.search), or
// returns null when they're invalid. Missing or empty values get the
// backend's defaults, so both spellings share one cache entry.
//
// Netlify builds the cache key from Netlify-Vary with its own parsing of the
// raw query string. If this function read a different sortBy or category
// than Netlify keys on (a duplicate, a percent-encoded name or value, a
// ";" separator), one view's catalog could be cached under another view's
// key, such as the default sortBy=downloads the prefetch asks for. So
// anything ambiguous is rejected: each name must be spelled literally and
// appear at most once, and values must already be in their plain form.
export function parseDirectoryPageQuery(
  search: string,
): DirectoryPageQuery | null {
  const found: Partial<Record<(typeof QUERY_PARAMS)[number], string>> = {};
  for (const pair of search.replace(/^\?/, "").split("&")) {
    const pieces = pair.split(";");
    if (pieces.length > 1) {
      // Some parsers treat ";" as a separator too
      if (pieces.some((piece) => queryParamFor(piece.split("=")[0]))) {
        return null;
      }
      continue;
    }
    const eq = pair.indexOf("=");
    const rawName = eq === -1 ? pair : pair.slice(0, eq);
    const param = queryParamFor(rawName);
    if (!param) continue;
    if (rawName !== param || param in found) return null;
    found[param] = eq === -1 ? "" : pair.slice(eq + 1);
  }
  const sortBy = found.sortBy || DEFAULT_SORT;
  if (!(DIRECTORY_SORTS as readonly string[]).includes(sortBy)) return null;
  const category = found.category || undefined;
  if (category !== undefined && !CATEGORY_SLUG_RE.test(category)) return null;
  return category ? { sortBy, category } : { sortBy };
}

export function upstreamDirectoryPageUrl(
  convexSiteUrl: string,
  query: DirectoryPageQuery,
): string {
  // Both values are already plain (checked above), so no encoding is needed
  let url = `${convexSiteUrl}/api/directory-page?sortBy=${query.sortBy}`;
  if (query.category) url += `&category=${query.category}`;
  return url;
}

// Headers for a catalog Netlify may cache. Built from scratch rather than
// copied from upstream: Deno's fetch has already decoded the gzip body, so a
// copied content-encoding or content-length would be wrong, and leaving them
// out lets Netlify compress the response (brotli where the browser accepts
// it).
export function cacheableHeaders(fetchedAt: Date): Headers {
  return new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": BROWSER_CACHE_CONTROL,
    "netlify-cdn-cache-control": `public, s-maxage=${CDN_MAX_AGE_SECONDS}`,
    // Everything else in the query string is left out of the cache key
    "netlify-vary": "query=sortBy|category",
    // When this copy was fetched from Convex. The client subtracts it from
    // the Date header (both server clocks) to tell how old a hit is, and
    // it's handy next to Netlify's Cache-Status header when debugging.
    "x-directory-page-fetched-at": fetchedAt.toISOString(),
  });
}

// Errors and anything that isn't a JSON catalog: never cached, by Netlify or
// the browser, so a bad upstream moment doesn't stick for ten minutes.
export function uncachedHeaders(contentType: string): Headers {
  return new Headers({
    "content-type": contentType,
    "cache-control": "no-store",
  });
}

// True when an upstream answer is a catalog worth caching
export function isCacheableUpstream(
  status: number,
  contentType: string,
  body: string,
): boolean {
  if (status !== 200 || !contentType.includes("application/json")) {
    return false;
  }
  try {
    const data = JSON.parse(body) as unknown;
    return typeof data === "object" && data !== null && !Array.isArray(data);
  } catch {
    return false;
  }
}

function getConvexSiteUrl(): string {
  return (Deno.env.get("VITE_CONVEX_URL") || defaultConvexCloudUrl)
    .replace(".convex.cloud", ".convex.site")
    .replace(/\/$/, "");
}

function textResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: uncachedHeaders("text/plain; charset=utf-8"),
  });
}

export default async (request: Request) => {
  // GET only. Nothing in the app sends HEAD, and refusing it means Netlify
  // can never store an empty HEAD body under a GET request's cache key.
  if (request.method !== "GET") {
    return textResponse(405, "Method not allowed");
  }
  const query = parseDirectoryPageQuery(new URL(request.url).search);
  if (!query) return textResponse(400, "Invalid sortBy or category");

  // The timeout covers the body too, so a stalled or reset body ends here as
  // an uncached 502 instead of an unhandled error
  let upstream: Response;
  let body: string;
  try {
    upstream = await fetch(
      upstreamDirectoryPageUrl(getConvexSiteUrl(), query),
      {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
    );
    body = await upstream.text();
  } catch {
    return textResponse(502, "Directory data unavailable");
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!isCacheableUpstream(upstream.status, contentType, body)) {
    return new Response(body, {
      status: upstream.status === 200 ? 502 : upstream.status,
      headers: uncachedHeaders(contentType || "text/plain; charset=utf-8"),
    });
  }
  return new Response(body, {
    status: 200,
    headers: cacheableHeaders(new Date()),
  });
};
