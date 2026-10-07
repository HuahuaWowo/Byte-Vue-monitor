import defaultTracker from "../utils/tracker.js";
import getSelector from "../utils/getSelector.js";
import { createEventRecorder } from "../utils/getLastEvent.js";
import { errorDetails } from "../utils/error.js";
import { lifecycle, safeSend } from "../utils/runtime.js";

export default function useErrorMonitor(app, options = {}) {
  const env = options.environment ?? globalThis;
  const tracker = options.tracker ?? defaultTracker;
  const recorder = createEventRecorder(env);
  let active = false;
  let previous;
  let handler;
  function report(data) {
    if (active) safeSend(tracker, { kind: "error", ...data });
  }
  function onError(event) {
    try {
      const target = event.target;
      if (target?.nodeType === 1 && (target.src || target.href)) {
        report({ type: "resource", message: "Resource failed to load", resourceName: target.src || target.href, tag: target.nodeName });
      } else {
        report({ type: "javascript", ...errorDetails(event.error ?? event.message),
          filename: event.filename || "", line: event.lineno ?? null, column: event.colno ?? null });
      }
    } catch { /* Malformed host events must not create another error. */ }
  }
  function onRejection(event) {
    report({ type: "promise", ...errorDetails(event.reason), selector: getSelector(recorder.getPath()) });
  }
  function start() {
    if (active) return true;
    if (!env.document || typeof env.addEventListener !== "function") return false;
    active = true;
    env.addEventListener("error", onError, true);
    env.addEventListener("unhandledrejection", onRejection, true);
    recorder.start();
    if (app?.config) {
      previous = app.config.errorHandler;
      handler = function (error, instance, info) {
        let component = "";
        try { component = instance?.$options?.name || instance?.$options?.__name || ""; } catch { /* Optional metadata. */ }
        report({ type: "vue", ...errorDetails(error), component, lifecycleHook: String(info || "") });
        if (typeof previous === "function") return previous.call(this, error, instance, info);
      };
      app.config.errorHandler = handler;
    }
    return true;
  }
  function stop() {
    if (!active) return;
    active = false;
    env.removeEventListener("error", onError, true);
    env.removeEventListener("unhandledrejection", onRejection, true);
    recorder.stop();
    if (app?.config && app.config.errorHandler === handler) app.config.errorHandler = previous;
  }
  if (options.autoStart) start();
  return lifecycle(start, stop);
}
