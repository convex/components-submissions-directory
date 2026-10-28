# Activity

The Activity tab sits after Broadcast on the admin dashboard. It is one timeline of what signed-in users did, updated live: submissions, messages and replies, profile edits, README and link changes, media uploads, and account events. Every row with a component links straight to that submission's admin card.

## Opening the tab

1. Go to `/components/submissions/admin`
2. Click Activity, after Broadcast

Direct links work too. `#admin-activity` opens the tab, and `#admin-activity:someone@example.com` opens it filtered to one user.

## What gets logged

| Group | Events |
|-------|--------|
| Submissions | Submitted, visibility changed, deletion requested or cancelled, re-review requested |
| Messages | User message, user reply, team reply, GitHub reply, system message, message deleted, message status changed |
| Edits | Details edited (name, descriptions, category, tags, generated content) |
| README | README edited, README refresh requested |
| Links | Repo, npm, demo, or video URL changed. The summary shows the new value |
| Media | Logo or thumbnail uploaded or removed |
| Account | First sign in, API key created or revoked, account deleted, account status changed by an admin |

Edits only log when a value really changed. Saving the edit form without changes writes nothing. Admin edits made from the admin dashboard are not logged here; this tab is about users.

## Reading a row

| Column | Meaning |
|--------|---------|
| When | Relative time, local time, and UTC |
| User | Avatar, name, and email. Click the email to filter to that user. Team accounts show a team tag |
| Event | Colored by group |
| Component | Links to the admin card. Shows the review status and a deleted tag when the component is gone |
| Details | Summary plus a chip for each changed field |

Row actions:

- Open card scrolls to the submission and expands it
- Component history filters the log to that component
- Public page opens the live listing when the component is approved and visible
- View user opens the user on the Users tab

## Filters and search

- Time range: 24 hours, 7 days (default), 30 days, or all time
- Group chips: one group at a time
- User and component filters show as pills you can clear
- Search matches emails, names, component names, and summaries. Search results are ordered by relevance, not time

The stats strip at the top counts events, submissions, user messages, edits, and active users for the selected range. It counts up to 2,000 events and shows a plus sign past that.

## Import existing history

The log starts empty on a new deployment. Click Import existing history to backfill past submissions and package messages, and to create Users rows for past submitters. It runs in small batches in the background, so rows appear over a minute or two. Running it again adds nothing, since every imported row is keyed to its source.

## Retention

Rows older than 180 days are deleted by a daily cron at 06:00 UTC.

## Data model

Rows live in the `userActivity` table, written by `logUserActivity` in `convex/userAccess.ts`. Queries are in `convex/userActivity.ts`.
