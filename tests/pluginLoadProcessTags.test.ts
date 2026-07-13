import { describe, expect, it } from "vitest";
import { pluginLoadProcessTags } from "../src/utils/pluginLoadRoleLabel";
import type { PluginRow } from "../src/api/pallasTypes";

describe("pluginLoadProcessTags", () => {
  it("returns empty tags for unified deployment", () => {
    expect(pluginLoadProcessTags({ catalog_process_role: "unified", load_role: "worker" })).toEqual([]);
  });

  it("returns worker tag on sharded hub catalog", () => {
    expect(
      pluginLoadProcessTags({ catalog_process_role: "hub", load_role: "worker" } as PluginRow),
    ).toEqual(["分片节点"]);
  });

  it("returns both tags for dual-role plugins", () => {
    expect(
      pluginLoadProcessTags({ catalog_process_role: "hub", load_role: "both" } as PluginRow),
    ).toEqual(["主节点", "分片节点"]);
  });
});
