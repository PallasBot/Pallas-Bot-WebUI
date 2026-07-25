/** 主题无关的固定彩色（饼图等需区分切片时用，不跟 accent / 黑白预设） */
export const FIXED_CHART_PALETTE = [
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#38bdf8",
  "#f97316",
  "#c4b5fd",
  "#2dd4bf",
] as const;

const CHART_PALETTE_FALLBACK = [...FIXED_CHART_PALETTE];

/** 固定彩色色板；不读 CSS 变量，黑白/主题切换也不变色 */
export function fixedChartPalette(count = 8): string[] {
  const n = Math.max(1, count);
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push(FIXED_CHART_PALETTE[i % FIXED_CHART_PALETTE.length]!);
  }
  return out;
}

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
