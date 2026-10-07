import defaultTracker from "../utils/tracker.js";
import { lifecycle, safeSend } from "../utils/runtime.js";

export default function usePageDuration(router, options = {}) {
  if (typeof router?.afterEach !== "function") throw new TypeError("Vue Router 4 afterEach is required");
  const env = options.environment ?? globalThis;
  const tracker = options.tracker ?? defaultTracker;
  const now = () => env.performance?.now?.() ?? Date.now();
  let active = false;
  let current = null;
  let startedAt = 0;
  let unsubscribe;
  let generation = 0;
  let suspended = false;
  function begin(route) {
    if (!route?.path) return;
    current = { name: typeof route.name === "string" ? route.name : "", path: route.path,
      query: route.query || {}, params: route.params || {} };
    startedAt = now();
  }
  function settle(reason, beacon = false) {
    if (!current) return;
    const route = current;
    current = null;
    safeSend(tracker, { kind: "page-duration", ...route, duration: Math.max(0, now() - startedAt), unit: "ms", reason }, { beacon });
  }
  function afterNavigation(to, from, failure) {
    if (!active || suspended || failure) return;
    if (current?.path === to.path) return;
    settle("navigation");
    begin(to);
  }
  function onPageHide() {
    suspended = true;
    settle("pagehide", true);
  }
  function onPageShow(event) {
    if (active && suspended && event.persisted) {
      suspended = false;
      begin(router.currentRoute?.value);
    }
  }
  function start() {
    if (active) return true;
    if (!env.document || !env.addEventListener) return false;
    active = true;
    suspended = false;
    const version = ++generation;
    unsubscribe = router.afterEach(afterNavigation);
    // Avoid a synthetic "/" stay while the initial router navigation is pending.
    if (router.currentRoute?.value?.matched?.length) begin(router.currentRoute.value);
    if (typeof router.isReady === "function") {
      Promise.resolve(router.isReady()).then(() => {
        if (active && !suspended && generation === version && !current) begin(router.currentRoute?.value);
      }).catch(() => {});
    }
    env.addEventListener("pagehide", onPageHide);
    env.addEventListener("pageshow", onPageShow);
    return true;
  }
  function stop() {
    if (!active) return;
    settle("stop");
    active = false;
    generation++;
    unsubscribe?.();
    unsubscribe = undefined;
    env.removeEventListener("pagehide", onPageHide);
    env.removeEventListener("pageshow", onPageShow);
  }
  if (options.autoStart !== false) start();
  return lifecycle(start, stop);
}
