import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { userAccountFields, userActivityFields } from "./userValidators";

// Review status values: pending, in_review, approved, changes_requested, rejected
// Visibility values: visible, hidden, archived

const applicationTables = {
  packages: defineTable({
    name: v.string(),
    description: v.string(),
    installCommand: v.string(),
    repositoryUrl: v.optional(v.string()),
    homepageUrl: v.optional(v.string()),
    version: v.string(),
    license: v.string(),
    unpackedSize: v.number(),
    totalFiles: v.number(),
    lastPublish: v.string(),
    weeklyDownloads: v.number(),
    allTimeDownloads: v.optional(v.number()),
    collaborators: v.array(
      v.object({
        name: v.string(),
        avatar: v.string(),
      }),
    ),
    // Denormalized field for full-text search on maintainer names
    maintainerNames: v.optional(v.string()),
    npmUrl: v.string(),
    // Set when the owner points npmUrl at a different package name than the
    // record tracks; cleared when an admin accepts the rename or reverts.
    pendingNpmName: v.optional(v.string()),
    submittedAt: v.number(),
    // Submitter info (shown only in admin)
    submitterName: v.optional(v.string()),
    submitterEmail: v.optional(v.string()),
    submitterDiscord: v.optional(v.string()),
    // Additional emails for multi-account access to this submission
    additionalEmails: v.optional(v.array(v.string())),
    // Live demo URL (optional, submitted by user)
    demoUrl: v.optional(v.string()),
    // Review fields
    reviewStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("in_review"),
        v.literal("approved"),
        v.literal("changes_requested"),
        v.literal("rejected"),
      ),
    ),
    visibility: v.optional(
      v.union(v.literal("visible"), v.literal("hidden"), v.literal("archived")),
    ),
    reviewedBy: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    // Timestamp when package is approved for public directory sorting
    approvedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()),
    // Featured flag - only approved packages can be featured
    featured: v.optional(v.boolean()),
    // Admin-managed sort order for featured section (lower = first)
    featuredSortOrder: v.optional(v.number()),
    // Soft deletion fields - user marks for deletion, admin permanently deletes
    markedForDeletion: v.optional(v.boolean()),
    markedForDeletionAt: v.optional(v.number()),
    markedForDeletionBy: v.optional(v.string()), // email of user who requested deletion
    // AI Review fields
    aiReviewStatus: v.optional(
      v.union(
        v.literal("not_reviewed"),
        v.literal("reviewing"),
        v.literal("passed"),
        v.literal("failed"),
        v.literal("partial"),
        v.literal("error"),
      ),
    ),
    aiReviewSummary: v.optional(v.string()),
    aiReviewCriteria: v.optional(
      v.array(
        v.object({
          name: v.string(),
          passed: v.boolean(),
          notes: v.string(),
        }),
      ),
    ),
    aiReviewedAt: v.optional(v.number()),
    aiReviewError: v.optional(v.string()),
    // Auto-refresh fields
    lastRefreshedAt: v.optional(v.number()), // Timestamp of last npm data refresh
    refreshError: v.optional(v.string()), // Last refresh error message (if any)

    // --- Directory expansion fields ---
    // URL slug for component detail pages (e.g. "agent", "gilhrpenner/convex-files-control")
    slug: v.optional(v.string()),
    // Component category (ai, auth, backend, database, durable-functions, integrations, payments)
    category: v.optional(v.string()),
    // Searchable tags for filtering (manual + AI-generated)
    tags: v.optional(v.array(v.string())),
    // Short description shown on cards (200 char max)
    shortDescription: v.optional(v.string()),
    // Full markdown description shown on detail page
    longDescription: v.optional(v.string()),
    // Video demo URL (YouTube, Loom, etc.)
    videoUrl: v.optional(v.string()),
    // Where the video embed sits on the detail page. Unset means "top".
    videoPosition: v.optional(v.union(v.literal("top"), v.literal("bottom"))),
    // Thumbnail image URL (external URL or resolved from storage)
    thumbnailUrl: v.optional(v.string()),
    // Convex file storage ID for uploaded thumbnail (16:9, max 3MB)
    thumbnailStorageId: v.optional(v.id("_storage")),
    // True when submitter or admin uploaded a thumbnail file (skip auto/manual generation overwrite)
    thumbnailUploadedByUser: v.optional(v.boolean()),
    // --- Logo and thumbnail generation fields ---
    // Convex file storage ID for the user-uploaded logo (png/webp/svg)
    logoStorageId: v.optional(v.id("_storage")),
    // Resolved URL for the uploaded logo (admin-only display)
    logoUrl: v.optional(v.string()),
    // Which template was used to generate the current active thumbnail
    selectedTemplateId: v.optional(v.id("thumbnailTemplates")),
    // Increment to track regeneration version
    thumbnailGenerationVersion: v.optional(v.number()),
    // When the current thumbnail was generated
    thumbnailGeneratedAt: v.optional(v.number()),
    // Who generated it ("auto" for submit flow, admin email for manual)
    thumbnailGeneratedBy: v.optional(v.string()),
    // Convex team has tested and verified this component
    convexVerified: v.optional(v.boolean()),
    // Component was submitted or built by the community
    communitySubmitted: v.optional(v.boolean()),
    // Denormalized badges from curated category memberships, so directory cards
    // render with zero extra reads. Kept in sync by membership and category
    // mutations. badgeUrl is optional: badge-less curated categories still work.
    curatedBadges: v.optional(
      v.array(
        v.object({
          categorySlug: v.string(),
          label: v.string(),
          badgeUrl: v.optional(v.string()),
        }),
      ),
    ),
    // Repo owner of the primary author: GitHub user/org or GitLab namespace path
    authorUsername: v.optional(v.string()),
    // Author avatar URL (github.com/{owner}.png or the GitLab namespace avatar)
    authorAvatar: v.optional(v.string()),
    // Human-readable component display name (e.g. "Convex Agent")
    componentName: v.optional(v.string()),
    // Hide thumbnail in category listings (show only in Featured section)
    hideThumbnailInCategory: v.optional(v.boolean()),
    // Hide from submissions page only (still shows on Directory if approved)
    hideFromSubmissions: v.optional(v.boolean()),
    // Related component IDs (admin-managed)
    relatedComponentIds: v.optional(v.array(v.id("packages"))),
    // Cached issue counts from GitHub or GitLab (refreshed via action).
    // Field names predate GitLab support; provider comes from repositoryUrl.
    githubOpenIssues: v.optional(v.number()),
    githubClosedIssues: v.optional(v.number()),
    githubIssuesFetchedAt: v.optional(v.number()),

    // --- AI-generated SEO/AEO/GEO structured content ---
    // One-liner value prop (becomes meta description + AI citation sentence)
    seoValueProp: v.optional(v.string()),
    // 3-4 outcome-focused benefit bullets
    seoBenefits: v.optional(v.array(v.string())),
    // Use cases matching real search queries
    seoUseCases: v.optional(
      v.array(
        v.object({
          query: v.string(),
          answer: v.string(),
        }),
      ),
    ),
    // Self-contained FAQ pairs for AI engine extraction
    seoFaq: v.optional(
      v.array(
        v.object({
          question: v.string(),
          answer: v.string(),
        }),
      ),
    ),
    // Consistent resource links per component
    seoResourceLinks: v.optional(
      v.array(
        v.object({
          label: v.string(),
          url: v.string(),
        }),
      ),
    ),
    // Timestamp of last SEO content generation
    seoGeneratedAt: v.optional(v.number()),
    // Track generation state
    seoGenerationStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("generating"),
        v.literal("completed"),
        v.literal("error"),
      ),
    ),
    // Error message if generation fails
    seoGenerationError: v.optional(v.string()),
    // Hide generated SEO and SKILL-related content from the public detail page
    hideSeoAndSkillContentOnDetailPage: v.optional(v.boolean()),
    // AI-generated SKILL.md content for Claude agent skills
    skillMd: v.optional(v.string()),

    // --- New generated component directory content (v2 content model) ---
    // AI-generated description section for the detail page
    generatedDescription: v.optional(v.string()),
    // AI-generated use cases section
    generatedUseCases: v.optional(v.string()),
    // AI-generated "how it works" section
    generatedHowItWorks: v.optional(v.string()),
    // README excerpt extracted between include markers (or full README fallback)
    readmeIncludedMarkdown: v.optional(v.string()),
    // Whether the README had the include markers or used full fallback
    readmeIncludeSource: v.optional(
      v.union(v.literal("markers"), v.literal("full")),
    ),
    // Content generation status for the new model
    contentGenerationStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("generating"),
        v.literal("completed"),
        v.literal("error"),
      ),
    ),
    contentGenerationError: v.optional(v.string()),
    contentGeneratedAt: v.optional(v.number()),
    // Version flag: 1 = old SEO model, 2 = new generated content model
    contentModelVersion: v.optional(v.number()),

    // Snapshot of user-submitted descriptions before content model migration
    submittedShortDescription: v.optional(v.string()),
    submittedLongDescription: v.optional(v.string()),

    // Reward tracking (denormalized for quick badge rendering)
    rewardStatus: v.optional(
      v.union(
        v.literal("not_sent"),
        v.literal("sent"),
        v.literal("delivered"),
        v.literal("failed"),
      ),
    ),
    rewardTotalAmount: v.optional(v.number()),

    // --- Security scan fields (denormalized latest snapshot) ---
    securityScanStatus: v.optional(
      v.union(
        v.literal("not_scanned"),
        v.literal("scanning"),
        v.literal("safe"),
        v.literal("unsafe"),
        v.literal("warning"),
        v.literal("error"),
      ),
    ),
    securityScanSummary: v.optional(v.string()),
    securityScanUpdatedAt: v.optional(v.number()),
    securityScanError: v.optional(v.string()),
    socketScanStatus: v.optional(v.string()),
    snykScanStatus: v.optional(v.string()),
    devinScanStatus: v.optional(v.string()),
  })
    .index("by_name", ["name"])
    .index("by_submitted_at", ["submittedAt"])
    .index("by_approved_at", ["approvedAt"])
    .index("by_visibility", ["visibility"])
    .index("by_slug", ["slug"])
    .index("by_category_and_visibility", ["category", "visibility"])
    .index("by_submitter_email", ["submitterEmail"])
    .index("by_marked_for_deletion", ["markedForDeletion"])
    .index("by_reviewStatus_and_visibility_and_markedForDeletion", [
      "reviewStatus",
      "visibility",
      "markedForDeletion",
    ])
    .index("by_featured_and_reviewStatus", ["featured", "reviewStatus"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["visibility", "reviewStatus"],
    })
    .searchIndex("search_description", {
      searchField: "description",
      filterFields: ["visibility", "reviewStatus"],
    })
    .searchIndex("search_shortDescription", {
      searchField: "shortDescription",
      filterFields: ["visibility", "reviewStatus"],
    })
    .searchIndex("search_maintainers", {
      searchField: "maintainerNames",
      filterFields: ["visibility", "reviewStatus"],
    })
    .searchIndex("search_componentName", {
      searchField: "componentName",
      filterFields: ["visibility", "reviewStatus"],
    })
    .searchIndex("search_repositoryUrl", {
      searchField: "repositoryUrl",
      filterFields: ["visibility", "reviewStatus"],
    }),

  // Admin notes for packages (internal, admin-only) - supports threading
  packageNotes: defineTable({
    packageId: v.id("packages"),
    content: v.string(),
    authorEmail: v.string(),
    authorName: v.optional(v.string()),
    parentNoteId: v.optional(v.id("packageNotes")), // For threaded replies
    createdAt: v.number(),
    isAdminReply: v.optional(v.boolean()), // True if this is an admin reply to a user request
    userHasRead: v.optional(v.boolean()), // True if user has seen admin reply
    adminHasRead: v.optional(v.boolean()), // True if admin has seen user request
  })
    .index("by_package_and_created", ["packageId", "createdAt"])
    .index("by_parent", ["parentNoteId"]),

  // Private messages for package submitter/admin communication
  packageComments: defineTable({
    packageId: v.id("packages"),
    content: v.string(),
    authorEmail: v.string(),
    authorName: v.optional(v.string()),
    createdAt: v.number(),
    adminHasRead: v.optional(v.boolean()), // True if admin has seen comment
    userHasRead: v.optional(v.boolean()), // True if submitter has seen admin message
    status: v.optional(
      v.union(v.literal("active"), v.literal("hidden"), v.literal("archived")),
    ),
    statusUpdatedAt: v.optional(v.number()),
    // Set when an admin asked to mirror this message as a GitHub issue on the
    // submitter's repo. Filled in by githubIssues.createIssueForComment.
    githubIssueStatus: v.optional(
      v.union(v.literal("pending"), v.literal("created"), v.literal("failed")),
    ),
    githubIssueUrl: v.optional(v.string()),
    githubIssueError: v.optional(v.string()),
    // owner/repo#n for the issue this message was mirrored to (as a new issue
    // or as a comment on an existing one). Replies are matched on this key.
    githubIssueKey: v.optional(v.string()),
    githubMirrorKind: v.optional(
      v.union(v.literal("issue"), v.literal("comment")),
    ),
    // Last known state of the issue this row owns; refreshed when an admin
    // follows up or when the poller sees a state_change notification.
    githubIssueState: v.optional(v.union(v.literal("open"), v.literal("closed"))),
    // "github": created by githubReplySync when a submitter replied on GitHub.
    // "system": review outcome message auto sent by the app (authorEmail "AI").
    source: v.optional(v.union(v.literal("github"), v.literal("system"))),
    githubCommentId: v.optional(v.number()),
    githubCommentUrl: v.optional(v.string()),
    githubAuthorLogin: v.optional(v.string()),
    githubBroadcastId: v.optional(v.id("githubBroadcasts")),
  })
    .index("by_package_and_created", ["packageId", "createdAt"])
    .index("by_github_issue_key", ["githubIssueKey"])
    .index("by_github_comment_id", ["githubCommentId"])
    .index("by_github_broadcast", ["githubBroadcastId"]),

  // Admin only drafts of the message sent to a submitter after a review
  // outcome. Built from the failed AI review (rejected) or on approval.
  // Never shown to submitters; sending inserts a packageComments row.
  reviewMessageDrafts: defineTable({
    packageId: v.id("packages"),
    kind: v.union(v.literal("rejected"), v.literal("approved")),
    content: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("dismissed"),
    ),
    // aiReviewedAt of the review run the rejection draft was built from
    sourceAiReviewedAt: v.optional(v.number()),
    editedAt: v.optional(v.number()),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
    sentBy: v.optional(v.string()), // admin email or "AI"
    sentCommentId: v.optional(v.id("packageComments")),
  })
    .index("by_package_and_status", ["packageId", "status"])
    .index("by_status", ["status"]),

  // One row per admin "send a GitHub issue to every submitter" run.
  // Counters are patched by the worker as items complete.
  githubBroadcasts: defineTable({
    title: v.string(),
    body: v.string(),
    statusFilter: v.union(
      v.literal("approved"),
      v.literal("pending"),
      v.literal("rejected"),
      v.literal("all"),
    ),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    total: v.number(),
    sent: v.number(),
    failed: v.number(),
    skipped: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    // GitHub replies mirrored into package threads, summed across items.
    replies: v.optional(v.number()),
    // Present when an admin archived the broadcast from the history list.
    archivedAt: v.optional(v.number()),
  }).index("by_created", ["createdAt"]),

  // Per package outcome for a broadcast. Queued rows are processed one at a
  // time by githubIssues.processNextBroadcastItem.
  githubBroadcastItems: defineTable({
    broadcastId: v.id("githubBroadcasts"),
    packageId: v.id("packages"),
    packageName: v.string(),
    repo: v.optional(v.string()), // owner/name when parseable
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    attempts: v.number(),
    issueUrl: v.optional(v.string()),
    issueKey: v.optional(v.string()), // owner/repo#n, used to match replies
    issueState: v.optional(v.union(v.literal("open"), v.literal("closed"))),
    replyCount: v.optional(v.number()),
    error: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_broadcast", ["broadcastId"])
    .index("by_broadcast_and_status", ["broadcastId", "status"])
    .index("by_issue_key", ["issueKey"])
    .index("by_package", ["packageId"]),

  // Singleton for the GitHub notifications poller (githubReplySync). Holds
  // the cached token login, polling cursor, and last run summary shown in the
  // admin Reply sync card.
  githubSyncState: defineTable({
    tokenLogin: v.optional(v.string()),
    tokenSource: v.optional(
      v.union(v.literal("notifications"), v.literal("default")),
    ),
    lastPolledAt: v.optional(v.number()),
    lastModified: v.optional(v.string()), // GitHub Last-Modified header
    pollIntervalSeconds: v.optional(v.number()),
    lastRunSummary: v.optional(v.string()),
    lastError: v.optional(v.string()),
    updatedAt: v.number(),
  }),

  // Review status change notifications shown in the submitter's header bell
  statusNotifications: defineTable({
    packageId: v.id("packages"),
    recipientEmail: v.string(),
    reviewStatus: v.union(
      v.literal("in_review"),
      v.literal("approved"),
      v.literal("changes_requested"),
      v.literal("rejected"),
    ),
    createdAt: v.number(),
    read: v.boolean(),
  })
    .index("by_recipientEmail_and_read", ["recipientEmail", "read"])
    .index("by_package", ["packageId"]),

  // Historical AI review runs for admin audit and comparison
  aiReviewRuns: defineTable({
    packageId: v.id("packages"),
    createdAt: v.number(),
    status: v.union(
      v.literal("passed"),
      v.literal("failed"),
      v.literal("partial"),
      v.literal("error"),
    ),
    summary: v.string(),
    criteria: v.array(
      v.object({
        name: v.string(),
        passed: v.boolean(),
        notes: v.string(),
      }),
    ),
    error: v.optional(v.string()),
    provider: v.optional(
      v.union(v.literal("anthropic"), v.literal("openai"), v.literal("gemini")),
    ),
    model: v.optional(v.string()),
    source: v.optional(v.string()),
    rawOutput: v.optional(v.string()),
  }).index("by_package_and_created", ["packageId", "createdAt"]),

  // Historical security scan runs for admin audit and comparison
  securityScanRuns: defineTable({
    packageId: v.id("packages"),
    createdAt: v.number(),
    status: v.union(
      v.literal("safe"),
      v.literal("unsafe"),
      v.literal("warning"),
      v.literal("error"),
    ),
    summary: v.string(),
    findings: v.array(
      v.object({
        provider: v.union(
          v.literal("socket"),
          v.literal("snyk"),
          v.literal("devin"),
        ),
        severity: v.union(
          v.literal("critical"),
          v.literal("high"),
          v.literal("medium"),
          v.literal("low"),
          v.literal("info"),
        ),
        title: v.string(),
        description: v.string(),
        recommendation: v.string(),
      }),
    ),
    recommendations: v.array(v.string()),
    providerResults: v.object({
      socket: v.optional(
        v.object({
          status: v.string(),
          score: v.optional(v.number()),
          issueCount: v.optional(v.number()),
          rawSummary: v.optional(v.string()),
        }),
      ),
      snyk: v.optional(
        v.object({
          status: v.string(),
          vulnerabilityCount: v.optional(v.number()),
          criticalCount: v.optional(v.number()),
          highCount: v.optional(v.number()),
          rawSummary: v.optional(v.string()),
        }),
      ),
      devin: v.optional(
        v.object({
          status: v.string(),
          sessionId: v.optional(v.string()),
          sessionUrl: v.optional(v.string()),
          findingCount: v.optional(v.number()),
          rawSummary: v.optional(v.string()),
        }),
      ),
    }),
    error: v.optional(v.string()),
    triggeredBy: v.optional(v.string()),
  }).index("by_package_and_created", ["packageId", "createdAt"]),

  // Reward payments tracking (Tremendous integration)
  payments: defineTable({
    packageId: v.optional(v.id("packages")),
    recipientEmail: v.string(),
    recipientName: v.optional(v.string()),
    amount: v.number(),
    currencyCode: v.string(), // default "USD"
    tremendousOrderId: v.optional(v.string()),
    tremendousRewardId: v.optional(v.string()),
    tremendousRewardLink: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
    isTest: v.optional(v.boolean()),
    sentBy: v.string(), // admin email or "auto"
    sentAt: v.number(),
    note: v.optional(v.string()),
  })
    .index("by_package", ["packageId"])
    .index("by_status", ["status"])
    .index("by_sent_at", ["sentAt"]),

  // Admin settings for AI review, SEO automation, thumbnails, and auto-refresh
  // Keys include "autoAiReview", "autoApproveOnPass", "autoRejectOnFail", "autoGenerateSeoOnPendingOrInReview", "autoGenerateThumbnailOnSubmit", "rotateThumbnailTemplatesOnSubmit", and "autoRefreshEnabled"
  // For numeric settings like refreshIntervalDays, store in adminSettingsNumeric
  adminSettings: defineTable({
    key: v.string(),
    value: v.boolean(),
  }).index("by_key", ["key"]),

  // Admin settings for numeric values (e.g., refreshIntervalDays)
  adminSettingsNumeric: defineTable({
    key: v.string(),
    value: v.number(),
  }).index("by_key", ["key"]),

  // Badge fetch analytics - one row per fetch, aggregate in queries
  // Tracks views when component authors embed badges in their READMEs
  badgeFetches: defineTable({
    slug: v.string(),
    packageId: v.optional(v.id("packages")),
    fetchedAt: v.number(),
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  })
    .index("by_slug_and_fetched_at", ["slug", "fetchedAt"])
    .index("by_package", ["packageId"]),

  // Admin-managed categories for the directory
  categories: defineTable({
    // Unique slug id (e.g. "ai", "auth", "backend")
    slug: v.string(),
    // Display label (e.g. "AI", "Auth")
    label: v.string(),
    // Description shown on directory page
    description: v.string(),
    // Sort order for display
    sortOrder: v.number(),
    // Whether this category is shown in dropdowns and on the directory
    enabled: v.boolean(),
    // When set, membership is computed by rule instead of the package `category` field.
    // "official" = repo in the get-convex GitHub org or an @convex-dev npm package.
    derivedFrom: v.optional(v.literal("official")),
    // "curated" = membership is hand-picked by admins via the categoryMemberships
    // join table instead of the package `category` field. Components keep their
    // primary category and can belong to any number of curated categories.
    kind: v.optional(v.literal("curated")),
    // Optional small badge image shown on member component cards (curated only)
    badgeStorageId: v.optional(v.id("_storage")),
    badgeUrl: v.optional(v.string()),
    // Hide every thumbnail on this category's page and grouped directory section,
    // for categories where only a few components have images and the grid looks uneven.
    hideThumbnails: v.optional(v.boolean()),
    // Show every available thumbnail on this category's landing page only, overriding
    // per-component hideThumbnailInCategory. The directory homepage ignores it.
    // Never true together with hideThumbnails (upsertCategory normalizes).
    showAllThumbnails: v.optional(v.boolean()),
    // Denormalized counts (updated on approval/visibility changes)
    packageCount: v.optional(v.number()),
    verifiedCount: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_sort_order", ["sortOrder"])
    .index("by_enabled_and_sortOrder", ["enabled", "sortOrder"]),

  // Join table for curated category membership (many-to-many).
  // Admins hand-pick which components belong to a curated category, so a
  // component can live in multiple categories without changing its primary
  // `category` field.
  categoryMemberships: defineTable({
    categoryId: v.id("categories"),
    packageId: v.id("packages"),
    addedAt: v.number(),
    addedBy: v.optional(v.string()),
  })
    .index("by_category", ["categoryId"])
    .index("by_package", ["packageId"])
    .index("by_category_and_package", ["categoryId", "packageId"]),

  // Star ratings for components (one per user session / fingerprint)
  componentRatings: defineTable({
    packageId: v.id("packages"),
    rating: v.number(), // 1-5
    sessionId: v.string(), // anonymous session identifier
    createdAt: v.number(),
  }).index("by_package_and_session", ["packageId", "sessionId"]),

  // Thumbnail background templates for auto-generating 16:9 thumbnails
  // Admin uploads gradient/image backgrounds; user logos get centered on top
  thumbnailTemplates: defineTable({
    // Display name (e.g. "Sunset Coral", "Ocean Breeze")
    name: v.string(),
    // Convex file storage ID for the background image
    storageId: v.id("_storage"),
    // Resolved preview URL for admin display
    previewUrl: v.optional(v.string()),
    // CSS gradient string for reference/fallback (e.g. "linear-gradient(135deg, #ff6b6b 0%, ...)")
    gradient: v.optional(v.string()),
    // Whether this template is available for selection
    active: v.boolean(),
    // Whether this is the default template for auto-generation
    isDefault: v.boolean(),
    // Sort order in admin list
    sortOrder: v.number(),
    // Optional safe area for logo placement (pixels in 1536x864 canvas)
    safeAreaX: v.optional(v.number()),
    safeAreaY: v.optional(v.number()),
    safeAreaWidth: v.optional(v.number()),
    safeAreaHeight: v.optional(v.number()),
  })
    .index("by_active_and_sort", ["active", "sortOrder"])
    .index("by_default", ["isDefault"])
    .index("by_sort_order", ["sortOrder"]),

  // Thumbnail generation job tracking for status/history
  thumbnailJobs: defineTable({
    packageId: v.id("packages"),
    templateId: v.optional(v.id("thumbnailTemplates")),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_package_and_created", ["packageId", "createdAt"]),

  // Refresh logs for tracking auto-refresh and manual refresh runs
  refreshLogs: defineTable({
    runAt: v.number(),
    packagesProcessed: v.number(),
    packagesSucceeded: v.number(),
    packagesFailed: v.number(),
    errors: v.array(
      v.object({
        packageId: v.id("packages"),
        packageName: v.string(),
        error: v.string(),
      }),
    ),
    completedAt: v.optional(v.number()),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    isManual: v.optional(v.boolean()), // true if triggered by "Refresh All" button
  })
    .index("by_run_at", ["runAt"])
    .index("by_status", ["status"]),

  // AI provider configuration (API keys and models for Anthropic, OpenAI, Gemini)
  aiProviderSettings: defineTable({
    provider: v.union(
      v.literal("anthropic"),
      v.literal("openai"),
      v.literal("gemini"),
    ),
    apiKey: v.optional(v.string()),
    model: v.optional(v.string()),
    isEnabled: v.boolean(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  }).index("by_provider", ["provider"]),

  // AI review prompt versions (append-only for history)
  aiPromptVersions: defineTable({
    content: v.string(),
    isActive: v.boolean(),
    isDefault: v.boolean(),
    createdAt: v.number(),
    createdBy: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_active", ["isActive"])
    .index("by_isDefault", ["isDefault"])
    .index("by_created_at", ["createdAt"]),

  // SEO/SKILL.md prompt versions (append-only for history)
  seoPromptVersions: defineTable({
    content: v.string(),
    isActive: v.boolean(),
    isDefault: v.boolean(),
    createdAt: v.number(),
    createdBy: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_active", ["isActive"])
    .index("by_isDefault", ["isDefault"])
    .index("by_created_at", ["createdAt"]),

  // API request logs (for monitoring and rate limiting)
  mcpApiLogs: defineTable({
    endpoint: v.string(), // e.g. "search", "component", "install-command", "docs"
    slug: v.optional(v.string()), // component slug if applicable
    query: v.optional(v.string()), // search query if applicable
    userAgent: v.optional(v.string()),
    referer: v.optional(v.string()),
    requestedAt: v.number(),
    responseStatus: v.number(), // HTTP status code
    responseTimeMs: v.optional(v.number()),
    apiKeyId: v.optional(v.id("apiKeys")), // tracks which API key made the request
    hashedIp: v.optional(v.string()), // hashed IP for anonymous rate limiting
  })
    .index("by_endpoint_and_requested_at", ["endpoint", "requestedAt"])
    .index("by_requested_at", ["requestedAt"])
    .index("by_apiKeyId_and_requestedAt", ["apiKeyId", "requestedAt"])
    .index("by_hashedIp_and_requestedAt", ["hashedIp", "requestedAt"]),

  // Public preflight checks for component validation before submission
  // Tracks rate limiting by hashed IP and caches results by repo URL
  preflightChecks: defineTable({
    normalizedRepoUrl: v.string(),
    hashedIp: v.string(),
    createdAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("passed"),
      v.literal("failed"),
      v.literal("partial"),
      v.literal("error"),
    ),
    summary: v.optional(v.string()),
    criteria: v.optional(
      v.array(
        v.object({
          name: v.string(),
          passed: v.boolean(),
          notes: v.string(),
        }),
      ),
    ),
    expiresAt: v.number(),
    // True for signed out (guest) runs; drives the global guest hourly cap
    isGuest: v.optional(v.boolean()),
    // Component folder and branch the review actually read
    reviewedPath: v.optional(v.string()),
    reviewedRef: v.optional(v.string()),
    // Package folder URL to submit instead of a monorepo root URL
    suggestedRepoUrl: v.optional(v.string()),
  })
    .index("by_hashed_ip_and_created", ["hashedIp", "createdAt"])
    .index("by_hashed_ip_and_status", ["hashedIp", "status"])
    .index("by_repo_and_expires", ["normalizedRepoUrl", "expiresAt"])
    .index("by_is_guest_and_created", ["isGuest", "createdAt"]),

  contentGenerationRequests: defineTable({
    userKey: v.string(),
    source: v.union(v.literal("submit"), v.literal("profile")),
    createdAt: v.number(),
  }).index("by_userKey_and_createdAt", ["userKey", "createdAt"]),

  // Rate limit log for user-triggered README refreshes from the profile page
  readmeRefreshRequests: defineTable({
    userKey: v.string(),
    packageId: v.id("packages"),
    createdAt: v.number(),
  }).index("by_userKey_and_createdAt", ["userKey", "createdAt"]),

  // Audit log for README update attempts (cron auto-update, admin button, profile button).
  // One row per package attempt; browsed/filtered/cleared from the admin Logs tab.
  readmeUpdateLogs: defineTable({
    packageId: v.optional(v.id("packages")),
    packageName: v.string(),
    status: v.union(
      v.literal("success"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    source: v.union(
      v.literal("cron"),
      v.literal("admin"),
      v.literal("profile"),
    ),
    changed: v.optional(v.boolean()), // true when the stored README content actually changed
    message: v.optional(v.string()), // error or skip reason
  })
    .index("by_status", ["status"])
    .index("by_source", ["source"]),

  // Per-user API keys for REST API access
  apiKeys: defineTable({
    tokenIdentifier: v.string(),
    keyHash: v.string(),
    keyPrefix: v.string(), // first 12 chars for display (e.g. "cdk_a1b2c3d4")
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    requestCount: v.number(),
    status: v.union(v.literal("active"), v.literal("revoked")),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_tokenIdentifier_and_status", ["tokenIdentifier", "status"])
    .index("by_status", ["status"]),

  // Latest aggregated all-time downloads growth series across approved packages.
  // One snapshot document at a time (old ones deleted on save); built on demand
  // from the npm downloads API by the admin Growth tab.
  downloadGrowthSeries: defineTable({
    generatedAt: v.number(),
    startMonth: v.string(), // "YYYY-MM"
    endMonth: v.string(), // "YYYY-MM"
    months: v.array(
      v.object({
        month: v.string(), // "YYYY-MM"
        downloads: v.number(), // downloads in that month across all packages
        cumulative: v.number(), // running all-time total through that month
      }),
    ),
    packagesIncluded: v.number(),
    packagesFailed: v.array(v.string()),
    totalDownloads: v.number(),
    // Packages baked into this snapshot's months; lets refreshes stay
    // incremental (only new packages need their npm history fetched)
    packageNames: v.optional(v.array(v.string())),
  }),

  // Admin-granted API access per user email (checked at key generation and profile gate)
  apiAccessGrants: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    grantedAt: v.number(),
    grantedBy: v.string(),
    revoked: v.boolean(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_revoked", ["revoked"]),

  // Admin Activity tab: one row per signed-in user event (submissions,
  // messages, profile edits, account changes). Purged after 180 days.
  // Fields live in userValidators.ts so admin return validators match.
  userActivity: defineTable(userActivityFields)
    .index("by_createdAt", ["createdAt"])
    .index("by_category_and_createdAt", ["category", "createdAt"])
    .index("by_actorEmail_and_createdAt", ["actorEmail", "createdAt"])
    .index("by_actorEmail_and_category_and_createdAt", [
      "actorEmail",
      "category",
      "createdAt",
    ])
    .index("by_packageId_and_createdAt", ["packageId", "createdAt"])
    .index("by_sourceKey", ["sourceKey"])
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["category", "actorEmail"],
    }),

  // Admin Users tab: one row per lowercased email that signed in or submitted.
  // status gates every user write (see convex/userAccounts.ts).
  userAccounts: defineTable(userAccountFields)
    .index("by_email", ["email"])
    .index("by_status_and_lastSeenAt", ["status", "lastSeenAt"])
    .index("by_lastSeenAt", ["lastSeenAt"])
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["status"],
    }),
};

export default defineSchema({
  ...applicationTables,
});
