import { describe, expect, it } from "vitest";
import type { LlmRuntimeOverviewData } from "../src/api/pallasTypes";
import {
  buildRuntimeOverviewRows,
  mediaCapabilityLabel,
} from "../src/utils/runtimeOverviewRows";

function overviewWith(
  health: NonNullable<LlmRuntimeOverviewData["health"]>,
): LlmRuntimeOverviewData {
  return { health } as LlmRuntimeOverviewData;
}

describe("mediaCapabilityLabel", () => {
  it("maps known capability ids", () => {
    expect(mediaCapabilityLabel("image.generate")).toBe("绘图任务队列");
    expect(mediaCapabilityLabel("media.sing")).toBe("点歌运行时");
    expect(mediaCapabilityLabel("other.cap")).toBe("other.cap");
  });
});

describe("buildRuntimeOverviewRows", () => {
  it("merges image.generate queue into 绘图运行时 and skips duplicate capability row", () => {
    const rows = buildRuntimeOverviewRows(
      overviewWith({
        ok: true,
        image_health: {
          health_state: "unknown",
          circuit_state: "closed",
          consecutive_failures: 0,
        },
        media_tasks: {
          queue_depth: 1,
          active_tasks: 0,
          total_tasks: 2,
          health_state: "healthy",
          capabilities: [
            {
              capability: "image.generate",
              queue_depth: 1,
              active_tasks: 0,
              health_state: "healthy",
            },
            {
              capability: "media.sing",
              queue_depth: 0,
              active_tasks: 0,
              health_state: "healthy",
            },
          ],
        },
      }),
    );

    const titles = rows.map((row) => row.title);
    expect(titles).toEqual(["绘图运行时", "媒体任务平台", "点歌运行时"]);
    expect(titles).not.toContain("image.generate");
    expect(titles.filter((title) => title.includes("绘图")).length).toBe(1);

    const imageRow = rows.find((row) => row.id === "image.generate");
    expect(imageRow?.healthState).toBe("未知");
    expect(imageRow?.detail).toContain("任务队列 1");
    expect(imageRow?.detail).toContain("执行中 0");
    expect(imageRow?.queueDepth).toBe(1);
  });

  it("keeps 绘图任务队列 when image_health is absent", () => {
    const rows = buildRuntimeOverviewRows(
      overviewWith({
        ok: true,
        media_tasks: {
          queue_depth: 0,
          active_tasks: 0,
          total_tasks: 0,
          health_state: "healthy",
          capabilities: [
            {
              capability: "image.generate",
              queue_depth: 0,
              active_tasks: 0,
              health_state: "healthy",
            },
          ],
        },
      }),
    );

    expect(rows.map((row) => row.title)).toEqual(["媒体任务平台", "绘图任务队列"]);
    expect(rows.find((row) => row.id === "image.generate")?.healthState).toBe("正常");
  });
});
