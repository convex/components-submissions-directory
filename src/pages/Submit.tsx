import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Toaster, toast } from "sonner";
import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Id } from "../../convex/_generated/dataModel";
import { useDirectoryCategories } from "../lib/categories";
import Header from "../components/Header";
import {
  Package,
  DownloadSimple,
  CalendarBlank,
  Copy,
  Check,
  ArrowSquareOut,
  Globe,
  Hourglass,
  GitPullRequest,
  CheckCircle,
  Warning,
  X,
  MagnifyingGlass,
  CaretDown,
  CaretUp,
  SortAscending,
  User,
  Prohibit,
  Star,
  Info,
  Browser,
} from "@phosphor-icons/react";
import { ExternalLinkIcon as RadixExternalLinkIcon, Cross2Icon } from "@radix-ui/react-icons";
import { RepoHostIcon } from "../components/RepoHostIcon";
import Tooltip from "../components/HoverTooltip";
import {
  isSupportedRepoUrl,
  parseRepoUrl,
  repoHostLabel,
  repoIssuesUrl,
} from "../../shared/repoUrl";

// Get base path for links (always /components)
function useBasePath() {
  return "/components";
}

// Review status type
type ReviewStatus = "pending" | "in_review" | "approved" | "changes_requested" | "rejected";

