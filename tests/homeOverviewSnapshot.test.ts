import { afterEach, describe, expect, it } from "vitest";
import {
  HOME_OVERVIEW_SNAPSHOT_STALE_MS,
  applyHomeOverviewSnapshot,
  persistHomeOverviewSnapshot,
  readHomeOverviewSnapshotFresh,
  readHomeOverviewSnapshotStale,
  snapshotCanPrimeHomeShell,
} from "@/utils/homeOverviewSnapshot";
import type { SystemData } from "@/api/pallasTypes";

const systemStub = { runtime: { cpu_percent: 12 } } as SystemData;

describe("homeOverviewSnapshot", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("round-trips snapshot fields", () => {
    persistHomeOverviewSnapshot({
      system: systemStub,
      stats: null,
      pluginRunStats: null,
      communityStats: null,
    });
    const stale = readHomeOverviewSnapshotStale();
    expect(stale?.system).toEqual(systemStub);
    expect(readHomeOverviewSnapshotFresh()?.system).toEqual(systemStub);
  });

  it("applyHomeOverviewSnapshot only fills present slices", () => {
    const target = {
      system: null,
      stats: null,
      pluginRunStats: null,
      communityStats: null,
    };
    applyHomeOverviewSnapshot(
      {
        savedAt: Date.now(),
        system: systemStub,
        stats: null,
        pluginRunStats: null,
        communityStats: null,
      },
      target,
    );
    expect(target.system).toEqual(systemStub);
    expect(target.stats).toBeNull();
  });

  it("drops snapshot older than stale window", () => {
    sessionStorage.setItem(
      "pallas_home_overview_snapshot_v1",
      JSON.stringify({
        savedAt: Date.now() - HOME_OVERVIEW_SNAPSHOT_STALE_MS - 1,
        system: systemStub,
        stats: null,
        pluginRunStats: null,
        communityStats: null,
      }),
    );
    expect(readHomeOverviewSnapshotStale()).toBeNull();
  });

  it("snapshotCanPrimeHomeShell requires system slice", () => {
    expect(snapshotCanPrimeHomeShell(null)).toBe(false);
    expect(
      snapshotCanPrimeHomeShell({
        savedAt: Date.now(),
        system: systemStub,
        stats: null,
        pluginRunStats: null,
        communityStats: null,
      }),
    ).toBe(true);
  });
});
