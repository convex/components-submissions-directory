// Shared repository URL parser for GitHub and GitLab. Used by both the Convex
// backend and the React app, so it relies only on the URL API (no Node).
//
// Provider is derived from the URL on every read. Nothing is stored in the
// schema, which keeps existing GitHub packages untouched.

export type RepoProvider = "github" | "gitlab";

export type RepoHost = "github.com" | "gitlab.com";

export interface ParsedRepoUrl {
  provider: RepoProvider;
  host: RepoHost;
  /** GitHub owner, or the full GitLab namespace path (may contain "/"). */
  owner: string;
  repo: string;
  /** "owner/repo" for GitHub, "group/subgroup/project" for GitLab. */
  projectPath: string;
  /** Git ref from a /tree or /blob URL. Undefined means default branch. */
  ref?: string;
  /** Repo-relative directory from a /tree or /blob URL ("" for repo root). */
  dir: string;
  /** Canonical https URL for the project root. */
  webUrl: string;
}

const SEGMENT_PATTERN = /^[\w.-]+$/;

// GitHub orgs that were renamed. GitHub redirects repo, raw and API URLs for
// the old name, but the old org page and its .png avatar return 404.
const GITHUB_OWNER_RENAMES: Record<string, string> = {
  "get-convex": "convex",
};

/** Current GitHub owner for a possibly renamed org (case-insensitive). */
export function canonicalGithubOwner(owner: string): string {
  return GITHUB_OWNER_RENAMES[owner.toLowerCase()] ?? owner;
}

/** The owner plus any former names, lowercased, for search matching. */
export function githubOwnerAliases(owner: string): Array<string> {
  const current = canonicalGithubOwner(owner).toLowerCase();
  const former = Object.keys(GITHUB_OWNER_RENAMES).filter(
    (name) => GITHUB_OWNER_RENAMES[name] === current,
  );
  return [current, ...former];
}

function hostFor(hostname: string): RepoHost | null {
  const lower = hostname.toLowerCase();
  if (lower === "github.com" || lower === "www.github.com") return "github.com";
  if (lower === "gitlab.com" || lower === "www.gitlab.com") return "gitlab.com";
  return null;
}

// Normalize the shapes npm and git users paste: git+https, ssh, .git, hashes.
function normalizeInput(input: string): string {
  return input
    .trim()
    .replace(/^git\+/, "")
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/^git@gitlab\.com:/, "https://gitlab.com/")
    .replace(/^ssh:\/\/git@/, "https://")
    .replace(/#.*$/, "");
}

/** Parse a GitHub or GitLab repository URL. Returns null for anything else. */
export function parseRepoUrl(input?: string | null): ParsedRepoUrl | null {
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(normalizeInput(input));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = hostFor(url.hostname);
  if (!host) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  // GitLab marks the end of the project path with "/-/". Without it, legacy
  // URLs may still use /tree/ or /blob/ directly after the project path.
  let pathSegments: string[];
  let rest: string[];
  if (host === "gitlab.com") {
    const dashIndex = segments.indexOf("-");
    if (dashIndex >= 2) {
      pathSegments = segments.slice(0, dashIndex);
      rest = segments.slice(dashIndex + 1);
    } else {
      const legacyIndex = segments.findIndex(
        (segment, index) => index >= 2 && (segment === "tree" || segment === "blob"),
      );
      pathSegments = legacyIndex > 0 ? segments.slice(0, legacyIndex) : segments;
      rest = legacyIndex > 0 ? segments.slice(legacyIndex) : [];
    }
  } else {
    pathSegments = segments.slice(0, 2);
    rest = segments.slice(2);
  }

  if (pathSegments.length < 2) return null;
  const repo = pathSegments[pathSegments.length - 1].replace(/\.git$/i, "");
  const ownerSegments = pathSegments.slice(0, -1);
  if (!repo || !SEGMENT_PATTERN.test(repo)) return null;
  if (!ownerSegments.every((segment) => SEGMENT_PATTERN.test(segment))) return null;
  // GitHub only ever has a single owner segment.
  if (host === "github.com" && ownerSegments.length !== 1) return null;

  const owner =
    host === "github.com" ? canonicalGithubOwner(ownerSegments[0]) : ownerSegments.join("/");
  const projectPath = `${owner}/${repo}`;

  let ref: string | undefined;
  let dir = "";
  const [mode, maybeRef, ...tail] = rest;
  if ((mode === "tree" || mode === "blob") && maybeRef) {
    ref = decodeURIComponent(maybeRef);
    const tailPath = tail.map((segment) => decodeURIComponent(segment)).join("/");
    if (mode === "blob") {
      // A blob points at a file; the README's directory is its parent.
      dir = tailPath.includes("/") ? tailPath.split("/").slice(0, -1).join("/") : "";
    } else {
      dir = tailPath;
    }
  }

  return {
    provider: host === "github.com" ? "github" : "gitlab",
    host,
    owner,
    repo,
    projectPath,
    ref,
    dir,
    webUrl: `https://${host}/${projectPath}`,
  };
}

export function isSupportedRepoUrl(input?: string | null): boolean {
  return parseRepoUrl(input) !== null;
}

export function providerLabel(provider: RepoProvider): "GitHub" | "GitLab" {
  return provider === "github" ? "GitHub" : "GitLab";
}

/** "GitHub" or "GitLab" for a URL, or a neutral fallback for unknown hosts. */
export function repoHostLabel(repositoryUrl?: string | null, fallback = "Repository"): string {
  const parsed = parseRepoUrl(repositoryUrl);
  return parsed ? providerLabel(parsed.provider) : fallback;
}

function encodePath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/** Browser URL for a file or directory inside the repo. */
export function repoBlobUrl(parsed: ParsedRepoUrl, path: string, ref = parsed.ref ?? "HEAD"): string {
  const encoded = encodePath(path);
  if (parsed.provider === "github") {
    // GitHub serves files via /blob and 301-redirects directories to /tree.
    return `${parsed.webUrl}/blob/${encodeURIComponent(ref)}/${encoded}`;
  }
  return `${parsed.webUrl}/-/blob/${encodeURIComponent(ref)}/${encoded}`;
}

/** Raw file URL, suitable for <img src>. */
export function repoRawUrl(parsed: ParsedRepoUrl, path: string, ref = parsed.ref ?? "HEAD"): string {
  const encoded = encodePath(path);
  if (parsed.provider === "github") {
    return `https://raw.githubusercontent.com/${parsed.projectPath}/${encodeURIComponent(ref)}/${encoded}`;
  }
  return `${parsed.webUrl}/-/raw/${encodeURIComponent(ref)}/${encoded}`;
}

export function repoIssuesUrl(parsed: ParsedRepoUrl): string {
  return parsed.provider === "github" ? `${parsed.webUrl}/issues` : `${parsed.webUrl}/-/issues`;
}

/** Profile page for the owner (GitHub user/org or GitLab user/group). */
export function repoOwnerUrl(parsed: ParsedRepoUrl): string {
  return `https://${parsed.host}/${parsed.owner}`;
}
