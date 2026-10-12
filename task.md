# Task List

Session updates complete on 2026-10-12 17:30 UTC. Every enabled category now has auto-updating agent files at `/components/<slug>-llms.txt` and `/components/<slug>.md`, linked from a For Agents section at the bottom of each category page and from each row in Admin > Category Management. Root `llms.txt` and `components.md` list them. Verified on dev, needs a Convex and Netlify deploy. PRD: `prds/category-agent-files.md`.

Session updates complete on 2026-10-12 16:59 UTC. README badges now match the badge.fury.io npm badge that sits above them on convex.dev component pages: DejaVu Sans outlines, white stroke, crisp shadow, fury padding and kerning. Live on dev, needs a prod deploy.

Session updates complete on 2026-10-09 05:48 UTC. Convex backend deployed to prod (`giant-grouse-674`) with Mike's security fixes (#44, #45), video position and the show all thumbnails toggle. Schema validation passed, no indexes deleted. Anonymous `runSecurityScan` on prod now returns "Authentication required". `findUnsafeMarkdown` on prod flagged 5 approved packages, all with empty `rewrittenFields` (code examples in READMEs), so no cleanup needed. Local bun upgraded to 1.4.2. No app code changed.

Session updates complete on 2026-10-08 13:11 UTC. Security fix for stored XSS on the component detail page: submitter markdown is sanitized on render (`rehype-sanitize`) and on save (`stripUnsafeHtml`, now GFM and normalize aware), unapproved component pages and their markdown, SKILL.md, llms.txt and REST endpoints only serve approved components, `/components/_src` only serves raster images, and the build adds a Content-Security-Policy meta tag. Needs a Convex deploy and a Netlify deploy, then the scan and checks below.

Session updates complete on 2026-10-08 12:30 UTC. `runSecurityScan` now requires an admin (`requireAdminIdentity`) instead of any signed-in user. Needs a Convex deploy.

Session updates complete on 2026-10-03 00:42 UTC. Component videos now default to the top of the detail page (below the install command), with a per-component "Video Position on Component Page" select in the admin Component Details editor to move one back to the bottom. Needs a prod deploy.

Session updates complete on 2026-10-02 16:52 UTC. Added "Show all thumbnails on the category page" to Settings > Category Management. It overrides per-component thumbnail hiding on the category landing page only, and the Directory homepage is unchanged. On dev, needs a prod deploy.

Session updates complete on 2026-10-01 19:19 UTC. Pulled Mike's perf pass (`61c15ed..bdc12a4`), synced `node_modules` to convex 1.46.0, confirmed both typechecks and `vite build` pass. Wrote `prds/directory-load-performance-retro.md` and the `directory-load-performance` skill. No app code changed.

Session updates complete on 2026-09-26 08:14 UTC. Monorepo-aware component lookup shipped to dev: preflight and admin AI review now read the repo tree, honor branch and folder URLs, and return fix URLs when a URL doesn't point at one component. The daytona monorepo root now passes. Needs a prod deploy.

Session updates complete on 2026-09-26 07:13 UTC. README badges now render in exact shields.io flat style with approved switched to `#4c1`. Needs a prod deploy to go live.

Session updates complete on 2026-09-24 20:15 UTC. Guest preflight check shipped to dev: a Test link next to Build opens the Component Preflight Check for signed out visitors at 3 checks per hour per network (30 per hour site wide), with an admin kill switch. Signed in flow unchanged.

Earlier session: 2026-09-24 01:46 UTC. Review outcome messages shipped to dev: failed AI reviews and approvals write editable drafts in User Messages, nothing sends unless an admin clicks Send or turns on an auto send setting (each with a GitHub option). Rejecting older components drafts on the spot; `reviewMessages:backfillRejectionDrafts` covers components already rejected in prod (see to do below).

Previous session: 2026-09-21 03:25 UTC. gitlab.com repositories are accepted everywhere GitHub ones are read: submit and edit validation, preflight, README fetch for content generation, issues list and counts, author avatar, markdown link rewriting, host icons and copy. GitHub write features (issue mirror, broadcast, reply sync) stay GitHub only. One backend file (`convex/aiReview.ts`) is blocked by a lint hook false positive; see the to do below.

## to do

- [ ] Category agent files: deploy Convex (`npx convex deploy`) and Netlify together (the edge function route ships with the frontend). Then check `curl -I https://www.convex.dev/components/ai-llms.txt` and `.../components/ai.md` return 200 with text content types, `.../components/get-convex.md` is unchanged, `.../components/nope-xyz.md` returns 404, and the For Agents links on `/components/categories/ai` open the files.

- [ ] Fury style badge: deploy Convex to prod (`npx convex deploy`), then open `https://www.convex.dev/components/badge/<slug>` for an approved component and check it matches the npm badge above it in the README. GitHub caches README images, so live READMEs can take a few minutes to update.

- [ ] Markdown sanitizing and CSP: deploy Convex (`npx convex deploy`) and the frontend together. On the deploy preview, open a few component pages with rich READMEs (badges, `<picture>`, `<details>`, alerts, code blocks) and check they look the same as prod, and that the browser console shows no Content Security Policy errors. If Netlify snippet injection or another tool adds scripts to the page, add their hash or host to `contentSecurityPolicy` in `vite.config.ts`.

- [ ] Unapproved pages: confirm a pending component's page shows the 404 state when signed out, and loads for its submitter and for an admin.

- [ ] Unapproved endpoints: confirm `/components/<slug>/<slug>.md`, `/components/<slug>/SKILL.md` and `/components/<slug>/llms.txt` return 404 for a pending component and still work for an approved one.

- [ ] Image source: on the deploy preview, check directory thumbnails still load through `/components/_img/...` (Network tab, WebP or AVIF from the Image CDN), and that `/components/_src/<id>` for a PNG thumbnail returns the image with `x-content-type-options: nosniff`. Then request `/components/_img/400/<id>` for an SVG logo's storage id: it must not come back as `image/svg+xml`. If it does, add `&fm=webp` to the `_img` rewrite in `netlify/_redirects`.

- [ ] Decide how owner edits to approved listings should be reviewed. `updateMySubmission` still publishes description, use cases, how it works and README edits on an approved listing straight away. The markdown is sanitized now, but nobody reviews the new text. Options: a Slack alert when an approved listing's content changes (cheap), or keeping edits as a pending draft until an admin approves them (needs draft fields and an admin diff view). Setting `reviewStatus` back to pending would hide the listing until re-approval.

- [ ] Admin-only security scans: Convex deployed to prod and anonymous calls are rejected (2026-10-09 05:48 UTC). Still run a scan from the prod admin dashboard and confirm it still queues.

- [ ] Video position: deploy to prod (`npx convex deploy`) before or with the frontend, then open a component with a video and confirm it sits under the install command. Set one to Bottom in admin and confirm it moves below the README.

- [ ] Show all thumbnails toggle: deploy to prod (`npx convex deploy`), then in prod admin turn it on for Official Convex Components and confirm `/components/categories/get-convex` shows every available thumbnail while the Directory homepage is unchanged

- [ ] Monorepo-aware lookup: deploy to prod (`npx convex deploy`), then run the guest check on www.convex.dev/components/submit/check with `https://github.com/daytona/integrations`. Expect a pass with "Reviewed packages/convex/src/component on main".

- [ ] Monorepo-aware lookup: as a signed-in non-admin, confirm a 422 doesn't use up one of the 10 hourly checks. The signed-in results view and the prefilled submit form were verified on 2026-09-26 08:32 UTC with an admin session.

- [ ] Monorepo-aware lookup: delete the legacy `fetchGitHubRepo` in `convex/aiReview.ts` after one week in prod with no locator regressions (earliest 2026-10-03).

- [ ] Shields style badges: deploy to prod (`npx convex deploy`) and load `https://www.convex.dev/components/badge/<approved-slug>` to confirm the `#4c1` badge. GitHub camo may keep old README images until its cache expires.

- [ ] Guest preflight check: deploy to prod (`npx convex deploy`) so the new `by_is_guest_and_created` index and guest path go live, then confirm the Test link and one guest run on www.convex.dev/components/submit/check

- [ ] Review messages: run the prod backfill dry run, then the real run (`npx convex run --prod reviewMessages:backfillRejectionDrafts '{"dryRun":true}'`)
- [ ] Review messages: swap `REVIEW_CRITERIA` in `convex/aiReview.ts` to import `shared/reviewCriteria.ts` (the lint hook no longer blocks edits to this file as of 2026-09-26)

- [ ] GitLab: signed-in browser pass
  - `/components/submit/check` and `/components/submit` need a WorkOS session. Confirm: typing `https://gitlab.com/gitlab-org/cli` shows the GitLab logo in the input with no error, switching to a github.com URL flips the icon, `https://gitlab.com.evil.com/a/b` and `https://bitbucket.org/a/b` are rejected with copy naming GitHub and GitLab, and a preflight run against the GitLab URL completes (expect the AI review step to report the aiReview.ts error above until that file is updated). Then submit one GitLab test component and check the detail page: GitLab icon on View Repo, README relative images resolve to `gitlab.com/.../-/raw/...`, author avatar fills in a few seconds after submit, Contact author CTA links to `/-/issues`. Admin Comments panel on that package shows "Issue mirroring is available for GitHub repositories only." instead of the mirror checkbox.

- [ ] Docs-view content editor: signed-in click-through on the real pages
  - `DocSectionEditor` was verified in isolation (see completed entry). Still worth one pass at `http://localhost:5173/components/profile/edit/<packageId>` and `/components/submit` after Generate Content with a WorkOS login: confirm the three sections render, Edit / Done flip cleanly, and Save Changes persists edited markdown. The agent browser had no WorkOS session.

- [ ] Admin Broadcast tab: signed-in click-through
  - Code and docs are in. Browser hit Admin Sign In at `http://localhost:5173/components/submissions/admin`. After an `@convex.dev` login: Broadcast sits next to Logs, Settings jump nav has no GitHub Broadcast, Logs has no package list, `#settings-github-broadcast` opens Broadcast, sending pill appears while a job runs.

