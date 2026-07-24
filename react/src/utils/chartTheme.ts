const CHART_PALETTE_FALLBACK = [
  "#a78bfa",
  "#c4b5fd",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#38bdf8",
  "#94a3b8",
  "#fcd34d",
];

/** 读取 :root 上 --chart-palette-1…N（随 accent / 主题变化） */
export function readChartPalette(count = 8): string[] {
  if (typeof document === "undefined") {
    return CHART_PALETTE_FALLBACK.slice(0, count);
  }
  const style = getComputedStyle(document.documentElement);
  const out: string[] = [];
  for (let i = 1; i <= count; i += 1) {
    const v = style.getPropertyValue(`--chart-palette-${i}`).trim();
    if (v) out.push(v);
  }
  return out.length > 0 ? out : CHART_PALETTE_FALLBACK.slice(0, count);
}

/** 监听 html 主题属性变化，刷新图表取色 */
export function installChartThemeWatcher(onChange: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-accent", "data-theme", "data-ui-preset"],
  });
  return () => obs.disconnect();
}
