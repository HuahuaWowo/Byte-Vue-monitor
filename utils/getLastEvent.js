// Keep only a DOM path, not the original event, key contents or input values.
export function createEventRecorder(env = globalThis) {
  let path = [];
  let active = false;
  const types = ["click", "touchstart", "mousedown", "keydown"];
  function capture(event) {
    try {
      path = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (!path.length) {
        let node = event.target;
        while (node && path.length < 20) { path.push(node); node = node.parentElement; }
      }
    } catch { path = []; }
  }
  return {
    start() {
      if (active || !env.document?.addEventListener) return false;
      active = true;
      for (const type of types) env.document.addEventListener(type, capture, { capture: true, passive: true });
      return true;
    },
    stop() {
      if (!active) return;
      for (const type of types) env.document.removeEventListener(type, capture, true);
      active = false;
      path = [];
    },
    getPath: () => [...path],
  };
}
