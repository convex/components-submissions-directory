// Admin Users tab: search accounts by name or email, see their submissions
// and recent activity, and kick, deactivate, ban, or reactivate them with a
// choice of what happens to their submissions.
import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import {
  CaretDown,
  CaretRight,
  ClockCounterClockwise,
  Copy,
  LockSimple,
  MagnifyingGlass,
  SignOut,
  Prohibit,
  Pause,
  ArrowCounterClockwise,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import {
  adminCardHref,
  errorMessage,
  formatAbsoluteTime,
  formatRelativeTime,
  isPlainLeftClick,
  openAdminCard,
  useDebouncedValue,
  useNow,
} from "./adminTableParts";
import RowActionMenu, { type RowMenuItem } from "./RowActionMenu";
import UserAvatar from "./UserAvatar";

type AccountStatus = Doc<"userAccounts">["status"];
type AccountAction = "kick" | "deactivate" | "ban" | "reactivate";
type SubmissionHandling = "keep" | "hide" | "archive" | "delete";
type UserRow = FunctionReturnType<
  typeof api.userAccounts.listUsers
>["page"][number];

type ActionTarget = {
  email: string;
  name?: string;
  status: AccountStatus;
  submissionCount: number;
  action: AccountAction;
};

const STATUS_STYLE: Record<AccountStatus, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  deactivated: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  banned: "bg-red-500/10 text-red-600 border-red-500/20",
};

const ACTION_COPY: Record<
  AccountAction,
  { title: string; confirm: string; body: string; danger: boolean }
> = {
  kick: {
    title: "Sign this user out",
    confirm: "Sign out",
    body: "Their open tabs sign out of this app within a few seconds. They can sign back in right away. Their WorkOS session is not touched.",
    danger: false,
  },
  deactivate: {
    title: "Deactivate account",
    confirm: "Deactivate",
    body: "They stay signed in and can read everything, but can't submit, edit, message, upload, generate content, or create API keys until you reactivate them.",
    danger: false,
  },
  ban: {
    title: "Ban account",
    confirm: "Ban",
    body: "Signs them out now, blocks every write, and revokes their API key and API access grant. They can sign in again but stay blocked until reactivated.",
    danger: true,
  },
  reactivate: {
    title: "Reactivate account",
    confirm: "Reactivate",
    body: "Restores full access. Hidden or archived submissions stay as they are, and revoked API keys stay revoked; they can create a new key.",
    danger: false,
  },
};

const HANDLING_OPTIONS: Array<{
  value: SubmissionHandling;
  label: string;
  hint: string;
}> = [
  {
    value: "keep",
    label: "Keep submissions",
    hint: "Leave everything as it is",
  },
  {
    value: "hide",
    label: "Hide from directory",
    hint: "Reversible from the submission card",
  },
  {
    value: "archive",
    label: "Archive",
    hint: "Moves them to the Archived tab",
  },
  {
    value: "delete",
    label: "Delete permanently",
    hint: "Removes submissions, notes, messages, and ratings. Can't be undone",
  },
];

