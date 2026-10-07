let lastEvent = "";
export function startEventCapture() {
["click", "touchstart", "mousedown", "keydown", "mouseover"].forEach(
  (eventType) => {
    document.addEventListener(
      eventType,
      (event) => {
        lastEvent = event;
      },
      {
        capture: true,
        passive: true,
      }
    );
  }
);
}
export default function () {
  return lastEvent;
}
