// A lazy page chunk read with React's use() instead of React.lazy. lazy()
// suspends at least once on every new mount, even when the chunk has already
// been preloaded, and because navigation renders synchronously that commits
// the Suspense fallback and React then holds the page back for ~300ms. Here
// the import() promise is tagged with its result the way use() reads it, so a
// chunk that has arrived renders straight away.
type TaggedPromise<T> = Promise<T> & {
  status?: "fulfilled" | "rejected";
  value?: T;
  reason?: unknown;
};

// A tab left open across a deploy asks for chunk files the new build no
// longer has (Netlify answers them with a 404). Reloading picks up the new
// build, so do that rather than show the error screen. It happens at most
// once per build per tab: this module lives in the entry chunk, whose URL
// changes with every build, so a chunk that's still missing after the reload
// shows the error screen instead of looping. Offline visitors get the error
// screen (with its Reload button) rather than the browser's offline page.
const RELOAD_KEY = "chunkReloadFor";
// Set once a reload has started, so a re-render before the page unloads
// keeps suspending instead of flashing the error screen
let reloading: Promise<never> | undefined;

function reloadForNewBuild(): boolean {
  if (!navigator.onLine) return false;
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === import.meta.url) return false;
    sessionStorage.setItem(RELOAD_KEY, import.meta.url);
  } catch {
    return false;
  }
  reloading = new Promise<never>(() => {});
  window.location.reload();
  return true;
}

export function chunkLoader<T>(load: () => Promise<T>) {
  let request: TaggedPromise<T> | undefined;
  // The navigation whose render made the current request, if any
  let requestedFor: string | undefined;

  function start(navigation?: string) {
    const promise: TaggedPromise<T> = load().then(
      (value) => {
        void Object.assign(promise, { status: "fulfilled", value });
        return value;
      },
      (reason: unknown) => {
        void Object.assign(promise, { status: "rejected", reason });
        throw reason;
      },
    );
    request = promise;
    requestedFor = navigation;
    return promise;
  }

  return {
    // For use() while rendering a page. A failed load stays cached, so use()
    // throws it to the error boundary: starting a fresh import() here would
    // suspend again on every Suspense retry and never show the error. It is
    // retried once per navigation (pass the history entry key), which also
    // covers a preload that failed before the page was opened.
    read(navigation: string): Promise<T> {
      if (
        !request ||
        (request.status === "rejected" && requestedFor !== navigation)
      ) {
        return start(navigation);
      }
      // The retry for this navigation failed too: reload for a new build,
      // suspending until the page goes away
      if (reloading) return reloading;
      if (request.status === "rejected" && reloadForNewBuild() && reloading) {
        return reloading;
      }
      return request;
    },
    // New intent to open the page (hover, touch, idle time, a direct visit):
    // start loading, or try again if the last attempt failed
    preload(): Promise<T> {
      if (!request || request.status === "rejected") return start();
      return request;
    },
    // Loading or loaded, so there's nothing to preload
    isRequested() {
      return request !== undefined && request.status !== "rejected";
    },
  };
}
