// Category landing page at /components/categories/:slug
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ComponentCard } from "../components/ComponentCard";
import { CategorySidebar } from "../components/CategorySidebar";
import { SearchBar } from "../components/SearchBar";
import Header from "../components/Header";
import { setPageTitle, setPageDescription } from "../lib/seo";
import {
  CATALOG_REFRESH_AFTER_MS,
  fetchDirectoryPage,
  getCachedDirectoryPage,
  type DirectoryPageData,
} from "../lib/convexHttp";
import {
  navigate,
  readEntryState,
  useEntryState,
  useLocation,
} from "../lib/router";
import {
  CaretSortIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
} from "@radix-ui/react-icons";
import { Robot, FileText, ArrowSquareOut } from "@phosphor-icons/react";
import { buildCategoryClientUrls } from "../../shared/categoryUrls";

type SortBy = "newest" | "downloads" | "updated" | "rating" | "verified";

// No trailing slash: www.convex.dev redirects /components/ to /components
const DIRECTORY_ROOT_HREF = "/components";

interface CategoryPageProps {
  categorySlug: string;
}

const getGridColumnCount = (): number => {
  if (typeof window === "undefined") return 4;
  if (window.innerWidth < 640) return 1;
  if (window.innerWidth < 1024) return 2;
  if (window.innerWidth < 1280) return 3;
  return 4;
};

const ITEMS_PER_PAGE = 24;

// Search, sort and page saved with the history entry, so Back to a category
// shows the same cards before its scroll position is restored
interface CategoryHistoryState {
  searchTerm: string;
  sortBy: SortBy;
  currentPage: number;
}
const CATEGORY_HISTORY_KEY = "category";

