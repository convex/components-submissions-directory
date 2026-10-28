import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run daily at 3 AM UTC to check for stale packages.
// Actual refresh execution is still gated by:
// - autoRefreshEnabled
// - refreshIntervalDays (staleness window)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
crons.cron(
  "check-and-refresh-packages",
  "0 3 * * *",
  internal.packages.scheduledRefreshCheck as any,
  {},
);

// Run weekly on Sundays at 4 AM UTC to clean up failed thumbnail jobs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
crons.cron(
  "cleanup-old-thumbnail-jobs",
  "0 4 * * 0",
  internal.thumbnails._cleanupOldThumbnailJobs as any,
  {},
);

// Run daily at 2 AM UTC to clean up packages marked for deletion
// Actual deletion is gated by:
// - autoDeleteMarkedPackages setting
// - deleteIntervalDays (waiting period before permanent deletion)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
crons.cron(
  "cleanup-marked-for-deletion",
  "0 2 * * *",
  internal.packages.scheduledDeletionCleanup as any,
  {},
);

// Run daily at 5 AM UTC to check for packages needing security scans
// Gated by securityScanScheduleDays setting (0 = disabled)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
crons.cron(
  "scheduled-security-scan",
  "0 5 * * *",
  internal.packages.scheduledSecurityScanCheck as any,
  {},
);

// Run hourly at :30 (offset from the daily jobs above) to auto-update READMEs
// for official get-convex components. Actual execution is gated by:
// - officialReadmeAutoUpdateEnabled admin toggle
// - officialReadmeUpdateIntervalHours (hour/day/3 days/week/month schedule)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
crons.cron(
  "official-readme-auto-update",
  "30 * * * *",
  internal.readmeAutoUpdate.scheduledOfficialReadmeUpdate as any,
  {},
);

// Every 2 minutes: mirror GitHub issue replies into package message threads.
// Cheap when idle (GitHub answers 304 for free). Gated by:
// - githubReplySyncEnabled admin toggle
// - the X-Poll-Interval GitHub last asked for
crons.interval(
  "github-reply-sync",
  { minutes: 2 },
  internal.githubReplySync.pollNotifications,
  {},
);

// Daily at 6 AM UTC: drop admin Activity rows older than 180 days
crons.cron(
  "purge-old-user-activity",
  "0 6 * * *",
  internal.userActivity._purgeOldActivity,
  {},
);

export default crons;
