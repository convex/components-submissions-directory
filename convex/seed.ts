// Seed script to import official Convex components from convex.dev/components
// Run via CLI: npx convex run seed:seedOfficialComponents
// Or with args: npx convex run seed:seedOfficialComponents '{"dryRun": true}'
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { fetchNpmPackageHandler } from "./packages";

// Official component data from convex.dev/components (sourced from components.ts)
// Each component can optionally specify featured: true for homepage featuring
const OFFICIAL_COMPONENTS = [
  // Database
  { id: "sharded-counter", category: "database", title: "Sharded Counter", description: "Scalable counter that can increment and decrement with high throughput.", repo: "https://github.com/convex/sharded-counter", npmPackage: "@convex-dev/sharded-counter" },
  { id: "migrations", category: "database", title: "Migrations", description: "Framework for long running data migrations of live data.", repo: "https://github.com/convex/migrations", npmPackage: "@convex-dev/migrations" },
  { id: "aggregate", category: "database", title: "Aggregate", description: "Keep track of sums and counts in a denormalized and scalable way.", repo: "https://github.com/convex/aggregate", npmPackage: "@convex-dev/aggregate" },
  { id: "geospatial", category: "database", title: "Geospatial", description: "Efficiently query points on a map within a selected region of the globe.", repo: "https://github.com/convex/geospatial", npmPackage: "@convex-dev/geospatial" },

  // AI
  { id: "rag", category: "ai", title: "RAG", description: "Retrieval-Augmented Generation (RAG) for use with your AI products and Agents", repo: "https://github.com/convex/rag", npmPackage: "@convex-dev/rag" },
  { id: "agent", category: "ai", title: "AI Agent", description: "Agents organize your AI workflows into units, with message history and vector search built in.", repo: "https://github.com/convex/agent", npmPackage: "@convex-dev/agent" },
  { id: "persistent-text-streaming", category: "ai", title: "Persistent Text Streaming", description: "Stream text like AI chat to the browser in real-time while also efficiently storing it to the database.", repo: "https://github.com/convex/persistent-text-streaming", npmPackage: "@convex-dev/persistent-text-streaming" },
  { id: "neutralcost", category: "ai", title: "Neutral Cost", description: "Organizes all of your costs into one place. Seamlessly track your AI usage and Tool costs and charge accordingly.", repo: "https://github.com/neutralbase/neutral-cost", npmPackage: "neutral-cost" },
  { id: "database-chat", category: "ai", title: "DatabaseChat", description: "Lets users ask questions about your data in plain English.", repo: "https://github.com/dayhaysoos/convex-database-chat", npmPackage: "@dayhaysoos/convex-database-chat" },
  { id: "firecrawl-scrape", category: "ai", title: "Firecrawl Scrape", description: "Scrape any URL and get clean markdown, HTML, screenshots, or structured JSON - with durable caching and reactive queries.", repo: "https://github.com/Gitmaxd/convex-firecrawl-scrape", npmPackage: "convex-firecrawl-scrape" },
  { id: "durable-agents", category: "ai", title: "Durable Agents", description: "Build AI agents that can run indefinitely and survive failures and restarts.", repo: "https://github.com/ziegfried/convex-durable-agents", npmPackage: "convex-durable-agents" },
  { id: "stagehand", category: "ai", title: "Stagehand", description: "Extract data, perform actions, and automate workflows using natural language - no Playwright knowledge required.", repo: "https://github.com/browserbase/convex-stagehand", npmPackage: "@browserbasehq/convex-stagehand" },
  { id: "browser-use", category: "ai", title: "Browser Use", description: "Enables AI-powered browser automation with persistent task tracking, session management, and reactive queries.", repo: "https://github.com/Cheggin/browser-use-convex-component", npmPackage: "browser-use-convex-component", featured: true },

  // Durable Functions
  { id: "workpool", category: "durable-functions", title: "Workpool", description: "Workpools give critical tasks priority by organizing async operations into separate, customizable queues.", repo: "https://github.com/convex/workpool", npmPackage: "@convex-dev/workpool" },
  { id: "crons", category: "durable-functions", title: "Crons", description: "Use cronspec to run functions on a repeated schedule.", repo: "https://github.com/convex/crons", npmPackage: "@convex-dev/crons" },
  { id: "workflow", category: "durable-functions", title: "Workflow", description: "Simplify programming long running code flows. Workflows execute durably with configurable retries and delays.", repo: "https://github.com/convex/workflow", npmPackage: "@convex-dev/workflow" },
  { id: "retrier", category: "durable-functions", title: "Action Retrier", description: "Add reliability to an unreliable external service. Retry idempotent calls a set number of times.", repo: "https://github.com/convex/action-retrier", npmPackage: "@convex-dev/action-retrier" },

  // Backend
  { id: "rate-limiter", category: "backend", title: "Rate Limiter", description: "Define and use application-layer rate limits. Type-safe, transactional, fair, safe, and configurable sharding to scale.", repo: "https://github.com/convex/rate-limiter", npmPackage: "@convex-dev/rate-limiter" },
  { id: "action-cache", category: "backend", title: "Action Cache", description: "Cache action results, like expensive AI calls, with optional expiration times.", repo: "https://github.com/convex/action-cache", npmPackage: "@convex-dev/action-cache" },
  { id: "presence", category: "backend", title: "Presence", description: "Track user presence in real-time.", repo: "https://github.com/convex/presence", npmPackage: "@convex-dev/presence" },
  { id: "files-control", category: "backend", title: "Files Control", description: "Secure file uploads, access control, download grants, and lifecycle cleanup.", repo: "https://github.com/gilhrpenner/convex-files-control", npmPackage: "@gilhrpenner/convex-files-control" },
  { id: "convex-fs", category: "backend", title: "ConvexFS", description: "A powerful, globally distributed file storage and serving component for Convex.", repo: "https://github.com/jamwt/convex-fs", npmPackage: "convex-fs" },
  { id: "nano-banana", category: "backend", title: "Nano Banana", description: "Generate stunning AI images directly in your Convex backend with persistent storage, real-time status tracking, and a clean TypeScript API.", repo: "https://github.com/dperussina/convex-nano-banana", npmPackage: "convex-nano-banana" },
  { id: "timeline", category: "backend", title: "Timeline", description: "Undo/redo state management with named checkpoints.", repo: "https://github.com/MeshanKhosla/convex-timeline", npmPackage: "convex-timeline" },
  { id: "debouncer", category: "backend", title: "Convex Debouncer", description: "Debounce expensive operations like LLM calls, metrics computation, or any heavy processing that should only run after a period of inactivity.", repo: "https://github.com/ikhrustalev/convex-debouncer", npmPackage: "@ikhrustalev/convex-debouncer" },

  // Integrations
  { id: "cloudflare-r2", category: "integrations", title: "Cloudflare R2", description: "Store and serve files from Cloudflare R2.", repo: "https://github.com/convex/r2", npmPackage: "@convex-dev/r2" },
  { id: "resend", category: "integrations", title: "Resend", description: "Send reliable transactional emails to your users with Resend.", repo: "https://github.com/convex/resend", npmPackage: "@convex-dev/resend" },
  { id: "prosemirror-sync", category: "integrations", title: "Collaborative Text Editor Sync", description: "Add a collaborative editor sync engine for the popular ProseMirror-based Tiptap and BlockNote rich text editors.", repo: "https://github.com/convex/prosemirror-sync", npmPackage: "@convex-dev/prosemirror-sync" },
  { id: "push-notifications", category: "integrations", title: "Expo Push Notifications", description: "Send push notifications with Expo. Manage retries and batching.", repo: "https://github.com/convex/expo-push-notifications", npmPackage: "@convex-dev/expo-push-notifications" },
  { id: "twilio", category: "integrations", title: "Twilio SMS", description: "Easily send and receive SMS via Twilio. Easily query message status from your query function.", repo: "https://github.com/convex/twilio", npmPackage: "@convex-dev/twilio" },
  { id: "launchdarkly", category: "integrations", title: "LaunchDarkly Feature Flags", description: "Sync your LaunchDarkly feature flags with your Convex backend for use in your Convex functions.", repo: "https://github.com/convex/launchdarkly", npmPackage: "@convex-dev/launchdarkly" },
  { id: "oss-stats", category: "integrations", title: "OSS Stats", description: "Keep GitHub and npm data for your open source projects synced to your Convex database.", repo: "https://github.com/erquhart/convex-oss-stats", npmPackage: "@erquhart/convex-oss-stats" },
  { id: "cloudinary", category: "integrations", title: "Cloudinary", description: "Cloudinary integration that provides image upload, transformation, and management capabilities using direct Cloudinary REST APIs with full TypeScript support.", repo: "https://github.com/imaxisXD/cloudinary-convex", npmPackage: "@imaxis/cloudinary-convex" },
  { id: "loops", category: "integrations", title: "Loops", description: "Integrate with Loops.so email marketing platform. Send transactional emails, manage contacts, trigger loops, and monitor email operations with built-in spam detection and rate limiting.", repo: "https://github.com/robertalv/loops", npmPackage: "@devwithbobby/loops" },
  { id: "transloadit", category: "integrations", title: "Transloadit", description: "Create Transloadit Assemblies, sign Uppy uploads, and persist status/results in Convex.", repo: "https://github.com/transloadit/convex", npmPackage: "@transloadit/convex" },

  // Payments
  { id: "polar", category: "payments", title: "Polar", description: "Add subscriptions and billing to your Convex app with Polar.", repo: "https://github.com/erquhart/convex-polar", npmPackage: "@convex-dev/polar" },
  { id: "autumn", category: "payments", title: "Autumn", description: "Autumn is your application's pricing and billing database.", repo: "https://github.com/useautumn/autumn-js/blob/main/convex/README.md", npmPackage: "@useautumn/convex" },
  { id: "dodopayments", category: "payments", title: "Dodo Payments", description: "Dodo Payments is your complete solution for billing and payments, purpose-built for AI and SaaS applications.", repo: "https://github.com/dodopayments/dodo-adapters/blob/main/packages/convex/README.md", npmPackage: "@dodopayments/convex" },
  { id: "stripe", category: "payments", title: "Stripe", description: "Integrates Stripe payments, subscriptions, and billing into your Convex application.", repo: "https://github.com/convex/stripe", npmPackage: "@convex-dev/stripe", featured: true },

  // Auth
  { id: "workos-authkit", category: "auth", title: "WorkOS AuthKit", description: "Integrate with AuthKit events and actions, and keep auth data synced in your Convex database.", repo: "https://github.com/convex/workos-authkit", npmPackage: "@convex-dev/workos-authkit", featured: true },
  { id: "better-auth", category: "auth", title: "Better Auth", description: "Provides an integration layer for using Better Auth with Convex.", repo: "https://github.com/convex/better-auth", npmPackage: "@convex-dev/better-auth" },
];

