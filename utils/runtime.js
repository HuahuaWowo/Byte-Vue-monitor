export function safeSend(tracker, data, options) {
  try { Promise.resolve(tracker.send(data, options)).catch(() => {}); } catch { /* Never break the host. */ }
}
export function lifecycle(start, stop, extra = {}) {
  return Object.assign([start, stop], { start, stop, ...extra });
}
