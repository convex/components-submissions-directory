// Component detail page at /components/:slug
// Layout: narrow sidebar left with thumbnail + metadata, content right
import {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { InstallCommand } from "../components/InstallCommand";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { CommunityBadge } from "../components/CommunityBadge";
import Header from "../components/Header";
import ComponentDetailSkeleton from "../components/ComponentDetailSkeleton";
import CodeBlock from "../components/CodeBlockLazy";
import { Markdown } from "../components/Markdown";
import { preloadMarkdown } from "../lib/markdownChunk";
import { useDirectoryCategories } from "../lib/categories";
import { useComponentBySlug } from "../lib/convexHttp";
import { buildComponentClientUrls } from "../../shared/componentUrls";
import {
  setComponentSeoTags,
  setRobotsTag,
  injectJsonLd,
  removeJsonLd,
  buildComponentJsonLd,
} from "../lib/seo";
import { RepoHostIcon } from "../components/RepoHostIcon";
import {
  canonicalGithubOwner,
  parseRepoUrl,
  repoHostLabel,
  repoIssuesUrl,
  repoOwnerUrl,
} from "../../shared/repoUrl";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  DownloadIcon,
  CopyIcon,
  CheckIcon,
  ChevronDownIcon,
  FileTextIcon,
  ClipboardIcon,
  QuestionMarkCircledIcon,
  Cross2Icon,
  Share1Icon,
} from "@radix-ui/react-icons";
import { AgentInstallSection } from "../components/AgentInstallSection";
import {
  DETAIL_THUMBNAIL,
  avatarUrl,
  thumbnailImageProps,
} from "../lib/images";
import { FileArrowDown, ClipboardText, DiscordLogo } from "@phosphor-icons/react";

class MarkdownErrorBoundary extends Component<
  { children: ReactNode; label: string },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: ReactNode; label: string }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[MarkdownErrorBoundary:${this.props.label}]`, error, info);
  }
  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

const AI_READ_PROMPT = "Read this URL and summarize it:";

interface ComponentDetailProps {
  slug: string;
}

type ReviewStatus = "pending" | "in_review" | "approved" | "changes_requested" | "rejected";

function getReviewStatus(reviewStatus?: string): ReviewStatus {
  switch (reviewStatus) {
    case "in_review":
    case "approved":
    case "changes_requested":
    case "rejected":
      return reviewStatus;
    default:
      return "pending";
  }
}

function capitalizeHeadingText(value: string): string {
  return value.replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

// Build a full markdown document from component data (prefers v2 content model, falls back to SEO)
function buildMarkdownDoc(c: {
  name: string;
  componentName?: string;
  description: string;
  shortDescription?: string;
  installCommand: string;
  repositoryUrl?: string;
  npmUrl: string;
  longDescription?: string;
  slug?: string;
  version: string;
  weeklyDownloads: number;
  authorUsername?: string;
  category?: string;
  categoryLabel?: string;
  tags?: string[];
  seoValueProp?: string;
  seoBenefits?: string[];
  seoUseCases?: { query: string; answer: string }[];
  seoFaq?: { question: string; answer: string }[];
  seoResourceLinks?: { label: string; url: string }[];
  seoGenerationStatus?: string;
  generatedDescription?: string;
  generatedUseCases?: string;
  generatedHowItWorks?: string;
  readmeIncludedMarkdown?: string;
  contentModelVersion?: number;
  skillMd?: string;
  hideSeoAndSkillContentOnDetailPage?: boolean;
}): string {
  const lines: string[] = [];
  lines.push(`# ${c.componentName || c.name}\n`);
  if (c.shortDescription) lines.push(`${c.shortDescription}\n`);

  lines.push(`## Install\n`);
  lines.push("```bash");
  lines.push(c.installCommand);
  lines.push("```\n");

  lines.push(`## Links\n`);
  lines.push(`- [npm package](${c.npmUrl})`);
  if (c.repositoryUrl) lines.push(`- [${repoHostLabel(c.repositoryUrl)} repository](${c.repositoryUrl})`);
  if (c.slug)
    lines.push(`- [Convex Components Directory](https://www.convex.dev/components/${c.slug})`);
  if (c.slug && c.skillMd && c.hideSeoAndSkillContentOnDetailPage !== true)
    lines.push(`- [Agent skill (SKILL.md)](https://www.convex.dev/components/${c.slug}/SKILL.md)`);
  lines.push("");

  if (c.authorUsername) lines.push(`**Author:** ${c.authorUsername}\n`);
  if (c.categoryLabel || c.category) lines.push(`**Category:** ${c.categoryLabel || c.category}\n`);
  lines.push(`**Version:** ${c.version}  `);
  lines.push(`**Weekly downloads:** ${c.weeklyDownloads.toLocaleString()}\n`);

  if (c.tags && c.tags.length > 0) {
    lines.push(`**Tags:** ${c.tags.join(", ")}\n`);
  }

  // V2 content model (preferred)
  if (c.contentModelVersion === 2 && c.generatedDescription) {
    lines.push(`---\n`);
    lines.push(`## Description\n`);
    lines.push(`${c.generatedDescription}\n`);

    if (c.generatedUseCases) {
      lines.push(`## Use cases\n`);
      lines.push(`${c.generatedUseCases}\n`);
    }

    if (c.generatedHowItWorks) {
      lines.push(`## How it works\n`);
      lines.push(`${c.generatedHowItWorks}\n`);
    }

    if (c.readmeIncludedMarkdown) {
      lines.push(`---\n`);
      lines.push(`### From the README.md\n`);
      lines.push(c.readmeIncludedMarkdown);
    }
  } else {
    // Fallback: old SEO model
    if (c.seoGenerationStatus === "completed") {
      if (c.seoValueProp) {
        lines.push(`---\n`);
        lines.push(`> ${c.seoValueProp}\n`);
      }
      if (c.seoBenefits && c.seoBenefits.length > 0) {
        lines.push(`## Benefits\n`);
        for (const b of c.seoBenefits) lines.push(`- ${b}`);
        lines.push("");
      }
      if (c.seoUseCases && c.seoUseCases.length > 0) {
        lines.push(`## Use cases\n`);
        for (const uc of c.seoUseCases) {
          lines.push(`### ${uc.query}\n`);
          lines.push(`${uc.answer}\n`);
        }
      }
      if (c.seoFaq && c.seoFaq.length > 0) {
        lines.push(`## FAQ\n`);
        for (const faq of c.seoFaq) {
          lines.push(`**Q: ${faq.question}**\n`);
          lines.push(`${faq.answer}\n`);
        }
      }
    }

    if (c.longDescription) {
      lines.push(`---\n`);
      lines.push(c.longDescription);
    }
  }

  if (c.slug) {
    lines.push(`\n---\n`);
    lines.push(
      `[![Convex Component](https://www.convex.dev/components/badge/${c.slug})](https://www.convex.dev/components/${c.slug})`
    );
  }

  return lines.join("\n");
}

