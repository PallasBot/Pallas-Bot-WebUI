import { copyTextToClipboard } from "@/utils/clipboard";

function extractPreText(pre: HTMLPreElement): string {
  return (pre.textContent || "").replace(/\n$/, "");
}

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
    btn.textContent = "复制";
    btn.setAttribute("aria-label", "复制代码");
    wrapper.appendChild(btn);

    const onClick = async () => {
      const ok = await copyTextToClipboard(extractPreText(pre));
      if (!ok) return;
      const prev = btn.textContent;
      btn.textContent = "已复制";
      btn.classList.add("readme-code-block__copy--done");
      window.setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove("readme-code-block__copy--done");
      }, 1600);
    };

    btn.addEventListener("click", onClick);
    disposers.push(() => btn.removeEventListener("click", onClick));
  }

  return () => {
    for (const dispose of disposers) dispose();
  };
}
