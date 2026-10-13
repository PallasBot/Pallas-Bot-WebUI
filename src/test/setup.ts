if (typeof window !== "undefined" && typeof document !== "undefined") {
  // @ts-expect-error wicg-inert does not publish TypeScript declarations.
  await import("wicg-inert");

  const escapeReactAriaId = (value: string) => value.replace(/["\\]/g, "\\$&");

  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class implements ResizeObserver {
      constructor(_callback: ResizeObserverCallback) {}
      observe(_target: Element) {}
      unobserve(_target: Element) {}
      disconnect() {}
    };
  }

  if (typeof navigator !== "undefined" && typeof navigator.platform === "undefined") {
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      value: "Linux x86_64",
    });
  }

  if (typeof globalThis.CSS === "undefined") {
    Object.defineProperty(globalThis, "CSS", {
      configurable: true,
      value: { escape: escapeReactAriaId },
    });
  } else if (typeof globalThis.CSS.escape === "undefined") {
    Object.defineProperty(globalThis.CSS, "escape", {
      configurable: true,
      value: escapeReactAriaId,
    });
  }

  // jsdom has no Web Animations API; react-aria's SharedElementTransition calls
  // getAnimations() in a layout effect when HeroUI Tabs/ListBox/Menu mount.
  if (typeof Element.prototype.getAnimations !== "function") {
    Element.prototype.getAnimations = () => [];
  }
}
