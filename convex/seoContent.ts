"use node";

// AI-generated SEO/AEO/GEO content for component detail pages.
// Uses configurable AI providers (Anthropic, OpenAI, Gemini) to generate structured content.
// Mutations live in seoContentDb.ts (mutations cannot be in "use node" files).

import { v, ConvexError } from "convex/values";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { buildProviderCandidates, executeWithProviderFallback } from "./aiProviderFallback";
import { requireAdminIdentity } from "./auth";
import {
  DEFAULT_SEO_PROMPT_TEMPLATE,
  DEFAULT_CONTENT_PROMPT_TEMPLATE,
} from "../shared/seoPromptTemplate";
import { buildSkillMdFromContent } from "../shared/buildSkillMd";
import { normalizeMarkdown } from "../shared/normalizeMarkdown";
import { stripUnsafeHtml } from "../shared/sanitizeMarkdown";
import { parseRepoUrl, repoHostLabel, type ParsedRepoUrl } from "../shared/repoUrl";
import { fetchGitLabFile } from "./gitlabApi";

// Helper to call AI provider with unified interface
async function callAiProvider(
  provider: "anthropic" | "openai" | "gemini",
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new ConvexError("No text content in Anthropic response");
    }
    return textBlock.text;
  }

  if (provider === "openai") {
    const client = new OpenAI({ apiKey });
    // GPT-5 family rejects `max_tokens` on Chat Completions and requires
    // `max_completion_tokens` (also accepted by gpt-4o and other current models).
    // Budget is generous so reasoning tokens don't starve the visible output.
    const response = await client.chat.completions.create({
      model,
      max_completion_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new ConvexError("No content in OpenAI response");
    }
    return content;
  }

  if (provider === "gemini") {
    // Google Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2000 },
        }),
      }
    );
    if (!response.ok) {
      throw new ConvexError(`Gemini API error: ${response.statusText}`);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new ConvexError("No text content in Gemini response");
    }
    return text;
  }

  throw new ConvexError<string>(`Unknown provider: ${provider}`);
}

// ============ SEO CONTENT GENERATION ============

// Structured output shape from Claude
interface SeoContentResponse {
  valueProp: string;
  benefits: string[];
  useCases: { query: string; answer: string }[];
  faq: { question: string; answer: string }[];
  resourceLinks: { label: string; url: string }[];
}

type GitHubReadmeResult = {
  content: string;
  rawContent: string;
  fullContent: string;
  // Unsanitized README text. Include-marker extraction must run on this,
  // because sanitizeReadme strips HTML comments (including the markers).
  rawFullContent: string;
  sourceLabel: string;
};

const README_PROMPT_CHAR_LIMIT = 12000;
const CONVEX_DOCS_CONTEXT_CHAR_LIMIT = 4000;
const GITHUB_API_BASE_URL = "https://api.github.com";
const CONVEX_DOCS_URL = "https://docs.convex.dev/";
const CONVEX_LLMSTXT_URL = "https://docs.convex.dev/llms.txt";
const README_FILENAMES = ["README.md", "README.mdx", "readme.md", "README.txt"] as const;
const FALLBACK_CONVEX_DOC_LINKS = [
  "https://docs.convex.dev/components.md",
  "https://docs.convex.dev/components/authoring.md",
  "https://docs.convex.dev/components/using.md",
  "https://docs.convex.dev/functions.md",
  "https://docs.convex.dev/functions/actions.md",
  "https://docs.convex.dev/functions/validation.md",
  "https://docs.convex.dev/understanding/best-practices.md",
] as const;
const RELEVANT_DOC_PATH_HINTS = [
  "/components.md",
  "/components/authoring.md",
  "/components/using.md",
  "/functions.md",
  "/functions/actions.md",
  "/functions/validation.md",
  "/understanding/best-practices.md",
] as const;

function encodeGitHubPath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

// Clean README content (strip badges, HTML comments, images) without truncating
function sanitizeReadme(readme: string): string {
  return readme
    .replace(/\r/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .filter((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return true;
      }
      if (/^\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)$/.test(trimmed)) {
        return false;
      }
      if (index < 30 && /^!\[[^\]]*\]\([^)]+\)$/.test(trimmed)) {
        return false;
      }
      if (/^<img\b/i.test(trimmed) || /^<picture\b/i.test(trimmed)) {
        return false;
      }
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Sanitize and truncate README for AI prompt context
function sanitizeReadmeForPrompt(readme: string): string {
  const cleaned = sanitizeReadme(readme);
  if (!cleaned) return "";
  if (cleaned.length <= README_PROMPT_CHAR_LIMIT) return cleaned;
  return `${cleaned.slice(0, README_PROMPT_CHAR_LIMIT)}\n\n[README truncated for prompt length]`;
}

