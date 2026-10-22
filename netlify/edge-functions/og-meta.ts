const defaultConvexCloudUrl = "https://giant-grouse-674.convex.cloud";

const SITE_NAME = "Convex Components";
const SITE_ORIGIN = "https://www.convex.dev";

function getOgImageUrl(title: string): string {
  return `https://www.convex.dev/api/og?title=${encodeURIComponent(title)}`;
}

type ReviewStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "changes_requested"
  | "rejected";

function extractSlug(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const match = normalized.match(/^\/components\/([^/.]+(?:\/[^/.]+)*)$/);
  if (!match) return null;
  const slug = match[1];
  const reserved = [
    "submit",
    "admin",
    "login",
    "callback",
    "profile",
    "submissions",
    "documentation",
    "dashboard",
    "badge",
    "categories",
    "_img",
    "_src",
  ];
  if (
    reserved.includes(slug) ||
    slug.startsWith("submit/") ||
    slug.startsWith("submissions/") ||
    slug.startsWith("badge/") ||
    slug.startsWith("_img/") ||
    slug.startsWith("_src/") ||
    slug.startsWith("callback/") ||
    slug.startsWith("categories/") ||
    slug.startsWith("dashboard/") ||
    slug.startsWith("documentation/") ||
    slug.startsWith("profile/")
  ) {
    return null;
  }
  return slug;
}

// Routes that must never be indexed. Netlify [[headers]] rules do not apply
// to URLs handled by an edge function, so the X-Robots-Tag header has to be
// set here. Exact matches only: /components/submit IS indexed and must never
// match. /components/submissions is admin only (client redirects non-admins
// to /components), so crawlers get noindex to drop the previously live URL.
function isNoindexPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "");
  return (
    path === "/components/submissions" ||
    path === "/components/submissions/admin" ||
    path === "/components/callback" ||
    path === "/components/dashboard" ||
    path === "/components/profile" ||
    path.startsWith("/components/profile/") ||
    path === "/components/documentation" ||
    path.startsWith("/components/documentation/")
  );
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Escape text destined for HTML body content.
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Convert plain text with blank-line paragraphs into <p> blocks.
function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

// Hidden from users to avoid a flash of unstyled content before React mounts
// (the page stays blank during load, then the real app renders). The block is
// still present in the first-pass HTML, so crawlers that do not execute JS read
// it; createRoot() removes it on mount.
const SEO_WRAP_STYLE = "display:none;";

// Build the crawlable body for a component detail page.
function renderComponentSeoBody(c: ComponentData): string {
  const title = escapeHtml(c.componentName || c.name);
  const intro = c.seoValueProp || c.shortDescription || c.description || "";
  const about = c.longDescription || c.generatedDescription || "";

  const parts: string[] = [];
  parts.push(
    `<nav><a href="/components">Convex Components</a></nav>`
  );
  parts.push(`<h1>${title}</h1>`);
  if (intro) parts.push(`<p>${escapeHtml(intro)}</p>`);

  if (c.installCommand) {
    parts.push(
      `<h2>Installation</h2><pre><code>${escapeHtml(c.installCommand)}</code></pre>`
    );
  }

  if (about && about !== intro) {
    parts.push(`<h2>About ${title}</h2>${paragraphs(about)}`);
  }

  if (c.seoBenefits && c.seoBenefits.length > 0) {
    const items = c.seoBenefits
      .map((b) => `<li>${escapeHtml(b)}</li>`)
      .join("");
    parts.push(`<h2>Benefits</h2><ul>${items}</ul>`);
  }

  if (c.seoUseCases && c.seoUseCases.length > 0) {
    const items = c.seoUseCases
      .map(
        (u) =>
          `<h3>${escapeHtml(u.query)}</h3>${paragraphs(u.answer)}`
      )
      .join("");
    parts.push(`<h2>Use cases</h2>${items}`);
  }

  if (c.seoFaq && c.seoFaq.length > 0) {
    const items = c.seoFaq
      .map(
        (f) =>
          `<h3>${escapeHtml(f.question)}</h3>${paragraphs(f.answer)}`
      )
      .join("");
    parts.push(`<h2>Frequently asked questions</h2>${items}`);
  }

  const links: string[] = [];
  if (c.npmUrl)
    links.push(`<li><a href="${escapeAttr(c.npmUrl)}">npm package</a></li>`);
  if (c.repositoryUrl)
    links.push(
      `<li><a href="${escapeAttr(c.repositoryUrl)}">Source repository</a></li>`
    );
  if (c.homepageUrl)
    links.push(
      `<li><a href="${escapeAttr(c.homepageUrl)}">Homepage</a></li>`
    );
  if (c.demoUrl)
    links.push(`<li><a href="${escapeAttr(c.demoUrl)}">Live demo</a></li>`);
  if (links.length > 0) {
    parts.push(`<h2>Links</h2><ul>${links.join("")}</ul>`);
  }

  return `<div data-seo-prerender style="${SEO_WRAP_STYLE}">${parts.join("")}</div>`;
}