// Determine if a package is first-party (convex org, formerly get-convex, or @convex-dev scope)
function isFirstParty(repo: string, npmPackage: string): boolean {
  return /github\.com\/(get-)?convex\//.test(repo) || npmPackage.startsWith("@convex-dev/");
}

// Internal mutation: Insert or update a single official component
async function patchExistingOfficialComponent(ctx: any, existing: any, args: any) {
  await ctx.db.patch(existing._id, {
    slug: existing.slug || args.slug,
    category: existing.category || args.category,
    shortDescription: existing.shortDescription || args.shortDescription,
    componentName: existing.componentName || args.componentName,
    featured: args.featured ?? existing.featured,
    convexVerified: args.convexVerified,
    reviewStatus: existing.reviewStatus || args.reviewStatus,
    visibility: existing.visibility || "visible",
    description: args.description,
    version: args.version,
    license: args.license,
    unpackedSize: args.unpackedSize,
    totalFiles: args.totalFiles,
    lastPublish: args.lastPublish,
    weeklyDownloads: args.weeklyDownloads,
    collaborators: args.collaborators,
    repositoryUrl: args.repositoryUrl,
  });
  return { id: existing._id, action: "updated" as const };
}

async function insertNewOfficialComponent(ctx: any, args: any) {
  const maintainerNames = args.collaborators.map((c: any) => c.name).join(" ");
  const id = await ctx.db.insert("packages", {
    name: args.name,
    description: args.description,
    installCommand: args.installCommand,
    repositoryUrl: args.repositoryUrl,
    npmUrl: args.npmUrl,
    version: args.version,
    license: args.license,
    unpackedSize: args.unpackedSize,
    totalFiles: args.totalFiles,
    lastPublish: args.lastPublish,
    weeklyDownloads: args.weeklyDownloads,
    collaborators: args.collaborators,
    maintainerNames,
    submittedAt: Date.now(),
    slug: args.slug,
    category: args.category,
    shortDescription: args.shortDescription,
    componentName: args.componentName,
    featured: args.featured,
    convexVerified: args.convexVerified,
    reviewStatus: args.reviewStatus,
    visibility: "visible",
    submitterName: "Convex Team",
  });
  return { id, action: "created" as const };
}

