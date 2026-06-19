import { describe, expect, it } from "vitest";
import type { PluginConfigField } from "@/api/pallasTypes";
import {
  buildGroupSummary,
  fieldCompactMeta,
  fieldDisplayName,
  fieldHelpDefaultValue,
  fieldRangeLabel,
  fieldTypeLabel,
  resolveInitialPluginConfigTab,
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

  it("builds compact meta chips for config rows", () => {
    expect(fieldCompactMeta(makeField({ kind: "json", required: true }))).toEqual(["JSON", "必填", "结构化"]);
    expect(fieldCompactMeta(makeField({ kind: "bool", required: false }))).toEqual(["开关"]);
  });

  it("appends a range chip for bounded numeric fields", () => {
    expect(fieldCompactMeta(makeField({ kind: "int", min_value: 1, max_value: 65535 }))).toEqual([
      "数字",
      "范围 1–65535",
    ]);
    expect(fieldCompactMeta(makeField({ kind: "float", min_value: 0 }))).toEqual(["数字", "≥ 0"]);
  });

  it("omits the secret label from compact meta (rendered as colored badge instead)", () => {
    expect(fieldCompactMeta(makeField({ kind: "string", secret: true }))).toEqual(["文本"]);
  });

  it("formats numeric range labels", () => {
    expect(fieldRangeLabel(makeField({ kind: "int", min_value: 1, max_value: 10 }))).toBe("范围 1–10");
    expect(fieldRangeLabel(makeField({ kind: "int", max_value: 10 }))).toBe("≤ 10");
    expect(fieldRangeLabel(makeField({ kind: "int" }))).toBe("");
    expect(fieldRangeLabel(makeField({ kind: "string", min_value: 1 }))).toBe("");
  });

  it("formats help popup default values safely", () => {
    expect(fieldHelpDefaultValue(makeField({ default: "" }))).toBe("无");
    expect(fieldHelpDefaultValue(makeField({ default: { enabled: true } }))).toContain("enabled");
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

  it("prefers permission tab as default landing section", () => {
    expect(resolveInitialPluginConfigTab({
      hasPermConfig: true,
      hasLimitConfig: true,
      hasConfigFields: true,
    })).toBe("perm");
    expect(resolveInitialPluginConfigTab({
      hasPermConfig: false,
      hasLimitConfig: true,
      hasConfigFields: true,
    })).toBe("limit");
    expect(resolveInitialPluginConfigTab({
      hasPermConfig: false,
      hasLimitConfig: false,
      hasConfigFields: true,
    })).toBe("config");
    expect(resolveInitialPluginConfigTab({
      hasPermConfig: false,
      hasLimitConfig: false,
      hasConfigFields: false,
    })).toBe("runtime");
  });
});