- [ ] GitHub reply sync: live verification with a classic token
  - Why: code and cron are on dev, but the dev `GITHUB_TOKEN` is fine grained, so the poller records `GitHub refused access to notifications (403)...` and stops. GitHub's notifications API only accepts a classic token. The token must belong to the same GitHub account that opened issue #2 (the account behind `GITHUB_TOKEN`), because the poller reads that account's notifications.
  - [x] 1. Create the token. Signed in as the `GITHUB_TOKEN` account, open [https://github.com/settings/tokens/new](https://github.com/settings/tokens/new) (classic). Note `components-directory reply sync`, tick only the `notifications` scope, Generate, copy the `ghp_` value.
  - [x] 2. Add it to dev. Dashboard [https://dashboard.convex.dev/d/third-hedgehog-429/settings/environment-variables](https://dashboard.convex.dev/d/third-hedgehog-429/settings/environment-variables), Add `GITHUB_NOTIFICATIONS_TOKEN`. Or `npx convex env set GITHUB_NOTIFICATIONS_TOKEN ghp_...`. Leave `GITHUB_TOKEN` as is.
  - [x] 3. Test connection. With `npx convex dev` and `npm run dev` running, open [http://localhost:5173/components/submissions/admin](http://localhost:5173/components/submissions/admin), Broadcast tab (next to Logs), Reply sync card, click Test connection. Expect `Connected as @login using GITHUB_NOTIFICATIONS_TOKEN. Notifications scope OK.` Note the login.
  - [x] 4. Turn Reply sync on. Click the Off pill; it flips to On and polls immediately. Token, Last poll, and Last result fill in.
  - [ ] 5. Reply on GitHub from a different account than the step 3 login (or have a teammate do it): [https://github.com/waynesutton/agent-ready-component/issues/2](https://github.com/waynesutton/agent-ready-component/issues/2), comment `Testing reply sync`.
  - [ ] 6. Sync and confirm. Click Sync now. Last result shows 1 inserted. Header bell count goes up by one. All tab, search `agent ready`, expand, Comments panel shows the comment with a "via GitHub @login" pill that links to it. Slack has one `New GitHub reply on agent ready` post (needs `SLACK_WEBHOOK_URL` on dev). Click Sync now again: 0 inserted, 1 duplicate, no second copy, no second Slack post.
  - [ ] 7. Reply from the thread. In the same Comments panel the checkbox reads "Also reply on the open GitHub issue". Tick it, Reply. Message shows "Sent as GitHub comment". Issue #2 has the new comment and [https://github.com/waynesutton/agent-ready-component/issues](https://github.com/waynesutton/agent-ready-component/issues) has no issue #3.
  - [ ] 8. Prod. Set the same variable at [https://dashboard.convex.dev/d/helpful-ptarmigan-118/settings/environment-variables](https://dashboard.convex.dev/d/helpful-ptarmigan-118/settings/environment-variables) (or `npx convex env set --prod ...`), `npx convex deploy`, then repeat steps 3 and 4 on the production admin page. Sync stays off until flipped.
  - [ ] 9. Broadcast lifecycle. On the existing completed broadcast in the Broadcast tab: Archive (row disappears), Show archived (row returns with Archived pill), Restore, then Delete and read the confirm copy about reply sync stopping for that broadcast.

- [ ] GitHub issue messaging: browser verification against a real repo
  - Code is deployed to dev. Still needs an admin session to (1) send a message with the checkbox on a test package whose repo the token can write to and confirm the issue link appears in the thread, and (2) run a small broadcast (Rejected filter), watch progress tick every 10s, and cancel mid run. The agent sandbox could not keep a Vite server alive or reach Convex over the network, and the browser had no admin login.

- [ ] Enforcement by construction for public function auth
  - Add a `convex/access.ts` exporting `adminQuery` and `adminMutation` built on `customQuery`/`customMutation` from `convex-helpers`, then move admin functions onto them so the gate is structural instead of remembered per function. `packages.ts` alone has over 100 public functions, which is why the per-function pattern keeps slipping (three separate security fixes now: 2026-08-06, 2026-08-13, 2026-08-14).
- [ ] Perf follow ups from `prds/directory-load-performance-retro.md`
  - Replace the `ctx.runQuery` calls in `convex/directoryPage.ts` with shared TypeScript helpers (small, speculative win)
  - Add an entry chunk size budget to CI
  - Add a post deploy check that `curl -I` on a hashed asset returns `immutable`
## completed

- [x] Per-category agent files and For Agents section (2026-10-12 17:30 UTC)
  - PRD: `prds/category-agent-files.md`
  - [x] One membership helper (`listPublicPackagesForCategory`) shared by the category page and the agent files, covering regular, curated and official categories
  - [x] `/api/category-llms` and `/api/category-markdown` with 404 for disabled or unknown slugs, case-insensitive slugs, OPTIONS routes
  - [x] Edge function proxies `/components/<slug>-llms.txt` and `/components/<slug>.md` after the existing exact routes
  - [x] Root llms.txt and components.md list every category's files; markdown labels come from the database so renames show up
  - [x] For Agents section on `CategoryPage.tsx`; agent file links and a slug rename warning in Admin > Category Management
  - [x] Slug `components` reserved in `upsertCategory`
  - [x] Verified: both typechecks pass, dev push ok, curl on dev for `ai`, `get-convex`, `test-yc`, `testyc2`, `AI`, `nope-xyz` and the root indexes
  - [x] Prod compatibility check (2026-10-12 17:32 UTC): all existing agent file URLs route as before, no prod component slug matches the new pattern, and only the `components.md` and `get-convex.md` heading labels change (now from Admin)

- [x] README badge matches the badge.fury.io npm badge (2026-10-12 16:59 UTC)
  - PRD: `prds/badge-fury-style-match.md`
  - [x] Root cause: convex.dev READMEs use badge.fury.io, which draws DejaVu Sans outlines with a white stroke and an unblurred shadow. Ours used Verdana `<text>` stretched with `textLength` plus the shields blurred shadow
  - [x] `convex/badgeGlyphs.ts` generated from DejaVu Sans 2.37 (outlines, advances, 220 kerning pairs)
  - [x] `convex/badgeSvg.ts` `renderBadge` replaces `renderShieldsBadge`; `convex/http.ts` import updated
  - [x] Verified: six live fury SVGs (npm, pypi, gem) match width, split and glyph points within 0.001px; `tsc -p convex --noEmit` passes; lints clean
  - [x] `badge-palette-preview.html` rebuilt with the convex.dev pairing at 1x and 3x, checked in the browser
  - [x] Docs: `src/docs/badges.md`, `src/docs/api-endpoints.md`

- [x] Prod backend deploy for Mike's security fixes (2026-10-09 05:48 UTC)
  - [x] `git pull --ff-only` to `0074bc3` (#43, #44, #45), upgraded bun 1.1.30 to 1.4.2, kept the pulled `bun.lockb`
  - [x] `bun install --force` to restore the missing `@esbuild/darwin-arm64@0.27.0` under `convex/node_modules`. The old bun left it out, and `convex dev` failed with "esbuild failed: The service was stopped"
  - [x] `tsc -p convex`, `tsc -b`, `npx convex dev --once` and `vite build` pass
  - [x] `npm run deploy:backend -- --yes` to `giant-grouse-674`: schema validation complete, no indexes deleted
  - [x] Anonymous `securityScan:runSecurityScan` on prod returns "Authentication required"
  - [x] `findUnsafeMarkdown` on prod: 5 approved packages flagged (r2, convalytics-dev, abdssamie/convex-analytics, waynesutton/agent-ready, vllnt/convex-events), all with empty `rewrittenFields`, so they're code examples and need no cleanup
  - [x] Live check on www.convex.dev/components/cloudflare-r2: page renders, no live scripts or forms in README content, CSP meta tag present, no images blocked

- [x] Per-category "Show all thumbnails on the category page" toggle (2026-10-02 16:52 UTC)
  - PRD: `prds/category-show-all-thumbnails.md`
  - [x] New optional `showAllThumbnails` on `categories`. Only the category landing page reads it, where it overrides each component's `hideThumbnailInCategory`. The Directory homepage (grouped sections, Featured, Other, list view) ignores it, so its thumbnail settings don't change.
  - [x] Mutually exclusive with "Hide all": the admin form unchecks the other box, and `upsertCategory` saves `showAllThumbnails: false` whenever `hideThumbnails` is true
  - [x] Admin form: second checkbox with helper text under both thumbnail options, plus a "thumbnails shown on page" row badge
  - [x] Files: `convex/schema.ts`, `convex/packages.ts`, `src/pages/Admin.tsx`, `src/pages/CategoryPage.tsx`
  - [x] Verification: `tsc -p convex` and `tsc -b` pass, lints clean, `npx convex dev --once` deployed, and `getCategoryBySlug` for `get-convex` returns `showAllThumbnails: false`. Flipping it in the admin needs a WorkOS admin session, so that click-through is left to the running app.

- [x] Load performance retro and skill (2026-10-01 19:19 UTC)
  - PRD: `prds/directory-load-performance-retro.md`
  - [x] `git pull --ff-only` from a clean tree, `bun install` for convex 1.46.0 (pulled `bun.lockb` kept; local bun 1.1.30 rewrites it in an older format)
  - [x] `tsc -p convex`, `tsc -b` and `vite build` pass; `dist/_headers` and `dist/_redirects` are written
  - [x] Skill at `.cursor/skills/directory-load-performance/SKILL.md`, mirrored to `.claude/skills/` and `.codex/skills/`
  - [x] Lessons added to `prds/lessons.md`

- [x] Pre-existing app typecheck errors (resolved upstream 2026-09-30, confirmed 2026-10-01 19:19 UTC)
  - Fixed in `c092982` and `e4b768e`: lint now runs `tsc -b`, `CodeBlock.tsx` and `CategoryPage.tsx` errors fixed, `ComponentDetail.tsx` errors gone once `convex/packages.ts` helpers were typed. `tsc -b` passes locally.

- [x] Render `txt` and unknown code fence languages as plain text (2026-09-30 06:46 UTC)
  - `txt` fences on /components/workpool threw uncaught `resolveLanguage: "txt" not found` errors from `@pierre/diffs` and rendered empty. `CodeBlock` now sends empty, `text`, `txt`, `plaintext`, `plain`, and any language missing from Shiki's bundle to its `<pre>` path. Local production build: all 15 README code blocks on /components/workpool render (the 4 Axiom queries as plain text) with no console errors, and agent, workflow, rate-limiter and aggregate still highlight. Typecheck and eslint show only the pre-existing errors.

- [x] Monorepo folder URL tip (2026-09-26 08:32 UTC)
  - PRD: `prds/monorepo-aware-preflight.md` (follow-up entry)
  - [x] Locator returns `suggestedRepoUrl` when the component package is in a folder the URL didn't point at. It is stored on `preflightChecks` and returned by `/api/preflight`, including cached results
  - [x] Preflight results show "Tip: submit the folder URL" with a Use folder URL button that updates Continue to Submit
  - [x] Submit form: monorepo help line under Repository URL. `?repoUrl=` now replaces only the draft's repo URL and is removed from the address bar once signed in
  - [x] Verified on dev with `convex run` (daytona root suggests, folder URL and rate-limiter don't) and a signed-in browser pass

- [x] Monorepo-aware component lookup for preflight and admin AI review (2026-09-26 08:14 UTC)
  - PRD: `prds/monorepo-aware-preflight.md`
  - [x] New `convex/repoLocator.ts` reads the full repo tree (GitHub Trees API, GitLab recursive tree), respects `/tree/<branch>/<folder>`, groups component configs by package, and matches the npm package name
  - [x] URL problems return a code and fix URLs: `repo_not_found`, `branch_not_found`, `dir_has_no_component`, `multiple_components`
  - [x] Preflight returns 422 with suggestions. Signed-in 422s don't count against the limit. Results include `reviewedPath` and `reviewedRef`. The cache key includes branch and folder
  - [x] Admin AI review uses the same locator. URL problems save as `partial` so auto approve and auto reject skip them. `runAiReview` now requires an `@convex.dev` email
  - [x] GitLab repos now work in the preflight and admin review (closes the old "provider aware repo fetcher" to do)
  - [x] Lint hook false positive fixed by backticking function names in the two prompt strings
  - [x] UI: live branch and folder hint, monorepo help text, "Check this one" buttons, "Reviewed X on Y" line, Continue to Submit prefills the Repository URL (survives sign-in)
  - [x] Parity check: 169 of 173 approved repos resolve to the same folder, and the 4 differences are improvements. Verified on dev with curl, `convex run`, and a guest browser pass (see PRD log)

- [x] Shields style README badges (2026-09-26 07:13 UTC)
  - PRD: `prds/shields-style-badges.md`
  - [x] New `convex/badgeSvg.ts` with the Verdana 11px width table, `renderShieldsBadge`, and `BADGE_COLORS` (approved `#4c1`, other statuses unchanged)
  - [x] `convex/http.ts` `/api/badge` uses the helper. `convex/router.ts` left alone (not served by Convex)
  - [x] `badge-palette-preview.html` rewritten as one full width page, no cards or borders
  - [x] Docs: `src/docs/badges.md`, `src/docs/api-endpoints.md`
  - [x] Verified: output byte identical to `badge-maker@4` flat for 6 cases (including `&` and `<` escaping), `npx tsc -p convex --noEmit` clean, preview checked in browser
  - [x] Blurred text shadow from `badge-maker@6` added to match live shields.io, preview switched to `<img>` with live shields comparison and 3x zoom. 6 of 6 byte identical to v6 (2026-09-26 07:31 UTC)

- [x] Guest preflight check: Test link in header, signed out runs with safeguards (2026-09-24 19:25 UTC)
  - PRD: `prds/guest-preflight-check.md`
  - [x] `Test` link after Build in desktop and mobile header, shown to everyone, points at `/submit/check`
  - [x] Signed out POST `/api/preflight` runs a guest path instead of 401: directory origin only, `website` honeypot, URL length caps, one atomic `_reserveGuestCheck` mutation (kill switch, cache, in flight, 3 per hour per IP, 30 per hour site wide)
  - [x] Client IP now comes from `ctx.meta.getRequestMetadata()` with header fallback, so forwarded headers cannot reset limits
  - [x] Fixed for everyone: crashed runs no longer leave a pending row that locks the IP out (marked error, plus a 10 minute stale window), and error results are no longer cached for 30 minutes
  - [x] Admin toggle "Allow guest preflight checks" in AI Review Settings (default on), public `packages.getPreflightAccess` query for the page
  - [x] `SubmitCheck.tsx`: no redirect, guest banner with Sign in, paused guest card, guest modal copy, sign in link on limit errors, guest remaining count
  - [x] Verified: `tsc -p convex`, app typecheck (only pre-existing errors), eslint on touched lines, `convex dev` deployed the index, browser guest run passed with "2 guest preflight checks remaining", curl checks for bad origin (403), honeypot (400), bad URL (400), concurrent run (429), cached repeat (`cached: true`)

- [x] Review outcome messages: rejection and approval drafts in User Messages (2026-09-24 01:33 UTC)
  - PRD: `prds/review-outcome-messages.md`
  - [x] `shared/reviewCriteria.ts` and `shared/reviewMessages.ts`: criteria list with critical flags, pure rejection and approval builders that point to the Component Preflight Check
  - [x] `reviewMessageDrafts` table, `packageComments.source` accepts `"system"`, `convex/packageMessaging.ts` helpers, `addPackageComment` refactored onto `insertPackageComment`
  - [x] Drafts built on failed AI review save and on every real transition to rejected or approved. Auto send only on the transition and only when the setting is on
  - [x] Four admin settings (auto send rejection or approval, each with a GitHub toggle), `convex/reviewMessages.ts` admin API, `backfillRejectionDrafts` internal migration
  - [x] Admin composer draft mode, amber draft dot on Messages, AI Review panel hint, Review messages settings group, Auto-sent pill
  - [x] Verified: both typechecks, `convex dev --once`, `vite build`, convex-doctor 98/100, backfill dry run on dev

- [x] GitLab repository support, read parity for gitlab.com (2026-09-21 03:25 UTC)
  - PRD: `prds/gitlab-repo-support.md`
  - [x] `shared/repoUrl.ts`: one provider aware parser replacing six duplicated GitHub regexes. `parseRepoUrl`, `isSupportedRepoUrl`, `providerLabel`, `repoHostLabel`, `repoBlobUrl`, `repoRawUrl`, `repoIssuesUrl`, `repoOwnerUrl`. Accepts https, http, www, `git+https`, ssh, `.git`, trailing slash, fragments, GitHub `/tree` and `/blob`, GitLab `/-/tree` and `/-/blob`, nested groups. Rejects lookalike hosts. Checked against 20 shapes in a throwaway `/tmp` script.
  - [x] `convex/gitlabApi.ts`: GitLab REST v4 read adapter. `fetchGitLabFile` (raw, `ref=HEAD`), `fetchGitLabTree`, `fetchGitLabIssues` mapped to the existing `githubIssueValidator` shape, `fetchGitLabIssueCounts` from `x-total` headers, `fetchGitLabNamespaceAvatar` with relative path resolution, `fillGitLabAuthorAvatar` internal action plus `_setAuthorAvatar` internal mutation. Optional `GITLAB_TOKEN` (`PRIVATE-TOKEN`) with 401 retry and 429 surfaced as an error.
  - [x] `convex/packages.ts`: submit and edit validation, `buildPackageInsertData`, `scheduleSubmissionFollowups`, `autoFillAuthorFromRepo`, `fetchGitHubIssues`, `refreshGitHubIssueCounts` dispatch on provider. Local `parseGitHubRepo` deleted. GitHub branches unchanged.
  - [x] `convex/seoContent.ts` (`fetchRepoReadme`, `parseReadmeTarget`), `convex/http.ts` (preflight accepts both hosts), `convex/preflight.ts` (`normalizeRepoUrl` strips `/-/tree` and `/-/blob`), `convex/router.ts`, `shared/buildSkillMd.ts`, `convex/securityScan.ts` (Snyk and Devin messages say GitHub required), `convex/schema.ts` comments, `convex/aiSettings.ts` prompt wording.
  - [x] Frontend: new `src/components/RepoHostIcon.tsx`; `Submit`, `SubmitForm`, `SubmitCheck` use `isSupportedRepoUrl` with a live host icon and copy naming both hosts; `src/lib/markdownLinks.ts` rewrites relative links and images for both providers; provider aware copy and icons in `ComponentDetail`, `Profile`, `ProfileEditSubmission`, `ComponentDetailsEditor`, `FAQSection`, `Admin` (GitLab packages get "Issue mirroring is available for GitHub repositories only." under the reply box).
  - [x] Docs: `submit.md`, `component-detail.md`, `api-endpoints.md`, `admin-notes.md`, `admin-packages.md`, `admin-settings.md` (`GITLAB_TOKEN`), `admin-broadcast.md`, `profile.md`.
  - Verification: `tsc -p convex` clean; app typecheck only the four pre existing errors; eslint clean on new files and no new errors in modified files (per file counts vs HEAD); `vite build` passes; `npx convex dev --once` pushed. Live `packages:fetchGitHubIssues` returned mapped GitLab issues for `gitlab.com/gitlab-org/cli` (root and `/-/tree/main/docs`) and unchanged GitHub output for `get-convex/convex-helpers`. curl confirmed raw README at `ref=HEAD`, tree 404 on a missing path, `x-total` 399 open and 1526 closed, and the resolved group avatar URL returning 200. Two live findings fixed before finishing: gitlab.com omits `open_issues_count` for unauthenticated callers (now both counts use `x-total`) and group avatars are relative paths (now prefixed with the host). Browser: GitHub detail page renders View Repo icon and README with no console errors; FAQ shows "GitHub or GitLab". Submit pages and the preflight HTTP endpoint require auth, so those are listed under to do.

- [x] Restore the bottom-right drag grip in `DocSectionEditor` edit mode (2026-09-21 02:36 UTC)
  - [x] Textarea is `resize-y overflow-y-auto` again. `onPointerUp` records the dragged `offsetHeight` in `manualHeightRef`; the auto-grow effect uses `max(scrollHeight, minEditHeight, manualHeight)` so a drag becomes the new floor and typing never shrinks the box. Helper text: "Drag the corner for more room."
  - [x] `ComponentDetailsEditor.tsx` (admin) already had `resize-y` on all edit-mode textareas; no change needed there.
  - Verification: `tsc -p . --noEmit` clean, eslint clean. Throwaway Vite mount (removed): computed `resize: vertical`, `overflow-y: auto`, `min-height: 120px`; simulated grip drag to 320px then typed 50 chars, height stayed 320px while `scrollHeight` was 318px.

- [x] Docs-view editor for Component Directory Content and drag-box fix (2026-09-17 09:18 UTC)
  - [x] New `src/components/DocSectionEditor.tsx`: uppercase section heading plus rendered `Markdown` in preview, Preview / Edit toggle (`aria-pressed`), auto-growing textarea in edit mode, `Done` returns to preview, dashed empty-state prompt opens edit.
  - [x] `src/pages/ProfileEditSubmission.tsx` and `src/pages/SubmitForm.tsx`: replaced the `resize-y` textarea plus side-by-side or stacked preview blocks for Description, Use cases, and How it works with three `DocSectionEditor` instances inside one divided card. Dropped the unused `PencilSimple` import.
  - Verification: `tsc -p . --noEmit` clean. `DocSectionEditor.tsx` eslint clean (remaining errors in the two page files are pre-existing floating-promise warnings). Mounted in a throwaway Vite page (removed): textarea `resize: none`, `overflow-y: hidden`, height 161px at 3 bullets and 252px at 6 bullets with `offsetHeight === scrollHeight`, Done re-rendered all 6 bullets, empty How it works prompt opened a focused textarea.
  - PRD: `prds/docs-view-content-editor.md`

- [x] Add a "Build" nav link to the Convex components docs (2026-09-10 20:40 UTC)
  - `src/components/Header.tsx`: external link to `https://docs.convex.dev/components/overview` (new tab) after Directory in the desktop left nav and in the mobile dropdown menu.
  - Verification: `tsc -p .` clean.

- [x] Default the "Also send as a GitHub issue" checkbox to checked (2026-09-10 20:38 UTC)
  - `CommentsPanel` in `src/pages/Admin.tsx` initializes `alsoCreateGithubIssue` to `true`. Gate on `canMirrorToGithub` unchanged. `src/docs/admin-notes.md` step 3 updated to match.
  - Verification: `tsc -p .` clean, eslint clean on the changed lines.

- [x] Move GitHub Broadcast out of Settings into its own admin tab (2026-09-10 04:19 UTC)
  - [x] New `broadcast` filter tab next to Logs (`MegaphoneSimple`). Compose, reply sync, and history render as three cards. Settings jump nav no longer lists it. `#settings-github-broadcast` still opens the tab.
  - [x] `isAdminToolTab` covers Settings, API, Logs, Growth, and Broadcast so the package list stays hidden on all of them. Logs previously still showed the submissions list.
  - [x] Sending pill on the Broadcast tab while a job is running.
  - [x] Docs: `src/docs/admin-broadcast.md`, Settings keeps a pointer, dashboard/index/notes/updating-docs updated.
  - PRD: `prds/admin-broadcast-tab.md`
  - Files: `src/pages/Admin.tsx`, `src/pages/Documentation.tsx`, `src/docs/admin-broadcast.md` (new), `src/docs/admin-settings.md`, `src/docs/admin-dashboard.md`, `src/docs/admin-notes.md`, `src/docs/index.md`, `src/docs/updating-docs.md`

- [x] In-app documentation for GitHub issue messaging, broadcast, and reply sync (2026-09-09 05:45 UTC)
  - `src/docs/admin-notes.md`: new "GitHub issue messaging" section covering the checkbox, the per message GitHub state pills, the one open issue per package label logic, issue contents, how replies come back (via GitHub pill, unread count, one Slack post, dedupe, bot and self skip), and a pointer to broadcast.
  - `src/docs/admin-settings.md`: new "GitHub Broadcast and Reply Sync" panel section (filters and counts, 10 second stagger and rate limit math, history and error table, cancel / archive / restore / delete table with the delete side effect on reply matching, reply sync card fields, and the classic token setup steps). Environment variables table gained `GITHUB_TOKEN`, `GITHUB_NOTIFICATIONS_TOKEN`, and `SLACK_WEBHOOK_URL`.
  - `src/docs/profile.md`: "Messages that arrive as GitHub issues" subsection for submitters. `src/docs/index.md`: link descriptions updated.
  - Verification: `npm run build` passes; anchor ids match the viewer's heading slug rule.

- [x] GitHub reply sync, comment on the open issue, and broadcast archive / restore / delete (2026-09-09 05:35 UTC)
  - Reply sync: `convex/githubReplySync.ts` polls `GET /notifications?participating=true` every 2 minutes (cron `github-reply-sync`, gated by the `githubReplySyncEnabled` admin toggle and the stored `X-Poll-Interval`), sends `If-Modified-Since` so idle polls are free 304s, maps each issue thread to a package through the new `githubIssueKey` on `packageComments` or `issueKey` on `githubBroadcastItems`, fetches that issue's comments since the last poll minus a 10 minute buffer, drops the token user's own comments and bots, and inserts each reply as a `source: "github"` message that is unread for admins. One Slack post per reply through the shared `formatSlackNotification` (moved from `packages.ts` into `slack.ts`). Dedupe is on `githubCommentId`. Unmatched threads are left unread on GitHub and counted in the poll summary. Threads we did mirror are marked read.
  - Token handling: reads `GITHUB_NOTIFICATIONS_TOKEN` first, then `GITHUB_TOKEN`. The notifications endpoints only accept a classic PAT with the `notifications` scope, so a fine grained token yields a plain language `lastError` and a failing Test connection instead of a silent cron.
  - Comment instead of a second issue: `createIssueForComment` now checks for an open issue for the package (latest created comment issue or latest sent broadcast item), confirms its state with `GET /repos/{owner}/{repo}/issues/{n}`, and posts a comment there (`githubMirrorKind: "comment"`). If the issue is closed it opens a new one and marks the old rows closed. The admin checkbox label reads "Also reply on the open GitHub issue" or "Open a new GitHub issue (previous one is closed)" based on `getOpenIssueForPackage`.
  - Broadcast lifecycle: `archiveGithubBroadcast`, `restoreGithubBroadcast`, `deleteGithubBroadcast` (refuses while running; deletes items in batches of 500 via `_deleteBroadcastItemsBatch` and unsets `githubBroadcastId` on mirrored replies). `listGithubBroadcasts` takes `includeArchived`. History rows show a replies count, an Archived pill, and Archive / Restore / Delete pills; Delete uses the danger `ConfirmModal` and says that reply sync stops for that broadcast's issues.
  - Admin Settings gained a Reply sync card (on/off, token login and source, last poll, last result, last error, Test connection, Sync now) and a Show archived toggle. Profile threads show the same "via GitHub @login" pill.
  - PRD: `prds/github-reply-sync.md`
  - Files: `convex/schema.ts`, `convex/githubReplySync.ts` (new), `convex/githubIssues.ts`, `convex/packages.ts`, `convex/slack.ts`, `convex/crons.ts`, `src/pages/Admin.tsx`, `src/pages/Profile.tsx`, `changelog.md`, `files.md`
  - Verification: `tsc -p convex` clean; `tsc -p tsconfig.app.json` shows only the four pre-existing errors in untouched files; eslint reports zero errors on every changed line range in `Admin.tsx`, `Profile.tsx`, and `packages.ts`, and zero errors on the new and touched Convex files; `npm run build` (Netlify) passes. On dev: `npx convex dev` pushed schema, cron, and functions; `githubIssues:backfillGithubIssueKeys` keyed 1 comment and 1 broadcast item; `githubReplySync:_findIssueTargets` resolved `waynesutton/agent-ready-component#2` to its package and broadcast and skipped an unknown key; `githubReplySync:pollNotifications {force:true}` ran without throwing and wrote the expected 403 fine grained token message to `githubSyncState.lastError`. Live reply verification with a classic token is listed under to do.

- [x] GitHub issue messaging and broadcast (2026-09-08 18:40 UTC)
  - Feature 1: "Also send as a GitHub issue" checkbox in the admin user-messages panel, shown only when the package's `repositoryUrl` is on github.com. `addPackageComment` gained an optional `alsoCreateGithubIssue` flag (admin only, repo must parse); the comment saves first with `githubIssueStatus: "pending"`, then `githubIssues.createIssueForComment` opens the issue and patches the comment with the URL or the error. The thread shows pending / link / failed states reactively.
  - Feature 2: "GitHub Broadcast" section in admin Settings. Filter pills (Approved / Pending / Rejected / All) with a live eligible-vs-skipped count and duration estimate, title and body inputs, `ConfirmModal` with the exact count, live progress bar, cancel, and expandable per-package history with issue links. Backend is a sequential worker (`processNextBroadcastItem`) that sends one issue then reschedules 10s later, honors `Retry-After` / `X-RateLimit-Reset` on 403/429 with a 3 attempt cap per repo, and stops when cancelled.
  - PRD: `prds/github-issue-messaging.md`
  - Files: `convex/schema.ts`, `convex/githubIssues.ts` (new), `convex/packages.ts`, `src/pages/Admin.tsx`, `changelog.md`, `files.md`
  - Verification: convex typecheck clean, app typecheck shows only the four pre-existing errors in untouched files, eslint clean on `convex/githubIssues.ts` and on every new line range in `Admin.tsx` (baseline errors elsewhere unchanged), `npm run build` (Netlify) clean, `npx convex dev` watcher pushed the schema and functions to dev with "Convex functions ready!". `parseGitHubRepo` unit-checked against 11 URL shapes (https, .git, deep path, git+https, ssh, www, gitlab, owner only, garbage, undefined, lookalike host). Final pass after the `ConfirmModal` `void` wrapper fix (2026-09-08 19:30 UTC): `tsc -p convex` clean, `tsc -p tsconfig.app.json` shows only the pre-existing errors, eslint clean on the new `Admin.tsx` ranges, `vite build` passes. Browser verification of both flows is listed under to do.

- [x] Sync the Growth tab total with the dashboard and keep it current without npm calls (2026-09-04 18:55 UTC)
  - Two causes for the 32.9M vs 40.1M gap. `getGrowthSeries` returned a frozen snapshot total (built Aug 11) while the dashboard sums `allTimeDownloads` live, and the two covered different package sets (Growth: 146 approved; dashboard: 152 active, including 6 rejected community packages).
  - The snapshot now supplies only the curve's shape. The query returns `liveTotalDownloads` and `livePackagesIncluded` read off the packages table, plus `snapshotTotal` and `snapshotPackagesIncluded` for what the stored months cover, all through a shared `readGrowthPackages(ctx)` helper. `syncMonthsToLiveTotal` on the client extends the curve to the current month and trues up the final point, clamped so it cannot dip. Zero npm requests on page load.
  - Per the user's call, the dashboard's All Time Downloads card is now approved only rather than widening the Growth chart, since the share image says "approved components". Only that card changed.
  - PRD: `prds/growth-tab-live-total-sync.md`
  - Files: `convex/downloadsGrowth.ts`, `convex/dashboard.ts`, `src/components/DownloadsGrowthTab.tsx`, `src/pages/Dashboard.tsx`, `changelog.md`, `files.md`
  - Verification: convex typecheck clean, app typecheck shows only the four pre-existing errors in untouched files, eslint clean on the two changed Convex files and `DownloadsGrowthTab.tsx` (`Dashboard.tsx` shows only its three pre-existing floating-promise errors at lines 690, 1023, 1127). Needs a browser check after `npx convex dev` that the Growth header equals the dashboard card and the chart's right edge is Sep 2026.

- [x] Update `@convex-internal/web-analytics` to 2.1.0 (2026-08-26 15:30 UTC)
  - `package.json` only. No app code changes.

- [x] Return HTTP 404 for missing component slugs (2026-08-22 01:04 UTC)
  - Confirmed misses return 404; reserved routes and lookup failures keep the existing SPA response. Typecheck, build, and edge behavior smoke test pass.

- [x] Update `@convex-internal/web-analytics` to 2.0.1 (2026-08-21 23:02 UTC)
  - Bumped the package and pointed `WebAnalyticsProvider` at `@convex-internal/web-analytics/react`. Banner CSS still comes from the package; existing `.wa-banner` tokens in `src/index.css` are unchanged.

- [x] Update `@convex-internal/web-analytics` to 1.1.1 (2026-08-21 16:33 UTC)
  - `package.json` only. No app code changes.

- [x] Update `@convex-internal/web-analytics` to 1.1.0 (2026-08-21 14:43 UTC)
  - `package.json` only. No app code changes.

- [x] Admin-gate the public money, PII, and admin-control functions (2026-08-14 07:05 UTC)
  - A sec-check audit of all 211 public Convex functions found 51 with no auth reference in the handler. After separating the intentional public directory reads, the real gaps were: the two Tremendous reward actions (anyone could send a real gift card), the two payment queries (recipient emails, names, amounts, order ids), the admin settings read and both write mutations (auto-approve, API access, security scan, reward amount), five internal note and comment queries (`authorEmail` exposure), two admin config reads, and five AI or thumbnail generation actions (provider credit and compute abuse). Each now calls `requireAdminIdentity` first. The three migration backfills became `internalMutation` so they left the public API entirely, matching `backfillCategoryCounts`.
  - Deliberately left public after checking every call site: `getLatestSecurityScan` (`ComponentDetail`, `Submit`), `fetchGitHubIssues` and `refreshGitHubIssueCounts` (public issues panel), the directory reads, and `rateComponent`.
  - PRD: `prds/sec-check-public-function-auth-gaps.md`
  - Files: `convex/payments.ts`, `convex/paymentsDb.ts`, `convex/packages.ts`, `convex/seoContent.ts`, `convex/thumbnailGenerator.ts`, `convex/readmeAutoUpdate.ts`, `changelog.md`, `files.md`
  - Verification: convex typecheck clean, eslint clean on all six changed files, app typecheck shows only the four pre-existing errors in untouched files, `npx convex dev --once` pushed clean. Unauthenticated `curl` against the dev deployment with type-correct args returns `Authentication required` for `paymentsDb:getPaymentStats`, `packages:getAdminSettings`, `readmeAutoUpdate:getOfficialReadmeAutoUpdateSettings`, and `payments:sendTestReward` (blocked before any Tremendous call); both backfills return `Could not find public function`; control check `packages:listCategories` still returns data so public pages are unaffected. Prod picks this up on the next `npx convex deploy`.

- [x] Hide /components/submissions behind admin access (2026-08-13 06:10 UTC)
  - The submissions table page now requires a logged-in `@convex.dev` admin, matching `/submissions/admin`. New `SubmissionsGate` in `main.tsx` waits for auth and `api.auth.isAdmin` to settle, renders `Submit` for admins, and redirects everyone else (logged in or not) to `/components`. The header Submissions link (desktop and mobile) moved into the admin-only nav group, and `Submit.tsx` became a lazy chunk since the page is no longer indexed. `getSubmitPackagesPage` and `searchSubmitPackagesPage` are admin-gated server side and return empty pages for non-admins so the data cannot be pulled through the public API. SEO cleanup: removed `/components/submissions` from the sitemap in `convex/http.ts`, added it to `isNoindexPath` in `og-meta.ts`, and added an `X-Robots-Tag` header block in `netlify.toml`. No other routes changed.
  - PRD: `prds/hide-submissions-directory.md`
  - Files: `src/main.tsx`, `src/components/Header.tsx`, `convex/packages.ts`, `convex/http.ts`, `netlify/edge-functions/og-meta.ts`, `netlify.toml`, `changelog.md`, `files.md`
  - Verification: convex and app typecheck clean, vite build clean (Submit split into its own 35 kB chunk), eslint shows only the pre-existing baseline errors (verified identical on stashed baseline), convex dev deploy clean. CLI: unauthenticated `getSubmitPackagesPage`/`searchSubmitPackagesPage` return `{ items: [], total: 0 }`, admin identity gets full data. Browser: anonymous visit to `/components/submissions` redirects to `/components/`, header shows no Submissions link, `/submissions/admin` still shows the Admin Sign In prompt, dev sitemap no longer lists submissions. Prod picks this up on the next `npx convex deploy` plus Netlify deploy.

- [x] Directory list view with header toggle and admin thumbnail setting (2026-08-12 19:25 UTC)
  - Added a grid/list toggle to the header (Phosphor `Rows`/`SquaresFour`) that only renders on the Directory page via optional `viewMode` props on `Header`; on desktop it sits before the "Directory" nav link (moved from next to the search icon at 2026-08-12 20:01 UTC per feedback), on mobile next to the search icon. List mode keeps the sidebar and category headers and renders all sections (Featured, categories, Other, flat search) as compact rows through the new `ComponentListRow` component, with per-category "Load more" (then "View all"), a list-shaped loading skeleton, and the choice persisted in `localStorage`. Thumbnails are hidden in list view by default; the new global `showListViewThumbnails` admin setting (toggle in the Submit Listing Settings panel, moved there from AI Review Settings at 2026-08-12 19:58 UTC; read publicly via the slim `getListViewSettings` query) shows fixed-size right-side thumbnails and overrides per-category/per-component hide flags for list view only. Grid view untouched.
  - PRD: `prds/directory-list-view.md`
  - Files: `convex/packages.ts`, `src/components/ComponentListRow.tsx` (new), `src/components/Header.tsx`, `src/pages/Directory.tsx`, `src/pages/Admin.tsx`, `changelog.md`, `files.md`
  - Verification: dev deploy clean; `getListViewSettings` returns false by default; browser-verified grid unchanged, toggle + refresh persistence, list rows without thumbnails, and thumbnails appearing after flipping the admin setting (then restored); convex typecheck clean, app typecheck shows only pre-existing errors in untouched files.

- [x] Growth tab recording-friendly polish (2026-08-12 01:30 UTC)
  - Moved the "N package(s) skipped on the last run" note out of the header into its own strip between the chart card and the Share this growth section so screen recordings of the header and chart stay clean, and made the chart legend labels (max value marker like 33M and the month row like Aug 2026) bigger and bolder (11px soft gray to 16px semibold ink) in both the live chart and the exported image/video. UI only; no data refresh required.
  - Files: `src/components/DownloadsGrowthTab.tsx`
  - Verification: typecheck and eslint clean.

- [x] Growth tab date range and replay video export (2026-08-11 22:05 UTC)
  - Components authoring launched December 2025 (news.convex.dev/components-authoring), so the chart card gained a From/To month range selector that defaults to January 2025 through the latest month. The window frames the animated chart, the share image, and the new replay video, with a Reset link and a running total through the selected end month; changing it replays the animation. "Generate video" records the share card animation off screen (short hold, 2.4s sweep with a counting total, hold on the finished card) via canvas.captureStream and MediaRecorder, MP4 when the browser supports it (WebM fallback with a convert note), with inline preview and download. Backend untouched: cumulative totals stay all time so the header keeps matching the dashboard.
  - PRD: `prds/downloads-growth-share-chart.md` (date range and replay video follow-up)
  - Files: `src/components/DownloadsGrowthTab.tsx`
  - Verification: typecheck and eslint clean; browser harness recorded a 4.5s 1200x630 MP4 (video/mp4;codecs=avc1, ~1MB) and the rendered frame was visually verified via screenshot.

- [x] Growth tab incremental refresh from stored all time downloads (2026-08-11 21:55 UTC)
  - "Refresh data" no longer refetches every package's full npm history. The snapshot now stores its `packageNames`, and the default refresh is incremental: historical months are kept as-is, the newest point is trued up against the stored `allTimeDownloads` sum (the same figure the admin dashboard shows), and only packages new since the snapshot get their npm history fetched. Full rebuild runs automatically when there is no usable snapshot or packages were removed, or on demand via a new "Full rebuild from npm" link; the action returns `mode` so the toast says which path ran.
  - PRD: `prds/downloads-growth-share-chart.md` (follow-up section)
  - Files: `convex/schema.ts`, `convex/downloadsGrowth.ts`, `src/components/DownloadsGrowthTab.tsx`
  - Verification: typecheck and eslint clean; CLI smoke test on dev with an admin identity ran the forced full rebuild (18 packages, 25 months, 11.16M downloads, ~2.6 min) then the incremental pass (same totals in 1.2 s with zero npm calls); `packageNames` confirmed present in the saved snapshot.

- [x] Admin Growth tab: animated downloads chart with shareable image (2026-08-11 21:05 UTC)
  - New "Growth" tab in the admin dashboard showing cumulative all time npm downloads across every approved component as an animated dither dot-matrix hockey stick (warm cream background, orange dots, no green, no dark mode). Refresh data runs a new admin action that pulls each package's full daily download history from npm's range API (540-day windows), aggregates by month, and saves a `downloadGrowthSeries` snapshot; npm 429 rate limiting is handled with fully sequential fetching, 400ms spacing, exponential backoff, and a second retry pass. The tab also generates a 1200 x 630 share PNG (editable title full card or chart-only) with download, copy to clipboard, and post on X actions.
  - PRD: `prds/downloads-growth-share-chart.md`
  - Files: `convex/schema.ts`, `convex/downloadsGrowth.ts` (new), `src/components/DownloadsGrowthTab.tsx` (new), `src/pages/Admin.tsx`
  - Verification: convex deploy, app typecheck (only pre-existing errors), and eslint clean; CLI smoke test on dev with an admin identity fetched 21/21 packages with 0 failures (~40M downloads, 92 months, ~2.7 min, under the 10 min action limit); chart and both share card variants visually verified in the browser against the real dev snapshot.

- [x] Admin-gate the auto-refresh admin functions (2026-08-06 03:15 UTC)
  - Security review flagged `updateRefreshSetting`, `getRefreshStats`, and `getRecentRefreshLogs` as public functions with no auth check: anyone could read refresh logs/stats and toggle the auto-refresh setting unauthenticated. `getRefreshSettings` had the same gap. Fixed with the file's existing patterns: the mutation now calls `requireAdminIdentity` (throws `Authentication required`), and the three queries use `getAdminIdentity` and return safe defaults for non-admins (`[]`, zeroed stats, default settings) to avoid info leakage. No frontend changes needed since `AutoRefreshSettingsPanel` only renders for confirmed admins, and no cron or action calls these functions.
  - PRD: `prds/admin-gate-refresh-functions.md`
  - Files: `convex/packages.ts`, `changelog.md`
  - Verification: dev deploy and lints clean; unauthenticated curls against the dev deployment's public API confirmed the queries return empty/default data and the mutation throws before writing. Prod picks this up on the next `npx convex deploy`.

- [x] Fix scheduled auto-refresh failing silently every night (2026-08-06 03:00 UTC)
  - Root cause: `_getStalePackages` returned `{ _id, name, lastRefreshedAt }` but `_refreshPackageBatch`'s args validator only accepts `{ _id, name }`. Convex rejects extra object fields, so every batch scheduled by `scheduledRefreshCheck` failed argument validation before the handler ran. Nightly refresh logs on prod sat at `status: "running"` with 0 succeeded / 0 failed / no errors since 2026-07-27, and approved packages drifted 9+ days stale even with Auto-Refresh enabled and a 3 day interval. Manual refresh buttons kept working because `_getAllApprovedPackages` returns the correct shape.
  - Fix: dropped `lastRefreshedAt` from `_getStalePackages`'s map and returns validator (only used internally for staleness sorting, which happens before the map).
  - PRD: `prds/scheduled-refresh-validation-fix.md`
  - Files: `convex/packages.ts`, `changelog.md`
  - Verification: lints clean; ran the real cron path on dev (temporarily enabled `autoRefreshEnabled`, invoked `packages:scheduledRefreshCheck` via CLI): found 18 stale packages, log completed with 18 succeeded / 0 failed, then restored the dev toggle to off. Prod still runs the broken code until the next `npx convex deploy`; its stuck "running" logs age out via the existing 30-log cleanup.

- [x] Official README auto-update with admin logs (2026-08-06 02:45 UTC)
  - Admin toggle plus schedule select (every hour default / day / 3 days / week / month) in the Official Convex Components block that auto-refreshes READMEs for all approved, visible official components (get-convex org / `@convex-dev` scope). New `convex/readmeAutoUpdate.ts` holds the cron handler (`scheduledOfficialReadmeUpdate`, gated on the `officialReadmeAutoUpdateEnabled` toggle and `officialReadmeUpdateIntervalHours` interval against `officialReadmeLastRunAt`, staggering `internal.seoContent.refreshReadme` calls 10 seconds apart), log mutations (`_insertReadmeUpdateLog`, `_cleanupOldReadmeUpdateLogs` capping at 500 rows, `_clearReadmeUpdateLogsBatch`), and the admin API (`getOfficialReadmeAutoUpdateSettings`, `updateOfficialReadmeAutoUpdateSettings`, `listReadmeUpdateLogs` paginated with status/source index filters, `deleteReadmeUpdateLogs`, `clearReadmeUpdateLogs`). `refreshReadme` gained an optional `source` arg (cron / admin / profile) and logs every outcome; `_updateReadmeOnly` skips identical writes and reports whether content changed. Hourly cron `official-readme-auto-update` registered at :30. Admin UI: pill toggle, schedule select, and last-run stamp in Category Management, plus a new Logs tab (`ReadmeUpdateLogsTab`) with status/source/text filters, selectable rows, Delete selected, Clear logs behind `ConfirmModal`, and Load more pagination.
  - PRD: `prds/official-readme-auto-update.md`
  - Files: `convex/schema.ts`, `convex/readmeAutoUpdate.ts` (new), `convex/seoContent.ts`, `convex/seoContentDb.ts`, `convex/packages.ts`, `convex/crons.ts`, `src/pages/Admin.tsx`, `changelog.md`, `files.md`
  - Verification: convex typecheck and dev deploy clean (new table indexes pushed); lints clean on all edited files; app typecheck shows only the three pre-existing unrelated errors (`CodeBlock.tsx`, `CategoryPage.tsx`, `ComponentDetail.tsx`). Full CLI smoke test on dev with an admin identity: toggled on, manual `scheduledOfficialReadmeUpdate` scheduled 10 of 10 official packages and stamped `lastRunAt`, staggered fetches ran one per 10 seconds, `readmeUpdateLogs` recorded 9 `changed: true` and 1 `changed: false` (`@convex-dev/stripe`, byte-identical README skipped the write), an immediate re-run was blocked by the interval gate, `listReadmeUpdateLogs` filtered by status and source correctly, a non-admin call returned an empty page, `deleteReadmeUpdateLogs` removed exactly the selected row, cleanup was a no-op under the cap, and the toggle was returned to its default off state.

- [x] Remove person icon from Community pill on directory cards (2026-08-06 06:10 UTC)
  - The pill is now text-only so it stops crowding the card footer; Verified keeps its check icon. File: `src/components/ComponentCard.tsx`. Lints clean.

- [x] Curated categories with member badges (2026-08-06 00:55 UTC)
  - New "curated" category type modeled on the derived official category: a `categories` row with `kind: "curated"` plus optional `badgeStorageId`/`badgeUrl`, whose members are hand-picked by admins through a new `categoryMemberships` join table (indexes `by_category`, `by_package`, `by_category_and_package`), so components keep their primary category and can join any number of curated collections. Member packages carry a denormalized `curatedBadges` array (slug, label, optional badgeUrl) resynced by `rebuildCuratedBadgesForPackage` / `rebuildCuratedBadgesForCategoryMembers` on add/remove, rename, badge change, and delete. `listApprovedComponents`, `getCategoryBySlug`, and `recountCategoryStats` gained curated branches via `listApprovedCuratedPackages` (approved + visible members only). New admin functions: `listCuratedCategoryMembers`, `addComponentToCuratedCategory` / `removeComponentFromCuratedCategory` (idempotent), `saveCategoryBadge` / `clearCategoryBadge`; `upsertCategory` accepts `kind` on create only and `deleteCategory` cascades memberships. `validateAndApplyCategory` rejects curated slugs as primary categories and `useDirectoryCategories` hides them from the submit picker. UI: badge images render on `ComponentCard` inline in the title right before the first letter of the component name (square corners; long names keep truncating, footer row untouched) and next to the badges on `ComponentDetail` (only when a badgeUrl exists); `CategoryManagementPanel` in Admin gained a Curated checkbox on create, a curated chip, and a per-category `CuratedCategoryControls` panel with badge upload/replace/remove and a member search picker built on `adminSearchPackages`.
  - PRD: `prds/curated-categories.md`
  - Files: `convex/schema.ts`, `convex/packages.ts`, `src/components/ComponentCard.tsx`, `src/pages/ComponentDetail.tsx`, `src/pages/Directory.tsx`, `src/pages/CategoryPage.tsx`, `src/pages/Admin.tsx`, `src/lib/categories.ts`, `changelog.md`, `files.md`
  - Verification: convex and app typechecks pass; lints clean on all edited files; schema deployed to dev (new `categoryMemberships` indexes confirmed in the push log). Full CLI smoke test on dev with an admin identity: created a curated category, added an approved package, `listCuratedCategoryMembers` returned it, `getCategoryBySlug` counted 1 member / 1 verified, `listApprovedComponents` with the curated slug returned exactly that member carrying `curatedBadges: [{ categorySlug, label }]` (badge-less case), assigning the curated slug as a primary category threw the expected ConvexError, and `deleteCategory` removed the membership and cleared `curatedBadges` from the package, leaving no curated categories behind. Badge image upload uses the existing `generateUploadUrl` storage flow and should get a quick visual pass in the admin UI.

- [x] npm URL mismatch check and review flow (2026-08-05 07:30 UTC)
  - `updateMySubmission` now parses the package name from a changed npm URL (existing `parsePackageNameFromNpmUrl`). A different name than `pkg.name` saves the URL but sets a new `pendingNpmName` field on `packages` and extends the Slack message with the old and new names plus a note that name, slug, install command, and downloads keep tracking the old package. Same-name edits and self-reverts clear the flag. New admin mutation `resolveNpmNameChange` (accept or revert): accept schedules `_applyNpmRename`, which validates the new package on the registry via `fetchNpmPackageHandler` (a failed fetch leaves the flag set), renames via `_finishNpmRename` (name, install command, npm URL, SKILL.md rebuild, slug untouched), and refreshes registry data through the existing `_updateNpmDataAndTimestamp`; revert restores `npmUrl` from `pkg.name`. Edit page: client-side parse mirror, amber inline warning under the npm field, `NpmChangeConfirmModal` ("Save and request review"), "npm change pending review" chip in the info card, and a review-specific success toast. Admin: amber "npm mismatch" badge on flagged rows and `NpmMismatchPanel` in the expanded view with Accept rename and Revert URL behind `ConfirmModal`s.
  - PRD: `prds/npm-url-mismatch-review.md`
  - Files: `convex/schema.ts`, `convex/packages.ts`, `src/pages/ProfileEditSubmission.tsx`, `src/pages/Admin.tsx`, `changelog.md`, `files.md`
  - Verification: convex typecheck passes; app typecheck shows only the two pre-existing unrelated errors (`CodeBlock.tsx`, `CategoryPage.tsx`); lints clean on all edited files; the shared parse regex passes 8 cases including scoped (`@scope/name`), URL-encoded (`%40scope%2Fname`), query string, and hash variants; schema and all three new functions confirmed deployed to dev; `_applyNpmRename` stale-request guard verified as a no-op on a real dev package (no `pendingNpmName` set, record unchanged). The signed-in UI matrix (mismatch save with Slack, self-revert, admin accept, admin revert) needs a manual pass since every entry point is auth-gated by design.

- [x] Profile edit page: editable repo and npm links with auto security re-scan (2026-08-05 01:50 UTC)
  - `updateMySubmission` now accepts optional `repositoryUrl` and `npmUrl`, validated with the same submission-time helpers (`parseGitHubRepo`, `parsePackageNameFromNpmUrl`). Real changes (trimmed compare against stored values) send a Slack message to the Convex team with old and new values and queue an automatic security scan (status set to `scanning`, `internal.securityScan._runSecurityScan` scheduled) when the `autoSecurityScan` admin setting is on, a repo URL exists, and no scan is running, mirroring the new-submission flow. `buildSubmissionUpdates` rebuilds `skillMd` with the new links. On `ProfileEditSubmission.tsx`, a Links section at the top of the form groups GitHub Repository URL, npm URL, Live Demo or Example App URL, and Video URL (old Demo/Video inputs lower in the form removed), the `Package:` name line was removed from the info card, and save errors now surface `ConvexError` messages (invalid URL formats). The `EditModal` on Profile.tsx is untouched; new args are optional.
  - PRD: `prds/profile-edit-links-rescan.md`
  - Files: `convex/packages.ts`, `src/pages/ProfileEditSubmission.tsx`, `changelog.md`, `files.md`
  - Verification: convex and app typechecks pass; lints clean on both edited files; form field order confirmed (Links first, then name/category, descriptions, generated content, tags, logo, thumbnail); no-change saves skip Slack and the scan by design.

- [x] Edge function headers fix (2026-07-27 18:55 UTC)
  - The PageSpeed pass headers never applied in production: Netlify ignores `[[headers]]` rules for URLs handled by an edge function, and og-meta was mapped to all of `/components/*` including every asset and font. Result: assets stayed on `max-age=0`, Vercel's proxy edge never cached them (`x-vercel-cache: MISS`, 150 to 275 ms per asset through two proxy layers, revalidated every page load), and noindex routes had no `x-robots-tag`. Fixed with `excludedPath = ["/components/assets/*", "/components/fonts/*"]` on the og-meta declaration (static files now serve from Netlify's store where the immutable rule applies), a one-week fonts cache rule (`max-age=604800, stale-while-revalidate=86400`, fonts are not hashed), and og-meta setting `X-Robots-Tag: noindex, nofollow` itself for admin/callback/profile/dashboard/documentation via a new exact-match `isNoindexPath` helper.
  - PRD: `prds/edge-function-headers-fix.md`
  - Files: `netlify.toml`, `netlify/edge-functions/og-meta.ts`, `changelog.md`, `files.md`
  - Verification: netlify.toml parses (python tomllib) with the expected edge function and headers structure; lints clean on both files; 18 case node test of `isNoindexPath` extracted from the source passes, including the danger cases (`/components/submissions` and `/components/submit` stay indexable, `/components/profilex` and `/components/dashboard-tips` do not match). Safety checks from the Ask mode review: og-meta is a pure passthrough for asset/font paths, the live sitemap (138 URLs) has no slugs under either excluded path, and `excludedPath` as a netlify.toml array is documented Netlify syntax. Post-deploy: `curl -I` a hashed asset for `immutable` plus `x-vercel-cache: HIT` on the second request, a font for the one-week rule, `/components/dashboard` for `x-robots-tag`, `/components/submissions` for its absence, and a detail page for intact meta/prerender.

- [x] Compact directory page header to cut whitespace (2026-07-27 05:20 UTC)
  - The gap between the "Components" title block and the Featured section was ~90px of stacked padding: `pt-8 pb-4` on the title, `py-4` on the content container, and `lg:pt-12` on the sidebar. Built five HTML mockups (current annotated, plus four options) in `mockups/components-header-mockups.html` for review; option A chosen. Title dropped from `text-2xl` to `text-xl` with the subtitle inline on the same baseline (`flex flex-wrap items-baseline`), header padding tightened to `pt-5 pb-1`, and the sidebar `lg:pt-12` removed so the Submit button and category list align with the Featured heading.
  - Files: `src/pages/Directory.tsx`, `mockups/components-header-mockups.html` (new), `mockups/shot-*.png` (mockup screenshots)
  - Verification: lints clean on `Directory.tsx`; 4 insertions / 4 deletions in the diff; layout matches the approved option A mockup. Visual check available at the dev server `/components/` route.

- [x] Fix Auto-Refresh Settings panel never rendering in Admin Settings (2026-07-27 00:45 UTC)
  - Root cause: `useQuery(api.packages.getRefreshStats, { now: Date.now() })` in `AutoRefreshSettingsPanel` created new args every render, so each query result triggered a resubscribe and `useQuery` never resolved, leaving the panel stuck at its `return null` gate since the 2026-03-26 convex-doctor pass. Fixed by capturing the timestamp once via `useState(() => Date.now())`. Verified both backing queries succeed on dev and prod via direct `/api/query` calls (prod: `autoRefreshEnabled: false`, 91/134 packages stale, last run 2026-07-15, matching the 11-day-old npm numbers the panel was supposed to explain). Grep confirmed no other `useQuery` call passes an inline `Date.now()`.
  - Files: `src/pages/Admin.tsx`, `changelog.md`
  - Verification: app typecheck shows only the two pre-existing unrelated errors; lints clean on `Admin.tsx`. Not deployed to production; ships with the next normal deploy.

- [x] PageSpeed LCP and bundle split (2026-07-27 00:27 UTC)
  - Initial JavaScript bundle cut from 513,824 to 273,486 bytes brotli (47%; raw 2,034,626 to 1,143,408 bytes). Noindex routes (Admin, Dashboard, Documentation, Profile, ProfileEditSubmission, SubmitCheck) now load via `React.lazy` behind a single `min-h-screen` Suspense fallback; indexed routes stay eager so crawlers never wait on a chunk and SEO stays at 100. New `CodeBlockLazy.tsx` keeps the 325 KB `@pierre/diffs` + Shiki chunk out of the initial load with a plain `<pre>` fallback. Fixed the inert `public/_headers` (never applied because it landed at `dist/components/_headers` while Netlify publishes `dist`) by moving the rules into `netlify.toml` `[[headers]]`: noindex for admin/callback/profile/dashboard, immutable one-year caching for hashed assets. LCP/CLS polish: two above-the-fold font preloads in `index.html` (link tags only, og-meta regexes untouched), Directory skeleton now mirrors the real card layout so cards do not shift when data lands, explicit width/height on the Header logo and ComponentCard images, and `verbose: true` removed from the Convex client.
  - PRD: `prds/pagespeed-lcp-bundle-split.md`
  - Files: `netlify.toml`, `public/_headers` (removed), `index.html`, `src/main.tsx`, `src/components/CodeBlockLazy.tsx` (new), `src/pages/ComponentDetail.tsx`, `src/components/Markdown.tsx`, `src/components/AgentInstallSection.tsx`, `src/pages/Directory.tsx`, `src/components/Header.tsx`, `src/components/ComponentCard.tsx`, `changelog.md`, `files.md`
  - Verification: app typecheck shows only the two pre-existing unrelated errors in `CodeBlock.tsx` and `CategoryPage.tsx`; lints clean on all edited files; production build emits separate chunks for all six lazy routes plus CodeBlock; built `index.html` still contains exactly one `<div id="root"></div>` and a single-line title, so the og-meta edge function regexes keep working. Browser test against `vite preview`: directory renders with live data, detail page renders with title, canonical, and `SoftwareSourceCode` JSON-LD injected, and the Documentation and Dashboard chunks load on demand with their admin auth gates intact. Post-deploy: `curl -I` `/components/dashboard` for `x-robots-tag` and a hashed asset for `immutable`, then re-run Lighthouse; field CWV is a rolling 28 day window.

- [x] Per-category thumbnail toggle (2026-07-26 23:55 UTC)
  - Added a "Hide all thumbnails in this category" checkbox to the category edit form in Settings > Category Management, backed by a new optional `hideThumbnails` field on the `categories` table. Fixes uneven grids like the Official Convex Components page, where two image cards sat beside eight text cards. Applies to the category landing page and that category's grouped directory section; Featured is untouched because it already forces thumbnails on. Composes with the per-component `hideThumbnailInCategory` by OR, so neither switch clobbers the other. Existing rows default to false, and the admin list shows a "thumbnails hidden" badge.
  - PRD: `prds/category-hide-thumbnails.md`
  - Files: `convex/schema.ts`, `convex/packages.ts`, `src/pages/Admin.tsx`, `src/pages/CategoryPage.tsx`, `src/pages/Directory.tsx`, `changelog.md`, `files.md`
  - Verification: convex typecheck passed; app typecheck shows only the two pre-existing unrelated errors in `CodeBlock.tsx` and `CategoryPage.tsx`; lints clean on every edited file. On dev, `getCategoryBySlug` for `get-convex` returned `hideThumbnails: false` and `listCategories` returned the boolean on every row, confirming existing rows default to showing thumbnails. Flipping the flag is admin gated, so the visual pass is left to the running app.

- [x] Official Convex Components category (2026-07-26 19:20 UTC)
  - Admin toggle in Settings > Category Management enables a top level `get-convex` category with its own landing page at `/components/categories/get-convex`. Membership is derived from the get-convex GitHub org / `@convex-dev` npm scope rule (lifted into `shared/officialComponents.ts` and now shared with the official llms.txt and markdown endpoints), so components keep their existing functional category and appear in both. Implemented as a real `categories` row carrying a new `derivedFrom: "official"` field, which keeps admin listing, enable/disable, counts, sidebar links, search, sort, and pagination working unchanged; only `recountCategoryStats`, `getCategoryBySlug`, and `listApprovedComponents` branch on it. `sortOrder` defaults to `-1` so it sorts first. Excluded from all category pickers and from the sidebar "All" total; manual assignment and slug renames are rejected.
  - PRD: `prds/official-convex-components-category.md`
  - Files: `shared/officialComponents.ts` (new), `convex/schema.ts`, `convex/packages.ts`, `convex/http.ts`, `src/pages/Admin.tsx`, `src/lib/categories.ts`, `src/components/CategorySidebar.tsx`, `src/pages/Profile.tsx`, `src/pages/ProfileEditSubmission.tsx`, `changelog.md`, `files.md`
  - Verification: convex typecheck passed; app typecheck shows only the two pre-existing unrelated errors in `CodeBlock.tsx` and `CategoryPage.tsx`; lints clean on every edited file. On dev, an independent node pass over `listApprovedComponents` found 10 official of 18 approved (8 verified); after enabling the category, `getCategoryBySlug` returned count 10 / verified 8, `listApprovedComponents` with `category: "get-convex"` returned exactly those 10 (each keeping its own category), and `listCategories` returned the row first with `derived: true`. The dev row was left enabled so the category can be inspected in the running app; production stays off until the toggle is used.

- [x] Dashboard npm sync column and filter (2026-07-26 06:05 UTC)
  - Added a sortable "Last npm Sync" column after Last Published in the dashboard Components table plus a matching "npm Sync" filter (synced last 24h, synced last 7 days, stale over 7 days, never synced, sync errors) so admins can verify the npm refresh is working. The cell renders `lastRefreshedAt` as a relative age with the absolute timestamp on hover, "Never" when a package has never synced, amber past seven days, and a red warning icon holding the `refreshError` text. Never-synced rows sort as oldest. The value flows into the CSV and PDF exports and the PDF filter summary; the empty-state `colSpan` moved from 8 to 9. No backend change was needed because `lastRefreshedAt` and `refreshError` already ship through `adminPackageValidator` on `getAllPackages`.
  - PRD: `prds/dashboard-npm-sync-column.md`
  - Files: `src/pages/Dashboard.tsx`, `changelog.md`, `files.md`
  - Verification: `npx tsc --noEmit -p tsconfig.app.json` reports only the two pre-existing unrelated errors in `CodeBlock.tsx` and `CategoryPage.tsx`; lints clean on `Dashboard.tsx`.

- [x] Submit flow feedback fixes (2026-07-24 06:20 UTC)
  - Five fixes from user feedback: (1) Name placeholder changed from "Convex Agent" to "Component Name" in all five files so submitters are not nudged into putting Convex in the title (updated 2026-07-24 06:30 UTC from an initial "Rate Limiter" example per feedback). (2) Submit form and preflight checker now ask for the npm package name and build the npm URL client-side via new `src/lib/npmPackage.ts` (pasted npm URLs auto-convert to the name; backend payload unchanged). (3) Fixed README include-marker extraction: `sanitizeReadme` stripped all HTML comments (including the START/END markers) before extraction ran, so it always fell back to "full"; extraction now runs on the raw README (`rawFullContent`) and the marked block gets a light cleanup. (4) Previews in submit/profile/admin editors now use the detail page's `markdown-body` class (new `markdown-body-compact` variant) instead of no-op `prose` classes, so lists render with bullets. (5) Submit form drafts persist to sessionStorage and restore after the WorkOS auth redirect; cleared on successful submit.
  - PRD: `prds/submit-flow-feedback-fixes.md`
  - Files: `src/pages/SubmitForm.tsx`, `src/pages/SubmitCheck.tsx`, `src/pages/Submit.tsx`, `src/pages/Profile.tsx`, `src/pages/ProfileEditSubmission.tsx`, `src/components/ComponentDetailsEditor.tsx`, `src/lib/npmPackage.ts` (new), `src/index.css`, `convex/seoContent.ts`
  - Verification: app and convex typechecks pass (two pre-existing unrelated `tsc` errors in `CodeBlock.tsx`/`CategoryPage.tsx` confirmed present on the clean tree); lints clean on all edited files; node test of the extraction pipeline confirmed markers are detected on raw text (including CRLF), the old order reproduces the bug, and the no-marker fallback output is unchanged; npm name validation and URL parsing verified for plain, scoped, and pasted-URL inputs; `npx convex dev` deployed the backend change successfully.

- [x] User README refresh from profile (2026-07-23 21:30 UTC)
  - "Update README" button added to Profile submission cards (between Edit and Send Request, only when the submission has a repo URL). Backed by new public mutation `packages.refreshMyReadme` with auth, `userOwnsPackage` ownership check, repo URL requirement, and a 3-per-10-minutes per-user rate limit stored in the new `readmeRefreshRequests` table; on success it schedules the existing `internal.seoContent.refreshReadme` GitHub fetch (same as the admin button). Rate limit `ConvexError` messages surface in the toast; a 60s client cooldown prevents double clicks. `getMySubmissions` now returns `hasRepositoryUrl` to gate the button.
  - PRD: `prds/user-readme-refresh.md`
  - Files: `convex/schema.ts`, `convex/packages.ts`, `src/pages/Profile.tsx`, `changelog.md`, `files.md`
  - Verification: `npx tsc --noEmit -p convex/tsconfig.json` passed; lints clean on all three edited files; pre-existing app `tsc` errors in `CodeBlock.tsx` / `CategoryPage.tsx` are untouched files and unrelated.

- [x] Header component search (2026-07-15 06:30 UTC)
  - Phosphor `MagnifyingGlass` icon added left of the Submit link in the header (desktop nav) and as an always-visible mobile control. Clicking opens a dropdown panel (styled like the notifications dropdown) with an auto-focused input, 300ms debounced live results, verified badges, category labels, and a "View all results in directory" footer. Enter or the footer navigates to `/components/?q=<term>`, which pre-fills the existing Directory search (existing search behavior unchanged). New public Convex query `searchDirectoryComponents` runs full text search across `search_name`, `search_componentName`, `search_description`, and a new `search_shortDescription` index, filtered to approved+visible and skipping deletion-marked packages, capped at 10 compact PII-free results. The shortDescription index was added because npm `description` values are often generic while the human blurb lives in `shortDescription`.
  - PRD: `prds/header-component-search.md`
  - Files: `src/components/HeaderSearch.tsx` (new), `src/components/Header.tsx`, `src/pages/Directory.tsx`, `convex/packages.ts`, `convex/schema.ts`, `changelog.md`, `files.md`
  - Verification: `npx tsc --noEmit -p .` and `npx tsc -p convex --noEmit` passed; `npx convex run packages:searchDirectoryComponents` on dev returned only approved visible components for "agent" and matched shortDescription text for "vector search"; browser test confirmed icon placement, dropdown results, result navigation to detail pages, and `?q=` pre-filling the directory search.
  - Follow-up (2026-07-15 17:40 UTC): keyboard navigation in the search dropdown. ArrowDown/ArrowUp cycle a highlighted row (wraps at the ends, scrolls into view via `scrollIntoView` block nearest), Enter opens the highlighted result or falls back to the directory, mouse hover syncs the highlight, highlight resets when results change. File: `src/components/HeaderSearch.tsx`. Verified with frontend typecheck.
  - Follow-up (2026-07-15 18:05 UTC): Cmd+K / Ctrl+K global shortcut toggles the header search and focuses the input. Guarded so only the visible instance (desktop or mobile) responds via `offsetParent`; shortcut hint added to the icon tooltip and as a kbd badge inside the input (desktop only, uses `bg-bg-card` token). File: `src/components/HeaderSearch.tsx`. Verified with frontend typecheck.

- [x] Skill version numbers and agent instruction block (2026-07-15 05:05 UTC)
  - Version lines added to every entry in `/components/llms.txt`, `/components/get-convex-llms.txt`, `/components/components.md`, `/components/get-convex.md` (live from `packages.version`); SKILL.md frontmatter gains `version:` plus a pinned `Current npm version: package@x.y.z` line in both the v2 and legacy v1 builders. `_updateNpmDataAndTimestamp` rebuilds `skillMd` when the npm refresh (cron or admin button) picks up a new version. One-line agent instruction added to index headers, each SKILL.md, per-component markdown, and per-component llms.txt. New admin `rebuildAllSkillMd` force rebuild (ran on dev: 7 packages patched).
  - PRD: `prds/skill-version-and-agent-instructions.md`
  - Files: `convex/http.ts`, `shared/buildSkillMd.ts`, `convex/seoContent.ts`, `convex/packages.ts`, `convex/seoContentDb.ts`, `changelog.md`, `files.md`
  - Verification: `npx tsc -p convex --noEmit` and `npm run build` passed; curl on dev confirmed version lines + instruction headers on all four indexes and in rebuilt skills; simulated version bump 0.2.0 -> 0.2.1 -> 0.2.0 through `_updateNpmDataAndTimestamp` rebuilt the cronjobs skill both directions.

- [x] Label markdown and llms URLs in the agent copy prompt (2026-07-14 18:30 UTC)
  - `generateClaudePrompt` now emits `- Markdown:` and `- LLMs.txt:` labels alongside the existing `- Skill:` label, matching `generateUniversalPrompt`. Also fixed the stray `- Repository:` bullet in `generateUniversalPrompt` when a component has a repo URL but no slug (documentation lines are collected first; the header only renders when links exist).
  - Files: `src/lib/promptComposer.ts`, `changelog.md`, `task.md`
  - Verification: `ReadLints` clean on `promptComposer.ts`; prompt is a pure string template so no runtime behavior change beyond the label text.

- [x] Official get-convex components list for agents (2026-07-14 04:50 UTC)
  - New `/components/get-convex-llms.txt` and `/components/get-convex.md` endpoints listing only components with a `github.com/get-convex/` repo or `@convex-dev/` npm scope. Served live from `_listApprovedPackages` (auto-updates on approval). Shared `buildLlmsTxtBody`/`buildMarkdownIndexBody` builders keep the full-directory endpoints byte-compatible; main llms.txt and the official list cross-link each other. Netlify redirects + og-meta proxy branches added; Directory For Agents section gained the two new buttons with official-only copy.
  - PRD: `prds/get-convex-official-list.md`
  - Files: `convex/http.ts`, `netlify.toml`, `netlify/edge-functions/og-meta.ts`, `src/pages/Directory.tsx`, `changelog.md`, `files.md`
  - Verification: `npx tsc -p convex --noEmit` and `npm run build` passed; curl on dev deployment returned 200 with exactly the 10 `@convex-dev/` components on both routes; full-directory endpoints unchanged apart from the cross-link header line.

- [x] Skill URL and agent install (2026-07-13 19:05 UTC)
  - SKILL.md now served at `/components/<slug>/SKILL.md` via new `/api/skill` GET + OPTIONS routes in `convex/http.ts` (404 for hidden/archived/missing/`hideSeoAndSkillContentOnDetailPage`), `skillPath`/`skillUrl` in `shared/componentUrls.ts`, and SKILL.md proxying in the `component-markdown` edge function.
  - Skill block in "Use with agents and CLI" (`AgentInstallSection.tsx`): Copy skill, View SKILL.md, and an install skill agent prompt labeled "Paste this prompt into any agent" (`generateSkillInstallPrompt` + `getSkillFolderName` in `promptComposer.ts`). Harness tabs and curl one liners were removed 2026-07-13 19:35 UTC per feedback.
  - Skill URL in Claude/universal prompts and discovery endpoints (`/api/component-llms`, `/api/llms.txt`, `/api/markdown-index`, `buildComponentMarkdown`, `buildMarkdownDoc`); detail page footer SKILL.md link; removed dead `handleCopySkill`/`skillCopied`; Download Skill folder-hint tooltip.
  - Detail page polish (2026-07-13 19:42 UTC): author row order swapped so "For Agents" renders before "Download Skill"; footer link text changed from generic "View llms.txt" / "View SKILL.md" to `{component.name} llms.txt` / `{component.name} SKILL.md` for better anchor-text SEO/AEO signals.
  - Footer spacing and headings (2026-07-13 20:01 UTC): removed the doubled divider above Related Components and centered the llms/SKILL link row between the two dividers (24px each side); added a "For LLMs and AI agents" h3 above the links for AEO/SEO context; restyled the all-caps Keywords label into a semantic h3 matching the "From the README.md" heading style.
  - Admin: "Update Skill"/"Generate Skill" button next to Update README calling new `rebuildSkillMd` mutation, plus "Backfill Skills" button triggering `backfillAllSkillMd` (batched, self-scheduling) for approved packages missing `skillMd`.
  - PRD: `prds/skill-url-and-agent-install.md`
  - Files: `convex/http.ts`, `convex/seoContentDb.ts`, `shared/componentUrls.ts`, `netlify/edge-functions/component-markdown.ts`, `src/components/AgentInstallSection.tsx`, `src/lib/promptComposer.ts`, `src/pages/ComponentDetail.tsx`, `src/pages/Admin.tsx`, `changelog.md`, `files.md`
  - Verification: `npx tsc -p convex --noEmit` and `npm run build` passed; curl on dev deployment confirmed `/api/skill` 200/404 behavior and skill links in llms.txt, component-llms, markdown, and markdown-index outputs.

- [x] Fix README relative links resolving to app origin (404), including monorepo subdir repos (2026-06-26 19:10 UTC)
  - Symptoms: exa `[example/README.md](/example/README.md)` → `convex.dev/example/README.md` (404); posthog `[example app](../../examples/example-convex/)` → `convex.dev/examples/example-convex/` (404). The posthog link is in the stored `readmeIncludedMarkdown` snapshot (older README revision), not the current GitHub README.
  - Root cause: `markdownLinks.ts` returned root-relative (`/x`) hrefs untouched, and only parsed bare `owner/repo` — so monorepo subdirectory URLs (`github.com/PostHog/posthog-js/tree/main/packages/convex`) didn't parse (link passed through → resolved against the page path → `convex.dev/...`), and `../../` relative links resolved against the repo root instead of the README's subdir. Base ref was hardcoded to `main` (404s on `master` repos).
  - Fix: resolver now parses `owner`/`repo`/`ref`/subdir from the repository URL, resolves relative links against the README's subdir (so `../../examples/example-convex/` → repo-root `examples/example-convex/`), maps root-relative `/x` to repo root, and builds `https://github.com/<owner>/<repo>/blob/<ref>/<path>` (GitHub 301s `/blob/<dir>`→`/tree/<dir>`). `ref` = branch from URL else `HEAD`. Images use `raw.githubusercontent.com/<owner>/<repo>/<ref>/`. Preserves query/`#frag`; anchors/absolute/`//`/non-GitHub pass through unchanged.
  - Files: `src/lib/markdownLinks.ts`, `changelog.md`, `task.md`, `files.md`
  - Verification: `ReadLints` clean; Node sim confirmed exa + posthog cases and pass-throughs; `curl` confirmed `blob/main/examples/example-convex/` → 301→tree, `blob/main/packages/convex/CONTRIBUTING.md` → 200, `blob/HEAD/example/README.md` → 200.

- [x] In-app review status notifications for submitters (2026-07-09 04:14 UTC)
  - Users now see a "Status updates" section in the header bell when their submission moves to in_review, approved, changes_requested, or rejected. Fires for admin manual review and all AI auto-review paths (auto in_review on submit, auto approve/reject) since every transition flows through `updateReviewStatusHelper`.
  - New `statusNotifications` table + `createStatusNotification` helper (skips no-op transitions, pending state, missing submitter email, and duplicate unread rows). New `convex/notifications.ts` with the bell feed query and mark-read mutations (JWT email ownership checks). `Header.tsx` renders copy per status with colored dots, includes the count in the badge, marks read on click, and offers "Mark all read".
  - PRD: `prds/status-change-notifications.md`
  - Files: `convex/schema.ts`, `convex/packages.ts`, `convex/notifications.ts`, `src/components/Header.tsx`, `changelog.md`, `files.md`
  - Verification: `npx tsc -p convex --noEmit` passed; app tsc only shows pre-existing errors; eslint clean on new code; `npx convex dev --once` deployed the table indexes and functions.

- [x] Fix `ReturnsValidationError` in `getPromptVersions` / `getSeoPromptVersions` (2026-06-21 17:14 UTC)
  - Root cause: full docs returned by `.take(50)` include `_creationTime`, but the `returns:` object validators omitted it, and Convex rejects extra properties at runtime.
  - Fix: removed the `returns:` validators from both admin queries (Option B), relying on TS inference per Convex's updated return-validator guidance. Consumers in `Admin.tsx` only read existing fields, so adding `_creationTime` is backward compatible.
  - Files: `convex/aiSettings.ts`, `changelog.md`, `task.md`, `files.md`
  - Verification: `ReadLints` clean; `v` still used by other functions in the file.

- [x] Update OpenAI env-fallback model to gpt-5.5 and fix Chat Completions token param (2026-06-21 23:55 UTC)
  - `convex/seoContent.ts`: `gpt-4o` -> `gpt-5.5`. `convex/aiReview.ts`: stale `gpt-5.2` -> `gpt-5.5`.
  - Both OpenAI calls now use `max_completion_tokens` (GPT-5 rejects `max_tokens`; `gpt-4o` and admin-set models accept the new param too), with budget bumped to 4000/4096 so reasoning tokens don't starve visible output.
  - `src/pages/Admin.tsx`: Anthropic "Model docs" link updated to `platform.claude.com/.../models/overview`; rest of that file's diff is Prettier formatting only.
  - Files: `convex/seoContent.ts`, `convex/aiReview.ts`, `src/pages/Admin.tsx`, `changelog.md`, `task.md`
  - Verification: `npx tsc -p convex --noEmit` passed; `ReadLints` clean. Needs a valid `CONVEX_OPENAI_API_KEY` on the deployment to succeed at runtime.

- [x] Update Anthropic env-fallback model to Claude Sonnet 4.6 (2026-06-21 23:47 UTC)
  - `convex/seoContent.ts` `buildSeoCandidates` used the deprecated default `claude-sonnet-4-20250514`, which returned a 404 `not_found_error` from the Anthropic API ("All AI providers failed").
  - Fix: changed the env default to `claude-sonnet-4-6` (Claude Sonnet 4.6 API ID per the Anthropic models overview). `convex/aiProviderFallback.ts` needs no change — it passes `defaultEnvModels[provider]` straight through without hardcoding any model.
  - Files: `convex/seoContent.ts`, `changelog.md`, `task.md`
  - Verification: `npx tsc -p convex --noEmit` passed; `ReadLints` clean on `seoContent.ts` and `aiProviderFallback.ts`. Requires a valid `ANTHROPIC_API_KEY` (and ideally `CONVEX_OPENAI_API_KEY`) on the Convex deployment for the fallback chain to fully succeed at runtime.

- [x] Edge-prerender crawlable content for component detail pages (2026-06-16 12:50 UTC)
  - Component detail pages (`/components/<slug>`) are a client-rendered SPA, so the first-pass HTML body is empty until JS runs. Googlebot renders JS but in a deferred pass subject to budget/timeouts; injecting content into the first-pass HTML makes indexing more reliable (helps clear "Crawled - currently not indexed").
  - Fix: `netlify/edge-functions/og-meta.ts` injects real content into `#root` for component detail pages only (h1, value prop, install, about, benefits, use cases, FAQ, links), reusing `getComponentBySlug`. `createRoot()` replaces it on mount, so no visual change.
  - Scope: `/components` index is out of scope (the `/components/*` edge path doesn't match bare `/components`; needs a separate path-matching change). Sitemap/robots.txt confirmed healthy.
  - PRD: `prds/seo-crawlable-body-injection.md`
  - Files: `netlify/edge-functions/og-meta.ts`, `prds/seo-crawlable-body-injection.md`, `changelog.md`, `task.md`, `files.md`
  - Verification: confirmed on deploy preview 33 — detail page raw HTML contains injected `<h1>` + content (9 KB vs ~4 KB empty shell).

- [ ] Inject crawlable content on the `/components` index (follow-up)
  - Blocked on Netlify path matching: the `og-meta` edge function `path = "/components/*"` does not match the bare `/components` URL, so the index branch never runs there. Needs an added `[[edge_functions]] path = "/components"` entry (or equivalent) before the index injection can ship.

- [x] Fix weekly downloads showing 0 for new packages (2026-06-12 00:25 UTC)
  - Root cause: npm's `point/last-week` API alias lagged nine days, so packages published inside the lag window (like `@exalabs/convex-exa`, published 2026-06-03) reported 0 weekly downloads while npmjs.com showed 70.
  - Fix: `fetchNpmPackageHandler` now uses an explicit 7-day window ending today. Admin refresh pipeline, logs, and scoped-name encoding were all verified working.
  - PRD: `prds/npm-weekly-downloads-stale-window.md`
  - Files: `convex/packages.ts`, `prds/npm-weekly-downloads-stale-window.md`, `changelog.md`, `task.md`
  - Verification: `ReadLints` clean; live curl of `point/2026-06-05:2026-06-11/@exalabs/convex-exa` returns 70. Needs an admin Refresh on the Exa package after deploy to update the stored value.

- [x] Rotate `GITHUB_TOKEN` and confirm AI review passes again (2026-06-12 00:11 UTC)
  - Old classic token expired 2026-06-03, causing every review to fail. A fine-grained replacement was rejected by the Exa Labs org policy (403: fine-grained tokens with lifetime over 366 days forbidden), so a new classic token with `public_repo` scope was set via `npx convex env set GITHUB_TOKEN`.
  - Verification: `npx convex run aiReview:runPreflightCheck` on exa-labs/exa-convex returned `status: "passed"` with all 14 criteria passing.
  - PRD: `prds/ai-review-github-token-401.md`

- [x] Preflight check admin bypass for @convex.dev users (2026-06-11 21:55 UTC)
  - Admins signed in with an `@convex.dev` email skip the 10 checks/hour rate limit, the 30-minute repo cache, and the in-flight gate on `/api/preflight`, so every run is fresh.
  - Frontend warning modal shows admin-specific copy and the "checks remaining" footer hides for admins (backend omits `remaining`).
  - PRD: `prds/preflight-admin-bypass.md`
  - Files: `convex/http.ts`, `src/pages/SubmitCheck.tsx`
  - Verification: `ReadLints` clean; `npx tsc --noEmit` passed.

- [x] Fix AI reviews failing with false "No convex.config.ts found" (2026-06-11 21:48 UTC)
  - Root cause: expired/revoked `GITHUB_TOKEN` env var made GitHub return 401 for every request, and `fetchGitHubRepo` treated all non-OK responses as missing files.
  - Fix: `githubFetch` helper in `convex/aiReview.ts` retries without the token on 401 and throws a clear `ConvexError` on 403/429 so reviews record `error` instead of false `failed`.
  - PRD: `prds/ai-review-github-token-401.md`
  - Files: `convex/aiReview.ts`, `prds/ai-review-github-token-401.md`, `changelog.md`, `task.md`
  - Verification: `npx tsc -p convex --noEmit` passed; `npx convex run aiReview:runPreflightCheck` shows 401 fallback warning and clean `error` status.

- [x] Fix Unicode bullet use-case lists rendering as one paragraph (2026-06-11 13:30 UTC)
  - Root cause: LLM-generated `generatedUseCases` used `•` instead of markdown `-` list markers.
  - Fix: composable `normalizeMarkdown` pipeline in `shared/normalizeMarkdown.ts`; applied at render, save, and export; prompt now requires `-`  per line.
  - Files: `shared/normalizeMarkdown.ts`, `shared/seoPromptTemplate.ts`, `src/components/Markdown.tsx`, `convex/seoContent.ts`, `convex/packages.ts`, `convex/http.ts`, `convex/router.ts`, `shared/buildSkillMd.ts`, `changelog.md`, `task.md`, `files.md`
  - Verification: `npx tsc --noEmit` passed.

- [x] Clarify submit form "Component Directory Content" is optional (2026-05-27 20:12 UTC)
  - User reported confusion when submitting without clicking "Generate Content." Investigated backend: all generated content fields are `v.optional()` in schema, action args, and insert mutation. No server validation requires them.
  - Fix: added "(optional)" label and updated helper text to explain users can skip and add content later from their profile.
  - Files: `src/pages/SubmitForm.tsx`, `changelog.md`, `task.md`, `files.md`
  - Verification: `ReadLints` clean; `npm run build` passed.

- [x] Profile edit thumbnail upload and replace (2026-05-19 UTC)
  - Users can add, replace, or remove thumbnails from Profile edit (`ProfileEditSubmission.tsx`, linked from Profile Edit button).
  - Backend: `clearThumbnail` mutation; `getMySubmissionForEdit` includes thumbnail fields.
  - Files: `convex/packages.ts`, `src/pages/ProfileEditSubmission.tsx`, `src/pages/Profile.tsx`, `files.md`, `changelog.md`, `task.md`
  - Verification: `npm run build` passed.

- [x] Submit form optional thumbnail upload with generation protection (2026-05-19 UTC)
  - Submitters can upload 16:9 thumbnails on `SubmitForm.tsx`; uploads are protected from auto and manual generation via `thumbnailUploadedByUser`.
  - Admin `ComponentDetailsEditor` hide-thumbnail checkbox now persists immediately (matches Admin inline Hide Thumb toggle).
  - Profile `SubmissionCard` shows `thumbnailUrl` from `getMySubmissions` with no extra client changes.
  - Files: `convex/schema.ts`, `convex/packages.ts`, `convex/thumbnails.ts`, `convex/thumbnailGenerator.ts`, `src/pages/SubmitForm.tsx`, `src/components/ComponentDetailsEditor.tsx`, `src/pages/Admin.tsx`, `files.md`, `changelog.md`, `task.md`
  - Verification: `ReadLints` clean on edited frontend files; `npx tsc --noEmit -p convex/tsconfig.json` passed; `npm run build` passed (Netlify `npm run build` step).

- [x] Restore GitHub owner avatar URLs for organizations (2026-05-15 04:34 UTC)
  - Root cause: author avatar generation used `https://avatars.githubusercontent.com/{owner}`, which can fail for organization owners such as `get-convex`.
  - Fix: restored `https://github.com/{owner}.png` in new submission author data, admin auto-fill, and the avatar URL migration path.
  - Guardrail: documented that owner avatars should not be changed back to the CDN username format.
  - Files: `convex/packages.ts`, `task.md`, `changelog.md`, `files.md`
  - Verification: `ReadLints` clean on edited files; `npx tsc --noEmit -p convex/tsconfig.json` passed.

- [x] Add Auto AI Review completion status to Slack when enabled (2026-05-04 18:50 UTC)
  - PRD: `prds/auto-ai-review-slack-status.md`
  - Fix: `convex/packages.ts` now sends one grouped completion Slack message when `autoAiReview` is enabled and both security scan and AI review have terminal results. If `autoAiReview` is off, the existing security-only Slack completion message still sends unchanged.
  - Files: `convex/packages.ts`, `prds/auto-ai-review-slack-status.md`, `task.md`, `changelog.md`, `files.md`
  - Verification: `ReadLints` clean on `convex/packages.ts`; `npx tsc --noEmit -p convex/tsconfig.json` passed; `npx netlify build --offline --context production` passed.

- [x] Move related components below the sidebar on mobile detail pages (2026-05-04 18:49 UTC)
  - Fix: `src/pages/ComponentDetail.tsx` now renders Related Components in the main content column on desktop and after the sidebar on mobile, so narrow screens read main content, sidebar, then related components.
  - Files: `src/pages/ComponentDetail.tsx`, `files.md`, `task.md`, `changelog.md`
  - Verification: `ReadLints` clean on `src/pages/ComponentDetail.tsx` and `files.md`; `npx tsc -p . --noEmit --pretty false` passed; Netlify build command `npm run build` passed.

Session updates complete on 2026-04-21 UTC.

- [x] Add Share this page dropdown to component detail sidebar (2026-04-21 17:37 UTC)
  - Root cause: the component detail page had no way for visitors to share a component to social networks or copy the canonical URL from the sidebar.
  - Fix: added a new inline `ShareThisPage` component inside `src/pages/ComponentDetail.tsx` rendered between the rating stars and the "How to get help" button. Items: Share on X, LinkedIn, Bluesky, Reddit, Mastodon, Other... (uses `navigator.share` when available, otherwise copies the URL), and Copy link. Styling matches the existing Markdown dropdown on the same page so it blends into the sidebar. Trigger carries `aria-expanded` and `aria-haspopup="menu"`, the menu uses `role="menu"` with `role="menuitem"` children, and an `sr-only` `aria-live="polite"` region announces "Link copied". Outside click and Escape close the menu.
  - Files: `src/pages/ComponentDetail.tsx`, `task.md`, `changelog.md`, `files.md`
  - Verification: `ReadLints` clean on `src/pages/ComponentDetail.tsx`.

- [x] Add thumbnail sizing FAQ for component authors (2026-04-20 UTC)
  - Root cause: component authors had no guidance on the expected thumbnail size for directory cards, so submissions shipped with inconsistent aspect ratios and resolutions.
  - Fix: added a new FAQ entry in `src/components/FAQSection.tsx` titled "What size should my component thumbnail be?" that documents the 16:9 aspect ratio at 1536 x 864 pixels. The entry sits between "What are the requirements?" and "How are components sandboxed?" so authors see it alongside the core submission rules. FAQ now renders 12 items on Directory, CategoryPage, and SubmitForm.
  - Files: `src/components/FAQSection.tsx`, `task.md`, `changelog.md`, `files.md`
  - Verification: `ReadLints` clean on `src/components/FAQSection.tsx`; `npm run build` passed.

- [x] Fix mobile settings and API layouts in admin dashboard (2026-04-17 23:04 UTC)
  - PRD: `prds/admin-mobile-settings-api.md`
  - Root cause: the admin settings and API views still had a few desktop-first mobile layouts. Category management rows packed too many badges into one line, the API tab still showed the generic submissions list, and the API analytics/access sections relied on dense row layouts plus a desktop table that compressed poorly on phones.
  - Fix: updated `src/pages/Admin.tsx` so the main admin tabs now scroll horizontally on mobile with readable labels, the sticky settings jump nav has cleaner spacing, category management rows wrap and stack safely, the submissions search/list stay hidden on the `api` tab, the API analytics endpoint rows are wrap-safe, recent requests switch to stacked mobile cards, and the grant/revoke rows stack cleanly on narrow screens.
  - Files: `src/pages/Admin.tsx`, `prds/admin-mobile-settings-api.md`, `task.md`, `changelog.md`, `files.md`
  - Verification: `ReadLints` clean on `src/pages/Admin.tsx`; `npm run build` passed; `npx netlify build --offline --context production` passed.

- [x] Align desktop metadata rows in submit and admin tables (2026-04-17 22:26 UTC)
  - Root cause: the desktop submission rows mixed plain text spans with badge components and icon links that used slightly different inline alignment and line-height behavior, so version, status, visibility, detail link, downloads, and date did not share one clean center line.
  - Fix: updated `src/pages/Submit.tsx` and `src/pages/Admin.tsx` to use consistent `inline-flex` centering, tightened badge line-height, and added small desktop-only alignment wrappers for the metadata columns. Mobile layouts were left unchanged.
  - Files: `src/pages/Submit.tsx`, `src/pages/Admin.tsx`, `task.md`, `changelog.md`, `files.md`
  - Verification: `ReadLints` clean on edited files; `npm run build` passed; `npx netlify build --offline --context production` passed with Edge Functions bundling.

- [x] Final mobile polish for expanded admin sections and Netlify build verification (2026-04-17 18:51 UTC)
  - Root cause: after the width fixes, the expanded mobile admin sections were technically fitting but still felt too loose vertically, especially around the outer disclosure cards and the nested AI Review Results and Component Details surfaces. The session notes also needed one final sync that explicitly recorded the build result.
  - Fix: tightened mobile padding on the outer disclosure shells in `src/pages/Admin.tsx` and the nested `ComponentDetailsEditor` card in `src/components/ComponentDetailsEditor.tsx` using `p-2.5 sm:p-3`, reduced some mobile-only top spacing (`mt-2.5 sm:mt-3`), and kept desktop spacing unchanged. Verified the production Netlify build with `npm run build` and it passed successfully.
  - Files: `src/pages/Admin.tsx`, `src/components/ComponentDetailsEditor.tsx`, `prds/admin-mobile-expanded-editors.md`, `TASK.md`, `changelog.md`, `files.md`
  - Verification: `ReadLints` clean on edited files; `npm run build` passed (`vite build`, completed successfully).

- [x] Fix expanded admin section width on mobile at the parent package layout level (2026-04-17 18:51 UTC)
  - Root cause: the expanded package shell in `src/pages/Admin.tsx` used `flex flex-col ... items-start` on mobile. Because `items-start` disables cross-axis stretching, the left content column (`AuthorToggleSection`, `AiReviewResultsPanel`, `PackageComponentDetailsEditor`, `PackageMetadataEditor`) sized itself to its contents instead of the card width. That made the expanded mobile sections appear wider than the viewport even after inner rows were made wrap-safe.
  - Fix: changed the expanded package wrapper from `items-start` to `items-stretch sm:items-start` and added `w-full` to the left content column. On mobile, the expanded content column now stretches to the card width, so Package Metadata, AI Review Results, and Component Details all inherit the correct width constraint. Desktop layout stays the same.
  - Files: `src/pages/Admin.tsx`, `prds/admin-mobile-expanded-editors.md`, `TASK.md`, `changelog.md`, `files.md`
  - Verification: `ReadLints` clean on `src/pages/Admin.tsx`.

- [x] Make expanded admin editor sections mobile responsive (2026-04-17 17:52 UTC)
  - PRD: `prds/admin-mobile-expanded-editors.md`
  - Root cause: several expanded admin editors still used desktop-first horizontal layouts inside a narrow mobile card. `SubmitterEmailEditor` had a hard `grid-cols-2` form and long read-only email rows without break guards. `ComponentDetailsEditor` used inline tool rows for author autofill, logo controls, thumbnail generation, thumbnail upload, badge markdown, and save or regenerate actions. `AiReviewResultsPanel` in `src/pages/Admin.tsx` kept the status icon, title, date, copy button, and chevron in one row with no `min-w-0`, so the header and expanded body could exceed the viewport.
  - Fix: stacked or wrapped every dense mobile row while keeping desktop behavior. `SubmitterEmailEditor` now uses `grid-cols-1 sm:grid-cols-2`, wraps long read-only strings with `break-words` or `break-all`, and lets action buttons wrap. `ComponentDetailsEditor` now adds `min-w-0 overflow-hidden` at the root, stacks the save header on mobile, converts the author auto-fill row and thumbnail-generation row to `flex-col sm:flex-row`, wraps logo and thumbnail action clusters, stacks the checkbox groups, constrains badge markdown with internal `overflow-x-auto`, wraps generated-content preview panes in local horizontal scroll containers, and makes regenerate or save action rows wrap cleanly. `GeneratedContentSection` and `SeoContentSection` now use mobile-safe header and action layouts, and the `react-markdown` component override typing was normalized with `Components` plus `ComponentPropsWithoutRef` so the edited file ends lint-clean. `AiReviewResultsPanel` now gives the left header cluster `min-w-0 flex-1`, moves title plus date into a stackable sub-column, keeps the copy and chevron controls shrink-safe on the right, and adds `min-w-0 overflow-hidden` plus `break-words` to the expanded summary and error blocks. `PackageMetadataEditor` also now wraps its footer action row and adds an overflow guard on the expanded container.
  - Files: `src/pages/Admin.tsx`, `src/components/ComponentDetailsEditor.tsx`, `prds/admin-mobile-expanded-editors.md`, `TASK.md`, `changelog.md`, `files.md`
  - Verification: `ReadLints` clean on `src/pages/Admin.tsx` and `src/components/ComponentDetailsEditor.tsx`.

- [x] Mobile: fix orphaned Hide button in expanded Component Author / Details / Metadata sections (2026-04-17 17:35 UTC)
  - Root cause: the previous fix stacked the header onto two rows on mobile (`flex-col`), which worked fine when collapsed but looked broken when expanded — the pill button ("Hide") was left floating between the description text and the expanded content, creating dead vertical space between the section description and the first field.
  - Fix: reverted the three disclosure headers (`AuthorToggleSection`, `PackageComponentDetailsEditor`, `PackageMetadataEditor`) back to a single-row `flex items-start justify-between gap-2 sm:gap-3` layout. Text wrapper gets `min-w-0 flex-1` so the title + description use all available width; pill button keeps `shrink-0 whitespace-nowrap` so it never truncates. To keep the collapsed row from wrapping on narrow screens, mobile-only shortened labels were added: "Show author" → "Show", "Edit details" → "Edit", "Edit metadata" → "Edit" (via `sm:hidden` / `hidden sm:inline` span swap). Open state keeps the compact "Hide" label for all three. Now on mobile, both states render as: `[title + desc on left | compact pill on right]` above `[expanded content]`.
  - Files: `src/pages/Admin.tsx`, `changelog.md`, `TASK.md`
  - Verification: `ReadLints` clean.

- [x] Mobile admin card polish: component name, section headers, action labels (2026-04-17 17:20 UTC)
  - Root cause 1 (component name hidden): the collapsible package header row in `AdminDashboard` (`src/pages/Admin.tsx` ~line 9094) rendered `<span className="font-medium ... truncate">{pkg.name}</span>` without `flex-1 min-w-0`. Siblings (version pill, StatusBadge, VisibilityBadge, PaymentBadge, ComponentDetailQuickLink, date) all had `shrink-0`, so on a 375px viewport the truncated name collapsed to 0px width and disappeared completely. Users only saw version + badges + date with no package identity.
  - Fix 1: added `min-w-0 flex-1` to the name span and switched to `pkg.componentName || pkg.name` so the friendly component name shows when set. Wrapped `PaymentBadge` and `ComponentDetailQuickLink` in `<span className="hidden sm:inline-flex">` so they only appear on desktop, freeing horizontal space on mobile for the name.
  - Root cause 2 (cramped section headers): Component Author, Component Details, and Package Metadata disclosures (`AuthorToggleSection`, `PackageComponentDetailsEditor`, `PackageMetadataEditor`) used `flex items-center justify-between gap-2 sm:gap-3` with the pill button sharing the row. On mobile the button took ~80px on the right, forcing "PACKAGE METADATA" to wrap to two lines and descriptions to three lines. Looked unfinished.
  - Fix 2: switched all three disclosure headers to `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3` so on mobile the title + description get full width on top and the pill drops to its own row with `self-start sm:self-auto`. Added `min-w-0` to the text wrapper for safety. Desktop layout unchanged.
  - Root cause 3 (icon-only action buttons): every action button in the Actions, Status, Review, and Visibility rows of `InlineActions` used `<span className="hidden sm:inline">{label}</span>`, leaving admins with unlabeled circle icons on mobile. No way to tell Hide from Feature from Reward without opening a tooltip.
  - Fix 3: removed `hidden sm:inline` from 18 label spans inside `InlineActions` (Convex Verified, Community, Generate Content, Update README, Hide SEO, Auto-fill, Hide Thumb, Refresh, Slug, Reward, History, Status `{btn.label}`, Security Scan, Review history, Unarchive, Visibility `{btn.label}`, Feature, Sub Hide, Delete) plus `AiReviewButton`, `NotesButton` ("Notes"), and `CommentsButton` ("Messages") which all render inside the Visibility row. Buttons now show icon + text on mobile, wrap naturally via the existing `flex-wrap` containers, and give admins readable mobile usability. Badges inside the collapsed card header (StatusBadge, VisibilityBadge, PaymentBadge) still use icon-only mobile mode since they sit in the compact summary row.
  - Files: `src/pages/Admin.tsx`, `changelog.md`, `TASK.md`
  - Verification: `ReadLints` clean on `src/pages/Admin.tsx`.

- [x] Mobile overflow fix for User Messages and Admin Notes comment cards (2026-04-17 10:30 UTC)
  - Root cause: in `AdminPackageCommentsPanel` (`src/pages/Admin.tsx`) every comment card used `flex items-start justify-between gap-2` with a single-row meta group (user icon + name + date + optional New badge) and an action group (Hide + Archive + Delete). On narrow screens the meta row had no wrap and no `whitespace-nowrap` on the date, so "Apr 16, 11:36 PM" broke across four lines, and the action cluster pushed the red Delete pill off the right edge of the modal.
  - Fix: switched the header row to `flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2` so actions stack below the meta on mobile. Meta group now `flex flex-wrap items-center gap-x-2 gap-y-1` with `whitespace-nowrap` on the name, date, and New badge so they stay intact but wrap to the next line as needed. Action group now `flex flex-wrap items-center gap-1 shrink-0` with `whitespace-nowrap shrink-0` on every pill so Hide/Archive/Delete never get clipped. Comment body gets `break-words` so long unbroken strings (URLs, lorem ipsum) don't push the card sideways. Same whitespace-nowrap + break-words polish applied to `AdminPackageNotesPanel` notes and replies for consistency.
  - Files: `src/pages/Admin.tsx`, `changelog.md`, `TASK.md`
  - Verification: `ReadLints` clean.

- [x] Fix duplicate mobile search and make mobile search box white (2026-04-17 10:22 UTC)
  - Root cause: `src/pages/Admin.tsx` had two wired-up search inputs — a sticky "Admin Dashboard" header search (line ~2811) that was always visible, plus a `sm:hidden` mobile search inside `AdminDashboard` (line ~8904). The header search was never hidden on mobile, so both rendered and the header one got its placeholder clipped to "Search packa" next to the "Admin Dashboard" label.
  - Fix: added `hidden sm:block` to the header search input wrapper so only the "Admin Dashboard" label shows on mobile. The mobile-only search inside `AdminDashboard` now switches from `bg-bg-card` (cream) to `bg-white` and from `rounded-lg` to `rounded-full` so it reads as white and matches the rest of the site's pill design system.
  - Files: `src/pages/Admin.tsx`, `changelog.md`, `TASK.md`
  - Verification: `ReadLints` clean.

- [x] Mobile fix for stats + links row in expanded admin package card (2026-04-17 10:15 UTC)
  - `src/pages/Admin.tsx` "Stats and links" row (downloads, date, npm/repo/demo buttons): on narrow screens the date span was wrapping onto three lines because the single flex row had to share width with the three pill buttons. Changed the parent from `flex items-center gap-4 shrink-0 w-full sm:w-auto` to `flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 ...` so on mobile the stats sit on one row above the link pills, and added `whitespace-nowrap` to the downloads and date spans so "Mar 26, 2026" stays on a single line. Desktop layout is unchanged. The links container also drops `ml-auto` on mobile (it was just pushing buttons across the row) and keeps `sm:ml-0` + `flex-wrap` as a safety net.
  - Files: `src/pages/Admin.tsx`, `changelog.md`, `TASK.md`
  - Verification: `ReadLints` clean.

- [x] Mobile polish for bell dropdown, admin editors, and message panel headers (2026-04-17 10:05 UTC)
  - `src/components/Header.tsx` `renderBellDropdown`: dropdown now uses `fixed + left-1/2 -translate-x-1/2` on mobile so it centers below the header instead of getting clipped on the left edge; desktop keeps the previous `absolute right-0 top-full` behavior via `sm:` overrides. Width is `calc(100vw - 1rem)` with `max-w-sm` on mobile so it sits comfortably inside the viewport.
  - `src/pages/Admin.tsx` Component Details, Component Author, and Package Metadata disclosures: the right-side pill buttons ("Edit details", "Show author", "Edit metadata") now use `px-2 py-1 text-[11px]` on mobile and `sm:px-3 sm:py-1.5 sm:text-xs` on desktop, with `whitespace-nowrap` + `shrink-0` to prevent wrapping. Labels collapse to "Hide" when open so the open state is compact on narrow screens. Parent row gap drops from `gap-3` to `gap-2 sm:gap-3` so the description text gets more breathing room.
  - `src/pages/Admin.tsx` `AdminPackageCommentsPanel` and `AdminPackageNotesPanel` modal headers: switched to `flex-col sm:flex-row` so the title + meta stack above the action row on mobile. The close `X` now lives next to the title on mobile and stays on the right on desktop. The toggle label "Show hidden or archived" shortens to "Show archived" on mobile, and the "Mark all read" pill gets `whitespace-nowrap` + `shrink-0` so it no longer wraps to two lines.
  - Files: `src/components/Header.tsx`, `src/pages/Admin.tsx`, `changelog.md`, `TASK.md`
  - Verification: `ReadLints` clean on both files.

- [x] Clean up convex-doctor findings to reach 100/100 (2026-04-17 09:45 UTC)
  - Errors fixed in `convex/apiKeys.ts` `countKeysAndGrants`: the two `perf/unbounded-collect` errors on the `apiKeys` active-count and `apiAccessGrants` collect became bounded `.take(10000)` calls, and the `perf/collect-then-filter` warning disappeared because the grants query now uses the existing `by_revoked` index with `.eq("revoked", false)` instead of filtering in JavaScript.
  - `arch/no-convex-error` resolved in `convex/securityScan.ts` `runSecurityScan` by switching the auth guard from `throw new Error(...)` to `throw new ConvexError(...)`, adding `ConvexError` to the existing `convex/values` import. This keeps the auth message visible in production instead of getting redacted to "Server Error".
  - Refactored five `arch/large-handler` warnings down to 0 by extracting helpers while preserving behavior: `computeDashboardStats` + `emptyDashboardStats` in `convex/dashboard.ts`; `scheduleSubmissionFollowups`, `formatLatestSecurityScan`, and `computeUnreadAdminReplySummary` in `convex/packages.ts`; and `buildProviderTasks` / `runProviderTasks` / `buildProviderResultsForStorage` / `saveScanError` / `executeScanAndSaveResult` in `convex/securityScan.ts`. All three error branches of `_runSecurityScan` now share the same writer, so stored error payloads are guaranteed identical.
  - Files: `convex/apiKeys.ts`, `convex/dashboard.ts`, `convex/packages.ts`, `convex/securityScan.ts`, `changelog.md`, `files.md`, `task.md`
  - Verification: `npx convex-doctor` → 100/100 with "No issues found across 23 files in 235ms". `npm run build` (Netlify build) passes in ~4.2s with no new errors. `ReadLints` clean on every edited file. `npx convex dev` is still picking up pushes without schema validation errors.

- [x] Polish Mark read button layout in Admin + Profile message panels (2026-04-17 09:10 UTC)
  - `AdminPackageCommentsPanel` in `src/pages/Admin.tsx`: moved the per-comment Mark read pill out of the top-right action cluster (which was wrapping when combined with Hide/Archive/Delete + the New badge) and onto its own row below the message content. Icon removed — the pill is just the word "Mark read" now.
  - `ViewNotesModal` in `src/pages/Profile.tsx`: merged the Mark read pill into the same action row as Hide/Archive/Delete (after Delete when both apply), so admin replies the current user can also manage only show one action row. `Check` icon removed.
  - Dropped the unused `Check` import from `src/pages/Admin.tsx`.
  - Files: `src/pages/Admin.tsx`, `src/pages/Profile.tsx`, `changelog.md`
  - Verification: `ReadLints` clean on both files; HMR picked up the updates.

- [x] Fix admin-side Mark read pill + bell-dropdown pagination scroll (2026-04-17 08:55 UTC)
  - Root cause 1 (Mark read pill): `AdminPackageCommentsPanel` in `src/pages/Admin.tsx` gated the pill on `comment.authorEmail !== userEmail`. When an admin uses their own `/profile` to test, the submitter email equals the admin email, so every message was treated as the admin's own (Hide/Archive/Delete only) and the Mark read pill never rendered, even though the bell dropdown correctly flagged those same messages as unread.
  - Fix 1: dropped the author-email check. The gate is now simply `comment.adminHasRead !== true`. Admin replies written from the admin panel already have `adminHasRead: true`, so they still never show the pill.
  - Root cause 2 (bell scroll): the scroll effect only depended on `hashTargetPackageId`. When the target package lived on page 2+ or under a different filter, the first pass fired with `hashTargetRef.current = null`, the pagination-jump effect then mutated `currentPage[activeFilter]`, but the scroll effect did not re-run so the now-mounted row never scrolled into view. After 2 seconds the highlight also cleared, racing the jump.
  - Fix 2: split the scroll into its own effect that also depends on `activeFilter` and `currentPage`, and extended the highlight fade-out from 2s to 4s so filter/page switches have time to render first.
  - Files: `src/pages/Admin.tsx`, `changelog.md`
  - Verification: `ReadLints` clean on `src/pages/Admin.tsx`; `npm run dev` HMR picked up the patch without errors.

- [x] Remove auto-mark-all-read-on-open so per-message Mark read button is actually visible (2026-04-17 08:35 UTC)
  - Root cause: `AdminPackageCommentsPanel`, `AdminPackageNotesPanel` (both in `src/pages/Admin.tsx`), and `ViewNotesModal` (in `src/pages/Profile.tsx`) each had a `useEffect` that called the bulk `markCommentsAsReadForAdmin` / `markNotesAsReadForAdmin` / `markPackageNotesAsRead` mutation as soon as the panel opened with any unread items. This flipped `adminHasRead` / `userHasRead` to `true` on every comment or note before the render could show the new per-message "Mark read" pill, so the admin and the submitter both saw zero buttons.
  - Fix: deleted the three auto-mark effects. The bulk "Mark all read" pill in each panel header still calls the same bulk mutations, and the per-message "Mark read" pills already call `markPackageCommentReadForAdmin` / `markPackageCommentReadForUser`. Marking messages read is now fully opt-in; the bell badge stays until the user or admin acts.
  - Files: `src/pages/Admin.tsx`, `src/pages/Profile.tsx`, `changelog.md`
  - Verification: `ReadLints` clean on both files.

- [x] Per-message Mark read buttons, universal ESC close, and pagination-aware hash navigation (2026-04-17 08:15 UTC)
  - PRD: `prds/admin-profile-messages-ux.md`
  - Backend: added `markPackageCommentReadForAdmin({ commentId })` (admin-only) and `markPackageCommentReadForUser({ commentId })` (owner-only via `userOwnsPackage`) in `convex/packages.ts`; both are idempotent early-returns when already read or the comment is missing.
  - Admin UI: `AdminPackageCommentsPanel` in `src/pages/Admin.tsx` now shows a per-comment "Mark read" pill and "New" badge on submitter messages where `adminHasRead !== true`. The existing bulk "Mark all read" pill is untouched.
  - User UI: `ViewNotesModal` in `src/pages/Profile.tsx` now shows a per-note "Mark read" pill on admin replies where `userHasRead === false`.
  - ESC close: added keyboard handlers to `ConfirmModal`, reward confirm, reward history, and test reward confirm modals in `src/pages/Admin.tsx`; added handlers to `RequestModal`, `ViewNotesModal`, `EditModal`, and `ApiUsageModal` in `src/pages/Profile.tsx`. In-flight sends/submits guard ESC on the reward and form modals.
  - Pagination jump: extended the `#pkg-<id>` hash effect in `AdminDashboard` (`src/pages/Admin.tsx`) to switch `activeFilter` (to `all`, `archived`, or `marked_for_deletion`) and update `currentPage[activeFilter]` when the target package is on a different page or excluded by the current filter, so the scroll + highlight effect always lands on the right row.
  - Files: `convex/packages.ts`, `src/pages/Admin.tsx`, `src/pages/Profile.tsx`, `files.md`, `changelog.md`, `prds/admin-profile-messages-ux.md`
  - Verification: `ReadLints` clean on all three edited source files; `npx tsc --noEmit -p tsconfig.app.json` reports only pre-existing errors in `CodeBlock.tsx`, `ComponentDetailsEditor.tsx`, `CategoryPage.tsx`, `Directory.tsx` (unrelated).

- [x] Remove leftover agent debug telemetry from thumbnail flow (2026-04-16 22:55 UTC)
  - Root cause: a prior debug session (`sessionId:"10e84f"`, runId `"pre-fix"`) left eight `fetch("http://127.0.0.1:7557/ingest/496d4f8a-92e4-4a9c-a7be-0c1a3758fbbe", ...)` calls bracketed by `// #region agent log` / `// #endregion` markers. The client-side copies were logging `net::ERR_CONNECTION_REFUSED` in DevTools on every editor mount and every Generate Thumbnail click, while the Convex copies were silently failing from the Node runtime on every admin thumbnail run.
  - Fix: deleted 4 blocks in `convex/thumbnailGenerator.ts` (inside `_generateThumbnailForPackage`) and 4 blocks in `src/components/ComponentDetailsEditor.tsx` (in the thumbnail sync `useEffect` and `handleGenerateThumbnail`). All calls were fire-and-forget with `.catch(()=>{})`, so removal changed no logic.
  - Files: `convex/thumbnailGenerator.ts`, `src/components/ComponentDetailsEditor.tsx`
  - Verification: `rg "127.0.0.1:7557"` → 0 matches, `rg "#region agent log"` → 0 matches, `rg "10e84f"` → 0 matches, `npm run build` passes in ~4.4s with no new errors. Pre-existing TypeScript diagnostics in both files (Buffer/Blob type mismatch, ReactMarkdown `Components` JSX namespace) are unrelated and left alone.

- [x] Make mobile search bar white on Directory and category pages (2026-04-17 05:21 UTC)
  - Added `inputClassName="bg-white border border-border"` to the mobile `SearchBar` on `src/pages/Directory.tsx` so it matches the desktop sidebar search instead of inheriting the cream `bg-bg-primary` default.
  - Applied the same change to the mobile `SearchBar` on `src/pages/CategoryPage.tsx` so category views behave the same way.
  - Reviewed mobile category pills; the existing `overflow-x-auto` horizontal scroll is the right pattern for the number of categories and was left unchanged.
  - Files: `src/pages/Directory.tsx`, `src/pages/CategoryPage.tsx`
  - Verification: `npm run build` passes.

- [x] Add preflight check usage warning modal on SubmitCheck page (2026-04-16 22:30 UTC)
  - Added `PreflightWarningModal` component in `src/pages/SubmitCheck.tsx` that confirms the 10 checks per hour per IP limit and 30-minute per-repo cache before the check runs.
  - Reused the existing `GenerateWarningModal` design language (amber `Warning` icon, Continue/Cancel buttons, ESC close, backdrop click close when idle).
  - Split `handleSubmit` into `handleOpenWarning` (validates and opens modal) and `runPreflightCheck` (fetches after confirmation); modal closes automatically in the request `finally` block.
  - Updated `files.md` SubmitCheck description to mention the new pre-check warning modal.
  - Verification: `ReadLints` clean on `src/pages/SubmitCheck.tsx`; `npm run build` passes.

- [x] Fix Directory sidebar category counts staying 0 after admin category edits (2026-04-16 21:45 UTC)
  - Root cause: `updateComponentDetails` in `convex/packages.ts` patched `category` / `convexVerified` without calling `recountCategoryStats(ctx)`, so the denormalized `packageCount` / `verifiedCount` on the `categories` table stayed stale.
  - `listCategories` (sidebar) reads those denormalized counters directly; `getCategoryBySlug` (category page) computes live, which is why the two disagreed.
  - Fix: call `recountCategoryStats(ctx)` at the end of `updateComponentDetails` whenever the patch touches `category` or `convexVerified`.
  - File: `convex/packages.ts`
  - Verification: `ReadLints` clean on `convex/packages.ts`; sidebar now matches the category page after an admin category change.

- [x] Refresh denormalized category counts on slug rename and category delete (2026-04-16 21:55 UTC)
  - `updateExistingCategory` now calls `recountCategoryStats(ctx)` after reassigning packages to the new slug.
  - `deleteCategory` now calls `recountCategoryStats(ctx)` after clearing `category` on related packages.
  - Tightened `updateExistingCategory` ctx type from `any` to `MutationCtx` for type safety.
  - File: `convex/packages.ts`
  - Verification: `ReadLints` clean on `convex/packages.ts`.

- [x] Fix package submission and dashboard download validator drift (2026-04-15 17:52 UTC)
  - PRD: `prds/package-download-validator-fix.md`
  - Added `allTimeDownloads` to the missing submit and npm update validators in `convex/packages.ts`, plus the existing-package patch and new-package insert paths.
  - Verified the current `convex/dashboard.ts` query still returns `totalAllTimeDownloads`.
  - Verification: `npm run build`, `ReadLints`, live Convex reload in the running `npx convex dev` session

- [x] Fix directory download sync after npm refreshes (2026-04-15 02:11 UTC)
  - PRD: `prds/dashboard-refresh-and-directory-download-sync.md`
  - Added focus, visibility, and page-show refetch hooks in `src/pages/Directory.tsx` so one-shot directory data picks up refreshed npm counts without restoring full live subscriptions.
  - Verification: `npm run build`

- [x] Add dashboard package refresh controls (2026-04-15 02:11 UTC)
  - PRD: `prds/dashboard-refresh-and-directory-download-sync.md`
  - Added a per-package refresh icon beside weekly downloads and a bulk `Refresh all` control beside CSV in `src/pages/Dashboard.tsx`, both reusing the existing safe admin refresh actions.
  - Verification: `npm run build`

## to do

- [x] Accurate weekly and all-time downloads across the app (2026-07-15 06:10 UTC)
  - Fixed `allTimeDownloads` accuracy (npm clamps point ranges to 18 months) via chunked 540-day windows summed from the package created date, with clamp detection.
  - Switched weekly count to npm's `last-week` alias endpoint. The prior explicit 7-day window ending today undercounted by up to 40% because npm data lags 1-2 days; `last-week` matches npmjs.com exactly.
  - Download fetch failures now return `undefined` instead of 0, so `_updateNpmDataAndTimestamp` skips those fields and stored values are never zeroed; partial failures are logged in `refreshError`.
  - Added `showWeeklyDownloads` / `showAllTimeDownloads` admin toggles (Downloads Display panel in Admin) with a lightweight public query `getDownloadsDisplaySettings`; Directory, CategoryPage, and ComponentDetail (sidebar + related cards) render weekly, all-time, or both per the toggles.
  - Added a sortable All Time column to the Dashboard per-package table (dash for missing values); download formatters gained a `B` tier.
  - Backfill run on dev: 48/48 packages refreshed. Verified against npm: `@convex-dev/agent` weekly 86,832 and all-time 1,472,612 exact match; `@turf/convex` all-time 145,810,278 matched an independent yearly-window sum. Zero refresh errors after retrying 14 rate-limited packages.
  - First-publish-date audit (2026-07-15 06:00 UTC): confirmed all-time counts start at each package's npm `time.created` and never earlier. Independently recomputed six packages with 2016 through 2025 first publishes (rate-limiter, agent, workpool, presence, resend, @turf/convex); all stored values matched exactly, zero `refreshError` across all 49 packages.
  - Follow-up fix (2026-07-15 06:15 UTC): Featured cards on Directory were missing all-time downloads because the `getFeaturedComponents` mapper omitted `allTimeDownloads`; added the field and verified in the browser that all rendered cards show the total.
  - Follow-up change (2026-07-15 06:20 UTC): Most downloads sort in `sortPackages` now ranks by `allTimeDownloads` (weekly fallback for unrefreshed new submissions, weekly tie-break) regardless of display toggles; covers Directory and category pages via the shared `listApprovedComponents`. Verified order flip on dev: Expo Push Notifications above WorkOS AuthKit.
  - PRD: `prds/downloads-display-and-alltime-accuracy.md`
  - Files: `convex/packages.ts`, `convex/dashboard.ts`, `src/components/ComponentCard.tsx`, `src/pages/Directory.tsx`, `src/pages/CategoryPage.tsx`, `src/pages/ComponentDetail.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Admin.tsx`

- [ ] Component pages: HTTP one-shot load so Googlebot can render content (2026-06-09 10:38 UTC)
  - Problem: `convex.dev/components/*` stuck at "Discovered - currently not indexed". GSC Live Test showed an empty render; console showed the Convex websocket stuck `connecting` with `ModifyQuerySet` messages never sent, so content never loads for Googlebot.
  - Fix: load initial component data over HTTP via `ConvexHttpClient` (same `/api/query` the edge function uses), keep the live `useQuery` for reactivity. Frontend-only, no Convex deploy.
  - PRD: `prds/component-http-fallback.md`
  - Files: `src/lib/convexHttp.ts` (new), `src/pages/ComponentDetail.tsx`
  - Validation: GSC URL Inspection Live Test (rendered HTML + screenshot populated), Request Indexing, confirm live features still work.

- [x] Mirror all comment/note writes to Slack (2026-04-18)
  - `addPackageComment`: removed `if (!isAdmin)` gate, Slack now fires for both admin and submitter with role-based `From:` label
  - `requestSubmissionRefresh`: added Slack notification after `packageComments` insert (`From: Submitter`)
  - `addPackageNote`: added Slack notification with branching first line for internal notes vs legacy `[User Request]` admin replies
  - File changed: `convex/packages.ts`

- [x] Add admin message notifications bell with dropdown and mark-all-read buttons (2026-04-17 06:17 UTC)
  - Added two new Convex public queries in `convex/packages.ts`: `getMyUnreadAdminRepliesByPackage` (user feed) and `getAdminUnreadMessagesByPackage` (admin-only feed, capped at 50 packages). Both return minimal metadata (`packageId`, `packageName`, `slug`, `unreadCount`, `lastMessageAt`) and reuse the existing `by_submitter_email` / `by_package_and_created` index patterns from `getTotalUnreadAdminReplies`. No schema changes.
  - Added Phosphor `Bell` (color `#E05C35`) in `src/components/Header.tsx` immediately right of the Submit link and in the mobile header row. Only rendered for authenticated users. Clicking opens a dropdown card with two sections: "Messages from Convex Team" and, for admins only, "Incoming messages". Total unread count appears as a round pill badge. Outside-click closes the dropdown.
  - Item clicks navigate to `/components/profile#pkg-<id>` (user) or `/components/submissions/admin#pkg-<id>` (admin).
  - `src/pages/Profile.tsx`: added `id="pkg-<packageId>"` to each `SubmissionCard`, plus a hash-driven `scrollIntoView` + two-second ring-highlight effect. Upgraded the existing "Mark all read" text link in `ViewNotesModal` to a visible pill button.
  - `src/pages/Admin.tsx`: added `id="pkg-<packageId>"` to each package row and a hash-driven effect that auto-adds the targeted id to `expandedPackages`, scrolls it into view, and applies a two-second `#E05C35` ring highlight. Upgraded the "Mark all read" link in `AdminPackageCommentsPanel` to a pill button. Wired `AdminPackageNotesPanel` with `getUnreadUserNotesCount` + `markNotesAsReadForAdmin` so it now shows an unread badge, auto-marks on open, and exposes a visible "Mark all read" pill button.
  - Files: `convex/packages.ts`, `src/components/Header.tsx`, `src/pages/Profile.tsx`, `src/pages/Admin.tsx`, `prds/admin-message-notifications-bell.md`
  - Verification: `npx tsc --noEmit -p convex/tsconfig.json` passes; `npx tsc --noEmit -p tsconfig.app.json` reports no new errors in the edited files (only pre-existing CodeBlock / ComponentDetailsEditor / CategoryPage / Directory issues remain).

- [x] Add spacing above Keywords section on ComponentDetail when code is present (2026-04-14 13:35 UTC)
  - Added `mt-8` to the Keywords container div so it has visual separation from code blocks or markdown content above
  - File: `src/pages/ComponentDetail.tsx`

- [x] Fix crons component page crash on production (2026-04-14 13:15 UTC)
  - Added `PageErrorBoundary` in `src/main.tsx` wrapping `ComponentDetail` route to catch useQuery and rendering errors
  - Added `MarkdownErrorBoundary` in `src/pages/ComponentDetail.tsx` around all `ReactMarkdown` sections
  - Refactored `CodeBlock.tsx` to render plain text code blocks as simple `<pre>` instead of PierreFile highlighter (prevents hangs on Unicode box-drawing ASCII art)
  - Removed localhost-only debug instrumentation from previous session
  - Files: `src/main.tsx`, `src/pages/ComponentDetail.tsx`, `src/components/CodeBlock.tsx`

- [x] Dashboard improvements: remove Pre-Oct 2025 card, add all-time downloads, add CSV/PDF export (2026-04-14 00:30 UTC)
  - Removed Pre-Oct 2025 stat card from `convex/dashboard.ts` and `src/pages/Dashboard.tsx`
  - Added `allTimeDownloads` optional field to packages schema, fetched from npm API during refresh
  - Added "All Time Downloads" stat card alongside existing "Weekly Downloads" card
  - Added CSV and PDF export buttons to the Components table header, exports the current filtered view
  - Updated `fetchNpmPackageHandler` to fetch cumulative downloads from npm date-range API
  - Updated `_updateNpmDataAndTimestamp`, `adminPackageValidator`, `toAdminPackage` to include `allTimeDownloads`
  - Files: `convex/schema.ts`, `convex/dashboard.ts`, `convex/packages.ts`, `src/pages/Dashboard.tsx`

- [x] Fix security report modal stacking with createPortal (2026-04-13)
  - Wrapped `SecurityReportModal` and `SubmitSecurityReportModal` in `createPortal(..., document.body)`
  - Sticky sidebar created a local stacking context causing main content to overlap the modal
  - Added `import { createPortal } from "react-dom"` to both files
  - Ref: [PR #22](https://github.com/get-convex/components-submissions-directory/pull/22)
  - Files: `src/pages/ComponentDetail.tsx`, `src/pages/Submit.tsx`

- [x] Rename Security Analyze to Community scan via Socket and add takedown FAQ (2026-04-13 23:30 UTC)
  - Removed shield icon and scan date from public security modals in `ComponentDetail.tsx` and `Submit.tsx`
  - Changed modal title to "Community scan via Socket" (attributed to Socket, not Convex)
  - Added takedown, removal, and review flow FAQ items to `FAQSection.tsx` with contact Convex
  - Updated `submit.md`, `component-detail.md`, `admin-security-scan.md`, `index.md` documentation
  - Removed FAQ from Submit.tsx AboutModal (was added by mistake)
  - Files: `src/pages/ComponentDetail.tsx`, `src/pages/Submit.tsx`, `src/components/FAQSection.tsx`, `src/docs/submit.md`, `src/docs/component-detail.md`, `src/docs/admin-security-scan.md`, `src/docs/index.md`

- [x] Add community approved/rejected stats and review status filter to dashboard (2026-04-13 22:15 UTC)
  - Added "Community Approved" and "Community Rejected" stat cards to Dashboard
  - Added "Status" dropdown filter (All / Approved / Not approved / Pending / In review / Changes requested / Rejected)
  - Status filter integrates with existing type, date, and author filters and clears with the Clear button
  - Updated `component-report.html` with community approval/rejection counts, status badges, and a filter/sort dropdown
  - Files: `src/pages/Dashboard.tsx`, `component-report.html`

- [x] Add admin analytics dashboard (2026-04-13 21:00 UTC)
  - Created `convex/dashboard.ts` with `getDashboardStats` admin-gated query (aggregated counts, download sums, per-author breakdown, monthly timeline)
  - Created `src/pages/Dashboard.tsx` with stat cards, filterable components table, author summary, monthly timeline, filters/sorting, refresh
  - Added `/dashboard` route in `src/main.tsx`
  - Added Dashboard nav link (with ChartBar icon) in `src/components/Header.tsx` for admin users (desktop + mobile)
  - UI matches app design system: `bg-bg-primary` background, white cards/tables
  - Refresh button wired to `triggerManualRefreshAll` action to pull live npm data
  - Custom date range picker (From/To date inputs) alongside preset date filters
  - Author filter changed to multi-select exclusion checklist (hide/show individual authors, bulk show all / hide all)
  - Removed investor references from dashboard copy
  - Info banner about live data and post-deploy refresh
  - Files: `convex/dashboard.ts` (new), `src/pages/Dashboard.tsx` (new), `src/main.tsx`, `src/components/Header.tsx`, `files.md`, `changelog.md`

- [x] Remove status labels from public Security Analyze modals (2026-04-04 00:30 UTC)
  - Removed "Status: Safe as of..." / "Alerts" / "Not scanned" line from both public modals
  - Now shows only "Not yet scanned" or "Scanned [date]" with no safe/warning/unsafe wording
  - Admin reports unchanged
  - Files changed: `src/pages/ComponentDetail.tsx`, `src/pages/Submit.tsx`

- [x] Fix infinite re-render loop on Admin API tab (2026-04-03 14:10 UTC)
  - Root cause: `Date.now()` called directly in render body caused Convex `useQuery` to re-subscribe on every render
  - Stabilized `now` arg with `useMemo` rounded to nearest minute
  - Fixed `countKeysAndGrants` to use `by_status` index instead of `.take(1000)` + JS `.filter()`
  - Files changed: `src/pages/Admin.tsx`, `convex/apiKeys.ts`

- [x] Slack notification on new component submission (2026-04-02 12:00 UTC)
  - `internal.slack.sendMessage` in `convex/slack.ts`; `submitPackage` schedules after `_addPackage`; env `SLACK_WEBHOOK_URL`
  - Files: `convex/slack.ts`, `convex/packages.ts`, `convex/_generated/api.d.ts`, `prds/slack-submission-notifications.md`, `changelog.md`, `files.md`

- [x] Fix listAllDirectoryCategories return validator missing optional fields (2026-04-02 08:00 UTC)
  - Production crash: categories with `packageCount`/`verifiedCount` fields failed the strict return validator
  - Added `packageCount: v.optional(v.number())` and `verifiedCount: v.optional(v.number())` to match schema
  - File changed: `convex/packages.ts`

- [x] Add security scanning documentation to src/docs (2026-04-02 07:30 UTC)
  - Created `src/docs/admin-security-scan.md` with full coverage of providers, scanning modes, settings, results, public visibility, env vars, data model, and troubleshooting
  - Registered in `src/pages/Documentation.tsx` with import and docs array entry
  - Updated `src/docs/index.md`, `admin-settings.md`, `admin-dashboard.md`, `admin-review.md`, `component-detail.md`, and `submit.md` with security scan references
  - Files changed: `src/docs/admin-security-scan.md` (new), `src/pages/Documentation.tsx`, `src/docs/index.md`, `src/docs/admin-settings.md`, `src/docs/admin-dashboard.md`, `src/docs/admin-review.md`, `src/docs/component-detail.md`, `src/docs/submit.md`

- [x] Move "How to get help" above Security Analyze in ComponentDetail.tsx sidebar (2026-04-02 06:00 UTC)
  - Swapped sidebar order so "How to get help" renders before the security scan box
  - Removed scan date subtitle from all SecurityScanBox states (not_scanned, scanning, scanned)
  - Simplified to a single-line clickable "Security Analyze" label
  - Files changed: `src/pages/ComponentDetail.tsx`

- [x] Add configurable batch size to security scan backlog (2026-04-02 05:45 UTC)
  - Replaced hardcoded batch size of 20 with a dropdown selector (5, 10, 20, 50, 100)
  - Files changed: `src/pages/Admin.tsx`

- [x] Fix duplicate ExternalLinkIcon declaration in Submit.tsx (2026-04-02 05:30 UTC)
  - Removed duplicate `ExternalLinkIcon` import from `@radix-ui/react-icons`, used existing `RadixExternalLinkIcon` alias
  - Files changed: `src/pages/Submit.tsx`

- [x] Fix TypeScript error in runSecurityScanBacklog filter (2026-04-02 05:25 UTC)
  - Removed redundant `!== "scanning"` check that TS flagged as unreachable after prior conditions
  - Files changed: `convex/packages.ts`

- [x] Add Security Analyze button and modal on Submit.tsx next to Demo (2026-04-02 05:15 UTC)
  - Added `Shield` icon import and `SubmitSecurityReportModal` + `SecurityAnalyzeButton` components to Submit.tsx
  - Button appears in expanded action row for every package, loads scan data via `getLatestSecurityScan`
  - Modal matches ComponentDetail.tsx style: providers, recommendations, contact author, third party notice
  - Files changed: `src/pages/Submit.tsx`

- [x] Add security scan backlog queue and tracker in Admin settings (2026-04-02 05:15 UTC)
  - Added `getSecurityScanBacklogStats` query to `convex/packages.ts` with badge-style counts
  - Added `runSecurityScanBacklog` mutation that queues unscanned/errored packages
  - Added backlog section to `SecurityScanSettingsPanel` in Admin.tsx with configurable batch size and progress badges
  - Files changed: `convex/packages.ts`, `src/pages/Admin.tsx`

- [x] Remove Devin AI integration from security scan UI and orchestrator (2026-04-02 04:15 UTC)
  - Removed Devin toggle from Admin.tsx settings, provider badge from review history, and tooltip text
  - Removed Devin provider names/URLs from ComponentDetail.tsx security report modal
  - Removed Devin task from securityScan.ts orchestrator and result saving
  - Hardcoded `enableDevinScan: false` in packages.ts, removed from scheduled scan provider check
  - Schema fields kept for backward compat with existing scan runs
  - Socket.dev and Snyk unaffected, typecheck and lint clean

- [x] Fix Devin v3 session request shape after `session_links` validation error (2026-04-02 01:30 UTC)
  - Confirmed Convex now uses a v3 style `cog_` Devin key instead of the legacy `apk_` key family
  - Root cause: `convex/securityScan.ts` was sending `advanced_mode: "analyze"` on session creation, but Devin requires `session_links` for analyze mode and returns `422`
  - Removed the invalid `advanced_mode` field, typechecked with `npx tsc --noEmit`, and verified direct v3 session creation now gets past validation
  - Current external blocker is Devin org billing: `403 {"detail":"Your organization has a billing error. Error: renew_subscription"}`
  - Files changed: `convex/securityScan.ts`

- [x] Fix Devin security scan auth messaging and public security modal behavior (2026-04-02 01:13 UTC)
  - Confirmed direct Devin v3 session creation returns `403 Unauthorized` with current Convex env vars on `convex-elevenlabs`
  - Current `DEVIN_API_KEY` in Convex uses the legacy `apk_` key family, so `convex/securityScan.ts` now returns a clear action message for legacy Devin keys and preserves provider error text in stored scan summaries
  - Updated `src/pages/ComponentDetail.tsx` to lock document scroll while the security modal is open, raise the modal stacking order, and hide the findings list from the public modal
  - Re-ran the `convex-elevenlabs` scan, verified Devin still shows `error` until the key is replaced, and verified `npx tsc --noEmit` plus `ReadLints`
  - PRD: `prds/security-scan-devin-modal-followup.md`

- [x] Fix Socket.dev security scan endpoint and response parsing (2026-04-01 22:05 UTC)
  - Root cause: `convex/securityScan.ts` was calling `https://api.socket.dev/v0/report/supported`, which returns `404 API route not found`
  - Switched Socket lookup to `https://api.socket.dev/v0/purl?alerts=true&compact=true`
  - Updated parsing to handle Socket's `application/x-ndjson` response and treat empty successful responses as no alerts instead of a scan failure
  - Verified by rerunning the `@convex-dev/stripe` scan and confirming `socket` now stores `safe` in Convex
  - Files changed: `convex/securityScan.ts`

- [x] Fix search scroll and navigation scroll-to-top bugs (2026-03-28 20:00 UTC)
  - Added `window.scrollTo({ top: 0, behavior: "smooth" })` in Directory.tsx and CategoryPage.tsx when search term changes
  - Set `history.scrollRestoration = "manual"` and `window.scrollTo(0, 0)` in main.tsx to prevent browser restoring old scroll positions on full-page navigation
  - Files changed: `src/main.tsx`, `src/pages/Directory.tsx`, `src/pages/CategoryPage.tsx`

Session updates complete on 2026-03-27 01:00 UTC.

- [x] Remove 20k character cap on stored README content (2026-03-27 01:00 UTC)
  - Removed `.slice(0, 20000)` from both save paths in `convex/seoContent.ts`
  - Full README now stored without any character limit
  - Files changed: `convex/seoContent.ts`

- [x] Fix README not showing on components without AI content (2026-03-27 00:45 UTC)
  - Moved `readmeIncludedMarkdown` rendering outside v2 content gate in `src/pages/ComponentDetail.tsx`
  - README now displays independently of `contentModelVersion === 2 && generatedDescription`
  - Files changed: `src/pages/ComponentDetail.tsx`

- [x] Add admin Update README action button (2026-03-27 00:15 UTC)
  - Added `refreshReadme` internal action and `refreshReadmeContent` public action in `convex/seoContent.ts`
  - Added `_updateReadmeOnly` internal mutation in `convex/seoContentDb.ts`
  - Added Update README button in admin Actions row next to Generate Content in `src/pages/Admin.tsx`
  - Fetches and stores latest README from GitHub without regenerating AI content
  - Files changed: `convex/seoContent.ts`, `convex/seoContentDb.ts`, `src/pages/Admin.tsx`

- [x] Fix README truncation on component detail pages (2026-03-26 22:00 UTC)
  - Split `sanitizeReadmeForPrompt` into `sanitizeReadme` (no truncation) and `sanitizeReadmeForPrompt` (12k truncation for AI prompts only) in `convex/seoContent.ts`
  - Added `fullContent` field to `GitHubReadmeResult` type so `fetchGitHubReadme` returns both truncated and full sanitized README
  - Updated `fetchContentContext` and `fetchPreviewContext` to use `fullContent` for `readmeIncludedMarkdown` extraction
  - AI prompts still receive truncated content; stored and displayed README is now the full version
  - Existing packages need content regeneration to populate full README
  - Files changed: `convex/seoContent.ts`

- [x] Scale optimization: bandwidth and subscription reduction (2026-03-21 00:30 UTC)
  - PRD at `prds/scale-optimization.md`
  - Added compound indexes: `by_reviewStatus_and_visibility_and_markedForDeletion`, `by_featured_and_reviewStatus`, `by_enabled_and_sortOrder`, `by_status` (apiKeys), `by_revoked` (apiAccessGrants)
  - Swapped Directory.tsx and CategoryPage.tsx from reactive `useQuery` to one-shot `convex.query()` fetches
  - Added change detection in `updateNpmDataHelper` to skip no-op patches
  - Denormalized category counts into `categories` table (`packageCount`, `verifiedCount` fields)
  - `listCategories` now reads only the categories table (no package scan)
  - REST API `/api/components/search` now uses Convex search indexes instead of loading all packages
  - Added `_searchApprovedPackages` internal query and `backfillCategoryCounts` internal mutation
  - Source: [https://stack.convex.dev/optimizing-openclaw](https://stack.convex.dev/optimizing-openclaw)
  - Files changed: `convex/schema.ts`, `convex/packages.ts`, `convex/http.ts`, `src/pages/Directory.tsx`, `src/pages/CategoryPage.tsx`

- [ ] Debug and fix admin thumbnail generation from `ComponentDetailsEditor.tsx` (2026-03-19 01:05 UTC)
  - Investigate the runtime failure with logs first
  - PRD at `prds/thumbnail-generation-debug.md`

- [x] Achieve convex-doctor perfect score 100/100 with zero issues (2026-03-21 06:10 UTC)
  - PRD at `prds/convex-doctor-perfect-score.md`
  - Extracted 40+ helper functions from 19 large handlers across 7 files
  - Refactored `packages.ts`: triggerManualRefreshAll, listApprovedComponents, getRelatedComponents, getMySubmissions, scheduledDeletionCleanup, updateMySubmission, updateComponentDetails, upsertCategory, refreshGitHubIssueCounts
  - Refactored `seoContent.ts`: generateSeoContent, generateDirectoryContent, previewDirectoryContent
  - Refactored `seoContentDb.ts`: migrateToContentModel
  - Refactored `thumbnailGenerator.ts`: _generateThumbnailForPackage, _autoGenerateThumbnail, _autoGenerateThumbnailWithTemplate
  - Refactored `seed.ts`: _upsertOfficialComponent, seedOfficialComponents
  - Refactored `paymentsDb.ts`: backfillRewardStatusFromPayments
  - Refactored `apiKeys.ts`: generateApiKey, getApiAnalytics (from prior session)
  - Added strategic suppressions in `convex-doctor.toml` for intentional design patterns
  - All TypeScript checks and Netlify build pass with no regressions
  - Files changed: `convex/packages.ts`, `convex/seoContent.ts`, `convex/seoContentDb.ts`, `convex/thumbnailGenerator.ts`, `convex/seed.ts`, `convex/paymentsDb.ts`, `convex/apiKeys.ts`, `convex-doctor.toml`

- [x] Fix duplicate package submission error showing generic "Server Error Called by client" (2026-03-21 00:15 UTC)
  - Backend: rewrote ConvexError message to include the npm package name and actionable next steps
  - Frontend: added ConvexError import and extraction in both submit and generate content catch blocks
  - Files changed: `convex/packages.ts`, `src/pages/SubmitForm.tsx`

- [x] Improve convex-doctor score from 39/100 to 80+ (2026-03-20 22:30 UTC)
  - PRD at `prds/convex-doctor-score.md`
  - Fixed unwaited promises in `http.ts` and `apiKeys.ts`
  - Replaced `api.*` with `internal.*` in server-to-server calls across 4 files
  - Replaced `throw new Error` with `throw new ConvexError` across 12 convex files
  - Fixed `Date.now()` and `new Date()` in query functions across 4 files
  - Added `.take(n)` bounds to ~40 unbounded `.collect()` calls
  - Replaced `.filter()` with `.withIndex()` in 7 query locations
  - Added return validators to 10 functions missing them
  - Removed redundant `by_category` index (prefix of `by_category_and_visibility`)
  - Added `by_isDefault` index to `aiPromptVersions` and `seoPromptVersions`
  - Added `by_tokenIdentifier_and_status` compound index to `apiKeys`
  - Added CORS OPTIONS handlers for 7 HTTP routes
  - Batched `runAiReview` mutations (reduced ctx.run* from 13 to 8)
  - Created `convex.json` and `convex-doctor.toml` configuration files

- [x] Fix deployed `/components/components.md` route so it returns markdown instead of SPA HTML (2026-03-18 02:10 UTC)
  - Root cause: `og-meta.ts` intercepts `/components/*` before redirects, and redirects do not fire after edge functions call `context.next()`
  - `llms.txt` already had a direct proxy branch in `og-meta.ts`, but `/components/components.md` did not
  - Fixed by proxying `/components/components.md` directly to Convex `/api/markdown-index` from `og-meta.ts`
  - Verified `npm run build` still passes after the routing change and docs were synced
  - PRD at `prds/components-components-md-route-fix.md`

- [x] Upgrade Documentation viewer to use Pierre Diffs for code blocks (2026-03-18 02:00 UTC)
  - Added `rehype-raw` import and plugin to `Documentation.tsx` for inline HTML support
  - Added `CodeBlock` import and wired fenced code blocks through Pierre Diffs (`@pierre/diffs`) with syntax highlighting, line numbers, and copy button
  - Changed `<pre>` component to passthrough so Pierre Diffs handles full rendering
  - Added `thead`, `th`, `td`, `tr` components matching ComponentDetail table styling
  - Added video URL detection for `.mp4`, `.webm`, `.mov` in image tags
  - Updated `updating-docs.md` to document the Pierre Diffs rendering pipeline
  - Updated `files.md` Documentation.tsx description to reflect Pierre Diffs usage

- [x] Update API Usage Modal to use /components/components.md path (2026-03-18 00:45 UTC)
  - Changed href and display text from `/components.md` to `/components/components.md` in the ApiUsageModal on Profile page

- [x] Add contact email to profile help text (2026-03-18 00:40 UTC)
  - Added "devx at convex . dev" contact info to the account removal help text on Profile page

- [x] Add admin API access controls with global toggle, per-user grants, and analytics dashboard (2026-03-18 00:30 UTC)
  - Added `apiAccessGrants` table to schema for email-based admin grants
  - Added `apiAccessEnabled` to admin settings (defaults to off)
  - Created admin mutations: `grantApiAccess`, `revokeApiAccess`, `searchSubmitters`, `listApiAccessGrants`, `getApiAnalytics`
  - Added `getMyApiAccessStatus` public query for profile page gating
  - Gated REST API endpoints behind global toggle (returns 503 when off)
  - Gated `generateApiKey` behind both global toggle and per-user grant
  - Added "API" tab to Admin page with global toggle, user search/grant, and analytics dashboard
  - Gated Profile page API Access section behind global + per-user flags
  - Added "For Agents" section below FAQ on Directory page linking to llms.txt and components.md
  - PRD at `prds/admin-api-controls.md`

- [x] Fix /components.md 404 and add /components/components.md alias (2026-03-17 23:30 UTC)
  - Root cause: Netlify redirect for `/components.md` was missing `force = true`, so the proxy to Convex never fired
  - Added `force = true` to the `/components.md` redirect
  - Added `/components/components.md` as a second path that points to the same Convex endpoint
  - Both `llms.txt` and `.md` endpoints query `_listApprovedPackages` live on each request, no cron needed

- [x] Build REST API with per-user API keys for Components Directory (2026-03-17 23:00 UTC)
  - Added `apiKeys` table to schema with `keyHash`, `keyPrefix`, `tokenIdentifier`, `status` fields
  - Extended `mcpApiLogs` with `apiKeyId` and `hashedIp` for per-key and per-IP tracking
  - Created `convex/apiKeys.ts` with `generateApiKey`, `revokeApiKey`, `getMyApiKey` public functions and internal validation/rate-limit helpers
  - Built `resolveApiCaller` auth middleware with two-tier rate limiting (100 req/min authenticated, 10 req/min anonymous)
  - Replaced disabled MCP routes in `convex/http.ts` with live REST endpoints at `/api/components/search`, `/detail`, `/install`, `/docs`, `/categories`, `/info`
  - Added Netlify proxy redirect for `/api/components/*`
  - Added API Access section to Profile page with key generation, display, and revocation
  - Built API Usage Guide modal with endpoint docs, curl examples, rate limit info, and content endpoint links
  - PRD at `prds/rest-api-keys.md`

- [x] fix raw HTML tags rendering as text in README markdown on ComponentDetail page (2026-03-17 22:15 UTC)
  - Installed `rehype-raw` package to allow `react-markdown` to parse and render inline HTML from GitHub READMEs
  - Added `rehypePlugins={[rehypeRaw]}` to all 4 `ReactMarkdown` instances in `src/pages/ComponentDetail.tsx` (Use Cases, How it Works, From the README, and v1 long description)
  - Fixes `<div align="center">`, `<strong>`, `<img>` and other HTML tags that were showing as literal text
  - Verified with `npx vite build`

- [x] make README preview source toggle open by default on SubmitForm and ProfileEditSubmission (2026-03-17 21:00 UTC)
  - Changed `ReadmePreviewNotice` default state from closed to open (`useState(true)` and `open` attribute on `<details>`)
  - Affects both `SubmitForm.tsx` and `ProfileEditSubmission.tsx` since they share the same component

- [x] remove broken "View markdown source" option from Markdown dropdown on ComponentDetail page (2026-03-17 20:15 UTC)
  - Removed the toggle button from the dropdown menu in `src/pages/ComponentDetail.tsx`
  - Removed the associated markdown source view panel (pre block with raw markdown)
  - Cleaned up unused `showMarkdown` state, `mdCopied` state, `handleCopyMdInline` function, and `EyeOpenIcon` import
  - Remaining dropdown options (Open markdown file, Copy as Markdown, Copy page URL, Open in ChatGPT/Claude/Perplexity) are unchanged

- [x] hide "Add badge to your README" section on ComponentDetail page while keeping it on Profile, Submit, and other pages (2026-03-17 19:30 UTC)
  - Removed badge markdown snippet, copy button, and preview image from `src/pages/ComponentDetail.tsx`
  - Kept the standalone `View llms.txt` link visible on the detail page
  - Badge section remains unchanged on `src/pages/Profile.tsx`, `src/pages/Submit.tsx`, and other surfaces

- [x] fix SKILL.md (Download Skill) not generated during submit, profile edit, or content model migration (2026-03-17 18:45 UTC)
  - Extracted `buildSkillMdFromContent` to `shared/buildSkillMd.ts` so it can be imported by both "use node" action files and mutation files
  - `submitPackage` in `convex/packages.ts` now builds `skillMd` when v2 content fields are present at submission time
  - `updateMySubmission` in `convex/packages.ts` now rebuilds `skillMd` when v2 content is saved via profile edit
  - `migrateToContentModel` in `convex/seoContentDb.ts` now backfills `skillMd` for packages that have v2 content but no skill file
  - `updateGeneratedContent` (admin edit) in `convex/seoContentDb.ts` now auto-rebuilds `skillMd` when content fields change
  - `_addPackage` accepts optional `skillMd` arg and saves it on insert
  - Verified with `npm run build` and `npx convex typecheck`

- [x] refactor detail page markdown rendering to use unified markdown-body CSS class (2026-03-17 17:53 UTC)
  - Added `.markdown-body` class in `src/index.css` with GitHub-style heading hierarchy (h1/h2 with bottom borders, proper size progression), nested list bullet types, inline code, blockquote, GFM table, and task list checkbox styles
  - Replaced 4 duplicated inline Tailwind `[&_*]` overrides in `src/pages/ComponentDetail.tsx` with single `markdown-body` wrapper
  - Fixed broken heading hierarchy where v1 long description forced h1/h2 to tiny uppercase text
  - Simplified `src/components/markdownComponents.tsx` by removing heading/paragraph/list overrides (handled by CSS) and adding shared img component with video detection
  - Verified with `npm run build`
- [x] add side-by-side editor and preview layout to ProfileEditSubmission content section (2026-03-17 15:25 UTC)
  - Description, Use Cases, and How it Works sections now render as two-column grid on desktop (editor left, preview right) and stack on mobile
  - Added live markdown preview to Description (previously had none)
  - Preview panes scroll independently with min/max height constraints
  - README preview stays full-width since it is read-only
- [x] make Package, Repo, and npm values clickable links in ProfileEditSubmission info box (2026-03-17 15:28 UTC)
  - Package links to the component detail page
  - Repo and npm open in new tabs with `target="_blank"`

- [x] unify admin, submit, and profile content generation to use the same v2 prompt and flow (2026-03-17 06:44 UTC)
  - Admin action bar "Regenerate SEO + Skill" button now calls `regenerateDirectoryContent` (v2) instead of `regenerateSeoContent` (v1), renamed to "Generate Content"
  - `buildContentPrompt` in `convex/seoContent.ts` now accepts an optional `customTemplate` parameter so admin custom prompts apply to all three surfaces
  - Both `generateDirectoryContent` and `previewDirectoryContent` now load the admin custom prompt via `_getSeoActivePromptContent`
  - Admin prompt settings panel renamed from "SEO + SKILL.md Prompt" to "Component Directory Content Prompt" with updated description and v2 placeholders
  - Default prompt in `convex/aiSettings.ts` switched from `DEFAULT_SEO_PROMPT_TEMPLATE` to `DEFAULT_CONTENT_PROMPT_TEMPLATE`
  - Verified with `npm run build` and `npx convex typecheck`

- [x] change user rate limit from 1/hour to 5/hour, admin stays exempt (2026-03-17 06:44 UTC)
  - Updated `MAX_CONTENT_GENERATIONS_PER_WINDOW` from 1 to 5 in `convex/contentGenerationLimits.ts`
  - Warning modal text in `src/pages/SubmitForm.tsx` and `src/pages/ProfileEditSubmission.tsx` updated to say "5 times per hour"
  - Admin remains exempt since it uses internal action scheduling

- [x] add GitHub-style markdown rendering with table support and vertical rhythm (2026-03-17 06:26 UTC)
  - Created shared `src/components/markdownComponents.tsx` with component overrides for code blocks, tables, headings, lists, blockquotes, and horizontal rules
  - All `ReactMarkdown` instances in `src/pages/SubmitForm.tsx`, `src/pages/ProfileEditSubmission.tsx`, and `src/pages/ComponentDetail.tsx` now use the shared components
  - Tables render with borders, header backgrounds, cell padding, alternating row shading, and horizontal scroll
  - Headings get proper top margin (`mt-6` for h1/h2, `mt-4` for h3, `mt-3` for h4) so README sections do not collide
  - Removed duplicate inline code/pre component definitions from all three pages
  - Verified with `npm run build`

- [x] add "From the README.md" heading and hr separator on detail page (2026-03-17 06:15 UTC)
  - Added `<hr>` and `<h3>From the README.md</h3>` above the README markdown section in `src/pages/ComponentDetail.tsx`
  - Also added the heading to the `buildComponentMarkdown` export so llms.txt output stays consistent
  - Removed extra wrapper div that was left from the old `border-t` approach
  - Verified with `npm run build`

- [x] add pulsing AI loading indicator to all generation surfaces (2026-03-17 06:08 UTC)
  - Created shared `src/components/AiLoadingDots.tsx` using Phosphor `DotsNine` with `animate-pulse` and "AI is working" label
  - Swapped into `src/pages/SubmitForm.tsx` generate button and warning modal confirm button
  - Swapped into `src/pages/ProfileEditSubmission.tsx` generate button and warning modal confirm button
  - Swapped into `src/pages/Admin.tsx` Regenerate SEO + Skill button and content migration Generate button and status text
  - Verified with `npm run build`

- [x] fix stored README markdown containing prompt prefix text (2026-03-17 06:04 UTC)
  - `fetchGitHubReadme` in `convex/seoContent.ts` now returns both `content` (prefixed, for the AI prompt) and `rawContent` (clean, for storage)
  - Both `extractReadmeIncludeBlock` call sites now use `rawContent` so saved `readmeIncludedMarkdown` no longer starts with "From the README.md"
  - Existing records will be clean after next regeneration
  - Verified with Convex typecheck

- [x] fix React hooks order error in ProfileEditSubmission (2026-03-17 06:00 UTC)
  - Moved `canGenerate` and `handleOpenGenerateWarning` above all early returns so hooks run unconditionally
  - `canGenerate` now guards against null `submission` since it runs before the loading/null checks
  - Admin SEO actions confirmed exempt from the rate limit since they use separate internal action paths
  - Verified with TypeScript check

- [x] add content generation cooldown and warning modal to submit and profile edit (2026-03-17 05:53 UTC)
  - Added a backend `once per hour per signed-in account` limit for the generated content preview action used by both submit and profile edit flows
  - Added warning modals in `src/pages/SubmitForm.tsx` and `src/pages/ProfileEditSubmission.tsx` that ask users to only regenerate when really needed
  - Updated the shared preview action call sites to pass source metadata and surface the backend rate-limit message cleanly
  - Verified with `npm run lint`

- [x] hide the component detail `llms.txt` link when SEO visibility is hidden (2026-03-16 22:49 UTC)
  - Updated `src/pages/ComponentDetail.tsx` so the standalone `View llms.txt` link uses the same hidden SEO visibility gate as the generated SEO and SKILL sections
  - Kept the change scoped to detail page rendering only
  - Verified with `npm run build` and confirmed the Netlify production build passes

- [x] capitalize visible component detail description heading and sync session docs (2026-03-16 21:47 UTC)
  - Added `capitalizeHeadingText()` in `src/pages/ComponentDetail.tsx` so the visible `{Component Name} Description` heading uses capitalized component text
  - Left AI generated SEO content unchanged and scoped the change to the visible long description `h2`
  - Updated `task.md`, `changelog.md`, and `files.md` for this session
  - Verified with `npm run build` and confirmed the Netlify production build passes

- [x] add editable SEO content fields to admin Component Details editor (2026-03-14 UTC)
  - Created `updateSeoContent` public admin mutation in `convex/seoContentDb.ts` that patches SEO fields directly without AI regeneration
  - Extracted `SeoContentSection` component in `src/components/ComponentDetailsEditor.tsx` with inline editing for all SEO fields (value prop, benefits, use cases, FAQ, resource links, SKILL.md)
  - All textarea fields use `resize-y` so admins can drag to expand
  - Passed `seoBenefits`, `seoUseCases`, `seoFaq`, `seoResourceLinks` from `src/pages/Admin.tsx` through to the editor
  - Confirmed AI SEO only triggers from Regenerate button or auto-generate admin setting
  - Verified with `npx tsc --noEmit` and `npm run build` (Netlify build passes)

- [x] add approved date sort view to admin submissions (2026-03-13 22:33 UTC)
  - Added a `Recently approved` option to the Package Submissions sort dropdown in `src/pages/Admin.tsx`
  - Sort now uses existing `approvedAt` data with submitted date fallback for items that do not have an approval timestamp
  - When that sort is active, the row date and expanded calendar tooltip show the approval date instead of the submission date
  - Verified with a lint pass on `src/pages/Admin.tsx`
  - Verified Netlify production build with `npm run build` (2026-03-13 22:35 UTC)

- [x] finish admin review history reviewed by placement and sync session docs (2026-03-13 21:40 UTC)
  - Removed the duplicate `Reviewed by` line from the expanded package card in `src/pages/Admin.tsx`
  - Kept `Reviewed by` visible only inside the AI Review History drawer detail pane
  - Synced `task.md`, `changelog.md`, and `files.md` for this session update
  - Verified the Netlify build command with `npm run build`

- [x] Fix reward status guard: prevent sending rewards for packages not in review or approved (2026-03-13 20:00 UTC)
  - Added `reviewStatus` check in `convex/payments.ts` `sendReward` action, rejecting if status is not `in_review` or `approved`
  - Disabled Send Reward button in `src/pages/Admin.tsx` for packages with wrong status, with descriptive tooltip
  - Added `backfillRewardStatusFromPayments` mutation in `convex/paymentsDb.ts` to reconcile orphaned Tremendous payments with package `rewardStatus`/`rewardTotalAmount`

- [x] Add collapsible author info toggle in admin package cards (2026-03-13 20:15 UTC)
  - Extracted `AuthorToggleSection` component in `src/pages/Admin.tsx` that wraps `SubmitterEmailEditor` behind a show/hide toggle
  - Author info (email, name, Discord) is hidden by default, reducing visual clutter per package card
  - Styled to match Component Details and Package Metadata boxes (rounded border, uppercase header, subtitle)

- [x] Make all admin toggle boxes click-to-expand (2026-03-13 21:30 UTC)
  - Updated Component Details, Package Metadata, and Component Author boxes so the entire header row is clickable to expand/collapse
  - Replaced inner `<button>` elements with accessible clickable `<div>` wrappers (role=button, tabIndex, Enter/Space keyboard support)
  - Pill label on the right remains as a visual indicator

Session updates complete on 2026-03-12 22:45 UTC.

- [x] add video support in long description markdown rendering (2026-03-12 22:45 UTC)
  - Added `img` and `a` component overrides to `ReactMarkdown` in `src/pages/ComponentDetail.tsx`
  - URLs ending in `.mp4`, `.webm`, or `.mov` now render as native `<video>` elements with controls instead of broken `<img>` tags or gray boxes
  - Fixes the issue where GitHub README videos (like `SelfHosting.mp4`) showed as unplayable content on component detail pages
  - Verified with `npm run build`

- [x] update AI review prompt to v6 with package entry point checks and wrapper guidance (`prds/ai-review-prompt-v6.md`) (2026-03-13 04:39 UTC)
  - Added a new critical criterion for required package entry points in `package.json`, including `./convex.config.js` and `./_generated/component.js`
  - Reframed component source discovery so top-level `convex/` is not treated as a normal packaged component pattern without supporting package evidence
  - Clarified that hooks, classes, and helper APIs may be exported by the package while component functions remain server-only across the boundary
  - Expanded `convex/aiReview.ts` GitHub repo snapshots to include `package.json` plus visible client and test entry files
  - Mirrored the same v6 prompt in `convex/aiSettings.ts` and bumped shared metadata in `shared/aiReviewPromptMeta.ts`

- [x] add shareable WorkOS admin auth feedback PRD (`prds/workos-admin-feedback-request.md`) (2026-03-10 01:04 UTC)
  - Summarized how this app grants admin access from WorkOS claims in `convex/auth.ts`
  - Documented that admin access is domain based on `identity.email` ending with `@convex.dev`, not a single hardcoded email
  - Added a short WorkOS feedback question list covering admin claims, roles, and JWT template best practices

- [x] link component detail categories to category pages and sync admin category slug lifecycle (`prds/category-detail-link-and-admin-sync.md`) (2026-03-09 05:19 UTC)
  - Linked the detail sidebar category pill to `/components/categories/:slug` only when the category still maps to an enabled public category
  - Synced detail markdown export to the same resolved admin-managed category label used in the UI
  - Migrated `packages.category` values on category slug edits and cleared them on category deletes in `convex/packages.ts`
  - Added admin identity checks to category admin queries and mutations and verified with Convex typecheck, lint, and `npm run build`

- [x] fix category page pagination and root directory links (`prds/category-page-pagination-and-root-links.md`) (2026-03-09 05:11 UTC)
  - Increased category page pagination from 12 to 24 items before `Page X of Y` appears
  - Normalized breadcrumb, back links, sidebar root links, and mobile "All" links to `/components/`
  - Updated `src/main.tsx`, `files.md`, and `changelog.md` to keep routing behavior and docs in sync

- [x] Add Discord username to component detail sidebar and admin editable submitter info (2026-03-09 21:55 UTC)
  - Added `submitterDiscord` to `publicPackageValidator` and `toPublicPackage()` so the detail page can display it
  - Added Discord row in `ComponentDetail.tsx` sidebar with Phosphor `DiscordLogo` icon linking to Convex community Discord
  - Expanded `SubmitterEmailEditor` in `Admin.tsx` to include editable Name and Discord fields with copy buttons
  - Added `updateSubmitterInfo` admin mutation in `convex/packages.ts`
  - Verified with `npm run build`

- [x] update AI review prompt to v4 to prevent false failures on internal functions (2026-03-09 06:45 UTC)
  - Criterion 5 now explicitly exempts `internalQuery`, `internalMutation`, and `internalAction` from the validator check
  - Added IMPORTANT bullet and updated JSON response template notes in the system prompt
  - Applied to both `convex/aiReview.ts` and `convex/aiSettings.ts`
  - Verified with TypeScript check and `npm run build`

- [x] fix admin category save perception and large category visibility (`prds/category-save-and-large-category-visibility.md`) (2026-03-08 23:25 UTC)
  - Synced `ComponentDetailsEditor` state with reactive backend props and kept explicit category clearing support in the admin save flow
  - Added a remount key in `src/pages/Admin.tsx` so saved package detail props reset the editor cleanly
  - Updated `src/pages/Directory.tsx` to restore pagination for all views including selected categories
  - Pagination shows 12 cards initially (4 columns x 3 rows on desktop) with "Load more" for additional items
  - Verified with Convex mutation success logs, lint checks, and `npm run build`

- [x] fix directory category selection scroll position (2026-03-08 22:13 UTC)
  - Updated `src/pages/Directory.tsx` so category selection runs through a shared handler for desktop and mobile filters
  - Added smooth scroll reset to the top of the directory header after a category change so the new results are visible immediately
  - Synced `files.md` and `changelog.md` for this session change

- [x] fix preflight.ts crypto module error (2026-03-08 23:15 UTC)
  - Changed `hashIp` from Node.js `crypto.createHash()` to Web Crypto API `crypto.subtle.digest()`
  - The default Convex runtime does not have access to Node.js built-in modules
  - Updated `convex/http.ts` to handle the now-async `hashIp` function
  - Verified with `npx convex codegen`, `npx tsc -p convex/tsconfig.json --noEmit --pretty false`, and `npm run build`

- [x] restore optional auto approve and auto reject outcomes behind auto AI review (`prds/admin-auto-ai-review-and-logo-thumbnail-gating.md`) (2026-03-08 22:01 UTC)
  - Brought back `Auto-approve on pass` and `Auto-reject on fail` while keeping `Auto AI review` as the top level trigger
  - Kept `Auto AI review` off by default and made the two outcome toggles depend on it in the Admin UI
  - Updated backend settings and AI review completion logic so optional approval or rejection automation runs only when `autoAiReview` is enabled
  - Supersedes the earlier single-toggle-only automation pass from the same session
  - Verified with `npx convex codegen`, `npx tsc -p convex/tsconfig.json --noEmit --pretty false`, and `npm run build`

- [x] add public preflight checker for component validation (`prds/public-preflight-checker.md`) (2026-03-08 22:30 UTC)
  - Extracted shared review helper `runReviewOnRepo` from `convex/aiReview.ts` so admin and public checks use the same logic
  - Added `runPreflightCheck` internal action that runs review without persisting to `packages` table
  - Added `preflightChecks` table in `convex/schema.ts` for rate limiting and result caching
  - Added `/api/preflight` HTTP endpoint with IP-based rate limiting (10 checks/hour), in-flight limits (1 concurrent), and 30-minute result caching
  - Created `convex/preflight.ts` with helper functions for IP hashing, URL normalization, and internal queries and mutations
  - Created `src/pages/SubmitCheck.tsx` with form input, loading states, and detailed results display including critical and advisory criteria
  - Added route for `/components/submit/check` in `src/main.tsx`
  - Added preflight check link in `src/pages/SubmitForm.tsx` below the header with icon and description
  - Verified with `npx convex codegen`, TypeScript checks, and `npm run build`

- [x] replace auto approve or reject with auto AI review workflow (`prds/admin-auto-ai-review-and-logo-thumbnail-gating.md`) (2026-03-08 19:17 UTC)
  - Replaced the Admin AI automation toggle pair with a single `Auto AI review` setting that queues review jobs and moves eligible packages into `in_review`
  - Turning the setting on now queues current pending packages that have repository URLs and leaves final approval or rejection to admins
  - Verified with `npx convex codegen`, `npx tsc -p convex/tsconfig.json --noEmit --pretty false`, and `npm run build`
- [x] gate auto submit thumbnail generation to logo backed submissions and clarify the admin setting copy (2026-03-08 19:17 UTC)
  - Confirmed `saveLogo` remains the only submit-time auto thumbnail trigger, so submissions without a logo are skipped
  - Updated the Admin settings copy to explicitly state the logo requirement for automatic thumbnail generation
- [x] update docs for the admin AI review automation change after verification (2026-03-08 19:17 UTC)
  - Added PRD `prds/admin-auto-ai-review-and-logo-thumbnail-gating.md`
  - Synced `task.md`, `changelog.md`, and `files.md` with the new automation workflow

- [x] add shared git and Cursor collaboration workflow PRD (`prds/git-cursor-shared-repo-workflow.md`) (2026-03-08 17:39 UTC)
  - Added a team workflow guide for working in the same repo with another developer using both Git CLI and Cursor's Commit and Sync UI
  - Documented the recommended branch first workflow plus a safe direct to `main` fallback using `git pull --rebase origin main`
  - Included quick safety checks for ahead, behind, and diverged branch states before using Cursor `Sync`
- [x] update AI review prompt to v3 with repo-based critical pass criteria and advisory notes (`prds/ai-review-prompt-v3.md`) (2026-03-08 17:16 UTC)
  - Archived the previous default AI review prompt v2 into `prds/ai-review-prompt-v3.md`
  - Updated `convex/aiReview.ts` and `convex/aiSettings.ts` to use a v3 prompt that judges component validity from the linked GitHub repository, not a published npm tarball
  - Split review output into 8 critical pass criteria and 4 advisory notes, while keeping the Admin JSON response shape unchanged
  - Updated runtime status scoring so advisory misses do not block a valid component from receiving `passed`
  - Ran `npx convex codegen`, `npx tsc -p convex/tsconfig.json --noEmit --pretty false`, and `npm run build`
  - Smoke tested `aiReview:runAiReview` against the stored `@convex-dev/stripe` package and confirmed the review completed with `aiReviewStatus: "passed"`
- [x] add admin ai review history panel (`prds/admin-ai-review-history.md`) (2026-03-08 06:06 UTC)
  - Added persistent `aiReviewRuns` storage so each AI review now records a durable run without changing the existing latest review snapshot behavior
  - Added admin history query plus a right-side review history drawer for previous review scores, summaries, criteria, provider metadata, raw output, and failures
  - Verified with `npx convex codegen`, `npx tsc -p convex/tsconfig.json --noEmit --pretty false`, and `npm run build`
- [x] allow admin to delete older AI review history runs (2026-03-08 17:04 UTC)
  - Added backend deletion guard so admins can remove saved `aiReviewRuns` entries while the latest snapshot stays protected
  - Added delete controls and confirmation flow in the AI review history drawer for past runs only
  - Verified with `npx convex codegen`, `npx tsc -p convex/tsconfig.json --noEmit --pretty false`, and `npm run build`
- [x] let escape close ai review history drawer (2026-03-08 17:05 UTC)
  - Added `Escape` key handling to the AI review history drawer in `src/pages/Admin.tsx`
  - Keeps the confirm dialog safe by only closing the drawer on `Escape` when a delete confirmation is not open
  - Verified with `npm run build`
- [x] sync session docs for Tremendous reward flow and component visibility prompt clarification (2026-03-08 01:18 UTC)
  - Synced `files.md`, `changelog.md`, and `TASK.md` for the Tremendous reward flow session and the follow-up component visibility prompt clarification
  - Clarified that wrapper or app calls across a Convex component boundary must target public component functions, while same-component implementation details should use `internal*`
  - Verified `npm run build` passes for the Netlify production build flow
- [x] add admin settings jump navigation (2026-03-08 00:49 UTC)
  - Added anchored section wrappers for each block in the Admin settings tab
  - Added a sticky jump bar for smaller screens and switched the desktop settings nav to a sticky in-layout sidebar on extra-wide screens
  - Moved sticky positioning onto the desktop sidebar container so the rail stays pinned while scrolling the settings page
  - Kept existing settings panels and feature behavior unchanged while making the long page easier to navigate
- [x] setup tremendous (`prds/tremendous-rewards-working-setup.md`) (2026-03-07 02:25 UTC)
  - Working setup uses `convex/payments.ts` for Node actions and `convex/paymentsDb.ts` for queries and mutations
  - Uses Tremendous REST API via `fetch()` with normalized sandbox or production base URLs
  - Campaign safe payload now avoids sending `products` when `TREMENDOUS_CAMPAIGN_ID` is present
  - Admin UI includes Send Reward, PaymentBadge, RewardSettingsPanel, reward history modal, and settings-only test reward flow
- [x] add Tremendous settings test reward (`prds/tremendous-settings-test-reward.md`) (2026-03-08 00:41 UTC)
  - Added settings-only `Send Test Reward` action in `RewardSettingsPanel`
  - Test reward sends to `TREMENDOUS_TEST_RECIPIENT_EMAIL` and records a `payments` row with `isTest: true`
  - Test payments do not patch `packages.rewardStatus` or `packages.rewardTotalAmount`
  - Test payments are excluded from reward stats totals
- [x] add reward history modal and count in admin (`prds/admin-reward-history-modal.md`) (2026-03-07 06:10 UTC)
  - Added reward history count pill next to the Reward button in `src/pages/Admin.tsx`
  - Added reward history modal showing past payment attempts, including test payments, statuses, amounts, recipient email, notes, and Tremendous link when available
  - Reused existing `api.paymentsDb.getPaymentsForPackage` query and existing admin modal styling
- [ ] fix logout on submit page
- [ ] add admin
- [x] Admin dashboard default filter changed from "pending" to "all" (2026-03-07 00:35 UTC)
- [x] Directory category sections now show 3 rows before "Load more" (2026-03-07 00:35 UTC)
  - Changed `groupedCardsPerLoad` from `gridColumns * 2` to `gridColumns * 3`
- [x] fix image meta (2026-03-06 UTC)
  - Final fix reverts `og:image` back to the known working raw `thumbnailUrl` storage format
  - Updated `og-meta.ts` edge function to emit `component.thumbnailUrl` directly
  - Updated `ComponentDetail.tsx` client-side SEO to use `component.thumbnailUrl` again
  - Removed the unused `/api/og-image` endpoint and `/components/og/*` Netlify redirect
  - Social crawlers now see the original working image URL format like `https://giant-grouse-674.convex.cloud/api/storage/...`
- [x] revert OG image proxy path to raw thumbnail URLs (`prds/og-image-meta-revert.md`) (2026-03-06 22:54 UTC)
  - Reverted both server side and client side OG image generation to direct storage URLs
  - Removed the unused OG proxy backend and Netlify route
  - Kept badge routing unchanged since the dedicated badge edge proxy is the known working pattern
- [ ] share
- [ ] test submitting
  - Commented out MCP ready badge in AgentInstallSection.tsx
  - Commented out all MCP routes in convex/http.ts
  - Kept Copy prompt, Agent friendly summary, llms.txt, and markdown features working
- [ ] npm security scanner
- [ ] check api ai model
- [ ] add posthog

- [x] Updated badge SVG colors to match frontend status pills and shields.io styling (2026-03-06 21:45 UTC)
  - Changed left box from `#2a2825` to `#555555` (shields.io gray)
  - Approved: `#228909` (Convex Verified green)
  - In Review: `#2563eb` (frontend blue pill)
  - Changes Requested: `#ea580c` (frontend orange pill)
  - Updated `badge-palette-preview.html` preview file
- [x] Replace Delete Account with "Need help?" guidance on Profile page (2026-03-06 UTC)
  - Removed DeleteAccountModal component and all delete account state/logic
  - Replaced red "Delete Account" section with neutral "Need help?" section
  - Users now use existing "Send Request" button to contact Convex team for component removal or account changes
  - Removed unused `UserMinus` and `useMemo` imports
- [x] Removed MCP Server references from `/api/llms.txt` and `/api/markdown-index` endpoints (2026-03-06 UTC)
  - Endpoints were still advertising disabled MCP protocol URLs
  - Removed "MCP Server" section from llms.txt output
  - Removed "MCP Server Integration" section from markdown-index output
  - Kept `MCP_DIRECT_ORIGIN` constant for future MCP re-enablement
- [x] fix mcp (2026-03-06 06:45 UTC)
- [x] badge shield on each component page (2026-03-06 09:15 UTC)
- [x] Added badge preview with image to ComponentDetail.tsx

- [x]Fixed edge function conflict blocking badge endpoint

- [x] Updated og-meta.ts to skip both "badge" and "badge/" paths so badge redirects work
- [x] Updated badge endpoint docs in src/docs/badges.md and src/docs/api-endpoints.md to use /components/badge/
- [x] Added dedicated Netlify edge function `component-badge.ts` for `/components/badge/*` to bypass SPA fallback and proxy badge SVG directly

- [x]Verified production build passes with `npm run build` (2026-03-06 UTC)

- [x] Updated fix plan and PRD with final working badge routing pattern
- [x] Added local `badge-palette-preview.html` with badge/status color previews and added it to `.gitignore`
- [x] Submission badge sync rollout (2026-03-06 01:45 UTC)
  - Added `isSlugTaken()` and `generateUniqueSlug()` helpers for slug uniqueness in `convex/packages.ts`
  - Updated `addPackage`, `generateSlugForPackage`, `generateMissingSlugs`, `updateComponentDetails` for collision safe slug handling
  - Added `BadgeSnippet` component to `src/pages/Submit.tsx` for README badge copy and preview
  - Added `BadgeSnippet` component to `src/pages/Profile.tsx` for owner facing badge access
  - Badges auto sync with review status at request time (no caching)
  - Admin backfill through existing slug migration UI now uses uniqueness guards
- [x] Temporarily disable MCP UI and backend routes (2026-03-06 UTC)
- [x] Removed MCP Server references from public llms.txt and markdown-index endpoints (2026-03-06 UTC)
- [x] Show package license above category in `src/pages/ComponentDetail.tsx` (2026-03-06 UTC)
  - Added License metadata block in the sidebar above Category
  - Reads from existing `getComponentBySlug` package payload, so Admin auto refresh updates license automatically on detail pages
- [x] Updated `files.md`, `changelog.md`, and `task.md` for this session change (2026-03-06 UTC)

- [x]check all routes for mcp and md and llms.text

### MCP Streamable HTTP migration (PRD: prds/mcp-streamable-http-migration.md)

- [x] Diagnosed `@anthropic-ai/mcp-server-fetch` removed from npm (404) breaking all MCP installs (2026-03-06 06:30 UTC)
- [x] Wrote PRD at `prds/mcp-streamable-http-migration.md` (2026-03-06 06:30 UTC)
- [x] Added GET handler for `/api/mcp/protocol` returning server discovery info (2026-03-06 06:40 UTC)
- [x] Updated protocol version to `2025-03-26` (MCP Streamable HTTP spec) (2026-03-06 06:40 UTC)
- [x] Updated CORS headers for MCP transport (`Accept`, `Mcp-Session-Id`, `Mcp-Protocol-Version`) (2026-03-06 06:40 UTC)
- [x] Migrated `cursor-install` and `cursor-install-component` endpoints from command/args to url config (2026-03-06 06:40 UTC)
- [x] Migrated `src/lib/mcpProfile.ts`: all 4 generator functions now use url-based config (2026-03-06 06:42 UTC)
- [x] Updated `shared/mcpTypes.ts` `CursorInstallLink` interface to `{url: string}` (2026-03-06 06:43 UTC)
- [x] Updated `src/docs/mcp.md` with new config examples for Cursor, Claude Desktop, ChatGPT (2026-03-06 06:44 UTC)
- [x] Zero type errors, zero remaining references to dead package (2026-03-06 06:45 UTC)
- [x] Updated `files.md`, `changelog.md`, `task.md` (2026-03-06 06:50 UTC)

### Netlify proxy routing fix (dev to prod)

- [x] Changed all `netlify.toml` redirect targets from `third-hedgehog-429.convex.site` (dev) to `giant-grouse-674.convex.site` (prod) (2026-03-06 07:15 UTC)
- [x] Added MCP API proxy redirects `/api/mcp/*` and `/components/api/mcp/*` before SPA fallback (2026-03-06 07:15 UTC)
- [x] Added badge API proxy redirect `/components/badge/*` (2026-03-06 07:15 UTC)
- [x] Verified build passes with zero type errors (2026-03-06 07:15 UTC)
- [x] Updated `changelog.md`, `task.md` (2026-03-06 07:15 UTC)

### MCP live endpoint verification and fallback

- [x] Read `prds/deploy-commands.md` and confirmed production app host mapping (`components-directory.netlify.app`) (2026-03-06 08:00 UTC)
- [x] Verified `https://www.convex.dev/components/api/mcp/protocol` returns SPA HTML, not MCP JSON (2026-03-06 08:00 UTC)
- [x] Verified `https://components-directory.netlify.app/components/api/mcp/protocol` returns SPA HTML and `/api/mcp/protocol` returns Netlify 404 (2026-03-06 08:00 UTC)
- [x] Verified direct Convex MCP endpoint `https://giant-grouse-674.convex.site/api/mcp/protocol` works for both GET discovery and POST initialize (2026-03-06 08:00 UTC)
- [x] Updated `files.md`, `changelog.md`, and `task.md` with session findings and immediate fallback guidance (2026-03-06 08:00 UTC)

### MCP direct Convex endpoint fallback (PRD: prds/mcp-direct-convex-endpoint-fallback.md)

- [x] Created PRD for temporary direct MCP fallback rollout (2026-03-06 08:17 UTC)
- [x] Updated `src/lib/mcpProfile.ts` so Cursor, Claude Desktop, and ChatGPT configs use `https://giant-grouse-674.convex.site/api/mcp/protocol` (2026-03-06 08:17 UTC)
- [x] Updated `convex/http.ts` MCP discovery metadata and backend Cursor install payloads to use the same direct MCP origin (2026-03-06 08:17 UTC)
- [x] Updated `src/docs/mcp.md`, `files.md`, `changelog.md`, and `task.md` to document the temporary fallback (2026-03-06 08:17 UTC)
- [ ] Verify deployed install flow in Cursor, Claude Desktop, and ChatGPT against the direct endpoint

### SKILL.md generation improvements (Anthropic guidelines)

- [x] Analyzed current `buildSkillMd()` implementation against Anthropic skill creator guidelines (2026-03-06 UTC)
- [x] Added `buildTriggerContexts()` helper for "pushy" description fields (2026-03-06 UTC)
- [x] Updated description field to include dynamic trigger contexts from category, tags, and use cases (2026-03-06 UTC)
- [x] Changed instructions to imperative form per Anthropic guidelines (2026-03-06 UTC)
- [x] Added "When NOT to use" section to prevent over-triggering (2026-03-06 UTC)
- [x] Updated SEO + SKILL.md Prompt panel description in Admin.tsx to document new format (2026-03-06 UTC)
- [x] Updated `files.md`, `changelog.md`, and `task.md` (2026-03-06 UTC)

### OpenGraph meta tags for social crawlers

- [x] Created `netlify/edge-functions/og-meta.ts` to serve dynamic OG tags to bots (2026-03-05 23:45 UTC)
- [x] Updated `netlify.toml` with edge function registration on `/components/*` (2026-03-05 23:45 UTC)
- [x] Updated `files.md`, `changelog.md`, `task.md` (2026-03-05 23:50 UTC)
  ```
  [x] fix opengraph view (2026-03-06 06:15 UTC)
  ```

### OpenGraph meta fix v2: HTML injection approach

- [x] Diagnosed v1 failure: opengraph.xyz uses headless Chrome without bot UA (2026-03-06 06:05 UTC)
- [x] Rewrote `og-meta.ts` to inject meta tags into SPA HTML for all requests (2026-03-06 06:10 UTC)
- [x] Verified regex handles multi-line meta tags in production HTML (2026-03-06 06:12 UTC)
- [x] Verified slug extraction excludes static assets and reserved paths (2026-03-06 06:13 UTC)
- [x] Created PRD at `prds/opengraph-meta-fix.md` (2026-03-06 06:15 UTC)
- [x] Updated `files.md`, `changelog.md`, `task.md` (2026-03-06 06:15 UTC)
- [ ] Deploy and verify with opengraph.xyz

### AI review prompt v2 update (PRD: prds/ai-review-prompt-v1.md)

- [x] Archived original AI review prompt to `prds/ai-review-prompt-v1.md` (2025-03-05 21:30 UTC)
- [x] Updated `convex/aiSettings.ts` DEFAULT_REVIEW_PROMPT to v2 (2025-03-05 21:30 UTC)
- [x] Updated `convex/aiReview.ts` REVIEW_CRITERIA and default prompt template to v2 (2025-03-05 21:30 UTC)
- [x] Fixed false negative: only exported query/mutation/action need returns validators, not helper functions (2025-03-05 21:30 UTC)
- [x] Fixed false positive: public API functions should NOT use internal (2025-03-05 21:30 UTC)
- [x] Added ctx.auth unavailability note and auth callback pattern guidance (2025-03-05 21:30 UTC)
- [x] Updated "How AI Review Works" section in Admin settings panel to match v2 criteria (2025-03-05 22:00 UTC)
- [x] Updated `files.md`, `changelog.md`, and `task.md` (2025-03-05 22:00 UTC)

### Admin search enhancement (PRD: prds/admin-search-enhancement.md)

- [x] Add `search_componentName` index to schema (2026-03-05 22:12 UTC)
- [x] Add `search_repositoryUrl` index to schema (2026-03-05 22:12 UTC)
- [x] Update `adminSearchPackages` to search componentName and repositoryUrl (2026-03-05 22:12 UTC)
- [x] Verify Convex functions compile successfully (2026-03-05 22:12 UTC)
- [x] Update `files.md`, `changelog.md`, and `task.md` (2026-03-05 22:15 UTC)
- [x] Fix submit form markdown mini preview rendering (headings, lists) and add 500 char limit (2026-03-05 23:25 UTC)
- [x] update routes for mcp
- [x] Fix long description markdown line breaks and purple hover-link styling on component detail page (PRD: `prds/markdown-long-description-rendering-and-preview.md`) (2026-03-05 23:08 UTC)
- [x] Add safe markdown long description support notes and mini preview in submit form (PRD: `prds/markdown-long-description-rendering-and-preview.md`) (2026-03-05 23:08 UTC)
- [x] Verify markdown rendering behavior and update docs (`task.md`, `changelog.md`, `files.md`) (2026-03-05 23:08 UTC)

### Multi-platform MCP install section (PRD: prds/multi-platform-mcp-install.md)

- [x] Add platform toggle tabs (Cursor, Claude, ChatGPT) to AgentInstallSection (2026-03-04 20:10 UTC)
- [x] Add Claude Desktop config generator and manual setup instructions (2026-03-04 20:08 UTC)
- [x] Add ChatGPT custom connector setup instructions (2026-03-04 20:08 UTC)
- [x] Test all three platform MCP install flows (2026-03-04 20:15 UTC)
- [x] Update files.md, changelog.md, task.md (2026-03-04 20:15 UTC)
- [x] Switch MCP install URLs to live public `/components/api` path and refresh docs (2026-03-05 00:10 UTC)

### Documentation full feature coverage update

- [x] Audited all docs against files.md and changelog.md for missing features (2026-03-04 22:30 UTC)
- [x] Created mcp.md covering MCP protocol, REST API, Cursor install, agent prompts (2026-03-04 22:30 UTC)
- [x] Created api-endpoints.md covering llms.txt, markdown, badge SVG, Netlify aliases (2026-03-04 22:30 UTC)
- [x] Created badges.md covering README badge endpoint, usage, and analytics (2026-03-04 22:30 UTC)
- [x] Updated 9 existing docs with missing feature details (2026-03-04 22:30 UTC)
- [x] Added "Integrations" nav group in Documentation.tsx (2026-03-04 22:30 UTC)
- [x] Verified build passes and updated files.md, changelog.md, task.md (2026-03-04 22:30 UTC)

### Documentation markdown rendering improvements (PRD: prds/docs-markdown-rendering-improvements.md)

- [x] Improve Documentation.tsx markdown rendering for tables, code blocks, lists, blockquotes, and related rich markdown formats (2026-03-04 21:24 UTC)
- [x] Verify `npm run build` passes after markdown rendering updates (2026-03-04 21:24 UTC)
- [x] Update `files.md`, `changelog.md`, and `task.md` with session changes (2026-03-04 21:24 UTC)

### Admin filter bar UX fix

- [x] Changed filter tabs from horizontal scroll to flex wrap (2026-03-04 19:00 UTC)
- [x] Changed filter tab tooltips to position above instead of below (2026-03-04 19:00 UTC)

### Admin submissions sort dropdown update

- [x] Added `verified`, `community`, and `featured` sort modes in `src/pages/Admin.tsx` (2026-03-05 21:53 UTC)
- [x] Added dropdown options `Verified first`, `Community first`, and `Featured first` (2026-03-05 21:53 UTC)
- [x] Verified sort stability with newest-date fallback tie-breaker (2026-03-05 21:53 UTC)
- [x] Updated `files.md`, `changelog.md`, and `task.md` for this session (2026-03-05 21:53 UTC)

### Admin documentation system (PRD: prds/admin-documentation-system.md)

- [x] Create PRD with UI design and file structure plan (2026-03-04 12:00 UTC)
- [x] Create 13 markdown documentation files in `src/docs/` covering user guide and admin guide topics (2026-03-04 12:15 UTC)
- [x] Create `Documentation.tsx` component with admin gating and markdown rendering (2026-03-04 12:20 UTC)
- [x] Add documentation route to `main.tsx` router at `/components/documentation/:section?` (2026-03-04 12:25 UTC)
- [x] Add "documentation" to reserved routes in `src/lib/slugs.ts` (2026-03-04 12:25 UTC)
- [x] Add TypeScript declarations for `*.md?raw` imports (2026-03-04 12:25 UTC)
- [x] Add "Docs" link to Header.tsx nav bar for admins (2026-03-04 12:35 UTC)
- [x] Use client-side section navigation in Documentation.tsx to avoid full reload and spinner between doc pages (2026-03-04 19:20 UTC)
- [x] Update `files.md`, `changelog.md`, and `task.md` (2026-03-04 12:35 UTC)

### AI provider runtime failover (PRD: prds/ai-provider-runtime-failover.md)

- [x] Add internal provider settings query for failover candidate selection in `convex/aiSettings.ts` (2026-03-04 02:29 UTC)
- [x] Add shared failover helper to build candidate chain and execute fallback in `convex/aiProviderFallback.ts` (2026-03-04 02:29 UTC)
- [x] Wire failover chain into `convex/aiReview.ts` so runtime provider errors fall through to next candidate (2026-03-04 02:29 UTC)
- [x] Wire failover chain into `convex/seoContent.ts` so generation can continue on provider failure (2026-03-04 02:29 UTC)
- [x] Verify with `npx convex codegen`, `npx tsc -p convex/tsconfig.json --noEmit --pretty false`, and `npx tsc -p . --noEmit --pretty false` (2026-03-04 02:29 UTC)

### Directory sort by verified and category verified counts (PRD: prds/directory-sort-verified-and-category-verified-count.md)

- [x] Add `verified` sort mode in directory backend query and UI dropdowns (2026-03-03 07:47 UTC)
- [x] Add `verifiedCount` to category aggregation used by Category Management (2026-03-03 07:47 UTC)
- [x] Update admin category row display to include verified counts (2026-03-03 07:47 UTC)
- [x] Verify existing sort modes and verified toggles still work (2026-03-03 07:47 UTC)
- [x] Update docs: `task.md`, `changelog.md`, and `files.md` after verification (2026-03-03 07:47 UTC)

### Private profile admin messages and admin notes separation (PRD: prds/private-profile-admin-messages-and-admin-notes.md)

- [x] Route profile user messages to admin comments thread in `packageComments` and keep admin notes in `packageNotes` only (2026-03-03 06:24 UTC)
- [x] Remove public comment rendering from `src/pages/Submit.tsx` so user admin messages stay private (2026-03-03 06:24 UTC)
- [x] Add ownership based message actions (hide, archive, delete) for both profile and admin comment UIs (2026-03-03 06:24 UTC)
- [x] Enforce backend authorization for message lifecycle actions (no client trusted author fields) (2026-03-03 06:24 UTC)
- [x] Update docs: `task.md`, `changelog.md`, and `files.md` after verification (2026-03-03 06:24 UTC)

### WorkOS Connect migration for Convex app auth (PRD: prds/workos-connect-convex-migration.md)

- [x] Implement Connect OAuth PKCE provider and callback handling (2026-03-03 00:22 UTC)
- [x] Bridge Connect tokens into Convex auth client (2026-03-03 00:23 UTC)
- [x] Update Convex JWT provider configuration for Connect issuer/JWKS (2026-03-03 00:23 UTC)
- [x] Verify route access behavior remains unchanged (2026-03-03 00:25 UTC)
- [x] Update task, changelog, and files docs with timestamps (2026-03-03 00:26 UTC)

### WorkOS AuthKit migration for components routes (PRD: prds/workos-authkit-migration-components-routes.md)

- [x] Swap frontend auth provider from legacy Convex Auth to WorkOS AuthKit and keep `/components/callback` return path behavior (2026-03-02 23:36 UTC)
- [x] Replace backend auth helpers and admin checks to use `ctx.auth.getUserIdentity()` email claims (2026-03-02 23:37 UTC)
- [x] Remove legacy auth schema and HTTP route coupling (`authTables`, `auth.addHttpRoutes`) (2026-03-02 23:37 UTC)
- [x] Update dependencies and auth config for WorkOS JWT providers (2026-03-02 23:40 UTC)
- [x] Verify public, auth-gated, and admin routes plus markdown alias route safety (2026-03-02 23:41 UTC)
- [x] Update `task.md`, `changelog.md`, and `files.md` with completion timestamps (2026-03-02 23:42 UTC)

### WorkOS Convex environment runbook (PRD: prds/workos-convex-environment-runbook.md)

- [x] Create runbook PRD with staging and production WorkOS setup for redirects, CORS, and JWT email claim requirements (2026-03-02 22:30 UTC)
- [x] Document exact Convex deployment environment variables for staging and production including required and optional AuthKit auto-provision keys (2026-03-02 22:30 UTC)
- [x] Document frontend environment variables for local and Netlify production along with route verification checklist (2026-03-02 22:30 UTC)
- [x] Update `task.md`, `changelog.md`, and `files.md` to include this runbook deliverable (2026-03-02 22:30 UTC)

### PRD and docs timestamp tracking (PRD: prds/prd-doc-timestamp-tracking.md)

- [x] Add PRD metadata requirements with date and time format in workflow and create-prd skill (2026-03-02 22:18 UTC)
- [x] Add timestamp guidance for task completion logging in task workflow docs (2026-03-02 22:18 UTC)
- [x] Add timestamp guidance for changelog updates in update-project-docs skill and workflow rule (2026-03-02 22:18 UTC)
- [x] Update project docs (`task.md`, `changelog.md`, `files.md`) to reflect this process update (2026-03-02 22:18 UTC)
- [x] Backfill timestamp metadata across existing PRDs in `prds/` (2026-03-02 22:24 UTC)
- [x] Backfill legacy completed task entries with timestamp format in `task.md` (2026-03-02 22:25 UTC)
- [x] Normalize legacy date-only changelog bullets to timestamp format in `changelog.md` (2026-03-02 22:26 UTC)

### MCP and Agent Install UX (PRD: prds/mcp-agent-install-ux.md)

- [x] Create PRD for read-only MCP, ComponentDetail UX, and rollback constraints (2026-02-28 12:00 UTC)
- [x] Define exact SubmitForm to MCP public field mapping and strip non-public submitter fields (2026-02-28 12:00 UTC)
- [x] Add per-component MCP profile generation (`src/lib/mcpProfile.ts`) (2026-02-28 12:00 UTC)
- [x] Build universal prompt composer with deterministic fallback (`src/lib/promptComposer.ts`) (2026-02-28 12:00 UTC)
- [x] Add MCP HTTP endpoints (`convex/http.ts`) (2026-02-28 12:00 UTC)
- [x] Add Use with agents and CLI section in ComponentDetail with badges, prompts, and copy actions (2026-02-28 12:00 UTC)
- [x] Add install snippets for CLI and agent apps (2026-02-28 12:00 UTC)
- [x] Add IP-based rate limiting and request logging for MCP endpoints (2026-02-28 12:00 UTC)
- [x] Ship behind feature flags with documented rollback steps (2026-02-28 12:00 UTC)
- [x] Verify route safety: markdown alias, llms.txt, SPA routes all work (2026-02-28 12:00 UTC)
- [x] Update task.md, changelog.md, and files.md (2026-02-28 12:00 UTC)
- [x] Simplified AgentInstallSection UI: single copy prompt, MCP badge in header, removed toggle (2026-03-02 12:00 UTC)
- [x] Moved Use with agents and CLI section above Keywords for SEO/AEO/GEO (2026-03-02 12:00 UTC)
- [x] Added Use with AI anchor link with ClipboardText icon in header navigation (2026-03-02 12:00 UTC)
- [x] Reordered sections: Use with agents and CLI, then Agent Skill (SKILL.md), then Keywords (2026-03-02 12:00 UTC)

Acceptance checks:

- [x] Component detail route works
- [x] Markdown alias resolves via Netlify Edge Function (unchanged)
- [x] llms.txt routes work (per-component and directory-wide) (unchanged)
- [x] Admin/profile/submission routes unchanged
- [x] MCP endpoints return valid JSON responses
- [x] Universal prompt generates with fallback when SEO enrichment missing
- [x] Copy actions work on detail page

### Submit page pagination and default page size (PRD: prds/submit-pagination-admin-page-size-setting.md)

- [x] Add paginated submissions queries for list and search in `convex/packages.ts`
- [x] Add admin and public settings queries for Submit page default page size (20, 40, 60)
- [x] Update `src/pages/Submit.tsx` to use paging controls and default page size setting
- [x] Add a settings panel in `src/pages/Admin.tsx` to change default Submit page size
- [x] Verify pagination behavior and update docs (`task.md`, `changelog.md`, `files.md`)

### Component URL centralization (PRD: prds/component-url-centralization.md)

- [x] Add shared helper for component detail, markdown alias, and llms URLs
- [x] Update `ComponentDetail.tsx` dropdown with open markdown and AI-link actions using helper
- [x] Add llms link below Keywords in `ComponentDetail.tsx`
- [x] Update `convex/http.ts` markdown and llms link emission to use helper
- [x] Run build and Convex typecheck verification

### AI Provider Settings and Prompt Versioning (PRD: prds/ai-provider-settings-and-prompt-versioning.md)

- [x] Add `aiProviderSettings` table to schema
- [x] Add `aiPromptVersions` table to schema
- [x] Create `convex/aiSettings.ts` with provider and prompt queries/mutations
- [x] Update `convex/aiReview.ts` to use custom provider settings and prompts
- [x] Add `AiProviderSettingsPanel` component to Admin.tsx
- [x] Add `AiPromptSettingsPanel` component to Admin.tsx
- [ ] Test default behavior unchanged (env vars work)
- [ ] Test provider override (Anthropic, OpenAI, Gemini)
- [ ] Test prompt versioning and restore

### Existing tasks

- [ ] vercel.json in website can point to repo app
- [ ] fix ai check

- docs for badges
- add image builder

- [ ] add image builder from [https://component-thumbnail-gen.netlify.app/](https://component-thumbnail-gen.netlify.app/) and [https://github.com/waynesutton/component-directory-image-generator](https://github.com/waynesutton/component-directory-image-generator)
- [ ] add incre
- [x] header and footer
- [ ] fix font colros a
- [ ] npm run typecheck
- [ ] add fonts
- [ ] add plugin
- [ ] prod checklist
- [ ] tailwind css form github
- [ ] iimport exiting compons
- [ ] - [ ] add payments api

## completed

- [x] Refine ComponentDetail security scan sidebar and modal copy (2026-04-02 00:24 UTC)
  - Updated `src/pages/ComponentDetail.tsx` so the sidebar now uses the neutral `Security Analyze` label and shows only scan presence plus date
  - Removed `safe` or `unsafe` style status labels from the sidebar and provider rows, added provider site links, and moved the scan date above the provider list in the modal
  - Kept a modal-only status line using neutral labels: `Confirmed`, `Not scanned`, and `Alerts`
  - Hid the header Markdown dropdown while the security modal is open and made the unscanned state open the same modal
  - Verified with `ReadLints` on `src/pages/ComponentDetail.tsx`

- [x] Restructure `.claude/skills/` to proper directory format and add Convex community skills (2026-03-19 07:15 UTC)
  - Migrated 6 existing flat skills (`dev.md`, `gitrules.md`, `help.md`, `sec-check.md`, `workflow.md`, `write.md`) to `skill-name/SKILL.md` directories with YAML frontmatter per Agent Skills spec
  - Added `real-time-backend/SKILL.md` from `get-convex/real-time-backend-skill` for backend architecture guidance
  - Added `convex-quickstart/SKILL.md` from `get-convex/agent-skills` for project scaffolding
  - Added `convex-setup-auth/SKILL.md` from `get-convex/agent-skills` for auth provider setup
  - Added `schema-builder/SKILL.md` from `get-convex/convex-agent-plugins` for schema design
  - Added `function-creator/SKILL.md` from `get-convex/convex-agent-plugins` for function creation
  - Added `migration-helper/SKILL.md` from `get-convex/convex-agent-plugins` for safe migrations
  - Total: 12 skills in standard directory format

- [x] align Claude skills with active Cursor rules and add missing security and workflow guidance (`prds/claude-skills-alignment.md`) (2026-03-19 06:42 UTC)
  - Added `.claude/skills/sec-check.md` for auth, PII exposure, public vs internal query, and verification guidance
  - Added `.claude/skills/workflow.md` for PRDs, task tracking, changelog sync, files sync, and subagent usage
  - Updated `.claude/skills/gitrules.md` so commit creation requires explicit user approval
  - Updated `.claude/skills/dev.md` to reflect the current PRD and docs workflow rules

- [x] polish layout and imported README behavior for submit, profile edit, and detail surfaces (`prds/layout-and-readme-link-polish.md`) (2026-03-17 05:43 UTC)
  - Matched `src/pages/SubmitForm.tsx`, `src/pages/Profile.tsx`, and `src/pages/ProfileEditSubmission.tsx` to the `max-w-7xl` page shell used by `src/pages/Submit.tsx`
  - Made the generated-content textareas in submit and profile edit vertically resizable so users can drag them taller while editing
  - Updated `src/components/ReadmePreviewNotice.tsx` with Phosphor toggle icons so the README source helper reads like an expandable control
  - Upgraded `src/components/CodeBlock.tsx` with a built-in copy button and reused it in `src/components/AgentInstallSection.tsx` for the visible agent prompt block
  - Fixed imported README relative links in `src/pages/ComponentDetail.tsx` so paths like `CONTRIBUTING.md` resolve against the GitHub repository instead of the local app
  - Verified with `npx tsc --noEmit`, `ReadLints`, and `npm run build`

- [x] align detail, submit, admin, and profile editing with the v2 content model (`prds/v2-content-editor-and-profile-edit-page.md`) (2026-03-17 05:21 UTC)
  - Updated `src/pages/ComponentDetail.tsx` to move `View llms.txt` into the badge section and switched README source phrasing to read more naturally via `convex/seoContent.ts`
  - Widened `src/pages/SubmitForm.tsx` to `1200px` and replaced the flat README preview note with a shared marker-status helper linked to the official component template
  - Updated `src/components/ComponentDetailsEditor.tsx`, `src/pages/Admin.tsx`, and `convex/seoContentDb.ts` so migrated packages edit the v2 generated content model instead of the old AI SEO section
  - Added routed full-page profile editing in `src/pages/ProfileEditSubmission.tsx` and `src/main.tsx`, and updated `src/pages/Profile.tsx` to use the new page flow at the wider layout
  - Verified with `npx tsc --noEmit`, `ReadLints`, and `npm run build`

- [x] fix migrated README rendering and remove legacy Resources from v2 detail output (`prds/content-model-migration-readme-rendering-fixes.md`) (2026-03-17 03:50 UTC)
  - Fixed `src/components/CodeBlock.tsx` to pass Pierre Diffs the expected `name` field instead of `filename`, which stops README code blocks from crashing during migrated detail-page rendering
  - Updated `src/pages/ComponentDetail.tsx` so legacy SEO sections only render for the old content model and removed the old visible Resources block
  - Removed obsolete Resources output from the legacy markdown builders in `convex/http.ts` and `convex/router.ts` so exported markdown stays aligned with the new content model
  - Verified with `npx tsc --noEmit` and `ReadLints`

- [x] prioritize GitHub README and Convex docs grounding for AI SEO generation (`prds/seo-readme-and-convex-docs-grounding.md`) (2026-03-16 23:05 UTC)
  - Added shared SEO prompt template in `shared/seoPromptTemplate.ts` so admin and runtime fallback prompts stay aligned
  - Updated `convex/seoContent.ts` to fetch GitHub README content on demand, support common GitHub `blob` and `tree` README paths, and add best effort Convex docs grounding from `https://docs.convex.dev/llms.txt` plus `https://docs.convex.dev/`
  - Updated `src/pages/Admin.tsx` SEO prompt help text and placeholder list to reflect README first grounding and Convex docs context
  - Verified with `npm run build`

- [x] add admin toggle to hide detail page SEO and SKILL sections (`prds/detail-page-seo-visibility-toggle.md`) (2026-03-16 21:37 UTC)
  - Added `hideSeoAndSkillContentOnDetailPage` to package data in `convex/schema.ts` and exposed it through the public and admin package shapes in `convex/packages.ts`
  - Updated `updateComponentDetails` so the existing admin editor mutation can toggle the new visibility flag
  - Added a new `Hide SEO` or `SEO Hidden` toggle to the Actions row in `src/pages/Admin.tsx`
  - Updated `src/pages/ComponentDetail.tsx` to hide generated SEO blocks, SKILL download actions, the `For Agents` link, `AgentInstallSection`, and the `SKILL.md` block when the flag is enabled
  - Gated detail-page meta description and FAQ JSON-LD to the same visibility flag so hidden drafts stay out of the public SEO layer
  - Verified with `npx convex codegen`, `npx tsc --noEmit`, and `npm run build`

- [x] fix submit form category dropdown sync with admin-managed categories (`prds/submit-form-category-sync.md`) (2026-03-16 17:27 UTC)
  - Updated `src/pages/SubmitForm.tsx` to use category `id` values from `useDirectoryCategories()` instead of a non-existent `slug` field
  - Keeps submit-time category selection aligned with `src/components/ComponentDetailsEditor.tsx` and the admin category source of truth
  - Verified with `npm run build`

- [x] fix submit success modal button roundness and sync session docs (2026-03-12 17:06 UTC)
  - Updated `src/pages/SubmitForm.tsx` so `View My Submissions` and `Back to Directory` use `rounded-lg` instead of pill styling in the success modal
  - Synced `task.md`, `changelog.md`, and `files.md` for this session change
  - Verified with `npm run build`

- [x] fix admin thumbnail generation client error (2026-03-12 17:05 UTC)
  - Updated `convex/thumbnailGenerator.ts` so the public admin action now verifies access and queues internal worker `_generateThumbnailForPackage`
  - Kept image composition on the private worker path to avoid the Convex runtime `Called by client` error from `ComponentDetailsEditor`
  - Updated `src/components/ComponentDetailsEditor.tsx` to send only defined action args and show `Thumbnail generation started`
  - Verified with `npx convex dev --once --typecheck disable` and `npm run build`

- [x] add component detail help modal (`prds/component-detail-help-modal.md`) (2026-03-09 22:22 UTC)
  - Added a small `How to get help` trigger below the rating block in `src/pages/ComponentDetail.tsx`
  - Added a lightweight help modal with author support guidance, Convex community link, and a muted third party component notice
  - Matched the existing overlay, close button, backdrop click, and `Escape` behavior used by other app modals

- [x] update AI review prompt to v5 with component source detection and split validator criteria (`prds/ai-review-prompt-v5.md`) (2026-03-09 21:16 UTC)
  - Updated `convex/aiReview.ts` so repo discovery prefers `defineComponent()` configs over consumer apps that only use `defineApp()`
  - Updated the default review prompt in both `convex/aiReview.ts` and `convex/aiSettings.ts` to v5 with component source discovery guidance and the split args-versus-returns validator criteria
  - Updated the AI Review Settings help copy in `src/pages/Admin.tsx` to match the new 8 critical plus 5 advisory review model
  - Verified with `npx tsc -p convex/tsconfig.json --noEmit --pretty false` and `npm run build`, which matches the Netlify build command in `netlify.toml`
  - Added shared prompt metadata in `shared/aiReviewPromptMeta.ts` so `aiReview.ts`, `aiSettings.ts`, and the Admin prompt UI all show the same review version label and updated date

- [x] fix Tremendous reward custom recipient messages (`prds/tremendous-custom-message-delivery.md`) (2026-03-09 20:58 UTC)
  - Forwarded the optional reward note from `convex/payments.ts` into Tremendous `delivery.meta.message` so recipient emails and landing pages can show custom copy
  - Kept the existing reward payload shape, payment recording flow, and no-note behavior unchanged by only sending the message when a trimmed note exists
  - Updated the Admin reward and test reward modal labels in `src/pages/Admin.tsx` to clarify the field is recipient-facing
  - Verified with `npm run build`

- [x] rebalance submit table columns and move published date into expanded submission details (`prds/submit-table-published-column-and-alignment.md`) (2026-03-09 08:03 UTC)
  - Removed the desktop `Published` column from `src/pages/Submit.tsx`
  - Rebalanced the desktop metadata columns so `Maintainer`, `Downloads`, `Submitted`, and `Status` use equal widths
  - Moved published date visibility into the expanded submission details panel
  - Verified with `npm run build`

- [x] harden package write auth and add profile logo upload (`prds/profile-logo-upload-and-package-write-auth.md`) (2026-03-09 06:25 UTC)
  - Hardened package write APIs in `convex/packages.ts` so admin-only mutations require admin identity and shared logo writes now require package ownership or admin access
  - Moved system-only package writes for submit, refresh, and AI review flows onto internal mutations so background jobs still work without exposing unsafe public write paths
  - `submitPackage` now derives submission ownership from the authenticated email before creating a package
  - Added logo upload, replace, and clear controls to the edit modal in `src/pages/Profile.tsx`
  - Extended `getMySubmissionForEdit` to return `logoUrl` for the profile editor
  - Verified with `npx convex codegen` and `npm run build`

- [x] default submit form packages to Community in Admin (`prds/submitted-components-default-community.md`) (2026-03-09 05:51 UTC)
  - Public submissions now create packages with `communitySubmitted: true` in `convex/packages.ts`
  - Existing Admin Actions and `ComponentDetailsEditor` state now load Community as enabled for newly submitted packages without extra UI logic
  - Verified with `npx convex codegen` and `npm run build`

- [x] implement review-state detail page gating (`prds/review-state-detail-page-gating.md`) (2026-03-09 01:58 UTC)
  - Added review-state robots behavior in `src/pages/ComponentDetail.tsx` so only approved pages are indexable while pending, in review, changes requested, and rejected stay `noindex, nofollow`
  - Gated `For Agents`, `AgentInstallSection`, download skill actions, and `SKILL.md` rendering to `in_review` and `approved`
  - Updated `netlify/edge-functions/og-meta.ts` so crawler-visible HTML gets the same robots directive as the client without changing badge or markdown route handling
  - Added small SEO helpers in `src/lib/seo.ts`, created `prds/review-state-detail-page-gating.md`, confirmed sitemap still points at approved packages only, and verified with `npm run build`

## Recent updates

- [x] Added admin delete controls for older AI review runs (2026-03-08 17:04 UTC)
  - Added `deleteAiReviewRun` mutation with a backend guard that blocks deletion of the latest saved review snapshot
  - Updated the AI review history drawer to let admins delete older runs from both the run list and the detail pane with confirmation
  - Verified with Convex codegen, Convex TypeScript checks, and production build

- [x] Added Escape key close support for AI review history drawer (2026-03-08 17:05 UTC)
  - Updated `AiReviewHistoryPanel` to close on `Escape`
  - Kept delete confirmation flow safe by ignoring drawer close on `Escape` while the confirm modal is open
  - Verified with production build

- [x] Added persistent AI review run history and admin review drawer (2026-03-08 06:06 UTC)
  - Added `aiReviewRuns` storage so previous AI review runs are preserved instead of being overwritten on `packages`
  - Added admin history query and right-side drawer with run list, score summary, provider metadata, criteria checklist, and raw model output
  - Verified with Convex codegen, Convex TypeScript checks, and production build

- [x] Unified font sizes between AI generated SEO content and long description markdown in ComponentDetail.tsx (2026-03-05 UTC)
  - Replaced `prose prose-sm` with explicit `text-sm text-text-secondary` selectors
  - Long description now matches SEO content styling
  - Changed "Made by" to "by" in author row

- [x] Updated "Live Demo URL" label to "Live Demo URL or Example App" in SubmitForm.tsx and ComponentDetailsEditor.tsx (2026-03-05 17:45 UTC)

- [x] Fixed long package name overflow in ComponentDetail author row (2026-03-05 15:30 UTC)
  - Added `flex-wrap` to author row so items wrap gracefully instead of overflowing
  - Added `truncate max-w-[280px] sm:max-w-none` to repo name link (truncates on mobile, full on desktop)
  - Added `title` attribute for hover tooltip showing full name when truncated

- [x] Fixed long description markdown rendering and added submit form mini preview (2026-03-05 23:08 UTC)
  - `ComponentDetail.tsx`: long description markdown now preserves line breaks and uses purple links (`#8D2676`) with hover underline
  - `SubmitForm.tsx`: long description now includes safe markdown support guidance and live mini markdown preview
  - Supports headings, bullet lists, line breaks, and markdown links in author-facing submit flow

- [x] Implemented MCP Additive Rollout Phase 1 (2026-03-03 18:00 UTC)
  - Added MCP protocol endpoint at `/api/mcp/protocol` with JSON-RPC 2.0 interface
  - Implemented `initialize`, `tools/list`, and `tools/call` methods
  - Added 5 tools: `search_components`, `get_component`, `get_install_command`, `get_docs`, `list_categories`
  - Added Cursor install link endpoints: `/api/mcp/cursor-install` (global) and `/api/mcp/cursor-install-component` (per-component)
  - Updated `AgentInstallSection` with Cursor install button and config copy
  - Added MCP capability sections to `/api/llms.txt` and `/api/markdown-index`
  - All endpoints log to `mcpApiLogs` table with tool, slug, query, and timing data
  - Preserved all existing routes and UI unchanged
  - PRD: `prds/mcp-additive-rollout-phase1.md`

- [x] Added runtime AI provider failover across admin settings and environment vars (2026-03-04 02:29 UTC)
  - Added `convex/aiProviderFallback.ts` for candidate chain building and sequential fallback execution
  - Added `_getProviderSettingsForFallback` internal query in `convex/aiSettings.ts`
  - Updated `convex/aiReview.ts` and `convex/seoContent.ts` to try active admin, backup admin, then env providers on runtime failures
  - Regenerated Convex bindings (`convex/_generated/api.d.ts`) via `npx convex codegen`
  - Verified via Convex codegen and TypeScript checks

- [x] Fixed TypeScript errors in AgentInstallSection.tsx (2026-03-03 09:30 UTC)
  - Removed undefined `PromptComponentData` type reference
  - Made `npmUrl`, `version`, `description`, `weeklyDownloads` required in local interface
  - Build verified passing (tsc and npm run build)

- [x] Synced Status Legend, Visibility Guide, and Badges across Profile.tsx, Submit.tsx, and Admin.tsx (2026-03-03 09:15 UTC)
  - Profile.tsx: removed Archived and Pending Deletion from Visibility Guide
  - Profile.tsx: added Featured status, updated rejected icon to Prohibit for consistency
  - Profile.tsx: removed DeletionBadge component and markedForDeletion SubmissionCard props
  - Profile.tsx and Submit.tsx: added Badges section (Convex Verified, Community)
  - Verified all three pages share identical status definitions and styling
  - Build verified passing (tsc and npm run build)

- [x] Rebuilt Footer.tsx to match official Convex.dev footer design (2026-03-03 08:25 UTC)
  - Dark background (`#141414`) with Convex design system tokens
  - White Convex wordmark logo, 4 link columns (Product, Developers, Company, Social)
  - Social icons from `/public/*.svg`, external links with `ExternalLinkIcon`
  - "A Trusted Solution" section with green checkmark badges (SOC 2, HIPAA, GDPR)
  - Responsive grid layout, dynamic copyright year
  - Fixed asset paths for Vite base URL (`/components/` prefix)
  - Original footer saved as `FooterBackup.tsx`

- [x] Updated Directory sort label text from "Verified first" to "Verified" and revalidated production build (2026-03-03 07:52 UTC)
  - Updated desktop and mobile sort display labels in `src/pages/Directory.tsx`
  - Confirmed `npm run build` passes for Netlify style output

- [x] Added Related Components section to component detail pages (2026-03-03 07:29 UTC)
  - New `getRelatedComponents` query scoring by category, tags, and downloads
  - Compact no-thumbnail cards (max 3) below View llms.txt with border divider
  - New `showRelatedOnDetailPage` admin setting with toggle in AI Review Settings panel (on by default)
  - Updated `getAdminSettings` and `updateAdminSetting` to support new key
  - Updated `files.md`, `changelog.md`, and `task.md`
  - Build verified passing

- [x] Added Component Authoring Challenge banner to Directory page (2026-03-03 07:15 UTC)
  - Created `src/components/ChallengeBanner.tsx` with dark background, grid texture, and pink bordered CTA button
  - Uses inline SVG data URL based on `public/banner-grid.svg` with boosted stroke visibility for dark backgrounds
  - Placed above FAQSection in `src/pages/Directory.tsx`
  - Updated `files.md`, `changelog.md`, and `task.md`
  - Build verified passing

- [x] Fixed Convex return validator mismatch for private message thread payloads (2026-03-03 06:44 UTC)
  - Updated `getPackageComments` return validator in `convex/packages.ts` to include optional `statusUpdatedAt`
  - Resolved runtime `ReturnsValidationError` caused by archived or hidden message records
  - Verified with local build and Convex function validation

- [x] Updated Directory badge placement for community-only component cards (2026-03-03 06:32 UTC)
  - Adjusted `src/components/ComponentCard.tsx` so Community-only listings render in the same right-side badge slot as Verified
  - Preserved dual-badge order when both badges are present (Community then Verified)
  - Verified with production build

- [x] Added hidden or archived message toggle and restore controls in Profile and Admin message modals (2026-03-03 06:32 UTC)
  - Added `Show hidden or archived` toggle in both modals
  - Added `Restore` action for owned hidden and archived messages
  - Updated backend message queries to support optional `includeInactive`
  - Confirmed admin own notes deletion remains enforced in backend and UI

- [x] Fixed private message routing and ownership controls between Profile and Admin (2026-03-03 06:24 UTC)
  - Profile requests now write to private `packageComments` message thread
  - Admin `Comments` panel now represents private submitter/admin messages, not public frontend comments
  - `Submit.tsx` no longer renders package comments publicly
  - Added message lifecycle controls for authored messages: hide, archive, delete
  - Enforced backend authorization for note/comment ownership operations

- [x] Published team handoff guide for WorkOS Connect with Convex and Netlify (2026-03-03 01:28 UTC)
  - Updated `prds/workos-convex-environment-runbook.md` with final working configuration and explicit route policy
  - Added `prds/workos-connect-convex-netlify-how-to.md` with development, staging, and production setup sections
  - Included route matrix for public, authenticated, admin, and non app alias routes
  - Excluded secrets and used placeholders for safe sharing in Notion

- [x] Added Community badge toggle to Admin Actions row (2026-03-03)
  - Added `communitySubmitted` prop to `InlineActions` component
  - Added `handleToggleCommunity` handler calling `updateComponentDetails` mutation
  - Added Community toggle button with `Users` icon and Community badge color scheme
  - Button positioned next to Convex Verified toggle in Actions row
  - Passed `communitySubmitted` prop through to `InlineActions` from package data
  - Build verified passing

- [x] Finalized Connect environment variable guidance after admin doc cross-check (2026-03-03 01:12 UTC)
  - Confirmed this app uses WorkOS Connect OAuth client credentials with AuthKit domain based OAuth endpoints
  - Validated local `.env.local` requires `VITE_WORKOS_CLIENT_ID`, `VITE_WORKOS_REDIRECT_URI`, and `VITE_WORKOS_AUTHKIT_DOMAIN`
  - Confirmed Convex dev and prod require `WORKOS_CLIENT_ID` and `WORKOS_AUTHKIT_DOMAIN`
  - Updated session docs to reflect Connect domain requirements in runbook and migration PRD

- [x] Switched app auth flow to WorkOS Connect OAuth with PKCE and Convex token bridge (2026-03-03 00:26 UTC)
  - Added `src/lib/connectAuth.tsx` provider and hook for OAuth authorize, callback exchange, token storage, and sign out
  - Updated `src/main.tsx` to use `ConnectAuthProvider` + `ConvexProviderWithAuthKit` with custom connect hook
  - Updated `src/lib/auth.tsx` to use connect `signIn`/`signOut` while keeping `useConvexAuth` auth state
  - Updated `convex/auth.config.ts` to validate JWT with `WORKOS_AUTHKIT_DOMAIN` issuer and `/oauth2/jwks`
  - Updated `.env.local` example and runbook with `VITE_WORKOS_AUTHKIT_DOMAIN` and `WORKOS_AUTHKIT_DOMAIN`
  - Removed direct `@workos-inc/authkit-react` dependency
  - Verification: `tsc -p convex`, `tsc -p .`, and `npm run build` passed

- [x] Migrated auth wiring from legacy Convex Auth to WorkOS AuthKit across frontend and Convex backend (2026-03-02 23:42 UTC)
  - Updated `src/main.tsx` provider stack to `AuthKitProvider` + `ConvexProviderWithAuthKit`
  - Updated `src/lib/auth.tsx` to use WorkOS `signIn` and `signOut`
  - Reworked `convex/auth.ts` admin and user checks to use `ctx.auth.getUserIdentity()`
  - Updated `convex/auth.config.ts` to WorkOS dual JWT providers with `WORKOS_CLIENT_ID`
  - Removed legacy auth coupling from `convex/http.ts` and `convex/schema.ts`
  - Updated `convex/packages.ts` ownership email resolution to identity claims
  - Verified with `npm run lint`

- [x] Added Community badge feature for community-submitted components (2026-03-02 12:00 UTC)
  - New `communitySubmitted` field on packages schema
  - Created `CommunityBadge` component with `#E9DDC2` background color
  - Badge appears between downloads and Verified on Directory cards
  - Badge appears below Verified and above downloads in ComponentDetail sidebar
  - Admin checkbox in ComponentDetailsEditor for toggling Community status
  - Updated all validators and helper functions (`directoryCardValidator`, `publicPackageValidator`, `adminPackageValidator`, `toPublicPackage`, `toAdminPackage`)
  - Updated queries (`listApprovedComponents`, `getFeaturedComponents`) and mutation (`updateComponentDetails`)
  - Passed through Admin.tsx `PackageComponentDetailsEditor` wrapper
  - Build verified passing

- [x] Fixed `View llms.txt` visibility when keywords are missing (2026-02-27 12:00 UTC)
  - Moved llms link out of the Keywords conditional in `src/pages/ComponentDetail.tsx`
  - Link now renders whenever component links are available, regardless of tags
  - Verified with `npx tsc -p . --noEmit --pretty false`

- [x] Synced session docs for pagination and markdown link updates (2026-02-27 12:00 UTC)
  - Updated `files.md` with Submit pagination APIs and admin setting query coverage
  - Updated PRD index in `files.md` with session PRDs
  - Updated `changelog.md` unreleased notes to reflect completed session documentation

- [x] Updated Netlify markdown alias PRD with centralized helper and local fallback notes (2026-02-27 12:00 UTC)
  - Documented why alias URLs are production-only and why localhost must use Convex API endpoints
  - Added guidance for shared URL helper usage to prevent route drift across frontend and Convex HTTP output
  - Captured verification matrix for local and production link behavior

- [x] Fixed localhost markdown and llms dropdown links after URL centralization (2026-02-27 12:00 UTC)
  - Added client-aware URL strategy in `shared/componentUrls.ts`
  - Localhost now resolves markdown and llms links to Convex HTTP endpoints
  - Netlify production remains on alias URLs backed by edge function and redirects
  - Verified with `npx tsc -p . --noEmit`, `npx tsc -p convex/tsconfig.json --noEmit`, and `npm run build`

- [x] Added Submit page pagination with admin default page size control (2026-02-27 12:00 UTC)
  - Added paginated public queries in `convex/packages.ts` for Submit list and search views
  - Added admin and public setting queries plus admin mutation for Submit default page size (`20`, `40`, `60`)
  - Updated `src/pages/Submit.tsx` to load paged results with Previous and Next controls
  - Updated `src/pages/Admin.tsx` with a new Settings panel to configure Submit default page size
  - Verified with `npx tsc -p convex -noEmit --pretty false` and `npx tsc -p . -noEmit --pretty false`

- [x] Centralized component markdown and llms URL generation (2026-02-27 12:00 UTC)
  - Added shared helper at `shared/componentUrls.ts` for detail, markdown alias, and llms URL construction
  - Updated `src/pages/ComponentDetail.tsx` dropdown with `Open markdown file`, `Open in ChatGPT`, `Open in Claude`, and `Open in Perplexity`
  - Added `View llms.txt` link below Keywords on component detail page
  - Updated `convex/http.ts` to use centralized URL generation in `/api/markdown-index` and `/api/component-llms`
  - Verified with `npm run build`, `npx tsc -p convex/tsconfig.json --noEmit`, and `npx tsc -p . --noEmit`

- [x] Kept markdown alias URL on Netlify domain (2026-02-27 12:00 UTC)
  - Added Netlify Edge Function mapping for `/components/*/*.md`
  - Added `netlify/edge-functions/component-markdown.ts` to resolve markdown by slug
  - Removed client-side redirect for markdown alias from router
  - Alias now serves markdown without switching browser URL to Convex domain

- [x] Added markdown alias URL support for component slugs (2026-02-27 12:00 UTC)
  - Added route handling for `/components/<slug>/<slug>.md`
  - Client router now redirects alias URL to Convex markdown endpoint
  - Keeps SPA/admin routes stable while providing markdown access path

- [x] Fixed Netlify SPA routing and GitHub avatar URLs (2026-02-27 12:00 UTC)
  - Fixed routes like `/components/submissions/admin` returning 404 markdown
  - Replaced greedy named-parameter redirect rules with explicit splat suffix rules:
    - `/components/*.md` for markdown
    - `/components/*/llms.txt` for per-component llms
  - Changed avatar URL format to `https://avatars.githubusercontent.com/{username}` (more reliable CDN)
  - Added `migrateAvatarUrls` admin mutation to fix existing database records
  - Main `/components/llms.txt` and `/components.md` still work

- [x] Created Tremendous Rewards Integration PRD (2026-02-27 12:00 UTC)
  - Full PRD at `prds/tremendous-rewards-integration.md`
  - Documents Tremendous API setup, SDK usage, and environment variables
  - Defines new `payments` table schema and package reward fields
  - Specifies Send Reward button placement in Admin Actions row
  - Includes PaymentBadge, RewardSettingsPanel, and auto-send feature specs
  - Links to official Tremendous docs: API reference, Node SDK, sandbox testing
  - Ready for implementation

- [x] Applied Convex return validator best practices to internal functions (2026-02-26 12:00 UTC)
  - Removed redundant `returns: v.null()` from 5 internal mutations (`_saveSeoContent`, `_updateSeoStatus`, `_setSeoError`, `_updateThumbnailJob`, `_saveGeneratedThumbnail`)
  - Removed `returns: v.union(v.null(), v.any())` from 2 internal queries (`_getPackage`, `_getPackageByName`)
  - Fixed `ctx.db.patch` API bugs in `seoContentDb.ts` (was incorrectly passing table name as first argument)
  - Fixed `ctx.db.get` API bug in `packages.ts` (was incorrectly passing table name before ID)
  - Added `.cursor/skills/convex-return-validators/SKILL.md` for future reference
  - No behavioral changes; TypeScript inference handles return types for internal functions

- [x] AI Review Results panel collapsed by default in Admin dashboard (2026-02-26 12:00 UTC)
  - Entire panel now collapsed by default, showing only status icon, label, and date
  - Single toggle expands/collapses all content (summary, error, and criteria)
  - Removed nested toggle (previously had outer panel + inner criteria toggle)
  - Copy button accessible on collapsed header row via stopPropagation
  - Reduces vertical space in admin package rows

- [x] Removed user visibility controls from Profile page (2026-02-26 12:00 UTC)
  - Removed Hide, Show, Delete, and Cancel Deletion buttons from user profile
  - Users must contact admin via "Send Request" to manage component visibility
  - Removed `ConfirmModal` component (no longer needed)
  - Removed `setVisibility`, `deleteSubmission`, `cancelDeleteSubmission` mutations from Profile
  - Removed `onHide`, `onShow`, `onDelete`, `onCancelDelete` props from SubmissionCard
  - Removed `ArrowCounterClockwise` icon import
  - Updated deletion message to guide users to contact admin
  - Admin retains full control via Admin dashboard
  - Build verified passing

- [x] Added Download Skill button for SKILL.md files (2026-02-25 12:00 UTC)
  - Download button with Phosphor FileArrowDown icon next to Markdown dropdown in author row
  - Button only appears when SKILL.md has been generated (after SEO content generation runs)
  - SKILL.md section now has both copy and download buttons
  - Downloads as `SKILL.md` file for easy saving to project
  - Uses browser Blob API for client-side file generation

- [x] Directory sidebar sticky position adjusted (2026-02-25 12:00 UTC)
  - Changed sticky top from `top-6` to `top-20` (80px from viewport top)
  - Submit button now remains visible below the header when scrolling
  - Entire sidebar (Submit, Search, Sort, Categories) stays sticky together

- [x] SEO Prompt Versioning and Multi-Provider AI support (2026-02-25 12:00 UTC)
  - Added `seoPromptVersions` table to schema for SEO prompt version history
  - Added SEO prompt queries/mutations to `convex/aiSettings.ts`: `getSeoDefaultPrompt`, `getSeoActivePrompt`, `getSeoPromptVersions`, `saveSeoPromptVersion`, `activateSeoPromptVersion`, `resetSeoToDefaultPrompt`
  - Added `DEFAULT_SEO_PROMPT` constant with placeholder substitution (e.g., `{{displayName}}`, `{{packageName}}`)
  - Updated `convex/seoContent.ts` to use custom prompt from database and support multi-provider (Anthropic, OpenAI, Gemini)
  - Added `callAiProvider` helper function for unified API calls across providers
  - Added `SeoPromptSettingsPanel` component to Admin Settings view
  - Panel includes: edit mode, version history, notes, restore, reset to default
  - Moved Refresh npm data and Generate Slug buttons from package card row to InlineActions Actions row
  - Removed standalone `RefreshNpmButton` and `GenerateSlugButton` components
  - Auto-refresh settings verified to update all package metadata fields (File Count, Weekly Downloads, etc.)
  - Multi-provider AI support works for ALL AI features (AI Review + SEO Content): both use same admin provider settings or env var fallback
  - Added confirmation modal for "Clear (use env)" buttons with danger styling and warning message

- [x] Added Actions row to Admin InlineActions panel (2026-02-25 12:00 UTC)
  - New "Actions" row above Status and Visibility rows in expanded package view
  - Convex Verified toggle button (teal, shows fill when verified)
  - Regenerate SEO + Skill button (shows spinner during generation, green when completed)
  - Combined Auto-fill button (fills author from GitHub and description from npm in parallel)
  - Hide Thumbnail toggle (orange, only shows when thumbnail exists, hides in category but shows in Featured)
  - Auto-fill shows what was filled in success toast
  - All buttons match existing Admin theme with Phosphor icons
  - Added useEffect hooks for author/avatar/verified field sync in ComponentDetailsEditor
  - PRD: `prds/admin-actions-row.md`

- [x] Added hide from submissions page feature for admin control (2026-02-25 12:00 UTC)
  - New `hideFromSubmissions` field on packages schema
  - `toggleHideFromSubmissions` mutation to toggle visibility on Submit.tsx
  - `listPackages` and `searchPackages` filter out hidden packages
  - Toggle button in Admin.tsx package row labeled "Sub Hide" / "Sub Hidden" to differentiate from directory Hide
  - Hidden packages still appear in Directory if approved
  - Admin panel shows all packages regardless of this setting
  - PRD: `prds/hide-from-submissions.md`

- [x] Added featured components sort order for admin control (2026-02-25 12:00 UTC)
  - New `featuredSortOrder` field on packages schema
  - `getFeaturedComponents` query sorts by `featuredSortOrder` (nulls last), then newest first
  - `setFeaturedSortOrder` mutation for admin to set order value
  - Sort order input in Admin.tsx next to Featured toggle (only shown when featured)
  - Dropdown sort (downloads, newest, etc.) does NOT affect Featured section order
  - PRD: `prds/featured-sort-order.md`

- [x] Added hide thumbnail in category option for components (2026-02-25 12:00 UTC)
  - New `hideThumbnailInCategory` field on packages schema
  - Checkbox in Admin Component Details editor (visible when thumbnail exists)
  - Thumbnails always shown in Featured section
  - Thumbnails hidden in category listings when checkbox is checked
  - Fixed: Added field to `directoryCardValidator` and query return maps (`listApprovedComponents`, `getFeaturedComponents`)
  - Updated `ComponentCard` with `showThumbnail` prop override
  - PRD: `prds/hide-thumbnail-in-category.md`

- [x] Imported 41 official Convex components to production database (2026-02-24 12:00 UTC)
  - Created `seedOfficialComponents` internal action with `importAsPending` and `dryRun` flags
  - Added `browser-use` component (AI category) and synced with convex.dev/components source
  - Renamed `_upsertSeededComponent` to `_upsertOfficialComponent` with improved logic
  - Preserves existing `reviewStatus` on updates, only sets new status on inserts
  - Returns detailed stats: total, created, updated, failed, dryRun, wouldImport
  - Legacy `seedExistingComponents` alias preserved for backward compatibility
  - Production import: 27 created as pending, 14 updated, 0 failed
  - Run: `npx convex run --prod seed:seedOfficialComponents '{"importAsPending": true}'`

- [x] Added pagination with configurable items per page to Admin panel (2026-02-24 12:00 UTC)
  - Package list now shows 20 items per page by default
  - Page navigation with Previous/Next buttons and numbered page buttons
  - Items per page dropdown (5, 10, 20, 40, 100) next to sort dropdown
  - Each filter tab (All, Pending, Review, Approved, Changes, Rejected, Deletion, Archived) maintains its own page state
  - "Showing X-Y of Z" counter updates based on current page and items per page
  - Page resets to 1 when changing filter or items per page
- [x] Reordered icons in Admin package rows (2026-02-24 12:00 UTC)
  - Moved ComponentDetailQuickLink (external link icon) to be last in the badge group
  - Order is now: StatusBadge, VisibilityBadge, UnrepliedNotesIndicator, ComponentDetailQuickLink
  - Icon remains before the downloads/date section on the far right
- [x] Added LLMs.txt and Markdown clean URL support (2026-02-24 12:00 UTC)
  - New `/api/markdown-index` endpoint for directory-wide markdown
  - New `/api/component-llms` endpoint for per-component llms.txt
  - Added 6 Netlify redirects for clean URLs: `/components/llms.txt`, `/components.md`, `/components/:slug/llms.txt`, `/components/:slug.md`, plus scoped package variants
  - All endpoints tested and working via Convex site URL
- [x] Moved Keywords section below Agent Skill (SKILL.md) section on ComponentDetail.tsx (2026-02-24 12:00 UTC)
  - Keywords tags now appear after the SKILL.md copyable snippet
  - Improves page hierarchy: SEO content > SKILL.md > Keywords
- [x] Moved Markdown dropdown to author row on ComponentDetail.tsx (2026-02-24 12:00 UTC)
  - Dropdown relocated from sidebar to main content area (author row)
  - Appears after author info with separator
  - Same functionality: View as Markdown, Copy as Markdown, Copy page URL
- [x] Commented out GitHub Issues feature on ComponentDetail.tsx (2026-02-24 12:00 UTC)
  - Issues badge button in author row commented out
  - Full issues panel (open/closed tabs, issue list, pagination) commented out
  - Code preserved for future re-enabling
- [x] Added clear logo button in Component Details editor (2026-02-24 12:00 UTC)
  - Clear button next to download button when logo exists
  - New `clearLogo` mutation in `convex/packages.ts` to remove logo URL and storage reference
  - Added `clearingLogo` state and `handleClearLogo` handler in `ComponentDetailsEditor.tsx`
  - Matches existing thumbnail clear functionality
- [x] Fixed SubmitForm.tsx success modal button layout (2026-02-23 12:00 UTC)
  - Buttons now display horizontally with `flex-row` instead of stacked
  - Improved spacing with `gap-3` and `inline-flex` for alignment
  - Changed font weight to medium and text color to primary for outline button
- [x] Fixed SubmitForm.tsx tags validator mismatch (2026-02-23 12:00 UTC)
  - Backend `submitPackage` expects `tags: v.optional(v.string())` (comma-separated string)
  - SubmitForm.tsx was incorrectly sending tags as an array
  - Changed to `tags.trim() || undefined` to match the validator
  - Fixes "ArgumentValidationError: Value does not match validator" on live site submissions
- [x] Enhanced SEO support for ComponentDetail pages (2026-02-24 12:00 UTC)
  - Added Twitter Card meta tags (summary_large_image with thumbnail)
  - Added canonical URL tag for duplicate content prevention
  - Added og:site_name and og:image:alt tags for better sharing
  - New `setComponentSeoTags()` consolidated helper in seo.ts
  - New `setTwitterTags()` and `setCanonicalUrl()` functions
  - Fixed index.html Twitter meta tags (changed `property` to `name`)
  - Updated index.html URLs to production domain ([www.convex.dev/components](http://www.convex.dev/components))
- [x] AI Provider Settings and Prompt Versioning feature (2026-02-23 12:00 UTC)
  - Added `aiProviderSettings` and `aiPromptVersions` tables to schema
  - Created `convex/aiSettings.ts` with provider and prompt management functions
  - Updated `convex/aiReview.ts` to support Anthropic, OpenAI, and Google Gemini
  - Added `AiProviderSettingsPanel` in Admin Settings (API key, model, docs links)
  - Added `AiPromptSettingsPanel` in Admin Settings (edit, version history, restore)
  - Environment variables still work as default fallback
  - PRD: `prds/ai-provider-settings-and-prompt-versioning.md`
- [x] Commented out badge section on ComponentDetail.tsx until endpoint is working (2026-02-23 12:00 UTC)
  - "Add badge to your README" UI section hidden
  - Badge markdown line in buildMarkdownDoc function also commented out
  - Ready to re-enable when badge feature is implemented
- [x] Added auto-fill description button in Component Details editor (2026-02-23 12:00 UTC)
  - "Auto-fill from Package" button next to Long Description field
  - Copies npm/repo description from Package Metadata into Long Description
  - Admin can then edit the description before saving
  - Updated `ComponentDetailsEditor.tsx` with new `npmDescription` prop
  - Updated `PackageComponentDetailsEditor` in Admin.tsx to pass `pkg.description`
- [x] Fixed production legacy GitHub OAuth "Missing sign-in verifier" error (2026-02-23 12:00 UTC)
  - Updated the legacy auth package to resolve verifier handling
  - Configured GitHub OAuth callback URL: `https://giant-grouse-674.convex.site/api/auth/callback/github`
  - Generated production JWT keys with the legacy auth CLI
  - Set `SITE_URL` to `https://components-directory.netlify.app/components`
  - Created `prds/authfix-2026-02-23.md` documenting the fix
- [x] Added router redirect for paths without `/components` prefix (2026-02-23 12:00 UTC)
  - `/dodo` now redirects to `/components/dodo`
  - Ensures consistent URL structure across local and production
  - Updated `prds/routes-components-fix.md` with new redirect behavior
- [x] Moved FAQSection from Submit.tsx to Directory.tsx (2026-02-23 12:00 UTC)
  - FAQ now displays below component cards on the main directory page
  - Removed from submissions page
  - Updated heading font to `font-semibold` to match "Components" section heading
- [x] Expanded FAQSection to 8 questions (2026-02-23 12:00 UTC)
  - Added: sandboxing, what projects should use, pricing
  - Updated "Can I build my own?" with fuller text
  - Updated "What happens after I submit?" with authoring guidelines link
  - Updated `prds/faq-questions.md` to match
- [x] Added site footer with Convex links (2026-02-23 12:00 UTC)
  - Created `src/components/Footer.tsx` component
  - Convex wordmark logo (40px height) on the left linking to convex.dev
  - GitHub repo and Discord links on the right
  - 50px top padding above footer
  - Responsive layout for mobile/desktop
  - Integrated into global layout in `src/main.tsx`
- [x] Fixed user email not appearing in profile/submissions after legacy GitHub OAuth (2026-02-23 12:00 UTC)
  - Legacy auth stored user data in database rather than JWT claims
  - Added legacy user id lookup helper to fetch user email from database
  - Updated `loggedInUser` and `isAdmin` queries to use database lookup
  - Updated `requireAdminIdentity` and `getAdminIdentity` helpers
  - Added `getCurrentUserEmail` helper in packages.ts
  - Updated all queries/mutations that used `ctx.auth.getUserIdentity()` for email
  - Submissions now correctly match by email from the users table
- [x] Verified GitHub OAuth sign-in flow works end to end (2026-02-23 12:00 UTC)
- [x] Verified admin access for `wayne@convex.dev` at `/components/submissions/admin` (2026-02-23 12:00 UTC)
- [x] Set `SITE_URL` to `http://localhost:5173/components` for correct OAuth redirect (2026-02-23 12:00 UTC)
- [x] Migrated authentication from an older auth provider to a prior legacy GitHub auth stack (2026-02-23 12:00 UTC)
  - Replaced the previous auth integration with a GitHub OAuth based stack
  - Updated `convex/auth.ts` to use provider based OAuth wiring
  - Created `convex/auth.config.ts` for JWT provider configuration
  - Deleted `convex/convex.config.ts` (not needed for that legacy auth stack)
  - Deleted `convex/auth/session.ts` (legacy compatibility cleanup)
  - Updated `convex/http.ts` to use `auth.addHttpRoutes(http)`
  - Updated `convex/schema.ts` to include legacy auth tables
  - Updated `src/main.tsx` with legacy auth provider wiring
  - Updated `src/lib/auth.tsx` with legacy auth action hooks and `useConvexAuth`
  - Added redirect logic in Router for paths not starting with `/components`
  - Generated and set legacy JWT signing environment variables in Convex Dashboard
  - Restored `as any` type casts in `convex/crons.ts` and `convex/http.ts` for type inference issues
  - Cleared Vite dependency cache (`node_modules/.vite`) to fix 504 Outdated Optimize Dep error
  - Added `jose` dev dependency for JWT key generation
- [x] Migrated from Convex self-hosting to Netlify (2026-02-23 12:00 UTC)
  - Removed `@convex-dev/self-hosting` dependency
  - Simplified `convex/convex.config.ts` (no components)
  - Removed `registerStaticRoutes()` from `convex/http.ts`
  - Deleted `.env.production` (use Netlify Dashboard env vars)
  - Changed `vite.config.ts` to `base: "/"` for asset serving
  - Updated `netlify.toml` with proper SPA routing redirects
  - Production URL: `https://components-directory.netlify.app`
  - WorkOS callback: `https://components-directory.netlify.app/components/callback`
- [x] SKILL.md generation for AI agent integration (2026-02-23 12:00 UTC)
  - AI SEO content generation now also generates SKILL.md content
  - SKILL.md follows Agent Skills specification with YAML frontmatter and Markdown body
  - Includes component description, installation, usage patterns, key features, API reference
  - Copyable SKILL.md snippet on ComponentDetail.tsx (above badge section)
  - "SKILL.md generated" status indicator in admin ComponentDetailsEditor
  - Button text updated to "Generate SEO + Skill" / "Regenerate SEO + Skill"
  - Added `skillMd` field to packages schema
  - Added `buildSkillMd()` helper in `convex/seoContent.ts`
  - Updated `_saveSeoContent` in `convex/seoContentDb.ts` to persist skillMd
  - Updated `publicPackageValidator` and `toPublicPackage()` in `convex/packages.ts`
  - Updated ComponentDetail.tsx with copy button and pre-formatted display
  - Updated ComponentDetailsEditor.tsx with skillMd prop and status display
  - Updated Admin.tsx to pass skillMd prop to editor
- [x] Configured Netlify SPA routing for /components/ (2026-02-23 12:00 UTC)
  - Router in `src/main.tsx` strips `/components` prefix for route matching
  - `netlify.toml` redirects `/` to `/components` (301)
  - `netlify.toml` redirects `/components` and `/components/*` to `/index.html` (200)
  - Netlify env vars required: `VITE_CONVEX_URL`, `VITE_WORKOS_CLIENT_ID`, `VITE_WORKOS_REDIRECT_URI`
- [x] Slug Migration Tool for admin dashboard (2026-02-23 12:00 UTC)
  - Added `SlugMigrationPanel` component to Admin Settings tab
  - Displays count and list of packages missing URL slugs
  - "Generate All Slugs" button for bulk slug generation
  - Individual "Generate" button per package in the migration panel
  - Added `GenerateSlugButton` component to package cards (orange, next to npm/repo/demo/refresh)
  - Button only shows when package has no slug, disappears after generation
  - New backend functions: `getPackagesWithoutSlugs`, `generateSlugForPackage`, `generateMissingSlugs`
  - Added `LinkSimple` icon import from phosphor-icons
- [x] Fixed ComponentDetailsEditor reactive slug sync (2026-02-23 12:00 UTC)
  - Added `useEffect` hook to sync local slug state when `initialSlug` prop changes from backend
  - Slug now appears immediately after clicking "Generate Slug" without needing page refresh
  - Matches existing reactive behavior for thumbnail, logo, and template fields
- [x] Soft deletion workflow for components (2026-02-23 12:00 UTC)
  - Users mark components for deletion instead of immediate delete
  - Components marked for deletion are hidden from directory immediately
  - "Pending Deletion" badge shown on marked components in Profile
  - Users can cancel deletion request via "Cancel Deletion" button
  - Added schema fields: `markedForDeletion`, `markedForDeletionAt`, `markedForDeletionBy`
  - Added `by_marked_for_deletion` index on packages table
  - Updated `requestDeleteMySubmission` to mark for deletion instead of delete
  - Added `cancelDeleteMySubmission` mutation for users to undo deletion
  - Added `_permanentlyDeletePackage` internal mutation
  - Updated public queries to exclude marked-for-deletion packages
- [x] Account deletion requires deleting all components first (2026-02-23 12:00 UTC)
  - Delete Account modal shows warning if user has active submissions
  - User must delete all components before deleting their account
  - `deleteMyAccount` mutation now throws error if active submissions exist
  - Updated Account section and modal text to explain new flow
- [x] Admin Deletion Management panel in Settings (2026-02-23 12:00 UTC)
  - Added `DeletionManagementPanel` component to Admin.tsx Settings tab
  - Toggle for auto-delete marked packages (`autoDeleteMarkedPackages` setting)
  - Configurable waiting period (1, 3, 7, 14, or 30 days)
  - List of packages pending deletion with "Delete Now" button
  - Added `adminPermanentlyDeletePackage` mutation for admin manual deletion
  - Added `getPackagesMarkedForDeletion` query
  - Added `getDeletionCleanupSettings` query
  - Added `updateDeletionCleanupSetting` mutation
- [x] Admin "Marked for Deletion" filter tab (2026-02-23 12:00 UTC)
  - Added "Deletion" tab to Admin filter bar with Clock icon
  - Tab shows count of packages marked for deletion
  - Filter displays only packages with `markedForDeletion: true`
  - Package rows show red "Deletion" badge next to visibility badge when marked
  - Updated `VisibilityBadge` component to accept `markedForDeletion` prop
- [x] Updated Profile.tsx deletion badge display (2026-02-23 12:00 UTC)
  - "Pending Deletion" badge now shown next to status and visibility badges
  - Badges no longer conditionally hidden when marked for deletion
- [x] Scheduled deletion cleanup cron job (2026-02-23 12:00 UTC)
  - Added `cleanup-marked-for-deletion` cron job in `convex/crons.ts`
  - Runs daily at 2 AM UTC
  - Deletes packages past the configurable waiting period
  - Gated by `autoDeleteMarkedPackages` admin setting
  - Added `scheduledDeletionCleanup` internal mutation
- [x] Header floating pill redesign (2026-02-23 12:00 UTC)
  - Floating pill design with `rounded-full`, white/95 background, backdrop blur, and shadow
  - Convex wordmark black SVG logo (70px height)
  - Added GitHub, Discord, and Docs icons to right side of header
  - Navigation links (Directory, Submissions, Submit) with medium font weight
  - Removed user email from profile dropdown
  - Header height: 3.438rem
  - Mobile menu fixed: separate dropdown card below header pill (rounded-2xl)
- [x] SubmitForm.tsx layout improvements (2026-02-23 12:00 UTC)
  - Removed "Back to Directory" breadcrumb link
  - Moved "Submit a Component" title above the form box to match Profile.tsx style
  - Description text remains inside the form box
- [x] FAQSection component extraction and expansion (2026-02-22 12:00 UTC)
  - Extracted FAQ section from SubmitForm.tsx into reusable `src/components/FAQSection.tsx`
  - Added FAQSection to bottom of Submit.tsx (submissions directory page)
  - Expanded FAQ content with new questions:
    - How are components sandboxed?
    - Can I build my own?
    - Do components cost money to use?
  - Updated review process answer to mention rolling basis review
  - Updated requirements answer to remove demo requirement
- [x] Page layout alignment (2026-02-22 12:00 UTC)
  - Submit.tsx page width now matches Directory.tsx (`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`)
  - SubmitForm.tsx page width now matches Profile.tsx (`max-w-3xl`)
  - Submit.tsx title "Components Submissions Directory" styled to match Directory.tsx
  - Search input background changed to white on Submit.tsx
- [x] Convex self-hosting integration (2026-02-22 12:00 UTC)
  - Installed `@convex-dev/self-hosting` for static file serving at `giant-grouse-674.convex.site`
  - Created `convex/convex.config.ts` to register the self-hosting component
  - Created `convex/staticHosting.ts` to expose upload APIs for the CLI
  - Updated `convex/http.ts` with `registerStaticRoutes()` (preserves existing API routes)
  - Updated `vite.config.ts` with environment-aware base path (`SELF_HOST=true` uses `/`)
  - Added `deploy` script: `SELF_HOST=true npx @convex-dev/self-hosting deploy`
  - Added `deploy:static` script: `SELF_HOST=true npx @convex-dev/self-hosting upload --build --prod`
  - Updated `files.md` with new files and modified descriptions
  - WorkOS production setup: Add `https://giant-grouse-674.convex.site/callback` to WorkOS dashboard
  - Convex production setup: Set `WORKOS_CLIENT_ID` env var in Convex dashboard
- [x] Auto sign-in redirect for `/submit` page (2026-02-22 12:00 UTC)
  - Unauthenticated users visiting `/submit` now auto-redirect to WorkOS sign-in
  - `useEffect` hook in `SubmitForm.tsx` triggers `signIn()` automatically when not authenticated
  - Stores current path in localStorage before redirect
  - `AuthCallback` reads stored path and returns user to `/submit` after auth
  - Replaced sign-in gate UI with "Redirecting to sign in..." loading spinner
- [x] Mark as read notifications (2026-02-22 12:00 UTC)
  - Added `adminHasRead` field to `packageNotes` and `packageComments` schemas
  - Admin Notes panel auto-marks user notes as read when opened
  - Admin Comments panel auto-marks comments as read when opened
  - User Profile Messages modal shows unread count and "Mark all read" button
  - Notes button shows blue badge for unread user notes (red for unreplied requests)
  - Comments button shows blue badge for unread comments
  - Added `markNotesAsReadForAdmin`, `markCommentsAsReadForAdmin` mutations
  - Added `getUnreadUserNotesCount`, `getUnreadCommentsCount` queries
- [x] Admin submitter email editor (2026-02-22 12:00 UTC)
  - Added `SubmitterEmailEditor` component in Admin panel for editing submitter emails
  - Admin can edit primary submitter email to link submissions to user accounts
  - Admin can add additional emails for multi-account access
  - Added `updateSubmitterEmail` mutation for changing primary email
  - Useful for submissions created before auth was added
- [x] Admin page UX improvements (2026-02-22 12:00 UTC)
  - Changed sign-in message from "Sign in with your @convex.dev email..." to "Admin access only"
  - Non-admin users are now automatically redirected to `/profile` instead of seeing "Access Denied"
  - Added `RedirectToProfile` component for seamless redirect with loading spinner
- [x] User profile enhancements (2026-02-22 12:00 UTC)
  - Fixed duplicate "My Submissions" title and "Submit New" button
  - Added user-controlled visibility: hide/show submissions from directory
  - Added delete submission with confirmation modal
  - Added edit submission modal (component name, description, category, tags, demo/video URLs)
  - Added additionalEmails field to schema for multi-account access
  - Updated getMySubmissions to check both submitterEmail and additionalEmails
  - Added visibility guide to status guide section
  - Users can now manage only their own submissions
- [x] Changed admin route from `/submit/admin` to `/submissions/admin` (2026-02-22 12:00 UTC)
  - Admin dashboard now accessible at `/submissions/admin`
  - Note: WorkOS JWT template must include `"email": {{ user.email }}` for admin auth to work
- [x] Fixed WorkOS AuthKit sign-in flow (2026-02-22 12:00 UTC)
  - OAuth callback component now waits for AuthKit session before redirecting to `/submit`
  - Sign-in buttons call `signIn()` directly per Convex WorkOS docs
  - Added `VITE_WORKOS_REDIRECT_URI` env variable for explicit redirect configuration
  - Removed `getSignInUrl()` workaround in favor of direct `signIn()` calls
  - Profile page sign-in now works correctly
- [x] Reorganized submission routes (2026-02-22 12:00 UTC)
  - `/submissions` = Submit.tsx (public table-based directory with Header)
  - `/submissions/admin` = Admin.tsx (requires @convex.dev email)
  - `/submit` = SubmitForm.tsx (auth-gated form)
  - Submit button on directory links to `/submit` form page
  - Added Submissions link to Header navigation

### WorkOS JWT Template Configuration Required

For admin auth to work, configure your WorkOS JWT template to include the email claim:

1. Go to WorkOS Dashboard > Authentication > Sessions > Configure JWT Template
2. Add these claims to your template:
  ```json
   {
     "email": {{ user.email }},
     "name": "{{ user.first_name }} {{ user.last_name }}"
   }
  ```
3. Save and sign out/in to get a new token

- [x] SubmitForm.tsx layout update (2026-02-22 12:00 UTC)
  - Checkboxes moved inside form, above submit button
  - Submit button disabled until all 3 checkboxes checked
  - FAQ section below form, Terms links at bottom
- [x] Refactored auth flow with shared Header component (2026-02-22 12:00 UTC)
  - Created `src/components/Header.tsx` with global navigation and user menu
  - Header displays on all pages: Directory, Submit, Profile, Admin, ComponentDetail, NotFound
  - User menu shows avatar, email, My Submissions link, Sign Out button
  - Sign In button for unauthenticated users
- [x] Submit form refactored to dedicated page (2026-02-22 12:00 UTC)
  - Replaced `Submit.tsx` modal approach with `SubmitForm.tsx` page
  - Auth gate: shows sign-in UI for unauthenticated users
  - Full form for authenticated users
  - Success modal links to profile page
- [x] WorkOS AuthKit integration replacing the legacy auth stack (2026-02-22 12:00 UTC)
  - Installed `@workos-inc/authkit-react` and `@convex-dev/workos`
  - Configured `convex/auth.config.ts` with WorkOS JWT providers
  - Updated admin authorization to use `ctx.auth.getUserIdentity()`
  - Dynamic Vite base path (`/` local, `/components/` production)
- [x] User profile page at `/profile` for managing submissions (2026-02-22 12:00 UTC)
  - Lists user's submitted components with status badges
  - "Send Request" button to message admin team
  - `getMySubmissions` query and `requestSubmissionRefresh` mutation
  - `by_submitter_email` index on packages table
- [x] OAuth callback redirect to `/submit` (2026-02-22 12:00 UTC)
- [x] Add submission checklist with 3 checkboxes (FAQ, Authoring Components compliance, permission to share)
- [x] Add FAQ section to Submit page with 4 questions about review process, requirements, post-submission, and learning resources
- [x] Add Terms of Service and Privacy Policy links on Submit page
- [x] Add clear thumbnail option in admin `ComponentDetailsEditor`
- [x] Persist thumbnail removal on Save by wiring `clearThumbnail` through `updateComponentDetails`

## Components Directory Expansion (v2.0.0)

- [x] Update packages schema with directory fields (slug, category, tags, descriptions, thumbnail, author, verified)
- [x] Add new indexes (by_slug, by_category, by_category_and_visibility)
- [x] Add badgeFetches table for badge analytics
- [x] Build public queries (listApprovedComponents, getComponentBySlug, listCategories, getFeaturedComponents)
- [x] Build admin mutation (updateComponentDetails)
- [x] Build thumbnail upload mutations (generateUploadUrl, saveThumbnail)
- [x] Build autoFillAuthorFromRepo mutation
- [x] Build internal queries (getPackageBySlug, recordBadgeFetch, getBadgeStats)
- [x] Restructure frontend into src/pages/ and src/components/
- [x] Update client-side router for /, /submit, /submit/admin, /:slug routes
- [x] Build Directory.tsx page with search, sort, categories, featured section
- [x] Build ComponentDetail.tsx page with sidebar + content layout
- [x] Build ComponentCard.tsx, CategorySidebar.tsx, SearchBar.tsx, VerifiedBadge.tsx, InstallCommand.tsx
- [x] Build ComponentDetailsEditor.tsx for admin
- [x] Create categories.ts, slugs.ts, seo.ts lib files
- [x] Add dynamic SVG badge HTTP endpoint (/api/badge)
- [x] Add markdown HTTP endpoint (/api/markdown) for agents and LLMs
- [x] Add Share dropdown with View as Markdown, Copy as Markdown, Copy page URL
- [x] Add markdown source view with copy button
- [x] Update submission form with category, descriptions, tags, video URL, thumbnail upload
- [x] Auto-open submit modal from directory sidebar link
- [x] Add admin thumbnail preview in package list
- [x] Fix slug 404 for admin-created slugs (relaxed visibility check)
- [x] Fix auto-fill to update UI instantly without manual toggle
- [x] Fix Back to Components trailing slash
- [x] Remove invalid border-border-primary classes
- [x] Update dropdown styling to match design system
- [x] Move verified badge below downloads in cards
- [x] Redesign component detail page layout (sidebar left, content right)
- [x] Link authorUsername to GitHub profile
- [x] Make thumbnail half-width and left-aligned
- [x] Left-align badge snippet section
- [x] Rename Copy page to Share
- [x] Set Vite base path to /components/
- [x] Build seed script for existing components
- [x] Update files.md with all new files
- [x] Update changelog.md with v2.0.0 entry
- [x] Update task.md with directory expansion tasks

## Previous Tasks

- [x] Update README.md to focus on Convex Components Challenge
- [x] Switch to WorkOS AuthKit (completed 2026-02-22)
- [x] Change submit button back to DF5D34
- [x] Add link to demo app on form and admin
- [x] Remove open graph url link
- [x] Push to GitHub
- [x] Add submit collects users names and email and Convex Discord name
- [x] Admin sees name and admin Convex Discord name
- [x] Add About modal with app description and status legend
- [x] Add Featured status for packages
- [x] Add Status legend bar above footer
- [x] Remove login/signup from frontend header
- [x] Add AI Review feature for validating Convex components
- [x] Update changelog.md with correct dates from git history
- [x] Update files.md with current file descriptions
- [x] Run TypeScript type checks
- [x] Verify build readiness
- [x] Add refresh NPM data button
- [x] Streamline frontend layout for iframe embedding
- [x] Move toolbar controls above package listing
- [x] Update modals to open at top of page
- [x] Simplify Admin page header
- [x] Move Admin status legend below Stats section
- [x] Fix external links to open in new tabs in iframes
- [x] Fix success modal display after submission
- [x] Add email privacy notice to submit form
- [x] Security fix: Strip PII from public queries
- [x] Security fix: Exclude AI review details from public responses
- [x] Security fix: Create internal queries for backend operations
- [x] Security fix: Rename reviewerEmail to reviewedBy
- [x] Updated sec-check.mdc with RLS patterns
- [x] Added AI-Assisted Development Security section
- [x] Added Convex Auth Token Security section
- [x] Added Dependency and Supply Chain Security section
- [x] Enhanced security checklist

## Review Status Flow

1. New submissions are marked as "pending" by default and visible on the frontend
2. Admins can change status to: pending, in_review, approved, changes_requested, rejected
3. Admins can change visibility to: visible, hidden, archived
4. Only hidden and archived packages are excluded from the public frontend
5. Only approved packages can be marked as "Featured"
6. Featured packages show a star icon and are highlighted on convex.dev/components

## AI Review Flow

1. Admin clicks "AI Review" button on a package (requires GitHub repository URL)
2. System fetches source code from GitHub (convex.config.ts + component files)
3. Claude analyzes code against 9 Convex component criteria
4. Results show passed/failed/partial status with detailed notes
5. Auto-approve triggers if all criteria pass (when enabled)
6. Auto-reject triggers if critical criteria fail (when enabled)

- 

## Prod release checklist for directory sort refresh

- [ ] Confirm local changes are merged and pushed
- [ ] Deploy backend and frontend
  - `npx convex deploy`
  - `npm run build` (or your normal frontend deploy flow)
- [ ] Run one time production backfill
  - `npx convex run packages:backfillPackageReliabilityFields '{}' --prod`
- [ ] Verify production data paths
  - Directory sort `Newest` uses newest approved order
  - `Most downloads` and `Recently updated` still sort correctly
  - Rating sort still works with unrated items at the bottom
- [ ] Verify admin behavior
  - Approving a package sets `approvedAt`
  - New submissions default to pending and visible
  - Auto refresh panel still works as expected
- [ ] Spot check 3 to 5 legacy packages for safe defaults
  - `reviewStatus`
  - `visibility`
  - `submittedAt`
  - `weeklyDownloads`
  - `lastPublish`
- [ ] Monitor logs for 10 to 15 minutes after release