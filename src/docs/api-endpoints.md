# Public API Endpoints

The Components Directory exposes several public API endpoints for machine-readable access. These are used by AI agents, documentation tools, external integrations, and developer tooling.

## REST API

Authenticated REST API for programmatic access to the Components Directory.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/components/search` | Search components. Params: `q`, `category`, `limit` (max 50), `offset` |
| GET | `/api/components/detail` | Full component profile. Params: `slug` |
| GET | `/api/components/install` | Install command. Params: `slug` |
| GET | `/api/components/docs` | Documentation URLs. Params: `slug` |
| GET | `/api/components/categories` | List all categories |
| GET | `/api/components/info` | Server info |

### Authentication

Pass your API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer cdk_your_key_here" \
  https://www.convex.dev/api/components/search?q=auth
```

### Rate limits

| Tier | Limit |
|------|-------|
| Authenticated (API key) | 100 requests per minute |
| Anonymous (no key) | 10 requests per minute |

### Getting an API key

1. Sign in to your profile at `/components/profile`
2. The admin must enable the REST API globally and grant your account access
3. Click "Generate API Key" in the API Access section
4. Copy your key (shown once, stored as SHA-256 hash)
5. One active key per user; revoke and regenerate as needed

Keys use the `cdk_` prefix for identification.

### Access control

The REST API is gated behind:

1. **Global toggle** - Admins enable/disable the API from the API tab (defaults to off, returns 503 when disabled)
2. **Per-user grants** - Admins grant individual users API access by email

## llms.txt endpoints

The `llms.txt` format provides structured, machine-readable component information designed for large language models and AI agents.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/llms.txt` | Full directory listing in llms.txt format |
| GET | `/components/llms.txt` | Alias for the above (Netlify redirect) |

### Component-level llms.txt

Each approved component has its own llms.txt file:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/component-llms?slug=X` | Component-specific llms.txt |
| GET | `/components/:slug/llms.txt` | Alias via Netlify redirect |

The llms.txt file for a component includes package name, description, install command, category, and documentation links formatted for LLM consumption.

## Markdown endpoints

Markdown endpoints return component content as plain markdown, useful for AI context windows and documentation pipelines.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/markdown?slug=X` | Full markdown content for a specific component |
| GET | `/api/markdown-index` | Markdown index of all approved components |
| GET | `/components/:slug/*.md` | Component markdown via Netlify edge function |
| GET | `/components/components.md` | Directory-level markdown index alias |
| GET | `/components.md` | Directory-level markdown index alias (legacy) |

### Markdown content includes

For individual components, the markdown output contains:

- Component name and description
- Install command
- Category and tags
- Long description (full markdown)
- "From the README.md" section with imported README content
- v2 content sections (Description, Use cases, How it works) when available
- SKILL.md content (if available)
- Links to npm, the repository (GitHub or GitLab), demo

## Badge endpoint

Dynamic SVG badges that component authors can embed in their GitHub READMEs.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/components/badge/your-slug` | SVG badge image for a component |

### Badge format

The badge matches the badge.fury.io npm version badge (20px tall, DejaVu Sans 11px text drawn as outlines with a crisp shadow, `#555` left box) with status-specific colors. Approved uses the same `#4c1` green as the npm badge; see [README Badges](badges.md) for the full palette. It is returned as an SVG image with appropriate cache headers via a Netlify edge function proxy.

### Adding a badge to your README

```markdown
[![Convex Component](https://www.convex.dev/components/badge/your-component)](https://www.convex.dev/components/your-component)
```

### Badge analytics

Each badge fetch is tracked in the `badgeFetches` table. This lets admins see which components have active README badges and how often they are loaded.

## Preflight check endpoint

The preflight checker API validates a GitHub or GitLab repository against review criteria. `repoUrl` must point at `github.com` or `gitlab.com`; other hosts return 400.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/preflight` | Run preflight check (auth token optional) |

Accepts `repoUrl` and optional `npmUrl`. Returns status, summary, criteria results, `cached`, `remaining`, and `reviewedPath` / `reviewedRef` (the folder and branch that were reviewed; `root` means the repo root). When the component's package lives in a folder the URL didn't point at (for example a monorepo root URL), the response also has `suggestedRepoUrl`, the package folder URL to submit instead. Branch and folder URLs (`/tree/<branch>/<folder>`, `/-/tree/<branch>/<folder>`) are honored. Results are cached for 30 minutes by repo URL plus branch and folder, and cached hits do not count against limits. Only one check runs at a time per IP.

When the URL doesn't point at exactly one component, the check stops before the AI review and returns 422:

```json
{
  "error": "This repository has 2 Convex components. Pick the one you want checked.",
  "code": "multiple_components",
  "suggestions": [{ "label": "rate-limiter (packages/rate-limiter)", "url": "https://github.com/owner/repo/tree/main/packages/rate-limiter" }],
  "status": "error"
}
```

| `code` | Meaning |
|--------|---------|
| `repo_not_found` | Repo is missing or private |
| `branch_not_found` | Branch in the URL doesn't exist; suggestions point at the default branch |
| `dir_has_no_component` | Folder in the URL is missing or has no component |
| `multiple_components` | Repo has several components; pass `npmUrl` or pick a suggestion |

A 422 does not count against the signed in limit. It does count for guests.

| Caller | Limit | Notes |
|--------|-------|-------|
| Signed in (`Authorization: Bearer <token>`) | 10 per hour per IP | Admins have no limit and skip the cache |
| Guest (no token) | 3 per hour per IP, 30 per hour site wide | Browser origin must be the directory site. Responses include `guest: true` |

Guest requests are rejected when the admin toggle is off, when the `Origin` is not the directory, or when the hidden `website` honeypot field is filled. Rejections that a sign in would fix include `requiresSignIn: true`. Limit responses return 429 with `retryAfterSeconds` and a `Retry-After` header. The client IP comes from Convex request metadata, so forwarded headers cannot be spoofed to reset limits.

## MCP endpoints

For the full MCP (Model Context Protocol) API, see the [MCP documentation](/components/documentation/mcp). MCP endpoints are temporarily disabled on the public host while routing is being debugged. The direct Convex endpoint remains functional.

## Netlify aliases and edge functions

| Clean URL | Proxied to |
|-----------|-------------|
| `/components/llms.txt` | `/api/llms.txt` |
| `/components/components.md` | `/api/markdown-index` |
| `/components.md` | `/api/markdown-index` |
| `/components/:slug/llms.txt` | `/api/component-llms?slug=:slug` |
| `/components/:slug/*.md` | `/api/markdown?slug=:slug` (edge function) |
| `/components/badge/:slug` | `/api/badge?slug=:slug` (edge function) |
| `/components/:slug` | OG meta injection edge function |
| `/api/components/*` | REST API proxy to Convex |

## CORS

All API endpoints include CORS headers allowing cross-origin requests. OPTIONS preflight requests are handled automatically.

## Rate limits

Content and MCP endpoints are subject to Convex function rate limits. The REST API has its own two-tier rate limiting. For high-volume integrations, use an API key.
