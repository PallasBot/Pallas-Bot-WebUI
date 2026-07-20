import { describe, expect, it, vi } from "vitest";

vi.mock("../src/api/http", () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe("git mirror api", async () => {
  it("fetchGitMirrorInfo calls /git-mirror/info", async () => {
    const { http } = await import("../src/api/http");
    const { fetchGitMirrorInfo } = await import("../src/api/consoleApi");
    vi.mocked(http.get).mockResolvedValue({
      data: {
        ok: true,
        data: {
          preferred_id: "github",
          custom_proxy_prefix: "",
          available_mirrors: [{ id: "github", label: "GitHub 官方", type: "default" }],
          plugins: [],
        },
      },
    } as never);

    await expect(fetchGitMirrorInfo()).resolves.toMatchObject({ preferred_id: "github" });
    expect(http.get).toHaveBeenCalledWith("/git-mirror/info", undefined);
  });

  it("putGitMirrorPreferred posts body to /git-mirror/preferred", async () => {
    const { http } = await import("../src/api/http");
    const { putGitMirrorPreferred } = await import("../src/api/consoleApi");
    vi.mocked(http.put).mockResolvedValue({
      data: {
        ok: true,
        data: {
          preferred_id: "ghproxy-vip",
          custom_proxy_prefix: "",
          available_mirrors: [],
          plugins: [],
        },
      },
    } as never);

    await putGitMirrorPreferred({ preferred_id: "ghproxy-vip" });
    expect(http.put).toHaveBeenCalledWith(
      "/git-mirror/preferred",
      { preferred_id: "ghproxy-vip", custom_proxy_prefix: "" },
      undefined,
    );
  });

  it("postGitMirrorApplyCommunity calls apply-community", async () => {
    const { http } = await import("../src/api/http");
    const { postGitMirrorApplyCommunity } = await import("../src/api/consoleApi");
    vi.mocked(http.post).mockResolvedValue({
      data: {
        ok: true,
        data: {
          results: [],
          summary: { total: 0, success_count: 0, fail_count: 0 },
        },
      },
    } as never);

    await postGitMirrorApplyCommunity();
    expect(http.post).toHaveBeenCalledWith("/git-mirror/apply-community", {}, undefined);
  });

  it("postGitMirrorApplyPlugin encodes plugin id in path", async () => {
    const { http } = await import("../src/api/http");
    const { postGitMirrorApplyPlugin } = await import("../src/api/consoleApi");
    vi.mocked(http.post).mockResolvedValue({
      data: { ok: true, data: { id: "demo", success: true, message: "ok" } },
    } as never);

    await postGitMirrorApplyPlugin("demo plugin");
    expect(http.post).toHaveBeenCalledWith("/git-mirror/apply-plugin/demo%20plugin", {}, undefined);
  });

  it("postGitMirrorProbe calls /git-mirror/probe", async () => {
    const { http } = await import("../src/api/http");
    const { postGitMirrorProbe } = await import("../src/api/consoleApi");
    vi.mocked(http.post).mockResolvedValue({
      data: { ok: true, data: { ok: true, mirror_id: "github" } },
    } as never);

    await expect(postGitMirrorProbe()).resolves.toEqual({ ok: true, mirror_id: "github" });
    expect(http.post).toHaveBeenCalledWith("/git-mirror/probe", {}, undefined);
  });
});
