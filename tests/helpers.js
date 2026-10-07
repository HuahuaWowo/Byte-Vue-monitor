export class EventHub {
  listeners = new Map();
  addEventListener(type, fn, options) {
    const capture = options === true || options?.capture === true;
    const listeners = this.listeners.get(type) || [];
    if (!listeners.some(item => item.fn === fn && item.capture === capture)) listeners.push({ fn, capture });
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, fn, options) {
    const capture = options === true || options?.capture === true;
    this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item.fn !== fn || item.capture !== capture));
  }
  emit(type, event = {}) {
    for (const { fn } of [...(this.listeners.get(type) || [])]) fn({ type, ...event });
  }
  count() { return [...this.listeners.values()].reduce((sum, items) => sum + items.length, 0); }
}
export function environment() {
  const env = new EventHub();
  env.document = Object.assign(new EventHub(), { visibilityState: "visible" });
  env.location = { href: "https://example.test/home" };
  env.time = 0;
  env.performance = { now: () => env.time, getEntriesByType: () => [] };
  env.timers = new Map();
  env.nextTimer = 1;
  env.setTimeout = callback => { const id = env.nextTimer++; env.timers.set(id, callback); return id; };
  env.clearTimeout = id => env.timers.delete(id);
  env.fireTimers = () => { const callbacks = [...env.timers.values()]; env.timers.clear(); callbacks.forEach(fn => fn()); };
  return env;
}
export function recorder() {
  const events = [];
  return { events, send: (data, options) => { events.push({ data, options }); return Promise.resolve({ ok: true }); } };
}
