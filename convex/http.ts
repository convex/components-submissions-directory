import { httpRouter } from "convex/server";
import { httpAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { convexToJson, type Value } from "convex/values";
import { DIRECTORY_SORTS, type DirectorySort } from "./directoryPage";
import type { Doc, Id } from "./_generated/dataModel";
import { buildComponentUrls } from "../shared/componentUrls";
import { normalizeMarkdown } from "../shared/normalizeMarkdown";
import { isOfficialComponent } from "../shared/officialComponents";
import { isSupportedRepoUrl, repoHostLabel } from "../shared/repoUrl";
import { resolveApiCaller, rateLimitHeaders, type ApiCallerResult } from "./apiKeys";
import { BADGE_COLORS, escapeXml, renderBadge } from "./badgeSvg";

const http = httpRouter();
const DIRECTORY_ORIGIN = "https://www.convex.dev";
const MCP_DIRECT_ORIGIN = "https://giant-grouse-674.convex.site";

http.route({
  path: "/api/export-csv",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const packages = await ctx.runQuery(internal.packages._getAllPackages);

    const headers = [
      "name",
      "description",
      "version",
      "license",
      "weeklyDownloads",
      "unpackedSize",
      "totalFiles",
      "lastPublish",
      "repositoryUrl",
      "homepageUrl",
      "npmUrl",
      "submittedAt"
    ];

    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [headers.join(",")];
    
    for (const pkg of packages) {
      const row = [
        escapeCSV(pkg.name),
        escapeCSV(pkg.description),
        escapeCSV(pkg.version),
        escapeCSV(pkg.license),
        escapeCSV(pkg.weeklyDownloads),
        escapeCSV(pkg.unpackedSize),
        escapeCSV(pkg.totalFiles),
        escapeCSV(pkg.lastPublish),
        escapeCSV(pkg.repositoryUrl || ""),
        escapeCSV(pkg.homepageUrl || ""),
        escapeCSV(pkg.npmUrl),
        escapeCSV(new Date(pkg.submittedAt).toISOString())
      ];
      csvRows.push(row.join(","));
    }

    const csvContent = csvRows.join("\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=npm-directory-export.csv"
      }
    });
  })
});

// ============ LLMs.txt ENDPOINT ============
// Shared response headers for the directory-level llms.txt lists (1 hour cache)
function llmsIndexHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=3600, s-maxage=3600",
    "Access-Control-Allow-Origin": "*",
  };
}

// One-line instruction telling agents how to use the skill links in these files
const AGENT_INSTRUCTION_LINE =
  "Agents: before writing code that uses a component, fetch its Skill link (SKILL.md) for setup steps, configuration, and usage patterns.";

// Builds the llms.txt body for a set of packages (full directory or official-only)
function buildLlmsTxtBody(
  packages: any[],
  opts: { title: string; intro: string; extraHeaderLines?: string[] },
): string {
  const lines: string[] = [];
  lines.push(`# ${opts.title}`);
  lines.push(`# ${opts.intro}`);
  lines.push(`# ${AGENT_INSTRUCTION_LINE}`);
  lines.push(
    `# ${packages.length} components | Updated ${new Date().toISOString().slice(0, 10)}`,
  );
  for (const extra of opts.extraHeaderLines ?? []) {
    lines.push(`# ${extra}`);
  }
  lines.push("");

  const sorted = [...packages].sort((a: any, b: any) =>
    (a.name || "").localeCompare(b.name || ""),
  );

  for (const pkg of sorted) {
    const name = pkg.componentName || pkg.name || "Unknown";
    const slug = pkg.slug || "";
    const desc = (pkg.contentModelVersion === 2 && pkg.generatedDescription)
      ? pkg.generatedDescription.slice(0, 200)
      : (pkg.seoValueProp || pkg.shortDescription || pkg.description || "");
    const category = pkg.category || "general";
    const componentLinks = slug
      ? buildComponentUrls(slug, DIRECTORY_ORIGIN)
      : null;
    const url = slug
      ? componentLinks?.detailUrl || pkg.npmUrl
      : pkg.npmUrl;
    const mdUrl = slug
      ? componentLinks?.markdownUrl || ""
      : "";

    lines.push(`## ${name}`);
    lines.push(`- URL: ${url}`);
    if (mdUrl) lines.push(`- Markdown: ${mdUrl}`);
    if (componentLinks && hasPublicSkill(pkg)) {
      lines.push(`- Skill: ${componentLinks.skillUrl}`);
    }
    lines.push(`- npm: ${pkg.npmUrl || ""}`);
    lines.push(`- Version: ${pkg.version || "0.0.0"}`);
    lines.push(`- Category: ${category}`);
    lines.push(`- Description: ${desc}`);
    lines.push("");
  }

  return lines.join("\n");
}

http.route({
  path: "/api/llms.txt",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const packages = await ctx.runQuery(
      internal.packages._listApprovedPackages,
    );

    const body = buildLlmsTxtBody(packages, {
      title: "Convex Components Directory",
      intro:
        "A curated index of open-source components for the Convex backend platform.",
      extraHeaderLines: [
        `Official components by the Convex team: ${DIRECTORY_ORIGIN}/components/get-convex-llms.txt`,
      ],
    });

    return new Response(body, {
      status: 200,
      headers: llmsIndexHeaders(),
    });
  }),
});

// ============ OFFICIAL GET-CONVEX LLMs.txt ENDPOINT ============

http.route({
  path: "/api/get-convex-llms.txt",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const packages = await ctx.runQuery(
      internal.packages._listApprovedPackages,
    );
    const official = packages.filter(isOfficialComponent);

    const body = buildLlmsTxtBody(official, {
      title: "Convex Official Components",
      intro:
        "Open-source components built by the Convex team (github.com/get-convex).",
      extraHeaderLines: [
        `Full directory including community components: ${DIRECTORY_ORIGIN}/components/llms.txt`,
      ],
    });

    return new Response(body, {
      status: 200,
      headers: llmsIndexHeaders(),
    });
  }),
});

// Per-component endpoints serve what the directory lists: approved packages
// that aren't hidden, archived or marked for deletion. Anything still in
// review gets the same 404 as its page, since nobody has checked its
// content (SKILL.md included) yet.
function isPublicPackage(
  pkg: Doc<"packages"> | null,
): pkg is Doc<"packages"> {
  return (
    pkg !== null &&
    pkg.reviewStatus === "approved" &&
    pkg.visibility !== "hidden" &&
    pkg.visibility !== "archived" &&
    !pkg.markedForDeletion
  );
}

