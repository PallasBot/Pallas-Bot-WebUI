/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { setupReadmeCodeCopyButtons } from "../src/utils/readmeCodeCopy";
import { copyTextToClipboard } from "@/utils/clipboard";

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

  it("teardown unwraps so remount keeps click → check working (Strict Mode)", async () => {
    const root = document.createElement("div");
    root.innerHTML = "<pre><code>echo hi</code></pre>";

    const first = setupReadmeCodeCopyButtons(root);
    expect(root.querySelectorAll(".readme-code-block").length).toBe(1);
    first();
    expect(root.querySelector(".readme-code-block")).toBeNull();
    expect(root.querySelector("pre")).not.toBeNull();

    const second = setupReadmeCodeCopyButtons(root);
    const btn = root.querySelector(".readme-code-block__copy");
    expect(btn).not.toBeNull();
    await (btn as HTMLButtonElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // click handler is async
    await vi.waitFor(() => {
      expect(btn?.getAttribute("aria-label")).toBe("已复制");
      expect(btn?.classList.contains("readme-code-block__copy--done")).toBe(true);
    });
    expect(copyTextToClipboard).toHaveBeenCalled();
    second();
  });
});
