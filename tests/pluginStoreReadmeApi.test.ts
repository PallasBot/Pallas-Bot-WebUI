import { describe, expect, it, vi } from "vitest";

vi.mock("../src/api/http", () => ({
  http: {
    get: vi.fn(),
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
