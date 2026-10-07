export default function getUserAgent(ua = globalThis.navigator?.userAgent ?? "") {
  for (const pattern of [/Edg(?:e|A|iOS)?\/[\d.]+/, /OPR\/[\d.]+/, /Opera\/[\d.]+/,
    /(?:UBrowser|QQBrowser)\/[\d.]+/, /(?:Firefox|FxiOS)\/[\d.]+/, /(?:Chrome|CriOS)\/[\d.]+/]) {
    const match = String(ua).match(pattern);
    if (match) return match[0];
  }
  const safari = String(ua).match(/Version\/([\d.]+).*Safari\//);
  return safari ? "Safari/" + safari[1] : "Unknown";
}
