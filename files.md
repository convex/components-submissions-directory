# Files Overview

This document provides a brief description of each file in the codebase and how it works.

## Root Configuration Files

### `package.json`

Defines project dependencies, scripts, and metadata. Includes React, Convex, Vite, TypeScript, WorkOS Connect integration utilities, and development tools. Key scripts:
- `dev`: Parallel dev server (frontend + backend)
- `build`: Production build for Netlify
- `lint`: Type-checks `convex/` and the app (`tsc -b`), then runs `convex dev --once` and `vite build`
- `deploy:backend`: Deploy Convex backend only (`npx convex deploy`)

Key auth dependencies: `@convex-dev/workos` for Convex auth bridging with a custom Connect OAuth provider.

### `package-lock.json`

Committed npm lockfile (no longer gitignored as of upstream #47), so `npm install` resolves the same dependency tree for everyone.

### `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`

TypeScript configuration files for different parts of the project. `tsconfig.app.json` is for the React app and `tsconfig.node.json` is for Node.js tooling (`vite.config.ts`). `tsconfig.json` has no files of its own, only references to those two, so type-check them with `tsc -b`; `tsc -p .` checks nothing.

### `vite.config.ts`

Vite build configuration. Sets up React plugin, path aliases, base path `/components/` and output directory `dist/components`. The `netlifyRootFiles` plugin copies `netlify/_headers` and `netlify/_redirects` into the folder above `outDir` after the build (`dist/` by default, or the parent of a custom `--outDir`), since Netlify reads them from the publish root. `build.rollupOptions.treeshake.moduleSideEffects` marks every `convex` module as side effect free, matching convex's own `"sideEffects": false`, so building the same code twice gives the same chunk names. The `contentSecurityPolicy` plugin adds a `Content-Security-Policy` `<meta>` tag to the top of the built `index.html` (`script-src 'self'`, a sha256 hash for each inline script computed after the `%VITE_*%` values are filled in, and `https://ap.convex.dev` for PostHog; `worker-src 'self' blob:`; `object-src 'none'`; `base-uri 'self'`). It is a meta tag because every HTML route goes through the `og-meta` edge function, where `netlify/_headers` rules don't apply. Build only, so the dev server is unaffected.

### `tailwind.config.js`

Tailwind CSS configuration with custom design system colors and theme settings. Defines color palette for the app's black and white design aesthetic.

### `convex.json`

Convex deployment configuration. Specifies the functions directory path for the Convex build system.

### `convex-doctor.toml`

Configuration for the convex-doctor static analysis CLI (score: 100/100). Suppresses intentional design patterns including camelCase index naming, progressive schema enrichment with optional fields, array relationships, deep nesting, monolithic file structure, mixed function types, large document writes, duplicated auth checks, scheduler return values, deep function chains, and sequential run calls. Ignores generated code in `convex/_generated/`.

### `eslint.config.js`

ESLint configuration with TypeScript support, React hooks rules, and relaxed settings for Convex development patterns.

### `postcss.config.cjs`

PostCSS configuration for processing Tailwind CSS.

### `components.json`

shadcn/ui component library configuration. Defines style preferences, aliases, and component paths.

### `.gitignore`

Git ignore patterns for node_modules, dist, build artifacts, and editor files. Includes local-only review artifact `badge-palette-preview.html`.

### `netlify.toml`

Netlify deployment configuration: build command (`npm run build`), publish directory (`dist`), Node version (20) and edge function mappings. Header and redirect rules are NOT in this file: on this site Netlify ignores `[[headers]]` and `[[redirects]]` in netlify.toml (every deploy reported "No header rules processed", and a new `[[redirects]]` rule 404'd on a deploy preview while the same rule in `_redirects` worked), so they live in `netlify/_headers` and `netlify/_redirects`. Edge function settings here are applied:
  - `/components/badge/*` -> `netlify/edge-functions/component-badge.ts` (proxies badge SVG by slug to Convex HTTP badge endpoint)
  - `/components/*` -> `netlify/edge-functions/og-meta.ts` (injects component-specific OG meta tags and directly proxies sitemap/llms.txt/components.md/get-convex routes that cannot rely on redirects after edge functions); `excludedPath` keeps `/components/assets/*`, `/components/fonts/*` and the `/components/_img/*` and `/components/_src/*` image routes out of the edge function; `cache = "manual"` lets Netlify's edge cache og-meta responses that send cache headers (component pages), purged on every deploy
  - `/components/*/*.md` -> `netlify/edge-functions/component-markdown.ts` (keeps Netlify URL, proxies markdown by slug)
  - `/components/_src/*` -> `netlify/edge-functions/component-image-source.ts` (serves Convex storage files for Image CDN, raster images only, with nosniff and a sandbox CSP)

### `netlify/_headers`

Response header rules, copied to `dist/_headers` by the `netlifyRootFiles` plugin in `vite.config.ts` (Netlify reads it from the publish root). Immutable one-year `Cache-Control` for hashed `/components/assets/*`, one week plus stale-while-revalidate for `/components/fonts/*`, and `X-Robots-Tag: noindex, nofollow` for admin, callback, profile, and dashboard routes (og-meta also sets these for its HTML responses).

### `netlify/_redirects`

Redirect and rewrite rules, copied to `dist/_redirects` by `vite.config.ts`. Root `/` to `/components` (301), `/components.md` proxy to the Convex markdown index, `/api/components/*` proxy to the Convex REST API, a 404 for `/components/images/*`, the `/components/_img/:width/:id` rewrite to Netlify Image CDN (resized thumbnails) with its `/components/_src/:id` storage proxy (a local source needs no `[images]` allowlist, which Netlify ignores in netlify.toml here; browsers get that path from the `component-image-source` edge function, and the rewrite is the fallback for Image CDN source fetches), and the SPA fallbacks for `/components` and `/components/*`. The llms.txt, markdown and badge routes under `/components/*` are handled by the edge functions instead.

Session note (2026-03-06): Live endpoint checks showed `www.convex.dev/components/api/mcp/protocol` still returning SPA HTML while direct Convex MCP endpoint `https://giant-grouse-674.convex.site/api/mcp/protocol` returns valid JSON-RPC responses.

Environment variables must be set in Netlify Dashboard:
- `VITE_CONVEX_URL`: Convex deployment URL
- `VITE_WORKOS_CLIENT_ID`: WorkOS Connect OAuth client id for the frontend
- `VITE_WORKOS_REDIRECT_URI`: Callback URL under `/components/callback`
- `VITE_WORKOS_AUTHKIT_DOMAIN`: WorkOS auth domain used for `/oauth2/authorize` and `/oauth2/token`

Environment variables must be set in Convex Dashboard:
- `WORKOS_CLIENT_ID`: WorkOS client id used for JWT provider config
- `WORKOS_AUTHKIT_DOMAIN`: WorkOS auth domain used as issuer and JWKS host
- Local `.env.local` should mirror the same Connect values as frontend build vars.

### `index.html`

Main HTML entry point. Loads the React app and CSS. Includes Open Graph meta tags for social sharing. Preconnects to the Convex deployment, and on `/components` and `/components/categories/:slug` an inline script starts the `/api/directory-page` GET while the JS bundle downloads (stored on `window.__directoryPrefetch`, consumed by `fetchDirectoryPage` in `src/lib/convexHttp.ts`; the URL format must match in both places). The build adds a Content-Security-Policy meta tag (see `vite.config.ts`) that allows this inline script by hash; the hash is recomputed on every build, so editing the script needs no other change, but scripts added from outside the build (for example Netlify snippet injection) are blocked.

## Convex Backend Files

### `convex/schema.ts`

Database schema definition. Defines the `packages` table with all package fields including weeklyDownloads, allTimeDownloads (optional, populated on npm refresh), slug, category, tags, shortDescription, longDescription, videoUrl, videoPosition (optional `"top"` or `"bottom"`, unset means top; where the video embed sits on the detail page), thumbnailUrl, thumbnailStorageId, thumbnailUploadedByUser (true when submitter or admin uploaded a file; blocks auto and manual thumbnail generation overwrite), hideThumbnailInCategory (controls thumbnail visibility in category listings vs Featured section), hideFromSubmissions (hides from Submit.tsx page only, not Directory), logoStorageId, logoUrl, selectedTemplateId, thumbnailGenerationVersion, thumbnailGeneratedAt, thumbnailGeneratedBy, convexVerified, communitySubmitted (marks community-built components), authorUsername, authorAvatar, relatedComponentIds, submitter information (submitterName, submitterEmail, submitterDiscord, additionalEmails for multi-account access), review status, visibility, featured flag, featuredSortOrder (admin-managed numeric order for Featured section display), demoUrl, AI review fields, cached GitHub issue counts, AI-generated SEO/AEO/GEO fields, `hideSeoAndSkillContentOnDetailPage` (keeps generated SEO and SKILL content editable in admin while hidden from the public detail page), skillMd (AI-generated SKILL.md content for Claude agent skills), curatedBadges (denormalized badge entries from curated category memberships: categorySlug, label, optional badgeUrl), soft deletion fields (markedForDeletion, markedForDeletionAt, markedForDeletionBy), and reward tracking fields (rewardStatus, rewardTotalAmount for Tremendous integration). Also defines `packageNotes` (admin-only internal notes), `packageComments` (private submitter/admin message thread with read state, status lifecycle fields, optional `githubIssueStatus` / `githubIssueUrl` / `githubIssueError` / `githubIssueKey` / `githubMirrorKind` / `githubIssueState` set when an admin mirrored the message as a GitHub issue or comment, and `source: "github"` plus `githubCommentId` / `githubCommentUrl` / `githubAuthorLogin` / `githubBroadcastId` on replies mirrored back from GitHub; indexes `by_github_issue_key`, `by_github_comment_id`, `by_github_broadcast`), `githubBroadcasts` (one row per admin GitHub issue broadcast: title, body, `statusFilter`, running/completed/cancelled status, total/sent/failed/skipped/replies counters, optional `archivedAt`, `by_created` index), `githubBroadcastItems` (per package outcome for a broadcast: `repo` as owner/name, queued/sent/failed/skipped status, attempts, issue URL, `issueKey`, `issueState`, `replyCount`, error; `by_broadcast`, `by_broadcast_and_status`, `by_issue_key`, `by_package` indexes), `githubSyncState` (singleton for the reply poller: token login and source, last poll, `Last-Modified`, poll interval, last run summary, last error), `aiReviewRuns` (persistent per-package AI review history with criteria, provider metadata, and raw output for admin audit), `payments` (Tremendous reward payment tracking with status, amounts, and Tremendous IDs), `preflightChecks` (public preflight check records for rate limiting and caching with hashed IP, normalized repo URL, status, summary, criteria, expiration timestamp, and optional `isGuest` for signed out runs; `by_is_guest_and_created` index powers the site wide guest cap), `contentGenerationRequests` (per-account generated-content request log used for the submit and profile edit cooldown), `readmeRefreshRequests` (per-account rate limit log for user-triggered README refreshes from the profile page), `readmeUpdateLogs` (audit log for README update attempts from the cron auto-update, admin button, or profile button: package, status success/failed/skipped, source cron/admin/profile, changed flag, message; `by_status` and `by_source` indexes; browsed and cleared from the admin Logs tab), `categories` (admin-managed directory categories with slug, label, description, sortOrder, enabled, denormalized counts, `derivedFrom` marking a category whose membership is computed by rule rather than assigned per package, `kind: "curated"` marking hand-picked collections with optional `badgeStorageId`/`badgeUrl` badge image, and `hideThumbnails` to suppress every thumbnail in that category), `categoryMemberships` (join table linking curated categories to member packages with `by_category`, `by_package`, and `by_category_and_package` indexes), plus `adminSettings`, `adminSettingsNumeric`, `badgeFetches`, `thumbnailTemplates`, `thumbnailJobs`, `aiProviderSettings` (API keys and models for Anthropic, OpenAI, Gemini), `aiPromptVersions` (versioned AI review prompts), `seoPromptVersions` (versioned SEO/SKILL.md generation prompts), and `mcpApiLogs` (MCP API request logging for monitoring) tables. Search indexes include `search_name`, `search_description`, `search_maintainers`, `search_componentName`, and `search_repositoryUrl` for admin full-text search.

### `src/pages/SubmitCheck.tsx`

Preflight checker page at `/components/submit/check`. Allows developers to validate their GitHub repository against review criteria before submitting. Features:
- Works signed in or signed out. Signed out visitors run as guests (no redirect): a banner shows the guest limit from `api.packages.getPreflightAccess` with a Sign in button, a hidden `website` honeypot input is sent with the request, limit errors with `requiresSignIn` show a sign in link, and a sign in card replaces the form when an admin pauses guest checks. `signInHere` stores `authReturnPath` so sign in returns to this page
- Input form for GitHub repository URL (required) and optional npm package URL
- Pre-check `PreflightWarningModal` that confirms the 10 checks/hour per IP rate limit and 30-minute per-repo cache before the request fires (matches the `GenerateWarningModal` design from SubmitForm). Admins detected via `api.auth.isAdmin` see admin-specific copy instead: no rate limit, every run fresh, cache bypassed. Guests see their own copy via the `guestLimitPerHour` prop
- Loading state with spinner during check execution
- Detailed results display with:
  - Overall status (passed, failed, partial, error) with icon and color coding
  - Summary of review findings
  - Critical criteria section (9 criteria that must pass for valid component)
  - Advisory criteria section (5 recommendations that do not block approval)
  - Each criterion shows name, pass or fail status, and detailed notes
  - Suggestions section when available
- "Retry" button to run another check
- "Continue to Submit" link to proceed to submission form, passing the checked URL as `?repoUrl=`
- Live hint under the URL field ("Checking packages/x on branch main", or monorepo help text) from a local `parseRepoUrl`
- On a 422, the error box lists the returned fix URLs with "Check this one" buttons that swap the URL in and reopen the confirm modal
- Results show "Reviewed X on Y" from `reviewedPath` and `reviewedRef`
- When `suggestedRepoUrl` is returned, a "Tip: submit the folder URL" card explains why and offers Use folder URL, which updates the Continue to Submit link
- "Back to Submit" navigation link
- Rate limiting feedback (shows error if limit exceeded)

### `src/pages/SubmitForm.tsx`

Public component submission form. Uses the v2 generated content workflow for Description, Use cases, How it works, and README preview instead of the older long-description-first flow. After generation, those three sections render through the shared `DocSectionEditor` (docs-style preview, Preview / Edit toggle, auto-growing textarea) inside one divided card. The "Component Directory Content" section is labeled "(optional)" with helper text explaining users can skip and generate content later from their profile. The submit page opens a warning modal before AI generation, passes source metadata into the preview action, and is covered by the shared backend `once per hour per signed-in account` cooldown used to discourage unnecessary regenerations. Optional logo upload (png, webp, svg) and optional component thumbnail upload (webp, png, jpg, max 3MB, 16:9 recommended) appear below Video URL. After `submitPackage`, the client uploads thumbnail first then logo so `saveLogo` auto-generation respects user thumbnails via `thumbnailUploadedByUser`. The Repository URL has a monorepo help line and prefills from a valid `?repoUrl=` sent by the preflight page. That replaces only the draft's repo URL. The sign-in redirect keeps the query string, and the param is removed from the address bar once signed in.

### `convex/apiKeys.ts`

Per-user API key management for the Components REST API. Contains public mutations (`generateApiKey`, `revokeApiKey`), a public query (`getMyApiKey`), and internal functions for HTTP endpoint auth. The `resolveApiCaller` helper extracts Bearer tokens from requests, validates keys via SHA-256 hash lookup, and enforces two-tier rate limiting (100 req/min authenticated, 10 req/min anonymous). Keys use `cdk_` prefix with 32 random hex chars, hashed at rest. One active key per user. Also includes admin functions for API access management: `grantApiAccess`, `revokeApiAccess`, `searchSubmitters`, `listApiAccessGrants`, `getApiAnalytics`, `getMyApiAccessStatus`, and `_isApiEnabled`. Key generation is gated behind both a global `apiAccessEnabled` toggle and a per-user email-based grant in the `apiAccessGrants` table. The `countKeysAndGrants` analytics helper uses bounded `.take(10000)` reads and queries `apiAccessGrants` via the `by_revoked` index (`.eq("revoked", false)`) instead of collecting the whole table and filtering in JavaScript.

### `convex/auth.ts`

Authentication and admin helper utilities based on `ctx.auth.getUserIdentity()`. Exposes `loggedInUser` and `isAdmin` queries plus `requireAdminIdentity` and `getAdminIdentity` helpers that enforce `@convex.dev` admin access using email claims from WorkOS JWTs.

### `convex/dashboard.ts`

Admin-gated `getDashboardStats` query that returns pre-aggregated component analytics: total/approved counts, community vs get-convex splits, get-convex since Oct 2025, weekly and all-time download totals (weekly covers every active package; `totalAllTimeDownloads` counts approved packages only so it matches the Growth tab), community/team download breakdowns, per-author breakdown (name, avatar, count, downloads, team flag), and monthly submission timeline with community/team splits. Uses `getAdminIdentity` from `./auth` and returns empty defaults for non-admins. The per-package aggregation loop is factored into a `computeDashboardStats(active)` helper; the non-admin response uses a shared `emptyDashboardStats` constant so the handler stays a thin admin check + `take(2000)` + filter + aggregate call.

### `convex/auth.config.ts`

JWT provider configuration for WorkOS Connect token validation. Uses `WORKOS_CLIENT_ID` and `WORKOS_AUTHKIT_DOMAIN` with a `customJwt` provider (`issuer=https://<domain>`, `jwks=https://<domain>/oauth2/jwks`).

### `convex/aiReview.ts`

AI-powered package review system (v6). Contains review criteria, shared prompt status metadata export, GitHub repo fetcher with monorepo support, and `runAiReview` action. Supports multiple AI providers (Anthropic Claude, OpenAI GPT, Google Gemini) via the `callAiProvider` helper function. Provider selection uses runtime failover: active admin provider first, then backup admin providers, then environment providers (ANTHROPIC_API_KEY, CONVEX_OPENAI_API_KEY, optional Gemini env key). Uses custom prompts from `aiPromptVersions` table when configured. Shares the same failover and provider configuration as `seoContent.ts` for consistent AI behavior across all features. Each completed, partial, failed, or error review now also writes a persistent history row to `aiReviewRuns` while preserving the existing latest snapshot fields on `packages`. Automatic approval or rejection is optional and only runs when `autoAiReview` is enabled alongside the matching pass or fail admin setting. Runtime package writes from this action now use internal package mutations so background AI review updates do not depend on public admin-gated APIs.

Review criteria (v6) still judges component validity from the linked GitHub repository instead of the published npm tarball, but now adds a critical package entry point check for `package.json` exports such as `./convex.config.js` and `./_generated/component.js`. Repo discovery still prefers the directory that uses `defineComponent()`, but no longer treats a top-level `convex/` folder as a normal packaged component pattern without supporting package evidence. GitHub snapshots now include nearby `package.json` plus visible client and test entry files so wrapper guidance and entry point failures are based on visible evidence. The prompt now uses 9 critical pass criteria and 5 advisory notes, and explicitly distinguishes exported hooks, classes, and helper APIs from direct browser access to component functions.

Exports shared helpers for the public preflight checker: `callAiProvider`, `REVIEW_CRITERIA`, `fetchGitHubRepo`, `buildReviewPrompt`, `parseReviewResponse`, and `runReviewOnRepo`. The `runPreflightCheck` internal action uses `runReviewOnRepo` to perform AI review without persisting results to the `packages` table.

Repo discovery (2026-09-26): `runReviewOnRepo` calls `locateComponent` from `convex/repoLocator.ts` for GitHub and GitLab, taking an optional `matchPackageName` (the npm name for preflight, `pkg.name` for admin reviews). URL problems short circuit through `problemReviewResult` with fix URLs and no AI call: `partial` for branch, folder, or multi-component problems (so auto approve and auto reject skip them), `failed` for `repo_not_found`. Results carry `problem`, `reviewedPath`, and `reviewedRef`. `runAiReview` requires an `@convex.dev` email. The legacy `fetchGitHubRepo` stays for one release as a rollback lever and can be deleted after 2026-10-03.

### `convex/repoLocator.ts`

Finds the Convex component a repo URL points at, for GitHub and GitLab. Plain helpers in the default runtime (no `"use node"`). `locateComponent(repoUrl, { packageName, githubToken })` reads the full tree once (GitHub Trees API, GitLab recursive tree), resolves the URL branch (including branch names with slashes) and folder, groups component configs by nearest `package.json`, prefers the one whose package name matches, ignores example, demo, fixture, and test folders when a real candidate exists, and keeps the legacy folder ranking for single-package repos. File contents come from `raw.githubusercontent.com` with a Contents API fallback, 8 at a time, capped at 100 files with tests last. Returns `located` (ref, `componentSourceDir`, files, and `suggestedRepoUrl`, the package folder URL when the URL pointed at the repo root or another folder), `no_config`, `app_only`, or `problem` with a code (`repo_not_found`, `branch_not_found`, `dir_has_no_component`, `multiple_components`), a message, and up to 6 fix URLs built with `repoTreeUrl`. Also exports `classifyConvexConfig`.

### `convex/gitlabApi.ts`

GitLab REST v4 read adapter for gitlab.com. Plain helpers with the same return shapes as the GitHub code paths so callers dispatch on provider without changing their own types: `fetchGitLabFile` (raw file at `ref=HEAD` by default), `fetchGitLabTree` (directory listing, 404 treated as empty), `fetchGitLabIssues` (mapped to the `githubIssueValidator` shape, `hasMore` from `x-next-page`), `fetchGitLabIssueCounts` (open and closed from the `x-total` header of a one item page, since gitlab.com omits `open_issues_count` for unauthenticated callers), and `fetchGitLabNamespaceAvatar` (namespace then project avatar; relative `/uploads/...` paths resolved against the host), `fetchGitLabDefaultBranch`, and `fetchGitLabRecursiveTree` (paginated blob paths, `null` when the ref is missing) for the repo locator. `fillGitLabAuthorAvatar` is an internal action that submit and admin auto-fill schedule after the package row exists, writing through `_setAuthorAvatar` so mutations stay fetch free. Optional `GITLAB_TOKEN` is sent as `PRIVATE-TOKEN`; a 401 retries unauthenticated and a 429 throws a rate limit error. Project ids are `encodeURIComponent(projectPath)` so nested groups work.

### `convex/preflight.ts`

Public preflight check helpers for rate limiting and result caching. Contains:
- `hashIp(ip: string)`: Async function that hashes client IP addresses using Web Crypto API (SHA-256) for privacy-preserving rate limiting. Uses the Web Crypto API instead of Node.js `crypto` module since this file runs in the default Convex runtime, not Node.js.
- `normalizeRepoUrl(url: string)`: Normalizes GitHub and GitLab repository URLs (removes protocol, trailing slashes, `.git` suffix, GitHub `/tree` and `/blob` paths, GitLab `/-/tree` and `/-/blob` paths) for consistent cache keys
- `preflightCacheKey(url: string)`: Same key as `normalizeRepoUrl` for repo root URLs; adds `@ref:dir` when the URL names a branch or folder so monorepo components don't share a cached result
- `_deletePreflightCheck`: Internal mutation that removes a signed-in row when the URL had a locator problem, so the check doesn't count against the hourly limit (guest rows are kept)
- `_checkRateLimit`: Internal query to check if a hashed IP has exceeded the 10 checks per hour limit
- `_getCachedResult`: Internal query to retrieve a cached preflight result for a normalized repository URL (30-minute cache)
- `_createPreflightCheck`: Internal mutation to create a new pending preflight check record in the `preflightChecks` table
- `_updatePreflightCheck`: Internal mutation to update a preflight check record with review results (status, summary, criteria). Error results expire immediately so failures are not cached
- `_hasInFlightCheck`: Internal query to check if a hashed IP has an existing pending check (enforces 1 concurrent check per IP). Takes `now` and ignores pending rows older than 10 minutes so a crashed run cannot lock an IP out
- `_reserveGuestCheck`: Internal mutation for signed out callers. In one transaction it checks the `guestPreflightEnabled` admin setting, the 30 minute cache, an in flight run, 3 checks per hour per IP, and 30 guest checks per hour site wide (`by_is_guest_and_created` index), then inserts a pending `isGuest` row. Returns `cached`, `reserved` (with `remaining`), or `denied` with a reason and `retryAfterSeconds`
- Exported constants `GUEST_MAX_CHECKS_PER_HOUR`, `GUEST_GLOBAL_MAX_CHECKS_PER_HOUR`, `SIGNED_IN_MAX_CHECKS_PER_HOUR`, `GUEST_PREFLIGHT_SETTING_KEY` shared with `http.ts` and `packages.ts`

### `convex/aiSettings.ts`

AI provider and prompt management. Contains:
- `getAiProviderSettings`: Query to get configured providers (masks API keys for security)
- `updateAiProviderSettings`: Mutation to save provider API key and model
- `clearProviderSettings`: Mutation to remove custom settings and revert to env vars
- `getDefaultPrompt`: Query to get the default AI review prompt plus shared prompt status metadata
- `getActivePrompt`: Query to get current active AI review prompt (custom or default) plus shared prompt status metadata
- `getPromptVersions`: Query to list AI review prompt version history
- `savePromptVersion`: Mutation to save new AI review prompt version
- `activatePromptVersion`: Mutation to restore a previous AI review prompt version
- `resetToDefaultPrompt`: Mutation to revert to default AI review prompt
- `getSeoDefaultPrompt`: Query to get the default SEO/SKILL.md prompt
- `getSeoActivePrompt`: Query to get current active SEO prompt (custom or default)
- `getSeoPromptVersions`: Query to list SEO prompt version history
- `saveSeoPromptVersion`: Mutation to save new SEO prompt version
- `activateSeoPromptVersion`: Mutation to restore a previous SEO prompt version
- `resetSeoToDefaultPrompt`: Mutation to revert to default SEO prompt
- Internal queries for aiReview action: `_getActiveProviderSettings`, `_getActivePromptContent`
- Internal query for runtime provider failover: `_getProviderSettingsForFallback`
- Internal queries for seoContent action: `_getSeoActivePromptContent`

The default SEO prompt now imports a shared template from `shared/seoPromptTemplate.ts` so the Admin prompt settings panel stays in sync with runtime SEO generation. The shared template adds GitHub README grounding, Convex docs context placeholders, and stricter no marketing language guidance.

The default AI review prompt wording now uses the same v6 repo-based review model as `convex/aiReview.ts`, including the critical package entry point check, the tighter top-level `convex/` source guidance, wrapper-aware client language, 9 critical pass criteria plus 5 advisory notes, and the requirement for the reviewer summary to state the identified component source directory.

### `convex/securityScan.ts`

Security scan backend (Node.js action file). Contains provider adapters for Socket.dev (supply chain scoring via PURL endpoint) and Snyk (vulnerability testing). The `_runSecurityScan` internal action orchestrates all enabled providers in parallel with `Promise.allSettled`, normalizes findings into a common severity model, and saves results via `_saveSecurityScanResultAndRun`. The public `runSecurityScan` action is the admin-only entry point that queues scans in the background. It calls `requireAdminIdentity`, which throws a `ConvexError` (so the message survives production redaction) for signed-out users and for anyone without an @convex.dev email, since every scan spends Socket.dev and Snyk quota and posts to Slack. Results are stored both as denormalized snapshot fields on the package and as historical `securityScanRuns` rows. Devin AI adapter code is retained but disabled (never queued by the orchestrator). The orchestrator is split into small helpers — `buildProviderTasks(pkg, settings)`, `runProviderTasks(tasks)`, `buildProviderResultsForStorage(providerResults)`, `saveScanError(ctx, ...)`, and `executeScanAndSaveResult(ctx, ...)` — so all three error paths (no repo URL, no providers enabled, catch-all failure) share the same stored error payload shape.

### `convex/aiProviderFallback.ts`

Shared provider failover utilities for AI actions. Builds an ordered provider candidate chain from admin settings and environment variables, de-duplicates candidates, and executes sequential fallback attempts until one provider succeeds or all fail with an aggregated error. Used by both `convex/aiReview.ts` and `convex/seoContent.ts`.

### `convex/packages.ts`

Main package business logic. Contains:

- `listPublicPackagesForCategory` helper: one membership rule for regular, curated and derived official categories, shared by `getCategoryBySlug`, `listApprovedComponents` and the agent file queries `_listEnabledCategoriesForAgents` and `_getCategoryAgentData` (internal, used by `convex/http.ts`). `upsertCategory` rejects the slug `components`, which would collide with `/components/components.md`

**Internal Queries:** `_getPackage`, `_getPackageByName`, `_getPackageBySlug` (for badge/markdown endpoints). Internal queries omit `returns:` validators per Convex best practices (TypeScript inference suffices for non-client-facing functions).

**Public Queries:** `listPackages`, `searchPackages`, `getSubmitPackagesPage` (admin-gated: non-admins get an empty page since `/submissions` is admin only), `searchSubmitPackagesPage` (admin-gated, same rule), `getSubmitPageSizeSetting`, `getPackage`, `getPackageByName`, `listApprovedComponents` (includes `verified` sort mode), `getComponentBySlug` (approved packages for everyone; pending, in review, changes requested and rejected ones only for their owner and admins), `getRelatedComponents`, `getMySubmissions`, `listCategories` (includes total `count` and `verifiedCount` per category), `getCategoryBySlug` (single category metadata for category landing pages), `getFeaturedComponents`, `getPackagesMarkedForDeletion`, `getDeletionCleanupSettings`

**User Mutations:** `requestSubmissionRefresh` (sends private message to admin team from profile page), `setMySubmissionVisibility` (hide/show own submissions), `requestDeleteMySubmission` (marks submission for deletion), `cancelDeleteMySubmission` (cancels deletion request), `updateMySubmission` (edit own submission fields), `saveThumbnail` / `clearThumbnail` (profile and submit flows), `deleteMyAccount` (requires no active submissions)

**User Queries:** `getMyPackageNotes` (private user/admin message thread for a submission, with optional inactive-message visibility), `getMySubmissionForEdit` (editable submission data including `thumbnailUrl` and `thumbnailUploadedByUser`), `getUnreadAdminReplyCount`, `getTotalUnreadAdminReplies`, `getMyUnreadAdminRepliesByPackage` (per-package unread admin reply summary used by the header notifications bell; returns minimal `packageId`, `packageName`, `slug`, `unreadCount`, `lastMessageAt` shape), `getAdminUnreadMessagesByPackage` (admin-only per-package unread submitter-message feed for the bell, bounded at 50 packages)

**Admin Queries:** `getAllPackages`, `adminSearchPackages` (searches name, description, maintainerNames, componentName, and repositoryUrl), `getPackagesByStatus`, `getBadgeStats`, `getUnreadUserNotesCount`, `getUnreadCommentsCount` (for read tracking badges), `getPackagesWithoutSlugs`, `getSubmitPageSizeAdminSetting`, `getAiReviewRunsForPackage` (admin-only history for previous AI review runs), `listAllDirectoryCategories` (admin-only category management source), `listCuratedCategoryMembers` (members of a curated category with status for the admin member picker), `getSecurityScanBacklogStats` (counts of unscanned/scanning/scanned/error packages with repos)

**Admin Mutations:** `adminPermanentlyDeletePackage`, `updateDeletionCleanupSetting`, `updateSubmitPageSizeSetting`, `generateSlugForPackage`, `generateMissingSlugs`, `runSecurityScanBacklog` (queues up to 20 unscanned/errored packages for security scanning)

**Internal Mutations:** `_addPackage`, `_updateNpmData`, `_updateReviewStatus`, `_updateAiReviewStatus`, `_updateAiReviewResult`, `_saveAiReviewResultAndRun` (saves AI review snapshot/history and asks the shared Slack helper to send a grouped completion update when ready), `_permanentlyDeletePackage`, `scheduledDeletionCleanup`, `_createAiReviewRun`

**Actions:** `fetchNpmPackage`, `refreshNpmData`, `submitPackage`, `fetchGitHubIssues`, `refreshGitHubIssueCounts`

**Mutations:** `updateNpmData`, `updateReviewStatus`, `updateVisibility`, `deletePackage`, `toggleFeatured`, `setFeaturedSortOrder` (admin: set numeric order for Featured section), `toggleHideFromSubmissions` (admin: hide from Submit.tsx but not Directory), `updateComponentDetails` (supports `clearThumbnail` to remove thumbnail URL, storage reference, and `thumbnailUploadedByUser`, validates category slugs against admin-managed categories, updates the detail-page SEO and SKILL visibility flag, and now also calls `recountCategoryStats` whenever `category` or `convexVerified` changes so the Directory sidebar counts stay in sync), `generateUploadUrl` (authenticated upload URL generation), `saveThumbnail` (owner or admin; the stored file must be PNG, JPEG or WebP; sets `thumbnailUploadedByUser` and resolves `thumbnailUrl` from storage), `clearThumbnail` (owner or admin; clears thumbnail URL, storage id, and user-upload flag), `saveLogo` (owner or admin; the stored file must be PNG, JPEG, WebP or SVG; triggers auto thumbnail generation only when the admin setting is enabled, a logo exists, and `thumbnailUploadedByUser` is not set), `clearLogo` (owner or admin only), `autoFillAuthorFromRepo` (admin only), `updateSubmitterEmail` (admin: change primary email), `updateAdditionalEmails` (admin: manage multi-account access), `updateSubmitterInfo` (admin: update submitter name and Discord username), `updatePackageCommentStatus` (message hide/archive/restore lifecycle), `deleteAiReviewRun` (admin: delete older saved AI review runs while protecting the latest snapshot), `markNotesAsReadForAdmin`, `markCommentsAsReadForAdmin`, `markPackageCommentReadForAdmin` (admin-only, marks a single packageComments row as read by patching `adminHasRead: true`; idempotent), `markPackageCommentReadForUser` (submitter-only, enforces `userOwnsPackage` before patching `userHasRead: true`; idempotent), `upsertCategory` / `deleteCategory` (admin category CRUD; both now call `recountCategoryStats` on slug rename and on delete so denormalized `packageCount` / `verifiedCount` never go stale; `upsertCategory` accepts `kind: "curated"` on create only, and `deleteCategory` also removes curated memberships and strips the badge from former members), `addComponentToCuratedCategory` / `removeComponentFromCuratedCategory` (admin: idempotent curated membership management; both rebuild the member's denormalized `curatedBadges` and recount category stats), `saveCategoryBadge` / `clearCategoryBadge` (admin: attach or remove the optional badge image on a curated category and resync member badges), note/comment/settings mutations

**Curated categories:** a category row with `kind: "curated"` resolves membership through the `categoryMemberships` join table instead of `packages.category`, so a component keeps its primary category and can belong to any number of curated collections. `listApprovedComponents` and `getCategoryBySlug` branch on `kind === "curated"` (next to the existing official branch) via the `listApprovedCuratedPackages` helper, and `recountCategoryStats` counts publicly visible members. Member packages carry a denormalized `curatedBadges` array (slug, label, optional badgeUrl) kept in sync by `rebuildCuratedBadgesForPackage` / `rebuildCuratedBadgesForCategoryMembers` on membership changes, renames, badge changes, and deletes. Curated slugs are rejected as primary categories by `validateAndApplyCategory` and excluded from the submit-form picker.

**Category count invariant:** denormalized `packageCount` and `verifiedCount` on the `categories` table power the Directory sidebar via `listCategories`. Every mutation that can change a package's `category`, `convexVerified`, `reviewStatus`, `visibility`, or `markedForDeletion` — or that renames / deletes a category row — must call the `recountCategoryStats(ctx)` helper at the top of `convex/packages.ts` before returning. Current call sites: `updateReviewStatusHelper`, `updateVisibility`, `deletePackage`, `_permanentlyDeletePackage` path, `updateComponentDetails`, `updateExistingCategory` (slug rename), `deleteCategory`.

`submitPackage` now marks public submit-form packages as `communitySubmitted: true` by default so Admin loads the Community state correctly in both the Actions row and `ComponentDetailsEditor`. It also derives package ownership from the authenticated email instead of trusting the client-provided submitter email. When enabled, new submissions with a repository URL move to `in_review` and queue `runAiReview`. Enabling that same setting from the Admin page also moves current pending packages with repository URLs into `in_review` and queues AI review for them. `getAdminSettings` now returns the three-part AI automation model: `autoAiReview`, `autoApproveOnPass`, and `autoRejectOnFail`, plus `guestPreflightEnabled` (default true, toggled from AI Review Settings). Public `getPreflightAccess` query returns `guestEnabled`, `guestLimitPerHour`, and `signedInLimitPerHour` for the preflight page.

**Avatar URL invariant:** author avatars must use `https://github.com/{owner}.png`, not `https://avatars.githubusercontent.com/{owner}`. The GitHub owner URL supports organization avatars such as `get-convex`; do not change this back to the CDN username format.

**Helper Functions:** `toPublicPackage()`, `toAdminPackage()`, `generateSlugFromName()`, `userOwnsPackage()` (checks submitterEmail and additionalEmails), `getCurrentUserEmail()` (reads identity email claims), `formatSlackNotification()` (builds the standard Slack message with display name, URL, and 200-char preview; used by `addPackageComment`, `requestSubmissionRefresh`, and `addPackageNote`), `sendReviewCompletionSlackIfReady()` (preserves the security-only Slack completion when `autoAiReview` is off and groups security plus AI review status once both finish when it is on), `scheduleSubmissionFollowups()` (Slack notify + optional auto AI review + auto security scan scheduling after `submitPackage` insert), `formatLatestSecurityScan()` (shapes the public-safe payload for `getLatestSecurityScan` from a package row + its latest `securityScanRuns` entry), `computeUnreadAdminReplySummary()` (per-package admin-reply unread rollup used by `getMyUnreadAdminRepliesByPackage`), validators

### `convex/crons.ts`

Scheduled cron jobs for background tasks:
- `check-and-refresh-packages`: Daily at 3 AM UTC, checks for stale packages to refresh npm data
- `cleanup-old-thumbnail-jobs`: Weekly on Sundays at 4 AM UTC, removes failed thumbnail jobs
- `cleanup-marked-for-deletion`: Daily at 2 AM UTC, permanently deletes packages past the waiting period (configurable via admin settings)
- `official-readme-auto-update`: Hourly at :30, calls `internal.readmeAutoUpdate.scheduledOfficialReadmeUpdate`; the handler itself enforces the admin toggle and the configured interval (hour / day / 3 days / week / month), so the schedule setting works without redeploying crons
- `github-reply-sync`: Every 2 minutes, calls `internal.githubReplySync.pollNotifications`; the handler bails when the `githubReplySyncEnabled` admin toggle is off or GitHub's stored `X-Poll-Interval` has not elapsed, and idle polls return 304 for free

### `convex/downloadsGrowth.ts`

All time downloads growth series for the admin Growth tab. `getGrowthSeries` (admin-gated query, null for non-admins or when no snapshot exists) returns the latest `downloadGrowthSeries` snapshot alongside live totals read straight off the packages table: `liveTotalDownloads` and `livePackagesIncluded` (the same approved-only sum the dashboard's All Time card shows) plus `snapshotTotal` and `snapshotPackagesIncluded` for what the stored curve covers. The stored snapshot supplies the shape of the curve, the live sum supplies the headline number, and the client trues the final point up, so the chart is current on every load with zero npm requests. A shared `readGrowthPackages(ctx)` helper backs both the query and `_getGrowthPackages` so the two can never drift. The query stays deterministic (no `Date.now()`); month extension to today happens client side. `generateGrowthSeries` (admin action) has two modes: the default incremental refresh reuses the snapshot's stored months, trues the newest point up against the stored `allTimeDownloads` sum (the same figure the dashboard shows, zero npm calls), and fetches full npm history only for packages new since the snapshot (tracked via `packageNames`); a full rebuild fetches every approved, visible, not-marked-for-deletion package's daily download history from `api.npmjs.org/downloads/range` in 540-day windows and runs automatically when there is no usable snapshot or packages were removed, or on demand via `fullRebuild`. Months aggregate into a cumulative series with leading empty months trimmed to one lead-in, saved via `_saveGrowthSeries` (keeps only the newest). npm rate limits bursts, so fetching is fully sequential with 400ms spacing, 4-attempt exponential backoff on 429/5xx, and a second retry pass; a package counts only if every window succeeds, and failures are recorded in `packagesFailed`.

### `convex/readmeAutoUpdate.ts`

Scheduled README auto-update for official Convex components plus the admin log API. `scheduledOfficialReadmeUpdate` (internal mutation, called by the hourly cron) early-returns unless the `officialReadmeAutoUpdateEnabled` admin setting is on and `officialReadmeUpdateIntervalHours` has elapsed since `officialReadmeLastRunAt`; it then stamps the run, collects approved and visible official packages via `listApprovedOfficialPackages` from `convex/packages.ts`, logs a `skipped` row for any without a repository URL, and staggers `internal.seoContent.refreshReadme` calls 10 seconds apart (source `"cron"`) to stay under GitHub rate limits, scheduling `_cleanupOldReadmeUpdateLogs` after the batch. Log helpers: `_insertReadmeUpdateLog` (one row per attempt in `readmeUpdateLogs`), `_cleanupOldReadmeUpdateLogs` (keeps the newest 500 rows), `_clearReadmeUpdateLogsBatch` (self-scheduling batched delete). Admin-gated public API (all through `requireAdminIdentity`): `getOfficialReadmeAutoUpdateSettings` / `updateOfficialReadmeAutoUpdateSettings` (toggle plus interval, validated against 1 / 24 / 72 / 168 / 720 hours), `listReadmeUpdateLogs` (paginated, optional status and source filters via the table indexes, returns an empty page for non-admins so the UI never crashes), `deleteReadmeUpdateLogs` (selected ids, idempotent), and `clearReadmeUpdateLogs` (kicks off the batched clear).

### `convex/seed.ts`

Seed script for importing official Convex components from convex.dev/components. Contains `seedOfficialComponents` internal action with support for:
- `importAsPending: boolean` flag to control whether new components enter as "pending" (for admin review) or "approved"
- `dryRun: boolean` flag to preview what would be imported without making changes
- Fetches live npm data for each component
- Uses existing `by_name` index for duplicate detection
- Preserves existing `reviewStatus` on updates, only sets new status on inserts
- Legacy `seedExistingComponents` alias for backward compatibility

Run via CLI: `npx convex run seed:seedOfficialComponents '{"importAsPending": true}'`
Production: `npx convex run --prod seed:seedOfficialComponents '{"importAsPending": true}'`

### `convex/notifications.ts`

Review status notifications for submitters. `getMyStatusNotifications` returns the current user's unread status change notifications (package name, slug, status, timestamp only) for the header bell, keyed by the caller's JWT email via the `by_recipientEmail_and_read` index. `markStatusNotificationRead` and `markAllStatusNotificationsRead` flip the `read` flag with owner checks and idempotent early returns. Rows are inserted by `createStatusNotification` in `convex/packages.ts` whenever `updateReviewStatusHelper` applies a real status transition.

### `convex/githubIssues.ts`

GitHub issue creation for admin to submitter communication. `parseGitHubRepo` accepts https, `git+https`, and `git@github.com:` forms and returns `{ owner, repo }` only for github.com hosts (also imported by `packageMessaging.ts` for the thread message GitHub mirror gate). `createGitHubIssue` POSTs to `/repos/{owner}/{repo}/issues` with `GITHUB_TOKEN` and never throws for GitHub level failures: 201 returns the `html_url`, 429 or a 403 carrying `Retry-After` / `X-RateLimit-Remaining: 0` / a rate limit message returns a `rate_limited` result with a wait derived from `Retry-After` or `X-RateLimit-Reset` (clamped 30s to 15 min), and 401 / 403 / 404 / 410 / other return a `failed` result with a readable message. Feature 1: `createIssueForComment` (internal action, scheduled by `addPackageComment`) loads the comment and package via `_getCommentIssueContext`, creates the issue with the message text plus a footer linking the directory listing and the profile thread, retries once on rate limit, then patches the comment through `_recordCommentIssueResult`. Feature 2: `startGithubBroadcast` (admin mutation) collects packages via the shared `collectBroadcastTargets` (excludes archived and deletion-marked; `pending` covers `pending`, `in_review`, and unset), inserts a `githubBroadcasts` row plus one `githubBroadcastItems` row per package (queued, or skipped when there is no GitHub repo), and schedules `processNextBroadcastItem`. That internal action is a sequential chain: read the next queued item with `_getNextBroadcastItem` (stops if the broadcast is no longer running), create one issue, record it with `_recordBroadcastItemResult` (patches item and counters in one transaction and marks the broadcast completed when nothing is queued), then reschedule itself 10 seconds later. On rate limit it waits GitHub's suggested time and retries the same item up to 3 attempts before marking it failed. `cancelGithubBroadcast` flips status so the in-flight worker stops before the next send. Admin-gated reads (empty for non-admins): `getBroadcastTargetCount` (eligible vs missing repo preview for a filter), `listGithubBroadcasts` (newest 25, hides archived unless `includeArchived`), `getBroadcastItems` (per broadcast results with `issueKey`, `issueState`, `replyCount`). Reply sync support: `issueKeyFromUrl` / `parseIssueKey` turn an issue URL into `owner/repo#n` and back; `_recordCommentIssueResult` and `_recordBroadcastItemResult` store that key plus `issueState`. One open issue per package: `findIssueCandidates` returns the latest created comment issue and latest sent broadcast item for a package, `createIssueForComment` confirms the newest candidate is still open via `getGitHubIssueState` and posts a follow up with `createGitHubIssueComment` (`githubMirrorKind: "comment"`); if it is closed, `_setIssueState` marks the old rows closed and a fresh issue is opened. `getOpenIssueForPackage` (admin query) feeds the checkbox label in the thread UI. `backfillGithubIssueKeys` (internal, run once) keys rows created before the field existed. Broadcast lifecycle (admin mutations): `archiveGithubBroadcast` (completed or cancelled only, idempotent), `restoreGithubBroadcast`, and `deleteGithubBroadcast` (refuses while running; removes the row, then `_deleteBroadcastItemsBatch` deletes items 500 at a time and unsets `githubBroadcastId` on mirrored replies, rescheduling itself until none remain).

### `convex/packageMessaging.ts`

Plain helpers for the private submitter thread and review outcome drafts (no Convex function exports, so `packages.ts` and `reviewMessages.ts` both import it without a cycle). `insertPackageComment` inserts a `packageComments` row with read state, schedules the GitHub mirror (`internal.githubIssues.createIssueForComment`) for team messages on github.com repos, and posts to Slack; `addPackageComment` delegates to it. `isTeamComment` treats `@convex.dev` authors and `source: "system"` rows as team messages. Draft helpers on `reviewMessageDrafts`: `buildDraftContent` (returns null when a rejection has no failed review or usable reasons), `upsertRejectionDraft` (keeps admin edits, skips review runs already sent or discarded via `wasRejectionRunHandled`), `createApprovalDraft` (one approval message per package), `dismissPendingDrafts`, `getPendingDraft`, `sendDraft` (inserts the comment and marks the draft sent in one transaction), and `maybeAutoSend` (reads `autoSendRejectionMessage` / `autoSendApprovalMessage` and their GitHub keys, sends as `authorEmail: "AI"`, author name Convex Components Team, `source: "system"`).

### `convex/reviewMessages.ts`

Admin API for review outcome drafts. Queries return empty for non admins: `getReviewMessageDraft` (pending draft for one package) and `listPackagesWithPendingDrafts` (package ids for the Messages row dot, one shared subscription, `by_status` index). Mutations require an admin: `updateReviewMessageDraft` (autosave target, sets `editedAt`), `regenerateReviewMessageDraft` (rebuilds from latest review data), `dismissReviewMessageDraft` (idempotent), `sendReviewMessageDraft` (sends as the signed in admin with the GitHub checkbox choice, refuses drafts already sent or discarded, caps length at 10000). `backfillRejectionDrafts` (internal, `dryRun` supported) pages rejected packages 100 at a time and drafts messages for ones with a failed AI review, no pending or handled draft, and no team message since the review. Never sends.

### `convex/githubReplySync.ts`

Mirrors GitHub issue replies back into package message threads. `pollNotifications` (internal action, cron target, `force` arg for Sync now) resolves tokens (`GITHUB_NOTIFICATIONS_TOKEN` first, then `GITHUB_TOKEN`; notifications endpoints require a classic PAT with the `notifications` scope), skips when the toggle is off or the stored poll interval has not elapsed, then fetches `GET /notifications?participating=true&since=` with `If-Modified-Since`. On 304 it stamps `lastPolledAt` and stops. Otherwise it keeps Issue threads, derives `owner/repo#n` from `subject.url`, maps keys to packages with `_findIssueTargets` (`packageComments.by_github_issue_key`, then `githubBroadcastItems.by_issue_key`), fetches each matched issue's comments since the last poll minus a 10 minute buffer, drops comments by the token login or bots, and hands the batch to `_mirrorGithubReplies`. That internal mutation is idempotent on `githubCommentId` (`by_github_comment_id`), inserts each reply as a `source: "github"` `packageComments` row that is unread for admins (author email is the package `submitterEmail` when the login matches `authorUsername`, else `login@users.noreply.github.com`), schedules one `internal.slack.sendMessage` per reply via `formatSlackNotification`, and patches `replyCount` / `replies` once per broadcast row. Matched threads are marked read with `PATCH /notifications/threads/{id}`; unmatched ones are left alone and counted. State lives in the `githubSyncState` singleton (`_getSyncState` / `_patchSyncState`: token login and source, last poll, `Last-Modified`, poll interval, last run summary, last error) and GitHub failures are recorded there rather than thrown. Admin API: `testConnection` (action: `GET /user` then `GET /notifications?per_page=1`, reports which token worked and its login), `syncNow` (schedules a forced poll with a 24 hour window), `getSyncStatus` (null for non admins), `setReplySyncEnabled`.

### `convex/slack.ts`

Internal Slack notifications: `sendMessage` (`internalAction`) POSTs `{ text }` to `SLACK_WEBHOOK_URL`. No-op if unset. Errors are logged only. Also exports the pure `formatSlackNotification(pkg, headline, from, body)` helper (moved here from `packages.ts`) so `addPackageComment` and `githubReplySync._mirrorGithubReplies` format messages identically. Scheduled from `submitPackage` (new submissions), `addPackageComment` (private messages from both submitters and admins, with role-based `From:` label), `requestSubmissionRefresh` (submitter "Send Request" from Profile), `addPackageNote` (admin internal notes and legacy request replies, with distinct first-line labels), and the shared package review completion helper. Review completion sends the existing security-only message when Auto AI Review is off, or one grouped security plus AI review message after both checks finish when Auto AI Review is on.

### `convex/thumbnails.ts`

Thumbnail template management and generation API. Contains admin CRUD mutations for background templates (create, update, delete, reorder, set default), internal queries/mutations for logo and template data, `_packageHasUserUploadedThumbnail` (generation guard), thumbnail job tracking, and a cleanup job for failed jobs. `_saveGeneratedThumbnail` no-ops when `thumbnailUploadedByUser` is true. Batch logo queries skip user-uploaded thumbnails. Internal mutations omit `returns:` validators per Convex best practices (TypeScript inference suffices). All queries and mutations run in the default Convex runtime.

### `convex/thumbnailGenerator.ts`

Node.js action module for composing 16:9 thumbnails. Uses Jimp for raster image composition and @resvg/resvg-wasm for SVG to PNG conversion. `generateThumbnailForPackage` is now a thin public admin action that verifies access and queues the internal worker `_generateThumbnailForPackage`, which prevents client-facing runtime errors while keeping the actual image generation private. Also contains `_autoGenerateThumbnail` (submit flow), `regenerateAllThumbnails` (batch), and `_autoGenerateThumbnailWithTemplate` (batch per-package). All generation entry points skip packages where `thumbnailUploadedByUser` is true; the public admin action throws a clear error if generation is requested anyway. Runs in Node.js runtime. Cleaned of leftover debug `fetch` calls to a local agent ingest server (`127.0.0.1:7557`) that had been left in `_generateThumbnailForPackage` from a prior debugging session.

### `convex/seoContent.ts`

AI-generated SEO and v2 directory content action module supporting multiple AI providers. Contains both the legacy SEO generation flow and the unified v2 component directory content generation used by admin, submit, and profile edit surfaces. All three surfaces now share the same `buildContentPrompt` function which loads the admin custom prompt via `_getSeoActivePromptContent` with fallback to `DEFAULT_CONTENT_PROMPT_TEMPLATE` in `shared/seoPromptTemplate.ts`. Fetches README content on demand from GitHub or GitLab (`fetchRepoReadme`, dispatching on `parseRepoUrl`; `parseReadmeTarget` honors `/blob/<ref>/<file>` and `/-/blob/<ref>/<file>` exact file paths and otherwise tries `README_FILENAMES` in the subdirectory then the root), adds best effort Convex docs grounding from `https://docs.convex.dev/llms.txt` plus `https://docs.convex.dev/`, and enforces authenticated content preview rate limiting through `convex/contentGenerationLimits.ts`. README sanitization is split into `sanitizeReadme` (clean without truncation) and `sanitizeReadmeForPrompt` (clean plus 12k char truncation for AI prompts). `fetchRepoReadme` returns both `rawContent` (truncated, for prompts) and `fullContent` (untruncated, for display). The v2 content generator and preview action use `fullContent` for the stored `readmeIncludedMarkdown` field so component detail pages show the complete README with no character cap (previously limited to 20k chars). Also contains `refreshReadme` (internal action) and `refreshReadmeContent` (public action) for fetching and storing just the README without regenerating AI content, used by the admin Update README button, the profile Update README button, and the scheduled official README auto-update. `refreshReadme` takes an optional `source` arg (`cron` / `admin` / `profile`) and writes a row to `readmeUpdateLogs` on every outcome (success with a changed flag, failure with the error message). `extractReadmeIncludeBlock` (both the marker block and the full-README fallback) and `parseContentAiResponse` (generated use cases and how it works, since the prompt includes the README) run their markdown through `stripUnsafeHtml` from `shared/sanitizeMarkdown.ts`. Runs in Node.js runtime.

### `convex/contentGenerationLimits.ts`

Internal rate-limit helpers for generated component directory content. Allows up to 5 generations per hour per signed-in user and records submit or profile-originated requests in `contentGenerationRequests` so the shared preview action can enforce a cooldown. Admin actions bypass this limit entirely.

### `convex/seoContentDb.ts`

Internal mutations for persisting AI-generated SEO content plus the public admin edit mutation. Separated from `seoContent.ts` because Convex mutations cannot live in `"use node"` files. Contains `_saveSeoContent` (saves SEO fields and SKILL.md content), `_updateSeoStatus`, `_setSeoError`, `_updateReadmeOnly` (patches only the README markdown and source fields without touching AI content; skips the write when the stored content is byte-identical and returns whether anything changed, which the README update log records), and `updateSeoContent` (public admin mutation for directly patching SEO fields without AI regeneration). Also contains skill maintenance mutations: `rebuildSkillMd` (admin, deterministically rebuilds SKILL.md from v2 generated content via `tryBuildSkillMd`, throws `ConvexError` when content is missing; powers the Admin Update Skill button) `backfillAllSkillMd` (admin, kicks off `_backfillSkillMdBatch`, a paginated self-scheduling internal mutation that builds SKILL.md for approved packages with v2 content but no skill), and `rebuildAllSkillMd` (admin, same batch worker with `force: true` to rewrite skills for all approved packages with v2 content after skill template changes; skips no-op writes). `updateGeneratedContent` runs the use cases, how it works and README markdown through `stripUnsafeHtml`. `findUnsafeMarkdown` (internal action, read only, run with `npx convex run --prod seoContentDb:findUnsafeMarkdown`) pages through packages with `_unsafeMarkdownCandidatesPage`, runs `stripUnsafeHtml` in the action, and lists every row whose markdown fields or `skillMd` still hold HTML it would remove (`rewrittenFields`), or whose raw text has an iframe, script, `srcdoc` or `javascript:` URL, with the fields and what was found. Internal mutations omit `returns:` validators per Convex best practices (TypeScript inference suffices for non-client-facing functions).

### `convex/payments.ts`

Tremendous rewards integration for submitter payouts. Runs in Node.js runtime (`"use node"`). Contains:

**Internal Functions:**
- `sendReward`: Internal action that sends gift card rewards via Tremendous API. Validates that package `reviewStatus` is `in_review` or `approved` before calling the API. Records payment and handles errors.

**Public Functions:**
- `sendRewardManual`: Public action for admin-triggered manual rewards (wraps `sendReward`)

Working setup notes:
- Uses direct `fetch()` to Tremendous instead of the Tremendous npm SDK
- Normalizes `TREMENDOUS_BASE_URL` so common wrong host values do not cause 404s
- If `TREMENDOUS_CAMPAIGN_ID` is set, the payload sends `campaign_id` and does not send `products`
- If no campaign id is set, the fallback payload uses `products: ["giftcard"]`
- When a reward note is provided, it is trimmed and forwarded to Tremendous `delivery.meta.message` so the recipient sees custom copy in the reward email and landing page
- Includes a settings-only `sendTestReward` action that sends to `TREMENDOUS_TEST_RECIPIENT_EMAIL`

Safe testing flow:
- Start with sandbox creds and `TREMENDOUS_BASE_URL=https://testflight.tremendous.com/api/v2`
- Keep `autoSendRewardOnApprove` off
- Send one manual reward to your own test submission first
- Confirm a `payments` row is created and package `rewardStatus` updates before enabling auto-send
- The settings panel test reward creates a `payments` row with `isTest: true` and does not patch any component reward fields

Environment variables required: `TREMENDOUS_API_KEY`, `TREMENDOUS_CAMPAIGN_ID`, `TREMENDOUS_FUNDING_SOURCE_ID`, optional `TREMENDOUS_BASE_URL`, and `TREMENDOUS_TEST_RECIPIENT_EMAIL` for settings-level test sends.

### `convex/paymentsDb.ts`

Default runtime data layer for Tremendous rewards. Contains:

**Internal Functions:**
- `_getPackageForReward`: Internal query to fetch package data needed for reward sending
- `_recordPayment`: Internal mutation to insert payment record and update package reward status for real rewards while skipping package patches for `isTest` payments

**Public Functions:**
- `getPaymentsForPackage`: Query to list all real and test payments for a package
- `getPaymentStats`: Query returning aggregate payment statistics for real rewards only (test payments are excluded from totals)
- `backfillRewardStatusFromPayments`: Mutation that scans all successful non-test payments and reconciles each package's `rewardStatus` and `rewardTotalAmount`. Use from the Convex dashboard to fix packages where Tremendous succeeded but the package document fell out of sync.

### `convex/router.ts`

HTTP router configuration. Defines:
- `/api/export-csv` endpoint for CSV export of all packages
- `/api/badge` endpoint for dynamic SVG badge generation with analytics tracking
- `/api/markdown` endpoint serving raw markdown (`Content-Type: text/markdown`) for component data, enhanced with AI-generated SEO sections
- `/api/llms.txt` endpoint serving a plain-text index of all approved components for AI agent discovery

### `convex/badgeSvg.ts`

README badge renderer used by `/api/badge`. `renderBadge` matches the badge.fury.io npm version badge: DejaVu Sans 11px text drawn as glyph outlines with a 0.3px white stroke and a crisp 1px `#010101` shadow, fury's padding (label +12, value +11) and kerning. Also holds `measureText`, the `BADGE_COLORS` status map (approved `#4c1`) and the shared `escapeXml`. Verified against live fury SVGs to within 0.001px per glyph point.

### `convex/badgeGlyphs.ts`

Generated DejaVu Sans 2.37 data for `convex/badgeSvg.ts`: advance widths and TrueType outlines for printable ASCII in font units (y up), plus the 220 ASCII kerning pairs. Includes the font license notice. Regeneration steps are in `prds/badge-fury-style-match.md`.

### `convex/directoryPage.ts`

`_getDirectoryPageData` internal query behind the `/api/directory-page` HTTP action. Runs the public directory queries (`listApprovedComponents`, `listCategories`, `getFeaturedComponents`, `getDownloadsDisplaySettings`, `getListViewSettings`, `getCategoryBySlug`) as nested `ctx.runQuery` calls in one transaction, so the list, counts and featured row share a snapshot. Category requests skip the featured and list-view queries. Also exports `DIRECTORY_SORTS`, the accepted `sortBy` values.

### `convex/http.ts`

Main HTTP router with all API endpoints. Defines:
- `/api/export-csv` endpoint for CSV export of all packages
- `/api/category-llms?slug=` and `/api/category-markdown?slug=` per-category agent files (public at `/components/<slug>-llms.txt` and `/components/<slug>.md`). Rendered on each request from `packages._getCategoryAgentData`, so they follow approvals, curated membership edits and slug renames. Disabled or unknown categories return 404. Titles and intros use the admin label and description (`categoryAgentTitle` avoids "Convex Official Convex Components Components"). Curated and derived categories group by category, regular ones are a flat list. `/api/llms.txt` lists the per-category URLs in its header and `/api/markdown-index` adds a "Browse by category" section; both markdown indexes take category labels from the database
- `/api/badge` endpoint for dynamic SVG badge generation (rendered by `convex/badgeSvg.ts` to match the badge.fury.io npm badge) and analytics tracking
- `/api/markdown?slug=<slug>` endpoint serving raw markdown for a single component. This and the other per-component endpoints (`/api/skill`, `/api/component-llms`, `/api/components/detail`, `/install`, `/docs`) only serve approved packages that aren't hidden, archived or marked for deletion (`isPublicPackage`), so a submission still in review gets a 404
- `/api/skill?slug=<slug>` endpoint serving the raw generated SKILL.md for a single component (404 for unapproved, hidden or archived packages, missing skills, or `hideSeoAndSkillContentOnDetailPage`); backs the `/components/<slug>/SKILL.md` alias. Component markdown, llms.txt, and index outputs include skill links when a public skill exists
- `/api/markdown-index` endpoint serving markdown listing of all approved components
- `/api/llms.txt` endpoint serving a plain-text index of all approved components (header cross-links the official list)
- `/api/get-convex-llms.txt` and `/api/get-convex-markdown` endpoints serving the same formats filtered to official Convex team components (`isOfficialPackage`: `github.com/get-convex/` repo or `@convex-dev/` npm scope); back the `/components/get-convex-llms.txt` and `/components/get-convex.md` aliases. Shared `buildLlmsTxtBody`/`buildMarkdownIndexBody` builders generate both the full and official lists; each entry carries a `- Version:` line from `packages.version` and both headers open with a one-line agent instruction (`AGENT_INSTRUCTION_LINE`) to fetch a component's SKILL.md before writing code. Per-component markdown and llms.txt outputs include the same instruction pointing at the skill URL when a public skill exists
- `/api/component-llms?slug=<slug>` endpoint serving llms.txt format for a single component

MCP endpoints temporarily disabled (commented out) while public host routing is being debugged:
- `/api/mcp/search`, `/api/mcp/component`, `/api/mcp/install-command`, `/api/mcp/docs`, `/api/mcp/info`
- `/api/mcp/protocol` (JSON-RPC 2.0 handler)
- `/api/mcp/cursor-install`, `/api/mcp/cursor-install-component`
- Code preserved for easy re-enablement when routing is fixed

Preflight check endpoint (auth token optional):
- `/api/directory-page` (GET): `?sortBy=` and optional `?category=`. Returns the directory or category page's catalog data in one response (`components`, `categories`, `featured`, `downloadsDisplay`, `listViewSettings`, `categoryData`), read in a single transaction by `directoryPage._getDirectoryPageData` and encoded with `convexToJson`. A plain GET skips the CORS preflight that `/api/query` needs, so `index.html` can start it before the app loads.
- `/api/preflight` (POST): Accepts `repoUrl` and optional `npmUrl`, validates repo against review criteria, returns status, summary, criteria, the `reviewedPath`/`reviewedRef` the review read, and `suggestedRepoUrl` when the component package sits in a folder the URL didn't point at. When the URL doesn't resolve to one component it returns 422 `{ error, code, suggestions, status: "error" }` (`preflightProblemBody`); signed-in 422 rows are deleted so they don't count, guest rows keep counting. Cache keys come from `preflightCacheKey`, so each branch and folder caches separately. Signed in callers get IP-based rate limiting (10 checks/hour), in-flight limits (1 concurrent check per IP), and 30-minute result caching by normalized repo URL. Admins with an `@convex.dev` email bypass all three gates and always get a fresh run (their runs still refresh the cache for others). Callers without a token go through `handleGuestPreflight`: directory origin check (`isAllowedGuestOrigin`), `website` honeypot, URL length caps, then `preflight._reserveGuestCheck` (3 per hour per IP, 30 per hour site wide, admin kill switch). Guest denials that sign in would fix include `requiresSignIn: true`; limit hits return 429 with `retryAfterSeconds` and `Retry-After`. `resolveClientIp` reads the IP from `ctx.meta.getRequestMetadata()` with a header fallback, and `runAndStorePreflight` marks the row `error` if the review action throws so the IP is not locked out. The route now awaits the async `hashIp()` helper after the move from Node.js `crypto` to Web Crypto in the default Convex runtime.

### `convex/convex.config.ts`

**Note:** This file was deleted during a previous auth migration and is no longer needed with the current WorkOS setup.

### `convex/tsconfig.json`

TypeScript config for Convex functions.

### `convex/_generated/`

Auto-generated files by Convex: `api.d.ts`, `api.js`, `dataModel.d.ts`, `server.d.ts`, `server.js`. Regenerated whenever Convex modules change (including shared AI failover helper imports used by actions).

## Frontend Source Files

### `src/main.tsx`

Application entry point. The `Router` re-renders from `useLocation()` (`src/lib/router.ts`) instead of reading `window.location` once, so in-app links don't reload the page; `installNavigation` is set up before render and prefetches a component's data and the README renderer when a component link is hovered or touched. `ComponentDetail` and `CategoryPage` are keyed by slug so moving between them starts fresh. Sets up Convex React client with a custom Connect OAuth provider (`ConnectAuthProvider`) and `ConvexProviderWithAuthKit` token bridge. Renders `DeferredWebAnalytics` next to the app, which loads `WebAnalyticsProvider` from `@convex-internal/web-analytics/react` (shared `allowsCookies` consent and PostHog) after the page has loaded. No extra env vars. Includes a `PageErrorBoundary` class component that catches rendering errors (including `useQuery` failures) and shows a reload prompt instead of killing the entire React tree. The `ComponentDetail` route is wrapped in this boundary so backend query errors or markdown rendering crashes degrade gracefully. Disables browser scroll restoration (`history.scrollRestoration = "manual"`) and scrolls to top on init so every full-page navigation starts at the top. Includes global Footer component with 50px top padding. All routes live under `/components/*` and root redirects now normalize back to `/components/` for Vite base-path safety:
- `/components/` = Directory (approved components, public)
- `/components/categories/:slug` = CategoryPage (category landing page with pagination, public)
- `/components/submissions` = Submit.tsx via `SubmissionsGate` (admin only, requires @convex.dev email; everyone else is redirected to `/components`)
- `/components/submissions/admin` = Admin.tsx (requires @convex.dev email)
- `/components/submit` = SubmitForm.tsx (auto sign-in redirect for unauthenticated users)
- `/components/profile` = Profile.tsx (user's submissions, auth required)
- `/components/documentation` = Documentation.tsx (admin-only docs, not indexed)
- `/components/documentation/:section` = Individual doc sections
- `/components/callback` = OAuth callback handler (reads `authReturnPath` from localStorage to redirect after auth)
- `/components/submit/check` = SubmitCheck (public preflight checker)
- `/components/:slug` = ComponentDetail (public)

### `src/lib/auth.tsx`

React auth hooks for Connect integration. Re-exports `useConvexAuth` from `convex/react` and provides a custom `useAuth` hook that combines connect `signIn` and `signOut` with Convex authenticated state.

### `src/lib/connectAuth.tsx`

Custom WorkOS Connect OAuth PKCE provider. Handles authorize redirect, callback code exchange, PKCE/state validation, JWT parsing for basic user claims, token persistence, sign out, and exposes `getAccessToken` for Convex auth bridging.

### `src/components/Header.tsx`

Shared header component with auth state management. Uses `useAuth()` from `src/lib/auth` for auth state and sign in/out, and `useQuery(api.auth.loggedInUser)` for user data. Accepts optional `viewMode` / `onViewModeChange` props (exports the `DirectoryViewMode` type); when both are passed (only the Directory does), a Phosphor `Rows`/`SquaresFour` toggle button renders before the "Directory" link in the desktop left nav (and next to the search icon on mobile) to switch between grid and list layouts. Features:
- Floating pill design with `rounded-full`, white/95 background, backdrop blur, and shadow
- Convex wordmark logo (black SVG, 70px height)
- Navigation links (Directory, Build, Test, Submit) with medium font weight. Build is an external link to `https://docs.convex.dev/components/overview` (new tab) shown in both the desktop nav and the mobile dropdown. Test opens the Component Preflight Check at `/components/submit/check` for everyone, signed in or not
- Admin-only navigation links (Submissions, Admin, Docs, Dashboard) visible only to @convex.dev users
- Social icons (GitHub, Discord) and Docs icon linking to external resources
- User menu with avatar, My Submissions link, and Sign Out button
- Notifications bell (Phosphor `Bell`) placed right of the Submit link and in the mobile header row. Default state is an outline bell matching the other header icon styling (`text-text-secondary hover:text-text-primary`, size 16). When unread items exist, the bell switches to a filled `#E05C35` icon and renders a count badge. Opens a dropdown with three sections: "Status updates" (current user's unread review status changes with per-status copy and colored dots, marked read on click, with a "Mark all read" button), "Messages from Convex Team" (current user's unread admin replies) and, for admins only, "Incoming messages" (unread submitter messages across all components). Each item links to `/components/profile#pkg-<id>` (user) or `/components/submissions/admin#pkg-<id>` (admin). Powered by `api.notifications.getMyStatusNotifications`, `api.packages.getMyUnreadAdminRepliesByPackage`, and `api.packages.getAdminUnreadMessagesByPackage`.
- Header search (`HeaderSearch`) rendered in the desktop right nav and as an always-visible mobile control
- Sticky positioning with top padding for floating effect
- Mobile responsive with separate dropdown menu card (rounded-2xl) below header pill
- Header height: 3.438rem

### `src/components/HeaderSearch.tsx`

Magnifying glass button in the header (Cmd+K / Ctrl+K also toggles it) that opens a dropdown search. Debounces typing (300ms) before calling the `searchDirectoryComponents` full text search query (Convex FTS across name, componentName, description, and shortDescription indexes, filtered to approved+visible), shows up to 10 components with verified badges and category labels, and links each result to its detail page. ArrowDown/ArrowUp move a highlight through the results (wrapping, kept in view) and Enter opens the highlighted result; with no highlight, Enter or the footer button navigates to the directory with `?q=<term>` so `Directory.tsx` opens pre-filtered. Escape and outside click close the panel.

### `src/components/FAQSection.tsx`

Reusable FAQ section component displayed on the Directory and SubmitForm pages. Displays 12 frequently asked questions:
- What happens after I submit? (rolling basis review with authoring guidelines link)
- What are the requirements? (npm, GitHub, authoring guidelines)
- What size should my component thumbnail be? (16:9 aspect ratio, 1536 x 864 pixels)
- How are components sandboxed? (Convex runtime data isolation)
- What projects should use Components? (check component docs)
- Can I build my own? (link to authoring docs)
- Do components cost money to use? (open source, usage-based)
- Can I update my submission? (link to profile page)
- Where can I learn more? (link to Components documentation)
- How do I report a component? (takedown process, contact Convex)
- Who decides if a component gets removed? (Convex team, submitter notified)
- What is the review flow? (pending > AI review > manual review > approved)

### `src/components/DeferredWebAnalytics.tsx`

Loads the shared `WebAnalyticsProvider` (PostHog init plus the consent banner) as a lazy chunk once the page's `load` event has fired and the browser is idle, instead of wrapping the app. posthog-js is ~180 KB minified, so this keeps it out of the entry bundle. Safe because nothing in the app reads the provider's consent context; if something ever needs `useConsent`, wrap the app in the provider again.

### `src/components/Footer.tsx`

Full Convex.dev-style site footer matching the official convex.dev design. Dark background (`#141414`), white Convex wordmark logo linking to convex.dev, four link columns (Product, Developers, Company, Social with icons), "A Trusted Solution" section with green checkmark badges (SOC 2 Type II Compliant, HIPAA Compliant, GDPR Verified), and copyright. Uses Convex design system tokens for colors. External links show `ExternalLinkIcon` from `@radix-ui/react-icons`. Social icons loaded from `/public/*.svg`. Responsive grid layout (6 cols xl, 5 lg, 4 md, 2 mobile).

### `src/components/FooterBackup.tsx`

Backup of the original simple footer component (not used). Kept for reference.

### `src/App.tsx`

Main package submission interface. Compact toolbar, package submission form, search, sort, package card list, modals, and mobile responsive design.

### `src/pages/Directory.tsx`

Component directory listing page at `/components/`. Supports a grid/list view toggle (header button, persisted in `localStorage` as `directoryViewMode`): list mode keeps the sidebar and category headers but renders every section (Featured, categories, Other, flat search) as compact `ComponentListRow` rows with per-category "Load more" paging, a list-shaped loading skeleton, and thumbnails governed solely by the `showListViewThumbnails` admin setting via `getListViewSettings`. The mobile search input now renders white (`bg-white border border-border`) to match the desktop sidebar search instead of inheriting the cream `bg-bg-primary` default. Mobile category pills keep the `overflow-x-auto` horizontal scroll pattern. Features shared Header component, search, sort (newest, downloads, updated, rating, and verified), category sidebar, featured section, component cards grid, submit link, AuthoringBanner (above FAQ), FAQSection, and a For Agents section at the bottom with links to `llms.txt`, `components.md`, and the official-only `get-convex-llms.txt` / `get-convex.md` lists. No auth required to view. Sidebar uses `sticky top-20` positioning so Submit button remains visible below the header when scrolling. Category sections show 12 cards maximum with "View all" link to category landing page (`/components/categories/:slug`). Desktop sidebar categories and mobile category pills now use direct links to category landing pages instead of the old in-page filtered directory state, and the root "All" link now points to `/components/`. Typing in the search bar scrolls the page to the top so filtered results are immediately visible. The page still uses low-bandwidth one-shot Convex fetches, but now refetches on focus, page-show, and tab visibility restore so freshly updated npm counts appear without restoring a live subscription. Search term, sort and "load more" progress are saved on the history entry (`readHistoryState`/`updateHistoryState`), and the catalog renders from the session cache when revisited, so Back returns to the same cards and scroll position. It follows `?q=` changes from the header search while mounted.

### `src/pages/CategoryPage.tsx`

Category landing page at `/components/categories/:slug`. Features:
- Shared Header component
- "For Agents" section at the bottom linking to `<slug>-llms.txt` and `<slug>.md` (via `buildCategoryClientUrls`), plus the full directory files
- Breadcrumb navigation (`Components / {CategoryLabel}`)
- Category title, description, and component counts (total and verified)
- Scoped search within the category (mobile search input uses the same white `bg-white border border-border` styling as the Directory page so it stays consistent on mobile)
- Sort controls (downloads, newest, verified, updated, rating)
- Category sidebar with links to other categories (linkMode)
- Mobile category chips with links
- Paginated component grid (24 per page)
- Cards render without thumbnails when the category has `hideThumbnails` set in admin, or when the individual component has `hideThumbnailInCategory` set. When the category has `showAllThumbnails` set, every card with a `thumbnailUrl` shows it regardless of `hideThumbnailInCategory`. This page is the only place that reads the flag, so the Directory homepage is unaffected.
- Previous/Next pagination controls with page indicator
- Breadcrumb and back-to-all links normalized to `/components/`
- Search scrolls page to top so filtered results are immediately visible
- FAQSection at the bottom
- 404 handling for invalid or disabled categories

### `src/pages/SubmitForm.tsx`

Dedicated component submission form page at `/submit`. Features:
- Shared Header component with auth state
- Uses the same `max-w-7xl` page shell pattern as the submissions directory while keeping the submission card UI
- Auto sign-in redirect: unauthenticated users are automatically redirected to WorkOS sign-in via `useEffect` hook
- Stores return path in localStorage before redirect; `AuthCallback` returns user to `/submit` after auth
- For unauthenticated users: shows "Redirecting to sign in..." loading state
- For authenticated users:
  - Full submission form with all fields
  - 3 checkboxes at bottom of form (FAQ read, guidelines compliance, permission to share)
  - Submit button disabled until all 3 checkboxes are checked
  - FAQSection component below form
  - Terms of Service and Privacy Policy links at bottom
- Form collects: component name, GitHub repo, npm URL, demo URL, category, descriptions, tags, video URL, logo upload, optional component thumbnail (16:9, 1536x864 recommended, webp/png/jpg, max 3MB), submitter info
- Category dropdown uses `useDirectoryCategories()` ids, matching the admin category source of truth and backend stored category values
- Uses the v2 "Generate Component Directory Content" flow to draft Description, Use cases, How it works, and a README excerpt with editable previews before submission
- Generated-content textareas are vertically resizable so submitters can drag them taller while editing
- README preview helper explains whether Convex include markers were found and links to the official template marker setup
- Opens a warning modal before generation and surfaces the shared once-per-hour cooldown if the user tries to regenerate too soon
- Tags sent as comma-separated string (matching `submitPackage` validator `v.optional(v.string())`)
- Preflight check link below header: prominent card with icon directing users to `/components/submit/check` to validate their repo before submission
- Success modal with horizontal action buttons (View My Submissions, Back to Directory) using the standard rounded-lg button shape instead of pill styling
- Error modal for submission failures with proper ConvexError extraction so backend messages (e.g. duplicate package name) surface to the user instead of generic "Server Error"

### `src/pages/Submit.tsx`

Submissions directory at `/submissions`, admin only (@convex.dev email; non-admins are redirected to `/components` by `SubmissionsGate` in `main.tsx`, and its backing queries return empty pages for non-admins). Table-based UI showing submitted components with expandable rows. Features:
- Shared Header component with auth state
- Page layout matching Directory.tsx width (`max-w-7xl`)
- Title "Components Submissions Directory" styled to match Directory page
- Search and sort controls with white background search input
- Pagination with default page size loaded from admin setting (20, 40, or 60)
- Page navigation controls with range display and previous/next actions
- Desktop table keeps `Maintainer`, `Downloads`, `Submitted`, and `Status` in equal-width metadata columns while package publish dates now live in the expanded details panel instead of the collapsed row
- Desktop collapsed rows use consistent vertical centering for the version pill, status badge, approved detail link, downloads, and submitted date so each metadata item sits on one visual center line
- Expandable package rows with install command, license, size, files, published date, submitted date, and maintainers
- npm/Repo/Website/Demo/Security action buttons per package (Security opens a security report modal with scan date or "Not yet scanned", providers, recommendations, and contact author section; no safe/warning/unsafe status labels)
- Status badges (pending, in review, approved, changes requested, rejected)
- Badge snippet with README markdown, copy button, and live preview for packages with slugs
- Submit button links to `/submit` (auth-gated form page)
- About modal with status legend and Badges section (Convex Verified, Community)

### `src/pages/Profile.tsx`

User profile page for managing submitted components. Accessible at `/profile`. Features:
- Shared Header component with auth state
- Sign-in gate for unauthenticated users with Sign In button calling `signIn()` directly
- Lists all components submitted by the authenticated user (via submitterEmail or additionalEmails)
- Submission cards show `thumbnailUrl` when present (including submitter-uploaded thumbnails from `SubmitForm` via `getMySubmissions`)
- Shows review status (pending, in_review, approved, changes_requested, rejected) and visibility badges using consistent styling synced with Submit.tsx and Admin.tsx
- "Send Request" button to send notes to admin team (request re-review, removal, or updates)
- "Update README" button (between Edit and Send Request, shown only when the submission has a repo URL) calling `packages.refreshMyReadme`, which verifies ownership, enforces a 3-per-10-minutes per-user rate limit, and schedules the same `internal.seoContent.refreshReadme` GitHub fetch the admin flow uses; rate limit errors surface in the toast and a 60 second client cooldown prevents double clicks
- "View Notes" modal showing private user/admin messages with notification badge for unread admin replies. Messages mirrored from a GitHub issue reply (`source === "github"`) carry a small "via GitHub @login" pill (Phosphor `GithubLogo`) that links to the comment, so the submitter understands why their GitHub comment appears in the thread
- Message lifecycle controls on user-authored messages: hide, archive, and delete
- Uses the same `max-w-7xl` shell pattern as the submissions directory while preserving the white bordered profile cards
- "Edit" button routes to `/profile/edit/:packageId` (`ProfileEditSubmission.tsx`) with logo and component thumbnail upload (add, replace, remove; same rules as SubmitForm)
- Any remaining content preview calls now pass the new preview source metadata expected by the shared rate-limited generation action
- Links to view approved components
- Badge snippet with README markdown, copy button, and live preview for submissions with slugs
- Submission cards carry `id="pkg-<packageId>"` anchors so the header notifications bell can link to `/components/profile#pkg-<id>` and scroll + ring-highlight the targeted card for two seconds. The notes modal "Mark all read" control is now a visible secondary button (`px-3 py-1.5` rounded pill) instead of a small text link. Admin-authored messages with `userHasRead === false` show a per-message "Mark read" pill (no icon) that calls `markPackageCommentReadForUser`; that pill renders in the same action row as the existing Hide / Archive / Delete controls (after Delete when both apply) using `flex-wrap` so the row stays on a single line whenever possible. Marking messages read is fully opt-in: there is no auto-mark on modal open, so the bell badge stays until the user clicks either the per-message "Mark read" or the bulk "Mark all read" pill.
- Every modal on the page (`RequestModal`, `ViewNotesModal`, `EditModal`, `ApiUsageModal`) now closes on `Escape`; the edit and request modals are guarded so ESC does not dismiss while a submit is in flight.
- Status Guide with all 6 statuses (Pending, In Review, Approved, Changes Requested, Rejected, Featured) synced with Submit.tsx and Admin.tsx
- Visibility Guide (Visible, Hidden) with removed Archived and Pending Deletion states
- Badges section showing Convex Verified and Community badge explanations
- "Need help?" section directing users to use "Send Request" for component removal or account changes (no self-service delete)
- Submit New button linking to submission form
- Note: Visibility controls (Hide/Show/Delete) removed from user profile; users must contact admin via "Send Request" to manage visibility

### `src/pages/ProfileEditSubmission.tsx`

Dedicated full-page editor for a user's own submission at `/profile/edit/:packageId` (opened from Profile Edit). Reuses the v2 generated content flow from submit, includes a back link to the profile page, keeps the same ownership-protected backend queries and mutations, uses the submissions-directory width shell with white bordered cards, and gives submitters a wider editing workspace for generated text, README preview, and package metadata updates. Logo and component thumbnail sections support preview, replace, and remove; thumbnails use the same 16:9 / 3MB rules as SubmitForm and set `thumbnailUploadedByUser` via `saveThumbnail` / `clearThumbnail`. Regeneration opens the same warning modal plus shared once-per-hour cooldown behavior used on submit. The Description, Use cases, and How it works sections render as three `DocSectionEditor` instances in one divided card: rendered markdown by default (matching the public component page), a Preview / Edit toggle per section, and an auto-growing textarea in edit mode that keeps the bottom-right drag grip for manual expansion. A Links section at the top of the form groups the editable GitHub Repository URL, npm URL, Live Demo or Example App URL, and Video URL inputs; changing the repo or npm URL triggers an automatic security re-scan and a Slack notification to the Convex team via `updateMySubmission`. The info box shows Repo and npm as links opening in new tabs (the Package name line was removed since users submit the repo and npm URLs directly).

### `src/pages/Dashboard.tsx`

Component analytics dashboard at `/dashboard` (requires @convex.dev email). Shows stat cards (total components, community, community approved, community rejected, get-convex, get-convex since Oct 2025, weekly downloads, all-time downloads), filterable components table with sortable columns, author summary table with download totals, and monthly submission timeline with community/team split bars. Filters include search, type (all/community/get-convex), review status (all/approved/not approved/pending/in review/changes requested/rejected), date range with custom date picker (From/To), and multi-select author exclusion checklist (hide/show individual authors). CSV and PDF export buttons in the Components table header export the current filtered view (CSV triggers a file download, PDF opens a print-friendly report in a new window). The table now includes a per-package refresh icon beside weekly downloads plus a bulk `Refresh all` button beside CSV, reusing the existing admin refresh actions and the approved-package throttled refresh queue. The per-package table has a sortable All Time downloads column next to Wk Downloads (shows an em dash until a package's first refresh backfills the true all-time value); number formatting supports a `B` tier for billion-scale counts. A sortable "Last npm Sync" column sits right after Last Published and renders `lastRefreshedAt` as a relative age (with the absolute timestamp on hover), "Never" when a package has never synced, amber text past seven days, and a red warning icon carrying the `refreshError` text when the last sync failed; the matching "npm Sync" filter narrows to synced last 24h, synced last 7 days, stale over 7 days, never synced, or sync errors. Both CSV and PDF exports include the sync value. Auth gate matches Admin.tsx pattern. Uses `bg-bg-primary` background with white cards matching app design system.

### `src/pages/Admin.tsx`

Admin dashboard at `/submissions/admin` (requires @convex.dev email). The Submit Listing Settings panel holds the default submissions page size buttons plus the "Show thumbnails in list view" toggle (`showListViewThumbnails`), the global list-view-only thumbnail override for the public Directory. Features shared Header component, admin-specific search bar, stats, package management, review status, visibility controls, AI review, component details editor, thumbnail preview in list, admin-only notes, private submitter/admin messages, CSV export, and SubmitterEmailEditor for managing submitter name, Discord username, primary email, and additional emails. Author info is collapsed behind an `AuthorToggleSection` toggle to reduce card clutter and protect PII at a glance. All three collapsible admin sections (Component Author, Component Details, Package Metadata) use a consistent click-anywhere-to-expand pattern with keyboard accessible `div` wrappers instead of isolated buttons. The Send Reward button is disabled for packages not in `in_review` or `approved` reviewStatus, with a tooltip explaining the requirement. Pagination with configurable items per page (5, 10, 20, 40, 100) and page navigation controls; each filter tab maintains independent page state. Default filter is "all" to show complete submission overview. Filter tabs now use a horizontal mobile scroller with readable labels while preserving wrap-friendly desktop behavior, and tooltips appear above the bar for better visibility. Filter tabs include a "Deletion" tab (Clock icon) to show packages marked for deletion, with count badge. The submissions sort dropdown supports `newest`, `oldest`, `name_asc`, `name_desc`, `downloads`, `approved_at`, `verified`, `community`, and `featured` (UI labels include Recently approved, Verified first, Community first, and Featured first). When the Recently approved view is active, package rows and the expanded calendar tooltip switch from submitted date display to the existing approval date when available. Package rows display badges in order: StatusBadge, VisibilityBadge, and ComponentDetailQuickLink (external link icon) as the last item before the downloads/date section, and the desktop collapsed row now keeps the version pill, status badge, visibility badge, detail link, downloads, and date visually centered on the same line. A red "Deletion" badge appears next to the visibility badge when marked for deletion. Featured toggle shows a sort order input when package is featured (lower numbers appear first in Featured section, independent of directory dropdown sort). Expanded package InlineActions includes Actions row (above Status row) with Convex Verified toggle, Community toggle, Regenerate SEO + Skill button, a hide or show SEO toggle for keeping generated SEO and SKILL content off the public detail page while editing, Hide Thumb toggle (when a thumbnail exists; syncs with `ComponentDetailsEditor` via shared `hideThumbnailInCategory` field), combined Auto-fill button, Refresh npm data button, Generate Slug button (when no slug exists), Send Reward button, a reward history count button that opens a modal showing past reward attempts, statuses, notes, recipient email, and Tremendous links when available, plus a new AI review history count button that opens a right-side drawer for previous AI review runs. Reward send and test reward modals now label the optional Tremendous field as a recipient-facing message so it matches delivered email behavior. Category Management now shows both total component counts and verified component counts per category, migrates package category slugs when a category slug is edited, and clears package category references when a category is deleted so public category pages do not orphan package records. Category rows, settings navigation, and API access rows now stack and wrap cleanly on phones so badges, descriptions, and action buttons stay inside the card width. AI Review Results panel is collapsed by default showing only status icon, label, and date; clicking expands to reveal summary, error, and criteria checklist. The new AI review history drawer keeps the latest inline result intact while adding a run list, score summary, provider/model metadata, reviewer attribution, criteria checklist, raw model output, and delete controls for older saved runs while protecting the current latest review snapshot. The drawer now also closes on `Escape`, except while the delete confirmation modal is open. Expanded mobile editor surfaces were tightened so Component Author, Package Metadata, AI Review Results, and the nested Component Details editor no longer widen past the viewport: long submitter strings wrap safely, the author edit form stacks to one column on phones, AI review headers get shrink-safe text columns, expanded metadata or review bodies add local overflow guards instead of stretching the full page, the parent expanded package shell now uses `items-stretch` with a full-width left content column so nested sections inherit the actual card width on mobile instead of sizing to their contents, and the final pass slightly trims mobile padding and top spacing so expanded sections feel denser without changing desktop spacing. Settings tab includes a three-toggle AI automation workflow: `Auto AI review` queues eligible submissions, moves them into `in_review`, and can queue current pending repository-backed packages when enabled, while `Auto-approve on pass` and `Auto-reject on fail` stay disabled until auto review is on and remain optional outcome automations. `Auto AI review` defaults to off. The settings tab also includes Submit Listing Settings for controlling the default page size on `Submit.tsx` (20, 40, 60), Deletion Management panel for managing packages marked for deletion (auto-delete toggle, waiting period config, list of pending deletions with "Delete Now" option), Slug Migration panel for detecting packages without URL slugs and generating them in bulk or individually, AI Provider Settings panel for configuring Anthropic/OpenAI/Gemini providers, AI Prompt Settings panel for versioning AI review prompts, SEO Prompt Settings panel for versioning SEO/SKILL.md generation prompts, a Tremendous `RewardSettingsPanel` with auto-send toggle, default reward amount, payment stats, and a settings-only `Send Test Reward` modal that sends to `TREMENDOUS_TEST_RECIPIENT_EMAIL` while recording `isTest` payments without changing component paid state, and a `showRelatedOnDetailPage` toggle (on by default) that controls visibility of the Related Components section on detail pages, plus a Downloads Display panel with `showWeeklyDownloads` (default on) and `showAllTimeDownloads` (default off) toggles controlling which download numbers appear on the public Directory, CategoryPage, and ComponentDetail pages (both on = side by side). The SEO Prompt Settings help text and placeholder reference now explicitly describe README first grounding and Convex docs context placeholders so the admin UI matches the runtime generator. The AI Review Settings help text now matches the v6 review model, including repo-wide `defineComponent()` source detection, the critical `package.json` entry point check, the 9 critical plus 5 advisory criteria split, and the shared `Convex component review criteria (v6 - updated 2026-03-13)` status label shown in both the review help copy and AI Prompt Settings panel. The long settings view now has anchored section wrappers, a sticky jump bar on smaller screens, and a sticky in-layout right-side section nav on extra-wide screens with sticky positioning applied to the sidebar container so the rail stays pinned while the settings page scrolls. The API tab now hides the generic submissions list while active, uses wrap-safe endpoint bars, shows recent request cards on mobile instead of squeezing the desktop table, and keeps grant/revoke controls usable around long names and emails. Private message panels support authored message lifecycle actions (hide, archive, restore, delete) plus a toggle to include hidden and archived messages in the thread view. When the package has a github.com `repositoryUrl` (checked client side by `isGitHubRepoUrl`, mirrored server side), the user-messages compose area shows an "Also send as a GitHub issue" checkbox that passes `alsoCreateGithubIssue` to `addPackageComment`; each message then renders its GitHub state reactively (Opening GitHub issue..., a "Sent as GitHub issue" or "Sent as GitHub comment" link depending on `githubMirrorKind`, a "Closed" pill when `githubIssueState === "closed"`, or "GitHub issue failed" with the error). The checkbox label reads from `githubIssues:getOpenIssueForPackage`: "Also send as a GitHub issue" when none exists, "Also reply on the open GitHub issue" when one is open, or "Open a new GitHub issue (previous one is closed)". Replies mirrored back from GitHub (`source === "github"`) show a "via GitHub @login" pill linking to the comment and count as unread submitter messages. Both the user-messages panel and the admin-notes panel expose a visible "Mark all read" pill button next to the unread badge that calls `markCommentsAsReadForAdmin` or `markNotesAsReadForAdmin` respectively. GitHub Broadcast is no longer in Settings. A top-level Broadcast tab next to Logs (`GithubBroadcastSection`) holds compose, reply sync, and history as three cards: Approved / Pending / Rejected / All filter pills with a live eligible-vs-skipped count and duration estimate from `githubIssues:getBroadcastTargetCount`, issue title and body inputs, a Send button that opens `ConfirmModal` with the exact recipient count, a Reply sync card (on/off pill wired to `githubReplySync:setReplySyncEnabled`, token login and source, last poll, last result, last error from `getSyncStatus`, plus Test connection and Sync now buttons), a Show archived toggle, and a Broadcasts history list (`listGithubBroadcasts`) where each `BroadcastHistoryRow` shows a status pill (including Archived), sent/failed/skipped/replies counters, a live progress bar, a Cancel control while running (behind a danger `ConfirmModal`), Archive (completed or cancelled), Restore (archived), and Delete (not running, behind a danger `ConfirmModal` that states reply sync stops for that broadcast's issues) pills, and expands to per-package results from `getBroadcastItems` with issue links, reply counts, Closed pills, and error text. Starting a new broadcast is disabled while one is running. The Broadcast tab itself shows a sending pill while a job is running. `#settings-github-broadcast` still opens this tab. `isAdminToolTab` hides the package submissions list on Settings, API, Logs, Growth, and Broadcast. Auto-mark-all-on-open has been removed from both panels so the new per-message pills are actually visible to the admin. Every unread submitter comment in the user-messages panel shows a green "New" badge next to the author meta and a per-message "Mark read" pill (no icon) placed on its own row beneath the message content, wired to `markPackageCommentReadForAdmin`; the gate is `comment.adminHasRead !== true` so admins testing from their own `/profile` still see the pill. The `ConfirmModal`, reward confirm, reward history, and test reward confirm modals all close on `Escape` (with in-flight send guards on the two reward confirms). Package rows carry `id="pkg-<packageId>"` anchors; navigating to `/components/submissions/admin#pkg-<id>` from the header notifications bell auto-expands that package, scrolls it into view, and applies a four-second `#E05C35` ring highlight. The hash handler switches `activeFilter` (to `all`, `archived`, or `marked_for_deletion`) and sets `currentPage[activeFilter]` to the computed page when the target is not visible in the current client-side paginated view, and the dedicated scroll effect re-runs on `activeFilter` / `currentPage` changes so the jump actually scrolls into view even when the target lives on page 2+. The Settings tab holds `CategoryManagementPanel`, which adds, edits, reorders, and enables categories through `packages:upsertCategory`, plus a switch for the derived Official Convex Components category (`packages:setOfficialCategoryEnabled`) whose row is marked "auto" and has its slug input locked. The Official Convex Components block also holds the "Auto-update READMEs" pill toggle, schedule select (every hour / day / 3 days / week / month), and last-run stamp wired to `readmeAutoUpdate:getOfficialReadmeAutoUpdateSettings` / `updateOfficialReadmeAutoUpdateSettings`. Each category edit form carries a "Hide all thumbnails in this category" checkbox that flattens the category landing page and grouped directory section to text-only cards, surfaced in the list as a "thumbnails hidden" badge, and a mutually exclusive "Show all thumbnails on the category page" checkbox (`showAllThumbnails`). That option overrides per-component `hideThumbnailInCategory` on the landing page only, leaves the Directory homepage unchanged, and shows a "thumbnails shown on page" badge. A top-level Logs tab (`ReadmeUpdateLogsTab`) lists README update attempts from `readmeUpdateLogs` in a Convex-logs-style table (time, package, source, status, changed, message) with status and source filter selects, a package-name text filter, row checkboxes with select-all, Delete selected and Clear logs behind `ConfirmModal`, and Load more pagination via `usePaginatedQuery`. Non-admin users are automatically redirected to their profile page. Unauthenticated users see a simple "Admin access only" sign-in prompt.

### `shared/aiReviewPromptMeta.ts`

Shared AI review prompt metadata. Defines the single source of truth for the visible review prompt version label, version number, and updated date so `convex/aiReview.ts`, `convex/aiSettings.ts`, and `src/pages/Admin.tsx` stay in sync.

### `shared/buildSkillMd.ts`

Pure helper that builds SKILL.md content from v2 content model fields (description, useCases, howItWorks). Shared between `convex/seoContent.ts` (action, "use node" runtime) and mutation files (`convex/packages.ts`, `convex/seoContentDb.ts`) so that SKILL.md is generated during submit, profile edit, admin edit, content model migration, and admin regeneration. Runs `useCases` and `howItWorks` through `normalizeMarkdown` before assembly. Emits the npm version in the YAML frontmatter (`version:`) and a pinned `Current npm version: package@x.y.z` line after the install command, plus a one-line agent instruction blockquote right after the frontmatter.

### `shared/reviewCriteria.ts`

The 14 AI review criteria (name, check, critical flag; first 9 critical) and `isCriticalCriterion(name, index)`, which matches by name and falls back to position. Copy of `REVIEW_CRITERIA` in `convex/aiReview.ts`; keep both in sync until that file imports this one.

### `shared/reviewMessages.ts`

Pure builders for review outcome messages. `buildRejectionMessage` lists blocking critical failures first, then advisory ones, skips "Unable to check" notes, falls back to the review summary, and ends with the Component Preflight Check link (`PREFLIGHT_CHECK_URL`) and the authoring guide. `buildApprovalMessage` includes the listing link from `directoryListingUrl` and no preflight link. `hasRejectionReasons` gates draft creation so no message ships without real reasons.

### `shared/repoUrl.ts`

Single provider aware repository URL parser used by both the browser and the Convex runtime (URL API only, no Node). `parseRepoUrl` returns `{ provider: "github" | "gitlab", host, owner, repo, projectPath, ref?, dir, webUrl }` or `null`, accepting https, http, `www.`, `git+https://`, `git@host:` ssh, trailing `.git`, trailing slash, `#fragment`, GitHub `/tree/<ref>/<dir>` and `/blob/<ref>/<file>`, GitLab `/-/tree/<ref>/<dir>` and `/-/blob/<ref>/<file>`, and GitLab nested groups (project path is everything before `/-/`). Lookalike hosts (`notgithub.com`, `github.com.evil.com`) are rejected. Also exports `isSupportedRepoUrl`, `providerLabel` ("GitHub" | "GitLab"), `repoHostLabel(url)` for UI copy, and URL builders `repoBlobUrl`, `repoRawUrl` (`raw.githubusercontent.com` or `/-/raw/`), `repoIssuesUrl` (`/issues` or `/-/issues`), and `repoOwnerUrl`. Replaced six duplicated GitHub regexes across `packages.ts`, `seoContent.ts`, `http.ts`, `markdownLinks.ts`, and the submit pages. `convex/githubIssues.ts` keeps its own GitHub only gate so write flows never reach GitLab. GitHub owners pass through `GITHUB_OWNER_RENAMES` (`get-convex` to `convex`), so `parseRepoUrl` always returns the current org; `canonicalGithubOwner` and `githubOwnerAliases` (for search) are exported too.

### `convex/orgRename.ts`

One-off internal migration `migrateConvexOrgRename({ dryRun })` for the GitHub org rename. Rewrites `repositoryUrl` (`github.com/get-convex/` to `github.com/convex/`), `authorUsername` and `authorAvatar` on packages, and the official category description. Slugs and public URLs are untouched. Running it again changes nothing. Run with `npx convex run orgRename:migrateConvexOrgRename '{"dryRun":true}'` (add `--prod` for production).

### `shared/officialComponents.ts`

Single definition of an "official" Convex component: repo in the `github.com/convex` org (or its former name `get-convex`), or an `@convex-dev/` scoped npm name. Exports `OFFICIAL_CATEGORY_SLUG` (`"get-convex"`, kept because it is part of public URLs) and `isOfficialComponent()`. Used by the derived official category in `convex/packages.ts` (count, landing page, and listing membership) and by the official-only endpoints in `convex/http.ts` (`/components/get-convex-llms.txt`, `/components/get-convex.md`).

### `shared/normalizeMarkdown.ts`

Composable markdown cleanup pipeline for LLM- and user-authored content before remark-gfm parses it. Exports `MarkdownNormalizer`, individual normalizers (`normalizeLineEndings`, `normalizeUnicodeBullets`), and `normalizeMarkdown()` which runs `DEFAULT_MARKDOWN_NORMALIZERS` in order. Used by `src/components/Markdown.tsx`, content generation (`convex/seoContent.ts`), package saves (`convex/packages.ts`), markdown/llms HTTP output (`convex/http.ts`, `convex/router.ts`), and `shared/buildSkillMd.ts`. Add new normalizers to the default array when more predictable-parse fixes are needed.

### `shared/sanitizeMarkdown.ts`

Write-time cleanup for submitter-controlled markdown. `stripUnsafeHtml()` parses the markdown with `mdast-util-from-markdown` (once with GFM, as the page's `remark-gfm` does, and once as plain CommonMark, plus the `normalizeMarkdown` view the page renders), and only in its raw HTML nodes removes script-capable HTML: `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<svg>`, `<math>`, `<meta>`, `<link>`, `<base>` and similar (with their contents where they have any), `on*` handlers, `srcdoc`, `formaction`, and `javascript:` / `vbscript:` / `data:` URLs. Tags and comments are found with a small linear tokenizer that follows the HTML spec for where a tag or comment ends. The normalized text is only stored when normalizing exposes HTML that needs cleaning. Code blocks and inline code are left alone, and ordinary README HTML (images, `<picture>`, `<details>`, `align`) is unchanged. Used when saving `longDescription`, `generatedUseCases`, `generatedHowItWorks` and `readmeIncludedMarkdown` (`convex/packages.ts`, `convex/seoContent.ts`, `convex/seoContentDb.ts`). Defense in depth for the REST API, llms.txt, SKILL.md and markdown exports; the detail page sanitizes again on render (`src/lib/markdownSanitize.ts`).

### `src/lib/markdownSanitize.ts`

`rehype-sanitize` schema for `MarkdownRenderer`: rehype-sanitize's GitHub-style `defaultSchema` plus `<video>` and the classes and `<svg>`/`<path>` icons that `remark-github-blockquote-alert` emits. Elements like `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>` and `<form>` are removed with their contents. Ids and names get a `user-content-` prefix (DOM clobbering), and `toUserContentHash()` rewrites in-page `#links` to match.

### `src/lib/markdownLinks.ts`

Resolves relative links and image sources inside rendered README markdown against the source GitHub or GitLab repository (consumed by `src/components/Markdown.tsx`). Uses `parseRepoUrl` from `shared/repoUrl.ts` for `owner`, `repo`, `ref` (branch/tag from a `/tree/<branch>/`, `/blob/<branch>/`, `/-/tree/<branch>/`, or `/-/blob/<branch>/` URL, else `HEAD`), and the README's subdirectory (for monorepo URLs like `github.com/PostHog/posthog-js/tree/main/packages/convex`). `resolveWithinRepo` resolves a target against the README's subdirectory using URL semantics, so relative links (`./`, `../../examples/...`) climb correctly while root-relative `/x` maps to the repo root; query strings and `#fragments` are preserved. `resolveRepositoryMarkdownHref` builds the provider blob URL through `repoBlobUrl` (GitHub `/blob/<ref>/<path>`, which 301-redirects `/blob/<dir>` to `/tree/<dir>` so directory links work; GitLab `/-/blob/<ref>/<path>`); `resolveRepositoryImageSrc` builds the raw URL through `repoRawUrl` (`raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>` or `gitlab.com/<ns>/<project>/-/raw/<ref>/<path>`). Anchors (`#...`), absolute URLs (`http:`, `mailto:`, etc.), and protocol-relative (`//...`) URLs pass through unchanged. Without a parseable repo URL, the original href/src is returned as-is.

### `shared/seoPromptTemplate.ts`

Shared SEO prompt template and placeholder list. Keeps the default SEO fallback prompt aligned between `convex/aiSettings.ts`, `convex/seoContent.ts`, and the Admin SEO Prompt Settings UI while adding placeholders for GitHub README grounding and Convex docs context. The v2 content prompt requires `useCases` as markdown unordered lists with `- ` per line (not Unicode bullets).

### `src/pages/Documentation.tsx`

Admin-only documentation viewer at `/components/documentation`. Features:
- Admin gating via `api.auth.isAdmin` query
- Non-admins see "Admin Access Required" message with link back to directory
- Markdown content loaded from `src/docs/*.md` files via Vite raw imports
- Three-column layout: left navigation sidebar, main content, right "On this page" outline
- Left sidebar groups docs into Getting Started, User Guide, Admin Guide, and Integrations sections. Admin Guide includes GitHub Broadcast (`admin-broadcast`) next to Settings.
- Active navigation item highlighting
- Client-side section routing for docs sidebar navigation to avoid full page reloads and repeated auth spinner on section clicks
- Right sidebar shows H2/H3 headings from current doc with anchor links
- Enhanced markdown rendering matching ComponentDetail.tsx: code blocks use Pierre Diffs (`@pierre/diffs`) with syntax highlighting, line numbers, and copy button; `rehype-raw` for inline HTML; video URL detection; GFM tables with header backgrounds and alternating rows; polished formatting for inline code, blockquotes, ordered and unordered lists, horizontal rules, and images
- Copy as Markdown button copies raw markdown to clipboard
- Download as Markdown button downloads .md file
- Sets `<meta name="robots" content="noindex, nofollow">` to prevent indexing
- Mobile responsive with collapsible navigation
- Styled with Convex design system (warm cream background, GT America font)

### `src/docs/`

Markdown documentation files for the admin documentation system:
- `index.md` - Overview, quick links, and technology stack
- `directory.md` - Using the public directory (search, filter, categories, category landing pages, For Agents section)
- `submit.md` - How to submit components (preflight checker, v2 content generation, rate limiting)
- `profile.md` - Managing user profile, submissions, full-page editor, API access, and how admin messages can arrive as GitHub issues with replies flowing back to the thread
- `component-detail.md` - Component detail page features (v2 content model, markdown rendering, help modal, review state handling)
- `admin-dashboard.md` - Admin dashboard overview (Broadcast tab next to Logs, API tab, sort options, expanded view)
- `admin-packages.md` - Package management (author toggle, Component Details editor, rewards)
- `admin-review.md` - Review workflow, statuses, and rewards
- `admin-ai-review.md` - AI review system (v6 criteria, automation workflow, review history drawer)
- `admin-security-scan.md` - Security scanning system (Socket.dev, Snyk providers, manual/batch/auto/scheduled scanning, backlog queue, settings, public visibility, env vars, data model, troubleshooting)
- `admin-seo.md` - Content generation (v2 unified flow, SKILL.md, rate limiting, custom prompts)
- `admin-thumbnails.md` - Thumbnail management
- `admin-settings.md` - Admin settings panel (AI automation, content prompts, category management, Tremendous rewards, environment variables, pointer to Broadcast)
- `admin-broadcast.md` - GitHub Broadcast tab (compose, history, reply sync, classic token setup)
- `admin-notes.md` - Notes and comments system (message lifecycle, sending a message as a GitHub issue, one open issue per package, replies mirrored back from GitHub)
- `mcp.md` - MCP (Model Context Protocol) endpoints, tools, Cursor integration, agent install features, and Components REST API reference
- `api-endpoints.md` - Public API endpoints (REST API, llms.txt, markdown, badge SVG, preflight, Netlify aliases)
- `badges.md` - README badge endpoint, usage, colors, and analytics
- `updating-docs.md` - How to add, edit, and register new documentation pages

### `src/pages/NotFound.tsx`

404 page component with shared Header and navigation back to directory.

### `src/pages/ComponentDetail.tsx`

Component detail page at `/components/:slug`. The video embed (when `videoUrl` is set) renders just below the install command by default, or after the README and generated content when `videoPosition` is `"bottom"`. Includes a `MarkdownErrorBoundary` class component that wraps all `ReactMarkdown` sections (README, Use Cases, How it Works, long description) to catch rendering crashes gracefully without killing the page. Features shared Header component, narrow sidebar (left) with npm link, Discord username (links to Convex community Discord), license, category, stats, verified badge, community badge, source link, rating stars, a `Share this page` dropdown (X, LinkedIn, Bluesky, Reddit, Mastodon, Other... via `navigator.share` with clipboard fallback, and Copy link) rendered between the rating stars and the help trigger and styled to match the page's existing Markdown dropdown (white menu, `shadow-hover`, `role="menu"` with `aria-expanded` and `aria-live` copy announcement), a small `How to get help` modal trigger (rendered above the security box), a single-line `Security Analyze` button (no date subtitle), and Back link. License now renders above Category when available, using the same reactive package payload returned by `getComponentBySlug`, so Admin metadata refresh updates are reflected automatically. When the package category still matches an enabled admin-managed category, the sidebar category pill links to `/components/categories/:slug`; otherwise it falls back to a non-clickable label so public pages do not point to dead category routes. Community badge appears below the verified badge and above the downloads count in the sidebar. The help modal matches the app's existing overlay pattern, points users to GitHub Issues when a repository URL exists, links to `https://convex.dev/community`, and shows a smaller third party component notice for community installs. The security modal now uses the title `Security Analyze`, shows only scan presence and date (e.g. "Scanned 4/2/2026" or "Not yet scanned") with no safe/warning/unsafe status labels, links providers to their external scan sites, locks background page scroll while open, supports the unscanned state in the same modal, hides the page Markdown dropdown while open so the overlay stays focused, and no longer lists individual scan findings in the public modal. Main area (right) with author row (package name, "by" author info, Markdown dropdown, "For Agents" anchor link, then conditional Download Skill button), title, install command, AI-generated SEO content layer, rendered long description, video embed, conditional agent sections, and keywords tags. The visible long description heading now capitalizes the component name before `Description`, while leaving AI-generated SEO copy unchanged. Review-state handling is now explicit: pending, in review, changes requested, and rejected pages only load for the component's owner and admins (`getComponentBySlug` returns null to everyone else, so they see the 404 state) and set `noindex, nofollow`, while only approved pages keep indexable robots behavior and JSON-LD injection. `For Agents`, `AgentInstallSection`, SKILL download actions, the `SKILL.md` block, and the standalone `View llms.txt` link can now all be hidden together by the admin SEO visibility toggle. All markdown sections (Use Cases, How it Works, From the README, and v1 long description) use the shared `.markdown-body` CSS class for GitHub-style heading hierarchy, proper paragraph spacing, nested list bullets, blockquote borders, inline code, and GFM tables, plus `rehype-raw` to render inline HTML from GitHub READMEs (e.g. `<div align="center">`, `<strong>`, badge images), filtered through `rehype-sanitize` (see `src/components/MarkdownRenderer.tsx`). Long description markdown rendering preserves line breaks, uses purple links (`#8D2676`) with hover underline, renders `.mp4`/`.webm`/`.mov` URLs as native `<video>` elements with controls instead of broken images, and now resolves imported README-relative links like `CONTRIBUTING.md` against the GitHub repository instead of the local app. The author row uses `flex-wrap` so long package names truncate gracefully on mobile (`max-w-[280px]` with title tooltip) instead of pushing other elements or causing awkward double wrapping. Markdown dropdown in author row provides open markdown file, copy as Markdown, copy page URL, and quick actions to open the markdown link in ChatGPT, Claude, and Perplexity. Markdown export now uses the same resolved admin-managed category label shown in the UI instead of a stale static fallback. Standalone footer links labeled `{component.name} llms.txt` and `{component.name} SKILL.md` (descriptive anchor text for SEO/AEO) are rendered independently from Keywords when visible. The "Add badge to your README" section (markdown snippet, copy button, live preview) is hidden on the detail page; only the standalone footer links render. Badge snippets remain available on Profile and Submit pages. Below the llms.txt link on desktop, and below the sidebar on mobile, a Related Components section shows up to 3 related components in a no-thumbnail compact card grid; relatedness is scored by shared category, overlapping tags, and download count. The section is controlled by an admin setting (`showRelatedOnDetailPage`, on by default) in the AI Review Settings panel. Link generation now uses a shared client-aware URL helper so localhost opens Convex API endpoints while production uses Netlify alias URLs. Keywords section includes top margin (`mt-8`) so it separates cleanly from code blocks or markdown content above. Includes full SEO support: Open Graph tags, Twitter Card tags, canonical URL, and meta description using AI-generated seoValueProp or shortDescription fallback unless the admin has hidden the generated SEO content from the public page.

### `src/components/DownloadsGrowthTab.tsx`

Admin Growth tab. Renders the cumulative all time npm downloads series (from `api.downloadsGrowth.getGrowthSeries`) as an animated dither dot-matrix chart on a canvas. `syncMonthsToLiveTotal` extends the stored curve through the current month and lands the difference between the snapshot and `liveTotalDownloads` on the final point (clamped so the curve can never dip), so the header number, chart, share image, and video all match the dashboard All Time card without any npm requests. Chart detail:  orange dots rising over a faint dot grid on warm cream, swept left to right with per-column ease-out on load, replay, and refresh, with a one-dot baseline for nonzero months and a hover readout of month, running total, and monthly downloads. Includes a Refresh curve button (runs `generateGrowthSeries`, incremental by default with a mode-aware toast) plus a "Full rebuild from npm" link for a complete refetch, both with tooltips spelling out their npm rate limit cost, a From/To month range selector defaulting to Jan 2025 that frames the chart, image, and video (cumulative totals stay all time), a replay video recorder (share card animation captured off screen at 1200 x 630 via `canvas.captureStream` and MediaRecorder, MP4 preferred with WebM fallback, inline preview and download), and a share image builder that renders a 1200 x 630 PNG at 2x, either a full card with editable serif title, orange total, chart, and footer, or a chart-only variant, with download, copy to clipboard (falls back to download), and post on X (copies image, opens prefilled draft) actions.

### `src/components/ComponentListRow.tsx`

Compact horizontal row for the directory list view. Same data props as `ComponentCard` (name, curated badges, Verified/Community pills, truncated description, author avatar and username, weekly and all-time downloads with the same k/M/B formatter and display flags). Renders an optional fixed-size 16:9 thumbnail (`w-28 sm:w-32`, lazy loaded) on the right when `showThumbnail` and a `thumbnailUrl` are set; in the Directory this flag comes from the global `showListViewThumbnails` admin setting, which applies to list view only and overrides per-category and per-component thumbnail hide flags. Whole row is a link with the same href logic as the card.

### `src/components/ComponentCard.tsx`

Component card for directory listing. Shows thumbnail, name, description, downloads, version, verified badge, and community badge. Accepts `allTimeDownloads` plus `showWeeklyDownloads` / `showAllTimeDownloads` display flags (driven by the admin Downloads Display toggles) and renders `X/wk`, `Y total`, or both side by side; the compact formatter supports k/M/B tiers and the all-time figure is hidden (never 0) when a package has no stored value. Thumbnails use `thumbnailImageProps` from `src/lib/images.ts` (resized srcset with a fallback to the original) and avatars use `avatarUrl`; the `priority` prop loads the thumbnail eagerly with `fetchpriority="high"` (used for the above-the-fold Featured row). Supports `showThumbnail` prop to conditionally hide thumbnails (used for hiding thumbnails in category listings while showing them in Featured section). Badge placement behavior: when a component has only Community, it uses the same right-side badge position as Verified; when both badges are present, Community appears before Verified. The Community pill is text-only (no person icon); Verified keeps its check icon. Curated category badge images (from the `curatedBadges` prop) render inline in the title, right before the first letter of the component name, with the category label as tooltip; badge-less curated memberships render nothing.

### `src/components/CategorySidebar.tsx`

Category filter sidebar for the directory page. Uses category totals from `listCategories` and accepts verified counts in the query contract for consistency with admin category metrics. Supports `linkMode` prop: when false (default), categories trigger `onSelectCategory` callback for in-page filtering; when true, categories render as links to `/components/categories/:slug` and use `/components/` for the root "All" link on the main directory and category landing pages.

### `src/components/SearchBar.tsx`

Reusable search input with clear button.

### `src/components/VerifiedBadge.tsx`

Reusable "Convex Verified" badge component with green background styling.

### `src/components/AuthoringBanner.tsx`

Promotional banner for Component Authoring. Dark background with inline SVG grid texture, white title, gray description, and "Learn more" button with pink/magenta border. Responsive layout with column stacking on mobile. Placed at the bottom of the Directory page above the FAQ.

### `src/components/CommunityBadge.tsx`

Reusable "Community" badge component for community-submitted components. Displays with `#E9DDC2` background color and PersonIcon. Supports `sm` and `md` size variants.

### `src/components/InstallCommand.tsx`

Copy-to-clipboard install command component.

### `src/components/AiLoadingDots.tsx`

Shared pulsing loading indicator for AI generation surfaces. Uses Phosphor `DotsNine` icon with `animate-pulse` and a short "AI is working" label. Used in SubmitForm, ProfileEditSubmission, and Admin content generation buttons and warning modals.

### `src/components/markdownComponents.tsx`

Shared `react-markdown` component overrides used across submit preview, detail page, and profile edit. Handles fenced code blocks via Pierre Diffs, renders GFM tables with GitHub-style borders and alternating row shading, images with video detection for `.mp4`/`.webm`/`.mov` URLs, and table layout. Heading, paragraph, list, blockquote, and horizontal rule styles are provided by the parent `.markdown-body` CSS class in `src/index.css` rather than inline component overrides.

### `src/components/CodeBlock.tsx`

Shared markdown code block renderer built on `@pierre/diffs/react`. Normalizes README and generated-content fenced code blocks into Pierre `FileContents`, adds syntax highlighting plus line numbers, passes the correct `name` field so markdown rendering does not crash on migrated detail pages, and includes a built-in copy button. Plain text code blocks (no language tag, or `text`, `txt`, `plaintext`, `plain`) render as a simple `<pre>` element instead of PierreFile to prevent potential syntax highlighter hangs on non-code content like Unicode box-drawing diagrams. Languages missing from Shiki's `bundledLanguages` use the same `<pre>`, because `@pierre/diffs` throws an uncaught rejection and renders an empty block for them.

### `src/components/CodeBlockLazy.tsx`

Lazy-loading wrapper around `CodeBlock` with the same props. Uses `React.lazy` so the `@pierre/diffs` and Shiki highlighter chunk (about 325 KB) stays out of the initial bundle, with a plain `<pre>` Suspense fallback matching CodeBlock's text branch so code paints at the correct size before syntax colors arrive. Imported in place of `CodeBlock` by `ComponentDetail.tsx`, `MarkdownRenderer.tsx`, and `AgentInstallSection.tsx`.

### `src/components/Markdown.tsx`

Lazy-loading wrapper that exports `Markdown` (same props as the renderer), loading the chunk through `src/lib/markdownChunk.ts`. Keeps react-markdown, rehype-raw (parse5) and the remark/micromark stack (about 290 KB minified) out of the initial bundle so the directory and category pages don't pay for it. `ComponentDetail.tsx` calls `preloadMarkdown()` (from `src/lib/markdownChunk.ts`) on mount so the chunk downloads alongside the component data.

### `src/components/MarkdownRenderer.tsx`

The actual markdown renderer (react-markdown with GFM, GitHub alerts, raw HTML, repo-relative links and images, lazy code blocks). Raw HTML goes through `rehype-raw` and then `rehype-sanitize` with the schema in `src/lib/markdownSanitize.ts`, because submitters control this markdown. remark-rehype runs with `clobberPrefix: ""` so footnote ids get the sanitizer's `user-content-` prefix once, and the `a` renderer rewrites `#hash` links to match. Loaded on demand through `Markdown.tsx`; import that instead of this file.

### `src/components/ReadmePreviewNotice.tsx`

Shared README preview helper used by submit, profile edit, and admin generated-content flows. Opens expanded by default so submitters see the README source explanation immediately. Explains whether content came from the Convex include markers or full README fallback, links to the official component template marker setup, and uses toggle icons to communicate that the helper expands and collapses.

### `src/components/RepoHostIcon.tsx`

Small icon component that picks the Phosphor `GithubLogo`, `GitlabLogo`, or `LinkSimple` fallback from a `repositoryUrl` via `parseRepoUrl`. Accepts `className` and `weight` and passes them through. Used for repo specific spots (submit check input, detail page View Repo and Contact author links, profile and admin repo links) so the icon matches the host. The Header and Footer Convex org links keep their fixed GitHub icon.

### `src/components/DocSectionEditor.tsx`

Shared docs-style editor for one Component Directory Content section (Description, Use cases, How it works) on `ProfileEditSubmission` and `SubmitForm`. Renders an uppercase section heading with rendered `Markdown` in preview mode, a Preview / Edit toggle (`aria-pressed`) in the header, and an auto-growing `resize-y` textarea in edit mode whose height is `max(scrollHeight, minEditHeight, dragged height)` through a `useLayoutEffect`. The bottom-right grip still works: `onPointerUp` stores the dragged height as a floor so typing only ever grows the box. `Done` returns to preview; empty sections show a dashed "Click to write this section" prompt that opens edit mode focused. Stateless with respect to the form: it takes `value` and `onChange` and never owns the markdown.

### `src/components/ComponentDetailsEditor.tsx`

Admin editor for directory-specific fields: slug, category, tags, descriptions, video URL, video position on the component page (Top or Bottom select, admin only, saved with the other details), verified badge, community badge, featured status, thumbnail upload with preview, thumbnail clear option (applies after Save or immediate clear button), "Hide thumbnail in category listings" checkbox (persists immediately via `updateComponentDetails` so it stays in sync with the Admin inline Hide Thumb toggle; shows thumbnail only in Featured section when checked), logo upload with clear option, auto-fill author from GitHub, auto-fill long description from package metadata, and content generation controls. When `thumbnailUploadedByUser` is true, manual Generate Thumbnail controls are hidden and a short protected-thumbnail note is shown. All fields reactively sync with backend updates via `useEffect` hooks, so changes from external mutations (like slug generation) appear immediately without refresh. The "Auto-fill from Package" button copies the npm or repo description into the Long Description field for editing. The logo section includes upload, download, and clear buttons for managing component logos. Manual thumbnail generation now sends only defined Convex args and shows queued-generation feedback so the admin flow matches the backend worker model. Convex Verified and Community checkboxes appear side by side for admin-only badge control. Live Demo URL field label reads "Live Demo URL or Example App". Includes a legacy `SeoContentSection` for v1 packages and a v2 generated-content editor for migrated packages with regenerate, editable Description or Use cases or How it works fields, README preview editing, and SKILL.md support. The admin editor is now mobile-safe when expanded: the root card clamps overflow, the save header stacks on phones, author auto-fill and thumbnail-generation rows switch from forced inline layouts to mobile stacks, logo and thumbnail action clusters wrap, badge markdown scrolls inside its own code box, generated markdown previews use local horizontal overflow containers instead of stretching the whole admin page, and the final polish trims mobile padding slightly so the expanded editor feels denser without changing desktop spacing. Cleaned of leftover debug `fetch` calls to a local agent ingest server (`127.0.0.1:7557`) that had been left in the thumbnail sync effect and `handleGenerateThumbnail` from a prior debugging session, eliminating `ERR_CONNECTION_REFUSED` noise in the browser console.

### `src/components/AgentInstallSection.tsx`

"Use with agents and CLI" section for ComponentDetail page. Rendered by `ComponentDetail.tsx` only for `in_review` and `approved` review states. Shows single copy prompt optimized for AI agents (Claude style) using the shared Diffs-based `CodeBlock` renderer, plus an agent-friendly summary with install command, setup steps, and verification checklist. When the component has a generated SKILL.md (and it is not hidden via `hideSeoAndSkillContentOnDetailPage`), renders a Skill block with a Copy skill button for the raw markdown, a View SKILL.md link to the stable `/components/<slug>/SKILL.md` URL, and an install skill agent prompt labeled "Paste this prompt into any agent" (`generateSkillInstallPrompt`). Multi-platform MCP install section (Cursor, Claude Desktop, ChatGPT tabs) and MCP ready badge are temporarily commented out while public host MCP routing is being debugged. Code preserved for easy re-enablement. Respects feature flags (VITE_AGENT_INSTALL_ENABLED, VITE_MCP_BADGES_ENABLED, VITE_MCP_ENABLED) for controlled rollout.

### `src/lib/convexHttp.ts`

Module-level `ConvexHttpClient`, `fetchDirectoryPage(sortBy, category?)`, and the `useComponentBySlug(slug)` hook. `prefetchComponent(slug)` fills a per-slug cache that `useComponentBySlug` reads first, so a hovered component renders straight away when opened. `getCachedDirectoryPage(sortBy, category?)` returns the last catalog loaded this session (fresh for `CATALOG_REFRESH_AFTER_MS`, 60s), which lets Back to the directory or a category render without a skeleton. The default directory view (`sortBy=downloads`, no category) is also saved to localStorage (`directoryPage:v1`, ignored after 7 days or if the shape doesn't validate), so returning visitors see cards as soon as the JS runs while the request from `index.html` refreshes them. `fetchDirectoryPage` loads the directory and category pages' data from the `/api/directory-page` HTTP action (using the request `index.html` already started when the URL matches), falling back to the individual public queries over `/api/query` if the endpoint fails, stalls past 8s, or returns an unexpected shape. It replaced websocket `convex.query` calls that took ~1.5s from Australia before any cards could render. The hook reads component data through the reactive `useQuery` websocket subscription and, in parallel, issues a one-shot HTTP query to the same public `packages:getComponentBySlug` function (the `/api/query` endpoint). It returns the live value once the websocket connects and the HTTP result otherwise, preserving the `undefined` (loading) / `null` (not found) / document contract. This lets search engine renderers (e.g. Googlebot), which often cannot complete the Convex websocket within their render budget, still receive content so `ComponentDetail.tsx` renders a crawlable page. Because `getComponentBySlug` only returns unapproved components to their owner and admins, a `null` counts as "not found" only once Convex auth has finished loading, and a `null` from the signed-out HTTP fallback only counts for signed-out visitors.

### `src/lib/images.ts`

Image URL helpers for public pages. `thumbnailImageProps(url, sizing)` turns a Convex storage thumbnail URL into `src`/`srcSet`/`sizes` pointing at the `/components/_img/<width>/<storageId>` Netlify Image CDN rewrite (production builds only), with an `onError` that falls back to the original URL. Sizing presets: `CARD_THUMBNAIL`, `LIST_ROW_THUMBNAIL`, `DETAIL_THUMBNAIL`. `avatarUrl(url)` maps renamed GitHub orgs (`get-convex` to `convex`) and adds `?size=64` to `https://github.com/<name>.png` avatars (the direct `avatars.githubusercontent.com/<name>` form is avoided because it returns a placeholder for organisations).

### `src/lib/categories.ts`

Static category definitions and `getCategoryLabel` helper. `useDirectoryCategories()` reads the admin-managed list from `packages:listCategories` and drops derived categories (see `shared/officialComponents.ts`) so automatic categories are never offered when assigning a category to a component.

### `src/lib/npmPackage.ts`

npm package name helpers for the submit flow: `isValidNpmPackageName` (plain and scoped names), `parseNpmPackageInput` (accepts a name or a pasted npmjs.com URL and returns the name), and `buildNpmUrl` (builds the canonical npm URL sent to the backend).

### `src/lib/slugs.ts`

Client-side slug generation and parsing utilities for URL-safe component slugs.

### `src/lib/router.ts`

Client-side navigation for the SPA. `useLocation()` (a `useSyncExternalStore` over `popstate` and a custom navigate event; returns `pathname`, `search`, `hash` and the history `entryKey`), `navigate(to, { replace, scroll })` (history push/replace for app pages, a normal full load for anything else, and a full load if the browser refuses the history write), and `isAppPath(pathname)` (paths under `/components` except the OAuth callback, badges, assets, fonts, images, `_img`/`_src`, `api` and files like `.md`/`.txt`). Each history entry gets an id; when an entry is left (link or Back/Forward) its scroll position and any page state registered with `useEntryState(name, value)` are saved under that id and read back with `readEntryState(name)`, so nothing is written to history while a page is in use (Safari rate-limits history writes). `useScrollOnNavigate` scrolls to the top or a `#hash` on push and restores the saved position on Back/Forward, from a layout effect after the new page commits, and cancels stale retries. On a page change the canonical link is updated and the title, description and social tags reset to the site defaults (`resetPageMetadata` in `seo.ts`) before the new page sets its own. `installNavigation(onIntent)` adds one document click handler that intercepts plain left-clicks on same-origin app links (no modifier keys, `target`, or `download`), leaves in-page `#anchor` links to the browser (saving the position first), and calls `onIntent` when a link is touched or hovered for 80ms.

### `src/lib/seo.ts`

Client-side utilities to manage document title, meta description, robots tags, Open Graph tags, Twitter Card tags, canonical URLs, JSON-LD structured data injection, and `buildComponentJsonLd()` helper that creates a dual `@graph` schema combining SoftwareSourceCode and FAQPage for SEO/AEO/GEO. Includes `setComponentSeoTags()` consolidated helper that sets all SEO tags at once plus small helpers for review-state robots handling and removing stale JSON-LD on SPA navigation.

### `src/Admin.tsx`

Legacy admin file (re-exports from pages/Admin.tsx or contains full admin logic).

### `src/SignOutButton.tsx`

Sign-out button component using `useAuth().signOut()` from `src/lib/auth`.

### `src/index.css`

Global CSS with Tailwind directives, design system variables, and the `.markdown-body` component class that provides GitHub-style README rendering (heading hierarchy with bottom borders on h1/h2, nested list bullet progression, inline code styling, blockquote borders, GFM table zebra striping, task list checkboxes, and comfortable line-height).

### `src/lib/utils.ts`

Utility functions including `cn` for Tailwind class merging.

### `src/lib/mcpProfile.ts`

MCP profile builder utilities. Builds MCP-compatible component profiles from package data for agent consumption. Uses `MCP_PROTOCOL_URL` so MCP install configs point to the verified working direct endpoint (`https://giant-grouse-674.convex.site/api/mcp/protocol`). All platform configs use direct URL-based Streamable HTTP transport (no npm package dependency). Includes:
- `buildMcpProfile`: Builds full MCP component profile for agent consumption
- `buildMcpSearchResult`: Builds lightweight search result items
- `isMcpReady`/`hasAiInstallSupport`: Badge readiness checks
- `generateGlobalCursorInstallLink`: Generates Cursor MCP install deeplink with url config
- `generateComponentCursorInstallLink`: Generates Cursor MCP install deeplink with url config for specific component
- `generateClaudeDesktopConfig`: Generates Claude Desktop JSON config with url-based mcpServers wrapper
- `generateChatGPTConnectorConfig`: Generates ChatGPT custom connector URL with Developer mode setup steps
- `CLAUDE_DESKTOP_CONFIG_PATHS`: macOS and Windows config file paths
- `getMcpProtocolEndpoint`/`getCursorInstallApiUrl`: URL helpers for MCP endpoints using the temporary direct Convex fallback

Session note (2026-03-06): Until public host MCP routing is fully active, direct endpoint `https://giant-grouse-674.convex.site/api/mcp/protocol` is the verified working fallback for MCP clients.

### `src/lib/promptComposer.ts`

Universal prompt composer for AI agent installation. Generates Cursor, Claude, and manual safety prompts per-component using layered sources (SEO content, then fallback to basic fields). Returns metadata about source fields used and whether fallback was needed. Claude and universal prompts include a `- Skill: <skillUrl>` documentation line when the component has a generated SKILL.md. Also exports `getSkillFolderName` (kebab folder name matching the SKILL.md frontmatter name) and `generateSkillInstallPrompt` (agent prompt that fetches the skill URL and saves it into the correct skills folder per harness), used by the Skill block in `AgentInstallSection.tsx`.

### `src/lib/metadataScoring.ts`

Metadata quality scoring v1. Calculates completeness scores for components based on field presence and weights. Returns grade (A-F), confidence notes, and recommendations for missing data. Used by trust signals in the agent install section.

### `src/lib/featureFlags.ts`

Feature flags for MCP and agent install features. Controls rollout via environment variables (VITE_MCP_ENABLED, VITE_AGENT_INSTALL_ENABLED, VITE_METADATA_SCORING_ENABLED, VITE_COPY_PROMPTS_ENABLED, VITE_MCP_BADGES_ENABLED). Includes rollback documentation.

### `shared/componentUrls.ts`

Shared URL builder used by frontend and Convex HTTP code to generate consistent component detail, markdown alias, llms, and skill URLs. Handles scoped slug paths and derives the markdown filename leaf safely from the slug. All builders expose `skillPath`/`skillUrl` for the stable `/components/<slug>/SKILL.md` alias. Includes client-aware behavior for `ComponentDetail`: localhost uses Convex API endpoints (`/api/markdown`, `/api/component-llms`, and `/api/skill`) while production keeps Netlify alias URLs (`/components/<slug>/<leaf>.md`, `/components/<slug>/llms.txt`, and `/components/<slug>/SKILL.md`). This prevents local 404s without changing production routing.

### `shared/categoryUrls.ts`

URL builder for per-category agent files, shared by `convex/http.ts`, `src/pages/CategoryPage.tsx` and `src/pages/Admin.tsx`. `buildCategoryPaths(slug)` returns the landing page path (`/components/categories/<slug>`), `/components/<slug>-llms.txt` and `/components/<slug>.md`. `buildCategoryUrls` adds an origin. `buildCategoryClientUrls` points at the Convex `/api/category-llms` and `/api/category-markdown` endpoints on localhost (no edge functions in Vite dev) and at the public aliases everywhere else. Single segment file paths never collide with component paths, which always have a second segment.

### `shared/mcpTypes.ts`

TypeScript types for MCP (Model Context Protocol) data structures. Defines `McpComponentProfile` (public profile for agent consumption), `McpSearchResult`, `McpToolDefinition`, `McpServerConfig`, `McpUniversalPrompt`, `CursorInstallLink` (url-based Cursor deeplink config), and `McpDirectoryInfo` (directory-level MCP server metadata). Also includes `MCP_EXCLUDED_FIELDS` and `MCP_PUBLIC_SUBMIT_FIELDS` constants documenting the data contract.

### `src/vite-env.d.ts`

TypeScript declarations for Vite environment variables.

## Netlify Edge Functions

### `netlify/edge-functions/og-meta.ts`

Netlify Edge Function that injects component-specific OpenGraph, Twitter Card, and robots meta tags into the SPA HTML for component routes under `/components/{slug}`. It also directly proxies `/components/sitemap.xml`, `/components/llms.txt`, scoped `*/llms.txt`, `/components/components.md`, the official-only `/components/get-convex-llms.txt` and `/components/get-convex.md` lists, and every other single segment `/components/<category>-llms.txt` and `/components/<category>.md` (to `/api/category-llms` and `/api/category-markdown`) to Convex because Netlify redirects do not fire after an edge function runs. Sets the `X-Robots-Tag: noindex, nofollow` response header for the submissions (admin only since 2026-08-13), admin, callback, profile, dashboard, and documentation routes via the exact-match `isNoindexPath` helper, because Netlify `[[headers]]` rules never apply to edge-function-handled URLs. Static files under `/components/assets/*` and `/components/fonts/*` bypass this function entirely via `excludedPath` in `netlify.toml`. For actual component pages, it fetches component data from the Convex public `getComponentBySlug` query via HTTP API in parallel with the SPA response, then replaces default meta tags (`og:title`, `og:description`, `og:image`, `twitter:card`, `<title>`, etc.) in the HTML before serving. Uses the component `thumbnailUrl` directly for `og:image`, which keeps social previews on the known working raw Convex storage URL format. Review-state robots behavior now matches the SPA: approved pages get indexable robots output, while pending, in review, changes requested, and rejected pages get `noindex, nofollow` in bot-visible HTML. Documentation routes (`/components/documentation` and `/components/documentation/*`) get server-side `noindex, nofollow` injected before passthrough so crawlers that do not execute JavaScript also respect the directive. To help with "Crawled - currently not indexed" in Google Search Console, it also injects real crawlable content into the empty `#root` div for component detail pages (`/components/<slug>`): an `<h1>`, value proposition, install command, about section, benefits, use cases, FAQ, and outbound links (from `getComponentBySlug`), only when the slug resolves to a live (non-hidden/archived/deleted) component. Because the app mounts with `createRoot()`, React clears `#root` on first render, replacing the injected content with the normal styled app (no hydration mismatch, no visual change); the injected wrapper is `display:none` to avoid a flash of unstyled content (page stays blank during load, as before), while the markup remains in the first-pass HTML for crawlers that do not execute JS. The `/components` directory index is not covered (the `/components/*` edge path does not match the bare `/components` URL — a separate path-matching change is needed). Confirmed missing slugs return HTTP 404, while lookup failures preserve the SPA response. Reserved routes and static assets skip OG injection. CDN cached for 5 minutes on hits. Required because the SPA sets meta tags via client-side JavaScript which crawlers do not execute. Reserved paths that skip OG injection: `submit`, `admin`, `login`, `callback`, `profile`, `submissions`, `documentation`, `dashboard`, `badge`, `categories`, and `badge/*` (badge paths use the dedicated badge edge proxy instead).

### `netlify/edge-functions/component-badge.ts`

Netlify Edge Function that handles `/components/badge/*` and proxies requests directly to the Convex badge endpoint (`/api/badge?slug=<slug>`). Returns SVG responses on the Netlify domain and avoids route ordering issues where SPA fallback or OG meta injection could return HTML instead of badge images.

### `netlify/edge-functions/component-image-source.ts`

Netlify Edge Function for `/components/_src/<storageId>`, the Convex storage path Netlify Image CDN resizes thumbnails from. Any signed-in user can upload to storage and this path is on www.convex.dev, so it only passes through PNG, JPEG, WebP, GIF and AVIF responses from this deployment's storage, with `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; sandbox`. Anything else, including HTML and SVG, gets a 404. An edge function because Netlify doesn't apply `_headers` rules to proxied responses.

### `netlify/edge-functions/component-markdown.ts`

Netlify Edge Function that proxies markdown alias paths (`/components/<slug>/<leaf>.md`) and skill paths (`/components/<slug>/SKILL.md`) to the Convex HTTP endpoints by slug. Keeps the URL on the Netlify domain while serving raw markdown content. Parses slug and file kind from the URL path and forwards to `{convexSiteUrl}/api/markdown?slug={slug}` or `{convexSiteUrl}/api/skill?slug={slug}`. Cached for 5 minutes.

## Build Output

### `dist/`

Production build output directory.

### `node_modules/`

NPM package dependencies. Not tracked in git.

## Development Files

### `setup.mjs`

Setup script for initial project configuration.

### `README.md`

Convex Components Challenge documentation.

### `badge-palette-preview.html`

Full width local review page for README badges. Renders every status through `<img>` with a JS copy of `convex/badgeSvg.ts` and the glyph data from `convex/badgeGlyphs.ts` (keep them in sync). Shows the convex.dev README pairing (live badge.fury.io npm badge above ours) at 1x and 3x on the docs cream background, a side by side against the live fury badge and the previous shields style, a 3x zoom row, the status table and a dark README row. Colors:
- Approved: `#4c1` (same green as the npm badge)
- In Review: `#2563eb`
- Changes Requested: `#ea580c`
- Pending: `#ca8a04`
- Rejected: `#dc2626`
- Not Found: `#6b6b6b`

This file is intentionally ignored by git for local review only.

### `mockups/components-header-mockups.html`

Static HTML mockup page comparing five layouts for the directory page header (current state annotated plus four whitespace-reduction options); option A, the compact inline title, was implemented in `Directory.tsx`. The `mockups/` folder is ignored by git and kept for local review only.

### `files.md`

This file. Overview of all files in the codebase.

### `changelog.md`

Changelog tracking features and changes over time.

### `task.md`

Task list for tracking project progress and completed features.

### `.claude/skills/`

Project level Claude skills in standard Agent Skills directory format (`skill-name/SKILL.md` with YAML frontmatter). 12 skills total:

**Project specific:**
- `dev/SKILL.md`: Full stack Convex development guidance, mutations, auth, design system, docs workflow
- `gitrules/SKILL.md`: Git safety rules, status first checks, explicit user approval before commits or destructive actions
- `help/SKILL.md`: Reflection first problem solving, 98% code confidence, minimal change scope
- `sec-check/SKILL.md`: Security review for Convex auth, public query safety, PII exposure, browser response verification
- `workflow/SKILL.md`: PRDs, task tracking, changelog sync, files sync, subagent usage
- `write/SKILL.md`: Writing style guide for tweets, blogs, docs, commits, AI detection avoidance

**Performance:**
- `directory-load-performance/SKILL.md`: Playbook for fast public Convex pages: bootstrap GET started in `index.html`, localStorage cache, client navigation, lazy analytics and markdown, CDN sized thumbnails, Netlify `_headers`/`_redirects` gotchas, and a pre ship checklist. Mirrored in `.cursor/skills/` and `.codex/skills/`

**React:**
- `react-effect-decision/SKILL.md`: Decision tree for avoiding direct `useEffect` in favor of derived state, event handlers, `key` remounts, `useMemo`, `useSyncExternalStore`, and Convex hooks

**Convex community (from get-convex repos):**
- `real-time-backend/SKILL.md`: Backend architecture principles, anti-patterns, implementation guidance
- `convex-quickstart/SKILL.md`: Project scaffolding with templates for React, Next.js, bare backends
- `convex-setup-auth/SKILL.md`: Auth provider setup for Convex Auth, Clerk, WorkOS, Auth0
- `schema-builder/SKILL.md`: Schema design patterns, validator reference, index strategy
- `function-creator/SKILL.md`: Query/mutation/action creation with auth, validation, error handling
- `migration-helper/SKILL.md`: Safe migration patterns, batch processing, dual-write

### `prds/`

Product requirements documents:
- `directory-load-performance-retro.md`: Retro on the 2026-09-30 perf pass (PRs #34 to #42): bootstrap endpoint, return visit cache, client navigation, bundle splits, resized images, Netlify rules that apply, plus why none of it shipped from the start and the lessons that follow
- `guest-preflight-check.md`: Test link in the header and signed out Component Preflight Check with abuse safeguards (origin check, honeypot, atomic reservation, 3 per hour per IP, 30 per hour site wide, admin kill switch), plus fixes for stuck pending rows and cached error results
- `sec-check-public-function-auth-gaps.md`: Sec-check audit of all 211 public Convex functions and the admin gates added to the unauthenticated money, PII, and admin-control functions (Tremendous reward actions, payment queries, admin settings, internal note queries, AI and thumbnail generation), plus the three migration backfills moved to `internalMutation`
- `admin-gate-refresh-functions.md`: Security fix adding admin auth checks to the four public auto-refresh functions in `convex/packages.ts`; the mutation now requires an admin identity and the three queries return safe defaults for non-admins
- `scheduled-refresh-validation-fix.md`: Root cause and fix for the nightly auto-refresh cron silently failing since 2026-07-27; `_getStalePackages` returned an extra `lastRefreshedAt` field that failed `_refreshPackageBatch` argument validation, leaving refresh logs stuck at "running" with 0 succeeded
- `official-readme-auto-update.md`: Admin toggle and schedule for auto-refreshing READMEs of official get-convex components via an hourly gated cron, with a `readmeUpdateLogs` table and admin Logs tab
- `curated-categories.md`: Curated category type with hand-picked members via a `categoryMemberships` join table, optional badge images shown on member cards and detail pages, and admin manage-members panel
- `npm-url-mismatch-review.md`: Detection and review flow for npm URL edits that point at a different package name: `pendingNpmName` flag, user warning and confirm modal on the edit page, Slack detail, and admin accept rename or revert URL actions with slug stability guaranteed
- `profile-edit-links-rescan.md`: Editable repo and npm links on the profile edit page with automatic security re-scan and Slack notification on real link changes
- `skill-version-and-agent-instructions.md`: npm version numbers in SKILL.md frontmatter and all llms.txt/markdown index entries, skillMd rebuild on npm version change in `_updateNpmDataAndTimestamp`, one-line agent instruction block across agent-facing outputs, and the `rebuildAllSkillMd` force rebuild
- `npm-weekly-downloads-stale-window.md`: Root cause and fix for weekly downloads showing 0 on newly published packages; npm's `point/last-week` API alias lagged nine days, replaced with an explicit 7-day window in `fetchNpmPackageHandler`
- `ai-review-github-token-401.md`: Root cause and fix for AI reviews failing every repo with a false "No convex.config.ts found" after the `GITHUB_TOKEN` env var expired; documents the 401 unauthenticated fallback and 403/429 error surfacing in `convex/aiReview.ts`
- `scale-optimization.md`: Bandwidth and subscription reduction following OpenClaw patterns: compound indexes, one-shot fetches, change detection, denormalized category counts, search-indexed REST API
- `claude-skills-alignment.md`: Documents the missing Claude skill coverage for security and workflow rules and the updates that brought `.claude/skills` back in sync with the active Cursor rule set
- `ai-review-prompt-v6.md`: Documents the v6 AI review model update, including package entry point checks, wrapper-aware helper guidance, and the repo evidence expansion for `package.json` plus client and test files
- `netlify-llms-redirect-checklist.md`: Shareable runbook for developers diagnosing stale Netlify redirect behavior affecting `llms.txt` and MCP proxy routes, including publish checks, redirect UI review, cache-clearing redeploy steps, and verification commands
- `architecture-overview.md`: Comprehensive architecture documentation with mermaid diagrams showing user flows, admin flows, AI integration, auth, and database schema
- `aicheck.md`: AI Review feature specification
- `howitworks.md`: Technical documentation for data fetching, AI review process
- `nowriteconflicts.md`: Guidelines for preventing Convex write conflicts
- `token-based-auth-checks.md`: Token-based authentication guidelines
- `env-deploy-fix.md`: Environment and deployment configuration
- `2026-02-22-workos-auth-issues.md`: WorkOS AuthKit integration issues and solutions including JWT claims, dual provider config, callback timing, admin checks, and environment setup
- `user-profile-enhancements.md`: User profile features including hide/show/delete submissions, edit modal, multi-account access via additionalEmails, and admin email editor
- `auth-migration-env-vars.md`: Legacy auth environment notes from an older GitHub OAuth phase (kept for historical context only)
- `routes-components-fix.md`: SPA routing configuration for Netlify deployment with `/components` prefix enforcement
- `authfix-2026-02-23.md`: Production OAuth fix documentation including GitHub OAuth callback URL configuration, JWT key generation, and admin access control via `@convex.dev` email domain
- `featured-sort-order.md`: Featured components sort order feature for admin-controlled ordering independent of directory dropdown sort
- `admin-actions-row.md`: Admin Actions row feature moving Convex Verified, Regenerate SEO, and Auto-fill buttons to InlineActions panel above Status row
- `component-url-centralization.md`: Shared URL helper plan for component detail, markdown alias, and llms links across frontend and Convex HTTP output
- `netlify-markdown-alias-edge-function.md`: Netlify edge strategy for markdown alias paths and production/local behavior expectations
- `submit-pagination-admin-page-size-setting.md`: Submit page pagination and admin-configurable default page size (`20`, `40`, `60`)
- `tremendous-rewards-integration.md`: Tremendous API integration for sending rewards to component submitters, including SDK setup, environment variables, schema changes, and Admin UI specs
- `prd-doc-timestamp-tracking.md`: Workflow update plan that standardizes date and time tracking across PRDs, task updates, and changelog entries for agent session traceability
- `workos-convex-environment-runbook.md`: Runbook for WorkOS and Convex staging and production environments, including exact environment variable matrices, callback and CORS requirements, and route verification checklist
- `workos-admin-feedback-request.md`: Short shareable PRD for the WorkOS team describing how this app derives admin access from `identity.email`, the `@convex.dev` rule, and the feedback requested on best practices
- `workos-authkit-migration-components-routes.md`: WorkOS cutover implementation PRD for removing legacy Convex Auth wiring while preserving `/components` route behavior and admin gating
- `workos-connect-convex-migration.md`: Connect specific migration PRD for OAuth PKCE frontend flow, Convex token bridge, and Connect issuer/JWKS validation
- `workos-connect-convex-netlify-how-to.md`: Shareable how-to guide for setting up WorkOS Connect with Convex and Netlify across development, staging, and production, including route access policy and alias route behavior
- `git-cursor-shared-repo-workflow.md`: Team workflow PRD for collaborating in the same repo with another developer, including the recommended branch first process, safe direct to `main` fallback, and Cursor Commit plus Sync guidance
- `ai-provider-runtime-failover.md`: Runtime failover PRD for AI provider orchestration across admin and env configurations to keep AI Review and SEO generation available during provider outages or key failures
- `og-image-meta-revert.md`: Bug fix PRD documenting why the attempted `/components/og/*` alias was rolled back and why direct Convex storage URLs remain the stable `og:image` format
- `ai-review-prompt-v1.md`: Archived original AI review prompt (v1) before updates. Documents known issues fixed in v2 including false negatives on helper function return validators and false positives on public API functions.
- `ai-review-prompt-v3.md`: Archives the previous default AI review prompt v2 and documents the v3 shift to GitHub-repo-based critical pass criteria plus advisory notes
- `admin-auto-ai-review-and-logo-thumbnail-gating.md`: Documents the switch from auto approve or reject to a single auto AI review workflow and records the logo-gated thumbnail automation clarification
- `public-preflight-checker.md`: Public preflight checker allowing developers to validate their GitHub repo against review criteria before submitting
- `tremendous-custom-message-delivery.md`: Bug fix PRD for forwarding reward notes into Tremendous recipient-facing delivery messages while preserving the existing reward send flow
- `profile-logo-upload-and-package-write-auth.md`: Documents backend package write auth hardening and the Profile page logo management flow
- `submit-table-published-column-and-alignment.md`: Documents the Submit page table cleanup that removes the collapsed Published column, moves publish dates into expanded details, and rebalances the desktop metadata columns
- `admin-ai-review-history.md`: Implementation PRD for persistent AI review run logging and the admin-side review history drawer
- `category-save-and-large-category-visibility.md`: Documents the admin category save investigation and the fix that shows full result sets when a specific directory category is selected
- `package-download-validator-fix.md`: Bug fix PRD for the missing `allTimeDownloads` validator on submission and npm update paths, plus verification that the dashboard stats contract still exposes `totalAllTimeDownloads`
- `submit-form-category-sync.md`: Documents the submit form category dropdown bug where `slug` drifted from the shared category `id` contract, and the fix that keeps public submissions in sync with `Admin.tsx`
- `detail-page-seo-visibility-toggle.md`: Documents the admin-only toggle for hiding generated SEO and SKILL content from the public component detail page while keeping it editable in admin
- `review-state-detail-page-gating.md`: Documents the safe rollout for keeping review-state detail pages live while gating agent UI and search indexing
- `mcp-streamable-http-migration.md`: Migration from dead `@anthropic-ai/mcp-server-fetch` npm proxy to Streamable HTTP transport. All MCP install configs now use direct URL with no npm dependency. Covers Cursor, Claude Desktop, and ChatGPT.
- `ai-review-prompt-v5.md`: Documents the v5 AI review update that detects the real component source directory and splits args validators from advisory returns validators
- `component-detail-help-modal.md`: Documents the small sidebar help modal on component detail pages, including author support guidance, community support link, and the third party component notice
- `content-model-migration-readme-rendering-fixes.md`: Bug fix PRD for migrated detail pages covering the Pierre renderer crash, v2 legacy SEO gating, and removal of obsolete Resources output
- `convex-doctor-perfect-score.md`: Documents the two-session effort to improve convex-doctor score from 39/100 to 100/100, including all error fixes, helper extractions from 19 large handlers across 7 files, strategic suppressions, and TypeScript fixes

All PRDs in this folder now include metadata headers (`Created`, `Last Updated`, `Status`) and a `Task completion log` section for agent session traceability.

### `.cursor/rules/`

Cursor rules for development guidelines including `sec-check.mdc`, `dev2.mdc`, `help.mdc`, `gitrules.mdc`, `convex2.mdc`, `rulesforconvex.mdc`.

### `.cursor/plans/`

Plan documents including `components_directory_expansion_dd445bcc.plan.md` for the full directory expansion project.