async function fetchTextWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = 5000
): Promise<string> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new ConvexError(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return await response.text();
}

function buildReadmeCandidates(dirPath: string): string[] {
  return README_FILENAMES.map((fileName) => (dirPath ? `${dirPath}/${fileName}` : fileName));
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

// Resolve which README paths to try for a repo URL (GitHub or GitLab).
// A /blob URL pointing at a README file is tried first, then its directory,
// then the repo root.
function parseReadmeTarget(
  repoUrl: string
): { parsed: ParsedRepoUrl; owner: string; repo: string; paths: string[]; ref?: string } | null {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    return null;
  }

  // Recover the exact blob file path (the shared parser only keeps its directory).
  let exactPath = "";
  try {
    const pathname = decodeURIComponent(new URL(repoUrl.replace(/^git\+/, "")).pathname);
    const blobMatch = pathname.match(/\/blob\/[^/]+\/(.+?)\/?$/);
    if (blobMatch) exactPath = blobMatch[1];
  } catch {
    // Non URL inputs already parsed above via the ssh/git+ normalizer.
  }

  return {
    parsed,
    owner: parsed.owner,
    repo: parsed.repo,
    ref: parsed.ref,
    paths: dedupeStrings([
      /readme\./i.test(exactPath) ? exactPath : "",
      ...buildReadmeCandidates(parsed.dir),
      ...buildReadmeCandidates(""),
    ]),
  };
}

function buildReadmeResult(path: string, rawText: string): GitHubReadmeResult | null {
  const full = sanitizeReadme(rawText);
  const forPrompt = sanitizeReadmeForPrompt(rawText);
  if (!full) return null;
  return {
    content: `From the ${path}\n\n${forPrompt}`,
    rawContent: forPrompt,
    fullContent: full,
    rawFullContent: rawText,
    sourceLabel: path,
  };
}