export const _upsertOfficialComponent = internalMutation({
  args: {
    name: v.string(),
    description: v.string(),
    installCommand: v.string(),
    repositoryUrl: v.string(),
    npmUrl: v.string(),
    slug: v.string(),
    category: v.string(),
    shortDescription: v.string(),
    componentName: v.string(),
    featured: v.optional(v.boolean()),
    convexVerified: v.boolean(),
    // Review status for new inserts (existing packages preserve their status)
    reviewStatus: v.union(
      v.literal("pending"),
      v.literal("in_review"),
      v.literal("approved"),
      v.literal("changes_requested"),
      v.literal("rejected"),
    ),
    // npm data
    version: v.string(),
    license: v.string(),
    unpackedSize: v.number(),
    totalFiles: v.number(),
    lastPublish: v.string(),
    weeklyDownloads: v.number(),
    collaborators: v.array(v.object({ name: v.string(), avatar: v.string() })),
  },
  returns: v.object({
    id: v.id("packages"),
    action: v.union(v.literal("created"), v.literal("updated")),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("packages")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      return await patchExistingOfficialComponent(ctx, existing, args);
    }
    return await insertNewOfficialComponent(ctx, args);
  },
});

function buildDryRunResult(reviewStatus: string) {
  const wouldImport = OFFICIAL_COMPONENTS.map((comp) => ({
    npmPackage: comp.npmPackage,
    title: comp.title,
    category: comp.category,
  }));
  console.log(`Dry run: ${OFFICIAL_COMPONENTS.length} components would be imported as "${reviewStatus}"`);
  return {
    total: OFFICIAL_COMPONENTS.length,
    created: 0,
    updated: 0,
    failed: 0,
    dryRun: true,
    wouldImport,
  };
}

