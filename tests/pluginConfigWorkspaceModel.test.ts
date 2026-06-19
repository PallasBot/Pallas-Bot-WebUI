import { describe, expect, it } from "vitest";
import type { PluginConfigField } from "@/api/pallasTypes";
import {
  buildGroupSummary,
  fieldDisplayName,
  fieldTypeLabel,
  summarizeFieldValue,
} from "@/utils/pluginConfigWorkspaceModel";

function makeField(overrides: Partial<PluginConfigField> = {}): PluginConfigField {
  return {
    name: "enabled",
    env_key: "ENABLED",
    kind: "bool",
    label: "启用开关",
    description: "desc",
    required: false,
    default: "false",
    choices: [],
    ...overrides,
  };
}

describe("pluginConfigWorkspaceModel", () => {
  it("prefers label for display name", () => {
    expect(fieldDisplayName(makeField())).toBe("启用开关");
    expect(fieldDisplayName(makeField({ label: "", name: "raw_name" }))).toBe("raw_name");
  });

  it("summarizes bool and empty values", () => {
    expect(summarizeFieldValue(makeField({ kind: "bool" }), "true")).toBe("开启");
    expect(summarizeFieldValue(makeField({ kind: "bool" }), "false")).toBe("关闭");
    expect(summarizeFieldValue(makeField({ kind: "json" }), "")).toBe("未填写");
  });

  it("maps field types to readable labels", () => {
    expect(fieldTypeLabel(makeField({ kind: "int" }))).toBe("数字");
    expect(fieldTypeLabel(makeField({ kind: "enum" }))).toBe("选项");
  });

  it("builds group summary from current values", () => {
    const fields = [
      makeField({ name: "enabled", kind: "bool", required: true }),
      makeField({ name: "threshold", kind: "float", label: "阈值", required: true }),
      makeField({ name: "groups", kind: "json", label: "群列表" }),
    ];
    const summary = buildGroupSummary(fields, {
      enabled: "true",
      threshold: "0.82",
      groups: "",
    });

    expect(summary.total).toBe(3);
    expect(summary.filled).toBe(2);
    expect(summary.required).toBe(2);
    expect(summary.requiredFilled).toBe(2);
  });
});