// Fetch the README from GitHub or GitLab. The GitHub branch is unchanged.
async function fetchRepoReadme(
  repoUrl?: string,
  githubToken?: string
): Promise<GitHubReadmeResult | null> {
  if (!repoUrl) {
    return null;
  }

  const target = parseReadmeTarget(repoUrl);
  if (!target) {
    return null;
  }

  if (target.parsed.provider === "gitlab") {
    for (const path of target.paths) {
      try {
        const rawText = await fetchGitLabFile(target.parsed, path, target.ref ?? "HEAD");
        if (rawText === null) continue;
        const result = buildReadmeResult(path, rawText);
        if (result) return result;
      } catch {
        continue;
      }
    }
    return null;
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ConvexComponentsDirectory",
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  for (const path of target.paths) {
    const refQuery = target.ref ? `?ref=${encodeURIComponent(target.ref)}` : "";
    const contentsUrl = `${GITHUB_API_BASE_URL}/repos/${target.owner}/${target.repo}/contents/${encodeGitHubPath(path)}${refQuery}`;

    try {
      const response = await fetch(contentsUrl, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      if (data.type !== "file" || !data.download_url) {
        continue;
      }

      const rawText = await fetchTextWithTimeout(data.download_url, { headers }, 5000);
      const result = buildReadmeResult(path, rawText);
      if (result) {
        return result;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function buildFallbackConvexDocsContext(): string {
  return [
    `Canonical docs site: ${CONVEX_DOCS_URL}`,
    `Machine-readable docs index: ${CONVEX_LLMSTXT_URL}`,
    "Docs site check: unavailable, using fallback canonical links.",
    "Relevant Convex docs links:",
    ...FALLBACK_CONVEX_DOC_LINKS.map((url) => `- ${url}`),
  ].join("\n");
}

function extractRelevantConvexDocLines(llmsText: string): string[] {
  const lines = llmsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ["));

  const matched = lines.filter((line) =>
    RELEVANT_DOC_PATH_HINTS.some((pathHint) => line.includes(pathHint))
  );

  return matched.slice(0, 8);
}

async function fetchConvexDocsContext(): Promise<string> {
  try {
    const [llmsText, docsSiteResponse] = await Promise.all([
      fetchTextWithTimeout(CONVEX_LLMSTXT_URL, undefined, 5000),
      fetch(CONVEX_DOCS_URL, { signal: AbortSignal.timeout(5000) }),
    ]);
    const relevantLines = extractRelevantConvexDocLines(llmsText);
    const context = [
      `Canonical docs site: ${CONVEX_DOCS_URL}`,
      `Machine-readable docs index: ${CONVEX_LLMSTXT_URL}`,
      `Docs site check: ${docsSiteResponse.ok ? "reachable" : "unavailable"}`,
      "Relevant Convex docs links:",
      ...(relevantLines.length > 0
        ? relevantLines
        : FALLBACK_CONVEX_DOC_LINKS.map((url) => `- ${url}`)),
    ].join("\n");

    return context.length <= CONVEX_DOCS_CONTEXT_CHAR_LIMIT
      ? context
      : context.slice(0, CONVEX_DOCS_CONTEXT_CHAR_LIMIT);
  } catch {
    return buildFallbackConvexDocsContext();
  }
}

// Build trigger contexts for skill description (per Anthropic guidelines: make descriptions "pushy")
function buildTriggerContexts(
  category: string,
  tags: string[],
  seoContent: SeoContentResponse,
  displayName: string
): string {
  const contexts: string[] = [];

  // Add category as primary context
  if (category && category !== "general" && category !== "development") {
    contexts.push(category.replace(/-/g, " "));
  }

  // Add relevant tags (lowercase, deduplicated)
  const tagContexts = tags
    .slice(0, 4)
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t && t !== category);
  contexts.push(...tagContexts);

  // Extract trigger phrases from use case queries
  if (seoContent.useCases?.length > 0) {
    for (const uc of seoContent.useCases.slice(0, 2)) {
      const phrase = uc.query
        .toLowerCase()
        .replace(/^how (do i |to )?/i, "")
        .replace(/^what is (a |the )?/i, "")
        .replace(/\?$/, "")
        .trim();
      if (phrase && phrase.length > 3 && phrase.length < 50) {
        contexts.push(phrase);
      }
    }
  }

  // Deduplicate and limit
  const uniqueContexts = [...new Set(contexts)].slice(0, 6);

  if (uniqueContexts.length === 0) {
    return `Also trigger when the user asks about ${displayName} or related Convex component functionality.`;
  }

  return `Use this skill whenever the user mentions ${uniqueContexts.slice(0, 3).join(", ")}. Also trigger when discussing ${uniqueContexts.slice(3).join(", ") || "related functionality"}, even if they don't explicitly ask for ${displayName}.`;
}

// Build SKILL.md content following Anthropic Agent Skills spec
// Reference: https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md
function buildSkillMd(pkg: any, seoContent: SeoContentResponse): string {
  const displayName = pkg.componentName || pkg.name || "component";
  const kebabName = (pkg.name || displayName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const valueProp = seoContent.valueProp || pkg.shortDescription || pkg.description || "";
  const category = pkg.category || "development";
  const tags: string[] = pkg.tags || [];
  const repoUrl = pkg.repositoryUrl || "";
  const npmUrl = pkg.npmUrl || "";
  const installCmd = pkg.installCommand || `npm install ${pkg.name}`;
  const version = pkg.version || "";

  // Build "pushy" trigger contexts per Anthropic guidelines
  const triggerContexts = buildTriggerContexts(category, tags, seoContent, displayName);

  const lines: string[] = [];

  // YAML frontmatter with enhanced "pushy" description
  lines.push("---");
  lines.push(`name: ${kebabName}`);
  lines.push(`description: ${valueProp} ${triggerContexts}`);
  if (version) lines.push(`version: ${version}`);
  lines.push("---");
  lines.push("");

  // One-line agent instruction (matches shared/buildSkillMd.ts)
  lines.push(
    `> Agents: read this skill fully before writing code that uses ${displayName}. Follow the installation and configuration steps exactly.`,
  );
  lines.push("");

  // Main title
  lines.push(`# ${displayName}`);
  lines.push("");

  // Instructions section (imperative form per Anthropic guidelines)
  lines.push("## Instructions");
  lines.push("");
  lines.push(
    `Use ${displayName} to ${valueProp.toLowerCase().replace(/\.$/, "")}. This Convex component integrates directly with your backend.`
  );
  lines.push("");

  // Installation
  lines.push("### Installation");
  lines.push("");
  lines.push("```bash");
  lines.push(installCmd);
  lines.push("```");
  lines.push("");
  if (version && pkg.name) {
    lines.push(`Current npm version: \`${pkg.name}@${version}\``);
    lines.push("");
  }

  // Benefits/capabilities
  if (seoContent.benefits && seoContent.benefits.length > 0) {
    lines.push("### Capabilities");
    lines.push("");
    for (const benefit of seoContent.benefits) {
      lines.push(`- ${benefit}`);
    }
    lines.push("");
  }

  // Use cases as examples
  if (seoContent.useCases && seoContent.useCases.length > 0) {
    lines.push("## Examples");
    lines.push("");
    for (const uc of seoContent.useCases) {
      lines.push(`### ${uc.query}`);
      lines.push("");
      lines.push(uc.answer);
      lines.push("");
    }
  }

  // When NOT to use section (per Anthropic guidelines to prevent over-triggering)
  lines.push("## When NOT to use");
  lines.push("");
  lines.push("- When a simpler built-in solution exists for your specific use case");
  lines.push("- If you are not using Convex as your backend");
  lines.push(`- When the functionality provided by ${displayName} is not needed`);
  lines.push("");

  // FAQ as troubleshooting
  if (seoContent.faq && seoContent.faq.length > 0) {
    lines.push("## Troubleshooting");
    lines.push("");
    for (const faq of seoContent.faq) {
      lines.push(`**${faq.question}**`);
      lines.push("");
      lines.push(faq.answer);
      lines.push("");
    }
  }

  // Resources
  lines.push("## Resources");
  lines.push("");
  if (npmUrl) {
    lines.push(`- [npm package](${npmUrl})`);
  }
  if (repoUrl) {
    lines.push(`- [${repoHostLabel(repoUrl)} repository](${repoUrl})`);
  }
  if (pkg.demoUrl) {
    lines.push(`- [Live demo](${pkg.demoUrl})`);
  }
  if (pkg.slug) {
    lines.push(`- [Convex Components Directory](https://www.convex.dev/components/${pkg.slug})`);
  }
  lines.push("- [Convex documentation](https://docs.convex.dev)");

  return lines.join("\n");
}

// Internal action: Generate SEO content for a package using configured AI provider
async function fetchSeoContext(ctx: any, pkg: any) {
  const githubToken = process.env.GITHUB_TOKEN;
  const [customPromptTemplate, providerSettings, githubReadme, convexDocsContext] =
    await Promise.all([
      ctx.runQuery(internal.aiSettings._getSeoActivePromptContent),
      ctx.runQuery(internal.aiSettings._getProviderSettingsForFallback),
      fetchRepoReadme(pkg.repositoryUrl, githubToken),
      fetchConvexDocsContext(),
    ]);

  const prompt = buildSeoPrompt(pkg, {
    customTemplate: customPromptTemplate,
    githubReadme: githubReadme?.content,
    convexDocsContext,
  });

  console.log(
    githubReadme?.sourceLabel
      ? `SEO README grounding source: ${githubReadme.sourceLabel}`
      : "SEO README grounding source: package metadata only"
  );

  return { prompt, providerSettings };
}

function buildSeoCandidates(providerSettings: any) {
  return buildProviderCandidates({
    adminProviders: providerSettings,
    envKeys: {
      anthropic: process.env.ANTHROPIC_API_KEY,
      openai: process.env.CONVEX_OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY ?? process.env.CONVEX_GEMINI_API_KEY,
    },
    defaultEnvModels: {
      anthropic: "claude-sonnet-4-6",
      openai: "gpt-5.5",
      gemini: "gemini-1.5-pro",
    },
  });
}

function parseSeoAiResponse(raw: string): SeoContentResponse {
  let jsonStr = raw.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  const parsed: SeoContentResponse = JSON.parse(jsonStr);
  if (
    !parsed.valueProp ||
    !Array.isArray(parsed.benefits) ||
    !Array.isArray(parsed.useCases) ||
    !Array.isArray(parsed.faq)
  ) {
    throw new ConvexError("AI response missing required fields");
  }
  return parsed;
}

export const generateSeoContent = internalAction({
  args: { packageId: v.id("packages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.seoContentDb._updateSeoStatus, {
      packageId: args.packageId,
      status: "generating",
    });

    try {
      const pkg = await ctx.runQuery(internal.packages._getPackage, { packageId: args.packageId });
      if (!pkg) throw new ConvexError("Package not found");

      const { prompt, providerSettings } = await fetchSeoContext(ctx, pkg);
      const candidates = buildSeoCandidates(providerSettings);

      const {
        result: aiResponseText,
        usedProvider,
        usedModel,
        usedSource,
      } = await executeWithProviderFallback({
        candidates,
        run: async (c) => callAiProvider(c.provider, c.apiKey, c.model, prompt),
      });
      console.log(`SEO provider selected: ${usedProvider} (${usedSource}) model=${usedModel}`);

      const parsed = parseSeoAiResponse(aiResponseText);
      const resourceLinks = buildResourceLinks(pkg, parsed.resourceLinks);
      const skillMd = buildSkillMd(pkg, parsed);

      await ctx.runMutation(internal.seoContentDb._saveSeoContent, {
        packageId: args.packageId,
        valueProp: parsed.valueProp.slice(0, 160),
        benefits: parsed.benefits.slice(0, 4),
        useCases: parsed.useCases.slice(0, 4).map((uc) => ({ query: uc.query, answer: uc.answer })),
        faq: parsed.faq.slice(0, 5).map((f) => ({ question: f.question, answer: f.answer })),
        resourceLinks,
        skillMd,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("SEO content generation failed:", msg);
      await ctx.runMutation(internal.seoContentDb._setSeoError, {
        packageId: args.packageId,
        error: msg,
      });
    }
    return null;
  },
});

// Public action: Admin triggers SEO content generation (or regeneration)
export const regenerateSeoContent = action({
  args: { packageId: v.id("packages") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    // AI generation costs provider credits, so it is admin only
    await requireAdminIdentity(ctx);

    // Schedule the generation to run immediately
    await ctx.scheduler.runAfter(0, internal.seoContent.generateSeoContent, {
      packageId: args.packageId,
    });
    return null;
  },
});

// ============ PROMPT BUILDER ============

// Build SEO prompt by replacing placeholders with package data.
function buildSeoPrompt(
  pkg: any,
  options?: {
    customTemplate?: string;
    githubReadme?: string;
    convexDocsContext?: string;
  }
): string {
  const displayName = pkg.componentName || pkg.name || "Unknown Component";
  const category = pkg.category || "general";
  const tags = pkg.tags?.join(", ") || "";
  const shortDesc = pkg.shortDescription || pkg.description || "";
  const longDesc = pkg.longDescription || "";
  const repoUrl = pkg.repositoryUrl || "";
  const installCmd = pkg.installCommand || `npm install ${pkg.name}`;
  const npmUrl = pkg.npmUrl || "";
  const demoUrl = pkg.demoUrl || "";
  const githubReadme =
    options?.githubReadme || "README unavailable. Fall back to component metadata only.";
  const convexDocsContext = options?.convexDocsContext || buildFallbackConvexDocsContext();

  // Use custom template if provided and not empty, otherwise use default
  const template =
    options?.customTemplate && options.customTemplate.trim()
      ? options.customTemplate
      : DEFAULT_SEO_PROMPT_TEMPLATE;

  // Replace placeholders with actual values
  return template
    .replace(/\{\{displayName\}\}/g, displayName)
    .replace(/\{\{packageName\}\}/g, pkg.name || "")
    .replace(/\{\{category\}\}/g, category)
    .replace(/\{\{tags\}\}/g, tags)
    .replace(/\{\{shortDesc\}\}/g, shortDesc)
    .replace(/\{\{longDesc\}\}/g, longDesc)
    .replace(/\{\{repoUrl\}\}/g, repoUrl)
    .replace(/\{\{installCmd\}\}/g, installCmd)
    .replace(/\{\{npmUrl\}\}/g, npmUrl)
    .replace(/\{\{demoUrl\}\}/g, demoUrl)
    .replace(/\{\{githubReadme\}\}/g, githubReadme)
    .replace(/\{\{convexDocsContext\}\}/g, convexDocsContext);
}

// Build consistent resource links from package data
function buildResourceLinks(
  pkg: any,
  aiLinks: { label: string; url: string }[] = []
): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];

  // Always include npm
  if (pkg.npmUrl) {
    links.push({ label: "npm package", url: pkg.npmUrl });
  }

  // GitHub or GitLab repo
  if (pkg.repositoryUrl) {
    links.push({ label: `${repoHostLabel(pkg.repositoryUrl)} repository`, url: pkg.repositoryUrl });
  }

  // Demo URL
  if (pkg.demoUrl) {
    links.push({ label: "Live demo", url: pkg.demoUrl });
  }

  // Component directory page
  if (pkg.slug) {
    links.push({
      label: "Convex Components Directory",
      url: `https://www.convex.dev/components/${pkg.slug}`,
    });
  }

  // Always include Convex docs
  links.push({
    label: "Convex documentation",
    url: "https://docs.convex.dev",
  });

  // Add any unique AI-suggested links not already present
  const existingUrls = new Set(links.map((l) => l.url));
  for (const aiLink of aiLinks) {
    if (aiLink.url && !existingUrls.has(aiLink.url)) {
      links.push(aiLink);
      existingUrls.add(aiLink.url);
    }
  }

  return links;
}

// ============ V2: COMPONENT DIRECTORY CONTENT GENERATION ============

const README_INCLUDE_START = "<!-- START: Include on https://convex.dev/components -->";
const README_INCLUDE_END = "<!-- END: Include on https://convex.dev/components -->";
const CONVEX_BADGE_REGEX = /\[!\[Convex Component\][^\]]*\]\([^)]*\)\]\([^)]*\)\s*/g;

interface ContentGenerationResponse {
  description: string;
  useCases: string;
  howItWorks: string;
}

// Takes the RAW (unsanitized) README so the include markers are still present.
// sanitizeReadme removes all HTML comments, so running it first would delete the markers.
// The repo owner controls this markdown, so script-capable HTML is stripped
// from both results (the detail page sanitizes again when it renders).
function extractReadmeIncludeBlock(
  rawReadmeContent: string
): { markdown: string; source: "markers" | "full" } | null {
  if (!rawReadmeContent) return null;

  const startIdx = rawReadmeContent.indexOf(README_INCLUDE_START);
  const endIdx = rawReadmeContent.indexOf(README_INCLUDE_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const extracted = rawReadmeContent
      .slice(startIdx + README_INCLUDE_START.length, endIdx)
      .trim();
    if (extracted) {
      // Light cleanup on the marked block: authors chose this content on purpose,
      // so only strip comments, the Convex badge, unsafe HTML, and normalize whitespace.
      const cleaned = stripUnsafeHtml(
        stripConvexBadge(
          extracted
            .replace(/\r/g, "")
            .replace(/<!--[\s\S]*?-->/g, "")
            .replace(/\n{3,}/g, "\n\n")
        )
      ).trim();
      if (cleaned) {
        return {
          markdown: cleaned,
          source: "markers" as const,
        };
      }
    }
  }

  // No markers: fall back to the fully sanitized README (same output as before)
  return {
    markdown: stripUnsafeHtml(stripConvexBadge(sanitizeReadme(rawReadmeContent))),
    source: "full" as const,
  };
}

function stripConvexBadge(md: string): string {
  return md.replace(CONVEX_BADGE_REGEX, "").trim();
}

function buildContentPrompt(
  pkg: any,
  options?: {
    customTemplate?: string;
    githubReadme?: string;
    convexDocsContext?: string;
  }
): string {
  const displayName = pkg.componentName || pkg.name || "Unknown Component";
  const category = pkg.category || "general";
  const tags = pkg.tags?.join(", ") || "";
  const shortDesc = pkg.shortDescription || pkg.description || "";
  const repoUrl = pkg.repositoryUrl || "";
  const installCmd = pkg.installCommand || `npm install ${pkg.name}`;
  const npmUrl = pkg.npmUrl || "";
  const demoUrl = pkg.demoUrl || "";
  const githubReadme =
    options?.githubReadme || "README unavailable. Fall back to component metadata only.";
  const convexDocsContext = options?.convexDocsContext || buildFallbackConvexDocsContext();

  const template =
    options?.customTemplate && options.customTemplate.trim()
      ? options.customTemplate
      : DEFAULT_CONTENT_PROMPT_TEMPLATE;

  return template
    .replace(/\{\{displayName\}\}/g, displayName)
    .replace(/\{\{packageName\}\}/g, pkg.name || "")
    .replace(/\{\{category\}\}/g, category)
    .replace(/\{\{tags\}\}/g, tags)
    .replace(/\{\{shortDesc\}\}/g, shortDesc)
    .replace(/\{\{repoUrl\}\}/g, repoUrl)
    .replace(/\{\{installCmd\}\}/g, installCmd)
    .replace(/\{\{npmUrl\}\}/g, npmUrl)
    .replace(/\{\{demoUrl\}\}/g, demoUrl)
    .replace(/\{\{githubReadme\}\}/g, githubReadme)
    .replace(/\{\{convexDocsContext\}\}/g, convexDocsContext);
}

// Internal action: Generate v2 component directory content
async function fetchContentContext(ctx: any, pkg: any) {
  const githubToken = process.env.GITHUB_TOKEN;
  const [customPromptTemplate, providerSettings, githubReadme, convexDocsContext] =
    await Promise.all([
      ctx.runQuery(internal.aiSettings._getSeoActivePromptContent),
      ctx.runQuery(internal.aiSettings._getProviderSettingsForFallback),
      fetchRepoReadme(pkg.repositoryUrl, githubToken),
      fetchConvexDocsContext(),
    ]);

  const readmeBlock = extractReadmeIncludeBlock(githubReadme?.rawFullContent || "");

  const prompt = buildContentPrompt(pkg, {
    customTemplate: customPromptTemplate,
    githubReadme: githubReadme?.content,
    convexDocsContext,
  });

  console.log(
    githubReadme?.sourceLabel
      ? `Content README source: ${githubReadme.sourceLabel}`
      : "Content README source: metadata only"
  );

  return { prompt, providerSettings, readmeBlock };
}

function parseContentAiResponse(raw: string): ContentGenerationResponse {
  let jsonStr = raw.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  const parsed: ContentGenerationResponse = JSON.parse(jsonStr);
  if (!parsed.description || !parsed.useCases || !parsed.howItWorks) {
    throw new ConvexError("AI response missing required content fields");
  }
  // The prompt includes the submitter's README, so treat the output as
  // untrusted markdown too
  return {
    description: parsed.description,
    useCases: stripUnsafeHtml(normalizeMarkdown(parsed.useCases)),
    howItWorks: stripUnsafeHtml(normalizeMarkdown(parsed.howItWorks)),
  };
}

export const generateDirectoryContent = internalAction({
  args: { packageId: v.id("packages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.seoContentDb._updateContentStatus, {
      packageId: args.packageId,
      status: "generating",
    });

    try {
      const pkg = await ctx.runQuery(internal.packages._getPackage, { packageId: args.packageId });
      if (!pkg) throw new ConvexError("Package not found");

      const { prompt, providerSettings, readmeBlock } = await fetchContentContext(ctx, pkg);
      const candidates = buildSeoCandidates(providerSettings);

      const {
        result: aiResponseText,
        usedProvider,
        usedModel,
        usedSource,
      } = await executeWithProviderFallback({
        candidates,
        run: async (c) => callAiProvider(c.provider, c.apiKey, c.model, prompt),
      });
      console.log(`Content provider: ${usedProvider} (${usedSource}) model=${usedModel}`);

      const parsed = parseContentAiResponse(aiResponseText);
      const skillMd = buildSkillMdFromContent(pkg, parsed);

      await ctx.runMutation(internal.seoContentDb._saveGeneratedContent, {
        packageId: args.packageId,
        generatedDescription: parsed.description.slice(0, 2000),
        generatedUseCases: parsed.useCases.slice(0, 4000),
        generatedHowItWorks: parsed.howItWorks.slice(0, 4000),
        readmeIncludedMarkdown: readmeBlock?.markdown || undefined,
        readmeIncludeSource: readmeBlock?.source,
        skillMd,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("Content generation failed:", msg);
      await ctx.runMutation(internal.seoContentDb._setContentError, {
        packageId: args.packageId,
        error: msg,
      });
    }
    return null;
  },
});

// Public action: Trigger content generation from submit form or admin
export const regenerateDirectoryContent = action({
  args: { packageId: v.id("packages") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await requireAdminIdentity(ctx);

    await ctx.scheduler.runAfter(0, internal.seoContent.generateDirectoryContent, {
      packageId: args.packageId,
    });
    return null;
  },
});

// Internal action: Fetch and update only the README without regenerating AI content.
// Every attempt is recorded in readmeUpdateLogs with its trigger source
// (cron auto-update, admin button, profile button) for the admin Logs tab.
export const refreshReadme = internalAction({
  args: {
    packageId: v.id("packages"),
    source: v.optional(
      v.union(v.literal("cron"), v.literal("admin"), v.literal("profile")),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const source = args.source ?? "admin";
    let packageName = "unknown";
    try {
      const pkg = await ctx.runQuery(internal.packages._getPackage, { packageId: args.packageId });
      if (!pkg) throw new ConvexError("Package not found");
      packageName = pkg.name;
      if (!pkg.repositoryUrl) throw new ConvexError("No repository URL");

      const githubToken = process.env.GITHUB_TOKEN;
      const githubReadme = await fetchRepoReadme(pkg.repositoryUrl, githubToken);
      const fullReadmeContent = githubReadme?.fullContent || "";
      const readmeBlock = extractReadmeIncludeBlock(githubReadme?.rawFullContent || "");

      const changed: boolean = await ctx.runMutation(internal.seoContentDb._updateReadmeOnly, {
        packageId: args.packageId,
        readmeIncludedMarkdown: readmeBlock?.markdown || undefined,
        readmeIncludeSource: readmeBlock?.source,
      });

      await ctx.runMutation(internal.readmeAutoUpdate._insertReadmeUpdateLog, {
        packageId: args.packageId,
        packageName,
        status: "success",
        source,
        changed,
        message: githubReadme?.sourceLabel
          ? undefined
          : "No README found in repository",
      });

      console.log(
        githubReadme?.sourceLabel
          ? `README refresh: ${githubReadme.sourceLabel} (${fullReadmeContent.length} chars)`
          : "README refresh: no README found"
      );
    } catch (error) {
      const msg =
        error instanceof ConvexError
          ? String(error.data)
          : error instanceof Error
            ? error.message
            : "Unknown error";
      console.error("README refresh failed:", msg);
      await ctx.runMutation(internal.readmeAutoUpdate._insertReadmeUpdateLog, {
        packageId: args.packageId,
        packageName,
        status: "failed",
        source,
        message: msg,
      });
    }
    return null;
  },
});

// Public action: Admin triggers README-only refresh
export const refreshReadmeContent = action({
  args: { packageId: v.id("packages") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await requireAdminIdentity(ctx);

    await ctx.scheduler.runAfter(0, internal.seoContent.refreshReadme, {
      packageId: args.packageId,
      source: "admin",
    });
    return null;
  },
});

// Public action: Preview content generation without saving (for submit form)
async function fetchPreviewContext(
  ctx: any,
  repoUrl: string
): Promise<{
  customPromptTemplate: string | null;
  providerSettings: any;
  githubReadme: {
    content?: string;
    rawContent?: string;
    fullContent?: string;
    rawFullContent?: string;
    sourceLabel?: string;
  } | null;
  convexDocsContext: string | null;
  readmeBlock: { markdown?: string; source?: "markers" | "full" } | null;
}> {
  const githubToken = process.env.GITHUB_TOKEN;
  const [customPromptTemplate, providerSettings, githubReadme, convexDocsContext] =
    await Promise.all([
      ctx.runQuery(internal.aiSettings._getSeoActivePromptContent),
      ctx.runQuery(internal.aiSettings._getProviderSettingsForFallback),
      fetchRepoReadme(repoUrl, githubToken),
      fetchConvexDocsContext(),
    ]);
  const readmeBlock = extractReadmeIncludeBlock(githubReadme?.rawFullContent || "");
  return { customPromptTemplate, providerSettings, githubReadme, convexDocsContext, readmeBlock };
}

export const previewDirectoryContent = action({
  args: {
    repositoryUrl: v.string(),
    npmUrl: v.string(),
    componentName: v.string(),
    shortDescription: v.string(),
    source: v.union(v.literal("submit"), v.literal("profile")),
  },
  returns: v.object({
    description: v.string(),
    useCases: v.string(),
    howItWorks: v.string(),
    readmeIncludedMarkdown: v.optional(v.string()),
    readmeIncludeSource: v.optional(v.union(v.literal("markers"), v.literal("full"))),
  }),
  handler: async (ctx, args) => {
    const { userKey, email } = await requireContentGenerationUserKey(ctx);
    await enforceContentGenerationRateLimit(ctx, userKey, args.source, email);

    const { customPromptTemplate, providerSettings, githubReadme, convexDocsContext, readmeBlock } =
      await fetchPreviewContext(ctx, args.repositoryUrl);

    const pkgName = extractPackageNameFromNpmUrl(args.npmUrl);
    const fakePkg = {
      componentName: args.componentName,
      name: pkgName,
      shortDescription: args.shortDescription,
      repositoryUrl: args.repositoryUrl,
      npmUrl: args.npmUrl,
      installCommand: `npm install ${pkgName}`,
    };

    const prompt = buildContentPrompt(fakePkg, {
      customTemplate: customPromptTemplate ?? undefined,
      githubReadme: githubReadme?.content,
      convexDocsContext: convexDocsContext ?? undefined,
    });

    const candidates = buildSeoCandidates(providerSettings);
    const { result: aiResponseText } = await executeWithProviderFallback({
      candidates,
      run: async (c) => callAiProvider(c.provider, c.apiKey, c.model, prompt),
    });

    const parsed = parseContentAiResponse(aiResponseText);
    return {
      description: parsed.description,
      useCases: parsed.useCases,
      howItWorks: parsed.howItWorks,
      readmeIncludedMarkdown: readmeBlock?.markdown,
      readmeIncludeSource: readmeBlock?.source,
    };
  },
});

async function requireContentGenerationUserKey(
  ctx: ActionCtx
): Promise<{ userKey: string; email?: string }> {
  const identity = await ctx.auth.getUserIdentity();
  const userKey = identity?.subject ?? identity?.email?.trim().toLowerCase();

  if (!userKey) {
    throw new ConvexError("Authentication required to generate content. Please sign in first.");
  }

  return { userKey, email: identity?.email ?? undefined };
}

async function enforceContentGenerationRateLimit(
  ctx: ActionCtx,
  userKey: string,
  source: "submit" | "profile",
  email?: string
): Promise<void> {
  const rateLimit = await ctx.runQuery(internal.contentGenerationLimits._checkRateLimit, {
    userKey,
    now: Date.now(),
    email,
  });

  if (rateLimit.blockedMessage) {
    throw new ConvexError(rateLimit.blockedMessage);
  }
  if (!rateLimit.allowed) {
    const resetMessage = rateLimit.resetAt
      ? ` Try again after ${new Date(rateLimit.resetAt).toLocaleString()}.`
      : "";
    throw new ConvexError(
      `Content generation is limited to once per hour per account. Please only regenerate when really needed and edit the current draft when you can.${resetMessage}`
    );
  }

  await ctx.runMutation(internal.contentGenerationLimits._recordRequest, {
    userKey,
    source,
  });
}

function extractPackageNameFromNpmUrl(npmUrl: string): string {
  const match = npmUrl.match(/npmjs\.com\/package\/((?:@[^/]+\/)?[^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}
