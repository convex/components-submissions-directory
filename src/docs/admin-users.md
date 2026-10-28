# Users

The Users tab sits after Activity on the admin dashboard. It lists everyone who signed in or submitted a component, and lets you sign them out, deactivate or ban them, and decide what happens to their submissions.

## Opening the tab

1. Go to `/components/submissions/admin`
2. Click Users, after Activity

`#admin-users` opens the tab, and `#admin-users:someone@example.com` opens it searched and expanded for one user.

## Finding someone

- Search by name or email. Partial words work
- Filter by status: active, deactivated, or banned
- The deactivated and banned pills in the header show counts and act as quick filters

Rows are sorted by last seen. Last seen updates at most once an hour per user.

Users appear the first time they sign in. Past submitters who never signed in since this tab shipped appear after Import existing history on the Activity tab; their detail shows "Not yet (imported)" until they sign in.

## User detail

Click the arrow on a row to see:

- Account: first and last seen, who changed the status and when, the reason, and whether a sign out is pending
- API key and API access grant
- Submissions with their review status, each linking to the admin card
- Recent activity, with View all to open the Activity tab filtered to them

## Actions

Open Manage on a row. Team accounts (`@convex.dev`) can't be changed.

| Action | What happens |
|--------|--------------|
| Sign out (kick) | Their open tabs sign out within a few seconds, or on their next visit. They can sign straight back in. Their WorkOS session is not touched by the server |
| Deactivate | They can sign in and read, and see a notice. Every write is blocked on the server: submitting, editing, messages, uploads, content generation, and API keys |
| Ban | Signs them out now, blocks every write, and revokes their API key and API access grant. If they sign in again they are signed out with a notice |
| Reactivate | Restores full access. Hidden or archived submissions and revoked API keys stay as they are |

Deactivate and Ban ask what to do with the user's submissions:

| Option | Effect |
|--------|--------|
| Keep | Nothing changes |
| Hide from directory | Sets each submission to hidden. Undo from the card |
| Archive | Moves them to the Archived tab |
| Delete permanently | Deletes each submission with its notes, messages, ratings, and thumbnail jobs. You must type the user's email to confirm |

Only submissions where the user is the primary submitter are touched. Packages where they are an additional email are left alone.

You can add a reason. It is saved on the account, shown to deactivated users, and logged on the Activity tab with your email.

## How enforcement works

- Ban and deactivate are enforced on the server for every user write path, so an old tab or a script can't get around them
- Kick is cooperative. The browser notices the flag and signs itself out. Ban adds the server side block on top
- You can restrict an email before it ever signs in. A row is created for it

## Data model

Accounts live in the `userAccounts` table, keyed by lowercased email. Status checks are `assertEmailActive` and `getAccountBlockMessage` in `convex/userAccess.ts`. Admin queries and `setUserStatus` are in `convex/userAccounts.ts`. The browser side is `src/components/AccountStatusGuard.tsx`.
