import type { SyntheticEvent } from "react";
import { canonicalGithubOwner } from "../../shared/repoUrl";

// Component thumbnails live in Convex storage as full-size PNGs (median
// 2.4 MB, some 3840x2160) but render at most ~360px wide in the directory.
// In production they go through Netlify Image CDN via the
// /components/_img/<width>/<storageId> rewrite in netlify/_redirects, which
// resizes them, converts to WebP/AVIF and caches the result at the edge.
// That rewrite proxies this one deployment's storage, so only its URLs are
// converted; anything else (dev builds, other deployments, non-storage URLs)
// keeps the original URL.
const IMAGE_CDN_STORAGE_PREFIX =
  "https://giant-grouse-674.convex.cloud/api/storage/";
const STORAGE_ID_RE = /^[\w-]+$/;

function storageIdFromUrl(url: string): string | undefined {
  if (!import.meta.env.PROD || !url.startsWith(IMAGE_CDN_STORAGE_PREFIX)) {
    return undefined;
  }
  const id = url.slice(IMAGE_CDN_STORAGE_PREFIX.length);
  return STORAGE_ID_RE.test(id) ? id : undefined;
}

export interface ThumbnailSizing {
  // Widths (px) to offer in srcset, smallest first
  widths: number[];
  // The <img sizes> hint for the layout the thumbnail sits in
  sizes: string;
}

// Directory and category cards: 1 column on phones, ~360px max on desktop
export const CARD_THUMBNAIL: ThumbnailSizing = {
  widths: [400, 720, 1080],
  sizes: "(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw",
};

// Featured row on the directory: one column below md, two until xl, then
// three (~330px). It stays one column longer than the card grid does.
export const FEATURED_THUMBNAIL: ThumbnailSizing = {
  widths: [400, 720, 1080],
  sizes: "(min-width: 1280px) 330px, (min-width: 768px) 50vw, 100vw",
};

// List view rows show a fixed 112-128px thumbnail
export const LIST_ROW_THUMBNAIL: ThumbnailSizing = {
  widths: [256, 400],
  sizes: "128px",
};

// Component page sidebar: 240px on desktop, full width when stacked
export const DETAIL_THUMBNAIL: ThumbnailSizing = {
  widths: [480, 720, 1080],
  sizes: "(min-width: 1024px) 240px, 100vw",
};

// If the CDN variant fails for any reason, show the original image instead.
// The guard records which URL fell back, because React reuses the element
// when a thumbnail changes and the new one needs its own fallback.
function fallBackToOriginal(img: HTMLImageElement, originalUrl: string) {
  if (img.dataset.originalFallback === originalUrl) return;
  img.dataset.originalFallback = originalUrl;
  img.removeAttribute("srcset");
  img.removeAttribute("sizes");
  img.src = originalUrl;
}

// Props for a thumbnail <img>: resized variants when possible, otherwise the
// original URL untouched.
export function thumbnailImageProps(url: string, sizing: ThumbnailSizing) {
  const id = storageIdFromUrl(url);
  if (!id) return { src: url };
  const variant = (width: number) => `/components/_img/${width}/${id}`;
  return {
    src: variant(sizing.widths[Math.floor(sizing.widths.length / 2)]),
    srcSet: sizing.widths.map((w) => `${variant(w)} ${w}w`).join(", "),
    sizes: sizing.sizes,
    onError: (event: SyntheticEvent<HTMLImageElement>) =>
      fallBackToOriginal(event.currentTarget, url),
  };
}

// GitHub avatars are stored as https://github.com/<name>.png, which redirects
// to the full-size image (often 460px, ~60 KB) for a 16-28px slot. ?size=
// keeps the redirect but returns a small image. The direct
// avatars.githubusercontent.com/<name> form is not used because it returns a
// placeholder for organisations such as convex.
// Renamed orgs (get-convex) 404 on the old .png, so the owner is mapped first.
const GITHUB_AVATAR_RE = /^https:\/\/github\.com\/([^/?#]+)\.png$/;
const AVATAR_SIZE = 64;

export function avatarUrl(url: string): string {
  const match = url.match(GITHUB_AVATAR_RE);
  if (!match) return url;
  return `https://github.com/${canonicalGithubOwner(match[1])}.png?size=${AVATAR_SIZE}`;
}
