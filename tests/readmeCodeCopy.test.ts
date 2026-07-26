/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { setupReadmeCodeCopyButtons } from "../src/utils/readmeCodeCopy";

vi.mock("@/utils/clipboard", () => ({
  copyTextToClipboard: vi.fn(async () => true),
}));

describe("setupReadmeCodeCopyButtons", () => {
  it("wraps pre blocks and adds ghost copy buttons", () => {
    const root = document.createElement("div");
    root.innerHTML = "<pre><code>uv run pallas ext install draw</code></pre>";
    const teardown = setupReadmeCodeCopyButtons(root);
    expect(root.querySelector(".readme-code-block")).not.toBeNull();
    const btn = root.querySelector(".readme-code-block__copy");
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute("aria-label")).toBe("复制代码");
    expect(btn?.querySelector("svg")).not.toBeNull();
    teardown();
  });
});
