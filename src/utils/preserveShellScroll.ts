/** 控制台主滚动容器（见 app.css `.shell__main-inner`）。 */
export function shellMainScrollRoot(): HTMLElement {
  return document.querySelector<HTMLElement>(".shell__main-inner") ?? document.documentElement;
}

/**
 * 同页切换视图时保持锚点（默认工具条）在视口中的位置。
 * 比硬还原 scrollTop 更稳：总览→短内容时绝对 scrollY 会被夹到接近顶部。
 */
export function preserveShellMainScroll(
  update: () => void,
  anchorSelector = ".console-hub-page__chrome-tools, .chrome-tools",
): void {
  const scrollRoot = shellMainScrollRoot();
  const anchor = document.querySelector<HTMLElement>(anchorSelector);
  const beforeTop = anchor?.getBoundingClientRect().top ?? 0;

  update();

  const restore = () => {
    const el = document.querySelector<HTMLElement>(anchorSelector);
    if (!el) return;
    const delta = el.getBoundingClientRect().top - beforeTop;
    if (Math.abs(delta) < 0.5) return;
    if (scrollRoot === document.documentElement) window.scrollBy(0, delta);
    else scrollRoot.scrollTop += delta;
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(restore);
    // hash 对上面板 id 时浏览器可能稍后 scrollIntoView
    window.setTimeout(restore, 0);
    window.setTimeout(restore, 50);
  });
}
