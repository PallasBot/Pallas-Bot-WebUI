import { describe, expect, it } from "vitest";
import type { PluginRow } from "../src/api/pallasTypes";
import {
  pluginSourceBadgeVariant,
  pluginSourceLabel,
  pluginVersionLabel,
} from "../src/utils/pluginSourceLabel";

describe("plugin catalog source badges", () => {
  it("maps every catalog source to one user-facing category", () => {
    expect(pluginSourceLabel("core")).toBe("内置插件");
    expect(pluginSourceLabel("bundled")).toBe("内置插件");
    expect(pluginSourceLabel("extra")).toBe("官方插件");
    expect(pluginSourceLabel("community")).toBe("社区插件");
    expect(pluginSourceLabel("local")).toBe("本地插件");
    expect(pluginSourceLabel("pip")).toBe("PyPI 包");
    expect(pluginSourceLabel(undefined)).toBe("PyPI 包");
  });

  it("uses distinct shared badge variants for source categories", () => {
    expect(pluginSourceBadgeVariant("core")).toBe("neutral");
    expect(pluginSourceBadgeVariant("extra")).toBe("info");
    expect(pluginSourceBadgeVariant("community")).toBe("success");
    expect(pluginSourceBadgeVariant("local")).toBe("warn");
    expect(pluginSourceBadgeVariant("pip")).toBe("outline");
  });

  it("renders only reliable plugin versions", () => {
    expect(pluginVersionLabel({ plugin_version: "1.2.3" } as PluginRow)).toBe("v1.2.3");
    expect(pluginVersionLabel({ plugin_version: "" } as PluginRow)).toBe("");
  });
});