// ============ MARKDOWN ENDPOINT ============
http.route({
  path: "/api/markdown",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug") || "";

    if (!slug) {
      return new Response("# Not Found\n\nNo slug provided.", {
        status: 404,
        headers: markdownHeaders(),
      });
    }

    const pkg = await ctx.runQuery(internal.packages._getPackageBySlug, {
      slug,
    });

    if (!isPublicPackage(pkg)) {
      return new Response(`# Not Found\n\nComponent "${slug}" not found.`, {
        status: 404,
        headers: markdownHeaders(),
      });
    }

    const md = buildComponentMarkdown(pkg);

    return new Response(md, {
      status: 200,
      headers: markdownHeaders(),
    });
  }),
});

// ============ SKILL.md ENDPOINT ============
// Serves the raw agent SKILL.md for a component (for /components/<slug>/SKILL.md)
http.route({
  path: "/api/skill",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug") || "";

    if (!slug) {
      return new Response("# Not Found\n\nNo slug provided.", {
        status: 404,
        headers: markdownHeaders(),
      });
    }

    const pkg = await ctx.runQuery(internal.packages._getPackageBySlug, {
      slug,
    });

    if (
      !isPublicPackage(pkg) ||
      pkg.hideSeoAndSkillContentOnDetailPage === true ||
      !pkg.skillMd
    ) {
      return new Response(`# Not Found\n\nNo skill available for "${slug}".`, {
        status: 404,
        headers: markdownHeaders(),
      });
    }

    return new Response(pkg.skillMd, {
      status: 200,
      headers: markdownHeaders(),
    });
  }),
});

// True when a package's SKILL.md may be exposed publicly
function hasPublicSkill(pkg: any): boolean {
  return Boolean(pkg.skillMd) && pkg.hideSeoAndSkillContentOnDetailPage !== true;
}

const CATEGORY_LABELS: Record<string, string> = {
  ai: "AI",
  auth: "Auth",
  backend: "Backend",
  database: "Database",
  "durable-functions": "Durable Functions",
  integrations: "Integrations",
  payments: "Payments",
};

function buildComponentMarkdown(pkg: any): string {
  const lines: string[] = [];
  lines.push(`# ${pkg.name}\n`);
  if (pkg.shortDescription) lines.push(`${pkg.shortDescription}\n`);
  else if (pkg.description) lines.push(`${pkg.description}\n`);

  if (pkg.slug && hasPublicSkill(pkg)) {
    const skillUrl = buildComponentUrls(pkg.slug, DIRECTORY_ORIGIN).skillUrl;
    lines.push(
      `> Agents: fetch the [skill (SKILL.md)](${skillUrl}) before writing code that uses ${pkg.name}. It contains setup steps, configuration, and usage patterns.\n`,
    );
  }

  lines.push(`## Install\n`);
  lines.push("```bash");
  lines.push(pkg.installCommand || `npm install ${pkg.name}`);
  lines.push("```\n");

  lines.push(`## Links\n`);
  lines.push(`- [npm package](${pkg.npmUrl})`);
  if (pkg.repositoryUrl)
    lines.push(`- [${repoHostLabel(pkg.repositoryUrl)} repository](${pkg.repositoryUrl})`);
  if (pkg.slug)
    lines.push(
      `- [Convex Components Directory](https://www.convex.dev/components/${pkg.slug})`,
    );
  if (pkg.slug && hasPublicSkill(pkg))
    lines.push(
      `- [Agent skill (SKILL.md)](${buildComponentUrls(pkg.slug, DIRECTORY_ORIGIN).skillUrl})`,
    );
  if (pkg.demoUrl) lines.push(`- [Live demo](${pkg.demoUrl})`);
  lines.push("");

  if (pkg.authorUsername) lines.push(`**Author:** ${pkg.authorUsername}\n`);
  const catLabel = pkg.category
    ? CATEGORY_LABELS[pkg.category] || pkg.category
    : null;
  if (catLabel) lines.push(`**Category:** ${catLabel}\n`);
  lines.push(`**Version:** ${pkg.version || "0.0.0"}  `);
  lines.push(
    `**Weekly downloads:** ${(pkg.weeklyDownloads || 0).toLocaleString()}\n`,
  );

  if (pkg.tags && pkg.tags.length > 0) {
    lines.push(`**Tags:** ${pkg.tags.join(", ")}\n`);
  }

  // Prefer v2 content model
  if (pkg.contentModelVersion === 2 && pkg.generatedDescription) {
    lines.push(`---\n`);
    lines.push(`## Description\n`);
    lines.push(`${pkg.generatedDescription}\n`);

    if (pkg.generatedUseCases) {
      lines.push(`## Use cases\n`);
      lines.push(`${normalizeMarkdown(pkg.generatedUseCases)}\n`);
    }

    if (pkg.generatedHowItWorks) {
      lines.push(`## How it works\n`);
      lines.push(`${normalizeMarkdown(pkg.generatedHowItWorks)}\n`);
    }

    if (pkg.readmeIncludedMarkdown) {
      lines.push(`---\n`);
      lines.push(pkg.readmeIncludedMarkdown);
    }
  } else {
    // Fallback: old SEO model
    if (pkg.seoValueProp) {
      lines.push(`---\n`);
      lines.push(`> ${pkg.seoValueProp}\n`);
    }

    if (pkg.seoBenefits && pkg.seoBenefits.length > 0) {
      lines.push(`## Benefits\n`);
      for (const benefit of pkg.seoBenefits) {
        lines.push(`- ${benefit}`);
      }
      lines.push("");
    }

    if (pkg.seoUseCases && pkg.seoUseCases.length > 0) {
      lines.push(`## Use cases\n`);
      for (const uc of pkg.seoUseCases) {
        lines.push(`### ${uc.query}\n`);
        lines.push(`${uc.answer}\n`);
      }
    }

    if (pkg.seoFaq && pkg.seoFaq.length > 0) {
      lines.push(`## FAQ\n`);
      for (const faq of pkg.seoFaq) {
        lines.push(`**Q: ${faq.question}**\n`);
        lines.push(`${faq.answer}\n`);
      }
    }

    if (pkg.longDescription) {
      lines.push(`---\n`);
      lines.push(pkg.longDescription);
    }

  }

  if (pkg.slug) {
    lines.push(`\n---\n`);
    lines.push(
      `[![Convex Component](https://www.convex.dev/components/badge/${pkg.slug})](https://www.convex.dev/components/${pkg.slug})`,
    );
  }

  return lines.join("\n");
}

function markdownHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=300",
    "Access-Control-Allow-Origin": "*",
  };
}

// ============ MARKDOWN INDEX ENDPOINT ============
// Builds the markdown index body for a set of packages, grouped by category
function buildMarkdownIndexBody(
  packages: any[],
  opts: { title: string; intro: string },
): string {
  const lines: string[] = [];
  lines.push(`# ${opts.title}\n`);
  lines.push(`${opts.intro}\n`);
  lines.push(`> ${AGENT_INSTRUCTION_LINE}\n`);
  lines.push(`**${packages.length} components** | Updated ${new Date().toISOString().slice(0, 10)}\n`);

  // Group by category
  const byCategory: Record<string, any[]> = {};
  for (const pkg of packages) {
    const cat = pkg.category || "general";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(pkg);
  }

  // Sort categories alphabetically
  const sortedCategories = Object.keys(byCategory).sort();

  for (const category of sortedCategories) {
    const catLabel = CATEGORY_LABELS[category] || category;
    lines.push(`## ${catLabel}\n`);

    // Sort packages within category by name
    const sortedPkgs = byCategory[category].sort((a: any, b: any) =>
      (a.name || "").localeCompare(b.name || ""),
    );

    for (const pkg of sortedPkgs) {
      const name = pkg.componentName || pkg.name || "Unknown";
      const desc = pkg.shortDescription || pkg.description || "";
      const slug = pkg.slug || "";
      const componentLinks = slug
        ? buildComponentUrls(slug, DIRECTORY_ORIGIN)
        : null;
      const detailUrl = slug
        ? componentLinks?.detailUrl || pkg.npmUrl
        : pkg.npmUrl;
      const mdUrl = slug
        ? componentLinks?.markdownUrl || ""
        : "";

      lines.push(`### [${name}](${detailUrl})\n`);
      if (desc) lines.push(`${desc}\n`);
      lines.push(`- Version: ${pkg.version || "0.0.0"}`);
      lines.push(`- Install: \`${pkg.installCommand || `npm install ${pkg.name}`}\``);
      lines.push(`- [npm](${pkg.npmUrl})`);
      if (pkg.repositoryUrl) lines.push(` | [${repoHostLabel(pkg.repositoryUrl)}](${pkg.repositoryUrl})`);
      if (mdUrl) lines.push(` | [Markdown](${mdUrl})`);
      if (componentLinks && hasPublicSkill(pkg)) {
        lines.push(` | [Skill](${componentLinks.skillUrl})`);
      }
      lines.push("\n");
    }
  }

  lines.push("---\n");
  lines.push("[View full directory](https://www.convex.dev/components)\n");

  return lines.join("\n");
}

// Returns markdown listing all approved components (for /components.md)
http.route({
  path: "/api/markdown-index",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const packages = await ctx.runQuery(
      internal.packages._listApprovedPackages,
    );

    const body = buildMarkdownIndexBody(packages, {
      title: "Convex Components Directory",
      intro:
        "A curated index of open-source components for the Convex backend platform.",
    });

    return new Response(body, {
      status: 200,
      headers: markdownHeaders(),
    });
  }),
});

// ============ OFFICIAL GET-CONVEX MARKDOWN INDEX ENDPOINT ============
// Returns markdown listing only official get-convex components (for /components/get-convex.md)
http.route({
  path: "/api/get-convex-markdown",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const packages = await ctx.runQuery(
      internal.packages._listApprovedPackages,
    );
    const official = packages.filter(isOfficialComponent);

    const body = buildMarkdownIndexBody(official, {
      title: "Convex Official Components",
      intro:
        "Open-source components built by the Convex team ([github.com/get-convex](https://github.com/get-convex)). For the full directory including community components, see [components.md](https://www.convex.dev/components/components.md).",
    });

    return new Response(body, {
      status: 200,
      headers: markdownHeaders(),
    });
  }),
});

// ============ COMPONENT LLMs.txt ENDPOINT ============
// Returns llms.txt format for a single component (for /components/<slug>/llms.txt)
http.route({
  path: "/api/component-llms",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug") || "";

    if (!slug) {
      return new Response("# Not Found\n\nNo slug provided.", {
        status: 404,
        headers: llmsTxtHeaders(),
      });
    }

    const pkg = await ctx.runQuery(internal.packages._getPackageBySlug, {
      slug,
    });

    if (!isPublicPackage(pkg)) {
      return new Response(`# Not Found\n\nComponent "${slug}" not found.`, {
        status: 404,
        headers: llmsTxtHeaders(),
      });
    }

    const lines: string[] = [];
    const name = pkg.componentName || pkg.name || "Unknown";
    const desc = pkg.seoValueProp || pkg.shortDescription || pkg.description || "";
    const catLabel = pkg.category ? CATEGORY_LABELS[pkg.category] || pkg.category : "general";

    lines.push(`# ${name}`);
    lines.push(`# ${desc}`);
    lines.push(`# Category: ${catLabel}`);
    if (hasPublicSkill(pkg)) {
      const skillUrl = buildComponentUrls(slug, DIRECTORY_ORIGIN).skillUrl;
      lines.push(
        `# Agents: fetch the skill at ${skillUrl} before writing code that uses ${name}. It contains setup steps, configuration, and usage patterns.`,
      );
    }
    lines.push("");

    lines.push("## Install");
    lines.push(`- Command: ${pkg.installCommand || `npm install ${pkg.name}`}`);
    lines.push("");

    lines.push("## Links");
    const componentLinks = buildComponentUrls(slug, DIRECTORY_ORIGIN);
    lines.push(`- Directory: ${componentLinks.detailUrl}`);
    lines.push(`- Markdown: ${componentLinks.markdownUrl}`);
    lines.push(`- llms.txt: ${componentLinks.llmsUrl}`);
    if (hasPublicSkill(pkg)) {
      lines.push(`- Skill: ${componentLinks.skillUrl}`);
    }
    lines.push(`- npm: ${pkg.npmUrl || ""}`);
    if (pkg.repositoryUrl) lines.push(`- ${repoHostLabel(pkg.repositoryUrl)}: ${pkg.repositoryUrl}`);
    if (pkg.demoUrl) lines.push(`- Demo: ${pkg.demoUrl}`);
    lines.push("");

    lines.push("## Details");
    lines.push(`- Version: ${pkg.version || "0.0.0"}`);
    lines.push(`- Weekly downloads: ${(pkg.weeklyDownloads || 0).toLocaleString()}`);
    if (pkg.authorUsername) lines.push(`- Author: ${pkg.authorUsername}`);
    if (pkg.tags && pkg.tags.length > 0) lines.push(`- Tags: ${pkg.tags.join(", ")}`);
    lines.push("");

    // Prefer v2 content model for llms output
    if (pkg.contentModelVersion === 2 && pkg.generatedDescription) {
      lines.push("## Description");
      lines.push(pkg.generatedDescription);
      lines.push("");

      if (pkg.generatedUseCases) {
        lines.push("## Use Cases");
        lines.push(normalizeMarkdown(pkg.generatedUseCases));
        lines.push("");
      }

      if (pkg.generatedHowItWorks) {
        lines.push("## How It Works");
        lines.push(normalizeMarkdown(pkg.generatedHowItWorks));
        lines.push("");
      }
    } else {
      // Fallback: old SEO model
      if (pkg.seoBenefits && pkg.seoBenefits.length > 0) {
        lines.push("## Benefits");
        for (const benefit of pkg.seoBenefits) {
          lines.push(`- ${benefit}`);
        }
        lines.push("");
      }

      if (pkg.seoUseCases && pkg.seoUseCases.length > 0) {
        lines.push("## Use Cases");
        for (const uc of pkg.seoUseCases) {
          lines.push(`- Q: ${uc.query}`);
          lines.push(`  A: ${uc.answer}`);
        }
        lines.push("");
      }

      if (pkg.seoFaq && pkg.seoFaq.length > 0) {
        lines.push("## FAQ");
        for (const faq of pkg.seoFaq) {
          lines.push(`- Q: ${faq.question}`);
          lines.push(`  A: ${faq.answer}`);
        }
        lines.push("");
      }

    }

    return new Response(lines.join("\n"), {
      status: 200,
      headers: llmsTxtHeaders(),
    });
  }),
});

function llmsTxtHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=300",
    "Access-Control-Allow-Origin": "*",
  };
}

// ============ BADGE SERVICE ============
http.route({
  path: "/api/badge",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug") || "";

    if (!slug) {
      return new Response(generateBadgeSvg("unknown", "Not Found", BADGE_COLORS.not_found), {
        status: 200,
        headers: svgHeaders(),
      });
    }

    const pkg = await ctx.runQuery(internal.packages._getPackageBySlug, {
      slug,
    });

    let statusLabel = "Not Found";
    let statusColor: string = BADGE_COLORS.not_found;

    if (pkg) {
      if (pkg.reviewStatus === "approved") {
        statusLabel = "Approved";
        statusColor = BADGE_COLORS.approved;
      } else if (pkg.reviewStatus === "in_review") {
        statusLabel = "In Review";
        statusColor = BADGE_COLORS.in_review;
      } else if (pkg.reviewStatus === "changes_requested") {
        statusLabel = "Changes Requested";
        statusColor = BADGE_COLORS.changes_requested;
      } else if (pkg.reviewStatus === "rejected") {
        statusLabel = "Rejected";
        statusColor = BADGE_COLORS.rejected;
      } else {
        statusLabel = "Pending";
        statusColor = BADGE_COLORS.pending;
      }
    }

    const displayName = pkg?.name || slug;

    await ctx.runMutation(internal.packages._recordBadgeFetch, {
      slug,
      packageId: pkg?._id,
      referrer: request.headers.get("referer") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return new Response(generateBadgeSvg(displayName, statusLabel, statusColor), {
      status: 200,
      headers: svgHeaders(),
    });
  }),
});

function generateBadgeSvg(name: string, status: string, statusColor: string): string {
  return renderBadge({
    label: "Convex",
    message: `${status}: ${name}`,
    color: statusColor,
  });
}

function svgHeaders(): Record<string, string> {
  return {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=300, s-maxage=300",
    "Access-Control-Allow-Origin": "*",
  };
}

// CORS preflight handler for content endpoints
function contentOptionsHandler() {
  return httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
        "Access-Control-Max-Age": "86400",
      },
    });
  });
}

http.route({
  path: "/api/badge",
  method: "OPTIONS",
  handler: contentOptionsHandler(),
});

http.route({
  path: "/api/markdown",
  method: "OPTIONS",
  handler: contentOptionsHandler(),
});

http.route({
  path: "/api/skill",
  method: "OPTIONS",
  handler: contentOptionsHandler(),
});

http.route({
  path: "/api/markdown-index",
  method: "OPTIONS",
  handler: contentOptionsHandler(),
});

http.route({
  path: "/api/component-llms",
  method: "OPTIONS",
  handler: contentOptionsHandler(),
});

http.route({
  path: "/api/llms.txt",
  method: "OPTIONS",
  handler: contentOptionsHandler(),
});

http.route({
  path: "/api/export-csv",
  method: "OPTIONS",
  handler: contentOptionsHandler(),
});

http.route({
  path: "/api/sitemap.xml",
  method: "OPTIONS",
  handler: contentOptionsHandler(),
});

// ============ MCP API ENDPOINTS ============
// Read-only MCP tools for agent and CLI consumption

function mcpJsonHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60, s-maxage=60",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version",
  };
}

function buildMcpProfile(pkg: any): any {
  const slug = pkg.slug || "";
  const componentLinks = slug
    ? buildComponentUrls(slug, DIRECTORY_ORIGIN)
    : null;

  return {
    slug,
    displayName: pkg.componentName || pkg.name,
    packageName: pkg.name,
    description: pkg.longDescription || pkg.description || "",
    shortDescription: pkg.shortDescription,
    category: pkg.category,
    tags: pkg.tags || [],
    install: {
      command: pkg.installCommand || `npm install ${pkg.name}`,
      packageManager: detectPackageManager(pkg.installCommand || ""),
    },
    docs: {
      markdownUrl: componentLinks?.markdownUrl || "",
      llmsUrl: componentLinks?.llmsUrl || "",
      detailUrl: componentLinks?.detailUrl || "",
    },
    links: {
      npm: pkg.npmUrl,
      repository: pkg.repositoryUrl,
      demo: pkg.demoUrl,
      video: pkg.videoUrl,
    },
    metadata: {
      version: pkg.version || "0.0.0",
      weeklyDownloads: pkg.weeklyDownloads || 0,
      lastPublish: pkg.lastPublish,
      authorUsername: pkg.authorUsername,
    },
    trustSignals: {
      convexVerified: pkg.convexVerified || false,
      hasSkillMd: Boolean(pkg.skillMd),
      hasSeoContent: pkg.seoGenerationStatus === "completed",
      lastUpdated: pkg.lastPublish
        ? new Date(pkg.lastPublish).getTime()
        : undefined,
    },
  };
}

