import { describe, expect, it, vi } from "vitest";

vi.mock("../src/api/http", () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("fetchPluginStoreReadme", async () => {
  it("loads cached markdown from backend api", async () => {
    const { http } = await import("../src/api/http");
    const { fetchPluginStoreReadme } = await import("../src/api/consoleApi");
    vi.mocked(http.get).mockResolvedValue({
      data: {
        ok: true,
        data: {
          kind: "official",
          id: "pallas-plugin-draw",
          markdown: "# Draw\n",
        },
      },
    } as never);

    await expect(fetchPluginStoreReadme("official", "pallas-plugin-draw")).resolves.toBe("# Draw\n");
    expect(http.get).toHaveBeenCalledWith("/plugins/store/readme", {
      params: { kind: "official", id: "pallas-plugin-draw" },
    });
  });
});

describe("refreshPluginStore", async () => {
  it("calls backend aggregate refresh api", async () => {
    const { http } = await import("../src/api/http");
    const { refreshPluginStore } = await import("../src/api/consoleApi");
    vi.mocked(http.post).mockResolvedValue({
      data: {
        ok: true,
        data: {
          store_assets: { checked_at: 111, official_count: 2, community_count: 3 },
          update_snapshot: { checked_at: 222, official_count: 2, community_count: 3 },
        },
      },
    } as never);

    await expect(refreshPluginStore()).resolves.toEqual({
      store_assets: { checked_at: 111, official_count: 2, community_count: 3 },
      update_snapshot: { checked_at: 222, official_count: 2, community_count: 3 },
    });
    expect(http.post).toHaveBeenCalledWith("/plugins/store/refresh", {}, { timeout: 120_000 });
  });
});
