/** 数据看板插件展示筛选（按账号 + 图表面板记忆）。 */

export type ChartsPluginFilterScope = "rank" | "matcher";

export const CHARTS_PLUGIN_FILTER_KEY_PREFIX = "pallas.charts.plugin-filter.v1.";

/** 旧版共用键（无 scope）；仅用于 rank 回退读取一次。 */
const CHARTS_PLUGIN_FILTER_LEGACY_PREFIX = "pallas.charts.plugin-filter.v1.";

export type ChartsPluginFilterState = {
  /** auto：按调用量自动 Top；custom：用户点选 */
  mode: "auto" | "custom";
  selected: string[];
};

export function chartsPluginFilterStorageKey(
  account: number,
  scope: ChartsPluginFilterScope,
): string {
  return `${CHARTS_PLUGIN_FILTER_KEY_PREFIX}${scope}.${Math.floor(account)}`;
}

function parseFilterRaw(raw: string | null): ChartsPluginFilterState {
  if (!raw) return { mode: "auto", selected: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<ChartsPluginFilterState>;
    const selected = Array.isArray(parsed.selected)
      ? parsed.selected.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    const mode = parsed.mode === "custom" ? "custom" : "auto";
    return { mode, selected };
  } catch {
    return { mode: "auto", selected: [] };
  }
}

export function readChartsPluginFilter(
  account: number | null,
  scope: ChartsPluginFilterScope,
): ChartsPluginFilterState {
  if (account == null) return { mode: "auto", selected: [] };
  try {
    const key = chartsPluginFilterStorageKey(account, scope);
    const raw = localStorage.getItem(key);
    if (raw) return parseFilterRaw(raw);
    // 兼容：旧版无 scope 的键当作 rank 初始值
    if (scope === "rank") {
      const legacy = localStorage.getItem(
        `${CHARTS_PLUGIN_FILTER_LEGACY_PREFIX}${Math.floor(account)}`,
      );
      if (legacy) return parseFilterRaw(legacy);
    }
    return { mode: "auto", selected: [] };
  } catch {
    return { mode: "auto", selected: [] };
  }
}

export function writeChartsPluginFilter(
  account: number | null,
  scope: ChartsPluginFilterScope,
  state: ChartsPluginFilterState,
): void {
  if (account == null) return;
  try {
    localStorage.setItem(chartsPluginFilterStorageKey(account, scope), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function resolveDisplayedPlugins(
  candidates: string[],
  filter: ChartsPluginFilterState,
  autoLimit: number,
): string[] {
  const available = candidates.filter(Boolean);
  if (!available.length) return [];
  if (filter.mode === "custom" && filter.selected.length) {
    const picked = filter.selected.filter((id) => available.includes(id));
    if (picked.length) return picked;
  }
  return available.slice(0, Math.max(1, autoLimit));
}
