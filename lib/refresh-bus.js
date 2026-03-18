// Lightweight client-side event bus for cross-page refresh hints.
const EVENT_NAME = "exchange:data-changed";

export function emitDataChanged(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
}

export function onDataChanged(handler) {
  if (typeof window === "undefined" || typeof handler !== "function") {
    return () => {};
  }

  const listener = (event) => handler(event.detail ?? {});
  window.addEventListener(EVENT_NAME, listener);

  return () => window.removeEventListener(EVENT_NAME, listener);
}
