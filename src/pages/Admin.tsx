import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  useMutation,
  useQuery,
  useAction,
  usePaginatedQuery,
} from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../lib/auth";
import { Toaster, toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { ComponentDetailsEditor } from "../components/ComponentDetailsEditor";
import { CONTENT_PROMPT_PLACEHOLDERS } from "../../shared/seoPromptTemplate";
import Header from "../components/Header";
import {
  Eye,
  EyeSlash,
  Archive,
  Trash,
  GitPullRequest,
  CheckCircle,
  Warning,
  Hourglass,
  Package,
  DownloadSimple,
  CalendarBlank,
  List,
  CaretRight,
  CaretDown,
  MagnifyingGlass,
  X,
  GithubLogo,
  User,
  Envelope,
  DiscordLogo,
  ChatText,
  PaperPlaneTilt,
  ArrowBendUpLeft,
  Files,
  Scales,
  ArrowSquareOut,
  Globe,
  Prohibit,
  ChatCircleText,
  Star,
  SortAscending,
  Robot,
  Gear,
  XCircle,
  CaretUp,
  Browser,
  ArrowClockwise,
  Lightning,
  ClockCounterClockwise,
  ArrowsClockwise,
  Copy,
  Plus,
  PencilSimple,
  TrashSimple,
  Image,
  Upload,
  ArrowsDownUp,
  Clock,
  LinkSimple,
  Users,
  CurrencyCircleDollar,
  Key,
  ChartBar,
  ShieldCheck,
  ShieldWarning,
  Shield,
  ToggleLeft,
  ToggleRight,
  FileText,
  MegaphoneSimple,
  ChatCircle,
  ArrowCounterClockwise,
  Plugs,
} from "@phosphor-icons/react";
import { ExternalLinkIcon as RadixExternalLinkIcon } from "@radix-ui/react-icons";
import AiLoadingDots from "../components/AiLoadingDots";
import DownloadsGrowthTab from "../components/DownloadsGrowthTab";
import { AI_REVIEW_PROMPT_STATUS_LABEL } from "../../shared/aiReviewPromptMeta";
import { parseRepoUrl, repoHostLabel } from "../../shared/repoUrl";
import { buildCategoryClientUrls } from "../../shared/categoryUrls";
import { navigate } from "../lib/router";

// Review status type
type ReviewStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "changes_requested"
  | "rejected";
type Visibility = "visible" | "hidden" | "archived";

// Get base path for navigation (always /components)
function useBasePath() {
  return "/components";
}

type AdminSettingsSection = {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
};

const ADMIN_SETTINGS_SECTIONS: Array<AdminSettingsSection> = [
  {
    id: "settings-categories",
    label: "Category Management",
    shortLabel: "Categories",
    icon: <List size={14} weight="bold" />,
  },
  {
    id: "settings-auto-refresh",
    label: "Auto-Refresh Settings",
    shortLabel: "Refresh",
    icon: <Lightning size={14} weight="bold" />,
  },
  {
    id: "settings-downloads-display",
    label: "Downloads Display",
    shortLabel: "Downloads",
    icon: <DownloadSimple size={14} weight="bold" />,
  },
  {
    id: "settings-submit-listing",
    label: "Submit Listing Settings",
    shortLabel: "Submit",
    icon: <Files size={14} weight="bold" />,
  },
  {
    id: "settings-security-scan",
    label: "Security Scan Settings",
    shortLabel: "Security",
    icon: <ShieldCheck size={14} weight="bold" />,
  },
  {
    id: "settings-ai-review",
    label: "AI Review Settings",
    shortLabel: "AI Review",
    icon: <Gear size={14} weight="bold" />,
  },
  {
    id: "settings-rewards",
    label: "Reward Settings",
    shortLabel: "Rewards",
    icon: <CurrencyCircleDollar size={14} weight="bold" />,
  },
  {
    id: "settings-ai-providers",
    label: "AI Provider Settings",
    shortLabel: "Providers",
    icon: <Robot size={14} weight="bold" />,
  },
  {
    id: "settings-ai-prompt",
    label: "AI Review Prompt",
    shortLabel: "Review Prompt",
    icon: <ChatText size={14} weight="bold" />,
  },
  {
    id: "settings-seo-prompt",
    label: "SEO and SKILL Prompt",
    shortLabel: "SEO Prompt",
    icon: <Robot size={14} weight="bold" />,
  },
  {
    id: "settings-deletion",
    label: "Deletion Management",
    shortLabel: "Deletion",
    icon: <Trash size={14} weight="bold" />,
  },
  {
    id: "settings-slugs",
    label: "Slug Migration",
    shortLabel: "Slugs",
    icon: <LinkSimple size={14} weight="bold" />,
  },
  {
    id: "settings-templates",
    label: "Thumbnail Templates",
    shortLabel: "Templates",
    icon: <Image size={14} weight="bold" />,
  },
  {
    id: "settings-stats",
    label: "Stats",
    shortLabel: "Stats",
    icon: <Package size={14} weight="bold" />,
  },
];

function scrollToAdminSettingsSection(sectionId: string) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  section.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${window.location.search}#${sectionId}`,
  );
}

