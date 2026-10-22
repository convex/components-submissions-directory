// One-shot HTTP loading for public directory and component detail data.
//
// The detail page normally reads component data through a reactive websocket
// subscription (`useQuery`). Search engine renderers (notably Googlebot) often
// never complete the websocket handshake within their render budget, so the
// page renders empty and cannot be indexed. To make the content crawlable, we
// also fetch the same public query over plain HTTP (the `/api/query` endpoint,
// the same path the `og-meta` edge function uses) and render whichever result
// arrives first, preferring the live subscription once it is connected.
import { useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import {
  convexToJson,
  jsonToConvex,
  type JSONValue,
  type Value,
} from "convex/values";
import { api } from "../../convex/_generated/api";

declare global {
  interface Window {
    // Directory page request started by the inline script in index.html,
    // keyed by URL. Consumed once by the first fetchDirectoryPage call.
    __directoryPrefetch?: { url: string; response: Promise<Response | null> };
  }
}

// Module-level singleton so we do not reconnect per render/navigation.
const httpClient = new ConvexHttpClient(
  import.meta.env.VITE_CONVEX_URL as string,
);

type ComponentBySlug = FunctionReturnType<
  typeof api.packages.getComponentBySlug
>;

// One-shot HTTP results for component pages, keyed by slug. Filled when a
// link is hovered or touched (prefetchComponent) and when a page opens, so
// in-app navigation can render straight away while the live query catches up.
// Reused for this long, so a component opened again later (or the only copy
// there is when the websocket can't connect) gets fresh data
const COMPONENT_REQUEST_TTL_MS = 60_000;

const componentRequests = new Map<
  string,
  { request: Promise<ComponentBySlug | undefined>; startedAt: number }
>();
const componentResults = new Map<
  string,
  { value: ComponentBySlug; loadedAt: number }
>();

// On a component page the og-meta edge function embeds the component it
// already looked up (see injectComponentData there), so the first render
// doesn't wait on another request. Read once at startup and removed, so it
// only ever seeds the slug it was fetched for. useComponentBySlug still
// fetches and subscribes as usual, which replaces it if the cached HTML was
// out of date.
function seedFromEdgeData() {
  const el = document.getElementById("component-data");
  if (!el) return;
  el.remove();
  try {
    const { slug, value } = JSON.parse(el.textContent ?? "") as {
      slug: unknown;
      value: JSONValue;
    };
    if (typeof slug !== "string" || !value) return;
    componentResults.set(slug, {
      value: jsonToConvex(value) as ComponentBySlug,
      loadedAt: Date.now(),
    });
  } catch {
    // Malformed block: the page loads its data the usual way
  }
}
seedFromEdgeData();

function freshResult(slug: string) {
  const result = componentResults.get(slug);
  return result && Date.now() - result.loadedAt < COMPONENT_REQUEST_TTL_MS
    ? result.value
    : undefined;
}

function requestComponent(slug: string) {
  const existing = componentRequests.get(slug);
  if (existing && Date.now() - existing.startedAt < COMPONENT_REQUEST_TTL_MS) {
    return existing.request;
  }
  const request = httpClient
    .query(api.packages.getComponentBySlug, { slug })
    .then((value) => {
      componentResults.set(slug, { value, loadedAt: Date.now() });
      return value;
    })
    .catch(() => {
      // Allow a retry later; the live subscription remains the source of truth
      componentRequests.delete(slug);
      return undefined;
    });
  componentRequests.set(slug, { request, startedAt: Date.now() });
  return request;
}

export function prefetchComponent(slug: string) {
  void requestComponent(slug);
}

// When the websocket never connects (some proxies block it), the signed-out
// HTTP answer is all a signed-in visitor will get. After this long its "not
// found" counts, so a missing page shows the 404 instead of loading forever.
const HTTP_NOT_FOUND_GRACE_MS = 8000;

export function useComponentBySlug(slug: string) {
  // Reactive value: drives live updates once the websocket connects.
  const live = useQuery(api.packages.getComponentBySlug, { slug });
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();

  // One-shot HTTP fallback: resolves even when the websocket cannot connect.
  const [http, setHttp] = useState<ComponentBySlug | undefined>(() =>
    freshResult(slug),
  );

  const [httpNullIsFinal, setHttpNullIsFinal] = useState(false);
  useEffect(() => {
    setHttpNullIsFinal(false);
    const timer = setTimeout(
      () => setHttpNullIsFinal(true),
      HTTP_NOT_FOUND_GRACE_MS,
    );
    return () => clearTimeout(timer);
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    // Show a recent prefetched result straight away, never the previous slug's
    setHttp(freshResult(slug));
    void requestComponent(slug).then((result) => {
      if (!cancelled && result !== undefined) setHttp(result);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Prefer the live (reactive) value once available; fall back to HTTP.
  // Returns `undefined` while both are pending (loading), `null` when the
  // component is not found, or the document otherwise.
  //
  // Unapproved components are only returned to their owner and admins. The
  // HTTP fallback is never signed in, so its null only counts for anonymous
  // visitors, and no null counts until sign-in has finished loading (or the
  // grace period above runs out).
  const httpCanSayNotFound =
    httpNullIsFinal || (!authLoading && !isAuthenticated);
  const fallback = http === null && !httpCanSayNotFound ? undefined : http;
  const result = live !== undefined ? live : fallback;
  return result === null && authLoading && !httpNullIsFinal
    ? undefined
    : result;
}

export type DirectorySort =
  | "newest"
  | "downloads"
  | "updated"
  | "rating"
  | "verified";

export type DirectoryPageData = {
  components: FunctionReturnType<typeof api.packages.listApprovedComponents>;
  categories: FunctionReturnType<typeof api.packages.listCategories>;
  featured: FunctionReturnType<
    typeof api.packages.getFeaturedComponents
  > | null;
  downloadsDisplay: FunctionReturnType<
    typeof api.packages.getDownloadsDisplaySettings
  >;
  listViewSettings: FunctionReturnType<
    typeof api.packages.getListViewSettings
  > | null;
  categoryData: FunctionReturnType<
    typeof api.packages.getCategoryBySlug
  > | null;
};

// How long the bootstrap endpoint gets before the individual queries also
// start. It keeps running after that and can still win.
const DIRECTORY_PAGE_TIMEOUT_MS = 8000;
// How long an attempt can stay pending before another starts alongside it
const ATTEMPT_PATIENCE_MS = 20_000;

function isDirectoryPageData(value: unknown): value is DirectoryPageData {
  const data = value as Partial<DirectoryPageData> | null;
  return (
    Array.isArray(data?.components) &&
    Array.isArray(data.categories) &&
    typeof data.downloadsDisplay === "object" &&
    data.downloadsDisplay !== null
  );
}

// Returns null for anything that isn't a usable page payload, so a bad
// response falls back instead of rendering an empty directory.
async function readDirectoryPage(
  response: Promise<Response | null>,
): Promise<DirectoryPageData | null> {
  const res = await response;
  if (!res?.ok) return null;
  const data = jsonToConvex(await res.json());
  return isDirectoryPageData(data) ? data : null;
}

// How long a loaded catalog counts as fresh before focus, tab switches or
// revisits refetch it
export const CATALOG_REFRESH_AFTER_MS = 60_000;

// Last successful catalog response per URL, so going Back to the directory
// or a category renders straight away instead of showing a skeleton.
const directoryPageCache = new Map<
  string,
  { data: DirectoryPageData; loadedAt: number }
>();

// The default directory view is also saved to localStorage, so a returning
// visitor sees cards as soon as the JS runs instead of waiting on the network.
// The request index.html starts refreshes it straight away.
const STORED_PAGE_KEY = "directoryPage:v1";
const STORED_PAGE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isStoredPage(url: string) {
  return url === directoryPageUrl("downloads");
}

function readStoredPage():
  | { data: DirectoryPageData; loadedAt: number }
  | undefined {
  try {
    const raw = localStorage.getItem(STORED_PAGE_KEY);
    if (!raw) return undefined;
    const stored = JSON.parse(raw) as { data: JSONValue; loadedAt: number };
    const data = jsonToConvex(stored.data);
    const tooOld = !(Date.now() - stored.loadedAt < STORED_PAGE_MAX_AGE_MS);
    // loadedAt 0 marks it stale, so a new page load still revalidates it
    // (using the request index.html started) however recently it was saved
    return !tooOld && isDirectoryPageData(data)
      ? { data, loadedAt: 0 }
      : undefined;
  } catch {
    return undefined;
  }
}

function saveCachedPage(url: string, data: DirectoryPageData) {
  const entry = { data, loadedAt: Date.now() };
  directoryPageCache.set(url, entry);
  if (!isStoredPage(url)) return;
  try {
    localStorage.setItem(
      STORED_PAGE_KEY,
      JSON.stringify({
        data: convexToJson(data as unknown as Value),
        loadedAt: entry.loadedAt,
      }),
    );
  } catch {
    // Storage full or unavailable (private mode): the memory cache still works
  }
}

export function getCachedDirectoryPage(
  sortBy: DirectorySort,
  category?: string,
) {
  const url = directoryPageUrl(sortBy, category);
  let entry = directoryPageCache.get(url);
  if (!entry && isStoredPage(url)) {
    entry = readStoredPage();
    if (entry) directoryPageCache.set(url, entry);
  }
  return entry;
}

// Must build the exact same URL as the inline script in index.html.
function directoryPageUrl(sortBy: DirectorySort, category?: string) {
  const siteUrl =
    (import.meta.env.VITE_CONVEX_SITE_URL as string | undefined) ||
    (import.meta.env.VITE_CONVEX_URL as string).replace(
      ".convex.cloud",
      ".convex.site",
    );
  let url = `${siteUrl}/api/directory-page?sortBy=${sortBy}`;
  if (category) url += `&category=${encodeURIComponent(category)}`;
  return url;
}

// Catalog data for the directory and category pages in one plain GET
// (convex/http.ts /api/directory-page).
//
// Over the websocket this took ~1.5s from Australia: the socket needs an extra
// round trip to the deployment before it can answer, and only starts once the
// JS bundle has loaded. index.html starts this request while the bundle is
// still downloading, so the first call usually resolves straight away. Falls
// back to the individual queries if the endpoint fails, stalls or returns
// something unexpected.
export function fetchDirectoryPage(
  sortBy: DirectorySort,
  category?: string,
  signal?: AbortSignal,
): Promise<DirectoryPageData> {
  // Like the websocket client this replaced, keep trying through a dropped
  // connection instead of failing and leaving the page on its skeleton. A
  // failed attempt is retried with backoff (and straight away when the
  // browser comes back online). A slow one keeps running, since a late
  // success still counts, but after a while another starts alongside it.
  // Aborting the signal (a newer request replaced this one) stops it all.
  return new Promise((resolve, reject) => {
    let settled = false;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      settled = true;
      clearTimeout(retryTimer);
      window.removeEventListener("online", startAttempt);
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      if (settled) return;
      finish();
      reject(new DOMException("Aborted", "AbortError"));
    };
    function startAttempt() {
      if (settled) return;
      const attempt = attempts++;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(startAttempt, ATTEMPT_PATIENCE_MS);
      loadDirectoryPage(sortBy, category, signal).then(
        (data) => {
          if (settled) return;
          finish();
          saveCachedPage(directoryPageUrl(sortBy, category), data);
          resolve(data);
        },
        (error) => {
          // Only the newest attempt decides when to try again
          if (settled || attempt !== attempts - 1) return;
          console.warn("[fetchDirectoryPage] Retrying after error", error);
          clearTimeout(retryTimer);
          retryTimer = setTimeout(
            startAttempt,
            Math.min(30_000, 1_000 * 2 ** attempt),
          );
        },
      );
    }

    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    signal?.addEventListener("abort", abort);
    window.addEventListener("online", startAttempt);
    startAttempt();
  });
}

// One attempt: the bootstrap endpoint, then the individual queries alongside
// it once it has had DIRECTORY_PAGE_TIMEOUT_MS (or as soon as it fails).
// Whichever returns usable data first wins, so a slow response that turns up
// late is still used. Rejects only when both have failed.
function loadDirectoryPage(
  sortBy: DirectorySort,
  category: string | undefined,
  signal: AbortSignal | undefined,
): Promise<DirectoryPageData> {
  const url = directoryPageUrl(sortBy, category);
  const prefetch = window.__directoryPrefetch;
  let request: Promise<Response | null>;
  if (prefetch?.url === url) {
    window.__directoryPrefetch = undefined;
    request = prefetch.response;
  } else {
    request = fetch(url, { signal });
  }

  return new Promise((resolve, reject) => {
    let failures = 0;
    let fallbackStarted = false;
    const stop = () => {
      clearTimeout(fallbackTimer);
      signal?.removeEventListener("abort", onAbort);
    };
    // A newer load replaced this one: don't start the queries at all
    const onAbort = () => {
      stop();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const succeed = (data: DirectoryPageData) => {
      stop();
      resolve(data);
    };
    const fail = () => {
      failures += 1;
      if (!fallbackStarted) {
        startFallback();
      } else if (failures >= 2) {
        stop();
        reject(new Error("Directory data failed to load"));
      }
    };
    const startFallback = () => {
      if (fallbackStarted || signal?.aborted) return;
      fallbackStarted = true;
      loadDirectoryQueries(sortBy, category).then(succeed, fail);
    };
    const fallbackTimer = setTimeout(startFallback, DIRECTORY_PAGE_TIMEOUT_MS);
    signal?.addEventListener("abort", onAbort);
    readDirectoryPage(request).then(
      (data) => (data ? succeed(data) : fail()),
      fail,
    );
  });
}

async function loadDirectoryQueries(
  sortBy: DirectorySort,
  category?: string,
): Promise<DirectoryPageData> {
  const [
    components,
    categories,
    featured,
    downloadsDisplay,
    listViewSettings,
    categoryData,
  ] = await Promise.all([
    httpClient.query(api.packages.listApprovedComponents, { category, sortBy }),
    httpClient.query(api.packages.listCategories, {}),
    category ? null : httpClient.query(api.packages.getFeaturedComponents, {}),
    httpClient.query(api.packages.getDownloadsDisplaySettings, {}),
    category ? null : httpClient.query(api.packages.getListViewSettings, {}),
    category
      ? httpClient.query(api.packages.getCategoryBySlug, { slug: category })
      : null,
  ]);
  return {
    components,
    categories,
    featured,
    downloadsDisplay,
    listViewSettings,
    categoryData,
  };
}