export default function AdminUsersTab({
  initialEmail,
  onViewActivity,
}: {
  // Set when another tab links here; the parent remounts with a new key
  initialEmail?: string;
  onViewActivity: (email: string) => void;
}) {
  const now = useNow();
  const [searchInput, setSearchInput] = useState(initialEmail ?? "");
  const search = useDebouncedValue(searchInput.trim());
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "all">(
    "all",
  );
  const [expandedEmail, setExpandedEmail] = useState<string | null>(
    initialEmail ?? null,
  );
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);

  const { results, status, loadMore } = usePaginatedQuery(
    api.userAccounts.listUsers,
    {
      search: search || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
    },
    { initialNumItems: 25 },
  );
  const counts = useQuery(api.userAccounts.getUserStatusCounts, {});

  const rows = results ?? [];
  const openAction = (row: UserRow, action: AccountAction) => {
    setActionTarget({
      email: row.email,
      name: row.name,
      status: row.status,
      submissionCount: row.submissionCount,
      action,
    });
  };

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success("Email copied");
    } catch {
      toast.error("Couldn't copy the email");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-bg-card p-4 sm:p-5">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <UsersThree size={16} />
              Users
            </h3>
            <p className="text-xs text-text-secondary mt-1 max-w-2xl">
              Everyone who signed in or submitted a component. Sign people out,
              deactivate or ban them, and choose what happens to their
              submissions. Team accounts can't be changed here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["deactivated", "banned"] as const).map((key) => (
              <button
                key={key}
                onClick={() =>
                  setStatusFilter(statusFilter === key ? "all" : key)
                }
                aria-pressed={statusFilter === key}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  statusFilter === key
                    ? STATUS_STYLE[key]
                    : "border-border text-text-secondary hover:bg-bg-hover"
                }`}
              >
                <span className="tabular-nums">
                  {counts ? `${counts[key]}${counts.capped ? "+" : ""}` : "-"}
                </span>
                {key}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <MagnifyingGlass
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name or email..."
              aria-label="Search users"
              className="w-64 rounded-lg border border-border bg-bg-primary pl-8 pr-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-border"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as AccountStatus | "all")
            }
            aria-label="Account status"
            className="rounded-lg border border-border bg-bg-primary px-2 py-1.5 text-xs text-text-primary"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
            <option value="banned">Banned</option>
          </select>
          {search && (
            <span className="text-[11px] text-text-secondary">
              Ordered by best match
            </span>
          )}
        </div>

        {/* List */}
        {status === "LoadingFirstPage" ? (
          <div className="animate-pulse space-y-2">
            <div className="h-12 rounded bg-bg-hover" />
            <div className="h-12 rounded bg-bg-hover" />
            <div className="h-12 rounded bg-bg-hover" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-bg-primary p-6 text-center text-xs text-text-secondary">
            {search || statusFilter !== "all"
              ? "No users match the current filters."
              : "No users yet. Accounts appear after someone signs in. Use Import existing history on the Activity tab to add past submitters."}
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            {/* Column headings (desktop) */}
            <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_90px_minmax(0,1.2fr)_110px_110px_88px] gap-3 border-b border-border bg-bg-primary px-3 py-2 text-[11px] font-medium text-text-secondary">
              <span>User</span>
              <span>Status</span>
              <span>Submissions</span>
              <span>First seen</span>
              <span>Last seen</span>
              <span className="sr-only">Actions</span>
            </div>
            <ul>
              {rows.map((row) => {
                const expanded = expandedEmail === row.email;
                return (
                  <li
                    key={row._id}
                    className="border-b border-border last:border-b-0"
                  >
                    <div
                      className={`grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.2fr)_90px_minmax(0,1.2fr)_110px_110px_88px] items-center gap-3 px-3 py-2.5 text-xs transition-colors ${
                        expanded ? "bg-bg-hover" : "hover:bg-bg-hover/50"
                      }`}
                    >
                      {/* User */}
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          onClick={() =>
                            setExpandedEmail(expanded ? null : row.email)
                          }
                          aria-expanded={expanded}
                          aria-label={`${expanded ? "Hide" : "Show"} details for ${row.email}`}
                          className="shrink-0 rounded p-0.5 text-text-secondary hover:text-text-primary"
                        >
                          {expanded ? (
                            <CaretDown size={12} />
                          ) : (
                            <CaretRight size={12} />
                          )}
                        </button>
                        <UserAvatar
                          email={row.email}
                          name={row.name}
                          pictureUrl={row.pictureUrl}
                          size={28}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="truncate font-medium text-text-primary">
                              {row.name || row.email}
                            </span>
                            {row.isAdmin && (
                              <span className="shrink-0 rounded-full border border-border px-1.5 text-[9px] text-text-secondary">
                                team
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="truncate text-[10px] text-text-secondary">
                              {row.email}
                            </span>
                            <button
                              onClick={() => void copyEmail(row.email)}
                              aria-label={`Copy ${row.email}`}
                              className="shrink-0 text-text-secondary hover:text-text-primary"
                            >
                              <Copy size={10} />
                            </button>
                          </div>
                          {/* Mobile summary line */}
                          <p className="md:hidden mt-0.5 text-[10px] text-text-secondary">
                            <span
                              className={`mr-1 inline-flex rounded-full border px-1.5 ${STATUS_STYLE[row.status]}`}
                            >
                              {row.status}
                            </span>
                            {row.submissionCount} submissions, seen{" "}
                            {formatRelativeTime(row.lastSeenAt, now)}
                          </p>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="hidden md:block">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_STYLE[row.status]}`}
                        >
                          {row.status}
                        </span>
                      </div>

                      {/* Submissions */}
                      <div className="hidden md:block text-text-secondary">
                        <span className="text-text-primary tabular-nums">
                          {row.submissionCount}
                        </span>{" "}
                        total
                        {row.submissionCount > 0 && (
                          <span className="block text-[10px]">
                            {row.approvedCount} approved, {row.pendingCount}{" "}
                            pending
                          </span>
                        )}
                      </div>

                      {/* Seen */}
                      <div className="hidden md:block text-text-secondary">
                        {formatAbsoluteTime(row.firstSeenAt)}
                      </div>
                      <div className="hidden md:block text-text-secondary">
                        {formatRelativeTime(row.lastSeenAt, now)}
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end">
                        {row.isAdmin ? (
                          <span
                            title="Team accounts can't be changed here"
                            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-text-secondary"
                          >
                            <LockSimple size={12} />
                            <span className="hidden sm:inline">Protected</span>
                            <span className="sr-only sm:hidden">
                              Team account, protected
                            </span>
                          </span>
                        ) : (
                          <RowActionMenu
                            ariaLabel={`Actions for ${row.email}`}
                            heading={row.email}
                            items={buildUserMenuItems(row, {
                              onViewActivity: () => onViewActivity(row.email),
                              onAction: (action) => openAction(row, action),
                            })}
                          />
                        )}
                      </div>
                    </div>

                    {expanded && (
                      <UserDetailPanel
                        email={row.email}
                        now={now}
                        onViewActivity={() => onViewActivity(row.email)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {(status === "CanLoadMore" || status === "LoadingMore") && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => loadMore(25)}
              disabled={status === "LoadingMore"}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-50"
            >
              {status === "LoadingMore" ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>

      {actionTarget && (
        <UserActionModal
          target={actionTarget}
          onClose={() => setActionTarget(null)}
        />
      )}
    </div>
  );
}

// Menu entries depend on the current status; ban sits last behind a divider
function buildUserMenuItems(
  row: UserRow,
  handlers: {
    onViewActivity: () => void;
    onAction: (action: AccountAction) => void;
  },
): Array<RowMenuItem> {
  const items: Array<RowMenuItem> = [
    {
      key: "activity",
      label: "View activity",
      icon: <ClockCounterClockwise size={13} />,
      onSelect: handlers.onViewActivity,
    },
    {
      key: "kick",
      label: "Sign out (kick)",
      icon: <SignOut size={13} />,
      onSelect: () => handlers.onAction("kick"),
    },
  ];
  if (row.status === "active") {
    items.push({
      key: "deactivate",
      label: "Deactivate",
      icon: <Pause size={13} />,
      onSelect: () => handlers.onAction("deactivate"),
    });
  } else {
    items.push({
      key: "reactivate",
      label: "Reactivate",
      icon: <ArrowCounterClockwise size={13} />,
      onSelect: () => handlers.onAction("reactivate"),
    });
  }
  if (row.status !== "banned") {
    items.push({
      key: "ban",
      label: "Ban",
      icon: <Prohibit size={13} />,
      danger: true,
      separatorBefore: true,
      onSelect: () => handlers.onAction("ban"),
    });
  }
  return items;
}

function UserDetailPanel({
  email,
  now,
  onViewActivity,
}: {
  email: string;
  now: number;
  onViewActivity: () => void;
}) {
  const detail = useQuery(api.userAccounts.getUserDetail, { email });

  if (detail === undefined) {
    return (
      <div className="animate-pulse space-y-2 border-t border-border bg-bg-primary px-4 py-3">
        <div className="h-4 w-1/3 rounded bg-bg-hover" />
        <div className="h-4 w-2/3 rounded bg-bg-hover" />
      </div>
    );
  }
  if (detail === null) return null;

  const account = detail.account;
  return (
    <div className="grid gap-4 border-t border-border bg-bg-primary px-4 py-3 text-xs md:grid-cols-3">
      {/* Account */}
      <section className="space-y-1.5">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
          Account
        </h4>
        {account ? (
          <dl className="space-y-1 text-text-secondary">
            <DetailRow
              label="First seen"
              value={formatAbsoluteTime(account.firstSeenAt)}
            />
            <DetailRow
              label="Last seen"
              value={formatRelativeTime(account.lastSeenAt, now)}
            />
            {account.statusChangedAt && (
              <DetailRow
                label="Status changed"
                value={`${formatAbsoluteTime(account.statusChangedAt)}${
                  account.statusChangedBy ? ` by ${account.statusChangedBy}` : ""
                }`}
              />
            )}
            {account.statusReason && (
              <DetailRow label="Reason" value={account.statusReason} />
            )}
            {account.forceSignOutAt && (
              <DetailRow label="Sign out" value="Pending on their next visit" />
            )}
            <DetailRow
              label="Signed in"
              value={account.tokenIdentifier ? "Yes" : "Not yet (imported)"}
            />
          </dl>
        ) : (
          <p className="text-text-secondary">No account row yet.</p>
        )}
        <dl className="space-y-1 pt-1 text-text-secondary">
          <DetailRow
            label="API key"
            value={
              detail.apiKey
                ? `${detail.apiKey.keyPrefix}... (${detail.apiKey.requestCount} requests)`
                : "None"
            }
          />
          <DetailRow
            label="API access"
            value={
              detail.apiGrant
                ? detail.apiGrant.revoked
                  ? "Revoked"
                  : `Granted ${formatAbsoluteTime(detail.apiGrant.grantedAt)}`
                : "Not granted"
            }
          />
        </dl>
      </section>

      {/* Submissions */}
      <section className="space-y-1.5">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
          Submissions ({detail.submissions.length})
        </h4>
        {detail.submissions.length === 0 ? (
          <p className="text-text-secondary">No submissions.</p>
        ) : (
          <ul className="space-y-1">
            {detail.submissions.slice(0, 10).map((pkg) => (
              <li key={pkg._id} className="flex items-center gap-2">
                <a
                  href={adminCardHref(pkg._id)}
                  onClick={(e) => {
                    if (!isPlainLeftClick(e)) return;
                    e.preventDefault();
                    openAdminCard(pkg._id);
                  }}
                  className="truncate text-text-primary hover:underline"
                >
                  {pkg.displayName}
                </a>
                <span className="shrink-0 text-[10px] text-text-secondary">
                  {pkg.reviewStatus.replace(/_/g, " ")}
                  {pkg.visibility !== "visible" ? `, ${pkg.visibility}` : ""}
                  {pkg.markedForDeletion ? ", deletion requested" : ""}
                </span>
              </li>
            ))}
            {detail.submissions.length > 10 && (
              <li className="text-[10px] text-text-secondary">
                and {detail.submissions.length - 10} more
              </li>
            )}
          </ul>
        )}
      </section>

      {/* Recent activity */}
      <section className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
            Recent activity
          </h4>
          <button
            onClick={onViewActivity}
            className="text-[11px] text-text-secondary hover:text-text-primary hover:underline"
          >
            View all
          </button>
        </div>
        {detail.recentActivity.length === 0 ? (
          <p className="text-text-secondary">No activity logged.</p>
        ) : (
          <ul className="space-y-1">
            {detail.recentActivity.slice(0, 6).map((event) => (
              <li key={event._id} className="flex gap-2">
                <span className="w-14 shrink-0 text-[10px] text-text-secondary">
                  {formatRelativeTime(event.createdAt, now)}
                </span>
                <span className="line-clamp-1 text-text-primary">
                  {event.packageName ? `${event.packageName}: ` : ""}
                  {event.summary}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0">{label}</dt>
      <dd className="min-w-0 break-words text-text-primary">{value}</dd>
    </div>
  );
}

function UserActionModal({
  target,
  onClose,
}: {
  target: ActionTarget;
  onClose: () => void;
}) {
  const setUserStatus = useMutation(api.userAccounts.setUserStatus);
  const [reason, setReason] = useState("");
  const [handling, setHandling] = useState<SubmissionHandling>("keep");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const copy = ACTION_COPY[target.action];
  const showHandling =
    (target.action === "deactivate" || target.action === "ban") &&
    target.submissionCount > 0;
  const needsTypedConfirm = showHandling && handling === "delete";
  const confirmReady =
    !needsTypedConfirm ||
    confirmText.trim().toLowerCase() === target.email.toLowerCase();
  const danger = copy.danger || needsTypedConfirm;

  const handleConfirm = async () => {
    if (!confirmReady || busy) return;
    setBusy(true);
    try {
      const result = await setUserStatus({
        email: target.email,
        action: target.action,
        reason: reason.trim() || undefined,
        submissions: showHandling ? handling : undefined,
      });
      const suffix =
        result.affectedSubmissions > 0
          ? ` ${result.affectedSubmissions} submission${result.affectedSubmissions === 1 ? "" : "s"} updated.`
          : "";
      toast.success(`${copy.confirm} done for ${target.email}.${suffix}`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, `Couldn't ${copy.confirm.toLowerCase()}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-action-title"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <div className="relative w-full max-w-md rounded-container bg-white border border-border shadow-lg p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              id="user-action-title"
              className="text-sm font-semibold text-text-primary"
            >
              {copy.title}
            </h3>
            <p className="mt-0.5 text-xs text-text-secondary break-all">
              {target.name ? `${target.name}, ` : ""}
              {target.email}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            <X size={14} />
          </button>
        </div>

        <p className="text-xs text-text-secondary">{copy.body}</p>

        {target.action !== "reactivate" && (
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-text-primary">
              Reason (optional, logged in Activity)
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              rows={2}
              autoFocus
              className="w-full rounded-lg border border-border bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-border"
            />
          </label>
        )}

        {showHandling && (
          <fieldset className="space-y-1.5">
            <legend className="text-[11px] font-medium text-text-primary">
              Their {target.submissionCount} submission
              {target.submissionCount === 1 ? "" : "s"}
            </legend>
            {HANDLING_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors ${
                  handling === option.value
                    ? option.value === "delete"
                      ? "border-red-500/40 bg-red-500/5"
                      : "border-text-primary/30 bg-bg-hover"
                    : "border-border hover:bg-bg-hover/50"
                }`}
              >
                <input
                  type="radio"
                  name="submission-handling"
                  value={option.value}
                  checked={handling === option.value}
                  onChange={() => {
                    setHandling(option.value);
                    setConfirmText("");
                  }}
                  className="mt-0.5 accent-button"
                />
                <span>
                  <span
                    className={`block font-medium ${option.value === "delete" ? "text-red-600" : "text-text-primary"}`}
                  >
                    {option.label}
                  </span>
                  <span className="block text-[10px] text-text-secondary">
                    {option.hint}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {needsTypedConfirm && (
          <label className="block space-y-1">
            <span className="text-[11px] text-text-secondary">
              Type <span className="font-medium text-text-primary">{target.email}</span>{" "}
              to confirm permanent deletion
            </span>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-red-500/30 bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-red-500/40"
            />
          </label>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={!confirmReady || busy}
            className={`rounded-full px-4 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-button hover:bg-button-hover"
            }`}
          >
            {busy ? "Working..." : copy.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
