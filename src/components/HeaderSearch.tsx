// Header search: magnifying glass icon that opens a dropdown to search
// components by name and description via Convex full text search.
import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MagnifyingGlass, ArrowRight } from "@phosphor-icons/react";
import { CheckCircledIcon } from "@radix-ui/react-icons";
import { navigate } from "../lib/router";

const BASE_PATH = "/components";
const MIN_CHARS = 2;

export function HeaderSearch() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  // Index of the keyboard-highlighted result; -1 means none selected
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce typing before hitting the search query (avoids a query per keystroke)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const results = useQuery(
    api.packages.searchDirectoryComponents,
    open && debouncedTerm.length >= MIN_CHARS ? { searchTerm: debouncedTerm } : "skip",
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        setTerm("");
        setDebouncedTerm("");
      }
      return next;
    });
  };

  // Cmd+K (Ctrl+K on Windows/Linux) toggles the search. The header mounts
  // two instances (desktop and mobile); only the visible one responds.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        // offsetParent is null when a CSS-hidden ancestor hides this instance
        if (!containerRef.current || containerRef.current.offsetParent === null) return;
        e.preventDefault();
        toggleOpen();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // toggleOpen only touches stable setters and refs, safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const directoryHref = `${BASE_PATH}?q=${encodeURIComponent(term.trim())}`;

  const goToDirectory = () => {
    if (!term.trim()) return;
    // Close first: when the directory is already open this component stays
    // mounted, so nothing else would close the dropdown
    setOpen(false);
    navigate(directoryHref);
  };

  // Reset keyboard highlight whenever the result set changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  // Keep the highlighted result visible while arrowing through the list
  const scrollActiveIntoView = (index: number) => {
    const el = listRef.current?.children[index] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = results?.length ?? 0;
    if (e.key === "ArrowDown" && count > 0) {
      e.preventDefault();
      const next = activeIndex < count - 1 ? activeIndex + 1 : 0;
      setActiveIndex(next);
      scrollActiveIntoView(next);
    } else if (e.key === "ArrowUp" && count > 0) {
      e.preventDefault();
      const next = activeIndex > 0 ? activeIndex - 1 : count - 1;
      setActiveIndex(next);
      scrollActiveIntoView(next);
    } else if (e.key === "Enter") {
      // Enter opens the highlighted result, otherwise the full directory
      if (activeIndex >= 0 && results && results[activeIndex]) {
        const item = results[activeIndex];
        setOpen(false);
        navigate(item.slug ? `${BASE_PATH}/${item.slug}` : directoryHref);
      } else {
        goToDirectory();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setTerm("");
      setDebouncedTerm("");
    }
  };

  const showResults = debouncedTerm.length >= MIN_CHARS;
  const isSearching = showResults && results === undefined;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Search components"
        title="Search components (Cmd+K)"
        className={`p-1.5 rounded-full transition-colors ${
          open
            ? "bg-bg-hover text-text-primary"
            : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
        }`}>
        <MagnifyingGlass size={16} />
      </button>

      {open && (
        <div className="fixed sm:absolute left-1/2 sm:left-auto -translate-x-1/2 sm:translate-x-0 sm:right-0 top-[70px] sm:top-full mt-0 sm:mt-2 w-[calc(100vw-1rem)] sm:w-96 max-w-md rounded-lg border border-border bg-white shadow-lg z-50 overflow-hidden">
          {/* Input */}
          <div className="relative border-b border-border">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <input
              ref={inputRef}
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search components..."
              className="w-full pl-9 pr-12 py-2.5 text-sm text-text-primary placeholder:text-text-secondary bg-transparent focus:outline-none"
            />
            {/* Shortcut hint */}
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium text-text-secondary border border-border rounded bg-bg-card">
              &#8984;K
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
            {!showResults && (
              <div className="px-3 py-5 text-center text-sm text-text-secondary">
                Search by component name or description
              </div>
            )}
            {isSearching && (
              <div className="px-3 py-5 text-center text-sm text-text-secondary">Searching...</div>
            )}
            {showResults && results && results.length === 0 && (
              <div className="px-3 py-5 text-center text-sm text-text-secondary">
                No components found for "{debouncedTerm}"
              </div>
            )}
            {showResults &&
              results &&
              results.map((item, index) => (
                <a
                  key={item.slug || item.packageName}
                  href={item.slug ? `${BASE_PATH}/${item.slug}` : directoryHref}
                  onClick={() => setOpen(false)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex items-start gap-2 px-3 py-2 transition-colors ${
                    index === activeIndex ? "bg-bg-hover" : "hover:bg-bg-hover"
                  }`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {item.displayName}
                      </span>
                      {item.convexVerified && (
                        <CheckCircledIcon
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color: "rgb(34, 137, 9)" }}
                          aria-label="Verified by Convex team"
                        />
                      )}
                    </div>
                    {item.shortDescription && (
                      <div className="text-xs text-text-secondary truncate">
                        {item.shortDescription}
                      </div>
                    )}
                  </div>
                  {item.category && (
                    <span className="text-[11px] text-text-secondary shrink-0 mt-0.5">
                      {item.category}
                    </span>
                  )}
                </a>
              ))}
          </div>

          {/* Footer: view all in directory */}
          {term.trim().length >= MIN_CHARS && (
            <button
              type="button"
              onClick={goToDirectory}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border-t border-border text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors">
              View all results in directory
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
