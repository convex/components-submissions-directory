// The component page chunk. It used to sit in the entry bundle, so every
// directory visit downloaded and parsed it before the first render. It now
// loads on demand, and is preloaded once the directory has rendered and when
// a component link is hovered or touched, so opening a component from the
// directory doesn't wait for it.
import { chunkLoader } from "./chunkLoader";

export const componentDetailChunk = chunkLoader(
  () => import("../pages/ComponentDetail"),
);

export function preloadComponentDetail() {
  // A failed preload shows up when the page renders and reads the chunk
  componentDetailChunk.preload().catch(() => {});
}

// Wait for an idle moment, so the download and parse never compete with the
// render that put the cards on screen
export function preloadComponentDetailWhenIdle() {
  if (componentDetailChunk.isRequested()) return;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(preloadComponentDetail, { timeout: 3000 });
  } else {
    setTimeout(preloadComponentDetail, 200);
  }
}
