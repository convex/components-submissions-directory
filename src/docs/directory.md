# Using the Directory

The main directory page at `/components` displays all approved Convex components. No authentication is required to browse.

## Page layout

The directory has three main areas:

1. **Header** - Navigation bar with auth controls
2. **Sidebar** (desktop) - Search, sort, categories, and submit button
3. **Main content** - Featured section and component grid

## Search and filter

### Search

Type in the search box to filter components by:

- Component name
- Description
- Short description
- Tags
- Author username

Search is client-side and instant.

### Sort options

Use the dropdown to sort by:

| Sort | Description |
|------|-------------|
| Most downloads | Weekly npm download count (default) |
| Newest | Most recently added |
| Verified | Convex verified components first |
| Recently updated | Most recent npm publish date |
| Highest rated | User star ratings |

### Categories

Click a category in the sidebar to view its landing page. Categories include:

- AI / Agent Infrastructure
- Auth / Identity
- Analytics
- API Usage
- Content Management
- Full-Stack Drop-In Features
- Storage
- Third-Party Sync
- Miscellaneous

The count next to each category shows how many approved components exist. A separate verified count shows how many in that category carry the Convex Verified badge.

Desktop sidebar categories and mobile category pills link directly to category landing pages at `/components/categories/:slug`. The root "All" link points to `/components` (no trailing slash, because www.convex.dev redirects `/components/` to `/components`).

## Category landing pages

Each category has a dedicated page at `/components/categories/:slug` with:

- Breadcrumb navigation back to the directory
- Category title, description, and component counts (total and verified)
- Scoped search within the category
- Sort controls (downloads, newest, verified, updated, rating)
- Paginated component grid (24 per page) with Previous/Next controls
- Category sidebar with links to other categories

## Featured section

When no category or search is active, the Featured section appears at the top showing hand-picked components. Featured components are:

- Selected by admins
- Ordered by admin-defined sort order
- Shown with full thumbnails

## Component cards

Each card shows:

- **Thumbnail** (if available)
- **Name** - Component display name
- **Description** - Short description
- **Version** - Current npm version
- **Downloads** - Weekly npm downloads
- **Badges** - Verified and/or Community badges

Click a card to view the full component detail page.

## Badges

| Badge | Meaning |
|-------|---------|
| Convex Verified | Officially verified by the Convex team |
| Community | Built by a community member (not Convex team) |

## Submit button

The yellow "Submit a component" button in the sidebar links to the submission form. Users must sign in to submit.

## For Agents section

Below the FAQ, a "For Agents" section links to machine-readable directory content:

- `/components/llms.txt` for AI agent discovery
- `/components/components.md` for the full markdown index

## FAQ section

Scroll down to see frequently asked questions about:

- Submission process
- Requirements
- Component sandboxing
- Building your own components
- Updating submissions

## Challenge banner

A promotional banner for the Component Authoring Challenge appears above the FAQ section, linking to the challenge details and rewards.
