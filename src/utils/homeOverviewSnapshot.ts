/**
 * 首页概况 session 快照：冷启动先展示上次数据，网络返回后再刷新（stale-while-revalidate）。
 */
import type {
  BotRow,
  CommunityStatsData,
  InstancesData,
  MessageStatsData,
  PluginRunStatsData,
  SystemData,
} from "@/api/pallasTypes";

const STORAGE_KEY = "pallas_home_overview_snapshot_v1";
/** 5 分钟内视为新鲜，可不触发紧迫感刷新 */
export const HOME_OVERVIEW_SNAPSHOT_FRESH_MS = 5 * 60_000;
/** 超过 30 分钟仍可用于首屏铺底，但必定后台重拉 */
export const HOME_OVERVIEW_SNAPSHOT_STALE_MS = 30 * 60_000;

export type HomeOverviewSnapshot = {
  savedAt: number;
  system: SystemData | null;
  bots: BotRow[];
  instances: InstancesData | null;
  stats: MessageStatsData | null;
  pluginRunStats: PluginRunStatsData | null;
  communityStats: CommunityStatsData | null;
};

export type HomeOverviewSnapshotFields = {
  system: SystemData | null;
  bots: BotRow[];
  instances: InstancesData | null;
  stats: MessageStatsData | null;
  pluginRunStats: PluginRunStatsData | null;
  communityStats: CommunityStatsData | null;
};

function parseSnapshot(raw: string | null): HomeOverviewSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as HomeOverviewSnapshot;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readHomeOverviewSnapshotStale(): HomeOverviewSnapshot | null {
  if (typeof sessionStorage === "undefined") return null;
  const snap = parseSnapshot(sessionStorage.getItem(STORAGE_KEY));
  if (!snap) return null;
  if (Date.now() - snap.savedAt > HOME_OVERVIEW_SNAPSHOT_STALE_MS) return null;
  return snap;
}

export function readHomeOverviewSnapshotFresh(): HomeOverviewSnapshot | null {
  const snap = readHomeOverviewSnapshotStale();
  if (!snap) return null;
  if (Date.now() - snap.savedAt > HOME_OVERVIEW_SNAPSHOT_FRESH_MS) return null;
  return snap;
}

export function applyHomeOverviewSnapshot(
  snap: HomeOverviewSnapshot,
  target: HomeOverviewSnapshotFields,
): void {
  if (snap.system) target.system = snap.system;
  if (snap.bots?.length) target.bots = snap.bots;
  if (snap.instances) target.instances = snap.instances;
  if (snap.stats) target.stats = snap.stats;
  if (snap.pluginRunStats) target.pluginRunStats = snap.pluginRunStats;
  if (snap.communityStats) target.communityStats = snap.communityStats;
}

export function persistHomeOverviewSnapshot(fields: HomeOverviewSnapshotFields): void {
  if (typeof sessionStorage === "undefined") return;
  const snap: HomeOverviewSnapshot = {
    savedAt: Date.now(),
    system: fields.system,
    bots: fields.bots,
    instances: fields.instances,
    stats: fields.stats,
    pluginRunStats: fields.pluginRunStats,
    communityStats: fields.communityStats,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    /* quota / private mode */
  }
}

export function snapshotCanPrimeHomeShell(snap: HomeOverviewSnapshot | null): boolean {
  if (!snap) return false;
  if (snap.system) return true;
  return Boolean(snap.bots?.length && snap.instances);
}
