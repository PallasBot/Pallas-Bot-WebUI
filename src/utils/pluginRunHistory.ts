const STORAGE_KEY = "pallas_home_plugin_run_hist_v1";
const MAX_POINTS = 72;
const MIN_GAP_MS = 15_000;

export type PluginRunSample = {
  t: number;
  total: number;
  plugins: Record<string, number>;
};

type Store = Record<string, PluginRunSample[]>;

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return {};
    return data as Store;
  } catch {
    return {};
  }
}

function save(data: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function readPluginRunSeries(selfId: string): PluginRunSample[] {
  const map = load();
  return [...(map[selfId] ?? [])];
}

/** 将本机 Matcher 累计采样序列转为 SVG polyline points（至少 2 个点） */
export function buildPluginRunSparkPoly(
  series: PluginRunSample[],
  width = 100,
  height = 44,
): string | undefined {
  if (series.length < 2) return undefined;
  const minT = Math.min(...series.map((x) => x.t));
  const maxT = Math.max(...series.map((x) => x.t));
  const totals = series.map((x) => x.total);
  const minV = Math.min(...totals);
  const maxV = Math.max(...totals);
  const dr = maxT - minT || 1;
  const dv = maxV - minV || 1e-6;
  const h = height;
  return series
    .map((pt) => {
      const x = ((pt.t - minT) / dr) * width;
      const y = h - ((pt.total - minV) / dv) * (h - 8) - 4;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function formatPluginRunSampleTime(t: number): string {
  const d = new Date(t);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

/** 在总览拉取到插件统计后写入一条样本，供折线图使用（仅浏览器本地）。 */
export function pushPluginRunSample(
  selfId: string,
  total: number,
  plugins: Array<{ name: string; runs_today: number }>,
): void {
  const sid = selfId.trim();
  if (!sid) return;
  const map = load();
  const list = [...(map[sid] ?? [])];
  const now = Date.now();
  const last = list[list.length - 1];
  if (last && last.total === total && now - last.t < MIN_GAP_MS) {
    return;
  }
  const pluginsObj: Record<string, number> = {};
  for (const p of plugins) {
    pluginsObj[p.name] = p.runs_today;
  }
  list.push({ t: now, total, plugins: pluginsObj });
  map[sid] = list.slice(-MAX_POINTS);
  save(map);
}