async function seedSingleComponent(ctx: any, comp: any, reviewStatus: string) {
  const npmData: any = await fetchNpmPackageHandler(ctx, { packageName: comp.npmPackage });
  const slug = comp.id;
  return await ctx.runMutation(internal.seed._upsertOfficialComponent, {
    name: comp.npmPackage,
    description: comp.description,
    installCommand: npmData.installCommand || `npm install ${comp.npmPackage}`,
    repositoryUrl: comp.repo,
    npmUrl: npmData.npmUrl || `https://www.npmjs.com/package/${encodeURIComponent(comp.npmPackage)}`,
    slug,
    category: comp.category,
    shortDescription: comp.description.slice(0, 200),
    componentName: comp.title,
    featured: comp.featured,
    convexVerified: isFirstParty(comp.repo, comp.npmPackage),
    reviewStatus,
    version: npmData.version || "0.0.0",
    license: npmData.license || "Unknown",
    unpackedSize: npmData.unpackedSize || 0,
    totalFiles: npmData.totalFiles || 0,
    lastPublish: npmData.lastPublish || new Date().toISOString(),
    weeklyDownloads: npmData.weeklyDownloads || 0,
    collaborators: npmData.collaborators || [],
  });
}

async function seedAllComponents(ctx: any, reviewStatus: string) {
  let created = 0;
  let updated = 0;
  let failed = 0;
  for (const comp of OFFICIAL_COMPONENTS) {
    try {
      const result = await seedSingleComponent(ctx, comp, reviewStatus);
      if (result.action === "created") {
        created++;
        console.log(`Created: ${comp.npmPackage} (slug: ${comp.id}, status: ${reviewStatus})`);
      } else {
        updated++;
        console.log(`Updated: ${comp.npmPackage} (slug: ${comp.id})`);
      }
    } catch (error) {
      failed++;
      console.error(`Failed to seed ${comp.npmPackage}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  return { created, updated, failed };
}

export const seedOfficialComponents = internalAction({
  args: {
    // If true, new components are imported as pending for admin review
    // If false, new components are imported as approved (default behavior)
    importAsPending: v.optional(v.boolean()),
    // If true, returns what would be imported without actually inserting
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    total: v.number(),
    created: v.number(),
    updated: v.number(),
    failed: v.number(),
    dryRun: v.boolean(),
    // Only populated in dry run mode
    wouldImport: v.optional(v.array(v.object({
      npmPackage: v.string(),
      title: v.string(),
      category: v.string(),
    }))),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const reviewStatus = (args.importAsPending ?? false) ? "pending" : "approved";

    if (dryRun) {
      return buildDryRunResult(reviewStatus);
    }

    const counts = await seedAllComponents(ctx, reviewStatus);
    console.log(
      `Seed complete: ${counts.created} created, ${counts.updated} updated, ${counts.failed} failed out of ${OFFICIAL_COMPONENTS.length}`,
    );
    return { total: OFFICIAL_COMPONENTS.length, ...counts, dryRun: false };
  },
});

// Legacy alias for backward compatibility
export const seedExistingComponents = seedOfficialComponents;
