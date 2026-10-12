# README Badges

Component authors can add a dynamic SVG badge to their GitHub README that links back to their listing in the Components Directory.

## Badge endpoint

| Method | Path | Description |
|--------|------|-------------|
| GET | `/components/badge/your-slug` | Returns an SVG badge image |

Replace `your-slug` with your component's slug (the URL-safe identifier shown in your component's directory URL).

The badge endpoint is served via a Netlify edge function that proxies to the Convex badge API.

## Adding a badge to your README

Paste this markdown into your `README.md`, replacing `your-component` with your slug:

```markdown
[![Convex Component](https://www.convex.dev/components/badge/your-component)](https://www.convex.dev/components/your-component)
```

The badge renders as an inline SVG showing your component's review status.

Badge snippets with copy buttons and live previews are available on the Profile page and the Submissions page for packages with slugs.

## Badge styles

The badge is drawn to match the badge.fury.io npm version badge that most component READMEs already show, so the two look like a set when stacked. It is 20px tall with a `#555` gray left box. The text is DejaVu Sans 11px, drawn as vector outlines rather than a font, so it looks the same on every device. White text gets a thin stroke and a crisp shadow 1px below it. The right box color follows your review status:

| Status | Color | Hex |
|--------|-------|-----|
| Approved | Green (same as the npm badge) | `#4c1` |
| In Review | Blue | `#2563eb` |
| Changes Requested | Orange | `#ea580c` |
| Pending | Yellow | `#ca8a04` |
| Rejected | Red | `#dc2626` |
| Not Found | Gray | `#6b6b6b` |

The badge automatically reflects your current review status. When an admin updates your status, the badge updates on the next load.

## Badge analytics

Every badge load is recorded in the `badgeFetches` table. Admins can see:

- Which components have active badges
- How often each badge is loaded
- Referrer information (when available)

This helps the team understand which component authors are actively promoting their listings.

## Cache behavior

Badges are served with short-lived cache headers so updates to verified or community status propagate within minutes. GitHub and other Markdown renderers may apply their own image caching on top of this.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Badge shows "not found" | Verify the slug matches your directory URL exactly |
| Badge not updating | Clear browser cache or append a query param to bust cache |
| Badge not rendering on GitHub | Ensure the URL uses `https://` and the slug is correct |
