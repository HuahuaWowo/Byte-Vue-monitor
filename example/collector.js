// Local demonstration only: bounded memory, no persistence or authentication.
export function createCollector({ limit = 1000, maxBytes = 65536 } = {}) {
  const events = [];
  return function collector(req, res, next) {
    if (req.url?.split("?")[0] !== "/__monitor/events") return next();
    const reply = (status, data) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(data));
    };
    if (req.headers["sec-fetch-site"] === "cross-site") return reply(403, { error: "same-origin only" });
    if (req.method === "GET") return reply(200, events);
    if (req.method === "DELETE") { events.length = 0; return reply(200, { cleared: true }); }
    if (req.method !== "POST") return reply(405, { error: "method not allowed" });
    if (!(req.headers["content-type"] || "").startsWith("application/json")) return reply(415, { error: "JSON required" });
    let bytes = 0;
    let chunks = [];
    let rejected = false;
    req.on("data", chunk => {
      if (rejected) return;
      bytes += chunk.length;
      if (bytes > maxBytes) { rejected = true; chunks = []; reply(413, { error: "payload too large" }); }
      else chunks.push(chunk);
    });
    req.on("error", () => { if (!res.headersSent) reply(400, { error: "request failed" }); });
    req.on("end", () => {
      if (rejected) return;
      try {
        const event = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!event || typeof event !== "object" || Array.isArray(event) || typeof event.kind !== "string") {
          return reply(400, { error: "event.kind is required" });
        }
        events.push(event);
        if (events.length > limit) events.splice(0, events.length - limit);
        reply(202, { accepted: true });
      } catch { reply(400, { error: "invalid JSON" }); }
    });
  };
}