// npm logo base path (works with Vite base path)
const npmLogoSrc = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") + "/npm.svg";

// Generate a stable anonymous session ID for rating
function getSessionId(): string {
  const key = "convex_components_session";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

// Star rating component
function StarRating({ packageId }: { packageId: string }) {
  const rating = useQuery(api.packages.getComponentRating, {
    packageId: packageId as any,
  });
  const submitRating = useMutation(api.packages.rateComponent);
  const [hovered, setHovered] = useState(0);
  const sessionId = useMemo(() => getSessionId(), []);

  const handleRate = async (value: number) => {
    try {
      await submitRating({
        packageId: packageId as any,
        rating: value,
        sessionId,
      });
    } catch {
      // Silent fail
    }
  };

  if (!rating) return null;

  return (
    <div>
      <p className="text-xs font-medium text-text-primary mb-1.5">Rating</p>
      <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => handleRate(star)}
              className="p-0 border-0 bg-transparent cursor-pointer transition-transform hover:scale-110"
              title={`Rate ${star} star${star !== 1 ? "s" : ""}`}>
              <svg
                viewBox="0 0 20 20"
                className="w-4 h-4"
                fill={
                  star <= (hovered || Math.round(rating.average)) ? "rgb(243, 176, 28)" : "none"
                }
                stroke={
                  star <= (hovered || Math.round(rating.average))
                    ? "rgb(243, 176, 28)"
                    : "currentColor"
                }
                strokeWidth="1.5">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          ))}
        </div>
        <span className="text-sm font-medium text-text-primary">
          {rating.average > 0 ? rating.average.toFixed(1) : ""}
        </span>
        {rating.count > 0 && <span className="text-xs text-text-secondary">({rating.count})</span>}
      </div>
    </div>
  );
}

