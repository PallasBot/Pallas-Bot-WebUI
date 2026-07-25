import { describe, expect, it } from "vitest";
import type { CommunityPluginRow, OfficialExtensionRow, PluginRow } from "@/api/pallasTypes";
import { resolvePluginReadmeTarget } from "@/utils/pluginReadmeTarget";

function pluginRow(overrides: Partial<PluginRow> = {}): PluginRow {
  return {
    name: "draw",
    module: "draw",
    metadata: { name: "画画" },
    ...overrides,
  };
}

describe("resolvePluginReadmeTarget", () => {
  const official: OfficialExtensionRow[] = [
    {
      package: "pallas-plugin-draw",
      plugin_ids: ["draw"],
      repository_url: "https://github.com/PallasBot/Plugin-Draw",
    } as OfficialExtensionRow,
  ];

  const community: CommunityPluginRow[] = [
    {
      plugin_id: "interact",
      repository_url: "https://github.com/example/interact",
    } as CommunityPluginRow,
  ];

  it("maps official extension plugins by plugin id", () => {
    expect(resolvePluginReadmeTarget(pluginRow({ name: "draw" }), official, community)).toEqual({
      kind: "official",
      id: "pallas-plugin-draw",
      repositoryUrl: "https://github.com/PallasBot/Plugin-Draw",
    });
  });

  it("maps community plugins by plugin id", () => {
    expect(
      resolvePluginReadmeTarget(
        pluginRow({ name: "interact", plugin_source: "local", plugin_source_dir: "local/plugins/interact" }),
        official,
        community,
      ),
    ).toEqual({
      kind: "community",
      id: "interact",
      repositoryUrl: "https://github.com/example/interact",
    });
  });

  it("falls back to official kind with plugin id", () => {
    expect(resolvePluginReadmeTarget(pluginRow({ name: "help" }), official, community)).toEqual({
      kind: "official",
      id: "help",
      repositoryUrl: null,
    });
  });
});
