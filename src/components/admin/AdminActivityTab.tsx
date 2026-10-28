// Admin Activity tab: a searchable timeline of what signed-in users did
// (submissions, messages, edits, README and link changes, account events)
// with deep links into the submission cards and the Users tab.
import { useState, type ReactNode } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import {
  ArrowSquareOut,
  ClockCounterClockwise,
  DownloadSimple,
  Funnel,
  MagnifyingGlass,
  Package,
  User,
  X,
} from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  adminCardHref,
  errorMessage,
  formatAbsoluteTime,
  formatRelativeTime,
  formatUtcTime,
  isPlainLeftClick,
  openAdminCard,
  publicComponentHref,
  useDebouncedValue,
  useNow,
} from "./adminTableParts";
import UserAvatar from "./UserAvatar";

type ActivityCategory = Doc<"userActivity">["category"];
type ActivityType = Doc<"userActivity">["type"];
type ActivityRow = FunctionReturnType<
  typeof api.userActivity.listUserActivity
>["page"][number];

type RangeKey = "24h" | "7d" | "30d" | "all";

const RANGE_MS: Record<Exclude<RangeKey, "all">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
];

const CATEGORY_OPTIONS: Array<{ value: ActivityCategory; label: string }> = [
  { value: "submission", label: "Submissions" },
  { value: "message", label: "Messages" },
  { value: "edit", label: "Edits" },
  { value: "readme", label: "README" },
  { value: "links", label: "Links" },
  { value: "media", label: "Media" },
  { value: "account", label: "Account" },
];

const CATEGORY_STYLE: Record<ActivityCategory, string> = {
  submission: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  message: "bg-green-500/10 text-green-600 border-green-500/20",
  edit: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  readme: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  links: "bg-cyan-500/10 text-cyan-700 border-cyan-500/20",
  media: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  account: "bg-bg-hover text-text-secondary border-border",
};

const TYPE_LABEL: Record<ActivityType, string> = {
  submitted: "Submitted",
  message_sent: "Message",
  reply_sent: "Reply",
  admin_reply: "Team reply",
  github_reply: "GitHub reply",
  system_message: "System message",
  message_deleted: "Message deleted",
  message_status_changed: "Message status",
  details_updated: "Details edited",
  links_updated: "Links changed",
  readme_updated: "README edited",
  readme_refresh_requested: "README refresh",
  media_updated: "Media changed",
  visibility_changed: "Visibility",
  deletion_requested: "Deletion requested",
  deletion_cancelled: "Deletion cancelled",
  rereview_requested: "Re-review requested",
  api_key_created: "API key created",
  api_key_revoked: "API key revoked",
  first_sign_in: "First sign in",
  account_deleted: "Account deleted",
  account_status_changed: "Account status",
};

function isTeamEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@convex.dev");
}

function sinceForRange(range: RangeKey): number | undefined {
  return range === "all" ? undefined : Date.now() - RANGE_MS[range];
}

