// Admin component for editing directory-specific fields on a package
import { useState, useRef, useEffect, type ReactNode } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  CaretDown,
  DownloadSimple,
  Image,
  ArrowsClockwise,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { useDirectoryCategories } from "../lib/categories";
import ReadmePreviewNotice from "./ReadmePreviewNotice";
import { Markdown } from "./Markdown";

// Max file size: 3MB
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const ALLOWED_TYPES = ["image/webp", "image/png", "image/jpeg"];
const LOGO_ALLOWED_TYPES = ["image/png", "image/webp", "image/svg+xml"];

interface ComponentDetailsEditorProps {
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
  thumbnailUploadedByUser?: boolean;
  hideThumbnailInCategory?: boolean;
  convexVerified?: boolean;
  communitySubmitted?: boolean;
  authorUsername?: string;
  authorAvatar?: string;
  // Logo and thumbnail generation fields
  logoUrl?: string;
  logoStorageId?: Id<"_storage">;
  selectedTemplateId?: Id<"thumbnailTemplates">;
  thumbnailGeneratedAt?: number;
  // SEO generation fields
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
  // SKILL.md generation
  skillMd?: string;
  mode?: "full" | "submission";
  // Package metadata for auto-fill
  npmDescription?: string;
  repositoryUrl?: string;
  npmUrl?: string;
  // Snapshot of original user-submitted descriptions (pre-migration)
  submittedShortDescription?: string;
  submittedLongDescription?: string;
}

