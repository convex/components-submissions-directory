// Main directory listing page at /components
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ComponentCard } from "../components/ComponentCard";
import { ComponentListRow } from "../components/ComponentListRow";
import { CategorySidebar } from "../components/CategorySidebar";
import { SearchBar } from "../components/SearchBar";
import Header, { type DirectoryViewMode } from "../components/Header";
import { FAQSection } from "../components/FAQSection";
import { AuthoringBanner } from "../components/AuthoringBanner";
import { setPageTitle, setPageDescription } from "../lib/seo";
import {
  CATALOG_REFRESH_AFTER_MS,
  fetchDirectoryPage,
  getCachedDirectoryPage,
  type DirectoryPageData,
} from "../lib/convexHttp";
import { readEntryState, useEntryState, useLocation } from "../lib/router";
import { CaretSortIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import { Robot, FileText, ArrowSquareOut } from "@phosphor-icons/react";
import { FEATURED_THUMBNAIL } from "../lib/images";
import { githubOwnerAliases } from "../../shared/repoUrl";

type SortBy = "newest" | "downloads" | "updated" | "rating" | "verified";

const DIRECTORY_ROOT_HREF = "/components/";

const getGridColumnCount = (): number => {
  if (typeof window === "undefined") return 4;
  if (window.innerWidth < 640) return 1;
  if (window.innerWidth < 1024) return 2;
  if (window.innerWidth < 1280) return 3;
  return 4;
};

// Seed the directory search box from a ?q= param (set by the header search)
const getInitialSearchTerm = (): string => {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
};

// Search, sort and "load more" progress saved on the history entry, so Back
// to the directory restores them along with the scroll position
interface DirectoryHistoryState {
  searchTerm: string;
  sortBy: SortBy;
  visibleBySection: Record<string, number>;
}
const DIRECTORY_HISTORY_KEY = "directory";

// Restore the last chosen grid/list view (grid is the default)
const VIEW_MODE_STORAGE_KEY = "directoryViewMode";
const getInitialViewMode = (): DirectoryViewMode => {
  if (typeof window === "undefined") return "grid";
  try {
    return localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "list"
      ? "list"
      : "grid";
  } catch {
    return "grid";
  }
};

export default function Directory() {
  const [restored] = useState(() =>
    readEntryState<DirectoryHistoryState>(DIRECTORY_HISTORY_KEY),
  );
  const [searchTerm, setSearchTerm] = useState(
    () => restored?.searchTerm ?? getInitialSearchTerm(),
  );
  const [sortBy, setSortBy] = useState<SortBy>(
    () => restored?.sortBy ?? "downloads",
  );
  const [viewMode, setViewMode] =
    useState<DirectoryViewMode>(getInitialViewMode);
  const [sortOpen, setSortOpen] = useState(false);
  const [gridColumns, setGridColumns] = useState<number>(getGridColumnCount);
  const [visibleBySection, setVisibleBySection] = useState<
    Record<string, number>
  >(() => restored?.visibleBySection ?? {});
  const desktopSortRef = useRef<HTMLDivElement>(null);
  const mobileSortRef = useRef<HTMLDivElement>(null);
  const groupedCardsPerLoad = 12;
  const flatCardsPerLoad = gridColumns * 3;
  const featuredFirstRowCount = 3;
  const featuredExtraPerLoad = 8;
  // Close sort dropdown on outside click
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

  // Keep "two rows at a time" aligned with responsive grid breakpoints.
  useEffect(() => {
    const onResize = () => setGridColumns(getGridColumnCount());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Reset section paging when major directory controls change, except when
  // they were just restored from history (on mount or Back/Forward), so a
  // restored "load more" position survives.
  const restoredControls = useRef<{ searchTerm: string; sortBy: SortBy } | null>(
    { searchTerm, sortBy },
  );
  useEffect(() => {
    const restoredNow =
      restoredControls.current?.searchTerm === searchTerm &&
      restoredControls.current?.sortBy === sortBy;
    restoredControls.current = null;
    if (restoredNow) return;
    setVisibleBySection({});
    if (searchTerm) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [searchTerm, sortBy, gridColumns]);

  // Save search, sort and paging with this history entry for Back
  useEntryState(DIRECTORY_HISTORY_KEY, {
    searchTerm,
    sortBy,
    visibleBySection,
  });

  // Moving between directory history entries while it stays mounted (the
  // header search or the All link push a new entry, then Back/Forward):
  // restore that entry's saved controls, or start from its ?q= if it has none
  const { pathname, search, entryKey } = useLocation();
  const lastEntryKey = useRef(entryKey);
  useEffect(() => {
    if (entryKey === lastEntryKey.current) return;
    lastEntryKey.current = entryKey;
    const saved = readEntryState<DirectoryHistoryState>(DIRECTORY_HISTORY_KEY);
    const nextSearchTerm =
      saved?.searchTerm ?? new URLSearchParams(search).get("q") ?? "";
    const nextSortBy = saved?.sortBy ?? "downloads";
    restoredControls.current = {
      searchTerm: nextSearchTerm,
      sortBy: nextSortBy,
    };
    setSearchTerm(nextSearchTerm);
    setSortBy(nextSortBy);
    setVisibleBySection(saved?.visibleBySection ?? {});
  }, [entryKey, search]);

  // One-shot fetches for public catalog data (no reactive subscription
  // overhead). A catalog loaded earlier in this session renders straight away.
  const [cached] = useState(() => getCachedDirectoryPage(sortBy));
  const [components, setComponents] = useState<any[] | undefined>(
    cached?.data.components,
  );
  const [categories, setCategories] = useState<any[] | undefined>(
    cached?.data.categories,
  );
  const [featured, setFeatured] = useState<any[] | undefined>(
    cached ? (cached.data.featured ?? []) : undefined,
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
  // Global admin toggle: show thumbnails on list-view rows (default off)
  const [listViewSettings, setListViewSettings] = useState<{
    showListViewThumbnails: boolean;
  }>(cached?.data.listViewSettings ?? { showListViewThumbnails: false });

  const applyData = useCallback((data: DirectoryPageData) => {
    setComponents(data.components);
    setCategories(data.categories);
    setFeatured(data.featured ?? []);
    setDownloadsDisplay(data.downloadsDisplay);
    setListViewSettings(
      data.listViewSettings ?? { showListViewThumbnails: false },
    );
  }, []);

  const fetchGeneration = useRef(0);
  const fetchInFlight = useRef(false);
  const lastLoadedAt = useRef(cached?.loadedAt ?? 0);
  // Aborted when a newer load starts, so a superseded one stops retrying
  const loadController = useRef<AbortController | null>(null);
  const fetchData = useCallback(async () => {
    const gen = ++fetchGeneration.current;
    fetchInFlight.current = true;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    try {
      const data = await fetchDirectoryPage(sortBy, undefined, controller.signal);
      if (gen !== fetchGeneration.current) return;
      lastLoadedAt.current = Date.now();
      applyData(data);
    } catch (error) {
      if (controller.signal.aborted) return;
      // Keep whatever is on screen; the next focus or visibility change retries
      console.error("[Directory] Failed to load components", error);
    } finally {
      if (gen === fetchGeneration.current) fetchInFlight.current = false;
    }
  }, [sortBy, applyData]);

  useEffect(() => {
    // Show this sort's cached catalog straight away and only refetch when it's
    // missing or over a minute old. Bumping the generation (and aborting)
    // drops any older request still in flight for a different sort.
    const cachedPage = getCachedDirectoryPage(sortBy);
    if (cachedPage) {
      fetchGeneration.current += 1;
      fetchInFlight.current = false;
      loadController.current?.abort();
      applyData(cachedPage.data);
      lastLoadedAt.current = cachedPage.loadedAt;
      if (Date.now() - cachedPage.loadedAt < CATALOG_REFRESH_AFTER_MS) return;
    }
    void fetchData();
  }, [fetchData, sortBy, applyData]);

  useEffect(() => () => loadController.current?.abort(), []);

  useEffect(() => {
    // Refetch when the page becomes active again so recently refreshed npm
    // counts show up without a live subscription. Skip while a request is in
    // flight (a new one would throw away the prefetched response) and while
    // the data is under a minute old. pageshow also fires on every normal
    // load, so only react to back/forward cache restores.
    const refreshIfStale = () => {
      if (fetchInFlight.current) return;
      if (Date.now() - lastLoadedAt.current < CATALOG_REFRESH_AFTER_MS) return;
      void fetchData();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshIfStale();
      }
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        refreshIfStale();
      }
    };

    window.addEventListener("focus", refreshIfStale);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshIfStale);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchData]);

  const categoryItems = categories ?? [];

  // Set page SEO (again after the router resets it for a new URL)
  useEffect(() => {
    setPageTitle();
    setPageDescription(
      "Browse open-source Convex components: AI agents, auth, database tools, workflows, and more. Install with npm and start building.",
    );
  }, [pathname]);

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
        (c.authorUsername &&
          githubOwnerAliases(c.authorUsername).some((name) => name.includes(term))),
    );
  }, [components, searchTerm]);

  // Preserve backend sort order so selected sort mode is always authoritative.
  const displayComponents = useMemo(() => {
    return filteredComponents;
  }, [filteredComponents]);

  const flatVisibleCount = visibleBySection["flat"] ?? flatCardsPerLoad;
  const hasMoreFlatResults = displayComponents.length > flatVisibleCount;

  const loadMoreSection = (sectionKey: string, batchSize: number) => {
    setVisibleBySection((current) => ({
      ...current,
      [sectionKey]: (current[sectionKey] ?? batchSize) + batchSize,
    }));
  };

  // Persist grid/list choice so it sticks across visits
  const handleViewModeChange = (mode: DirectoryViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // Storage unavailable (private mode); keep in-memory state only
    }
  };

  const showFeatured = !searchTerm.trim() && featured && featured.length > 0;
  const directoryCardHoverClass =
    "hover:bg-[rgb(246_238_219/var(--tw-bg-opacity,1))]";
  const isListView = viewMode === "list";
  const clearFilters = () => {
    setSearchTerm("");
  };

  // List view renders every section as compact rows inside one bordered
  // container. Thumbnails follow the global admin toggle only (overrides
  // per-category and per-component hide flags, list view only).
  const renderListRows = (comps: any[]) => (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      {comps.map((comp) => (
        <ComponentListRow
          key={comp._id}
          name={comp.name}
          componentName={comp.componentName}
          slug={comp.slug}
          shortDescription={comp.shortDescription}
          description={comp.description}
          category={comp.category}
          thumbnailUrl={comp.thumbnailUrl}
          showThumbnail={listViewSettings.showListViewThumbnails}
          authorUsername={comp.authorUsername}
          authorAvatar={comp.authorAvatar}
          weeklyDownloads={comp.weeklyDownloads}
          allTimeDownloads={comp.allTimeDownloads}
          showWeeklyDownloads={downloadsDisplay.showWeeklyDownloads}
          showAllTimeDownloads={downloadsDisplay.showAllTimeDownloads}
          convexVerified={comp.convexVerified}
          communitySubmitted={comp.communitySubmitted}
          curatedBadges={comp.curatedBadges}
          featured={comp.featured}
          npmUrl={comp.npmUrl}
          repositoryUrl={comp.repositoryUrl}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Global header with auth + grid/list view toggle */}
      <Header viewMode={viewMode} onViewModeChange={handleViewModeChange} />

      {/* Page header: compact one-line title + inline subtitle to reduce whitespace */}
      <header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold text-text-primary">
            Components
          </h1>
          <p className="text-sm text-text-secondary">
            Open-source building blocks for your Convex app
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Two-column layout: sticky sidebar + scrollable content */}
        <div className="flex gap-8">
          {/* Sidebar: search + categories, sticky on desktop */}
          <aside className="hidden lg:block w-52 shrink-0">
            <div className="sticky top-20">
              {/* Submit link */}
              <div className="pb-6">
                <a
                  href={
                    window.location.pathname.startsWith("/components")
                      ? "/components/submit?submit=true"
                      : "/submit?submit=true"
                  }
                  className="inline-flex items-center gap-1.5 text-sm font-medium rounded-full px-4 py-2 transition-colors"
                  style={{
                    backgroundColor: "rgb(243, 176, 28)",
                    color: "rgb(42, 40, 37)",
                  }}
                >
                  Submit a component
                </a>
              </div>

              {/* Search */}
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search..."
                inputClassName="bg-white border border-border"
              />

              {/* Desktop sort */}
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

              {/* Categories */}
              <div className="mt-5">
                {categories && (
                  <CategorySidebar
                    categories={categories}
                    selectedCategory={null}
                    onSelectCategory={() => {}}
                    linkMode={true}
                  />
                )}
              </div>
            </div>
          </aside>

          {/* Main content: featured + grid */}
          <main className="flex-1 min-w-0">
            {/* Mobile: search + sort row */}
            <div className="lg:hidden flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
              <div className="w-full sm:w-auto flex items-center gap-2">
                <SearchBar
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Search components..."
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

            {/* Mobile category pills */}
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-4 mb-4 -mx-1 px-1">
              <a
                href={DIRECTORY_ROOT_HREF}
                className="shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors bg-text-primary text-white"
              >
                All
              </a>
              {categories?.map((cat) => (
                <a
                  key={cat.category}
                  href={`/components/categories/${cat.category}`}
                  className="shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors bg-bg-secondary text-text-secondary hover:bg-bg-hover"
                >
                  {cat.label} ({cat.count})
                </a>
              ))}
            </div>

            {/* Featured section (3 columns) */}
            {showFeatured && (
              <section className="mb-10">
                <h2 className="text-lg font-semibold text-text-primary mb-1">
                  Featured
                </h2>
                <p className="text-sm text-text-secondary mb-4">
                  New and popular components from the Convex team and
                  community.{" "}
                </p>
                {isListView ? (
                  renderListRows(
                    featured!.slice(
                      0,
                      featuredFirstRowCount +
                        (visibleBySection["featured"] ?? featuredExtraPerLoad),
                    ),
                  )
                ) : (
                  <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {featured!.slice(0, featuredFirstRowCount).map((comp) => (
                    <ComponentCard
                      key={comp._id}
                      name={comp.name}
                      componentName={comp.componentName}
                      slug={comp.slug}
                      shortDescription={comp.shortDescription}
                      description={comp.description}
                      category={comp.category}
                      thumbnailUrl={comp.thumbnailUrl}
                      showThumbnail={true}
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
                      priority
                      thumbnailSizing={FEATURED_THUMBNAIL}
                    />
                  ))}
                </div>
                {featured!.slice(featuredFirstRowCount).length > 0 && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {featured!
                      .slice(featuredFirstRowCount)
                      .slice(
                        0,
                        visibleBySection["featured"] ?? featuredExtraPerLoad,
                      )
                      .map((comp) => (
                        <ComponentCard
                          key={comp._id}
                          name={comp.name}
                          componentName={comp.componentName}
                          slug={comp.slug}
                          shortDescription={comp.shortDescription}
                          description={comp.description}
                          category={comp.category}
                          thumbnailUrl={comp.thumbnailUrl}
                          showThumbnail={true}
                          authorUsername={comp.authorUsername}
                          authorAvatar={comp.authorAvatar}
                          weeklyDownloads={comp.weeklyDownloads}
                          allTimeDownloads={comp.allTimeDownloads}
                          showWeeklyDownloads={
                            downloadsDisplay.showWeeklyDownloads
                          }
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
                )}
                  </>
                )}
                {featured!.slice(featuredFirstRowCount).length >
                  (visibleBySection["featured"] ?? featuredExtraPerLoad) && (
                  <div className="mt-5 flex justify-center">
                    <button
                      onClick={() =>
                        loadMoreSection("featured", featuredExtraPerLoad)
                      }
                      className="inline-flex items-center rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary"
                    >
                      Load more
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Loading state: mirrors the active layout (cards or list rows)
                so content does not grow and shift when data lands */}
            {!components &&
              (isListView ? (
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white shadow-sm animate-pulse">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="px-3 py-3">
                      <div className="h-4 bg-bg-secondary rounded w-1/3 mb-2" />
                      <div className="h-3 bg-bg-secondary rounded w-2/3 mb-2" />
                      <div className="flex items-center gap-2.5">
                        <div className="h-4 w-4 bg-bg-secondary rounded-full" />
                        <div className="h-3 bg-bg-secondary rounded w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm animate-pulse"
                    >
                      <div className="aspect-video w-full bg-bg-secondary" />
                      <div className="p-3">
                        <div className="h-5 bg-bg-secondary rounded w-3/4 mb-2" />
                        <div className="h-3 bg-bg-secondary rounded w-full mb-1" />
                        <div className="h-3 bg-bg-secondary rounded w-2/3 mb-4" />
                        <div className="flex items-center gap-2.5">
                          <div className="h-6 w-6 bg-bg-secondary rounded-full" />
                          <div className="h-3 bg-bg-secondary rounded w-20" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

            {/* Results */}
            {components && displayComponents.length === 0 && (
              <div className="text-center py-16 text-text-secondary">
                <p className="text-lg mb-1">No components found</p>
                <p className="text-sm">
                  {searchTerm
                    ? "Try a different search term"
                    : "No approved components found yet"}
                </p>
                {searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            )}

            {/* Grouped by category when no search/filter, otherwise flat grid */}
            {components &&
            displayComponents.length > 0 &&
            !searchTerm.trim() ? (
              <>
                {categoryItems.map((cat) => {
                  const catComponents = displayComponents.filter(
                    (c) => c.category === cat.category,
                  );
                  if (catComponents.length === 0) return null;
                  const sectionKey = `category:${cat.category}`;
                  const visibleCount =
                    visibleBySection[sectionKey] ?? groupedCardsPerLoad;
                  const visibleComponents = catComponents.slice(
                    0,
                    visibleCount,
                  );
                  const hasMore = catComponents.length > visibleCount;
                  return (
                    <section key={cat.category} className="mb-10">
                      <h2 className="text-lg font-semibold text-text-primary mb-1">
                        {cat.label}
                      </h2>
                      <p className="text-sm text-text-secondary mb-4">
                        {cat.description}
                      </p>
                      {isListView ? (
                        renderListRows(visibleComponents)
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {visibleComponents.map((comp) => (
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
                                !cat.hideThumbnails &&
                                !comp.hideThumbnailInCategory
                              }
                              authorUsername={comp.authorUsername}
                              authorAvatar={comp.authorAvatar}
                              weeklyDownloads={comp.weeklyDownloads}
                              allTimeDownloads={comp.allTimeDownloads}
                              showWeeklyDownloads={
                                downloadsDisplay.showWeeklyDownloads
                              }
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
                      )}
                      {isListView && hasMore && (
                        <div className="mt-5 flex justify-center">
                          <button
                            onClick={() =>
                              loadMoreSection(sectionKey, groupedCardsPerLoad)
                            }
                            className="inline-flex items-center rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary"
                          >
                            Load more
                          </button>
                        </div>
                      )}
                      {!isListView && hasMore && (
                        <div className="mt-5 flex justify-center">
                          <a
                            href={`/components/categories/${cat.category}`}
                            className="inline-flex items-center rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary"
                          >
                            View all {cat.label}
                          </a>
                        </div>
                      )}
                      {isListView &&
                        !hasMore &&
                        catComponents.length > groupedCardsPerLoad && (
                          <div className="mt-5 flex justify-center">
                            <a
                              href={`/components/categories/${cat.category}`}
                              className="inline-flex items-center rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary"
                            >
                              View all {cat.label}
                            </a>
                          </div>
                        )}
                    </section>
                  );
                })}
                {/* Uncategorized components */}
                {displayComponents.filter(
                  (c) =>
                    !c.category ||
                    !categoryItems.find((cat) => cat.category === c.category),
                ).length > 0 && (
                  <section className="mb-10">
                    <h2 className="text-lg font-semibold text-text-primary mb-1">
                      Other
                    </h2>
                    <p className="text-sm text-text-secondary mb-4">
                      Additional community components.
                    </p>
                    {isListView ? (
                      renderListRows(
                        displayComponents
                          .filter(
                            (c) =>
                              !c.category ||
                              !categoryItems.find(
                                (cat) => cat.category === c.category,
                              ),
                          )
                          .slice(
                            0,
                            visibleBySection["category:__other__"] ??
                              groupedCardsPerLoad,
                          ),
                      )
                    ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {displayComponents
                        .filter(
                          (c) =>
                            !c.category ||
                            !categoryItems.find(
                              (cat) => cat.category === c.category,
                            ),
                        )
                        .slice(
                          0,
                          visibleBySection["category:__other__"] ??
                            groupedCardsPerLoad,
                        )
                        .map((comp) => (
                          <ComponentCard
                            key={comp._id}
                            name={comp.name}
                            componentName={comp.componentName}
                            slug={comp.slug}
                            shortDescription={comp.shortDescription}
                            description={comp.description}
                            category={comp.category}
                            thumbnailUrl={comp.thumbnailUrl}
                            showThumbnail={!comp.hideThumbnailInCategory}
                            authorUsername={comp.authorUsername}
                            authorAvatar={comp.authorAvatar}
                            weeklyDownloads={comp.weeklyDownloads}
                            allTimeDownloads={comp.allTimeDownloads}
                            showWeeklyDownloads={
                              downloadsDisplay.showWeeklyDownloads
                            }
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
                    )}
                    {displayComponents.filter(
                      (c) =>
                        !c.category ||
                        !categoryItems.find(
                          (cat) => cat.category === c.category,
                        ),
                    ).length >
                      (visibleBySection["category:__other__"] ??
                        groupedCardsPerLoad) && (
                      <div className="mt-5 flex justify-center">
                        <button
                          onClick={() =>
                            loadMoreSection(
                              "category:__other__",
                              groupedCardsPerLoad,
                            )
                          }
                          className="inline-flex items-center rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary"
                        >
                          Load more
                        </button>
                      </div>
                    )}
                  </section>
                )}
              </>
            ) : components && displayComponents.length > 0 ? (
              <>
                {isListView ? (
                  renderListRows(displayComponents.slice(0, flatVisibleCount))
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {displayComponents.slice(0, flatVisibleCount).map((comp) => (
                    <ComponentCard
                      key={comp._id}
                      name={comp.name}
                      componentName={comp.componentName}
                      slug={comp.slug}
                      shortDescription={comp.shortDescription}
                      description={comp.description}
                      category={comp.category}
                      thumbnailUrl={comp.thumbnailUrl}
                      showThumbnail={!comp.hideThumbnailInCategory}
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
                )}
                {hasMoreFlatResults && (
                  <div className="mt-5 flex justify-center">
                    <button
                      onClick={() => loadMoreSection("flat", flatCardsPerLoad)}
                      className="inline-flex items-center rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-secondary"
                    >
                      Load more
                    </button>
                  </div>
                )}
              </>
            ) : null}

            {/* Authoring Banner */}
            <AuthoringBanner className="mt-12 mb-10" />

            {/* FAQ Section */}
            <FAQSection />

            {/* For Agents Section */}
            <section className="mt-12 pt-8 border-t border-border">
              <h2 className="text-lg font-semibold text-text-primary mb-2">
                For Agents
              </h2>
              <p className="text-sm text-text-secondary mb-4">
                AI agents and coding assistants can consume the Convex
                Components Directory through machine-readable content endpoints.
                These files auto-update as new components are approved and
                listed.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/components/llms.txt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border text-text-primary hover:bg-bg-hover transition-colors"
                >
                  <Robot size={16} />
                  llms.txt
                  <ArrowSquareOut size={14} className="text-text-tertiary" />
                </a>
                <a
                  href="/components/components.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border text-text-primary hover:bg-bg-hover transition-colors"
                >
                  <FileText size={16} />
                  components.md
                  <ArrowSquareOut size={14} className="text-text-tertiary" />
                </a>
              </div>
              <p className="text-sm text-text-secondary mt-5 mb-4">
                Only want official components built by the Convex team? These
                lists include components from the convex GitHub org (formerly
                get-convex) and the
                @convex-dev npm scope.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/components/get-convex-llms.txt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border text-text-primary hover:bg-bg-hover transition-colors"
                >
                  <Robot size={16} />
                  get-convex-llms.txt
                  <ArrowSquareOut size={14} className="text-text-tertiary" />
                </a>
                <a
                  href="/components/get-convex.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border text-text-primary hover:bg-bg-hover transition-colors"
                >
                  <FileText size={16} />
                  get-convex.md
                  <ArrowSquareOut size={14} className="text-text-tertiary" />
                </a>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