// Inject server-rendered content into the empty #root so crawlers see real
// content. createRoot() replaces these children on client mount.
function injectRootContent(html: string, innerHtml: string): string {
  return html.replace(
    /<div id="root">\s*<\/div>/,
    `<div id="root">${innerHtml}</div>`
  );
}

// Serialize a value for a <script type="application/json"> block. JSON.parse
// reads the unicode escapes back as the same characters, but the HTML parser
// never sees a literal "<", so component text like "</script>" or "<!--"
// can't close the tag or open a comment. U+2028/U+2029 are escaped too so
// the text stays safe if it ever ends up in a JS context.
export function serializeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// Hand the component the edge already fetched to the client, so the first
// render doesn't wait on a second (CORS-preflighted) request to Convex.
// src/lib/convexHttp.ts reads it once for this slug, then fetches and
// subscribes to live data as usual. Goes before </body>, not in #root, which
// createRoot() clears and which may hold a static skeleton.
export function injectComponentData(
  html: string,
  slug: string,
  value: unknown
): string {
  const block = `<script type="application/json" id="component-data">${serializeJsonForScript({ slug, value })}</script>`;
  // A replacer function, not a string: in a replacement string "$'", "$`",
  // "$&" and "$$" are patterns, and component text (bash snippets, prices)
  // can contain them
  return html.includes("</body>")
    ? html.replace("</body>", () => `${block}\n</body>`)
    : html;
}

interface ComponentData {
  componentName?: string;
  name: string;
  shortDescription?: string;
  description: string;
  longDescription?: string;
  generatedDescription?: string;
  seoValueProp?: string;
  seoBenefits?: string[];
  seoUseCases?: Array<{ query: string; answer: string }>;
  seoFaq?: Array<{ question: string; answer: string }>;
  installCommand?: string;
  npmUrl?: string;
  repositoryUrl?: string;
  homepageUrl?: string;
  demoUrl?: string;
  category?: string;
  thumbnailUrl?: string;
  slug?: string;
  reviewStatus?: ReviewStatus;
}

function getRobotsContent(reviewStatus?: ReviewStatus): string {
  return reviewStatus === "approved" ? "index, follow" : "noindex, nofollow";
}

// format "json" and the client's "convex_encoded_json" encode this query's
// result the same way: it only holds strings, finite numbers, booleans,
// arrays and objects (no int64 or bytes). The client still runs jsonToConvex
// on the embedded copy, like ConvexHttpClient does.
async function fetchComponent(
  slug: string
): Promise<ComponentData | null | undefined> {
  const convexCloudUrl =
    Deno.env.get("VITE_CONVEX_URL") || defaultConvexCloudUrl;
  const apiUrl = `${convexCloudUrl}/api/query`;

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "packages:getComponentBySlug",
        args: { slug },
        format: "json",
      }),
    });
    if (!res.ok) return undefined;
    const json = await res.json();
    if (json.status !== "success") return undefined;
    return json.value ? (json.value as ComponentData) : null;
  } catch {
    return undefined;
  }
}

// Replace meta tags in HTML with component-specific values.
// Works by finding all <meta ...> tags (including multiline) and replacing
// the ones that match known OG/Twitter attributes.
function injectCanonical(html: string, canonicalUrl: string): string {
  const escaped = escapeAttr(canonicalUrl);
  if (html.includes('rel="canonical"')) {
    html = html.replace(
      /<link\b[^>]*rel="canonical"[^>]*\/?>/,
      `<link rel="canonical" href="${escaped}" />`
    );
  } else {
    html = html.replace(
      "</head>",
      `  <link rel="canonical" href="${escaped}" />\n</head>`
    );
  }
  return html;
}

