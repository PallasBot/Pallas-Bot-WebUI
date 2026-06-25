import { describe, expect, it } from "vitest";
import {
  appendPluginStoreQueueTask,
  formatPluginStoreEnqueuedHint,
  isPluginStoreTaskQueued,
  withPluginStoreQueueSuffix,
} from "@/utils/pluginStoreActionQueue";

describe("pluginStoreActionQueue", () => {
  it("deduplicates queued tasks by kind, key and action", () => {
    const queue = appendPluginStoreQueueTask([], {
      kind: "official",
      key: "pallas-plugin-draw",
      action: "install",
    });
    const next = appendPluginStoreQueueTask(queue, {
      kind: "official",
      key: "pallas-plugin-draw",
      action: "install",
    });
    expect(next).toHaveLength(1);
    expect(isPluginStoreTaskQueued(next, {
      kind: "official",
      key: "pallas-plugin-draw",
      action: "update",
    })).toBe(false);
  });

  it("formats queue hints", () => {
    expect(withPluginStoreQueueSuffix("安装中：draw", 2)).toBe("安装中：draw（队列中还有 2 项）");
    expect(withPluginStoreQueueSuffix("安装中：draw", 0)).toBe("安装中：draw");
    expect(formatPluginStoreEnqueuedHint("install", "draw", 3)).toBe("已加入队列：安装 draw（待处理 3 项）");
  });
});
