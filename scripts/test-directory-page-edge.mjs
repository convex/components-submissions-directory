// Checks the directory-page edge function, and the client helper that reads
// how old its copies are, without Netlify or network:
//   node scripts/test-directory-page-edge.mjs
// Node 22.18+ strips the TypeScript types on import. Upstream fetch and
// Deno.env are stubbed.
import assert from "node:assert/strict";
import handler, {
  parseDirectoryPageQuery,
  upstreamDirectoryPageUrl,
  isCacheableUpstream,
} from "../netlify/edge-functions/directory-page.ts";
import { catalogResponseAgeMs } from "../src/lib/catalogAge.ts";

const site = "https://giant-grouse-674.convex.site";
const parse = (qs) => parseDirectoryPageQuery(`?${qs}`);

// Allowlisting: junk is dropped, defaults are shared
assert.deepEqual(parse("sortBy=newest&utm_source=x&cb=123"), {
  sortBy: "newest",
});
assert.deepEqual(parse(""), { sortBy: "downloads" });
assert.deepEqual(parseDirectoryPageQuery(""), { sortBy: "downloads" });
assert.deepEqual(parse("sortBy"), { sortBy: "downloads" });
// Junk that's encoded, malformed or uses ";" is still just dropped
assert.deepEqual(parse("utm%5Fsource=a%26b&bad=%E0%A4%A&x;y=1&sortBy=rating"), {
  sortBy: "rating",
});
assert.deepEqual(parse("sortBy=&category="), { sortBy: "downloads" });
assert.deepEqual(parse("sortBy=downloads&category=durable-functions&x=1"), {
  sortBy: "downloads",
  category: "durable-functions",
});
assert.equal(
  upstreamDirectoryPageUrl(site, parse("category=ai&sortBy=rating&junk=1")),
  `${site}/api/directory-page?sortBy=rating&category=ai`,
);

// Rejected: unknown sorts and anything not shaped like a stored slug
for (const qs of [
  "sortBy=random",
  "sortBy=Downloads",
  "category=AI",
  "category=../admin",
  "category=a%26sortBy%3Dnewest",
  "category=a b",
  `category=${"a".repeat(81)}`,
  // Ambiguous spellings Netlify's cache key might read differently
  "sort%42y=newest&sortBy=downloads",
  "sort%42y=newest",
  "%73ortBy=newest",
  "SortBy=newest",
  "SORTBY=newest&sortBy=downloads",
  "sortBy=newest&sortBy=downloads",
  "sortBy=downloads&sortBy=downloads",
  "sortBy=downloads&category=ai&category=data",
  "categor%79=ai",
  "Category=ai",
  "sortBy=%6Eewest",
  "sortBy=newest%20",
  "sortBy=new+est",
  "category=a%69",
  "category=ai%2F",
  "x=1;sortBy=newest",
  "sortBy=downloads;sortBy=newest",
  "category=ai;x=1",
]) {
  assert.equal(parse(qs), null, qs);
}

// Only a 200 with a JSON object body is cacheable
const json = "application/json; charset=utf-8";
assert.equal(isCacheableUpstream(200, json, '{"components":[]}'), true);
assert.equal(isCacheableUpstream(500, json, '{"error":1}'), false);
assert.equal(isCacheableUpstream(400, "text/plain", "Invalid sortBy"), false);
assert.equal(isCacheableUpstream(200, "text/html", "<!doctype html>"), false);
assert.equal(isCacheableUpstream(200, json, "{trunc"), false);
assert.equal(isCacheableUpstream(200, json, "null"), false);

// Handler, with upstream stubbed
globalThis.Deno = { env: { get: () => undefined } };
let upstreamCalls = [];
let nextUpstream;
globalThis.fetch = async (url) => {
  upstreamCalls.push(String(url));
  return nextUpstream();
};
const run = (path, method = "GET") =>
  handler(new Request(`https://example.com${path}`, { method }));

// Cacheable 200: fresh headers, no upstream encoding or length copied
nextUpstream = () =>
  new Response('{"components":[],"categories":[]}', {
    status: 200,
    headers: {
      "content-type": json,
      "content-encoding": "gzip",
      "content-length": "999",
      "cache-control": "no-cache",
      "access-control-allow-origin": "*",
    },
  });
let res = await run(
  "/components/api/directory-page?sortBy=downloads&category=ai&evil=1",
);
assert.equal(res.status, 200);
assert.deepEqual(upstreamCalls, [
  `${site}/api/directory-page?sortBy=downloads&category=ai`,
]);
assert.equal(
  res.headers.get("netlify-cdn-cache-control"),
  "public, s-maxage=600",
);
assert.equal(res.headers.get("netlify-vary"), "query=sortBy|category");
assert.equal(res.headers.get("cache-control"), "no-cache");
assert.equal(res.headers.get("content-type"), json);
assert.equal(res.headers.get("content-encoding"), null);
assert.equal(res.headers.get("access-control-allow-origin"), null);
assert.ok(res.headers.get("x-directory-page-fetched-at"));
assert.equal(await res.text(), '{"components":[],"categories":[]}');

// Upstream errors pass through uncached
nextUpstream = () =>
  new Response("Server error", {
    status: 500,
    headers: { "content-type": "text/plain" },
  });