function AdminSettingsJumpNav({
  activeSection,
  onSelect,
  desktop = false,
}: {
  activeSection: string;
  onSelect: (sectionId: string) => void;
  desktop?: boolean;
}) {
  if (desktop) {
    return (
      <div>
        <div className="rounded-2xl border border-border bg-bg-card/95 backdrop-blur shadow-sm">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              Settings Navigation
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Jump between admin sections without losing your place.
            </p>
          </div>
          <nav className="p-2">
            {ADMIN_SETTINGS_SECTIONS.map((section) => {
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onSelect(section.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-button text-white shadow-sm"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  }`}
                >
                  <span
                    className={isActive ? "text-white" : "text-text-secondary"}
                  >
                    {section.icon}
                  </span>
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    );
  }

  return (
    <div className="2xl:hidden sticky top-24 z-20 mb-4">
      <div className="rounded-2xl border border-border bg-bg-card/95 backdrop-blur shadow-sm">
        <div className="px-3 py-2.5 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
            Settings Navigation
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Swipe across sections and jump directly to the one you need.
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto px-3 py-3">
          {ADMIN_SETTINGS_SECTIONS.map((section) => {
            const isActive = activeSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSelect(section.id)}
                aria-current={isActive ? "true" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-button bg-button text-white shadow-sm"
                    : "border-border bg-white text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                <span
                  className={isActive ? "text-white" : "text-text-secondary"}
                >
                  {section.icon}
                </span>
                <span>{section.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Redirect non-admin users to their profile
function RedirectToProfile() {
  const basePath = useBasePath();

  useEffect(() => {
    navigate(`${basePath}/profile`, { replace: true });
  }, [basePath]);

  return (
    <div className="flex justify-center items-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-button"></div>
    </div>
  );
}

function PackageComponentDetailsEditor({
  packageId,
  componentName,
  slug,
  category,
  tags,
  shortDescription,
  longDescription,
  videoUrl,
  videoPosition,
  demoUrl,
  thumbnailUrl,
  hideThumbnailInCategory,
  thumbnailUploadedByUser,
  convexVerified,
  communitySubmitted,
  authorUsername,
  authorAvatar,
  logoUrl,
  logoStorageId,
  selectedTemplateId,
  thumbnailGeneratedAt,
  seoGenerationStatus,
  seoGeneratedAt,
  seoGenerationError,
  seoValueProp,
  seoBenefits,
  seoUseCases,
  seoFaq,
  seoResourceLinks,
  contentModelVersion,
  contentGenerationStatus,
  contentGeneratedAt,
  contentGenerationError,
  generatedDescription,
  generatedUseCases,
  generatedHowItWorks,
  readmeIncludedMarkdown,
  readmeIncludeSource,
  skillMd,
  npmDescription,
  repositoryUrl,
  npmUrl,
  submittedShortDescription,
  submittedLongDescription,
}: {
  packageId: Id<"packages">;
  componentName?: string;
  slug?: string;
  category?: string;
  tags?: string[];
  shortDescription?: string;
  longDescription?: string;
  videoUrl?: string;
  videoPosition?: "top" | "bottom";
  demoUrl?: string;
  thumbnailUrl?: string;
  hideThumbnailInCategory?: boolean;
  thumbnailUploadedByUser?: boolean;
  convexVerified?: boolean;
  communitySubmitted?: boolean;
  authorUsername?: string;
  authorAvatar?: string;
  logoUrl?: string;
  logoStorageId?: Id<"_storage">;
  selectedTemplateId?: Id<"thumbnailTemplates">;
  thumbnailGeneratedAt?: number;
  seoGenerationStatus?: string;
  seoGeneratedAt?: number;
  seoGenerationError?: string;
  seoValueProp?: string;
  seoBenefits?: string[];
  seoUseCases?: { query: string; answer: string }[];
  seoFaq?: { question: string; answer: string }[];
  seoResourceLinks?: { label: string; url: string }[];
  contentModelVersion?: number;
  contentGenerationStatus?: string;
  contentGeneratedAt?: number;
  contentGenerationError?: string;
  generatedDescription?: string;
  generatedUseCases?: string;
  generatedHowItWorks?: string;
  readmeIncludedMarkdown?: string;
  readmeIncludeSource?: "markers" | "full";
  skillMd?: string;
  npmDescription?: string;
  repositoryUrl?: string;
  npmUrl?: string;
  submittedShortDescription?: string;
  submittedLongDescription?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4 rounded-lg border border-border bg-bg-hover/30 p-2.5 sm:p-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        className="flex items-start justify-between gap-2 sm:gap-3 cursor-pointer select-none"
      >
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
            Component Details
          </h4>
          <p className="text-xs text-text-secondary mt-1">
            Edit submitter provided component details.
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium border border-border text-text-primary hover:bg-bg-hover transition-colors">
          {isOpen ? (
            "Hide"
          ) : (
            <>
              <span className="sm:hidden">Edit</span>
              <span className="hidden sm:inline">Edit details</span>
            </>
          )}
        </span>
      </div>

      {isOpen && (
        <ComponentDetailsEditor
          key={`${packageId}:${slug || ""}:${category || ""}:${componentName || ""}`}
          packageId={packageId}
          componentName={componentName}
          slug={slug}
          category={category}
          tags={tags}
          shortDescription={shortDescription}
          longDescription={longDescription}
          videoUrl={videoUrl}
          videoPosition={videoPosition}
          demoUrl={demoUrl}
          thumbnailUrl={thumbnailUrl}
          hideThumbnailInCategory={hideThumbnailInCategory}
          thumbnailUploadedByUser={thumbnailUploadedByUser}
          convexVerified={convexVerified}
          communitySubmitted={communitySubmitted}
          authorUsername={authorUsername}
          authorAvatar={authorAvatar}
          logoUrl={logoUrl}
          logoStorageId={logoStorageId}
          selectedTemplateId={selectedTemplateId}
          thumbnailGeneratedAt={thumbnailGeneratedAt}
          seoGenerationStatus={seoGenerationStatus}
          seoGeneratedAt={seoGeneratedAt}
          seoGenerationError={seoGenerationError}
          seoValueProp={seoValueProp}
          seoBenefits={seoBenefits}
          seoUseCases={seoUseCases}
          seoFaq={seoFaq}
          seoResourceLinks={seoResourceLinks}
          contentModelVersion={contentModelVersion}
          contentGenerationStatus={contentGenerationStatus}
          contentGeneratedAt={contentGeneratedAt}
          contentGenerationError={contentGenerationError}
          generatedDescription={generatedDescription}
          generatedUseCases={generatedUseCases}
          generatedHowItWorks={generatedHowItWorks}
          readmeIncludedMarkdown={readmeIncludedMarkdown}
          readmeIncludeSource={readmeIncludeSource}
          skillMd={skillMd}
          npmDescription={npmDescription}
          repositoryUrl={repositoryUrl}
          npmUrl={npmUrl}
          submittedShortDescription={submittedShortDescription}
          submittedLongDescription={submittedLongDescription}
        />
      )}
    </div>
  );
}

// Submitter email editor component for admin
function SubmitterEmailEditor({
  packageId,
  submitterEmail,
  additionalEmails,
  submitterName,
  submitterDiscord,
}: {
  packageId: Id<"packages">;
  submitterEmail?: string;
  additionalEmails?: string[];
  submitterName?: string;
  submitterDiscord?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [email, setEmail] = useState(submitterEmail || "");
  const [addEmails, setAddEmails] = useState(
    additionalEmails?.join(", ") || "",
  );
  const [nameVal, setNameVal] = useState(submitterName || "");
  const [discordVal, setDiscordVal] = useState(submitterDiscord || "");
  const [isSaving, setIsSaving] = useState(false);

  const updateSubmitterEmail = useMutation(api.packages.updateSubmitterEmail);
  const updateAdditionalEmails = useMutation(
    api.packages.updateAdditionalEmails,
  );
  const updateSubmitterInfo = useMutation(api.packages.updateSubmitterInfo);

  // Reset form when props change
  useEffect(() => {
    setEmail(submitterEmail || "");
    setAddEmails(additionalEmails?.join(", ") || "");
    setNameVal(submitterName || "");
    setDiscordVal(submitterDiscord || "");
  }, [submitterEmail, additionalEmails, submitterName, submitterDiscord]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update primary email if changed
      if (email !== submitterEmail) {
        await updateSubmitterEmail({ packageId, submitterEmail: email });
      }
      // Update additional emails
      const emailList = addEmails
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e && e.includes("@"));
      await updateAdditionalEmails({ packageId, additionalEmails: emailList });
      // Update name and discord if changed
      if (
        nameVal !== (submitterName || "") ||
        discordVal !== (submitterDiscord || "")
      ) {
        await updateSubmitterInfo({
          packageId,
          submitterName: nameVal,
          submitterDiscord: discordVal,
        });
      }
      toast.success("Submitter info updated");
      setIsEditing(false);
    } catch (err) {
      toast.error("Failed to update submitter info");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <div className="space-y-1.5">
        {/* Name and Discord row */}
        {(submitterName || submitterDiscord) && (
          <div className="flex flex-wrap items-center gap-3 p-2 rounded-lg bg-bg-hover/50 text-xs">
            {submitterName && (
              <span className="flex min-w-0 items-center gap-1 text-text-secondary">
                <User size={12} />
                <span className="break-words">{submitterName}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(submitterName);
                    toast.success("Name copied to clipboard");
                  }}
                  className="ml-0.5 p-0.5 rounded hover:bg-bg-hover hover:text-text-primary transition-colors"
                  title="Copy name"
                >
                  <Copy size={12} />
                </button>
              </span>
            )}
            {submitterDiscord && (
              <span className="flex min-w-0 items-center gap-1 text-text-secondary">
                <DiscordLogo size={12} />
                <span className="break-words">{submitterDiscord}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(submitterDiscord);
                    toast.success("Discord username copied to clipboard");
                  }}
                  className="ml-0.5 p-0.5 rounded hover:bg-bg-hover hover:text-text-primary transition-colors"
                  title="Copy Discord username"
                >
                  <Copy size={12} />
                </button>
              </span>
            )}
          </div>
        )}
        {/* Email row */}
        <div className="flex flex-wrap items-center gap-3 p-2 rounded-lg bg-bg-hover/50 text-xs">
          <span className="flex min-w-0 items-center gap-1 text-text-secondary">
            <Envelope size={12} />
            <span className="font-medium">Primary:</span>
            {submitterEmail ? (
              <span className="flex min-w-0 items-center gap-1">
                <a
                  href={`mailto:${submitterEmail}`}
                  className="break-all hover:text-text-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  {submitterEmail}
                </a>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(submitterEmail);
                    toast.success("Email copied to clipboard");
                  }}
                  className="p-0.5 rounded hover:bg-bg-hover hover:text-text-primary transition-colors"
                  title="Copy email"
                >
                  <Copy size={12} />
                </button>
              </span>
            ) : (
              <span className="text-text-tertiary italic">Not set</span>
            )}
          </span>
          {additionalEmails && additionalEmails.length > 0 && (
            <span className="flex min-w-0 items-center gap-1 text-text-secondary">
              <Plus size={10} />
              <span className="font-medium">Additional:</span>
              <span className="break-all">{additionalEmails.join(", ")}</span>
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-border hover:bg-bg-hover transition-colors"
          >
            <PencilSimple size={12} />
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-w-0 overflow-hidden p-3 rounded-lg bg-bg-hover/50 space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs font-medium text-text-primary">
        Edit Submitter Info
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">Name</label>
          <input
            type="text"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            placeholder="John Doe"
            className="w-full px-2 py-1.5 text-xs rounded border border-border bg-bg-primary text-text-primary outline-none focus:border-button"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">
            Discord
          </label>
          <input
            type="text"
            value={discordVal}
            onChange={(e) => setDiscordVal(e.target.value)}
            placeholder="username"
            className="w-full px-2 py-1.5 text-xs rounded border border-border bg-bg-primary text-text-primary outline-none focus:border-button"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-text-secondary mb-1">
          Primary Email (links to user profile)
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          className="w-full px-2 py-1.5 text-xs rounded border border-border bg-bg-primary text-text-primary outline-none focus:border-button"
        />
      </div>
      <div>
        <label className="block text-xs text-text-secondary mb-1">
          Additional Emails (comma separated, for multi-account access)
        </label>
        <input
          type="text"
          value={addEmails}
          onChange={(e) => setAddEmails(e.target.value)}
          placeholder="other@example.com, another@example.com"
          className="w-full px-2 py-1.5 text-xs rounded border border-border bg-bg-primary text-text-primary outline-none focus:border-button"
        />
        <p className="text-[10px] text-text-tertiary mt-1">
          Users can access this submission from their profile using any of these
          emails.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setIsEditing(false)}
          disabled={isSaving}
          className="px-3 py-1 text-xs rounded border border-border text-text-secondary hover:bg-bg-hover transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !email}
          className="px-3 py-1 text-xs rounded bg-button text-white hover:bg-button-hover transition-colors disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function AuthorToggleSection({
  packageId,
  submitterEmail,
  additionalEmails,
  submitterName,
  submitterDiscord,
}: {
  packageId: Id<"packages">;
  submitterEmail?: string;
  additionalEmails?: string[];
  submitterName?: string;
  submitterDiscord?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-3 rounded-lg border border-border bg-bg-hover/30 p-2.5 sm:p-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        className="flex items-start justify-between gap-2 sm:gap-3 cursor-pointer select-none"
      >
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
            Component Author
          </h4>
          <p className="text-xs text-text-secondary mt-1">
            Submitter name, email, and contact info.
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium border border-border text-text-primary hover:bg-bg-hover transition-colors">
          {isOpen ? (
            "Hide"
          ) : (
            <>
              <span className="sm:hidden">Show</span>
              <span className="hidden sm:inline">Show author</span>
            </>
          )}
        </span>
      </div>

      {isOpen && (
        <div className="mt-2.5 sm:mt-3">
          <SubmitterEmailEditor
            packageId={packageId}
            submitterEmail={submitterEmail}
            additionalEmails={additionalEmails}
            submitterName={submitterName}
            submitterDiscord={submitterDiscord}
          />
        </div>
      )}
    </div>
  );
}

function PackageMetadataEditor({
  packageId,
  initialName,
  initialDescription,
  initialNpmUrl,
  initialRepositoryUrl,
  initialHomepageUrl,
  initialInstallCommand,
  initialVersion,
  initialLicense,
  initialWeeklyDownloads,
  initialTotalFiles,
  initialLastPublish,
  initialCollaborators,
}: {
  packageId: Id<"packages">;
  initialName?: string;
  initialDescription?: string;
  initialNpmUrl?: string;
  initialRepositoryUrl?: string;
  initialHomepageUrl?: string;
  initialInstallCommand?: string;
  initialVersion?: string;
  initialLicense?: string;
  initialWeeklyDownloads?: number;
  initialTotalFiles?: number;
  initialLastPublish?: string;
  initialCollaborators?: Array<{ name: string; avatar: string }>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialName ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [npmUrl, setNpmUrl] = useState(initialNpmUrl ?? "");
  const [repositoryUrl, setRepositoryUrl] = useState(
    initialRepositoryUrl ?? "",
  );
  const [homepageUrl, setHomepageUrl] = useState(initialHomepageUrl ?? "");
  const [installCommand, setInstallCommand] = useState(
    initialInstallCommand ?? "",
  );
  const [version, setVersion] = useState(initialVersion ?? "");
  const [license, setLicense] = useState(initialLicense ?? "");
  const [weeklyDownloads, setWeeklyDownloads] = useState(
    initialWeeklyDownloads?.toString() ?? "",
  );
  const [totalFiles, setTotalFiles] = useState(
    initialTotalFiles?.toString() ?? "",
  );
  const [lastPublish, setLastPublish] = useState(initialLastPublish ?? "");
  const [collaboratorsText, setCollaboratorsText] = useState(() =>
    (initialCollaborators ?? [])
      .map((c) => `${c.name} | ${c.avatar}`)
      .join("\n"),
  );
  const updateMetadata = useMutation(api.packages.updatePackageSourceMetadata);

  const parseNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : NaN;
  };

  const parseCollaborators = (value: string) => {
    const lines = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const parsed: Array<{ name: string; avatar: string }> = [];
    for (const line of lines) {
      const [namePart, avatarPart] = line.split("|").map((part) => part.trim());
      if (!namePart || !avatarPart) {
        return null;
      }
      parsed.push({ name: namePart, avatar: avatarPart });
    }
    return parsed;
  };

  return (
    <div className="mt-3 rounded-lg border border-border bg-bg-hover/30 p-2.5 sm:p-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        className="flex items-start justify-between gap-2 sm:gap-3 cursor-pointer select-none"
      >
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
            Package Metadata
          </h4>
          <p className="text-xs text-text-secondary mt-1">
            Manual override for npm and repository sourced fields.
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium border border-border text-text-primary hover:bg-bg-hover transition-colors">
          {isOpen ? (
            "Hide"
          ) : (
            <>
              <span className="sm:hidden">Edit</span>
              <span className="hidden sm:inline">Edit metadata</span>
            </>
          )}
        </span>
      </div>

      {isOpen && (
        <div className="mt-3 min-w-0 overflow-hidden space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
                Package Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary resize-y outline-none focus:ring-1 focus:ring-button"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
                npm URL
              </label>
              <input
                type="text"
                value={npmUrl}
                onChange={(e) => setNpmUrl(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
                Repository URL
              </label>
              <input
                type="text"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
                Homepage URL
              </label>
              <input
                type="text"
                value={homepageUrl}
                onChange={(e) => setHomepageUrl(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
                Install Command
              </label>
              <input
                type="text"
                value={installCommand}
                onChange={(e) => setInstallCommand(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
                Version
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
                License
              </label>
              <input
                type="text"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
                Weekly Downloads
              </label>
              <input
                type="number"
                min="0"
                value={weeklyDownloads}
                onChange={(e) => setWeeklyDownloads(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
                File Count
              </label>
              <input
                type="number"
                min="0"
                value={totalFiles}
                onChange={(e) => setTotalFiles(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
                Last Publish (ISO datetime)
              </label>
              <input
                type="text"
                value={lastPublish}
                onChange={(e) => setLastPublish(e.target.value)}
                placeholder="2026-02-14T12:00:00.000Z"
                className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
                Collaborators (one per line: Name | Avatar URL)
              </label>
              <textarea
                value={collaboratorsText}
                onChange={(e) => setCollaboratorsText(e.target.value)}
                rows={4}
                placeholder={"Jane Doe | https://example.com/avatar.png"}
                className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary resize-y outline-none focus:ring-1 focus:ring-button"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  setSaving(true);
                  try {
                    const parsedWeeklyDownloads = parseNumber(weeklyDownloads);
                    if (Number.isNaN(parsedWeeklyDownloads)) {
                      toast.error("Weekly downloads must be a valid number");
                      return;
                    }
                    const parsedTotalFiles = parseNumber(totalFiles);
                    if (Number.isNaN(parsedTotalFiles)) {
                      toast.error("File count must be a valid number");
                      return;
                    }

                    const parsedCollaborators =
                      parseCollaborators(collaboratorsText);
                    if (parsedCollaborators === null) {
                      toast.error(
                        "Each collaborator line must be in the format: Name | Avatar URL",
                      );
                      return;
                    }

                    await updateMetadata({
                      packageId,
                      name: name.trim() || undefined,
                      description: description.trim() || undefined,
                      npmUrl: npmUrl.trim() || undefined,
                      repositoryUrl: repositoryUrl.trim() || undefined,
                      homepageUrl: homepageUrl.trim() || undefined,
                      installCommand: installCommand.trim() || undefined,
                      version: version.trim() || undefined,
                      license: license.trim() || undefined,
                      weeklyDownloads: parsedWeeklyDownloads,
                      totalFiles: parsedTotalFiles,
                      lastPublish: lastPublish.trim() || undefined,
                      collaborators:
                        parsedCollaborators.length > 0
                          ? parsedCollaborators
                          : undefined,
                    });
                    toast.success("Package metadata saved");
                  } catch (error) {
                    const msg =
                      error instanceof Error
                        ? error.message
                        : "Could not save package metadata";
                    toast.error(msg);
                  } finally {
                    setSaving(false);
                  }
                })();
              }}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-full bg-button text-white hover:bg-button-hover transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save metadata"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ComponentDetailQuickLink({ slug }: { slug?: string }) {
  if (!slug) return null;

  const basePath = window.location.pathname.startsWith("/components")
    ? "/components"
    : "";
  const detailUrl = `${basePath}/${slug}`;

  return (
    <Tooltip content="Open component detail page" position="top">
      <a
        href={detailUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Open component detail page in a new tab"
        className="inline-flex items-center self-center shrink-0 text-text-secondary hover:text-text-primary transition-colors"
      >
        <RadixExternalLinkIcon className="w-3.5 h-3.5" />
      </a>
    </Tooltip>
  );
}

// Custom tooltip component - supports top/bottom positioning
function Tooltip({
  children,
  content,
  position = "bottom",
}: {
  children: React.ReactNode;
  content: string;
  position?: "top" | "bottom";
}) {
  return (
    <div className="relative group">
      {children}
      {position === "top" ? (
        <div className="absolute z-50 px-2 py-1 text-xs font-normal text-white bg-dark rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap bottom-full left-1/2 -translate-x-1/2 mb-1">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-dark" />
        </div>
      ) : (
        <div className="absolute z-50 px-2 py-1 text-xs font-normal text-white bg-dark rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap top-full left-1/2 -translate-x-1/2 mt-1">
          {content}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-dark" />
        </div>
      )}
    </div>
  );
}

// Custom confirmation modal
function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Yes",
  cancelText = "No",
  type = "warning",
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "warning" | "danger";
}) {
  // Close on ESC
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm p-6 rounded-container bg-white border border-border shadow-lg">
        <div className="flex items-start gap-3 mb-4">
          <div
            className={`shrink-0 ${type === "danger" ? "text-red-600" : "text-yellow-600"}`}
          >
            <Warning size={24} weight="bold" />
          </div>
          <div>
            <h3 className="text-lg font-normal text-text-primary">{title}</h3>
            <p className="mt-1 text-sm text-text-secondary">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm font-normal border border-border text-text-primary hover:bg-bg-hover transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-full text-sm font-normal text-white transition-colors ${
              type === "danger"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-button hover:bg-button-hover"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Notes panel for package - shows threaded notes with reply capability
function NotesPanel({
  packageId,
  packageName,
  userEmail,
  userName,
  isOpen,
  onClose,
}: {
  packageId: Id<"packages">;
  packageName: string;
  userEmail: string;
  userName?: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [newNote, setNewNote] = useState("");
  const [replyingTo, setReplyingTo] = useState<Id<"packageNotes"> | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const notes = useQuery(api.packages.getPackageNotes, { packageId });
  const addNote = useMutation(api.packages.addPackageNote);
  const deleteNote = useMutation(api.packages.deletePackageNote);
  const markNotesRead = useMutation(api.packages.markNotesAsReadForAdmin);
  const unreadNotesCount = useQuery(api.packages.getUnreadUserNotesCount, {
    packageId,
  });

  // Handle ESC key to close panel
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Separate top-level notes and replies
  const topLevelNotes = notes?.filter((n) => !n.parentNoteId) || [];
  const getReplies = (parentId: Id<"packageNotes">) =>
    notes?.filter((n) => n.parentNoteId === parentId) || [];

  const handleAddNote = async () => {
    if (!newNote.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addNote({
        packageId,
        content: newNote.trim(),
      });
      setNewNote("");
      toast.success("Note added");
    } catch (error) {
      toast.error("Failed to add note");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddReply = async (parentNoteId: Id<"packageNotes">) => {
    if (!replyContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addNote({
        packageId,
        content: replyContent.trim(),
        parentNoteId,
      });
      setReplyContent("");
      setReplyingTo(null);
      toast.success("Reply added");
    } catch (error) {
      toast.error("Failed to add reply");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: Id<"packageNotes">) => {
    try {
      await deleteNote({ noteId });
      toast.success("Note deleted");
    } catch (error) {
      toast.error("Failed to delete note");
    }
  };

  const formatNoteDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-container bg-white border border-border shadow-lg">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-2 sm:block">
            <div className="min-w-0">
              <h3 className="text-lg font-normal text-text-primary flex items-center gap-2 flex-wrap">
                <span>Admin Notes</span>
                {unreadNotesCount !== undefined && unreadNotesCount > 0 && (
                  <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-600">
                    {unreadNotesCount} unread
                  </span>
                )}
              </h3>
              <p className="text-xs text-text-secondary truncate max-w-xs">
                {packageName}
              </p>
              <p className="text-xs text-orange-600 mt-1">
                Internal only. Not visible to users.
              </p>
            </div>
            <button
              onClick={onClose}
              className="sm:hidden shrink-0 p-1 rounded-full text-text-secondary hover:bg-bg-hover transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {unreadNotesCount !== undefined && unreadNotesCount > 0 && (
              <button
                onClick={() => markNotesRead({ packageId })}
                className="px-3 py-1.5 text-xs font-medium rounded-full border border-border bg-white text-text-primary hover:bg-bg-hover transition-colors whitespace-nowrap shrink-0"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="hidden sm:inline-flex p-1 rounded-full text-text-secondary hover:bg-bg-hover transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {notes === undefined ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-button"></div>
            </div>
          ) : topLevelNotes.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-8">
              No notes yet. Add the first note below.
            </p>
          ) : (
            topLevelNotes.map((note) => (
              <div key={note._id} className="space-y-2">
                {/* Main note */}
                <div className="p-3 rounded-lg bg-bg-hover/50 border border-border overflow-hidden">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary min-w-0">
                      <User size={12} className="shrink-0" />
                      <span className="font-medium whitespace-nowrap">
                        {note.authorName || note.authorEmail.split("@")[0]}
                      </span>
                      <span className="whitespace-nowrap">
                        {formatNoteDate(note.createdAt)}
                      </span>
                    </div>
                    {note.authorEmail === userEmail && (
                      <button
                        onClick={() => handleDeleteNote(note._id)}
                        className="shrink-0 text-text-secondary hover:text-red-600 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-text-primary whitespace-pre-wrap break-words">
                    {note.content}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() =>
                        setReplyingTo(replyingTo === note._id ? null : note._id)
                      }
                      className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <ArrowBendUpLeft size={12} />
                      Reply
                      {note.replyCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-bg-primary text-text-secondary">
                          {note.replyCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Replies */}
                {getReplies(note._id).length > 0 && (
                  <div className="ml-4 space-y-2 border-l-2 border-border pl-3">
                    {getReplies(note._id).map((reply) => (
                      <div
                        key={reply._id}
                        className="p-2 rounded-lg bg-bg-primary border border-border overflow-hidden"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary min-w-0">
                            <User size={10} className="shrink-0" />
                            <span className="font-medium whitespace-nowrap">
                              {reply.authorName ||
                                reply.authorEmail.split("@")[0]}
                            </span>
                            <span className="whitespace-nowrap">
                              {formatNoteDate(reply.createdAt)}
                            </span>
                          </div>
                          {reply.authorEmail === userEmail && (
                            <button
                              onClick={() => handleDeleteNote(reply._id)}
                              className="shrink-0 text-text-secondary hover:text-red-600 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-text-primary whitespace-pre-wrap break-words">
                          {reply.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply input */}
                {replyingTo === note._id && (
                  <div className="ml-4 flex gap-2">
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Write a reply... (Enter to send, Shift+Enter for new line)"
                      rows={2}
                      className="flex-1 px-3 py-2 rounded-lg border border-border bg-bg-primary text-text-primary text-sm outline-none focus:border-button transition-colors resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAddReply(note._id);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleAddReply(note._id)}
                      disabled={isSubmitting || !replyContent.trim()}
                      className="px-3 py-2 rounded-lg bg-button text-white hover:bg-button-hover transition-colors disabled:opacity-50 self-end"
                    >
                      <PaperPlaneTilt size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add note input */}
        <div className="p-4 border-t border-border shrink-0">
          <p className="text-xs text-text-secondary mb-2">
            Press Enter to send, Shift+Enter for new line
          </p>
          <div className="flex gap-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-bg-primary text-text-primary text-sm outline-none focus:border-button transition-colors resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
            />
            <button
              onClick={handleAddNote}
              disabled={isSubmitting || !newNote.trim()}
              className="px-4 py-2 rounded-lg bg-button text-white hover:bg-button-hover transition-colors disabled:opacity-50 self-end"
            >
              <PaperPlaneTilt size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Notes button with count badge and unreplied user request indicator
function NotesButton({
  packageId,
  packageName,
  userEmail,
  userName,
}: {
  packageId: Id<"packages">;
  packageName: string;
  userEmail: string;
  userName?: string;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const noteCount = useQuery(api.packages.getPackageNoteCount, { packageId });
  const badgeCount = noteCount;
  const badgeColor = "bg-orange-500";

  return (
    <>
      <Tooltip
        content={`Admin notes (internal)${noteCount ? ` (${noteCount})` : ""}`}
      >
        <button
          onClick={() => setShowNotes(true)}
          className="relative flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
        >
          <ChatText size={14} weight="bold" />
          <span>Notes</span>
          {badgeCount !== undefined && badgeCount > 0 && (
            <span
              className={`absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full ${badgeColor} text-white`}
            >
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </button>
      </Tooltip>

      <NotesPanel
        packageId={packageId}
        packageName={packageName}
        userEmail={userEmail}
        userName={userName}
        isOpen={showNotes}
        onClose={() => setShowNotes(false)}
      />
    </>
  );
}

// Client-side mirror of convex/githubIssues parseGitHubRepo: only github.com
// repos can receive issues, so the checkbox is hidden for anything else.
function isGitHubRepoUrl(url?: string): boolean {
  return !!url && /^(https?:\/\/)?(www\.)?github\.com\/[^/\s]+\/[^/\s]+/i.test(url.trim());
}

// Comments panel for package - private user/admin messages
function CommentsPanel({
  packageId,
  packageName,
  userEmail,
  repositoryUrl,
  isOpen,
  onClose,
}: {
  packageId: Id<"packages">;
  packageName: string;
  userEmail: string;
  repositoryUrl?: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  // On by default: admins almost always want the submitter notified on GitHub.
  // Untick per message to keep it private. Ignored when the repo is not github.com.
  const [alsoCreateGithubIssue, setAlsoCreateGithubIssue] = useState(true);
  const canMirrorToGithub = isGitHubRepoUrl(repositoryUrl);
  // GitLab repos are read only in this app, so explain why the mirror box is missing.
  const isGitLabRepo = parseRepoUrl(repositoryUrl)?.provider === "gitlab";

  const comments = useQuery(api.packages.getPackageComments, {
    packageId,
    includeInactive: showInactive,
  });
  const addComment = useMutation(api.packages.addPackageComment);
  const deleteComment = useMutation(api.packages.deletePackageComment);
  const updateCommentStatus = useMutation(
    api.packages.updatePackageCommentStatus,
  );
  const markAsRead = useMutation(api.packages.markCommentsAsReadForAdmin);
  const markOneCommentRead = useMutation(
    api.packages.markPackageCommentReadForAdmin,
  );
  const unreadCount = useQuery(api.packages.getUnreadCommentsCount, {
    packageId,
  });
  // Existing GitHub issue for this package, if any. Drives the checkbox label
  // so the admin knows whether the message becomes a comment or a new issue.
  const openIssue = useQuery(
    api.githubIssues.getOpenIssueForPackage,
    canMirrorToGithub ? { packageId } : "skip",
  );
  const willCommentOnIssue = !!openIssue && openIssue.state !== "closed";

  // Review outcome draft (rejection or approval) waiting for a human send.
  const draft = useQuery(
    api.reviewMessages.getReviewMessageDraft,
    isOpen ? { packageId } : "skip",
  );
  const updateDraft = useMutation(api.reviewMessages.updateReviewMessageDraft);
  const regenerateDraft = useMutation(
    api.reviewMessages.regenerateReviewMessageDraft,
  );
  const dismissDraft = useMutation(
    api.reviewMessages.dismissReviewMessageDraft,
  );
  const sendDraft = useMutation(api.reviewMessages.sendReviewMessageDraft);
  // Draft currently loaded into the composer, and the last content we know
  // the server has, so autosave and live refresh do not fight the admin.
  const [loadedDraftId, setLoadedDraftId] =
    useState<Id<"reviewMessageDrafts"> | null>(null);
  const [syncedDraftContent, setSyncedDraftContent] = useState("");
  const [draftDetached, setDraftDetached] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [isDraftBusy, setIsDraftBusy] = useState(false);

  // Prefill the composer once per draft, only when the admin has not typed.
  if (draft && draft._id !== loadedDraftId && newComment === "") {
    setLoadedDraftId(draft._id);
    setSyncedDraftContent(draft.content);
    setDraftDetached(false);
    setConfirmDiscard(false);
    setNewComment(draft.content);
  }
  const isDraftMode =
    !!draft && draft._id === loadedDraftId && !draftDetached;
  // Pick up server side refreshes (new AI review run) while untouched.
  if (
    isDraftMode &&
    draft.content !== syncedDraftContent &&
    newComment === syncedDraftContent
  ) {
    setSyncedDraftContent(draft.content);
    setNewComment(draft.content);
  }
  const isDraftEdited =
    isDraftMode &&
    (draft.editedAt !== undefined || newComment.trim() !== draft.content);

  // Debounced autosave of composer edits back to the draft.
  useEffect(() => {
    if (!isDraftMode || !loadedDraftId) return;
    const content = newComment.trim();
    if (!content || content === syncedDraftContent) return;
    const timer = setTimeout(() => {
      updateDraft({ draftId: loadedDraftId, content })
        .then(() => setSyncedDraftContent(content))
        .catch(() => toast.error("Could not save draft changes"));
    }, 500);
    return () => clearTimeout(timer);
  }, [isDraftMode, loadedDraftId, newComment, syncedDraftContent, updateDraft]);

  // Handle ESC key to close panel
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const errorText = (error: unknown, fallback: string) =>
    error instanceof ConvexError ? String(error.data) : fallback;

  const handleSendDraft = async () => {
    if (!draft || !newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    const mirror = canMirrorToGithub && alsoCreateGithubIssue;
    const label =
      draft.kind === "rejected" ? "Rejection message" : "Approval message";
    try {
      await sendDraft({
        draftId: draft._id,
        content: newComment.trim(),
        alsoCreateGithubIssue: mirror,
      });
      setNewComment("");
      toast.success(
        mirror
          ? willCommentOnIssue
            ? `${label} sent, replying on the GitHub issue`
            : `${label} sent, opening GitHub issue`
          : `${label} sent`,
      );
    } catch (error) {
      toast.error(errorText(error, "Failed to send message"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerateDraft = async () => {
    if (!draft || isDraftBusy) return;
    setIsDraftBusy(true);
    try {
      const content = await regenerateDraft({ draftId: draft._id });
      setSyncedDraftContent(content);
      setNewComment(content);
      toast.success("Draft rebuilt from the latest review");
    } catch (error) {
      toast.error(errorText(error, "Failed to rebuild draft"));
    } finally {
      setIsDraftBusy(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (!draft || isDraftBusy) return;
    setIsDraftBusy(true);
    try {
      await dismissDraft({ draftId: draft._id });
      setNewComment("");
      setConfirmDiscard(false);
      toast.success("Draft discarded");
    } catch (error) {
      toast.error(errorText(error, "Failed to discard draft"));
    } finally {
      setIsDraftBusy(false);
    }
  };

  // Keep the draft saved but clear the composer for a free form message.
  const handleDetachDraft = () => {
    setDraftDetached(true);
    setConfirmDiscard(false);
    setNewComment("");
  };

  const handleUseDraft = () => {
    if (!draft) return;
    setDraftDetached(false);
    setSyncedDraftContent(draft.content);
    setNewComment(draft.content);
  };

  const handleAddComment = async () => {
    if (isDraftMode) {
      await handleSendDraft();
      return;
    }
    if (!newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    const mirror = canMirrorToGithub && alsoCreateGithubIssue;
    try {
      await addComment({
        packageId,
        content: newComment.trim(),
        alsoCreateGithubIssue: mirror || undefined,
      });
      setNewComment("");
      toast.success(
        mirror
          ? willCommentOnIssue
            ? "Message added, replying on the GitHub issue"
            : "Message added, opening GitHub issue"
          : "Message added",
      );
    } catch (error) {
      toast.error("Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: Id<"packageComments">) => {
    try {
      await deleteComment({ commentId });
      toast.success("Comment deleted");
    } catch (error) {
      toast.error("Failed to delete comment");
    }
  };

  const handleSetCommentStatus = async (
    commentId: Id<"packageComments">,
    status: "hidden" | "archived" | "active",
  ) => {
    try {
      await updateCommentStatus({ commentId, status });
      if (status === "active") {
        toast.success("Message restored");
      } else {
        toast.success(
          status === "hidden" ? "Message hidden" : "Message archived",
        );
      }
    } catch (error) {
      toast.error("Failed to update message");
    }
  };

  const handleMarkOneCommentRead = async (commentId: Id<"packageComments">) => {
    try {
      await markOneCommentRead({ commentId });
      toast.success("Marked as read");
    } catch (error) {
      toast.error("Failed to mark as read");
    }
  };

  const formatCommentDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-container bg-white border border-border shadow-lg">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-2 sm:block">
            <div className="min-w-0">
              <h3 className="text-lg font-normal text-text-primary flex items-center gap-2 flex-wrap">
                <span>User Messages</span>
                {unreadCount !== undefined && unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-600">
                    {unreadCount} unread
                  </span>
                )}
              </h3>
              <p className="text-xs text-text-secondary truncate max-w-xs">
                {packageName}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Private thread between submitter and admins.
              </p>
            </div>
            <button
              onClick={onClose}
              className="sm:hidden shrink-0 p-1 rounded-full text-text-secondary hover:bg-bg-hover transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <button
              onClick={() => setShowInactive((prev) => !prev)}
              className="text-xs text-text-secondary hover:text-text-primary transition-colors whitespace-nowrap"
            >
              {showInactive ? (
                <>
                  <span className="sm:hidden">Hide archived</span>
                  <span className="hidden sm:inline">
                    Hide hidden or archived
                  </span>
                </>
              ) : (
                <>
                  <span className="sm:hidden">Show archived</span>
                  <span className="hidden sm:inline">
                    Show hidden or archived
                  </span>
                </>
              )}
            </button>
            {unreadCount !== undefined && unreadCount > 0 && (
              <button
                onClick={() => markAsRead({ packageId })}
                className="px-3 py-1.5 text-xs font-medium rounded-full border border-border bg-white text-text-primary hover:bg-bg-hover transition-colors whitespace-nowrap shrink-0"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="hidden sm:inline-flex p-1 rounded-full text-text-secondary hover:bg-bg-hover transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments === undefined ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-button"></div>
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-8">
              {showInactive
                ? "No messages yet."
                : "No active messages yet. Add the first message below."}
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment._id}
                className="p-3 rounded-lg bg-bg-hover/50 border border-border overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary min-w-0">
                    <User size={12} className="shrink-0" />
                    <span className="font-medium whitespace-nowrap">
                      {comment.authorName || comment.authorEmail.split("@")[0]}
                    </span>
                    <span className="whitespace-nowrap">
                      {formatCommentDate(comment.createdAt)}
                    </span>
                    {comment.adminHasRead !== true && (
                      <span className="px-1.5 py-0.5 rounded-full bg-green-500 text-white text-[10px] font-medium whitespace-nowrap shrink-0">
                        New
                      </span>
                    )}
                    {/* Mirrored from a GitHub issue reply by githubReplySync */}
                    {comment.source === "github" && (
                      <a
                        href={comment.githubCommentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-border text-[10px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors whitespace-nowrap shrink-0"
                        title="Reply posted on the GitHub issue"
                      >
                        <GithubLogo size={10} />
                        via GitHub
                        {comment.githubAuthorLogin
                          ? ` @${comment.githubAuthorLogin}`
                          : ""}
                      </a>
                    )}
                    {/* Review outcome message sent by an auto send setting */}
                    {comment.source === "system" && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-border text-[10px] text-text-secondary whitespace-nowrap shrink-0"
                        title="Sent automatically by a Review messages setting"
                      >
                        <Robot size={10} />
                        Auto-sent
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 shrink-0">
                    {(comment.authorEmail === userEmail ||
                      comment.source === "system") && (
                      <>
                        {!comment.status || comment.status === "active" ? (
                          <>
                            <button
                              onClick={() =>
                                handleSetCommentStatus(comment._id, "hidden")
                              }
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors whitespace-nowrap shrink-0"
                            >
                              <EyeSlash size={10} />
                              Hide
                            </button>
                            <button
                              onClick={() =>
                                handleSetCommentStatus(comment._id, "archived")
                              }
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors whitespace-nowrap shrink-0"
                            >
                              <Archive size={10} />
                              Archive
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() =>
                              handleSetCommentStatus(comment._id, "active")
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors whitespace-nowrap shrink-0"
                          >
                            <Eye size={10} />
                            Restore
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteComment(comment._id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
                        >
                          <X size={10} />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm text-text-primary whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
                {/* GitHub mirror state, patched in by githubIssues.createIssueForComment */}
                {comment.githubIssueStatus === "pending" && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-secondary">
                    <GithubLogo size={12} />
                    Opening GitHub issue...
                  </p>
                )}
                {comment.githubIssueStatus === "created" &&
                  comment.githubIssueUrl && (
                    <a
                      href={comment.githubIssueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <GithubLogo size={12} />
                      {comment.githubMirrorKind === "comment"
                        ? "Sent as GitHub comment"
                        : "Sent as GitHub issue"}
                      {comment.githubIssueState === "closed" && (
                        <span className="px-1.5 py-0.5 rounded-full bg-bg-hover text-[10px] text-text-secondary">
                          Closed
                        </span>
                      )}
                      <ArrowSquareOut size={11} />
                    </a>
                  )}
                {comment.githubIssueStatus === "failed" && (
                  <p
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-red-600"
                    title={comment.githubIssueError}
                  >
                    <GithubLogo size={12} />
                    GitHub issue failed
                    {comment.githubIssueError
                      ? `: ${comment.githubIssueError}`
                      : ""}
                  </p>
                )}
                {comment.status && comment.status !== "active" && (
                  <p className="mt-2 text-xs text-text-secondary">
                    Status:{" "}
                    {comment.status === "hidden" ? "Hidden" : "Archived"}
                  </p>
                )}
                {comment.adminHasRead !== true && (
                  <div className="mt-2">
                    <button
                      onClick={() => handleMarkOneCommentRead(comment._id)}
                      className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                      title="Mark this message as read"
                    >
                      Mark read
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add comment input */}
        <div className="p-4 border-t border-border shrink-0">
          {/* Review outcome draft banner */}
          {isDraftMode && (
            <div
              className={`mb-3 rounded-lg border px-3 py-2 ${
                draft.kind === "rejected"
                  ? "border-red-200 bg-red-50/60"
                  : "border-green-200 bg-green-50/60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                  {draft.kind === "rejected" ? (
                    <XCircle size={14} weight="fill" className="text-red-500" />
                  ) : (
                    <CheckCircle
                      size={14}
                      weight="fill"
                      className="text-green-600"
                    />
                  )}
                  {draft.kind === "rejected"
                    ? "Rejection draft from AI review"
                    : "Approval draft"}
                </p>
                <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-white border border-border text-[10px] text-text-secondary">
                  Not sent yet
                </span>
              </div>
              <p className="mt-1 text-[11px] text-text-secondary leading-snug">
                Review and edit below. Edits save automatically. Nothing goes
                to the submitter until you send.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {isDraftEdited && (
                  <button
                    onClick={handleRegenerateDraft}
                    disabled={isDraftBusy}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border border-border bg-white text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-50"
                    title="Replace your edits with a fresh draft from the latest review"
                  >
                    <ArrowClockwise size={10} />
                    Regenerate
                  </button>
                )}
                <button
                  onClick={handleDetachDraft}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border border-border bg-white text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                >
                  <PencilSimple size={10} />
                  Write a different message
                </button>
                {confirmDiscard ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary">
                    Discard this draft?
                    <button
                      onClick={handleDiscardDraft}
                      disabled={isDraftBusy}
                      className="px-2 py-0.5 rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      Discard
                    </button>
                    <button
                      onClick={() => setConfirmDiscard(false)}
                      className="px-2 py-0.5 rounded-full border border-border bg-white text-text-secondary hover:bg-bg-hover transition-colors"
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmDiscard(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <X size={10} />
                    Discard
                  </button>
                )}
              </div>
            </div>
          )}
          {/* Draft set aside for a free form message */}
          {draft && draftDetached && draft._id === loadedDraftId && (
            <p className="mb-2 flex items-center gap-2 text-[11px] text-text-secondary">
              {draft.kind === "rejected" ? "Rejection" : "Approval"} draft is
              saved.
              <button
                onClick={handleUseDraft}
                className="text-text-primary underline underline-offset-2 hover:no-underline"
              >
                Use draft
              </button>
            </p>
          )}
          <p className="text-xs text-text-secondary mb-2">
            {isDraftMode
              ? "Press Cmd+Enter or Ctrl+Enter to send"
              : "Press Enter to send, Shift+Enter for new line"}
          </p>
          <div className="flex gap-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a private message..."
              rows={isDraftMode ? 8 : 2}
              aria-label={
                isDraftMode ? "Review message draft" : "Private message"
              }
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-bg-primary text-text-primary text-sm outline-none focus:border-button transition-colors resize-none"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                // Long drafts need Enter for new lines; send is explicit.
                const sendNow = isDraftMode
                  ? e.metaKey || e.ctrlKey
                  : !e.shiftKey;
                if (sendNow) {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
            />
            <button
              onClick={handleAddComment}
              disabled={isSubmitting || !newComment.trim()}
              className="px-4 py-2 rounded-lg bg-button text-white hover:bg-button-hover transition-colors disabled:opacity-50 self-end"
              aria-label={isDraftMode ? "Send review message" : "Send message"}
            >
              <PaperPlaneTilt size={16} />
            </button>
          </div>
          {/* GitHub mirror option, only when the package points at github.com */}
          {canMirrorToGithub && (
            <label className="mt-3 flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={alsoCreateGithubIssue}
                onChange={(e) => setAlsoCreateGithubIssue(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-button"
              />
              <span className="text-xs text-text-secondary leading-snug">
                <span className="inline-flex items-center gap-1 text-text-primary">
                  <GithubLogo size={12} />
                  {willCommentOnIssue
                    ? `Also reply on the open GitHub issue #${openIssue.issueKey.split("#")[1]}`
                    : openIssue?.state === "closed"
                      ? "Open a new GitHub issue (previous one is closed)"
                      : "Also send as a GitHub issue"}
                </span>
                <span className="block text-[11px] text-text-secondary/80">
                  {willCommentOnIssue
                    ? "Posts a comment on the existing issue so the conversation stays in one place. The thread stays private."
                    : "Opens a public issue on the submitter's repo so they get notified. The thread stays private."}
                </span>
              </span>
            </label>
          )}
          {isGitLabRepo && (
            <p className="mt-3 text-[11px] text-text-secondary/80">
              Issue mirroring is available for GitHub repositories only.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// User messages button with count badge and unread indicator
function CommentsButton({
  packageId,
  packageName,
  userEmail,
  repositoryUrl,
}: {
  packageId: Id<"packages">;
  packageName: string;
  userEmail: string;
  repositoryUrl?: string;
}) {
  const [showComments, setShowComments] = useState(false);
  const commentCount = useQuery(api.packages.getPackageCommentCount, {
    packageId,
  });
  const unreadCount = useQuery(api.packages.getUnreadCommentsCount, {
    packageId,
  });

  // Shared subscription across rows: one query for every Messages button.
  const packagesWithDrafts = useQuery(
    api.reviewMessages.listPackagesWithPendingDrafts,
    {},
  );
  const hasDraft = packagesWithDrafts?.includes(packageId) ?? false;

  const hasUnread = unreadCount !== undefined && unreadCount > 0;
  const badgeCount = hasUnread ? unreadCount : commentCount;
  const badgeColor = hasUnread ? "bg-blue-500" : "bg-green-500";
  const baseTooltip = hasUnread
    ? `${unreadCount} unread message${unreadCount > 1 ? "s" : ""}`
    : `User messages${commentCount ? ` (${commentCount})` : ""}`;

  return (
    <>
      <Tooltip
        content={
          hasDraft ? `${baseTooltip}. Review message draft ready` : baseTooltip
        }
      >
        <button
          onClick={() => setShowComments(true)}
          className={`relative flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            hasUnread
              ? "border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
              : "border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
          }`}
        >
          <ChatCircleText size={14} weight="bold" />
          <span>Messages</span>
          {badgeCount !== undefined && badgeCount > 0 && (
            <span
              className={`absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full ${badgeColor} text-white`}
            >
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
          {hasDraft && (
            <span
              className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white"
              aria-label="Review message draft ready"
            />
          )}
        </button>
      </Tooltip>

      <CommentsPanel
        packageId={packageId}
        packageName={packageName}
        userEmail={userEmail}
        repositoryUrl={repositoryUrl}
        isOpen={showComments}
        onClose={() => setShowComments(false)}
      />
    </>
  );
}

// AI Review status type
type AiReviewStatus =
  | "not_reviewed"
  | "reviewing"
  | "passed"
  | "failed"
  | "partial"
  | "error";

type AiReviewCriterion = {
  name: string;
  passed: boolean;
  notes: string;
};

type AiReviewRun = {
  _id: Id<"aiReviewRuns">;
  _creationTime: number;
  packageId: Id<"packages">;
  createdAt: number;
  status: Exclude<AiReviewStatus, "not_reviewed" | "reviewing">;
  summary: string;
  criteria: Array<AiReviewCriterion>;
  error?: string;
  provider?: "anthropic" | "openai" | "gemini";
  model?: string;
  source?: string;
  rawOutput?: string;
};

// AI Review button component
function AiReviewButton({
  packageId,
  packageName,
  repositoryUrl,
}: {
  packageId: Id<"packages">;
  packageName: string;
  repositoryUrl?: string;
}) {
  const [isReviewing, setIsReviewing] = useState(false);
  const runAiReview = useAction(api.aiReview.runAiReview);

  const handleReview = async () => {
    if (isReviewing) return;
    setIsReviewing(true);
    try {
      await runAiReview({ packageId });
      toast.success("AI review completed!");
    } catch (error) {
      toast.error("AI review failed");
    } finally {
      setIsReviewing(false);
    }
  };

  const tooltipContent = !repositoryUrl
    ? "No repository URL available for AI review"
    : isReviewing
      ? "AI review in progress..."
      : "Run AI review against Convex component specs";

  return (
    <Tooltip content={tooltipContent}>
      <button
        onClick={handleReview}
        disabled={isReviewing || !repositoryUrl}
        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Robot
          size={14}
          weight="bold"
          className={isReviewing ? "animate-pulse" : ""}
        />
        <span>{isReviewing ? "Reviewing..." : "AI Review"}</span>
      </button>
    </Tooltip>
  );
}

// AI Review status badge
function AiReviewStatusBadge({
  status,
}: {
  status: AiReviewStatus | undefined;
}) {
  if (!status || status === "not_reviewed") return null;

  const config: Record<
    Exclude<AiReviewStatus, "not_reviewed">,
    { icon: React.ReactNode; label: string; className: string }
  > = {
    reviewing: {
      icon: <Robot size={12} weight="bold" className="animate-pulse" />,
      label: "AI Reviewing...",
      className: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    },
    passed: {
      icon: <CheckCircle size={12} weight="bold" />,
      label: "AI Passed",
      className: "bg-green-500/10 text-green-600 border-green-500/20",
    },
    failed: {
      icon: <XCircle size={12} weight="bold" />,
      label: "AI Failed",
      className: "bg-red-500/10 text-red-600 border-red-500/20",
    },
    partial: {
      icon: <Warning size={12} weight="bold" />,
      label: "AI Partial",
      className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    },
    error: {
      icon: <XCircle size={12} weight="bold" />,
      label: "AI Error",
      className: "bg-red-500/10 text-red-600 border-red-500/20",
    },
  };

  const { icon, label, className } = config[status];

  return (
    <Tooltip content={`AI Review Status: ${label}`}>
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </span>
    </Tooltip>
  );
}

// AI Review results panel with copy functionality
function AiReviewResultsPanel({
  aiReviewStatus,
  aiReviewSummary,
  aiReviewCriteria,
  aiReviewError,
  aiReviewedAt,
  packageName,
  collaborators,
  npmUrl,
  repositoryUrl,
  packageId,
}: {
  aiReviewStatus?: AiReviewStatus;
  aiReviewSummary?: string;
  aiReviewCriteria?: Array<AiReviewCriterion>;
  aiReviewError?: string;
  aiReviewedAt?: number;
  packageName?: string;
  collaborators?: Array<{ name: string; avatar: string }>;
  npmUrl?: string;
  repositoryUrl?: string;
  packageId?: Id<"packages">;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  // Same shared subscription the Messages buttons use.
  const packagesWithDrafts = useQuery(
    api.reviewMessages.listPackagesWithPendingDrafts,
    packageId ? {} : "skip",
  );
  const hasDraft =
    !!packageId && (packagesWithDrafts?.includes(packageId) ?? false);

  // Copy AI review results to clipboard in Notion-friendly format
  const handleCopyResults = () => {
    const statusText =
      aiReviewStatus === "passed"
        ? "PASSED"
        : aiReviewStatus === "partial"
          ? "PARTIAL"
          : aiReviewStatus === "failed"
            ? "FAILED"
            : aiReviewStatus?.toUpperCase() || "UNKNOWN";

    const maintainerList =
      collaborators && collaborators.length > 0
        ? collaborators.map((c) => c.name).join(", ")
        : "N/A";

    const criteriaList =
      aiReviewCriteria && aiReviewCriteria.length > 0
        ? aiReviewCriteria
            .map((c) => `${c.passed ? "[x]" : "[ ]"} ${c.name}\n    ${c.notes}`)
            .join("\n")
        : "No criteria available";

    const reviewDate = aiReviewedAt
      ? new Date(aiReviewedAt).toLocaleDateString()
      : "N/A";

    const text = `## AI Review: ${packageName || "Unknown Package"}

**Status:** ${statusText}
**Reviewed:** ${reviewDate}

### Package Info
- **npm:** ${npmUrl || "N/A"}
- **${repoHostLabel(repositoryUrl)}:** ${repositoryUrl || "N/A"}
- **Maintainers:** ${maintainerList}

### Summary
${aiReviewSummary || "No summary available"}

### Criteria Checklist
${criteriaList}
${aiReviewError ? `\n### Error\n${aiReviewError}` : ""}
`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("AI review copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!aiReviewStatus || aiReviewStatus === "not_reviewed") {
    return null;
  }

  if (aiReviewStatus === "reviewing") {
    return (
      <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
        <div className="flex items-center gap-2 text-gray-600">
          <Robot size={16} weight="bold" className="animate-pulse" />
          <span className="text-sm font-medium">AI Review in progress...</span>
        </div>
      </div>
    );
  }

  // Determine pass/fail icon based on status
  const statusIcon =
    aiReviewStatus === "passed" ? (
      <CheckCircle size={18} weight="bold" className="text-green-600" />
    ) : aiReviewStatus === "partial" ? (
      <Warning size={18} weight="bold" className="text-yellow-600" />
    ) : (
      <XCircle size={18} weight="bold" className="text-red-600" />
    );

  return (
    <div className="mt-3">
      {/* Collapsed header row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-2 p-2 rounded-lg bg-bg-hover border border-border hover:bg-bg-primary transition-colors text-left"
      >
        <div className="min-w-0 flex flex-1 items-start gap-2">
          {statusIcon}
          <div className="min-w-0 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
            <span className="truncate text-sm font-medium text-text-primary">
              AI Review Results
            </span>
            {aiReviewedAt && (
              <span className="text-xs text-text-secondary whitespace-nowrap">
                {new Date(aiReviewedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip content={copied ? "Copied!" : "Copy results for Notion"}>
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleCopyResults();
              }}
              className="p-1 text-text-secondary hover:text-text-primary transition-colors rounded hover:bg-bg-hover cursor-pointer"
            >
              <Copy size={16} weight={copied ? "fill" : "regular"} />
            </span>
          </Tooltip>
          <span className="text-text-secondary">
            {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
          </span>
        </div>
      </button>

      {/* Points admins at the prefilled message in User Messages */}
      {hasDraft && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-text-secondary">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          {aiReviewStatus === "failed"
            ? "Rejection message drafted from this review. Open Messages to edit and send."
            : "Review message draft ready. Open Messages to edit and send."}
        </p>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-2 min-w-0 overflow-hidden rounded-lg border border-border bg-bg-hover p-2.5 sm:p-3">
          {/* Summary */}
          {aiReviewSummary && (
            <div className="mb-2 break-words text-sm text-text-secondary whitespace-pre-wrap">
              {aiReviewSummary}
            </div>
          )}

          {/* Error */}
          {aiReviewError && (
            <div className="mb-2 break-words rounded bg-red-50 border border-red-200 p-2 text-sm text-red-600">
              <strong>Error:</strong> {aiReviewError}
            </div>
          )}

          {/* Criteria checklist */}
          {aiReviewCriteria && aiReviewCriteria.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-medium text-text-secondary mb-2">
                Criteria Checklist
              </div>
              {aiReviewCriteria.map((criterion, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 rounded bg-bg-primary"
                >
                  {criterion.passed ? (
                    <CheckCircle
                      size={14}
                      weight="bold"
                      className="text-green-600 shrink-0 mt-0.5"
                    />
                  ) : (
                    <XCircle
                      size={14}
                      weight="bold"
                      className="text-red-600 shrink-0 mt-0.5"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-primary">
                      {criterion.name}
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5">
                      {criterion.notes}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type ReviewHistoryTab = "ai" | "security";

function AiReviewHistoryPanel({
  packageId,
  packageName,
  isOpen,
  onClose,
  reviewedBy,
}: {
  packageId: Id<"packages">;
  packageName: string;
  isOpen: boolean;
  onClose: () => void;
  reviewedBy?: string;
}) {
  const reviewRuns = useQuery(api.packages.getAiReviewRunsForPackage, {
    packageId,
  });
  const securityRuns = useQuery(api.packages.getSecurityScanRunsForPackage, {
    packageId,
  });
  const deleteAiReviewRun = useMutation(api.packages.deleteAiReviewRun);
  const [selectedRunId, setSelectedRunId] = useState<Id<"aiReviewRuns"> | null>(
    null,
  );
  const [runToDelete, setRunToDelete] = useState<Id<"aiReviewRuns"> | null>(
    null,
  );
  const [isDeletingRun, setIsDeletingRun] = useState(false);
  const [activeTab, setActiveTab] = useState<ReviewHistoryTab>("ai");

  useEffect(() => {
    if (!isOpen || !reviewRuns) return;

    const hasSelectedRun = selectedRunId
      ? reviewRuns.some((run) => run._id === selectedRunId)
      : false;

    if (!hasSelectedRun) {
      setSelectedRunId(reviewRuns[0]?._id ?? null);
    }
  }, [isOpen, reviewRuns, selectedRunId]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && runToDelete === null) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, runToDelete]);

  if (!isOpen) {
    return null;
  }

  const runs: Array<AiReviewRun> = reviewRuns ?? [];
  const latestRunId = runs[0]?._id ?? null;
  const selectedRun =
    runs.find((run) => run._id === selectedRunId) ?? runs[0] ?? null;

  const getStatusClassName = (status: AiReviewRun["status"]) => {
    switch (status) {
      case "passed":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "partial":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
      case "failed":
      case "error":
        return "bg-red-500/10 text-red-600 border-red-500/20";
    }
  };

  const formatStatusLabel = (status: AiReviewRun["status"]) => {
    switch (status) {
      case "passed":
        return "Passed";
      case "partial":
        return "Partial";
      case "failed":
        return "Failed";
      case "error":
        return "Error";
    }
  };

  const scoreLabel = (criteria: Array<AiReviewCriterion>) => {
    if (criteria.length === 0) return "No criteria";
    const passedCount = criteria.filter((criterion) => criterion.passed).length;
    return `${passedCount}/${criteria.length} passed`;
  };

  const handleDeleteRun = async () => {
    if (!runToDelete || isDeletingRun) return;

    setIsDeletingRun(true);
    try {
      await deleteAiReviewRun({ runId: runToDelete });
      if (selectedRunId === runToDelete) {
        setSelectedRunId(null);
      }
      toast.success("AI review history entry deleted");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete AI review history entry",
      );
    } finally {
      setIsDeletingRun(false);
      setRunToDelete(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 w-full max-w-5xl bg-white border-l border-border shadow-xl">
        <div className="flex h-full flex-col">
          <div className="border-b border-border px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-normal text-text-primary">
                  Review History
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {packageName}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            {/* Tab switcher */}
            <div className="flex gap-1 mt-3">
              <button
                onClick={() => setActiveTab("ai")}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                  activeTab === "ai"
                    ? "bg-text-primary text-white border-text-primary"
                    : "border-border text-text-secondary hover:bg-bg-hover"
                }`}
              >
                AI Reviews
                <span className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[10px]">
                  {reviewRuns?.length ?? 0}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("security")}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                  activeTab === "security"
                    ? "bg-text-primary text-white border-text-primary"
                    : "border-border text-text-secondary hover:bg-bg-hover"
                }`}
              >
                Security Scans
                <span className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[10px]">
                  {securityRuns?.length ?? 0}
                </span>
              </button>
            </div>
          </div>

          {/* Security Scans Tab */}
          {activeTab === "security" && (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {securityRuns === undefined ? (
                <div className="text-sm text-text-secondary py-8">
                  Loading security scan history...
                </div>
              ) : securityRuns.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-bg-primary px-4 py-6 text-center">
                  <ShieldCheck
                    size={24}
                    weight="bold"
                    className="mx-auto text-text-secondary mb-2"
                  />
                  <p className="text-sm text-text-primary">
                    No security scans yet
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Run a security scan from the Review row to get started.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {securityRuns.map((run) => {
                    const statusColors: Record<string, string> = {
                      safe: "bg-green-500/10 text-green-600 border-green-500/20",
                      unsafe: "bg-red-500/10 text-red-600 border-red-500/20",
                      warning:
                        "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
                      error: "bg-red-500/10 text-red-600 border-red-500/20",
                    };
                    return (
                      <div
                        key={run._id}
                        className="rounded-lg border border-border bg-white p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusColors[run.status] || statusColors.error}`}
                            >
                              {run.status === "safe" && (
                                <ShieldCheck
                                  size={12}
                                  weight="bold"
                                  className="mr-1"
                                />
                              )}
                              {run.status === "unsafe" && (
                                <ShieldWarning
                                  size={12}
                                  weight="bold"
                                  className="mr-1"
                                />
                              )}
                              {run.status === "warning" && (
                                <ShieldWarning
                                  size={12}
                                  weight="bold"
                                  className="mr-1"
                                />
                              )}
                              {run.status.charAt(0).toUpperCase() +
                                run.status.slice(1)}
                            </span>
                            <span className="text-xs text-text-secondary">
                              {run.findings.length} finding
                              {run.findings.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <time className="text-xs text-text-secondary">
                            {new Date(run.createdAt).toLocaleString()}
                          </time>
                        </div>

                        <p className="text-sm text-text-primary">
                          {run.summary}
                        </p>

                        {/* Provider breakdown */}
                        <div className="flex gap-2 flex-wrap">
                          {run.providerResults.socket && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full border border-border text-text-secondary">
                              Socket: {run.providerResults.socket.status}
                              {run.providerResults.socket.rawSummary &&
                                ` (${run.providerResults.socket.rawSummary})`}
                            </span>
                          )}
                          {run.providerResults.snyk && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full border border-border text-text-secondary">
                              Snyk: {run.providerResults.snyk.status}
                              {run.providerResults.snyk.rawSummary &&
                                ` (${run.providerResults.snyk.rawSummary})`}
                            </span>
                          )}
                        </div>

                        {/* Findings list */}
                        {run.findings.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                              Findings
                            </p>
                            {run.findings.map((finding, idx) => {
                              const severityColors: Record<string, string> = {
                                critical: "text-red-700 bg-red-50",
                                high: "text-red-600 bg-red-50",
                                medium: "text-yellow-700 bg-yellow-50",
                                low: "text-blue-600 bg-blue-50",
                                info: "text-gray-600 bg-gray-50",
                              };
                              return (
                                <div
                                  key={idx}
                                  className="flex items-start gap-2 text-xs"
                                >
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${severityColors[finding.severity] || severityColors.info}`}
                                  >
                                    {finding.severity}
                                  </span>
                                  <div>
                                    <span className="font-medium text-text-primary">
                                      {finding.title}
                                    </span>
                                    <span className="text-text-secondary ml-1">
                                      ({finding.provider})
                                    </span>
                                    <p className="text-text-secondary mt-0.5">
                                      {finding.description}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Recommendations */}
                        {run.recommendations.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                              Recommendations
                            </p>
                            <ul className="list-disc list-inside space-y-0.5">
                              {run.recommendations.map((rec, idx) => (
                                <li
                                  key={idx}
                                  className="text-xs text-text-secondary"
                                >
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {run.error && (
                          <p className="text-xs text-red-600">{run.error}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* AI Reviews Tab */}
          {activeTab === "ai" && (
            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="border-b border-border lg:border-b-0 lg:border-r">
                <div className="max-h-[36vh] overflow-y-auto lg:max-h-full">
                  {reviewRuns === undefined ? (
                    <div className="px-6 py-8 text-sm text-text-secondary">
                      Loading review history...
                    </div>
                  ) : runs.length === 0 ? (
                    <div className="px-6 py-8">
                      <div className="rounded-lg border border-dashed border-border bg-bg-primary px-4 py-6 text-center">
                        <p className="text-sm text-text-primary">
                          No review history yet
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          Run AI Review to start collecting past review output.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {runs.map((run, index) => (
                        <div
                          key={run._id}
                          className={`px-4 py-4 transition-colors ${
                            selectedRun?._id === run._id
                              ? "bg-[#FDFBF7]"
                              : "hover:bg-bg-hover"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button
                              onClick={() => setSelectedRunId(run._id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStatusClassName(run.status)}`}
                                >
                                  {formatStatusLabel(run.status)}
                                </span>
                                {index === 0 && (
                                  <span className="text-[11px] text-text-secondary">
                                    Latest
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 text-xs font-medium text-text-primary">
                                {scoreLabel(run.criteria)}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                                {run.summary}
                              </p>
                            </button>
                            <div className="flex shrink-0 items-start gap-1">
                              {run._id !== latestRunId && (
                                <Tooltip content="Delete this saved review run">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRunToDelete(run._id);
                                    }}
                                    className="rounded p-1 text-text-secondary hover:bg-red-50 hover:text-red-600 transition-colors"
                                  >
                                    <TrashSimple size={14} />
                                  </button>
                                </Tooltip>
                              )}
                              <button
                                onClick={() => setSelectedRunId(run._id)}
                                className="rounded p-0.5 text-text-secondary"
                              >
                                <CaretRight
                                  size={14}
                                  className={`shrink-0 transition-transform ${
                                    selectedRun?._id === run._id
                                      ? "rotate-90"
                                      : ""
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 text-[11px] text-text-secondary">
                            {new Date(run.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto">
                {!selectedRun ? (
                  <div className="px-6 py-10 text-sm text-text-secondary">
                    Select a review run to inspect the full output.
                  </div>
                ) : (
                  <div className="px-6 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusClassName(selectedRun.status)}`}
                        >
                          {formatStatusLabel(selectedRun.status)}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {new Date(selectedRun.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {selectedRun._id !== latestRunId && (
                        <button
                          onClick={() => setRunToDelete(selectedRun._id)}
                          className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <TrashSimple size={14} />
                          Delete run
                        </button>
                      )}
                    </div>

                    {reviewedBy && (
                      <p className="mt-3 text-xs text-text-secondary">
                        Reviewed by {reviewedBy}
                      </p>
                    )}

                    <div className="mt-4 grid gap-2 text-xs text-text-secondary sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border border-border bg-bg-primary px-3 py-2">
                        <div className="text-[11px] uppercase tracking-wide">
                          Score
                        </div>
                        <div className="mt-1 text-sm text-text-primary">
                          {scoreLabel(selectedRun.criteria)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border bg-bg-primary px-3 py-2">
                        <div className="text-[11px] uppercase tracking-wide">
                          Provider
                        </div>
                        <div className="mt-1 text-sm text-text-primary">
                          {selectedRun.provider || "Unknown"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border bg-bg-primary px-3 py-2">
                        <div className="text-[11px] uppercase tracking-wide">
                          Model
                        </div>
                        <div className="mt-1 text-sm text-text-primary break-all">
                          {selectedRun.model || "Unknown"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border bg-bg-primary px-3 py-2">
                        <div className="text-[11px] uppercase tracking-wide">
                          Source
                        </div>
                        <div className="mt-1 text-sm text-text-primary">
                          {selectedRun.source || "Unknown"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-lg border border-border bg-bg-primary p-4">
                      <div className="text-xs font-medium text-text-secondary">
                        Summary
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-sm text-text-primary">
                        {selectedRun.summary}
                      </div>
                    </div>

                    {selectedRun.error && (
                      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                        <div className="text-xs font-medium text-red-700">
                          Error
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-sm text-red-700">
                          {selectedRun.error}
                        </div>
                      </div>
                    )}

                    <div className="mt-5">
                      <div className="text-xs font-medium text-text-secondary">
                        Criteria checklist
                      </div>
                      <div className="mt-3 space-y-2">
                        {selectedRun.criteria.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border bg-bg-primary px-4 py-6 text-center text-sm text-text-secondary">
                            No criteria were recorded for this run.
                          </div>
                        ) : (
                          selectedRun.criteria.map((criterion) => (
                            <div
                              key={`${selectedRun._id}-${criterion.name}`}
                              className="flex items-start gap-3 rounded-lg border border-border bg-bg-primary p-3"
                            >
                              {criterion.passed ? (
                                <CheckCircle
                                  size={16}
                                  weight="bold"
                                  className="mt-0.5 shrink-0 text-green-600"
                                />
                              ) : (
                                <XCircle
                                  size={16}
                                  weight="bold"
                                  className="mt-0.5 shrink-0 text-red-600"
                                />
                              )}
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-text-primary">
                                  {criterion.name}
                                </div>
                                <div className="mt-1 text-xs text-text-secondary">
                                  {criterion.notes}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {selectedRun.rawOutput && (
                      <div className="mt-5 rounded-lg border border-border bg-bg-primary p-4">
                        <div className="text-xs font-medium text-text-secondary">
                          Raw model output
                        </div>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-text-primary">
                          {selectedRun.rawOutput}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={runToDelete !== null}
        onClose={() => {
          if (!isDeletingRun) {
            setRunToDelete(null);
          }
        }}
        onConfirm={handleDeleteRun}
        title="Delete AI review history?"
        message="This removes the selected saved review run from history. The current latest review snapshot on the package will stay unchanged."
        confirmText={isDeletingRun ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}

// Status Legend component for admin dashboard
function StatusLegend() {
  const legendItems: {
    label: string;
    color: string;
  }[] = [
    { label: "Approved", color: "bg-green-500" },
    { label: "In Review", color: "bg-blue-500" },
    { label: "Changes", color: "bg-orange-500" },
    { label: "Pending", color: "bg-yellow-500" },
    { label: "Rejected", color: "bg-red-500" },
    { label: "Featured", color: "bg-amber-500" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 py-3 px-4 rounded-lg border border-border bg-bg-card mt-4">
      <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
        Status
      </span>
      {legendItems.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
          <span className="text-xs text-text-secondary">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const { isAuthenticated, isLoading: authLoading, signIn } = useAuth();
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const isAdmin = useQuery(api.auth.isAdmin);
  const [searchTerm, setSearchTerm] = useState("");

  // Loading state
  const isLoading =
    authLoading ||
    (isAuthenticated && (loggedInUser === undefined || isAdmin === undefined));

  // Use search query when there's a search term, otherwise use all packages
  const searchResults = useQuery(api.packages.adminSearchPackages, {
    searchTerm: searchTerm.trim(),
  });
  const allPackages = useQuery(api.packages.getAllPackages);

  // Use search results when searching, otherwise use all packages
  const packages = searchTerm.trim() ? searchResults : allPackages;

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      {/* Global header with auth */}
      <Header />

      {/* Admin-specific search bar */}
      {loggedInUser && isAdmin && (
        <div className="sticky top-14 z-10 backdrop-blur-sm px-4 sm:px-6 py-2 bg-bg-primary border-b border-border">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <span className="text-text-primary font-medium text-sm">
              Admin Dashboard
            </span>
            <div className="hidden sm:block flex-1 max-w-md mx-4">
              <div className="relative">
                <MagnifyingGlass
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
                />
                <input
                  type="text"
                  placeholder="Search packages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 rounded-full border border-border bg-bg-card text-text-primary text-sm outline-none focus:border-button transition-colors"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 px-4 sm:px-6 py-4 sm:py-6">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-button"></div>
          </div>
        ) : !isAuthenticated ? (
          // Not logged in - show sign in button
          <div className="max-w-md mx-auto">
            <div className="rounded-lg border border-border p-6 bg-bg-card">
              <h2 className="text-xl font-light mb-4 text-text-primary">
                Admin Sign In
              </h2>
              <p className="text-sm text-text-secondary mb-4">
                Admin access only.
              </p>
              <button
                onClick={() => {
                  // Save current path to return after sign-in
                  localStorage.setItem(
                    "authReturnPath",
                    window.location.pathname,
                  );
                  signIn();
                }}
                className="w-full px-6 py-3 rounded-full font-normal bg-button text-white hover:bg-button-hover transition-colors text-sm"
              >
                Sign In
              </button>
            </div>
          </div>
        ) : !isAdmin ? (
          // Logged in but not admin - redirect to profile
          <RedirectToProfile />
        ) : (
          // Admin dashboard
          <AdminDashboard
            userEmail={loggedInUser?.email}
            packages={packages}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
          />
        )}
      </main>
      <Toaster />
    </div>
  );
}

// Status badge component with GitHub-like styling
function StatusBadge({ status }: { status: ReviewStatus | undefined }) {
  const displayStatus = status || "pending";

  const config: Record<
    ReviewStatus,
    { icon: React.ReactNode; label: string; className: string }
  > = {
    pending: {
      icon: <Hourglass size={14} weight="bold" />,
      label: "Pending",
      className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    },
    in_review: {
      icon: <GitPullRequest size={14} weight="bold" />,
      label: "In Review",
      className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    },
    approved: {
      icon: <CheckCircle size={14} weight="bold" />,
      label: "Approved",
      className: "bg-green-500/10 text-green-600 border-green-500/20",
    },
    changes_requested: {
      icon: <Warning size={14} weight="bold" />,
      label: "Changes",
      className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    },
    rejected: {
      icon: <Prohibit size={14} weight="bold" />,
      label: "Rejected",
      className: "bg-red-500/10 text-red-600 border-red-500/20",
    },
  };

  const { icon, label, className } = config[displayStatus];

  return (
    <Tooltip content={`Review Status: ${label}`}>
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium leading-none border ${className}`}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </span>
    </Tooltip>
  );
}

// Visibility badge component
function VisibilityBadge({
  visibility,
  markedForDeletion,
}: {
  visibility: Visibility | undefined;
  markedForDeletion?: boolean;
}) {
  const displayVisibility = visibility || "visible";

  const config: Record<
    Visibility,
    { icon: React.ReactNode; label: string; className: string }
  > = {
    visible: {
      icon: <Eye size={14} weight="bold" />,
      label: "Visible",
      className: "bg-green-500/10 text-green-600 border-green-500/20",
    },
    hidden: {
      icon: <EyeSlash size={14} weight="bold" />,
      label: "Hidden",
      className: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    },
    archived: {
      icon: <Archive size={14} weight="bold" />,
      label: "Archived",
      className: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    },
  };

  const { icon, label, className } = config[displayVisibility];

  return (
    <div className="inline-flex items-center gap-1 shrink-0 align-middle">
      <Tooltip content={`Visibility: ${label}`}>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium leading-none border ${className}`}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </span>
      </Tooltip>
      {markedForDeletion && (
        <Tooltip content="Marked for deletion by user">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-red-500/10 text-red-600 border-red-500/20">
            <Clock size={14} weight="bold" />
            <span className="hidden sm:inline">Deletion</span>
          </span>
        </Tooltip>
      )}
    </div>
  );
}

// Pending npm package rename panel with accept and revert admin actions.
// Shown when the submitter pointed the npm URL at a different package name.
function NpmMismatchPanel({
  packageId,
  currentName,
  pendingNpmName,
}: {
  packageId: Id<"packages">;
  currentName: string;
  pendingNpmName: string;
}) {
  const resolveNpmNameChange = useMutation(api.packages.resolveNpmNameChange);
  const [confirmAction, setConfirmAction] = useState<
    "accept" | "revert" | null
  >(null);
  const [isResolving, setIsResolving] = useState(false);

  const handleResolve = async (resolution: "accept" | "revert") => {
    if (isResolving) return;
    setIsResolving(true);
    try {
      await resolveNpmNameChange({ packageId, resolution });
      toast.success(
        resolution === "accept"
          ? `Rename accepted. Registry data for ${pendingNpmName} is being fetched.`
          : "npm URL reverted to the tracked package.",
      );
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? String(error.data)
          : "Failed to resolve npm change",
      );
      console.error(error);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start gap-2">
        <Warning
          size={16}
          weight="bold"
          className="shrink-0 text-amber-600 mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-800">
            npm package change pending review
          </p>
          <p className="mt-1 text-xs text-amber-700">
            The submitter pointed the npm URL at{" "}
            <span className="font-medium">{pendingNpmName}</span>, but this
            listing still tracks{" "}
            <span className="font-medium">{currentName}</span>. Accept to
            re-derive the name, install command, and registry stats from the new
            package (slug and public URL stay the same), or revert the npm URL.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => setConfirmAction("accept")}
              disabled={isResolving}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-button text-white hover:bg-button-hover transition-colors disabled:opacity-50"
            >
              {isResolving ? "Working..." : "Accept rename"}
            </button>
            <button
              onClick={() => setConfirmAction("revert")}
              disabled={isResolving}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-white text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
            >
              Revert URL
            </button>
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={confirmAction === "accept"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void handleResolve("accept")}
        title="Accept npm rename"
        message={`Re-derive this listing from ${pendingNpmName}? The package name, install command, version, and download stats update from the new package. The slug and public URL stay the same.`}
        confirmText="Accept rename"
        cancelText="Cancel"
      />
      <ConfirmModal
        isOpen={confirmAction === "revert"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void handleResolve("revert")}
        title="Revert npm URL"
        message={`Restore the npm URL to https://www.npmjs.com/package/${currentName} and clear the pending change?`}
        confirmText="Revert URL"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}

// Payment/Reward badge component
type RewardStatus = "not_sent" | "sent" | "delivered" | "failed";
function PaymentBadge({
  rewardStatus,
  rewardTotalAmount,
}: {
  rewardStatus?: RewardStatus;
  rewardTotalAmount?: number;
}) {
  if (!rewardStatus || rewardStatus === "not_sent") return null;

  const config: Record<
    Exclude<RewardStatus, "not_sent">,
    { icon: React.ReactNode; label: string; className: string; tooltip: string }
  > = {
    sent: {
      icon: <CurrencyCircleDollar size={14} weight="fill" />,
      label: rewardTotalAmount ? `$${rewardTotalAmount}` : "Paid",
      className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      tooltip: rewardTotalAmount
        ? `Reward sent: $${rewardTotalAmount}`
        : "Reward sent",
    },
    delivered: {
      icon: <CurrencyCircleDollar size={14} weight="fill" />,
      label: rewardTotalAmount ? `$${rewardTotalAmount}` : "Delivered",
      className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      tooltip: rewardTotalAmount
        ? `Reward delivered: $${rewardTotalAmount}`
        : "Reward delivered",
    },
    failed: {
      icon: <CurrencyCircleDollar size={14} weight="bold" />,
      label: "Failed",
      className: "bg-red-500/10 text-red-600 border-red-500/20",
      tooltip: "Reward failed to send",
    },
  };

  const { icon, label, className, tooltip } = config[rewardStatus];

  return (
    <Tooltip content={tooltip}>
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium leading-none border ${className}`}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </span>
    </Tooltip>
  );
}

// Inline action buttons component (replaces dropdown)
function InlineActions({
  packageId,
  currentStatus,
  currentVisibility,
  currentFeatured,
  currentFeaturedSortOrder,
  currentHideFromSubmissions,
  userEmail,
  packageName,
  repositoryUrl,
  isArchivedView,
  convexVerified,
  communitySubmitted,
  hideSeoAndSkillContentOnDetailPage,
  seoGenerationStatus,
  npmDescription,
  hideThumbnailInCategory,
  thumbnailUrl,
  lastRefreshedAt,
  refreshError,
  slug,
  submitterEmail,
  rewardStatus,
  defaultRewardAmount,
  reviewedBy,
  hasSkillMd,
}: {
  packageId: Id<"packages">;
  currentStatus: ReviewStatus | undefined;
  currentVisibility: Visibility | undefined;
  currentFeatured: boolean | undefined;
  currentFeaturedSortOrder: number | undefined;
  currentHideFromSubmissions: boolean | undefined;
  userEmail: string;
  packageName: string;
  repositoryUrl?: string;
  isArchivedView?: boolean;
  convexVerified?: boolean;
  communitySubmitted?: boolean;
  hideSeoAndSkillContentOnDetailPage?: boolean;
  seoGenerationStatus?: string;
  npmDescription?: string;
  hideThumbnailInCategory?: boolean;
  thumbnailUrl?: string;
  lastRefreshedAt?: number;
  refreshError?: string;
  slug?: string;
  submitterEmail?: string;
  rewardStatus?: "not_sent" | "sent" | "delivered" | "failed";
  defaultRewardAmount?: number;
  reviewedBy?: string;
  hasSkillMd?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRewardConfirm, setShowRewardConfirm] = useState(false);
  const [showRewardHistory, setShowRewardHistory] = useState(false);
  const [showAiReviewHistory, setShowAiReviewHistory] = useState(false);
  const [rewardAmount, setRewardAmount] = useState<string>(
    (defaultRewardAmount ?? 25).toString(),
  );
  const [rewardNote, setRewardNote] = useState("");
  const [isSendingReward, setIsSendingReward] = useState(false);
  const [sortOrderInput, setSortOrderInput] = useState<string>(
    currentFeaturedSortOrder?.toString() ?? "",
  );
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [isRegeneratingSeo, setIsRegeneratingSeo] = useState(false);
  const [isRefreshingReadme, setIsRefreshingReadme] = useState(false);
  const [isRebuildingSkill, setIsRebuildingSkill] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingSlug, setIsGeneratingSlug] = useState(false);

  const updateReviewStatus = useMutation(api.packages.updateReviewStatus);
  const updateVisibility = useMutation(api.packages.updateVisibility);
  const deletePackage = useMutation(api.packages.deletePackage);
  const toggleFeatured = useMutation(api.packages.toggleFeatured);
  const setFeaturedSortOrder = useMutation(api.packages.setFeaturedSortOrder);
  const toggleHideFromSubmissions = useMutation(
    api.packages.toggleHideFromSubmissions,
  );
  const updateComponentDetails = useMutation(
    api.packages.updateComponentDetails,
  );
  const sendReward = useAction(api.payments.sendRewardManual);
  const rewardPayments = useQuery(api.paymentsDb.getPaymentsForPackage, {
    packageId,
  });
  const aiReviewRuns = useQuery(api.packages.getAiReviewRunsForPackage, {
    packageId,
  });
  const securityScanRuns = useQuery(
    api.packages.getSecurityScanRunsForPackage,
    {
      packageId,
    },
  );
  const runSecurityScan = useAction(api.securityScan.runSecurityScan);
  const [isScanning, setIsScanning] = useState(false);
  const autoFillAuthor = useMutation(api.packages.autoFillAuthorFromRepo);
  const regenerateSeo = useAction(api.seoContent.regenerateDirectoryContent);
  const refreshReadme = useAction(api.seoContent.refreshReadmeContent);
  const rebuildSkill = useMutation(api.seoContentDb.rebuildSkillMd);
  const refreshNpmData = useAction(api.packages.refreshNpmData);
  const generateSlug = useMutation(api.packages.generateSlugForPackage);

  const status = currentStatus || "pending";
  const visibility = currentVisibility || "visible";
  const featured = currentFeatured || false;
  const hideFromSubmissions = currentHideFromSubmissions || false;
  const rewardHistoryCount = rewardPayments?.length ?? 0;
  const aiReviewHistoryCount = aiReviewRuns?.length ?? 0;
  const securityScanHistoryCount = securityScanRuns?.length ?? 0;
  const combinedReviewHistoryCount =
    aiReviewHistoryCount + securityScanHistoryCount;
  const rewardTotalSent =
    rewardPayments?.reduce((total, payment) => {
      if (payment.status === "sent" || payment.status === "delivered") {
        return total + payment.amount;
      }
      return total;
    }, 0) ?? 0;

  // Sync input when prop changes
  useEffect(() => {
    setSortOrderInput(currentFeaturedSortOrder?.toString() ?? "");
  }, [currentFeaturedSortOrder]);

  // ESC closes the reward confirm and reward history modals.
  // Reward history always closes on ESC. Reward confirm is blocked while a
  // send is in flight to avoid surprise dismissal during a network request.
  useEffect(() => {
    if (!showRewardConfirm && !showRewardHistory) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showRewardHistory) setShowRewardHistory(false);
      if (showRewardConfirm && !isSendingReward) {
        setShowRewardConfirm(false);
        setRewardNote("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showRewardConfirm, showRewardHistory, isSendingReward]);

  const handleUnarchive = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await updateVisibility({ packageId, visibility: "visible" });
      toast.success("Package unarchived");
    } catch (error) {
      toast.error("Failed to unarchive package");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: ReviewStatus) => {
    if (isLoading || status === newStatus) return;
    setIsLoading(true);
    try {
      await updateReviewStatus({
        packageId,
        reviewStatus: newStatus,
        reviewedBy: userEmail,
      });
      toast.success(`Status updated to ${newStatus.replace("_", " ")}`);
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVisibilityChange = async (newVisibility: Visibility) => {
    if (isLoading || visibility === newVisibility) return;
    setIsLoading(true);
    try {
      await updateVisibility({ packageId, visibility: newVisibility });
      toast.success(
        `Package ${newVisibility === "visible" ? "shown" : newVisibility}`,
      );
    } catch (error) {
      toast.error("Failed to update visibility");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await deletePackage({ packageId });
      toast.success("Package deleted permanently");
    } catch (error) {
      toast.error("Failed to delete package");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFeatured = async () => {
    if (isLoading) return;
    // Only approved packages can be featured
    if (status !== "approved") {
      toast.error("Only approved packages can be featured");
      return;
    }
    setIsLoading(true);
    try {
      await toggleFeatured({ packageId });
      toast.success(featured ? "Package unfeatured" : "Package featured");
    } catch (error) {
      toast.error("Failed to toggle featured status");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSortOrder = async () => {
    if (isLoading) return;
    const value = sortOrderInput.trim();
    const sortOrder = value === "" ? null : parseInt(value, 10);
    if (value !== "" && isNaN(sortOrder as number)) {
      toast.error("Sort order must be a number");
      return;
    }
    setIsLoading(true);
    try {
      await setFeaturedSortOrder({ packageId, sortOrder });
      toast.success(
        sortOrder === null
          ? "Sort order cleared"
          : `Sort order set to ${sortOrder}`,
      );
    } catch (error) {
      toast.error("Failed to update sort order");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleHideFromSubmissions = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await toggleHideFromSubmissions({ packageId });
      toast.success(
        hideFromSubmissions
          ? "Visible on Submissions page"
          : "Hidden from Submissions page",
      );
    } catch (error) {
      toast.error("Failed to toggle hide from submissions");
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle Convex Verified status
  const handleToggleVerified = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await updateComponentDetails({
        packageId,
        convexVerified: !convexVerified,
      });
      toast.success(
        convexVerified
          ? "Convex Verified removed"
          : "Marked as Convex Verified",
      );
    } catch (error) {
      toast.error("Failed to update verified status");
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle Community Submitted status
  const handleToggleCommunity = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await updateComponentDetails({
        packageId,
        communitySubmitted: !communitySubmitted,
      });
      toast.success(
        communitySubmitted ? "Community badge removed" : "Marked as Community",
      );
    } catch (error) {
      toast.error("Failed to update community status");
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle hide thumbnail in category listings
  const handleToggleHideThumbnail = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await updateComponentDetails({
        packageId,
        hideThumbnailInCategory: !hideThumbnailInCategory,
      });
      toast.success(
        hideThumbnailInCategory
          ? "Thumbnail shown in category listings"
          : "Thumbnail hidden in category listings (shows in Featured only)",
      );
    } catch (error) {
      toast.error("Failed to update thumbnail visibility");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleHideSeoAndSkillContent = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await updateComponentDetails({
        packageId,
        hideSeoAndSkillContentOnDetailPage: !hideSeoAndSkillContentOnDetailPage,
      });
      toast.success(
        hideSeoAndSkillContentOnDetailPage
          ? "SEO + Skill content shown on detail page"
          : "SEO + Skill content hidden from detail page",
      );
    } catch (error) {
      toast.error("Failed to update SEO visibility");
    } finally {
      setIsLoading(false);
    }
  };

  // Regenerate Component Directory Content + SKILL.md
  const handleRegenerateSeo = async () => {
    if (isRegeneratingSeo || seoGenerationStatus === "generating") return;
    setIsRegeneratingSeo(true);
    try {
      await regenerateSeo({ packageId });
      toast.success("Component directory content generation started");
    } catch (error) {
      toast.error("Failed to start content generation");
    } finally {
      setIsRegeneratingSeo(false);
    }
  };

  // Refresh only the README content from the repository (GitHub or GitLab)
  const handleRefreshReadme = async () => {
    if (isRefreshingReadme) return;
    setIsRefreshingReadme(true);
    try {
      await refreshReadme({ packageId });
      toast.success("README refresh started");
    } catch (error) {
      toast.error("Failed to refresh README");
    } finally {
      setIsRefreshingReadme(false);
    }
  };

  // Rebuild SKILL.md from current directory content (deterministic, no AI call)
  const handleRebuildSkill = async () => {
    if (isRebuildingSkill) return;
    setIsRebuildingSkill(true);
    try {
      await rebuildSkill({ packageId });
      toast.success(hasSkillMd ? "Skill updated" : "Skill generated");
    } catch (error) {
      const message =
        error instanceof ConvexError && typeof error.data === "string"
          ? error.data
          : "Failed to rebuild skill";
      toast.error(message);
    } finally {
      setIsRebuildingSkill(false);
    }
  };

  // Refresh NPM data
  const handleRefreshNpm = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshNpmData({ packageId });
      toast.success("NPM data refreshed!");
    } catch (error) {
      toast.error("Failed to refresh NPM data");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Generate slug for package
  const handleGenerateSlug = async () => {
    if (isGeneratingSlug) return;
    setIsGeneratingSlug(true);
    try {
      const newSlug = await generateSlug({ packageId });
      if (newSlug) {
        toast.success(`Slug generated: ${newSlug}`);
      } else {
        toast.error("Could not generate slug");
      }
    } catch {
      toast.error("Failed to generate slug");
    } finally {
      setIsGeneratingSlug(false);
    }
  };

  // Format relative time for refresh timestamp
  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Combined Auto-fill: Author from GitHub + Description from npm
  const handleAutoFill = async () => {
    if (isAutoFilling) return;
    setIsAutoFilling(true);
    const results: string[] = [];

    try {
      // Run both operations in parallel if available
      const promises: Promise<void>[] = [];

      if (repositoryUrl) {
        promises.push(
          autoFillAuthor({ packageId })
            .then((result) => {
              if (result) {
                results.push("author info");
              }
            })
            .catch(() => {
              // Silently skip author fill if it fails
            }),
        );
      }

      if (npmDescription) {
        promises.push(
          updateComponentDetails({
            packageId,
            longDescription: npmDescription,
          })
            .then(() => {
              results.push("description");
            })
            .catch(() => {
              // Silently skip description fill if it fails
            }),
        );
      }

      await Promise.all(promises);

      if (results.length > 0) {
        toast.success(`Auto-filled: ${results.join(" and ")}`);
      } else {
        toast.error("Nothing to auto-fill");
      }
    } catch (error) {
      toast.error("Auto-fill failed");
    } finally {
      setIsAutoFilling(false);
    }
  };

  const rewardAllowedStatuses: ReviewStatus[] = ["in_review", "approved"];
  const canSendReward = rewardAllowedStatuses.includes(status as ReviewStatus);

  // Send reward handler
  const handleSendReward = async () => {
    if (isSendingReward || !submitterEmail) return;

    if (!canSendReward) {
      toast.error(
        `Rewards can only be sent for packages in review or approved status. Current: ${status}`,
      );
      return;
    }

    const amount = parseFloat(rewardAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsSendingReward(true);
    try {
      const result = await sendReward({
        packageId,
        amount,
        sentBy: userEmail,
        note: rewardNote || undefined,
      });

      if (result.success) {
        toast.success(`Reward of $${amount} sent to ${submitterEmail}`);
        setShowRewardConfirm(false);
        setRewardNote("");
      } else {
        toast.error(result.error || "Failed to send reward");
      }
    } catch (error) {
      toast.error("Failed to send reward");
    } finally {
      setIsSendingReward(false);
    }
  };

  // Review status button configs
  const statusButtons: {
    value: ReviewStatus;
    icon: React.ReactNode;
    label: string;
    activeClass: string;
    tooltip: string;
  }[] = [
    {
      value: "approved",
      icon: <CheckCircle size={14} weight="bold" />,
      label: "Approve",
      activeClass: "bg-green-600 text-white border-green-600",
      tooltip: "Mark as approved",
    },
    {
      value: "in_review",
      icon: <GitPullRequest size={14} weight="bold" />,
      label: "Review",
      activeClass: "bg-blue-600 text-white border-blue-600",
      tooltip: "Mark as in review",
    },
    {
      value: "changes_requested",
      icon: <Warning size={14} weight="bold" />,
      label: "Changes",
      activeClass: "bg-orange-600 text-white border-orange-600",
      tooltip: "Request changes",
    },
    {
      value: "pending",
      icon: <Hourglass size={14} weight="bold" />,
      label: "Pending",
      activeClass: "bg-yellow-600 text-white border-yellow-600",
      tooltip: "Reset to pending",
    },
    {
      value: "rejected",
      icon: <Prohibit size={14} weight="bold" />,
      label: "Reject",
      activeClass: "bg-red-600 text-white border-red-600",
      tooltip: "Reject this package",
    },
  ];

  // Visibility button configs
  const visibilityButtons: {
    value: Visibility;
    icon: React.ReactNode;
    label: string;
    activeClass: string;
    tooltip: string;
  }[] = [
    {
      value: "visible",
      icon: <Eye size={14} weight="bold" />,
      label: "Show",
      activeClass: "bg-green-600 text-white border-green-600",
      tooltip: "Make package visible",
    },
    {
      value: "hidden",
      icon: <EyeSlash size={14} weight="bold" />,
      label: "Hide",
      activeClass: "bg-gray-600 text-white border-gray-600",
      tooltip: "Hide from public view",
    },
    {
      value: "archived",
      icon: <Archive size={14} weight="bold" />,
      label: "Archive",
      activeClass: "bg-purple-600 text-white border-purple-600",
      tooltip: "Archive this package",
    },
  ];

  // Check if auto-fill is available
  const canAutoFill = !!repositoryUrl || !!npmDescription;
  const isSeoGenerating =
    seoGenerationStatus === "generating" || isRegeneratingSeo;

  return (
    <>
      {/* Actions section with warm background */}
      <div className="mt-4 pt-4 px-4 pb-4 bg-[#FDFBF7] border-t border-border rounded-b-lg">
        {/* Actions Row - Convex Verified, SEO, Auto-fill */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
          <span className="text-xs font-medium text-text-secondary w-16 shrink-0">
            Actions
          </span>
          <div className="flex gap-1 flex-wrap items-center">
            {/* Convex Verified Toggle */}
            <Tooltip
              content={
                convexVerified
                  ? "Remove Convex Verified badge"
                  : "Mark as Convex Verified"
              }
            >
              <button
                onClick={handleToggleVerified}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
                  convexVerified
                    ? "bg-teal-600 text-white border-teal-600"
                    : "border-teal-200 text-teal-600 hover:bg-teal-50"
                }`}
              >
                <CheckCircle
                  size={14}
                  weight={convexVerified ? "fill" : "bold"}
                />
                <span>Convex Verified</span>
              </button>
            </Tooltip>

            {/* Community Toggle */}
            <Tooltip
              content={
                communitySubmitted
                  ? "Remove Community badge"
                  : "Mark as Community"
              }
            >
              <button
                onClick={handleToggleCommunity}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
                  communitySubmitted
                    ? "text-white border-[#C4B48A]"
                    : "border-[#E9DDC2] text-[#574A30] hover:bg-[#F5F0E3]"
                }`}
                style={
                  communitySubmitted
                    ? { backgroundColor: "#C4B48A", borderColor: "#C4B48A" }
                    : {}
                }
              >
                <Users
                  size={14}
                  weight={communitySubmitted ? "fill" : "bold"}
                />
                <span>Community</span>
              </button>
            </Tooltip>

            {/* Generate Component Directory Content Button */}
            <Tooltip
              content={
                isSeoGenerating
                  ? "AI is working..."
                  : "Generate component directory content and SKILL.md"
              }
            >
              <button
                onClick={handleRegenerateSeo}
                disabled={isLoading || isSeoGenerating}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
                  seoGenerationStatus === "completed"
                    ? "border-green-200 text-green-600 hover:bg-green-50"
                    : "border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                {isSeoGenerating ? (
                  <AiLoadingDots size={14} />
                ) : (
                  <>
                    <ArrowsClockwise size={14} weight="bold" />
                    <span>Generate Content</span>
                  </>
                )}
              </button>
            </Tooltip>

            {/* Refresh README Only */}
            <Tooltip
              content={
                isRefreshingReadme
                  ? "Fetching README..."
                  : `Fetch latest README from ${repoHostLabel(repositoryUrl, "the repository")} without regenerating AI content`
              }
            >
              <button
                onClick={handleRefreshReadme}
                disabled={isLoading || isRefreshingReadme}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              >
                {isRefreshingReadme ? (
                  <AiLoadingDots size={14} />
                ) : (
                  <>
                    <FileText size={14} weight="bold" />
                    <span>Update README</span>
                  </>
                )}
              </button>
            </Tooltip>

            {/* Rebuild SKILL.md from current directory content */}
            <Tooltip
              content={
                isRebuildingSkill
                  ? "Rebuilding skill..."
                  : "Rebuild SKILL.md from current directory content (no AI call)"
              }
            >
              <button
                onClick={handleRebuildSkill}
                disabled={isLoading || isRebuildingSkill}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              >
                {isRebuildingSkill ? (
                  <AiLoadingDots size={14} />
                ) : (
                  <>
                    <Robot size={14} weight="bold" />
                    <span>
                      {hasSkillMd ? "Update Skill" : "Generate Skill"}
                    </span>
                  </>
                )}
              </button>
            </Tooltip>

            <Tooltip
              content={
                hideSeoAndSkillContentOnDetailPage
                  ? "Show generated SEO and SKILL content on the detail page"
                  : "Hide generated SEO and SKILL content from the detail page"
              }
            >
              <button
                onClick={handleToggleHideSeoAndSkillContent}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
                  hideSeoAndSkillContentOnDetailPage
                    ? "bg-gray-700 text-white border-gray-700"
                    : "border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                {hideSeoAndSkillContentOnDetailPage ? (
                  <EyeSlash size={14} weight="bold" />
                ) : (
                  <Eye size={14} weight="bold" />
                )}
                <span>
                  {hideSeoAndSkillContentOnDetailPage
                    ? "SEO Hidden"
                    : "Hide SEO"}
                </span>
              </button>
            </Tooltip>

            {/* Combined Auto-fill Button */}
            <Tooltip
              content={
                !canAutoFill
                  ? "No data available to auto-fill"
                  : `Auto-fill${repositoryUrl ? ` author from ${repoHostLabel(repositoryUrl, "repository")}` : ""}${repositoryUrl && npmDescription ? " and" : ""}${npmDescription ? " description from package" : ""}`
              }
            >
              <button
                onClick={handleAutoFill}
                disabled={isLoading || isAutoFilling || !canAutoFill}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
                  canAutoFill
                    ? "border-blue-200 text-blue-600 hover:bg-blue-50"
                    : "border-border text-text-secondary cursor-not-allowed"
                }`}
              >
                <Lightning
                  size={14}
                  weight={isAutoFilling ? "fill" : "bold"}
                  className={isAutoFilling ? "animate-pulse" : ""}
                />
                <span>{isAutoFilling ? "Filling..." : "Auto-fill"}</span>
              </button>
            </Tooltip>

            {/* Hide Thumbnail in Category Toggle - only show if thumbnail exists */}
            {thumbnailUrl && (
              <Tooltip
                content={
                  hideThumbnailInCategory
                    ? "Show thumbnail in category listings"
                    : "Hide thumbnail in category listings (show only in Featured)"
                }
              >
                <button
                  onClick={handleToggleHideThumbnail}
                  disabled={isLoading}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
                    hideThumbnailInCategory
                      ? "bg-orange-600 text-white border-orange-600"
                      : "border-orange-200 text-orange-600 hover:bg-orange-50"
                  }`}
                >
                  <Image
                    size={14}
                    weight={hideThumbnailInCategory ? "fill" : "bold"}
                  />
                  <span>
                    {hideThumbnailInCategory ? "Thumb Hidden" : "Hide Thumb"}
                  </span>
                </button>
              </Tooltip>
            )}

            {/* Refresh NPM Data Button */}
            <div className="flex items-center gap-1">
              {refreshError && (
                <Tooltip content={`Refresh failed: ${refreshError}`}>
                  <div className="flex items-center text-orange-500">
                    <Warning size={14} weight="bold" />
                  </div>
                </Tooltip>
              )}
              {lastRefreshedAt && !refreshError && (
                <span className="text-[10px] text-text-secondary hidden lg:inline">
                  {formatRelativeTime(lastRefreshedAt)}
                </span>
              )}
              <Tooltip content="Refresh package data from npm">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefreshNpm();
                  }}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border text-text-primary hover:bg-bg-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowClockwise
                    size={14}
                    className={isRefreshing ? "animate-spin" : ""}
                  />
                  <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
                </button>
              </Tooltip>
            </div>

            {/* Generate Slug Button - only show if no slug */}
            {(!slug || slug.trim() === "") && (
              <Tooltip content="Generate URL slug for detail page">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerateSlug();
                  }}
                  disabled={isGeneratingSlug}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LinkSimple
                    size={14}
                    className={isGeneratingSlug ? "animate-pulse" : ""}
                  />
                  <span>{isGeneratingSlug ? "..." : "Slug"}</span>
                </button>
              </Tooltip>
            )}

            {/* Send Reward Button */}
            <Tooltip
              content={
                !submitterEmail
                  ? "No submitter email on this package"
                  : !canSendReward
                    ? `Rewards require in review or approved status (current: ${status})`
                    : rewardStatus === "sent" || rewardStatus === "delivered"
                      ? "Reward already sent"
                      : rewardStatus === "failed"
                        ? "Previous reward failed - click to retry"
                        : "Send reward to submitter"
              }
            >
              <button
                onClick={() => setShowRewardConfirm(true)}
                disabled={
                  isLoading ||
                  !submitterEmail ||
                  isSendingReward ||
                  !canSendReward
                }
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
                  rewardStatus === "sent" || rewardStatus === "delivered"
                    ? "bg-green-600 text-white border-green-600"
                    : rewardStatus === "failed"
                      ? "bg-red-100 text-red-600 border-red-200 hover:bg-red-50"
                      : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                }`}
              >
                <CurrencyCircleDollar
                  size={14}
                  weight={
                    rewardStatus === "sent" || rewardStatus === "delivered"
                      ? "fill"
                      : "bold"
                  }
                />
                <span>
                  {rewardStatus === "sent" || rewardStatus === "delivered"
                    ? "Paid"
                    : rewardStatus === "failed"
                      ? "Retry"
                      : "Reward"}
                </span>
              </button>
            </Tooltip>

            {/* Reward History Button */}
            <Tooltip
              content={
                rewardPayments === undefined
                  ? "Loading reward history"
                  : rewardHistoryCount === 0
                    ? "No rewards recorded for this component yet"
                    : `View reward history (${rewardHistoryCount})`
              }
            >
              <button
                onClick={() => setShowRewardHistory(true)}
                disabled={rewardPayments === undefined}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-all disabled:opacity-50"
              >
                <ClockCounterClockwise size={14} weight="bold" />
                <span>History</span>
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-bg-hover px-1.5 py-0.5 text-[10px] text-text-primary">
                  {rewardPayments === undefined ? "..." : rewardHistoryCount}
                </span>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Review Status Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
          <span className="text-xs font-medium text-text-secondary w-16 shrink-0">
            Status
          </span>
          <div className="flex gap-1 flex-wrap">
            {statusButtons.map((btn) => (
              <Tooltip key={btn.value} content={btn.tooltip}>
                <button
                  onClick={() => handleStatusChange(btn.value)}
                  disabled={isLoading}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
                    status === btn.value
                      ? btn.activeClass
                      : "border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  }`}
                >
                  {btn.icon}
                  <span>{btn.label}</span>
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Review Row - AI Review, Security Scan, Review History */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
          <span className="text-xs font-medium text-text-secondary w-16 shrink-0">
            Review
          </span>
          <div className="flex gap-1 flex-wrap items-center">
            {/* AI Review Button */}
            <AiReviewButton
              packageId={packageId}
              packageName={packageName}
              repositoryUrl={repositoryUrl}
            />
            {/* Security Scan Button */}
            <Tooltip
              content={
                !repositoryUrl
                  ? "No repository URL available for security scan"
                  : isScanning
                    ? "Security scan in progress..."
                    : "Run security scan (Socket.dev + Snyk)"
              }
            >
              <button
                onClick={async () => {
                  if (isScanning || !repositoryUrl) return;
                  setIsScanning(true);
                  try {
                    await runSecurityScan({ packageId });
                    toast.success("Security scan started!");
                  } catch (error) {
                    toast.error("Security scan failed");
                  } finally {
                    setIsScanning(false);
                  }
                }}
                disabled={isScanning || !repositoryUrl}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
                  isScanning
                    ? "bg-blue-100 text-blue-700 border-blue-200"
                    : "border-green-200 text-green-700 hover:bg-green-50"
                }`}
              >
                <ShieldCheck size={14} weight="bold" />
                <span>{isScanning ? "Scanning..." : "Security Scan"}</span>
              </button>
            </Tooltip>
            {/* Combined Review History (AI + Security) */}
            <Tooltip
              content={
                aiReviewRuns === undefined && securityScanRuns === undefined
                  ? "Loading review history"
                  : combinedReviewHistoryCount === 0
                    ? "No review runs yet"
                    : `View review history (${combinedReviewHistoryCount})`
              }
            >
              <button
                onClick={() => setShowAiReviewHistory(true)}
                disabled={
                  aiReviewRuns === undefined && securityScanRuns === undefined
                }
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-all disabled:opacity-50"
              >
                <ClockCounterClockwise size={14} weight="bold" />
                <span>Review history</span>
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-bg-hover px-1.5 py-0.5 text-[10px] text-text-primary">
                  {aiReviewRuns === undefined && securityScanRuns === undefined
                    ? "..."
                    : combinedReviewHistoryCount}
                </span>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Visibility Buttons + Notes */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pb-2">
          <span className="text-xs font-medium text-text-secondary w-16 shrink-0">
            {isArchivedView ? "Actions" : "Visibility"}
          </span>
          <div className="flex gap-1 flex-wrap">
            {isArchivedView ? (
              <Tooltip content="Restore package to main list">
                <button
                  onClick={handleUnarchive}
                  disabled={isLoading}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-green-200 text-green-600 hover:bg-green-50 transition-all disabled:opacity-50"
                >
                  <Archive size={14} weight="bold" />
                  <span>Unarchive</span>
                </button>
              </Tooltip>
            ) : (
              visibilityButtons.map((btn) => (
                <Tooltip key={btn.value} content={btn.tooltip}>
                  <button
                    onClick={() => handleVisibilityChange(btn.value)}
                    disabled={isLoading}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
                      visibility === btn.value
                        ? btn.activeClass
                        : "border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                    }`}
                  >
                    {btn.icon}
                    <span>{btn.label}</span>
                  </button>
                </Tooltip>
              ))
            )}
            {/* Featured Button */}
            <Tooltip
              content={
                status !== "approved"
                  ? "Only approved packages can be featured"
                  : featured
                    ? "Remove from featured"
                    : "Mark as featured"
              }
            >
              <button
                onClick={handleToggleFeatured}
                disabled={isLoading || status !== "approved"}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
                  featured
                    ? "bg-amber-600 text-white border-amber-600"
                    : status === "approved"
                      ? "border-amber-200 text-amber-600 hover:bg-amber-50"
                      : "border-border text-text-secondary cursor-not-allowed"
                }`}
              >
                <Star size={14} weight={featured ? "fill" : "bold"} />
                <span>{featured ? "Featured" : "Feature"}</span>
              </button>
            </Tooltip>
            {featured && (
              <Tooltip content="Lower numbers appear first in Featured section">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={sortOrderInput}
                    onChange={(e) => setSortOrderInput(e.target.value)}
                    onBlur={handleSaveSortOrder}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleSaveSortOrder()
                    }
                    placeholder="#"
                    className="w-10 px-1.5 py-1 text-xs text-center rounded border border-amber-200 bg-amber-50 text-amber-700 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </Tooltip>
            )}
            {/* Hide from Submissions toggle */}
            <Tooltip
              content={
                hideFromSubmissions
                  ? "Show on Submissions page"
                  : "Hide from Submissions page (still shows on Directory if approved)"
              }
            >
              <button
                onClick={handleToggleHideFromSubmissions}
                disabled={isLoading}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
                  hideFromSubmissions
                    ? "bg-slate-600 text-white border-slate-600"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <EyeSlash
                  size={14}
                  weight={hideFromSubmissions ? "fill" : "bold"}
                />
                <span>{hideFromSubmissions ? "Sub Hidden" : "Sub Hide"}</span>
              </button>
            </Tooltip>
            {/* Notes Button */}
            <NotesButton
              packageId={packageId}
              packageName={packageName}
              userEmail={userEmail}
            />
            {/* Comments Button */}
            <CommentsButton
              packageId={packageId}
              packageName={packageName}
              userEmail={userEmail}
              repositoryUrl={repositoryUrl}
            />
          </div>

          {/* Delete Button */}
          <div className="mt-2 sm:mt-0 sm:ml-auto">
            <Tooltip content="Permanently delete this package">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
              >
                <Trash size={14} weight="bold" />
                <span>Delete</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Package?"
        message={`Are you sure you want to permanently delete "${packageName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {/* Send Reward confirmation modal */}
      {showRewardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !isSendingReward && setShowRewardConfirm(false)}
          />
          <div className="relative w-full max-w-md p-6 rounded-container bg-white border border-border shadow-lg">
            <div className="flex items-start gap-3 mb-4">
              <div className="shrink-0 text-emerald-600">
                <CurrencyCircleDollar size={24} weight="bold" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-normal text-text-primary">
                  Send Reward
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Send a reward to{" "}
                  <span className="font-medium">{submitterEmail}</span> for "
                  {packageName}"
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
                    $
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={rewardAmount}
                    onChange={(e) => setRewardAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-button/50"
                    placeholder="25"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Message to recipient (optional)
                </label>
                <textarea
                  value={rewardNote}
                  onChange={(e) => setRewardNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-button/50 resize-none"
                  placeholder="Thank you for your contribution..."
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRewardConfirm(false);
                  setRewardNote("");
                }}
                disabled={isSendingReward}
                className="px-4 py-2 rounded-full text-sm font-normal border border-border text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReward}
                disabled={
                  isSendingReward ||
                  !rewardAmount ||
                  parseFloat(rewardAmount) <= 0
                }
                className="px-4 py-2 rounded-full text-sm font-normal bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSendingReward ? (
                  <>
                    <ArrowsClockwise size={14} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <CurrencyCircleDollar size={14} weight="bold" />
                    Send ${rewardAmount || "0"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reward history modal */}
      {showRewardHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowRewardHistory(false)}
          />
          <div className="relative w-full max-w-2xl rounded-container bg-white border border-border shadow-lg">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <h3 className="text-lg font-normal text-text-primary">
                  Reward History
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {packageName} has {rewardHistoryCount} reward
                  {rewardHistoryCount === 1 ? "" : "s"} recorded.
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  Total successfully sent: ${rewardTotalSent.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => setShowRewardHistory(false)}
                className="rounded-full p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
              {!rewardPayments || rewardPayments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-bg-primary px-4 py-8 text-center">
                  <p className="text-sm text-text-primary">No rewards yet</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    This component has not recorded any reward attempts yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rewardPayments.map((payment) => {
                    const statusClassName =
                      payment.status === "sent" ||
                      payment.status === "delivered"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : payment.status === "failed"
                          ? "bg-red-500/10 text-red-600 border-red-500/20"
                          : "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";

                    return (
                      <div
                        key={payment._id}
                        className="rounded-lg border border-border bg-bg-primary p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-text-primary">
                                ${payment.amount.toFixed(2)}{" "}
                                {payment.currencyCode}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusClassName}`}
                              >
                                <CurrencyCircleDollar size={12} weight="bold" />
                                {payment.status}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-text-secondary">
                              Sent to {payment.recipientEmail}
                            </p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {new Date(payment.sentAt).toLocaleString()} by{" "}
                              {payment.sentBy}
                            </p>
                            {payment.note && (
                              <p className="mt-2 text-xs text-text-secondary">
                                Note: {payment.note}
                              </p>
                            )}
                            {payment.error && (
                              <p className="mt-2 text-xs text-red-600">
                                Error: {payment.error}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {payment.tremendousOrderId && (
                              <span className="rounded-full bg-bg-hover px-2 py-1 text-[10px] text-text-secondary">
                                Order {payment.tremendousOrderId}
                              </span>
                            )}
                            {payment.tremendousRewardLink && (
                              <a
                                href={payment.tremendousRewardLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                              >
                                <ArrowSquareOut size={12} />
                                Link
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-border px-6 py-4">
              <button
                onClick={() => setShowRewardHistory(false)}
                className="px-4 py-2 rounded-full text-sm font-normal border border-border text-text-primary hover:bg-bg-hover transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <AiReviewHistoryPanel
        packageId={packageId}
        packageName={packageName}
        isOpen={showAiReviewHistory}
        onClose={() => setShowAiReviewHistory(false)}
        reviewedBy={reviewedBy}
      />
    </>
  );
}

// Inline edit form for a single category row
function CategoryEditForm({
  editingId,
  slug,
  label,
  description,
  sortOrder,
  enabled,
  hideThumbnails,
  showAllThumbnails,
  curated,
  saving,
  slugLocked = false,
  onSlugChange,
  onLabelChange,
  onDescriptionChange,
  onSortOrderChange,
  onEnabledChange,
  onHideThumbnailsChange,
  onShowAllThumbnailsChange,
  onCuratedChange,
  onSave,
  onCancel,
}: {
  editingId: string | null;
  slug: string;
  label: string;
  description: string;
  sortOrder: number;
  enabled: boolean;
  hideThumbnails: boolean;
  showAllThumbnails: boolean;
  curated: boolean;
  saving: boolean;
  slugLocked?: boolean;
  onSlugChange: (v: string) => void;
  onLabelChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onSortOrderChange: (v: number) => void;
  onEnabledChange: (v: boolean) => void;
  onHideThumbnailsChange: (v: boolean) => void;
  onShowAllThumbnailsChange: (v: boolean) => void;
  onCuratedChange: (v: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const formId = editingId || "new";
  return (
    <div className="rounded-lg border border-button/30 bg-bg-hover/50 p-4 space-y-3">
      <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
        {editingId ? "Edit Category" : "New Category"}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
            Slug (unique ID)
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            placeholder="e.g. ai"
            disabled={slugLocked}
            title={
              slugLocked
                ? "Automatic categories keep a fixed slug so their landing page URL stays stable"
                : undefined
            }
            className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {editingId && !slugLocked && (
            <span className="mt-1 block text-[10px] text-text-secondary">
              Changing the slug moves the category page and its agent files
              (slug-llms.txt, slug.md). Old links stop working.
            </span>
          )}
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="e.g. AI"
            className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Short description of this category"
            className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
            Sort Order
          </label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => onSortOrderChange(Number(e.target.value))}
            className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`cat-enabled-${formId}`}
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="rounded"
          />
          <label
            htmlFor={`cat-enabled-${formId}`}
            className="text-xs text-text-primary"
          >
            Enabled (visible to public)
          </label>
        </div>
        {/* Hides every thumbnail in this category, for grids that look uneven
            when only a few components have an image */}
        <div className="sm:col-span-2 flex items-start gap-2">
          <input
            type="checkbox"
            id={`cat-hide-thumbs-${formId}`}
            checked={hideThumbnails}
            onChange={(e) => onHideThumbnailsChange(e.target.checked)}
            className="rounded mt-0.5"
          />
          <label
            htmlFor={`cat-hide-thumbs-${formId}`}
            className="text-xs text-text-primary"
          >
            Hide all thumbnails in this category
            <span className="block text-[10px] text-text-secondary">
              Applies to the category page and this category's section on the
              Directory. Featured is not affected.
            </span>
          </label>
        </div>
        {/* Category page only: overrides each component's "Hide thumbnail in
            category listings" flag without touching the Directory */}
        <div className="sm:col-span-2 flex items-start gap-2">
          <input
            type="checkbox"
            id={`cat-show-thumbs-${formId}`}
            checked={showAllThumbnails}
            onChange={(e) => onShowAllThumbnailsChange(e.target.checked)}
            className="rounded mt-0.5"
          />
          <label
            htmlFor={`cat-show-thumbs-${formId}`}
            className="text-xs text-text-primary"
          >
            Show all thumbnails on the category page
            <span className="block text-[10px] text-text-secondary">
              Shows every component's thumbnail on this category's page, even
              ones hidden in category listings. The Directory view keeps its
              current settings. Cannot be combined with Hide all.
            </span>
          </label>
        </div>
        {/* Curated type is chosen at creation and fixed afterwards, so the
            checkbox only appears on the new-category form */}
        {!editingId && (
          <div className="sm:col-span-2 flex items-start gap-2">
            <input
              type="checkbox"
              id={`cat-curated-${formId}`}
              checked={curated}
              onChange={(e) => onCuratedChange(e.target.checked)}
              className="rounded mt-0.5"
            />
            <label
              htmlFor={`cat-curated-${formId}`}
              className="text-xs text-text-primary"
            >
              Curated (hand-picked members)
              <span className="block text-[10px] text-text-secondary">
                You choose which components belong to this category. Members
                keep their primary category and can show an optional badge image
                on their cards.
              </span>
            </label>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={saving}
          className="text-xs px-4 py-1.5 rounded-full bg-button text-white hover:bg-button-hover transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : editingId ? "Update" : "Add"}
        </button>
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-full border border-border text-text-secondary hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Category Management Panel for admin settings
// Schedule choices for the official README auto-update, in hours.
const README_AUTO_UPDATE_INTERVALS: Array<{ hours: number; label: string }> = [
  { hours: 1, label: "Every hour" },
  { hours: 24, label: "Every day" },
  { hours: 72, label: "Every 3 days" },
  { hours: 168, label: "Every week" },
  { hours: 720, label: "Every month" },
];

function CategoryManagementPanel() {
  const allCategories = useQuery(api.packages.listAllDirectoryCategories);
  // Fetch counts (same query the directory sidebar uses)
  const categoryCounts = useQuery(api.packages.listCategories);
  const upsertCategory = useMutation(api.packages.upsertCategory);
  const deleteCategory = useMutation(api.packages.deleteCategory);
  const seedCategories = useMutation(api.packages.seedCategories);
  const setOfficialCategoryEnabled = useMutation(
    api.packages.setOfficialCategoryEnabled,
  );
  const [togglingOfficial, setTogglingOfficial] = useState(false);
  // Scheduled README auto-update for official components (hourly cron gated by these settings)
  const readmeAutoUpdate = useQuery(
    api.readmeAutoUpdate.getOfficialReadmeAutoUpdateSettings,
  );
  const updateReadmeAutoUpdate = useMutation(
    api.readmeAutoUpdate.updateOfficialReadmeAutoUpdateSettings,
  );
  const [savingReadmeAutoUpdate, setSavingReadmeAutoUpdate] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSlug, setEditSlug] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [editEnabled, setEditEnabled] = useState(true);
  const [editHideThumbnails, setEditHideThumbnails] = useState(false);
  const [editShowAllThumbnails, setEditShowAllThumbnails] = useState(false);
  const [editCurated, setEditCurated] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  // Curated category whose badge/member controls are expanded
  const [managingCuratedId, setManagingCuratedId] = useState<string | null>(
    null,
  );

  // Build count maps from the listCategories query (matches Directory sidebar)
  const countMap: Record<string, number> = {};
  const verifiedCountMap: Record<string, number> = {};
  if (categoryCounts) {
    for (const c of categoryCounts) {
      countMap[c.category] = c.count;
      verifiedCountMap[c.category] = c.verifiedCount;
    }
  }

  // Seed defaults if empty
  useEffect(() => {
    if (allCategories && allCategories.length === 0) {
      seedCategories();
    }
  }, [allCategories, seedCategories]);

  // Start editing a category (inline)
  const startEdit = (cat: {
    _id: string;
    slug: string;
    label: string;
    description: string;
    sortOrder: number;
    enabled: boolean;
    hideThumbnails?: boolean;
    showAllThumbnails?: boolean;
    kind?: "curated";
  }) => {
    setEditingId(cat._id);
    setEditSlug(cat.slug);
    setEditLabel(cat.label);
    setEditDescription(cat.description);
    setEditSortOrder(cat.sortOrder);
    setEditEnabled(cat.enabled);
    setEditHideThumbnails(cat.hideThumbnails ?? false);
    setEditShowAllThumbnails(cat.showAllThumbnails ?? false);
    setEditCurated(cat.kind === "curated");
    setShowAddForm(false);
  };

  // Start adding a new category (form at top)
  const startAdd = () => {
    setEditingId(null);
    setEditSlug("");
    setEditLabel("");
    setEditDescription("");
    setEditSortOrder(allCategories ? allCategories.length : 0);
    setEditEnabled(true);
    setEditHideThumbnails(false);
    setEditShowAllThumbnails(false);
    setEditCurated(false);
    setShowAddForm(true);
  };

  // Hide all and Show all are mutually exclusive: checking one clears the other
  const handleHideThumbnailsChange = (checked: boolean) => {
    setEditHideThumbnails(checked);
    if (checked) setEditShowAllThumbnails(false);
  };
  const handleShowAllThumbnailsChange = (checked: boolean) => {
    setEditShowAllThumbnails(checked);
    if (checked) setEditHideThumbnails(false);
  };

  // Save (create or update)
  const handleSave = async () => {
    if (!editSlug.trim() || !editLabel.trim()) {
      toast.error("Slug and label are required");
      return;
    }
    setSaving(true);
    try {
      await upsertCategory({
        id: editingId ? (editingId as Id<"categories">) : undefined,
        slug: editSlug.trim().toLowerCase().replace(/\s+/g, "-"),
        label: editLabel.trim(),
        description: editDescription.trim(),
        sortOrder: editSortOrder,
        enabled: editEnabled,
        hideThumbnails: editHideThumbnails,
        showAllThumbnails: editShowAllThumbnails,
        // kind is create-only; the backend ignores it on update
        kind: !editingId && editCurated ? ("curated" as const) : undefined,
      });
      toast.success(editingId ? "Category updated" : "Category added");
      setEditingId(null);
      setShowAddForm(false);
    } catch (error) {
      toast.error("Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  // Delete a category
  const handleDelete = async (id: string) => {
    try {
      await deleteCategory({ id: id as Id<"categories"> });
      toast.success("Category deleted");
      if (editingId === id) {
        setEditingId(null);
      }
    } catch {
      toast.error("Failed to delete category");
    }
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setShowAddForm(false);
  };

  // Derived official category (get-convex), created on first enable
  const officialCategory = allCategories?.find(
    (cat) => cat.derivedFrom === "official",
  );
  const officialEnabled = officialCategory?.enabled ?? false;

  const handleToggleOfficial = async () => {
    if (togglingOfficial) return;
    setTogglingOfficial(true);
    try {
      await setOfficialCategoryEnabled({ enabled: !officialEnabled });
      toast.success(
        officialEnabled
          ? "Official Convex Components category hidden"
          : "Official Convex Components category enabled",
      );
    } catch {
      toast.error("Failed to update the official category");
    } finally {
      setTogglingOfficial(false);
    }
  };

  const readmeAutoUpdateEnabled = readmeAutoUpdate?.enabled ?? false;
  const readmeAutoUpdateInterval = readmeAutoUpdate?.intervalHours ?? 1;

  const handleToggleReadmeAutoUpdate = async () => {
    if (savingReadmeAutoUpdate) return;
    setSavingReadmeAutoUpdate(true);
    try {
      await updateReadmeAutoUpdate({ enabled: !readmeAutoUpdateEnabled });
      toast.success(
        readmeAutoUpdateEnabled
          ? "README auto-update disabled"
          : "README auto-update enabled",
      );
    } catch {
      toast.error("Failed to update README auto-update");
    } finally {
      setSavingReadmeAutoUpdate(false);
    }
  };

  const handleReadmeIntervalChange = async (hours: number) => {
    if (savingReadmeAutoUpdate) return;
    setSavingReadmeAutoUpdate(true);
    try {
      await updateReadmeAutoUpdate({ intervalHours: hours });
      const option = README_AUTO_UPDATE_INTERVALS.find(
        (o) => o.hours === hours,
      );
      toast.success(
        `README auto-update schedule set to ${option?.label.toLowerCase() ?? "every hour"}`,
      );
    } catch {
      toast.error("Failed to update the schedule");
    } finally {
      setSavingReadmeAutoUpdate(false);
    }
  };

  if (!allCategories) {
    return (
      <div className="rounded-lg border border-border bg-bg-card p-4 mb-6">
        <div className="animate-pulse h-6 bg-bg-secondary rounded w-40" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4 mb-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-text-primary">
          Category Management
        </h3>
        <button
          onClick={startAdd}
          className="inline-flex w-full items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-full bg-button text-white hover:bg-button-hover transition-colors sm:w-auto"
        >
          <Plus size={12} weight="bold" />
          Add Category
        </button>
      </div>

      <p className="text-xs text-text-secondary mb-4">
        Manage categories that appear in the Submit form, Component Details
        editor, and the Directory page. Disabled categories are hidden from
        public views.
      </p>

      {/* Official Convex Components: derived category populated by rule, not by assignment */}
      <div className="mb-4 rounded-xl border border-border bg-bg-primary p-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium text-text-primary">
                Official Convex Components
              </span>
              <span className="text-[10px] font-mono text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded">
                get-convex
              </span>
              {officialEnabled && (
                <span className="text-[10px] font-medium text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded">
                  {officialCategory?.packageCount ?? 0} components
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary">
              A top level category filled automatically from the convex GitHub
              org (formerly get-convex) and the @convex-dev npm scope. The slug
              stays get-convex so existing URLs keep working. Components keep their existing
              category and also appear here, so it is never offered as a choice in
              category pickers.
            </p>
          </div>
          <button
            onClick={handleToggleOfficial}
            disabled={togglingOfficial}
            aria-pressed={officialEnabled}
            aria-label="Toggle the Official Convex Components category"
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              officialEnabled ? "bg-green-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                officialEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Scheduled README auto-update for official components */}
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="text-sm font-medium text-text-primary">
                Auto-update READMEs
              </span>
              <p className="mt-1 text-xs text-text-secondary">
                Refreshes the README from GitHub for every approved official
                component on the schedule below, the same as clicking Update
                README. Fetches are staggered to stay under GitHub rate limits
                and every run is recorded in the Logs tab.
              </p>
            </div>
            <button
              onClick={handleToggleReadmeAutoUpdate}
              disabled={savingReadmeAutoUpdate || readmeAutoUpdate === undefined}
              aria-pressed={readmeAutoUpdateEnabled}
              aria-label="Toggle scheduled README updates for official components"
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                readmeAutoUpdateEnabled ? "bg-green-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  readmeAutoUpdateEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              Schedule
              <select
                value={readmeAutoUpdateInterval}
                onChange={(e) =>
                  handleReadmeIntervalChange(Number(e.target.value))
                }
                disabled={
                  savingReadmeAutoUpdate || readmeAutoUpdate === undefined
                }
                className="rounded-lg border border-border bg-bg-card px-2 py-1 text-xs text-text-primary disabled:opacity-50"
              >
                {README_AUTO_UPDATE_INTERVALS.map((option) => (
                  <option key={option.hours} value={option.hours}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {readmeAutoUpdate?.lastRunAt ? (
              <span className="text-xs text-text-secondary">
                Last run{" "}
                {new Date(readmeAutoUpdate.lastRunAt).toLocaleString("en-US", {
                  month: "short",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ) : (
              <span className="text-xs text-text-secondary">
                Has not run yet
              </span>
            )}
          </div>
        </div>
      </div>

      {/* New category form at top (only for adding, not editing) */}
      {showAddForm && !editingId && (
        <div className="mb-4">
          <CategoryEditForm
            editingId={null}
            slug={editSlug}
            label={editLabel}
            description={editDescription}
            sortOrder={editSortOrder}
            enabled={editEnabled}
            hideThumbnails={editHideThumbnails}
            showAllThumbnails={editShowAllThumbnails}
            curated={editCurated}
            saving={saving}
            onSlugChange={setEditSlug}
            onLabelChange={setEditLabel}
            onDescriptionChange={setEditDescription}
            onSortOrderChange={setEditSortOrder}
            onEnabledChange={setEditEnabled}
            onHideThumbnailsChange={handleHideThumbnailsChange}
            onShowAllThumbnailsChange={handleShowAllThumbnailsChange}
            onCuratedChange={setEditCurated}
            onSave={handleSave}
            onCancel={cancelEdit}
          />
        </div>
      )}

      {/* Category list with inline editing */}
      <div className="space-y-2">
        {allCategories.map((cat) => {
          const isEditing = editingId === cat._id;
          const componentCount = countMap[cat.slug] ?? 0;
          const verifiedCount = verifiedCountMap[cat.slug] ?? 0;

          // Show inline edit form for this row
          if (isEditing) {
            return (
              <CategoryEditForm
                key={cat._id}
                editingId={cat._id}
                slug={editSlug}
                label={editLabel}
                description={editDescription}
                sortOrder={editSortOrder}
                enabled={editEnabled}
                hideThumbnails={editHideThumbnails}
                showAllThumbnails={editShowAllThumbnails}
                curated={editCurated}
                saving={saving}
                slugLocked={cat.derivedFrom !== undefined}
                onSlugChange={setEditSlug}
                onLabelChange={setEditLabel}
                onDescriptionChange={setEditDescription}
                onSortOrderChange={setEditSortOrder}
                onEnabledChange={setEditEnabled}
                onHideThumbnailsChange={handleHideThumbnailsChange}
                onShowAllThumbnailsChange={handleShowAllThumbnailsChange}
                onCuratedChange={setEditCurated}
                onSave={handleSave}
                onCancel={cancelEdit}
              />
            );
          }

          // Normal category row
          const isCurated = cat.kind === "curated";
          const isManaging = managingCuratedId === cat._id;
          const agentUrls = cat.enabled
            ? buildCategoryClientUrls(
                cat.slug,
                window.location.origin,
                import.meta.env.VITE_CONVEX_URL as string | undefined,
              )
            : null;
          return (
            <div
              key={cat._id}
              className={`flex flex-col gap-3 rounded-xl border p-3 transition-colors ${
                !cat.enabled
                  ? "border-border/50 bg-bg-primary/50 opacity-60"
                  : "border-border bg-bg-primary"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-text-primary">
                      {cat.label}
                    </span>
                    {isCurated && cat.badgeUrl && (
                      <img
                        src={cat.badgeUrl}
                        alt={`${cat.label} badge`}
                        title={`${cat.label} badge`}
                        className="h-4 w-auto max-w-[64px] rounded object-contain"
                      />
                    )}
                    <span className="text-[10px] font-mono text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded">
                      {cat.slug}
                    </span>
                    <span className="text-[10px] font-medium text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded">
                      {componentCount}{" "}
                      {componentCount === 1 ? "component" : "components"}
                    </span>
                    <span className="text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                      {verifiedCount}{" "}
                      {verifiedCount === 1
                        ? "verified component"
                        : "verified components"}
                    </span>
                    {cat.derivedFrom && (
                      <span className="text-[10px] text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded border border-border">
                        auto
                      </span>
                    )}
                    {isCurated && (
                      <span className="text-[10px] text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded border border-border">
                        curated
                      </span>
                    )}
                    {cat.hideThumbnails && (
                      <span className="text-[10px] text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded border border-border">
                        thumbnails hidden
                      </span>
                    )}
                    {cat.showAllThumbnails && !cat.hideThumbnails && (
                      <span className="text-[10px] text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded border border-border">
                        thumbnails shown on page
                      </span>
                    )}
                    {!cat.enabled && (
                      <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                        disabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary break-words">
                    {cat.description}
                  </p>
                  {/* Agent files are generated live for enabled categories */}
                  {agentUrls && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-secondary">
                      <span>Agent files:</span>
                      {[
                        { href: agentUrls.llmsUrl, label: `${cat.slug}-llms.txt` },
                        { href: agentUrls.markdownUrl, label: `${cat.slug}.md` },
                      ].map((file) => (
                        <a
                          key={file.label}
                          href={file.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono hover:text-text-primary transition-colors"
                        >
                          {file.label}
                          <ArrowSquareOut size={10} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex w-full items-center justify-end gap-1 shrink-0 sm:w-auto sm:justify-start">
                  {isCurated && (
                    <button
                      onClick={() =>
                        setManagingCuratedId(isManaging ? null : cat._id)
                      }
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        isManaging
                          ? "border-button bg-button text-white"
                          : "border-border text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {isManaging ? "Close" : "Manage members"}
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(cat)}
                    className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                    title="Edit"
                  >
                    <PencilSimple size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(cat._id)}
                    className="p-1.5 rounded text-text-secondary hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <TrashSimple size={14} />
                  </button>
                </div>
              </div>
              {isCurated && isManaging && (
                <CuratedCategoryControls
                  categoryId={cat._id}
                  badgeUrl={cat.badgeUrl}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Badge upload and member picker for a curated category.
// The badge image is optional: the category works without one, and the badge
// can be added, replaced, or removed at any time.
function CuratedCategoryControls({
  categoryId,
  badgeUrl,
}: {
  categoryId: Id<"categories">;
  badgeUrl?: string;
}) {
  const members = useQuery(api.packages.listCuratedCategoryMembers, {
    categoryId,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const searchResults = useQuery(
    api.packages.adminSearchPackages,
    searchTerm.trim() ? { searchTerm: searchTerm.trim() } : "skip",
  );
  const generateUploadUrl = useMutation(api.packages.generateUploadUrl);
  const saveCategoryBadge = useMutation(api.packages.saveCategoryBadge);
  const clearCategoryBadge = useMutation(api.packages.clearCategoryBadge);
  const addMember = useMutation(api.packages.addComponentToCuratedCategory);
  const removeMember = useMutation(
    api.packages.removeComponentFromCuratedCategory,
  );
  const badgeInputRef = useRef<HTMLInputElement>(null);
  const [uploadingBadge, setUploadingBadge] = useState(false);
  const [pendingPackageId, setPendingPackageId] = useState<string | null>(null);

  const memberPackageIds = new Set(
    (members ?? []).map((m) => m.packageId as string),
  );

  // Upload flow mirrors the existing logo/thumbnail pattern:
  // generateUploadUrl -> POST file -> save storageId on the category
  const handleBadgeUpload = async (file: File | undefined) => {
    if (!file || uploadingBadge) return;
    setUploadingBadge(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadResult.ok) throw new Error("Upload failed");
      const { storageId } = await uploadResult.json();
      await saveCategoryBadge({ categoryId, storageId });
      toast.success("Badge saved. Member cards now show it.");
    } catch {
      toast.error("Failed to upload badge");
    } finally {
      setUploadingBadge(false);
      if (badgeInputRef.current) badgeInputRef.current.value = "";
    }
  };

  const handleClearBadge = async () => {
    try {
      await clearCategoryBadge({ categoryId });
      toast.success("Badge removed from category and member cards");
    } catch {
      toast.error("Failed to remove badge");
    }
  };

  const handleAdd = async (packageId: string) => {
    if (pendingPackageId) return;
    setPendingPackageId(packageId);
    try {
      await addMember({
        categoryId,
        packageId: packageId as Id<"packages">,
      });
      toast.success("Component added to category");
    } catch {
      toast.error("Failed to add component");
    } finally {
      setPendingPackageId(null);
    }
  };

  const handleRemove = async (packageId: string) => {
    if (pendingPackageId) return;
    setPendingPackageId(packageId);
    try {
      await removeMember({
        categoryId,
        packageId: packageId as Id<"packages">,
      });
      toast.success("Component removed from category");
    } catch {
      toast.error("Failed to remove component");
    } finally {
      setPendingPackageId(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-bg-card p-3 space-y-4">
      {/* Badge image (optional) */}
      <div>
        <h5 className="text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
          Badge image (optional)
        </h5>
        <div className="flex flex-wrap items-center gap-2">
          {badgeUrl ? (
            <img
              src={badgeUrl}
              alt="Category badge"
              className="h-6 w-auto max-w-[96px] rounded object-contain border border-border bg-bg-primary p-0.5"
            />
          ) : (
            <span className="text-xs text-text-secondary">
              No badge yet. Member cards work fine without one.
            </span>
          )}
          <input
            ref={badgeInputRef}
            type="file"
            accept="image/png,image/webp,image/svg+xml,image/jpeg"
            className="hidden"
            onChange={(e) => handleBadgeUpload(e.target.files?.[0])}
          />
          <button
            onClick={() => badgeInputRef.current?.click()}
            disabled={uploadingBadge}
            className="text-xs px-3 py-1 rounded-full border border-border text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            {uploadingBadge
              ? "Uploading..."
              : badgeUrl
                ? "Replace badge"
                : "Upload badge"}
          </button>
          {badgeUrl && (
            <button
              onClick={handleClearBadge}
              className="text-xs px-3 py-1 rounded-full border border-border text-text-secondary hover:text-red-600 transition-colors"
            >
              Remove badge
            </button>
          )}
        </div>
        <p className="mt-1 text-[10px] text-text-secondary">
          Shown as a small image above the Community/Verified labels on member
          cards and on the component detail page.
        </p>
      </div>

      {/* Current members */}
      <div>
        <h5 className="text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
          Members ({members?.length ?? 0})
        </h5>
        {members === undefined ? (
          <div className="animate-pulse h-5 bg-bg-secondary rounded w-32" />
        ) : members.length === 0 ? (
          <p className="text-xs text-text-secondary">
            No components yet. Search below to add some.
          </p>
        ) : (
          <div className="space-y-1">
            {members.map((member) => (
              <div
                key={member.membershipId}
                className="flex items-center justify-between gap-2 rounded border border-border bg-bg-primary px-2 py-1.5"
              >
                <div className="min-w-0 flex items-center gap-1.5">
                  <span className="truncate text-xs text-text-primary">
                    {member.componentName || member.name}
                  </span>
                  {member.reviewStatus !== "approved" && (
                    <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded shrink-0">
                      {member.reviewStatus ?? "pending"}
                    </span>
                  )}
                  {(member.visibility === "hidden" ||
                    member.visibility === "archived") && (
                    <span className="text-[10px] text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded shrink-0">
                      {member.visibility}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemove(member.packageId as string)}
                  disabled={pendingPackageId !== null}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-border text-text-secondary hover:text-red-600 transition-colors shrink-0 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add members */}
      <div>
        <h5 className="text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
          Add components
        </h5>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search components by name..."
          className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
        />
        {searchTerm.trim() && (
          <div className="mt-1.5 space-y-1 max-h-56 overflow-y-auto">
            {searchResults === undefined ? (
              <div className="animate-pulse h-5 bg-bg-secondary rounded w-32" />
            ) : searchResults.length === 0 ? (
              <p className="text-xs text-text-secondary">No components found</p>
            ) : (
              searchResults.slice(0, 20).map((pkg) => {
                const alreadyMember = memberPackageIds.has(pkg._id as string);
                return (
                  <div
                    key={pkg._id}
                    className="flex items-center justify-between gap-2 rounded border border-border bg-bg-primary px-2 py-1.5"
                  >
                    <div className="min-w-0 flex items-center gap-1.5">
                      <span className="truncate text-xs text-text-primary">
                        {pkg.componentName || pkg.name}
                      </span>
                      {pkg.reviewStatus !== "approved" && (
                        <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded shrink-0">
                          {pkg.reviewStatus ?? "pending"}
                        </span>
                      )}
                    </div>
                    {alreadyMember ? (
                      <span className="text-[10px] text-text-secondary shrink-0">
                        Added
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(pkg._id as string)}
                        disabled={pendingPackageId !== null}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-button text-white hover:bg-button-hover transition-colors shrink-0 disabled:opacity-50"
                      >
                        Add
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
        <p className="mt-1 text-[10px] text-text-secondary">
          Only approved and visible components appear publicly. Others stay in
          the list but are hidden until approved.
        </p>
      </div>
    </div>
  );
}

// Auto-Refresh Settings Panel component
function AutoRefreshSettingsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRefreshApprovedConfirm, setShowRefreshApprovedConfirm] =
    useState(false);
  const [showRefreshAllConfirm, setShowRefreshAllConfirm] = useState(false);
  const [isRefreshingApproved, setIsRefreshingApproved] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const refreshSettings = useQuery(api.packages.getRefreshSettings);
  // Capture the timestamp once: an inline Date.now() changes the query args on
  // every render, forcing a resubscribe loop where useQuery never resolves,
  // which kept this whole panel stuck at its `return null` loading gate.
  const [statsNow] = useState(() => Date.now());
  const refreshStats = useQuery(api.packages.getRefreshStats, {
    now: statsNow,
  });
  const recentLogs = useQuery(api.packages.getRecentRefreshLogs);
  const updateRefreshSetting = useMutation(api.packages.updateRefreshSetting);
  const triggerRefreshApproved = useAction(
    api.packages.triggerManualRefreshAll,
  );
  const triggerRefreshAllPackages = useAction(
    api.packages.triggerManualRefreshAllPackages,
  );
  const backfillSkills = useMutation(api.seoContentDb.backfillAllSkillMd);
  const [isBackfillingSkills, setIsBackfillingSkills] = useState(false);

  // One-time backfill: build SKILL.md for approved packages missing one
  const handleBackfillSkills = async () => {
    if (isBackfillingSkills) return;
    setIsBackfillingSkills(true);
    try {
      await backfillSkills({});
      toast.success(
        "Skill backfill started. Approved components with generated content but no SKILL.md will be patched in the background.",
      );
    } catch (error) {
      toast.error("Failed to start skill backfill");
    } finally {
      setIsBackfillingSkills(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!refreshSettings) return;
    try {
      await updateRefreshSetting({
        key: "autoRefreshEnabled",
        value: !refreshSettings.autoRefreshEnabled,
      });
      toast.success(
        refreshSettings.autoRefreshEnabled
          ? "Auto-refresh disabled"
          : "Auto-refresh enabled",
      );
    } catch (error) {
      toast.error("Failed to update setting");
    }
  };

  const handleIntervalChange = async (days: number) => {
    try {
      await updateRefreshSetting({
        key: "refreshIntervalDays",
        value: days,
      });
      toast.success(`Refresh interval set to ${days} days`);
    } catch (error) {
      toast.error("Failed to update interval");
    }
  };

  // Refresh only approved packages
  const handleRefreshApproved = async () => {
    setShowRefreshApprovedConfirm(false);
    setIsRefreshingApproved(true);
    try {
      const result = await triggerRefreshApproved({});
      if (result.packagesQueued === 0) {
        toast.info("No approved packages to refresh");
      } else {
        toast.success(
          `Queued ${result.packagesQueued} approved packages for refresh`,
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start refresh",
      );
    } finally {
      setIsRefreshingApproved(false);
    }
  };

  // Refresh all packages regardless of status
  const handleRefreshAll = async () => {
    setShowRefreshAllConfirm(false);
    setIsRefreshingAll(true);
    try {
      const result = await triggerRefreshAllPackages({});
      if (result.packagesQueued === 0) {
        toast.info("No packages to refresh");
      } else {
        toast.success(`Queued ${result.packagesQueued} packages for refresh`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start refresh",
      );
    } finally {
      setIsRefreshingAll(false);
    }
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (!refreshSettings || !refreshStats) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lightning size={16} weight="bold" className="text-yellow-500" />
          <span className="text-sm font-medium text-text-primary">
            Auto-Refresh Settings
          </span>
          {refreshSettings.autoRefreshEnabled && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded">
              ON
            </span>
          )}
        </div>
        {isExpanded ? (
          <CaretUp size={16} className="text-text-secondary" />
        ) : (
          <CaretDown size={16} className="text-text-secondary" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-border space-y-4">
          {/* Info section */}
          <div className="p-3 rounded-lg bg-bg-hover text-xs text-text-secondary space-y-2">
            <p>
              Auto-refresh automatically updates npm package data (version,
              downloads, etc.) for approved packages on a schedule.
            </p>
            <p>
              The scheduler runs once per day (3:00 AM UTC), and the interval
              below controls which packages are considered stale.
            </p>
            <p>
              Only packages that haven't been refreshed within the interval will
              be updated. Maximum 100 packages per run.
            </p>
          </div>

          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Enable Auto-Refresh
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                Automatically refresh stale package data
              </p>
            </div>
            <button
              onClick={handleToggleEnabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                refreshSettings.autoRefreshEnabled
                  ? "bg-green-600"
                  : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  refreshSettings.autoRefreshEnabled
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Interval selector */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Refresh Interval
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                How often to refresh package data
              </p>
            </div>
            <select
              value={refreshSettings.refreshIntervalDays}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              className="px-3 py-1.5 text-sm rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-button"
            >
              <option value={3}>Every 3 days</option>
              <option value={5}>Every 5 days</option>
              <option value={7}>Every 7 days</option>
            </select>
          </div>

          {/* Stats section */}
          <div className="p-3 rounded-lg border border-border bg-white">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-text-secondary text-xs">Needs Refresh</p>
                <p className="font-medium text-text-primary">
                  {refreshStats.packagesNeedingRefresh} of{" "}
                  {refreshStats.totalPackages}
                </p>
              </div>
              <div>
                <p className="text-text-secondary text-xs">Last Run</p>
                <p className="font-medium text-text-primary">
                  {refreshStats.lastRefreshRun
                    ? formatRelativeTime(refreshStats.lastRefreshRun.runAt)
                    : "Never"}
                </p>
              </div>
            </div>
            {refreshStats.lastRefreshRun && (
              <div className="mt-2 pt-2 border-t border-border text-xs text-text-secondary">
                Last run: {refreshStats.lastRefreshRun.packagesSucceeded}{" "}
                succeeded
                {refreshStats.lastRefreshRun.packagesFailed > 0 && (
                  <span className="text-red-600">
                    , {refreshStats.lastRefreshRun.packagesFailed} failed
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Manual refresh buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Refresh All Packages button */}
            <button
              onClick={() => setShowRefreshAllConfirm(true)}
              disabled={isRefreshingAll || isRefreshingApproved}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-white text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowsClockwise
                size={16}
                className={isRefreshingAll ? "animate-spin" : ""}
              />
              {isRefreshingAll ? "Refreshing..." : "Refresh All Packages"}
            </button>
            {/* Refresh Approved Only button */}
            <button
              onClick={() => setShowRefreshApprovedConfirm(true)}
              disabled={isRefreshingApproved || isRefreshingAll}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-green-200 bg-white text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle
                size={16}
                weight="bold"
                className={isRefreshingApproved ? "animate-pulse" : ""}
              />
              {isRefreshingApproved ? "Refreshing..." : "Refresh Approved Only"}
            </button>
            {/* One-time SKILL.md backfill button */}
            <button
              onClick={handleBackfillSkills}
              disabled={isBackfillingSkills}
              title="Build SKILL.md for approved components that have generated content but no skill yet"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-white text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Robot
                size={16}
                weight="bold"
                className={isBackfillingSkills ? "animate-pulse" : ""}
              />
              {isBackfillingSkills ? "Starting..." : "Backfill Skills"}
            </button>
          </div>

          {/* Recent logs toggle */}
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            {showLogs ? <CaretDown size={12} /> : <CaretRight size={12} />}
            <ClockCounterClockwise size={12} />
            <span>Recent Refresh Logs ({recentLogs?.length || 0})</span>
          </button>

          {/* Recent logs list */}
          {showLogs && recentLogs && recentLogs.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {recentLogs.slice(0, 5).map((log) => (
                <div
                  key={log._id}
                  className="p-2 rounded-lg border border-border bg-white text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {log.status === "running" ? (
                        <ArrowsClockwise
                          size={12}
                          className="text-blue-500 animate-spin"
                        />
                      ) : log.packagesFailed > 0 ? (
                        <Warning size={12} className="text-yellow-500" />
                      ) : (
                        <CheckCircle size={12} className="text-green-500" />
                      )}
                      <span className="text-text-secondary">
                        {formatRelativeTime(log.runAt)}
                      </span>
                      {log.isManual && (
                        <span className="px-1 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded">
                          manual
                        </span>
                      )}
                    </div>
                    <span className="text-text-primary">
                      {log.packagesSucceeded}/{log.packagesProcessed}
                    </span>
                  </div>
                  {log.errors.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-border">
                      <p className="text-red-600">
                        Failed:{" "}
                        {log.errors.map((e) => e.packageName).join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Refresh All Packages Confirmation Modal */}
      <ConfirmModal
        isOpen={showRefreshAllConfirm}
        onClose={() => setShowRefreshAllConfirm(false)}
        onConfirm={handleRefreshAll}
        title="Refresh All Packages?"
        message="This will refresh npm data for ALL packages (pending, in review, approved, changes requested, rejected), regardless of status or when they were last updated. This may take several minutes."
        confirmText="Refresh All"
        cancelText="Cancel"
        type="warning"
      />

      {/* Refresh Approved Only Confirmation Modal */}
      <ConfirmModal
        isOpen={showRefreshApprovedConfirm}
        onClose={() => setShowRefreshApprovedConfirm(false)}
        onConfirm={handleRefreshApproved}
        title="Refresh Approved Packages?"
        message={`This will refresh npm data for ${refreshStats.totalPackages} approved packages only, regardless of when they were last updated. This may take several minutes.`}
        confirmText="Refresh Approved"
        cancelText="Cancel"
        type="warning"
      />
    </div>
  );
}

// Downloads display panel: controls whether Directory / ComponentDetail show
// weekly downloads, all-time downloads, or both side by side.
function DownloadsDisplaySettingsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const displaySettings = useQuery(api.packages.getDownloadsDisplaySettings);
  const updateSetting = useMutation(api.packages.updateAdminSetting);

  if (!displaySettings) return null;

  const handleToggle = async (
    key: "showWeeklyDownloads" | "showAllTimeDownloads",
    currentValue: boolean,
  ) => {
    try {
      await updateSetting({ key, value: !currentValue });
      toast.success("Downloads display updated");
    } catch {
      toast.error("Failed to update setting");
    }
  };

  const modeLabel =
    displaySettings.showWeeklyDownloads && displaySettings.showAllTimeDownloads
      ? "Both"
      : displaySettings.showAllTimeDownloads
        ? "All time"
        : displaySettings.showWeeklyDownloads
          ? "Weekly"
          : "Hidden";

  return (
    <div className="mb-4 rounded-lg border border-border bg-bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <DownloadSimple
            size={16}
            weight="bold"
            className="text-text-secondary"
          />
          <span className="text-sm font-medium text-text-primary">
            Downloads Display
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-bg-hover text-text-secondary rounded">
            {modeLabel}
          </span>
        </div>
        {isExpanded ? (
          <CaretUp size={16} className="text-text-secondary" />
        ) : (
          <CaretDown size={16} className="text-text-secondary" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-border space-y-4">
          <div className="p-3 rounded-lg bg-bg-hover text-xs text-text-secondary space-y-2">
            <p>
              Controls which download numbers appear on the public Directory and
              component detail pages.
            </p>
            <p>
              Turn both on to show weekly and all-time side by side. The
              Dashboard table always shows both columns regardless of these
              toggles.
            </p>
          </div>

          {/* Weekly downloads toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Show Weekly Downloads
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                Display downloads per week on public pages
              </p>
            </div>
            <button
              onClick={() =>
                handleToggle(
                  "showWeeklyDownloads",
                  displaySettings.showWeeklyDownloads,
                )
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                displaySettings.showWeeklyDownloads
                  ? "bg-green-600"
                  : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  displaySettings.showWeeklyDownloads
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* All-time downloads toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Show All-Time Downloads
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                Display total downloads since 2015 on public pages
              </p>
            </div>
            <button
              onClick={() =>
                handleToggle(
                  "showAllTimeDownloads",
                  displaySettings.showAllTimeDownloads,
                )
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                displaySettings.showAllTimeDownloads
                  ? "bg-green-600"
                  : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  displaySettings.showAllTimeDownloads
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {!displaySettings.showWeeklyDownloads &&
            !displaySettings.showAllTimeDownloads && (
              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                Both toggles are off, so no download numbers will appear on
                public pages.
              </p>
            )}
        </div>
      )}
    </div>
  );
}

// Submit listing defaults panel for public submissions page pagination
function SubmitListingSettingsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const submitListingSettings = useQuery(
    api.packages.getSubmitPageSizeAdminSetting,
  );
  const updateSubmitListingSettings = useMutation(
    api.packages.updateSubmitPageSizeSetting,
  );
  // Directory list-view thumbnail toggle lives here with other listing settings
  const adminSettings = useQuery(api.packages.getAdminSettings);
  const updateAdminSetting = useMutation(api.packages.updateAdminSetting);

  const handlePageSizeChange = async (value: 20 | 40 | 60) => {
    try {
      await updateSubmitListingSettings({ value });
      toast.success(`Default Submit page size set to ${value}`);
    } catch {
      toast.error("Failed to update Submit page size");
    }
  };

  const handleListThumbnailsToggle = async () => {
    if (!adminSettings) return;
    try {
      await updateAdminSetting({
        key: "showListViewThumbnails",
        value: !adminSettings.showListViewThumbnails,
      });
      toast.success("Setting updated");
    } catch {
      toast.error("Failed to update setting");
    }
  };

  if (!submitListingSettings) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <List size={16} weight="bold" className="text-text-secondary" />
          <span className="text-sm font-medium text-text-primary">
            Submit Listing Settings
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-bg-hover text-text-secondary rounded">
            {submitListingSettings.defaultPageSize} per page
          </span>
        </div>
        {isExpanded ? (
          <CaretUp size={16} className="text-text-secondary" />
        ) : (
          <CaretDown size={16} className="text-text-secondary" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-border space-y-4">
          <p className="text-xs text-text-secondary">
            Controls the default number of submissions shown per page on{" "}
            <code className="bg-bg-primary px-1 rounded">
              /components/submissions
            </code>
            .
          </p>
          <div className="flex flex-wrap gap-2">
            {([20, 40, 60] as const).map((option) => (
              <button
                key={option}
                onClick={() => handlePageSizeChange(option)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  submitListingSettings.defaultPageSize === option
                    ? "bg-button text-white border-button"
                    : "border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                {option} per page
              </button>
            ))}
          </div>

          {/* Show thumbnails in directory list view */}
          {adminSettings && (
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div>
                <label className="text-sm font-medium text-text-primary">
                  Show thumbnails in list view
                </label>
                <p className="text-xs text-text-secondary mt-0.5">
                  Global list-view-only override: shows thumbnails on directory
                  list rows even when per-category or per-component thumbnail
                  settings hide them. Grid view is unaffected.
                </p>
              </div>
              <button
                onClick={() => void handleListThumbnailsToggle()}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  adminSettings.showListViewThumbnails
                    ? "bg-green-600"
                    : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    adminSettings.showListViewThumbnails
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Security Scan Settings Panel
function SecurityScanSettingsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const settings = useQuery(api.packages.getAdminSettings);
  const updateSetting = useMutation(api.packages.updateAdminSetting);
  const updateNumericSetting = useMutation(
    api.packages.updateAdminSettingNumeric,
  );
  const backlogStats = useQuery(api.packages.getSecurityScanBacklogStats);
  const runBacklog = useMutation(api.packages.runSecurityScanBacklog);
  const [isQueueing, setIsQueueing] = useState(false);
  const [backlogBatchSize, setBacklogBatchSize] = useState(20);

  if (!settings) return null;

  const handleToggle = async (
    key: "enableSocketScan" | "enableSnykScan" | "autoSecurityScan",
    currentValue: boolean,
  ) => {
    try {
      await updateSetting({ key, value: !currentValue });
      toast.success("Setting updated");
    } catch (error) {
      toast.error("Failed to update setting");
    }
  };

  const handleScheduleChange = async (days: number) => {
    try {
      await updateNumericSetting({
        key: "securityScanScheduleDays",
        value: days,
      });
      toast.success("Schedule updated");
    } catch (error) {
      toast.error("Failed to update schedule");
    }
  };

  const anyProviderEnabled =
    settings.enableSocketScan || settings.enableSnykScan;

  return (
    <div className="bg-white rounded-lg border border-border overflow-hidden mb-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} weight="bold" className="text-green-600" />
          <span className="text-sm font-medium text-text-primary">
            Security Scan Settings
          </span>
        </div>
        {isExpanded ? (
          <CaretUp size={16} weight="bold" className="text-text-secondary" />
        ) : (
          <CaretDown size={16} weight="bold" className="text-text-secondary" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          <p className="text-xs text-text-secondary">
            Configure which security scan providers to use and when to run them.
            Each provider requires API credentials set in Convex environment
            variables.
          </p>

          {/* Provider toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Socket.dev
                </p>
                <p className="text-xs text-text-secondary">
                  Supply chain scanning. Requires SOCKET_API_KEY.
                </p>
              </div>
              <button
                onClick={() =>
                  handleToggle("enableSocketScan", settings.enableSocketScan)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.enableSocketScan ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.enableSocketScan
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">Snyk</p>
                <p className="text-xs text-text-secondary">
                  Vulnerability monitoring. Requires SNYK_TOKEN + SNYK_ORG_ID.
                </p>
              </div>
              <button
                onClick={() =>
                  handleToggle("enableSnykScan", settings.enableSnykScan)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.enableSnykScan ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.enableSnykScan ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Automation settings */}
          <div className="border-t border-border pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Auto scan on submission
                </p>
                <p className="text-xs text-text-secondary">
                  Automatically run security scan when a new package is
                  submitted.
                </p>
              </div>
              <button
                onClick={() =>
                  handleToggle("autoSecurityScan", settings.autoSecurityScan)
                }
                disabled={!anyProviderEnabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                  settings.autoSecurityScan ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.autoSecurityScan
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Scan schedule
                </p>
                <p className="text-xs text-text-secondary">
                  How often to re-scan packages with repository URLs.
                </p>
              </div>
              <select
                value={settings.securityScanScheduleDays}
                onChange={(e) => handleScheduleChange(Number(e.target.value))}
                disabled={!anyProviderEnabled}
                className="text-xs border border-border rounded px-2 py-1.5 bg-white text-text-primary disabled:opacity-50"
              >
                <option value={0}>Manual only</option>
                <option value={3}>Every 3 days</option>
                <option value={5}>Every 5 days</option>
                <option value={7}>Every 7 days</option>
              </select>
            </div>
          </div>

          {/* Backlog queue */}
          {anyProviderEnabled && backlogStats && (
            <div className="border-t border-border pt-3 space-y-3">
              <div>
                <p className="text-sm font-medium text-text-primary mb-2">
                  Security scan backlog
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {backlogStats.unscanned > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
                      {backlogStats.unscanned} unscanned
                    </span>
                  )}
                  {backlogStats.scanning > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                      {backlogStats.scanning} scanning
                    </span>
                  )}
                  {backlogStats.scanned > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded">
                      {backlogStats.scanned} scanned
                    </span>
                  )}
                  {backlogStats.errorCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded">
                      {backlogStats.errorCount} errors
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded">
                    {backlogStats.total} with repo
                  </span>
                </div>

                {backlogStats.unscanned > 0 || backlogStats.errorCount > 0 ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <select
                      value={backlogBatchSize}
                      onChange={(e) =>
                        setBacklogBatchSize(Number(e.target.value))
                      }
                      className="text-xs border border-border rounded px-2 py-1.5 bg-white text-text-primary"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <button
                      onClick={async () => {
                        setIsQueueing(true);
                        try {
                          const result = await runBacklog({
                            batchSize: backlogBatchSize,
                          });
                          toast.success(
                            `Queued ${result.queued} packages for security scanning`,
                          );
                        } catch {
                          toast.error("Failed to queue security scans");
                        } finally {
                          setIsQueueing(false);
                        }
                      }}
                      disabled={isQueueing}
                      className="px-3 py-1.5 text-xs font-medium rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors disabled:opacity-50"
                    >
                      {isQueueing
                        ? "Queueing..."
                        : `Scan next ${Math.min(backlogBatchSize, backlogStats.unscanned + backlogStats.errorCount)}`}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-green-600 flex items-center gap-2">
                    <CheckCircle size={14} />
                    All packages with repositories have been scanned.
                  </p>
                )}
              </div>
            </div>
          )}

          {!anyProviderEnabled && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-700">
                Enable at least one provider to use security scanning features.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Admin Settings Panel component
function AdminSettingsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const settings = useQuery(api.packages.getAdminSettings);
  const updateSetting = useMutation(api.packages.updateAdminSetting);

  const handleToggle = async (
    key:
      | "autoAiReview"
      | "autoApproveOnPass"
      | "autoRejectOnFail"
      | "autoGenerateSeoOnPendingOrInReview"
      | "autoGenerateThumbnailOnSubmit"
      | "rotateThumbnailTemplatesOnSubmit"
      | "showRelatedOnDetailPage"
      | "autoSendRejectionMessage"
      | "autoSendRejectionMessageToGithub"
      | "autoSendApprovalMessage"
      | "autoSendApprovalMessageToGithub"
      | "guestPreflightEnabled",
    currentValue: boolean,
  ) => {
    try {
      await updateSetting({ key, value: !currentValue });
      toast.success("Setting updated");
    } catch (error) {
      toast.error("Failed to update setting");
    }
  };

  if (!settings) return null;

  const outcomeAutomationDisabled = !settings.autoAiReview;

  return (
    <div className="mb-4 rounded-lg border border-border bg-bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Gear size={16} weight="bold" className="text-text-secondary" />
          <span className="text-sm font-medium text-text-primary">
            AI Review Settings
          </span>
        </div>
        {isExpanded ? (
          <CaretUp size={16} className="text-text-secondary" />
        ) : (
          <CaretDown size={16} className="text-text-secondary" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-border space-y-4">
          {/* Info section */}
          <div className="p-3 rounded-lg bg-bg-hover text-xs text-text-secondary space-y-3">
            <div>
              <p className="font-medium text-text-primary">
                How AI Review Works
              </p>
              <p className="mt-1">
                The AI analyzes the package&apos;s GitHub or GitLab repository against
                official{" "}
                <a
                  href="https://docs.convex.dev/components/authoring"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-button hover:underline"
                >
                  Convex component specifications
                </a>
                . The default review status is{" "}
                <code className="bg-bg-primary px-1 rounded">
                  {AI_REVIEW_PROMPT_STATUS_LABEL}
                </code>
                . It uses 8 critical pass criteria and 5 advisory notes. It
                first looks across the repo for the component source directory
                that uses{" "}
                <code className="bg-bg-primary px-1 rounded">
                  defineComponent()
                </code>{" "}
                so example apps using{" "}
                <code className="bg-bg-primary px-1 rounded">defineApp()</code>{" "}
                do not get reviewed as the component. AI review results update
                the AI review panel, and you can choose whether the final
                approval decision stays manual or auto-updates on pass or fail.
              </p>
            </div>

            <div>
              <p className="font-medium text-text-primary">Files Checked</p>
              <ul className="list-disc list-inside space-y-1 ml-1 mt-1">
                <li>
                  All discovered{" "}
                  <code className="bg-bg-primary px-1 rounded">
                    convex.config.ts
                  </code>{" "}
                  files are checked to find the one that uses{" "}
                  <code className="bg-bg-primary px-1 rounded">
                    defineComponent()
                  </code>
                </li>
                <li>
                  Component files in the selected source directory such as{" "}
                  <code className="bg-bg-primary px-1 rounded">
                    src/component/
                  </code>{" "}
                  , <code className="bg-bg-primary px-1 rounded">convex/</code>,
                  or a monorepo package directory
                </li>
                <li>
                  Consumer app configs that use{" "}
                  <code className="bg-bg-primary px-1 rounded">
                    defineApp()
                  </code>{" "}
                  are treated as examples, not the component source
                </li>
              </ul>
            </div>

            <div>
              <p className="font-medium text-text-primary">
                Critical pass criteria
              </p>
              <ul className="list-disc list-inside space-y-1 ml-1 mt-1">
                <li>
                  Has{" "}
                  <code className="bg-bg-primary px-1 rounded">
                    convex.config.ts
                  </code>{" "}
                  with{" "}
                  <code className="bg-bg-primary px-1 rounded">
                    defineComponent()
                  </code>
                </li>
                <li>Has component functions (queries, mutations, actions)</li>
                <li>
                  Component functions import builders from{" "}
                  <code className="bg-bg-primary px-1 rounded">
                    ./_generated/server
                  </code>
                </li>
                <li>
                  Functions use object style syntax:{" "}
                  <code className="bg-bg-primary px-1 rounded">
                    query({"{ args, returns, handler }"})
                  </code>
                </li>
                <li>
                  Public functions have explicit{" "}
                  <code className="bg-bg-primary px-1 rounded">args:</code>{" "}
                  validators
                </li>
                <li>
                  Uses{" "}
                  <code className="bg-bg-primary px-1 rounded">v.null()</code>{" "}
                  for void returns
                </li>
                <li>
                  Does not use{" "}
                  <code className="bg-bg-primary px-1 rounded">ctx.auth</code>{" "}
                  in component code
                </li>
                <li>
                  Cross-boundary visibility uses public versus internal
                  functions correctly
                </li>
              </ul>
            </div>

            <div>
              <p className="font-medium text-text-primary">Advisory notes</p>
              <ul className="list-disc list-inside space-y-1 ml-1 mt-1">
                <li>
                  Uses{" "}
                  <code className="bg-bg-primary px-1 rounded">
                    withIndex()
                  </code>{" "}
                  not{" "}
                  <code className="bg-bg-primary px-1 rounded">filter()</code>
                </li>
                <li>
                  Proper TypeScript types (
                  <code className="bg-bg-primary px-1 rounded">
                    Id&lt;"table"&gt;
                  </code>
                  )
                </li>
                <li>
                  Auth pattern when applicable (components cannot use ctx.auth,
                  so token-based or auth callback patterns are used)
                </li>
                <li>Package exports or client helpers look publish ready</li>
                <li>
                  Public functions have{" "}
                  <code className="bg-bg-primary px-1 rounded">returns:</code>{" "}
                  validators for type safety
                </li>
              </ul>
            </div>

            <div className="pt-2 border-t border-border/50">
              <p className="font-medium text-text-primary">
                Official Documentation
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                <a
                  href="https://docs.convex.dev/components/authoring"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-button hover:underline"
                >
                  Authoring
                </a>
                <a
                  href="https://docs.convex.dev/components/understanding"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-button hover:underline"
                >
                  Understanding
                </a>
                <a
                  href="https://docs.convex.dev/functions/validation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-button hover:underline"
                >
                  Validation
                </a>
                <a
                  href="https://docs.convex.dev/understanding/best-practices"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-button hover:underline"
                >
                  Best Practices
                </a>
              </div>
            </div>

            <div className="pt-2 border-t border-border/50">
              <p className="font-medium text-text-primary">
                Review Status Icons
              </p>
              <div className="flex flex-wrap gap-4 mt-1">
                <div className="flex items-center gap-1.5">
                  <CheckCircle
                    size={14}
                    weight="bold"
                    className="text-green-600"
                  />
                  <span>Passed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Warning
                    size={14}
                    weight="bold"
                    className="text-yellow-600"
                  />
                  <span>Partial</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <XCircle size={14} weight="bold" className="text-red-600" />
                  <span>Failed/Error</span>
                </div>
              </div>
            </div>
          </div>

          {/* Auto AI review toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Auto AI review
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                Automatically queue AI review for submissions with a repository
                URL, move them into In Review, and queue current pending
                submissions when this is turned on. Default is off.
              </p>
            </div>
            <button
              onClick={() =>
                handleToggle("autoAiReview", settings.autoAiReview)
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.autoAiReview ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.autoAiReview ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Auto-approve on pass */}
          <div
            className={`flex items-center justify-between ${
              outcomeAutomationDisabled ? "opacity-60" : ""
            }`}
          >
            <div>
              <label className="text-sm font-medium text-text-primary">
                Auto-approve on pass
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                Optional. After Auto AI review runs, automatically approve when
                all critical checks pass.
              </p>
            </div>
            <button
              disabled={outcomeAutomationDisabled}
              onClick={() =>
                handleToggle("autoApproveOnPass", settings.autoApproveOnPass)
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.autoApproveOnPass ? "bg-green-600" : "bg-gray-300"
              } ${outcomeAutomationDisabled ? "cursor-not-allowed" : ""}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.autoApproveOnPass ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Auto-reject on fail */}
          <div
            className={`flex items-center justify-between ${
              outcomeAutomationDisabled ? "opacity-60" : ""
            }`}
          >
            <div>
              <label className="text-sm font-medium text-text-primary">
                Auto-reject on fail
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                Optional. After Auto AI review runs, automatically reject when
                critical checks fail.
              </p>
            </div>
            <button
              disabled={outcomeAutomationDisabled}
              onClick={() =>
                handleToggle("autoRejectOnFail", settings.autoRejectOnFail)
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.autoRejectOnFail ? "bg-red-600" : "bg-gray-300"
              } ${outcomeAutomationDisabled ? "cursor-not-allowed" : ""}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.autoRejectOnFail ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Guest preflight kill switch */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Allow guest preflight checks
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                Signed out visitors can run the Component Preflight Check at 3
                per hour per network, capped at 30 guest runs per hour site
                wide. Turn off to require sign in. Default is on.
              </p>
            </div>
            <button
              onClick={() =>
                handleToggle(
                  "guestPreflightEnabled",
                  settings.guestPreflightEnabled,
                )
              }
              aria-pressed={settings.guestPreflightEnabled}
              aria-label="Allow guest preflight checks"
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                settings.guestPreflightEnabled ? "bg-green-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.guestPreflightEnabled
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Review messages: drafts are always created, sending is opt in */}
          <div className="rounded-lg border border-border p-3 space-y-4">
            <div>
              <p className="text-sm font-medium text-text-primary">
                Review messages
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                A rejection draft is written from every failed AI review and an
                approval draft on every approval. Drafts wait in User Messages
                for you to edit and send. Turn these on to send them the moment
                the status changes, whether an admin or an auto setting changed
                it.
              </p>
            </div>
            {(
              [
                {
                  key: "autoSendRejectionMessage",
                  githubKey: "autoSendRejectionMessageToGithub",
                  label: "Auto-send rejection message",
                  help: "Sends the rejection draft when a component moves to Rejected.",
                  onColor: "bg-red-600",
                },
                {
                  key: "autoSendApprovalMessage",
                  githubKey: "autoSendApprovalMessageToGithub",
                  label: "Auto-send approval message",
                  help: "Sends the approval draft when a component moves to Approved.",
                  onColor: "bg-green-600",
                },
              ] as const
            ).map((row) => {
              const enabled = settings[row.key];
              const toGithub = settings[row.githubKey];
              return (
                <div key={row.key}>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-text-primary">
                        {row.label}
                      </label>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {row.help}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggle(row.key, enabled)}
                      aria-pressed={enabled}
                      aria-label={row.label}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                        enabled ? row.onColor : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  <label
                    className={`mt-2 ml-1 flex items-start gap-2 select-none ${
                      enabled ? "cursor-pointer" : "opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={toGithub}
                      disabled={!enabled}
                      onChange={() => handleToggle(row.githubKey, toGithub)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-button"
                    />
                    <span className="text-xs text-text-secondary leading-snug">
                      <span className="inline-flex items-center gap-1 text-text-primary">
                        <GithubLogo size={12} />
                        Also post to GitHub
                      </span>
                      <span className="block text-[11px] text-text-secondary/80">
                        Opens an issue on the submitter&apos;s repo, or replies on
                        the open one. GitHub repos only.
                      </span>
                    </span>
                  </label>
                </div>
              );
            })}
          </div>

          {/* Auto-generate SEO on pending/in_review */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Auto-generate AI SEO on pending or in review
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                Automatically generate AI SEO content when review status changes
                to pending or in_review
              </p>
            </div>
            <button
              onClick={() =>
                handleToggle(
                  "autoGenerateSeoOnPendingOrInReview",
                  settings.autoGenerateSeoOnPendingOrInReview,
                )
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.autoGenerateSeoOnPendingOrInReview
                  ? "bg-blue-600"
                  : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.autoGenerateSeoOnPendingOrInReview
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Auto-generate thumbnail on submit */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Auto-generate thumbnail on submit
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                Automatically compose a thumbnail from the uploaded logo and
                default template only when the submission includes a logo.
                Submissions without a logo are skipped.
              </p>
            </div>
            <button
              onClick={() =>
                handleToggle(
                  "autoGenerateThumbnailOnSubmit",
                  settings.autoGenerateThumbnailOnSubmit,
                )
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.autoGenerateThumbnailOnSubmit
                  ? "bg-blue-600"
                  : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.autoGenerateThumbnailOnSubmit
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Rotate templates on submit */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Rotate active templates on submit
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                If enabled, auto-generated thumbnails rotate across active
                templates instead of always using the default template
              </p>
            </div>
            <button
              onClick={() =>
                handleToggle(
                  "rotateThumbnailTemplatesOnSubmit",
                  settings.rotateThumbnailTemplatesOnSubmit,
                )
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.rotateThumbnailTemplatesOnSubmit
                  ? "bg-blue-600"
                  : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.rotateThumbnailTemplatesOnSubmit
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Show related components on detail page */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Show related components on detail page
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                Display up to 3 related components below the llms.txt link on
                component detail pages
              </p>
            </div>
            <button
              onClick={() =>
                handleToggle(
                  "showRelatedOnDetailPage",
                  settings.showRelatedOnDetailPage,
                )
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.showRelatedOnDetailPage
                  ? "bg-green-600"
                  : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.showRelatedOnDetailPage
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Reward Settings Panel component (Tremendous integration)
function RewardSettingsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [defaultAmount, setDefaultAmount] = useState<string>("25");
  const [isSaving, setIsSaving] = useState(false);
  const [showTestRewardConfirm, setShowTestRewardConfirm] = useState(false);
  const [testRewardAmount, setTestRewardAmount] = useState<string>("25");
  const [testRewardNote, setTestRewardNote] = useState("");
  const [isSendingTestReward, setIsSendingTestReward] = useState(false);

  const settings = useQuery(api.packages.getAdminSettings);
  const paymentStats = useQuery(api.paymentsDb.getPaymentStats);
  const updateBoolSetting = useMutation(api.packages.updateAdminSetting);
  const updateNumericSetting = useMutation(
    api.packages.updateAdminSettingNumeric,
  );
  const sendTestReward = useAction(api.payments.sendTestReward);

  useEffect(() => {
    if (settings?.defaultRewardAmount) {
      setDefaultAmount(String(settings.defaultRewardAmount));
      setTestRewardAmount(String(settings.defaultRewardAmount));
    }
  }, [settings?.defaultRewardAmount]);

  // ESC closes the test reward confirmation unless a send is in flight.
  useEffect(() => {
    if (!showTestRewardConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSendingTestReward) {
        setShowTestRewardConfirm(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showTestRewardConfirm, isSendingTestReward]);

  const handleToggleAutoSend = async () => {
    try {
      await updateBoolSetting({
        key: "autoSendRewardOnApprove",
        value: !settings?.autoSendRewardOnApprove,
      });
      toast.success("Auto-send reward setting updated");
    } catch (error) {
      toast.error("Failed to update setting");
    }
  };

  const handleSaveDefaultAmount = async () => {
    const amount = parseFloat(defaultAmount);
    if (isNaN(amount) || amount < 1) {
      toast.error("Please enter a valid amount ($1 minimum)");
      return;
    }
    setIsSaving(true);
    try {
      await updateNumericSetting({
        key: "defaultRewardAmount",
        value: amount,
      });
      toast.success("Default reward amount saved");
    } catch (error) {
      toast.error("Failed to save amount");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestReward = async () => {
    const amount = parseFloat(testRewardAmount);
    if (isNaN(amount) || amount < 1) {
      toast.error("Please enter a valid test amount ($1 minimum)");
      return;
    }

    setIsSendingTestReward(true);
    try {
      const result = await sendTestReward({
        amount,
        sentBy: "admin-settings",
        note: testRewardNote || undefined,
      });

      if (result.success) {
        toast.success("Test reward sent and recorded");
        setShowTestRewardConfirm(false);
        setTestRewardNote("");
      } else {
        toast.error(result.error || "Failed to send test reward");
      }
    } catch (error) {
      toast.error("Failed to send test reward");
    } finally {
      setIsSendingTestReward(false);
    }
  };

  if (!settings) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <CurrencyCircleDollar
            size={16}
            weight="bold"
            className="text-text-secondary"
          />
          <span className="text-sm font-medium text-text-primary">
            Reward Settings (Tremendous)
          </span>
        </div>
        {isExpanded ? (
          <CaretUp size={16} className="text-text-secondary" />
        ) : (
          <CaretDown size={16} className="text-text-secondary" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-border space-y-4">
          {/* Info section */}
          <div className="p-3 rounded-lg bg-bg-hover text-xs text-text-secondary space-y-2">
            <p className="font-medium text-text-primary">How Rewards Work</p>
            <p>
              When enabled, rewards are automatically sent to submitters via
              Tremendous when their package is approved and visible. Submitters
              receive a gift card link via email.
            </p>
            <p className="text-yellow-600">
              Environment variables required: TREMENDOUS_API_KEY,
              TREMENDOUS_CAMPAIGN_ID, TREMENDOUS_FUNDING_SOURCE_ID
            </p>
            <p>
              Test rewards send to the fixed env email set in{" "}
              <code className="bg-bg-primary px-1 rounded">
                TREMENDOUS_TEST_RECIPIENT_EMAIL
              </code>{" "}
              and are recorded as test payments without updating any component
              reward state.
            </p>
          </div>

          {/* Auto-send toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Auto-send reward on approve
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                Automatically send reward when a package becomes approved and
                visible
              </p>
            </div>
            <button
              onClick={handleToggleAutoSend}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.autoSendRewardOnApprove
                  ? "bg-green-600"
                  : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.autoSendRewardOnApprove
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Default reward amount */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Default reward amount
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                Amount in USD for automatic rewards
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-secondary">$</span>
              <input
                type="number"
                min="1"
                step="5"
                value={defaultAmount}
                onChange={(e) => setDefaultAmount(e.target.value)}
                className="w-20 px-2 py-1 text-sm border border-border rounded bg-bg-primary text-text-primary focus:outline-none focus:ring-1 focus:ring-button"
              />
              <button
                onClick={handleSaveDefaultAmount}
                disabled={isSaving}
                className="px-3 py-1 text-xs bg-button text-white rounded hover:bg-button-hover disabled:opacity-50 transition-colors"
              >
                {isSaving ? "..." : "Save"}
              </button>
            </div>
          </div>

          {/* Test reward action */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Send test reward
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                Sends to the fixed Tremendous test recipient email from env and
                records a test payment only
              </p>
            </div>
            <button
              onClick={() => {
                setTestRewardAmount(defaultAmount || "25");
                setShowTestRewardConfirm(true);
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              Send Test Reward
            </button>
          </div>

          {/* Payment stats */}
          {paymentStats && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-medium text-text-primary mb-2">
                Payment Statistics
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg border border-border p-2 bg-bg-primary">
                  <p className="text-xs text-text-secondary">Total Sent</p>
                  <p className="text-lg font-light text-emerald-600">
                    ${paymentStats.totalAmountSent}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-2 bg-bg-primary">
                  <p className="text-xs text-text-secondary">Successful</p>
                  <p className="text-lg font-light text-emerald-600">
                    {paymentStats.sentCount + paymentStats.deliveredCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-2 bg-bg-primary">
                  <p className="text-xs text-text-secondary">Pending</p>
                  <p className="text-lg font-light text-yellow-600">
                    {paymentStats.pendingCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-2 bg-bg-primary">
                  <p className="text-xs text-text-secondary">Failed</p>
                  <p className="text-lg font-light text-red-600">
                    {paymentStats.failedCount}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showTestRewardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() =>
              !isSendingTestReward && setShowTestRewardConfirm(false)
            }
          />
          <div className="relative w-full max-w-md p-6 rounded-container bg-white border border-border shadow-lg">
            <div className="flex items-start gap-3 mb-4">
              <div className="shrink-0 text-emerald-600">
                <CurrencyCircleDollar size={24} weight="bold" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-normal text-text-primary">
                  Send Test Reward
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  This sends to the fixed env test recipient configured in
                  Convex and records the payment as a test only.
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
                    $
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={testRewardAmount}
                    onChange={(e) => setTestRewardAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-button/50"
                    placeholder="25"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Message to recipient (optional)
                </label>
                <textarea
                  value={testRewardNote}
                  onChange={(e) => setTestRewardNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-button/50 resize-none"
                  placeholder="Sandbox or production verification test"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowTestRewardConfirm(false);
                  setTestRewardNote("");
                }}
                disabled={isSendingTestReward}
                className="px-4 py-2 rounded-full text-sm font-normal border border-border text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTestReward}
                disabled={
                  isSendingTestReward ||
                  !testRewardAmount ||
                  parseFloat(testRewardAmount) <= 0
                }
                className="px-4 py-2 rounded-full text-sm font-normal bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSendingTestReward ? (
                  <>
                    <ArrowsClockwise size={14} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <CurrencyCircleDollar size={14} weight="bold" />
                    Send Test ${testRewardAmount || "0"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// AI Provider Settings Panel component
function AiProviderSettingsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [clearConfirmProvider, setClearConfirmProvider] = useState<
    "anthropic" | "openai" | "gemini" | null
  >(null);

  // Local state for form inputs
  const [anthropicKey, setAnthropicKey] = useState("");
  const [anthropicModel, setAnthropicModel] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("");
  const [activeProvider, setActiveProvider] = useState<
    "anthropic" | "openai" | "gemini" | "env"
  >("env");

  const providerSettings = useQuery(api.aiSettings.getAiProviderSettings);
  const updateProvider = useMutation(api.aiSettings.updateAiProviderSettings);
  const clearProvider = useMutation(api.aiSettings.clearProviderSettings);

  // Sync form state when settings load
  useEffect(() => {
    if (providerSettings) {
      setAnthropicModel(providerSettings.anthropic.model || "");
      setOpenaiModel(providerSettings.openai.model || "");
      setGeminiModel(providerSettings.gemini.model || "");

      if (providerSettings.activeProvider) {
        setActiveProvider(providerSettings.activeProvider);
      } else {
        setActiveProvider("env");
      }
    }
  }, [providerSettings]);

  const handleSaveProvider = async (
    provider: "anthropic" | "openai" | "gemini",
  ) => {
    setIsSaving(true);
    try {
      const key =
        provider === "anthropic"
          ? anthropicKey
          : provider === "openai"
            ? openaiKey
            : geminiKey;
      const model =
        provider === "anthropic"
          ? anthropicModel
          : provider === "openai"
            ? openaiModel
            : geminiModel;

      if (!model) {
        toast.error("Model is required when setting an API key");
        return;
      }

      await updateProvider({
        provider,
        apiKey: key || undefined,
        model,
        isEnabled: activeProvider === provider,
      });

      toast.success(`${provider} settings saved`);

      // Clear the key input after save (for security)
      if (provider === "anthropic") setAnthropicKey("");
      if (provider === "openai") setOpenaiKey("");
      if (provider === "gemini") setGeminiKey("");
    } catch (error) {
      toast.error("Failed to save provider settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearProvider = async (
    provider: "anthropic" | "openai" | "gemini",
  ) => {
    try {
      await clearProvider({ provider });
      toast.success(`${provider} settings cleared (using env var)`);
      setClearConfirmProvider(null);
    } catch (error) {
      toast.error("Failed to clear settings");
    }
  };

  const handleSetActive = async (
    provider: "anthropic" | "openai" | "gemini" | "env",
  ) => {
    setActiveProvider(provider);

    if (provider === "env") {
      // Disable all custom providers
      const providers = ["anthropic", "openai", "gemini"] as const;
      for (const p of providers) {
        if (providerSettings?.[p]?.model) {
          await updateProvider({
            provider: p,
            model: providerSettings[p].model,
            isEnabled: false,
          });
        }
      }
      toast.success("Using environment variables for AI");
    } else {
      // Enable selected provider
      const model =
        provider === "anthropic"
          ? anthropicModel
          : provider === "openai"
            ? openaiModel
            : geminiModel;

      if (!model) {
        toast.error("Configure model before enabling this provider");
        setActiveProvider("env");
        return;
      }

      await updateProvider({
        provider,
        model,
        isEnabled: true,
      });
      toast.success(`${provider} is now active`);
    }
  };

  if (!providerSettings) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Gear size={16} weight="bold" className="text-text-secondary" />
          <span className="text-sm font-medium text-text-primary">
            AI Provider Settings
          </span>
          {providerSettings.activeProvider && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              {providerSettings.activeProvider}
            </span>
          )}
        </div>
        {isExpanded ? (
          <CaretUp size={16} className="text-text-secondary" />
        ) : (
          <CaretDown size={16} className="text-text-secondary" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-border space-y-4">
          <div className="p-3 rounded-lg bg-bg-hover text-xs text-text-secondary">
            <p>
              Configure AI providers for component reviews. By default,
              environment variables (ANTHROPIC_API_KEY, CONVEX_OPENAI_API_KEY)
              are used. Settings here override environment variables.
            </p>
          </div>

          {/* Active provider selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-text-secondary">Active:</span>
            {(["env", "anthropic", "openai", "gemini"] as const).map((p) => (
              <button
                key={p}
                onClick={() => handleSetActive(p)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  activeProvider === p
                    ? "bg-button text-white border-button"
                    : "border-border text-text-secondary hover:bg-bg-hover"
                }`}
              >
                {p === "env" ? "Env Vars (Default)" : p}
              </button>
            ))}
          </div>

          {/* Anthropic */}
          <div className="p-3 rounded-lg border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">
                Anthropic (Claude)
              </span>
              <a
                href="https://platform.claude.com/docs/en/about-claude/models/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-button hover:underline"
              >
                Model docs
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="password"
                placeholder="API Key (leave empty to keep existing)"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                className="px-2 py-1.5 text-xs rounded border border-border bg-bg-primary text-text-primary"
              />
              <input
                type="text"
                placeholder="Model (e.g. claude-opus-4-5-20251101)"
                value={anthropicModel}
                onChange={(e) => setAnthropicModel(e.target.value)}
                className="px-2 py-1.5 text-xs rounded border border-border bg-bg-primary text-text-primary"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveProvider("anthropic")}
                disabled={isSaving}
                className="px-3 py-1 text-xs rounded bg-button text-white hover:bg-button-hover disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setClearConfirmProvider("anthropic")}
                className="px-3 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50"
              >
                Clear (use env)
              </button>
            </div>
            {providerSettings.anthropic.apiKey && (
              <p className="text-xs text-green-600">API key configured</p>
            )}
          </div>

          {/* OpenAI */}
          <div className="p-3 rounded-lg border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">
                OpenAI
              </span>
              <a
                href="https://platform.openai.com/docs/models"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-button hover:underline"
              >
                Model docs
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="password"
                placeholder="API Key (leave empty to keep existing)"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="px-2 py-1.5 text-xs rounded border border-border bg-bg-primary text-text-primary"
              />
              <input
                type="text"
                placeholder="Model (e.g. gpt-4o)"
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
                className="px-2 py-1.5 text-xs rounded border border-border bg-bg-primary text-text-primary"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveProvider("openai")}
                disabled={isSaving}
                className="px-3 py-1 text-xs rounded bg-button text-white hover:bg-button-hover disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setClearConfirmProvider("openai")}
                className="px-3 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50"
              >
                Clear (use env)
              </button>
            </div>
            {providerSettings.openai.apiKey && (
              <p className="text-xs text-green-600">API key configured</p>
            )}
          </div>

          {/* Gemini */}
          <div className="p-3 rounded-lg border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">
                Google Gemini
              </span>
              <a
                href="https://ai.google.dev/gemini-api/docs/models"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-button hover:underline"
              >
                Model docs
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="password"
                placeholder="API Key (leave empty to keep existing)"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="px-2 py-1.5 text-xs rounded border border-border bg-bg-primary text-text-primary"
              />
              <input
                type="text"
                placeholder="Model (e.g. gemini-1.5-pro)"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="px-2 py-1.5 text-xs rounded border border-border bg-bg-primary text-text-primary"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveProvider("gemini")}
                disabled={isSaving}
                className="px-3 py-1 text-xs rounded bg-button text-white hover:bg-button-hover disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setClearConfirmProvider("gemini")}
                className="px-3 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50"
              >
                Clear (use env)
              </button>
            </div>
            {providerSettings.gemini.apiKey && (
              <p className="text-xs text-green-600">API key configured</p>
            )}
          </div>
        </div>
      )}

      {/* Clear Provider Confirmation Modal */}
      <ConfirmModal
        isOpen={clearConfirmProvider !== null}
        onClose={() => setClearConfirmProvider(null)}
        onConfirm={() =>
          clearConfirmProvider && handleClearProvider(clearConfirmProvider)
        }
        title="Clear API Key Settings?"
        message={`This will permanently delete your saved ${clearConfirmProvider?.toUpperCase()} API key and model configuration. The app will fall back to using environment variables (ANTHROPIC_API_KEY, CONVEX_OPENAI_API_KEY). This affects ALL AI features including AI Review and SEO Content generation.`}
        confirmText="Yes, Clear Settings"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}

// AI Prompt Settings Panel component
function AiPromptSettingsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const activePrompt = useQuery(api.aiSettings.getActivePrompt);
  const defaultPrompt = useQuery(api.aiSettings.getDefaultPrompt);
  const promptVersions = useQuery(api.aiSettings.getPromptVersions);
  const savePrompt = useMutation(api.aiSettings.savePromptVersion);
  const activateVersion = useMutation(api.aiSettings.activatePromptVersion);
  const resetToDefault = useMutation(api.aiSettings.resetToDefaultPrompt);

  useEffect(() => {
    if (activePrompt && !isEditing) {
      setEditedPrompt(activePrompt.content);
    }
  }, [activePrompt, isEditing]);

  const handleStartEditing = () => {
    setEditedPrompt(activePrompt?.content || defaultPrompt?.content || "");
    setIsEditing(true);
  };

  const handleSavePrompt = async () => {
    if (!editedPrompt.trim()) {
      toast.error("Prompt cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      await savePrompt({
        content: editedPrompt,
        notes: notes || undefined,
      });
      toast.success("Prompt saved");
      setIsEditing(false);
      setNotes("");
    } catch (error) {
      toast.error("Failed to save prompt");
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivateVersion = async (versionId: string) => {
    try {
      await activateVersion({
        versionId: versionId as any,
      });
      toast.success("Prompt version activated");
    } catch (error) {
      toast.error("Failed to activate version");
    }
  };

  const handleResetToDefault = async () => {
    try {
      await resetToDefault({});
      toast.success("Reset to default prompt");
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to reset");
    }
  };

  if (!activePrompt) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChatText size={16} weight="bold" className="text-text-secondary" />
          <span className="text-sm font-medium text-text-primary">
            AI Review Prompt
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-bg-hover text-text-secondary">
            {activePrompt.version}
          </span>
          {!activePrompt.isDefault && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              Custom
            </span>
          )}
        </div>
        {isExpanded ? (
          <CaretUp size={16} className="text-text-secondary" />
        ) : (
          <CaretDown size={16} className="text-text-secondary" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-border space-y-4">
          <div className="p-3 rounded-lg bg-bg-hover text-xs text-text-secondary">
            <p>
              View and customize the AI review prompt. The default prompt
              analyzes components against Convex component specifications.
              Current default status:{" "}
              <span className="font-medium text-text-primary">
                {activePrompt.statusLabel}
              </span>
              . Custom prompts are versioned for history tracking.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isEditing ? (
              <>
                <button
                  onClick={handleStartEditing}
                  className="px-3 py-1.5 text-xs rounded bg-button text-white hover:bg-button-hover"
                >
                  Edit Prompt
                </button>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="px-3 py-1.5 text-xs rounded border border-border text-text-secondary hover:bg-bg-hover"
                >
                  {showHistory ? "Hide History" : "Version History"}
                </button>
                {!activePrompt.isDefault && (
                  <button
                    onClick={handleResetToDefault}
                    className="px-3 py-1.5 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50"
                  >
                    Reset to Default
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={handleSavePrompt}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save New Version"}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs rounded border border-border text-text-secondary hover:bg-bg-hover"
                >
                  Cancel
                </button>
              </>
            )}
          </div>

          {/* Current prompt display or editor */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                rows={20}
                className="w-full px-3 py-2 text-xs font-mono rounded border border-border bg-bg-primary text-text-primary resize-y"
                placeholder="Enter your custom prompt..."
              />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Change notes (optional)"
                className="w-full px-3 py-2 text-xs rounded border border-border bg-bg-primary text-text-primary"
              />
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-border bg-bg-primary">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs text-text-secondary">
                    {activePrompt.isDefault
                      ? "Default Prompt"
                      : "Custom Prompt"}
                  </div>
                  <div className="text-xs text-text-secondary mt-1">
                    {activePrompt.statusLabel}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-text-secondary">
                    Prompt updated: {activePrompt.promptUpdatedAt}
                  </div>
                  {activePrompt.createdAt && (
                    <div className="text-xs text-text-secondary mt-1">
                      Last updated:{" "}
                      {new Date(activePrompt.createdAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <pre className="text-xs font-mono text-text-primary whitespace-pre-wrap max-h-64 overflow-y-auto">
                {activePrompt.content}
              </pre>
            </div>
          )}

          {/* Version history */}
          {showHistory && promptVersions && promptVersions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-text-primary">
                Version History
              </h4>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {promptVersions.map((version) => (
                  <div
                    key={version._id}
                    className={`p-2 rounded border ${
                      version.isActive
                        ? "border-green-300 bg-green-50"
                        : "border-border bg-bg-primary"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary">
                          {new Date(version.createdAt).toLocaleString()}
                        </span>
                        {version.isDefault && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            Default
                          </span>
                        )}
                        {version.isActive && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                            Active
                          </span>
                        )}
                      </div>
                      {!version.isActive && (
                        <button
                          onClick={() => handleActivateVersion(version._id)}
                          className="text-xs text-button hover:underline"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                    {version.notes && (
                      <p className="text-xs text-text-secondary mt-1">
                        {version.notes}
                      </p>
                    )}
                    <p className="text-xs text-text-secondary mt-1 truncate">
                      {version.content.substring(0, 100)}...
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// SEO/SKILL.md Prompt Settings Panel component
function SeoPromptSettingsPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const activePrompt = useQuery(api.aiSettings.getSeoActivePrompt);
  const defaultPrompt = useQuery(api.aiSettings.getSeoDefaultPrompt);
  const promptVersions = useQuery(api.aiSettings.getSeoPromptVersions);
  const savePrompt = useMutation(api.aiSettings.saveSeoPromptVersion);
  const activateVersion = useMutation(api.aiSettings.activateSeoPromptVersion);
  const resetToDefault = useMutation(api.aiSettings.resetSeoToDefaultPrompt);

  useEffect(() => {
    if (activePrompt && !isEditing) {
      setEditedPrompt(activePrompt.content);
    }
  }, [activePrompt, isEditing]);

  const handleStartEditing = () => {
    setEditedPrompt(activePrompt?.content || defaultPrompt || "");
    setIsEditing(true);
  };

  const handleSavePrompt = async () => {
    if (!editedPrompt.trim()) {
      toast.error("Prompt cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      await savePrompt({
        content: editedPrompt,
        notes: notes || undefined,
      });
      toast.success("Content prompt saved");
      setIsEditing(false);
      setNotes("");
    } catch (error) {
      toast.error("Failed to save content prompt");
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivateVersion = async (versionId: string) => {
    try {
      await activateVersion({
        versionId: versionId as any,
      });
      toast.success("SEO prompt version activated");
    } catch (error) {
      toast.error("Failed to activate version");
    }
  };

  const handleResetToDefault = async () => {
    try {
      await resetToDefault({});
      toast.success("Reset to default SEO prompt");
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to reset");
    }
  };

  if (!activePrompt) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Robot size={16} weight="bold" className="text-text-secondary" />
          <span className="text-sm font-medium text-text-primary">
            Component Directory Content Prompt
          </span>
          {!activePrompt.isDefault && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              Custom
            </span>
          )}
        </div>
        {isExpanded ? (
          <CaretUp size={16} className="text-text-secondary" />
        ) : (
          <CaretDown size={16} className="text-text-secondary" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-border space-y-4">
          <div className="p-3 rounded-lg bg-bg-hover text-xs text-text-secondary space-y-2">
            <p>
              This prompt controls how AI generates component directory content
              (description, use cases, how it works) and SKILL.md. The same
              prompt is used by the admin Generate Content button, the
              submission form, and the profile edit flow. Generation reads the
              repository README (GitHub or GitLab) as the primary source, uses the component name and
              short description as secondary context, and grounds Convex
              terminology against `llms.txt`.
            </p>
            <p className="text-text-tertiary">
              <strong>SKILL.md:</strong> Generated skills follow Anthropic skill
              creator guidelines with trigger context from category, tags, and
              use cases. Custom edits override the default prompt for all three
              surfaces.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isEditing ? (
              <>
                <button
                  onClick={handleStartEditing}
                  className="px-3 py-1.5 text-xs rounded bg-button text-white hover:bg-button-hover"
                >
                  Edit Prompt
                </button>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="px-3 py-1.5 text-xs rounded border border-border text-text-secondary hover:bg-bg-hover"
                >
                  {showHistory ? "Hide History" : "Version History"}
                </button>
                {!activePrompt.isDefault && (
                  <button
                    onClick={handleResetToDefault}
                    className="px-3 py-1.5 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50"
                  >
                    Reset to Default
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={handleSavePrompt}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save New Version"}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs rounded border border-border text-text-secondary hover:bg-bg-hover"
                >
                  Cancel
                </button>
              </>
            )}
          </div>

          {/* Placeholder Reference */}
          <div className="p-2 rounded border border-border bg-bg-primary">
            <p className="text-xs font-medium text-text-primary mb-1">
              Available Placeholders:
            </p>
            <p className="text-xs text-text-secondary font-mono">
              {CONTENT_PROMPT_PLACEHOLDERS.join(" ")}
            </p>
          </div>

          {/* Current prompt display or editor */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                rows={20}
                className="w-full px-3 py-2 text-xs font-mono rounded border border-border bg-bg-primary text-text-primary resize-y"
                placeholder="Enter your custom component directory content prompt..."
              />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Change notes (optional)"
                className="w-full px-3 py-2 text-xs rounded border border-border bg-bg-primary text-text-primary"
              />
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-border bg-bg-primary">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-secondary">
                  {activePrompt.isDefault ? "Default Prompt" : "Custom Prompt"}
                </span>
                {activePrompt.createdAt && (
                  <span className="text-xs text-text-secondary">
                    Last updated:{" "}
                    {new Date(activePrompt.createdAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <pre className="text-xs font-mono text-text-primary whitespace-pre-wrap max-h-64 overflow-y-auto">
                {activePrompt.content}
              </pre>
            </div>
          )}

          {/* Version history */}
          {showHistory && promptVersions && promptVersions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-text-primary">
                Version History
              </h4>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {promptVersions.map((version) => (
                  <div
                    key={version._id}
                    className={`p-2 rounded border ${
                      version.isActive
                        ? "border-green-300 bg-green-50"
                        : "border-border bg-bg-primary"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary">
                          {new Date(version.createdAt).toLocaleString()}
                        </span>
                        {version.isDefault && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            Default
                          </span>
                        )}
                        {version.isActive && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                            Active
                          </span>
                        )}
                      </div>
                      {!version.isActive && (
                        <button
                          onClick={() => handleActivateVersion(version._id)}
                          className="text-xs text-button hover:underline"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                    {version.notes && (
                      <p className="text-xs text-text-secondary mt-1">
                        {version.notes}
                      </p>
                    )}
                    <p className="text-xs text-text-secondary mt-1 truncate">
                      {version.content.substring(0, 100)}...
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Deletion Management Panel component
function DeletionManagementPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const deletionSettings = useQuery(api.packages.getDeletionCleanupSettings);
  const packagesMarkedForDeletion = useQuery(
    api.packages.getPackagesMarkedForDeletion,
  );
  const updateDeletionSetting = useMutation(
    api.packages.updateDeletionCleanupSetting,
  );
  const permanentlyDelete = useMutation(
    api.packages.adminPermanentlyDeletePackage,
  );

  const handleToggleAutoDelete = async () => {
    if (!deletionSettings) return;
    try {
      await updateDeletionSetting({
        key: "autoDeleteMarkedPackages",
        value: !deletionSettings.autoDeleteEnabled,
      });
      toast.success(
        deletionSettings.autoDeleteEnabled
          ? "Auto-delete disabled"
          : "Auto-delete enabled",
      );
    } catch {
      toast.error("Failed to update setting");
    }
  };

  const handleIntervalChange = async (days: number) => {
    try {
      await updateDeletionSetting({
        key: "deleteIntervalDays",
        value: days,
      });
      toast.success(`Delete interval set to ${days} days`);
    } catch {
      toast.error("Failed to update interval");
    }
  };

  const handlePermanentDelete = async (
    packageId: Id<"packages">,
    packageName: string,
  ) => {
    if (
      !confirm(`Permanently delete "${packageName}"? This cannot be undone.`)
    ) {
      return;
    }
    setIsDeleting(packageId);
    try {
      await permanentlyDelete({ packageId });
      toast.success(`"${packageName}" permanently deleted`);
    } catch {
      toast.error("Failed to delete package");
    } finally {
      setIsDeleting(null);
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "Unknown";
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const markedCount = packagesMarkedForDeletion?.length ?? 0;

  return (
    <div className="mb-4 rounded-lg border border-border bg-bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trash size={16} weight="bold" className="text-red-500" />
          <span className="text-sm font-medium text-text-primary">
            Deletion Management
          </span>
          {markedCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded">
              {markedCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <CaretUp size={16} className="text-text-secondary" />
        ) : (
          <CaretDown size={16} className="text-text-secondary" />
        )}
      </button>

      {isExpanded && deletionSettings && (
        <div className="p-4 border-t border-border space-y-4">
          {/* Auto-delete toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Auto-delete marked packages
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                Automatically delete packages after the waiting period
              </p>
            </div>
            <button
              onClick={handleToggleAutoDelete}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                deletionSettings.autoDeleteEnabled
                  ? "bg-red-600"
                  : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  deletionSettings.autoDeleteEnabled
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Waiting period interval */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-text-primary">
                Waiting period
              </label>
              <p className="text-xs text-text-secondary mt-0.5">
                Days to wait before permanent deletion
              </p>
            </div>
            <select
              value={deletionSettings.deleteIntervalDays}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              className="px-3 py-1.5 text-sm rounded-lg border border-border bg-white text-text-primary focus:outline-none focus:border-button"
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days (default)</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>

          {/* Packages marked for deletion */}
          {markedCount > 0 ? (
            <div className="mt-4 pt-4 border-t border-border">
              <h4 className="text-sm font-medium text-text-primary mb-3">
                Packages Marked for Deletion ({markedCount})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {packagesMarkedForDeletion?.map((pkg) => (
                  <div
                    key={pkg._id}
                    className="flex items-center justify-between p-2 rounded-lg border border-red-100 bg-red-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {pkg.componentName || pkg.name}
                      </p>
                      <p className="text-xs text-text-secondary">
                        Marked: {formatDate(pkg.markedForDeletionAt)} by{" "}
                        {pkg.markedForDeletionBy || "user"}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handlePermanentDelete(
                          pkg._id,
                          pkg.componentName || pkg.name,
                        )
                      }
                      disabled={isDeleting === pkg._id}
                      className="ml-2 px-2 py-1 text-xs rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {isDeleting === pkg._id ? "Deleting..." : "Delete Now"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-text-secondary text-center py-4">
                No packages are currently marked for deletion.
              </p>
            </div>
          )}

          {/* Info about cron */}
          <div className="p-3 rounded-lg bg-bg-hover text-xs text-text-secondary">
            <p>
              A scheduled job runs daily at 2 AM UTC to permanently delete
              packages that have been marked for deletion and have passed the
              waiting period.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ SLUG MIGRATION PANEL ============

function SlugMigrationPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isGeneratingSingle, setIsGeneratingSingle] = useState<string | null>(
    null,
  );

  const packagesWithoutSlugs = useQuery(api.packages.getPackagesWithoutSlugs);
  const generateSlugForPackage = useMutation(
    api.packages.generateSlugForPackage,
  );
  const generateMissingSlugs = useMutation(api.packages.generateMissingSlugs);

  const missingCount = packagesWithoutSlugs?.length ?? 0;

  const handleGenerateAll = async () => {
    setIsGeneratingAll(true);
    try {
      const result = await generateMissingSlugs({});
      toast.success(
        `Generated ${result.generated} slugs (${result.skipped} skipped)`,
      );
    } catch {
      toast.error("Failed to generate slugs");
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const handleGenerateSingle = async (
    packageId: Id<"packages">,
    packageName: string,
  ) => {
    setIsGeneratingSingle(packageId);
    try {
      const slug = await generateSlugForPackage({ packageId });
      if (slug) {
        toast.success(`Slug generated: ${slug}`);
      } else {
        toast.error("Could not generate slug");
      }
    } catch {
      toast.error("Failed to generate slug");
    } finally {
      setIsGeneratingSingle(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="mb-4 rounded-lg border border-border bg-bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <LinkSimple size={16} weight="bold" className="text-orange-500" />
          <span className="text-sm font-medium text-text-primary">
            Slug Migration
          </span>
          {missingCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded">
              {missingCount} missing
            </span>
          )}
        </div>
        {isExpanded ? (
          <CaretUp size={16} className="text-text-secondary" />
        ) : (
          <CaretDown size={16} className="text-text-secondary" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-border space-y-4">
          {/* Info section */}
          <div className="p-3 rounded-lg bg-bg-hover text-xs text-text-secondary">
            <p>
              Components without URL slugs will not have detail pages at
              /components/:slug. Use this tool to auto-generate slugs from
              package names.
            </p>
          </div>

          {/* Generate all button */}
          {missingCount > 0 && (
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-text-primary">
                  Generate All Missing Slugs
                </label>
                <p className="text-xs text-text-secondary mt-0.5">
                  Auto-generate slugs for {missingCount} packages
                </p>
              </div>
              <button
                onClick={handleGenerateAll}
                disabled={isGeneratingAll}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {isGeneratingAll
                  ? "Generating..."
                  : `Generate ${missingCount} Slugs`}
              </button>
            </div>
          )}

          {/* Packages missing slugs list */}
          {missingCount > 0 ? (
            <div className="mt-4 pt-4 border-t border-border">
              <h4 className="text-sm font-medium text-text-primary mb-3">
                Packages Missing Slugs ({missingCount})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {packagesWithoutSlugs?.map((pkg) => (
                  <div
                    key={pkg._id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-bg-primary"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {pkg.name}
                      </p>
                      <p className="text-xs text-text-secondary">
                        Submitted {formatDate(pkg.submittedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={pkg.npmUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 text-xs rounded border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                      >
                        npm
                      </a>
                      <button
                        onClick={() => handleGenerateSingle(pkg._id, pkg.name)}
                        disabled={isGeneratingSingle === pkg._id}
                        className="px-3 py-1 text-xs font-medium rounded bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors disabled:opacity-50"
                      >
                        {isGeneratingSingle === pkg._id ? "..." : "Generate"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-green-600 text-center py-4 flex items-center justify-center gap-2">
                <CheckCircle size={16} />
                All packages have slugs. No migration needed.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ GITHUB BROADCAST SECTION ============

type BroadcastFilter = "approved" | "pending" | "rejected" | "all";

const BROADCAST_FILTERS: Array<{
  id: BroadcastFilter;
  label: string;
  hint: string;
}> = [
  { id: "approved", label: "Approved", hint: "Live in the directory" },
  { id: "pending", label: "Pending", hint: "Pending, in review, or unset" },
  { id: "rejected", label: "Rejected", hint: "Rejected submissions" },
  { id: "all", label: "All", hint: "Every non archived submission" },
];

// Roughly how long a broadcast takes at the backend's 10s stagger.
function estimateBroadcastDuration(count: number): string {
  const seconds = count * 10;
  if (seconds < 60) return `about ${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `about ${minutes} min`;
}

function formatBroadcastDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// One past or running broadcast: status, progress bar, expandable results.
// Small pill button used for the row actions so they match the message panels.
function rowActionClass(variant: "default" | "danger" = "default"): string {
  return variant === "danger"
    ? "px-2.5 py-1 text-xs font-medium rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
    : "px-2.5 py-1 text-xs font-medium rounded-full border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors";
}

function BroadcastHistoryRow({
  broadcast,
  isExpanded,
  onToggle,
  onCancel,
  onArchive,
  onRestore,
  onDelete,
}: {
  broadcast: {
    _id: Id<"githubBroadcasts">;
    title: string;
    body: string;
    statusFilter: BroadcastFilter;
    status: "running" | "completed" | "cancelled";
    total: number;
    sent: number;
    failed: number;
    skipped: number;
    replies?: number;
    archivedAt?: number;
    createdBy: string;
    createdAt: number;
  };
  isExpanded: boolean;
  onToggle: () => void;
  onCancel: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const items = useQuery(
    api.githubIssues.getBroadcastItems,
    isExpanded ? { broadcastId: broadcast._id } : "skip",
  );
  const done = broadcast.sent + broadcast.failed + broadcast.skipped;
  const pct = broadcast.total > 0 ? Math.round((done / broadcast.total) * 100) : 0;
  const filterLabel =
    BROADCAST_FILTERS.find((f) => f.id === broadcast.statusFilter)?.label ??
    broadcast.statusFilter;
  const isRunning = broadcast.status === "running";
  const isArchived = broadcast.archivedAt !== undefined;
  const replies = broadcast.replies ?? 0;

  const statusPill =
    broadcast.status === "running"
      ? "bg-blue-100 text-blue-700"
      : broadcast.status === "completed"
        ? "bg-green-100 text-green-700"
        : "bg-orange-100 text-orange-700";

  // Row actions live inside the toggle button, so stop the click from
  // expanding the row and mirror that for keyboard activation.
  const action =
    (fn: () => void) =>
    (e: React.MouseEvent | React.KeyboardEvent) => {
      if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
      fn();
    };

  return (
    <div
      className={`rounded-lg border border-border bg-bg-primary overflow-hidden ${
        isArchived ? "opacity-70" : ""
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-bg-hover transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-text-primary truncate">
              {broadcast.title}
            </span>
            <span
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${statusPill}`}
            >
              {broadcast.status === "running"
                ? "Sending"
                : broadcast.status === "completed"
                  ? "Done"
                  : "Cancelled"}
            </span>
            {isArchived && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-bg-hover text-text-secondary">
                Archived
              </span>
            )}
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-bg-hover text-text-secondary">
              {filterLabel}
            </span>
            {replies > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-50 text-green-700">
                <ChatCircle size={10} />
                {replies} repl{replies === 1 ? "y" : "ies"}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            {formatBroadcastDate(broadcast.createdAt)} by{" "}
            {broadcast.createdBy.split("@")[0]}
            {" · "}
            {broadcast.sent} sent
            {broadcast.failed > 0 ? `, ${broadcast.failed} failed` : ""}
            {broadcast.skipped > 0 ? `, ${broadcast.skipped} skipped` : ""}
            {" of "}
            {broadcast.total}
          </p>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 w-full rounded-full bg-bg-hover overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                broadcast.status === "running"
                  ? "bg-blue-500"
                  : broadcast.status === "completed"
                    ? "bg-green-500"
                    : "bg-orange-400"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRunning && (
            <span
              role="button"
              tabIndex={0}
              onClick={action(onCancel)}
              onKeyDown={action(onCancel)}
              className={rowActionClass("danger")}
            >
              Cancel
            </span>
          )}
          {!isRunning && !isArchived && (
            <span
              role="button"
              tabIndex={0}
              onClick={action(onArchive)}
              onKeyDown={action(onArchive)}
              className={`${rowActionClass()} inline-flex items-center gap-1`}
              title="Hide from the default list. Reply sync keeps working."
            >
              <Archive size={11} />
              Archive
            </span>
          )}
          {!isRunning && isArchived && (
            <span
              role="button"
              tabIndex={0}
              onClick={action(onRestore)}
              onKeyDown={action(onRestore)}
              className={`${rowActionClass()} inline-flex items-center gap-1`}
            >
              <ArrowCounterClockwise size={11} />
              Restore
            </span>
          )}
          {!isRunning && (
            <span
              role="button"
              tabIndex={0}
              onClick={action(onDelete)}
              onKeyDown={action(onDelete)}
              className={`${rowActionClass("danger")} inline-flex items-center gap-1`}
              title="Remove this record. Issues on GitHub are not touched."
            >
              <Trash size={11} />
              Delete
            </span>
          )}
          {isExpanded ? (
            <CaretUp size={16} className="text-text-secondary" />
          ) : (
            <CaretDown size={16} className="text-text-secondary" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border p-3 space-y-3">
          <div className="p-3 rounded-lg bg-bg-hover text-xs text-text-secondary whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
            {broadcast.body}
          </div>
          {items === undefined ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-button"></div>
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-text-secondary text-center py-2">
              No items recorded.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">
                      {item.packageName}
                    </p>
                    <p className="text-[11px] text-text-secondary truncate">
                      {item.repo ?? "No GitHub repo"}
                      {item.error && item.status !== "sent"
                        ? ` · ${item.error}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(item.replyCount ?? 0) > 0 && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-green-50 text-green-700"
                        title="Replies mirrored into this package's message thread"
                      >
                        <ChatCircle size={11} />
                        {item.replyCount}
                      </span>
                    )}
                    {item.issueState === "closed" && (
                      <span className="px-2 py-0.5 text-[11px] rounded-full bg-bg-hover text-text-secondary">
                        Closed
                      </span>
                    )}
                    {item.status === "sent" && item.issueUrl ? (
                      <a
                        href={item.issueUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
                      >
                        <GithubLogo size={11} />
                        Issue
                        <ArrowSquareOut size={10} />
                      </a>
                    ) : (
                      <span
                        className={`px-2 py-0.5 text-[11px] rounded-full ${
                          item.status === "queued"
                            ? "bg-blue-50 text-blue-600"
                            : item.status === "failed"
                              ? "bg-red-50 text-red-600"
                              : "bg-bg-hover text-text-secondary"
                        }`}
                      >
                        {item.status === "queued"
                          ? item.attempts > 0
                            ? "Retrying"
                            : "Queued"
                          : item.status === "failed"
                            ? "Failed"
                            : "Skipped"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Compose one GitHub issue and send it to every submitter's repo matching a
// review status filter. Sends run in the backend one at a time (10s apart).
function GithubBroadcastSection() {
  const [filter, setFilter] = useState<BroadcastFilter>("approved");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [cancelTarget, setCancelTarget] =
    useState<Id<"githubBroadcasts"> | null>(null);
  const [expandedId, setExpandedId] = useState<Id<"githubBroadcasts"> | null>(
    null,
  );
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    _id: Id<"githubBroadcasts">;
    title: string;
    total: number;
  } | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const targetCount = useQuery(api.githubIssues.getBroadcastTargetCount, {
    statusFilter: filter,
  });
  const broadcasts = useQuery(api.githubIssues.listGithubBroadcasts, {
    includeArchived: showArchived,
  });
  const startBroadcast = useMutation(api.githubIssues.startGithubBroadcast);
  const cancelBroadcast = useMutation(api.githubIssues.cancelGithubBroadcast);
  const archiveBroadcast = useMutation(api.githubIssues.archiveGithubBroadcast);
  const restoreBroadcast = useMutation(api.githubIssues.restoreGithubBroadcast);
  const deleteBroadcast = useMutation(api.githubIssues.deleteGithubBroadcast);

  // Reply sync: mirrors GitHub issue replies into package threads.
  const syncStatus = useQuery(api.githubReplySync.getSyncStatus);
  const setReplySyncEnabled = useMutation(
    api.githubReplySync.setReplySyncEnabled,
  );
  const testConnection = useAction(api.githubReplySync.testConnection);
  const syncNow = useMutation(api.githubReplySync.syncNow);

  const runningCount =
    broadcasts?.filter((b) => b.status === "running").length ?? 0;

  const handleToggleReplySync = async () => {
    if (!syncStatus) return;
    const next = !syncStatus.enabled;
    try {
      await setReplySyncEnabled({ enabled: next });
      toast.success(
        next
          ? "Reply sync on. Checking GitHub for replies now."
          : "Reply sync off",
      );
    } catch {
      toast.error("Failed to update reply sync");
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      const result = await testConnection({});
      if (result.ok) toast.success(result.message);
      else toast.error(result.message, { duration: 8000 });
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? String(error.data)
          : "Connection test failed",
      );
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await syncNow({});
      toast.success("Sync started. Results appear below in a few seconds.");
    } catch {
      toast.error("Failed to start sync");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleArchive = async (broadcastId: Id<"githubBroadcasts">) => {
    try {
      await archiveBroadcast({ broadcastId });
      toast.success("Broadcast archived");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? String(error.data)
          : "Failed to archive broadcast",
      );
    }
  };

  const handleRestore = async (broadcastId: Id<"githubBroadcasts">) => {
    try {
      await restoreBroadcast({ broadcastId });
      toast.success("Broadcast restored");
    } catch {
      toast.error("Failed to restore broadcast");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBroadcast({ broadcastId: deleteTarget._id });
      if (expandedId === deleteTarget._id) setExpandedId(null);
      toast.success("Broadcast deleted");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? String(error.data)
          : "Failed to delete broadcast",
      );
    } finally {
      setDeleteTarget(null);
    }
  };
  const eligible = targetCount?.eligible ?? 0;
  const missingRepo = targetCount?.missingRepo ?? 0;
  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    eligible > 0 &&
    !isStarting &&
    runningCount === 0;

  const handleStart = async () => {
    setIsStarting(true);
    try {
      const id = await startBroadcast({
        title: title.trim(),
        body: body.trim(),
        statusFilter: filter,
      });
      toast.success(
        `Broadcast started. Sending to ${eligible} repo${eligible === 1 ? "" : "s"}, ${estimateBroadcastDuration(eligible)}.`,
      );
      setTitle("");
      setBody("");
      setExpandedId(id);
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? String(error.data)
          : "Failed to start broadcast",
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelBroadcast({ broadcastId: cancelTarget });
      toast.success("Broadcast cancelled");
    } catch {
      toast.error("Failed to cancel broadcast");
    } finally {
      setCancelTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-bg-card p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
            <MegaphoneSimple size={16} />
            GitHub Broadcast
            {runningCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
                sending
              </span>
            )}
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            Open one GitHub issue on every matching submitter repo. Issues go
            out one at a time, 10 seconds apart, using{" "}
            <code className="bg-bg-primary px-1 rounded">GITHUB_TOKEN</code>.
            Confirm the recipient count before anything is sent.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-text-primary">
            Recipients
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {BROADCAST_FILTERS.map((option) => {
              const isActive = filter === option.id;
              return (
                <Tooltip key={option.id} content={option.hint} position="top">
                  <button
                    type="button"
                    onClick={() => setFilter(option.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                      isActive
                        ? "border-button bg-button text-white"
                        : "border-border bg-white text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                    }`}
                  >
                    {option.label}
                  </button>
                </Tooltip>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            {targetCount === undefined ? (
              "Counting..."
            ) : (
              <>
                <span className="font-medium text-text-primary">
                  {eligible}
                </span>{" "}
                component{eligible === 1 ? "" : "s"} with GitHub repos will
                receive this issue
                {missingRepo > 0
                  ? `, ${missingRepo} skipped (no GitHub repo)`
                  : ""}
                {eligible > 0 ? ` · ${estimateBroadcastDuration(eligible)}` : ""}
              </>
            )}
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <label htmlFor="broadcast-title" className="sr-only">
            Issue title
          </label>
          <input
            id="broadcast-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Issue title"
            maxLength={200}
            className="w-full px-3 py-2 rounded-lg border border-border bg-bg-primary text-text-primary text-sm outline-none focus:border-button transition-colors"
          />
          <label htmlFor="broadcast-body" className="sr-only">
            Issue message
          </label>
          <textarea
            id="broadcast-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Issue message. Markdown works. A footer linking back to each component's directory listing is added automatically."
            rows={6}
            className="w-full px-3 py-2 rounded-lg border border-border bg-bg-primary text-text-primary text-sm outline-none focus:border-button transition-colors resize-y"
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-text-secondary">
              {runningCount > 0
                ? "A broadcast is already sending. Wait for it to finish or cancel it below."
                : "You will confirm the recipient count before anything is sent."}
            </p>
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={!canSend}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-button text-white hover:bg-button-hover transition-colors disabled:opacity-50 shrink-0"
            >
              <GithubLogo size={16} />
              {isStarting
                ? "Starting..."
                : `Send to ${eligible} repo${eligible === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-bg-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-text-primary inline-flex items-center gap-2">
              <ArrowsClockwise size={14} />
              Reply sync
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              When a submitter replies on an issue we opened, the reply lands
              in that package&apos;s message thread, counts toward the header
              bell, and posts to Slack. Polls GitHub every couple of minutes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleToggleReplySync()}
            disabled={!syncStatus}
            aria-label={
              syncStatus?.enabled ? "Turn reply sync off" : "Turn reply sync on"
            }
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              syncStatus?.enabled ? "bg-green-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                syncStatus?.enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="mt-3 p-3 rounded-lg bg-bg-hover text-xs text-text-secondary space-y-1.5">
          <p>
            Needs a personal access token (classic) with the{" "}
            <code className="bg-bg-primary px-1 rounded">notifications</code>{" "}
            scope. Set{" "}
            <code className="bg-bg-primary px-1 rounded">
              GITHUB_NOTIFICATIONS_TOKEN
            </code>{" "}
            on the deployment; otherwise{" "}
            <code className="bg-bg-primary px-1 rounded">GITHUB_TOKEN</code> is
            tried. Fine grained tokens cannot read notifications.
          </p>
          {syncStatus && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-1">
              <dt className="text-text-secondary/80">Token</dt>
              <dd className="text-text-primary">
                {syncStatus.state.tokenLogin
                  ? `@${syncStatus.state.tokenLogin} via ${
                      syncStatus.state.tokenSource === "notifications"
                        ? "GITHUB_NOTIFICATIONS_TOKEN"
                        : "GITHUB_TOKEN"
                    }`
                  : syncStatus.notificationsTokenConfigured ||
                      syncStatus.defaultTokenConfigured
                    ? "Not tested yet"
                    : "No token configured"}
              </dd>
              <dt className="text-text-secondary/80">Last poll</dt>
              <dd className="text-text-primary">
                {syncStatus.state.lastPolledAt
                  ? formatBroadcastDate(syncStatus.state.lastPolledAt)
                  : "Never"}
                {syncStatus.state.pollIntervalSeconds
                  ? ` · GitHub asks for ${syncStatus.state.pollIntervalSeconds}s between polls`
                  : ""}
              </dd>
              {syncStatus.state.lastRunSummary && (
                <>
                  <dt className="text-text-secondary/80">Last result</dt>
                  <dd className="text-text-primary">
                    {syncStatus.state.lastRunSummary}
                  </dd>
                </>
              )}
              {syncStatus.state.lastError && (
                <>
                  <dt className="text-red-600">Last error</dt>
                  <dd className="text-red-600 break-words">
                    {syncStatus.state.lastError}
                  </dd>
                </>
              )}
            </dl>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleTestConnection()}
            disabled={isTestingConnection}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-white text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
          >
            <Plugs size={14} />
            {isTestingConnection ? "Testing..." : "Test connection"}
          </button>
          <button
            type="button"
            onClick={() => void handleSyncNow()}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-white text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
            title="Check the last 24 hours of notifications now"
          >
            <ArrowsClockwise size={14} />
            {isSyncing ? "Starting..." : "Sync now"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-medium text-text-primary">Broadcasts</h3>
          <button
            type="button"
            onClick={() => setShowArchived((prev) => !prev)}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors whitespace-nowrap"
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
        </div>
        {broadcasts === undefined ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-button"></div>
          </div>
        ) : broadcasts.length === 0 ? (
          <p className="text-xs text-text-secondary text-center py-4">
            {showArchived
              ? "No broadcasts yet. Send one above to open issues on matching repos."
              : "No active broadcasts. Send one above, or show archived to see past runs."}
          </p>
        ) : (
          <div className="space-y-2">
            {broadcasts.map((broadcast) => (
              <BroadcastHistoryRow
                key={broadcast._id}
                broadcast={broadcast}
                isExpanded={expandedId === broadcast._id}
                onToggle={() =>
                  setExpandedId((prev) =>
                    prev === broadcast._id ? null : broadcast._id,
                  )
                }
                onCancel={() => setCancelTarget(broadcast._id)}
                onArchive={() => void handleArchive(broadcast._id)}
                onRestore={() => void handleRestore(broadcast._id)}
                onDelete={() =>
                  setDeleteTarget({
                    _id: broadcast._id,
                    title: broadcast.title,
                    total: broadcast.total,
                  })
                }
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          void handleDelete();
        }}
        title="Delete broadcast?"
        message={`This removes "${deleteTarget?.title ?? ""}" and its ${deleteTarget?.total ?? 0} per repo result${deleteTarget?.total === 1 ? "" : "s"} from the history. Issues already on GitHub are not touched, and replies already mirrored into message threads stay. Reply sync stops for this broadcast's issues, so archive instead if any are still open.`}
        confirmText="Delete"
        cancelText="Keep"
        type="danger"
      />

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {
          void handleStart();
        }}
        title="Send GitHub issues?"
        message={`This opens a public issue titled "${title.trim()}" on ${eligible} repo${eligible === 1 ? "" : "s"} (${BROADCAST_FILTERS.find((f) => f.id === filter)?.label ?? filter}). Sends run 10 seconds apart, ${estimateBroadcastDuration(eligible)}. You can cancel while it runs.`}
        confirmText="Send"
        cancelText="Back"
      />

      <ConfirmModal
        isOpen={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          void handleCancel();
        }}
        title="Cancel broadcast?"
        message="Issues already opened stay on GitHub. Remaining repos will not receive one."
        confirmText="Cancel broadcast"
        cancelText="Keep sending"
        type="danger"
      />
    </div>
  );
}

// ============ CONTENT MODEL MIGRATION PANEL ============

function ContentMigrationPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const allPackages = useQuery(api.packages.getAllPackages);
  const regenerateContent = useAction(
    api.seoContent.regenerateDirectoryContent,
  );
  const migrateToContent = useMutation(api.seoContentDb.migrateToContentModel);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [migratingId, setMigratingId] = useState<string | null>(null);

  const v1Packages = useMemo(
    () =>
      (allPackages ?? []).filter(
        (pkg: any) =>
          pkg.contentModelVersion !== 2 &&
          pkg.reviewStatus === "approved" &&
          pkg.visibility === "visible",
      ),
    [allPackages],
  );

  const v2Packages = useMemo(
    () =>
      (allPackages ?? []).filter((pkg: any) => pkg.contentModelVersion === 2),
    [allPackages],
  );

  const handleGenerate = async (packageId: Id<"packages">) => {
    setGeneratingId(packageId);
    try {
      await regenerateContent({ packageId });
      toast.success(
        "Content generation started. It will complete in the background.",
      );
    } catch {
      toast.error("Failed to start content generation.");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleMigrate = async (packageId: Id<"packages">) => {
    setMigratingId(packageId);
    try {
      await migrateToContent({ packageId });
      toast.success("Package migrated to v2 content model.");
    } catch {
      toast.error("Failed to migrate.");
    } finally {
      setMigratingId(null);
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-border bg-bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lightning size={16} weight="bold" className="text-blue-500" />
          <span className="text-sm font-medium text-text-primary">
            Content Model Migration
          </span>
          {v1Packages.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
              {v1Packages.length} on v1
            </span>
          )}
          {v2Packages.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded">
              {v2Packages.length} on v2
            </span>
          )}
        </div>
        {isExpanded ? (
          <CaretUp size={16} className="text-text-secondary" />
        ) : (
          <CaretDown size={16} className="text-text-secondary" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-border space-y-4">
          <div className="p-3 rounded-lg bg-bg-hover text-xs text-text-secondary">
            <p>
              Migrate approved packages from the old SEO content model (v1) to
              the new generated content model (v2: Description, Use Cases, How
              it Works). First generate content, then migrate to make v2 the
              active model for a package.
            </p>
          </div>

          {v1Packages.length > 0 ? (
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-3">
                V1 Packages ({v1Packages.length})
              </h4>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {v1Packages.map((pkg: any) => (
                  <div
                    key={pkg._id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-bg-primary"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {pkg.componentName || pkg.name}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {pkg.contentGenerationStatus === "completed"
                          ? "Content generated, ready to migrate"
                          : generatingId === pkg._id ||
                              pkg.contentGenerationStatus === "generating"
                            ? ""
                            : pkg.contentGenerationStatus === "error"
                              ? "Generation failed"
                              : "No v2 content yet"}
                        {(generatingId === pkg._id ||
                          pkg.contentGenerationStatus === "generating") && (
                          <AiLoadingDots size={12} />
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleGenerate(pkg._id)}
                        disabled={
                          generatingId === pkg._id ||
                          pkg.contentGenerationStatus === "generating"
                        }
                        className="px-3 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors disabled:opacity-50"
                      >
                        {generatingId === pkg._id ? (
                          <AiLoadingDots size={12} />
                        ) : (
                          "Generate"
                        )}
                      </button>
                      {pkg.contentGenerationStatus === "completed" && (
                        <button
                          onClick={() => handleMigrate(pkg._id)}
                          disabled={migratingId === pkg._id}
                          className="px-3 py-1 text-xs font-medium rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                        >
                          {migratingId === pkg._id ? "..." : "Migrate"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-sm text-green-600 flex items-center justify-center gap-2">
                <CheckCircle size={16} />
                All approved packages are on the v2 content model.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ THUMBNAIL TEMPLATE MANAGEMENT ============

function ThumbnailTemplatePanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const templates = useQuery(api.thumbnails.listTemplates);
  const allPackages = useQuery(api.packages.getAllPackages);
  const generateUploadUrl = useMutation(api.packages.generateUploadUrl);
  const createTemplate = useMutation(api.thumbnails.createTemplate);
  const deleteTemplate = useMutation(api.thumbnails.deleteTemplate);
  const setDefaultTemplate = useMutation(api.thumbnails.setDefaultTemplate);
  const updateTemplate = useMutation(api.thumbnails.updateTemplate);
  const regenerateSelected = useAction(
    api.thumbnailGenerator.regenerateSelectedThumbnails,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<
    Id<"thumbnailTemplates"> | ""
  >("");
  const [componentDropdownOpen, setComponentDropdownOpen] = useState(false);
  const [componentSearch, setComponentSearch] = useState("");
  const [selectedPackageIds, setSelectedPackageIds] = useState<
    Array<Id<"packages">>
  >([]);
  const [isGeneratingSelected, setIsGeneratingSelected] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [editingTemplateId, setEditingTemplateId] =
    useState<Id<"thumbnailTemplates"> | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState("");

  // Upload multiple background templates (names derived from filenames or user input)
  const handleUploadTemplates = async (files: FileList) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (const file of fileArray) {
      try {
        // Use user-provided name for single file, or derive from filename for multiple
        let templateName: string;
        if (fileArray.length === 1 && newTemplateName.trim()) {
          templateName = newTemplateName.trim();
        } else {
          // Extract name from filename (remove extension)
          templateName = file.name
            .replace(/\.[^/.]+$/, "")
            .replace(/[-_]/g, " ");
        }

        const uploadUrl = await generateUploadUrl();
        const uploadResult = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadResult.ok) throw new Error("Upload failed");
        const { storageId } = await uploadResult.json();
        await createTemplate({
          name: templateName,
          storageId,
          isDefault:
            (!templates || templates.length === 0) && successCount === 0,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setNewTemplateName("");
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (successCount > 0 && failCount === 0) {
      toast.success(
        `${successCount} template${successCount > 1 ? "s" : ""} added`,
      );
    } else if (successCount > 0) {
      toast.success(`${successCount} uploaded, ${failCount} failed`);
    } else {
      toast.error("Failed to upload templates");
    }
    setIsUploading(false);
  };

  // Rename a template
  const handleRenameTemplate = async (templateId: Id<"thumbnailTemplates">) => {
    if (!editingTemplateName.trim()) {
      toast.error("Enter a name");
      return;
    }
    try {
      await updateTemplate({ templateId, name: editingTemplateName.trim() });
      setEditingTemplateId(null);
      setEditingTemplateName("");
      toast.success("Template renamed");
    } catch {
      toast.error("Failed to rename template");
    }
  };

  // Start editing a template name
  const startEditingTemplate = (template: {
    _id: Id<"thumbnailTemplates">;
    name: string;
  }) => {
    setEditingTemplateId(template._id);
    setEditingTemplateName(template.name);
  };

  // Set a template as default
  const handleSetDefault = async (templateId: Id<"thumbnailTemplates">) => {
    try {
      await setDefaultTemplate({ templateId });
      toast.success("Default template updated");
    } catch {
      toast.error("Failed to set default");
    }
  };

  // Delete a template
  const handleDelete = async (templateId: Id<"thumbnailTemplates">) => {
    try {
      await deleteTemplate({ templateId });
      toast.success("Template deleted");
    } catch {
      toast.error("Failed to delete template");
    }
  };

  // Toggle active state
  const handleToggleActive = async (
    templateId: Id<"thumbnailTemplates">,
    currentActive: boolean,
  ) => {
    try {
      await updateTemplate({ templateId, active: !currentActive });
      toast.success(currentActive ? "Template disabled" : "Template enabled");
    } catch {
      toast.error("Failed to update template");
    }
  };

  // Generate thumbnails for selected components from chosen template.
  const handleGenerateSelected = async () => {
    if (selectedPackageIds.length === 0) {
      toast.error("Select at least one component");
      return;
    }
    setIsGeneratingSelected(true);
    try {
      const result = await regenerateSelected({
        packageIds: selectedPackageIds,
        templateId: selectedTemplateId || undefined,
      });
      toast.success(`Queued ${result.queued} selected components`);
    } catch {
      toast.error("Failed to start selected generation");
    } finally {
      setIsGeneratingSelected(false);
    }
  };

  const filteredPackages =
    allPackages?.filter((pkg) => {
      if (!componentSearch.trim()) return true;
      const term = componentSearch.trim().toLowerCase();
      return (
        pkg.name.toLowerCase().includes(term) ||
        (pkg.componentName || "").toLowerCase().includes(term)
      );
    }) || [];

  const togglePackageSelection = (packageId: Id<"packages">) => {
    setSelectedPackageIds((prev) =>
      prev.includes(packageId)
        ? prev.filter((id) => id !== packageId)
        : [...prev, packageId],
    );
  };

  return (
    <div className="mb-4 rounded-lg border border-border bg-bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Image size={16} weight="bold" className="text-text-secondary" />
          <span className="text-sm font-medium text-text-primary">
            Thumbnail Templates
          </span>
          {templates && (
            <span className="text-xs text-text-secondary">
              ({templates.filter((t) => t.active).length} active)
            </span>
          )}
        </div>
        {isExpanded ? (
          <CaretUp size={16} className="text-text-secondary" />
        ) : (
          <CaretDown size={16} className="text-text-secondary" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-border space-y-4">
          {/* Info */}
          <div className="p-3 rounded-lg bg-bg-hover text-xs text-text-secondary">
            <p>
              Upload background images that serve as templates for
              auto-generated thumbnails. User logos are centered on top of the
              selected template to create 16:9 thumbnails.
            </p>
          </div>

          {/* Add template (supports multiple files) */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Template name (optional for multi-upload)"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-bg-primary text-text-primary"
            />
            <label className="cursor-pointer text-sm px-3 py-1.5 rounded-lg bg-bg-primary text-text-primary hover:bg-bg-hover transition-colors border border-border flex items-center gap-1">
              <Upload size={14} />
              {isUploading ? "Uploading..." : "Upload"}
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                className="hidden"
                disabled={isUploading}
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  // Validate all files
                  for (const file of Array.from(files)) {
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error(`${file.name} exceeds 5MB limit`);
                      return;
                    }
                  }
                  handleUploadTemplates(files);
                }}
              />
            </label>
          </div>
          <p className="text-[10px] text-text-secondary">
            Select multiple images to batch upload. Names are derived from
            filenames.
          </p>

          {/* Template list */}
          {templates && templates.length > 0 ? (
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template._id}
                  className={`flex items-center gap-3 p-2 rounded-lg border ${
                    template.isDefault
                      ? "border-blue-500/50 bg-blue-500/5"
                      : "border-border"
                  }`}
                >
                  {/* Preview */}
                  {template.previewUrl ? (
                    <img
                      src={template.previewUrl}
                      alt={template.name}
                      className="w-20 h-11 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-11 rounded bg-bg-hover flex-shrink-0 flex items-center justify-center">
                      <Image size={16} className="text-text-secondary" />
                    </div>
                  )}

                  {/* Info with inline rename */}
                  <div className="flex-1 min-w-0">
                    {editingTemplateId === template._id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingTemplateName}
                          onChange={(e) =>
                            setEditingTemplateName(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleRenameTemplate(template._id);
                            if (e.key === "Escape") {
                              setEditingTemplateId(null);
                              setEditingTemplateName("");
                            }
                          }}
                          className="flex-1 px-2 py-0.5 text-sm rounded border border-border bg-bg-primary text-text-primary"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenameTemplate(template._id)}
                          className="text-xs px-2 py-0.5 rounded bg-button text-white hover:bg-button/90"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingTemplateId(null);
                            setEditingTemplateName("");
                          }}
                          className="text-xs px-2 py-0.5 rounded hover:bg-bg-hover text-text-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate">
                          {template.name}
                        </span>
                        {template.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium">
                            DEFAULT
                          </span>
                        )}
                        {!template.active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-500 font-medium">
                            DISABLED
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {editingTemplateId !== template._id && (
                      <button
                        onClick={() => startEditingTemplate(template)}
                        className="p-1 rounded hover:bg-bg-hover transition-colors"
                        title="Rename template"
                      >
                        <PencilSimple
                          size={14}
                          className="text-text-secondary"
                        />
                      </button>
                    )}
                    {!template.isDefault && (
                      <button
                        onClick={() => handleSetDefault(template._id)}
                        className="text-xs px-2 py-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
                        title="Set as default"
                      >
                        Set default
                      </button>
                    )}
                    <button
                      onClick={() =>
                        handleToggleActive(template._id, template.active)
                      }
                      className="p-1 rounded hover:bg-bg-hover transition-colors"
                      title={template.active ? "Disable" : "Enable"}
                    >
                      {template.active ? (
                        <Eye size={14} className="text-text-secondary" />
                      ) : (
                        <EyeSlash size={14} className="text-text-secondary" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(template._id)}
                      className="p-1 rounded hover:bg-bg-hover transition-colors"
                      title="Delete template"
                    >
                      <TrashSimple
                        size={14}
                        className="text-text-secondary hover:text-red-500"
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-secondary text-center py-4">
              No templates yet. Upload a background image to get started.
            </p>
          )}

          {/* Selected component thumbnail generation */}
          {templates && templates.length > 0 && (
            <div className="pt-3 border-t border-border space-y-2">
              <label className="text-xs text-text-secondary">
                Generate selected component thumbnails
              </label>

              <div className="flex items-center gap-2">
                <select
                  value={selectedTemplateId}
                  onChange={(e) =>
                    setSelectedTemplateId(
                      e.target.value as Id<"thumbnailTemplates"> | "",
                    )
                  }
                  className="text-xs px-2 py-1.5 rounded border border-border bg-bg-primary text-text-primary"
                >
                  <option value="">Default template</option>
                  {templates
                    .filter((t) => t.active)
                    .map((template) => (
                      <option key={template._id} value={template._id}>
                        {template.name}
                        {template.isDefault ? " (default)" : ""}
                      </option>
                    ))}
                </select>

                <button
                  onClick={() => setComponentDropdownOpen((prev) => !prev)}
                  className="text-xs px-3 py-1.5 rounded border border-border bg-bg-primary text-text-primary hover:bg-bg-hover transition-colors"
                >
                  Select components ({selectedPackageIds.length})
                </button>

                <button
                  onClick={() => {
                    setSelectedPackageIds([]);
                    setComponentSearch("");
                    setComponentDropdownOpen(false);
                  }}
                  disabled={selectedPackageIds.length === 0}
                  className="text-xs px-3 py-1.5 rounded border border-border bg-bg-primary text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
                >
                  Clear
                </button>

                <button
                  onClick={handleGenerateSelected}
                  disabled={
                    isGeneratingSelected || selectedPackageIds.length === 0
                  }
                  className="text-xs px-3 py-1.5 rounded-lg bg-bg-primary text-text-primary hover:bg-bg-hover transition-colors border border-border flex items-center gap-1 disabled:opacity-50"
                >
                  <ArrowsClockwise
                    size={12}
                    className={isGeneratingSelected ? "animate-spin" : ""}
                  />
                  {isGeneratingSelected ? "Queueing..." : "Generate selected"}
                </button>
              </div>

              {componentDropdownOpen && (
                <div className="rounded-lg border border-border bg-bg-primary p-2 space-y-2">
                  <input
                    value={componentSearch}
                    onChange={(e) => setComponentSearch(e.target.value)}
                    placeholder="Search components..."
                    className="w-full text-xs px-2 py-1.5 rounded border border-border bg-bg-card text-text-primary"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredPackages.length === 0 ? (
                      <p className="text-xs text-text-secondary px-1 py-2">
                        No components found
                      </p>
                    ) : (
                      filteredPackages.map((pkg) => (
                        <label
                          key={pkg._id}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-bg-hover text-xs"
                        >
                          <span className="truncate text-text-primary">
                            {pkg.componentName || pkg.name}
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[10px] ${
                                pkg.logoUrl
                                  ? "text-green-600"
                                  : "text-text-secondary"
                              }`}
                            >
                              {pkg.logoUrl ? "logo" : "no logo"}
                            </span>
                            <input
                              type="checkbox"
                              checked={selectedPackageIds.includes(pkg._id)}
                              onChange={() => togglePackageSelection(pkg._id)}
                            />
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Filter type includes review statuses, all, archived, marked_for_deletion, and tool tabs
type FilterType =
  | ReviewStatus
  | "all"
  | "archived"
  | "marked_for_deletion"
  | "settings"
  | "api"
  | "logs"
  | "growth"
  | "broadcast";

const ADMIN_TOOL_TABS = [
  "settings",
  "api",
  "logs",
  "growth",
  "broadcast",
] as const;

type AdminToolTab = (typeof ADMIN_TOOL_TABS)[number];

function isAdminToolTab(filter: FilterType): filter is AdminToolTab {
  return (ADMIN_TOOL_TABS as readonly FilterType[]).includes(filter);
}

function emptyToolTabPages(): Record<AdminToolTab, number> {
  return {
    settings: 1,
    api: 1,
    logs: 1,
    growth: 1,
    broadcast: 1,
  };
}

// Filter tabs component
function FilterTabs({
  activeFilter,
  onFilterChange,
  counts,
}: {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  counts: Record<FilterType, number>;
}) {
  const tabs: {
    value: FilterType;
    label: string;
    icon: React.ReactNode;
    tooltip: string;
  }[] = [
    {
      value: "all",
      label: "All",
      icon: <Package size={16} />,
      tooltip: "Show all packages (excluding archived)",
    },
    {
      value: "pending",
      label: "Pending",
      icon: <Hourglass size={16} />,
      tooltip: "Show pending packages",
    },
    {
      value: "in_review",
      label: "Review",
      icon: <GitPullRequest size={16} />,
      tooltip: "Show packages in review",
    },
    {
      value: "approved",
      label: "Approved",
      icon: <CheckCircle size={16} />,
      tooltip: "Show approved packages",
    },
    {
      value: "changes_requested",
      label: "Changes",
      icon: <Warning size={16} />,
      tooltip: "Show packages needing changes",
    },
    {
      value: "rejected",
      label: "Rejected",
      icon: <Prohibit size={16} />,
      tooltip: "Show rejected packages",
    },
    {
      value: "marked_for_deletion",
      label: "Deletion",
      icon: <Clock size={16} />,
      tooltip: "Show packages marked for deletion",
    },
    {
      value: "archived",
      label: "Archived",
      icon: <Archive size={16} />,
      tooltip: "Show archived packages",
    },
    {
      value: "growth",
      label: "Growth",
      icon: <ChartBar size={16} />,
      tooltip: "All time downloads growth chart and share image",
    },
    {
      value: "settings",
      label: "Settings",
      icon: <Gear size={16} />,
      tooltip: "Auto-refresh, AI review, and stats",
    },
    {
      value: "api",
      label: "API",
      icon: <Key size={16} />,
      tooltip: "API access management and analytics",
    },
    {
      value: "logs",
      label: "Logs",
      icon: <FileText size={16} />,
      tooltip: "README update logs from the auto-update cron and manual refreshes",
    },
    {
      value: "broadcast",
      label: "Broadcast",
      icon: <MegaphoneSimple size={16} />,
      tooltip: "Open GitHub issues on submitter repos and sync replies",
    },
  ];

  const broadcasts = useQuery(api.githubIssues.listGithubBroadcasts, {
    includeArchived: false,
  });
  const broadcastRunning =
    broadcasts?.some((broadcast) => broadcast.status === "running") ?? false;

  return (
    <div className="rounded-xl border border-border bg-bg-card p-1">
      <div className="flex gap-1 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {tabs.map((tab) => (
          <Tooltip key={tab.value} content={tab.tooltip} position="top">
            <button
              onClick={() => onFilterChange(tab.value)}
              className={`flex shrink-0 items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                activeFilter === tab.value
                  ? "bg-button text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.value === "broadcast" && broadcastRunning && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    activeFilter === tab.value
                      ? "bg-white/20 text-white"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  sending
                </span>
              )}
              {!isAdminToolTab(tab.value) && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-xs ${
                    activeFilter === tab.value
                      ? "bg-white/20 text-white"
                      : "bg-bg-hover text-text-secondary"
                  }`}
                >
                  {counts[tab.value]}
                </span>
              )}
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

// ============ README UPDATE LOGS TAB ============
// Browses readmeUpdateLogs like the Convex logs dashboard: filter by status
// and source, text-filter by package name, select rows, delete selected,
// or clear everything. Entries come from the auto-update cron plus the
// admin and profile Update README buttons.

type ReadmeLogStatus = "success" | "failed" | "skipped";
type ReadmeLogSource = "cron" | "admin" | "profile";

function formatLogTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function ReadmeLogStatusBadge({ status }: { status: ReadmeLogStatus }) {
  const styles: Record<ReadmeLogStatus, string> = {
    success: "bg-green-500/10 text-green-600 border-green-500/20",
    failed: "bg-red-500/10 text-red-600 border-red-500/20",
    skipped: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function ReadmeUpdateLogsTab() {
  const [statusFilter, setStatusFilter] = useState<ReadmeLogStatus | "all">(
    "all",
  );
  const [sourceFilter, setSourceFilter] = useState<ReadmeLogSource | "all">(
    "all",
  );
  const [textFilter, setTextFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<"delete" | "clear" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const { results, status, loadMore } = usePaginatedQuery(
    api.readmeAutoUpdate.listReadmeUpdateLogs,
    {
      status: statusFilter === "all" ? undefined : statusFilter,
      source: sourceFilter === "all" ? undefined : sourceFilter,
    },
    { initialNumItems: 50 },
  );

  const deleteLogs = useMutation(api.readmeAutoUpdate.deleteReadmeUpdateLogs);
  const clearLogs = useMutation(api.readmeAutoUpdate.clearReadmeUpdateLogs);

  // Text filter applies client-side to the loaded page
  const trimmedFilter = textFilter.trim().toLowerCase();
  const visibleLogs = (results ?? []).filter(
    (log) =>
      trimmedFilter === "" ||
      log.packageName.toLowerCase().includes(trimmedFilter),
  );

  const allVisibleSelected =
    visibleLogs.length > 0 &&
    visibleLogs.every((log) => selectedIds.has(log._id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleLogs.map((log) => log._id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Reset selection when filters change so the count always matches visible rows
  const handleStatusFilterChange = (value: ReadmeLogStatus | "all") => {
    setStatusFilter(value);
    setSelectedIds(new Set());
  };
  const handleSourceFilterChange = (value: ReadmeLogSource | "all") => {
    setSourceFilter(value);
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setBusy(true);
    try {
      await deleteLogs({
        ids: [...selectedIds] as Array<Id<"readmeUpdateLogs">>,
      });
      toast.success(
        `${selectedIds.size} log ${selectedIds.size === 1 ? "entry" : "entries"} deleted`,
      );
      setSelectedIds(new Set());
    } catch {
      toast.error("Failed to delete logs");
    } finally {
      setBusy(false);
    }
  };

  const handleClearAll = async () => {
    setBusy(true);
    try {
      await clearLogs({});
      toast.success("Logs cleared");
      setSelectedIds(new Set());
    } catch {
      toast.error("Failed to clear logs");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-bg-card p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
            <FileText size={16} />
            README Update Logs
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            Every README update attempt from the official auto-update schedule,
            the admin Update README button, and the profile Update README
            button. The newest 500 entries are kept.
          </p>
        </div>

        {/* Filter and action controls */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <MagnifyingGlass
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <input
              type="text"
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
              placeholder="Filter by package..."
              className="w-44 rounded-lg border border-border bg-bg-primary pl-8 pr-2 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-border"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              handleStatusFilterChange(
                e.target.value as ReadmeLogStatus | "all",
              )
            }
            className="rounded-lg border border-border bg-bg-primary px-2 py-1.5 text-xs text-text-primary"
          >
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(e) =>
              handleSourceFilterChange(
                e.target.value as ReadmeLogSource | "all",
              )
            }
            className="rounded-lg border border-border bg-bg-primary px-2 py-1.5 text-xs text-text-primary"
          >
            <option value="all">All sources</option>
            <option value="cron">Auto-update</option>
            <option value="admin">Admin</option>
            <option value="profile">Profile</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setConfirmAction("delete")}
              disabled={busy || selectedIds.size === 0}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TrashSimple size={12} />
              Delete selected
              {selectedIds.size > 0 && ` (${selectedIds.size})`}
            </button>
            <button
              onClick={() => setConfirmAction("clear")}
              disabled={busy || (results ?? []).length === 0}
              className="inline-flex items-center gap-1 rounded-full border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash size={12} />
              Clear logs
            </button>
          </div>
        </div>

        {/* Log table */}
        {status === "LoadingFirstPage" ? (
          <div className="animate-pulse space-y-2">
            <div className="h-8 rounded bg-bg-secondary" />
            <div className="h-8 rounded bg-bg-secondary" />
            <div className="h-8 rounded bg-bg-secondary" />
          </div>
        ) : visibleLogs.length === 0 ? (
          <div className="rounded-lg border border-border bg-bg-primary p-6 text-center text-xs text-text-secondary">
            {(results ?? []).length === 0
              ? "No log entries yet. Entries appear when the auto-update runs or someone clicks Update README."
              : "No log entries match the current filters."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-bg-primary text-left text-text-secondary">
                  <th className="w-8 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all visible log entries"
                      className="accent-button"
                    />
                  </th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">
                    Timestamp
                  </th>
                  <th className="px-3 py-2 font-medium">Package</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Changed</th>
                  <th className="px-3 py-2 font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {visibleLogs.map((log) => (
                  <tr
                    key={log._id}
                    className={`border-b border-border last:border-b-0 transition-colors ${
                      selectedIds.has(log._id)
                        ? "bg-bg-hover"
                        : "hover:bg-bg-hover/50"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(log._id)}
                        onChange={() => toggleSelect(log._id)}
                        aria-label={`Select log entry for ${log.packageName}`}
                        className="accent-button"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-text-secondary whitespace-nowrap">
                      {formatLogTimestamp(log._creationTime)}
                    </td>
                    <td className="px-3 py-2 font-mono text-text-primary">
                      {log.packageName}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {log.source === "cron" ? "auto-update" : log.source}
                    </td>
                    <td className="px-3 py-2">
                      <ReadmeLogStatusBadge status={log.status} />
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {log.status === "success"
                        ? log.changed
                          ? "yes"
                          : "no"
                        : "-"}
                    </td>
                    <td
                      className="max-w-xs truncate px-3 py-2 text-text-secondary"
                      title={log.message ?? undefined}
                    >
                      {log.message ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Load more */}
        {status === "CanLoadMore" && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => loadMore(50)}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              Load more
            </button>
          </div>
        )}
        {status === "LoadingMore" && (
          <div className="mt-3 text-center text-xs text-text-secondary">
            Loading...
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmAction === "delete"}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleDeleteSelected}
        title="Delete selected logs?"
        message={`This permanently removes ${selectedIds.size} log ${selectedIds.size === 1 ? "entry" : "entries"}.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
      <ConfirmModal
        isOpen={confirmAction === "clear"}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleClearAll}
        title="Clear all logs?"
        message="This permanently removes every README update log entry."
        confirmText="Clear logs"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}

// Admin dashboard component
// ============ API MANAGEMENT TAB ============

function ApiManagementTab({ adminSettings }: { adminSettings: any }) {
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [granting, setGranting] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  // Round to nearest minute so the query args stay stable across renders
  const stableNow = useMemo(() => Math.floor(Date.now() / 60_000) * 60_000, []);

  const updateSetting = useMutation(api.packages.updateAdminSetting);
  const apiAnalytics = useQuery(api.apiKeys.getApiAnalytics, {
    now: stableNow,
  });
  const apiGrants = useQuery(api.apiKeys.listApiAccessGrants);
  const searchResults = useQuery(
    api.apiKeys.searchSubmitters,
    userSearchQuery.length >= 2 ? { searchQuery: userSearchQuery } : "skip",
  );
  const grantAccess = useMutation(api.apiKeys.grantApiAccess);
  const revokeAccess = useMutation(api.apiKeys.revokeApiAccess);

  const globalEnabled = adminSettings?.apiAccessEnabled || false;

  const handleToggleGlobal = async () => {
    try {
      await updateSetting({
        key: "apiAccessEnabled" as const,
        value: !globalEnabled,
      });
      toast.success(
        globalEnabled
          ? "API access disabled globally"
          : "API access enabled globally",
      );
    } catch {
      toast.error("Failed to update setting");
    }
  };

  const handleGrant = async (email: string, name?: string) => {
    setGranting(email);
    try {
      await grantAccess({ email, name });
      toast.success(`API access granted to ${email}`);
      setUserSearchQuery("");
    } catch {
      toast.error("Failed to grant access");
    } finally {
      setGranting(null);
    }
  };

  const handleRevoke = async (email: string) => {
    setRevoking(email);
    try {
      await revokeAccess({ email });
      toast.success("API access revoked");
    } catch {
      toast.error("Failed to revoke access");
    } finally {
      setRevoking(null);
    }
  };

  // Filter search results to exclude already-granted users
  const grantedEmails = new Set(
    (apiGrants || []).filter((g) => !g.revoked).map((g) => g.email),
  );
  const filteredSearch = (searchResults || []).filter(
    (s) => !grantedEmails.has(s.email),
  );

  return (
    <div className="space-y-6">
      {/* Global Toggle */}
      <div className="rounded-2xl border border-border bg-bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <Key size={16} />
              Components REST API
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              When enabled, granted users can generate API keys on their profile
              page. When disabled, all API endpoints return 503. The llms.txt
              and components.md content endpoints are not affected by this
              toggle.
            </p>
          </div>
          <button
            onClick={handleToggleGlobal}
            aria-pressed={globalEnabled}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              globalEnabled ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                globalEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
              globalEnabled
                ? "bg-green-500/10 text-green-600 border-green-500/20"
                : "bg-red-500/10 text-red-600 border-red-500/20"
            }`}
          >
            {globalEnabled ? (
              <>
                <ToggleRight size={12} /> API Enabled
              </>
            ) : (
              <>
                <ToggleLeft size={12} /> API Disabled
              </>
            )}
          </span>
        </div>
      </div>

      {/* Analytics Dashboard */}
      <div className="rounded-2xl border border-border bg-bg-card p-5">
        <h3 className="text-sm font-medium text-text-primary flex items-center gap-2 mb-4">
          <ChartBar size={16} />
          API Analytics
        </h3>
        {apiAnalytics ? (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
              <div className="rounded-lg border border-border p-3 bg-bg-primary">
                <p className="text-xs text-text-secondary">Requests (24h)</p>
                <p className="text-xl font-light text-text-primary mt-1">
                  {apiAnalytics.totalRequests24h.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 bg-bg-primary">
                <p className="text-xs text-text-secondary">Requests (7d)</p>
                <p className="text-xl font-light text-text-primary mt-1">
                  {apiAnalytics.totalRequests7d.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 bg-bg-primary">
                <p className="text-xs text-text-secondary">Active Keys</p>
                <p className="text-xl font-light text-text-primary mt-1">
                  {apiAnalytics.totalActiveKeys}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3 bg-bg-primary">
                <p className="text-xs text-text-secondary">Granted Users</p>
                <p className="text-xl font-light text-text-primary mt-1">
                  {apiAnalytics.totalGrantedUsers}
                </p>
              </div>
            </div>

            {/* Endpoint breakdown */}
            {apiAnalytics.endpointBreakdown.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs font-medium text-text-secondary mb-2">
                  Requests by endpoint (7d)
                </h4>
                <div className="space-y-1.5">
                  {apiAnalytics.endpointBreakdown.map((ep) => {
                    const max = apiAnalytics.endpointBreakdown[0]?.count || 1;
                    const pct = Math.round((ep.count / max) * 100);
                    return (
                      <div
                        key={ep.endpoint}
                        className="rounded-lg border border-border bg-bg-primary p-3 sm:border-0 sm:bg-transparent sm:p-0"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                          <span className="text-xs text-text-primary font-mono break-all sm:w-20 sm:break-normal">
                            /{ep.endpoint}
                          </span>
                          <div className="h-5 w-full rounded bg-bg-hover overflow-hidden sm:flex-1">
                            <div
                              className="h-full rounded bg-button/20"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-secondary text-right sm:w-12">
                            {ep.count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent requests */}
            {apiAnalytics.recentRequests.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-text-secondary mb-2">
                  Recent requests
                </h4>
                <div className="space-y-2 sm:hidden">
                  {apiAnalytics.recentRequests.map((req, i) => (
                    <div
                      key={`${req.endpoint}-${req.requestedAt}-${i}`}
                      className="rounded-lg border border-border bg-bg-primary p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-mono text-text-primary break-all">
                            /{req.endpoint}
                          </p>
                          <p className="mt-1 text-[11px] text-text-secondary">
                            {new Date(req.requestedAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            req.responseStatus >= 400
                              ? "bg-red-500/10 text-red-600"
                              : "bg-green-500/10 text-green-600"
                          }`}
                        >
                          {req.responseStatus}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-text-secondary">
                        <span className="inline-flex rounded-full bg-bg-hover px-2 py-0.5">
                          {req.hasApiKey ? "API key" : "Anonymous"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden max-h-48 overflow-y-auto rounded-lg border border-border sm:block">
                  <table className="w-full text-xs">
                    <thead className="bg-bg-hover sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-medium text-text-secondary">
                          Endpoint
                        </th>
                        <th className="text-left px-3 py-1.5 font-medium text-text-secondary">
                          Status
                        </th>
                        <th className="text-left px-3 py-1.5 font-medium text-text-secondary">
                          Auth
                        </th>
                        <th className="text-left px-3 py-1.5 font-medium text-text-secondary">
                          Time
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {apiAnalytics.recentRequests.map((req, i) => (
                        <tr key={i} className="hover:bg-bg-hover/50">
                          <td className="px-3 py-1.5 font-mono">
                            /{req.endpoint}
                          </td>
                          <td className="px-3 py-1.5">
                            <span
                              className={`${
                                req.responseStatus >= 400
                                  ? "text-red-600"
                                  : "text-green-600"
                              }`}
                            >
                              {req.responseStatus}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">
                            {req.hasApiKey ? (
                              <span className="text-green-600">Key</span>
                            ) : (
                              <span className="text-text-tertiary">Anon</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-text-secondary">
                            {new Date(req.requestedAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-button" />
          </div>
        )}
      </div>

      {/* User Access Management */}
      <div className="rounded-2xl border border-border bg-bg-card p-5">
        <h3 className="text-sm font-medium text-text-primary flex items-center gap-2 mb-4">
          <ShieldCheck size={16} />
          User Access Management
        </h3>

        {/* Search for users */}
        <div className="mb-4">
          <label className="block text-xs text-text-secondary mb-1.5">
            Search submitters to grant API access
          </label>
          <div className="relative">
            <MagnifyingGlass
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="text"
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-bg-primary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-button/30"
            />
          </div>
          {userSearchQuery.length >= 2 && filteredSearch.length > 0 && (
            <div className="mt-2 rounded-lg border border-border bg-bg-primary max-h-40 overflow-y-auto divide-y divide-border">
              {filteredSearch.map((user) => (
                <div
                  key={user.email}
                  className="flex flex-col gap-2 px-3 py-2 hover:bg-bg-hover/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text-primary">
                      {user.name}
                    </p>
                    <p className="text-[10px] text-text-secondary break-all">
                      {user.email} &middot; {user.submissionCount} submission
                      {user.submissionCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleGrant(user.email, user.name)}
                    disabled={granting === user.email}
                    className="self-start px-3 py-1 text-xs rounded-full bg-button text-white hover:bg-button-hover transition-colors disabled:opacity-50 sm:self-auto"
                  >
                    {granting === user.email ? "Granting..." : "Grant Access"}
                  </button>
                </div>
              ))}
            </div>
          )}
          {userSearchQuery.length >= 2 &&
            filteredSearch.length === 0 &&
            searchResults && (
              <p className="mt-2 text-xs text-text-tertiary">
                No matching submitters found.
              </p>
            )}
        </div>

        {/* Granted users list */}
        <div>
          <h4 className="text-xs font-medium text-text-secondary mb-2">
            Granted users ({(apiGrants || []).filter((g) => !g.revoked).length})
          </h4>
          {apiGrants && apiGrants.length > 0 ? (
            <div className="rounded-lg border border-border divide-y divide-border">
              {apiGrants.map((grant) => (
                <div
                  key={grant._id}
                  className={`flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
                    grant.revoked ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium text-text-primary truncate">
                        {grant.name || grant.email}
                      </p>
                      {grant.revoked && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-red-500/10 text-red-600 border border-red-500/20">
                          Revoked
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-secondary mt-0.5 break-all">
                      {grant.email} &middot; Granted{" "}
                      {new Date(grant.grantedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      by {grant.grantedBy}
                    </p>
                  </div>
                  {!grant.revoked && (
                    <button
                      onClick={() => handleRevoke(grant.email)}
                      disabled={revoking === grant.email}
                      className="self-start px-3 py-1 text-xs rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 sm:self-auto"
                    >
                      {revoking === grant.email ? "Revoking..." : "Revoke"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 rounded-lg border border-border bg-bg-primary">
              <Users size={24} className="mx-auto text-text-tertiary mb-2" />
              <p className="text-xs text-text-secondary">
                No users have been granted API access yet.
              </p>
              <p className="text-[10px] text-text-tertiary mt-1">
                Search for a submitter above to grant them access.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({
  userEmail,
  packages,
  searchTerm,
  setSearchTerm,
}: {
  userEmail?: string;
  packages: any[] | undefined;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}) {
  // Admin settings for default reward amount
  const adminSettings = useQuery(api.packages.getAdminSettings);
  const defaultRewardAmount = adminSettings?.defaultRewardAmount ?? 25;

  // Default to all to show complete overview first
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  // Pagination state - track current page for each filter
  const [currentPage, setCurrentPage] = useState<Record<FilterType, number>>({
    all: 1,
    pending: 1,
    in_review: 1,
    approved: 1,
    changes_requested: 1,
    rejected: 1,
    marked_for_deletion: 1,
    archived: 1,
    ...emptyToolTabPages(),
  });
  // Items per page options
  type ItemsPerPageOption = 5 | 10 | 20 | 40 | 100;
  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPageOption>(20);
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] =
    useState(false);
  const itemsPerPageOptions: ItemsPerPageOption[] = [5, 10, 20, 40, 100];

  // Track which packages are expanded (open)
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(
    new Set(),
  );
  // Hash-driven scroll + highlight + auto-expand (e.g. /submissions/admin#pkg-<id>)
  const [hashTargetPackageId, setHashTargetPackageId] = useState<string | null>(
    null,
  );
  const hashTargetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const parseHash = () => {
      if (window.location.hash === "#settings-github-broadcast") {
        setActiveFilter("broadcast");
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${window.location.search}`,
        );
        return;
      }
      const match = window.location.hash.match(/^#pkg-(.+)$/);
      if (!match) return;
      const id = match[1];
      setHashTargetPackageId(id);
      setExpandedPackages((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      // Fade the highlight after 4s so pagination / filter jumps have time to render first.
      window.setTimeout(
        () => setHashTargetPackageId((cur) => (cur === id ? null : cur)),
        4000,
      );
    };
    parseHash();
    window.addEventListener("hashchange", parseHash);
    return () => window.removeEventListener("hashchange", parseHash);
  }, []);
  // Sort option state
  type SortOption =
    | "newest"
    | "oldest"
    | "name_asc"
    | "name_desc"
    | "downloads"
    | "verified"
    | "community"
    | "featured"
    | "approved_at";
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // When the hash target is on a different page or excluded by the current
  // filter, switch the filter to "all" and/or jump to the correct page so the
  // scroll + highlight effect above can find the element in the DOM.
  useEffect(() => {
    if (!hashTargetPackageId || !packages) return;

    const targetPkg = packages.find((p: any) => p._id === hashTargetPackageId);
    if (!targetPkg) return;

    const pkgIsArchived = targetPkg.visibility === "archived";
    const pkgStatus = targetPkg.reviewStatus || "pending";

    // Does the current filter include this package?
    const matchesCurrentFilter = (() => {
      if (isAdminToolTab(activeFilter)) return false;
      if (activeFilter === "marked_for_deletion")
        return targetPkg.markedForDeletion === true;
      if (activeFilter === "archived") return pkgIsArchived;
      if (pkgIsArchived) return false;
      if (activeFilter === "all") return true;
      return pkgStatus === activeFilter;
    })();

    if (!matchesCurrentFilter) {
      // Pick the most useful filter for the target package.
      const nextFilter: FilterType = pkgIsArchived
        ? "archived"
        : targetPkg.markedForDeletion
          ? "marked_for_deletion"
          : "all";
      if (nextFilter !== activeFilter) setActiveFilter(nextFilter);
      return;
    }

    // Replicate the filter + sort used for rendering so we can locate the index.
    const filtered = packages.filter((pkg: any) => {
      if (isAdminToolTab(activeFilter)) return false;
      if (activeFilter === "marked_for_deletion")
        return pkg.markedForDeletion === true;
      if (activeFilter === "archived") return pkg.visibility === "archived";
      if (pkg.visibility === "archived") return false;
      if (activeFilter === "all") return true;
      const status = pkg.reviewStatus || "pending";
      return status === activeFilter;
    });

    const sorted = [...filtered].sort((a: any, b: any) => {
      switch (sortBy) {
        case "newest":
          return b.submittedAt - a.submittedAt;
        case "oldest":
          return a.submittedAt - b.submittedAt;
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "downloads":
          return b.weeklyDownloads - a.weeklyDownloads;
        case "approved_at": {
          const approvedSort = (b.approvedAt ?? 0) - (a.approvedAt ?? 0);
          return approvedSort !== 0
            ? approvedSort
            : b.submittedAt - a.submittedAt;
        }
        case "verified": {
          const s =
            Number(Boolean(b.convexVerified)) -
            Number(Boolean(a.convexVerified));
          return s !== 0 ? s : b.submittedAt - a.submittedAt;
        }
        case "community": {
          const s =
            Number(Boolean(b.communitySubmitted)) -
            Number(Boolean(a.communitySubmitted));
          return s !== 0 ? s : b.submittedAt - a.submittedAt;
        }
        case "featured": {
          const s = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
          return s !== 0 ? s : b.submittedAt - a.submittedAt;
        }
        default:
          return 0;
      }
    });

    const index = sorted.findIndex((p: any) => p._id === hashTargetPackageId);
    if (index === -1) return;

    const targetPage = Math.floor(index / itemsPerPage) + 1;
    setCurrentPage((prev) => {
      if (prev[activeFilter] === targetPage) return prev;
      return { ...prev, [activeFilter]: targetPage };
    });
  }, [hashTargetPackageId, packages, activeFilter, itemsPerPage, sortBy]);

  // Scroll the target row into view once it actually mounts. Re-runs whenever the
  // page, filter, or hash target changes so a pagination jump finishes before we scroll.
  useEffect(() => {
    if (!hashTargetPackageId) return;
    const el = hashTargetRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hashTargetPackageId, activeFilter, currentPage]);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = useState<string>(
    ADMIN_SETTINGS_SECTIONS[0].id,
  );

  // Reset page to 1 when filter changes
  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    setCurrentPage((prev) => ({ ...prev, [filter]: 1 }));
  };

  useEffect(() => {
    if (activeFilter !== "settings") return;

    const sections = ADMIN_SETTINGS_SECTIONS.map((section) =>
      document.getElementById(section.id),
    ).filter((section): section is HTMLElement => section !== null);

    if (sections.length === 0) return;

    const updateActiveSection = () => {
      let nextSection = sections[0].id;

      for (const section of sections) {
        if (section.getBoundingClientRect().top <= 180) {
          nextSection = section.id;
        }
      }

      setActiveSettingsSection((prev) =>
        prev === nextSection ? prev : nextSection,
      );
    };

    const observer = new IntersectionObserver(
      () => {
        updateActiveSection();
      },
      {
        rootMargin: "-160px 0px -55% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    sections.forEach((section) => observer.observe(section));
    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateActiveSection);
    };
  }, [activeFilter]);

  // Reset all pages to 1 when items per page changes
  const handleItemsPerPageChange = (value: ItemsPerPageOption) => {
    setItemsPerPage(value);
    setCurrentPage({
      all: 1,
      pending: 1,
      in_review: 1,
      approved: 1,
      changes_requested: 1,
      rejected: 1,
      marked_for_deletion: 1,
      archived: 1,
      ...emptyToolTabPages(),
    });
    setShowItemsPerPageDropdown(false);
  };

  // Sort options config
  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "name_asc", label: "Name A-Z" },
    { value: "name_desc", label: "Name Z-A" },
    { value: "downloads", label: "Most downloads" },
    { value: "approved_at", label: "Recently approved" },
    { value: "verified", label: "Verified first" },
    { value: "community", label: "Community first" },
    { value: "featured", label: "Featured first" },
  ];

  // Toggle a package's expanded state
  const togglePackage = (packageId: string) => {
    setExpandedPackages((prev) => {
      const next = new Set(prev);
      if (next.has(packageId)) {
        next.delete(packageId);
      } else {
        next.add(packageId);
      }
      return next;
    });
  };

  // Helper to check if package is archived (visibility = "archived")
  const isArchived = (pkg: any) => pkg.visibility === "archived";

  // Calculate counts for each status - archived are excluded from other counts
  const nonArchivedPackages = packages?.filter((p) => !isArchived(p)) ?? [];
  const archivedPackages = packages?.filter((p) => isArchived(p)) ?? [];

  // Packages marked for deletion (across all statuses)
  const markedForDeletionPackages =
    packages?.filter((p) => p.markedForDeletion) ?? [];

  const counts: Record<FilterType, number> = {
    all: nonArchivedPackages.length,
    settings: 0,
    api: 0,
    logs: 0,
    growth: 0,
    broadcast: 0,
    pending: nonArchivedPackages.filter(
      (p) => !p.reviewStatus || p.reviewStatus === "pending",
    ).length,
    in_review: nonArchivedPackages.filter((p) => p.reviewStatus === "in_review")
      .length,
    approved: nonArchivedPackages.filter((p) => p.reviewStatus === "approved")
      .length,
    changes_requested: nonArchivedPackages.filter(
      (p) => p.reviewStatus === "changes_requested",
    ).length,
    rejected: nonArchivedPackages.filter((p) => p.reviewStatus === "rejected")
      .length,
    marked_for_deletion: markedForDeletionPackages.length,
    archived: archivedPackages.length,
  };

  // Filter packages based on active filter
  const filteredPackages = packages?.filter((pkg) => {
    // Tool tabs show their own views, not the package list
    if (isAdminToolTab(activeFilter)) return false;
    // Marked for deletion tab shows only packages marked for deletion
    if (activeFilter === "marked_for_deletion")
      return pkg.markedForDeletion === true;
    // Archived tab shows only archived packages
    if (activeFilter === "archived") return isArchived(pkg);
    // All other tabs exclude archived packages
    if (isArchived(pkg)) return false;
    if (activeFilter === "all") return true;
    const status = pkg.reviewStatus || "pending";
    return status === activeFilter;
  });

  // Sort packages based on selected sort option
  const sortPackages = (pkgs: any[]) => {
    return [...pkgs].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return b.submittedAt - a.submittedAt;
        case "oldest":
          return a.submittedAt - b.submittedAt;
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "downloads":
          return b.weeklyDownloads - a.weeklyDownloads;
        case "approved_at": {
          const approvedSort = (b.approvedAt ?? 0) - (a.approvedAt ?? 0);
          return approvedSort !== 0
            ? approvedSort
            : b.submittedAt - a.submittedAt;
        }
        case "verified": {
          const verifiedSort =
            Number(Boolean(b.convexVerified)) -
            Number(Boolean(a.convexVerified));
          return verifiedSort !== 0
            ? verifiedSort
            : b.submittedAt - a.submittedAt;
        }
        case "community": {
          const communitySort =
            Number(Boolean(b.communitySubmitted)) -
            Number(Boolean(a.communitySubmitted));
          return communitySort !== 0
            ? communitySort
            : b.submittedAt - a.submittedAt;
        }
        case "featured": {
          const featuredSort =
            Number(Boolean(b.featured)) - Number(Boolean(a.featured));
          return featuredSort !== 0
            ? featuredSort
            : b.submittedAt - a.submittedAt;
        }
        default:
          return b.submittedAt - a.submittedAt;
      }
    });
  };

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getSubmissionDateMeta = (pkg: {
    submittedAt: number;
    approvedAt?: number;
  }) => {
    if (sortBy === "approved_at" && pkg.approvedAt) {
      return {
        label: "Approved",
        timestamp: pkg.approvedAt,
      };
    }

    return {
      label: "Submitted",
      timestamp: pkg.submittedAt,
    };
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Mobile search bar */}
      <div
        className={`mb-4 sm:hidden ${isAdminToolTab(activeFilter) ? "hidden" : ""}`}
      >
        <div className="relative">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
          />
          <input
            type="text"
            placeholder="Search packages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-full border border-border bg-white text-text-primary text-sm outline-none focus:border-button transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-4">
        <FilterTabs
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          counts={counts}
        />
      </div>

      {/* Submissions list (hidden on tool tabs) */}
      {!isAdminToolTab(activeFilter) && (
        <div className="rounded-lg border border-border bg-light shadow-sm mb-6">
          <div className="p-3 border-b border-border bg-bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <h2 className="text-base font-light text-text-primary">
              Package Submissions
            </h2>
            <div className="flex items-center gap-3">
              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-white text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                >
                  <SortAscending size={14} />
                  <span className="hidden sm:inline">
                    {sortOptions.find((o) => o.value === sortBy)?.label}
                  </span>
                  <CaretDown
                    size={12}
                    className={`transition-transform ${showSortDropdown ? "rotate-180" : ""}`}
                  />
                </button>
                {showSortDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowSortDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] py-1 rounded-lg border border-border bg-white shadow-lg">
                      {sortOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setSortBy(option.value);
                            setShowSortDropdown(false);
                          }}
                          className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                            sortBy === option.value
                              ? "bg-bg-hover text-text-primary font-medium"
                              : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Items per page dropdown */}
              <div className="relative">
                <button
                  onClick={() =>
                    setShowItemsPerPageDropdown(!showItemsPerPageDropdown)
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-white text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                >
                  <List size={14} />
                  <span className="hidden sm:inline">{itemsPerPage}</span>
                  <span className="sm:hidden">{itemsPerPage}</span>
                  <CaretDown
                    size={12}
                    className={`transition-transform ${showItemsPerPageDropdown ? "rotate-180" : ""}`}
                  />
                </button>
                {showItemsPerPageDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowItemsPerPageDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-20 min-w-[80px] py-1 rounded-lg border border-border bg-white shadow-lg">
                      {itemsPerPageOptions.map((option) => (
                        <button
                          key={option}
                          onClick={() => handleItemsPerPageChange(option)}
                          className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                            itemsPerPage === option
                              ? "bg-bg-hover text-text-primary font-medium"
                              : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                          }`}
                        >
                          {option} per page
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <span className="text-xs text-text-secondary">
                Showing{" "}
                {Math.min(
                  (currentPage[activeFilter] - 1) * itemsPerPage + 1,
                  filteredPackages?.length ?? 0,
                )}
                -
                {Math.min(
                  currentPage[activeFilter] * itemsPerPage,
                  filteredPackages?.length ?? 0,
                )}{" "}
                of {filteredPackages?.length ?? 0}
              </span>
            </div>
          </div>

          {packages === undefined ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto border-button"></div>
            </div>
          ) : filteredPackages?.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              {searchTerm
                ? "No packages found matching your search."
                : "No packages found for this filter."}
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-4">
              {sortPackages(filteredPackages || [])
                .slice(
                  (currentPage[activeFilter] - 1) * itemsPerPage,
                  currentPage[activeFilter] * itemsPerPage,
                )
                .map((pkg) => {
                  const isExpanded = expandedPackages.has(pkg._id);
                  const dateMeta = getSubmissionDateMeta(pkg);
                  const isHashTarget = hashTargetPackageId === pkg._id;
                  return (
                    <div
                      key={pkg._id}
                      id={`pkg-${pkg._id}`}
                      ref={isHashTarget ? hashTargetRef : undefined}
                      className={`rounded-lg border bg-white transition-colors ${
                        isHashTarget
                          ? "border-[#E05C35] ring-2 ring-[#E05C35]"
                          : "border-border"
                      }`}
                    >
                      {/* Collapsible header - always visible */}
                      <button
                        onClick={() => togglePackage(pkg._id)}
                        className="w-full p-4 flex items-center justify-between gap-4 hover:bg-bg-hover/30 transition-colors text-left"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 min-w-0 flex-1">
                          {/* Primary row on mobile / inline on desktop: caret + thumb + star + name */}
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 w-full sm:w-auto sm:flex-1">
                            <CaretRight
                              size={16}
                              weight="bold"
                              className={`shrink-0 text-text-secondary transition-transform duration-200 ${
                                isExpanded ? "rotate-90" : ""
                              }`}
                            />
                            {pkg.thumbnailUrl && (
                              <img
                                src={pkg.thumbnailUrl}
                                alt=""
                                className="w-8 h-5 object-cover rounded shrink-0"
                              />
                            )}
                            {pkg.featured && (
                              <Star
                                size={16}
                                weight="fill"
                                className="text-amber-500 shrink-0"
                              />
                            )}
                            <span className="font-medium text-text-primary truncate min-w-0 flex-1">
                              {pkg.componentName || pkg.name}
                            </span>
                          </div>
                          {/* Secondary row on mobile / inline on desktop: version + badges */}
                          <div className="flex items-center gap-2 sm:gap-3 flex-wrap pl-6 sm:pl-0 sm:shrink-0 sm:min-h-7">
                            <span className="inline-flex items-center text-xs leading-none px-2 py-0.5 rounded-full bg-bg-primary text-text-secondary border border-border shrink-0">
                              v{pkg.version}
                            </span>
                            <StatusBadge status={pkg.reviewStatus} />
                            <VisibilityBadge
                              visibility={pkg.visibility}
                              markedForDeletion={pkg.markedForDeletion}
                            />
                            {pkg.pendingNpmName && (
                              <Tooltip
                                content={`npm URL points to ${pkg.pendingNpmName}`}
                              >
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium leading-none border bg-amber-500/10 text-amber-600 border-amber-500/20">
                                  <Warning size={14} weight="bold" />
                                  <span className="hidden sm:inline">
                                    npm mismatch
                                  </span>
                                </span>
                              </Tooltip>
                            )}
                            <span className="hidden sm:inline-flex">
                              <PaymentBadge
                                rewardStatus={pkg.rewardStatus}
                                rewardTotalAmount={pkg.rewardTotalAmount}
                              />
                            </span>
                            <span className="hidden sm:inline-flex">
                              <ComponentDetailQuickLink slug={pkg.slug} />
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 self-center text-xs text-text-secondary whitespace-nowrap">
                          <span className="hidden sm:inline-flex sm:items-center sm:self-center">
                            {pkg.weeklyDownloads.toLocaleString()}/wk
                          </span>
                          <span className="inline-flex items-center self-center">
                            {formatDate(dateMeta.timestamp)}
                          </span>
                        </div>
                      </button>

                      {/* Expandable content */}
                      {isExpanded && (
                        <div>
                          {/* Package details */}
                          <div className="px-4 flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-4 pb-4">
                            <div className="w-full flex-1 min-w-0">
                              <p className="text-sm text-text-secondary mb-3 line-clamp-2">
                                {pkg.description}
                              </p>

                              {/* Pending npm rename review */}
                              {pkg.pendingNpmName && (
                                <NpmMismatchPanel
                                  packageId={pkg._id}
                                  currentName={pkg.name}
                                  pendingNpmName={pkg.pendingNpmName}
                                />
                              )}

                              {/* Submitter Info (name, discord, email all editable) */}
                              <AuthorToggleSection
                                packageId={pkg._id}
                                submitterEmail={pkg.submitterEmail}
                                additionalEmails={pkg.additionalEmails}
                                submitterName={pkg.submitterName}
                                submitterDiscord={pkg.submitterDiscord}
                              />

                              {/* AI Review Results */}
                              <AiReviewResultsPanel
                                aiReviewStatus={pkg.aiReviewStatus}
                                aiReviewSummary={pkg.aiReviewSummary}
                                aiReviewCriteria={pkg.aiReviewCriteria}
                                aiReviewError={pkg.aiReviewError}
                                aiReviewedAt={pkg.aiReviewedAt}
                                packageName={pkg.name}
                                collaborators={pkg.collaborators}
                                npmUrl={pkg.npmUrl}
                                repositoryUrl={pkg.repositoryUrl}
                                packageId={pkg._id}
                              />

                              <PackageComponentDetailsEditor
                                packageId={pkg._id}
                                componentName={pkg.componentName}
                                slug={pkg.slug}
                                category={pkg.category}
                                tags={pkg.tags}
                                shortDescription={pkg.shortDescription}
                                longDescription={pkg.longDescription}
                                videoUrl={pkg.videoUrl}
                                videoPosition={pkg.videoPosition}
                                demoUrl={pkg.demoUrl}
                                thumbnailUrl={pkg.thumbnailUrl}
                                hideThumbnailInCategory={
                                  pkg.hideThumbnailInCategory
                                }
                                thumbnailUploadedByUser={
                                  pkg.thumbnailUploadedByUser
                                }
                                convexVerified={pkg.convexVerified}
                                communitySubmitted={pkg.communitySubmitted}
                                authorUsername={pkg.authorUsername}
                                authorAvatar={pkg.authorAvatar}
                                logoUrl={pkg.logoUrl}
                                logoStorageId={pkg.logoStorageId}
                                selectedTemplateId={pkg.selectedTemplateId}
                                thumbnailGeneratedAt={pkg.thumbnailGeneratedAt}
                                seoGenerationStatus={pkg.seoGenerationStatus}
                                seoGeneratedAt={pkg.seoGeneratedAt}
                                seoGenerationError={pkg.seoGenerationError}
                                seoValueProp={pkg.seoValueProp}
                                seoBenefits={pkg.seoBenefits}
                                seoUseCases={pkg.seoUseCases}
                                seoFaq={pkg.seoFaq}
                                seoResourceLinks={pkg.seoResourceLinks}
                                contentModelVersion={pkg.contentModelVersion}
                                contentGenerationStatus={
                                  pkg.contentGenerationStatus
                                }
                                contentGeneratedAt={pkg.contentGeneratedAt}
                                contentGenerationError={
                                  pkg.contentGenerationError
                                }
                                generatedDescription={pkg.generatedDescription}
                                generatedUseCases={pkg.generatedUseCases}
                                generatedHowItWorks={pkg.generatedHowItWorks}
                                readmeIncludedMarkdown={
                                  pkg.readmeIncludedMarkdown
                                }
                                readmeIncludeSource={pkg.readmeIncludeSource}
                                skillMd={pkg.skillMd}
                                npmDescription={pkg.description}
                                repositoryUrl={pkg.repositoryUrl}
                                npmUrl={pkg.npmUrl}
                                submittedShortDescription={
                                  pkg.submittedShortDescription
                                }
                                submittedLongDescription={
                                  pkg.submittedLongDescription
                                }
                              />
                              <PackageMetadataEditor
                                packageId={pkg._id}
                                initialName={pkg.name}
                                initialDescription={pkg.description}
                                initialNpmUrl={pkg.npmUrl}
                                initialRepositoryUrl={pkg.repositoryUrl}
                                initialHomepageUrl={pkg.homepageUrl}
                                initialInstallCommand={pkg.installCommand}
                                initialVersion={pkg.version}
                                initialLicense={pkg.license}
                                initialWeeklyDownloads={pkg.weeklyDownloads}
                                initialTotalFiles={pkg.totalFiles}
                                initialLastPublish={pkg.lastPublish}
                                initialCollaborators={pkg.collaborators}
                              />
                            </div>

                            {/* Stats and links */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 shrink-0 w-full sm:w-auto">
                              <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1 text-sm text-text-secondary">
                                <Tooltip content="Weekly downloads">
                                  <div className="flex items-center gap-1 whitespace-nowrap">
                                    <DownloadSimple size={14} />
                                    <span>
                                      {pkg.weeklyDownloads.toLocaleString()}/wk
                                    </span>
                                  </div>
                                </Tooltip>
                                <Tooltip
                                  content={`${dateMeta.label}: ${formatDate(dateMeta.timestamp)}`}
                                >
                                  <div className="flex items-center gap-1 whitespace-nowrap">
                                    <CalendarBlank size={14} />
                                    <span>
                                      {formatDate(dateMeta.timestamp)}
                                    </span>
                                  </div>
                                </Tooltip>
                              </div>

                              {/* Links */}
                              <div className="flex gap-1 sm:ml-0 flex-wrap">
                                <Tooltip content="View on npm">
                                  <a
                                    href={pkg.npmUrl}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      window.open(
                                        pkg.npmUrl,
                                        "_blank",
                                        "noopener,noreferrer",
                                      );
                                    }}
                                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-button text-white hover:bg-button-hover transition-colors cursor-pointer"
                                  >
                                    npm
                                  </a>
                                </Tooltip>
                                {pkg.repositoryUrl && (
                                  <Tooltip content="View repository">
                                    <a
                                      href={pkg.repositoryUrl}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        window.open(
                                          pkg.repositoryUrl,
                                          "_blank",
                                          "noopener,noreferrer",
                                        );
                                      }}
                                      className="px-3 py-1.5 rounded-full text-xs font-medium border border-border text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                                    >
                                      repo
                                    </a>
                                  </Tooltip>
                                )}
                                {pkg.demoUrl && (
                                  <Tooltip content="View live demo">
                                    <a
                                      href={pkg.demoUrl}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        window.open(
                                          pkg.demoUrl,
                                          "_blank",
                                          "noopener,noreferrer",
                                        );
                                      }}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-border text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                                    >
                                      <Browser size={12} />
                                      demo
                                    </a>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Inline action buttons */}
                          <InlineActions
                            packageId={pkg._id}
                            currentStatus={pkg.reviewStatus}
                            currentVisibility={pkg.visibility}
                            currentFeatured={pkg.featured}
                            currentFeaturedSortOrder={pkg.featuredSortOrder}
                            currentHideFromSubmissions={pkg.hideFromSubmissions}
                            userEmail={userEmail || ""}
                            packageName={pkg.name}
                            repositoryUrl={pkg.repositoryUrl}
                            isArchivedView={activeFilter === "archived"}
                            convexVerified={pkg.convexVerified}
                            communitySubmitted={pkg.communitySubmitted}
                            hideSeoAndSkillContentOnDetailPage={
                              pkg.hideSeoAndSkillContentOnDetailPage
                            }
                            seoGenerationStatus={pkg.seoGenerationStatus}
                            npmDescription={pkg.description}
                            hideThumbnailInCategory={
                              pkg.hideThumbnailInCategory
                            }
                            thumbnailUrl={pkg.thumbnailUrl}
                            lastRefreshedAt={pkg.lastRefreshedAt}
                            refreshError={pkg.refreshError}
                            slug={pkg.slug}
                            submitterEmail={pkg.submitterEmail}
                            rewardStatus={pkg.rewardStatus}
                            defaultRewardAmount={defaultRewardAmount}
                            reviewedBy={pkg.reviewedBy}
                            hasSkillMd={Boolean(pkg.skillMd)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* Pagination controls */}
              {(() => {
                const totalPages = Math.ceil(
                  (filteredPackages?.length ?? 0) / itemsPerPage,
                );
                const page = currentPage[activeFilter];
                if (totalPages <= 1) return null;

                return (
                  <div className="flex items-center justify-center gap-2 pt-4 border-t border-border mt-4">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => ({
                          ...prev,
                          [activeFilter]: Math.max(1, page - 1),
                        }))
                      }
                      disabled={page === 1}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (pageNum) => (
                          <button
                            key={pageNum}
                            onClick={() =>
                              setCurrentPage((prev) => ({
                                ...prev,
                                [activeFilter]: pageNum,
                              }))
                            }
                            className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                              page === pageNum
                                ? "bg-button text-white"
                                : "border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                            }`}
                          >
                            {pageNum}
                          </button>
                        ),
                      )}
                    </div>

                    <button
                      onClick={() =>
                        setCurrentPage((prev) => ({
                          ...prev,
                          [activeFilter]: Math.min(totalPages, page + 1),
                        }))
                      }
                      disabled={page === totalPages}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Settings view: Categories, Auto-Refresh, AI Review, Stats */}
      {activeFilter === "settings" && (
        <>
          <AdminSettingsJumpNav
            activeSection={activeSettingsSection}
            onSelect={(sectionId) => {
              setActiveSettingsSection(sectionId);
              scrollToAdminSettingsSection(sectionId);
            }}
          />

          <div className="2xl:grid 2xl:grid-cols-[minmax(0,1fr)_14rem] 2xl:items-start 2xl:gap-6">
            <div className="min-w-0">
              <div id="settings-categories" className="scroll-mt-28">
                <CategoryManagementPanel />
              </div>

              <div id="settings-auto-refresh" className="scroll-mt-28">
                <AutoRefreshSettingsPanel />
              </div>

              <div id="settings-downloads-display" className="scroll-mt-28">
                <DownloadsDisplaySettingsPanel />
              </div>

              <div id="settings-submit-listing" className="scroll-mt-28">
                <SubmitListingSettingsPanel />
              </div>

              <div id="settings-security-scan" className="scroll-mt-28">
                <SecurityScanSettingsPanel />
              </div>

              <div id="settings-ai-review" className="scroll-mt-28">
                <AdminSettingsPanel />
              </div>

              <div id="settings-rewards" className="scroll-mt-28">
                <RewardSettingsPanel />
              </div>

              <div id="settings-ai-providers" className="scroll-mt-28">
                <AiProviderSettingsPanel />
              </div>

              <div id="settings-ai-prompt" className="scroll-mt-28">
                <AiPromptSettingsPanel />
              </div>

              <div id="settings-seo-prompt" className="scroll-mt-28">
                <SeoPromptSettingsPanel />
              </div>

              <div id="settings-deletion" className="scroll-mt-28">
                <DeletionManagementPanel />
              </div>

              <div id="settings-slugs" className="scroll-mt-28">
                <SlugMigrationPanel />
              </div>

              <div id="settings-content-migration" className="scroll-mt-28">
                <ContentMigrationPanel />
              </div>

              <div id="settings-templates" className="scroll-mt-28">
                <ThumbnailTemplatePanel />
              </div>

              {/* Stats section */}
              <div
                id="settings-stats"
                className="scroll-mt-28 rounded-lg border border-border bg-bg-card p-4"
              >
                <h3 className="text-sm font-medium text-text-primary mb-3">
                  Stats
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  <Tooltip
                    content="Total packages (excluding archived)"
                    position="top"
                  >
                    <div className="rounded-lg border border-border p-2 bg-bg-primary">
                      <div className="flex items-center gap-1 text-text-secondary mb-1">
                        <Package size={12} />
                        <p className="text-xs">Total</p>
                      </div>
                      <p className="text-lg font-light text-text-primary">
                        {counts.all}
                      </p>
                    </div>
                  </Tooltip>
                  <Tooltip content="Packages awaiting review" position="top">
                    <div className="rounded-lg border border-border p-2 bg-bg-primary">
                      <div className="flex items-center gap-1 text-text-secondary mb-1">
                        <Hourglass size={12} />
                        <p className="text-xs">Pending</p>
                      </div>
                      <p className="text-lg font-light text-yellow-600">
                        {counts.pending}
                      </p>
                    </div>
                  </Tooltip>
                  <Tooltip content="Packages in review" position="top">
                    <div className="rounded-lg border border-border p-2 bg-bg-primary">
                      <div className="flex items-center gap-1 text-text-secondary mb-1">
                        <GitPullRequest size={12} />
                        <p className="text-xs">Review</p>
                      </div>
                      <p className="text-lg font-light text-blue-600">
                        {counts.in_review}
                      </p>
                    </div>
                  </Tooltip>
                  <Tooltip content="Approved packages" position="top">
                    <div className="rounded-lg border border-border p-2 bg-bg-primary">
                      <div className="flex items-center gap-1 text-text-secondary mb-1">
                        <CheckCircle size={12} />
                        <p className="text-xs">Approved</p>
                      </div>
                      <p className="text-lg font-light text-green-600">
                        {counts.approved}
                      </p>
                    </div>
                  </Tooltip>
                  <Tooltip content="Packages needing changes" position="top">
                    <div className="rounded-lg border border-border p-2 bg-bg-primary">
                      <div className="flex items-center gap-1 text-text-secondary mb-1">
                        <Warning size={12} />
                        <p className="text-xs">Changes</p>
                      </div>
                      <p className="text-lg font-light text-orange-600">
                        {counts.changes_requested}
                      </p>
                    </div>
                  </Tooltip>
                  <Tooltip content="Rejected packages" position="top">
                    <div className="rounded-lg border border-border p-2 bg-bg-primary">
                      <div className="flex items-center gap-1 text-text-secondary mb-1">
                        <Prohibit size={12} />
                        <p className="text-xs">Rejected</p>
                      </div>
                      <p className="text-lg font-light text-red-600">
                        {counts.rejected}
                      </p>
                    </div>
                  </Tooltip>
                  <Tooltip content="Archived packages" position="top">
                    <div className="rounded-lg border border-border p-2 bg-bg-primary">
                      <div className="flex items-center gap-1 text-text-secondary mb-1">
                        <Archive size={12} />
                        <p className="text-xs">Archived</p>
                      </div>
                      <p className="text-lg font-light text-purple-600">
                        {counts.archived}
                      </p>
                    </div>
                  </Tooltip>
                  <Tooltip content="Combined weekly downloads" position="top">
                    <div className="rounded-lg border border-border p-2 bg-bg-primary">
                      <div className="flex items-center gap-1 text-text-secondary mb-1">
                        <DownloadSimple size={12} />
                        <p className="text-xs">Downloads</p>
                      </div>
                      <p className="text-lg font-light text-text-primary">
                        {nonArchivedPackages
                          .reduce((sum, pkg) => sum + pkg.weeklyDownloads, 0)
                          .toLocaleString()}
                      </p>
                    </div>
                  </Tooltip>
                </div>
              </div>
            </div>

            <aside className="hidden 2xl:block 2xl:self-start 2xl:sticky 2xl:top-28 2xl:h-fit">
              <AdminSettingsJumpNav
                desktop
                activeSection={activeSettingsSection}
                onSelect={(sectionId) => {
                  setActiveSettingsSection(sectionId);
                  scrollToAdminSettingsSection(sectionId);
                }}
              />
            </aside>
          </div>

          {/* Status Legend */}
          <StatusLegend />
        </>
      )}

      {/* API Management tab */}
      {activeFilter === "api" && (
        <ApiManagementTab adminSettings={adminSettings} />
      )}

      {/* README update logs tab */}
      {activeFilter === "logs" && <ReadmeUpdateLogsTab />}

      {/* GitHub broadcast and reply sync */}
      {activeFilter === "broadcast" && <GithubBroadcastSection />}

      {/* All time downloads growth tab */}
      {activeFilter === "growth" && <DownloadsGrowthTab />}
    </div>
  );
}
