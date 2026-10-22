import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Netlify reads _headers and _redirects from the publish root (dist/), but
// Vite builds into dist/components and would copy public/ files there, where
// Netlify never sees them. Copy the rules files from netlify/ after the build
// into the folder above outDir: dist/ by default, or the parent of a custom
// --outDir.
function netlifyRootFiles(): Plugin {
  let publishRoot = "";
  return {
    name: "netlify-root-files",
    apply: "build",
    configResolved(config) {
      publishRoot = path.dirname(
        path.resolve(config.root, config.build.outDir),
      );
    },
    closeBundle(error) {
      // Rollup calls this when the build fails too, and a copy error thrown
      // here would be reported instead of the real one
      if (error) return;
      for (const file of ["_headers", "_redirects"]) {
        fs.copyFileSync(
          path.resolve(__dirname, "netlify", file),
          path.resolve(publishRoot, file),
        );
      }
    },
  };
}

// Content Security Policy for the app's HTML, as a <meta> tag added at build
// time. A header would not reach the pages: every HTML route goes through the
// og-meta edge function, and netlify/_headers rules skip edge function
// responses. The meta tag travels inside the HTML, through og-meta and the
// www.convex.dev proxy.
//
// script-src is what matters: injected markup (an <iframe srcdoc> inherits
// this policy) can't run inline script or load script from another origin.
// Inline scripts in index.html are allowed by hash, computed here after Vite
// has filled in the %VITE_*% values. PostHog (@convex-internal/web-analytics)
// loads its config and extensions from https://ap.convex.dev, and session
// replay may start a blob: worker.
function contentSecurityPolicy(): Plugin {
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const inlineScripts = html.matchAll(
          /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g,
        );
        const hashes = [...inlineScripts].map(
          ([, body]) =>
            `'sha256-${crypto.createHash("sha256").update(body).digest("base64")}'`,
        );
        const policy = [
          ["script-src", "'self'", ...hashes, "https://ap.convex.dev"],
          ["worker-src", "'self'", "blob:"],
          ["object-src", "'none'"],
          ["base-uri", "'self'"],
        ]
          .map((directive) => directive.join(" "))
          .join("; ");
        return {
          html,
          tags: [
            {
              tag: "meta",
              attrs: { "http-equiv": "Content-Security-Policy", content: policy },
              injectTo: "head-prepend",
            },
          ],
        };
      },
    },
  };
}

// The component page is a lazy chunk, so a visit that lands on one (search
// results, README badges) would only learn its URL once the entry has
// downloaded and run, then wait another round trip for it. This adds a small
// inline script to the built index.html that, on component page paths only,
// adds <link rel="modulepreload"> tags for that chunk and the small chunks it
// imports statically, so they download alongside the entry. Its dynamic
// imports (the README renderer and shiki) are left to load as before.
//
// The path test mirrors the router: /components/<slug> or
// /components/<scope>/<name>, minus the routes in NON_SLUG_ROUTES
// (src/main.tsx), RESERVED_ROUTES (src/lib/slugs.ts) and the non-app
// prefixes and file names in isAppPath (src/lib/router.ts). Getting it wrong
// only costs a wasted or a missed preload.
//
// It runs as a "post" HTML hook, where the bundle is known, and is listed
// before contentSecurityPolicy so its script gets hashed too.
function componentPagePreload(): Plugin {
  let base = "/";
  return {
    name: "component-page-preload",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle || !ctx.chunk) return html;
        const page = Object.values(bundle).find(
          (output) =>
            output.type === "chunk" &&
            output.facadeModuleId?.endsWith("/src/pages/ComponentDetail.tsx"),
        );
        if (!page || page.type !== "chunk") {
          throw new Error("component-page-preload: ComponentDetail chunk not found");
        }
        // The page chunk and everything it imports statically, minus what the
        // entry already loads
        const alreadyLoaded = new Set([ctx.chunk.fileName, ...ctx.chunk.imports]);
        const files: string[] = [];
        const add = (fileName: string) => {
          if (alreadyLoaded.has(fileName) || files.includes(fileName)) return;
          files.push(fileName);
          const output = bundle[fileName];
          if (output?.type === "chunk") output.imports.forEach(add);
        };
        add(page.fileName);
        const urls = JSON.stringify(files.map((file) => base + file));
        const script = `<script>
      (function () {
        var path = location.pathname;
        var match = path.match(/^\\/components\\/([^/]+)(?:\\/[^/]+)?\\/?$/);
        if (
          !match ||
          /^(callback|submissions|submit|profile|documentation|dashboard|badge|categories|assets|fonts|images|_img|_src|api)$/.test(match[1]) ||
          /\\.[a-z0-9]+$/i.test(path)
        ) {
          return;
        }
        ${urls}.forEach(function (href) {
          var link = document.createElement("link");
          link.rel = "modulepreload";
          link.href = href;
          document.head.appendChild(link);
        });
      })();
    </script>
    `;
        // Before the entry <script> and the stylesheet: an inline script
        // after a stylesheet waits for the CSS to download before it runs
        const entryTag = html.indexOf(`<script type="module" crossorigin src="${base}${ctx.chunk.fileName}"`);
        if (entryTag === -1) {
          throw new Error("component-page-preload: entry script tag not found");
        }
        return html.slice(0, entryTag) + script + html.slice(entryTag);
      },
    },
  };
}

export default defineConfig({
  // All URLs under /components/ (HTML, assets, routing)
  base: "/components/",
  build: {
    outDir: "dist/components",
    rollupOptions: {
      // convex's package.json says "sideEffects": false, but Vite only applies
      // that to bare imports like "convex/values". Relative imports inside
      // convex read convex/dist/esm/package.json, which has no sideEffects
      // field. Rollup keeps whichever import of a file resolves first, so
      // chunk contents and hashes changed between builds of the same code.
      treeshake: {
        moduleSideEffects: (id) => !id.includes("/node_modules/convex/"),
      },
    },
  },
  plugins: [
    react(),
    netlifyRootFiles(),
    componentPagePreload(),
    contentSecurityPolicy(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
