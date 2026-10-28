// Helpers shared by the admin Activity and Users tabs: time
// formatting, deep links into the submissions list, and error text.
import { useEffect, useState, type MouseEvent } from "react";
import { ConvexError } from "convex/values";

// Ticks once a minute so relative times ("5m ago") stay fresh
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function formatRelativeTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatAbsoluteTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatUtcTime(ts: number): string {
  return `${new Date(ts).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

// "/components" prefix when the app is served under the directory path
export function appBasePath(): string {
  return window.location.pathname.startsWith("/components")
    ? "/components"
    : "";
}

export function adminCardHref(packageId: string): string {
  return `${appBasePath()}/submissions/admin#pkg-${packageId}`;
}

export function publicComponentHref(slug: string): string {
  return `${appBasePath()}/${slug}`;
}

// Jumps to a submission card on the admin page. Re-fires hashchange when the
// hash is already set so a second click still scrolls and expands.
export function openAdminCard(packageId: string): void {
  const hash = `#pkg-${packageId}`;
  if (window.location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = hash;
  }
}

export function isPlainLeftClick(e: MouseEvent): boolean {
  return (
    e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
  );
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError && typeof err.data === "string") {
    return err.data;
  }
  return fallback;
}

// 300ms debounce for search inputs so each keystroke doesn't re-subscribe
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