function detectPackageManager(command: string): "npm" | "yarn" | "pnpm" | "bun" {
  if (command.startsWith("yarn ")) return "yarn";
  if (command.startsWith("pnpm ")) return "pnpm";
  if (command.startsWith("bun ")) return "bun";
  return "npm";
}

// ============ REST API ENDPOINTS ============
// Authenticated JSON API for agents, CLI tools, and developers
// Uses API keys from the apiKeys table, with anonymous fallback at lower rate limits

function apiJsonHeaders(
  rl?: ApiCallerResult["rateLimit"],
): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60, s-maxage=60",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Accept, Authorization",
    ...(rl ? rateLimitHeaders(rl) : {}),
  };
}

function apiOptionsHandler() {
  return httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: apiJsonHeaders(),
    });
  });
}

// Shared helper: check global toggle, auth, rate limit. Returns 503 if API is off.
async function enforceRateLimit(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  request: Request,
): Promise<
  | { caller: ApiCallerResult; response?: undefined }
  | { caller: ApiCallerResult; response: Response }
> {
  // Check global API toggle
  const apiEnabled = await ctx.runQuery(internal.apiKeys._isApiEnabled);
  if (!apiEnabled) {
    const caller = await resolveApiCaller(ctx, request);
    return {
      caller,
      response: new Response(
        JSON.stringify({
          error: "The Components API is currently unavailable.",
        }),
        { status: 503, headers: apiJsonHeaders() },
      ),
    };
  }

  const caller = await resolveApiCaller(ctx, request);

  if (!caller.rateLimit.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((caller.rateLimit.resetAt - Date.now()) / 1000),
    );
    return {
      caller,
      response: new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please try again later.",
          retryAfterSeconds: retryAfter,
          remaining: 0,
        }),
        {
          status: 429,
          headers: {
            ...apiJsonHeaders(caller.rateLimit),
            "Retry-After": String(retryAfter),
          },
        },
      ),
    };
  }

  return { caller };
}

async function logApiRequest(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  request: Request,
  caller: ApiCallerResult,
  endpoint: string,
  status: number,
  startTime: number,
  slug?: string,
  searchQuery?: string,
) {
  await ctx.runMutation(internal.packages._recordMcpApiRequest, {
    endpoint,
    slug,
    query: searchQuery,
    userAgent: request.headers.get("user-agent") || undefined,
    referer: request.headers.get("referer") || undefined,
    responseStatus: status,
    responseTimeMs: Date.now() - startTime,
    apiKeyId: caller.apiKeyId,
    hashedIp: caller.hashedIp,
  });
}

// REST API: Search components
http.route({
  path: "/api/components/search",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    const result = await enforceRateLimit(ctx, request);
    if (result.response) return result.response;
    const { caller } = result;

    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const category = url.searchParams.get("category") || "";
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "20", 10),
      50,
    );
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    // Use search indexes instead of loading all packages and filtering in JS
    const { results, total } = await ctx.runQuery(
      internal.packages._searchApprovedPackages,
      {
        searchTerm: query,
        category: category || undefined,
        limit,
        offset,
      },
    );

    await logApiRequest(ctx, request, caller, "search", 200, startTime, undefined, query || undefined);

    return new Response(
      JSON.stringify({
        results,
        pagination: { total, limit, offset, hasMore: offset + limit < total },
      }),
      { status: 200, headers: apiJsonHeaders(caller.rateLimit) },
    );
  }),
});

http.route({
  path: "/api/components/search",
  method: "OPTIONS",
  handler: apiOptionsHandler(),
});

// REST API: Get single component profile
http.route({
  path: "/api/components/detail",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    const result = await enforceRateLimit(ctx, request);
    if (result.response) return result.response;
    const { caller } = result;

    const url = new URL(request.url);
    const slug = url.searchParams.get("slug") || "";

    if (!slug) {
      await logApiRequest(ctx, request, caller, "detail", 400, startTime);
      return new Response(
        JSON.stringify({ error: "Missing slug parameter" }),
        { status: 400, headers: apiJsonHeaders(caller.rateLimit) },
      );
    }

    const pkg = await ctx.runQuery(internal.packages._getPackageBySlug, {
      slug,
    });

    if (!isPublicPackage(pkg)) {
      await logApiRequest(ctx, request, caller, "detail", 404, startTime, slug);
      return new Response(
        JSON.stringify({ error: "Component not found" }),
        { status: 404, headers: apiJsonHeaders(caller.rateLimit) },
      );
    }

    await logApiRequest(ctx, request, caller, "detail", 200, startTime, slug);

    return new Response(
      JSON.stringify({ component: buildMcpProfile(pkg) }),
      { status: 200, headers: apiJsonHeaders(caller.rateLimit) },
    );
  }),
});

http.route({
  path: "/api/components/detail",
  method: "OPTIONS",
  handler: apiOptionsHandler(),
});

// REST API: Get install command
http.route({
  path: "/api/components/install",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    const result = await enforceRateLimit(ctx, request);
    if (result.response) return result.response;
    const { caller } = result;

    const url = new URL(request.url);
    const slug = url.searchParams.get("slug") || "";

    if (!slug) {
      await logApiRequest(ctx, request, caller, "install", 400, startTime);
      return new Response(
        JSON.stringify({ error: "Missing slug parameter" }),
        { status: 400, headers: apiJsonHeaders(caller.rateLimit) },
      );
    }

    const pkg = await ctx.runQuery(internal.packages._getPackageBySlug, {
      slug,
    });

    if (!isPublicPackage(pkg)) {
      await logApiRequest(ctx, request, caller, "install", 404, startTime, slug);
      return new Response(
        JSON.stringify({ error: "Component not found" }),
        { status: 404, headers: apiJsonHeaders(caller.rateLimit) },
      );
    }

    const command = pkg.installCommand || `npm install ${pkg.name}`;

    await logApiRequest(ctx, request, caller, "install", 200, startTime, slug);

    return new Response(
      JSON.stringify({
        slug,
        packageName: pkg.name,
        installCommand: command,
        packageManager: detectPackageManager(command),
      }),
      { status: 200, headers: apiJsonHeaders(caller.rateLimit) },
    );
  }),
});

http.route({
  path: "/api/components/install",
  method: "OPTIONS",
  handler: apiOptionsHandler(),
});

