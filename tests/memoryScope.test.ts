import { describe, expect, it } from "vitest";

import { memoryScopeSummary } from "../src/utils/memoryScope";

describe("memoryScopeSummary", () => {
  it("describes an empty group as the selected bot's full scope", () => {
    expect(memoryScopeSummary("38793486", "")).toEqual({
      title: "该 Bot 的全部范围",
      detail: "未指定群号，查看 Bot 38793486 的全部记忆与关系备注。",
    });
  });

  it("describes a positive group as a group-only scope", () => {
    expect(memoryScopeSummary("38793486", "52629709")).toEqual({
      title: "群 52629709",
      detail: "仅查看 Bot 38793486 在该群的记忆与关系备注。",
    });
  });

  it("keeps the scope card hidden before selecting a bot", () => {
    expect(memoryScopeSummary("", "52629709")).toBeNull();
  });
});
