import { createRoot } from "react-dom/client";
import { Component, Suspense, lazy, use, useEffect, useMemo, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { ConvexReactClient, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { ConvexProviderWithAuthKit } from "@convex-dev/workos";
import "./index.css";
import { api } from "../convex/_generated/api";
// The directory and category pages are what most visits land on, so they stay
// in the entry bundle. The og-meta edge function puts each page's title,
// description and canonical link in the HTML, and crawlers that run JS wait
// for lazy chunks like any other request (ComponentDetail's JSON-LD already
// waited on its data), so indexed pages can load on demand too.
import Directory from "./pages/Directory";
import CategoryPage from "./pages/CategoryPage";
import NotFound from "./pages/NotFound";
import ComponentDetailSkeleton from "./components/ComponentDetailSkeleton";
import Header from "./components/Header";
import { chunkLoader } from "./lib/chunkLoader";
// The public submit form brings sonner, the markdown preview and its own
// icons, none of which the directory needs. Hovering or touching a Submit
// link starts it early, and it's read with use() like the component page
// (see chunkLoader.ts) so a preloaded form opens without a blank frame.
const submitFormChunk = chunkLoader(() => import("./pages/SubmitForm"));
// Admin, auth-gated, and noindex routes load on demand. This keeps the ~17k
// lines of admin/profile code out of the initial bundle every visitor downloads.
const Submit = lazy(() => import("./pages/Submit"));
const SubmitCheck = lazy(() => import("./pages/SubmitCheck"));
const Admin = lazy(() => import("./pages/Admin"));
const Profile = lazy(() => import("./pages/Profile"));
const ProfileEditSubmission = lazy(() => import("./pages/ProfileEditSubmission"));
const Documentation = lazy(() => import("./pages/Documentation"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
import DeferredWebAnalytics from "./components/DeferredWebAnalytics";
import Footer from "./components/Footer";
import AccountStatusGuard from "./components/AccountStatusGuard";
import { isReservedRoute, parseSlugFromPath } from "./lib/slugs";
import { ConnectAuthProvider, useConnectAuth } from "./lib/connectAuth";
import {
  installNavigation,
  navigate,
  useLocation,
  useScrollOnNavigate,
} from "./lib/router";
import { prefetchComponent } from "./lib/convexHttp";
import { preloadMarkdown } from "./lib/markdownChunk";
import {
  componentDetailChunk,
  preloadComponentDetail,
} from "./lib/componentDetailChunk";

class PageErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[PageErrorBoundary]", error, info);
  }
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <p className="text-sm text-text-secondary mb-4">
              Something went wrong loading this page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-full text-sm font-normal bg-button text-white hover:bg-button-hover transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// No trailing slash: www.convex.dev redirects /components/ to /components
const DIRECTORY_ROOT_HREF = "/components";

// verbose logging removed: it wrote every websocket message to the production
// console (flagged by Lighthouse Best Practices and real main-thread cost)
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// Route mapping for the components directory
// Production: Netlify at components-directory.netlify.app/components/*
// Local dev: localhost:5173/components/*
// Top-level routes that are never component slugs
const NON_SLUG_ROUTES = new Set([
  "callback",
  "submissions",
  "submit",
  "profile",
  "documentation",
  "dashboard",
  "badge",
  "categories",
]);

// The component slug a /components path points at, or null for other pages
function slugFromPathname(pathname: string): string | null {
  const segments = pathname
    .slice("/components".length)
    .split("/")
    .filter((s) => s.length > 0);
  if (
    segments.length === 0 ||
    segments.length > 2 ||
    NON_SLUG_ROUTES.has(segments[0]) ||
    isReservedRoute(segments[0])
  ) {
    return null;
  }
  return parseSlugFromPath(segments) || null;
}

// Component pages load their chunk on demand (see componentDetailChunk.ts).
// use() renders straight away when the chunk is already here, and the
// skeleton the page shows while its data loads covers the wait otherwise.
// A chunk that fails to load (offline, or a tab left open across a deploy)
// throws to the PageErrorBoundary around it.
function ComponentDetailRoute({
  slug,
  entryKey,
}: {
  slug: string;
  entryKey: string;
}) {
  const { default: ComponentDetail } = use(componentDetailChunk.read(entryKey));
  return <ComponentDetail slug={slug} />;
}

function SubmitFormRoute({ entryKey }: { entryKey: string }) {
  const { default: SubmitForm } = use(submitFormChunk.read(entryKey));
  return <SubmitForm />;
}

function Router() {
  const { pathname: path, entryKey } = useLocation();
  useScrollOnNavigate();

  // Category URLs need exactly one slug; anything else (bare or with extra
  // segments) goes to the directory
  const categorySegments = path.startsWith("/components/categories")
    ? path.slice("/components/".length).split("/").filter(Boolean)
    : [];
  const isMalformedCategoryPath =
    categorySegments[0] === "categories" && categorySegments.length !== 2;
  useEffect(() => {
    if (isMalformedCategoryPath) {
      navigate(DIRECTORY_ROOT_HREF, { replace: true });
    }
  }, [isMalformedCategoryPath]);

  // Always use /components as base path (both local and production)
  const basePath = "/components";

  // Redirect paths that don't start with /components to the prefixed version
  if (!path.startsWith(basePath)) {
    const redirectPath = DIRECTORY_ROOT_HREF + (path === "/" ? "" : path);
    window.location.replace(redirectPath);
    return null;
  }

  const normalizedPath = path.slice(basePath.length) || "/";

  // Split path into segments (filter empty strings)
  const segments = normalizedPath
    .split("/")
    .filter((s) => s.length > 0);

  // Handle OAuth callback route (kept for post-auth redirect handling)
  if (segments[0] === "callback") {
    return <AuthCallback />;
  }

  // No segments: directory listing (public)
  if (segments.length === 0) {
    return <Directory />;
  }

  // Submissions routes
  if (segments[0] === "submissions") {
    // /submissions/admin = Admin dashboard (requires @convex.dev email)
    if (segments.length === 2 && segments[1] === "admin") {
      return <Admin />;
    }
    // /submissions = Submissions directory (admin only, others go to /components)
    return <SubmissionsGate />;
  }

  // /submit/check = Public preflight checker
  if (segments[0] === "submit" && segments[1] === "check") {
    return <SubmitCheck />;
  }

  // /submit = Auth-gated submission form
  if (segments[0] === "submit") {
    // The header stays put while the form's chunk loads
    return (
      <PageErrorBoundary>
        <Suspense fallback={<Header />}>
          <SubmitFormRoute entryKey={entryKey} />
        </Suspense>
      </PageErrorBoundary>
    );
  }

  // Profile page for managing user submissions
  if (segments[0] === "profile") {
    if (segments.length === 3 && segments[1] === "edit") {
      return <ProfileEditSubmission packageId={segments[2]} />;
    }
    return <Profile />;
  }

  // Documentation routes (admin only, handled in component)
  if (segments[0] === "documentation") {
    const section = segments.length >= 2 ? segments[1] : undefined;
    return <Documentation section={section} />;
  }

  // Dashboard route (admin only, handled in component)
  if (segments[0] === "dashboard") {
    return <Dashboard />;
  }

  // Badge routes are handled server-side (Convex HTTP), never reach here
  if (segments[0] === "badge") {
    return <NotFound />;
  }

  // Category pages: /components/categories/:slug
  if (segments[0] === "categories") {
    if (segments.length === 2) {
      // Keyed so moving between categories starts fresh (or from cache)
      return <CategoryPage key={segments[1]} categorySlug={segments[1]} />;
    }
    // Malformed category paths are redirected by the effect above
    return null;
  }

  // Everything else is a slug lookup (single or two-segment)
  if (segments.length <= 2 && !isReservedRoute(segments[0])) {
    const slug = parseSlugFromPath(segments);
    if (slug) {
      // Keyed so an error on one component resets when moving to another
      // (and that navigation retries a chunk that failed to load)
      return (
        <PageErrorBoundary key={slug}>
          <Suspense fallback={<ComponentDetailSkeleton />}>
            <ComponentDetailRoute slug={slug} entryKey={entryKey} />
          </Suspense>
        </PageErrorBoundary>
      );
    }
  }

  return <NotFound />;
}

// /submissions is admin only (@convex.dev email). Everyone else, logged in or
// not, is sent to the directory root. Waits for auth and the admin check to
// settle so admins are not bounced to /components during token load on a hard
// refresh.
function SubmissionsGate() {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const isAdmin = useQuery(api.auth.isAdmin);
  const isChecking =
    authLoading || (isAuthenticated && isAdmin === undefined);
  const shouldRedirect = !isChecking && !isAdmin;

  useEffect(() => {
    if (shouldRedirect) {
      navigate(DIRECTORY_ROOT_HREF, { replace: true });
    }
  }, [shouldRedirect]);

  if (isChecking || shouldRedirect) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-button"></div>
      </div>
    );
  }

  return <Submit />;
}

// Callback component handles post-OAuth redirect
function AuthCallback() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { isLoading: connectLoading, signIn } = useConnectAuth();
  const [authFailed, setAuthFailed] = useState(false);
  const hasAuthCode = useMemo(
    () => new URLSearchParams(window.location.search).has("code"),
    []
  );
  
  // Get the return path from localStorage (set before sign-in) or default to submit
  const returnPath = useMemo(() => {
    const storedPath = localStorage.getItem("authReturnPath");
    
    // Clear the stored path after reading
    if (storedPath) {
      localStorage.removeItem("authReturnPath");
      return storedPath;
    }
    
    // Default to submit page (always under /components)
    return "/components/submit";
  }, []);

  useEffect(() => {
    // Wait for auth to finish loading
    if (isLoading || connectLoading) {
      return;
    }

    // Redirect after authenticated session is established
    if (isAuthenticated) {
      window.location.replace(returnPath);
      return;
    }

    // If we had a callback code but still not authenticated, auth exchange failed
    if (hasAuthCode) {
      setAuthFailed(true);
      return;
    }

    // Callback route without code: send user back to the return path
    window.location.replace(returnPath);
  }, [connectLoading, hasAuthCode, isLoading, returnPath, isAuthenticated]);

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="text-center px-4">
        <div className="text-sm text-text-secondary mb-4">
          {authFailed ? "Sign in could not be completed." : "Finishing sign in..."}
        </div>
        {authFailed && (
          <button
            onClick={() => void signIn()}
            className="px-4 py-2 rounded-full text-sm font-normal bg-button text-white hover:bg-button-hover transition-colors">
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

// Prevent browser from restoring previous scroll position on full-page navigations
history.scrollRestoration = "manual";
window.scrollTo(0, 0);

// Start loading a page before it renders. A component page needs its data,
// the page chunk and the README renderer, fetched in parallel rather than one
// after another. The submit form only needs its chunk.
function prefetchPage(pathname: string) {
  if (pathname.replace(/\/+$/, "") === "/components/submit") {
    // A failure shows up when the page renders and reads the chunk
    submitFormChunk.preload().catch(() => {});
    return;
  }
  const slug = slugFromPathname(pathname);
  if (slug) {
    prefetchComponent(slug);
    preloadComponentDetail();
    preloadMarkdown();
  }
}

// A page opened directly starts all of it now, while React renders
prefetchPage(window.location.pathname);

// In-app navigation for links to directory pages. Hovering or touching a
// component or Submit link starts loading the same things.
installNavigation(prefetchPage);

const app = (
  <>
    <ConnectAuthProvider>
      <ConvexProviderWithAuthKit client={convex} useAuth={useConnectAuth}>
        <div className="antialiased min-h-screen flex flex-col">
          <div className="flex-1">
            {/* Fallback reserves full viewport height so lazy route chunks
                loading in does not shift the footer or cause CLS. It keeps
                the header, so the static header in index.html doesn't
                vanish while a route's chunk loads. */}
            <Suspense
              fallback={
                <div className="min-h-screen bg-bg-primary">
                  <Header />
                </div>
              }
            >
              <Router />
            </Suspense>
          </div>
          <div className="pt-[50px]">
            <Footer />
          </div>
        </div>
        <AccountStatusGuard />
      </ConvexProviderWithAuthKit>
    </ConnectAuthProvider>
    <DeferredWebAnalytics />
  </>
);
const root = createRoot(document.getElementById("root")!);
const renderApp = () => root.render(app);

if (slugFromPathname(window.location.pathname)) {
  // A component page opened directly waits for its chunk (already requested
  // above, and preloaded by index.html) before the first render. Rendering
  // first would commit the skeleton fallback, and React then holds the page
  // back until ~300ms after that commit, longer than the data takes for
  // visitors near the deployment. Whatever is in #root stays up meanwhile,
  // and a failed load still renders, so the error boundary shows it.
  componentDetailChunk.preload().then(renderApp, renderApp);
} else {
  renderApp();
}
