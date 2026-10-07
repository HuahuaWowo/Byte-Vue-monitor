import test from "node:test";
import assert from "node:assert/strict";
import usePageDuration from "../lib/usePageDuration.js";
import { environment, recorder } from "./helpers.js";

function router(initial = null) {
  const callbacks = new Set();
  return {
    currentRoute: { value: initial },
    afterEach(callback) { callbacks.add(callback); return () => callbacks.delete(callback); },
    navigate(to, failure) {
      const from = this.currentRoute.value;
      if (!failure) this.currentRoute.value = to;
      for (const callback of callbacks) callback(to, from, failure);
    },
    count: () => callbacks.size,
  };
}
const route = path => ({ path, name: path, params: {}, query: {}, matched: [{}] });

test("successful navigation measures the actual previous page and ignores initial placeholders", () => {
  const env = environment(); const tracker = recorder(); const r = router();
  const monitor = usePageDuration(r, { environment: env, tracker });
  r.navigate(route("/a"));
  assert.equal(tracker.events.length, 0);
  env.time = 1000;
  r.navigate(route("/b"));
  assert.equal(tracker.events[0].data.path, "/a");
  assert.equal(tracker.events[0].data.duration, 1000);
  monitor.stop();
  assert.equal(r.count(), 0);
});
test("cancelled navigation and same-path query changes do not reset time", () => {
  const env = environment(); const tracker = recorder(); const r = router(route("/a"));
  const monitor = usePageDuration(r, { environment: env, tracker });
  env.time = 200; r.navigate(route("/b"), Error("cancelled"));
  env.time = 500; r.navigate({ ...route("/a"), query: { page: "2" } });
  assert.equal(tracker.events.length, 0);
  env.time = 1000; r.navigate(route("/b"));
  assert.equal(tracker.events[0].data.duration, 1000);
  monitor.stop();
});
test("pagehide plus stop settles once; BFCache restore begins a fresh stay", () => {
  const env = environment(); const tracker = recorder(); const r = router(route("/a"));
  const monitor = usePageDuration(r, { environment: env, tracker });
  env.time = 20; env.emit("pagehide");
  assert.equal(tracker.events[0].options.beacon, true);
  env.time = 200; env.emit("pageshow", { persisted: true });
  env.time = 300; env.emit("pagehide"); monitor.stop(); monitor.stop();
  assert.deepEqual(tracker.events.map(e => e.data.duration), [20, 100]);
  assert.equal(r.count() + env.count(), 0);
});
test("restarts do not retain hooks or complete stale initial-ready callbacks", async () => {
  const env = environment(); const tracker = recorder(); const r = router();
  let ready;
  r.isReady = () => new Promise(resolve => { ready = resolve; });
  const monitor = usePageDuration(r, { environment: env, tracker });
  const oldReady = ready;
  monitor.stop(); monitor.start(); monitor.start();
  r.currentRoute.value = route("/a"); oldReady(); await Promise.resolve();
  env.time = 100; ready(); await Promise.resolve();
  env.time = 400; r.navigate(route("/b"));
  assert.equal(tracker.events[0].data.duration, 300);
  assert.equal(r.count(), 1);
  monitor.stop();
});
test("SSR does not register guards and invalid routers fail clearly", () => {
  const r = router();
  assert.equal(usePageDuration(r, { environment: {} }).start(), false);
  assert.equal(r.count(), 0);
  assert.throws(() => usePageDuration({}), /afterEach/);
});
