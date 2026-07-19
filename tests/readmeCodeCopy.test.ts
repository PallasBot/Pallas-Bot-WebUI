/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { setupReadmeCodeCopyButtons } from "../src/utils/readmeCodeCopy";

vi.mock("@/utils/clipboard", () => ({
  copyTextToClipboard: vi.fn(async () => true),
}));

describe("setupReadmeCodeCopyButtons", () => {
  it("wraps pre blocks and adds copy buttons", () => {
    const root = document.createElement("div");
    root.innerHTML = "<pre><code>uv run pallas ext install draw</code></pre>";
    const teardown = setupReadmeCodeCopyButtons(root);
    expect(root.querySelector(".readme-code-block")).not.toBeNull();
    expect(root.querySelector(".readme-code-block__copy")?.textContent).toBe("复制");
    teardown();
  });
});