function injectMetaTags(html: string, component: ComponentData): string {
  const title = escapeAttr(component.componentName || component.name);
  const fullTitle = `${title} | ${SITE_NAME}`;
  const description = escapeAttr(
    component.seoValueProp ||
      component.shortDescription ||
      component.description ||
      ""
  );
  const url = escapeAttr(`${SITE_ORIGIN}/components/${component.slug || ""}`);
  const componentName = component.componentName || component.name;
  const image = escapeAttr(
    component.thumbnailUrl || getOgImageUrl(componentName)
  );
  const robots = escapeAttr(getRobotsContent(component.reviewStatus));

  // Replacement pairs: attribute identifier -> new full tag
  // Ordered with more specific identifiers first to avoid partial matches
  // (e.g. twitter:image:alt must come before twitter:image)
  const replacements: Array<[string, string]> = [
    ['name="title"', `<meta name="title" content="${fullTitle}" />`],
    [
      'name="description"',
      `<meta name="description" content="${description}" />`,
    ],
    ['name="robots"', `<meta name="robots" content="${robots}" />`],
    ['property="og:url"', `<meta property="og:url" content="${url}" />`],
    ['property="og:title"', `<meta property="og:title" content="${title}" />`],
    [
      'property="og:description"',
      `<meta property="og:description" content="${description}" />`,
    ],
    ['property="og:image"', `<meta property="og:image" content="${image}" />`],
    [
      'name="twitter:title"',
      `<meta name="twitter:title" content="${title}" />`,
    ],
    [
      'name="twitter:description"',
      `<meta name="twitter:description" content="${description}" />`,
    ],
    [
      'name="twitter:image:alt"',
      `<meta name="twitter:image:alt" content="${title}" />`,
    ],
    [
      'name="twitter:image"',
      `<meta name="twitter:image" content="${image}" />`,
    ],
  ];

  // Match all meta tags including multiline ones.
  // This regex finds <meta followed by content up to the next /> or >
  // Using a global replace to process each tag individually.
  // Matches <meta ...> or <meta .../> including newlines between attributes
  const metaTagPattern = /<meta\b[\s\S]*?(?:\/>|>)/g;

  html = html.replace(metaTagPattern, (match) => {
    for (const [identifier, replacement] of replacements) {
      if (match.includes(identifier)) {
        return replacement;
      }
    }
    return match;
  });

  // Replace <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${fullTitle}</title>`);

  if (!html.includes('name="robots"')) {
    html = html.replace(
      "</head>",
      `  <meta name="robots" content="${robots}" />\n</head>`
    );
  }

  // Canonical for component detail pages uses the clean slug URL
  html = injectCanonical(
    html,
    `${SITE_ORIGIN}/components/${component.slug || ""}`
  );

  return html;
}

function getConvexSiteUrl(): string {
  return (
    Deno.env.get("VITE_CONVEX_URL")?.replace(".convex.cloud", ".convex.site") ||
    defaultConvexCloudUrl.replace(".convex.cloud", ".convex.site")
  );
}