// REST API: Get component docs URLs
http.route({
  path: "/api/components/docs",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    const result = await enforceRateLimit(ctx, request);
    if (result.response) return result.response;
    const { caller } = result;

    const url = new URL(request.url);
    const slug = url.searchParams.get("slug") || "";

    if (!slug) {
      await logApiRequest(ctx, request, caller, "docs", 400, startTime);
      return new Response(
        JSON.stringify({ error: "Missing slug parameter" }),
        { status: 400, headers: apiJsonHeaders(caller.rateLimit) },
      );
    }

    const pkg = await ctx.runQuery(internal.packages._getPackageBySlug, {
      slug,
    });

    if (!isPublicPackage(pkg)) {
      await logApiRequest(ctx, request, caller, "docs", 404, startTime, slug);
      return new Response(
        JSON.stringify({ error: "Component not found" }),
        { status: 404, headers: apiJsonHeaders(caller.rateLimit) },
      );
    }

    const componentLinks = buildComponentUrls(slug, DIRECTORY_ORIGIN);

    await logApiRequest(ctx, request, caller, "docs", 200, startTime, slug);

    return new Response(
      JSON.stringify({
        slug,
        displayName: pkg.componentName || pkg.name,
        docs: {
          markdownUrl: componentLinks.markdownUrl,
          llmsUrl: componentLinks.llmsUrl,
          detailUrl: componentLinks.detailUrl,
        },
        links: {
          npm: pkg.npmUrl,
          repository: pkg.repositoryUrl,
          demo: pkg.demoUrl,
        },
      }),
      { status: 200, headers: apiJsonHeaders(caller.rateLimit) },
    );
  }),
});

http.route({
  path: "/api/components/docs",
  method: "OPTIONS",
  handler: apiOptionsHandler(),
});

// REST API: List categories
http.route({
  path: "/api/components/categories",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    const result = await enforceRateLimit(ctx, request);
    if (result.response) return result.response;
    const { caller } = result;

    const packages = await ctx.runQuery(
      internal.packages._listApprovedPackages,
    );
    const categoryCounts: Record<string, number> = {};
    for (const pkg of packages) {
      const cat = (pkg as any).category || "general";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    const categories = Object.entries(CATEGORY_LABELS).map(
      ([slug, label]) => ({
        slug,
        label,
        componentCount: categoryCounts[slug] || 0,
      }),
    );

    await logApiRequest(ctx, request, caller, "categories", 200, startTime);

    return new Response(JSON.stringify({ categories }), {
      status: 200,
      headers: apiJsonHeaders(caller.rateLimit),
    });
  }),
});

http.route({
  path: "/api/components/categories",
  method: "OPTIONS",
  handler: apiOptionsHandler(),
});

// REST API: Server info and endpoint directory
http.route({
  path: "/api/components/info",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const startTime = Date.now();
    const result = await enforceRateLimit(ctx, request);
    if (result.response) return result.response;
    const { caller } = result;

    await logApiRequest(ctx, request, caller, "info", 200, startTime);

    return new Response(
      JSON.stringify({
        name: "convex-components-api",
        version: "1.0.0",
        description:
          "REST API for the Convex Components Directory. Search, browse, and get install commands for approved Convex components.",
        baseUrl: DIRECTORY_ORIGIN,
        endpoints: {
          search: `${DIRECTORY_ORIGIN}/api/components/search`,
          detail: `${DIRECTORY_ORIGIN}/api/components/detail`,
          install: `${DIRECTORY_ORIGIN}/api/components/install`,
          docs: `${DIRECTORY_ORIGIN}/api/components/docs`,
          categories: `${DIRECTORY_ORIGIN}/api/components/categories`,
          info: `${DIRECTORY_ORIGIN}/api/components/info`,
        },
        contentEndpoints: {
          llmsTxt: `${DIRECTORY_ORIGIN}/components/llms.txt`,
          markdownIndex: `${DIRECTORY_ORIGIN}/components.md`,
        },
        authentication: {
          type: "bearer",
          header: "Authorization: Bearer YOUR_API_KEY",
          description:
            "Generate an API key from your profile page at /components/profile. Anonymous access is allowed at lower rate limits.",
        },
        rateLimits: {
          authenticated: "100 requests/minute",
          anonymous: "10 requests/minute",
        },
      }),
      { status: 200, headers: apiJsonHeaders(caller.rateLimit) },
    );
  }),
});

http.route({
  path: "/api/components/info",
  method: "OPTIONS",
  handler: apiOptionsHandler(),
});

// ============ PUBLIC PREFLIGHT CHECK ENDPOINT ============
// Allows developers to test their repo against component review criteria before submission
// Rate limited by hashed IP, results cached for 30 minutes. Signed in users get
// 10 per hour (admins unlimited); signed out guests get the stricter guest path.

function preflightJsonHeaders(request?: Request): Record<string, string> {
  // Get the origin from the request, or default to allow all
  const origin = request?.headers.get("Origin") || "*";
  
  // For localhost development or production, allow the specific origin
  const allowedOrigin = origin.includes("localhost") || origin.includes("convex.dev") || origin.includes("netlify.app")
    ? origin
    : "*";

  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

// Helper to extract IP from request headers (Convex/Cloudflare headers)
function getClientIp(request: Request): string {
  // Try Cloudflare headers first
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  // Try X-Forwarded-For (take first IP if comma-separated)
  const xffHeader = request.headers.get("x-forwarded-for");
  if (xffHeader) {
    const firstIp = xffHeader.split(",")[0].trim();
    if (firstIp) return firstIp;
  }

  // Try X-Real-IP
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  // Fallback: use a hash of user-agent + timestamp (not ideal but allows testing)
  const userAgent = request.headers.get("user-agent") || "unknown";
  return `ua-fallback-${userAgent.slice(0, 50)}`;
}

// Prefer the platform-provided client IP. Forwarding headers can be set by any
// caller, so they are only a fallback for backends without request metadata.
async function resolveClientIp(ctx: ActionCtx, request: Request): Promise<string> {
  try {
    const { ip } = await ctx.meta.getRequestMetadata();
    if (ip) return ip;
  } catch {
    // Fall through to headers
  }
  return getClientIp(request);
}

// Guest runs must come from the directory site (or local/preview builds).
// Origin is spoofable outside browsers; the per IP and global caps are the real bound.
function isAllowedGuestOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === "convex.dev" ||
      hostname.endsWith(".convex.dev") ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".netlify.app")
    );
  } catch {
    return false;
  }
}

