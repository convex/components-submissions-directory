// URL scheme for category landing pages and their agent files.
// Agent files sit at the directory root (one path segment) so they can't
// collide with component paths, which always have a slug segment first.
// For the official category this yields /components/get-convex-llms.txt and
// /components/get-convex.md, the original official list URLs.

const COMPONENTS_BASE_PATH = "/components";

export function buildCategoryPaths(slug: string): {
  pagePath: string;
  llmsPath: string;
  markdownPath: string;
} {
  return {
    pagePath: `${COMPONENTS_BASE_PATH}/categories/${slug}`,
    llmsPath: `${COMPONENTS_BASE_PATH}/${slug}-llms.txt`,
    markdownPath: `${COMPONENTS_BASE_PATH}/${slug}.md`,
  };
}

export function buildCategoryUrls(
  slug: string,
  origin: string,
): { pageUrl: string; llmsUrl: string; markdownUrl: string } {
  const paths = buildCategoryPaths(slug);
  return {
    pageUrl: new URL(paths.pagePath, origin).toString(),
    llmsUrl: new URL(paths.llmsPath, origin).toString(),
    markdownUrl: new URL(paths.markdownPath, origin).toString(),
  };
}

// Agent file URLs for links in the app. Local Vite dev has no Netlify edge
// functions to proxy the /components aliases, so it links the Convex HTTP
// endpoints directly (same approach as buildComponentClientUrls).
export function buildCategoryClientUrls(
  slug: string,
  appOrigin: string,
  convexUrl?: string,
): { llmsUrl: string; markdownUrl: string } {
  const hostname = new URL(appOrigin).hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  if (convexUrl && isLocal) {
    const siteOrigin = convexUrl
      .replace(".convex.cloud", ".convex.site")
      .replace(/\/$/, "");
    const encoded = encodeURIComponent(slug);
    return {
      llmsUrl: `${siteOrigin}/api/category-llms?slug=${encoded}`,
      markdownUrl: `${siteOrigin}/api/category-markdown?slug=${encoded}`,
    };
  }
  const urls = buildCategoryUrls(slug, appOrigin);
  return { llmsUrl: urls.llmsUrl, markdownUrl: urls.markdownUrl };
}
