import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();

vi.mock("@/api/http", () => ({
  http: { get },
  DB_BACKUP_TIMEOUT_MS: 0,
  DB_HEAVY_READ_TIMEOUT_MS: 0,
}));

describe("群表达 API scope", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: { ok: true, data: {} } });
  });

  it("只发送当前 persona export 契约参数", async () => {
    const { fetchLlmPersonaExport } = await import("@/api/consoleApi");

    await fetchLlmPersonaExport({
      botId: 100,
      groupId: 42,
      plainText: "persona",
      purpose: "chat",
      includeRepeaterOverlay: true,
    } as Parameters<typeof fetchLlmPersonaExport>[0]);

    expect(get).toHaveBeenCalledWith("/common-config/llm/persona/export", {
      params: { bot_id: 100, group_id: 42, plain_text: "persona" },
    });
  });

  it("只发送当前 Bot、群和 group_chat scene", async () => {
    const { fetchLlmPersonaGroupStyle } = await import("@/api/consoleApi");

    await fetchLlmPersonaGroupStyle({
      botId: 100,
      groupId: 42,
      windowHours: 168,
    } as Parameters<typeof fetchLlmPersonaGroupStyle>[0]);

    expect(get).toHaveBeenCalledWith("/common-config/llm/persona/group-style", {
      params: { bot_id: 100, group_id: 42, scene: "group_chat" },
    });
  });
});
