if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class implements ResizeObserver {
      constructor(_callback: ResizeObserverCallback) {}
      observe(_target: Element) {}
      unobserve(_target: Element) {}
      disconnect() {}
    };
  }

  // jsdom 未实现 Pointer Events 的捕获 API，Radix 在 pointerdown 时会直接调用。
  if (typeof Element !== "undefined") {
    if (typeof Element.prototype.hasPointerCapture !== "function") {
      Element.prototype.hasPointerCapture = () => false;
    }
    if (typeof Element.prototype.setPointerCapture !== "function") {
      Element.prototype.setPointerCapture = () => {};
    }
    if (typeof Element.prototype.releasePointerCapture !== "function") {
      Element.prototype.releasePointerCapture = () => {};
    }
    if (typeof Element.prototype.scrollIntoView !== "function") {
      Element.prototype.scrollIntoView = () => {};
    }
  }

  const escapeDomId = (value: string) => value.replace(/["\\]/g, "\\$&");

  if (typeof navigator !== "undefined" && typeof navigator.platform === "undefined") {
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      value: "Linux x86_64",
    });
  }

  if (typeof globalThis.CSS === "undefined") {
    Object.defineProperty(globalThis, "CSS", {
      configurable: true,
      value: { escape: escapeDomId },
    });
  } else if (typeof globalThis.CSS.escape === "undefined") {
    Object.defineProperty(globalThis.CSS, "escape", {
      configurable: true,
      value: escapeDomId,
    });
  }
}
