/** 控制台主滚动容器（见 app.css `.shell__main-inner`）。 */
export function shellMainScrollRoot(): HTMLElement {
  return document.querySelector<HTMLElement>(".shell__main-inner") ?? document.documentElement;
}

export function readShellMainScrollTop(): number {
  const scrollRoot = shellMainScrollRoot();
  return scrollRoot === document.documentElement ? window.scrollY : scrollRoot.scrollTop;
}

export function writeShellMainScrollTop(top: number): void {
  const scrollRoot = shellMainScrollRoot();
  if (scrollRoot === document.documentElement) window.scrollTo(0, top);
  else scrollRoot.scrollTop = top;
}

/**
 * 短暂钉住主区 scrollTop（Select / hash 切换时手机端易被 focus、RemoveScroll 顶走）。
 */
export function freezeShellMainScroll(durationMs = 120): () => void {
  const top = readShellMainScrollTop();
  let alive = true;
  const pin = () => {
    if (!alive) return;
    if (Math.abs(readShellMainScrollTop() - top) > 0.5) writeShellMainScrollTop(top);
  };
  const raf1 = requestAnimationFrame(() => {
    pin();
    requestAnimationFrame(pin);
  });
  const t0 = window.setTimeout(pin, 0);
  const t1 = window.setTimeout(pin, 50);
  const t2 = window.setTimeout(pin, durationMs);
  return () => {
    alive = false;
    cancelAnimationFrame(raf1);
    window.clearTimeout(t0);
    window.clearTimeout(t1);
    window.clearTimeout(t2);
  };
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
  const beforeScroll = readShellMainScrollTop();

  update();

  const restore = () => {
    const el = document.querySelector<HTMLElement>(anchorSelector);
    if (el) {
      const delta = el.getBoundingClientRect().top - beforeTop;
      if (Math.abs(delta) >= 0.5) {
        if (scrollRoot === document.documentElement) window.scrollBy(0, delta);
        else scrollRoot.scrollTop += delta;
        return;
      }
    }
    if (Math.abs(readShellMainScrollTop() - beforeScroll) > 0.5) {
      writeShellMainScrollTop(beforeScroll);
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(restore);
    // hash 对上面板 id 时浏览器可能稍后 scrollIntoView
    window.setTimeout(restore, 0);
    window.setTimeout(restore, 50);
    window.setTimeout(restore, 120);
  });
}