export default function AdminActivityTab({
  actorEmail,
  onActorEmailChange,
  onViewUser,
}: {
  // Owned by the admin page so the Users tab can open a user's timeline
  actorEmail: string | null;
  onActorEmailChange: (email: string | null) => void;
  onViewUser: (email: string) => void;
}) {
  const now = useNow();
  const [range, setRange] = useState<RangeKey>("7d");
  // Captured when the range changes, never per render, so the query args
  // stay stable and Convex can cache the subscription
  const [since, setSince] = useState<number | undefined>(() =>
    sinceForRange("7d"),
  );
  const [category, setCategory] = useState<ActivityCategory | null>(null);
  const [packageFilter, setPackageFilter] = useState<{
    id: Id<"packages">;
    name: string;
  } | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim());
  const [importing, setImporting] = useState(false);

  const { results, status, loadMore } = usePaginatedQuery(
    api.userActivity.listUserActivity,
    {
      category: category ?? undefined,
      actorEmail: actorEmail ?? undefined,
      packageId: packageFilter?.id,
      search: search || undefined,
      since,
    },
    { initialNumItems: 50 },
  );
  const stats = useQuery(api.userActivity.getActivityStats, {
    since: since ?? 0,
  });
  const startBackfill = useMutation(api.userActivity.startActivityBackfill);

  const hasFilters =
    category !== null ||
    actorEmail !== null ||
    packageFilter !== null ||
    search !== "";

  const handleRangeChange = (next: RangeKey) => {
    setRange(next);
    setSince(sinceForRange(next));
  };

  const clearFilters = () => {
    setCategory(null);
    setPackageFilter(null);
    setSearchInput("");
    onActorEmailChange(null);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      await startBackfill({});
      toast.success(
        "Import started. Existing submissions and messages appear as batches finish.",
      );
    } catch (err) {
      toast.error(errorMessage(err, "Failed to start the import"));
    } finally {
      setImporting(false);
    }
  };

  const filterByPackage = (row: ActivityRow) => {
    if (!row.packageId) return;
    setPackageFilter({
      id: row.packageId,
      name: row.packageName ?? "component",
    });
  };

  const rows = results ?? [];
  const isEmptyLog =
    status !== "LoadingFirstPage" &&
    rows.length === 0 &&
    !hasFilters &&
    range === "all";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-bg-card p-4 sm:p-5">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <ClockCounterClockwise size={16} />
              Activity
            </h3>
            <p className="text-xs text-text-secondary mt-1 max-w-2xl">
              What signed-in users did: submissions, messages and replies,
              profile edits, README and link changes, media, and account
              events. Entries are kept for 180 days.
            </p>
          </div>
          <button
            onClick={() => void handleImport()}
            disabled={importing}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <DownloadSimple size={12} />
            {importing ? "Starting..." : "Import existing history"}
          </button>
        </div>

        {/* Stats strip for the selected range */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { label: "Events", value: stats?.events },
            { label: "Submissions", value: stats?.submissions },
            { label: "User messages", value: stats?.userMessages },
            { label: "Edits", value: stats?.edits },
            { label: "Active users", value: stats?.activeUsers },
          ].map((tile) => (
            <div
              key={tile.label}
              className="rounded-lg border border-border bg-bg-primary px-3 py-2"
            >
              <p className="text-[10px] uppercase tracking-wide text-text-secondary">
                {tile.label}
              </p>
              <p className="text-lg font-semibold text-text-primary tabular-nums">
                {tile.value === undefined ? (
                  <span className="inline-block h-5 w-8 animate-pulse rounded bg-bg-hover align-middle" />
                ) : (
                  `${tile.value}${stats?.capped && tile.label === "Events" ? "+" : ""}`
                )}
              </p>
            </div>
          ))}
        </div>

        {/* Search, range, and category filters */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <MagnifyingGlass
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search user, component, or text..."
              aria-label="Search activity"
              className="w-64 rounded-lg border border-border bg-bg-primary pl-8 pr-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-border"
            />
          </div>
          <select
            value={range}
            onChange={(e) => handleRangeChange(e.target.value as RangeKey)}
            aria-label="Time range"
            className="rounded-lg border border-border bg-bg-primary px-2 py-1.5 text-xs text-text-primary"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-text-secondary hover:text-text-primary underline-offset-2 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <CategoryChip
            label="All"
            active={category === null}
            onClick={() => setCategory(null)}
          />
          {CATEGORY_OPTIONS.map((option) => (
            <CategoryChip
              key={option.value}
              label={option.label}
              active={category === option.value}
              onClick={() =>
                setCategory(category === option.value ? null : option.value)
              }
            />
          ))}
          {actorEmail && (
            <FilterPill
              icon={<User size={11} />}
              label={actorEmail}
              onClear={() => onActorEmailChange(null)}
            />
          )}
          {packageFilter && (
            <FilterPill
              icon={<Package size={11} />}
              label={packageFilter.name}
              onClear={() => setPackageFilter(null)}
            />
          )}
        </div>

        {search && (
          <p className="mb-2 text-[11px] text-text-secondary">
            Search results are ordered by relevance, not time.
          </p>
        )}

        {/* Timeline */}
        {status === "LoadingFirstPage" ? (
          <div className="animate-pulse space-y-2">
            <div className="h-10 rounded bg-bg-hover" />
            <div className="h-10 rounded bg-bg-hover" />
            <div className="h-10 rounded bg-bg-hover" />
          </div>
        ) : isEmptyLog ? (
          <div className="rounded-lg border border-border bg-bg-primary p-6 text-center">
            <p className="text-xs text-text-secondary">
              No activity yet. New events appear here as users submit, message,
              and edit. Import existing history to fill in past submissions and
              messages.
            </p>
            <button
              onClick={() => void handleImport()}
              disabled={importing}
              className="mt-3 inline-flex items-center gap-1 rounded-full bg-button px-3 py-1.5 text-xs font-medium text-white hover:bg-button-hover transition-colors disabled:opacity-50"
            >
              <DownloadSimple size={12} />
              {importing ? "Starting..." : "Import existing history"}
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-bg-primary p-6 text-center text-xs text-text-secondary">
            {hasFilters
              ? "No activity matches the current filters."
              : "No activity in this time range."}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-bg-primary text-left text-text-secondary">
                    <th className="px-3 py-2 font-medium whitespace-nowrap">
                      When
                    </th>
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium">Event</th>
                    <th className="px-3 py-2 font-medium">Component</th>
                    <th className="px-3 py-2 font-medium">Details</th>
                    <th className="px-3 py-2 font-medium text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row._id}
                      className="border-b border-border last:border-b-0 align-top hover:bg-bg-hover/50 transition-colors"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        <TimeCell ts={row.createdAt} now={now} />
                      </td>
                      <td className="px-3 py-2 max-w-[220px]">
                        <ActorCell
                          row={row}
                          onFilter={() => onActorEmailChange(row.actorEmail)}
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <EventBadge row={row} />
                      </td>
                      <td className="px-3 py-2 max-w-[200px]">
                        <ComponentCell row={row} />
                      </td>
                      <td className="px-3 py-2 max-w-[360px]">
                        <DetailsCell row={row} />
                      </td>
                      <td className="px-3 py-2">
                        <RowActions
                          row={row}
                          onFilterPackage={() => filterByPackage(row)}
                          onViewUser={() => onViewUser(row.actorEmail)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="md:hidden space-y-2">
              {rows.map((row) => (
                <li
                  key={row._id}
                  className="rounded-lg border border-border bg-bg-primary p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <ActorCell
                      row={row}
                      onFilter={() => onActorEmailChange(row.actorEmail)}
                    />
                    <TimeCell ts={row.createdAt} now={now} alignRight />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <EventBadge row={row} />
                    <ComponentCell row={row} />
                  </div>
                  <DetailsCell row={row} />
                  <RowActions
                    row={row}
                    onFilterPackage={() => filterByPackage(row)}
                    onViewUser={() => onViewUser(row.actorEmail)}
                  />
                </li>
              ))}
            </ul>

            {(status === "CanLoadMore" || status === "LoadingMore") && (
              <div className="mt-3 flex justify-center">
                <button
                  onClick={() => loadMore(50)}
                  disabled={status === "LoadingMore"}
                  className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-50"
                >
                  {status === "LoadingMore" ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "border-button bg-button text-white"
          : "border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}

function FilterPill({
  icon,
  label,
  onClear,
}: {
  icon: ReactNode;
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex max-w-[260px] items-center gap-1 rounded-full border border-border bg-bg-hover px-2 py-1 text-[11px] text-text-primary">
      <Funnel size={11} className="shrink-0 text-text-secondary" />
      {icon}
      <span className="truncate">{label}</span>
      <button
        onClick={onClear}
        aria-label={`Remove filter ${label}`}
        className="shrink-0 rounded-full p-0.5 text-text-secondary hover:text-text-primary"
      >
        <X size={10} />
      </button>
    </span>
  );
}

function TimeCell({
  ts,
  now,
  alignRight = false,
}: {
  ts: number;
  now: number;
  alignRight?: boolean;
}) {
  return (
    <time
      dateTime={new Date(ts).toISOString()}
      className={`block shrink-0 ${alignRight ? "text-right" : ""}`}
    >
      <span className="block text-text-primary">
        {formatRelativeTime(ts, now)}
      </span>
      <span className="block text-[10px] text-text-secondary">
        {formatAbsoluteTime(ts)}
      </span>
      <span className="block text-[10px] text-text-secondary/70">
        {formatUtcTime(ts)}
      </span>
    </time>
  );
}

function ActorCell({
  row,
  onFilter,
}: {
  row: ActivityRow;
  onFilter: () => void;
}) {
  const isSystem = row.actorRole === "system";
  return (
    <div className="flex min-w-0 items-center gap-2">
      <UserAvatar
        email={row.actorEmail}
        name={isSystem ? "System" : row.actorName}
        pictureUrl={row.actorPictureUrl}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span className="truncate text-text-primary">
            {isSystem ? "System" : row.actorName || row.actorEmail}
          </span>
          {isTeamEmail(row.actorEmail) && (
            <span className="shrink-0 rounded-full border border-border px-1.5 text-[9px] text-text-secondary">
              team
            </span>
          )}
        </div>
        {!isSystem && (
          <button
            onClick={onFilter}
            title="Show only this user's activity"
            className="block max-w-full truncate text-left text-[10px] text-text-secondary hover:text-text-primary hover:underline"
          >
            {row.actorEmail}
          </button>
        )}
      </div>
    </div>
  );
}

function EventBadge({ row }: { row: ActivityRow }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap ${CATEGORY_STYLE[row.category]}`}
    >
      {TYPE_LABEL[row.type]}
    </span>
  );
}

function ComponentCell({ row }: { row: ActivityRow }) {
  if (!row.packageId) {
    return <span className="text-text-secondary/70">None</span>;
  }
  const packageId = row.packageId;
  if (!row.packageExists) {
    return (
      <span className="inline-flex items-center gap-1 text-text-secondary">
        <span className="truncate">{row.packageName ?? "Component"}</span>
        <span className="shrink-0 rounded-full border border-red-500/20 bg-red-500/10 px-1.5 text-[9px] text-red-600">
          deleted
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex min-w-0 flex-col">
      <a
        href={adminCardHref(packageId)}
        onClick={(e) => {
          if (!isPlainLeftClick(e)) return;
          e.preventDefault();
          openAdminCard(packageId);
        }}
        className="truncate font-medium text-text-primary hover:underline"
      >
        {row.packageName ?? "Component"}
      </a>
      <span className="text-[10px] text-text-secondary">
        {(row.packageReviewStatus ?? "pending").replace(/_/g, " ")}
        {row.packageVisibility && row.packageVisibility !== "visible"
          ? `, ${row.packageVisibility}`
          : ""}
      </span>
    </span>
  );
}

function DetailsCell({ row }: { row: ActivityRow }) {
  return (
    <div className="space-y-1">
      <p className="line-clamp-2 break-words text-text-secondary">
        {row.summary}
      </p>
      {row.changedFields && row.changedFields.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {row.changedFields.map((field) => (
            <span
              key={field}
              className="rounded border border-border bg-bg-primary px-1.5 text-[10px] text-text-secondary"
            >
              {field}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RowActions({
  row,
  onFilterPackage,
  onViewUser,
}: {
  row: ActivityRow;
  onFilterPackage: () => void;
  onViewUser: () => void;
}) {
  const packageId = row.packageId;
  const canOpenPublic =
    row.packageExists &&
    row.packageSlug &&
    row.packageReviewStatus === "approved" &&
    (row.packageVisibility ?? "visible") === "visible";
  const actionClass =
    "inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors whitespace-nowrap";

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {packageId && row.packageExists && (
        <a
          href={adminCardHref(packageId)}
          onClick={(e) => {
            if (!isPlainLeftClick(e)) return;
            e.preventDefault();
            openAdminCard(packageId);
          }}
          className={actionClass}
        >
          Open card
        </a>
      )}
      {packageId && (
        <button onClick={onFilterPackage} className={actionClass}>
          Component history
        </button>
      )}
      {canOpenPublic && row.packageSlug && (
        <a
          href={publicComponentHref(row.packageSlug)}
          target="_blank"
          rel="noopener noreferrer"
          className={actionClass}
        >
          Public page
          <ArrowSquareOut size={10} />
        </a>
      )}
      {row.actorRole !== "system" && !isTeamEmail(row.actorEmail) && (
        <button onClick={onViewUser} className={actionClass}>
          View user
        </button>
      )}
    </div>
  );
}