export default async (
  request: Request,
  context: { next: () => Promise<Response> }
) => {
  const url = new URL(request.url);
  const siteUrl = getConvexSiteUrl();

  // Proxy sitemap.xml directly to Convex (redirects don't fire after edge fns)
  if (url.pathname === "/components/sitemap.xml") {
    const res = await fetch(`${siteUrl}/api/sitemap.xml`);
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  }

  // Proxy llms.txt to Convex (redirects don't fire after edge fns)
  if (url.pathname === "/components/llms.txt") {
    const res = await fetch(`${siteUrl}/api/llms.txt`);
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  }
  // Proxy the directory markdown index directly to Convex.
  // Like llms.txt, this cannot rely on Netlify redirects once an edge function runs.
  if (url.pathname === "/components/components.md") {
    const res = await fetch(`${siteUrl}/api/markdown-index`, {
      headers: { accept: "text/markdown, text/plain;q=0.9, */*;q=0.8" },
    });
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  }

  // Proxy the official get-convex llms.txt list directly to Convex.
  if (url.pathname === "/components/get-convex-llms.txt") {
    const res = await fetch(`${siteUrl}/api/get-convex-llms.txt`);
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  }

  // Proxy the official get-convex markdown index directly to Convex.
  if (url.pathname === "/components/get-convex.md") {
    const res = await fetch(`${siteUrl}/api/get-convex-markdown`, {
      headers: { accept: "text/markdown, text/plain;q=0.9, */*;q=0.8" },
    });
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  }

  // Per-category agent files: /components/<category>-llms.txt and
  // /components/<category>.md. One path segment only, so component files
  // (/components/<slug>/llms.txt, /components/<slug>/<leaf>.md) never match.
  // The exact official and components.md paths above are handled first.
  const categoryFileMatch = url.pathname.match(
    /^\/components\/([^/]+?)(-llms\.txt|\.md)$/
  );
  if (categoryFileMatch) {
    const isLlms = categoryFileMatch[2] === "-llms.txt";
    let categorySlug = categoryFileMatch[1];
    try {
      categorySlug = decodeURIComponent(categorySlug);
    } catch {
      // Malformed escape: look the slug up as written
    }
    const apiPath = isLlms ? "/api/category-llms" : "/api/category-markdown";
    const res = await fetch(
      `${siteUrl}${apiPath}?slug=${encodeURIComponent(categorySlug)}`,
      isLlms
        ? undefined
        : { headers: { accept: "text/markdown, text/plain;q=0.9, */*;q=0.8" } }
    );
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": isLlms
          ? "text/plain; charset=utf-8"
          : "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  }

  const llmsMatch = url.pathname.match(/^\/components\/(.+)\/llms\.txt$/);
  if (llmsMatch) {
    const slug = llmsMatch[1];
    const res = await fetch(
      `${siteUrl}/api/component-llms?slug=${encodeURIComponent(slug)}`
    );
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  }

  // Inject noindex for admin-only documentation routes
  if (
    url.pathname === "/components/documentation" ||
    url.pathname.startsWith("/components/documentation/")
  ) {
    const response = await context.next();
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      let html = await response.text();
      if (html.includes('name="robots"')) {
        html = html.replace(
          /<meta\b[^>]*name="robots"[^>]*\/?>/,
          '<meta name="robots" content="noindex, nofollow" />'
        );
      } else {
        html = html.replace(
          "</head>",
          '  <meta name="robots" content="noindex, nofollow" />\n</head>'
        );
      }
      const canonicalUrl = `${SITE_ORIGIN}${url.pathname.replace(/\/+$/, "")}`;
      html = injectCanonical(html, canonicalUrl);
      const headers = new Headers(response.headers);
      headers.set("content-type", "text/html; charset=utf-8");
      headers.set("x-robots-tag", "noindex, nofollow");
      return new Response(html, { status: response.status, headers });
    }
    return response;
  }

  const slug = extractSlug(url.pathname);

  if (!slug) {
    // Non-component routes still need canonical tags to prevent
    // query-string duplicates (e.g. /submit vs /submit?submit=true)
    const response = await context.next();
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      let html = await response.text();
      const canonicalUrl = `${SITE_ORIGIN}${url.pathname.replace(/\/+$/, "") || "/components"}`;
      html = injectCanonical(html, canonicalUrl);
      const headers = new Headers(response.headers);
      headers.set("content-type", "text/html; charset=utf-8");
      // Admin, auth, and internal routes get a noindex header here because
      // netlify.toml [[headers]] rules never fire for edge-function responses
      if (isNoindexPath(url.pathname)) {
        headers.set("x-robots-tag", "noindex, nofollow");
      }
      return new Response(html, { status: response.status, headers });
    }
    return response;
  }

  // Fetch component data and SPA response in parallel
  const [component, response] = await Promise.all([
    fetchComponent(slug),
    context.next(),
  ]);

  // Keep serving the SPA if Convex could not confirm whether the slug exists.
  if (component === undefined) {
    return response;
  }

  if (component === null) {
    return new Response(response.body, {
      status: 404,
      headers: response.headers,
    });
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const originalHtml = await response.text();
  let modifiedHtml = injectMetaTags(originalHtml, component);
  // Inject crawlable body content; createRoot() replaces it on client mount.
  modifiedHtml = injectRootContent(
    modifiedHtml,
    renderComponentSeoBody(component)
  );
  modifiedHtml = injectComponentData(modifiedHtml, slug, component);

  // Preserve original headers but update content-type and caching
  const headers = new Headers(response.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  // The static index.html's ETag and length don't describe this page: every
  // component page would share one ETag for the whole deploy, so a browser
  // revalidating after max-age could be told its older copy is current
  headers.delete("etag");
  headers.delete("content-length");
  headers.set(
    "cache-control",
    "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
  );
  // With s-maxage=300 most cold visits missed Netlify's edge cache and waited
  // ~1s on the Convex lookup: the cache is per edge node, a region has several
  // nodes, and with ~180 components a node rarely has a page from the last
  // five minutes. Keep approved pages for an hour instead. Netlify uses this
  // header over Cache-Control and doesn't pass it on, so browsers still get the
  // short max-age above. (durable and stale-while-revalidate would be nicer,
  // but Netlify ignores both for edge function responses: an expired copy is
  // refetched while the visitor waits.)
  //
  // The trade-off: the OG/SEO tags, the hidden prerender copy and the embedded
  // component data can lag an edit by up to an hour. The client fetches and
  // subscribes to live data straight after the first render, so visitors only
  // see an old copy for a moment, and deploys purge the cache. Only approved
  // components get here as a 200 (the lookup is signed out), and 404s and
  // Convex errors above keep their uncached headers.
  if (component.reviewStatus === "approved") {
    headers.set("netlify-cdn-cache-control", "public, s-maxage=3600");
  }

  return new Response(modifiedHtml, {
    status: response.status,
    headers,
  });
};
