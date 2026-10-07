import test from "node:test";
import assert from "node:assert/strict";
import { createTracker } from "../utils/tracker.js";
import { createServer } from "node:http";
import { createCollector } from "../example/collector.js";

test("validates configuration and imports without DOM", async () => {
  assert.throws(() => createTracker(), /endpoint/);
  assert.throws(() => createTracker({ endpoint: "file:///tmp/x" }), /HTTP/);
  assert.throws(() => createTracker({ endpoint: "https://a.test", timeout: 0 }), /timeout/);
  await import("../index.js");
});
test("10 concurrent events reach a real HTTP collector, with private fields removed", async t => {
  const collector = createCollector();
  const server = createServer((req, res) => collector(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const endpoint = "http://127.0.0.1:" + server.address().port + "/__monitor/events";
  const tracker = createTracker({ endpoint, environment: { fetch, location: { href: "https://u:p@a.test/page?token=secret#secret" } } });
  const results = await Promise.all(Array.from({ length: 10 }, (_, id) => tracker.send({ kind: "custom", id, query: { token: "secret" }, params: { password: "secret" } })));
  assert.ok(results.every(r => r.ok));
  const events = await (await fetch(endpoint)).json();
  assert.equal(events.length, 10);
  assert.equal(new Set(events.map(e => e.id)).size, 10);
  assert.equal(events[0].url, "https://a.test/page");
  assert.deepEqual(events[0].query, {});
  assert.ok(!JSON.stringify(events).includes("secret"));
});
test("timeout, HTTP failures, failed filter and network rejection return statuses", async () => {
  for (const [fetcher, reason] of [
    [() => new Promise(() => {}), "timeout"],
    [async () => ({ ok: false, status: 500 }), "http"],
    [async () => { throw Error("offline"); }, "network"],
  ]) {
    const tracker = createTracker({ endpoint: "https://a.test", timeout: 10, environment: { fetch: fetcher } });
    assert.equal((await tracker.send({ kind: "x" })).reason, reason);
    assert.equal(tracker.getStats().pending, 0);
  }
  const tracker = createTracker({ endpoint: "https://a.test", beforeSend() { throw Error("bad filter"); } });
  assert.equal((await tracker.send()).reason, "serialization");
});
test("beacon fallback, filters, serialization boundaries and destruction", async () => {
  const calls = [];
  const environment = { fetch: async (_, options) => { calls.push(options); return { ok: true }; }, navigator: { sendBeacon: () => false } };
  const tracker = createTracker({ endpoint: "https://a.test", environment, allowedQuery: ["campaign", "token"] });
  const circular = { kind: "x", url: "https://u:p@a.test/?campaign=ok&token=bad#fragment" }; circular.self = circular;
  assert.equal((await tracker.send(circular, { beacon: true })).ok, true);
  const event = JSON.parse(calls[0].body);
  assert.equal(event.url, "https://a.test/?campaign=ok");
  assert.equal(event.self.self, "[circular]");
  assert.equal(calls[0].keepalive, true);
  await tracker.flush();
  tracker.destroy();
  assert.equal((await tracker.send()).reason, "destroyed");
  const dropped = createTracker({ endpoint: "https://a.test", beforeSend: () => null });
  assert.equal((await dropped.send()).reason, "filtered");
});
