/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import {
  PLUGIN_STORE_SEEN_IDS_KEY,
  countNewPluginStoreIds,
  ensurePluginStoreSeenBaseline,
  listUnseenPluginStoreIds,
  markPluginStoreIdsSeen,
  pluginStoreNoticeLabel,
  summarizePluginStoreNotice,
} from "./pluginStoreNotice";

afterEach(() => {
  localStorage.removeItem(PLUGIN_STORE_SEEN_IDS_KEY);
});

describe("pluginStoreNotice", () => {
  it("first baseline seeds without treating catalog as new", () => {
    const s = summarizePluginStoreNotice({
      catalogIds: ["a", "b"],
      updateCount: 0,
    });
    expect(s.newCount).toBe(0);
    expect(s.label).toBeNull();
  });

  it("counts ids not in seen as new", () => {
    ensurePluginStoreSeenBaseline(["a"]);
    expect(countNewPluginStoreIds(["a", "b"], ensurePluginStoreSeenBaseline(["a"]))).toBe(1);
    const s = summarizePluginStoreNotice({ catalogIds: ["a", "b"], updateCount: 2 });
    expect(s.newCount).toBe(1);
    expect(s.updateCount).toBe(2);
    expect(s.label).toContain("可更新");
    expect(s.label).toContain("上新");
  });

  it("mark seen clears new but not update count in summarize", () => {
    ensurePluginStoreSeenBaseline(["a"]);
    markPluginStoreIdsSeen(["a", "b"]);
    const s = summarizePluginStoreNotice({ catalogIds: ["a", "b"], updateCount: 1 });
    expect(s.newCount).toBe(0);
    expect(s.updateCount).toBe(1);
    expect(pluginStoreNoticeLabel(s)).toBe("有 1 个可更新");
  });

  it("listUnseen returns empty without baseline and unseen after baseline", () => {
    expect(listUnseenPluginStoreIds(["a", "b"])).toEqual([]);
    ensurePluginStoreSeenBaseline(["a"]);
    expect(listUnseenPluginStoreIds(["a", "b"])).toEqual(["b"]);
  });

  it("empty catalog does not persist a baseline that would mark whole store as new", () => {
    ensurePluginStoreSeenBaseline([]);
    expect(localStorage.getItem(PLUGIN_STORE_SEEN_IDS_KEY)).toBeNull();
    expect(listUnseenPluginStoreIds(["a", "b"])).toEqual([]);
    const s = summarizePluginStoreNotice({ catalogIds: ["a", "b"], updateCount: 1 });
    expect(s.newCount).toBe(0);
    expect(s.updateCount).toBe(1);
  });

  it("legacy empty-array baseline is treated as missing", () => {
    localStorage.setItem(PLUGIN_STORE_SEEN_IDS_KEY, "[]");
    expect(listUnseenPluginStoreIds(["a", "b"])).toEqual([]);
    const s = summarizePluginStoreNotice({ catalogIds: ["a", "b"], updateCount: 0 });
    expect(s.newCount).toBe(0);
    expect(s.label).toBeNull();
  });
});