const GUEST_MAX_REPO_URL_LENGTH = 500;
const GUEST_MAX_NPM_URL_LENGTH = 300;

function formatRetryWindow(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

// Run the AI check and store the outcome. On a thrown error the pending row is
// marked as an error so it never blocks that IP's in-flight gate.
// A URL problem (missing repo, branch, folder, or several components) stops
// before any AI call: signed-in rows are refunded, guest rows keep counting so
// bad URLs can't be used to burn the GitHub token.
async function runAndStorePreflight(
  ctx: ActionCtx,
  checkId: Id<"preflightChecks">,
  repoUrl: string,
  npmUrl: string | undefined,
  isGuest: boolean
) {
  try {
    const result = await ctx.runAction(internal.aiReview.runPreflightCheck, {
      repoUrl,
      packageName: npmUrl ? extractPackageNameFromNpmUrl(npmUrl) : undefined,
    });
    if (result.problem && !isGuest) {
      await ctx.runMutation(internal.preflight._deletePreflightCheck, { checkId });
      return result;
    }
    await ctx.runMutation(internal.preflight._updatePreflightCheck, {
      checkId,
      status: result.problem ? "error" : result.status,
      summary: result.problem ? result.problem.message : result.summary,
      criteria: result.problem ? undefined : result.criteria,
      reviewedPath: result.reviewedPath,
      reviewedRef: result.reviewedRef,
      suggestedRepoUrl: result.suggestedRepoUrl,
    });
    return result;
  } catch (error) {
    await ctx.runMutation(internal.preflight._updatePreflightCheck, {
      checkId,
      status: "error",
      summary: "Preflight check failed before completing",
    });
    throw error;
  }
}

// Signed out preflight run: origin, honeypot, and input checks here, then one
// transactional reservation that applies the kill switch, cache, and limits.
async function handleGuestPreflight(
  ctx: ActionCtx,
  request: Request,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const json = (status: number, body: Record<string, unknown>, extra?: Record<string, string>) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, ...extra } });

  if (!isAllowedGuestOrigin(request.headers.get("Origin"))) {
    return json(403, {
      error: "Sign in to use the preflight checker from this client.",
      requiresSignIn: true,
    });
  }

  const raw: unknown = await request.json().catch(() => null);
  if (typeof raw !== "object" || raw === null) {
    return json(400, { error: "Invalid request body" });
  }
  const body = raw as Record<string, unknown>;

  // Honeypot: the hidden "website" field is empty for real visitors
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return json(400, { error: "Invalid request" });
  }

  const repoUrl = typeof body.repoUrl === "string" ? body.repoUrl.trim() : "";
  const npmUrl =
    typeof body.npmUrl === "string" && body.npmUrl.trim() !== "" ? body.npmUrl.trim() : undefined;

  if (!repoUrl) {
    return json(400, { error: "Missing repoUrl parameter" });
  }
  if (
    repoUrl.length > GUEST_MAX_REPO_URL_LENGTH ||
    (npmUrl !== undefined && npmUrl.length > GUEST_MAX_NPM_URL_LENGTH) ||
    !isSupportedRepoUrl(repoUrl)
  ) {
    return json(400, {
      error:
        "Invalid repository URL. Expected https://github.com/owner/repo or https://gitlab.com/owner/repo",
    });
  }

  const { hashIp, preflightCacheKey, GUEST_MAX_CHECKS_PER_HOUR, SIGNED_IN_MAX_CHECKS_PER_HOUR } =
    await import("./preflight");
  const hashedIp = await hashIp(await resolveClientIp(ctx, request));

  const reservation = await ctx.runMutation(internal.preflight._reserveGuestCheck, {
    hashedIp,
    normalizedRepoUrl: preflightCacheKey(repoUrl),
  });

  if (reservation.kind === "cached") {
    return json(200, { ...reservation.result, cached: true, guest: true });
  }

  if (reservation.kind === "denied") {
    const retryAfter = reservation.retryAfterSeconds;
    const retryHeaders = retryAfter ? { "Retry-After": String(retryAfter) } : undefined;
    switch (reservation.reason) {
      case "disabled":
        return json(403, {
          error: "Guest checks are paused right now. Sign in to run the preflight check.",
          requiresSignIn: true,
        });
      case "in_flight":
        return json(429, {
          error: "A preflight check is already running from your network. Wait for it to finish.",
        });
      case "ip_limit":
        return json(
          429,
          {
            error: `Guest limit reached (${GUEST_MAX_CHECKS_PER_HOUR} checks per hour). Sign in for ${SIGNED_IN_MAX_CHECKS_PER_HOUR} per hour, or try again in ${formatRetryWindow(retryAfter ?? 3600)}.`,
            requiresSignIn: true,
            retryAfterSeconds: retryAfter,
            remaining: 0,
          },
          retryHeaders
        );
      case "global_limit":
        return json(
          429,
          {
            error: `Guest checks are at capacity. Sign in to run it now, or try again in ${formatRetryWindow(retryAfter ?? 3600)}.`,
            requiresSignIn: true,
            retryAfterSeconds: retryAfter,
          },
          retryHeaders
        );
    }
  }

  const result = await runAndStorePreflight(ctx, reservation.checkId, repoUrl, npmUrl, true);
  if (result.problem) {
    return json(422, {
      ...preflightProblemBody(result.problem),
      guest: true,
      remaining: reservation.remaining,
    });
  }
  return json(200, {
    status: result.status,
    summary: result.summary,
    criteria: result.criteria,
    reviewedPath: result.reviewedPath,
    reviewedRef: result.reviewedRef,
    suggestedRepoUrl: result.suggestedRepoUrl,
    cached: false,
    guest: true,
    remaining: reservation.remaining,
  });
}

// 422 body for a URL the locator could not resolve to one component
function preflightProblemBody(problem: {
  code: string;
  message: string;
  suggestions: Array<{ label: string; url: string }>;
}) {
  return {
    error: problem.message,
    code: problem.code,
    suggestions: problem.suggestions,
    status: "error",
  };
}

