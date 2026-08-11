import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const get = vi.fn();
const post = vi.fn();

vi.mock("@/api/http", () => ({
  http: { get, post },
  DB_BACKUP_TIMEOUT_MS: 0,
  DB_HEAVY_READ_TIMEOUT_MS: 0,
}));

describe("表情标签全局观测 API", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    get.mockResolvedValue({ data: { ok: true, data: {} } });
    post.mockResolvedValue({ data: { ok: true, data: {} } });
  });

  it("不把全局标签统计附加到群范围参数", async () => {
    const { fetchLlmStickerLabelOverview } = await import("@/api/console");

    await fetchLlmStickerLabelOverview();

    expect(get).toHaveBeenCalledWith("/common-config/llm/persona/sticker-labels");
  });

  it("维护请求只传动作需要的字段", async () => {
    const { postLlmStickerLabelManage } = await import("@/api/console");

    await postLlmStickerLabelManage({ action: "clear", contentHash: "a".repeat(64) });

    expect(post).toHaveBeenCalledWith("/common-config/llm/persona/sticker-labels/manage", {
      action: "clear",
      content_hash: "a".repeat(64),
    });
  });
});

describe("表情标签全局维护入口", () => {
  it("在群表达页使用独立全局查询和有限维护动作", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/ai/AiPersonaPage.tsx"), "utf8");

    expect(source).toContain("fetchLlmStickerLabelOverview");
    expect(source).toContain('queryKey: ["llm-sticker-label-overview"]');
    expect(source).toContain('action: "requeue"');
    expect(source).toContain('action: "pause"');
    expect(source).toContain('label="VLM 精修避免"');
    expect(source).toContain("data.vlm_refine_avoided");
    expect(source).toContain('label="VLM 精修实际"');
    expect(source).toContain("data.vlm_refine_actual");
    expect(source).not.toContain("fetchLlmStickerLabelOverview({");
    expect(source).not.toContain("全量扫描");
  });
});
