import { describe, expect, it } from "vitest";
import {
  appendPluginStoreQueueTask,
  formatPluginStoreActiveHint,
  formatPluginStoreBatchCompleteHint,
  formatPluginStoreEnqueuedHint,
  formatPluginStoreInstallProgressHint,
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
    expect(withPluginStoreQueueSuffix("安装中：牛牛画画", 2)).toBe("安装中：牛牛画画（队列中还有 2 项）");
    expect(withPluginStoreQueueSuffix("安装中：牛牛画画", 0)).toBe("安装中：牛牛画画");
    expect(formatPluginStoreEnqueuedHint("install", "牛牛画画", 3)).toBe("已加入队列：安装 牛牛画画（待处理 3 项）");
    expect(formatPluginStoreActiveHint("update", "牛牛互动")).toBe("正在更新 牛牛互动…");
    expect(formatPluginStoreInstallProgressHint(
      "开始install pallas-plugin-draw…",
      "牛牛画画",
      "pallas-plugin-draw",
      "install",
    )).toBe("正在安装 牛牛画画…");
    expect(formatPluginStoreBatchCompleteHint(3)).toBe("已完成 3 项安装/更新。");
    expect(formatPluginStoreBatchCompleteHint(1)).toBe("");
  });
});
