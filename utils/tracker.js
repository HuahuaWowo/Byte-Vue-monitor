import getUserAgent from "./getUserAgent.js";
import { cleanUrl, sanitize } from "./privacy.js";

export const SDK_VERSION = "0.2.0";
export function createTracker(options = {}) {
  const env = options.environment ?? globalThis;
  if (typeof options.endpoint !== "string" || !options.endpoint.trim()) throw new TypeError("A non-empty HTTP(S) endpoint is required");
  const endpoint = new URL(options.endpoint, env.location?.href);
  if (!["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
    throw new TypeError("endpoint must be HTTP(S), without embedded credentials");
  }
  const timeout = options.timeout ?? 5000;
  if (!Number.isFinite(timeout) || timeout <= 0) throw new TypeError("timeout must be positive");
  for (const key of ["allowedQuery", "allowedParams"]) {
    if (options[key] != null && (!Array.isArray(options[key]) || options[key].some(v => typeof v !== "string"))) {
      throw new TypeError(key + " must be an array of field names");
    }
  }
  const maxStringLength = options.maxStringLength ?? 2000;
  if (!Number.isInteger(maxStringLength) || maxStringLength < 1) throw new TypeError("maxStringLength must be positive");
  const pending = new Set();
  const controllers = new Set();
  const stats = { sent: 0, failed: 0, dropped: 0 };
  let destroyed = false;
  const privacy = { ...options, maxStringLength, base: env.location?.href };
  function prepare(data) {
    let event = sanitize({
      ...data, schemaVersion: 1, sdkVersion: SDK_VERSION, timestamp: Date.now(),
      url: cleanUrl(data.url || env.location?.href || "", options.allowedQuery, env.location?.href),
      userAgent: getUserAgent(env.navigator?.userAgent),
    }, privacy);
    if (options.beforeSend) event = options.beforeSend(event);
    if (event == null) return null;
    return JSON.stringify(sanitize(event, privacy));
  }
  async function deliver(data, { beacon = false } = {}) {
    if (destroyed) return { ok: false, reason: "destroyed" };
    let body;
    try {
      body = prepare(data);
      if (body === null) { stats.dropped++; return { ok: false, reason: "filtered" }; }
      if (new TextEncoder().encode(body).length > 60000) { stats.dropped++; return { ok: false, reason: "payload-too-large" }; }
    } catch { stats.failed++; return { ok: false, reason: "serialization" }; }
    if (beacon && typeof env.navigator?.sendBeacon === "function") {
      try {
        if (env.navigator.sendBeacon(endpoint.href, new Blob([body], { type: "application/json" }))) {
          stats.sent++;
          return { ok: true, queued: true };
        }
      } catch { /* Fall back to fetch if beacon cannot queue this event. */ }
    }
    if (typeof env.fetch !== "function") { stats.failed++; return { ok: false, reason: "unsupported" }; }
    const controller = new AbortController();
    controllers.add(controller);
    let timer;
    try {
      const timedOut = new Promise(resolve => {
        timer = setTimeout(() => { controller.abort(); resolve({ ok: false, reason: "timeout" }); }, timeout);
      });
      const request = Promise.resolve().then(() => env.fetch(endpoint.href, {
        method: "POST", headers: { "Content-Type": "application/json" }, body,
        signal: controller.signal, credentials: "omit", keepalive: beacon,
      })).then(response => ({ ok: response.ok, status: response.status, reason: response.ok ? undefined : "http" }))
        .catch(() => ({ ok: false, reason: controller.signal.aborted ? "aborted" : "network" }));
      const result = await Promise.race([request, timedOut]);
      stats[result.ok ? "sent" : "failed"]++;
      if (options.debug) env.console?.debug?.("[byte-vue-monitor]", result.ok ? "sent" : result.reason);
      return result;
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
    }
  }
  return {
    endpoint: endpoint.href,
    send(data = {}, sendOptions) {
      const promise = deliver(data, sendOptions);
      pending.add(promise);
      promise.finally(() => pending.delete(promise)).catch(() => {});
      return promise;
    },
    flush: () => Promise.allSettled([...pending]),
    destroy() { destroyed = true; for (const controller of controllers) controller.abort(); },
    getStats: () => ({ ...stats, pending: pending.size }),
  };
}
let current;
export function configureMonitor(options) {
  const next = createTracker(options);
  current?.destroy();
  current = next;
  return next;
}
export default {
  send: (data, options) => current ? current.send(data, options)
    : Promise.resolve({ ok: false, reason: "not-configured" }),
};
