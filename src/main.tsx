import { createRoot } from "react-dom/client";
import { Component, Suspense, lazy, useEffect, useMemo, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { ConvexReactClient, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { ConvexProviderWithAuthKit } from "@convex-dev/workos";
import "./index.css";
import { api } from "../convex/_generated/api";
// Indexed routes (sitemap: /components, /submit, and slugs) stay eagerly
// imported so crawlers never wait on a lazy chunk. ComponentDetail also
// injects JSON-LD client side and must render immediately.
import Directory from "./pages/Directory";
import CategoryPage from "./pages/CategoryPage";
import SubmitForm from "./pages/SubmitForm";
import ComponentDetail from "./pages/ComponentDetail";
import NotFound from "./pages/NotFound";
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

function Router() {
  const { pathname: path } = useLocation();
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
    return <SubmitForm />;
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
      return (
        <PageErrorBoundary key={slug}>
          <ComponentDetail slug={slug} />
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

// In-app navigation for links to directory pages. Hovering or touching a
// component link starts loading its data and the README renderer.
installNavigation((pathname) => {
  const slug = slugFromPathname(pathname);
  if (slug) {
    prefetchComponent(slug);
    preloadMarkdown();
  }
});

createRoot(document.getElementById("root")!).render(
  <>
    <ConnectAuthProvider>
      <ConvexProviderWithAuthKit client={convex} useAuth={useConnectAuth}>
        <div className="antialiased min-h-screen flex flex-col">
          <div className="flex-1">
            {/* Fallback reserves full viewport height so lazy route chunks
                loading in does not shift the footer or cause CLS */}
            <Suspense fallback={<div className="min-h-screen" />}>
              <Router />
            </Suspense>
          </div>
          <div className="pt-[50px]">
            <Footer />
          </div>
        </div>
      </ConvexProviderWithAuthKit>
    </ConnectAuthProvider>
    <DeferredWebAnalytics />
  </>
);