export default function CategoryPage({ categorySlug }: CategoryPageProps) {
  const [restored] = useState(() =>
    readEntryState<CategoryHistoryState>(CATEGORY_HISTORY_KEY),
  );
  const [searchTerm, setSearchTerm] = useState(restored?.searchTerm ?? "");
  const [sortBy, setSortBy] = useState<SortBy>(restored?.sortBy ?? "downloads");
  const [sortOpen, setSortOpen] = useState(false);
  const [gridColumns, setGridColumns] = useState<number>(getGridColumnCount);
  const [currentPage, setCurrentPage] = useState(restored?.currentPage ?? 1);
  useEntryState(CATEGORY_HISTORY_KEY, { searchTerm, sortBy, currentPage });
  const desktopSortRef = useRef<HTMLDivElement>(null);
  const mobileSortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedOutsideDesktop =
        !desktopSortRef.current || !desktopSortRef.current.contains(target);
      const clickedOutsideMobile =
        !mobileSortRef.current || !mobileSortRef.current.contains(target);
      if (clickedOutsideDesktop && clickedOutsideMobile) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const onResize = () => setGridColumns(getGridColumnCount());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Reset page when search or sort changes, but not for the values just
  // restored on mount, so a restored page survives Back
  const restoredControls = useRef<{
    searchTerm: string;
    sortBy: SortBy;
  } | null>({ searchTerm, sortBy });
  useEffect(() => {
    const restoredNow =
      restoredControls.current?.searchTerm === searchTerm &&
      restoredControls.current?.sortBy === sortBy;
    restoredControls.current = null;
    if (restoredNow) return;
    setCurrentPage(1);
    if (searchTerm) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [searchTerm, sortBy]);

  // Moving to another history entry while this category stays mounted (a
  // link to the page you're on starts it over, and Back/Forward past an
  // in-page #anchor): restore that entry's saved controls, or the defaults
  const { entryKey } = useLocation();
  const lastEntryKey = useRef(entryKey);
  useEffect(() => {
    if (entryKey === lastEntryKey.current) return;
    lastEntryKey.current = entryKey;
    const saved = readEntryState<CategoryHistoryState>(CATEGORY_HISTORY_KEY);
    const nextSearchTerm = saved?.searchTerm ?? "";
    const nextSortBy = saved?.sortBy ?? "downloads";
    restoredControls.current = {
      searchTerm: nextSearchTerm,
      sortBy: nextSortBy,
    };
    setSearchTerm(nextSearchTerm);
    setSortBy(nextSortBy);
    setCurrentPage(saved?.currentPage ?? 1);
  }, [entryKey]);

  // One-shot fetches for public catalog data (no reactive subscription
  // overhead). A catalog loaded earlier in this session renders straight away.
  const [cached] = useState(() => getCachedDirectoryPage(sortBy, categorySlug));
  const [categoryData, setCategoryData] = useState<any | undefined>(
    cached ? cached.data.categoryData : undefined,
  );
  const [categories, setCategories] = useState<any[] | undefined>(
    cached?.data.categories,
  );
  const [components, setComponents] = useState<any[] | undefined>(
    cached?.data.components,
  );
  const [downloadsDisplay, setDownloadsDisplay] = useState<{
    showWeeklyDownloads: boolean;
    showAllTimeDownloads: boolean;
  }>(
    cached?.data.downloadsDisplay ?? {
      showWeeklyDownloads: true,
      showAllTimeDownloads: false,
    },
  );

  const applyData = useCallback((data: DirectoryPageData) => {
    setCategoryData(data.categoryData);
    setCategories(data.categories);
    setComponents(data.components);
    setDownloadsDisplay(data.downloadsDisplay);
  }, []);

  const fetchGeneration = useRef(0);
  // Aborted when a newer load starts, so a superseded one stops retrying
  const loadController = useRef<AbortController | null>(null);
  const fetchData = useCallback(async () => {
    const gen = ++fetchGeneration.current;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    try {
      const data = await fetchDirectoryPage(
        sortBy,
        categorySlug,
        controller.signal,
      );
      if (gen !== fetchGeneration.current) return;
      applyData(data);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("[CategoryPage] Failed to load components", error);
    }
  }, [categorySlug, sortBy, applyData]);

  useEffect(() => {
    // Use this sort's cached catalog straight away and only refetch when it's
    // missing or stale. Bumping the generation drops older requests.
    const cachedPage = getCachedDirectoryPage(sortBy, categorySlug);
    if (cachedPage) {
      fetchGeneration.current += 1;
      loadController.current?.abort();
      applyData(cachedPage.data);
      if (Date.now() - cachedPage.loadedAt < CATALOG_REFRESH_AFTER_MS) return;
    }
    void fetchData();
  }, [fetchData, sortBy, categorySlug, applyData]);

  useEffect(() => () => loadController.current?.abort(), []);

  // Set page SEO based on category
  useEffect(() => {
    if (categoryData) {
      setPageTitle(`${categoryData.label} Components`);
      setPageDescription(
        categoryData.description ||
          `Browse ${categoryData.label} components for Convex.`,
      );
    }
  }, [categoryData]);

  // Client-side search filtering
  const filteredComponents = useMemo(() => {
    if (!components) return [];
    if (!searchTerm.trim()) return components;

    const term = searchTerm.toLowerCase();
    return components.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.description.toLowerCase().includes(term) ||
        (c.shortDescription &&
          c.shortDescription.toLowerCase().includes(term)) ||
        (c.tags &&
          c.tags.some((t: string) => t.toLowerCase().includes(term))) ||
        (c.authorUsername && c.authorUsername.toLowerCase().includes(term)),
    );
  }, [components, searchTerm]);

  // Pagination. A restored page (or the one you were on when the catalog
  // refreshed) can be past the end if the category shrank, so clamp it.
  const totalPages = Math.ceil(filteredComponents.length / ITEMS_PER_PAGE);
  const page = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedComponents = useMemo(() => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    return filteredComponents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredComponents, page]);

  const directoryCardHoverClass =
    "hover:bg-[rgb(246_238_219/var(--tw-bg-opacity,1))]";

  const agentFileUrls = categoryData
    ? buildCategoryClientUrls(
        categoryData.slug,
        window.location.origin,
        import.meta.env.VITE_CONVEX_URL as string | undefined,
      )
    : null;

  const clearSearch = () => {
    setSearchTerm("");
    setCurrentPage(1);
  };

  // Handle category not found
  if (categoryData === null) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <div className="text-center py-16">
            <h1 className="text-2xl font-semibold text-text-primary mb-2">
              Category not found
            </h1>
            <p className="text-sm text-text-secondary mb-6">
              The category you're looking for doesn't exist or has been
              disabled.
            </p>
            <a
              href={DIRECTORY_ROOT_HREF}
              className="inline-flex items-center gap-2 text-sm font-medium text-text-primary hover:text-text-secondary transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Back to Components
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header />

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <nav className="flex items-center gap-2 text-sm">
          <a
            href={DIRECTORY_ROOT_HREF}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            Components
          </a>
          <span className="text-text-tertiary">/</span>
          <span className="text-text-primary font-medium">
            {categoryData?.label || categorySlug}
          </span>
        </nav>
      </div>

      {/* Page header */}
      <header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-4">
          <h1 className="text-2xl font-semibold text-text-primary mb-1">
            {categoryData?.label || categorySlug}
          </h1>
          <p className="text-sm text-text-secondary">
            {categoryData?.description || "Browse components in this category."}
          </p>
          {categoryData && (
            <p className="text-xs text-text-tertiary mt-2">
              {categoryData.count}{" "}
              {categoryData.count === 1 ? "component" : "components"}
              {categoryData.verifiedCount > 0 && (
                <span> · {categoryData.verifiedCount} verified</span>
              )}
            </p>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden lg:block w-52 shrink-0 lg:pt-4">
            <div className="sticky top-20">
              {/* Back to all */}
              <div className="pb-6">
                <a
                  href={DIRECTORY_ROOT_HREF}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                  All Components
                </a>
              </div>

              {/* Search (scoped to this category) */}
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={`Search in ${categoryData?.label || "category"}...`}
                inputClassName="bg-white border border-border"
              />

              {/* Sort */}
              <div className="mt-3" ref={desktopSortRef}>
                <div className="relative">
                  <button
                    onClick={() => setSortOpen(!sortOpen)}
                    className="w-full flex items-center justify-between gap-2 text-sm bg-bg-primary rounded-md px-3 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-button cursor-pointer border border-border transition-colors"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CaretSortIcon className="w-4 h-4 text-text-secondary" />
                      <span>
                        {sortBy === "downloads"
                          ? "Most downloads"
                          : sortBy === "newest"
                            ? "Newest"
                            : sortBy === "verified"
                              ? "Verified"
                              : sortBy === "rating"
                                ? "Highest rated"
                                : "Recently updated"}
                      </span>
                    </span>
                    <ChevronDownIcon
                      className={`w-3.5 h-3.5 text-text-secondary transition-transform ${sortOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {sortOpen && (
                    <div className="absolute left-0 top-full mt-1 w-full rounded-lg border border-border bg-white shadow-lg py-1 z-30">
                      {[
                        {
                          value: "downloads" as const,
                          label: "Most downloads",
                        },
                        { value: "newest" as const, label: "Newest" },
                        { value: "verified" as const, label: "Verified" },
                        {
                          value: "updated" as const,
                          label: "Recently updated",
                        },
                        { value: "rating" as const, label: "Highest rated" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setSortBy(opt.value);
                            setSortOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-bg-hover ${
                            sortBy === opt.value
                              ? "text-text-primary font-medium"
                              : "text-text-secondary"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Other categories */}
              <div className="mt-5">
                {categories && (
                  <CategorySidebar
                    categories={categories}
                    selectedCategory={categorySlug}
                    onSelectCategory={(cat) => {
                      if (cat === null) {
                        navigate(DIRECTORY_ROOT_HREF);
                      } else {
                        navigate(`/components/categories/${cat}`);
                      }
                    }}
                    linkMode={true}
                  />
                )}
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {/* Mobile: search + sort row */}
            <div className="lg:hidden flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
              <div className="w-full sm:w-auto flex items-center gap-2">
                <SearchBar
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder={`Search in ${categoryData?.label || "category"}...`}
                  inputClassName="bg-white border border-border"
                />
              </div>
              <div ref={mobileSortRef} className="relative">
                <button
                  onClick={() => setSortOpen(!sortOpen)}
                  className="flex items-center gap-2 text-sm bg-bg-primary rounded-md px-3 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-button cursor-pointer border border-transparent hover:border-border transition-colors"
                >
                  <CaretSortIcon className="w-4 h-4 text-text-secondary" />
                  <span>
                    {sortBy === "downloads"
                      ? "Most downloads"
                      : sortBy === "newest"
                        ? "Newest"
                        : sortBy === "verified"
                          ? "Verified"
                          : sortBy === "rating"
                            ? "Highest rated"
                            : "Recently updated"}
                  </span>
                  <ChevronDownIcon
                    className={`w-3.5 h-3.5 text-text-secondary transition-transform ${sortOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {sortOpen && (
                  <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-white shadow-lg py-1 z-30">
                    {[
                      { value: "downloads" as const, label: "Most downloads" },
                      { value: "newest" as const, label: "Newest" },
                      { value: "verified" as const, label: "Verified" },
                      { value: "updated" as const, label: "Recently updated" },
                      { value: "rating" as const, label: "Highest rated" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setSortBy(opt.value);
                          setSortOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-bg-hover ${
                          sortBy === opt.value
                            ? "text-text-primary font-medium"
                            : "text-text-secondary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile category chips */}
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-4 mb-4 -mx-1 px-1">
              <a
                href={DIRECTORY_ROOT_HREF}
                className="shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors bg-bg-secondary text-text-secondary"
              >
                All
              </a>
              {categories?.map((cat) => (
                <a
                  key={cat.category}
                  href={`/components/categories/${cat.category}`}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    categorySlug === cat.category
                      ? "bg-text-primary text-white"
                      : "bg-bg-secondary text-text-secondary"
                  }`}
                >
                  {cat.label} ({cat.count})
                </a>
              ))}
            </div>

            {/* Loading state */}
            {!components && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-white p-4 animate-pulse"
                  >
                    <div className="h-4 bg-bg-secondary rounded w-3/4 mb-2" />
                    <div className="h-3 bg-bg-secondary rounded w-full mb-1" />
                    <div className="h-3 bg-bg-secondary rounded w-2/3" />
                  </div>
                ))}
              </div>
            )}

            {/* No results */}
            {components && filteredComponents.length === 0 && (
              <div className="text-center py-16 text-text-secondary">
                <p className="text-lg mb-1">No components found</p>
                <p className="text-sm">
                  {searchTerm
                    ? "Try a different search term"
                    : "No approved components in this category yet"}
                </p>
                {searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="mt-4 inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}

            {/* Component grid */}
            {components && paginatedComponents.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {paginatedComponents.map((comp) => (
                    <ComponentCard
                      key={comp._id}
                      name={comp.name}
                      componentName={comp.componentName}
                      slug={comp.slug}
                      shortDescription={comp.shortDescription}
                      description={comp.description}
                      category={comp.category}
                      thumbnailUrl={comp.thumbnailUrl}
                      showThumbnail={
                        !categoryData?.hideThumbnails &&
                        (categoryData?.showAllThumbnails ||
                          !comp.hideThumbnailInCategory)
                      }
                      authorUsername={comp.authorUsername}
                      authorAvatar={comp.authorAvatar}
                      weeklyDownloads={comp.weeklyDownloads}
                      allTimeDownloads={comp.allTimeDownloads}
                      showWeeklyDownloads={downloadsDisplay.showWeeklyDownloads}
                      showAllTimeDownloads={
                        downloadsDisplay.showAllTimeDownloads
                      }
                      convexVerified={comp.convexVerified}
                      communitySubmitted={comp.communitySubmitted}
                      curatedBadges={comp.curatedBadges}
                      featured={comp.featured}
                      npmUrl={comp.npmUrl}
                      repositoryUrl={comp.repositoryUrl}
                      className={directoryCardHoverClass}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 text-sm rounded-md border border-border bg-white text-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-secondary transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-text-secondary px-3">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentPage(Math.min(totalPages, page + 1))
                      }
                      disabled={page === totalPages}
                      className="px-3 py-1.5 text-sm rounded-md border border-border bg-white text-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-secondary transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}

            {/* For Agents: machine-readable lists of this category, rendered
                live from the catalog so they track new and renamed components */}
            {categoryData && agentFileUrls && (
              <section className="mt-12 pt-8 border-t border-border">
                <h2 className="text-lg font-semibold text-text-primary mb-2">
                  For Agents
                </h2>
                <p className="text-sm text-text-secondary mb-4">
                  AI agents and coding assistants can read every{" "}
                  {categoryData.label} component from these machine-readable
                  files. They update automatically as components are added to
                  this category.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={agentFileUrls.llmsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    <Robot size={16} />
                    {categoryData.slug}-llms.txt
                    <ArrowSquareOut size={14} className="text-text-tertiary" />
                  </a>
                  <a
                    href={agentFileUrls.markdownUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    <FileText size={16} />
                    {categoryData.slug}.md
                    <ArrowSquareOut size={14} className="text-text-tertiary" />
                  </a>
                </div>
                <p className="text-xs text-text-tertiary mt-4">
                  Looking for every category? Use the full directory{" "}
                  <a
                    href="/components/llms.txt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-text-primary transition-colors"
                  >
                    llms.txt
                  </a>{" "}
                  or{" "}
                  <a
                    href="/components/components.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-text-primary transition-colors"
                  >
                    components.md
                  </a>
                  .
                </p>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