// Share this page dropdown: social share links + copy link.
// Matches the Markdown dropdown styling used elsewhere on this page.
function ShareThisPage({
  title,
  description,
  pageUrl,
}: {
  title: string;
  description: string;
  pageUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const shareText = description ? `${title} - ${description}` : title;
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedText = encodeURIComponent(shareText);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const flashCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      flashCopied();
    } catch {
      // Silent fail; user can copy from address bar
    } finally {
      setOpen(false);
    }
  };

  const handleNativeShare = async () => {
    setOpen(false);
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: shareText, url: pageUrl });
        return;
      } catch {
        // User cancelled or share failed; fall through to copy
      }
    }
    await handleCopyLink();
  };

  const shareLinks: Array<{ label: string; href: string }> = [
    {
      label: "Share on X",
      href: `https://x.com/intent/post?url=${encodedUrl}&text=${encodedText}`,
    },
    {
      label: "Share on LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      label: "Share on Bluesky",
      href: `https://bsky.app/intent/compose?text=${encodedText}%20${encodedUrl}`,
    },
    {
      label: "Share on Reddit",
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`,
    },
    {
      label: "Share on Mastodon",
      href: `https://toot.kytta.dev/?text=${encodedText}%20${encodedUrl}`,
    },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
        aria-expanded={open}
        aria-haspopup="menu">
        <Share1Icon className="w-3.5 h-3.5" />
        Share this page
        <ChevronDownIcon className="w-3 h-3" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 w-56 rounded-lg bg-white shadow-hover py-1 z-20">
          {shareLinks.map((item) => (
            <a
              key={item.label}
              role="menuitem"
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-colors text-left">
              <span>{item.label}</span>
              <ExternalLinkIcon className="w-3.5 h-3.5 text-text-secondary" />
            </a>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={handleNativeShare}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-colors text-left">
            Other...
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleCopyLink}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-colors text-left">
            {copied ? (
              <CheckIcon className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <CopyIcon className="w-3.5 h-3.5 text-text-secondary" />
            )}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {copied ? "Link copied" : ""}
      </p>
    </div>
  );
}

function ComponentHelpModal({
  onClose,
  repositoryUrl,
}: {
  onClose: () => void;
  repositoryUrl?: string;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Issues link for GitHub (/issues) or GitLab (/-/issues)
  const parsedRepo = parseRepoUrl(repositoryUrl);
  const issuesUrl = parsedRepo ? repoIssuesUrl(parsedRepo) : null;
  const hostLabel = repoHostLabel(repositoryUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-12 p-4 overflow-y-auto"
      aria-modal="true"
      role="dialog">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-container bg-white border border-border shadow-lg p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-text-secondary hover:bg-bg-hover transition-colors"
          aria-label="Close help modal">
          <Cross2Icon className="w-4 h-4" />
        </button>

        <div className="mb-5 pr-8">
          <h2 className="text-lg font-medium text-text-primary">How to get help</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Package support usually starts with the author, then the Convex community.
          </p>
        </div>

        <div className="space-y-4">
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-primary mb-1.5">
              Contact the component author
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              For package specific bugs, install issues, and feature requests, contact the component
              author through the {hostLabel === "Repository" ? "source" : hostLabel} repository or its Issues page.
            </p>
            {issuesUrl ? (
              <a
                href={issuesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-text-primary hover:underline">
                <RepoHostIcon repositoryUrl={repositoryUrl} className="w-4 h-4" />
                Open {hostLabel} Issues
                <ExternalLinkIcon className="w-3 h-3 text-text-secondary" />
              </a>
            ) : repositoryUrl ? (
              <a
                href={repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-text-primary hover:underline">
                <RepoHostIcon repositoryUrl={repositoryUrl} className="w-4 h-4" />
                View repository
                <ExternalLinkIcon className="w-3 h-3 text-text-secondary" />
              </a>
            ) : (
              <p className="mt-2 text-xs text-text-secondary">
                If no repository link is listed here, use the package links provided by the author.
              </p>
            )}
          </section>

          <section>
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-primary mb-1.5">
              Community support
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              For general community help, ask in the Convex Community Discord in the components
              channel.
            </p>
            <a
              href="https://convex.dev/community"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-text-primary hover:underline">
              <DiscordLogo size={16} weight="bold" />
              Open Convex community
              <ExternalLinkIcon className="w-3 h-3 text-text-secondary" />
            </a>
          </section>

          <section className="rounded-lg border border-border bg-bg-secondary px-3 py-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-primary mb-1.5">
              Third party component notice
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Community and third party components are provided by their authors. Convex does not
              review, maintain, support, warrant, or assume responsibility for third party
              components, including their code, security, licensing, behavior, or ongoing
              availability. Review the source, license, and documentation before installing or using
              any community component.
            </p>
          </section>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm font-normal border border-border text-text-primary hover:bg-bg-hover transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Security scan sidebar box + modal for public component detail page
function SecurityScanBox({
  packageId,
  repositoryUrl,
  showModal,
  onShowModalChange,
}: {
  packageId: string;
  repositoryUrl?: string;
  showModal: boolean;
  onShowModalChange: (open: boolean) => void;
}) {
  const scanData = useQuery(api.packages.getLatestSecurityScan, {
    packageId: packageId as any,
  });

  if (!scanData) return null;

  if (scanData.status === "scanning") {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="text-xs font-medium text-text-secondary">Scanning...</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => onShowModalChange(true)}
        className="inline-flex items-center gap-2 py-1 text-text-secondary hover:text-text-primary transition-colors">
        <span className="text-xs font-medium">Community scan via Socket</span>
      </button>

      {showModal &&
        createPortal(
          <SecurityReportModal
            onClose={() => onShowModalChange(false)}
            scanData={scanData}
            repositoryUrl={repositoryUrl}
          />,
          document.body
        )}
    </>
  );
}

function SecurityReportModal({
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
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  // Issues link for GitHub (/issues) or GitLab (/-/issues)
  const parsedRepo = parseRepoUrl(repositoryUrl);
  const issuesUrl = parsedRepo ? repoIssuesUrl(parsedRepo) : null;
  const hostLabel = repoHostLabel(repositoryUrl);

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
      role="dialog">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[121] max-h-[calc(100vh-4rem)] w-full max-w-md overflow-y-auto rounded-container border border-border bg-white p-6 shadow-lg">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-text-secondary hover:bg-bg-hover transition-colors"
          aria-label="Close security report">
          <Cross2Icon className="w-4 h-4" />
        </button>

        {/* Header */}
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

          {/* Providers - only show known providers with a public URL (e.g. socket, snyk) */}
          {Object.entries(scanData.providerStatuses).some(([key, v]) => v && providerUrls[key]) && (
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
                  const providerUrl = providerUrls[key];
                  if (!providerUrl) return null;
                  const providerLabel = providerNames[key] || key;
                  return (
                    <div key={key} className="text-sm">
                      <a
                        href={providerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-text-primary hover:underline"
                        title={`Open ${providerLabel} to run your own scan`}>
                        {providerLabel}
                        <ExternalLinkIcon className="w-3 h-3 text-text-secondary" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Recommendations */}
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

          {/* Contact the component author when findings exist */}
          {hasFindings && (
            <section>
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-primary mb-1.5">
                Contact the component author
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                For security concerns, dependency issues, or vulnerability reports, contact the
                component author through the {hostLabel === "Repository" ? "source" : hostLabel} repository.
              </p>
              {issuesUrl ? (
                <a
                  href={issuesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm text-text-primary hover:underline">
                  <RepoHostIcon repositoryUrl={repositoryUrl} className="w-4 h-4" />
                  Open {hostLabel} Issues
                  <ExternalLinkIcon className="w-3 h-3 text-text-secondary" />
                </a>
              ) : repositoryUrl ? (
                <a
                  href={repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm text-text-primary hover:underline">
                  <RepoHostIcon repositoryUrl={repositoryUrl} className="w-4 h-4" />
                  View repository
                  <ExternalLinkIcon className="w-3 h-3 text-text-secondary" />
                </a>
              ) : (
                <p className="mt-2 text-xs text-text-secondary">
                  If no repository link is listed here, use the package links provided by the
                  author.
                </p>
              )}
            </section>
          )}

          {/* Third party component notice */}
          <section className="rounded-lg border border-border bg-bg-secondary px-3 py-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-primary mb-1.5">
              Third party component notice
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Community and third party components are provided by their authors. Convex does not
              review, maintain, support, warrant, or assume responsibility for third party
              components, including their code, security, licensing, behavior, or ongoing
              availability. Review the source, license, and documentation before installing or using
              any community component.
            </p>
          </section>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm font-normal border border-border text-text-primary hover:bg-bg-hover transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// GitHub issue shape (matches backend validator)
interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  user?: string;
  labels: string[];
  comments: number;
}

export default function ComponentDetail({ slug }: ComponentDetailProps) {
  // Loads over websocket (reactive) with a one-shot HTTP fallback so search
  // engine renderers that cannot complete the websocket still get content.
  const component = useComponentBySlug(slug);
  // Fetch the markdown renderer chunk alongside the component data
  useEffect(() => {
    preloadMarkdown();
  }, []);
  const relatedComponents = useQuery(
    api.packages.getRelatedComponents,
    component ? { packageId: component._id } : "skip"
  );
  // Downloads display mode from admin settings; default matches current
  // behavior (weekly only) while the query loads.
  const downloadsDisplay = useQuery(api.packages.getDownloadsDisplaySettings) ?? {
    showWeeklyDownloads: true,
    showAllTimeDownloads: false,
  };
  const dynamicCategories = useDirectoryCategories();
  const getDynamicCategoryLabel = (id: string) =>
    dynamicCategories.find((c) => c.id === id)?.label || id;
  const reviewStatus = getReviewStatus(component?.reviewStatus);
  const isApprovedForIndexing = reviewStatus === "approved";
  const hideSeoAndSkillContent = component?.hideSeoAndSkillContentOnDetailPage === true;
  const showDetailSeoContent =
    component?.contentModelVersion !== 2 &&
    component?.seoGenerationStatus === "completed" &&
    !hideSeoAndSkillContent;
  const showAgentContent =
    (reviewStatus === "approved" || reviewStatus === "in_review") && !hideSeoAndSkillContent;
  const [badgeCopied, setBadgeCopied] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSecurityReportModal, setShowSecurityReportModal] = useState(false);
  const [pageCopied, setPageCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // GitHub issues state
  const [showIssues, setShowIssues] = useState(false);
  const [issueFilter, setIssueFilter] = useState<"open" | "closed">("open");
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesHasMore, setIssuesHasMore] = useState(false);
  const [issuesPage, setIssuesPage] = useState(1);
  const fetchGitHubIssues = useAction(api.packages.fetchGitHubIssues);
  const refreshIssueCounts = useAction(api.packages.refreshGitHubIssueCounts);
  const issueCountRefreshed = useRef(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCopyMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (showSecurityReportModal) {
      setCopyMenuOpen(false);
    }
  }, [showSecurityReportModal]);

  // Set SEO meta tags + JSON-LD structured data (SoftwareSourceCode + FAQPage)
  useEffect(() => {
    if (component) {
      const displayName = component.componentName || component.name;
      const canonicalUrl = `https://www.convex.dev/components/${component.slug || ""}`;
      // Prefer AI-generated value prop for meta description
      const metaDesc =
        (!hideSeoAndSkillContent ? component.seoValueProp : undefined) ||
        component.shortDescription ||
        component.description ||
        "";

      // Set all SEO tags: title, description, OG, Twitter cards, canonical URL
      setComponentSeoTags({
        title: displayName,
        description: metaDesc,
        url: canonicalUrl,
        image: component.thumbnailUrl,
      });
      setRobotsTag(isApprovedForIndexing ? "index, follow" : "noindex, nofollow");

      // Inject dual JSON-LD: SoftwareSourceCode + FAQPage (if FAQ exists)
      if (isApprovedForIndexing) {
        const jsonLd = buildComponentJsonLd({
          name: displayName,
          description: metaDesc,
          url: canonicalUrl,
          repositoryUrl: component.repositoryUrl,
          npmUrl: component.npmUrl,
          version: component.version,
          license: component.license,
          authorName: component.authorUsername,
          installCommand: component.installCommand,
          faq: !hideSeoAndSkillContent ? component.seoFaq : undefined,
        });
        injectJsonLd(jsonLd);
      } else {
        removeJsonLd();
      }

      return () => {
        setRobotsTag("index, follow");
        removeJsonLd();
      };
    }
  }, [component, hideSeoAndSkillContent, isApprovedForIndexing]);

  // Refresh GitHub issue counts once per page load (if stale or missing)
  useEffect(() => {
    if (!component || !component.repositoryUrl || issueCountRefreshed.current) return;
    // Refresh if never fetched or older than 1 hour
    const oneHour = 60 * 60 * 1000;
    const isStale =
      !component.githubIssuesFetchedAt || Date.now() - component.githubIssuesFetchedAt > oneHour;
    if (isStale) {
      issueCountRefreshed.current = true;
      refreshIssueCounts({ packageId: component._id }).catch(() => {
        // Silent fail for count refresh
      });
    }
  }, [component, refreshIssueCounts]);

  // Fetch issues when the issues tab is opened or filter/page changes
  const loadIssues = useCallback(
    async (state: "open" | "closed", page: number, append = false) => {
      if (!component?.repositoryUrl) return;
      setIssuesLoading(true);
      try {
        const result = await fetchGitHubIssues({
          repositoryUrl: component.repositoryUrl,
          state,
          page,
        });
        setIssues((prev) => (append ? [...prev, ...result.issues] : result.issues));
        setIssuesHasMore(result.hasMore);
      } catch {
        setIssues([]);
        setIssuesHasMore(false);
      } finally {
        setIssuesLoading(false);
      }
    },
    [component?.repositoryUrl, fetchGitHubIssues]
  );

  // Load issues when tab opens or filter changes
  useEffect(() => {
    if (showIssues && component?.repositoryUrl) {
      setIssuesPage(1);
      loadIssues(issueFilter, 1);
    }
  }, [showIssues, issueFilter, component?.repositoryUrl, loadIssues]);

  // Load more issues handler
  const handleLoadMoreIssues = () => {
    const nextPage = issuesPage + 1;
    setIssuesPage(nextPage);
    loadIssues(issueFilter, nextPage, true);
  };

  // No trailing slash on the root: www.convex.dev redirects /components/
  const basePath = window.location.pathname.startsWith("/components") ? "/components" : "";

  const badgeMarkdown = component?.slug
    ? `[![Convex Component](https://www.convex.dev/components/badge/${component.slug})](https://www.convex.dev/components/${component.slug})`
    : "";
  const badgeImageUrl = component?.slug
    ? `https://www.convex.dev/components/badge/${component.slug}`
    : "";
  const badgeTargetUrl = component?.slug
    ? `https://www.convex.dev/components/${component.slug}`
    : "";

  const handleCopyBadge = async () => {
    try {
      await navigator.clipboard.writeText(badgeMarkdown);
      setBadgeCopied(true);
      setTimeout(() => setBadgeCopied(false), 2000);
    } catch {}
  };

  const handleDownloadSkill = () => {
    if (!component?.skillMd) return;
    const blob = new Blob([component.skillMd], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "SKILL.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Owner profile on the repo host (GitHub user/org or GitLab namespace).
  // Falls back to github.com for legacy rows that have a username but no repo URL.
  const parsedComponentRepo = parseRepoUrl(component?.repositoryUrl);
  const authorGitHubUrl = parsedComponentRepo
    ? repoOwnerUrl(parsedComponentRepo)
    : component?.authorUsername
      ? `https://github.com/${canonicalGithubOwner(component.authorUsername)}`
      : null;
  const resolvedCategory = component?.category
    ? (dynamicCategories.find((category) => category.id === component.category) ?? null)
    : null;
  const categoryHref =
    component?.category && resolvedCategory ? `${basePath}/categories/${component.category}` : null;

  // Generate full markdown doc
  const markdownDoc = component
    ? buildMarkdownDoc({
        ...component,
        categoryLabel: resolvedCategory?.label,
      })
    : "";
  const componentLinks = component?.slug
    ? buildComponentClientUrls(
        component.slug,
        window.location.origin,
        import.meta.env.VITE_CONVEX_URL as string | undefined
      )
    : null;

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdownDoc);
      setPageCopied(true);
      setCopyMenuOpen(false);
      setTimeout(() => setPageCopied(false), 2000);
    } catch {}
  };

  const handleCopyPageUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setPageCopied(true);
      setCopyMenuOpen(false);
      setTimeout(() => setPageCopied(false), 2000);
    } catch {}
  };

  const openMarkdownFile = () => {
    if (!componentLinks) return;
    window.open(componentLinks.markdownUrl, "_blank", "noopener,noreferrer");
    setCopyMenuOpen(false);
  };

  const openInAi = (provider: "chatgpt" | "claude" | "perplexity") => {
    if (!componentLinks) return;
    const prompt = encodeURIComponent(`${AI_READ_PROMPT} ${componentLinks.markdownUrl}`);
    const url =
      provider === "chatgpt"
        ? `https://chatgpt.com/?q=${prompt}`
        : provider === "claude"
          ? `https://claude.ai/new?q=${prompt}`
          : `https://www.perplexity.ai/?q=${prompt}`;

    window.open(url, "_blank", "noopener,noreferrer");
    setCopyMenuOpen(false);
  };

  const renderRelatedComponents = () => {
    if (!relatedComponents || relatedComponents.length === 0) return null;

    return (
      <div className="mt-6 pt-6 border-t border-border">
        <h2 className="text-sm font-semibold text-text-primary capitalize tracking-wider mb-4">
          Related Components
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {relatedComponents.map((rel) => {
            const relBasePath = window.location.pathname.startsWith("/components")
              ? "/components"
              : "";
            const relHref = rel.slug ? `${relBasePath}/${rel.slug}` : rel.npmUrl;
            const relDisplayName = rel.componentName || rel.name;
            const relDesc = rel.shortDescription || rel.description;
            const relDescTruncated =
              relDesc.length > 100 ? `${relDesc.slice(0, 100).trimEnd()}...` : relDesc;
            const formatDownloads = (count: number): string => {
              if (count >= 1000000000) return `${(count / 1000000000).toFixed(1)}B`;
              if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
              if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
              return count.toString();
            };
            // Same admin display mode as the main sidebar stats
            const relDownloadParts: Array<string> = [];
            if (downloadsDisplay.showWeeklyDownloads) {
              relDownloadParts.push(`${formatDownloads(rel.weeklyDownloads)}/wk`);
            }
            if (downloadsDisplay.showAllTimeDownloads && rel.allTimeDownloads !== undefined) {
              relDownloadParts.push(`${formatDownloads(rel.allTimeDownloads)} total`);
            }
            const relDownloadsText = relDownloadParts.join(" \u00b7 ");

            return (
              <a
                key={rel._id}
                href={relHref}
                className="group flex h-[180px] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:bg-[rgb(246_238_219/var(--tw-bg-opacity,1))]">
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="truncate text-base font-medium leading-tight text-text-primary mb-1">
                    {relDisplayName}
                  </h3>
                  <p className="mb-3 line-clamp-3 text-xs leading-4 text-text-secondary min-h-[3rem]">
                    {relDescTruncated}
                  </p>
                  <div className="mt-auto text-xs text-text-primary">
                    {rel.authorUsername && (
                      <div className="flex items-center gap-2 mb-1">
                        {rel.authorAvatar && (
                          <img
                            src={avatarUrl(rel.authorAvatar)}
                            alt={rel.authorUsername}
                            className="w-5 h-5 rounded-full"
                            loading="lazy"
                          />
                        )}
                        <span className="truncate text-sm font-medium">{rel.authorUsername}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      {relDownloadsText ? (
                        <div className="flex items-center gap-1 text-text-secondary">
                          <DownloadIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{relDownloadsText}</span>
                        </div>
                      ) : (
                        <div />
                      )}
                      <div className="flex items-center gap-1">
                        {rel.communitySubmitted && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: "#E9DDC2",
                              color: "rgb(87, 74, 48)",
                            }}>
                            Community
                          </span>
                        )}
                        {rel.convexVerified && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: "rgb(203, 237, 182)",
                              color: "rgb(34, 137, 9)",
                            }}>
                            Verified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    );
  };

  // Loading state
  if (component === undefined) {
    return <ComponentDetailSkeleton />;
  }

  // Not found
  if (component === null) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Header />
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <h1 className="text-4xl font-light text-text-primary mb-2">404</h1>
            <p className="text-text-secondary mb-4">Component not found</p>
            <a
              href={basePath || "/"}
              className="text-sm font-medium underline text-text-primary hover:text-text-secondary">
              Back to Components
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Rendered at the top or bottom of the main column, per component.videoPosition
  const videoEmbed = component.videoUrl ? (
    <div className="rounded-lg overflow-hidden mb-6">
      <div className="aspect-video">
        <iframe
          src={component.videoUrl
            .replace("watch?v=", "embed/")
            .replace("youtu.be/", "youtube.com/embed/")}
          className="w-full h-full"
          allowFullScreen
          title={`${component.name} demo`}
        />
      </div>
    </div>
  ) : null;

  return (
    <div className="component-detail-page min-h-screen bg-bg-primary">
      <Header />
      <div className="max-w-6xl mx-auto pl-4 pr-4 sm:pl-8 sm:pr-6 py-6">
        {/* 2-column layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left sidebar: thumbnail + metadata */}
          <aside className="w-full lg:w-[240px] shrink-0 space-y-5 order-2 lg:order-1 lg:sticky lg:top-6 lg:self-start">
            {/* Thumbnail inside sidebar */}
            {component.thumbnailUrl && (
              <div className="rounded-lg overflow-hidden">
                <img
                  {...thumbnailImageProps(
                    component.thumbnailUrl,
                    DETAIL_THUMBNAIL,
                  )}
                  alt={component.name}
                  className="w-full aspect-video object-cover"
                />
              </div>
            )}

            {/* Component name with repo link */}
            {component.repositoryUrl ? (
              <a
                href={component.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-base font-bold text-text-primary hover:underline">
                {component.name}
              </a>
            ) : (
              <span className="block text-base font-bold text-text-primary">{component.name}</span>
            )}

            {/* Discord username (links to Convex community Discord) */}
            {component.submitterDiscord && (
              <a
                href="https://www.convex.dev/community/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
                <DiscordLogo size={16} weight="bold" />
                {component.submitterDiscord}
              </a>
            )}

            {/* Curated category badges (only entries with an uploaded image render) */}
            {(component.curatedBadges ?? [])
              .filter((badge) => badge.badgeUrl)
              .map((badge) => (
                <img
                  key={badge.categorySlug}
                  src={badge.badgeUrl}
                  alt={badge.label}
                  title={badge.label}
                  className="h-5 w-auto max-w-[120px] object-contain"
                  loading="lazy"
                />
              ))}

            {/* Verified */}
            {component.convexVerified && <VerifiedBadge size="md" />}

            {/* Community */}
            {component.communitySubmitted && <CommunityBadge size="md" />}

            {/* Stats: weekly / all-time downloads per admin display mode */}
            {(downloadsDisplay.showWeeklyDownloads ||
              (downloadsDisplay.showAllTimeDownloads &&
                component.allTimeDownloads !== undefined)) && (
              <div className="space-y-1.5 text-sm text-text-secondary">
                {downloadsDisplay.showWeeklyDownloads && (
                  <div className="flex items-center gap-1.5">
                    <DownloadIcon className="w-3.5 h-3.5" />
                    {component.weeklyDownloads.toLocaleString()} / week
                  </div>
                )}
                {downloadsDisplay.showAllTimeDownloads &&
                  component.allTimeDownloads !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <DownloadIcon className="w-3.5 h-3.5" />
                      {component.allTimeDownloads.toLocaleString()} all time
                    </div>
                  )}
              </div>
            )}

            {/* Source link */}
            {component.repositoryUrl && (
              <a
                href={component.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-text-primary hover:underline">
                <RepoHostIcon repositoryUrl={component.repositoryUrl} className="w-4 h-4" />
                View Repo
                <ExternalLinkIcon className="w-3 h-3 text-text-secondary" />
              </a>
            )}
            {/* npm link with real npm logo */}
            <a
              href={component.npmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-text-primary hover:underline">
              <img src={npmLogoSrc} alt="npm" className="w-4 h-4 shrink-0" />
              View package
            </a>

            {/* Demo link */}
            {component.demoUrl && (
              <a
                href={component.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-text-primary hover:underline">
                <ExternalLinkIcon className="w-4 h-4" />
                Live demo
              </a>
            )}

            {/* License */}
            {component.license && component.license !== "Unknown" && (
              <div>
                <p className="text-xs font-medium text-text-primary mb-1.5">License</p>
                <span className="inline-block text-xs font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg border border-border bg-bg-secondary text-text-primary hover:bg-bg-hover hover:border-text-secondary transition-colors cursor-default">
                  {component.license}
                </span>
              </div>
            )}

            {/* Category -- bordered pill with hover */}
            {component.category && (
              <div>
                <p className="text-xs font-medium text-text-primary mb-1.5">Category</p>
                {categoryHref ? (
                  <a
                    href={categoryHref}
                    className="inline-block text-xs font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg border border-border bg-bg-secondary text-text-primary hover:bg-bg-hover hover:border-text-secondary transition-colors">
                    {resolvedCategory?.label || getDynamicCategoryLabel(component.category)}
                  </a>
                ) : (
                  <span className="inline-block text-xs font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg border border-border bg-bg-secondary text-text-primary cursor-default">
                    {resolvedCategory?.label || getDynamicCategoryLabel(component.category)}
                  </span>
                )}
              </div>
            )}

            {/* Rating stars */}
            <StarRating packageId={component._id} />

            {/* Share this page dropdown */}
            <ShareThisPage
              title={component.componentName || component.name}
              description={component.shortDescription || component.description}
              pageUrl={window.location.href}
            />

            <div>
              <button
                onClick={() => setShowHelpModal(true)}
                className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors">
                <QuestionMarkCircledIcon className="w-3.5 h-3.5" />
                How to get help
              </button>
            </div>

            {/* Security scan report box */}
            <SecurityScanBox
              packageId={component._id}
              repositoryUrl={component.repositoryUrl}
              showModal={showSecurityReportModal}
              onShowModalChange={setShowSecurityReportModal}
            />

            {/* Back to Components (bottom of sidebar) */}
            <a
              href={basePath || "/"}
              className="hidden lg:inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors pt-2">
              <ArrowLeftIcon className="w-3 h-3" />
              Back to Components
            </a>
          </aside>

          {/* Right main content */}
          <main className="flex-1 min-w-0 order-1 lg:order-2">
            {/* Component title (componentName or fallback to name) */}
            <h1 className="text-3xl font-bold text-text-primary mb-2">
              {component.componentName || component.name}
            </h1>
            {/* Short description */}
            <p className="text-sm text-text-secondary mb-4">
              {component.shortDescription || component.description}
            </p>

            {/* npm package name + author row */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <a
                href={
                  component.repositoryUrl ||
                  `https://github.com/${canonicalGithubOwner(component.authorUsername ?? "")}/${component.name}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono text-text-secondary hover:text-text-primary hover:underline truncate max-w-[280px] sm:max-w-none"
                title={component.name}>
                {component.name}
              </a>
              {component.authorUsername && (
                <>
                  <span className="text-text-secondary/40">|</span>
                  <span className="text-sm text-text-secondary">by</span>
                  <a
                    href={authorGitHubUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 group">
                    {component.authorAvatar && (
                      <img
                        src={avatarUrl(component.authorAvatar)}
                        alt={component.authorUsername}
                        className="w-7 h-7 rounded-full"
                      />
                    )}
                    <span className="text-sm font-medium text-text-primary group-hover:underline">
                      {component.authorUsername}
                    </span>
                  </a>
                </>
              )}

              {!showSecurityReportModal && (
                <>
                  {/* Markdown dropdown */}
                  <span className="text-text-secondary/40">|</span>
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setCopyMenuOpen(!copyMenuOpen)}
                      className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
                      {pageCopied ? (
                        <CheckIcon className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <ClipboardIcon className="w-3.5 h-3.5" />
                      )}
                      {pageCopied ? "Copied" : "Markdown"}
                      <ChevronDownIcon className="w-3 h-3" />
                    </button>

                    {copyMenuOpen && (
                      <div className="absolute left-0 top-full mt-1 w-56 rounded-lg bg-white shadow-hover py-1 z-20">
                        <button
                          onClick={openMarkdownFile}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-colors text-left">
                          <ExternalLinkIcon className="w-3.5 h-3.5 text-text-secondary" />
                          Open markdown file
                        </button>
                        <button
                          onClick={handleCopyMarkdown}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-colors text-left">
                          <FileTextIcon className="w-3.5 h-3.5 text-text-secondary" />
                          Copy as Markdown
                        </button>
                        <button
                          onClick={handleCopyPageUrl}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-colors text-left">
                          <CopyIcon className="w-3.5 h-3.5 text-text-secondary" />
                          Copy page URL
                        </button>
                        <button
                          onClick={() => openInAi("chatgpt")}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-colors text-left">
                          <ExternalLinkIcon className="w-3.5 h-3.5 text-text-secondary" />
                          Open in ChatGPT
                        </button>
                        <button
                          onClick={() => openInAi("claude")}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-colors text-left">
                          <ExternalLinkIcon className="w-3.5 h-3.5 text-text-secondary" />
                          Open in Claude
                        </button>
                        <button
                          onClick={() => openInAi("perplexity")}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-colors text-left">
                          <ExternalLinkIcon className="w-3.5 h-3.5 text-text-secondary" />
                          Open in Perplexity
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Agent install anchor link */}
              {showAgentContent && (
                <>
                  <span className="text-text-secondary/40">|</span>
                  <a
                    href="#agent-install"
                    className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
                    <ClipboardText className="w-3.5 h-3.5" weight="bold" />
                    For Agents
                  </a>
                </>
              )}

              {/* Download Skill button - only shows if SKILL.md has been generated */}
              {showAgentContent && component.skillMd && (
                <>
                  <span className="text-text-secondary/40">|</span>
                  <button
                    onClick={handleDownloadSkill}
                    title="Save into a named skills folder, e.g. .claude/skills/<component-name>/SKILL.md"
                    className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
                    <FileArrowDown className="w-3.5 h-3.5" weight="bold" />
                    Download Skill
                  </button>
                </>
              )}

              {/* GitHub issues badge - commented out
              {component.repositoryUrl && (
                <>
                  <span className="text-text-secondary/40">|</span>
                  <button
                    onClick={() => setShowIssues(!showIssues)}
                    className={`inline-flex items-center gap-1.5 text-sm transition-colors ${
                      showIssues
                        ? "text-text-primary font-medium"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                    title={`${component.githubOpenIssues ?? 0} open issues`}>
                    <svg
                      viewBox="0 0 16 16"
                      className="w-3.5 h-3.5"
                      fill="currentColor"
                      aria-hidden="true">
                      <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                      <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
                    </svg>
                    Issues ({component.githubOpenIssues ?? 0})
                  </button>
                </>
              )}
              */}
            </div>

            {/* Install command */}
            <div className="mb-6">
              <InstallCommand command={component.installCommand} />
            </div>

            {/* Video embed at the top (default), so it's seen without scrolling */}
            {component.videoPosition !== "bottom" && videoEmbed}

            {/* GitHub Issues panel - commented out
            {showIssues && component.repositoryUrl && (
              <section
                aria-label={`GitHub Issues for ${component.componentName || component.name}`}
                className="mb-6">
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between bg-bg-secondary px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setIssueFilter("open")}
                        className={`text-sm font-medium transition-colors ${
                          issueFilter === "open"
                            ? "text-text-primary"
                            : "text-text-secondary hover:text-text-primary"
                        }`}>
                        <span className="inline-flex items-center gap-1.5">
                          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                            <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
                          </svg>
                          {component.githubOpenIssues ?? 0} Open
                        </span>
                      </button>
                      <button
                        onClick={() => setIssueFilter("closed")}
                        className={`text-sm font-medium transition-colors ${
                          issueFilter === "closed"
                            ? "text-text-primary"
                            : "text-text-secondary hover:text-text-primary"
                        }`}>
                        <span className="inline-flex items-center gap-1.5">
                          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                            <path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z" />
                            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z" />
                          </svg>
                          {component.githubClosedIssues ?? 0} Closed
                        </span>
                      </button>
                    </div>
                    <a
                      href={`${component.repositoryUrl}/issues`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-text-secondary hover:text-text-primary transition-colors inline-flex items-center gap-1">
                      View on GitHub
                      <ExternalLinkIcon className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="divide-y divide-border">
                    {issuesLoading && issues.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <div className="inline-block w-5 h-5 border-2 border-text-secondary/30 border-t-text-primary rounded-full animate-spin" />
                        <p className="text-sm text-text-secondary mt-2">Loading issues...</p>
                      </div>
                    ) : issues.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <p className="text-sm text-text-secondary">
                          No {issueFilter} issues found.
                        </p>
                      </div>
                    ) : (
                      issues.map((issue) => (
                        <a
                          key={issue.number}
                          href={issue.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-3 px-4 py-3 hover:bg-bg-hover transition-colors group">
                          {issue.state === "open" ? (
                            <svg viewBox="0 0 16 16" className="w-4 h-4 mt-0.5 text-green-600 shrink-0" fill="currentColor">
                              <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 16 16" className="w-4 h-4 mt-0.5 text-purple-600 shrink-0" fill="currentColor">
                              <path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z" />
                              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z" />
                            </svg>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary group-hover:text-[rgb(33,34,181)] transition-colors">
                              {issue.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-text-secondary">
                                #{issue.number}
                              </span>
                              {issue.user && (
                                <span className="text-xs text-text-secondary">
                                  by {issue.user}
                                </span>
                              )}
                              <span className="text-xs text-text-secondary">
                                {new Date(issue.created_at).toLocaleDateString()}
                              </span>
                              {issue.comments > 0 && (
                                <span className="text-xs text-text-secondary inline-flex items-center gap-0.5">
                                  <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor">
                                    <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
                                  </svg>
                                  {issue.comments}
                                </span>
                              )}
                              {issue.labels.slice(0, 3).map((label) => (
                                <span
                                  key={label}
                                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-secondary text-text-secondary border border-border">
                                  {label}
                                </span>
                              ))}
                            </div>
                          </div>
                          <ExternalLinkIcon className="w-3 h-3 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                        </a>
                      ))
                    )}
                  </div>

                  {issuesHasMore && !issuesLoading && (
                    <div className="px-4 py-3 border-t border-border bg-bg-secondary text-center">
                      <button
                        onClick={handleLoadMoreIssues}
                        className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                        Load more issues...
                      </button>
                    </div>
                  )}
                  {issuesLoading && issues.length > 0 && (
                    <div className="px-4 py-3 border-t border-border bg-bg-secondary text-center">
                      <div className="inline-block w-4 h-4 border-2 border-text-secondary/30 border-t-text-primary rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </section>
            )}
            */}

            {/* V2 generated content (Description, Use Cases, How it Works) */}
            {component.contentModelVersion === 2 && component.generatedDescription && (
              <div className="mb-6 space-y-6">
                <section>
                  <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-2">
                    Description
                  </h2>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {component.generatedDescription}
                  </p>
                </section>

                {component.generatedUseCases && (
                  <section>
                    <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-2">
                      Use cases
                    </h2>
                    <div className="markdown-body">
                      <MarkdownErrorBoundary label="Use cases">
                        <Markdown repositoryUrl={component.repositoryUrl}>
                          {component.generatedUseCases}
                        </Markdown>
                      </MarkdownErrorBoundary>
                    </div>
                  </section>
                )}

                {component.generatedHowItWorks && (
                  <section>
                    <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-2">
                      How it works
                    </h2>
                    <div className="markdown-body">
                      <MarkdownErrorBoundary label="How it works">
                        <Markdown repositoryUrl={component.repositoryUrl}>
                          {component.generatedHowItWorks}
                        </Markdown>
                      </MarkdownErrorBoundary>
                    </div>
                  </section>
                )}

                {/* Use with agents and CLI section */}
                {showAgentContent && (
                  <div id="agent-install" className="mb-6 scroll-mt-20">
                    <AgentInstallSection component={component} />
                  </div>
                )}
              </div>
            )}

            {/* README section renders independently of v2 content generation */}
            {component.readmeIncludedMarkdown && (
              <section>
                <hr className="border-border my-6" />
                <h3 className="text-base font-semibold text-text-primary mb-4">
                  From the README.md
                </h3>
                <div className="markdown-body">
                  <MarkdownErrorBoundary label="README markdown">
                    <Markdown repositoryUrl={component.repositoryUrl}>
                      {component.readmeIncludedMarkdown}
                    </Markdown>
                  </MarkdownErrorBoundary>
                </div>
              </section>
            )}

            {/* Old content model: Long description title (below install command) */}
            {component.contentModelVersion !== 2 && component.longDescription && (
              <h2 className="text-lg font-semibold text-text-primary mb-3">
                {capitalizeHeadingText(component.componentName || component.name)} Description
              </h2>
            )}

            {/* Rendered markdown content */}
            <>
              {/* Long description markdown content (v1 only) */}
              {component.contentModelVersion !== 2 && component.longDescription && (
                <div className="markdown-body mb-6">
                  <MarkdownErrorBoundary label="Long description">
                    <Markdown repositoryUrl={component.repositoryUrl}>
                      {component.longDescription}
                    </Markdown>
                  </MarkdownErrorBoundary>
                </div>
              )}

              {/* Divider before AI SEO content */}
              {showDetailSeoContent && <hr className="border-border mb-6" />}

              {/* AI-generated SEO/AEO/GEO structured content (visible for search engines) */}
              {showDetailSeoContent && (
                <div className="mb-6 space-y-6">
                  {/* Value prop highlight */}
                  {component.seoValueProp && (
                    <p className="text-base text-text-primary leading-relaxed border-l-2 border-border pl-4 italic">
                      {component.seoValueProp}
                    </p>
                  )}

                  {/* Benefits block */}
                  {component.seoBenefits && component.seoBenefits.length > 0 && (
                    <section>
                      <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-2">
                        Benefits
                      </h2>
                      <ul className="space-y-1.5">
                        {component.seoBenefits.map((benefit: string, i: number) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-text-secondary">
                            <span className="mt-1.5 w-1 h-1 rounded-full bg-text-secondary shrink-0" />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* Use cases (visible section for SEO) */}
                  {component.seoUseCases && component.seoUseCases.length > 0 && (
                    <section>
                      <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
                        Use cases
                      </h2>
                      <div className="space-y-4">
                        {component.seoUseCases.map(
                          (uc: { query: string; answer: string }, i: number) => (
                            <div key={i}>
                              <h3 className="text-sm font-medium text-text-primary mb-1">
                                {uc.query}
                              </h3>
                              <p className="text-sm text-text-secondary leading-relaxed">
                                {uc.answer}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </section>
                  )}

                  {/* FAQ (visible section for SEO/AEO rich snippets) */}
                  {component.seoFaq && component.seoFaq.length > 0 && (
                    <section>
                      <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
                        FAQ
                      </h2>
                      <div className="space-y-4">
                        {component.seoFaq.map(
                          (faq: { question: string; answer: string }, i: number) => (
                            <div key={i}>
                              <h3 className="text-sm font-medium text-text-primary mb-1">
                                {faq.question}
                              </h3>
                              <p className="text-sm text-text-secondary leading-relaxed">
                                {faq.answer}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </>

            {/* Video embed at the bottom (below AI content) when the admin chose "bottom" */}
            {component.videoPosition === "bottom" && videoEmbed}

            {/* SKILL.md download only (not visible in page body, available via For Agents) */}

            {/* Keywords */}
            {component.tags && component.tags.length > 0 && (
              <div className="mt-8 mb-6">
                <h3 className="text-base font-semibold text-text-primary mb-4">Keywords</h3>
                <div className="flex flex-wrap gap-1.5">
                  {component.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-bg-secondary text-text-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* llms link (badge hidden on detail page, kept on Profile/Submit) */}
            {componentLinks && !hideSeoAndSkillContent && (
              <div className="mt-8 pt-6 border-t border-border">
                <h3 className="text-base font-semibold text-text-primary mb-4">
                  For LLMs and AI agents
                </h3>
                <div className="flex items-center gap-4">
                  <a
                    href={componentLinks.llmsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-text-secondary hover:text-text-primary transition-colors underline">
                    {component.name} llms.txt
                  </a>
                  {component.skillMd && (
                    <a
                      href={componentLinks.skillUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-text-secondary hover:text-text-primary transition-colors underline">
                      {component.name} SKILL.md
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Related components stay in the main column on desktop. */}
            <div className="hidden lg:block">{renderRelatedComponents()}</div>
          </main>

          {/* On mobile, the sidebar follows main content, so related components render after it. */}
          <div className="order-3 w-full lg:hidden">{renderRelatedComponents()}</div>
        </div>
      </div>
      {showHelpModal && (
        <ComponentHelpModal
          onClose={() => setShowHelpModal(false)}
          repositoryUrl={component.repositoryUrl}
        />
      )}
    </div>
  );
}