// Custom modal component for app-styled alerts
function CustomModal({
  isOpen,
  onClose,
  title,
  message,
  type = "error",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: "error" | "warning" | "success" | "info";
}) {
  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const iconConfig = {
    error: { icon: <X size={24} weight="bold" />, color: "text-red-600" },
    warning: {
      icon: <Warning size={24} weight="bold" />,
      color: "text-yellow-600",
    },
    success: {
      icon: <CheckCircle size={24} weight="bold" />,
      color: "text-green-600",
    },
    info: {
      icon: <Package size={24} weight="bold" />,
      color: "text-blue-600",
    },
  };

  const { icon, color } = iconConfig[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm p-6 rounded-container bg-white border border-border shadow-lg">
        <div className="flex items-start gap-3 mb-4">
          <div className={`shrink-0 ${color}`}>{icon}</div>
          <div>
            <h3 className="text-lg font-normal text-text-primary">{title}</h3>
            <p className="mt-1 text-sm text-text-secondary">{message}</p>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            autoFocus
            className="px-4 py-2 rounded-full text-sm font-normal bg-button text-white hover:bg-button-hover transition-colors focus:outline-none focus:ring-2 focus:ring-button/50">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// Review status badge component for frontend display
function ReviewStatusBadge({ status }: { status: ReviewStatus | undefined }) {
  const displayStatus = status || "pending";

  const config: Record<ReviewStatus, { icon: React.ReactNode; label: string; className: string }> =
    {
      pending: {
        icon: <Hourglass size={12} weight="bold" />,
        label: "Pending",
        className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
      },
      in_review: {
        icon: <GitPullRequest size={12} weight="bold" />,
        label: "In Review",
        className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      },
      approved: {
        icon: <CheckCircle size={12} weight="bold" />,
        label: "Approved",
        className: "bg-green-500/10 text-green-600 border-green-500/20",
      },
      changes_requested: {
        icon: <Warning size={12} weight="bold" />,
        label: "Changes",
        className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      },
      rejected: {
        icon: <Prohibit size={12} weight="bold" />,
        label: "Rejected",
        className: "bg-red-500/10 text-red-600 border-red-500/20",
      },
    };

  const { icon, label, className } = config[displayStatus];

  return (
    <Tooltip content={`Review Status: ${label}`}>
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </span>
    </Tooltip>
  );
}

function ApprovedDetailQuickLink({
  status,
  detailUrl,
}: {
  status: ReviewStatus | undefined;
  detailUrl?: string;
}) {
  if (status !== "approved" || !detailUrl) return null;

  return (
    <Tooltip content="Open component detail page" position="left">
      <a
        href={detailUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Open approved component detail page in a new tab"
        className="inline-flex items-center text-text-secondary hover:text-text-primary transition-colors">
        <RadixExternalLinkIcon className="w-3.5 h-3.5" />
      </a>
    </Tooltip>
  );
}

// Badge snippet component for showing README badge markdown in expanded rows
function BadgeSnippet({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const badgeMarkdown = `[![Convex Component](https://www.convex.dev/components/badge/${slug})](https://www.convex.dev/components/${slug})`;
  const badgeImageUrl = `https://www.convex.dev/components/badge/${slug}`;
  const badgeTargetUrl = `https://www.convex.dev/components/${slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(badgeMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="mt-4 pt-4 border-t border-border/50">
      <p className="text-xs text-text-secondary mb-2">Add badge to your README</p>
      <div className="flex items-center gap-2 rounded-md bg-[#1a1a1a] px-3 py-2 font-mono text-xs text-gray-300">
        <code className="flex-1 overflow-x-auto whitespace-nowrap">{badgeMarkdown}</code>
        <Tooltip content={copied ? "Copied!" : "Copy markdown"}>
          <button
            onClick={handleCopy}
            className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors">
            {copied ? (
              <Check size={14} className="text-green-400" />
            ) : (
              <Copy size={14} className="text-gray-400" />
            )}
          </button>
        </Tooltip>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-text-secondary">Preview:</span>
        <a href={badgeTargetUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={badgeImageUrl}
            alt="Convex Component badge"
            className="inline-block h-5"
          />
        </a>
      </div>
    </div>
  );
}

export default function App() {
  const basePath = useBasePath();
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [sortBy, setSortBy] = useState<"newest" | "downloads" | "updated">("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to close modals and collapse search
      if (e.key === "Escape") {
        setShowAboutModal(false);
        if (!searchTerm) setIsSearchExpanded(false);
      }
      // Cmd+K or Ctrl+K for search focus
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchExpanded(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchTerm]);

  const clearSearchFilter = () => {
    setSearchTerm("");
    setIsSearchExpanded(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      {/* Global header with auth */}
      <Header />

      {/* Page header - matching Directory.tsx style */}
      <header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
          <h1 className="text-2xl font-semibold text-text-primary mb-1">
            Components Submissions Directory
          </h1>
          <p className="text-sm text-text-secondary">
            Submissions are reviewed on a rolling basis.
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Toolbar above package listing */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-end sm:items-center mb-4">
            {/* Right: Controls */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
              {/* About button */}
              <Tooltip content="About this app">
                <button
                  onClick={() => setShowAboutModal(true)}
                  className="flex items-center justify-center w-9 h-9 rounded-full text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
                  <Info size={18} weight="bold" />
                </button>
              </Tooltip>

              {/* Expandable search input */}
              <Tooltip content="Search packages (⌘K)">
                <div className="relative flex items-center">
                  <div
                    className={`overflow-hidden transition-all duration-200 ease-out ${isSearchExpanded ? "w-48 mr-2 opacity-100" : "w-0 opacity-0"}`}>
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onBlur={() => {
                        if (!searchTerm) setIsSearchExpanded(false);
                      }}
                      className="w-full pl-3 pr-8 py-1.5 rounded-full border border-border bg-white text-text-primary text-sm outline-none focus:border-button transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setIsSearchExpanded(!isSearchExpanded);
                      if (!isSearchExpanded) {
                        setTimeout(() => searchInputRef.current?.focus(), 100);
                      }
                    }}
                    className={`flex items-center justify-center w-9 h-9 rounded-full text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors ${isSearchExpanded ? "bg-bg-hover" : ""}`}>
                    <MagnifyingGlass size={18} />
                  </button>
                </div>
              </Tooltip>
              {searchTerm.trim() && (
                <button
                  type="button"
                  onClick={clearSearchFilter}
                  className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800">
                  Clear filter
                </button>
              )}

              {/* Sort dropdown (custom) */}
              <div ref={sortRef} className="relative">
                <button
                  onClick={() => setSortOpen(!sortOpen)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-full text-sm border border-border bg-bg-card">
                  <SortAscending size={14} className="text-text-secondary" />
                  <span className="text-text-primary text-xs">
                    {sortBy === "newest"
                      ? "Newest"
                      : sortBy === "downloads"
                        ? "Downloads"
                        : "Updated"}
                  </span>
                  <CaretDown
                    size={10}
                    className={`text-text-secondary transition-transform ${sortOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {sortOpen && (
                  <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-border bg-white shadow-lg py-1 z-30">
                    {(
                      [
                        { value: "newest", label: "Newest" },
                        { value: "downloads", label: "Downloads" },
                        { value: "updated", label: "Updated" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setSortBy(opt.value);
                          setSortOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-bg-hover ${
                          sortBy === opt.value
                            ? "text-text-primary font-medium"
                            : "text-text-secondary"
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit button - links to auth-gated form */}
              <Tooltip content="Submit a new package">
                <a
                  href={`${basePath}/submit`}
                  className="px-4 py-1.5 rounded-full text-sm font-normal bg-button text-white hover:bg-button-hover transition-colors">
                  Submit
                </a>
              </Tooltip>
            </div>
          </div>

          {/* Package listing */}
          <Content searchTerm={searchTerm} sortBy={sortBy} />
        </div>
      </main>

      <Toaster />

      {/* About modal */}
      {showAboutModal && <AboutModal onClose={() => setShowAboutModal(false)} />}
    </div>
  );
}

// External link icon component
function ExternalLinkIcon() {
  return (
    <svg
      className="w-3 h-3 ml-1 inline-block opacity-50"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

// Convex-style Footer component matching convex.dev
function Footer() {
  return (
    <footer className="bg-[#141414] text-white mt-[100px]">
      {/* CTA Section */}
      <div className="mx-auto w-full max-w-[1536px] px-3 sm:px-5 md:px-8 lg:px-12">
        <div className="py-3 sm:py-5 md:py-8 lg:py-12">
          <div className="relative flex w-full flex-col items-center py-16 lg:py-32">
            {/* Heading */}
            <div className="z-10 mb-4 max-w-[16ch] text-balance text-center text-2xl font-bold leading-none tracking-tight text-white sm:mb-7 sm:text-4xl md:text-4xl lg:mb-9 xl:text-4xl">
              Get your app up and running in minutes
            </div>

            {/* Button */}
            <a
              className="rounded-full inline-block font-medium transition-colors whitespace-nowrap text-center py-3 z-10 bg-button hover:bg-button-hover px-8 text-xl text-white"
              href="https://convex.dev/start"
              target="_blank"
              rel="noopener noreferrer">
              Start building
            </a>

            {/* Grid background */}
            <div className="flex items-center justify-center absolute inset-0" aria-hidden="true">
              <div
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgb(215, 215, 215) 1px, transparent 1px), linear-gradient(rgb(215, 215, 215) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                  borderBottom: "1px solid rgb(215, 215, 215)",
                  borderRight: "1px solid rgb(215, 215, 215)",
                  borderTop: "1px solid rgb(215, 215, 215)",
                  borderLeft: "1px solid rgb(215, 215, 215)",
                  height: "504px",
                  opacity: 0.1,
                  width: "100%",
                  maxWidth: "1416px",
                }}
              />
            </div>

            {/* Decorative pixel images */}
            <img
              alt=""
              aria-hidden="true"
              loading="lazy"
              width="72"
              height="72"
              className="absolute left-0 top-[5%] size-9 lg:left-[20%] lg:top-[60%] lg:size-auto opacity-60"
              src="https://www.convex.dev/components/submit/pixel-cruiser.svg"
            />
            <img
              alt=""
              aria-hidden="true"
              loading="lazy"
              width="72"
              height="72"
              className="absolute -top-3 left-[70%] size-9 sm:-top-5 md:-top-8 lg:-top-12 lg:left-[55%] lg:size-auto opacity-60"
              src="https://www.convex.dev/components/submit/pixel-frame.svg"
            />
            <img
              alt=""
              aria-hidden="true"
              loading="lazy"
              width="72"
              height="72"
              className="absolute -right-3 top-[65%] size-9 sm:-right-5 md:-right-8 lg:right-[10%] lg:top-[80%] lg:size-auto opacity-60"
              src="https://www.convex.dev/components/submit/pixel-kernel.svg"
            />
            <img
              alt=""
              aria-hidden="true"
              loading="lazy"
              width="72"
              height="72"
              className="absolute -bottom-3 left-[20%] size-9 sm:-bottom-5 md:-bottom-8 lg:-left-9 lg:top-[10%] lg:size-auto opacity-60"
              src="https://www.convex.dev/components/submit/pixel-portal.svg"
            />
            <img
              alt=""
              aria-hidden="true"
              loading="lazy"
              width="72"
              height="72"
              className="absolute -right-9 top-[5%] hidden lg:block opacity-60"
              src="https://www.convex.dev/components/submit/pixel-burst.svg"
            />
          </div>
        </div>
      </div>

      {/* Footer Links */}
      <div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-16 items-start">
            {/* Logo Column */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-1 mb-6 lg:mb-0">
              <a
                href="https://convex.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block">
                <img
                  src="https://www.convex.dev/components/submit/wordmark-white.svg"
                  alt="Convex"
                  className="h-20 w-auto opacity-90 hover:opacity-100 transition-opacity"
                />
              </a>
            </div>

            {/* Product Column */}
            <div>
              <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-4">
                Product
              </h3>
              <ul className="space-y-3">
                <li>
                  <a
                    href="https://www.convex.dev/sync"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Sync
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/realtime"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Realtime
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/auth"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Auth
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/open-source"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Open source
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    AI coding
                  </a>
                </li>
                <li>
                  <a
                    href="https://chef.convex.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors inline-flex items-center">
                    Chef
                    <ExternalLinkIcon />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/faq"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    FAQ
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/pricing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>

            {/* Developers Column */}
            <div>
              <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-4">
                Developers
              </h3>
              <ul className="space-y-3">
                <li>
                  <a
                    href="https://docs.convex.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors inline-flex items-center">
                    Docs
                    <ExternalLinkIcon />
                  </a>
                </li>
                <li>
                  <a
                    href="https://news.convex.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors inline-flex items-center">
                    Blog
                    <ExternalLinkIcon />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/components"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Components
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/templates"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Templates
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/startups"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Startups
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/champions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Champions
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/changelog"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Changelog
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/podcast"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Podcast
                  </a>
                </li>
                <li>
                  <a
                    href="https://docs.convex.dev/llms.txt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors inline-flex items-center">
                    LLMs.txt
                    <ExternalLinkIcon />
                  </a>
                </li>
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-4">
                Company
              </h3>
              <ul className="space-y-3">
                <li>
                  <a
                    href="https://www.convex.dev/about"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    About us
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/brand"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Brand
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/investors"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Investors
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/partners"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Become a partner
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/jobs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Jobs
                  </a>
                </li>
                <li>
                  <a
                    href="https://news.convex.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors inline-flex items-center">
                    News
                    <ExternalLinkIcon />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/events"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Events
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Terms of service
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Privacy policy
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.convex.dev/security"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors">
                    Security
                  </a>
                </li>
              </ul>
            </div>

            {/* Social Column */}
            <div>
              <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-4">
                Social
              </h3>
              <ul className="space-y-3">
                <li>
                  <a
                    href="https://twitter.com/convabordev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors inline-flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Twitter
                    <ExternalLinkIcon />
                  </a>
                </li>
                <li>
                  <a
                    href="https://discord.gg/convex"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors inline-flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    Discord
                    <ExternalLinkIcon />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.youtube.com/@convex-dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors inline-flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                    YouTube
                    <ExternalLinkIcon />
                  </a>
                </li>
                <li>
                  <a
                    href="https://lu.ma/convex"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors inline-flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                      />
                    </svg>
                    Luma
                    <ExternalLinkIcon />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.linkedin.com/company/convex-dev/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors inline-flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    LinkedIn
                    <ExternalLinkIcon />
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/convex"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white hover:text-white/70 transition-colors inline-flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                    </svg>
                    GitHub
                    <ExternalLinkIcon />
                  </a>
                </li>
              </ul>

              {/* Trust Badges */}
              <div className="mt-10">
                <p className="text-xs text-white/40 mb-3">A Trusted Solution</p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-xs text-white/70">
                    <svg className="w-4 h-4 text-[#B4ED92]" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>
                      <strong className="text-white">SOC 2</strong> Type II Compliant
                    </span>
                  </li>
                  <li className="flex items-center gap-2 text-xs text-white/70">
                    <svg className="w-4 h-4 text-[#B4ED92]" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>
                      <strong className="text-white">HIPAA</strong> Compliant
                    </span>
                  </li>
                  <li className="flex items-center gap-2 text-xs text-white/70">
                    <svg className="w-4 h-4 text-[#B4ED92]" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>
                      <strong className="text-white">GDPR</strong> Verified
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-12 pt-8 border-t border-white/10">
            <p className="text-xs text-white/40">&copy;2025 Convex, Inc.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Success modal that auto-closes after 3 seconds
function SuccessModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // Auto-close after 3 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        zIndex: 2147483647,
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm p-6 rounded-container bg-white border border-border shadow-lg">
        <button
          onClick={onClose}
          autoFocus
          className="absolute top-4 right-4 p-1 rounded-full text-text-secondary hover:bg-bg-hover transition-colors focus:outline-none focus:ring-2 focus:ring-button/50">
          <X size={20} />
        </button>
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 text-green-600">
            <CheckCircle size={24} weight="bold" />
          </div>
          <div>
            <h3 className="text-lg font-normal text-text-primary">Thank You!</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Your component is now pending for review.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Submit Package Modal with iframe support
function SubmitPackageModal({ onClose }: { onClose: () => void }) {
  const [componentName, setComponentName] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [npmUrl, setNpmUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submitterDiscord, setSubmitterDiscord] = useState("");
  // Dynamic categories from DB
  const dynamicCategories = useDirectoryCategories();
  // New directory expansion fields
  const [category, setCategory] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  const [shortDescription, setShortDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [tags, setTags] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const submitPackage = useAction(api.packages.submitPackage);
  const generateUploadUrl = useMutation(api.packages.generateUploadUrl);
  const saveLogo = useMutation(api.packages.saveLogo);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showError && !showSuccess) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, showError, showSuccess]);

  // Close category dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const validateNpmUrl = (url: string): boolean => {
    const pattern = /^https?:\/\/(www\.)?npmjs\.com\/package\/.+/;
    return pattern.test(url);
  };

  const validateEmail = (email: string): boolean => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
  };

  const validateUrl = (url: string): boolean => {
    const pattern = /^https?:\/\/.+/;
    return pattern.test(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields (Discord is optional)
    if (
      !componentName.trim() ||
      !repositoryUrl.trim() ||
      !npmUrl.trim() ||
      !demoUrl.trim() ||
      !shortDescription.trim() ||
      !longDescription.trim() ||
      !submitterName.trim() ||
      !submitterEmail.trim()
    ) {
      setErrorMessage("Please fill in all required fields.");
      setShowError(true);
      return;
    }

    if (!isSupportedRepoUrl(repositoryUrl.trim())) {
      setErrorMessage(
        "Please enter a valid GitHub or GitLab repository URL. Expected format: https://github.com/owner/repo or https://gitlab.com/owner/repo"
      );
      setShowError(true);
      return;
    }

    if (!validateNpmUrl(npmUrl.trim())) {
      setErrorMessage(
        "Please enter a valid npm URL. Expected format: https://www.npmjs.com/package/package-name"
      );
      setShowError(true);
      return;
    }

    if (!validateEmail(submitterEmail.trim())) {
      setErrorMessage("Please enter a valid email address.");
      setShowError(true);
      return;
    }

    if (!validateUrl(demoUrl.trim())) {
      setErrorMessage(
        "Please enter a valid URL for the live demo (must start with http:// or https://)."
      );
      setShowError(true);
      return;
    }

    setIsLoading(true);
    try {
      const payload: Parameters<typeof submitPackage>[0] = {
        repositoryUrl: repositoryUrl.trim(),
        npmUrl: npmUrl.trim(),
        submitterName: submitterName.trim(),
        submitterEmail: submitterEmail.trim(),
        submitterDiscord: submitterDiscord.trim() || undefined,
        demoUrl: demoUrl.trim(),
        componentName: componentName.trim(),
        category: category || undefined,
        shortDescription: shortDescription.trim(),
        longDescription: longDescription.trim(),
        tags: tags.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
      };
      const packageId = await submitPackage(payload);

      // Upload logo if provided, then trigger auto thumbnail generation
      if (logoFile && packageId) {
        try {
          const uploadUrl = await generateUploadUrl();
          const uploadResult = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": logoFile.type },
            body: logoFile,
          });
          if (uploadResult.ok) {
            const { storageId } = await uploadResult.json();
            await saveLogo({ packageId, storageId });
          }
        } catch {
          // Logo upload is non-critical, don't fail the submission
        }
      }
      setShowSuccess(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit package";
      setErrorMessage(message);
      setShowError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle success modal close
  const handleSuccessClose = () => {
    setShowSuccess(false);
    onClose();
  };

  return (
    <>
      {/* Modal container with high z-index for iframe support - hide when success is showing */}
      {!showSuccess && (
        <div
          className="fixed inset-0 flex items-start justify-center pt-8 sm:pt-12 p-4 overflow-y-auto"
          style={{
            zIndex: 2147483647,
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          {/* Modal for submit package form*/}
          {/* submit package form container*/}
          <div className="relative w-full max-w-md p-6 rounded-container bg-[#FAF5EA] border border-border shadow-lg">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-full text-text-secondary hover:bg-bg-hover transition-colors focus:outline-none focus:ring-2 focus:ring-button/50">
              <X size={20} />
            </button>
            <h2 className="text-xl font-normal text-text-primary mb-4">
              Submit a npm Package for Review
            </h2>
            <p className="text-sm text-text-secondary mb-6">
              Submit your npm package to the Convex components directory for review.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Component Name */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Component Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Component Name"
                  value={componentName}
                  onChange={(e) => setComponentName(e.target.value)}
                  required
                  disabled={isLoading}
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg-primary text-text-primary text-sm outline-none transition-all disabled:opacity-50 focus:border-button focus:ring-2 focus:ring-button/20"
                />
              </div>

              {/* Repository URL (GitHub or GitLab) */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Repository URL <span className="text-red-500">*</span>
                  <span className="ml-1.5 text-xs font-normal text-text-secondary">GitHub or GitLab</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">
                    <RepoHostIcon repositoryUrl={repositoryUrl} size={16} />
                  </span>
                  <input
                    type="text"
                    placeholder="https://github.com/owner/repo"
                    value={repositoryUrl}
                    onChange={(e) => setRepositoryUrl(e.target.value)}
                    required
                    disabled={isLoading}
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-bg-primary text-text-primary text-sm outline-none transition-all disabled:opacity-50 focus:border-button focus:ring-2 focus:ring-button/20"
                  />
                </div>
              </div>

              {/* NPM URL */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  npm package URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="https://www.npmjs.com/package/your-package"
                  value={npmUrl}
                  onChange={(e) => setNpmUrl(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg-primary text-text-primary text-sm outline-none transition-all disabled:opacity-50 focus:border-button focus:ring-2 focus:ring-button/20"
                />
              </div>

              {/* Live Demo URL */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Live Demo URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="https://your-demo-site.com"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg-primary text-text-primary text-sm outline-none transition-all disabled:opacity-50 focus:border-button"
                />
              </div>

              {/* Category dropdown (custom) */}
              <div ref={categoryRef} className="relative">
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Category{" "}
                  <span className="text-text-secondary text-xs font-normal">(optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => !isLoading && setCategoryOpen(!categoryOpen)}
                  disabled={isLoading}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-border bg-bg-primary text-sm outline-none transition-all disabled:opacity-50 focus:border-button focus:ring-2 focus:ring-button/20">
                  <span className={category ? "text-text-primary" : "text-text-secondary"}>
                    {category
                      ? dynamicCategories.find((c) => c.id === category)?.label || category
                      : "Select a category"}
                  </span>
                  <CaretDown
                    size={14}
                    className={`text-text-secondary transition-transform ${categoryOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {categoryOpen && (
                  <div className="absolute z-30 left-0 right-0 top-full mt-1 rounded-lg border border-border bg-white shadow-lg py-1 max-h-56 overflow-y-auto">
                    {[{ id: "", label: "Select a category" }, ...dynamicCategories].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setCategory(opt.id);
                          setCategoryOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-bg-hover ${
                          category === opt.id
                            ? "text-text-primary font-medium"
                            : "text-text-secondary"
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Short description */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Short Description <span className="text-red-500">*</span>{" "}
                  <span className="text-text-secondary text-xs font-normal">
                    (200 chars max)
                  </span>
                </label>
                <div className="relative">
                  <textarea
                    placeholder="One-line summary of your component"
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value.slice(0, 200))}
                    required
                    disabled={isLoading}
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg-primary text-text-primary text-sm outline-none transition-all disabled:opacity-50 focus:border-button resize-none"
                  />
                  <span className="absolute bottom-2 right-3 text-[10px] text-text-secondary">
                    {shortDescription.length}/200
                  </span>
                </div>
              </div>

              {/* Long description */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Long Description <span className="text-red-500">*</span>{" "}
                  <span className="text-text-secondary text-xs font-normal">
                    (not your README text. Explain what this component is for and how it is useful.)
                  </span>
                </label>
                <textarea
                  placeholder="Detailed description of your component. Markdown is supported."
                  value={longDescription}
                  onChange={(e) => setLongDescription(e.target.value)}
                  required
                  disabled={isLoading}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg-primary text-text-primary text-sm outline-none transition-all disabled:opacity-50 focus:border-button resize-y"
                />
              </div>

              {/* Keywords (max 5) */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Keywords{" "}
                  <span className="text-text-secondary text-xs font-normal">
                    (optional, comma-separated, max 5)
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="ai, real-time, database"
                  value={tags}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Allow typing but enforce max 5 keywords
                    const parts = val.split(",");
                    if (parts.length > 5) return;
                    setTags(val);
                  }}
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg-primary text-text-primary text-sm outline-none transition-all disabled:opacity-50 focus:border-button"
                />
                <p className="text-[10px] text-text-secondary mt-1">
                  {tags.split(",").filter((t) => t.trim()).length}/5 keywords used
                </p>
              </div>

              {/* Video demo URL */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Video Demo URL{" "}
                  <span className="text-text-secondary text-xs font-normal">
                    (optional, YouTube or Loom)
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="https://youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg-primary text-text-primary text-sm outline-none transition-all disabled:opacity-50 focus:border-button"
                />
              </div>

              {/* Component logo upload */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Component Logo{" "}
                  <span className="text-text-secondary text-xs font-normal">
                    (optional, max 3MB, .png/.webp/.svg)
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  {logoFile && (
                    <span className="text-xs text-text-secondary truncate max-w-[200px]">
                      {logoFile.name}
                    </span>
                  )}
                  <label className="cursor-pointer text-sm px-4 py-2 rounded-lg bg-bg-primary text-text-primary hover:bg-bg-hover transition-colors">
                    {logoFile ? "Change file" : "Choose file"}
                    <input
                      type="file"
                      accept=".png,.webp,.svg"
                      className="hidden"
                      disabled={isLoading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (
                          !["image/png", "image/webp", "image/svg+xml"].includes(
                            file.type,
                          )
                        ) {
                          toast.error(
                            "Only .png, .webp, and .svg files are allowed",
                          );
                          return;
                        }
                        if (file.size > 3 * 1024 * 1024) {
                          toast.error("File must be under 3MB");
                          return;
                        }
                        setLogoFile(file);
                      }}
                    />
                  </label>
                  {logoFile && (
                    <button
                      type="button"
                      onClick={() => setLogoFile(null)}
                      className="text-xs text-text-secondary hover:text-text-primary">
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg-primary text-text-primary text-sm outline-none transition-all disabled:opacity-50 focus:border-button"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-text-secondary mb-2">
                  Not displayed publicly. Used by the Convex team to contact you about your
                  submission.
                </p>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={submitterEmail}
                  onChange={(e) => setSubmitterEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg-primary text-text-primary text-sm outline-none transition-all disabled:opacity-50 focus:border-button"
                />
              </div>

              {/* Discord - Optional */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Convex Discord Username{" "}
                  <span className="text-text-secondary text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="username#1234 or @username"
                  value={submitterDiscord}
                  onChange={(e) => setSubmitterDiscord(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg-primary text-text-primary text-sm outline-none transition-all disabled:opacity-50 focus:border-button"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 rounded-full font-normal bg-button text-white hover:bg-button-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                {isLoading ? "Submitting..." : "Submit Package"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Error modal */}
      <CustomModal
        isOpen={showError}
        onClose={() => setShowError(false)}
        title="Submission Error"
        message={errorMessage}
        type="error"
      />

      {/* Success modal */}
      <SuccessModal isOpen={showSuccess} onClose={handleSuccessClose} />
    </>
  );
}

// About Modal component with app description and status legend
function AboutModal({ onClose }: { onClose: () => void }) {
  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const statusItems = [
    {
      icon: <Hourglass size={14} weight="bold" />,
      label: "Pending",
      description: "Awaiting initial review",
      className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    },
    {
      icon: <GitPullRequest size={14} weight="bold" />,
      label: "In Review",
      description: "Currently being evaluated",
      className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    },
    {
      icon: <CheckCircle size={14} weight="bold" />,
      label: "Approved",
      description: "Ready to be featured",
      className: "bg-green-500/10 text-green-600 border-green-500/20",
    },
    {
      icon: <Warning size={14} weight="bold" />,
      label: "Changes Requested",
      description: "Needs updates before approval",
      className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    },
    {
      icon: <Prohibit size={14} weight="bold" />,
      label: "Rejected",
      description: "Does not meet requirements",
      className: "bg-red-500/10 text-red-600 border-red-500/20",
    },
    {
      icon: <Star size={14} weight="fill" />,
      label: "Featured",
      description: "Highlighted on convex.dev/components",
      className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-12 p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 rounded-container bg-[#FAF5EA] border border-border shadow-lg">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-text-secondary hover:bg-bg-hover transition-colors focus:outline-none focus:ring-2 focus:ring-button/50">
          <X size={20} />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-medium text-text-primary mb-2">About This App</h2>
          <p className="text-sm text-text-secondary">
            A community directory for npm packages built with Convex.
          </p>
        </div>

        {/* Description */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-primary mb-2">How It Works</h3>
          <div className="space-y-2 text-sm text-text-secondary">
            <p>
              Developers submit their Convex components via npm URL. Each submission goes through a
              review process before appearing on the{" "}
              <a
                href="https://www.convex.dev/components"
                target="_blank"
                rel="noopener noreferrer"
                className="text-button hover:underline">
                Convex Components
              </a>{" "}
              page.
            </p>
            <p>
              Featured packages are hand picked and highlighted with a star icon, showcasing the
              best community contributions.
            </p>
          </div>
        </div>

        {/* Status Legend */}
        <div>
          <h3 className="text-sm font-medium text-text-primary mb-3">Status Legend</h3>
          <div className="space-y-2">
            {statusItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 p-2 rounded-lg bg-bg-primary/50">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${item.className}`}>
                  {item.icon}
                  {item.label}
                </span>
                <span className="text-xs text-text-secondary">{item.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Badges */}
        <div className="mt-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">Badges</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-bg-primary/50">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: "rgb(203, 237, 182)", color: "rgb(34, 137, 9)" }}>
                Convex Verified
              </span>
              <span className="text-xs text-text-secondary">Reviewed and verified by the Convex team</span>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-bg-primary/50">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: "#E9DDC2", color: "rgb(87, 74, 48)" }}>
                Community
              </span>
              <span className="text-xs text-text-secondary">Submitted by a community member</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-border"></div>
      </div>
    </div>
  );
}

// Status Legend Bar component above footer
function StatusLegendBar() {
  const statusItems = [
    { label: "Pending", color: "bg-yellow-500" },
    { label: "In Review", color: "bg-blue-500" },
    { label: "Approved", color: "bg-green-500" },
    { label: "Changes", color: "bg-orange-500" },
    { label: "Rejected", color: "bg-red-500" },
    { label: "Featured", color: "bg-amber-500" },
  ];

  return (
    <div className="relative">
      {/* Grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(215, 215, 215) 1px, transparent 1px), linear-gradient(rgb(215, 215, 215) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          borderTop: "1px solid rgb(215, 215, 215)",
          borderBottom: "1px solid rgb(215, 215, 215)",
          opacity: 0.4,
        }}
      />
      {/* Content */}
      <div className="relative px-4 sm:px-6 py-4 bg-bg-primary/80">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Status
          </span>
          {statusItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
              <span className="text-xs text-text-secondary">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Content({
  searchTerm,
  sortBy,
}: {
  searchTerm: string;
  sortBy: "newest" | "downloads" | "updated";
}) {
  const [expandedCard, setExpandedCard] = useState<Id<"packages"> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const submitPageSizeSetting = useQuery(api.packages.getSubmitPageSizeSetting);
  const pageSize = submitPageSizeSetting?.defaultPageSize ?? 40;
  const trimmedSearchTerm = searchTerm.trim();

  // Reset to first page when search, sorting, or default page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [trimmedSearchTerm, sortBy, pageSize]);

  // Use paginated search query when searching, otherwise paginated list query
  const searchResults = useQuery(api.packages.searchSubmitPackagesPage, {
    searchTerm: trimmedSearchTerm,
    sortBy,
    page: currentPage,
    pageSize,
  });
  const listResults = useQuery(api.packages.getSubmitPackagesPage, {
    sortBy,
    page: currentPage,
    pageSize,
  });

  const pageData = trimmedSearchTerm ? searchResults : listResults;
  const packages = pageData?.items;
  const totalPages = pageData?.totalPages ?? 1;
  const totalPackages = pageData?.total ?? 0;
  const rangeStart = totalPackages === 0 ? 0 : (pageData!.page - 1) * pageData!.pageSize + 1;
  const rangeEnd =
    totalPackages === 0
      ? 0
      : Math.min(pageData!.page * pageData!.pageSize, totalPackages);

  // Keep current page valid if data size shrinks
  useEffect(() => {
    if (pageData && currentPage !== pageData.page) {
      setCurrentPage(pageData.page);
    }
  }, [pageData, currentPage]);

  return (
    <>
      {/* Packages table/list */}
      <div className="rounded-lg border border-border bg-light overflow-hidden shadow-sm">
        {/* Table header for desktop */}
        <div className="hidden md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-3 px-4 py-3 bg-bg-card text-xs font-medium text-text-secondary uppercase tracking-wide border-b border-border">
          <div>Package</div>
          <div>Maintainer</div>
          <div>Downloads</div>
          <div>Submitted</div>
          <div>Status</div>
        </div>

        {/* Package rows */}
        {packages === undefined ? (
          <LoadingSkeleton />
        ) : packages.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Package size={48} className="mx-auto mb-3 text-text-secondary" />
            <h3 className="text-lg font-light mb-1 text-text-primary">No packages found</h3>
            <p className="text-sm text-text-secondary">
              {trimmedSearchTerm ? "Try a different search term" : "Be the first to submit a package!"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {packages.map((pkg) => (
              <PackageRow
                key={pkg._id}
                package={pkg}
                isExpanded={expandedCard === pkg._id}
                onToggle={() => setExpandedCard(expandedCard === pkg._id ? null : pkg._id)}
              />
            ))}
          </div>
        )}
      </div>

      {packages && totalPages > 0 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-secondary">
            Showing {rangeStart}-{rangeEnd} of {totalPackages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Previous
            </button>
            <span className="text-xs text-text-secondary">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="px-4 py-3 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-4 rounded bg-bg-hover w-32 mb-2"></div>
              <div className="h-3 rounded bg-bg-hover w-48"></div>
            </div>
            <div className="h-4 w-16 rounded bg-bg-hover"></div>
            <div className="h-4 w-20 rounded bg-bg-hover"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Security report modal (matches ComponentDetail.tsx pattern)
function SubmitSecurityReportModal({
  onClose,
  scanData,
  repositoryUrl,
}: {
  onClose: () => void;
  scanData: {
    status: string;
    summary?: string;
    findingCount: number;
    providerCount: number;
    lastScannedAt?: number;
    findings: Array<{
      severity: string;
      title: string;
      description: string;
      recommendation: string;
      provider: string;
    }>;
    recommendations: string[];
    providerStatuses: {
      socket?: string;
      snyk?: string;
    };
  };
  repositoryUrl?: string;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);

  // Issues link for GitHub (/issues) or GitLab (/-/issues)
  const parsedRepo = parseRepoUrl(repositoryUrl);
  const repoIssuesHref = parsedRepo ? repoIssuesUrl(parsedRepo) : null;
  const repoHostName = repoHostLabel(repositoryUrl);

  const providerNames: Record<string, string> = {
    socket: "Socket.dev",
    snyk: "Snyk",
  };
  const providerUrls: Record<string, string> = {
    socket: "https://socket.dev",
    snyk: "https://snyk.io",
  };
  const hasFindings = scanData.findings.length > 0 || scanData.recommendations.length > 0;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center p-4 pt-8 sm:pt-12"
      aria-modal="true"
      role="dialog"
    >
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[121] max-h-[calc(100vh-4rem)] w-full max-w-md overflow-y-auto rounded-container border border-border bg-white p-6 shadow-lg">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-text-secondary hover:bg-bg-hover transition-colors"
          aria-label="Close security report"
        >
          <Cross2Icon className="w-4 h-4" />
        </button>

        <div className="mb-5 pr-8">
          <h2 className="text-lg font-medium text-text-primary">Community scan via Socket</h2>
        </div>

        <div className="space-y-4">
          {scanData.status === "not_scanned" && (
            <section className="rounded-lg border border-border bg-bg-secondary px-3 py-3">
              <p className="text-sm text-text-secondary leading-relaxed">
                This component has not been scanned yet. Review the repository and package details
                before installing it.
              </p>
            </section>
          )}

          {Object.entries(scanData.providerStatuses).some(([, v]) => v) && (
            <section>
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-primary mb-2">
                Providers
              </h3>
              <p className="mb-2 text-xs text-text-secondary">
                You can run your own scan with the providers below.
              </p>
              <div className="space-y-1">
                {Object.entries(scanData.providerStatuses).map(([key, status]) => {
                  if (!status) return null;
                  const providerLabel = providerNames[key] || key;
                  const providerUrl = providerUrls[key];
                  return (
                    <div key={key} className="text-sm">
                      {providerUrl ? (
                        <a
                          href={providerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-text-primary hover:underline"
                          title={`Open ${providerLabel} to run your own scan`}
                        >
                          {providerLabel}
                          <RadixExternalLinkIcon className="w-3 h-3 text-text-secondary" />
                        </a>
                      ) : (
                        <span className="text-text-primary">{providerLabel}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {scanData.recommendations.length > 0 && (
            <section>
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-primary mb-1.5">
                Recommendations
              </h3>
              <ul className="list-disc list-inside space-y-1">
                {scanData.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-xs text-text-secondary">
                    {rec}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasFindings && (
            <section>
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-primary mb-1.5">
                Contact the component author
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                For security concerns, dependency issues, or vulnerability reports, contact the
                component author through the {repoHostName === "Repository" ? "source" : repoHostName} repository.
              </p>
              {repoIssuesHref ? (
                <a
                  href={repoIssuesHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm text-text-primary hover:underline"
                >
                  <RepoHostIcon repositoryUrl={repositoryUrl} size={16} />
                  Open {repoHostName} Issues
                  <RadixExternalLinkIcon className="w-3 h-3 text-text-secondary" />
                </a>
              ) : repositoryUrl ? (
                <a
                  href={repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm text-text-primary hover:underline"
                >
                  <RepoHostIcon repositoryUrl={repositoryUrl} size={16} />
                  View repository
                  <RadixExternalLinkIcon className="w-3 h-3 text-text-secondary" />
                </a>
              ) : (
                <p className="mt-2 text-xs text-text-secondary">
                  If no repository link is listed here, use the package links provided by the author.
                </p>
              )}
            </section>
          )}

          <section className="rounded-lg border border-border bg-bg-secondary px-3 py-3">
            <h3 className="text-xs font-medium text-text-primary mb-1">Third party component notice</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              This is a community or third-party component. It is not maintained by Convex and does not
              undergo the same level of review as official Convex packages. Use at your own discretion.
            </p>
          </section>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm font-normal border border-border text-text-primary hover:bg-bg-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Security button that loads scan data on demand
function SecurityAnalyzeButton({ packageId, repositoryUrl }: { packageId: string; repositoryUrl?: string }) {
  const [showModal, setShowModal] = useState(false);
  const scanData = useQuery(api.packages.getLatestSecurityScan, {
    packageId: packageId as any,
  });

  if (!scanData) return null;

  const label = scanData.status === "scanning"
    ? "Scanning..."
    : scanData.status === "not_scanned"
      ? "Security"
      : "Security";

  return (
    <>
      <Tooltip content="View security scan report" position="right">
        <button
          onClick={() => setShowModal(true)}
          disabled={scanData.status === "scanning"}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-normal border border-border text-text-primary hover:bg-bg-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {label}
        </button>
      </Tooltip>
      {showModal &&
        createPortal(
          <SubmitSecurityReportModal
            onClose={() => setShowModal(false)}
            scanData={scanData}
            repositoryUrl={repositoryUrl}
          />,
          document.body,
        )}
    </>
  );
}

// Condensed package row component
function PackageRow({
  package: pkg,
  isExpanded,
  onToggle,
}: {
  package: any;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  const formatDownloads = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toLocaleString();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pkg.installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get first maintainer
  const firstMaintainer = pkg.collaborators?.[0];
  const basePath = window.location.pathname.startsWith("/components") ? "/components" : "";
  const detailUrl = pkg.slug ? `${basePath}/${pkg.slug}` : undefined;
  const publishedDate = pkg.lastPublish ? new Date(pkg.lastPublish) : null;
  const submittedDate = new Date(pkg.submittedAt);

  return (
    <div className="hover:bg-bg-card/50">
      {/* Clickable row */}
      <div className="px-4 py-3 cursor-pointer" onClick={onToggle}>
        {/* Mobile layout */}
        <div className="md:hidden">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {pkg.featured && (
                  <Tooltip content="Featured on convex.dev/components">
                    <Star size={14} weight="fill" className="text-amber-500 shrink-0" />
                  </Tooltip>
                )}
                <h3 className="text-sm font-medium text-text-primary truncate">{pkg.name}</h3>
                <span className="text-xs px-1.5 py-0.5 rounded bg-bg-primary text-text-secondary shrink-0">
                  v{pkg.version}
                </span>
              </div>
              <p className="text-xs text-text-secondary line-clamp-1">{pkg.description}</p>
            </div>
            <div className="shrink-0">
              {isExpanded ? (
                <CaretUp size={16} className="text-text-secondary" />
              ) : (
                <CaretDown size={16} className="text-text-secondary" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            {firstMaintainer && (
              <Tooltip content={`Maintainer: ${firstMaintainer.name}`}>
                <span className="flex items-center gap-1">
                  <User size={12} className="text-text-secondary" />
                  <span className="truncate max-w-16">{firstMaintainer.name}</span>
                </span>
              </Tooltip>
            )}
            <Tooltip content="Weekly downloads">
              <span className="flex items-center gap-1">
                <DownloadSimple size={12} />
                {formatDownloads(pkg.weeklyDownloads)}
              </span>
            </Tooltip>
            <span className="inline-flex items-center gap-1.5">
              <ReviewStatusBadge status={pkg.reviewStatus} />
              <ApprovedDetailQuickLink status={pkg.reviewStatus} detailUrl={detailUrl} />
            </span>
          </div>
        </div>

        {/* Desktop table layout */}
        <div className="hidden md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-3 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {pkg.featured && (
                <Tooltip content="Featured on convex.dev/components">
                  <Star size={14} weight="fill" className="text-amber-500 shrink-0" />
                </Tooltip>
              )}
              <h3 className="text-sm font-medium text-text-primary truncate">{pkg.name}</h3>
              <span className="inline-flex items-center text-xs leading-none px-1.5 py-0.5 rounded bg-bg-primary text-text-secondary shrink-0">
                v{pkg.version}
              </span>
              {isExpanded ? (
                <CaretUp size={14} className="text-text-secondary shrink-0" />
              ) : (
                <CaretDown size={14} className="text-text-secondary shrink-0" />
              )}
            </div>
            <p className="text-xs text-text-secondary line-clamp-1">{pkg.description}</p>
          </div>
          <div className="min-w-0">
            {firstMaintainer ? (
              <Tooltip content={`Maintainer: ${firstMaintainer.name}`} position="top">
                <span className="text-sm text-text-primary truncate block">
                  {firstMaintainer.name}
                </span>
              </Tooltip>
            ) : (
              <span className="text-sm text-text-secondary">—</span>
            )}
          </div>
          <div className="flex h-7 items-center">
            <Tooltip content="Weekly downloads from npm" position="top">
              <span className="inline-flex items-center text-sm text-text-primary">
                {formatDownloads(pkg.weeklyDownloads)}
              </span>
            </Tooltip>
          </div>
          <div className="flex h-7 items-center">
            <Tooltip
              content={`Submitted to app: ${submittedDate.toLocaleDateString()}`}
              position="top">
              <span className="inline-flex items-center text-sm text-text-primary">
                {formatRelativeTime(submittedDate.toISOString())}
              </span>
            </Tooltip>
          </div>
          <div className="flex h-7 items-center">
            <span className="inline-flex items-center gap-1.5">
              <ReviewStatusBadge status={pkg.reviewStatus} />
              <ApprovedDetailQuickLink status={pkg.reviewStatus} detailUrl={detailUrl} />
            </span>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div
          className="px-4 pb-4 pt-2 border-t border-border bg-bg-hover/30"
          onClick={(e) => e.stopPropagation()}>
          {/* Install command */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-light mb-4">
            <code className="flex-1 text-sm text-text-primary overflow-x-auto">
              {pkg.installCommand}
            </code>
            <Tooltip content={copied ? "Copied!" : "Copy install command"}>
              <button
                onClick={copyToClipboard}
                className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded-full transition-colors text-white shrink-0 ${
                  copied ? "bg-accent" : "bg-button"
                }`}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
              </button>
            </Tooltip>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm mb-4">
            <Tooltip content="Package license type">
              <div>
                <span className="block text-xs text-text-secondary mb-0.5">License</span>
                <span className="text-text-primary">{pkg.license}</span>
              </div>
            </Tooltip>
            <Tooltip content="Unpacked package size">
              <div>
                <span className="block text-xs text-text-secondary mb-0.5">Size</span>
                <span className="text-text-primary">{formatSize(pkg.unpackedSize)}</span>
              </div>
            </Tooltip>
            <Tooltip content="Number of files in package">
              <div>
                <span className="block text-xs text-text-secondary mb-0.5">Files</span>
                <span className="text-text-primary">{pkg.totalFiles.toLocaleString()}</span>
              </div>
            </Tooltip>
            <Tooltip
              content={
                publishedDate
                  ? `Last published on npm: ${publishedDate.toLocaleDateString()}`
                  : "No npm publish date available"
              }>
              <div>
                <span className="block text-xs text-text-secondary mb-0.5">Published</span>
                <span className="text-text-primary">
                  {publishedDate ? publishedDate.toLocaleDateString() : "—"}
                </span>
              </div>
            </Tooltip>
            <Tooltip content="When this package was submitted to the directory">
              <div>
                <span className="block text-xs text-text-secondary mb-0.5">Submitted</span>
                <span className="text-text-primary">{submittedDate.toLocaleDateString()}</span>
              </div>
            </Tooltip>
          </div>

          {/* Maintainers */}
          {pkg.collaborators.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-text-secondary mb-2">Maintainers</p>
              <div className="flex flex-wrap gap-2">
                {pkg.collaborators.slice(0, 6).map((collab: any, idx: number) => (
                  <Tooltip key={idx} content={collab.name}>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-bg-primary">
                      <img src={collab.avatar} alt={collab.name} className="w-4 h-4 rounded-full" />
                      <span className="text-xs text-text-secondary truncate max-w-20">
                        {collab.name}
                      </span>
                    </div>
                  </Tooltip>
                ))}
                {pkg.collaborators.length > 6 && (
                  <span className="text-xs self-center text-text-secondary">
                    +{pkg.collaborators.length - 6} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Tooltip content="View package on npm" position="right">
              <a
                href={pkg.npmUrl}
                onClick={(e) => {
                  e.preventDefault();
                  window.open(pkg.npmUrl, "_blank", "noopener,noreferrer");
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-normal bg-button text-white hover:bg-button-hover transition-colors cursor-pointer">
                <ArrowSquareOut size={16} />
                npm
              </a>
            </Tooltip>
            {pkg.repositoryUrl && (
              <Tooltip content="View source code" position="right">
                <a
                  href={pkg.repositoryUrl}
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(pkg.repositoryUrl, "_blank", "noopener,noreferrer");
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-normal border border-border text-text-primary hover:bg-bg-hover transition-colors cursor-pointer">
                  <RepoHostIcon repositoryUrl={pkg.repositoryUrl} size={16} />
                  Repo
                </a>
              </Tooltip>
            )}
            {pkg.homepageUrl && (
              <Tooltip content="Visit homepage" position="right">
                <a
                  href={pkg.homepageUrl}
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(pkg.homepageUrl, "_blank", "noopener,noreferrer");
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-normal border border-border text-text-primary hover:bg-bg-hover transition-colors cursor-pointer">
                  <Globe size={16} />
                  Website
                </a>
              </Tooltip>
            )}
            {pkg.demoUrl && (
              <Tooltip content="View live demo" position="right">
                <a
                  href={pkg.demoUrl}
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(pkg.demoUrl, "_blank", "noopener,noreferrer");
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-normal border border-border text-text-primary hover:bg-bg-hover transition-colors cursor-pointer">
                  <Browser size={16} />
                  Demo
                </a>
              </Tooltip>
            )}
            <SecurityAnalyzeButton packageId={pkg._id} repositoryUrl={pkg.repositoryUrl} />
          </div>

          {/* Badge snippet for README - show only when slug exists */}
          {pkg.slug && <BadgeSnippet slug={pkg.slug} />}
        </div>
      )}
    </div>
  );
}

