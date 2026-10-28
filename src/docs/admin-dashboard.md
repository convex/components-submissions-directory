# Admin Dashboard Overview

The admin dashboard at `/components/submissions/admin` provides full control over the Components Directory. Access requires a @convex.dev email address.

## Accessing the dashboard

1. Sign in with your @convex.dev email
2. Navigate to `/components/submissions/admin`
3. Or click "Admin" in the header (visible only to admins)

Non-admin users are automatically redirected to their profile page. Unauthenticated users see a simple "Admin access only" sign-in prompt.

## Dashboard layout

### Header bar

- **Search** - Search packages by name, description, maintainer names, component name, and repository URL
- **Stats** - Quick overview of package counts (total, pending, approved, downloads)
- **Tabs** - Filter by status

### Filter tabs

| Tab | Shows |
|-----|-------|
| All | All packages (default) |
| Pending | Awaiting initial review |
| In Review | Currently being reviewed |
| Approved | Live in directory |
| Changes | Changes requested |
| Rejected | Did not meet criteria |
| Featured | Featured components |
| Hidden | Hidden from directory |
| Deletion | Marked for deletion (Clock icon) |
| Settings | Admin settings panel |
| API | API access controls and analytics |
| Logs | README update logs |
| Broadcast | GitHub issue broadcasts and reply sync |
| Activity | Live timeline of user submissions, messages, and edits ([details](/components/documentation/admin-activity)) |
| Users | Search users and kick, deactivate, ban, or reactivate them ([details](/components/documentation/admin-users)) |

Tool tabs (Settings, API, Logs, Growth, Broadcast, Activity, Users) have no package count badge. Filter tabs wrap instead of horizontally scrolling, and tooltips appear above the bar.

### Package list

Packages display as expandable rows showing:

- Package name
- Status badge, Visibility badge, and Component Detail quick link (in that order)
- Deletion badge (red, if marked)
- Downloads count
- Creation date (or approval date when "Recently approved" sort is active)

### Sort options

The sort dropdown supports:

| Sort | Description |
|------|-------------|
| Newest | Most recently submitted |
| Oldest | Earliest submitted |
| Name A-Z | Alphabetical ascending |
| Name Z-A | Alphabetical descending |
| Downloads | Highest weekly downloads |
| Recently approved | Most recently approved |
| Verified first | Convex Verified components first |
| Community first | Community submitted first |
| Featured first | Featured components first |

### Expanded package view

Click a row to expand and see:

- **npm info** - Version, license, size, files, maintainers, published date
- **Links** - npm, GitHub, demo, website
- **Author info** - Collapsible section with submitter name, email, Discord, additional emails
- **Actions row** - Quick actions (above Status row)
- **Status row** - Review status controls
- **Review row** - AI Review button, Security Scan button, and combined Review history (AI reviews + security scans in tabbed panel)
- **Visibility row** - Show/hide controls
- **Featured row** - Featured toggle and sort order
- **AI Review panel** - Collapsible results with status icon, summary, and criteria checklist
- **AI Review history** - Right-side drawer with previous review runs, scores, provider metadata, and raw output
- **Notes panel** - Admin-only internal notes
- **Comments panel** - User/admin private message thread
- **Component Details editor** - Full field editing

## Pagination

- Select items per page: 5, 10, 20, 40, or 100
- Navigate with Previous/Next buttons
- Each filter tab maintains its own page state

## Quick actions

The Actions row provides:

| Action | Description |
|--------|-------------|
| Convex Verified | Toggle verified badge |
| Community | Toggle community badge |
| Generate Content | Re-run AI content generation (v2) |
| Hide/Show SEO | Toggle generated content visibility on public detail page |
| Auto-fill | Fill author info from GitHub |
| Refresh npm | Refresh npm package data |
| Generate Slug | Create URL slug (if missing) |
| Send Reward | Send gift card reward via Tremendous (requires in_review or approved status) |
| Reward history | View past reward attempts with statuses and Tremendous links |
| AI review history | Open drawer with previous AI review runs |
| Sub Hide | Toggle visibility on the public Submissions page |

## API tab

The API tab provides REST API management:

- **Global toggle** - Enable or disable the REST API (defaults to off)
- **User search** - Find submitters and grant or revoke individual API access
- **Access grants list** - View all users with API access
- **Analytics dashboard** - 24h and 7d request counts, endpoint breakdown, and recent requests table

## Stats overview

At the top of the page:

- Total packages count
- Pending review count
- Approved count
- Downloads total
