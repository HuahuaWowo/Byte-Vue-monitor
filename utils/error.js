export function extractErrorStack(stack) {
  if (typeof stack !== "string") return [];
  const frames = [];
  for (const line of stack.split("\n").slice(0, 51)) {
    const chrome = line.trim().match(/^at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
    const firefox = !chrome && line.match(/^(.*?)@(.+?):(\d+):(\d+)$/);
    const match = chrome || firefox;
    if (match) frames.push({ func: match[1] || "", url: match[2], line: Number(match[3]), column: Number(match[4]) });
  }
  return frames;
}
export function errorDetails(reason) {
  try {
    if (reason && typeof reason === "object") {
      let message = reason.message;
      if (typeof message !== "string") {
        try { message = JSON.stringify(reason); } catch { message = String(reason); }
      }
      return { name: String(reason.name || "Error"), message: String(message ?? reason), stack: extractErrorStack(reason.stack) };
    }
    return { name: "Error", message: String(reason), stack: [] };
  } catch {
    return { name: "Error", message: "[unreadable error]", stack: [] };
  }
}
