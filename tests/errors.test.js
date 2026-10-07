import test from "node:test";
import assert from "node:assert/strict";
import useErrorMonitor from "../lib/useErrorMonitor.js";
import { extractErrorStack, errorDetails } from "../utils/error.js";
import getSelector from "../utils/getSelector.js";
import getUserAgent from "../utils/getUserAgent.js";
import { environment, recorder } from "./helpers.js";

test("error monitor is idempotent and restores Vue handler, including restart", () => {
  const env = environment(); const tracker = recorder();
  let originalCalls = 0;
  const original = () => originalCalls++;
  const app = { config: { errorHandler: original } };
  const monitor = useErrorMonitor(app, { environment: env, tracker });
  monitor.start(); monitor.start();
  env.emit("error", { message: "boom", filename: "https://a.test/main.js", lineno: 3 });
  assert.equal(tracker.events.length, 1);
  app.config.errorHandler(Error("vue"), null, "render");
  assert.equal(originalCalls, 1);
  assert.equal(tracker.events[1].data.type, "vue");
  monitor.stop(); monitor.stop();
  assert.equal(app.config.errorHandler, original);
  assert.equal(env.count() + env.document.count(), 0);
  env.emit("error", { message: "ignored" });
  assert.equal(tracker.events.length, 2);
  monitor.start();
  env.emit("error", { message: "again" });
  assert.equal(tracker.events.length, 3);
  const replacement = () => {};
  app.config.errorHandler = replacement;
  monitor.stop();
  assert.equal(app.config.errorHandler, replacement);
});
test("resource events, arbitrary promise reasons and missing stacks are safe", () => {
  const env = environment(); const tracker = recorder();
  const monitor = useErrorMonitor(null, { environment: env, tracker, autoStart: true });
  env.emit("error", { target: { nodeType: 1, nodeName: "IMG", src: "https://a.test/missing.png" } });
  for (const reason of [Error("rejected"), "text", { code: 42 }, null]) env.emit("unhandledrejection", { reason });
  assert.equal(tracker.events[0].data.type, "resource");
  assert.deepEqual(tracker.events.slice(1).map(e => e.data.message), ["rejected", "text", '{"code":42}', "null"]);
  assert.equal(useErrorMonitor(null, { environment: {} }).start(), false);
  monitor.stop();
});
test("stack parser keeps all Chrome and Firefox frames and tolerates malformed errors", () => {
  const stack = "Error: failure\n    at one (https://a.test/app.js:10:20)\n    at https://a.test/app.js:30:40\nthree@https://a.test/a.js:50:60";
  assert.deepEqual(extractErrorStack(stack).map(frame => frame.line), [10, 30, 50]);
  assert.deepEqual(extractErrorStack("unknown stack"), []);
  assert.deepEqual(extractErrorStack(null), []);
  assert.equal(errorDetails({ get message() { throw Error("getter"); } }).message, "[unreadable error]");
});
test("interaction paths are immutable and do not collect ids or input values", () => {
  const path = [{ nodeType: 1, nodeName: "INPUT", id: "private", value: "secret" }, { nodeType: 1, nodeName: "FORM" }, {}];
  const before = [...path];
  assert.equal(getSelector(path), "form > input");
  assert.deepEqual(path, before);
  assert.equal(getSelector(undefined), "");
});
test("browser identification checks Chromium variants before Chrome", () => {
  assert.equal(getUserAgent("Chrome/120.0 Safari/537.36 Edg/120.0"), "Edg/120.0");
  assert.equal(getUserAgent("Version/17.2 Safari/605.1.15"), "Safari/17.2");
  assert.equal(getUserAgent("Chrome/120.0 OPR/103.0"), "OPR/103.0");
  assert.equal(getUserAgent("Firefox/122.0"), "Firefox/122.0");
});

test("event recorder snapshots composed paths, falls back to parents and releases nodes", async () => {
  const { createEventRecorder } = await import("../utils/getLastEvent.js");
  const env = environment(); const recorder = createEventRecorder(env);
  recorder.start(); recorder.start();
  const parent = { nodeType: 1, nodeName: "FORM" };
  const input = { nodeType: 1, nodeName: "INPUT", parentElement: parent };
  env.document.emit("click", { composedPath: () => [input, parent] });
  assert.equal(getSelector(recorder.getPath()), "form > input");
  const copied = recorder.getPath(); copied.reverse();
  assert.equal(recorder.getPath()[0], input);
  env.document.emit("keydown", { target: input });
  assert.deepEqual(recorder.getPath(), [input, parent]);
  recorder.stop();
  assert.deepEqual(recorder.getPath(), []);
  assert.equal(env.document.count(), 0);
});