export function ComponentDetailsEditor({
  packageId,
  componentName: initialComponentName,
  slug: initialSlug,
  category: initialCategory,
  tags: initialTags,
  shortDescription: initialShortDesc,
  longDescription: initialLongDesc,
  videoUrl: initialVideoUrl,
  videoPosition: initialVideoPosition,
  demoUrl: initialDemoUrl,
  thumbnailUrl: initialThumbUrl,
  thumbnailUploadedByUser: initialThumbnailUploadedByUser,
  hideThumbnailInCategory: initialHideThumbnailInCategory,
  convexVerified: initialVerified,
  communitySubmitted: initialCommunitySubmitted,
  authorUsername: initialAuthorUser,
  authorAvatar: initialAuthorAvatar,
  logoUrl: initialLogoUrl,
  logoStorageId: initialLogoStorageId,
  selectedTemplateId: initialSelectedTemplateId,
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
  mode = "full",
  npmDescription,
  repositoryUrl,
  npmUrl,
  submittedShortDescription,
  submittedLongDescription,
}: ComponentDetailsEditorProps) {
  const isSubmissionMode = mode === "submission";
  const [componentName, setComponentName] = useState(
    initialComponentName || "",
  );
  const [slug, setSlug] = useState(initialSlug || "");
  const [category, setCategory] = useState(initialCategory || "");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [tags, setTags] = useState((initialTags || []).join(", "));
  const [shortDescription, setShortDescription] = useState(
    initialShortDesc || "",
  );
  const [longDescription, setLongDescription] = useState(initialLongDesc || "");
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl || "");
  const [videoPosition, setVideoPosition] = useState<"top" | "bottom">(
    initialVideoPosition ?? "top",
  );
  const [demoUrl, setDemoUrl] = useState(initialDemoUrl || "");
  const [thumbnailUrl, setThumbnailUrl] = useState(initialThumbUrl || "");
  const [savedThumbnailUrl, setSavedThumbnailUrl] = useState(
    initialThumbUrl || "",
  );
  const [hideThumbnailInCategory, setHideThumbnailInCategory] = useState(
    initialHideThumbnailInCategory || false,
  );
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl || "");
  const [convexVerified, setConvexVerified] = useState(
    initialVerified || false,
  );
  const [communitySubmitted, setCommunitySubmitted] = useState(
    initialCommunitySubmitted || false,
  );
  const [authorUsername, setAuthorUsername] = useState(initialAuthorUser || "");
  const [authorAvatar, setAuthorAvatar] = useState(initialAuthorAvatar || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [clearingLogo, setClearingLogo] = useState(false);
  const [generatingThumb, setGeneratingThumb] = useState(false);
  const [thumbnailUploadedByUser, setThumbnailUploadedByUser] = useState(
    initialThumbnailUploadedByUser === true,
  );
  const [selectedGenTemplate, setSelectedGenTemplate] = useState<
    Id<"thumbnailTemplates"> | ""
  >(initialSelectedTemplateId || "");
  const [fillingAuthor, setFillingAuthor] = useState(false);
  const [generatingSeo, setGeneratingSeo] = useState(false);
  const [showOriginalText, setShowOriginalText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Fetch dynamic categories from DB
  const dynamicCategories = useDirectoryCategories();

  // Close category dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(e.target as Node)
      ) {
        setCategoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keep local state synced with reactive backend updates.
  useEffect(() => {
    setComponentName(initialComponentName || "");
  }, [initialComponentName]);

  useEffect(() => {
    setCategory(initialCategory || "");
  }, [initialCategory]);

  useEffect(() => {
    setTags((initialTags || []).join(", "));
  }, [initialTags]);

  useEffect(() => {
    setShortDescription(initialShortDesc || "");
  }, [initialShortDesc]);

  useEffect(() => {
    setLongDescription(initialLongDesc || "");
  }, [initialLongDesc]);

  useEffect(() => {
    setVideoUrl(initialVideoUrl || "");
  }, [initialVideoUrl]);

  useEffect(() => {
    setVideoPosition(initialVideoPosition ?? "top");
  }, [initialVideoPosition]);

  useEffect(() => {
    setDemoUrl(initialDemoUrl || "");
  }, [initialDemoUrl]);

  useEffect(() => {
    setSlug(initialSlug || "");
  }, [initialSlug]);

  useEffect(() => {
    setThumbnailUrl(initialThumbUrl || "");
    setSavedThumbnailUrl(initialThumbUrl || "");
  }, [initialThumbUrl]);

  useEffect(() => {
    setHideThumbnailInCategory(initialHideThumbnailInCategory || false);
  }, [initialHideThumbnailInCategory]);

  useEffect(() => {
    setThumbnailUploadedByUser(initialThumbnailUploadedByUser === true);
  }, [initialThumbnailUploadedByUser]);

  useEffect(() => {
    setLogoUrl(initialLogoUrl || "");
  }, [initialLogoUrl]);

  useEffect(() => {
    setSelectedGenTemplate(initialSelectedTemplateId || "");
  }, [initialSelectedTemplateId]);

  // Sync author fields when backend updates (e.g., from InlineActions auto-fill)
  useEffect(() => {
    setAuthorUsername(initialAuthorUser || "");
  }, [initialAuthorUser]);

  useEffect(() => {
    setAuthorAvatar(initialAuthorAvatar || "");
  }, [initialAuthorAvatar]);

  useEffect(() => {
    setConvexVerified(initialVerified || false);
  }, [initialVerified]);

  useEffect(() => {
    setCommunitySubmitted(initialCommunitySubmitted || false);
  }, [initialCommunitySubmitted]);

  const updateDetails = useMutation(api.packages.updateComponentDetails);
  const generateUploadUrl = useMutation(api.packages.generateUploadUrl);
  const saveThumbnail = useMutation(api.packages.saveThumbnail);
  const saveLogo = useMutation(api.packages.saveLogo);
  const clearLogo = useMutation(api.packages.clearLogo);
  const autoFillAuthor = useMutation(api.packages.autoFillAuthorFromRepo);
  const regenerateSeo = useAction(api.seoContent.regenerateSeoContent);
  const regenerateDirectoryContent = useAction(
    api.seoContent.regenerateDirectoryContent,
  );
  const generateThumbnail = useAction(
    api.thumbnailGenerator.generateThumbnailForPackage,
  );
  // Fetch active templates for picker
  const activeTemplates = useQuery(api.thumbnails.listActiveTemplates);

  const handleSave = async () => {
    setSaving(true);
    try {
      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: {
        packageId: Id<"packages">;
        componentName?: string;
        category?: string;
        clearCategory?: boolean;
        tags?: string[];
        shortDescription?: string;
        longDescription?: string;
        videoUrl?: string;
        videoPosition?: "top" | "bottom";
        demoUrl?: string;
        thumbnailUrl?: string;
        clearThumbnail?: boolean;
        hideThumbnailInCategory?: boolean;
        slug?: string;
        convexVerified?: boolean;
        communitySubmitted?: boolean;
        authorUsername?: string;
        authorAvatar?: string;
      } = {
        packageId,
        componentName: componentName || undefined,
        category: category || undefined,
        clearCategory: !category && initialCategory ? true : undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
        shortDescription: shortDescription || undefined,
        longDescription: longDescription || undefined,
        videoUrl: videoUrl || undefined,
        demoUrl: demoUrl || undefined,
        thumbnailUrl: thumbnailUrl || undefined,
        clearThumbnail:
          savedThumbnailUrl !== "" && thumbnailUrl === "" ? true : undefined,
      };

      if (!isSubmissionMode) {
        payload.slug = slug || undefined;
        payload.convexVerified = convexVerified;
        payload.communitySubmitted = communitySubmitted;
        payload.hideThumbnailInCategory = hideThumbnailInCategory;
        payload.videoPosition = videoPosition;
        payload.authorUsername = authorUsername || undefined;
        payload.authorAvatar = authorAvatar || undefined;
      }

      await updateDetails(payload);
      setSavedThumbnailUrl(thumbnailUrl);
      toast.success("Component details saved");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Handle thumbnail file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only .webp, .png, and .jpg files are allowed");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be under 3MB");
      return;
    }

    setUploading(true);
    try {
      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Upload the file
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await result.json();

      await saveThumbnail({ packageId, storageId });
      setThumbnailUploadedByUser(true);
      toast.success("Thumbnail uploaded");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle logo file upload
  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only .png, .webp, and .svg files are allowed");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be under 3MB");
      return;
    }

    setUploadingLogo(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("Upload failed");
      const { storageId } = await result.json();
      await saveLogo({ packageId, storageId });
      // Optimistic preview so admins see the newly uploaded logo immediately.
      setLogoUrl(URL.createObjectURL(file));
      toast.success("Logo uploaded");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  // Clear logo from package
  const handleClearLogo = async () => {
    setClearingLogo(true);
    try {
      await clearLogo({ packageId });
      setLogoUrl("");
      toast.success("Logo cleared");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Clear failed";
      toast.error(msg);
    } finally {
      setClearingLogo(false);
    }
  };

  // Generate thumbnail from logo + template
  const handleHideThumbnailInCategoryChange = async (checked: boolean) => {
    setHideThumbnailInCategory(checked);
    try {
      await updateDetails({
        packageId,
        hideThumbnailInCategory: checked,
      });
      toast.success(
        checked
          ? "Thumbnail hidden in category listings"
          : "Thumbnail shown in category listings",
      );
    } catch (error) {
      setHideThumbnailInCategory(!checked);
      const msg = error instanceof Error ? error.message : "Update failed";
      toast.error(msg);
    }
  };

  const handleGenerateThumbnail = async () => {
    if (thumbnailUploadedByUser) {
      toast.error(
        "This component has a user-uploaded thumbnail. Clear it before generating a new one.",
      );
      return;
    }
    setGeneratingThumb(true);
    try {
      const args: {
        packageId: Id<"packages">;
        templateId?: Id<"thumbnailTemplates">;
      } = { packageId };
      if (selectedGenTemplate) {
        args.templateId = selectedGenTemplate as Id<"thumbnailTemplates">;
      }

      await generateThumbnail(args);
      toast.success("Thumbnail generation started");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Generation failed";
      toast.error(msg);
    } finally {
      setGeneratingThumb(false);
    }
  };

  // Auto-fill author from the repo URL (GitHub or GitLab)
  // Updates local state immediately from mutation return value. GitLab
  // avatars arrive via a scheduled action, so the field may fill in shortly after.
  const handleAutoFillAuthor = async () => {
    setFillingAuthor(true);
    try {
      const result = await autoFillAuthor({ packageId });
      if (result) {
        setAuthorUsername(result.authorUsername);
        if (result.authorAvatar) {
          setAuthorAvatar(result.authorAvatar);
          toast.success("Author info populated from repository");
        } else {
          toast.success("Author username set. Avatar will load from GitLab shortly.");
        }
      } else {
        toast.error("No GitHub or GitLab repository URL found on this package");
      }
    } catch {
      toast.error("Could not extract author from repository URL");
    } finally {
      setFillingAuthor(false);
    }
  };

  // Badge markdown snippet
  const badgeSnippet = slug
    ? `[![Convex Component](https://www.convex.dev/components/badge/${slug})](https://www.convex.dev/components/${slug})`
    : "";
  const isV2ContentModel = contentModelVersion === 2;

  return (
    <div className="mt-4 min-w-0 overflow-hidden rounded-lg bg-bg-hover/30 p-2.5 sm:p-3 space-y-2.5 sm:space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
          Component Details
        </h4>
        <button
          onClick={handleSave}
          disabled={saving}
          className="self-start text-xs px-3 py-1 rounded-full bg-button text-white hover:bg-button-hover transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Component Name */}
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
            Component Name
          </label>
          <input
            type="text"
            value={componentName}
            onChange={(e) => setComponentName(e.target.value)}
            placeholder="Component Name"
            className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
          />
        </div>

        {!isSubmissionMode && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
              URL Slug
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="agent"
              className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
            />
          </div>
        )}

        {/* Category (custom dropdown) */}
        <div ref={categoryDropdownRef} className="relative min-w-0">
          <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
            Category
          </label>
          <button
            type="button"
            onClick={() => setCategoryOpen(!categoryOpen)}
            className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
          >
            <span
              className={category ? "text-text-primary" : "text-text-secondary"}
            >
              {category
                ? dynamicCategories.find((c) => c.id === category)?.label ||
                  category
                : "None"}
            </span>
            <CaretDown
              size={12}
              className={`text-text-secondary transition-transform ${categoryOpen ? "rotate-180" : ""}`}
            />
          </button>
          {categoryOpen && (
            <div className="absolute z-30 left-0 right-0 top-full mt-1 rounded-lg border border-border bg-white shadow-lg py-1 max-h-48 overflow-y-auto">
              {[{ id: "", label: "None" }, ...dynamicCategories].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setCategory(opt.id);
                    setCategoryOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-bg-hover ${
                    category === opt.id
                      ? "text-text-primary font-medium"
                      : "text-text-secondary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {!isSubmissionMode && (
          <div className="min-w-0">
            <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
              Author Username (GitHub or GitLab)
            </label>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center min-w-0">
              <input
                type="text"
                value={authorUsername}
                onChange={(e) => setAuthorUsername(e.target.value)}
                placeholder="convex"
                className="min-w-0 w-full sm:flex-1 text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
              />
              <button
                onClick={handleAutoFillAuthor}
                disabled={fillingAuthor}
                title="Auto-fill from repository URL"
                className="self-start shrink-0 text-[10px] px-2 py-1 rounded bg-bg-primary text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {fillingAuthor ? "..." : "Auto-fill"}
              </button>
            </div>
          </div>
        )}

        {!isSubmissionMode && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
              Author Avatar URL
            </label>
            <input
              type="text"
              value={authorAvatar}
              onChange={(e) => setAuthorAvatar(e.target.value)}
              placeholder="https://github.com/convex.png"
              className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
            />
          </div>
        )}

        {/* Video URL */}
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
            Video Demo URL
          </label>
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/..."
            className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
          />
        </div>

        {/* Video position on the detail page (admin only) */}
        {!isSubmissionMode && (
          <div className="sm:col-span-2">
            <label
              htmlFor={`video-position-${packageId}`}
              className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block"
            >
              Video Position on Component Page
            </label>
            <select
              id={`video-position-${packageId}`}
              value={videoPosition}
              onChange={(e) =>
                setVideoPosition(e.target.value as "top" | "bottom")
              }
              className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
            >
              <option value="top">Top (below install command)</option>
              <option value="bottom">Bottom (after the README)</option>
            </select>
          </div>
        )}

        {/* Live Demo URL */}
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
            Live Demo URL or Example App
          </label>
          <input
            type="text"
            value={demoUrl}
            onChange={(e) => setDemoUrl(e.target.value)}
            placeholder="https://your-demo.com"
            className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
          />
        </div>
      </div>

      {/* Logo management (admin only) */}
      {!isSubmissionMode && (
        <div className="pt-2 border-t border-border space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
            Component Logo
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center min-w-0">
            {/* Logo preview */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="w-10 h-10 object-contain rounded border border-border bg-white p-0.5"
              />
            ) : (
              <div className="w-10 h-10 rounded border border-dashed border-border flex items-center justify-center">
                <Image size={14} className="text-text-secondary" />
              </div>
            )}

            {/* Upload / replace logo */}
            <input
              ref={logoInputRef}
              type="file"
              accept=".png,.webp,.svg"
              onChange={handleLogoSelect}
              className="hidden"
            />
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="text-xs px-3 py-1.5 rounded bg-bg-primary text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
              >
                {uploadingLogo
                  ? "Uploading..."
                  : logoUrl
                    ? "Replace logo"
                    : "Upload logo"}
              </button>

              {/* Download logo */}
              {logoUrl && (
                <a
                  href={logoUrl}
                  download
                  className="p-1.5 rounded hover:bg-bg-hover transition-colors"
                  title="Download logo"
                >
                  <DownloadSimple size={14} className="text-text-secondary" />
                </a>
              )}

              {/* Clear logo */}
              {logoUrl && (
                <button
                  onClick={handleClearLogo}
                  disabled={clearingLogo || uploadingLogo}
                  className="text-xs px-3 py-1.5 rounded bg-bg-primary text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
                >
                  {clearingLogo ? "Clearing..." : "Clear"}
                </button>
              )}

              <span className="text-[10px] text-text-secondary break-words">
                .png, .webp, .svg
              </span>
            </div>
          </div>

          {/* Thumbnail generation controls */}
          {logoUrl && !thumbnailUploadedByUser && (
            <div className="mt-2 space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-text-secondary block">
                Generate Thumbnail
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center min-w-0">
                {/* Template picker */}
                <select
                  value={selectedGenTemplate}
                  onChange={(e) =>
                    setSelectedGenTemplate(
                      e.target.value as Id<"thumbnailTemplates"> | "",
                    )
                  }
                  className="min-w-0 w-full sm:flex-1 text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary border border-border outline-none focus:ring-1 focus:ring-button"
                >
                  <option value="">Default template</option>
                  {activeTemplates?.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                      {t.isDefault ? " (default)" : ""}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleGenerateThumbnail}
                  disabled={generatingThumb}
                  className="self-start text-xs px-3 py-1.5 rounded bg-bg-primary text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
                >
                  <ArrowsClockwise
                    size={12}
                    className={generatingThumb ? "animate-spin" : ""}
                  />
                  {generatingThumb ? "Generating..." : "Generate"}
                </button>
              </div>

              {/* Generation info */}
              {thumbnailGeneratedAt && (
                <p className="text-[10px] text-text-secondary">
                  Last generated:{" "}
                  {new Date(thumbnailGeneratedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}
          {thumbnailUploadedByUser && (
            <p className="mt-2 text-[10px] text-text-secondary">
              User-uploaded thumbnail is protected. Clear the thumbnail to
              enable generation.
            </p>
          )}
        </div>
      )}

      {/* Thumbnail upload (manual override) */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
          Component Thumbnail (16:9, 1536x864, max 3MB)
        </label>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt="Thumbnail preview"
              className="w-20 h-[45px] object-cover rounded"
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".webp,.png,.jpg,.jpeg"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs px-3 py-1.5 rounded bg-bg-primary text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
          >
            {uploading ? "Uploading..." : thumbnailUrl ? "Replace" : "Upload"}
          </button>
          {thumbnailUrl && (
            <button
              onClick={() => {
                setThumbnailUrl("");
                setThumbnailUploadedByUser(false);
              }}
              disabled={uploading || saving}
              className="text-xs px-3 py-1.5 rounded bg-bg-primary text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
            >
              Clear
            </button>
          )}
          <span className="text-[10px] text-text-secondary break-words">
            .webp, .png, .jpg
          </span>
        </div>
        {/* Hide thumbnail in category listings checkbox (admin only, shown when thumbnail exists) */}
        {!isSubmissionMode && thumbnailUrl && (
          <div className="mt-2 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <input
              type="checkbox"
              id={`hide-thumb-cat-${packageId}`}
              checked={hideThumbnailInCategory}
              onChange={(e) =>
                void handleHideThumbnailInCategoryChange(e.target.checked)
              }
              className="rounded"
            />
            <label
              htmlFor={`hide-thumb-cat-${packageId}`}
              className="text-xs text-text-primary"
            >
              Hide thumbnail in category listings
            </label>
            <span className="text-[10px] text-text-secondary">
              (show only in Featured section)
            </span>
          </div>
        )}
      </div>

      {/* Keywords */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
          Keywords (comma-separated)
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="ai, real-time, streaming"
          className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
        />
      </div>

      {/* Short description */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
          Short Description ({shortDescription.length}/200)
        </label>
        <textarea
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value.slice(0, 200))}
          placeholder="One-line summary"
          rows={2}
          className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary resize-none outline-none focus:ring-1 focus:ring-button"
        />
      </div>

      {/* Long description */}
      <div>
        <div className="flex items-center justify-between mb-0.5">
          <label className="text-[10px] uppercase tracking-wider text-text-secondary">
            Long Description (markdown)
          </label>
          {!isSubmissionMode && npmDescription && (
            <button
              type="button"
              onClick={() => {
                setLongDescription(npmDescription);
                toast.success("Description auto-filled from package metadata");
              }}
              className="text-[10px] px-2 py-0.5 rounded bg-bg-primary text-text-secondary hover:text-text-primary transition-colors border border-border hover:border-button"
              title="Copy description from Package Metadata"
            >
              Auto-fill from Package
            </button>
          )}
        </div>
        <textarea
          value={longDescription}
          onChange={(e) => setLongDescription(e.target.value)}
          placeholder="Full markdown description"
          rows={4}
          className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary resize-y outline-none focus:ring-1 focus:ring-button"
        />
      </div>

      {/* Original submitted text (read-only reference) */}
      {(submittedShortDescription || submittedLongDescription) && (
        <div className="pt-2 border-t border-border/50">
          <button
            onClick={() => setShowOriginalText(!showOriginalText)}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors"
          >
            <CaretDown
              size={10}
              className={`transition-transform ${showOriginalText ? "rotate-180" : ""}`}
            />
            Original Submitted Text
          </button>
          {showOriginalText && (
            <div className="mt-2 space-y-2 p-3 rounded-lg bg-bg-secondary/30 border border-border/50">
              {submittedShortDescription && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-text-tertiary mb-0.5">
                    Short Description
                  </p>
                  <p className="text-xs text-text-secondary">
                    {submittedShortDescription}
                  </p>
                </div>
              )}
              {submittedLongDescription && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-text-tertiary mb-0.5">
                    Long Description
                  </p>
                  <p className="text-xs text-text-secondary whitespace-pre-wrap">
                    {submittedLongDescription}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!isSubmissionMode && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`verified-${packageId}`}
              checked={convexVerified}
              onChange={(e) => setConvexVerified(e.target.checked)}
              className="rounded"
            />
            <label
              htmlFor={`verified-${packageId}`}
              className="text-xs text-text-primary"
            >
              Convex Verified
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`community-${packageId}`}
              checked={communitySubmitted}
              onChange={(e) => setCommunitySubmitted(e.target.checked)}
              className="rounded"
            />
            <label
              htmlFor={`community-${packageId}`}
              className="text-xs text-text-primary"
            >
              Community
            </label>
          </div>
        </div>
      )}

      {!isSubmissionMode &&
        (isV2ContentModel ? (
          <GeneratedContentSection
            packageId={packageId}
            repositoryUrl={repositoryUrl}
            npmUrl={npmUrl}
            componentName={componentName}
            shortDescription={shortDescription}
            contentGenerationStatus={contentGenerationStatus}
            contentGeneratedAt={contentGeneratedAt}
            contentGenerationError={contentGenerationError}
            generatedDescription={generatedDescription}
            generatedUseCases={generatedUseCases}
            generatedHowItWorks={generatedHowItWorks}
            readmeIncludedMarkdown={readmeIncludedMarkdown}
            readmeIncludeSource={readmeIncludeSource}
            skillMd={skillMd}
            generatingContent={generatingSeo}
            onRegenerate={async () => {
              setGeneratingSeo(true);
              try {
                await regenerateDirectoryContent({ packageId });
                toast.success("Component directory content generation started");
              } catch {
                toast.error("Failed to start content generation");
              } finally {
                setGeneratingSeo(false);
              }
            }}
          />
        ) : (
          <SeoContentSection
            packageId={packageId}
            seoGenerationStatus={seoGenerationStatus}
            seoGeneratedAt={seoGeneratedAt}
            seoGenerationError={seoGenerationError}
            seoValueProp={seoValueProp}
            seoBenefits={seoBenefits}
            seoUseCases={seoUseCases}
            seoFaq={seoFaq}
            seoResourceLinks={seoResourceLinks}
            skillMd={skillMd}
            generatingSeo={generatingSeo}
            onRegenerate={async () => {
              setGeneratingSeo(true);
              try {
                await regenerateSeo({ packageId });
                toast.success("SEO content + SKILL.md generation started");
              } catch {
                toast.error("Failed to start generation");
              } finally {
                setGeneratingSeo(false);
              }
            }}
          />
        ))}

      {!isSubmissionMode && badgeSnippet && (
        <div className="pt-2 min-w-0">
          <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
            Badge Markdown
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center min-w-0">
            <code className="min-w-0 w-full sm:flex-1 max-w-full text-[10px] text-text-secondary bg-bg-primary px-2 py-1 rounded overflow-x-auto whitespace-nowrap">
              {badgeSnippet}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(badgeSnippet);
                toast.success("Badge copied");
              }}
              className="self-start shrink-0 text-xs px-2 py-1 rounded text-text-secondary hover:text-text-primary transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GeneratedContentSection({
  packageId,
  repositoryUrl,
  npmUrl,
  componentName,
  shortDescription,
  contentGenerationStatus,
  contentGeneratedAt,
  contentGenerationError,
  generatedDescription,
  generatedUseCases,
  generatedHowItWorks,
  readmeIncludedMarkdown,
  readmeIncludeSource,
  skillMd,
  generatingContent,
  onRegenerate,
}: {
  packageId: Id<"packages">;
  repositoryUrl?: string;
  npmUrl?: string;
  componentName?: string;
  shortDescription?: string;
  contentGenerationStatus?: string;
  contentGeneratedAt?: number;
  contentGenerationError?: string;
  generatedDescription?: string;
  generatedUseCases?: string;
  generatedHowItWorks?: string;
  readmeIncludedMarkdown?: string;
  readmeIncludeSource?: "markers" | "full";
  skillMd?: string;
  generatingContent: boolean;
  onRegenerate: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [showSkillMd, setShowSkillMd] = useState(false);
  const [editDescription, setEditDescription] = useState(
    generatedDescription || "",
  );
  const [editUseCases, setEditUseCases] = useState(generatedUseCases || "");
  const [editHowItWorks, setEditHowItWorks] = useState(
    generatedHowItWorks || "",
  );
  const [editReadmeIncludedMarkdown, setEditReadmeIncludedMarkdown] = useState(
    readmeIncludedMarkdown || "",
  );
  const [editReadmeIncludeSource, setEditReadmeIncludeSource] = useState<
    "markers" | "full" | ""
  >(readmeIncludeSource || "");
  const [editSkillMd, setEditSkillMd] = useState(skillMd || "");
  const updateGeneratedContent = useMutation(
    api.seoContentDb.updateGeneratedContent,
  );

  useEffect(() => {
    if (!editing) {
      setEditDescription(generatedDescription || "");
      setEditUseCases(generatedUseCases || "");
      setEditHowItWorks(generatedHowItWorks || "");
      setEditReadmeIncludedMarkdown(readmeIncludedMarkdown || "");
      setEditReadmeIncludeSource(readmeIncludeSource || "");
      setEditSkillMd(skillMd || "");
    }
  }, [
    editing,
    generatedDescription,
    generatedUseCases,
    generatedHowItWorks,
    readmeIncludedMarkdown,
    readmeIncludeSource,
    skillMd,
  ]);

  const canGenerate = Boolean(
    repositoryUrl &&
      npmUrl &&
      componentName?.trim() &&
      shortDescription?.trim(),
  );
  const hasContent = Boolean(
    generatedDescription ||
      generatedUseCases ||
      generatedHowItWorks ||
      readmeIncludedMarkdown,
  );

  const handleSaveGeneratedContent = async () => {
    setSavingContent(true);
    try {
      await updateGeneratedContent({
        packageId,
        generatedDescription: editDescription || undefined,
        generatedUseCases: editUseCases || undefined,
        generatedHowItWorks: editHowItWorks || undefined,
        readmeIncludedMarkdown: editReadmeIncludedMarkdown || undefined,
        readmeIncludeSource:
          editReadmeIncludeSource === "" ? undefined : editReadmeIncludeSource,
        skillMd: editSkillMd || undefined,
      });
      toast.success("Generated content saved");
      setEditing(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Save failed";
      toast.error(msg);
    } finally {
      setSavingContent(false);
    }
  };

  const handleCancelEdit = () => {
    setEditDescription(generatedDescription || "");
    setEditUseCases(generatedUseCases || "");
    setEditHowItWorks(generatedHowItWorks || "");
    setEditReadmeIncludedMarkdown(readmeIncludedMarkdown || "");
    setEditReadmeIncludeSource(readmeIncludeSource || "");
    setEditSkillMd(skillMd || "");
    setEditing(false);
  };

  return (
    <div className="pt-2 border-t border-border">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="text-[10px] uppercase tracking-wider text-text-secondary">
          Generated Content + SKILL.md
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          {contentGenerationStatus === "completed" && contentGeneratedAt && (
            <span className="text-[10px] px-2 py-0.5 rounded border border-border bg-bg-primary text-text-secondary">
              Generated {new Date(contentGeneratedAt).toLocaleDateString()}
            </span>
          )}
          {hasContent && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-[10px] px-2 py-0.5 rounded border border-border bg-bg-primary text-text-secondary hover:text-text-primary hover:border-button transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {contentGenerationStatus === "generating" && (
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 border-2 border-text-secondary/30 border-t-text-primary rounded-full animate-spin" />
          <span className="text-xs text-text-secondary">
            Generating content...
          </span>
        </div>
      )}
      {contentGenerationStatus === "error" && contentGenerationError && (
        <p className="text-xs text-red-600 mb-2">{contentGenerationError}</p>
      )}

      {editing && (
        <div className="space-y-3 mb-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
              Description
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary resize-y outline-none focus:ring-1 focus:ring-button"
              placeholder="Generated description"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
              Use cases
            </label>
            <textarea
              value={editUseCases}
              onChange={(e) => setEditUseCases(e.target.value)}
              rows={5}
              className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary resize-y outline-none focus:ring-1 focus:ring-button"
              placeholder="Markdown supported"
            />
            {editUseCases && (
              <div className="mt-1 rounded border border-border bg-bg-primary p-2">
                <p className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                  Preview
                </p>
                <div className="overflow-x-auto">
                  <div className="markdown-body markdown-body-compact">
                    <Markdown>{editUseCases}</Markdown>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
              How it works
            </label>
            <textarea
              value={editHowItWorks}
              onChange={(e) => setEditHowItWorks(e.target.value)}
              rows={5}
              className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary resize-y outline-none focus:ring-1 focus:ring-button"
              placeholder="Markdown supported"
            />
            {editHowItWorks && (
              <div className="mt-1 rounded border border-border bg-bg-primary p-2">
                <p className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                  Preview
                </p>
                <div className="overflow-x-auto">
                  <div className="markdown-body markdown-body-compact">
                    <Markdown>{editHowItWorks}</Markdown>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
              README preview
            </label>
            <ReadmePreviewNotice
              readmeIncludeSource={editReadmeIncludeSource}
            />
            <textarea
              value={editReadmeIncludedMarkdown}
              onChange={(e) => setEditReadmeIncludedMarkdown(e.target.value)}
              rows={8}
              className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary resize-y outline-none focus:ring-1 focus:ring-button"
              placeholder="README excerpt"
            />
          </div>

          <div>
            <button
              onClick={() => setShowSkillMd(!showSkillMd)}
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors mb-1"
            >
              <CaretDown
                size={10}
                className={
                  showSkillMd
                    ? "rotate-180 transition-transform"
                    : "transition-transform"
                }
              />
              SKILL.md
            </button>
            {showSkillMd && (
              <textarea
                value={editSkillMd}
                onChange={(e) => setEditSkillMd(e.target.value)}
                rows={8}
                className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary font-mono resize-y outline-none focus:ring-1 focus:ring-button"
                placeholder="SKILL.md content"
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSaveGeneratedContent}
              disabled={savingContent}
              className="text-xs px-3 py-1.5 rounded-full bg-button text-white hover:bg-button-hover transition-colors disabled:opacity-50"
            >
              {savingContent ? "Saving..." : "Save Generated Content"}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={savingContent}
              className="text-xs px-3 py-1.5 rounded text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!editing && hasContent && (
        <div className="space-y-2 mb-3">
          {generatedDescription && (
            <p className="text-xs text-text-secondary line-clamp-3">
              {generatedDescription}
            </p>
          )}
          {generatedUseCases && (
            <span className="text-[10px] text-text-secondary">
              Use cases ready
            </span>
          )}
          {generatedHowItWorks && (
            <span className="text-[10px] text-text-secondary ml-2">
              How it works ready
            </span>
          )}
          {skillMd && (
            <p className="text-[10px] text-green-600">SKILL.md generated</p>
          )}
        </div>
      )}

      {!canGenerate && (
        <p className="mb-2 text-[10px] text-text-secondary">
          Requires repository URL, npm URL, component name, and short
          description.
        </p>
      )}

      <button
        onClick={onRegenerate}
        disabled={
          !canGenerate ||
          generatingContent ||
          contentGenerationStatus === "generating"
        }
        className="w-full sm:w-auto text-xs px-3 py-1.5 rounded bg-bg-primary text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
      >
        {contentGenerationStatus === "generating"
          ? "Generating..."
          : hasContent
            ? "Regenerate Component Directory Content"
            : "Generate Component Directory Content"}
      </button>
    </div>
  );
}

// Editable SEO content section within the component details editor
function SeoContentSection({
  packageId,
  seoGenerationStatus,
  seoGeneratedAt,
  seoGenerationError,
  seoValueProp,
  seoBenefits,
  seoUseCases,
  seoFaq,
  seoResourceLinks,
  skillMd,
  generatingSeo,
  onRegenerate,
}: {
  packageId: Id<"packages">;
  seoGenerationStatus?: string;
  seoGeneratedAt?: number;
  seoGenerationError?: string;
  seoValueProp?: string;
  seoBenefits?: string[];
  seoUseCases?: { query: string; answer: string }[];
  seoFaq?: { question: string; answer: string }[];
  seoResourceLinks?: { label: string; url: string }[];
  skillMd?: string;
  generatingSeo: boolean;
  onRegenerate: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [savingSeo, setSavingSeo] = useState(false);

  // Local edit state
  const [editValueProp, setEditValueProp] = useState(seoValueProp || "");
  const [editBenefits, setEditBenefits] = useState<string[]>(seoBenefits || []);
  const [editUseCases, setEditUseCases] = useState<
    { query: string; answer: string }[]
  >(seoUseCases || []);
  const [editFaq, setEditFaq] = useState<
    { question: string; answer: string }[]
  >(seoFaq || []);
  const [editResourceLinks, setEditResourceLinks] = useState<
    { label: string; url: string }[]
  >(seoResourceLinks || []);
  const [editSkillMd, setEditSkillMd] = useState(skillMd || "");
  const [showSkillMd, setShowSkillMd] = useState(false);

  const updateSeoContent = useMutation(api.seoContentDb.updateSeoContent);

  // Sync local state when backend data updates (e.g. after regeneration)
  useEffect(() => {
    if (!editing) {
      setEditValueProp(seoValueProp || "");
      setEditBenefits(seoBenefits || []);
      setEditUseCases(seoUseCases || []);
      setEditFaq(seoFaq || []);
      setEditResourceLinks(seoResourceLinks || []);
      setEditSkillMd(skillMd || "");
    }
  }, [
    seoValueProp,
    seoBenefits,
    seoUseCases,
    seoFaq,
    seoResourceLinks,
    skillMd,
    editing,
  ]);

  const handleSaveSeo = async () => {
    setSavingSeo(true);
    try {
      await updateSeoContent({
        packageId,
        seoValueProp: editValueProp || undefined,
        seoBenefits: editBenefits.length > 0 ? editBenefits : undefined,
        seoUseCases: editUseCases.length > 0 ? editUseCases : undefined,
        seoFaq: editFaq.length > 0 ? editFaq : undefined,
        seoResourceLinks:
          editResourceLinks.length > 0 ? editResourceLinks : undefined,
        skillMd: editSkillMd || undefined,
      });
      toast.success("SEO content saved");
      setEditing(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Save failed";
      toast.error(msg);
    } finally {
      setSavingSeo(false);
    }
  };

  const handleCancelEdit = () => {
    setEditValueProp(seoValueProp || "");
    setEditBenefits(seoBenefits || []);
    setEditUseCases(seoUseCases || []);
    setEditFaq(seoFaq || []);
    setEditResourceLinks(seoResourceLinks || []);
    setEditSkillMd(skillMd || "");
    setEditing(false);
  };

  const hasContent = seoGenerationStatus === "completed" && seoValueProp;

  return (
    <div className="pt-2 border-t border-border">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="text-[10px] uppercase tracking-wider text-text-secondary">
          AI SEO Content + SKILL.md
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {seoGenerationStatus === "completed" && seoGeneratedAt && (
            <span className="text-[10px] text-text-secondary">
              Generated {new Date(seoGeneratedAt).toLocaleDateString()}
            </span>
          )}
          {hasContent && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <PencilSimple size={10} weight="bold" />
              Edit
            </button>
          )}
        </div>
      </div>

      {seoGenerationStatus === "generating" && (
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 border-2 border-text-secondary/30 border-t-text-primary rounded-full animate-spin" />
          <span className="text-xs text-text-secondary">
            Generating content...
          </span>
        </div>
      )}
      {seoGenerationStatus === "error" && seoGenerationError && (
        <p className="text-xs text-red-600 mb-2">{seoGenerationError}</p>
      )}

      {/* Editing mode */}
      {editing && (
        <div className="space-y-3 mb-3">
          {/* Value Prop */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-secondary mb-0.5 block">
              Value Prop ({editValueProp.length}/160)
            </label>
            <textarea
              value={editValueProp}
              onChange={(e) => setEditValueProp(e.target.value.slice(0, 160))}
              rows={2}
              className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary resize-y outline-none focus:ring-1 focus:ring-button"
              placeholder="One-sentence value proposition"
            />
          </div>

          {/* Benefits */}
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label className="text-[10px] uppercase tracking-wider text-text-secondary">
                Benefits ({editBenefits.length})
              </label>
              {editBenefits.length < 4 && (
                <button
                  onClick={() => setEditBenefits([...editBenefits, ""])}
                  className="flex items-center gap-0.5 text-[10px] text-text-secondary hover:text-text-primary transition-colors"
                >
                  <Plus size={10} weight="bold" /> Add
                </button>
              )}
            </div>
            {editBenefits.map((b, i) => (
              <div key={i} className="flex items-start gap-1 mb-1">
                <textarea
                  value={b}
                  onChange={(e) => {
                    const next = [...editBenefits];
                    next[i] = e.target.value;
                    setEditBenefits(next);
                  }}
                  rows={1}
                  className="flex-1 text-xs px-2 py-1 rounded bg-bg-primary text-text-primary resize-y outline-none focus:ring-1 focus:ring-button"
                  placeholder="Benefit description"
                />
                <button
                  onClick={() =>
                    setEditBenefits(editBenefits.filter((_, idx) => idx !== i))
                  }
                  className="p-1 text-text-secondary hover:text-red-500 transition-colors mt-0.5"
                >
                  <Trash size={10} />
                </button>
              </div>
            ))}
          </div>

          {/* Use Cases */}
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label className="text-[10px] uppercase tracking-wider text-text-secondary">
                Use Cases ({editUseCases.length})
              </label>
              {editUseCases.length < 4 && (
                <button
                  onClick={() =>
                    setEditUseCases([
                      ...editUseCases,
                      { query: "", answer: "" },
                    ])
                  }
                  className="flex items-center gap-0.5 text-[10px] text-text-secondary hover:text-text-primary transition-colors"
                >
                  <Plus size={10} weight="bold" /> Add
                </button>
              )}
            </div>
            {editUseCases.map((uc, i) => (
              <div
                key={i}
                className="mb-2 p-2 rounded bg-bg-primary/50 border border-border/50"
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <textarea
                    value={uc.query}
                    onChange={(e) => {
                      const next = [...editUseCases];
                      next[i] = { ...next[i], query: e.target.value };
                      setEditUseCases(next);
                    }}
                    rows={1}
                    className="flex-1 text-xs px-2 py-1 rounded bg-bg-primary text-text-primary resize-y outline-none focus:ring-1 focus:ring-button"
                    placeholder="Search query"
                  />
                  <button
                    onClick={() =>
                      setEditUseCases(
                        editUseCases.filter((_, idx) => idx !== i),
                      )
                    }
                    className="p-1 text-text-secondary hover:text-red-500 transition-colors shrink-0 mt-0.5"
                  >
                    <Trash size={10} />
                  </button>
                </div>
                <textarea
                  value={uc.answer}
                  onChange={(e) => {
                    const next = [...editUseCases];
                    next[i] = { ...next[i], answer: e.target.value };
                    setEditUseCases(next);
                  }}
                  rows={2}
                  className="w-full text-xs px-2 py-1 rounded bg-bg-primary text-text-primary resize-y outline-none focus:ring-1 focus:ring-button"
                  placeholder="Answer"
                />
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label className="text-[10px] uppercase tracking-wider text-text-secondary">
                FAQ ({editFaq.length})
              </label>
              {editFaq.length < 5 && (
                <button
                  onClick={() =>
                    setEditFaq([...editFaq, { question: "", answer: "" }])
                  }
                  className="flex items-center gap-0.5 text-[10px] text-text-secondary hover:text-text-primary transition-colors"
                >
                  <Plus size={10} weight="bold" /> Add
                </button>
              )}
            </div>
            {editFaq.map((f, i) => (
              <div
                key={i}
                className="mb-2 p-2 rounded bg-bg-primary/50 border border-border/50"
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <textarea
                    value={f.question}
                    onChange={(e) => {
                      const next = [...editFaq];
                      next[i] = { ...next[i], question: e.target.value };
                      setEditFaq(next);
                    }}
                    rows={1}
                    className="flex-1 text-xs px-2 py-1 rounded bg-bg-primary text-text-primary resize-y outline-none focus:ring-1 focus:ring-button"
                    placeholder="Question"
                  />
                  <button
                    onClick={() =>
                      setEditFaq(editFaq.filter((_, idx) => idx !== i))
                    }
                    className="p-1 text-text-secondary hover:text-red-500 transition-colors shrink-0 mt-0.5"
                  >
                    <Trash size={10} />
                  </button>
                </div>
                <textarea
                  value={f.answer}
                  onChange={(e) => {
                    const next = [...editFaq];
                    next[i] = { ...next[i], answer: e.target.value };
                    setEditFaq(next);
                  }}
                  rows={2}
                  className="w-full text-xs px-2 py-1 rounded bg-bg-primary text-text-primary resize-y outline-none focus:ring-1 focus:ring-button"
                  placeholder="Answer"
                />
              </div>
            ))}
          </div>

          {/* Resource Links */}
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label className="text-[10px] uppercase tracking-wider text-text-secondary">
                Resource Links ({editResourceLinks.length})
              </label>
              <button
                onClick={() =>
                  setEditResourceLinks([
                    ...editResourceLinks,
                    { label: "", url: "" },
                  ])
                }
                className="flex items-center gap-0.5 text-[10px] text-text-secondary hover:text-text-primary transition-colors"
              >
                <Plus size={10} weight="bold" /> Add
              </button>
            </div>
            {editResourceLinks.map((link, i) => (
              <div
                key={i}
                className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center"
              >
                <input
                  type="text"
                  value={link.label}
                  onChange={(e) => {
                    const next = [...editResourceLinks];
                    next[i] = { ...next[i], label: e.target.value };
                    setEditResourceLinks(next);
                  }}
                  className="w-full sm:w-1/3 text-xs px-2 py-1 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
                  placeholder="Label"
                />
                <input
                  type="text"
                  value={link.url}
                  onChange={(e) => {
                    const next = [...editResourceLinks];
                    next[i] = { ...next[i], url: e.target.value };
                    setEditResourceLinks(next);
                  }}
                  className="flex-1 text-xs px-2 py-1 rounded bg-bg-primary text-text-primary outline-none focus:ring-1 focus:ring-button"
                  placeholder="https://..."
                />
                <button
                  onClick={() =>
                    setEditResourceLinks(
                      editResourceLinks.filter((_, idx) => idx !== i),
                    )
                  }
                  className="self-start p-1 text-text-secondary hover:text-red-500 transition-colors"
                >
                  <Trash size={10} />
                </button>
              </div>
            ))}
          </div>

          {/* SKILL.md */}
          <div>
            <button
              onClick={() => setShowSkillMd(!showSkillMd)}
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors mb-1"
            >
              <CaretDown
                size={10}
                className={
                  showSkillMd
                    ? "rotate-180 transition-transform"
                    : "transition-transform"
                }
              />
              SKILL.md
            </button>
            {showSkillMd && (
              <textarea
                value={editSkillMd}
                onChange={(e) => setEditSkillMd(e.target.value)}
                rows={8}
                className="w-full text-xs px-2 py-1.5 rounded bg-bg-primary text-text-primary font-mono resize-y outline-none focus:ring-1 focus:ring-button"
                placeholder="SKILL.md content"
              />
            )}
          </div>

          {/* Save / Cancel */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSaveSeo}
              disabled={savingSeo}
              className="text-xs px-3 py-1.5 rounded-full bg-button text-white hover:bg-button-hover transition-colors disabled:opacity-50"
            >
              {savingSeo ? "Saving..." : "Save SEO Content"}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={savingSeo}
              className="text-xs px-3 py-1.5 rounded text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Read-only display when not editing */}
      {!editing && hasContent && (
        <div className="space-y-2 mb-3">
          <p className="text-xs text-text-secondary italic line-clamp-2">
            {seoValueProp}
          </p>
          {seoBenefits && seoBenefits.length > 0 && (
            <div>
              <span className="text-[10px] text-text-secondary">Benefits:</span>
              <ul className="mt-0.5 space-y-0.5">
                {seoBenefits.map((b, i) => (
                  <li
                    key={i}
                    className="text-[10px] text-text-secondary pl-2 before:content-['·'] before:mr-1"
                  >
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {seoUseCases && seoUseCases.length > 0 && (
            <span className="text-[10px] text-text-secondary">
              {seoUseCases.length} use case{seoUseCases.length !== 1 ? "s" : ""}
            </span>
          )}
          {seoFaq && seoFaq.length > 0 && (
            <span className="text-[10px] text-text-secondary ml-2">
              {seoFaq.length} FAQ{seoFaq.length !== 1 ? "s" : ""}
            </span>
          )}
          {skillMd && (
            <p className="text-[10px] text-green-600">SKILL.md generated</p>
          )}
        </div>
      )}

      <button
        onClick={onRegenerate}
        disabled={generatingSeo || seoGenerationStatus === "generating"}
        className="w-full sm:w-auto text-xs px-3 py-1.5 rounded bg-bg-primary text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
      >
        {seoGenerationStatus === "generating"
          ? "Generating..."
          : seoGenerationStatus === "completed"
            ? "Regenerate SEO + Skill"
            : "Generate SEO + Skill"}
      </button>
    </div>
  );
}
