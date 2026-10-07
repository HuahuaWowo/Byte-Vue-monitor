import test from "node:test";
import assert from "node:assert/strict";
import usePerformance, { timingDetails } from "../lib/usePerformance.js";
import { environment, recorder } from "./helpers.js";

function observers(env, supported = ["paint", "largest-contentful-paint", "first-input", "resource", "navigation"]) {
  const instances = new Map();
  env.PerformanceObserver = class {
    static supportedEntryTypes = supported;
    constructor(callback) { this.callback = callback; this.disconnected = false; }
    observe({ type }) { this.type = type; instances.set(type, this); }
    disconnect() { this.disconnected = true; }
  };
  return { instances, emit(type, entries) { instances.get(type).callback({ getEntries: () => entries }); } };
}
test("missing input and unsupported APIs still produce a bounded partial report", () => {
  const env = environment(); const tracker = recorder();
  const monitor = usePerformance({ environment: env, tracker });
  env.fireTimers();
  assert.equal(tracker.events.length, 1);
  assert.equal(tracker.events[0].data.FID, null);
  assert.equal(tracker.events[0].data.missing.FID, "unsupported");
  assert.equal(env.timers.size, 0);
  monitor.stop();
  assert.equal(env.count() + env.document.count(), 0);
  assert.equal(usePerformance({ environment: {} }).start(), false);
});
test("LCP candidates and late input update snapshots, with no reports after stop", () => {
  const env = environment(); const tracker = recorder(); const fake = observers(env);
  const monitor = usePerformance({ environment: env, tracker });
  fake.emit("largest-contentful-paint", [{ startTime: 25 }]);
  fake.emit("paint", [{ name: "first-paint", startTime: 10 }, { name: "first-contentful-paint", startTime: 20 }]);
  env.fireTimers();
  assert.equal(tracker.events[0].data.LCP, 25);
  fake.emit("largest-contentful-paint", [{ startTime: 80 }]);
  assert.equal(tracker.events.at(-1).data.LCP, 80);
  fake.emit("first-input", [{ processingStart: 115, startTime: 100 }]);
  assert.equal(tracker.events.at(-1).data.FID, 15);
  monitor.stop();
  const count = tracker.events.length;
  fake.emit("largest-contentful-paint", [{ startTime: 300 }]);
  assert.equal(tracker.events.length, count);
  assert.ok([...fake.instances.values()].every(observer => observer.disconnected));
});
test("navigation and resources use their own entries; collector requests are excluded", () => {
  const env = environment(); const tracker = recorder(); tracker.endpoint = "https://example.test/events";
  const fake = observers(env);
  env.performance.getEntriesByType = () => [{ duration: 300, startTime: 0, responseStart: 50, requestStart: 30, responseEnd: 70, domainLookupStart: 1, domainLookupEnd: 4 }];
  const monitor = usePerformance({ environment: env, tracker, maxResources: 1 });
  fake.emit("resource", [{ name: tracker.endpoint, duration: 99 }, { name: "https://a.test/a.js", duration: 20 }, { name: "https://a.test/b.js", duration: 30 }]);
  env.fireTimers();
  assert.equal(tracker.events.filter(e => e.data.kind === "resource").length, 1);
  assert.equal(tracker.events[0].data.duration, 20);
  assert.equal(tracker.events[1].data.navigation.duration, 300);
  assert.equal(tracker.events[1].data.navigation.TTFB, 50);
  assert.equal(tracker.events[1].data.navigation.DNS, 3);
  monitor.stop();
});
test("hidden page flushes once and removes all observers and timers", () => {
  const env = environment(); const tracker = recorder(); const fake = observers(env);
  usePerformance({ environment: env, tracker });
  env.document.visibilityState = "hidden"; env.document.emit("visibilitychange");
  env.emit("pagehide"); env.fireTimers();
  assert.equal(tracker.events.length, 1);
  assert.equal(tracker.events[0].options.beacon, true);
  assert.ok([...fake.instances.values()].every(observer => observer.disconnected));
  assert.equal(env.count() + env.document.count() + env.timers.size, 0);
});
test("invalid durations stay null, absent TLS is not a misleading zero", () => {
  assert.equal(timingDetails({ connectEnd: 0, connectStart: 10 }).TCP, null);
  assert.equal(timingDetails({ secureConnectionStart: 0, connectEnd: 20 }).TLS, null);
});
