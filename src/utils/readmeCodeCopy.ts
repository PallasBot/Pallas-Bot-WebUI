import { copyTextToClipboard } from "@/utils/clipboard";

const COPY_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

const CHECK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function extractPreText(pre: HTMLPreElement): string {
  return (pre.textContent || "").replace(/\n$/, "");
}

/** 给 README / release notes 的 fenced `<pre>` 挂上幽灵 Copy 按钮。 */
export function setupReadmeCodeCopyButtons(container: HTMLElement): () => void {
  const disposers: Array<() => void> = [];

  for (const pre of container.querySelectorAll("pre")) {
    if (pre.closest(".readme-code-block")) continue;

    const wrapper = document.createElement("div");
    wrapper.className = "readme-code-block";
    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "readme-code-block__copy";
    btn.innerHTML = COPY_ICON;
    btn.setAttribute("aria-label", "复制代码");
    btn.title = "复制代码";
    wrapper.appendChild(btn);

    let resetTimer = 0;
    const onClick = async () => {
      const ok = await copyTextToClipboard(extractPreText(pre));
      if (!ok) return;
      btn.innerHTML = CHECK_ICON;
      btn.classList.add("readme-code-block__copy--done");
      btn.setAttribute("aria-label", "已复制");
      btn.title = "已复制";
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        btn.innerHTML = COPY_ICON;
        btn.classList.remove("readme-code-block__copy--done");
        btn.setAttribute("aria-label", "复制代码");
        btn.title = "复制代码";
      }, 1600);
    };

    btn.addEventListener("click", onClick);
    disposers.push(() => {
      window.clearTimeout(resetTimer);
      btn.removeEventListener("click", onClick);
    });
  }

  return () => {
    for (const dispose of disposers) dispose();
  };
}