// ============ DIRECTORY PAGE BOOTSTRAP ============
// Everything the directory and category pages need in one plain GET.
// index.html starts this request while the JS bundle downloads. A simple GET
// skips the CORS preflight that /api/query POSTs need, and one request beats
// five, which matters a lot far from the deployment (Australia pays ~330ms per
// round trip). Keep the response shape in sync with src/lib/convexHttp.ts.
http.route({
  path: "/api/directory-page",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const params = new URL(request.url).searchParams;
    const sortBy = params.get("sortBy") ?? "downloads";
    const category = params.get("category") || undefined;
    if (!DIRECTORY_SORTS.includes(sortBy as DirectorySort)) {
      return new Response("Invalid sortBy", { status: 400 });
    }

    const data = await ctx.runQuery(
      internal.directoryPage._getDirectoryPageData,
      { sortBy: sortBy as DirectorySort, category },
    );
    return new Response(JSON.stringify(convexToJson(data as Value)), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    });
  }),
});

http.route({
  path: "/api/preflight",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const corsHeaders = preflightJsonHeaders(request);
    try {
      // Signed out visitors take the guest path with stricter safeguards
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return await handleGuestPreflight(ctx, request, corsHeaders);
      }

      // Admins (@convex.dev emails) bypass rate limiting and caching for unlimited fresh runs
      const isAdmin = identity.email?.endsWith("@convex.dev") ?? false;

      const body = (await request.json()) as { repoUrl?: string; npmUrl?: string };

      if (!body.repoUrl) {
        return new Response(
          JSON.stringify({ error: "Missing repoUrl parameter" }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Validate URL format (GitHub or GitLab)
      if (!isSupportedRepoUrl(body.repoUrl)) {
        return new Response(
          JSON.stringify({
            error:
              "Invalid repository URL. Expected https://github.com/owner/repo or https://gitlab.com/owner/repo",
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Hash the client IP for rate limiting
      const clientIp = await resolveClientIp(ctx, request);
      const { hashIp, preflightCacheKey } = await import("./preflight");
      const hashedIp = await hashIp(clientIp);
      const normalizedUrl = preflightCacheKey(body.repoUrl);

      // Check rate limit
      const rateLimitCheck = await ctx.runQuery(internal.preflight._checkRateLimit, {
        hashedIp,
        now: Date.now(),
      });

      if (!isAdmin && !rateLimitCheck.allowed) {
        const retryAfter = rateLimitCheck.resetAt
          ? Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000)
          : 3600;

        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again later.",
            retryAfterSeconds: retryAfter,
            remaining: 0,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Retry-After": String(retryAfter),
            },
          }
        );
      }

      // Check for in-flight request from same IP (admins skip this gate)
      const hasInFlight = isAdmin
        ? false
        : await ctx.runQuery(internal.preflight._hasInFlightCheck, {
            hashedIp,
            now: Date.now(),
          });

      if (hasInFlight) {
        return new Response(
          JSON.stringify({
            error: "A preflight check is already in progress. Please wait for it to complete.",
          }),
          { status: 429, headers: corsHeaders }
        );
      }

      // Check for cached result (admins always get a fresh run)
      const cachedResult = isAdmin
        ? null
        : await ctx.runQuery(internal.preflight._getCachedResult, {
            normalizedRepoUrl: normalizedUrl,
            now: Date.now(),
          });

      if (cachedResult) {
        return new Response(
          JSON.stringify({
            status: cachedResult.status,
            summary: cachedResult.summary,
            criteria: cachedResult.criteria,
            reviewedPath: cachedResult.reviewedPath,
            reviewedRef: cachedResult.reviewedRef,
            suggestedRepoUrl: cachedResult.suggestedRepoUrl,
            cached: true,
            cachedAt: cachedResult.cachedAt,
            expiresAt: cachedResult.expiresAt,
            remaining: rateLimitCheck.remaining,
          }),
          { status: 200, headers: corsHeaders }
        );
      }

      // Create a pending check record
      const checkId = await ctx.runMutation(internal.preflight._createPreflightCheck, {
        normalizedRepoUrl: normalizedUrl,
        hashedIp,
      });

      // Run the actual preflight check and store the result
      const result = await runAndStorePreflight(ctx, checkId, body.repoUrl, body.npmUrl, false);

      // URL problems are refunded, so the remaining count is unchanged
      if (result.problem) {
        return new Response(
          JSON.stringify({
            ...preflightProblemBody(result.problem),
            remaining: isAdmin ? undefined : rateLimitCheck.remaining,
          }),
          { status: 422, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          status: result.status,
          summary: result.summary,
          criteria: result.criteria,
          reviewedPath: result.reviewedPath,
          reviewedRef: result.reviewedRef,
          suggestedRepoUrl: result.suggestedRepoUrl,
          cached: false,
          // Admins have no limit, so omit the remaining count
          remaining: isAdmin ? undefined : rateLimitCheck.remaining - 1,
        }),
        { status: 200, headers: corsHeaders }
      );
    } catch (error) {
      console.error("Preflight check error:", error);
      return new Response(
        JSON.stringify({
          error: "An error occurred during the preflight check",
          status: "error",
        }),
        { status: 500, headers: corsHeaders }
      );
    }
  }),
});

// Helper to extract package name from npm URL
function extractPackageNameFromNpmUrl(npmUrl: string): string | undefined {
  const match = npmUrl.match(/npmjs\.com\/package\/(@?[^/]+(?:\/[^/]+)?)/);
  return match ? match[1] : undefined;
}

// CORS preflight for preflight endpoint
http.route({
  path: "/api/preflight",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: preflightJsonHeaders(request) });
  }),
});

// ============ SITEMAP.XML ENDPOINT ============
http.route({
  path: "/api/sitemap.xml",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const packages = await ctx.runQuery(
      internal.packages._listApprovedPackages
    );

    const origin = DIRECTORY_ORIGIN;
    const today = new Date().toISOString().slice(0, 10);

    // /components/submissions is intentionally absent: the page is admin only
    // and noindexed (see netlify/edge-functions/og-meta.ts)
    const staticPages = [
      { loc: `${origin}/components`, changefreq: "daily", priority: "1.0" },
      {
        loc: `${origin}/components/submit`,
        changefreq: "monthly",
        priority: "0.5",
      },
    ];

    const urls: string[] = [];
    for (const page of staticPages) {
      urls.push(
        `  <url>\n    <loc>${page.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`
      );
    }

    const sorted = [...packages].sort((a: any, b: any) =>
      (a.name || "").localeCompare(b.name || "")
    );

    for (const pkg of sorted) {
      const slug = (pkg as any).slug;
      if (!slug) continue;
      const lastmod = (pkg as any).lastPublish
        ? new Date((pkg as any).lastPublish).toISOString().slice(0, 10)
        : today;
      urls.push(
        `  <url>\n    <loc>${origin}/components/${escapeXml(slug)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  }),
});

export default http;