res = await run("/components/api/directory-page?sortBy=newest");
assert.equal(res.status, 500);
assert.equal(res.headers.get("cache-control"), "no-store");
assert.equal(res.headers.get("netlify-cdn-cache-control"), null);
assert.equal(await res.text(), "Server error");

// A 200 that isn't JSON becomes an uncached 502
nextUpstream = () =>
  new Response("<html></html>", {
    status: 200,
    headers: { "content-type": "text/html" },
  });
res = await run("/components/api/directory-page");
assert.equal(res.status, 502);
assert.equal(res.headers.get("netlify-cdn-cache-control"), null);
assert.equal(res.headers.get("cache-control"), "no-store");

// Network failure: uncached 502
nextUpstream = () => {
  throw new TypeError("network down");
};
res = await run("/components/api/directory-page");
assert.equal(res.status, 502);
assert.equal(res.headers.get("netlify-cdn-cache-control"), null);

// Invalid params never reach upstream and aren't cached
upstreamCalls = [];
res = await run("/components/api/directory-page?sortBy=bogus");
assert.equal(res.status, 400);
assert.equal(res.headers.get("cache-control"), "no-store");
assert.equal(res.headers.get("netlify-cdn-cache-control"), null);
res = await run(
  "/components/api/directory-page?sort%42y=newest&sortBy=downloads",
);
assert.equal(res.status, 400);
assert.equal(res.headers.get("netlify-cdn-cache-control"), null);
res = await run(
  "/components/api/directory-page?sortBy=newest&sortBy=downloads",
);
assert.equal(res.status, 400);
// GET only, HEAD included
for (const method of ["POST", "HEAD", "OPTIONS"]) {
  res = await run("/components/api/directory-page", method);
  assert.equal(res.status, 405, method);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("netlify-cdn-cache-control"), null);
}
assert.deepEqual(upstreamCalls, []);

// A body that fails part way (reset, or the timeout firing mid-body) is an
// uncached 502, not an unhandled error
nextUpstream = () =>
  new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"components":['));
        controller.error(new TypeError("connection reset"));
      },
    }),
    { status: 200, headers: { "content-type": json } },
  );
res = await run("/components/api/directory-page");
assert.equal(res.status, 502);
assert.equal(res.headers.get("cache-control"), "no-store");
assert.equal(res.headers.get("netlify-cdn-cache-control"), null);

// Age of a response: the larger of Date minus fetched-at and Age, using
// whichever parse, else 0 (fresh)
const age = (headers) => catalogResponseAgeMs(new Headers(headers));
const fetchedAt = "2026-10-22T05:00:00.250Z";
// A hit stored 5 minutes ago
assert.equal(
  age({
    date: "Thu, 22 Oct 2026 05:05:00 GMT",
    "x-directory-page-fetched-at": fetchedAt,
    age: "299",
  }),
  299_750,
);
// A miss: Date has whole seconds, so it can be just before fetched-at
assert.equal(
  age({
    date: "Thu, 22 Oct 2026 05:00:00 GMT",
    "x-directory-page-fetched-at": fetchedAt,
  }),
  0,
);
// Age wins when it's larger (a proxy that reset Date to fetch time)
assert.equal(
  age({
    date: "Thu, 22 Oct 2026 05:00:01 GMT",
    "x-directory-page-fetched-at": fetchedAt,
    age: "240",
  }),
  240_000,
);
// A proxy that dropped or zeroed Age: Date minus fetched-at still counts
assert.equal(
  age({
    date: "Thu, 22 Oct 2026 05:03:00 GMT",
    "x-directory-page-fetched-at": fetchedAt,
    age: "0",
  }),
  179_750,
);
// A proxy that moved Date backwards still counts as fresh, not negative
assert.equal(
  age({
    date: "Thu, 22 Oct 2026 04:00:00 GMT",
    "x-directory-page-fetched-at": fetchedAt,
  }),
  0,
);
// ...unless Age says otherwise
assert.equal(
  age({
    date: "Thu, 22 Oct 2026 04:00:00 GMT",
    "x-directory-page-fetched-at": fetchedAt,
    age: "90",
  }),
  90_000,
);
// Absurdly old counts as a day, which is stale
assert.equal(
  age({
    date: "Thu, 29 Oct 2026 05:00:00 GMT",
    "x-directory-page-fetched-at": fetchedAt,
  }),
  24 * 60 * 60 * 1000,
);
assert.equal(age({ age: "9999999" }), 24 * 60 * 60 * 1000);
// Falls back to Age when either timestamp is missing or unparseable
assert.equal(age({ age: "39" }), 39_000);
assert.equal(age({ age: " 7 ", date: "Thu, 22 Oct 2026 05:00:00 GMT" }), 7_000);
assert.equal(
  age({ age: "12", date: "garbage", "x-directory-page-fetched-at": fetchedAt }),
  12_000,
);
// Nothing usable: fresh
assert.equal(age({}), 0);
assert.equal(age({ age: "-5" }), 0);
assert.equal(age({ age: "1e3" }), 0);
assert.equal(age({ "x-directory-page-fetched-at": fetchedAt }), 0);

console.log("directory-page edge function: all checks passed");
