import defaultTracker from "../utils/tracker.js";
import { lifecycle, safeSend } from "../utils/runtime.js";

function elapsed(end, start) {
  return Number.isFinite(end) && Number.isFinite(start) && end >= start ? end - start : null;
}
export function timingDetails(entry) {
  return {
    duration: Number.isFinite(entry.duration) ? entry.duration : null,
    DNS: elapsed(entry.domainLookupEnd, entry.domainLookupStart),
    TCP: elapsed(entry.connectEnd, entry.connectStart),
    TLS: entry.secureConnectionStart > 0 ? elapsed(entry.connectEnd, entry.secureConnectionStart) : null,
    TTFB: elapsed(entry.responseStart, entry.startTime),
    request: elapsed(entry.responseEnd, entry.requestStart),
    redirect: elapsed(entry.redirectEnd, entry.redirectStart),
    DCL: entry.domContentLoadedEventEnd > 0 ? elapsed(entry.domContentLoadedEventEnd, entry.domContentLoadedEventStart) : null,
    onLoad: entry.loadEventEnd > 0 ? elapsed(entry.loadEventEnd, entry.startTime) : null,
    protocol: entry.nextHopProtocol || "",
    transferSize: Number.isFinite(entry.transferSize) ? entry.transferSize : null,
    encodedBodySize: Number.isFinite(entry.encodedBodySize) ? entry.encodedBodySize : null,
  };
}

export default function usePerformance(options = {}) {
  const env = options.environment ?? globalThis;
  const tracker = options.tracker ?? defaultTracker;
  const maxWait = options.maxWait ?? 5000;
  const maxResources = options.maxResources ?? 100;
  if (!Number.isFinite(maxWait) || maxWait <= 0) throw new TypeError("maxWait must be positive");
  if (!Number.isInteger(maxResources) || maxResources < 0) throw new TypeError("maxResources must be non-negative");
  const schedule = env.setTimeout?.bind(env) ?? setTimeout;
  const cancel = env.clearTimeout?.bind(env) ?? clearTimeout;
  let active = false;
  let timer;
  let observers = [];
  let values;
  let missing;
  let previousSnapshot = "";
  let reported = false;
  let resources = 0;
  function navigation() {
    try {
      const entry = env.performance?.getEntriesByType?.("navigation")?.[0];
      if (entry) { values.navigation = timingDetails(entry); delete missing.navigation; }
    } catch { missing.navigation = "unavailable"; }
  }
  function snapshot(phase = "manual", beacon = false) {
    if (!active) return;
    navigation();
    const fingerprint = JSON.stringify({ ...values, missing });
    if (fingerprint === previousSnapshot) return;
    previousSnapshot = fingerprint;
    reported = true;
    safeSend(tracker, { kind: "performance", phase, unit: "ms", ...values, missing: { ...missing } }, { beacon });
  }
  function observe(type, keys, process) {
    const Observer = env.PerformanceObserver;
    if (!Observer || (Observer.supportedEntryTypes && !Observer.supportedEntryTypes.includes(type))) {
      keys.forEach(key => { if (values[key] == null) missing[key] = "unsupported"; });
      return;
    }
    let observer;
    try {
      observer = new Observer(list => {
        if (!active) return;
        try {
          process(list.getEntries());
          if (reported && type !== "resource") snapshot("update");
        } catch { /* Unsupported or malformed entries must not affect the page. */ }
      });
      observer.observe({ type, buffered: true });
      observers.push(observer);
    } catch {
      observer?.disconnect();
      keys.forEach(key => { if (values[key] == null) missing[key] = "unsupported"; });
    }
  }
  function metric(key, value) {
    if (Number.isFinite(value) && value >= 0) { values[key] = value; delete missing[key]; }
  }
  function resourceEntries(entries) {
    for (const entry of entries) {
      if (resources >= maxResources) break;
      // Never observe the collector itself: reporting generates resource entries.
      if (tracker.endpoint) {
        try {
          const target = new URL(entry.name, env.location?.href);
          const endpoint = new URL(tracker.endpoint, env.location?.href);
          if (target.origin === endpoint.origin && target.pathname === endpoint.pathname) continue;
        } catch { continue; }
      }
      resources++;
      safeSend(tracker, { kind: "resource", resourceName: entry.name, initiatorType: entry.initiatorType || "", unit: "ms", ...timingDetails(entry) });
    }
  }
  function onHidden() {
    if (env.document.visibilityState === "hidden") { snapshot("hidden", true); stop(); }
  }
  function onPageHide() { snapshot("pagehide", true); stop(); }
  function start() {
    if (active) return true;
    if (!env.document || !env.addEventListener) return false;
    active = true;
    reported = false;
    resources = 0;
    previousSnapshot = "";
    values = { FP: null, FCP: null, LCP: null, FID: null, navigation: null };
    missing = Object.fromEntries(Object.keys(values).map(key => [key, "not-observed"]));
    navigation();
    observe("paint", ["FP", "FCP"], entries => {
      for (const entry of entries) {
        if (entry.name === "first-paint") metric("FP", entry.startTime);
        if (entry.name === "first-contentful-paint") metric("FCP", entry.startTime);
      }
    });
    observe("largest-contentful-paint", ["LCP"], entries => {
      for (const entry of entries) metric("LCP", Math.max(values.LCP ?? 0, entry.startTime));
    });
    observe("first-input", ["FID"], entries => {
      if (values.FID == null && entries[0]) metric("FID", elapsed(entries[0].processingStart, entries[0].startTime));
    });
    observe("navigation", ["navigation"], () => navigation());
    observe("resource", [], resourceEntries);
    timer = schedule(() => { timer = undefined; snapshot("timeout"); }, maxWait);
    env.document.addEventListener("visibilitychange", onHidden);
    env.addEventListener("pagehide", onPageHide);
    return true;
  }
  function stop() {
    if (!active) return;
    active = false;
    cancel(timer);
    timer = undefined;
    for (const observer of observers) observer.disconnect();
    observers = [];
    env.document.removeEventListener("visibilitychange", onHidden);
    env.removeEventListener("pagehide", onPageHide);
  }
  if (options.autoStart !== false) start();
  return lifecycle(start, stop, { flush: () => snapshot() });
}
