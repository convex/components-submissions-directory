# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Component pages load faster on a cold visit (2026-10-22 05:30 UTC)
  - og-meta now sends `Netlify-CDN-Cache-Control: public, s-maxage=3600` for approved component pages (was an `s-maxage=300` in Cache-Control only). Netlify's edge cache is per node and a region has several nodes, so with ~180 components most cold visits missed it and waited ~1s TTFB on the Convex lookup (0.21-0.24s on a hit). Netlify ignores `durable` and `stale-while-revalidate` for edge function responses, so a longer per-node lifetime is the lever. OG/SEO tags, the hidden prerender copy and the embedded component data can lag an edit by up to an hour; the client loads live data straight after the first render, and deploys purge the cache. Browser `Cache-Control` is unchanged. 404s, Convex lookup failures and non-component routes are still not cached.
  - og-meta drops the static index.html's `ETag` and `Content-Length` from component pages it rewrites. Every component page shared one ETag for the whole deploy, so a browser revalidating after `max-age` could be told an older copy was current.
  - og-meta also embeds the component it already fetched as `<script type="application/json" id="component-data">` before `</body>`, with `<`, `>`, `&`, U+2028 and U+2029 escaped. `useComponentBySlug` starts from it for that slug, so the first render no longer waits on the CORS-preflighted `/api/query` POST (OPTIONS ~0.38s then POST ~0.36-0.50s from Perth). The HTTP query and live subscription still run as before and replace it. The block is read once and removed, so client-side navigation to other components is unaffected. It isn't executable, so the CSP's script hashes don't apply.
  - Files: `netlify/edge-functions/og-meta.ts`, `src/lib/convexHttp.ts`, `tests/og-meta-component-data.test.ts` (new)

### Fixed

- Logos, social icons and favicons are cached, and directory links skip the www trailing slash redirect (2026-10-22 05:30 UTC)
  - The root SVGs and favicons under `/components/` went through the `og-meta` edge function, which passed them straight through with `max-age=0, must-revalidate`, so every visit revalidated them. `og-meta` now skips `/components/*.svg`, `*.png`, `*.ico` and `*.webp` via `excludedPath`, and `netlify/_headers` gives the linked files `public, max-age=86400, stale-while-revalidate=604800` (not immutable, since they are not content-hashed).
  - Favicon links in `index.html` were relative, so they resolved against the page URL: from `www.convex.dev/components` they pointed at the Next.js site's root, and from `/components/categories/<slug>` at SPA routes that return HTML. They now start with `/`, which Vite turns into `/components/...`. The duplicate `shortcut icon` link is gone and the 128px link points at the real `favicon-128x128.png`.
  - The "All" and "Directory" links, the redirect targets, header search and the component page's back and category links point at `/components` instead of `/components/`, which www.convex.dev 308 redirects. The router and the catalog prefetch already treat both as the same page.
  - Files: `netlify.toml`, `netlify/_headers`, `index.html`, `src/main.tsx`, `src/components/CategorySidebar.tsx`, `src/components/Header.tsx`, `src/components/HeaderSearch.tsx`, `src/pages/Directory.tsx`, `src/pages/CategoryPage.tsx`, `src/pages/ComponentDetail.tsx`, `src/pages/SubmitForm.tsx`, `src/pages/Documentation.tsx`, `src/docs/directory.md`

- Official components show the Convex avatar and author link again after the GitHub org rename (2026-10-16 07:20 UTC)
  - GitHub renamed `get-convex` to `convex`. Repo URLs still redirect, but `github.com/get-convex.png` and `github.com/get-convex` return 404, so 28 official cards had a broken avatar and a dead author link.
  - `parseRepoUrl` maps `get-convex` to `convex` for GitHub owners, so new submissions, admin auto-fill, the author link and GitHub API calls use the current org even when npm metadata still says `get-convex`. Avatars are mapped at render time as a safety net.
  - Official membership accepts both org names. Directory search for "get-convex" still finds the official components.
  - Header, footer, submit page and README template links point at `github.com/convex`. The official llms.txt and markdown headers link to `github.com/convex`.
  - No URLs changed: `/components/categories/get-convex`, `/components/get-convex.md`, `/components/get-convex-llms.txt` and every component page, markdown, llms.txt and SKILL.md route stay the same.
  - New `convex/orgRename.ts` migration rewrites stored repo URLs, author names, avatars and the official category description. Verified on dev: 24 repo URLs and 11 authors updated, rerun changed nothing.
  - Files: `shared/repoUrl.ts`, `shared/officialComponents.ts`, `src/lib/images.ts`, `src/pages/ComponentDetail.tsx`, `src/pages/Directory.tsx`, `src/pages/Admin.tsx`, `src/pages/Submit.tsx`, `src/components/Header.tsx`, `src/components/Footer.tsx`, `src/components/FooterBackup.tsx`, `src/components/ReadmePreviewNotice.tsx`, `src/components/ComponentDetailsEditor.tsx`, `convex/http.ts`, `convex/packages.ts`, `convex/orgRename.ts` (new), `src/docs/api-endpoints.md`

### Added

- Every category gets its own llms.txt and markdown file (2026-10-12 17:30 UTC)
  - `/components/<slug>-llms.txt` and `/components/<slug>.md` for any enabled category, in the same format as the official `get-convex` files. They're built on each request, so approving a component, editing a curated list or renaming a category updates them with no extra step. Disabled or unknown categories return 404.
  - A For Agents section at the bottom of each category page links to both files and to the full directory files.
  - Admin > Category Management shows each enabled category's agent file links, and the edit form warns that changing a slug moves the page and its files.
  - The root `llms.txt` lists the per-category URLs, and `components.md` gets a "Browse by category" section. Markdown section headings now use the admin-set category labels.
  - The category page and the agent files share one membership rule, so they can't disagree. The slug `components` is reserved because it would clash with `components.md`.
  - Files: `convex/packages.ts`, `convex/http.ts`, `shared/categoryUrls.ts` (new), `netlify/edge-functions/og-meta.ts`, `src/pages/CategoryPage.tsx`, `src/pages/Admin.tsx`, `src/docs/api-endpoints.md`

### Changed

- The directory catalog comes from Netlify's edge cache instead of the US deployment (2026-10-22 UTC)
  - New `directory-page` edge function serves `/components/api/directory-page`, a same-origin copy of the Convex `/api/directory-page` catalog. Each Netlify edge node keeps its copy for up to 10 minutes (`Netlify-CDN-Cache-Control: public, s-maxage=600`), because the cache is per node and a 60s lifetime left most nodes cold. Every deploy purges it. On a draft deploy a hit answered in ~0.20s TTFB from Perth versus ~0.9s total from convex.site.
  - Freshness is handled by the client: it works out how old the copy is from server headers (the larger of `Date` minus `X-Directory-Page-Fetched-At` and `Age`; never the device clock) and gives the cache entry a matching `loadedAt`. A copy over a minute old is shown straight away and then refreshed straight from `.convex.site` once the browser is idle, so visitors see current data within a couple of seconds either way. Most edge hits are over a minute old, so this refresh is the normal case: when the response is byte for byte the one on screen, the grid isn't re-rendered (only `loadedAt` and localStorage are updated). A copy under a minute old causes no second request. Focus and tab-switch refreshes also go straight to Convex, since the data is already on screen. `index.html` adds a `dns-prefetch` for `.convex.site` in production builds for that refresh.
  - Only `sortBy` and `category` reach Convex or the cache key (`Netlify-Vary: query=sortBy|category`). They're read from the raw query string, and anything Netlify's cache key could read differently (a repeated name, a percent-encoded or differently cased name, an encoded value, a `;` separator) gets an uncached 400, so one view's catalog can't be cached under another's key. Only GET is served (HEAD gets a 405). Errors, non-JSON answers and bodies that fail mid-read are never cached. Browsers still get `Cache-Control: no-cache`. og-meta now skips all of `/components/api/*`, so a trailing slash no longer reaches it as a component slug.
  - Headers are built fresh instead of copied from upstream, so Netlify can serve the JSON with brotli.
  - `index.html` and `src/lib/convexHttp.ts` use the same-origin path in production builds and `.convex.site` under `vite dev`. If the same-origin request fails the client retries `.convex.site`, then falls back to the individual queries as before. The convex.cloud preconnect stays (websocket and component page queries).
  - Files: `netlify/edge-functions/directory-page.ts` (new), `src/lib/catalogAge.ts` (new), `netlify.toml`, `index.html`, `src/lib/convexHttp.ts`, `src/pages/Directory.tsx`, `src/pages/CategoryPage.tsx`, `scripts/test-directory-page-edge.mjs` (new)

