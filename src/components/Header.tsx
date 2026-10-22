import { useAuth } from "../lib/auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useRef, useEffect } from "react";
import {
  ArrowSquareOut,
  User,
  CaretDown,
  List,
  GithubLogo,
  DiscordLogo,
  House,
  GearSix,
  BookOpen,
  ChartBar,
  Bell,
  Rows,
  SquaresFour,
} from "@phosphor-icons/react";
import { FileTextIcon } from "@radix-ui/react-icons";
import { HeaderSearch } from "./HeaderSearch";

// Get base path for links (always /components)
function useBasePath() {
  return "/components";
}

// Directory view mode shared with pages that opt into the header toggle
export type DirectoryViewMode = "grid" | "list";

interface HeaderProps {
  // Optional grid/list toggle rendered before the Directory nav link on
  // desktop (next to the search icon on mobile). Only pages that pass both
  // props (e.g. Directory) show the toggle; all other pages render unchanged.
  viewMode?: DirectoryViewMode;
  onViewModeChange?: (mode: DirectoryViewMode) => void;
}

export default function Header({ viewMode, onViewModeChange }: HeaderProps) {
  const basePath = useBasePath();
  const { isAuthenticated, isLoading: authLoading, signIn } = useAuth();
  const user = useQuery(api.auth.loggedInUser);
  const isAdmin = useQuery(api.auth.isAdmin);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const bellDesktopRef = useRef<HTMLDivElement>(null);
  const bellMobileRef = useRef<HTMLDivElement>(null);

  // Only query when authenticated; admin feed only when admin
  const userFeed = useQuery(
    api.packages.getMyUnreadAdminRepliesByPackage,
    isAuthenticated ? {} : "skip",
  );
  const adminFeed = useQuery(
    api.packages.getAdminUnreadMessagesByPackage,
    isAuthenticated && isAdmin ? {} : "skip",
  );
  const statusFeed = useQuery(
    api.notifications.getMyStatusNotifications,
    isAuthenticated ? {} : "skip",
  );
  const markStatusRead = useMutation(api.notifications.markStatusNotificationRead);
  const markAllStatusRead = useMutation(api.notifications.markAllStatusNotificationsRead);

  // Grid/list toggle button (only when the page opts in via props)
  const renderViewToggle = () =>
    viewMode && onViewModeChange ? (
      <button
        type="button"
        onClick={() => onViewModeChange(viewMode === "grid" ? "list" : "grid")}
        aria-label={
          viewMode === "grid" ? "Switch to list view" : "Switch to grid view"
        }
        title={
          viewMode === "grid" ? "Switch to list view" : "Switch to grid view"
        }
        className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors">
        {viewMode === "grid" ? <Rows size={16} /> : <SquaresFour size={16} />}
      </button>
    ) : null;

  const userItems = userFeed ?? [];
  const adminItems = adminFeed ?? [];
  const statusItems = statusFeed ?? [];
  const totalUnread =
    userItems.reduce((sum, item) => sum + item.unreadCount, 0) +
    adminItems.reduce((sum, item) => sum + item.unreadCount, 0) +
    statusItems.length;

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      const target = e.target as Node;
      const inDesktopBell = bellDesktopRef.current?.contains(target);
      const inMobileBell = bellMobileRef.current?.contains(target);
      if (!inDesktopBell && !inMobileBell) {
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const formatRelative = (ts: number) => {
    const diffMs = Date.now() - ts;
    const m = Math.floor(diffMs / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  };

  // Copy and dot color for each review status notification
  const statusDisplay = (
    status: "in_review" | "approved" | "changes_requested" | "rejected",
    packageName: string,
  ): { message: string; dotColor: string } => {
    switch (status) {
      case "in_review":
        return { message: `${packageName} is now in review`, dotColor: "#2563EB" };
      case "approved":
        return { message: `${packageName} was approved`, dotColor: "#16A34A" };
      case "changes_requested":
        return { message: `Changes requested for ${packageName}`, dotColor: "#D97706" };
      case "rejected":
        return { message: `${packageName} was not approved`, dotColor: "#DC2626" };
    }
  };

  const renderBellDropdown = () => (
    <div className="fixed sm:absolute left-1/2 sm:left-auto -translate-x-1/2 sm:translate-x-0 sm:right-0 top-[70px] sm:top-full mt-0 sm:mt-2 w-[calc(100vw-1rem)] sm:w-80 max-w-sm rounded-lg border border-border bg-white shadow-lg z-50 overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">Notifications</span>
        <div className="flex items-center gap-2">
          {statusItems.length > 0 && (
            <button
              type="button"
              onClick={() => void markAllStatusRead()}
              className="text-xs text-text-secondary hover:text-text-primary transition-colors">
              Mark all read
            </button>
          )}
          <span className="text-xs text-text-secondary">
            {totalUnread > 0 ? `${totalUnread} new` : "All caught up"}
          </span>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto py-1">
        {userItems.length === 0 && adminItems.length === 0 && statusItems.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-text-secondary">
            No new messages
          </div>
        )}

        {statusItems.length > 0 && (
          <div>
            <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-text-secondary">
              Status updates
            </div>
            {statusItems.map((item) => {
              const { message, dotColor } = statusDisplay(item.reviewStatus, item.packageName);
              return (
                <a
                  key={item.notificationId}
                  href={`${basePath}/profile#pkg-${item.packageId}`}
                  onClick={() => {
                    void markStatusRead({ notificationId: item.notificationId });
                    setBellOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-bg-hover transition-colors">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: dotColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary truncate">{message}</div>
                    <div className="text-xs text-text-secondary">
                      {formatRelative(item.createdAt)}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {userItems.length > 0 && (
          <div>
            <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-text-secondary">
              Messages from Convex Team
            </div>
            {userItems.map((item) => (
              <a
                key={item.packageId}
                href={`${basePath}/profile#pkg-${item.packageId}`}
                onClick={() => setBellOpen(false)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-bg-hover transition-colors">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: "#E05C35" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">{item.packageName}</div>
                  <div className="text-xs text-text-secondary">
                    {item.unreadCount} new · {formatRelative(item.lastMessageAt)}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {isAdmin && adminItems.length > 0 && (
          <div>
            <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-text-secondary border-t border-border mt-1">
              Incoming messages
            </div>
            {adminItems.map((item) => (
              <a
                key={item.packageId}
                href={`${basePath}/submissions/admin#pkg-${item.packageId}`}
                onClick={() => setBellOpen(false)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-bg-hover transition-colors">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: "#E05C35" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">{item.packageName}</div>
                  <div className="text-xs text-text-secondary">
                    {item.unreadCount} new · {formatRelative(item.lastMessageAt)}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 pt-[0.438rem]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-[3.438rem] rounded-full bg-white/95 backdrop-blur-sm border border-border shadow-sm px-4">
          {/* Left: Logo + Nav links */}
          <div className="flex items-center gap-6">
            <a href="https://convex.dev/" className="flex items-center">
              <img
                src="/components/convex-wordmark-black.svg"
                alt="Convex"
                width={322}
                height={146}
                className="h-[70px] w-auto"
              />
            </a>

            {/* Nav links (desktop) */}
            <nav className="hidden sm:flex items-center gap-5">
              {renderViewToggle()}
              <a
                href={basePath}
                className="text-sm font-medium text-text-primary hover:text-text-secondary transition-colors">
                Directory
              </a>
              {/* External link to the Convex components docs */}
              <a
                href="https://docs.convex.dev/components/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-text-primary hover:text-text-secondary transition-colors">
                Build
              </a>
              {/* Component Preflight Check (open to guests with limits) */}
              <a
                href={`${basePath}/submit/check`}
                className="text-sm font-medium text-text-primary hover:text-text-secondary transition-colors">
                Test
              </a>
              {isAdmin && (
                <>
                  <a
                    href={`${basePath}/submissions`}
                    className="text-sm font-medium text-text-primary hover:text-text-secondary transition-colors">
                    Submissions
                  </a>
                  <a
                    href={`${basePath}/submissions/admin`}
                    className="flex items-center gap-1 text-sm font-medium text-text-primary hover:text-text-secondary transition-colors">
                    <GearSix size={14} />
                    Admin
                  </a>
                  <a
                    href={`${basePath}/documentation`}
                    className="flex items-center gap-1 text-sm font-medium text-text-primary hover:text-text-secondary transition-colors">
                    <BookOpen size={14} />
                    Docs
                  </a>
                  <a
                    href={`${basePath}/dashboard`}
                    className="flex items-center gap-1 text-sm font-medium text-text-primary hover:text-text-secondary transition-colors">
                    <ChartBar size={14} />
                    Dashboard
                  </a>
                </>
              )}
            </nav>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right: Icons, Submit, Auth section */}
          <div className="flex items-center gap-3">
            {/* Desktop right nav */}
            <nav className="hidden sm:flex items-center gap-3">
              <HeaderSearch />
              <a
                href={`${basePath}/submit`}
                className="text-sm font-medium text-text-primary hover:text-text-secondary transition-colors">
                Submit
              </a>
              {isAuthenticated && user && (
                <div ref={bellDesktopRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setBellOpen((v) => !v)}
                    aria-label="Notifications"
                    title="Notifications"
                    className={`relative p-1.5 rounded-full transition-colors ${
                      totalUnread > 0
                        ? "hover:bg-bg-hover"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                    }`}>
                    {totalUnread > 0 ? (
                      <Bell size={16} weight="fill" color="#E05C35" />
                    ) : (
                      <Bell size={16} />
                    )}
                    {totalUnread > 0 && (
                      <span
                        className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-white text-[10px] font-medium flex items-center justify-center"
                        style={{ backgroundColor: "#E05C35" }}>
                        {totalUnread > 99 ? "99+" : totalUnread}
                      </span>
                    )}
                  </button>
                  {bellOpen && renderBellDropdown()}
                </div>
              )}
              <div className="w-px h-4 bg-border mx-1" />
              <a
                href="https://convex.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                title="Convex Home">
                <House size={16} />
              </a>
              <a
                href="https://docs.convex.dev/components"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                title="Documentation">
                <FileTextIcon className="w-4 h-4" />
              </a>
              <a
                href="https://github.com/convex/convex-backend"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                title="GitHub">
                <GithubLogo size={16} />
              </a>
              <a
                href="https://discord.gg/convex"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                title="Discord">
                <DiscordLogo size={16} />
              </a>
            </nav>

            {/* Mobile search (always visible on mobile) */}
            <div className="sm:hidden flex items-center gap-1">
              <HeaderSearch />
              {renderViewToggle()}
            </div>

            {/* Mobile bell (always visible on mobile so the badge is reachable) */}
            {isAuthenticated && user && (
              <div ref={bellMobileRef} className="sm:hidden relative">
                <button
                  type="button"
                  onClick={() => setBellOpen((v) => !v)}
                  aria-label="Notifications"
                  className={`relative p-2 rounded-full transition-colors ${
                    totalUnread > 0
                      ? "hover:bg-bg-hover"
                      : "text-text-primary hover:bg-bg-hover"
                  }`}>
                  {totalUnread > 0 ? (
                    <Bell size={18} weight="fill" color="#E05C35" />
                  ) : (
                    <Bell size={18} />
                  )}
                  {totalUnread > 0 && (
                    <span
                      className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-white text-[10px] font-medium flex items-center justify-center"
                      style={{ backgroundColor: "#E05C35" }}>
                      {totalUnread > 99 ? "99+" : totalUnread}
                    </span>
                  )}
                </button>
                {bellOpen && renderBellDropdown()}
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 rounded-full text-text-primary hover:bg-bg-hover transition-colors">
              <List size={20} />
            </button>

            {/* Auth loading */}
            {authLoading && <div className="w-8 h-8 rounded-full bg-bg-hover animate-pulse" />}

            {/* Not authenticated */}
            {!authLoading && !isAuthenticated && (
              <button
                onClick={() => {
                  localStorage.setItem("authReturnPath", window.location.pathname);
                  signIn();
                }}
                className="px-4 py-1.5 rounded-full text-sm font-normal bg-button-dark text-white hover:bg-button-dark-hover transition-colors">
                Log in
              </button>
            )}

            {/* Authenticated - user menu */}
            {!authLoading && isAuthenticated && user && (
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1 p-1 rounded-full hover:bg-bg-hover transition-colors">
                  <div className="w-7 h-7 rounded-full bg-button text-white flex items-center justify-center text-xs font-medium">
                    {user.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <CaretDown
                    size={12}
                    className={`text-text-secondary transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-border bg-white shadow-lg py-1 z-50">
                    <a
                      href={`${basePath}/profile`}
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
                      <User size={16} />
                      My Submissions
                    </a>
                    <a
                      href="https://dashboard.convex.dev"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
                      <ArrowSquareOut size={16} />
                      Convex Dashboard
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav dropdown - outside the pill */}
      {mobileMenuOpen && (
        <div className="sm:hidden max-w-7xl mx-auto mt-2 px-4">
          <nav className="bg-white/95 backdrop-blur-sm border border-border rounded-2xl shadow-sm p-4 flex flex-col gap-2">
            <a
              href={basePath}
              className="px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-hover rounded-lg transition-colors">
              Directory
            </a>
            {/* External link to the Convex components docs */}
            <a
              href="https://docs.convex.dev/components/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-hover rounded-lg transition-colors">
              Build
            </a>
            {/* Component Preflight Check (open to guests with limits) */}
            <a
              href={`${basePath}/submit/check`}
              className="px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-hover rounded-lg transition-colors">
              Test
            </a>
            {isAdmin && (
              <>
                <a
                  href={`${basePath}/submissions`}
                  className="px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-hover rounded-lg transition-colors">
                  Submissions
                </a>
                <a
                  href={`${basePath}/submissions/admin`}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-hover rounded-lg transition-colors">
                  <GearSix size={14} />
                  Admin
                </a>
                <a
                  href={`${basePath}/documentation`}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-hover rounded-lg transition-colors">
                  <BookOpen size={14} />
                  Docs
                </a>
                <a
                  href={`${basePath}/dashboard`}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-hover rounded-lg transition-colors">
                  <ChartBar size={14} />
                  Dashboard
                </a>
              </>
            )}
            <a
              href={`${basePath}/submit`}
              className="px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-hover rounded-lg transition-colors">
              Submit
            </a>
            <div className="flex items-center gap-3 px-3 pt-3 border-t border-border mt-2">
              <a
                href="https://convex.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors">
                <House size={16} />
              </a>
              <a
                href="https://docs.convex.dev/components"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors">
                <FileTextIcon className="w-4 h-4" />
              </a>
              <a
                href="https://github.com/convex"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors">
                <GithubLogo size={16} />
              </a>
              <a
                href="https://discord.gg/convex"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors">
                <DiscordLogo size={16} />
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
