function getSelector(path) {
  return path
    .reverse()
    .filter((element) => element !== document && element !== window)
    .map((element) => {
      let selector = "";
      if (element.id) {
        return `${element.nodeName.toLowerCase()}#${element.id}`;
      } else if (element.className && typeof element.className === "string") {
        return `${element.nodeName.toLowerCase()}.${element.className}`;
      } else {
        selector = element.nodeName.toLowerCase();
      }
      return selector;
    })
    .join(" ");
}

export default function (path) {
  if (Array.isArray(path)) {
    return getSelector(path);
  }
}