- Smaller entry bundle: the component page and submit form load on demand (2026-10-22 05:20 UTC)
  - The entry chunk every first visit downloads drops from 626 KB to 480 KB minified (143 KB to 116 KB brotli). `ComponentDetail` (with `InstallCommand`, `AgentInstallSection` and friends) and `SubmitForm` (with sonner, `DocSectionEditor` and `AiLoadingDots`) were imported eagerly in `main.tsx`. sonner is now only in the lazy pages that mount their own `<Toaster>`.
  - Opening a component from the directory doesn't wait for the new chunk: it is preloaded when the browser is idle after the directory or a category page has rendered its cards, and again when a component link is hovered or touched. React's `use()` renders an already loaded chunk straight away, and the page's own loading skeleton (now `ComponentDetailSkeleton`) is the Suspense fallback otherwise, so there is no blank frame or layout shift.
  - A component page opened directly (search results, README badges) doesn't wait for the entry to learn about the chunk either. A small inline script added to `index.html` at build time adds `modulepreload` links for the `ComponentDetail` chunk and its small static imports on component page paths only, so they download alongside the entry. The README renderer still loads on its own, as before.
  - Hovering or touching the Submit link starts loading the submit form. The header stays on screen while it loads, and a preloaded form opens without a blank frame (both pages read their chunk with `use()` rather than `React.lazy`, which always suspends once and then makes React hold the page back for ~300ms).
  - A direct visit to a component page renders once its chunk has arrived, so React doesn't commit the skeleton and then hold the page back for the same ~300ms.
  - A page chunk that fails to load (offline, or a tab left open across a deploy) shows the "Something went wrong" reload prompt instead of the skeleton forever. Hovering a link or opening another page tries again.
  - When the retry for a page also fails and the browser is online, the page reloads once to pick up the new build (a tab left open across a deploy asks for chunk files that no longer exist). It reloads at most once per build per tab (keyed by the entry chunk's URL in sessionStorage), so a chunk that really can't load still shows the prompt.
  - `netlify/_redirects` answers missing `/components/assets/*` files with a 404. Before, the SPA fallback served `index.html` there with a 200 and the year-long immutable cache header, so a stale chunk failed slowly and the HTML could be cached under the asset URL.
  - Files: `src/main.tsx`, `src/lib/chunkLoader.ts` (new), `src/lib/componentDetailChunk.ts` (new), `src/components/ComponentDetailSkeleton.tsx` (new), `src/pages/ComponentDetail.tsx`, `src/pages/Directory.tsx`, `src/pages/CategoryPage.tsx`, `vite.config.ts`

- The page paints a static header and card skeleton before the JS runs (2026-10-22 05:22 UTC)
  - `#root` in `index.html` now holds a static copy of React's first frame: the site header as `Header.tsx` renders it while auth loads, and on `/components` and `/components/categories/<slug>` the title, sidebar, search and sort row and the loading card grid from `Directory.tsx` and `CategoryPage.tsx`. It paints as soon as the HTML and CSS arrive, instead of a blank page until the bundle runs (~0.8s on a phone). `createRoot()` replaces it on mount.
  - A small inline script before it sets `data-shell` on `<html>` from the URL, and rules at the end of `src/index.css` hide what doesn't belong: component, submit, profile, admin and 404 pages get the header only, and `/components/callback` and `/components/submissions` (which render without a header) get nothing, as before. It also picks the list skeleton for visitors who chose list view, and hides the skeleton cards when the catalog is saved in localStorage, since those visitors get real cards as soon as the JS runs.
  - Header links are real `<a href>`s that work without JS, and links to the directory root use `/components` (no trailing slash). Skeleton parts are `aria-hidden` with a visually hidden "Loading components" status, the JS-only buttons and search inputs are `inert` so a tap can't focus them before React mounts, and the pulse only runs without `prefers-reduced-motion`.
  - The saved-catalog check parses `directoryPage:v1` and applies the same 7 day limit as `readStoredPage()`, so a broken or expired entry still gets skeleton cards.
  - The Suspense fallback for lazy routes now renders the header, so the static header doesn't disappear while a route's chunk loads.
  - `og-meta` inserts its hidden crawler copy at the start of `#root` instead of only replacing an empty `#root`, so component pages keep their crawlable content. It matches the `#root` tag loosely and logs a warning if it can't find it.
  - Size: built `index.html` 6.1 KB to 23.7 KB raw, 1.5 KB to 5.4 KB brotli. Main CSS +4.1 KB raw, +0.4 KB brotli.
  - Files: `index.html`, `src/index.css`, `src/main.tsx`, `netlify/edge-functions/og-meta.ts`

- `convex-helpers` bumped to ^0.1.128 and `package-lock.json` is now committed (2026-10-13, pulled 2026-10-16 06:30 UTC)
  - From upstream #46 and #47. `package-lock.json` is no longer in `.gitignore`, so `npm install` gives everyone the same dependency tree.
  - Files: `package.json`, `package-lock.json`, `.gitignore`

- Approval messages no longer mention the preflight check (2026-10-15 20:45 UTC)
  - Removed the "Shipping a new version? Run the Component Preflight Check first..." paragraph and its link from the approved component message. It now ends with the thank you and the "Questions or changes to the listing? Reply here." line.
  - Rejection messages still point to the preflight check. Drafts already saved in User Messages keep their old text until edited or regenerated.
  - Files: `shared/reviewMessages.ts`

- Existing agent files keep their URLs, with small content updates (2026-10-12 17:32 UTC)
  - Checked against prod: `llms.txt`, `components.md`, `get-convex-llms.txt`, `get-convex.md`, `sitemap.xml` and every `/components/<slug>/llms.txt` and `/components/<slug>/<leaf>.md` route the same way as before. No prod component slug matches the new single segment pattern, and `/components/<category>.md` only served the HTML app shell before.
  - `llms.txt` gains one header line listing the per-category files. `components.md` gains a "Browse by category" section.
  - Section headings in `components.md` and `get-convex.md` now use the Admin labels instead of a hardcoded list, for example `## Auth` becomes `## Authentication`, `## AI` becomes `## AI Agents` and `## ai-infrastructure` becomes `## AI Infrastructure`. Component entries are unchanged.

- README badges now match the npm version badge they sit under (2026-10-12 16:59 UTC)
  - Convex component READMEs show a badge.fury.io `npm package` badge, not a shields.io one. Fury draws DejaVu Sans as vector outlines with a white stroke and a crisp shadow, so next to it our Verdana `<text>` badge looked thin and stretched, especially on iPhone.
  - `renderBadge` now draws text the same way: DejaVu Sans 11px glyph outlines, 0.3px white stroke, a 1px `#010101` shadow with no blur, fury's padding and kerning, and fury's background draw order. Rendering `npm package | 2.1.5` through it matches the live fury SVG width, split and every glyph point within 0.001px (also checked against pypi and gem badges).
  - The outline is defined once and drawn twice with `<use>`, so a typical badge is about 13 KB. Status colors are unchanged.
  - Local preview page shows the convex.dev pairing at 1x and 3x next to the live fury badge.
  - Files: `convex/badgeSvg.ts`, `convex/badgeGlyphs.ts` (new), `convex/http.ts`, `src/docs/badges.md`, `src/docs/api-endpoints.md`, `badge-palette-preview.html`

### Security

- Uploaded files can't run as pages on www.convex.dev (2026-10-08 13:11 UTC)
  - `/components/_src/<storageId>` proxied any Convex storage file to www.convex.dev with its stored content type, and any signed-in user can upload. An uploaded HTML or SVG file would have run as a page there.
  - The new `component-image-source` edge function serves that path instead. It passes through raster images only (PNG, JPEG, WebP, GIF, AVIF), with `nosniff` and a `sandbox` CSP, and returns a 404 for anything else. The `_redirects` rewrite stays as the fallback for Image CDN source fetches.
  - `saveThumbnail` and `saveLogo` check the stored file type on the server: PNG, JPEG or WebP for thumbnails, plus SVG for logos (shown only from Convex storage URLs in `<img>`).
  - Files: `netlify/edge-functions/component-image-source.ts`, `netlify.toml`, `netlify/_redirects`, `convex/packages.ts`

- Submitter markdown is sanitized before the detail page renders it (2026-10-08 12:30 UTC)
  - README blocks, long descriptions, use cases and how it works were rendered with `rehype-raw` and no sanitizer, so raw HTML from a submission or a README marker block (for example `<iframe srcdoc="<script>...">`) ran on www.convex.dev.
  - `MarkdownRenderer` now runs `rehype-sanitize` after `rehype-raw` with a GitHub-style allowlist (`src/lib/markdownSanitize.ts`). Scripts, styles, iframes, objects, embeds, forms, meta/link/base, `srcdoc`, event handlers, `style` attributes and `javascript:` URLs are dropped. Images, `<picture>`, tables, `<details>`, alerts, code blocks, footnotes and `<video>` render as before.
  - The same fields are cleaned when saved (`shared/sanitizeMarkdown.ts`): `submitPackage`, `updateMySubmission`, README fetches, AI generated content and the admin editors. Code blocks are left alone. This keeps the REST API, llms.txt, SKILL.md and markdown exports clean too.
  - The save-time cleanup checks every way the page could read the markdown: GFM (footnotes, tables), plain CommonMark, and the `normalizeMarkdown` pass that can split inline code into list items. Tags are found with a linear tokenizer, so huge or malformed input can't stall a save.
  - `seoContentDb:findUnsafeMarkdown` (internal, read only) lists stored rows that still hold unsafe HTML, plus rows whose raw text mentions an iframe, script, `srcdoc` or `javascript:` URL.
  - Files: `src/components/MarkdownRenderer.tsx`, `src/lib/markdownSanitize.ts`, `shared/sanitizeMarkdown.ts`, `convex/packages.ts`, `convex/seoContent.ts`, `convex/seoContentDb.ts`, `package.json`

- Unapproved component pages are only shown to their owner and admins (2026-10-08 12:30 UTC)
  - `getComponentBySlug` returned pending, in review, changes requested and rejected packages to anyone, so a new submission was live on www.convex.dev before review. Everyone else now gets the 404 state, and `og-meta` returns a 404 status. Approved pages are unchanged.
  - `useComponentBySlug` waits for Convex auth before treating a `null` as not found, so owners don't see a 404 flash.
  - The per-component endpoints behind `/components/<slug>/<slug>.md`, `/SKILL.md` and `/llms.txt`, and the REST `detail`, `install` and `docs` endpoints, also return 404 until a component is approved. They used to serve submitter-written content, SKILL.md included, as soon as a submission had a slug.
  - Files: `convex/packages.ts`, `convex/http.ts`, `src/lib/convexHttp.ts`

- Content-Security-Policy for the app's HTML (2026-10-08 12:30 UTC)
  - The build adds a CSP `<meta>` tag: `script-src 'self'` plus a hash for the inline catalog prefetch script and `https://ap.convex.dev` (PostHog), `worker-src 'self' blob:`, `object-src 'none'`, `base-uri 'self'`. Injected markup can't run inline script, including inside an `<iframe srcdoc>`.
  - A meta tag rather than a header because every HTML route goes through the `og-meta` edge function, where `netlify/_headers` rules don't apply.
  - Files: `vite.config.ts`

- Manual security scans are admin only (2026-10-08 12:30 UTC)
  - `runSecurityScan` was documented as admin only but only checked that the caller was signed in, so any signed-in user could start scans, spending Socket.dev and Snyk quota and posting to the team Slack channel. It now calls `requireAdminIdentity`. The admin dashboard's scan button is the only caller and is unaffected.
  - Files: `convex/securityScan.ts`

### Added

- Video position on component pages (top or bottom) (2026-10-03 00:42 UTC)
  - Component videos now show at the top of the detail page, just below the install command, instead of after the README. Most visitors never scrolled down far enough to see them.
  - Admins can move a video back to the bottom per component with the new "Video Position on Component Page" select in the Component Details editor. It saves with the rest of the details.
  - Backed by a new optional `videoPosition` field (`"top"` or `"bottom"`) on `packages`. Unset means top, so every existing component with a video moves to the top once this is live.
  - Files: `convex/schema.ts`, `convex/packages.ts`, `src/pages/ComponentDetail.tsx`, `src/components/ComponentDetailsEditor.tsx`, `src/pages/Admin.tsx`

- Show all thumbnails on a category page (2026-10-02 16:52 UTC)
  - New "Show all thumbnails on the category page" checkbox in the category edit form under Settings > Category Management. It shows every available thumbnail on that category's landing page, including components marked "Hide thumbnail in category listings".
  - The Directory homepage is unaffected: grouped sections, Featured, Other, and list view keep their current thumbnail rules, so you can keep the homepage grid even and still show a full image grid on a page like Official Convex Components.
  - It can't be on at the same time as "Hide all thumbnails in this category". Checking one clears the other, and the backend enforces the same rule. Both options now have one line of helper text explaining where they apply, and categories with the new option on show a "thumbnails shown on page" badge.
  - Backed by a new optional `showAllThumbnails` field on `categories`. Existing rows default to off.
  - PRD: `prds/category-show-all-thumbnails.md`

- Load performance retro and agent skill (2026-10-01 19:19 UTC)
  - `prds/directory-load-performance-retro.md` documents the 2026-09-30 perf pass (PRs #34 to #42): what changed, the before and after numbers, why it didn't ship from the start, and follow ups.
  - New `directory-load-performance` skill in `.cursor/skills/`, `.claude/skills/` and `.codex/skills/` so agents apply the same patterns to new public pages: bootstrap GET from `index.html`, localStorage cache, client navigation, lazy analytics and markdown, sized thumbnails, Netlify `_headers`/`_redirects`, and a pre ship checklist.
  - Three new entries in `prds/lessons.md`: verify live headers with `curl -I`, measure from a distant region, and prove the lint script catches a known error.

### Changed

- Returning visitors see the directory's cards straight away (2026-09-30)
  - The default directory view is saved to localStorage after each load and shown as soon as the JS runs on the next visit, while the request `index.html` already starts refreshes it in the background. Locally, cards appeared at ~190ms on a return visit instead of ~890ms.
  - Versioned key, shape check, a 7-day limit, and silent fallback when storage is unavailable or full.
  - Files: `src/lib/convexHttp.ts`

### Changed

- Moving around the directory no longer reloads the page (2026-09-30)
  - Links to directory pages now update the URL in place instead of doing a full page load, so the JS, the Convex websocket (about 900ms to open from Australia) and loaded data stay alive between pages. Files, API routes, the OAuth callback, other sites and modified clicks (new tab, etc.) still load normally.
  - Back restores the directory's search, sort, "load more" progress and scroll position, and renders from the session's cached catalog instead of a skeleton. Category pages are cached the same way.
  - Resting the pointer on a component link (or touching it) prefetches its data and the README renderer, so the page usually renders straight away when opened.
  - The canonical link follows the current page and the title, description and social tags reset between pages. Redirects (bare `/components/categories`, the submissions gate, admin and dashboard access) no longer reload.
  - Category pages restore their page, search and sort on Back too. Page state is saved when a history entry is left rather than on every change (Safari rate-limits history writes), and a refused history write falls back to a normal page load.
  - Files: `src/lib/router.ts` (new), `src/main.tsx`, `src/lib/convexHttp.ts`, `src/pages/Directory.tsx`, `src/pages/CategoryPage.tsx`, `src/pages/NotFound.tsx`, `src/pages/Profile.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Admin.tsx`, `src/components/HeaderSearch.tsx`, `src/components/CategorySidebar.tsx`

- Analytics load after the page instead of before it (2026-09-30)
  - posthog-js (~180 KB minified, 53 KB brotli) came in through the shared analytics provider wrapped around the app, so every visitor downloaded and parsed it before the first render. `DeferredWebAnalytics` now renders the provider next to the app and loads it once the page has loaded and the browser is idle. Nothing in the app reads its consent context.
  - Entry bundle: 1,093 KB to 907 KB minified (266 KB to 213 KB brotli).
  - Files: `src/components/DeferredWebAnalytics.tsx` (new), `src/main.tsx`

### Fixed

- Netlify now applies our header and redirect rules (2026-09-30)
  - Netlify ignores `[[headers]]` and `[[redirects]]` in netlify.toml on this site, so hashed JS/CSS and fonts were served with `max-age=0` and every visit re-checked them. The `/api/components/*` proxy and the `/components/images/*` 404 rule never applied either. The rules now live in `netlify/_headers` and `netlify/_redirects`, which `vite.config.ts` copies to the publish root.
  - Component page HTML is cached at Netlify's edge (`cache = "manual"` on og-meta), so repeat requests skip the Convex lookup. Cached responses are purged on each deploy.
  - Stopped tracking the stale `.netlify/` build folder.
  - Files: `netlify.toml`, `netlify/_headers` (new), `netlify/_redirects` (new), `vite.config.ts`, `.gitignore`

### Changed

- Thumbnails, avatars and fonts load far fewer bytes (2026-09-30)
  - Component thumbnails are stored as full-size PNGs (median 2.4 MB, 111 MB across 72, some 3840x2160) but render ~360px wide. Public pages now request resized WebP/AVIF variants through Netlify Image CDN (`/components/_img/<width>/<storageId>`, with storage proxied under `/components/_src` so it counts as a local source), with `srcset`/`sizes` per layout and a fallback to the original image if a variant fails.
  - The first row of Featured cards loads its thumbnails eagerly with `fetchpriority="high"`, since one of them is usually the page's largest paint.
  - GitHub avatars request `?size=64` instead of the ~460px original (about 1.7 KB instead of 61 KB).
  - Dropped the Publico Headline font preload. No public page uses Publico, so it was a wasted 52 KB on every load.
  - Files: `src/lib/images.ts` (new), `src/components/ComponentCard.tsx`, `src/components/ComponentListRow.tsx`, `src/pages/ComponentDetail.tsx`, `src/pages/Directory.tsx`, `netlify.toml`, `netlify/_redirects`, `netlify/edge-functions/og-meta.ts`, `index.html`

- Directory and category pages load much faster, especially far from the deployment (2026-09-30)
  - Catalog data now comes from one plain GET (`/api/directory-page`) that `index.html` starts while the JS bundle downloads. The endpoint reads everything in one internal query, so the list, counts and featured row share a snapshot. Before, the page waited for the bundle, then opened the Convex websocket (~900ms to open from Australia), then ran five queries (~560ms more). Locally with prod data, cards appear in ~0.9s instead of ~1.5s, and the real site also stops paying the bundle download before the data request starts.
  - The markdown renderer (react-markdown, rehype-raw/parse5, micromark) moved to a lazy chunk. Entry bundle is 757 KB instead of 1,096 KB minified (181 KB instead of 266 KB brotli). Component pages preload it on mount.
  - Preconnect to the Convex deployment for the detail page's HTTP query and the websocket.
  - If the endpoint fails, stalls for 8s or returns something unexpected, the pages fall back to the individual public queries. Load failures are caught and logged instead of leaving an unhandled rejection.
  - Files: `index.html`, `convex/http.ts`, `convex/directoryPage.ts` (new), `src/lib/convexHttp.ts`, `src/pages/Directory.tsx`, `src/pages/CategoryPage.tsx`, `src/pages/ComponentDetail.tsx`, `src/components/Markdown.tsx`, `src/components/MarkdownRenderer.tsx` (new), `src/lib/markdownChunk.ts` (new)

### Added

- Monorepo-aware component lookup for the preflight check and admin AI review (2026-09-26 08:14 UTC)
  - A new locator reads the whole repo tree once (GitHub Trees API, GitLab recursive tree) instead of guessing folders. It respects `/tree/<branch>/<folder>` URLs, handles branch names with slashes, and picks the component whose `package.json` name matches the npm package when a repo has several.
  - When a URL doesn't point at exactly one component, the check stops before any AI call and explains why, with fix links: `repo_not_found`, `branch_not_found`, `dir_has_no_component`, `multiple_components`.
  - `/api/preflight` returns `422 { error, code, suggestions, status: "error" }` for these. For signed-in users these don't count against the limit; for guests they do. Success responses now include `reviewedPath` and `reviewedRef`.
  - Preflight page: a live "Checking packages/x on branch main" hint under the URL field, monorepo help text, "Check this one" buttons on each suggestion, a "Reviewed X on Y" line in results, and Continue to Submit now carries the URL into the submit form (even through sign-in).
  - Files: `convex/repoLocator.ts` (new), `convex/aiReview.ts`, `convex/gitlabApi.ts`, `convex/preflight.ts`, `convex/http.ts`, `convex/schema.ts` (optional `reviewedPath`, `reviewedRef` on `preflightChecks`), `src/pages/SubmitCheck.tsx`, `src/pages/SubmitForm.tsx`, `prds/monorepo-aware-preflight.md`
- Folder URL tip for monorepo submissions (2026-09-26 08:32 UTC)
  - Checking a monorepo root like `https://github.com/daytona/integrations` still works, and the results now suggest the package folder (`.../tree/main/packages/convex`) with a Use folder URL button. The directory reads the README from that folder, so the component page shows the component's own README instead of the monorepo's.
  - `/api/preflight` success and cached responses include `suggestedRepoUrl` when the checked URL isn't the component's package folder (new optional `preflightChecks.suggestedRepoUrl`).
  - Submit form: monorepo help line under Repository URL. A `?repoUrl=` from the preflight now replaces a saved draft's repo URL (other draft fields are kept) and is removed from the address bar after sign-in.

### Fixed

- README code blocks tagged `txt`, `plaintext` or `plain`, or with a language Shiki doesn't bundle, now render as plain text. Before, `@pierre/diffs` threw uncaught `resolveLanguage: "txt" not found in bundled or custom languages` errors and left the block empty, so the four Axiom queries on /components/workpool collapsed to a thin empty line (2026-09-30 06:46 UTC)
  - `CodeBlock` sends plain text tags, and any language missing from Shiki's `bundledLanguages` (except `ansi`, which Shiki handles itself), to its existing `<pre>` path. `shiki` is now listed in `package.json`; it was already installed through `@pierre/diffs`.
  - Files: `src/components/CodeBlock.tsx`, `package.json`

- The directory loaded its whole catalog twice on most visits: the `pageshow` refetch fired at the end of every normal load. Refetches on focus, tab switch and back/forward restore now skip while a request is in flight and when the data is under a minute old (2026-09-30)
- Monorepo components like `https://github.com/daytona/integrations` failed preflight with "No convex.config.ts found" because branch and folder were dropped from the URL. They now pass (2026-09-26 08:14 UTC)
- GitLab repositories now get a real preflight and admin AI review instead of an "Invalid GitHub repository URL" error
- Two components in the same monorepo no longer share one cached preflight result
- Admin AI review saves URL problems as `partial`, so auto reject no longer rejects a component only because the repo URL points at the wrong folder. A missing repo still counts as `failed`
- The convex-lint hook no longer blocks edits to `convex/aiReview.ts`. The function names in two prompt strings are now in backticks
- `npm run lint` now type-checks the app. `tsc -p .` checked nothing because the root tsconfig only has project references, so the script runs `tsc -b` instead. That turned up four type errors: the ones in `CodeBlock.tsx` and `CategoryPage.tsx` are fixed without changing behaviour, and the two in `ComponentDetail.tsx` went away once the `convex/packages.ts` helpers were typed (2026-09-30 08:06 UTC)
  - `convex` goes from 1.32.0 to ^1.46.0. `convex/http.ts` calls `ctx.meta.getRequestMetadata()`, which only exists from 1.38, so on the old lockfile the convex type check failed and `convex dev` and `convex deploy` refused to push.
  - `bun.lockb` also catches up with `package.json`: it adds `@convex-internal/web-analytics` and the direct `shiki` entry, and drops `react-cookie`, which `package.json` no longer lists.
  - Files: `package.json`, `bun.lockb`, `src/components/CodeBlock.tsx`, `src/pages/CategoryPage.tsx`
- Public queries in `convex/packages.ts` now give the client real types instead of `any`. Convex types a query's result from what the handler returns, not from the `returns` validator, so `toPublicPackage(pkg: any)` and its sibling helpers made every field `any` and TypeScript checked none of the field reads on the component detail page. The helpers now take `Doc<"packages">` and return the validator's type, which fixes 14 public queries with no runtime change (2026-09-30 08:14 UTC)
  - Files: `convex/packages.ts`
- Building the same code twice could give different JS file names, so a deploy with no frontend change could still make returning visitors download the entry chunk again (2026-09-30 08:27 UTC)
  - convex's `package.json` says `"sideEffects": false`, but Vite only applies that to bare imports like `convex/values`. Relative imports inside convex read `convex/dist/esm/package.json`, which has no `sideEffects` field, and Rollup keeps the flag from whichever import of a file resolves first. When an internal import of `convex/dist/esm/values/index.js` won that race, a leftover from convex's `compare_utf8.js` (`arr(); arr();`) moved from the Admin chunk into the entry chunk, which renamed the entry chunk and every chunk that imports from it.
  - `vite.config.ts` now marks every convex file as side effect free with `build.rollupOptions.treeshake.moduleSideEffects`. Repeated builds are byte-identical, the leftover is dropped (Admin is 52 bytes smaller) and the entry chunk is the same size. This can go once convex writes `"sideEffects": false` into its nested `dist/esm/package.json`.
  - Files: `vite.config.ts`
- `vite build --outDir <dir>` no longer fails with ENOENT after building the bundle (2026-09-30 22:02 UTC)
  - The `netlifyRootFiles` plugin copied `_headers` and `_redirects` into the repo's `dist/` wherever the build went, so a custom `--outDir` failed when `dist/` didn't exist and wrote into the repo's `dist/` when it did. It now copies them to the folder above the resolved `outDir`: still `dist/` for the default build (the output is byte-identical), and `<dir>` for `--outDir <dir>/components`, which gives the same layout as `dist/`.
  - The copy is skipped when the build fails. Rollup calls `closeBundle` on failed builds too, so with no `dist/` yet (a fresh clone) a real build error was reported as the plugin's ENOENT instead.
  - Files: `vite.config.ts`

### Security

- `runAiReview` now requires an `@convex.dev` admin email. Before, any signed-in user could call it (2026-09-26 08:00 UTC)

### Changed

- README badges now match the official shields.io flat badge (2026-09-26 07:13 UTC)
  - The old badge guessed text width per character and drew 11px text with no `textLength`, so it looked bigger and padded out next to real shields badges. The new renderer measures text with the Verdana 11px width table shields uses, pads 5px per side, and draws text at 110 scaled by 0.1 with a fixed `textLength`. Output is byte identical to `badge-maker` flat style.
  - Approved green changed from `#228909` to shields brightgreen `#4c1`. In Review, Changes Requested, Pending, Rejected, and Not Found keep their colors. Left box is `#555`.
  - Every badge preview in the app (Profile, Submit, ComponentDetail, the details editor) picks this up automatically because they all load the same SVG.
  - `badge-palette-preview.html` is now a single full width page with no cards, showing every status next to a shields reference and the old badge.
  - Files: `convex/badgeSvg.ts` (new), `convex/http.ts`, `badge-palette-preview.html`, `src/docs/badges.md`, `src/docs/api-endpoints.md`, `prds/shields-style-badges.md`
  - Follow up (2026-09-26 07:31 UTC): text now gets the soft blurred shadow live shields.io added in `badge-maker` v6 (`feGaussianBlur` at 0.8 opacity under the 0.3 shadow). This was the remaining "letters look off" gap. Text widths were already within half a pixel of real Verdana. Output is byte identical to `badge-maker@6`. The preview loads every badge through `<img>` and compares against live img.shields.io at 1x and 3x.
- `mockups/` is now ignored by git. The header mockup page and its screenshots were removed from the repo and stay local only (2026-09-26 07:40 UTC)

### Added

- Guest Component Preflight Check with a Test link in the header (2026-09-24 19:25 UTC)
  - New `Test` link after Build (desktop and mobile) opens `/components/submit/check` for everyone. Signed out visitors now run the check instead of being redirected to sign in.
  - Guest limits: 3 checks per hour per network, one at a time, 30 guest checks per hour site wide. Cached results (same repo within 30 minutes) are free. Signed in users keep 10 per hour, admins stay unlimited.
  - Safeguards: directory origin only, hidden `website` honeypot, URL length caps, and one atomic `_reserveGuestCheck` mutation so parallel requests cannot slip past the limits. The client IP comes from Convex request metadata, so spoofed `x-forwarded-for` headers do not reset the count.
  - Page shows a guest banner with the limits and a Sign in button, guest copy in the warning modal, a sign in link when a limit is hit, and a sign in card when guest checks are paused.
  - Admin toggle "Allow guest preflight checks" in AI Review Settings (default on). Public `packages.getPreflightAccess` query exposes the toggle and limits to the page.
  - API: POST `/api/preflight` accepts calls without a token. Denials that a sign in would fix return `requiresSignIn: true`; limit responses return 429 with `retryAfterSeconds` and `Retry-After`.
  - Files: `convex/preflight.ts`, `convex/http.ts`, `convex/schema.ts` (`preflightChecks.isGuest`, `by_is_guest_and_created` index), `convex/packages.ts`, `src/components/Header.tsx`, `src/pages/SubmitCheck.tsx`, `src/pages/Admin.tsx`, `src/docs/*.md`, `prds/guest-preflight-check.md`

- Review outcome messages: rejection and approval drafts in User Messages (2026-09-24 01:33 UTC)
  - A failed AI review writes a rejection draft that lists the blocking checks first, then advisory ones, and asks the submitter to run the Component Preflight Check (`https://www.convex.dev/components/submit/check`). Approving a component writes an approval draft with the listing link.
  - Drafts open prefilled in the User Messages composer with a banner (Rejection draft from AI review or Approval draft, Not sent yet). Edits autosave after 500ms. Regenerate, Discard (inline confirm), and Write a different message (keeps the draft for later). Cmd+Enter or Ctrl+Enter sends. The existing GitHub checkbox still decides the mirror.
  - Nothing sends by default. New Review messages group in AI Review Settings: Auto-send rejection message and Auto-send approval message, each with an Also post to GitHub option (on by default). Auto send fires only when the status actually changes to Rejected or Approved, whether an admin or Auto-reject on fail changed it.
  - Auto sent rows use `authorEmail: "AI"`, author name Convex Components Team, and `source: "system"`. They count as team messages for unread counts and the submitter Profile, show an Auto-sent pill, and admins can hide, archive, or delete them.
  - Amber dot on the Messages button and a hint under AI Review Results when a draft is waiting.
  - Rejecting an older component with a stored failed review builds its draft on the spot. `reviewMessages:backfillRejectionDrafts` (internal, supports `dryRun`) drafts messages for components already rejected before this shipped. It never sends and skips anything the team already replied to.
  - Files: `shared/reviewCriteria.ts` (new), `shared/reviewMessages.ts` (new), `convex/packageMessaging.ts` (new), `convex/reviewMessages.ts` (new), `convex/schema.ts`, `convex/packages.ts`, `src/pages/Admin.tsx`, `prds/review-outcome-messages.md`
  - Known gap: `convex/aiReview.ts` keeps its own criteria list because a lint hook false positive blocked the import swap. Keep it in sync with `shared/reviewCriteria.ts`.

- GitLab repository support with read parity to GitHub, gitlab.com only (2026-09-21 03:25 UTC)
  - Submit, edit, and preflight accept `https://gitlab.com/<namespace>/<project>` in every shape GitHub URLs were already accepted in (https, `git+https`, ssh, `.git`, trailing slash, `/-/tree/<ref>/<dir>`, `/-/blob/<ref>/<file>`, nested groups). Lookalike hosts are still rejected. Error copy names both hosts.
  - README fetch for Component Directory Content generation and refresh reads GitLab raw files at `ref=HEAD`, trying the same filename candidates in the subdirectory first and then the repo root. The `{{githubReadme}}` prompt placeholder keeps its name and now holds either provider's README.
  - Issues list (`packages:fetchGitHubIssues`) and counts (`packages:refreshGitHubIssueCounts`) dispatch on provider. GitLab issues are mapped to the existing shape (`iid` to `number`, `web_url` to `html_url`, `author.username` to `user`, `user_notes_count` to `comments`), so the detail page and cached `githubOpenIssues` / `githubClosedIssues` fields work unchanged. Counts come from the `x-total` header because gitlab.com omits `open_issues_count` for unauthenticated callers.
  - Author auto-fill on submit and in the admin editor sets `authorUsername` to the GitLab namespace path and fills `authorAvatar` a moment later through the `gitlabApi:fillGitLabAuthorAvatar` internal action (mutations stay fetch free). Group avatars arrive as relative paths and are resolved against the host.
  - README relative links resolve to `gitlab.com/<ns>/<project>/-/blob/<ref>/<path>` and images to `/-/raw/<ref>/<path>`, matching the existing GitHub behavior.
  - New `RepoHostIcon` renders the GitHub or GitLab logo from the repository URL. Live icon switch in the submit check input as the user types. Provider aware labels ("Open GitLab Issues", "View on GitLab", "GitLab repository") across the detail page, profile, edit submission, admin editor, FAQ, HTTP markdown and llms endpoints, and SKILL.md output.
  - Optional `GITLAB_TOKEN` (read_api scope, sent as `PRIVATE-TOKEN`) raises the GitLab rate limit. Public projects need no token. A rejected token retries unauthenticated, same as `GITHUB_TOKEN`.
  - Files: `shared/repoUrl.ts` (new), `convex/gitlabApi.ts` (new), `src/components/RepoHostIcon.tsx` (new), `convex/packages.ts`, `convex/seoContent.ts`, `convex/http.ts`, `convex/preflight.ts`, `convex/router.ts`, `convex/securityScan.ts`, `convex/schema.ts`, `convex/aiSettings.ts`, `shared/buildSkillMd.ts`, `src/lib/markdownLinks.ts`, `src/pages/Submit.tsx`, `src/pages/SubmitForm.tsx`, `src/pages/SubmitCheck.tsx`, `src/pages/ComponentDetail.tsx`, `src/pages/Profile.tsx`, `src/pages/ProfileEditSubmission.tsx`, `src/components/ComponentDetailsEditor.tsx`, `src/components/FAQSection.tsx`, `src/pages/Admin.tsx`, `src/docs/*.md`, `prds/gitlab-repo-support.md`
  - Not changed on purpose: GitHub issue mirroring, broadcast, and reply sync stay GitHub only. GitLab packages show "Issue mirroring is available for GitHub repositories only." under the admin reply box. Snyk and Devin scans report that they require a GitHub repository. Official component derivation (`get-convex` org) stays GitHub only.
  - Known gap: `convex/aiReview.ts` still parses GitHub only, so a GitLab preflight or admin AI review reports an error at the repo fetch step. Edits to that file are blocked by a lint hook false positive; the ready-to-apply change is in `prds/gitlab-repo-support.md`.

- `DocSectionEditor` shared component for editing Component Directory Content sections (2026-09-17 09:18 UTC)
  - Each section (Description, Use cases, How it works) renders the way the public component page does: uppercase heading plus rendered markdown. A Preview / Edit toggle in the section header flips it into an auto-growing textarea. `Done` returns to preview. Empty sections show a dashed "Click to write this section" prompt.
  - Edit mode keeps the bottom-right resize grip (`resize-y`). Dragging it taller sets a floor that auto-grow respects, so typing never snaps the box back down. Helper text now says "Drag the corner for more room." (2026-09-21 02:36 UTC)
  - Files: `src/components/DocSectionEditor.tsx`

- "Build" link in the header nav pointing to the Convex components docs (2026-09-10 20:40 UTC)
  - Sits after Directory in the desktop nav and in the mobile dropdown menu. Opens `https://docs.convex.dev/components/overview` in a new tab.
  - Files: `src/components/Header.tsx`

### Fixed

- Preflight check lockouts and cached failures (2026-09-24 19:25 UTC)
  - A preflight run that crashed before finishing left its row at `pending`, which blocked that IP with "already running" until the row expired. Crashed runs are now marked `error`, and pending rows older than 10 minutes no longer count as in flight.
  - Error results were cached for 30 minutes, so a transient AI or GitHub failure kept returning the same error for that repo. Error rows now expire immediately.
  - Files: `convex/preflight.ts`, `convex/http.ts`

- Resizable "drag box" textareas on the Edit Submission and Submit pages (2026-09-17 09:18 UTC)
  - The Component Directory Content block used `resize-y` textareas beside a fixed-height preview, so the two columns drifted out of sync and the grip handle let authors shrink the field into a scroll box. The block now uses `DocSectionEditor`: a `useLayoutEffect` sets the textarea height to `max(scrollHeight, minHeight, dragged height)` on every change, so the field grows with the content and never scrolls inside itself, and a manual drag only ever makes it taller. Verified: 161px at 3 bullets, 252px at 6 bullets; a 320px drag held at 320px after typing.
  - Files: `src/pages/ProfileEditSubmission.tsx`, `src/pages/SubmitForm.tsx`

### Changed

- Six duplicated GitHub URL regexes (`packages.ts`, `seoContent.ts`, `http.ts`, `markdownLinks.ts`, the three submit pages) replaced by the single `shared/repoUrl.ts` parser (2026-09-21 03:25 UTC)
  - `convex/githubIssues.ts` keeps its own `parseGitHubRepo` gate so write flows cannot reach a GitLab host.
  - `convex/preflight.ts` `normalizeRepoUrl` also strips GitLab `/-/tree/` and `/-/blob/` paths so subdirectory URLs share a cache key with the project root.

- "Also send as a GitHub issue" is now checked by default in the admin Comments panel (2026-09-10 20:38 UTC)
  - Admins were forgetting to tick it, so submitters never saw the message. A normal reply now mirrors to GitHub unless the admin unticks the box for that message. The `canMirrorToGithub` gate is unchanged, so packages without a github.com repo are unaffected and the checkbox still does not render for them.
  - Files: `src/pages/Admin.tsx`, `src/docs/admin-notes.md`

## [2.3.0] 2026-09-10

### Changed

- GitHub Broadcast moved out of Settings into its own admin tab next to Logs (2026-09-10 04:19 UTC)
  - Compose, reply sync, and broadcast history now open as a first-class page instead of a collapsed Settings accordion. The Settings jump nav no longer lists it. Old `#settings-github-broadcast` hashes still land on the Broadcast tab.
  - Tool tabs (Settings, API, Logs, Growth, Broadcast) share `isAdminToolTab`, so the package submissions list stays hidden on Logs as well as Broadcast.
  - The Broadcast tab shows a sending pill while a job is running, visible from any other admin view.
  - In-app docs moved to `/components/documentation/admin-broadcast`. Settings keeps a pointer.
  - PRD: `prds/admin-broadcast-tab.md`
  - Files: `src/pages/Admin.tsx`, `src/pages/Documentation.tsx`, `src/docs/admin-broadcast.md` (new), `src/docs/admin-settings.md`, `src/docs/admin-dashboard.md`, `src/docs/admin-notes.md`, `src/docs/index.md`, `src/docs/updating-docs.md`

### Added

- In-app documentation for GitHub issue messaging, broadcast, and reply sync (2026-09-09 05:45 UTC)
  - `/components/documentation/admin-notes` gained a "GitHub issue messaging" section: what the checkbox does, the GitHub state each message shows (Opening, Sent as issue, Sent as comment, Closed, failed), how the checkbox label tells you whether a new issue opens or a comment posts on the open one, what the issue body contains, and how submitter replies come back into the thread (via GitHub pill, unread count, one Slack post, dedupe by comment id, bot and self skip).
  - `/components/documentation/admin-settings` gained a "GitHub Broadcast and Reply Sync" section: filters and the eligible vs skipped count, the 10 second stagger against GitHub's limits, the history list and the 401 / 403 / 404 / 410 error table, a cancel / archive / restore / delete table that spells out why delete stops reply matching for that broadcast, the reply sync card fields, and a five step setup that says a classic token with the `notifications` scope is required. The environment variables table lists `GITHUB_TOKEN`, `GITHUB_NOTIFICATIONS_TOKEN`, and `SLACK_WEBHOOK_URL`.
  - `/components/documentation/profile` explains to submitters that admin messages may arrive as GitHub issues and that replying on GitHub lands in the same thread. Overview link text updated.
  - Files: `src/docs/admin-notes.md`, `src/docs/admin-settings.md`, `src/docs/profile.md`, `src/docs/index.md`

- GitHub replies flow back into the package message thread and Slack, admin follow ups comment on the open issue, and sent broadcasts can be archived or deleted (2026-09-09 05:35 UTC)
  - Reply sync closes the loop on GitHub issue messaging. Issues live on submitters' repos, so webhooks are out; instead the token user is auto subscribed to every issue it opens, and the new `convex/githubReplySync.ts` polls `GET /notifications?participating=true` every 2 minutes (cron `github-reply-sync`). It is gated by a `githubReplySyncEnabled` admin toggle, honors GitHub's `X-Poll-Interval`, and sends `If-Modified-Since` so idle polls come back as free 304s. Each issue thread is mapped to a package through the new `githubIssueKey` (`owner/repo#n`) on `packageComments` or `issueKey` on `githubBroadcastItems`. The poller fetches that issue's comments since the last poll (minus a 10 minute buffer), drops comments by the token user or bots so it can never echo itself, and `_mirrorGithubReplies` inserts each one as a `source: "github"` message that is unread for admins, so the header bell lights up. One Slack post per reply ("New GitHub reply on ... from @login via GitHub" with the comment URL), through `formatSlackNotification`, which moved from `packages.ts` into `slack.ts` so both files share it. Dedupe is on `githubCommentId`; unmatched threads (PRs, issues we did not open, deleted broadcasts) are left unread on GitHub and counted as `unmatched` in the poll summary. Broadcast replies route to their own package thread and increment `replyCount` on the item and `replies` on the broadcast.
  - Token requirement, stated plainly: GitHub's notifications endpoints only accept a personal access token (classic) with the `notifications` scope; fine grained tokens are refused. The poller reads `GITHUB_NOTIFICATIONS_TOKEN` first and falls back to `GITHUB_TOKEN`. A new Reply sync card in admin Settings shows on/off, the token login and which variable it came from, last poll, last result, and last error, with Test connection and Sync now buttons, so a wrong token is a readable message instead of a silent cron.
  - One open issue per package. When an admin sends a thread message with the checkbox on, `createIssueForComment` now looks for an open issue for that package (latest created comment issue or latest sent broadcast item), confirms its state with one `GET`, and posts a comment there rather than opening issue number two (`githubMirrorKind: "comment"`, thread pill reads "Sent as GitHub comment"). If the previous issue is closed it opens a new one and marks the old rows `githubIssueState: "closed"` so the thread shows a "Closed" pill. The checkbox label switches between "Also send as a GitHub issue", "Also reply on the open GitHub issue", and "Open a new GitHub issue (previous one is closed)" via `getOpenIssueForPackage`.
  - Broadcast lifecycle in Settings: Archive (completed or cancelled), Restore, and Delete (anything not running) as the same small pills the message panels use, plus a Show archived toggle. Delete removes the broadcast row and its items in batches of 500 through a self rescheduling `_deleteBroadcastItemsBatch`, and unsets `githubBroadcastId` on mirrored replies so nothing points at a deleted document; the replies themselves stay in the package threads. Archive keeps reply sync working; delete stops it for that broadcast's issues because there is nothing left to match, and the danger `ConfirmModal` says so and recommends archive while issues are still open. Issues already on GitHub are never touched by either action.
  - Both message threads (admin `CommentsPanel` and the submitter's Profile) show a "via GitHub @login" pill on mirrored replies that links to the comment. Mirrored replies use the package `submitterEmail` as `authorEmail` when the GitHub login matches `authorUsername`, otherwise `login@users.noreply.github.com`, so every existing `isFromAdmin` and unread check treats them as submitter messages with no changes.
  - Schema is additive and optional: reply fields and `by_github_issue_key` / `by_github_comment_id` / `by_github_broadcast` indexes on `packageComments`; `issueKey`, `issueState`, `replyCount` and `by_issue_key` / `by_package` on `githubBroadcastItems`; `replies` and `archivedAt` on `githubBroadcasts`; new `githubSyncState` singleton. `backfillGithubIssueKeys` (run once on dev) keyed the rows created before this change from their stored URLs.
  - Verified on dev: schema, cron, and functions pushed; backfill keyed 1 comment and 1 broadcast item; `_findIssueTargets` resolved a real broadcast issue key to its package and broadcast and skipped an unknown one; a forced `pollNotifications` run recorded the expected 403 fine grained token message without throwing. `tsc -p convex` clean, app typecheck shows only the four pre-existing errors, eslint has zero errors on every changed line, `npm run build` passes.
  - PRD: `prds/github-reply-sync.md`
  - Files: `convex/schema.ts`, `convex/githubReplySync.ts` (new), `convex/githubIssues.ts`, `convex/packages.ts`, `convex/slack.ts`, `convex/crons.ts`, `src/pages/Admin.tsx`, `src/pages/Profile.tsx`

- Admin messages can be mirrored as GitHub issues, and admins can broadcast one issue to every submitter by review status (2026-09-08 18:40 UTC)
  - Submitters rarely return to their directory profile, but they do get GitHub notifications. The user-messages panel in admin now shows an "Also send as a GitHub issue" checkbox whenever the package's `repositoryUrl` is on github.com. `addPackageComment` takes an optional `alsoCreateGithubIssue` flag, honored only for `@convex.dev` admins and only when the repo parses; the comment saves first with `githubIssueStatus: "pending"`, then the new `githubIssues.createIssueForComment` internal action opens the issue (message text plus a footer linking the listing and the profile thread) and patches the comment with the issue URL or the GitHub error. The thread renders that state reactively: "Opening GitHub issue...", a "Sent as GitHub issue" link, or "GitHub issue failed: reason". A GitHub failure never blocks the message.
  - New "GitHub Broadcast" section in admin Settings (also in the jump nav). Pick Approved, Pending (pending, in review, or unset), Rejected, or All; the section shows how many components have GitHub repos and will receive the issue, how many will be skipped, and a time estimate. Enter a title and message, confirm the exact count in the existing `ConfirmModal`, and watch a live progress bar with sent / failed / skipped counters. Each broadcast in the history expands to per-package results with issue links and error text. A running broadcast can be cancelled; issues already opened stay on GitHub.
  - Rate limits: GitHub's secondary limits for content creation are roughly 80 per minute and 500 per hour. `processNextBroadcastItem` is a sequential chain that creates one issue per run and reschedules itself 10 seconds later (6 per minute, 360 per hour), the same stagger the README auto-update uses. On 403 or 429 it reads `Retry-After` or `X-RateLimit-Reset`, waits that long (clamped to 30s to 15 min), and retries the same repo, giving up after 3 attempts. Starting a second broadcast while one is running is disabled in the UI so two chains never overlap.
  - Failure handling: 401 (bad token), 403 without rate limit hints (token lacks issue write), 404 (private, renamed, or deleted repo), and 410 (issues disabled) are recorded per item with a readable message and never retried. `GITHUB_TOKEN` needs `public_repo` (classic) or Issues: write (fine grained) on the target repos.
  - Schema is additive: three optional fields on `packageComments`, plus new `githubBroadcasts` and `githubBroadcastItems` tables. No existing behavior changed; the flag defaults to unset.
  - PRD: `prds/github-issue-messaging.md`
  - Files: `convex/schema.ts`, `convex/githubIssues.ts` (new), `convex/packages.ts`, `src/pages/Admin.tsx`

### Fixed

- Admin Logs no longer shows the package submissions list above the log table (2026-09-10 04:19 UTC)
  - Settings, API, and Growth already hid the list. Logs was left out. `isAdminToolTab` now covers all five tool tabs, including Broadcast.

- The Growth tab total now stays current and matches the dashboard, with no npm requests (2026-09-04 18:55 UTC)
  - The Growth tab read 32,896,787 "generated Aug 11 2026" while the dashboard's All Time Downloads card read 40.1M for what should be the same components. Two independent causes. First, `getGrowthSeries` returned the stored `downloadGrowthSeries` document verbatim, so its `totalDownloads` was frozen at whenever the snapshot was last built, while the dashboard sums `allTimeDownloads` off the packages table on every read. At roughly 2.7M weekly downloads, the 24 days since Aug 11 account for most of the 7.2M gap on their own. Second, the two totals covered different package sets: the Growth series counts approved packages only (146), the dashboard counted every active package (152, the same 146 plus 6 rejected community packages).
  - The stored snapshot now supplies only the shape of the curve. `getGrowthSeries` reads the live approved-package sum on every query and returns it as `liveTotalDownloads` and `livePackagesIncluded`, next to `snapshotTotal` and `snapshotPackagesIncluded` for what the stored months actually cover. `readGrowthPackages(ctx)` is shared by the query and `_getGrowthPackages` so the two definitions cannot drift. The query stays deterministic, no `Date.now()`, so its cache and reactivity are intact.
  - `DownloadsGrowthTab` does the date work in `syncMonthsToLiveTotal`: append zero download months from the snapshot's `endMonth` through the current month, then land the difference on the final point, clamped to the prior month's cumulative so an archived package can never make the curve dip. The header, chart, range picker, share image, and replay video all read the adjusted array, so every export is dated today and matches the dashboard. Cost is zero npm requests on page load.
  - The dashboard's All Time Downloads card is now approved only, so the two surfaces report the same number. The 6 rejected community packages no longer inflate a figure that ends up in a public share image. Weekly Downloads, component counts, author breakdowns, and month breakdowns are unchanged. The card's sublabel reads "Cumulative, N approved".
  - Refresh paths relabeled and documented in tooltips, since the cheap one was not obvious: "Refresh curve" (was "Refresh data") is incremental and makes zero npm calls for components already in the snapshot, fetching history only for ones added since. "Full rebuild from npm" is still the only rate limit heavy path and is still opt in.
  - PRD: `prds/growth-tab-live-total-sync.md`
  - Files: `convex/downloadsGrowth.ts`, `convex/dashboard.ts`, `src/components/DownloadsGrowthTab.tsx`, `src/pages/Dashboard.tsx`

- Missing component slugs now return HTTP 404 (2026-08-22 01:00 UTC)
  - Confirmed misses return 404; lookup failures keep the existing SPA response.

### Security

- Admin-gated the public functions that handled money, PII, and admin control (2026-08-14 07:05 UTC)
  - A sec-check audit listed all 211 public Convex functions and checked each handler for an auth reference. 51 had none. Most were the public directory reads and are fine as-is; the rest were callable by anyone with the deployment URL, since admin gating lived only in React and the function API does not go through the browser.
  - Money path: `sendRewardManual` and `sendTestReward` in `convex/payments.ts` could trigger real Tremendous gift card orders with no sign-in. Both now call `requireAdminIdentity` as the first statement, before any Tremendous request.
  - Financial PII: `getPaymentsForPackage` and `getPaymentStats` in `convex/paymentsDb.ts` returned recipient emails, names, amounts, and Tremendous order and reward ids. Both are admin gated.
  - Admin control: `updateAdminSetting` and `updateAdminSettingNumeric` in `convex/packages.ts` let anyone flip `autoApproveOnPass`, `apiAccessEnabled`, and `autoSecurityScan`, change `defaultRewardAmount`, and queue AI review across every package. `getAdminSettings`, `getDeletionCleanupSettings`, and `getOfficialReadmeAutoUpdateSettings` exposed the admin config. All are admin gated.
  - Internal review threads: `getPackageNotes` returned note content with `authorEmail` and `authorName`. It and the four related counters (`getPackageNoteCount`, `getUnrepliedUserRequestCount`, `getUnreadUserNotesCount`, `getUnreadCommentsCount`) are admin gated.
  - Cost abuse: `regenerateSeoContent`, `regenerateDirectoryContent`, and `refreshReadmeContent` in `convex/seoContent.ts` scheduled LLM generation, and `regenerateAllThumbnails` and `regenerateSelectedThumbnails` in `convex/thumbnailGenerator.ts` fanned out image generation across every package. All five are admin gated.
  - Migrations left the public API: `backfillMaintainerNames` and `backfillPackageReliabilityFields` in `convex/packages.ts` and `backfillRewardStatusFromPayments` in `convex/paymentsDb.ts` became `internalMutation`, matching the existing `backfillCategoryCounts`. They had no callers in `src/`, so nothing broke.
  - Left public on purpose after checking frontend usage: `getLatestSecurityScan` (used by `ComponentDetail` and `Submit`), `fetchGitHubIssues` and `refreshGitHubIssueCounts` (public detail page issues panel), the directory reads, and session-based `rateComponent`.
  - PRD: `prds/sec-check-public-function-auth-gaps.md`
  - Files: `convex/payments.ts`, `convex/paymentsDb.ts`, `convex/packages.ts`, `convex/seoContent.ts`, `convex/thumbnailGenerator.ts`, `convex/readmeAutoUpdate.ts`

### Changed

- Bumped `@convex-internal/web-analytics` from 2.0.1 to 2.1.0 (2026-08-26 15:30 UTC)
  - Drop-in. Files: `package.json`

- Bumped `@convex-internal/web-analytics` from 1.1.1 to 2.0.1 (2026-08-21 23:02 UTC)
  - React entry is now `@convex-internal/web-analytics/react`. Files: `package.json`, `src/main.tsx`

- Bumped `@convex-internal/web-analytics` from 1.1.0 to 1.1.1 (2026-08-21 16:33 UTC)
  - Drop-in. Files: `package.json`

- Bumped `@convex-internal/web-analytics` from 1.0.3 to 1.1.0 (2026-08-21 14:43 UTC)
  - Drop-in: `WebAnalyticsProvider` already takes no `posthogConfig`. Files: `package.json`

- The submissions directory at `/components/submissions` is now admin only (2026-08-13 06:05 UTC)
  - The page previously public at `/components/submissions` now requires a logged-in `@convex.dev` admin, the same rule as `/components/submissions/admin`. A new `SubmissionsGate` in `src/main.tsx` waits for auth and the `api.auth.isAdmin` check to settle (so admins are not bounced during token load on hard refresh), renders the table for admins, and sends everyone else to `/components` with `window.location.replace`. `/submissions/admin` and every other route are untouched.
  - The "Submissions" link in the header (desktop and mobile) moved under the existing admin-only nav group so non-admins never see it. `Submit.tsx` also became a lazy chunk (35 kB out of the shared bundle) since the page is no longer indexed.
  - SEO/AEO cleanup for the previously live URL: removed `/components/submissions` from the sitemap static pages in `convex/http.ts`, added it to `isNoindexPath` in `netlify/edge-functions/og-meta.ts` so crawlers get `X-Robots-Tag: noindex` and drop the URL, and added a defense-in-depth `X-Robots-Tag` header block in `netlify.toml`. A server 301 is not possible since auth lives in the browser; client redirect plus noindex is the correct pairing. Optional follow-up: request removal in Google Search Console to speed up deindexing.
  - PRD: `prds/hide-submissions-directory.md`
  - Files: `src/main.tsx`, `src/components/Header.tsx`, `convex/packages.ts`, `convex/http.ts`, `netlify/edge-functions/og-meta.ts`, `netlify.toml`

### Security

- Admin-gated the submissions listing queries (2026-08-13 06:05 UTC)
  - `getSubmitPackagesPage` and `searchSubmitPackagesPage` in `convex/packages.ts` (the only queries behind the submissions page) now check `getAdminIdentity` and return an empty page in the same validator shape for non-admins, so hiding the page client side cannot be bypassed through the public Convex API or WebSocket. Verified on dev: unauthenticated CLI calls return `{ items: [], total: 0 }`, an admin identity gets full data.

### Added

- Directory list view with header toggle and admin thumbnail setting (2026-08-12 19:25 UTC)
  - New grid/list toggle in the header (Phosphor `Rows` in grid mode, `SquaresFour` in list mode), shown only on the Directory page. On desktop it sits in the left nav just before the "Directory" link (moved from next to the search icon at 2026-08-12 20:01 UTC); on mobile it stays beside the search icon. List mode keeps the sidebar, section order, and category headings while rendering Featured, category sections, Other, and flat search results as compact rows via the new `ComponentListRow` component. The choice persists in `localStorage` and a list-shaped skeleton renders while loading.
  - Category sections in list view gain a "Load more" button using the existing client-side paging; the "View all {label}" link appears once a section is exhausted. Grid view is unchanged, including its "View all" links.
  - Thumbnails are hidden in list view by default. New global admin setting "Show thumbnails in list view" (`showListViewThumbnails`, in the Submit Listing Settings panel below the page-size buttons; moved there from AI Review Settings at 2026-08-12 19:58 UTC for discoverability) shows a fixed-size thumbnail on the right of each row; it applies to list view only and overrides per-category and per-component thumbnail hide flags. Read publicly through the new slim `getListViewSettings` query (1 read).
  - PRD: `prds/directory-list-view.md`
  - Files: `convex/packages.ts`, `src/components/ComponentListRow.tsx` (new), `src/components/Header.tsx`, `src/pages/Directory.tsx`, `src/pages/Admin.tsx`

- Growth tab date range selector and replay video export (2026-08-11 22:05 UTC)
  - From/To month selects on the chart card, defaulting to January 2025 through the latest month since components authoring launched December 2025; the window frames the animated chart, the share image, and the replay video, with a Reset link and the running total through the selected end month. Cumulative values stay all time so the headline number keeps matching the dashboard.
  - "Generate video" records the share card animation off screen at 1200 x 630 with canvas.captureStream and MediaRecorder (short hold, 2.4s sweep with a counting total, hold on the finished card), preferring MP4 (H.264) with a WebM fallback and note, and shows an inline preview with a download button. Verified in the browser: 4.5s MP4 at ~1MB.
  - The share card total and the Post on X text now use the cumulative value at the end of the selected window.
  - Files: `src/components/DownloadsGrowthTab.tsx`

### Changed

- Growth tab polish for screen recordings (2026-08-12 01:30 UTC)
  - The skipped-packages warning moved out of the header (next to Replay/Refresh) into its own strip between the chart card and the Share this growth section, keeping recordings of the growth curve clean.
  - Chart legend labels (the max value marker and the month row) went from 11px soft gray to 16px semibold ink in both the live chart and the exported share image and replay video. Display only; existing snapshots render with the new styling without refreshing data.
  - Files: `src/components/DownloadsGrowthTab.tsx`

- Growth tab refresh is now incremental instead of a full npm refetch (2026-08-11 21:55 UTC)
  - The `downloadGrowthSeries` snapshot stores its `packageNames`, so "Refresh data" reuses the saved monthly history, reads the current total from the same stored `allTimeDownloads` sum the dashboard shows (zero npm calls), and only fetches full npm history for packages approved since the snapshot. Growth since the last snapshot lands on the current month.
  - A full npm rebuild still runs automatically when there is no usable snapshot or packages were removed (their baked-in history cannot be subtracted), and admins can force one with the new "Full rebuild from npm" action. The action reports its `mode` and the toast says whether data was synced from stored totals or rebuilt from npm.
  - Measured on dev: incremental refresh 1.2 s versus ~2.6 min for the full rebuild, identical totals.
  - Files: `convex/schema.ts`, `convex/downloadsGrowth.ts`, `src/components/DownloadsGrowthTab.tsx`

### Added

- Admin Growth tab: animated all time downloads chart with shareable image (2026-08-11 21:05 UTC)
  - New "Growth" tab in the admin dashboard renders cumulative npm downloads across every approved component as an animated dither dot-matrix hockey stick: orange dots rising over a faint dot grid on warm cream, swept left to right with per-column easing on load, replay, and refresh. Hovering shows the month, running total, and that month's downloads.
  - "Refresh data" runs a new admin action (`generateGrowthSeries`) that pulls each package's full daily download history from npm's range API in 540-day windows, aggregates by month, and stores a single `downloadGrowthSeries` snapshot. npm rate limits bursts hard, so fetching is fully sequential with 400ms spacing, exponential backoff on 429/5xx, and a second retry pass; a package only counts when every window succeeds. Verified 21/21 packages clean on dev (~2.7 minutes, well under the action limit).
  - "Generate image" renders a 1200 x 630 PNG at 2x for social: a full card with an editable serif title, the orange total, chart, and footer, or a chart-only variant. Buttons download the PNG, copy it to the clipboard (falls back to download), or open a prefilled X draft with the image on the clipboard.
  - PRD: `prds/downloads-growth-share-chart.md`
  - Files: `convex/schema.ts`, `convex/downloadsGrowth.ts` (new), `src/components/DownloadsGrowthTab.tsx` (new), `src/pages/Admin.tsx`

### Security

- Admin-gated the auto-refresh admin functions (2026-08-06 03:15 UTC)
  - `updateRefreshSetting`, `getRefreshStats`, `getRecentRefreshLogs`, and `getRefreshSettings` in `convex/packages.ts` were public with no auth check, so unauthenticated callers could read refresh logs and stats and toggle the auto-refresh setting straight against the deployment URL. The mutation now requires an admin identity (`requireAdminIdentity`, throws `Authentication required`), and the three queries return safe defaults for non-admins (empty logs, zeroed stats, default settings) instead of erroring, matching the file's existing admin query pattern. Admin dashboard behavior is unchanged since the panel only renders for confirmed admins.
  - Verified unauthenticated on dev via the public HTTP API: all three queries return empty/default data and the mutation throws before writing. Requires a production deploy to take effect there.
  - PRD: `prds/admin-gate-refresh-functions.md`
  - Files: `convex/packages.ts`

### Changed

- Removed the person icon from the Community pill on directory cards (2026-08-06 06:10 UTC)
  - The icon made the pill wide enough to crowd the card footer, so the pill is now text-only. The Verified pill keeps its check icon. Files: `src/components/ComponentCard.tsx`.

### Added

- Official README auto-update with admin logs (2026-08-06 02:45 UTC)
  - New "Auto-update READMEs" toggle in the Official Convex Components block of admin Category Management. When on, every approved and visible official component (get-convex org / `@convex-dev` scope) gets its README refreshed from GitHub on a configurable schedule: every hour (default), every day, every 3 days, every week, or every month. The refresh reuses the exact internal action behind the existing Update README buttons, so behavior is identical to clicking them by hand.
  - One hourly cron (`official-readme-auto-update`, runs at :30) is gated by the toggle and an interval check against a stored last-run timestamp, so the schedule setting works without redeploying crons. GitHub fetches are staggered 10 seconds apart to stay far under rate limits, and `_updateReadmeOnly` now skips the database write when the fetched README is byte-identical to what is stored.
  - Every attempt (cron, admin button, or profile button) writes a row to a new `readmeUpdateLogs` table recording package, status (success / failed / skipped), source, whether content actually changed, and an error or skip reason. The table is capped at the newest 500 rows via a cleanup that runs after each cron pass.
  - New Logs tab in the admin dashboard, styled like the Convex logs page: status and source filter selects, a package-name text filter, a paginated table with Load more, row checkboxes with select-all, Delete selected, and Clear logs, both behind the site's `ConfirmModal`.
  - Verified end to end on dev (2026-08-06 02:20 UTC): toggle on, manual cron trigger scheduled all 10 official packages, staggered fetches logged one per 10 seconds, 9 rows recorded `changed: true` and one (`@convex-dev/stripe`) `changed: false` with no write, the interval gate blocked an immediate second run, non-admin log queries return empty, delete removed exactly the selected row, and the toggle was returned to its default off state.
  - PRD: `prds/official-readme-auto-update.md`
  - Files: `convex/schema.ts`, `convex/readmeAutoUpdate.ts` (new), `convex/seoContent.ts`, `convex/seoContentDb.ts`, `convex/packages.ts`, `convex/crons.ts`, `src/pages/Admin.tsx`

- Curated categories with member badges (2026-08-06 00:55 UTC)
  - Admins can now create a "curated" category type in Settings > Category Management for hand-picked collections such as YC Companies. A curated category has a name, description, and an optional small badge image, and gets the same sidebar link and `/components/categories/:slug` landing page as any other enabled category.
  - Membership is managed per category from a new "Manage members" panel in admin: search approved components and add or remove them from the list. Membership lives in a new `categoryMemberships` join table, so a component keeps its normal primary category and can belong to any number of curated collections at once. Adds are idempotent and hidden or unapproved members are excluded from public listings at query time.
  - Member components show the category's badge image on their directory card inline in the title, right before the first letter of the component name (square corners; long names keep truncating as before), and next to the badges on the detail page, with the category label as the tooltip. The badge image is optional at every layer: a curated category works with just a name and description, and cards render nothing extra until a badge is uploaded. Uploading, replacing, or clearing the badge and renaming the category all resync the denormalized `curatedBadges` on every member.
  - Curated categories are excluded from the submit form picker and cannot be assigned as a component's primary category (same guard as the derived official category). Deleting a curated category removes its memberships and strips its badge from former members.
  - PRD: `prds/curated-categories.md`
  - Files: `convex/schema.ts`, `convex/packages.ts`, `src/components/ComponentCard.tsx`, `src/pages/ComponentDetail.tsx`, `src/pages/Directory.tsx`, `src/pages/CategoryPage.tsx`, `src/pages/Admin.tsx`, `src/lib/categories.ts`

- npm URL mismatch check and review flow (2026-08-05 07:30 UTC)
  - When a submitter changes their npm URL to point at a different package than the listing tracks, the edit page now shows an amber warning under the npm field and a confirm modal ("Save and request review") before saving. The save goes through, but the record is flagged with a new `pendingNpmName` field and the Slack notification gains the old and new package names plus a note that name, slug, install command, and download stats keep tracking the old package until the team acts.
  - Same-name URL edits (reformatting, encoded scoped names) save quietly and clear any stale flag; a submitter reverting the URL back to the original package also clears the flag automatically.
  - The admin dashboard shows an amber "npm mismatch" badge on flagged package rows and a review panel in the expanded view with two actions behind confirm modals: Accept rename (validates the new package on the registry, then re-derives name, install command, npm URL, version, license, downloads, collaborators, and SKILL.md while keeping the slug and public URL unchanged) and Revert URL (restores the npm URL from the tracked package name). Both clear the flag; a failed registry fetch leaves the flag set.
  - The edit page info card shows an "npm change pending review" chip while a change is awaiting review.
  - PRD: `prds/npm-url-mismatch-review.md`
  - Files: `convex/schema.ts`, `convex/packages.ts`, `src/pages/ProfileEditSubmission.tsx`, `src/pages/Admin.tsx`

- Editable repo and npm links on the profile edit page with auto security re-scan (2026-08-05 01:50 UTC)
  - Submitters can now update their GitHub repository URL and npm URL from `/components/profile/edit/:id`. A new Links section at the top of the form groups the repo, npm, Live Demo or Example App, and Video URL inputs (the Demo and Video fields moved up from lower in the form).
  - Changing the repo or npm URL runs the same pipeline as a new submission: the package is queued for an automatic security scan (respects the `autoSecurityScan` admin setting, skips when a scan is already running) and the Convex team gets a Slack notification showing the old and new values and whether a scan was queued. Saves with unchanged links behave exactly as before, with no Slack message and no scan.
  - URL formats are validated server-side with the same rules used at submission (`https://github.com/owner/repo`, `https://www.npmjs.com/package/name`), and validation errors now surface in the save toast instead of a generic failure message.
  - The `Package:` name line was removed from the info card on the edit page since users submit the repo and npm URLs directly; the Repo and npm reference links remain.
  - PRD: `prds/profile-edit-links-rescan.md`
  - Files: `convex/packages.ts`, `src/pages/ProfileEditSubmission.tsx`

### Fixed

- Scheduled auto-refresh silently failed every night (2026-08-06 03:00 UTC)
  - The daily `check-and-refresh-packages` cron ran, found stale packages, and created a refresh log, but every batch died before touching a single package: `_getStalePackages` returned entries shaped `{ _id, name, lastRefreshedAt }` while `_refreshPackageBatch` only accepts `{ _id, name }`, so Convex argument validation rejected every scheduled batch with an extra-field error. The log stayed stuck at `status: "running"` with 0 succeeded and an empty errors array, which is why the admin panel showed "Last run: 0 succeeded" nightly while packages drifted 9+ days stale. Manual Refresh All / Refresh Approved Only buttons were unaffected because they use `_getAllApprovedPackages`, which already returns the correct shape.
  - Fix: `_getStalePackages` no longer includes `lastRefreshedAt` in its return value (it was only needed internally for sort order), so scheduled batches now pass validation. Verified on dev: `scheduledRefreshCheck` refreshed 18 of 18 stale packages with a completed log entry. Requires a production deploy to take effect there.
  - PRD: `prds/scheduled-refresh-validation-fix.md`
  - Files: `convex/packages.ts`

- Asset caching and noindex headers never applied in production (2026-07-27 18:55 UTC)
  - The `[[headers]]` blocks added in the PageSpeed pass were silently ignored: Netlify custom headers do not apply to URLs handled by an edge function, and the og-meta edge function was mapped to all of `/components/*`, catching every JS, CSS, and font request. Verified live: hashed assets returned `max-age=0,must-revalidate`, `x-vercel-cache: MISS` on every request (www.convex.dev is a Vercel site proxying to Netlify, and Vercel will not edge cache `max-age=0` responses), and `/components/dashboard` had no `x-robots-tag`. Each asset took 150 to 275 ms through the two proxy layers and was revalidated on every page load.
  - Fix part 1: `excludedPath = ["/components/assets/*", "/components/fonts/*"]` on the og-meta declaration in `netlify.toml`, so static files serve from Netlify's own store where the header rules apply, Vercel's edge can cache them, and browsers keep them for a year. og-meta was a pure passthrough for these paths (dotted names fail `extractSlug`), the live sitemap has no slugs under either path, and og-meta's self-proxied routes (sitemap.xml, llms.txt, components.md, get-convex*) are unaffected, so SEO is untouched.
  - Fix part 2: new fonts cache rule, `max-age=604800, stale-while-revalidate=86400`, one week instead of immutable because font files are not content-hashed.
  - Fix part 3: og-meta now sets `X-Robots-Tag: noindex, nofollow` itself for the admin, callback, profile, dashboard, and documentation routes, since HTML always flows through the edge function where `[[headers]]` rules never fire. Exact path matching with trailing slash normalization; 18 case test confirmed `/components/submissions` and `/components/submit` (both indexed) never match. The netlify.toml noindex blocks stay as defense in depth.
  - PRD: `prds/edge-function-headers-fix.md`
  - Files: `netlify.toml`, `netlify/edge-functions/og-meta.ts`

- Auto-Refresh Settings panel never rendered in Admin Settings (2026-07-27 00:45 UTC)
  - The panel silently disappeared from the admin Settings tab (local and production) because `useQuery(api.packages.getRefreshStats, { now: Date.now() })` passed a fresh timestamp on every render. Each result arrival re-rendered the component with new args, Convex resubscribed to a new query, `useQuery` returned `undefined` again, and the panel stayed stuck at its `return null` loading gate forever. Introduced 2026-03-26 when a convex-doctor pass moved `Date.now()` out of the query handler into an inline client arg.
  - Fix: capture the timestamp once with `useState(() => Date.now())` so the query args are stable and the subscription can resolve.
  - Both backing queries were verified healthy on the dev and prod deployments; prod currently reports `autoRefreshEnabled: false` with 91 of 134 packages stale, which is why npm numbers were 11 days old. Once this fix deploys, the panel is visible again and the toggle can be flipped.
  - Files: `src/pages/Admin.tsx`

### Changed

- Compact directory page header (2026-07-27 05:20 UTC)
  - Removed ~90px of dead space between the "Components" title and the Featured section on `/components/`. The gap came from stacked spacing: `pt-8 pb-4` around the title, `py-4` on the content container, and a `lg:pt-12` offset on the sidebar.
  - The title is now `text-xl` (was `text-2xl`) with the "Open-source building blocks for your Convex app" subtitle inline on the same baseline, header padding tightened to `pt-5 pb-1`, and the sidebar top offset removed so the Submit button and categories align with the Featured heading.
  - Decision made from five HTML mockups (current state annotated plus four layout options) saved in `mockups/components-header-mockups.html`; the compact left-aligned option kept the visible `h1` for SEO and matched the page's left-aligned grid, beating centered and in-nav breadcrumb alternatives.
  - Files: `src/pages/Directory.tsx`, `mockups/components-header-mockups.html` (new)

- PageSpeed LCP and bundle split (2026-07-27 00:25 UTC)
  - Cut the initial JavaScript bundle from 513,824 to 273,486 bytes brotli compressed (47%) by code splitting routes that were already noindex: Admin, Dashboard, Documentation, Profile, ProfileEditSubmission, and SubmitCheck now load on demand via `React.lazy`. Indexed routes (directory, detail pages, category pages, submit, submissions) stay eagerly imported so crawlers never wait on a lazy chunk and the SEO score of 100 is untouched.
  - New `src/components/CodeBlockLazy.tsx` loads the syntax highlighter (`@pierre/diffs` plus the Shiki engine, a 325 KB chunk) on demand with a plain `<pre>` fallback that matches CodeBlock's own text branch, so code paints immediately and colors appear when the chunk lands. Swapped in `ComponentDetail.tsx`, `Markdown.tsx`, and `AgentInstallSection.tsx`.
  - Fixed the inert `public/_headers` file: it landed at `dist/components/_headers` while Netlify publishes `dist`, so its rules never applied in production (verified: `/components/dashboard` returned no `x-robots-tag`, hashed assets returned `max-age=0`). The rules now live in `netlify.toml` `[[headers]]` blocks: `X-Robots-Tag: noindex, nofollow` for admin, callback, profile, and dashboard routes, plus `Cache-Control: public, max-age=31536000, immutable` for hashed `/components/assets/*` files. `public/_headers` removed.
  - LCP and CLS polish: preloaded the two above-the-fold fonts (GT America Regular, Publico Headline Roman) in `index.html` using link tags only, so the og-meta edge function regexes are untouched; the Directory loading skeleton now mirrors the real card layout (aspect-video thumbnail plus body) instead of an 80 px stub, so cards no longer grow and shift when data lands; the Header logo and ComponentCard images got explicit width/height; removed `verbose: true` from the Convex client, which was logging every websocket message to the production console.
  - Verified: app typecheck shows only the two pre-existing unrelated errors; production build produces separate chunks for all six lazy routes plus CodeBlock; browser test on the built output confirmed the directory and detail pages render with data, JSON-LD (`SoftwareSourceCode`), title, and canonical still inject on detail pages, and the Documentation and Dashboard chunks load on demand with their auth gates intact.
  - PRD: `prds/pagespeed-lcp-bundle-split.md`
  - Files: `netlify.toml`, `public/_headers` (removed), `index.html`, `src/main.tsx`, `src/components/CodeBlockLazy.tsx` (new), `src/pages/ComponentDetail.tsx`, `src/components/Markdown.tsx`, `src/components/AgentInstallSection.tsx`, `src/pages/Directory.tsx`, `src/components/Header.tsx`, `src/components/ComponentCard.tsx`

### Added

- Per-category thumbnail toggle (2026-07-26 23:55 UTC)
  - New "Hide all thumbnails in this category" checkbox in the category edit form under Settings > Category Management, so an admin can flatten a category's grid in one place instead of editing each component. Categories with it on show a "thumbnails hidden" badge in the admin list.
  - Motivation: on a page where only two of ten components have an image, the tall image cards sit beside short text cards and the grid rows stop lining up. Official Convex Components was the case that surfaced it.
  - Applies to the category landing page and to that category's grouped section on the directory homepage. The Featured section is deliberately unaffected, since it already forces thumbnails on and featured placement is where the image earns its space.
  - Composes with the existing per-component `hideThumbnailInCategory`: either switch hides the image, and turning the category flag back off restores whatever each component had set.
  - Backed by a new optional `hideThumbnails` field on the `categories` table. Existing rows default to showing thumbnails.
  - PRD: `prds/category-hide-thumbnails.md`
  - Files: `convex/schema.ts`, `convex/packages.ts`, `src/pages/Admin.tsx`, `src/pages/CategoryPage.tsx`, `src/pages/Directory.tsx`

- Official Convex Components category (2026-07-26 19:20 UTC)
  - New admin toggle in Settings > Category Management that turns on a top level "Official Convex Components" category at `/components/categories/get-convex`. Off by default; the row is created on first enable, and later toggles only flip `enabled`, so edits to the label, description, and sort order survive being switched off.
  - Membership is computed, not assigned. A component counts as official when its repository is in the `github.com/get-convex` org or its npm name uses the `@convex-dev/` scope, which is the same rule the `/components/get-convex-llms.txt` and `/components/get-convex.md` endpoints already used. That rule now lives in one place, `shared/officialComponents.ts`, and `convex/http.ts` calls it instead of keeping its own copy.
  - Components keep their existing functional category. An `@convex-dev/agent` package stays under Durable Functions and also appears under Official Convex Components, because a package row can only hold one `category` slug and official status cuts across all of them.
  - Backed by a new `derivedFrom: "official"` field on the `categories` table. `recountCategoryStats`, `getCategoryBySlug`, and `listApprovedComponents` branch on it to resolve membership by rule; everything else (admin listing, enable/disable, counts, sidebar links, the landing page with its search, sort, and pagination) works unchanged because it is a real category row.
  - Guardrails: the category is filtered out of every category picker (submit form, profile edit, admin component editor), `updateComponentDetails` rejects a manual assignment to it with a clear error, its slug cannot be renamed (the input is disabled in admin and the mutation throws), and it is excluded from the sidebar "All" total so official components are not counted twice. The directory homepage does not render a section for it, which would otherwise duplicate every official component.
  - New admin mutation `packages.setOfficialCategoryEnabled`. `packages.listCategories` now returns a `derived` boolean.
  - PRD: `prds/official-convex-components-category.md`
  - Files: `shared/officialComponents.ts` (new), `convex/schema.ts`, `convex/packages.ts`, `convex/http.ts`, `src/pages/Admin.tsx`, `src/lib/categories.ts`, `src/components/CategorySidebar.tsx`, `src/pages/Profile.tsx`, `src/pages/ProfileEditSubmission.tsx`

- Dashboard npm sync column and filter (2026-07-26 06:05 UTC)
  - New sortable "Last npm Sync" column in the dashboard Components table, placed right after Last Published, so an admin can tell at a glance whether the nightly refresh cron and the manual "Refresh all" action are actually pulling fresh npm data.
  - The cell shows the age of `lastRefreshedAt` (for example "3h ago", "5d ago") with the exact timestamp on hover, "Never" for packages that have never synced, amber text once a sync is older than seven days, and a red warning icon carrying the `refreshError` message when the last sync failed. Sorting treats never-synced rows as the oldest.
  - New "npm Sync" filter in the filters bar: all sync states, synced last 24h, synced last 7 days, stale over 7 days, never synced, and sync errors. The sync value also lands in the CSV and PDF exports and in the PDF filter summary.
  - Frontend only. `lastRefreshedAt` and `refreshError` were already stored on the packages table and already returned by `api.packages.getAllPackages` through `adminPackageValidator`.
  - PRD: `prds/dashboard-npm-sync-column.md`
  - Files: `src/pages/Dashboard.tsx`

- Submit form draft persistence across auth redirects (2026-07-24 06:20 UTC)
  - The submit form now saves every text field, the checklist state, and generated content to sessionStorage as you type, restores it on page load, and clears it after a successful submission. This survives the full-page WorkOS sign-in redirect, which previously wiped all in-progress work when the session token expired mid-form. A toast confirms when a draft is restored. Uploaded logo/thumbnail files cannot be persisted and must be re-picked after a redirect.
  - PRD: `prds/submit-flow-feedback-fixes.md`
  - Files: `src/pages/SubmitForm.tsx`

- User README refresh from profile (2026-07-23 21:30 UTC)
  - New "Update README" button on Profile submission cards (between Edit and Send Request, shown only when the submission has a GitHub repo URL). Owners can pull their latest README from GitHub without waiting for an admin.
  - New public mutation `packages.refreshMyReadme`: requires auth, verifies ownership via `userOwnsPackage`, requires a `repositoryUrl`, and enforces a per-user rate limit of 3 refreshes per 10 minutes (backed by the new `readmeRefreshRequests` table with `by_userKey_and_createdAt` index) so GitHub is not spammed. On success it schedules the same `internal.seoContent.refreshReadme` action the Admin "Update README" button uses.
  - Rate limit errors return a `ConvexError` with the reset time, which the Profile toast surfaces. A 60 second client-side cooldown prevents rapid re-clicks.
  - PRD: `prds/user-readme-refresh.md`
  - Files: `convex/schema.ts`, `convex/packages.ts`, `src/pages/Profile.tsx`
  - Verification: convex typecheck passed; frontend lint clean on edited files (the two pre-existing `tsc` errors in `CodeBlock.tsx` and `CategoryPage.tsx` are unrelated).

- Header component search (2026-07-15 06:30 UTC)
  - New magnifying glass icon (Phosphor `MagnifyingGlass`) in the global header, left of the Submit link on desktop and always visible on mobile. Opens a dropdown search panel with an auto-focused input, 300ms debounced live results (component name, verified badge, short description, category), and a "View all results in directory" footer. Enter or the footer button lands on `/components/?q=<term>`; `Directory.tsx` now seeds its search box from the `q` param, so the existing directory search behavior is unchanged.
  - New public Convex query `searchDirectoryComponents` (`convex/packages.ts`) using full text search indexes `search_name`, `search_componentName`, `search_description`, and the new `search_shortDescription` (`convex/schema.ts`), server-filtered to `reviewStatus=approved` + `visibility=visible`, skipping deletion-marked packages, deduped with name matches ranked first, capped at 10 compact PII-free results.
  - New `src/components/HeaderSearch.tsx`; wired into `src/components/Header.tsx`. Escape and outside click close the panel; queries skip until 2+ characters.
  - PRD: `prds/header-component-search.md`
  - Verification: frontend and convex typechecks passed; `npx convex run packages:searchDirectoryComponents` on dev verified approved-only results and shortDescription matching; in-browser test confirmed the full flow including result navigation and directory pre-fill.
  - Follow-up (2026-07-15 17:40 UTC): arrow key navigation in the results dropdown. ArrowDown/ArrowUp move a highlight through the list (wrapping at the ends) and keep the active row scrolled into view; Enter opens the highlighted result, or the full directory when nothing is highlighted; hover syncs the highlight.
  - Follow-up (2026-07-15 18:05 UTC): Cmd+K (Ctrl+K on Windows/Linux) toggles the search from anywhere on the page and focuses the input. Only the visible header instance responds (desktop vs mobile checked via `offsetParent`). The icon tooltip mentions the shortcut and a small command-K kbd hint shows inside the search input on desktop.

### Fixed

- README include markers were never detected (2026-07-24 06:20 UTC)
  - Root cause: `sanitizeReadme` in `convex/seoContent.ts` strips all HTML comments from the fetched README before `extractReadmeIncludeBlock` ran, so the `<!-- START/END: Include on https://convex.dev/components -->` markers were always removed and extraction always fell back to the full README.
  - Fix: `fetchGitHubReadme` now also returns the raw unsanitized README (`rawFullContent`), and extraction runs on that raw text. The marked block gets a light cleanup (comments, Convex badge, whitespace); READMEs without markers keep the exact same sanitized fallback output as before. Affects content generation, README refresh, and the submit form preview. Existing stored content is untouched until the next generation or refresh.
  - Files: `convex/seoContent.ts`

- Preview sections now render markdown like the live detail page (2026-07-24 06:20 UTC)
  - Root cause: previews in the submit form, profile, and admin editor wrapped markdown in Tailwind `prose prose-sm` classes, but the typography plugin is not installed, so lists rendered without bullets or indentation.
  - Fix: previews use the same `markdown-body` class as the detail page, with a new `markdown-body-compact` variant in `src/index.css` for smaller preview panes.
  - Files: `src/pages/SubmitForm.tsx`, `src/pages/Profile.tsx`, `src/pages/ProfileEditSubmission.tsx`, `src/components/ComponentDetailsEditor.tsx`, `src/index.css`

- Featured cards on the Directory page were not showing all-time downloads after enabling the admin toggle (2026-07-15 06:15 UTC)
  - Root cause: `getFeaturedComponents` in `convex/packages.ts` mapped its result inline and omitted `allTimeDownloads`, so Featured cards always received `undefined` and hid the figure (the never-show-0 rule). The flat list from `listApprovedComponents` was unaffected.
  - Fix: one line adding `allTimeDownloads: pkg.allTimeDownloads` to the featured mapper. Verified in the browser: all 25 rendered cards (Featured and flat) now show the total, e.g. Stripe `401.2k total`.

### Changed

- Submit forms ask for the npm package name instead of the full npm URL (2026-07-24 06:20 UTC)
  - The submit form and preflight checker now take a package name (e.g. `@scope/my-package`) and build `https://www.npmjs.com/package/<name>` themselves. Pasting a full npm URL still works: the name is extracted automatically. Backend payloads are unchanged. New shared helper: `src/lib/npmPackage.ts`.
  - Files: `src/pages/SubmitForm.tsx`, `src/pages/SubmitCheck.tsx`, `src/lib/npmPackage.ts`

- Component name placeholder no longer suggests "Convex" in the title (2026-07-24 06:20 UTC, updated 06:30 UTC)
  - Placeholder changed from "Convex Agent" to the neutral "Component Name" everywhere the name field appears, so submitters are not nudged into prefixing their component name with Convex or copying an example name.
  - Files: `src/pages/SubmitForm.tsx`, `src/pages/Submit.tsx`, `src/pages/Profile.tsx`, `src/pages/ProfileEditSubmission.tsx`, `src/components/ComponentDetailsEditor.tsx`

- Most downloads sort now ranks by all-time downloads (2026-07-15 06:20 UTC)
  - `sortPackages` in `convex/packages.ts` sorts the `downloads` mode by `allTimeDownloads` instead of `weeklyDownloads`, independent of the admin display toggles. Applies to both the Directory dropdown and category pages since both use `listApprovedComponents`.
  - New submissions without a stored all-time value yet fall back to their weekly count so they rank rather than sinking to zero; equal totals tie-break by weekly.
  - Verified on dev: Expo Push Notifications (304k all-time, 19k/wk) now ranks above WorkOS AuthKit (292k all-time, 21k/wk), the reverse of the old weekly order.

### Added

- Accurate weekly and all-time downloads across the app (2026-07-15 06:10 UTC)
  - All-time downloads are now truly all time. npm's point downloads API silently clamps any range to 18 months, so stored `allTimeDownloads` values were really "last 18 months". `fetchNpmPackageHandler` (`convex/packages.ts`) now sums sequential 540-day windows from the package created date (`metadata.time.created`, floored at 2015-01-10) with clamp detection on each response, and sends a `User-Agent` header on all npm calls.
  - Weekly downloads now use npm's `last-week` alias endpoint, which is the exact number npmjs.com shows. The previous explicit 7-day window ending today undercounted by up to 40% because npm's per-day data lags 1-2 days (verified live: `@convex-dev/agent` 49,951 via window vs 86,832 via `last-week`).
  - Download fetch failures can no longer zero out stored data: both fetchers return `undefined` on failure or clamp, `_updateNpmDataAndTimestamp` skips undefined download fields, and partial failures are recorded in `refreshError` (e.g. "npm downloads API failed for all-time counts; kept previous values").
  - New Downloads Display panel in Admin (`src/pages/Admin.tsx`) with `showWeeklyDownloads` (default on) and `showAllTimeDownloads` (default off) toggles stored in `adminSettings`; new lightweight public query `getDownloadsDisplaySettings`. Directory, CategoryPage, and ComponentDetail (sidebar stats and related cards) render weekly, all-time, or both side by side (`5.7k/wk · 1.5M total`) per the toggles; packages without a stored all-time value show nothing rather than 0.
  - Dashboard per-package table gained a sortable All Time column next to Wk Downloads (em dash until backfilled); download formatters gained a `B` tier for billion-scale counts; clarifying comment on `dashboard.totalDownloads` (it is the weekly sum).
  - Backfill completed on dev: 48/48 packages refreshed (14 rate-limited packages retried successfully, zero refresh errors after). Spot checks match npm exactly: `@convex-dev/agent` 86,832/wk and 1,472,612 all time; `@turf/convex` 145,810,278 all time verified against an independent yearly-window sum.
  - First-publish-date audit (2026-07-15 06:00 UTC): confirmed all-time counts start at each package's npm `time.created` date and never earlier. Recomputed sums independently for six packages spanning 2016 through 2025 first publishes (`@convex-dev/rate-limiter` 2024-10-22, `@convex-dev/agent` 2025-04-07, `@convex-dev/workpool` 2025-01-29, `@convex-dev/presence` 2025-05-28, `@convex-dev/resend` 2025-06-13, `@turf/convex` 2016-07-06); every stored value matched to the download and no package had a `refreshError`.
  - PRD: `prds/downloads-display-and-alltime-accuracy.md`
  - Verification: `npx tsc --noEmit -p .` and `npx tsc --noEmit -p convex` passed; live single-package and full backfill runs on the dev deployment verified against api.npmjs.org.

- Version numbers and agent instruction block across skills, llms.txt, and markdown indexes (2026-07-15 05:05 UTC)
  - Every entry in `/components/llms.txt`, `/components/get-convex-llms.txt`, `/components/components.md`, and `/components/get-convex.md` now carries a `- Version:` line sourced live from `packages.version`, so agents can tell whether their training data is stale for a component. Shared `buildLlmsTxtBody` and `buildMarkdownIndexBody` in `convex/http.ts`.
  - Each generated SKILL.md now includes `version:` in its YAML frontmatter and a pinned `Current npm version: package@x.y.z` line after the install command. Both the v2 builder (`shared/buildSkillMd.ts`, new optional `version` on `SkillMdPackageInput`) and the legacy v1 builder (`buildSkillMd` in `convex/seoContent.ts`) emit it; the two explicit call sites in `convex/packages.ts` (submit path and `buildSubmissionUpdates`) now pass version through.
  - Stored skills stay in sync with npm: `_updateNpmDataAndTimestamp` (`convex/packages.ts`) rebuilds `skillMd` inside the same patch whenever the npm version changed and the package has v2 generated content. This covers both the daily `check-and-refresh-packages` cron and the admin Refresh npm data button.
  - One-line agent instruction block added at the top of all agent-facing outputs: index headers ("Agents: before writing code that uses a component, fetch its Skill link (SKILL.md)..."), each SKILL.md (blockquote right after the frontmatter: "Agents: read this skill fully before writing code that uses X..."), per-component markdown (`buildComponentMarkdown`), and per-component llms.txt (`/api/component-llms`), the last two only when the component has a public skill.
  - New admin `rebuildAllSkillMd` mutation in `convex/seoContentDb.ts` force-rebuilds skills for all approved packages with v2 content (skips no-op writes); `_backfillSkillMdBatch` gained a `force` flag. Ran once on dev: 7 packages patched; v1-only skills refresh on their next AI regeneration.
  - PRD: `prds/skill-version-and-agent-instructions.md`
  - Verification: `npx tsc -p convex --noEmit` and `npm run build` passed; curl on the dev deployment confirmed version lines and instruction headers on all four index endpoints, frontmatter version + instruction line in rebuilt skills, and a simulated version bump (0.2.0 -> 0.2.1 -> 0.2.0 via `_updateNpmDataAndTimestamp`) rebuilt the skill both ways.

- Official get-convex components list for agents and humans (2026-07-14 04:50 UTC)
  - New auto-updating endpoints scoped to components built by the Convex team: `https://www.convex.dev/components/get-convex-llms.txt` and `https://www.convex.dev/components/get-convex.md`. A component qualifies when its `repositoryUrl` is under `github.com/convex/` or its npm name starts with `@convex-dev/` (`isOfficialPackage` in `convex/http.ts`). Both reuse `_listApprovedPackages` live at request time, so newly approved official components appear automatically with no cron or admin flag.
  - `convex/http.ts`: extracted shared `buildLlmsTxtBody` and `buildMarkdownIndexBody` builders from the existing `/api/llms.txt` and `/api/markdown-index` handlers, added `GET /api/get-convex-llms.txt` and `GET /api/get-convex-markdown` routes, and cross-linked the official list from the main llms.txt header (and back).
  - `netlify.toml`: redirects for the two new `/components/` paths; `netlify/edge-functions/og-meta.ts`: direct proxy branches for both (redirects do not fire after the edge function runs).
  - `src/pages/Directory.tsx`: For Agents section gained a second row with `get-convex-llms.txt` and `get-convex.md` buttons plus copy explaining the official-only scope.
  - PRD: `prds/get-convex-official-list.md`
  - Verification: `npx tsc -p convex --noEmit` and `npm run build` passed; curl on the dev deployment returned 200 with exactly the 10 `@convex-dev/` scoped components on both new routes, and the full-directory endpoints unchanged apart from the new cross-link header line.

- Stable SKILL.md URLs and agent skill install experience (2026-07-13 19:05 UTC)
  - Every component's generated `skillMd` is now served at `https://www.convex.dev/components/<slug>/SKILL.md`. New `/api/skill?slug=` GET + OPTIONS routes in `convex/http.ts` return raw markdown with CORS headers, and 404 for hidden or archived packages, missing skills, or packages with `hideSeoAndSkillContentOnDetailPage` set. The `component-markdown` Netlify edge function (`netlify/edge-functions/component-markdown.ts`) now recognizes the `SKILL.md` filename and proxies it to the new route; the existing `/components/*/*.md` path in `netlify.toml` already matched.
  - `shared/componentUrls.ts` builders gained `skillPath`/`skillUrl` (`buildComponentPaths`, `buildComponentUrls`, `buildComponentApiUrls`, `buildComponentClientUrls`).
  - New Skill block in the "Use with agents and CLI" section (`src/components/AgentInstallSection.tsx`), shown only when a skill exists: a Copy skill button for the raw markdown, a View SKILL.md link, and an install skill agent prompt ("Paste this prompt into any agent") via new `generateSkillInstallPrompt` in `src/lib/promptComposer.ts` (with shared `getSkillFolderName` matching the skill frontmatter kebab name). Harness tabs with per-harness curl commands were built first, then removed the same day (2026-07-13 19:35 UTC) in favor of the single agent prompt.
  - Skill URL added to agent discovery surfaces: `generateClaudePrompt` and `generateUniversalPrompt` documentation lists, `/api/component-llms`, `/api/llms.txt` index, `/api/markdown-index`, `buildComponentMarkdown` (convex/http.ts), and `buildMarkdownDoc` (`src/pages/ComponentDetail.tsx`). Detail page footer gained a "View SKILL.md" link next to "View llms.txt"; the Download Skill button got a folder hint tooltip; the dead `handleCopySkill`/`skillCopied` code was removed.
  - Admin: new "Update Skill"/"Generate Skill" button (`src/pages/Admin.tsx`) next to Update README calls the new `rebuildSkillMd` mutation in `convex/seoContentDb.ts` (deterministic rebuild via `tryBuildSkillMd`, no AI call; ConvexError toast when v2 content is missing). New "Backfill Skills" button in Auto-Refresh Settings triggers `backfillAllSkillMd`, a batched self-scheduling backfill that builds skills for approved packages with v2 content but no `skillMd`.
  - PRD: `prds/skill-url-and-agent-install.md`
  - Verification: `npx tsc -p convex --noEmit` and `npm run build` passed; curl against the dev deployment confirmed 200 markdown for `/api/skill?slug=better-auth`, 404 for unknown/missing slugs, and skill links present in `/api/llms.txt`, `/api/component-llms`, `/api/markdown`, and `/api/markdown-index`.

- In-app review status notifications for submitters (2026-07-09 04:14 UTC)
  - New `statusNotifications` table (`convex/schema.ts`) records one row per real review status transition (in_review, approved, changes_requested, rejected), written from `updateReviewStatusHelper` in `convex/packages.ts`. Every status change path flows through that helper, so notifications fire for admin manual review, auto AI review setting in_review on submit, and AI auto approve/reject, regardless of the Auto AI Review toggle state.
  - New `convex/notifications.ts`: `getMyStatusNotifications` (unread feed for the header bell, minimal metadata only), `markStatusNotificationRead`, `markAllStatusNotificationsRead`. Ownership checks compare `recipientEmail` against the caller's WorkOS JWT email.
  - `src/components/Header.tsx`: bell dropdown gains a "Status updates" section with per-status copy ("X is now in review", "X was approved", "Changes requested for X", "X was not approved") and status-colored dots; badge count includes status notifications; items mark read on click and link to `/components/profile#pkg-<id>`; "Mark all read" button in the dropdown header.
  - Dedupe and idempotency: no notification when status did not change, on the initial pending state, when the package has no submitter email, or when an identical unread notification already exists.
  - PRD: `prds/status-change-notifications.md`
  - Verification: `npx tsc -p convex --noEmit` passed; app tsc shows only pre-existing errors (CodeBlock, CategoryPage, Directory); eslint clean on new code; `npx convex dev --once` deployed schema and functions.

### Changed

- Labeled documentation links in the agent copy prompt (2026-07-14 18:30 UTC)
  - The "Copy prompt" block in "Use with agents and CLI" (built by `generateClaudePrompt` in `src/lib/promptComposer.ts`) listed the markdown and llms URLs as bare bullets while the skill URL had a `Skill:` label. Both now carry `Markdown:` and `LLMs.txt:` labels, matching `generateUniversalPrompt`, so agents know what each URL contains before fetching.
  - Fixed a related edge case in `generateUniversalPrompt`: the `- Repository:` bullet was pushed outside the `if (urls)` block, so a component with a repo URL but no slug produced a stray bullet with no `Documentation:` header. Documentation lines are now collected first and the header only renders when at least one link exists.

- Component detail page header and footer link polish (2026-07-13 19:42 UTC)
  - Author row order swapped in `src/pages/ComponentDetail.tsx`: "For Agents" now renders before "Download Skill".
  - Footer link anchor text changed from generic "View llms.txt" / "View SKILL.md" to `{component.name} llms.txt` / `{component.name} SKILL.md` so each component page emits descriptive, entity-specific anchor text for SEO/AEO crawlers. Hrefs unchanged.

- Component detail footer spacing and heading cleanup (2026-07-13 20:01 UTC)
  - Removed the doubled divider above Related Components in `src/pages/ComponentDetail.tsx` (the llms link row had a `border-b` stacked on the Related section's `border-t`) and equalized the vertical spacing so the llms.txt/SKILL.md links sit centered between the two dividers (24px above and below; Related section margin `mt-8` -> `mt-6`).
  - Added a "For LLMs and AI agents" `h3` above the llms.txt/SKILL.md links so crawlers and answer engines get labeled context for the agent files (AEO/SEO), and the links appear in the page heading outline for screen readers.
  - Keywords label restyled from all-caps `text-xs` uppercase `p` to a semantic `h3` matching the "From the README.md" heading style (`text-base font-semibold text-text-primary`).

- Updated OpenAI env-fallback model to `gpt-5.5` and fixed Chat Completions token param (2026-06-21 23:55 UTC)
  - `convex/seoContent.ts` env default moved from `gpt-4o` to `gpt-5.5`; `convex/aiReview.ts` env default moved from the non-catalog `gpt-5.2` to `gpt-5.5` (current flagship per the [OpenAI models catalog](https://developers.openai.com/api/docs/models)).
  - Both OpenAI Chat Completions calls now send `max_completion_tokens` instead of `max_tokens`. GPT-5 models reject `max_tokens` with a 400, so the prior `gpt-5.2` default in `aiReview.ts` would have failed whenever the OpenAI env fallback fired. `max_completion_tokens` is also accepted by `gpt-4o` and admin-configured models, so the shared helper stays compatible with any model an admin sets.
  - Budget raised to 4000 (seoContent) / 4096 (aiReview) so reasoning tokens on GPT-5 do not starve the visible output and return empty content.
  - Files: `convex/seoContent.ts`, `convex/aiReview.ts`
  - Verification: `npx tsc -p convex --noEmit` passed; `ReadLints` clean. Runtime success requires a valid `CONVEX_OPENAI_API_KEY` on the Convex deployment.

- Admin AI Provider Settings: Anthropic "Model docs" link now points to `https://platform.claude.com/docs/en/about-claude/models/overview` (2026-06-21 23:55 UTC)
  - `src/pages/Admin.tsx`: updated the outdated `docs.anthropic.com/en/docs/models` link; remainder of the diff is Prettier formatting only (no behavior change).

### Fixed

- Relative README links resolved to the app origin (404) instead of GitHub, including monorepo subdirectory repos (2026-06-26 19:10 UTC)
  - Symptoms: `@exalabs/convex-exa` rendered `[example/README.md](/example/README.md)` as `https://www.convex.dev/example/README.md` (404); `@posthog/convex` rendered `[example app](../../examples/example-convex/)` as `https://www.convex.dev/examples/example-convex/` (404). The latter link lives in the stored `readmeIncludedMarkdown` snapshot (an older README revision), which is why it didn't appear in the current GitHub README.
  - Root cause: `src/lib/markdownLinks.ts` had two gaps. (1) Root-relative hrefs (leading `/`) were returned untouched, so the browser resolved them against the app origin. (2) The repo URL was only parsed as a bare `owner/repo`, so two things broke: monorepo subdirectory URLs like `https://github.com/PostHog/posthog-js/tree/main/packages/convex` didn't parse at all (link returned unchanged → resolved against the page path → `convex.dev/...`), and relative links were resolved against the repo root rather than the README's actual directory, so `../../` climbed from the wrong place. The base ref was also hardcoded to `/blob/main/`, which 404s for `master`-default repos.
  - Fix: rewrote the resolver to parse `owner`, `repo`, `ref`, and subdirectory from the repository URL (handles `.../tree/<branch>/<subdir>` and `.git`/`#readme` suffixes). Relative links now resolve against the README's subdirectory (so `../../examples/example-convex/` from `packages/convex/` correctly becomes the repo root `examples/example-convex/`), root-relative `/x` maps to the repo root, and the result is built as `https://github.com/<owner>/<repo>/blob/<ref>/<path>` (GitHub 301-redirects `/blob/<dir>` to `/tree/<dir>`, so directory links work too). `ref` uses the branch from the URL when present, else `HEAD` (works for both `main` and `master`). Images use the same path logic against `raw.githubusercontent.com/<owner>/<repo>/<ref>/`. Query strings and `#fragments` are preserved; anchors, absolute URLs, and protocol-relative (`//`) URLs pass through unchanged; non-GitHub repo URLs are left as-is.
  - Files: `src/lib/markdownLinks.ts`
  - Verification: `ReadLints` clean. Node simulation confirmed exa (`/example/README.md` → `blob/HEAD/example/README.md`) and posthog (`../../examples/example-convex/` → `blob/main/examples/example-convex/`, `CONTRIBUTING.md` → `blob/main/packages/convex/CONTRIBUTING.md`) plus pass-through for anchors/absolute/`//`/non-GitHub. `curl` confirmed these GitHub URLs resolve: `blob/main/examples/example-convex/` → 301→tree, `blob/main/packages/convex/CONTRIBUTING.md` → 200, `blob/HEAD/example/README.md` → 200.

- `getPromptVersions` / `getSeoPromptVersions` threw `ReturnsValidationError` on the admin prompt-history view (2026-06-21 17:14 UTC)
  - Root cause: both queries return full documents from `.take(50)`, which always include the system field `_creationTime`. The hand-written `returns:` object validators omitted `_creationTime`, and Convex object validators reject extra properties at runtime, so every call that returned at least one row failed validation.
  - Fix: removed the `returns:` validators from both admin queries and let TypeScript inference cover the full `Doc<>` shape, following Convex's updated return-validator guidance (validators are for exact runtime contracts, not standard well-typed queries). Returned objects now include `_creationTime`; the `Admin.tsx` consumers only read existing fields, so the superset is backward compatible.
  - Files: `convex/aiSettings.ts`
  - Verification: `ReadLints` clean (`v` still used by other functions in the file).

- AI content generation failing with "All AI providers failed. anthropic (env): 404 ... model: claude-sonnet-4-20250514" (2026-06-21 23:47 UTC)
  - Root cause: `convex/seoContent.ts` `buildSeoCandidates` set the Anthropic env-fallback default to `claude-sonnet-4-20250514`, a model ID the Anthropic API no longer serves, so every env-based Anthropic request returned `404 not_found_error`. When the OpenAI key was also invalid, the fallback chain exhausted and surfaced the "All AI providers failed" error.
  - Fix: updated the default to `claude-sonnet-4-6` (Claude Sonnet 4.6 Claude API ID per the [Anthropic models overview](https://platform.claude.com/docs/en/about-claude/models/overview)). `convex/aiProviderFallback.ts` was intentionally left unchanged; it passes `defaultEnvModels[provider]` through verbatim and never hardcodes a model.
  - Files: `convex/seoContent.ts`
  - Verification: `npx tsc -p convex --noEmit` passed; `ReadLints` clean. Runtime success still depends on a valid `ANTHROPIC_API_KEY` on the Convex deployment.

### Added

- Edge-prerendered crawlable body content for component detail pages to help with "Crawled - currently not indexed" in Google Search Console (2026-06-16 12:50 UTC)
  - Context: component detail pages (`/components/<slug>`) are a client-rendered Vite + React SPA, so the initial HTML `<body>` is empty (`<div id="root"></div>`) until JS runs. Googlebot can render JS (the GSC Live Test renders fine and shows a screenshot), but that happens in a deferred second pass subject to rendering budget/timeouts. Putting the content in the first-pass HTML removes that dependency and makes indexing more reliable.
  - Fix: `netlify/edge-functions/og-meta.ts` injects real content into `#root` for component detail pages only (h1, value prop, install command, about, benefits, use cases, FAQ, outbound links), reusing the existing `packages:getComponentBySlug` query. Only injected when the slug resolves to a live (non-hidden/archived/deleted) component.
  - No frontend changes: `createRoot()` clears `#root` children on mount, so React replaces the injected content with the normal styled app — no hydration-mismatch risk and no visual change. The injected wrapper is `display:none` so users see the usual blank-then-content load with no flash of unstyled content; the markup is still present in the first-pass HTML for crawlers that do not execute JS.
  - Scope note: the `/components` directory index is intentionally out of scope here — the `og-meta` edge function's `/components/*` path does not match the bare `/components` URL, so injecting there needs a separate Netlify path-matching change. The sitemap is healthy (robots.txt references it, returns 200 valid XML); the GSC "Sitemaps: Temporary processing error" is a transient GSC-side state.
  - Files: `netlify/edge-functions/og-meta.ts`
  - PRD: `prds/seo-crawlable-body-injection.md`
  - Verification: confirmed on deploy preview 33 — `/components/abdssamie/convex-analytics` raw HTML contains the injected `<h1>` and content (9 KB vs ~4 KB empty shell). Recrawl/indexing impact will surface in GSC over the following days.

- Preflight check admin bypass for users signed in with an `@convex.dev` email (2026-06-11 21:55 UTC)
  - `/api/preflight` now skips the 10 checks/hour rate limit, the 30-minute per-repo cache, and the one-concurrent-check gate for admins, so every admin run returns a fresh result.
  - `src/pages/SubmitCheck.tsx` warning modal shows admin-specific copy (no limits, cache bypassed) via `api.auth.isAdmin`; the "checks remaining" footer no longer shows for admins.
  - Non-admin behavior unchanged. Admin runs still write `preflightChecks` records, which refresh the cache for everyone else.
  - PRD: `prds/preflight-admin-bypass.md`

### Fixed

- Weekly downloads showing 0 for newly published packages like `@exalabs/convex-exa` (2026-06-12 00:25 UTC)
  - Root cause: npm's `downloads/point/last-week` alias was serving a stale window (nine days behind). The Exa package was published 2026-06-03, so the stale window genuinely contained zero downloads while npmjs.com showed 70/wk.
  - Fix: `fetchNpmPackageHandler` in `convex/packages.ts` now requests an explicit 7-day window (`point/<today-6d>:<today>`), which matches the number npmjs.com displays. The admin refresh pipeline itself was working correctly.
  - PRD: `prds/npm-weekly-downloads-stale-window.md`
  - Verification: live API calls confirmed `point/2026-06-05:2026-06-11` returns 70 while `last-week` returned 0.

- AI reviews failing every repo with false "No convex.config.ts found" (2026-06-11 21:48 UTC)
  - Root cause: the `GITHUB_TOKEN` Convex environment variable expired or was revoked. GitHub returns 401 for every request carrying an invalid token, even public repos, and `fetchGitHubRepo` treated all non-OK responses as missing files.
  - Fix: new `githubFetch` helper in `convex/aiReview.ts` drops the token and retries unauthenticated on 401, and throws a clear `ConvexError` on 403/429 so rate limits record review status `error` instead of a false `failed`.
  - Token rotated to a new classic `public_repo` token (2026-06-12 00:11 UTC). A fine-grained token was rejected by the Exa Labs org policy (403 for fine-grained tokens with lifetime over 366 days), so classic remains the right choice for cross-org public repo reads. This also restores `seoContent.ts` readme fetches and `packages.ts` GitHub stats.
  - PRD: `prds/ai-review-github-token-401.md`
  - Verification: `npx tsc -p convex --noEmit` passed; `runPreflightCheck` on exa-labs/exa-convex returned `status: "passed"` with all 14 criteria passing.

- Component use-case lists rendering as a single paragraph when LLM output used Unicode bullets (2026-06-11 13:30 UTC)
  - Root cause: generated `useCases` markdown used `•` instead of `-`, so remark-gfm treated the block as plain text.
  - Fix: added composable `shared/normalizeMarkdown.ts` pipeline (line endings + Unicode bullets) applied at render, ingest, and markdown export. Tightened `DEFAULT_CONTENT_PROMPT_TEMPLATE` to require `- ` list syntax.
  - Files: `shared/normalizeMarkdown.ts`, `shared/seoPromptTemplate.ts`, `src/components/Markdown.tsx`, `convex/seoContent.ts`, `convex/packages.ts`, `convex/http.ts`, `convex/router.ts`, `shared/buildSkillMd.ts`
  - Verification: `npx tsc --noEmit` passed.

### Changed

- Submit form "Component Directory Content" section now marked as optional (2026-05-27 UTC)
  - `src/pages/SubmitForm.tsx`: label shows "(optional)" in tertiary text; helper text explains users can skip and generate content later from their profile page.
  - Context: a user reported confusion thinking content generation was required before submitting. Generated content fields have always been optional on the backend.

### Added

- HTTP one-shot load for component detail pages so search engine renderers can index content (2026-06-09 10:38 UTC)
  - `src/lib/convexHttp.ts` (new): module-level `ConvexHttpClient` and `useComponentBySlug` hook that returns the live `useQuery` value when the websocket is connected and a one-shot HTTP result (`/api/query`) otherwise.
  - `src/pages/ComponentDetail.tsx`: swapped the single `useQuery(api.packages.getComponentBySlug, ...)` call for `useComponentBySlug(slug)`; loading/not-found branches unchanged.
  - Context: Google Search Console showed `convex.dev/components/*` stuck at "Discovered - currently not indexed". The Live URL test rendered an empty page; the captured console showed the Convex websocket stuck `connecting` with `ModifyQuerySet` messages never sent, so content never loaded for Googlebot. HTTP completes inside the render budget, so content now renders for crawlers that execute JS. Frontend-only; reuses the already-deployed public query (no Convex deploy). No-JS/AI crawlers still need server HTML (edge injection or Next.js SSR) as a follow-up.
  - PRD: `prds/component-http-fallback.md`
  - Verification: `ReadLints` clean on edited files; `npx tsc -p . --noEmit` passed; `npx vite build` passed.

- Profile thumbnail upload and replace for owned submissions (2026-05-19 UTC)
  - `src/pages/ProfileEditSubmission.tsx`: Edit flow from Profile (`/profile/edit/:packageId`) now mirrors SubmitForm thumbnail upload (preview, replace, remove, validation). Thumbnail uploads before logo on save so auto-generation respects user uploads.
  - `src/pages/Profile.tsx`: legacy `EditModal` kept in sync with the same thumbnail controls.
  - `convex/packages.ts`: `getMySubmissionForEdit` returns `thumbnailUrl` and `thumbnailUploadedByUser`; new `clearThumbnail` mutation for owners and admins.
  - Verification: `ReadLints` clean; `npm run build` passed.

- Optional component thumbnail upload on submit form (2026-05-19 UTC)
  - `src/pages/SubmitForm.tsx`: submitters can upload a 16:9 thumbnail (.webp, .png, .jpg, max 3MB) below the logo field. Client validates type and size before submit. Upload runs after package creation (thumbnail before logo so auto-generation respects the upload).
  - `convex/schema.ts`: added `thumbnailUploadedByUser` flag on packages.
  - `convex/packages.ts`: `saveThumbnail` now allows package owners or admins and marks user uploads; `saveLogo` skips auto thumbnail generation when a user thumbnail exists; `updateComponentDetails` with `clearThumbnail` clears the flag; `toAdminPackage` exposes the flag for Admin.
  - `convex/thumbnailGenerator.ts` and `convex/thumbnails.ts`: auto, manual, and batch generation skip packages with user-uploaded thumbnails; manual admin generation returns a clear error if a protected thumbnail exists.
  - `src/components/ComponentDetailsEditor.tsx`: generate controls hidden when protected; hide-thumbnail checkbox saves immediately to stay in sync with Admin inline Hide Thumb toggle.
  - `src/pages/Admin.tsx`: passes `thumbnailUploadedByUser` into `PackageComponentDetailsEditor`.
  - Profile submission cards already read `thumbnailUrl` from `getMySubmissions`, so uploaded thumbnails appear after submit.
  - Verification: `ReadLints` clean on edited frontend files; `npx tsc --noEmit -p convex/tsconfig.json` passed; `npm run build` passed (Netlify build step).

- Share this page dropdown on the component detail sidebar (2026-04-21 17:37 UTC)
  - `src/pages/ComponentDetail.tsx`: added an inline `ShareThisPage` component rendered between the rating stars and the "How to get help" button. Supports Share on X, LinkedIn, Bluesky, Reddit, Mastodon, Other... (uses `navigator.share` when available, otherwise copies the URL), and Copy link with a check-icon confirmation. Styling matches the existing Markdown dropdown on the same page (white menu, `shadow-hover`, `hover:bg-bg-hover`), not a new dark variant.
  - Accessibility: trigger uses `aria-expanded` and `aria-haspopup="menu"`, menu uses `role="menu"` with `role="menuitem"` children, and an `sr-only` `aria-live="polite"` region announces "Link copied". Outside click and Escape both close the menu.
  - Verification: `ReadLints` clean on `src/pages/ComponentDetail.tsx`.
- FAQ entry about component thumbnail image sizing (2026-04-20)
  - `src/components/FAQSection.tsx`: added "What size should my component thumbnail be?" between "What are the requirements?" and "How are components sandboxed?" so component authors know to use a 16:9 aspect ratio at 1536 x 864 pixels. FAQ now displays 12 items on the Directory, CategoryPage, and SubmitForm pages.
  - Verification: `ReadLints` clean on `src/components/FAQSection.tsx`; `npm run build` passed.

### Changed

- Auto AI Review completion now groups with security scan Slack output when automation is enabled (2026-05-04 18:58 UTC)
  - `convex/packages.ts`: review completion notifications now use one shared helper. When `autoAiReview` is off, the existing security-only Slack message still sends. When `autoAiReview` is on, Slack waits until both security scan and AI review have terminal results, then sends one grouped message with both status blocks.
  - Verification: `ReadLints` clean on `convex/packages.ts`; `npx tsc --noEmit -p convex/tsconfig.json` passed; `npx netlify build --offline --context production` passed.

- Slack now mirrors all admin-visible write paths on a component (2026-04-18)
  - `addPackageComment`: removed the `if (!isAdmin)` gate so admin replies also notify Slack; `From:` label is now `Admin` or `Submitter` based on role.
  - `requestSubmissionRefresh`: added Slack notification when a submitter clicks "Send Request" from Profile.
  - `addPackageNote`: added Slack notification for admin internal notes (`Internal admin note on ...`) and legacy `[User Request]` replies (`Admin reply (legacy request) on ...`).
  - File changed: `convex/packages.ts`

### Fixed

- Removed admin-only `/components/documentation` from `sitemap.xml` (2026-05-20 UTC)
  - `convex/http.ts`: documentation routes are `noindex, nofollow` (SPA, edge function, and docs) so they should not appear in the sitemap.

- GitHub avatar URLs now use `https://github.com/{owner}.png` again (2026-05-15 04:34 UTC)
  - `convex/packages.ts`: restored avatar generation for new submissions and admin author auto-fill so organization avatars such as `get-convex` load correctly.
  - `migrateAvatarUrls` now converts `https://avatars.githubusercontent.com/{owner}` values back to `https://github.com/{owner}.png`.
  - Keep this format. Do not change owner-based avatars back to `avatars.githubusercontent.com` by username because that can break organization avatars.

- Related components now appear below the sidebar on mobile component detail pages (2026-05-04 18:49 UTC)
  - `src/pages/ComponentDetail.tsx`: extracted the Related Components card grid into a shared renderer, kept the desktop placement at the bottom of the main content column, and rendered the mobile copy after the sidebar so the page reads main content, sidebar, then related components on narrow screens.
  - `files.md`: updated the component detail page description to document the desktop and mobile placement behavior.
  - Verification: `ReadLints` clean on `src/pages/ComponentDetail.tsx` and `files.md`; `npx tsc -p . --noEmit --pretty false` passed; Netlify build command `npm run build` passed.

- Admin mobile settings and API layouts now fit narrow screens cleanly (2026-04-17 23:04 UTC)
  - `src/pages/Admin.tsx`: changed the main admin filter tabs into a horizontal mobile scroller with readable labels, refined the sticky settings jump nav copy and spacing, and made the Category Management rows stack and wrap so count badges, verified badges, descriptions, and actions stay inside the card width.
  - `src/pages/Admin.tsx`: the `api` tab now hides the generic submissions search/list, API endpoint breakdown rows wrap safely, recent requests render as stacked cards on mobile instead of a squeezed table, and API access grant/revoke rows now stack cleanly around long names and emails.
  - Verification: `ReadLints` clean on `src/pages/Admin.tsx`; `npm run build` passed; `npx netlify build --offline --context production` passed.

- Desktop metadata row alignment in submissions tables (2026-04-17 22:26 UTC)
  - `src/pages/Submit.tsx`: normalized the collapsed desktop row so the version pill, status badge, approved detail link, downloads, and submitted date share the same visual center line.
  - `src/pages/Admin.tsx`: matched the same alignment cleanup for the admin submissions row by centering the version pill, review badge, visibility badge, detail link, downloads, and date without changing mobile behavior.
  - Verification: `ReadLints` clean on edited files, `npm run build` passed, and `npx netlify build --offline --context production` passed including Edge Functions bundling.

- Final mobile polish for expanded admin sections plus build verification (2026-04-17 18:51 UTC)
  - `src/pages/Admin.tsx` and `src/components/ComponentDetailsEditor.tsx`: after the responsive fixes, the expanded mobile cards were fitting correctly but still felt a little loose vertically. Tightened the outer disclosure shells and the nested component-details editor from `p-3` to `p-2.5 sm:p-3`, and reduced a couple of mobile-only top margins so the expanded sections read as one clean stack on phones while leaving desktop spacing intact.
  - Verification: `ReadLints` clean on edited files and `npm run build` passed (`vite build`) for the Netlify production build.

- Mobile expanded admin sections still wider than viewport after inner editor fixes (2026-04-17 18:51 UTC)
  - `src/pages/Admin.tsx`: the expanded package shell used `flex flex-col sm:flex-row items-start justify-between ...`. On mobile, `items-start` prevented the left column from stretching across the card width, so `AuthorToggleSection`, `AiReviewResultsPanel`, `PackageComponentDetailsEditor`, and `PackageMetadataEditor` all sized themselves to their contents instead of the viewport-constrained card. This made Package Metadata and AI Review Results still look too wide even after their inner rows were made responsive.
  - Fixed by changing the parent wrapper to `items-stretch sm:items-start` and adding `w-full` to the left content column. Mobile expanded sections now inherit the actual card width; desktop behavior is unchanged.

- Mobile overflow in expanded admin editor sections (2026-04-17 17:52 UTC)
  - `src/pages/Admin.tsx` `SubmitterEmailEditor`, `PackageMetadataEditor`, and `AiReviewResultsPanel`, plus `src/components/ComponentDetailsEditor.tsx`: the expanded mobile views were still using several desktop-first horizontal layouts inside a narrow admin card. The biggest offenders were the author edit form's fixed `grid-cols-2`, long read-only email strings without `break-all`, AI review headers with no `min-w-0`, and inline editor control rows for author auto-fill, logo actions, thumbnail generation, thumbnail upload, badge markdown, and save or regenerate actions.
  - `SubmitterEmailEditor` now switches to `grid-cols-1 sm:grid-cols-2`, wraps long submitter name, Discord, primary email, and additional email strings, and allows the footer buttons to wrap. `PackageMetadataEditor` adds `min-w-0 overflow-hidden` to its expanded content wrapper and lets the save row wrap on small screens.
  - `ComponentDetailsEditor` now adds `min-w-0 overflow-hidden` at the root, stacks the save header on mobile, converts the author auto-fill row and the thumbnail generation controls to `flex-col sm:flex-row`, wraps logo and thumbnail action clusters, stacks the admin checkbox group, constrains badge markdown with local `overflow-x-auto`, and wraps generated-content markdown previews in their own scroll container so wide code or tables stay inside the card instead of widening the full page. The `react-markdown` override typing was also normalized with `Components` and `ComponentPropsWithoutRef`, which removes the stale lint errors in the edited file.
  - `AiReviewResultsPanel` now gives the left header cluster `min-w-0 flex-1`, stacks the title and review date within a shrinkable column, keeps the copy and chevron controls pinned on the right, and adds `break-words` plus `overflow-hidden` to the expanded summary and error blocks so long review text stays inside the card width.

- Mobile: Hide button orphaned between description and expanded content in admin disclosure sections (2026-04-17 17:35 UTC)
  - `src/pages/Admin.tsx` `AuthorToggleSection`, `PackageComponentDetailsEditor`, and `PackageMetadataEditor` headers: the earlier `flex-col sm:flex-row` layout looked fine collapsed but created dead vertical space when expanded, because the pill button ("Hide") sat on its own line between the description and the first form field. Reverted the three headers to a single-row `flex items-start justify-between gap-2 sm:gap-3` layout with `min-w-0 flex-1` on the text wrapper and `shrink-0 whitespace-nowrap` on the button. To keep the collapsed row readable on narrow screens, mobile-only shortened labels were added: "Show author" → "Show", "Edit details" → "Edit", "Edit metadata" → "Edit" (via `sm:hidden` / `hidden sm:inline` span pair). "Hide" is already short enough to share the row with the title. Net result on mobile: both states render as `[title + desc | compact pill]` above `[expanded content]`, no orphan rows.

- Mobile admin card: component name hidden, section headers cramped, action rows icon-only (2026-04-17 17:20 UTC)
  - `src/pages/Admin.tsx` collapsible package header (~line 9094): the `{pkg.name}` span lacked `flex-1 min-w-0` so sibling badges (`shrink-0`) consumed all the horizontal space on mobile and the truncated name collapsed to 0px width — users only saw version + badges + date with no package identity. Fixed by adding `min-w-0 flex-1` and switching the label to `pkg.componentName || pkg.name` so the friendly component name shows. Wrapped `PaymentBadge` and `ComponentDetailQuickLink` in `<span className="hidden sm:inline-flex">` so they only render on desktop, freeing room for the name on mobile.
  - `src/pages/Admin.tsx` Component Author, Component Details, and Package Metadata disclosures: the pill button was sharing a single flex row with the title + description, which forced "PACKAGE METADATA" to wrap to two lines on narrow screens. Switched the three disclosure headers (`AuthorToggleSection`, `PackageComponentDetailsEditor`, `PackageMetadataEditor`) to `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3` so the title + description take the full mobile width and the pill drops to its own row via `self-start sm:self-auto`. Desktop layout unchanged.
  - `src/pages/Admin.tsx` `InlineActions` Actions/Status/Review/Visibility rows: every button label was wrapped in `<span className="hidden sm:inline">`, leaving mobile admins with icon-only circles and no way to tell Hide from Feature from Reward without opening a tooltip. Removed `hidden sm:inline` from 18 label spans inside `InlineActions` (Convex Verified, Community, Generate Content, Update README, Hide SEO, Auto-fill, Hide Thumb, Refresh, Slug, Reward, History, Status `{btn.label}`, Security Scan, Review history, Unarchive, Visibility `{btn.label}`, Feature, Sub Hide, Delete) plus the labels in `AiReviewButton` ("AI Review"), `NotesButton` ("Notes"), and `CommentsButton` ("Messages") which all render inside the Visibility row. Buttons now show icon + text on every viewport and wrap naturally via the existing `flex-wrap` containers. Compact badges in the collapsed summary row (StatusBadge, VisibilityBadge, PaymentBadge) still stay icon-only on mobile — they're summary signals, not tappable actions.

- User Messages + Admin Notes comment cards overflow on mobile (2026-04-17 10:30 UTC)
  - `src/pages/Admin.tsx` `AdminPackageCommentsPanel`: each comment row had a single-line meta cluster (user icon + name + date + New badge) and a fixed right-side action cluster (Hide, Archive, Delete). On narrow screens the date "Apr 16, 11:36 PM" had to share horizontal space with three pills and ended up wrapping to four lines one character/word at a time, while Delete ran off the right edge of the modal. The header row is now `flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2` so the actions drop onto their own row below the meta on mobile. The meta group uses `flex flex-wrap gap-x-2 gap-y-1` with `whitespace-nowrap` on the name, date, and New badge so those atoms stay intact but wrap as whole units. Action pills gain `whitespace-nowrap shrink-0` so Hide/Archive/Delete can wrap too but never truncate. Added `break-words` on the comment `<p>` so long unbroken strings no longer widen the card. Same polish applied to `AdminPackageNotesPanel` notes + replies rows.

- Duplicate mobile search input in admin and wrong background color (2026-04-17 10:22 UTC)
  - `src/pages/Admin.tsx`: the sticky "Admin Dashboard" header search (line ~2811) and the mobile-only search inside `AdminDashboard` (line ~8904) both rendered on phones, so users saw two "Search packages..." fields stacked on top of each other and the header one had its placeholder truncated to "Search packa" because it had to share a row with the "Admin Dashboard" label. Added `hidden sm:block` to the header search wrapper so only the label shows on mobile; desktop still gets the inline header search. The mobile `AdminDashboard` search box now uses `bg-white` (was `bg-bg-card` cream) and `rounded-full` (was `rounded-lg`) to match the site's pill design system.

- Stats + links row wraps the date on mobile in the expanded admin package card (2026-04-17 10:15 UTC)
  - `src/pages/Admin.tsx`: the "Stats and links" container (weekly downloads + date + npm/repo/demo pills) was a single `flex items-center gap-4 shrink-0 w-full sm:w-auto` row. On narrow viewports the date span "Mar 26, 2026" had to share space with three pill buttons and ended up wrapping to three lines. Switched the parent to `flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4` so the stats pair sits on one row above the link pills on mobile, and added `whitespace-nowrap` to the downloads + date spans so their labels stay on one line. Desktop (`sm:flex-row`) layout is unchanged. The link group also drops the mobile-only `ml-auto` (it was just pushing the pills to the right of a cramped row) and keeps `flex-wrap` as a safety net for very narrow screens.

- Mobile layout for bell notifications, admin disclosure buttons, and message panel headers (2026-04-17 10:05 UTC)
  - `src/components/Header.tsx` `renderBellDropdown`: on mobile the dropdown was anchored `absolute right-0` inside the bell container and was getting clipped on the left edge of the viewport (header icon sits at the far right of the pill). Switched to `fixed sm:absolute left-1/2 -translate-x-1/2 sm:translate-x-0 sm:right-0 top-[70px] sm:top-full mt-0 sm:mt-2 w-[calc(100vw-1rem)] sm:w-80 max-w-sm` so the panel is centered below the sticky header on mobile while keeping the right-aligned absolute behavior on desktop. No logic changes, purely positioning.
  - `src/pages/Admin.tsx` Component Details, Component Author, Package Metadata disclosures: right-side pill labels ("Edit details", "Show author", "Edit metadata") were too wide for mobile and the "Hide editor" / "Hide author" open states pushed the section title. Buttons now use `px-2 py-1 text-[11px] sm:px-3 sm:py-1.5 sm:text-xs whitespace-nowrap shrink-0`, open-state label collapses to just "Hide", and the parent row gap drops from `gap-3` to `gap-2 sm:gap-3`.
  - `src/pages/Admin.tsx` `AdminPackageCommentsPanel` + `AdminPackageNotesPanel` modal headers: the single-row header was squeezing "Show hidden or archived" + "Mark all read" + `X` into the right half on mobile, which forced "Mark all\nread" onto two lines and looked unfinished next to the rest of the site. The header is now `flex-col sm:flex-row`, so the title + package name + description occupy their own row on mobile and the actions (toggle, Mark all read, close) sit in a second row with `flex-wrap` and `whitespace-nowrap` on every pill. The close `X` shows once: next to the title on mobile, and in the action row on desktop. The toggle label shortens to "Show archived" / "Hide archived" on mobile via `sm:inline` / `sm:hidden` swaps.

### Fixed

- convex-doctor errors and warnings: score 94 → 100 (2026-04-17 09:45 UTC)
  - `convex/apiKeys.ts` `countKeysAndGrants`: replaced two unbounded `.collect()` calls with bounded `.take(10000)` and dropped the JS-side `grants.filter((g) => !g.revoked)` by querying `apiAccessGrants` via the existing `by_revoked` index. The `apiKeys` active count now uses `by_status("active").take(10000)`. Fixes `perf/unbounded-collect` (2 errors) and `perf/collect-then-filter` (1 warning) that were reported against the `getApiAnalytics` admin query.
  - `convex/securityScan.ts` `runSecurityScan`: swapped `throw new Error("Authentication required")` for `throw new ConvexError(...)` so the auth error survives Convex production redaction instead of being flattened to "Server Error". Added `ConvexError` to the existing `convex/values` import.
  - Files: `convex/apiKeys.ts`, `convex/securityScan.ts`
  - Verification: `npx convex-doctor` → 100/100, `No issues found across 23 files`. `npm run build` passes in ~4.2s. `ReadLints` clean on both files.

### Changed

- Thin out five long Convex handlers so they stay within the arch/large-handler budget (2026-04-17 09:45 UTC)
  - `convex/dashboard.ts` `getDashboardStats`: extracted the per-package aggregation loop (counts, author map, month map) into a new `computeDashboardStats(active)` helper and hoisted the non-admin response into an `emptyDashboardStats` constant. The handler is now just admin check + `take(2000)` + active filter + aggregate call.
  - `convex/packages.ts` `submitPackage`: extracted the post-insert follow-ups (Slack notify + `autoAiReview` scheduling + `autoSecurityScan` scheduling) into `scheduleSubmissionFollowups(ctx, { packageId, packageName, args, validated, prereqs })`. The handler now stops after insert + follow-up call.
  - `convex/packages.ts` `getLatestSecurityScan`: moved the response shape for the loaded package + latest `securityScanRuns` run into a new `formatLatestSecurityScan(pkg, latestRun)` helper. Same fields, same `providerStatuses` map, same public-safe payload.
  - `convex/packages.ts` `getMyUnreadAdminRepliesByPackage`: extracted the per-package comment scan and unread summary into `computeUnreadAdminReplySummary(ctx, pkg)`. Handler loops once and collects non-null summaries, then sorts.
  - `convex/securityScan.ts` `_runSecurityScan`: split the 144-line handler into focused helpers — `buildProviderTasks(pkg, settings)`, `runProviderTasks(tasks)`, `buildProviderResultsForStorage(providerResults)`, `saveScanError(ctx, ...)`, and `executeScanAndSaveResult(ctx, ...)`. The three error paths (no repo, no providers enabled, catch-all) now share the same `saveScanError` writer, so the stored error payload shape is guaranteed identical.
  - Behavior is preserved across all five handlers (same DB reads, writes, scheduled calls, and return shapes). Only code organization changed.
  - Files: `convex/dashboard.ts`, `convex/packages.ts`, `convex/securityScan.ts`
  - Verification: `npx convex-doctor` → 100/100, `No issues found`. `ReadLints` clean on all three files. `npm run build` passes.

### Changed

- Mark read button layout polish in Admin + Profile message panels (2026-04-17 09:10 UTC)
  - `AdminPackageCommentsPanel` in `src/pages/Admin.tsx`: moved the per-comment "Mark read" pill out of the top-right action cluster and onto its own row underneath the message content. This prevents the Hide/Archive/Delete row from wrapping awkwardly when a comment is unread. Icon was removed from the pill to keep it compact; the word "Mark read" is the whole affordance.
  - `ViewNotesModal` in `src/pages/Profile.tsx`: merged the "Mark read" pill into the same action row as Hide/Archive/Delete instead of sitting above them on its own line. Mark read now appears after Delete when both apply. The `Check` icon was removed from the Mark read pill.
  - Removed the unused `Check` import from `src/pages/Admin.tsx` now that the icon is gone.
  - Files: `src/pages/Admin.tsx`, `src/pages/Profile.tsx`

### Fixed

- Admin "Mark read" pill and bell-dropdown scroll both worked only for other users (2026-04-17 08:55 UTC)
  - `AdminPackageCommentsPanel` in `src/pages/Admin.tsx` gated the per-message "Mark read" pill on `comment.authorEmail !== userEmail`. When an admin tests the flow from their own `/profile` (submitter email === admin email), every comment was treated as "own message", so Hide/Archive/Delete rendered but the new Mark read pill never did. The bell dropdown still listed those same messages as unread because `getAdminUnreadMessagesByPackage` correctly ignores the author email. Gate is now just `comment.adminHasRead !== true`. Admin replies typed from the admin panel already have `adminHasRead: true`, so they continue to render the lifecycle buttons only, never the Mark read pill.
  - Bell-dropdown jump to a package on page 2+ or under a different filter landed on the wrong page because the scroll effect depended only on `hashTargetPackageId`. It fired once with `el = null`, the pagination-jump effect switched the page, but the element that now mounted never got scrolled. Split the scroll into its own effect that also depends on `activeFilter` and `currentPage`, and extended the highlight window from 2s to 4s so the filter/page switch has time to render before the highlight clears.
  - Files: `src/pages/Admin.tsx`

### Changed

- Removed auto-mark-all-read-on-open from admin and profile message panels (2026-04-17 08:35 UTC)
  - `AdminPackageCommentsPanel` (user-messages view) and `AdminPackageNotesPanel` (admin-notes view) in `src/pages/Admin.tsx` no longer fire `markCommentsAsReadForAdmin` / `markNotesAsReadForAdmin` automatically when the panel opens. The effect was clearing `adminHasRead !== true` on every comment before the render could show the new per-message "Mark read" pill, so admins never saw the button.
  - `ViewNotesModal` in `src/pages/Profile.tsx` no longer fires `markPackageNotesAsRead` automatically on open. Same reason: it was clearing `userHasRead === false` before the per-message "Mark read" pill could render on admin replies.
  - Marking messages read is now fully opt-in: the bulk "Mark all read" pill in each panel header still calls the existing bulk mutations, and the per-message "Mark read" pills call `markPackageCommentReadForAdmin` / `markPackageCommentReadForUser`. The bell notification badge will stay visible until the user or admin explicitly marks items read.
  - Files: `src/pages/Admin.tsx`, `src/pages/Profile.tsx`

### Added

- Per-message Mark read buttons + universal ESC close + pagination-aware hash navigation (2026-04-17 08:15 UTC)
  - Admin message panel (`AdminPackageCommentsPanel` in `src/pages/Admin.tsx`): each submitter-authored comment with `adminHasRead !== true` now shows a small "Mark read" pill next to the author meta and a green "New" badge. Admin's own replies, which are already marked read at write time, never show the button. Bulk "Mark all read" pill in the header is unchanged.
  - User message panel (`ViewNotesModal` in `src/pages/Profile.tsx`): each admin-authored note with `userHasRead === false` now shows a "Mark read" pill below the content. The existing "New" badge, bulk "Mark all read" pill, and Hide/Archive/Delete controls on own messages are unchanged.
  - Backend: two new idempotent mutations in `convex/packages.ts`. `markPackageCommentReadForAdmin({ commentId })` requires admin identity and patches `adminHasRead: true`. `markPackageCommentReadForUser({ commentId })` requires the caller to own the target package (via `userOwnsPackage`) and patches `userHasRead: true`. Both short-circuit when the flag is already set or the comment has been deleted.
  - ESC closes every modal on `src/pages/Admin.tsx` and `src/pages/Profile.tsx`. Added keyboard handlers to `ConfirmModal`, the reward confirmation modal, reward history modal, and test reward confirmation in Admin (the two reward modals with in-flight sends are guarded so ESC does not dismiss during a network call). Added handlers to `RequestModal`, `ViewNotesModal`, `EditModal`, and `ApiUsageModal` in Profile (edit + request are guarded while submitting).
  - Pagination-aware hash navigation in `AdminDashboard`: when the bell dropdown links to `#pkg-<id>` and the target is excluded by the active filter or lives on a different client-side page, the hash effect now switches `activeFilter` ("all", "archived", or "marked_for_deletion" depending on the package) and updates `currentPage[activeFilter]` to the computed page so the scroll + highlight effect can locate the element. The calculation mirrors the same filter + sort logic used for rendering.
  - Files: `convex/packages.ts`, `src/pages/Admin.tsx`, `src/pages/Profile.tsx`, `prds/admin-profile-messages-ux.md`

- Header notifications bell with admin + user messages dropdown (2026-04-17 06:17 UTC)
  - New Phosphor `Bell` icon in `src/components/Header.tsx`, placed immediately to the right of the Submit link on desktop and in the mobile header row. Visible only to authenticated users. Default state is an outline bell matching the other header icons (`text-text-secondary`, size 16); when unread messages exist it switches to a filled `#E05C35` icon with a count pill badge.
  - Dropdown shows two sections: "Messages from Convex Team" listing each of the current user's submissions with unread admin replies, and (for `@convex.dev` admins only) "Incoming messages" listing every component with unread submitter messages. Each row shows the component name, unread count, and relative last-message timestamp.
  - Clicking a user-section row navigates to `/components/profile#pkg-<packageId>` and scrolls/ring-highlights the matching submission card. Clicking an admin-section row navigates to `/components/submissions/admin#pkg-<packageId>`, auto-expands that package's row, and scrolls/highlights it for two seconds.
  - New Convex queries in `convex/packages.ts`: `getMyUnreadAdminRepliesByPackage` (user feed, reuses the `by_submitter_email` + `by_package_and_created` index pattern from `getTotalUnreadAdminReplies`) and `getAdminUnreadMessagesByPackage` (admin-only feed, capped at 50 packages). Both return minimal metadata only (`packageId`, `packageName`, `slug`, `unreadCount`, `lastMessageAt`).
  - Upgraded Mark all read from a small text link to a visible pill button in three message panels: the user-facing `ViewNotesModal` in `src/pages/Profile.tsx`, the `AdminPackageCommentsPanel` in `src/pages/Admin.tsx`, and the `AdminPackageNotesPanel` in `src/pages/Admin.tsx`. The admin notes panel now also wires `getUnreadUserNotesCount` and `markNotesAsReadForAdmin` so it tracks user-to-admin unread notes and auto-marks them read on open (same pattern already used by the comments panel).
  - Files: `convex/packages.ts`, `src/components/Header.tsx`, `src/pages/Profile.tsx`, `src/pages/Admin.tsx`, `prds/admin-message-notifications-bell.md`

### Changed

- `getAdminUnreadMessagesByPackage` in `convex/packages.ts` now scans `packageComments` directly (ordered by creation desc, window of 2000) instead of iterating every row in `packages` and issuing a per-package comments query (2026-04-17 07:05 UTC)
  - Same public shape and behavior (still capped at 50 packages, still returns `packageId`, `packageName`, `slug`, `unreadCount`, `lastMessageAt` sorted by latest message), but the read cost drops from O(packages) package reads plus O(packages) comment queries to one bounded comments scan plus at most 50 package lookups
  - Files: `convex/packages.ts`

### Fixed

- Admin header bell dropdown now surfaces messages sent from `src/pages/Profile.tsx` when the submitter also has a `@convex.dev` email (2026-04-17 07:25 UTC)
  - `getAdminUnreadMessagesByPackage` in `convex/packages.ts` previously filtered out every comment whose `authorEmail` ended in `@convex.dev`, so admins testing the Send Request flow on their own submissions never saw the bell notification even though the message existed in `packageComments` with `adminHasRead: false`
  - The admin-vs-user distinction is already encoded at write time: `addPackageComment` sets `adminHasRead: isAdmin` and `requestSubmissionRefresh` always sets `adminHasRead: false`, so `adminHasRead !== true` alone reliably identifies unread submitter messages
  - Removed the email suffix check; the filter now relies on `status === "active"` (or undefined) and `adminHasRead !== true`, which matches the semantic used elsewhere in the file (e.g. `markCommentsAsReadForAdmin` around line 2288)
  - Files: `convex/packages.ts`

### Fixed

- Removed leftover agent debug telemetry posting to `http://127.0.0.1:7557/ingest/...` from the thumbnail generator and component editor (2026-04-16 22:50 UTC)
  - `convex/thumbnailGenerator.ts` had four fire-and-forget `fetch` calls inside `_generateThumbnailForPackage` (resolve prereqs, compose/upload, save metadata, on-error) that targeted a local agent ingest server from a prior debugging session (`sessionId:"10e84f"`, runId `"pre-fix"`)
  - `src/components/ComponentDetailsEditor.tsx` had four matching client-side calls in the thumbnail sync `useEffect` and `handleGenerateThumbnail` (request, success, error)
  - Browser copies were surfacing `net::ERR_CONNECTION_REFUSED` in the DevTools console on every editor mount and every Generate Thumbnail click; Convex copies were silently failing every admin thumbnail run since Node runtime cannot reach the developer's loopback
  - Safe to remove: every call was wrapped in `.catch(()=>{})`, nothing awaited the response, no logic branched on success, and the added code was bracketed by `// #region agent log` / `// #endregion` markers
  - Verified with `rg "127.0.0.1:7557"` returning zero matches; remaining lint errors in both files are pre-existing (Buffer/Blob type mismatch, ReactMarkdown `Components` JSX namespace) and unrelated to this cleanup
  - Files: `convex/thumbnailGenerator.ts`, `src/components/ComponentDetailsEditor.tsx`

- Mobile search bar now matches the desktop white background on the Directory and category landing pages (2026-04-17 05:21 UTC)
  - `src/pages/Directory.tsx` mobile `SearchBar` now receives `inputClassName="bg-white border border-border"` so it renders white like the desktop sidebar search instead of inheriting the cream `bg-bg-primary` default
  - `src/pages/CategoryPage.tsx` mobile `SearchBar` got the same treatment for consistent behavior inside category views (e.g. `/components/categories/authentication`)
  - Horizontal scrolling category pills on mobile were reviewed and left as-is (standard pattern, preserves vertical space and discoverability with the peek affordance)
  - Files: `src/pages/Directory.tsx`, `src/pages/CategoryPage.tsx`

### Added

- Preflight check usage warning modal on SubmitCheck page (2026-04-16 22:30 UTC)
  - New `PreflightWarningModal` in `src/pages/SubmitCheck.tsx` surfaces the 10 checks per hour per IP rate limit and the 30-minute per-repo cache before a check runs
  - Design matches the `GenerateWarningModal` pattern used in `src/pages/SubmitForm.tsx` (amber `Warning` icon, same card, Continue/Cancel buttons, ESC to close, backdrop click to close unless a request is in flight)
  - Split the existing `handleSubmit` into `handleOpenWarning` (validates the repo URL and opens the modal) and `runPreflightCheck` (performs the authenticated fetch after the user confirms)
  - No backend changes: the rate limit (`MAX_CHECKS_PER_HOUR = 10`) and cache window (`CACHE_DURATION_MS = 30 * 60 * 1000`) in `convex/preflight.ts` are unchanged

### Fixed

- Directory sidebar category counts now refresh when an admin reassigns a component's category (2026-04-16 21:45 UTC)
  - `convex/packages.ts` `updateComponentDetails` now calls `recountCategoryStats(ctx)` whenever `category` or `convexVerified` changes in the patch
  - Without this, the denormalized `packageCount` / `verifiedCount` on the `categories` table stayed stale, so the Directory sidebar showed 0 even though the category landing page computed live and showed the real count
  - Only the sidebar query `listCategories` relied on the denormalized counters, which is why it disagreed with `getCategoryBySlug`

- Category slug rename and delete also refresh denormalized sidebar counts (2026-04-16 21:55 UTC)
  - `updateExistingCategory` in `convex/packages.ts` now calls `recountCategoryStats(ctx)` after it reassigns packages to the new slug during a rename
  - `deleteCategory` now calls `recountCategoryStats(ctx)` after it sets `category` to `undefined` on related packages
  - Prevents the same stale sidebar count class of bug after admin category rename or deletion
  - Also tightened `updateExistingCategory` ctx type from `any` to `MutationCtx`

- Package submission no longer crashes when npm metadata includes all time downloads (2026-04-15 17:52 UTC)
  - Added the missing `allTimeDownloads` validator and persistence to the submit and npm update paths in `convex/packages.ts`
  - This fixes the `ArgumentValidationError` thrown by `packages:submitPackage` when `_addPackage` received the extra field from npm metadata
  - Rechecked `convex/dashboard.ts` and the current stats query still returns `totalAllTimeDownloads`, matching the dashboard card contract

- Directory download counts now refetch when the page becomes active again (2026-04-15 02:11 UTC)
  - `src/pages/Directory.tsx` keeps the one-shot Convex fetch strategy but now re-queries on window focus, page show, and tab visibility restore
  - This lets refreshed npm counts show up after admin-triggered updates without bringing back a full reactive subscription

- Added spacing above Keywords section on component detail page (2026-04-14)
  - Keywords block now has `mt-8` so it separates from code blocks or other content above it
  - File: `src/pages/ComponentDetail.tsx`

- Crons component page crash on production (2026-04-14)
  - Added `PageErrorBoundary` in `src/main.tsx` wrapping `ComponentDetail` to catch query and rendering errors
  - Added `MarkdownErrorBoundary` in `src/pages/ComponentDetail.tsx` wrapping all `ReactMarkdown` sections
  - Plain text code blocks (no language tag) now render as `<pre>` instead of PierreFile syntax highlighter to prevent potential hangs on Unicode box-drawing characters
  - Files: `src/main.tsx`, `src/pages/ComponentDetail.tsx`, `src/components/CodeBlock.tsx`

### Removed

- Pre-Oct 2025 stat card from admin dashboard (2026-04-14)
  - Cleaned up `convex/dashboard.ts` return value and `src/pages/Dashboard.tsx` UI

### Added

- Dashboard package refresh controls for safer npm updates (2026-04-15 02:11 UTC)
  - Added a per-package refresh icon beside `Wk Downloads` in `src/pages/Dashboard.tsx`
  - Added a bulk `Refresh all` control beside CSV export that reuses the existing approved-package batched refresh action
  - Keeps the existing npm-safe scheduler behavior instead of introducing a more aggressive refresh pattern

- All-time download tracking for packages (2026-04-14)
  - New `allTimeDownloads` optional field on packages schema
  - `fetchNpmPackageHandler` now fetches cumulative downloads from npm date-range API alongside weekly
  - Dashboard shows both "Weekly Downloads" and "All Time Downloads" stat cards
  - All-time counts populate on next npm data refresh (manual or scheduled)
  - Files: `convex/schema.ts`, `convex/packages.ts`, `convex/dashboard.ts`, `src/pages/Dashboard.tsx`

- CSV and PDF export for admin dashboard filtered view (2026-04-14)
  - CSV button exports current filtered Components table as a downloadable `.csv` file
  - PDF button opens a print-friendly report in a new window with active filter summary
  - Both exports respect all active filters (search, type, status, date range, author exclusions)
  - Files: `src/pages/Dashboard.tsx`

### Fixed

- Fix security report modal stacking on component detail and submissions pages (2026-04-13)
  - Modal rendered inside sticky sidebar created a local stacking context, letting main content code blocks overlap it
  - Wrapped `SecurityReportModal` and `SubmitSecurityReportModal` in `createPortal(..., document.body)` so they mount at document root
  - Ref: [PR #22](https://github.com/convex/components-submissions-directory/pull/22)
  - Files: `src/pages/ComponentDetail.tsx`, `src/pages/Submit.tsx`

### Changed

- Renamed "Security Analyze" to "Community scan via Socket" on component detail and submissions pages (2026-04-13)
  - Removed shield icon from sidebar button and modal header in `ComponentDetail.tsx` and `Submit.tsx`
  - Removed scan date from public security modals (admin still sees dates)
  - Reframed label to attribute scan to Socket, not Convex
  - Files: `src/pages/ComponentDetail.tsx`, `src/pages/Submit.tsx`

### Added

- Takedown, removal, and review flow FAQ items added to public FAQ section and documentation (2026-04-13)
  - New FAQ entries: report flagged components (contact Convex), who decides removal, review flow
  - Added to `src/components/FAQSection.tsx` (Directory and SubmitForm pages)
  - Added to `src/docs/submit.md` (admin Documentation page)
  - Updated `src/docs/component-detail.md`, `src/docs/admin-security-scan.md`, `src/docs/index.md` to reflect renamed scan label
  - Files: `src/components/FAQSection.tsx`, `src/docs/submit.md`, `src/docs/component-detail.md`, `src/docs/admin-security-scan.md`, `src/docs/index.md`

- Community approved/rejected stats and review status filter on dashboard (2026-04-13 22:15 UTC)
  - New stat cards: "Community Approved" and "Community Rejected" with counts and sublabels
  - New "Status" dropdown filter (All / Approved / Not approved / Pending / In review / Changes requested / Rejected) integrates with existing filters
  - Updated `component-report.html` with approval/rejection counts, per-row status badges, and status filter/sort controls
  - Files: `src/pages/Dashboard.tsx`, `component-report.html`

- Admin analytics dashboard at `/components/dashboard` for team reporting (2026-04-13 21:00 UTC)
  - Stat cards: total components, community count, get-convex count, get-convex since Oct 2025, total weekly downloads, pre-Oct 2025 count
  - Sortable components table with columns for name, author, type, submitted date, weekly downloads, last published, review status
  - Author summary table with component count, total downloads, and team/community badge per author
  - Monthly submission timeline with stacked bars showing get-convex vs community splits
  - Filters: search by name/author, type (all/community/get-convex), date range with custom date picker, multi-select author exclusion checklist
  - Refresh button wired to `triggerManualRefreshAll` to pull live npm download data
  - Admin-only auth gate (@convex.dev emails), `bg-bg-primary` background matching app design system
  - Dashboard link added to Header nav (desktop + mobile) next to Docs for admin users
  - Info banner explaining live data and post-deploy refresh workflow
  - New backend query `convex/dashboard.ts` with server-side aggregation
  - Files: `convex/dashboard.ts` (new), `src/pages/Dashboard.tsx` (new), `src/main.tsx`, `src/components/Header.tsx`

### Changed

- Remove status labels from public Security Analyze modals (2026-04-04 00:30 UTC)
  - Removed "Status: Safe as of..." / "Status: Alerts" / "Status: Not scanned" line from ComponentDetail.tsx and Submit.tsx modals
  - Public modals now show only "Not yet scanned" or "Scanned [date]" with no safe/warning/unsafe indicator
  - Admin Security Analyze reports and status kept unchanged
  - Files changed: `src/pages/ComponentDetail.tsx`, `src/pages/Submit.tsx`

### Fixed

- Fix infinite re-render loop on Admin API tab causing spinner and 1,300+ console logs (2026-04-03 14:10 UTC)
  - `Date.now()` called in render body caused `useQuery` args to change every frame, triggering React "Too many re-renders" error
  - Stabilized timestamp with `useMemo` rounded to nearest minute so query args stay stable
  - Replaced `.take(1000)` + JS `.filter()` in `countKeysAndGrants` with `by_status` index query
  - Files changed: `src/pages/Admin.tsx`, `convex/apiKeys.ts`

- Fix production crash on `listAllDirectoryCategories` return validator (2026-04-02 08:00 UTC)
  - Return validator was missing `packageCount` and `verifiedCount` optional fields that exist on the `categories` schema
  - When any category had denormalized counts populated, the strict validator rejected the response and threw a server error
  - Added `packageCount: v.optional(v.number())` and `verifiedCount: v.optional(v.number())` to the return validator
  - File changed: `convex/packages.ts`

### Added

- Security scanning documentation page and docs updates (2026-04-02 07:30 UTC)
  - New `src/docs/admin-security-scan.md` covering providers, manual/batch/auto/scheduled scanning, settings, results, public visibility, env vars, data model, and troubleshooting
  - Registered new doc in `src/pages/Documentation.tsx` under Admin Guide section
  - Updated `src/docs/index.md` with Security scanning link
  - Updated `src/docs/admin-settings.md` with Security Scan Settings panel and env variables
  - Updated `src/docs/admin-dashboard.md` with Review row in expanded package view
  - Updated `src/docs/admin-review.md` with Review row section for AI Review, Security Scan, and Review history
  - Updated `src/docs/component-detail.md` with Security Analyze sidebar entry and modal section
  - Updated `src/docs/submit.md` with Security scan report section

- Security Analyze button and modal on Submit page for each component (2026-04-02 05:15 UTC)
  - New "Security" button in the expanded action buttons row next to Demo, matching existing secondary button style
  - Opens a security report modal with scan status, providers, recommendations, and contact author section
  - Uses `getLatestSecurityScan` query per expanded row for on-demand loading

- Security scan backlog queue and tracker in Admin Security Scan Settings (2026-04-02 05:15 UTC)
  - New `getSecurityScanBacklogStats` query returns counts: unscanned, scanning, scanned, errors, total with repo
  - New `runSecurityScanBacklog` mutation queues unscanned/errored packages per batch
  - Backlog section shows badge counts, configurable batch size dropdown (5/10/20/50/100), and a "Scan next N" button
  - Shows green checkmark when all packages with repos have been scanned

### Removed

- Devin AI integration removed from security scan system (2026-04-02 04:15 UTC)
  - Removed Devin AI toggle from Admin.tsx Security Scan Settings panel
  - Removed Devin provider display from ComponentDetail.tsx security report modal
  - Removed Devin from securityScan.ts orchestrator task list so it never runs
  - Hardcoded `enableDevinScan: false` in admin settings helper
  - Removed Devin from scheduled scan provider check
  - Schema fields kept optional for backward compatibility with existing scan history
  - Socket.dev and Snyk continue to work as before

### Changed

- Moved "How to get help" above Security Analyze in ComponentDetail.tsx sidebar (2026-04-02 06:00 UTC)
  - Removed scan date subtitle from the Security Analyze sidebar box
  - Simplified the security box to a single-line clickable label without status text

- Refined the public Component Detail security scan UI to use neutral scan language and provider links (2026-04-02 00:24 UTC)
  - Updated `src/pages/ComponentDetail.tsx` so the sidebar now shows `Security Analyze` with only scan presence and date
  - Renamed the modal title to `Security Analyze`, moved the scan date above the providers list, and linked providers to their external scan sites
  - Removed `safe` or `unsafe` wording from the sidebar and provider rows while keeping a modal-only status line with `Confirmed`, `Not scanned`, and `Alerts`
  - Made the unscanned state open the same modal and hid the page Markdown dropdown while the modal is open

### Added

- Security scan system with Socket.dev and Snyk integration (2026-03-31 22:30 UTC)
  - New `convex/securityScan.ts` with provider adapters, parallel execution via `Promise.allSettled`, and normalized finding model
  - New `securityScanRuns` table for historical scan audit trail
  - Security scan fields on `packages` table (denormalized latest snapshot: `securityScanStatus`, `securityScanSummary`, etc.)
  - Admin settings: per-provider toggles (`enableSocketScan`, `enableSnykScan`), auto-scan on submission, configurable schedule (manual/3/5/7 days)
  - New "Review" row in Admin.tsx between Status and Visibility with AI Review, Security Scan, and combined Review history buttons
  - Security Scan Settings panel in admin settings with provider toggles and schedule dropdown
  - Review history panel now has tabs for AI Reviews and Security Scans
  - Public security report box in ComponentDetail.tsx sidebar (between ratings and "How to get help") with shield icons
  - Security report modal matching existing design: provider results, recommendations, contact author section, third party notice
  - Scheduled security scan cron (daily at 5 AM UTC, gated by `securityScanScheduleDays` setting)
  - Auto security scan on submission when `autoSecurityScan` is enabled
  - Convex env vars needed: `SOCKET_API_KEY`, `SNYK_TOKEN`, `SNYK_ORG_ID`

### Fixed

- Socket.dev security scans now use the documented PURL endpoint and parse Socket's NDJSON response correctly (2026-04-01 22:05 UTC)
  - Root cause: `convex/securityScan.ts` was calling `/v0/report/supported`, which returns `404 API route not found`
  - Switched to `/v0/purl?alerts=true&compact=true` with bearer auth
  - Updated parsing to handle `application/x-ndjson` responses and empty success bodies without turning them into `socket: error`
  - Verified by rerunning the `@convex-dev/stripe` security scan and confirming Convex now stores `socket: safe`

- Search results now scroll to top when typing in the search box while scrolled down on Directory and Category pages (2026-03-28 20:00 UTC)
  - Added smooth scroll-to-top in the existing `useEffect` that resets paging state on search term change
  - Files changed: `src/pages/Directory.tsx`, `src/pages/CategoryPage.tsx`
- Page now starts at top when navigating between categories or clicking back to the directory (2026-03-28 20:00 UTC)
  - Set `history.scrollRestoration = "manual"` in `src/main.tsx` to disable browser auto-restoring previous scroll positions
  - Added `window.scrollTo(0, 0)` on app init so every full-page navigation starts at the top
  - File changed: `src/main.tsx`

### Added

- Slack notifications for directory activity (2026-04-02 12:00 UTC)
  - `slack.sendMessage` posts to `SLACK_WEBHOOK_URL`; scheduled from: new submissions (`submitPackage`), new private messages (`addPackageComment`), completed security scans (`_saveSecurityScanResultAndRun` in `convex/packages.ts` after Socket/Snyk runs)
  - Files: `convex/slack.ts`, `convex/packages.ts`

- Admin "Update README" action button to refresh README content from GitHub without regenerating AI content (2026-03-27 00:15 UTC)
  - New `refreshReadme` internal action and `refreshReadmeContent` public action in `convex/seoContent.ts`
  - New `_updateReadmeOnly` internal mutation in `convex/seoContentDb.ts` patches only the README fields
  - Button placed next to Generate Content in the admin Actions row
  - Useful for pulling in updated READMEs after upstream changes without waiting for full AI regeneration

### Changed

- Removed 20k character cap on stored README content so full READMEs display without truncation (2026-03-27 01:00 UTC)
  - Removed `.slice(0, 20000)` from both `generateDirectoryContent` and `refreshReadme` save paths in `convex/seoContent.ts`
  - Convex string fields support up to 1MB, so no practical limit is needed
- README section on component detail page now renders independently of v2 AI content generation (2026-03-27 00:45 UTC)
  - Moved `readmeIncludedMarkdown` rendering outside the `contentModelVersion === 2 && generatedDescription` gate in `src/pages/ComponentDetail.tsx`
  - Components with only a README (no AI content yet) now show the README on their detail page

### Fixed

- Full README content now stored and displayed on component detail pages instead of truncating at 12k characters (2026-03-26 22:00 UTC)
  - Split `sanitizeReadmeForPrompt` into `sanitizeReadme` (clean only) and `sanitizeReadmeForPrompt` (clean plus truncate) in `convex/seoContent.ts`
  - `fetchGitHubReadme` now returns `fullContent` (untruncated) alongside `rawContent` (truncated for AI prompts)
  - `fetchContentContext` and `fetchPreviewContext` use `fullContent` for `readmeIncludedMarkdown` extraction
  - AI prompts still receive the 12k truncated version to stay within token limits
  - Packages with large READMEs (e.g. `@convex-dev/workflow`) no longer show `[README truncated for prompt length]` on the detail page after regeneration

### Changed

- Scale optimization: reduced bandwidth and subscription costs following OpenClaw patterns (2026-03-21 00:30 UTC)
  - Added compound indexes for `reviewStatus` + `visibility` + `markedForDeletion` filter patterns on packages table
  - Added `by_featured_and_reviewStatus`, `by_enabled_and_sortOrder`, `by_status` (apiKeys), `by_revoked` (apiAccessGrants) indexes
  - Swapped Directory and CategoryPage from reactive `useQuery` subscriptions to one-shot `convex.query()` fetches
  - Added change detection in `updateNpmDataHelper` to skip no-op patches that would invalidate subscriptions
  - Denormalized category counts (`packageCount`, `verifiedCount`) into `categories` table; `listCategories` no longer scans all packages
  - REST API `/api/components/search` now uses Convex search indexes instead of loading 5000+ full documents and filtering in JS
  - Added `_searchApprovedPackages` internal query and `backfillCategoryCounts` internal migration

### Fixed

- Duplicate package submission now shows a clear, actionable error message instead of generic "Server Error Called by client" (2026-03-21)
  - Backend error includes the npm package name and tells the submitter to check their profile or contact support
  - Frontend now properly extracts ConvexError.data for human-readable messages in both submit and generate content flows

### Changed

- Improved convex-doctor health score from 39/100 to 100/100 with zero issues (2026-03-21 06:10 UTC)
  - Achieved perfect score across 20 files with no warnings, errors, or info findings
  - Extracted 40+ helper functions from large handlers across `packages.ts`, `seoContent.ts`, `seoContentDb.ts`, `thumbnailGenerator.ts`, `seed.ts`, `paymentsDb.ts`, and `apiKeys.ts`
  - Refactored `triggerManualRefreshAll` and `triggerManualRefreshAllPackages` into shared `createLogAndScheduleRefresh` helper
  - Refactored `listApprovedComponents` sorting into `sortPackages` and mapping into `toDirectoryCard`
  - Refactored `getRelatedComponents` scoring into `scoreAndRankRelated`
  - Refactored `getMySubmissions` merging into `mergeAndDedupePackages` and `toSubmissionCard`
  - Refactored `scheduledDeletionCleanup` into `deletePackageAndRelatedData` (table-driven cascade delete)
  - Refactored `updateMySubmission` field building into `buildSubmissionUpdates`
  - Refactored `updateComponentDetails` into `buildComponentDetailsPatch`, `validateAndApplySlug`, `validateAndApplyCategory`
  - Refactored `upsertCategory` into `updateExistingCategory`
  - Refactored `refreshGitHubIssueCounts` into `fetchGitHubIssueCounts`
  - Refactored `backfillRewardStatusFromPayments` into `aggregatePaymentsByPackage` and `reconcileRewardStatuses`
  - Refactored `_upsertOfficialComponent` into `patchExistingOfficialComponent` and `insertNewOfficialComponent`
  - Refactored `seedOfficialComponents` into `buildDryRunResult`, `seedSingleComponent`, `seedAllComponents`
  - Refactored `generateSeoContent` into `fetchSeoContext`, `buildSeoCandidates`, `parseSeoAiResponse`
  - Refactored `generateDirectoryContent` into `fetchContentContext`, `parseContentAiResponse`
  - Refactored `previewDirectoryContent` into `fetchPreviewContext` with reused `buildSeoCandidates` and `parseContentAiResponse`
  - Refactored `migrateToContentModel` into `tryBuildSkillMd` and `buildMigrationPatch`
  - Refactored `_generateThumbnailForPackage` into `resolveTemplate`, `loadLogoPngBuffer`, `composeAndUploadThumbnail`
  - Refactored `_autoGenerateThumbnail` into `checkAutoGenPrereqs` with reused composition helpers
  - Refactored `_autoGenerateThumbnailWithTemplate` to reuse `resolveTemplate`, `loadLogoPngBuffer`, `composeAndUploadThumbnail`
  - Removed inline debug logging (`fetch` to localhost) from `thumbnailGenerator.ts` reducing handler line count
  - Added strategic suppressions in `convex-doctor.toml` for intentional patterns: array relationships, deep nesting, monolithic file, mixed function types, large document writes, duplicated auth, scheduler return values, deep function chains, sequential run calls

- Improved convex-doctor health score from 39/100 to 80/100 (2026-03-20)
  - Replaced `throw new Error` with `throw new ConvexError` across all Convex handler files for proper structured client errors
  - Replaced `api.*` references with `internal.*` for all server-to-server calls including `fetchNpmPackage`, `runAiReview`, and scheduler calls
  - Added `.take(n)` bounds to all 40 unbounded `.collect()` calls to prevent unbounded bandwidth
  - Replaced database `.filter()` with `.withIndex()` in 7+ locations for better query performance
  - Fixed `Date.now()` in query functions (`getBadgeStats`, `getRefreshStats`, `getApiAnalytics`) by accepting `now` as an argument
  - Added missing `returns:` validators to 10+ functions across multiple files, including `submitPackage`
  - Batched `runAiReview` action mutations from 13 sequential ctx.run* calls down to 8
  - Parallelized AI provider settings queries with `Promise.all`
  - Extracted `fetchNpmPackage` handler into shared helper with both public + internal action registrations
  - Extracted `runAiReview` handler into shared helper with both public (auth-checked) + internal action registrations
  - Added auth checks (`requireAdminIdentity`) to all 15 public functions in `aiSettings.ts`
  - Added auth checks to public `fetchNpmPackage` and `runAiReview` actions
  - Converted `logApiRequest` from fire-and-forget to properly awaited pattern in HTTP handlers
  - Removed 8 redundant prefix indexes from schema (e.g., `by_package` when `by_package_and_created` exists)
  - Updated 24 query references from removed `by_package` index to use compound index equivalents

### Added

- `convex.json` deployment configuration file (2026-03-20)
- `convex-doctor.toml` static analysis configuration with intentional suppressions for optional fields, index naming, storage FK indexes, `.first()` usage, httpAction determinism, and public directory auth (2026-03-20)
- `by_isDefault` index on `aiPromptVersions` and `seoPromptVersions` tables for direct lookup (2026-03-20)
- `by_tokenIdentifier_and_status` compound index on `apiKeys` table (2026-03-20)
- CORS OPTIONS handlers for 7 HTTP routes that were missing preflight support (2026-03-20)
- `_getAdminSettings`, `_getAllPackages`, `_saveAiReviewResultAndRun`, `_fetchNpmPackage`, `_runAiReview` internal functions (2026-03-20)
- Restructured `.claude/skills/` to standard Agent Skills directory format with YAML frontmatter (2026-03-19 07:15 UTC)
  - All 6 existing skills migrated from flat `name.md` to `name/SKILL.md` with proper `name` and `description` frontmatter
  - Added `real-time-backend/SKILL.md` from get-convex/real-time-backend-skill: backend architecture principles, anti-patterns, and implementation guidance
  - Added `convex-quickstart/SKILL.md` from get-convex/agent-skills: project scaffolding with templates for React, Next.js, and bare backends
  - Added `convex-setup-auth/SKILL.md` from get-convex/agent-skills: auth provider setup with Convex Auth, Clerk, WorkOS, and Auth0
  - Added `schema-builder/SKILL.md` from get-convex/convex-agent-plugins: schema design patterns, validator reference, and index strategy
  - Added `function-creator/SKILL.md` from get-convex/convex-agent-plugins: query/mutation/action creation with auth, validation, and error handling
  - Added `migration-helper/SKILL.md` from get-convex/convex-agent-plugins: safe migration patterns with batch processing and dual-write
  - Added `react-effect-decision/SKILL.md` from humanagent project: decision tree for avoiding direct `useEffect` in favor of derived state, handlers, `key`, memoization, and Convex hooks

### Changed

- Existing Claude skills restructured from flat markdown files to directory based SKILL.md format following https://code.claude.com/docs/en/skills (2026-03-19 07:15 UTC)

### Fixed

- `/components/components.md` now proxies directly from `og-meta.ts` to Convex `/api/markdown-index` so the deployed URL returns markdown instead of SPA HTML (2026-03-18 02:16 UTC)
  - Root cause: Netlify redirects do not fire after the `/components/*` edge function runs and calls `context.next()`
  - The existing `llms.txt` route already used this direct-proxy pattern, but the directory markdown index route did not
  - Verified `npm run build` still passes after the edge routing fix

### Changed

- Documentation viewer now uses Pierre Diffs (`@pierre/diffs`) for syntax-highlighted code blocks with line numbers and copy button, matching the ComponentDetail page renderer (2026-03-18 02:00 UTC)
- Documentation viewer now supports inline HTML via `rehype-raw` (2026-03-18 02:00 UTC)
- Documentation viewer now detects video URLs (`.mp4`, `.webm`, `.mov`) and renders native `<video>` elements (2026-03-18 02:00 UTC)
- Documentation viewer table rendering upgraded with header backgrounds and alternating row shading (2026-03-18 02:00 UTC)
- Updated `updating-docs.md` to document Pierre Diffs rendering pipeline and supported markdown features (2026-03-18 02:00 UTC)

### Fixed

- API Usage Modal now links to `/components/components.md` instead of the old `/components.md` path (2026-03-18 00:45 UTC)

### Changed

- Profile page account removal help text now includes direct contact email (2026-03-18 00:40 UTC)

### Added

- Admin API access controls with global toggle, per-user grants, and analytics dashboard (2026-03-18 00:30 UTC)
  - New "API" tab in Admin page with a global on/off toggle for the REST API (defaults to off)
  - Admin user search to find submitters and grant/revoke individual API access by email
  - API analytics dashboard showing 24h/7d request counts, endpoint breakdown, and recent requests table
  - `apiAccessGrants` table in schema for email-based admin grants
  - `apiAccessEnabled` admin setting key to control global API availability
  - REST API endpoints return 503 when global toggle is off
  - Profile page API Access section only visible when global toggle is on AND user has been granted access
  - "For Agents" section on Directory page below FAQ linking to `/components/llms.txt` and `/components/components.md`

### Fixed

- `/components.md` was returning 404 due to missing `force = true` on the Netlify redirect (2026-03-17 23:30 UTC)
  - The Convex `/api/markdown-index` endpoint worked fine, but the proxy rule never fired without force
  - Also added `/components/components.md` as an alias path to the same endpoint

### Added

- Per-user REST API for the Components Directory at `/api/components/*` (2026-03-17 23:00 UTC)
  - Six endpoints: search, detail, install, docs, categories, info
  - API key management on the Profile page with generate, view, and revoke flows
  - Two-tier rate limiting: 100 req/min with API key, 10 req/min anonymous
  - Keys use SHA-256 hashed storage with `cdk_` prefix for identification
  - API Usage Guide modal on Profile page with endpoint docs and curl examples
  - New `apiKeys` table in schema, extended `mcpApiLogs` with `apiKeyId` and `hashedIp` fields
  - Netlify proxy rules for `/api/components/*`

### Fixed

- Raw HTML tags in GitHub READMEs now render correctly on component detail pages (2026-03-17 22:15 UTC)
  - Added `rehype-raw` plugin to all `ReactMarkdown` instances in `ComponentDetail.tsx`
  - Tags like `<div align="center">`, `<strong>`, and inline `<img>` were previously displayed as literal text instead of rendered HTML
  - Affects Use Cases, How it Works, From the README, and v1 long description sections

### Changed

- README preview source toggle now opens by default on SubmitForm and ProfileEditSubmission pages (2026-03-17 21:00 UTC)
  - `ReadmePreviewNotice` component default state changed from collapsed to expanded
  - Helps submitters see the README source explanation without needing to click

### Removed

- Removed "View markdown source" option from the Markdown dropdown on component detail page (2026-03-17 20:15 UTC)
  - Option was broken after the unified markdown rendering refactor and no longer toggled properly
  - Cleaned up unused `showMarkdown` state, `mdCopied` state, `handleCopyMdInline` function, `EyeOpenIcon` import, and the markdown source view panel
  - Remaining dropdown options (Open markdown file, Copy as Markdown, Copy page URL, Open in ChatGPT/Claude/Perplexity) are unchanged

### Changed

- Hidden "Add badge to your README" section on component detail page (2026-03-17 19:30 UTC)
  - Badge markdown snippet, copy button, and preview image removed from `ComponentDetail.tsx`
  - Standalone `View llms.txt` link remains visible
  - Badge section still present on Profile, Submit, and other surfaces

### Fixed

- SKILL.md (Download Skill) now generated during submit, profile edit, and content model migration (2026-03-17 18:45 UTC)
  - Previously `buildSkillMdFromContent` was only called inside `generateDirectoryContent` (admin regeneration), so packages submitted with v2 content or migrated to v2 never got a `skillMd` until an admin regenerated
  - Extracted `buildSkillMdFromContent` to `shared/buildSkillMd.ts` for reuse across "use node" actions and mutation files
  - `submitPackage` builds `skillMd` when v2 content is present at submission
  - `updateMySubmission` rebuilds `skillMd` when users edit v2 content from their profile
  - `migrateToContentModel` backfills `skillMd` for packages already having v2 content fields
  - `updateGeneratedContent` (admin) auto-rebuilds `skillMd` when content fields change
  - `_addPackage` now accepts optional `skillMd` argument

### Changed

- Component detail markdown rendering now uses a unified `markdown-body` CSS class with GitHub-style typography (2026-03-17 17:53 UTC)
  - Added `.markdown-body` class in `src/index.css` with proper heading hierarchy (h1 1.5rem with bottom border, h2 1.25rem with bottom border, h3 1.1rem, h4 1rem), paragraph spacing, nested list bullet progression (disc, circle, square), inline code styling, blockquote borders, GFM table zebra striping, task list checkbox support, and comfortable 1.7 line-height
  - Replaced 4 duplicated inline Tailwind `[&_*]` class blocks in `src/pages/ComponentDetail.tsx` with single `markdown-body` wrapper divs on Use Cases, How it Works, From the README, and v1 long description sections
  - Fixed heading hierarchy: v1 long description headings were forced to `text-sm uppercase` which made README h1/h2 unreadable; now renders at proper sizes matching GitHub README appearance
  - Simplified `src/components/markdownComponents.tsx` by removing heading, paragraph, list, and blockquote overrides (now handled by CSS) and adding shared `img` component with video detection
  - Removed duplicated `img`, `p` component definitions from ComponentDetail v1 section since shared markdownComponents now handles these

- ProfileEditSubmission content editor now shows editor and preview side by side on desktop, stacked on mobile (2026-03-17 15:25 UTC)
  - Description, Use Cases, and How it Works use a two-column grid (`lg:grid-cols-2`) with labeled Edit and Preview panes
  - Description gets a live markdown preview for the first time
  - Preview panes have independent scroll with `min-h` and `max-h` constraints for balanced layout
  - README preview remains full-width (read-only)
- Package, Repo, and npm values in ProfileEditSubmission info box are now clickable links (2026-03-17 15:28 UTC)
  - Package links to the component detail page, Repo and npm open in new tabs

- Admin, submit, and profile content generation are now unified on the same v2 prompt and flow (2026-03-17 06:44 UTC)
  - Admin action bar button switched from `regenerateSeoContent` (v1 SEO) to `regenerateDirectoryContent` (v2 content), renamed to "Generate Content"
  - `buildContentPrompt` now accepts an admin custom template; both `generateDirectoryContent` and `previewDirectoryContent` load the admin prompt via `_getSeoActivePromptContent`
  - Admin prompt settings panel renamed to "Component Directory Content Prompt" with v2 placeholders and description
  - Default prompt in `convex/aiSettings.ts` switched to `DEFAULT_CONTENT_PROMPT_TEMPLATE`
  - User rate limit raised from 1 to 5 generations per hour; warning modal text updated in `src/pages/SubmitForm.tsx` and `src/pages/ProfileEditSubmission.tsx`
  - Admin remains exempt from rate limiting

- README and generated markdown now renders with GitHub-style tables, proper heading spacing, and shared component overrides (2026-03-17 06:26 UTC)
  - Created `src/components/markdownComponents.tsx` with shared `react-markdown` component overrides for code blocks, GFM tables (borders, header background, alternating rows), headings with top margin, lists, blockquotes, and horizontal rules
  - `src/pages/SubmitForm.tsx`, `src/pages/ProfileEditSubmission.tsx`, and `src/pages/ComponentDetail.tsx` now use the shared components instead of duplicated inline overrides
  - Detail page README wrapper classes updated with full heading and list spacing to match GitHub rendering

- Component detail page now shows an hr separator and "From the README.md" heading above imported README content (2026-03-17 06:15 UTC)
  - Added `<hr>` and `<h3>` to the rendered detail page and the `buildComponentMarkdown` export for llms.txt

- AI generation surfaces now show a pulsing DotsNine loading indicator instead of static "Generating..." text (2026-03-17 06:08 UTC)
  - Created shared `src/components/AiLoadingDots.tsx` using Phosphor `DotsNine` with `animate-pulse`
  - Applied to the generate buttons and warning modal confirm buttons in `src/pages/SubmitForm.tsx` and `src/pages/ProfileEditSubmission.tsx`
  - Applied to the Regenerate SEO + Skill button and content migration Generate button in `src/pages/Admin.tsx`

- Generated content preview is now rate limited and warned before use on submit and profile edit surfaces (2026-03-17 05:53 UTC)
  - Added `contentGenerationRequests` in `convex/schema.ts` plus new helper functions in `convex/contentGenerationLimits.ts` to enforce a `once per hour per signed-in account` cooldown
  - Updated `convex/seoContent.ts` so `previewDirectoryContent` requires authentication, records each request, and returns a clearer retry message when the cooldown is active
  - `src/pages/SubmitForm.tsx` and `src/pages/ProfileEditSubmission.tsx` now show a matching warning modal before generation that tells users not to abuse regeneration and to edit the current draft when possible
  - Updated remaining `previewDirectoryContent` callers to pass source metadata so the new action contract stays consistent

- Submit, profile, agent prompt, and imported README rendering were polished for the v2 content workflow (2026-03-17 05:43 UTC)
  - `src/pages/SubmitForm.tsx`, `src/pages/Profile.tsx`, and `src/pages/ProfileEditSubmission.tsx` now use the same wide `max-w-7xl` shell pattern as `src/pages/Submit.tsx`
  - Generated-content textareas in submit and profile edit are now vertically resizable for longer editing sessions
  - `src/components/ReadmePreviewNotice.tsx` now uses toggle icons to make its expand or collapse behavior more obvious
  - `src/components/CodeBlock.tsx` now includes a copy control, and `src/components/AgentInstallSection.tsx` now renders the visible prompt block with the shared Diffs-based code UI
  - `src/pages/ComponentDetail.tsx` now resolves relative imported README links like `CONTRIBUTING.md` against the GitHub repository instead of sending users to local 404 routes

- The v2 content editing flow is now aligned across detail, submit, admin, and profile surfaces (2026-03-17 05:21 UTC)
  - `src/pages/ComponentDetail.tsx` now places `View llms.txt` inside the badge section, and README source copy now reads more naturally via `convex/seoContent.ts`
  - `src/pages/SubmitForm.tsx` now uses a `1200px` layout and a shared README preview helper linked to the official Convex component template
  - `src/components/ComponentDetailsEditor.tsx`, `src/pages/Admin.tsx`, and `convex/seoContentDb.ts` now support the v2 generated content model for migrated packages instead of only the old AI SEO editor
  - Added `src/pages/ProfileEditSubmission.tsx` plus a new route in `src/main.tsx` so submitters edit on a dedicated full page instead of a modal

- AI SEO generation now grounds output on the submission README before package metadata and cross checks Convex terminology against Convex docs context (2026-03-16 23:05 UTC)
  - Added shared fallback prompt template in `shared/seoPromptTemplate.ts` so `convex/aiSettings.ts` and `convex/seoContent.ts` stay aligned
  - `convex/seoContent.ts` now fetches GitHub README content on demand, supports common GitHub `blob` and `tree` README paths, and adds best effort docs grounding from `https://docs.convex.dev/llms.txt` plus a reachability check for `https://docs.convex.dev/`
  - Updated the Admin SEO Prompt Settings help text and placeholder list in `src/pages/Admin.tsx` to match the new README first prompt behavior
  - Verified with `npm run build`

### Added

- Editable AI SEO content fields in admin Component Details editor (2026-03-14 UTC)
  - New `updateSeoContent` admin mutation in `convex/seoContentDb.ts` for directly patching SEO fields without regenerating via AI
  - New `SeoContentSection` component in `src/components/ComponentDetailsEditor.tsx` with inline editing for value prop, benefits, use cases, FAQ, resource links, and SKILL.md
  - All SEO text fields use `resize-y` textareas so admins can drag to expand any field
  - Edit button appears next to generated SEO content header; Save and Cancel controls at the bottom
  - Local edit state syncs with backend on regeneration so fresh AI output flows through when not editing
  - Passed `seoBenefits`, `seoUseCases`, `seoFaq`, and `seoResourceLinks` from admin query through `PackageComponentDetailsEditor` to the editor component
  - Read-only summary shows value prop preview, benefit bullets, use case and FAQ counts, and SKILL.md status
  - AI SEO generation still only triggers from the Regenerate button or the auto-generate admin setting; manual edits never call the AI

### Fixed

- Stored README markdown no longer includes the prompt prefix text "From the README.md" (2026-03-17 06:04 UTC)
  - `fetchGitHubReadme` in `convex/seoContent.ts` now returns separate `content` (for AI prompt) and `rawContent` (for storage) fields
  - Both `extractReadmeIncludeBlock` call sites updated to use `rawContent`

- React hooks order error in `src/pages/ProfileEditSubmission.tsx` fixed by moving `canGenerate` and `handleOpenGenerateWarning` above all early returns (2026-03-17 06:00 UTC)

- Migrated component detail pages now render README code blocks safely and no longer show legacy Resources or SEO blocks after moving to the v2 content model (2026-03-17 03:50 UTC)
  - Fixed `src/components/CodeBlock.tsx` to pass the correct `name` field into `@pierre/diffs`, which resolves the runtime `Cannot read properties of undefined (reading 'match')` crash during README code rendering
  - Updated `src/pages/ComponentDetail.tsx` so old visible SEO sections only render for the legacy content model
  - Removed obsolete Resources output from the legacy markdown builders in `convex/http.ts` and `convex/router.ts` so exported markdown matches the visible detail page

- Hiding detail page SEO visibility now also hides the `llms.txt` link on component detail pages (2026-03-16 22:49 UTC)
  - Updated `src/pages/ComponentDetail.tsx` so the standalone `View llms.txt` link respects the same `hideSeoAndSkillContentOnDetailPage` flag as the visible SEO and SKILL sections
  - Verified with `npm run build` and confirmed the Netlify production build passes

- Component detail long description heading now capitalizes the visible component name instead of using raw package casing (2026-03-16 21:47 UTC)
  - Added `capitalizeHeadingText()` in `src/pages/ComponentDetail.tsx` and applied it only to the visible `{Component Name} Description` heading
  - Left AI generated SEO content unchanged
  - Verified with `npm run build` and confirmed the Netlify production build passes

- Admin can now hide generated SEO and SKILL content from the public detail page without deleting it (2026-03-16 21:37 UTC)
  - Added a new Actions row toggle in `src/pages/Admin.tsx` to hide or show generated SEO and SKILL content on `src/pages/ComponentDetail.tsx`
  - Added `hideSeoAndSkillContentOnDetailPage` to package data in `convex/schema.ts` and `convex/packages.ts`
  - `src/pages/ComponentDetail.tsx` now hides the visible SEO blocks, `For Agents` link, `AgentInstallSection`, SKILL download action, and `SKILL.md` block when the toggle is enabled
  - Detail-page meta description and FAQ JSON-LD now respect the same hidden state so draft SEO changes stay off the public page
  - Verified with `npx convex codegen`, `npx tsc --noEmit`, and `npm run build` (2026-03-16 21:37 UTC)

- Submit form category dropdown now saves the selected admin-managed category correctly (2026-03-16 17:27 UTC)
  - Updated `src/pages/SubmitForm.tsx` to use category `id` values from `useDirectoryCategories()` for label lookup, option keys, and selection state
  - Brings the public submit flow back in sync with the admin category editor and backend category storage
  - Verified with `npm run build`

- Admin submissions can now be viewed by approval date from the sort dropdown (2026-03-13 22:33 UTC)
  - Added a `Recently approved` sort option in `src/pages/Admin.tsx` backed by the existing `approvedAt` field
  - When selected, package cards show the approval date in the row summary and expanded calendar tooltip instead of the submitted date
  - Verified the Netlify production build with `npm run build` (2026-03-13 22:35 UTC)

- Admin package cards no longer duplicate the `Reviewed by` label outside AI review history (2026-03-13 21:40 UTC)
  - Removed the inline `Reviewed by` line from the expanded package card in `src/pages/Admin.tsx`
  - Kept the same reviewer attribution visible in the AI Review History drawer detail pane so the metadata still appears during run inspection

- Reward sending now gated by package reviewStatus (2026-03-13 20:00 UTC)
  - Rewards can only be sent for packages with `in_review` or `approved` status, preventing payouts for pending or rejected submissions
  - Backend guard in `convex/payments.ts` returns descriptive error if status is wrong
  - Admin UI disables the Send Reward button with tooltip when status does not qualify
  - Added `backfillRewardStatusFromPayments` mutation to reconcile packages where Tremendous succeeded but `rewardStatus`/`rewardTotalAmount` fell out of sync

### Changed

- Admin collapsible toggle boxes now expand on full row click (2026-03-13 21:30 UTC)
  - Component Author, Component Details, and Package Metadata sections all use the same click-anywhere-to-expand pattern
  - Replaced inner `<button>` elements with clickable `<div>` wrappers with keyboard accessibility (`Enter`/`Space`)
  - Pill label on the right still visually indicates the toggle state

- Collapsed author info behind a toggle in admin package cards (2026-03-13 20:15 UTC)
  - New `AuthorToggleSection` component in `src/pages/Admin.tsx` wraps submitter email, name, and Discord fields behind a show/hide button
  - Styled to match Component Details and Package Metadata boxes (rounded border, bg-bg-hover/30, uppercase header, subtitle)
  - Defaults to hidden, reducing card clutter and protecting PII at a glance

### Added

- Video support in long description markdown rendering on component detail pages (2026-03-12 22:45 UTC)
  - Added `img` component override to `ReactMarkdown` in `src/pages/ComponentDetail.tsx` that renders native `<video>` elements for `.mp4`, `.webm`, and `.mov` source URLs instead of broken `<img>` tags
  - Added `a` component override that does the same for links pointing to video files (GitHub sometimes wraps video references in anchor tags)
  - Both video elements include `controls` and `playsInline` for playback on desktop and mobile
  - Fixes gray box issue where GitHub README videos (like `SelfHosting.mp4` on `get-convex/static-hosting`) were rendered as unsupported image tags
  - Non-video images continue to render normally with lazy loading

- Shareable WorkOS admin auth feedback PRD for team review (2026-03-10 01:04 UTC)
  - Added `prds/workos-admin-feedback-request.md` with the current admin access rule, WorkOS claim dependency, and a short question list for WorkOS best practice feedback
  - Documents that admin access comes from `identity.email` in Convex and currently allows authenticated `@convex.dev` accounts

- Component detail help modal for support and install guidance (2026-03-09 22:22 UTC)
  - Added a small `How to get help` trigger below the rating block in `src/pages/ComponentDetail.tsx`
  - The new modal points users to the component author's GitHub Issues page when a repository URL is available
  - Added a Convex community support link plus a smaller third party component notice for community installs

- Shareable Netlify `llms.txt` redirect checklist for dev handoff (2026-03-09 17:53 UTC)
  - Added `prds/netlify-llms-redirect-checklist.md` with a concise "What to fix" summary, dashboard checks, redeploy steps, and verification commands for the stale redirect issue
  - Documents why markdown and badge routes can still work while `llms.txt` fails, and when to replace the redirect with an edge-function proxy

- Discord username display on component detail pages (2026-03-09 21:55 UTC)
  - When a submitter provides a Discord username, it now appears in the sidebar below the repo link and above the Verified/Community badges
  - Displays the Phosphor `DiscordLogo` icon and links to the Convex community Discord at `https://www.convex.dev/community/`
  - Added `submitterDiscord` to `publicPackageValidator` and `toPublicPackage()` in `convex/packages.ts`

- Admin editable submitter name and Discord in Submitter Info section (2026-03-09 21:55 UTC)
  - `SubmitterEmailEditor` in `src/pages/Admin.tsx` now includes Name and Discord fields alongside email editing
  - Name and Discord display with copy buttons in the non-editing view, consolidated into the same editable section
  - Added `updateSubmitterInfo` admin mutation in `convex/packages.ts` for patching `submitterName` and `submitterDiscord`

- Public preflight checker for validating component repos before submission (2026-03-08 22:30 UTC)
  - New page at `/components/submit/check` where developers can test their GitHub repo against review criteria
  - Requires authentication (auto-redirects to sign in if not authenticated)
  - Uses same AI review logic as admin reviews via shared `runReviewOnRepo` helper extracted from `convex/aiReview.ts`
  - Added `runPreflightCheck` internal action that runs review without persisting results to `packages` table
  - Added `preflightChecks` table in `convex/schema.ts` for rate limiting (hashed IP) and 30-minute result caching
  - Added `/api/preflight` HTTP endpoint with authentication check, IP-based throttling: 10 checks per hour per IP, 1 concurrent check limit
  - Created `convex/preflight.ts` with helpers for IP hashing (`hashIp`), URL normalization (`normalizeRepoUrl`), and internal queries and mutations (`_checkRateLimit`, `_getCachedResult`, `_createPreflightCheck`, `_updatePreflightCheck`, `_hasInFlightCheck`)
  - Created `src/pages/SubmitCheck.tsx` with auth gate, repo input form, loading states, and detailed results UI showing pass or fail status, summary, critical vs advisory criteria breakdown, and suggestions
  - Added route at `/components/submit/check` in `src/main.tsx`
  - Added prominent preflight check link in `src/pages/SubmitForm.tsx` below the page header with icon and helper text
  - Security: Returns only status, summary, criteria, and suggestions. Does not expose provider names, model names, or raw LLM output. Stores only hashed IPs. Requires valid auth token.
  - PRD: `prds/public-preflight-checker.md`

### Changed

- AI review prompt moved to v6 with package entry point checks and wrapper-aware component guidance (2026-03-13 04:39 UTC)
  - Updated `convex/aiReview.ts` review criteria and prompt text to add a critical `package.json` entry point check for `./convex.config.js` and `./_generated/component.js`, while calling out `/test` support explicitly
  - Reframed component source discovery so a top-level `convex/` directory is no longer treated as a normal packaged component pattern unless surrounding package evidence supports it
  - Clarified that React hooks, classes, and helper APIs may be exported by a component package even though component functions remain server-only across the boundary
  - Expanded GitHub repo snapshots in `convex/aiReview.ts` to include `package.json` plus visible client and test entry files so entry point and wrapper checks are based on visible evidence
  - Mirrored the same v6 default review prompt in `convex/aiSettings.ts`, bumped `shared/aiReviewPromptMeta.ts`, and added PRD `prds/ai-review-prompt-v6.md`

- AI review prompt moved to v5 with component source detection and split validator criteria (2026-03-09 21:16 UTC)
  - Updated `convex/aiReview.ts` so repository discovery checks all visible `convex.config.ts` files and prefers the config that uses `defineComponent()` over consumer apps that only use `defineApp()`
  - Updated the default review prompt in both `convex/aiReview.ts` and `convex/aiSettings.ts` to add component source discovery guidance, keep 8 critical pass criteria, and expand advisory notes from 4 to 5 by splitting args validators from returns validators
  - Clarified that missing public `returns` validators are advisory only, while missing public `args` validators remain a critical failure
  - Updated the Admin AI Review Settings help text in `src/pages/Admin.tsx` to match the v5 review model
  - Added shared prompt metadata in `shared/aiReviewPromptMeta.ts` so the review version label and updated date stay in sync across backend prompt files and the Admin prompt panel
  - Verified with `npx tsc -p convex/tsconfig.json --noEmit --pretty false` and `npm run build`, which is the build command configured in `netlify.toml`

- Submit page table now hides the desktop `Published` column and shows publish dates inside expanded submission details (2026-03-09 08:03 UTC)
  - Rebalanced the collapsed desktop table so `Maintainer`, `Downloads`, `Submitted`, and `Status` use equal-width columns in `src/pages/Submit.tsx`
  - Kept publish metadata available by moving it into the expanded details grid when a user opens a submission row
  - Verified with `npm run build`

- AI review prompt updated to v4 to prevent false failures on internal functions (2026-03-09 06:45 UTC)
  - Criterion 5 (public component functions have validators) now explicitly exempts `internalQuery`, `internalMutation`, and `internalAction` from the validator requirement
  - Added new IMPORTANT bullet in system prompt clarifying only public `query`/`mutation`/`action` functions that cross the component boundary require explicit args and returns validators
  - Updated JSON response template notes for criterion 5 to document the exemption
  - Applied identically to both `convex/aiReview.ts` (inline fallback prompt and `REVIEW_CRITERIA` array) and `convex/aiSettings.ts` (`DEFAULT_REVIEW_PROMPT` constant)

### Fixed

- Submit success modal action buttons now use the standard rounded button shape instead of pill styling (2026-03-12 17:06 UTC)
  - Updated `src/pages/SubmitForm.tsx` so `View My Submissions` and `Back to Directory` use `rounded-lg`, which matches the modal's surrounding shape language more closely
  - Synced `task.md`, `changelog.md`, and `files.md` and rechecked the Netlify build with `npm run build`

- Thumbnail generation from the admin component editor now queues through a public Convex wrapper action instead of calling the worker path directly (2026-03-12 17:05 UTC)
  - Updated `convex/thumbnailGenerator.ts` so `generateThumbnailForPackage` verifies admin access and schedules new internal worker `_generateThumbnailForPackage`
  - Keeps the real image composition work on the private worker path, which avoids the runtime `Called by client` failure seen from `src/components/ComponentDetailsEditor.tsx`
  - Updated the editor success toast to reflect queued behavior with `Thumbnail generation started`
  - Verified Convex sync passes with `npx convex dev --once --typecheck disable`

- Tremendous reward notes now reach recipients as custom message copy instead of staying local to payment history only (2026-03-09 20:58 UTC)
  - `convex/payments.ts` now forwards the optional note to Tremendous `delivery.meta.message` so the message appears in the reward email and landing page when provided
  - The reward payload stays unchanged for sends without a note, which preserves existing package rewards and test reward behavior
  - Updated reward and test reward modal labels in `src/pages/Admin.tsx` to clarify the field is a recipient-facing message
  - Verified with `npm run build`

- Profile submissions can now add or replace logos after the initial submit without losing owner-only protections (2026-03-09 06:25 UTC)
  - Added logo upload, replace, and clear controls to the edit modal in `src/pages/Profile.tsx`
  - Extended `getMySubmissionForEdit` in `convex/packages.ts` to return the current `logoUrl` so the profile editor can reflect saved state
  - Reused the existing Convex upload URL flow so user edits match the initial submit experience

- Package write authorization is now enforced on the backend instead of relying on frontend routes alone (2026-03-09 06:25 UTC)
  - Hardened admin-only package mutations in `convex/packages.ts`, including review status, visibility, featured controls, submit listing visibility, thumbnail save, and manual refresh actions
  - Shared logo writes now require package ownership or admin access, which preserves Admin capabilities while blocking cross-package edits from non-admin users
  - Moved submit, refresh, and AI review system writes onto internal mutations and derived submission ownership from the authenticated email in `submitPackage`
  - Verified with `npx convex codegen` and `npm run build`

- Submit form packages now default to Community in Admin (2026-03-09 05:51 UTC)
  - `convex/packages.ts` now passes `communitySubmitted: true` from `submitPackage` into `addPackage` for public submissions
  - Newly submitted packages now load with the Community toggle enabled in the Admin Actions row and `ComponentDetailsEditor` without extra UI-only defaults
  - Verified with `npx convex codegen` and `npm run build`

- Component detail category links and admin category slug lifecycle now stay in sync with category pages (2026-03-09 05:19 UTC)
  - `src/pages/ComponentDetail.tsx` now links the sidebar category pill to `/components/categories/:slug` only when the package category still maps to an enabled public category
  - Detail page markdown export now uses the same resolved admin-managed category label shown in the UI
  - `convex/packages.ts` now validates admin category updates, migrates related package category slugs on category slug edits, and clears related package category values on delete to avoid orphaned category routes
  - Hardened category admin APIs so `listAllDirectoryCategories`, `upsertCategory`, `deleteCategory`, and `seedCategories` require admin identity

- Category pages now show 24 components before pagination and return to the correct `/components/` root (2026-03-09 05:11 UTC)
  - Increased `src/pages/CategoryPage.tsx` pagination from 12 to 24 items per page
  - Normalized breadcrumb, back links, mobile "All" chips, shared category sidebar root links, and router redirects to `/components/`
  - Kept category detail routes on `/components/categories/:slug`

- Directory categories now open category landing pages instead of falling back to the old filtered load more view (2026-03-09 05:02 UTC)
  - `src/pages/Directory.tsx` now uses direct category links in the desktop sidebar and mobile category pills
  - The main `/components` overview keeps the 12 card preview plus `View all` behavior for grouped category sections
  - `Load more` remains only for featured and search driven flat result views

- Review-state detail pages now stay shareable without exposing full agent UI or indexable metadata before approval (2026-03-09 01:58 UTC)
  - `src/pages/ComponentDetail.tsx` now sets `noindex, nofollow` for `pending`, `in_review`, `changes_requested`, and `rejected`, while only `approved` keeps indexable robots behavior and JSON-LD injection
  - `For Agents`, `Use with agents and CLI`, SKILL download actions, and the `SKILL.md` block now render only for `in_review` and `approved`
  - `netlify/edge-functions/og-meta.ts` now injects matching robots meta into crawler-visible HTML so Netlify edge output stays in sync with the SPA
  - Verified `npm run build` passes and confirmed the sitemap still lists approved packages only

- Admin category saves now stay visible in crowded categories on localhost (2026-03-08 23:25 UTC)
  - Kept the admin editor in sync with reactive package detail updates and preserved explicit clear category handling in the save flow
  - Added a remount key in `src/pages/Admin.tsx` so saved package detail props reset the editor instance cleanly
  - Restored pagination for all Directory views including selected categories (12 cards initially, "Load more" for additional items) (2026-03-09 06:15 UTC)

- Directory category selection now scrolls back to the top of the page so filtered results are visible immediately (2026-03-08 22:13 UTC)
  - Updated `src/pages/Directory.tsx` to route category changes through a shared selection handler
  - Added a smooth scroll reset to the directory header when users choose a sidebar category or mobile category pill

- Fixed preflight.ts crypto module error in Convex runtime (2026-03-08 23:15 UTC)
  - Changed `hashIp` function from Node.js `crypto.createHash()` to Web Crypto API `crypto.subtle.digest()`
  - The default Convex runtime (V8) does not have access to Node.js built-in modules like `crypto`
  - Function is now async and uses `TextEncoder` and `crypto.subtle.digest("SHA-256", data)` for hashing
  - Updated `convex/http.ts` to await the now-async `hashIp` call
  - Verified with `npx convex codegen`, `npx tsc -p convex/tsconfig.json --noEmit --pretty false`, and `npm run build`

- Shared Git and Cursor collaboration workflow PRD for multi developer repo work (2026-03-08 17:39 UTC)
  - Added `prds/git-cursor-shared-repo-workflow.md` with a branch first team workflow, a safe direct to `main` fallback, conflict handling steps, and explicit guidance for Cursor's Commit and Sync controls
  - Includes exact Git commands for fetch, status, rebase, push, stash, and conflict recovery when another developer is pushing to the same repo

- Admin AI review history drawer with persistent run logging (2026-03-08 06:06 UTC)
  - Added `aiReviewRuns` table in `convex/schema.ts` to store every saved AI review result per package, including status, criteria, provider metadata, and raw model output
  - Updated `convex/aiReview.ts` to create history records for successful reviews, partial reviews, invalid component checks, and runtime errors while keeping the existing latest review snapshot fields on `packages`
  - Added `getAiReviewRunsForPackage` admin query and `_createAiReviewRun` internal mutation in `convex/packages.ts`
  - Added a right-side `AI Review History` drawer in `src/pages/Admin.tsx` with a run list, score summary, criteria checklist, provider/model details, and raw output view
  - Verified with `npx convex codegen`, `npx tsc -p convex/tsconfig.json --noEmit --pretty false`, and `npm run build`

### Changed

- Admin AI automation now uses a three-toggle workflow with `Auto AI review` off by default (2026-03-08 22:01 UTC)
  - Restored `Auto-approve on pass` and `Auto-reject on fail` as optional outcome controls in `src/pages/Admin.tsx`
  - Kept `Auto AI review` as the top level trigger and visually disabled the outcome toggles until it is enabled
  - Updated `convex/packages.ts` so admin settings now track `autoAiReview`, `autoApproveOnPass`, and `autoRejectOnFail`
  - Updated `convex/aiReview.ts` so automatic approval or rejection only runs after review completion when `autoAiReview` is enabled and the matching outcome toggle is on
  - Kept `Auto AI review` false by default by preserving fallback defaults in `getAdminSettings`
  - Clarified the thumbnail automation setting so it explicitly states that auto-generation only runs for submissions that include a logo
  - Verified with `npx convex codegen`, `npx tsc -p convex/tsconfig.json --noEmit --pretty false`, and `npm run build`

- AI review prompt moved to v3 with repo-based critical pass criteria and advisory notes (2026-03-08 17:16 UTC)
  - Archived the previous default prompt into `prds/ai-review-prompt-v3.md`
  - Updated `convex/aiReview.ts` and `convex/aiSettings.ts` so the default review prompt now explicitly judges component validity from the linked GitHub repository contents rather than implying npm tarball inspection
  - Split the review into 8 critical pass criteria and 4 advisory notes while keeping the existing Admin JSON response shape unchanged
  - Updated `convex/aiReview.ts` runtime scoring so advisory misses no longer block a valid component from receiving `passed`
  - Verified with `npx convex codegen`, `npx tsc -p convex/tsconfig.json --noEmit --pretty false`, and `npm run build`
  - Smoke tested the review flow against the stored `@convex-dev/stripe` package linked to `https://github.com/convex/stripe` and confirmed the new review completed with `aiReviewStatus: "passed"`

- Admin AI review history now supports deleting older saved runs without removing the current latest snapshot (2026-03-08 17:04 UTC)
  - Added `deleteAiReviewRun` mutation in `convex/packages.ts` with a backend guard that blocks deletion of the latest saved review entry for a package
  - Updated the AI review history drawer in `src/pages/Admin.tsx` to show delete controls for past runs and a confirmation flow before removal
  - Verified with `npx convex codegen`, `npx tsc -p convex/tsconfig.json --noEmit --pretty false`, and `npm run build`

- AI review history drawer now closes on `Escape` in the admin dashboard (2026-03-08 17:05 UTC)
  - Updated `src/pages/Admin.tsx` so admins can dismiss the AI review history drawer with the keyboard
  - Keeps the delete confirmation flow safe by not closing the drawer when the confirm modal is open
  - Verified with `npm run build`

- Clarified Convex component function visibility guidance in the AI review prompts (2026-03-08 01:18 UTC)
  - Updated `convex/aiReview.ts` and `convex/aiSettings.ts` default review guidance to better reflect component boundary rules from the Convex docs
  - Wrapper or app code crossing a component boundary must target public component functions, even though those functions are not browser-client-accessible
  - `internal*` functions are only for same-component implementation details
  - Verified `npm run build` passes for Netlify output; the only remaining build note is the existing Vite chunk size warning

### Added

- Tremendous rewards integration for submitter payouts (2026-03-07 UTC)
  - New `payments` table in `convex/schema.ts` for tracking reward payments
  - Added `rewardStatus` and `rewardTotalAmount` fields to `packages` table
  - New `convex/payments.ts` and `convex/paymentsDb.ts` split Node actions from default-runtime queries and mutations
  - `sendReward` now uses direct `fetch()` to Tremendous instead of the Tremendous SDK
  - Added base URL normalization for Tremendous sandbox and production hosts
  - Fixed campaign payload handling so `campaign_id` does not conflict with `products`
  - Added `isTest` payment support and optional `packageId` handling so settings-level test rewards can be recorded without changing component reward state
  - Auto-send hook in `updateReviewStatus` mutation when package becomes approved and visible
  - Admin UI in `src/pages/Admin.tsx`:
    - "Send Reward" button in Actions row with confirmation modal (amount/note inputs)
    - `PaymentBadge` component showing Paid/Failed status in collapsed row header
    - `RewardSettingsPanel` in Settings tab with auto-send toggle, default amount input, and payment stats
    - Reward history count button next to the Reward action with modal showing past reward attempts and statuses
    - Settings-only `Send Test Reward` button in `RewardSettingsPanel` for fixed env recipient verification
  - New admin settings: `autoSendRewardOnApprove` (boolean) and `defaultRewardAmount` (numeric)
  - Safe test flow documented: sandbox first, manual send first, settings-level test reward for fixed env recipient verification, auto-send only after one successful payment
  - Test payments are stored with `isTest: true`, excluded from reward totals, and do not update package reward state
  - Environment variables required: `TREMENDOUS_API_KEY`, `TREMENDOUS_CAMPAIGN_ID`, `TREMENDOUS_FUNDING_SOURCE_ID`, optional `TREMENDOUS_BASE_URL`, `TREMENDOUS_TEST_RECIPIENT_EMAIL`

### Changed

- Admin settings tab now includes sticky section jump navigation for the long settings stack (2026-03-08 00:49 UTC)
  - Added anchored section IDs across the existing settings panels in `src/pages/Admin.tsx`
  - Added a sticky jump bar for smaller screens and a sticky in-layout right-side nav on extra-wide screens
  - Moved sticky behavior to the desktop sidebar container so the settings rail stays pinned while the page scrolls
  - Active section highlighting follows scroll position so admins can see where they are in the settings page
- Admin dashboard default filter changed from "pending" to "all" for complete submission overview (2026-03-07 00:35 UTC)
- Directory category sections now show 3 rows of cards initially before "Load more" button (2026-03-07 00:35 UTC)
  - Changed `groupedCardsPerLoad` from `gridColumns * 2` to `gridColumns * 3`
  - Shows 12 cards on 4-column desktop, 9 on 3-column, 6 on 2-column, 3 on mobile

### Fixed

- Reverted component OG image tags to the known working raw Convex storage URL format after the `/components/og/*` proxy path failed in production (2026-03-06 22:54 UTC)
  - Updated `netlify/edge-functions/og-meta.ts` to emit `component.thumbnailUrl` directly for `og:image`
  - Updated `src/pages/ComponentDetail.tsx` client-side SEO to use `component.thumbnailUrl` again
  - Removed the unused `/api/og-image` endpoint from `convex/http.ts`
  - Removed the unused Netlify redirect for `/components/og/*`
  - Removed temporary `og` route exclusions from `og-meta.ts`
  - Final stable behavior matches the original working image URLs like `https://giant-grouse-674.convex.cloud/api/storage/...`

### Changed

- Updated badge SVG colors to match frontend status pills and shields.io styling (2026-03-06 21:45 UTC)
  - Changed left box (Convex label) from `#2a2825` to `#555555` for shields.io look
  - Approved: changed from `#074ee8` (blue) to `#228909` (Convex Verified green)
  - In Review: changed from `#7c3aed` (purple) to `#2563eb` (frontend blue pill)
  - Changes Requested: changed from `#d57115` to `#ea580c` (frontend orange pill)
  - Pending and Rejected colors unchanged (already matched frontend)
  - Updated `badge-palette-preview.html` with new color values and shields.io reference

### Added

- Submission badge sync rollout for new and existing component submissions (2026-03-06 01:45 UTC)
  - Added `isSlugTaken()` and `generateUniqueSlug()` helper functions to `convex/packages.ts` for robust slug uniqueness enforcement
  - Updated `addPackage`, `generateSlugForPackage`, `generateMissingSlugs`, and `updateComponentDetails` mutations to use collision safe slug generation
  - Admin slug edits now throw error if slug is already in use by another component
  - Added `BadgeSnippet` component to `src/pages/Submit.tsx` showing README badge markdown, copy button, and live preview for submitted packages with slugs
  - Added `BadgeSnippet` component to `src/pages/Profile.tsx` so authors can copy badge markdown for their own submissions
  - Badge display stays in sync with review status at request time (no status caching)
  - Admin slug backfill through existing `SlugMigrationPanel` now uses uniqueness guards to prevent collision on legacy packages
  - Documentation updated in PRD `prds/netlify-markdown-alias-edge-function.md` under new "Submission badge sync rollout" section

### Changed

- Profile page: replaced Delete Account section with "Need help?" guidance (2026-03-06 UTC)
  - Removed `DeleteAccountModal` component and all self-service account deletion logic
  - Replaced red danger zone with neutral section directing users to use "Send Request" on their submissions to contact the Convex team for component removal or account changes
  - Cleaned up unused imports (`UserMinus`, `useMemo`)

- Component detail sidebar now shows package license above category (2026-03-06 UTC)
  - Updated `src/pages/ComponentDetail.tsx` to render a License block in the left sidebar above Category
  - Uses existing reactive `getComponentBySlug` data, so license updates from admin npm metadata refresh appear automatically on detail pages

- Updated badge implementation planning docs with final working routing pattern (2026-03-06 UTC)
  - Updated `.cursor/plans/fix_badge_system_af9c2908.plan.md` with final outcome details
  - Updated `prds/netlify-markdown-alias-edge-function.md` with the working badge proxy approach

- Temporarily disabled MCP UI and backend routes while public host routing is being debugged (2026-03-06 UTC)
  - Commented out MCP Install section with platform tabs (Cursor, Claude, ChatGPT) in AgentInstallSection.tsx
  - Commented out MCP ready badge in AgentInstallSection.tsx header
  - Commented out all `/api/mcp/*` routes in convex/http.ts (search, component, install-command, docs, info, protocol, cursor-install)
  - Copy prompt, Agent friendly summary, llms.txt, and markdown features remain fully functional
  - MCP code preserved in comments for easy re-enablement when routing is fixed

- Removed MCP Server references from `/api/llms.txt` and `/api/markdown-index` endpoints (2026-03-06 UTC)
  - These endpoints were still advertising disabled MCP protocol URLs
  - Removed "MCP Server" section from llms.txt output
  - Removed "MCP Server Integration" section from markdown-index output
  - `MCP_DIRECT_ORIGIN` constant kept for when MCP is re-enabled

### Fixed

- Added local badge palette preview file for design review and ignored it from git tracking (2026-03-06 UTC)
  - Added `badge-palette-preview.html` with badge status colors, hex values, and Tailwind/site mappings
  - Added `badge-palette-preview.html` to `.gitignore` for local-only review

- Badge route fallback to SPA HTML on Netlify for `/components/badge/*` (2026-03-06 09:05 UTC)
  - Added dedicated Netlify Edge Function `component-badge` for `/components/badge/*`
  - Badge edge function now proxies directly to `https://giant-grouse-674.convex.site/api/badge?slug=<slug>`
  - This avoids redirect and edge ordering conflicts with `/components/*` OG metadata injection
  - Verified `npm run build` passes for Netlify production build

- Component Detail MCP installs now use the verified direct Convex endpoint as a temporary fallback (2026-03-06 08:17 UTC)
  - Updated Cursor deeplink config generation to use `https://giant-grouse-674.convex.site/api/mcp/protocol`
  - Updated Claude Desktop config generation to use the same direct endpoint
  - Updated ChatGPT connector URL generation to use the same direct endpoint
  - Updated backend MCP discovery metadata and Cursor install endpoints to stop advertising broken `www.convex.dev` MCP protocol URLs
  - Updated MCP docs and project tracking docs to mark this as a temporary unblock until public host routing is fixed

- Badge endpoint not working on deployed Netlify site (2026-03-06 09:15 UTC)
  - Root cause: Netlify Edge Function `og-meta.ts` was intercepting `/components/badge/*` requests before the redirect rule could apply
  - Fix: Updated `extractSlug()` to skip both `/components/badge` and `/components/badge/*` (`"badge"` + `slug.startsWith("badge/")`) so requests pass through to the Netlify redirect
  - Badge requests now correctly proxy to `https://giant-grouse-674.convex.site/api/badge?slug=:splat`
  - Enabled README badge section in `ComponentDetail.tsx` above Related Components with border separators and live preview image
  - Updated badge docs to the public URL format `/components/badge/<slug>` in `src/docs/badges.md` and `src/docs/api-endpoints.md`

- MCP endpoint host mismatch diagnosis and fallback guidance (2026-03-06 08:00 UTC)
  - Verified live behavior: `https://www.convex.dev/components/api/mcp/protocol` currently returns SPA HTML instead of MCP JSON
  - Verified live behavior: `https://components-directory.netlify.app/components/api/mcp/protocol` currently returns SPA HTML and `/api/mcp/protocol` returns Netlify 404
  - Verified working MCP transport endpoint: `https://giant-grouse-674.convex.site/api/mcp/protocol` responds correctly to both `GET` and JSON-RPC `POST initialize`
  - Documented direct Convex MCP URL as immediate unblock path for Cursor/Claude/ChatGPT installs while public host routing propagation is finalized

- Netlify proxy redirects pointing to wrong Convex deployment (2026-03-06 07:15 UTC)
  - Changed all `netlify.toml` redirect targets from dev (`third-hedgehog-429.convex.site`) to production (`giant-grouse-674.convex.site`)
  - Added MCP API proxy redirects (`/api/mcp/*` and `/components/api/mcp/*`) before SPA fallback so Cursor/Claude/ChatGPT can reach the Convex MCP protocol endpoint
  - Added badge API proxy redirect (`/components/badge/*`) for SVG badge endpoint
  - Without these redirects, MCP clients hit Netlify's SPA fallback or 404 page instead of the Convex backend

- MCP install flow for Cursor, Claude Desktop, and ChatGPT (2026-03-06 06:45 UTC)
  - Removed all references to `@anthropic-ai/mcp-server-fetch` which was deleted from npm (404 error)
  - Migrated from `command`/`args` proxy pattern to direct URL-based Streamable HTTP transport
  - All three platforms now connect directly via `url: "https://www.convex.dev/components/api/mcp/protocol"` with no npm package dependency
  - Added GET handler for `/api/mcp/protocol` so browsers and discovery clients get server info instead of a 404
  - Updated protocol version from `2024-11-05` to `2025-03-26` (MCP Streamable HTTP spec)
  - Updated CORS headers to support MCP transport headers (`Accept`, `Mcp-Session-Id`, `Mcp-Protocol-Version`)
  - Updated Cursor install deeplink endpoints to emit url-based config
  - Updated `shared/mcpTypes.ts` `CursorInstallLink` interface to match new config shape
  - Updated `src/docs/mcp.md` documentation with new config examples for all three platforms
  - All existing REST MCP endpoints preserved unchanged (`/api/mcp/search`, `/api/mcp/component`, etc.)
  - PRD: `prds/mcp-streamable-http-migration.md`

### Changed

- Improved SKILL.md generation following Anthropic skill creator guidelines (2026-03-06 UTC)
  - Description field now uses "pushy" trigger contexts per Anthropic recommendation to prevent under-triggering
  - Added `buildTriggerContexts()` helper that extracts trigger phrases from category, tags, and use case queries
  - Instructions now use imperative form ("Use X to..." instead of "X is a component that...")
  - Added "When NOT to use" section to prevent over-triggering on unrelated queries
  - Updated SEO + SKILL.md Prompt panel in Admin.tsx settings to document the new SKILL.md format
  - Reference: https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md

### Added

- Dynamic OpenGraph meta tags via Netlify Edge Function HTML injection (2026-03-06 06:15 UTC)
  - Rewrote `netlify/edge-functions/og-meta.ts` from bot detection approach to universal HTML injection
  - Edge function now intercepts ALL `/components/{slug}` requests, fetches component data from Convex, and replaces default meta tags in the SPA HTML with component-specific values
  - Works for all clients: headless browsers (opengraph.xyz), social crawlers, and regular browsers
  - Previous bot-detection approach failed because opengraph.xyz uses headless Chrome with standard browser UA
  - Fetches component data and SPA HTML in parallel for minimal latency impact
  - CDN cached at 60s browser / 300s edge
  - Static assets, reserved routes, and non-component paths bypass the function entirely
  - PRD: `prds/opengraph-meta-fix.md`

### Changed

- Updated AI review prompt to v2 with improved accuracy (2025-03-05 21:30 UTC)
  - Fixed false negative: now only checks exported query/mutation/action for `returns` validators, not helper functions
  - Fixed false positive: functions intentionally in public API no longer flagged for not using `internal*`
  - Added documentation that components cannot use `ctx.auth`
  - Added auth callback pattern guidance for re-exported functions
  - Renamed criteria for clarity: "Exported functions have returns: validator", "Internal-only functions use internal*", "Uses auth pattern (when applicable)"
  - Archived original prompt to `prds/ai-review-prompt-v1.md`
  - Updated "How AI Review Works" section in Admin settings panel to match v2 criteria (2025-03-05 22:00 UTC)

### Added

- Admin search now supports component name and repository URL searches (2026-03-05 22:12 UTC)
  - Added `search_componentName` and `search_repositoryUrl` indexes to `convex/schema.ts`
  - Updated `adminSearchPackages` query to search across five fields: package name, description, maintainer names, component name, and repository URL
  - Admins can now search by human readable names like "Convex Agent" or repo paths like "gilhrpenner/convex-files"

### Changed

- Unified font sizes between AI generated SEO content and long description markdown in ComponentDetail.tsx (2026-03-05 UTC)
  - Long description now uses `text-sm text-text-secondary` matching SEO content styling
  - Removed prose typography classes in favor of explicit size selectors
  - Changed "Made by" to "by" in author row for cleaner display
- Updated "Live Demo URL" field label to "Live Demo URL or Example App" in SubmitForm.tsx and ComponentDetailsEditor.tsx (2026-03-05 17:45 UTC)

### Added

- Multi-platform MCP install section with toggle tabs (2026-03-04 20:15 UTC)
  - Replaced single "Install in Cursor" with tabbed interface: Cursor | Claude | ChatGPT
  - Cursor tab: deeplink install button + config copy (existing functionality)
  - Claude Desktop tab: manual JSON config with file path instructions for macOS/Windows
  - ChatGPT tab: custom connector URL with Developer mode setup steps
  - Added `generateClaudeDesktopConfig()` and `generateChatGPTConnectorConfig()` to `src/lib/mcpProfile.ts`
  - Platform-aware copy button copies appropriate config/URL for selected tab
  - PRD: `prds/multi-platform-mcp-install.md`

### Fixed

- Long package names in ComponentDetail author row now truncate gracefully instead of wrapping awkwardly (2026-03-05 15:30 UTC)
  - Added `flex-wrap` to author row container for graceful line breaks
  - Added `truncate max-w-[280px] sm:max-w-none` to repo name link (truncates on mobile, full on desktop)
  - Added `title` attribute for hover tooltip when name is truncated

- Submit form long description markdown preview now renders headings, lists, and links correctly (2026-03-05 23:25 UTC)
  - Added explicit component renderers for `h1`, `h2`, `h3`, `ul`, `ol`, `li` in `src/pages/SubmitForm.tsx`
  - Added 500 character max limit with live counter
  - Preview only shows when content is entered

- Long description markdown now preserves line breaks on component detail pages and links use purple hover-underlined styling (2026-03-05 23:08 UTC)
  - Updated `src/pages/ComponentDetail.tsx` markdown rendering to preserve author-entered line breaks
  - Updated markdown link styling to `#8D2676` with underline on hover

- Admin submissions sort dropdown now includes Verified, Community, and Featured options (2026-03-05 21:53 UTC)
  - Added three sort modes in `src/pages/Admin.tsx`: `verified`, `community`, and `featured`
  - Added dropdown labels: `Verified first`, `Community first`, `Featured first`
  - Added stable sorting with newest (`submittedAt`) as tie-breaker to preserve list behavior

- MCP install URLs now use live Components public path (2026-03-05 00:10 UTC)
  - Updated all MCP install generators to use `https://www.convex.dev/components/api/mcp/protocol`
  - Applies to Cursor install config, Claude Desktop JSON config, and ChatGPT connector URL
  - Aligns install output with live app routing under `/components`

- MCP endpoint URLs now use Convex site URL directly (2026-03-04 21:00 UTC)
  - Changed from `https://www.convex.dev/api/mcp/protocol` to `https://third-hedgehog-429.convex.site/api/mcp/protocol`
  - Fixes 404 issue since there's no Netlify proxy for `/api/mcp/*` routes
  - Matches existing pattern used by `llms.txt` and markdown routes in `netlify.toml`
  - Updated all MCP config generators in `src/lib/mcpProfile.ts` to use `MCP_CONVEX_SITE_URL`
  - Superseded by 2026-03-05 update to use public `/components/api` MCP URL

- Comprehensive documentation coverage for all app features (2026-03-04 22:30 UTC)
  - Added 3 new docs: MCP (Model Context Protocol), Public API Endpoints, README Badges
  - New "Integrations" nav group in Documentation.tsx for MCP, API, and badge docs
  - Updated 9 existing docs with missing feature details: agent install feature flags, llms.txt URLs, submissions pagination, Sub Hide toggle, AI provider failover, SEO prompt placeholders, user deletion request flow, category verified counts, soft deletion from user side

### Fixed

- Admin filter tabs bar no longer scrolls horizontally, tabs wrap instead (2026-03-04 19:00 UTC)
- Admin filter tab tooltips now appear above the bar instead of below (2026-03-04 19:00 UTC)
- Documentation section links now use client-side route updates to prevent full page reload and repeated auth spinner between docs pages (2026-03-04 19:20 UTC)

### Added

- Documentation page markdown presentation refresh for improved readability (2026-03-04 21:24 UTC)
  - Expanded markdown rendering styles in `src/pages/Documentation.tsx` for tables, code blocks, inline code, lists, blockquotes, horizontal rules, and images
  - Kept `remarkGfm` support and improved table/code wrappers for cleaner spacing and better visual hierarchy

- Admin-only documentation system at `/components/documentation` (2026-03-04 12:30 UTC)
  - 13 markdown documentation files covering user guide and admin guide topics
  - Documentation page with admin gating via `api.auth.isAdmin` query
  - Three-column layout: left navigation sidebar, main content, right "On this page" outline
  - Navigation grouped into Getting Started, User Guide, and Admin Guide sections
  - Copy as Markdown and Download as Markdown buttons per page
  - `<meta name="robots" content="noindex, nofollow">` prevents search indexing
  - Mobile responsive with collapsible navigation
  - Styled with Convex design system (warm cream background, GT America typography)
  - Added "documentation" to reserved routes in `src/lib/slugs.ts`
  - TypeScript declarations for `*.md?raw` imports in `vite-env.d.ts`
  - Added "Docs" link to Header.tsx nav bar (admin-only, next to Admin link)
  - PRD: `prds/admin-documentation-system.md`

- MCP Additive Rollout Phase 1 (2026-03-03 18:00 UTC)
  - Added standards-based MCP protocol endpoint at `/api/mcp/protocol` implementing JSON-RPC 2.0 interface
  - Protocol supports `initialize` (server capabilities), `tools/list` (available tools), and `tools/call` (tool invocation)
  - Five tools available: `search_components`, `get_component`, `get_install_command`, `get_docs`, `list_categories`
  - Added Cursor MCP install link endpoints: `/api/mcp/cursor-install` (global directory server) and `/api/mcp/cursor-install-component?slug=X` (per-component)
  - Updated `AgentInstallSection.tsx` with Cursor install button and MCP config copy functionality
  - Added Cursor install link generators to `src/lib/mcpProfile.ts`: `generateGlobalCursorInstallLink()`, `generateComponentCursorInstallLink()`
  - Extended MCP types in `shared/mcpTypes.ts` with `CursorInstallLink` and `McpDirectoryInfo` interfaces
  - Added MCP capability sections to `/api/llms.txt` and `/api/markdown-index` listing protocol endpoint, tools, and Cursor install link
  - All new MCP endpoints log to `mcpApiLogs` table with endpoint, tool, slug, query, status, and timing
  - Existing REST MCP endpoints (`/api/mcp/search`, `/api/mcp/component`, etc.) and markdown/llms aliases preserved unchanged
  - PRD: `prds/mcp-additive-rollout-phase1.md` documents Phase 2 MCP Apps UI and Phase 3 Ecosystem Growth as roadmap only

- Fixed TypeScript errors in AgentInstallSection.tsx (2026-03-03 09:30 UTC)
  - Removed reference to non-exported `PromptComponentData` type from `promptComposer.ts`
  - Made `npmUrl`, `version`, `description`, and `weeklyDownloads` required in local `ComponentData` interface to match actual data contract from `getComponentBySlug`
  - Used `Parameters<typeof isMcpReady>[0]` cast for `isMcpReady` call to bridge local and module type definitions

- Synced Status Legend, Visibility Guide, and Badges section across Profile.tsx, Submit.tsx, and Admin.tsx (2026-03-03 09:15 UTC)
  - Profile.tsx: removed Archived and Pending Deletion from Visibility Guide (features removed)
  - Profile.tsx: added Featured status to Status Guide, updated rejected icon to Prohibit for consistency
  - Profile.tsx: removed DeletionBadge component and markedForDeletion references from SubmissionCard
  - Profile.tsx and Submit.tsx: added Badges section with Convex Verified and Community badge explanations
  - All three pages now share identical status definitions and badge styling

- Full Convex.dev-style footer matching official site design (2026-03-03 08:25 UTC)
  - Dark background (`#141414`) using Convex design system tokens
  - White Convex wordmark logo linking to convex.dev
  - Four link columns: Product (9 links), Developers (11 links), Company (9 links), Social (6 links with icons)
  - External links display `ExternalLinkIcon` from `@radix-ui/react-icons`
  - Social links use SVG icons from `/public/` (Twitter, Discord, YouTube, Luma, LinkedIn, GitHub)
  - "A Trusted Solution" section with green checkmark badges (SOC 2 Type II, HIPAA, GDPR)
  - Dynamic copyright year
  - Responsive grid layout (6 cols xl, 5 lg, 4 md, 2 mobile)
  - Original footer saved as `FooterBackup.tsx` for reference

- Directory `Verified` sort and category verified counts (2026-03-03 07:47 UTC)
  - Added `verified` sort option to `src/pages/Directory.tsx` for both desktop and mobile sort dropdowns
  - Extended `listApprovedComponents` sort validator and backend sort logic in `convex/packages.ts` to prioritize `convexVerified` packages
  - Extended shared `sortPublicPackages` helper with `verified` mode for consistent package sorting behavior
  - Added `verifiedCount` to `listCategories` response in `convex/packages.ts` using the same visible approved package set as total counts
  - Updated Admin Category Management in `src/pages/Admin.tsx` to display both total and verified component counts per category
  - Updated directory dropdown display label from `Verified first` to `Verified` in desktop and mobile sort controls (2026-03-03 07:52 UTC)

- Related Components section on component detail pages (2026-03-03 07:29 UTC)
  - Shows up to 3 related components below the View llms.txt link on detail pages
  - Compact no-thumbnail card grid matching Directory card style
  - Relatedness scored by shared category (+10), overlapping tags (+3 each), and download count as tiebreaker
  - New `getRelatedComponents` public query in `convex/packages.ts`
  - New `showRelatedOnDetailPage` admin setting (on by default) in AI Review Settings panel
  - Admin toggle in `src/pages/Admin.tsx` to enable or disable the section globally
  - Query returns empty array when admin setting is off, so no frontend conditional needed

- Component Authoring Challenge banner on Directory page (2026-03-03 07:15 UTC)
  - New `ChallengeBanner` component at `src/components/ChallengeBanner.tsx`
  - Dark background with repeating grid texture from `public/banner-grid.svg` (inline SVG data URL with boosted stroke visibility)
  - Left side: bold white title and two line gray subtitle, right side: "Learn more" pill button with solid dark fill and bright pink/magenta border
  - Placed above FAQSection on the Directory page
  - Responsive layout: stacks vertically on mobile, horizontal on desktop

- Private message inactive state controls in admin and profile threads (2026-03-03 06:32 UTC)
  - Added `includeInactive` option to private message queries so UIs can toggle active-only vs all messages
  - Added restore flow for hidden and archived authored messages (`status: "active"`)
  - Added Admin message thread toggle to show or hide inactive messages in `src/pages/Admin.tsx`
  - Updated empty states and status labels for inactive private messages

- Shareable WorkOS Connect setup guide for Convex team handoff (2026-03-03 01:28 UTC)
  - Updated `prds/workos-convex-environment-runbook.md` with final working Connect configuration and explicit route policy
  - Added `prds/workos-connect-convex-netlify-how-to.md` with development, staging, and production setup sections
  - Added route sections for public, auth required, admin only, and Netlify alias routes
  - Kept all examples secret free with placeholders only

- Community badge toggle in Admin Actions row (2026-03-03)
  - Added Community toggle button next to Convex Verified in Admin InlineActions
  - Uses `Users` icon from Phosphor with Community badge color scheme (`#E9DDC2` background)
  - Toggle calls `updateComponentDetails` mutation with `communitySubmitted` field
  - Shows tooltip and success toast on toggle

- Connect environment variable alignment with admin OAuth docs (2026-03-03 01:12 UTC)
  - Confirmed Connect client id flow is expected for this app and documented required domain based OAuth config
  - Finalized required local vars: `VITE_WORKOS_CLIENT_ID`, `VITE_WORKOS_REDIRECT_URI`, and `VITE_WORKOS_AUTHKIT_DOMAIN`
  - Finalized required Convex vars for both deployments: `WORKOS_CLIENT_ID` and `WORKOS_AUTHKIT_DOMAIN`
  - Recorded guidance that domain host and full `https://` domain forms are accepted by normalization logic

- WorkOS Connect OAuth PKCE flow for app authentication and Convex integration (2026-03-03 00:26 UTC)
  - Added `src/lib/connectAuth.tsx` with Connect authorize redirect, callback token exchange, PKCE/state validation, and local session storage
  - Updated `src/main.tsx` to use `ConnectAuthProvider` and connect-driven token bridge into `ConvexProviderWithAuthKit`
  - Updated `src/lib/auth.tsx` to use connect `signIn` and `signOut` while preserving `useConvexAuth` for backend auth state
  - Updated `convex/auth.config.ts` to validate JWTs using `WORKOS_AUTHKIT_DOMAIN` issuer and `/oauth2/jwks`
  - Added `WORKOS_AUTHKIT_DOMAIN` and `VITE_WORKOS_AUTHKIT_DOMAIN` requirements to `prds/workos-convex-environment-runbook.md`
  - Removed direct frontend dependency on `@workos-inc/authkit-react`
  - Verified with TypeScript checks for Convex and app plus frontend production build

- WorkOS AuthKit migration replacing legacy Convex auth wiring (2026-03-02 23:42 UTC)
  - Replaced frontend auth provider wiring in `src/main.tsx` with `AuthKitProvider` and `ConvexProviderWithAuthKit`
  - Updated shared auth hook in `src/lib/auth.tsx` to use WorkOS `signIn()` and `signOut()`
  - Replaced backend auth helpers in `convex/auth.ts` to use `ctx.auth.getUserIdentity()` claims for user and admin checks
  - Updated `convex/auth.config.ts` to WorkOS dual JWT provider configuration using `WORKOS_CLIENT_ID`
  - Removed legacy auth coupling in `convex/http.ts` (`auth.addHttpRoutes`) and `convex/schema.ts` (`authTables`)
  - Updated package dependencies to remove legacy auth packages and add `@convex-dev/workos` and `@workos-inc/authkit-react`
  - Verified with `npm run lint` (Convex typecheck, app typecheck, `convex dev --once`, and production build)

- WorkOS and Convex staging and production environment runbook PRD (2026-03-02 22:30 UTC)
  - Added `prds/workos-convex-environment-runbook.md` with exact setup for WorkOS staging and production environments
  - Added Convex deployment environment variable matrix for staging (`third-hedgehog-429`) and production (`giant-grouse-674`)
  - Added frontend environment variable matrix for local and Netlify production callback routing under `/components/callback`
  - Added verification checklist for public routes, auth-gated routes, and `@convex.dev` admin-only route access
  - Included official Convex and WorkOS reference docs for setup and troubleshooting

- Documentation workflow timestamp tracking for PRDs and project docs (2026-03-02 22:18 UTC)
  - Added PRD timestamp requirements in `.cursor/rules/workflow.mdc` and `.cursor/skills/create-prd/SKILL.md`
  - Added task completion timestamp guidance in `.cursor/rules/task.mdc`
  - Added changelog timestamp guidance in `.cursor/skills/update-project-docs/SKILL.md` and `.cursor/rules/dev2.mdc`
  - Added implementation PRD: `prds/prd-doc-timestamp-tracking.md`
  - Backfilled timestamp metadata across existing `prds/*.md` files (2026-03-02 22:24 UTC)
  - Backfilled legacy date-only completed entries in `task.md` to timestamp format using `12:00 UTC` as neutral historical time (2026-03-02 22:25 UTC)
  - Normalized legacy date-only bullets in `changelog.md` to timestamp format using `12:00 UTC` as neutral historical time (2026-03-02 22:26 UTC)

- Community badge for community-submitted components (2026-03-02 12:00 UTC)
  - New `communitySubmitted` field on packages schema
  - New `CommunityBadge` component with `#E9DDC2` background color and PersonIcon
  - Badge appears between downloads and Verified badge on Directory cards
  - Badge appears below Verified badge and above downloads in ComponentDetail sidebar
  - Admin checkbox in ComponentDetailsEditor for toggling Community status
  - Updated `directoryCardValidator`, `publicPackageValidator`, `adminPackageValidator`
  - Updated `toPublicPackage()` and `toAdminPackage()` helper functions
  - Updated `listApprovedComponents` and `getFeaturedComponents` queries to return `communitySubmitted`
  - Added to `updateComponentDetails` mutation args

- MCP and Agent Install UX for AI-assisted component installation (2026-03-02 12:00 UTC)
  - Added "Use with agents and CLI" section on ComponentDetail page (always visible, no toggle)
  - Reordered sections: Use with agents and CLI, then Agent Skill (SKILL.md), then Keywords
  - Added "Use with AI" anchor link with ClipboardText icon in header navigation
  - Simplified UI: single copy prompt optimized for agents (Claude style)
  - MCP ready badge shown in section header when component qualifies
  - Agent friendly summary with install command, setup steps, and verification checklist
  - Read-only MCP HTTP API endpoints:
    - `/api/mcp/search`: Search components by query, category with pagination
    - `/api/mcp/component`: Get full component profile
    - `/api/mcp/install-command`: Get install command for a component
    - `/api/mcp/docs`: Get documentation URLs
    - `/api/mcp/info`: Server info and tool definitions
  - Feature flags for controlled rollout (VITE_MCP_ENABLED, VITE_AGENT_INSTALL_ENABLED, etc.)
  - MCP API request logging for monitoring
  - PRD: `prds/mcp-agent-install-ux.md`
  - New files:
    - `shared/mcpTypes.ts`: MCP type definitions
    - `src/lib/mcpProfile.ts`: MCP profile builder utilities
    - `src/lib/promptComposer.ts`: Universal prompt generation
    - `src/lib/metadataScoring.ts`: Metadata quality scoring
    - `src/lib/featureFlags.ts`: Feature flag utilities
    - `src/components/AgentInstallSection.tsx`: Agent install UI component
  - Schema addition: `mcpApiLogs` table for request monitoring

- Submit page pagination and admin page size setting (2026-02-27 12:00 UTC)
  - Added paginated public queries for submissions list and search in `convex/packages.ts`
  - Added public and admin settings APIs for Submit default page size with allowed values `20`, `40`, and `60`
  - Updated `src/pages/Submit.tsx` to render page controls with default 40 items per page
  - Added a Submit Listing Settings panel in `src/pages/Admin.tsx` to manage the default page size
  - Documented query and settings coverage updates in `files.md`

### Fixed

- Runtime AI provider failover for AI Review and SEO generation (2026-03-04 02:29 UTC)
  - Added shared fallback orchestration in `convex/aiProviderFallback.ts`
  - Added internal provider settings query `_getProviderSettingsForFallback` in `convex/aiSettings.ts`
  - Updated `convex/aiReview.ts` and `convex/seoContent.ts` to fail over on runtime provider errors, not only missing keys
  - New fallback order: active admin provider, backup admin providers, then environment providers
  - Regenerated Convex API bindings in `convex/_generated/api.d.ts`

- Convex private message query return validator mismatch (2026-03-03 06:44 UTC)
  - Added `statusUpdatedAt` to `getPackageComments` return validator in `convex/packages.ts`
  - Fixed runtime `ReturnsValidationError` for archived or hidden messages returned to the client

- Directory badge placement for community-only components (2026-03-03 06:32 UTC)
  - Updated `ComponentCard` badge rendering so a community-only component uses the same right-side badge slot as verified
  - Preserved existing dual-badge behavior so Community still appears before Verified when both are present

- Private message and notes separation across Profile, Admin, and Submit pages (2026-03-03 06:24 UTC)
  - Routed profile "Send Request" and message thread reads to private `packageComments` channel for submitter/admin communication
  - Kept `packageNotes` as admin-only internal notes and removed user-unread note coupling from admin notes UI
  - Updated `Submit.tsx` to stop rendering package comments publicly
  - Added authored message lifecycle controls (hide, archive, delete) in profile and admin message UIs
  - Enforced backend ownership and auth checks for adding, deleting, and updating message status
  - Added modal-level filter to show hidden or archived messages with restore action for authored messages (2026-03-03 06:32 UTC)
  - Added optional `includeInactive` query support for private message retrieval (2026-03-03 06:32 UTC)

- Made `View llms.txt` independent from Keywords on component detail page (2026-02-27 12:00 UTC)
  - Moved llms link rendering outside the tags conditional in `src/pages/ComponentDetail.tsx`
  - Link now appears even when a component has no keywords
  - Verified with app typecheck and Netlify offline build flow

- Restored local `.md` and `llms.txt` link behavior for component detail dropdown (2026-02-27 12:00 UTC)
  - Added local development fallback in `shared/componentUrls.ts` via `buildComponentClientUrls`
  - Localhost now uses Convex HTTP endpoints directly:
    - `/api/markdown?slug=<slug>`
    - `/api/component-llms?slug=<slug>`
  - Production keeps Netlify alias URLs:
    - `/components/<slug>/<leaf>.md`
    - `/components/<slug>/llms.txt`
  - Updated `src/pages/ComponentDetail.tsx` to use client-aware URL strategy
  - Keeps production behavior documented in `prds/netlify-markdown-alias-edge-function.md` while avoiding local Vite route 404s

- Centralized component markdown and llms URL construction to prevent route drift (2026-02-27 12:00 UTC)
  - Added shared URL helper in `shared/componentUrls.ts` for detail, markdown alias (`/components/<slug>/<leaf>.md`), and llms paths
  - Updated `src/pages/ComponentDetail.tsx` markdown dropdown with:
    - Open markdown file
    - Open in ChatGPT
    - Open in Claude
    - Open in Perplexity
  - Added a `View llms.txt` link below Keywords in `ComponentDetail.tsx`
  - Updated `convex/http.ts` link emission in `/api/markdown-index` and `/api/component-llms` to use shared URL builder
  - Verified with frontend build and TypeScript checks for app and Convex

- Keep markdown alias URL on Netlify domain (2026-02-27 12:00 UTC)
  - Replaced unreliable markdown rewrites with Netlify Edge Function routing for `/components/*/*.md`
  - Added `netlify/edge-functions/component-markdown.ts` to proxy alias paths to Convex markdown endpoint by slug
  - Removed client-side markdown alias redirect in router
  - Markdown alias now stays on `components-directory.netlify.app` while serving raw markdown

- Markdown alias route for component slugs in production (2026-02-27 12:00 UTC)
  - Added client-side alias support for `/components/<slug>/<slug>.md`
  - Route now redirects to Convex markdown endpoint: `/api/markdown?slug=<slug>`
  - Preserves working SPA routes and avoids rewrite collisions with admin/submissions paths

- Netlify SPA routing broken by greedy markdown proxy rules (2026-02-27 12:00 UTC)
  - Routes like `/components/submissions/admin` and `/components/browser-use-convex-component` were returning 404 with markdown content
  - Root cause: Netlify redirect patterns `:slug.md` and `:scope/:name.md` matched paths without `.md` extension
  - Replaced named-parameter markdown/llms redirects with explicit splat suffix rules:
    - `/components/*.md` -> `/api/markdown?slug=:splat`
    - `/components/*/llms.txt` -> `/api/component-llms?slug=:splat`
  - Main `/components/llms.txt` and `/components.md` routes still work
  - All SPA client-side routes now correctly serve index.html

- GitHub avatar URLs updated to use reliable CDN (2026-02-27 12:00 UTC)
  - Changed avatar URL format from `https://github.com/{username}.png` to `https://avatars.githubusercontent.com/{username}`
  - Fixes `ERR_HTTP2_SERVER_REFUSED_STREAM` errors when loading author avatars
  - Added `migrateAvatarUrls` admin mutation to fix existing records in database
  - Run migration via: `npx convex run packages:migrateAvatarUrls`

### Added

- Tremendous Rewards Integration PRD (2026-02-27 12:00 UTC)
  - Full product requirements document at `prds/tremendous-rewards-integration.md`
  - Defines Tremendous API integration for sending rewards to component submitters
  - Send Reward button spec for Admin Actions row (same row as Convex Verified, Regenerate SEO)
  - New `payments` table schema with order tracking and status
  - Package reward fields: `rewardStatus`, `rewardTotalAmount`
  - PaymentBadge in collapsed row header showing Paid/Failed status
  - RewardSettingsPanel with auto-send toggle and default amount config
  - Auto-send on approved + visible (optional admin setting)
  - Links to Tremendous API docs, Node SDK, and sandbox testing

### Changed

- Applied Convex return validator best practices to internal functions (2026-02-26 12:00 UTC)
  - Removed redundant `returns: v.null()` from internal mutations in `seoContentDb.ts` and `thumbnails.ts`
  - Removed `returns: v.union(v.null(), v.any())` from internal queries `_getPackage` and `_getPackageByName` in `packages.ts`
  - TypeScript inference now handles return types for internal functions (non-client-facing)
  - Fixed `ctx.db.patch` API usage bugs (was passing table name as first argument)
  - Fixed `ctx.db.get` API usage bugs (was passing table name before ID)
  - No behavioral changes; improves code clarity and follows updated Convex guidance

- AI Review Results panel collapsed by default in Admin dashboard (2026-02-26 12:00 UTC)
  - Entire panel now collapsed by default, showing only status icon, label, and date
  - Single toggle expands/collapses all content (summary, error, and criteria)
  - Reduces vertical space in package rows
  - Copy button still accessible on collapsed header row

- Removed user visibility controls from Profile page (2026-02-26 12:00 UTC)
  - Hide, Show, Delete, and Cancel Deletion buttons removed from user profile
  - Users must now contact admin via "Send Request" to manage component visibility
  - Reduces user confusion and prevents accidental visibility changes
  - Admin retains full visibility control via Admin dashboard
  - Code completely removed (not just hidden) so users cannot find controls in source

### Added

- Download Skill button for SKILL.md files on ComponentDetail page (2026-02-25 12:00 UTC)
  - Download button with Phosphor FileArrowDown icon next to Markdown dropdown in author row
  - Button only appears when SKILL.md has been generated (after SEO content generation)
  - SKILL.md section also includes both copy and download buttons
  - Downloads file as `SKILL.md` for easy saving to project

### Changed

- Directory sidebar sticky position adjusted (2026-02-25 12:00 UTC)
  - Changed sticky top from `top-6` to `top-20` (80px)
  - Submit button now remains visible below the header when scrolling
  - Entire sidebar (Submit, Search, Sort, Categories) stays sticky together

### Added

- SEO Prompt Settings panel in Admin Settings (2026-02-25 12:00 UTC)
  - View and customize the AI SEO/SKILL.md generation prompt
  - Edit prompt with save as new version (includes change notes)
  - Version history with timestamps and restore functionality
  - Reset to default prompt option
  - Custom prompts stored in database with version tracking
  - Uses placeholders like `{{displayName}}`, `{{packageName}}` for dynamic content
  - New `seoPromptVersions` table in schema for version tracking

- Multi-provider AI support across all AI features (2026-02-25 12:00 UTC)
  - Support for Anthropic Claude, OpenAI GPT, and Google Gemini in both AI Review and SEO Content generation
  - Provider selection prioritizes admin settings (AI Provider Settings panel), then falls back to environment variables (ANTHROPIC_API_KEY, CONVEX_OPENAI_API_KEY)
  - Both `convex/aiReview.ts` and `convex/seoContent.ts` use the same provider configuration
  - New `callAiProvider` helper function in both files for unified provider calls

- Confirmation modal for clearing AI provider settings (2026-02-25 12:00 UTC)
  - Clear (use env) buttons now show red styling to indicate destructive action
  - Clicking Clear shows confirmation modal warning that API keys will be deleted
  - Modal explains fallback to environment variables and that all AI features are affected
  - Prevents accidental deletion of API key configuration

- Moved Refresh and Generate Slug buttons to InlineActions component (2026-02-25 12:00 UTC)
  - Refresh npm data button now in Actions row of expanded package view
  - Generate Slug button in Actions row (only shows when package has no slug)
  - Removed standalone button components from package card row
  - Shows last refresh time and any refresh errors

- Admin Actions row in expanded package view (2026-02-25 12:00 UTC)
  - New "Actions" row above Status and Visibility rows in InlineActions panel
  - Convex Verified toggle button with teal styling (fill icon when verified)
  - Regenerate SEO + Skill button with loading spinner and completion indicator
  - Combined Auto-fill button that fills both author from GitHub and description from npm
  - Hide Thumbnail toggle (orange, only shows when thumbnail exists) for hiding in category but showing in Featured
  - Auto-fill runs both operations in parallel and reports what was filled in toast
  - All buttons use Phosphor icons and match existing Admin theme styling
  - Added useEffect hooks in ComponentDetailsEditor to sync author/avatar/verified fields from backend updates

- Hide from Submissions page feature for admin control (2026-02-25 12:00 UTC)
  - New `hideFromSubmissions` field on packages schema
  - Admin toggle button labeled "Sub Hide" / "Sub Hidden" in package row to differentiate from directory Hide
  - `listPackages` and `searchPackages` queries filter out hidden packages
  - Hidden packages still appear in Directory if approved (uses separate `listApprovedComponents`)
  - All admin features remain fully functional for hidden packages

- Featured components sort order for admin control (2026-02-25 12:00 UTC)
  - New `featuredSortOrder` field on packages schema for admin-managed ordering
  - Featured section in Directory respects admin sort order (lower numbers first)
  - Sort order input appears next to Featured toggle in Admin when package is featured
  - Dropdown sort (downloads, newest, etc.) only affects category sections, not Featured
  - Packages without sort order default to the end, sorted by newest first

- Hide thumbnail in category option for components (2026-02-25 12:00 UTC)
  - New `hideThumbnailInCategory` field on packages schema
  - Checkbox in Admin Component Details editor (appears when thumbnail exists)
  - Thumbnails always display in Featured section regardless of setting
  - Category, search, and other listings respect the hide flag
  - Added field to `directoryCardValidator` and query return maps for proper data flow
  - `ComponentCard` accepts `showThumbnail` prop for conditional rendering
  - Allows components to have thumbnails for Featured without cluttering category views

- Official Convex Components import system (2026-02-24 12:00 UTC)
  - `seedOfficialComponents` internal action for importing 41 components from convex.dev/components
  - `importAsPending` flag to import new components as "pending" for admin review
  - `dryRun` flag to preview imports without making changes
  - Preserves existing `reviewStatus` on updates, only sets new status on inserts
  - Added `browser-use` component (AI category) and synced with upstream source
  - Run: `npx convex run seed:seedOfficialComponents '{"importAsPending": true}'`
  - Production: `npx convex run --prod seed:seedOfficialComponents '{"importAsPending": true}'`

- Admin panel pagination with configurable items per page (2026-02-24 12:00 UTC)
  - Package list shows 20 items per page by default
  - Pagination controls with Previous/Next buttons and numbered page buttons
  - Items per page dropdown selector (5, 10, 20, 40, 100 options)
  - Each filter tab maintains independent page state
  - "Showing X-Y of Z" counter reflects current pagination
  - Page resets to 1 when changing filter or items per page

### Changed

- Reordered icons in Admin package rows (2026-02-24 12:00 UTC)
  - Moved ComponentDetailQuickLink (external link icon) to be last in the badge group
  - Order is now: StatusBadge, VisibilityBadge, UnrepliedNotesIndicator, ComponentDetailQuickLink
  - Keeps the external link icon before the downloads/date section on the far right

### Added

- LLMs.txt and Markdown clean URL support (2026-02-24 12:00 UTC)
  - `/components/llms.txt` serves main directory index for AI agents
  - `/components.md` serves markdown listing of all approved components
  - `/components/<slug>/llms.txt` serves per-component llms.txt
  - `/components/<slug>.md` serves per-component markdown
  - New `/api/markdown-index` endpoint for directory-wide markdown
  - New `/api/component-llms` endpoint for per-component llms.txt
  - Netlify redirects proxy clean URLs to Convex HTTP endpoints
  - Supports both single-segment and scoped package slugs

### Changed

- Moved Keywords section below Agent Skill (SKILL.md) section on ComponentDetail.tsx (2026-02-24 12:00 UTC)
  - Keywords tags now appear after the SKILL.md copyable snippet
  - Improves page hierarchy: SEO content > SKILL.md > Keywords

- Moved Markdown dropdown from sidebar to author row on ComponentDetail.tsx (2026-02-24 12:00 UTC)
  - Dropdown now appears in the same row as package name and author info
  - Separator added before dropdown for visual consistency
  - Same functionality: View as Markdown, Copy as Markdown, Copy page URL

- Commented out GitHub Issues feature on ComponentDetail.tsx (2026-02-24 12:00 UTC)
  - Issues badge button in author row commented out
  - Issues panel (open/closed tabs, issue list, load more) commented out
  - Feature preserved in code for future re-enabling

### Added

- Clear logo button in Component Details editor (2026-02-24 12:00 UTC)
  - Clear button appears next to download button when logo exists
  - Calls new `clearLogo` mutation to remove logo URL and storage reference
  - Matches existing clear thumbnail functionality
  - New `clearLogo` mutation in `convex/packages.ts`

### Fixed

- Fixed SubmitForm.tsx success modal button layout (2026-02-23 12:00 UTC)
  - Buttons now display horizontally side by side instead of stacked vertically
  - Added `flex-row` and `inline-flex` for proper alignment
  - Improved button spacing and font weight for better visual hierarchy

- Fixed SubmitForm.tsx sending tags as array instead of string (2026-02-23 12:00 UTC)
  - Backend `submitPackage` action expects `tags: v.optional(v.string())` (comma-separated)
  - SubmitForm.tsx was sending `.split(",").map(...).filter(...)` (array)
  - Changed to `tags.trim() || undefined` to match validator
  - Fixes "ArgumentValidationError: Value does not match validator" on component submission

### Added

- Enhanced SEO support for ComponentDetail pages (2026-02-24 12:00 UTC)
  - Twitter Card meta tags (summary_large_image with thumbnail)
  - Canonical URL tag for duplicate content prevention
  - og:site_name and og:image:alt tags for better sharing
  - New `setComponentSeoTags()` consolidated helper in seo.ts
  - New `setTwitterTags()` and `setCanonicalUrl()` functions

### Changed

- Updated index.html fallback meta tags (2026-02-24 12:00 UTC)
  - Fixed Twitter meta tags to use `name` attribute (was `property`)
  - Updated URLs to production domain (www.convex.dev/components)
  - Added twitter:image:alt for accessibility

### Added

- AI Provider Settings panel in Admin Settings (2026-02-23 12:00 UTC)
  - Configure Anthropic, OpenAI, or Google Gemini as AI provider
  - Override environment variables with custom API keys and models
  - Links to model documentation for each provider
  - Clear settings to revert to environment variable defaults
  - Active provider indicator badge

- AI Prompt Settings panel in Admin Settings (2026-02-23 12:00 UTC)
  - View and customize the AI review prompt
  - Edit prompt with save as new version
  - Version history with timestamps and change notes
  - Restore any previous prompt version
  - Reset to default prompt option
  - Custom prompts stored in database with version tracking

- New database tables for AI configuration (2026-02-23 12:00 UTC)
  - `aiProviderSettings`: stores API keys and models for each provider
  - `aiPromptVersions`: stores prompt versions with history

- Multi-provider AI support in aiReview.ts (2026-02-23 12:00 UTC)
  - Support for Anthropic Claude, OpenAI GPT, and Google Gemini
  - Provider selection prioritizes custom settings, then env vars
  - Custom prompt support with fallback to default

### Changed

- Commented out "Add badge to your README" section on ComponentDetail.tsx (2026-02-23 12:00 UTC)
  - Badge snippet UI hidden until badge endpoint is working
  - Badge markdown line in buildMarkdownDoc also commented out
  - Can be re-enabled later when badge feature is ready

### Added

- Auto-fill description button in Component Details editor (2026-02-23 12:00 UTC)
  - "Auto-fill from Package" button next to Long Description field
  - Copies description from Package Metadata to Long Description for editing
  - Only shown in admin mode when package has a description
  - Button click populates field and shows success toast

### Fixed

- Fixed production legacy GitHub OAuth authentication failing with "Missing sign-in verifier" error (2026-02-23 12:00 UTC)
  - Updated the legacy auth package to resolve verifier handling
  - Configured GitHub OAuth callback URL to point to Convex backend (`https://giant-grouse-674.convex.site/api/auth/callback/github`)
  - Generated and set JWT signing keys for production deployment via the legacy auth CLI
  - Set `SITE_URL` to `https://components-directory.netlify.app/components` for correct post-auth redirect
  - Documented fix in `prds/authfix-2026-02-23.md`

### Changed

- Router now redirects any path without `/components` prefix to the prefixed version (2026-02-23 12:00 UTC)
  - `/dodo` redirects to `/components/dodo`
  - `/submit` redirects to `/components/submit`
  - Ensures consistent URL structure for both local development and production

### Added

- Site footer with Convex links (2026-02-23 12:00 UTC)
  - Footer component at `src/components/Footer.tsx`
  - Convex wordmark logo (40px height) on the left side linking to convex.dev
  - GitHub repo (get-convex/convex-backend) and Discord links on the right side
  - 50px top padding above footer
  - Responsive layout (stacks on mobile, side by side on desktop)
  - Added to global layout in `src/main.tsx`

### Changed

- Moved FAQSection from Submit.tsx to Directory.tsx (2026-02-23 12:00 UTC)
  - FAQ section now displays below component cards on the main directory page
  - Removed FAQSection import and usage from submissions page
  - Updated FAQ heading font to `font-semibold` to match "Components" section heading

- Expanded FAQSection to 8 questions (2026-02-23 12:00 UTC)
  - Added: How are components sandboxed? (Convex runtime data isolation)
  - Added: What projects should use Components? (check component docs)
  - Added: Do components cost money to use? (open source, usage-based)
  - Updated: Can I build my own? (now mentions other developers can drop into any project)
  - Updated: What happens after I submit? (added authoring guidelines link)
  - Updated `prds/faq-questions.md` to match component content

### Fixed

- Fixed user email not appearing in profile/submissions after legacy GitHub OAuth login (2026-02-23 12:00 UTC)
  - Legacy auth stored user data in database, not JWT claims
  - Added user id lookup helper import in `convex/auth.ts`
  - Updated `loggedInUser` query to fetch user from database with the legacy helper
  - Updated `isAdmin` query to use database lookup for email check
  - Updated `requireAdminIdentity` and `getAdminIdentity` helpers to use database lookup
  - Added `getCurrentUserEmail` helper function in `convex/packages.ts`
  - Updated all 15+ queries/mutations in packages.ts that used `ctx.auth.getUserIdentity()` for email
  - User submissions now correctly match by email from the users table
  - Profile page shows user info and their submissions
  - Admin page correctly identifies `@convex.dev` admins

### Changed

- Migrated authentication to a prior legacy GitHub OAuth stack (2026-02-23 12:00 UTC)
  - Replaced the previous auth integration with a GitHub OAuth based stack
  - Removed unused legacy dependency from the old provider
  - Updated `convex/auth.ts` to use provider based OAuth wiring
  - Created `convex/auth.config.ts` for JWT provider configuration (domain and applicationID)
  - Deleted `convex/convex.config.ts` (not needed for that legacy auth stack)
  - Deleted `convex/auth/session.ts` (legacy compatibility cleanup)
  - Updated `convex/http.ts` to use `auth.addHttpRoutes(http)`
  - Updated `convex/schema.ts` to include legacy auth tables
  - Updated `src/main.tsx` with legacy auth provider wiring
  - Updated `src/lib/auth.tsx` with legacy auth action hooks and `useConvexAuth`
  - Added redirect logic in Router for paths not starting with `/components`
  - Admin access pattern preserved: `@convex.dev` email check via `isAdmin` query and `requireAdminIdentity` helper
  - Environment variables set in Convex Dashboard for legacy GitHub OAuth and JWT signing
  - OAuth callback URL: `https://<deployment>.convex.site/api/auth/callback/github`
  - Added `jose` dev dependency for JWT key generation
  - Restored `as any` type casts in `convex/crons.ts` and `convex/http.ts` to work around deep type instantiation errors

### Added

- SKILL.md generation for AI agent integration (2026-02-23 12:00 UTC)
  - AI SEO content generation now also generates SKILL.md content for Claude agent skills
  - SKILL.md follows the Agent Skills specification with YAML frontmatter and Markdown body
  - Content includes component description, installation, usage patterns, key features, and API reference
  - Copyable SKILL.md snippet displayed on ComponentDetail.tsx above the badge section
  - "SKILL.md generated" status indicator in ComponentDetailsEditor.tsx
  - Button text updated to "Generate SEO + Skill" / "Regenerate SEO + Skill"
  - New `skillMd` field added to packages schema
  - `buildSkillMd()` helper function in `convex/seoContent.ts`
  - Public queries now include `skillMd` field for frontend access

### Changed

- Migrated from Convex self-hosting to Netlify hosting (2026-02-23 12:00 UTC)
  - Removed `@convex-dev/self-hosting` dependency from `package.json`
  - Simplified `convex/convex.config.ts` to basic app definition
  - Removed `registerStaticRoutes()` from `convex/http.ts`
  - Deleted `.env.production` (use Netlify Dashboard environment variables instead)
  - App now deployed at `https://components-directory.netlify.app`

- Updated Vite and Netlify configuration for SPA routing (2026-02-23 12:00 UTC)
  - Changed `vite.config.ts` to use `base: "/"` (assets served from root)
  - Updated `netlify.toml` with redirect from `/` to `/components` (301)
  - Added SPA fallback redirects for `/components` and `/components/*` to `/index.html` (200)
  - Router in `src/main.tsx` strips `/components` prefix for route matching
  - Updated `.env.local` redirect URI to `http://localhost:5173/components/callback`
  - Production routes: `/components`, `/components/submit`, `/components/profile`, `/components/submissions`, `/components/submissions/admin`, `/components/:slug`

- WorkOS callback URLs updated (2026-02-23 12:00 UTC)
  - Development: `http://localhost:5173/components/callback`
  - Production: `https://components-directory.netlify.app/components/callback`

### Added

- Slug Migration Tool for admin dashboard (2026-02-23 12:00 UTC)
  - New SlugMigrationPanel in Admin Settings tab to identify and fix packages without URL slugs
  - Displays count and list of packages missing slugs
  - "Generate All Slugs" button to bulk generate slugs for all packages missing them
  - Individual "Generate" button per package in the migration panel
  - "Generate Slug" button on package cards (orange, shown only when slug is missing)
  - Button appears next to npm/repo/demo/refresh buttons
  - Uses existing `generateSlugFromName()` logic from submission flow
  - After generation, slug is editable in Component Details editor
  - New backend functions: `getPackagesWithoutSlugs` (query), `generateSlugForPackage` (mutation), `generateMissingSlugs` (mutation)

### Added

- Admin "Marked for Deletion" filter tab (2026-02-23 12:00 UTC)
  - New "Deletion" tab in Admin filter bar to show all packages pending deletion
  - Tab displays count of packages marked for deletion
  - Package rows in admin show red "Deletion" badge next to visibility badge when marked

### Fixed

- ComponentDetailsEditor now reactively syncs slug field with backend updates (2026-02-23 12:00 UTC)
  - Added `useEffect` hook to sync local slug state when `initialSlug` prop changes
  - Slug now appears immediately after clicking "Generate Slug" button without needing refresh
  - Matches existing reactive behavior for thumbnail, logo, and template fields
- Soft deletion workflow for components (2026-02-23 12:00 UTC)
  - Users mark components for deletion instead of immediate deletion
  - Components marked for deletion are hidden from directory immediately
  - Admin can permanently delete marked components from Settings panel
  - Scheduled cron job runs daily at 2 AM UTC to auto-delete after waiting period
  - Configurable auto-delete toggle and waiting period (1, 3, 7, 14, or 30 days)
  - Users can cancel deletion request before admin processes it
  - "Pending Deletion" badge shown on marked components in profile (next to visibility badge)
- Account deletion requires deleting all components first (2026-02-23 12:00 UTC)
  - Delete Account modal shows warning if user has active submissions
  - User must delete all components before deleting their account
  - Clear guidance in Account section and modal
- Admin Deletion Management panel in Settings (2026-02-23 12:00 UTC)
  - Toggle for auto-delete marked packages
  - Configurable waiting period (days)
  - List of packages pending deletion with "Delete Now" option
  - Info about the scheduled cleanup cron job
- Header redesign with floating pill style (2026-02-23 12:00 UTC)
  - Floating pill design with `rounded-full`, white/95 background, backdrop blur, and shadow
  - Convex wordmark black SVG logo (70px height)
  - Added GitHub, Discord, and Docs icons to header navigation
  - Navigation links (Directory, Submissions, Submit) with medium font weight
  - Removed user email from profile dropdown
  - Header height set to 3.438rem
  - Mobile menu redesigned as separate dropdown card below header pill (rounded-2xl)
- SubmitForm.tsx layout improvements (2026-02-23 12:00 UTC)
  - Removed "Back to Directory" breadcrumb link
  - Moved "Submit a Component" title above the form box to match Profile.tsx style
  - Description text remains inside the form box
- FAQSection reusable component (2026-02-22 12:00 UTC)
  - Extracted from SubmitForm.tsx into `src/components/FAQSection.tsx`
  - Added to bottom of Submit.tsx (submissions directory) page
  - Expanded FAQ content: sandboxing, review process, requirements, building components, pricing, docs links
- Page layout alignment improvements (2026-02-22 12:00 UTC)
  - Submit.tsx page width now matches Directory.tsx (`max-w-7xl`)
  - SubmitForm.tsx page width now matches Profile.tsx (`max-w-3xl`)
  - Submit.tsx title styling aligned with Directory.tsx
  - Search input background changed to white on Submit.tsx
- Convex self-hosting integration for deploying the React app at `giant-grouse-674.convex.site` (2026-02-22 12:00 UTC)
  - Installed `@convex-dev/self-hosting` component for static file serving
  - Added `convex/convex.config.ts` to register the self-hosting component
  - Added `convex/staticHosting.ts` to expose upload APIs for the CLI
  - Updated `convex/http.ts` with `registerStaticRoutes()` for SPA fallback (preserves all existing API routes)
  - Updated `vite.config.ts` with environment-aware base path (`SELF_HOST=true` uses `/`)
  - Added `deploy` and `deploy:static` npm scripts for one-shot deployment
- Auto sign-in redirect for `/submit` page (2026-02-22 12:00 UTC)
  - Unauthenticated users visiting `/submit` are now automatically redirected to WorkOS sign-in
  - After authentication, users are returned to `/submit` to complete their submission
  - No longer requires clicking "Sign in to Submit" button first
- Mark as read notification system
  - `adminHasRead` field on `packageNotes` for admin read tracking
  - `adminHasRead` field on `packageComments` for admin read tracking
  - `markNotesAsReadForAdmin` mutation to mark user notes as admin-read
  - `markCommentsAsReadForAdmin` mutation to mark comments as admin-read
  - `getUnreadUserNotesCount` query for unread user notes count
  - `getUnreadCommentsCount` query for unread comments count
  - Auto-mark as read when admin opens Notes or Comments panels
  - "Mark all read" button in Notes and Comments panel headers
  - Unread count badges on Notes button (blue) and Comments button (blue)
  - User Profile Messages modal shows unread count with "Mark all read" button
- User profile enhancements
  - Edit submission modal for users to update their own submissions
  - Hide/show visibility controls with confirmation modals
  - Delete submission functionality with confirmation
  - Visibility guide section in status guide
- `additionalEmails` field on packages schema for multi-account access
- `setMySubmissionVisibility` mutation for users to hide/show their submissions
- `requestDeleteMySubmission` mutation for users to delete their submissions
- `updateMySubmission` mutation for users to edit submission fields
- `getMySubmissionForEdit` query to fetch editable submission data
- `updateSubmitterEmail` admin mutation for changing primary submitter email
- `updateAdditionalEmails` admin mutation for managing multi-account access
- `SubmitterEmailEditor` component in Admin panel for editing submitter emails
- `userOwnsPackage` helper function for checking ownership via submitterEmail or additionalEmails
- Shared `Header` component (`src/components/Header.tsx`) with auth state, navigation, and user menu
- `FAQSection` component (`src/components/FAQSection.tsx`) for reusable FAQ display

### Changed

- Header.tsx redesigned with white background, Convex wordmark logo, and social icons (2026-02-22 12:00 UTC)
- Submit.tsx page layout aligned with Directory.tsx width and styling (2026-02-22 12:00 UTC)
- SubmitForm.tsx page width aligned with Profile.tsx (2026-02-22 12:00 UTC)
- FAQSection expanded with additional questions about sandboxing, pricing, and building components (2026-02-22 12:00 UTC)

- `SubmitForm.tsx` now auto-triggers sign-in flow when accessed by unauthenticated users
  - Replaced sign-in gate UI with "Redirecting to sign in..." loading state
  - `useEffect` hook stores return path in localStorage and calls `signIn()` automatically
  - `AuthCallback` component reads stored path and redirects back after authentication
- `getMySubmissions` query now checks both submitterEmail and additionalEmails for user access
- Profile page: removed duplicate "My Submissions" header and "Submit New" button
- Profile page: added Edit, Hide/Show, and Delete buttons to submission cards
- Profile page: status guide now includes visibility states (Visible, Hidden, Archived)
- Admin panel: submitter info section replaced with editable `SubmitterEmailEditor` component
- Admin panel: `additionalEmails` field now included in admin package data
- Admin dashboard route changed from `/submit/admin` to `/submissions/admin`
- Admin page sign-in prompt simplified to "Admin access only" (removed @convex.dev email mention)
- Non-admin users visiting `/submissions/admin` are now automatically redirected to `/profile` instead of seeing an "Access Denied" message
- Global navigation with Directory, Submit, and Docs links across all pages
- User menu in header showing avatar, email, My Submissions link, and Sign Out button
- Consistent auth flow across all pages using shared Header component
- `SubmitForm.tsx` dedicated submission page (replaced `Submit.tsx` modal approach)
- Sign-in gate for unauthenticated users on Submit page
- WorkOS AuthKit authentication replacing the legacy auth stack for convex.dev unified login experience
- User profile page at `/profile` for managing submitted components
- Submissions link in header navigation pointing to `/submissions`
- `getMySubmissions` query to fetch packages by authenticated user's email
- `requestSubmissionRefresh` mutation for users to send notes to admin team (request re-review, removal, updates)
- `by_submitter_email` index on packages table for efficient user submission lookups
- OAuth callback component that waits for AuthKit session before redirecting to `/submit`
- Submission checklist in Submit page with 3 checkboxes (FAQ acknowledgment, Authoring Components compliance, permission to share)
- FAQ section on Submit page with 4 questions about review process, requirements, post-submission flow, and learning resources
- Terms of Service and Privacy Policy links on Submit page
- Architecture overview document with mermaid diagrams (`prds/architecture-overview.md`) for team documentation

### Changed

- Refactored auth flow: Submit page now requires authentication (dedicated form page instead of modal)
- All pages now use shared Header component for consistent navigation and auth UI
- Directory page (`/`) publicly accessible without auth, has shared Header
- Component detail pages (`/:slug`) publicly accessible without auth, has shared Header
- Profile page (`/profile`) requires auth, shows user's own submissions with management options
- Route reorganization: `/submissions` for public table directory, `/submit` for auth-gated form
- Submit.tsx (table directory) moved to `/submissions` route with Header added
- SubmitForm.tsx: checkboxes now inside form above submit button, button disabled until all checked
- Admin page (`/submit/admin`) requires @convex.dev email, has shared Header with admin search bar
- 404 page now includes shared Header for consistent UX
- Authentication migrated from the legacy auth stack to WorkOS AuthKit (`@workos-inc/authkit-react` and `@convex-dev/workos`)
- `convex/auth.config.ts` now configures WorkOS custom JWT providers for token validation
- Admin authorization now uses `ctx.auth.getUserIdentity()` instead of legacy user id table lookup
- `vite.config.ts` base path now dynamic: `/` for local dev, `/components/` for production
- Removed `SignInForm.tsx` and `Submit.tsx` (modal approach replaced with dedicated page)
- `SignOutButton.tsx` updated to use WorkOS `signOut()`
- Logo upload on submit form (png, webp, svg) replacing the previous 16:9 thumbnail upload
- Sign-in buttons now call `signIn()` directly per Convex WorkOS docs (removed `getSignInUrl()` workaround)
- AuthKit configuration now uses `VITE_WORKOS_REDIRECT_URI` env variable instead of computed redirect

### Fixed

- Sign-in flow now properly redirects to WorkOS hosted login page
- OAuth callback no longer redirects prematurely before session is established
- Profile page sign-in button now works correctly

### Technical Details

- Legacy auth tables (`authSessions`, `authAccounts`, `authRefreshTokens`, etc.) preserved in schema during migration
- Admin identity helpers (`requireAdminIdentity`, `getAdminIdentity`) now use `auth.user.current()` and `auth.user.get()` to check `@convex.dev` email
- Legacy GitHub OAuth environment variables were required in Convex dashboard during earlier auth phases
- Legacy JWT signing keys were generated via a prior auth CLI flow
- `SITE_URL` environment variable required for OAuth redirect (production: `https://components-directory.netlify.app`)
- GitHub OAuth App callback URL: `https://<deployment>.convex.site/api/auth/callback/github`
- Admin thumbnail template management panel: upload, enable/disable, set default, delete background templates
- Auto-generate thumbnail toggle in admin settings: when enabled, composites user logo onto default template on submission
- Thumbnail generation action using Jimp and resvg-wasm for server-side 16:9 image composition with SVG support
- Logo management section in `ComponentDetailsEditor`: upload/replace logo, download, and generate thumbnail from template picker
- Batch regenerate all thumbnails button in admin template panel
- `thumbnailTemplates` table for admin-managed background images with safe area fields
- `thumbnailJobs` table for tracking generation status and history
- Schema fields on packages: `logoStorageId`, `logoUrl`, `selectedTemplateId`, `thumbnailGenerationVersion`, `thumbnailGeneratedAt`, `thumbnailGeneratedBy`
- Weekly cron job to clean up failed thumbnail jobs older than 7 days
- Admin thumbnail clear button in `ComponentDetailsEditor` so editors can remove an existing thumbnail before saving

## [2.2.0] 2026-02-13

### Added

- AI-generated SEO/AEO/GEO structured content layer for component detail pages
- Five content blocks per component: value prop, benefits, use cases, FAQ, and resource links
- Anthropic Claude integration in `convex/seoContent.ts` to generate structured content from submitted component data
- Dual JSON-LD schema (`SoftwareSourceCode` + `FAQPage`) on detail pages for Google rich results
- `/api/llms.txt` HTTP endpoint for AI agent discovery of the full component index
- Enhanced `/api/markdown` endpoint with AI-generated SEO sections (benefits, use cases, FAQ, resources)
- `SeoAccordion` component on `ComponentDetail.tsx` for collapsible use cases and FAQ sections
- `buildComponentJsonLd()` helper in `seo.ts` for dual `@graph` structured data
- SEO generation button and status display in admin `ComponentDetailsEditor`
- Auto-trigger: SEO content generates automatically when a package is approved for the first time
- `regenerateSeoContent` public action for admin-triggered content regeneration

### Changed

- Schema: added 8 new optional fields to packages table (`seoValueProp`, `seoBenefits`, `seoUseCases`, `seoFaq`, `seoResourceLinks`, `seoGeneratedAt`, `seoGenerationStatus`, `seoGenerationError`)
- Public and admin package validators updated to include SEO content fields
- `ComponentDetail.tsx` meta description now prefers AI-generated value prop over short description
- `updateReviewStatus` mutation now schedules SEO generation on first approval

## [2.1.0] 2026-02-13

### Added

- GitHub Issues integration on component detail pages
- Issues badge next to author showing open issue count from the component's GitHub repository
- Tabbed issues panel (Open/Closed) that renders below the install command when clicked
- Each issue links directly to GitHub in a new tab with title, author, date, labels, and comment count
- Paginated issue loading with "Load more" button
- Cached GitHub issue counts in database (refreshed hourly) for instant display on page load
- `fetchGitHubIssues` action to fetch issues from GitHub REST API (supports optional GITHUB_TOKEN env var for higher rate limits)
- `refreshGitHubIssueCounts` action to fetch and cache open/closed counts using GitHub Search API
- JSON-LD structured data (SoftwareSourceCode schema) on detail pages for SEO/AEO/GEO
- `injectJsonLd()` helper in seo.ts for managing structured data script tags

### Changed

- Schema: added `githubOpenIssues`, `githubClosedIssues`, `githubIssuesFetchedAt` fields to packages table
- Public and admin package validators updated to include GitHub issue count fields

## [2.0.0] 2026-02-12

### Added

- Convex Components Directory: full public-facing directory at /components/ with category sidebar, search, sort, featured section, and component cards
- Component detail pages at /components/:slug with sidebar metadata layout, thumbnail, install command, and markdown rendering
- Dynamic SVG badge service at /api/badge?slug=X for component README badges
- Badge analytics tracking via badgeFetches table
- Markdown HTTP endpoint at /api/markdown?slug=X serving raw markdown for agents, LLMs, and tools
- Share dropdown on detail pages with View as Markdown, Copy as Markdown, and Copy page URL
- Markdown source view with copy button on component detail pages
- Component thumbnail upload (Convex file storage) in both admin editor and public submission form
- Auto-fill author info from GitHub repository URL in admin editor
- Convex Verified badge display on component cards and detail pages
- Component seed script for migrating existing components into the directory
- Client-side slug generation for URL-safe component names (handles scoped packages)
- Server-side slug generation helper in packages.ts
- SEO meta tags (title, description, Open Graph) on component detail pages
- Category system with 7 categories (AI, Auth, Backend, Database, Durable Functions, Integrations, Payments)
- New schema fields: slug, category, tags, shortDescription, longDescription, videoUrl, thumbnailUrl, thumbnailStorageId, convexVerified, authorUsername, authorAvatar, relatedComponentIds
- New indexes: by_slug, by_category, by_category_and_visibility
- New pages: Directory.tsx, ComponentDetail.tsx, NotFound.tsx
- New components: ComponentCard.tsx, CategorySidebar.tsx, SearchBar.tsx, VerifiedBadge.tsx, InstallCommand.tsx, ComponentDetailsEditor.tsx
- New lib files: categories.ts, slugs.ts, seo.ts
- Submit form now collects category, short/long descriptions, tags, video URL, and thumbnail
- Submit modal auto-opens when navigating to /submit?submit=true from directory sidebar
- Admin thumbnail preview in package list rows
- Vite base path set to /components/ for convex.dev deployment

### Changed

- Component detail page sidebar widened to 280px to match reference design
- Thumbnail moved from main content to sidebar top, sized to fit sidebar width
- npm "View package" link now uses official npm SVG logo instead of inline red badge
- Category tag redesigned: bordered pill with uppercase monospace text matching reference
- Back to Components link and title moved to full-width top section above the 2-column layout
- Install command and content area positioned below the 2-column sidebar section
- Frontend restructured into src/pages/ and src/components/ directories
- Client-side router updated with pathname-based routing for /, /submit, /submit/admin, and /:slug
- getComponentBySlug query relaxed to show non-approved packages with slugs (only hides hidden/archived)
- Dropdown and input styling updated to use bg-bg-primary and focus:ring-1 focus:ring-button
- Removed non-existent border-border-primary classes throughout UI

## [1.3.11] 2026-01-26

### Changed

- Rewrote README.md to focus on the Convex Components Challenge
- Added challenge categories (Auth/Identity, AI/Agent Infrastructure, Analytics, API Usage, Content Management, Full-Stack Drop-In Features, Storage, Third-Party Sync)
- Added rewards section (featured placement, $100+ gift card, swag)
- Added links to component documentation (authoring, understanding, using, submit)
- Added link to GitHub project board for challenge details
- Removed previous application-focused documentation

## [1.3.10] 2025-01-17

### Fixed

- NPM refresh now preserves existing repositoryUrl and homepageUrl instead of overwriting with npm data
- Single package refresh now properly updates lastRefreshedAt timestamp
- AI review now handles various GitHub URL formats (git+ prefix, trailing slashes, branch paths)

### Added

- Monorepo package discovery for AI review: automatically detects packages in `packages/<name>/` directories
- AI review now finds convex.config.ts in monorepo structures like `packages/<name>/src/component/`
- Debug logging for AI review to help troubleshoot repository parsing issues

### Technical Details

- Updated `refreshNpmData` action to query existing package data and preserve URLs
- Updated `_refreshPackageBatch` internal action to also preserve URLs during batch refresh
- Improved URL normalization in `fetchGitHubRepo` to handle git+, .git suffix, trailing slashes, tree/blob paths, and hash fragments
- AI review now queries GitHub packages directory to discover monorepo subdirectories dynamically

## [1.3.9] 2025-01-08

### Added

- Copy button on AI review results panel to copy formatted review for Notion
- Copied content includes: package name, status, maintainers, npm URL, GitHub URL, summary, and criteria checklist
- Uses Notion-friendly markdown format with checkboxes for criteria

## [1.3.8] 2025-01-08

### Changed

- Changed aiReview.ts model to claude-opus-4-5-20251101

## [1.3.7] 2025-01-08

### Removed

- Removed "Indexes follow naming convention" criterion from AI review checks
- This criterion was non-critical and added unnecessary noise to review results

### Changed

- AI review now validates against 9 criteria (5 critical, 4 non-critical) instead of 10
- Updated admin panel settings explanation to reflect the removed criterion
- Updated all documentation (aicheck.md, howitworks.md, files.md, README.md, task.md)

## [1.3.6] 2025-12-05

### Documentation

- Updated `.cursor/rules/sec-check.mdc` with comprehensive security guidelines for Convex apps
- Added Row-Level Security (RLS) section with convex-helpers patterns for read/modify/insert rules
- Added AI-Assisted Development Security section for vibe coding with Cursor/Copilot
- Added Convex Auth Token Security section for XSS prevention and refresh token protection
- Added Dependency and Supply Chain Security section for npm audit and version locking
- Added Error Handling Security section for generic error messages
- Enhanced security checklist with RLS, AI-assisted development, token security, and dependency checks

### Technical Details

- Security guidelines reference: [stack.convex.dev/row-level-security](https://stack.convex.dev/row-level-security)
- Added wrapDatabaseReader and wrapDatabaseWriter patterns from convex-helpers
- Added default deny policy configuration for strict RLS
- Added prompting guidance for secure AI-generated code
- Added Cursor rules configuration for enforcing security patterns

## [1.3.5] 2025-12-04

### Security

- Fixed data exposure vulnerability: public queries now strip all PII (submitter email, name, Discord) before returning data to clients
- AI review details (summary, criteria, errors) excluded from public responses; only status field (pass/fail/partial) is exposed
- Created internal queries (`_getPackage`, `_getPackageByName`) for backend operations that need full data access
- Public queries now use explicit return validators to enforce safe data shapes
- Renamed `reviewerEmail` field to `reviewedBy` for clarity; AI actions now use "AI" identifier instead of fake email format

### Technical Details

- Added `toPublicPackage()` helper function to strip sensitive fields from query responses
- Added `publicPackageValidator` for type-safe public query returns
- Updated `listPackages`, `searchPackages`, `getPackage`, `getPackageByName` to return sanitized data
- AI review action (`runAiReview`) now uses internal query for full package data access
- Backend mutations (`submitPackage`, `refreshNpmData`) now use internal queries
- Updated security guidelines in `.cursor/rules/sec-check.mdc` with AI system recommendations

## [1.3.4] 2025-12-02

### Fixed

- External links (npm, repo, website, demo) now open in new tabs even when app is embedded in an iframe
- Thank you success modal now displays correctly after package submission (fixed z-index layering)

### Added

- Email privacy notice in submit form: "Not displayed publicly. Used by the Convex team to contact you about your submission."

### Technical Details

- Changed external link buttons to use `window.open()` with `onClick` handlers instead of relying solely on `target="_blank"` for iframe compatibility
- SuccessModal now uses maximum z-index (2147483647) matching the submit modal for iframe support
- Submit modal form is hidden when success modal is displayed to prevent layering issues

## [1.3.3] 2025-12-02

### Changed

- Simplified frontend layout: removed header (Convex logo, GitHub icon, Start Building button) and footer
- Moved toolbar controls (info icon, search, sort dropdown, submit button) directly above package listing
- Title "Components npm Submissions Directory" now displays inline with controls
- Submit modal opens at top of page instead of center for better iframe support
- About modal opens at top of page for consistency
- Submit modal uses maximum z-index (2147483647) to ensure it appears on top in iframes
- Admin page: removed breadcrumb navigation, shows only "Admin" text
- Admin page: moved status legend below Stats section, removed footer
- Improved mobile responsiveness for compact toolbar layout

### Technical Details

- Frontend App.tsx restructured with compact toolbar above Content component
- Modal positioning changed from `items-center` to `items-start` with top padding
- Admin.tsx StatusLegend component moved inside AdminDashboard below Stats
- Removed Footer component from Admin page

## [1.3.2] 2025-11-30

### Added

- Admin NPM data refresh button to pull latest package information from npm
- ArrowClockwise icon button in admin panel for each package
- Refresh updates version, downloads, description, license, maintainers without affecting review status or submitter info

### Technical Details

- Added `refreshNpmData` action in `convex/packages.ts` to fetch fresh npm data for a specific package
- Added `updateNpmData` mutation to patch only npm-sourced fields while preserving admin data
- Updated `prds/howitworks.md` with refresh feature documentation

## [1.3.1] 2025-11-29

### Changed

- Simplified Vite configuration with hardcoded base path for deployment
- Updated base path toggle for localhost vs convex.dev deployment

## [1.3.0] 2025-11-28

### Added

- AI Review feature for validating npm packages against Convex component specifications
- AI Review button in admin panel to trigger automated code analysis
- AI Review status badges (passed, failed, partial, reviewing, error)
- AI Review results panel with expandable criteria checklist
- Admin settings panel with auto-approve and auto-reject toggles
- AI Review documentation referencing official Convex docs
- Support for analyzing GitHub repositories with convex.config.ts detection
- 9 criteria checklist for Convex component validation
- Admin settings table for AI automation preferences
- Expanded convex.config.ts detection for various component structures
- Live demo URL field for package submissions (optional but suggested)
- Demo link button in package details and admin panel

### Technical Details

- Added `convex/aiReview.ts` with runAiReview action using Anthropic Claude API
- Added AI review fields to packages schema (aiReviewStatus, aiReviewSummary, aiReviewCriteria, aiReviewedAt, aiReviewError)
- Added adminSettings table for auto-approve/reject configuration
- Added `updateAiReviewStatus` and `updateAiReviewResult` mutations
- Added `getAdminSettings` query and `updateAdminSetting` mutation
- GitHub API integration for fetching component source files
- Supports multiple convex.config.ts locations: convex/src/component/, convex/component/, convex/, src/component/, src/, root, packages/, lib/
- Added demoUrl field to packages schema and submission form

## [1.2.0] 2025-11-28

### Added

- About modal with app description and status legend explanations
- About link (info icon) in header next to app title
- Featured status for packages (only approved packages can be featured)
- Star icon display for featured packages with tooltip
- Status legend bar above footer with grid background pattern
- Featured toggle button in admin panel with Star icon
- Public comments system visible on frontend package details

### Changed

- Updated app title to "components npm submissions directory" (lowercase styling)
- Removed login/signup options from public frontend header (admin authentication via /admin route only)
- Featured packages now highlighted on convex.dev/components
- Admin footer legend updated to include Featured status
- Simplified About modal footer (removed instruction text)

### Technical Details

- Added `featured` field to packages schema
- Added `toggleFeatured` mutation with approval check
- Updated query return validators to include featured field
- Improved admin inline actions with Featured toggle

## [1.1.0] 2025-11-28

### Added

- Review status system with five states (pending, in_review, approved, changes_requested, rejected)
- Visibility control system (visible, hidden, archived)
- Package notes system with threaded replies for admin use
- Public comments system for packages visible on frontend
- Submitter information collection (name, email, optional Discord username)
- Admin package notes panel with reply functionality
- Note count badges on admin package table
- Review status filtering in admin dashboard
- Inline action buttons for review status and visibility changes
- Phosphor icons replacing emojis throughout the application
- Custom modal components for confirmations and alerts
- Keyboard shortcuts (Cmd+K for search focus)
- Enhanced admin search across all packages regardless of visibility
- Public search filtering to only show visible packages

### Changed

- Replaced emoji icons with Phosphor icons throughout the application
- Package submissions now collect submitter information (name, email, Discord)
- Public package listings filter out hidden and archived packages
- Admin dashboard defaults to showing pending submissions
- Search functionality expanded to include package descriptions
- Review status workflow integrated into admin interface

## [1.0.0] 2025-11-28

### Added

- Initial project setup with Chef and Convex
- Package submission functionality via npm URL
- Automatic package metadata fetching from npm registry
- Package listing with search and sort capabilities
- Expandable package cards with detailed information
- Admin dashboard for @convex.dev email addresses
- CSV export functionality for all packages
- Authentication system with Password and Anonymous providers
- Real-time package updates using Convex queries
- Full-text search on package names and descriptions
- Package statistics display (downloads, size, files)
- Maintainer information with Gravatar avatars
- Copy-to-clipboard install command
- Loading states and skeleton screens
- Toast notifications for user feedback
- Responsive design with Tailwind CSS
- Type-safe Convex functions with validators
- Database indexes for performance optimization
- HTTP endpoint for CSV export
- Admin access control based on email domain

### Technical Details

- Built with React 19 and TypeScript
- Backend powered by Convex with real-time reactivity
- Styled with Tailwind CSS and custom design system
- Authentication via Convex Auth (submissions don't require login)
- Package data fetched from npm Registry API and npm Downloads API
- Database schema with indexes for name lookup, date sorting, review status filtering, visibility filtering, and full-text search on name and description
- Package notes table with threading support via parent note references
- Package comments table for public comments
- HTTP routes for CSV export functionality
- Development workflow with Chef AI assistance
- Configured for Netlify deployment
- Phosphor Icons library for consistent iconography
