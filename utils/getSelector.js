export default function getSelector(path) {
  if (!Array.isArray(path)) return "";
  return [...path].reverse().filter(node => node?.nodeType === 1 && typeof node.nodeName === "string")
    .slice(-8).map(node => {
      const tag = node.nodeName.toLowerCase();
      // Avoid arbitrary ids/classes, which can contain personal identifiers.
      return tag;
    }).join(" > ");
}
